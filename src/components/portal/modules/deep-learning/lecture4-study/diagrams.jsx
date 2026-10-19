/* ============================================================================
   LECTURE 4 STUDY — "DRAW THIS" DIAGRAMS
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per notebook figure: boxes, circles, arrows and
   short labels in currentColor — no colour, gradients or 3D shading — so each
   can be copied onto paper in about two minutes. Deliberately simpler than the
   interactive labs. <Diagram fig="…" /> picks one by key.
   ========================================================================== */

const SW = 1.4;

function Arrow({ x1, y1, x2, y2, dashed = false, head = 7, w }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g strokeWidth={w}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

// an arrowhead at the end of a path that arrives travelling in direction `dir`
function Head({ x, y, dir = 'up', s = 6 }) {
  const pts = {
    up: `${x - s * 0.7},${y + s} ${x},${y} ${x + s * 0.7},${y + s}`,
    down: `${x - s * 0.7},${y - s} ${x},${y} ${x + s * 0.7},${y - s}`,
    right: `${x - s},${y - s * 0.7} ${x},${y} ${x - s},${y + s * 0.7}`,
    left: `${x + s},${y - s * 0.7} ${x},${y} ${x + s},${y + s * 0.7}`,
  }[dir];
  return <polyline points={pts} />;
}

function T({ x, y, children, a = 'middle', s = 11, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl4s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h, label, sub, dashed = false, s = 11, r = 3 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} strokeDasharray={dashed ? '4 3' : undefined} />
      {label && <T x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} s={s}>{label}</T>}
      {sub && <T x={x + w / 2} y={y + h / 2 + 11} s={s - 1.5}>{sub}</T>}
    </g>
  );
}

function Svg({ w, h, label, children }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dl4s-fig" role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// a neuron as Figure 15-1 draws it: a circle, Σ below the line, a ramp above
function N({ cx, cy, r = 14 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
      <polyline points={`${cx - r * 0.55},${cy - r * 0.3} ${cx},${cy - r * 0.3} ${cx + r * 0.5},${cy - r * 0.75}`} />
      <T x={cx} y={cy + r * 0.66} s={9}>Σ</T>
    </g>
  );
}

// an element-wise multiplication node (⊗)
function Mul({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r={8} />
      <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} />
      <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} />
    </g>
  );
}

/* §1 — Figure 15-1: a recurrent neuron, and the same neuron unrolled */
function Unroll() {
  const xs = [148, 222, 296, 370];
  const cy = 92;
  return (
    <Svg w={440} h={196} label="Left: one neuron with input x below, output y-hat above and a loop from its output back to its input. Right: four copies of the neuron in a row for time steps 0 to 3, each feeding its output into the next, with 0 fed into the first">
      {/* rolled */}
      <N cx={40} cy={cy} />
      <Arrow x1={40} y1={150} x2={40} y2={cy + 16} head={5} />
      <T x={40} y={166} i>x</T>
      <Arrow x1={40} y1={cy - 15} x2={40} y2={36} head={5} />
      <T x={40} y={28} i>ŷ</T>
      <path d={`M44 ${cy - 15} C44 ${cy - 40} 78 ${cy - 40} 78 ${cy} S56 ${cy + 40} 48 ${cy + 16}`} />
      <Head x={48} y={cy + 15} s={5} />
      <line x1={100} y1={18} x2={100} y2={180} strokeDasharray="2 4" />
      {/* unrolled */}
      <T x={118} y={cy + 44} b>0</T>
      <path d={`M118 ${cy + 34} C${xs[0] - 22} ${cy + 34} ${xs[0] - 6} ${cy + 34} ${xs[0] - 5} ${cy + 15}`} />
      <Head x={xs[0] - 5} y={cy + 14} s={5} />
      {xs.map((x, k) => (
        <g key={x}>
          <N cx={x} cy={cy} />
          <Arrow x1={x + 4} y1={150} x2={x + 4} y2={cy + 16} head={5} />
          <T x={x + 4} y={166} i>x({k})</T>
          <Arrow x1={x} y1={cy - 15} x2={x} y2={36} head={5} />
          <T x={x} y={28} i>ŷ({k})</T>
          {k < xs.length - 1 ? (
            <g>
              <path d={`M${x + 4} ${cy - 15} C${x + 4} ${cy - 36} ${x + 37} ${cy - 36} ${x + 37} ${cy} S${x + 69} ${cy + 36} ${x + 69} ${cy + 15}`} />
              <Head x={x + 69} y={cy + 14} s={5} />
            </g>
          ) : (
            <path d={`M${x + 4} ${cy - 15} C${x + 4} ${cy - 36} ${x + 37} ${cy - 36} ${x + 37} ${cy + 20}`} strokeDasharray="3 3" />
          )}
        </g>
      ))}
      <Arrow x1={120} y1={184} x2={420} y2={184} head={7} w={2.2} />
      <T x={400} y={176} b>Time</T>
    </Svg>
  );
}

/* §2 — Figure 15-3: the hidden state h and the output ŷ are different arrows */
function HiddenState() {
  const xs = [176, 270, 364];
  const cy = 92;
  return (
    <Svg w={440} h={190} label="Left: one cell with input x, output y-hat and a loop labelled h. Right: three cells unrolled; x of t below and y-hat of t above each, with h of 0 and h of 1 passed sideways between them">
      <Box x={22} y={cy - 18} w={48} h={36} r={8} />
      <Arrow x1={46} y1={150} x2={46} y2={cy + 18} head={5} />
      <T x={46} y={166} b>x</T>
      <Arrow x1={46} y1={cy - 18} x2={46} y2={36} head={5} />
      <T x={46} y={28} b>ŷ</T>
      <path d={`M58 ${cy - 18} C58 ${cy - 40} 96 ${cy - 40} 96 ${cy} S70 ${cy + 40} 62 ${cy + 18}`} />
      <Head x={62} y={cy + 18} s={5} />
      <T x={104} y={cy + 4} b a="start">h</T>
      <line x1={124} y1={18} x2={124} y2={176} strokeDasharray="2 4" />
      {xs.map((x, k) => (
        <g key={x}>
          <Box x={x - 24} y={cy - 18} w={48} h={36} r={8} />
          <Arrow x1={x} y1={150} x2={x} y2={cy + 18} head={5} />
          <T x={x} y={166} b>x({k})</T>
          <Arrow x1={x} y1={cy - 18} x2={x} y2={36} head={5} />
          <T x={x} y={28} b>ŷ({k})</T>
          {k < xs.length - 1 && (
            <g>
              <Arrow x1={x + 24} y1={cy} x2={xs[k + 1] - 24} y2={cy} head={5} />
              <T x={(x + xs[k + 1]) / 2} y={cy + 18} b>h({k})</T>
            </g>
          )}
        </g>
      ))}
      <line x1={xs[2] + 26} y1={cy} x2={xs[2] + 44} y2={cy} strokeDasharray="3 3" />
      <Arrow x1={140} y1={182} x2={420} y2={182} head={7} w={2.2} />
      <T x={400} y={174} b>Time</T>
    </Svg>
  );
}

/* §3 — the slide-10 weather RNN: three cells, two outputs discarded */
function WeatherRnn() {
  const xs = [118, 232, 346];
  const cy = 100;
  return (
    <Svg w={440} h={200} label="Three RNN cells of 5 neurons; h of 0 enters the first; inputs x of 0, 1, 2 in R to the 4 below; outputs y-hat of 1 and 2 discarded, y-hat of 3 in R squared kept">
      <Arrow x1={14} y1={cy} x2={xs[0] - 40} y2={cy} head={5} />
      <T x={34} y={cy - 8} s={10} b>hᵀ(0)</T>
      {xs.map((x, k) => {
        const last = k === xs.length - 1;
        return (
          <g key={x}>
            <Box x={x - 40} y={cy - 20} w={80} h={40} label="RNN cell" sub="(5 neurons)" s={10.5} r={8} />
            <Arrow x1={x} y1={164} x2={x} y2={cy + 20} head={5} />
            <T x={x} y={180} s={10}>xᵀ({k}) ∈ ℝ⁴</T>
            <Arrow x1={x} y1={cy - 20} x2={x} y2={46} head={5} />
            <T x={x} y={38} s={10}>ŷᵀ({k + 1}) ∈ ℝ²</T>
            {!last && (
              <g>
                <T x={x} y={22} s={9} i>(Discarded)</T>
                <Arrow x1={x + 40} y1={cy} x2={xs[k + 1] - 40} y2={cy} head={5} />
                <T x={(x + xs[k + 1]) / 2} y={cy - 8} s={10} b>hᵀ({k + 1})</T>
              </g>
            )}
          </g>
        );
      })}
    </Svg>
  );
}

/* a small unrolled chain: n cells from x0, inputs below, outputs above */
function Chain({ x0, y, n, gap = 34, w = 22, ins, outs, ghostOut = [], ghostIn = [], dashedIn = [], label, r = 4 }) {
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const x = x0 + k * gap;
        const ghost = ghostOut.includes(k);
        return (
          <g key={k}>
            <rect x={x} y={y} width={w} height={w} rx={r} />
            {k < n - 1 && <Arrow x1={x + w} y1={y + w / 2} x2={x + gap} y2={y + w / 2} head={4} />}
            {ins[k] != null && (
              <g opacity={ghostIn.includes(k) ? 0.4 : 1}>
                <Arrow x1={x + w / 2} y1={y + w + 18} x2={x + w / 2} y2={y + w} head={4} dashed={dashedIn.includes(k)} />
                <T x={x + w / 2} y={y + w + 29} s={8.5}>{ins[k]}</T>
              </g>
            )}
            {outs[k] != null && (
              <g opacity={ghost ? 0.4 : 1}>
                <Arrow x1={x + w / 2} y1={y} x2={x + w / 2} y2={y - 16} head={4} dashed={ghost} />
                <T x={x + w / 2} y={y - 21} s={8.5}>{outs[k]}</T>
              </g>
            )}
          </g>
        );
      })}
      {label && <T x={x0 + ((n - 1) * gap + w) / 2} y={y + w + 46} s={9.5} b>{label}</T>}
    </g>
  );
}

/* §4 — Figure 15-4: the four input/output set-ups */
function SeqModes() {
  return (
    <Svg w={440} h={300} label="Four small unrolled RNNs as Figure 15-4 draws them: sequence-to-sequence, sequence-to-vector with three ignored outputs, vector-to-sequence, and an encoder followed by a decoder fed zeros">
      <Chain x0={14} y={44} n={5} gap={40} ins={['X(0)', 'X(1)', 'X(2)', 'X(3)', 'X(4)']} outs={['Ŷ(0)', 'Ŷ(1)', 'Ŷ(2)', 'Ŷ(3)', 'Ŷ(4)']} label="seq → seq" />
      <Chain x0={250} y={44} n={4} ins={['X(0)', 'X(1)', 'X(2)', 'X(3)']} outs={['Ŷ(0)', 'Ŷ(1)', 'Ŷ(2)', 'Ŷ(3)']} ghostOut={[0, 1, 2]} label="seq → vector" />
      <rect x={244} y={12} width={102} height={28} rx={4} strokeDasharray="3 3" />
      <T x={295} y={8} s={8} i>ignored outputs</T>
      <Chain x0={20} y={192} n={4} ins={['X', 'X', 'X', 'X']} outs={['Ŷ(0)', 'Ŷ(1)', 'Ŷ(2)', 'Ŷ(3)']} label="vector → seq" />
      <Chain x0={232} y={192} n={2} ins={['X(0)', 'X(1)']} outs={['Ŷ(0)', 'Ŷ(1)']} ghostOut={[0, 1]} />
      <Arrow x1={288} y1={203} x2={300} y2={203} head={4} />
      <Chain x0={300} y={192} n={3} ins={['0', '0', '0']} outs={["Ŷ'(0)", "Ŷ'(1)", "Ŷ'(2)"]} ghostIn={[0, 1, 2]} />
      <rect x={226} y={157} width={65} height={97} rx={5} strokeDasharray="3 3" />
      <rect x={296} y={157} width={114} height={97} rx={5} strokeDasharray="3 3" />
      <T x={259} y={268} s={8.5} i>encoder</T>
      <T x={352} y={268} s={8.5} i>decoder</T>
      <T x={318} y={288} s={9.5} b>encoder–decoder</T>
    </Svg>
  );
}

/* §5 — Figure 15-5: forward (dashed →) and gradient (solid ←) through time */
function Bptt() {
  const xs = [30, 110, 190, 270, 350];
  const cy = 120;
  // each Ŷ term of the loss is its own label, so the arrows land on it whatever the font
  const lossX = (k) => 306 + (k - 2) * 40;
  return (
    <Svg w={440} h={212} label="Five cells labelled W,b; dashed forward arrows to the right, solid gradient arrows to the left; the loss at the top uses outputs 2, 3 and 4">
      <T x={284} y={18} s={10.5} a="end">𝓛(Y(2), Y(3), Y(4);</T>
      {[2, 3, 4].map((k) => <T key={k} x={lossX(k)} y={18} s={10.5}>{`Ŷ(${k})${k < 4 ? ',' : ')'}`}</T>)}
      {xs.map((x, k) => {
        const inLoss = k >= 2;
        return (
          <g key={x}>
            <Box x={x} y={cy - 16} w={50} h={32} label="W,b" s={10} r={6} />
            <Arrow x1={x + 25} y1={cy + 52} x2={x + 25} y2={cy + 16} head={4} dashed />
            <T x={x + 25} y={cy + 64} s={9}>X({k})</T>
            <Arrow x1={x + 20} y1={cy - 16} x2={x + 20} y2={cy - 46} head={4} dashed />
            <T x={x + 25} y={cy - 52} s={9}>Ŷ({k}){inLoss ? '' : ' ×'}</T>
            {inLoss && <Arrow x1={x + 31} y1={cy - 46} x2={x + 31} y2={cy - 18} head={4} />}
            {inLoss && <Arrow x1={x + 22} y1={cy - 62} x2={lossX(k) - 6} y2={24} head={4} dashed />}
            {inLoss && <Arrow x1={lossX(k) + 4} y1={24} x2={x + 30} y2={cy - 62} head={4} />}
            {k < xs.length - 1 && (
              <g>
                <Arrow x1={x + 50} y1={cy - 7} x2={xs[k + 1]} y2={cy - 7} head={4} dashed />
                <Arrow x1={xs[k + 1]} y1={cy + 7} x2={x + 50} y2={cy + 7} head={4} />
              </g>
            )}
          </g>
        );
      })}
      <T x={40} y={204} s={9} a="start" i>dashed = forward pass · solid = gradients · × = not in the loss</T>
    </Svg>
  );
}

/* §6 — naive forecast: a weekly pattern, its 7-day-lagged copy, one error */
function Naive() {
  const day = (d) => 40 + d * 24;
  const val = (d) => ([5, 6].includes(((d % 7) + 7) % 7) ? 120 : 52 + (((d % 4) + 4) % 4) * 9);
  const pts = (shift) => Array.from({ length: 15 }, (_, d) => `${day(d)},${val(d - shift) + (shift ? 4 : 0)}`).join(' ');
  return (
    <Svg w={440} h={190} label="Two weeks of ridership with weekend dips, the same curve shifted right by 7 days as a dotted line, and the gap between them at one day marked as the error">
      <line x1={30} y1={150} x2={410} y2={150} />
      <line x1={30} y1={30} x2={30} y2={150} />
      <polyline points={pts(0)} />
      <polyline points={pts(7)} strokeDasharray="2 3" />
      <line x1={day(10)} y1={val(10)} x2={day(10)} y2={val(3) + 4} strokeWidth={2.4} />
      <T x={day(10) + 6} y={(val(10) + val(3)) / 2 + 12} s={10} a="start" i>e(t)</T>
      <T x={40} y={168} s={9.5} a="start">week 1</T>
      <T x={208} y={168} s={9.5} a="start">week 2</T>
      <T x={300} y={24} s={9.5}>dotted = copy of 7 days ago</T>
      <T x={220} y={186} s={10} b>MAE = mean |e(t)|,  e(t) = y(t) − y(t−7)</T>
    </Svg>
  );
}

/* §7 — slide 19's windows */
function Windows() {
  const c = 30;
  const x0 = 60;
  const wins = [[0, 1, 2], [1, 2, 3], [2, 3, 4]];
  return (
    <Svg w={440} h={210} label="The series 0 to 5 as six cells; three windows of length 3 bracketed underneath, each with an arrow to its target 3, 4 or 5; the first two windows form a batch of 2, the third a batch of 1">
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <rect x={x0 + v * c} y={20} width={c} height={c} />
          <T x={x0 + v * c + c / 2} y={40} s={12}>{v}</T>
        </g>
      ))}
      <T x={30} y={40} s={9.5} a="end">series</T>
      {wins.map((w, k) => {
        const y = 78 + k * 36;
        return (
          <g key={k}>
            <polyline points={`${x0 + w[0] * c + 2},${y - 8} ${x0 + w[0] * c + 2},${y} ${x0 + (w[2] + 1) * c - 2},${y} ${x0 + (w[2] + 1) * c - 2},${y - 8}`} />
            <T x={x0 + w[0] * c + 1.5 * c} y={y + 14} s={9.5}>[{w.join(', ')}]</T>
            <Arrow x1={x0 + (w[2] + 1) * c + 4} y1={y - 2} x2={x0 + (w[2] + 1) * c + 52} y2={y - 2} head={4} />
            <circle cx={x0 + (w[2] + 1) * c + 62} cy={y - 2} r={9} />
            <T x={x0 + (w[2] + 1) * c + 62} y={y + 2} s={10}>{w[2] + 1}</T>
          </g>
        );
      })}
      <polyline points="372,70 382,70 382,122 372,122" />
      <T x={388} y={100} s={9.5} a="start">batch (2, 3)</T>
      <polyline points="372,142 382,142 382,158 372,158" />
      <T x={388} y={154} s={9.5} a="start">batch (1, 3)</T>
      <T x={220} y={200} s={10} i>sequence_length = 3, targets = my_series[3:], batch_size = 2</T>
    </Svg>
  );
}

/* §8 — univar_model: SimpleRNN(32) unrolled, last state into Dense(1) */
function Univar() {
  const xs = [40, 120, 200, 320];
  const cy = 104;
  return (
    <Svg w={440} h={204} label="SimpleRNN with 32 neurons unrolled over the window: x(0) to x(55) in, a 32-wide state passed sideways, the last state into Dense(1) giving one output">
      {xs.map((x, k) => (
        <g key={x}>
          <Box x={x} y={cy - 18} w={60} h={36} label="RNN(32)" s={10} r={6} />
          <Arrow x1={x + 30} y1={cy + 56} x2={x + 30} y2={cy + 18} head={4} />
          <T x={x + 30} y={cy + 68} s={9.5}>{['x(0)', 'x(1)', 'x(2)', 'x(55)'][k]}</T>
          {k < 2 && <Arrow x1={x + 60} y1={cy} x2={xs[k + 1]} y2={cy} head={4} />}
        </g>
      ))}
      <line x1={260} y1={cy} x2={300} y2={cy} strokeDasharray="3 3" />
      <Arrow x1={300} y1={cy} x2={320} y2={cy} head={4} />
      <T x={150} y={cy - 26} s={9}>state: 32 numbers</T>
      <Arrow x1={350} y1={cy - 18} x2={350} y2={56} head={4} />
      <Box x={318} y={24} w={64} h={30} label="Dense(1)" s={10} />
      <Arrow x1={382} y1={39} x2={412} y2={39} head={4} />
      <T x={420} y={43} s={10} a="start" i>ŷ</T>
      <T x={30} y={198} s={9.5} a="start">input shape [None, 1]: any number of days, 1 value each</T>
    </Svg>
  );
}

/* §9 — Figure 15-10: a deep RNN unrolled (columns 0, 1, …, t−1, t) */
function DeepRnn() {
  const cols = [30, 106, 222, 298];
  const names = ['0', '1', 't−1', 't'];
  const rows = [140, 96, 52];
  return (
    <Svg w={440} h={204} label="Three layers by four time steps of cells, 0, 1, t minus 1 and t: inputs X at the bottom, outputs Y-hat at the top, upward arrows between layers and rightward arrows along each layer, dashed across the skipped steps">
      {cols.map((x, k) => (
        <g key={x}>
          {rows.map((y, l) => (
            <g key={y}>
              <rect x={x} y={y - 12} width={44} height={24} rx={5} />
              {l < rows.length - 1 && <Arrow x1={x + 22} y1={y - 12} x2={x + 22} y2={rows[l + 1] + 12} head={4} />}
              {k < cols.length - 1 && <Arrow x1={x + 44} y1={y} x2={cols[k + 1]} y2={y} head={4} dashed={k === 1} />}
            </g>
          ))}
          <Arrow x1={x + 22} y1={186} x2={x + 22} y2={152} head={4} />
          <T x={x + 22} y={199} s={9.5}>X({names[k]})</T>
          <Arrow x1={x + 22} y1={40} x2={x + 22} y2={14} head={4} />
          <T x={x + 28} y={14} s={9.5} a="start">Ŷ({names[k]})</T>
        </g>
      ))}
      <T x={356} y={144} s={9.5} a="start">layer 1</T>
      <T x={356} y={100} s={9.5} a="start">layer 2</T>
      <T x={356} y={56} s={9.5} a="start">layer 3</T>
    </Svg>
  );
}

/* §10 — the 5 input columns, and two alternative output layers */
function Mulvar() {
  const cols = ['bus', 'rail', 'A', 'U', 'W'];
  return (
    <Svg w={440} h={180} label="One input row with five columns bus, rail, A, U, W feeding SimpleRNN(32); mulvar_model ends in Dense(1) for rail, or, as a separate model, multask_model ends in Dense(2) for bus and rail">
      {cols.map((c, k) => (
        <g key={c}>
          <rect x={20 + k * 40} y={70} width={40} height={30} />
          <T x={40 + k * 40} y={90} s={10}>{c}</T>
        </g>
      ))}
      <T x={120} y={60} s={9.5}>one day’s input row (5 columns)</T>
      <T x={180} y={118} s={8.5}>next_day_type one-hot</T>
      <Arrow x1={222} y1={85} x2={252} y2={85} head={4} />
      <Box x={252} y={67} w={80} h={36} label="SimpleRNN(32)" s={9.5} r={6} />
      <Arrow x1={332} y1={78} x2={360} y2={50} head={4} />
      <Arrow x1={332} y1={92} x2={360} y2={126} head={4} dashed />
      <Box x={360} y={30} w={70} h={28} label="Dense(1)" s={9.5} />
      <T x={395} y={22} s={9}>mulvar_model → rail</T>
      <T x={350} y={92} s={9} i>or</T>
      <Box x={360} y={112} w={70} h={28} label="Dense(2)" s={9.5} dashed />
      <T x={395} y={156} s={9}>multask_model → bus, rail</T>
      <T x={20} y={172} s={9} a="start" i>two separate models: the same input, a different output layer</T>
    </Svg>
  );
}

/* §11 — slide 34's loop: predict, append, repeat */
function Loop() {
  const c = 13;
  return (
    <Svg w={440} h={176} label="X as a row of 56 boxes into the model, the one-day prediction appended as a new last box, repeated 14 times so X grows from 56 to 70 days">
      {Array.from({ length: 12 }, (_, k) => <rect key={k} x={20 + k * c} y={40} width={c} height={c} />)}
      <T x={20 + 6 * c} y={32} s={9.5}>X: 56 days</T>
      <T x={20 + 12 * c + 8} y={51} s={9} a="start">…</T>
      <rect x={20 + 12 * c + 22} y={40} width={c} height={c} strokeWidth={2.6} />
      <T x={20 + 12 * c + 28} y={68} s={8.5}>new</T>
      <Arrow x1={230} y1={46} x2={268} y2={46} head={4} />
      <Box x={268} y={30} w={90} h={32} label="univar_model" s={9.5} r={6} />
      <Arrow x1={358} y1={46} x2={392} y2={46} head={4} />
      <T x={410} y={50} s={10} i>ŷ</T>
      <path d="M410 56 C410 110 240 110 216 62" />
      <Head x={217} y={62} dir="up" s={5} />
      <T x={312} y={104} s={9.5} i>append to X, repeat ×14</T>
      <T x={220} y={140} s={10} b>X.shape (1, 56, 1) → (1, 57, 1) → … → (1, 70, 1)</T>
      <T x={220} y={162} s={9}>the predictions fill days 56 … 69 (counting from 0)</T>
    </Svg>
  );
}

/* §11 — split_inputs_and_targets on one 70-day window */
function AheadSplit() {
  const cols = ['bus', 'rail', 'A', 'U', 'W'];
  const x0 = 70;
  const cw = 34;
  const top = 26;
  const inH = 100;
  const outH = 36;
  return (
    <Svg w={440} h={196} label="One 70-day window as a table with five columns: days 0 to 55 of every column bracketed as inputs, the rail column of days 56 to 69 bracketed as targets">
      {cols.map((c, k) => (
        <g key={c}>
          <T x={x0 + k * cw + cw / 2} y={top - 6} s={9.5}>{c}</T>
          <rect x={x0 + k * cw} y={top} width={cw} height={inH} />
          <rect x={x0 + k * cw} y={top + inH} width={cw} height={outH} strokeDasharray={k === 1 ? undefined : '3 3'} strokeWidth={k === 1 ? 2.6 : 1.2} />
        </g>
      ))}
      <T x={x0 - 8} y={top + 14} s={9} a="end">day 0</T>
      <T x={x0 - 8} y={top + inH - 4} s={9} a="end">day 55</T>
      <T x={x0 - 8} y={top + inH + 14} s={9} a="end">day 56</T>
      <T x={x0 - 8} y={top + inH + outH - 4} s={9} a="end">day 69</T>
      <polyline points={`${x0 + 5 * cw + 8},${top} ${x0 + 5 * cw + 16},${top} ${x0 + 5 * cw + 16},${top + inH} ${x0 + 5 * cw + 8},${top + inH}`} />
      <T x={x0 + 5 * cw + 24} y={top + inH / 2} s={10} a="start">inputs (56, 5)</T>
      <Arrow x1={x0 + 2 * cw + 60} y1={top + inH + outH + 18} x2={x0 + cw + cw / 2} y2={top + inH + outH + 2} head={4} />
      <T x={x0 + 2 * cw + 64} y={top + inH + outH + 22} s={10} a="start">targets (14,) = rail column (target_col=1)</T>
    </Svg>
  );
}

/* §11 (Read) — slide 39's sequence-to-sequence preview */
function Seq2SeqPreview() {
  const c = 15;
  const x0 = 40;
  const row = (y, start, label) => (
    <g>
      {Array.from({ length: 21 }, (_, d) => (
        <rect key={d} x={x0 + d * c} y={y} width={c} height={c} strokeDasharray={d >= start && d < start + 10 ? undefined : d >= start + 10 && d < start + 20 ? '2 2' : undefined} strokeWidth={d >= start && d < start + 20 ? 1.6 : 0.6} />
      ))}
      <T x={x0 + (start + 5) * c} y={y - 5} s={9}>in: days {start}–{start + 9}</T>
      <T x={x0 + (start + 15) * c} y={y - 5} s={9}>out: days {start + 10}–{start + 19}</T>
      <T x={x0 - 6} y={y + 11} s={9} a="end">{label}</T>
    </g>
  );
  return (
    <Svg w={420} h={110} label="Slide 39's example: days 0 to 9 forecast days 10 to 19; then days 1 to 10 forecast days 11 to 20, and so on">
      {row(26, 0, 'step 1')}
      {row(72, 1, 'step 2')}
      <T x={x0 + 10.5 * c} y={106} s={9} i>… and so on, one step later each time (slide 39) — encoder–decoders come in topic 8</T>
    </Svg>
  );
}

/* §12 — batch norm vs layer norm: which cells share one mean and variance */
function NormAxes() {
  const grid = (x, shade) => (
    <g>
      {Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => (
        <rect key={`${r}${c}`} x={x + c * 26} y={40 + r * 24} width={26} height={24} strokeWidth={(shade === 'col' && c === 1) || (shade === 'row' && r === 1) ? 2.6 : 0.9} />
      )))}
    </g>
  );
  return (
    <Svg w={440} h={190} label="Two batch-by-features grids: batch norm normalises one feature column across the batch; layer norm normalises one instance row across the features">
      {grid(56, 'col')}
      <T x={121} y={28} s={10} b>batch norm</T>
      <T x={121} y={152} s={9.5}>one feature, across the batch ↓</T>
      {grid(282, 'row')}
      <T x={347} y={28} s={10} b>layer norm</T>
      <T x={347} y={152} s={9.5}>one instance, across the features →</T>
      <T x={50} y={92} s={9} a="end">batch ↓</T>
      <T x={276} y={92} s={9} a="end">batch ↓</T>
      <T x={121} y={176} s={9}>features →</T>
      <T x={347} y={176} s={9}>features →</T>
    </Svg>
  );
}

/* §13.1 — Figure 15-12: the LSTM cell */
function LstmCell() {
  const fc = [
    { x: 110, n: 'f', a: 'σ' },
    { x: 160, n: 'g', a: 'tanh' },
    { x: 210, n: 'i', a: 'σ' },
    { x: 260, n: 'o', a: 'σ' },
  ];
  return (
    <Svg w={440} h={236} label="LSTM cell: the long-term state c runs along the top through the forget-gate multiply and an add; four FC layers f, g, i, o take h(t−1) and x(t); g times i is added to c; tanh of c times o gives h(t)">
      <rect x={70} y={30} width={300} height={170} rx={10} />
      <T x={360} y={194} s={9.5} a="end" b>LSTM cell</T>
      {/* long-term line */}
      <Arrow x1={20} y1={52} x2={420} y2={52} head={6} />
      <T x={30} y={44} s={10} a="start">c(t−1)</T>
      <T x={412} y={44} s={10} a="end">c(t)</T>
      <Mul x={122} y={52} />
      <T x={108} y={46} s={8.5} a="end">forget</T>
      <circle cx={222} cy={52} r={8} />
      <T x={222} y={56} s={11}>+</T>
      {/* FC layers */}
      {fc.map((b) => (
        <g key={b.n}>
          <Box x={b.x - 4} y={140} w={40} h={24} label={`FC ${b.a}`} s={8.5} />
          <T x={b.x + 30} y={134} s={9.5} a="start" b>{b.n}</T>
        </g>
      ))}
      <Arrow x1={126} y1={140} x2={122} y2={60} head={4} />
      <Mul x={222} y={100} />
      <T x={210} y={92} s={8.5} a="end">input</T>
      <path d="M176 140 V100 H214" /><Head x={214} y={100} dir="right" s={4} />
      <Arrow x1={226} y1={140} x2={222} y2={108} head={4} />
      <Arrow x1={222} y1={92} x2={222} y2={60} head={4} />
      {/* output path */}
      <line x1={244} y1={52} x2={244} y2={78} />
      <rect x={238} y={78} width={12} height={20} />
      <T x={256} y={92} s={8} a="start">tanh</T>
      <Mul x={300} y={110} />
      <T x={300} y={96} s={8.5}>output</T>
      <path d="M244 98 V110 H292" /><Head x={292} y={110} dir="right" s={4} />
      <Arrow x1={276} y1={140} x2={296} y2={117} head={4} />
      <Arrow x1={308} y1={110} x2={420} y2={110} head={6} />
      <T x={412} y={102} s={10} a="end">h(t)</T>
      <Arrow x1={340} y1={110} x2={340} y2={14} head={5} />
      <T x={348} y={16} s={10} a="start">ŷ(t)</T>
      {/* inputs fanning into every FC layer */}
      <path d="M20 186 H96" />
      <T x={30} y={180} s={10} a="start">h(t−1)</T>
      {fc.map((b) => <line key={`h${b.n}`} x1={96} y1={186} x2={b.x + 10} y2={164} />)}
      <path d="M190 226 V196" />
      <T x={196} y={224} s={10} a="start">x(t)</T>
      {fc.map((b) => <line key={`x${b.n}`} x1={190} y1={196} x2={b.x + 22} y2={164} />)}
    </Svg>
  );
}

/* §13.2 — the four FC layers and where each goes */
function LstmGates() {
  const rows = [
    { n: 'f(t)', a: 'σ', to: '→ forget ⊗ on c(t−1): what to erase' },
    { n: 'i(t)', a: 'σ', to: '→ input ⊗ with g(t): what to add' },
    { n: 'g(t)', a: 'tanh', to: '→ input ⊗: the new memories' },
    { n: 'o(t)', a: 'σ', to: '→ output ⊗ on tanh(c(t)): what to read' },
  ];
  return (
    <Svg w={440} h={196} label="x(t) and h(t−1) feed four FC layers: f, i and o use the logistic function, g uses tanh; each output's destination is listed">
      <T x={34} y={60} s={10}>x(t)</T>
      <T x={34} y={150} s={10}>h(t−1)</T>
      {rows.map((r, k) => {
        const y = 22 + k * 44;
        return (
          <g key={r.n}>
            <line x1={58} y1={56} x2={110} y2={y + 14} />
            <line x1={58} y1={146} x2={110} y2={y + 14} />
            <Box x={110} y={y} w={56} h={28} label={`FC ${r.a}`} s={9.5} />
            <Arrow x1={166} y1={y + 14} x2={196} y2={y + 14} head={4} />
            <T x={202} y={y + 18} s={10} a="start" b>{r.n}</T>
            <T x={240} y={y + 18} s={9} a="start">{r.to}</T>
          </g>
        );
      })}
    </Svg>
  );
}

/* §14 — Figure 15-13: the GRU cell */
function GruCell() {
  return (
    <Svg w={440} h={236} label="GRU cell: one state line h along the top; z multiplies h(t−1); one minus z multiplies g; the two are added to give h(t); r multiplies h(t−1) before the g layer">
      <rect x={70} y={30} width={300} height={170} rx={10} />
      <T x={360} y={194} s={9.5} a="end" b>GRU cell</T>
      <Arrow x1={20} y1={52} x2={420} y2={52} head={6} />
      <T x={30} y={44} s={10} a="start">h(t−1)</T>
      <T x={412} y={44} s={10} a="end">h(t)</T>
      <Mul x={190} y={52} />
      <circle cx={300} cy={52} r={8} />
      <T x={300} y={56} s={11}>+</T>
      <Arrow x1={330} y1={52} x2={330} y2={14} head={5} />
      <T x={338} y={16} s={10} a="start">ŷ(t)</T>
      {/* r gate on h(t−1) feeding the g layer */}
      <path d="M86 52 V180 H180" />
      <Arrow x1={110} y1={180} x2={110} y2={165} head={4} />
      <Arrow x1={180} y1={180} x2={180} y2={165} head={4} />
      <Mul x={120} y={110} />
      <path d="M86 110 H112" />
      <Box x={102} y={140} w={36} h={24} label="FC" s={9} />
      <T x={92} y={152} s={9.5} a="end" b>r</T>
      <T x={120} y={176} s={8.5} i>σ</T>
      <Arrow x1={120} y1={140} x2={120} y2={118} head={4} />
      {/* z gate */}
      <Box x={172} y={140} w={36} h={24} label="FC" s={9} />
      <T x={162} y={152} s={9.5} a="end" b>z</T>
      <T x={190} y={176} s={8.5} i>σ</T>
      <Arrow x1={190} y1={140} x2={190} y2={60} head={4} />
      <path d="M190 96 H222" />
      <Box x={222} y={86} w={40} h={20} label="1 − z" s={9} />
      <Arrow x1={262} y1={96} x2={292} y2={96} head={4} />
      <Mul x={300} y={96} />
      <Arrow x1={300} y1={88} x2={300} y2={60} head={4} />
      {/* g layer */}
      <Arrow x1={128} y1={110} x2={278} y2={136} head={4} />
      <Box x={278} y={130} w={44} h={24} label="FC" s={9} />
      <T x={330} y={144} s={9.5} a="start" b>g</T>
      <T x={308} y={168} s={8.5} a="start" i>tanh</T>
      <Arrow x1={300} y1={130} x2={300} y2={104} head={4} />
      <path d="M232 226 V190 H300 V154" />
      <line x1={232} y1={190} x2={190} y2={164} />
      <line x1={232} y1={190} x2={120} y2={164} />
      <T x={238} y={224} s={10} a="start">x(t)</T>
    </Svg>
  );
}

/* §15 — a kernel of 3 sliding with stride 1 and stride 2 */
function Conv1d() {
  const c = 26;
  const x0 = 120;
  const row = (y, s, n, label) => (
    <g>
      <T x={x0 - 10} y={y + 17} s={9.5} a="end">{label}</T>
      {Array.from({ length: 8 }, (_, d) => <rect key={d} x={x0 + d * c} y={y} width={c} height={c} />)}
      {Array.from({ length: n }, (_, k) => (
        <polyline key={k} points={`${x0 + k * s * c + 3},${y + c + 3 + (k % 2) * 5} ${x0 + k * s * c + 3},${y + c + 8 + (k % 2) * 5} ${x0 + (k * s + 3) * c - 3},${y + c + 8 + (k % 2) * 5} ${x0 + (k * s + 3) * c - 3},${y + c + 3 + (k % 2) * 5}`} />
      ))}
      <T x={x0 + 8 * c + 10} y={y + 17} s={10} a="start" b>→ {n} outputs</T>
    </g>
  );
  return (
    <Svg w={440} h={176} label="Eight input days with a kernel of three: stride 1 gives six outputs, stride 2 gives three">
      {row(20, 1, 6, 'kernel 3, stride 1')}
      {row(100, 2, 3, 'kernel 3, stride 2')}
      <T x={220} y={170} s={9.5} i>out = ⌊(8 − 3) / s⌋ + 1</T>
    </Svg>
  );
}

const FIGS = {
  unroll: Unroll,
  hiddenState: HiddenState,
  weatherRnn: WeatherRnn,
  seqModes: SeqModes,
  bptt: Bptt,
  naive: Naive,
  windows: Windows,
  univar: Univar,
  deepRnn: DeepRnn,
  mulvar: Mulvar,
  loop: Loop,
  aheadSplit: AheadSplit,
  seq2seqPreview: Seq2SeqPreview,
  normAxes: NormAxes,
  lstmCell: LstmCell,
  lstmGates: LstmGates,
  gruCell: GruCell,
  conv1d: Conv1d,
};

export function Diagram({ fig }) {
  const Fig = FIGS[fig];
  return Fig ? <Fig /> : null;
}
