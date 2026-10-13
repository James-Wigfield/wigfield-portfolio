import { FACTS } from '../../../shared/facts';
import { Num } from '../../../shared/Num';

/* ============================================================================
   VERDICT DECK — N5, THE TWIN (run 6, 2x2, DEEP-PSMA primary set)
   ----------------------------------------------------------------------------
   Left: the two training windows drawn to scale (mm from the manifest).
   Right: the 2x2 as an interaction plot. F1 sits on a truncated axis, so the
   cells are points joined by lines, not bars (a bar must start at zero).
     step 1  the usual-window points: hybrid and twin level
     step 2  the large-window points appear at the usual level and drop to
             their own: the twin a little, the hybrid a lot. Each drop is
             traced and labelled with its patch effect (r6.h_patch,
             r6.c_patch), so the caption's interaction is visibly the
             difference of the two labels.
   PSMASegmentator's F1 on the same cases is a dashed context line.
   ========================================================================== */

const v = (k) => FACTS[k].value;
const W = 1240;
const H = 540;
const C = { x0: 470, x1: 1220, y0: 40, y1: 470, lo: 74, hi: 84 };
const XS = 600;
const XL = 930;
const yOf = (f) => C.y1 - ((f - C.lo) / (C.hi - C.lo)) * (C.y1 - C.y0);

/* Windows to scale: z (head to toe) up, x (left to right) across, y (front
   to back) as an oblique depth. */
const MM = 0.3;
const DEPTH = 0.354;
function Box({ x, base, zmm, xmm, ymm, cls }) {
  const w = xmm * MM;
  const h = zmm * MM;
  const d = ymm * MM * DEPTH;
  const top = base - h;
  return (
    <g className={`d2-n5__box ${cls}`}>
      <path d={`M ${x} ${top} l ${d} ${-d} h ${w} l ${-d} ${d} Z`} className="d2-n5__box-top" />
      <path d={`M ${x + w} ${top} l ${d} ${-d} v ${h} l ${-d} ${d} Z`} className="d2-n5__box-side" />
      <rect x={x} y={top} width={w} height={h} className="d2-n5__box-front" />
    </g>
  );
}

const SERIES = [
  { id: 'twin', name: 'CNN-only twin', s: 'r6.c_small', l: 'r6.c_large', d: 'r6.c_patch' },
  { id: 'hyb', name: 'Hybrid', s: 'r6.h_small', l: 'r6.h_large', d: 'r6.h_patch' },
];

export default function TwinChart({ step }) {
  const small = step >= 1;
  const large = step >= 2;
  const psm = v('fair.psm_f1') * 100;
  return (
    <svg className={`d2-n5 d2-step-${step}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Run 6: F1 of the hybrid and its CNN-only twin at the usual and the large training window">
      {/* The design: two windows, to scale */}
      <text x="0" y="26" className="d2-n5__title" data-role="chart">Training windows, to scale</text>
      <Box x={14} base={330} zmm={v('patch.small_z_mm')} xmm={v('patch.small_x_mm')} ymm={v('patch.small_y_mm')} cls="is-small" />
      <Box x={150} base={330} zmm={v('patch.large_z_mm')} xmm={v('patch.large_x_mm')} ymm={v('patch.small_y_mm')} cls="is-large" />
      <text x="14" y="376" className="d2-n5__lab" data-role="chart">usual</text>
      <text x="150" y="376" className="d2-n5__lab" data-role="chart">large</text>
      <g className="d2-n5__key">
        <line x1="14" x2="64" y1="438" y2="438" className="d2-n5__line is-hyb" />
        <circle cx="39" cy="438" r="10" className="d2-n5__pt is-hyb" />
        <text x="80" y="448" className="d2-n5__lab" data-role="chart">Hybrid</text>
        <line x1="14" x2="64" y1="496" y2="496" className="d2-n5__line is-twin" />
        <rect x="29" y="486" width="20" height="20" className="d2-n5__pt is-twin" />
        <text x="80" y="506" className="d2-n5__lab" data-role="chart">CNN-only twin</text>
        <text x="80" y="542" className="d2-n5__lab d2-n5__lab--muted" data-role="chart">(Mamba removed)</text>
      </g>

      {/* Axis */}
      <text x={C.x0} y="26" className="d2-n5__title" data-role="chart">F1 on the DEEP-PSMA scans</text>
      {[75, 80].map((t) => (
        <g key={t}>
          <line x1={C.x0 + 30} x2={C.x1} y1={yOf(t)} y2={yOf(t)} className="d2-n5__grid" />
          <text x={C.x0 + 18} y={yOf(t) + 10} textAnchor="end" className="d2-n5__tick" data-tick="" data-role="chart">{`${t}`}</text>
        </g>
      ))}
      <text x={XS} y={C.y1 + 52} textAnchor="middle" className="d2-n5__lab" data-role="chart">usual window</text>
      <text x={XL} y={C.y1 + 52} textAnchor="middle" className="d2-n5__lab" data-role="chart">large window</text>

      {/* PSMASegmentator, context */}
      <g className={`d2-n5__psm${small ? ' is-on' : ''}`}>
        <line x1={C.x0 + 30} x2={C.x1} y1={yOf(psm)} y2={yOf(psm)} />
        <text x={C.x0 + 40} y={yOf(psm) + 36} className="d2-n5__lab d2-n5__lab--psm" data-role="chart">PSMASegmentator</text>
      </g>

      {/* Drops, traced and labelled with each architecture's patch effect */}
      {SERIES.map((sr) => (
        <g key={`d-${sr.id}`} className={`d2-n5__dropg${large ? ' is-on' : ''}`}>
          <line x1={XL} x2={XL} y1={yOf(v(sr.s))} y2={yOf(v(sr.l))} className={`d2-n5__drop is-${sr.id}`} />
          <text x={XL + 24} y={(yOf(v(sr.s)) + yOf(v(sr.l))) / 2 + (sr.id === 'twin' ? 2 : 12)} className={`d2-n5__dv is-${sr.id}`} data-role="chart">
            <Num k={sr.d} svg />
          </text>
        </g>
      ))}

      {/* Lines and points */}
      {SERIES.map((sr) => {
        const ys = yOf(v(sr.s));
        const yl = large ? yOf(v(sr.l)) : ys;
        return (
          <g key={sr.id} className={`d2-n5__series is-${sr.id}`}>
            <path className={`d2-n5__line is-${sr.id}${large ? ' is-on' : ''}`} style={{ d: `path("M ${XS} ${ys} L ${XL} ${yl}")` }} />
            <g className={`d2-n5__p${small ? ' is-on' : ''}`} style={{ transform: `translate(${XS}px, ${ys}px)` }}>
              {sr.id === 'hyb' ? <circle r="13" className={`d2-n5__pt is-${sr.id}`} /> : <rect x="-12" y="-12" width="24" height="24" className={`d2-n5__pt is-${sr.id}`} />}
            </g>
            <g className={`d2-n5__p d2-n5__p--large${large ? ' is-on' : ''}`} style={{ transform: `translate(${XL}px, ${yl}px)` }}>
              {sr.id === 'hyb' ? <circle r="13" className={`d2-n5__pt is-${sr.id}`} /> : <rect x="-12" y="-12" width="24" height="24" className={`d2-n5__pt is-${sr.id}`} />}
            </g>
            <text x={XS - 26} y={ys + (sr.id === 'twin' ? -6 : 30)} textAnchor="end" className={`d2-n5__val${small ? ' is-on' : ''}`} data-role="chart">
              <Num k={sr.s} svg />
            </text>
            <text x={XL + 100} y={yOf(v(sr.l)) + (sr.id === 'twin' ? 32 : 11)} className={`d2-n5__name is-${sr.id}${large ? ' is-on is-late' : ''}`} data-role="chart">{sr.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
