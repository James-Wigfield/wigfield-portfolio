import { useEffect, useRef, useState } from 'react';
import { Tex, Fnote, Section, Hook, Fact, Unfold, RefsProvider, Outline, Sub, Eq, Jot } from '../kit';
import { CortexLab, ConvolutionLab, StrideLab, ParamShareLab } from './labs';
import { FeatureMapLab, StackingLab, KerasShapesLab, Quiz } from './labs2';
import { QUIZ, scoreOf } from './quiz';
import '../common.css';
import './lecture3.css';

/* ============================================================================
   CITS5017 · LECTURE 3 — TOPIC 3: DEEP COMPUTER VISION USING CNNs
   ----------------------------------------------------------------------------
   The full content of Documents/cits5017/markdown-lecs/lecture-3.md (slides
   1–16) as a TABBED interactive page — laid out as a NOTETAKING SPINE:
   every tab opens with its numbered skeleton (Outline), walks numbered subs
   (Sub n.m: concept → lab), and closes with a tickable "Note it down" recap
   (Jot) holding exactly what belongs in the notebook.

     START        level-select + the deck's roadmap (slides 1–3) + sources
     ORIGINS      slides 4–5    visual cortex → neocognitron → CNNs
     CONVOLUTION  slide 6       the equation + a kernel you slide yourself
     CONV LAYERS  slides 7–9    receptive fields, weight sharing, strides
     FILTERS      slides 10–11  two 7×7 line filters → two feature maps, live
     STACKING     slides 12–15  3D layers, channels, z_k = b_k + Σ x_c ∗ f_c,k
     KERAS        slide 16      the four tensors, as a calculator
     QUIZ         10 questions; the tab wears the live score

   Long slide passages live in <Unfold> rows, citations in <Fnote> popovers —
   everything from the deck is here, none of it as a wall of text.
   ========================================================================== */

const REFS = {
  1: 'David H. Hubel, “Single Unit Activity in Striate Cortex of Unrestrained Cats,” The Journal of Physiology 147 (1959): 226–238.',
  2: 'David H. Hubel and Torsten N. Wiesel, “Receptive Fields of Single Neurons in the Cat’s Striate Cortex,” The Journal of Physiology 148 (1959): 574–591.',
  3: 'Kunihiko Fukushima, “Neocognitron: A Self-Organizing Neural Network Model for a Mechanism of Pattern Recognition Unaffected by Shift in Position,” Biological Cybernetics 36 (1980): 193–202.',
  4: 'One bias term per filter in the convolution layer.',
};

const TABS = [
  { id: 'start', label: 'Start', no: '00' },
  { id: 'origins', label: 'Origins', no: '01', slides: '4–5', hook: 'It started with a cat watching lines.' },
  { id: 'conv', label: 'Convolution', no: '02', slides: '6', hook: 'Nine multiplies, slid across an image.' },
  { id: 'layers', label: 'Conv Layers', no: '03', slides: '7–9', hook: 'Connect to a patch, not the picture.' },
  { id: 'filters', label: 'Filters', no: '04', slides: '10–11', hook: 'One filter finds one feature — everywhere.' },
  { id: 'stack', label: 'Stacking', no: '05', slides: '12–15', hook: 'A conv layer is a 3D stack of maps.' },
  { id: 'keras', label: 'Keras', no: '06', slides: '16', hook: 'Four tensors hold the whole layer.' },
  { id: 'quiz', label: 'Quiz', no: '07', slides: 'all', hook: 'Prove it.' },
];

const LEVEL_BLURBS = {
  origins: 'A cat’s cortex → receptive fields → the neocognitron.',
  conv: 'Slide a 3×3 kernel yourself — every multiply shown.',
  layers: 'Receptive fields, 10-parameter filters, strides & padding.',
  filters: 'Two 7×7 filters convolved over a temple — for real.',
  stack: '3 channels in, K maps out: the 3D truth of a conv layer.',
  keras: 'Four tensors, one calculator.',
  quiz: '10 questions, instant verdicts, slide receipts.',
};

/* ── Decorative sliding-kernel animation for the Start hero ──────────────── */
const HERO_IMG = [
  [0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0],
  [1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1],
  [0, 1, 1, 0, 0],
];

function ConvHero() {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [s, setS] = useState(reduced ? 8 : 0);
  useEffect(() => {
    if (reduced) return undefined;
    const t = setInterval(() => setS((v) => (v + 1) % 10), 620);
    return () => clearInterval(t);
  }, [reduced]);
  const p = Math.min(s, 8);
  const oy = Math.floor(p / 3);
  const ox = p % 3;
  const C = 26;
  return (
    <svg viewBox="0 0 310 168" className="dl3-hero" aria-hidden="true">
      {HERO_IMG.map((row, y) =>
        row.map((v, x) => (
          <rect key={`${x}${y}`} x={8 + x * C} y={14 + y * C} width={C} height={C} className="dl3-hero__icell" style={{ fillOpacity: 0.08 + v * 0.3 }} />
        )),
      )}
      <g className="dl3-hero__win" style={{ transform: `translate(${ox * C}px, ${oy * C}px)` }}>
        <rect x={9} y={15} width={3 * C - 2} height={3 * C - 2} className="dl3-hero__winrect" />
      </g>
      <path d="M148 79 h34 m-8 -6 8 6 -8 6" className="dl3-hero__arrow" />
      {[0, 1, 2].map((y) =>
        [0, 1, 2].map((x) => {
          const idx = y * 3 + x;
          return (
            <rect
              key={`${x}${y}`}
              x={196 + x * C}
              y={40 + y * C}
              width={C}
              height={C}
              className={`dl3-hero__ocell${idx <= p && s <= 8 ? ' dl3-hero__ocell--on' : ''}`}
            />
          );
        }),
      )}
      <text x={8 + 2.5 * C} y={162} textAnchor="middle" className="dl3-hero__tag">input</text>
      <text x={196 + 1.5 * C} y={135} textAnchor="middle" className="dl3-hero__tag">feature map</text>
    </svg>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */
export default function Lecture3() {
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

        {tab === 'origins' && (
          <Section key="origins" n={1} title="Where CNNs come from" slides="4–5">
            <Hook sub={<>Hubel<Fnote n={1} /> and Wiesel<Fnote n={2} /> probed a cat’s visual cortex and found neurons that only fire for specific patterns in small regions — <em>receptive fields</em>.</>}>
              {TABS[1].hook}
            </Hook>
            <Outline
              items={[
                ['1.1', 'The visual cortex'],
                ['1.2', 'Receptive fields, live'],
                ['1.3', 'Neocognitron → CNNs'],
              ]}
            />

            <Sub no="1.1" title="The visual cortex" slides="slide 4">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="The experiment" v="1959"><p>Single-unit recordings in a cat’s striate cortex<Fnote n={1} /><Fnote n={2} /> — the studies CNNs grew out of.</p></Fact>
                <Fact k="The finding" v="receptive fields" tone="accent"><p>Neurons respond to specific patterns in <em>small regions</em> of the visual field — not the whole scene.</p></Fact>
                <Fact k="The hierarchy" v="deeper = bigger"><p>Through consecutive brain modules, neurons respond to more complex patterns in larger receptive fields.</p></Fact>
              </div>
            </Sub>

            <Sub no="1.2" title="Receptive fields, live" slides="slide 4 · Figure 14-1">
              <CortexLab />
            </Sub>

            <Sub no="1.3" title="From neocognitron to CNNs" slides="slide 5">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="1980" v="neocognitron"><p>Fukushima’s self-organizing model<Fnote n={3} /> — inspired by the cortex studies, it gradually evolved into today’s CNNs.</p></Fact>
                <Fact k="Why now" v="3 ingredients"><p>Computational power + training data + the Chapter-11 tricks → superhuman performance on some complex visual tasks.</p></Fact>
                <Fact k="Not just vision" v="voice · NLP"><p>CNNs also succeed at other tasks, such as voice recognition and natural language processing.</p></Fact>
              </div>
            </Sub>

            <Jot
              items={[
                <>Visual-cortex neurons respond to specific patterns in small regions of the visual field called <b>receptive fields</b> (Hubel 1959; Hubel &amp; Wiesel 1959).</>,
                <>Deeper brain modules: neurons respond to <b>more complex patterns</b> in <b>larger receptive fields</b> — the blueprint every CNN copies.</>,
                <>Those studies inspired the <b>neocognitron</b> (Fukushima, 1980), which gradually evolved into convolutional neural networks.</>,
                <>Thanks to compute + data + the Ch-11 training tricks, CNNs reach superhuman performance on some visual tasks — and also work for voice recognition and NLP.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'conv' && (
          <Section key="conv" n={2} title="Convolution: a brief introduction" slides="6">
            <Hook sub="One equation, four classic filters — then slide the kernel yourself and watch every multiply-accumulate happen.">
              {TABS[2].hook}
            </Hook>
            <Outline
              items={[
                ['2.1', 'The operation'],
                ['2.2', 'Slide the kernel yourself'],
                ['2.3', 'The four classic filters'],
              ]}
            />

            <Sub no="2.1" title="The operation" slides="slide 6">
              <Eq
                no="2.1"
                name="2-D convolution (3×3 filter)"
                src="I'(x, y) = \sum_{i=-1}^{1}\sum_{j=-1}^{1} I(x + i,\, y + j)\, f(i, j)"
                read="centre the 3×3 filter on pixel (x, y); multiply each neighbour by its matching weight and add the nine products — that sum is the output pixel."
              />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="I" v="input image"><p>The image being filtered.</p></Fact>
                <Fact k="f" v="the filter"><p>A small matrix of weights — 3×3 here, but larger filters can be defined.</p></Fact>
                <Fact k="I′" v="output image"><p>One value per position the filter can centre on.</p></Fact>
              </div>
              <Unfold label="The slide's own animation links (1-D and 2-D convolution)">
                <ul className="dl-list">
                  <li><code>https://www.youtube.com/watch?v=ulKbLD6BRJA</code> — 1-D convolution, animated.</li>
                  <li><code>https://commons.wikimedia.org/wiki/File:2D_Convolution_Animation.gif</code> — the classic 2-D sliding-window GIF (the lab below is that GIF, but in your hands).</li>
                </ul>
              </Unfold>
            </Sub>

            <Sub no="2.2" title="Slide the kernel yourself" slides="slide 6">
              <ConvolutionLab />
            </Sub>

            <Sub no="2.3" title="The four classic filters" slides="slide 6">
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="Sobel-x" v={<Tex src="\begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix}" />}><p>Detects <b>vertical</b> edges.</p></Fact>
                <Fact k="Sobel-y" v={<Tex src="\begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix}" />}><p>Detects <b>horizontal</b> edges.</p></Fact>
                <Fact k="Uniform averaging" v={<Tex src="\tfrac{1}{9}\begin{bmatrix} 1 & 1 & 1 \\ 1 & 1 & 1 \\ 1 & 1 & 1 \end{bmatrix}" />}><p>Smooths — every output is the mean of its 3×3 patch.</p></Fact>
                <Fact k="Laplacian" v={<Tex src="\begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}" />}><p>2nd-derivative filter — fires on rapid intensity change.</p></Fact>
              </div>
            </Sub>

            <Jot
              items={[
                <>Convolution: <Tex src="I'(x,y) = \textstyle\sum_i \sum_j I(x{+}i,\, y{+}j)\, f(i,j)" /> — centre the filter on (x, y), multiply, add.</>,
                <>Four classics: <b>Sobel-x</b> → vertical edges · <b>Sobel-y</b> → horizontal edges · <b>uniform 1/9</b> → smoothing · <b>Laplacian</b> → 2nd derivative.</>,
                <>Larger filters can be defined; <b>odd</b> sizes (3×3, 5×5, 7×7, …) are usually preferred — they have a centre pixel to sit on.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'layers' && (
          <Section key="layers" n={3} title="Convolutional layers" slides="7–9">
            <Hook sub="The most important building block of a CNN: neurons wired to a small rectangle of the layer below — all of them sharing one filter.">
              {TABS[3].hook}
            </Hook>
            <Outline
              items={[
                ['3.1', 'Receptive fields, not full images'],
                ['3.2', 'One filter, ten parameters'],
                ['3.3', 'Strides & padding, live'],
              ]}
            />

            <Sub no="3.1" title="Receptive fields, not full images" slides="slide 7 · Figure 14-2">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Layer 1" v="pixels → patch" tone="accent"><p>First-conv-layer neurons are <u>not</u> connected to every input pixel — only to pixels in their receptive fields.</p></Fact>
                <Fact k="Layer 2" v="patch of layer 1"><p>Each second-layer neuron connects only to a small rectangle of the first layer.</p></Fact>
                <Fact k="The payoff" v="hierarchy"><p>Low-level features in the first hidden layer, assembled into higher-level features in the next, and so on.</p></Fact>
              </div>
            </Sub>

            <Sub no="3.2" title="One filter, ten parameters" slides="slide 8">
              <ParamShareLab />
            </Sub>

            <Sub no="3.3" title="Strides & padding, live" slides="slide 9 · Figure 14-4">
              <StrideLab />
            </Sub>

            <Jot
              items={[
                <>Conv-layer neurons see only their <b>receptive field</b>, not the whole image; layer-2 neurons see a small rectangle of layer 1 — low-level features assemble into higher-level ones.</>,
                <>Weight sharing (slide 8): one 3×3 filter <Tex src="\mathbf{W}" /> = 9 weights + 1 bias, <em>regardless</em> of the feature map’s rows and columns.</>,
                <>The <b>stride</b> is the distance between two consecutive receptive fields — striding lets a large layer feed a much smaller one.</>,
                <>Neuron (i, j) connects to rows <Tex src="i\,s_h" /> … <Tex src="i\,s_h + f_h - 1" />, cols <Tex src="j\,s_w" /> … <Tex src="j\,s_w + f_w - 1" />. Zero padding keeps the borders reachable (5×7 + padding, 3×3 fields, stride 2 → 3×4).</>,
              ]}
            />
          </Section>
        )}

        {tab === 'filters' && (
          <Section key="filters" n={4} title="Filters & feature maps" slides="10–11">
            <Hook sub="A neuron's weights drawn as a picture are a filter. Convolve one over the whole image and you get a feature map.">
              {TABS[4].hook}
            </Hook>
            <Outline
              items={[
                ['4.1', 'A filter is a tiny image'],
                ['4.2', 'Two feature maps from one photo'],
              ]}
            />

            <Sub no="4.1" title="A filter is a tiny image" slides="slide 10">
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="The idea" v="weights = image" tone="accent"><p>A neuron’s weights can be drawn as a small image the same size as its receptive field.</p></Fact>
                <Fact k="Vertical-line filter" v="7×7, centre column 1s"><p>All 0s except the central column — the neuron ignores everything except the central vertical line (everything else × 0).</p></Fact>
                <Fact k="Horizontal-line filter" v="7×7, centre row 1s"><p>The transpose: only the central horizontal line survives the multiply.</p></Fact>
              </div>
            </Sub>

            <Sub no="4.2" title="Two feature maps from one photo" slides="slide 11 · Figure 14-5">
              <FeatureMapLab />
            </Sub>

            <Jot
              items={[
                <>A neuron’s weights are representable as a small image the size of its receptive field — a <b>filter</b> (or <b>convolution kernel</b>).</>,
                <>The 7×7 vertical-line filter: all 0s except a central column of 1s → everything but the central vertical line is multiplied by 0 and ignored.</>,
                <>One input convolved with two different filters → two <b>feature maps</b>: verticals dominate one, horizontals the other (Figure 14-5).</>,
              ]}
            />
          </Section>
        )}

        {tab === 'stack' && (
          <Section key="stack" n={5} title="Stacking multiple feature maps" slides="12–15">
            <Hook sub="The thin 2D layer was a simplification. A real convolutional layer is several feature maps deep — a 3D block.">
              {TABS[5].hook}
            </Hook>
            <Outline
              items={[
                ['5.1', 'Layers are 3D'],
                ['5.2', 'Explore the stack'],
                ['5.3', 'The multi-channel convolution'],
              ]}
            />

            <Sub no="5.1" title="Layers are 3D" slides="slides 12–14">
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="Within one map" v="shared params" tone="accent"><p>All neurons of a feature map share the same weights and bias — the map’s filter.</p></Fact>
                <Fact k="Across maps" v="different params"><p>Each feature map is generated by convolving a <em>different</em> filter with the layer’s input.</p></Fact>
                <Fact k="Receptive field" v="spans all maps"><p>A neuron’s field extends across <em>all</em> the previous layer’s feature maps (or the input’s channels).</p></Fact>
                <Fact k="Same (i, j)" v="same inputs"><p>Neurons at the same row and column in different maps connect to the outputs of the <em>exact same</em> neurons below.</p></Fact>
              </div>
            </Sub>

            <Sub no="5.2" title="Explore the stack" slides="slides 12 & 14 · Figure 14-6">
              <StackingLab />
            </Sub>

            <Sub no="5.3" title="The multi-channel convolution" slides="slide 15">
              <Eq
                no="5.1"
                name="output channel k"
                src="z_k = b_k + \sum_{c=0}^{N_{\text{channels}}-1} x_c * f_{c,k}"
                read="filter k convolves every input channel c with its matching filter channel, sums the results, adds one bias — one output feature map."
              />
              <div className="dl-cardgrid dl-cardgrid--3">
                <Fact k="Legal filters" v={<Tex src="n_h \times n_w \times N_{\text{ch}}" />}><p>Each filter <Tex src="f_k" /> must have <Tex src="N_{\text{channels}}" /> channels for the convolution to be legal.</p></Fact>
                <Fact k="K filters stack into" v={<Tex src="n_h \times n_w \times N_{\text{ch}} \times K" />}><p>One 4D tensor holds every filter of the layer.</p></Fact>
                <Fact k="Each filter makes" v="1 output channel" tone="accent"><p>A layer with <Tex src="n" /> filters outputs <Tex src="n" /> feature maps — <Tex src="n" /> channels.</p></Fact>
              </div>
            </Sub>

            <Jot
              items={[
                <>A real conv layer is <b>3D</b>: several feature maps stacked. Within one map, all neurons share the same filter weights + bias.</>,
                <>Different maps use different filters — a layer with <Tex src="n" /> filters simultaneously detects <Tex src="n" /> features anywhere in its input, and outputs <Tex src="n" /> channels.</>,
                <>A neuron’s receptive field spans <b>all</b> feature maps of the previous layer; same (i, j) across maps sees the exact same inputs.</>,
                <><Tex src="z_k = b_k + \textstyle\sum_c x_c * f_{c,k}" /> — each filter has <Tex src="N_{\text{channels}}" /> channels and produces exactly one output channel.</>,
              ]}
            />
          </Section>
        )}

        {tab === 'keras' && (
          <Section key="keras" n={6} title="Convolutional layers in Keras" slides="16">
            <Hook sub={<>Everything the layer is — images, batches, filters, biases<Fnote n={4} /> — lives in exactly four tensors.</>}>
              {TABS[6].hook}
            </Hook>
            <Outline
              items={[
                ['6.1', 'The four tensors'],
                ['6.2', 'Shape it yourself'],
              ]}
            />

            <Sub no="6.1" title="The four tensors" slides="slide 16">
              <div className="dl-cardgrid dl-cardgrid--4">
                <Fact k="One image" v="3D"><p><code>[height, width, channels]</code></p></Fact>
                <Fact k="A mini-batch" v="4D"><p><code>[batch, height, width, channels]</code></p></Fact>
                <Fact k="The weights" v="4D" tone="accent"><p><code>[f_h, f_w, f_c, f_n]</code> — filter size, filter channels (= input channels), filter count.</p></Fact>
                <Fact k="The biases" v="1D"><p><code>[f_n]</code> — one bias per filter<Fnote n={4} />.</p></Fact>
              </div>
            </Sub>

            <Sub no="6.2" title="Shape it yourself" slides="slide 16">
              <KerasShapesLab />
            </Sub>

            <Jot
              items={[
                <>One image: 3D tensor <code>[height, width, channels]</code> · a mini-batch: 4D <code>[batch, height, width, channels]</code>.</>,
                <>All filters of a conv layer: 4D tensor <code>[f_h, f_w, f_c, f_n]</code>, where f_c must equal the input’s channel count.</>,
                <>Biases: 1D tensor <code>[f_n]</code> — one bias per filter.</>,
                <>Parameter count of a conv layer: f_h·f_w·f_c·f_n + f_n — independent of the image size.</>,
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
          <p className="dl-hero__kicker">CITS5017 · Topic 3 · Chapter 14 · Hands-On ML (Géron, 3rd ed.)</p>
          <h3 className="dl-hero__title">Deep Computer Vision Using CNNs</h3>
          <p className="dl-hero__byline">A/Prof Du Huynh · UWA · Semester 2, 2026</p>
          <p className="dl-hero__lead">
            From a cat’s visual cortex to the convolutional layer — rebuilt from the deck’s first 16
            slides as seven playable levels. Built for the notebook: every level opens with its
            numbered skeleton and ends with a tickable <em>Note it down</em> list.
          </p>
          <div className="dl-hero__stats">
            <span><b>16</b> slides</span>
            <span><b>6</b> live labs</span>
            <span><b>4</b> classic filters</span>
            <span><b>10</b> quiz questions</span>
          </div>
        </div>
        <div className="dl-hero__side">
          <ConvHero />
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
        <p className="dl-next__k">Also in Chapter 14 — coming in the next lecture</p>
        <div className="dl-next__chips">
          {['Pooling layers', 'CNNs in TensorFlow', 'Memory requirements', 'CNN architectures', 'Pretrained models', 'Transfer learning'].map((c) => (
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
            <b>Reading: Chapter 14</b> — Deep Computer Vision Using Convolutional Neural Networks.
            Citations pop up wherever you see a little number, like this one<Fnote n={1} />.
          </p>
          <Unfold label="All footnotes & sources (1–4)">
            <ol className="dl-refs">
              {Object.entries(REFS).map(([n, r]) => (
                <li key={n} value={n}>{r}</li>
              ))}
            </ol>
            <p className="dl-body">
              Source deck: <em>CITS5017 — Topic 3: Deep Computer Vision Using Convolutional Neural
              Networks</em>, A/Prof Du Huynh, UWA, 2026 (slides 1–16, all covered here).
            </p>
          </Unfold>
        </div>
      </div>
    </div>
  );
}
