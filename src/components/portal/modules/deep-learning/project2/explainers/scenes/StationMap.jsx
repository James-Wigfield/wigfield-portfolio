import { useMemo } from 'react';
import Scene from '../../scene/Scene';
import { pathOf } from '../../scene/geom';

/* ============================================================================
   SCENE — the five weather stations (schematic map)
   Station positions are approximate (equal-scale projection around Perth);
   the coast, river and scarp are hand-drawn context, not survey data. Which
   station feeds which split comes from the brief; sequence counts come from
   the notebook's printed shapes (Out [2]) and the per-split mean ± std from
   its statistics cell (Out [3]), both passed in by the plate.
   ========================================================================== */

const W = 800;
const H = 420;
const PX_KM = 11.5;
const LON0 = 115.95;
const LAT0 = -31.985;
const KM_LON = 111.32 * Math.cos((32 * Math.PI) / 180);
const px = (lon) => W / 2 + (lon - LON0) * KM_LON * PX_KM;
const py = (lat) => H / 2 - (lat - LAT0) * 110.6 * PX_KM;
const P = (lon, lat) => [px(lon), py(lat)];

const STATIONS = [
  { id: 'airport', name: 'Perth Airport', no: '009021', lon: 115.976, lat: -31.928, split: 'train', dx: 19, dy: -8 },
  { id: 'metro', name: 'Perth Metro', no: '009225', lon: 115.873, lat: -31.919, split: 'train', dx: -19, dy: -14, anchor: 'end' },
  { id: 'jandakot', name: 'Jandakot Aero', no: '009172', lon: 115.879, lat: -32.101, split: 'train', dx: 19, dy: 3 },
  { id: 'swan', name: 'Swanbourne', no: '009215', lon: 115.762, lat: -31.956, split: 'val', dx: -19, dy: -3, anchor: 'end' },
  { id: 'bickley', name: 'Bickley', no: '009240', lon: 116.137, lat: -32.007, split: 'test', dx: -17, dy: 24, anchor: 'end' },
];
const ROW_GAP = 58;
const SPLIT = {
  train: { cls: 'sv-ftrain', line: 'sv-train', label: 'train' },
  val: { cls: 'sv-fval', line: 'sv-val', label: 'validation' },
  test: { cls: 'sv-ftest', line: 'sv-test', label: 'test' },
};

// hand-drawn context (approximate)
const COAST = pathOf([P(115.735, -31.80), P(115.745, -31.88), P(115.752, -31.94), P(115.756, -31.99), P(115.748, -32.04), P(115.742, -32.07), P(115.755, -32.13), P(115.762, -32.18)]);
const RIVER = pathOf([P(115.745, -32.055), P(115.775, -32.035), P(115.805, -32.02), P(115.835, -32.01), P(115.85, -31.985), P(115.86, -31.965), P(115.885, -31.955), P(115.905, -31.935), P(115.93, -31.92), P(115.955, -31.905), P(115.975, -31.893)]);
const SCARP = pathOf([P(116.035, -31.80), P(116.04, -31.88), P(116.045, -31.96), P(116.035, -32.04), P(116.02, -32.12), P(116.01, -32.18)]);

// Labels on land sit on a surface-coloured plate, so the river and the scarp
// line stop short of them. A plate rather than a stroked-text halo: stroked
// text is written into the PDF twice (stroke pass + fill pass), which doubled
// every label in the printed page's extracted text.
const CH_STRONG = 6.7; // 11px IBM Plex Mono advance, rounded up
const CH_LAB = 7.0; // the same with sv-lab's 0.03em letter-spacing
// the plate under a station's two label lines (Swanbourne's sit on the ocean and need none)
function LabelPlate({ s, x, y }) {
  const w = Math.max(s.name.length * CH_STRONG, `${s.no} · ${SPLIT[s.split].label}`.length * CH_LAB) + 6;
  const lx = s.anchor === 'end' ? x + s.dx - w + 3 : x + s.dx - 3;
  return <rect x={lx} y={y + s.dy - 11} width={w} height={29} style={{ fill: 'var(--surface)' }} />;
}

// Swanbourne's labels and the ocean's name sit on the ocean band
const ON_BAND = { fill: 'var(--ink-2)' };

const pm = (ms) => `${ms[0].toFixed(1)} ± ${ms[1].toFixed(1)}`;

function makeArt(counts, stats) {
  return function art(step) {
    const lit = (split) => (split === 'train' ? step >= 1 : split === 'val' ? step >= 2 : step >= 3);
    return (
      <>
        {/* ocean side of the coast */}
        <path d={`${COAST} L 0 ${H} L 0 0 Z`} className="sv-fill-ground2" opacity="0.7" />
        <text className="sv-cap" x={24} y={24}>Perth · 5 stations</text>
        <path d={COAST} className="sv-faint" strokeWidth="1.2" fill="none" />
        <path d={RIVER} className="sv-faint" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
        <path d={SCARP} className="sv-faint" strokeWidth="1" strokeDasharray="2 4" fill="none" />
        {/* text on the ocean band is ink-2 (ink-3 measured 4.5:1 there) */}
        <text className="sv-lab" x={px(115.70)} y={py(-32.12)} textAnchor="middle" style={ON_BAND}>Indian</text>
        <text className="sv-lab" x={px(115.70)} y={py(-32.12) + 13} textAnchor="middle" style={ON_BAND}>Ocean</text>
        <text className="sv-lab" x={px(115.82)} y={py(-32.04) + 2}>Swan River</text>
        <text className="sv-lab" x={px(116.02) + 8} y={py(-32.13)}>Darling Scarp</text>
        {/* scale bar */}
        <line className="sv-ink2" x1={W - 160} x2={W - 160 + 10 * PX_KM} y1={H - 26} y2={H - 26} strokeWidth="1.5" />
        <text className="sv-lab" x={W - 160} y={H - 12}>10 km (approx.)</text>

        {STATIONS.map((s) => {
          const [x, y] = P(s.lon, s.lat);
          const on = lit(s.split);
          return (
            <g key={s.id} className={`sm-st sm-${s.split}`}>
              {s.split !== 'val' && <LabelPlate s={s} x={x} y={y} />}
              <circle cx={x} cy={y} r={on ? 13 : 0} className={`${SPLIT[s.split].line} sm-halo`} fill="none" strokeWidth="1.5" opacity={on ? 0.6 : 0} />
              <circle cx={x} cy={y} r={6} className={`${SPLIT[s.split].cls} sm-dot`} opacity={on ? 1 : 0.3} />
              <text className="sv-lab-strong" x={x + s.dx} y={y + s.dy} textAnchor={s.anchor || 'start'}>{s.name}</text>
              <text className="sv-lab" x={x + s.dx} y={y + s.dy + 13} textAnchor={s.anchor || 'start'} style={s.split === 'val' ? ON_BAND : undefined}>
                {s.no}
                <tspan className="sm-lbl" opacity={on ? 1 : 0}>{` · ${SPLIT[s.split].label}`}</tspan>
              </text>
            </g>
          );
        })}

        {/* the split ledger */}
        <g transform={`translate(${W - 252} 62)`}>
          {['train', 'val', 'test'].map((k, j) => (
            <g key={k} className={`sm-row sm-row-${k}`} opacity={lit(k) ? 1 : 0}>
              <circle cx={6} cy={j * ROW_GAP} r={5} className={SPLIT[k].cls} />
              <text className="sv-lab-strong" x={18} y={j * ROW_GAP + 4}>{SPLIT[k].label}</text>
              <text className="sv-lab" x={18} y={j * ROW_GAP + 18}>
                {k === 'train' ? `${counts.train} sequences · 84 months` : k === 'val' ? `${counts.val} sequences · 84 months` : `${counts.test} sequences · 96 months`}
              </text>
              {stats && stats[k] && (
                <text className="sv-num" x={18} y={j * ROW_GAP + 33} style={{ fontSize: 11 }}>
                  min {pm(stats[k].min)} · max {pm(stats[k].max)} °C
                </text>
              )}
            </g>
          ))}
        </g>
      </>
    );
  };
}

function build(tl, { q, beat }) {
  const halo = (k) => q(`.sm-${k} .sm-halo`);
  const dot = (k) => q(`.sm-${k} .sm-dot`);
  const lbl = (k) => q(`.sm-${k} .sm-lbl`);
  tl.set(q('.sm-row'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.sm-halo'), { opacity: 0, attr: { r: 0 }, immediateRender: true }, 0);
  tl.set(q('.sm-st'), { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.sm-st'), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 }, 'b0');
  tl.set(q('.sm-dot'), { opacity: 0.3, immediateRender: true }, 0);
  tl.set(q('.sm-lbl'), { opacity: 0, immediateRender: true }, 0);
  ['train', 'val', 'test'].forEach((k, j) => {
    beat(j + 1, '+=0.6');
    tl.fromTo(dot(k), { opacity: 0.3 }, { opacity: 1, duration: 0.3 }, `b${j + 1}`);
    tl.fromTo(lbl(k), { opacity: 0 }, { opacity: 1, duration: 0.3 }, `b${j + 1}`);
    tl.fromTo(halo(k), { opacity: 0, attr: { r: 4 } }, { opacity: 0.6, attr: { r: 13 }, duration: 0.6, ease: 'back.out(1.3)' }, `b${j + 1}`);
    tl.fromTo(q(`.sm-row-${k}`), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.45 }, `b${j + 1}+=0.2`);
  });
  tl.to({}, { duration: 1 });
}

const BEATS = [
  { t: 'Five stations', fx: 0.2, c: 'Monthly mean minimum and maximum temperatures from five Bureau of Meteorology stations around Perth.' },
  { t: 'Training stations', fx: 0.35, c: 'Perth Airport, Jandakot Aero and Perth Metro supply every training sequence.' },
  { t: 'Validation station', fx: 0.1, c: 'Swanbourne, on the coast, is held out for early stopping and model choices.' },
  { t: 'Test station', fx: 1, c: 'Bickley, in the hills east of Perth, is never used for training or model choices; it is the final test. Its sequences are 96 months long.' },
];

export default function StationMapScene({ id = 'stations', counts, stats }) {
  const art = useMemo(() => makeArt(counts, stats), [counts, stats]);
  return (
    <Scene
      id={id}
      label="Schematic map of Perth showing the five weather stations: Perth Airport, Jandakot Aero and Perth Metro for training, Swanbourne for validation and Bickley for testing"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[3]}
      schematic="positions approximate"
    />
  );
}
