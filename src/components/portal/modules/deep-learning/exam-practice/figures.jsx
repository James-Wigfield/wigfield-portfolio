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

// italic maths symbol with a subscript: e(3,0), α(3,0), x₁, s₀ …
function Sym({ x, y, v, sub, size = 13, anchor = 'middle', color = '#111' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fill={color} stroke="none">
      <tspan fontStyle="italic">{v}</tspan>
      <tspan fontSize={size * 0.72} dy={size * 0.25}>{sub}</tspan>
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

/* ── printed: the practice papers' figures ───────────────────────────────── */

// a printed box with a centred serif label
function Box({ x, y, w: bw, h: bh, label, size = 13, fill = '#fff', rx = 3, bold = false }) {
  return (
    <g>
      <rect x={x} y={y} width={bw} height={bh} rx={rx} fill={fill} stroke="#111" strokeWidth="1" />
      {label && <text x={x + bw / 2} y={y + bh / 2 + size * 0.36} textAnchor="middle" fontFamily={SERIF} fontSize={size} fontWeight={bold ? 'bold' : 'normal'} fill="#111">{label}</text>}
    </g>
  );
}
function T({ x, y, children, size = 13, anchor = 'middle', color = '#111', italic = false }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fontStyle={italic ? 'italic' : 'normal'} fill={color}>{children}</text>;
}
// circled operator: ⊗ (times) or ⊕ (plus)
function Op({ x, y, kind = 'times', r = 8 }) {
  const d = kind === 'times'
    ? `M${x - r * 0.62} ${y - r * 0.62} L${x + r * 0.62} ${y + r * 0.62} M${x + r * 0.62} ${y - r * 0.62} L${x - r * 0.62} ${y + r * 0.62}`
    : `M${x - r * 0.75} ${y} L${x + r * 0.75} ${y} M${x} ${y - r * 0.75} L${x} ${y + r * 0.75}`;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="#111" strokeWidth="1" />
      <path d={d} stroke="#111" strokeWidth="1" />
    </g>
  );
}

// Practice A Q2(a): a memory cell unrolled through time steps 0, 1, 2
// (the layout of L4 slides 5–8: inputs below, outputs above, state passed right).
function MemCell() {
  const xs = [95, 230, 365];
  return (
    <Printed viewBox="0 0 470 205" width="470px" label="A memory cell unrolled through three time steps: for t = 0, 1, 2 the same cell receives x(t) from below and the previous hidden state from the left, outputs y(t) above, and passes h(t) to the right; h(−1) enters the first cell and h(2) leaves the last.">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          {xs.map((cx, t) => (
            <g key={t}>
              <rect x={cx - 38} y={70} width={76} height={50} rx={6} fill="#fff" strokeWidth="1.3" />
              <text x={cx} y={100} textAnchor="middle" fontFamily={SERIF} fontSize="13" fill="#111" stroke="none">cell</text>
              <line x1={cx} y1={168} x2={cx} y2={123} markerEnd={arrow} />
              <line x1={cx} y1={70} x2={cx} y2={30} markerEnd={arrow} />
              <g stroke="none">
                <Vec x={cx} y={186} v="x" sub={`(${t})`} />
                <Vec x={cx} y={22} v="y" sub={`(${t})`} />
              </g>
            </g>
          ))}
          <line x1={14} y1={95} x2={55} y2={95} markerEnd={arrow} />
          <line x1={133} y1={95} x2={190} y2={95} markerEnd={arrow} />
          <line x1={268} y1={95} x2={325} y2={95} markerEnd={arrow} />
          <line x1={403} y1={95} x2={458} y2={95} markerEnd={arrow} />
          <g stroke="none">
            <Vec x={30} y={86} v="h" sub="(−1)" size={13} />
            <Vec x={162} y={86} v="h" sub="(0)" size={13} />
            <Vec x={297} y={86} v="h" sub="(1)" size={13} />
            <Vec x={432} y={86} v="h" sub="(2)" size={13} />
          </g>
          <line x1={40} y1={198} x2={430} y2={198} markerEnd={arrow} strokeWidth="0.8" />
          <text x={436} y={194} fontFamily={SERIF} fontSize="11" fontStyle="italic" fill="#111" stroke="none">time</text>
        </g>
      )}
    </Printed>
  );
}

// Practice B Q2(d): Lab Sheet 4's noisy squares, vertices numbered 0–3 in
// the order they are listed: left anti-clockwise, right clockwise.
const SQ_L = [[118, 132], [124, 30], [22, 24], [18, 128]];
const SQ_R = [[226, 28], [326, 34], [320, 136], [218, 130]];

function SquareSeq({ pts }) {
  return (
    <g>
      <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#111" strokeWidth="1.2" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={2.2} fill="#111" />
          <text x={x + (x < 60 || (x > 200 && x < 260) ? -12 : 6)} y={y + (y < 80 ? -4 : 13)} fontFamily={SANS} fontSize="10" fill="#111">{i}</text>
        </g>
      ))}
    </g>
  );
}

function Squares() {
  return (
    <Printed viewBox="0 0 345 160" width="380px" label="Two noisy squares with vertices numbered 0 to 3 in the order they appear in the sequence: the left square is listed anti-clockwise, the right square clockwise.">
      {() => (
        <>
          <SquareSeq pts={SQ_L} />
          <SquareSeq pts={SQ_R} />
          <text x={70} y={156} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" fontStyle="italic" fill="#333">anti-clockwise (label 0)</text>
          <text x={272} y={156} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" fontStyle="italic" fill="#333">clockwise (label 1)</text>
        </>
      )}
    </Printed>
  );
}

// Practice A Q3(e): Bahdanau attention's alignment model at decoder step 3
// (L8 slides 22–23): h(2) and each encoder output y(i) go into one Dense
// neuron; the scores go through a softmax into the weights α(3, i).
function Bahdanau() {
  const ys = [190, 290, 390];
  return (
    <Printed viewBox="0 0 470 250" width="470px" label="Bahdanau attention at decoder step 3: the decoder state h(2) and each encoder output y(0), y(1), y(2) feed one Dense layer with a single neuron, which outputs a score e(3,i) for each encoder output; a softmax layer turns the three scores into the weights α(3,0), α(3,1), α(3,2).">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          <Box x={30} y={196} w={64} h={30} label="" />
          <g stroke="none"><Vec x={62} y={216} v="h" sub="(2)" /></g>
          <text x={62} y={244} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" fontStyle="italic" fill="#333" stroke="none">decoder state</text>
          {ys.map((cx, i) => (
            <g key={i}>
              <Box x={cx - 30} y={196} w={60} h={30} label="" />
              <g stroke="none"><Vec x={cx} y={216} v="y" sub={`(${i})`} /></g>
              <line x1={cx} y1={196} x2={cx} y2={158} markerEnd={arrow} />
              <path d={`M62 196 Q 62 175 ${cx - 14} 160`} markerEnd={arrow} strokeDasharray="3 2" />
              <line x1={cx} y1={128} x2={cx} y2={98} markerEnd={arrow} />
              <Sym x={cx + 24} y={114} v="e" sub={`(3,${i})`} size={13} />
              <line x1={cx} y1={68} x2={cx} y2={36} markerEnd={arrow} />
              <Sym x={cx} y={24} v="α" sub={`(3,${i})`} size={14} />
            </g>
          ))}
          <text x={290} y={244} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" fontStyle="italic" fill="#333" stroke="none">encoder outputs</text>
          <Box x={150} y={128} w={280} h={30} label="Dense (1 neuron), applied to each pair" size={12} fill="#f1f1f1" />
          <Box x={150} y={68} w={280} h={30} label="softmax" size={13} fill="#f1f1f1" />
        </g>
      )}
    </Printed>
  );
}

// Practice B Q1(a): the XOR multilayer perceptron of L1 slide 17 (Fig 10-6b):
// weights on the connections, each TLU's bias beside it.
function XorMlp() {
  return (
    <Printed viewBox="0 0 400 250" width="400px" label="An MLP of threshold logic units: inputs x1 and x2 each connect with weight 1 to hidden TLU h1 (bias −3/2) and hidden TLU h2 (bias −1/2); h1 connects to the output TLU with weight −1 and h2 with weight 1; the output TLU has bias −1/2.">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          {/* inputs */}
          <circle cx={130} cy={215} r={17} fill="#fff" />
          <circle cx={270} cy={215} r={17} fill="#fff" />
          <g stroke="none">
            <Sym x={128} y={219} v="x" sub="1" size={15} />
            <Sym x={268} y={219} v="x" sub="2" size={15} />
          </g>
          {/* hidden TLUs */}
          <circle cx={130} cy={125} r={21} fill="#fff" strokeWidth="1.3" />
          <circle cx={270} cy={125} r={21} fill="#fff" strokeWidth="1.3" />
          <g stroke="none">
            <Sym x={128} y={129} v="h" sub="1" size={14} />
            <Sym x={268} y={129} v="h" sub="2" size={14} />
            <T x={84} y={122} size={12} anchor="end">bias −3/2</T>
            <T x={316} y={122} size={12} anchor="start">bias −1/2</T>
          </g>
          <line x1={130} y1={198} x2={130} y2={148} markerEnd={arrow} />
          <line x1={270} y1={198} x2={270} y2={148} markerEnd={arrow} />
          <line x1={142} y1={201} x2={254} y2={139} markerEnd={arrow} />
          <line x1={258} y1={201} x2={146} y2={139} markerEnd={arrow} />
          <g stroke="none">
            <T x={118} y={176} size={12}>1</T>
            <T x={282} y={176} size={12}>1</T>
            <T x={170} y={168} size={12}>1</T>
            <T x={230} y={168} size={12}>1</T>
          </g>
          {/* output TLU */}
          <circle cx={200} cy={45} r={21} fill="#fff" strokeWidth="1.3" />
          <g stroke="none">
            <T x={200} y={50} size={13}>out</T>
            <T x={232} y={42} size={12} anchor="start">bias −1/2</T>
          </g>
          <line x1={144} y1={108} x2={184} y2={63} markerEnd={arrow} />
          <line x1={256} y1={108} x2={216} y2={63} markerEnd={arrow} />
          <line x1={200} y1={24} x2={200} y2={6} markerEnd={arrow} />
          <g stroke="none">
            <T x={152} y={82} size={12}>−1</T>
            <T x={248} y={82} size={12}>1</T>
          </g>
        </g>
      )}
    </Printed>
  );
}

// Practice B Q2(a): an LSTM cell (L4 slides 44–46, Fig 15-12, simplified):
// the long-term state runs along the top through ⊗ f and ⊕ (i ⊗ g); c(t) also
// goes through tanh and ⊗ o to give h(t) = y(t). Four FC layers read x(t), h(t−1).
function Lstm() {
  const fcs = [
    { x: 74, n: 'f', act: 'logistic' },
    { x: 154, n: 'g', act: 'tanh' },
    { x: 234, n: 'i', act: 'logistic' },
    { x: 314, n: 'o', act: 'logistic' },
  ];
  return (
    <Printed viewBox="0 0 470 300" width="470px" label="An LSTM cell: c(t−1) enters top left, is multiplied element-wise by the forget gate f(t), then i(t) ⊗ g(t) is added, giving c(t) at top right. c(t) is also passed through tanh and multiplied element-wise by o(t) to give h(t), which leaves right and as y(t) upward. Four FC layers — f (logistic), g (tanh), i (logistic), o (logistic) — each receive x(t) and h(t−1).">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          <rect x={40} y={34} width={360} height={204} rx={10} strokeWidth="1.3" />
          {/* long-term state line */}
          <line x1={6} y1={58} x2={86} y2={58} markerEnd={arrow} />
          <line x1={102} y1={58} x2={226} y2={58} markerEnd={arrow} />
          <line x1={242} y1={58} x2={460} y2={58} markerEnd={arrow} />
          <Op x={94} y={58} />
          <Op x={234} y={58} kind="plus" />
          <g stroke="none">
            <Vec x={8} y={46} v="c" sub="(t−1)" size={13} anchor="start" />
            <Vec x={440} y={50} v="c" sub="(t)" size={13} />
          </g>
          {/* FC layers */}
          {fcs.map((f) => (
            <g key={f.n}>
              <rect x={f.x} y={176} width={52} height={11} fill={f.act === 'tanh' ? '#4a4a4a' : '#c8c8c8'} />
              <rect x={f.x} y={187} width={52} height={24} fill="#fff" />
              <text x={f.x + 26} y={204} textAnchor="middle" fontFamily={SERIF} fontWeight="bold" fontSize="12" fill="#111" stroke="none">FC</text>
              <line x1={f.x + 26} y1={226} x2={f.x + 26} y2={213} markerEnd={arrow} />
            </g>
          ))}
          <path d="M100 226 L340 226" />
          {/* inputs into the FC bus */}
          <line x1={220} y1={292} x2={220} y2={228} />
          <path d="M6 262 L60 262 L60 226 L100 226" />
          <g stroke="none">
            <Vec x={232} y={287} v="x" sub="(t)" size={13} anchor="start" />
            <Vec x={8} y={255} v="h" sub="(t−1)" size={13} anchor="start" />
          </g>
          {/* f → forget ⊗ */}
          <line x1={100} y1={176} x2={95} y2={68} markerEnd={arrow} />
          {/* g, i → ⊗ → ⊕ */}
          <Op x={234} y={130} />
          <path d="M180 176 L180 130 L224 130" markerEnd={arrow} />
          <line x1={260} y1={176} x2={238} y2={140} markerEnd={arrow} />
          <line x1={234} y1={121} x2={234} y2={68} markerEnd={arrow} />
          {/* c(t) → tanh → ⊗ o → h(t) */}
          <line x1={370} y1={58} x2={370} y2={90} markerEnd={arrow} />
          <rect x={352} y={92} width={36} height={18} rx={9} fill="#fff" />
          <text x={370} y={105} textAnchor="middle" fontFamily={SERIF} fontSize="11" fill="#111" stroke="none">tanh</text>
          <line x1={370} y1={110} x2={370} y2={134} markerEnd={arrow} />
          <Op x={370} y={144} />
          <line x1={340} y1={176} x2={362} y2={150} markerEnd={arrow} />
          <path d="M379 144 L430 144 L430 262 L460 262" markerEnd={arrow} />
          <line x1={430} y1={144} x2={430} y2={12} markerEnd={arrow} />
          <g stroke="none">
            <Vec x={440} y={20} v="y" sub="(t)" size={13} anchor="start" />
            <Vec x={444} y={254} v="h" sub="(t)" size={13} anchor="start" />
            <Vec x={108} y={118} v="f" sub="(t)" size={12} anchor="start" />
            <Vec x={186} y={152} v="g" sub="(t)" size={12} anchor="start" />
            <Vec x={262} y={156} v="i" sub="(t)" size={12} anchor="start" />
            <Vec x={318} y={164} v="o" sub="(t)" size={12} anchor="end" />
          </g>
          {/* legend */}
          <rect x={46} y={16} width={14} height={8} fill="#c8c8c8" />
          <text x={64} y={24} fontFamily={SERIF} fontSize="10.5" fill="#111" stroke="none">logistic</text>
          <rect x={112} y={16} width={14} height={8} fill="#4a4a4a" />
          <text x={130} y={24} fontFamily={SERIF} fontSize="10.5" fill="#111" stroke="none">tanh</text>
          <text x={168} y={24} fontFamily={SERIF} fontSize="10.5" fill="#111" stroke="none">⊗ element-wise multiplication   ⊕ addition</text>
        </g>
      )}
    </Printed>
  );
}

// an MDP action node
function Diamond({ x, y, label }) {
  return (
    <g>
      <path d={`M${x} ${y - 13} L${x + 13} ${y} L${x} ${y + 13} L${x - 13} ${y} z`} fill="#fff" stroke="#111" strokeWidth="1" />
      <text x={x} y={y + 4} textAnchor="middle" fontFamily={SERIF} fontSize="11" fontStyle="italic" fill="#111" stroke="none">{label}</text>
    </g>
  );
}

// Practice B Q4(b): the Markov decision process of L9 slide 41 (Fig 18-8),
// with the transition probabilities and rewards of slide 47's arrays.
function Mdp() {
  const S = { s0: [90, 150], s1: [270, 150], s2: [450, 150] };
  const R = 22;
  const red = '#c4221b';
  return (
    <Printed viewBox="0 0 540 300" width="520px" label="A Markov decision process with states s0, s1, s2 drawn as circles and actions as diamonds. From s0: a0 leads back to s0 with probability 0.7 and reward +10, or to s1 with 0.3; a1 leads back to s0 with 1.0; a2 leads back to s0 with 0.8 or to s1 with 0.2. From s1: a0 leads back to s1 with 1.0; a2 leads to s2 with 1.0 and reward −50. From s2: a1 leads to s0 with 0.8 and reward +40, to s1 with 0.1, and back to s2 with 0.1.">
      {(arrow) => (
        <g fill="none" stroke="#111" strokeWidth="1">
          {/* states */}
          {Object.entries(S).map(([k, [x, y]]) => (
            <g key={k}>
              <circle cx={x} cy={y} r={R} fill="#fff" strokeWidth="1.4" />
              <Sym x={x - 1} y={y + 4} v="s" sub={k[1]} size={15} />
            </g>
          ))}
          {/* s0: a0 (below) */}
          <line x1={90} y1={172} x2={90} y2={215} markerEnd={arrow} />
          <path d="M78 228 C 40 228, 40 175, 70 163" markerEnd={arrow} />
          <path d="M103 232 C 170 250, 230 210, 258 170" markerEnd={arrow} />
          {/* s0: a1 (top left) */}
          <line x1={76} y1={132} x2={56} y2={98} markerEnd={arrow} />
          <path d="M40 80 C 18 110, 30 150, 68 153" markerEnd={arrow} />
          {/* s0: a2 (right) */}
          <line x1={112} y1={150} x2={162} y2={150} markerEnd={arrow} />
          <path d="M175 160 C 160 195, 120 185, 104 168" markerEnd={arrow} />
          <line x1={188} y1={150} x2={246} y2={150} markerEnd={arrow} />
          {/* s1: a0 (below) */}
          <line x1={270} y1={172} x2={270} y2={215} markerEnd={arrow} />
          <path d="M283 228 C 320 226, 315 182, 288 166" markerEnd={arrow} />
          {/* s1: a2 (right) */}
          <line x1={292} y1={150} x2={342} y2={150} markerEnd={arrow} />
          <line x1={368} y1={150} x2={426} y2={150} markerEnd={arrow} />
          {/* s2: a1 (above) */}
          <line x1={450} y1={128} x2={450} y2={84} markerEnd={arrow} />
          <path d="M437 70 C 330 10, 160 10, 98 128" markerEnd={arrow} />
          <path d="M446 84 C 400 95, 330 100, 286 133" markerEnd={arrow} />
          <path d="M463 70 C 505 70, 505 135, 472 145" markerEnd={arrow} />
          <Diamond x={90} y={228} label="a0" />
          <Diamond x={47} y={84} label="a1" />
          <Diamond x={175} y={150} label="a2" />
          <Diamond x={270} y={228} label="a0" />
          <Diamond x={355} y={150} label="a2" />
          <Diamond x={450} y={71} label="a1" />
          <g stroke="none" fontFamily={SERIF} fontSize="11.5">
            <text x={30} y={210} fill="#111">0.7</text>
            <text x={22} y={236} fill={red}>+10</text>
            <text x={186} y={242} fill="#111">0.3</text>
            <text x={14} y={130} fill="#111">1.0</text>
            <text x={130} y={194} fill="#111">0.8</text>
            <text x={210} y={144} fill="#111">0.2</text>
            <text x={318} y={212} fill="#111">1.0</text>
            <text x={386} y={144} fill="#111">1.0</text>
            <text x={384} y={172} fill={red}>−50</text>
            <text x={248} y={50} fill="#111">0.8</text>
            <text x={274} y={50} fill={red}>+40</text>
            <text x={352} y={112} fill="#111">0.1</text>
            <text x={498} y={110} fill="#111">0.1</text>
          </g>
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

// Practice C Q1(c): the two-input Wide & Deep with an auxiliary output, every
// arrow labelled with the shape of the data on it.
function CWideAux() {
  return (
    <Pen viewBox="0 0 400 356" width="400px" label="Hand-drawn Wide and Deep network with two inputs and two outputs: Input [5] to Normalization (None, 5), straight into Concat; Input [6] to Normalization (None, 6) to Dense 20 ReLU (None, 20) to Dense 10 ReLU (None, 10), which goes into Concat (5 + 10 = 15) and into the auxiliary Dense 1; Concat to Dense 1, the main output (None, 1); the auxiliary Dense 1 gives aux_output (None, 1).">
      {({ arrow }) => (
        <>
          <PBox x={20} y={318} w={130} h={28} label="Input [5]" size={13} />
          <PBox x={20} y={262} w={130} h={28} label="Normalization" size={13} />
          <PBox x={230} y={318} w={130} h={28} label="Input [6]" size={13} />
          <PBox x={230} y={262} w={130} h={28} label="Normalization" size={13} />
          <PBox x={230} y={206} w={130} h={28} label="Dense 20, ReLU" size={13} />
          <PBox x={230} y={150} w={130} h={28} label="Dense 10, ReLU" size={13} />
          <PBox x={20} y={94} w={130} h={28} label="Concat" size={13} />
          <PBox x={20} y={38} w={130} h={28} label="Dense 1" size={13} />
          <PBox x={230} y={94} w={130} h={28} label="Dense 1 (aux)" size={13} />
          <line x1={85} y1={318} x2={85} y2={292} markerEnd={arrow} />
          <line x1={85} y1={262} x2={85} y2={124} markerEnd={arrow} />
          <PText x={92} y={200} size={12} color={GREY}>(None, 5)</PText>
          <PText x={92} y={146} size={12} color={GREY}>5 + 10 = 15</PText>
          <line x1={295} y1={318} x2={295} y2={292} markerEnd={arrow} />
          <line x1={295} y1={262} x2={295} y2={236} markerEnd={arrow} />
          <PText x={301} y={254} size={12} color={GREY}>(None, 6)</PText>
          <line x1={295} y1={206} x2={295} y2={180} markerEnd={arrow} />
          <PText x={301} y={198} size={12} color={GREY}>(None, 20)</PText>
          <line x1={295} y1={150} x2={295} y2={124} markerEnd={arrow} />
          <PText x={301} y={142} size={12} color={GREY}>(None, 10)</PText>
          <path d="M230 164 L186 164 L186 108 L152 108" markerEnd={arrow} />
          <line x1={85} y1={94} x2={85} y2={68} markerEnd={arrow} />
          <line x1={85} y1={38} x2={85} y2={14} markerEnd={arrow} />
          <PText x={92} y={18} size={13}>output (None, 1)</PText>
          <line x1={295} y1={94} x2={295} y2={70} markerEnd={arrow} />
          <PText x={252} y={62} size={13}>aux_output (None, 1)</PText>
          <PText x={22} y={236} size={15} color={BLUE}>Wide</PText>
          <PText x={366} y={236} size={15} color={BLUE}>Deep</PText>
        </>
      )}
    </Pen>
  );
}

// Practice A Q3(a): the GAN of the question, every arrow labelled with the
// shape of the data on it (batch dimension written "b").
function AGan() {
  return (
    <Pen viewBox="0 0 470 290" width="470px" label="Hand-drawn GAN: noise codings (b, 20) go into the generator: Dense 64 ReLU gives (b, 64), Dense 784 sigmoid gives (b, 784), Reshape gives fake images (b, 28, 28). Fake and real images (b, 28, 28) go into the discriminator: Flatten gives (b, 784), Dense 64 ReLU gives (b, 64), Dense 1 sigmoid gives (b, 1), the probability that each image is real.">
      {({ arrow }) => (
        <>
          <PText x={20} y={14} size={13} color={GREY}>noise (b, 20)</PText>
          <line x1={60} y1={20} x2={60} y2={38} markerEnd={arrow} />
          <PBox x={10} y={40} w={110} h={28} label="Dense 64, ReLU" size={13} />
          <line x1={60} y1={68} x2={60} y2={92} markerEnd={arrow} />
          <PText x={66} y={84} size={12} color={GREY}>(b, 64)</PText>
          <PBox x={10} y={94} w={110} h={28} label="Dense 784, sigm." size={13} />
          <line x1={60} y1={122} x2={60} y2={146} markerEnd={arrow} />
          <PText x={66} y={138} size={12} color={GREY}>(b, 784)</PText>
          <PBox x={10} y={148} w={110} h={28} label="Reshape" size={13} />
          <PText x={18} y={200} size={16} color={BLUE}>Generator</PText>
          <path d="M120 162 C 170 162, 190 150, 238 150" markerEnd={arrow} />
          <PText x={128} y={146} size={12} color={GREY}>fake (b, 28, 28)</PText>
          <PText x={150} y={262} size={13}>real images</PText>
          <PText x={150} y={278} size={12} color={GREY}>(b, 28, 28)</PText>
          <path d="M200 250 C 215 210, 222 190, 240 168" markerEnd={arrow} />
          <PBox x={242} y={136} w={110} h={28} label="Flatten" size={13} />
          <line x1={297} y1={136} x2={297} y2={112} markerEnd={arrow} />
          <PText x={303} y={128} size={12} color={GREY}>(b, 784)</PText>
          <PBox x={242} y={82} w={110} h={28} label="Dense 64, ReLU" size={13} />
          <line x1={297} y1={82} x2={297} y2={58} markerEnd={arrow} />
          <PText x={303} y={74} size={12} color={GREY}>(b, 64)</PText>
          <PBox x={242} y={28} w={110} h={28} label="Dense 1, sigm." size={13} />
          <line x1={352} y1={42} x2={380} y2={42} markerEnd={arrow} />
          <PText x={384} y={38} size={13}>P(real)</PText>
          <PText x={384} y={54} size={12} color={GREY}>(b, 1)</PText>
          <PText x={250} y={192} size={16} color={BLUE}>Discriminator</PText>
        </>
      )}
    </Pen>
  );
}

// Practice A Q4(e): the CartPole policy network of L9 slide 25 (Fig 18-5).
function APolicy() {
  const xin = [40, 85, 130, 175];
  const hid = [30, 70, 110, 150, 190];
  return (
    <Pen viewBox="0 0 330 230" width="320px" label="Hand-drawn policy network: 4 observation inputs, fully connected to 5 hidden ReLU neurons, fully connected to 1 sigmoid output neuron giving p, the probability of action 0 (left); the action is then sampled with that probability.">
      {({ arrow }) => (
        <>
          {xin.map((y, i) => <circle key={`i${i}`} cx={40} cy={y + 10} r={9} />)}
          {hid.map((y, j) => <circle key={`h${j}`} cx={140} cy={y + 10} r={9} />)}
          <circle cx={230} cy={120} r={11} />
          {xin.map((y) => hid.map((yy, j) => <line key={`${y}-${j}`} x1={49} y1={y + 10} x2={131} y2={yy + 10} strokeWidth="0.7" />))}
          {hid.map((yy, j) => <line key={`o${j}`} x1={149} y1={yy + 10} x2={219} y2={120} strokeWidth="0.8" />)}
          <line x1={241} y1={120} x2={268} y2={120} markerEnd={arrow} />
          <PText x={10} y={222} size={13}>4 observations</PText>
          <PText x={104} y={222} size={13}>5 ReLU</PText>
          <PText x={200} y={150} size={13}>sigmoid</PText>
          <PText x={272} y={114} size={14}>p</PText>
          <PText x={252} y={140} size={12} color={GREY}>P(left)</PText>
          <PText x={196} y={196} size={13} color={BLUE}>sample the action</PText>
          <PText x={196} y={212} size={13} color={BLUE}>with probability p</PText>
        </>
      )}
    </Pen>
  );
}

// Practice B Q2(b): Conv1D → LSTM → Dense, with the shapes between layers.
function BConvLstm() {
  return (
    <Pen viewBox="0 0 330 300" width="300px" label="Hand-drawn network: input sequences of 30 time steps with 2 features go into a Conv1D layer with 8 filters of size 3 and ReLU, giving 28 time steps with 8 features; then an LSTM with 16 units gives a vector of 16; then a Dense layer gives 1 output.">
      {({ arrow }) => (
        <>
          <PBox x={80} y={252} w={150} h={32} label="Input (30, 2)" />
          <line x1={155} y1={252} x2={155} y2={222} markerEnd={arrow} />
          <PBox x={80} y={180} w={150} h={40} label="Conv1D, 8 filters" sub="k = 3, ReLU, valid" />
          <line x1={155} y1={180} x2={155} y2={150} markerEnd={arrow} />
          <PText x={164} y={170} size={13} color={GREY}>(28, 8)</PText>
          <PBox x={80} y={112} w={150} h={36} label="LSTM, 16 units" />
          <line x1={155} y1={112} x2={155} y2={82} markerEnd={arrow} />
          <PText x={164} y={102} size={13} color={GREY}>(16)</PText>
          <PBox x={80} y={46} w={150} h={34} label="Dense 1" />
          <line x1={155} y1={46} x2={155} y2={16} markerEnd={arrow} />
          <PText x={164} y={30} size={13} color={GREY}>(1)</PText>
        </>
      )}
    </Pen>
  );
}

const FIGS = {
  stars: Stars,
  gate: Gate,
  memCell: MemCell,
  squares: Squares,
  bahdanau: Bahdanau,
  xorMlp: XorMlp,
  lstm: Lstm,
  mdp: Mdp,
  sWideDeep: SWideDeep,
  aGan: AGan,
  aPolicy: APolicy,
  bConvLstm: BConvLstm,
  cWideAux: CWideAux,
};

export function Figure({ name }) {
  const F = FIGS[name];
  if (!F) return <span className="dlxp-fig--missing">[figure {name}]</span>;
  return <F />;
}
