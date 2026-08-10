import { useRef, useState } from 'react';
import { Tex, Fnote, Code, Section, Hook, Fact, Unfold, RefsProvider, Outline, Sub, Jot } from '../kit';
import { SigmoidSaturation, GradientFlowLab, InitLab, ActivationLab, WhichActivation } from './labs';
import { BNLab, ClipLab, TransferLab, Quiz } from './labs2';
import { QUIZ, scoreOf } from './quiz';
import '../common.css';

/* ============================================================================
   CITS5017 · LECTURE 2 — TOPIC 2: TRAINING DEEP NEURAL NETWORKS
   ----------------------------------------------------------------------------
   The full content of Documents/cits5017/markdown-lecs/lecture-2.md (all 32
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
     QUIZ         10 questions; the tab wears the live score

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
};

const TABS = [
  { id: 'start', label: 'Start', no: '00' },
  { id: 'problem', label: 'The Problem', no: '01', slides: '4–6', hook: 'Ten layers down, the gradient is gone.' },
  { id: 'init', label: 'Init', no: '02', slides: '7–9', hook: 'Start the weights where the signal survives.' },
  { id: 'acts', label: 'Activations', no: '03', slides: '10–22', hook: 'ReLU dies. Meet a decade of fixes.' },
  { id: 'bn', label: 'Batch Norm', no: '04', slides: '23–28', hook: 'Re-centre every layer, on every batch.' },
  { id: 'clip', label: 'Clipping', no: '05', slides: '29', hook: 'When gradients explode, cap them.' },
  { id: 'transfer', label: 'Transfer', no: '06', slides: '30–32', hook: 'Don’t train from scratch — steal layers.' },
  { id: 'quiz', label: 'Quiz', no: '07', slides: 'all', hook: 'Prove it.' },
];

const LEVEL_BLURBS = {
  problem: 'Watch a 10-layer net starve — live.',
  init: 'Glorot · He · LeCun, matched to your activation.',
  acts: '8 curves, 3 famous figures, 1 explorer.',
  bn: 'The 4-line algorithm, with γ and β you can drag.',
  clip: 'clipvalue vs clipnorm on a vector you steer.',
  transfer: 'Freeze → fit → unfreeze: +2 points from 200 images.',
  quiz: '10 questions, instant verdicts, slide receipts.',
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

        {tab === 'quiz' && (
          <Section key="quiz" n={7} title="Check yourself" slides="everything">
            <Hook sub={`${QUIZ.length} questions, instant verdicts, slide receipts.`}>{TABS[7].hook}</Hook>
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
            Why deep nets refuse to train — and the four fixes, rebuilt from the 32-slide deck as
            seven playable levels. Built for the notebook: every level opens with its numbered
            skeleton, and ends with a tickable <em>Note it down</em> list.
          </p>
          <div className="dl-hero__stats">
            <span><b>32</b> slides</span>
            <span><b>4</b> fixes</span>
            <span><b>6</b> live labs</span>
            <span><b>10</b> quiz questions</span>
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
        <p className="dl-next__k">Also in Chapter 11 — next lecture</p>
        <div className="dl-next__chips">
          {['Momentum', 'Nesterov Accelerated Gradient', 'AdaGrad', 'RMSProp', 'Adam & variants', 'Learning-rate scheduling', 'ℓ1 / ℓ2 regularization', 'Dropout'].map((c) => (
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
          <Unfold label="All footnotes & sources (1–11)">
            <ol className="dl-refs">
              {Object.entries(REFS).map(([n, r]) => (
                <li key={n} value={n}>{r}</li>
              ))}
            </ol>
            <p className="dl-body">
              Source deck: <em>CITS5017 — Topic 2: Training Deep Neural Networks</em>, A/Prof Du
              Huynh, UWA, 2025 (32 slides, all covered here).
            </p>
          </Unfold>
        </div>
      </div>
    </div>
  );
}
