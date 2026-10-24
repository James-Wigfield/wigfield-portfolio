import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine, MEq } from '../stage';
import { Scrub, Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion } from '../hooks';
import { valueIteration, T_188, R_188, ACTIONS_188, fmt, sub } from '../rl';
import { Rich } from '../Rich';
import Mdp188 from './Mdp188';
import { geom } from './mdp188Geom';
import './labsValueIter.css';

/* ============================================================================
   §11 · MDPs, THE BELLMAN OPTIMALITY EQUATION, VALUE ITERATION (slides 41–44)
   ----------------------------------------------------------------------------
   ValueIterLab   slide 44's update run on Figure 18-8 from V_0 = 0 with
                  γ = 0.90 (slide 48's value; the slides give value iteration
                  as an equation only, so the run is this page's own). Each
                  state fills with its estimate V_k(s) (the value colour),
                  and below the MDP the three estimates are drawn against k
                  with the k scrubber as the chart's own axis (▶ replays
                  0 → 50). Click a state: the maths drawer walks through its
                  update, one sum per possible action, then the max. No
                  policy is drawn (slide 45: state values don't say which
                  action to take; that is §12's Q-table).
   ========================================================================== */

const N_IT = 50;
const GAMMA = 0.9;
const RUN = valueIteration({ gamma: GAMMA, iterations: N_IT });
const VSTAR = RUN.V;
const VMAX = 55;
const NAMES = ['s0', 's1', 's2'];
const R_ST = 20; // Mdp188 draws its states with State's default radius
const FIRST_CLOSE = RUN.history.findIndex((V) => Math.abs(V[0] - VSTAR[0]) < 0.1);

// the update that produced V_k(s) from V_{k-1} (k ≥ 1): one sum per possible action
function updateOf(s, k) {
  const prev = RUN.history[k - 1];
  return ACTIONS_188[s].map((a) => {
    const terms = [0, 1, 2].filter((sp) => T_188[s][a][sp] > 0).map((sp) => ({ sp, p: T_188[s][a][sp], r: R_188[s][a][sp], v: prev[sp] }));
    return { a, terms, sum: terms.reduce((acc, t) => acc + t.p * (t.r + GAMMA * t.v), 0) };
  });
}

/* Each state of Mdp188 filled from the bottom with its value V(s) (the
   value colour; a negative value fills with the negative-reward colour),
   level = |V| / vmax. `show` = { s, text } puts a tip over one state;
   `labels` writes every state's value under the figure. Also used by
   labsTd.jsx. */
export function ValueFills({ V, compact, show = null, uid, vmax = VMAX, labels = false, H = 330 }) {
  const { STATES } = geom(compact);
  return (
    <g className="dl9s-vi__fills" aria-hidden="true">
      <defs>
        {STATES.map((st) => (
          <clipPath key={st.name} id={`${uid}-c${st.id}`}>
            <circle cx={st.x} cy={st.y} r={R_ST - 1.2} />
          </clipPath>
        ))}
      </defs>
      {STATES.map((st) => {
        const level = Math.max(0, Math.min(1, Math.abs(V[st.id]) / vmax));
        return (
          <g key={st.name} clipPath={`url(#${uid}-c${st.id})`}>
            <rect className={`dl9s-vi__fill${V[st.id] < 0 ? ' dl9s-vi__fill--neg' : ''}`} x={st.x - R_ST} y={st.y - R_ST} width={2 * R_ST} height={2 * R_ST} style={{ transformOrigin: `${st.x}px ${st.y + R_ST}px`, transform: `scaleY(${level})` }} />
          </g>
        );
      })}
      {STATES.map((st) => (
        <text key={`n${st.name}`} x={st.x} y={st.y + 5} textAnchor="middle" className="dl9s-vi__name">{sub(st.name)}</text>
      ))}
      {labels && STATES.map((st) => (
        <text key={`v${st.name}`} x={st.x} y={H - 10} textAnchor="middle" className="dl9s-t dl9s-t--m dl9s-vi__vlab">
          <tspan className="dl9s-t--val">V({sub(st.name)})</tspan> {fmt(V[st.id], 2)}
        </text>
      ))}
      {show !== null && (() => {
        const st = STATES[show.s];
        return <Tip x={st.x} y={st.y - R_ST - 4} text={show.text} />;
      })()}
    </g>
  );
}

function chartGeom(narrow) {
  return narrow
    ? { W: 340, H: 236, x0: 34, x1: 262, yTop: 22, yBot: 150, lab: 270, scrubY: 196 }
    : { W: 760, H: 214, x0: 56, x1: 640, yTop: 18, yBot: 132, lab: 650, scrubY: 176 };
}

function Chart({ k, narrow, onK, sel }) {
  const G = chartGeom(narrow);
  const toX = (i) => G.x0 + (i / N_IT) * (G.x1 - G.x0);
  const toY = (v) => G.yBot - (v / VMAX) * (G.yBot - G.yTop);
  const line = (s) => RUN.history.map((V, i) => `${i ? 'L' : 'M'}${toX(i).toFixed(1)} ${toY(V[s]).toFixed(1)}`).join(' ');
  const labY = [toY(VSTAR[0]), toY(VSTAR[1]) - 4, toY(VSTAR[2])];
  return (
    <svg className="dl9s-svg dl9s-vi__chart" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`The three value estimates against the iteration k. At k = ${k}: ${NAMES.map((n, s) => `${n} ${fmt(RUN.history[k][s], 2)}`).join(', ')}`}>
      {[0, 25, 50].map((v) => (
        <g key={v}>
          <line x1={G.x0} y1={toY(v)} x2={G.x1} y2={toY(v)} className="dl9s-grid-line" />
          <text x={G.x0 - 8} y={toY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
        </g>
      ))}
      <text x={G.x0} y={G.yTop - 6} className="dl9s-t dl9s-t--xs dl9s-t--val">Vₖ(s)</text>
      {[0, 1, 2].map((s) => (
        <path key={s} d={line(s)} className={`dl9s-line dl9s-line--val dl9s-vi__line${sel === s ? ' dl9s-vi__line--sel' : ''}`} />
      ))}
      <line x1={toX(k)} y1={G.yTop - 2} x2={toX(k)} y2={G.yBot + 4} className="dl9s-today" />
      {[0, 1, 2].map((s) => (
        <circle key={`d${s}`} cx={toX(k)} cy={toY(RUN.history[k][s])} r={4.5} className="dl9s-vi__dot" />
      ))}
      {[0, 1, 2].map((s) => (
        <text key={`l${s}`} x={G.lab} y={labY[s] + 4} className={`dl9s-t dl9s-t--s${sel === s ? ' dl9s-t--b' : ''}`}>
          <tspan className="dl9s-t--obs dl9s-t--b">{sub(NAMES[s])}</tspan> <tspan className="dl9s-t--m">{fmt(RUN.history[k][s], 2)}</tspan>
        </text>
      ))}
      <Scrub x0={G.x0} x1={G.x1} y={G.scrubY} value={k} min={0} max={N_IT} step={1} big={10} onChange={onK} label="Iteration k of value iteration" ticks={[0, 10, 20, 30, 40, 50]} />
      <text x={G.x1 + 14} y={G.scrubY + 4} className="dl9s-t dl9s-t--xs">k</text>
    </svg>
  );
}

export function ValueIterLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const uid = useId().replace(/:/g, '');
  const [k, setK] = useState(N_IT);
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const kk = printing ? N_IT : k;
  const V = RUN.history[kk];

  const stop = () => { window.clearTimeout(timer.current); setPlaying(false); };
  const onK = (v) => { stop(); setK(v); if (v === FIRST_CLOSE) setBest(true); };
  const play = () => {
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) { setK(N_IT); return; }
    setPlaying(true);
    let i = 0;
    setK(0);
    const tick = () => {
      i += 1;
      setK(i);
      if (i < N_IT) timer.current = window.setTimeout(tick, i < 12 ? 150 : 45);
      else setPlaying(false);
    };
    timer.current = window.setTimeout(tick, 300);
  };

  // pointer / keyboard focus on a state shows its number
  const stateOf = (el) => {
    const m = /State s(\d)/.exec(el?.closest?.('.dl9s-state')?.getAttribute('aria-label') ?? '');
    return m ? Number(m[1]) : null;
  };
  const shown = hover ?? sel;

  // the drawer: the update that produced V_k(s) (or V_1 when k = 0)
  const ku = Math.max(1, kk);
  const parts = updateOf(sel, ku);
  const top = Math.max(...parts.map((p) => p.sum));

  return (
    <Stage
      title="Value iteration fills in the state values"
      slides="slides 41–44"
      tryThis="Predict which state ends up most valuable, press ▶, then click s₀ and open the maths."
      caption={`Each state’s fill (and line) is its estimate $V_k(s)$ after $k$ iterations of slide 44’s update from $V_0(s) = 0$, with $\\gamma = 0.90$ as in slide 48. The estimates settle within about 20 iterations, at $V(s_0) \\approx ${fmt(VSTAR[0], 2)}$, $V(s_1) = ${fmt(VSTAR[1], 2)}$ and $V(s_2) \\approx ${fmt(VSTAR[2], 2)}$.`}
      challenge={{ text: `Find the first k where Vₖ(s₀) is within 0.1 of ${fmt(VSTAR[0], 2)}.`, done: best }}
      own="the run (the slides give value iteration as an equation only) · this page’s own"
      maths={
        <>
          <MEq tex={"V^*(s) = \\max_a \\sum_{s'} T(s, a, s') \\left[ R(s, a, s') + \\gamma V^*(s') \\right] \\quad \\text{for all } s"} />
          <MEq tex={"V_{k+1}(s) \\leftarrow \\max_a \\sum_{s'} T(s, a, s') \\left[ R(s, a, s') + \\gamma V_k(s') \\right] \\quad \\text{for all } s"} />
          <MLine text={`State $s_${sel}$, computing $V_{${ku}}(s_${sel})$ from $V_{${ku - 1}}$ ($\\gamma = 0.90$), one sum per possible action:`} />
          {parts.map((p) => (
            <MLine
              key={p.a}
              text={`$a_${p.a}$: ${p.terms.map((t) => `$${t.p}\\,[${t.r} + 0.90 \\times ${fmt(t.v, 2)}]$`).join(' + ')} $= ${fmt(p.sum, 2)}$${p.sum === top && parts.length > 1 ? ' ← the max' : ''}`}
            />
          ))}
          <MLine text={`So $V_{${ku}}(s_${sel}) = ${parts.length > 1 ? `\\max(${parts.map((p) => fmt(p.sum, 2)).join(',\\ ')}) = ` : ''}${fmt(top, 2)}$${sel === 2 ? ' ($s_2$ has only one possible action, $a_1$)' : ''}.`} />
          <p className="dl9s-mnote"><Rich text={`After 50 iterations this page’s run gives $V(s_0) = ${VSTAR[0].toFixed(8)}$, $V(s_1) = ${VSTAR[1].toFixed(8)}$, $V(s_2) = ${VSTAR[2].toFixed(8)}$: the best Q-value in each row of slide 49’s Q-table. The state values alone don’t say which action reaches them (slide 45); the Q-values do (§12).`} /></p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-vi${narrow ? ' dl9s-vi--narrow' : ''}`}>
        <p className="dl9s-vi__k">
          <span className="dl9s-vi__kname">V<sub>{kk}</sub>(s)</span>
          <span className="dl9s-vi__kmeta">γ = 0.90 · iteration {kk} of {N_IT}</span>
        </p>
        <div
          className="dl9s-vi__mdp"
          onPointerOver={(e) => setHover(stateOf(e.target))}
          onPointerLeave={() => setHover(null)}
          onFocus={(e) => setHover(stateOf(e.target))}
          onBlur={() => setHover(null)}
        >
          <Mdp188 here={sel} onState={setSel} compact={narrow} label={`Figure 18-8 with each state's value estimate after ${kk} iterations: ${NAMES.map((n, s) => `${n} ${fmt(V[s], 2)}`).join(', ')}`}>
            <ValueFills V={V} compact={narrow} uid={uid} show={printing ? null : { s: shown, text: `${sub(`V${kk}`)}(${sub(NAMES[shown])}) = ${fmt(V[shown], 2)}` }} />
          </Mdp188>
        </div>
        <div className="dl9s-vi__ctl">
          <button type="button" className="dl9s-vi__play dl9s-noprint" onClick={playing ? stop : play} aria-label={playing ? 'Pause' : 'Replay the 50 iterations from k = 0'}>
            <Icon name={playing ? 'pause' : 'play'} size={14} />
          </button>
          <Chart k={kk} narrow={narrow} onK={onK} sel={sel} />
        </div>
      </div>
    </Stage>
  );
}
