import { useRef, useState } from 'react';
import { Stage, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { windows } from '../../../maths/strideRules.js';
import StripView from './StripView';
import { stripHeight } from '../strip.js';
import './stride.css';

/* Step 1 · the sliding window. A window of k inputs hops along a strip of
   12, s at a time: the ghost frames are every position it lands on, the hop
   arcs its jumps, the cells above one output per position. Hover a window
   or an output to light its inputs. Two controls: stride and kernel size.
   No padding here ("valid"); padding is step 2. */

const N = 12;

export function SlideLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [sRaw, setS] = useState(2);
  const [kRaw, setK] = useState(3);
  const [hot, setHot] = useState(null);
  const s = printing ? 2 : sRaw;
  const k = printing ? 3 : kRaw;
  const W = narrow ? 340 : 720;
  const sw = narrow ? 320 : 600;
  const res = windows(N, k, s, 'valid');
  const h = stripHeight(N, k, s, 'valid', sw, 'hops');
  return (
    <Stage
      title="The window jumps s inputs at a time"
      prov="{s|L3 · slides 9, 14} {own}"
      tryThis="Predict how many outputs stride 3 gives, then drag the stride. Hover a window, or tab through the outputs, to see which inputs each reads."
      caption={`Stride ${s}: the window starts ${s} input${s > 1 ? 's' : ''} further along each time, so ${res.out} positions give ${res.out} outputs${res.ignored.length ? `, and ${res.ignored.length} input${res.ignored.length > 1 ? 's are' : ' is'} never read` : ''}.`}
      challenge={{ text: 'Keep the kernel at 3 and find a stride that reads every input.', done: k === 3 && res.ignored.length === 0 }}
      maths={
        <>
          <MLine text={`Output $i$ reads inputs $i \\times ${s}$ to $i \\times ${s} + ${k - 1}$ (slide 9’s rule with $f = ${k}$) {s|L3 · slide 9}.`} />
          <MLine text={`The last window must fit: $\\lfloor (${N} - ${k}) / ${s} \\rfloor + 1 = ${res.out}$ outputs (the "valid" rule, step 4) {beyond}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${h + 30}`} role="img" aria-label={`${N} inputs, kernel ${k}, stride ${s}: ${res.out} outputs`}>
          <StripView x={(W - sw) / 2} y={14} n={N} k={k} s={s} width={sw} mode="hops" hot={hot} onHot={setHot} idPrefix="slide" />
          <text x={W / 2} y={h + 26} textAnchor="middle" className="dltt-t dltt-t--s">{N} inputs → <tspan className="dltt-t--b">{res.out}</tspan> outputs</text>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 120 : 64}`} role="group" aria-label="Stride and kernel size">
          <text x={20} y={16} className="dltt-t dltt-t--s dltt-t--jump">stride s</text>
          <Scrub x0={30} x1={narrow ? W - 30 : W / 2 - 40} y={40} value={s} min={1} max={4} step={1} onChange={setS} label="Stride" ticks={[1, 2, 3, 4]} />
          <text x={narrow ? 20 : W / 2 + 10} y={narrow ? 76 : 16} className="dltt-t dltt-t--s">kernel k</text>
          <Scrub x0={narrow ? 30 : W / 2 + 20} x1={W - 30} y={narrow ? 100 : 40} value={k} min={1} max={6} step={1} onChange={setK} label="Kernel size" ticks={[1, 6]} />
        </svg>
      </div>
    </Stage>
  );
}
