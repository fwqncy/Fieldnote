// On-device SQLite. Same `ops` schema as the Rust relay (engine/src/sync/merge.rs),
// compiled to WebAssembly and snapshotted to IndexedDB so notes survive reloads
// with no network at all.

import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { keyOf, type Op } from '../crdt/note';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ops (id TEXT PRIMARY KEY, bytes BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** `?device=tablet` gives a tab its own database and replica, to try sync between "devices" on one machine. */
export const deviceSlot = new URLSearchParams(location.search).get('device')?.replace(/[^\w-]/g, '') || 'default';
const IDB_KEY = `fieldnote:${deviceSlot}`;

export class LocalDB {
  private saveTimer: number | undefined;

  private constructor(private db: Database) {}

  static async open(): Promise<LocalDB> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const snapshot = await idb('readonly', (s) => s.get(IDB_KEY)).catch(() => undefined);
    const db = new SQL.Database(snapshot instanceof Uint8Array ? snapshot : undefined);
    db.exec(SCHEMA);
    const local = new LocalDB(db);
    addEventListener('pagehide', () => local.flush());
    document.addEventListener('visibilitychange', () => document.hidden && local.flush());
    return local;
  }

  loadOps(): Op[] {
    const out: Op[] = [];
    const stmt = this.db.prepare('SELECT bytes FROM ops ORDER BY rowid');
    while (stmt.step()) out.push(JSON.parse(dec.decode(stmt.get()[0] as Uint8Array)));
    stmt.free();
    return out;
  }

  /** Mirrors `Note::persist`: one transaction, INSERT OR IGNORE. */
  persist(ops: Op[], outbox: boolean) {
    if (!ops.length) return;
    this.db.exec('BEGIN');
    const ins = this.db.prepare('INSERT OR IGNORE INTO ops VALUES (?1, ?2)');
    const box = this.db.prepare('INSERT OR IGNORE INTO outbox VALUES (?1)');
    for (const op of ops) {
      const id = keyOf(op.id);
      ins.run([id, enc.encode(JSON.stringify(op))]);
      if (outbox) box.run([id]);
    }
    ins.free();
    box.free();
    this.db.exec('COMMIT');
    this.scheduleSave();
  }

  outbox(limit: number): Op[] {
    const out: Op[] = [];
    const stmt = this.db.prepare('SELECT ops.bytes FROM outbox JOIN ops USING (id) LIMIT ?1');
    stmt.bind([limit]);
    while (stmt.step()) out.push(JSON.parse(dec.decode(stmt.get()[0] as Uint8Array)));
    stmt.free();
    return out;
  }

  outboxSize(): number {
    return Number(this.db.exec('SELECT count(*) FROM outbox')[0]?.values[0][0] ?? 0);
  }

  clearOutbox(ops: Op[]) {
    this.db.exec('BEGIN');
    const del = this.db.prepare('DELETE FROM outbox WHERE id = ?1');
    for (const op of ops) del.run([keyOf(op.id)]);
    del.free();
    this.db.exec('COMMIT');
    this.scheduleSave();
  }

  get(key: string): string | undefined {
    const r = this.db.exec('SELECT value FROM meta WHERE key = ?1', [key]);
    return r[0]?.values[0][0] as string | undefined;
  }

  put(key: string, value: string | undefined) {
    if (value === undefined) this.db.run('DELETE FROM meta WHERE key = ?1', [key]);
    else this.db.run('INSERT OR REPLACE INTO meta VALUES (?1, ?2)', [key, value]);
    this.scheduleSave();
  }

  sizeBytes(): number {
    return this.db.export().byteLength;
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flush(), 600);
  }

  flush() {
    clearTimeout(this.saveTimer);
    const bytes = this.db.export();
    void idb('readwrite', (s) => s.put(bytes, IDB_KEY));
  }

  static async wipe() {
    await idb('readwrite', (s) => s.delete(IDB_KEY));
  }
}

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('fieldnote', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('snapshots');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction('snapshots', mode).objectStore('snapshots'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}
