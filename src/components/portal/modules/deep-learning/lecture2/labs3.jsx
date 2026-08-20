import { useEffect, useMemo, useState } from 'react';
import { Tex, Note, Code } from '../kit';
import { FnPlot } from '../plots';
import { fmtSci, mulberry32 } from '../mathfns';

/* ============================================================================
   DEEP LEARNING — LECTURE 2 LABS (part 3 · slides 33–68)
   ----------------------------------------------------------------------------
   The interactive figures for the second half of the deck:

     OptimizerRaceLab  six REAL optimizers raced on the elongated bowl
                       (Figures 11-7/11-8 territory): every trajectory is the
                       genuine update rule run in JS — scrub or play the steps
     OptimizerTable    Table 11-2 (convergence speed vs quality) as stars
     ScheduleLab       the five learning schedules: pick one, drag its knobs,
                       read the live η(t) curve + the slide's exact Keras code
     DropoutLab        Figure 11-10 live: step the training loop and watch
                       neurons drop with probability p (outputs never drop)
   ========================================================================== */

/* ── §7 · Optimizer race ─────────────────────────────────────────────────── */
const RACE_A = 1;
const RACE_B = 12; // elongated bowl J = ½(A·θ₁² + B·θ₂²) — steep along θ₂
const RACE_START = [-2.1, 1.5];
const RACE_STEPS = 150;
const RACE_EPS = 1e-8;

const OPTIMIZERS = [
  { id: 'sgd', name: 'SGD', color: 'var(--dlv-blue)' },
  { id: 'momentum', name: 'Momentum', color: 'var(--dlv-orange)' },
  { id: 'nag', name: 'NAG', color: 'var(--dlv-aqua)' },
  { id: 'adagrad', name: 'AdaGrad', color: 'var(--dlv-red)' },
  { id: 'rmsprop', name: 'RMSProp', color: 'var(--dlv-violet)' },
  { id: 'adam', name: 'Adam', color: 'var(--dlv-green)' },
];

// The genuine update rules (slides 34–44), run on the quadratic bowl.
function simulateOptimizer(id, eta) {
  let th = [...RACE_START];
  let m = [0, 0];
  let s = [0, 0];
  let t = 0;
  const path = [[...th]];
  const grad = (p) => [RACE_A * p[0], RACE_B * p[1]];
  for (let i = 0; i < RACE_STEPS; i++) {
    let g = grad(th);
    if (id === 'sgd') {
      th = [th[0] - eta * g[0], th[1] - eta * g[1]];
    } else if (id === 'momentum') {
      m = [0.9 * m[0] - eta * g[0], 0.9 * m[1] - eta * g[1]];
      th = [th[0] + m[0], th[1] + m[1]];
    } else if (id === 'nag') {
      g = grad([th[0] + 0.9 * m[0], th[1] + 0.9 * m[1]]);
      m = [0.9 * m[0] - eta * g[0], 0.9 * m[1] - eta * g[1]];
      th = [th[0] + m[0], th[1] + m[1]];
    } else if (id === 'adagrad') {
      s = [s[0] + g[0] * g[0], s[1] + g[1] * g[1]];
      th = [th[0] - (eta * g[0]) / Math.sqrt(s[0] + RACE_EPS), th[1] - (eta * g[1]) / Math.sqrt(s[1] + RACE_EPS)];
    } else if (id === 'rmsprop') {
      s = [0.9 * s[0] + 0.1 * g[0] * g[0], 0.9 * s[1] + 0.1 * g[1] * g[1]];
      th = [th[0] - (eta * g[0]) / Math.sqrt(s[0] + RACE_EPS), th[1] - (eta * g[1]) / Math.sqrt(s[1] + RACE_EPS)];
    } else if (id === 'adam') {
      t += 1;
      m = [0.9 * m[0] + 0.1 * g[0], 0.9 * m[1] + 0.1 * g[1]];
      s = [0.999 * s[0] + 0.001 * g[0] * g[0], 0.999 * s[1] + 0.001 * g[1] * g[1]];
      const mh = [m[0] / (1 - 0.9 ** t), m[1] / (1 - 0.9 ** t)];
      const sh = [s[0] / (1 - 0.999 ** t), s[1] / (1 - 0.999 ** t)];
      th = [th[0] - (eta * mh[0]) / (Math.sqrt(sh[0]) + RACE_EPS), th[1] - (eta * mh[1]) / (Math.sqrt(sh[1]) + RACE_EPS)];
    }
    path.push([...th]);
  }
  return path;
}

const lossAt = (p) => 0.5 * (RACE_A * p[0] * p[0] + RACE_B * p[1] * p[1]);

const RW = 640;
const RH = 340;
const rsx = (x) => 320 + x * 114;
const rsy = (y) => 170 - y * 94;

export function OptimizerRaceLab() {
  const [sel, setSel] = useState(['sgd', 'momentum', 'adagrad', 'adam']);
  const [eta, setEta] = useState(0.02);
  const [step, setStep] = useState(RACE_STEPS);
  const [playing, setPlaying] = useState(false);

  const paths = useMemo(() => {
    const out = {};
    OPTIMIZERS.forEach((o) => { out[o.id] = simulateOptimizer(o.id, eta); });
    return out;
  }, [eta]);

  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => {
      setStep((v) => Math.min(RACE_STEPS, v + 2));
      if (step + 2 >= RACE_STEPS) setPlaying(false);
    }, 45);
    return () => clearTimeout(t);
  }, [playing, step]);

  const toggle = (id) =>
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const race = () => { setStep(0); setPlaying(true); };

  const contours = [0.05, 0.2, 0.5, 1, 2, 4, 8, 14];

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Optimizer race · the elongated bowl, real update rules (Figure 11-8 territory)</span>
        <span className="dl3-btnrow">
          <button type="button" className="dl-btn" onClick={race}>▶ race</button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setStep(RACE_STEPS); }}>show all</button>
        </span>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-ctl">
          <span className="dl-ctl__label">Racers</span>
          <div className="dl-chips">
            {OPTIMIZERS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`dl-chip dl-chip--fn${sel.includes(o.id) ? ' dl-chip--on' : ''}`}
                onClick={() => toggle(o.id)}
                aria-pressed={sel.includes(o.id)}
              >
                <span className="dl-chip__dot" style={{ background: o.color }} aria-hidden="true" />
                {o.name}
              </button>
            ))}
          </div>
        </div>
        <div className="dl-sliders">
          <label className="dl-slider">
            <span>learning rate η = {eta.toFixed(3)} (shared by all six)</span>
            <input type="range" min="0.005" max="0.08" step="0.005" value={eta} onChange={(e) => { setEta(Number(e.target.value)); setPlaying(false); setStep(RACE_STEPS); }} />
          </label>
          <label className="dl-slider">
            <span>step {step}/{RACE_STEPS}</span>
            <input type="range" min="0" max={RACE_STEPS} step="1" value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} />
          </label>
        </div>
      </div>

      <div className="dl2-racegrid">
        <svg viewBox={`0 0 ${RW} ${RH}`} className="dl2-race" aria-label="Optimizer trajectories on an elongated cost bowl">
          <defs>
            <clipPath id="dl2raceclip">
              <rect x={6} y={6} width={RW - 12} height={RH - 12} rx={6} />
            </clipPath>
          </defs>
          <g clipPath="url(#dl2raceclip)">
            {contours.map((J) => (
              <ellipse
                key={J}
                cx={rsx(0)}
                cy={rsy(0)}
                rx={Math.sqrt((2 * J) / RACE_A) * 114}
                ry={Math.sqrt((2 * J) / RACE_B) * 94}
                className="dl2-contour"
              />
            ))}
            {OPTIMIZERS.filter((o) => sel.includes(o.id)).map((o) => {
              const pts = paths[o.id].slice(0, step + 1);
              const d = pts.map((p, i) => `${i ? 'L' : 'M'}${rsx(p[0]).toFixed(1)} ${rsy(p[1]).toFixed(1)}`).join('');
              const head = pts[pts.length - 1];
              return (
                <g key={o.id}>
                  <path d={d} className="dl2-trail" style={{ stroke: o.color }} />
                  <circle cx={rsx(head[0])} cy={rsy(head[1])} r={4.5} className="dl2-head" style={{ fill: o.color }} />
                </g>
              );
            })}
          </g>
          {/* start + optimum markers */}
          <circle cx={rsx(RACE_START[0])} cy={rsy(RACE_START[1])} r={4} className="dl2-mark" />
          <text x={rsx(RACE_START[0])} y={rsy(RACE_START[1]) - 9} textAnchor="middle" className="dl2-marklabel">start</text>
          <path d={`M${rsx(0) - 5} ${rsy(0) - 5} l10 10 m0 -10 l-10 10`} className="dl2-opt" />
          <text x={rsx(0)} y={rsy(0) + 20} textAnchor="middle" className="dl2-marklabel">optimum</text>
          <text x={RW - 14} y={rsy(0) - 8} textAnchor="end" className="dl2-axlabel">θ₁ (flat)</text>
          <text x={rsx(0) + 8} y={20} className="dl2-axlabel">θ₂ (steep)</text>
        </svg>

        <div className="dl2-board">
          <p className="dl2-board__title">cost J(θ) at step {step}</p>
          {OPTIMIZERS.filter((o) => sel.includes(o.id)).map((o) => {
            const J = lossAt(paths[o.id][step]);
            return (
              <p key={o.id} className="dl2-board__row">
                <span className="dl-chip__dot" style={{ background: o.color }} aria-hidden="true" />
                <span className="dl2-board__name">{o.name}</span>
                <span className="dl2-board__val">{fmtSci(J)}</span>
                {o.id === 'adagrad' && J > 0.5 && step > 80 && <span className="dl2-board__tag">stalled</span>}
              </p>
            );
          })}
          <p className="dl2-board__hyper">β = 0.9 · ρ = 0.9 · β₁ = 0.9, β₂ = 0.999 · ε = 10⁻⁸</p>
        </div>
      </div>

      <Note label="Try this">
        <p>
          Press <em>race</em> with the default four. SGD dives down the steep wall then crawls along
          the valley; Momentum rolls past and swings back; <em>AdaGrad corrects its direction early
          — then stalls</em> (slide 40's warning, live); Adam glides in. Now add NAG next to
          Momentum: same idea, tighter path — the gradient is measured a look-ahead step at{' '}
          <Tex src="\theta + \beta\mathbf{m}" />, so it swings less (Figure 11-7).
        </p>
      </Note>
    </div>
  );
}

/* ── §7e · Table 11-2 ────────────────────────────────────────────────────── */
const TABLE_112 = [
  ['SGD', 1, 3, ''],
  ['SGD(momentum=...)', 2, 3, ''],
  ['SGD(momentum=..., nesterov=True)', 2, 3, ''],
  ['AdaGrad', 3, 1, 'stops too early'],
  ['RMSprop', 3, 2.5, ''],
  ['Adam', 3, 2.5, ''],
  ['AdaMax', 3, 2.5, ''],
  ['Nadam', 3, 2.5, ''],
  ['AdamW', 3, 2.5, ''],
];

const Stars = ({ n }) => (
  <span className="dl2-stars" aria-label={`${n} of 3`}>
    {n === 2.5 ? '★★ or ★★★' : '★'.repeat(n)}
  </span>
);

export function OptimizerTable() {
  return (
    <div className="dl-tablewrap">
      <table className="dl-table">
        <caption className="dl-table__cap">Table 11-2. Optimizer comparison — convergence speed vs convergence quality.</caption>
        <thead>
          <tr><th>Class</th><th>Convergence speed</th><th>Convergence quality</th></tr>
        </thead>
        <tbody>
          {TABLE_112.map(([name, speed, quality, warn]) => (
            <tr key={name} className={warn ? 'dl-table__row--bn' : ''}>
              <td className="dl-mono">{name}</td>
              <td><Stars n={speed} /></td>
              <td>
                <Stars n={quality} />
                {warn && <span className="dl2-warn"> ({warn})</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── §8 · Learning-rate schedule explorer ────────────────────────────────── */
const SCHED_CODE = {
  power: `# initial_learning_rate / (1 + decay_rate * step / decay_step)

lr_schedule = tf.keras.optimizers.schedules.InverseTimeDecay(
    initial_learning_rate=0.01,
    decay_steps=10_000,
    decay_rate=1.0,
    staircase=False
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  exp: `# initial_learning_rate * decay_rate ** (step / decay_steps)
lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
    initial_learning_rate=0.01,
    decay_steps=20_000,
    decay_rate=0.1,
    staircase=False
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  piecewise: `# An example:
lr_schedule = tf.keras.optimizers.schedules.PiecewiseConstantDecay(
    boundaries=[50_000, 80_000],
    values=[0.01, 0.005, 0.001]
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  perf: `lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(factor=0.5,
                                                    patience=5)
history = model.fit(X_train, y_train, [...], callbacks=[lr_scheduler])`,
};

const SCHEDULES = [
  { id: 'power', name: 'Power', slides: 'slides 50–51', file: 'power_scheduling.py' },
  { id: 'exp', name: 'Exponential', slides: 'slides 52–53', file: 'exponential_scheduling.py' },
  { id: 'piecewise', name: 'Piecewise constant', slides: 'slides 55–56', file: 'piecewise_constant.py' },
  { id: 'perf', name: 'Performance', slides: 'slides 57–58', file: 'reduce_lr_on_plateau.py' },
  { id: 'cycle', name: '1Cycle', slides: 'slide 59', file: null },
];

export function ScheduleLab() {
  const [sched, setSched] = useState('power');
  const [r, setR] = useState(1.0); // power decay rate
  const [s, setS] = useState(10); // decay steps (both power & exp)
  const [expR, setExpR] = useState(0.1); // exponential decay rate
  const [stair, setStair] = useState(false);
  const [b1, setB1] = useState(15);
  const [b2, setB2] = useState(30);
  const [factor, setFactor] = useState(0.5);
  const [peak, setPeak] = useState(0.03);

  const eta0 = 0.01;
  const bb2 = Math.max(b2, b1 + 5);

  // η(t) in units of 10⁻³ so the shared FnPlot axes stay legible.
  const fn = useMemo(() => {
    if (sched === 'power') {
      const f = (t, tt) => (1000 * eta0) / (1 + (r * tt) / s) ** 1 + 0 * t;
      return {
        smooth: (t) => f(t, t),
        stairs: (t) => f(t, Math.floor(t / s) * s),
        ymax: 11,
        tex: `\\eta(t) = \\dfrac{\\eta_0}{(1 + r\\,t/s)^{c}} \\qquad \\eta_0 = 0.01,\\; r = ${r.toFixed(2)},\\; s = ${s},\\; c = 1`,
      };
    }
    if (sched === 'exp') {
      const f = (tt) => 1000 * eta0 * expR ** (tt / s);
      return {
        smooth: (t) => f(t),
        stairs: (t) => f(Math.floor(t / s) * s),
        ymax: 11,
        tex: `\\eta(t) = \\eta_0\\, r^{\\,t/s} \\qquad \\eta_0 = 0.01,\\; r = ${expR.toFixed(2)},\\; s = ${s}`,
      };
    }
    if (sched === 'piecewise') {
      return {
        smooth: (t) => (t < b1 ? 10 : t < bb2 ? 5 : 1),
        ymax: 11,
        tex: `\\text{boundaries} = [${b1},\\, ${bb2}] \\qquad \\text{values} = [0.01,\\, 0.005,\\, 0.001]`,
      };
    }
    if (sched === 'perf') {
      return {
        smooth: (t) => (t < 17 ? 10 : t < 34 ? 10 * factor : 10 * factor * factor),
        ymax: 11,
        tex: `\\eta \\leftarrow \\lambda\\,\\eta \\;\\text{ when val loss stalls} \\qquad \\lambda = ${factor.toFixed(2)},\\; \\text{patience} = 5`,
      };
    }
    // 1cycle
    const p = 1000 * peak;
    const lo = 1000 * eta0;
    return {
      smooth: (t) =>
        t <= 22.5 ? lo + ((p - lo) * t) / 22.5
          : t <= 45 ? p - ((p - lo) * (t - 22.5)) / 22.5
            : lo - ((lo - lo / 100) * (t - 45)) / 5,
      ymax: Math.ceil(p * 1.15),
      tex: `\\eta_0 \\nearrow \\eta_1 \\searrow \\eta_0 \\downarrow \\qquad \\eta_0 = 0.01,\\; \\eta_1 = ${peak.toFixed(3)}`,
    };
  }, [sched, r, s, expR, b1, bb2, factor, peak]);

  const cur = SCHEDULES.find((x) => x.id === sched);
  const showStairs = stair && (sched === 'power' || sched === 'exp');

  const series = [
    { id: 'smooth', label: showStairs ? 'staircase=False' : 'η(t)', color: 'var(--dlv-blue)', f: fn.smooth },
    ...(showStairs ? [{ id: 'stairs', label: 'staircase=True', color: 'var(--dlv-orange)', dash: '5 5', f: fn.stairs }] : []),
  ];

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Learning-schedule explorer · {cur.slides}</span>
        {(sched === 'power' || sched === 'exp') && (
          <label className="dl-check">
            <input type="checkbox" checked={stair} onChange={(e) => setStair(e.target.checked)} />
            staircase=True twin
          </label>
        )}
      </div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Schedule</span>
        <div className="dl-chips">
          {SCHEDULES.map((x) => (
            <button key={x.id} type="button" className={`dl-chip${sched === x.id ? ' dl-chip--on' : ''}`} onClick={() => setSched(x.id)} aria-pressed={sched === x.id}>
              {x.name}
            </button>
          ))}
        </div>
      </div>

      <div className="dl-sliders">
        {sched === 'power' && (
          <>
            <label className="dl-slider">
              <span>decay rate r = {r.toFixed(2)}</span>
              <input type="range" min="0.2" max="2" step="0.1" value={r} onChange={(e) => setR(Number(e.target.value))} />
            </label>
            <label className="dl-slider">
              <span>decay steps s = {s}</span>
              <input type="range" min="5" max="25" step="1" value={s} onChange={(e) => setS(Number(e.target.value))} />
            </label>
          </>
        )}
        {sched === 'exp' && (
          <>
            <label className="dl-slider">
              <span>decay rate r = {expR.toFixed(2)}</span>
              <input type="range" min="0.05" max="0.9" step="0.05" value={expR} onChange={(e) => setExpR(Number(e.target.value))} />
            </label>
            <label className="dl-slider">
              <span>decay steps s = {s}</span>
              <input type="range" min="5" max="25" step="1" value={s} onChange={(e) => setS(Number(e.target.value))} />
            </label>
          </>
        )}
        {sched === 'piecewise' && (
          <>
            <label className="dl-slider">
              <span>boundary 1 = {b1}</span>
              <input type="range" min="5" max="25" step="1" value={b1} onChange={(e) => setB1(Number(e.target.value))} />
            </label>
            <label className="dl-slider">
              <span>boundary 2 = {bb2}</span>
              <input type="range" min="20" max="45" step="1" value={b2} onChange={(e) => setB2(Number(e.target.value))} />
            </label>
          </>
        )}
        {sched === 'perf' && (
          <label className="dl-slider">
            <span>factor λ = {factor.toFixed(2)} (patience = 5)</span>
            <input type="range" min="0.3" max="0.8" step="0.05" value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
          </label>
        )}
        {sched === 'cycle' && (
          <label className="dl-slider">
            <span>peak η₁ = {peak.toFixed(3)}</span>
            <input type="range" min="0.015" max="0.05" step="0.005" value={peak} onChange={(e) => setPeak(Number(e.target.value))} />
          </label>
        )}
      </div>

      <Tex block src={fn.tex} />

      <FnPlot
        series={series}
        xmin={0}
        xmax={50}
        ymin={0}
        ymax={fn.ymax}
        height={280}
        caption={`y axis: learning rate η in units of 10⁻³ · x axis: step t. ${sched === 'perf' ? 'The drops fire when the best validation loss has not improved for 5 consecutive epochs (slide 58: flat at 0.010 until epoch ≈17, then halved — and the val loss immediately finds a lower plateau).' : sched === 'cycle' ? 'Rise to η₁ halfway, fall back to η₀, then drop the last few epochs by orders of magnitude — all linearly (Smith, 2018).' : 'Drag the knobs; the curve is the actual formula.'}`}
      />

      {cur.file ? (
        <Code code={SCHED_CODE[sched]} label={cur.file} meta={cur.slides} />
      ) : (
        <Note label="No Keras one-liner">
          <p>
            The deck describes 1Cycle in prose only (no built-in shown): grow η linearly from{' '}
            <Tex src="\eta_0" /> to <Tex src="\eta_1" /> for the first half of training, back down
            to <Tex src="\eta_0" /> for the second half, then drop by several orders of magnitude
            for the last few epochs. Smith reported good CIFAR10 accuracy in fewer epochs.
          </p>
        </Note>
      )}
    </div>
  );
}

/* ── §9 · Dropout, watched live ──────────────────────────────────────────── */
const DROP_INPUTS = [{ x: 170, y: 250, t: 'x₁' }, { x: 290, y: 250, t: 'x₂' }];
const DROP_HIDDEN = [{ x: 80, y: 150, t: 'h₁' }, { x: 180, y: 150, t: 'h₂' }, { x: 280, y: 150, t: 'h₃' }, { x: 380, y: 150, t: 'h₄' }];
const DROP_OUT = [{ x: 130, y: 50, t: 'o₁' }, { x: 230, y: 50, t: 'o₂' }, { x: 330, y: 50, t: 'o₃' }];

export function DropoutLab() {
  const [p, setP] = useState(0.2);
  const [step, setStep] = useState(1);
  const [test, setTest] = useState(false);

  // Deterministic per (step, p): the same training step always re-draws the same mask.
  const dropped = useMemo(() => {
    if (test) return new Array(6).fill(false);
    const rng = mulberry32(step * 9973 + Math.round(p * 100) * 31 + 4);
    return Array.from({ length: 6 }, () => rng() < p);
  }, [step, p, test]);

  const isDrop = (kind, i) => (kind === 'in' ? dropped[i] : kind === 'hid' ? dropped[2 + i] : false);
  const nDropped = dropped.filter(Boolean).length;

  const edge = (a, b, dead, key) => (
    <line key={key} x1={a.x} y1={a.y - 17} x2={b.x} y2={b.y + 17} className={`dl2-edge${dead ? ' dl2-edge--dead' : ''}`} />
  );

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 11-10 · dropout, one training step at a time</span>
        <label className="dl-check">
          <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
          test time — no dropping
        </label>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <label className="dl-slider">
            <span>dropout rate p = {Math.round(p * 100)}% (typical: 10–50%)</span>
            <input type="range" min="0.1" max="0.5" step="0.05" value={p} onChange={(e) => setP(Number(e.target.value))} disabled={test} />
          </label>
          <span className="dl3-btnrow">
            <button type="button" className="dl-btn" onClick={() => setStep((v) => v + 1)} disabled={test}>
              next training step ▸
            </button>
            <button type="button" className="dl-btn" onClick={() => setStep(1)} disabled={test}>↺</button>
          </span>
        </div>
      </div>

      <div className="dl2-dropgrid">
        <svg viewBox="0 0 520 290" className="dl2-dropnet" aria-label="A small network with dropped neurons crossed out">
          {/* edges first */}
          {DROP_INPUTS.flatMap((a, i) =>
            DROP_HIDDEN.map((b, j) => edge(b, a, isDrop('in', i) || isDrop('hid', j), `ih${i}${j}`)),
          )}
          {DROP_HIDDEN.flatMap((a, j) =>
            DROP_OUT.map((b, k) => edge(b, a, isDrop('hid', j), `ho${j}${k}`)),
          )}
          {/* nodes */}
          {DROP_INPUTS.map((n, i) => (
            <g key={n.t} className={isDrop('in', i) ? 'dl2-node dl2-node--dead' : 'dl2-node dl2-node--in'}>
              <circle cx={n.x} cy={n.y} r={17} />
              <text x={n.x} y={n.y + 4.5} textAnchor="middle" className="dl2-node__t">{n.t}</text>
              {isDrop('in', i) && <path d={`M${n.x - 11} ${n.y - 11} l22 22 m0 -22 l-22 22`} className="dl2-x" />}
            </g>
          ))}
          {DROP_HIDDEN.map((n, j) => (
            <g key={n.t} className={isDrop('hid', j) ? 'dl2-node dl2-node--dead' : 'dl2-node'}>
              <circle cx={n.x} cy={n.y} r={17} />
              <text x={n.x} y={n.y + 4.5} textAnchor="middle" className="dl2-node__t">{n.t}</text>
              {isDrop('hid', j) && <path d={`M${n.x - 11} ${n.y - 11} l22 22 m0 -22 l-22 22`} className="dl2-x" />}
            </g>
          ))}
          {DROP_OUT.map((n) => (
            <g key={n.t} className="dl2-node dl2-node--out">
              <circle cx={n.x} cy={n.y} r={17} />
              <text x={n.x} y={n.y + 4.5} textAnchor="middle" className="dl2-node__t">{n.t}</text>
            </g>
          ))}
          <text x={512} y={254} textAnchor="end" className="dl2-marklabel">inputs — droppable</text>
          <text x={512} y={154} textAnchor="end" className="dl2-marklabel">hidden — droppable</text>
          <text x={512} y={54} textAnchor="end" className="dl2-marklabel">outputs — never dropped</text>
        </svg>

        <div className="dl2-board">
          <p className="dl2-board__title">{test ? 'test time' : `training step ${step}`}</p>
          <p className="dl2-board__big">
            {test ? 'all neurons live' : `${nDropped}/6 dropped`}
          </p>
          <p className="dl-body">
            {test
              ? 'After training, neurons don’t get dropped anymore — you simply use the learned connection weights.'
              : 'Every neuron except the outputs has probability p of being TEMPORARILY ignored this step — it may be back next step.'}
          </p>
        </div>
      </div>

      <Note label="Try this">
        <p>
          Step a few times at p = 20%, then drag p to 50% — half the network vanishes per step, yet
          a different half each time; that’s why the ensemble it implies regularizes so well. Then
          tick <em>test time</em>: the crossing-out stops for good.
        </p>
      </Note>
    </div>
  );
}
