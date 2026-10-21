import { createContext, useContext } from 'react';

/* ============================================================================
   LECTURE 5 STUDY — LINE-ART DIAGRAMS
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per figure worth drawing by hand: boxes,
   circles, arrows and short labels in currentColor, no fills or shading, so
   each can be copied onto paper in a couple of minutes. Layer stacks are
   drawn bottom-to-top, as the slides draw them. <Diagram fig="…" /> picks one.

     fig171    Figure 17-1 (right): x₁ x₂ x₃ → 2 neurons (encoder) → 3
               neurons (decoder) → x′₁ x′₂ x′₃
     sandwich  Figure 17-3: 784 → 100 → 30 → 100 → 784, codings and
               reconstruction marked
     pretrain  Figure 17-6: Phase 1 autoencoder, Phase 2 classifier, Hidden 1
               and Hidden 2 copied across
     tied      slide 19's stack with W₁, W₂, W₂ᵀ, W₁ᵀ on its connections
     phases    Figure 17-7: two shallow autoencoders, then the stack

   Highlighting: <Diagram fig="…" hl={['coding']} sheet /> draws the named
   parts (<P k="…">) in the notebook's green pen; with `lab` instead of
   `sheet` they are drawn in the accent colour, for the labs' steppers. The
   part keys per figure are listed in ./sheets/figParts.js (page-check.mjs
   compares them with the <P k> marks below).
   ========================================================================== */

const SW = 1.4;

// null outside highlight mode; otherwise the list of parts to emphasise
const HlCtx = createContext(null);

function P({ k, children }) {
  const hl = useContext(HlCtx);
  if (!hl) return children;
  return <g className={hl.includes(k) ? 'dl5s-fig__hl' : undefined} data-part={k}>{children}</g>;
}

function Arrow({ x1, y1, x2, y2, dashed = false, head = 6 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

function T({ x, y, children, a = 'middle', s = 11, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl5s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h = 20, label, s = 10.5, r = 4 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} />
      {label && <T x={x + w / 2} y={y + h / 2 + 3.8} s={s}>{label}</T>}
    </g>
  );
}

function Svg({ w, h, label, children }) {
  const hl = useContext(HlCtx);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dl5s-fig${hl ? ' dl5s-fig--hl' : ''}`} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* §2 — Figure 17-1, right: a simple autoencoder */
function Fig171() {
  const xs = [104, 164, 224];
  const hs = [134, 194];
  const yIn = 166;
  const yH = 116;
  const yO = 62;
  const yTop = 18;
  const sub = ['₁', '₂', '₃'];
  return (
    <Svg w={330} h={182} label="Figure 17-1, right: inputs x1, x2, x3 at the bottom feed two neurons (the encoder), which feed three neurons (the decoder) whose outputs are x′1, x′2, x′3">
      <P k="enc">
        {xs.map((x) => hs.map((h) => <line key={`${x}-${h}`} x1={x} y1={yIn - 11} x2={h} y2={yH + 11} />))}
      </P>
      <P k="dec">
        {hs.map((h) => xs.map((x) => <line key={`${h}-${x}`} x1={h} y1={yH - 11} x2={x} y2={yO + 11} />))}
      </P>
      {xs.map((x, i) => <T key={x} x={x} y={yIn + 6} i>x{sub[i]}</T>)}
      <P k="code">
        {hs.map((h) => <circle key={h} cx={h} cy={yH} r={11} />)}
      </P>
      <P k="dec">
        {xs.map((x) => <circle key={x} cx={x} cy={yO} r={11} />)}
      </P>
      {xs.map((x, i) => (
        <g key={`o${x}`}>
          <Arrow x1={x} y1={yO - 11} x2={x} y2={yTop + 8} head={4} />
          <T x={x} y={yTop} i>x′{sub[i]}</T>
        </g>
      ))}
      <P k="enc">
        <path d={`M248 ${yH - 12} q6 0 6 6 v3 q0 3 5 3 q-5 0 -5 3 v3 q0 6 -6 6`} />
        <T x={264} y={yH + 4} a="start">Encoder</T>
      </P>
      <P k="dec">
        <path d={`M248 ${yO - 12} q6 0 6 6 v3 q0 3 5 3 q-5 0 -5 3 v3 q0 6 -6 6`} />
        <T x={264} y={yO + 4} a="start">Decoder</T>
      </P>
      <T x={6} y={yIn + 4} a="start" s={9.5}>inputs</T>
      <P k="code"><T x={6} y={yH + 4} a="start" s={9.5}>codings</T></P>
      <T x={6} y={yTop + 2} a="start" s={9.5}>reconstructions</T>
    </Svg>
  );
}

/* the five-layer stack of Figure 17-3 / slide 19, bottom-to-top */
const STACK = [
  { name: 'Input layer', units: 784, w: 150 },
  { name: 'Hidden 1', units: 100, w: 104 },
  { name: 'Hidden 2', units: 30, w: 70 },
  { name: 'Hidden 3', units: 100, w: 104 },
  { name: 'Output layer', units: 784, w: 150 },
];
function Stack({ cx, y0, gap = 40, h = 20, parts = [] }) {
  const ys = STACK.map((_, i) => y0 - i * gap);
  return (
    <g>
      {STACK.map((l, i) => (
        <g key={l.name}>
          {i > 0 && <P k={parts[i - 1]}><line x1={cx} y1={ys[i - 1]} x2={cx} y2={ys[i] + h} /></P>}
          <P k={i === 2 ? 'coding' : undefined}>
            <Box x={cx - l.w / 2} y={ys[i]} w={l.w} h={h} label={l.name} />
          </P>
          <T x={cx - 82} y={ys[i] + 14} a="end" s={9.5}>{l.units} units</T>
        </g>
      ))}
      <Arrow x1={cx} y1={ys[4]} x2={cx} y2={ys[4] - 16} head={4} />
    </g>
  );
}

/* §4 — Figure 17-3: a stacked autoencoder */
function Sandwich() {
  const cx = 168;
  const y0 = 196;
  const gap = 40;
  return (
    <Svg w={300} h={224} label="Figure 17-3: a stacked autoencoder drawn bottom to top: input layer 784 units, Hidden 1 100 units, Hidden 2 30 units (the codings), Hidden 3 100 units, output layer 784 units (the reconstruction)">
      <Stack cx={cx} y0={y0} gap={gap} parts={['enc', 'enc', 'dec', 'dec']} />
      <P k="coding">
        <Arrow x1={240} y1={y0 - 2 * gap - 10} x2={cx + 8} y2={y0 - 2 * gap - 10} dashed head={4} />
        <T x={244} y={y0 - 2 * gap - 6} a="start" s={9.5} b>Codings</T>
      </P>
      <Arrow x1={240} y1={y0 - 4 * gap - 10} x2={cx + 8} y2={y0 - 4 * gap - 10} dashed head={4} />
      <T x={244} y={y0 - 4 * gap - 6} a="start" s={9.5} b>Reconstruction</T>
    </Svg>
  );
}

/* §8 — slide 19: tying the weights (N = 4) */
function Tied() {
  const cx = 186;
  const y0 = 196;
  const gap = 40;
  // the middle of the connection below layer i (between box i − 1 and box i)
  const mid = (i) => y0 - i * gap + (gap + 20) / 2;
  const w = [
    { k: 'w1', at: 1, l: 'W₁' },
    { k: 'w2', at: 2, l: 'W₂' },
    { k: 'w2', at: 3, l: 'W₂ᵀ' },
    { k: 'w1', at: 4, l: 'W₁ᵀ' },
  ];
  return (
    <Svg w={330} h={224} label="Slide 19: the same stack with weight labels on its connections: W1 from the input layer to Hidden 1, W2 from Hidden 1 to Hidden 2, W2 transposed from Hidden 2 to Hidden 3, W1 transposed from Hidden 3 to the output layer; the codings come out of Hidden 2 and the reconstruction out of the output layer">
      <Stack cx={cx} y0={y0} gap={gap} parts={['w1', 'w2', 'w2', 'w1']} />
      {w.map((x) => (
        <P key={x.l} k={x.k}>
          <Arrow x1={274} y1={mid(x.at)} x2={cx + 6} y2={mid(x.at)} dashed head={4} />
          <T x={280} y={mid(x.at) + 4} a="start" s={11} b>{x.l}</T>
        </P>
      ))}
      <P k="coding">
        <T x={4} y={mid(3) + 3} a="start" s={9} b>Codings</T>
        <Arrow x1={48} y1={mid(3)} x2={cx - 6} y2={mid(3)} dashed head={4} />
      </P>
      <T x={4} y={y0 - 4 * gap - 9} a="start" s={9} b>Reconstruction</T>
      <Arrow x1={76} y1={y0 - 4 * gap - 12} x2={cx - 6} y2={y0 - 4 * gap - 12} dashed head={4} />
    </Svg>
  );
}

/* §7 — Figure 17-6: unsupervised pretraining */
function Pretrain() {
  const y0 = 186;
  const gap = 34;
  const h = 19;
  const left = ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'];
  const right = ['Input', 'Hidden 1', 'Hidden 2', 'Output', 'Softmax'];
  const widths = { Input: 96, Output: 96, Softmax: 70 };
  const col = (cx, names, partFor) => names.map((n, i) => {
    const y = y0 - i * gap;
    const w = widths[n] ?? 74;
    return (
      <g key={`${cx}-${n}-${i}`}>
        {i > 0 && <line x1={cx} y1={y + h} x2={cx} y2={y + gap} />}
        <P k={partFor(n, i)}><Box x={cx - w / 2} y={y} w={w} h={h} label={n} s={10} /></P>
      </g>
    );
  });
  return (
    <Svg w={360} h={246} label="Figure 17-6: Phase 1, an autoencoder (Input, Hidden 1, Hidden 2, Hidden 3, Output) trained on all the data; Phase 2, a classifier (Input, Hidden 1, Hidden 2, Output, Softmax) trained on the labelled data, with Hidden 1 and Hidden 2's parameters copied across from Phase 1">
      {col(84, left, (n) => (n === 'Hidden 1' || n === 'Hidden 2' ? 'copy' : 'p1'))}
      <Arrow x1={84} y1={y0 - 4 * gap} x2={84} y2={y0 - 4 * gap - 14} head={4} />
      {col(268, right, (n, i) => (n === 'Hidden 1' || n === 'Hidden 2' ? 'copy' : i >= 3 ? 'head' : undefined))}
      <Arrow x1={268} y1={y0 - 4 * gap} x2={268} y2={y0 - 4 * gap - 14} head={4} />
      <P k="copy">
        <Arrow x1={124} y1={y0 - gap + 9} x2={228} y2={y0 - gap + 9} dashed head={4} />
        <Arrow x1={124} y1={y0 - 2 * gap + 9} x2={228} y2={y0 - 2 * gap + 9} dashed head={4} />
        <T x={176} y={y0 - 1.5 * gap + 13} s={9.5} i>Copy parameters</T>
      </P>
      <T x={84} y={y0 + h + 14} s={10.5} b>Phase 1</T>
      <T x={84} y={y0 + h + 26} s={9}>train the autoencoder on all the data</T>
      <T x={268} y={y0 + h + 14} s={10.5} b>Phase 2</T>
      <T x={268} y={y0 + h + 26} s={9}>train the classifier on the labelled data</T>
    </Svg>
  );
}

/* §9 — Figure 17-7: training one autoencoder at a time */
function Phases() {
  const y0 = 176;
  const h = 19;
  const box = (cx, y, w, label, k) => <P k={k}><Box x={cx - w / 2} y={y} w={w} h={h} label={label} s={9.5} /></P>;
  const c1 = 60;
  const c2 = 186;
  const c3 = 318;
  const g = 30;
  return (
    <Svg w={400} h={236} label="Figure 17-7: Phase 1 trains Input, Hidden 1, Output with target equal to the inputs; Phase 2 trains Input, Hidden 2, Output on the training set encoded by the first encoder; Phase 3 stacks Input, Hidden 1, Hidden 2, Hidden 3, Output, with parameters copied from the two phases">
      {/* Phase 1: 784 → 100 → 784 */}
      <P k="p1">
        <line x1={c1} y1={y0} x2={c1} y2={y0 - g + h} />
        <line x1={c1} y1={y0 - g} x2={c1} y2={y0 - 4 * g + h} />
        <Arrow x1={c1} y1={y0 - 4 * g} x2={c1} y2={y0 - 4 * g - 14} head={4} />
        <T x={c1} y={y0 - 4 * g - 18} s={8.5}>target = inputs</T>
      </P>
      {box(c1, y0, 96, 'Input', 'p1')}
      {box(c1, y0 - g, 66, 'Hidden 1', 'p1')}
      {box(c1, y0 - 4 * g, 96, 'Output', 'p1')}
      {/* Phase 2: 100 → 30 → 100, on the encoded training set */}
      <P k="p2">
        <line x1={c2} y1={y0 - g} x2={c2} y2={y0 - 2 * g + h} />
        <line x1={c2} y1={y0 - 2 * g} x2={c2} y2={y0 - 3 * g + h} />
        <Arrow x1={c2} y1={y0 - 3 * g} x2={c2} y2={y0 - 3 * g - 14} head={4} />
        <T x={c2} y={y0 - 3 * g - 18} s={8.5}>target = inputs</T>
      </P>
      {box(c2, y0 - g, 66, 'Input', 'p2')}
      {box(c2, y0 - 2 * g, 60, 'Hidden 2', 'p2')}
      {box(c2, y0 - 3 * g, 66, 'Output', 'p2')}
      {/* Phase 3: the stack */}
      <P k="p3">
        {[0, 1, 2, 3].map((i) => <line key={i} x1={c3} y1={y0 - i * g} x2={c3} y2={y0 - (i + 1) * g + h} />)}
        <Arrow x1={c3} y1={y0 - 4 * g} x2={c3} y2={y0 - 4 * g - 14} head={4} />
      </P>
      {box(c3, y0, 96, 'Input', 'p3')}
      {box(c3, y0 - g, 66, 'Hidden 1', 'p3')}
      {box(c3, y0 - 2 * g, 60, 'Hidden 2', 'p3')}
      {box(c3, y0 - 3 * g, 66, 'Hidden 3', 'p3')}
      {box(c3, y0 - 4 * g, 96, 'Output', 'p3')}
      {/* copy parameters */}
      <P k="copy">
        <path d={`M${c1 + 33} ${y0 - g + 9} H${c2 - 50} V${y0 + h + 6} H${c3 - 80} V${y0 - g + 9}`} strokeDasharray="4 3" />
        <Arrow x1={c3 - 80} y1={y0 - g + 9} x2={c3 - 33} y2={y0 - g + 9} dashed head={4} />
        <Arrow x1={c2 + 30} y1={y0 - 2 * g + 9} x2={c3 - 30} y2={y0 - 2 * g + 9} dashed head={4} />
        <Arrow x1={c2 + 33} y1={y0 - 3 * g + 9} x2={c3 - 33} y2={y0 - 3 * g + 9} dashed head={4} />
        <path d={`M${c1 + 48} ${y0 - 4 * g + 9} H${c2 - 50} V${y0 - 4 * g - 30} H${c3 - 80} V${y0 - 4 * g + 9}`} strokeDasharray="4 3" />
        <Arrow x1={c3 - 80} y1={y0 - 4 * g + 9} x2={c3 - 48} y2={y0 - 4 * g + 9} dashed head={4} />
        <T x={c2} y={y0 - 4 * g - 34} s={9} i>Copy parameters</T>
      </P>
      <T x={c1} y={y0 + h + 16} s={10} b>Phase 1</T>
      <T x={c2} y={y0 + h + 22} s={10} b>Phase 2</T>
      <T x={c3} y={y0 + h + 16} s={10} b>Phase 3</T>
      <T x={c1} y={y0 + h + 28} s={8.5}>train the first AE</T>
      <T x={c2} y={y0 + h + 34} s={8.5}>train the second AE on X₍₁₎</T>
      <T x={c3} y={y0 + h + 28} s={8.5}>stack the autoencoders</T>
    </Svg>
  );
}

const FIGS = {
  fig171: Fig171,
  sandwich: Sandwich,
  tied: Tied,
  pretrain: Pretrain,
  phases: Phases,
};

const NO_HL = [];

// sheet: the notebook page's pens (green highlights); lab: accent highlights
export function Diagram({ fig, sheet = false, lab = false, hl = NO_HL }) {
  const Fig = FIGS[fig];
  if (!Fig) return null;
  if (!sheet && !lab) return <Fig />;
  return (
    <span className={lab ? 'dl5s-figwrap dl5s-figwrap--lab' : 'dl5s-figwrap dl5s-figwrap--sheet'}>
      <HlCtx.Provider value={hl}>
        <Fig />
      </HlCtx.Provider>
    </span>
  );
}
