/* Headless, deterministic checks for the /skippers/practical/drive sim.
   Drives src/skippers/sim/game.js with scripted input (no DOM):
   - every drill with TEXTBOOK input must score every criterion (N/A counted as met)
   - one full assessment with textbook input must score 62/62
   - scripted BAD runs must miss exactly the intended criteria (or end unsafe)
   Usage: node tools/skippers/sim-check.mjs [--verbose] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '../../src/skippers/sim/game.js';
import { KN, fwd, wrapPi, BOAT } from '../../src/skippers/sim/physics.js';
import { transitLine } from '../../src/skippers/sim/game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/skippers-sim/venue-layout.json'), 'utf8'));
const VERBOSE = process.argv.includes('--verbose');
if (process.argv.includes('--dbg')) globalThis.__SIMDBG = true;
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const D = Math.PI / 180;
let failures = 0;

/* ---------- driver helpers ---------- */
const wait = (G, s) => { for (let i = 0; i < Math.round(s * 60); i++) { if (G.g.ended && G.g.phase === 'done') return; G.tick(); } };
function waitUntil(G, pred, max = 120, each) { for (let i = 0; i < max * 60; i++) { if (pred()) return true; each?.(); G.tick(); if (G.g.ended) return pred(); } return false; }
const spd = (b) => Math.hypot(b.u, b.v) * KN;
function steer(G, hdg, k = 2.2) { const b = G.g.boat; const e = wrapPi(hdg - b.psi); G.cmd({ t: 'wheelTo', v: Math.max(-1, Math.min(1, e * k)) }); return e; }
const bearing = (b, p) => Math.atan2(p[0] - b.x, p[1] - b.y);
function setGear(G, n) { const b = G.g.boat; let guard = 0; while (b.gear !== n && guard++ < 10) { G.cmd({ t: 'lever', d: Math.sign(n - b.gear) }); G.tick(); } }
/* textbook gear change: always pause in neutral when crossing */
function gearTo(G, n) {
  const b = G.g.boat;
  if (Math.sign(b.gear) !== 0 && Math.sign(n) !== 0 && Math.sign(n) !== Math.sign(b.gear)) { setGear(G, 0); wait(G, 0.9); }
  setGear(G, n);
}
function lookAround(G) { for (const y of [-100, -170, 170, 100, 0]) { G.cmd({ t: 'look', yaw: y * D }); wait(G, 0.3); } }
function lookBehind(G) { G.cmd({ t: 'look', yaw: 175 * D }); wait(G, 0.6); G.cmd({ t: 'look', yaw: 0 }); wait(G, 0.2); }
const hs = (G, id) => G.cmd({ t: 'hs', id });
const choose = (G, key, value) => G.cmd({ t: 'choose', key, value });

const GOOD_LOGON = { vessel: 'XY456', departTime: '0815', departFrom: 'Palm Beach boat ramp, Rockingham', destination: 'Mangles Bay', intentions: 'RST practical then cruising', pob: '3', fuel: '75 litres', eta: '1030' };

/* ---------- textbook scripts, one per task ---------- */
const T = {
  t2(G) { for (const id of ['hs_line_bow', 'hs_line_stern', 'hs_line_spring', 'hs_cleat_bow', 'hs_cleat_stern', 'hs_jetty_cleat']) { hs(G, id); wait(G, 0.3); } choose(G, 'secure', true); wait(G, 0.5); },
  t3(G) { const B = G.g.ph.briefing; for (const it of [...B.required, ...(B.optional ?? [])]) { hs(G, it.hs); wait(G, 0.3); } choose(G, 'wearing', B.wearing.correct); wait(G, 0.2); choose(G, 'understood', 'ask'); wait(G, 0.3); },
  t4(G) {
    for (const id of ['hs_fuel_line', 'hs_fuel_gauge', 'hs_intakes', 'hs_lanyard', 'hs_lever', 'hs_prop']) { hs(G, id); wait(G, 0.4); }
    if (G.g.prompt?.key === 'swimmer') { choose(G, 'swimmer', 'move'); wait(G, 0.5); }
    lookBehind(G); hs(G, 'hs_key'); wait(G, 0.5);
  },
  t5(G) { G.cmd({ t: 'radio', kind: 'logon', answers: GOOD_LOGON }); wait(G, 0.3); },
  t11(G) { G.cmd({ t: 'radio', kind: 'logoff', answers: { vessel: 'XY456', status: 'returned safely, logging off' } }); wait(G, 0.3); },
  t6(G, bad = {}) {
    if (!bad.noLook) lookAround(G);
    for (const id of ['bow', 'stern']) { hs(G, `hs_line_${id}`); wait(G, 0.3); if (!bad.noStow) { hs(G, `hs_line_${id}`); wait(G, 0.3); } }
    if (!bad.noLook) lookAround(G);
    const b = G.g.boat; const be = G.g.berthPose;
    const out = Math.atan2(be.u[0] + be.o[0] * 0.25, be.u[1] + be.o[1] * 0.25);
    G.cmd({ t: 'wheelTo', v: 0.25 }); gearTo(G, 1);
    waitUntil(G, () => G.g.phase !== 't6', 120, () => steer(G, out, 1.5));
  },
  t8(G) {
    // name the transit we're sitting on, then hold it
    const tr = G.g.W.transits[0]; const L = transitLine(tr);
    choose(G, 'transit', tr.id); wait(G, 0.2);
    waitUntil(G, () => G.g.phase !== 't8', 200, () => {
      const b = G.g.boat; const v = [b.x - L.p[0], b.y - L.p[1]]; const al = v[0] * L.d[0] + v[1] * L.d[1];
      const aim = [L.p[0] + L.d[0] * (al - 25), L.p[1] + L.d[1] * (al - 25)];
      steer(G, bearing(b, aim), 2);
    });
  },
  t9(G, bad = {}) {
    const b = G.g.boat; const h = b.psi;
    waitUntil(G, () => G.g.ph.armed >= 2.2, 30, () => steer(G, h));
    if (!bad.noLook) lookBehind(G);
    G.cmd({ t: 'shout' }); wait(G, 0.4);
    if (bad.straight) { setGear(G, -2); }
    else { G.cmd({ t: 'lever', d: -1 }); wait(G, 0.6); setGear(G, 0); wait(G, 0.9); setGear(G, -1); wait(G, 0.3); setGear(G, -2); }
    waitUntil(G, () => G.g.ph.stopped, 20);
    setGear(G, 0);
    waitUntil(G, () => G.g.phase !== 't9', 10);
  },
  t7(G, bad = {}) {
    const g = G.g;
    waitUntil(G, () => !!g.mob, 30, () => steer(G, g.boat.psi));
    const m = g.mob; const side = m.side === 'starboard' ? 1 : -1;
    G.cmd({ t: 'shout' }); G.cmd({ t: 'wheelTo', v: side }); wait(G, 0.5);
    choose(G, 'mob', 'mobAid'); wait(G, 0.3); choose(G, 'mob', 'mobWatch');
    if (!g.boat.running) { hs(G, 'hs_key'); wait(G, 0.3); }
    gearTo(G, 1); wait(G, 1.2); G.cmd({ t: 'centre' }); gearTo(G, 2); wait(G, 5); // stern swung clear; now get well clear
    // where the boat will drift relative to the float: downwind
    const c = g.cond; const wl = Math.hypot(...c.wind) || 1; const down = [c.wind[0] / wl, c.wind[1] / wl];
    const into = bad.upwind ? down : [-down[0], -down[1]]; // approach heading
    const approachFrom = (dd) => [m.x - into[0] * dd, m.y - into[1] * dd];
    // wide loop: a side point, then the start of the final approach 40 m off
    const sideP = [m.x + into[1] * 30 * side, m.y - into[0] * 30 * side];
    gearTo(G, 2);
    for (const wp of [sideP, approachFrom(70)]) waitUntil(G, () => Math.hypot(wp[0] - g.boat.x, wp[1] - g.boat.y) < 8, 90, () => steer(G, bearing(g.boat, wp)));
    gearTo(G, 1);
    let off = false;
    const ok7 = waitUntil(G, () => g.phase !== 't7', 120, () => {
      const b = g.boat; const d = Math.hypot(m.x - b.x, m.y - b.y);
      steer(G, bearing(b, [m.x, m.y]), 2.5);
      if (d < 10.5 && b.gear !== 0) setGear(G, 0); // neutral outside one boat length (p.104)
      if (d < 10.5 && spd(b) < 0.5 && b.running && !off && d > 5) { /* stalled short in the wind: nothing to do but drift */ }
      if (d < 5.5 && !off) { G.cmd({ t: 'engineOff' }); off = true; }
      if (g.prompt?.key === 'retrieve') choose(G, 'retrieve', true);
    });
    if (!ok7 && VERBOSE) { const b = g.boat; console.log('   t7 stuck: boat', b.x.toFixed(1), b.y.toFixed(1), 'mob', m.x.toFixed(1), m.y.toFixed(1), 'd', Math.hypot(m.x - b.x, m.y - b.y).toFixed(1), 'kn', spd(b).toFixed(2), 'gear', b.gear, 'run', b.running, 'wind', g.cond.wind.map((v) => v.toFixed(2))); }
  },
  t10(G, bad = {}) {
    // Workbook p.109 outboard berthing: run in at 30–45°, swing at about two lengths,
    // neutral + wheel to the berth as the shoulder closes, then a touch of reverse.
    const g = G.g; const c = g.cond;
    // pick the side the wind sets you ONTO (or either if it's along the berth)
    const be = bad.side ? g.W.layout.berths.find((x) => x.id === bad.side) : [...g.W.layout.berths].sort((a, b2) => (a.outward[0] * c.wind[0] + a.outward[1] * c.wind[1]) - (b2.outward[0] * c.wind[0] + b2.outward[1] * c.wind[1]))[0];
    const [p0, p1] = be.edge; const e = [p1[0] - p0[0], p1[1] - p0[1]]; const l = Math.hypot(...e); const u = [e[0] / l, e[1] / l];
    const parallel = Math.atan2(-u[0], -u[1]); // bow toward shore
    const stb = [Math.cos(parallel), -Math.sin(parallel)];
    const toBerth = (be.outward[0] * stb[0] + be.outward[1] * stb[1]) < 0 ? 1 : -1; // wheel direction toward the berth
    const tgt = [p0[0] + u[0] * l * 0.5 + be.outward[0] * 1.3, p0[1] + u[1] * l * 0.5 + be.outward[1] * 1.3];
    const ang = (bad.angle ?? 38) * D;
    const dir = [u[0] * Math.cos(ang) + be.outward[0] * Math.sin(ang), u[1] * Math.cos(ang) + be.outward[1] * Math.sin(ang)];
    const start = [tgt[0] + dir[0] * 45, tgt[1] + dir[1] * 45];
    const pre = [tgt[0] + dir[0] * 85, tgt[1] + dir[1] * 85];
    G.cmd({ t: 'shout' }); // hands inside
    for (const wp of [pre, start]) waitUntil(G, () => Math.hypot(wp[0] - g.boat.x, wp[1] - g.boat.y) < 7, 150, () => steer(G, bearing(g.boat, wp)));
    if (!bad.noLook) lookAround(G);
    let step = 1; let tr = 0; let looked = false; let tStep = 0;
    waitUntil(G, () => g.phase !== 't10', 150, () => {
      const b = g.boat; tStep += 1 / 60;
      const rel = [b.x - p0[0], b.y - p0[1]]; const off = rel[0] * be.outward[0] + rel[1] * be.outward[1];
      const dT = Math.hypot(tgt[0] - b.x, tgt[1] - b.y);
      if (globalThis.__SIMDBG && (tr += 1) % 60 === 0) console.log('   t10', be.id, 'step', step, 'pos', b.x.toFixed(1), b.y.toFixed(1), 'psi', (b.psi / D).toFixed(0), 'off', off.toFixed(1), 'dT', dT.toFixed(1), 'kn', spd(b).toFixed(1), 'gear', b.gear, 'wheel', b.wheel.toFixed(2));
      if (step === 1) { // Step 1: hold the run-in line at idle ahead
        const v = [b.x - tgt[0], b.y - tgt[1]]; const along = v[0] * dir[0] + v[1] * dir[1];
        const aim = [tgt[0] + dir[0] * Math.max(0, along - 8), tgt[1] + dir[1] * Math.max(0, along - 8)];
        steer(G, bearing(b, aim), 2);
        if (dT < 24 && !looked && !bad.noLook) { looked = true; lookAround(G); } // look around before the approach
        if (dT < (bad.angle ? 3.2 : 2.1) * BOAT.L) { step = 2; tStep = 0; }
      } else if (step === 2) { // Step 2: wheel away from the berth — the stern swings in
        const err = wrapPi(parallel - b.psi);
        G.cmd({ t: 'wheelTo', v: Math.abs(err) > 0.12 ? -toBerth * Math.min(1, Math.abs(err) * 2) : toBerth * 0.25 });
        if (off < BOAT.B / 2 + (bad.angle ? 2.6 : 1.9)) { setGear(G, 0); G.cmd({ t: 'wheelTo', v: toBerth }); step = 3; tStep = 0; }
      } else if (step === 3) { // Steps 3–4: neutral, wheel to the berth, then reverse
        if (tStep > 0.8 && b.gear === 0 && b.u > 0.15) setGear(G, -1);
        if (b.gear < 0 && b.u < 0.08) { setGear(G, 0); step = 4; tStep = 0; }
        if (tStep > 3 && b.gear === 0) { step = 4; tStep = 0; }
      } else if (step === 4) { // alongside: put a line on
        if (b.gear !== 0) setGear(G, 0);
        if (Math.hypot(b.u, b.v) < 0.45) hs(G, 'hs_line_bow');
      }
    });
    if (VERBOSE && g.phase === 't10') { const b = g.boat; const rel = [b.x - p0[0], b.y - p0[1]]; console.log('   t10 stuck: step', step, be.id, 'off', (rel[0] * be.outward[0] + rel[1] * be.outward[1]).toFixed(2), 'kn', spd(b).toFixed(2), 'psi', (b.psi / D).toFixed(0)); }
  },
};

/* ---------- runners ---------- */
function runDrill(task, opts = {}) {
  const G = createGame({ layout, mode: 'drill', task, preset: opts.preset ?? 'afternoon', seed: opts.seed ?? 3 });
  T[`t${task}`](G, opts.bad ?? {});
  wait(G, 1);
  return G;
}
function report(name, G, expectMiss = [], expectUnsafe = null) {
  if (ONLY && !name.includes(ONLY)) return null;
  const s = G.score();
  const misses = s.rows.filter((r) => r.s === 'miss').map((r) => r.id);
  const okMiss = JSON.stringify([...misses].sort()) === JSON.stringify([...expectMiss].sort());
  const okUnsafe = expectUnsafe ? s.unsafe?.key === expectUnsafe : !s.unsafe;
  const ok = okMiss && okUnsafe;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(44)} ${s.got}/${s.total}${s.na ? ` (${s.na} N/A)` : ''}${s.unsafe ? ` UNSAFE:${s.unsafe.key}` : ''}${misses.length ? `  missed ${misses.join(' ')}` : ''}`);
  if (!ok || VERBOSE) {
    if (!okMiss) console.log(`       expected misses: [${expectMiss.join(' ')}]`);
    for (const r of s.rows) if (r.s === 'miss' || VERBOSE) console.log(`       ${r.id} ${r.s} — ${r.why}`);
  }
  return s;
}

console.log('— textbook drills (every criterion met) —');
for (const task of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) for (const preset of ['morning', 'afternoon']) report(`drill T${task} textbook (${preset})`, runDrill(task, { preset, seed: task * 11 }));

console.log('— bad runs (exactly the intended misses) —');
report('T9 straight forward→reverse shift', runDrill(9, { bad: { straight: true } }), ['T9.3', 'T9.4']);
report('T9 no look behind', runDrill(9, { bad: { noLook: true } }), ['T9.1']);
report('T6 no head-check before moving off', runDrill(6, { bad: { noLook: true } }), ['T6.1']);
report('T7 MOB approach from upwind', runDrill(7, { bad: { upwind: true } }), ['T7.4']);
report('T10 70° docking angle', runDrill(10, { preset: 'afternoon', bad: { angle: 80, side: 'west' } }), ['T10.5']);
{
  const G = createGame({ layout, mode: 'drill', task: 4, seed: 5 });
  for (const id of ['hs_fuel_line', 'hs_fuel_gauge', 'hs_intakes', 'hs_lanyard']) hs(G, id);
  G.cmd({ t: 'lever', d: 1 }); hs(G, 'hs_prop'); if (G.g.prompt?.key === 'swimmer') choose(G, 'swimmer', 'move');
  lookBehind(G); hs(G, 'hs_key'); wait(G, 0.5);
  report('T4 starting in gear (unsafe → fail)', G, ['T4.7', 'T4.9'], 'startInGear');
}
{
  const G = createGame({ layout, mode: 'drill', task: 5, seed: 5 });
  G.cmd({ t: 'radio', kind: 'logon', answers: { ...GOOD_LOGON, eta: 'back soon' } }); wait(G, 0.3);
  report('T5 log on with "back soon"', G, ['T5.8']);
}

console.log('— full assessment (textbook) —');
function assessment(preset, seed) {
  const G = createGame({ layout, mode: 'assessment', preset, seed });
  const g = G.g;
  // a good skipper answers the passenger straight away, whatever else is happening
  const orig = G.tick; G.tick = () => { if (g.prompt?.key === 'sitDown') choose(G, 'sitDown', true); orig(); };
  const goTo = (wp, r = 10, max = 200) => waitUntil(G, () => Math.hypot(wp[0] - g.boat.x, wp[1] - g.boat.y) < r, max, () => steer(G, bearing(g.boat, wp)));
  const OPEN = [-60, 330]; // open water north of the moorings
  for (let guard = 0; guard < 20 && !g.ended; guard++) {
    const ph = g.phase;
    if (ph === 't8') {
      const tr = g.W.transits[0]; const L = transitLine(tr);
      const out = [L.p[0] + L.d[0] * 200, L.p[1] + L.d[1] * 200];
      gearTo(G, 2); goTo([-25, 110], 12); goTo([-20, 200], 12); goTo(out, 12);
      gearTo(G, 1);
      const back = Math.atan2(-L.d[0], -L.d[1]);
      waitUntil(G, () => Math.abs(wrapPi(back - g.boat.psi)) < 0.2, 60, () => G.cmd({ t: 'wheelTo', v: wrapPi(back - g.boat.psi) > 0 ? 1 : -1 }));
      T.t8(G); continue;
    }
    if (ph === 't9') {
      gearTo(G, 2); goTo(OPEN, 25);
      T.t9(G); continue;
    }
    if (ph === 'cruise') { gearTo(G, 1); waitUntil(G, () => g.phase !== 'cruise', 60, () => steer(G, bearing(g.boat, [-150, 330]))); continue; }
    if (ph === 't7') { T.t7(G); continue; }
    if (ph === 't10') {
      if (!g.boat.running) { hs(G, 'hs_key'); wait(G, 0.5); }
      gearTo(G, 2); for (const wp of [[-40, 220], [-40, 70]]) goTo(wp, 15); gearTo(G, 1); // in down the west side of the moorings
      T.t10(G); continue;
    }
    if (ph === 't11') { if (g.boat.running) G.cmd({ t: 'engineOff' }); T.t11(G); continue; }
    T[ph](G);
  }
  G.tick = orig;
  return G;
}
for (const [preset, seed] of [['morning', 2], ['afternoon', 9]]) report(`assessment textbook (${preset}, seed ${seed})`, assessment(preset, seed));

// determinism: same seed, same input → identical end state
{
  const a = runDrill(9, { seed: 4 }).g.boat; const b = runDrill(9, { seed: 4 }).g.boat;
  const same = a.x === b.x && a.y === b.y && a.psi === b.psi;
  if (!same) failures++;
  console.log(`${same ? 'ok  ' : 'FAIL'} deterministic (same seed → identical state)`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall sim checks passed');
process.exit(failures ? 1 : 0);
