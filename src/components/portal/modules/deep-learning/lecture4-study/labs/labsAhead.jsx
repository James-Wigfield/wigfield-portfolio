import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { RIDERSHIP } from '../data/ridership';
import { LOOP_CODE, AHEAD_DS_CODE, AHEAD_MODEL_CODE, MULVAR_COLUMNS, SPLITS } from '../slideData';
import { timeseriesDataset, fitLinear, predictLinear, mae, monthRange, isoAt, fmtInt } from '../rnn';
import { useReducedMotion } from '../hooks';
import './labsAhead.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §11
     LoopLab        slide 34's loop, one round at a time: predict a day,
                    append it to X, repeat 14 times (Figure 15-11's picture).
                    univar_model's trained weights aren't available, so a
                    stand-in predictor — the naive 7-day copy, or this page's
                    least-squares linear model — runs the same loop, labelled
     AheadSplitLab  slides 35–38: one 70-day window of the real df_mulvar,
                    cut by split_inputs_and_targets into (56, 5) inputs and
                    the 14 rail targets; batch shapes and the 33-batch count
   ========================================================================== */

const R = RIDERSHIP;
const railM = R.rail.map((v) => v / 1e6);
const busM = R.bus.map((v) => v / 1e6);
const SEQ = SPLITS.seqLength;
const AHEAD = 14;
const DT = ['A', 'U', 'W'];

/* ── §11 · slide 34's loop ───────────────────────────────────────────────── */
export function LoopLab() {
  const reduced = useReducedMotion();
  const [pred, setPred] = useState('naive');
  const [k, setK] = useState(0); // rounds done
  const [playing, setPlaying] = useState(false);

  const setup = useMemo(() => {
    const [va] = monthRange(R.start, SPLITS.valid.from, SPLITS.valid.to); // rail_valid starts 2019-01-01
    const [ta, tb] = monthRange(R.start, SPLITS.train.from, SPLITS.train.to);
    const tr = railM.slice(ta, tb + 1);
    const ds = timeseriesDataset(tr, tr.slice(SEQ), { sequence_length: SEQ, batch_size: 32 });
    const w = fitLinear(ds.windows.map((d) => d.x), ds.windows.map((d) => d.y));
    return { va, w };
  }, []);

  const run = useMemo(() => {
    const X = railM.slice(setup.va, setup.va + SEQ);
    const preds = [];
    for (let s = 0; s < AHEAD; s++) {
      const y = pred === 'naive' ? X[X.length - 7] : predictLinear(setup.w, X.slice(-SEQ));
      preds.push(y);
      X.push(y);
    }
    const truth = railM.slice(setup.va + SEQ, setup.va + SEQ + AHEAD);
    return { preds, truth, mae: mae(preds.map((p, i) => p - truth[i])) * 1e6 };
  }, [pred, setup]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setTimeout(() => {
      if (k >= AHEAD) setPlaying(false);
      else setK(k + 1);
    }, reduced ? 60 : 420);
    return () => clearTimeout(id);
  }, [playing, k, reduced]);

  // Figure 15-11's window: 1 Feb → 11 Mar 2019
  const from = setup.va + 31;
  const to = setup.va + SEQ + AHEAD - 1;
  const today = setup.va + SEQ - 1;
  const W = 640;
  const H = 246;
  const px = (i) => 56 + ((i - from) / (to - from)) * (W - 76);
  const py = (v) => 36 + ((0.82 - v) / 0.66) * (H - 66);
  const truthPts = [];
  for (let i = from; i <= to; i++) truthPts.push([px(i), py(railM[i])]);
  const predPts = run.preds.slice(0, k).map((v, s) => [px(today + 1 + s), py(v)]);
  const hl = k === 0 ? [3] : k >= AHEAD ? [4, 5, 6] : [5, 6];

  return (
    <Lab
      title="Slide 34 · forecasting 14 days, one step at a time"
      slides="slide 34"
      tryThis="before pressing step, predict X.shape after the first round; then play all 14 rounds and notice that from round 8 the naive stand-in is copying its own predictions — the loop feeds on itself."
    >
      <div className="dl-lab__controls">
        <Chips label="stand-in predictor" value={pred} options={[{ v: 'naive', l: 'copy 7 days back (slide 18’s baseline)' }, { v: 'linear', l: 'this page’s linear model (regularised least squares)' }]} onChange={(v) => { setPred(v); }} />
        <div className="dl4s-stepper" role="group" aria-label="Rounds of the loop">
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setK(0); }} aria-label="Back to the start"><Icon name="skipBack" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setK((v) => Math.max(0, v - 1)); }} disabled={k === 0} aria-label="Previous round"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { if (reduced) { setK(AHEAD); return; } if (k >= AHEAD) setK(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play the 14 rounds'}><Icon name={playing ? 'pause' : 'play'} size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setK((v) => Math.min(AHEAD, v + 1)); }} disabled={k >= AHEAD} aria-label="Next round"><Icon name="arrowRight" size={14} /></button>
          <span className="dl4s-stepper__t">round <b>{k}</b> of {AHEAD} · <code>X.shape</code> = (1, {SEQ + k}, 1)</span>
        </div>
      </div>
      <div className="dl4s-loop">
        <div className="dl4s-wide">
          <svg viewBox={`0 0 ${W} ${H}`} className="dl4s-svg" role="img" aria-label={`Rail ridership from 1 February to 11 March 2019 with ${k} of 14 predictions after Today, 25 February`}>
            {[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((v) => (
              <g key={v}>
                <line x1={56} y1={py(v)} x2={W - 20} y2={py(v)} className="dl4s-loop__grid" />
                <text x={50} y={py(v) + 3} textAnchor="end" className="dl4s-tick">{fmtInt(v * 1e6)}</text>
              </g>
            ))}
            {[from, from + 7, from + 14, from + 21, from + 28, from + 35].map((i) => (
              <text key={i} x={px(i)} y={H - 10} textAnchor="middle" className="dl4s-tick">{isoAt(R.start, i).slice(5)}</text>
            ))}
            <polyline points={truthPts.map((p) => p.join(',')).join(' ')} className="dl4s-loop__true" />
            {truthPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} className="dl4s-loop__dot" />)}
            <line x1={px(today)} y1={10} x2={px(today)} y2={H - 26} className="dl4s-loop__today" />
            <text x={px(today) + 4} y={30} className="dl4s-svg__label dl4s-svg__label--ink">Today (2019-02-25)</text>
            {predPts.length > 0 && <polyline points={[[px(today), py(railM[today])], ...predPts].map((p) => p.join(',')).join(' ')} className="dl4s-loop__pred" />}
            {predPts.map(([x, y], i) => (
              <g key={`p${i}`} className={`dl4s-loop__x${i >= 7 && pred === 'naive' ? ' dl4s-loop__x--echo' : ''}`}>
                <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} />
                <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4} />
              </g>
            ))}
            <g className="dl4s-loop__legend">
              <circle cx={70} cy={14} r={3} className="dl4s-loop__dot" /><text x={80} y={17} className="dl4s-svg__label">True</text>
              <line x1={126} y1={10} x2={134} y2={18} className="dl4s-loop__x" /><line x1={134} y1={10} x2={126} y2={18} className="dl4s-loop__x" />
              <text x={140} y={17} className="dl4s-svg__label">Predictions (stand-in)</text>
            </g>
          </svg>
        </div>
        <Code code={LOOP_CODE} label="forecast_14_steps.py" meta="slide 34" hl={hl} />
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k={`round ${Math.max(1, k)} · y_pred_one`} v={k ? fmtInt(run.preds[k - 1] * 1e6) : '—'} sub={k ? `true value ${fmtInt(run.truth[k - 1] * 1e6)} on ${isoAt(R.start, today + k)}` : 'press step'} />
        <Stat k="this stand-in’s MAE over the 14 days" v={k >= AHEAD ? fmtInt(run.mae) : '…'} sub="this page’s run on one 14-day forecast — not a validation MAE, so not comparable with 30,734" />
        <Stat k="slide 34 (univar_model)" v="30,734" tone="accent" sub="validation MAE of the looped forecasts" />
      </div>
      <p className="dl4s-cap">
        The loop is slide 34’s; the predictor is a stand-in, because univar_model’s trained weights aren’t on the slides — the slide-18 copy, or this page’s
        57-parameter linear model (it reads the last 56 values of the growing X). Either way, each prediction becomes the next round’s input.
      </p>
    </Lab>
  );
}

/* ── §11 · split_inputs_and_targets on the real df_mulvar ────────────────── */
export function AheadSplitLab() {
  const [start, setStart] = useState(0);
  const [ahead, setAhead] = useState(AHEAD);
  const [targetCol, setTargetCol] = useState(1);
  const train = useMemo(() => {
    const [a, b] = monthRange(R.start, SPLITS.train.from, SPLITS.train.to);
    const rows = [];
    for (let i = a; i <= b; i++) {
      const next = i + 1 < R.length ? R.dayType[i + 1] : R.dayTypeAfterEnd;
      rows.push([busM[i], railM[i], ...DT.map((t) => (t === next ? 1 : 0))]);
    }
    return { a, rows };
  }, []);
  const len = SEQ + ahead;
  const ds = useMemo(() => timeseriesDataset(train.rows, null, { sequence_length: len, batch_size: 32 }), [train, len]);
  const nWin = ds.windows.length;
  const s0 = Math.min(start, nWin - 1);
  const win = ds.windows[s0].x;
  const lastBatch = nWin - (ds.batches.length - 1) * 32;
  const isSlide = ahead === AHEAD && targetCol === 1;
  const d0 = isoAt(R.start, train.a + s0);

  // the window as a heat grid: columns = days, rows = the 5 features
  const W = 660;
  const cw = (W - 120) / len;
  const ch = 18;
  const gy = 30;
  const cx = (d) => 100 + d * cw;

  return (
    <Lab
      title="Slides 35–38 · one 70-day window, split into inputs and targets"
      slides="slides 35–38"
      tryThis="before changing target_col to 0, predict which cells become the targets; then set ahead to 7 and predict the batch shapes and the number of batches — notice the window shrinks to 63 days."
    >
      <div className="dl-lab__controls">
        <Chips label="target_col" value={targetCol} options={[{ v: 0, l: '0 · bus' }, { v: 1, l: '1 · rail (slide 35)' }]} onChange={setTargetCol} code />
        <div className="dl-sliders">
          <Range label="ahead" value={ahead} min={1} max={28} onChange={setAhead} fmt={(v) => `${v}${v === AHEAD ? ' (slide 35)' : ''}`} />
          <Range label="window" value={s0} min={0} max={nWin - 1} onChange={setStart} fmt={() => `${d0} → ${isoAt(R.start, train.a + s0 + len - 1)}`} width="20rem" />
        </div>
      </div>
      <div className="dl4s-wide">
        <svg viewBox={`0 0 ${W} ${gy + 5 * ch + 54}`} className="dl4s-svg dl4s-ahead" role="img" aria-label={`One ${len}-day window of mulvar_train: days 0 to ${SEQ - 1} of all five columns are the inputs; the ${MULVAR_COLUMNS[targetCol]} column of days ${SEQ} to ${len - 1} is the target`}>
          {MULVAR_COLUMNS.map((c, r) => (
            <text key={c} x={94} y={gy + r * ch + 13} textAnchor="end" className={`dl4s-tick${r === targetCol ? ' dl4s-ahead__tcol' : ''}`}>{c}</text>
          ))}
          {win.map((row, d) => row.map((v, r) => {
            const isIn = d < SEQ;
            const isT = !isIn && r === targetCol;
            return (
              <rect key={`${d}.${r}`} x={cx(d)} y={gy + r * ch} width={cw - 0.6} height={ch - 1} className={`dl4s-ahead__cell${isIn ? ' dl4s-ahead__cell--in' : isT ? ' dl4s-ahead__cell--t' : ' dl4s-ahead__cell--off'}`} style={{ '--v': r < 2 ? Math.min(1, v) : v }}>
                <title>{`day ${d} (${isoAt(R.start, train.a + s0 + d)}), ${MULVAR_COLUMNS[r]} = ${r < 2 ? v.toFixed(3) : v}`}</title>
              </rect>
            );
          }))}
          <rect x={cx(0) - 1.5} y={gy - 2} width={cx(SEQ) - cx(0) + 1} height={5 * ch + 2} className="dl4s-ahead__box dl4s-ahead__box--in" />
          <rect x={cx(SEQ) - 1.5} y={gy + targetCol * ch - 2} width={cx(len) - cx(SEQ) + 1} height={ch + 2} className="dl4s-ahead__box dl4s-ahead__box--t" />
          <text x={cx(SEQ / 2)} y={gy + 5 * ch + 18} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">inputs: days 0–{SEQ - 1}, all 5 columns → ({SEQ}, 5)</text>
          <text x={W - 4} y={gy + 5 * ch + 36} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--y">targets: days {SEQ}–{len - 1}, column {targetCol} → ({ahead},)</text>
          <text x={cx(0)} y={16} className="dl4s-tick">day 0 = {d0}</text>
          <text x={cx(len)} y={16} textAnchor="end" className="dl4s-tick">day {len - 1}</text>
        </svg>
      </div>
      <div className="dl4s-wide">
        <svg viewBox={`0 0 ${W} 170`} className="dl4s-svg dl4s-ahead__plot" role="img" aria-label={`Slide 37's view of this window: bus and rail inputs for days 0 to ${SEQ - 1}, and the ${MULVAR_COLUMNS[targetCol]} targets for days ${SEQ} to ${len - 1}`}>
          {(() => {
            const vals = win.flatMap((r) => [r[0], r[1]]);
            const hi = Math.max(...vals) * 1.04;
            const lo = Math.min(...vals) * 0.94;
            const px = (d) => 56 + (d / (len - 1)) * (W - 76);
            const py = (v) => 34 + ((hi - v) / (hi - lo)) * 102;
            const yTicks = [0.2, 0.4, 0.6, 0.8, 1, 1.2].filter((v) => v >= lo && v <= hi);
            const line = (pts) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${px(d).toFixed(1)} ${py(v).toFixed(1)}`).join('');
            const bus = win.slice(0, SEQ).map((r, d) => [d, r[0]]);
            const rail = win.slice(0, SEQ).map((r, d) => [d, r[1]]);
            const out = win.slice(SEQ).map((r, i) => [SEQ + i, r[targetCol]]);
            return (
              <g>
                {[0, 10, 20, 30, 40, 50, 60, 70].filter((d) => d < len).map((d) => (
                  <g key={d}>
                    <line x1={px(d)} y1={34} x2={px(d)} y2={136} className="dl4s-ahead__grid" />
                    <text x={px(d)} y={150} textAnchor="middle" className="dl4s-tick">{d}</text>
                  </g>
                ))}
                <text x={W - 20} y={164} textAnchor="end" className="dl4s-tick">Day</text>
                <text x={8} y={18} className="dl4s-tick">÷ 1e6</text>
                {yTicks.map((v) => <text key={v} x={48} y={py(v) + 3} textAnchor="end" className="dl4s-tick">{v.toFixed(1)}</text>)}
                <path d={line(bus)} className="dl4s-ahead__l dl4s-ahead__l--bus" />
                <path d={line(rail)} className="dl4s-ahead__l dl4s-ahead__l--rail" />
                <path d={line(out)} className="dl4s-ahead__l dl4s-ahead__l--out" />
                {out.map(([d, v]) => <circle key={d} cx={px(d)} cy={py(v)} r={2} className="dl4s-ahead__dot" />)}
                <g className="dl4s-ahead__legend">
                  <line x1={64} y1={15} x2={78} y2={15} className="dl4s-ahead__l dl4s-ahead__l--bus" /><text x={82} y={18} className="dl4s-tick">bus (input)</text>
                  <line x1={150} y1={15} x2={164} y2={15} className="dl4s-ahead__l dl4s-ahead__l--rail" /><text x={168} y={18} className="dl4s-tick">rail (input)</text>
                  <line x1={240} y1={15} x2={254} y2={15} className="dl4s-ahead__l dl4s-ahead__l--out" /><text x={258} y={18} className="dl4s-tick">{MULVAR_COLUMNS[targetCol]} (output)</text>
                </g>
              </g>
            );
          })()}
        </svg>
      </div>
      <p className="dl4s-cap">Slide 37’s picture of one window: bus and rail inputs for days 0–{SEQ - 1}, then the {ahead} target values. This page’s window, not the slide’s shuffled batch.</p>
      <div className="dl4s-ahead__codes">
        <Code code={AHEAD_DS_CODE} label="ahead_datasets.py" meta="slide 35" hl={[1, 2, 7, 8]} />
        <Code code={AHEAD_MODEL_CODE} label="ahead_model.py" meta="slide 38" hl={[4]} />
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="windows in mulvar_train" v={fmtInt(nWin)} sub={`1,096 days − ${len} + 1 (this page’s count)`} />
        <Stat k="batches of 32" v={ds.batches.length} tone="accent" sub={isSlide ? `= slide 36’s “Number of batches in ahead_train_ds = 33” (last batch ${lastBatch})` : `the last batch holds ${lastBatch}`} />
        <Stat k="one batch" v={`(32, ${SEQ}, 5) · (32, ${ahead})`} sub={isSlide ? 'as slide 36 prints: (32, 56, 5) and (32, 14)' : 'inputs · targets'} />
        <Stat k="ahead_model’s output layer" v={`Dense(${ahead})`} sub={`one output per day ahead → (None, ${ahead}); validation MAE (slide 38): 33,887`} />
      </div>
      <p className="dl4s-cap">
        Rebuilt from the real data as slide 30 does (bus, rail ÷ 1e6; tomorrow’s day type one-hot), training period 2016-01 → 2018-12. The window slider walks
        the windows in time order; <code>ahead_train_ds</code> is shuffled (seed 42), so its first batch on slide 37 holds different windows.
      </p>
    </Lab>
  );
}
