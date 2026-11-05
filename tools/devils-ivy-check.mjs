/* ============================================================================
   ARCADE — headless check for /arcade/devils-ivy
   ----------------------------------------------------------------------------
   Same approach as tools/summit-fever-check.mjs (there is no test framework in
   this repo; verification is by running the real code and driving real
   browsers):

   1. WORLD, in-process. The kitchen's box rules (nothing too thin, no slots),
      the surface walker's invariants over a few hundred thousand random steps
      (always on a surface, never inside one, heading in the surface, unit
      length), determinism (same logs → same round, bit for bit) and that a
      forked prediction ends exactly where the real run does.

   2. RULES, in-process, through a faithful copy of ArcadeRoom.dispatch —
      including its JSON round trip and its "`next === state` means nothing
      happened" rule, which silently swallowed every tick the first time this
      game ran. Lobby, bot setting, host-only start, countdown, inputs (late,
      early, garbage, flood), deaths, scoring, a cold-cache replay mid-round,
      round over, match over, awards, rematch — and a "phone" replaying the
      logs that must agree with the server on every vine at every step.

   3. BROWSER, two isolated phones against a running Worker: create, join by
      code, start, steer, both phones agreeing on every vine, no console
      errors.

     npx wrangler dev --port 8788 --local     # in one terminal
     node tools/devils-ivy-check.mjs          # in another

   ARCADE_BASE=<origin>   run the browser pass against a deployed Worker
   DV_RULES_ONLY=1        skip the browser pass
   DV_POSTER=1            also render public/arcade/devils-ivy/art/cabinet.png
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import rules, { _dropSimCache } from '../workers/arcade/games/devils-ivy.js';
import {
  BOXES, ROOM, Sim, solidAt, walk, turn, sampleSurface, code, botDecide, TICK_MS, DELAY_TICKS,
} from '../public/arcade/devils-ivy/world.js';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.ARCADE_BASE || 'http://127.0.0.1:8788';
const URL = `${BASE}/arcade/devils-ivy/`;

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function finish() {
  console.log('');
  console.log(fails.length ? `${fails.length} FAILED:\n  ${fails.join('\n  ')}` : 'ALL PASSED');
  process.exit(fails.length ? 1 : 0);
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ── 1. World ─────────────────────────────────────────────────────────────────
console.log('--- world ---');
{
  const R = [ROOM.w, ROOM.h, ROOM.d];
  const problems = [];
  for (const b of BOXES) for (let a = 0; a < 3; a++) if (b.max[a] - b.min[a] < 0.12 - 1e-9) problems.push(`${b.id} thinner than 12 cm`);
  for (let i = 0; i < BOXES.length; i++) {
    const A = BOXES[i];
    for (let j = i + 1; j < BOXES.length; j++) {
      const B = BOXES[j];
      for (let a = 0; a < 3; a++) {
        const u = (a + 1) % 3;
        const v = (a + 2) % 3;
        const ou = Math.min(A.max[u], B.max[u]) - Math.max(A.min[u], B.min[u]);
        const ov = Math.min(A.max[v], B.max[v]) - Math.max(A.min[v], B.min[v]);
        if (ou <= 0 || ov <= 0) continue;
        const gap = Math.max(B.min[a] - A.max[a], A.min[a] - B.max[a]);
        if (gap > 1e-9 && gap < 0.14) problems.push(`${A.id}/${B.id} slot ${gap.toFixed(3)} m`);
      }
    }
    for (let a = 0; a < 3; a++) {
      const g0 = A.min[a];
      const g1 = R[a] - A.max[a];
      if ((g0 > 1e-9 && g0 < 0.14) || (g1 > 1e-9 && g1 < 0.14)) problems.push(`${A.id} slot against a wall`);
    }
  }
  ok(problems.length === 0, 'kitchen boxes: none thinner than 12 cm, no slots under 14 cm', problems.join('; '));

  const rnd = seeded(12345);
  let viol = 0;
  let steps = 0;
  let folds = 0;
  for (let n = 0; n < 400; n++) {
    const s = sampleSurface({ rs: n * 7919 + 1 }, 0.05);
    const w = { x: s.x, y: s.y, z: s.z, na: s.na, ns: s.ns, dx: 0, dy: 0, dz: 0 };
    const d = [0, 0, 0];
    const ang = rnd() * Math.PI * 2;
    d[(s.na + 1) % 3] = Math.cos(ang);
    d[(s.na + 2) % 3] = Math.sin(ang);
    [w.dx, w.dy, w.dz] = d;
    let steer = 0;
    for (let t = 0; t < 1200; t++) {
      if (rnd() < 0.05) steer = Math.floor(rnd() * 3) - 1;
      if (t % 3 === 0 && steer) turn(w, steer);
      folds += walk(w, 0.012 + rnd() * 0.02, null);
      steps++;
      const nx = w.na === 0 ? w.ns : 0;
      const ny = w.na === 1 ? w.ns : 0;
      const nz = w.na === 2 ? w.ns : 0;
      const above = solidAt(w.x + nx * 1e-3, w.y + ny * 1e-3, w.z + nz * 1e-3);
      const below = solidAt(w.x - nx * 1e-3, w.y - ny * 1e-3, w.z - nz * 1e-3);
      const dn = w.dx * nx + w.dy * ny + w.dz * nz;
      const len = Math.sqrt(w.dx * w.dx + w.dy * w.dy + w.dz * w.dz);
      if (above !== -1 || below === -1 || Math.abs(dn) > 1e-12 || Math.abs(len - 1) > 1e-9) {
        viol++;
        break;
      }
    }
  }
  ok(viol === 0, `walker stays on a surface over ${steps.toLocaleString()} random steps and ${folds.toLocaleString()} edges`, `${viol} walkers left the surface`);

  function run(seed, ticks, forkAt = -1) {
    const sim = new Sim(seed, 3);
    const r = seeded(seed ^ 99);
    for (let k = 1; k <= ticks; k++) for (const v of sim.vines) if (r() < 0.08) v.log.push([k, code(Math.floor(r() * 3) - 1, r() < 0.2)]);
    let s = sim;
    for (let k = 0; k < ticks; k++) {
      if (k === forkAt) s = s.fork();
      s.step();
    }
    return JSON.stringify(s.vines.map((v) => [v.w.x, v.w.y, v.w.z, v.w.dx, v.alive, v.deadTick, v.by, v.s, v.energy]));
  }
  let det = true;
  let fork = true;
  for (const seed of [7, 777, 4242, 99991]) {
    const a = run(seed, 900);
    det = det && a === run(seed, 900);
    fork = fork && a === run(seed, 900, 250);
  }
  ok(det, 'same seed + same logs → identical round, bit for bit');
  ok(fork, 'a forked prediction ends exactly where the real run does');

  const sim = new Sim(1, 3);
  const spots = sim.vines.map((v) => v.w);
  const minD = Math.min(...[[0, 1], [0, 2], [1, 2]].map(([a, b]) => Math.hypot(spots[a].x - spots[b].x, spots[a].y - spots[b].y, spots[a].z - spots[b].z)));
  ok(minD >= 0.9, 'spawns are spread out', `${minD.toFixed(2)} m apart at closest`);

  // Bots should survive a while and go for the sun.
  const lens = [];
  for (let seed = 1; seed <= 8; seed++) {
    const s = new Sim(seed * 1000003, 3);
    const r = seeded(seed);
    while (s.alive() > 1 && s.tick < 3750) {
      if (s.tick % 2 === 0) for (const v of s.vines) if (v.alive) { const c = botDecide(s, v, r); if (c !== v.code) v.log.push([s.tick + 1, c]); }
      s.step();
    }
    lens.push(s.tick / 25);
  }
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  ok(avg > 8 && avg < 90, 'three bots play a round of sensible length', `${avg.toFixed(1)} s average`);
}

// ── 2. Rules, through a copy of ArcadeRoom.dispatch ──────────────────────────
console.log('');
console.log('--- rules ---');
{
  const realRandom = Math.random;
  Math.random = seeded(2026);

  let now = 1_800_000_000_000;
  let json = JSON.stringify(rules.init());
  const seats = [
    { seat: 0, name: 'James', token: 'a' },
    { seat: 1, name: 'Justin', token: 'b' },
  ];
  let players = [0, 1];
  const views = {};
  let changed = 0;

  // Mirrors workers/arcade/room.js: fresh parse in, `next === state` = nothing happened.
  function dispatch(kind, seat, msg) {
    const state = JSON.parse(json);
    const ctx = { seat, now, players, seats, msg };
    let next = state;
    if (kind === 'start') next = rules.start(state, ctx) ?? state;
    else if (kind === 'rematch') next = rules.rematch(state, ctx) ?? state;
    else if (kind === 'tick') next = rules.tick(state, ctx) ?? state;
    else next = rules.action(state, ctx) ?? state;
    if (next === state) return false;
    json = JSON.stringify(next);
    changed++;
    for (const p of players) views[p] = JSON.parse(JSON.stringify(rules.view(next, { seat: p, players, seats, now })));
    return true;
  }
  const st = () => JSON.parse(json);
  const due = () => {
    const at = rules.nextTickAt(st());
    return at != null && now >= at;
  };

  // phones replaying the logs — merging whole logs or {from, tail} exactly
  // like the page does, and asking for a resync when too far behind
  const phones = {};
  let disagreements = 0;
  let tailsSeen = 0;
  let resyncs = 0;
  function phoneCheck(p) {
    const v = views[p];
    if (!v?.round) return;
    let ph = phones[p];
    if (!ph || ph.id !== v.round.id) {
      ph = phones[p] = { id: v.round.id, sim: new Sim(v.round.seed, v.round.vines.length), logs: v.round.vines.map(() => []) };
    }
    let missing = false;
    v.round.vines.forEach((rv, i) => {
      if (rv.log) ph.logs[i] = rv.log;
      else {
        tailsSeen++;
        if (ph.logs[i].length >= rv.lt.from) {
          ph.logs[i].length = rv.lt.from;
          ph.logs[i].push(...rv.lt.tail);
        } else missing = true;
      }
    });
    if (missing) {
      resyncs++;
      dispatch('action', p, { t: 'sync' });
      return;
    }
    ph.logs.forEach((log, i) => (ph.sim.vines[i].log = log));
    while (ph.sim.tick < v.round.simTick) ph.sim.step();
    v.round.vines.forEach((rv, i) => {
      const sv = ph.sim.vines[i];
      if (sv.alive !== rv.alive || sv.deadTick !== rv.deadTick || sv.by !== rv.by) disagreements++;
    });
  }

  ok(dispatch('action', 1, { t: 'bots', n: 2 }) === false, 'only the host sets the bots');
  ok(dispatch('action', 0, { t: 'bots', n: 9 }) === false, 'a silly bot count is ignored');
  ok(dispatch('action', 0, { t: 'bots', n: 1 }) && views[0].bots === 1, 'host sets one bot', `botsIfStarted ${views[0].botsIfStarted}`);
  ok(dispatch('start', 1, {}) === false, 'only the host starts');
  ok(dispatch('start', 0, {}) && views[0].phase === 'countdown', 'host starts → countdown');
  ok(views[0].round.vines.length === 3 && views[0].round.vines[2].bot, 'two people + one bot vine', views[0].round.vines.map((v) => v.name).join(', '));
  ok(views[0].me === 0 && views[1].me === 1, 'each phone knows which vine is theirs');
  ok(dispatch('action', 0, { t: 'in', k: 1, c: 2, q: 1 }) && st().round.vines[0].log.length === 1, 'steering during the countdown is kept for tick 1');

  // countdown → play
  now = st().phaseEnds + 1;
  ok(dispatch('tick', null, null) && views[0].phase === 'play', 'countdown ends → play (tick returns a NEW object)');

  // play for a while: inputs from both phones, ticks every 100 ms
  const r = seeded(77);
  let lastPhase = 'play';
  let rounds = 0;
  let coldReplays = 0;
  let checkedLate = false;
  for (let step = 0; step < 60000 && lastPhase !== 'matchover'; step++) {
    now += 20;
    if (due()) dispatch('tick', null, null);
    const v0 = views[0];
    if (v0?.phase === 'play') {
      for (const p of [0, 1]) {
        if (r() < 0.025) {
          const k = Math.floor((now - v0.round.startAt) / TICK_MS) + 1;
          dispatch('action', p, { t: 'in', k, c: code(Math.floor(r() * 3) - 1, r() < 0.15), q: step });
        }
      }
      if (!checkedLate && v0.round.simTick > 30 && v0.round.vines[0].alive) {
        checkedLate = true;
        const before = st().round;
        dispatch('action', 0, { t: 'in', k: 3, c: 0, q: 1e6 });
        const log = st().round.vines[0].log;
        ok(log[log.length - 1][0] >= before.simTick + 1, 'a late input lands on an undecided tick, never in the past', `tick ${log[log.length - 1][0]}`);
        const nowTick = Math.floor((now - before.startAt) / TICK_MS);
        dispatch('action', 0, { t: 'in', k: nowTick + 500, c: 1, q: 1e6 + 1 });
        const log2 = st().round.vines[0].log;
        ok(log2[log2.length - 1][0] <= nowTick + 12, 'an input stamped far in the future is pulled back');
        ok(dispatch('action', 0, { t: 'in', k: nowTick, c: 9, q: 1 }) === false, 'a garbage input code is ignored');
        // a quick tap that arrives late, press and release together
        const sim0 = st().round.simTick;
        dispatch('action', 0, { t: 'in', k: sim0 - 6, c: 2, q: 1e6 + 2 });
        dispatch('action', 0, { t: 'in', k: sim0 - 4, c: 1, q: 1e6 + 3 });
        const tap = st().round.vines[0].log.slice(-2);
        ok(tap.length === 2 && tap[0][1] === 2 && tap[1][1] === 1 && tap[1][0] === tap[0][0] + 1, 'a late press-and-release pair still turns for a tick', JSON.stringify(tap));
        // simulated eviction mid-round
        _dropSimCache();
        coldReplays++;
      }
      if (step % 900 === 450 && v0.round.simTick > 0) {
        _dropSimCache();
        coldReplays++;
      }
    }
    // phone 0 keeps up; phone 1 only looks now and then (a phone in a
    // pocket), so it has to splice tails and sometimes ask for a resync
    if (step % 10 === 0) phoneCheck(0);
    if (step % 400 === 0) phoneCheck(1);
    const ph = views[0]?.phase;
    if (ph !== lastPhase) {
      if (ph === 'roundover') rounds++;
      lastPhase = ph;
    }
  }
  ok(disagreements === 0, 'phones replaying the logs agree with the server on every vine, every check', `${disagreements} disagreements`);
  ok(coldReplays > 0, 'rounds survive a dropped simulation cache (replayed from the logs)', `${coldReplays} cold replays`);
  ok(rounds >= 2, 'rounds end and new ones begin', `${rounds} rounds`);
  ok(lastPhase === 'matchover', 'someone reaches the target and the match ends', views[0]?.scores.map((s) => `${s.name}:${s.pts}`).join(' '));
  const champ = views[0].scores.find((s) => s.key === views[0].champion);
  ok(champ && champ.pts >= views[0].target && views[0].scores.every((s) => s === champ || s.pts < champ.pts), 'the champion has the most points, at least the target');
  ok(Array.isArray(views[0].awards) && views[0].awards.length >= 2, 'awards are handed out', views[0].awards.map((a) => a.title).join(', '));

  // a dead vine can't steer; rematch resets
  ok(dispatch('rematch', 1, {}) === false, 'only the host can call a rematch');
  ok(dispatch('rematch', 0, {}) && views[0].phase === 'countdown' && views[0].scores.every((s) => s.pts === 0), 'rematch → fresh countdown, scores back to zero');

  // long logs: views carry tails, and a phone that wasn't looking resyncs
  now = st().phaseEnds + 1;
  dispatch('tick', null, null);
  for (let i = 0; i < 70; i++) {
    now += 60;
    if (due()) dispatch('tick', null, null);
    const k = Math.floor((now - st().round.startAt) / TICK_MS) + 1;
    dispatch('action', 0, { t: 'in', k, c: i % 2 ? 2 : 0, q: 500 + i });
    if (i % 5 === 0) phoneCheck(0);
  }
  const longest = Math.max(...st().round.vines.map((v) => v.log.length));
  phoneCheck(1);
  phoneCheck(1);
  ok(longest > 48 && tailsSeen > 0 && resyncs > 0 && disagreements === 0, 'views send log tails, and a phone that fell behind resyncs and agrees', `${longest} entries, ${tailsSeen} tails, ${resyncs} resyncs, ${disagreements} disagreements`);

  // flood guard
  dispatch('tick', null, null);
  let accepted = 0;
  for (let i = 0; i < 80; i++) if (dispatch('action', 0, { t: 'in', k: 5 + i, c: i % 2 ? 2 : 0, q: i })) accepted++;
  ok(accepted <= 40, 'input flood is capped per second', `${accepted} of 80 accepted`);


  // a round never starts in an empty room
  {
    const keep = json;
    const s = JSON.parse(json);
    s.phase = 'roundover';
    s.phaseEnds = now - 1;
    json = JSON.stringify(s);
    const saved = players;
    players = [];
    dispatch('tick', null, null);
    ok(st().phase === 'lobby', 'no round starts with nobody in the room');
    players = saved;
    json = keep;
  }

  // everyone leaves → back to the lobby after the grace period
  players = [];
  now += 1000;
  dispatch('tick', null, null);
  ok(st().phase === 'play', 'a phone dropping out briefly does not end the match');
  now += 25000;
  dispatch('tick', null, null);
  ok(st().phase === 'lobby', 'an empty room goes back to the lobby');

  ok(DELAY_TICKS * TICK_MS >= 200, 'the server decides at least 200 ms behind real time', `${DELAY_TICKS * TICK_MS} ms`);
  console.log(`      (${changed} state changes in the rules pass)`);
  Math.random = realRandom;
}

if (process.env.DV_RULES_ONLY) finish();

// ── 3. Browser ───────────────────────────────────────────────────────────────
console.log('');
console.log(`--- browser (two phones, ${BASE}) ---`);
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
async function phone(tag, w = 390, h = 844) {
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${tag}] ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
  return p;
}
const snap = (p) =>
  p.evaluate(() => {
    const I = window.__ivy;
    if (!I?.G) return null;
    return {
      phase: I.G.phase,
      simTick: I.G.round?.simTick ?? null,
      conf: I.R?.demo ? null : I.R?.sim.tick,
      heads: I.R && !I.R.demo ? I.R.sim.vines.map((v) => `${v.w.x.toFixed(5)},${v.w.y.toFixed(5)},${v.w.z.toFixed(5)},${v.alive}`) : null,
      me: I.R?.me,
    };
  });

try {
  const A = await phone('A');
  await A.goto(URL, { waitUntil: 'networkidle2' });
  ok(await A.evaluate(() => !!window.__ivy?.R?.demo), 'landing page shows the bot demo behind the form');
  await A.type('#ar-name', 'James');
  await A.click('#ar-create');
  await A.waitForFunction('window.__ivy && window.__ivy.G && window.__ivy.G.phase === "lobby"', { timeout: 15000 });
  const code = await A.evaluate(() => new URL(location.href).searchParams.get('c'));
  ok(/^[A-Z]{5}$/.test(code), 'room code is five letters', code);

  const B = await phone('B');
  await B.goto(`${URL}?c=${code}`, { waitUntil: 'networkidle2' });
  await B.type('#ar-name', 'Justin');
  await B.click('#ar-join');
  await B.waitForFunction('window.__ivy && window.__ivy.G && window.__ivy.G.phase === "lobby"', { timeout: 15000 });
  await sleep(600);
  const rows = await A.$$eval('#lobby .dv-list li', (els) => els.map((e) => e.textContent));
  ok(rows.some((t) => t.includes('Justin')), 'the host sees the second phone in the lobby', rows.join(' | '));

  await A.click('[data-bots="0"]');
  await sleep(400);
  await A.click('#startBtn');
  await A.waitForFunction('window.__ivy.G.phase === "play"', { timeout: 15000 });
  ok(true, 'the countdown runs into play on the host');
  await B.waitForFunction('window.__ivy.G.phase === "play"', { timeout: 5000 });
  ok(true, 'and on the second phone');

  // steer: A holds left a moment (touch), B taps right (keyboard)
  const box = await A.evaluate(() => [innerWidth, innerHeight]);
  await A.touchscreen.touchStart(40, box[1] / 2);
  await sleep(300);
  await A.touchscreen.touchEnd();
  await B.keyboard.down('ArrowRight');
  await sleep(250);
  await B.keyboard.up('ArrowRight');
  await sleep(1600);
  const logs = await A.evaluate(() => window.__ivy.G.round.vines.map((v) => v.log.length));
  ok(logs[0] >= 2 && logs[1] >= 2, 'touch steering (A) and keyboard steering (B) reach the server', logs.join(','));

  // both phones agree once they have caught up to the same server tick
  let agree = false;
  let detail = '';
  for (let i = 0; i < 20 && !agree; i++) {
    await sleep(300);
    const [sa, sb] = await Promise.all([snap(A), snap(B)]);
    if (sa?.simTick === sb?.simTick && sa?.conf === sa?.simTick && sb?.conf === sb?.simTick) {
      agree = JSON.stringify(sa.heads) === JSON.stringify(sb.heads);
      detail = `tick ${sa.simTick}`;
    }
  }
  ok(agree, 'both phones agree on every vine to the micrometre', detail);
  const pixels = await A.evaluate(() => {
    const c = document.getElementById('view');
    return c.width * c.height;
  });
  ok(pixels > 0, 'the 3D view is drawing');
  if (process.env.ARCADE_SHOTS) {
    fs.mkdirSync(process.env.ARCADE_SHOTS, { recursive: true });
    await A.screenshot({ path: path.join(process.env.ARCADE_SHOTS, 'devils-ivy-A.png') });
    await B.screenshot({ path: path.join(process.env.ARCADE_SHOTS, 'devils-ivy-B.png') });
  }

  // a round ends (wait for somebody to crash) — give it up to 40 s
  const ended = await A.waitForFunction('["roundover","matchover"].includes(window.__ivy.G.phase)', { timeout: 40000 }).then(() => true, () => false);
  ok(ended, 'a round ends and the results card appears');
  if (ended) ok(await A.evaluate(() => !document.getElementById('results').hidden), 'results card is visible');

  const real = errors.filter((e) => !/WebGL|GPU stall|swiftshader|Automatic fallback/i.test(e));
  ok(real.length === 0, 'no console errors or warnings', real.slice(0, 5).join(' | '));

  if (process.env.DV_POSTER) {
    // Free the CPU first: two software-rendered phones are a lot of work.
    await A.close();
    await B.close();
    const P = await phone('poster', 640, 400);
    await P.goto(`${URL}?poster=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await P.waitForFunction('document.body.dataset.ready === "1"', { timeout: 60000 });
    await sleep(500);
    const tmp = path.join(os.tmpdir(), 'devils-ivy-poster.png');
    await P.screenshot({ path: tmp });
    const out = path.resolve('public/arcade/devils-ivy/art/cabinet.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // Box-filter down to the cabinet size and quantise, like the other cabinets.
    execFileSync('magick', [tmp, '-filter', 'Box', '-resize', '320x200!', '-colors', '96', '+dither', 'PNG8:' + out]);
    ok(fs.statSync(out).size < 60000, 'cabinet art written', `${out} (${fs.statSync(out).size} bytes)`);
  }
} catch (err) {
  ok(false, 'browser pass threw', err.message);
} finally {
  await browser.close();
}
finish();
