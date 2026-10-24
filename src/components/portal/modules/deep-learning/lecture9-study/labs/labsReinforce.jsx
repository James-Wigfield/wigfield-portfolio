import { useRef, useState } from 'react';
import { Stage, StoryBar, MLine } from '../stage';
import { useWidth } from '../useWidth';
import { useStory } from '../story';
import { discountAndNormalizeRewards, fmt } from '../rl';
import './labsReinforce.css';

/* ============================================================================
   §8 · POLICY GRADIENTS: REINFORCE  (slides 30–31)
   ----------------------------------------------------------------------------
   ReinforceLab  the four REINFORCE steps as a story (one beat each, in the
                 slides' words). Left: two episodes (5 and 3 steps), each
                 step's chosen action, its stored gradient (a small arrow)
                 and, from beat 2, its score. Right: a 2-D "parameter plane"
                 with the policy as a point and every stored gradient drawn
                 from it: grey while stored (beat 1), scaled by its score
                 and flipped when the score is negative (beat 3, green /
                 red), then averaged into one arrow that the point moves
                 along (beat 4). The arrows are this page's own toy vectors;
                 the scores are the real normalised advantages of those two
                 episodes (every reward +1, γ = 0.95). Opens on beat 4.
   ========================================================================== */

const BEATS = [
  { label: 'play & store', say: '**1.** Let the policy play several times; at each step compute the gradients that would make the chosen action even more likely, but **don’t apply them yet**.' },
  { label: 'score', say: '**2.** Once several episodes have run, compute each action’s **score**: its action advantage (§7).' },
  { label: '× score', say: '**3.** Multiply each gradient vector by its action’s score: a positive score keeps its direction, a negative one **flips** it, so that action becomes less likely.' },
  { label: 'mean & step', say: '**4.** Compute the **mean** of all the resulting gradient vectors and use it to perform one gradient descent step: the policy moves.' },
];

// this page's own toy gradient vectors (2-D stand-ins), one per step; actions 0 = left, 1 = right
const EPISODES = [
  { actions: [1, 0, 1, 1, 0], g: [[0.8, 0.45], [0.35, 0.85], [0.9, -0.1], [-0.6, -0.55], [-0.25, -0.85]] },
  { actions: [0, 0, 1], g: [[0.55, 0.7], [-0.85, -0.2], [-0.7, -0.45]] },
];
const SCORES = discountAndNormalizeRewards(EPISODES.map((e) => e.actions.map(() => 1)), 0.95);
const STEPS = EPISODES.flatMap((e, ei) => e.g.map((g, t) => ({ ei, t, a: e.actions[t], g, s: SCORES[ei][t], w: [g[0] * SCORES[ei][t], g[1] * SCORES[ei][t]] })));
const OFFSET = [0, EPISODES[0].g.length];
const MEAN = [0, 1].map((k) => STEPS.reduce((acc, st) => acc + st.w[k], 0) / STEPS.length);
const v2 = (v) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)})`;

function ArrowLine({ x1, y1, x2, y2, cls, head = 7, w }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return null;
  const hx = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g className={cls}>
      <line x1={x1} y1={y1} x2={x2 - head * 0.8 * Math.cos(a)} y2={y2 - head * 0.8 * Math.sin(a)} style={w ? { strokeWidth: w } : undefined} />
      <polygon points={`${hx(0.45)} ${x2},${y2} ${hx(-0.45)}`} />
    </g>
  );
}

function Strip({ beat, hover, setHover, narrow }) {
  const cw = narrow ? 52 : 54;
  const x0 = narrow ? 8 : 10;
  const W = narrow ? 340 : 330;
  const rows = [38, 172];
  const H = 292;
  return (
    <svg className="dl9s-svg dl9s-rf__strip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Two episodes of 5 and 3 steps; scores ${SCORES.map((r) => r.map((s) => fmt(s, 2)).join(', ')).join(' and ')}`} onPointerLeave={() => setHover(null)}>
      {EPISODES.map((ep, ei) => (
        <g key={ei}>
          <text x={x0} y={rows[ei] - 14} className="dl9s-t dl9s-t--xs"><tspan className="dl9s-t--b">episode {ei + 1}</tspan> · {ep.actions.length} steps</text>
          {ep.g.map((g, t) => {
            const i = OFFSET[ei] + t;
            const st = STEPS[i];
            const x = x0 + t * cw;
            const y = rows[ei];
            const cx = x + cw / 2 - 3;
            const gy = y + 46;
            const vec = beat >= 2 ? st.w : g;
            const sc = beat >= 2 ? 15 : 24;
            const on = hover === i;
            return (
              <g key={t} onPointerEnter={() => setHover(i)} className={`dl9s-rf__cell${on ? ' dl9s-rf__cell--on' : ''}`}>
                <rect x={x + 1} y={y - 4} width={cw - 8} height={100} rx={5} className="dl9s-rf__box" />
                <text x={cx} y={y + 12} textAnchor="middle" className="dl9s-t dl9s-t--act dl9s-t--b">{st.a === 0 ? '←' : '→'}</text>
                <g className={`dl9s-fade${beat >= 0 ? '' : ' dl9s-hide'}`}>
                  <circle cx={cx} cy={gy} r={1.8} className="dl9s-rf__origin" />
                  <ArrowLine x1={cx} y1={gy} x2={cx + vec[0] * sc} y2={gy - vec[1] * sc} head={5} cls={`dl9s-rf__vec${beat >= 2 ? (st.s >= 0 ? ' dl9s-rf__vec--pos' : ' dl9s-rf__vec--neg') : ''}`} />
                </g>
                <text x={cx} y={y + 88} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-t--m dl9s-t--b dl9s-fade${beat >= 1 ? '' : ' dl9s-hide'} ${st.s >= 0 ? 'dl9s-t--rpos' : 'dl9s-t--rneg'}`}>{fmt(st.s, 2).replace(/^(\d)/, '+$1')}</text>
              </g>
            );
          })}
        </g>
      ))}
      <text x={x0} y={H - 6} className="dl9s-t dl9s-t--xs">{beat >= 1 ? 'arrow: its stored gradient · number: its score' : 'arrow: the gradient stored at that step'}</text>
    </svg>
  );
}

function Plane({ beat, hover, narrow }) {
  const s = narrow ? 120 : 130;
  const ox = 20 + 0.95 * s;
  const oy = 22 + 1.15 * s;
  const W = Math.round(ox + 1.5 * s + 16);
  const H = Math.round(oy + 0.95 * s + 34);
  const P = (v) => [ox + v[0] * s, oy - v[1] * s];
  const moved = beat >= 3;
  const [mx, my] = P(MEAN);
  return (
    <svg className="dl9s-svg dl9s-rf__plane" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The parameter plane, beat ${Math.max(beat, 0) + 1}: ${moved ? `the mean of the eight score-weighted gradients is ${v2(MEAN)} and the policy takes one step along it` : 'the stored gradients drawn from the policy point'}`}>
      {[-0.5, 0, 0.5, 1, 1.5].map((v) => <line key={`x${v}`} x1={ox + v * s} y1={10} x2={ox + v * s} y2={H - 24} className="dl9s-grid-line" />)}
      {[-0.5, 0, 0.5, 1].map((v) => <line key={`y${v}`} x1={10} y1={oy - v * s} x2={W - 10} y2={oy - v * s} className="dl9s-grid-line" />)}
      <text x={W - 10} y={H - 6} textAnchor="end" className="dl9s-t dl9s-t--xs">parameter plane · a 2-D stand-in for the network’s 31 parameters</text>
      {/* stored (raw) gradients: grey while stored, ghosts once weighted */}
      {STEPS.map((st, i) => {
        const [x2, y2] = P(st.g);
        return (
          <ArrowLine key={`raw${i}`} x1={ox} y1={oy} x2={x2} y2={y2} cls={`dl9s-rf__raw dl9s-fade${beat < 0 ? ' dl9s-hide' : beat >= 2 ? ' dl9s-rf__raw--ghost' : ''}${hover === i ? ' dl9s-rf__hl' : ''}`} />
        );
      })}
      {/* score-weighted gradients */}
      {STEPS.map((st, i) => {
        const [x2, y2] = P(st.w);
        return (
          <ArrowLine key={`w${i}`} x1={ox} y1={oy} x2={x2} y2={y2} cls={`dl9s-rf__w dl9s-fade ${st.s >= 0 ? 'dl9s-rf__w--pos' : 'dl9s-rf__w--neg'}${beat < 2 ? ' dl9s-hide' : beat >= 3 ? ' dl9s-rf__w--faint' : ''}${hover === i ? ' dl9s-rf__hl' : ''}`} />
        );
      })}
      {/* the mean and the step */}
      <g className={`dl9s-fade${moved ? '' : ' dl9s-hide'}`}>
        <ArrowLine x1={ox} y1={oy} x2={mx} y2={my} cls="dl9s-rf__mean" head={10} />
        <text x={mx + 10} y={my - 4} className="dl9s-t dl9s-t--s dl9s-t--pol dl9s-t--b dl9s-halo">mean = one step</text>
        <circle cx={mx} cy={my} r={8} className="dl9s-rf__pt" />
        <text x={mx + 12} y={my + 14} className="dl9s-t dl9s-t--xs dl9s-halo">policy after the step</text>
      </g>
      <circle cx={ox} cy={oy} r={8} className={`dl9s-rf__pt${moved ? ' dl9s-rf__pt--old' : ''}`} />
      <text x={ox + 14} y={oy + 20} className="dl9s-t dl9s-t--xs dl9s-halo">{moved ? 'policy before' : 'the policy now'}</text>
    </svg>
  );
}

export function ReinforceLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [hover, setHover] = useState(null);
  const h = hover !== null ? STEPS[hover] : null;

  return (
    <Stage
      title="REINFORCE in four moves"
      slides="slides 30–31"
      tryThis="Predict which way the policy will move, then press ▶ and watch the red arrows flip before they are averaged."
      story={<StoryBar story={story} beats={BEATS} />}
      caption="The arrows are this page’s own toy vectors in a 2-D stand-in for the network’s parameters; the scores are the real normalised advantages of two episodes of 5 and 3 steps (every reward +1, γ = 0.95). Hover a step to find its arrow."
      own="toy gradient vectors · this page’s own"
      maths={
        <>
          <MLine text={`Step 2, the scores (slide 34’s \`discount_and_normalize_rewards\`, $\\gamma = 0.95$): episode 1 $[${SCORES[0].map((v) => fmt(v, 2)).join(', ')}]$, episode 2 $[${SCORES[1].map((v) => fmt(v, 2)).join(', ')}]$. They have mean 0 and standard deviation 1.`} />
          <MLine text={h ? `Step 3, the step you are pointing at: $${fmt(h.s, 2)} \\times ${v2(h.g)} = ${v2(h.w)}$${h.s < 0 ? ' (a negative score flips it)' : ''}.` : `Step 3, e.g. the last step of episode 1: $${fmt(STEPS[4].s, 2)} \\times ${v2(STEPS[4].g)} = ${v2(STEPS[4].w)}$: the negative score flips it.`} />
          <MLine text={`Step 4: the mean of the ${STEPS.length} weighted vectors $= \\tfrac{1}{${STEPS.length}}\\sum(\\text{score} \\times \\text{gradient}) = ${v2(MEAN)}$. The optimizer takes one step with it (drawn here as a step of exactly that vector).`} />
        </>
      }
    >
      <div ref={wrap} className={`dl9s-rf${narrow ? ' dl9s-rf--narrow' : ''}`}>
        <Strip beat={beat} hover={hover} setHover={setHover} narrow={narrow} />
        <Plane beat={beat} hover={hover} narrow={narrow} />
      </div>
    </Stage>
  );
}
