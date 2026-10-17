import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene, drawIn } from '../sceneKit';
import Stage from '../Stage';

/* ============================================================================
   SCENE · MACHINE BOOT — the Overview hero
   ----------------------------------------------------------------------------
   Stroke twins trace the machine's outline (the Portara recipe: dash-drawn
   via getTotalLength, rendered last), the fills wipe up behind them through
   a userSpaceOnUse clip rect, the traces fade, the extraction gauge's needle
   sweeps with a small overshoot, and the panel lights blink on.
   ========================================================================== */

const NEEDLE_AT = 0.62;
const ON = ['power', 'one', 'two'];
const ledSel = ON.map((id) => `[data-led="${id}"] .bxi-led-ring`).join(',');

export default function SceneBoot() {
  const api = useScene(
    (tl, q) => {
      const traces = q('.bxi-m-trace');
      const wipe = q('.bxi-m-wiperect');
      const needle = q('.bxi-m-needle');
      const leds = q(ledSel);
      tl.set(wipe, { attr: { y: M.h, height: 0 } }, 0);
      tl.set(leds, { opacity: 0 }, 0);
      tl.set(needle, { rotation: -120, svgOrigin: `${M.gauge.x} ${M.gauge.y}` }, 0);
      drawIn(tl, traces, 0.1, { duration: 1.3, stagger: 0.07 });
      tl.fromTo(wipe, { attr: { y: M.h, height: 0 } }, { attr: { y: 0, height: M.h }, duration: 1.2, ease: 'power2.inOut' }, 1.1);
      tl.to(traces, { opacity: 0, duration: 0.5, stagger: 0.03 }, 2.1);
      tl.fromTo(
        needle,
        { rotation: -120, svgOrigin: `${M.gauge.x} ${M.gauge.y}` },
        { rotation: -120 + 240 * NEEDLE_AT, svgOrigin: `${M.gauge.x} ${M.gauge.y}`, duration: 1.3, ease: 'back.out(2.2)' },
        2.3,
      );
      tl.fromTo(leds, { opacity: 0 }, { opacity: 1, duration: 0.08, repeat: 3, yoyo: true, repeatDelay: 0.08, stagger: 0.12 }, 2.9);
      tl.to(leds, { opacity: 1, duration: 0.1 }, 3.6);
    },
    { name: 'boot' },
  );

  return (
    <Stage {...api} name="Boot" viewBox={`0 0 ${M.w} ${M.h}`} label="Line drawing of the Breville Barista Express Impress tracing itself in, filling, its pressure gauge needle sweeping and its buttons lighting up.">
      <MachineArt trace gauge={NEEDLE_AT} leds={{ power: 'solid', one: 'solid', two: 'solid' }} />
    </Stage>
  );
}
