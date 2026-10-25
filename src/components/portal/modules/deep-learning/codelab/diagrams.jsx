import { layoutDiagram, BOX_W, BOX_H } from './diagramLayout';
import { shapeStr, fmt } from './counts';

/* ============================================================================
   CODE LAB — "DRAW IT"
   ----------------------------------------------------------------------------
   The architecture diagram an exam answer would draw, generated from the
   card's layer spec (./specs.js): input at the top, one box per layer with
   its type, units or filters, activation and output shape, and its
   parameter count on the right. Layers without parameters (Flatten,
   pooling, Dropout, Concatenate …) have a dashed outline. Functional models
   draw their branches side by side and merge where they meet; a shortcut
   that skips layers runs down a side lane. Line art on the portal's tokens,
   one visual language on every card, on screen and on paper.
   ========================================================================== */

function Box({ n }) {
  const zero = n.tr + n.nt === 0;
  const isInput = n.type === 'Input';
  const p = n.tr ? fmt(n.tr) : n.nt ? `${fmt(n.nt)} nt` : '';
  return (
    <g className={`dlc-dg__box${zero ? ' dlc-dg__box--zero' : ''}${isInput ? ' dlc-dg__box--in' : ''}`} data-layer={n.id}>
      <rect x={n.x} y={n.y} width={BOX_W} height={BOX_H} rx="3" />
      <text className="dlc-dg__name" x={n.x + 9} y={n.y + 16}>{n.name}</text>
      <text className="dlc-dg__shape" x={n.x + 9} y={n.y + 33}>{shapeStr(n.out)}</text>
      {p && <text className="dlc-dg__p" x={n.x + BOX_W - 8} y={n.y + 33} textAnchor="end">{p}</text>}
    </g>
  );
}

function Edge({ e, arrow }) {
  const { a, b } = e;
  if (e.kind === 'down') {
    const x1 = a.x + BOX_W / 2;
    const x2 = b.x + BOX_W / 2;
    const y1 = a.y + BOX_H;
    const y2 = b.y - 2;
    return <path className="dlc-dg__edge" d={x1 === x2 ? `M${x1},${y1} V${y2}` : `M${x1},${y1} C${x1},${y1 + 10} ${x2},${y2 - 10} ${x2},${y2}`} markerEnd={`url(#${arrow})`} />;
  }
  if (e.kind === 'fold') {
    const x1 = a.x + BOX_W / 2;
    const y1 = a.y + BOX_H;
    const xm = a.x + BOX_W + 23;
    const x2 = b.x + BOX_W / 2;
    const y2 = b.y - 2;
    return <path className="dlc-dg__edge" d={`M${x1},${y1} V${y1 + 9} H${xm} V${b.y - 9} H${x2} V${y2}`} markerEnd={`url(#${arrow})`} />;
  }
  // a shortcut down the side lane, into the target's side
  const out = e.side === 'left' ? a.x : a.x + BOX_W;
  const into = e.side === 'left' ? b.x - 2 : b.x + BOX_W + 2;
  const y1 = a.y + BOX_H / 2;
  const y2 = b.y + BOX_H / 2;
  return <path className="dlc-dg__edge" d={`M${out},${y1} H${e.laneX} V${y2} H${into}`} markerEnd={`url(#${arrow})`} />;
}

export function Diagram({ spec, caption }) {
  const L = layoutDiagram(spec);
  const arrow = `dlc-arrow-${spec.id}`;
  const gl = L.groups.length ? 14 : 0; // room for group labels on the left
  const w = L.width + gl;
  return (
    <figure className="dlc-dg" data-spec={spec.id}>
      <svg viewBox={`${-gl} 0 ${w} ${L.height}`} width={w} className="dlc-dg__svg" role="img" aria-label={`Architecture: ${L.nodes.map((n) => n.name).join(' → ')}`}>
        <defs>
          <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" className="dlc-dg__head" />
          </marker>
        </defs>
        {L.groups.map((g, i) => (
          <g key={i} className="dlc-dg__group">
            <rect x={g.x0 - 6} y={g.y0 - 5} width={g.x1 - g.x0 + 12} height={g.y1 - g.y0 + 10} rx="5" />
            <text x={g.x0 - 10} y={(g.y0 + g.y1) / 2} transform={`rotate(-90 ${g.x0 - 10} ${(g.y0 + g.y1) / 2})`} textAnchor="middle">{g.label}</text>
          </g>
        ))}
        {L.edges.map((e, i) => <Edge key={i} e={e} arrow={arrow} />)}
        {L.nodes.map((n) => <Box key={n.id} n={n} />)}
      </svg>
      {caption && <figcaption className="dlc-dg__cap">{caption}</figcaption>}
    </figure>
  );
}
