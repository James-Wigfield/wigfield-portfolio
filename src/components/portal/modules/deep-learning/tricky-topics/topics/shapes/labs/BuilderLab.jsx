import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { prod, showTuple } from '../../../maths/shapeRules.js';
import './shapes.css';

/* Step 1 · the tensor builder. Pick a rank and the box of numbers grows an
   axis: one number → a row → a grid → a stack of grids (channels) → two
   stacks (a batch). The tuple underneath lists one count per axis; hover or
   focus a number in it and its axis lights up in the picture. One control
   (the rank) plus the hover. Sizes are this page's toy numbers. */

const SHAPES = [[], [6], [4, 6], [4, 6, 3], [2, 4, 6, 3]];
const ROLES = [[], ['f'], ['h', 'wd'], ['h', 'wd', 'c'], ['batch', 'h', 'wd', 'c']];
const NAMES = { batch: 'batch: which example', h: 'height: which row', wd: 'width: which column', c: 'channel: which colour', f: 'features: which number' };

export function BuilderLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const { printing } = useStudy();
  const [rankRaw, setRank] = useState(3);
  const [lit, setLit] = useState(null);
  const rank = printing ? 3 : rankRaw;
  const shape = SHAPES[rank];
  const roles = ROLES[rank];
  const litRole = lit === null ? null : roles[lit];
  const cell = narrow ? 15 : 22;
  const W = narrow ? 340 : 640;
  const H = narrow ? 230 : 210;
  const ox = narrow ? 64 : 100;
  const oy = 40;
  const nB = rank === 4 ? 2 : 1;
  const nC = rank >= 3 ? 3 : 1;
  const rows = rank >= 2 ? 4 : 1;
  const cols = rank >= 1 ? 6 : 1;
  const dC = 9; // offset per channel sheet
  const groupW = cols * cell + (nC - 1) * dC + (narrow ? 18 : 30);
  const cls = (b, ch, r, c) => {
    const on =
      (litRole === 'batch' && ch === 0 && r === 0 && c === 0) ||
      (litRole === 'h' && c === 0 && ch === 0 && b === 0) ||
      (litRole === 'wd' && r === 0 && ch === 0 && b === 0) ||
      (litRole === 'c' && r === 0 && c === 0 && b === 0) ||
      (litRole === 'f' && r === 0);
    return `dltt-bcell${on ? ` dltt-bcell--on dltt-bcell--${litRole}` : ''}`;
  };
  return (
    <Stage
      title="Add an axis and the box grows a dimension"
      prov="{s|L1 · slide 36} {s|L3 · slide 16} {own}"
      tryThis="Step through the ranks, then hover (or tab to) each number in the tuple: which way does it count?"
      caption={`The shape lists one count per axis, outermost first. This one holds $${shape.length ? shape.join(' \\times ') : '1'} = ${prod(shape)}$ numbers.`}
      maths={
        <>
          <MLine text="Rank = the number of axes = the length of the tuple. `()` is one number, `(6,)` a vector (the comma makes it a tuple), `(4, 6)` a matrix." />
          <MLine text="Slide 36’s Dense layer: kernel `(784, 300)` (rank 2), biases `(300,)` (rank 1) {s|L1 · slide 36}. Slide 16: one image `[height, width, channels]`, a mini-batch `[minibatch_size, height, width, channels]` {s|L3 · slide 16}." />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Rank" value={rank} onChange={(v) => { setRank(v); setLit(null); }} options={SHAPES.map((s, r) => ({ value: r, label: `rank ${r}` }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A rank ${rank} tensor of shape ${showTuple(shape)}`}>
          {Array.from({ length: nB }, (_, b) => (
            <g key={b} transform={`translate(${ox + b * groupW} ${oy})`}>
              {Array.from({ length: nC }, (_, chR) => {
                const ch = nC - 1 - chR; // draw the back sheet first
                return (
                  <g key={ch} transform={`translate(${ch * dC} ${-ch * dC})`}>
                    {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (
                      <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell - 2} height={cell - 2} rx={3} className={cls(b, ch, r, c)} />
                    )))}
                  </g>
                );
              })}
              {rank === 0 && <text x={cell / 2 - 1} y={cell / 2 + 4} textAnchor="middle" className="dltt-t dltt-t--xs">3.7</text>}
              {/* the axes, labelled in their colours (on the first group) */}
              {b === 0 && rank >= 1 && (
                <text x={(cols * cell) / 2} y={rows * cell + 16} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--b dltt-axt--${rank === 1 ? 'f' : 'wd'}`}>{rank === 1 ? 'features' : 'width'} {cols} →</text>
              )}
              {b === 0 && rank >= 2 && (
                <text x={-8} y={(rows * cell) / 2 + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--b dltt-axt--h">height {rows} ↓</text>
              )}
              {b === 0 && rank >= 3 && (
                <text x={cols * cell + (nC - 1) * dC + 4} y={-(nC - 1) * dC - 4} className="dltt-t dltt-t--xs dltt-t--b dltt-axt--c">↗ channels {nC}</text>
              )}
              {rank === 4 && (
                <text x={0} y={-(nC - 1) * dC - 10} className="dltt-t dltt-t--xs dltt-t--b dltt-axt--batch">example {b + 1} of {nB}</text>
              )}
            </g>
          ))}
          {/* the tuple: hover or focus a number to light its axis */}
          <g transform={`translate(${narrow ? 20 : ox} ${H - 26})`}>
            <text x={0} y={0} className="dltt-t dltt-t--m" style={{ fontSize: 18 }}>
              {rank === 0 ? '()' : (
                <>
                  (
                  {shape.map((n, i) => (
                    <tspan key={i}>
                      <tspan
                        className={`dltt-tnum dltt-axt--${roles[i]}${lit === i ? ' dltt-tnum--on' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${n}: ${NAMES[roles[i]]}`}
                        onPointerEnter={() => setLit(i)}
                        onPointerLeave={() => setLit(null)}
                        onFocus={() => setLit(i)}
                        onBlur={() => setLit(null)}
                      >
                        {n}
                      </tspan>
                      {i < shape.length - 1 ? ', ' : rank === 1 ? ',' : ''}
                    </tspan>
                  ))}
                  )
                </>
              )}
            </text>
            <text x={narrow ? 0 : 220} y={narrow ? 18 : 0} className="dltt-t dltt-t--s">{litRole ? NAMES[litRole] : `rank ${rank} · ${prod(shape)} number${prod(shape) > 1 ? 's' : ''}`}</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
