import { useJson } from '../../../engine/hooks';
import { FACTS } from '../../../shared/facts';
import { Num } from '../../../shared/Num';

/* ============================================================================
   VERDICT DECK — N4a THE UNDERDOG TABLE, N4b SCATTER TO POOLED BARS
   ----------------------------------------------------------------------------
   N4a: tab:method-departures, simplified (every value through <Num>).
   N4b: the 100 DEEP-PSMA scans (data/fair-per-case.json: run 4 minus
   PSMASegmentator, per-case F1 in points, exact-fraction signs), on a log
   axis of lesion count. Sign is shape as well as colour (circle above zero,
   square below, diamond tied).
     step 1  the dots scatter, every scan the same size
     step 2  each dot grows with its lesion count (pooled F1 counts lesions,
             so lesion-heavy scans weigh most) and stays at full strength;
             copies fly into a separate panel where the pooled differences
             rise: F1, sensitivity, precision (run 4 minus PSMASegmentator,
             pooled over all lesions)
   The pooled panel is its own chart: ruled off, its own axis, its own zero
   at a different height, so the two scales never share a baseline. The
   pooled bars are the pooled metrics, not a weighted mean of the dots.
   ========================================================================== */

export function UnderdogTable() {
  return (
    <div className="d2-under">
      <table className="d2-table">
        <thead>
          <tr>
            <th data-role="foot" />
            <th data-role="foot">Run 4 (mine)</th>
            <th data-role="foot">PSMASegmentator</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" data-role="body">Training scans</th>
            <td data-role="body"><Num k="train.run4_cases" /> autoPET-III</td>
            <td data-role="body"><Num k="psm.train" /></td>
          </tr>
          <tr>
            <th scope="row" data-role="body">At inference</th>
            <td data-role="body">one model, one pass</td>
            <td data-role="body"><Num k="psm.folds" /> models, <Num k="psm.tta" /> mirrored passes each</td>
          </tr>
          <tr>
            <th scope="row" data-role="body">Parameters</th>
            <td data-role="body"><Num k="net.params" /></td>
            <td data-role="body"><Num k="psm.params" /></td>
          </tr>
        </tbody>
      </table>
      <p className="d2-under__test" data-role="body">
        Tested on the <Num k="fair.n" /> DEEP-PSMA scans that neither model trained on.
      </p>
    </div>
  );
}

const W = 1240;
const H = 556;
const P = { x0: 118, x1: 780, y0: 40, y1: 460 }; // per-scan panel
const ZERO = (P.y0 + P.y1) / 2;
const SPAN = 50; // per-scan axis, points either side of zero
const ZB = 292; // pooled panel zero (its own scale: +10 to -7 points)
const BAR = { x0: 936, w: 64, gap: 46, scale: (ZB - 70) / 10 };
const lx0 = Math.log10(1.6);
const lx1 = Math.log10(260);
const xOf = (n) => P.x0 + ((Math.log10(n) - lx0) / (lx1 - lx0)) * (P.x1 - P.x0);
const yOf = (d) => ZERO - (Math.max(-SPAN, Math.min(SPAN, d)) / SPAN) * (P.y1 - ZERO);
const yBar = (v) => ZB - v * BAR.scale;
const pts = (k) => FACTS[k].value;
const POOLED = [
  { k: 'fair.df1', label: 'F1', lo: 'fair.df1_lo', hi: 'fair.df1_hi' },
  { k: 'fair.dsens', label: 'Sensitivity' },
  { k: 'fair.dppv', label: 'Precision' },
];
const TICKS_X = [2, 5, 10, 20, 50, 100, 200];

function Mark({ d, r }) {
  if (d > 0) return <circle r={r} />;
  if (d < 0) return <rect x={-r * 0.86} y={-r * 0.86} width={r * 1.72} height={r * 1.72} />;
  return <path d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`} />;
}

export default function FairChart({ step }) {
  const data = useJson('data/fair-per-case.json');
  const cases = data?.cases ?? [];
  const pooled = step >= 2;
  const f1x = BAR.x0 + BAR.w / 2;
  return (
    <svg className={`d2-n4 d2-step-${step}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Per-scan F1 differences against lesion count, pooling into the pooled differences">
      {/* Panel titles */}
      <text x={P.x0} y={20} className="d2-n4__title" data-role="chart">Each scan: run 4 minus PSMASegmentator, F1 points</text>
      <g className={`d2-n4__pooled-t${pooled ? ' is-on' : ''}`}>
        <line x1="846" x2="846" y1="0" y2={H - 40} className="d2-n4__sep" />
        <text x={BAR.x0 - 54} y={20} className="d2-n4__title" data-role="chart">Pooled over all lesions</text>
        <text x={BAR.x0 - 54} y={54} className="d2-n4__axlab" data-role="chart">difference, points</text>
      </g>

      {/* Bands: few lesions, many lesions */}
      <rect x={xOf(1.6)} y={P.y0} width={xOf(19.5) - xOf(1.6)} height={P.y1 - P.y0} className="d2-n4__band" />
      <rect x={xOf(99.5)} y={P.y0} width={xOf(260) - xOf(99.5)} height={P.y1 - P.y0} className="d2-n4__band" />
      <text x={xOf(1.6) + 10} y={P.y0 + 32} className="d2-n4__bandlab" data-role="chart">
        under <Num k="fair.lt20_cut" svg />
      </text>
      <text x={xOf(260) - 10} y={P.y0 + 32} textAnchor="end" className="d2-n4__bandlab" data-role="chart">
        <Num k="fair.ge100_cut" svg /> or more
      </text>

      {/* Axes */}
      <line x1={P.x0} x2={P.x1} y1={ZERO} y2={ZERO} className="d2-n4__zero" />
      {[-40, -20, 20, 40].map((t) => (
        <text key={t} x={P.x0 - 14} y={yOf(t) + 10} textAnchor="end" className="d2-n4__tick" data-tick="" data-role="chart">{t > 0 ? `+${t}` : `${t}`}</text>
      ))}
      <text x={P.x0 - 14} y={ZERO + 10} textAnchor="end" className="d2-n4__tick" data-tick="" data-role="chart">0</text>
      {TICKS_X.map((t) => (
        <g key={t}>
          <line x1={xOf(t)} x2={xOf(t)} y1={P.y1} y2={P.y1 + 8} className="d2-n4__axis" />
          <text x={xOf(t)} y={P.y1 + 40} textAnchor="middle" className="d2-n4__tick" data-tick="" data-role="chart">{`${t}`}</text>
        </g>
      ))}
      <line x1={P.x0} x2={P.x1} y1={P.y1} y2={P.y1} className="d2-n4__axis" />
      <text x={(P.x0 + P.x1) / 2} y={H - 6} textAnchor="middle" className="d2-n4__axlab" data-role="chart">Lesions in the scan (log scale)</text>
      <text x={xOf(21)} y={P.y0 + 32} className="d2-n4__zone" data-role="chart">run 4 better</text>
      <text x={xOf(21)} y={P.y1 - 16} className="d2-n4__zone" data-role="chart">PSMASegmentator better</text>

      {/* Ghost dots: stay as the per-scan picture */}
      <g className={`d2-n4__dots${step >= 1 ? ' is-on' : ''}`}>
        {cases.map(([n, d], i) => {
          const w = (2.2 + 1.35 * Math.sqrt(n)) / 8;
          return (
            <g key={i} className={`d2-n4__pt ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-tie'}`} style={{ transform: `translate(${xOf(n) + ((i % 5) - 2) * 1.2}px, ${yOf(d)}px) scale(${pooled ? w : 1})` }}>
              <Mark d={d} r={8} />
            </g>
          );
        })}
      </g>
      {/* Flying copies: pool into the F1 bar (CSS keyframes; invisible in stills) */}
      <g className={`d2-n4__fly${pooled ? ' is-go' : ''}`}>
        {cases.map(([n, d], i) => {
          const w = (2.2 + 1.35 * Math.sqrt(n)) / 8;
          const tx = f1x + ((i % 7) - 3) * 6;
          const ty = yBar(pts('fair.df1') / 2);
          return (
            <g
              key={i}
              className={`d2-n4__fp ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-tie'}`}
              style={{ '--x0': `${xOf(n) + ((i % 5) - 2) * 1.2}px`, '--y0': `${yOf(d)}px`, '--x1': `${tx}px`, '--y1': `${ty}px`, '--w': w, '--dl': `${(i % 10) * 18}ms` }}
            >
              <Mark d={d} r={8} />
            </g>
          );
        })}
      </g>

      {/* Pooled differences */}
      <g className={`d2-n4__bars${pooled ? ' is-on' : ''}`}>
        {[-5, 0, 5, 10].map((t) => (
          <text key={t} x={BAR.x0 - 16} y={yBar(t) + 9} textAnchor="end" className="d2-n4__tick" data-tick="" data-role="chart">{t > 0 ? `+${t}` : `${t}`}</text>
        ))}
        <line x1={BAR.x0 - 8} x2={BAR.x0 - 8} y1={yBar(10)} y2={yBar(-7)} className="d2-n4__axis" />
        <line x1={BAR.x0 - 8} x2={W - 6} y1={ZB} y2={ZB} className="d2-n4__zero" />
        {POOLED.map((b, i) => {
          const v = pts(b.k);
          const x = BAR.x0 + i * (BAR.w + BAR.gap);
          const top = v >= 0 ? yBar(v) : ZB;
          return (
            <g key={b.k} className={`d2-n4__bar ${v >= 0 ? 'is-up' : 'is-down'}`} style={{ '--d2-bd': `${i * 140}ms` }}>
              <rect x={x} y={top} width={BAR.w} height={Math.abs(yBar(v) - ZB)} className="d2-n4__barrect" style={{ transformOrigin: `0px ${ZB}px` }} />
              {b.lo && (
                <g className="d2-n4__ci">
                  <line x1={x + BAR.w / 2} x2={x + BAR.w / 2} y1={yBar(pts(b.lo))} y2={yBar(pts(b.hi))} />
                  <line x1={x + BAR.w / 2 - 12} x2={x + BAR.w / 2 + 12} y1={yBar(pts(b.hi))} y2={yBar(pts(b.hi))} />
                  <line x1={x + BAR.w / 2 - 12} x2={x + BAR.w / 2 + 12} y1={yBar(pts(b.lo))} y2={yBar(pts(b.lo))} />
                </g>
              )}
              <text x={x + BAR.w / 2} y={v >= 0 ? yBar(b.hi ? pts(b.hi) : v) - 16 : yBar(v) + 40} textAnchor="middle" className="d2-n4__val" data-role="chart">
                <Num k={b.k} svg />
              </text>
              <text x={x + BAR.w / 2} y={v >= 0 ? ZB + 40 : ZB - 16} textAnchor="middle" className="d2-n4__barlab" data-role="chart">{b.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
