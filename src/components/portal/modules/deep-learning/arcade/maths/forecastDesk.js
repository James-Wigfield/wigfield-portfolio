/* ============================================================================
   FORECAST DESK — MATHS + ROUND GENERATOR (pure, seeded; Lecture 4 15–39)
   ----------------------------------------------------------------------------
   The series: lecture8-study/data/busrail.js holds four 70-day validation
   windows of the lecture's CTA data (raw daily boardings). Stitched, they
   cover 2019-01-01 … 2019-05-31 without a gap (validSeries), and their
   7-day differences over 2019-03 … 2019-05 reproduce slide 18's printed
   MAE and MAPE exactly (tools/dl-arcade/check-forecast-desk.mjs).

   The arithmetic is lecture4-study/rnn.js (imported, never edited):
   timeseriesDataset (the tf.keras.utils.timeseries_dataset_from_array port,
   slide 19), diff (pandas .diff), mae and mape (slide 18). Every model
   number is a printed slide number from content/lecture4.js ANCHORS; this
   file trains nothing.

     makeItems(rand, level)   the round: ROUND_SIZE items, one per PLAN slot
     validSeries()            { start, bus[], rail[] } (raw boardings)
     calendarItem(…)          level 1's day-picking and hand-worked items
     toyDataset(n, L, B)      slide 19's call with my_series = [0 … n−1]
     boardRows(level)         the leaderboard rows with their printed MAEs
   No React, no DOM.
   ========================================================================== */
import { timeseriesDataset, diff, shift, mae, mape, isoAt, dayIndex } from '../../lecture4-study/rnn.js';
import { BIRNN, RUN } from '../../lecture8-study/data/busrail.js';
import { ANCHORS } from '../content/lecture4.js';
import {
  COPY, SERIES, CALENDAR, TOY, WINDOW, AHEAD, TABLE30, BOARD, STRATEGIES, STRATEGY_DISTRACTOR, STRATEGY_Q, QUESTIONS, PLAN, SPLITS,
} from '../content/forecast-desk.js';

export const ROUND_SIZE = 8;
export { COPY, TABLE30, STRATEGIES, SPLITS, BOARD };

/* ── formatting ───────────────────────────────────────────────────────── */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return { wd: d.getUTCDay(), day: d.getUTCDate(), mon: d.getUTCMonth() };
};
export const dayLabel = (iso) => {
  const p = parts(iso);
  return `${WD[p.wd]} ${p.day} ${MON[p.mon]}`;
};
export const monthLabel = (iso) => MON[parts(iso).mon];
// Monday-first column, 0 … 6
export const colOf = (iso) => (parts(iso).wd + 6) % 7;
export const WEEK_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const fmtInt = (v) => Math.round(v).toLocaleString('en-AU');
export const fmtSigned = (v) => (v < 0 ? `−${fmtInt(-v)}` : fmtInt(v));
export const fmtShape = (a) => `(${a.join(', ')}${a.length === 1 ? ',' : ''})`;
export const round = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;
export const kilo = (v) => Math.round(v / 1000);
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
const L4 = (...slides) => ({ lecture: 4, slides: [...new Set(slides)].sort((a, b) => a - b) });

/* ── the series (stitched, cached) ────────────────────────────────────── */
export function stitch(windows = BIRNN.windows, start = RUN.validStart) {
  const rows = [];
  let conflicts = 0;
  windows.forEach((w) => {
    const at = dayIndex(start, w.start);
    [...w.input, ...w.truth].forEach((v, i) => {
      const t = at + i;
      if (rows[t] && (rows[t][0] !== v[0] || rows[t][1] !== v[1])) conflicts += 1;
      rows[t] = v;
    });
  });
  const holes = Array.from({ length: rows.length }, (_, i) => i).filter((i) => !rows[i]).length;
  return { start, bus: rows.map((r) => r?.[0] ?? NaN), rail: rows.map((r) => r?.[1] ?? NaN), conflicts, holes };
}
let cache = null;
export function validSeries() {
  if (!cache) cache = stitch();
  return cache;
}
// slide 18's numbers from the stitched copy: diff_7 over the period, MAE and MAPE
export function slide18(series = validSeries(), period = SERIES.period) {
  const a = dayIndex(series.start, `${period[0]}-01`);
  const [y, m] = period[1].split('-').map(Number);
  const b = dayIndex(series.start, `${period[1]}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`);
  const out = {};
  ['bus', 'rail'].forEach((k) => {
    const d = diff(series[k], 7).slice(a, b + 1);
    const tg = series[k].slice(a, b + 1);
    out[k] = { mae: mae(d), mape: mape(d, tg), days: tg.length };
  });
  return { ...out, from: a, to: b };
}

// Figure 15-7's two panels from the stitched copy: rail with its 7-day lag
// (df.shift(7)), and diff_7 for bus and rail, over slide 17's period
let fig = null;
export function baselineFigure() {
  if (fig) return fig;
  const S = validSeries();
  const { from, to } = slide18(S);
  const cut = (a) => a.slice(from, to + 1);
  fig = {
    dates: Array.from({ length: to - from + 1 }, (_, i) => isoAt(S.start, from + i)),
    rail: cut(S.rail), railLag: cut(shift(S.rail, 7)), bus: cut(S.bus),
    diffRail: cut(diff(S.rail, 7)), diffBus: cut(diff(S.bus, 7)),
  };
  return fig;
}

/* ── anchors (printed slide numbers) ──────────────────────────────────── */
const ANCHOR = Object.fromEntries(ANCHORS.map((a) => [a.id, a]));
export const anchorValue = (id) => ANCHOR[id]?.value;
export const BASELINE_MAE = anchorValue(BOARD.baseline.anchor); // 42143.271739 (slide 18)
export function boardRows(level) {
  return BOARD.rows.filter((r) => r.level === level).map((r) => {
    const value = anchorValue(r.anchor);
    return { ...r, value, label: `${r.bound ? '> ' : ''}${fmtInt(value)}`, slide: r.src.slides[0], beats: !r.bound && value < BASELINE_MAE };
  });
}
export const baselineRow = () => ({ ...BOARD.baseline, value: BASELINE_MAE, label: fmtInt(BASELINE_MAE) });

/* ── ids, choices ─────────────────────────────────────────────────────── */
let counter = 0;
const nid = (level, key) => `fd${level}-${++counter}-${key}`;

function choiceItem(level, tpl, q, rand, extra = {}) {
  const vars = extra.vars ?? {};
  const choices = rand.shuffle(q.choices.map((c) => ({ value: c.value, label: fill(c.label, vars) })));
  const answer = extra.answer ?? q.choices.find((c) => c.correct).value;
  const prompt = fill(q.prompt, vars);
  return {
    id: nid(level, tpl), tpl, level, concept: extra.concept ?? q.concept, src: extra.src ?? q.src, kind: 'choice',
    prompt, promptText: prompt, choices, answer, why: fill(extra.why ?? q.why, vars), scene: extra.scene ?? { type: 'none' },
    ...(extra.maths ? { maths: extra.maths } : {}),
  };
}

/* ── level 1: the calendar ────────────────────────────────────────────── */
// The slide-17 period's day indices (targets fall inside it; their lags and
// the calendar's earlier rows are always inside the stitched series).
function periodRange(series = validSeries()) {
  const s = slide18(series);
  return [s.from, s.to];
}

// 3 rows (Mon–Sun): the target week and the two before it. `targets` are
// day indices inside one week; cells after the last target are future.
export function calendarScene(targets, { hideTarget = false } = {}, series = validSeries()) {
  const first = targets[0];
  const last = targets[targets.length - 1];
  const mon = first - colOf(isoAt(series.start, first));
  const top = mon - 14;
  const lags = targets.map((t) => t - 7);
  const peak = Math.max(...series.rail.slice(top, mon + 7).filter(Number.isFinite));
  const rows = [0, 1, 2].map((r) => {
    const startIdx = top + 7 * r;
    return {
      head: `${monthLabel(isoAt(series.start, startIdx))} ${parts(isoAt(series.start, startIdx)).day}`,
      cells: Array.from({ length: 7 }, (_, c) => {
        const idx = startIdx + c;
        const iso = isoAt(series.start, idx);
        const future = idx > last;
        const isTarget = targets.includes(idx);
        const hidden = future || (hideTarget && isTarget);
        return {
          idx, iso, day: parts(iso).day, label: dayLabel(iso),
          value: hidden ? null : kilo(series.rail[idx]),
          h: hidden ? 0 : series.rail[idx] / peak,
          role: isTarget ? 'target' : lags.includes(idx) && !hideTarget ? 'lag' : null,
          future,
        };
      }),
    };
  });
  return { type: 'calendar', rows, targets, lags, pick: hideTarget };
}

function pickTargets(rand, n, used) {
  const [a, b] = periodRange();
  for (let tries = 0; tries < 200; tries++) {
    const t0 = rand.int(a, b - n + 1);
    const col = colOf(isoAt(validSeries().start, t0));
    if (col + n > 7) continue; // keep the n targets inside one Mon–Sun row
    const ts = Array.from({ length: n }, (_, i) => t0 + i);
    if (ts.some((t) => used.has(t))) continue;
    ts.forEach((t) => used.add(t));
    return ts;
  }
  const t0 = a + 7 - colOf(isoAt(validSeries().start, a)); // a Monday inside the period
  return Array.from({ length: n }, (_, i) => t0 + i);
}

export function calendarItem(level, tpl, rand, used) {
  const S = validSeries();
  const q = CALENDAR[tpl];
  const nDays = tpl === 'maeHand' ? rand.pick(CALENDAR.days.mae) : tpl === 'mapeHand' ? rand.pick(CALENDAR.days.mape) : 1;
  const targets = pickTargets(rand, nDays, used);
  const k = (i) => kilo(S.rail[i]);
  const t = targets[0];
  const base = { id: nid(level, tpl), tpl, level, concept: q.concept, src: q.src };
  if (tpl === 'copyDay') {
    const lagIso = isoAt(S.start, t - 7);
    const vars = { day: dayLabel(isoAt(S.start, t)), lag: dayLabel(lagIso), yday: dayLabel(isoAt(S.start, t - 1)) };
    return {
      ...base, kind: 'custom', answer: lagIso,
      check: (g) => g === lagIso,
      format: (v) => (typeof v === 'string' ? dayLabel(v) : '—'),
      prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), sub: q.sub, why: fill(q.why, vars),
      scene: calendarScene(targets, { hideTarget: true }),
      maths: maeMaths(false),
    };
  }
  if (tpl === 'diff7') {
    const d = k(t) - k(t - 7);
    const vars = { day: dayLabel(isoAt(S.start, t)), yt: fmtInt(k(t)), ylag: fmtInt(k(t - 7)), d: fmtSigned(d) };
    return {
      ...base, kind: 'number', answer: d, negative: true, unit: COPY.unitThousand,
      prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars),
      scene: calendarScene(targets), maths: maeMaths(false),
    };
  }
  // the hand-worked MAE / MAPE: displayed (rounded) thousands, exactly as shown
  const ys = targets.map(k);
  const lagsK = targets.map((i) => k(i - 7));
  // diff_7 through the pandas port, on the displayed numbers: the span runs
  // from the first lag to the last target, so diff(span, 7)[7 + j] = y − y(t−7)
  const span = Array.from({ length: targets.length + 7 }, (_, i) => k(t - 7 + i));
  const errs = diff(span, 7).slice(7);
  const table = targets.map((i, j) => ({ iso: isoAt(S.start, i), label: dayLabel(isoAt(S.start, i)), y: ys[j], lag: lagsK[j] }));
  if (tpl === 'maeHand') {
    const ans = mae(errs);
    const vars = { n: targets.length, abs: errs.map((e) => fmtInt(Math.abs(e))).join(' + '), mae: String(round(ans, 2)) };
    return {
      ...base, kind: 'number', answer: round(ans, 4), tol: CALENDAR.tol.mae, decimal: true, unit: COPY.unitThousand,
      prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars),
      scene: { ...calendarScene(targets), table }, maths: maeMaths(true),
    };
  }
  const ans = mape(errs, ys);
  const vars = {
    n: targets.length,
    terms: errs.map((e, j) => `|${fmtSigned(e)}| / ${fmtInt(ys[j])}`).join(' + '),
    mape: String(round(ans, 4)),
  };
  return {
    ...base, kind: 'number', answer: round(ans, 6), tol: CALENDAR.tol.mape, decimal: true,
    prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars),
    scene: { ...calendarScene(targets), table }, maths: maeMaths(true),
  };
}

// the drawer: slide 18's definitions, never the item's answer
function maeMaths(withMape) {
  return { eq: withMape ? ['forecast.mae', 'forecast.mape'] : ['forecast.mae'], lines: [COPY.drawerMae] };
}

/* ── level 2: slide 19's toy ──────────────────────────────────────────── */
export function toyDataset(n, L, B) {
  const series = Array.from({ length: n }, (_, i) => i);
  const ds = timeseriesDataset(series, series.slice(L), { sequence_length: L, batch_size: B });
  return { series, L, B, ...ds };
}
function toyPick(rand, needBatches) {
  if (rand.next() < 0.5) {
    const { n, L, B } = TOY.slide;
    return { ...toyDataset(n, L, B), slide: true };
  }
  for (let tries = 0; tries < 100; tries++) {
    const n = rand.pick(TOY.variants.n);
    const L = rand.pick(TOY.variants.L);
    const B = rand.pick(TOY.variants.B);
    const ds = toyDataset(n, L, B);
    if (ds.windows.length < 2) continue;
    if (needBatches && ds.batches.length < 2) continue;
    if (n === TOY.slide.n && L === TOY.slide.L && B === TOY.slide.B) continue;
    return { ...ds, slide: false };
  }
  return { ...toyDataset(TOY.slide.n, TOY.slide.L, TOY.slide.B), slide: true };
}
const toyCode = (ds) => [
  `my_series = [${ds.series.join(', ')}]`,
  'my_dataset = tf.keras.utils.timeseries_dataset_from_array(',
  '    my_series,',
  `    targets=my_series[${ds.L}:],`,
  `    sequence_length=${ds.L},`,
  `    batch_size=${ds.B}`,
  ')',
];
function toyItem(level, tpl, rand) {
  const ds = toyPick(rand, tpl === 'toyBatchX' || tpl === 'toyBatchY');
  const sub = ds.slide ? TOY.slideSub : TOY.variantSub;
  const count = ds.windows.length;
  const scene = { type: 'toy', series: ds.series, L: ds.L, B: ds.B, code: toyCode(ds), windows: ds.windows.map((w) => ({ x: w.x, y: w.y })), batches: ds.batches.map((b) => b.length) };
  const maths = { lines: [COPY.drawerWindow], code: toyCode(toyDataset(TOY.slide.n, TOY.slide.L, TOY.slide.B)) };
  const base = { id: nid(level, tpl), tpl, level, sub, maths };
  if (tpl === 'toyTarget') {
    const q = TOY.target;
    const p = rand.int(0, count - 1);
    const w = ds.windows[p];
    const vars = { w: w.x.join(', '), L: ds.L, y: w.y };
    return { ...base, concept: q.concept, src: q.src, kind: 'number', answer: w.y, prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars), scene: { ...scene, focus: p } };
  }
  if (tpl === 'toyCount') {
    const q = TOY.count;
    const vars = { n: ds.series.length, L: ds.L, fit: ds.series.length - ds.L + 1, count };
    return { ...base, concept: q.concept, src: q.src, kind: 'number', answer: count, prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars), scene };
  }
  if (tpl === 'toyBatchX' || tpl === 'toyBatchY') {
    const q = tpl === 'toyBatchX' ? TOY.batchX : TOY.batchY;
    // the last batch half the time (it may be short, as on slide 19)
    const kb = rand.next() < 0.5 ? ds.batches.length - 1 : rand.int(0, ds.batches.length - 1);
    const size = ds.batches[kb].length;
    const vars = { k: kb, count, B: ds.B, size, L: ds.L };
    const answer = tpl === 'toyBatchX' ? [size, ds.L] : [size];
    return {
      ...base, concept: q.concept, src: q.src, kind: 'shape', answer, labels: tpl === 'toyBatchX' ? ['batch', 'steps'] : ['batch'],
      prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars), scene: { ...scene, batch: kb }, format: (v) => (Array.isArray(v) ? fmtShape(v) : '—'),
    };
  }
  // toyMissing
  const q = TOY.missing;
  const lastWin = ds.series.slice(ds.series.length - ds.L);
  const vars = { last: lastWin.join(', '), L: ds.L, B: ds.B, n: ds.series.length, count };
  return { ...choiceItem(level, tpl, q, rand, { vars, scene: { ...scene, missing: lastWin } }), sub, maths };
}

/* ── level 2: the 56-day windows ──────────────────────────────────────── */
function windowScene(rand, reveal) {
  const S = validSeries();
  const L = WINDOW.seqLength;
  const at = rand.int(0, S.rail.length - L - 1);
  return { type: 'window', values: S.rail.slice(at, at + L + 1).map((v) => round(v / 1e6, 6)), from: isoAt(S.start, at), L, reveal };
}
function windowItem(level, tpl, rand) {
  const base = { id: nid(level, tpl), tpl, level };
  if (tpl === 'rule56' || tpl === 'rule55') {
    const q = WINDOW[tpl];
    return { ...base, concept: q.concept, src: q.src, kind: 'number', answer: tpl === 'rule56' ? 56 : 55, prompt: q.prompt, promptText: q.prompt, why: q.why, scene: windowScene(rand, tpl === 'rule56' ? 'target' : 'input') };
  }
  if (tpl === 'input3d') {
    const q = WINDOW.input3d;
    return {
      ...base, concept: q.concept, src: q.src, kind: 'shape', answer: [WINDOW.batchSize, WINDOW.seqLength, 1], labels: ['batch', 'steps', 'dims'],
      prompt: q.prompt, promptText: q.prompt, why: q.why, scene: windowScene(rand, 'all'), format: (v) => (Array.isArray(v) ? fmtShape(v) : '—'),
      maths: { lines: [COPY.drawerShapes] },
    };
  }
  const q = WINDOW[tpl];
  const B = rand.next() < 0.5 ? WINDOW.batchSize : rand.pick(WINDOW.batchVariants);
  const L = WINDOW.seqLength;
  const vars = { B, L };
  const answer = tpl === 'shapeX' ? [B, L] : [B];
  return {
    ...base, concept: q.concept, src: q.src, kind: 'shape', answer, labels: tpl === 'shapeX' ? ['batch', 'steps'] : ['batch'],
    prompt: fill(q.prompt, vars), promptText: fill(q.prompt, vars), why: fill(q.why, vars), scene: windowScene(rand, 'all'),
    format: (v) => (Array.isArray(v) ? fmtShape(v) : '—'), maths: { lines: [COPY.drawerShapes] },
  };
}

/* ── level 3: ahead_model's windows ───────────────────────────────────── */
function aheadScene(rand) {
  const S = validSeries();
  const len = WINDOW.seqLength + AHEAD.ahead;
  const at = rand.int(0, S.rail.length - len); // 82 possible windows in 151 days
  return {
    type: 'ahead', from: isoAt(S.start, at), split: WINDOW.seqLength,
    bus: S.bus.slice(at, at + len).map((v) => round(v / 1e6, 6)),
    rail: S.rail.slice(at, at + len).map((v) => round(v / 1e6, 6)),
  };
}
function aheadItem(level, tpl, rand) {
  const key = { aheadX: 'x', aheadY: 'y', predict: 'predict', aheadLen: 'len', mulvarShape: 'mulvar' }[tpl];
  const q = AHEAD[key];
  const base = { id: nid(level, tpl), tpl, level, concept: q.concept, src: q.src, prompt: q.prompt, promptText: q.prompt, why: q.why };
  if (tpl === 'aheadLen') return { ...base, kind: 'number', answer: WINDOW.seqLength + AHEAD.ahead, scene: aheadScene(rand) };
  const answer = {
    aheadX: [WINDOW.batchSize, WINDOW.seqLength, 5],
    aheadY: [WINDOW.batchSize, AHEAD.ahead],
    predict: [1, AHEAD.ahead],
    mulvarShape: [WINDOW.batchSize, WINDOW.seqLength, TABLE30.columns.length],
  }[tpl];
  const labels = answer.length === 3 ? ['batch', 'steps', 'dims'] : ['batch', 'ahead'];
  return {
    ...base, kind: 'shape', answer, labels, format: (v) => (Array.isArray(v) ? fmtShape(v) : '—'),
    scene: tpl === 'mulvarShape' ? { type: 'table30', highlight: 'inputs' } : aheadScene(rand),
    maths: { lines: [COPY.drawerShapes] },
  };
}

/* ── the leaderboard ──────────────────────────────────────────────────── */
function boardItem(level, rand) {
  const rows = boardRows(level);
  const row = rand.pick(rows);
  const mode = rand.next() < 0.5 ? 'nameOf' : 'valueOf';
  const t = BOARD[mode];
  const vars = { value: row.label, name: row.name, code: row.code, slide: row.slide };
  const choices = rand.shuffle(rows.map((r) => ({ value: r.id, label: mode === 'nameOf' ? r.name : r.label, sub: mode === 'nameOf' ? r.code : undefined })));
  const prompt = fill(t.prompt, vars);
  const why = fill(t.why, vars) + (row.id === 'multask' ? BOARD.multaskNote : '');
  return {
    id: nid(level, `board-${mode}`), tpl: 'board', mode, level, concept: row.concept, src: L4(18, row.slide), kind: 'choice',
    prompt, promptText: prompt, choices, answer: row.id, why,
    scene: { type: 'board', rows: rows.map((r) => ({ id: r.id, name: r.name, code: r.code, value: r.value, label: r.label, bound: r.bound ?? null })), baseline: baselineRow(), ask: row.id, mode },
  };
}
const boardScene = (level) => ({ type: 'board', rows: boardRows(level).map((r) => ({ id: r.id, name: r.name, code: r.code, value: r.value, label: r.label, bound: r.bound ?? null })), baseline: baselineRow(), ask: null, mode: 'hidden' });

/* ── the strategy picture ─────────────────────────────────────────────── */
function strategyItem(level, rand) {
  const s = rand.pick(STRATEGIES);
  const choices = rand.shuffle([...STRATEGIES, STRATEGY_DISTRACTOR].map((c) => ({ value: c.id, label: c.label })));
  return {
    id: nid(level, 'strategy'), tpl: 'strategy', level, concept: STRATEGY_Q.concept, src: s.src, kind: 'choice',
    prompt: STRATEGY_Q.prompt, promptText: STRATEGY_Q.prompt, choices, answer: s.id, why: s.why,
    scene: { type: 'strategy', id: s.id },
  };
}

/* ── one slot → one item ──────────────────────────────────────────────── */
const sceneRow = (r) => ({ id: r.id, name: r.name, code: r.code, value: r.value, label: r.label, bound: r.bound ?? null });
function sceneFor(tpl, level, rand) {
  if (['naiveDef', 'whyWeekly', 'whichBaseline', 'busVsRail', 'anchorMaeRail', 'anchorMaeBus', 'anchorMapeRail'].includes(tpl)) return { type: 'baseline' };
  if (['notBeat', 'bestUnivariate', 'deepWhy', 'rnn1Why'].includes(tpl)) return boardScene(2);
  if (tpl === 'beatWidest') {
    const rows = [...boardRows(2).filter((r) => r.id !== 'rnn1'), ...boardRows(3).filter((r) => r.id === 'mulvar')];
    return { ...boardScene(2), rows: rows.map(sceneRow) };
  }
  if (tpl === 'beatAhead') return { ...boardScene(3), rows: boardRows(3).filter((r) => r.id === 'loop' || r.id === 'ahead').map(sceneRow) };
  if (tpl === 'split' || tpl === 'shuffle') return { type: 'timeline' };
  if (['nextDay', 'target', 'multask', 'targetCol'].includes(tpl)) return { type: 'table30', highlight: tpl === 'nextDay' ? 'nextDay' : tpl === 'targetCol' ? 'index' : 'inputs' };
  if (tpl === 'loopSame') return { type: 'strategy', id: 'loop' };
  if (tpl === 'seq2seq') return { type: 'strategy', id: 'seq2seq' };
  if (tpl === 'aheadWhere') return aheadScene(rand);
  if (tpl === 'returnSeq' || tpl === 'returnSeq3') return { type: 'stack', layers: tpl === 'returnSeq' ? 3 : 2, head: tpl === 'returnSeq' ? 'Dense(1)' : 'Dense(14)' };
  return { type: 'none' };
}

function slotItem(level, tpl, rand, used) {
  if (['copyDay', 'diff7', 'maeHand', 'mapeHand'].includes(tpl)) return calendarItem(level, tpl, rand, used);
  if (tpl.startsWith('toy')) return toyItem(level, tpl, rand);
  if (['rule56', 'rule55', 'shapeX', 'shapeY', 'input3d'].includes(tpl)) return windowItem(level, tpl, rand);
  if (['aheadX', 'aheadY', 'predict', 'aheadLen', 'mulvarShape'].includes(tpl)) return aheadItem(level, tpl, rand);
  if (tpl === 'board') return boardItem(level, rand);
  if (tpl === 'strategy') return strategyItem(level, rand);
  if (tpl === 'columns') {
    const q = AHEAD.columns;
    return { id: nid(level, tpl), tpl, level, concept: q.concept, src: q.src, kind: 'number', answer: TABLE30.columns.length, prompt: q.prompt, promptText: q.prompt, why: q.why, scene: { type: 'table30', highlight: 'none' } };
  }
  const q = QUESTIONS[tpl];
  if (tpl === 'split') {
    const name = rand.pick(q.names);
    return choiceItem(level, tpl, q, rand, { vars: { name }, answer: name, scene: { type: 'timeline' } });
  }
  if (tpl === 'rnn1Why') {
    const r = rand.pick(q.reasons);
    const qq = { ...q, choices: [{ ...r, correct: true }, ...q.choices] };
    return choiceItem(level, tpl, qq, rand, { scene: sceneFor(tpl, level, rand), src: L4(24, ...r.src.slides) });
  }
  return choiceItem(level, tpl, q, rand, { scene: sceneFor(tpl, level, rand) });
}

/* ── the round ────────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1) {
  counter = 0;
  const L = Math.min(3, Math.max(1, level));
  const usedDays = new Set();
  const usedTpl = new Set();
  return PLAN[L].slice(0, ROUND_SIZE).map((slot) => {
    // choice templates are not repeated in a round; calendar items may be
    const fresh = slot.filter((t) => !usedTpl.has(t) || ['copyDay', 'diff7', 'board'].includes(t));
    const tpl = rand.pick(fresh.length ? fresh : slot);
    usedTpl.add(tpl);
    return slotItem(L, tpl, rand, usedDays);
  });
}
