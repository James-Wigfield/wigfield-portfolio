/* ============================================================================
   LECTURE 3 STUDY — "DRAW THIS" DIAGRAMS
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per notebook figure: boxes, grids, arrows and
   short labels in currentColor — no colour, gradients or 3D shading — so each
   can be copied onto paper in about two minutes. Deliberately simpler than the
   interactive labs. <Diagram fig="…" /> picks one by key.
   ========================================================================== */

const SW = 1.4;

function Arrow({ x1, y1, x2, y2, dashed = false, head = 7 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

function Grid({ x, y, rows, cols, cell, cellH, sw }) {
  const h = cellH ?? cell;
  const lines = [];
  for (let r = 0; r <= rows; r++) lines.push(<line key={`r${r}`} x1={x} y1={y + r * h} x2={x + cols * cell} y2={y + r * h} />);
  for (let c = 0; c <= cols; c++) lines.push(<line key={`c${c}`} x1={x + c * cell} y1={y} x2={x + c * cell} y2={y + rows * h} />);
  return <g strokeWidth={sw}>{lines}</g>;
}

function T({ x, y, children, a = 'middle', s = 11, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl3s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h, label, sub, dashed = false, s = 11 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} strokeDasharray={dashed ? '4 3' : undefined} />
      {label && <T x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} s={s}>{label}</T>}
      {sub && <T x={x + w / 2} y={y + h / 2 + 11} s={s - 1.5}>{sub}</T>}
    </g>
  );
}

function Svg({ w, h, label, children }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dl3s-fig" role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* §1 — Figure 14-1: lines → shapes → objects, and growing receptive fields */
function Cortex() {
  return (
    <Svg w={430} h={200} label="Low-level neurons see lines, mid-level see shapes, high-level see objects; receptive fields on a house grow from small to large">
      {/* the three levels */}
      <line x1={30} y1={34} x2={30} y2={58} />
      <line x1={18} y1={86} x2={42} y2={86} />
      <line x1={20} y1={128} x2={40} y2={108} />
      <T x={30} y={176}>lines</T>
      <Arrow x1={52} y1={96} x2={70} y2={96} />
      <polygon points="92,34 106,58 78,58" />
      <line x1={80} y1={104} x2={104} y2={128} />
      <line x1={104} y1={104} x2={80} y2={128} />
      <T x={92} y={176}>shapes</T>
      <Arrow x1={118} y1={96} x2={136} y2={96} />
      <polyline points="144,100 162,84 180,100" />
      <rect x={148} y={100} width={28} height={22} />
      <T x={162} y={176}>objects</T>
      <line x1={205} y1={20} x2={205} y2={184} strokeDasharray="2 4" />
      {/* the house with nested receptive fields */}
      <polyline points="240,92 320,40 400,92" />
      <rect x={252} y={92} width={136} height={84} />
      <rect x={280} y={130} width={26} height={46} />
      <rect x={330} y={112} width={34} height={26} />
      <ellipse cx={268} cy={82} rx={16} ry={11} strokeDasharray="4 3" />
      <ellipse cx={300} cy={146} rx={34} ry={28} strokeDasharray="4 3" />
      <ellipse cx={330} cy={98} rx={92} ry={78} strokeDasharray="6 4" />
      <T x={250} y={60} s={10}>small</T>
      <T x={264} y={192} s={10}>bigger</T>
      <T x={408} y={34} s={10}>largest</T>
    </Svg>
  );
}

/* §2 — a 3×3 window on a 5×5 input → one output pixel */
function ConvWindow() {
  const c = 26;
  return (
    <Svg w={430} h={190} label="A 3 by 3 filter window on a 5 by 5 input produces one pixel of the output">
      <T x={85} y={20} i>input I</T>
      <Grid x={20} y={30} rows={5} cols={5} cell={c} />
      <rect x={20 + c} y={30 + c} width={3 * c} height={3 * c} strokeWidth={2.8} />
      <circle cx={20 + 2.5 * c} cy={30 + 2.5 * c} r={2.6} fill="currentColor" />
      <T x={20 + 2.5 * c} y={30 + 2.5 * c - 8} s={9}>(x, y)</T>
      <T x={85} y={180} s={10}>3×3 window = filter f</T>
      <T x={222} y={84} s={10}>× weights, add 9</T>
      <Arrow x1={20 + 4 * c + 6} y1={95} x2={278} y2={95} />
      <T x={319} y={46} i>output I′</T>
      <Grid x={280} y={56} rows={3} cols={3} cell={c} />
      {[0, 1, 2].map((k) => (
        <line key={k} x1={280 + c + k * 8 + 2} y1={56 + 2 * c - 2} x2={280 + c + k * 8 + 10} y2={56 + c + 2} />
      ))}
      <rect x={280 + c} y={56 + c} width={c} height={c} strokeWidth={2.4} />
      <T x={319} y={156} s={10} i>I′(x, y)</T>
    </Svg>
  );
}

/* §3 — Figure 14-4 flattened: padding ring, two fields, stride 2, 3×4 output */
function Stride() {
  const c = 20;
  const x0 = 26;
  const y0 = 48;
  return (
    <Svg w={440} h={220} label="A 5 by 7 input with a ring of zero padding, two 3 by 3 receptive fields two columns apart, connected to a 3 by 4 output">
      <rect x={x0} y={y0} width={9 * c} height={7 * c} strokeDasharray="4 3" />
      <Grid x={x0 + c} y={y0 + c} rows={5} cols={7} cell={c} sw={1} />
      <T x={x0 + 4.5 * c} y={y0 + 7 * c + 16} s={10}>5×7 input + zero padding (dashed)</T>
      <rect x={x0} y={y0} width={3 * c} height={3 * c} strokeWidth={2.6} />
      <rect x={x0 + 2 * c} y={y0} width={3 * c} height={3 * c} strokeWidth={2.2} strokeDasharray="6 3" />
      <Arrow x1={x0 + 0.5 * c} y1={y0 - 10} x2={x0 + 2.5 * c} y2={y0 - 10} head={5} />
      <T x={x0 + 1.5 * c} y={y0 - 16} s={10} i>s_w = 2</T>
      <T x={x0 + 6.6 * c} y={y0 - 12} s={10}>3×3 receptive fields</T>
      <Grid x={300} y={70} rows={3} cols={4} cell={22} />
      <rect x={300} y={70} width={22} height={22} strokeWidth={2.6} />
      <rect x={322} y={70} width={22} height={22} strokeWidth={2.2} strokeDasharray="6 3" />
      <line x1={x0 + 3 * c} y1={y0} x2={300} y2={70} strokeDasharray="2 3" />
      <line x1={x0 + 5 * c} y1={y0 + 3 * c} x2={322} y2={92} strokeDasharray="2 3" />
      <T x={344} y={154} s={10}>3×4 output</T>
    </Svg>
  );
}

/* §4 — Figure 14-5: one input, two 7×7 line filters, two feature maps */
function LineFilters() {
  const c = 8;
  const filt = (x, y, vertical) => (
    <g>
      <Grid x={x} y={y} rows={7} cols={7} cell={c} sw={0.8} />
      {Array.from({ length: 7 }, (_, k) => (
        <T key={k} x={vertical ? x + 3.5 * c : x + (k + 0.5) * c} y={vertical ? y + (k + 0.5) * c + 3 : y + 3.5 * c + 3} s={7}>1</T>
      ))}
    </g>
  );
  return (
    <Svg w={440} h={236} label="An input image convolved with a vertical-line filter gives feature map 1 and with a horizontal-line filter gives feature map 2">
      <Box x={20} y={14} w={124} h={62} />
      {[44, 62, 80, 98, 116].map((x) => <line key={x} x1={x} y1={24} x2={x} y2={66} />)}
      <T x={82} y={92} s={10}>Feature map 1</T>
      <Box x={296} y={14} w={124} h={62} />
      {[28, 40, 52, 64].map((y) => <line key={y} x1={306} y1={y} x2={410} y2={y} />)}
      <T x={358} y={92} s={10}>Feature map 2</T>
      <Box x={160} y={164} w={120} h={58} label="input" />
      <Arrow x1={190} y1={164} x2={96} y2={100} />
      <Arrow x1={250} y1={164} x2={344} y2={100} />
      {filt(36, 118, true)}
      <T x={64} y={188} s={9}>vertical filter</T>
      <T x={64} y={199} s={9}>(7×7, 0s elsewhere)</T>
      {filt(348, 118, false)}
      <T x={376} y={188} s={9}>horizontal filter</T>
      <T x={376} y={199} s={9}>(7×7, 0s elsewhere)</T>
    </Svg>
  );
}

/* §5 — Figure 14-6 simplified: RGB sheets, conv layer sheets, one neuron */
function Stack() {
  const sheet = (x, y) => `${x},${y} ${x + 190},${y} ${x + 240},${y - 36} ${x + 50},${y - 36}`;
  const patch = (x, y) => `${x + 70},${y - 10} ${x + 102},${y - 10} ${x + 114},${y - 22} ${x + 82},${y - 22}`;
  const ins = [{ n: 'R', y: 222 }, { n: 'G', y: 236 }, { n: 'B', y: 250 }];
  const maps = [{ n: 'map 1', y: 132 }, { n: 'map 2', y: 118 }, { n: 'map 3', y: 104 }];
  return (
    <Svg w={440} h={262} label="Three input channel sheets R, G, B below three feature-map sheets; a receptive field spans all three channels and feeds one neuron in map 2">
      {[...ins].reverse().map((s) => (
        <g key={s.n}>
          <polygon points={sheet(60, s.y)} />
          <T x={50} y={s.y + 1} a="end" s={10}>{s.n}</T>
        </g>
      ))}
      <polygon points={patch(60, 222)} strokeWidth={2.4} />
      <line x1={130} y1={212} x2={130} y2={240} strokeDasharray="2 3" />
      <line x1={162} y1={212} x2={162} y2={240} strokeDasharray="2 3" />
      <T x={376} y={238} s={10} a="start">input layer</T>
      {maps.map((s) => (
        <g key={s.n}>
          <polygon points={sheet(60, s.y)} />
          <T x={50} y={s.y + 1} a="end" s={10}>{s.n}</T>
        </g>
      ))}
      <T x={376} y={108} s={10} a="start">conv layer 1</T>
      <circle cx={170} cy={104} r={3.4} fill="currentColor" />
      <line x1={130} y1={212} x2={170} y2={104} strokeDasharray="3 3" />
      <line x1={162} y1={212} x2={170} y2={104} strokeDasharray="3 3" />
      <T x={250} y={176} s={10}>receptive field spans R, G and B</T>
      <T x={176} y={60} s={10} a="start">one neuron in map 2</T>
      <line x1={174} y1={64} x2={171} y2={98} strokeDasharray="2 2" />
    </Svg>
  );
}

/* §6 — images tensor → Conv2D → fmaps tensor */
function Cuboid({ x, y, w, h, d }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} />
      <polyline points={`${x},${y} ${x + d},${y - d * 0.7} ${x + w + d},${y - d * 0.7} ${x + w},${y}`} />
      <polyline points={`${x + w + d},${y - d * 0.7} ${x + w + d},${y + h - d * 0.7} ${x + w},${y + h}`} />
    </g>
  );
}

function KerasTensors() {
  return (
    <Svg w={440} h={180} label="The images tensor of shape 2, 70, 120, 3 goes through Conv2D with 32 filters of 7 by 7 to give fmaps of shape 2, 64, 114, 32">
      <Cuboid x={20} y={52} w={92} h={56} d={10} />
      <T x={70} y={130} s={10}>images</T>
      <T x={70} y={144} s={10} b>[2, 70, 120, 3]</T>
      <Arrow x1={138} y1={82} x2={290} y2={82} />
      <T x={214} y={70} s={9.5}>Conv2D(filters=32, kernel_size=7)</T>
      <T x={214} y={102} s={9.5}>kernels (7, 7, 3, 32)</T>
      <T x={214} y={116} s={9.5}>biases (32,)</T>
      <Cuboid x={300} y={58} w={84} h={50} d={34} />
      <T x={350} y={130} s={10}>fmaps</T>
      <T x={350} y={144} s={10} b>[2, 64, 114, 32]</T>
      <T x={220} y={170} s={9}>axes: [batch, height, width, channels]</T>
    </Svg>
  );
}

/* §7 — padding rows in the style of Figures 14-7 / 14-8 */
function PadRow({ y, zl, n, zr, k, s, outs, label, ignored = 0 }) {
  const c = 15;
  const total = zl + n + zr;
  const x0 = 120;
  const cells = [];
  for (let i = 0; i < total; i++) {
    const isZero = i < zl || i >= zl + n;
    cells.push(
      <g key={i}>
        <rect x={x0 + i * c} y={y} width={c} height={c} strokeDasharray={isZero ? '3 2' : undefined} />
        {isZero && <T x={x0 + i * c + c / 2} y={y + 11} s={9}>0</T>}
        {ignored > 0 && i >= zl + n - ignored && i < zl + n && (
          <g>
            <line x1={x0 + i * c + 3} y1={y + 3} x2={x0 + i * c + c - 3} y2={y + c - 3} />
            <line x1={x0 + i * c + c - 3} y1={y + 3} x2={x0 + i * c + 3} y2={y + c - 3} />
          </g>
        )}
      </g>,
    );
  }
  const brackets = [];
  for (let o = 0; o < outs; o++) {
    const bx = x0 + o * s * c + 2;
    const by = y - 6 - (o % 4) * 5;
    if (o > 1 && o < outs - 1) continue;
    brackets.push(<polyline key={o} points={`${bx},${y - 2} ${bx},${by} ${bx + k * c - 4},${by} ${bx + k * c - 4},${y - 2}`} strokeWidth={1.1} />);
  }
  const ox = x0 + (total * c) / 2 - (outs * c) / 2;
  return (
    <g>
      <T x={10} y={y + 11} a="start" s={9.5}>{label}</T>
      {cells}
      {brackets}
      <Grid x={ox} y={y - 52} rows={1} cols={outs} cell={c} />
      <Arrow x1={x0 + (total * c) / 2} y1={y - 26} x2={x0 + (total * c) / 2} y2={y - 36} head={5} />
      <T x={ox + outs * c + 8} y={y - 41} a="start" s={9.5} b>{outs} outputs</T>
      {ignored > 0 && <T x={x0 + (zl + n) * c + 6} y={y + 26} s={9} a="start">ignored</T>}
    </g>
  );
}

function PaddingS1() {
  return (
    <Svg w={440} h={186} label="Figure 14-7: with kernel 7 and stride 1, valid padding gives 4 outputs from 10 inputs; same padding adds 3 zeros each side and gives 10 outputs">
      <PadRow y={66} zl={0} n={10} zr={0} k={7} s={1} outs={4} label='"valid", k=7, s=1' />
      <PadRow y={160} zl={3} n={10} zr={3} k={7} s={1} outs={10} label='"same", k=7, s=1' />
    </Svg>
  );
}

function PaddingS2() {
  return (
    <Svg w={440} h={192} label="Figure 14-8: with kernel 7 and stride 2, valid padding gives 2 outputs and ignores the last input; same padding adds 2 zeros left and 3 right and gives 5 outputs">
      <PadRow y={66} zl={0} n={10} zr={0} k={7} s={2} outs={2} label='"valid", k=7, s=2' ignored={1} />
      <PadRow y={166} zl={2} n={10} zr={3} k={7} s={2} outs={5} label='"same", k=7, s=2' />
    </Svg>
  );
}

/* §8 — what stays in RAM: testing vs training */
function Memory() {
  const xs = [20, 104, 188, 272, 356];
  const names = ['input', 'layer 1', 'layer 2', 'layer 3', 'layer 4'];
  return (
    <Svg w={440} h={172} label="Five layers in a row; testing keeps two consecutive layers in RAM, training keeps every layer">
      <polyline points={`${xs[2]},48 ${xs[2]},38 ${xs[3] + 64},38 ${xs[3] + 64},48`} />
      <T x={(xs[2] + xs[3] + 64) / 2} y={30} s={10}>testing: 2 consecutive layers</T>
      {xs.map((x, i) => (
        <g key={x}>
          <Box x={x} y={56} w={64} h={40} label={names[i]} s={10} />
          {i < xs.length - 1 && <Arrow x1={x + 66} y1={76} x2={x + 82} y2={76} head={5} />}
        </g>
      ))}
      <polyline points={`${xs[0]},104 ${xs[0]},116 ${xs[4] + 64},116 ${xs[4] + 64},104`} />
      <T x={220} y={134} s={10}>training: every layer is kept for the reverse pass</T>
      <T x={220} y={156} s={9}>RAM per layer ≈ height × width × maps × bytes × batch</T>
    </Svg>
  );
}

/* §9 — Figure 14-9 simplified, and global average pooling */
function MaxPool() {
  const c = 28;
  const vals = [['1', '5'], ['3', '2']];
  return (
    <Svg w={420} h={170} label="A 4 by 4 input split into 2 by 2 windows; the window 1, 5, 3, 2 gives 5 under max pooling">
      <Grid x={20} y={30} rows={4} cols={4} cell={c} sw={1} />
      <line x1={20 + 2 * c} y1={30} x2={20 + 2 * c} y2={30 + 4 * c} strokeWidth={2.4} />
      <line x1={20} y1={30 + 2 * c} x2={20 + 4 * c} y2={30 + 2 * c} strokeWidth={2.4} />
      <rect x={20} y={30} width={4 * c} height={4 * c} strokeWidth={2.4} />
      {vals.map((row, r) => row.map((v, k) => <T key={`${r}${k}`} x={20 + (k + 0.5) * c} y={30 + (r + 0.5) * c + 4} s={12}>{v}</T>))}
      <circle cx={20 + 1.5 * c} cy={30 + 0.5 * c} r={10} />
      <T x={76} y={160} s={10}>2×2 windows, stride 2</T>
      <Arrow x1={150} y1={86} x2={248} y2={86} />
      <T x={199} y={76} s={10}>max of each</T>
      <Grid x={260} y={58} rows={2} cols={2} cell={c} />
      <T x={260 + 0.5 * c} y={58 + 0.5 * c + 4} s={12}>5</T>
      <T x={288} y={136} s={10}>2×2 output</T>
    </Svg>
  );
}

function GlobalPool() {
  return (
    <Svg w={420} h={150} label="Three feature maps each averaged to one number by global average pooling">
      {[0, 1, 2].map((k) => <rect key={k} x={40 + k * 12} y={24 + k * 12} width={80} height={80} />)}
      <T x={104} y={136} s={10}>3 maps, each h × w</T>
      <Arrow x1={160} y1={76} x2={262} y2={76} />
      <T x={211} y={66} s={10}>average each map</T>
      <T x={211} y={96} s={9.5}>GlobalAvgPool2D()</T>
      <Grid x={282} y={40} rows={3} cols={1} cell={26} />
      <T x={296} y={136} s={10}>3 numbers</T>
    </Svg>
  );
}

/* §11 — Figure 14-12: conv → pool → conv → pool → FC */
function CnnPipeline() {
  const stack = (x, y, w, h, n, gap) => Array.from({ length: n }, (_, k) => <rect key={k} x={x + k * gap} y={y - k * gap * 0.6} width={w} height={h} />);
  return (
    <Svg w={460} h={176} label="Typical CNN: input, convolution, pooling, convolution, pooling, fully connected, output; maps get smaller and deeper">
      <rect x={14} y={44} width={56} height={56} />
      <T x={42} y={124} s={10}>input</T>
      {stack(88, 44, 14, 56, 4, 5)}
      <T x={110} y={124} s={10}>conv</T>
      {stack(150, 58, 10, 40, 4, 5)}
      <T x={166} y={124} s={10}>pool</T>
      {stack(200, 58, 9, 40, 7, 4)}
      <T x={226} y={124} s={10}>conv</T>
      {stack(268, 66, 7, 28, 7, 4)}
      <T x={288} y={124} s={10}>pool</T>
      {[0, 1].map((col) => [0, 1, 2, 3, 4].map((r) => <circle key={`${col}${r}`} cx={336 + col * 26} cy={44 + r * 14} r={4.5} />))}
      <T x={349} y={124} s={10}>fully conn.</T>
      <Arrow x1={372} y1={72} x2={400} y2={72} />
      <T x={426} y={76} s={10}>softmax</T>
      <Arrow x1={88} y1={150} x2={300} y2={150} />
      <T x={194} y={168} s={10}>smaller and smaller, deeper and deeper</T>
    </Svg>
  );
}

/* §12.1 — LeNet-5 and data augmentation */
function Lenet() {
  const L = [
    { x: 14, w: 40, h: 64, n: 1, t: 'In', s: '32×32' },
    { x: 70, w: 36, h: 58, n: 3, t: 'C1', s: '6@28×28' },
    { x: 128, w: 22, h: 36, n: 3, t: 'S2', s: '6@14×14' },
    { x: 172, w: 18, h: 28, n: 4, t: 'C3', s: '16@10×10' },
    { x: 216, w: 12, h: 16, n: 4, t: 'S4', s: '16@5×5' },
    { x: 262, w: 6, h: 60, n: 1, t: 'C5', s: '120' },
    { x: 314, w: 6, h: 44, n: 1, t: 'F6', s: '84' },
    { x: 366, w: 6, h: 24, n: 1, t: 'Out', s: '10' },
  ];
  return (
    <Svg w={420} h={140} label="LeNet-5: input 32 by 32, C1 6 maps 28 by 28, S2 6 maps 14 by 14, C3 16 maps 10 by 10, S4 16 maps 5 by 5, C5 120, F6 84, output 10">
      {L.map((l, i) => (
        <g key={l.t}>
          {Array.from({ length: l.n }, (_, k) => <rect key={k} x={l.x + k * 3} y={70 - l.h / 2 - k * 3} width={l.w} height={l.h} />)}
          <T x={l.x + l.w / 2 + 3} y={118} s={10} b>{l.t}</T>
          <T x={l.x + l.w / 2 + 3} y={131} s={8.5}>{l.s}</T>
          {i < L.length - 1 && <Arrow x1={l.x + l.w + 3 * l.n + 2} y1={70} x2={L[i + 1].x - 3} y2={70} head={4} />}
        </g>
      ))}
    </Svg>
  );
}

function Shroom({ x, y, flip = false, rot = 0, dx = 0 }) {
  const t = `translate(${x + 40 + dx} ${y + 40}) rotate(${rot}) scale(${flip ? -1 : 1} 1) translate(-40 -40)`;
  return (
    <g transform={t}>
      <path d="M18 42 Q40 6 62 42 Z" />
      <rect x={34} y={42} width={12} height={24} />
      <circle cx={30} cy={32} r={3} fill="currentColor" />
    </g>
  );
}

function Augment() {
  return (
    <Svg w={430} h={150} label="One training image of a mushroom becomes three variants: shifted, rotated and flipped">
      <rect x={14} y={30} width={80} height={80} />
      <Shroom x={14} y={30} />
      <T x={54} y={130} s={10}>original</T>
      <Arrow x1={102} y1={70} x2={136} y2={70} />
      {[
        { x: 146, t: 'shifted', p: { dx: 14 } },
        { x: 242, t: 'rotated', p: { rot: 18 } },
        { x: 338, t: 'flipped', p: { flip: true } },
      ].map((v) => (
        <g key={v.t}>
          <rect x={v.x} y={30} width={80} height={80} />
          <Shroom x={v.x} y={30} {...v.p} />
          <T x={v.x + 40} y={130} s={10}>{v.t}</T>
        </g>
      ))}
    </Svg>
  );
}

/* §12.2 — Figure 14-14: the inception module */
function Inception() {
  const xs = [16, 126, 236, 346];
  const top = ['1×1+1(S)', '3×3+1(S)', '5×5+1(S)', '1×1+1(S)'];
  const bot = [null, '1×1+1(S)', '1×1+1(S)', 'max pool 3×3+1(S)'];
  return (
    <Svg w={460} h={232} label="Inception module: the input feeds four branches — a 1 by 1 conv; 1 by 1 then 3 by 3; 1 by 1 then 5 by 5; a 3 by 3 max pool then 1 by 1 — joined by a depth concat">
      <Box x={170} y={10} w={120} h={30} label="depth concat" />
      {xs.map((x, i) => (
        <g key={x}>
          <Box x={x} y={84} w={96} h={28} label={top[i]} s={10} />
          <Arrow x1={x + 48} y1={84} x2={230 + (i - 1.5) * 26} y2={42} head={5} />
          {bot[i] ? (
            <g>
              <Box x={x} y={142} w={96} h={28} label={bot[i]} s={bot[i].length > 10 ? 8.5 : 10} />
              <Arrow x1={x + 48} y1={142} x2={x + 48} y2={114} head={5} />
              <Arrow x1={230} y1={204} x2={x + 48} y2={172} head={5} />
            </g>
          ) : (
            <Arrow x1={230} y1={204} x2={x + 48} y2={114} head={5} />
          )}
        </g>
      ))}
      <line x1={230} y1={226} x2={230} y2={204} />
      <T x={246} y={224} a="start" s={10}>input (copied to 4 branches)</T>
    </Svg>
  );
}

/* §12.3 — Figure 14-16: plain block vs residual block */
function Residual() {
  const col = (x, skip) => (
    <g>
      <Box x={x} y={176} w={96} h={28} label="Input" />
      <Box x={x} y={124} w={96} h={28} label="Layer 1" />
      <Box x={x} y={74} w={96} h={28} label="Layer 2" />
      <Arrow x1={x + 48} y1={176} x2={x + 48} y2={154} head={5} />
      <Arrow x1={x + 48} y1={124} x2={x + 48} y2={104} head={5} />
      {skip ? (
        <g>
          <Arrow x1={x + 48} y1={74} x2={x + 48} y2={56} head={5} />
          <circle cx={x + 48} cy={46} r={10} />
          <line x1={x + 42} y1={46} x2={x + 54} y2={46} />
          <line x1={x + 48} y1={40} x2={x + 48} y2={52} />
          <Arrow x1={x + 48} y1={36} x2={x + 48} y2={14} head={5} />
          <polyline points={`${x + 30},176 ${x - 12},150 ${x - 12},46 ${x + 36},46`} />
          <polyline points={`${x + 29},42 ${x + 37},46 ${x + 29},50`} />
          <T x={x - 18} y={118} s={9.5} a="end">skip</T>
          <T x={x + 108} y={118} s={10} a="start" i>f(x) = h(x) − x</T>
        </g>
      ) : (
        <g>
          <Arrow x1={x + 48} y1={74} x2={x + 48} y2={14} head={5} />
          <T x={x + 108} y={118} s={10} a="start" i>h(x)</T>
        </g>
      )}
      <T x={x + 62} y={12} s={10} a="start" i>h(x)</T>
      <polyline points={`${x + 100},74 ${x + 104},74 ${x + 104},152 ${x + 100},152`} />
    </g>
  );
  return (
    <Svg w={440} h={214} label="Left: input, layer 1, layer 2 model h of x. Right: the same layers plus a skip connection from the input to a plus node, so the layers model f of x equals h of x minus x">
      {col(24, false)}
      {col(266, true)}
    </Svg>
  );
}

/* §13 — the pretrained-model pipeline */
function Pretrained() {
  const B = [
    { x: 10, l: 'images', s: 'two photos' },
    { x: 120, l: 'Resizing', s: '224×224' },
    { x: 230, l: 'preprocess', s: 'RGB→BGR, centre' },
    { x: 340, l: 'ResNet50', s: 'predict' },
  ];
  return (
    <Svg w={450} h={160} label="Pipeline: images, Resizing to 224 by 224, preprocess_input, ResNet50 predict giving shape 2 by 1000, then decode_predictions top 3">
      {B.map((b, i) => (
        <g key={b.l}>
          <Box x={b.x} y={20} w={96} h={40} label={b.l} sub={b.s} s={10.5} />
          {i < B.length - 1 && <Arrow x1={b.x + 98} y1={40} x2={B[i + 1].x - 2} y2={40} head={5} />}
        </g>
      ))}
      <T x={168} y={76} s={9}>(2, 224, 224, 3)</T>
      <Arrow x1={388} y1={62} x2={388} y2={96} head={5} />
      <T x={400} y={84} s={9} a="start">(2, 1000)</T>
      <Box x={250} y={100} w={176} h={40} label="decode_predictions" sub="top=3 per image" s={10.5} />
    </Svg>
  );
}

/* §14 — two-phase transfer learning */
function Lock({ x, y, open }) {
  return (
    <g>
      <rect x={x} y={y + 6} width={12} height={9} rx={1.5} />
      <path d={open ? `M${x + 3} ${y + 6} V${y + 3} a3 3 0 0 1 6 -1` : `M${x + 3} ${y + 6} V${y + 3} a3 3 0 0 1 6 0 V${y + 6}`} />
    </g>
  );
}

function Transfer() {
  const rows = [
    { l: 'Dense(5, softmax)', p1: 'train', p2: 'train' },
    { l: 'GlobalAveragePooling2D', p1: '—', p2: '—' },
    { l: 'Xception layers 56+', p1: 'lock', p2: 'train' },
    { l: 'Xception layers 0–55', p1: 'lock', p2: 'lock' },
  ];
  const mark = (v, x, y) => (v === 'lock' ? <Lock x={x - 6} y={y - 11} /> : v === 'train' ? <T x={x} y={y + 4} s={10}>trains</T> : <T x={x} y={y + 4} s={10}>—</T>);
  return (
    <Svg w={440} h={236} label="Phase 1: only the new Dense head trains, all Xception layers are frozen, learning rate 0.1 for 3 epochs. Phase 2: layers 56 and up also train, learning rate 0.01 for 10 epochs">
      <T x={300} y={22} s={10} b>phase 1</T>
      <T x={392} y={22} s={10} b>phase 2</T>
      {rows.map((r, i) => {
        const y = 36 + i * 40;
        return (
          <g key={r.l}>
            <Box x={14} y={y} w={210} h={30} label={r.l} s={10.5} />
            {i < rows.length - 1 && <Arrow x1={119} y1={y + 40} x2={119} y2={y + 32} head={4} />}
            {mark(r.p1, 300, y + 15)}
            {mark(r.p2, 392, y + 15)}
          </g>
        );
      })}
      <line x1={246} y1={30} x2={246} y2={196} strokeDasharray="2 3" />
      <T x={300} y={212} s={9.5}>lr 0.1 · 3 epochs</T>
      <T x={392} y={212} s={9.5}>lr 0.01 · 10 epochs</T>
      <T x={119} y={212} s={9.5}>input 224×224×3 ↑</T>
    </Svg>
  );
}

const FIGS = {
  cortex: Cortex,
  convWindow: ConvWindow,
  stride: Stride,
  lineFilters: LineFilters,
  stack: Stack,
  kerasTensors: KerasTensors,
  paddingS1: PaddingS1,
  paddingS2: PaddingS2,
  memory: Memory,
  maxPool: MaxPool,
  globalPool: GlobalPool,
  cnnPipeline: CnnPipeline,
  lenet: Lenet,
  augment: Augment,
  inception: Inception,
  residual: Residual,
  pretrained: Pretrained,
  transfer: Transfer,
};

export function Diagram({ fig }) {
  const Fig = FIGS[fig];
  return Fig ? <Fig /> : null;
}
