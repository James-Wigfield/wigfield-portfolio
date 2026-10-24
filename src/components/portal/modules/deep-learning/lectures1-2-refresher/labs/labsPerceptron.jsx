import { useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq, MNote } from '../stage';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { trainPerceptron, accuracy, tlu, xorMlp, XOR_DATA, fmt } from '../nn';
import { lin, clipLine } from './plotMath';
import './labsL1.css';

/* ============================================================================
   §1.2 · TRAINING A PERCEPTRON, AND XOR  (L1 slides 9–17)
   ----------------------------------------------------------------------------
   PerceptronLab   six points (this page's own), one TLU, slide 10's rule run
                   epoch by epoch from a wrong starting line. Each beat is an
                   epoch: the line after it (the one before, dashed), and the
                   points it got wrong ringed. Opens converged. Drag a point
                   and the run replays; drag one across and no line can
                   separate them (the XOR problem in miniature).
   XorLab          the four XOR points. "One TLU": drag the line; at most 3
                   of 4 are ever right. "MLP (Figure 10-6b)": the two hidden
                   TLUs' lines with slide 17's weights, the band between them
                   is ŷ = 1, and a point can be traced through the network.
   The running example of Part 1: two inputs (x₁, x₂), two classes.
   ========================================================================== */

const DOM = [0, 4];
const START = { w: [1, -1], b: 0 };
const ETAS = [0.25, 0.5, 1];
const INIT = [
  { x: [1.0, 3.0], y: 1 },
  { x: [2.0, 3.5], y: 1 },
  { x: [1.5, 2.0], y: 1 },
  { x: [3.0, 1.0], y: 0 },
  { x: [3.5, 2.5], y: 0 },
  { x: [2.5, 0.5], y: 0 },
];
const MAX_EPOCHS = 12;

function geom(narrow) {
  const W = narrow ? 320 : 420;
  const H = narrow ? 300 : 340;
  const pad = { l: 34, r: 14, t: 14, b: 34 };
  const sx = lin(DOM[0], DOM[1], pad.l, W - pad.r);
  const sy = lin(DOM[0], DOM[1], H - pad.b, pad.t);
  return { W, H, sx, sy, narrow };
}

// The ŷ = 1 half of the plot box, as a polygon (for a faint tint).
function halfPlane(w, b, sx, sy, dom = DOM) {
  const corners = [[dom[0], dom[0]], [dom[1], dom[0]], [dom[1], dom[1]], [dom[0], dom[1]]];
  const z = (p) => w[0] * p[0] + w[1] * p[1] + b;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const c = corners[(i + 1) % 4];
    const za = z(a);
    const zc = z(c);
    if (za >= 0) out.push(a);
    if ((za >= 0) !== (zc >= 0)) {
      const t = za / (za - zc);
      out.push([a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]);
    }
  }
  return out.length >= 3 ? out.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ') : '';
}

function Axes({ sx, sy, labels = true }) {
  const t = [0, 1, 2, 3, 4];
  return (
    <g className="dl12r-axes">
      <rect x={sx(DOM[0])} y={sy(DOM[1])} width={sx(DOM[1]) - sx(DOM[0])} height={sy(DOM[0]) - sy(DOM[1])} className="dl12r-plotbox" />
      {labels && t.map((v) => (
        <g key={v}>
          <text x={sx(v)} y={sy(DOM[0]) + 14} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{v}</text>
          <text x={sx(DOM[0]) - 7} y={sy(v) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{v}</text>
        </g>
      ))}
      <text x={sx(DOM[1])} y={sy(DOM[0]) + 28} textAnchor="end" className="dl12r-t dl12r-t--s">x₁</text>
      <text x={sx(DOM[0]) - 24} y={sy(DOM[1]) + 4} className="dl12r-t dl12r-t--s">x₂</text>
    </g>
  );
}

// A class-1 point is a circle, a class-0 point a square (shape + colour).
export function Dot({ x, y, cls, r = 7, wrong = false, ring = false, hot = false, className = '' }) {
  return (
    <g className={`dl12r-dot dl12r-dot--c${cls}${wrong ? ' dl12r-dot--wrong' : ''}${hot ? ' dl12r-dot--hot' : ''} ${className}`}>
      {ring && <circle cx={x} cy={y} r={r + 6} className="dl12r-dot__ring" />}
      {cls === 1
        ? <circle cx={x} cy={y} r={r} />
        : <rect x={x - r * 0.88} y={y - r * 0.88} width={r * 1.76} height={r * 1.76} rx={2} />}
    </g>
  );
}

function Line({ w, b, sx, sy, dashed = false, className = '' }) {
  const seg = clipLine(w, b, DOM, DOM);
  if (!seg) return null;
  return (
    <line
      className={`dl12r-dline${dashed ? ' dl12r-dline--old' : ''} ${className}`}
      x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])}
    />
  );
}

// group the run's updates into epochs: the line after each epoch, the points
// it got wrong
function epochsOf(data, eta) {
  const r = trainPerceptron(data, { w: START.w, b: START.b, eta, maxEpochs: MAX_EPOCHS });
  const eps = [];
  let cur = { w: START.w, b: START.b };
  for (let e = 0; e < r.epochs; e++) {
    const ups = r.updates.filter((u) => u.epoch === e);
    const before = cur;
    if (ups.length) cur = ups[ups.length - 1].after;
    eps.push({ e, ups, before, after: cur });
  }
  return { ...r, eps };
}

/* ── the perceptron learning rule ─────────────────────────────────────── */
export function PerceptronLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const G = geom(useWidth(wrap) < 470);
  const [data, setData] = useState(INIT);
  const [eta, setEta] = useState(0.5);
  const [drag, setDrag] = useState(null);
  const run = useMemo(() => epochsOf(data, eta), [data, eta]);
  const beats = useMemo(() => [
    { label: 'start', say: `A wrong starting line: $\\mathbf{w} = (${START.w.join(', ')})$, $b = ${START.b}$. The shaded side predicts $\\hat{y} = 1$.` },
    ...run.eps.map((ep) => ({
      label: `epoch ${ep.e + 1}`,
      say: ep.ups.length
        ? `${ep.ups.length} wrong ${ep.ups.length === 1 ? 'prediction' : 'predictions'}: each moves every weight by $\\eta(y - \\hat{y})x_i$ (ringed), and the line swings.`
        : 'No mistakes in a whole epoch: every point is on its side, so training stops.',
    })),
  ], [run]);
  const story = useStory(beats.length, { ms: 1300 });
  const beat = Math.min(story.beat, beats.length - 1);
  const ep = beat >= 1 ? run.eps[beat - 1] : null;
  const shown = ep ? ep.after : START;
  const prev = ep ? ep.before : null;
  const ringed = new Set(ep ? ep.ups.map((u) => u.idx) : []);
  const right = accuracy(data, shown.w, shown.b);
  const first = ep?.ups[0];

  const onDown = (i) => (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(i);
  };
  const onMove = (e) => {
    if (drag === null) return;
    const p = svgPoint(e, svgRef.current);
    if (!p) return;
    const x = Math.round(Math.max(0.2, Math.min(3.8, G.sx.inv(p.x))) * 4) / 4;
    const y = Math.round(Math.max(0.2, Math.min(3.8, G.sy.inv(p.y))) * 4) / 4;
    setData((d) => d.map((q, j) => (j === drag ? { ...q, x: [x, y] } : q)));
  };
  const onUp = () => {
    if (drag !== null) story.go(9999);
    setDrag(null);
  };
  const onKey = (i) => (e) => {
    const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
    if (!d) return;
    e.preventDefault();
    setData((dd) => dd.map((q, j) => (j === i ? { ...q, x: [Math.max(0.2, Math.min(3.8, q.x[0] + d[0])), Math.max(0.2, Math.min(3.8, q.x[1] + d[1]))] } : q)));
    story.go(9999);
  };

  return (
    <Stage
      title="The perceptron rule, one epoch at a time"
      slides="L1 · slides 10–12"
      tryThis="Press ▶ to watch the line swing towards each mistake; then drag a point to the other side and see whether any line still works."
      story={<StoryBar story={story} beats={beats} numbered={false} />}
      caption={run.converged
        ? `Converged after ${run.epochs} epochs and ${run.updates.length} updates: the data are linearly separable, so the rule finds *a* line (slide 12: not a unique one).`
        : `No line separates these points: after ${MAX_EPOCHS} epochs the rule is still making mistakes, which is exactly the XOR weakness (slide 16).`}
      maths={
        <>
          <MEq tex={'w_{i,j}^{(\\text{next step})} = w_{i,j} + \\eta\\left(y_j - \\hat{y}_j\\right)x_i'} />
          {first ? (
            <>
              <MLine text={`First mistake of this epoch: $\\mathbf{x} = (${first.x.map((v) => fmt(v)).join(', ')})$, target $y = ${first.y}$, but $z = \\mathbf{w}^T\\mathbf{x} + b = ${fmt(first.before.w[0] * first.x[0] + first.before.w[1] * first.x[1] + first.before.b)}$, so $\\hat{y} = \\text{heaviside}(z) = ${first.yhat}$ and $y - \\hat{y} = ${first.err > 0 ? '+1' : '-1'}$.`} />
              <MLine text={`$w_1 \\leftarrow ${fmt(first.before.w[0])} + ${eta}\\,(${first.err > 0 ? '+1' : '-1'})\\,(${fmt(first.x[0])}) = ${fmt(first.after.w[0])}$, $w_2 \\leftarrow ${fmt(first.before.w[1])} + ${eta}\\,(${first.err > 0 ? '+1' : '-1'})\\,(${fmt(first.x[1])}) = ${fmt(first.after.w[1])}$, $b \\leftarrow ${fmt(first.before.b)} + ${eta}\\,(${first.err > 0 ? '+1' : '-1'}) = ${fmt(first.after.b)}$.`} />
            </>
          ) : (
            <MLine text="Step to an epoch with a mistake to see one update written out." />
          )}
          <p className="dl12r-mnote">The bias is updated like a weight whose input is always 1 (this page’s choice; slide 10 writes the rule for the weights). Points, start line and η are this page’s own.</p>
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-switch" role="group" aria-label="Learning rate η">
          {ETAS.map((v) => (
            <button key={v} type="button" className={`dl12r-switch__opt${eta === v ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={eta === v} onClick={() => { setEta(v); story.go(9999); }}>
              η = {v}
            </button>
          ))}
        </div>
        <svg
          ref={svgRef}
          className="dl12r-svg dl12r-pc"
          viewBox={`0 0 ${G.W} ${G.H}`}
          style={{ maxWidth: G.W + 40 }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="group"
          aria-label={`Perceptron: after ${beats[beat].label}, w = (${fmt(shown.w[0])}, ${fmt(shown.w[1])}), b = ${fmt(shown.b)}; ${right} of ${data.length} points on the right side`}
        >
          <Axes sx={G.sx} sy={G.sy} />
          <polygon className="dl12r-half" points={halfPlane(shown.w, shown.b, G.sx, G.sy)} />
          {prev && <Line w={prev.w} b={prev.b} sx={G.sx} sy={G.sy} dashed />}
          <Line w={shown.w} b={shown.b} sx={G.sx} sy={G.sy} />
          {data.map((p, i) => {
            const wrong = tlu(shown.w, shown.b, p.x) !== p.y;
            return (
              <g
                key={i}
                className="dl12r-drag"
                role="button"
                tabIndex={0}
                aria-label={`Point ${i + 1}, class ${p.y}, at (${p.x[0]}, ${p.x[1]}); arrow keys move it`}
                onPointerDown={onDown(i)}
                onKeyDown={onKey(i)}
              >
                <circle cx={G.sx(p.x[0])} cy={G.sy(p.x[1])} r={16} fill="transparent" />
                <Dot x={G.sx(p.x[0])} y={G.sy(p.x[1])} cls={p.y} wrong={wrong} ring={ringed.has(i)} hot={drag === i} />
              </g>
            );
          })}
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">{right}/{data.length} on the right side</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><Dot x={8} y={8} cls={1} r={5} /></svg> y = 1</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><Dot x={8} y={8} cls={0} r={5} /></svg> y = 0</span>
          <span className="dl12r-legend__ring">ringed: updated this epoch</span>
        </p>
      </div>
    </Stage>
  );
}

/* ── XOR: one line can't, a hidden layer can ─────────────────────────── */
const XOR_DOM = [-0.5, 1.5];

export function XorLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const narrow = useWidth(wrap) < 470;
  const W = narrow ? 320 : 360;
  const H = narrow ? 300 : 320;
  const sx = lin(XOR_DOM[0], XOR_DOM[1], 34, W - 14);
  const sy = lin(XOR_DOM[0], XOR_DOM[1], H - 34, 14);
  const [mode, setMode] = useState('mlp');
  // one TLU: the line through two draggable handles
  const [hA, setHA] = useState([-0.3, 0.9]);
  const [hB, setHB] = useState([1.3, 0.4]);
  const [drag, setDrag] = useState(null);
  const [best, setBest] = useState(0);
  const [pick, setPick] = useState(1);

  // the handles' line as w, b (positive side = to the left of A→B)
  const w = [-(hB[1] - hA[1]), hB[0] - hA[0]];
  const b = -(w[0] * hA[0] + w[1] * hA[1]);
  const right1 = Math.max(accuracy(XOR_DATA, w, b), accuracy(XOR_DATA, w.map((v) => -v), -b));
  const shownBest = Math.max(best, right1);

  const onMove = (e) => {
    if (!drag) return;
    const p = svgPoint(e, svgRef.current);
    if (!p) return;
    const q = [Math.max(-0.45, Math.min(1.45, sx.inv(p.x))), Math.max(-0.45, Math.min(1.45, sy.inv(p.y)))];
    if (drag === 'A') setHA(q);
    else setHB(q);
  };
  const onUp = () => {
    if (drag) setBest(shownBest);
    setDrag(null);
  };
  const nudge = (which) => (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    const f = (h) => [Math.max(-0.45, Math.min(1.45, h[0] + d[0])), Math.max(-0.45, Math.min(1.45, h[1] + d[1]))];
    if (which === 'A') setHA(f);
    else setHB(f);
    setBest(shownBest);
  };

  const seg = (ww, bb) => clipLine(ww, bb, XOR_DOM, XOR_DOM);
  const L = (ww, bb, cls) => {
    const s = seg(ww, bb);
    return s ? <line className={cls} x1={sx(s[0][0])} y1={sy(s[0][1])} x2={sx(s[1][0])} y2={sy(s[1][1])} /> : null;
  };
  const trace = xorMlp(XOR_DATA[pick].x);
  const P = XOR_DATA[pick];

  // the MLP's ŷ = 1 band: between h₂ (x₁ + x₂ = ½) and h₁ (x₁ + x₂ = 3/2),
  // clipped to the plot box
  const band = [[-0.5, 1.0], [1.0, -0.5], [1.5, -0.5], [1.5, 0], [0, 1.5], [-0.5, 1.5]];
  // one TLU: shade the side that gets more points right
  const flip = accuracy(XOR_DATA, w, b) < accuracy(XOR_DATA, w.map((v) => -v), -b);
  const sw = flip ? w.map((v) => -v) : w;
  const sb = flip ? -b : b;

  return (
    <Stage
      title="XOR: one line can’t, a hidden layer can"
      slides="L1 · slides 16–17"
      tryThis="In “one TLU”, drag the two handles and try to put every circle on one side; then switch back to the MLP and click a point to trace it."
      caption={mode === 'one'
        ? 'Three of four is the best any single line can do: no straight line separates XOR’s classes (Minsky and Papert, slide 16).'
        : 'Each hidden TLU draws one line; the output TLU fires only between them, so (0, 1) and (1, 0) give 1 and (0, 0), (1, 1) give 0 (slide 17).'}
      challenge={mode === 'one' ? { text: 'Find a line that gets 3 of the 4 right.', done: shownBest >= 3 } : null}
      maths={
        <>
          <MLine text="Figure 10-6b’s weights (slide 17): both hidden TLUs get weight 1 from $x_1$ and from $x_2$; biases $-\tfrac{3}{2}$ (left) and $-\tfrac{1}{2}$ (right); the output TLU gets $-1$ and $+1$ from them, bias $-\tfrac{1}{2}$." />
          <MLine text={`Point $(${P.x.join(', ')})$: $h_1 = \\text{step}(${P.x[0]} + ${P.x[1]} - 1.5) = ${trace.h[0]}$, $h_2 = \\text{step}(${P.x[0]} + ${P.x[1]} - 0.5) = ${trace.h[1]}$, output $= \\text{step}(-${trace.h[0]} + ${trace.h[1]} - 0.5) = ${trace.y}$.`} />
          <MNote text="$h_1$ acts as AND and $h_2$ as OR, so the output is “OR but not AND”: XOR (this page’s reading of the weights)." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-switch" role="group" aria-label="Model">
          {[['mlp', 'MLP (Figure 10-6b)'], ['one', 'one TLU']].map(([k, l]) => (
            <button key={k} type="button" className={`dl12r-switch__opt${mode === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        <div className={`dl12r-xor${narrow ? ' dl12r-xor--narrow' : ''}`}>
          <svg
            ref={svgRef}
            className="dl12r-svg"
            viewBox={`0 0 ${W} ${H}`}
            style={{ maxWidth: W + 30 }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="group"
            aria-label={mode === 'one' ? `One TLU: ${right1} of 4 right` : 'MLP: the band between two lines is class 1; all 4 right'}
          >
            <rect x={sx(XOR_DOM[0])} y={sy(XOR_DOM[1])} width={sx(XOR_DOM[1]) - sx(XOR_DOM[0])} height={sy(XOR_DOM[0]) - sy(XOR_DOM[1])} className="dl12r-plotbox" />
            {[0, 1].map((v) => (
              <g key={v}>
                <text x={sx(v)} y={sy(XOR_DOM[0]) + 14} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{v}</text>
                <text x={sx(XOR_DOM[0]) - 7} y={sy(v) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{v}</text>
              </g>
            ))}
            <text x={sx(XOR_DOM[1])} y={sy(XOR_DOM[0]) + 28} textAnchor="end" className="dl12r-t dl12r-t--s">x₁</text>
            <text x={sx(XOR_DOM[0]) - 24} y={sy(XOR_DOM[1]) + 4} className="dl12r-t dl12r-t--s">x₂</text>
            {mode === 'mlp' ? (
              <g>
                <polygon className="dl12r-half" points={band.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} />
                {L([1, 1], -1.5, 'dl12r-dline dl12r-dline--h')}
                {L([1, 1], -0.5, 'dl12r-dline dl12r-dline--h')}
                <text x={sx(1.46)} y={sy(0.42)} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--fwd dl12r-halo">h₁: x₁ + x₂ = 3/2</text>
                <text x={sx(-0.46)} y={sy(0.62)} className="dl12r-t dl12r-t--xs dl12r-t--fwd dl12r-halo">h₂: x₁ + x₂ = 1/2</text>
              </g>
            ) : (
              <g>
                <polygon className="dl12r-half" points={halfPlane(sw, sb, sx, sy, XOR_DOM)} />
                {L(w, b, 'dl12r-dline')}
                {[['A', hA], ['B', hB]].map(([k, h]) => (
                  <g
                    key={k}
                    className="dl12r-handle"
                    role="slider"
                    tabIndex={0}
                    aria-label={`Line handle ${k}; arrow keys move it`}
                    aria-valuetext={`(${fmt(h[0])}, ${fmt(h[1])})`}
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(k); }}
                    onKeyDown={nudge(k)}
                  >
                    <circle cx={sx(h[0])} cy={sy(h[1])} r={14} fill="transparent" />
                    <circle cx={sx(h[0])} cy={sy(h[1])} r={6.5} className="dl12r-handle__dot" />
                  </g>
                ))}
              </g>
            )}
            {XOR_DATA.map((p, i) => {
              const yhat = mode === 'mlp' ? xorMlp(p.x).y : null;
              return (
                <g
                  key={i}
                  className="dl12r-pick"
                  role="button"
                  tabIndex={mode === 'mlp' ? 0 : -1}
                  aria-label={`Trace (${p.x.join(', ')}), class ${p.y}`}
                  onClick={() => setPick(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(i); } }}
                >
                  <Dot x={sx(p.x[0])} y={sy(p.x[1])} cls={p.y} r={8} ring={mode === 'mlp' && i === pick} wrong={yhat !== null && yhat !== p.y} />
                </g>
              );
            })}
          </svg>
          {mode === 'mlp' && <XorNet trace={trace} x={P.x} narrow={narrow} />}
        </div>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">{mode === 'one' ? `${right1}/4 right · best so far ${shownBest}/4` : '4/4 right'}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><Dot x={8} y={8} cls={1} r={5} /></svg> XOR = 1</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><Dot x={8} y={8} cls={0} r={5} /></svg> XOR = 0</span>
          {mode === 'mlp' && <span>click a point to trace it through the network</span>}
        </p>
      </div>
    </Stage>
  );
}

// Figure 10-6b redrawn small, with the traced point's values on it.
function XorNet({ trace, x, narrow }) {
  const W = 230;
  const H = 230;
  const X = [62, 168];
  const Y = { in: 196, hid: 118, out: 40 };
  const on = (v) => (v ? ' dl12r-net__n--on' : '');
  return (
    <svg className="dl12r-svg dl12r-net" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: narrow ? 260 : 240 }} role="img" aria-label={`Figure 10-6b: inputs (${x.join(', ')}) give hidden outputs h1 = ${trace.h[0]}, h2 = ${trace.h[1]} and output ${trace.y}`}>
      {X.map((xi) => X.map((xj) => <line key={`${xi}-${xj}`} className="dl12r-net__w" x1={xi} y1={Y.in - 14} x2={xj} y2={Y.hid + 15} />))}
      {X.map((xi) => <line key={`o${xi}`} className="dl12r-net__w" x1={xi} y1={Y.hid - 15} x2={W / 2} y2={Y.out + 15} />)}
      <text x={82} y={Y.hid + 50} className="dl12r-t dl12r-t--xs dl12r-t--m">1</text>
      <text x={144} y={Y.hid + 50} className="dl12r-t dl12r-t--xs dl12r-t--m">1</text>
      <text x={76} y={Y.out + 44} className="dl12r-t dl12r-t--xs dl12r-t--m">−1</text>
      <text x={146} y={Y.out + 44} className="dl12r-t dl12r-t--xs dl12r-t--m">+1</text>
      {X.map((xi, i) => (
        <g key={`i${i}`} className={`dl12r-net__n${on(x[i])}`}>
          <circle cx={xi} cy={Y.in} r={14} />
          <text x={xi} y={Y.in + 4.5} textAnchor="middle" className="dl12r-t dl12r-t--m">{x[i]}</text>
          <text x={xi} y={Y.in + 30} textAnchor="middle" className="dl12r-t dl12r-t--xs">x{i === 0 ? '₁' : '₂'}</text>
        </g>
      ))}
      {X.map((xi, i) => (
        <g key={`h${i}`} className={`dl12r-net__n${on(trace.h[i])}`}>
          <circle cx={xi} cy={Y.hid} r={15} />
          <text x={xi} y={Y.hid + 4.5} textAnchor="middle" className="dl12r-t dl12r-t--m">{trace.h[i]}</text>
          <text x={i === 0 ? xi - 22 : xi + 22} y={Y.hid + 4} textAnchor={i === 0 ? 'end' : 'start'} className="dl12r-t dl12r-t--xs dl12r-t--m">{i === 0 ? 'b = −3/2' : 'b = −1/2'}</text>
        </g>
      ))}
      <g className={`dl12r-net__n${on(trace.y)}`}>
        <circle cx={W / 2} cy={Y.out} r={15} />
        <text x={W / 2} y={Y.out + 4.5} textAnchor="middle" className="dl12r-t dl12r-t--m">{trace.y}</text>
        <text x={W / 2 + 22} y={Y.out + 4} className="dl12r-t dl12r-t--xs dl12r-t--m">b = −1/2</text>
        <text x={W / 2} y={Y.out - 22} textAnchor="middle" className="dl12r-t dl12r-t--xs">output</text>
      </g>
    </svg>
  );
}

