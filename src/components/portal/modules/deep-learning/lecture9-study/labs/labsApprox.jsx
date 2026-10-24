import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { useStory } from '../story';
import { Arrow } from '../svgParts';
import { useWidth } from '../useWidth';
import { paramCountOf, fmt } from '../rl';
import { approxExample } from './labsDqnMath';
import './labsApprox.css';

/* ============================================================================
   §15 · APPROXIMATE Q-LEARNING  (slides 58–60)
   ----------------------------------------------------------------------------
   ApproxLab   story mode building slide 60's target (Eq. 18-7)
               y(s, a) = r + γ max_a' Q_θ(s', a') with real numbers: this
               page's own trained DQN (../data/dqnRun.js, loaded lazily,
               4 → 32 → 32 → 2, 1,282 parameters) on one experience from
               this page's port of CartPole, γ = 0.95 (slide 63), r = 1.0.
               Beats: why approximate (a Q-table needs a cell per (s, a);
               Q_θ has a fixed θ) → one experience (s, a, r, s′) → the DQN
               on s′, one Q-value per action → select the highest and
               discount it by γ → add r: the target → Q_θ(s, a) and the
               squared error the training step shrinks.
   ========================================================================== */

const PARAMS = paramCountOf([4, 32, 32, 2]);
const vec = (v) => `[${v.map((x) => fmt(x, 3)).join(', ')}]`;

function beatsOf(X) {
  const n = (v) => (X ? fmt(v, 2) : '…');
  return [
    { label: 'why approximate', say: `A Q-table needs a value for every state-action pair, so it does not scale to large MDPs (slide 58); $Q_\\theta(s, a)$ uses a fixed number of parameters $\\theta$: this page’s DQN has ${PARAMS.toLocaleString('en-US')}.` },
    { label: 'one experience', say: 'One experience $(s, a, r, s\')$ from this page’s CartPole: in state $s$ the agent pushed right ($a = 1$), got $r = 1.0$ and landed in $s\'$.' },
    { label: 'DQN on s′', say: `Run the DQN on the **next** state $s'$, for every action $a'$: $Q_\\theta(s', 0) = ${n(X?.qSp[0])}$, $Q_\\theta(s', 1) = ${n(X?.qSp[1])}$.` },
    { label: 'max, × γ', say: `Select the highest, $\\max_{a'} Q_\\theta(s', a') = ${n(X?.max)}$, and discount it by $\\gamma = 0.95$: $${n(X?.disc)}$.` },
    { label: '+ r = target', say: `Add the reward $r = 1.0$: the target $y(s, a) = ${n(X?.y)}$ (Eq. 18-7).` },
    { label: 'train toward it', say: `The DQN’s own $Q_\\theta(s, a)$ is $${n(X?.q)}$, below the target: a gradient step on the squared error $(y - Q_\\theta(s, a))^2 = ${n(X?.sq)}$ (or the Huber loss) pulls it up.` },
  ];
}
const N_BEATS = 6;

function geomOf(narrow) {
  if (narrow) {
    return {
      narrow, W: 340, H: 516,
      ex: { x: 8, y: 40, h: 28, w: 326 },
      dqn: { x: 80, y: 156, w: 180, h: 76 },
      ax: { x: 40, top: 292, bot: 456 },
      slot: [74, 124, 184, 242, 302], bw: 30,
      a1: [170, 136, 170, 154], a2: [170, 234, 130, 278],
    };
  }
  return {
    narrow, W: 800, H: 296,
    ex: { x: 10, y: 66, h: 36, w: 282 },
    dqn: { x: 316, y: 92, w: 168, h: 104 },
    ax: { x: 534, top: 36, bot: 248 },
    slot: [566, 616, 676, 734, 786], bw: 30,
    a1: [290, 122, 314, 122], a2: [486, 144, 524, 144],
  };
}

// "Q_θ(…)" with a real subscript θ
function Qt({ x, y, args, cls = '', anchor = 'middle', short = false }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={`dl9s-t ${cls}`}>
      Q{!short && <tspan dy={3} className="dl9s-ap__sub">θ</tspan>}<tspan dy={short ? 0 : -3}>{args}</tspan>
    </text>
  );
}

export function ApproxLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const story = useStory(N_BEATS);
  const { beat } = story;
  const [run, setRun] = useState(null);
  useEffect(() => {
    let alive = true;
    import('../data/dqnRun.js').then((m) => { if (alive) setRun(m.DQN_RUN); });
    return () => { alive = false; };
  }, []);
  const X = useMemo(() => (run ? approxExample(run.bestWeights) : null), [run]);
  const beats = beatsOf(X);
  const G = geomOf(narrow);

  const vmax = X ? Math.ceil(Math.max(...X.qSp, X.y, X.q) + 1.5) : 10;
  const toY = (v) => G.ax.bot - (v / vmax) * (G.ax.bot - G.ax.top);
  const h = (v) => G.ax.bot - toY(v);
  const show = (b) => (beat >= b ? '' : ' dl9s-hide');
  const bar = (x, v, cls, on, base = 0) => (
    <rect
      className={`dl9s-bar ${cls}`}
      x={x - G.bw / 2}
      y={toY(base + v)}
      width={G.bw}
      height={h(v)}
      style={{ transformOrigin: `${x}px ${toY(base)}px`, transform: `scaleY(${on ? 1 : 0.001})` }}
    />
  );
  const rowY = (i) => G.ex.y + i * G.ex.h;
  const band = beat >= 2 && beat <= 4 ? 3 : beat >= 5 ? 0 : null;
  const input = beat >= 5 ? 's' : 's′';

  return (
    <Stage
      title="Building the DQN’s target, one move at a time"
      slides="slides 58–60"
      tryThis="Predict: is the target above or below the DQN’s own Q(s, a)? Then press ▶."
      story={<StoryBar story={story} beats={beats} />}
      caption="The DQN is used twice: its prediction for the **next** state $s'$ (the highest Q-value, discounted, plus the reward) is the target its prediction for $(s, a)$ is trained toward. $\gamma = 0.95$ as on slide 63."
      own="trained DQN and CartPole experience · this page’s own"
      maths={
        X && (
          <>
            <MEq tex={"y(s, a) = r + \\gamma \\max_{a'} Q_{\\boldsymbol{\\theta}}(s', a')"} />
            <MLine text={`Here $s = ${vec(X.state)}$, $a = ${X.action}$, $r = 1.0$, $s' = ${vec(X.next_state)}$ (cart position, velocity, pole angle, angular velocity: the pole leans left and is falling further left).`} />
            <MLine text={`The DQN on $s'$: $Q_{\\theta}(s', 0) = ${fmt(X.qSp[0], 3)}$, $Q_{\\theta}(s', 1) = ${fmt(X.qSp[1], 3)}$. So $y = 1.0 + 0.95 \\times ${fmt(X.max, 3)} = 1.0 + ${fmt(X.disc, 3)} = ${fmt(X.y, 3)}$.`} />
            <MLine text={`The DQN on $s$: $Q_{\\theta}(s, 0) = ${fmt(X.qS[0], 3)}$, $Q_{\\theta}(s, 1) = ${fmt(X.qS[1], 3)}$; for the action taken, $Q_{\\theta}(s, a = 1) = ${fmt(X.q, 3)}$. Squared error $(y - Q_{\\theta}(s, a))^2 = (${fmt(X.y, 3)} - ${fmt(X.q, 3)})^2 = ${fmt(X.sq, 3)}$ (slide 60 also allows the Huber loss).`} />
            <MLine text={`The parameters $\\theta$ of slide 61’s 4 → 32 → 32 → 2 network: $4 \\times 32 + 32 + 32 \\times 32 + 32 + 32 \\times 2 + 2 = ${PARAMS.toLocaleString('en-US')}$, however many states CartPole visits.`} />
            <p className="dl9s-mnote">The network’s own greedy action here would be a = 0 (Q {fmt(X.qS[0], 1)} against {fmt(X.qS[1], 1)}): pushing right makes a left-falling pole worse. This experience came from a random action, and the DQN still learns its value: the target only needs what happened next.</p>
          </>
        )
      }
    >
      <div ref={wrap} className={`dl9s-ap${narrow ? ' dl9s-ap--narrow' : ''}`}>
        {!X ? (
          <p className="dl9s-ap__load">Loading this page’s run…</p>
        ) : (
          <svg className="dl9s-svg dl9s-ap__svg" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label={`Beat ${Math.max(beat, 0) + 1} of ${N_BEATS}. Target y = 1.0 + 0.95 × ${fmt(X.max, 2)} = ${fmt(X.y, 2)}; the DQN's Q(s, a) = ${fmt(X.q, 2)}`}>
            {/* the experience (s, a, r, s′) */}
            <g className={`dl9s-fade${beat < 0 ? ' dl9s-hide' : beat === 0 ? ' dl9s-dim' : ''}`}>
              <text x={G.ex.x} y={G.ex.y - 26} className="dl9s-t dl9s-t--s">one experience (s, a, r, s′)</text>
              {band !== null && <rect className="dl9s-rowband" x={G.ex.x - 4} y={rowY(band) - 16} width={G.ex.w} height={23} rx={4} />}
              {[
                { k: 's', cls: 'dl9s-t--obs', v: vec(X.state) },
                { k: 'a', cls: 'dl9s-t--act', v: '1  (push right)' },
                { k: 'r', cls: 'dl9s-t--rpos', v: '1.0' },
                { k: 's′', cls: 'dl9s-t--obs', v: vec(X.next_state) },
              ].map((r, i) => (
                <g key={r.k}>
                  <text x={G.ex.x + 4} y={rowY(i)} className={`dl9s-t dl9s-t--b ${r.cls}`}>{r.k}</text>
                  <text x={G.ex.x + 26} y={rowY(i)} className="dl9s-t dl9s-t--m dl9s-ap__vec">{r.v}</text>
                </g>
              ))}
            </g>

            {/* the DQN */}
            <g className="dl9s-ap__dqn">
              <rect x={G.dqn.x} y={G.dqn.y} width={G.dqn.w} height={G.dqn.h} rx={10} />
              <text x={G.dqn.x + G.dqn.w / 2 - 22} y={G.dqn.y + 24} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--agent">DQN</text>
              <Qt x={G.dqn.x + G.dqn.w / 2 + 14} y={G.dqn.y + 24} args="" cls="dl9s-t--b dl9s-t--agent" />
              <text x={G.dqn.x + G.dqn.w / 2} y={G.dqn.y + 42} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">4 → 32 → 32 → 2</text>
              <text x={G.dqn.x + G.dqn.w / 2} y={G.dqn.y + 62} textAnchor="middle" className={`dl9s-t dl9s-ap__theta${beat === 0 ? ' dl9s-ap__theta--on' : ''}`}>θ: {PARAMS.toLocaleString('en-US')} parameters</text>
              {!narrow && (
                <text x={G.dqn.x + G.dqn.w / 2} y={G.dqn.y + 88} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-fade${show(2)}`}>input: {input}</text>
              )}
            </g>
            <g className={`dl9s-fade${show(2)}`}>
              {narrow
                ? <Arrow x1={G.a1[0]} y1={G.a1[1]} x2={G.a1[2]} y2={G.a1[3]} role="obs" />
                : <Arrow x1={G.ex.x + G.ex.w + 4} y1={rowY(band ?? 3) - 5} x2={G.dqn.x - 3} y2={G.dqn.y + G.dqn.h / 2} role="obs" />}
              <Arrow x1={G.a2[0]} y1={G.a2[1]} x2={G.a2[2]} y2={G.a2[3]} on />
              {narrow && <text x={G.a1[0] + 8} y={G.a1[1] + 12} className="dl9s-t dl9s-t--xs dl9s-t--obs">input: {input}</text>}
            </g>

            {/* beat 0: why not a table */}
            <g className={`dl9s-fade${beat === 0 ? '' : ' dl9s-hide'}`}>
              <text x={G.ax.x - 20} y={G.ax.top + 4} className="dl9s-t dl9s-t--s">a Q-table: one cell per (s, a)</text>
              <text x={G.ax.x + 61} y={G.ax.top + 26} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--act">a = 0</text>
              <text x={G.ax.x + 107} y={G.ax.top + 26} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--act">a = 1</text>
              {[0, 1, 2, 3, 4].map((i) => [0, 1].map((j) => (
                <rect key={`${i}${j}`} x={G.ax.x + 40 + j * 46} y={G.ax.top + 34 + i * 26} width={42} height={22} rx={3} className="dl9s-ap__tcell" style={{ opacity: 1 - i * 0.19 }} />
              )))}
              {[0, 1, 2].map((i) => (
                <text key={i} x={G.ax.x + 32} y={G.ax.top + 49 + i * 26} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--obs">{`s${['₁', '₂', '₃'][i]}`}</text>
              ))}
              <text x={G.ax.x + 84} y={G.ax.top + 176} textAnchor="middle" className="dl9s-t dl9s-t--b">⋮</text>
              <text x={G.ax.x - 20} y={G.ax.top + 198} className="dl9s-t dl9s-t--xs">CartPole’s s is 4 real numbers (slide 17)</text>
            </g>

            {/* the bars: building the target */}
            <g className={`dl9s-fade${show(2)}`}>
              {[0, 5, 10].filter((v) => v <= vmax).map((v) => (
                <g key={v}>
                  <line x1={G.ax.x} y1={toY(v)} x2={G.slot[4] + G.bw / 2 + 4} y2={toY(v)} className="dl9s-grid-line" />
                  <text x={G.ax.x - 6} y={toY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
                </g>
              ))}
              <line x1={G.ax.x} y1={G.ax.bot} x2={G.slot[4] + G.bw / 2 + 4} y2={G.ax.bot} className="dl9s-ax" />
              <Qt x={G.slot[0]} y={G.ax.bot + 16} args="(s′, 0)" cls="dl9s-t--xs" short={narrow} />
              <Qt x={G.slot[1]} y={G.ax.bot + 16} args="(s′, 1)" cls="dl9s-t--xs" short={narrow} />
            </g>
            <text x={G.slot[2]} y={G.ax.bot + 16} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-fade${show(3)}`}>max × γ</text>
            <text x={G.slot[3]} y={G.ax.bot + 16} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-fade${show(4)}`}>+ r = y</text>
            <g className={`dl9s-fade${show(5)}`}><Qt x={G.slot[4]} y={G.ax.bot + 16} args="(s, a)" cls="dl9s-t--xs" short={narrow} /></g>
            {X.qSp.map((q, i) => (
              <g key={i} className={`dl9s-fade${beat < 2 ? ' dl9s-hide' : beat >= 3 && i !== X.best ? ' dl9s-dim' : ''}`}>
                {bar(G.slot[i], q, 'dl9s-bar--val', beat >= 2)}
                <text x={G.slot[i]} y={toY(q) - 8} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-t--m dl9s-fade${show(2)}`}>{fmt(q, 2)}</text>
              </g>
            ))}
            <rect className={`dl9s-ap__ring dl9s-fade${show(3)}`} x={G.slot[X.best] - G.bw / 2 - 3} y={toY(X.max) - 3} width={G.bw + 6} height={h(X.max) + 6} rx={4} />
            <g className={`dl9s-fade${show(3)}`}>
              {bar(G.slot[2], X.disc, 'dl9s-bar--ret', beat >= 3)}
              <text x={G.slot[2]} y={toY(X.disc) - 8} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m dl9s-t--ret">× 0.95</text>
            </g>
            <g className={`dl9s-fade${show(4)}`}>
              {bar(G.slot[3], X.disc, 'dl9s-bar--ret', beat >= 4)}
              {bar(G.slot[3], X.reward, 'dl9s-bar--pos', beat >= 4, X.disc)}
              <line x1={G.slot[3] - G.bw / 2 - 4} y1={toY(X.y)} x2={G.slot[4] + G.bw / 2 + 6} y2={toY(X.y)} className="dl9s-ap__target" />
              <text x={G.slot[3]} y={toY(X.y) - 8} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--m dl9s-t--ret">y = {fmt(X.y, 2)}</text>
              <text x={G.slot[3] + G.bw / 2 + 3} y={toY(X.disc + X.reward / 2) + 4} className="dl9s-t dl9s-t--xs dl9s-t--b dl9s-t--rpos">+1</text>
            </g>
            <g className={`dl9s-fade${show(5)}`}>
              {bar(G.slot[4], X.q, 'dl9s-bar--val', beat >= 5)}
              <text x={G.slot[4]} y={toY(X.q) + 15} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m dl9s-ap__inbar">{fmt(X.q, 2)}</text>
              <line x1={G.slot[4]} y1={toY(X.q) - 3} x2={G.slot[4]} y2={toY(X.y) + 4} className="dl9s-ap__err" />
              <text x={G.slot[4] + G.bw / 2 + 2} y={toY(X.y) - 26} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">(y − Q)² = {fmt(X.sq, 2)}</text>
            </g>
          </svg>
        )}
      </div>
    </Stage>
  );
}
