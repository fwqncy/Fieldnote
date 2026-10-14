export type HSL = { h: number; s: number; l: number };

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

export function hexToHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: HSL): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export const hsl = (h: number, s: number, l: number) => hslToHex({ h, s, l });

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Nudge `fg` lighter or darker until it reaches `ratio` against `bg`. */
export function ensureContrast(fg: string, bg: string, ratio: number): string {
  const c = hexToHsl(fg);
  const lighten = luminance(bg) < 0.4;
  for (let i = 0; i < 60 && contrast(hslToHex(c), bg) < ratio; i++) {
    c.l = Math.min(100, Math.max(0, c.l + (lighten ? 1.5 : -1.5)));
    if (lighten && c.l > 80) c.s = Math.max(0, c.s - 1);
  }
  return hslToHex(c);
}

export const readableOn = (bg: string) => (contrast('#0b0d12', bg) >= contrast('#ffffff', bg) ? '#0b0d12' : '#ffffff');

export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const isHex = (s: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
export const normalizeHex = (s: string) => {
  const h = s.trim().replace('#', '');
  return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h).toLowerCase();
};
