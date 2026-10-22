/* ============================================================================
   DL LECTURE 8 STUDY — sanity checks for data/busrail.js
   ----------------------------------------------------------------------------
     node tools/dl-lecture8-study/check-busrail.mjs

   Checks (any failure → exit 1)
     run        1,027 training / 82 validation windows; 674 = 2·(16·18+16)+(32·2+2)
     windows    each exported window's input / truth equals Lecture 4's
                ridership.js boardings for those dates (both models, same starts)
     shapes     56 input days, 14 truth / pred days, [bus, rail] integer pairs;
                14 horizon MAEs; curves of equal length, epochs increasing,
                bestEpoch among them
     consistency BIRNN.horizonMAE[0] equals valMAE (the 1-day forecast is the
                slide-10 prediction); each window's mae recomputes from truth/pred
   ========================================================================== */
import { RUN, BIRNN, RNN_ED } from '../../src/components/portal/modules/deep-learning/lecture8-study/data/busrail.js';
import { RIDERSHIP } from '../../src/components/portal/modules/deep-learning/lecture4-study/data/ridership.js';

let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? `: ${detail}` : ''}`);
  if (!cond) failures++;
};
const dayIndex = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${RIDERSHIP.start}T00:00:00Z`)) / 864e5);
const day = (i) => [RIDERSHIP.bus[i], RIDERSHIP.rail[i]];
const isPairs = (a, n) => a.length === n && a.every((p) => p.length === 2 && p.every(Number.isInteger));

console.log('run');
ok(RUN.trainWindows === 1027 && RUN.validWindows === 82, 'window counts', `${RUN.trainWindows} / ${RUN.validWindows}`);
ok(BIRNN.params === 674 && 2 * (16 * 18 + 16) + (32 * 2 + 2) === 674, 'simple_biRNN params', `${BIRNN.params}`);
ok(RNN_ED.params === 608 + 32 * 34 + 32 + 66, 'rnn_ed params', `${RNN_ED.params} = 608 + 1,120 + 66`);

for (const [name, M] of [['BIRNN', BIRNN], ['RNN_ED', RNN_ED]]) {
  console.log(name);
  ok(M.horizonMAE.length === 14, 'horizonMAE has 14 values');
  const c = M.curves;
  const n = c.epoch.length;
  ok(['loss', 'mae', 'val_loss', 'val_mae'].every((k) => c[k].length === n) && n <= 81,
    'curves', `${n} points`);
  ok(c.epoch.every((e, i) => i === 0 || e > c.epoch[i - 1]) && c.epoch.includes(M.bestEpoch)
    && c.epoch[n - 1] === M.epochsRun - 1, 'curve epochs increasing, best and last included');
  ok(M.windows.length === 4, '4 windows');
  M.windows.forEach((w, k) => {
    const s = dayIndex(w.start);
    const truth = Array.from({ length: 14 }, (_, d) => day(s + 56 + d));
    let good = isPairs(w.truth, 14) && isPairs(w.pred, 14)
      && JSON.stringify(w.truth) === JSON.stringify(truth)
      && w.start === BIRNN.windows[k].start;
    if (w.input) {
      const input = Array.from({ length: 56 }, (_, d) => day(s + d));
      good = good && isPairs(w.input, 56) && JSON.stringify(w.input) === JSON.stringify(input);
    }
    let sum = 0;
    w.truth.forEach((p, d) => p.forEach((v, j) => { sum += Math.abs(v - w.pred[d][j]); }));
    const mae = sum / 28;
    good = good && Math.abs(mae - w.mae) <= 1;   // pred rounded to whole boardings
    ok(good, `window ${w.start}`, `mae ${w.mae.toLocaleString('en')} (recomputed ${mae.toFixed(1)})`);
  });
}
ok(Math.abs(BIRNN.horizonMAE[0] - BIRNN.valMAE) <= 0.5, 'BIRNN horizon 1 = slide-10 val MAE',
  `${BIRNN.horizonMAE[0]} vs ${BIRNN.valMAE}`);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall busrail checks passed');
