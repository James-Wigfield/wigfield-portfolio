import { useId, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq, MNote } from '../stage';
import { Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { gradientFlow, optPath, fmt } from '../nn';
import { lin, log10Scale, ptsPath, pow10Label } from './plotMath';
import './labsL1.css';

/* ============================================================================
   §2.1 · GRADIENTS THROUGH DEPTH (L2 slides 5–9) · §2.6 · THE OPTIMIZER RACE
   (L2 slides 33–47)
   ----------------------------------------------------------------------------
   GradFlowLab  a 10-layer MLP (width 40, this page's own) computed live: one
                bar per layer for the size of its weight gradient (log scale),
                for the activation (sigmoid · tanh · ReLU) and initialization
                (N(0, 1) · Glorot · He) you pick. ReLU + He is always drawn
                as a ghost for reference. Opens on the slides' culprit,
                sigmoid with N(0, 1).
   RaceLab      six update rules from slides 34–43 on one elongated bowl
                (this page's own), step by step: SGD zigzags across the steep
                direction, momentum rolls past the bottom, NAG overshoots
                less, the adaptive ones head more directly for the minimum.
   L2's running example: one deep stack of dense layers, and one loss surface.
   ========================================================================== */

/* ── §2.1 ─────────────────────────────────────────────────────────────── */
const ACTS = [['sigmoid', 'sigmoid'], ['tanh', 'tanh'], ['relu', 'ReLU']];
const INITS = [['normal', 'N(0, 1)'], ['glorot', 'Glorot'], ['he', 'He']];
const LAYERS = 10;
const flowOf = (act, init) => gradientFlow({ init, act, layers: LAYERS, width: 40, batch: 32, seed: 7 });

function verdict(g) {
  const gmax = Math.max(...g);
  const ratio = g[0] / g[LAYERS - 1];
  if (gmax > 100) return { k: 'exploding', text: `exploding: gradients near ${pow10Label(Math.round(Math.log10(gmax)))}` };
  if (ratio < 0.01) return { k: 'vanishing', text: `vanishing: layer 1 gets about ${pow10Label(Math.round(Math.log10(ratio)))} of layer ${LAYERS}’s gradient` };
  if (gmax < 0.01) return { k: 'tiny', text: 'tiny at every layer: little to learn from' };
  return { k: 'stable', text: 'stable: every layer gets a usable gradient' };
}

export function GradFlowLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const [act, setAct] = useState('sigmoid');
  const [init, setInit] = useState('normal');
  const [hover, setHover] = useState(null);
  const [stableSeen, setStableSeen] = useState(() => new Set());
  const res = useMemo(() => flowOf(act, init), [act, init]);
  const pick = (a, i) => {
    setAct(a);
    setInit(i);
    if (verdict(flowOf(a, i).gradW).k === 'stable') setStableSeen((prev) => new Set(prev).add(`${a}+${i}`));
  };
  const ref = useMemo(() => flowOf('relu', 'he'), []);
  const v = verdict(res.gradW);
  const W = narrow ? 330 : 600;
  const H = 280;
  const sx = lin(0.5, LAYERS + 0.5, 54, W - 14);
  const sy = log10Scale(1e-8, 1e5, H - 34, 34);
  const bw = Math.min(30, (sx(2) - sx(1)) * 0.56);
  const recommended = (act === 'relu' && init === 'he') || ((act === 'tanh' || act === 'sigmoid') && init === 'glorot');
  return (
    <Stage
      title="How big is each layer’s gradient?"
      slides="L2 · slides 5–8"
      tryThis="Predict what sigmoid with N(0, 1) does to the lower layers, then switch to ReLU with He and compare the bars with the ghost."
      caption={`${v.text[0].toUpperCase()}${v.text.slice(1)}. Slide 8 pairs Glorot with tanh/sigmoid and He with the ReLU family${act === 'sigmoid' && init !== 'normal' ? '; even so, the sigmoid’s small derivative (at most 0.25) shrinks the gradient at every layer, which is why nonsaturating activations (§2.2) and batch norm (§2.3) came next' : ''}.`}
      challenge={{ text: `Find two stable combinations${stableSeen.size ? ` (${stableSeen.size} found)` : ''}.`, done: stableSeen.size >= 2 }}
      maths={
        <>
          <MLine text={`Initialization variance (slides 7–8): N(0, 1) uses $\\sigma^2 = 1$; Glorot $\\sigma^2 = 1/\\text{fan}_{\\text{avg}}$ = 1/40; He $\\sigma^2 = 2/\\text{fan}_{\\text{in}}$ = 2/40 (every layer here has 40 inputs and 40 outputs).`} />
          <MLine text={`Each bar: the mean of $|\\partial \\mathcal{L}/\\partial w|$ over a layer’s $40 \\times 40$ weights, for a batch of 32 standardized inputs and an output gradient drawn from N(0, 1). Now: layer 1 ${res.gradW[0].toExponential(1)}, layer ${LAYERS} ${res.gradW[LAYERS - 1].toExponential(1)}.`} />
          <MLine text={`Forward signal (std of each layer’s outputs), layer 1 → ${LAYERS}: ${res.outStd.map((s) => (s >= 100 ? s.toExponential(0) : fmt(s))).join(', ')}. Slide 6: with N(0, 1) the output variance grows layer by layer, and the sigmoid saturates.`} />
          <MNote text="The network, its random weights (seed 7), the batch and the “tiny” threshold (0.01) are this page’s own; the bars are recomputed in your browser when you switch." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-switches">
          <div className="dl12r-switch" role="group" aria-label="Activation function">
            {ACTS.map(([k, l]) => (
              <button key={k} type="button" className={`dl12r-switch__opt${act === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={act === k} onClick={() => pick(k, init)}>{l}</button>
            ))}
          </div>
          <div className="dl12r-switch" role="group" aria-label="Initialization">
            {INITS.map(([k, l]) => (
              <button key={k} type="button" className={`dl12r-switch__opt${init === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={init === k} onClick={() => pick(act, k)}>{l}</button>
            ))}
          </div>
        </div>
        <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} role="group" aria-label={`Gradient size per layer, ${act} with ${init} initialization: ${v.text}`}>
          <rect className="dl12r-good" x={sx(0.5)} y={sy(1)} width={sx(LAYERS + 0.5) - sx(0.5)} height={sy(0.01) - sy(1)} />
          <text x={sx(LAYERS + 0.5) - 4} y={sy(1) + 12} textAnchor="end" className="dl12r-t dl12r-t--xs">usable range (this toy net)</text>
          {[-8, -6, -4, -2, 0, 2, 4].map((e) => (
            <g key={e}>
              <line className="dl12r-gridline" x1={sx(0.5)} x2={sx(LAYERS + 0.5)} y1={sy(10 ** e)} y2={sy(10 ** e)} />
              <text x={sx(0.5) - 6} y={sy(10 ** e) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{pow10Label(e)}</text>
            </g>
          ))}
          <text x={8} y={18} className="dl12r-t dl12r-t--s">mean |∂L/∂w| per layer</text>
          {res.gradW.map((g, l) => {
            const x = sx(l + 1);
            const y = sy(Math.min(1e5, Math.max(1e-8, g)));
            return (
              <g key={l} onPointerEnter={() => setHover(l)} onPointerLeave={() => setHover(null)}>
                <rect className={`dl12r-gf__bar dl12r-gf__bar--${v.k}`} x={x - bw / 2} y={y} width={bw} height={sy(1e-8) - y} rx={3} />
                <line className="dl12r-gf__ghost" x1={x - bw / 2 - 3} x2={x + bw / 2 + 3} y1={sy(ref.gradW[l])} y2={sy(ref.gradW[l])} />
                <text x={x} y={H - 18} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{l + 1}</text>
              </g>
            );
          })}
          <text x={sx(1)} y={H - 4} textAnchor="middle" className="dl12r-t dl12r-t--xs">input side</text>
          <text x={sx(LAYERS)} y={H - 4} textAnchor="middle" className="dl12r-t dl12r-t--xs">output side</text>
          {hover !== null && <Tip x={sx(hover + 1)} y={sy(Math.min(1e5, Math.max(1e-8, res.gradW[hover]))) - 4} text={`layer ${hover + 1}: ${res.gradW[hover].toExponential(1)}`} />}
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">{v.text}</span>
          <span><i className="dl12r-legend__swatch" style={{ color: 'var(--ink)' }} /> ReLU + He (reference)</span>
          {recommended && <span>slide 8’s pairing for {act === 'relu' ? 'ReLU' : act}</span>}
        </p>
      </div>
    </Stage>
  );
}

/* ── §2.6 ─────────────────────────────────────────────────────────────── */
// J(θ) = ½(0.1 θ₁² + 2 θ₂²): flat along θ₁, steep along θ₂ (this page's own)
const CA = 0.1;
const CB = 2;
const gradJ = ([a, b]) => [CA * a, CB * b];
const lossJ = ([a, b]) => 0.5 * (CA * a * a + CB * b * b);
const START = [-9, 2.4];
const STEPS = [0, 5, 15, 40, 120];
const RACERS = [
  { k: 'sgd', name: 'SGD', sw: '--dlv-blue', hp: { eta: 0.85 }, rule: '\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\nabla_\\theta J(\\boldsymbol{\\theta})', hpText: '$\\eta = 0.85$' },
  { k: 'momentum', name: 'momentum', sw: '--dlv-orange', hp: { eta: 0.05, beta: 0.9 }, rule: '\\mathbf{m} \\leftarrow \\beta\\mathbf{m} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}); \\quad \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} + \\mathbf{m}', hpText: '$\\eta = 0.05$, $\\beta = 0.9$' },
  { k: 'nag', name: 'NAG', sw: '--dlv-magenta', hp: { eta: 0.05, beta: 0.9 }, rule: '\\mathbf{m} \\leftarrow \\beta\\mathbf{m} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta} + \\beta\\mathbf{m}); \\quad \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} + \\mathbf{m}', hpText: '$\\eta = 0.05$, $\\beta = 0.9$' },
  { k: 'adagrad', name: 'AdaGrad', sw: '--dlv-green', hp: { eta: 1.2 }, rule: '\\mathbf{s} \\leftarrow \\mathbf{s} + \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}); \\quad \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}', hpText: '$\\eta = 1.2$, $\\epsilon = 10^{-10}$' },
  { k: 'rmsprop', name: 'RMSProp', sw: '--dlv-violet', hp: { eta: 0.12, rho: 0.9 }, rule: '\\mathbf{s} \\leftarrow \\rho\\mathbf{s} + (1 - \\rho)\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}); \\quad \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}', hpText: '$\\eta = 0.12$, $\\rho = 0.9$' },
  { k: 'adam', name: 'Adam', sw: '--dlv-red', hp: { eta: 0.3, beta1: 0.9, beta2: 0.999 }, rule: '\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\,\\widehat{\\mathbf{m}} \\oslash \\sqrt{\\widehat{\\mathbf{s}} + \\epsilon} \\quad (\\text{slide 43, steps 1–5})', hpText: '$\\eta = 0.3$, $\\beta_1 = 0.9$, $\\beta_2 = 0.999$' },
];
const PATHS = Object.fromEntries(RACERS.map((r) => [r.k, optPath(r.k, START, gradJ, STEPS[STEPS.length - 1], r.hp)]));
const BEATS = [
  { label: 'start', say: 'Six optimizers start at the same point on a bowl that is steep along $\\theta_2$ and flat along $\\theta_1$.' },
  { label: '5 steps', say: 'Plain SGD jumps across the steep direction; momentum and NAG are still building speed.' },
  { label: '15 steps', say: 'Momentum rolls past the valley floor and swings back; NAG, measuring the gradient ahead, swings less.' },
  { label: '40 steps', say: 'The adaptive ones scale each direction by its gradient history, so they head more directly for the minimum.' },
  { label: '120 steps', say: 'All arrive here. On a simple quadratic bowl AdaGrad does well (slide 40); on deep networks it stops too early.' },
];

export function RaceLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const clip = useId().replace(/:/g, '');
  const story = useStory(BEATS.length, { ms: 1400 });
  const step = STEPS[Math.max(0, story.beat)];
  const [on, setOn] = useState(() => new Set(RACERS.map((r) => r.k)));
  const [focus, setFocus] = useState('nag');
  const W = narrow ? 330 : 620;
  const H = narrow ? 230 : 300;
  const sx = lin(-10, 1.5, 12, W - 12);
  const sy = lin(-2.7, 2.8, H - 12, 12);
  const levels = [0.05, 0.25, 0.75, 1.6, 3, 5, 7.5];
  const toggle = (k) => {
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setFocus(k);
  };
  const F = RACERS.find((r) => r.k === focus);
  const fp = PATHS[focus][step];
  return (
    <Stage
      title="Six optimizers, one bowl"
      slides="L2 · slides 34–47"
      tryThis="Press ▶ and watch the first 15 steps: who zigzags, who overshoots, who heads straight for the centre? Click a name to show or hide it."
      story={<StoryBar story={story} beats={BEATS} numbered={false} />}
      caption="Momentum uses the gradient as an acceleration, so it can roll past the bottom; NAG looks ahead and ends closer; AdaGrad, RMSProp and Adam shrink the step along the steep direction (slides 34–43)."
      maths={
        <>
          <MEq tex={F.rule} />
          <MLine text={`${F.name} here: ${F.hpText}. After ${step} steps $\\boldsymbol{\\theta} = (${fmt(fp[0])}, ${fmt(fp[1])})$ and $J(\\boldsymbol{\\theta}) = ${fmt(lossJ(fp), 4)}$.`} />
          <MLine text={'The bowl: $J(\\boldsymbol{\\theta}) = \\tfrac{1}{2}(0.1\\,\\theta_1^2 + 2\\,\\theta_2^2)$, so $\\nabla_{\\boldsymbol{\\theta}} J = (0.1\\,\\theta_1,\\ 2\\,\\theta_2)$, starting from $(-9, 2.4)$.'} />
          <MNote text="The bowl, the start and every learning rate are this page’s own, chosen so each rule’s character shows; β = 0.9, ρ = 0.9, β₁ = 0.9, β₂ = 0.999 and ε = 10⁻¹⁰ are the slides’ values (slides 34, 38, 41, 44)." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-picker" role="group" aria-label="Optimizers to show">
          {RACERS.map((r) => (
            <button key={r.k} type="button" className="dl12r-pickbtn" aria-pressed={on.has(r.k)} style={{ '--sw': `var(${r.sw})` }} onClick={() => toggle(r.k)}>
              <i aria-hidden="true" /> {r.name}
            </button>
          ))}
        </div>
        <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} role="group" aria-label={`Optimizer paths after ${step} steps`}>
          <clipPath id={clip}><rect x={sx(-10)} y={sy(2.8)} width={sx(1.5) - sx(-10)} height={sy(-2.7) - sy(2.8)} /></clipPath>
          <rect x={sx(-10)} y={sy(2.8)} width={sx(1.5) - sx(-10)} height={sy(-2.7) - sy(2.8)} className="dl12r-plotbox" />
          <g clipPath={`url(#${clip})`}>
          {levels.map((c) => {
            const rx = Math.sqrt((2 * c) / CA);
            const ry = Math.sqrt((2 * c) / CB);
            return <ellipse key={c} className="dl12r-race__contour" cx={sx(0)} cy={sy(0)} rx={sx(rx) - sx(0)} ry={sy(0) - sy(ry)} />;
          })}
          </g>
          <circle cx={sx(0)} cy={sy(0)} r={3.5} className="dl12r-race__min" />
          <text x={sx(0) + 6} y={sy(0) - 6} className="dl12r-t dl12r-t--xs">minimum</text>
          <circle cx={sx(START[0])} cy={sy(START[1])} r={4} className="dl12r-race__start" />
          <text x={sx(START[0]) + 7} y={sy(START[1]) + 4} className="dl12r-t dl12r-t--xs">start</text>
          {RACERS.filter((r) => on.has(r.k)).map((r) => {
            const pts = PATHS[r.k].slice(0, step + 1);
            const end = pts[pts.length - 1];
            return (
              <g key={r.k} className={`dl12r-race__run${r.k === focus ? ' dl12r-race__run--on' : ''}`} style={{ color: `var(${r.sw})` }} onPointerEnter={() => setFocus(r.k)}>
                <path className="dl12r-race__path" d={ptsPath(pts, sx, sy)} />
                <circle cx={sx(end[0])} cy={sy(end[1])} r={r.k === focus ? 5.5 : 4} className="dl12r-race__head" />
              </g>
            );
          })}
          <text x={8} y={H - 18} className="dl12r-t dl12r-t--xs">θ₁ (flat) →</text>
          <text x={W - 8} y={22} textAnchor="end" className="dl12r-t dl12r-t--xs">↑ θ₂ (steep)</text>
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">after {step} steps</span>
          {RACERS.filter((r) => on.has(r.k)).map((r) => (
            <span key={r.k} style={{ color: `var(${r.sw})` }}><span className="dl12r-legend__txt">{r.name} <b>{fmt(lossJ(PATHS[r.k][step]), 3)}</b></span></span>
          ))}
          <span>= loss J</span>
        </p>
      </div>
    </Stage>
  );
}
