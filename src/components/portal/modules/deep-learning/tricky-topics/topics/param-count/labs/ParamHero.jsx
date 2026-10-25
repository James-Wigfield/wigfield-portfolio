import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';
import { useWidth } from '../../../useWidth';
import { Neuron, Bead, Counter } from '../../../svgParts';
import './param.css';

/* The opener's hero: three inputs meet four neurons. The connections draw
   in one input at a time (the counter climbs 4, 8, 12), then every neuron's
   bias bead lights (16), then the rule writes itself: (3 + 1) × 4 = 16.
   Narrow stages stack the counter under the network. */

const NIN = 3;
const NOUT = 4;
const BEATS = 6;

export function ParamHero({ run }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const beat = useHeroBeats(BEATS, { run, ref, ms: 850 });
  const G = narrow
    ? { W: 340, H: 330, xIn: 70, xOut: 250, y0: 40, dy: 50, cx: 170, cy: 262 }
    : { W: 640, H: 220, xIn: 130, xOut: 330, y0: 32, dy: 46, cx: 520, cy: 98 };
  const yIn = (i) => G.y0 + 20 + i * (G.dy + 6);
  const yOut = (j) => G.y0 + j * G.dy;
  const wired = Math.max(0, Math.min(NIN, beat));
  const biases = beat >= 4;
  const count = wired * NOUT + (biases ? NOUT : 0);
  return (
    <div ref={wrap}>
      <svg ref={ref} className="dltt-svg dltt-phero" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label="Three inputs fully connected to four neurons: 12 weights plus 4 biases, 16 parameters">
        {Array.from({ length: NIN }, (_, i) =>
          Array.from({ length: NOUT }, (_, j) => (
            <line
              key={`${i}-${j}`}
              x1={G.xIn + 12}
              y1={yIn(i)}
              x2={G.xOut - 12}
              y2={yOut(j)}
              className={`dltt-link-w dltt-phero__line${i < wired ? ' dltt-phero__line--on' : ''}`}
              style={{ transitionDelay: `${j * 70}ms` }}
            />
          )),
        )}
        {Array.from({ length: NIN }, (_, i) => <Neuron key={`i${i}`} x={G.xIn} y={yIn(i)} r={12} label={`x${i + 1}`} />)}
        {Array.from({ length: NOUT }, (_, j) => (
          <g key={`o${j}`}>
            <Neuron x={G.xOut} y={yOut(j)} r={13} role="w" />
            <Bead x={G.xOut + 11} y={yOut(j) - 11} r={4.5} on={biases} />
          </g>
        ))}
        <text x={G.xIn} y={G.y0 + 4 * G.dy - 6} textAnchor="middle" className="dltt-t dltt-t--s">inputs</text>
        <text x={G.xOut} y={G.y0 + 4 * G.dy - 6} textAnchor="middle" className="dltt-t dltt-t--s">neurons</text>
        <Counter x={G.cx} y={G.cy} value={count} size={46} label={`${count} parameters`} />
        <text x={G.cx} y={G.cy + 24} textAnchor="middle" className="dltt-t dltt-t--s">parameters</text>
        <text x={G.cx} y={G.cy + (narrow ? 50 : 62)} textAnchor="middle" className={`dltt-t dltt-t--m dltt-fade${beat >= 5 ? '' : ' dltt-hide'}`} style={{ fontSize: 15 }}>
          (<tspan className="dltt-t--w">3</tspan> + <tspan className="dltt-t--bias">1</tspan>) × 4 = 16
        </text>
        {!narrow && (
          <text x={G.cx} y={G.cy + 84} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-fade${beat >= 5 ? '' : ' dltt-hide'}`}>
            <tspan className="dltt-t--w">weights</tspan> + <tspan className="dltt-t--bias">biases</tspan>
          </text>
        )}
      </svg>
    </div>
  );
}
