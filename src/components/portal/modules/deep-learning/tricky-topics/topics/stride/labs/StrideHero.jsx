import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';
import { useWidth } from '../../../useWidth';
import StripView from './StripView';
import { windows } from '../../../maths/strideRules.js';
import './stride.css';

/* The opener's hero: a window of 3 hops along a strip of 9 inputs, 2 at a
   time. Each hop fills one output; four positions, four outputs. */

const N = 9;
const K = 3;
const S = 2;
const OUT = windows(N, K, S, 'valid').out;

export function StrideHero({ run }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const beat = useHeroBeats(OUT + 1, { run, ref, ms: 950 });
  const W = narrow ? 340 : 640;
  const shown = Math.min(beat + 1, OUT);
  return (
    <div ref={wrap}>
      <svg ref={ref} className="dltt-svg" viewBox={`0 0 ${W} 190`} role="img" aria-label={`A window of ${K} moving ${S} at a time over ${N} inputs: ${OUT} outputs`}>
        <StripView x={narrow ? 10 : 70} y={20} n={N} k={K} s={S} width={narrow ? 320 : 500} mode="hops" hot={beat < OUT ? beat : null} reveal={shown} idPrefix="hero" />
        <text x={W / 2} y={178} textAnchor="middle" className="dltt-t dltt-t--s">
          <tspan className="dltt-t--b">{shown}</tspan> of {OUT} outputs · kernel {K}, <tspan className="dltt-t--jump dltt-t--b">stride {S}</tspan>
        </text>
      </svg>
    </div>
  );
}
