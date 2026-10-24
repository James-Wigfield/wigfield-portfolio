import { useId, useMemo, useRef, useState } from 'react';
import { Stage, MLine, MEq, MNote } from '../stage';
import { Knob, Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { useStudy } from '../context';
import { sqErr, absErr, huber, softmax, crossEntropy, lrSweep, shootUp, fmt } from '../nn';
import { lin, log10Scale, fnPath, ptsPath, pow10Label } from './plotMath';
import './labsL1.css';

/* ============================================================================
   §1.4 · OUTPUT LAYERS AND LOSSES (L1 slides 24–31) · §1.8 · THE LEARNING-
   RATE SWEEP (L1 slide 60)
   ----------------------------------------------------------------------------
   HeadsLab    a switch: regression (slide 28's squared error, absolute error
               and Huber_δ against the error z, with a draggable error) or
               classification (three logits → softmax probabilities that sum
               to 1, and the cross-entropy of the true class).
   LrSweepLab  slide 60's recipe run live on a toy regression (this page's
               own): the learning rate grows from 10⁻⁵ to 10 over 500
               iterations; loss against learning rate, the point where the
               loss shoots up, and both of the slide's rules of thumb.
   ========================================================================== */

const LOSSES = [
  { k: 'sq', name: 'sq. error', sw: '--dlv-blue', f: sqErr },
  { k: 'abs', name: 'abs. error', sw: '--dlv-green', f: absErr },
  { k: 'huber', name: 'Huber', sw: '--dlv-red', f: null },
];
const ZR = [-4.5, 4.5];

function RegressionView({ narrow, z, setZ, delta, setDelta }) {
  const ref = useRef(null);
  const clip = useId().replace(/:/g, '');
  const W = narrow ? 320 : 480;
  const H = 250;
  const sx = lin(ZR[0], ZR[1], 40, W - 12);
  const sy = lin(0, 10, H - 28, 14);
  const [drag, setDrag] = useState(false);
  const move = (e) => {
    if (!drag) return;
    const p = svgPoint(e, ref.current);
    if (p) setZ(Math.round(Math.max(-4.4, Math.min(4.4, sx.inv(p.x))) * 10) / 10);
  };
  const f = (l) => (l.k === 'huber' ? (v) => huber(v, delta) : l.f);
  return (
    <>
      <div className="dl12r-switch" role="group" aria-label="Huber δ">
        {[1, 2].map((d) => (
          <button key={d} type="button" className={`dl12r-switch__opt${delta === d ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={delta === d} onClick={() => setDelta(d)}>δ = {d}</button>
        ))}
      </div>
      <svg ref={ref} className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} onPointerMove={move} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} role="group" aria-label={`Losses at error z = ${z}: squared ${fmt(sqErr(z))}, absolute ${fmt(absErr(z))}, Huber ${fmt(huber(z, delta))}`}>
        <clipPath id={clip}><rect x={sx(ZR[0])} y={sy(10)} width={sx(ZR[1]) - sx(ZR[0])} height={sy(0) - sy(10)} /></clipPath>
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t}>
            <line className="dl12r-gridline" x1={sx(ZR[0])} x2={sx(ZR[1])} y1={sy(t)} y2={sy(t)} />
            <text x={34} y={sy(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
          </g>
        ))}
        {[-4, -2, 0, 2, 4].map((t) => <text key={t} x={sx(t)} y={H - 12} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>)}
        <text x={sx(ZR[1])} y={H - 1} textAnchor="end" className="dl12r-t dl12r-t--s">error z</text>
        <line className="dl12r-axisline" x1={sx(0)} x2={sx(0)} y1={sy(0)} y2={sy(10)} />
        <rect className="dl12r-sat" x={sx(-delta)} y={sy(10)} width={sx(delta) - sx(-delta)} height={sy(0) - sy(10)} style={{ fill: 'var(--dlv-red)', opacity: 0.06 }} />
        {LOSSES.map((l) => (
          <path key={l.k} clipPath={`url(#${clip})`} className="dl12r-curve" d={fnPath(f(l), sx, sy)} style={{ stroke: `var(${l.sw})`, strokeWidth: l.k === 'huber' ? 3 : 2, strokeDasharray: l.k === 'abs' ? '6 4' : undefined }} />
        ))}
        {/* the error marker: a draggable stem with each loss's value */}
        <line className="dl12r-hair" x1={sx(z)} x2={sx(z)} y1={sy(0)} y2={sy(10)} />
        {LOSSES.map((l) => {
          const v = f(l)(z);
          return v <= 10 ? <circle key={l.k} className="dl12r-pt" cx={sx(z)} cy={sy(v)} r={4.5} style={{ fill: `var(${l.sw})` }} /> : null;
        })}
        <g
          className="dl12r-handle"
          role="slider"
          tabIndex={0}
          aria-label="Error z"
          aria-valuemin={-4.4}
          aria-valuemax={4.4}
          aria-valuenow={z}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); }}
          onKeyDown={(e) => {
            const d = { ArrowLeft: -0.2, ArrowRight: 0.2, ArrowDown: -0.2, ArrowUp: 0.2 }[e.key];
            if (d) { e.preventDefault(); setZ(Math.round(Math.max(-4.4, Math.min(4.4, z + d)) * 10) / 10); }
          }}
        >
          <circle cx={sx(z)} cy={sy(0)} r={14} fill="transparent" />
          <circle cx={sx(z)} cy={sy(0)} r={7} className="dl12r-handle__dot" />
        </g>
      </svg>
      <p className="dl12r-legend">
        {LOSSES.map((l) => (
          <span key={l.k} style={{ color: `var(${l.sw})` }}>
            <i className={`dl12r-legend__swatch${l.k === 'abs' ? ' dl12r-legend__swatch--dash' : ''}`} />
            <span className="dl12r-legend__txt">{l.k === 'huber' ? `Huber, δ = ${delta}` : l.name}: <b>{fmt(f(l)(z))}</b></span>
          </span>
        ))}
        <span>at z = {fmt(z, 1)} · shaded |z| ≤ δ</span>
      </p>
    </>
  );
}

const CLASSES = ['class 0', 'class 1', 'class 2'];

function ClassificationView({ narrow, logits, setLogits, truth, setTruth }) {
  const p = softmax(logits);
  const W = narrow ? 320 : 480;
  const H = 250;
  const colW = (W - 60) / 3;
  const top = 40;
  const bot = H - 46;
  return (
    <>
      <div className="dl12r-switch" role="group" aria-label="True class">
        {CLASSES.map((c, k) => (
          <button key={c} type="button" className={`dl12r-switch__opt${truth === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={truth === k} onClick={() => setTruth(k)}>true: {c}</button>
        ))}
      </div>
      <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 40 }} role="group" aria-label={`Softmax probabilities ${p.map((v) => fmt(v)).join(', ')}; cross-entropy ${fmt(crossEntropy(p, truth))}`}>
        <text x={8} y={16} className="dl12r-t dl12r-t--xs">logit z (drag)</text>
        <text x={W - 8} y={16} textAnchor="end" className="dl12r-t dl12r-t--xs">softmax p̂ (sums to 1)</text>
        {CLASSES.map((c, k) => {
          const x0 = 40 + k * colW;
          const kx = x0 + colW * 0.28;
          const bx = x0 + colW * 0.52;
          const bw = Math.min(46, colW * 0.36);
          const h = (bot - top) * p[k];
          return (
            <g key={c}>
              <Knob
                x={kx}
                yTop={top}
                yBot={bot}
                value={logits[k]}
                min={-3}
                max={3}
                step={0.25}
                label={`Logit for ${c}`}
                onChange={(v) => setLogits(logits.map((q, j) => (j === k ? v : q)))}
              />
              <rect x={bx} y={top} width={bw} height={bot - top} rx={4} fill="var(--line-2)" opacity={0.45} />
              <rect className="dl12r-sbar" x={bx} y={bot - h} width={bw} height={h} rx={4} style={{ fill: k === truth ? 'var(--dl12r-c1)' : 'var(--dl12r-fwd)', transform: 'none' }} />
              <text x={bx + bw / 2} y={bot - h - 6} textAnchor="middle" className="dl12r-t dl12r-t--s dl12r-t--m">{fmt(p[k])}</text>
              <text x={x0 + colW * 0.42} y={H - 26} textAnchor="middle" className={`dl12r-t dl12r-t--s${k === truth ? ' dl12r-t--b' : ''}`}>{c}{k === truth ? ' (true)' : ''}</text>
              <text x={kx} y={H - 10} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">z = {fmt(logits[k])}</text>
            </g>
          );
        })}
      </svg>
      <p className="dl12r-legend">
        <span className="dl12r-legend__score">cross-entropy −log p̂(true) = {fmt(crossEntropy(p, truth), 3)}</span>
        <span>p̂ sum = {fmt(p.reduce((a, v) => a + v, 0))}</span>
      </p>
    </>
  );
}

export function HeadsLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const [task, setTask] = useState('reg');
  const [z, setZ] = useState(3.2);
  const [delta, setDelta] = useState(1);
  const [logits, setLogits] = useState([0.5, 2, -1]);
  const [truth, setTruth] = useState(1);
  const p = softmax(logits);
  return (
    <Stage
      title="The task picks the output layer and the loss"
      slides="L1 · slides 24–31"
      tryThis={task === 'reg'
        ? 'Drag the error out to 4: which loss explodes, and which grows only in a straight line?'
        : 'Raise one logit: watch every probability move, because they must still add up to 1.'}
      caption={task === 'reg'
        ? 'Regression: one output neuron per prediction dimension, usually no activation, loss MSE (or Huber if outliers). Huber is quadratic near 0 and linear beyond δ, so one big error can’t dominate (slides 27–28).'
        : 'Classification: one output per class with softmax, so the outputs are probabilities summing to 1, and the cross-entropy (log loss) punishes a low probability for the true class (slide 29).'}
      own={task === 'reg' ? 'curves of slide 28’s losses · error this page’s own' : 'toy logits · this page’s own'}
      maths={task === 'reg' ? (
        <>
          <MEq tex={'\\text{Huber}_\\delta(z) = \\begin{cases} \\frac{1}{2}z^2 & \\text{if } |z| \\le \\delta \\\\ \\delta\\left(|z| - \\frac{1}{2}\\delta\\right) & \\text{otherwise} \\end{cases}'} />
          <MLine text={`At $z = ${fmt(z, 1)}$, $\\delta = ${delta}$: ${Math.abs(z) <= delta ? `$\\tfrac{1}{2}z^2 = ${fmt(huber(z, delta), 3)}$` : `$\\delta(|z| - \\tfrac{1}{2}\\delta) = ${delta}(${fmt(Math.abs(z), 1)} - ${fmt(delta / 2, 1)}) = ${fmt(huber(z, delta), 3)}$`}; squared error $z^2 = ${fmt(sqErr(z), 3)}$; absolute error $|z| = ${fmt(absErr(z), 3)}$.`} />
          <MNote text="Slide 28 plots “abs. error” and “sq. error” against $z$ and gives the Huber formula; slide 27 names MSE and MAE without formulas." />
        </>
      ) : (
        <>
          <MEq tex={'J(\\boldsymbol{\\theta}) = -\\frac{1}{m}\\sum_{i=1}^{m}\\sum_{k=1}^{K} y_k^{(i)} \\log\\left(\\hat{p}_k^{(i)}\\right)'} />
          <MLine text={`One instance ($m = 1$) whose true class is ${truth}: $y_k^{(1)} = 1$ only for $k = ${truth}$, so $J = -\\log \\hat{p}_{${truth}} = -\\log(${fmt(p[truth], 3)}) = ${fmt(crossEntropy(p, truth), 3)}$.`} />
          <MNote text={'Softmax here is the usual $\\hat{p}_k = \\exp(z_k) / \\sum_j \\exp(z_j)$: slide 29 names softmax and says its outputs are probabilities summing to 1, but prints no formula.'} />
        </>
      )}
    >
      <div ref={wrap}>
        <div className="dl12r-switch" role="group" aria-label="Task">
          {[['reg', 'regression'], ['cls', 'classification']].map(([k, l]) => (
            <button key={k} type="button" className={`dl12r-switch__opt${task === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={task === k} onClick={() => setTask(k)}>{l}</button>
          ))}
        </div>
        <p className="dl12r-head">
          {task === 'reg'
            ? <><b>1 output neuron</b> per prediction dimension · <b>no activation</b> (ReLU/softplus if positive) · loss <b>MSE</b>, or <b>Huber</b> if outliers</>
            : <><b>1 output neuron per class</b> · <b>softmax</b> (sigmoid for binary or multilabel) · loss <b>cross-entropy</b></>}
        </p>
        {task === 'reg'
          ? <RegressionView narrow={narrow} z={z} setZ={setZ} delta={delta} setDelta={setDelta} />
          : <ClassificationView narrow={narrow} logits={logits} setLogits={setLogits} truth={truth} setTruth={setTruth} />}
      </div>
    </Stage>
  );
}

/* ── §1.8 · the learning-rate sweep ─────────────────────────────────────── */
export function LrSweepLab() {
  const wrap = useRef(null);
  const ref = useRef(null);
  const clip = useId().replace(/:/g, '');
  const narrow = useWidth(wrap) < 520;
  const { printing } = useStudy();
  const sweep = useMemo(() => lrSweep(), []);
  const { minAt, upAt } = useMemo(() => shootUp(sweep), [sweep]);
  const [pick, setPick] = useState(null);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(false);
  const W = narrow ? 330 : 600;
  const H = 280;
  const sx = log10Scale(1e-5, 10, 44, W - 14);
  const yMax = 8;
  const sy = lin(0, yMax, H - 34, 22);
  const tenth = upAt.lr / 10;
  const half = upAt.lr / 2;
  const finite = sweep.filter((p) => Number.isFinite(p.loss));
  const last = sweep[sweep.length - 1];
  const diverged = !Number.isFinite(last.loss);
  const yOf = (lr) => {
    const p = finite.reduce((a, q) => (Math.abs(Math.log10(q.lr) - Math.log10(lr)) < Math.abs(Math.log10(a.lr) - Math.log10(lr)) ? q : a), finite[0]);
    return p;
  };
  const chosen = printing ? null : pick;
  const verdict = (lr) => (lr >= upAt.lr ? 'too high: past where the loss shoots up' : lr < minAt.lr / 30 ? 'too low: the loss barely moves' : 'in the good zone');
  const onMove = (e) => {
    const p = svgPoint(e, ref.current);
    if (!p) return;
    const lr = Math.max(1e-5, Math.min(10, sx.inv(p.x)));
    if (drag) setPick(lr);
    else setHover(lr);
  };
  const mark = (lr, label, sub, cls, dy) => (
    <g className={cls}>
      <line className="dl12r-mark" x1={sx(lr)} x2={sx(lr)} y1={sy(0)} y2={sy(yMax)} />
      <text x={sx(lr) + (dy < 0 ? -5 : 5)} y={sy(yMax) + 14 + Math.abs(dy)} textAnchor={dy < 0 ? 'end' : 'start'} className="dl12r-t dl12r-t--s dl12r-t--b dl12r-halo">{label}</text>
      <text x={sx(lr) + (dy < 0 ? -5 : 5)} y={sy(yMax) + 28 + Math.abs(dy)} textAnchor={dy < 0 ? 'end' : 'start'} className="dl12r-t dl12r-t--xs dl12r-t--m dl12r-halo">{sub}</text>
    </g>
  );
  const h = hover ? yOf(hover) : null;
  return (
    <Stage
      title="Find the learning rate with one sweep"
      slides="L1 · slide 60"
      tryThis="Find where the loss shoots up, then drag the dot along the floor to pick a rate: where do the slide’s two rules of thumb land?"
      caption={`The loss shoots up at about η = ${fmt(upAt.lr, 2)}. Slide 60 gives two rules: about 10 times lower than that (≈ ${fmt(tenth, 2)}), or about half the maximum rate (≈ ${fmt(half, 2)}, taking the shoot-up point as that maximum: this page’s assumption). On this toy run both land in the low-loss region.`}
      challenge={{ text: 'Pick a rate in the good zone.', done: chosen !== null && verdict(chosen) === 'in the good zone' }}
      maths={
        <>
          <MLine text={`500 iterations from $10^{-5}$ to $10$: each step multiplies $\\eta$ by $10^{6/499} \\approx ${fmt(10 ** (6 / 499), 4)}$. The toy model is a 3-feature linear regression trained by mini-batch gradient descent (batch 16, MSE).`} />
          <MLine text={`Lowest smoothed loss ${fmt(minAt.smooth, 3)} at $\\eta \\approx ${fmt(minAt.lr, 3)}$; it passes 4 × that minimum at $\\eta \\approx ${fmt(upAt.lr, 3)}$${diverged ? ', and the run diverges (the loss runs off to infinity) soon after' : ''}.`} />
          <MLine text={`Rule 1: $\\eta_{\\text{up}}/10 \\approx ${fmt(tenth, 3)}$. Rule 2: $\\eta_{\\max}/2 \\approx ${fmt(half, 3)}$, taking the shoot-up point as the maximum rate.`} />
          <MNote text="The toy problem, the 4 × threshold for “shoots up” and the smoothing (an exponential moving average, 0.9) are this page’s own; slide 60 gives the recipe and both rules in words, with no plot." />
        </>
      }
    >
      <div ref={wrap}>
        <svg
          ref={ref}
          className="dl12r-svg"
          viewBox={`0 0 ${W} ${H}`}
          style={{ maxWidth: W + 40 }}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
          role="group"
          aria-label={`Loss against learning rate; the loss shoots up at about ${fmt(upAt.lr, 2)}`}
        >
          <clipPath id={clip}><rect x={sx(1e-5)} y={sy(yMax)} width={sx(10) - sx(1e-5)} height={sy(0) - sy(yMax)} /></clipPath>
          {[0, 2, 4, 6, 8].map((t) => (
            <g key={t}>
              <line className="dl12r-gridline" x1={sx(1e-5)} x2={sx(10)} y1={sy(t)} y2={sy(t)} />
              <text x={38} y={sy(t) + 3.5} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">{t}</text>
            </g>
          ))}
          {[-5, -4, -3, -2, -1, 0, 1].map((e) => <text key={e} x={sx(10 ** e)} y={H - 16} textAnchor="middle" className="dl12r-t dl12r-t--xs dl12r-t--m">{pow10Label(e)}</text>)}
          <text x={sx(10)} y={H - 2} textAnchor="end" className="dl12r-t dl12r-t--s">learning rate η (log scale)</text>
          <text x={6} y={14} className="dl12r-t dl12r-t--s">loss</text>
          {/* the good zone, between the two rules' picks */}
          <rect className="dl12r-good" x={sx(tenth)} y={sy(yMax)} width={sx(half) - sx(tenth)} height={sy(0) - sy(yMax)} />
          <path clipPath={`url(#${clip})`} className="dl12r-curve" d={ptsPath(finite.map((p) => [p.lr, p.loss]), sx, sy)} style={{ stroke: 'var(--ink-3)', strokeWidth: 1, opacity: 0.5 }} />
          <path clipPath={`url(#${clip})`} className="dl12r-curve" d={ptsPath(finite.map((p) => [p.lr, p.smooth]), sx, sy)} style={{ stroke: 'var(--dl12r-bwd)', strokeWidth: 2.6 }} />
          {mark(upAt.lr, 'shoots up', `η ≈ ${fmt(upAt.lr, 2)}`, 'dl12r-mk dl12r-mk--up', 0)}
          {mark(tenth, '÷ 10', `≈ ${fmt(tenth, 2)}`, 'dl12r-mk', -1)}
          {mark(half, '÷ 2', `≈ ${fmt(half, 2)}`, 'dl12r-mk', -44)}
          {diverged && <text x={sx(last.lr) + 6} y={sy(1.2)} className="dl12r-t dl12r-t--xs dl12r-t--bwd dl12r-halo">diverges</text>}
          {h && !drag && (
            <g pointerEvents="none">
              <line className="dl12r-hair" x1={sx(h.lr)} x2={sx(h.lr)} y1={sy(0)} y2={sy(yMax)} />
              <Tip x={sx(h.lr)} y={Math.max(30, sy(Math.min(yMax, h.smooth)))} text={`η = ${h.lr.toExponential(1)}: loss ${fmt(h.smooth, 2)}`} />
            </g>
          )}
          <g
            className="dl12r-handle"
            role="slider"
            tabIndex={0}
            aria-label="Your learning rate (log scale)"
            aria-valuetext={chosen ? `${chosen.toExponential(1)}: ${verdict(chosen)}` : 'not picked yet'}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); }}
            onKeyDown={(e) => {
              const d = { ArrowLeft: -0.1, ArrowRight: 0.1, ArrowDown: -0.1, ArrowUp: 0.1 }[e.key];
              if (d) { e.preventDefault(); setPick(10 ** Math.max(-5, Math.min(1, Math.log10(chosen ?? 1e-3) + d))); }
            }}
          >
            <circle cx={sx(chosen ?? 1e-3)} cy={sy(0)} r={14} fill="transparent" />
            <circle cx={sx(chosen ?? 1e-3)} cy={sy(0)} r={7} className="dl12r-handle__dot" />
          </g>
        </svg>
        <p className="dl12r-legend">
          <span className="dl12r-legend__score">{chosen ? `your η = ${chosen.toExponential(1)}: ${verdict(chosen)}` : 'drag the dot on the floor to pick a rate'}</span>
          <span style={{ color: 'var(--dl12r-bwd)' }}><i className="dl12r-legend__swatch" /> <span className="dl12r-legend__txt">smoothed loss</span></span>
          <span><i className="dl12r-legend__swatch" style={{ color: 'var(--ink-3)' }} /> raw loss</span>
        </p>
      </div>
    </Stage>
  );
}
