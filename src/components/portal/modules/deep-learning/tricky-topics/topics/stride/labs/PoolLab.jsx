import { useRef } from 'react';
import { Stage, StoryBar, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStory } from '../../../story';
import { poolOut } from '../../../maths/strideRules.js';
import './stride.css';

/* Step 5 · max pooling 2 × 2, stride 2, as a story: Figure 14-9's 6 × 9
   grid (toy values, this page's own). The window takes the maximum, jumps 2
   across and 2 down; the 9th column has no full window, so it is dropped
   and fades out. The result is 3 × 4. */

const ROWS = 6;
const COLS = 9;
const P = 2;
const BASE = [3, 7, 1, 8, 2, 9, 4, 6, 5];
const VAL = Array.from({ length: ROWS }, (_, i) => Array.from({ length: COLS }, (_, j) => BASE[(j * 2 + i * 5) % 9]));
const OR = poolOut(ROWS, P, P, 'valid');
const OC = poolOut(COLS, P, P, 'valid');
const maxAt = (r, c) => Math.max(VAL[2 * r][2 * c], VAL[2 * r][2 * c + 1], VAL[2 * r + 1][2 * c], VAL[2 * r + 1][2 * c + 1]);

export function PoolLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const beats = [
    { label: 'First window', say: 'A 2 × 2 window on the top-left corner keeps only its maximum: one output.' },
    { label: 'Jump 2 across', say: 'The stride defaults to the pool size, so the window jumps 2 columns: no overlap, no gaps.' },
    { label: 'Row by row', say: 'Across the row, then 2 rows down: every full window gives one output.' },
    { label: 'The 9th column', say: 'Nine columns hold only four full windows: the last column is dropped (“valid”, no padding).' },
    { label: 'The result', say: `The result is ${OR} × ${OC}: height and width halved, rounded down; the depth (not drawn) is kept.` },
  ];
  const story = useStory(beats.length, { start: -1 }); // opens empty: predict, then play
  const b = story.beat;
  const cell = narrow ? 26 : 34;
  const gx = 20;
  const gy = 24;
  const ox = narrow ? 20 : gx + COLS * cell + 60;
  const oy = narrow ? gy + ROWS * cell + 50 : gy + cell;
  const W = narrow ? 340 : 760;
  const H = narrow ? oy + OR * cell + 30 : gy + ROWS * cell + 30;
  // which outputs are filled at this beat, and where the window is
  const filled = b < 0 ? 0 : b === 0 ? 1 : b === 1 ? 2 : b === 2 ? OR * OC : OR * OC;
  const win = b === 0 ? [0, 0] : b === 1 ? [0, 1] : b === 2 ? [OR - 1, OC - 1] : null;
  const dropped = b >= 3;
  return (
    <Stage
      title="Pooling jumps by its own size"
      prov="{s|L3 · slides 26, 28} {own}"
      tryThis="Before playing: how many outputs will a 6 × 9 grid give? Then play it and watch the last column."
      story={<StoryBar story={story} beats={beats} />}
      caption="Pooling has no weights: it only takes the maximum (or the mean) of each window. With the default stride equal to the pool size, MaxPool2D(2) halves height and width, rounding down."
      maths={
        <>
          <MLine text={`$\\lfloor (${ROWS} - 2) / 2 \\rfloor + 1 = ${OR}$ rows and $\\lfloor (${COLS} - 2) / 2 \\rfloor + 1 = ${OC}$ columns {beyond}.`} />
          <MLine text={'“By default, the strides default to the kernel size and "valid" padding (i.e., no padding at all) is assumed” {s|L3 · slide 28}. Figure 14-9: 2 × 2, stride 2, no padding; its 9th column is crossed out {s|L3 · slide 26}.'} />
          <MLine text="Slide 35’s CNN relies on it: 28 → 14 → 7 → 3 (7 ÷ 2 rounds down) {own}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={b >= 2 ? `Max pooling 2 by 2, stride 2, on a ${ROWS} by ${COLS} grid: a ${OR} by ${OC} output; the last column is dropped` : `Max pooling 2 by 2, stride 2, on a ${ROWS} by ${COLS} grid`}>
          {VAL.map((row, i) => row.map((v, j) => {
            const drop = j >= OC * P;
            const inWin = win && i >= 2 * win[0] && i < 2 * win[0] + 2 && j >= 2 * win[1] && j < 2 * win[1] + 2;
            // each full window's maximum, picked out in bold once every window has been read
            const isMax = i < OR * P && j < OC * P && v === maxAt(Math.floor(i / P), Math.floor(j / P));
            return (
              <g key={`${i}-${j}`} className={`dltt-fade${drop && dropped ? ' dltt-pool--drop' : ''}`}>
                <rect x={gx + j * cell + 1} y={gy + i * cell + 1} width={cell - 2} height={cell - 2} rx={3} className={`dltt-incell${inWin ? ' dltt-incell--hit' : ''}${drop && dropped ? ' dltt-incell--ignored' : ''}`} />
                <text x={gx + j * cell + cell / 2} y={gy + i * cell + cell / 2 + 4} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--m${isMax && (inWin || b >= 2) ? ' dltt-t--b dltt-t--ink' : ''}`}>{v}</text>
              </g>
            );
          }))}
          {b >= 2 && Array.from({ length: OR }, (_, r) => Array.from({ length: OC }, (_, c) => (
            <rect key={`b${r}-${c}`} x={gx + P * c * cell + 1} y={gy + P * r * cell + 1} width={P * cell - 2} height={P * cell - 2} rx={4} className="dltt-win dltt-win--ghost" />
          )))}
          {win && <rect x={gx + 2 * win[1] * cell} y={gy + 2 * win[0] * cell} width={2 * cell} height={2 * cell} rx={4} className="dltt-win" />}
          {b === 1 && (
            <g>
              <path d={`M${gx + cell} ${gy - 3} Q ${gx + 2 * cell} ${gy - 20} ${gx + 3 * cell} ${gy - 3}`} className="dltt-hop" />
              <text x={gx + 3 * cell + 8} y={gy - 8} className="dltt-t dltt-t--xs dltt-t--jump">stride 2</text>
            </g>
          )}
          {dropped && <text x={gx + (COLS - 0.5) * cell} y={gy - 8} textAnchor="middle" className="dltt-t dltt-t--xs">dropped</text>}
          {/* the output's size is the question, so it appears only as the story reaches it */}
          <text x={ox} y={oy - 10} className="dltt-t dltt-t--xs">output{b >= 2 ? ` ${OR} × ${OC}` : ''}</text>
          {Array.from({ length: OR }, (_, r) => Array.from({ length: OC }, (_, c) => {
            const idx = r * OC + c;
            const on = idx < filled;
            if (!on && b < 2) return null;
            return (
              <g key={`o${r}-${c}`}>
                <rect x={ox + c * cell + 1} y={oy + r * cell + 1} width={cell - 2} height={cell - 2} rx={3} className={`dltt-outcell${on ? '' : ' dltt-outcell--empty'}`} />
                {on && <text x={ox + c * cell + cell / 2} y={oy + r * cell + cell / 2 + 4} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m dltt-t--b">{maxAt(r, c)}</text>}
              </g>
            );
          }))}
        </svg>
      </div>
    </Stage>
  );
}
