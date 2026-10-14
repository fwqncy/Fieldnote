import { alpha, contrast, ensureContrast, hexToHsl, hsl, readableOn } from './color';

export type Seeds = { accent: string; ground: string };
export type SchemeId = 'apollo' | 'tyrian' | 'custom';
export type Mode = 'system' | 'dark' | 'light';

export const SCHEMES: Record<Exclude<SchemeId, 'custom'>, { name: string; blurb: string; seeds: Seeds }> = {
  apollo: { name: 'Apollo', blurb: 'Sun gold on black & lapis blue', seeds: { accent: '#e8b224', ground: '#0c1736' } },
  tyrian: { name: 'Tyrian', blurb: 'Burgundy & navy, like dyed wool', seeds: { accent: '#9c1d3d', ground: '#0f1b45' } },
};

export type Tokens = Record<string, string>;

/**
 * Every scheme, presets included, is derived from two seeds so contrast rules
 * hold for any colour a person picks on the wheel.
 */
export function deriveTokens({ accent, ground }: Seeds, dark: boolean): Tokens {
  const a = hexToHsl(accent);
  const g = hexToHsl(ground);
  const gs = Math.min(g.s, 70);

  const t: Tokens = dark
    ? {
        bg: hsl(g.h, gs * 0.55, 4),
        'bg-elev': hsl(g.h, gs * 0.75, 7),
        surface: hsl(g.h, gs * 0.7, 9.5),
        'surface-2': hsl(g.h, gs * 0.6, 13),
        'surface-3': hsl(g.h, gs * 0.5, 17),
        border: hsl(g.h, gs * 0.4, 18),
        'border-strong': hsl(g.h, gs * 0.35, 27),
        ground: hsl(g.h, Math.max(g.s, 40), Math.min(Math.max(g.l, 14), 24)),
        text: hsl(a.h, Math.min(a.s, 40) * 0.6, 91),
      }
    : {
        bg: hsl(a.h, Math.min(a.s, 45) * 0.55, 95),
        'bg-elev': hsl(a.h, Math.min(a.s, 45) * 0.5, 92),
        surface: hsl(a.h, Math.min(a.s, 45) * 0.6, 98.5),
        'surface-2': hsl(a.h, Math.min(a.s, 45) * 0.4, 93.5),
        'surface-3': hsl(a.h, Math.min(a.s, 45) * 0.35, 89),
        border: hsl(g.h, gs * 0.25, 84),
        'border-strong': hsl(g.h, gs * 0.25, 72),
        ground: hsl(g.h, Math.max(g.s, 40), Math.min(Math.max(g.l, 14), 26)),
        text: hsl(g.h, Math.min(gs, 55), 10),
      };

  t['text-muted'] = ensureContrast(dark ? hsl(g.h, gs * 0.3, 68) : hsl(g.h, gs * 0.3, 36), t.surface, 4.6);
  t['text-faint'] = ensureContrast(dark ? hsl(g.h, gs * 0.25, 52) : hsl(g.h, gs * 0.2, 50), t.surface, 3.1);
  t.accent = accent;
  t['on-accent'] = readableOn(accent);
  // Accent used as text or icon colour must stay legible on every surface.
  t['accent-ink'] = ensureContrast(accent, t['surface-2'], 4.6);
  t['accent-soft'] = alpha(accent, dark ? 0.16 : 0.14);
  t['accent-line'] = alpha(accent, dark ? 0.45 : 0.55);
  t['ground-ink'] = ensureContrast(hsl(g.h, Math.max(g.s, 45), dark ? 70 : 38), t.surface, 4.6);
  t['ground-soft'] = alpha(hsl(g.h, Math.max(g.s, 45), dark ? 55 : 45), dark ? 0.2 : 0.12);
  t['on-ground'] = readableOn(t.ground);
  t.leaf = dark ? '#6f8f5e' : '#4d6b3d';
  t.marble = dark ? '#d9d4c7' : '#f2efe7';
  t.danger = ensureContrast(dark ? '#f07167' : '#b42318', t.surface, 4.6);
  t['danger-soft'] = alpha('#e5484d', 0.14);
  t.success = ensureContrast(dark ? '#6fcf97' : '#1b7a43', t.surface, 4.6);
  t['success-soft'] = alpha('#30a46c', dark ? 0.16 : 0.12);
  t.shadow = dark ? alpha(hsl(g.h, gs, 2), 0.6) : alpha(hsl(g.h, gs * 0.6, 20), 0.12);
  t.focus = contrast(accent, t.bg) >= 3 ? accent : t['accent-ink'];
  return t;
}

export const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
