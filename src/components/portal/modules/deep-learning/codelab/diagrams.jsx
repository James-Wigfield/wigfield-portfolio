import { layoutDiagram, layoutAcross, SCREEN } from './diagramLayout';
import { shapeStr, fmt } from './counts';

/* ============================================================================
   CODE LAB — "DRAW IT"
   ----------------------------------------------------------------------------
   The architecture diagram an exam answer would draw, generated from the
   card's layer spec (./specs.js): one box per layer with its type, units or
   filters, activation and output shape, and its parameter count. Layers
   without parameters (Flatten, pooling, Dropout, Concatenate …) have a
   dashed outline. Functional models draw their branches side by side and
   merge where they meet; a shortcut that skips layers runs along a lane; a
   handed-over RNN state is a dashed arrow. Line art on the portal's tokens,
   one visual language on every card.

     Diagram        on screen: top to bottom (diagramLayout.js layoutDiagram)
     DiagramAcross  in print: left to right in a short band across the page
                    (layoutAcross), so a card fits in about half an A4 page
   ========================================================================== */

const params = (n) => (n.tr ? fmt(n.tr) : n.nt ? `${fmt(n.nt)} nt` : '');

function Marker({ id }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" className="dlc-dg__head" />
      </marker>
    </defs>
  );
}

const boxCls = (n) => `dlc-dg__box${n.tr + n.nt === 0 ? ' dlc-dg__box--zero' : ''}${n.type === 'Input' ? ' dlc-dg__box--in' : ''}`;

// ── screen ──────────────────────────────────────────────────────────────────
function Box({ n, G }) {
  const p = params(n);
  // a name too long for its box is squeezed to fit rather than overflowing
  const squeeze = n.name.length > G.CHARS ? { textLength: G.BW - 16, lengthAdjust: 'spacingAndGlyphs' } : {};
  return (
    <g className={boxCls(n)} data-layer={n.id}>
      <rect x={n.x} y={n.y} width={G.BW} height={G.BH} rx="3" />
      <text className="dlc-dg__name" x={n.x + 8} y={n.y + G.NAME_Y} style={{ fontSize: G.NAME }} {...squeeze}>{n.name}</text>
      <text className="dlc-dg__shape" x={n.x + 8} y={n.y + G.SHAPE_Y} style={{ fontSize: G.SHAPE }}>{shapeStr(n.out)}</text>
      {p && <text className="dlc-dg__p" x={n.x + G.BW - 7} y={n.y + G.SHAPE_Y} textAnchor="end" style={{ fontSize: G.SHAPE }}>{p}</text>}
    </g>
  );
}

function Edge({ e, arrow, G }) {
  const { a, b } = e;
  const { BW, BH } = G;
  if (e.kind === 'down') {
    const x1 = a.x + BW / 2;
    const x2 = b.x + BW / 2;
    const y1 = a.y + BH;
    const y2 = b.y - 2;
    const bend = Math.min(10, (y2 - y1) / 2);
    return <path className="dlc-dg__edge" d={x1 === x2 ? `M${x1},${y1} V${y2}` : `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`} markerEnd={`url(#${arrow})`} />;
  }
  if (e.kind === 'fold') {
    const x1 = a.x + BW / 2;
    const y1 = a.y + BH;
    const xm = a.x + BW + G.COL_GAP / 2;
    const x2 = b.x + BW / 2;
    const y2 = b.y - 2;
    return <path className="dlc-dg__edge" d={`M${x1},${y1} V${y1 + G.VG / 2} H${xm} V${b.y - G.VG / 2} H${x2} V${y2}`} markerEnd={`url(#${arrow})`} />;
  }
  if (e.kind === 'state') {
    const right = a.x < b.x;
    const x1 = right ? a.x + BW : a.x;
    const x2 = right ? b.x - 2 : b.x + BW + 2;
    const y1 = a.y + BH / 2;
    const y2 = b.y + BH / 2;
    return (
      <g className="dlc-dg__state">
        <path className="dlc-dg__edge dlc-dg__edge--state" d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} markerEnd={`url(#${arrow})`} />
        <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 4} textAnchor="middle">state</text>
      </g>
    );
  }
  // a shortcut down the side lane, into the target's side
  const out = e.side === 'left' ? a.x : a.x + BW;
  const into = e.side === 'left' ? b.x - 2 : b.x + BW + 2;
  const y1 = a.y + BH / 2;
  const y2 = b.y + BH / 2;
  return <path className="dlc-dg__edge" d={`M${out},${y1} H${e.laneX} V${y2} H${into}`} markerEnd={`url(#${arrow})`} />;
}

export function Diagram({ spec }) {
  const G = SCREEN;
  const L = layoutDiagram(spec, G);
  const arrow = `dlc-arrow-${spec.id}`;
  const gl = L.groups.length ? 14 : 0; // room for group labels on the left
  const w = L.width + gl;
  return (
    <figure className="dlc-dg" data-spec={spec.id}>
      <svg viewBox={`${-gl} 0 ${w} ${L.height}`} width={w} className="dlc-dg__svg" role="img" aria-label={`Architecture: ${L.nodes.map((nd) => nd.name).join(' → ')}`}>
        <Marker id={arrow} />
        {L.groups.map((g, i) => (
          <g key={i} className="dlc-dg__group">
            <rect x={g.x0 - 5} y={g.y0 - 4} width={g.x1 - g.x0 + 10} height={g.y1 - g.y0 + 8} rx="5" />
            <text x={g.x0 - 9} y={(g.y0 + g.y1) / 2} transform={`rotate(-90 ${g.x0 - 9} ${(g.y0 + g.y1) / 2})`} textAnchor="middle">{g.label}</text>
          </g>
        ))}
        {L.edges.map((e, i) => <Edge key={i} e={e} arrow={arrow} G={G} />)}
        {L.nodes.map((nd) => <Box key={nd.id} n={nd} G={G} />)}
      </svg>
    </figure>
  );
}

// ── print ───────────────────────────────────────────────────────────────────
// "Conv2D 128, 3×3, same, relu" → ["Conv2D 128", "3×3, same, relu"]: the
// first comma outside brackets splits the type from its details
function splitName(name) {
  let depthB = 0;
  for (let i = 0; i < name.length - 1; i += 1) {
    const ch = name[i];
    if (ch === '(' || ch === '[') depthB += 1;
    else if (ch === ')' || ch === ']') depthB -= 1;
    else if (ch === ',' && depthB === 0 && name[i + 1] === ' ') return [name.slice(0, i), name.slice(i + 2)];
  }
  return [name, ''];
}

function fitText(text, width, px) {
  return text.length * px * 0.56 > width ? { textLength: width, lengthAdjust: 'spacingAndGlyphs' } : {};
}

function BoxAcross({ n, BW, BH }) {
  const [main, detail] = splitName(n.name);
  const p = params(n);
  const inner = BW - 10;
  return (
    <g className={boxCls(n)} data-layer={n.id}>
      <rect x={n.x} y={n.y} width={BW} height={BH} rx="3" />
      <text className="dlc-dg__name" x={n.x + 5} y={n.y + 10} style={{ fontSize: 9.4 }} {...fitText(main, inner, 9.4)}>{main}</text>
      {detail && <text className="dlc-dg__detail" x={n.x + 5} y={n.y + 19.5} style={{ fontSize: 8.3 }} {...fitText(detail, inner, 8.3)}>{detail}</text>}
      <text className="dlc-dg__shape" x={n.x + 5} y={n.y + 29} style={{ fontSize: 8.3 }} {...fitText(shapeStr(n.out), inner, 8.3)}>{shapeStr(n.out)}</text>
      {p && <text className="dlc-dg__p" x={n.x + 5} y={n.y + 38.5} style={{ fontSize: 8.3 }}>{p}</text>}
    </g>
  );
}

function EdgeAcross({ e, arrow, BW, BH, VG }) {
  const { a, b } = e;
  if (e.kind === 'right') {
    const x1 = a.x + BW;
    const y1 = a.y + BH / 2;
    const x2 = b.x - 2;
    const y2 = b.y + BH / 2;
    const bend = (x2 - x1) / 2;
    return <path className="dlc-dg__edge" d={y1 === y2 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`} markerEnd={`url(#${arrow})`} />;
  }
  if (e.kind === 'wrap') {
    // carriage return: down out of the row's last box, back left, into the next row
    const x1 = a.x + BW / 2;
    const y1 = a.y + BH;
    const ym = y1 + VG / 2;
    const x2 = b.x + BW / 2;
    return <path className="dlc-dg__edge" d={`M${x1},${y1} V${ym} H${x2} V${b.y - 2}`} markerEnd={`url(#${arrow})`} />;
  }
  if (e.kind === 'over') {
    // a shortcut along a lane above the row
    const x1 = a.x + BW / 2;
    const x2 = b.x + BW / 2;
    return <path className="dlc-dg__edge" d={`M${x1},${a.y} V${e.laneY} H${x2} V${b.y - 2}`} markerEnd={`url(#${arrow})`} />;
  }
  // 'drop': an RNN state handed down to the stacked box below
  const x = a.x + BW / 2;
  return (
    <g className="dlc-dg__state">
      <path className="dlc-dg__edge dlc-dg__edge--state" d={`M${x},${a.y + BH} V${b.y - 2}`} markerEnd={`url(#${arrow})`} />
      <text x={x + 4} y={(a.y + BH + b.y) / 2 + 3}>state</text>
    </g>
  );
}

export function DiagramAcross({ spec }) {
  const L = layoutAcross(spec);
  const arrow = `dlc-arrowx-${spec.id}`;
  return (
    <figure className="dlc-dg dlc-dg--across" data-spec={spec.id}>
      <svg viewBox={`0 0 ${L.width} ${L.height}`} width={L.width} className="dlc-dg__svg" role="img" aria-label={`Architecture: ${L.nodes.map((nd) => nd.name).join(' → ')}`}>
        <Marker id={arrow} />
        {L.groups.map((g, i) => (
          <g key={i} className="dlc-dg__group">
            <rect x={g.x0 - 3} y={g.y0 - 11} width={g.x1 - g.x0 + 6} height={g.y1 - g.y0 + 14} rx="4" />
            <text x={g.x0} y={g.y0 - 3}>{g.label}</text>
          </g>
        ))}
        {L.edges.map((e, i) => <EdgeAcross key={i} e={e} arrow={arrow} BW={L.BW} BH={L.BH} VG={L.VG} />)}
        {L.nodes.map((nd) => <BoxAcross key={nd.id} n={nd} BW={L.BW} BH={L.BH} />)}
      </svg>
    </figure>
  );
}
