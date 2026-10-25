import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Scrub, Bead, Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { layerCounts } from '../../../maths/paramRules';
import './param.css';

/* Step 8 · the unrolled cell. One set of weights at the top — W_x (n_in ×
   units), W_h (units × units), b (units) — and the cell unrolled over T
   time steps below, every copy wired to the SAME three blocks. Drag the
   time steps: the picture grows, the count doesn't. Three controls: time
   steps, units, inputs per step. */

export function UnrollLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [tRaw, setT] = useState(3);
  const [uRaw, setU] = useState(5);
  const [dRaw, setD] = useState(4);
  const T = printing ? 3 : tRaw;
  const u = printing ? 5 : uRaw;
  const d = printing ? 4 : dRaw;
  const { total } = layerCounts({ t: 'simplernn', units: u }, [[T, d]]);
  const W = narrow ? 360 : 780;
  const H = narrow ? 330 : 300;
  const cell = narrow ? 10 : 12;
  // the shared weight blocks
  const wy = 34;
  const wxX = narrow ? 20 : 120;
  const whX = wxX + u * cell + (narrow ? 22 : 40);
  const bX = whX + u * cell + (narrow ? 22 : 40);
  const show = Math.min(T, narrow ? 4 : 7);
  const cw = narrow ? 64 : 84;
  const gap = (W - 40 - show * cw) / Math.max(1, show);
  const cx = (t) => 20 + gap / 2 + t * (cw + gap);
  const cy = narrow ? 200 : 190;
  const grid = (x0, rows, cols, cls) =>
    Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => <rect key={`${i}-${j}`} x={x0 + j * cell} y={wy + i * cell} width={cell - 2} height={cell - 2} rx={2} className={cls} />));
  return (
    <Stage
      title="One set of weights, reused at every time step"
      prov="{s|L4 · slide 9} {s|L4 · slides 25, 27}"
      tryThis="Predict what happens to the count when the sequence gets longer. Drag the time steps, then the units."
      caption="Every copy of the cell is the same cell: it uses the same $\mathbf{W}_x$, $\mathbf{W}_h$ and $\mathbf{b}$ at every step. A longer sequence means more work, not more parameters."
      challenge={{ text: 'Build slide 25’s `SimpleRNN(1)` on one feature (3 parameters), then stretch it to 8 time steps.', done: total === 3 && T === 8 }}
      maths={
        <>
          <MEq tex={'\\underbrace{n_{\\text{in}} \\times u}_{\\mathbf{W}_x} + \\underbrace{u \\times u}_{\\mathbf{W}_h} + \\underbrace{u}_{\\mathbf{b}} = u(u + n_{\\text{in}}) + u'} />
          <MLine text={`Here: $${d} \\times ${u} + ${u} \\times ${u} + ${u} = ${total}$, for ${T} time step${T > 1 ? 's' : ''} or ${T + 50}.`} />
          <MLine text="Slide 25: `SimpleRNN(1)` on one feature, $1 + 1 + 1 = 3$. Slide 27: `SimpleRNN(32)`, $1 \times 32 + 32 \times 32 + 32 = 1{,}088$ {s|L4 · slides 25, 27}." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A SimpleRNN with ${u} units on ${d} inputs per step, unrolled over ${T} steps: ${total} parameters whatever T is`}>
          <text x={wxX} y={wy - 10} className="dltt-t dltt-t--xs">W<tspan dy={3} fontSize={8}>x</tspan><tspan dy={-3}> ({d} × {u})</tspan></text>
          {grid(wxX, d, u, 'dltt-wcell')}
          <text x={whX} y={wy - 10} className="dltt-t dltt-t--xs">W<tspan dy={3} fontSize={8}>h</tspan><tspan dy={-3}> ({u} × {u})</tspan></text>
          {grid(whX, u, u, 'dltt-wcell dltt-wcell--h')}
          <text x={bX} y={wy - 10} className="dltt-t dltt-t--xs">b ({u})</text>
          {Array.from({ length: u }, (_, j) => <Bead key={j} x={bX + 6} y={wy + 5 + j * cell} r={4} />)}
          <g transform={`translate(${narrow ? W - 50 : W - 90} ${narrow ? 60 : 70})`}>
            <Counter x={0} y={0} value={total} size={narrow ? 28 : 38} label={`${total} parameters`} />
            <text x={0} y={20} textAnchor="middle" className="dltt-t dltt-t--s">parameters</text>
          </g>
          {/* the unrolled copies, all tied to the one set of weights */}
          {Array.from({ length: show }, (_, t) => (
            <g key={t}>
              <path d={`M${cx(t) + cw / 2} ${cy - 22} C ${cx(t) + cw / 2} ${cy - 60}, ${(wxX + bX) / 2} ${wy + Math.max(d, u) * cell + 40}, ${(wxX + bX) / 2} ${wy + Math.max(d, u) * cell + 8}`} className="dltt-tie" />
              <rect x={cx(t)} y={cy - 22} width={cw} height={44} rx={8} className="dltt-cell" />
              <text x={cx(t) + cw / 2} y={cy - 4} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">cell</text>
              <text x={cx(t) + cw / 2} y={cy + 11} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--w">W<tspan dy={2} fontSize={7}>x</tspan><tspan dy={-2}> W</tspan><tspan dy={2} fontSize={7}>h</tspan><tspan dy={-2} className="dltt-t--bias"> b</tspan></text>
              <line x1={cx(t) + cw / 2} y1={cy + 52} x2={cx(t) + cw / 2} y2={cy + 24} className="dltt-wire dltt-wire--data" />
              <text x={cx(t) + cw / 2} y={cy + 66} textAnchor="middle" className="dltt-t dltt-t--xs">x<tspan dy={3} fontSize={8}>({t})</tspan></text>
              {t > 0 && <line x1={cx(t - 1) + cw} y1={cy} x2={cx(t) - 2} y2={cy} className="dltt-wire dltt-wire--data" />}
              {t > 0 && <text x={cx(t) - gap / 2} y={cy - 6} textAnchor="middle" className="dltt-t dltt-t--xs">h</text>}
            </g>
          ))}
          {T > show && <text x={W - 16} y={cy + 4} textAnchor="end" className="dltt-t dltt-t--s">… {T} steps</text>}
          <text x={20} y={H - 8} className="dltt-t dltt-t--xs">time →</text>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 176 : 64}`} role="group" aria-label="Time steps, units and inputs per step">
          {[
            ['time steps T', T, 1, 8, setT, 'Time steps'],
            ['units u', u, 1, 8, setU, 'Units'],
            ['inputs per step', d, 1, 4, setD, 'Inputs per step'],
          ].map(([lab, v, lo, hi, set, aria], i) => {
            const x0 = narrow ? 30 : 30 + i * (W / 3);
            const x1 = narrow ? W - 30 : (i + 1) * (W / 3) - 30;
            const y = narrow ? 40 + i * 56 : 40;
            return (
              <g key={lab}>
                <text x={x0 - 10} y={y - 24} className="dltt-t dltt-t--s">{lab}</text>
                <Scrub x0={x0} x1={x1} y={y} value={v} min={lo} max={hi} step={1} onChange={set} label={aria} ticks={[lo, hi]} />
              </g>
            );
          })}
        </svg>
      </div>
    </Stage>
  );
}
