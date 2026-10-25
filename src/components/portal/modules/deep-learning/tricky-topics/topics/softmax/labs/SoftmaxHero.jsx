import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';
import { useWidth } from '../../../useWidth';
import { softmax, exps } from '../../../maths/softmax.js';
import { ShareStrip } from './SmParts';
import { num, score, sum, starts, Z_HERO } from './sm.js';
import './softmax.css';

/* The opener's hero: four scores z = (2, 1, 0.1, −1) become probabilities.
   One rect per class morphs through five beats (CSS transitions move it):
   signed score bars on a zero line → their exponentials (all positive) →
   the total written out → each bar its share of 1 → the bars slide into one
   100% strip with percentages. Narrow stages get a taller layout. */

const Z = Z_HERO;
const E = exps(Z);
const EMAX = Math.max(...E);
const TOTAL = sum(E);
const P = softmax(Z);
const ST = starts(P);
const BEATS = 5;
const SAY = ['Four scores: any size, any sign', 'Exponentiate: every one positive', 'Add them up', 'Divide each by the total', 'The shares fill exactly 100%'];
const NAMES = Z.map((v) => `score ${score(v)}`);

const WIDE = { W: 680, H: 272, cx: (i) => 96 + i * 100, bw: 48, zero: 168, u: 34, base: 236, hE: 150, hP: 180, sx: 40, sw: 600, sy: 108, sh: 44, sayX: 24, sayY: 30 };
const NARROW = { W: 340, H: 330, cx: (i) => 50 + i * 72, bw: 40, zero: 214, u: 30, base: 290, hE: 170, hP: 200, sx: 16, sw: 308, sy: 146, sh: 40, sayX: 12, sayY: 26 };

export function SoftmaxHero({ run }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const beat = useHeroBeats(BEATS, { run, ref, ms: 1000 });
  const G = narrow ? NARROW : WIDE;
  const role = beat <= 0 ? 'z' : beat <= 2 ? 'e' : 'p';
  const box = (i) => {
    if (beat >= 4) return { x: G.sx + ST[i] * G.sw + 1, y: G.sy, w: Math.max(1, P[i] * G.sw - 2), h: G.sh };
    const x = G.cx(i) - G.bw / 2;
    if (beat === 3) return { x, y: G.base - P[i] * G.hP, w: G.bw, h: P[i] * G.hP };
    if (beat >= 1) {
      const h = (E[i] / EMAX) * G.hE;
      return { x, y: G.base - h, w: G.bw, h };
    }
    const h = Math.abs(Z[i]) * G.u;
    return { x, y: Z[i] >= 0 ? G.zero - h : G.zero, w: G.bw, h };
  };
  const vis = (on) => `dltt-fade${on ? '' : ' dltt-hide'}`;
  const label = (i) => (beat <= 0 ? score(Z[i]) : beat <= 2 ? num(E[i], 3) : num(P[i], 2));
  const x0 = G.cx(0) - G.bw / 2 - 16;
  const x1 = G.cx(3) + G.bw / 2 + 16;
  const terms = E.map((v) => num(v, 3));
  return (
    <div ref={wrap}>
      <svg
        ref={ref}
        className="dltt-svg dltt-sm-hero"
        viewBox={`0 0 ${G.W} ${G.H}`}
        role="img"
        aria-label={`Four scores ${Z.map(score).join(', ')} are exponentiated, added up to ${num(TOTAL, 3)}, divided by that total, and fill one 100% strip: ${P.map((v) => num(v, 2)).join(', ')}`}
      >
        <text x={G.sayX} y={G.sayY} className="dltt-t dltt-sm-say">{SAY[Math.max(0, beat)]}</text>

        {/* the zero line under the signed scores; the baseline and the "1" line for the rest */}
        <g className={vis(beat <= 0)}>
          <line x1={x0} y1={G.zero} x2={x1} y2={G.zero} className="dltt-sm-zero" />
          <text x={x0 - 6} y={G.zero + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">0</text>
        </g>
        <line x1={x0} y1={G.base} x2={x1} y2={G.base} className={`dltt-sm-base ${vis(beat >= 1 && beat <= 3)}`} />
        <g className={vis(beat === 3)}>
          <line x1={x0} y1={G.base - G.hP} x2={x1} y2={G.base - G.hP} className="dltt-sm-one" />
          <text x={x0 - 6} y={G.base - G.hP + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m dltt-t--p">1</text>
        </g>

        {Z.map((_, i) => {
          const b = box(i);
          return (
            <rect
              key={i}
              width={1}
              height={1}
              className={`dltt-sm-morph dltt-sm-m--${role}`}
              style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${b.w}, ${Math.max(0.5, b.h)})` }}
            />
          );
        })}

        {Z.map((_, i) => (
          <text key={`v${i}`} x={G.cx(i)} y={G.base + 20} textAnchor="middle" className={`dltt-t dltt-t--m dltt-t--b ${role === 'p' ? 'dltt-t--p' : 'dltt-t--data'} ${vis(beat <= 3)}`}>
            {label(i)}
          </text>
        ))}

        {/* the total, then the division */}
        {narrow ? (
          <>
            <text x={G.sayX} y={54} className={`dltt-t dltt-t--m dltt-t--data ${vis(beat === 2 || beat === 3)}`} style={{ fontSize: 11.5 }}>
              {terms.join(' + ')} = <tspan className="dltt-t--b dltt-t--ink">{num(TOTAL, 3)}</tspan>
            </text>
            <text x={G.sayX} y={74} className={`dltt-t dltt-t--m dltt-t--p ${vis(beat === 3)}`} style={{ fontSize: 11.5 }}>each ÷ {num(TOTAL, 3)}</text>
          </>
        ) : (
          <>
            <g className={vis(beat === 2 || beat === 3)}>
              <text x={480} y={104} className="dltt-t dltt-t--m dltt-t--data">{terms[0]} + {terms[1]}</text>
              <text x={480} y={124} className="dltt-t dltt-t--m dltt-t--data">+ {terms[2]} + {terms[3]}</text>
              <text x={480} y={158} className="dltt-t dltt-t--m dltt-t--b" style={{ fontSize: 24 }}>= {num(TOTAL, 3)}</text>
            </g>
            <text x={480} y={188} className={`dltt-t dltt-t--m dltt-t--p ${vis(beat === 3)}`}>each ÷ {num(TOTAL, 3)}</text>
          </>
        )}

        <g className={vis(beat >= 4)}>
          <ShareStrip x={G.sx} y={G.sy} len={G.sw} thick={G.sh} p={P} names={NAMES} segments={false} labelAt={G.sy + G.sh + 34} />
        </g>
      </svg>
    </div>
  );
}
