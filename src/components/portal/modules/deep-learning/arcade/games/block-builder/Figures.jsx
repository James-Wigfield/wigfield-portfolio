import { UI, LENET5, ALEXNET, INCEPTION, RESIDUAL } from '../../content/block-builder';
import { cellText } from '../../maths/blockBuilder';
import { arrowHead, INC, RES, resBox, skipPath } from './geom';

/* ============================================================================
   BLOCK BUILDER — THE PICTURES
   ----------------------------------------------------------------------------
   Tower            a stack of blocks drawn bottom → top (or a list of steps
                    top → bottom), like Figure 14-15: outlined boxes in the
                    figure's colours, arrows between them, dashed slots
   SlideTable       slide 37's / 39's layer table, ruled, Out at the top
   InceptionFigure  Figure 14-14 (SVG): four branch columns + depth concat
   ResidualFigure   Figure 14-16 (SVG): the residual unit, optionally wired
   DepthBar         a depth concat drawn as four stacked segments
   Every label comes from content/block-builder.js.
   ========================================================================== */

const TABLES = { lenet5: LENET5, alexnet: ALEXNET };

export function Tower({ blocks, label, down = false, compact = false, caption = null }) {
  return (
    <figure className="dla-bk-figure">
      <ol className={`dla-bk-tower${down ? ' dla-bk-tower--down' : ''}${compact ? ' dla-bk-tower--compact' : ''}`} aria-label={label}>
        {blocks.map((b) => (
          <li
            key={b.key}
            className={`dla-bk-blk dla-bk-blk--${b.state ?? 'fixed'}${b.mark ? ` dla-bk-blk--${b.mark}` : ''}${b.next ? ' dla-bk-blk--next' : ''}${b.code ? ' dla-bk-blk--code' : ''}`}
            data-tone={b.state === 'slot' ? undefined : b.tone}
            aria-label={b.state === 'slot' ? b.aria : undefined}
          >
            {b.state === 'slot' ? (
              <span className="dla-bk-blk__q" aria-hidden="true">{b.n}</span>
            ) : (
              <>
                {b.name && <span className="dla-bk-blk__name">{b.name}</span>}
                <span className="dla-bk-blk__label">{b.label}</span>
                {b.sub && <span className="dla-bk-blk__sub">{b.sub}</span>}
              </>
            )}
          </li>
        ))}
      </ol>
      {caption && <figcaption className="dla-bk-cap">{caption}</figcaption>}
    </figure>
  );
}

/* rows: indices to show (bottom → top); blank: { row, col, value, mark } */
export function SlideTable({ tableKey, rows, blank = null, hiddenAbove = false, caption = null, columns = null }) {
  const table = TABLES[tableKey];
  const cols = columns ?? table.columns;
  const shown = rows.slice().sort((a, b) => b - a); // Out at the top, as printed
  const numeric = new Set(['maps', 'size', 'kernel', 'stride']);
  return (
    <figure className="dla-bk-figure">
      <div className="dla-bk-tablewrap">
        <table className="dla-bk-table">
          <thead>
            <tr>{cols.map((c) => <th key={c} scope="col" aria-label={UI.cols[c]}><span className="dla-bk-th--long">{UI.cols[c]}</span><span className="dla-bk-th--short" aria-hidden="true">{UI.colsShort[c]}</span></th>)}</tr>
          </thead>
          <tbody>
            {hiddenAbove && (
              <tr className="dla-bk-table__more"><td colSpan={cols.length}>{UI.more} {UI.hiddenRows}</td></tr>
            )}
            {shown.map((r) => {
              const row = table.rows[r];
              return (
                <tr key={r}>
                  {cols.map((c) => {
                    const isBlank = blank && blank.row === r && blank.col === c;
                    if (isBlank) {
                      return (
                        <td key={c} className={`dla-bk-td--q${blank.mark ? ` dla-bk-td--${blank.mark}` : ''}`}>
                          <span className="dla-bk-q">{blank.value === '' || blank.value == null ? '?' : blank.value}{c === 'size' && blank.square ? ` × ${blank.value === '' || blank.value == null ? '?' : blank.value}` : ''}</span>
                        </td>
                      );
                    }
                    return <td key={c} className={numeric.has(c) ? 'dla-bk-td--n' : undefined}>{c === 'layer' ? <b>{row.layer}</b> : <Cell row={row} col={c} />}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {caption && <figcaption className="dla-bk-cap">{caption}</figcaption>}
    </figure>
  );
}

/* a printed cell: "13 × 13" with a squeezable ×, "3(RGB)" with a small note */
function Cell({ row, col }) {
  const v = row[col];
  if ((col === 'size' && Array.isArray(v)) || (col === 'kernel' && v != null)) {
    const [a, b] = Array.isArray(v) ? v : [v, v];
    return <>{a}<span className="dla-bk-x">×</span>{b}</>;
  }
  if (col === 'maps' && row.mapsNote) return <>{v}<small className="dla-bk-note">{row.mapsNote}</small></>;
  return cellText(row, col);
}

function Box({ x, y, w, h, tone, top, bottom, dashed = false, mark = null }) {
  return (
    <g className={`dla-bk-box${dashed ? ' dla-bk-box--slot' : ''}${mark ? ` dla-bk-box--${mark}` : ''}`} data-tone={dashed ? undefined : tone}>
      <rect x={x} y={y} width={w} height={h} rx="4" />
      {top && <text x={x + w / 2} y={y + (bottom ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" className="dla-bk-box__t">{top}</text>}
      {bottom && <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" className="dla-bk-box__s">{bottom}</text>}
    </g>
  );
}
function Arrow({ x1, y1, x2, y2, cls = '' }) {
  return (
    <g className={`dla-bk-arrow ${cls}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={arrowHead(x1, y1, x2, y2)} />
    </g>
  );
}

/* columns: 4 entries, each { parts, mark } or null (an empty slot); next = the slot to fill */
export function InceptionFigure({ columns = INCEPTION.branches.map((b) => ({ parts: b.parts })), next = -1, caption = null, label }) {
  const { cols, boxW, boxH, upperY, lowerY, fan, inputY, concat, frame } = INC;
  const cTop = concat.y + concat.h;
  return (
    <figure className="dla-bk-figure">
      <svg className="dla-svg dla-bk-svg dla-bk-svg--inc" viewBox={`0 0 ${INC.w} ${INC.h}`} role="img" aria-label={label}>
        <rect className="dla-bk-frame" x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="10" />
        <Arrow x1={concat.x + concat.w / 2} y1={concat.y} x2={concat.x + concat.w / 2} y2={10} />
        <line className="dla-bk-line" x1={fan[0]} y1={inputY + 4} x2={fan[0]} y2={fan[1]} />
        <Box x={concat.x} y={concat.y} w={concat.w} h={concat.h} tone="concat" top={UI.concat} />
        {columns.map((col, i) => {
          const cx = cols[i];
          const x = cx - boxW / 2;
          if (!col) {
            return (
              <g key={i} className={`dla-bk-incslot${i === next ? ' dla-bk-incslot--next' : ''}`}>
                <line className="dla-bk-line dla-bk-line--ghost" x1={fan[0]} y1={fan[1]} x2={cx} y2={lowerY + boxH} />
                <rect x={x} y={upperY} width={boxW} height={lowerY + boxH - upperY} rx="5" />
                <text x={cx} y={(upperY + lowerY + boxH) / 2 + 5} textAnchor="middle" className="dla-bk-box__q">{i + 1}</text>
              </g>
            );
          }
          const two = col.parts.length > 1;
          const upper = col.parts[col.parts.length - 1];
          const lower = two ? col.parts[0] : null;
          return (
            <g key={i} className="dla-bk-col">
              <line className="dla-bk-line" x1={fan[0]} y1={fan[1]} x2={cx} y2={two ? lowerY + boxH : lowerY + boxH} />
              {!two && <Arrow x1={cx} y1={lowerY + boxH} x2={cx} y2={upperY + boxH} />}
              {two && <Arrow x1={cx} y1={lowerY} x2={cx} y2={upperY + boxH} />}
              <Arrow x1={cx} y1={upperY} x2={concat.x + concat.w / 2 + (i - 1.5) * 18} y2={cTop} />
              {lower && <Box x={x} y={lowerY} w={boxW} h={boxH} tone={lower.tone} top={lower.type} bottom={lower.spec} mark={col.mark} />}
              <Box x={x} y={upperY} w={boxW} h={boxH} tone={upper.tone} top={upper.type} bottom={upper.spec} mark={col.mark} />
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="dla-bk-cap">{caption}</figcaption>}
    </figure>
  );
}

/* skip: [from, to] or null; hide: 'fx' | 'out' | null; pick: wiring state for level 2
   ({ onPick, from, live, mark }) — the four blocks become buttons */
export function ResidualFigure({ skip = RESIDUAL.answer, hide = null, pick = null, caption = null, label }) {
  const blocks = RESIDUAL.blocks;
  const { cx } = RES;
  const add = resBox('add');
  const l2 = resBox('l2');
  const l1 = resBox('l1');
  const inp = resBox('in');
  const path = skip ? skipPath(skip[0], skip[1]) : null;
  const wiring = !!pick;
  return (
    <figure className="dla-bk-figure">
      <svg
        className="dla-svg dla-bk-svg dla-bk-svg--res"
        viewBox={`0 0 ${RES.w} ${RES.h}`}
        role={wiring ? 'group' : 'img'}
        aria-label={label}
      >
        <Arrow x1={cx} y1={add.y} x2={cx} y2={RES.outY} />
        <text x={cx} y={RES.outY - 8} textAnchor="middle" className="dla-bk-sym">{hide === 'out' ? '?' : RESIDUAL.out}</text>
        <Arrow x1={cx} y1={inp.y} x2={cx} y2={l1.y + l1.h} />
        <Arrow x1={cx} y1={l1.y} x2={cx} y2={l2.y + l2.h} />
        <Arrow x1={cx} y1={l2.y} x2={cx} y2={add.y + add.h} />
        {/* the bracket over Layer 1 and Layer 2 */}
        <path className="dla-bk-line" d={`M${l2.x + l2.w + 6} ${l2.y} h8 v${l1.y + l1.h - l2.y} h-8`} fill="none" />
        <text x={l2.x + l2.w + 20} y={(l2.y + l1.y + l1.h) / 2 + 4} className="dla-bk-sym dla-bk-sym--s">{hide === 'fx' ? 'f(x) = ?' : RESIDUAL.fx}</text>
        {path && (
          <g className={`dla-bk-skip${pick?.mark ? ` dla-bk-skip--${pick.mark}` : ''}`}>
            <path d={path.d} fill="none" />
            <polygon points={arrowHead(path.from[0], path.from[1], path.tip[0], path.tip[1], 7)} />
            {!wiring && (
              <text className="dla-bk-sym dla-bk-sym--s" transform={`translate(${RES.railX - 8} ${(inp.y + add.y) / 2 + 40}) rotate(-90)`}>{UI.skip}</text>
            )}
          </g>
        )}
        {blocks.map((b) => {
          const r = resBox(b.id);
          const isAdd = b.id === 'add';
          const tone = b.id === 'in' ? 'in' : isAdd ? 'add' : 'layer';
          const sel = wiring && pick.from === b.id;
          const body = (
            <>
              <rect className="dla-bk-res__hit" x={r.x - 6} y={r.y - 5} width={r.w + 12} height={r.h + 10} rx="8" />
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={isAdd ? 4 : 5} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (isAdd ? 6 : 5)} textAnchor="middle" className={isAdd ? 'dla-bk-box__plus' : 'dla-bk-box__t'}>{b.label}</text>
              {wiring && <text x={r.x + r.w + (isAdd ? 8 : -12)} y={r.y + 13} className="dla-bk-box__key" textAnchor={isAdd ? 'start' : 'middle'}>{b.key}</text>}
            </>
          );
          if (!wiring) return <g key={b.id} className="dla-bk-box" data-tone={tone}>{body}</g>;
          return (
            <g
              key={b.id}
              className={`dla-bk-box dla-bk-res__btn${sel ? ' dla-bk-res__btn--from' : ''}`}
              data-tone={tone}
              role="button"
              tabIndex={pick.live ? 0 : -1}
              aria-label={`${b.key}: ${b.label}${sel ? ' (skip starts here)' : ''}`}
              aria-disabled={!pick.live}
              onClick={() => pick.onPick(b.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick.onPick(b.id); } }}
            >
              {body}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="dla-bk-cap">{caption}</figcaption>}
    </figure>
  );
}

const SEG_TONES = ['k', 'v', 'q', 'pos'];
/* parts: the four numbers (widths ∝ value); total: the item's answer, shown only when `reveal` */
export function DepthBar({ parts, total, reveal = false, label }) {
  const sum = parts.reduce((a, b) => a + b, 0);
  const W = 320;
  const x0 = 10;
  const span = W - 2 * x0;
  const starts = parts.map((_, i) => x0 + (parts.slice(0, i).reduce((a, b) => a + b, 0) / sum) * span);
  return (
    <svg className="dla-svg dla-bk-svg dla-bk-bar" viewBox={`0 0 ${W} 70`} role="img" aria-label={label}>
      {parts.map((p, i) => {
        const x = starts[i];
        const w = (p / sum) * span;
        return (
          <g key={i} className={`dla-bk-seg dla-bk-seg--${SEG_TONES[i]}`}>
            <rect x={x + 1} y="8" width={Math.max(2, w - 2)} height="24" rx="3" />
            <text x={x + w / 2} y="25" textAnchor="middle" className="dla-bk-seg__t">{p}</text>
          </g>
        );
      })}
      <path className="dla-bk-line" d={`M${x0} 38 v6 H${W - x0} v-6`} fill="none" />
      <text x={W / 2} y="62" textAnchor="middle" className="dla-bk-sym dla-bk-sym--s">{UI.sumBar} = {reveal ? total : '?'}</text>
    </svg>
  );
}
