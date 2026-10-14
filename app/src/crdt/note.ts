// TypeScript mirror of engine/src/sync: the same ops, ids and RGA walk, so the
// relay and every device render identical text from identical op sets.

export type OpId = { lamport: number; replica: string; note: string };

export type Kind =
  | { t: 'ins'; after: OpId | null; ch: string }
  | { t: 'del'; target: OpId }
  | { t: 'set'; key: string; value: string };

export type Op = { id: OpId; ts: number } & Kind;

const pad = (n: number) => n.toString(16).padStart(16, '0');

/** Same storage key as `OpId::key` in Rust: `note.lamport.replica`. */
export const keyOf = (id: OpId) => `${id.note}.${pad(id.lamport)}.${id.replica}`;

/** Lamport, then replica, then note — the derived `Ord` on the Rust struct. */
export function compareIds(a: OpId, b: OpId): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.replica !== b.replica) return a.replica < b.replica ? -1 : 1;
  return a.note < b.note ? -1 : a.note > b.note ? 1 : 0;
}

export const randomHex64 = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

export type Segment = { text: string; replica: string; deleted: boolean; ts: number };

export class Note {
  readonly id: string;
  readonly ops = new Map<string, Op>();
  /** Version vector: replica → highest Lamport time seen. */
  readonly clock = new Map<string, number>();
  body = '';
  /** Keys of visible inserts in document order (index i ↔ body char i). */
  visible: string[] = [];

  private children = new Map<string, string[]>();
  private deleted = new Set<string>();
  private registers = new Map<string, Op>();

  constructor(id: string) {
    this.id = id;
  }

  /** Union of op sets; returns how many ops were new. Never conflicts. */
  merge(remote: Iterable<Op>): number {
    let fresh = 0;
    for (const op of remote) if (this.add(op)) fresh++;
    if (fresh) this.render();
    return fresh;
  }

  register(key: string): string | undefined {
    const op = this.registers.get(key);
    return op && op.t === 'set' ? op.value : undefined;
  }

  get lamport() {
    let max = 0;
    for (const t of this.clock.values()) max = Math.max(max, t);
    return max;
  }

  insert(replica: string, index: number, text: string, ts: number): Op[] {
    let after: OpId | null = index > 0 ? this.ops.get(this.visible[index - 1])!.id : null;
    const made: Op[] = [];
    for (const ch of Array.from(text)) {
      const op = this.author(replica, ts, { t: 'ins', after, ch });
      after = op.id;
      made.push(op);
    }
    this.render();
    return made;
  }

  delete(replica: string, index: number, len: number, ts: number): Op[] {
    const targets = this.visible.slice(index, index + len).map((k) => this.ops.get(k)!.id);
    const made = targets.map((target) => this.author(replica, ts, { t: 'del', target }));
    this.render();
    return made;
  }

  set(replica: string, key: string, value: string, ts: number): Op {
    return this.author(replica, ts, { t: 'set', key, value });
  }

  /** Replace the whole body with `next` using the smallest single splice. */
  edit(replica: string, next: string, ts: number): Op[] {
    const a = Array.from(this.body);
    const b = Array.from(next);
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--;
      endB--;
    }
    const ops: Op[] = [];
    if (endA > start) ops.push(...this.delete(replica, start, endA - start, ts));
    if (endB > start) ops.push(...this.insert(replica, start, b.slice(start, endB).join(''), ts));
    return ops;
  }

  /** The body as it read at Lamport time `lamport` (time travel). */
  bodyAt(lamport: number): string {
    return this.walk(lamport, false)
      .map((s) => s.text)
      .join('');
  }

  /** Every character ever typed, tombstones included, tagged by author. */
  palimpsest(): Segment[] {
    return this.walk(Infinity, true);
  }

  /** Distinct Lamport times at which this note changed, ascending. */
  history(): { lamport: number; ts: number; replica: string }[] {
    const seen = new Map<number, { lamport: number; ts: number; replica: string }>();
    for (const op of this.ops.values()) {
      if (!seen.has(op.id.lamport)) seen.set(op.id.lamport, { lamport: op.id.lamport, ts: op.ts, replica: op.id.replica });
    }
    return [...seen.values()].sort((a, b) => a.lamport - b.lamport);
  }

  private add(op: Op): boolean {
    const key = keyOf(op.id);
    if (this.ops.has(key)) return false;
    this.ops.set(key, op);
    this.clock.set(op.id.replica, Math.max(this.clock.get(op.id.replica) ?? 0, op.id.lamport));
    if (op.t === 'ins') {
      const parent = op.after ? keyOf(op.after) : '';
      const kids = this.children.get(parent) ?? [];
      // Keep siblings ascending so the walk pops the newest first.
      let i = kids.length;
      while (i > 0 && compareIds(this.ops.get(kids[i - 1])!.id, op.id) > 0) i--;
      kids.splice(i, 0, key);
      this.children.set(parent, kids);
    } else if (op.t === 'del') {
      this.deleted.add(keyOf(op.target));
    } else {
      const cur = this.registers.get(op.key);
      if (!cur || compareIds(cur.id, op.id) < 0) this.registers.set(op.key, op);
    }
    return true;
  }

  private author(replica: string, ts: number, kind: Kind): Op {
    const lamport = this.lamport + 1;
    const op = { id: { lamport, replica, note: this.id }, ts, ...kind } as Op;
    this.add(op);
    return op;
  }

  private render() {
    const keys: string[] = [];
    const chars: string[] = [];
    const stack = [...(this.children.get('') ?? [])];
    while (stack.length) {
      const key = stack.pop()!;
      if (!this.deleted.has(key)) {
        keys.push(key);
        chars.push((this.ops.get(key) as Extract<Op, { t: 'ins' }>).ch);
      }
      const kids = this.children.get(key);
      if (kids) stack.push(...kids);
    }
    this.visible = keys;
    this.body = chars.join('');
  }

  private walk(limit: number, withTombstones: boolean): Segment[] {
    const deletedBy = new Map<string, number>();
    for (const op of this.ops.values()) {
      if (op.t === 'del' && op.id.lamport <= limit) deletedBy.set(keyOf(op.target), op.id.lamport);
    }
    const out: Segment[] = [];
    const stack = [...(this.children.get('') ?? [])];
    while (stack.length) {
      const key = stack.pop()!;
      const op = this.ops.get(key) as Extract<Op, { t: 'ins' }>;
      if (op.id.lamport <= limit) {
        const deleted = deletedBy.has(key);
        if (!deleted || withTombstones) {
          const last = out[out.length - 1];
          if (last && last.replica === op.id.replica && last.deleted === deleted) last.text += op.ch;
          else out.push({ text: op.ch, replica: op.id.replica, deleted, ts: op.ts });
        }
      }
      const kids = this.children.get(key);
      if (kids) stack.push(...kids);
    }
    return out;
  }
}
