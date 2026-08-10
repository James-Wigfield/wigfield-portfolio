import { useEffect, useMemo, useState } from 'react';
import { Tex, Fnote, Code, Unfold, Eq } from '../kit';
import { mulberry32 } from '../mathfns';
import './lecture1.css';

/* ============================================================================
   DEEP LEARNING — LECTURE 1 LABS (part 1 · perceptrons)
   ----------------------------------------------------------------------------
     TluPlayground      slides 4–6 — drive a real TLU: weight/bias sliders, a
                        draggable query point, live z and step(z), and the
                        linear decision boundary moving underneath
     RuleAnatomy        slides 10–11 — the learning rule, term by term, plus
                        the margin derivation (it's SGD in disguise)
     PerceptronTrainer  slides 9–13 — Rosenblatt's algorithm running live on
                        an iris-like dataset, one instance at a time
     XorGame            slide 16 — try to cut XOR with one straight line
     XorMlp             slide 17 — the exact two-layer network that solves it
   Scoped styles: ../common.css (.dl-*) + ./lecture1.css (.dl1-*).
   ========================================================================== */

const heaviside = (z) => (z >= 0 ? 1 : 0);

// Clip the w·p + b ≥ 0 half-plane against a data-space rect → polygon points.
function halfPlanePoly(w1, w2, b, [x0, x1, y0, y1]) {
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const f = ([x, y]) => w1 * x + w2 * y + b;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const c = corners[(i + 1) % 4];
    const fa = f(a);
    const fc = f(c);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fc >= 0) {
      const t = fa / (fa - fc);
      out.push([a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]);
    }
  }
  return out;
}

// Long segment along the boundary w1·x + w2·y + b = 0 (data space).
function boundarySegment(w1, w2, b) {
  const n2 = w1 * w1 + w2 * w2;
  if (n2 < 1e-9) return null;
  const px = (-b * w1) / n2;
  const py = (-b * w2) / n2;
  const dx = -w2 / Math.sqrt(n2);
  const dy = w1 / Math.sqrt(n2);
  const L = 40;
  return [px - dx * L, py - dy * L, px + dx * L, py + dy * L];
}

/* ── Slides 4–6 · the TLU, live ──────────────────────────────────────────── */
export function TluPlayground() {
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(-0.7);
  const [b, setB] = useState(0.4);
  const [stepFn, setStepFn] = useState('heaviside');
  const [q, setQ] = useState({ x: 1.4, y: 0.9 });
  const [drag, setDrag] = useState(false);

  const z = w1 * q.x + w2 * q.y + b;
  const out = stepFn === 'heaviside' ? heaviside(z) : z > 0 ? 1 : z < 0 ? 0 : '0*';
  const outLabel = stepFn === 'heaviside' ? heaviside(z) : z > 0 ? '+1' : z < 0 ? '−1' : '0';
  const fire = stepFn === 'heaviside' ? z >= 0 : z > 0;

  // plane: data domain [-3, 3]² → 320×320 viewBox
  const S = 320;
  const sx = (v) => ((v + 3) / 6) * S;
  const sy = (v) => S - ((v + 3) / 6) * S;
  const poly = halfPlanePoly(w1, w2, b, [-3, 3, -3, 3]);
  const seg = boundarySegment(w1, w2, b);

  const fromEvent = (e, svg) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 6 - 3;
    const y = 3 - ((e.clientY - r.top) / r.height) * 6;
    return { x: Math.min(3, Math.max(-3, x)), y: Math.min(3, Math.max(-3, y)) };
  };

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">TLU playground · drag the point, drive the weights</span></div>

      <div className="dl1-tlu">
        {/* the neuron */}
        <svg viewBox="0 0 330 240" className="dl1-neuron" aria-label="Threshold logic unit diagram">
          <line x1={62} y1={70} x2={148} y2={106} className={`dl1-edge${fire ? ' dl1-edge--hot' : ''}`} />
          <line x1={62} y1={170} x2={148} y2={134} className={`dl1-edge${fire ? ' dl1-edge--hot' : ''}`} />
          <line x1={214} y1={120} x2={290} y2={120} className={`dl1-edge${fire ? ' dl1-edge--hot' : ''}`} />

          <circle cx={44} cy={70} r={19} className="dl1-node dl1-node--input" />
          <text x={44} y={66} textAnchor="middle" className="dl1-node__k">x₁</text>
          <text x={44} y={79} textAnchor="middle" className="dl1-node__v">{q.x.toFixed(1)}</text>
          <circle cx={44} cy={170} r={19} className="dl1-node dl1-node--input" />
          <text x={44} y={166} textAnchor="middle" className="dl1-node__k">x₂</text>
          <text x={44} y={179} textAnchor="middle" className="dl1-node__v">{q.y.toFixed(1)}</text>

          <text x={100} y={76} textAnchor="middle" className="dl1-wlabel">w₁ = {w1.toFixed(2)}</text>
          <text x={100} y={166} textAnchor="middle" className="dl1-wlabel">w₂ = {w2.toFixed(2)}</text>

          {/* the split TLU circle: Σ below, step above */}
          <circle cx={181} cy={120} r={33} className={`dl1-node dl1-node--tlu${fire ? ' dl1-node--fire' : ''}`} />
          <line x1={150} y1={120} x2={212} y2={120} className="dl1-node__split" />
          <path d="M167 108 h11 v-7 h11" className="dl1-stepglyph" />
          <text x={181} y={138} textAnchor="middle" className="dl1-node__sigma">Σ</text>
          <text x={181} y={168} textAnchor="middle" className="dl1-wlabel">b = {b.toFixed(2)}</text>

          <text x={310} y={112} textAnchor="middle" className="dl1-node__k">out</text>
          <text x={310} y={130} textAnchor="middle" className={`dl1-out${fire ? ' dl1-out--fire' : ''}`}>{outLabel}</text>
        </svg>

        {/* the decision plane */}
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="dl1-plane"
          aria-label="Decision plane — drag to move the query point"
          onPointerDown={(e) => { setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); setQ(fromEvent(e, e.currentTarget)); }}
          onPointerMove={(e) => drag && setQ(fromEvent(e, e.currentTarget))}
          onPointerUp={() => setDrag(false)}
        >
          {poly.length >= 3 && (
            <polygon points={poly.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} className="dl1-plane__pos" />
          )}
          {[-2, -1, 1, 2].map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={0} x2={sx(t)} y2={S} className="dl-plot__grid" />
              <line x1={0} y1={sy(t)} x2={S} y2={sy(t)} className="dl-plot__grid" />
            </g>
          ))}
          <line x1={sx(0)} y1={0} x2={sx(0)} y2={S} className="dl-plot__axis" />
          <line x1={0} y1={sy(0)} x2={S} y2={sy(0)} className="dl-plot__axis" />
          {seg && <line x1={sx(seg[0])} y1={sy(seg[1])} x2={sx(seg[2])} y2={sy(seg[3])} className="dl1-boundary" />}
          <circle cx={sx(q.x)} cy={sy(q.y)} r={9} className={`dl1-query${fire ? ' dl1-query--fire' : ''}`} />
        </svg>

        <div className="dl1-tlu__panel">
          <label className="dl-slider"><span>w₁ = {w1.toFixed(2)}</span>
            <input type="range" min="-2" max="2" step="0.05" value={w1} onChange={(e) => setW1(Number(e.target.value))} />
          </label>
          <label className="dl-slider"><span>w₂ = {w2.toFixed(2)}</span>
            <input type="range" min="-2" max="2" step="0.05" value={w2} onChange={(e) => setW2(Number(e.target.value))} />
          </label>
          <label className="dl-slider"><span>b = {b.toFixed(2)}</span>
            <input type="range" min="-2" max="2" step="0.05" value={b} onChange={(e) => setB(Number(e.target.value))} />
          </label>
          <div className="dl-chips">
            <button type="button" className={`dl-chip${stepFn === 'heaviside' ? ' dl-chip--on' : ''}`} onClick={() => setStepFn('heaviside')} aria-pressed={stepFn === 'heaviside'}>heaviside → 0 / 1</button>
            <button type="button" className={`dl-chip${stepFn === 'sign' ? ' dl-chip--on' : ''}`} onClick={() => setStepFn('sign')} aria-pressed={stepFn === 'sign'}>sign → −1 / 0 / +1</button>
          </div>
          <p className="dl1-zline">
            z = {w1.toFixed(2)}×{q.x.toFixed(1)} + ({w2.toFixed(2)})×{q.y.toFixed(1)} + {b.toFixed(2)} ={' '}
            <b>{z.toFixed(2)}</b> → step(z) = <b>{outLabel}</b>
          </p>
          <p className="dl-plot__cap">
            The shaded side is where the unit fires{out === '0*' ? ' (sign(0) = 0 exactly on the line)' : ''} — the
            decision boundary is always a straight line. That single fact is this whole lecture’s plot.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Slides 10–11 · the learning rule, term by term ──────────────────────── */
const RULE_TERMS = [
  { id: 'w', tex: 'w_{i,j}', txt: 'the connection weight between the i-th input neuron and the j-th output neuron' },
  { id: 'eta', tex: '\\eta', txt: 'the learning rate' },
  { id: 'y', tex: 'y_j', txt: 'the target output of the j-th output neuron for the current training instance' },
  { id: 'yhat', tex: '\\hat{y}_j', txt: 'the output of the j-th output neuron for the current training instance' },
  { id: 'x', tex: 'x_i', txt: 'the i-th input value of the current training instance' },
];

export function RuleAnatomy() {
  const [term, setTerm] = useState('eta');
  const cur = RULE_TERMS.find((t) => t.id === term);
  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">The learning rule · slide 10 — click a symbol</span></div>
      <Eq
        no="2.1"
        name="Perceptron learning rule"
        src="w_{i,j}^{(\text{next step})} = w_{i,j} + \eta\,(y_j - \hat{y}_j)\,x_i"
        read="new weight = old weight + learning rate × (target − output) × input"
      />
      <div className="dl-chips">
        {RULE_TERMS.map((t) => (
          <button key={t.id} type="button" className={`dl-chip${term === t.id ? ' dl-chip--on' : ''}`} onClick={() => setTerm(t.id)} aria-pressed={term === t.id}>
            <Tex src={t.tex} />
          </button>
        ))}
      </div>
      <p className="dl1-termcard" key={term}><Tex src={cur.tex} /> — {cur.txt}.</p>

      <Unfold label="The margin derivation (slide 11) — the rule is gradient descent in disguise">
        <p className="dl-body">Take the squared error of one output neuron as the loss:</p>
        <Tex block src="\mathcal{L}_j = \tfrac{1}{2}\big(\hat{y}_j - y_j\big)^2, \qquad \hat{y}_j = \sum_{i=1}^{n} x_i\, w_{i,j}" />
        <p className="dl-body">Only one term of the sum touches <Tex src="w_{i,j}" />, so:</p>
        <Tex block src="\frac{\partial \hat{y}_j}{\partial w_{i,j}} = \frac{\partial}{\partial w_{i,j}}\big(x_1 w_{1,j} + \cdots + x_i w_{i,j} + \cdots + x_n w_{n,j}\big) = x_i" />
        <Tex block src="\Rightarrow\quad \frac{\partial \mathcal{L}_j}{\partial w_{i,j}} = \big(\hat{y}_j - y_j\big)\,x_i \qquad\text{(the error gradient for } w_{i,j}\text{)}" />
        <p className="dl-body">Rewrite the update and it is exactly the negative error gradient, scaled by the learning rate:</p>
        <Tex block src="w_{i,j}^{(\text{next step})} = w_{i,j} - \eta\,\frac{\partial \mathcal{L}_j}{\partial w_{i,j}}" />
      </Unfold>
    </div>
  );
}

/* ── Slides 9–13 · Rosenblatt's algorithm, live ──────────────────────────── */
const SKLEARN_CODE = `import numpy as np
from sklearn.datasets import load_iris
from sklearn.linear_model import Perceptron
iris = load_iris()
X = iris.data[:, (2, 3)]                      # petal length, petal width
y = (iris.target == 0).astype(np.int)   # Iris Setosa?
per_clf = Perceptron(random_state=42)
per_clf.fit(X, y)
y_pred = per_clf.predict([[2, 0.5], [3, 1]]) # predicts True and False`;

// An iris-like 2-D dataset (petal length × petal width), seeded + shuffled.
const TRAIN_DATA = (() => {
  const rng = mulberry32(11);
  const pts = [];
  for (let i = 0; i < 12; i++) pts.push({ x: 1.0 + rng() * 1.1, y: 0.1 + rng() * 0.5, label: 1 }); // setosa
  for (let i = 0; i < 14; i++) pts.push({ x: 3.0 + rng() * 2.0, y: 1.0 + rng() * 0.9, label: 0 }); // not setosa
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts;
})();

const TRAIN_INIT = { w: [0, 0, 0], idx: 0, epoch: 1, updates: 0, epochErrors: 0, converged: false, flash: null };
const predictPt = (w, p) => heaviside(w[0] * p.x + w[1] * p.y + w[2]);

function advance(s, eta) {
  if (s.converged) return s;
  const p = TRAIN_DATA[s.idx];
  const err = p.label - predictPt(s.w, p);
  let { w, updates, epochErrors } = s;
  let flash = null;
  if (err !== 0) {
    w = [w[0] + eta * err * p.x, w[1] + eta * err * p.y, w[2] + eta * err];
    updates += 1;
    epochErrors += 1;
    flash = s.idx;
  }
  let { idx, epoch, converged } = s;
  idx += 1;
  if (idx >= TRAIN_DATA.length) {
    idx = 0;
    epoch += 1;
    converged = epochErrors === 0;
    epochErrors = 0;
  }
  return { w, idx, epoch, updates, epochErrors, converged, flash };
}

export function PerceptronTrainer() {
  const [s, setS] = useState(TRAIN_INIT);
  const [eta, setEta] = useState(1.0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || s.converged) return undefined;
    const t = setTimeout(() => {
      const next = advance(s, eta);
      setS(next);
      if (next.converged) setRunning(false);
    }, 200);
    return () => clearTimeout(t);
  }, [running, s, eta]);

  const wrong = TRAIN_DATA.filter((p) => predictPt(s.w, p) !== p.label).length;

  // plane: x 0–5.6, y 0–2.3 → 640×300
  const W = 640;
  const H = 300;
  const sx = (v) => (v / 5.6) * W;
  const sy = (v) => H - (v / 2.3) * H;
  const poly = halfPlanePoly(s.w[0], s.w[1], s.w[2], [0, 5.6, 0, 2.3]);
  const seg = boundarySegment(s.w[0], s.w[1], s.w[2]);
  const cur = TRAIN_DATA[s.idx];

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Perceptron trainer · one instance at a time, exactly Rosenblatt’s rule</span>
        <div className="dl1-trainbtns">
          <button type="button" className="dl-btn" onClick={() => setS((p) => advance(p, eta))} disabled={s.converged}>step</button>
          <button type="button" className="dl-btn" onClick={() => setRunning(!running)} disabled={s.converged}>{running ? 'pause' : '▶ play'}</button>
          <button type="button" className="dl-btn" onClick={() => { setS(TRAIN_INIT); setRunning(false); }}>reset</button>
        </div>
      </div>

      <label className="dl-slider" style={{ maxWidth: 240 }}>
        <span>learning rate η = {eta.toFixed(2)}</span>
        <input type="range" min="0.05" max="1" step="0.05" value={eta} onChange={(e) => setEta(Number(e.target.value))} />
      </label>

      <svg viewBox={`0 0 ${W} ${H}`} className="dl1-trainsvg" aria-label="Training data and current decision boundary">
        <rect x={0} y={0} width={W} height={H} className="dl1-plane__neg" />
        {poly.length >= 3 && <polygon points={poly.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} className="dl1-plane__pos dl1-plane__pos--warm" />}
        {[1, 2, 3, 4, 5].map((t) => <line key={t} x1={sx(t)} y1={0} x2={sx(t)} y2={H} className="dl-plot__grid" />)}
        {[0.5, 1, 1.5, 2].map((t) => <line key={t} x1={0} y1={sy(t)} x2={W} y2={sy(t)} className="dl-plot__grid" />)}
        {seg && <line x1={sx(seg[0])} y1={sy(seg[1])} x2={sx(seg[2])} y2={sy(seg[3])} className="dl1-boundary" />}
        {TRAIN_DATA.map((p, i) => {
          const active = i === s.idx && !s.converged;
          return p.label === 1 ? (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={6} className={`dl1-pt dl1-pt--setosa${active ? ' dl1-pt--active' : ''}${s.flash === i ? ' dl1-pt--flash' : ''}`} />
          ) : (
            <rect key={i} x={sx(p.x) - 5.5} y={sy(p.y) - 5.5} width={11} height={11} className={`dl1-pt dl1-pt--other${active ? ' dl1-pt--active' : ''}${s.flash === i ? ' dl1-pt--flash' : ''}`} />
          );
        })}
        <text x={10} y={H - 8} className="dl-plot__tick">petal length →</text>
        <text x={10} y={16} className="dl-plot__tick">petal width ↑</text>
      </svg>

      <p className="dl-verdict">
        <span className="dl-verdict__dot" data-v={s.converged ? 'healthy' : wrong > 0 ? 'vanishing' : 'healthy'} aria-hidden="true" />
        {s.converged ? (
          <>converged after {s.epoch - 1} epochs and {s.updates} updates — the Perceptron convergence theorem, live (the solution is not unique<Fnote n={1} />)</>
        ) : (
          <>epoch {s.epoch} · updates {s.updates} · misclassified {wrong}/{TRAIN_DATA.length} · next: instance {s.idx + 1}{cur ? (cur.label === 1 ? ' (setosa ●)' : ' (not-setosa ■)') : ''}</>
        )}
      </p>

      <div className="dl1-legend">
        <span><i className="dl1-key dl1-key--setosa" /> Iris-Setosa (y = 1)</span>
        <span><i className="dl1-key dl1-key--other" /> Not Iris-Setosa (y = 0)</span>
        <span><i className="dl1-key dl1-key--region" /> region currently predicted setosa</span>
      </div>

      <Code code={SKLEARN_CODE} label="perceptron_iris.py" meta="slide 13" />
    </div>
  );
}

/* ── Slide 16 · try to cut XOR with one line ─────────────────────────────── */
const XOR_PTS = [
  { x: 0, y: 0, cls: 'a' }, { x: 1, y: 1, cls: 'a' },
  { x: 0, y: 1, cls: 'b' }, { x: 1, y: 0, cls: 'b' },
];

export function XorGame() {
  const [theta, setTheta] = useState(45);
  const [d, setD] = useState(0.5);
  const [tries, setTries] = useState(0);

  const rad = (theta * Math.PI) / 180;
  const n = [Math.cos(rad), Math.sin(rad)];
  const side = (p) => n[0] * p.x + n[1] * p.y - d;
  const m1 = XOR_PTS.filter((p) => (p.cls === 'a') === (side(p) >= 0)).length;
  const best = Math.min(m1, 4 - m1); // best labelling of the two sides

  // plane: -0.45..1.45 → 300×300
  const S = 300;
  const sx = (v) => ((v + 0.45) / 1.9) * S;
  const sy = (v) => S - ((v + 0.45) / 1.9) * S;
  const seg = boundarySegment(n[0], n[1], -d);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">The XOR game · find a single line that separates ▲ from ■</span></div>
      <div className="dl1-xor">
        <svg viewBox={`0 0 ${S} ${S}`} className="dl1-plane" aria-label="XOR points with an adjustable line">
          {[0, 1].map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={0} x2={sx(t)} y2={S} className="dl-plot__grid" />
              <line x1={0} y1={sy(t)} x2={S} y2={sy(t)} className="dl-plot__grid" />
              <text x={sx(t) - 10} y={sy(0) + 16} className="dl-plot__tick">{t}</text>
              {t === 1 && <text x={sx(0) - 14} y={sy(t) + 4} className="dl-plot__tick">1</text>}
            </g>
          ))}
          {seg && <line x1={sx(seg[0])} y1={sy(seg[1])} x2={sx(seg[2])} y2={sy(seg[3])} className="dl1-boundary" />}
          {XOR_PTS.map((p, i) => {
            const miss = 4 - m1 <= m1 ? (p.cls === 'a') === (side(p) >= 0) : (p.cls === 'a') !== (side(p) >= 0);
            return p.cls === 'a' ? (
              <polygon
                key={i}
                points={`${sx(p.x)},${sy(p.y) - 9} ${sx(p.x) - 9},${sy(p.y) + 7} ${sx(p.x) + 9},${sy(p.y) + 7}`}
                className={`dl1-xorpt dl1-xorpt--a${miss ? ' dl1-xorpt--miss' : ''}`}
              />
            ) : (
              <rect key={i} x={sx(p.x) - 8} y={sy(p.y) - 8} width={16} height={16} className={`dl1-xorpt dl1-xorpt--b${miss ? ' dl1-xorpt--miss' : ''}`} />
            );
          })}
        </svg>
        <div className="dl1-xor__panel">
          <label className="dl-slider"><span>angle θ = {theta}°</span>
            <input type="range" min="0" max="180" step="1" value={theta} onChange={(e) => { setTheta(Number(e.target.value)); setTries((t) => t + 1); }} />
          </label>
          <label className="dl-slider"><span>offset d = {d.toFixed(2)}</span>
            <input type="range" min="-0.5" max="1.5" step="0.01" value={d} onChange={(e) => { setD(Number(e.target.value)); setTries((t) => t + 1); }} />
          </label>
          <p className="dl-verdict">
            <span className="dl-verdict__dot" data-v={best > 0 ? 'exploding' : 'healthy'} aria-hidden="true" />
            best labelling of the two sides: <strong>{best} wrong</strong>
            {tries > 12 && best > 0 && ' — and it always will be. No single line exists.'}
          </p>
          <p className="dl-plot__cap">
            ▲ at (0,0) and (1,1) · ■ at (0,1) and (1,0). In their 1969 monograph <em>Perceptrons</em>,
            Minsky and Papert made exactly this point — true of any linear model, Logistic Regression
            included. Many researchers dropped connectionism altogether (slide 16).
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Slide 17 · the two-layer network that solves XOR ────────────────────── */
const XOR_NET = {
  // exact weights/biases from Figure 10-6b
  h1: { b: -1.5, label: '−3/2' },
  h2: { b: -0.5, label: '−1/2' },
  out: { b: -0.5, wh1: -1, wh2: 1, label: '−1/2' },
};

export function XorMlp() {
  const [input, setInput] = useState(null); // [x1, x2] or null
  const [stage, setStage] = useState(0); // 0 inputs, 1 hidden, 2 output
  const [tried, setTried] = useState({});

  useEffect(() => {
    if (input === null || stage >= 2) return undefined;
    const t = setTimeout(() => setStage((v) => v + 1), 380);
    return () => clearTimeout(t);
  }, [input, stage]);

  const run = ([x1, x2]) => {
    setInput([x1, x2]);
    setStage(0);
    setTried((prev) => ({ ...prev, [`${x1}${x2}`]: true }));
  };

  const vals = useMemo(() => {
    if (!input) return null;
    const [x1, x2] = input;
    const h1 = heaviside(x1 + x2 + XOR_NET.h1.b);
    const h2 = heaviside(x1 + x2 + XOR_NET.h2.b);
    const out = heaviside(XOR_NET.out.wh1 * h1 + XOR_NET.out.wh2 * h2 + XOR_NET.out.b);
    return { x1, x2, h1, h2, out };
  }, [input]);

  const allTried = Object.keys(tried).length === 4;
  const node = (cx, cy, k, v, bias, show) => (
    <g className={`dl1-mlpnode${show ? ' dl1-mlpnode--show' : ''}`}>
      <circle cx={cx} cy={cy} r={26} className="dl1-node dl1-node--tlu" />
      <line x1={cx - 24} y1={cy} x2={cx + 24} y2={cy} className="dl1-node__split" />
      <path d={`M${cx - 11} ${cy - 9} h8 v-6 h8`} className="dl1-stepglyph" />
      <text x={cx} y={cy + 15} textAnchor="middle" className="dl1-node__sigma">Σ</text>
      {bias && <text x={cx + 40} y={cy + 4} textAnchor="middle" className="dl1-wlabel">b = {bias}</text>}
      <text x={cx} y={cy - 34} textAnchor="middle" className={`dl1-out${show && v === 1 ? ' dl1-out--fire' : ''}`}>
        {show ? `${k} = ${v}` : k}
      </text>
    </g>
  );

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Slide 17 · stack two layers — XOR falls</span></div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Feed it</span>
        <div className="dl-chips">
          {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, c]) => (
            <button
              key={`${a}${c}`} type="button"
              className={`dl-chip${input && input[0] === a && input[1] === c ? ' dl-chip--on' : ''}`}
              onClick={() => run([a, c])}
            >
              ({a}, {c}){tried[`${a}${c}`] ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="dl1-xor">
        <svg viewBox="0 0 470 330" className="dl1-mlpsvg" aria-label="The XOR-solving MLP">
          {/* edges: inputs → hidden (all weight 1, crossing) */}
          {[[155, 262, 155, 183], [155, 262, 303, 176], [315, 262, 167, 176], [315, 262, 315, 183]].map(([a, b2, c, d2], i) => (
            <line key={i} x1={a} y1={b2} x2={c} y2={d2} className={`dl1-edge${vals && stage >= 1 ? ' dl1-edge--hot' : ''}`} />
          ))}
          <text x={141} y={228} className="dl1-wlabel" textAnchor="middle">1</text>
          <text x={205} y={228} className="dl1-wlabel" textAnchor="middle">1</text>
          <text x={266} y={228} className="dl1-wlabel" textAnchor="middle">1</text>
          <text x={329} y={228} className="dl1-wlabel" textAnchor="middle">1</text>
          {/* hidden → output */}
          <line x1={164} y1={131} x2={217} y2={76} className={`dl1-edge${vals && stage >= 2 ? ' dl1-edge--hot' : ''}`} />
          <line x1={306} y1={131} x2={253} y2={76} className={`dl1-edge${vals && stage >= 2 ? ' dl1-edge--hot' : ''}`} />
          <text x={172} y={102} className="dl1-wlabel" textAnchor="middle">−1</text>
          <text x={298} y={102} className="dl1-wlabel" textAnchor="middle">1</text>

          {/* inputs */}
          {[[155, 285, 'x₁'], [315, 285, 'x₂']].map(([cx, cy, k], i) => (
            <g key={k}>
              <circle cx={cx} cy={cy} r={19} className="dl1-node dl1-node--input" />
              <text x={cx} y={cy - 24 - 4} textAnchor="middle" className="dl1-node__k">{k}</text>
              <text x={cx} y={cy + 5} textAnchor="middle" className="dl1-node__v">{vals ? vals[i === 0 ? 'x1' : 'x2'] : '·'}</text>
            </g>
          ))}

          {node(155, 155, 'h₁', vals?.h1, XOR_NET.h1.label, vals && stage >= 1)}
          {node(315, 155, 'h₂', vals?.h2, XOR_NET.h2.label, vals && stage >= 1)}
          {node(235, 55, 'ŷ', vals?.out, XOR_NET.out.label, vals && stage >= 2)}
          <text x={155} y={205} textAnchor="middle" className="dl1-hint">fires only for (1,1) — AND</text>
          <text x={315} y={205} textAnchor="middle" className="dl1-hint">fires unless (0,0) — OR</text>
        </svg>

        <div className="dl1-xor__panel">
          <table className="dl-table dl1-truth">
            <caption className="dl-table__cap">The claim on slide 17 — verify all four.</caption>
            <thead><tr><th>x₁</th><th>x₂</th><th>ŷ (XOR)</th></tr></thead>
            <tbody>
              {[[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]].map(([a, c, y]) => (
                <tr key={`${a}${c}`} className={tried[`${a}${c}`] ? 'dl-table__row--on' : ''}>
                  <td>{a}</td><td>{c}</td><td className="dl-mono">{tried[`${a}${c}`] ? y : '?'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {allTried && (
            <p className="dl-verdict">
              <span className="dl-verdict__dot" aria-hidden="true" />
              <strong>XOR solved</strong>&thinsp; — OR minus AND. Stacked Perceptrons = a Multi-Layer
              Perceptron, and the 1969 objection dissolves.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
