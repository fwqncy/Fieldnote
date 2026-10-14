import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { SyncClient } from '../sync/client';
import type { Vault } from '../store/vault';

export type Toast = { id: number; title: string; detail?: string; tone?: 'success' | 'info' | 'danger'; action?: { label: string; run: () => void } };

export type AppCtx = {
  vault: Vault;
  sync: SyncClient;
  toast: (t: Omit<Toast, 'id'>) => void;
  openPalette: (mode?: 'all' | 'notes' | 'templates') => void;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppContext');
  return ctx;
}

/** The vault, re-rendering whenever any note changes. */
export function useVault() {
  const { vault } = useApp();
  useSyncExternalStore(vault.subscribe, vault.getVersion);
  return vault;
}

export function useSyncState() {
  const { sync } = useApp();
  return useSyncExternalStore(sync.subscribe, sync.getState);
}

// ── routing: the URL is the source of truth so every view deep-links ─────────
export type View = 'edit' | 'read' | 'split';
export type Route =
  | { name: 'home' }
  | { name: 'note'; id: string; view?: View; layer?: 'palimpsest' }
  | { name: 'graph'; focus?: string }
  | { name: 'journal' }
  | { name: 'tasks'; filter?: 'open' | 'done' | 'all' }
  | { name: 'search'; q: string }
  | { name: 'tag'; tag: string }
  | { name: 'oracle' }
  | { name: 'trash' }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query);
  const [head, arg] = path.split('/').map(decodeURIComponent);
  switch (head) {
    case 'note':
      return arg ? { name: 'note', id: arg, view: (q.get('view') as View) || undefined, layer: q.get('layer') === 'palimpsest' ? 'palimpsest' : undefined } : { name: 'home' };
    case 'graph':
      return { name: 'graph', focus: q.get('focus') || undefined };
    case 'tasks':
      return { name: 'tasks', filter: (q.get('show') as 'open' | 'done' | 'all') || undefined };
    case 'search':
      return { name: 'search', q: q.get('q') ?? '' };
    case 'tag':
      return arg ? { name: 'tag', tag: arg } : { name: 'home' };
    case 'journal':
    case 'oracle':
    case 'trash':
    case 'settings':
      return { name: head };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1]));
    return p.toString() ? `?${p}` : '';
  };
  switch (r.name) {
    case 'home':
      return '#/';
    case 'note':
      return `#/note/${r.id}${qs({ view: r.view, layer: r.layer })}`;
    case 'graph':
      return `#/graph${qs({ focus: r.focus })}`;
    case 'tasks':
      return `#/tasks${qs({ show: r.filter })}`;
    case 'search':
      return `#/search${qs({ q: r.q })}`;
    case 'tag':
      return `#/tag/${encodeURIComponent(r.tag)}`;
    default:
      return `#/${r.name}`;
  }
}

export function navigate(r: Route, replace = false) {
  const next = href(r);
  if (replace) history.replaceState(null, '', next);
  else location.hash = next;
  if (replace) dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

// ── formatting ──────────────────────────────────────────────────────────────
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
export function relative(ts: number, now = Date.now()) {
  const s = (ts - now) / 1000;
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(ts);
}

export function duration(ms: number) {
  const m = Math.round(ms / 60000);
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (m < 1) return 'a moment';
  if (m < 60) return fmt(m, 'minute');
  const h = Math.round(m / 60);
  if (h < 48) return fmt(h, 'hour');
  return fmt(Math.round(h / 24), 'day');
}

export const num = (n: number) => new Intl.NumberFormat().format(n);

export const isoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number) {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) (out += s), (n -= v);
  return out;
}

export const mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl ';
