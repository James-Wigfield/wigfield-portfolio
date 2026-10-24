import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine, MEq } from '../stage';
import { Scrub } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion } from '../hooks';
import { rng, tdUpdate, T_188, R_188, ACTIONS_188, fmt, sub } from '../rl';
import Mdp188 from './Mdp188';
import { geom } from './mdp188Geom';
import { ValueFills } from './labsValueIter';
import './labsTd.css';

/* ============================================================================
   §13 · TEMPORAL DIFFERENCE LEARNING  (slides 50–52)
   ----------------------------------------------------------------------------
   TdLab   one observed transition at a time on Figure 18-8. The agent in s
           takes a random possible action (a random exploration policy,
           slide 51) and lands in s′ with reward r (sampled from slide 47's
           T and R with this page's seeded RNG). The update is drawn on a
           vertical number line for V(s): the old estimate, the TD target
           r + γV(s′), the gap between them (the TD error δ), and the new
           estimate a fraction α of the way there (tdUpdate). Dragging α
           re-draws the pending update; "observe" applies it and samples
           the next transition from s′. γ = 0.90. The three current
           estimates fill the states (and are written under the figure).
           Opens on a +40 transition out of s2 after 27 earlier ones.
   ========================================================================== */

const GAMMA = 0.9;
const SEED = 3;
const OPEN_N = 27;
const OPEN_ALPHA = 0.2;
const NAMES = ['s0', 's1', 's2'];

// one transition from s under the random exploration policy
function sample(R, s) {
  const as = ACTIONS_188[s];
  const a = as[R.int(as.length)];
  const sp = R.pick(T_188[s][a]);
  return { s, a, sp, r: R_188[s][a][sp] };
}

// the opening: 27 transitions from s0 with α = 0.2, the 28th pending
function opening() {
  const R = rng(SEED);
  const V = [0, 0, 0];
  let t = sample(R, 0);
  for (let i = 0; i < OPEN_N; i++) {
    V[t.s] = tdUpdate(V[t.s], t.r, V[t.sp], OPEN_ALPHA, GAMMA).next;
    t = sample(R, t.sp);
  }
  return { R, V, t, n: OPEN_N };
}
const OPEN = opening();
const INITIAL = { V: OPEN.V, t: OPEN.t, n: OPEN.n };

// the random policy's own values (V = mean over possible actions of Σ T[R + γV]), for the drawer
const V_RANDOM = (() => {
  let V = [0, 0, 0];
  for (let it = 0; it < 600; it++) {
    V = V.map((_, s) => ACTIONS_188[s].reduce((acc, a) => acc + T_188[s][a].reduce((x, p, sp) => x + p * (R_188[s][a][sp] + GAMMA * V[sp]), 0), 0) / ACTIONS_188[s].length);
  }
  return V;
})();

const sgn = (v) => (v > 0 ? `+${fmt(v, 2)}` : fmt(v, 2));

/* the number line: old estimate, TD target, δ, and the new estimate */
function NumberLine({ old, target, next, alpha, s, sp }) {
  const W = 350;
  const H = 300;
  const AX = 140;
  const yTop = 22;
  const yBot = 282;
  const vals = [0, old, target, next];
  let step = 10;
  let lo = Math.floor(Math.min(...vals) / step) * step;
  let hi = Math.ceil(Math.max(...vals) / step) * step;
  if (hi - lo > 100) { step = 20; lo = Math.floor(lo / 20) * 20; hi = Math.ceil(hi / 20) * 20; }
  if (hi - lo < 40) { const mid = (hi + lo) / 2; lo = Math.floor((mid - 20) / step) * step; hi = lo + 40; }
  const toY = (v) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const yO = toY(old);
  const yT = toY(target);
  const yN = toY(next);
  const BX = AX - 44;
  const up = yT < yO;
  // labels on the right, pushed apart so they never overlap
  const labs = [
    { key: 't', y: yT, cls: 'dl9s-t--ret', head: 'TD target', text: `r + γ V(${sub(NAMES[sp])}) = ${fmt(target, 2)}` },
    { key: 'n', y: yN, cls: 'dl9s-t--val', head: 'new', text: `V(${sub(NAMES[s])}) = ${fmt(next, 2)}` },
    { key: 'o', y: yO, cls: '', head: 'old', text: `V(${sub(NAMES[s])}) = ${fmt(old, 2)}` },
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < labs.length; i++) labs[i].ly = Math.max(labs[i].y, (labs[i - 1].ly ?? labs[i - 1].y) + 30);
  labs[0].ly = labs[0].y;
  const over = labs.at(-1).ly - (yBot + 6);
  if (over > 0) labs.forEach((l) => { l.ly -= over; });
  const seg = Math.abs(yN - yO);
  return (
    <svg className="dl9s-svg dl9s-td__line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`TD update of V(${NAMES[s]}): old ${fmt(old, 2)}, TD target ${fmt(target, 2)}, TD error ${fmt(target - old, 2)}, new estimate ${fmt(next, 2)} with alpha ${alpha.toFixed(2)}`}>
      <line x1={AX} y1={yTop - 6} x2={AX} y2={yBot + 6} className="dl9s-td__axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={AX - (v === 0 ? 8 : 4)} y1={toY(v)} x2={AX + (v === 0 ? 8 : 4)} y2={toY(v)} className="dl9s-td__tick" />
          <text x={AX - 12} y={toY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
        </g>
      ))}
      {/* δ: the bracket from the old estimate to the target; α δ: the part the update moves */}
      <g className="dl9s-fade">
        <line x1={BX} y1={yO} x2={BX} y2={yT} className="dl9s-td__delta" />
        <line x1={BX - 5} y1={yO} x2={BX + 5} y2={yO} className="dl9s-td__delta" />
        <line x1={BX - 5} y1={yT} x2={BX + 5} y2={yT} className="dl9s-td__delta" />
        <line x1={BX} y1={yO} x2={BX} y2={yN} className="dl9s-td__adelta" />
        <text x={BX - 10} y={(yO + yT) / 2 + 4} textAnchor="end" className="dl9s-t dl9s-t--b dl9s-t--ret">δ {sgn(target - old)}</text>
        {seg > 16 && <text x={BX + 8} y={(yO + yN) / 2 + 4} className="dl9s-t dl9s-t--xs dl9s-t--val">α δ</text>}
      </g>
      <line x1={BX + 6} y1={yO} x2={AX - 8} y2={yO} className="dl9s-td__lead" />
      <line x1={BX + 6} y1={yT} x2={AX - 12} y2={yT} className="dl9s-td__lead" />
      {/* the move along the axis */}
      <line x1={AX} y1={yO} x2={AX} y2={yN + (up ? 7 : -7)} className="dl9s-td__move" />
      <line x1={AX - 12} y1={yT} x2={AX + 12} y2={yT} className="dl9s-td__target" />
      <circle cx={AX} cy={yO} r={6} className="dl9s-td__old" />
      <circle cx={AX} cy={yN} r={6.5} className="dl9s-td__new" />
      {labs.map((l) => (
        <g key={l.key}>
          {Math.abs(l.ly - l.y) > 2 && <line x1={AX + 14} y1={l.y} x2={AX + 24} y2={l.ly - 4} className="dl9s-td__lead" />}
          <text x={AX + 26} y={l.ly - 2} className={`dl9s-t dl9s-t--xs ${l.cls}`}>{l.head}</text>
          <text x={AX + 26} y={l.ly + 11} className={`dl9s-t dl9s-t--m dl9s-td__lab ${l.cls}`}>{l.text}</text>
        </g>
      ))}
    </svg>
  );
}

export function TdLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const uid = useId().replace(/:/g, '');
  const [sim, setSim] = useState(INITIAL);
  const [alpha, setAlpha] = useState(OPEN_ALPHA);
  const [running, setRunning] = useState(false);
  const timer = useRef(0);
  const live = useRef(null);
  const gen = useRef(null);
  const aRef = useRef(OPEN_ALPHA);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const view = printing ? INITIAL : sim;
  const a = printing ? OPEN_ALPHA : alpha;
  const { V, t } = view;
  const u = tdUpdate(V[t.s], t.r, V[t.sp], a, GAMMA);
  const shownV = V.map((v, i) => (i === t.s ? u.next : v));

  const observe = () => {
    const cur = live.current ?? sim;
    if (!gen.current) gen.current = opening().R;
    const nextV = cur.V.slice();
    nextV[cur.t.s] = tdUpdate(cur.V[cur.t.s], cur.t.r, cur.V[cur.t.sp], aRef.current, GAMMA).next;
    const n = { V: nextV, t: sample(gen.current, cur.t.sp), n: cur.n + 1 };
    live.current = n;
    setSim(n);
  };
  const stop = () => { window.clearTimeout(timer.current); setRunning(false); };
  const auto = () => {
    setRunning(true);
    const ms = prefersReducedMotion() ? 1100 : 750;
    const tick = () => { observe(); timer.current = window.setTimeout(tick, ms); };
    tick();
  };
  const onAlpha = (v) => { aRef.current = v; setAlpha(v); };
  const reset = () => { stop(); live.current = null; gen.current = null; setSim(INITIAL); };

  const { STATES } = geom(narrow);
  const spSt = STATES[t.sp];
  const rCls = t.r > 0 ? 'dl9s-td__rpos' : t.r < 0 ? 'dl9s-td__rneg' : '';

  return (
    <Stage
      title="One transition, one small step"
      slides="slides 50–52"
      tryThis="Predict where the new V(s) lands, drag α, then observe the next transition."
      caption="Each observed transition moves $V(s)$ a fraction $\alpha$ of the way from its old estimate toward the TD target $r + \gamma V(s')$; the gap between them is the TD error $\delta$. The actions come from a random exploration policy (slide 51), so these estimates head for the values of that random policy."
      challenge={{ text: 'Set α so the estimate moves exactly halfway to the target.', done: Math.abs(a - 0.5) < 1e-9 }}
      own="random explorer, seeded · this page’s own run"
      maths={
        <>
          <MEq tex={"V_{k+1}(s) \\leftarrow (1-\\alpha) V_k(s) + \\alpha \\left( r + \\gamma V_k(s') \\right)"} />
          <MLine text={`This transition, $s = s_${t.s}$, $r = ${t.r}$, $s' = s_${t.sp}$: $(1 - ${a.toFixed(2)}) \\times ${fmt(V[t.s], 2)} + ${a.toFixed(2)} \\times (${t.r} + 0.90 \\times ${fmt(V[t.sp], 2)}) = ${fmt(u.next, 2)}$.`} />
          <MEq tex={"V_{k+1}(s) \\leftarrow V_k(s) + \\alpha\\, \\delta_k(s, r, s') \\quad \\text{with} \\quad \\delta_k(s, r, s') = r + \\gamma V_k(s') - V_k(s)"} />
          <MLine text={`TD error $\\delta = ${t.r} + 0.90 \\times ${fmt(V[t.sp], 2)} - ${fmt(V[t.s], 2)} = ${fmt(u.error, 2)}$, so $V_{k+1}(s_${t.s}) = ${fmt(V[t.s], 2)} + ${a.toFixed(2)} \\times ${fmt(u.error, 2)} = ${fmt(u.next, 2)}$: the same number.`} />
          <MLine text="Slide 52: like SGD, TD learning only truly converges if you gradually reduce the learning rate $\alpha$; with a fixed $\alpha$ the estimates keep bouncing around." />
          <p className="dl9s-mnote">For comparison, the values of the random exploration policy itself (this page’s own working: each state’s average over its possible actions of Σ T [R + 0.90 V]) are V(s₀) ≈ {fmt(V_RANDOM[0], 2)}, V(s₁) ≈ {fmt(V_RANDOM[1], 2)}, V(s₂) ≈ {fmt(V_RANDOM[2], 2)}.</p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-td${narrow ? ' dl9s-td--narrow' : ''}`}>
        <div className="dl9s-td__row">
          <div className="dl9s-td__mdp">
            <Mdp188 here={t.s} on={{ s: t.s, a: t.a }} compact={narrow} label={`Figure 18-8: the agent in ${NAMES[t.s]} took a${t.a} and landed in ${NAMES[t.sp]} with reward ${t.r}. Estimates: ${NAMES.map((n, i) => `${n} ${fmt(shownV[i], 2)}`).join(', ')}`}>
              <ValueFills V={shownV} compact={narrow} uid={uid} vmax={50} labels />
              <g className="dl9s-td__sp" aria-hidden="true">
                <circle cx={spSt.x} cy={spSt.y} r={28} />
                <text x={spSt.x - 24} y={spSt.y - 22} textAnchor="end" className="dl9s-t dl9s-t--b dl9s-t--obs dl9s-halo">s′</text>
              </g>
            </Mdp188>
          </div>
          <div className="dl9s-td__num">
            <p className="dl9s-td__obs" aria-live="polite">
              <span className="dl9s-td__k">transition {view.n + 1}</span>
              <span>
                <b className="dl9s-td__s">{sub(NAMES[t.s])}</b> <span className="dl9s-td__a">{sub(`a${t.a}`)}</span> → <b className="dl9s-td__s">{sub(NAMES[t.sp])}</b>, r = <b className={rCls}>{t.r > 0 ? `+${t.r}` : t.r < 0 ? `−${Math.abs(t.r)}` : '0'}</b>
              </span>
            </p>
            <NumberLine old={V[t.s]} target={u.target} next={u.next} alpha={a} s={t.s} sp={t.sp} />
          </div>
        </div>
        <div className="dl9s-td__ctl">
          <div className="dl9s-td__btns dl9s-noprint">
            <button type="button" className="dl9s-td__obsbtn" onClick={() => { stop(); observe(); }}>observe the next transition</button>
            <button type="button" className="dl9s-td__play" onClick={running ? stop : auto} aria-label={running ? 'Pause' : 'Keep observing transitions'}>
              <Icon name={running ? 'pause' : 'play'} size={14} />
            </button>
            <button type="button" className="dl9s-td__reset" onClick={reset}>reset</button>
          </div>
          <svg className="dl9s-svg dl9s-td__alpha" viewBox="0 0 340 66" role="group" aria-label="The learning rate alpha">
            <text x={24} y={16} className="dl9s-t dl9s-t--s">learning rate α</text>
            <Scrub x0={24} x1={316} y={44} value={a} min={0.01} max={1} step={0.01} big={0.1} onChange={onAlpha} label="Learning rate alpha" show={(v) => v.toFixed(2)} ticks={[0.01, 0.5, 1]} tickLabel={(v) => (v === 1 ? '1' : v.toFixed(2))} />
          </svg>
        </div>
      </div>
    </Stage>
  );
}
