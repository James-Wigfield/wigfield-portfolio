import { useMemo, useState } from 'react';
import { Lab, Chips, Stat } from '../ui';
import { useStudy } from '../context';
import { convTranspose2d, convTransposeOut, fmtInt } from '../gen';
import './labsTranspose.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LAB FOR §1: HOW A TRANSPOSED CONVOLUTION UPSAMPLES
     TransposeLab   slide 5's first two Conv2DTranspose layers, one channel
                    at a time: each input pixel stamps a weighted copy of the
                    3 × 3 kernel onto the output, 2 pixels apart (strides=2);
                    where stamps overlap they add up. "valid" keeps the whole
                    grid (3 → 7); "same" keeps n × 2 of it (7 → 14). Click an
                    input pixel to see where its stamp lands
   The kernel of ones and the input values are this page's illustration; the
   sizes are slide 5's.
   ========================================================================== */

const CASES = {
  valid: { n: 3, label: 'Conv2DTranspose(32, 3, strides=2) · 3 → 7', padding: 'valid', comment: '# output: 7 × 7 × 32' },
  same: { n: 7, label: 'Conv2DTranspose(16, 3, strides=2, padding="same") · 7 → 14', padding: 'same', comment: '# output: 14 × 14 × 16' },
};
const K = 3;
const S = 2;
const KERNEL = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];

function startInput(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => ((i * 3 + j * 2) % 3) + 1));
}
const INPUTS = { valid: startInput(3), same: startInput(7) };

function Grid({ m, cell, pick, onPick, hl, crop, label, inputGrid = false, fullN }) {
  const n = fullN ?? m.length;
  const size = n * cell;
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className="dl67s-svg dl67s-tc__grid" style={{ maxWidth: Math.min(size + 2, 330) }} role="img" aria-label={label}>
      {Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
        const inside = r < m.length && c < m.length;
        const v = inside ? m[r][c] : null;
        const on = hl?.(r, c);
        const isPick = pick && pick.r === r && pick.c === c;
        return (
          <g key={`${r}-${c}`} className={inputGrid ? 'dl67s-tc__in' : undefined} onClick={inputGrid ? () => onPick({ r, c }) : undefined}>
            <rect x={c * cell} y={r * cell} width={cell} height={cell} className={`dl67s-tc__cell${!inside ? ' dl67s-tc__cell--crop' : ''}${on ? ' dl67s-tc__cell--on' : ''}${isPick ? ' dl67s-tc__cell--pick' : ''}`} />
            {inside && cell >= 18 && <text x={c * cell + cell / 2} y={r * cell + cell / 2 + 4} textAnchor="middle" className="dl67s-tc__v">{v}</text>}
          </g>
        );
      }))}
      {crop && <text x={size - 2} y={size - 3} textAnchor="end" className="dl67s-tc__croplabel">dropped</text>}
    </svg>
  );
}

export function TransposeLab() {
  const { printing } = useStudy();
  const [which, setWhich] = useState('valid');
  const [pick, setPick] = useState({ r: 1, c: 1 });
  const c = CASES[which];
  const input = INPUTS[which];
  const res = useMemo(() => convTranspose2d(input, KERNEL, S, c.padding), [input, c.padding]);
  const p = pick.r < c.n && pick.c < c.n ? pick : { r: 0, c: 0 };
  // the output pixels the picked input pixel's stamp lands on
  const stamp = (r, cc) => r + res.crop >= p.r * S && r + res.crop < p.r * S + K && cc + res.crop >= p.c * S && cc + res.crop < p.c * S + K;
  const overlaps = res.hits.flat();
  const outCell = which === 'valid' ? 30 : 18;
  return (
    <Lab
      title="How a transposed convolution upsamples"
      slides="slide 5"
      tryThis="predict how big the output of a 3 × 3 input will be with a 3 × 3 kernel and strides=2. Then pick input pixels and watch where their stamps land; notice the pixels where two or four stamps overlap. Switch to the “same” layer."
    >
      <div className="dl-lab__controls">
        <Chips label="layer" value={which} options={[{ v: 'valid', l: 'first: 3 → 7 (padding "valid")' }, { v: 'same', l: 'second: 7 → 14 (padding "same")' }]} onChange={(v) => { setWhich(v); setPick({ r: 1, c: 1 }); }} />
      </div>
      <div className="dl67s-tc">
        <div className="dl67s-tc__side">
          <p className="dl67s-stagehead">input: {c.n} × {c.n} (one channel) · click a pixel</p>
          <Grid m={input} cell={which === 'valid' ? 34 : 22} pick={p} onPick={(q) => { if (!printing) setPick(q); }} inputGrid label={`A ${c.n} by ${c.n} input`} />
          <p className="dl67s-stagehead">kernel: 3 × 3 (all ones here)</p>
          <Grid m={KERNEL} cell={18} label="A 3 by 3 kernel of ones" />
        </div>
        <div className="dl67s-tc__main">
          <p className="dl67s-stagehead">output: {res.outN} × {res.outN}{c.padding === 'same' ? ` (the full ${res.full} × ${res.full} grid, cropped)` : ''}</p>
          <div className="dl67s-scroll">
            <Grid m={res.out} fullN={c.padding === 'same' ? res.full : undefined} crop={c.padding === 'same'} cell={outCell} hl={stamp} label={`The ${res.outN} by ${res.outN} output; the picked input pixel's 3 by 3 stamp is highlighted`} />
          </div>
        </div>
      </div>
      <div className="dl67s-stats dl67s-stats--tight">
        <Stat k="output size" v={`${res.outN} × ${res.outN}`} tone="accent" sub={c.padding === 'valid' ? `n × s + max(k − s, 0) = ${c.n} × 2 + 1 = ${convTransposeOut(c.n, K, S, 'valid')}` : `n × s = ${c.n} × 2 = ${convTransposeOut(c.n, K, S, 'same')}`} />
        <Stat k="slide 5’s comment" v={c.comment.replace('# output: ', '')} sub={c.label} />
        <Stat k="stamps per output pixel" v={`${Math.min(...overlaps)} to ${Math.max(...overlaps)}`} sub="stride 2 < kernel 3, so neighbouring stamps overlap" />
        <Stat k="parameters (32 / 16 filters)" v={which === 'valid' ? fmtInt(3 * 3 * 16 * 32 + 32) : fmtInt(3 * 3 * 32 * 16 + 16)} sub={which === 'valid' ? '3 × 3 × 16 × 32 + 32 (slide 6: 4,640)' : '3 × 3 × 32 × 16 + 16 (slide 6: 4,624)'} />
      </div>
      <p className="dl67s-cap">
        Each output number is the sum of the stamps that land on it: input value × kernel weight. A real layer has a kernel per input channel per filter and adds a bias; here
        there is one channel and the kernel is all ones, so you can follow the sums. The output-size rule, n × s + max(k − s, 0) for “valid” and n × s for “same”,
        is Keras’s, written out by this page; slide 5 only gives the sizes in its comments. With “same” (the second layer) the full grid is 15 wide and Keras keeps 14,
        dropping the last row and column (the faded edge).
      </p>
    </Lab>
  );
}
