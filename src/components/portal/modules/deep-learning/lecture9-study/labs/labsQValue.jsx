import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine, MEq } from '../stage';
import { HatchDef, Scrub, Tip } from '../svgParts';
import { cellFill } from '../svgFill';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion } from '../hooks';
import { qValueIteration, argmaxRows, T_188, R_188, ACTIONS_188, fmt, sub } from '../rl';
import { PRINTED } from '../slideData';
import Mdp188 from './Mdp188';
import './labsQValue.css';

/* ============================================================================
   §12 · Q-VALUES AND Q-VALUE ITERATION  (slides 45–49)
   ----------------------------------------------------------------------------
   QTableLab   slide 48's loop on Figure 18-8, live: the 3 × 3 Q-table as a
               heatmap (impossible actions hatched, −∞), the argmax policy
               drawn on the MDP (the chosen action and its arrows in the
               action colour). Opens on slide 49's result: γ = 0.90 after 50
               iterations, policy [a0, a0, a1]. Drag the iteration k (or ▶
               to replay 0 → 50) and γ (0.80–0.99; the slides' 0.90 and
               0.95 are marked). Raise γ past ≈ 0.948 and s1's best action
               flips to a2: "going into the fire!" (slide 49). Click a cell
               to walk its update through in the maths drawer.
   ========================================================================== */

const N_IT = 50;
const CELL_W = 74;
const CELL_H = 48;
const GX = 54;
const GY = 46;
const NAMES = ['s0', 's1', 's2'];
const POSSIBLE = ACTIONS_188.flatMap((as, s) => as.map((a) => [s, a]));
const n8 = (v) => (v === -Infinity ? '−inf' : v.toFixed(8));

function QTable({ Q, best, sel, onSel, hover, onHover, narrow }) {
  const max = Math.max(1, ...Q.flat().filter(Number.isFinite).map(Math.abs));
  const W = GX + 3 * CELL_W + (narrow ? 64 : 92);
  const tipCell = hover ? Q[hover.s][hover.a] : null;
  return (
    <svg className="dl9s-svg dl9s-qt__table" viewBox={`0 0 ${W} ${GY + 3 * CELL_H + 30}`} role="group" aria-label={`Q-table: ${Q.map((r, s) => `${NAMES[s]} ${r.map((v, a) => `a${a} ${fmt(v, 1)}`).join(', ')}`).join('; ')}`}>
      <HatchDef id="dl9s-qt-hatch" />
      {[0, 1, 2].map((a) => (
        <text key={`c${a}`} x={GX + a * CELL_W + CELL_W / 2} y={GY - 12} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--act">{sub(`a${a}`)}</text>
      ))}
      {Q.map((row, s) => (
        <g key={`r${s}`}>
          <text x={GX - 12} y={GY + s * CELL_H + CELL_H / 2 + 5} textAnchor="end" className="dl9s-t dl9s-t--b dl9s-t--obs">{sub(NAMES[s])}</text>
          {row.map((v, a) => {
            const inf = v === -Infinity;
            const isBest = best[s] === a;
            const isSel = sel.s === s && sel.a === a;
            const x = GX + a * CELL_W;
            const y = GY + s * CELL_H;
            const pick = () => onSel({ s, a });
            return (
              <g
                key={`c${s}${a}`}
                className={`dl9s-qt__cell${inf ? ' dl9s-qt__cell--inf' : ''}${isSel ? ' dl9s-qt__cell--sel' : ''}`}
                {...(inf ? {} : {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': isSel,
                  'aria-label': `Q(${NAMES[s]}, a${a}) = ${fmt(v, 2)}${isBest ? ', the best action here' : ''}. Explain its update`,
                  onClick: pick,
                  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } },
                  onPointerEnter: () => onHover({ s, a }),
                  onPointerLeave: () => onHover(null),
                })}
              >
                <rect className="dl9s-cell" x={x + 1.5} y={y + 1.5} width={CELL_W - 3} height={CELL_H - 3} rx={4} style={{ fill: inf ? 'url(#dl9s-qt-hatch)' : cellFill('val', v, max) }} />
                {isBest && <rect className="dl9s-qt__best" x={x + 3.5} y={y + 3.5} width={CELL_W - 7} height={CELL_H - 7} rx={3} />}
                <text x={x + CELL_W / 2} y={y + CELL_H / 2 + 5} textAnchor="middle" className={`dl9s-cellnum${inf ? ' dl9s-cellnum--inf' : Math.abs(v) / max > 0.55 ? ' dl9s-cellnum--inv' : ''}`}>{inf ? '−∞' : fmt(v, 1)}</text>
              </g>
            );
          })}
          <text x={GX + 3 * CELL_W + 12} y={GY + s * CELL_H + CELL_H / 2 + 5} className="dl9s-t dl9s-t--b dl9s-t--pol">{narrow ? `→ ${sub(`a${best[s]}`)}` : `best: ${sub(`a${best[s]}`)}`}</text>
        </g>
      ))}
      <rect className="dl9s-grid-frame dl9s-grid-frame--val" x={GX - 0.5} y={GY - 0.5} width={3 * CELL_W + 1} height={3 * CELL_H + 1} rx={4} />
      {tipCell !== null && hover && <Tip x={GX + hover.a * CELL_W + CELL_W / 2} y={GY + hover.s * CELL_H + 6} text={n8(tipCell)} />}
    </svg>
  );
}

export function QTableLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [gamma, setGamma] = useState(0.9);
  const [k, setK] = useState(N_IT);
  const [sel, setSel] = useState({ s: 1, a: 2 });
  const [hover, setHover] = useState(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = useMemo(() => qValueIteration({ gamma, iterations: N_IT }), [gamma]);
  const kk = printing ? N_IT : k;
  const gg = printing ? 0.9 : gamma;
  const Q = printing ? qValueIteration({ gamma: 0.9, iterations: N_IT }).history[N_IT] : run.history[kk];
  const best = argmaxRows(Q);
  const flipped = !printing && kk === N_IT && best[1] === 2;

  const play = () => {
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) { setK(N_IT); return; }
    setPlaying(true);
    let i = 0;
    setK(0);
    const tick = () => {
      i += 1;
      setK(i);
      if (i < N_IT) timer.current = window.setTimeout(tick, i < 12 ? 140 : 45);
      else setPlaying(false);
    };
    timer.current = window.setTimeout(tick, 300);
  };
  const stop = () => { window.clearTimeout(timer.current); setPlaying(false); };
  const onK = (v) => { stop(); setK(v); };

  // the selected cell's update, from Q_{k−1}
  const prev = kk > 0 ? run.history[kk - 1] : null;
  const s = sel.s;
  const a = sel.a;
  const terms = [0, 1, 2].map((sp) => ({ sp, p: T_188[s][a][sp], r: R_188[s][a][sp], m: prev ? Math.max(...prev[sp]) : 0 }));
  const live = terms.filter((t) => t.p > 0);

  const controls = narrow ? { w: 340, h: 166, k: [36, 304, 50], g: [36, 304, 126] } : { w: 700, h: 96, k: [70, 310, 52], g: [400, 650, 52] };

  return (
    <Stage
      title="The Q-table fills in, iteration by iteration"
      slides="slides 46–49"
      tryThis="Predict s₁’s best action, then drag γ to the right and watch s₁’s row: when does the agent choose the fire?"
      caption={`Each cell is $Q_k(s, a)$ after $k$ iterations of slide 48’s loop (hatched: impossible actions, $-\\infty$). The magenta arrows are the policy $\\pi^*(s) = \\text{argmax}_a\\, Q^*(s, a)$: the outlined cell in each row (its largest Q-value).`}
      challenge={{ text: 'Find the γ where s₁’s best action flips to a₂ (“going into the fire!”).', done: flipped }}
      own={null}
      maths={
        <>
          <MEq tex={"Q_{k+1}(s,a) \\leftarrow \\sum_{s'} T(s,a,s')\\left[R(s,a,s') + \\gamma \\max_{a'} Q_k(s',a')\\right] \\quad \\text{for all } (s,a)"} />
          {kk === 0 ? (
            <MLine text="At $k = 0$ every possible Q-value is 0 and the impossible ones are $-\infty$ (slide 48’s `np.full((3, 3), -np.inf)`, then 0.0 for the possible actions)." />
          ) : (
            <MLine
              text={`Cell $(s_${s}, a_${a})$ at $k = ${kk}$, $\\gamma = ${gg.toFixed(2)}$: ${live.map((t) => `$${t.p}\\,[${t.r} + ${gg.toFixed(2)} \\times ${fmt(t.m, 2)}]$`).join(' + ')} $= ${fmt(Q[s][a], 4)}$ (each $\\max_{a'} Q_{${kk - 1}}(s', a')$ is the best cell in row $s'$ one iteration earlier).`}
            />
          )}
          <MEq tex={'\\pi^*(s) = \\operatorname*{argmax}_{a} Q^*(s,a)'} />
          <MLine text={`Here, row by row: $\\text{argmax} = [${best.join(', ')}]$, i.e. $s_0 \\to a_${best[0]}$, $s_1 \\to a_${best[1]}$, $s_2 \\to a_${best[2]}$. Slide 49 prints \`array([0, 0, 1])\` for $\\gamma = 0.90$ and \`array([0, 2, 1])\` for $\\gamma = 0.95$.`} />
          <MLine text={`Slide 49 prints, for $\\gamma = 0.90$ after 50 iterations: ${PRINTED.qValues.text}. This page’s run of the same loop: ${qValueIteration({ gamma: 0.9, iterations: N_IT }).Q.map((r) => `[${r.map(n8).join(', ')}]`).join(', ')}.`} />
          <p className="dl9s-mnote">All six possible cells match the slide to its printed digits except $Q(s_0, a_1)$: 50 iterations give 17.0270270245 (17.02702702 at numpy’s 8 decimals), while the slide prints 17.02702703, the fully converged value $630/37 = 17.027027027\ldots$ (see the Slide check above).</p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-qt${narrow ? ' dl9s-qt--narrow' : ''}`}>
        <div className="dl9s-qt__row">
          <div className="dl9s-qt__mdp">
            <Mdp188 policy={best} compact={narrow} label={`Figure 18-8 with the policy drawn: s0 takes a${best[0]}, s1 takes a${best[1]}, s2 takes a${best[2]}`} />
          </div>
          <div className="dl9s-qt__tab">
            <p className="dl9s-qt__k">
              <span className="dl9s-qt__kname">Q<sub>{kk}</sub>(s, a)</span>
              <span className="dl9s-qt__kmeta">γ = {gg.toFixed(2)} · iteration {kk} of {N_IT}</span>
            </p>
            <QTable Q={Q} best={best} sel={sel} onSel={setSel} hover={hover} onHover={setHover} narrow={narrow} />
          </div>
        </div>
        <div className="dl9s-qt__ctl">
          <button type="button" className="dl9s-qt__play dl9s-noprint" onClick={playing ? stop : play} aria-label={playing ? 'Pause' : 'Replay the 50 iterations from k = 0'}>
            <Icon name={playing ? 'pause' : 'play'} size={14} />
          </button>
          <svg className="dl9s-svg" viewBox={`0 0 ${controls.w} ${controls.h}`} role="group" aria-label="Controls: the iteration k and the discount factor gamma">
            <text x={controls.k[0]} y={controls.k[2] - 34} className="dl9s-t dl9s-t--s">iteration k</text>
            <Scrub x0={controls.k[0]} x1={controls.k[1]} y={controls.k[2]} value={kk} min={0} max={N_IT} step={1} big={10} onChange={onK} label="Iteration k of Q-value iteration" ticks={[0, 10, 20, 30, 40, 50]} />
            <text x={controls.g[0]} y={controls.g[2] - 34} className="dl9s-t dl9s-t--s dl9s-t--ret">discount factor γ · slide 49 tries 0.90 and 0.95</text>
            <Scrub
              x0={controls.g[0]}
              x1={controls.g[1]}
              y={controls.g[2]}
              value={gg}
              min={0.8}
              max={0.99}
              step={0.01}
              big={0.05}
              onChange={setGamma}
              label="Discount factor gamma"
              show={(v) => v.toFixed(2)}
              ticks={[0.8, 0.99]}
              tickLabel={(v) => v.toFixed(2)}
              marks={[{ v: 0.9, label: '0.90' }, { v: 0.95, label: '0.95' }]}
            />
          </svg>
        </div>
      </div>
    </Stage>
  );
}
