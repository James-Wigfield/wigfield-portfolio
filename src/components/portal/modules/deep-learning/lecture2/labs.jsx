import { useEffect, useMemo, useState } from 'react';
import { Tex, Note, Fnote, Code } from '../kit';
import { FnPlot, LayerFlowChart } from '../plots';
import { ACT_FNS, fmtSci, numDeriv, sigmoid, simulateGradientFlow } from '../mathfns';

/* ============================================================================
   DEEP LEARNING — LECTURE 1 LABS (part 1)
   ----------------------------------------------------------------------------
   The interactive figures for the vanishing-gradients half of the lecture:

     SigmoidSaturation   Figure 11-1 as a live plot (probe the saturating tails)
     GradientFlowLab     a real Monte-Carlo MLP: pick activation × init and
                         watch the forward signal and backward gradient
                         magnitudes layer by layer (with a backprop replay)
     InitLab             Table 11-1 + the Glorot/He/LeCun formulas wired to a
                         fan-in/fan-out calculator and the Keras snippets
     ActivationLab       the activation-function explorer — every variant from
                         slides 10–21 with its full slide content, plus the
                         figure presets (11-2 / 11-3 / 11-4)
     WhichActivation     slide 22 as a scenario picker
   ========================================================================== */

/* ── §1b · Figure 11-1, live ─────────────────────────────────────────────── */
export function SigmoidSaturation() {
  const [showDeriv, setShowDeriv] = useState(true);
  const series = useMemo(() => {
    const s = [
      { id: 'sig', label: 'σ(z)', color: 'var(--dlv-blue)', f: (z) => sigmoid(z) },
      { id: 'lin', label: 'linear approx.', color: 'var(--dlv-green)', dash: '7 5', f: (z) => 0.25 * z + 0.5 },
    ];
    if (showDeriv) s.push({ id: 'dsig', label: 'σ′(z)', color: 'var(--dlv-blue)', dash: '3 4', width: 1.6, f: (z) => sigmoid(z) * (1 - sigmoid(z)) });
    return s;
  }, [showDeriv]);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 11-1 · logistic saturation</span>
        <label className="dl-check">
          <input type="checkbox" checked={showDeriv} onChange={(e) => setShowDeriv(e.target.checked)} />
          show the derivative σ′(z)
        </label>
      </div>
      <FnPlot
        series={series}
        xmin={-5} xmax={5} ymin={-0.2} ymax={1.25} height={300}
        zones={[
          { from: -5, to: -3.5, label: 'Saturating' },
          { from: -0.001, to: 0.001, label: 'Linear' },
          { from: 3.5, to: 5, label: 'Saturating' },
        ]}
        asymptotes={[1]}
        caption="Probe the tails: σ(z) flattens, σ′(z) → 0, and backprop starves. Max slope anywhere: σ′(0) = 0.25."
      />
    </div>
  );
}

/* ── §1c · Gradient-flow Monte-Carlo ─────────────────────────────────────── */
const GF_ACTS = [
  { id: 'sigmoid', label: 'sigmoid' },
  { id: 'tanh', label: 'tanh' },
  { id: 'relu', label: 'ReLU' },
];
const GF_INITS = [
  { id: 'normal1', label: 'N(0, 1) — the old default' },
  { id: 'glorot', label: 'Glorot' },
  { id: 'he', label: 'He' },
];
const GF_PRESETS = [
  { id: 'p1', label: 'The 2010 diagnosis', act: 'sigmoid', init: 'normal1', hint: 'sigmoid + N(0,1): the combination Glorot & Bengio identified' },
  { id: 'p2', label: 'Glorot’s fix', act: 'tanh', init: 'glorot', hint: 'a centred activation + variance-preserving init' },
  { id: 'p3', label: 'Modern default', act: 'relu', init: 'he', hint: 'ReLU + He initialization' },
];

export function GradientFlowLab() {
  const [act, setAct] = useState('sigmoid');
  const [init, setInit] = useState('normal1');
  const [anim, setAnim] = useState(null); // layer being replayed, or null

  const sim = useMemo(() => simulateGradientFlow({ act, init }), [act, init]);

  useEffect(() => {
    if (anim === null) return undefined;
    if (anim <= 1) { const t = setTimeout(() => setAnim(null), 900); return () => clearTimeout(t); }
    const t = setTimeout(() => setAnim(anim - 1), 320);
    return () => clearTimeout(t);
  }, [anim]);

  const ratioTxt = fmtSci(sim.ratio);
  const verdictTxt =
    sim.verdict === 'vanishing'
      ? `vanishing — by layer 1 the gradient is ×${ratioTxt} of the top layer’s`
      : sim.verdict === 'exploding'
        ? `exploding — by layer 1 the gradient is ×${ratioTxt} of the top layer’s`
        : `healthy — the gradient reaching layer 1 is ×${ratioTxt} of the top layer’s`;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Gradient-flow lab · 10-layer MLP, width 32, real forward + backward pass</span>
        <button type="button" className="dl-btn" onClick={() => setAnim(10)} disabled={anim !== null}>
          {anim === null ? '▶ replay backprop' : `backprop at layer ${anim}…`}
        </button>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-ctl">
          <span className="dl-ctl__label">Activation</span>
          <div className="dl-chips">
            {GF_ACTS.map((a) => (
              <button key={a.id} type="button" className={`dl-chip${act === a.id ? ' dl-chip--on' : ''}`} onClick={() => setAct(a.id)} aria-pressed={act === a.id}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="dl-ctl">
          <span className="dl-ctl__label">Weight init</span>
          <div className="dl-chips">
            {GF_INITS.map((i) => (
              <button key={i.id} type="button" className={`dl-chip${init === i.id ? ' dl-chip--on' : ''}`} onClick={() => setInit(i.id)} aria-pressed={init === i.id}>
                {i.label}
              </button>
            ))}
          </div>
        </div>
        <div className="dl-ctl">
          <span className="dl-ctl__label">Recipes</span>
          <div className="dl-chips">
            {GF_PRESETS.map((p) => (
              <button
                key={p.id} type="button" title={p.hint}
                className={`dl-chip dl-chip--ghost${act === p.act && init === p.init ? ' dl-chip--on' : ''}`}
                onClick={() => { setAct(p.act); setInit(p.init); setAnim(null); }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LayerFlowChart layers={sim.layers} highlight={anim} />

      <p className="dl-verdict">
        <span className="dl-verdict__dot" data-v={sim.verdict} aria-hidden="true" />
        <strong>{sim.verdict}</strong>&thinsp;: {verdictTxt.slice(verdictTxt.indexOf('—') + 2)}
      </p>

      <Note label="Try this">
        <p>
          Run the three recipes: <em>sigmoid + N(0,1)</em> dives, <em>ReLU + He</em> stays flat.
          Even <em>sigmoid + Glorot</em> leaks (σ′ ≤ 0.25) — which is why the fixes don’t stop at
          initialization.
        </p>
      </Note>
    </div>
  );
}

/* ── §2 · Initialization lab ─────────────────────────────────────────────── */
const INIT_ROWS = [
  {
    id: 'glorot',
    name: 'Glorot',
    acts: 'None, tanh, sigmoid, softmax',
    sigmaTex: '\\sigma^2 = \\dfrac{1}{\\mathrm{fan}_{\\mathrm{avg}}}',
    keras: '"glorot_uniform"  # the Keras default',
    val: (fi, fo) => 1 / ((fi + fo) / 2),
  },
  {
    id: 'he',
    name: 'He',
    acts: 'ReLU, Leaky ReLU, ELU, GELU, Swish, Mish',
    sigmaTex: '\\sigma^2 = \\dfrac{2}{\\mathrm{fan}_{\\mathrm{in}}}',
    keras: '"he_normal"',
    val: (fi) => 2 / fi,
  },
  {
    id: 'lecun',
    name: 'LeCun',
    acts: 'SELU',
    sigmaTex: '\\sigma^2 = \\dfrac{1}{\\mathrm{fan}_{\\mathrm{in}}}',
    keras: '"lecun_normal"',
    val: (fi) => 1 / fi,
  },
];
const INIT_ACT_CHIPS = [
  { label: 'sigmoid', row: 'glorot' }, { label: 'tanh', row: 'glorot' }, { label: 'softmax', row: 'glorot' }, { label: 'none (linear)', row: 'glorot' },
  { label: 'ReLU', row: 'he' }, { label: 'Leaky ReLU', row: 'he' }, { label: 'ELU', row: 'he' }, { label: 'GELU', row: 'he' }, { label: 'Swish', row: 'he' }, { label: 'Mish', row: 'he' },
  { label: 'SELU', row: 'lecun' },
];

export function InitLab() {
  const [actChip, setActChip] = useState('ReLU');
  const [fanIn, setFanIn] = useState(784);
  const [fanOut, setFanOut] = useState(300);

  const rowId = INIT_ACT_CHIPS.find((c) => c.label === actChip)?.row ?? 'glorot';
  const fi = Math.max(1, Number(fanIn) || 1);
  const fo = Math.max(1, Number(fanOut) || 1);
  const fanAvg = (fi + fo) / 2;
  const rGlorot = Math.sqrt(3 / fanAvg);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Table 11-1 · pick the activation, read off the init</span></div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Activation in your layer</span>
        <div className="dl-chips">
          {INIT_ACT_CHIPS.map((c) => (
            <button key={c.label} type="button" className={`dl-chip${actChip === c.label ? ' dl-chip--on' : ''}`} onClick={() => setActChip(c.label)} aria-pressed={actChip === c.label}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dl-tablewrap">
        <table className="dl-table">
          <caption className="dl-table__cap">Table 11-1. Initialization parameters for each type of activation function.</caption>
          <thead>
            <tr><th>Initialization</th><th>Activation functions</th><th>σ² (Normal)</th><th>σ² with fan_in = {fi}, fan_out = {fo}</th></tr>
          </thead>
          <tbody>
            {INIT_ROWS.map((r) => (
              <tr key={r.id} className={r.id === rowId ? 'dl-table__row--on' : ''}>
                <td>
                  {r.id === rowId && <span className="dl-rowdot" aria-hidden="true" />}
                  {r.name}
                </td>
                <td>{r.acts}</td>
                <td><Tex src={r.sigmaTex} /></td>
                <td className="dl-mono">{r.val(fi, fo).toExponential(2).replace('e-', ' × 10⁻').replace('e+', ' × 10')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dl-fangrid">
        <div className="dl-fans">
          <label className="dl-field">
            <span>fan_in</span>
            <input type="number" min="1" max="65536" value={fanIn} onChange={(e) => setFanIn(e.target.value)} />
          </label>
          <label className="dl-field">
            <span>fan_out</span>
            <input type="number" min="1" max="65536" value={fanOut} onChange={(e) => setFanOut(e.target.value)} />
          </label>
          <div className="dl-fanout">
            <Tex src={`\\mathrm{fan}_{\\mathrm{avg}} = \\tfrac{${fi} + ${fo}}{2} = ${fanAvg}`} />
          </div>
        </div>
        <div className="dl-fanread">
          <p className="dl-fanread__title">Glorot initialization (logistic activation) — slide 7</p>
          <ul className="dl-list">
            <li>
              normal distribution, mean 0, variance{' '}
              <Tex src={`\\sigma^2 = \\frac{1}{\\mathrm{fan}_{\\mathrm{avg}}} = ${(1 / fanAvg).toExponential(2)}`} />
            </li>
            <li>
              or uniform over <Tex src="[-r, +r]" /> with{' '}
              <Tex src={`r = \\sqrt{\\frac{3}{\\mathrm{fan}_{\\mathrm{avg}}}} = ${rGlorot.toFixed(4)}`} />
            </li>
          </ul>
          <p className="dl-fanread__foot">
            fan_in / fan_out = the layer’s input and output unit counts. He et al<Fnote n={3} />{' '}
            derived the ReLU-family variants; SELU prefers LeCun normal.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── §3 · Activation explorer ────────────────────────────────────────────── */
const LEAKY_CODE = `# for tf-2.15 or older
leaky_relu = tf.keras.layers.LeakyReLU(alpha=0.2)  # default alpha=0.3
# for tf-2.16 onward
leaky_relu = tf.keras.layers.LeakyReLU(negative_slope=0.2)  # default negative_slope=0.3
dense = tf.keras.layers.Dense(50, activation=leaky_relu,
                              kernel_initializer="he_normal")

# can also use the leaky_relu function defined under the tf.keras.activations subpackage
dense = tf.keras.layers.Dense(50, activation=tf.keras.activations.leaky_relu, ...)
dense = tf.keras.layers.Dense(50, activation="leaky_relu", ...)

# or use LeakyReLU as a separate layer
model = tf.keras.models.Sequential([
    # [...]  # more layers
    tf.keras.layers.Dense(50, kernel_initializer="he_normal"),  # no activation
    tf.keras.layers.LeakyReLU(negative_slope=0.2),  # activation in a separate layer
    # [...]  # more layers
])`;

const FN_ORDER = ['sigmoid', 'relu', 'leaky', 'elu', 'selu', 'gelu', 'swish', 'mish'];
const INFO_ONLY = ['rrelu', 'prelu'];

const FN_META = {
  sigmoid: { name: 'Sigmoid (logistic)', color: 'var(--dlv-blue)' },
  relu: { name: 'ReLU', color: 'var(--dlv-orange)' },
  leaky: { name: 'Leaky ReLU', color: 'var(--dlv-aqua)' },
  elu: { name: 'ELU', color: 'var(--dlv-yellow)' },
  selu: { name: 'SELU', color: 'var(--dlv-magenta)' },
  gelu: { name: 'GELU', color: 'var(--dlv-green)' },
  swish: { name: 'Swish / SiLU', color: 'var(--dlv-violet)' },
  mish: { name: 'Mish', color: 'var(--dlv-red)' },
  rrelu: { name: 'RReLU', color: 'var(--ink-3)' },
  prelu: { name: 'PReLU', color: 'var(--ink-3)' },
};

const PRESETS = [
  { id: 'fig112', label: 'Fig 11-2 · the leak', sel: ['relu', 'leaky'], focus: 'leaky', view: { xmin: -5, xmax: 5, ymin: -1, ymax: 3.4 }, variant: false },
  { id: 'fig113', label: 'Fig 11-3 · ELU vs SELU', sel: ['elu', 'selu'], focus: 'selu', view: { xmin: -5, xmax: 5, ymin: -2, ymax: 3.4 }, variant: false },
  { id: 'fig114', label: 'Fig 11-4 · the smooth trio', sel: ['gelu', 'swish', 'mish'], focus: 'gelu', view: { xmin: -4, xmax: 2, ymin: -1, ymax: 2 }, variant: true },
];

export function ActivationLab() {
  const [sel, setSel] = useState(['relu', 'leaky']);
  const [focus, setFocus] = useState('leaky');
  const [alpha, setAlpha] = useState(0.2);
  const [eluAlpha, setEluAlpha] = useState(1.0);
  const [beta, setBeta] = useState(1.0);
  const [showDeriv, setShowDeriv] = useState(false);
  const [variant, setVariant] = useState(false);
  const [view, setView] = useState({ xmin: -5, xmax: 5, ymin: -1, ymax: 3.4 });

  const toggle = (id) => {
    if (sel.includes(id)) {
      const next = sel.filter((s) => s !== id);
      setSel(next);
      if (focus === id) setFocus(next[next.length - 1] ?? id);
    } else {
      const next = [...sel, id].slice(-4); // cap at 4 curves — oldest drops off
      setSel(next);
      setFocus(id);
    }
  };

  const applyPreset = (p) => {
    setSel(p.sel);
    setFocus(p.focus);
    setVariant(p.variant);
    setView(p.view);
    setShowDeriv(false);
    if (p.id === 'fig114') setBeta(1.0);
  };

  const mainFn = useMemo(
    () => ({
      sigmoid: (z) => ACT_FNS.sigmoid(z),
      relu: (z) => ACT_FNS.relu(z),
      leaky: (z) => ACT_FNS.leaky(z, { alpha }),
      elu: (z) => ACT_FNS.elu(z, { alpha: eluAlpha }),
      selu: (z) => ACT_FNS.selu(z),
      gelu: (z) => ACT_FNS.gelu(z),
      swish: (z) => ACT_FNS.swish(z, { beta }),
      mish: (z) => ACT_FNS.mish(z),
    }),
    [alpha, eluAlpha, beta],
  );

  const labelFor = (id) =>
    id === 'leaky' ? `Leaky ReLU (α=${alpha.toFixed(2)})`
      : id === 'elu' ? `ELU (α=${eluAlpha.toFixed(2)})`
        : id === 'swish' ? `Swish (β=${beta.toFixed(2)})`
          : id === 'sigmoid' ? 'σ(z)'
            : FN_META[id].name;

  const series = useMemo(() => {
    const out = [];
    sel.forEach((id) => {
      out.push({ id, label: labelFor(id), color: FN_META[id].color, f: mainFn[id] });
      if (showDeriv) out.push({ id: `${id}-d`, label: `${labelFor(id)} ′`, color: FN_META[id].color, dash: '3 4', width: 1.4, f: (z) => numDeriv(mainFn[id], z) });
    });
    if (variant && sel.includes('swish')) {
      out.push({ id: 'swish06', label: 'Swish (β=0.6)', color: 'var(--dlv-violet)', dash: '2 5', f: (z) => ACT_FNS.swish(z, { beta: 0.6 }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, showDeriv, variant, mainFn]);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Activation explorer · overlay up to 4, probe with the pointer</span>
        <label className="dl-check">
          <input type="checkbox" checked={showDeriv} onChange={(e) => setShowDeriv(e.target.checked)} />
          plot derivatives (dashed)
        </label>
      </div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Functions</span>
        <div className="dl-chips">
          {FN_ORDER.map((id) => (
            <button
              key={id} type="button"
              className={`dl-chip dl-chip--fn${sel.includes(id) ? ' dl-chip--on' : ''}${focus === id ? ' dl-chip--focus' : ''}`}
              onClick={() => toggle(id)}
              aria-pressed={sel.includes(id)}
            >
              <span className="dl-chip__dot" style={{ background: FN_META[id].color }} aria-hidden="true" />
              {FN_META[id].name}
            </button>
          ))}
          {INFO_ONLY.map((id) => (
            <button
              key={id} type="button"
              className={`dl-chip dl-chip--fn dl-chip--info${focus === id ? ' dl-chip--focus' : ''}`}
              onClick={() => setFocus(id)}
              title="No curve of its own — see its card"
            >
              {FN_META[id].name} <span className="dl-chip__tag">info</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Figure presets</span>
        <div className="dl-chips">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="dl-chip dl-chip--ghost" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dl-sliders">
        {sel.includes('leaky') && (
          <label className="dl-slider">
            <span>Leaky α = {alpha.toFixed(2)}</span>
            <input type="range" min="0" max="0.5" step="0.01" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
          </label>
        )}
        {sel.includes('elu') && (
          <label className="dl-slider">
            <span>ELU α = {eluAlpha.toFixed(2)}</span>
            <input type="range" min="0.25" max="2.5" step="0.05" value={eluAlpha} onChange={(e) => setEluAlpha(Number(e.target.value))} />
          </label>
        )}
        {sel.includes('swish') && (
          <>
            <label className="dl-slider">
              <span>Swish β = {beta.toFixed(2)}</span>
              <input type="range" min="0.2" max="3" step="0.05" value={beta} onChange={(e) => setBeta(Number(e.target.value))} />
            </label>
            <label className="dl-check">
              <input type="checkbox" checked={variant} onChange={(e) => setVariant(e.target.checked)} />
              also plot Swish β=0.6 (dotted)
            </label>
          </>
        )}
      </div>

      <FnPlot
        series={series}
        xmin={view.xmin} xmax={view.xmax} ymin={view.ymin} ymax={view.ymax}
        height={340}
        caption="Hover (or focus + arrow keys) to read every curve at once."
      />

      <FactCard id={focus} alpha={alpha} eluAlpha={eluAlpha} beta={beta} />
    </div>
  );
}

/* The per-function card — the complete slide content for the focused variant. */
function FactCard({ id, alpha, eluAlpha, beta }) {
  const facts = {
    sigmoid: {
      paper: 'The classic logistic activation — and the culprit of slide 5.',
      tex: '\\sigma(z) = \\dfrac{1}{1 + e^{-z}}',
      body: (
        <ul className="dl-list">
          <li>Saturates at 0 and 1 when inputs get large (negative or positive), with a derivative extremely close to 0 — the vanishing-gradients engine.</li>
          <li>Its mean is 0.5 rather than 0, which keeps shifting the signal off-centre layer after layer (slide 6).</li>
          <li>Paired with the then-popular <Tex src="\mathcal{N}(0,1)" /> weight initialization, it was identified by Glorot and Bengio<Fnote n={1} /> as the cause of the vanishing-gradients problem.</li>
        </ul>
      ),
      keras: 'activation="sigmoid"',
    },
    relu: {
      paper: 'The workhorse — non-saturating for positive values.',
      tex: '\\mathrm{ReLU}(z) = \\max(0, z)',
      body: (
        <ul className="dl-list">
          <li>Commonly used because it does not saturate for positive values<Fnote n={4} /> — and it is very cheap to compute.</li>
          <li><strong>Dying ReLUs:</strong> during training some neurons effectively “die” — they stop outputting anything other than 0. This happens when the input to ReLU is negative (slide 10).</li>
          <li>Not smooth: its derivative jumps at <Tex src="z=0" /> (slide 14).</li>
        </ul>
      ),
      keras: 'activation="relu"',
    },
    leaky: {
      paper: 'The first fix for dying ReLUs — give the negative side a slope.',
      tex: `\\mathrm{LeakyReLU}_{\\alpha}(z) = \\max(\\alpha z,\\; z) \\qquad \\alpha = ${alpha.toFixed(2)}`,
      body: (
        <ul className="dl-list">
          <li><Tex src="\alpha" /> is a small constant, e.g. <Tex src="\alpha = 0.01" /> — the “leak” in Figure 11-2.</li>
          <li>Researchers found a larger leak, e.g. <Tex src="\alpha = 0.2" />, tends to give better performance (slide 11).</li>
          <li>From TensorFlow 2.16 onward the optional parameter <code>alpha</code> is replaced by <code>negative_slope</code> (slide 12).</li>
        </ul>
      ),
      code: LEAKY_CODE,
      codeLabel: 'leaky_relu.py',
      codeMeta: 'slide 12',
    },
    rrelu: {
      paper: 'Randomized leaky ReLU.',
      tex: '\\text{RReLU: leaky ReLU with random } \\alpha',
      body: (
        <ul className="dl-list">
          <li>Same as leaky ReLU except <Tex src="\alpha" /> is picked randomly in a given range during training, and is fixed to an average value during testing (slide 13).</li>
          <li>There is currently no implementation of RReLU in Keras.</li>
          <li>Its curve is the leaky ReLU’s — with the leak jittering while training.</li>
        </ul>
      ),
    },
    prelu: {
      paper: 'Parametric leaky ReLU — let the network learn the leak.',
      tex: '\\text{PReLU: leaky ReLU with } \\alpha \\text{ learned in training}',
      body: (
        <ul className="dl-list">
          <li>Same as RReLU, except <Tex src="\alpha" /> is learned during training together with the connection weights (slide 14).</li>
          <li>Reported to strongly outperform ReLU on large image datasets — but on smaller datasets it runs the risk of overfitting the training set.</li>
          <li>In Keras: replace <code>tf.keras.layers.LeakyReLU</code> with <code>tf.keras.layers.PReLU</code>.</li>
          <li>ReLU, leaky ReLU, RReLU and PReLU all share one flaw: they are not smooth — their derivatives are discontinuous at <Tex src="z = 0" />. The smooth variants are ELU, SELU, Swish and Mish.</li>
        </ul>
      ),
    },
    elu: {
      paper: 'Exponential linear unit — Clevert et al., ICLR 2016.',
      tex: `\\mathrm{ELU}_{\\alpha}(z) = \\begin{cases} \\alpha\\,(e^{z} - 1) & z < 0 \\\\ z & z \\ge 0 \\end{cases} \\qquad \\alpha = ${eluAlpha.toFixed(2)}`,
      body: (
        <ul className="dl-list">
          <li>Takes on negative values when <Tex src="z < 0" />, which helps alleviate the vanishing-gradients problem<Fnote n={5} />.</li>
          <li>Has a non-zero gradient for <Tex src="z < 0" />, avoiding the dead-neurons problem.</li>
          <li>When <Tex src="\alpha = 1" />, the function is smooth everywhere — including at <Tex src="z = 0" />. Drag the α slider and watch the asymptote sit at −α (the slide’s figure plots α = 1 and 2).</li>
        </ul>
      ),
      keras: 'activation="elu"  ·  activation=tf.keras.activations.elu  ·  or add a tf.keras.layers.ELU layer',
    },
    selu: {
      paper: 'Scaled ELU — Klambauer et al., NeurIPS 2017 (“self-normalizing networks”).',
      tex: '\\mathrm{SELU}(z) = s\\,\\mathrm{ELU}_{1.6733}(z), \\qquad s = 1.0507',
      body: (
        <ul className="dl-list">
          <li>The fixed <Tex src="\alpha = 1.6733" /> and scale <Tex src="s = 1.0507" /> are chosen so the mean and variance of the inputs are <em>preserved between consecutive layers</em><Fnote n={6} /> — provided three constraints hold:</li>
          <li>① input features are standardized (mean 0, standard deviation 1); ② every hidden layer’s weights use LeCun normal initialization; ③ no <Tex src="\ell_1" />/<Tex src="\ell_2" /> regularization, max-norm, batch-norm or dropout.</li>
          <li>Because of these constraints, SELU did not gain a lot of traction (slide 16). Compare it to ELU with the Fig 11-3 preset — steeper for <Tex src="z \ge 0" />, asymptote ≈ −1.76.</li>
        </ul>
      ),
      keras: 'activation="selu"  ·  or activation=tf.keras.activations.selu',
    },
    gelu: {
      paper: 'Gaussian error linear unit — Hendrycks & Gimpel, 2016.',
      tex: '\\mathrm{GELU}(z) = z\\,\\Phi(z) \\qquad \\Phi = \\text{standard Gaussian CDF}',
      body: (
        <ul className="dl-list">
          <li>Resembles ReLU: approaches 0 when <Tex src="z" /> is very negative, approaches <Tex src="z" /> when very positive<Fnote n={7} />.</li>
          <li>Unlike every previous activation here it is <em>neither convex nor monotonic</em> — that fairly complex shape may explain why it works so well, especially on complex tasks; in practice it often outperforms the earlier functions.</li>
          <li>Downside: more computationally intense. A faster approximation: <Tex src="z\,\sigma(1.702\,z)" />.</li>
        </ul>
      ),
      keras: 'activation="gelu"',
    },
    swish: {
      paper: 'SiLU (Hendrycks & Gimpel) → rediscovered and generalized as Swish (Ramachandran et al., 2017).',
      tex: `\\mathrm{Swish}_{\\beta}(z) = z\\,\\sigma(\\beta z) \\qquad \\beta = ${beta.toFixed(2)}`,
      body: (
        <ul className="dl-list">
          <li>The <em>sigmoid linear unit</em> (SiLU), <Tex src="z\,\sigma(z)" />, was introduced in the GELU paper — where GELU outperformed it.</li>
          <li>Rediscovered by Ramachandran et al.<Fnote n={8} /> and named <em>Swish</em>; their paper showed it outperforming every other function, including GELU.</li>
          <li>They also generalized it with the hyperparameter <Tex src="\beta" /> — and GELU is approximately Swish with <Tex src="\beta = 1.702" /> (slide the β control there and watch the curves merge).</li>
          <li>From tf-2.16 onward the <code>swish</code> activation has been renamed <code>silu</code>.</li>
        </ul>
      ),
      keras: 'activation="silu"',
    },
    mish: {
      paper: 'Mish — Misra, 2019.',
      tex: '\\mathrm{Mish}(z) = z\\,\\tanh\\!\\big(\\mathrm{softplus}(z)\\big), \\qquad \\mathrm{softplus}(z) = \\log(1 + e^{z})',
      body: (
        <ul className="dl-list">
          <li>Like GELU and Swish it is smooth, non-convex and non-monotonic<Fnote n={9} />.</li>
          <li>Misra’s extensive experiments showed Mish outperforming many activations — including Swish and GELU — by a tiny margin.</li>
          <li>Keras supports GELU and SiLU (<code>activation="gelu"</code> / <code>"silu"</code>) but does <em>not</em> support Mish, nor the generalized Swish, yet (slide 21).</li>
        </ul>
      ),
    },
  };

  const f = facts[id];
  if (!f) return null;
  return (
    <div className="dl-fact" key={id}>
      <div className="dl-fact__head">
        <span className="dl-fact__dot" style={{ background: FN_META[id].color }} aria-hidden="true" />
        <h5 className="dl-fact__name">{FN_META[id].name}</h5>
        <span className="dl-fact__paper">{f.paper}</span>
      </div>
      <Tex src={f.tex} block />
      {f.body}
      {f.keras && (
        <p className="dl-fact__keras">
          <span className="dl-fact__keras-k">Keras</span> <code>{f.keras}</code>
        </p>
      )}
      {f.code && <Code code={f.code} label={f.codeLabel} meta={f.codeMeta} />}
    </div>
  );
}

/* ── §3d · Slide 22 as a scenario picker ─────────────────────────────────── */
const SCENARIOS = [
  {
    id: 'simple',
    label: 'Simple task',
    rec: 'ReLU',
    body: 'ReLU remains a good default for simple tasks: it is fast to compute, supported by every library, and many hardware accelerators provide ReLU-specific optimizations.',
  },
  {
    id: 'complex',
    label: 'Complex task',
    rec: 'SiLU (Swish)',
    body: 'For more complex tasks, SiLU (Swish) is probably a better default. You can also try the parametrized Swish and tune β. Mish may give slightly better results still — at a bit more compute.',
  },
  {
    id: 'latency',
    label: 'Latency is a concern',
    rec: 'Leaky ReLU / PReLU',
    body: 'If runtime latency matters, prefer a simpler activation function such as leaky ReLU or PReLU over the smooth (but heavier) GELU / Swish / Mish family.',
  },
  {
    id: 'deepmlp',
    label: 'Very deep MLP',
    rec: 'SELU',
    body: 'For very deep multi-layer perceptrons, try SELU — but make sure the slide-16 constraints are met: standardized inputs, LeCun normal initialization, and no ℓ1/ℓ2, max-norm, batch-norm or dropout.',
  },
];

export function WhichActivation() {
  const [sc, setSc] = useState('simple');
  const cur = SCENARIOS.find((s) => s.id === sc);
  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Slide 22 · which activation for the hidden layers?</span></div>
      <div className="dl-chips">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" className={`dl-chip${sc === s.id ? ' dl-chip--on' : ''}`} onClick={() => setSc(s.id)} aria-pressed={sc === s.id}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="dl-scenario" key={sc}>
        <p className="dl-scenario__rec">→ {cur.rec}</p>
        <p className="dl-scenario__body">{cur.body}</p>
      </div>
    </div>
  );
}
