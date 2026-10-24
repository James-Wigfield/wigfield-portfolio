import { useMemo, useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../stage';
import { Scrub, Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { svgPoint } from '../hooks';
import { qValueIteration, qLearningRun, rng, fmt, sub } from '../rl';
import './labsQLearning.css';

/* ============================================================================
   §14 · Q-LEARNING, OFF- VS ON-POLICY, ε-GREEDY  (slides 53–57)
   ----------------------------------------------------------------------------
   QLearningLab   a Figure 18-9-style pair of learning curves: left, slide
                  48's Q-value iteration (it knows T and R) over 50
                  iterations; right, this page's own Q-learning run on the
                  same MDP over 10,000 steps (random exploration, α_k =
                  0.05 / (1 + 0.005 k), a learning rate gradually reduced
                  as slide 52 advises), the converged Q-value iteration
                  value as a dashed line. Switch between Q(s0, a0) (slide
                  54) and Q(s2, a1) (slide 55); "new run" changes the seed.
                  Hover (or focus + arrow keys) reads a curve.
   EpsilonLab     the ε-greedy policy (slide 57, as coded on slide 61) in s0:
                  three actions with their converged Q-values (γ = 0.90).
                  With probability ε a random action (each gets ε/3), with
                  probability 1 − ε the highest-Q action, so P(a0) = 1 − ε
                  + ε/3. Each action's probability is a bar split into its
                  explore and exploit parts; "sample 100 actions" tallies a
                  seeded run. ε handle marks slide 57's "close to 1" and
                  "0.05" and slide 64's 0.01.
   ========================================================================== */

const QVI = qValueIteration({ gamma: 0.9, iterations: 50 });
const PAIRS = {
  s0a0: { s: 0, a: 0, label: 'Q(s₀, a₀)', slide: 'slide 54', max: 25, ticks: [0, 5, 10, 15, 20] },
  s2a1: { s: 2, a: 1, label: 'Q(s₂, a₁)', slide: 'slide 55', max: 60, ticks: [0, 10, 20, 30, 40, 50] },
};
const STEPS = 10000;
const ALPHA0 = 0.05;
const DECAY = 0.005;
const n0 = (v) => Math.round(v).toLocaleString('en-US');

function curveGeom(narrow) {
  if (narrow) {
    return { W: 340, H: 470, L: { x0: 48, x1: 318, y0: 40, y1: 186 }, R: { x0: 48, x1: 318, y0: 266, y1: 412 } };
  }
  return { W: 780, H: 270, L: { x0: 56, x1: 316, y0: 38, y1: 222 }, R: { x0: 372, x1: 760, y0: 38, y1: 222 } };
}

function Panel({ box, xs, ys, xMax, yMax, yTicks, xTicks, title, sub: subtitle, target, mark, endLabel, cursor, onCursor, unit, showY, kbStep }) {
  const ref = useRef(null);
  const toX = (x) => box.x0 + (x / xMax) * (box.x1 - box.x0);
  const toY = (y) => box.y1 - (Math.max(0, Math.min(yMax, y)) / yMax) * (box.y1 - box.y0);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(ys[i]).toFixed(1)}`).join(' ');
  const nearest = (x) => {
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m; else hi = m; }
    return x - xs[lo] < xs[hi] - x ? lo : hi;
  };
  const move = (e) => {
    const pt = svgPoint(e, ref.current?.ownerSVGElement);
    if (!pt) return;
    const x = ((Math.max(box.x0, Math.min(box.x1, pt.x)) - box.x0) / (box.x1 - box.x0)) * xMax;
    onCursor(nearest(x));
  };
  const onKey = (e) => {
    const cur = cursor ?? xs.length - 1;
    const dd = { ArrowRight: kbStep, ArrowLeft: -kbStep, PageUp: kbStep * 10, PageDown: -kbStep * 10 }[e.key];
    if (dd !== undefined) { e.preventDefault(); onCursor(Math.max(0, Math.min(xs.length - 1, cur + dd))); }
    else if (e.key === 'Home') { e.preventDefault(); onCursor(0); }
    else if (e.key === 'End') { e.preventDefault(); onCursor(xs.length - 1); }
  };
  const c = cursor;
  return (
    <g
      ref={ref}
      className="dl9s-ql__panel"
      tabIndex={0}
      role="slider"
      aria-label={`${title}: arrow keys read the curve`}
      aria-valuemin={0}
      aria-valuemax={xMax}
      aria-valuenow={c === null ? xMax : xs[c]}
      aria-valuetext={c === null ? `${endLabel}` : `${unit} ${n0(xs[c])}: ${fmt(ys[c], 2)}`}
      onPointerMove={move}
      onPointerLeave={() => onCursor(null)}
      onKeyDown={onKey}
      onBlur={() => onCursor(null)}
    >
      <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} className="dl9s-ql__bg" />
      <text x={box.x0} y={box.y0 - 22} className="dl9s-t dl9s-t--b">{title}</text>
      <text x={box.x0} y={box.y0 - 8} className="dl9s-t dl9s-t--xs">{subtitle}</text>
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={box.x0} y1={toY(v)} x2={box.x1} y2={toY(v)} className="dl9s-grid-line" />
          {showY && <text x={box.x0 - 7} y={toY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>}
        </g>
      ))}
      {xTicks.map((v) => (
        <text key={`x${v}`} x={toX(v)} y={box.y1 + 15} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{n0(v)}</text>
      ))}
      <text x={box.x1} y={box.y1 + 30} textAnchor="end" className="dl9s-t dl9s-t--xs">{unit === 'step' ? 'iterations (steps)' : 'iterations'}</text>
      {mark && (
        <g>
          <line x1={toX(mark.x)} y1={box.y0} x2={toX(mark.x)} y2={box.y1} className="dl9s-today" />
          <text x={toX(mark.x) + 4} y={box.y1 - 6} className="dl9s-t dl9s-t--xs dl9s-slidemark">{mark.label}</text>
        </g>
      )}
      <line x1={box.x0} y1={toY(target)} x2={box.x1} y2={toY(target)} className="dl9s-line dl9s-line--ghost" />
      <path d={d} className="dl9s-line dl9s-line--val dl9s-ql__curve" />
      <line x1={box.x0} y1={box.y1} x2={box.x1} y2={box.y1} className="dl9s-ax" />
      {c !== null && (
        <g className="dl9s-ql__cursor">
          <line x1={toX(xs[c])} y1={box.y0} x2={toX(xs[c])} y2={box.y1} />
          <circle cx={toX(xs[c])} cy={toY(ys[c])} r={4.5} />
          <Tip x={Math.max(box.x0 + 50, Math.min(box.x1 - 50, toX(xs[c])))} y={box.y0 + 6} text={`${unit} ${n0(xs[c])}: ${fmt(ys[c], 2)}`} />
        </g>
      )}
    </g>
  );
}

export function QLearningLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [pairKey, setPairKey] = useState('s0a0');
  const [seed, setSeed] = useState(1);
  const [curL, setCurL] = useState(null);
  const [curR, setCurR] = useState(null);
  const sd = printing ? 1 : seed;
  const pair = PAIRS[printing ? 's0a0' : pairKey];
  const run = useMemo(() => qLearningRun({ seed: sd, steps: STEPS, alpha0: ALPHA0, decay: DECAY }), [sd]);
  const key = pair.s === 0 ? 's0a0' : 's2a1';
  const qviYs = QVI.history.map((Q) => Q[pair.s][pair.a]);
  const qviXs = qviYs.map((_, i) => i);
  const target = QVI.Q[pair.s][pair.a];
  const ys = run.track[key];
  const end = ys.at(-1);
  const off = (100 * (end - target)) / target;
  const G = curveGeom(narrow);
  const slide54 = pair.s === 0;

  return (
    <Stage
      title="Knowing the MDP vs learning by watching"
      slides="slides 53–55"
      tryThis="Predict which curve reaches the dashed line first, then press new run a few times."
      caption="Left: slide 48’s Q-value iteration, which knows $T$ and $R$. Right: this page’s own Q-learning run, with a purely random explorer and a learning rate reduced gradually as slide 52 advises ($\alpha_k = 0.05/(1 + 0.005k)$), still heads for the dashed $Q^*$ (within about 10%, depending on the seed), because Q-learning is off-policy (slide 56)."
      own={`Q-learning run, seed ${sd} · this page’s own`}
      maths={
        <>
          <MEq tex={"Q_{k+1}(s,a) \\leftarrow (1-\\alpha) Q_k(s,a) + \\alpha \\left( r + \\gamma \\max_{a'} Q_k(s', a') \\right)"} />
          <MLine text={`This run: $\\gamma = 0.90$, one observed transition per step, the action drawn uniformly from the state’s possible actions, and $\\alpha_k = 0.05/(1 + 0.005k)$: ${[0, 1000, 5000, 9999].map((k) => `$\\alpha_{${k}} = ${(ALPHA0 / (1 + DECAY * k)).toFixed(4)}$`).join(', ')}.`} />
          <MLine text={`After 10,000 steps (seed ${sd}): $Q(s_0, a_0) = ${fmt(run.track.s0a0.at(-1), 2)}$ and $Q(s_2, a_1) = ${fmt(run.track.s2a1.at(-1), 2)}$, against Q-value iteration’s $${fmt(QVI.Q[0][0], 2)}$ and $${fmt(QVI.Q[2][1], 2)}$ (the dashed lines). Its whole table: ${run.Q.map((r) => `[${r.map((v) => fmt(v, 2)).join(', ')}]`).join(', ')}.`} />
          <MEq tex={"Q_{k+1}(s,a) \\leftarrow \\sum_{s'} T(s,a,s') \\left[ R(s,a,s') + \\gamma \\max_{a'} Q_k(s',a') \\right]"} />
          <MLine text={`Q-value iteration (left) uses $T$ and $R$ in every update, so $Q(s_0, a_0)$ is within 0.01 of ${fmt(QVI.Q[0][0], 2)} by iteration ${QVI.history.findIndex((Q) => Math.abs(Q[0][0] - QVI.Q[0][0]) < 0.01)}. Q-learning (right) only sees one sampled transition at a time.`} />
        </>
      }
    >
      <div ref={wrap} className={`dl9s-ql${narrow ? ' dl9s-ql--narrow' : ''}`}>
        <div className="dl9s-floorrow">
          <div className="dl9s-switch" role="group" aria-label="Which Q-value to chart">
            {Object.entries(PAIRS).map(([k, p]) => (
              <button key={k} type="button" className={`dl9s-switch__opt${key === k ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={key === k} onClick={() => setPairKey(k)}>
                {p.label} · {p.slide}
              </button>
            ))}
          </div>
          <p className="dl9s-ql__runrow">
            <span className="dl9s-ql__seed">seed {sd}</span>
            <button type="button" className="dl9s-ql__new dl9s-noprint" onClick={() => setSeed((x) => x + 1)}>new run</button>
          </p>
        </div>
        <svg className="dl9s-svg dl9s-ql__chart" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Learning curves of ${pair.label}: Q-value iteration converges to ${fmt(target, 2)} within 20 iterations; this page's Q-learning run ends at ${fmt(end, 2)} after 10,000 steps`}>
          <Panel
            box={G.L}
            xs={qviXs}
            ys={qviYs}
            xMax={50}
            yMax={pair.max}
            yTicks={pair.ticks}
            xTicks={[0, 10, 20, 30, 40, 50]}
            title="Q-value iteration"
            sub={`${pair.label}, γ = 0.90`}
            target={target}
            mark={slide54 ? { x: 20, label: '20 (slide 54)' } : null}
            endLabel={`${fmt(target, 2)}`}
            cursor={curL}
            onCursor={setCurL}
            unit="iteration"
            showY
            kbStep={1}
          />
          <Panel
            box={G.R}
            xs={run.track.k}
            ys={ys}
            xMax={STEPS}
            yMax={pair.max}
            yTicks={pair.ticks}
            xTicks={narrow ? [0, 5000, 10000] : [0, 2000, 4000, 6000, 8000, 10000]}
            title="Q-learning · this page’s run"
            sub={`${pair.label}, ends at ${fmt(end, 2)} (${off >= 0 ? '+' : '−'}${Math.abs(off).toFixed(1)}%)`}
            target={target}
            mark={slide54 ? { x: 8000, label: '≈ 8,000 (slide 54)' } : null}
            endLabel={`${fmt(end, 2)}`}
            cursor={curR}
            onCursor={setCurR}
            unit="step"
            showY={narrow}
            kbStep={10}
          />
          <text x={G.L.x1 - 4} y={G.L.y1 - (target / pair.max) * (G.L.y1 - G.L.y0) - 6} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{fmt(target, 2)}</text>
        </svg>
      </div>
    </Stage>
  );
}

/* ── ε-greedy in s0 ───────────────────────────────────────────────────── */
const Q_S0 = QVI.Q[0];
const N_A = 3;
const BEST = Q_S0.indexOf(Math.max(...Q_S0));
const pGreedy = (e) => 1 - e + e / N_A;

function sample100(R, eps) {
  const t = Array.from({ length: N_A }, () => ({ explore: 0, exploit: 0 }));
  for (let i = 0; i < 100; i++) {
    if (R.next() < eps) t[R.int(N_A)].explore += 1;
    else t[BEST].exploit += 1;
  }
  return t;
}

function epsGeom(narrow) {
  return narrow
    ? { W: 340, H: 318, gx: [84, 186, 288], bw: 36, tw: 12, q: [40, 96], p: [148, 268] }
    : { W: 640, H: 310, gx: [210, 350, 490], bw: 46, tw: 14, q: [38, 96], p: [140, 262] };
}

export function EpsilonLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [eps, setEps] = useState(0.4);
  const gen = useRef(null);
  const [tally, setTally] = useState(() => sample100(rng(57), 0.4));
  const e = printing ? 0.4 : eps;
  const tl = printing ? sample100(rng(57), 0.4) : tally;
  const G = epsGeom(narrow);
  const qTop = (v) => G.q[1] - (v / 20) * (G.q[1] - G.q[0]);
  const pY = (v) => G.p[1] - v * (G.p[1] - G.p[0]);
  const probs = Q_S0.map((_, a) => ({ explore: e / N_A, exploit: a === BEST ? 1 - e : 0 }));
  const onEps = (v) => { setEps(v); setTally(null); };
  const draw = () => {
    if (!gen.current) { gen.current = rng(57); sample100(gen.current, 0.4); }
    setTally(sample100(gen.current, eps));
  };
  const done = Math.abs(pGreedy(e) - 0.9) < 1e-6;

  // the ε track
  const S = narrow ? { W: 340, H: 104, x0: 22, x1: 318, y: 44 } : { W: 640, H: 92, x0: 40, x1: 600, y: 40 };
  const sx = (v) => S.x0 + v * (S.x1 - S.x0);

  return (
    <Stage
      title="Explore or exploit: the ε-greedy policy"
      slides="slides 56–57"
      tryThis="Predict how often s₀ picks a₀ when ε = 1, drag ε, then sample 100 actions."
      caption="With probability $\epsilon$ the agent explores (a random action, so each of $s_0$’s three actions gets $\epsilon/3$); otherwise it exploits the highest Q-value, so $P(a_0) = 1 - \epsilon + \epsilon/3$ (this page’s working)."
      challenge={{ text: 'Find the ε where the best action is chosen 90% of the time.', done }}
      own="Q-values from §12’s Q-value iteration · samples this page’s own"
      maths={
        <>
          <MLine text="The slides describe the $\epsilon$-greedy policy in words (slide 57) and code (slide 61); written as a probability (this page’s own working, $[\dots]$ is 1 when true, 0 otherwise):" />
          <MEq tex={'P(a) = \\frac{\\epsilon}{|A(s)|} + (1 - \\epsilon)\\,[\\,a = \\operatorname*{argmax}_{a\'} Q(s, a\')\\,]'} />
          <MLine text={`In $s_0$, $|A(s_0)| = 3$ and the highest Q-value is $Q(s_0, a_0) = ${fmt(Q_S0[0], 2)}$ (then $a_1$: ${fmt(Q_S0[1], 2)}, $a_2$: ${fmt(Q_S0[2], 2)}). With $\\epsilon = ${e.toFixed(2)}$: $P(a_0) = 1 - ${e.toFixed(2)} + ${e.toFixed(2)}/3 = ${pGreedy(e).toFixed(4)}$ and $P(a_1) = P(a_2) = ${(e / 3).toFixed(4)}$.`} />
          <MLine text="For 90%: $1 - \epsilon + \epsilon/3 = 0.9$, so $\frac{2\epsilon}{3} = 0.1$ and $\epsilon = 0.15$." />
          <MLine text="Slide 61’s `epsilon_greedy_policy` explores with `np.random.randint(n_outputs)`, a draw over all the network’s actions. In $s_0$ all three actions are possible, so that is the same as drawing from $s_0$’s possible actions." />
          <MLine text="Slide 57: $\epsilon$ is often set close to 1 initially and gradually reduced to a small value (e.g. 0.05); slide 64’s code goes down to 0.01 (see §16)." />
        </>
      }
    >
      <div ref={wrap} className={`dl9s-eg${narrow ? ' dl9s-eg--narrow' : ''}`}>
        <div className="dl9s-floorrow dl9s-eg__side">
          <button type="button" className="dl9s-eg__btn dl9s-noprint" onClick={draw}>sample 100 actions</button>
          <p className="dl9s-eg__read" aria-live="polite">
            {tl
              ? <>a₀ chosen <b>{tl[0].explore + tl[0].exploit}</b> times ({tl[0].exploit} greedy + {tl[0].explore} explored)</>
              : <>expected a₀: <b>{(100 * pGreedy(e)).toFixed(0)}</b> of 100</>}
          </p>
        </div>
        <svg className="dl9s-svg dl9s-eg__bars" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label={`Epsilon ${e.toFixed(2)}: probability of a0 ${pGreedy(e).toFixed(2)}, a1 ${(e / 3).toFixed(2)}, a2 ${(e / 3).toFixed(2)}${tl ? `; sampled 100: ${tl.map((t, a) => `a${a} ${t.explore + t.exploit}`).join(', ')}` : ''}`}>
          <text x={narrow ? 8 : 40} y={G.q[0] - 16} className="dl9s-t dl9s-t--s dl9s-t--val">Q(s₀, a)</text>
          <text x={narrow ? 8 : 40} y={G.p[0] - 22} className="dl9s-t dl9s-t--s dl9s-t--pol">P(a) under ε-greedy</text>
          {!narrow && (
            <g>
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line x1={G.gx[0] - 60} y1={pY(v)} x2={G.gx[2] + 60} y2={pY(v)} className="dl9s-grid-line" />
                  <text x={G.gx[0] - 66} y={pY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
                </g>
              ))}
            </g>
          )}
          {narrow && <line x1={G.gx[0] - 40} y1={pY(0)} x2={G.gx[2] + 44} y2={pY(0)} className="dl9s-grid-line" />}
          {Q_S0.map((q, a) => {
            const x = G.gx[a];
            const pr = probs[a];
            const t = tl?.[a];
            const tot = t ? t.explore + t.exploit : 0;
            return (
              <g key={a}>
                {/* the Q bar */}
                <rect x={x - G.bw / 2} y={qTop(q)} width={G.bw} height={G.q[1] - qTop(q)} rx={3} className="dl9s-bar dl9s-bar--val dl9s-eg__q" />
                <text x={x} y={qTop(q) - 5} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{fmt(q, 2)}</text>
                {a === BEST && <text x={x + G.bw / 2 + 5} y={qTop(q) + 10} className="dl9s-t dl9s-t--xs dl9s-t--val">max</text>}
                {/* P(a): explore part at the bottom, exploit part above */}
                <rect x={x - G.bw / 2} y={pY(pr.explore)} width={G.bw} height={pY(0) - pY(pr.explore)} className="dl9s-eg__explore" />
                {pr.exploit > 0 && <rect x={x - G.bw / 2} y={pY(pr.explore + pr.exploit)} width={G.bw} height={pY(0) - pY(pr.exploit)} className="dl9s-eg__exploit" />}
                <text x={x} y={pY(pr.explore + pr.exploit) - 6} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--m dl9s-t--pol">{(pr.explore + pr.exploit).toFixed(2)}</text>
                {/* the tally of 100 samples, an outline beside the bar */}
                {t && (
                  <g>
                    <rect x={x + G.bw / 2 + 3} y={pY(tot / 100)} width={G.tw} height={Math.max(0.5, pY(0) - pY(tot / 100))} className="dl9s-eg__tally" />
                    <text x={x + G.bw / 2 + 3 + G.tw / 2} y={pY(tot / 100) - 5} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{tot}</text>
                  </g>
                )}
                <text x={x} y={G.p[1] + 18} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--act">{sub(`a${a}`)}</text>
              </g>
            );
          })}
          <g className="dl9s-eg__legend">
            <rect x={narrow ? 10 : G.gx[2] + 66} y={narrow ? G.H - 16 : G.p[0] + 6} width={10} height={10} className="dl9s-eg__exploit" />
            <text x={(narrow ? 10 : G.gx[2] + 66) + 15} y={(narrow ? G.H - 16 : G.p[0] + 6) + 9} className="dl9s-t dl9s-t--xs">exploit, 1 − ε</text>
            <rect x={narrow ? 120 : G.gx[2] + 66} y={narrow ? G.H - 16 : G.p[0] + 26} width={10} height={10} className="dl9s-eg__explore" />
            <text x={(narrow ? 120 : G.gx[2] + 66) + 15} y={(narrow ? G.H - 16 : G.p[0] + 26) + 9} className="dl9s-t dl9s-t--xs">explore, ε/3 each</text>
            <rect x={narrow ? 236 : G.gx[2] + 66} y={narrow ? G.H - 16 : G.p[0] + 46} width={10} height={10} className="dl9s-eg__tally" />
            <text x={(narrow ? 236 : G.gx[2] + 66) + 15} y={(narrow ? G.H - 16 : G.p[0] + 46) + 9} className="dl9s-t dl9s-t--xs">of 100 samples</text>
          </g>
        </svg>
        <svg className="dl9s-svg dl9s-eg__eps" viewBox={`0 0 ${S.W} ${S.H}`} role="group" aria-label="Epsilon">
          <Scrub
            x0={S.x0}
            x1={S.x1}
            y={S.y}
            value={e}
            min={0}
            max={1}
            step={0.01}
            big={0.1}
            onChange={onEps}
            label="Epsilon: the probability of exploring"
            show={(v) => `ε = ${v.toFixed(2)}`}
            ticks={[0.5]}
            tickLabel={() => '0.5'}
            marks={[{ v: 0.01, label: '' }, { v: 0.05, label: '' }, { v: 1, label: '' }]}
          />
          <line x1={sx(0.01)} y1={S.y + 8} x2={sx(0.01)} y2={S.y + 40} className="dl9s-eg__lead" />
          <text x={sx(0.01) + 4} y={S.y + 44} className="dl9s-t dl9s-t--xs dl9s-slidemark">0.01 (slide 64’s code)</text>
          <line x1={sx(0.05)} y1={S.y + 8} x2={sx(0.05)} y2={S.y + 24} className="dl9s-eg__lead" />
          <text x={sx(0.05) + 4} y={S.y + 28} className="dl9s-t dl9s-t--xs dl9s-slidemark">0.05 (slide 57)</text>
          <text x={sx(1)} y={S.y + 28} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-slidemark">close to 1 initially (slide 57)</text>
        </svg>
      </div>
    </Stage>
  );
}
