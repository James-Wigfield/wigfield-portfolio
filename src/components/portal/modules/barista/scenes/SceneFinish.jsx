import { useId } from 'react';
import { MachineArt } from '../Machine';
import { M } from '../geometry';
import { useScene } from '../sceneKit';
import { Flow, Bubbles, Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · FINISH & LOG   (IB p.25, p.26)
   ----------------------------------------------------------------------------
   1 CUP short flow through an empty basket → the drip tray comes apart
   (grid, grounds separator, full indicator pulled up off its latches) →
   warm soapy wash → back together → a shine sweeps the housing → a crema
   swirl draws in the cup, and the care log is written.
   ========================================================================== */

const BEATS = [
  'Empty basket; [1 CUP] for a short flow',
  'Drip tray out: grid off, separator up, full indicator off its latches',
  'Warm soapy water, rinse, dry; wipe the storage tray',
  'Housing wiped and polished',
  'Logged — the gauges reset',
];

export default function SceneFinish({ complete = false }) {
  const gid = `bxf${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const api = useScene(
    (tl, q, { cue }) => {
      tl.set(q('.bxi-fn-flow, .bxi-fn-suds, .bxi-fn-cloth, .bxi-fn-cup, .bxi-fn-log'), { opacity: 0 }, 0);
      tl.set(q('.bxi-fn-shine'), { x: -160, opacity: 0 }, 0);
      tl.set(q('.bxi-fn-crema'), { strokeDashoffset: 60 }, 0);
      cue(0, 0);
      tl.to(q('.bxi-fn-flow'), { opacity: 1, duration: 0.2 }, 0.2);
      tl.fromTo(q('.bxi-fn-flow'), { strokeDashoffset: 0 }, { strokeDashoffset: -30, duration: 1, ease: 'none' }, 0.2);
      tl.to(q('.bxi-fn-flow'), { opacity: 0, duration: 0.2 }, 1.2);
      cue(1, 1.5);
      tl.fromTo(q('.bxi-fn-front'), { y: 0 }, { y: 14, duration: 0.5, ease: 'power2.inOut' }, 1.5);
      tl.fromTo(q('.bxi-fn-grid'), { y: 0 }, { y: -22, duration: 0.5, ease: 'power2.out' }, 1.9);
      tl.fromTo(q('.bxi-fn-sep'), { y: 0, x: 0 }, { y: -10, x: -70, duration: 0.6, ease: 'power2.out' }, 2.2);
      tl.fromTo(q('.bxi-fn-float'), { y: 0, x: 0 }, { y: -30, x: 26, duration: 0.6, ease: 'power2.out' }, 2.5);
      cue(2, 3.2);
      tl.to(q('.bxi-fn-suds'), { opacity: 1, duration: 0.3 }, 3.2);
      tl.fromTo(q('.bxi-fn-cloth'), { opacity: 0, x: -60 }, { opacity: 1, x: 60, duration: 0.8, repeat: 1, yoyo: true, ease: 'sine.inOut' }, 3.3);
      tl.to(q('.bxi-fn-cloth, .bxi-fn-suds'), { opacity: 0, duration: 0.3 }, 4.9);
      tl.to(q('.bxi-fn-grid, .bxi-fn-sep, .bxi-fn-float, .bxi-fn-front'), { x: 0, y: 0, duration: 0.6, ease: 'power2.inOut' }, 5.1);
      cue(3, 5.9);
      tl.to(q('.bxi-fn-shine'), { opacity: 1, duration: 0.1 }, 5.9);
      tl.to(q('.bxi-fn-shine'), { x: 380, duration: 1.1, ease: 'power1.inOut' }, 5.9);
      tl.to(q('.bxi-fn-shine'), { opacity: 0, duration: 0.1 }, 6.9);
      cue(4, 7.1);
      tl.fromTo(q('.bxi-fn-cup'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 7.1);
      tl.to(q('.bxi-fn-crema'), { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, 7.4);
      tl.fromTo(q('.bxi-fn-log'), { opacity: 0, scale: 0.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 8.2);
    },
    { name: 'finish' },
  );

  return (
    <Stage {...api} name="Finish and log" label="A short 1 CUP flow, the drip tray taken apart and washed, the housing polished, and the care log written." beats={BEATS}>
      <defs>
        <linearGradient id={`${gid}-shine`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <svg className="bxi-fn-cam" x="0" y="0" width="230" height="220" viewBox="40 110 316 302" preserveAspectRatio="xMidYMid meet">
        <MachineArt portafilter="group" />
        <Flow d={`M${M.group.x} 238 L${M.group.x} 300`} className="bxi-fn-flow" hidden />
        {/* Exploded drip tray, drawn over the machine's own */}
        <g className="bxi-fn-tray">
          <g className="bxi-fn-front">
            <rect className="bxi-m-tray-front" x="54" y="322" width="292" height="30" rx="7" />
            <rect className="bxi-m-window" x="302" y="328" width="22" height="18" rx="3" />
          </g>
          <g className="bxi-fn-sep">
            <rect className="bxi-s-dark" x="190" y="319" width="120" height="5" rx="2" />
          </g>
          <g className="bxi-fn-grid">
            <rect className="bxi-m-steel" x="168" y="313" width="168" height="6" rx="2" />
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} className="bxi-m-slot" x1={178 + i * 13} x2={178 + i * 13} y1="314.5" y2="317.5" />
            ))}
          </g>
          <g className="bxi-fn-float">
            <rect className="bxi-m-float" x="306" y="338" width="14" height="5" rx="2" />
            <path className="bxi-s-thin" d="M306 340 h-3 M320 340 h3" />
          </g>
        </g>
        <g className="bxi-fn-suds">
          <Bubbles x={200} y={340} spread={16} />
          <Bubbles x={260} y={342} spread={14} />
        </g>
        <path className="bxi-s-cloth bxi-fn-cloth" d="M170 328 q30 -10 60 0 l-6 10 q-24 -8 -48 0 Z" style={{ opacity: 0 }} />
      </svg>
      <rect className="bxi-fn-shine" x="-40" y="0" width="70" height="220" fill={`url(#${gid}-shine)`} transform="skewX(-14)" style={{ opacity: 0 }} />

      {/* Reward: a fresh espresso */}
      <g className="bxi-fn-cup">
        <path className="bxi-s-face" d="M246 108 h52 v8 a26 26 0 0 1 -52 0 Z" />
        <ellipse className="bxi-s-coffee" cx="272" cy="110" rx="24" ry="5" />
        <path className="bxi-s-ink" d="M298 114 q10 0 10 9 q0 8 -12 8" />
        <path className="bxi-s-ink" d="M236 152 h72" />
        <path className="bxi-fn-crema" d="M272 110 m-14 0 a14 3 0 1 0 28 0 a10 2.2 0 1 0 -20 0 a6 1.3 0 1 0 12 0" fill="none" stroke="var(--bxi-crema)" strokeWidth="2" strokeLinecap="round" strokeDasharray="60" />
      </g>
      <g className="bxi-fn-log">
        <Caption x={272} y={176} anchor="middle" tone="strong">{complete ? 'LOGGED' : 'FINISH & LOG'}</Caption>
        <Caption x={272} y={190} anchor="middle">gauges reset</Caption>
      </g>
    </Stage>
  );
}
