/* ============================================================================
   DL LECTURE 4 STUDY — ridership.js cross-check (pure JS, no deps)
     node tools/dl-lecture4-study/check-ridership.mjs

   Re-computes slide 18's numbers from the generated data file, the way pandas
   does them:
     diff_7  = df[["bus","rail"]].diff(7)["2019-03":"2019-05"]   row i minus row i-7
     MAE     = diff_7.abs().mean()
     MAPE    = (diff_7 / targets).abs().mean()
   pandas' diff(7) is positional (previous 7 ROWS), so the file must be one row
   per consecutive day (or carry an explicit `dates` array, used positionally).
   Also re-derives the row / window / batch counts in GATES from the lengths.
   Exits 1 on any mismatch.
   ========================================================================== */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/lecture4-study/data/ridership.js');
const { RIDERSHIP, GATES } = await import(pathToFileURL(FILE).href);

const SLIDE18 = { mae: { bus: '43915.608696', rail: '42143.271739' }, mape: { bus: '0.082938', rail: '0.089948' } };
let failed = 0;
const check = (ok, label, got, want) => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}: ${got}${ok || want === undefined ? '' : `  (want ${want})`}`);
  if (!ok) failed += 1;
};

// --- dates, one per row ------------------------------------------------------
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const t0 = Date.parse(`${RIDERSHIP.start}T00:00:00Z`);
const n = RIDERSHIP.bus.length;
const dates = RIDERSHIP.dates ?? Array.from({ length: n }, (_, i) => iso(t0 + i * DAY));

console.log(`ridership.js: ${n} rows, ${dates[0]} .. ${dates[n - 1]}`);
check(RIDERSHIP.rail.length === n && RIDERSHIP.dayType.length === n && dates.length === n,
  'bus / rail / dayType / dates lengths agree', `${n} ${RIDERSHIP.rail.length} ${RIDERSHIP.dayType.length} ${dates.length}`);
check([...RIDERSHIP.bus, ...RIDERSHIP.rail].every(Number.isInteger), 'all counts are integers', 'ok');
check(/^[WAU]+$/.test(RIDERSHIP.dayType), 'dayType uses only W/A/U', 'ok');
if (RIDERSHIP.end) check(dates[n - 1] === RIDERSHIP.end, 'last date = end', dates[n - 1], RIDERSHIP.end);

// --- slide 18 ----------------------------------------------------------------
const inRange = (from, to) => dates.flatMap((d, i) => (d >= from && d <= to ? [i] : []));
const rows = inRange('2019-03-01', '2019-05-31');
check(rows.length === 92 && rows[0] - 7 >= 0, 'diff_7 rows (2019-03-01..2019-05-31), all with 7 prior rows', rows.length, 92);

console.log('\n>>> diff_7.abs().mean()          >>> (diff_7 / targets).abs().mean()');
for (const col of ['bus', 'rail']) {
  const x = RIDERSHIP[col];
  let sumAbs = 0;
  let sumPct = 0;
  for (const i of rows) {
    const d = x[i] - x[i - 7]; // pandas diff(7): this row minus the row 7 positions back
    sumAbs += Math.abs(d);
    sumPct += Math.abs(d / x[i]);
  }
  const mae = (sumAbs / rows.length).toFixed(6);
  const mape = (sumPct / rows.length).toFixed(6);
  console.log(`${col.padEnd(5)} ${mae.padStart(13)}            ${col.padEnd(5)} ${mape}`);
  check(mae === SLIDE18.mae[col], `MAE ${col} = slide 18`, mae, SLIDE18.mae[col]);
  check(mape === SLIDE18.mape[col], `MAPE ${col} = slide 18`, mape, SLIDE18.mape[col]);
  check(GATES.naive7.mae[col].toFixed(6) === mae && GATES.naive7.mape[col].toFixed(6) === mape,
    `GATES.naive7 ${col} agrees`, `${GATES.naive7.mae[col]} / ${GATES.naive7.mape[col]}`);
}

// --- rows, windows, batches (timeseries_dataset_from_array counting) ----------
console.log('');
const train = inRange('2016-01-01', '2018-12-31').length;
const valid = inRange('2019-01-01', '2019-05-31').length;
const windows = (len, seq, withTargets) => Math.max(0, withTargets ? Math.min(len - seq + 1, len - seq) : len - seq + 1);
const batches = (w, size = 32) => Math.ceil(w / size);
const derived = {
  rows: { train, valid },
  univar: { train: windows(train, 56, true), valid: windows(valid, 56, true) },
  ahead: { train: windows(train, 70, false), valid: windows(valid, 70, false) },
};
check(train === GATES.rows.train && valid === GATES.rows.valid, 'rows train / valid', `${train} / ${valid}`,
  `${GATES.rows.train} / ${GATES.rows.valid}`);
for (const kind of ['univar', 'ahead']) {
  for (const split of ['train', 'valid']) {
    const w = derived[kind][split];
    const g = GATES[kind][split];
    check(w === g.windows && batches(w) === g.batches, `${kind} ${split} windows / batches`, `${w} / ${batches(w)}`,
      `${g.windows} / ${g.batches}`);
  }
}
check(batches(derived.ahead.train) === 33, 'ahead_train_ds batches = 33 (slide 36)', batches(derived.ahead.train), 33);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
