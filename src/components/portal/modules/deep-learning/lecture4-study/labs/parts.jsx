/* ============================================================================
   LECTURE 4 STUDY — SHARED SVG PARTS FOR THE LABS
     Neuron     a Figure-15-1 neuron: Σ in the bottom half, the activation
                glyph (tanh S or ReLU ramp) in the top half
     Arrowhead  an open chevron arrowhead pointing up / down / left / right
   ========================================================================== */

export function Neuron({ cx, cy, r = 17, act = 'tanh', state = 'on' }) {
  // the activation glyph sits in the top half: an S for tanh, a ramp for ReLU
  const glyph =
    act === 'relu'
      ? `M${cx - r * 0.55} ${cy - r * 0.32} H${cx} L${cx + r * 0.5} ${cy - r * 0.78}`
      : `M${cx - r * 0.55} ${cy - r * 0.28} C${cx - r * 0.1} ${cy - r * 0.28} ${cx + r * 0.1} ${cy - r * 0.8} ${cx + r * 0.55} ${cy - r * 0.8}`;
  return (
    <g className={`dl4s-nrn dl4s-nrn--${state}`}>
      <circle cx={cx} cy={cy} r={r} className="dl4s-nrn__body" />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} className="dl4s-nrn__mid" />
      <path d={glyph} className="dl4s-nrn__glyph" />
      <text x={cx} y={cy + r * 0.62} textAnchor="middle" className="dl4s-nrn__sigma">Σ</text>
    </g>
  );
}

export function Arrowhead({ x, y, dir = 'up', s = 5, className = 'dl4s-ah' }) {
  const d = {
    up: `M${x - s} ${y + s * 1.3} L${x} ${y} L${x + s} ${y + s * 1.3}`,
    right: `M${x - s * 1.3} ${y - s} L${x} ${y} L${x - s * 1.3} ${y + s}`,
    left: `M${x + s * 1.3} ${y - s} L${x} ${y} L${x + s * 1.3} ${y + s}`,
    down: `M${x - s} ${y - s * 1.3} L${x} ${y} L${x + s} ${y - s * 1.3}`,
  }[dir];
  return <path d={d} className={className} />;
}


