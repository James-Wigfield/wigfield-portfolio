import { MachineArt } from '../Machine';
import { M, tankY } from '../geometry';
import { useScene } from '../sceneKit';
import { Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · WATER TANK — the "nothing flows" checks   (IB p.10, p.28)
   ----------------------------------------------------------------------------
   Below MIN the machine won't run; fill with cold tap water; push the tank
   in fully so it seats.
   ========================================================================== */

const tankAttr = (L) => ({ y: tankY(L), height: M.tank.bottom - tankY(L) + 2 });

export default function SceneTank() {
  const api = useScene(
    (tl, q, { cue }) => {
      const water = q('.bxi-m-tankwater');
      const inset = q('.bxi-m-tankinset');
      tl.set(water, { attr: tankAttr(0.15) }, 0);
      tl.set(inset, { y: -14 }, 0);
      tl.set(q('.bxi-tk-min'), { opacity: 1 }, 0);
      tl.set(q('.bxi-tk-ok'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-tk-min'), { opacity: 1 }, { opacity: 0.3, duration: 0.3, repeat: 3, yoyo: true }, 0.2);
      cue(1, 1.6);
      tl.to(water, { attr: tankAttr(1.9), duration: 1.4 }, 1.6);
      tl.to(q('.bxi-tk-min'), { opacity: 0, duration: 0.3 }, 1.8);
      cue(2, 3.2);
      tl.to(inset, { y: 0, duration: 0.5, ease: 'power3.in' }, 3.2);
      tl.to(q('.bxi-tk-ok'), { opacity: 1, duration: 0.3 }, 3.8);
    },
    { name: 'tank' },
  );
  return (
    <Stage {...api} name="Water tank checks" label="The tank is below MIN, so the machine won't run; it's filled with cold tap water and pushed in fully." beats={['Below MIN the machine won’t run', 'Fill with cold tap water', 'Push the tank in fully so it locks']}>
      <svg x="0" y="0" width="320" height="220" viewBox="230 80 270 186" preserveAspectRatio="xMidYMid meet">
        <MachineArt showTank tankLevel={1.9} highlight="tank" portafilter="out" />
      </svg>
      <g className="bxi-tk-min" style={{ opacity: 0 }}>
        <Caption x={14} y={200} tone="hot">below MIN · won’t run</Caption>
      </g>
      <g className="bxi-tk-ok">
        <Caption x={14} y={200} tone="strong">filled, seated</Caption>
      </g>
    </Stage>
  );
}
