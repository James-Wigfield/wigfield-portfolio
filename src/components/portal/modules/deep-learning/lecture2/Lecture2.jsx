import { useRef, useState } from 'react';
import { Tex, Fnote, Code, Section, Hook, Fact, Unfold, RefsProvider, Outline, Sub, Eq, Jot } from '../kit';
import { SigmoidSaturation, GradientFlowLab, InitLab, ActivationLab, WhichActivation } from './labs';
import { BNLab, ClipLab, TransferLab, Quiz } from './labs2';
import { OptimizerRaceLab, OptimizerTable, ScheduleLab, DropoutLab } from './labs3';
import { QUIZ, scoreOf } from './quiz';
import '../common.css';
import './lecture2.css';

/* ============================================================================
   CITS5017 · LECTURE 2 — TOPIC 2: TRAINING DEEP NEURAL NETWORKS
   ----------------------------------------------------------------------------
   The full content of Documents/cits5017/markdown-lecs/lecture-2.md (all 68
   slides) as a TABBED interactive page — laid out as a NOTETAKING SPINE:
   every tab opens with its numbered skeleton (Outline), walks numbered subs
   (Sub n.m: concept → lab), and closes with a tickable "Note it down" recap
   (Jot) holding exactly what belongs in the notebook.

     START        level-select + the deck's roadmap (slides 1–3) + sources
     PROBLEM      slides 4–6    sigmoid saturation + gradient-flow lab
     INIT         slides 7–9    Glorot/He/LeCun lab + Keras
     ACTIVATIONS  slides 10–22  the explorer + every variant's card
     BATCH NORM   slides 23–28  the 4 equations, stepped, with draggable γ/β
     CLIPPING     slide 29      clipvalue vs clipnorm on a steerable vector
     TRANSFER     slides 30–32  Figure 11-5 walkthrough + results
     OPTIMIZERS   slides 33–47  Momentum → AdamW, raced live on the bowl
     LR SCHEDULES slides 48–59  the five schedules, live curves + Keras
     REGULARIZE   slides 60–64  ℓ1/ℓ2 + dropout you can watch
     DEFAULTS     slides 65–68  Tables 11-3/11-4 + the outcomes checklist
     QUIZ         20 questions; the tab wears the live score

   Long slide passages live in <Unfold> rows, citations in <Fnote> popovers —
   everything from the deck is here, none of it as a wall of text.
   ========================================================================== */

const REFS = {
  1: 'Xavier Glorot and Yoshua Bengio, “Understanding the Difficulty of Training Deep Feedforward Neural Networks,” Proc. 13th Int. Conf. on Artificial Intelligence and Statistics (2010): 249–256.',
  2: 'Xavier Glorot and Yoshua Bengio, “Understanding the Difficulty of Training Deep Feedforward Neural Networks,” Proc. 13th Int. Conf. on Artificial Intelligence and Statistics (2010): 249–256.',
  3: 'Kaiming He et al., “Delving Deep into Rectifiers: Surpassing Human-Level Performance on ImageNet Classification,” CVPR 2015, 1026–1034.',
  4: 'ReLU (rectified linear unit): ReLU(z) = max(0, z).',
  5: 'Djork-Arné Clevert et al., “Fast and Accurate Deep Network Learning by Exponential Linear Units (ELUs),” ICLR 2016.',
  6: 'Günter Klambauer et al., “Self-Normalizing Neural Networks,” Proc. 31st NeurIPS (2017): 972–981.',
  7: 'Dan Hendrycks and Kevin Gimpel, “Gaussian Error Linear Units (GELUs),” arXiv:1606.08415 (2016).',
  8: 'Prajit Ramachandran et al., “Searching for Activation Functions,” arXiv:1710.05941 (2017).',
  9: 'Diganta Misra, “Mish: A Self Regularized Non-Monotonic Activation Function,” arXiv:1908.08681 (2019).',
  10: 'Sergey Ioffe and Christian Szegedy, “Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift,” ICML (2015): 448–456.',
  11: 'Razvan Pascanu et al., “On the Difficulty of Training Recurrent Neural Networks,” ICML (2013): 1310–1318.',
  12: 'Yurii Nesterov, “A Method for Unconstrained Convex Minimization Problem with the Rate of Convergence O(1/k²),” Doklady AN USSR 269 (1983): 543–547.',
  13: 'John Duchi et al., “Adaptive Subgradient Methods for Online Learning and Stochastic Optimization,” Journal of Machine Learning Research 12 (2011): 2121–2159.',
  14: 'RMSProp — created by Tijmen Tieleman and Geoffrey Hinton in 2012.',
  15: 'Diederik Kingma and Jimmy Ba, “Adam: A Method for Stochastic Optimization” (2014).',
  16: 'AdaMax — from the same Adam paper (Kingma & Ba, 2014).',
  17: 'Timothy Dozat, “Incorporating Nesterov Momentum into Adam” (2016).',
  18: 'Ashia C. Wilson et al., “The Marginal Value of Adaptive Gradient Methods in Machine Learning,” Advances in NIPS 30 (2017): 4148–4158.',
  19: 'Leslie N. Smith, “A Disciplined Approach to Neural Network Hyper-Parameters: Part 1 — Learning Rate, Batch Size, Momentum, and Weight Decay,” arXiv:1803.09820 (2018).',
  20: 'Geoffrey Hinton et al., “Improving Neural Networks by Preventing Co-adaptation of Feature Detectors” (2012).',
};

const TABS = [
  { id: 'start', label: 'Start', no: '00' },
  { id: 'problem', label: 'The Problem', no: '01', slides: '4–6', hook: 'Ten layers down, the gradient is gone.' },
  { id: 'init', label: 'Init', no: '02', slides: '7–9', hook: 'Start the weights where the signal survives.' },
  { id: 'acts', label: 'Activations', no: '03', slides: '10–22', hook: 'ReLU dies. Meet a decade of fixes.' },
  { id: 'bn', label: 'Batch Norm', no: '04', slides: '23–28', hook: 'Re-centre every layer, on every batch.' },
  { id: 'clip', label: 'Clipping', no: '05', slides: '29', hook: 'When gradients explode, cap them.' },
  { id: 'transfer', label: 'Transfer', no: '06', slides: '30–32', hook: 'Don’t train from scratch — steal layers.' },
  { id: 'opt', label: 'Optimizers', no: '07', slides: '33–47', hook: 'Gradient descent, but with memory.' },
  { id: 'sched', label: 'LR Schedules', no: '08', slides: '48–59', hook: 'Start hot, cool down on cue.' },
  { id: 'reg', label: 'Regularize', no: '09', slides: '60–64', hook: 'Kill neurons at random — on purpose.' },
  { id: 'defaults', label: 'Defaults', no: '10', slides: '65–68', hook: 'The config to write down first.' },
  { id: 'quiz', label: 'Quiz', no: '11', slides: 'all', hook: 'Prove it.' },
];

const LEVEL_BLURBS = {
  problem: 'Watch a 10-layer net starve — live.',
  init: 'Glorot · He · LeCun, matched to your activation.',
  acts: '8 curves, 3 famous figures, 1 explorer.',
  bn: 'The 4-line algorithm, with γ and β you can drag.',
  clip: 'clipvalue vs clipnorm on a vector you steer.',
  transfer: 'Freeze → fit → unfreeze: +2 points from 200 images.',
  opt: 'Race SGD → Adam on the elongated bowl.',
  sched: '5 schedules, live curves, the exact Keras lines.',
  reg: 'ℓ2 in one argument; dropout you can watch.',
  defaults: 'Tables 11-3 & 11-4 — memorise these two.',
  quiz: '20 questions, instant verdicts, slide receipts.',
};

const INIT_CODE_1 = `import tensorflow as tf
tf.keras.layers.Dense(10, activation="relu", kernel_initializer="he_normal")`;

const INIT_CODE_2 = `he_avg_init = tf.keras.initializers.VarianceScaling(scale=2., mode="fan_avg",
                                                    distribution="uniform")
dense = tf.keras.layers.Dense(50, activation="sigmoid",
                              kernel_initializer=he_avg_init)`;

const BN_CODE_AFTER = `model = keras.models.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(300, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(100, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(10, activation="softmax")
])`;

const BN_CODE_BEFORE = `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(300, kernel_initializer="he_normal",
                          use_bias=False),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Activation("relu"),
    tf.keras.layers.Dense(100, kernel_initializer="he_normal",
                          use_bias=False),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Activation("relu"),
    tf.keras.layers.Dense(10, activation="softmax")
])`;

const MOMENTUM_CODE = `# standard SGD optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)

# Momentum optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001, momentum=0.9)`;

const NAG_CODE = `optimizer = tf.keras.optimizers.SGD(learning_rate=0.001,
                                    momentum=0.9, nesterov=True)`;

const ADAPTIVE_CODE = `# AdaGrad — do NOT use it to train deep neural networks (stops too early)
optimizer = tf.keras.optimizers.Adagrad(learning_rate=0.001)

# RMSProp — accumulates only the most recent gradients (decay rho=0.9)
optimizer = tf.keras.optimizers.RMSprop(learning_rate=0.001, rho=0.9)`;

const ADAM_CODE = `optimizer = tf.keras.optimizers.Adam(learning_rate=0.001,
                                     beta_1=0.9, beta_2=0.999)`;

const ADAM_VARIANTS_CODE = `# AdaMax
optimizer = tf.keras.optimizers.Adamax(learning_rate=0.001,
                                       beta_1=0.9, beta_2=0.999)
# Nadam
optimizer = tf.keras.optimizers.Nadam(learning_rate=0.001,
                                      beta_1=0.9, beta_2=0.999)
# AdamW  (you may need to also fine tune weight_decay)
optimizer = tf.optimizers.AdamW(weight_decay=1e-5, learning_rate=0.001,
                                beta_1=0.9, beta_2=0.999)`;

const CUSTOM_SCHED_CODE = `def exponential_decay(lr0, s):
    def exp_decay_fn(epoch):
        return lr0 * 0.1**(epoch / s)
    return exp_decay_fn

my_exp_decay_fn = exponential_decay(lr0=0.01, s=20)
lr_scheduler = tf.keras.callbacks.LearningRateScheduler(my_exp_decay_fn)
history = model.fit(X_train, y_train, ..., callbacks=[lr_scheduler])`;

const L2_CODE = `layer = tf.keras.layers.Dense(100, activation="elu",
                              kernel_initializer="he_normal",
                              kernel_regularizer=tf.keras.regularizers.l2(0.01))`;

const PARTIAL_CODE = `from functools import partial

RegularizedDense = partial(tf.keras.layers.Dense,
                           activation="relu",
                           kernel_initializer="he_normal",
                           kernel_regularizer=tf.keras.regularizers.l2(0.01))

model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),                  # layer 0
    RegularizedDense(100),                      # layer 1
    RegularizedDense(100),                      # layer 2
    RegularizedDense(10, activation="softmax")  # layer 3
])`;

const DROPOUT_CODE = `model = tf.keras.models.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(10, activation="softmax")
])`;

// Tables 11-3 / 11-4 side by side — [hyperparameter, generic net, self-normalizing net, differs?]
const DEFAULTS_ROWS = [
  ['Kernel initializer', 'He initialization', 'LeCun initialization', true],
  ['Activation function', 'ReLU if shallow; Swish if deep', 'SELU', true],
  ['Normalization', 'None if shallow; batch norm if deep', 'None (self-normalization)', true],
  ['Regularization', 'Early stopping; weight decay if needed', 'Alpha dropout if needed (not covered in CITS5017)', true],
  ['Optimizer', 'Nesterov accelerated gradients or AdamW', 'Nesterov accelerated gradients', true],
  ['Learning rate schedule', 'Performance scheduling or 1cycle', 'Performance scheduling or 1cycle', false],
];

const SUMMARY_ROWS = [
  ['flatten (Flatten)', '(None, 784)', '0'],
  ['batch_normalization (BatchNormalization)', '(None, 784)', '3,136'],
  ['dense (Dense)', '(None, 300)', '235,500'],
  ['batch_normalization_1 (BatchNormalization)', '(None, 300)', '1,200'],
  ['dense_1 (Dense)', '(None, 100)', '30,100'],
  ['batch_normalization_2 (BatchNormalization)', '(None, 100)', '400'],
  ['dense_2 (Dense)', '(None, 10)', '1,010'],
];

/* ── Decorative animated net for the Start hero ──────────────────────────── */
function NetHero() {
  const cols = [
    { x: 36, ys: [58, 118, 178] },
    { x: 160, ys: [30, 89, 148, 207] },
    { x: 284, ys: [88, 148] },
  ];
  const edges = [];
  for (let c = 0; c < cols.length - 1; c++) {
    cols[c].ys.forEach((y1) =>
      cols[c + 1].ys.forEach((y2) => edges.push([cols[c].x, y1, cols[c + 1].x, y2])),
    );
  }
  const nodes = cols.flatMap((c) => c.ys.map((y) => [c.x, y]));
  return (
    <svg viewBox="0 0 320 238" className="dl-net" aria-hidden="true">
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="dl-net__edge" style={{ animationDelay: `${(i % 6) * -0.45}s` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={8} className="dl-net__node" style={{ animationDelay: `${i * 0.22}s` }} />
      ))}
    </svg>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */
export default function Lecture2() {
  const [tab, setTab] = useState('start');
  const [visited, setVisited] = useState(() => new Set(['start']));
  const [quizAnswers, setQuizAnswers] = useState({});
  const [bnOrder, setBnOrder] = useState('after');
  const rootRef = useRef(null);

  const go = (id) => {
    setTab(id);
    setVisited((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: 'start' }));
  };

  const quizDone = Object.keys(quizAnswers).length;
  const explored = TABS.filter((t) => visited.has(t.id)).length;

  return (
    <RefsProvider refs={REFS}>
      <div ref={rootRef} className="pt-module dl">
        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <nav className="dl-tabbar" role="tablist" aria-label="Lecture sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`dl-tab${tab === t.id ? ' dl-tab--on' : ''}${visited.has(t.id) ? ' dl-tab--seen' : ''}`}
              onClick={() => go(t.id)}
            >
              <span className="dl-tab__no">{t.no}</span>
              <span className="dl-tab__label">{t.label}</span>
              {t.id === 'quiz' && quizDone > 0 && (
                <span className="dl-tab__badge">{scoreOf(quizAnswers)}/{quizDone}</span>
              )}
              <span className="dl-tab__seen" aria-hidden="true" />
            </button>
          ))}
          <span className="dl-tabbar__progress">{explored}/{TABS.length}</span>
        </nav>

        {/* ── Active pane ─────────────────────────────────────────────── */}
        {tab === 'start' && <StartPane go={go} visited={visited} />}

        {tab === 'problem' && (
          <Section key="problem" n={1} title="The problem" slides="4–6">
            <Hook sub="Two labs. Drive both, and you’ll know why 2010-era deep nets refused to train.">
              {TABS[1].hook}
            </Hook>
            <Outline
              items={[
                ['1.1', 'Four ways deep nets fail'],
                ['1.2', 'Vanishing & exploding'],
                ['1.3', 'Sigmoid saturation, live'],
                ['1.4', 'Watch a gradient die'],
              ]}
            />

            <Sub no="1.1" title="Four ways deep nets fail" slides="slide 4">
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="Unstable gradients" tone="accent"><p>Vanishing or exploding — this tab and the next four.</p></Fact>
                <Fact k="Not enough data"><p>Too little (labelled) data for a big net → <b>Transfer</b> tab.</p></Fact>
                <Fact k="Slow training"><p>Fixed by faster optimizers — next lecture.</p></Fact>
                <Fact k="Overfitting"><p>Millions of parameters, noisy or scarce data — next lecture.</p></Fact>
              </div>
            </Sub>

            <Sub no="1.2" title="Vanishing & exploding gradients" slides="slides 4–5">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Vanishing" v="grad → 0">
                  <p>Gradients shrink on the way down; lower weights barely move, training stalls or crawls.</p>
                </Fact>
                <Fact k="Exploding" v="grad → ∞">
                  <p>The opposite: gradients grow layer after layer until updates blow up.</p>
                </Fact>
                <Fact k="The culprit" v="σ + N(0,1)">
                  <p>Sigmoid activations plus the era’s default init — the 2010 diagnosis<Fnote n={1} />.</p>
                </Fact>
              </div>
            </Sub>

            <Sub no="1.3" title="Sigmoid saturation, live" slides="slide 5">
              <SigmoidSaturation />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Why it saturates · 1"><p><Tex src="\mathcal{N}(0,1)" /> init makes each layer’s output variance ≫ its input variance — <Tex src="z" /> blows up.</p></Fact>
                <Fact k="Why it saturates · 2"><p>Sigmoid’s mean is 0.5, not 0 — the signal drifts off-centre every layer.</p></Fact>
                <Fact k="Why it saturates · 3"><p>Large <Tex src="|z|" /> → output pinned at 0 or 1, derivative ≈ 0 → nothing to backpropagate.</p></Fact>
              </div>
            </Sub>

            <Sub no="1.4" title="Watch a gradient die" slides="slide 6">
              <GradientFlowLab />
            </Sub>

            <Jot
              items={[
                <>Four failure modes of deep nets: <b>unstable gradients</b>, too little labelled data, slow training, overfitting.</>,
                <>Vanishing = gradients shrink layer by layer on the way down, so lower layers stop learning; exploding = they grow until updates blow up.</>,
                <>The 2010 diagnosis (Glorot &amp; Bengio): sigmoid activations + N(0,1) init — layer outputs blow up and σ saturates.</>,
                <>Saturated sigmoid: large |z| pins the output at 0 or 1, σ′ ≈ 0 → nothing to backpropagate. Max slope anywhere: σ′(0) = 0.25.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'init' && (
          <Section key="init" n={2} title="Fix 1 · Smarter initialization" slides="7–9">
            <Hook sub={<>Glorot &amp; Bengio’s compromise<Fnote n={2} />: scale each layer’s random weights by its fan-in/fan-out, and variance survives in both directions.</>}>
              {TABS[2].hook}
            </Hook>
            <Outline
              items={[
                ['2.1', 'Match the init to the fan'],
                ['2.2', 'In Keras'],
              ]}
            />

            <Sub no="2.1" title="Match the init to the fan" slides="slides 7–8">
              <InitLab />
            </Sub>

            <Sub no="2.2" title="In Keras" slides="slide 9">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Keras default" v='"glorot_uniform"'><p>Glorot with a uniform distribution — you get it without asking.</p></Fact>
                <Fact k="To change it" v="kernel_initializer"><p>One argument on the layer. That’s the whole fix.</p></Fact>
                <Fact k="Rule of thumb" v="ReLU family → He"><p>sigmoid/tanh/softmax → Glorot · SELU → LeCun.</p></Fact>
              </div>
              <Code code={INIT_CODE_1} label="he_init.py" meta="slide 9 · example 1" />
              <Code code={INIT_CODE_2} label="variance_scaling.py" meta="slide 9 · example 2" />
            </Sub>

            <Jot
              items={[
                <>Goal: keep the signal variance alive forwards <em>and</em> backwards → Glorot’s compromise scales by fan_avg = (fan_in + fan_out)/2.</>,
                <>Match init to activation (Table 11-1): none/tanh/sigmoid/softmax → <b>Glorot</b> · ReLU family → <b>He</b> · SELU → <b>LeCun</b>.</>,
                <>Variances: Glorot <Tex src="\sigma^2 = 1/\mathrm{fan}_{\mathrm{avg}}" /> · He <Tex src="\sigma^2 = 2/\mathrm{fan}_{\mathrm{in}}" /> · LeCun <Tex src="\sigma^2 = 1/\mathrm{fan}_{\mathrm{in}}" />.</>,
                <>Keras default = "glorot_uniform"; switch per layer with kernel_initializer="he_normal".</>,
              ]}
            />
          </Section>
        )}

        {tab === 'acts' && (
          <Section key="acts" n={3} title="Fix 2 · Non-saturating activations" slides="10–22">
            <Hook sub="Click a chip for its card. Drag α and β. Load the book’s figures with one press.">
              {TABS[3].hook}
            </Hook>
            <Outline
              items={[
                ['3.1', 'ReLU’s disease'],
                ['3.2', 'A decade of fixes'],
                ['3.3', 'Which one to use'],
              ]}
            />

            <Sub no="3.1" title="ReLU’s disease" slides="slide 10">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="ReLU" v={<Tex src="\max(0, z)" />}>
                  <p>Never saturates for <Tex src="z>0" /><Fnote n={4} /> — cheap, everywhere.</p>
                </Fact>
                <Fact k="Its disease" v="dying ReLUs" tone="accent">
                  <p>Input goes negative → output 0, gradient 0 — the neuron can die for good.</p>
                </Fact>
                <Fact k="The cure" v="8 variants">
                  <p>Leaky, RReLU, PReLU fix the leak; ELU → Mish make it smooth.</p>
                </Fact>
              </div>
            </Sub>

            <Sub no="3.2" title="A decade of fixes, explored" slides="slides 10–21">
              <ActivationLab />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Kinked at z = 0"><p>ReLU · Leaky · RReLU · PReLU — derivative jumps.</p></Fact>
                <Fact k="Smooth everywhere"><p>ELU (α=1) · SELU · GELU · Swish · Mish.</p></Fact>
                <Fact k="In Keras today"><p><code>"gelu"</code> and <code>"silu"</code> ship; Mish, Swish-β and RReLU don’t (slide 21).</p></Fact>
              </div>
            </Sub>

            <Sub no="3.3" title="Which one to use" slides="slide 22">
              <WhichActivation />
            </Sub>

            <Jot
              items={[
                <>ReLU never saturates for z &gt; 0 and is cheap — but a neuron whose input stays negative outputs 0 with gradient 0: it can <b>die</b> for good.</>,
                <>Leaky ReLU / RReLU / PReLU keep a small negative slope; ELU, SELU, GELU, Swish and Mish are smooth everywhere.</>,
                <>Kinked at z = 0: ReLU · Leaky · RReLU · PReLU. Smooth: ELU → Mish. Keras ships "gelu" and "silu"; Mish, Swish-β and RReLU it doesn’t.</>,
                <>Slide-22 rule of thumb: ReLU stays a solid default for runtime; SELU for deep self-normalising stacks; GELU/Swish/Mish buy accuracy at extra cost.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'bn' && (
          <Section key="bn" n={4} title="Fix 3 · Batch normalization" slides="23–28">
            <Hook sub={<>Good init only fixes the <em>start</em> of training. BN<Fnote n={10} /> patrols every layer for the whole run — Ioffe &amp; Szegedy, 2015.</>}>
              {TABS[4].hook}
            </Hook>
            <Outline
              items={[
                ['4.1', 'The idea'],
                ['4.2', 'The algorithm, stepped'],
                ['4.3', 'What BN buys'],
                ['4.4', 'BN in Keras'],
              ]}
            />

            <Sub no="4.1" title="The idea" slides="slide 23">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="The op" v="normalize"><p>One extra operation per hidden layer, before or after the activation: mean 0, variance 1.</p></Fact>
                <Fact k="The twist" v="γ, β trainable" tone="accent"><p>The network learns to undo exactly as much normalization as it wants.</p></Fact>
                <Fact k="At test time" v="moving averages"><p>No batch to average — running estimates from training stand in.</p></Fact>
              </div>
            </Sub>

            <Sub no="4.2" title="The algorithm, stepped" slides="slide 24">
              <BNLab />
            </Sub>

            <Sub no="4.3" title="What BN buys" slides="slide 25">
              <div className="dl-cardgrid dl-cardgrid--5">
                <Fact k="ImageNet" v="huge ↑"><p>Their headline result.</p></Fact>
                <Fact k="Saturating acts" v="usable again"><p>Even tanh worked.</p></Fact>
                <Fact k="Learning rates" v="much larger"><p>Training got faster.</p></Fact>
                <Fact k="Regularizer" v="for free"><p>Less need for dropout.</p></Fact>
                <Fact k="Input scaling" v="not needed"><p>No StandardScaler.</p></Fact>
              </div>
              <Unfold label="The cost — and the trick that removes it (slide 25)">
                <p className="dl-body">
                  BN adds computation at every layer, but convergence is so much faster that fewer
                  epochs usually win the time back. After training you can erase the cost entirely by
                  fusing each BN layer with the layer before it.
                </p>
              </Unfold>
            </Sub>

            <Sub no="4.4" title="BN in Keras — after or before the activation" slides="slides 26–28">
              <div className="dl-chips">
                <button type="button" className={`dl-chip${bnOrder === 'after' ? ' dl-chip--on' : ''}`} onClick={() => setBnOrder('after')} aria-pressed={bnOrder === 'after'}>
                  BN after the activation · slide 26
                </button>
                <button type="button" className={`dl-chip${bnOrder === 'before' ? ' dl-chip--on' : ''}`} onClick={() => setBnOrder('before')} aria-pressed={bnOrder === 'before'}>
                  BN before the activation · slide 28
                </button>
              </div>
              {bnOrder === 'after' ? (
                <>
                  <Code code={BN_CODE_AFTER} label="bn_after_activation.py" meta="slide 26" />
                  <p className="dl-body">BN right after <code>Flatten</code> (standardizing the inputs) and after each hidden layer.</p>
                </>
              ) : (
                <>
                  <Code code={BN_CODE_BEFORE} label="bn_before_activation.py" meta="slide 28" />
                  <p className="dl-body">
                    The BN authors preferred it <em>before</em> the activation: activation becomes its
                    own layer, and <code>use_bias=False</code> drops the now-redundant bias — BN’s β
                    already does that job.
                  </p>
                </>
              )}

              <Unfold label="model.summary() — where 271,346 parameters come from (slide 27)">
                <div className="dl-tablewrap">
                  <table className="dl-table dl-table--summary">
                    <caption className="dl-table__cap">The slide-26 network. BN rows tinted.</caption>
                    <thead>
                      <tr><th>Layer (type)</th><th>Output Shape</th><th>Param #</th></tr>
                    </thead>
                    <tbody>
                      {SUMMARY_ROWS.map(([l, s, p]) => (
                        <tr key={l} className={l.includes('batch_normalization') ? 'dl-table__row--bn' : ''}>
                          <td className="dl-mono">{l}</td><td className="dl-mono">{s}</td><td className="dl-mono dl-right">{p}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={2}>Total params</td><td className="dl-mono dl-right">271,346 (1.04 MB)</td></tr>
                      <tr><td colSpan={2}>Trainable params</td><td className="dl-mono dl-right">268,978 (1.03 MB)</td></tr>
                      <tr><td colSpan={2}>Non-trainable params</td><td className="dl-mono dl-right">2,368 (9.25 KB)</td></tr>
                    </tfoot>
                  </table>
                </div>
                <div className="dl-cardgrid dl-cardgrid--2">
                  <Fact k="4 params per feature" v="3,136 = 784 × 4"><p>γ + β (trainable) and moving mean + variance (not).</p></Fact>
                  <Fact k="Non-trainable" v="(784+300+100) × 2 = 2,368"><p>The moving statistics — estimated, never learned.</p></Fact>
                </div>
              </Unfold>
            </Sub>

            <Jot
              items={[
                <>BN normalizes each feature over the current minibatch, then re-scales with trainable γ and shifts with trainable β.</>,
                <>The four equations: <Tex src="\mu_B" /> and <Tex src="\sigma_B^2" /> over the batch → <Tex src="\hat{\mathbf{x}} = (\mathbf{x}-\mu_B)/\sqrt{\sigma_B^2+\epsilon}" /> → <Tex src="\mathbf{z} = \gamma \otimes \hat{\mathbf{x}} + \beta" />.</>,
                <>4 parameters per feature: γ and β trainable; moving mean and variance estimated for test time (no batch to average then).</>,
                <>Buys: much faster convergence, larger learning rates, saturating activations usable again, a mild regularizer, no input scaling needed.</>,
                <>Before-activation variant: Dense(use_bias=False) → BN → Activation — β replaces the bias. After training, fuse each BN into the previous layer to erase the runtime cost.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'clip' && (
          <Section key="clip" n={5} title="Fix 4 · Gradient clipping" slides="29">
            <Hook sub={<>Mostly an RNN trick — batch norm is awkward to use there<Fnote n={11} />. Steer the gradient and watch the two clips disagree.</>}>
              {TABS[5].hook}
            </Hook>

            <Sub no="5.1" title="clipvalue vs clipnorm" slides="slide 29">
              <ClipLab />
            </Sub>

            <Jot
              items={[
                <>Exploding-gradient fix, mostly for RNNs (where batch norm is awkward): cap the gradient before the update.</>,
                <><b>clipvalue=1.0</b> clamps each component to [−1, 1] — it can <em>change the gradient’s direction</em>.</>,
                <><b>clipnorm=1.0</b> rescales the whole vector when ‖g‖ &gt; 1 — direction preserved.</>,
                <>One argument on the optimizer: tf.keras.optimizers.SGD(clipvalue=1.0), then compile as usual.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'transfer' && (
          <Section key="transfer" n={6} title="Transfer learning with Keras" slides="30–32">
            <Hook sub="A similar net already exists? Reuse its lower layers and replace the head.">
              {TABS[6].hook}
            </Hook>
            <Outline
              items={[
                ['6.1', 'The recipe'],
                ['6.2', 'Figure 11-5, walked'],
              ]}
            />

            <Sub no="6.1" title="The recipe" slides="slide 30">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Always replace" v="the output layer"><p>Almost certainly useless for the new task — wrong number of outputs.</p></Fact>
                <Fact k="How much to reuse" v="similarity decides"><p>More similar tasks → keep more layers, starting from the bottom.</p></Fact>
                <Fact k="The ritual" v="freeze → fit → unfreeze" tone="accent"><p>Protect pretrained weights while the new head finds its feet.</p></Fact>
              </div>
            </Sub>

            <Sub no="6.2" title="Figure 11-5, walked" slides="slides 31–32">
              <TransferLab />
            </Sub>

            <Jot
              items={[
                <>Always replace the output layer; reuse lower layers from the bottom up — the more similar the task, the more you keep.</>,
                <>The ritual: freeze the reused layers → fit a few epochs → unfreeze → <b>recompile</b> → fine-tune with a low learning rate. Recompiling after (un)freezing is mandatory.</>,
                <>Fashion-MNIST demo, 200 images: 91.85% from scratch → 93.85% with transfer ≈ 25% relative error-rate reduction.</>,
                <>Fine print: transfer learning shines with deep CNNs — not with small dense networks.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'opt' && (
          <Section key="opt" n={7} title="Faster optimizers" slides="33–47">
            <Hook sub="Huge speed boosts come from a faster optimizer than plain gradient descent (slide 33). Five ideas — then race all six on the elongated bowl.">
              {TABS[7].hook}
            </Hook>
            <Outline
              items={[
                ['7.1', 'Momentum & Nesterov'],
                ['7.2', 'The adaptive family'],
                ['7.3', 'Adam & its variants'],
                ['7.4', 'Race them'],
                ['7.5', 'Table 11-2 — speed vs quality'],
              ]}
            />

            <Sub no="7.1" title="Momentum & Nesterov" slides="slides 34–37">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Plain GD" v={<Tex src="\theta \leftarrow \theta - \eta\nabla_\theta J" />}>
                  <p>No memory of earlier gradients — a tiny local gradient means a tiny, slow step.</p>
                </Fact>
                <Fact k="Momentum's trick" v="acceleration, not speed" tone="accent">
                  <p>The gradient feeds a momentum vector <Tex src="\mathbf{m}" /> instead of moving <Tex src="\theta" /> directly — and can roll past local optima.</p>
                </Fact>
                <Fact k="One new knob" v="β = 0.9">
                  <p><Tex src="\beta < 1" />; 0.9 usually works and almost always beats plain GD. Past momentum decays exponentially.</p>
                </Fact>
              </div>
              <Eq
                no="7.1"
                name="momentum optimization"
                src="\mathbf{m} \leftarrow \beta\,\mathbf{m} - \eta \nabla_\theta J(\theta), \qquad \theta \leftarrow \theta + \mathbf{m}"
                read="pour the gradient into a decaying velocity, then move by the velocity."
              />
              <Eq
                no="7.2"
                name="Nesterov accelerated gradient"
                src="\mathbf{m} \leftarrow \beta\,\mathbf{m} - \eta \nabla_\theta J(\theta + \beta\,\mathbf{m}), \qquad \theta \leftarrow \theta + \mathbf{m}"
                read="same, but measure the gradient a look-ahead step along the momentum — m usually points the right way, so the update lands closer to the optimum (Figure 11-7)."
              />
              <p className="dl-body">
                Nesterov’s variant<Fnote n={12} /> is one optional argument away:
              </p>
              <Code code={MOMENTUM_CODE} label="momentum.py" meta="slide 35" />
              <Code code={NAG_CODE} label="nesterov.py" meta="slide 37" />
            </Sub>

            <Sub no="7.2" title="The adaptive family" slides="slides 38–42">
              <Eq
                no="7.3"
                name="AdaGrad"
                src="\mathbf{s} \leftarrow \mathbf{s} + \nabla_\theta J \otimes \nabla_\theta J, \qquad \theta \leftarrow \theta - \eta\, \nabla_\theta J \oslash \sqrt{\mathbf{s} + \epsilon}"
                read="accumulate every squared gradient, then divide the step by its square root — steep dimensions get scaled down the most (an adaptive learning rate)."
              />
              <Eq
                no="7.4"
                name="RMSProp"
                src="\mathbf{s} \leftarrow \rho\,\mathbf{s} + (1 - \rho)\,\nabla_\theta J \otimes \nabla_\theta J, \qquad \theta \leftarrow \theta - \eta\, \nabla_\theta J \oslash \sqrt{\mathbf{s} + \epsilon}"
                read="same idea, but only the MOST RECENT gradients accumulate (decay ρ = 0.9) — so the step never shrinks to nothing."
              />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="AdaGrad" v="points at the optimum" tone="accent">
                  <p>Scales the gradient down along the steepest dimensions<Fnote n={13} /> — Figure 11-8. Less tuning of <Tex src="\eta" /> needed.</p>
                </Fact>
                <Fact k="Its flaw" v="stops too early">
                  <p>The learning rate decays so much that training halts before the optimum — do <u>not</u> use it for deep nets (slide 40).</p>
                </Fact>
                <Fact k="RMSProp" v="ρ = 0.9">
                  <p>Tieleman &amp; Hinton’s fix<Fnote n={14} /> — the preferred optimizer of many researchers until Adam came around.</p>
                </Fact>
              </div>
              <Code code={ADAPTIVE_CODE} label="adaptive.py" meta="slides 40 & 42" />
            </Sub>

            <Sub no="7.3" title="Adam & its variants" slides="slides 43–46">
              <Eq
                no="7.5"
                name="Adam — adaptive moment estimation"
                src="\begin{aligned} 1.&\;\; \mathbf{m} \leftarrow \beta_1 \mathbf{m} + (1-\beta_1)\nabla_\theta J(\theta) \\ 2.&\;\; \mathbf{s} \leftarrow \beta_2 \mathbf{s} + (1-\beta_2)\nabla_\theta J(\theta) \otimes \nabla_\theta J(\theta) \\ 3.&\;\; \hat{\mathbf{m}} \leftarrow \mathbf{m}/(1-\beta_1^{\,t}) \\ 4.&\;\; \hat{\mathbf{s}} \leftarrow \mathbf{s}/(1-\beta_2^{\,t}) \\ 5.&\;\; \theta \leftarrow \theta - \eta\, \hat{\mathbf{m}} \oslash \sqrt{\hat{\mathbf{s}} + \epsilon} \end{aligned}"
                read="momentum (step 1) + RMSProp (step 2), with bias corrections (3–4) because m and s start near zero; t is the iteration number."
              />
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="The mapping" v="β₁ ↔ β · β₂ ↔ ρ">
                  <p>Adam<Fnote n={15} /> = momentum + RMSProp. Defaults: <Tex src="\beta_1 = 0.9" />, <Tex src="\beta_2 = 0.999" />, and η = 0.001 often just works.</p>
                </Fact>
                <Fact k="AdaMax" v="max, not sum">
                  <p>Step 2 becomes <Tex src="\mathbf{s} \leftarrow \max(\beta_2\mathbf{s}, \operatorname{abs}(\nabla_\theta J))" /><Fnote n={16} />. Dataset-dependent — Adam generally better.</p>
                </Fact>
                <Fact k="Nadam" v="Adam + Nesterov">
                  <p>Generally outperforms Adam<Fnote n={17} /> but is sometimes outperformed by RMSProp.</p>
                </Fact>
                <Fact k="AdamW" v="weight decay" tone="accent">
                  <p>Integrates weight decay<Fnote n={18} />: weights shrink each iteration by a factor like 0.99.</p>
                </Fact>
              </div>
              <Code code={ADAM_CODE} label="adam.py" meta="slide 44" />
              <Unfold label="AdaMax · Nadam · AdamW in Keras (slide 46)">
                <Code code={ADAM_VARIANTS_CODE} label="adam_variants.py" meta="slide 46" />
              </Unfold>
            </Sub>

            <Sub no="7.4" title="Race them" slides="slides 34–44 · Figures 11-7 & 11-8">
              <OptimizerRaceLab />
            </Sub>

            <Sub no="7.5" title="Table 11-2 — speed vs quality" slides="slide 47">
              <OptimizerTable />
            </Sub>

            <Jot
              items={[
                <>Momentum: <Tex src="\mathbf{m} \leftarrow \beta\mathbf{m} - \eta\nabla_\theta J" />, <Tex src="\theta \leftarrow \theta + \mathbf{m}" /> — the gradient is an <b>acceleration</b>, not a speed; β = 0.9; can roll past local optima.</>,
                <>NAG measures the gradient at the look-ahead point <Tex src="\theta + \beta\mathbf{m}" /> — lands slightly closer to the optimum than regular momentum.</>,
                <>AdaGrad divides by accumulated squared gradients → an <b>adaptive learning rate</b> — but it stops too early: never use it for deep nets.</>,
                <>RMSProp keeps only recent squared gradients (ρ = 0.9) — the fix for AdaGrad’s decay.</>,
                <>Adam = momentum + RMSProp with bias correction; β₁ = 0.9, β₂ = 0.999, η = 0.001 usually fine. AdaMax swaps step 2 for a max; Nadam adds Nesterov; <b>AdamW adds weight decay</b>.</>,
                <>Table 11-2: everything from momentum onward is ★★–★★★ on both axes — except AdaGrad’s quality: ★ (stops too early).</>,
              ]}
            />
          </Section>
        )}

        {tab === 'sched' && (
          <Section key="sched" n={8} title="Learning rate scheduling" slides="48–59">
            <Hook sub="Figure 11-9's four curves: too high diverges, too low crawls, high-then-reduced beats ANY constant η. The strategies are called learning schedules.">
              {TABS[8].hook}
            </Hook>
            <Outline
              items={[
                ['8.1', 'Why schedule at all'],
                ['8.2', 'The schedule gallery'],
                ['8.3', 'Roll your own'],
              ]}
            />

            <Sub no="8.1" title="Why schedule at all" slides="slides 48–49">
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="η way too high" v="diverges"><p>Loss dips, then sweeps off the top of the chart.</p></Fact>
                <Fact k="η too small" v="slow"><p>Converges — eventually. Highest final loss of the convergent curves.</p></Fact>
                <Fact k="η too high" v="suboptimal"><p>Drops fast, then plateaus above the optimum.</p></Fact>
                <Fact k="Start high, then reduce" v="perfect!" tone="accent"><p>Reaches a good solution faster than the optimal <em>constant</em> learning rate.</p></Fact>
              </div>
            </Sub>

            <Sub no="8.2" title="The schedule gallery" slides="slides 50–59">
              <ScheduleLab />
            </Sub>

            <Sub no="8.3" title="Roll your own" slides="slide 54">
              <Code code={CUSTOM_SCHED_CODE} label="custom_scheduler.py" meta="slide 54" />
              <div className="dl-cardgrid dl-cardgrid--2">
                <Fact k="Callback timing" v="per epoch"><p>By default, callbacks run at the end of each <b>epoch</b>, not at each gradient-descent step. An optimizer is still needed.</p></Fact>
                <Fact k="The other way" v="subclass"><p>Subclass <code>tf.keras.optimizers.schedules.LearningRateSchedule</code>.</p></Fact>
              </div>
            </Sub>

            <Jot
              items={[
                <>η too high → diverges · too low → slow · <b>high then reduced → beats any constant η</b> (Figure 11-9). It can even pay to go low → high → low.</>,
                <>Power: <Tex src="\eta(t) = \eta_0/(1 + rt/s)^c" /> (c typically 1) — after s steps η₀/(1+r), after 2s steps η₀/(1+2r). Keras: <code>InverseTimeDecay</code>.</>,
                <>Exponential: <Tex src="\eta(t) = \eta_0\, r^{t/s}" /> — drops by factor r every s steps. Keras: <code>ExponentialDecay</code> (both take <code>staircase</code>).</>,
                <>Piecewise constant: <code>PiecewiseConstantDecay(boundaries=[…], values=[…])</code> — works well but needs fiddling.</>,
                <>Performance: <code>ReduceLROnPlateau(factor=0.5, patience=5)</code> — halve η whenever the best val loss hasn’t improved for 5 consecutive epochs.</>,
                <>1Cycle (Smith, 2018): η₀ ↗ η₁ over the first half, ↘ η₀ over the second, then drop by orders of magnitude — good accuracy in fewer epochs (CIFAR10).</>,
              ]}
            />
          </Section>
        )}

        {tab === 'reg' && (
          <Section key="reg" n={9} title="Avoiding overfitting" slides="60–64">
            <Hook sub={<>State-of-the-art nets gained 1–2% accuracy just by adding dropout<Fnote n={20} /> — at 95% accuracy, +2 points cuts the error rate by almost 40%.</>}>
              {TABS[9].hook}
            </Hook>
            <Outline
              items={[
                ['9.1', 'ℓ1 / ℓ2 on the weights'],
                ['9.2', 'Dropout, watched live'],
                ['9.3', 'Dropout in Keras — and its trap'],
              ]}
            />

            <Sub no="9.1" title="ℓ1 / ℓ2 on the weights" slides="slides 60–61">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="The mechanism" v="loss + penalty"><p>Each step, the regularization function computes a regularization loss that is <em>added to the final loss</em>.</p></Fact>
                <Fact k="The three flavours" v="l1 · l2 · l1_l2"><p><code>regularizers.l1(…)</code>, <code>regularizers.l2(…)</code>, or both together with <code>regularizers.l1_l2(…)</code>.</p></Fact>
                <Fact k="Apply everywhere" v="functools.partial" tone="accent"><p>Same regularization on every Dense layer without repeating yourself.</p></Fact>
              </div>
              <Code code={L2_CODE} label="l2_layer.py" meta="slide 60" />
              <Code code={PARTIAL_CODE} label="regularized_dense.py" meta="slide 61" />
              <p className="dl-body">
                All three <code>RegularizedDense</code> layers use ℓ2 + He init; layers 1–2 keep ReLU,
                layer 3 overrides to softmax.
              </p>
            </Sub>

            <Sub no="9.2" title="Dropout, watched live" slides="slides 62–63 · Figure 11-10">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Each training step" v="p per neuron" tone="accent"><p>Every neuron — <em>including inputs, excluding outputs</em> — has probability p of being TEMPORARILY dropped; it may be back next step.</p></Fact>
                <Fact k="The dropout rate" v="p = 10–50%"><p>The hyperparameter p; 0.2 in the slide’s code.</p></Fact>
                <Fact k="Why it pays" v="+1–2% accuracy"><p>From 95% to 97% ≈ error rate 5% → 3%: almost a 40% cut.</p></Fact>
              </div>
              <DropoutLab />
            </Sub>

            <Sub no="9.3" title="Dropout in Keras — and its trap" slides="slide 64">
              <Code code={DROPOUT_CODE} label="dropout_model.py" meta="slide 64" />
              <div className="dl-cardgrid dl-cardgrid--2">
                <Fact k="The trap" v="losses can lie" tone="accent"><p>Dropout is only active in training, so a model can overfit while training and validation losses look similar.</p></Fact>
                <Fact k="The rule" v="evaluate without dropout"><p>Make sure to evaluate the training loss <b>without</b> dropout (e.g. after training).</p></Fact>
              </div>
            </Sub>

            <Jot
              items={[
                <>ℓ1/ℓ2 regularization constrains connection weights: <code>kernel_regularizer=tf.keras.regularizers.l2(0.01)</code> — the penalty is added to the loss each step; <code>l1_l2(…)</code> does both.</>,
                <><code>functools.partial(tf.keras.layers.Dense, …)</code> bakes the same activation/init/regularizer into every layer.</>,
                <>Dropout: every neuron (inputs included, <b>outputs never</b>) drops with probability p per training step; p typically 10–50%; no dropping after training.</>,
                <>+1–2% accuracy on SOTA nets = up to ~40% relative error reduction. Keras: a <code>Dropout(rate=0.2)</code> layer before every Dense layer.</>,
                <>Because dropout is train-only, similar train/val losses can hide overfitting — evaluate the training loss <b>without</b> dropout.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'defaults' && (
          <Section key="defaults" n={10} title="Summary & practical guidelines" slides="65–68">
            <Hook sub="Works fine in most cases — but do not consider these hard rules (slide 65).">
              {TABS[10].hook}
            </Hook>
            <Outline items={[['10.1', 'Tables 11-3 & 11-4, side by side']]} />

            <Sub no="10.1" title="Tables 11-3 & 11-4, side by side" slides="slides 65–66">
              <div className="dl-tablewrap">
                <table className="dl-table">
                  <caption className="dl-table__cap">
                    Tables 11-3 & 11-4. Default DNN configuration — generic vs a simple stack of dense layers (which can self-normalize). Rows that differ are tinted.
                  </caption>
                  <thead>
                    <tr><th>Hyperparameter</th><th>Default (Table 11-3)</th><th>Self-normalizing net (Table 11-4)</th></tr>
                  </thead>
                  <tbody>
                    {DEFAULTS_ROWS.map(([k, a, b, differs]) => (
                      <tr key={k} className={differs ? 'dl-table__row--bn' : ''}>
                        <td>{k}</td><td>{a}</td><td>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dl-cardgrid dl-cardgrid--2">
                <Fact k="When 11-4 applies" v="plain dense stack"><p>A simple stack of dense layers can <b>self-normalize</b> — then swap to LeCun init + SELU and drop the normalization layer.</p></Fact>
                <Fact k="Health warning" v="not hard rules" tone="accent"><p>The configurations work fine in most cases — but do not consider them as hard rules!</p></Fact>
              </div>
            </Sub>

            <Jot
              label="Slide 67 — what you should now be able to do"
              items={[
                <>Understand the vanishing and exploding gradients problems.</>,
                <>Understand the importance of properly initializing connection weights.</>,
                <>Know a few unsaturating activation functions.</>,
                <>Understand when to use batch normalization and how it works.</>,
                <>Know a few fast optimizers and their associated hyperparameters.</>,
                <>Understand learning rate scheduling.</>,
                <>Understand ℓ1 and ℓ2 regularization.</>,
                <>Understand the concept of dropout.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'quiz' && (
          <Section key="quiz" n={11} title="Check yourself" slides="everything">
            <Hook sub={`${QUIZ.length} questions, instant verdicts, slide receipts.`}>{TABS[11].hook}</Hook>
            <Quiz
              answers={quizAnswers}
              onAnswer={(qi, oi) => setQuizAnswers((a) => ({ ...a, [qi]: oi }))}
              onReset={() => setQuizAnswers({})}
            />
          </Section>
        )}
      </div>
    </RefsProvider>
  );
}

/* ── START: hero + level select + roadmap + sources ──────────────────────── */
function StartPane({ go, visited }) {
  return (
    <div className="dl-start" key="start">
      <div className="pt-card dl-hero">
        <div className="dl-hero__main">
          <p className="dl-hero__kicker">CITS5017 · Topic 2 · Chapter 11 · Hands-On ML (Géron, 3rd ed.)</p>
          <h3 className="dl-hero__title">Training Deep Neural Networks</h3>
          <p className="dl-hero__byline">A/Prof Du Huynh · UWA · Semester 2, 2025</p>
          <p className="dl-hero__lead">
            Why deep nets refuse to train — the four fixes, then the fast optimizers, learning
            schedules and regularizers that finish the job. The 68-slide deck rebuilt as eleven
            playable levels: every level opens with its numbered skeleton and ends with a tickable{' '}
            <em>Note it down</em> list.
          </p>
          <div className="dl-hero__stats">
            <span><b>68</b> slides</span>
            <span><b>9</b> live labs</span>
            <span><b>6</b> optimizers raced</span>
            <span><b>{QUIZ.length}</b> quiz questions</span>
          </div>
        </div>
        <div className="dl-hero__side">
          <NetHero />
        </div>
      </div>

      <div className="dl-levels">
        {TABS.slice(1).map((t, i) => (
          <button key={t.id} type="button" className="dl-level" style={{ '--i': i }} onClick={() => go(t.id)}>
            <span className="dl-level__top">
              <span className="dl-level__no">{t.no}</span>
              {visited.has(t.id) && <span className="dl-level__seen">explored</span>}
            </span>
            <span className="dl-level__name">{t.label}</span>
            <span className="dl-level__hook">{LEVEL_BLURBS[t.id]}</span>
            <span className="dl-level__slides">slides {t.slides}</span>
          </button>
        ))}
      </div>

      <div className="pt-card dl-next">
        <p className="dl-next__k">Next in the unit — Lecture 3 · CNNs (in the sidebar)</p>
        <div className="dl-next__chips">
          {['Convolutional layers', 'Filters & feature maps', 'Strides & padding', 'Stacking feature maps', 'Conv layers in Keras'].map((c) => (
            <span key={c} className="dl-next__chip">{c}</span>
          ))}
        </div>
      </div>

      <div className="pt-card dl-sources">
        <div className="dl-sources__book" aria-hidden="true">
          <span className="dl-book__pub">O’REILLY®</span>
          <span className="dl-book__t">Hands-On Machine Learning with Scikit-Learn, Keras &amp; TensorFlow</span>
          <span className="dl-book__sub">Concepts, Tools, and Techniques to Build Intelligent Systems</span>
          <span className="dl-book__a">Aurélien Géron · 3rd Edition</span>
        </div>
        <div className="dl-sources__body">
          <p className="dl-sources__read">
            <b>Reading: Chapter 11</b> — the one with the spotted salamander on the cover.
            Citations pop up wherever you see a little number, like this one<Fnote n={1} />.
          </p>
          <Unfold label="All footnotes & sources (1–20)">
            <ol className="dl-refs">
              {Object.entries(REFS).map(([n, r]) => (
                <li key={n} value={n}>{r}</li>
              ))}
            </ol>
            <p className="dl-body">
              Source deck: <em>CITS5017 — Topic 2: Training Deep Neural Networks</em>, A/Prof Du
              Huynh, UWA (68 slides, all covered here).
            </p>
          </Unfold>
        </div>
      </div>
    </div>
  );
}
