import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { Rich } from '../../../Rich';
import { softmax, exps } from '../../../maths/softmax.js';
import { num, score, tex, texScore, sum, Z_WALK } from './sm.js';
import './softmax.css';

/* Step 2 · the formula by hand. The calculator walk for z = (2, 1, 0.1) as
   a ruled table (scores, exponentials, the total, the shares), and one
   control: a shift c added to every score. The score and exponential
   columns change (they flash), the total changes, the shares don't: e^c
   cancels top and bottom. */

const C_FOR_PRINT = 3;

export function ByHandLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [cv, setC] = useState(0);
  const c = printing ? 0 : cv;
  const zc = Z_WALK.map((v) => v + c);
  const e = exps(zc);
  const total = sum(e);
  const p = softmax(zc);
  const factor = exps([c])[0];
  // the drawer's worked shift (the live c, or c = 3 when c is 0)
  const cw = c === 0 ? C_FOR_PRINT : c;
  const ew = exps(Z_WALK.map((v) => v + cw));
  const pw = softmax(Z_WALK.map((v) => v + cw));
  const W = narrow ? 340 : 760;
  return (
    <Stage
      title="Exponentiate, add up, divide"
      prov="{s|L8 · slide 25} {own} {beyond}"
      tryThis="Predict what adding 3 to every score does to the shares, then drag c and watch which columns change."
      caption="Adding $c$ to every score multiplies every exponential, and their total, by $e^{c}$, so it cancels and the shares never move {beyond}. Software uses this: it subtracts the largest score first, so $e^{z}$ never overflows {beyond}."
      challenge={{ text: 'Push the biggest exponential past 100. Do the shares notice?', done: e[0] > 100 }}
      maths={
        <>
          <MEq tex={'\\hat{p}_k = \\frac{\\exp(z_k)}{\\sum_{j=1}^{K} \\exp(z_j)}'} />
          <MLine text="L8 prints this formula for the attention weights, $\alpha_{(t,i)} = \exp(e_{(t,i)}) / \sum_{i'} \exp(e_{(t,i')})$ {s|L8 · slide 25}; written for an output layer’s $\hat{p}_k$ it is beyond the slides {beyond}." />
          <MLine text={`The walk: ${Z_WALK.map((v, k) => `$e^{${texScore(v)}} = ${tex(exps(Z_WALK)[k], 3)}$`).join(', ')}; total $${tex(sum(exps(Z_WALK)), 3)}$; $\\hat{p} = (${softmax(Z_WALK).map((v) => tex(v, 3)).join(', ')})$ {own}.`} />
          <MLine text={`Shift every score by $c = ${texScore(cw)}$: $e^{z + c} = (${ew.map((v) => tex(v, 3)).join(', ')})$, total $${tex(sum(ew), 3)}$, and still $\\hat{p} = (${pw.map((v) => tex(v, 3)).join(', ')})$.`} />
          <MLine text="Why: $\dfrac{e^{z_k + c}}{\sum_j e^{z_j + c}} = \dfrac{e^{c}\, e^{z_k}}{e^{c} \sum_j e^{z_j}} = \dfrac{e^{z_k}}{\sum_j e^{z_j}}$ {beyond}." />
        </>
      }
    >
      <div ref={wrap}>
        <p className="dltt-sm-formula"><Rich text={'$\\hat{p}_k = \\exp(z_k + c) / \\sum_{j} \\exp(z_j + c)$'} /></p>
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
        <p className="dltt-sm-walk__note" aria-live="polite">
          {c === 0
            ? <Rich text={`$c = 0$: the walk from the Read beat, $z = (${Z_WALK.map(texScore).join(', ')})$.`} />
            : <Rich text={`$c = ${texScore(c)}$: every $e^{z}$ and the total are $\\times\\, e^{c} = ${tex(factor, 3)}$; every $\\hat{p}$ is the same as at $c = 0$.`} />}
        </p>
        <svg className="dltt-svg" viewBox={`0 0 ${W} 84`} role="group" aria-label="The shift c added to every score">
          <text x={20} y={14} className="dltt-t dltt-t--s">c, added to every score</text>
          <Scrub
            x0={40}
            x1={W - 40}
            y={52}
            value={c}
            min={-3}
            max={3}
            step={0.5}
            big={1}
            onChange={setC}
            label="Shift c added to every score"
            ticks={[-3, 0, 3]}
            tickLabel={score}
            show={(v) => `c = ${score(v)}`}
          />
        </svg>
      </div>
    </Stage>
  );
}
