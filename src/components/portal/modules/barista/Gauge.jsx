import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './sceneKit';
import { gaugeAngle } from './geometry';

/* ============================================================================
   BARISTA · STATUS GAUGE — a pressure-gauge dial driven by the care log
   ----------------------------------------------------------------------------
   value 0..1 (elapsed ÷ interval); the last 15% of the arc is the red zone,
   and `due` lights it. The needle sweeps from rest with a small overshoot on
   mount (a nod to the reference's hero); under reduced motion it just sits
   at its value. Status is never colour-only: the line under it says it.
   ========================================================================== */

function arc(r, a0, a1) {
  const p = (a) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(60 + Math.cos(t) * r).toFixed(2)} ${(60 + Math.sin(t) * r).toFixed(2)}`;
  };
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

export default function Gauge({ g }) {
  const needle = useRef(null);
  const reduced = useReducedMotion();
  const angle = gaugeAngle(Math.min(1.04, g.value));

  useLayoutEffect(() => {
    if (reduced || !needle.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        needle.current,
        { rotation: -120, svgOrigin: '60 60' },
        { rotation: angle, svgOrigin: '60 60', duration: 1.4, ease: 'back.out(1.8)', delay: 0.15 },
      );
    });
    return () => ctx.revert();
  }, [angle, reduced]);

  return (
    <figure className={`bxi-gauge${g.due ? ' bxi-gauge--due' : ''}`}>
      <svg viewBox="0 0 120 104" role="img" aria-label={`${g.label}: ${g.line}. ${g.sub}.`}>
        <title>{`${g.label}: ${g.line}`}</title>
        <circle className="bxi-gauge__bezel" cx="60" cy="60" r="54" />
        <circle className="bxi-gauge__face" cx="60" cy="60" r="47" />
        <path className="bxi-gauge__zone" d={arc(40, 84, 120)} />
        {Array.from({ length: 13 }, (_, i) => {
          const a = ((-120 + i * 20 - 90) * Math.PI) / 180;
          const r1 = i % 3 === 0 ? 33 : 37;
          return <line key={i} className="bxi-gauge__tick" x1={60 + Math.cos(a) * r1} y1={60 + Math.sin(a) * r1} x2={60 + Math.cos(a) * 43} y2={60 + Math.sin(a) * 43} />;
        })}
        <text className="bxi-gauge__now" x="60" y="86" textAnchor="middle">{g.due ? 'DUE' : 'OK'}</text>
        <g transform="translate(60 60)">
          <g ref={needle} transform={`rotate(${angle})`}>
            <path className="bxi-gauge__needle" d="M-1.6 4 L0 -38 L1.6 4 Z" />
          </g>
        </g>
        <circle className="bxi-gauge__hub" cx="60" cy="60" r="5" />
      </svg>
      <figcaption>
        <span className="bxi-gauge__label">{g.label}</span>
        <span className="bxi-gauge__line">
          <span className={`bxi-dot ${g.due ? 'bxi-dot--due' : 'bxi-dot--good'}`} aria-hidden="true" />
          {g.line}
        </span>
        <span className="bxi-gauge__sub">{g.sub}</span>
        <span className="bxi-gauge__src">{g.src}</span>
      </figcaption>
    </figure>
  );
}
