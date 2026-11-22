// Checks the RST practical sim's criteria/scoring content against the
// workbook's structure. Run: node tools/skippers/sim-criteria-check.mjs
// Exits 1 on any failure.
import { TASKS, CRITERIA, PASS_MARK, TOTAL, MAX_WRONG, UNSAFE, UNSAFE_TRIGGERS } from '../../src/skippers/sim/criteria.js';
import { TH } from '../../src/skippers/sim/thresholds.js';
import { CAPTIONS, ORDER, ACKS, BRIEFING } from '../../src/skippers/sim/captions.js';
import { LOCAL_RULES } from '../../src/skippers/sim/localRules.js';
import { LOGON_FIELDS, LOGOFF_FIELDS, VAGUE, checkRadio, parseTime } from '../../src/skippers/sim/radio.js';

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// Workbook ch.10 task headings, verbatim (body headings, p.92–112).
const TITLES = {
  1: 'The vessel is safely operated within the rules and regulations',
  2: 'Skipper checks the suitability and condition of the vessel’s mooring/berthing equipment and secures the vessel',
  3: 'Skipper conducts a safety briefing to all on board identifying the type and location of the vessel’s required safety equipment and wearing requirements for the area of operation and verbally check that the information is understood',
  4: 'Skipper prepares and starts motor safely',
  5: 'Skipper advises a responsible person of the voyage plan',
  6: 'The skipper safely departs a berth',
  7: 'Safely retrieve a simulated man overboard',
  8: 'Determine position by using navigational marks, transits and other landmarks',
  9: 'Perform a controlled stop at approximately 5 knots',
  10: 'Vessel is safely navigated and secured alongside a berth',
  11: 'Skipper advises a responsible person of safe return',
};
const COUNTS = [4, 3, 3, 9, 8, 7, 8, 2, 7, 9, 2];
const PAGES = { 1: 92, 2: 93, 3: 94, 4: 95, 5: 97, 6: 99, 7: 103, 8: 105, 9: 106, 10: 107, 11: 112 };

// ── scoring constants ──
ok(TOTAL === 62 && PASS_MARK === 56 && MAX_WRONG === 6 && TOTAL - PASS_MARK === MAX_WRONG, 'scoring constants must be 62 / 56 / 6');
ok(CRITERIA.length === TOTAL, `CRITERIA has ${CRITERIA.length}, want ${TOTAL}`);

// ── tasks ──
ok(TASKS.length === 11, `TASKS has ${TASKS.length}, want 11`);
TASKS.forEach((t, i) => {
  ok(t.task === i + 1, `TASKS[${i}].task = ${t.task}`);
  ok(t.title === TITLES[t.task], `Task ${t.task} title differs from the workbook`);
  ok(t.page === PAGES[t.task], `Task ${t.task} page ${t.page}, want ${PAGES[t.task]}`);
  ok(t.count === COUNTS[i], `Task ${t.task} count ${t.count}, want ${COUNTS[i]}`);
  ok(typeof t.short === 'string' && t.short.length > 0, `Task ${t.task} needs a short label`);
  const n = CRITERIA.filter((c) => c.task === t.task).length;
  ok(n === COUNTS[i], `Task ${t.task} has ${n} criteria, want ${COUNTS[i]}`);
});
ok(TASKS.reduce((s, t) => s + t.count, 0) === 62, 'task counts must sum to 62');

// ── criteria ──
const ids = new Set();
const KINDS = new Set(['measured', 'action', 'dialogue', 'na']);
for (const t of TASKS) {
  CRITERIA.filter((c) => c.task === t.task).forEach((c, j) => {
    ok(c.n === j + 1, `${c.id}: n should be ${j + 1} (contiguous, in order)`);
    ok(c.id === `T${c.task}.${c.n}`, `${c.id}: id must be T<task>.<n>`);
  });
}
for (const c of CRITERIA) {
  ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
  ok(Number.isInteger(c.page) && c.page >= 91 && c.page <= 112, `${c.id}: page ${c.page} outside 91–112`);
  ok(c.page >= TASKS[c.task - 1].page, `${c.id}: page ${c.page} is before its task heading`);
  ok(KINDS.has(c.kind), `${c.id}: bad kind ${c.kind}`);
  ok(typeof c.text === 'string' && c.text.length > 8, `${c.id}: needs text`);
  ok(typeof c.how === 'string' && c.how.length > 20, `${c.id}: needs a concrete how`);
  ok(c.threshold === null || TH[c.threshold], `${c.id}: threshold key "${c.threshold}" missing from TH`);
  for (const m of c.how.matchAll(/TH\.(\w+)/g)) ok(TH[m[1]], `${c.id}: how mentions TH.${m[1]} which doesn't exist`);
  if (c.kind === 'na') ok(/N\/A/.test(c.how) && /p\.\d+/.test(c.how), `${c.id}: N/A must explain why with a page`);
}
const na = CRITERIA.filter((c) => c.kind === 'na').map((c) => c.id);
ok(na.join() === 'T4.1,T4.4', `N/A set is ${na.join()} — expected T4.1 (fumes, inboards) and T4.4 (coolant, outboard)`);

// ── thresholds ──
for (const [k, v] of Object.entries(TH)) {
  ok(v && 'value' in v && typeof v.unit === 'string', `TH.${k}: needs value + unit`);
  if (v.source === 'game') {
    ok(v.page === null, `TH.${k}: game threshold must have page null`);
    ok(/^Game threshold:/.test(v.uiLabel), `TH.${k}: game uiLabel must start "Game threshold:"`);
  } else if (v.source === 'workbook') {
    ok(Number.isInteger(v.page), `TH.${k}: workbook threshold needs a page`);
    ok(v.uiLabel.startsWith(`Workbook p.${v.page}:`), `TH.${k}: workbook uiLabel must start "Workbook p.${v.page}:"`);
  } else fails.push(`TH.${k}: source must be workbook|game`);
}
const wbExpect = { kn8: [8, 12], near50: [50, 12], nearUnderway: [15, 12], shallow: [3, 12], transitTime: [30, 105], stopSpeed: [5, 106], stopDistanceBL: [2, 106], mobNoEngineBL: [1, 104] };
for (const [k, [val, page]] of Object.entries(wbExpect)) ok(TH[k]?.value === val && TH[k]?.page === page && TH[k]?.source === 'workbook', `TH.${k} should be workbook ${val} @ p.${page}`);
ok(JSON.stringify(TH.berthAngle?.value) === '[30,45]' && TH.berthAngle.page === 109, 'TH.berthAngle should be workbook [30,45] @ p.109');

// ── unsafe ──
for (const k of ['startInGear', 'personNearProp', 'hardHitVessel', 'hitPerson', 'engineNearPerson']) ok(typeof UNSAFE[k] === 'string' && UNSAFE[k].length > 10, `UNSAFE.${k} missing`);
ok(Object.keys(UNSAFE).join() === Object.keys(UNSAFE_TRIGGERS).join(), 'UNSAFE and UNSAFE_TRIGGERS keys must match');
for (const [k, v] of Object.entries(UNSAFE_TRIGGERS)) for (const m of v.matchAll(/TH\.(\w+)/g)) ok(TH[m[1]], `UNSAFE_TRIGGERS.${k}: TH.${m[1]} doesn't exist`);

// ── captions ──
ok(ORDER.join() === 't2,t3,t4,t5,t6,t8,t9,t7,t10,t11', 'caption ORDER');
for (const k of ORDER) { ok(Array.isArray(CAPTIONS[k]) && CAPTIONS[k].length, `CAPTIONS.${k} missing`); ok(ACKS[k], `ACKS.${k} missing`); }
ok(BRIEFING.required.map((r) => r.hs).join() === 'hs_lifejackets', 'BRIEFING: only lifejackets are required within 400 m (p.49)');
ok(BRIEFING.wearing.options.length <= 3 && BRIEFING.wearing.options.some((o) => o.id === BRIEFING.wearing.correct), 'BRIEFING.wearing: ≤3 options incl. the correct one');
const HS = new Set(['hs_lifejackets', 'hs_epirb', 'hs_flares', 'hs_extinguisher', 'hs_bilge', 'hs_bucket', 'hs_anchor', 'hs_radio']);
for (const r of [...BRIEFING.required, ...BRIEFING.optional]) ok(HS.has(r.hs) && r.page, `BRIEFING item ${r.hs} unknown hotspot or no page`);

// ── local rules ──
for (const r of LOCAL_RULES) ok(r.id && r.rule && r.appliesTo && /(South Metropolitan Boating Guide|Workbook p\.\d+)/.test(r.receipt), `LOCAL_RULES ${r.id}: needs rule, appliesTo and a receipt`);
ok(new Set(LOCAL_RULES.map((r) => r.id)).size === LOCAL_RULES.length, 'LOCAL_RULES ids unique');

// ── radio ──
ok(LOGON_FIELDS.map((f) => f.id).join() === 'T5.1,T5.2,T5.3,T5.4,T5.5,T5.6,T5.7,T5.8', 'LOGON_FIELDS ids');
ok(LOGOFF_FIELDS.map((f) => f.id).join() === 'T11.1,T11.2', 'LOGOFF_FIELDS ids');
ok(VAGUE.includes('plenty') && VAGUE.includes('soon') && VAGUE.includes('back soon'), 'VAGUE list');
const good = { vessel: 'XY456', departTime: '0815', departFrom: 'Palm Beach boat ramp, Rockingham', destination: 'Mangles Bay', intentions: 'RST practical and cruising', pob: '3', fuel: '60 litres', eta: '1030' };
const ctx = { pob: 3, fuelLitres: 60 };
const allOk = (r) => Object.values(r).every((x) => x.ok);
const expectRadio = (label, kind, answers, id, want, c = ctx) => {
  const r = checkRadio(kind, answers, c);
  ok(r[id]?.ok === want, `radio: ${label} → ${id} should be ${want ? 'ok' : 'fail'} (got ${JSON.stringify(r[id])})`);
};
const r0 = checkRadio('logon', good, ctx);
ok(Object.keys(r0).join() === 'T5.1,T5.2,T5.3,T5.4,T5.5,T5.6,T5.7,T5.8' && allOk(r0), `radio: good log-on should pass all 8 (${JSON.stringify(r0)})`);
expectRadio('ETA "back soon"', 'logon', { ...good, eta: 'back soon' }, 'T5.8', false);
expectRadio('ETA "in a couple of hours" (p.98)', 'logon', { ...good, eta: 'in a couple of hours' }, 'T5.8', false);
expectRadio('departure "shortly" (p.97)', 'logon', { ...good, departTime: 'shortly' }, 'T5.2', false);
expectRadio('departure "in 15 minutes" (p.97)', 'logon', { ...good, departTime: 'in 15 minutes' }, 'T5.2', false);
expectRadio('fuel "plenty"', 'logon', { ...good, fuel: 'plenty' }, 'T5.7', false);
expectRadio('fuel "enough" (p.98)', 'logon', { ...good, fuel: 'enough' }, 'T5.7', false);
expectRadio('fuel "full tank"', 'logon', { ...good, fuel: 'full tank' }, 'T5.7', false);
expectRadio('fuel "60L"', 'logon', { ...good, fuel: '60L' }, 'T5.7', true);
expectRadio('fuel "sixty litres"', 'logon', { ...good, fuel: 'sixty litres' }, 'T5.7', true);
expectRadio('fuel 200 L vs 60 L gauge', 'logon', { ...good, fuel: '200 litres' }, 'T5.7', false);
expectRadio('time "0815"', 'logon', { ...good, departTime: '0815' }, 'T5.2', true);
// Workbook p.97 accepts "7.15 am" → 12-hour WITH am/pm passes (deliberate change from the brief's "8:15am fails").
expectRadio('time "8:15am" (p.97 allows 7.15 am)', 'logon', { ...good, departTime: '8:15am' }, 'T5.2', true);
expectRadio('time "02:30 pm" ETA (p.98)', 'logon', { ...good, eta: '02:30 pm' }, 'T5.8', true);
expectRadio('time "815"', 'logon', { ...good, departTime: '815' }, 'T5.2', false);
expectRadio('ETA "2:30" read as 0230 < departure', 'logon', { ...good, eta: '2:30' }, 'T5.8', false);
expectRadio('pob "2 adults and a child"', 'logon', { ...good, pob: '2 adults and a child' }, 'T5.6', true);
expectRadio('pob "a few"', 'logon', { ...good, pob: 'a few' }, 'T5.6', false);
expectRadio('pob mismatch', 'logon', { ...good, pob: '4' }, 'T5.6', false);
expectRadio('departFrom "the ramp"', 'logon', { ...good, departFrom: 'the ramp' }, 'T5.3', false);
expectRadio('destination "out"', 'logon', { ...good, destination: 'out' }, 'T5.4', false);
expectRadio('vessel "the boat"', 'logon', { ...good, vessel: 'the boat' }, 'T5.1', false);
ok(parseTime('7.15 am') === 435 && parseTime('1430') === 870 && parseTime('noon') === null, 'parseTime basics');
const off = checkRadio('logoff', { vessel: 'XY456', status: 'We have safely returned from our voyage and are signing off' }, { logonVessel: 'XY456' });
ok(Object.keys(off).join() === 'T11.1,T11.2' && allOk(off), `radio: good log-off should pass (${JSON.stringify(off)})`);
expectRadio('log-off "not back yet"', 'logoff', { vessel: 'XY456', status: 'not back yet' }, 'T11.2', false, {});
expectRadio('log-off different vessel', 'logoff', { vessel: 'AB150', status: 'returned safely' }, 'T11.1', false, { logonVessel: 'XY456' });

// ── summary ──
const game = Object.values(TH).filter((v) => v.source === 'game').length;
const kinds = [...KINDS].map((k) => `${k} ${CRITERIA.filter((c) => c.kind === k).length}`).join(', ');
console.log(`RST sim criteria: ${CRITERIA.length} criteria in ${TASKS.length} tasks (${COUNTS.join('/')}) · pass ${PASS_MARK}/${TOTAL} (≤${MAX_WRONG} wrong)`);
console.log(`  kinds: ${kinds}`);
console.log(`  thresholds: ${Object.keys(TH).length} (${Object.keys(TH).length - game} workbook, ${game} game) · unsafe reasons: ${Object.keys(UNSAFE).length} · local rules: ${LOCAL_RULES.length}`);
if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S):`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  all checks passed ✓');
