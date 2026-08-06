import { useMemo, useState } from 'react';
import { Tex, Note, Fnote, Code, Unfold } from '../kit';
import { BN_BATCH, bnStats } from '../mathfns';
import { QUIZ } from './quiz';

/* ============================================================================
   DEEP LEARNING — LECTURE 1 LABS (part 2)
   ----------------------------------------------------------------------------
     BNLab         batch normalization stepped through on a real minibatch —
                   the four slide-24 equations, with γ and β you can drag
     ClipLab       clipvalue vs clipnorm on a 2-D gradient you steer
     TransferLab   Figure 11-5 + the slide-31 workflow as a phase stepper with
                   synced code highlighting, then the slide-32 results
     Quiz          a check-yourself block built strictly from lecture content
   ========================================================================== */

/* ── §4 · Batch normalization, step by step ─────────────────────────────── */
const BN_STEPS = [
  { title: 'A minibatch arrives', cap: '14 activations of one feature — off-centre (mean ≈ 3.6), spread out.' },
  { title: 'Compute the mean', cap: 'μ_B — one value per feature, from this minibatch alone.' },
  { title: 'Compute the variance', cap: 'σ²_B over the same minibatch; the band is μ_B ± σ_B.' },
  { title: 'Normalize', cap: 'Zero-centre and rescale: mean 0, variance 1. ε just avoids ÷0.' },
  { title: 'Scale & shift', cap: 'γ and β are TRAINABLE — drag them. Output mean = β, std = γ, wherever the batch started.' },
];

const BN_EQS = [
  '\\mu_B = \\frac{1}{m_B}\\sum_{i=1}^{m_B} \\mathbf{x}^{(i)}',
  '\\sigma_B^2 = \\frac{1}{m_B}\\sum_{i=1}^{m_B}\\big(\\mathbf{x}^{(i)} - \\mu_B\\big)^2',
  '\\hat{\\mathbf{x}}^{(i)} = \\frac{\\mathbf{x}^{(i)} - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}}',
  '\\mathbf{z}^{(i)} = \\gamma \\otimes \\hat{\\mathbf{x}}^{(i)} + \\beta',
];

export function BNLab() {
  const [step, setStep] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [beta, setBeta] = useState(0);

  const stats = useMemo(() => bnStats(BN_BATCH), []);
  const xhat = useMemo(() => BN_BATCH.map((x) => (x - stats.mu) / Math.sqrt(stats.var + 1e-3)), [stats]);

  const pos = (i) => (step < 3 ? BN_BATCH[i] : step === 3 ? xhat[i] : gamma * xhat[i] + beta);
  const curMean = step < 3 ? stats.mu : step === 3 ? 0 : beta;
  const curSd = step < 3 ? stats.sd : step === 3 ? 1 : Math.abs(gamma);

  const W = 760;
  const X0 = -4.5;
  const X1 = 8.5;
  const sx = (v) => ((Math.min(Math.max(v, X0), X1) - X0) / (X1 - X0)) * (W - 40) + 20;
  // Which equation the current step is about (step 0 has no equation yet).
  const activeEq = step - 1;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Batch-norm walkthrough · slide 24’s algorithm on a real minibatch</span>
        <div className="dl-stepper">
          <button type="button" className="dl-btn" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← prev</button>
          <span className="dl-stepper__pips" aria-hidden="true">
            {BN_STEPS.map((_, i) => <span key={i} className={`dl-pip${i === step ? ' dl-pip--on' : ''}`} />)}
          </span>
          <button type="button" className="dl-btn" onClick={() => setStep(Math.min(BN_STEPS.length - 1, step + 1))} disabled={step === BN_STEPS.length - 1}>next →</button>
        </div>
      </div>

      <p className="dl-steptitle">
        <span className="dl-steptitle__no">step {step + 1}/5</span> <strong>{BN_STEPS[step].title}</strong> — {BN_STEPS[step].cap}
      </p>

      <div className="dl-bnstage">
        <svg viewBox={`0 0 ${W} 168`} className="dl-bnsvg" aria-label="Minibatch values on a number line">
          {/* axis + ticks */}
          <line x1={20} y1={64} x2={W - 20} y2={64} className="dl-plot__axis" />
          {[-4, -2, 0, 2, 4, 6, 8].map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={60} x2={sx(t)} y2={68} className="dl-plot__axis" />
              <text x={sx(t)} y={84} textAnchor="middle" className="dl-plot__tick">{t}</text>
            </g>
          ))}

          {/* ±σ band */}
          {step >= 2 && (
            <rect
              x={sx(curMean - curSd)} y={38}
              width={Math.max(sx(curMean + curSd) - sx(curMean - curSd), 2)} height={52}
              className="dl-bnband"
            />
          )}

          {/* μ marker */}
          {step >= 1 && (
            <g className="dl-bnmu" style={{ transform: `translateX(${sx(curMean)}px)` }}>
              <line x1={0} y1={26} x2={0} y2={96} />
              <text x={0} y={18} textAnchor="middle" className="dl-bnmu__label">
                {step < 3 ? 'μ_B' : step === 3 ? 'mean 0' : 'mean = β'}
              </text>
            </g>
          )}

          {/* the minibatch (positions animate between steps) */}
          {BN_BATCH.map((_, i) => (
            <circle
              key={i}
              cx={0} cy={64} r={6.5}
              className="dl-bndot"
              style={{ transform: `translateX(${sx(pos(i))}px)` }}
            />
          ))}

          {/* raw ghost row for comparison once things start moving */}
          <g style={{ opacity: step >= 3 ? 1 : 0, transition: 'opacity 0.4s' }}>
            <text x={20} y={126} className="dl-plot__tick">raw minibatch (for comparison):</text>
            {BN_BATCH.map((x, i) => (
              <circle key={i} cx={sx(x)} cy={142} r={4} className="dl-bndot dl-bndot--ghost" />
            ))}
          </g>
        </svg>

        {step === 4 && (
          <div className="dl-sliders">
            <label className="dl-slider">
              <span><Tex src="\gamma" /> (scale) = {gamma.toFixed(2)}</span>
              <input type="range" min="0.2" max="3" step="0.05" value={gamma} onChange={(e) => setGamma(Number(e.target.value))} />
            </label>
            <label className="dl-slider">
              <span><Tex src="\beta" /> (shift) = {beta.toFixed(2)}</span>
              <input type="range" min="-3" max="3" step="0.05" value={beta} onChange={(e) => setBeta(Number(e.target.value))} />
            </label>
          </div>
        )}

        <p className="dl-bnread">
          μ_B = {stats.mu.toFixed(2)} · σ²_B = {stats.var.toFixed(2)} · current batch: mean {curMean.toFixed(2)}, std {curSd.toFixed(2)}
        </p>
      </div>

      <div className="dl-bneqs">
        {BN_EQS.map((eq, i) => (
          <div key={i} className={`dl-bneq${i === activeEq ? ' dl-bneq--on' : ''}${activeEq >= 0 && i > activeEq ? ' dl-bneq--todo' : ''}`}>
            <Tex src={eq} block />
          </div>
        ))}
      </div>

      <Unfold label="What the symbols mean (slide 24) — and what happens at test time">
        <p className="dl-body">
          <Tex src="m_B" /> = instances in the minibatch; <Tex src="\mu_B" />, <Tex src="\sigma_B^2" /> =
          mean and variance vectors over minibatch <Tex src="B" />; <Tex src="\hat{\mathbf{x}}^{(i)}" /> =
          the zero-centred, normalized input used inside the BN layer; <Tex src="\gamma" />,{' '}
          <Tex src="\beta" /> = the trainable scale and shift vectors (one parameter per feature);{' '}
          <Tex src="\otimes" /> = element-wise multiplication.
        </p>
        <p className="dl-body">
          At <em>test</em> time there is no minibatch to average over — the whole-training-set mean
          and variance are estimated during training with a moving average over minibatches, and
          those estimates are used for predictions (slide 23).
        </p>
      </Unfold>
    </div>
  );
}

/* ── §5 · Gradient clipping ──────────────────────────────────────────────── */
const CLIP_S = 46; // px per unit
const CLIP_C = 180; // canvas centre
const px = (x) => CLIP_C + CLIP_S * x;
const py = (y) => CLIP_C - CLIP_S * y;

function Arrow({ v, color, dash, width = 2.4 }) {
  const [x, y] = v;
  const a = Math.atan2(-y, x);
  const hx = px(x);
  const hy = py(y);
  const L = 9;
  return (
    <g>
      <line x1={CLIP_C} y1={CLIP_C} x2={hx} y2={hy} stroke={color} strokeWidth={width} strokeDasharray={dash} />
      <polygon
        points={`${hx},${hy} ${hx - L * Math.cos(a - 0.42)},${hy - L * Math.sin(a - 0.42)} ${hx - L * Math.cos(a + 0.42)},${hy - L * Math.sin(a + 0.42)}`}
        fill={color}
      />
    </g>
  );
}

export function ClipLab() {
  const [gx, setGx] = useState(2.2);
  const [gy, setGy] = useState(1.4);

  const norm = Math.hypot(gx, gy);
  const cv = [Math.max(-1, Math.min(1, gx)), Math.max(-1, Math.min(1, gy))];
  const cn = norm > 1 ? [gx / norm, gy / norm] : [gx, gy];
  const deg = (v) => (v * 180) / Math.PI;
  const dAngle = Math.abs(deg(Math.atan2(gy, gx) - Math.atan2(cv[1], cv[0])));
  const dAngleN = dAngle > 180 ? 360 - dAngle : dAngle;
  const unclipped = Math.abs(gx) <= 1 && Math.abs(gy) <= 1;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Clipping lab · steer a 2-D gradient, threshold = 1.0</span></div>

      <div className="dl-clipgrid">
        <svg viewBox="0 0 360 360" className="dl-clipsvg" aria-label="Gradient vector with clipvalue and clipnorm results">
          {[-3, -2, -1, 1, 2, 3].map((t) => (
            <g key={t}>
              <line x1={px(t)} y1={0} x2={px(t)} y2={360} className="dl-plot__grid" />
              <line x1={0} y1={py(t)} x2={360} y2={py(t)} className="dl-plot__grid" />
            </g>
          ))}
          <line x1={0} y1={CLIP_C} x2={360} y2={CLIP_C} className="dl-plot__axis" />
          <line x1={CLIP_C} y1={0} x2={CLIP_C} y2={360} className="dl-plot__axis" />

          {/* bounds */}
          <rect x={px(-1)} y={py(1)} width={2 * CLIP_S} height={2 * CLIP_S} className="dl-clipbox" />
          <circle cx={CLIP_C} cy={CLIP_C} r={CLIP_S} className="dl-clipcircle" />
          <text x={px(1) + 4} y={py(1) - 4} className="dl-plot__tick" style={{ fill: 'var(--dlv-orange)' }}>clipvalue box</text>
          <text x={CLIP_C + 5} y={py(-1) + 14} className="dl-plot__tick" style={{ fill: 'var(--dlv-blue)' }}>clipnorm circle</text>

          <Arrow v={[gx, gy]} color="var(--ink-3)" dash="5 4" />
          <Arrow v={cv} color="var(--dlv-orange)" />
          <Arrow v={cn} color="var(--dlv-blue)" />
        </svg>

        <div className="dl-clippanel">
          <label className="dl-slider">
            <span>∂L/∂w₁ = {gx.toFixed(2)}</span>
            <input type="range" min="-3" max="3" step="0.05" value={gx} onChange={(e) => setGx(Number(e.target.value))} />
          </label>
          <label className="dl-slider">
            <span>∂L/∂w₂ = {gy.toFixed(2)}</span>
            <input type="range" min="-3" max="3" step="0.05" value={gy} onChange={(e) => setGy(Number(e.target.value))} />
          </label>

          <div className="dl-cliprows">
            <p className="dl-cliprow">
              <span className="dl-tip__key" style={{ background: 'var(--ink-3)' }} />
              <strong>raw</strong> ({gx.toFixed(2)}, {gy.toFixed(2)}) · ‖g‖ = {norm.toFixed(2)}
            </p>
            <p className="dl-cliprow">
              <span className="dl-tip__key" style={{ background: 'var(--dlv-orange)' }} />
              <strong>clipvalue=1.0</strong> ({cv[0].toFixed(2)}, {cv[1].toFixed(2)}) — each component clamped to [−1, 1]
              {!unclipped && dAngleN > 0.5 && <> · direction changed by {dAngleN.toFixed(0)}°</>}
            </p>
            <p className="dl-cliprow">
              <span className="dl-tip__key" style={{ background: 'var(--dlv-blue)' }} />
              <strong>clipnorm=1.0</strong> ({cn[0].toFixed(2)}, {cn[1].toFixed(2)}) — whole vector rescaled, direction preserved
            </p>
            {unclipped && <p className="dl-cliprow dl-cliprow--muted">‖components‖ ≤ 1 — nothing to clip; all three vectors coincide.</p>}
          </div>
        </div>
      </div>

      <Code
        label="clip.py"
        meta="slide 29"
        code={`optimizer = tf.keras.optimizers.SGD(clipvalue=1.0)
model.compile(loss="mse", optimizer=optimizer)`}
      />
      <p className="dl-body">
        One argument, that’s it — <code>clipvalue</code> clamps each component to ±1.0; swap in{' '}
        <code>clipnorm=1.0</code> to rescale the whole vector and keep its orientation
        <Fnote n={11} />.
      </p>
    </div>
  );
}

/* ── §6 · Transfer learning ──────────────────────────────────────────────── */
const TL_CODE = `# assuming the trained model_A is saved to "my_model_A.keras"
model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))

# freeze the reused layers for the first epochs
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = False
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
# for example, train the model for 4 epochs
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=4, validation_data=(X_valid_B, y_valid_B))

# unfreeze the layers and train for 16 epochs. Note that the model needs to be recompiled
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = True
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=16, validation_data=(X_valid_B, y_valid_B))`;

const TL_PHASES = [
  { title: 'A trained model for task A', hl: [1, 2], cap: 'model_A already knows 8 Fashion-MNIST classes. Your task B: T-shirt vs pullover — with only 200 labelled images.' },
  { title: 'Clone it, swap the head', hl: [3, 4], cap: 'Keep every layer except the output — it has the wrong number of outputs for task B. One sigmoid unit replaces it.' },
  { title: 'Freeze, train 4 epochs', hl: [6, 7, 8, 9, 10, 11, 12], cap: 'Lock the reused weights so the fresh head learns sensible values without wrecking them.' },
  { title: 'Unfreeze, recompile, fine-tune 16 epochs', hl: [14, 15, 16, 17, 18, 19], cap: 'Now the whole stack adapts. Recompiling after (un)freezing is mandatory.' },
];

function Padlock({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" className="dl-lock" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.8" fill="none" stroke="currentColor" strokeWidth="2" />
      {open
        ? <path d="M8 11V7.5A4 4 0 0 1 15.6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        : <path d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export function TransferLab() {
  const [phase, setPhase] = useState(0);
  const [reuse, setReuse] = useState(3); // hidden layers of A reused in B

  const aLayers = ['Output', 'Hidden 5', 'Hidden 4', 'Hidden 3', 'Hidden 2', 'Hidden 1', 'Input layer'];
  const bLayers = ['Output (new)', 'Hidden 4', 'Hidden 3', 'Hidden 2', 'Hidden 1', 'Input layer'];

  // Row semantics for B (top → bottom): index 0 head, 1..4 hidden 4..1, 5 input.
  const rowState = (i) => {
    if (phase === 0) return 'hidden';
    const isHead = i === 0;
    const hiddenNo = i >= 1 && i <= 4 ? 5 - i : null; // Hidden N number
    const reused = !isHead && (i === 5 || (hiddenNo !== null && hiddenNo <= reuse));
    if (isHead) return phase >= 2 ? 'trainable' : 'new';
    if (!reused) return phase >= 2 ? 'trainable' : 'new';
    if (phase === 2) return 'frozen';
    if (phase === 3) return 'trainable';
    return 'reused';
  };

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Transfer-learning walkthrough · Figure 11-5 + the slide-31 workflow</span>
        <div className="dl-stepper">
          <button type="button" className="dl-btn" onClick={() => setPhase(Math.max(0, phase - 1))} disabled={phase === 0}>← prev</button>
          <span className="dl-stepper__pips" aria-hidden="true">
            {TL_PHASES.map((_, i) => <span key={i} className={`dl-pip${i === phase ? ' dl-pip--on' : ''}`} />)}
          </span>
          <button type="button" className="dl-btn" onClick={() => setPhase(Math.min(TL_PHASES.length - 1, phase + 1))} disabled={phase === TL_PHASES.length - 1}>next →</button>
        </div>
      </div>

      <p className="dl-steptitle">
        <span className="dl-steptitle__no">phase {phase + 1}/4</span> <strong>{TL_PHASES[phase].title}</strong> — {TL_PHASES[phase].cap}
      </p>

      <div className="dl-tlgrid">
        <div className="dl-tldiagram">
          <div className="dl-tlstacks">
            <div className="dl-tlstack">
              <p className="dl-tlstack__cap">Existing DNN for task A</p>
              {aLayers.map((l) => (
                <div key={l} className={`dl-tlayer${l === 'Input layer' ? ' dl-tlayer--input' : ''}`}>{l}</div>
              ))}
            </div>
            <div className="dl-tlarrows" aria-hidden="true">
              {bLayers.map((_, i) => {
                const hiddenNo = i >= 1 && i <= 4 ? 5 - i : null;
                const reusedRow = phase >= 1 && i !== 0 && (i === 5 || (hiddenNo !== null && hiddenNo <= reuse));
                return (
                  <span key={i} className={`dl-tlarrow${reusedRow ? ' dl-tlarrow--on' : ''}`}>
                    {reusedRow ? (hiddenNo === reuse ? '⟶ reuse' : '⟶') : ''}
                  </span>
                );
              })}
            </div>
            <div className={`dl-tlstack${phase === 0 ? ' dl-tlstack--ghost' : ''}`}>
              <p className="dl-tlstack__cap">New DNN for similar task B</p>
              {bLayers.map((l, i) => {
                const st = rowState(i);
                return (
                  <div key={l} className={`dl-tlayer dl-tlayer--${st}${l === 'Input layer' ? ' dl-tlayer--input' : ''}`}>
                    <span>{l}</span>
                    {st === 'frozen' && <span className="dl-tlayer__state"><Padlock open={false} /> frozen</span>}
                    {st === 'trainable' && <span className="dl-tlayer__state"><Padlock open /> trainable</span>}
                    {st === 'new' && <span className="dl-tlayer__state">fresh weights</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="dl-slider dl-slider--tl">
            <span>hidden layers reused from A: {reuse}</span>
            <input type="range" min="1" max="4" step="1" value={reuse} onChange={(e) => setReuse(Number(e.target.value))} />
          </label>
          <p className="dl-tlhint">
            More similar tasks → reuse more layers (from the bottom up). Very similar? Keep every
            hidden layer, replace only the output.
          </p>
        </div>

        <Code code={TL_CODE} label="transfer_b_on_a.py" meta="slide 31" hl={TL_PHASES[phase].hl} />
      </div>

      <TransferResults />
    </div>
  );
}

function TransferResults() {
  const before = 8.15;
  const after = 6.15;
  return (
    <div className="dl-tlresults">
      <div className="dl-stats">
        <div className="dl-stat">
          <p className="dl-stat__k">model_B — from scratch, 200 images</p>
          <p className="dl-stat__v">91.85<span className="dl-stat__unit">%</span></p>
          <p className="dl-stat__sub">test accuracy</p>
        </div>
        <div className="dl-stat">
          <p className="dl-stat__k">model_B_on_A — transfer learning</p>
          <p className="dl-stat__v">93.85<span className="dl-stat__unit">%</span></p>
          <p className="dl-stat__sub">test accuracy · +2.0 points</p>
        </div>
        <div className="dl-stat">
          <p className="dl-stat__k">relative error-rate reduction</p>
          <p className="dl-stat__v">≈25<span className="dl-stat__unit">%</span></p>
          <p className="dl-stat__sub">(8.15 − 6.15) / 8.15</p>
        </div>
      </div>

      <div className="dl-errbars">
        <p className="dl-errbars__title">Error rate (test)</p>
        {[{ k: 'model_B', v: before, cls: 'muted' }, { k: 'model_B_on_A', v: after, cls: 'blue' }].map((b) => (
          <div key={b.k} className="dl-errbar">
            <span className="dl-errbar__k">{b.k}</span>
            <span className="dl-errbar__track">
              <span className={`dl-errbar__fill dl-errbar__fill--${b.cls}`} style={{ width: `${(b.v / 10) * 100}%` }} />
            </span>
            <span className="dl-errbar__v">{b.v.toFixed(2)}%</span>
          </div>
        ))}
        <p className="dl-errbars__axis">0% — 10% scale</p>
      </div>

      <Code
        label="console"
        meta="slide 32"
        code={`>>> model_B_on_A.evaluate(X_test_B, y_test_B)
[0.2546142041683197, 0.9384999871253967]`}
      />

      <Note label="The fine print" tone="warn">
        <p>
          These numbers came from the author’s many trials of configuration (like setting the
          random seed to different values). In general, transfer learning does <em>not</em> work
          well with small dense networks — it works well with deep convolutional neural networks
          (slide 32).
        </p>
      </Note>
    </div>
  );
}

/* ── §8 · Check yourself (data in ./quiz.js; state lives in the page shell
       so the Quiz tab can wear the live score). Shared by every lecture —
       pass a different `quiz` array to reuse it. ────────────────────────── */
export function Quiz({ quiz = QUIZ, answers, onAnswer, onReset }) {
  const answered = Object.keys(answers).length;
  const score = Object.entries(answers).filter(([i, a]) => quiz[Number(i)].ans === a).length;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">
          {answered === 0 ? 'Ten questions, straight from the slides' : `Score: ${score}/${answered} answered (${quiz.length} total)`}
        </span>
        {answered > 0 && (
          <button type="button" className="dl-btn" onClick={onReset}>reset</button>
        )}
      </div>

      <ol className="dl-quiz">
        {quiz.map((item, qi) => {
          const picked = answers[qi];
          const done = picked !== undefined;
          return (
            <li key={qi} className="dl-quiz__item">
              <p className="dl-quiz__q">{item.q}</p>
              <div className="dl-quiz__opts">
                {item.opts.map((opt, oi) => {
                  const state = !done ? '' : oi === item.ans ? ' dl-quiz__opt--right' : oi === picked ? ' dl-quiz__opt--wrong' : ' dl-quiz__opt--dim';
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={`dl-quiz__opt${state}`}
                      disabled={done}
                      onClick={() => onAnswer(qi, oi)}
                    >
                      <span className="dl-quiz__mark" aria-hidden="true">{String.fromCharCode(97 + oi)}</span>
                      {opt}
                      {done && oi === item.ans && <span className="dl-quiz__verdict">✓ correct</span>}
                      {done && oi === picked && oi !== item.ans && <span className="dl-quiz__verdict">✗ your pick</span>}
                    </button>
                  );
                })}
              </div>
              {done && (
                <p className="dl-quiz__why">
                  {item.why} <span className="dl-quiz__slide">· slide {item.slide}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
