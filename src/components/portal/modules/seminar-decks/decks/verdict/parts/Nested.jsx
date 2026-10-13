/* ============================================================================
   VERDICT DECK — WHY A CNN SEES LITTLE (schematic, slide 4)
   ----------------------------------------------------------------------------
   Three nested scales: the whole-body scan, the window that fits in GPU
   memory, and the small neighbourhood one filter sees. Not to scale; it is
   labelled "schematic".
   ========================================================================== */

const K = { x: 104, y: 292, s: 16 };

export default function Nested({ on }) {
  return (
    <svg className={`d2-nest${on ? ' is-on' : ''}`} width="560" height="620" viewBox="0 0 560 620" role="img" aria-label="Schematic: a scan, one window of it, and the small neighbourhood one filter sees">
      <rect x="4" y="16" width="200" height="590" rx="38" className="d2-nest__body" />
      <rect x="34" y="196" width="140" height="196" rx="4" className="d2-nest__win" />
      <g className="d2-nest__ker">
        {[0, 1, 2].map((i) => [0, 1, 2].map((j) => (
          <rect key={`${i}-${j}`} x={K.x - K.s * 1.5 + i * K.s + 1} y={K.y - K.s * 1.5 + j * K.s + 1} width={K.s - 2} height={K.s - 2} />
        )))}
      </g>
      <g className="d2-nest__labs">
        <line x1="204" x2="234" y1="64" y2="64" />
        <text x="244" y="72" data-role="chart">whole-body scan:</text>
        <text x="244" y="108" className="d2-nest__sub" data-role="chart">too big for the GPU</text>
        <polyline points="174,204 234,204" />
        <text x="244" y="212" data-role="chart">one 3D window:</text>
        <text x="244" y="248" className="d2-nest__sub" data-role="chart">what fits at once</text>
        <polyline points={`${K.x + K.s * 1.5 + 2},${K.y} 234,${K.y}`} />
        <text x="244" y={K.y + 8} data-role="chart">one filter:</text>
        <text x="244" y={K.y + 44} className="d2-nest__sub" data-role="chart">a small neighbourhood</text>
        <text x="244" y="590" className="d2-nest__note" data-role="chart">schematic</text>
      </g>
    </svg>
  );
}
