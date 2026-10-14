import { Note, keyOf, randomHex64, type Op } from '../crdt/note';
import { LocalDB, deviceSlot } from './db';
import * as md from './markdown';
import { SEED_REPLICA, SYSTEM_NOTE, seedOps } from './seed';

export type NoteMeta = {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  pinned: boolean;
  trashed: boolean;
  journal?: string;
  created: number;
  updated: number;
  ops: number;
  words: number;
  tags: string[];
};

export type Backlink = { from: string; lines: string[] };

export type Index = {
  byTitle: Map<string, string>;
  outgoing: Map<string, string[]>;
  unresolved: Map<string, string[]>;
  backlinks: Map<string, Backlink[]>;
  tags: Map<string, string[]>;
  tasks: { note: string; task: md.Task }[];
};

type Listener = () => void;

function defaultDeviceName() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Linux';
  return `${kind} browser`;
}

export class Vault {
  readonly notes = new Map<string, Note>();
  private listeners = new Set<Listener>();
  private version = 0;
  private metaCache?: { v: number; list: NoteMeta[]; byId: Map<string, NoteMeta> };
  private indexCache?: { v: number; index: Index };
  /** Called after every local commit so the sync client can push soon. */
  onLocalCommit?: () => void;

  private constructor(
    readonly db: LocalDB,
    readonly replica: string,
  ) {}

  static async open(): Promise<Vault> {
    const db = await LocalDB.open();
    let replica = db.get('replica');
    if (!replica) {
      replica = randomHex64();
      db.put('replica', replica);
    }
    const vault = new Vault(db, replica);
    if (!db.get('seeded')) {
      // Seed ops are identical on every device; the relay dedups them, but
      // it needs them too so it holds (and can render) complete notes.
      db.persist(seedOps(), true);
      db.put('seeded', '1');
      if (!db.get('device-name')) db.put('device-name', deviceSlot === 'default' ? defaultDeviceName() : deviceSlot);
    }
    vault.ingest(db.loadOps());
    if (!vault.deviceNames().has(replica)) vault.setDeviceName(db.get('device-name') ?? defaultDeviceName());
    return vault;
  }

  // ── subscription (useSyncExternalStore) ─────────────────────────────────
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private bump() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // ── reads ───────────────────────────────────────────────────────────────
  list(): NoteMeta[] {
    return this.metas().list;
  }

  meta(id: string): NoteMeta | undefined {
    return this.metas().byId.get(id);
  }

  private metas() {
    if (this.metaCache?.v === this.version) return this.metaCache;
    const list: NoteMeta[] = [];
    for (const n of this.notes.values()) {
      if (n.id === SYSTEM_NOTE) continue;
      let updated = 0;
      for (const op of n.ops.values()) updated = Math.max(updated, op.ts);
      list.push({
        id: n.id,
        title: n.register('title') || 'Untitled',
        body: n.body,
        excerpt: md.excerpt(n.body),
        pinned: n.register('pinned') === '1',
        trashed: n.register('trashed') === '1',
        journal: n.register('journal') || undefined,
        created: Number(n.register('created') ?? updated),
        updated,
        ops: n.ops.size,
        words: md.wordCount(n.body),
        tags: md.tags(n.body),
      });
    }
    list.sort((a, b) => b.updated - a.updated);
    this.metaCache = { v: this.version, list, byId: new Map(list.map((m) => [m.id, m])) };
    return this.metaCache;
  }

  index(): Index {
    if (this.indexCache?.v === this.version) return this.indexCache.index;
    const live = this.list().filter((m) => !m.trashed);
    const byTitle = new Map(live.map((m) => [m.title.toLowerCase(), m.id]));
    const outgoing = new Map<string, string[]>();
    const unresolved = new Map<string, string[]>();
    const backlinks = new Map<string, Backlink[]>();
    const tags = new Map<string, string[]>();
    const tasks: Index['tasks'] = [];
    for (const m of live) {
      const out = new Set<string>();
      for (const { target } of md.links(m.body)) {
        const id = byTitle.get(target.toLowerCase());
        if (id && id !== m.id) out.add(id);
        else if (!id) unresolved.set(target, [...(unresolved.get(target) ?? []), m.id]);
      }
      outgoing.set(m.id, [...out]);
      for (const to of out) {
        const title = this.meta(to)!.title;
        const lines = md.contextLines(m.body, new RegExp(`\\[\\[${md.escapeRegExp(title)}`, 'i'));
        backlinks.set(to, [...(backlinks.get(to) ?? []), { from: m.id, lines }]);
      }
      for (const t of m.tags) tags.set(t, [...(tags.get(t) ?? []), m.id]);
      for (const task of md.tasks(m.body)) tasks.push({ note: m.id, task });
    }
    const index = { byTitle, outgoing, unresolved, backlinks, tags, tasks };
    this.indexCache = { v: this.version, index };
    return index;
  }

  resolve(title: string): string | undefined {
    return this.index().byTitle.get(title.trim().toLowerCase());
  }

  /** Notes that mention this note's title as plain text, without linking it. */
  unlinkedMentions(id: string): Backlink[] {
    const title = this.meta(id)?.title;
    if (!title || title.length < 4) return [];
    const plain = new RegExp(`(?<!\\[\\[)\\b${md.escapeRegExp(title)}\\b(?![^\\[]*\\]\\])`, 'i');
    return this.list()
      .filter((m) => m.id !== id && !m.trashed && plain.test(m.body))
      .map((m) => ({ from: m.id, lines: md.contextLines(m.body, plain) }));
  }

  deviceNames(): Map<string, string> {
    const sys = this.notes.get(SYSTEM_NOTE);
    const names = new Map<string, string>([[SEED_REPLICA, 'Fieldnote']]);
    if (!sys) return names;
    for (const op of sys.ops.values()) {
      if (op.t === 'set' && op.key.startsWith('device:')) {
        const r = op.key.slice(7);
        names.set(r, sys.register(op.key) ?? r);
      }
    }
    return names;
  }

  // ── writes ──────────────────────────────────────────────────────────────
  private note(id: string): Note {
    let n = this.notes.get(id);
    if (!n) this.notes.set(id, (n = new Note(id)));
    return n;
  }

  private commit(ops: Op[]) {
    if (!ops.length) return;
    this.db.persist(ops, true);
    this.bump();
    this.onLocalCommit?.();
  }

  create(title: string, body = '', extra: Record<string, string> = {}): string {
    const id = randomHex64();
    const n = this.note(id);
    const ts = Date.now();
    const ops = [n.set(this.replica, 'title', title, ts), n.set(this.replica, 'created', String(ts), ts)];
    for (const [k, v] of Object.entries(extra)) ops.push(n.set(this.replica, k, v, ts));
    if (body) ops.push(...n.insert(this.replica, 0, body, ts));
    this.commit(ops);
    return id;
  }

  editBody(id: string, next: string) {
    const n = this.notes.get(id);
    if (!n || n.body === next) return;
    this.commit(n.edit(this.replica, next, Date.now()));
  }

  setTitle(id: string, title: string) {
    const n = this.notes.get(id);
    const before = n?.register('title');
    if (!n || !title.trim() || before === title) return;
    const ts = Date.now();
    const ops = [n.set(this.replica, 'title', title.trim(), ts)];
    // Keep [[links]] pointing at the renamed note, as Obsidian does.
    if (before) {
      const pattern = new RegExp(`(!?\\[\\[)${md.escapeRegExp(before)}(?=[\\]|#])`, 'gi');
      for (const other of this.notes.values()) {
        if (other.id === id || !pattern.test(other.body)) continue;
        ops.push(...other.edit(this.replica, other.body.replace(pattern, `$1${title.trim()}`), ts));
      }
    }
    this.commit(ops);
  }

  setFlag(id: string, key: string, value: string) {
    const n = this.notes.get(id);
    if (!n || n.register(key) === value) return;
    this.commit([n.set(this.replica, key, value, Date.now())]);
  }

  toggleTask(id: string, offset: number) {
    const n = this.notes.get(id);
    if (!n) return;
    const chars = Array.from(n.body);
    // `offset` is a UTF-16 index from the task scanner; convert to code points.
    const cp = Array.from(n.body.slice(0, offset)).length;
    chars[cp] = chars[cp] === ' ' ? 'x' : ' ';
    this.editBody(id, chars.join(''));
  }

  setDeviceName(name: string) {
    const sys = this.note(SYSTEM_NOTE);
    this.db.put('device-name', name);
    this.commit([sys.set(this.replica, `device:${this.replica}`, name, Date.now())]);
  }

  journal(date: string): string {
    const existing = this.list().find((m) => m.journal === date && !m.trashed);
    if (existing) return existing.id;
    return this.create(date, '', { journal: date });
  }

  // ── sync ────────────────────────────────────────────────────────────────
  /** Merge ops from the relay. Returns the ones that were new here. */
  applyRemote(ops: Op[]): Op[] {
    const fresh = this.ingest(ops);
    if (fresh.length) this.db.persist(fresh, false);
    return fresh;
  }

  private ingest(ops: Op[]): Op[] {
    const byNote = new Map<string, Op[]>();
    for (const op of ops) byNote.set(op.id.note, [...(byNote.get(op.id.note) ?? []), op]);
    const fresh: Op[] = [];
    for (const [id, group] of byNote) {
      const n = this.note(id);
      const before = n.ops.size;
      const known = new Set(n.ops.keys());
      n.merge(group);
      if (n.ops.size > before) fresh.push(...group.filter((op) => !known.has(keyOf(op.id))));
    }
    if (fresh.length) this.bump();
    return fresh;
  }

  // ── import / export ─────────────────────────────────────────────────────
  exportMarkdown(id: string): { name: string; text: string } | undefined {
    const m = this.meta(id);
    return m && { name: `${m.title.replace(/[\\/:*?"<>|]/g, '-')}.md`, text: m.body };
  }
}
