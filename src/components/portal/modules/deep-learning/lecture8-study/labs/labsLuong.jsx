import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../stage';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { luong, fmt, fmtVec } from '../attn';
import './labsLuong.css';

/* ============================================================================
   §7 · LUONG ATTENTION: THREE SCORES  (slides 24–25)
   ----------------------------------------------------------------------------
   LuongLab  two arrows on a plane, the decoder's state h(t) and an encoder
             output y(i) (d = 2, so they can be drawn); drag either tip and
             the three score functions of slide 25 update as bars. The dot
             product is biggest when the arrows point the same way, zero at
             right angles, negative when opposed. A switch gives y a third
             number: the dot product is then undefined (slide 24's "same
             length" constraint); the general form still works with a 2 × 3
             W (this page's observation). W, Wc and v are the page's own.
   ========================================================================== */

const W2 = [[0.8, -0.6], [0.5, 0.9]]; // general: h(t)ᵀ W y(i), toy 2 × 2
const W3 = [[0.8, -0.6, 0.4], [0.5, 0.9, -0.3]]; // the same with a 2 × 3 W
const WC = [[0.9, 0.2, 0.7, -0.4], [-0.3, 0.8, 0.1, 0.9]]; // concat: W [h; y], 2 × 4
const VC = [1.1, 0.8];
const Y3 = 0.7; // y's third number when it is made longer

const bmatrix = (M) => `\\begin{bmatrix} ${M.map((r) => r.map((x) => fmt(x, 1)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

const clampLen =([x, y], r = 1.6) => {
  const n = Math.hypot(x, y);
  return n > r ? [(x / n) * r, (y / n) * r] : [x, y];
};

export function LuongLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const [h, setH] = useState([1.2, 0.5]);
  const [y, setY] = useState([1.0, 0.9]);
  const [long, setLong] = useState(false);
  const [drag, setDrag] = useState(null);

  const yv = long ? [...y, Y3] : y;
  const dot = long ? null : luong.dot(h, y);
  const gen = luong.general(h, yv, long ? W3 : W2);
  const cat = long ? null : luong.concat(h, y, WC, VC);
  const done = !long && Math.abs(dot) < 0.06;

  const W = narrow ? 360 : 720;
  const H = narrow ? 560 : 350;
  const R = narrow ? 92 : 100; // pixels per unit
  const cx = narrow ? 180 : 190;
  const cy = narrow ? 172 : 172;
  const toPx = ([a, b]) => [cx + a * R, cy - b * R];
  const fromPx = (px, py) => clampLen([(px - cx) / R, (cy - py) / R]);

  const onDown = (which) => (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(which); };
  const onMove = (e) => {
    if (!drag) return;
    const pt = svgPoint(e, svgRef.current);
    if (!pt) return;
    const v = fromPx(pt.x, pt.y).map((t) => Math.round(t * 20) / 20);
    (drag === 'h' ? setH : setY)(v);
  };
  const onKey = (which) => (e) => {
    const d = { ArrowRight: [0.1, 0], ArrowLeft: [-0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const set = which === 'h' ? setH : setY;
    set((v) => clampLen([Math.round((v[0] + d[0]) * 20) / 20, Math.round((v[1] + d[1]) * 20) / 20]));
  };

  // the score bars (diverging from 0)
  const bx = narrow ? 30 : 420;
  const by = narrow ? 380 : 70;
  const bw = narrow ? 300 : 260;
  const zero = bx + bw / 2;
  const span = 3; // ±3 fills half the width
  const bars = [
    { key: 'dot', label: 'dot product', tex: 'h(t)ᵀ y(i)', v: dot },
    { key: 'gen', label: 'general', tex: 'h(t)ᵀ W y(i)', v: gen },
    { key: 'cat', label: 'concat', tex: 'vᵀ tanh(W[h(t); y(i)])', v: cat },
  ];
  const [hx, hy] = toPx(h);
  const [yx, yy] = toPx(y);

  return (
    <Stage
      title="Three ways to score a match"
      slides="slides 24–25"
      tryThis="Predict the dot product at right angles, drag a tip to check, then give y a third number."
      caption={long ? 'With different lengths there is no dot product (slide 24’s one constraint); the general score still works with a 2 × 3 W (this page’s observation).' : 'The dot product grows when h and y point the same way, and goes negative when they oppose.'}
      challenge={{ text: 'Make the dot-product score zero.', done }}
      own="W, v and the vectors are this page’s own toy values (d = 2)"
      maths={
        <>
          <MEq tex={'e_{(t,i)} = \\begin{cases} \\mathbf{h}_{(t)}^{\\top} \\mathbf{y}_{(i)} & \\text{dot product} \\\\ \\mathbf{h}_{(t)}^{\\top} \\mathbf{W} \\mathbf{y}_{(i)} & \\text{general dot product} \\\\ \\mathbf{v}^{\\top} \\text{tanh} \\big( \\mathbf{W} \\big[ \\mathbf{h}_{(t)} ; \\mathbf{y}_{(i)} \\big] \\big) & \\text{concat} \\end{cases}'} />
          <MLine text={`$\\mathbf{h}_{(t)} = ${fmtVec(h)}$, $\\mathbf{y}_{(i)} = ${fmtVec(yv)}$.`} />
          <MLine text={long ? 'dot product: undefined (a 2-number vector can’t be dotted with a 3-number one).' : `dot product: $${fmt(h[0])} \\times ${fmt(y[0])} + ${fmt(h[1])} \\times ${fmt(y[1])} = ${fmt(dot)}$.`} />
          <MLine text={`general: $\\mathbf{W} = ${bmatrix(long ? W3 : W2)}$, so $e = ${fmt(gen)}$.`} />
          <MLine text={long ? 'concat: this page’s 2 × 4 W expects two 2-number vectors, so it is left out here.' : `concat: $\\mathbf{W} = ${bmatrix(WC)}$, $\\mathbf{v} = ${fmtVec(VC)}$, so $e = ${fmt(cat)}$.`} />
          <MLine text={'A softmax of these scores over the encoder outputs gives the weights, and the weighted sum is $\\widetilde{\\mathbf{h}}_{(t)}$ ([§6](#s06) shows that part). Slide 25: the concat variant was outperformed by the two dot-product variants.'} />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl8s-floorrow">
          <div className="dl8s-switch" role="group" aria-label="Length of y">
            <button type="button" className={`dl8s-switch__opt${!long ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={!long} onClick={() => setLong(false)}>same length</button>
            <button type="button" className={`dl8s-switch__opt${long ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={long} onClick={() => setLong(true)}>give y a third number</button>
          </div>
        </div>
        <svg ref={svgRef} className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} role="group" aria-label={`h = ${fmtVec(h)}, y = ${fmtVec(yv)}; dot ${long ? 'undefined' : fmt(dot)}, general ${fmt(gen)}, concat ${long ? 'n/a' : fmt(cat)}`}>
          {/* the plane */}
          <circle cx={cx} cy={cy} r={1.6 * R} className="dl8s-lu__ring" />
          <line className="dl8s-ax" x1={cx - 1.7 * R} y1={cy} x2={cx + 1.7 * R} y2={cy} />
          <line className="dl8s-ax" x1={cx} y1={cy - 1.7 * R} x2={cx} y2={cy + 1.7 * R} />
          {/* the angle between them */}
          <path className="dl8s-lu__angle" d={`M${cx} ${cy} L${cx + (hx - cx) * 0.3} ${cy + (hy - cy) * 0.3} L${cx + (yx - cx) * 0.3} ${cy + (yy - cy) * 0.3} Z`} />
          {/* y(i), encoder */}
          <line className="dl8s-lu__vec dl8s-lu__vec--enc" x1={cx} y1={cy} x2={yx} y2={yy} />
          <g className={`dl8s-lu__tip${drag === 'y' ? ' dl8s-lu__tip--drag' : ''}`} role="slider" tabIndex={0} aria-label="Encoder output y(i): drag, or use the arrow keys" aria-valuetext={fmtVec(y)} onPointerDown={onDown('y')} onKeyDown={onKey('y')}>
            <circle cx={yx} cy={yy} r={16} fill="transparent" />
            <circle cx={yx} cy={yy} r={8} className="dl8s-lu__dot dl8s-lu__dot--enc" />
          </g>
          <text x={yx + 12} y={yy - 10} className="dl8s-t dl8s-t--b dl8s-t--enc">y(i)</text>
          {/* h(t), decoder */}
          <line className="dl8s-lu__vec dl8s-lu__vec--dec" x1={cx} y1={cy} x2={hx} y2={hy} />
          <g className={`dl8s-lu__tip${drag === 'h' ? ' dl8s-lu__tip--drag' : ''}`} role="slider" tabIndex={0} aria-label="Decoder state h(t): drag, or use the arrow keys" aria-valuetext={fmtVec(h)} onPointerDown={onDown('h')} onKeyDown={onKey('h')}>
            <circle cx={hx} cy={hy} r={16} fill="transparent" />
            <circle cx={hx} cy={hy} r={8} className="dl8s-lu__dot dl8s-lu__dot--dec" />
          </g>
          <text x={hx + 12} y={hy + 18} className="dl8s-t dl8s-t--b dl8s-t--dec">h(t)</text>

          {/* the three scores */}
          <line className="dl8s-ax" x1={zero} y1={by - 18} x2={zero} y2={by + bars.length * 64 - 26} />
          {bars.map((b, k) => {
            const y0 = by + k * 64;
            const ok = b.v !== null && b.v !== undefined;
            const len = ok ? Math.max(-1, Math.min(1, b.v / span)) * (bw / 2) : 0;
            return (
              <g key={b.key}>
                <text x={bx} y={y0 - 4} className="dl8s-t dl8s-t--s dl8s-t--b">{b.label}</text>
                <text x={bx + bw} y={y0 - 4} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{b.tex}</text>
                <rect x={bx} y={y0 + 2} width={bw} height={20} rx={4} className="dl8s-lu__track" />
                {ok ? (
                  <rect x={zero} y={y0 + 2} width={1} height={20} className={`dl8s-lu__bar${b.v < 0 ? ' dl8s-lu__bar--neg' : ''}`} style={{ transformOrigin: `${zero}px 0px`, transform: `scaleX(${len || 0.001})` }} />
                ) : (
                  <g>
                    <line x1={bx + 8} y1={y0 + 12} x2={bx + bw - 8} y2={y0 + 12} className="dl8s-lu__blocked" />
                    <text x={zero} y={y0 + 16} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-lu__nolab">{b.key === 'dot' ? 'needs the same length' : 'not with this W'}</text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={bx} y={by + bars.length * 64 - 10} className="dl8s-t dl8s-t--xs">negative</text>
          <text x={bx + bw} y={by + bars.length * 64 - 10} textAnchor="end" className="dl8s-t dl8s-t--xs">positive</text>
        </svg>
      </div>
    </Stage>
  );
}
