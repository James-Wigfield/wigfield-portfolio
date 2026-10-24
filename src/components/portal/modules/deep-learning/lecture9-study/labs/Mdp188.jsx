import { ActNode, State, Trans } from '../svgParts';
import { geom } from './mdp188Geom';

/* ============================================================================
   FIGURE 18-8, DRAWN IN THE LABS' VOCABULARY
   ----------------------------------------------------------------------------
   States are outlined circles, actions small diamonds, every transition an
   arrow whose thickness is its probability (written beside it), rewards are
   signed markers on their arrows (+10, −50 "the fire", +40). Props:
     policy     [a for s0, a for s1, a for s2]: those actions are drawn
                "best" (a thicker diamond, their arrows in the policy colour),
                the other actions dim
     on         { s, a } an action whose arrows are drawn in ink (a step)
     here       the state the agent is in (a ring), for explorer labs
     onState    makes the states keyboard-reachable buttons
     compact    the narrow-stage layout (squeezed sideways, same glyphs)
     children   extra SVG drawn on top (tokens, markers)
   ========================================================================== */

export default function Mdp188({ policy, on, here = null, onState, showP = true, compact = false, children, className = '', label }) {
  const { W, H, STATES, ACTS, TRANS } = geom(compact);
  const role = (s, a) => {
    if (on && on.s === s && on.a === a) return 'on';
    if (policy) return policy[s] === a ? 'best' : 'dim';
    if (on) return 'dim';
    return '';
  };
  return (
    <svg className={`dl9s-svg dl9s-mdp ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? 'Figure 18-8: the three-state MDP'}>
      {/* state → action stubs */}
      {ACTS.map((n) => {
        const st = role(n.s, n.a);
        const [x1, y1, x2, y2] = n.stub;
        return <line key={`stub${n.s}${n.a}`} className={`dl9s-tr${st ? ` dl9s-tr--${st}` : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} style={{ strokeWidth: st === 'best' || st === 'on' ? 3.4 : 1.8 }} />;
      })}
      {/* action → next-state transitions */}
      {TRANS.map((t) => (
        <Trans
          key={`t${t.s}${t.a}${t.sp}`}
          x1={t.from[0]}
          y1={t.from[1]}
          x2={t.to[0]}
          y2={t.to[1]}
          bend={t.bend}
          p={t.p}
          reward={t.r}
          state={role(t.s, t.a)}
          lab={t.lab}
          showP={showP}
        />
      ))}
      {ACTS.map((n) => {
        const st = role(n.s, n.a);
        return <ActNode key={`a${n.s}${n.a}`} x={n.x} y={n.y} name={`a${n.a}`} best={st === 'best' || st === 'on'} dim={st === 'dim'} />;
      })}
      {STATES.map((s) => (
        <State
          key={s.name}
          x={s.x}
          y={s.y}
          name={s.name}
          on={here === s.id}
          onPick={onState ? () => onState(s.id) : undefined}
          label={onState ? `State ${s.name}` : undefined}
        />
      ))}
      {children}
    </svg>
  );
}
