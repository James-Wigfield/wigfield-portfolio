import { rove } from '../../../rove';
import { windows } from '../../../maths/strideRules.js';

/* ============================================================================
   TOPIC 4 · A 1D STRIP: inputs, padding, windows, outputs
   ----------------------------------------------------------------------------
   <StripView x y n k s pad width hot onHot style /> draws one axis of a
   convolution the way Figures 14-7 / 14-8 do: the input cells (padding
   zeros hatched, ignored inputs crossed), one bracket per window position
   (stacked like the figure's, or as ghost frames with hop arcs), and the
   output cells above. `hot` = the window to emphasise (its inputs light up,
   its output fills). Geometry comes from strideRules.windows().
   ========================================================================== */

export default function StripView({ x = 0, y = 0, n, k, s, pad = 'valid', width = 600, hot = null, onHot, mode = 'brackets', idPrefix = 'st', reveal = Infinity }) {
  const W = windows(n, k, s, pad);
  const total = n + W.padLeft + W.padRight;
  const cell = Math.min(38, width / Math.max(total, 1));
  const x0 = x + (width - total * cell) / 2;
  const cx = (j) => x0 + (j + W.padLeft) * cell; // left edge of input j (j may be −1 … for padding)
  const inY = y + (mode === 'brackets' ? 34 + Math.min(W.out, 8) * 10 : 70);
  const outW = Math.min(cell, 30);
  const outX0 = x + width / 2 - (W.out * outW) / 2;
  const outY = y;
  const hatch = `${idPrefix}-hatch`;
  const hit = hot !== null && W.wins[hot] ? new Set(W.wins[hot].cells) : new Set();
  return (
    <g className={`dltt-strip${hot !== null ? ' dltt-strip--hot' : ''}`}>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="dltt-pad-line" />
        </pattern>
      </defs>
      {/* outputs */}
      {W.wins.map((w) => (
        <rect
          key={`o${w.i}`}
          x={outX0 + w.i * outW + 1}
          y={outY}
          width={outW - 2}
          height={outW - 2}
          rx={3}
          className={`dltt-outcell${w.i >= reveal ? ' dltt-outcell--empty' : ''}${hot === w.i ? ' dltt-outcell--hot' : ''}`}
          {...(onHot && w.i < reveal ? rove(`${idPrefix}o`, w.i, Math.min(W.out, reveal), Math.min(W.out, reveal), hot ?? 0) : {})}
          aria-label={onHot ? `${mode === 'brackets' ? `"${pad}" ` : ''}output ${w.i + 1}` : undefined}
          onPointerEnter={onHot ? () => onHot(w.i) : undefined}
          onPointerLeave={onHot ? () => onHot(null) : undefined}
          onFocus={onHot ? () => onHot(w.i) : undefined}
          onBlur={onHot ? () => onHot(null) : undefined}
        />
      ))}
      {/* brackets: each output numbered like its bracket, so no connector lines are needed */}
      {mode === 'brackets' && W.wins.map((w) => (w.i < reveal ? (
        <text key={`on${w.i}`} x={outX0 + w.i * outW + outW / 2} y={outY + outW / 2 + 3} textAnchor="middle" className="dltt-t dltt-t--xs dltt-strip__num" aria-hidden="true">{w.i + 1}</text>
      ) : null))}
      {/* windows: brackets (Figure 14-8 style) or ghost frames with hops */}
      {W.wins.map((w, i) => {
        const a = cx(w.from);
        const b = cx(w.to) + cell;
        const on = hot === i;
        const shown = i < reveal;
        if (mode === 'brackets') {
          const by = inY - 10 - (i % 8) * 10;
          const ox = outX0 + w.i * outW + outW / 2;
          return (
            <g key={`w${i}`} className={`dltt-bracket${on ? ' dltt-bracket--on' : ''}${shown ? '' : ' dltt-hide'}`} onPointerEnter={onHot ? () => onHot(i) : undefined} onPointerLeave={onHot ? () => onHot(null) : undefined}>
              <path d={`M${a + 2} ${inY - 3} V${by} H${b - 2} V${inY - 3}`} />
              <text x={a - 1} y={by + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-strip__num">{i + 1}</text>
              {/* the connector to its output only for the window in focus (all of them at once tangle) */}
              {on && <path d={`M${(a + b) / 2} ${by} L${ox} ${outY + outW}`} className="dltt-bracket__stem" />}
            </g>
          );
        }
        return (
          <g key={`w${i}`} className={shown ? '' : 'dltt-hide'}>
            <rect x={a + 1} y={inY - 4} width={b - a - 2} height={cell + 8} rx={4} className={`dltt-win${on ? '' : ' dltt-win--ghost'}`} />
            {i > 0 && (
              <path d={`M${cx(W.wins[i - 1].from) + cell / 2} ${inY - 8} Q ${(cx(W.wins[i - 1].from) + a) / 2 + cell / 2} ${inY - 8 - Math.max(14, s * cell * 0.45)} ${a + cell / 2} ${inY - 8}`} className="dltt-hop" />
            )}
          </g>
        );
      })}
      {/* inputs, padding zeros, ignored inputs */}
      {Array.from({ length: total }, (_, t) => {
        const j = t - W.padLeft;
        const padCell = j < 0 || j >= n;
        const ignored = !padCell && W.ignored.includes(j);
        return (
          <g key={`i${t}`}>
            <rect x={x0 + t * cell + 1} y={inY} width={cell - 2} height={cell - 2} rx={3} className={padCell ? 'dltt-pad' : `dltt-incell${hit.has(j) ? ' dltt-incell--hit' : ''}${ignored ? ' dltt-incell--ignored' : ''}`} style={padCell ? { fill: `url(#${hatch})` } : undefined} />
            {padCell && cell >= 16 && <text x={x0 + t * cell + cell / 2} y={inY + cell / 2 + 3} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">0</text>}
            {ignored && <path d={`M${x0 + t * cell + 5} ${inY + 4} L${x0 + (t + 1) * cell - 5} ${inY + cell - 6} M${x0 + (t + 1) * cell - 5} ${inY + 4} L${x0 + t * cell + 5} ${inY + cell - 6}`} className="dltt-ignored-x" />}
          </g>
        );
      })}
    </g>
  );
}
