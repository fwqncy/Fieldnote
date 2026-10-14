import { useEffect, useRef, useState } from 'react';
import { hexToHsl, hslToHex, type HSL } from '../theme/color';

/**
 * Hue/saturation wheel with a lightness slider. Drag, click, or use arrow
 * keys (←/→ hue, ↑/↓ saturation, Shift for bigger steps).
 */
export function ColorWheel({ value, onChange, size = 220, label }: { value: string; onChange: (hex: string) => void; size?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hsl, setHsl] = useState<HSL>(() => hexToHsl(value));
  const dragging = useRef(false);

  // Follow external changes (hex input, presets) without fighting the drag.
  useEffect(() => {
    if (!dragging.current && hslToHex(hsl) !== value.toLowerCase()) setHsl(hexToHsl(value));
  }, [value]);

  const lightness = Math.round(hsl.l);
  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(devicePixelRatio, 2);
    const px = Math.round(size * dpr);
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    const img = g.createImageData(px, px);
    const r = px / 2;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x - r;
        const dy = y - r;
        const d = Math.sqrt(dx * dx + dy * dy);
        const i = (y * px + x) * 4;
        if (d > r) continue;
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const hex = hslToHex({ h, s: (d / r) * 100, l: Math.min(Math.max(lightness, 18), 82) });
        const n = parseInt(hex.slice(1), 16);
        img.data[i] = (n >> 16) & 255;
        img.data[i + 1] = (n >> 8) & 255;
        img.data[i + 2] = n & 255;
        img.data[i + 3] = d > r - 1 ? Math.round((r - d) * 255) : 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, [size, lightness]);

  const emit = (next: HSL) => {
    setHsl(next);
    onChange(hslToHex(next));
  };

  const fromPointer = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = Math.min(100, (Math.hypot(dx, dy) / (rect.width / 2)) * 100);
    emit({ h, s, l: hsl.l });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const next = { ...hsl };
    if (e.key === 'ArrowLeft') next.h = (hsl.h - step + 360) % 360;
    else if (e.key === 'ArrowRight') next.h = (hsl.h + step) % 360;
    else if (e.key === 'ArrowUp') next.s = Math.min(100, hsl.s + step);
    else if (e.key === 'ArrowDown') next.s = Math.max(0, hsl.s - step);
    else return;
    e.preventDefault();
    emit(next);
  };

  const angle = (hsl.h * Math.PI) / 180;
  const rad = (hsl.s / 100) * (size / 2);
  const hex = hslToHex(hsl);

  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: hue and saturation`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsl.h)}
        aria-valuetext={`Hue ${Math.round(hsl.h)} degrees, saturation ${Math.round(hsl.s)} percent, ${hex}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        style={{ position: 'relative', width: size, height: size, borderRadius: '50%', cursor: 'crosshair', touchAction: 'none', boxShadow: '0 0 0 1px var(--border), 0 18px 40px -18px var(--shadow)' }}
      >
        <canvas ref={canvas} style={{ width: size, height: size, borderRadius: '50%', display: 'block' }} aria-hidden />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: size / 2 + Math.cos(angle) * rad - 11,
            top: size / 2 + Math.sin(angle) * rad - 11,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: hex,
            border: '3px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.4)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <label style={{ display: 'grid', gap: 6, width: size, font: '500 12.5px/1 var(--font-ui)', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Lightness</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{lightness}%</span>
        </span>
        <input
          type="range"
          min={5}
          max={95}
          value={lightness}
          onChange={(e) => emit({ ...hsl, l: Number(e.target.value) })}
          style={{ background: `linear-gradient(90deg, ${hslToHex({ ...hsl, l: 8 })}, ${hslToHex({ ...hsl, l: 50 })}, ${hslToHex({ ...hsl, l: 92 })})`, borderRadius: 99, height: 10, appearance: 'none', WebkitAppearance: 'none' }}
        />
      </label>
    </div>
  );
}
