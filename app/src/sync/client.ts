// Talks to the Rust relay (engine/src/main.rs). Pushes the outbox, pulls ops
// past our cursor, and never blocks editing: with no signal, edits simply
// wait in SQLite until the next successful round trip.

import type { Op } from '../crdt/note';
import type { Vault } from '../store/vault';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'expedition';

export type SyncState = {
  status: SyncStatus;
  queued: number;
  lastSync?: number;
  offlineSince?: number;
  error?: string;
  server: string;
  expedition: boolean;
};

export type Reconnect = { away: number; edits: number; ops: number; conflicts: number };

const BATCH = 4000;

/** An edit is a burst of typing: one note, one device, one minute. */
const countEdits = (ops: Op[]) => new Set(ops.map((o) => `${o.id.note}:${o.id.replica}:${Math.floor(o.ts / 60_000)}`)).size;

export class SyncClient {
  private listeners = new Set<() => void>();
  private timer: number | undefined;
  private running = false;
  private awayEdits = 0;
  private awayOps = 0;
  state: SyncState;
  onReconnect?: (r: Reconnect) => void;

  constructor(private vault: Vault) {
    const db = vault.db;
    this.state = {
      status: db.get('expedition') === '1' ? 'expedition' : 'idle',
      queued: db.outboxSize(),
      lastSync: Number(db.get('last-sync')) || undefined,
      offlineSince: Number(db.get('offline-since')) || undefined,
      server: db.get('server') ?? '',
      expedition: db.get('expedition') === '1',
    };
    vault.onLocalCommit = () => {
      this.set({ queued: db.outboxSize() });
      this.schedule(1200);
    };
    addEventListener('online', () => this.schedule(0));
    addEventListener('offline', () => this.goOffline('The device reports no network'));
    this.schedule(300);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  setServer(url: string) {
    this.vault.db.put('server', url.trim().replace(/\/+$/, ''));
    this.set({ server: url.trim().replace(/\/+$/, '') });
    this.schedule(0);
  }

  setExpedition(on: boolean) {
    this.vault.db.put('expedition', on ? '1' : '0');
    if (on) {
      this.markOffline();
      this.set({ expedition: true, status: 'expedition', error: undefined });
    } else {
      this.set({ expedition: false, status: 'idle' });
      this.schedule(0);
    }
  }

  syncNow() {
    this.schedule(0);
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.run(), ms);
  }

  private markOffline() {
    if (!this.state.offlineSince) {
      const now = Date.now();
      this.vault.db.put('offline-since', String(now));
      this.set({ offlineSince: now });
    }
  }

  private goOffline(error: string) {
    this.markOffline();
    this.set({ status: this.state.expedition ? 'expedition' : 'offline', error });
  }

  private async run() {
    if (this.running) return;
    if (this.state.expedition) return this.set({ status: 'expedition' });
    if (!navigator.onLine) {
      this.goOffline('The device reports no network');
      return this.schedule(15_000);
    }
    this.running = true;
    this.set({ status: 'syncing' });
    const db = this.vault.db;
    try {
      let more = true;
      while (more) {
        const outgoing = db.outbox(BATCH);
        const res = await fetch(`${this.state.server}/api/sync`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ replica: this.vault.replica, cursor: Number(db.get('cursor') ?? 0), ops: outgoing }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`Relay answered ${res.status}`);
        const body: { cursor: number; more: boolean; ops: Op[]; conflicts: number } = await res.json();
        db.clearOutbox(outgoing);
        const fresh = this.vault.applyRemote(body.ops);
        db.put('cursor', String(body.cursor));
        if (this.state.offlineSince) {
          this.awayEdits += countEdits(outgoing.filter((o) => o.id.replica === this.vault.replica)) + countEdits(fresh);
          this.awayOps += outgoing.length + fresh.length;
        }
        more = body.more || db.outboxSize() > 0;
      }
      const now = Date.now();
      db.put('last-sync', String(now));
      if (this.state.offlineSince) {
        this.onReconnect?.({ away: now - this.state.offlineSince, edits: this.awayEdits, ops: this.awayOps, conflicts: 0 });
        this.awayEdits = this.awayOps = 0;
        db.put('offline-since', undefined);
      }
      this.set({ status: 'idle', lastSync: now, offlineSince: undefined, error: undefined, queued: db.outboxSize() });
      this.schedule(document.hidden ? 60_000 : 10_000);
    } catch (e) {
      this.goOffline(e instanceof Error && e.name !== 'TimeoutError' && !/fetch|network|load/i.test(e.message) ? e.message : 'Relay unreachable');
      this.schedule(15_000);
    } finally {
      this.running = false;
      this.set({ queued: db.outboxSize() });
    }
  }
}
