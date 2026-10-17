import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene } from '../sceneKit';
import { Steam, Flow, Finger, Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENES · PER-DRINK HABITS — two short loops   (IB p.16, p.19, p.25)
   ----------------------------------------------------------------------------
   wand   wipe the wand, tip over the drip tray, dial to STEAM briefly — the
          blast clears milk from inside (the habit that prevents the crust)
   flush  portafilter out, 1 CUP for a short flow, wipe the rim, lock in
   ========================================================================== */

export function SceneHabitWand() {
  const api = useScene(
    (tl, q, { cue }) => {
      tl.set(q('.bxi-hw-cloth, .bxi-hw-blast, .bxi-hw-milk'), { opacity: 0 }, 0);
      tl.set(q('.bxi-hw-ptr'), { rotation: 0, svgOrigin: '262 52' }, 0);
      tl.set(q('.bxi-hw-milk'), { y: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-hw-cloth'), { opacity: 0, y: -40 }, { opacity: 1, y: 30, duration: 0.9, ease: 'sine.inOut' }, 0.2);
      tl.to(q('.bxi-hw-cloth'), { opacity: 0, duration: 0.2 }, 1.1);
      cue(1, 1.4);
      tl.to(q('.bxi-hw-ptr'), { rotation: 55, svgOrigin: '262 52', duration: 0.25 }, 1.4);
      cue(2, 1.7);
      tl.to(q('.bxi-hw-blast'), { opacity: 1, duration: 0.15 }, 1.7);
      tl.to(q('.bxi-hw-milk'), { opacity: 1, duration: 0.1 }, 1.7);
      tl.to(q('.bxi-hw-milk'), { y: 40, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power1.in' }, 1.8);
      tl.to(q('.bxi-hw-ptr'), { rotation: 0, duration: 0.25 }, 2.5);
      tl.to(q('.bxi-hw-blast'), { opacity: 0, duration: 0.3 }, 2.6);
    },
    { name: 'habit-wand', loop: true },
  );
  return (
    <Stage {...api} name="After every milk drink" viewBox="0 0 320 190" label="Wipe the steam wand with a damp cloth, then with the tip over the drip tray turn the dial to steam briefly; the blast clears milk from inside the wand." beats={['Wipe the wand with a damp cloth', 'Tip over the drip tray, dial to STEAM', 'A brief blast clears milk from inside']}>
      <path className="bxi-s-steel2" d="M150 -4 h18 l-3 120 h-12 Z" />
      <path className="bxi-s-dark" d="M151 0 h16 l-1 34 h-14 Z" />
      <rect className="bxi-s-steel" x="149" y="114" width="20" height="30" rx="5" />
      {[-5, 0, 5].map((d) => (
        <circle key={d} className="bxi-s-dark" cx={159 + d} cy="141" r="1.5" />
      ))}
      <path className="bxi-s-cloth bxi-hw-cloth" d="M136 60 h46 l2 30 h-50 Z" style={{ opacity: 0 }} />
      <g className="bxi-hw-blast">
        <Steam x={159} y={150} s={-1} />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="bxi-s-milk bxi-hw-milk" cx={153 + i * 6} cy={150} r="2" style={{ opacity: 0 }} />
      ))}
      <rect className="bxi-s-steel" x="92" y="172" width="136" height="7" rx="2" />
      <Caption x={160} y={168} anchor="middle">drip tray</Caption>
      {/* The dial */}
      <circle className="bxi-s-steel" cx="262" cy="52" r="20" />
      <circle className="bxi-s-face" cx="262" cy="52" r="13" />
      <g className="bxi-hw-ptr">
        <path className="bxi-s-accentline" d="M262 36 v12" strokeWidth="2.4" />
      </g>
      <Caption x={262} y={90} anchor="middle">STEAM, briefly</Caption>
      <Caption x={238} y={30} anchor="end">water</Caption>
      <Caption x={284} y={30}>steam</Caption>
    </Stage>
  );
}

export function SceneHabitFlush() {
  const api = useScene(
    (tl, q, { cue }) => {
      const pf = q('.bxi-m-pf');
      tl.set(pf, { opacity: 0, y: 30 }, 0);
      tl.set(q('.bxi-hf-flow'), { opacity: 0 }, 0);
      cue(0, 0);
      cue(1, 0.4);
      tl.fromTo(q('.bxi-hf-finger'), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.25 }, 0.4);
      tl.to(q('.bxi-hf-finger'), { opacity: 0, duration: 0.2 }, 0.9);
      tl.to(q('.bxi-hf-flow'), { opacity: 1, duration: 0.15 }, 0.7);
      tl.fromTo(q('.bxi-hf-flow'), { strokeDashoffset: 0 }, { strokeDashoffset: -40, duration: 1.4, ease: 'none' }, 0.7);
      tl.to(q('.bxi-hf-flow'), { opacity: 0, duration: 0.2 }, 2.1);
      cue(2, 2.4);
      tl.to(pf, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.4);
    },
    { name: 'habit-flush', loop: true },
  );
  return (
    <Stage {...api} name="Before every shot" viewBox="0 0 320 190" label="With the portafilter out, press 1 CUP for a short flow through the group head, then wipe the basket rim and lock the portafilter in." beats={['Portafilter out', '[1 CUP] for a short flow', 'Wipe the basket rim; lock in']}>
      <svg x="0" y="0" width="320" height="190" viewBox="126 118 300 200" preserveAspectRatio="xMidYMid meet">
        <MachineArt portafilter="group" leds={{ power: 'solid', one: 'solid', two: 'solid' }} />
        <Flow d={`M${M.group.x} ${M.group.y + 4} L${M.group.x} 312`} className="bxi-hf-flow" hidden />
        <Finger x={M.buttons.one.x} y={M.buttons.one.y} className="bxi-hf-finger" />
      </svg>
    </Stage>
  );
}
