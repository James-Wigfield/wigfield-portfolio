import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine, MEq } from '../stage';
import { State, Trans } from '../svgParts';
import { weightFill } from '../svgFill';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion } from '../hooks';
import { CHAIN_187, markovStep, rng, sub } from '../rl';
import './labsMarkov.css';

/* ============================================================================
   §10 · MARKOV CHAINS  (slides 39–40)
   ----------------------------------------------------------------------------
   MarkovLab   Figure 18-7 in the labs' vocabulary (s0 left, s1 centre, s2
               right, s3 below between s0 and s1; arrow thickness = the
               probability) and, beside it, slide 40's state transition
               matrix. A token hops with markovStep and this page's seeded
               RNG (▶ run, or one step at a time; under reduced motion it
               just jumps). The token's row of the matrix is highlighted,
               every row shows "= 1", and hovering / focusing a cell lights
               its arrow and reads it out the way slide 40 counts (rows and
               columns from 1, states from 0). Click a state to drop the
               token there. s3 only leads to itself: the token stays.
   ========================================================================== */

const NAMES = ['s0', 's1', 's2', 's3'];
const SEED = 5;
const OPEN_HOPS = 4; // the opening trail: seed 5 gives s0 → s0 → s1 → s2 → s1
const P = CHAIN_187;

function chainGeom(narrow) {
  if (narrow) {
    return { W: 340, H: 300, r: 21, S: [[88, 92], [200, 92], [306, 92], [144, 192]] };
  }
  return { W: 470, H: 306, r: 22, S: [[104, 100], [264, 100], [410, 100], [184, 204]] };
}

/* the arrows of Figure 18-7: [from, to, kind, …] */
function arrows(G) {
  const { S, r } = G;
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = S;
  const d = 9;
  const dx = Math.sqrt(r * r - d * d);
  return [
    { i: 0, j: 0, loop: { cx: x0, cy: y0, dir: Math.PI }, lab: [-r - 30, -36] },
    { i: 0, j: 1, from: [x0 + r, y0], to: [x1 - r, y1], bend: 0, lab: [0, -8] },
    { i: 0, j: 3, from: [x0 + 4, y0 + r], to: [x3 - r, y3 - 2], bend: 15, lab: [-16, 12] },
    { i: 1, j: 2, from: [x1 + dx, y1 - d], to: [x2 - dx, y2 - d], bend: 0, lab: [0, -8] },
    { i: 2, j: 1, from: [x2 - dx, y2 + d], to: [x1 + dx, y1 + d], bend: 0, lab: [0, 17] },
    { i: 1, j: 3, from: [x1 - 4, y1 + r], to: [x3 + r, y3 - 2], bend: -15, lab: [16, 12] },
    { i: 3, j: 3, loop: { cx: x3, cy: y3, dir: Math.PI / 2 }, lab: [40, r + 34] },
  ];
}

/* a self-loop (Trans only draws quadratic curves between two points): a
   cubic leaving and re-entering the circle around the direction `dir` */
function SelfLoop({ cx, cy, r, dir, p, state = '', lab }) {
  const spread = 0.45;
  const at = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const [sx, sy] = at(dir - spread, r);
  const [ex, ey] = at(dir + spread, r + 1);
  const [c1x, c1y] = at(dir - 0.62, r + 56);
  const [c2x, c2y] = at(dir + 0.62, r + 56);
  const a = Math.atan2(ey - c2y, ex - c2x);
  const head = 7;
  const hp = (dd) => `${ex - head * Math.cos(a + dd)},${ey - head * Math.sin(a + dd)}`;
  const bx = ex - head * 0.9 * Math.cos(a);
  const by = ey - head * 0.9 * Math.sin(a);
  const st = state ? ` dl9s-tr--${state}` : '';
  const sh = state ? ` dl9s-trhead--${state}` : '';
  return (
    <g>
      <path className={`dl9s-tr${st}`} d={`M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${bx} ${by}`} style={{ strokeWidth: 1.1 + 3.4 * p }} />
      <polygon className={`dl9s-trhead${sh}`} points={`${hp(0.42)} ${ex},${ey} ${hp(-0.42)}`} />
      <text x={cx + lab[0]} y={cy + lab[1]} textAnchor="middle" className="dl9s-prob dl9s-halo">{p.toFixed(1)}</text>
    </g>
  );
}

function Chain({ G, here, last, hot, onDrop, trapped }) {
  const [tx, ty] = G.S[here];
  return (
    <svg className="dl9s-svg dl9s-mk__chain" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Figure 18-7, a Markov chain with four states. The token is in ${NAMES[here]}.`}>
      {arrows(G).map((t) => {
        const isHot = hot && hot.i === t.i && hot.j === t.j;
        const isLast = last && last.i === t.i && last.j === t.j;
        const state = isHot || isLast ? 'on' : hot ? 'dim' : '';
        const p = P[t.i][t.j];
        return t.loop ? (
          <SelfLoop key={`${t.i}${t.j}`} {...t.loop} r={G.r} p={p} state={state} lab={t.lab} />
        ) : (
          <Trans key={`${t.i}${t.j}`} x1={t.from[0]} y1={t.from[1]} x2={t.to[0]} y2={t.to[1]} bend={t.bend} p={p} state={state} lab={t.lab} />
        );
      })}
      {G.S.map(([x, y], i) => (
        <State
          key={NAMES[i]}
          x={x}
          y={y}
          r={G.r}
          name={NAMES[i]}
          on={here === i}
          absorbing={i === 3}
          onPick={() => onDrop(i)}
          label={`Drop the token in ${NAMES[i]}`}
        />
      ))}
      <circle className={`dl9s-token dl9s-mk__token${trapped ? ' dl9s-mk__token--trap' : ''}`} r={7.5} cx={0} cy={0} style={{ transform: `translate(${tx}px, ${ty - G.r - 11}px)` }} />
    </svg>
  );
}

const MC = 46; // matrix cell
const MX = 58;
const MY = 46;

function Matrix({ row, hot, onHot }) {
  const W = MX + 4 * MC + 48;
  const H = MY + 4 * MC + 8;
  return (
    <svg className="dl9s-svg dl9s-mk__matrix" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Slide 40's state transition matrix: rows are source states, columns destination states, each row sums to 1">
      <text x={MX + 2 * MC} y={12} textAnchor="middle" className="dl9s-t dl9s-t--xs">to (destination state)</text>
      {NAMES.map((n, j) => (
        <text key={`c${n}`} x={MX + j * MC + MC / 2} y={MY - 10} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--obs">{sub(n)}</text>
      ))}
      <text x={12} y={MY + 2 * MC} textAnchor="middle" transform={`rotate(-90 12 ${MY + 2 * MC})`} className="dl9s-t dl9s-t--xs">from (source state)</text>
      {row !== null && <rect className="dl9s-rowband dl9s-mk__band" x={MX - 40} y={MY + row * MC - 3} width={4 * MC + 82} height={MC + 6} rx={6} />}
      {P.map((r, i) => (
        <g key={`r${i}`}>
          <text x={MX - 12} y={MY + i * MC + MC / 2 + 5} textAnchor="end" className="dl9s-t dl9s-t--b dl9s-t--obs">{sub(NAMES[i])}</text>
          {r.map((p, j) => {
            const isHot = hot && hot.i === i && hot.j === j;
            const ex = i === 1 && j === 2;
            const set = () => onHot({ i, j });
            return (
              <g
                key={`c${i}${j}`}
                className={`dl9s-mk__cell${isHot ? ' dl9s-mk__cell--hot' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Row ${i + 1}, column ${j + 1} counting from 1: from ${NAMES[i]} to ${NAMES[j]}, probability ${p.toFixed(1)}`}
                onPointerEnter={set}
                onPointerLeave={() => onHot(null)}
                onFocus={set}
                onBlur={() => onHot(null)}
                onClick={set}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(); } }}
              >
                <rect className="dl9s-cell" x={MX + j * MC + 1.5} y={MY + i * MC + 1.5} width={MC - 3} height={MC - 3} rx={4} style={{ fill: p > 0 ? weightFill('pol', 0.15 + 0.75 * p) : 'var(--dl9s-floor)' }} />
                <text x={MX + j * MC + MC / 2} y={MY + i * MC + MC / 2 + 4.5} textAnchor="middle" className={`dl9s-cellnum${p >= 0.65 ? ' dl9s-cellnum--inv' : ''}${p === 0 ? ' dl9s-cellnum--inf' : ''}`}>{p.toFixed(1)}</text>
                {ex && <circle cx={MX + j * MC + MC - 7} cy={MY + i * MC + 7} r={3.2} className="dl9s-mk__slidedot" />}
              </g>
            );
          })}
          <text x={MX + 4 * MC + 10} y={MY + i * MC + MC / 2 + 5} className="dl9s-t dl9s-t--m dl9s-t--s">= 1</text>
        </g>
      ))}
      <rect className="dl9s-grid-frame dl9s-grid-frame--pol" x={MX - 0.5} y={MY - 0.5} width={4 * MC + 1} height={4 * MC + 1} rx={4} />
    </svg>
  );
}

// the opening: seed 5's first hops from s0
function opening() {
  const R = rng(SEED);
  const path = [0];
  let s = 0;
  let u = 0;
  for (let k = 0; k < OPEN_HOPS; k++) {
    u = R.next();
    s = markovStep(P, s, u);
    path.push(s);
  }
  return { R, path, u };
}
const OPEN = opening();

const INITIAL = { s: OPEN.path.at(-1), path: OPEN.path, visits2: OPEN.path.filter((s, k) => k > 0 && s === 2).length, last: { i: OPEN.path.at(-2), j: OPEN.path.at(-1), u: OPEN.u } };

export function MarkovLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [sim, setSim] = useState(INITIAL);
  const [hot, setHot] = useState(null);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(0);
  const timer = useRef(0);
  const live = useRef(null); // the latest sim, written by the handlers only
  const gen = useRef(null); // the seeded RNG, carried on from the opening hops
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const view = printing ? INITIAL : sim;
  const trapped = view.s === 3;
  const G = chainGeom(narrow);

  const hop = () => {
    const cur = live.current ?? sim;
    if (!gen.current) gen.current = opening().R;
    const u = gen.current.next();
    const next = markovStep(P, cur.s, u);
    const visits2 = cur.visits2 + (next === 2 ? 1 : 0);
    const n = { s: next, path: [...cur.path, next].slice(-12), visits2, last: { i: cur.s, j: next, u } };
    live.current = n;
    setSim(n);
    setBest((b) => Math.max(b, visits2));
    return next;
  };

  const stop = () => { window.clearTimeout(timer.current); setRunning(false); };
  const run = () => {
    if ((live.current ?? sim).s === 3) return;
    setRunning(true);
    const ms = prefersReducedMotion() ? 900 : 620;
    const tick = () => {
      const next = hop();
      if (next === 3) setRunning(false);
      else timer.current = window.setTimeout(tick, ms);
    };
    tick();
  };
  const stepOnce = () => { stop(); if ((live.current ?? sim).s !== 3) hop(); };
  const drop = (i) => {
    stop();
    const n = { s: i, path: [i], visits2: 0, last: null };
    live.current = n;
    setSim(n);
  };
  const reset = () => { stop(); live.current = INITIAL; gen.current = null; setSim(INITIAL); };

  const rowNow = hot ? hot.i : view.s;
  const readout = hot
    ? `row ${hot.i + 1}, column ${hot.j + 1} counting from 1${hot.i === 1 && hot.j === 2 ? ' (slide 40)' : ''} = row ${sub(NAMES[hot.i])}, column ${sub(NAMES[hot.j])}: ${sub(NAMES[hot.i])} → ${sub(NAMES[hot.j])} with probability ${P[hot.i][hot.j].toFixed(1)}`
    : `row ${sub(NAMES[view.s])}: ${P[view.s].map((p) => p.toFixed(1)).join(' + ')} = 1`;
  const cum = view.last ? P[view.last.i].reduce((acc, p) => [...acc, (acc.at(-1) ?? 0) + p], []) : null;

  return (
    <Stage
      title="A token with no memory"
      slides="slides 39–40"
      tryThis="Predict the token’s next state from s₁, press step, then hover the 0.9 in the matrix."
      caption="Each hop depends only on the state the token is in (no memory): it picks the next state with that state’s row of probabilities, which is why every row sums to 1. $s_3$ only leads to itself, so once the token gets there it stays."
      challenge={{ text: 'Get the token to s₂ three times before it is trapped in s₃.', done: best >= 3 }}
      own="the hops: this page’s seeded random numbers"
      maths={
        <>
          <MEq tex={'\\begin{bmatrix} 0.7 & 0.2 & 0.0 & 0.1 \\\\ 0.0 & 0.0 & 0.9 & 0.1 \\\\ 0.0 & 1.0 & 0.0 & 0.0 \\\\ 0.0 & 0.0 & 0.0 & 1.0 \\end{bmatrix}'} />
          <MLine text="Rows are the source states and columns the destination states, both in the order $s_0, s_1, s_2, s_3$ (slide 40). Every row sums to 1: $0.7 + 0.2 + 0.0 + 0.1$, $0.0 + 0.0 + 0.9 + 0.1$, $0.0 + 1.0 + 0.0 + 0.0$, $0.0 + 0.0 + 0.0 + 1.0$." />
          <MLine text="Slide 40’s example, “(row 2, column 3) has probability = 0.9”, counts rows and columns from 1 but states from 0: row 2 is $s_1$ and column 3 is $s_2$ (in Python, `P[1][2]`)." />
          {view.last && cum ? (
            <MLine text={`The last hop, from $s_${view.last.i}$: this page’s random number $u = ${view.last.u.toFixed(3)}$; the row’s running sums are $${cum.map((c) => c.toFixed(1)).join(',\\ ')}$, and the token goes to the first column whose running sum is above $u$: $s_${view.last.j}$.`} />
          ) : (
            <MLine text="Press step: each hop draws a random number $u$ between 0 and 1 and goes to the first column of the current row whose running sum is above $u$." />
          )}
        </>
      }
    >
      <div ref={wrap} className={`dl9s-mk${narrow ? ' dl9s-mk--narrow' : ''}`}>
        <div className="dl9s-floorrow dl9s-mk__ctl">
          <div className="dl9s-mk__btns">
            <button type="button" className="dl9s-mk__play dl9s-noprint" onClick={running ? stop : run} disabled={trapped && !running} aria-label={running ? 'Pause' : 'Run: hop until the token is trapped in s3'}>
              <Icon name={running ? 'pause' : 'play'} size={14} />
            </button>
            <button type="button" className="dl9s-mk__btn dl9s-noprint" onClick={stepOnce} disabled={trapped}>step</button>
            <button type="button" className="dl9s-mk__btn dl9s-mk__btn--quiet dl9s-noprint" onClick={reset}>reset</button>
          </div>
          <p className="dl9s-mk__count" aria-live="polite">
            hops <b>{view.path.length - 1}</b> · s₂ visits <b>{view.visits2}</b>
          </p>
        </div>
        <div className="dl9s-mk__row">
          <div className="dl9s-mk__left">
            <Chain G={G} here={view.s} last={view.last} hot={hot} onDrop={drop} trapped={trapped} />
            <p className="dl9s-mk__path" aria-label={`Path: ${view.path.map((s) => NAMES[s]).join(', ')}`}>
              {view.path.map((s, k) => (
                <span key={k} className={k === view.path.length - 1 ? 'dl9s-mk__now' : ''}>{k > 0 && <i aria-hidden="true">→</i>}{sub(NAMES[s])}</span>
              ))}
            </p>
            {trapped && <p className="dl9s-mk__trap">in s₃ for good · click a state to drop the token elsewhere</p>}
          </div>
          <div className="dl9s-mk__right">
            <Matrix row={rowNow} hot={hot} onHot={setHot} />
            <p className="dl9s-mk__read" aria-live="polite">{readout}</p>
          </div>
        </div>
      </div>
    </Stage>
  );
}
