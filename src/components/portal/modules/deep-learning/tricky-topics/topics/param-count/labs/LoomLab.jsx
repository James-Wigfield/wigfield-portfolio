import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Scrub, Neuron, Bead, Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { layerCounts } from '../../../maths/paramRules';
import './param.css';

/* Step 1 · the connection loom. Two columns of neurons, every input wired
   to every neuron: each line is one weight, each neuron's bead one bias.
   Beside it the same weights as Keras stores them: an n_in × n_out grid
   (L1 slide 36's weights.shape (784, 300)) and a row of n_out biases.
   Hover a line or a cell to see they are the same number. Two controls:
   the two sizes. */

export function LoomLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [nIn, setNIn] = useState(4);
  const [nOut, setNOut] = useState(3);
  const [hot, setHot] = useState(null); // { i, j } or { b: j }
  const a = printing ? 4 : nIn;
  const b = printing ? 3 : nOut;
  const { trainable } = layerCounts({ t: 'dense', units: b }, [[a]]);
  const W = narrow ? 360 : 760;
  const H = narrow ? 470 : 300;
  const net = narrow ? { xi: 70, xo: 250, top: 40, h: 200 } : { xi: 90, xo: 300, top: 40, h: 220 };
  const yi = (i) => net.top + (a === 1 ? net.h / 2 : (i * net.h) / (a - 1));
  const yo = (j) => net.top + (b === 1 ? net.h / 2 : (j * net.h) / (b - 1));
  const cell = narrow ? 22 : 24;
  const gx = narrow ? 120 : 430;
  const gy = narrow ? 290 : 60;
  const isHot = (i, j) => hot && hot.i === i && hot.j === j;
  return (
    <Stage
      title="Every line is a weight, every bead a bias"
      prov="{s|L1 · slide 8} {s|L1 · slide 36}"
      tryThis="Predict the count for 5 inputs and 2 neurons, then drag the sizes. Hover a line, or tab through the grid: the same weight lights up in both."
      caption="Keras stores the lines as one $n_{\text{in}} \times n_{\text{out}}$ grid and the beads as one row of $n_{\text{out}}$ biases (slide 36 prints `(784, 300)` and `(300,)`)."
      challenge={{ text: 'Make exactly 20 parameters.', done: trainable === 20 }}
      maths={
        <>
          <MEq tex={'(n_{\\text{in}} + 1) \\times n_{\\text{out}} = n_{\\text{in}} n_{\\text{out}} + n_{\\text{out}}'} />
          <MLine text={`Here: $${a} \\times ${b} = ${a * b}$ weights $+ ${b}$ biases $= (${a} + 1) \\times ${b} = ${trainable}$.`} />
          <MLine text="Slide 36’s first hidden layer: weights `(784, 300)` and biases `(300,)`, so $784 \times 300 + 300 = 235{,}500$, the summary’s Param # {s|L1 · slide 36}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${a} inputs fully connected to ${b} neurons: ${a * b} weights and ${b} biases, ${trainable} parameters`}>
          {Array.from({ length: a }, (_, i) =>
            Array.from({ length: b }, (_, j) => (
              <line
                key={`${i}-${j}`}
                x1={net.xi + 12}
                y1={yi(i)}
                x2={net.xo - 13}
                y2={yo(j)}
                className={`dltt-link-w${isHot(i, j) ? ' dltt-link-w--hot' : ''}`}
                onPointerEnter={() => setHot({ i, j })}
                onPointerLeave={() => setHot(null)}
                style={{ strokeWidth: isHot(i, j) ? 3 : 1.6, cursor: 'crosshair' }}
              />
            )),
          )}
          {Array.from({ length: a }, (_, i) => <Neuron key={`i${i}`} x={net.xi} y={yi(i)} r={11} />)}
          {Array.from({ length: b }, (_, j) => (
            <g key={`o${j}`} tabIndex={0} role="button" aria-label={`Neuron ${j + 1} and its bias`} onPointerEnter={() => setHot({ b: j })} onPointerLeave={() => setHot(null)} onFocus={() => setHot({ b: j })} onBlur={() => setHot(null)}>
              <Neuron x={net.xo} y={yo(j)} r={13} role="w" />
              <Bead x={net.xo + 11} y={yo(j) - 11} r={hot?.b === j ? 6.5 : 4.5} />
            </g>
          ))}
          <text x={net.xi} y={net.top - 18} textAnchor="middle" className="dltt-t dltt-t--s">{a} input{a > 1 ? 's' : ''}</text>
          <text x={net.xo} y={net.top - 18} textAnchor="middle" className="dltt-t dltt-t--s">{b} neuron{b > 1 ? 's' : ''}</text>

          {/* the same numbers as Keras stores them */}
          <text x={gx} y={gy - 12} className="dltt-t dltt-t--xs">weights ({a}, {b})</text>
          {Array.from({ length: a }, (_, i) =>
            Array.from({ length: b }, (_, j) => (
              <rect
                key={`c${i}-${j}`}
                x={gx + j * cell}
                y={gy + i * cell}
                width={cell - 3}
                height={cell - 3}
                rx={3}
                className={`dltt-wcell${isHot(i, j) ? ' dltt-wcell--hot' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`Weight from input ${i + 1} to neuron ${j + 1}`}
                onPointerEnter={() => setHot({ i, j })}
                onPointerLeave={() => setHot(null)}
                onFocus={() => setHot({ i, j })}
                onBlur={() => setHot(null)}
              />
            )),
          )}
          <text x={gx} y={gy + a * cell + 18} className="dltt-t dltt-t--xs">biases ({b},)</text>
          {Array.from({ length: b }, (_, j) => (
            <Bead key={`gb${j}`} x={gx + j * cell + (cell - 3) / 2} y={gy + a * cell + 32} r={hot?.b === j ? 7 : 5.5} />
          ))}
          <g transform={narrow ? `translate(${gx + Math.max(b * cell, 70) + 60} ${gy + 30})` : `translate(${W - 90} 120)`}>
            <Counter x={0} y={0} value={trainable} size={narrow ? 34 : 44} label={`${trainable} parameters`} />
            <text x={0} y={22} textAnchor="middle" className="dltt-t dltt-t--s">parameters</text>
            <text x={0} y={42} textAnchor="middle" className="dltt-t dltt-t--xs"><tspan className="dltt-t--w">{a * b} weights</tspan> + <tspan className="dltt-t--bias">{b} biases</tspan></text>
          </g>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 120 : 64}`} role="group" aria-label="The two layer sizes">
          <text x={20} y={16} className="dltt-t dltt-t--s">inputs n<tspan dy={3} fontSize={9}>in</tspan></text>
          <Scrub x0={30} x1={narrow ? W - 30 : W / 2 - 40} y={40} value={a} min={1} max={8} step={1} onChange={setNIn} label="Number of inputs" ticks={[1, 8]} />
          <text x={narrow ? 20 : W / 2 + 10} y={narrow ? 76 : 16} className="dltt-t dltt-t--s">neurons n<tspan dy={3} fontSize={9}>out</tspan></text>
          <Scrub x0={narrow ? 30 : W / 2 + 20} x1={W - 30} y={narrow ? 100 : 40} value={b} min={1} max={6} step={1} onChange={setNOut} label="Number of neurons" ticks={[1, 6]} />
        </svg>
      </div>
    </Stage>
  );
}
