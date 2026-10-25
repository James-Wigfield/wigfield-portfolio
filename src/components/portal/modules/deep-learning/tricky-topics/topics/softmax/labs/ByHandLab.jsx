import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Scrub, Arrow } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { Rich } from '../../../Rich';
import { softmax, exps } from '../../../maths/softmax.js';
import { num, score, tex, texScore, sum, Z_WALK } from './sm.js';
import './softmax.css';

/* Step 2 · the formula by hand, as a picture. One control: a shift c added
   to every score. Three groups of bars, left to right: the scores z + c
   (they all rise by c), their exponentials (all × e^c, on a fixed axis, so
   they visibly grow or shrink together), and the shares p̂ (pinned: e^c
   cancels top and bottom). A dashed mark on every bar is its level at
   c = 0, so the p̂ bars sit exactly on theirs. The calculator walk (the
   ruled table) lives in the maths drawer. Opens (and prints) at c = 1.5. */

const C_MIN = -3;
const C_MAX = 2;
const C_START = 1.5;
const Z_MIN = -3;
const Z_MAX = 4;
// the exponentials' fixed axis: the biggest e^(z + c) the scrubber can reach
const E_TOP = exps([Math.max(...Z_WALK) + C_MAX])[0];
const E0 = exps(Z_WALK);
const P0 = softmax(Z_WALK);
const TOTAL0 = sum(E0);

const WIDE = {
  W: 760, H: 300, bw: 34, yTop: 52, yBot: 222, base: 222, eH: 170, pH: 170, idxY: 240, fs: 11,
  kx: [66, 126, 186], ex: [326, 386, 446], px: [596, 656, 716],
  titles: [[30, 'scores z + c'], [290, 'exp(z + c)'], [560, 'shares p̂']],
  arrows: [[214, 278, 'exp'], [478, 546, '÷ total']], ay: 140,
  brk: 250, totY: 274, factorY: 290, keepY: 274, legend: [30, 286],
};
const NARROW = {
  W: 340, H: 296, bw: 20, yTop: 46, yBot: 210, base: 210, eH: 164, pH: 164, idxY: 226, fs: 9.5,
  kx: [28, 56, 84], ex: [142, 170, 198], px: [256, 284, 312],
  titles: [[10, 'z + c'], [124, 'exp(z + c)'], [238, 'p̂']],
  arrows: [[100, 120, ''], [214, 234, '']], ay: 128,
  brk: 234, totY: 254, factorY: 268, keepY: 254, legend: [12, 286],
};

export function ByHandLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [cv, setC] = useState(C_START);
  const c = printing ? C_START : cv;
  const zc = Z_WALK.map((v) => v + c);
  const e = exps(zc);
  const total = sum(e);
  const p = softmax(zc);
  const factor = exps([c])[0];
  const G = narrow ? NARROW : WIDE;
  const half = G.bw / 2;
  const toY = (v) => G.yBot - ((v - Z_MIN) / (Z_MAX - Z_MIN)) * (G.yBot - G.yTop);
  const zero = toY(0);
  const eY = (v) => G.base - (v / E_TOP) * G.eH;
  const pY = (v) => G.base - v * G.pH;
  const eLab = (v) => num(v, narrow ? 1 : 3);
  const pLab = (v) => num(v, narrow ? 2 : 3);
  // a value label that glides with its bar
  const label = (x, y, text, role) => (
    <g className="dltt-sm-glide" style={{ transform: `translateY(${y}px)` }}>
      <text x={x} y={0} textAnchor="middle" className={`dltt-t dltt-t--m dltt-t--b dltt-t--${role} dltt-halo dltt-sm-num`} style={{ fontSize: G.fs }}>{text}</text>
    </g>
  );
  const over = narrow ? 3 : 6;
  const pin = (x, y) => <line x1={x - half - over} y1={y} x2={x + half + over} y2={y} className="dltt-sm-pin" />;
  const W = G.W;
  return (
    <Stage
      title="Exponentiate, add up, divide"
      prov="{s|L8 · slide 25} {own} {beyond}"
      tryThis="Predict which bars move when you add the same c to every score, then drag c."
      caption="Adding $c$ to every score multiplies every exponential, and their total, by $e^{c}$, so it cancels and the shares never move {beyond}. Software uses this: it subtracts the largest score first, so $e^{z}$ never overflows {beyond}."
      challenge={{ text: 'Make the exponentials add up to less than 1. Do the shares notice?', done: total < 1 }}
      maths={
        <>
          <MEq tex={'\\hat{p}_k = \\frac{\\exp(z_k)}{\\sum_{j=1}^{K} \\exp(z_j)}'} />
          <MLine text="L8 prints this formula for the attention weights, $\alpha_{(t,i)} = \exp(e_{(t,i)}) / \sum_{i'} \exp(e_{(t,i')})$ {s|L8 · slide 25}; written for an output layer’s $\hat{p}_k$ it is beyond the slides {beyond}." />
          <table className="dltt-sm-walk">
            <thead>
              <tr>
                <th>class</th>
                <th><Rich text="$z_k + c$" /></th>
                <th><Rich text="$e^{z_k + c}$" /></th>
                <th><Rich text="$\hat{p}_k$" /></th>
              </tr>
            </thead>
            <tbody>
              {zc.map((v, k) => (
                <tr key={k}>
                  <td className="dltt-sm-c--k">{k + 1}</td>
                  <td key={`z${c}`} className="dltt-sm-c--z dltt-sm-flash">{score(v)}</td>
                  <td key={`e${c}`} className="dltt-sm-c--e dltt-sm-flash">{num(e[k], 3)}</td>
                  <td className="dltt-sm-c--p">
                    <span className="dltt-sm-pcell">
                      <span className="dltt-sm-ptrack" aria-hidden="true"><span className="dltt-sm-pbar" style={{ width: `${p[k] * 100}%` }} /></span>
                      {num(p[k], 3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>total</td>
                <td />
                <td key={`t${c}`} className="dltt-sm-c--e dltt-sm-flash">{num(total, 3)}</td>
                <td className="dltt-sm-c--p">{num(sum(p), 3)}</td>
              </tr>
            </tfoot>
          </table>
          <MLine
            text={c === 0
              ? `$c = 0$: the walk from the Read beat, $z = (${Z_WALK.map(texScore).join(', ')})$.`
              : `$c = ${texScore(c)}$: every $e^{z}$ and the total are $\\times\\, e^{c} = ${tex(factor, 3)}$; every $\\hat{p}$ is the same as at $c = 0$.`}
          />
          <MLine text={`The walk at $c = 0$: ${Z_WALK.map((v, k) => `$e^{${texScore(v)}} = ${tex(E0[k], 3)}$`).join(', ')}; total $${tex(TOTAL0, 3)}$; $\\hat{p} = (${P0.map((v) => tex(v, 3)).join(', ')})$ {own}.`} />
          <MLine text="Why: $\dfrac{e^{z_k + c}}{\sum_j e^{z_j + c}} = \dfrac{e^{c}\, e^{z_k}}{e^{c} \sum_j e^{z_j}} = \dfrac{e^{z_k}}{\sum_j e^{z_j}}$ {beyond}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg
          className="dltt-svg"
          viewBox={`0 0 ${W} ${G.H}`}
          role="img"
          aria-label={`c = ${score(c)}: scores ${zc.map(score).join(', ')}; exponentials ${e.map((v) => num(v, 3)).join(', ')}, total ${num(total, 3)}; shares ${p.map((v) => num(v, 3)).join(', ')}, the same as at c = 0`}
        >
          {G.titles.map(([x, t], i) => (
            <text key={t} x={x} y={narrow ? 22 : 26} className={`dltt-t dltt-t--b ${i === 2 ? 'dltt-t--p' : 'dltt-t--data'}`}>{t}</text>
          ))}
          {G.arrows.map(([x1, x2, t], i) => (
            <g key={`a${i}`}>
              <Arrow x1={x1} y1={G.ay} x2={x2} y2={G.ay} role={i === 1 ? 'p' : 'data'} />
              {t && <text x={(x1 + x2) / 2} y={G.ay - 12} textAnchor="middle" className="dltt-t dltt-t--s dltt-t--m">{t}</text>}
            </g>
          ))}

          {/* scores z + c: signed bars on a zero line, all shifted by c */}
          <line x1={G.kx[0] - half - 8} y1={zero} x2={G.kx[2] + half + 8} y2={zero} className="dltt-sm-zero" />
          {!narrow && <text x={G.kx[0] - half - 12} y={zero + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">0</text>}
          {zc.map((v, k) => {
            const vy = toY(v);
            return (
              <g key={`z${k}`}>
                <rect x={G.kx[k] - half} y={Math.min(vy, zero)} width={G.bw} height={Math.max(1, Math.abs(vy - zero))} className="dltt-sm-zbar dltt-sm-geo" />
                {pin(G.kx[k], toY(Z_WALK[k]))}
                {label(G.kx[k], v >= 0 ? vy - 7 : vy + 15, score(v), 'data')}
              </g>
            );
          })}

          {/* exp(z + c): one fixed axis, so they rise and fall together */}
          <line x1={G.ex[0] - half - 8} y1={G.base} x2={G.ex[2] + half + 8} y2={G.base} className="dltt-sm-base" />
          {e.map((v, k) => (
            <g key={`e${k}`}>
              <rect x={G.ex[k] - half} y={eY(v)} width={G.bw} height={Math.max(0.5, G.base - eY(v))} className="dltt-sm-e dltt-sm-geo" />
              {pin(G.ex[k], eY(E0[k]))}
              {label(G.ex[k], Math.min(eY(v), eY(E0[k])) - 7, eLab(v), 'data')}
            </g>
          ))}
          <path d={`M${G.ex[0] - half},${G.brk} v6 H${G.ex[2] + half} v-6`} className="dltt-sm-brk" />
          <text x={G.ex[1]} y={G.totY} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--data">total {num(total, narrow ? 1 : 3)}</text>
          <text x={G.ex[1]} y={G.factorY} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">= {num(TOTAL0, 3)} × e<tspan dy={-4} fontSize={8}>c</tspan></text>

          {/* shares p̂: pinned */}
          <line x1={G.px[0] - half - 8} y1={G.base} x2={G.px[2] + half + 8} y2={G.base} className="dltt-sm-base" />
          {p.map((v, k) => (
            <g key={`p${k}`}>
              <rect x={G.px[k] - half} y={pY(v)} width={G.bw} height={Math.max(0.5, v * G.pH)} className="dltt-sm-p dltt-sm-geo" />
              {pin(G.px[k], pY(P0[k]))}
              {label(G.px[k], pY(v) - 7, pLab(v), 'p')}
            </g>
          ))}
          <text x={G.px[1]} y={G.keepY} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b dltt-t--p">same as at c = 0</text>

          {/* bar numbers under each group */}
          {[G.kx, G.ex, G.px].map((xs, g) => xs.map((x, k) => (
            <text key={`i${g}${k}`} x={x} y={G.idxY} textAnchor="middle" className="dltt-t dltt-t--xs">{k + 1}</text>
          )))}

          {/* legend: the dashed mark */}
          <line x1={G.legend[0]} y1={G.legend[1] - 4} x2={G.legend[0] + 22} y2={G.legend[1] - 4} className="dltt-sm-pin" />
          <text x={G.legend[0] + 28} y={G.legend[1]} className="dltt-t dltt-t--xs">the level at c = 0</text>
        </svg>
        <svg className="dltt-svg" viewBox={`0 0 ${W} 84`} role="group" aria-label="The shift c added to every score">
          <text x={20} y={14} className="dltt-t dltt-t--s">c, added to every score</text>
          <Scrub
            x0={40}
            x1={W - 40}
            y={52}
            value={c}
            min={C_MIN}
            max={C_MAX}
            step={0.5}
            big={1}
            onChange={setC}
            label="Shift c added to every score"
            ticks={[C_MIN, 0, C_MAX]}
            tickLabel={score}
            show={(v) => `c = ${score(v)}`}
          />
        </svg>
      </div>
    </Stage>
  );
}
