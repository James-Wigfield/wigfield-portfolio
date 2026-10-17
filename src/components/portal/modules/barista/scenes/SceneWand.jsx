import { useScene, useLive } from '../sceneKit';
import { SteamTool, Cup, Clock, Steam, Bubbles, Caption, Place, TurnArrow, Mark } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · STEAM WAND RESCUE — wrap · off · on   (IB p.25; the cloth is a tip)
   ----------------------------------------------------------------------------
   A close-up of the wand and its tip with the dried milk on it.
     wrap  hot cloth wraps the wand, steams; the crust softens; 2–3 min clock
           (follow-along scrubs it over the real time)
     off   cloth off → crust flakes away → pin into each hole → the tool's
           spanner turns the tip anti-clockwise → it drops into a cup → bubbles
     on    tip lifts out → pin each hole → screws back on clockwise
   ========================================================================== */

const TIP = { x: 160, y: 136 }; // tip centre on the wand
const CUP = { x: 252, y: 176 }; // tip centre sitting in the cup
const DX = TIP.x - CUP.x;
const DY = TIP.y - CUP.y;
// The tool's origin is its pin tip, resting just under the tip holes.
const TOOL = { x: TIP.x, y: TIP.y + 14 };
const SPANNER_Y = -60; // offset that puts the spanner hole over the tip centre

const BEATS = {
  wrap: ['Dial on STANDBY, wand cool', 'Hot wet cloth round the wand (tip)', 'Leave it 2–3 minutes; the crust softens'],
  off: ['Cloth off; wipe the softened milk away', 'Pin into each hole of the tip', 'Spanner on the tip; turn anti-clockwise', 'Tip into a cup of hot water to soak'],
  on: ['Lift the tip out of the soak', 'Pin each hole again', 'Screw it back on, clockwise'],
};

function TipArt() {
  return (
    <g>
      <rect className="bxi-s-steel" x="-9" y="-16" width="18" height="30" rx="5" />
      <path className="bxi-s-thin" d="M-9 -10 h18 M-9 -6 h18" />
      <circle className="bxi-s-dark" cx="-4.5" cy="11" r="1.5" />
      <circle className="bxi-s-dark" cx="0" cy="12" r="1.5" />
      <circle className="bxi-s-dark" cx="4.5" cy="11" r="1.5" />
    </g>
  );
}

export default function SceneWand({ part = 'wrap', live = null }) {
  const api = useScene(
    (tl, q, { cue }) => {
      const tip = q('.bxi-sw-tip');
      const tool = q('.bxi-sw-tool');
      if (part === 'wrap') {
        tl.set(q('.bxi-sw-crust'), { opacity: 1 }, 0);
        tl.set(q('.bxi-sw-cloth, .bxi-sw-steam'), { opacity: 0 }, 0);
        cue(0, 0);
        tl.fromTo(q('.bxi-sw-cool'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.2);
        cue(1, 0.9);
        tl.fromTo(q('.bxi-sw-cloth'), { opacity: 0, scaleY: 0.1, transformOrigin: '50% 0%' }, { opacity: 1, scaleY: 1, duration: 0.8, ease: 'power2.out' }, 0.9);
        tl.to(q('.bxi-sw-steam'), { opacity: 1, duration: 0.4 }, 1.5);
        cue(2, 1.9);
        tl.addLabel('live', 1.9);
        tl.fromTo(q('.bxi-sw-hand'), { rotation: 0, svgOrigin: '0 0' }, { rotation: 360, svgOrigin: '0 0', duration: 4, ease: 'none' }, 1.9);
        tl.fromTo(q('.bxi-sw-steam'), { y: 0 }, { y: -6, duration: 1, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 1.9);
        tl.to(q('.bxi-sw-crust'), { opacity: 0.45, duration: 4, ease: 'none' }, 1.9);
        tl.addLabel('live-end', 5.9);
        return;
      }
      if (part === 'off') {
        tl.set(tip, { x: DX, y: DY, rotation: 0 }, 0);
        tl.set(q('.bxi-sw-crust'), { opacity: 0.45, y: 0 }, 0);
        tl.set(q('.bxi-sw-cloth'), { opacity: 1 }, 0);
        tl.set(tool, { x: 70, y: 60, rotation: 0, opacity: 0 }, 0);
        tl.set(q('.bxi-sw-bubbles'), { opacity: 0 }, 0);
        cue(0, 0);
        tl.to(q('.bxi-sw-cloth'), { opacity: 0, y: 20, duration: 0.5 }, 0.2);
        tl.to(q('.bxi-sw-crust'), { opacity: 0, y: 40, duration: 0.7, stagger: 0.08, ease: 'power2.in' }, 0.6);
        cue(1, 1.5);
        // The pin pokes three holes from below.
        tl.to(tool, { opacity: 1, x: -4.5, y: 0, duration: 0.5 }, 1.5);
        tl.to(tool, { y: -6, duration: 0.15, yoyo: true, repeat: 1 }, 2.0);
        tl.to(tool, { x: 0, duration: 0.2 }, 2.3);
        tl.to(tool, { y: -6, duration: 0.15, yoyo: true, repeat: 1 }, 2.5);
        tl.to(tool, { x: 4.5, duration: 0.2 }, 2.8);
        tl.to(tool, { y: -6, duration: 0.15, yoyo: true, repeat: 1 }, 3.0);
        cue(2, 3.5);
        // Spanner hole over the tip, turn anti-clockwise; the tip comes with it.
        tl.to(tool, { x: 0, y: SPANNER_Y, duration: 0.5 }, 3.5);
        tl.fromTo(q('.bxi-sw-turn'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 4);
        tl.to(tool, { rotation: -150, svgOrigin: `${TIP.x} ${TIP.y}`, duration: 1 }, 4.1);
        tl.to(tip, { y: DY + 8, duration: 1 }, 4.1);
        tl.to(tool, { opacity: 0, x: 70, y: 60, rotation: 0, duration: 0.4 }, 5.2);
        tl.to(q('.bxi-sw-turn'), { opacity: 0, duration: 0.2 }, 5.2);
        cue(3, 5.5);
        tl.to(tip, { x: 0, y: 0, duration: 0.9, ease: 'power2.in' }, 5.5);
        tl.to(q('.bxi-sw-bubbles'), { opacity: 1, duration: 0.3 }, 6.3);
        return;
      }
      // on
      tl.set(tip, { x: -DX, y: -DY }, 0);
      tl.set(tool, { x: 70, y: 60, opacity: 0 }, 0);
      tl.set(q('.bxi-sw-turn'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.to(tip, { x: -DX, y: -DY - 50, duration: 0.7 }, 0.2);
      cue(1, 1);
      tl.to(tool, { opacity: 1, x: -DX, y: -DY - 50, duration: 0.5 }, 1);
      tl.to(tool, { y: -DY - 56, duration: 0.15, yoyo: true, repeat: 3 }, 1.5);
      tl.to(tool, { opacity: 0, x: 70, y: 60, duration: 0.4 }, 2.2);
      cue(2, 2.6);
      tl.to(tip, { x: 0, y: 8, duration: 0.6 }, 2.6);
      tl.to(q('.bxi-sw-turn'), { opacity: 1, duration: 0.2 }, 3.2);
      tl.to(tip, { y: 0, duration: 0.8 }, 3.3);
      tl.to(q('.bxi-sw-turn'), { opacity: 0, duration: 0.3 }, 4.2);
    },
    { name: `wand-${part}`, rebuild: part },
  );
  useLive(api, part === 'wrap' ? live : null);

  const tipAt = part === 'off' ? CUP : TIP;
  const name = { wrap: 'Steam wand · hot cloth', off: 'Steam wand · tip off', on: 'Steam wand · tip on' }[part];

  return (
    <Stage
      {...api}
      name={name}
      live={part === 'wrap' && typeof live === 'number'}
      label={`${name}: ${BEATS[part].join('; ')}`}
      beats={BEATS[part]}
    >
      {/* Wand */}
      <path className="bxi-s-steel2" d="M146 -4 L174 -4 L170 122 L150 122 Z" />
      <path className="bxi-s-dark" d="M147 0 L173 0 L172 40 L148 40 Z" />
      <Caption x={182} y={24}>steam wand</Caption>

      {/* Dried milk */}
      {part !== 'on' && (
        <g>
          {[[152, 96, 7, 4], [166, 106, 6, 5], [155, 116, 8, 4], [163, 88, 5, 3]].map(([x, y, rx, ry], i) => (
            <ellipse key={i} className="bxi-s-crust bxi-sw-crust" cx={x} cy={y} rx={rx} ry={ry} style={{ opacity: part === 'off' ? 0 : 0.45 }} />
          ))}
        </g>
      )}

      {/* Tip */}
      <Place x={tipAt.x} y={tipAt.y} className="bxi-sw-tip">
        <TipArt />
        {part === 'wrap' && <ellipse className="bxi-s-crust bxi-sw-crust" cx="0" cy="4" rx="8" ry="4" style={{ opacity: 0.45 }} />}
      </Place>

      {/* Cloth (wrap) */}
      {part !== 'on' && (
        <g>
          <path className="bxi-s-cloth bxi-sw-cloth" d="M138 50 L182 50 L186 150 L134 150 Z" style={part === 'off' ? { opacity: 0 } : undefined} />
          <g className="bxi-sw-steam" style={part === 'off' ? { opacity: 0 } : undefined}>
            <Steam x={150} y={44} s={0.9} />
            <Steam x={170} y={44} s={0.9} />
          </g>
        </g>
      )}

      {/* Tool (pin up, spanner hole 34 below the pin tip) */}
      <Place x={TOOL.x} y={TOOL.y} className="bxi-sw-tool" style={{ opacity: 0 }}>
        <g transform="rotate(90)">
          <SteamTool x={12} y={0} s={1} />
        </g>
      </Place>
      <g className="bxi-sw-turn" style={{ opacity: 0 }}>
        <TurnArrow x={TIP.x} y={TIP.y} r={20} ccw={part === 'off'} />
      </g>

      {part !== 'wrap' && (
        <>
          <Cup x={CUP.x} y={CUP.y - 14} s={1.3} />
          <g className="bxi-sw-bubbles" style={part === 'off' ? undefined : { opacity: 0 }}>
            <Bubbles x={CUP.x} y={CUP.y + 4} spread={12} />
          </g>
          <Caption x={CUP.x} y={CUP.y + 34} anchor="middle">hot water</Caption>
        </>
      )}

      {part === 'wrap' && (
        <>
          <Clock x={262} y={86} r={24} handClass="bxi-sw-hand" label="2–3 MIN · TIP" />
          <g className="bxi-sw-cool">
            <Caption x={24} y={40} tone="strong">STANDBY</Caption>
            <Caption x={24} y={52}>machine off,</Caption>
            <Caption x={24} y={64}>wand cool</Caption>
          </g>
          <Caption x={24} y={166}>very hot,</Caption>
          <Caption x={24} y={178}>wet cloth</Caption>
        </>
      )}
      {part === 'off' && (
        <>
          <Mark x={24} y={44} n={1} text="wipe" />
          <Mark x={24} y={60} n={2} text="pin each hole" />
          <Mark x={24} y={76} n={3} text="spanner ↺" />
          <Mark x={24} y={92} n={4} text="soak" />
        </>
      )}
      {part === 'on' && (
        <>
          <Mark x={24} y={44} n={1} text="out of the soak" />
          <Mark x={24} y={60} n={2} text="pin each hole" />
          <Mark x={24} y={76} n={3} text="screw on ↻" />
        </>
      )}
    </Stage>
  );
}
