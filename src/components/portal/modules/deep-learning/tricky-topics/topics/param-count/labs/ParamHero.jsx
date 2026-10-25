import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';
import { Neuron, Bead, Counter } from '../../../svgParts';
import './param.css';

/* The opener's hero: three inputs meet four neurons. The connections draw
   in one input at a time (the counter climbs 4, 8, 12), then every neuron's
   bias bead lights (16), then the rule writes itself: (3 + 1) × 4 = 16. */

const NIN = 3;
const NOUT = 4;
const BEATS = 6;

export function ParamHero({ run }) {
  const ref = useRef(null);
  const beat = useHeroBeats(BEATS, { run, ref, ms: 850 });
  const xIn = 130;
  const xOut = 330;
  const yIn = (i) => 52 + i * 52;
  const yOut = (j) => 32 + j * 46;
  const wired = Math.max(0, Math.min(NIN, beat)); // inputs whose lines are drawn
  const biases = beat >= 4;
  const count = wired * NOUT + (biases ? NOUT : 0);
  return (
    <svg ref={ref} className="dltt-svg dltt-phero" viewBox="0 0 640 220" role="img" aria-label="Three inputs fully connected to four neurons: 12 weights plus 4 biases, 16 parameters">
      {Array.from({ length: NIN }, (_, i) =>
        Array.from({ length: NOUT }, (_, j) => (
          <line
            key={`${i}-${j}`}
            x1={xIn + 12}
            y1={yIn(i)}
            x2={xOut - 12}
            y2={yOut(j)}
            className={`dltt-link-w dltt-phero__line${i < wired ? ' dltt-phero__line--on' : ''}`}
            style={{ transitionDelay: `${j * 70}ms` }}
          />
        )),
      )}
      {Array.from({ length: NIN }, (_, i) => <Neuron key={`i${i}`} x={xIn} y={yIn(i)} r={12} label={`x${i + 1}`} />)}
      {Array.from({ length: NOUT }, (_, j) => (
        <g key={`o${j}`}>
          <Neuron x={xOut} y={yOut(j)} r={13} role="w" />
          <Bead x={xOut + 11} y={yOut(j) - 11} r={4.5} on={biases} />
        </g>
      ))}
      <text x={xIn} y={208} textAnchor="middle" className="dltt-t dltt-t--s">inputs</text>
      <text x={xOut} y={208} textAnchor="middle" className="dltt-t dltt-t--s">neurons</text>
      <Counter x={520} y={98} value={count} size={46} label={`${count} parameters`} />
      <text x={520} y={124} textAnchor="middle" className="dltt-t dltt-t--s">parameters</text>
      <text x={520} y={160} textAnchor="middle" className={`dltt-t dltt-t--m dltt-fade${beat >= 5 ? '' : ' dltt-hide'}`} style={{ fontSize: 15 }}>
        (<tspan className="dltt-t--w">3</tspan> + <tspan className="dltt-t--bias">1</tspan>) × 4 = 16
      </text>
      <text x={520} y={182} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-fade${beat >= 5 ? '' : ' dltt-hide'}`}>
        <tspan className="dltt-t--w">weights</tspan> + <tspan className="dltt-t--bias">biases</tspan>
      </text>
    </svg>
  );
}
