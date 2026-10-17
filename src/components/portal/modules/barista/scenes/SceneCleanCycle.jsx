import { useScene, useLive } from '../sceneKit';
import { Portafilter, Basket, Disc, Tablet, Clock, Bubbles, Nope, Tick, Chip, Caption, Flow, Place, Jug, TurnArrow } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · CLEANING CYCLE — cycle · rinse   (IB p.22)
   ----------------------------------------------------------------------------
   A cutaway: group head above, the portafilter assembly below. The JSX rest
   position is the assembly LOCKED in the group (the finished frame); the
   timeline starts it BENCH px lower and lifts it.
     cycle  1 CUP basket → cleaning disc → tablet stack; it locks in; after
            the 3 s hold, water pulses down onto the tablet, it fizzes away
            and the flow goes back INTO the group head (IB wording) — nothing
            from the spouts. A compressed 5-minute clock runs; "tablet gone?".
            Follow-along scrubs the `live` segment over the real 5 minutes.
     rinse  portafilter out, disc out, back in, 2 CUP rinses through the
            spouts into a container, splashes wiped.
   ========================================================================== */

const BENCH = 82;

const BEATS = {
  cycle: [
    '1 CUP basket, then the disc, then one tablet',
    'Lock it in; container under the spouts',
    'Hold [1 CUP] + [2 CUP] + [POWER] {3 s}',
    'Water pulses in, dissolves the tablet, flushes back into the group',
    'About {5 min}. Check the tablet is gone',
  ],
  rinse: ['Portafilter out, disc out', 'Portafilter back in', '[2 CUP] rinses the brew head', 'Wipe any splashes dry'],
};

export default function SceneCleanCycle({ part = 'cycle', live = null }) {
  const cycle = part === 'cycle';
  const api = useScene(
    (tl, q, { cue }) => {
      const asm = q('.bxi-cc-asm');
      if (cycle) {
        tl.set(asm, { y: BENCH }, 0);
        tl.set(q('.bxi-cc-tablet'), { opacity: 1, scale: 1 }, 0);
        tl.set(q('.bxi-cc-gone, .bxi-cc-nope, .bxi-cc-up, .bxi-cc-pulse, .bxi-cc-fizz, .bxi-cc-lockmark'), { opacity: 0 }, 0);
        cue(0, 0);
        tl.fromTo(q('.bxi-cc-basket'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 0.1);
        tl.fromTo(q('.bxi-cc-disc'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 0.6);
        tl.fromTo(q('.bxi-cc-tabletdrop'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 1.1);
        cue(1, 1.7);
        tl.fromTo(asm, { y: BENCH }, { y: 0, duration: 0.8, ease: 'power3.inOut' }, 1.7);
        tl.to(q('.bxi-cc-lockmark'), { opacity: 1, duration: 0.3 }, 2.5);
        tl.fromTo(q('.bxi-cc-container'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, 2.6);
        cue(2, 3);
        tl.fromTo(q('.bxi-cc-hold'), { opacity: 0, scale: 0.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 3);
        tl.to(q('.bxi-cc-hold'), { opacity: 0, duration: 0.3 }, 4.4);
        cue(3, 4.6);
        tl.addLabel('live', 4.6);
        const L = 6;
        tl.fromTo(q('.bxi-cc-pulse'), { opacity: 0 }, { opacity: 1, duration: 0.25, repeat: 7, yoyo: true, repeatDelay: 0.12 }, 4.6);
        tl.fromTo(q('.bxi-cc-pulse'), { strokeDashoffset: 0 }, { strokeDashoffset: -90, duration: L, ease: 'none' }, 4.6);
        tl.fromTo(q('.bxi-cc-fizz'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 5.1);
        tl.fromTo(q('.bxi-cc-fizz'), { y: 0 }, { y: -6, duration: 0.5, repeat: 7, yoyo: true, ease: 'sine.inOut' }, 5.1);
        tl.fromTo(q('.bxi-cc-tablet'), { scale: 1, transformOrigin: '50% 50%' }, { scale: 0.05, duration: L - 1.2, ease: 'power1.in' }, 5.2);
        tl.fromTo(q('.bxi-cc-up'), { opacity: 0, y: 6 }, { opacity: 1, y: -6, duration: 0.6, repeat: 6, ease: 'none' }, 5.6);
        tl.fromTo(q('.bxi-cc-nope'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 5.8);
        tl.fromTo(q('.bxi-cc-hand'), { rotation: 0, svgOrigin: '0 0' }, { rotation: 360, svgOrigin: '0 0', duration: L, ease: 'none' }, 4.6);
        tl.addLabel('live-end', 4.6 + L);
        tl.to(q('.bxi-cc-pulse, .bxi-cc-fizz, .bxi-cc-up'), { opacity: 0, duration: 0.3 }, 4.6 + L);
        tl.to(q('.bxi-cc-tablet'), { opacity: 0, duration: 0.2 }, 4.6 + L);
        cue(4, 4.8 + L);
        tl.fromTo(q('.bxi-cc-gone'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 4.9 + L);
        return;
      }
      tl.set(asm, { y: 0 }, 0);
      tl.set(q('.bxi-cc-disc'), { x: 0, y: 0, opacity: 1 }, 0);
      tl.set(q('.bxi-cc-two, .bxi-cc-cloth, .bxi-cc-rinse'), { opacity: 0 }, 0);
      tl.set(q('.bxi-cc-container .bxi-p-fill'), { attr: { y: 39, height: 2 } }, 0);
      cue(0, 0);
      tl.to(asm, { y: BENCH, duration: 0.7, ease: 'power2.inOut' }, 0.2);
      tl.to(q('.bxi-cc-disc'), { y: -50, x: 60, opacity: 0, duration: 0.7 }, 1);
      cue(1, 1.8);
      tl.to(asm, { y: 0, duration: 0.7, ease: 'power2.inOut' }, 1.8);
      cue(2, 2.7);
      tl.fromTo(q('.bxi-cc-two'), { opacity: 0, scale: 0.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 2.7);
      tl.fromTo(q('.bxi-cc-rinse'), { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, duration: 0.2 }, 3.1);
      tl.to(q('.bxi-cc-rinse'), { strokeDashoffset: -50, duration: 1.6, ease: 'none' }, 3.1);
      tl.to(q('.bxi-cc-container .bxi-p-fill'), { attr: { y: 22, height: 19 }, duration: 1.6, ease: 'none' }, 3.1);
      tl.to(q('.bxi-cc-rinse'), { opacity: 0, duration: 0.2 }, 4.7);
      cue(3, 4.9);
      tl.fromTo(q('.bxi-cc-cloth'), { opacity: 0, x: -40 }, { opacity: 1, x: 40, duration: 1, ease: 'sine.inOut' }, 4.9);
      tl.to(q('.bxi-cc-cloth'), { opacity: 0, duration: 0.3 }, 5.9);
    },
    { name: `cycle-${part}`, rebuild: part },
  );
  useLive(api, cycle ? live : null);
  const isLive = cycle && typeof live === 'number';

  return (
    <Stage
      {...api}
      name={cycle ? 'Cleaning cycle · back-flush' : 'Cleaning cycle · rinse'}
      live={isLive}
      label={cycle
        ? 'Cutaway: basket, cleaning disc and tablet in the portafilter, locked into the group head; water pulses in, dissolves the tablet and flushes back into the group head with no flow from the spouts, over about five minutes.'
        : 'The portafilter comes out, the disc is removed, it goes back in and 2 CUP rinses the brew head into a container.'}
      beats={BEATS[part]}
    >
      {/* Group head cutaway */}
      <rect className="bxi-s-steel" x="98" y="20" width="104" height="44" rx="4" />
      <rect className="bxi-s-face" x="142" y="24" width="16" height="36" rx="3" />
      <Flow d="M150 26 L150 62 L150 76" className="bxi-cc-pulse bxi-live-show" hidden />
      <path className="bxi-s-thin" d="M112 64 h76" strokeDasharray="2 2.5" />
      <g className="bxi-cc-up bxi-live-show" style={{ opacity: 0 }}>
        <path className="bxi-s-accentline" d="M128 50 l4 -6 l4 6 M164 50 l4 -6 l4 6" />
      </g>
      <Caption x={208} y={34}>group head</Caption>
      {cycle && (
        <>
          <Caption x={208} y={47}>flow goes back</Caption>
          <Caption x={208} y={59}>up into it</Caption>
        </>
      )}

      {/* Portafilter assembly — rests locked in the group */}
      <Place x={150} y={68} className="bxi-cc-asm">
        <Portafilter x={0} y={0} />
        <Basket x={0} y={1} s={0.9} className="bxi-cc-basket" />
        <g style={cycle ? undefined : { opacity: 0 }}>
          <Disc x={0} y={8} className="bxi-cc-disc" />
        </g>
        {cycle && (
          <>
            <Place x={0} y={3} className="bxi-cc-tabletdrop">
              <g className="bxi-cc-tablet" style={{ opacity: 0 }}>
                <Tablet x={0} y={0} />
              </g>
            </Place>
            <g className="bxi-cc-fizz bxi-live-show" style={{ opacity: 0 }}>
              <Bubbles x={0} y={-2} spread={10} />
            </g>
            <g className="bxi-cc-nope">
              <Nope x={-6} y={38} />
              <Nope x={6} y={38} />
            </g>
            <g className="bxi-cc-lockmark">
              <TurnArrow x={-40} y={6} r={8} />
              <Caption x={-68} y={9}>lock</Caption>
            </g>
          </>
        )}
        {!cycle && <Flow d="M-6 30 L-6 92 M6 30 L6 92" className="bxi-cc-rinse" hidden />}
      </Place>

      <Jug x={150} y={160} s={1.05} className="bxi-cc-container" level={cycle ? 0.02 : 0.5} label="container" />

      {cycle ? (
        <>
          <Clock x={268} y={130} r={22} handClass="bxi-cc-hand" label="≈ 5 MIN" />
          <Chip x={268} y={180} text="HOLD 3 s" className="bxi-cc-hold" />
          <g className="bxi-cc-gone">
            <Tick x={34} y={118} s={1.4} />
            <Caption x={22} y={140} tone="strong">tablet gone?</Caption>
            <Caption x={22} y={152}>not yet: repeat,</Caption>
            <Caption x={22} y={164}>same tablet</Caption>
          </g>
          <Caption x={22} y={190} tone="hot">nothing from</Caption>
          <Caption x={22} y={202} tone="hot">the spouts</Caption>
        </>
      ) : (
        <>
          <Chip x={262} y={124} text="2 CUP" className="bxi-cc-two" />
          <path className="bxi-s-cloth bxi-cc-cloth" d="M110 150 q30 -10 60 0 l-6 10 q-24 -8 -48 0 Z" style={{ opacity: 0 }} />
          <Caption x={22} y={124} tone="strong">disc out</Caption>
          <Caption x={22} y={136}>rinse into</Caption>
          <Caption x={22} y={148}>a container</Caption>
        </>
      )}
    </Stage>
  );
}
