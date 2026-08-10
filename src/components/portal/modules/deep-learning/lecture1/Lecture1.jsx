import { useRef, useState } from 'react';
import { Tex, Fnote, Code, Section, Hook, Fact, Unfold, RefsProvider, Outline, Sub, Eq, Jot } from '../kit';
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
   slides) as a TABBED interactive page on the shared .dl-* framework — laid
   out as a NOTETAKING SPINE: every tab opens with its numbered skeleton
   (Outline), walks numbered subs (Sub n.m: concept → named Eq → lab), and
   closes with a tickable "Note it down" recap (Jot) that is exactly what
   belongs in the notebook.

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
            <Outline
              items={[
                ['1.1', 'The threshold logic unit'],
                ['1.2', 'From TLU to Perceptron'],
                ['1.3', 'The layer as one equation'],
              ]}
            />

            <Sub no="1.1" title="The threshold logic unit (TLU)" slides="slides 4–6">
              <Eq
                no="1.1"
                name="The TLU"
                src="z = \mathbf{w}^{\mathsf T}\mathbf{x} + b \;\;\longrightarrow\;\; \hat{y} = \operatorname{step}(z)"
                read="weighted sum of the inputs, plus a bias — then a step function decides"
              />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="In & out" v="numbers" tone="accent">
                  <p>Inputs and output are numbers (not on/off spikes), and every input connection carries a weight.</p>
                </Fact>
                <Fact k="Step functions" v="heaviside · sign">
                  <p>heaviside: 0 if z &lt; 0, else 1. sign: −1 / 0 / +1. Heaviside is the usual pick.</p>
                </Fact>
                <Fact k="One TLU alone" v="a linear classifier">
                  <p>Threshold a weighted sum — just like Logistic Regression or a linear SVM.</p>
                </Fact>
              </div>
              <TluPlayground />
            </Sub>

            <Sub no="1.2" title="From TLU to Perceptron" slides="slides 6–7">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Perceptron" v="one layer of TLUs" tone="accent"><p>Every TLU connected to every input: a <em>fully connected</em> (dense) layer — Fig 10-5 wires 2 inputs to 3 outputs.</p></Fact>
                <Fact k="Input layer"><p>The inputs themselves — no computation, just the features.</p></Fact>
                <Fact k="Output layer"><p>The TLU layer produces the final outputs.</p></Fact>
              </div>
            </Sub>

            <Sub no="1.3" title="The whole layer, one equation" slides="slide 8">
              <Eq
                no="1.2"
                name="Dense layer, matrix form"
                src="h_{\mathbf{W},\mathbf{b}}(\mathbf{X}) = \phi(\mathbf{X}\mathbf{W} + \mathbf{b}^{\!\top})"
                read="one matrix multiply computes every neuron for every instance — φ is the activation function"
              />
              <Unfold label="The matrix form, symbol by symbol (slide 8)">
                <ul className="dl-list">
                  <li><Tex src="\mathbf{X}" /> — the matrix of input features: one row per instance, one column per feature.</li>
                  <li><Tex src="\mathbf{W}" /> — the weight matrix: one row per input feature, one column per neuron.</li>
                  <li><Tex src="\mathbf{b}" /> — the bias vector: one bias per neuron.</li>
                  <li><Tex src="\phi" /> — the <em>activation function</em>. Linear algebra makes the whole layer one multiply.</li>
                </ul>
              </Unfold>
            </Sub>

            <Jot
              items={[
                <>TLU: <Tex src="z=\mathbf{w}^{\mathsf T}\mathbf{x}+b" />, output = step(z) — heaviside gives 0/1, sign gives −1/0/+1.</>,
                <>One TLU thresholds a weighted sum → a <b>linear classifier</b>; its decision boundary is always a straight line.</>,
                <>Perceptron = a single <b>fully connected (dense) layer</b> of TLUs; the inputs are the input layer, the TLUs the output layer.</>,
                <>Whole layer at once: <Tex src="h_{\mathbf{W},\mathbf{b}}(\mathbf{X})=\phi(\mathbf{X}\mathbf{W}+\mathbf{b}^{\top})" /> — rows of X = instances, columns of W = neurons.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'training' && (
          <Section key="training" n={2} title="How a Perceptron is trained" slides="9–15">
            <Hook sub="Rosenblatt’s algorithm was inspired by Hebb’s rule (after Donald Hebb): feed one instance at a time and reinforce the connections that would have got it right.">
              {TABS[2].hook}
            </Hook>
            <Outline
              items={[
                ['2.1', 'Hebb’s intuition'],
                ['2.2', 'The learning rule'],
                ['2.3', 'Watch it learn, live'],
                ['2.4', 'Limits & neighbours'],
              ]}
            />

            <Sub no="2.1" title="Hebb’s intuition" slides="slide 9">
              <p className="dl-body">
                Hebbian learning: connections between neurons that activate together get <em>stronger</em> —
                “cells that fire together, wire together.” Rosenblatt’s twist: train on one instance at a
                time, and only move the weights of output neurons that got it <em>wrong</em>, reinforcing
                the inputs that would have contributed to the correct answer.
              </p>
            </Sub>

            <Sub no="2.2" title="The learning rule, term by term" slides="slides 10–11">
              <RuleAnatomy />
            </Sub>

            <Sub no="2.3" title="Rosenblatt’s algorithm, live" slides="slides 9 · 12–13">
              <PerceptronTrainer />
            </Sub>

            <Sub no="2.4" title="Limits & neighbours" slides="slides 12 · 14–15">
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
            </Sub>

            <Jot
              items={[
                <>Hebb’s rule: cells that fire together, wire together — reinforce the connections that help correct predictions.</>,
                <>Update one instance at a time: <Tex src="w_{i,j} \leftarrow w_{i,j} + \eta\,(y_j-\hat{y}_j)\,x_i" /> — a correct output means zero update.</>,
                <>Convergence theorem: linearly separable data ⇒ the rule converges (the solution is not unique); the boundary stays linear.</>,
                <>The rule is SGD on squared error — sklearn’s Perceptron ≡ SGDClassifier(loss="perceptron", eta0=1, penalty=None).</>,
                <>Hard threshold → no class probabilities — a good reason to prefer Logistic Regression.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'xor' && (
          <Section key="xor" n={3} title="The XOR crisis" slides="16–17">
            <Hook sub="Minsky & Papert’s 1969 monograph Perceptrons showed a single layer can’t solve trivially easy problems — and connectionism went dark.">
              {TABS[3].hook}
            </Hook>
            <Outline
              items={[
                ['3.1', 'Try to cut it with one line'],
                ['3.2', 'Two layers crack it'],
              ]}
            />

            <Sub no="3.1" title="Try to cut it with one line" slides="slide 16">
              <XorGame />
            </Sub>

            <Sub no="3.2" title="Two layers crack it" slides="slide 17">
              <XorMlp />
            </Sub>

            <Jot
              items={[
                <>XOR: ▲ at (0,0),(1,1) vs ■ at (0,1),(1,0) — <b>no single line separates them</b>, so a one-layer Perceptron fails (Minsky &amp; Papert, 1969).</>,
                <>True of any linear model — Logistic Regression included. The result froze connectionism for years.</>,
                <>Stack two layers (an AND unit and an OR unit, output = OR − AND) and XOR falls. Stacked Perceptrons = a Multi-Layer Perceptron.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'backprop' && (
          <Section key="backprop" n={4} title="Multi-Layer Perceptrons & backpropagation" slides="18–19">
            <Hook sub="An MLP: a passthrough input layer, one or more hidden layers of TLUs, and an output layer (Figure 10-7). Training it took a 1986 idea.">
              {TABS[4].hook}
            </Hook>
            <Outline
              items={[
                ['4.1', 'MLP anatomy'],
                ['4.2', 'Backprop, four phases'],
              ]}
            />

            <Sub no="4.1" title="MLP anatomy" slides="slide 18">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Input layer" v="passthrough"><p>No computation — it just presents the features.</p></Fact>
                <Fact k="Hidden layers" v="1 or more"><p>Layers of TLUs between input and output — the “deep” in deep learning.</p></Fact>
                <Fact k="Output layer" v="the final TLUs"><p>Produces the network’s answer.</p></Fact>
              </div>
            </Sub>

            <Sub no="4.2" title="Backpropagation, four phases" slides="slide 19">
              <BackpropTour />
            </Sub>

            <Jot
              items={[
                <>MLP = passthrough input layer + one or more hidden TLU layers + an output layer.</>,
                <>Backprop (Rumelhart–Hinton–Williams, 1986): forward pass → measure the error → reverse pass assigns each connection its error share → Gradient-Descent step. Repeat.</>,
                <>It is Gradient Descent using reverse-mode autodiff — two passes through the network give every gradient.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'acts' && (
          <Section key="acts" n={5} title="Activation functions" slides="20–23">
            <Hook sub={<>Backprop needs gradients — so Rumelhart et al. swapped the step function for the sigmoid<Fnote n={2} />, which has a well-defined nonzero derivative everywhere.</>}>
              {TABS[5].hook}
            </Hook>
            <Outline
              items={[
                ['5.1', 'Why the step had to go'],
                ['5.2', 'The classic four, live'],
                ['5.3', 'Why nonlinearity at all'],
              ]}
            />

            <Sub no="5.1" title="Why the step had to go" slides="slide 20">
              <Eq
                no="5.1"
                name="The sigmoid (logistic)"
                src="\sigma(z) = \frac{1}{1+e^{-z}}, \qquad \sigma'(z) = \sigma(z)\big(1-\sigma(z)\big)"
                read="a smooth S from 0 to 1 — its derivative is nonzero everywhere, so Gradient Descent has something to use"
              />
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
            </Sub>

            <Sub no="5.2" title="The classic four, live" slides="slides 20–22">
              <ActivationGallery />
            </Sub>

            <Sub no="5.3" title="Why nonlinearity at all" slides="slide 23">
              <LinearityDemo />
            </Sub>

            <Jot
              items={[
                <>step′(z) = 0 everywhere → nothing to descend. Backprop needed a differentiable activation — the sigmoid.</>,
                <><Tex src="\sigma(z)=1/(1+e^{-z})" />; <Tex src="\sigma'=\sigma(1-\sigma)" /> — nonzero everywhere, max 0.25 at z = 0.</>,
                <>tanh(z) = 2σ(2z) − 1 — same S shape, range (−1, 1), zero-centred.</>,
                <>ReLU(z) = max(0, z) — not differentiable at 0, no maximum output, fast: the practical default.</>,
                <>Without a nonlinearity between layers, any stack of linear layers collapses to one linear layer.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'heads' && (
          <Section key="heads" n={6} title="Regression & classification MLPs" slides="24–31">
            <Hook sub="Same body, different head: the output layer and loss are chosen by the task — the hidden layers stay ReLU.">
              {TABS[6].hook}
            </Hook>
            <Outline
              items={[
                ['6.1', 'Pick the head'],
                ['6.2', 'Regression losses'],
                ['6.3', 'Softmax & cross-entropy'],
                ['6.4', 'The recipe in code'],
              ]}
            />

            <Sub no="6.1" title="Pick the head" slides="slides 24 · 27 · 29 · 31">
              <HeadPicker />
            </Sub>

            <Sub no="6.2" title="Regression losses" slides="slides 25 · 27–28">
              <LossLab />
            </Sub>

            <Sub no="6.3" title="Softmax & cross-entropy" slides="slide 29">
              <Eq
                no="6.1"
                name="Softmax"
                src="\hat{p}_k = \frac{\exp(z_k)}{\sum_{j=1}^{K}\exp(z_j)}"
                read="exponentiate every logit, then normalise — K probabilities that always sum to 1"
              />
              <SoftmaxLab />
            </Sub>

            <Sub no="6.4" title="The recipe in code" slides="slide 26">
              <div className="dl-cardgrid dl-cardgrid--2">
                <Fact k="The modern template" v="Fig 10-9">
                  <p>ReLU hidden layers + a softmax output block — the standard classification MLP.</p>
                </Fact>
                <Fact k="California housing" v="RMSE ≈ 0.505" tone="accent">
                  <p>The slide-26 regressor (3 × 50 hidden). Prices are normalised to [0, 5], so that’s roughly a 10% error.</p>
                </Fact>
              </div>
              <Code code={MLPREG_CODE} label="mlp_regressor.py" meta="slide 26" />
            </Sub>

            <Jot
              items={[
                <>Same ReLU body everywhere: 1–5 hidden layers, 10–100 neurons each — only the head and the loss change with the task.</>,
                <>Regression head: 1 neuron per output dimension; activation none (any value), ReLU/softplus (positive), sigmoid/tanh (bounded). Loss: MSE — MAE if outliers, Huber for both.</>,
                <>Binary / multilabel classification: sigmoid neuron(s) + cross-entropy. Multiclass: softmax over K neurons + cross-entropy.</>,
                <>Softmax: <Tex src="\hat{p}_k = e^{z_k}/\sum_j e^{z_j}" /> — probabilities summing to 1; cross-entropy −log p̂ blows up when the true class gets low probability.</>,
                <>California-housing MLP (3 × 50): RMSE ≈ 0.505 on [0, 5]-scaled prices ≈ 10% error.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'keras' && (
          <Section key="keras" n={7} title="Implementing MLPs with Keras" slides="32–33">
            <Hook sub="A high-level Deep Learning API for building, training, evaluating and executing all sorts of neural networks — keras.io.">
              {TABS[7].hook}
            </Hook>
            <Outline
              items={[
                ['7.1', 'What Keras is'],
                ['7.2', 'Version check'],
              ]}
            />

            <Sub no="7.1" title="What Keras is" slides="slide 32">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Author" v="François Chollet"><p>Released as open source in March 2015; it quickly gained popularity.</p></Fact>
                <Fact k="Multibackend era" v="TF · CNTK · Theano"><p>The reference implementation ran on three libraries — “multibackend Keras”.</p></Fact>
                <Fact k="Since v2.4" v="TensorFlow-only" tone="accent"><p>Keras is now TensorFlow’s official high-level API.</p></Fact>
              </div>
            </Sub>

            <Sub no="7.2" title="Version check" slides="slide 33">
              <Code code={KERAS_CODE} label="version_check.py" meta="slide 33" />
              <p className="dl-body">
                Check you have the unit’s versions before the next lecture — where the Sequential and
                Functional APIs (and hyperparameter fine-tuning) pick up this chapter’s roadmap.
              </p>
            </Sub>

            <Jot
              items={[
                <>Keras (François Chollet, open-sourced March 2015): the high-level API for building, training, evaluating and running neural networks — keras.io.</>,
                <>Was multibackend (TF / CNTK / Theano); since v2.4 it is TensorFlow’s official high-level API.</>,
                <>Unit versions to have installed: tf 2.17.0 / keras 3.10.0 — check before the next lecture.</>,
              ]}
            />
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
            Built for the notebook: every level opens with its numbered skeleton, boxes its
            equations, and ends with a tickable <em>Note it down</em> list.
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
