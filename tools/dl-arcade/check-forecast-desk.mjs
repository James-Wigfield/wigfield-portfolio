#!/usr/bin/env node
/* check-forecast-desk.mjs — Forecast Desk (Lecture 4, slides 15–39) fidelity and round checks.

   1. FIDELITY against the slides:
      - the stitched series (lecture8-study/data/busrail.js, the page's copy of
        the lecture data) has no gap or conflict and matches the other copy
        (lecture4-study/data/ridership.js) day for day;
      - slide 18: its diff_7 MAE and MAPE over 2019-03 … 2019-05 reproduce the
        printed bus 43915.608696 / rail 42143.271739 and 0.082938 / 0.089948;
      - slide 18's definitions on a hand-worked example (arithmetic below);
      - slide 19's toy through the timeseries_dataset_from_array port: the
        printed windows, targets and batch shapes;
      - slides 20–22: windows of 56 days, target = day 56, minibatch shapes
        (32, 56) and (32,) on the real rail_train;
      - slides 35–36, 38: ahead_train_ds on the real mulvar_train gives 33
        batches of x (32, 56, 5) and y (32, 14); predict on [1, 56, 5] → [1, 14];
      - slide 30's printed mulvar_train.head() against the data;
      - the leaderboard: every printed MAE comes from lecture4.js ANCHORS.
   2. ROUNDS: 30 seeded rounds per level. Every item has a unique id, a concept
      in the catalogue (Lecture 4), a src inside slides 15–39, a why and a
      plain promptText; its answer is JSON-serialisable and grades true, a
      mutated answer and a skip grade false; answers are re-derived here from
      the item's own data with independent arithmetic; every TeX renders.

   Run:  node tools/dl-arcade/check-forecast-desk.mjs        (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dl = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning');
const arcade = path.join(dl, 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);
const impDl = (rel) => import(pathToFileURL(path.join(dl, rel)).href);

const M = await imp('maths/forecastDesk.js');
const C = await imp('content/forecast-desk.js');
const L4 = await imp('content/lecture4.js');
const { rng } = await imp('core/rng.js');
const { CONCEPTS } = await imp('core/concepts.js');
const { grade } = await imp('kit/grade.js');
const R = await impDl('lecture4-study/rnn.js');
const { RIDERSHIP, GATES } = await impDl('lecture4-study/data/ridership.js');
const TRAIN_ROWS = R.dayIndex(RIDERSHIP.start, '2019-01-01'); // 2016-01 … 2018-12 = 1096 days
const katex = (await import(pathToFileURL(path.join(root, 'node_modules', 'katex', 'dist', 'katex.mjs')).href)).default;

const failures = [];
let passed = 0;
const fail = (msg) => failures.push(msg);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function expect(name, ok, detail = '') {
  if (ok) passed++;
  else fail(`${name}${detail ? `: ${detail}` : ''}`);
}
const expectNear = (name, got, want, tol = 1e-9) => expect(name, near(got, want, tol), `got ${got}, want ${want}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function texOk(tex, where) {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'error' });
    passed++;
  } catch (e) {
    fail(`${where}: KaTeX "${tex}" → ${e.message.split('\n')[0]}`);
  }
}
const mathIn = (text) => (String(text ?? '').match(/\$[^$]+\$/g) ?? []).map((m) => m.slice(1, -1));
const ANCHOR = Object.fromEntries(L4.ANCHORS.map((a) => [a.id, a]));
const DAY = 86400000;
const addDays = (iso, k) => new Date(Date.parse(`${iso}T00:00:00Z`) + k * DAY).toISOString().slice(0, 10);

/* ── 1a. the series ───────────────────────────────────────────────────── */
const S = M.validSeries();
expect('stitched series: 151 days (2019-01-01 … 2019-05-31)', S.rail.length === 151 && S.bus.length === 151 && S.start === '2019-01-01', S.rail.length);
expect('stitched series: no holes, no conflicting overlaps', S.holes === 0 && S.conflicts === 0, `${S.holes} holes, ${S.conflicts} conflicts`);
{
  // the other copy of the lecture data: 2019-01-01 is day 1096 of 2016-01-01 … (rows.train = 1096)
  const at = R.dayIndex(RIDERSHIP.start, '2019-01-01');
  expect('ridership.js: 2019-01-01 is row 1096 (train = 1096 rows)', at === 1096 && GATES.rows.train === 1096, at);
  const mism = S.rail.map((v, i) => (v === RIDERSHIP.rail[at + i] && S.bus[i] === RIDERSHIP.bus[at + i] ? 0 : 1)).reduce((a, b) => a + b, 0);
  expect('busrail.js stitched == ridership.js for 2019-01 … 2019-05, day for day', mism === 0, `${mism} days differ`);
}

/* ── 1b. slide 18's printed numbers ───────────────────────────────────── */
{
  const s18 = M.slide18();
  expect('slide 18 period is 92 days (2019-03-01 … 2019-05-31)', s18.rail.days === 92 && s18.bus.days === 92);
  // the slide prints 6 decimals: agree to within half a unit of the last place
  expectNear('slide 18 MAE bus 43915.608696', s18.bus.mae, ANCHOR['l4.baseline.maeBus'].value, 5e-7);
  expectNear('slide 18 MAE rail 42143.271739', s18.rail.mae, ANCHOR['l4.baseline.maeRail'].value, 5e-7);
  expectNear('slide 18 MAPE bus 0.082938', s18.bus.mape, ANCHOR['l4.baseline.mapeBus'].value, 5e-7);
  expectNear('slide 18 MAPE rail 0.089948', s18.rail.mape, ANCHOR['l4.baseline.mapeRail'].value, 5e-7);
  expect('slide 18: bus MAE higher than rail, bus MAPE lower', s18.bus.mae > s18.rail.mae && s18.bus.mape < s18.rail.mape);
  expectNear('M.BASELINE_MAE is the printed rail MAE', M.BASELINE_MAE, 42143.271739, 1e-9);
  // Figure 15-7's lag: df.shift(7) at t is y(t−7), and diff_7 = y(t) − y(t−7)
  const F = M.baselineFigure();
  const k = 10;
  expect('baselineFigure: railLag[k] = rail 7 days before', F.railLag[k] === S.rail[s18.from + k - 7]);
  expect('baselineFigure: diffRail = rail − railLag', F.diffRail.every((d, i) => d === F.rail[i] - F.railLag[i]));
}

/* ── 1c. slide 18's definitions by hand ───────────────────────────────── */
{
  // targets y = [700, 720, 300] (thousands), y(t−7) = [690, 730, 250]
  //   diff_7 = y − y(t−7) = [10, −10, 50]
  //   MAE  = (|10| + |−10| + |50|) / 3 = 70 / 3 = 23.333…
  //   MAPE = (10/700 + 10/720 + 50/300) / 3 = (0.0142857 + 0.0138889 + 0.1666667) / 3 = 0.0649471
  const y = [700, 720, 300];
  const lag = [690, 730, 250];
  const span = [...lag, 0, 0, 0, 0, ...y]; // lag days t−7 … then targets t … (diff(7) pairs index i+7 with i)
  const d = R.diff(span, 7).slice(7);
  expect('diff_7 by hand [10, −10, 50]', same(d, [10, -10, 50]), JSON.stringify(d));
  expectNear('slide 18 MAE by hand = 70/3', R.mae(d), 70 / 3, 1e-12);
  expectNear('slide 18 MAPE by hand = 0.0649471', R.mape(d, y), (10 / 700 + 10 / 720 + 50 / 300) / 3, 1e-12);
  expectNear('MAPE is a fraction, 0.0649…, not 6.49', R.mape(d, y), 0.0649471, 1e-7);
}

/* ── 1d. slide 19's toy ───────────────────────────────────────────────── */
{
  const toy = M.toyDataset(6, 3, 2);
  const printed = ANCHOR['l4.window.toy'].value.batches;
  expect('slide 19: three windows [0,1,2]→3, [1,2,3]→4, [2,3,4]→5', same(toy.windows.map((w) => [w.x, w.y]), [[[0, 1, 2], 3], [[1, 2, 3], 4], [[2, 3, 4], 5]]));
  expect('slide 19: batch 0 x/y as printed', same(toy.batches[0].map((w) => w.x), printed[0].x) && same(toy.batches[0].map((w) => w.y), printed[0].y));
  expect('slide 19: batch 1 x/y as printed', same(toy.batches[1].map((w) => w.x), printed[1].x) && same(toy.batches[1].map((w) => w.y), printed[1].y));
  expect('slide 19: batch shapes (2, 3) then (1, 3)', R.batchShape(toy.batches[0]) === '(2, 3)' && R.batchShape(toy.batches[1]) === '(1, 3)');
  expect('slide 19: the window [3, 4, 5] does not come out (no target left)', !toy.windows.some((w) => same(w.x, [3, 4, 5])));
  expect('content TOY.slide is slide 19’s call', same(C.TOY.slide, { n: 6, L: 3, B: 2 }));
}

/* ── 1e. slides 20–22: the 56-day windows on the real rail_train ──────── */
{
  const train = RIDERSHIP.rail.slice(0, TRAIN_ROWS).map((v) => v / 1e6);
  const L = C.WINDOW.seqLength;
  const ds = R.timeseriesDataset(train, train.slice(L), { sequence_length: L, batch_size: C.WINDOW.batchSize });
  expect('slide 20: seq_length 56, batch_size 32', L === 56 && C.WINDOW.batchSize === 32);
  // the port's yIdx indexes `targets` (= rail_train[56:]), so targets[p] is day p + 56 of the series
  expect('slide 22: window 0 = days 0 … 55, target = day 56', same(ds.windows[0].idx, Array.from({ length: 56 }, (_, i) => i)) && ds.windows[0].y === train[56]);
  expect('slide 22: every window’s target is the day after its last input', ds.windows.every((w) => w.y === train[w.idx[w.idx.length - 1] + 1]));
  const printed = ANCHOR['l4.window.shapes'].value;
  expect('slide 21: xx.shape (32, 56)', R.batchShape(ds.batches[0]) === `(${printed.xx.join(', ')})` && R.batchShape(ds.batches[1]) === '(32, 56)');
  expect('slide 21: yy.shape (32,)', ds.batches[0].length === printed.yy[0]);
  expect('slide 20 split in content (2016-01…2018-12 / 2019-01…2019-05 / 2019-06:)', same(C.SPLITS.periods.map((p) => [p.from, p.to]), [['2016-01', '2018-12'], ['2019-01', '2019-05'], ['2019-06', null]]));
}

/* ── 1f. slides 35–36, 38: ahead_train_ds on the real mulvar_train ────── */
{
  // df_mulvar = bus, rail (/1e6) + one-hot next_day_type (A, U, W): 5 columns (slide 30)
  const types = ['A', 'U', 'W'];
  const rows = Array.from({ length: TRAIN_ROWS }, (_, t) => {
    const next = RIDERSHIP.dayType[t + 1];
    return [RIDERSHIP.bus[t] / 1e6, RIDERSHIP.rail[t] / 1e6, ...types.map((c) => (next === c ? 1 : 0))];
  });
  const seq = C.WINDOW.seqLength + C.AHEAD.ahead;
  const ds = R.timeseriesDataset(rows, null, { sequence_length: seq, batch_size: 32 });
  // split_inputs_and_targets(mulvar_series, ahead=14, target_col=1)
  const split = (b) => ({ x: b.map((w) => w.x.slice(0, -C.AHEAD.ahead)), y: b.map((w) => w.x.slice(-C.AHEAD.ahead).map((r) => r[C.AHEAD.targetCol])) });
  const first = split(ds.batches[0]);
  const printed = ANCHOR['l4.ahead.shapes'].value;
  expect('slide 36: 33 batches in ahead_train_ds', ds.batches.length === printed.batches, ds.batches.length);
  expect('slide 36: x.shape (32, 56, 5)', same([first.x.length, first.x[0].length, first.x[0][0].length], printed.x));
  expect('slide 36: y.shape (32, 14)', same([first.y.length, first.y[0].length], printed.y));
  expect('slide 35: target_col=1 is rail', first.y[0][0] === ds.batches[0][0].x[56][1] && first.y[0][0] === RIDERSHIP.rail[56] / 1e6);
  expect('slide 38: predict [1, 56, 5] → [1, 14]', same(ANCHOR['l4.ahead.predictShapes'].value, { X: [1, 56, 5], Y_pred: [1, 14] }));
}

/* ── 1g. slide 30's printed table vs the data ─────────────────────────── */
{
  C.TABLE30.rows.forEach((r) => {
    const t = R.dayIndex(RIDERSHIP.start, r.date);
    const next = RIDERSHIP.dayType[t + 1];
    expectNear(`slide 30 ${r.date} bus`, r.values[0], RIDERSHIP.bus[t] / 1e6, 5e-7);
    expectNear(`slide 30 ${r.date} rail`, r.values[1], RIDERSHIP.rail[t] / 1e6, 5e-7);
    expect(`slide 30 ${r.date} next_day_type one-hot = tomorrow (${next})`, same(r.values.slice(2), ['A', 'U', 'W'].map((c) => (c === next ? 1 : 0))));
  });
  expect('slide 30 columns: bus, rail, next_day_type_A/U/W', same(C.TABLE30.columns, ANCHOR['l4.mulvar.columns'].value));
}

/* ── 1h. the leaderboard ──────────────────────────────────────────────── */
{
  const printed = { linear: 38245, rnn1: 100000, univar: 27703, deep: 29672, mulvar: 22062, multask: 27855, loop: 30734, ahead: 33887 };
  const all = [...M.boardRows(2), ...M.boardRows(3)];
  expect('board: 8 rows (4 per level)', all.length === 8 && M.boardRows(2).length === 4 && M.boardRows(3).length === 4);
  all.forEach((r) => {
    expect(`board ${r.id}: anchor is a printed metric`, ANCHOR[r.anchor]?.kind === 'metric' && !ANCHOR[r.anchor].beyond);
    expect(`board ${r.id}: value ${printed[r.id]}`, r.value === printed[r.id], r.value);
    expect(`board ${r.id}: src slide inside 15–39 and matches the anchor`, r.src.slides.every((s) => s >= 15 && s <= 39) && same(r.src.slides, ANCHOR[r.anchor].src.slides.filter((s) => s <= 39)), JSON.stringify(r.src));
  });
  expect('board: SimpleRNN(1) is a bound, "> 100,000"', all.find((r) => r.id === 'rnn1').label === '> 100,000');
  expect('board: only SimpleRNN(1) fails to beat 42,143', all.filter((r) => !r.beats).map((r) => r.id).join() === 'rnn1');
  const Q = C.QUESTIONS;
  const val = (id) => printed[id];
  const argmin = (ids) => ids.reduce((a, b) => (val(b) < val(a) ? b : a));
  expect('beatWidest answer = lowest printed MAE among its choices', Q.beatWidest.choices.find((c) => c.correct).value === argmin(Q.beatWidest.choices.map((c) => c.value)));
  expect('bestUnivariate answer = lowest printed MAE among its choices', Q.bestUnivariate.choices.find((c) => c.correct).value === argmin(Q.bestUnivariate.choices.map((c) => c.value)));
  expect('notBeat answer is the only one above 42,143', Q.notBeat.choices.filter((c) => val(c.value) > 42143).map((c) => c.value).join() === Q.notBeat.choices.find((c) => c.correct).value);
  expect('beatAhead: looping (30,734) beat ahead_model (33,887)', Q.beatAhead.choices.find((c) => c.correct).value === 'loop' && val('loop') < val('ahead'));
  Object.entries(Q).forEach(([k, q]) => {
    if (q.choices.some((c) => c.correct) || k === 'rnn1Why') {
      const n = q.choices.filter((c) => c.correct).length;
      expect(`QUESTIONS.${k}: exactly one correct choice`, k === 'rnn1Why' ? n === 0 && q.reasons.length === 2 : n === 1, n);
    }
    expect(`QUESTIONS.${k}: src inside slides 15–39`, q.src.lecture === 4 && q.src.slides.every((s) => s >= 15 && s <= 39));
  });
  // the printed anchor labels in the level-1 questions
  expect('anchor choice labels are the printed slide-18 values', ['42143.271739', '43915.608696', '0.089948', '0.082938'].every((l) => Q.anchorMaeRail.choices.some((c) => c.label === l)));
}

/* ── 2. rounds ────────────────────────────────────────────────────────── */
const SLIDES = { lo: 15, hi: 39 };
const counts = {};
let beyond = 0;
let total = 0;
const mutate = (it) => {
  if (it.kind === 'choice') return it.choices.find((c) => c.value !== it.answer).value;
  if (it.kind === 'number') return it.answer + 2 * (it.tol ?? 0) + 1;
  if (it.kind === 'shape') return it.answer.map((v, i) => (i === it.answer.length - 1 ? v + 1 : v));
  if (it.kind === 'custom') return addDays(it.answer, -1);
  return null;
};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = M.makeItems(rng(seed * 7919 + level), level);
    const where0 = `L${level} seed ${seed}`;
    expect(`${where0} has ${M.ROUND_SIZE} items`, items.length === M.ROUND_SIZE, items.length);
    const ids = new Set();
    items.forEach((it, i) => {
      const where = `${where0} #${i} ${it.tpl}`;
      total++;
      counts[it.tpl] = (counts[it.tpl] ?? 0) + 1;
      expect(`${where} unique id`, it.id && !ids.has(it.id), it.id);
      ids.add(it.id);
      expect(`${where} concept in the catalogue (Lecture 4)`, CONCEPTS[it.concept]?.lecture === 4, it.concept);
      expect(`${where} src is Lecture 4, slides 15–39`, it.src?.lecture === 4 && it.src.slides.length > 0 && it.src.slides.every((s) => s >= SLIDES.lo && s <= SLIDES.hi), JSON.stringify(it.src));
      expect(`${where} why`, typeof it.why === 'string' && it.why.length > 20 && !/\{\w+\}/.test(it.why), it.why);
      expect(`${where} prompt + plain promptText`, typeof it.prompt === 'string' && it.prompt.length > 8 && typeof it.promptText === 'string' && !it.promptText.includes('$') && !/\{\w+\}/.test(it.promptText), it.promptText);
      expect(`${where} answer JSON-serialisable`, it.answer !== undefined && same(JSON.parse(JSON.stringify(it.answer)), it.answer));
      expect(`${where} grades its own answer true`, grade(it, it.answer) === true);
      expect(`${where} grades a mutated answer false`, grade(it, mutate(it)) === false, JSON.stringify(mutate(it)));
      expect(`${where} grades a skip (null) false`, grade(it, null) === false);
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        expect(`${where} answer among the choices`, vals.includes(it.answer));
        expect(`${where} choice values unique, 3–4 choices`, new Set(vals.map(String)).size === vals.length && vals.length >= 3 && vals.length <= 4);
        expect(`${where} choice labels plain text, filled`, it.choices.every((c) => typeof c.label === 'string' && !c.label.includes('$') && !/\{\w+\}/.test(c.label)));
      }
      if (it.kind === 'number') {
        expect(`${where} numeric answer finite`, Number.isFinite(it.answer), it.answer);
        expect(`${where} the keypad can type it`, (it.decimal || Number.isInteger(it.answer)) && (it.negative || it.answer >= 0));
        expect(`${where} the answer typed to 4 decimals grades true`, grade(it, Number(it.answer.toFixed(4))) === true);
      }
      if (it.kind === 'shape') {
        expect(`${where} shape of positive integers with labels`, it.answer.every((v) => Number.isInteger(v) && v > 0) && it.labels?.length === it.answer.length);
      }
      if (it.beyond) { beyond++; expect(`${where} beyond has a note`, typeof it.note === 'string' && it.note.length > 10); }
      [it.prompt, it.why].forEach((t) => mathIn(t).forEach((m) => texOk(m, `${where} text`)));
      (it.maths?.eq ?? []).forEach((id) => L4.EQUATIONS[id].tex.forEach((t) => texOk(t, `${where} maths ${id}`)));

      // independent re-derivations from the item's own data
      const sc = it.scene ?? {};
      if (sc.type === 'calendar') {
        const cells = sc.rows.flatMap((r) => r.cells);
        expect(`${where} calendar: 3 rows of 7, Monday first`, sc.rows.length === 3 && sc.rows.every((r) => r.cells.length === 7) && M.colOf(sc.rows[0].cells[0].iso) === 0);
        expect(`${where} calendar: consecutive days`, cells.every((c, j) => j === 0 || c.iso === addDays(cells[j - 1].iso, 1)));
        const tIso = cells.find((c) => c.idx === sc.targets[0]).iso;
        expect(`${where} target inside slide 17's period`, tIso >= '2019-03-01' && tIso <= '2019-05-31', tIso);
        // the 7-day lag sits straight above in the calendar (same column, previous row)
        const pos = (iso) => { const j = cells.findIndex((c) => c.iso === iso); return [Math.floor(j / 7), j % 7]; };
        const [tr, tc] = pos(tIso);
        const [lr, lc] = pos(addDays(tIso, -7));
        expect(`${where} the lag is the cell straight above`, tr === 2 && lr === 1 && lc === tc);
        const kOf = (iso) => Math.round(S.rail[R.dayIndex(S.start, iso)] / 1000);
        if (it.tpl === 'copyDay') {
          expect(`${where} copyDay answer = target − 7 days`, it.answer === addDays(tIso, -7));
          expect(`${where} copyDay: the target cell is hidden`, cells.find((c) => c.iso === tIso).value === null);
          expect(`${where} copyDay: yesterday grades false`, it.check(addDays(tIso, -1)) === false);
        }
        if (it.tpl === 'diff7') expect(`${where} diff_7 = y(t) − y(t−7) (thousands)`, it.answer === kOf(tIso) - kOf(addDays(tIso, -7)));
        if (it.tpl === 'maeHand' || it.tpl === 'mapeHand') {
          const tb = sc.table;
          expect(`${where} table = displayed values`, tb.every((r) => r.y === kOf(r.iso) && r.lag === kOf(addDays(r.iso, -7)) && cells.find((c) => c.iso === r.iso).value === r.y));
          const want = it.tpl === 'maeHand'
            ? tb.reduce((s, r) => s + Math.abs(r.y - r.lag), 0) / tb.length
            : tb.reduce((s, r) => s + Math.abs((r.y - r.lag) / r.y), 0) / tb.length;
          expectNear(`${where} ${it.tpl} by hand (stored to 4 / 6 dp)`, it.answer, want, it.tpl === 'maeHand' ? 5e-5 : 5e-7);
          expect(`${where} ${it.tpl} tolerance as the prompt says`, it.tol === (it.tpl === 'maeHand' ? 0.5 : 0.002));
        }
      }
      if (sc.type === 'toy') {
        const n = sc.series.length;
        const count = n - sc.L;
        expect(`${where} toy: windows = n − L (targets run out)`, sc.windows.length === count);
        if (it.tpl === 'toyTarget') expect(`${where} toy target = window start + L`, it.answer === sc.windows[sc.focus].x[0] + sc.L);
        if (it.tpl === 'toyCount') expect(`${where} toy count`, it.answer === count);
        if (it.tpl === 'toyBatchX' || it.tpl === 'toyBatchY') {
          const size = Math.min(sc.B, count - sc.batch * sc.B);
          expect(`${where} toy batch shape`, same(it.answer, it.tpl === 'toyBatchX' ? [size, sc.L] : [size]));
        }
      }
      if (it.tpl === 'rule56') expect(`${where} day-56 target`, it.answer === 56);
      if (it.tpl === 'rule55') expect(`${where} days 0 … 55`, it.answer === 55);
      if (it.tpl === 'shapeX') expect(`${where} (batch_size, seq_length)`, it.answer[1] === 56 && [16, 32, 64].includes(it.answer[0]) && it.promptText.includes(`batch_size = ${it.answer[0]}`));
      if (it.tpl === 'shapeY') expect(`${where} (batch_size,)`, it.answer.length === 1 && it.promptText.includes(`batch_size = ${it.answer[0]}`));
      if (it.tpl === 'input3d') expect(`${where} (32, 56, 1)`, same(it.answer, [32, 56, 1]));
      if (it.tpl === 'aheadX' || it.tpl === 'mulvarShape') expect(`${where} (32, 56, 5)`, same(it.answer, ANCHOR['l4.ahead.shapes'].value.x));
      if (it.tpl === 'aheadY') expect(`${where} (32, 14)`, same(it.answer, ANCHOR['l4.ahead.shapes'].value.y));
      if (it.tpl === 'predict') expect(`${where} [1, 14]`, same(it.answer, ANCHOR['l4.ahead.predictShapes'].value.Y_pred));
      if (it.tpl === 'aheadLen') expect(`${where} 56 + 14 = 70`, it.answer === 70);
      if (it.tpl === 'columns') expect(`${where} 5 columns`, it.answer === 5);
      if (it.tpl === 'board') {
        const row = sc.rows.find((r) => r.id === it.answer);
        expect(`${where} board row is the level's`, M.boardRows(level).some((r) => r.id === it.answer));
        expect(`${where} board concept/src follow the row`, it.concept === M.boardRows(level).find((r) => r.id === it.answer).concept && it.src.slides.includes(18));
        if (it.mode === 'nameOf') expect(`${where} the prompt shows the asked value`, it.promptText.includes(row.label));
        if (it.mode === 'valueOf') expect(`${where} the right choice label is the printed value`, it.choices.find((c) => c.value === it.answer).label === row.label);
      }
      if (it.tpl === 'split') expect(`${where} split answer label`, it.choices.find((c) => c.value === it.answer).label === { rail_train: '2016-01 to 2018-12', rail_valid: '2019-01 to 2019-05', rail_test: '2019-06 onward' }[it.answer]);
      if (it.tpl === 'strategy') expect(`${where} strategy drawn = answer`, sc.id === it.answer);
    });
  }
}
expect('no beyond items (every item is on slides 15–39)', beyond === 0, `${beyond} / ${total}`);
['copyDay', 'diff7', 'maeHand', 'mapeHand', 'toyTarget', 'board', 'strategy', 'beatWidest', 'beatAhead'].forEach((t) => expect(`template ${t} appears`, counts[t] > 0));

// the drawer's equations
['forecast.mae', 'forecast.mape'].forEach((id) => L4.EQUATIONS[id].tex.forEach((t) => texOk(t, `EQUATIONS ${id}`)));

console.log(`Forecast Desk check: ${passed} assertions passed, ${failures.length} failed.`);
console.log(`  items by template: ${JSON.stringify(counts)}; beyond ${beyond} / ${total}`);
if (failures.length) {
  console.log(failures.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}
