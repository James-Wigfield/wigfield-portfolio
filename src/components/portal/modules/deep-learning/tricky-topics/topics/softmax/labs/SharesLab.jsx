import { useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../../../stage';
import { Knob, Arrow } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStory } from '../../../story';
import { useStudy } from '../../../context';
import { softmax, exps } from '../../../maths/softmax.js';
import { ShareStrip } from './SmParts';
import { num, score, tex, texScore, sum, Z_WALK } from './sm.js';
import './softmax.css';

/* Step 1 · scores to shares. Three score bars you drag (Knobs, −3 … 4);
   the story walks z → exp(z) → the total → p, ending on a 100% stacked
   strip. Every bar updates live while you drag, in every beat. Narrow
   stages put the shares under the exponentials and stand the strip up. */

const KMIN = -3;
const KMAX = 4;
const NAMES = ['class 1', 'class 2', 'class 3'];

const WIDE = {
  W: 760, H: 422, kx: [70, 130, 190], yTop: 56, yBot: 256, ex: [320, 380, 440], base: 256, eH: 190,
  px: [580, 640, 700], pBase: 256, pH: 200, bw: 30, ta: [40, 28], tb: [290, 28], tc: [550, 28],
  idxY: 292, pIdxY: 292, brk: 300, totY: 324, strip: { x: 40, y: 344, len: 680 },
};
const NARROW = {
  W: 340, H: 492, kx: [40, 95, 150], yTop: 52, yBot: 212, ex: [215, 265, 315], base: 212, eH: 150,
  px: [215, 265, 315], pBase: 456, pH: 134, bw: 26, ta: [12, 26], tb: [192, 26], tc: [192, 306],
  idxY: 246, pIdxY: 474, brk: 254, totY: 278, vstrip: { x: 30, y: 334, len: 124 },
};

export function SharesLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [zs, setZs] = useState(Z_WALK);
  const z = printing ? Z_WALK : zs;
  const e = exps(z);
  const total = sum(e);
  const p = softmax(z);
  const emax = Math.max(...e);
  const setK = (k) => (v) => setZs((prev) => prev.map((x, i) => (i === k ? v : x)));
  const beats = [
    { label: 'Scores', say: 'Three scores (logits) from the last layer: any size, any sign.' },
    { label: 'Exponentiate', say: 'Exponentiate: every score turns positive, and the biggest pulls further ahead.' },
    { label: 'Add up', say: `Add the three exponentials: the total is ${num(total, 3)}.` },
    { label: 'Divide', say: 'Divide each by the total: three shares that fill exactly 100%.' },
  ];
  const story = useStory(beats.length);
  const b = story.beat;
  const G = narrow ? NARROW : WIDE;
  const toY = (v) => G.yBot - ((v - KMIN) / (KMAX - KMIN)) * (G.yBot - G.yTop);
  const zero = toY(0);
  const grow = (on) => `dltt-sm-grow${on ? '' : ' dltt-sm-grow--off'}`;
  const vis = (on) => `dltt-fade${on ? '' : ' dltt-hide'}`;
  const half = G.bw / 2;
  return (
    <Stage
      title="Scores in, shares out"
      prov="{s|L1 · slides 29–30} {own}"
      tryThis="Predict what happens to class 3’s share when you drag class 1 up, then drag any score bar."
      story={<StoryBar story={story} beats={beats} />}
      caption="The biggest score always gets the biggest share and the order never changes. Every share stays above 0, even for a very negative score {beyond}."
      challenge={{ text: 'Make class 2 take more than half.', done: p[1] > 0.5 }}
      maths={
        <>
          <MEq tex={'\\hat{p}_k = \\frac{\\exp(z_k)}{\\sum_{j=1}^{K} \\exp(z_j)}'} />
          <MLine text={`Here $z = (${z.map(texScore).join(', ')})$, so $e^{z} = (${e.map((v) => tex(v, 3)).join(', ')})$ and the total is $${tex(total, 3)}$.`} />
          <MLine text={`Each divided by the total: $\\hat{p} = (${p.map((v) => tex(v, 3)).join(', ')})$, which add up to $${tex(sum(p), 3)}$.`} />
          <MLine text="Lecture 1 says what it does, “all the output values are probabilities and they sum to 1”, without printing the formula {s|L1 · slide 29}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Scores ${z.map(score).join(', ')} give shares ${p.map((v) => num(v, 2)).join(', ')}`}>
          {/* A · the scores: drag the bars */}
          <text x={G.ta[0]} y={G.ta[1]} className="dltt-t dltt-t--b dltt-t--data">scores z</text>
          <line x1={G.kx[0] - half - 10} y1={zero} x2={G.kx[2] + half + 10} y2={zero} className="dltt-sm-zero" />
          <text x={G.kx[0] - half - 14} y={zero + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">0</text>
          {z.map((v, i) => {
            const vy = toY(v);
            return (
              <g key={`z${i}`}>
                <rect x={G.kx[i] - half} y={G.yTop} width={G.bw} height={G.yBot - G.yTop} className="dltt-sm-track" />
                <rect x={G.kx[i] - half} y={Math.min(vy, zero)} width={G.bw} height={Math.max(1, Math.abs(vy - zero))} className="dltt-sm-zbar" />
                <text x={G.kx[i]} y={v >= 0 ? vy - 13 : vy + 22} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--data dltt-halo">{score(v)}</text>
                <Knob x={G.kx[i]} yTop={G.yTop} yBot={G.yBot} value={v} min={KMIN} max={KMAX} onChange={setK(i)} label={`Score of class ${i + 1}`} className="dltt-sm-knob" />
                <text x={G.kx[i]} y={G.idxY} textAnchor="middle" className="dltt-t dltt-t--xs">{i + 1}</text>
              </g>
            );
          })}

          {/* B · the exponentials (height ∝ e^z, tallest = full height) */}
          {!narrow && (
            <>
              <g className={vis(b >= 1)}>
                <Arrow x1={226} y1={160} x2={282} y2={160} role="data" />
                <text x={254} y={150} textAnchor="middle" className="dltt-t dltt-t--s dltt-t--m">exp</text>
              </g>
              <g className={vis(b >= 3)}>
                <Arrow x1={470} y1={160} x2={540} y2={160} role="p" />
                <text x={505} y={150} textAnchor="middle" className="dltt-t dltt-t--s dltt-t--m">÷ total</text>
              </g>
            </>
          )}
          <g className={vis(b >= 1)}>
            <text x={G.tb[0]} y={G.tb[1]} className="dltt-t dltt-t--b dltt-t--data">exp(z)</text>
            <line x1={G.ex[0] - half - 10} y1={G.base} x2={G.ex[2] + half + 10} y2={G.base} className="dltt-sm-base" />
          </g>
          {e.map((v, i) => {
            const h = (v / emax) * G.eH;
            return (
              <g key={`e${i}`}>
                <rect x={G.ex[i] - half} y={G.base - h} width={G.bw} height={Math.max(0.5, h)} className={`dltt-sm-e ${grow(b >= 1)}`} />
                <text x={G.ex[i]} y={G.base - h - 6} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--m dltt-t--data ${vis(b >= 1)}`}>{num(v, 3)}</text>
                <text x={G.ex[i]} y={G.idxY} textAnchor="middle" className={`dltt-t dltt-t--xs ${vis(b >= 1)}`}>{i + 1}</text>
              </g>
            );
          })}
          <g className={vis(b >= 2)}>
            <path d={`M${G.ex[0] - half},${G.brk} v6 H${G.ex[2] + half} v-6`} className="dltt-sm-brk" />
            <text x={G.ex[1]} y={G.totY} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--data">total {num(total, 3)}</text>
          </g>

          {/* C · the shares (height ∝ p, the dashed line is 1) */}
          <g className={vis(b >= 3)}>
            <text x={G.tc[0]} y={G.tc[1]} className="dltt-t dltt-t--b dltt-t--p">{narrow ? '÷ total = shares p̂' : 'shares p̂'}</text>
            <line x1={G.px[0] - half - 10} y1={G.pBase - G.pH} x2={G.px[2] + half + 10} y2={G.pBase - G.pH} className="dltt-sm-one" />
            <text x={G.px[0] - half - 14} y={G.pBase - G.pH + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m dltt-t--p">1</text>
            <line x1={G.px[0] - half - 10} y1={G.pBase} x2={G.px[2] + half + 10} y2={G.pBase} className="dltt-sm-base" />
          </g>
          {p.map((v, i) => (
            <g key={`p${i}`}>
              <rect x={G.px[i] - half} y={G.pBase - v * G.pH} width={G.bw} height={Math.max(0.5, v * G.pH)} className={`dltt-sm-p ${grow(b >= 3)}`} />
              <text x={G.px[i]} y={G.pIdxY} textAnchor="middle" className={`dltt-t dltt-t--xs ${vis(b >= 3)}`}>{i + 1}</text>
            </g>
          ))}

          {/* the shares as one 100% strip */}
          <g className={vis(b >= 3)}>
            {narrow
              ? <ShareStrip vertical x={G.vstrip.x} y={G.vstrip.y} len={G.vstrip.len} thick={28} p={p} names={NAMES} />
              : <ShareStrip x={G.strip.x} y={G.strip.y} len={G.strip.len} thick={24} p={p} names={NAMES} />}
          </g>
        </svg>
      </div>
    </Stage>
  );
}
