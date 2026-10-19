import Scene from '../../scene/Scene';
import { lin, fmt } from '../../scene/geom';

/* ============================================================================
   SCENE — three climates: mean ± one standard deviation per split and channel
   Every value is the notebook's printed statistic (Out [3], one decimal):
   tf.reduce_mean / reduce_std over axes (0, 1), i.e. over every sequence and
   every month of a split at once. The "2.1 °C cooler" gap is cell 39's.
   ========================================================================== */

const W = 800;
const H = 336;
const X0 = 196;
const X1 = 760;
const x = lin(4, 32, X0, X1);
const AXIS = 272;
const TOP = 96;

// Out [3]: [mean, std] in °C
const CLIMATES = [
  { k: 'train', label: 'train', sub: '3 stations', fill: 'sv-ftrain', y: 116, min: [12.2, 3.8], max: [24.7, 5.1] },
  { k: 'val', label: 'validation', sub: 'Swanbourne', fill: 'sv-fval', y: 166, min: [14.0, 3.3], max: [24.1, 4.4] },
  { k: 'test', label: 'test', sub: 'Bickley', fill: 'sv-ftest', y: 216, min: [11.3, 3.2], max: [22.6, 5.7] },
];
const CH = [
  { c: 'min', cls: 'sv-min', fcls: 'sv-fmin', head: 'minimum · index 0', at: 12.6 },
  { c: 'max', cls: 'sv-max', fcls: 'sv-fmax', head: 'maximum · index 1', at: 23.8 },
];
const GAP_Y = 236;
// a surface-coloured plate under each number keeps the dotted training guides
// (beat 3) from running through it; a plate, not a text stroke, because
// stroked text is written into the PDF twice (stroke pass + fill pass)
const CH_W = 6.7; // 11px IBM Plex Mono advance, rounded up
const plateW = (t) => t.length * CH_W + 8;

function Stat({ r, ch }) {
  const [m, s] = r[ch.c];
  const lo = x(m - s);
  const hi = x(m + s);
  const label = `${fmt(m)} ± ${fmt(s)}`;
  return (
    <g>
      <line className={`${ch.cls} cl-w cl-w-${r.k}-${ch.c}`} x1={lo} x2={hi} y1={r.y} y2={r.y} strokeWidth="2" strokeLinecap="round" />
      <g className={`cl-cap cl-cap-${r.k}`}>
        <line className={ch.cls} x1={lo} x2={lo} y1={r.y - 6} y2={r.y + 6} strokeWidth="1.6" />
        <line className={ch.cls} x1={hi} x2={hi} y1={r.y - 6} y2={r.y + 6} strokeWidth="1.6" />
      </g>
      <circle className={`${ch.fcls} cl-dot cl-dot-${r.k}`} cx={x(m)} cy={r.y} r={5.5} style={{ stroke: 'var(--surface)', strokeWidth: 1.5 }} />
      <g className={`cl-num cl-num-${r.k}`}>
        <rect x={x(m) - plateW(label) / 2} y={r.y - 24} width={plateW(label)} height={15} style={{ fill: 'var(--surface)' }} />
        <text className="sv-lab-strong" x={x(m)} y={r.y - 12} textAnchor="middle">{label}</text>
      </g>
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  const tr = CLIMATES[0];
  const te = CLIMATES[2];
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Mean ± 1 std per split · every month of every sequence · °C</text>

      {/* channel heads */}
      {CH.map((ch) => (
        <g key={ch.c}>
          <line className={ch.cls} x1={x(ch.at) - 70} x2={x(ch.at) - 56} y1={68} y2={68} strokeWidth="2" strokeLinecap="round" />
          <text className="sv-lab-strong" x={x(ch.at) - 50} y={72}>{ch.head}</text>
        </g>
      ))}

      {/* axis */}
      {[5, 10, 15, 20, 25, 30].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={x(t)} x2={x(t)} y1={TOP - 8} y2={AXIS} />
          <line className="sv-axis" x1={x(t)} x2={x(t)} y1={AXIS} y2={AXIS + 5} />
          <text className="sv-lab" x={x(t)} y={AXIS + 18} textAnchor="middle">{t}°</text>
        </g>
      ))}
      <line className="sv-axis" x1={X0} x2={X1} y1={AXIS} y2={AXIS} />
      <text className="sv-lab" x={X1} y={AXIS + 34} textAnchor="end">temperature °C</text>

      {/* beat 3: training means carried down, Bickley's gap */}
      <g className="cl-guides" opacity={on(3)}>
        {CH.map((ch) => (
          <line key={ch.c} className={`sv-faint cl-guide`} x1={x(tr[ch.c][0])} x2={x(tr[ch.c][0])} y1={tr.y + 8} y2={te.y + 10} strokeWidth="1" strokeDasharray="2 3" />
        ))}
      </g>
      <g className="cl-gap" opacity={on(3)}>
        <path className="sv-ink" d={`M${x(tr.max[0])} ${GAP_Y}H${x(te.max[0]) + 2}`} strokeWidth="1.4" />
        <path className="sv-ink" d={`M${x(te.max[0]) + 7} ${GAP_Y - 4}L${x(te.max[0]) + 1} ${GAP_Y}L${x(te.max[0]) + 7} ${GAP_Y + 4}`} strokeWidth="1.4" fill="none" />
        <text className="sv-lab-strong" x={(x(tr.max[0]) + x(te.max[0])) / 2} y={GAP_Y + 16} textAnchor="middle">2.1 °C cooler than training</text>
      </g>

      {/* rows */}
      {CLIMATES.map((r, j) => (
        <g key={r.k} className={`cl-row cl-row-${r.k}`} opacity={on(j)}>
          <circle className={r.fill} cx={34} cy={r.y - 4} r={5} />
          <text className="sv-lab-strong" x={46} y={r.y}>{r.label}</text>
          <text className="sv-lab" x={46} y={r.y + 14}>{r.sub}</text>
          {CH.map((ch) => <Stat key={ch.c} r={r} ch={ch} />)}
        </g>
      ))}

      {/* key */}
      <g>
        <circle cx={30} cy={AXIS + 30} r={4.5} style={{ fill: 'var(--ink-3)' }} />
        <text className="sv-lab" x={40} y={AXIS + 34}>mean</text>
        <line className="sv-faint" x1={84} x2={112} y1={AXIS + 30} y2={AXIS + 30} strokeWidth="1.6" />
        <line className="sv-faint" x1={84} x2={84} y1={AXIS + 25} y2={AXIS + 35} strokeWidth="1.4" />
        <line className="sv-faint" x1={112} x2={112} y1={AXIS + 25} y2={AXIS + 35} strokeWidth="1.4" />
        <text className="sv-lab" x={120} y={AXIS + 34}>± 1 std</text>
      </g>
    </>
  );
}

// a timeline position: a bare beat label plus ONE summed offset (GSAP keeps only
// the first offset of 'b1+=0.2+=0.5' and silently drops the rest)
const pos = (label, off = 0) => (off ? `${label}+=${off}` : label);

function build(tl, { q, beat }) {
  tl.set(q('.cl-row, .cl-guides, .cl-gap'), { opacity: 0, immediateRender: true }, 0);
  CLIMATES.forEach((r, j) => {
    beat(j, j === 0 ? 0 : '+=0.9');
    const b = `b${j}`; // the bare label, never a position with an offset already in it
    tl.fromTo(q(`.cl-row-${r.k}`), { opacity: 0 }, { opacity: 1, duration: 0.3 }, b);
    CH.forEach((ch) => {
      const [m, s] = r[ch.c];
      tl.fromTo(q(`.cl-w-${r.k}-${ch.c}`), { attr: { x1: x(m), x2: x(m) } }, { attr: { x1: x(m - s), x2: x(m + s) }, duration: 0.8, ease: 'power2.out' }, pos(b, 0.25));
    });
    tl.fromTo(q(`.cl-dot-${r.k}`), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(1.3)', stagger: 0.1 }, pos(b, 0.05));
    tl.fromTo(q(`.cl-cap-${r.k}`), { opacity: 0 }, { opacity: 1, duration: 0.25 }, pos(b, 0.9));
    tl.fromTo(q(`.cl-num-${r.k}`), { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, pos(b, 0.5));
  });

  beat(3, '+=0.9');
  const tr = CLIMATES[0];
  const te = CLIMATES[2];
  tl.fromTo(q('.cl-guides'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b3');
  tl.fromTo(q('.cl-guide'), { attr: { y2: tr.y + 8 } }, { attr: { y2: te.y + 10 }, duration: 0.7, ease: 'power2.inOut' }, 'b3');
  tl.fromTo(q('.cl-gap'), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.5 }, 'b3+=0.6');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  {
    // fx: where a 390 px stage looks (about half the 800 units show): the rows'
    // labels first, then the maximum channel, where all three spreads compare
    // and the gap label (x 503–681) and the axis title sit clear of the edge fade
    t: 'Training stations', fx: 0,
    c: 'Averaged over every month of every training sequence: minimum 12.2 °C, maximum 24.7 °C. Each bar spans one standard deviation either side, and most of that spread is the swing from winter to summer.',
  },
  {
    t: 'Swanbourne, on the coast', fx: 0,
    c: 'Warmer nights (14.0 against 12.2) and less spread on both channels (3.3 and 4.4 against 3.8 and 5.1). The sea evens out its temperatures.',
  },
  {
    t: 'Bickley, in the hills', fx: 1,
    c: 'Cooler on both channels (11.3 and 22.6), and its maximums swing the most of the three, with a standard deviation of 5.7.',
  },
  {
    t: 'Why it matters later', fx: 1,
    c: 'Models trained on the three coastal-plain stations meet maximums 2.1 °C cooler at Bickley. Section 9 finds that every model over-predicts them.',
  },
];

export default function ClimatesScene({ id = 'climates' }) {
  return (
    <Scene
      id={id}
      label="Dot and whisker chart of mean plus or minus one standard deviation of monthly minimum and maximum temperature for the training stations, Swanbourne and Bickley"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[3]}
    />
  );
}
