import { useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { RIDERSHIP } from '../data/ridership';
import { MAE_CODE, TOY_BATCHES, SPLIT_CODE, INSPECT_CODE, SPLITS } from '../slideData';
import { diff, shift, mae, mape, dayIndex, isoAt, monthRange, fmtInt, timeseriesDataset, batchShape } from '../rnn';
import { svgPoint } from '../hooks';
import { useStudy } from '../context';
import './labsSeries.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §6 AND §7  (the real CTA ridership data)
     RidershipLab    slides 15–18: daily bus + rail riders for March–May 2019
                     (Figure 15-6), the copy k days earlier and the
                     difference y(t) − y(t − k) (Figure 15-7), and the naive
                     forecast's MAE / MAPE for any lag k. At k = 7 the live
                     printout is character-for-character slide 18's.
     WindowLab       slide 19's toy timeseries_dataset_from_array call, drawn
                     window by window and batch by batch, then editable
     RailWindowsLab  slides 20–22: rail_train / rail_valid, the 56-day windows
                     and their batches, five windows from a shuffled batch,
                     and a window explorer
   Data: ../data/ridership.js (slide 15's pandas steps on the slides' own
   file). Any count or metric not printed on a slide is labelled as this
   page's own computation.
   ========================================================================== */

const R = RIDERSHIP;
const S0 = R.start;
const COLS = ['bus', 'rail'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayLabel = (row) => `${DOW[weekdayAt(S0, row)]} ${isoAt(S0, row)}`;
const fmtK = (v) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${Math.round(Math.abs(v) / 1000)}k`);
const fmtSignedInt = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${fmtInt(Math.abs(v))}`;
// 43915.608696 → "43,915.608696" (rounded once, by toFixed, like pandas)
function fmtFix6(v) {
  const [a, b] = v.toFixed(6).split('.');
  return `${Number(a).toLocaleString('en-AU')}.${b}`;
}
function linePath(vals, xf, yf) {
  let d = '';
  vals.forEach((v, i) => {
    d += `${i ? 'L' : 'M'}${xf(i).toFixed(1)} ${yf(v).toFixed(1)}`;
  });
  return d;
}
function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/* A line key for legends: solid, dotted, or a shaded band. */
function Key({ kind, tone }) {
  return (
    <svg className="dl4s-ride-key" viewBox="0 0 24 10" aria-hidden="true">
      {kind === 'band' ? (
        <rect x={5} y={0} width={14} height={10} className={`dl4s-ride-band--${tone}`} />
      ) : kind === 'star' ? (
        <path d={starPath(12, 5, 5)} className="dl4s-rail-star" />
      ) : (
        <>
          <line x1={1} y1={5} x2={23} y2={5} className={kind === 'lag' ? `dl4s-ride-lag dl4s-ride-${tone}` : `dl4s-ride-line dl4s-ride-${tone}`} />
          {kind === 'line' && <circle cx={12} cy={5} r={2.2} className={`dl4s-ride-pt--${tone}`} />}
        </>
      )}
    </svg>
  );
}

/* ══ §6 · ridership, seasonality and the naive forecast (slides 15–18) ═════ */

// slides 16–18's window, "2019-03":"2019-05" → rows 1155…1246 (92 days)
const [M_A, M_B] = monthRange(S0, '2019-03', '2019-05');
const M_N = M_B - M_A + 1;
const LAGS = 14;
const WIN = { bus: R.bus.slice(M_A, M_B + 1), rail: R.rail.slice(M_A, M_B + 1), type: R.dayType.slice(M_A, M_B + 1) };

// The naive forecast ŷ(t) = y(t − k) for every k = 1…14, exactly as slide 18
// computes k = 7: diff(k) over the WHOLE series (so 1 March reaches back into
// February), then the March–May slice; MAE = mean |diff|, MAPE = mean |diff / y|.
const SCAN = Array.from({ length: LAGS }, (_, j) => {
  const k = j + 1;
  const row = { k };
  COLS.forEach((c) => {
    const s = R[c];
    const d = diff(s, k).slice(M_A, M_B + 1);
    row[c] = { d, lag: shift(s, k).slice(M_A, M_B + 1), mae: mae(d), mape: mape(d, s.slice(M_A, M_B + 1)) };
  });
  return row;
});
const lowestBy = (col, key) => SCAN.reduce((b, r) => (r[col][key] < b[col][key] ? r : b));
const BEST_RAIL = lowestBy('rail', 'mae');
const BEST_RAIL_MAPE = lowestBy('rail', 'mape');

// plot geometry (two panels sharing x, like Figure 15-7)
const RP = { W: 720, L: 52, R: 40, top: 22, th: 200, gap: 40, bh: 132, foot: 44 };
const RP_PW = RP.W - RP.L - RP.R;
const RP_STEP = RP_PW / M_N;
const RP_BOT = RP.top + RP.th + RP.gap;
const RP_H = RP_BOT + RP.bh + RP.foot;
const rx = (i) => RP.L + (i + 0.5) * RP_STEP;
const TOP_DOM = [170000, 900000]; // slide 17: axs[0].set_ylim([170_000, 900_000])
const ty = (v) => RP.top + RP.th * (1 - (v - TOP_DOM[0]) / (TOP_DOM[1] - TOP_DOM[0]));
const TOP_TICKS = [200000, 300000, 400000, 500000, 600000, 700000, 800000];
const MONTHS = [['2019-03-01', 'Mar'], ['2019-04-01', 'Apr'], ['2019-05-01', 'May']].map(([d, l]) => ({ i: dayIndex(S0, d) - M_A, l }));
const DAYS = Array.from({ length: M_N }, (_, i) => i);
const MONDAYS = DAYS.filter((i) => weekdayAt(S0, M_A + i) === 1);
const BANDS = DAYS.filter((i) => WIN.type[i] !== 'W');
const HOLIDAYS = DAYS.filter((i) => WIN.type[i] === 'U' && weekdayAt(S0, M_A + i) !== 0);
const TOP_PATH = { bus: linePath(WIN.bus, rx, ty), rail: linePath(WIN.rail, rx, ty) };

// the lag-scan bars
const SC = { W: 720, L: 52, R: 40, top: 18, h: 92, foot: 34 };
const SC_GW = (SC.W - SC.L - SC.R) / LAGS;
const SC_MAX = 260000;
const sy = (v) => SC.top + SC.h * (1 - v / SC_MAX);
const SC_H = SC.top + SC.h + SC.foot;

// slide 18's two printouts, with diff_k in place of diff_7 (line for line)
function maeText(k) {
  const sc = SCAN[k - 1];
  return [
    `>>> diff_${k}.abs().mean()`,
    pandasSeriesText(COLS.map((c) => [c, sc[c].mae])),
    '',
    '>>> targets = df[["bus", "rail"]]["2019-03":"2019-05"]',
    `>>> (diff_${k} / targets).abs().mean()`,
    pandasSeriesText(COLS.map((c) => [c, sc[c].mape])),
  ].join('\n');
}
const SLIDE18_OK = maeText(7) === MAE_CODE;

export function RidershipLab() {
  const [k, setK] = useState(7);
  const [lagOn, setLagOn] = useState(true);
  const [cur, setCur] = useState(null); // day 0…91 under the crosshair
  const svgRef = useRef(null);
  const scanRefs = useRef([]);
  const sc = SCAN[k - 1];
  const live = maeText(k);
  const isSlide = k === 7 && SLIDE18_OK;
  const ks = k === 1 ? '1 day' : `${k} days`;

  const bot = useMemo(() => {
    const [lo, hi] = marginDomain([...sc.bus.d, ...sc.rail.d]);
    const by = (v) => RP_BOT + RP.bh * (1 - (v - lo) / (hi - lo));
    const ticks = ticksIn(lo, hi, niceStep(hi - lo, 4));
    // direct labels at the right end, pushed apart if they collide
    let yb = by(sc.bus.d[M_N - 1]);
    let yr = by(sc.rail.d[M_N - 1]);
    if (Math.abs(yb - yr) < 12) {
      const mid = (yb + yr) / 2;
      const up = yb <= yr ? -6 : 6;
      yb = mid + up;
      yr = mid - up;
    }
    return { by, ticks, yb, yr, bus: linePath(sc.bus.d, rx, by), rail: linePath(sc.rail.d, rx, by) };
  }, [sc]);

  // everything that doesn't follow the crosshair
  const layers = useMemo(() => {
    const { by } = bot;
    const lagPath = { bus: linePath(sc.bus.lag, rx, ty), rail: linePath(sc.rail.lag, rx, ty) };
    let ybTop = ty(WIN.bus[M_N - 1]);
    let yrTop = ty(WIN.rail[M_N - 1]);
    if (Math.abs(ybTop - yrTop) < 12) {
      ybTop -= 6;
      yrTop += 6;
    }
    return (
      <>
        <text x={RP.L} y={RP.top - 9} className="dl4s-svg__label dl4s-svg__label--ink">
          riders per day{lagOn ? ` · dotted: the same series ${k === 1 ? '1 day' : `${k} days`} earlier, df.shift(${k})` : ''}
        </text>
        <text x={RP.L} y={RP_BOT - 9} className="dl4s-svg__label dl4s-svg__label--ink">difference y(t) − y(t − {k}) · diff_{k}</text>
        {BANDS.map((i) => (
          <g key={i} className={`dl4s-ride-band--${WIN.type[i]}`}>
            <rect x={rx(i) - RP_STEP / 2} y={RP.top} width={RP_STEP} height={RP.th} />
            <rect x={rx(i) - RP_STEP / 2} y={RP_BOT} width={RP_STEP} height={RP.bh} />
          </g>
        ))}
        {HOLIDAYS.map((i) => (
          <g key={`h${i}`}>
            <line x1={rx(i)} x2={rx(i)} y1={RP_BOT - 6} y2={RP_BOT} className="dl4s-axis" />
            <text x={rx(i) + 3} y={RP_BOT - 9} textAnchor="end" className="dl4s-tick">{isoAt(S0, M_A + i)} · day_type U on a {DOW_FULL[weekdayAt(S0, M_A + i)]} (a holiday)</text>
          </g>
        ))}
        {/* grids + y ticks */}
        {TOP_TICKS.map((v) => (
          <g key={`t${v}`}>
            <line x1={RP.L} x2={RP.W - RP.R} y1={ty(v)} y2={ty(v)} className="dl4s-gridline" />
            <text x={RP.L - 6} y={ty(v) + 3} textAnchor="end" className="dl4s-tick">{fmtK(v)}</text>
          </g>
        ))}
        {bot.ticks.map((v) => (
          <g key={`b${v}`}>
            <line x1={RP.L} x2={RP.W - RP.R} y1={by(v)} y2={by(v)} className={v === 0 ? 'dl4s-ride-zero' : 'dl4s-gridline'} />
            <text x={RP.L - 6} y={by(v) + 3} textAnchor="end" className="dl4s-tick">{fmtK(v)}</text>
          </g>
        ))}
        {MONTHS.map((m) => (
          <g key={m.l}>
            <line x1={rx(m.i)} x2={rx(m.i)} y1={RP.top} y2={RP.top + RP.th} className="dl4s-gridline" />
            <line x1={rx(m.i)} x2={rx(m.i)} y1={RP_BOT} y2={RP_BOT + RP.bh + 6} className="dl4s-gridline" />
            <text x={rx(m.i)} y={RP_BOT + RP.bh + 17} textAnchor="middle" className="dl4s-tick">{m.l}</text>
          </g>
        ))}
        <text x={rx(MONTHS[0].i)} y={RP_BOT + RP.bh + 29} textAnchor="middle" className="dl4s-tick">2019</text>
        <text x={RP.L + RP_PW / 2} y={RP_BOT + RP.bh + 40} textAnchor="middle" className="dl4s-svg__label">date (minor ticks: Mondays)</text>
        {MONDAYS.map((i) => <line key={`m${i}`} x1={rx(i)} x2={rx(i)} y1={RP_BOT + RP.bh} y2={RP_BOT + RP.bh + 3} className="dl4s-axis" />)}
        <rect x={RP.L} y={RP.top} width={RP_PW} height={RP.th} className="dl4s-ride-frame" />
        <rect x={RP.L} y={RP_BOT} width={RP_PW} height={RP.bh} className="dl4s-ride-frame" />
        {/* top panel: the lagged copy (dotted, no markers), then the series */}
        {lagOn && COLS.map((c) => <path key={`lag${c}`} d={lagPath[c]} className={`dl4s-ride-lag dl4s-ride-${c}`} />)}
        {COLS.map((c) => (
          <g key={`s${c}`}>
            <path d={TOP_PATH[c]} className={`dl4s-ride-line dl4s-ride-${c}`} />
            {WIN[c].map((v, i) => <circle key={i} cx={rx(i)} cy={ty(v)} r={1.7} className={`dl4s-ride-pt--${c}`} />)}
          </g>
        ))}
        <text x={RP.W - RP.R + 6} y={ybTop + 3} className="dl4s-svg__label dl4s-ride-lab--bus">bus</text>
        <text x={RP.W - RP.R + 6} y={yrTop + 3} className="dl4s-svg__label dl4s-ride-lab--rail">rail</text>
        {/* bottom panel: diff_k */}
        {COLS.map((c) => (
          <g key={`d${c}`}>
            <path d={bot[c]} className={`dl4s-ride-line dl4s-ride-${c}`} />
            {sc[c].d.map((v, i) => <circle key={i} cx={rx(i)} cy={by(v)} r={1.7} className={`dl4s-ride-pt--${c}`} />)}
          </g>
        ))}
        <text x={RP.W - RP.R + 6} y={bot.yb + 3} className="dl4s-svg__label dl4s-ride-lab--bus">bus</text>
        <text x={RP.W - RP.R + 6} y={bot.yr + 3} className="dl4s-svg__label dl4s-ride-lab--rail">rail</text>
      </>
    );
  }, [bot, sc, k, lagOn]);

  const day = cur == null ? null : { i: cur, row: M_A + cur };
  const dayText = day
    ? `${dayLabel(day.row)}, day_type ${R.dayType[day.row]}: bus ${fmtInt(WIN.bus[cur])}, rail ${fmtInt(WIN.rail[cur])}; ${ks} earlier (${dayLabel(day.row - k)}) bus ${fmtInt(sc.bus.lag[cur])}, rail ${fmtInt(sc.rail.lag[cur])}`
    : 'no day selected';

  const onMove = (e) => {
    const p = svgPoint(e, svgRef.current);
    if (!p) return;
    setCur(clampInt(Math.floor((p.x - RP.L) / RP_STEP), 0, M_N - 1));
  };
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 7, PageDown: -7 }[e.key];
    if (step) {
      e.preventDefault();
      setCur((c) => clampInt((c ?? (step > 0 ? -1 : M_N)) + step, 0, M_N - 1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setCur(e.key === 'Home' ? 0 : M_N - 1);
    } else if (e.key === 'Escape') setCur(null);
  };
  const scanKey = (e, j) => {
    let to = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = Math.min(LAGS - 1, j + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = Math.max(0, j - 1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = LAGS - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setK(j + 1);
      return;
    }
    if (to != null) {
      e.preventDefault();
      setK(to + 1);
      scanRefs.current[to]?.focus();
    }
  };

  const busHigherMae = sc.bus.mae > sc.rail.mae;
  const busLowerMape = sc.bus.mape < sc.rail.mape;

  return (
    <Lab
      title="Figures 15-6 and 15-7 live · the naive forecast on real ridership"
      slides="slides 15–18"
      tryThis="before moving the lag from 7 to 1, predict whether yesterday is a better forecast than last week; notice the MAE jump, then return to 7 and check the printout against slide 18."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="lag k (days) · forecast ŷ(t) = y(t − k)" value={k} min={1} max={LAGS} onChange={setK} fmt={(v) => (v === 7 ? '7 (slide 18)' : String(v))} width={280} />
        </div>
        <Chips
          label="top panel"
          value={lagOn}
          options={[{ v: false, l: 'Figure 15-6 · the series' }, { v: true, l: 'Figure 15-7 · plus the copy k days earlier' }]}
          onChange={setLagOn}
        />
      </div>

      <div className="dl4s-ride-legend" aria-hidden="true">
        <span><Key kind="line" tone="bus" /> bus</span>
        <span><Key kind="line" tone="rail" /> rail</span>
        {lagOn && <span><Key kind="lag" tone="bus" /> bus, {ks} earlier</span>}
        {lagOn && <span><Key kind="lag" tone="rail" /> rail, {ks} earlier</span>}
        <span><Key kind="band" tone="A" /> Saturday (day_type A)</span>
        <span><Key kind="band" tone="U" /> Sunday or holiday (U) — the dataset’s codes, not the slides’</span>
      </div>

      <div className="dl4s-ride-scroll">
        <div
          className="dl4s-ride-plot"
          tabIndex={0}
          role="slider"
          aria-label="Day under the cursor, 1 March to 31 May 2019. Arrow keys move a day, Page Up and Page Down a week."
          aria-valuemin={1}
          aria-valuemax={M_N}
          aria-valuenow={(cur ?? 0) + 1}
          aria-valuetext={dayText}
          onKeyDown={onKey}
          onPointerMove={onMove}
          onPointerLeave={() => setCur(null)}
          onBlur={() => setCur(null)}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${RP.W} ${RP_H}`}
            className="dl4s-svg"
            role="img"
            aria-label={`Daily bus and rail riders in Chicago, 1 March to 31 May 2019, dipping every weekend${lagOn ? `, with each series copied ${ks} later as a dotted line` : ''}; below, the difference between each day and ${ks} earlier.`}
          >
            {layers}
            {day && (
              <g className="dl4s-ride-cursor">
                <line x1={rx(cur)} x2={rx(cur)} y1={RP.top} y2={RP_BOT + RP.bh} className="dl4s-ride-cross" />
                {COLS.map((c) => (
                  <g key={c}>
                    {lagOn && <circle cx={rx(cur)} cy={ty(sc[c].lag[cur])} r={3.4} className={`dl4s-ride-ring dl4s-ride-${c}`} />}
                    <circle cx={rx(cur)} cy={ty(WIN[c][cur])} r={4} className={`dl4s-ride-hl dl4s-ride-pt--${c}`} />
                    <circle cx={rx(cur)} cy={bot.by(sc[c].d[cur])} r={4} className={`dl4s-ride-hl dl4s-ride-pt--${c}`} />
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="dl4s-ride-daybox">
        <p className="dl4s-ride-dayhead">
          {day ? (
            <>
              <b>{dayLabel(day.row)}</b> · day_type {R.dayType[day.row]} · the forecast copies <b>{dayLabel(day.row - k)}</b>
              {day.row - k < M_A && <span className="dl4s-ride-feb"> (before 1 March: diff({k}) reaches back into the full series)</span>}
            </>
          ) : (
            <>Hover the plot, or focus it and use ← → (Page Up / Down = a week) to read one day.</>
          )}
        </p>
        <div className="dl-tablewrap">
          <table className="dl-table dl4s-ride-day">
            <thead>
              <tr><th>series</th><th>y(t), the target</th><th>ŷ(t) = y(t − {k})</th><th>error y(t) − y(t − {k})</th><th>|error| / y(t)</th></tr>
            </thead>
            <tbody>
              {COLS.map((c) => (
                <tr key={c}>
                  <td><span className={`dl4s-dot dl4s-ride-dot--${c}`} />{c}</td>
                  <td>{day ? fmtInt(WIN[c][cur]) : '—'}</td>
                  <td>{day ? fmtInt(sc[c].lag[cur]) : '—'}</td>
                  <td>{day ? fmtSignedInt(sc[c].d[cur]) : '—'}</td>
                  <td>{day ? Math.abs(sc[c].d[cur] / WIN[c][cur]).toFixed(4) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dl4s-ride-scanbox">
        <p className="dl4s-stagehead">MAE of the naive forecast for every lag k = 1…14 · 1 March – 31 May 2019 · pick a bar</p>
        <div className="dl4s-ride-scroll">
          <svg viewBox={`0 0 ${SC.W} ${SC_H}`} className="dl4s-svg dl4s-ride-scan" role="img" aria-label={`MAE for each lag k from 1 to 14. Lowest at whole weeks: k = 7 and k = 14. Selected k = ${k}.`}>
            {[0, 100000, 200000].map((v) => (
              <g key={v}>
                <line x1={SC.L} x2={SC.W - SC.R} y1={sy(v)} y2={sy(v)} className={v ? 'dl4s-gridline' : 'dl4s-axis'} />
                <text x={SC.L - 6} y={sy(v) + 3} textAnchor="end" className="dl4s-tick">{fmtK(v)}</text>
              </g>
            ))}
            {SCAN.map((r, j) => {
              const gx = SC.L + j * SC_GW;
              const on = r.k === k;
              const mid = gx + SC_GW / 2;
              return (
                <g
                  key={r.k}
                  ref={(el) => { scanRefs.current[j] = el; }}
                  className={`dl4s-ride-scan__g${on ? ' dl4s-ride-scan__g--on' : ''}`}
                  tabIndex={on ? 0 : -1}
                  role="button"
                  aria-pressed={on}
                  aria-label={`k = ${r.k}: MAE bus ${fmtInt(r.bus.mae)}, rail ${fmtInt(r.rail.mae)}`}
                  onClick={() => setK(r.k)}
                  onKeyDown={(e) => scanKey(e, j)}
                >
                  <rect x={gx + 1} y={SC.top - 12} width={SC_GW - 2} height={SC.h + 12 + 30} rx={4} className="dl4s-ride-scan__bg" />
                  <rect x={mid - 12} y={sy(r.bus.mae)} width={11} height={SC.top + SC.h - sy(r.bus.mae)} rx={1.5} className="dl4s-ride-pt--bus" />
                  <rect x={mid + 1} y={sy(r.rail.mae)} width={11} height={SC.top + SC.h - sy(r.rail.mae)} rx={1.5} className="dl4s-ride-pt--rail" />
                  <text x={mid} y={SC.top + SC.h + 13} textAnchor="middle" className={`dl4s-tick${on ? ' dl4s-ride-scan__on' : ''}`}>{r.k}</text>
                  {r.k % 7 === 0 && <text x={mid} y={SC.top + SC.h + 25} textAnchor="middle" className="dl4s-tick">{r.k === 7 ? '1 week' : '2 weeks'}</text>}
                  {r.k === BEST_RAIL.k && <text x={mid + 6} y={sy(r.rail.mae) - 4} textAnchor="middle" className="dl4s-tick">lowest rail</text>}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k={`bus · MAE, k = ${k}`} v={fmtFix6(sc.bus.mae)} sub={`MAPE ${sc.bus.mape.toFixed(6)} (≈ ${(sc.bus.mape * 100).toFixed(1)} %)`} tone={isSlide ? 'accent' : undefined} />
        <Stat k={`rail · MAE, k = ${k}`} v={fmtFix6(sc.rail.mae)} sub={`MAPE ${sc.rail.mape.toFixed(6)} (≈ ${(sc.rail.mape * 100).toFixed(1)} %)`} tone={isSlide ? 'accent' : undefined} />
        <Stat k="lowest rail MAE, k = 1…14" v={`k = ${BEST_RAIL.k}`} sub={`${fmtFix6(BEST_RAIL.rail.mae)} — this page’s scan; two weeks back, also a whole-week lag (slides 17–18 use 7). The lowest rail MAPE is at k = ${BEST_RAIL_MAPE.k}`} />
      </div>

      <p className="dl4s-ride-status" aria-live="polite">
        {isSlide ? (
          <><span className="dl4s-dot dl4s-ride-dot--ok" /><b>= slide 18.</b> At k = 7 the printout below is slide 18’s, character for character: the four numbers match to 6 decimal places.</>
        ) : (
          <><span className="dl4s-dot" /><b>k = {k}: this page’s own computation</b> from the same data. Slide 18 prints k = 7 only.</>
        )}
        {' '}At this k bus has the {busHigherMae ? 'higher' : 'lower'} MAE but the {busLowerMape ? 'lower' : 'higher'} MAPE
        {busHigherMae && busLowerMape ? ' — slide 18’s observation. Bus carries more riders, so an error of similar size is a smaller fraction of its target.' : '.'}
      </p>

      <p className="dl4s-mono dl4s-ride-def">diff_{k} = df[["bus", "rail"]].diff({k})["2019-03":"2019-05"]  <span># slide 17’s first line{k === 7 ? '' : `, with 7 → ${k}`}</span></p>
      <div className="dl4s-ride-codes">
        <Code code={live} label="pandas · this page" meta={`k = ${k} · live`} hl={isSlide ? [2, 3, 8, 9] : undefined} />
        <Code code={MAE_CODE} label="pandas · slide 18" meta="as printed" hl={isSlide ? [2, 3, 8, 9] : undefined} />
      </div>

      <p className="dl4s-cap">
        The real daily boardings from slide 15’s file, after its pandas steps. diff(k) subtracts the row k back in the whole series before slicing
        March–May, so 1 March’s error reaches into February.
      </p>
    </Lab>
  );
}

/* ══ §7 · slide 19's toy dataset, window by window ══════════════════════════ */

const W_DEF = { n: 6, L: 3, B: 2, o: 3 }; // slide 19
const WV = { W: 640, x0: 118, c: 30, g: 4, top: 136 };
const wx = (i) => WV.x0 + i * (WV.c + WV.g);

function cellAt(key, i, y, cls, v) {
  return (
    <g key={key}>
      <rect x={wx(i)} y={y} width={WV.c} height={WV.c} rx={4} className={`dl4s-win-cell ${cls}`} />
      {v != null && <text x={wx(i) + WV.c / 2} y={y + WV.c / 2 + 4} textAnchor="middle" className="dl4s-win-val">{v}</text>}
    </g>
  );
}

export function WindowLab() {
  const [n, setN] = useState(W_DEF.n);
  const [L, setL] = useState(W_DEF.L);
  const [B, setB] = useState(W_DEF.B);
  const [o, setO] = useState(W_DEF.o);

  const series = useMemo(() => Array.from({ length: n }, (_, i) => i), [n]);
  const targets = useMemo(() => series.slice(o), [series, o]);
  const ds = useMemo(() => timeseriesDataset(series, targets, { sequence_length: L, batch_size: B }), [series, targets, L, B]);
  const { rows, bottom } = useMemo(() => windowRows(ds.batches, WV.top), [ds]);

  const isDefault = n === W_DEF.n && L === W_DEF.L && B === W_DEF.B && o === W_DEF.o;
  const asData = ds.batches.map((b) => ({ x: b.map((w) => w.x), y: b.map((w) => w.y) }));
  const sameAsSlide = JSON.stringify(asData) === JSON.stringify(TOY_BATCHES);
  const fromSeries = n - (L - 1);
  const nb = ds.batches.length;
  const lastSize = nb ? ds.batches[nb - 1].length : 0;
  const unusedTargets = Math.max(0, targets.length - ds.numSeqs);
  const droppedWindows = Math.max(0, fromSeries - ds.numSeqs);
  const H = Math.max(bottom + 6, WV.top + 40);

  const live = [
    `my_series = [${series.join(', ')}]`,
    'my_dataset = tf.keras.utils.timeseries_dataset_from_array(',
    '    my_series,',
    `    targets=my_series[${o}:],  # targets[p] = my_series[${o} + p]`,
    `    sequence_length=${L},`,
    `    batch_size=${B}`,
    ')',
    'list(my_dataset)',
    '',
    '# this page’s output:',
    tfListRepr(ds.batches),
  ].join('\n');
  const outLines = live.split('\n').length;
  const changed = [n !== W_DEF.n && 1, o !== W_DEF.o && 4, L !== W_DEF.L && 5, B !== W_DEF.B && 6].filter(Boolean);
  const hl = changed.length ? [...changed, ...Array.from({ length: outLines - 10 }, (_, i) => 11 + i)] : undefined;
  const reset = () => {
    setN(W_DEF.n);
    setL(W_DEF.L);
    setB(W_DEF.B);
    setO(W_DEF.o);
  };

  return (
    <Lab
      title="Slide 19 live · how timeseries_dataset_from_array cuts a series"
      slides="slide 19"
      tryThis="predict the number of batches if batch_size goes from 2 to 1, then check. Next set the targets offset below sequence_length and notice each target moving inside its own window (ringed) — the slide’s choice, offset = sequence_length, puts it right after."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="len(my_series)" value={n} min={4} max={10} onChange={setN} fmt={(v) => (v === W_DEF.n ? '6 (slide 19)' : v)} />
          <Range label="sequence_length" value={L} min={1} max={5} onChange={setL} fmt={(v) => (v === W_DEF.L ? '3 (slide 19)' : v)} />
          <Range label="batch_size" value={B} min={1} max={4} onChange={setB} fmt={(v) => (v === W_DEF.B ? '2 (slide 19)' : v)} />
          <Range label="targets = my_series[o:], o" value={o} min={1} max={6} onChange={setO} fmt={(v) => (v === W_DEF.o ? '3 (slide 19)' : v)} />
        </div>
        <div className="dl4s-win-reset">
          <button type="button" className="dl-btn dl4s-ibtn" onClick={reset} disabled={isDefault}><Icon name="skipBack" size={14} /> back to slide 19</button>
        </div>
      </div>

      <div className="dl4s-ride-legend" aria-hidden="true">
        <span><i className="dl4s-win-sw dl4s-win-cell--in" /> input window (x)</span>
        <span><i className="dl4s-win-sw dl4s-win-cell--y" /> its target (y)</span>
        <span><i className="dl4s-win-sw dl4s-win-sw--ring" /> target inside its own window</span>
        <span><i className="dl4s-win-sw dl4s-win-cell--skip" /> skipped between window and target</span>
      </div>

      <div className="dl4s-win-scroll">
        <svg viewBox={`0 0 ${WV.W} ${H}`} className="dl4s-svg dl4s-win-svg" role="img" aria-label={`my_series of ${n} values cut into ${ds.numSeqs} windows of ${L}, in ${nb} batch${nb === 1 ? '' : 'es'} of up to ${B}; window p's target is my_series[${o} + p].`}>
          {/* the series and the targets list, aligned by position */}
          <text x={8} y={41} className="dl4s-svg__label dl4s-svg__label--ink">my_series</text>
          {series.map((v, i) => (
            <g key={`s${i}`}>
              <text x={wx(i) + WV.c / 2} y={14} textAnchor="middle" className="dl4s-tick">[{i}]</text>
              {cellAt(`sc${i}`, i, 20, 'dl4s-win-cell--series', v)}
            </g>
          ))}
          <text x={8} y={88} className="dl4s-svg__label dl4s-svg__label--ink">targets</text>
          <text x={8} y={101} className="dl4s-tick">= my_series[{o}:]</text>
          {targets.length === 0 && <text x={wx(0)} y={96} className="dl4s-tick">[] — empty: the offset is past the end</text>}
          {targets.map((v, j) => (
            <g key={`t${j}`} className={j >= ds.numSeqs ? 'dl4s-win-dim' : ''}>
              {cellAt(`tc${j}`, o + j, 74, 'dl4s-win-cell--tsrc', v)}
              <text x={wx(o + j) + WV.c / 2} y={118} textAnchor="middle" className="dl4s-tick">[{j}]</text>
            </g>
          ))}
          {o >= 2 && targets.length > 0 && (
            <text x={wx(o) - 6} y={93} textAnchor="end" className="dl4s-tick">shifted {o} →</text>
          )}
          {unusedTargets > 0 && (
            <text x={wx(n) + 10} y={93} className="dl4s-tick">{unusedTargets} unused</text>
          )}

          {/* the windows, batch by batch */}
          {ds.numSeqs === 0 && (
            <text x={8} y={WV.top + 22} className="dl4s-svg__label">no windows — list(my_dataset) is []</text>
          )}
          {rows.map((r) => {
            if (r.kind === 'head') {
              return (
                <g key={`h${r.bi}`}>
                  <line x1={4} x2={WV.W - 4} y1={r.y + 2} y2={r.y + 2} className="dl4s-gridline" />
                  <text x={8} y={r.y + 17} className="dl4s-svg__label dl4s-svg__label--ink">
                    batch {r.bi + 1}
                  </text>
                  <text x={WV.x0} y={r.y + 17} className="dl4s-win-shape">x: shape={batchShape(r.b)} · y: shape=({r.b.length},)</text>
                </g>
              );
            }
            const { w } = r;
            const p = w.start;
            const q = o + p; // where targets[p] sits in my_series
            const inside = q < p + L;
            return (
              <g key={`w${p}`}>
                <text x={8} y={r.y + 22} className="dl4s-tick">window p = {p}</text>
                {w.x.map((v, i) => cellAt(`x${i}`, p + i, r.y + 3, 'dl4s-win-cell--in', v))}
                {!inside && Array.from({ length: q - (p + L) }, (_, i) => cellAt(`k${i}`, p + L + i, r.y + 3, 'dl4s-win-cell--skip', null))}
                {inside ? (
                  <rect x={wx(q) - 3} y={r.y} width={WV.c + 6} height={WV.c + 6} rx={6} className="dl4s-win-ring" />
                ) : (
                  cellAt('y', q, r.y + 3, 'dl4s-win-cell--y', w.y)
                )}
                <text x={wx(n) + 10} y={r.y + 16} className="dl4s-win-yt">y = {w.y}</text>
                <text x={wx(n) + 10} y={r.y + 29} className="dl4s-tick">targets[{p}] = my_series[{q}]</text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="dl4s-readout dl4s-mono">
        num_seqs = min(len(my_series) − (sequence_length − 1), len(targets))
        <br />
        = min({n} − {L - 1}, {targets.length}) = <b>{ds.numSeqs}</b>
        <br />
        batches = ⌈{ds.numSeqs} / {B}⌉ = <b>{nb}</b>
        {nb > 0 && (lastSize === B ? ', all full' : `, the last holds ${lastSize}`)}
      </p>
      <p className="dl4s-readout">
        Window p takes my_series[p : p + {L}] and gets target targets[p] = my_series[{o} + p].{' '}
        {ds.numSeqs === 0 ? (
          <>
            <b>No window fits, so list(my_dataset) is [].</b>
            {n < L && ` The series has ${n} values, fewer than sequence_length = ${L}.`}
            {targets.length === 0 && ` targets = my_series[${o}:] is empty: the offset is past the end.`}
          </>
        ) : (
          <>
            {o === L && <>With offset = sequence_length, the slide’s choice, the target is <b>the value right after the window</b>.</>}
            {o < L && <>The offset is below sequence_length, so <b>each target is inside its own window</b> (ringed): the input already contains its answer.</>}
            {o > L && <>The offset is above sequence_length, so {o - L} value{o - L > 1 ? 's are' : ' is'} skipped: <b>the target is {o - L + 1} steps after the window’s last value</b>.</>}
            {unusedTargets > 0 && ` The last ${unusedTargets} target${unusedTargets > 1 ? 's have' : ' has'} no full window, so ${unusedTargets > 1 ? 'they are' : 'it is'} never used.`}
            {droppedWindows > 0 && ` The series has room for ${fromSeries} windows, but targets runs out after ${ds.numSeqs}, so the last ${droppedWindows} ${droppedWindows > 1 ? 'are' : 'is'} dropped.`}
          </>
        )}
        {' '}Slide 19’s comment, “the targets are 3 steps into the future”, describes my_series[3:]: the targets list is the series moved 3 steps along.
      </p>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="windows" v={ds.numSeqs} sub={`${L} inputs + 1 target each`} />
        <Stat k="batches" v={nb} sub={nb ? `${nb - (lastSize === B ? 0 : 1)} full of ${B}${lastSize !== B ? `, last of ${lastSize}` : ''}` : 'empty dataset'} />
        <Stat k="last batch shapes" v={nb ? `${batchShape(ds.batches[nb - 1])} · (${lastSize},)` : '—'} sub="x first, then y — the last batch may be short" />
      </div>

      <p className="dl4s-ride-status" aria-live="polite">
        {sameAsSlide ? (
          <><span className="dl4s-dot dl4s-ride-dot--ok" /><b>= slide 19.</b> Same windows, targets, batches and shapes as the slide’s printed output: (2, 3) + (2,), then (1, 3) + (1,).</>
        ) : (
          <><span className="dl4s-dot" /><b>This page’s own run</b> of the same function with your arguments — slide 19 prints the 6 / 3 / 2 / offset-3 case only.</>
        )}
      </p>

      <div className="dl4s-ride-codes dl4s-ride-codes--stack">
        <Code code={live} label="python · this page" meta="live" hl={hl} />
      </div>
      <p className="dl4s-cap">
        The live output completes the line that runs off slide 19’s right edge (slide 19’s own listing is in the Read beat). The window starting at p takes
        targets[p]; the last batch may be short.
      </p>
    </Lab>
  );
}

/* ══ §7 · rail windows (slides 20–22) ══════════════════════════════════════ */

const [TR_A, TR_B] = monthRange(S0, SPLITS.train.from, SPLITS.train.to); // rows 0…1095
const [VA_A, VA_B] = monthRange(S0, SPLITS.valid.from, SPLITS.valid.to); // rows 1096…1246
const RAIL_ALL = R.rail.map((v) => v / 1e6);
const RAIL_TRAIN = RAIL_ALL.slice(TR_A, TR_B + 1);
const RAIL_VALID = RAIL_ALL.slice(VA_A, VA_B + 1);
const TRAIN_MAX = RAIL_TRAIN.reduce((b, v, i) => (v > b.v ? { v, i } : b), { v: -Infinity, i: 0 });

// the split overview
const SV = { W: 720, L: 40, R: 12, top: 32, h: 56, foot: 16 };
const SV_PW = SV.W - SV.L - SV.R;
const svx = (i) => SV.L + (i / (R.length - 1)) * SV_PW;
const svy = (v) => SV.top + SV.h * (1 - v / 1.2);
const SV_H = SV.top + SV.h + SV.foot;
const SV_PATH = linePath(RAIL_ALL, svx, svy);
const YEARS = [2016, 2017, 2018, 2019].map((y) => ({ y, i: dayIndex(S0, `${y}-01-01`) }));

// the explorer
const EX = { W: 720, L: 40, R: 16, oTop: 6, oh: 40, top: 98, h: 140, foot: 42 };
const EX_PW = EX.W - EX.L - EX.R;
const EX_H = EX.top + EX.h + EX.foot;
const eox = (i) => EX.L + (i / (RAIL_TRAIN.length - 1)) * EX_PW;
const eoy = (v) => EX.oTop + EX.oh * (1 - v / 1.2);
const ey = (v) => EX.top + EX.h * (1 - v / 1.2);
const EX_OVER = linePath(RAIL_TRAIN, eox, eoy);
const EX_YT = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];

// slide 20's code, line numbers by what they set
const SPLIT_HL = { split: [1, 2], seq: [5, 8, 9, 16, 17], batch: [10, 18], shuffle: [11, 12], window: [8, 9] };
const SPLIT_META = { split: 'the split', seq: 'seq_length', batch: 'batch_size', shuffle: 'shuffle', window: 'targets' };

function BatchStrip({ ds, B }) {
  const nb = ds.batches.length;
  const W = 600;
  const gap = nb > 60 ? 0.5 : 1.2;
  const per = (W - gap * Math.max(0, nb - 1)) / Math.max(1, ds.numSeqs);
  const rects = [];
  for (let i = 0, x = 0; i < nb; i++) {
    const b = ds.batches[i];
    const w = b.length * per;
    rects.push(<rect key={i} x={x} y={0} width={w} height={14} rx={1.5} className={`dl4s-rail-batch${b.length !== B ? ' dl4s-rail-batch--short' : ''}`} />);
    x += w + gap;
  }
  return (
    <svg viewBox={`0 0 ${W} 14`} className="dl4s-svg dl4s-rail-strip" role="img" aria-label={`${nb} batches drawn to scale${ds.batches[nb - 1]?.length !== B ? `; the last holds ${ds.batches[nb - 1]?.length}` : ''}`}>
      {rects}
    </svg>
  );
}

function DsSummary({ name, src, len, from, to, ds, L, B, extra }) {
  const nb = ds.batches.length;
  const last = ds.batches[nb - 1];
  const full = ds.batches.filter((b) => b.length === B).length;
  return (
    <div className="dl4s-rail-set">
      <p className="dl4s-rail-set__name"><b>{name}</b> from {src}{extra}</p>
      <dl className="dl4s-rail-set__rows">
        <div><dt>days</dt><dd>{fmtInt(len)} · {from} → {to}</dd></div>
        <div><dt>windows</dt><dd>min({fmtInt(len)} − {L - 1}, {fmtInt(len)} − {L}) = <b>{fmtInt(ds.numSeqs)}</b></dd></div>
        <div><dt>batches</dt><dd>⌈{fmtInt(ds.numSeqs)} / {B}⌉ = <b>{nb}</b>{nb > 0 && ` · ${full} × ${B}${last.length !== B ? ` + 1 × ${last.length}` : ''}`}</dd></div>
      </dl>
      {nb > 0 && <BatchStrip ds={ds} B={B} />}
      {nb > 0 && last.length !== B && <p className="dl4s-rail-set__key"><i className="dl4s-rail-set__sw" /> the short last batch ({last.length} windows), drawn to scale</p>}
    </div>
  );
}

function MiniWindow({ w, L, on, onPick }) {
  const W = 170;
  const H = 122;
  const m = { l: 28, r: 10, t: 8, b: 24 };
  const vals = [...w.x, w.y];
  const [lo, hi] = marginDomain(vals, 0.06);
  const yStep = niceStep(hi - lo, 4);
  const yt = ticksIn(lo, hi, yStep);
  const xt = ticksIn(0, L - 1, niceStep(L, 3));
  const x = (d) => m.l + (d / L) * (W - m.l - m.r);
  const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  const d0 = TR_A + w.start;
  const label = `Window starting ${isoAt(S0, d0)}, ${L} days, target ${isoAt(S0, d0 + L)} = ${w.y.toFixed(6)}`;
  return (
    <button type="button" className={`dl4s-rail-panel${on ? ' dl4s-rail-panel--on' : ''}`} onClick={onPick} aria-pressed={on} aria-label={`${label}. Open it in the window explorer.`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dl4s-svg" role="img" aria-label={label}>
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="dl4s-gridline" />
            <text x={m.l - 3} y={y(v) + 3} textAnchor="end" className="dl4s-tick dl4s-rail-tick">{v.toFixed(yStep < 0.1 ? 2 : 1)}</text>
          </g>
        ))}
        {xt.map((d) => (
          <g key={`x${d}`}>
            <line x1={x(d)} x2={x(d)} y1={m.t} y2={H - m.b} className="dl4s-gridline" />
            <text x={x(d)} y={H - m.b + 10} textAnchor="middle" className="dl4s-tick dl4s-rail-tick">{d}</text>
          </g>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 3} textAnchor="middle" className="dl4s-tick dl4s-rail-tick">Day</text>
        <path d={linePath(w.x, x, y)} className="dl4s-rail-line" />
        {w.x.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={1.5} className="dl4s-rail-pt" />)}
        <path d={starPath(x(L), y(w.y), 5.5)} className="dl4s-rail-star" />
      </svg>
      <span className="dl4s-rail-panel__dates"><span>{isoAt(S0, d0)} →</span> <span>{isoAt(S0, d0 + L - 1)}</span></span>
      <span className="dl4s-rail-panel__tgt">target {dayLabel(d0 + L)}</span>
    </button>
  );
}

export function RailWindowsLab() {
  const { printing } = useStudy();
  const [L, setL] = useState(SPLITS.seqLength);
  const [B, setB] = useState(SPLITS.batchSize);
  const [seed, setSeed] = useState(42);
  const [pick, setPick] = useState(0);
  const [focus, setFocus] = useState('split');
  const [tab, setTab] = useState('split');

  const ds = useMemo(() => ({
    train: timeseriesDataset(RAIL_TRAIN, RAIL_TRAIN.slice(L), { sequence_length: L, batch_size: B, shuffle: true, seed }),
    valid: timeseriesDataset(RAIL_VALID, RAIL_VALID.slice(L), { sequence_length: L, batch_size: B }),
  }), [L, B, seed]);
  const tr = ds.train;
  const va = ds.valid;
  const p = Math.min(pick, tr.numSeqs - 1);
  const five = tr.batches[0]?.slice(0, 5) ?? [];
  const isSlide = L === SPLITS.seqLength && B === SPLITS.batchSize;

  const b0 = tr.batches[0];
  const b1 = tr.batches[1];
  const bl = tr.batches[tr.batches.length - 1];
  const shapeRows = [
    { k: 'Minibatch 0', b: b0, slide: true },
    { k: 'Minibatch 1', b: b1, slide: true },
    { k: `last (Minibatch ${tr.batches.length - 1})`, b: bl, slide: false },
  ].filter((r) => r.b);
  const slideShape = (b) => batchShape(b) === '(32, 56)' && b.length === 32;

  const setSeq = (v) => { setL(v); setFocus('seq'); setTab('split'); };
  const setBatch = (v) => { setB(v); setFocus('batch'); setTab('inspect'); };
  const reshuffle = () => { setSeed((s) => s + 1); setFocus('shuffle'); };
  const pickWindow = (start) => { setPick(start); setFocus('window'); };

  const inspectHl = isSlide ? [10, 11, 13, 14] : [4, 5];
  const splitCode = <Code code={SPLIT_CODE} label="python · slide 20" meta={SPLIT_META[focus]} hl={SPLIT_HL[focus]} />;
  const inspectCode = <Code code={INSPECT_CODE} label="python · slide 21" meta="as printed" hl={inspectHl} />;
  // on paper both listings print, one after the other
  const codeShown = printing ? <>{splitCode}{inspectCode}</> : tab === 'split' ? splitCode : inspectCode;

  // the explorer window
  const xs = RAIL_TRAIN.slice(p, p + L);
  const yv = RAIL_TRAIN[p + L];
  const dRow = TR_A + p;
  const dx = (d) => EX.L + (d + 0.5) * (EX_PW / (L + 1));
  const dxt = ticksIn(0, L, niceStep(L, 6));
  const maxIn = TRAIN_MAX.i >= p && TRAIN_MAX.i <= p + L;
  const winCode = [
    `xx = rail_train.iloc[${p}:${p + L}]   # ${dayLabel(dRow)} → ${dayLabel(dRow + L - 1)}, ${L} days`,
    `yy = rail_train[seq_length:].iloc[${p}]   # = rail_train.iloc[${p + L}] = ${yv.toFixed(6)}, ${dayLabel(dRow + L)}`,
  ].join('\n');

  return (
    <Lab
      title="Slides 20–22 live · the rail series cut into 56-day windows"
      slides="slides 20–22"
      tryThis="before reading the counts, predict how many 56-day windows rail_train’s 1,096 days give; then drag seq_length to 112 and notice the batch count and the last batch change."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="seq_length" value={L} min={7} max={112} onChange={setSeq} fmt={(v) => (v === SPLITS.seqLength ? '56 (slide 20)' : v)} width={240} />
        </div>
        <Chips label="batch_size" value={B} options={[8, 16, { v: 32, l: '32 (slide 20)' }, 64, 128]} onChange={setBatch} />
      </div>

      {/* ── 1 · the split ── */}
      <p className="dl4s-stagehead">1 · the split (slide 20) · rail riders ÷ <span className="dl4s-nocase">1e6</span></p>
      <div className="dl4s-ride-scroll">
        <svg viewBox={`0 0 ${SV.W} ${SV_H}`} className="dl4s-svg dl4s-rail-splitsvg" role="img" aria-label="The daily rail series from January 2016 to May 2019, divided into rail_train (2016 to 2018, 1,096 days) and rail_valid (January to May 2019, 151 days).">
          <rect x={svx(TR_A)} y={SV.top} width={svx(TR_B) - svx(TR_A)} height={SV.h} className="dl4s-rail-zone--train" />
          <rect x={svx(VA_A)} y={SV.top} width={svx(VA_B) - svx(VA_A)} height={SV.h} className="dl4s-rail-zone--valid" />
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={SV.L} x2={SV.W - SV.R} y1={svy(v)} y2={svy(v)} className="dl4s-gridline" />
              <text x={SV.L - 5} y={svy(v) + 3} textAnchor="end" className="dl4s-tick">{v.toFixed(1)}</text>
            </g>
          ))}
          <path d={SV_PATH} className="dl4s-rail-line dl4s-rail-line--thin" />
          {YEARS.map((yr) => (
            <g key={yr.y}>
              <line x1={svx(yr.i)} x2={svx(yr.i)} y1={SV.top + SV.h} y2={SV.top + SV.h + 4} className="dl4s-axis" />
              <text x={svx(yr.i) + 3} y={SV.top + SV.h + 13} className="dl4s-tick">{yr.y}</text>
            </g>
          ))}
          <text x={(svx(TR_A) + svx(TR_B)) / 2} y={SV.top - 18} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--ink">rail_train</text>
          <text x={(svx(TR_A) + svx(TR_B)) / 2} y={SV.top - 6} textAnchor="middle" className="dl4s-tick">df["rail"]["2016-01":"2018-12"] · {fmtInt(RAIL_TRAIN.length)} days</text>
          <text x={svx(VA_B)} y={SV.top - 18} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--ink">rail_valid</text>
          <text x={svx(VA_B)} y={SV.top - 6} textAnchor="end" className="dl4s-tick">["2019-01":"2019-05"] · {RAIL_VALID.length} days</text>
        </svg>
      </div>

      <div className="dl4s-rail-top">
        <div className="dl4s-rail-sets">
          <DsSummary name="train_ds" src="rail_train" extra=", shuffle=True, seed=42" len={RAIL_TRAIN.length} from={isoAt(S0, TR_A)} to={isoAt(S0, TR_B)} ds={tr} L={L} B={B} />
          <DsSummary name="valid_ds" src="rail_valid" extra=", not shuffled" len={RAIL_VALID.length} from={isoAt(S0, VA_A)} to={isoAt(S0, VA_B)} ds={va} L={L} B={B} />
          <div className="dl-tablewrap">
            <table className="dl-table dl4s-rail-shapes">
              <thead><tr><th>train_ds</th><th>xx.shape</th><th>yy.shape</th><th>source</th></tr></thead>
              <tbody>
                {shapeRows.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{batchShape(r.b)}</td>
                    <td>({r.b.length},)</td>
                    <td>{r.slide && slideShape(r.b) ? <><span className="dl4s-dot dl4s-ride-dot--ok" />= slide 21</> : <><span className="dl4s-dot" />this page</>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dl4s-cap">
            windows = min(len − (seq_length − 1), len(targets)), where targets = series[seq_length:] has len − seq_length values. These window and batch
            counts are this page’s own, computed from the data with the Keras counting rule; the slides print only the shapes (32, 56) and (32,) for the
            first two minibatches (slide 21). rail_test ("2019-06" onwards) lies beyond this page’s data.
          </p>
        </div>
        <div className="dl4s-rail-code">
          <Chips label="code" compact value={tab} options={[{ v: 'split', l: 'slide 20 · split' }, { v: 'inspect', l: 'slide 21 · inspect' }]} onChange={setTab} />
          {codeShown}
        </div>
      </div>

      {/* ── 2 · five windows from a shuffled batch ── */}
      <div className="dl4s-rail-head">
        <p className="dl4s-stagehead">2 · five windows from the first shuffled batch (slide 22’s plot)</p>
        <div className="dl4s-rail-btns">
          <button type="button" className="dl-btn dl4s-ibtn" onClick={reshuffle}><Icon name="swap" size={14} /> reshuffle</button>
          {seed !== 42 && <button type="button" className="dl-btn" onClick={() => { setSeed(42); setFocus('shuffle'); }}>seed 42</button>}
          <span className="dl4s-rail-seed">seed = {seed} in this page’s RNG</span>
        </div>
      </div>
      <div className="dl4s-rail-panels">
        <span className="dl4s-rail-ylab" aria-hidden="true">Normalised #rail riders</span>
        <div className="dl4s-rail-panelgrid">
          {five.map((w) => (
            <MiniWindow key={`${seed}-${L}-${w.start}`} w={w} L={L} on={focus === 'window' && w.start === p} onPick={() => pickWindow(w.start)} />
          ))}
        </div>
      </div>
      <div className="dl4s-ride-legend" aria-hidden="true">
        <span><Key kind="line" tone="blue" /> input, days 0–{L - 1} (“b.-”)</span>
        <span><Key kind="star" /> target, day {L} (“r*”)</span>
      </div>
      <p className="dl4s-cap">
        <b>This page’s own shuffle — not the five windows on slide 22.</b> TensorFlow’s shuffle order can’t be reproduced here, even with seed=42, so these
        are the first five windows of the first batch from this page’s seeded shuffle. Each panel has its own y range, as in the slide’s figure. Click a panel
        to open it in the explorer.
      </p>

      {/* ── 3 · the window explorer ── */}
      <p className="dl4s-stagehead">3 · window explorer · rail_train, not shuffled</p>
      <div className="dl4s-rail-explore">
        <div className="dl4s-stepper" role="group" aria-label="Window">
          <button type="button" className="dl-btn" onClick={() => pickWindow(Math.max(0, p - 1))} disabled={p === 0} aria-label="Previous window"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => pickWindow(Math.min(tr.numSeqs - 1, p + 1))} disabled={p >= tr.numSeqs - 1} aria-label="Next window"><Icon name="arrowRight" size={14} /></button>
        </div>
        <div className="dl-sliders">
          <Range label="window start p" value={p} min={0} max={tr.numSeqs - 1} onChange={pickWindow} fmt={(v) => `${v} of 0…${tr.numSeqs - 1}`} width={260} />
        </div>
      </div>
      <div className="dl4s-ride-scroll">
        <svg viewBox={`0 0 ${EX.W} ${EX_H}`} className="dl4s-svg dl4s-rail-exsvg" role="img" aria-label={`Window ${p}: ${L} days of rail riders from ${isoAt(S0, dRow)} to ${isoAt(S0, dRow + L - 1)}, and its target, ${isoAt(S0, dRow + L)}, the next day.`}>
          {/* overview of rail_train with the window marked */}
          <rect x={eox(p)} y={EX.oTop} width={Math.max(2, eox(p + L - 1) - eox(p))} height={EX.oh} className="dl4s-rail-zone--win" />
          <path d={EX_OVER} className="dl4s-rail-line dl4s-rail-line--thin dl4s-rail-line--muted" />
          <line x1={eox(p + L)} x2={eox(p + L)} y1={EX.oTop} y2={EX.oTop + EX.oh} className="dl4s-rail-tgtline" />
          {YEARS.slice(0, 3).map((yr) => (
            <text key={yr.y} x={eox(yr.i) + 3} y={EX.oTop + EX.oh + 11} className="dl4s-tick">{yr.y}</text>
          ))}
          <line x1={eox(p)} y1={EX.oTop + EX.oh} x2={EX.L} y2={EX.top - 26} className="dl4s-rail-zoom" />
          <line x1={eox(p + L)} y1={EX.oTop + EX.oh} x2={EX.W - EX.R} y2={EX.top - 26} className="dl4s-rail-zoom" />
          {/* the window itself */}
          <line x1={dx(0)} x2={dx(L - 1)} y1={EX.top - 8} y2={EX.top - 8} className="dl4s-rail-brace" />
          <text x={(dx(0) + dx(L - 1)) / 2} y={EX.top - 13} textAnchor="middle" className="dl4s-svg__label dl4s-rail-lab--x">xx: {L} input days, rail_train[{p} : {p + L}]</text>
          <text x={dx(L)} y={EX.top - 13} textAnchor="end" className="dl4s-svg__label dl4s-rail-lab--y">yy</text>
          {Array.from({ length: L + 1 }, (_, d) => d).filter((d) => R.dayType[dRow + d] !== 'W').map((d) => (
            <rect key={`b${d}`} x={dx(d) - EX_PW / (L + 1) / 2} y={EX.top} width={EX_PW / (L + 1)} height={EX.h} className={`dl4s-ride-band--${R.dayType[dRow + d]}`} />
          ))}
          {EX_YT.map((v) => (
            <g key={v}>
              <line x1={EX.L} x2={EX.W - EX.R} y1={ey(v)} y2={ey(v)} className="dl4s-gridline" />
              <text x={EX.L - 5} y={ey(v) + 3} textAnchor="end" className="dl4s-tick">{v.toFixed(1)}</text>
            </g>
          ))}
          {dxt.map((d) => (
            <g key={`d${d}`}>
              <line x1={dx(d)} x2={dx(d)} y1={EX.top + EX.h} y2={EX.top + EX.h + 4} className="dl4s-axis" />
              <text x={dx(d)} y={EX.top + EX.h + 14} textAnchor="middle" className="dl4s-tick">{d}</text>
            </g>
          ))}
          <line x1={(dx(L - 1) + dx(L)) / 2} x2={(dx(L - 1) + dx(L)) / 2} y1={EX.top} y2={EX.top + EX.h} className="dl4s-rail-sep" />
          <rect x={EX.L} y={EX.top} width={EX_PW} height={EX.h} className="dl4s-ride-frame" />
          <path d={linePath(xs, dx, ey)} className="dl4s-rail-line" />
          {xs.map((v, d) => <circle key={d} cx={dx(d)} cy={ey(v)} r={2.3} className="dl4s-rail-pt" />)}
          <path d={starPath(dx(L), ey(yv), 7)} className="dl4s-rail-star" />
          {maxIn && (
            <text
              x={dx(TRAIN_MAX.i - p) + (TRAIN_MAX.i - p > L / 2 ? -9 : 9)}
              y={ey(TRAIN_MAX.v) + 4}
              textAnchor={TRAIN_MAX.i - p > L / 2 ? 'end' : 'start'}
              className="dl4s-tick dl4s-rail-maxlab"
            >
              {TRAIN_MAX.v.toFixed(6)} · {isoAt(S0, TR_A + TRAIN_MAX.i)}, the highest value in rail_train
            </text>
          )}
          <text x={EX.L} y={EX.top + EX.h + 28} className="dl4s-tick">day 0 = {dayLabel(dRow)}</text>
          <text x={EX.L + EX_PW / 2} y={EX.top + EX.h + 28} textAnchor="middle" className="dl4s-svg__label">Day</text>
          <text x={EX.W - EX.R} y={EX.top + EX.h + 28} textAnchor="end" className="dl4s-tick">day {L} = {dayLabel(dRow + L)}</text>
        </svg>
      </div>
      <p className="dl4s-readout" aria-live="polite">
        Window <b>p = {p}</b>: xx = rail_train[{p} : {p + L}] covers <b>{dayLabel(dRow)} → {dayLabel(dRow + L - 1)}</b> ({L} days). Its target yy = targets[{p}] =
        rail_train[{p + L}] = <b>{yv.toFixed(6)}</b> on <b>{dayLabel(dRow + L)}</b> — the day right after the window’s last day, because targets =
        rail_train[seq_length:] starts {L} rows in.
      </p>
      <Code code={winCode} label="pandas · this page" meta={`window ${p}`} />
    </Lab>
  );
}

/* ── layout ───────────────────────────────────────────────────────────────── */
// WindowLab rows: a header per batch, then one row per window
function windowRows(batches, top) {
  const rows = [];
  let y = top;
  for (let bi = 0; bi < batches.length; bi++) {
    rows.push({ kind: 'head', y, bi, b: batches[bi] });
    y += 24;
    for (const w of batches[bi]) {
      rows.push({ kind: 'win', y, w });
      y += 38;
    }
    y += 6;
  }
  return { rows, bottom: y };
}

// ── maths (to move into rnn.js) ──
// day of the week (0 = Sunday) of row i of a contiguous daily index
function weekdayAt(startISO, i) {
  return new Date(Date.parse(`${startISO}T00:00:00Z`) + i * 86400000).getUTCDay();
}
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// a 1 / 2 / 5 × 10ⁿ tick step giving about `target` intervals over `span`
function niceStep(span, target = 5) {
  const raw = Math.abs(span) / target || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
// multiples of `step` inside [lo, hi]
function ticksIn(lo, hi, step) {
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
// [min, max] widened by `pad` of the span on each side (matplotlib's 5 % margins)
function marginDomain(vals, pad = 0.05) {
  let lo = Infinity;
  let hi = -Infinity;
  vals.forEach((v) => {
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  });
  const span = hi - lo || Math.abs(hi) || 1;
  return [lo - span * pad, hi + span * pad];
}
// how pandas prints a float64 Series: index left-aligned, 4 spaces, values
// right-aligned to 6 decimals, then the dtype line
function pandasSeriesText(pairs) {
  const vals = pairs.map(([, v]) => v.toFixed(6));
  const vw = Math.max(...vals.map((s) => s.length));
  const iw = Math.max(...pairs.map(([n]) => n.length));
  return [...pairs.map(([n], i) => `${n.padEnd(iw)}    ${vals[i].padStart(vw)}`), 'dtype: float64'].join('\n');
}
// list(dataset) for an int32 (x, y) dataset, laid out the way slide 19 shows it
function tfListRepr(batches) {
  if (!batches.length) return '[]';
  const arr = (v) => `[${v.join(', ')}]`;
  const lines = [];
  batches.forEach((b, bi) => {
    const open = bi === 0 ? '[(' : ' (';
    const close = bi === batches.length - 1 ? ')]' : '),';
    const xs = b.map((w) => w.x);
    const ys = b.map((w) => w.y);
    const shape = `(${xs.length}, ${xs[0].length})`;
    if (xs.length === 1) {
      lines.push(`${open}<tf.Tensor: shape=${shape}, dtype=int32, numpy=array([${arr(xs[0])}], dtype=int32)>,`);
    } else {
      lines.push(`${open}<tf.Tensor: shape=${shape}, dtype=int32, numpy=`);
      xs.forEach((r, i) => lines.push(`${i === 0 ? '  array([' : '         '}${arr(r)}${i === xs.length - 1 ? '], dtype=int32)>,' : ','}`));
    }
    lines.push(`  <tf.Tensor: shape=(${ys.length},), dtype=int32, numpy=array(${arr(ys)}, dtype=int32)>${close}`);
  });
  return lines.join('\n');
}
