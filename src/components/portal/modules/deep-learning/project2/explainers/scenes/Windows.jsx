import Scene from '../../scene/Scene';
import { lin, seriesPath, range } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — the test set is 297 overlapping windows over one Bickley record
   Real data: SERIES.bickley is the 392-month record, and test_seq[k] is
   months k+1 … k+96 of it (checked against the exported rows). The overlap
   check and its True are Out [3]; the record lengths and 904 + 309 + 309 =
   1522 are cell 6.
   ========================================================================== */

const W = 800;
const H = 580;
const REC = SERIES.bickley;
const N = REC.length; // 392
const L = 96;
const NW = N - L + 1; // 297
const RX0 = 56;
const RX1 = 760;
const MR = (RX1 - RX0) / N;
const edge = (m) => RX0 + (m - 1) * MR; // left edge of record month m
const xr = (m) => edge(m) + MR / 2;
const yr = lin(4, 35, 118, 40);
const BOX = { y: 36, h: 86 };

// the stack of all windows
const ST = { y0: 142, y1: 196 };
const STACK = `M${edge(1)} ${ST.y0}H${edge(L + 1)}L${edge(N + 1)} ${ST.y1}H${edge(NW)}Z`;
const rowY = (i) => ST.y0 + ((i - 1) / (NW - 1)) * (ST.y1 - ST.y0); // window i, 1-based
// the month whose 96 appearances are marked: left of the stack's label ends
// (x 343) and of the 390 px stage's first view
const M200 = 170;

// zoom on the first months of rows 0–2
const CX0 = 150;
const CW = 43;
const NC = 12;
const rowTop = (r) => 264 + r * 34;
const CELL_H = 24;
const maxOf = (m) => REC[m - 1][1]; // record month m (1-based), max channel

const STEPS = [
  { k: '1', s: 1, t: 'window 1 · months 1–96' },
  { k: '2', s: 2, t: 'window 2 · months 2–97' },
  { k: '3', s: 3, t: 'window 3 · months 3–98' },
  { k: 'mid', s: null, t: 'one month at a time …' },
  { k: 'last', s: NW, t: `window ${NW} · months ${NW}–${N}` },
];

const EQ = [
  { k: 'test', fill: 'sv-ftest', who: 'test · Bickley', eq: '392 − 96 + 1 = 297 rows', sub: null },
  { k: 'val', fill: 'sv-fval', who: 'validation · Swanbourne', eq: '396 − 84 + 1 = 313 rows', sub: null },
  { k: 'train', fill: 'sv-ftrain', who: 'train · 3 stations', eq: '904 + 309 + 309 = 1522 rows, then shuffled', sub: 'Airport 987 months · Jandakot 392 · Metro 392 (inferred)' },
];

function Row({ r, shifted }) {
  const dx = shifted ? r * CW : 0;
  return (
    <g>
      <text className="sv-lab-strong" x={RX0} y={rowTop(r) + 16}>test_seq[{r}]</text>
      <g className={`wn-cells wn-cells-${r}`} transform={dx ? `translate(${dx} 0)` : undefined}>
        {range(NC).map((c) => (
          <g key={c}>
            <rect x={CX0 + c * CW + 1} y={rowTop(r)} width={CW - 2} height={CELL_H} style={{ fill: 'var(--surface)', stroke: 'var(--line)', strokeWidth: 1 }} />
            <text className="sv-num" x={CX0 + c * CW + CW / 2} y={rowTop(r) + 16} textAnchor="middle" style={{ fontSize: 11 }}>
              {maxOf(r + c + 1).toFixed(1)}
            </text>
          </g>
        ))}
        <text className="sv-lab" x={CX0 + NC * CW + 8} y={rowTop(r) + 16}>…</text>
      </g>
    </g>
  );
}

function makeArt() {
  const mins = REC.map((v) => v[0]);
  const maxs = REC.map((v) => v[1]);
  return function art(step, uid) {
    const on = (b) => (step >= b ? 1 : 0);
    const clip = `${uid}stack`;
    const s = step >= 1 ? NW : 1;
    const shownStep = step >= 1 ? 'last' : null;
    return (
      <>
        <defs>
          <clipPath id={clip}>
            <rect className="wn-cliprect" x={RX0 - 2} y={ST.y0 - 2} width={RX1 - RX0 + 6} height={step >= 1 ? ST.y1 - ST.y0 + 4 : 0} />
          </clipPath>
        </defs>
        <text className="sv-cap" x={24} y={24}>Bickley · the test station’s 392-month record</text>

        {/* the record */}
        {[10, 20, 30].map((t) => (
          <g key={t}>
            <line className="sv-grid" x1={RX0} x2={RX1} y1={yr(t)} y2={yr(t)} />
            <text className="sv-lab" x={RX0 - 6} y={yr(t) + 4} textAnchor="end">{t}°</text>
          </g>
        ))}
        <rect className="wn-boxfill" x={edge(s)} y={BOX.y} width={L * MR} height={BOX.h} style={{ fill: 'var(--ground-2)' }} opacity={on(1)} />
        <path className="sv-line sv-max wn-rec" d={seriesPath(maxs, xr, yr)} strokeWidth="1.1" />
        <path className="sv-line sv-min wn-rec" d={seriesPath(mins, xr, yr)} strokeWidth="1.1" />
        <text className="sv-lab-strong wn-recl" x={RX1 + 6} y={yr(maxs[N - 1]) + 4}>max</text>
        <text className="sv-lab-strong wn-recl" x={RX1 + 6} y={yr(mins[N - 1]) + 4}>min</text>
        <rect className="wn-box" x={edge(s)} y={BOX.y} width={L * MR} height={BOX.h} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.6 }} opacity={on(1)} />
        {[1, 100, 200, 300, N].map((m) => (
          <text key={m} className="sv-lab" x={xr(m)} y={BOX.y + BOX.h + 13} textAnchor="middle">{m}</text>
        ))}
        <g>
          {STEPS.map((st) => (
            <text key={st.k} className={`sv-lab-strong wn-ct wn-ct-${st.k}`} x={RX1} y={24} textAnchor="end" opacity={st.k === shownStep ? 1 : 0}>
              {st.t}
            </text>
          ))}
        </g>

        {/* all 297 windows, stacked one month apart */}
        <g className="wn-stack" opacity={on(1)}>
          <path d={STACK} clipPath={`url(#${clip})`} className="sv-test" style={{ fill: 'var(--dlp2-test)', fillOpacity: 0.2, strokeWidth: 1 }} />
          <text className="sv-lab-strong" x={RX0} y={ST.y0 + 30}>test_seq · {NW} rows</text>
          <text className="sv-lab" x={RX0} y={ST.y0 + 44}>each starts one month after the one above</text>
        </g>
        <g className="wn-m200" opacity={on(5)}>
          <line className="sv-faint" x1={xr(M200)} x2={xr(M200)} y1={ST.y0 - 4} y2={ST.y1 + 10} strokeWidth="1" strokeDasharray="2 3" />
          <line className="sv-ink" x1={xr(M200)} x2={xr(M200)} y1={rowY(M200 - L + 1)} y2={rowY(M200)} strokeWidth="2" />
          {/* under the stack's empty lower-left, ending at the guide's foot */}
          <text className="sv-lab-strong" x={xr(M200) - 8} y={ST.y1 + 12} textAnchor="end">month {M200} appears in {L} rows,</text>
          <text className="sv-lab" x={xr(M200) - 8} y={ST.y1 + 24} textAnchor="end">at a different position in each</text>
        </g>

        {/* zoom: rows 0–2, first 12 months */}
        <g className="wn-zoom" opacity={on(2)}>
          <text className="sv-cap" x={24} y={238}>Rows 0–2 · first months · maximum °C</text>
          <g className="wn-hd-date" opacity={step === 2 ? 1 : 0}>
            <text className="sv-lab" x={RX0} y={256}>record month</text>
            {range(NC + 2).map((c) => (
              <text key={c} className="sv-lab" x={CX0 + c * CW + CW / 2} y={256} textAnchor="middle">{c + 1}</text>
            ))}
          </g>
          <g className="wn-hd-pos" opacity={on(3)}>
            <text className="sv-lab" x={RX0} y={256}>position in row</text>
            {range(NC).map((c) => (
              <text key={c} className="sv-lab" x={CX0 + c * CW + CW / 2} y={256} textAnchor="middle">{c + 1}</text>
            ))}
          </g>
          {range(3).map((r) => (
            <Row key={r} r={r} shifted={step === 2} />
          ))}
        </g>
        <g className="wn-check" opacity={on(3)}>
          {range(2).map((r) => (
            <g key={r} className="wn-links">
              {range(NC - 1, 1).map((k) => (
                <line
                  key={k}
                  className="sv-accent wn-link"
                  x1={CX0 + k * CW + CW / 2}
                  y1={rowTop(r) + CELL_H}
                  x2={CX0 + (k - 1) * CW + CW / 2}
                  y2={rowTop(r + 1)}
                  strokeWidth="1.4"
                />
              ))}
            </g>
          ))}
          <text className="sv-lab-strong" x={RX0} y={rowTop(2) + CELL_H + 26}>
            tf.reduce_all(test_seq[1:, :-1] == test_seq[:-1, 1:])  →  True
          </text>
          <text className="sv-lab" x={RX0} y={rowTop(2) + CELL_H + 42}>
            drop each row’s first month and the next row’s last month: what is left is identical
          </text>
        </g>

        {/* the counts */}
        <g className="wn-eq" opacity={on(4)}>
          <text className="sv-cap" x={24} y={432}>Rows = months in the record − months per row + 1</text>
          {EQ.map((e, j) => (
            <g key={e.k} className="wn-eqrow">
              <circle className={e.fill} cx={RX0 + 5} cy={452 + j * 22 - 4} r={4.5} />
              <text className="sv-lab-strong" x={RX0 + 16} y={452 + j * 22}>{e.who}</text>
              <text className="sv-num" x={300} y={452 + j * 22}>{e.eq}</text>
            </g>
          ))}
          <text className="sv-lab" x={300} y={452 + 2 * 22 + 15}>{EQ[2].sub}</text>
        </g>
        <g className="wn-lesson" opacity={on(5)}>
          <text className="sv-lab-strong" x={RX0} y={536}>1522 training rows, about 1770 distinct months</text>
          <text className="sv-lab-strong" x={RX0} y={552}>987 + 392 + 392 = 1771: not independent samples.</text>
          <text className="sv-lab" x={RX0} y={568}>Shuffling moves rows, not the months in them.</text>
        </g>
      </>
    );
  };
}
const art = makeArt();

function build(tl, { q, beat }) {
  const box = q('.wn-box, .wn-boxfill');
  const at = (s) => ({ attr: { x: edge(s) } });
  const draw = (els, pos, dur) =>
    els.forEach((p) => {
      const len = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, pos);
    });
  const swap = (from, to, pos) => {
    tl.fromTo(q(`.wn-ct-${from}`), { opacity: 1 }, { opacity: 0, duration: 0.12, immediateRender: false }, pos);
    tl.fromTo(q(`.wn-ct-${to}`), { opacity: 0 }, { opacity: 1, duration: 0.12 }, pos);
  };

  tl.set(box, { ...at(1), opacity: 0, immediateRender: true }, 0);
  tl.set(q('.wn-ct'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.wn-recl, .wn-stack, .wn-m200, .wn-zoom, .wn-hd-date, .wn-hd-pos, .wn-check, .wn-eq, .wn-lesson'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.wn-cliprect'), { attr: { height: 0 }, immediateRender: true }, 0);
  tl.set(q('.wn-cells-1'), { x: CW, immediateRender: true }, 0);
  tl.set(q('.wn-cells-2'), { x: 2 * CW, immediateRender: true }, 0);

  beat(0, 0);
  draw(q('.wn-rec'), 'b0', 1.8);
  tl.fromTo(q('.wn-recl'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b0+=1.6');

  beat(1, '+=0.5');
  tl.fromTo(box, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b1');
  tl.fromTo(q('.wn-ct-1'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b1');
  tl.fromTo(box, at(1), { ...at(2), duration: 0.25 }, 'b1+=0.7');
  swap('1', '2', 'b1+=0.7');
  tl.fromTo(box, at(2), { ...at(3), duration: 0.25 }, 'b1+=1.3');
  swap('2', '3', 'b1+=1.3');
  tl.fromTo(q('.wn-stack'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b1+=0.7');
  swap('3', 'mid', 'b1+=1.9');
  tl.fromTo(box, at(3), { ...at(NW), duration: 2.2, ease: 'power1.inOut' }, 'b1+=1.9');
  tl.fromTo(q('.wn-cliprect'), { attr: { height: 0 } }, { attr: { height: ST.y1 - ST.y0 + 4 }, duration: 3.4, ease: 'power1.inOut' }, 'b1+=0.7');
  swap('mid', 'last', 'b1+=4.1');

  beat(2, '+=0.8');
  tl.fromTo(q('.wn-zoom'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  tl.fromTo(q('.wn-hd-date'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');

  beat(3, '+=1.6');
  tl.fromTo(q('.wn-hd-date'), { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 'b3');
  tl.fromTo(q('.wn-hd-pos'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3+=0.3');
  tl.fromTo(q('.wn-cells-1'), { x: CW }, { x: 0, duration: 0.8, ease: 'power2.inOut' }, 'b3');
  tl.fromTo(q('.wn-cells-2'), { x: 2 * CW }, { x: 0, duration: 0.8, ease: 'power2.inOut' }, 'b3');
  tl.fromTo(q('.wn-check'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b3+=1.0');
  draw(q('.wn-link'), 'b3+=1.0', 0.5);

  beat(4, '+=1.4');
  tl.fromTo(q('.wn-eq'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b4');
  tl.fromTo(q('.wn-eqrow'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.3 }, 'b4');

  beat(5, '+=1.2');
  tl.fromTo(q('.wn-m200'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b5');
  tl.fromTo(q('.wn-lesson'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b5+=0.4');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  { t: 'One station, 392 months', fx: 0, c: 'Bickley’s whole record from the data file: monthly mean minimum (blue) and maximum (orange).' },
  {
    // fx 1: the counter ("window 297 · months 297–392") ends at x 760, inside the right fade at 0.85
    t: 'Slide a 96-month window', fx: 1,
    c: 'Window 1 covers months 1–96, window 2 months 2–97, and so on until the last ends on month 392: 392 − 96 + 1 = 297 windows, the 297 rows of test_seq.',
  },
  { t: 'Lined up by record month', fx: 0, c: 'The first months of rows 0, 1 and 2, maximums in °C. Placed by month of the record, the same reading sits in the same column.' },
  {
    t: 'Lined up by position', fx: 0,
    c: 'In the tensor every row starts at position 1, so each row is the one above moved left by a month. The notebook checks this for every pair of neighbouring rows and prints True.',
  },
  {
    t: 'Every split is built this way', fx: 0.1,
    c: 'Swanbourne’s 396 months give 396 − 84 + 1 = 313 validation rows. The three training records give 904 + 309 + 309 = 1522 rows, which arrive shuffled.',
  },
  {
    t: 'Not independent samples', fx: 0,
    c: 'A test MAE is the error over one station’s history, not over 297 separate cases. Shuffling moves whole rows; a plot’s month axis is the position in the row, never a date.',
  },
];

export default function WindowsScene({ id = 'windows' }) {
  return (
    <Scene
      id={id}
      label="Bickley's 392-month temperature record with a 96-month window sliding one month at a time to make 297 overlapping test rows, the first months of rows 0 to 2 showing the same values shifted by one, and the window counts for every split"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[2, 5]}
      // print frame 03: the record and the stack are already exactly as in the final
      // frame below it, so the earlier frame is cropped to what is new, the rows 0–2
      // table "lined up by record month" (caption y ≈ 229, last row ends at y 356)
      frameBoxes={{ 2: '16 224 768 142' }}
    />
  );
}
