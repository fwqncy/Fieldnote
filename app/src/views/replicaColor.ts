import { SEED_REPLICA } from '../store/seed';

const PALETTE = ['var(--ground-ink)', 'var(--leaf)', '#c48df0', '#4cb8e6', '#ef8a4c', '#e06c9f'];

/** Stable per-device colour: this device wears the accent, others a palette hue. */
export function replicaColor(replica: string, self: string) {
  if (replica === self) return 'var(--accent-ink)';
  if (replica === SEED_REPLICA) return 'var(--text-muted)';
  let h = 0;
  for (const c of replica) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
