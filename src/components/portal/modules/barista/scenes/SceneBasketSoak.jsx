import { useScene, useLive } from '../sceneKit';
import { Bowl, Basket, Portafilter, Tablet, Bubbles, Clock, Caption, Place, SteamTool, Flow, TipDot } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · BASKET SOAK — start · finish   (IB p.25)
   ----------------------------------------------------------------------------
   start   hot water into a bowl, a tablet dissolves, the four baskets and the
           portafilter head sink in (handle out — a tip), a 20-minute clock
           (follow-along scrubs it over the real time)
   finish  everything lifts out and is rinsed; a close-up of a basket floor
           where the pin clears the one hole still blocked
   ========================================================================== */

const BEATS = {
  start: ['Hot water in a bowl; one tablet dissolved', 'All four baskets and the portafilter head in', 'Handle out of the water (tip)', 'About {20 min}'],
  finish: ['Lift everything out; rinse thoroughly', 'Pin any hole that’s still blocked'],
};

const XS = [78, 116, 154, 192];

export default function SceneBasketSoak({ part = 'start', live = null }) {
  const start = part === 'start';
  const api = useScene(
    (tl, q, { cue }) => {
      const items = q('.bxi-bs-item');
      if (start) {
        tl.set(q('.bxi-bs-water'), { scaleY: 0.02, transformOrigin: '50% 100%' }, 0);
        tl.set(items, { y: -90, opacity: 0 }, 0);
        tl.set(q('.bxi-bs-fizz, .bxi-bs-tablet, .bxi-bs-stream, .bxi-bs-handle'), { opacity: 0 }, 0);
        cue(0, 0);
        tl.to(q('.bxi-bs-stream'), { opacity: 1, duration: 0.2 }, 0.2);
        tl.to(q('.bxi-bs-water'), { scaleY: 1, duration: 1.1, ease: 'power1.out' }, 0.3);
        tl.to(q('.bxi-bs-stream'), { opacity: 0, duration: 0.2 }, 1.4);
        tl.fromTo(q('.bxi-bs-tablet'), { opacity: 1, y: -50, scale: 1, transformOrigin: '50% 50%' }, { y: 0, duration: 0.5, ease: 'bounce.out' }, 1.5);
        tl.to(q('.bxi-bs-fizz'), { opacity: 1, duration: 0.3 }, 2);
        tl.to(q('.bxi-bs-tablet'), { scale: 0.05, opacity: 0, duration: 1.2 }, 2.1);
        cue(1, 3);
        tl.to(items, { y: 0, opacity: 1, duration: 0.6, stagger: 0.18, ease: 'power2.in' }, 3);
        cue(2, 4.4);
        tl.to(q('.bxi-bs-handle'), { opacity: 1, duration: 0.3 }, 4.4);
        cue(3, 5);
        tl.addLabel('live', 5);
        tl.fromTo(q('.bxi-bs-hand'), { rotation: 0, svgOrigin: '0 0' }, { rotation: 360, svgOrigin: '0 0', duration: 4, ease: 'none' }, 5);
        tl.addLabel('live-end', 9);
        return;
      }
      tl.set(items, { y: 60, x: 0, opacity: 1 }, 0);
      tl.set(q('.bxi-bs-drips, .bxi-bs-inset, .bxi-bs-pin'), { opacity: 0 }, 0);
      tl.set(q('.bxi-bs-blocked'), { opacity: 1 }, 0);
      cue(0, 0);
      tl.to(items, { y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, 0.2);
      tl.to(q('.bxi-bs-drips'), { opacity: 1, duration: 0.2 }, 1);
      tl.fromTo(q('.bxi-bs-drip'), { y: 0 }, { y: 30, duration: 0.5, repeat: 3, stagger: 0.12, ease: 'power1.in' }, 1);
      tl.to(q('.bxi-bs-drips'), { opacity: 0, duration: 0.3 }, 3);
      cue(1, 3.2);
      tl.to(q('.bxi-bs-inset'), { opacity: 1, duration: 0.4 }, 3.2);
      tl.fromTo(q('.bxi-bs-pin'), { opacity: 0, x: 40, y: 40 }, { opacity: 1, x: 0, y: 0, duration: 0.6 }, 3.6);
      tl.to(q('.bxi-bs-pin'), { y: -5, duration: 0.15, yoyo: true, repeat: 3 }, 4.3);
      tl.to(q('.bxi-bs-blocked'), { opacity: 0, duration: 0.3 }, 4.8);
      tl.to(q('.bxi-bs-pin'), { opacity: 0, x: 40, y: 40, duration: 0.5 }, 5.2);
    },
    { name: `soak-${part}`, rebuild: part },
  );
  useLive(api, start ? live : null);

  return (
    <Stage
      {...api}
      name={start ? 'Basket soak · in' : 'Basket soak · out'}
      live={start && typeof live === 'number'}
      label={start
        ? 'A tablet dissolves in a bowl of hot water; the four filter baskets and the portafilter head sink in with the handle out, for about twenty minutes.'
        : 'The baskets and portafilter lift out and are rinsed; the pin clears a blocked hole in a basket floor.'}
      beats={BEATS[part]}
    >
      {start && (
        <>
          <path className="bxi-s-steel" d="M18 18 h34 v26 a6 6 0 0 1 -6 6 h-22 a6 6 0 0 1 -6 -6 Z" />
          <path className="bxi-s-ink" d="M52 26 q16 0 22 16" />
          <Caption x={18} y={12}>kettle</Caption>
          <Flow d="M74 42 Q80 70 84 104" className="bxi-bs-stream" hidden />
        </>
      )}

      <Bowl x={150} y={108} w={232} waterClass="bxi-bs-water" />
      {XS.map((x, i) => (
        <Basket key={x} x={x} y={start ? 136 : 76} s={0.72} className="bxi-bs-item" holes={i !== 1} />
      ))}
      <Place x={232} y={start ? 128 : 68} r={-8} className="bxi-bs-item">
        <Portafilter x={0} y={0} s={0.62} />
      </Place>
      {start && (
        <>
          <Place x={110} y={128} className="bxi-bs-tablet" style={{ opacity: 0 }}>
            <Tablet x={0} y={0} />
          </Place>
          <g className="bxi-bs-fizz">
            <Bubbles x={110} y={130} spread={14} />
            <Bubbles x={170} y={134} spread={12} />
          </g>
          <g className="bxi-bs-handle">
            <TipDot x={214} y={90} />
            <Caption x={222} y={93}>handle out (tip)</Caption>
          </g>
          <Clock x={286} y={40} r={20} handClass="bxi-bs-hand" label="≈ 20 MIN" />
        </>
      )}
      {!start && (
        <>
          <g className="bxi-bs-drips">
            {XS.map((x) => (
              <circle key={x} className="bxi-s-water bxi-bs-drip" cx={x} cy={96} r="1.6" />
            ))}
          </g>
          <g className="bxi-bs-inset">
            <circle className="bxi-s-steel" cx="250" cy="160" r="40" />
            {Array.from({ length: 5 }, (_, r) =>
              Array.from({ length: 5 }, (_, c) => {
                const x = 226 + c * 12;
                const y = 136 + r * 12;
                return (x - 250) ** 2 + (y - 160) ** 2 < 34 ** 2 ? (
                  <circle key={`${r}-${c}`} className="bxi-s-face" cx={x} cy={y} r="2" />
                ) : null;
              })
            )}
            <circle className="bxi-s-dark bxi-bs-blocked" cx="262" cy="160" r="2.2" />
            <Caption x={250} y={214} anchor="middle">basket floor</Caption>
          </g>
          <Place x={262} y={168} className="bxi-bs-pin">
            <g transform="rotate(90)">
              <SteamTool x={0} y={0} s={0.9} />
            </g>
          </Place>
          <Caption x={18} y={186} tone="strong">rinse well,</Caption>
          <Caption x={18} y={198}>pin what’s</Caption>
          <Caption x={18} y={210}>still blocked</Caption>
        </>
      )}
    </Stage>
  );
}
