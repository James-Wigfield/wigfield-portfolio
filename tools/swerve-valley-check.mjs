/* ============================================================================
   ARCADE — headless check for /arcade/swerve-valley
   ----------------------------------------------------------------------------
   1. Rules (in-process): the road generator, a full simulated tour through a
      faithful copy of ArcadeRoom.dispatch, and every server-authority rule —
      only the driver moves the bus, stale/teleport reports are dropped or
      clamped, jobs answer once and only by their owner, drinks only in the
      pour, the designated driver can't un-juice, stomp/stack/quiz/cheese
      limits, picks, host-only start, idle pause, wrong turns, parking, keys.
   2. Browser: N isolated phones (?bot=1) play a whole tour against a running
      Worker, with a late joiner and a mid-drive reload. Zero console errors,
      every phone reaches the ending and agrees on it.

     npx wrangler dev --port 8788 --local     # in one terminal (after npm run build)
     node tools/swerve-valley-check.mjs       # in another

   SV_RULES_ONLY=1   just part 1 (a second or two)
   ARCADE_BASE=<origin>  run part 2 against a deployed Worker
   SV_SHOTS=<dir>    save screenshots (lobby, fork, car park, dusk, ending…)
   SV_PHONES=<n>     phones in the browser pass (default 3)
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import rules from '../workers/arcade/games/swerve-valley.js';
import {
  CAST_IDS,
  PHYS,
  HAZARDS,
  buildLeg,
  hazX,
  stepBus,
  safeLine,
  crossings,
  buildPlatter,
  buildQuiz,
  POUR_ROUND_MS,
  QUIZ_Q_MS,
  LEGS,
} from '../public/arcade/swerve-valley/world.js';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.ARCADE_BASE || 'http://127.0.0.1:8788';
const URL = `${BASE}/arcade/swerve-valley/`;
const SHOTS = process.env.SV_SHOTS || null;
const PHONES = parseInt(process.env.SV_PHONES || '3', 10);

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function finish() {
  console.log('');
  console.log(fails.length ? `${fails.length} FAILED:\n  ${fails.join('\n  ')}` : 'ALL PASS');
  process.exit(fails.length ? 1 : 0);
}

// ── A faithful little ArcadeRoom ─────────────────────────────────────────────
// Same contract as workers/arcade/room.js: the state is re-parsed for every
// dispatch, and a reducer that returns the SAME object means "nothing
// happened" (the Devil's Ivy lesson — mutate-and-return-state is dropped).
function makeRoom(players = [0, 1]) {
  const r = {
    now: 1_000_000,
    players: [...players],
    seats: players.map((s) => ({ seat: s, name: `P${s}` })),
    json: JSON.stringify(rules.init()),
  };
  r.state = () => JSON.parse(r.json);
  r.dispatch = (kind, seat, msg) => {
    const st = r.state();
    const ctx = { seat, now: r.now, players: r.players, seats: r.seats, msg };
    let next;
    if (kind === 'start') next = rules.start(st, ctx);
    else if (kind === 'rematch') next = rules.rematch(st, ctx);
    else if (kind === 'tick') next = rules.tick(st, ctx);
    else next = rules.action(st, ctx);
    if (!next || next === st) return false;
    r.json = JSON.stringify(next);
    const at = rules.nextTickAt(next);
    if (at != null && at <= r.now) r.pastTick = (r.pastTick || 0) + 1;
    return true;
  };
  r.act = (seat, msg) => r.dispatch('action', seat, msg);
  return r;
}

// ── 1. Rules ─────────────────────────────────────────────────────────────────
console.log('--- road ---');
{
  const a = buildLeg(4242, 3);
  const b = buildLeg(4242, 3);
  ok(JSON.stringify([...a.curve]) === JSON.stringify([...b.curve]) && JSON.stringify(a.haz) === JSON.stringify(b.haz), 'buildLeg is deterministic');
  let blocked = 0;
  let total = 0;
  let leanMax = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (let leg = 0; leg < LEGS; leg++) {
      const t = buildLeg(seed * 7919, leg);
      leanMax = Math.max(leanMax, t.leans.length);
      if (!(t.forkZ < t.parkZ && t.parkZ < t.endZ && t.endZ < t.len)) blocked += 1000;
      // every cluster of hazards that cross within ~3 segments must leave a bus-sized gap
      const hs = t.haz.filter((h) => h.k !== 'sign').sort((p, q) => p.cz - q.cz);
      for (let i = 0; i < hs.length; i++) {
        const cl = hs.filter((h) => Math.abs(h.cz - hs[i].cz) <= 3 * PHYS.SEG);
        const iv = cl.map((h) => [hazX(h, h.cz) - h.w / 2, hazX(h, h.cz) + h.w / 2]).sort((p, q) => p[0] - q[0]);
        let edge = -1.0;
        let gap = 0;
        for (const [l, rr] of iv) {
          gap = Math.max(gap, l - edge);
          edge = Math.max(edge, rr);
        }
        gap = Math.max(gap, 1.0 - edge);
        total++;
        if (gap < PHYS.BUS_W + 0.08) blocked++;
      }
    }
  }
  ok(blocked === 0, 'every hazard cluster leaves a bus-sized gap (240 legs)', `${blocked}/${total} blocked`);
  ok(leanMax <= 4, 'leans per leg are capped', leanMax);
}

console.log('--- a whole tour (in-process) ---');
let endState = null;
{
  const R = makeRoom([0, 1]);
  ok(!R.dispatch('start', 1, {}), 'only the host can start');
  R.act(0, { t: 'pick', cid: 'james' });
  ok(!R.act(1, { t: 'pick', cid: 'james' }), 'cannot pick a character a present player holds');
  R.act(1, { t: 'pick', cid: 'kathy' });
  ok(R.dispatch('start', 0, {}), 'host starts the tour');
  let s = R.state();
  ok(s.phase === 'brief' && ['james', 'kathy'].includes(s.driver), 'first driver is a human', s.driver);

  let bus = null;
  let tp = -1;
  let steps = 0;
  const seenJob = new Set();
  const sizes = [];
  let parkedPerfect = 0;
  let drinkPhaseJuiceOk = 0;
  while (s.phase !== 'ending' && steps < 200000) {
    steps++;
    R.now += 50;
    s = R.state();
    if (s.phase === 'drive') {
      const tr = buildLeg(s.seed, s.leg);
      if (!bus || s.bus.tp !== tp) {
        bus = { z: s.bus.z, x: s.bus.x, v: s.bus.v };
        tp = s.bus.tp;
      }
      const target = safeLine(tr, bus.z + 500, bus.x, 7500);
      const steer = Math.max(-1, Math.min(1, (target - bus.x) * 3.2));
      bus = stepBus(tr, bus, { steer, brake: bus.z > tr.parkZ - (bus.v * bus.v) / (2 * PHYS.BRAKE) - 120, hold: (s.bus.pen || 0) > R.now }, 0.05, { drift: 0, grip: 1 });
      const drvSeat = Number(Object.entries(s.picks).find(([, c]) => c === s.driver)[0]);
      if (steps % 2 === 0) R.act(drvSeat, { t: 'pos', z: bus.z, x: bus.x, v: bus.v, tp });
      const pax = drvSeat === 0 ? 1 : 0;
      const paxCid = s.picks[pax];
      for (const j of s.jobs.filter((x) => !x.done)) {
        if (R.now < j.at + 700 || seenJob.has(`${j.id}:${j.by}`)) continue;
        if (j.open && !j.by) {
          seenJob.add(`${j.id}:${j.by}`);
          R.act(pax, { t: 'claim', id: j.id });
        } else if ((!j.open && j.cid === paxCid) || j.by === paxCid || ((j.k === 'lean' || j.k === 'photo') && j.res?.[paxCid] == null)) {
          seenJob.add(`${j.id}:${j.by}`);
          R.act(pax, { t: 'job', id: j.id, ok: Math.random() < 0.8, q: 0.8 });
        }
      }
    } else if (s.phase === 'arrive') {
      if (s.parked?.q === 'perfect') parkedPerfect++;
    } else if (s.phase === 'pour') {
      R.act(0, { t: 'drink', k: 'glass' });
      R.act(1, { t: 'drink', k: 'skull' });
      const dd = s.nextDriver;
      if (dd && s.ch[dd].drink === 'juice') drinkPhaseJuiceOk++;
    } else if (s.phase === 'game' && s.sg) {
      const t = R.now - s.sg.t0;
      if (t > 0) {
        if (s.sg.k === 'stomp') R.act(0, { t: 'stomp', n: Math.floor(t / 90) });
        if (s.sg.k === 'pour') R.act(1, { t: 'pour', r: Math.floor(t / POUR_ROUND_MS), v: s.sg.targets[Math.min(2, Math.floor(t / POUR_ROUND_MS))] + 0.03 });
        if (s.sg.k === 'quiz') R.act(0, { t: 'ans', q: Math.floor(t / QUIZ_Q_MS), i: 2 });
        if (s.sg.k === 'stack') R.act(1, { t: 'stack', n: (s.sg.n.kathy || 0) + 1, p: 1 });
        if (s.sg.k === 'cheese') for (const it of buildPlatter(s.seed, s.stop)) if (t > it.at + 200 && t < it.at + 700) R.act(0, { t: 'eat', id: it.id });
      }
    }
    if (steps % 4 === 0) R.dispatch('tick', null, null);
    if (steps % 40 === 0) {
      const vs = JSON.stringify(rules.view(R.state(), { seat: 0, players: R.players, now: R.now })).length;
      sizes.push(vs);
    }
  }
  endState = R.state();
  ok(endState.phase === 'ending', 'a two-player tour reaches the ending', `${((R.now - 1_000_000) / 60000).toFixed(1)} min`);
  ok(endState.final && Object.keys(endState.final.awards).length === CAST_IDS.length, 'every one of the 11 gets an award');
  ok(endState.photos.length === LEGS, 'one group photo per leg', endState.photos.length);
  ok(Object.values(endState.drives).reduce((a, b) => a + b, 0) === LEGS, 'six legs driven');
  ok(endState.drives.james >= 2 && endState.drives.kathy >= 2, 'the keys alternate between the two humans', JSON.stringify(endState.drives));
  ok(drinkPhaseJuiceOk > 0, "next leg's driver is on grape juice (2+ humans)");
  ok(parkedPerfect > 0, 'robot driver parks perfectly at least once');
  ok(!R.pastTick, 'nextTickAt is always in the future', R.pastTick || 0);
  ok(Math.max(...sizes) < 6000, 'views stay small', `max ${Math.max(...sizes)} B`);
  const minutes = (R.now - 1_000_000) / 60000;
  ok(minutes > 6 && minutes < 11, 'a tour lasts 6–11 minutes', minutes.toFixed(1));
  const v = rules.view(endState, { seat: 0, players: [0, 1], now: R.now });
  ok(v.final?.ending?.title && v.photos?.length === LEGS, 'ending view carries the verdict and the album');
}

console.log('--- authority ---');
{
  // Fresh drive, by hand.
  const R = makeRoom([0, 1]);
  R.act(0, { t: 'pick', cid: 'mike' });
  R.act(1, { t: 'pick', cid: 'kelly' });
  R.dispatch('start', 0, {});
  R.now = R.state().phaseEnds;
  R.dispatch('tick', null, null);
  let s = R.state();
  ok(s.phase === 'drive', 'brief → drive on the clock');
  const drvSeat = Number(Object.entries(s.picks).find(([, c]) => c === s.driver)[0]);
  const pax = drvSeat === 0 ? 1 : 0;
  const tr = buildLeg(s.seed, 0);

  R.now += 100;
  ok(!R.act(pax, { t: 'pos', z: s.bus.z + 500, x: 0, v: 5000, tp: s.bus.tp }), 'a passenger cannot move the bus');
  ok(!R.act(drvSeat, { t: 'pos', z: s.bus.z + 500, x: 0, v: 5000, tp: s.bus.tp - 1 }), 'a report with a stale tp is dropped');
  R.now += 100;
  R.act(drvSeat, { t: 'pos', z: s.bus.z + 200000, x: 0, v: 5000, tp: s.bus.tp });
  s = R.state();
  ok(s.bus.z < tr.startZ + 4000, 'a teleport is clamped to plausible speed', Math.round(s.bus.z));
  R.now += 20;
  ok(!R.act(drvSeat, { t: 'pos', z: s.bus.z + 10, x: 0, v: 5000, tp: s.bus.tp }), 'pos floods are rate-limited');

  // Hit a hazard dead on: the server judges it.
  const h = tr.haz.find((x) => x.kz === 0 && x.k !== 'sign');
  R.json = JSON.stringify({ ...R.state(), bus: { ...R.state().bus, z: h.cz - 300, x: hazX(h, h.cz), lastPosAt: R.now } });
  R.now += 100;
  R.act(drvSeat, { t: 'pos', z: h.cz + 300, x: hazX(h, h.cz), v: 7000, tp: R.state().bus.tp });
  s = R.state();
  ok(s.hits.includes(h.id) && s.rating === 100 + HAZARDS[h.k].rating, `driving through a ${h.k} is a hit`, s.rating);
  R.now += 100;
  R.act(drvSeat, { t: 'pos', z: h.cz + 900, x: hazX(h, h.cz), v: 7000, tp: s.bus.tp });
  ok(R.state().hits.filter((x) => x === h.id).length === 1, 'a hazard is only ever judged once');

  // Jobs: owner only, once.
  s = R.state();
  const paxCid = s.picks[pax];
  s.jobs.push({ id: 999, k: 'bottle', cid: paxCid, sub: null, by: null, open: false, at: R.now, end: R.now + 3000, r: 2, dir: null, conga: 0, res: null, done: false, ok: null });
  R.json = JSON.stringify(s);
  ok(!R.act(drvSeat, { t: 'job', id: 999, ok: true }), "the driver cannot answer a passenger's job");
  ok(R.act(pax, { t: 'job', id: 999, ok: true }), 'the owner answers their job');
  ok(!R.act(pax, { t: 'job', id: 999, ok: false }), 'a job answers only once');
  s = R.state();
  s.jobs.push({ id: 998, k: 'hat', cid: 'doug', sub: 'doug', by: null, open: true, at: R.now, end: R.now + 6000, r: 1, dir: null, conga: 0, res: null, done: false, ok: null });
  R.json = JSON.stringify(s);
  ok(!R.act(drvSeat, { t: 'claim', id: 998 }), 'the driver cannot claim an NPC job');
  ok(R.act(pax, { t: 'claim', id: 998 }), 'a passenger claims an NPC job');
  ok(R.state().jobs.find((j) => j.id === 998).by === paxCid, 'the claim sticks');
  ok(!R.act(pax, { t: 'drink', k: 'skull' }), 'no drinking on the bus');

  // Wrong turn at the fork.
  s = R.state();
  R.json = JSON.stringify({ ...s, bus: { ...s.bus, z: tr.forkZ - 400, x: -tr.forkSide * 0.6, lastPosAt: R.now, auto: false } });
  R.now += 100;
  const tpBefore = R.state().bus.tp;
  R.act(drvSeat, { t: 'pos', z: tr.forkZ + 300, x: -tr.forkSide * 0.6, v: 7000, tp: tpBefore });
  s = R.state();
  ok(s.legLog.wrong && s.bus.pen > R.now && s.bus.tp === tpBefore + 1, 'the wrong branch is a U-turn penalty and a teleport');

  // Park on the line.
  R.json = JSON.stringify({ ...s, bus: { ...s.bus, z: tr.parkZ - 200, x: 0, pen: 0, lastPosAt: R.now } });
  R.now += 100;
  R.act(drvSeat, { t: 'pos', z: tr.parkZ + 50, x: 0.05, v: 0, tp: R.state().bus.tp });
  s = R.state();
  ok(s.phase === 'arrive' && s.parked.q === 'perfect', 'stopping on the line is a perfect park', s.parked?.q);
  ok(s.nextDriver && s.nextDriver !== s.driver, 'the keys go to the other human', s.nextDriver);

  // Pour phase: the designated driver can't change from juice.
  R.now = s.phaseEnds;
  R.dispatch('tick', null, null);
  s = R.state();
  const ddSeat = Number(Object.entries(s.picks).find(([, c]) => c === s.nextDriver)[0]);
  const otherSeat = ddSeat === 0 ? 1 : 0;
  ok(s.phase === 'pour' && s.ch[s.nextDriver].drink === 'juice', 'next driver is on the juice');
  ok(!R.act(ddSeat, { t: 'drink', k: 'skull' }), 'the designated driver cannot order a skull');
  ok(R.act(otherSeat, { t: 'drink', k: 'skull' }), 'a passenger can');
  ok(!R.act(otherSeat, { t: 'drink', k: 'champagne' }), 'only real pours');

  // Game phase limits.
  R.now = s.phaseEnds;
  R.dispatch('tick', null, null);
  s = R.state();
  ok(s.phase === 'game', 'pour → game');
  const sg = s.sg;
  R.now = sg.t0 + 1000;
  if (sg.k === 'stomp') {
    R.act(otherSeat, { t: 'stomp', n: 500 });
    ok(R.state().sg.n[s.picks[otherSeat]] <= 20, 'stomps are rate-capped', R.state().sg.n[s.picks[otherSeat]]);
  } else if (sg.k === 'stack') {
    ok(!R.act(otherSeat, { t: 'stack', n: 5 }), 'stack must count up by one');
    ok(R.act(otherSeat, { t: 'stack', n: 1 }), 'first case lands');
    R.now += 100;
    ok(!R.act(otherSeat, { t: 'stack', n: 2 }), 'cases cannot land faster than a human drops them');
  } else if (sg.k === 'quiz') {
    ok(!R.act(otherSeat, { t: 'ans', q: 3, i: 0 }), 'cannot answer a future question');
    ok(R.act(otherSeat, { t: 'ans', q: 0, i: 0 }), 'answers the current question');
    ok(!R.act(otherSeat, { t: 'ans', q: 0, i: 1 }), 'one answer per question');
    const qv = rules.view(R.state(), { seat: otherSeat, players: R.players, now: R.now }).sg;
    ok(qv.qs[0].a === null && qv.qs[1].opts === null, 'quiz answers and future questions stay hidden');
    ok(buildQuiz(s.seed, s.stop).length === 5, 'five questions');
  } else if (sg.k === 'cheese') {
    const items = buildPlatter(s.seed, s.stop);
    const late = items[items.length - 1];
    ok(!R.act(otherSeat, { t: 'eat', id: late.id }), 'cannot eat what is not on the board yet');
    const first = items[0];
    R.now = sg.t0 + first.at + 100;
    const ate = R.act(otherSeat, { t: 'eat', id: first.id });
    ok(ate && !R.act(ddSeat, { t: 'eat', id: first.id }), 'each item is eaten once');
  } else if (sg.k === 'pour') {
    ok(!R.act(otherSeat, { t: 'pour', r: 2, v: 0.5 }), 'cannot pour a later round early');
    ok(R.act(otherSeat, { t: 'pour', r: 0, v: 0.5 }), 'pours round one');
    ok(!R.act(otherSeat, { t: 'pour', r: 0, v: 0.6 }), 'one pour per round');
  }

  // Idle: nobody connected pauses the clock; 'hi' resumes and shifts it.
  const endsBefore = R.state().phaseEnds;
  R.players = [];
  R.dispatch('tick', null, null);
  ok(R.state().idleAt && rules.nextTickAt(R.state()) === null, 'an empty room stops ticking');
  R.now += 60000;
  R.players = [0, 1];
  R.act(0, { t: 'hi' });
  ok(R.state().phaseEnds === endsBefore + 60000 && !R.state().idleAt, 'coming back resumes where it paused');
}

console.log('--- regressions (QA review) ---');
{
  const R = makeRoom([0, 1]);
  ok(!R.act(0, { t: 'pick', cid: 'toString' }) && !R.act(0, { t: 'pick', cid: '__proto__' }), 'object-prototype names are not characters');
  // seat 1 picks Doug then leaves; seat 2 arrives without a pick; start must not deal Doug twice
  R.act(1, { t: 'pick', cid: 'doug' });
  R.players = [0, 2];
  R.seats.push({ seat: 2, name: 'P2' });
  R.act(0, { t: 'pick', cid: 'mike' });
  R.dispatch('start', 0, {});
  let s = R.state();
  ok(s.picks[2] && s.picks[2] !== 'doug' && s.picks[2] !== 'mike', 'start never deals a character someone already holds', s.picks[2]);
  ok(!R.act(2, { t: 'hi' }), "'hi' on a live room is not a broadcast");
  // the driver's 10 Hz reports must not push the tick back
  R.now = s.phaseEnds;
  R.dispatch('tick', null, null);
  s = R.state();
  const drvSeat = Number(Object.entries(s.picks).find(([st, c]) => c === s.driver && R.players.includes(Number(st)))[0]);
  const tickAt = rules.nextTickAt(s);
  let z = s.bus.z;
  for (let i = 0; i < 3; i++) {
    R.now += 60; // all inside the 200 ms tick window
    z += 500;
    R.act(drvSeat, { t: 'pos', z, x: 0, v: 7000, tp: R.state().bus.tp });
  }
  ok(rules.nextTickAt(R.state()) === tickAt, 'position reports do not delay the tick', `${rules.nextTickAt(R.state()) - tickAt} ms`);
  ok(!('qseed' in rules.view(R.state(), { seat: 0, players: R.players, now: R.now })), 'the quiz seed never reaches a phone');
  // straight into the fork signpost = a stop and the right way, not a shortcut
  const tr = buildLeg(s.seed, 0);
  s = R.state();
  R.json = JSON.stringify({ ...s, bus: { ...s.bus, z: tr.forkZ - 300, x: 0, lastPosAt: R.now, auto: false } });
  R.now += 100;
  const tp0 = R.state().bus.tp;
  R.act(drvSeat, { t: 'pos', z: tr.forkZ + 200, x: 0, v: 7000, tp: tp0 });
  s = R.state();
  ok(s.hits.length && s.bus.pen > R.now && s.bus.tp === tp0 + 1 && s.bus.side === tr.forkSide, 'hitting the signpost stops the bus and points it the right way');
}
{
  const R = makeRoom([0, 1]);
  R.act(0, { t: 'pick', cid: 'nick' });
  R.act(1, { t: 'pick', cid: 'louise' });
  R.dispatch('start', 0, {});
  let s = R.state();
  // jump straight to a stomp game
  s.phase = 'game';
  s.stop = 0;
  s.sg = { k: 'stomp', t0: R.now, n: {}, at: {} };
  s.phaseEnds = R.now + 12000;
  R.json = JSON.stringify(s);
  R.now += 500;
  for (let i = 1; i <= 400; i++) R.act(0, { t: 'stomp', n: i * 3 });
  ok(R.state().sg.n.nick <= 10, 'a stomp flood is capped by elapsed time', R.state().sg.n.nick);
  s = R.state();
  s.sg = { k: 'cheese', t0: R.now - 20000, eaten: {}, cnt: {} };
  s.phaseEnds = R.now + 15000;
  R.json = JSON.stringify(s);
  const items = buildPlatter(s.seed, 0);
  R.json = JSON.stringify({ ...R.state(), sg: { ...R.state().sg, t0: R.now - items[1].at - 100 } });
  const a = R.act(0, { t: 'eat', id: items[0].id });
  const b = R.act(0, { t: 'eat', id: items[1].id });
  ok(a && !b, 'one bite at a time (cheese cooldown)');
}

console.log('--- solo + late join ---');
{
  const R = makeRoom([0]);
  R.act(0, { t: 'pick', cid: 'john' });
  R.dispatch('start', 0, {});
  let s = R.state();
  ok(s.driver === 'john', 'alone, you drive');
  R.now = s.phaseEnds;
  R.dispatch('tick', null, null);
  // Nobody sends pos: the autopilot brings the bus in.
  for (let i = 0; i < 1200 && R.state().phase === 'drive'; i++) {
    R.now += 200;
    R.dispatch('tick', null, null);
  }
  s = R.state();
  ok(s.phase === 'arrive' && s.parked.q === 'auto', 'a silent driver gets the autopilot', s.parked?.q);
  R.now = s.phaseEnds;
  R.dispatch('tick', null, null);
  ok(R.state().ch.john.drink !== 'juice', 'solo: no forced juice');
  // A friend turns up mid-tour and becomes Louise.
  R.players = [0, 1];
  R.seats.push({ seat: 1, name: 'Late' });
  ok(R.act(1, { t: 'pick', cid: 'louise' }), 'a late joiner picks a free character');
  ok(!R.act(1, { t: 'pick', cid: 'nick' }), '…and keeps them for the rest of the tour');
  const v = rules.view(R.state(), { seat: 1, players: [0, 1], now: R.now });
  ok(v.me === 'louise', 'their view is Louise');
}

if (process.env.SV_RULES_ONLY) finish();

// ── 2. Browser ───────────────────────────────────────────────────────────────
console.log('');
console.log(`--- browser (${PHONES} phones, ${BASE}) ---`);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
async function phone(tag) {
  // Isolated contexts: separate localStorage per phone.
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${tag}] ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
  p.tag = tag;
  return p;
}
const view = (p) => p.evaluate(() => window.__sv?.state() ?? null);
const shot = async (p, name) => {
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` });
};

try {
  const A = await phone('A');
  await A.goto(`${URL}?bot=1&autostart=${PHONES}`, { waitUntil: 'networkidle2' });
  await A.type('#ar-name', 'James');
  await A.click('#ar-create');
  await A.waitForFunction('window.__sv && window.__sv.state() && window.__sv.state().ph', { timeout: 15000 });
  const code = await A.evaluate(() => window.__sv.room.code());
  ok(/^[A-Z]{5}$/.test(code), 'room code is 5 letters', code);
  const phones = [A];
  for (let i = 1; i < PHONES; i++) {
    const P = await phone(String.fromCharCode(65 + i));
    await P.goto(`${URL}?bot=1&c=${code}`, { waitUntil: 'networkidle2' });
    await P.type('#ar-name', `Friend ${i}`);
    await P.click('#ar-join');
    phones.push(P);
  }
  await A.waitForFunction(`Object.keys(window.__sv.state()?.hm || {}).length >= ${PHONES} || window.__sv.state()?.ph !== 'lobby'`, { timeout: 15000 });
  await shot(A, '00-lobby');
  const mine = await Promise.all(phones.map((p) => p.evaluate(() => window.__sv.me())));
  ok(new Set(mine).size === PHONES && mine.every(Boolean), 'every phone has its own character', mine.join(','));

  await A.waitForFunction("window.__sv.state()?.ph === 'drive'", { timeout: 30000 });
  ok(true, 'the tour starts and the bus leaves');

  // Shots at the interesting places on leg 1, and a mid-drive reload.
  const shotsTaken = new Set();
  let reloaded = false;
  let lateJoined = false;
  const t0 = Date.now();
  let s = null;
  while (Date.now() - t0 < 14 * 60000) {
    s = await view(A);
    if (!s) {
      await sleep(300);
      continue;
    }
    if (s.ph === 'ending') break;
    if (s.ph === 'drive' && s.bus) {
      const tr = buildLeg(s.seed, s.leg);
      const z = s.bus.z;
      const drvPhone = phones[mine.indexOf(s.driver)] || A;
      const paxPhone = phones.find((p, i) => mine[i] !== s.driver) || A;
      const marks = [
        ['drive-start', tr.startZ + 9000],
        ['fork-approach', tr.forkZ - 6500],
        ['fork-split', tr.forkZ + 2600],
        ['carpark', tr.parkZ - 3800],
      ];
      for (const [name, at] of marks) {
        const key = `${s.leg}:${name}`;
        if ((s.leg === 0 || s.leg === LEGS - 1) && !shotsTaken.has(key) && z >= at && z < at + 4000) {
          shotsTaken.add(key);
          await shot(drvPhone, `leg${s.leg}-${name}-driver`);
          await shot(paxPhone, `leg${s.leg}-${name}-passenger`);
        }
      }
      if (s.leg === 1 && !reloaded && z > tr.startZ + 30000 && PHONES >= 3) {
        reloaded = true;
        const P = paxPhone;
        const before = await P.evaluate(() => window.__sv.me());
        await P.reload({ waitUntil: 'networkidle2' });
        await P.waitForFunction('window.__sv && window.__sv.state() && window.__sv.me()', { timeout: 15000 });
        const after = await P.evaluate(() => window.__sv.me());
        ok(before === after, 'a reload mid-drive returns to the same character', `${before} → ${after}`);
      }
      if (s.leg === 1 && !lateJoined) {
        lateJoined = true;
        const L = await phone('Late');
        await L.goto(`${URL}?bot=1&c=${code}`, { waitUntil: 'networkidle2' });
        await L.type('#ar-name', 'Latecomer');
        await L.click('#ar-join');
        await L.waitForFunction('window.__sv && window.__sv.state() && window.__sv.state().ph', { timeout: 15000 });
        await shot(L, 'late-join-pick');
        const free = await L.evaluate(() => {
          const g = window.__sv.state();
          return ['mandyh', 'doug', 'kathy', 'david', 'john', 'kelly', 'louise', 'nick', 'james', 'mandyf', 'mike'].find((id) => !g.hm[id]);
        });
        await L.evaluate((cid) => window.__sv.room.send({ t: 'pick', cid }), free);
        await L.waitForFunction('window.__sv.me()', { timeout: 8000 });
        ok((await L.evaluate(() => window.__sv.me())) === free, 'a late joiner picks a free character mid-tour', free);
        phones.push(L);
        mine.push(free);
      }
    }
    if ((s.ph === 'pour' || s.ph === 'game' || s.ph === 'tally' || s.ph === 'arrive' || s.ph === 'brief') && s.stop === 0) {
      const key = `${s.ph}:${s.sg?.k || ''}`;
      if (!shotsTaken.has(key)) {
        shotsTaken.add(key);
        await sleep(s.ph === 'game' ? 5500 : 1200);
        await shot(A, `stop0-${s.ph}`);
      }
    }
    if (s.ph === 'game' && !shotsTaken.has(`game:${s.sg?.k}`)) {
      shotsTaken.add(`game:${s.sg?.k}`);
      await sleep(6000);
      await shot(phones[1] || A, `game-${s.sg?.k}`);
    }
    await sleep(250);
  }
  ok(s?.ph === 'ending', 'the browser tour reaches the ending', s?.ph);
  await sleep(2500);
  const finals = await Promise.all(phones.map((p) => view(p)));
  ok(finals.every((f) => f?.ph === 'ending'), 'every phone is on the ending');
  ok(new Set(finals.map((f) => f?.final?.rating)).size === 1, 'every phone agrees on the rating', finals.map((f) => f?.final?.rating).join(','));
  ok(finals.every((f) => f?.photos?.length === LEGS), 'every phone has the six-photo album');
  for (const [i, p] of phones.entries()) await shot(p, `ending-${p.tag || i}`);
  if (SHOTS) {
    await A.evaluate(() => document.querySelector('#album')?.scrollIntoView());
    await shot(A, 'ending-album');
  }
  console.log(`      rating ${finals[0]?.final?.rating} — ${finals[0]?.final?.ending?.title}`);
} catch (err) {
  ok(false, 'browser run threw', err.message);
} finally {
  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e));
  ok(real.length === 0, 'no console errors or warnings', real.slice(0, 8).join(' | '));
  await browser.close();
}
finish();
