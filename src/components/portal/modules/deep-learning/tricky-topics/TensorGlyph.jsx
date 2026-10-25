import { Box3 } from './svgParts';
import { glyphKind } from './maths/shapeRules.js';

/* ============================================================================
   TRICKY TOPICS — A TENSOR, DRAWN BY ITS SHAPE (shared by every topic)
   ----------------------------------------------------------------------------
   <TensorGlyph x y shape kind batch fit lit /> draws one example's tensor in
   the page's axis colours (stage.css), sized on a gentle (square-root) scale
   so 784 and 3 can share a picture:

     kind 'image'   (h, w, c)      an outlined box: height up the left edge,
                                   width along the bottom, channels as depth
     kind 'seq'     (t, d)         a flat slab: time steps along the bottom,
                                   features (dimensionality) up the side
     kind 'vec'     (n,)           a thin strip of n features
     kind 'grid'    (r, c)         a matrix (rows × columns), e.g. Q or K
   `batch` (a number or 'None') draws two ghost copies behind and writes
   "× batch". `lit` = an axis key to emphasise ('batch' | 'h' | 'w' | 'c' |
   't' | 'f'). `fit` = [maxW, maxH] in px. Labels show the sizes.
   Returns its drawn width/height through `onSize`-free layout: callers give
   x, y as the top-left corner and reserve `fit`.
   ========================================================================== */

const sq = (n, k) => Math.sqrt(Math.max(1, n)) * k;

export default function TensorGlyph({ x, y, shape, kind, batch, fit = [180, 120], lit = null, labels = true, ghost = false, className = '' }) {
  const [maxW, maxH] = fit;
  const k = kind ?? glyphKind(shape);
  const stack = batch !== undefined && batch !== null && batch !== 1;
  const ghostN = stack ? 2 : 0;
  const off = 7;
  if (k === 'image') {
    const [h, w, c] = shape;
    const s = Math.min((maxW - 26 - ghostN * off) / (sq(w, 1) + sq(c, 0.62)), (maxH - 26 - ghostN * off) / (sq(h, 1) + sq(c, 0.42)), 16);
    const bw = sq(w, s);
    const bh = sq(h, s);
    const d = Math.max(4, sq(c, s * 0.9));
    const x0 = x + 18;
    const y0 = y + d * 0.42 + ghostN * off + 4;
    return (
      <g className={`dltt-glyph ${className}`}>
        {Array.from({ length: ghostN }, (_, i) => (
          <Box3 key={i} x={x0 + (ghostN - i) * off} y={y0 - (ghostN - i) * off} w={bw} h={bh} d={d} ghost className="dltt-glyph__ghost" />
        ))}
        <Box3
          x={x0}
          y={y0}
          w={bw}
          h={bh}
          d={d}
          ghost={ghost}
          lit={lit === 'h' ? 'h' : lit === 'w' ? 'w' : lit === 'c' ? 'd' : null}
          axes={{ h: { role: 'h', label: labels ? h : null }, w: { role: 'wd', label: labels ? w : null }, d: { role: 'c', label: labels ? c : null } }}
        />
        {stack && labels && (
          <text x={x0 + bw + d * 0.62 + 6} y={y0 - ghostN * off - 2} className={`dltt-t dltt-t--xs dltt-t--b dltt-axt--batch${lit === 'batch' ? ' dltt-box3__lab--lit' : ''}`}>× {batch}</text>
        )}
      </g>
    );
  }
  if (k === 'seq' || k === 'grid') {
    const [r, cc] = shape; // seq: (time, dim) drawn time along the bottom
    const across = k === 'seq' ? r : cc;
    const up = k === 'seq' ? cc : r;
    const s = Math.min((maxW - 30) / sq(across, 1), (maxH - 30 - ghostN * off) / sq(up, 1), 24);
    const bw = sq(across, s);
    const bh = Math.max(6, sq(up, s));
    const x0 = x + 22;
    const y0 = y + ghostN * off + 4;
    const roleAcross = k === 'seq' ? 't' : null;
    const roleUp = k === 'seq' ? 'f' : null;
    return (
      <g className={`dltt-glyph ${className}`}>
        {Array.from({ length: ghostN }, (_, i) => (
          <rect key={i} x={x0 + (ghostN - i) * off} y={y0 - (ghostN - i) * off} width={bw} height={bh} rx={2} className="dltt-glyph__slab dltt-glyph__slab--ghost" />
        ))}
        <rect x={x0} y={y0} width={bw} height={bh} rx={2} className={`dltt-glyph__slab${ghost ? ' dltt-glyph__slab--ghost' : ''}`} />
        <line x1={x0} y1={y0 + bh} x2={x0 + bw} y2={y0 + bh} className={`dltt-box3__edge${roleAcross ? ` dltt-ax--${roleAcross}` : ' dltt-glyph__plain'}${lit === roleAcross ? ' dltt-box3__edge--lit' : ''}`} />
        <line x1={x0} y1={y0} x2={x0} y2={y0 + bh} className={`dltt-box3__edge${roleUp ? ` dltt-ax--${roleUp}` : ' dltt-glyph__plain'}${lit === roleUp ? ' dltt-box3__edge--lit' : ''}`} />
        {labels && <text x={x0 + bw / 2} y={y0 + bh + 15} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--b dltt-t--m${roleAcross ? ` dltt-axt--${roleAcross}` : ''}`}>{across}</text>}
        {labels && <text x={x0 - 6} y={y0 + bh / 2 + 4} textAnchor="end" className={`dltt-t dltt-t--xs dltt-t--b dltt-t--m${roleUp ? ` dltt-axt--${roleUp}` : ''}`}>{up}</text>}
        {stack && labels && <text x={x0 + bw + 6} y={y0 - ghostN * off + 4} className="dltt-t dltt-t--xs dltt-t--b dltt-axt--batch">× {batch}</text>}
      </g>
    );
  }
  // vec
  const n = shape[0];
  const len = Math.min(maxW - 24, Math.max(40, sq(n, 5.2) + 8));
  const x0 = x + 4;
  const y0 = y + ghostN * off + 6;
  return (
    <g className={`dltt-glyph ${className}`}>
      {Array.from({ length: ghostN }, (_, i) => (
        <rect key={i} x={x0 + (ghostN - i) * off} y={y0 - (ghostN - i) * off} width={len} height={12} rx={3} className="dltt-glyph__slab dltt-glyph__slab--ghost" />
      ))}
      <rect x={x0} y={y0} width={len} height={12} rx={3} className={`dltt-glyph__slab${ghost ? ' dltt-glyph__slab--ghost' : ''}`} />
      <line x1={x0} y1={y0 + 12} x2={x0 + len} y2={y0 + 12} className={`dltt-box3__edge dltt-ax--f${lit === 'f' ? ' dltt-box3__edge--lit' : ''}`} />
      {labels && <text x={x0 + len / 2} y={y0 + 27} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b dltt-t--m dltt-axt--f">{n}</text>}
      {stack && labels && <text x={x0 + len + 6} y={y0 - ghostN * off + 8} className="dltt-t dltt-t--xs dltt-t--b dltt-axt--batch">× {batch}</text>}
    </g>
  );
}
