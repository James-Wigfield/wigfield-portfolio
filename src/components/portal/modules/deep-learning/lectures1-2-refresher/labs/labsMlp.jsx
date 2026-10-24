import { useId, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq, MNote } from '../stage';
import { Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { mlpBackward, mlpForward, mlpUpdate, ACT, fmt } from '../nn';
import { lin, fnPath } from './plotMath';
import './labsL1.css';

/* ============================================================================
   §1.3 · MLPs, BACKPROPAGATION, ACTIVATION FUNCTIONS  (L1 slides 18–23)
   ----------------------------------------------------------------------------
   BackpropLab     slide 19's four steps as a story on a 2-2-1 sigmoid net
                   (this page's own weights) and one XOR instance x = (1, 0),
                   y = 1: forward pass (values light up) → error → reverse
                   pass (each connection's gradient, width = size) →
                   gradient-descent step (new weights, smaller loss). Hover a
                   connection for its weight and gradient.
   ActivationsLab  Figure 10-8 rebuilt live: Heaviside, ReLU, sigmoid, tanh
                   and their derivatives side by side; where the derivative
                   is (almost) zero is shaded. Opens on sigmoid.
   ========================================================================== */

const NET = { W: [[0.5, -0.4], [0.3, 0.8]], b: [0.1, -0.2], v: [0.7, -0.6], c: 0.05 };
const X = [1, 0];
const Y = 1;
const ETA = 0.5;

const beatsFor = (yhat) => [
  { label: 'forward pass', say: `Feed the instance in and compute every neuron’s output, layer by layer: $\\hat{y} = ${fmt(yhat)}$ for target $y = 1$.` },
  { label: 'error', say: 'Measure the network’s output error, here $\\mathcal{L} = \\tfrac{1}{2}(\\hat{y} - y)^2$.' },
  { label: 'reverse pass', say: 'Go back through the layers measuring each connection’s error contribution (its gradient; thicker = larger).' },
  { label: 'gradient step', say: 'Tweak every weight slightly against its gradient, $w \\leftarrow w - \\eta\\,\\partial\\mathcal{L}/\\partial w$: the error shrinks.' },
];

export function BackpropLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 470;
  const g = useMemo(() => mlpBackward(NET, X, Y), []);
  const BEATS = useMemo(() => beatsFor(g.yhat), [g]);
  const story = useStory(BEATS.length, { ms: 1700 });
  const { beat } = story;
  const [hover, setHover] = useState(null);
  const next = useMemo(() => mlpUpdate(NET, g, ETA), [g]);
  const after = useMemo(() => mlpForward(next, X), [next]);
  const lossAfter = 0.5 * (after.yhat - Y) ** 2;

  const W = narrow ? 330 : 520;
  const H = 330;
  const xs = narrow ? [95, 235] : [170, 350];
  const yIn = 280;
  const yHid = 168;
  const yOut = 60;
  const xOut = W / 2;
  const fwdOn = beat >= 0;
  const bwdOn = beat === 2;
  const stepOn = beat === 3;

  // every connection: from, to, weight, gradient, new weight
  const edges = [
    ...[0, 1].flatMap((i) => [0, 1].map((j) => ({ id: `w${i + 1}${j + 1}`, name: `w_{${i + 1},${j + 1}}`, x1: xs[i], y1: yIn - 17, x2: xs[j], y2: yHid + 18, w: NET.W[i][j], gr: g.gW[i][j], nw: next.W[i][j] }))),
    ...[0, 1].map((j) => ({ id: `v${j + 1}`, name: `v_{${j + 1}}`, x1: xs[j], y1: yHid - 18, x2: xOut, y2: yOut + 18, w: NET.v[j], gr: g.gv[j], nw: next.v[j] })),
  ];
  const maxG = Math.max(...edges.map((e) => Math.abs(e.gr)));
  const ew = (e) => (bwdOn ? 1.5 + 6 * (Math.abs(e.gr) / maxG) : stepOn ? 1.5 + 2.2 * Math.abs(e.nw) : 1.5 + 2.2 * Math.abs(e.w));
  const ecls = (e) => `dl12r-bp__edge${bwdOn ? ' dl12r-bp__edge--bwd' : stepOn ? ' dl12r-bp__edge--step' : fwdOn && (e.id.startsWith('v') || X[Number(e.id[1]) - 1]) ? ' dl12r-bp__edge--fwd' : ''}`;

  const nodeVal = (kind, j) => {
    if (kind === 'in') return fmt(X[j], 0);
    if (kind === 'hid') return bwdOn ? fmt(g.dHid[j], 3) : fmt(stepOn ? after.h[j] : g.h[j]);
    return bwdOn ? fmt(g.dOut, 3) : fmt(stepOn ? after.yhat : g.yhat);
  };
  const nodeCls = (kind) => `dl12r-bp__node${bwdOn && kind !== 'in' ? ' dl12r-bp__node--bwd' : fwdOn ? ' dl12r-bp__node--fwd' : ''}`;
  const tip = hover ? edges.find((e) => e.id === hover) : null;

  return (
    <Stage
      title="Backpropagation in four steps"
      slides="L1 · slides 19–20"
      tryThis="Before pressing ▶, guess which connection gets the biggest gradient; then watch the reverse pass and hover the thick ones."
      story={<StoryBar story={story} beats={BEATS} />}
      caption={`One training instance, one step: the loss falls from ${fmt(g.loss, 3)} to ${fmt(lossAfter, 3)}. Backpropagation repeats this for every instance (slide 19); it works because the sigmoid has a nonzero derivative everywhere (slide 20).`}
      maths={
        <>
          <MLine text={`Forward: $z_j = x_1 w_{1,j} + x_2 w_{2,j} + b_j$, $h_j = \\sigma(z_j)$: $h_1 = ${fmt(g.h[0], 3)}$, $h_2 = ${fmt(g.h[1], 3)}$; $\\hat{y} = \\sigma(v_1h_1 + v_2h_2 + c) = ${fmt(g.yhat, 3)}$.`} />
          <MLine text={`Error: $\\mathcal{L} = \\tfrac{1}{2}(\\hat{y} - y)^2 = \\tfrac{1}{2}(${fmt(g.yhat, 3)} - 1)^2 = ${fmt(g.loss, 4)}$.`} />
          <MEq tex={'\\frac{\\partial \\mathcal{L}}{\\partial z_o} = (\\hat{y} - y)\\,\\sigma(z_o)(1 - \\sigma(z_o)) \\qquad \\frac{\\partial \\mathcal{L}}{\\partial v_j} = \\frac{\\partial \\mathcal{L}}{\\partial z_o} h_j \\qquad \\frac{\\partial \\mathcal{L}}{\\partial w_{i,j}} = \\frac{\\partial \\mathcal{L}}{\\partial z_o} v_j\\, h_j(1 - h_j)\\, x_i'} />
          <MLine text={`Reverse: $\\partial\\mathcal{L}/\\partial z_o = ${fmt(g.dOut, 4)}$; $\\partial\\mathcal{L}/\\partial v_1 = ${fmt(g.gv[0], 4)}$, $\\partial\\mathcal{L}/\\partial v_2 = ${fmt(g.gv[1], 4)}$; $\\partial\\mathcal{L}/\\partial w_{1,1} = ${fmt(g.gW[0][0], 4)}$, $\\partial\\mathcal{L}/\\partial w_{1,2} = ${fmt(g.gW[0][1], 4)}$, and $\\partial\\mathcal{L}/\\partial w_{2,j} = 0$ because $x_2 = 0$.`} />
          <MLine text={`Step ($\\eta = ${ETA}$): $v_1 \\leftarrow ${fmt(NET.v[0])} - ${ETA}(${fmt(g.gv[0], 4)}) = ${fmt(next.v[0], 3)}$, … then $\\hat{y} = ${fmt(after.yhat, 3)}$ and $\\mathcal{L} = ${fmt(lossAfter, 4)}$.`} />
          <MNote text={'The chain rule uses slide 20’s $\\sigma^{\\prime}(z) = \\sigma(z)(1 - \\sigma(z))$. The weights, $\\eta$ and the instance are this page’s own; the loss is the one slide 11’s handwriting uses.'} />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} role="group" aria-label={`A 2-2-1 network, step ${beat + 1} of 4: ${BEATS[Math.max(0, beat)].label}`}>
          {edges.map((e) => (
            <g key={e.id} className="dl12r-bp__hit" onPointerEnter={() => setHover(e.id)} onPointerLeave={() => setHover(null)}>
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="transparent" strokeWidth={14} />
              <line className={ecls(e)} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} style={{ strokeWidth: ew(e) }} />
            </g>
          ))}
          {/* the error at the top */}
          <g className={`dl12r-fade${beat >= 1 ? '' : ' dl12r-hide'}`}>
            <text x={xOut + 30} y={yOut - 26} className="dl12r-t dl12r-t--s">target y = 1</text>
            <text x={xOut + 30} y={yOut - 10} className="dl12r-t dl12r-t--b dl12r-t--bwd">
              {stepOn ? `loss ${fmt(lossAfter, 3)} (was ${fmt(g.loss, 3)})` : `loss ½(ŷ − y)² = ${fmt(g.loss, 3)}`}
            </text>
          </g>
          {/* nodes */}
          {[0, 1].map((j) => (
            <g key={`in${j}`} className={nodeCls('in')}>
              <circle cx={xs[j]} cy={yIn} r={17} />
              <text x={xs[j]} y={yIn + 4.5} textAnchor="middle" className="dl12r-bp__val">{nodeVal('in', j)}</text>
              <text x={xs[j]} y={yIn + 34} textAnchor="middle" className="dl12r-t dl12r-t--s">x{j === 0 ? '₁' : '₂'}</text>
            </g>
          ))}
          {[0, 1].map((j) => (
            <g key={`h${j}`} className={nodeCls('hid')}>
              <circle cx={xs[j]} cy={yHid} r={18} />
              <text x={xs[j]} y={yHid + 4.5} textAnchor="middle" className="dl12r-bp__val">{nodeVal('hid', j)}</text>
              <text x={j === 0 ? xs[j] - 26 : xs[j] + 26} y={yHid + 4} textAnchor={j === 0 ? 'end' : 'start'} className="dl12r-t dl12r-t--s">{bwdOn ? `δh${j + 1}` : `h${j + 1}`}</text>
            </g>
          ))}
          <g className={nodeCls('out')}>
            <circle cx={xOut} cy={yOut} r={18} />
            <text x={xOut} y={yOut + 4.5} textAnchor="middle" className="dl12r-bp__val">{nodeVal('out', 0)}</text>
            <text x={xOut - 26} y={yOut + 4} textAnchor="end" className="dl12r-t dl12r-t--s">{bwdOn ? 'δout' : 'ŷ'}</text>
          </g>
          <text x={12} y={yIn + 4} className="dl12r-t dl12r-t--xs">input</text>
          <text x={12} y={yHid + 4} className="dl12r-t dl12r-t--xs">hidden</text>
          <text x={12} y={yOut + 4} className="dl12r-t dl12r-t--xs">output</text>
          {tip && (
            <Tip
              x={(tip.x1 + tip.x2) / 2}
              y={(tip.y1 + tip.y2) / 2}
              text={stepOn ? `${tip.id}: ${fmt(tip.w)} → ${fmt(tip.nw, 3)}` : bwdOn ? `∂L/∂${tip.id} = ${fmt(tip.gr, 4)}` : `${tip.id} = ${fmt(tip.w)}`}
            />
          )}
        </svg>
      </div>
    </Stage>
  );
}

/* ── Figure 10-8, live ──────────────────────────────────────────────────── */
const ACTS = [
  { k: 'heaviside', sw: '--dlv-red', dead: () => true },
  { k: 'relu', sw: '--dlv-magenta', dead: (z) => z < 0 },
  { k: 'sigmoid', sw: '--dlv-green', dead: (z) => ACT.sigmoid.d(z) < 0.05 },
  { k: 'tanh', sw: '--dlv-blue', dead: (z) => ACT.tanh.d(z) < 0.05 },
];
const Z = [-4.5, 4.5];

// the z-intervals where `dead` holds, sampled
function deadSpans(dead) {
  const spans = [];
  let start = null;
  const n = 180;
  for (let i = 0; i <= n; i++) {
    const z = Z[0] + ((Z[1] - Z[0]) * i) / n;
    const d = dead(z);
    if (d && start === null) start = z;
    if ((!d || i === n) && start !== null) { spans.push([start, d ? z : z - (Z[1] - Z[0]) / n]); start = null; }
  }
  return spans;
}

function Panel({ title, x0, w, h, yDom, ticksY, sel, deriv, hz, onHover }) {
  const ref = useRef(null);
  const clip = useId().replace(/:/g, '');
  const sx = lin(Z[0], Z[1], x0 + 30, x0 + w - 6);
  const sy = lin(yDom[0], yDom[1], h - 26, 22);
  const cur = ACTS.find((a) => a.k === sel);
  const spans = deriv ? deadSpans(cur.dead) : [];
  const move = (e) => {
    const p = svgPoint(e, ref.current?.ownerSVGElement);
    if (!p) return;
    const z = sx.inv(p.x);
    onHover(z >= Z[0] && z <= Z[1] ? z : null);
  };
  const f = (a) => (deriv ? ACT[a.k].d : ACT[a.k].f);
  const val = hz === null ? null : f(cur)(hz);
  return (
    <g ref={ref}>
      <text x={x0 + 30} y={12} className="dl12r-t dl12r-t--b">{title}</text>
      {spans.map(([a, b], i) => (
        <rect key={i} className="dl12r-sat" x={sx(a)} y={sy(yDom[1])} width={Math.max(1, sx(b) - sx(a))} height={sy(yDom[0]) - sy(yDom[1])} />
      ))}
      {ticksY.map((t) => (
        <g key={t}>
          <line className="dl12r-gridline" x1={sx(Z[0])} x2={sx(Z[1])} y1={sy(t)} y2={sy(t)} />
          <text x={x0 + 24} y={sy(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
        </g>
      ))}
      {[-4, -2, 0, 2, 4].map((t) => (
        <text key={t} x={sx(t)} y={h - 10} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
      ))}
      <line className="dl12r-axisline" x1={sx(0)} x2={sx(0)} y1={sy(yDom[0])} y2={sy(yDom[1])} />
      <line className="dl12r-axisline" x1={sx(Z[0])} x2={sx(Z[1])} y1={sy(0)} y2={sy(0)} />
      <clipPath id={clip}><rect x={sx(Z[0])} y={sy(yDom[1])} width={sx(Z[1]) - sx(Z[0])} height={sy(yDom[0]) - sy(yDom[1])} /></clipPath>
      {ACTS.map((a) => {
        const on = a.k === sel;
        // Heaviside: draw its two flat pieces apart (no slanted riser); ReLU′ likewise
        const jump = a.k === 'heaviside' || (deriv && a.k === 'relu');
        const d = jump
          ? `${fnPath(f(a), lin(Z[0], -0.001, sx(Z[0]), sx(-0.001)), sy)}${fnPath(f(a), lin(0, Z[1], sx(0), sx(Z[1])), sy)}`
          : fnPath(f(a), sx, sy);
        return <path key={a.k} clipPath={`url(#${clip})`} className={`dl12r-curve${on ? '' : ' dl12r-curve--dim'}`} d={d} style={{ stroke: `var(${a.sw})`, strokeWidth: on ? 3 : undefined }} />;
      })}
      <rect className="dl12r-plotgrid" x={sx(Z[0])} y={sy(yDom[1])} width={sx(Z[1]) - sx(Z[0])} height={sy(yDom[0]) - sy(yDom[1])} fill="transparent" onPointerMove={move} onPointerLeave={() => onHover(null)} />
      {hz !== null && val !== null && Number.isFinite(val) && (
        <g pointerEvents="none">
          <line className="dl12r-hair" x1={sx(hz)} x2={sx(hz)} y1={sy(yDom[0])} y2={sy(yDom[1])} />
          <circle className="dl12r-pt" cx={sx(hz)} cy={sy(Math.max(yDom[0], Math.min(yDom[1], val)))} r={4.5} style={{ fill: `var(${cur.sw})` }} />
          <Tip x={sx(hz)} y={sy(Math.max(yDom[0], Math.min(yDom[1], val))) - 6} text={`z = ${fmt(hz, 1)}: ${fmt(val, 3)}`} />
        </g>
      )}
    </g>
  );
}

export function ActivationsLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const [sel, setSel] = useState('sigmoid');
  const [hz, setHz] = useState(null);
  const W = narrow ? 320 : 620;
  const pw = narrow ? 320 : 305;
  const ph = 210;
  const H = narrow ? ph * 2 + 16 : ph;
  const cur = ACT[sel];
  const MATHS = {
    heaviside: { f: '\\text{heaviside}(z) = 0 \\text{ if } z < 0,\\ 1 \\text{ if } z \\ge 0', d: 'Its derivative is 0 wherever it exists (undefined at $z = 0$): no gradient to work with (slide 20).' },
    relu: { f: '\\text{ReLU}(z) = \\max(0, z)', d: 'Derivative 0 for $z < 0$ and 1 for $z > 0$; not differentiable at 0, but fast and with no maximum output (slide 21).' },
    sigmoid: { f: '\\sigma(z) = \\frac{1}{1 + \\exp(-z)} \\qquad \\sigma^{\\prime}(z) = \\sigma(z)\\left(1 - \\sigma(z)\\right)', d: 'The derivative peaks at 0.25 at $z = 0$ and fades to almost 0 at both ends (Figure 10-8, slide 22; slide 62 says such functions saturate).' },
    tanh: { f: '\\tanh(z) = 2\\sigma(2z) - 1', d: 'S-shaped like the sigmoid, from −1 to +1; its derivative peaks at 1.0 (Figure 10-8). (Its formula, $1 - \\tanh^2(z)$, is this page’s, not the slide’s.)' },
  };
  return (
    <Stage
      title="Activation functions and their derivatives"
      slides="L1 · slides 20–22"
      tryThis="Pick a function and look at the right-hand panel: where is its derivative (almost) zero? Hover to read values."
      caption="Gradient descent needs a derivative: the step has none, the sigmoid has one everywhere but it fades where the curve flattens (shaded). That is why the step was replaced (slide 20) and why ReLU helps (slide 21)."
      own="curves computed live · Figure 10-8 rebuilt"
      maths={
        <>
          <MEq tex={MATHS[sel].f} />
          <MLine text={MATHS[sel].d} />
          <MNote text="Shaded: derivative below 0.05 (sigmoid, tanh) or exactly 0 (Heaviside, ReLU for $z < 0$), this page’s threshold." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-picker" role="group" aria-label="Activation function">
          {ACTS.map((a) => (
            <button key={a.k} type="button" className="dl12r-pickbtn" aria-pressed={sel === a.k} style={{ '--sw': `var(${a.sw})` }} onClick={() => setSel(a.k)}>
              <i aria-hidden="true" /> {ACT[a.k].name}
            </button>
          ))}
        </div>
        <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} role="group" aria-label={`${cur.name} and its derivative`}>
          <Panel title="Activation functions" x0={0} w={pw} h={ph} yDom={[-1.2, 2.2]} ticksY={[-1, 0, 1, 2]} sel={sel} deriv={false} hz={hz} onHover={setHz} />
          <g transform={narrow ? `translate(0 ${ph + 16})` : `translate(${pw + 10} 0)`}>
            <Panel title="Derivatives" x0={0} w={pw} h={ph} yDom={[-0.2, 1.2]} ticksY={[0, 0.25, 0.5, 1]} sel={sel} deriv hz={hz} onHover={setHz} />
          </g>
        </svg>
      </div>
    </Stage>
  );
}
