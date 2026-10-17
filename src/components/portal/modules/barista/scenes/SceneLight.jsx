import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene } from '../sceneKit';
import { Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · LIGHT DECODER — the CLEAN / DESCALE light, zoomed   (IB p.22, 23, 30)
   ----------------------------------------------------------------------------
   The camera closes in on the panel and a leader line finds the maintenance
   light, which then does what James says it's doing: off, flashing (a CSS
   blink — a dashed ring under reduced motion) or solid. Rebuilt per state.
   ========================================================================== */

const WIDE = '150 96 220 152';
const TIGHT = '252 118 100 70';

export default function SceneLight({ state = 'off' }) {
  const api = useScene(
    (tl, q) => {
      tl.fromTo(q('.bxi-li-cam'), { attr: { viewBox: WIDE } }, { attr: { viewBox: TIGHT }, duration: 0.9, ease: 'power2.inOut', immediateRender: true }, 0);
      tl.fromTo(q('.bxi-li-lead'), { strokeDashoffset: 60 }, { strokeDashoffset: 0, duration: 0.5, immediateRender: true }, 0.8);
      tl.fromTo(q('.bxi-li-tag'), { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: true }, 1.2);
    },
    { name: `light-${state}`, rebuild: state },
  );
  const words = { off: 'OFF', flash: 'FLASHING', solid: 'SOLID' }[state];

  return (
    <Stage
      {...api}
      name={`CLEAN / DESCALE · ${words.toLowerCase()}`}
      viewBox="0 0 320 170"
      label={`The machine's CLEAN / DESCALE light, ${words.toLowerCase()}.`}
    >
      <svg className="bxi-li-cam" x="0" y="0" width="320" height="170" viewBox={TIGHT} preserveAspectRatio="xMidYMid meet">
        <MachineArt leds={{ power: 'solid', one: 'solid', two: 'solid', clean: state }} portafilter="out" />
        <path className="bxi-s-accentline bxi-li-lead" d={`M${M.leds.clean.x} ${M.leds.clean.y + 4} L${M.leds.clean.x} 182`} strokeDasharray="60" strokeWidth="1" />
      </svg>
      <g className="bxi-li-tag">
        <Caption x={60} y={160} tone="strong">CLEAN / DESCALE LIGHT</Caption>
        <text className="bxi-s-big" x="300" y="164" textAnchor="end">{words}</text>
      </g>
    </Stage>
  );
}
