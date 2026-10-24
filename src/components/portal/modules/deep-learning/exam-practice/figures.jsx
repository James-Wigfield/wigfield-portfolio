import { useId } from 'react';

/* ============================================================================
   EXAM PRACTICE — FIGURES (inline SVG, referenced by key from the papers)
   ----------------------------------------------------------------------------
   Two kinds, one file:
     printed   part of a question, drawn like the PDF's line art: black,
               crisp, a serif for maths labels (the sample's star sketches
               and gated module are rebuilt here, never embedded as renders)
     pen       part of a model answer, drawn like a tutor's sketch: blue-black
               ink, a subtle wobble (an feTurbulence displacement), Patrick
               Hand labels, red only where a marker would use it
   <Figure name="…" /> picks one. Every figure has a role="img" label; the
   model answer also prints its one-line description (papers' fig(key, desc)).
   Colours are fixed: the paper is paper in every portal theme.
   ========================================================================== */

const INK = '#1f2a44';
const BLUE = '#1f3f99';
const RED = '#b8281f';
const GREY = '#5d6470';
const SERIF = 'KaTeX_Main, "Times New Roman", Times, serif';
const HAND = '"Patrick Hand", "Comic Sans MS", cursive';
const SANS = '"DejaVu Sans", Verdana, Arial, sans-serif';

/* ── shared pieces ───────────────────────────────────────────────────────── */

// A printed figure: black line art at the paper's scale.
function Printed({ viewBox, label, width, children }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="dlxp-fig dlxp-fig--printed" viewBox={viewBox} style={{ maxWidth: width }} role="img" aria-label={label}>
      <defs>
        <marker id={`${id}a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 L3 5 z" fill="#111" />
        </marker>
      </defs>
      {children(`url(#${id}a)`)}
    </svg>
  );
}

// A pen figure: ink, wobble, arrowheads in the pen's colour.
function Pen({ viewBox, label, width, children }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="dlxp-fig dlxp-fig--pen" viewBox={viewBox} style={{ maxWidth: width }} role="img" aria-label={label}>
      <defs>
        <filter id={`${id}w`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" />
        </filter>
        <marker id={`${id}a`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1.2 L9 5 L1 8.8" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id={`${id}r`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1.2 L9 5 L1 8.8" fill="none" stroke={RED} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      <g filter={`url(#${id}w)`} fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children({ arrow: `url(#${id}a)`, redArrow: `url(#${id}r)` })}
      </g>
    </svg>
  );
}

// a hand-drawn box: slightly uneven corners, label centred in Patrick Hand
function PBox({ x, y, w: bw, h: bh, label, sub, color = INK, size = 15 }) {
  const r = 5;
  const d = `M${x + r} ${y + 0.6} L${x + bw - r} ${y - 0.4} Q${x + bw} ${y} ${x + bw + 0.3} ${y + r}
    L${x + bw - 0.3} ${y + bh - r} Q${x + bw} ${y + bh} ${x + bw - r} ${y + bh + 0.3}
    L${x + r} ${y + bh - 0.2} Q${x} ${y + bh} ${x + 0.4} ${y + bh - r} L${x - 0.3} ${y + r} Q${x} ${y} ${x + r} ${y + 0.6} z`;
  return (
    <g>
      <path d={d} stroke={color} />
      <text x={x + bw / 2} y={y + bh / 2 + (sub ? -2 : 5)} textAnchor="middle" fontFamily={HAND} fontSize={size} fill={color} stroke="none">{label}</text>
      {sub && <text x={x + bw / 2} y={y + bh / 2 + 14} textAnchor="middle" fontFamily={HAND} fontSize={size - 3} fill={GREY} stroke="none">{sub}</text>}
    </g>
  );
}

function PText({ x, y, children, color = INK, size = 14, anchor = 'start', font = HAND }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={font} fontSize={size} fill={color} stroke="none">{children}</text>;
}

// bold vector with a (t) subscript, as the sample typesets x(t), g(t)…
function Vec({ x, y, v, sub = '(t)', size = 15, anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fill="#111">
      <tspan fontWeight="bold">{v}</tspan>
      <tspan fontSize={size * 0.7} dy={size * 0.25}>{sub}</tspan>
    </text>
  );
}

/* ── printed: the sample paper's figures ─────────────────────────────────── */

// Sample Q2(a): two hand-sketched stars, corners 0–4 joined in order; corner
// 4 (the one to predict) in red. Left anticlockwise, right clockwise. Corner
// positions are read off the PDF's page 6 (110 dpi), less an offset.
const STAR_L = [[140, 75], [22, 66], [117, 157], [86, 15], [33, 152]];
const STAR_R = [[266, 15], [337, 132], [217, 80], [316, 41], [260, 160]];

function Star({ pts }) {
  return (
    <g>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#111" strokeWidth="1.4" strokeLinejoin="miter" />
      {pts.map(([x, y], i) => {
        const red = i === 4;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={red ? 2.3 : 1.8} fill={red ? '#e3201b' : '#111'} />
            <text x={x + 2} y={y - 3} fontFamily={SANS} fontSize="8.5" fill={red ? '#e3201b' : '#111'}>{i}</text>
          </g>
        );
      })}
    </g>
  );
}

function Stars() {
  return (
    <Printed viewBox="0 0 360 172" width="400px" label="Two hand-sketched five-pointed stars with corners numbered 0 to 4 joined in order. Left star anticlockwise, right star clockwise; corner 4 of each is marked in red.">
      {() => (
        <>
          <Star pts={STAR_L} />
          <Star pts={STAR_R} />
        </>
      )}
    </Printed>
  );
}

// Sample Q1(e): x(t) splits into two FC blocks (logistic bar, ReLU bar) whose
// outputs g(t), h(t) meet at an element-wise product giving z(t); legend right.
function Gate() {
  return (
    <Printed viewBox="0 0 450 200" width="470px" label="A module: x(t) enters a rounded box and feeds two FC blocks; the left FC has a light-grey (logistic) bar and outputs g(t), the right FC has a dark-grey (ReLU) bar and outputs h(t); g(t) and h(t) meet at an element-wise multiplication node whose output is z(t). Legend: light grey = logistic, dark grey = ReLU, circled times = element-wise multiplication.">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          <rect x="22" y="38" width="160" height="124" rx="7" strokeWidth="1.4" />
          {/* FC blocks with activation bars */}
          <rect x="44" y="90" width="52" height="15" fill="#c8c8c8" />
          <rect x="44" y="105" width="52" height="29" fill="#fff" />
          <rect x="108" y="90" width="52" height="15" fill="#4a4a4a" />
          <rect x="108" y="105" width="52" height="29" fill="#fff" />
          <text x="70" y="125" textAnchor="middle" fontFamily={SERIF} fontWeight="bold" fontSize="14" fill="#111" stroke="none">FC</text>
          <text x="134" y="125" textAnchor="middle" fontFamily={SERIF} fontWeight="bold" fontSize="14" fill="#111" stroke="none">FC</text>
          {/* x(t) in, split */}
          <line x1="102" y1="190" x2="102" y2="152" />
          <line x1="102" y1="152" x2="72" y2="135" markerEnd={arrow} />
          <line x1="102" y1="152" x2="132" y2="135" markerEnd={arrow} />
          {/* up to the product */}
          <line x1="70" y1="90" x2="94" y2="64" markerEnd={arrow} />
          <line x1="134" y1="90" x2="110" y2="64" markerEnd={arrow} />
          <circle cx="102" cy="56" r="9" fill="#fff" />
          <path d="M96 50 L108 62 M108 50 L96 62" />
          <line x1="102" y1="47" x2="102" y2="16" markerEnd={arrow} />
          <g stroke="none">
            <Vec x={102} y={11} v="z" />
            <Vec x={58} y={80} v="g" />
            <Vec x={146} y={80} v="h" />
            <Vec x={82} y={176} v="x" />
          </g>
          {/* legend */}
          <text x="196" y="122" fontFamily={SERIF} fontSize="13" fill="#111" stroke="none">Legend:</text>
          <rect x="203" y="129" width="36" height="12" fill="#c8c8c8" />
          <text x="246" y="139" fontFamily={SERIF} fontSize="13" fill="#111" stroke="none">logistic</text>
          <rect x="203" y="147" width="36" height="12" fill="#4a4a4a" />
          <text x="246" y="157" fontFamily={SERIF} fontSize="13" fill="#111" stroke="none">ReLU</text>
          <circle cx="221" cy="171" r="6" />
          <path d="M217 167 L225 175 M225 167 L217 175" />
          <text x="246" y="176" fontFamily={SERIF} fontSize="13" fill="#111" stroke="none">element-wise multiplication</text>
        </g>
      )}
    </Printed>
  );
}

/* ── pen: model-answer sketches ──────────────────────────────────────────── */

// Sample Q1(c): the Wide & Deep topology of L1 slide 43, one hidden layer.
function SWideDeep() {
  return (
    <Pen viewBox="0 0 330 330" width="330px" label="Hand-drawn Wide and Deep network: Input (10) to Normalization (10); deep path Normalization to Dense 20 GELU to Concat; wide path Normalization straight to Concat (30); Concat to Dense 3 softmax to Output.">
      {({ arrow }) => (
        <>
          <PBox x={95} y={290} w={130} h={30} label="Input  [10]" />
          <PBox x={95} y={230} w={130} h={32} label="Normalization" sub="" />
          <PText x={232} y={251} size={13} color={GREY}>10</PText>
          <PBox x={95} y={165} w={130} h={34} label="Dense 20, GELU" />
          <PBox x={95} y={100} w={130} h={32} label="Concat" />
          <PText x={232} y={121} size={13} color={GREY}>10 + 20 = 30</PText>
          <PBox x={95} y={36} w={130} h={34} label="Dense 3, softmax" />
          <line x1="160" y1="290" x2="160" y2="264" markerEnd={arrow} />
          <line x1="160" y1="230" x2="160" y2="201" markerEnd={arrow} />
          <line x1="160" y1="165" x2="160" y2="134" markerEnd={arrow} />
          <line x1="160" y1="100" x2="160" y2="72" markerEnd={arrow} />
          <line x1="160" y1="36" x2="160" y2="10" markerEnd={arrow} />
          <PText x={168} y={16} size={14}>output (3 probs)</PText>
          {/* wide path: skips the hidden layer */}
          <path d="M95 246 L62 246 L62 116 L93 116" markerEnd={arrow} />
          <PText x={18} y={186} size={15} color={BLUE}>Wide</PText>
          <PText x={236} y={186} size={15} color={BLUE}>Deep</PText>
        </>
      )}
    </Pen>
  );
}

const FIGS = {
  stars: Stars,
  gate: Gate,
  sWideDeep: SWideDeep,
};

export function Figure({ name }) {
  const F = FIGS[name];
  if (!F) return <span className="dlxp-fig--missing">[figure {name}]</span>;
  return <F />;
}
