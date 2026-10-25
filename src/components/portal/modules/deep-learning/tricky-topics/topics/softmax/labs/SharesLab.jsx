import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Knob, Arrow } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { softmax } from '../../../maths/softmax.js';
import { ShareStrip } from './SmParts';
import { num, score, tex, texScore, sum, Z_WALK } from './sm.js';
import './softmax.css';

/* Step 1 · what softmax does: the properties, not the pipeline (the
   exp → add → divide walk is step 2's). Three score bars you drag (Knobs,
   −3 … 4; the only three controls) go through softmax into ONE 100%
   strip: it is always full, every segment stays above 0 (a tiny share
   reads "<1%"), and the segments keep the scores' order. Narrow stages
   put the strip under the bars. */

const KMIN = -3;
const KMAX = 4;
const NAMES = ['class 1', 'class 2', 'class 3'];

const WIDE = {
  W: 760, H: 268, kx: [86, 156, 226], bw: 36, yTop: 50, yBot: 230, idxY: 254, ta: [46, 26],
  arrow: [276, 140, 344, 140], arrowLab: [310, 128], arrowAnchor: 'middle',
  strip: { x: 364, y: 124, len: 356, thick: 32 }, sp: [364, 92],
};
const NARROW = {
  W: 340, H: 376, kx: [70, 170, 270], bw: 40, yTop: 46, yBot: 196, idxY: 216, ta: [14, 24],
  arrow: [170, 228, 170, 264], arrowLab: [182, 250], arrowAnchor: 'start',
  strip: { x: 20, y: 294, len: 300, thick: 28 }, sp: [20, 280],
};

export function SharesLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [zs, setZs] = useState(Z_WALK);
  const z = printing ? Z_WALK : zs;
  const p = softmax(z);
  const setK = (k) => (v) => setZs((prev) => prev.map((x, i) => (i === k ? v : x)));
  const G = narrow ? NARROW : WIDE;
  const toY = (v) => G.yBot - ((v - KMIN) / (KMAX - KMIN)) * (G.yBot - G.yTop);
  const zero = toY(0);
  const half = G.bw / 2;
  const [ax1, ay1, ax2, ay2] = G.arrow;
  return (
    <Stage
      title="Scores in, shares out"
      prov="{s|L1 · slides 29–30} {own}"
      tryThis="Predict what happens to class 3’s share when you drag class 1 up, then drag any score bar."
      caption="The biggest score always gets the biggest share and the order never changes. Every share stays above 0, even for a very negative score {beyond}."
      challenge={{ text: 'Make class 2 take more than half.', done: p[1] > 0.5 }}
      maths={
        <>
          <MEq tex={'\\hat{p}_k = \\frac{\\exp(z_k)}{\\sum_{j=1}^{K} \\exp(z_j)}'} />
          <MLine text={`Here $z = (${z.map(texScore).join(', ')})$ gives $\\hat{p} = (${p.map((v) => tex(v, 3)).join(', ')})$: every one above 0, adding up to $${tex(sum(p), 3)}$, in the same order as the scores.`} />
          <MLine text="Each share is a positive exponential over a positive total, so none can reach 0 {beyond}. Computing it by hand is the next step, [the formula](#formula)." />
          <MLine text="Lecture 1 says what it does, “all the output values are probabilities and they sum to 1”, without printing the formula {s|L1 · slide 29}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Scores ${z.map(score).join(', ')} give shares ${p.map((v) => num(v, 2)).join(', ')}, filling one 100% strip`}>
          {/* the scores: drag the bars */}
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
                <text x={G.kx[i]} y={G.idxY} textAnchor="middle" className="dltt-t dltt-t--xs">{NAMES[i]}</text>
              </g>
            );
          })}

          {/* softmax */}
          <Arrow x1={ax1} y1={ay1} x2={ax2} y2={ay2} role="p" />
          <text x={G.arrowLab[0]} y={G.arrowLab[1]} textAnchor={G.arrowAnchor} className="dltt-t dltt-t--s dltt-t--m">softmax</text>

          {/* the shares: one 100% strip */}
          <text x={G.sp[0]} y={G.sp[1]} className="dltt-t dltt-t--b dltt-t--p">shares p̂</text>
          <ShareStrip x={G.strip.x} y={G.strip.y} len={G.strip.len} thick={G.strip.thick} p={p} names={NAMES} />
        </svg>
      </div>
    </Stage>
  );
}
