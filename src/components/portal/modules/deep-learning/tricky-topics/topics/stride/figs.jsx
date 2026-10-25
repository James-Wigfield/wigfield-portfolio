import { windows } from '../../maths/strideRules.js';

/* ============================================================================
   TOPIC 4 · LINE ART FOR THE NOTEBOOK PAGE
   ----------------------------------------------------------------------------
   Monochrome, in currentColor (black pen; the `hl` parts in green), so it
   can be copied by hand in a minute. Fig148: L3 slide 21's Figure 14-8 —
   10 inputs, kernel 7, stride 2; "valid" (2 outputs, the last input
   ignored) beside "same" (2 + 3 zeros, 5 outputs). Geometry from
   strideRules.windows(), so the sketch can't disagree with the maths.
   ========================================================================== */

const hlCls = (hl, k) => (hl.includes(k) ? 'dltt-fig__hl' : undefined);

function Panel({ x, pad, hl, label }) {
  const W = windows(10, 7, 2, pad);
  const total = 10 + W.padLeft + W.padRight;
  const c = 13;
  const inY = 76;
  const outW = 14;
  const ox = x + (total * c) / 2 - (W.out * outW) / 2;
  return (
    <g>
      {Array.from({ length: total }, (_, t) => {
        const j = t - W.padLeft;
        const padCell = j < 0 || j >= 10;
        const ign = W.ignored.includes(j);
        return (
          <g key={t} data-part={padCell ? 'zeros' : ign ? 'ignored' : undefined} className={padCell ? hlCls(hl, 'zeros') : ign ? hlCls(hl, 'ignored') : undefined}>
            <rect x={x + t * c} y={inY} width={c} height={c} fill="none" />
            {padCell && <text x={x + t * c + c / 2} y={inY + 10} textAnchor="middle" fontSize={10} className="dltt-fig__t">0</text>}
            {ign && <path d={`M${x + t * c + 2} ${inY + 2} L${x + (t + 1) * c - 2} ${inY + c - 2} M${x + (t + 1) * c - 2} ${inY + 2} L${x + t * c + 2} ${inY + c - 2}`} />}
          </g>
        );
      })}
      {W.wins.map((w, i) => {
        const a = x + (w.from + W.padLeft) * c;
        const b = a + 7 * c;
        const by = inY - 6 - i * 7;
        // brackets numbered like their outputs instead of connector lines (five of those tangle)
        return (
          <g key={i}>
            <path d={`M${a + 1} ${inY - 2} V${by} H${b - 1} V${inY - 2}`} fill="none" />
            <text x={a - 2} y={by + 3} textAnchor="end" fontSize={9} className="dltt-fig__t">{i + 1}</text>
          </g>
        );
      })}
      {W.wins.map((w, i) => (
        <g key={`o${i}`}>
          <rect x={ox + i * outW} y={10} width={outW} height={14} fill="none" data-part="out" className={hlCls(hl, 'out')} />
          <text x={ox + i * outW + outW / 2} y={21} textAnchor="middle" fontSize={9} className="dltt-fig__t">{i + 1}</text>
        </g>
      ))}
      <text x={x + (total * c) / 2} y={108} textAnchor="middle" fontSize={12} className="dltt-fig__t">{label}</text>
    </g>
  );
}

export function Fig148({ hl = [] }) {
  return (
    <svg className="dltt-fig" viewBox="0 0 432 112" role="img" aria-label="Figure 14-8: ten inputs, kernel 7, stride 2. Valid: 2 outputs, the last input ignored. Same: 2 zeros left, 3 right, 5 outputs." stroke="currentColor" strokeWidth={1.1}>
      <Panel x={14} pad="valid" hl={hl} label={'"valid": 2 outputs, 1 ignored'} />
      <Panel x={226} pad="same" hl={hl} label={'"same": 0 0 | 10 | 0 0 0 → 5'} />
    </svg>
  );
}
