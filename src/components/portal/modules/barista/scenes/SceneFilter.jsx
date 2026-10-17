import { MachineArt } from '../Machine';
import { useScene, useLive } from '../sceneKit';
import { FilterCart, Cup, Clock, Flow, Chip, Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · NEW WATER FILTER   (IB p.9, p.22)
   ----------------------------------------------------------------------------
   Soak 5 min in cold water (follow-along scrubs the clock) → rinse 5 s under
   the tap → the date dial turns to today + 3 months (the real month name,
   computed live) → into the holder, pushed onto the post in the tank.
   ========================================================================== */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CART_REST = { x: 106, y: 82 };
const CART_SOAK = { x: 58, y: 128 };

export default function SceneFilter({ month = 'January', live = null }) {
  const target = Math.max(0, MONTHS.indexOf(month));
  const from = target - 3; // today's month (may be negative; the dial wraps)
  const beats = ['Soak the new filter {5 min} in cold water', 'Rinse under the tap for {5 s}', `Date dial to ${month} — 3 months ahead`, 'Into the holder; push onto the post in the tank'];

  const api = useScene(
    (tl, q, { cue }) => {
      const cart = q('.bxi-fl-cart');
      const dial = q('.bxi-fl-dial');
      tl.set(cart, { x: CART_SOAK.x - CART_REST.x, y: CART_SOAK.y - CART_REST.y }, 0);
      tl.set(dial, { rotation: -from * 30 }, 0);
      tl.set(q('.bxi-m-filter'), { opacity: 0 }, 0);
      tl.set(q('.bxi-fl-tap, .bxi-fl-five, .bxi-fl-push, .bxi-fl-month'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.addLabel('live', 0.1);
      tl.fromTo(q('.bxi-fl-hand'), { rotation: 0, svgOrigin: '0 0' }, { rotation: 360, svgOrigin: '0 0', duration: 2.6, ease: 'none' }, 0.1);
      tl.addLabel('live-end', 2.7);
      cue(1, 2.8);
      tl.to(cart, { x: 0, y: 0, duration: 0.8, ease: 'power2.inOut' }, 2.8);
      tl.to(q('.bxi-fl-tap, .bxi-fl-five'), { opacity: 1, duration: 0.2 }, 3.6);
      tl.fromTo(q('.bxi-fl-tap'), { strokeDashoffset: 0 }, { strokeDashoffset: -40, duration: 1.4, ease: 'none' }, 3.6);
      tl.to(q('.bxi-fl-tap, .bxi-fl-five'), { opacity: 0, duration: 0.2 }, 5);
      cue(2, 5.3);
      tl.to(dial, { rotation: -target * 30 - (target < from ? 360 : 0), duration: 1.2, ease: 'power2.inOut' }, 5.3);
      tl.to(q('.bxi-fl-month'), { opacity: 1, duration: 0.3 }, 6.4);
      cue(3, 6.9);
      tl.fromTo(q('.bxi-m-filter'), { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 6.9);
      tl.to(q('.bxi-fl-push'), { opacity: 1, duration: 0.3 }, 7.6);
    },
    { name: 'filter', rebuild: month },
  );
  useLive(api, live);

  return (
    <Stage
      {...api}
      name="New water filter"
      live={typeof live === 'number'}
      label={`A new filter soaks five minutes in cold water, is rinsed five seconds, its date dial set to ${month}, then pushed onto the post in the water tank.`}
      beats={beats}
    >
      <path className="bxi-s-steel" d="M86 4 h46 v8 h-14 v10 h-18 v-10 h-14 Z" />
      <Flow d="M109 22 L109 64" className="bxi-fl-tap" hidden />
      <Chip x={150} y={40} text="5 s" className="bxi-fl-five" />

      <Cup x={CART_SOAK.x} y={150} s={1.9} level={0.75} />
      <Caption x={CART_SOAK.x} y={210} anchor="middle">cold water</Caption>
      <Clock x={24} y={30} r={16} handClass="bxi-fl-hand" label="5 MIN" />

      <FilterCart x={CART_REST.x} y={CART_REST.y} s={1.25} month={target} className="bxi-fl-cart" dialClass="bxi-fl-dial" />
      <g className="bxi-fl-month">
        <Caption x={128} y={98} tone="accent">due</Caption>
        <Caption x={128} y={110} tone="accent">{month}</Caption>
        <Caption x={128} y={124}>+3 months</Caption>
      </g>

      <svg x="182" y="0" width="138" height="220" viewBox="370 96 140 223" preserveAspectRatio="xMidYMid meet">
        <MachineArt showTank tankLevel={1.6} filterInTank />
      </svg>
      <g className="bxi-fl-push">
        <path className="bxi-s-accentline" d="M241 106 v14 M237 115 l4 5 l4 -5" />
        <Caption x={241} y={98} anchor="middle" tone="strong">push to lock</Caption>
      </g>
    </Stage>
  );
}
