import { useRef, useState } from 'react';
import { Stage, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { windows, samePad } from '../../../maths/strideRules.js';
import StripView from './StripView';
import { stripHeight } from '../strip.js';
import './stride.css';

/* Step 2 · Figure 14-8, rebuilt. Left "valid", right "same", drawn the way
   L3 slide 21 draws them (brackets over the strip, arrows to the outputs,
   the ignored input crossed out, zeros hatched). Opens on the figure: 10
   inputs, kernel 7, stride 2 → 2 outputs (one input ignored) and 5 outputs
   (2 zeros left, 3 right). Three controls: n, k, s. */

const FIG = { n: 10, k: 7, s: 2 };

export function Fig148Lab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const { printing } = useStudy();
  const [v, setV] = useState(FIG);
  const [hot, setHot] = useState({ side: null, i: null });
  const { n, k, s } = printing ? FIG : v;
  const isFig = n === FIG.n && k === FIG.k && s === FIG.s;
  const valid = windows(n, k, s, 'valid');
  const same = windows(n, k, s, 'same');
  const pad = samePad(n, k, s);
  const W = narrow ? 340 : 800;
  const sw = narrow ? 320 : 380;
  const hV = stripHeight(n, k, s, 'valid', sw);
  const hS = stripHeight(n, k, s, 'same', sw);
  const H = narrow ? hV + hS + 110 : Math.max(hV, hS) + 60;
  const set = (key) => (val) => setV((p) => ({ ...p, [key]: val }));
  return (
    <Stage
      title="Figure 14-8: “valid” drops inputs, “same” pads zeros"
      prov={isFig ? '{s|L3 · slide 21}' : '{s|L3 · slide 21} {own}'}
      tryThis="Read the figure first: count the outputs on each side. Then change n, k and s and predict both counts before you look."
      caption={`"valid": ${valid.out} output${valid.out === 1 ? '' : 's'}${valid.ignored.length ? `, ${valid.ignored.length} input${valid.ignored.length > 1 ? 's' : ''} ignored` : ''}. "same": ${pad.left} zero${pad.left === 1 ? '' : 's'} left, ${pad.right} right, ${same.out} outputs: still fewer than the ${n} inputs whenever the stride is above 1.`}
      challenge={{ text: 'Make "same" give exactly as many outputs as inputs.', done: same.out === n }}
      maths={
        <>
          <MLine text={`"valid": $\\lfloor (${n} - ${k}) / ${s} \\rfloor + 1 = ${valid.out}$ {beyond}.`} />
          <MLine text={`"same": $\\lceil ${n} / ${s} \\rceil = ${same.out}$; it pads $(${same.out} - 1) \\times ${s} + ${k} - ${n} = ${pad.total}$ zeros, ${pad.left} on the left and ${pad.right} on the right (the odd one on the right: TensorFlow’s rule) {beyond}.`} />
          <MLine text="Slide 21: 10 inputs, kernel 7, stride 2 give 2 outputs (one ignored) and 5 outputs (2 + 3 zeros) {s|L3 · slide 21}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n} inputs, kernel ${k}, stride ${s}: valid gives ${valid.out} outputs, same gives ${same.out}`}>
          {isFig || printing ? null : (
            <text x={W - 14} y={14} textAnchor="end" className="dltt-t dltt-t--xs">your own n, k, s</text>
          )}
          <g transform={`translate(${narrow ? 10 : 10} 10)`}>
            <StripView x={0} y={0} n={n} k={k} s={s} pad="valid" width={sw} hot={hot.side === 'v' ? hot.i : null} onHot={(i) => setHot({ side: 'v', i })} idPrefix="f148v" />
            <text x={sw / 2} y={hV + 16} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--s">padding="valid", kernel_size={k}, strides={s}</text>
          </g>
          <g transform={`translate(${narrow ? 10 : sw + 30} ${narrow ? hV + 50 : 10})`}>
            <StripView x={0} y={0} n={n} k={k} s={s} pad="same" width={sw} hot={hot.side === 's' ? hot.i : null} onHot={(i) => setHot({ side: 's', i })} idPrefix="f148s" />
            <text x={sw / 2} y={hS + 16} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--s">padding="same", kernel_size={k}, strides={s}</text>
          </g>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 176 : 64}`} role="group" aria-label="Inputs, kernel and stride">
          {[
            ['inputs n', n, 3, 16, set('n'), 'Number of inputs'],
            ['kernel k', k, 1, 7, set('k'), 'Kernel size'],
            ['stride s', s, 1, 4, set('s'), 'Stride'],
          ].map(([lab, val, lo, hi, on, aria], i) => {
            const x0 = narrow ? 30 : 30 + i * (W / 3);
            const x1 = narrow ? W - 30 : (i + 1) * (W / 3) - 30;
            const y = narrow ? 40 + i * 56 : 40;
            return (
              <g key={lab}>
                <text x={x0 - 10} y={y - 24} className={`dltt-t dltt-t--s${lab.startsWith('stride') ? ' dltt-t--jump' : ''}`}>{lab}</text>
                <Scrub x0={x0} x1={x1} y={y} value={val} min={lo} max={Math.max(hi, lo)} step={1} onChange={(nv) => on(lab.startsWith('kernel') ? Math.min(nv, n) : nv)} label={aria} ticks={[lo, hi]} />
              </g>
            );
          })}
        </svg>
        {!isFig && !printing && (
          <button type="button" className="dltt-qbtn" onClick={() => setV(FIG)}>back to Figure 14-8</button>
        )}
      </div>
    </Stage>
  );
}
