import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, StoryBar, MLine, MEq, MNote } from '../stage';
import { Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { svgPoint, useReducedMotion } from '../hooks';
import { useStudy } from '../context';
import { ACT, relu, batchNorm, clipValue, clipNorm, angleDeg, norm2, fmt, SELU_ALPHA, SELU_S } from '../nn';
import { lin, log10Scale, ticks, fnPath, ptsPath } from './plotMath';
import {
  spansWhere, stackLevels, LR_T, LR_HP, VAL_LOSS, PERF_ETAS, lrAt, lrPoints, plateaus,
  penaltyRun, penaltyOf, zeroSteps, dropoutRun,
} from './labsL2bMath';
import './labsL1.css';
import './labsL2.css';

/* ============================================================================
   PART 2 · LECTURE 2 LABS  (L2 slides 10–64)
   ----------------------------------------------------------------------------
   ShootoutLab    §2.2  ReLU's variants on one plot, f or f′; ReLU's dead zone
                        hatched; hover reads (z, f, f′); SELU's slope jump
   BatchNormLab   §2.3  slide 24's four lines as a story on one feature of a
                        12-value mini-batch; drag γ and β on the last beat
   ClipLab        §2.4  drag a 2-D gradient; clipvalue=1.0 vs clipnorm=1.0
   SchedulesLab   §2.7  the five schedules on one t = 0…50 axis (log or
                        linear); performance shows its toy validation loss
   PenaltiesLab   §2.8  ▶ gradient steps on an ℓ1 or ℓ2 penalty alone
   DropoutLab     §2.8  Figure 11-10's 2-4-3 net, a fresh mask per step,
                        training vs testing
   Pure helpers: ./labsL2bMath.js; maths: ../nn.js; styles: ./labsL2.css.
   ========================================================================== */

// an id safe for url(#…) references
const useSvgId = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');
const fitW = (w, max = 760, min = 300) => Math.round(Math.min(max, Math.max(min, w)));
const num = (v) => String(v).replace('-', '−');
const fmtEta = (v) => String(Number(v.toPrecision(3)));
// keep a Tip (../svgParts.jsx sizes it from its text) inside [lo, hi]
const tipX = (x, text, lo, hi) => {
  const h = Math.max(30, text.length * 6.9 + 12) / 2 + 2;
  return Math.max(lo + h, Math.min(hi - h, x));
};

// the "dropped / dead" grey hatch (role --dl12r-off)
function Hatch({ id }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)">
      <line x1={0} y1={0} x2={0} y2={9} className="dl12r-xhatch" />
    </pattern>
  );
}

function Switch({ label, value, options, onChange }) {
  return (
    <div className="dl12r-switch" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={String(k)} type="button" className={`dl12r-switch__opt${value === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// a vector arrow in data space, coloured by class
function Vec({ x1, y1, x2, y2, className, head = 9 }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return null;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.min(head, len * 0.6);
  const p = (d) => `${x2 - h * Math.cos(a + d)},${y2 - h * Math.sin(a + d)}`;
  return (
    <g className={className}>
      <line x1={x1} y1={y1} x2={x2 - h * 0.7 * Math.cos(a)} y2={y2 - h * 0.7 * Math.sin(a)} />
      <polygon points={`${p(0.4)} ${x2},${y2} ${p(-0.4)}`} />
    </g>
  );
}

/* ══ §2.2 · THE ACTIVATION SHOOT-OUT (slides 10–22) ════════════════════════ */
const SO_Z = [-4, 3];
const SO_FNS = [
  { k: 'leaky', sw: '--dlv-blue', short: 'leaky ReLU' },
  { k: 'elu', sw: '--dlv-orange', short: 'ELU' },
  { k: 'selu', sw: '--dlv-aqua', short: 'SELU' },
  { k: 'gelu', sw: '--dlv-yellow', short: 'GELU' },
  { k: 'swish', sw: '--dlv-magenta', short: 'Swish' },
  { k: 'mish', sw: '--dlv-green', short: 'Mish' },
];
const SELU_LEFT = SELU_S * SELU_ALPHA; // SELU′ just left of 0 ≈ 1.758
// the slides' definitions (Unicode Greek where the print twin needs it)
const SO_TEX = {
  leaky: '\\text{LeakyReLU}_{\\alpha}(z) = \\max(\\alpha z, z), \\qquad \\alpha = 0.2',
  elu: '\\text{ELU}_{\\alpha}(z) = \\begin{cases} \\alpha\\left(\\exp(z) - 1\\right) & \\text{if } z < 0 \\\\ z & \\text{if } z \\ge 0 \\end{cases} \\qquad \\alpha = 1',
  selu: '\\text{SELU}(z) = s\\,\\text{ELU}_{1.6733}(z), \\qquad s = 1.0507',
  gelu: '\\text{GELU}(z) = z\\,Φ(z) \\approx z\\,\\sigma(1.702z)',
  swish: '\\text{Swish}_{\\beta}(z) = z\\,\\sigma(\\beta z), \\qquad \\text{SiLU}(z) = z\\,\\sigma(z) \\;\\; (\\beta = 1)',
  mish: '\\text{Mish}(z) = z\\tanh\\left(\\text{softplus}(z)\\right), \\qquad \\text{softplus}(z) = \\log\\left(1 + \\exp(z)\\right)',
};
const SO_SAY = {
  leaky: 'Slide 11 (Figure 11-2). Its slope is $f\'(z) = \\alpha = 0.2$ for $z < 0$ and 1 for $z > 0$: never 0, so no dead neurons, but it isn’t smooth at 0 (slide 14).',
  elu: 'Slide 15. Its slope is $\\alpha\\exp(z)$ for $z < 0$ and 1 for $z \\ge 0$: nonzero for $z < 0$, and with $\\alpha = 1$ both sides give 1 at 0, so it is smooth there.',
  selu: 'Slide 16. Its slope is $s\\alpha\\exp(z)$ for $z < 0$ and $s$ for $z > 0$: just left of 0 that is $1.0507 × 1.6733 ≈ 1.758$, just right $1.0507$, so the slope jumps at 0 (the Read beat’s Slide check).',
  gelu: 'Slide 18. Its slope is $Φ(z) + z\\,\\phi(z)$ ($\\phi$ the standard normal density): slightly negative below about $z = −0.75$, GELU’s minimum, since it is neither convex nor monotonic.',
  swish: 'Slide 19 (Swish was rediscovered SiLU). With $\\beta = 1$ its slope is $\\sigma(z) + z\\,\\sigma(z)\\left(1 - \\sigma(z)\\right)$, negative below about $z = −1.28$, where Swish dips.',
  mish: 'Slide 20. Its slope is $\\tanh(\\text{softplus}(z)) + z\\,\\text{sech}^2(\\text{softplus}(z))\\,\\sigma(z)$, negative below about $z = −1.19$: smooth, non-convex and non-monotonic.',
};
const snapZ = (z) => Math.round(Math.max(SO_Z[0], Math.min(SO_Z[1], z)) * 20) / 20;

export function ShootoutLab() {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 470;
  const W = fitW(width);
  const H = narrow ? 270 : 330;
  const uid = useSvgId();
  const [sel, setSel] = useState('elu');
  const [view, setView] = useState('f');
  const [hz, setHz] = useState(-2);
  const deriv = view === 'd';
  const yDom = deriv ? [-0.4, 2.1] : [-2, 3.3];
  const yTicks = deriv ? (narrow ? [0, 1, 2] : [0, 0.5, 1, 1.5, 2]) : [-2, -1, 0, 1, 2, 3];
  const xTicks = narrow ? [-4, -2, 0, 2] : [-4, -3, -2, -1, 0, 1, 2, 3];
  const L = 34;
  const R = W - 10;
  const T = 12;
  const B = H - 28;
  const sx = lin(SO_Z[0], SO_Z[1], L, R);
  const sy = lin(yDom[0], yDom[1], B, T);
  const fOf = (k) => ACT[k][deriv ? 'd' : 'f'];
  // f′ of ReLU, leaky ReLU and SELU jumps at 0: draw the two sides apart
  const pathOf = (k) => {
    const g = fOf(k);
    if (deriv && (k === 'relu' || k === 'leaky' || k === 'selu')) {
      return fnPath(g, lin(SO_Z[0], -1e-4, sx(SO_Z[0]), sx(-1e-4)), sy, 140) + fnPath(g, lin(1e-4, SO_Z[1], sx(1e-4), sx(SO_Z[1])), sy, 100);
    }
    return fnPath(g, sx, sy, 260);
  };
  const cur = ACT[sel];
  const meta = SO_FNS.find((a) => a.k === sel);
  const fz = cur.f(hz);
  const dz = cur.d(hz);
  const shown = deriv ? dz : fz;
  const reluD = hz < 0 ? '0' : hz > 0 ? '1' : 'undefined';
  const tiny = deriv ? spansWhere((z) => Math.abs(cur.d(z)) < 0.05, SO_Z[0], SO_Z[1]) : [];
  const clipId = `${uid}c`;
  const hatchId = `${uid}h`;
  const clip = `url(#${clipId})`;
  const zL = deriv ? 2.2 : 1.6;
  const yLab = fOf(sel)(zL);
  const tipY = Math.max(T + 30, sy(Math.max(yDom[0], Math.min(yDom[1], shown))) - 8);
  const tipText = `${meta.short}: ${deriv ? 'f′' : 'f'}(${fmt(hz, 1)}) = ${fmt(shown, 2)}`;

  const fromEvent = (e) => {
    const p = svgPoint(e, e.currentTarget.ownerSVGElement);
    if (p) setHz(snapZ(sx.inv(p.x)));
  };
  const onKey = (e) => {
    const d = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -1, PageUp: 1 }[e.key];
    if (d !== undefined) { e.preventDefault(); setHz((z) => snapZ(z + d)); }
    else if (e.key === 'Home') { e.preventDefault(); setHz(SO_Z[0]); }
    else if (e.key === 'End') { e.preventDefault(); setHz(SO_Z[1]); }
  };

  return (
    <Stage
      title="ReLU’s variants: a slope left of zero"
      slides="L2 · slides 10–22"
      tryThis="Predict which curves still slope at $z = -2$, hover there to compare with ReLU, then switch to $f'(z)$ and look for a jump at 0."
      caption={deriv
        ? 'ReLU’s slope is 0 for every $z < 0$, while leaky ReLU keeps 0.2 and ELU keeps $\\exp(z)$, which still fades towards 0 for very negative $z$. SELU’s slope jumps from 1.758 to 1.051 at 0, so unlike ELU with $\\alpha = 1$ it is not smooth there (slides 14–16).'
        : 'Every variant keeps a slope for $z < 0$, where ReLU’s gradient is exactly 0 and its neurons can die (slide 10). GELU, Swish and Mish dip to a minimum and climb back towards 0 as $z$ falls: neither convex nor monotonic (slides 18, 20).'}
      challenge={{ text: 'Find the variant slide 14 calls smooth whose slope still jumps at $z = 0$.', done: deriv && sel === 'selu' }}
      own="curves computed live · f′ is this page’s own working"
      maths={
        <>
          <MEq tex={SO_TEX[sel]} />
          <MLine text={SO_SAY[sel]} />
          <MLine text={`At $z = ${fmt(hz, 2)}$: $f(z) = ${fmt(fz, 3)}$ and $f'(z) = ${fmt(dz, 3)}$. ReLU, $\\max(0, z)$ (slide 10): $f = ${fmt(relu(hz), 3)}$, $f' = ${reluD === 'undefined' ? '\\text{undefined}' : reluD}$.`} />
          <MNote text="The slides define and plot $f$ only; every $f'$ here is this page’s own working from those definitions. Hatched: where ReLU’s gradient is exactly 0. Shaded in the $f'$ view: where the chosen function’s $|f'(z)| < 0.05$ (this page’s threshold)." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-floorrow">
          <div className="dl12r-picker" role="group" aria-label="Activation function">
            {SO_FNS.map((a) => (
              <button key={a.k} type="button" className="dl12r-pickbtn" aria-pressed={sel === a.k} style={{ '--sw': `var(${a.sw})` }} onClick={() => setSel(a.k)}>
                <i aria-hidden="true" /> {ACT[a.k].name}
              </button>
            ))}
          </div>
          <Switch label="Plot" value={view} options={[['f', 'f(z)'], ['d', 'f′(z), the slope']]} onChange={setView} />
        </div>
        <svg className="dl12r-svg dl12r-so" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${cur.name}: ${deriv ? 'slope' : 'value'} against z, with ReLU for reference`}>
          <defs>
            <clipPath id={clipId}><rect x={L} y={T} width={R - L} height={B - T} /></clipPath>
            <Hatch id={hatchId} />
          </defs>
          {/* ReLU's dead zone: gradient exactly 0 */}
          <rect x={sx(SO_Z[0])} y={T} width={sx(0) - sx(SO_Z[0])} height={B - T} fill={`url(#${hatchId})`} className="dl12r-l2zone" />
          <text x={sx(SO_Z[0]) + 6} y={T + 14} className="dl12r-t dl12r-t--xs dl12r-halo">ReLU’s dead zone: f′ = 0</text>
          {tiny.map(([a, b]) => (
            <rect key={a} className="dl12r-so__tiny" x={sx(a)} y={T} width={Math.max(1.5, sx(b) - sx(a))} height={B - T} />
          ))}
          {yTicks.map((t) => (
            <g key={t}>
              <line className="dl12r-gridline" x1={L} x2={R} y1={sy(t)} y2={sy(t)} />
              <text x={L - 6} y={sy(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{num(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={B + 15} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{num(t)}</text>
          ))}
          <text x={R} y={B + 26} textAnchor="end" className="dl12r-t dl12r-t--xs">z</text>
          <line className="dl12r-axisline" x1={sx(0)} x2={sx(0)} y1={T} y2={B} />
          <line className="dl12r-axisline" x1={L} x2={R} y1={sy(0)} y2={sy(0)} />
          <rect className="dl12r-plotbox dl12r-so__frame" x={L} y={T} width={R - L} height={B - T} />
          <path className="dl12r-so__ref" clipPath={clip} d={pathOf('relu')} />
          {SO_FNS.filter((a) => a.k !== sel).map((a) => (
            <path key={a.k} className="dl12r-curve dl12r-curve--dim" clipPath={clip} d={pathOf(a.k)} style={{ stroke: `var(${a.sw})` }} />
          ))}
          <path className="dl12r-curve" clipPath={clip} d={pathOf(sel)} style={{ stroke: `var(${meta.sw})`, strokeWidth: 3 }} />
          {/* SELU's slope: two different values either side of 0 */}
          {deriv && (
            <g className={sel === 'selu' ? '' : 'dl12r-dim'} style={{ stroke: 'var(--dlv-aqua)' }}>
              <circle className="dl12r-so__open" cx={sx(0)} cy={sy(SELU_LEFT)} r={4} />
              <circle cx={sx(0)} cy={sy(SELU_S)} r={4} style={{ fill: 'var(--dlv-aqua)' }} />
            </g>
          )}
          {deriv && sel === 'selu' && (
            <text x={sx(0) + 10} y={sy(SELU_LEFT) + 4} className="dl12r-t dl12r-t--xs dl12r-halo">slope jumps 1.758 → 1.051 at z = 0</text>
          )}
          {/* the slope itself, drawn as a tangent at the read-out point */}
          {!deriv && (
            <line className="dl12r-so__tan" clipPath={clip} x1={sx(hz - 0.8)} y1={sy(fz - 0.8 * dz)} x2={sx(hz + 0.8)} y2={sy(fz + 0.8 * dz)} />
          )}
          <line className="dl12r-hair" x1={sx(hz)} x2={sx(hz)} y1={T} y2={B} />
          <circle className="dl12r-so__open" cx={sx(hz)} cy={sy(fOf('relu')(hz))} r={3.5} style={{ stroke: 'var(--ink-3)' }} />
          {shown >= yDom[0] && shown <= yDom[1] && (
            <circle className="dl12r-pt" cx={sx(hz)} cy={sy(shown)} r={5} style={{ fill: `var(${meta.sw})` }} />
          )}
          <text x={sx(zL)} y={sy(yLab) - 11} textAnchor="middle" className="dl12r-t dl12r-t--s dl12r-t--b dl12r-halo">{meta.short}</text>
          <g
            className="dl12r-so__slider"
            role="slider"
            tabIndex={0}
            aria-label="Where to read the curves (z); arrow keys move it"
            aria-valuemin={SO_Z[0]}
            aria-valuemax={SO_Z[1]}
            aria-valuenow={hz}
            aria-valuetext={`z = ${fmt(hz, 2)}: ${meta.short} f = ${fmt(fz, 3)}, slope ${fmt(dz, 3)}; ReLU slope ${reluD}`}
            onKeyDown={onKey}
          >
            <rect className="dl12r-so__hit" x={L} y={T} width={R - L} height={B - T} fill="transparent" onPointerMove={fromEvent} onPointerDown={fromEvent} />
            <rect className="dl12r-so__ring" x={L - 3} y={T - 3} width={R - L + 6} height={B - T + 6} rx={4} />
          </g>
          <Tip x={tipX(sx(hz), tipText, 0, W)} y={tipY} text={tipText} />
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">slope at z = {fmt(hz, 1)}: {meta.short} {fmt(dz, 3)} · ReLU {reluD}</span>
          <span><i className="dl12r-legend__swatch dl12r-legend__swatch--dash" style={{ color: 'var(--ink-3)' }} aria-hidden="true" /> ReLU, for reference</span>
          <span><i className="dl12r-l2sw dl12r-l2sw--hatch" aria-hidden="true" /> ReLU’s gradient is 0</span>
          {deriv && <span><i className="dl12r-l2sw dl12r-l2sw--tint" aria-hidden="true" /> |f′| below 0.05</span>}
        </p>
      </div>
    </Stage>
  );
}

/* ══ §2.3 · BATCH NORMALIZATION (slide 24) ═════════════════════════════════ */
// one feature of a mini-batch, m_B = 12 (this page's own): μ_B = 6.00, σ_B² = 6.26
const BN_X = [1.3, 2.9, 3.6, 4.6, 5.2, 5.9, 6.2, 7.0, 7.8, 8.5, 9.4, 9.6];
const BN_EPS = 0.001; // this page's choice: slide 24 doesn't define ε
const BN_DOM = [-5, 10];
const BN_LO = -4.8;
const BN_HI = 9.8;
const BN_XHAT = batchNorm(BN_X, 1, 0, BN_EPS).xhat;
const BN_XMIN = Math.min(...BN_XHAT);
const BN_XMAX = Math.max(...BN_XHAT);
const snapTo = (v, s) => Math.round(v / s) * s;
const clampBeta = (b, g) => Math.max(BN_LO - g * BN_XMIN, Math.min(BN_HI - g * BN_XMAX, b));
const clampGamma = (g, b) => Math.max(0.5, Math.min(2.6, (BN_HI - b) / BN_XMAX, (b - BN_LO) / -BN_XMIN, g));
const BN_TEX = '\\begin{aligned} \\boldsymbol{μ}_B &= \\frac{1}{m_B}\\sum_{i=1}^{m_B}\\mathbf{x}^{(i)} \\\\ \\boldsymbol{σ}_B^2 &= \\frac{1}{m_B}\\sum_{i=1}^{m_B}\\left(\\mathbf{x}^{(i)} - \\boldsymbol{μ}_B\\right)^2 \\\\ \\hat{\\mathbf{x}}^{(i)} &= \\frac{\\mathbf{x}^{(i)} - \\boldsymbol{μ}_B}{\\sqrt{\\boldsymbol{σ}_B^2 + ϵ}} \\\\ \\mathbf{z}^{(i)} &= \\boldsymbol{γ} ⊗ \\hat{\\mathbf{x}}^{(i)} + \\boldsymbol{β} \\end{aligned}';

export function BatchNormLab() {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 470;
  const W = fitW(width);
  const H = narrow ? 200 : 186;
  const [gamma, setGamma] = useState(1.5);
  const [beta, setBeta] = useState(3);
  const [trace, setTrace] = useState(2);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const bn = useMemo(() => batchNorm(BN_X, gamma, beta, BN_EPS), [gamma, beta]);
  const sd = Math.sqrt(bn.var + BN_EPS);
  const beats = [
    { label: 'mini-batch', say: `Twelve values of one input feature, $m_B = 12$ (this page’s own): mean $\\boldsymbol{μ}_B = ${fmt(bn.mu)}$, variance $\\boldsymbol{σ}_B^2 = ${fmt(bn.var)}$.` },
    { label: 'subtract μ_B', say: 'Subtract $\\boldsymbol{μ}_B$ from every $\\mathbf{x}^{(i)}$: the batch slides over to be centred on 0, with the same spread.' },
    { label: 'divide by √(σ_B² + ϵ)', say: `Divide by $\\sqrt{\\boldsymbol{σ}_B^2 + ϵ} = ${fmt(sd, 3)}$: the $\\hat{\\mathbf{x}}^{(i)}$ have mean 0 and variance $σ_B^2/(σ_B^2 + ϵ) = ${fmt(bn.var / (bn.var + BN_EPS), 4)}$, almost exactly 1.` },
    { label: 'scale γ, shift β', say: '$\\mathbf{z}^{(i)} = \\boldsymbol{γ} ⊗ \\hat{\\mathbf{x}}^{(i)} + \\boldsymbol{β}$, with $\\boldsymbol{γ}$ and $\\boldsymbol{β}$ trainable: β sets the new centre and γ the new spread (drag their handles).' },
  ];
  const story = useStory(4, { ms: 1800 });
  const beat = story.beat;
  const stage = Math.max(0, beat);
  const sx = lin(BN_DOM[0], BN_DOM[1], 18, W - 18);
  const base = H - 32;
  const bY = 50;
  const r = narrow ? 5.5 : 6.5;
  const vals = [BN_X, BN_X.map((v) => v - bn.mu), bn.xhat, bn.z][stage];
  const px = vals.map(sx);
  const lv = stackLevels(px, 2 * r + 1.5);
  const mk = [
    { c: bn.mu, h: sd, top: `μ_B = ${fmt(bn.mu)}`, bot: `±${fmt(sd)}` },
    { c: 0, h: sd, top: '0', bot: `±${fmt(sd)}, the same spread` },
    { c: 0, h: 1, top: '0', bot: '±1' },
    { c: beta, h: gamma, top: `β = ${fmt(beta)}`, bot: `±γ = ±${fmt(gamma)}` },
  ][stage];
  const ops = [
    'x⁽ⁱ⁾: one feature, m_B = 12',
    'x⁽ⁱ⁾ − μ_B',
    'x̂⁽ⁱ⁾ = (x⁽ⁱ⁾ − μ_B) / √(σ_B² + ϵ)',
    'z⁽ⁱ⁾ = γ ⊗ x̂⁽ⁱ⁾ + β',
  ][stage];
  const L1 = sx(mk.c - mk.h);
  const R1 = sx(mk.c + mk.h);
  const valName = ['x', 'x − μ_B', 'x̂', 'z'][stage];
  const tx = BN_X[trace];
  const txh = bn.xhat[trace];

  const fromEvent = (e) => {
    const p = svgPoint(e, e.currentTarget.ownerSVGElement ?? e.currentTarget);
    if (!p) return;
    const v = sx.inv(p.x);
    if (drag === 'beta') setBeta(snapTo(clampBeta(v, gamma), 0.05));
    if (drag === 'gamma') setGamma(snapTo(clampGamma(v - beta, beta), 0.05));
  };
  const keyFor = (which) => (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    if (which === 'beta') setBeta((b) => snapTo(clampBeta(b + d * 0.1, gamma), 0.05));
    else setGamma((g) => snapTo(clampGamma(g + d * 0.05, beta), 0.05));
  };
  const grab = (which) => (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(which);
  };

  return (
    <Stage
      title="Batch norm, one feature at a time"
      slides="L2 · slides 23–24"
      tryThis="Predict where the dots land after each line of slide 24, press ▶ to check, then drag β and γ on the last step."
      story={<StoryBar story={story} beats={beats} />}
      caption="Whatever the batch’s own mean and spread, $\hat{\mathbf{x}}$ always has mean 0 and variance about 1; the output $\mathbf{z}$ then has mean $\boldsymbol{β}$ and spread $\boldsymbol{γ}$, two trainable parameters learned with the connection weights (slides 23–24)."
      challenge={{ text: 'Use γ and β to give $\\mathbf{z}$ the raw batch’s mean and spread again.', done: Math.abs(beta - bn.mu) < 0.026 && Math.abs(gamma - 2.5) < 0.026 }}
      maths={
        <>
          <MEq tex={BN_TEX} />
          <MLine text={`This batch: $\\boldsymbol{μ}_B = \\frac{1}{12}(1.3 + 2.9 + \\dots + 9.6) = \\frac{${fmt(bn.mu * 12, 1)}}{12} = ${fmt(bn.mu)}$ and $\\boldsymbol{σ}_B^2 = \\frac{1}{12}\\sum_i \\left(x^{(i)} - ${fmt(bn.mu)}\\right)^2 = \\frac{${fmt(bn.var * 12)}}{12} = ${fmt(bn.var)}$.`} />
          <MLine text={`The ringed value (hover a dot to pick another): $x = ${fmt(tx)}$, $\\hat{x} = (${fmt(tx)} - ${fmt(bn.mu)})/\\sqrt{${fmt(bn.var)} + 0.001} = ${fmt(tx - bn.mu)}/${fmt(sd, 3)} = ${fmt(txh, 3)}$, then $z = ${fmt(gamma)} × (${fmt(txh, 3)}) + ${fmt(beta)} = ${fmt(gamma * txh + beta)}$.`} />
          <MLine text={`So $\\mathbf{z}$ has mean $\\boldsymbol{β} = ${fmt(beta)}$ and standard deviation $\\boldsymbol{γ}\\sqrt{σ_B^2/(σ_B^2 + ϵ)} = ${fmt(gamma)} × ${fmt(Math.sqrt(bn.var / (bn.var + BN_EPS)), 5)} ≈ ${fmt(gamma)}$ (this page’s working).`} />
          <MNote text="$ϵ = 0.001$ is this page’s choice: slide 24 never defines $ϵ$ (a small smoothing term). With one feature, every vector here ($\boldsymbol{μ}_B$, $\boldsymbol{σ}_B^2$, $\boldsymbol{γ}$, $\boldsymbol{β}$) is a single number and $⊗$ is plain multiplication." />
        </>
      }
    >
      <div ref={wrap}>
        <svg
          className={`dl12r-svg dl12r-bn${drag ? ' dl12r-bn--drag' : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          onPointerMove={fromEvent}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          role="group"
          aria-label={`Batch norm, step ${stage + 1} of 4: ${ops}; values from ${fmt(Math.min(...vals))} to ${fmt(Math.max(...vals))}`}
        >
          <text x={18} y={18} className="dl12r-t dl12r-t--s dl12r-t--m">{beat < 0 ? '' : ops}</text>
          {/* the number line */}
          <line className="dl12r-bn__axis" x1={sx(BN_DOM[0])} x2={sx(BN_DOM[1])} y1={base} y2={base} />
          {Array.from({ length: BN_DOM[1] - BN_DOM[0] + 1 }, (_, i) => BN_DOM[0] + i).map((t) => (
            <g key={t}>
              <line className="dl12r-bn__tick" x1={sx(t)} x2={sx(t)} y1={base} y2={base + (t % 5 === 0 ? 6 : 3.5)} />
              {(!narrow || t % 5 === 0) && <text x={sx(t)} y={base + 18} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{num(t)}</text>}
            </g>
          ))}
          <g className={`dl12r-fade${beat < 0 ? ' dl12r-hide' : ''}`}>
            {/* centre line, spread bracket and their labels slide with the dots */}
            <g className="dl12r-bn__mv" style={{ transform: `translateX(${sx(mk.c)}px)` }}>
              <line className="dl12r-bn__centre" x1={0} x2={0} y1={bY + 23} y2={base} />
              <text x={0} y={bY - 12} textAnchor="middle" className="dl12r-t dl12r-t--s dl12r-t--m dl12r-halo">{mk.top}</text>
              <text x={0} y={bY + 17} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{mk.bot}</text>
            </g>
            <g className="dl12r-bn__mv" style={{ transform: `translate(${L1}px, ${bY}px)` }}>
              <line className="dl12r-bn__brk" x1={0} x2={1} y1={0} y2={0} vectorEffect="non-scaling-stroke" style={{ transform: `scaleX(${Math.max(1, R1 - L1)})` }} />
              <line className="dl12r-bn__brk" x1={0} x2={0} y1={-6} y2={6} />
            </g>
            <g className="dl12r-bn__mv" style={{ transform: `translate(${R1}px, ${bY}px)` }}>
              <line className="dl12r-bn__brk" x1={0} x2={0} y1={-6} y2={6} />
            </g>
          </g>
          {BN_X.map((x, i) => (
            <g
              key={i}
              className={`dl12r-bn__dot${beat < 0 ? ' dl12r-hide' : ''}`}
              style={{ transform: `translate(${px[i]}px, ${base - r - 4 - lv[i] * (2 * r + 1.5)}px)` }}
              onPointerEnter={() => { setHover(i); setTrace(i); }}
              onPointerLeave={() => setHover(null)}
            >
              <circle r={r + 4} fill="transparent" />
              <circle className="dl12r-bn__dotc" r={r} />
              {i === trace && <circle className="dl12r-bn__ring" r={r + 4} />}
            </g>
          ))}
          {/* γ and β: draggable on the last step */}
          {stage === 3 && beat >= 0 && (
            <g>
              <g
                className="dl12r-bn__mv dl12r-bn__h"
                style={{ transform: `translate(${sx(beta)}px, ${bY}px)` }}
                role="slider"
                tabIndex={0}
                aria-label="β, the shift; arrow keys move it"
                aria-valuemin={Number(clampBeta(-99, gamma).toFixed(2))}
                aria-valuemax={Number(clampBeta(99, gamma).toFixed(2))}
                aria-valuenow={Number(beta.toFixed(2))}
                aria-valuetext={`β = ${fmt(beta)}`}
                onPointerDown={grab('beta')}
                onKeyDown={keyFor('beta')}
              >
                <circle r={15} fill="transparent" />
                <circle className="dl12r-bn__hdot" r={7.5} />
              </g>
              <g
                className="dl12r-bn__mv dl12r-bn__h"
                style={{ transform: `translate(${sx(beta + gamma)}px, ${bY}px)` }}
                role="slider"
                tabIndex={0}
                aria-label="γ, the scale; arrow keys change it"
                aria-valuemin={0.5}
                aria-valuemax={2.6}
                aria-valuenow={Number(gamma.toFixed(2))}
                aria-valuetext={`γ = ${fmt(gamma)}`}
                onPointerDown={grab('gamma')}
                onKeyDown={keyFor('gamma')}
              >
                <circle r={15} fill="transparent" />
                <rect className="dl12r-bn__hdot" x={-6} y={-6} width={12} height={12} rx={2} transform="rotate(45)" />
                <text x={12} y={4} className="dl12r-t dl12r-t--s dl12r-t--b dl12r-halo">γ</text>
              </g>
            </g>
          )}
          {hover !== null && beat >= 0 && (
            <Tip x={tipX(px[hover], `${valName} = ${fmt(vals[hover])}`, 0, W)} y={base - r - 10 - lv[hover] * (2 * r + 1.5)} text={`${valName} = ${fmt(vals[hover])}`} />
          )}
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">
            {stage < 2 ? `mean ${fmt(stage === 0 ? bn.mu : 0)}, spread ${fmt(sd)}` : stage === 2 ? 'mean 0, spread 1' : `mean β = ${fmt(beta)}, spread γ = ${fmt(gamma)}`}
          </span>
          <span><i className="dl12r-l2sw dl12r-l2sw--dot" aria-hidden="true" /> one value x⁽ⁱ⁾ of the feature</span>
          {stage === 3 && <span className="dl12r-noprint"><i className="dl12r-l2sw dl12r-l2sw--handle" aria-hidden="true" /> drag: β (circle), γ (diamond)</span>}
        </p>
      </div>
    </Stage>
  );
}

/* ══ §2.4 · GRADIENT CLIPPING (slide 29) ═══════════════════════════════════ */
const CL_D = [-3.25, 3.25];
const CL_G0 = [0.9, 3.0]; // this page's own (slide 29 gives no example vector)
const clampG = (v) => Math.max(-3.1, Math.min(3.1, v));
const turnDeg = (a, b) => {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

export function ClipLab() {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 780; // plot and table side by side only when both fit
  const S = narrow ? fitW(width, 420, 280) : 460;
  const [g, setG] = useState(CL_G0);
  const [drag, setDrag] = useState(false);
  const pad = 26;
  const sx = lin(CL_D[0], CL_D[1], pad, S - pad);
  const sy = lin(CL_D[0], CL_D[1], S - pad, pad);
  const n = norm2(g);
  const cv = clipValue(g, 1);
  const cn = clipNorm(g, 1);
  const turn = n > 1e-9 ? turnDeg(angleDeg(cv), angleDeg(g)) : 0;
  const same = Math.hypot(cv[0] - cn[0], cv[1] - cn[1]) < 0.015;
  const cut = [0, 1].filter((i) => Math.abs(g[i]) > 1);
  const cutNames = cut.map((i) => `$g_${i + 1}$`).join(' and ');
  const unit = sx(1) - sx(0);
  const O = [sx(0), sy(0)];

  const setFrom = (e) => {
    const p = svgPoint(e, e.currentTarget.ownerSVGElement ?? e.currentTarget);
    if (p) setG([clampG(snapTo(sx.inv(p.x), 0.05)), clampG(snapTo(sy.inv(p.y), 0.05))]);
  };
  const onKey = (e) => {
    const s = e.shiftKey ? 0.5 : 0.1;
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
    if (!d) return;
    e.preventDefault();
    setG((v) => [clampG(snapTo(v[0] + d[0], 0.05)), clampG(snapTo(v[1] + d[1], 0.05))]);
  };

  // the angle arc between the value-clipped vector and g
  const arc = (() => {
    if (Math.abs(turn) < 0.5 || n <= 1) return null;
    const rr = unit * 0.62;
    const a0 = (angleDeg(cv) * Math.PI) / 180;
    const a1 = (angleDeg(g) * Math.PI) / 180;
    const p0 = [O[0] + rr * Math.cos(a0), O[1] - rr * Math.sin(a0)];
    const p1 = [O[0] + rr * Math.cos(a1), O[1] - rr * Math.sin(a1)];
    const am = (angleDeg(cv) + turn / 2) * (Math.PI / 180);
    return { d: `M${p0[0]} ${p0[1]} A${rr} ${rr} 0 0 ${turn > 0 ? 0 : 1} ${p1[0]} ${p1[1]}`, lx: O[0] + (rr + 17) * Math.cos(am), ly: O[1] - (rr + 17) * Math.sin(am) + 4 };
  })();

  const caption = n <= 1
    ? 'This $\\mathbf{g}$ is no longer than 1, so neither clip changes it. Drag it outside the circle to see them differ.'
    : same
      ? 'Along an axis only one component is over 1, so cutting it to 1 is the same as rescaling: both clips give the same vector, in the same direction.'
      : cut.length === 0
        ? `Both components are already within ±1, so clipping by value changes nothing, although $\\|\\mathbf{g}\\| = ${fmt(n)}$; clipping by norm still scales it to length 1, keeping its direction.`
        : Math.abs(turn) < 0.5
          ? `On this diagonal both components are cut by the same factor, so clipping by value keeps the direction but leaves length ${fmt(norm2(cv))}; clipping by norm gives length 1 (slide 29).`
        : `Clipping by value cut ${cutNames} to ±1, which turned $\\mathbf{g}$ by ${fmt(Math.abs(turn), 1)}°; clipping by norm scaled the whole vector to length 1 and kept its direction. That is slide 29’s advice: \`clipnorm=1.0\` “if you want to retain the gradient vector orientation”.`;

  const rows = [
    { k: 'g', name: <><b>g</b> (this page’s)</>, v: g, cls: 'g' },
    { k: 'v', name: <code>clipvalue=1.0</code>, v: cv, cls: 'v' },
    { k: 'n', name: <code>clipnorm=1.0</code>, v: cn, cls: 'n' },
  ];

  return (
    <Stage
      title="Clip by value, or clip by norm?"
      slides="L2 · slide 29"
      tryThis="Predict which clip keeps the arrow’s direction, then drag the tip of $\mathbf{g}$ around and watch the two clipped arrows."
      caption={caption}
      challenge={{ text: 'Find a $\\mathbf{g}$ longer than 1 that both clips turn into the same vector.', done: n > 1.05 && same }}
      own="the vector g · this page’s own"
      maths={
        <>
          <MLine text="Slide 29: `SGD(clipvalue=1.0)` clips every component of the gradient vector to a value between −1.0 and 1.0; use `clipnorm=1.0` instead if you want to retain the gradient vector orientation." />
          <MEq tex={'\\text{clipvalue: } g_i \\to \\max\\left(-1, \\min(1, g_i)\\right) \\qquad \\text{clipnorm: } \\mathbf{g} \\to \\frac{\\mathbf{g}}{\\|\\mathbf{g}\\|} \\text{ if } \\|\\mathbf{g}\\| > 1'} />
          <MLine text={`With $\\mathbf{g} = (${fmt(g[0])}, ${fmt(g[1])})$: by value $(${fmt(cv[0])}, ${fmt(cv[1])})$, at ${fmt(angleDeg(cv), 1)}° instead of ${fmt(angleDeg(g), 1)}°. ${n > 1 ? `$\\|\\mathbf{g}\\| = \\sqrt{${fmt(g[0])}^2 + ${fmt(g[1])}^2} = ${fmt(n)} > 1$, so by norm $\\mathbf{g}/${fmt(n)} = (${fmt(cn[0])}, ${fmt(cn[1])})$, still at ${fmt(angleDeg(cn), 1)}°.` : `$\\|\\mathbf{g}\\| = ${fmt(n)} \\le 1$, so by norm it is unchanged.`}`} />
          <MNote text="The two rules are this page’s reading of slide 29’s words (the slide gives no formula and no example vector); the threshold 1.0 is the slide’s. Angles are measured from the $g_1$ axis." />
        </>
      }
    >
      <div ref={wrap} className={`dl12r-clip${narrow ? ' dl12r-clip--narrow' : ''}`}>
        <svg
          className={`dl12r-svg dl12r-clip__plot${drag ? ' dl12r-clip__plot--drag' : ''}`}
          viewBox={`0 0 ${S} ${S}`}
          style={{ maxWidth: S }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); setFrom(e); }}
          onPointerMove={(e) => { if (drag) setFrom(e); }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
          role="group"
          aria-label={`Gradient g = (${fmt(g[0])}, ${fmt(g[1])}); clipped by value (${fmt(cv[0])}, ${fmt(cv[1])}); clipped by norm (${fmt(cn[0])}, ${fmt(cn[1])})`}
        >
          {[-3, -2, -1, 1, 2, 3].map((t) => (
            <g key={t}>
              <line className="dl12r-gridline" x1={sx(t)} x2={sx(t)} y1={sy(CL_D[0])} y2={sy(CL_D[1])} />
              <line className="dl12r-gridline" x1={sx(CL_D[0])} x2={sx(CL_D[1])} y1={sy(t)} y2={sy(t)} />
              <text x={sx(t)} y={sy(0) + 13} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{num(t)}</text>
              <text x={sx(0) - 5} y={sy(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{num(t)}</text>
            </g>
          ))}
          <line className="dl12r-axisline" x1={sx(CL_D[0])} x2={sx(CL_D[1])} y1={sy(0)} y2={sy(0)} />
          <line className="dl12r-axisline" x1={sx(0)} x2={sx(0)} y1={sy(CL_D[0])} y2={sy(CL_D[1])} />
          <text x={sx(CL_D[1])} y={sy(0) - 6} textAnchor="end" className="dl12r-t dl12r-t--xs">g₁</text>
          <text x={sx(0) + 6} y={sy(CL_D[1]) + 10} className="dl12r-t dl12r-t--xs">g₂</text>
          {/* what each clip measures against */}
          <rect className="dl12r-clip__box" x={sx(-1)} y={sy(1)} width={2 * unit} height={2 * unit} />
          <circle className="dl12r-clip__circle" cx={O[0]} cy={O[1]} r={unit} />
          <text x={sx(1) + 5} y={sy(-1) + 13} className="dl12r-t dl12r-t--xs dl12r-halo">|gᵢ| ≤ 1</text>
          <text x={sx(-1) - 5} y={sy(0.62)} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-halo">‖g‖ = 1</text>
          {/* g's clipped component(s), dotted from g to its value-clipped twin */}
          {n > 1 && !same && <line className="dl12r-clip__guide" x1={sx(g[0])} y1={sy(g[1])} x2={sx(cv[0])} y2={sy(cv[1])} />}
          {arc && (
            <g>
              <path className="dl12r-clip__arc" d={arc.d} />
              <text x={arc.lx} y={arc.ly} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--b dl12r-halo">{fmt(Math.abs(turn), 1)}°</text>
            </g>
          )}
          <Vec className="dl12r-clip__vec dl12r-clip__vec--g" x1={O[0]} y1={O[1]} x2={sx(g[0])} y2={sy(g[1])} />
          <Vec className="dl12r-clip__vec dl12r-clip__vec--v" x1={O[0]} y1={O[1]} x2={sx(cv[0])} y2={sy(cv[1])} />
          <Vec className="dl12r-clip__vec dl12r-clip__vec--n" x1={O[0]} y1={O[1]} x2={sx(cn[0])} y2={sy(cn[1])} />
          <g
            className="dl12r-clip__h"
            role="slider"
            tabIndex={0}
            aria-label="Tip of the gradient g; arrow keys move it (Shift for bigger steps)"
            aria-valuemin={-3.3}
            aria-valuemax={3.3}
            aria-valuenow={Number(n.toFixed(2))}
            aria-valuetext={`g = (${fmt(g[0])}, ${fmt(g[1])}), length ${fmt(n)}`}
            onKeyDown={onKey}
          >
            <circle cx={sx(g[0])} cy={sy(g[1])} r={16} fill="transparent" />
            <circle className="dl12r-clip__hdot" cx={sx(g[0])} cy={sy(g[1])} r={6.5} />
          </g>
          <text
            x={sx(g[0]) + (g[0] >= 0 ? 12 : -12)}
            y={sy(g[1]) + (g[1] >= 0 ? -8 : 16)}
            textAnchor={g[0] >= 0 ? 'start' : 'end'}
            className="dl12r-t dl12r-t--b dl12r-halo"
          >
            g
          </text>
        </svg>
        <div className="dl12r-clip__side">
          <table className="dl12r-clip__tab">
            <thead>
              <tr><th scope="col"><span className="dl12r-sr">vector</span></th><th scope="col">components</th><th scope="col">length</th><th scope="col">angle</th></tr>
            </thead>
            <tbody>
              {rows.map((rw) => (
                <tr key={rw.k}>
                  <th scope="row"><i className={`dl12r-clip__sw dl12r-clip__sw--${rw.cls}`} aria-hidden="true" /> {rw.name}</th>
                  <td>({fmt(rw.v[0])}, {fmt(rw.v[1])})</td>
                  <td>{fmt(norm2(rw.v))}</td>
                  <td>{n > 1e-9 ? `${fmt(angleDeg(rw.v), 1)}°` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dl12r-legend">
            <span className="dl12r-legend__score">direction change: by value {fmt(Math.abs(turn), 1)}°, by norm 0.0°</span>
          </p>
        </div>
      </div>
    </Stage>
  );
}

/* ══ §2.7 · LEARNING-RATE SCHEDULES (slides 48–59) ═════════════════════════ */
const LR_KINDS = [
  { k: 'power', sw: '--dlv-blue', name: 'power', tL: 38 },
  { k: 'exponential', sw: '--dlv-orange', name: 'exponential', tL: 33 },
  { k: 'piecewise', sw: '--dlv-aqua', name: 'piecewise constant', tL: 40 },
  { k: 'performance', sw: '--dlv-yellow', name: 'performance', tL: 45 },
  { k: 'onecycle', sw: '--dlv-magenta', name: '1cycle', tL: 25 },
];
const LR_PTS = Object.fromEntries(LR_KINDS.map(({ k }) => [k, lrPoints(k)]));
const LR_MAX = Object.fromEntries(LR_KINDS.map(({ k }) => [k, Math.max(...LR_PTS[k].map((p) => p[1]))]));
const LR_PLATEAUS = plateaus(VAL_LOSS, LR_HP.performance);
const LR_CAPTION = {
  power: 'Power scheduling drops fast, then ever more slowly: to $η_0/2$ after $s = 10$ steps and $η_0/3$ after $2s$ (slide 50’s blue curve: $η_0 = 0.01$, $r = 1$, $c = 1$).',
  exponential: 'Exponential scheduling multiplies $η$ by $r = 0.5$ every $s = 10$ steps (slide 52’s blue curve, $η_0 = 0.1$): a straight line on the log axis.',
  piecewise: 'Constant rates with sudden drops, as in slide 55’s chart: 0.1, then 0.04 at $t = 5$, 0.02 at 20 and 0.01 at 30. It can work very well but “requires fiddling around” to find the steps.',
  performance: '$η$ is halved (`factor=0.5`) once the best validation loss hasn’t improved for 5 epochs (`patience=5`), like slide 58’s chart. The validation loss below is this page’s own toy run.',
  onecycle: '1cycle climbs linearly from $η_0$ to $η_1$ halfway, comes back down to $η_0$, then drops by orders of magnitude in the last few epochs (slide 59, which gives no numbers: these are this page’s own).',
};

function lrMaths(kind, t) {
  const at = `At $t = ${t}$: $η = ${fmtEta(lrAt(kind, t))}$.`;
  switch (kind) {
    case 'power':
      return (
        <>
          <MEq tex="η(t) = \frac{η_0}{(1 + rt/s)^c}" />
          <MLine text={`Slide 50’s blue curve: $η_0 = 0.01$, $r = 1$, $s = 10$, $c = 1$, so $η(10) = 0.01/2 = 0.005$ and $η(20) = 0.01/3 ≈ 0.0033$. ${at}`} />
          <MLine text="Keras (slide 51): `InverseTimeDecay(initial_learning_rate=0.01, decay_steps=10_000, decay_rate=1.0, staircase=False)`, the rule with $c = 1$; this curve is the same call with `decay_steps=10`." />
        </>
      );
    case 'exponential':
      return (
        <>
          <MEq tex="η(t) = η_0\, r^{t/s}" />
          <MLine text={`Slide 52’s blue curve: $η_0 = 0.1$, $r = 0.5$, $s = 10$, so $η(10) = 0.05$, $η(20) = 0.025$, … (its worked example: $r = 0.1$, $s = 15$ gives $η(15) = 0.1\\,η_0$). ${at}`} />
          <MLine text="Keras (slide 53): `ExponentialDecay(initial_learning_rate=0.01, decay_steps=20_000, decay_rate=0.1, staircase=False)`; this curve would be `initial_learning_rate=0.1, decay_steps=10, decay_rate=0.5`." />
        </>
      );
    case 'piecewise':
      return (
        <>
          <MEq tex="η(t) = \begin{cases} 0.1 & t < 5 \\ 0.04 & 5 \le t < 20 \\ 0.02 & 20 \le t < 30 \\ 0.01 & t \ge 30 \end{cases}" />
          <MLine text={`Read off slide 55’s chart (its text’s example, 0.1 for 5 iterations then 0.001 for 50, doesn’t match the chart: see the Read beat). ${at}`} />
          <MLine text="Keras, slide 56’s own example: `PiecewiseConstantDecay(boundaries=[50_000, 80_000], values=[0.01, 0.005, 0.001])`; this chart’s steps would be `boundaries=[5, 20, 30], values=[0.1, 0.04, 0.02, 0.01]`." />
        </>
      );
    case 'performance':
      return (
        <>
          <MEq tex="η \leftarrow λ\,η \quad \text{when the validation error stops dropping}" />
          <MLine text="Keras (slide 57): `tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5)` multiplies $η$ by 0.5 whenever the best validation loss does not improve for 5 consecutive epochs." />
          <MLine text={`This page’s toy run: $η = 0.01$ for epochs 0–16; the best loss (epoch ${LR_PLATEAUS[0].best}) was not beaten in epochs ${LR_PLATEAUS[0].from}–${LR_PLATEAUS[0].to}, so $η = 0.005$ from epoch ${LR_PLATEAUS[0].cut}, then ${fmtEta(PERF_ETAS[LR_PLATEAUS[1].cut])} from ${LR_PLATEAUS[1].cut} and ${fmtEta(PERF_ETAS[LR_PLATEAUS[2].cut])} from ${LR_PLATEAUS[2].cut}. ${at}`} />
        </>
      );
    default:
      return (
        <>
          <MLine text="Slide 59: start at $η_0$, grow linearly up to $η_1$ halfway through training, decrease linearly back to $η_0$ in the second half, and finish the last few epochs by dropping the rate by several orders of magnitude (still linearly)." />
          <MLine text={`This page’s numbers: $η_0 = 0.01$, $η_1 = 0.1$ at $t = 25$ (halfway), back to 0.01 at $t = 45$, then down to 0.0001 at $t = 50$ (the last 10% of training). ${at}`} />
          <MNote text="Slide 59 gives no formula, values or Keras call for 1cycle." />
        </>
      );
  }
}

export function SchedulesLab() {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 470;
  const W = fitW(width);
  const uid = useSvgId();
  const [sel, setSel] = useState('performance');
  const [scale, setScale] = useState('log');
  const [ht, setHt] = useState(null);
  const perf = sel === 'performance';
  const H1 = narrow ? 236 : 272;
  const H2 = perf ? (narrow ? 104 : 112) : 0;
  const H = H1 + H2;
  const L = narrow ? 46 : 52;
  const R = W - 12;
  const T = 22;
  const B = H1 - 26;
  const sx = lin(0, LR_T, L, R);
  const yMax = LR_MAX[sel] * 1.12;
  const log = scale === 'log';
  const sy = log ? log10Scale(8e-5, 0.16, B, T) : lin(0, yMax, B, T);
  const yTicks = log ? [1e-4, 1e-3, 1e-2, 1e-1] : ticks(0, yMax, 4);
  const xTicks = narrow ? [0, 25, 50] : [0, 10, 20, 30, 40, 50];
  const clipId = `${uid}c`;
  const clip = `url(#${clipId})`;
  const meta = LR_KINDS.find((a) => a.k === sel);
  const tShow = ht ?? 25;
  const eta = lrAt(sel, tShow);
  // the validation-loss strip (performance only)
  const vT = H1 + 22;
  const vB = H - 18;
  const sv = lin(0.325, 0.49, vB, vT);
  const yL = lrAt(sel, meta.tL);

  const fromEvent = (e) => {
    const p = svgPoint(e, e.currentTarget.ownerSVGElement);
    if (p) setHt(Math.max(0, Math.min(LR_T, Math.round(sx.inv(p.x)))));
  };
  const onKey = (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (d !== undefined) { e.preventDefault(); setHt((t) => Math.max(0, Math.min(LR_T, (t ?? 25) + d))); }
    else if (e.key === 'Home') { e.preventDefault(); setHt(0); }
    else if (e.key === 'End') { e.preventDefault(); setHt(LR_T); }
  };

  return (
    <Stage
      title="Five ways to lower the learning rate"
      slides="L2 · slides 48–59"
      tryThis="Predict which schedule starts low and rises; pick each one, hover to read $η(t)$, and flip to a linear axis to compare with the slides’ charts."
      caption={LR_CAPTION[sel]}
      own="toy validation loss and 1cycle numbers · this page’s own"
      maths={
        <>
          {lrMaths(sel, tShow)}
          <MNote text="$t$ is the step for power and exponential (slides 50, 52) and the iteration for piecewise (slide 55); performance scheduling and 1cycle count epochs. All five share one 0–50 axis here." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-floorrow">
          <div className="dl12r-picker" role="group" aria-label="Schedule">
            {LR_KINDS.map((a) => (
              <button key={a.k} type="button" className="dl12r-pickbtn" aria-pressed={sel === a.k} style={{ '--sw': `var(${a.sw})` }} onClick={() => setSel(a.k)}>
                <i aria-hidden="true" /> {a.name}
              </button>
            ))}
          </div>
          <Switch label="η axis" value={scale} options={[['log', 'log axis'], ['lin', 'linear axis']]} onChange={setScale} />
        </div>
        <svg className="dl12r-svg dl12r-lrs" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${meta.name} schedule: learning rate against t on a ${log ? 'log' : 'linear'} axis`}>
          <defs>
            <clipPath id={clipId}><rect x={L} y={T - 2} width={R - L} height={B - T + 4} /></clipPath>
          </defs>
          <text x={L} y={12} className="dl12r-t dl12r-t--xs">η{log ? ', log scale' : ''}</text>
          {yTicks.map((v) => (
            <g key={v}>
              <line className="dl12r-gridline" x1={L} x2={R} y1={sy(v)} y2={sy(v)} />
              <text x={L - 6} y={sy(v) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{fmtEta(v)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={B + 15} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
          ))}
          <text x={R} y={B + 25} textAnchor="end" className="dl12r-t dl12r-t--xs">t</text>
          <rect className="dl12r-plotbox" x={L} y={T} width={R - L} height={B - T} />
          {perf && LR_PLATEAUS.map((p) => (
            <line key={p.cut} className="dl12r-lrs__cut" x1={sx(p.cut)} x2={sx(p.cut)} y1={T} y2={vB} />
          ))}
          {LR_KINDS.filter((a) => a.k !== sel).map((a) => (
            <path key={a.k} className="dl12r-curve dl12r-curve--dim" clipPath={clip} d={ptsPath(LR_PTS[a.k], sx, sy)} style={{ stroke: `var(${a.sw})` }} />
          ))}
          <path className="dl12r-curve" clipPath={clip} d={ptsPath(LR_PTS[sel], sx, sy)} style={{ stroke: `var(${meta.sw})`, strokeWidth: 3 }} />
          <text x={sx(meta.tL)} y={sy(yL) - 10} textAnchor="middle" className="dl12r-t dl12r-t--s dl12r-t--b dl12r-halo">{meta.name}</text>
          {perf && (
            <g>
              <text x={L} y={vT - 8} className="dl12r-t dl12r-t--xs">validation loss (toy · this page’s own)</text>
              {[0.35, 0.45].map((v) => (
                <g key={v}>
                  <line className="dl12r-gridline" x1={L} x2={R} y1={sv(v)} y2={sv(v)} />
                  <text x={L - 6} y={sv(v) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{v}</text>
                </g>
              ))}
              <rect className="dl12r-plotbox" x={L} y={vT} width={R - L} height={vB - vT} />
              <path className="dl12r-lrs__val" d={ptsPath(VAL_LOSS.map((v, t) => [t, v]), sx, sv)} />
              {LR_PLATEAUS.map((p, i) => {
                const top = Math.min(...VAL_LOSS.slice(p.best, p.to + 1).map(sv)) - 7;
                return (
                  <g key={p.cut}>
                    <circle className="dl12r-lrs__best" cx={sx(p.best)} cy={sv(VAL_LOSS[p.best])} r={3.2} />
                    <path className="dl12r-lrs__brk" d={`M${sx(p.from - 0.4)} ${top + 4}V${top}H${sx(p.to + 0.4)}V${top + 4}`} />
                    {i === 0 && !narrow && <text x={sx(p.to + 0.4) + 5} y={top + 3} className="dl12r-t dl12r-t--xs dl12r-halo">5 epochs, no new best: halve η</text>}
                  </g>
                );
              })}
            </g>
          )}
          {ht !== null && (
            <g pointerEvents="none">
              <line className="dl12r-hair" x1={sx(ht)} x2={sx(ht)} y1={T} y2={perf ? vB : B} />
              <circle className="dl12r-pt" cx={sx(ht)} cy={sy(eta)} r={5} style={{ fill: `var(${meta.sw})` }} />
              {perf && <circle className="dl12r-pt dl12r-lrs__vpt" cx={sx(ht)} cy={sv(VAL_LOSS[ht])} r={3.5} />}
            </g>
          )}
          <g
            className="dl12r-so__slider"
            role="slider"
            tabIndex={0}
            aria-label="Where to read the learning rate (t); arrow keys move it"
            aria-valuemin={0}
            aria-valuemax={LR_T}
            aria-valuenow={tShow}
            aria-valuetext={`t = ${tShow}: η = ${fmtEta(eta)}`}
            onKeyDown={onKey}
          >
            <rect className="dl12r-so__hit" x={L} y={T} width={R - L} height={(perf ? vB : B) - T} fill="transparent" onPointerMove={fromEvent} onPointerDown={fromEvent} onPointerLeave={() => setHt(null)} />
            <rect className="dl12r-so__ring" x={L - 3} y={T - 3} width={R - L + 6} height={B - T + 6} rx={4} />
          </g>
          {ht !== null && <Tip x={tipX(sx(ht), `t = ${ht}: η = ${fmtEta(eta)}`, 0, W)} y={Math.max(T + 26, sy(eta) - 8)} text={`t = ${ht}: η = ${fmtEta(eta)}`} />}
        </svg>
      </div>
    </Stage>
  );
}

/* ══ §2.8 · ℓ1 vs ℓ2 ON THE WEIGHTS (slides 60–61) ═════════════════════════ */
const PEN_W0 = [1.2, -0.8, 0.15, -0.05, 0.65, -1.5, 0.3, -0.2]; // this page's own
const PEN_LAM = 0.01; // slide 60's factor, l2(0.01)
const PEN_ETA = 1; // this page's own
const PEN_STEPS = 60;
const PEN_RUN = { l1: penaltyRun(PEN_W0, 'l1', PEN_LAM, PEN_ETA, PEN_STEPS), l2: penaltyRun(PEN_W0, 'l2', PEN_LAM, PEN_ETA, PEN_STEPS) };
const PEN_P = { l1: PEN_RUN.l1.map((w) => penaltyOf(w, 'l1', PEN_LAM)), l2: PEN_RUN.l2.map((w) => penaltyOf(w, 'l2', PEN_LAM)) };
const PEN_ZERO = zeroSteps(PEN_RUN.l1);
const PEN_SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];

export function PenaltiesLab() {
  const { printing } = useStudy();
  const reduced = useReducedMotion();
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 600;
  const [kind, setKind] = useState('l1');
  const [k, setK] = useState(PEN_STEPS);
  const [running, setRunning] = useState(false);
  const [hover, setHover] = useState(null);
  const [scrub, setScrub] = useState(false);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const step = printing ? PEN_STEPS : k;
  const w = PEN_RUN[kind][step];
  const zeros = w.filter((v) => v === 0).length;
  const P = PEN_P[kind];

  const stop = () => { cancelAnimationFrame(raf.current); setRunning(false); };
  const play = () => {
    cancelAnimationFrame(raf.current);
    if (reduced) { setK(PEN_STEPS); setRunning(false); return; }
    const t0 = performance.now();
    setK(0);
    setRunning(true);
    const tick = (now) => {
      const kk = Math.min(PEN_STEPS, Math.floor((now - t0) / 55));
      setK(kk);
      if (kk < PEN_STEPS) raf.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(tick);
  };

  // the weights as bars
  const BW = narrow ? fitW(width, 460, 280) : fitW(width - 272, 560, 300);
  const BH = 236;
  const bl = 30;
  const br = BW - 6;
  const by = lin(-1.65, 1.65, BH - 26, 12);
  const col = (br - bl) / PEN_W0.length;
  const bw = Math.min(26, col * 0.5);
  const cx = (i) => bl + col * (i + 0.5);
  // the penalty term against step (also the scrubber)
  const PW = narrow ? fitW(width, 460, 280) : 250;
  const PH = narrow ? 150 : 236;
  const pl = 44;
  const pr = PW - 10;
  const px = lin(0, PEN_STEPS, pl, pr);
  const pyv = lin(0, 0.052, PH - 26, 26);
  const scrubTo = (e) => {
    const p = svgPoint(e, e.currentTarget.ownerSVGElement ?? e.currentTarget);
    if (p) { stop(); setK(Math.max(0, Math.min(PEN_STEPS, Math.round(px.inv(p.x))))); }
  };
  const onKey = (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (d !== undefined) { e.preventDefault(); stop(); setK((v) => Math.max(0, Math.min(PEN_STEPS, v + d))); }
    else if (e.key === 'Home') { e.preventDefault(); stop(); setK(0); }
    else if (e.key === 'End') { e.preventDefault(); stop(); setK(PEN_STEPS); }
  };
  const termName = kind === 'l1' ? 'λ Σ |wᵢ|' : 'λ Σ wᵢ²';
  const termTex = kind === 'l1' ? 'λ\\sum_i |w_i|' : 'λ\\sum_i w_i^2';
  const hw = hover === null ? null : { i: hover, w0: PEN_W0[hover], w: w[hover] };

  return (
    <Stage
      title="ℓ1 vs ℓ2: what the penalty does to the weights"
      slides="L2 · slides 60–61"
      tryThis="Predict which penalty can make a weight exactly 0, press ▶ to run 60 steps on the penalty alone, and switch between ℓ1 and ℓ2."
      caption="ℓ1 pulls every weight towards 0 by the same amount each step, so small weights land on exactly 0; ℓ2 pulls in proportion to the weight, so they shrink but never reach it. That is the behaviour from simple linear models (slide 60: “just like you did for simple linear models”); these slides don’t restate it."
      own="toy weights and run · this page’s own"
      maths={
        <>
          <MLine text="Slide 60 gives only the Keras calls: `kernel_regularizer=tf.keras.regularizers.l2(0.01)`, `l1(...)` for ℓ1 and `l1_l2(...)` for both. At each training step the regularization loss is added to the final loss; slide 61 repeats the settings with `functools.partial()`." />
          <MNote text="From simple linear models (not restated on these slides): the penalty terms, their gradients, and one step on the penalty alone." />
          <MEq tex={'\\ell_1:\\; λ\\sum_i |w_i|,\\quad w_i \\leftarrow w_i - ηλ\\,\\text{sign}(w_i) \\qquad \\ell_2:\\; λ\\sum_i w_i^2,\\quad w_i \\leftarrow w_i - 2ηλ\\,w_i'} />
          <MLine text={`Here $λ = 0.01$ (slide 60’s factor) and $η = 1$ (this page’s), so ℓ1 subtracts 0.01 from every $|w_i|$ each step (a weight that would cross 0 stops at 0, this page’s handling) and ℓ2 multiplies every weight by $1 - 2(1)(0.01) = 0.98$. After ${step} steps the ${kind === 'l1' ? 'ℓ1' : 'ℓ2'} term is $${termTex} = ${fmt(P[step], 4)}$ (it started at ${fmt(P[0], 4)}).`} />
          <MLine text={`For example $w_3 = 0.15$: ℓ1 reaches exactly 0 at step ${PEN_ZERO[2]}; ℓ2 leaves $0.15 × 0.98^{60} = ${fmt(PEN_RUN.l2[PEN_STEPS][2], 3)}$, small but not 0.`} />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-floorrow">
          <Switch label="Penalty" value={kind} options={[['l1', 'ℓ1 penalty'], ['l2', 'ℓ2 penalty']]} onChange={setKind} />
          <div className="dl12r-runbar">
            <button type="button" className="dl12r-story__play dl12r-noprint" onClick={running ? stop : play} aria-label={running ? 'Pause the run' : 'Run 60 steps on the penalty from the start'}>
              <Icon name={running ? 'pause' : 'play'} size={14} />
            </button>
            <span className="dl12r-runbar__k">step {step} of {PEN_STEPS}</span>
          </div>
        </div>
        <div className={`dl12r-pen${narrow ? ' dl12r-pen--narrow' : ''}`}>
          <svg className="dl12r-svg" viewBox={`0 0 ${BW} ${BH}`} style={{ maxWidth: BW }} role="img" aria-label={`Eight weights after ${step} steps of ${kind === 'l1' ? 'ℓ1' : 'ℓ2'}: ${w.map((v) => fmt(v)).join(', ')}; ${zeros} exactly 0`}>
            {[-1, 0, 1].map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'dl12r-pen__zero' : 'dl12r-gridline'} x1={bl} x2={br} y1={by(t)} y2={by(t)} />
                <text x={bl - 6} y={by(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{num(t)}</text>
              </g>
            ))}
            {PEN_W0.map((w0, i) => {
              const v = w[i];
              const y0 = by(Math.max(0, w0));
              const y1 = by(Math.max(0, v));
              return (
                <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  <rect x={cx(i) - col / 2} y={12} width={col} height={BH - 38} fill="transparent" />
                  <rect className="dl12r-pen__ghost" x={cx(i) - bw / 2} y={y0} width={bw} height={Math.abs(by(w0) - by(0))} />
                  {v !== 0 ? (
                    <rect className="dl12r-pen__bar" x={cx(i) - bw / 2} y={y1} width={bw} height={Math.max(1, Math.abs(by(v) - by(0)))} />
                  ) : (
                    <g>
                      <circle className="dl12r-pen__nil" cx={cx(i)} cy={by(0)} r={4.5} />
                      <text x={cx(i)} y={by(0) + (w0 > 0 ? 16 : -9)} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--b dl12r-t--w dl12r-halo">0</text>
                    </g>
                  )}
                  <text x={cx(i)} y={BH - 8} textAnchor="middle" className="dl12r-t dl12r-t--xs">w{PEN_SUB[i]}</text>
                </g>
              );
            })}
            {hw && <Tip x={tipX(cx(hw.i), `w${PEN_SUB[hw.i]}: ${fmt(hw.w0)} → ${fmt(hw.w, 3)}`, 0, BW)} y={Math.min(by(Math.max(0, hw.w0)), by(Math.max(0, hw.w))) - 4} text={`w${PEN_SUB[hw.i]}: ${fmt(hw.w0)} → ${fmt(hw.w, 3)}`} />}
          </svg>
          <svg
            className="dl12r-svg dl12r-pen__plot"
            viewBox={`0 0 ${PW} ${PH}`}
            style={{ maxWidth: PW }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setScrub(true); scrubTo(e); }}
            onPointerMove={(e) => { if (scrub) scrubTo(e); }}
            onPointerUp={() => setScrub(false)}
            onPointerCancel={() => setScrub(false)}
            role="group"
            aria-label={`The penalty term ${termName} against step`}
          >
            <text x={pl} y={14} className="dl12r-t dl12r-t--s dl12r-t--b">penalty {termName}</text>
            {[0, 0.025, 0.05].map((t) => (
              <g key={t}>
                <line className="dl12r-gridline" x1={pl} x2={pr} y1={pyv(t)} y2={pyv(t)} />
                <text x={pl - 6} y={pyv(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
              </g>
            ))}
            {[0, 30, 60].map((t) => (
              <text key={t} x={px(t)} y={PH - 10} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
            ))}
            <text x={px(15)} y={PH - 10} textAnchor="middle" className="dl12r-t dl12r-t--xs">step</text>
            <path className="dl12r-pen__pghost" d={ptsPath(P.map((v, i) => [i, v]), px, pyv)} />
            <path className="dl12r-pen__pline" d={ptsPath(P.slice(0, step + 1).map((v, i) => [i, v]), px, pyv)} />
            <g
              className="dl12r-pen__scrub"
              role="slider"
              tabIndex={0}
              aria-label="Training step; arrow keys move through the run"
              aria-valuemin={0}
              aria-valuemax={PEN_STEPS}
              aria-valuenow={step}
              aria-valuetext={`step ${step}: penalty ${fmt(P[step], 4)}, ${zeros} weights exactly 0`}
              onKeyDown={onKey}
            >
              <line className="dl12r-pen__head" x1={px(step)} x2={px(step)} y1={pyv(0.052)} y2={pyv(0)} />
              <circle className="dl12r-pen__hdot" cx={px(step)} cy={pyv(P[step])} r={6} />
            </g>
            <text x={step > 40 ? px(step) - 11 : px(step) + 11} y={pyv(P[step]) + (step > 40 ? 17 : -10)} textAnchor={step > 40 ? 'end' : 'start'} className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{fmt(P[step], 4)}</text>
          </svg>
        </div>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">{zeros} of 8 weights exactly 0</span>
          <span><i className="dl12r-l2sw dl12r-l2sw--ghost" aria-hidden="true" /> starting weight</span>
          <span><i className="dl12r-l2sw dl12r-l2sw--bar" aria-hidden="true" /> after {step} steps</span>
          <span>λ = 0.01, η = 1</span>
        </p>
      </div>
    </Stage>
  );
}

/* ══ §2.8 · DROPOUT (slides 62–64, Figure 11-10) ══════════════════════════ */
const DO_RATES = [0.2, 0.5];
const DO_SEED = { 0.2: 44, 0.5: 97 }; // seeded masks: the same "random" steps every visit
const DO_STEPS = 6;
const DO_IN = ['x₁', 'x₂'];
const DO_HID = ['h₁', 'h₂', 'h₃', 'h₄'];
const DO_OUT = ['o₁', 'o₂', 'o₃'];
const DO_NAMES = [...DO_IN, ...DO_HID];
const DO_W = 360;
const DO_H = 300;
const DO_POS = {
  in: [130, 230].map((x) => [x, 252]),
  hid: [54, 138, 222, 306].map((x) => [x, 158]),
  out: [100, 180, 260].map((x) => [x, 64]),
};
const listNames = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function DropoutLab() {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const narrow = width < 600;
  const uid = useSvgId();
  const [mode, setMode] = useState('train');
  const [p, setP] = useState(0.2);
  const [hover, setHover] = useState(null);
  const masks = useMemo(() => dropoutRun(p, DO_SEED[p], DO_STEPS, DO_NAMES.length), [p]);
  const beats = masks.map((m, i) => {
    const dropped = DO_NAMES.filter((_, j) => !m[j]);
    return {
      label: `step ${i + 1}`,
      say: dropped.length
        ? `Training step ${i + 1}: ${listNames(dropped)} ${dropped.length === 1 ? 'is' : 'are'} dropped, ignored for this step only; ${dropped.length === 1 ? 'it' : 'they'} may be back at the next.`
        : `Training step ${i + 1}: by chance nothing is dropped this time (each neuron is kept with probability $1 - p = ${fmt(1 - p, 1)}$).`,
    };
  });
  const story = useStory(DO_STEPS, { ms: 1150 });
  const train = mode === 'train';
  const beat = story.beat;
  const mask = train && beat >= 0 ? masks[beat] : DO_NAMES.map(() => true);
  const upto = train ? beat : -1;
  const kept = DO_NAMES.map((_, j) => masks.slice(0, Math.max(0, upto + 1)).filter((m) => m[j]).length);
  const keptAll = DO_NAMES.map((_, j) => masks.filter((m) => m[j]).length);
  const hatchId = `${uid}h`;
  const nodes = [
    ...DO_POS.in.map((pos, j) => ({ id: j, name: DO_IN[j], pos, on: mask[j] })),
    ...DO_POS.hid.map((pos, j) => ({ id: 2 + j, name: DO_HID[j], pos, on: mask[2 + j] })),
    ...DO_POS.out.map((pos, j) => ({ id: 6 + j, name: DO_OUT[j], pos, on: true, out: true })),
  ];
  const edges = [];
  DO_POS.in.forEach((a, i) => DO_POS.hid.forEach((b, j) => edges.push({ key: `i${i}h${j}`, a, b, on: mask[i] && mask[2 + j] })));
  DO_POS.hid.forEach((a, i) => DO_POS.out.forEach((b, j) => edges.push({ key: `h${i}o${j}`, a, b, on: mask[2 + i] })));
  const rN = 17;
  const cur = beat >= 0 ? masks[beat] : null;
  const curDropped = cur ? DO_NAMES.filter((_, j) => !cur[j]) : [];
  const curKept = cur ? DO_NAMES.filter((_, j) => cur[j]) : DO_NAMES;
  const hn = hover === null ? null : nodes[hover];
  const tipFor = (nd) => {
    if (nd.out) return `${nd.name}: an output, never dropped`;
    if (!train) return `${nd.name}: always active at test time`;
    return `${nd.name}: kept in ${kept[nd.id]} of ${Math.max(0, upto + 1)} steps`;
  };
  // the training history: one row per neuron, one column per step
  const cell = 17;
  const gx = 34;
  const gy = 30;
  const rowY = (r) => gy + r * (cell + 2) + (r >= 2 ? 6 : 0) + (r >= 6 ? 6 : 0);
  const GW = gx + DO_STEPS * (cell + 2) + 50;
  const GH = rowY(8) + cell + 8;

  return (
    <Stage
      title="Dropout: a different thinned network every step"
      slides="L2 · slides 62–64"
      tryThis="Predict how many of the six neurons a step drops at $p = 0.2$, press ▶ to step through training, then switch to testing."
      story={train ? <StoryBar story={story} beats={beats} numbered={false} /> : null}
      caption={train
        ? 'At every training step each input and hidden neuron is dropped with probability $p$ and ignored for that step only (crossed out, dashed links); the outputs never are (slide 63). $p$ is typically 10% to 50%, and slide 64’s code uses `rate=0.2`.'
        : 'After training nothing is dropped: you simply use the connection weights that have been learned (slide 63). Dropout is only active in training, so evaluate the training loss without it before comparing it with the validation loss (slide 64).'}
      own="seeded random masks · this page’s own"
      maths={train ? (
        <>
          <MLine text={`Slide 63: at each training step every neuron, the inputs included but never the outputs, is temporarily dropped with probability $p$, the dropout rate (here $p = ${p}$).`} />
          <MLine text={cur ? `Step ${beat + 1}: dropped ${curDropped.length ? listNames(curDropped) : 'none'}; kept ${listNames(curKept)} and the three outputs.` : 'Press a step to see its mask.'} />
          <MLine text={`Kept in these ${DO_STEPS} steps: ${DO_NAMES.map((nm, j) => `${nm} ${keptAll[j]}`).join(', ')}. A neuron is kept with probability $1 - p = ${fmt(1 - p, 1)}$, so on average in $${DO_STEPS} × ${fmt(1 - p, 1)} = ${fmt(DO_STEPS * (1 - p), 1)}$ of ${DO_STEPS} steps (this page’s working).`} />
          <MLine text={`Keras (slide 64): \`tf.keras.layers.Dropout(rate=0.2)\` before every \`Dense\` layer.`} />
        </>
      ) : (
        <>
          <MLine text="Slide 63: after training, neurons don’t get dropped anymore; at testing you simply use the connection weights that have been learned from the training process." />
          <MLine text="Slide 64: since dropout is only active during training, a model may be overfitting the training set and yet have similar training and validation losses, so make sure to evaluate the training loss without dropout (e.g. after training)." />
        </>
      )}
    >
      <div ref={wrap}>
        <div className="dl12r-floorrow">
          <Switch label="Phase" value={mode} options={[['train', 'training'], ['test', 'testing']]} onChange={setMode} />
          {train && <Switch label="Dropout rate" value={p} options={DO_RATES.map((v) => [v, `p = ${v}`])} onChange={(v) => { setP(v); story.go(DO_STEPS - 1); }} />}
        </div>
        <div className={`dl12r-dout${narrow ? ' dl12r-dout--narrow' : ''}`}>
          <svg className="dl12r-svg" viewBox={`0 0 ${DO_W} ${DO_H}`} style={{ maxWidth: DO_W }} role="img" aria-label={train ? `Figure 11-10 rebuilt: step ${beat + 1}, dropped ${curDropped.length ? listNames(curDropped) : 'none'}` : 'At test time every neuron is active'}>
            <defs><Hatch id={hatchId} /></defs>
            {DO_POS.in.map(([x, y]) => <Vec key={`a${x}`} className="dl12r-dout__io" x1={x} y1={y + 44} x2={x} y2={y + rN + 3} head={7} />)}
            {DO_POS.out.map(([x, y]) => <Vec key={`b${x}`} className="dl12r-dout__io" x1={x} y1={y - rN - 2} x2={x} y2={y - 44} head={7} />)}
            {edges.map((e) => (
              <line key={e.key} className={`dl12r-dout__e${e.on ? '' : ' dl12r-dout__e--off'}`} x1={e.a[0]} y1={e.a[1] - rN} x2={e.b[0]} y2={e.b[1] + rN} />
            ))}
            {nodes.map((nd, i) => (
              <g key={nd.name} className={`dl12r-dout__n${nd.on ? '' : ' dl12r-dout__n--off'}${nd.out ? ' dl12r-dout__n--out' : ''}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <circle cx={nd.pos[0]} cy={nd.pos[1]} r={rN} style={nd.on ? undefined : { fill: `url(#${hatchId})` }} />
                {!nd.on && (
                  <g className="dl12r-dout__x">
                    <line x1={nd.pos[0] - 13} y1={nd.pos[1] - 13} x2={nd.pos[0] + 13} y2={nd.pos[1] + 13} />
                    <line x1={nd.pos[0] - 13} y1={nd.pos[1] + 13} x2={nd.pos[0] + 13} y2={nd.pos[1] - 13} />
                  </g>
                )}
                {nd.on
                  ? <text x={nd.pos[0]} y={nd.pos[1] + 4.5} textAnchor="middle" className="dl12r-t dl12r-t--m dl12r-dout__lbl">{nd.name}</text>
                  : <text x={nd.pos[0] + rN + 3} y={nd.pos[1] + rN + 6} className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{nd.name}</text>}
              </g>
            ))}
            <text x={8} y={DO_POS.in[0][1] + 4} className="dl12r-t dl12r-t--xs">inputs</text>
            <text x={DO_POS.out[2][0] + rN + 10} y={DO_POS.out[2][1] - 2} className="dl12r-t dl12r-t--xs">outputs:</text>
            <text x={DO_POS.out[2][0] + rN + 10} y={DO_POS.out[2][1] + 11} className="dl12r-t dl12r-t--xs">never dropped</text>
            {hn && <Tip x={tipX(hn.pos[0], tipFor(hn), 0, DO_W)} y={hn.pos[1] - rN - 4} text={tipFor(hn)} />}
          </svg>
          {train && (
            <svg className="dl12r-svg dl12r-dout__hist" viewBox={`0 0 ${GW} ${GH}`} style={{ maxWidth: GW }} role="img" aria-label={`Training history: kept counts ${DO_NAMES.map((nm, j) => `${nm} ${kept[j]}`).join(', ')}; outputs always kept`}>
              <text x={gx} y={12} className="dl12r-t dl12r-t--xs">step</text>
              {beat >= 0 && <rect className="dl12r-rowband" x={gx + beat * (cell + 2) - 2} y={gy - 4} width={cell + 4} height={GH - gy} rx={3} />}
              {Array.from({ length: DO_STEPS }, (_, s) => (
                <text key={s} x={gx + s * (cell + 2) + cell / 2} y={gy - 8} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{s + 1}</text>
              ))}
              <text x={gx + DO_STEPS * (cell + 2) + 6} y={gy - 8} className="dl12r-t dl12r-t--xs">kept</text>
              {[...DO_NAMES, ...DO_OUT].map((nm, r) => (
                <g key={nm}>
                  <text x={gx - 8} y={rowY(r) + cell / 2 + 4} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{nm}</text>
                  {Array.from({ length: DO_STEPS }, (_, s) => {
                    const done = s <= upto;
                    const on = r >= 6 || masks[s][r];
                    return (
                      <rect
                        key={s}
                        x={gx + s * (cell + 2)}
                        y={rowY(r)}
                        width={cell}
                        height={cell}
                        rx={3}
                        className={`dl12r-dout__c${!done ? ' dl12r-dout__c--later' : on ? '' : ' dl12r-dout__c--off'}`}
                        style={done && !on ? { fill: `url(#${hatchId})` } : undefined}
                      />
                    );
                  })}
                  <text x={gx + DO_STEPS * (cell + 2) + 6} y={rowY(r) + cell / 2 + 4} className="dl12r-t dl12r-t--xs dl12r-t--m">
                    {r >= 6 ? `${Math.max(0, upto + 1)}/${Math.max(0, upto + 1)}` : `${kept[r]}/${Math.max(0, upto + 1)}`}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
        <p className="dl12r-legend">
          {train && <span className="dl12r-legend__score">{beat >= 0 ? `step ${beat + 1}: ${curDropped.length} of 6 dropped` : 'before training'}</span>}
          {!train && <span className="dl12r-legend__score">testing: nothing dropped</span>}
          <span><i className="dl12r-l2sw dl12r-l2sw--node" aria-hidden="true" /> active</span>
          {train && <span><i className="dl12r-l2sw dl12r-l2sw--hatch" aria-hidden="true" /> dropped this step</span>}
        </p>
      </div>
    </Stage>
  );
}
