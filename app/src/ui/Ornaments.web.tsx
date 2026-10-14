// Decorative SVG drawn from theme tokens. All aria-hidden: pure ornament.
import { useId, type CSSProperties } from 'react';

/** Greek key (meander) band, as on temple friezes. */
export function Meander({ height = 14, color = 'var(--accent-line)', style, className }: { height?: number; color?: string; style?: CSSProperties; className?: string }) {
  const id = useId().replace(/:/g, '');
  const s = height / 14;
  return (
    <svg aria-hidden width="100%" height={height} style={{ display: 'block', ...style }} className={className}>
      <defs>
        <pattern id={id} width={14 * s} height={height} patternUnits="userSpaceOnUse">
          <path
            d={`M0 ${13 * s} H${14 * s} M${1 * s} ${13 * s} V${1 * s} H${12 * s} V${10 * s} H${4 * s} V${4 * s} H${9 * s} V${7 * s}`}
            fill="none"
            stroke={color}
            strokeWidth={1.25}
            strokeLinecap="square"
          />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
}

/** A laurel branch; `count` leaf pairs grow along a gentle curve. */
export function Laurel({ count = 7, width = 120, color = 'var(--leaf)', flip, style, className, filled }: { count?: number; width?: number; color?: string; flip?: boolean; style?: CSSProperties; className?: string; filled?: number }) {
  const h = width * 0.42;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.6) / (count + 0.4);
    const x = 6 + t * (width - 14);
    const y = h * 0.78 - Math.sin(t * Math.PI * 0.85) * h * 0.42;
    const angle = -20 - t * 25;
    const lit = filled === undefined || i < filled;
    const fill = lit ? color : 'transparent';
    leaves.push(
      <g key={i} className="fn-leaf" style={{ transformOrigin: `${x}px ${y}px` }}>
        <path d={leaf(x, y, angle - 38, 9 + t * 4)} fill={fill} stroke={color} strokeWidth={lit ? 0 : 1} />
        <path d={leaf(x, y, angle + 52, 8 + t * 4)} fill={fill} stroke={color} strokeWidth={lit ? 0 : 1} opacity={0.85} />
      </g>,
    );
  }
  return (
    <svg aria-hidden width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible', ...style }} className={className}>
      <path d={`M4 ${h * 0.86} Q ${width * 0.45} ${h * 0.55} ${width - 6} ${h * 0.12}`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      {leaves}
    </svg>
  );
}

function leaf(x: number, y: number, deg: number, len: number) {
  const r = (deg * Math.PI) / 180;
  const tip = [x + Math.cos(r) * len, y + Math.sin(r) * len];
  const n = [-Math.sin(r) * len * 0.28, Math.cos(r) * len * 0.28];
  const m = [x + Math.cos(r) * len * 0.5, y + Math.sin(r) * len * 0.5];
  return `M${x} ${y} Q${m[0] + n[0]} ${m[1] + n[1]} ${tip[0]} ${tip[1]} Q${m[0] - n[0]} ${m[1] - n[1]} ${x} ${y}Z`;
}

/** Apollo's sun crown: the Fieldnote mark. */
export function SunMark({ size = 28, color = 'var(--accent)', style, className }: { size?: number; color?: string; style?: CSSProperties; className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const a1 = a - 0.13;
    const a2 = a + 0.13;
    const p = (ang: number, rad: number) => `${16 + Math.cos(ang) * rad} ${16 + Math.sin(ang) * rad}`;
    return <path key={i} d={`M${p(a1, 8.5)} L${p(a, i % 2 ? 13.5 : 15.5)} L${p(a2, 8.5)}Z`} fill={color} />;
  });
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" style={style} className={className}>
      <g className="fn-sun-rays" style={{ transformOrigin: '16px 16px' }}>
        {rays}
      </g>
      <circle cx="16" cy="16" r="7.2" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M13.2 20.4 V11.8 H19 M13.2 15.9 H17.6" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="square" />
    </svg>
  );
}

/** The stepped checker strip from the Apollo poster. */
export function Checker({ cells = 12, size = 10, color = 'var(--accent)', style }: { cells?: number; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden width={cells * size} height={size * 2} style={{ display: 'block', ...style }}>
      {Array.from({ length: cells }, (_, i) => (
        <rect key={i} x={i * size} y={i % 2 ? 0 : size} width={size} height={size} fill={color} />
      ))}
    </svg>
  );
}
