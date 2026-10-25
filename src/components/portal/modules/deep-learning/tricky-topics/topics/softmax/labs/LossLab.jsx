import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Knob, Arrow } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { softmax, crossEntropy, argmax } from '../../../maths/softmax.js';
import { num, score, tex, texScore } from './sm.js';
import './softmax.css';

/* Step 4 · softmax, cross-entropy and argmax. Three classes; class 2 is the
   true one. One knob drags its score; the probability bars follow, the
   argmax caret sits on the tallest bar, and beside them the loss −log p̂
   of the true class is a dot riding the curve. The other two scores are
   this page's own toy numbers and stay put. */

const TRUE = 1;
const FIXED = [1.5, null, 0.5];
const START = 0.5;
const KMIN = -2;
const KMAX = 6;
const LMAX = 4;
// the curve −log p, sampled evenly in loss from LMAX down to 0 (crossEntropy does the maths)
const CURVE = Array.from({ length: 80 }, (_, i) => {
  const pp = Math.exp(-LMAX * (1 - i / 79));
  return [pp, crossEntropy([pp], 0)];
});

const WIDE = {
  W: 760, H: 344, kx: [70, 130, 190], yTop: 50, yBot: 250, px: [320, 380, 440], base: 250, pH: 180, bw: 30,
  ta: [40, 28], tb: [290, 28], idxY: 290, trueY: 306, stat: [380, 332],
  c: { x0: 540, x1: 730, y0: 250, y1: 60, title: [520, 28], xl: 292 },
};
const NARROW = {
  W: 340, H: 578, kx: [36, 86, 136], yTop: 50, yBot: 226, px: [215, 265, 315], base: 226, pH: 156, bw: 26,
  ta: [10, 26], tb: [190, 26], idxY: 262, trueY: 278, stat: [170, 304],
  c: { x0: 56, x1: 316, y0: 530, y1: 356, title: [10, 338], xl: 568 },
};

export function LossLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [zt, setZt] = useState(START);
  const v = printing ? START : zt;
  const z = FIXED.map((f) => (f === null ? v : f));
  const p = softmax(z);
  const loss = crossEntropy(p, TRUE);
  const k = argmax(p);
  const G = narrow ? NARROW : WIDE;
  const half = G.bw / 2;
  const toY = (s) => G.yBot - ((s - KMIN) / (KMAX - KMIN)) * (G.yBot - G.yTop);
  const zero = toY(0);
  const C = G.c;
  const X = (pp) => C.x0 + pp * (C.x1 - C.x0);
  const Y = (l) => C.y0 - (Math.min(l, LMAX) / LMAX) * (C.y0 - C.y1);
  const path = CURVE.map(([pp, l], i) => `${i ? 'L' : 'M'}${X(pp).toFixed(1)},${Y(l).toFixed(1)}`).join(' ');
  const dx = X(p[TRUE]);
  const dy = Y(loss);
  const topK = G.base - p[k] * G.pH;
  return (
    <Stage
      title="Push up the true class, watch the loss fall"
      prov="{s|L1 · slide 29} {s|L1 · slide 40} {own}"
      tryThis="Predict how high class 2’s score must go before argmax picks it, then drag its bar."
      caption="Raising the true class’s score raises its share, and the loss slides down the curve towards 0 without ever reaching it. Argmax only asks which bar is tallest, so the prediction flips the moment class 2 overtakes class 1."
      challenge={{ text: 'Get the loss under 0.1.', done: loss < 0.1 }}
      maths={
        <>
          <MEq tex={'J(\\boldsymbol{\\theta}) = -\\frac{1}{m}\\sum_{i=1}^{m}\\sum_{k=1}^{K} y_k^{(i)} \\log\\left(\\hat{p}_k^{(i)}\\right)'} />
          <MLine text={`One example whose true class is 2, so $\\mathbf{y} = (0, 1, 0)$ and only $k = 2$ survives: $J = -\\log \\hat{p}_2 = -\\log ${tex(p[TRUE], 3)} = ${tex(loss, 3)}$ {s|L1 · slide 29}.`} />
          <MLine text={`Scores $(${z.map(texScore).join(', ')})$ give $\\hat{p} = (${p.map((x) => tex(x, 3)).join(', ')})$ {own}; \`argmax\` picks the tallest, class ${k + 1} (index ${k}) {s|L1 · slide 40}.`} />
          <MLine text={'Keras trains this with `loss="sparse_categorical_crossentropy"` and integer class labels {s|L1 · slide 37}.'} />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`True class 2 has probability ${num(p[TRUE], 2)}, loss ${num(loss, 2)}; argmax picks class ${k + 1}`}>
          {/* the scores: class 2's bar is the handle */}
          <text x={G.ta[0]} y={G.ta[1]} className="dltt-t dltt-t--b dltt-t--data">scores z</text>
          <line x1={G.kx[0] - half - 10} y1={zero} x2={G.kx[2] + half + 10} y2={zero} className="dltt-sm-zero" />
          <text x={G.kx[0] - half - 14} y={zero + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">0</text>
          {z.map((s, i) => {
            const sy = toY(s);
            return (
              <g key={`z${i}`}>
                <rect x={G.kx[i] - half} y={G.yTop} width={G.bw} height={G.yBot - G.yTop} className="dltt-sm-track" />
                <rect x={G.kx[i] - half} y={Math.min(sy, zero)} width={G.bw} height={Math.max(1, Math.abs(sy - zero))} className={i === TRUE ? 'dltt-sm-zbar' : 'dltt-sm-zbar dltt-sm-zbar--fixed'} />
                <text x={G.kx[i]} y={s >= 0 ? sy - 13 : sy + 22} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--data dltt-halo">{score(s)}</text>
                {i === TRUE && <Knob x={G.kx[i]} yTop={G.yTop} yBot={G.yBot} value={v} min={KMIN} max={KMAX} onChange={setZt} label="Score of the true class, class 2" className="dltt-sm-knob" />}
                <text x={G.kx[i]} y={G.idxY} textAnchor="middle" className="dltt-t dltt-t--xs">{i + 1}</text>
              </g>
            );
          })}
          <text x={G.kx[TRUE]} y={G.trueY} textAnchor="middle" className="dltt-t dltt-t--xs dltt-sm-true">true</text>

          {!narrow && (
            <g>
              <Arrow x1={222} y1={150} x2={284} y2={150} role="p" />
              <text x={253} y={140} textAnchor="middle" className="dltt-t dltt-t--s dltt-t--m">softmax</text>
            </g>
          )}

          {/* the probabilities, the argmax caret on the tallest */}
          <text x={G.tb[0]} y={G.tb[1]} className="dltt-t dltt-t--b dltt-t--p">shares p̂</text>
          <line x1={G.px[0] - half - 10} y1={G.base - G.pH} x2={G.px[2] + half + 10} y2={G.base - G.pH} className="dltt-sm-one" />
          <text x={G.px[0] - half - 14} y={G.base - G.pH + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m dltt-t--p">1</text>
          <line x1={G.px[0] - half - 10} y1={G.base} x2={G.px[2] + half + 10} y2={G.base} className="dltt-sm-base" />
          {p.map((x, i) => (
            <g key={`p${i}`}>
              <rect x={G.px[i] - half} y={G.base - x * G.pH} width={G.bw} height={Math.max(0.5, x * G.pH)} className={i === TRUE ? 'dltt-sm-p' : 'dltt-sm-p dltt-sm-p--soft'} />
              <text x={G.px[i]} y={G.idxY} textAnchor="middle" className="dltt-t dltt-t--xs">{i + 1}</text>
            </g>
          ))}
          <text x={G.px[TRUE]} y={G.trueY} textAnchor="middle" className="dltt-t dltt-t--xs dltt-sm-true">true</text>
          <polygon points={`${G.px[k] - 6},${topK - 15} ${G.px[k] + 6},${topK - 15} ${G.px[k]},${topK - 6}`} className="dltt-sm-caret" />
          <text x={G.px[k]} y={topK - 20} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b dltt-t--ink">argmax</text>
          <text x={G.stat[0]} y={G.stat[1]} textAnchor="middle" className={`dltt-t dltt-t--s dltt-t--b ${k === TRUE ? 'dltt-sm-true' : 'dltt-sm-warn'}`}>
            argmax picks class {k + 1}: {k === TRUE ? 'right' : 'wrong'}
          </text>

          {/* the loss −log p̂ of the true class */}
          <text x={C.title[0]} y={C.title[1]} className="dltt-t dltt-t--b">loss = −log p̂ of the true class</text>
          <line x1={C.x0} y1={C.y0} x2={C.x1} y2={C.y0} className="dltt-ax" />
          <line x1={C.x0} y1={C.y0} x2={C.x0} y2={C.y1} className="dltt-ax" />
          {[0, 0.5, 1].map((t) => (
            <text key={`x${t}`} x={X(t)} y={C.y0 + 16} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{t}</text>
          ))}
          {[0, 2, 4].map((t) => (
            <text key={`y${t}`} x={C.x0 - 8} y={Y(t) + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">{t}</text>
          ))}
          <text x={(C.x0 + C.x1) / 2} y={C.xl} textAnchor="middle" className="dltt-t dltt-t--xs">p̂ of the true class</text>
          <path d={path} className="dltt-sm-curve" />
          <line x1={dx} y1={dy} x2={dx} y2={C.y0} className="dltt-sm-guide" />
          <line x1={C.x0} y1={dy} x2={dx} y2={dy} className="dltt-sm-guide" />
          <circle cx={dx} cy={dy} r={6} className="dltt-sm-dot" />
          {/* the readout sits top right, where a falling convex curve never goes */}
          <text x={C.x1} y={C.y1 + 4} textAnchor="end" className="dltt-t dltt-t--m dltt-t--b dltt-t--p">p̂ = {num(p[TRUE], 2)}</text>
          <text x={C.x1} y={C.y1 + 28} textAnchor="end" className="dltt-t dltt-t--m dltt-t--b" style={{ fontSize: 18 }}>loss {num(loss, 2)}</text>
        </svg>
      </div>
    </Stage>
  );
}
