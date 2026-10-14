// The minimised hero: an Ionic column laid on its side across the top of the
// page. Capital on the left, fluted shaft, base on the right.

import { forwardRef, useId } from 'react';
import { Icon } from './Icon';

/** Total height of the minimised bar; Home folds the hero down to this. */
export const PILLAR_HEIGHT = 84;
const PART = 64; // capital & base height
const SHAFT = 40; // shaft height, matches the necking
const INK = 'rgba(40, 32, 20, .45)';

export const Pillar = forwardRef<HTMLButtonElement, { onExpand: () => void; caption: string }>(function Pillar({ onExpand, caption }, ref) {
  return (
    <div className="fn-pillar" style={{ display: 'flex', alignItems: 'center', height: PILLAR_HEIGHT, padding: '0 16px', filter: 'drop-shadow(0 8px 14px var(--shadow))' }}>
      <Capital />
      <div
        className="fn-pillar-shaft"
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: SHAFT,
          boxSizing: 'border-box',
          borderTop: `1px solid ${INK}`,
          borderBottom: `1px solid ${INK}`,
          background: [
            // Flutes run along the shaft now that it lies sideways.
            'repeating-linear-gradient(180deg, rgba(0,0,0,0) 0 4px, rgba(40,32,20,.2) 4px 5px, rgba(255,255,255,.4) 5px 6px, rgba(0,0,0,0) 6px 7px)',
            // Round the shaft: lit from above, shadowed below.
            'linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0) 55%, rgba(40,32,20,.42) 100%)',
            'var(--marble)',
          ].join(','),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '0 12px',
        }}
      >
        <span
          className="fn-pillar-caption"
          style={{
            display: 'inline-block',
            font: '800 22px/1 var(--font-display)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            // Carved: dark letters with a light lower lip.
            color: 'rgba(40, 32, 20, .62)',
            textShadow: '0 1px 0 rgba(255,255,255,.6)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {caption}
        </span>
        <button
          ref={ref}
          type="button"
          onClick={onExpand}
          aria-label="Expand the header"
          aria-expanded={false}
          className="fn-pillar-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            minHeight: 28,
            padding: '0 12px',
            borderRadius: 999,
            border: '1px solid rgba(40,32,20,.25)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            font: '500 12.5px/1 var(--font-ui)',
            cursor: 'pointer',
            boxShadow: '0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px rgba(0,0,0,.25)',
          }}
        >
          <Icon name="chevronDown" size={14} color="currentColor" />
          Expand
        </button>
      </div>
      <Base />
    </div>
  );
});

/** Vertical light-to-shadow overlay, so every moulding reads as rounded stone. */
function Shade({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".6" />
        <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        <stop offset=".6" stopColor="#281f14" stopOpacity="0" />
        <stop offset="1" stopColor="#281f14" stopOpacity=".42" />
      </linearGradient>
    </defs>
  );
}

/** A marble block: base fill, shading, and an outline. */
function Block({ x, y, w, h, rx = 0, shade, fill = 'var(--marble)' }: { x: number; y: number; w: number; h: number; rx?: number; shade: string; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${shade})`} stroke={INK} strokeWidth="1" />
    </g>
  );
}

/** Ionic capital on its side: abacus, volutes top & bottom, egg-and-dart echinus, necking, gilded astragal. */
function Capital() {
  const shade = `fn-shade-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden className="fn-pillar-cap" width="80" height={PART} viewBox={`0 0 80 ${PART}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <Shade id={shade} />
      <Block x={0.5} y={0.5} w={11} h={63} rx={2} shade={shade} />
      {/* canalis: the band the volutes scroll out of */}
      <Block x={11.5} y={5} w={12} h={54} shade={shade} />
      {/* echinus sits between the scrolls; eggs stay clear of their edges */}
      <Block x={36} y={13} w={18} h={38} rx={8} shade={shade} />
      {[22, 32, 42].map((cy) => (
        <g key={cy}>
          <ellipse cx="47" cy={cy} rx="3.2" ry="3.9" fill="none" stroke={INK} strokeWidth=".9" />
          {cy < 42 && <path d={`M44 ${cy + 5} H50`} stroke={INK} strokeWidth=".8" />}
        </g>
      ))}
      {[15, 49].map((cy) => (
        <g key={cy}>
          <circle cx="26" cy={cy} r="14" fill="var(--marble)" />
          <circle cx="26" cy={cy} r="14" fill={`url(#${shade})`} stroke={INK} strokeWidth="1.1" />
          <path d={spiral(26, cy, 12, 3, cy > 32)} fill="none" stroke="rgba(40,32,20,.6)" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="26" cy={cy} r="2.2" fill="var(--accent)" />
        </g>
      ))}
      {/* necking, then the gilded astragal the shaft meets */}
      <Block x={54} y={(PART - SHAFT) / 2} w={20} h={SHAFT} shade={shade} />
      <Block x={74} y={(PART - SHAFT) / 2 - 3} w={6} h={SHAFT + 6} rx={3} shade={shade} fill="var(--accent)" />
    </svg>
  );
}

/** Attic base on its side: gilded fillet, upper torus, scotia, lower torus, plinth. */
function Base() {
  const shade = `fn-shade-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden className="fn-pillar-base" width="70" height={PART} viewBox={`0 0 70 ${PART}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <Shade id={shade} />
      <Block x={0} y={(PART - SHAFT) / 2 - 3} w={6} h={SHAFT + 6} rx={3} shade={shade} fill="var(--accent)" />
      <Block x={6} y={7} w={12} h={50} rx={6} shade={shade} />
      {/* scotia: the deep hollow between the tori */}
      <Block x={18} y={12} w={7} h={40} shade={shade} />
      <rect x={18} y={12} width={7} height={40} fill="#281f14" opacity=".16" />
      <Block x={25} y={3.5} w={14} h={57} rx={7} shade={shade} />
      <Block x={39} y={0.5} w={30} h={63} rx={2} shade={shade} />
    </svg>
  );
}

function spiral(cx: number, cy: number, r: number, turns: number, mirror = false) {
  const pts: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (mirror ? -1 : 1) * t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.88);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(' L')}`;
}

// ── upright column frame ─────────────────────────────────────────────────────

/** Wraps content in an upright Ionic column: capital, fluted shaft, Attic base. */
export function ColumnFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  const flutes = (side: 'left' | 'right') => (
    <div
      aria-hidden
      style={{
        width: 18,
        flexShrink: 0,
        background: [
          'repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 3px, rgba(40,32,20,.28) 3px 4px, rgba(255,255,255,.35) 4px 5px, rgba(0,0,0,0) 5px 6px)',
          // Light falls from the left, so the right flank sits in shadow.
          side === 'left' ? 'linear-gradient(90deg, rgba(255,255,255,.3), rgba(0,0,0,.06))' : 'linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.34))',
          'var(--marble)',
        ].join(','),
      }}
    />
  );

  return (
    <figure aria-label={label} style={{ margin: 0, width: '100%', maxWidth: 400, filter: 'drop-shadow(0 30px 40px var(--shadow))' }}>
      <IonicCapital />
      <div style={{ display: 'flex', margin: '0 9%' }}>
        {flutes('left')}
        <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-elev)', boxShadow: 'inset 0 10px 18px -12px rgba(0,0,0,.6), inset 0 -10px 18px -12px rgba(0,0,0,.6)', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 440 }}>
          {children}
        </div>
        {flutes('right')}
      </div>
      <AtticBase />
    </figure>
  );
}

function IonicCapital() {
  // Eggs run only between the volutes so none is cut by a scroll.
  const eggs = Array.from({ length: 11 }, (_, i) => 86 + i * 22.8);
  return (
    <svg aria-hidden viewBox="0 0 400 92" width="100%" style={{ display: 'block' }}>
      {/* abacus */}
      <rect x="6" y="0" width="388" height="14" rx="2" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      <rect x="6" y="11" width="388" height="3" fill="rgba(40,32,20,.18)" />
      {/* volute band joining the scrolls */}
      <path d="M44 14 H356 V30 Q200 40 44 30 Z" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      {/* echinus with egg-and-dart */}
      <path d="M50 32 Q200 44 350 32 L336 62 Q200 70 64 62 Z" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      {eggs.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="48" rx="7" ry="9" fill="none" stroke={INK} strokeWidth="1" />
          {x < 310 && <path d={`M${x + 11.4} 41 V57`} stroke={INK} strokeWidth="1" />}
        </g>
      ))}
      {/* volutes */}
      {[40, 360].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="40" r="26" fill="var(--marble)" stroke={INK} strokeWidth="1.2" />
          <path d={spiral(cx, 40, 23, 3.1, cx > 200)} fill="none" stroke="rgba(40,32,20,.6)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx={cx} cy="40" r="3.4" fill="var(--accent)" />
        </g>
      ))}
      {/* necking & gilded astragal */}
      <rect x="36" y="70" width="328" height="12" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      <rect x="34" y="82" width="332" height="6" rx="3" fill="var(--accent)" />
      <rect x="36" y="88" width="328" height="4" fill="var(--marble)" />
    </svg>
  );
}

function AtticBase() {
  return (
    <svg aria-hidden viewBox="0 0 400 58" width="100%" style={{ display: 'block' }}>
      <rect x="34" y="0" width="332" height="5" rx="2.5" fill="var(--accent)" />
      <rect x="28" y="5" width="344" height="13" rx="6.5" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      <rect x="36" y="18" width="328" height="8" fill="var(--marble)" opacity=".8" stroke={INK} strokeWidth=".8" />
      <rect x="18" y="26" width="364" height="15" rx="7.5" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      <rect x="6" y="41" width="388" height="17" rx="2" fill="var(--marble)" stroke={INK} strokeWidth="1" />
      <rect x="6" y="54" width="388" height="4" fill="rgba(40,32,20,.18)" />
    </svg>
  );
}
