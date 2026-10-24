import { createContext, useContext } from 'react';

/* ============================================================================
   LECTURES 1–2 REFRESHER — LINE-ART DIAGRAMS (the notebook pages)
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per figure worth drawing by hand: boxes,
   circles, arrows and short labels in currentColor, no fills or shading, so
   each can be copied onto paper in a minute. <Diagram fig="…" /> picks one.
   (Figures are listed in FIGS below.)

   Highlighting: <Diagram fig="…" hl={['…']} sheet /> draws the named parts
   (<P k="…">) in the notebook's green pen. The part keys per figure are
   listed in ./sheets/figParts.js (page-check.mjs compares both sides).
   ========================================================================== */

const SW = 1.4;
const HlCtx = createContext(null);
const NO_HL = [];

function P({ k, children }) {
  const hl = useContext(HlCtx);
  if (!hl) return children;
  return <g className={hl.includes(k) ? 'dl12r-fig__hl' : undefined} data-part={k}>{children}</g>;
}

function Arrow({ x1, y1, x2, y2, dashed = false, head = 5 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

// an arrowhead at the end of a path that arrives heading `dir` (radians)
function Head({ x, y, dir, size = 5 }) {
  const p = (d) => `${x - size * Math.cos(dir + d)},${y - size * Math.sin(dir + d)}`;
  return <polyline points={`${p(0.45)} ${x},${y} ${p(-0.45)}`} />;
}

function T({ x, y, children, a = 'middle', s = 10.5, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl12r-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h = 20, label, s = 10, r = 4 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} />
      {label && <T x={x + w / 2} y={y + h / 2 + 3.6} s={s}>{label}</T>}
    </g>
  );
}

// `wide`: a long left-to-right figure; on a narrow notebook page it keeps a
// readable size and scrolls sideways instead of shrinking
function Svg({ w, h, label, wide = false, children }) {
  const hl = useContext(HlCtx);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dl12r-fig${hl ? ' dl12r-fig--hl' : ''}`} data-wide={wide ? '' : undefined} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const FIGS = {};

export function Diagram({ fig, sheet = false, lab = false, hl = NO_HL }) {
  const Fig = FIGS[fig];
  if (!Fig) return null;
  if (!sheet && !lab) return <Fig />;
  return (
    <span className={lab ? 'dl12r-figwrap dl12r-figwrap--lab' : 'dl12r-figwrap dl12r-figwrap--sheet'}>
      <HlCtx.Provider value={hl}>
        <Fig />
      </HlCtx.Provider>
    </span>
  );
}
