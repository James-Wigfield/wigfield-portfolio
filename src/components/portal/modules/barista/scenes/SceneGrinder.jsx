import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene } from '../sceneKit';
import { Brush, Bowl, Finger, Caption, Place } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · GRINDER & TAMP — grinder · tamp   (IB p.15, p.20, p.24, p.25)
   ----------------------------------------------------------------------------
   grinder  hopper unlocks and tips the beans out → back on, DOSE runs the
            grinder empty into the portafilter → hopper off, the top burr
            lifts out by its wire handle (a warning dot on its number ring)
            → the brush spirals the lower burr
   tamp     tamp cover off → brush the chute → lever down and held, brush
            round the tamp → lever released slowly, brush clear → cover on
   A camera (nested <svg> viewBox) pans over the machine's left column.
   ========================================================================== */

const TOP = '10 0 230 158';
const CRADLE = '0 120 250 172';
const COLUMN = '0 140 200 138';
const HOPPER_O = `${M.hopper.x} ${M.hopper.base}`;

const BEATS = {
  grinder: [
    'Unlock the hopper; tip the beans into a container',
    'Lock it back on; hold [DOSE] until the grinder runs empty',
    'Unplug; hopper off; top burr out by its wire handle',
    'Brush the top burr, then the lower burr — no water',
  ],
  tamp: [
    'Tamp cover off',
    'Brush the chute, the tamp face and the cradle',
    'Lever down and held; brush round the tamp',
    'Release slowly, brush clear',
    'Cover on; burr and hopper locked; beans back',
  ],
};

function Burrs() {
  return (
    <g>
      <ellipse className="bxi-s-dark" cx="110" cy="99" rx="32" ry="7.5" />
      <ellipse className="bxi-s-steel2" cx="110" cy="99" rx="15" ry="4" />
      <path className="bxi-s-thin" d="M98 99 q12 -5 24 0 M101 101 q9 -3 18 0" />
      <Caption x={110} y={114} anchor="middle" small>lower burr</Caption>
    </g>
  );
}

function TopBurr() {
  return (
    <g>
      <path className="bxi-s-ink" d="M-20 0 Q-20 -22 0 -22 Q20 -22 20 0" />
      <ellipse className="bxi-s-steel" cx="0" cy="0" rx="27" ry="6.5" />
      <path className="bxi-s-thin" d="M-18 2 v2 M-9 3 v2 M0 3.4 v2 M9 3 v2 M18 2 v2" />
      <circle className="bxi-s-hot" cx="22" cy="-3" r="2.2" />
    </g>
  );
}

export default function SceneGrinder({ part = 'grinder' }) {
  const grinder = part === 'grinder';
  const api = useScene(
    (tl, q, { cue }) => {
      const cam = q('.bxi-gr-cam');
      const hopper = q('.bxi-m-hopper');
      const beans = q('.bxi-m-beans');
      const brush = q('.bxi-gr-brush');
      if (grinder) {
        tl.set(cam, { attr: { viewBox: TOP } }, 0);
        tl.set(hopper, { opacity: 1, x: 0, y: 0, rotation: 0 }, 0);
        tl.set(beans, { attr: { y: 52, height: 42 } }, 0);
        tl.set(q('.bxi-m-beantex'), { opacity: 1 }, 0);
        tl.set(q('.bxi-gr-topburr'), { x: -80, y: 30 }, 0);
        tl.set(q('.bxi-gr-burrs, .bxi-gr-warn, .bxi-gr-grinds, .bxi-m-pf'), { opacity: 0 }, 0);
        tl.set(brush, { opacity: 0, x: 0, y: 0 }, 0);
        cue(0, 0);
        tl.to(hopper, { y: -26, rotation: 32, svgOrigin: HOPPER_O, duration: 0.7, ease: 'power2.inOut' }, 0.3);
        tl.fromTo(q('.bxi-gr-bean'), { opacity: 0, x: 0, y: 0 }, { opacity: 1, x: 18, y: 34, duration: 0.6, stagger: 0.07, ease: 'power1.in' }, 0.9);
        tl.to(q('.bxi-gr-bean'), { opacity: 0, duration: 0.2, stagger: 0.07 }, 1.5);
        tl.to(beans, { attr: { y: 92, height: 2 }, duration: 1 }, 0.9);
        tl.to(q('.bxi-m-beantex'), { opacity: 0, duration: 0.4 }, 1.6);
        cue(1, 2.2);
        tl.to(hopper, { y: 0, rotation: 0, duration: 0.6, ease: 'power2.inOut' }, 2.2);
        tl.to(cam, { attr: { viewBox: CRADLE }, duration: 0.9, ease: 'power2.inOut' }, 2.7);
        tl.to(q('.bxi-m-pf'), { opacity: 1, duration: 0.3 }, 3.4);
        tl.fromTo(q('.bxi-gr-finger'), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 3.7);
        tl.fromTo(q('.bxi-gr-grinds'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 4);
        tl.fromTo(q('.bxi-gr-grind'), { y: -6 }, { y: 18, duration: 0.4, repeat: 3, stagger: 0.1, ease: 'none' }, 4);
        tl.to(q('.bxi-gr-grinds, .bxi-gr-finger'), { opacity: 0, duration: 0.25 }, 5.8);
        tl.to(q('.bxi-m-pf'), { opacity: 0, duration: 0.3 }, 6.1);
        cue(2, 6.3);
        tl.to(cam, { attr: { viewBox: TOP }, duration: 0.9, ease: 'power2.inOut' }, 6.3);
        tl.to(hopper, { y: -90, opacity: 0, duration: 0.8, ease: 'power2.in' }, 7.1);
        tl.to(q('.bxi-gr-burrs'), { opacity: 1, duration: 0.3 }, 7.6);
        tl.fromTo(q('.bxi-gr-topburr'), { x: -80, y: 30 }, { x: -80, y: -6, duration: 0.6, ease: 'power2.out' }, 7.9);
        tl.to(q('.bxi-gr-topburr'), { x: 0, y: 0, duration: 0.8, ease: 'power2.inOut' }, 8.5);
        tl.to(q('.bxi-gr-warn'), { opacity: 1, duration: 0.3 }, 9.2);
        cue(3, 9.6);
        tl.to(brush, { opacity: 1, duration: 0.3 }, 9.6);
        const loop = [
          { x: -14, y: -4 }, { x: 0, y: -8 }, { x: 14, y: -4 }, { x: 0, y: 0 },
          { x: -10, y: -3 }, { x: 0, y: -6 }, { x: 10, y: -3 }, { x: 0, y: 0 },
        ];
        loop.forEach((p, i) => tl.to(brush, { ...p, duration: 0.22, ease: 'sine.inOut' }, 9.9 + i * 0.22));
        return;
      }
      // tamp
      tl.set(cam, { attr: { viewBox: COLUMN } }, 0);
      tl.set(q('.bxi-m-cover'), { opacity: 1, x: 0, y: 0 }, 0);
      tl.set(q('.bxi-m-lever'), { rotation: 0, svgOrigin: `${M.lever.x} ${M.lever.y}` }, 0);
      tl.set(brush, { opacity: 0, x: 0, y: 0 }, 0);
      tl.set(q('.bxi-gr-done'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.to(q('.bxi-m-cover'), { y: 26, x: 70, opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0.3);
      cue(1, 1.2);
      tl.to(brush, { opacity: 1, duration: 0.3 }, 1.2);
      tl.to(brush, { y: 14, duration: 0.25, repeat: 5, yoyo: true, ease: 'sine.inOut' }, 1.4);
      tl.to(brush, { y: 40, duration: 0.3 }, 2.9);
      tl.to(brush, { x: 10, duration: 0.18, repeat: 3, yoyo: true }, 3.2);
      cue(2, 4);
      tl.to(brush, { y: 0, x: 0, duration: 0.3 }, 3.9);
      tl.to(q('.bxi-m-lever'), { rotation: -95, svgOrigin: `${M.lever.x} ${M.lever.y}`, duration: 0.8, ease: 'power2.inOut' }, 4);
      tl.to(q('.bxi-m-chute ellipse'), { y: 12, duration: 0.8, ease: 'power2.inOut' }, 4);
      tl.to(brush, { y: 20, duration: 0.25, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 4.9);
      cue(3, 6);
      tl.to(brush, { x: 80, y: -30, opacity: 0, duration: 0.5 }, 6);
      tl.to(q('.bxi-m-lever'), { rotation: 0, duration: 1.8, ease: 'sine.inOut' }, 6.4);
      tl.to(q('.bxi-m-chute ellipse'), { y: 0, duration: 1.8, ease: 'sine.inOut' }, 6.4);
      cue(4, 8.4);
      tl.to(q('.bxi-m-cover'), { y: 0, x: 0, opacity: 1, duration: 0.8, ease: 'power2.inOut' }, 8.4);
      tl.to(q('.bxi-gr-done'), { opacity: 1, duration: 0.3 }, 9.2);
    },
    { name: `grinder-${part}`, rebuild: part },
  );

  return (
    <Stage
      {...api}
      name={grinder ? 'Grinder · burrs' : 'Grinder · chute and tamp'}
      label={grinder
        ? 'The hopper tips the beans out, the grinder runs empty with DOSE held, the hopper comes off, the top burr lifts out by its wire handle and the brush cleans the lower burr.'
        : 'The tamp cover comes off, the brush cleans the chute, the lever is held down while the brush works round the tamp, then released slowly and the cover refitted.'}
      beats={BEATS[part]}
    >
      <svg className="bxi-gr-cam" x="0" y="0" width="320" height="220" viewBox={grinder ? TOP : COLUMN} preserveAspectRatio="xMidYMid meet">
        <MachineArt hopper={!grinder} beans={grinder ? 0 : 0.7} portafilter={grinder ? 'cradle' : 'out'} />
        {grinder && (
          <>
            <g className="bxi-gr-burrs">
              <Burrs />
            </g>
            <Place x={190} y={66} className="bxi-gr-topburr">
              <TopBurr />
            </Place>
            <g className="bxi-gr-warn">
              <Caption x={190} y={84} anchor="middle" tone="hot" small>ring: don’t turn it</Caption>
              <Caption x={190} y={40} anchor="middle" small>top burr</Caption>
            </g>
            <Bowl x={196} y={128} w={46} water={false} />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <ellipse key={k} className="bxi-s-bean bxi-gr-bean" cx={150 + (k % 3) * 5} cy={78 + Math.floor(k / 3) * 5} rx="2.6" ry="1.7" style={{ opacity: 0 }} />
            ))}
            <g className="bxi-gr-grinds" style={{ opacity: 0 }}>
              {[0, 1, 2].map((k) => (
                <circle key={k} className="bxi-p-crumb bxi-gr-grind" cx={108 + k * 4} cy={256} r="1.3" />
              ))}
            </g>
            <Finger x={M.buttons.dose.x} y={M.buttons.dose.y} className="bxi-gr-finger" />
            <Place x={0} y={0} className="bxi-gr-brush">
              <Brush x={124} y={96} r={18} s={0.8} />
            </Place>
          </>
        )}
        {!grinder && (
          <>
            <Place x={0} y={0} className="bxi-gr-brush" style={{ opacity: 0 }}>
              <Brush x={118} y={214} r={-60} s={0.8} />
            </Place>
            <g className="bxi-gr-done">
              <Caption x={150} y={200} small tone="strong">cover on,</Caption>
              <Caption x={150} y={208} small>lever home</Caption>
            </g>
            <Caption x={6} y={150} small>lever</Caption>
            <Caption x={150} y={232} small>tamp cover</Caption>
            <Caption x={154} y={276} small>cradle</Caption>
          </>
        )}
      </svg>
    </Stage>
  );
}
