/* ============================================================================
   DL LECTURE 4 STUDY — assertions for rnn.js and slideData.js
   ----------------------------------------------------------------------------
     node tools/dl-lecture4-study/check-rnn.mjs

   Checks, against numbers printed on the slides:
     params     every parameter count the slides print (57, 3, 1,088 + 33 =
                1,121, 1,088/2,080/2,080/33 = 5,281, 685, 1,401, 1,283)
     windows    slide 19's batches from the timeseries_dataset_from_array port;
                33 batches of ahead_train_ds (slide 36), shapes of slides 21/36
     naive      slide 18's MAE and MAPE from the real data, to 6 decimals
     table      slide 30's mulvar_train.head(), rebuilt from the data
     receipts   every scoreboard / parameter number in slideData.js appears in
                the transcript Documents/cits5017/markdown-lecs/lecture-4.md
     steps      the LSTM / GRU step functions against hand computation
   Exits non-zero on any failure.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture4-study');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);
const rnn = await imp('rnn.js');
const sd = await imp('slideData.js');
const { RIDERSHIP: R } = await imp('data/ridership.js');
const transcript = fs.readFileSync(path.join(REPO, 'Documents/cits5017/markdown-lecs/lecture-4.md'), 'utf8');

let fails = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails += 1;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── params ─────────────────────────────────────────────────────────────────
const P = sd.SLIDE_PARAMS;
ok(rnn.denseParams(56, 1) === P.linear, 'linear model Dense(1) on 56 inputs = 57 (slide 23)', rnn.denseParams(56, 1));
ok(rnn.simpleRnnParams(1, 1) === P.rnn1, 'SimpleRNN(1) = 3 (slide 25)', rnn.simpleRnnParams(1, 1));
ok(rnn.simpleRnnParams(32, 1) === P.univar.rnn && rnn.denseParams(32, 1) === P.univar.dense, 'univar_model 1,088 + 33 (slide 27)');
ok(P.univar.rnn + P.univar.dense === P.univar.total, 'univar_model total 1,121');
const deep = [rnn.simpleRnnParams(32, 1), rnn.simpleRnnParams(32, 32), rnn.simpleRnnParams(32, 32), rnn.denseParams(32, 1)];
ok(eq(deep, P.deep.layers) && deep.reduce((a, b) => a + b) === P.deep.total, 'deep_model 1,088 / 2,080 / 2,080 / 33 = 5,281 (slide 29)', deep.join(' / '));
ok(rnn.lstmParams(12, 1) + rnn.denseParams(12, 1) === P.lstm, 'lstm_model 685 (slide 43)', rnn.lstmParams(12, 1) + rnn.denseParams(12, 1));
ok(rnn.gruParams(20, 1, true) + rnn.denseParams(20, 1) === P.gru, 'gru_model 1,401 with reset_after=True (slide 49)', rnn.gruParams(20, 1, true) + 21);
ok(rnn.gruParams(20, 1, false) + rnn.denseParams(20, 1) === 1341, 'gru_model with one bias per gate = 1,341 (the aside)');
const cg = rnn.conv1dParams(8, 3, 1) + rnn.conv1dParams(16, 3, 8) + rnn.gruParams(10, 16) + rnn.denseParams(10, 1);
ok(cg === P.cnnGru, 'cnn_gru_model 32 + 400 + 840 + 11 = 1,283 (slide 50)', cg);
ok(rnn.conv1dLen(56, 3, 1) === 54 && rnn.conv1dLen(54, 3, 2) === 26, 'cnn_gru lengths 56 → 54 → 26');

// ── windows ────────────────────────────────────────────────────────────────
const toy = rnn.timeseriesDataset([0, 1, 2, 3, 4, 5], [3, 4, 5], { sequence_length: 3, batch_size: 2 });
const toyBatches = toy.batches.map((b) => ({ x: b.map((w) => w.x), y: b.map((w) => w.y) }));
ok(eq(toyBatches, sd.TOY_BATCHES), 'slide 19: [[0,1,2],[1,2,3]]→[3,4] then [[2,3,4]]→[5]', JSON.stringify(toyBatches));
ok(rnn.batchShape(toy.batches[0]) === '(2, 3)' && rnn.batchShape(toy.batches[1]) === '(1, 3)', 'slide 19 shapes (2, 3) and (1, 3)');
const [ta, tb] = rnn.monthRange(R.start, '2016-01', '2018-12');
const [va, vb] = rnn.monthRange(R.start, '2019-01', '2019-05');
const railTrain = R.rail.slice(ta, tb + 1).map((v) => v / 1e6);
const railValid = R.rail.slice(va, vb + 1).map((v) => v / 1e6);
ok(railTrain.length === 1096 && railValid.length === 151, 'rail_train 1,096 days, rail_valid 151 days');
const trainDs = rnn.timeseriesDataset(railTrain, railTrain.slice(56), { sequence_length: 56, batch_size: 32 });
const validDs = rnn.timeseriesDataset(railValid, railValid.slice(56), { sequence_length: 56, batch_size: 32 });
ok(trainDs.windows.length === 1040 && trainDs.batches.length === 33, 'train_ds: 1,040 windows, 33 batches (this page’s count)', `${trainDs.windows.length} / ${trainDs.batches.length}`);
ok(validDs.windows.length === 95 && validDs.batches.length === 3, 'valid_ds: 95 windows, 3 batches (this page’s count)', `${validDs.windows.length} / ${validDs.batches.length}`);
ok(rnn.batchShape(trainDs.batches[0]) === '(32, 56)' && trainDs.batches[0].length === 32, 'slide 21: xx.shape (32, 56), yy.shape (32,)');
const mulvar = [];
for (let i = ta; i <= tb; i++) {
  const next = i + 1 < R.length ? R.dayType[i + 1] : R.dayTypeAfterEnd;
  mulvar.push([R.bus[i] / 1e6, R.rail[i] / 1e6, ...['A', 'U', 'W'].map((t) => (t === next ? 1 : 0))]);
}
const ahead = rnn.timeseriesDataset(mulvar, null, { sequence_length: 56 + 14, batch_size: 32 });
ok(ahead.batches.length === 33, 'slide 36: Number of batches in ahead_train_ds = 33', ahead.batches.length);
ok(rnn.batchShape(ahead.batches[0].map((w) => ({ x: w.x.slice(0, 56) })), 5) === '(32, 56, 5)', 'slide 36: x.shape (32, 56, 5), y.shape (32, 14)');

// ── naive ──────────────────────────────────────────────────────────────────
const [ma, mb] = rnn.monthRange(R.start, '2019-03', '2019-05');
['bus', 'rail'].forEach((k) => {
  const d = rnn.diff(R[k], 7).slice(ma, mb + 1);
  const tgt = R[k].slice(ma, mb + 1);
  const m = rnn.mae(d).toFixed(6);
  const p = rnn.mape(d, tgt).toFixed(6);
  ok(Number(m) === sd.NAIVE7.mae[k] && Number(p) === sd.NAIVE7.mape[k], `slide 18 ${k}: MAE ${m}, MAPE ${p}`);
});

// ── table ──────────────────────────────────────────────────────────────────
const head = mulvar.slice(0, 5).map((r) => [Number(r[0].toFixed(6)), Number(r[1].toFixed(6)), ...r.slice(2)]);
ok(eq(head, sd.MULVAR_HEAD.map((r) => r.row)), 'slide 30: mulvar_train.head() rebuilt from the data', JSON.stringify(head[0]));
ok(eq(sd.DF_HEAD.map((r) => [r.date, r.bus, r.rail]).slice(0, 1), [['2001-01-01', 297192, 126455]]), 'slide 15 df.head() row 1 transcribed');

// ── receipts ───────────────────────────────────────────────────────────────
const flat = transcript.replace(/\$|\{,\}|\\,/g, '');
const appears = (n) => {
  const s = String(n);
  const withComma = Number(n).toLocaleString('en-US');
  return flat.includes(s) || flat.includes(withComma) || flat.includes(withComma.replace(',', ', '));
};
const missing = [];
sd.SCOREBOARD.forEach((e) => { if (!e.gt && !appears(Math.round(e.mae)) && !appears(e.mae)) missing.push(`${e.id}:${e.mae}`); });
sd.MULTASK_RUNS.forEach((r) => ['total', 'bus', 'rail'].forEach((k) => { if (!appears(r[k])) missing.push(`multask ${r.run} ${k}`); }));
[P.linear, P.rnn1, P.univar.rnn, P.univar.dense, P.univar.total, ...P.deep.layers, P.deep.total, P.lstm, P.gru, P.cnnGru].forEach((n) => { if (!appears(n)) missing.push(`param ${n}`); });
ok(missing.length === 0, 'every scoreboard and parameter number is in the transcript', missing.join(', '));
ok(flat.includes('greater than 100,000') || flat.includes('greater than 100, 000'), 'SimpleRNN(1) “greater than 100,000” is in the transcript');

// ── steps ──────────────────────────────────────────────────────────────────
const W = { Wxi: [[8], [0]], Whi: [[0]], bi: [-4], Wxf: [[0], [0]], Whf: [[0]], bf: [5], Wxo: [[0], [8]], Who: [[0]], bo: [-4], Wxg: [[3], [0]], Whg: [[0]], bg: [0] };
const s = rnn.lstmStep([1, 0], [0], [0], W);
const sig = (a) => 1 / (1 + Math.exp(-a));
ok(Math.abs(s.c[0] - (sig(5) * 0 + sig(4) * Math.tanh(3))) < 1e-12 && Math.abs(s.h[0] - sig(-4) * Math.tanh(s.c[0])) < 1e-12, 'lstmStep: c = f⊗c + i⊗g, h = o⊗tanh(c)', `c ${s.c[0].toFixed(3)} h ${s.h[0].toFixed(4)}`);
const G = { Wxz: [[-8], [0]], Whz: [[0]], bz: [4], Wxr: [[0], [0]], Whr: [[0]], br: [4], Wxg: [[3], [0]], Whg: [[1]], bg: [0] };
const g = rnn.gruStep([0, 0], [0.5], G);
const want = sig(4) * 0.5 + (1 - sig(4)) * Math.tanh(sig(4) * 0.5);
ok(Math.abs(g.h[0] - want) < 1e-12, 'gruStep: h = z⊗h + (1 − z)⊗g, g sees r⊗h (Figure 15-13’s order)', g.h[0].toFixed(4));
const r1 = rnn.rnnStep([0.2, -0.1], [1, 0.5], { Wh: [[0.5, 0], [0, 0.5]], Wx: [[1, 0], [0, 1]], bh: [0, 0], phi: 'tanh' });
ok(Math.abs(r1.h[0] - Math.tanh(0.1 + 1)) < 1e-12 && Math.abs(r1.h[1] - Math.tanh(-0.05 + 0.5)) < 1e-12, 'rnnStep: h = tanh(hW_h + xW_x + b) with row vectors');

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
