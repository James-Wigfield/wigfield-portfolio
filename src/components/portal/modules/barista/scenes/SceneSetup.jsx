import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene } from '../sceneKit';
import { Plug, Finger, Brush, SteamTool, AllenKey, Disc, Tablet, Sachet, Steam, Caption, Place } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · COLD START — power off, unplug, cool, tray, kit   (IB p.3, p.25)
   ========================================================================== */

const BEATS = ['[POWER] off, dial on STANDBY', 'Unplug at the wall', 'Let it cool fully', 'Empty the drip tray', 'Lay out the kit'];

export default function SceneSetup() {
  const api = useScene(
    (tl, q, { cue }) => {
      const leds = q('[data-led="power"] .bxi-led-ring, [data-led="one"] .bxi-led-ring, [data-led="two"] .bxi-led-ring');
      tl.set(leds, { opacity: 1 }, 0);
      tl.set(q('.bxi-st-steam'), { opacity: 1 }, 0);
      tl.set(q('.bxi-st-plug'), { x: 0 }, 0);
      tl.set(q('.bxi-st-kit'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-st-finger'), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 0.3);
      tl.to(leds, { opacity: 0, duration: 0.3 }, 0.8);
      tl.to(q('.bxi-st-finger'), { opacity: 0, duration: 0.25 }, 1);
      cue(1, 1.4);
      tl.fromTo(q('.bxi-st-plug'), { x: 0 }, { x: -26, duration: 0.6, ease: 'power3.out' }, 1.4);
      cue(2, 2.2);
      tl.to(q('.bxi-st-steam'), { opacity: 0, y: -10, duration: 1.2 }, 2.2);
      tl.fromTo(q('.bxi-st-mercury'), { attr: { y: 96, height: 34 } }, { attr: { y: 118, height: 12 }, duration: 1.2 }, 2.2);
      cue(3, 3.6);
      tl.fromTo(q('.bxi-m-tray'), { y: 0 }, { y: 18, duration: 0.5, ease: 'power2.inOut' }, 3.6);
      tl.fromTo(q('.bxi-st-drop'), { opacity: 0, y: 0 }, { opacity: 1, y: 14, duration: 0.5, ease: 'power1.in' }, 4.1);
      tl.to(q('.bxi-st-drop'), { opacity: 0, duration: 0.2 }, 4.6);
      tl.to(q('.bxi-m-tray'), { y: 0, duration: 0.5, ease: 'power2.inOut' }, 4.8);
      cue(4, 5.4);
      tl.fromTo(q('.bxi-st-kit'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12 }, 5.4);
    },
    { name: 'setup' },
  );

  return (
    <Stage {...api} name="Cold start" label="Power off and unplug the machine, let it cool, empty the drip tray, and lay out the cleaning kit." beats={BEATS}>
      <svg x="0" y="4" width="200" height="200" viewBox="20 0 360 380" preserveAspectRatio="xMidYMid meet">
        <MachineArt portafilter="group" />
        <g className="bxi-st-steam" style={{ opacity: 0 }}>
          <Steam x={M.group.x} y={M.group.y - 22} />
        </g>
        <Finger x={M.buttons.power.x} y={M.buttons.power.y} className="bxi-st-finger" />
        <path className="bxi-s-water bxi-st-drop" d="M200 352 q4 6 0 9 q-4 -3 0 -9 Z" style={{ opacity: 0 }} />
      </svg>

      <Plug x={262} y={44} className="bxi-st-plug" />
      <Caption x={262} y={70} anchor="middle" tone="strong">unplugged</Caption>

      <g transform="translate(296 0)">
        <rect className="bxi-s-face" x="-5" y="88" width="10" height="44" rx="5" />
        <rect className="bxi-s-hot bxi-st-mercury" x="-2.5" y="118" width="5" height="12" rx="2.5" />
        <circle className="bxi-s-hot" cx="0" cy="134" r="5" />
      </g>
      <Caption x={262} y={112} anchor="middle">cool</Caption>
      <Caption x={262} y={124} anchor="middle">before</Caption>
      <Caption x={262} y={136} anchor="middle">touching</Caption>

      <line className="bxi-s-faint" x1="206" y1="150" x2="314" y2="150" />
      <Place x={0} y={0} className="bxi-st-kit"><Brush x={222} y={164} s={0.62} /></Place>
      <Place x={0} y={0} className="bxi-st-kit"><SteamTool x={268} y={164} s={0.7} /></Place>
      <Place x={0} y={0} className="bxi-st-kit"><AllenKey x={214} y={196} s={0.7} /></Place>
      <Place x={0} y={0} className="bxi-st-kit"><Disc x={256} y={192} s={0.7} /></Place>
      <Place x={0} y={0} className="bxi-st-kit">
        <Tablet x={282} y={186} />
        <Tablet x={282} y={196} />
      </Place>
      <Place x={0} y={0} className="bxi-st-kit"><Sachet x={304} y={190} s={0.5} /></Place>
      <Caption x={260} y={214} anchor="middle">the kit</Caption>
    </Stage>
  );
}
