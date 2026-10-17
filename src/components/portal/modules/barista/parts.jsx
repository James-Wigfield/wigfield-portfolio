import { useId } from 'react';
import { fillAttr } from './geometry';

/* ============================================================================
   BARISTA · SVG PROPS — the small things scenes are built from
   ----------------------------------------------------------------------------
   Every prop is two groups: an outer <g> placed with `x`/`y`/`s`/`r` (a
   static transform attribute) and an inner <g className> that GSAP animates
   from local zero. That split keeps fromTo x/y tweens relative to the prop's
   resting place instead of overwriting it.
   ========================================================================== */

export function Place({ x = 0, y = 0, s = 1, r = 0, className, children, style }) {
  const t = `translate(${x} ${y})${r ? ` rotate(${r})` : ''}${s !== 1 ? ` scale(${s})` : ''}`;
  return (
    <g transform={t}>
      <g className={className} style={style}>
        {children}
      </g>
    </g>
  );
}

/** Mono number + optional text, for marking an action on the art. */
export function Mark({ x, y, n, text, anchor = 'start', className = '' }) {
  return (
    <g className={`bxi-mark ${className}`}>
      <text className="bxi-s-num" x={x} y={y} textAnchor={anchor}>
        {String(n).padStart(2, '0')}
        {text && <tspan className="bxi-s-label" dx="4">{text}</tspan>}
      </text>
    </g>
  );
}

export function Caption({ x, y, children, anchor = 'start', tone, small = false, className = '' }) {
  return (
    <text className={`bxi-s-label${tone ? ` bxi-s-label--${tone}` : ''}${small ? ' bxi-s-label--sm' : ''} ${className}`} x={x} y={y} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** Steel button chip inside the art. */
export function Chip({ x, y, text, className = '' }) {
  const w = text.length * 5 + 10;
  return (
    <g className={`bxi-s-chip ${className}`} transform={`translate(${x - w / 2} ${y - 6})`}>
      <rect width={w} height="12" rx="6" />
      <text x={w / 2} y="8.6" textAnchor="middle">{text}</text>
    </g>
  );
}

/** Jug (open top). The liquid is a clipped rect, `.bxi-p-fill` — tween its
    y/height with fillAttr(level) so levels never fight a transform. */
export function Jug({ x, y, s = 1, className, level = 0.5, liquid = 'water', label }) {
  const id = `bxj${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <Place x={x} y={y} s={s} className={className}>
      <clipPath id={id} clipPathUnits="userSpaceOnUse">
        <path d="M-16 0 L16 0 L13 40 L-13 40 Z" />
      </clipPath>
      <path className="bxi-s-glass" d="M-16 0 L16 0 L13 40 L-13 40 Z" />
      <g clipPath={`url(#${id})`}>
        <rect
          className={`bxi-p-fill ${liquid === 'water' ? 'bxi-s-water' : liquid === 'milk' ? 'bxi-s-milk' : 'bxi-s-coffee'}`}
          x="-17"
          width="34"
          {...fillAttr(level)}
        />
      </g>
      <path className="bxi-s-ink" d="M16 6 q9 2 8 12 q-1 8 -10 10" />
      <path className="bxi-s-ink" d="M-16 0 L16 0 L13 40 L-13 40 Z" />
      {label && <text className="bxi-s-label" x="0" y="52" textAnchor="middle">{label}</text>}
    </Place>
  );
}

/** Small cup (tip soak, filter soak). */
export function Cup({ x, y, s = 1, className, level = 0.7, children }) {
  const top = 24 - 22 * level;
  return (
    <Place x={x} y={y} s={s} className={className}>
      <path className="bxi-s-water" d={`M${-14 + top * 0.12} ${top} L${14 - top * 0.12} ${top} L11 24 L-11 24 Z`} />
      {children}
      <path className="bxi-s-ink" d="M-14 0 L14 0 L11 24 L-11 24 Z" />
      <path className="bxi-s-ink" d="M14 5 q7 1 6 8 q-1 5 -7 6" />
    </Place>
  );
}

/** Wide bowl (basket soak). */
export function Bowl({ x, y, s = 1, className, children, w = 120, water = true, waterClass = '' }) {
  const h = w * 0.32;
  return (
    <Place x={x} y={y} s={s} className={className}>
      {water && <path className={`bxi-s-water ${waterClass}`} d={`M${-w / 2 + 6} 6 L${w / 2 - 6} 6 Q${w / 2 - 12} ${h} 0 ${h} Q${-w / 2 + 12} ${h} ${-w / 2 + 6} 6 Z`} />}
      {children}
      <path className="bxi-s-ink" d={`M${-w / 2} 0 L${w / 2} 0 Q${w / 2 - 6} ${h + 4} 0 ${h + 4} Q${-w / 2 + 6} ${h + 4} ${-w / 2} 0 Z`} />
    </Place>
  );
}

/** Filter basket, side view (rim at y=0). */
export function Basket({ x, y, s = 1, className, holes = true }) {
  return (
    <Place x={x} y={y} s={s} className={className}>
      <path className="bxi-s-steel" d="M-22 0 L22 0 L18 16 L-18 16 Z" />
      <rect className="bxi-s-steel" x="-25" y="-2.5" width="50" height="4" rx="1.5" />
      {holes && <path className="bxi-s-thin" d="M-12 16.5 h24" strokeDasharray="1.2 2.2" />}
    </Place>
  );
}

/** Portafilter, side view: head at origin, handle to the right. */
export function Portafilter({ x, y, s = 1, className, children }) {
  return (
    <Place x={x} y={y} s={s} className={className}>
      <rect className="bxi-s-steel" x="-30" y="-4" width="60" height="7" rx="2" />
      <path className="bxi-s-steel" d="M-26 3 L26 3 L22 22 L-22 22 Z" />
      <rect className="bxi-s-steel" x="-9" y="22" width="6" height="8" rx="1.5" />
      <rect className="bxi-s-steel" x="3" y="22" width="6" height="8" rx="1.5" />
      <path className="bxi-s-steel2" d="M28 2 L44 8 L44 13 L28 12 Z" />
      <rect className="bxi-s-dark" x="42" y="5" width="56" height="11" rx="5.5" />
      {children}
    </Place>
  );
}

export function Disc({ x, y, s = 1, className }) {
  return (
    <Place x={x} y={y} s={s} className={className}>
      <rect className="bxi-s-dark" x="-20" y="-2.5" width="40" height="5" rx="2.5" />
      <rect className="bxi-s-dark" x="-6" y="-6" width="12" height="4" rx="1.5" />
    </Place>
  );
}

export function Tablet({ x, y, s = 1, className }) {
  return (
    <Place x={x} y={y} s={s} className={className}>
      <rect className="bxi-s-tablet" x="-7" y="-3" width="14" height="6" rx="2.5" />
    </Place>
  );
}

/** Cleaning brush: handle right, bristles at the left end. */
export function Brush({ x, y, s = 1, r = 0, className }) {
  return (
    <Place x={x} y={y} s={s} r={r} className={className}>
      <rect className="bxi-s-dark" x="8" y="-4" width="58" height="8" rx="4" />
      <rect className="bxi-s-steel2" x="-2" y="-2" width="12" height="4" rx="1" />
      <path className="bxi-s-ink" d="M-2 -5 L-12 -7 M-2 -2.5 L-13 -3 M-2 0 L-13 0 M-2 2.5 L-13 3 M-2 5 L-12 7" />
    </Place>
  );
}

/** Steam wand cleaning tool: pin at the left, spanner hole at the right. */
export function SteamTool({ x, y, s = 1, r = 0, className }) {
  return (
    <Place x={x} y={y} s={s} r={r} className={className}>
      <rect className="bxi-s-dark" x="0" y="-6" width="44" height="12" rx="6" />
      <circle className="bxi-s-face" cx="34" cy="0" r="3.4" />
      <path className="bxi-s-ink" d="M0 0 L-12 0" strokeWidth="1.6" />
    </Place>
  );
}

/** Allen key, L-shaped: short end pointing up from the origin. */
export function AllenKey({ x, y, s = 1, r = 0, className }) {
  return (
    <Place x={x} y={y} s={s} r={r} className={className}>
      <path className="bxi-s-steel2" d="M-2 -14 L2 -14 L2 2 L40 2 L40 6 L-2 6 Z" />
    </Place>
  );
}

export function Sachet({ x, y, s = 1, r = 0, className }) {
  return (
    <Place x={x} y={y} s={s} r={r} className={className}>
      <path className="bxi-s-face" d="M-14 -20 h28 v40 h-28 Z" />
      <path className="bxi-s-thin" d="M-14 -15 h28 M-9 -4 h18 M-9 2 h12" />
    </Place>
  );
}

export function Razor({ x, y, s = 1, r = 0, className }) {
  return (
    <Place x={x} y={y} s={s} r={r} className={className}>
      <rect className="bxi-s-steel" x="-22" y="-5" width="44" height="10" rx="2" />
      <path className="bxi-s-steel2" d="M-14 5 L14 5 L12 12 L-12 12 Z" />
    </Place>
  );
}

/** Water filter cartridge on its holder, with the month date dial on top. */
export function FilterCart({ x, y, s = 1, className, dialClass, month = 0 }) {
  const letters = 'JFMAMJJASOND';
  return (
    <Place x={x} y={y} s={s} className={className}>
      <rect className="bxi-s-dark" x="-12" y="0" width="24" height="46" rx="4" />
      <path className="bxi-s-thin" d="M-8 10 h16 M-8 16 h16 M-8 22 h16" stroke="var(--surface)" />
      <rect className="bxi-s-steel" x="-5" y="46" width="10" height="12" rx="2" />
      <g transform="translate(0 -12)">
        <circle className="bxi-s-face" r="12" />
        <g className={dialClass} transform={`rotate(${-month * 30})`}>
          {[...letters].map((l, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <text key={i} className="bxi-p-month" x={Math.cos(a) * 8.6} y={Math.sin(a) * 8.6 + 2} textAnchor="middle">
                {l}
              </text>
            );
          })}
        </g>
        <path className="bxi-s-accent" d="M-3 -16 L3 -16 L0 -12 Z" />
      </g>
    </Place>
  );
}

/** Compressed clock face; the hand is `.bxi-p-hand` (rotate from 0). */
export function Clock({ x, y, r = 16, className, handClass = 'bxi-p-hand', label }) {
  return (
    <Place x={x} y={y} className={className}>
      <circle className="bxi-s-face" r={r} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <line key={i} className="bxi-s-thin" x1={Math.sin(a) * (r - 3)} y1={-Math.cos(a) * (r - 3)} x2={Math.sin(a) * (r - 1)} y2={-Math.cos(a) * (r - 1)} />;
      })}
      <g className={handClass}>
        <path className="bxi-s-accentline" d={`M0 0 L0 ${-(r - 4)}`} />
      </g>
      <circle className="bxi-s-dark" r="1.8" />
      {label && <text className="bxi-s-label bxi-s-label--strong" x="0" y={r + 11} textAnchor="middle">{label}</text>}
    </Place>
  );
}

/** A fingertip dot that lands on a button. */
export function Finger({ x, y, className, hidden = true }) {
  return (
    <Place x={x} y={y} className={className} style={hidden ? { opacity: 0 } : undefined}>
      <circle className="bxi-s-finger" r="7" />
    </Place>
  );
}

/** Rising bubbles (live-looping in follow-along). */
export function Bubbles({ x, y, className = '', spread = 10 }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      {[-1, 0, 1].map((k) => (
        <circle key={k} className="bxi-live-rise bxi-p-bubble" cx={k * spread * 0.6} cy={-k * 3} r={1.6 + Math.abs(k) * 0.4} />
      ))}
    </g>
  );
}

/** Steam wisps. */
export function Steam({ x, y, className = '', s = 1 }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="bxi-s-steam bxi-live-pulse" d="M-6 0 q-5 -7 0 -14 q5 -7 0 -14" />
      <path className="bxi-s-steam bxi-live-pulse" d="M5 2 q-5 -7 0 -14 q5 -7 0 -14" />
    </g>
  );
}

/** Flowing stream (dashed, animates in live mode). */
export function Flow({ d, className = '', hidden = false }) {
  return <path className={`bxi-s-waterline bxi-live-flow ${className}`} d={d} style={hidden ? { opacity: 0 } : undefined} />;
}

/** Curved rotation arrow around (0,0); `ccw` flips direction. */
export function TurnArrow({ x, y, r = 12, ccw = false, className = '' }) {
  const a0 = ccw ? 40 : -40;
  const a1 = ccw ? -220 : 220;
  const pt = (a) => [Math.cos(((a - 90) * Math.PI) / 180) * r, Math.sin(((a - 90) * Math.PI) / 180) * r];
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const sweep = ccw ? 0 : 1;
  const head = ccw
    ? `M${x1} ${y1} l-1 5.5 M${x1} ${y1} l5 2`
    : `M${x1} ${y1} l1 5.5 M${x1} ${y1} l-5 2`;
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <path className="bxi-s-accentline" d={`M${x0} ${y0} A${r} ${r} 0 1 ${sweep} ${x1} ${y1}`} />
      <path className="bxi-s-accentline" d={head} />
    </g>
  );
}

/** Cross marker ("nothing here"). */
export function Nope({ x, y, className = '' }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <path className="bxi-s-hotline" d="M-4 -4 L4 4 M4 -4 L-4 4" />
    </g>
  );
}

export function Tick({ x, y, className = '', s = 1 }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="bxi-s-accentline" d="M-5 0 L-1.5 3.5 L5 -3.5" strokeWidth="2.4" />
    </g>
  );
}

/** Wall plug + socket, for "unplug". */
export function Plug({ x, y, className, socketClass }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={socketClass}>
        <rect className="bxi-s-face" x="0" y="-12" width="22" height="24" rx="3" />
        <circle className="bxi-s-dark" cx="8" cy="-3" r="1.4" />
        <circle className="bxi-s-dark" cx="14" cy="-3" r="1.4" />
      </g>
      <g className={className}>
        <path className="bxi-s-ink" d="M-40 6 Q-20 6 -10 0" />
        <rect className="bxi-s-dark" x="-12" y="-6" width="12" height="12" rx="2" />
        <path className="bxi-s-ink" d="M0 -3 h4 M0 3 h4" />
      </g>
    </g>
  );
}

/** The hollow "tip" dot, in the art (matches the UI's tip mark). */
export function TipDot({ x, y }) {
  return <circle cx={x} cy={y - 3} r="3" fill="none" stroke="var(--accent)" strokeWidth="1.4" />;
}
