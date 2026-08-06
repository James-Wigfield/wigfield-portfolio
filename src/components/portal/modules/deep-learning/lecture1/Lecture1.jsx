import { useRef, useState } from 'react';
import { Tex, Fnote, Code, Section, Hook, Fact, Unfold, RefsProvider } from '../kit';
import { TluPlayground, RuleAnatomy, PerceptronTrainer, XorGame, XorMlp } from './labs';
import { BackpropTour, ActivationGallery, LinearityDemo, HeadPicker, SoftmaxLab, LossLab } from './labs2';
import { Quiz } from '../lecture2/labs2';
import { QUIZ, scoreOf } from './quiz';
import '../common.css';
import './lecture1.css';

/* ============================================================================
   CITS5017 · LECTURE 1 — TOPIC 1: INTRODUCTION TO ARTIFICIAL NEURAL NETWORKS
   ----------------------------------------------------------------------------
   The full content of Documents/cits5017/markdown-lecs/lecture-1.md (all 33
   slides) as a TABBED interactive page on the shared .dl-* framework:

     START        level select + roadmap (slides 1–3) + sources
     PERCEPTRON   slides 4–8    TLU playground, dense-layer anatomy, matrix form
     TRAINING     slides 9–15   Hebb, the rule term-by-term, a LIVE trainer
     XOR          slides 16–17  the 1969 crisis: one-line game + the 2-layer fix
     MLP+BACKPROP slides 18–19  layer anatomy + the four phases, animated
     ACTIVATIONS  slides 20–23  Figure 10-8 live + the linearity-collapse demo
     HEADS        slides 24–31  output heads, losses (Huber δ), softmax lab
     KERAS        slides 32–33  the tool for the rest of the unit
     QUIZ         10 questions; the tab wears the live score

   The generic Quiz component is shared from lecture2/labs2 (data local).
   ========================================================================== */

const REFS = {
  1: 'Note that this solution is generally not unique — slide 12, on the Perceptron convergence theorem.',
  2: '“Learning Internal Representations by Error Propagation,” D. Rumelhart, G. Hinton, R. Williams (1986). The algorithm was actually invented several times, starting with P. Werbos in 1974.',
};

const TABS = [
  { id: 'start', label: 'Start', no: '00' },
  { id: 'perceptron', label: 'The Perceptron', no: '01', slides: '4–8', hook: 'A neuron made of arithmetic.' },
  { id: 'training', label: 'Training', no: '02', slides: '9–15', hook: 'Cells that fire together, wire together.' },
  { id: 'xor', label: 'XOR', no: '03', slides: '16–17', hook: 'The problem that froze a field.' },
  { id: 'backprop', label: 'MLP & Backprop', no: '04', slides: '18–19', hook: 'Stack layers. Send the errors backwards.' },
  { id: 'acts', label: 'Activations', no: '05', slides: '20–23', hook: 'No gradient, no learning.' },
  { id: 'heads', label: 'Heads & Losses', no: '06', slides: '24–31', hook: 'Match the output layer to the job.' },
  { id: 'keras', label: 'Keras', no: '07', slides: '32–33', hook: 'Meet the tool for the rest of the unit.' },
  { id: 'quiz', label: 'Quiz', no: '08', slides: 'all', hook: 'Prove it.' },
];

const LEVEL_BLURBS = {
  perceptron: 'Drive a 1957 neuron: weights, bias, step.',
  training: 'Watch a decision boundary learn, point by point.',
  xor: 'Try to cut it with one line. Then stack two.',
  backprop: 'Forward, error, reverse, tweak — animated.',
  acts: 'Four classic curves + why nonlinearity matters.',
  heads: 'Regression or classification — pick your head.',
  keras: 'Chollet, 2015 — and a version check.',
  quiz: '10 questions, instant verdicts, slide receipts.',
};

const MLPREG_CODE = `from sklearn.datasets import fetch_california_housing
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

housing = fetch_california_housing()
X_train_full, X_test, y_train_full, y_test = train_test_split(
    housing.data, housing.target, random_state=42)
X_train, X_valid, y_train, y_valid = train_test_split(
    X_train_full, y_train_full, random_state=42)

# 3 hidden layers with 50 neurons per layer
mlp_reg = MLPRegressor(hidden_layer_sizes=[50, 50, 50], random_state=42)
pipeline = make_pipeline(StandardScaler(), mlp_reg)
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_valid)
rmse = mean_squared_error(y_valid, y_pred, squared=False)  # around 0.505`;

const KERAS_CODE = `import tensorflow as tf
from tensorflow import keras
tf.__version__
# output: '2.17.0'
keras.__version__
# output: '3.10.0'`;

/* ── Decorative animated perceptron for the Start hero ───────────────────── */
function NetHero() {
  const cols = [
    { x: 40, ys: [48, 119, 190] },
    { x: 170, ys: [83, 155] },
    { x: 290, ys: [119] },
  ];
  const edges = [];
  for (let c = 0; c < cols.length - 1; c++) {
    cols[c].ys.forEach((y1) => cols[c + 1].ys.forEach((y2) => edges.push([cols[c].x, y1, cols[c + 1].x, y2])));
  }
  const nodes = cols.flatMap((c) => c.ys.map((y) => [c.x, y]));
  return (
    <svg viewBox="0 0 330 238" className="dl-net" aria-hidden="true">
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="dl-net__edge" style={{ animationDelay: `${(i % 5) * -0.5}s` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9} className="dl-net__node" style={{ animationDelay: `${i * 0.28}s` }} />
      ))}
    </svg>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */
export default function Lecture1() {
  const [tab, setTab] = useState('start');
  const [visited, setVisited] = useState(() => new Set(['start']));
  const [quizAnswers, setQuizAnswers] = useState({});
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

        {tab === 'start' && <StartPane go={go} visited={visited} />}

        {tab === 'perceptron' && (
          <Section key="perceptron" n={1} title="The Perceptron" slides="4–8">
            <Hook sub="Frank Rosenblatt, 1957 — one of the simplest ANN architectures, built on the threshold logic unit (TLU): numbers in, weighted sum, step, decision out.">
              {TABS[1].hook}
            </Hook>

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="The unit" v={<Tex src="z = \mathbf{w}^{\mathsf T}\mathbf{x} + b" />} tone="accent">
                <p>…then output step(z). Inputs and output are numbers, and every connection carries a weight.</p>
              </Fact>
              <Fact k="Step functions" v="heaviside · sign">
                <p>heaviside: 0 if z &lt; 0, else 1. sign: −1 / 0 / +1. Heaviside is the usual pick.</p>
              </Fact>
              <Fact k="One TLU alone" v="a linear classifier">
                <p>Threshold a weighted sum — just like Logistic Regression or a linear SVM.</p>
              </Fact>
            </div>

            <TluPlayground />

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="Perceptron" v="one layer of TLUs"><p>Every TLU connected to every input: a <em>fully connected</em> (dense) layer — Fig 10-5 wires 2 inputs to 3 outputs.</p></Fact>
              <Fact k="Input layer"><p>The inputs themselves — no computation, just the features.</p></Fact>
              <Fact k="Output layer"><p>The TLU layer produces the final outputs.</p></Fact>
            </div>

            <Tex block src="h_{\mathbf{W},\mathbf{b}}(\mathbf{X}) = \phi(\mathbf{X}\mathbf{W} + \mathbf{b}^{\!\top})" />
            <Unfold label="The matrix form, symbol by symbol (slide 8)">
              <ul className="dl-list">
                <li><Tex src="\mathbf{X}" /> — the matrix of input features: one row per instance, one column per feature.</li>
                <li><Tex src="\mathbf{W}" /> — the weight matrix: one row per input feature, one column per neuron.</li>
                <li><Tex src="\mathbf{b}" /> — the bias vector: one bias per neuron.</li>
                <li><Tex src="\phi" /> — the <em>activation function</em>. Linear algebra makes the whole layer one multiply.</li>
              </ul>
            </Unfold>
          </Section>
        )}

        {tab === 'training' && (
          <Section key="training" n={2} title="How a Perceptron is trained" slides="9–15">
            <Hook sub="Rosenblatt’s algorithm was inspired by Hebb’s rule (after Donald Hebb): feed one instance at a time and reinforce the connections that would have got it right.">
              {TABS[2].hook}
            </Hook>

            <RuleAnatomy />
            <PerceptronTrainer />

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="Convergence theorem" v="separable ⇒ solved" tone="accent">
                <p>If the data is linearly separable, Rosenblatt proved the rule converges<Fnote n={1} />. The boundary stays linear though — complex patterns are out of reach.</p>
              </Fact>
              <Fact k="It’s SGD in disguise" v="SGDClassifier">
                <p>Scikit-Learn’s <code>Perceptron</code> ≡ <code>SGDClassifier(loss="perceptron", learning_rate="constant", eta0=1, penalty=None)</code>.</p>
              </Fact>
              <Fact k="vs Logistic Regression" v="no probabilities">
                <p>Perceptrons predict on a hard threshold — no class probability. A good reason to prefer Logistic Regression.</p>
              </Fact>
            </div>
          </Section>
        )}

        {tab === 'xor' && (
          <Section key="xor" n={3} title="The XOR crisis" slides="16–17">
            <Hook sub="Minsky & Papert’s 1969 monograph Perceptrons showed a single layer can’t solve trivially easy problems — and connectionism went dark.">
              {TABS[3].hook}
            </Hook>
            <XorGame />
            <XorMlp />
          </Section>
        )}

        {tab === 'backprop' && (
          <Section key="backprop" n={4} title="Multi-Layer Perceptrons & backpropagation" slides="18–19">
            <Hook sub="An MLP: a passthrough input layer, one or more hidden layers of TLUs, and an output layer (Figure 10-7). Training it took a 1986 idea.">
              {TABS[4].hook}
            </Hook>

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="Input layer" v="passthrough"><p>No computation — it just presents the features.</p></Fact>
              <Fact k="Hidden layers" v="1 or more"><p>Layers of TLUs between input and output — the “deep” in deep learning.</p></Fact>
              <Fact k="Output layer" v="the final TLUs"><p>Produces the network’s answer.</p></Fact>
            </div>

            <BackpropTour />
          </Section>
        )}

        {tab === 'acts' && (
          <Section key="acts" n={5} title="Activation functions" slides="20–23">
            <Hook sub={<>Backprop needs gradients — so Rumelhart et al. swapped the step function for the sigmoid<Fnote n={2} />, which has a well-defined nonzero derivative everywhere.</>}>
              {TABS[5].hook}
            </Hook>

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="The swap" v="step → σ" tone="accent">
                <p>step′(z) is 0 everywhere — nothing to descend. σ′(z) = σ(z)(1 − σ(z)) &gt; 0 everywhere.</p>
              </Fact>
              <Fact k="tanh" v={<Tex src="2\sigma(2z) - 1" />}>
                <p>Same S shape, continuous and differentiable, but ranges −1 to +1.</p>
              </Fact>
              <Fact k="ReLU" v={<Tex src="\max(0, z)" />}>
                <p>Not differentiable at 0 — yet fast, and with no maximum output it eases Gradient Descent in practice.</p>
              </Fact>
            </div>

            <ActivationGallery />
            <LinearityDemo />
          </Section>
        )}

        {tab === 'heads' && (
          <Section key="heads" n={6} title="Regression & classification MLPs" slides="24–31">
            <Hook sub="Same body, different head: the output layer and loss are chosen by the task — the hidden layers stay ReLU.">
              {TABS[6].hook}
            </Hook>

            <HeadPicker />
            <LossLab />
            <SoftmaxLab />

            <div className="dl-cardgrid dl-cardgrid--2">
              <Fact k="The modern template" v="Fig 10-9">
                <p>ReLU hidden layers + a softmax output block — the standard classification MLP.</p>
              </Fact>
              <Fact k="California housing" v="RMSE ≈ 0.505" tone="accent">
                <p>The slide-26 regressor (3 × 50 hidden). Prices are normalised to [0, 5], so that’s roughly a 10% error.</p>
              </Fact>
            </div>
            <Code code={MLPREG_CODE} label="mlp_regressor.py" meta="slide 26" />
          </Section>
        )}

        {tab === 'keras' && (
          <Section key="keras" n={7} title="Implementing MLPs with Keras" slides="32–33">
            <Hook sub="A high-level Deep Learning API for building, training, evaluating and executing all sorts of neural networks — keras.io.">
              {TABS[7].hook}
            </Hook>

            <div className="dl-cardgrid dl-cardgrid--3">
              <Fact k="Author" v="François Chollet"><p>Released as open source in March 2015; it quickly gained popularity.</p></Fact>
              <Fact k="Multibackend era" v="TF · CNTK · Theano"><p>The reference implementation ran on three libraries — “multibackend Keras”.</p></Fact>
              <Fact k="Since v2.4" v="TensorFlow-only" tone="accent"><p>Keras is now TensorFlow’s official high-level API.</p></Fact>
            </div>

            <Code code={KERAS_CODE} label="version_check.py" meta="slide 33" />
            <p className="dl-body">
              Check you have the unit’s versions before the next lecture — where the Sequential and
              Functional APIs (and hyperparameter fine-tuning) pick up this chapter’s roadmap.
            </p>
          </Section>
        )}

        {tab === 'quiz' && (
          <Section key="quiz" n={8} title="Check yourself" slides="everything">
            <Hook sub={`${QUIZ.length} questions, instant verdicts, slide receipts.`}>{TABS[8].hook}</Hook>
            <Quiz
              quiz={QUIZ}
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
          <p className="dl-hero__kicker">CITS5017 · Topic 1 · Chapter 10 · Hands-On ML (Géron, 3rd ed.)</p>
          <h3 className="dl-hero__title">Introduction to Artificial Neural Networks</h3>
          <p className="dl-hero__byline">A/Prof Du Huynh (Unit Coordinator and Lecturer) · UWA · Semester 2, 2026</p>
          <p className="dl-hero__lead">
            From a 1957 neuron to your first deep network: perceptrons, the rule that trains them,
            the XOR wall, the backprop breakthrough — and which head to bolt on for any task.
            Eight playable levels; every figure is a lab.
          </p>
          <div className="dl-hero__stats">
            <span><b>33</b> slides</span>
            <span><b>9</b> live labs</span>
            <span><b>2</b> layers to crack XOR</span>
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
        <p className="dl-next__k">Also on the Chapter 10 roadmap — next lecture</p>
        <div className="dl-next__chips">
          {['Training a DNN with the Sequential API', 'Training a DNN with the Functional API', 'Fine-tuning neural network hyperparameters'].map((c) => (
            <span key={c} className="dl-next__chip">{c}</span>
          ))}
          <span className="dl-next__chip">…then Topic 2 → the Lecture 2 tab</span>
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
            <b>Reading: Chapter 10</b> — same salamander, one chapter earlier than Lecture 2.
            Citations pop up on the little numbers, like this<Fnote n={2} />.
          </p>
          <Unfold label="Footnotes & sources">
            <ol className="dl-refs">
              {Object.entries(REFS).map(([n, r]) => (
                <li key={n} value={n}>{r}</li>
              ))}
            </ol>
            <p className="dl-body">
              Source deck: <em>CITS5017 — Topic 1: Introduction to Artificial Neural Networks</em>,
              A/Prof Du Huynh, UWA (33 slides, all covered here).
            </p>
          </Unfold>
        </div>
      </div>
    </div>
  );
}
