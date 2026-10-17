import { useEffect } from 'react';
import gsap from 'gsap';
import { MachineArt } from '../Machine';
import { M, tankY, fillAttr } from '../geometry';
import { useScene } from '../sceneKit';
import { Jug, Sachet, Flow, Steam, Place, Finger, Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · DESCALE — setup · rounds · rinse   (IB p.23)
   ----------------------------------------------------------------------------
   One camera (a nested <svg> whose viewBox GSAP pans) over the machine with
   its tank inset.
     setup   filter lifts out → sachet dissolves in a 1 L jug → solution into
             the tank (level rises to 1 L)
     rounds  group head 25 s (2 CUP flashing) → dial right, steam 13 s →
             dial left, hot water 8 s; the tank drops ~0.5 L a round; round
             2 takes it to MIN. Follow-along holds the timeline on the live
             leg (labels coffee / steam / water / end).
     rinse   tank out, rinsed, refilled to MAX 2 L, back in, the same legs,
             POWER pressed — lights off.
   Everything stateful is reset with tl.set() at t=0, so restart() replays
   exactly; the JSX defaults are each part's finished frame.
   ========================================================================== */

const FULL = '0 64 500 344';
const TANK_CAM = '250 96 250 172';
const tankAttr = (L) => ({ y: tankY(L), height: M.tank.bottom - tankY(L) + 2 });
const FOUR = ['power', 'two', 'clean', 'steam'];
const ledSel = (ids) => ids.map((id) => `[data-led="${id}"] .bxi-led-ring, [data-led="${id}"] .bxi-led-glow`).join(',');

// Jug positions (machine coordinates). The jug is drawn at the group.
const JUG = {
  group: { x: 226, y: 270 },
  wand: { x: 360, y: 282 },
  outlet: { x: 274, y: 262 },
};
const off = (p) => ({ x: JUG[p].x - JUG.group.x, y: JUG[p].y - JUG.group.y });

/** One round of three legs from time `t`; tank `from` → `to` litres. */
function round(tl, q, t, { from, to, legs = [2.4, 1.6, 1.2], keepFull = false }) {
  const [c, s, w] = legs;
  const jug = q('.bxi-ds-jug');
  const fill = q('.bxi-ds-jug .bxi-p-fill');
  const water = q('.bxi-m-tankwater');
  const dial = q('.bxi-m-dial');
  const wand = q('.bxi-m-wand');
  const coffee = q('.bxi-ds-flow-coffee');
  const hot = q('.bxi-ds-flow-water');
  const steam = q('.bxi-ds-steam');
  const per = (from - to) / 3;
  const dialOrigin = `${M.dial.x} ${M.dial.y}`;
  const wandOrigin = `${M.wandPivot.x} ${M.wandPivot.y}`;

  tl.addLabel('coffee', t);
  tl.set(jug, { x: 0, y: 0 }, t);
  tl.set(fill, { attr: fillAttr(0.04) }, t);
  tl.fromTo(coffee, { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, duration: 0.15 }, t + 0.2);
  tl.to(coffee, { strokeDashoffset: -60, duration: c, ease: 'none' }, t + 0.2);
  tl.fromTo(fill, { attr: fillAttr(0.04) }, { attr: fillAttr(0.45), duration: c, ease: 'none' }, t + 0.2);
  tl.fromTo(q('[data-led="two"] .bxi-led-ring'), { opacity: 1 }, { opacity: 0.1, duration: 0.05, repeat: 9, yoyo: true, repeatDelay: Math.max(0.05, c / 10 - 0.05) }, t + 0.2);
  tl.fromTo(water, { attr: tankAttr(from) }, { attr: tankAttr(from - per), duration: c, ease: 'none' }, t + 0.2);
  tl.to(coffee, { opacity: 0, duration: 0.15 }, t + 0.2 + c);

  const ts = t + 0.4 + c;
  tl.addLabel('steam', ts);
  tl.fromTo(jug, { ...off('group') }, { ...off('wand'), duration: 0.35 }, ts);
  tl.fromTo(wand, { rotation: 0, svgOrigin: wandOrigin }, { rotation: -15, svgOrigin: wandOrigin, duration: 0.35 }, ts);
  tl.fromTo(dial, { rotation: 0, svgOrigin: dialOrigin }, { rotation: 55, svgOrigin: dialOrigin, duration: 0.25 }, ts + 0.3);
  tl.fromTo(steam, { opacity: 0, y: 0 }, { opacity: 1, duration: 0.2 }, ts + 0.5);
  tl.to(steam, { y: -8, duration: s, ease: 'sine.inOut' }, ts + 0.5);
  tl.fromTo(water, { attr: tankAttr(from - per) }, { attr: tankAttr(from - 2 * per), duration: s, ease: 'none' }, ts + 0.5);
  tl.to(steam, { opacity: 0, duration: 0.2 }, ts + 0.5 + s);
  tl.to(dial, { rotation: 0, duration: 0.25 }, ts + 0.5 + s);
  tl.to(wand, { rotation: 0, duration: 0.35 }, ts + 0.7 + s);

  const tw = ts + 1.1 + s;
  tl.addLabel('water', tw);
  tl.fromTo(jug, { ...off('wand') }, { ...off('outlet'), duration: 0.35 }, tw);
  tl.fromTo(dial, { rotation: 0, svgOrigin: dialOrigin }, { rotation: -55, svgOrigin: dialOrigin, duration: 0.25 }, tw + 0.25);
  tl.fromTo(hot, { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, duration: 0.15 }, tw + 0.45);
  tl.to(hot, { strokeDashoffset: -40, duration: w, ease: 'none' }, tw + 0.45);
  tl.fromTo(fill, { attr: fillAttr(0.45) }, { attr: fillAttr(0.9), duration: w, ease: 'none' }, tw + 0.45);
  tl.fromTo(water, { attr: tankAttr(from - 2 * per) }, { attr: tankAttr(to), duration: w, ease: 'none' }, tw + 0.45);
  tl.to(hot, { opacity: 0, duration: 0.15 }, tw + 0.45 + w);
  tl.to(dial, { rotation: 0, duration: 0.25 }, tw + 0.45 + w);

  const end = tw + 0.8 + w;
  tl.addLabel('end', end);
  tl.to(jug, { x: 0, y: 0, duration: 0.35 }, end);
  if (!keepFull) tl.to(fill, { attr: fillAttr(0.04), duration: 0.3 }, end + 0.35);
  return end + 0.7;
}

const BEATS = {
  setup: ['Filter out of the tank', 'One sachet into {1 L} of water, fully dissolved', 'Solution into the tank'],
  rounds: ['Group head: [2 CUP], about {25 s}', 'Dial right: steam, about {13 s}', 'Dial left: hot water, about {8 s}', 'About {0.5 L} gone a round — repeat to MIN'],
  rinse: ['Tank out, rinsed, refilled to MAX {2 L}', 'The same three legs again', '[POWER] to finish: lights off'],
};

export default function SceneDescale({ part = 'rounds', live = null }) {
  const api = useScene(
    (tl, q, { cue }) => {
      const cam = q('.bxi-ds-cam');
      const water = q('.bxi-m-tankwater');
      const four = q(ledSel(FOUR));

      if (part === 'setup') {
        tl.set(cam, { attr: { viewBox: TANK_CAM } }, 0);
        tl.set(water, { attr: tankAttr(1.4) }, 0);
        tl.set(q('.bxi-ds-note'), { opacity: 0 }, 0);
        cue(0, 0);
        tl.fromTo(q('.bxi-m-filter'), { y: 0, opacity: 1 }, { y: -150, opacity: 0, duration: 1.1, ease: 'power2.in' }, 0.2);
        tl.fromTo(water, { attr: tankAttr(1.4) }, { attr: tankAttr(0), duration: 0.6 }, 0.4);
        cue(1, 1.4);
        tl.fromTo(q('.bxi-ds-sachet'), { opacity: 0, rotation: 0, transformOrigin: '50% 0%' }, { opacity: 1, rotation: -110, duration: 0.7 }, 1.4);
        tl.fromTo(q('.bxi-ds-powder'), { opacity: 0, y: -20 }, { opacity: 1, y: 14, duration: 0.8, stagger: 0.05, ease: 'power1.in' }, 1.9);
        tl.to(q('.bxi-ds-powder'), { opacity: 0, duration: 0.6, stagger: 0.04 }, 2.9);
        tl.fromTo(q('.bxi-ds-swirl'), { rotation: 0, opacity: 0, transformOrigin: '50% 50%' }, { rotation: 540, opacity: 1, duration: 1.1 }, 2.9);
        tl.to(q('.bxi-ds-swirl'), { opacity: 0, duration: 0.3 }, 4);
        tl.to(q('.bxi-ds-sachet'), { opacity: 0, duration: 0.3 }, 3.3);
        cue(2, 4.2);
        tl.fromTo(q('.bxi-ds-pour'), { x: 0, y: 0, rotation: 0, transformOrigin: '50% 0%' }, { x: 214, y: -140, rotation: 62, duration: 0.9, ease: 'power2.inOut' }, 4.2);
        tl.fromTo(q('.bxi-ds-pour .bxi-p-fill'), { attr: fillAttr(0.9) }, { attr: fillAttr(0.02), duration: 1.1 }, 5.1);
        tl.fromTo(water, { attr: tankAttr(0) }, { attr: tankAttr(1), duration: 1.1 }, 5.1);
        tl.to(q('.bxi-ds-pour'), { x: 0, y: 0, rotation: 0, duration: 0.7 }, 6.3);
        tl.to(cam, { attr: { viewBox: FULL }, duration: 1, ease: 'power2.inOut' }, 6.5);
        tl.to(q('.bxi-ds-note'), { opacity: 1, duration: 0.3 }, 7.3);
        return;
      }

      if (part === 'rounds') {
        tl.set(cam, { attr: { viewBox: FULL } }, 0);
        tl.set(water, { attr: tankAttr(1) }, 0);
        tl.set(q('.bxi-ds-r1'), { opacity: 1 }, 0);
        tl.set(q('.bxi-ds-r2'), { opacity: 0 }, 0);
        tl.addLabel('live', 0);
        const t1 = round(tl, q, 0, { from: 1, to: 0.5 });
        tl.addLabel('live-end', t1);
        cue(0, 0);
        cue(1, tl.labels.steam);
        cue(2, tl.labels.water);
        cue(3, t1 - 0.5);
        tl.to(q('.bxi-ds-r1'), { opacity: 0, duration: 0.2 }, t1);
        tl.to(q('.bxi-ds-r2'), { opacity: 1, duration: 0.2 }, t1);
        round(tl, q, t1 + 0.2, { from: 0.5, to: 0.25, legs: [1.6, 1.1, 0.8], keepFull: true });
        return;
      }

      // rinse
      tl.set(cam, { attr: { viewBox: TANK_CAM } }, 0);
      tl.set(water, { attr: tankAttr(0.25) }, 0);
      tl.set(four, { opacity: 1 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-m-tankinset'), { y: 0 }, { y: -60, duration: 0.6, ease: 'power2.inOut' }, 0.2);
      tl.to(water, { attr: tankAttr(0), duration: 0.5 }, 0.8);
      tl.fromTo(q('.bxi-ds-rinsewave'), { opacity: 0, x: -10 }, { opacity: 1, x: 10, duration: 0.5, repeat: 1, yoyo: true }, 1.3);
      tl.to(water, { attr: tankAttr(2), duration: 1.2 }, 2.4);
      tl.to(q('.bxi-m-tankinset'), { y: 0, duration: 0.6, ease: 'power2.inOut' }, 3.7);
      tl.to(cam, { attr: { viewBox: FULL }, duration: 0.9, ease: 'power2.inOut' }, 4.2);
      cue(1, 5.1);
      const end = round(tl, q, 5.1, { from: 2, to: 1.5, legs: [1.4, 1, 0.8], keepFull: true });
      cue(2, end);
      tl.fromTo(q('.bxi-ds-finger'), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, end);
      tl.to(four, { opacity: 0, duration: 0.3 }, end + 0.5);
      tl.to(q('.bxi-ds-finger'), { opacity: 0, duration: 0.3 }, end + 0.8);
    },
    { name: `descale-${part}`, rebuild: part },
  );

  // Follow-along for the rounds: hold on the live leg and show the real level.
  const liveObj = live && typeof live === 'object' ? live : null;
  const { hold, getTl, release, ref } = api;
  const active = !!liveObj;
  useEffect(() => {
    if (!liveObj) return;
    const tl = getTl();
    if (!tl) return;
    const next = { coffee: 'steam', steam: 'water', water: 'end' }[liveObj.leg];
    const a = tl.labels[liveObj.leg] ?? 0;
    const b = tl.labels[next] ?? a + 1;
    hold(a + (b - a) * (liveObj.running || liveObj.p ? Math.min(0.97, 0.12 + liveObj.p * 0.85) : 0.02));
    const el = ref.current?.querySelector('.bxi-m-tankwater');
    if (el) gsap.set(el, { attr: tankAttr(liveObj.litres) });
  }, [liveObj, getTl, hold, ref]);
  useEffect(() => {
    if (!active) return undefined;
    return () => release();
  }, [active, release]);

  const ledsOn = { power: 'solid', two: 'solid', clean: 'solid', steam: 'solid' };
  const props = {
    setup: { tankLevel: 1, filterInTank: false, leds: {} },
    rounds: { tankLevel: 0.25, filterInTank: false, leds: liveObj?.leg === 'coffee' && liveObj.running ? { ...ledsOn, two: 'flash' } : ledsOn },
    rinse: { tankLevel: 1.5, filterInTank: false, leds: {} },
  }[part];
  const name = { setup: 'Descale · set up', rounds: 'Descale · the rounds', rinse: 'Descale · rinse' }[part];

  return (
    <Stage
      {...api}
      name={name}
      live={active}
      label={`${name}: ${BEATS[part].join('; ').replace(/[[\]{}]/g, '')}`}
      beats={BEATS[part]}
    >
      <svg className="bxi-ds-cam" x="0" y="0" width="320" height="220" viewBox={FULL} preserveAspectRatio="xMidYMid meet">
        <MachineArt showTank portafilter="out" {...props} />
        {part !== 'setup' && (
          <>
            <Flow d={`M${M.group.x} ${M.group.y + 4} L${M.group.x} ${JUG.group.y + 30}`} className="bxi-ds-flow-coffee" />
            <Flow d={`M${M.outlet.x} ${M.outlet.y + 1} L${M.outlet.x} ${JUG.outlet.y + 30}`} className="bxi-ds-flow-water" />
            <g className="bxi-ds-steam" style={{ opacity: 0 }}>
              <Steam x={JUG.wand.x} y={JUG.wand.y - 2} s={0.9} />
            </g>
            <Jug x={JUG.group.x} y={JUG.group.y} s={0.85} className="bxi-ds-jug" level={0.9} />
          </>
        )}
        {part === 'setup' && (
          <>
            <Jug x={190} y={268} s={1.1} className="bxi-ds-pour" level={0.02} label="1 L" />
            <Place x={176} y={222} className="bxi-ds-sachet" style={{ opacity: 0 }}>
              <Sachet x={0} y={0} s={0.8} />
            </Place>
            {[0, 1, 2, 3, 4].map((k) => (
              <circle key={k} className="bxi-s-scale bxi-ds-powder" cx={182 + k * 4} cy={256 + (k % 2) * 3} r="1.6" style={{ opacity: 0 }} />
            ))}
            <path className="bxi-s-accentline bxi-ds-swirl" d="M182 290 a8 4 0 1 0 16 0 a8 4 0 1 0 -16 0" style={{ opacity: 0 }} />
            <Caption x={430} y={326} anchor="middle" tone="accent">filter out</Caption>
            <text className="bxi-s-label bxi-s-label--strong bxi-ds-note" x="430" y="340" textAnchor="middle">1 L solution in</text>
          </>
        )}
        {part === 'rinse' && (
          <>
            <path className="bxi-s-accentline bxi-ds-rinsewave" d="M400 200 q10 -8 20 0 t20 0 t20 0" style={{ opacity: 0 }} />
            <Finger x={M.buttons.power.x} y={M.buttons.power.y} className="bxi-ds-finger" />
            <Caption x={430} y={326} anchor="middle" tone="accent">MAX · 2 L</Caption>
          </>
        )}
      </svg>
      {part === 'rounds' && (
        <>
          <text className="bxi-s-big bxi-ds-r1" x="10" y="212" style={{ opacity: 0 }}>ROUND 01</text>
          <text className="bxi-s-big bxi-ds-r2" x="10" y="212">ROUND 02 · MIN</text>
          <text className="bxi-s-label" x="310" y="212" textAnchor="end">≈ 0.5 L a round</text>
        </>
      )}
    </Stage>
  );
}
