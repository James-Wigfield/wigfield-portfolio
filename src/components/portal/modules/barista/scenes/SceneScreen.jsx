import { useScene } from '../sceneKit';
import { AllenKey, Bowl, Bubbles, Caption, Place, TurnArrow, Tick, Mark } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · SHOWER SCREEN — the Allen key job   (IB p.26–27, p.25)
   ----------------------------------------------------------------------------
   Left: an exploded side elevation of the group head — body, silicone seal,
   shower screen, screw. Right: the same screen seen from below, where the
   Allen key's turn reads as a real rotation.
   Beats: skewer clears the screw centre → short end of the key in, turned
   anti-clockwise → screw and screen drop, the down side marked → screen
   washed, group head wiped → (seal: flat side first, ribs facing you) →
   refit: 2–3 finger turns clockwise, then the key to flush.
   The finished frame is the refitted head with every part labelled.
   `seal` variant (Fix-it) lingers on the seal swap.
   ========================================================================== */

const BEATS = [
  'Tank and drip tray out; machine unplugged',
  'Skewer clears the centre of the screw',
  'Short end of the key in, turn anti-clockwise',
  'Screw and screen drop — note the side facing down',
  'Wash and dry the screen; wipe the group head',
  'Refit: 2–3 turns by hand, then the key to flush',
];

const SEAL_BEATS = [
  'Screen off with the Allen key, as in the deep clean',
  'Pull the old seal out: fingers or long-nose pliers',
  'New seal in flat side first, ribbed side facing you',
  'Screen and screw back; key until flush',
];

export default function SceneScreen({ variant = 'clean' }) {
  const seal = variant === 'seal';
  const api = useScene(
    (tl, q, { cue }) => {
      const screen = q('.bxi-sc-screen');
      const screw = q('.bxi-sc-screw');
      const key = q('.bxi-sc-key');
      tl.set([screen, screw], { y: 0, x: 0 }, 0);
      tl.set(q('.bxi-sc-down, .bxi-sc-wash, .bxi-sc-flush, .bxi-sc-skewer, .bxi-sc-turnl, .bxi-sc-turnr'), { opacity: 0 }, 0);
      if (key.length) tl.set(key, { opacity: 0, rotation: 0 }, 0);
      if (seal) {
        tl.set(q('.bxi-sc-seal'), { y: 0, opacity: 1 }, 0);
        tl.set(q('.bxi-sc-newseal'), { y: 70, opacity: 0 }, 0);
        cue(0, 0);
        tl.to([screen, screw], { y: 70, duration: 0.7, stagger: 0.1, ease: 'power2.in' }, 0.3);
        cue(1, 1.3);
        tl.to(q('.bxi-sc-seal'), { y: 46, x: -70, opacity: 0, duration: 0.9, ease: 'power2.in' }, 1.3);
        cue(2, 2.4);
        tl.to(q('.bxi-sc-newseal'), { y: 0, opacity: 1, duration: 0.9, ease: 'power2.out' }, 2.4);
        tl.fromTo(q('.bxi-sc-ribs'), { opacity: 0 }, { opacity: 1, duration: 0.3, repeat: 3, yoyo: true }, 3.3);
        cue(3, 4.6);
        tl.to([screw, screen], { y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, 4.6);
        tl.to(q('.bxi-sc-flush'), { opacity: 1, duration: 0.3 }, 5.4);
        return;
      }
      cue(0, 0);
      tl.fromTo(q('.bxi-sc-unplug'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.2);
      cue(1, 0.9);
      tl.fromTo(q('.bxi-sc-skewer'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.9);
      tl.to(q('.bxi-sc-skewer'), { x: 2, duration: 0.08, repeat: 5, yoyo: true }, 1.3);
      tl.to(q('.bxi-sc-skewer'), { opacity: 0, y: 30, duration: 0.3 }, 1.8);
      cue(2, 2.1);
      tl.to(key, { opacity: 1, duration: 0.3 }, 2.1);
      tl.to(q('.bxi-sc-turnl'), { opacity: 1, duration: 0.2 }, 2.3);
      tl.to(key, { rotation: -540, svgOrigin: '258 92', duration: 1.6, ease: 'power1.inOut' }, 2.4);
      tl.to(q('.bxi-sc-turnl'), { opacity: 0, duration: 0.2 }, 4);
      tl.to(key, { opacity: 0, duration: 0.3 }, 4);
      cue(3, 4.3);
      tl.to(screw, { y: 64, duration: 0.6, ease: 'power2.in' }, 4.3);
      tl.to(screen, { y: 50, duration: 0.7, ease: 'power2.in' }, 4.4);
      tl.to(q('.bxi-sc-down'), { opacity: 1, duration: 0.3 }, 5.1);
      cue(4, 5.6);
      tl.to(screen, { x: -60, y: 110, duration: 0.6 }, 5.6);
      tl.to(q('.bxi-sc-wash'), { opacity: 1, duration: 0.3 }, 6.1);
      tl.fromTo(q('.bxi-sc-cloth'), { opacity: 0, x: -20 }, { opacity: 1, x: 20, duration: 0.5, repeat: 1, yoyo: true }, 6.2);
      tl.to(q('.bxi-sc-cloth'), { opacity: 0, duration: 0.2 }, 7.2);
      tl.to(q('.bxi-sc-wash'), { opacity: 0, duration: 0.3 }, 7.3);
      cue(5, 7.6);
      tl.to(screen, { x: 0, y: 0, duration: 0.8, ease: 'power2.out' }, 7.6);
      tl.to(screw, { y: 0, duration: 0.6, ease: 'power2.out' }, 8.2);
      tl.to(q('.bxi-sc-turnr'), { opacity: 1, duration: 0.2 }, 8.8);
      tl.to(q('.bxi-sc-turnr'), { opacity: 0, duration: 0.2 }, 10);
      tl.to(key, { opacity: 1, duration: 0.2 }, 10);
      tl.fromTo(key, { rotation: 0 }, { rotation: 180, svgOrigin: '258 92', duration: 0.8 }, 10.1);
      tl.to(key, { opacity: 0, duration: 0.2 }, 11);
      tl.to(q('.bxi-sc-flush'), { opacity: 1, duration: 0.3 }, 11);
    },
    { name: `screen-${variant}`, rebuild: variant },
  );

  return (
    <Stage
      {...api}
      name={seal ? 'Seal swap (tip)' : 'Shower screen · Allen key'}
      label={seal
        ? 'Exploded group head: the screen comes off, the old silicone seal is pulled out, the new one goes in flat side first with the ribbed side facing you, and the screen is refitted.'
        : 'Exploded group head: skewer clears the screw, the Allen key turns it anti-clockwise, screw and screen drop with the down side marked, the screen is washed, then refitted with two to three finger turns and tightened flush.'}
      beats={seal ? SEAL_BEATS : BEATS}
    >
      {/* Side elevation */}
      <rect className="bxi-s-steel" x="44" y="18" width="132" height="42" rx="4" />
      <rect className="bxi-s-face" x="62" y="44" width="96" height="16" rx="2" />
      <Caption x={110} y={14} anchor="middle">group head</Caption>
      <g className="bxi-sc-seal">
        <rect className="bxi-s-dark" x="60" y="60" width="100" height="6" rx="3" />
      </g>
      {seal && (
        <g className="bxi-sc-newseal">
          <rect className="bxi-s-dark" x="60" y="60" width="100" height="6" rx="3" />
          <path className="bxi-s-accentline bxi-sc-ribs" d="M66 66 v3 M76 66 v3 M86 66 v3 M96 66 v3 M106 66 v3 M116 66 v3 M126 66 v3 M136 66 v3 M146 66 v3 M154 66 v3" />
        </g>
      )}
      <g className="bxi-sc-screen">
        <rect className="bxi-s-steel" x="64" y="67" width="92" height="5" rx="2" />
        <path className="bxi-s-thin" d="M70 74 h80" strokeDasharray="1.5 3" />
        <g className="bxi-sc-down">
          <path className="bxi-s-accentline" d="M110 78 v8 M106 82 l4 4 l4 -4" />
          <Caption x={118} y={86} tone="accent">this side down</Caption>
        </g>
      </g>
      <g className="bxi-sc-screw">
        <rect className="bxi-s-steel2" x="104" y="64" width="12" height="10" rx="2" />
        <rect className="bxi-s-dark" x="107" y="72" width="6" height="3" rx="1" />
      </g>
      <g className="bxi-sc-skewer" style={{ opacity: 0 }}>
        <path className="bxi-s-ink" d="M110 78 L110 130" strokeWidth="1.6" />
      </g>
      <g className="bxi-sc-flush">
        <Tick x={176} y={70} />
        <Caption x={186} y={74}>flush</Caption>
      </g>

      {/* Part labels on the finished frame */}
      <Caption x={40} y={64} anchor="end">seal</Caption>
      <line className="bxi-s-faint" x1="42" y1="62" x2="58" y2="62" />
      <Caption x={40} y={78} anchor="end">screen</Caption>
      <line className="bxi-s-faint" x1="42" y1="75" x2="62" y2="70" />
      <Caption x={40} y={92} anchor="end">screw</Caption>
      <line className="bxi-s-faint" x1="42" y1="89" x2="102" y2="73" />

      {/* Wash bowl */}
      <Bowl x={50} y={176} w={70} />
      <g className="bxi-sc-wash">
        <Bubbles x={50} y={186} spread={12} />
        <Caption x={50} y={214} anchor="middle">warm soapy water</Caption>
      </g>
      <path className="bxi-s-cloth bxi-sc-cloth" d="M84 50 q26 -8 52 0 l-4 8 q-22 -6 -44 0 Z" style={{ opacity: 0 }} />

      {/* Bottom view: the key's turn */}
      {!seal && (
        <>
          <circle className="bxi-s-steel" cx="258" cy="92" r="46" />
          <circle className="bxi-s-face" cx="258" cy="92" r="36" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r = i % 2 ? 22 : 29;
            return <circle key={i} className="bxi-s-dark" cx={258 + Math.cos(a) * r} cy={92 + Math.sin(a) * r} r="0.9" />;
          })}
          <circle className="bxi-s-steel2" cx="258" cy="92" r="7" />
          <path className="bxi-s-dark" d="M254.5 92 l1.75 -3 h3.5 l1.75 3 l-1.75 3 h-3.5 Z" />
          <Place x={0} y={0} className="bxi-sc-key">
            <AllenKey x={258} y={92} r={-90} s={1} />
          </Place>
          <g className="bxi-sc-turnl"><TurnArrow x={258} y={92} r={18} ccw /></g>
          <g className="bxi-sc-turnr"><TurnArrow x={258} y={92} r={18} /></g>
          <Caption x={258} y={152} anchor="middle">from below</Caption>
          <Mark x={208} y={170} n={1} text="↺ to loosen" />
          <Mark x={208} y={184} n={2} text="2–3 turns (hand)" />
          <Mark x={208} y={198} n={3} text="key until flush" />
        </>
      )}
      {seal && (
        <>
          <Caption x={196} y={110} tone="strong">new seal:</Caption>
          <Caption x={196} y={124}>flat side first,</Caption>
          <Caption x={196} y={138}>ribbed side</Caption>
          <Caption x={196} y={152}>facing you</Caption>
          <Caption x={196} y={176}>trigger: leaks or a</Caption>
          <Caption x={196} y={190}>loose lock-in (tip)</Caption>
        </>
      )}
      {!seal && (
        <g className="bxi-sc-unplug">
          <Caption x={204} y={20} tone="strong">unplugged,</Caption>
          <Caption x={204} y={32}>tank + tray out</Caption>
        </g>
      )}
    </Stage>
  );
}
