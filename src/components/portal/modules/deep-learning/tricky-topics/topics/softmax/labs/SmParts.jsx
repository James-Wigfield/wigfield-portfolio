import { percents } from '../../../maths/softmax.js';
import { starts, slots } from './sm.js';

/* ============================================================================
   TOPIC 3 · SOFTMAX — shared SVG parts for the labs
   ----------------------------------------------------------------------------
     ShareStrip   a 100% stacked strip of probabilities: one segment per class
                  (width ∝ p), its percentage (largest-remainder rounding, so
                  the labels add up to 100) on an evenly spaced label slot
                  joined to its segment by a thin leader, so labels never
                  collide however thin a segment gets. `vertical` stacks it
                  top to bottom with the labels on the right (narrow stages).
                  `segments={false}` draws only the labels (the hero morphs
                  its own bars into the strip).
   ========================================================================== */

export function ShareStrip({ x, y, len, thick = 26, p, names, vertical = false, segments = true, labelAt, end = true, className = '' }) {
  const st = starts(p);
  // largest-remainder percentages; a share that is above 0 but rounds to 0 reads "<1"
  const pct = percents(p).map((v, i) => (v === 0 && p[i] > 0 ? '<1' : v));
  const n = p.length;
  if (vertical) {
    const lx = labelAt ?? x + thick + 40;
    const sl = slots(y, len, n);
    return (
      <g className={`dltt-sm-strip ${className}`}>
        {segments && <rect x={x} y={y} width={thick} height={len} className="dltt-sm-strack" />}
        {segments && p.map((v, i) => (
          <rect key={i} x={x} y={y + st[i] * len} width={thick} height={Math.max(0, v * len)} className={`dltt-sm-seg${i % 2 ? ' dltt-sm-seg--alt' : ''}`} />
        ))}
        {p.map((v, i) => {
          const cy = y + (st[i] + v / 2) * len;
          return (
            <g key={`l${i}`}>
              <path d={`M${x + thick + 3},${cy} L${x + thick + 9},${cy} L${lx - 6},${sl[i] - 4}`} className="dltt-sm-lead" />
              <text x={lx} y={sl[i]} className="dltt-t dltt-t--m dltt-t--b dltt-t--p">{pct[i]}%</text>
              <text x={lx} y={sl[i] + 14} className="dltt-t dltt-t--xs">{names[i]}</text>
            </g>
          );
        })}
        {end && <text x={x + thick / 2} y={y - 8} textAnchor="middle" className="dltt-t dltt-t--xs">100%</text>}
      </g>
    );
  }
  const ly = labelAt ?? y + thick + 32;
  const sl = slots(x, len, n);
  return (
    <g className={`dltt-sm-strip ${className}`}>
      {segments && <rect x={x} y={y} width={len} height={thick} className="dltt-sm-strack" />}
      {segments && p.map((v, i) => (
        <rect key={i} x={x + st[i] * len} y={y} width={Math.max(0, v * len)} height={thick} className={`dltt-sm-seg${i % 2 ? ' dltt-sm-seg--alt' : ''}`} />
      ))}
      {p.map((v, i) => {
        const cx = x + (st[i] + v / 2) * len;
        return (
          <g key={`l${i}`}>
            <path d={`M${cx},${y + thick + 3} L${cx},${y + thick + 7} L${sl[i]},${ly - 15}`} className="dltt-sm-lead" />
            <text x={sl[i]} y={ly} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--p">{pct[i]}%</text>
            <text x={sl[i]} y={ly + 14} textAnchor="middle" className="dltt-t dltt-t--xs">{names[i]}</text>
          </g>
        );
      })}
      {end && <text x={x + len} y={y - 8} textAnchor="end" className="dltt-t dltt-t--xs">100%</text>}
    </g>
  );
}
