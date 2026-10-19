import Scene from '../../scene/Scene';
import { lin, fmt } from '../../scene/geom';

/* ============================================================================
   SCENE 13·1 — Swanbourne to Bickley: a slope chart of the summary table
   12-month MAE on validation (Swanbourne) and test (Bickley) from Out [19],
   then the 24-month test MAE from Out [18] (model 1 has none: it can only
   output 12 months). Labels are dodged apart where values sit within a few
   hundredths of each other, with a short leader back to the dot. Model 2's
   markers are squares, as in 9·2 and 9·3, so shape backs up the aqua/violet
   pair; at 24 months models 2 and 3 (1.470, 1.457) sit 7 px apart, so their
   markers are drawn 1.5 px further apart (`nudge`; lines keep the values).
   ========================================================================== */

const W = 800;
const H = 530;
const C1 = 246;
const C2 = 446;
const C3 = 626;
const Y0 = 84;
const Y1 = 392;
const y = lin(0.9, 1.5, Y1, Y0);
const CONN = 54; // connectors to the 24-month column start after the value labels

const SERIES = [
  { k: 'm1', label: 'model 1', cls: 'sv-m1', fill: 'sv-fm1', v: [0.988, 1.25, null] },
  { k: 'm2', label: 'model 2', cls: 'sv-m2', fill: 'sv-fm2', v: [0.982, 1.407, 1.47], shape: 'square', nudge: [0, 0, -1.5] },
  { k: 'm3', label: 'model 3', cls: 'sv-m3', fill: 'sv-fm3', v: [1.178, 1.321, 1.457], nudge: [0, 0, 1.5] },
  { k: 'sn', label: 'seasonal naive', base: 'sn', v: [1.226, 1.235, 1.234] },
  { k: 'cl', label: 'climatology', base: 'cl', v: [0.967, 0.958, 0.957] },
];

// spread label baselines at least `gap` apart, keeping their order and centre
function dodge(items, gap = 15) {
  const s = [...items].sort((a, b) => a.y - b.y);
  const out = [];
  let i = 0;
  while (i < s.length) {
    let group = [s[i]];
    let j = i + 1;
    while (j < s.length && s[j].y - group[group.length - 1].y < gap) group.push(s[j++]);
    const mean = group.reduce((a, g) => a + g.y, 0) / group.length;
    const start = mean - ((group.length - 1) * gap) / 2;
    group.forEach((g, k) => out.push({ ...g, ly: group.length > 1 ? start + k * gap : g.y }));
    i = j;
  }
  return Object.fromEntries(out.map((o) => [o.k, o.ly]));
}
// best to worst (Out [19]), under columns 1 and 2
const RANKS = [
  { k: 'val', head: 'Swanbourne · best to worst', x: C1 - 30, order: ['climatology', 'model 2', 'model 1', 'model 3', 'seasonal naive'] },
  { k: 'test', head: 'Bickley · best to worst', x: C2 - 30, strong: true, order: ['climatology', 'seasonal naive', 'model 1', 'model 3', 'model 2'] },
];
const LY = [0, 1, 2].map((c) => dodge(SERIES.filter((s) => s.v[c] != null).map((s) => ({ k: s.k, y: y(s.v[c]) }))));

const lineStyle = (s) =>
  s.base === 'sn'
    ? { stroke: 'var(--dlp2-base)', strokeDasharray: '6 4' }
    : s.base === 'cl'
      ? { stroke: 'var(--ink-2)', strokeDasharray: '1.5 4' }
      : undefined;

function Dot({ s, cx, cy: cy0, col }) {
  const cy = cy0 + ((s.nudge && s.nudge[col]) || 0);
  if (s.shape === 'square') return <rect className={s.fill} x={cx - 4.5} y={cy - 4.5} width={9} height={9} style={{ stroke: 'var(--surface)' }} strokeWidth="2" />;
  if (s.base === 'sn') return <circle cx={cx} cy={cy} r="4.8" style={{ fill: 'var(--dlp2-base)', stroke: 'var(--surface)' }} strokeWidth="2" />;
  if (s.base === 'cl') return <circle cx={cx} cy={cy} r="4.2" style={{ fill: 'var(--surface)', stroke: 'var(--ink-2)' }} strokeWidth="1.8" />;
  return <circle className={s.fill} cx={cx} cy={cy} r="5" style={{ stroke: 'var(--surface)' }} strokeWidth="2" />;
}

function Leader({ x1, y1, x2, y2 }) {
  if (Math.abs(y1 - y2) < 1.5) return null;
  return <path className="sv-faint" d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth="0.8" fill="none" />;
}

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const clipA = `${uid}tra`;
  const clipB = `${uid}trb`;
  return (
    <>
      <defs>
        <clipPath id={clipA}>
          <rect className="tr-clipa" x={C1} y={Y0 - 40} width={C2 - C1} height={Y1 - Y0 + 80} />
        </clipPath>
        <clipPath id={clipB}>
          <rect className="tr-clipb" x={C2 + CONN} y={Y0 - 40} width={C3 - C2 - CONN} height={Y1 - Y0 + 80} />
        </clipPath>
      </defs>

      {/* grid */}
      {[0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={64} x2={W - 24} y1={y(t)} y2={y(t)} />
          <text className="sv-lab" x={58} y={y(t) + 4} textAnchor="end">{fmt(t, 1)}</text>
        </g>
      ))}
      {/* the stage title, kept short: the column heads to its right carry the stations and horizons */}
      <text className="sv-cap" x={24} y={24}>MAE, °C</text>
      <text className="sv-lab" x={24} y={40}>axis from 0.9, not zero</text>

      {/* column heads */}
      <g>
        <line className="sv-axis" x1={C1} x2={C1} y1={Y0 - 8} y2={Y1} />
        <text className="sv-cap" x={C1} y={24} textAnchor="middle">Validation</text>
        <text className="sv-lab-strong" x={C1} y={40} textAnchor="middle">Swanbourne</text>
        <text className="sv-lab" x={C1} y={54} textAnchor="middle">12 months · Out [19]</text>
      </g>
      <g className="tr-b1" opacity={on(1)}>
        <line className="sv-axis" x1={C2} x2={C2} y1={Y0 - 8} y2={Y1} />
        <text className="sv-cap" x={C2} y={24} textAnchor="middle">Test</text>
        <text className="sv-lab-strong" x={C2} y={40} textAnchor="middle">Bickley</text>
        <text className="sv-lab" x={C2} y={54} textAnchor="middle">12 months · Out [19]</text>
      </g>
      <g className="tr-b3" opacity={on(3)}>
        <line className="sv-axis" x1={C3} x2={C3} y1={Y0 - 8} y2={Y1} />
        <text className="sv-cap" x={C3} y={24} textAnchor="middle">Test</text>
        <text className="sv-lab-strong" x={C3} y={40} textAnchor="middle">Bickley</text>
        <text className="sv-lab" x={C3} y={54} textAnchor="middle">24 months · Out [18]</text>
        <text className="sv-lab" x={C3} y={68} textAnchor="middle">no model 1: 12 months only</text>
      </g>

      {/* column 1: Swanbourne */}
      <g className="tr-b0">
        {SERIES.map((s) => {
          const ly = LY[0][s.k];
          return (
            <g key={s.k}>
              <Leader x1={C1 - 13} y1={ly} x2={C1 - 6} y2={y(s.v[0])} />
              <text x={C1 - 15} y={ly + 4} textAnchor="end">
                <tspan className="sv-lab-strong">{s.label}</tspan>
                <tspan className="sv-num" style={{ fontSize: 11 }} dx="8">{fmt(s.v[0], 3)}</tspan>
              </text>
              <Dot s={s} cx={C1} cy={y(s.v[0])} col={0} />
            </g>
          );
        })}
      </g>

      {/* slopes to Bickley */}
      <g className="tr-b1" opacity={on(1)}>
        <g clipPath={`url(#${clipA})`}>
          {SERIES.map((s) => (
            <path key={s.k} className={s.base ? 'sv-line' : `sv-line ${s.cls}`} d={`M${C1} ${y(s.v[0])}L${C2} ${y(s.v[1])}`} strokeWidth={s.base ? 1.6 : 2} style={lineStyle(s)} />
          ))}
        </g>
      </g>
      {SERIES.map((s) => (
        <g key={s.k} className="tr-c2" opacity={on(1)}>
          <Dot s={s} cx={C2} cy={y(s.v[1])} col={1} />
          <Leader x1={C2 + 7} y1={y(s.v[1])} x2={C2 + 12} y2={LY[1][s.k]} />
          <text className="sv-num" x={C2 + 14} y={LY[1][s.k] + 4} style={{ fontSize: 11 }}>{fmt(s.v[1], 3)}</text>
        </g>
      ))}

      {/* beat 2: the order flips — each ranking under its own column, so a narrow
          stage can frame both, and the Bickley one sits in the right half */}
      <g className="tr-b2" opacity={on(2)}>
        <line className="sv-axis" x1={24} x2={W - 24} y1={Y1 + 34} y2={Y1 + 34} />
        {RANKS.map((r) => (
          <g key={r.k}>
            <text className="sv-cap" x={r.x} y={Y1 + 52}>{r.head}</text>
            {r.order.map((name, k) => (
              <text key={name} className={r.strong ? 'sv-lab-strong' : 'sv-lab'} x={r.x} y={Y1 + 70 + k * 14}>{`${k + 1} ${name}`}</text>
            ))}
          </g>
        ))}
      </g>

      {/* beat 3: 24 months */}
      <g className="tr-b3" opacity={on(3)}>
        <g clipPath={`url(#${clipB})`}>
          {SERIES.filter((s) => s.v[2] != null).map((s) => (
            <path key={s.k} className={s.base ? 'sv-line' : `sv-line ${s.cls}`} d={`M${C2 + CONN} ${y(s.v[1])}L${C3} ${y(s.v[2])}`} strokeWidth={s.base ? 1.6 : 2} style={lineStyle(s)} />
          ))}
        </g>
      </g>
      {SERIES.filter((s) => s.v[2] != null).map((s) => (
        <g key={s.k} className="tr-c3" opacity={on(3)}>
          <Dot s={s} cx={C3} cy={y(s.v[2])} col={2} />
          <Leader x1={C3 + 7} y1={y(s.v[2])} x2={C3 + 12} y2={LY[2][s.k]} />
          <text x={C3 + 14} y={LY[2][s.k] + 4}>
            <tspan className="sv-num" style={{ fontSize: 11 }}>{fmt(s.v[2], 3)}</tspan>
            <tspan className="sv-lab-strong" dx="8">{s.label}</tspan>
          </text>
        </g>
      ))}
    </>
  );
}

function build(tl, { q, beat }) {
  tl.set(q('.tr-b1, .tr-b2, .tr-b3, .tr-c2, .tr-c3'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.tr-clipa, .tr-clipb'), { attr: { width: 0 }, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.tr-b0 > g'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.12 }, 'b0');

  beat(1, '+=1.4');
  tl.fromTo(q('.tr-b1'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b1');
  tl.fromTo(q('.tr-clipa'), { attr: { width: 0 } }, { attr: { width: C2 - C1 }, duration: 1.4, ease: 'power1.inOut' }, 'b1');
  tl.fromTo(q('.tr-c2'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.08 }, 'b1+=1.25');

  beat(2, '+=1.2');
  tl.fromTo(q('.tr-b2'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b2');

  beat(3, '+=1.6');
  tl.fromTo(q('.tr-b3'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3');
  tl.fromTo(q('.tr-clipb'), { attr: { width: 0 } }, { attr: { width: C3 - C2 - CONN }, duration: 1.0, ease: 'power1.inOut' }, 'b3');
  tl.fromTo(q('.tr-c3'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.08 }, 'b3+=0.9');
  tl.to({}, { duration: 1.6 });
}

const BEATS = [
  {
    t: 'Swanbourne, the validation station',
    c: 'Swanbourne’s maximums sit near the learned maximum level, 0.6 °C below training, and its minimums 1.8 °C warmer; models 1 and 2 still match climatology (0.988 and 0.982 against 0.967).',
    fx: 0,
  },
  {
    t: 'Bickley, the test station',
    c: 'Every model gets worse. The two baselines, which only copy or average the station’s own past, stay where they were.',
    fx: 0.24,
  },
  {
    t: 'The order flips',
    c: 'On Bickley all three models sit behind both baselines. Model 3 passes model 2, and seasonal naive goes from last to second.',
    fx: 0.47,
  },
  {
    t: 'Twenty-four months',
    c: 'Pushed to 24 months, models 2 and 3 end almost level, 1.470 and 1.457; the baselines do not move. Model 1 can only forecast 12 months.',
    fx: 1,
  },
];

export default function TransferScene() {
  return (
    <Scene
      id="transfer"
      label="Slope chart of 12-month MAE on Swanbourne (validation) and Bickley (test) for models 1 to 3 and the two baselines, then the 24-month test MAE"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[3]}
    />
  );
}
