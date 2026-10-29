/* ============================================================================
   ARCADE — headless check for /arcade/summit-fever
   ----------------------------------------------------------------------------
   Two passes, same approach as tools/arcade-check.mjs (there is no test
   framework in this repo; verification is by driving real browsers):

   1. RULES + WORLD, in-process. The rules module and the world generator are
      pure, so the whole mountain and the whole state machine can be driven
      without a server: ledge reachability with the real physics over many
      seeds, every warmth/freeze/cookie/thaw rule, every server-authority rule
      (grabs, gates, stale teleports, who may move a bot), strikes, chopper
      rescues, and all four endings.

   2. BROWSER, three isolated "phones" against a running Worker: create, join
      by link, start, positions syncing between phones, a pickup, reconnect to
      the same climber after a refresh, all five stages, camp and ending
      overlays, and a rematch.

     npx wrangler dev --port 8788 --local     # in one terminal
     node tools/summit-fever-check.mjs        # in another

   ARCADE_BASE=<origin>  run against a deployed Worker instead of localhost
   ARCADE_SHOTS=<dir>    write screenshots somewhere
   SF_RULES_ONLY=1       skip the browser pass
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import os from 'node:os';
import rules from '../workers/arcade/games/summit-fever.js';
import {
  buildWorld, stepBody, makeBody, TILE, COLS, STAGES, ITEMS,
} from '../public/arcade/summit-fever/world.js';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.ARCADE_BASE || 'http://127.0.0.1:8788';
const URL = `${BASE}/arcade/summit-fever/`;

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. World ─────────────────────────────────────────────────────────────────
console.log('--- world (in-process) ---');
{
  // Can a real jump, with the real physics, get from each route ledge to the
  // next? Lands on an intermediate ledge count as a pass (the player just takes
  // two hops); only a ledge nobody can get to is a failure.
  function reachable(world, from, to, gatesFrom) {
    const ty = to.row * TILE;
    for (let sx = from.c0 * TILE + 6; sx <= (from.c1 + 1) * TILE - 6; sx += 4) {
      for (const dir of [-1, 0, 1]) {
        for (const delay of [0, 0.1, 0.2]) {
          const b = makeBody(sx, from.row * TILE);
          b.ground = true;
          let first = true;
          for (let k = 0, t = 0; k < 260; k++, t += 1 / 120) {
            const d = t >= delay ? dir : 0;
            stepBody(world, b, { left: d < 0, right: d > 0, jump: true, jumpPressed: first }, 1 / 120, { gatesFrom });
            first = false;
            if (b.climbing) {
              for (let j = 0; j < 2400 && b.climbing; j++) stepBody(world, b, { jump: true }, 1 / 120, { gatesFrom });
              for (let j = 0; j < 160; j++) stepBody(world, b, {}, 1 / 120, { gatesFrom });
            }
            if (b.ground && k > 4) {
              if (Math.abs(b.y - ty) < 0.5) return true;
              if (b.y < from.row * TILE - 1 && b.y > ty) return true; // a step up on the way
              break;
            }
          }
        }
      }
    }
    return false;
  }

  let hops = 0;
  let stuck = 0;
  const seeds = Array.from({ length: 30 }, (_, i) => 7 + i * 104729);
  for (const seed of seeds) {
    const w = buildWorld(seed);
    for (const s of w.stages) {
      let prev = { row: s.startRow, c0: 1, c1: COLS - 2 };
      for (const l of [...s.route, { row: s.campRow, c0: s.campLo, c1: s.campHi }]) {
        hops++;
        if (!reachable(w, prev, l, s.index + 1)) stuck++;
        prev = l;
      }
    }
  }
  ok(stuck / hops < 0.003, 'route ledges are reachable with the real physics', `${hops - stuck}/${hops} over ${seeds.length} mountains`);

  const w = buildWorld(424242);
  ok(buildWorld(424242).grid.every((v, i) => v === w.grid[i]), 'the same seed builds the same mountain');
  ok(w.stages.length === 5, 'five stages');
  ok(w.gates.length === 4, 'a weather-hold gate above every camp but the summit');
  ok(w.stages.every((s, i) => w.items.some((it) => it.stage === i && it.kind === 'cookie')), 'every stage has at least one cookie');
  ok(w.stages.every((s, i) => w.bivvies.some((b) => b.stage === i)), 'every stage has a bivvy shelter');
  ok(w.items.every((it) => ITEMS[it.kind]), 'every item is a known kind');
  ok(new Set([...w.items, ...w.gems].map((p) => p.id)).size === w.items.length + w.gems.length, 'pickup ids are unique');
  ok(w.stages.every((s) => s.hole[1] - s.hole[0] === 1), 'every camp has a drop-hole back down');
}

// ── 2. Rules ─────────────────────────────────────────────────────────────────
console.log('');
console.log('--- rules (in-process) ---');
let now = 1_000_000;
const SEATS = [
  { seat: 0, name: 'James', token: 'tok-a' },
  { seat: 1, name: 'Sam', token: 'tok-b' },
  { seat: 2, name: 'Alex', token: 'tok-c' },
];
const mk = (players) => (extra = {}) => ({ seat: 0, now, players, seats: SEATS, msg: null, ...extra });
const run = (st, fn) => fn(st) ?? st;

function startGame(players) {
  const c = mk(players);
  let st = rules.start(rules.init(), c());
  now = st.phaseEnds + 10;
  st = run(st, (s) => rules.tick(s, c()));
  return { st, c };
}
function at(st, c, seat, x, y, who) {
  const cl = st.climbers[who || `s${seat}`];
  if (!cl.frozen) {
    cl.x = x;
    cl.y = y;
  }
  now += 50;
  return run(st, (s) => rules.action(s, c({ seat, msg: { t: 'pos', x, y, vx: 0, f: 1, a: 'idle', tp: cl.tp, who } })));
}
function advance(st, c, ms) {
  const end = now + ms;
  while (now < end) {
    now += 250;
    st = run(st, (s) => rules.tick(s, c()));
  }
  return st;
}
function forceWeather(st, kind) {
  st.fronts = [{ kind, from: now - 1000, to: now + 600000, dir: 1, ph: 0 }];
  return st;
}

{
  // Party filling
  const filled = rules.start(rules.init(), mk([0])());
  ok(Object.keys(filled.climbers).length === 3, 'one human + two bot guides = a party of three', Object.keys(filled.climbers).join(','));
  ok(Object.values(filled.climbers).filter((c) => c.bot).length === 2, 'two of them are bots');
  const full = rules.start(rules.init(), mk([0, 1, 2])());
  ok(Object.values(full.climbers).every((c) => !c.bot), 'three humans → no bots');
  ok(rules.start(rules.init(), mk([0, 1, 2])({ seat: 1 })) === null, 'only the leader can start');

  const { st: s0, c } = startGame([0, 1, 2]);
  // A copy of the stage-1 snapshot with its clock reset to now (the test clock
  // runs past the original stage deadline long before these tests finish).
  const fresh = (kind) => {
    const f = structuredClone(s0);
    if (kind) forceWeather(f, kind);
    f.stageStarted = now - 6000;
    f.stageEnds = now + 60000;
    f.dropAt = null;
    f.avalancheAt = null;
    f.last = now;
    return f;
  };
  ok(s0.phase === 'climb' && s0.stage === 0, 'intro hands over to stage 1');
  const w = buildWorld(s0.seed);
  const S = w.stages[0];
  const v = rules.view(s0, { seat: 1, players: [0, 1, 2], seats: SEATS, now });
  ok(!JSON.stringify(v).includes('tok-'), 'no join token ever reaches a client');
  ok(v.me === 's1', 'each phone is told which climber is theirs');

  // Warmth: blizzard drains, huddling slows it, wet makes it worse.
  let st = fresh('blizzard');
  st = at(st, c, 0, 40, S.startY - 160);
  st = at(st, c, 1, 280, S.startY - 160);
  st = at(st, c, 2, 290, S.startY - 160);
  for (const id of ['s0', 's1', 's2']) st.climbers[id].warmth = 100;
  st.climbers.s0.wet = 0;
  st = advance(st, c, 5000);
  const alone = 100 - st.climbers.s0.warmth;
  const huddled = 100 - st.climbers.s1.warmth;
  ok(alone > 12, 'a blizzard drains warmth fast', `-${alone.toFixed(1)} in 5s`);
  ok(huddled < alone * 0.7, 'huddling with a friend slows the cold', `alone -${alone.toFixed(1)} vs huddled -${huddled.toFixed(1)}`);

  st = fresh('snow');
  st = at(st, c, 0, 40, S.startY - 160);
  st = at(st, c, 1, 280, S.startY - 160);
  st = at(st, c, 2, 160, S.startY - 400);
  st.climbers.s0.wet = 0;
  st.climbers.s1.wet = 100;
  st = advance(st, c, 4000);
  ok(100 - st.climbers.s1.warmth > (100 - st.climbers.s0.warmth) * 1.4, 'wet clothes freeze faster');

  // Bivvy shelter
  const biv = w.bivvies.find((b) => b.stage === 0);
  st = fresh('downpour');
  st = at(st, c, 0, biv.x, biv.y);
  st = at(st, c, 1, 280, S.startY - 300);
  st = at(st, c, 2, 40, S.startY - 400);
  st = advance(st, c, 4000);
  ok(st.climbers.s0.wet === 0 && st.climbers.s1.wet > 30, 'a bivvy keeps the rain off', `bivvy wet ${st.climbers.s0.wet.toFixed(0)}, outside ${st.climbers.s1.wet.toFixed(0)}`);

  // Freeze without a cookie; save with one.
  st = fresh('blizzard');
  st = at(st, c, 0, 40, S.startY - 160);
  st = at(st, c, 1, 280, S.startY - 160);
  st = at(st, c, 2, 160, S.startY - 400);
  st.climbers.s0.warmth = 0.2;
  st.climbers.s1.warmth = 0.2;
  st.climbers.s1.cookies = 1;
  st = advance(st, c, 500);
  ok(st.climbers.s0.frozen, 'zero warmth with no cookie → frozen solid');
  ok(!st.climbers.s1.frozen && st.climbers.s1.cookies === 0 && st.climbers.s1.warmth > 50, 'a carried cookie saves you on the spot', `warmth ${st.climbers.s1.warmth.toFixed(0)}`);
  ok(st.events.some((e) => e.k === 'cookie' && e.who === 's1'), 'the cookie save is announced');
  const frozenX = st.climbers.s0.x;
  st = at(st, c, 0, frozenX + 80, st.climbers.s0.y);
  ok(st.climbers.s0.x === frozenX, 'a frozen climber cannot walk');

  // Thaw by standing next to them.
  st = forceWeather(st, 'clear');
  st = at(st, c, 2, frozenX + 10, st.climbers.s0.y);
  for (let i = 0; i < 14; i++) {
    now += 250;
    st = at(st, c, 2, frozenX + 10, st.climbers.s0.y);
  }
  ok(!st.climbers.s0.frozen, 'standing next to a frozen friend thaws them');
  ok(st.climbers.s2.stats.revives === 1, 'the rescuer is credited');

  // Shiver free, alone.
  st.climbers.s0.frozen = true;
  st.climbers.s0.frozenAt = now;
  st.climbers.s0.thaw = 0;
  st = at(st, c, 2, 300, S.startY - 400);
  let shivers = 0;
  while (st.climbers.s0.frozen && shivers < 80) {
    now += 130;
    st = run(st, (s) => rules.action(s, c({ seat: 0, msg: { t: 'shiver' } })));
    shivers++;
  }
  ok(!st.climbers.s0.frozen && shivers > 20, 'mashing jump shivers you free, slowly', `${shivers} presses`);
  const spam = structuredClone(st);
  spam.climbers.s0.frozen = true;
  spam.climbers.s0.thaw = 0;
  let spammed = spam;
  for (let i = 0; i < 40; i++) spammed = run(spammed, (s) => rules.action(s, c({ seat: 0, msg: { t: 'shiver' } })));
  ok(spammed.climbers.s0.thaw < 0.05, 'shiver is rate-limited server-side', `thaw ${spammed.climbers.s0.thaw.toFixed(2)} after 40 instant presses`);

  // Feed a cookie. (A thaw leaves you stunned for a moment — let it pass.)
  now += 600;
  st = at(st, c, 0, 100, S.startY - 160);
  st = at(st, c, 1, 120, S.startY - 160); // move first: frozen climbers can't
  st.climbers.s1.frozen = true;
  st.climbers.s1.frozenAt = now;
  st.climbers.s0.cookies = 1;
  st = run(st, (s) => rules.action(s, c({ seat: 0, msg: { t: 'use' } })));
  ok(!st.climbers.s1.frozen && st.climbers.s0.cookies === 0, 'USE beside a frozen friend feeds them your cookie');

  // Cocoa shares warmth.
  st.climbers.s0.cocoa = 1;
  st.climbers.s0.warmth = 20;
  st.climbers.s1.warmth = 20;
  st = run(st, (s) => rules.action(s, c({ seat: 0, msg: { t: 'use' } })));
  ok(st.climbers.s0.warmth >= 59 && st.climbers.s1.warmth >= 49, 'cocoa warms you and whoever is close');

  // Frozen too long → chopper.
  st = fresh();
  st.climbers.s2.frozen = true;
  st.climbers.s2.frozenAt = now;
  st = at(st, c, 0, 40, S.startY - 100);
  st = at(st, c, 1, 300, S.startY - 100);
  st = advance(st, c, 23000);
  ok(!st.climbers.s2.frozen && st.climbers.s2.stats.chopper === 1, 'left frozen 22s, the chopper takes you to camp');
  ok(st.climbers.s2.y === S.campY, 'chopper drops you at camp');

  // One cookie per pocket.
  {
    let k = fresh('clear');
    const cookies = w.items.filter((i) => i.kind === 'cookie' && i.stage === 0);
    k = at(k, c, 0, cookies[0].x, cookies[0].y + 11);
    k = run(k, (s) => rules.action(s, c({ seat: 0, msg: { t: 'grab', id: cookies[0].id } })));
    ok(k.climbers.s0.cookies === 1, 'a cookie goes in your pocket');
    if (cookies[1]) {
      now += 300;
      k = at(k, c, 0, cookies[1].x, cookies[1].y + 11);
      ok(rules.action(k, c({ seat: 0, msg: { t: 'grab', id: cookies[1].id } })) === null, 'a second cookie stays on the ledge for someone else');
    }
  }

  // Grabs
  st = fresh();
  const item = w.items.find((i) => i.stage === 0);
  st = at(st, c, 1, item.x + 120, item.y + 11);
  ok(rules.action(st, c({ seat: 1, msg: { t: 'grab', id: item.id } })) === null, 'cannot grab an item from across the mountain');
  st = at(st, c, 1, item.x, item.y + 11);
  st = run(st, (s) => rules.action(s, c({ seat: 1, msg: { t: 'grab', id: item.id } })));
  ok(st.taken[item.id] === 's1', 'a grab within reach lands');
  st = at(st, c, 2, item.x, item.y + 11);
  ok(rules.action(st, c({ seat: 2, msg: { t: 'grab', id: item.id } })) === null, 'first to it wins — no double grab');
  const later = w.items.find((i) => i.stage === 3);
  st = at(st, c, 2, later.x, later.y + 11);
  ok(rules.action(st, c({ seat: 2, msg: { t: 'grab', id: later.id } })) === null, "cannot grab a later stage's item early");

  // Gates, stale teleports, bots
  st = at(st, c, 0, 100, S.gateY - 60);
  ok(st.climbers.s0.y >= S.gateY + TILE + 22, 'a closed gate is a ceiling the server enforces');
  const tp = st.climbers.s0.tp;
  ok(rules.action(st, c({ seat: 0, msg: { t: 'pos', x: 5, y: 5, tp: tp - 1 } })) === null, 'a position sent before a teleport is ignored');
  const solo = startGame([0]);
  const bot = solo.st.climbers.b0;
  const moved = rules.action(solo.st, solo.c({ seat: 0, msg: { t: 'pos', who: 'b0', x: 200, y: bot.y - 40, tp: bot.tp } }));
  ok(moved && moved.climbers.b0.x === 200, 'the leader walks the bots');
  const twoUp = startGame([0, 1]);
  const b2 = twoUp.st.climbers.b0;
  ok(rules.action(twoUp.st, twoUp.c({ seat: 1, msg: { t: 'pos', who: 'b0', x: 200, y: b2.y, tp: b2.tp } })) === null, 'nobody else can move a bot');

  // Strikes: lightning hits nearby, misses far, bivvy protects, umbrella doubles the radius.
  st = fresh('clear');
  st = at(st, c, 0, 100, S.startY - 200);
  st = at(st, c, 1, 200, S.startY - 200);
  st = at(st, c, 2, biv.x, biv.y);
  st.climbers.s1.buffs = { brolly: now + 20000 };
  st.strikes = [
    { id: 90, k: 'bolt', x: 108, y: S.startY - 200, at: now + 10 },
    { id: 91, k: 'bolt', x: 225, y: S.startY - 200, at: now + 10 },
    { id: 92, k: 'bolt', x: biv.x, y: biv.y, at: now + 10 },
  ];
  st = advance(st, c, 250);
  ok(st.climbers.s0.stats.zapped === 1, 'lightning hits the climber it was aimed at');
  ok(st.climbers.s1.stats.zapped === 1 && !st.climbers.s1.buffs.brolly, 'an umbrella is a lightning rod (hit at 25px) and gets fried');
  ok(st.climbers.s2.stats.zapped === 0, 'a bivvy is safe from lightning');

  // Stage flow: everyone in → camp → next stage.
  st = fresh();
  st = at(st, c, 0, 100, S.campY);
  st = at(st, c, 1, 140, S.campY);
  ok(st.phase === 'climb', 'stage waits for the whole party');
  st = at(st, c, 2, 180, S.campY);
  ok(st.phase === 'camp', 'whole party at camp → stage clear');
  ok(st.climbers.s0.score === 100 && st.climbers.s1.score === 70 && st.climbers.s2.score === 50, 'arrival order scores 100/70/50');
  st = advance(st, c, 9500);
  ok(st.phase === 'climb' && st.stage === 1, 'camp break → stage 2');
  ok(st.fronts.some((f) => f.kind === 'thunder'), 'stage 2 brings a thunderstorm');

  // Timeout → chopper for stragglers. Clear skies, so nobody freezes first.
  st = forceWeather(st, 'clear');
  st = at(st, c, 0, 100, w.stages[1].campY);
  st = advance(st, c, (st.stageEnds - now) + 500);
  ok(st.phase === 'camp' && st.climbers.s1.stats.chopper === 1, 'out of time → stragglers airlifted');

  // Party wipe.
  st = fresh();
  for (const id of ['s0', 's1', 's2']) {
    st.climbers[id].frozen = true;
    st.climbers[id].frozenAt = now;
  }
  st = advance(st, c, 500);
  ok(st.phase === 'camp', 'everyone frozen → chopper takes the whole party');
  ok(st.results[st.results.length - 1].reason === 'wipe', 'a wipe is reported as a wipe, not "whole party in"');

  // ── QA regressions ──────────────────────────────────────────────────────
  const raw = (s, seat, x, y, extra = {}) =>
    rules.action(s, c({ seat, msg: { t: 'pos', x, y, tp: s.climbers[`s${seat}`].tp, ...extra } }));

  // A devtools teleport is clamped to a plausible climb.
  st = fresh();
  now += 1000;
  const y0 = st.climbers.s0.y;
  st = run(st, (s) => raw(s, 0, st.climbers.s0.x, S.campY));
  ok(y0 - st.climbers.s0.y <= 171, 'a teleport up the mountain is clamped to a plausible climb', `rose ${Math.round(y0 - st.climbers.s0.y)} px`);
  ok(st.climbers.s0.arrived < 0, '…so it does not count as reaching camp');

  // Flooding positions: a burst inside the rate limit is dropped.
  let flood = 0;
  for (let i = 0; i < 30; i++) if (raw(st, 0, st.climbers.s0.x + 1, st.climbers.s0.y) !== null) flood++;
  ok(flood === 0, 'a flood of position messages inside 45 ms is dropped (no broadcast)', `${flood} accepted`);

  // Frozen bodies only fall.
  now += 200;
  st.climbers.s1.frozen = true;
  st.climbers.s1.frozenAt = now;
  const fx = st.climbers.s1.x;
  const fy = st.climbers.s1.y;
  st = run(st, (s) => raw(s, 1, fx + 60, fy - 40));
  ok(st.climbers.s1.x === fx && st.climbers.s1.y === fy, 'a frozen climber cannot slide or rise');
  st.climbers.s1.frozen = false;

  // Arrived, then dropped back down to help: the stage waits for them.
  st = fresh();
  st = at(st, c, 0, 100, S.campY);
  st = at(st, c, 0, 100, S.campY + 200); // back down through the hole
  st = at(st, c, 1, 140, S.campY);
  st = at(st, c, 2, 180, S.campY);
  ok(st.phase === 'climb', 'someone who arrived then went back down still holds the stage');
  st = at(st, c, 0, 100, S.campY);
  ok(st.phase === 'camp', '…until they are back at camp');

  // A bot whose host went quiet does not hold the party up.
  {
    const two = startGame([0, 1]);
    let t2 = forceWeather(two.st, 'clear');
    const W2 = buildWorld(t2.seed).stages[0];
    t2 = advance(t2, two.c, 6000); // the bot never reports
    t2 = at(t2, two.c, 0, 100, W2.campY);
    t2 = at(t2, two.c, 1, 140, W2.campY);
    ok(t2.phase === 'camp', 'a stale bot (host phone asleep) does not block the stage');
    ok(t2.climbers.b0.stats.chopper === 0, '…and is moved up without a penalty');
  }

  // The summit always gets its sunrise: getting near the top breaks the sky.
  {
    let z = startStageForTest(fresh('clear'), c);
    for (let i = 1; i < 4; i++) {
      for (const [j, seat] of [0, 1, 2].entries()) z = at(z, c, seat, 80 + j * 40, w.stages[i].campY);
      z = advance(z, c, 9500);
    }
    ok(z.stage === 4 && z.phase === 'climb', 'reached stage 5 for the sunrise test', `${z.stage}/${z.phase}`);
    const W5 = w.stages[4];
    z.fronts = [
      { kind: 'whiteout', from: now - 1000, to: now + 40000, dir: 1, ph: 0 },
      { kind: 'clear', from: now + 40000, to: now + 200000, dir: 1, ph: 0 },
    ];
    z = at(z, c, 0, 100, W5.campY + 10 * TILE);
    z = advance(z, c, 300);
    const f5 = z.fronts.find((f) => now >= f.from && now < f.to);
    ok(f5?.kind === 'clear', 'getting near the summit breaks the whiteout into the sunrise', f5?.kind);
  }

  // Nobody connected: the clock stops.
  {
    let p = fresh();
    const left = p.stageEnds - now;
    const nobody = (extra = {}) => ({ seat: 0, now, players: [], seats: SEATS, msg: null, ...extra });
    p = run(p, (s) => rules.tick(s, nobody()));
    ok(p.pausedAt && rules.nextTickAt(p) === null, 'with nobody connected the room pauses and stops ticking');
    now += 60000;
    p = run(p, (s) => rules.tick(s, c()));
    ok(Math.abs(p.stageEnds - now - left) < 1000 && p.phase === 'climb', 'when someone comes back the stage clock picks up where it left off');
  }

  // A late joiner takes over a bot rather than growing the party.
  {
    const solo = startGame([0]);
    const later = rules.tick(solo.st, { seat: 0, now: now + 250, players: [0, 1], seats: SEATS, msg: null });
    const ids = Object.keys(later.climbers);
    ok(ids.length === 3 && ids.includes('s1') && ids.filter((i) => i.startsWith('b')).length === 1, 'a late joiner takes over a bot guide', ids.join(','));
  }

  // The fire at the camp a stage starts from actually warms you.
  {
    let f = fresh('blizzard');
    const prevCamp = buildWorld(f.seed).stages[0];
    advance(f, c, 0);
    f = startStageForTest(f, c);
    const fireX = prevCamp.fireX;
    f = at(f, c, 0, fireX, prevCamp.campY);
    f = at(f, c, 1, 300, prevCamp.campY - 200);
    f = at(f, c, 2, 40, prevCamp.campY - 200);
    f.climbers.s0.warmth = 50;
    f = advance(f, c, 3000);
    ok(f.climbers.s0.warmth > 50, 'standing by the campfire at the foot of a stage warms you', `${Math.round(f.climbers.s0.warmth)}`);
  }
}

// Jump a fresh game straight into stage 2 (the first stage that starts at a camp).
function startStageForTest(st, c) {
  const w = buildWorld(st.seed);
  for (const [i, seat] of [0, 1, 2].entries()) st = at(st, c, seat, 80 + i * 40, w.stages[0].campY);
  st = advance(st, c, 9500);
  return forceWeather(st, 'blizzard');
}

{
  // All four endings.
  function playOut(script) {
    const { st: s0, c } = startGame([0, 1, 2]);
    let st = s0;
    const w = buildWorld(st.seed);
    for (let stage = 0; stage < 5; stage++) {
      const S = w.stages[stage];
      st = script(st, c, stage, S) ?? st;
      for (const [i, seat] of [0, 1, 2].entries()) {
        if (st.phase !== 'climb') break;
        if (st.climbers[`s${seat}`].frozen) continue;
        st = at(st, c, seat, 80 + i * 40, S.campY);
      }
      if (st.phase === 'climb') st = advance(st, c, st.stageEnds - now + 400);
      st = advance(st, c, (st.phaseEnds ?? now) - now + 400);
    }
    return st;
  }
  const seen = new Set();
  const clean = playOut(() => null);
  ok(clean.ending === 'roped-together', 'ending: nobody froze, nobody flew', clean.ending);
  seen.add(clean.ending);

  const fever = playOut((st, c, stage, S) => {
    if (stage !== 4) return st;
    st.climbers.s2.frozen = true;
    st.climbers.s2.frozenAt = now;
    st = at(st, c, 2, 300, S.startY - 64);
    return at(st, c, 0, 80, S.campY);
  });
  ok(fever.ending === 'summit-fever', 'ending: summited first while a friend was frozen', fever.ending);
  seen.add(fever.ending);

  const rescue = playOut((st, c, stage, S) => {
    if (stage !== 4) return st;
    st = at(st, c, 0, 80, S.campY);
    st.climbers.s1.frozen = true;
    st.climbers.s1.frozenAt = now - 5000;
    st.climbers.s2.frozen = true;
    st.climbers.s2.frozenAt = now - 5000;
    return st;
  });
  ok(rescue.ending === 'mountain-rescue', 'ending: most of the party flew to the summit', rescue.ending);
  seen.add(rescue.ending);

  const bitten = playOut((st, c, stage) => {
    if (stage === 1 || stage === 2) {
      st.climbers.s1.frozen = true;
      st.climbers.s1.frozenAt = now - 30000;
      st = advance(st, c, 300);
    }
    return st;
  });
  ok(bitten.ending === 'frostbitten', 'ending: messy, but everyone made it', bitten.ending);
  seen.add(bitten.ending);
  ok(seen.size === 4, 'all four endings are reachable', [...seen].join(', '));
  ok(clean.awards.length > 0 && clean.awards.every((a) => a.who.length), 'awards are handed out');

  const again = rules.rematch(clean, { seat: 0, now, players: [0, 1, 2], seats: SEATS });
  ok(again.phase === 'intro' && Object.values(again.climbers).every((x) => x.score === 0), 'rematch starts a fresh climb');
  ok(again.seed !== clean.seed, 'rematch is a new mountain');
}

if (process.env.SF_RULES_ONLY) finish();

// ── 3. Browser ───────────────────────────────────────────────────────────────
console.log('');
console.log('--- browser (three phones) ---');

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [];
async function phone(tag) {
  // Each player is an ISOLATED context: separate localStorage, or the second
  // phone silently rejoins the first phone's seat via the saved token.
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${tag}] ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
  return p;
}
const view = (p) => p.evaluate(() => window.__sf?.state() ?? null);
async function waitPhase(p, phase, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await view(p);
    if (s?.phase === phase) return s;
    await sleep(200);
  }
  throw new Error(`timeout waiting for "${phase}" (saw ${(await view(p))?.phase})`);
}
// Put a phone's climber somewhere (as if they had climbed there).
const place = (p, x, y) =>
  p.evaluate(([xx, yy]) => {
    const b = window.__sf.body;
    b.x = xx; b.y = yy; b.vx = 0; b.vy = 0; b.climbing = false;
  }, [x, y]);

try {
  const A = await phone('A');
  await A.goto(URL, { waitUntil: 'networkidle2' });
  await A.type('#ar-name', 'James');
  await A.click('#ar-create');
  await A.waitForFunction('window.__sf && window.__sf.state()', { timeout: 15000 });
  const code = await A.evaluate(() => window.__sf.room.code());
  ok(/^[A-Z]{5}$/.test(code), 'room code is 5 letters', code);

  const phones = [A];
  for (const [i, name] of ['Sam', 'Alex'].entries()) {
    const P = await phone(String.fromCharCode(66 + i));
    await P.goto(`${URL}?c=${code}`, { waitUntil: 'networkidle2' });
    await P.type('#ar-name', name);
    await P.click('#ar-join');
    await P.waitForFunction('window.__sf && window.__sf.state()', { timeout: 15000 });
    phones.push(P);
  }
  const [, B, C] = phones;
  await sleep(700);
  const roster = await A.evaluate(() => window.__sf.players());
  ok(roster.length === 3 && roster.every((p) => p.online), 'three phones in the room', roster.map((p) => p.name).join(', '));
  ok(await A.$eval('#go', (el) => !!el), 'the leader sees the start button');
  ok((await B.$('#go')) === null, 'others do not');

  await A.click('#go');
  await waitPhase(A, 'intro');
  let sA = await view(A);
  ok(sA.climbers.length === 3 && sA.climbers.every((c) => !c.bot), 'three climbers, no bots');
  ok((await view(B)).me === 's1' && (await view(C)).me === 's2', 'each phone has its own climber');

  sA = await waitPhase(A, 'climb', 15000);
  const world = buildWorld(sA.seed);
  const S0 = world.stages[0];

  // Positions sync: move B, A sees it.
  const route = S0.route[3];
  const rx = (route.c0 + 1) * TILE;
  await place(B, rx, route.row * TILE - 2);
  await sleep(900);
  const bOnA = (await view(A)).climbers.find((c) => c.id === 's1');
  ok(Math.abs(bOnA.x - rx) < 4 && Math.abs(bOnA.y - route.row * TILE) < 4, "B's climb shows up on A's phone", `${bOnA.x},${bOnA.y}`);

  // A pickup. The server only lets a body climb so fast, so a long "teleport"
  // takes a few seconds to be believed — wait for it.
  const item = world.items.find((it) => it.stage === 0);
  await place(C, item.x, item.y + 9);
  for (let i = 0; i < 40 && !(await view(A)).taken.includes(item.id); i++) {
    await place(C, item.x, item.y + 9);
    await sleep(300);
  }
  sA = await view(A);
  ok(sA.taken.includes(item.id), `C walked over the ${item.kind} and got it`);

  // Reconnect: B refreshes mid-climb.
  await B.reload({ waitUntil: 'networkidle2' });
  await B.waitForFunction('window.__sf && window.__sf.state() && window.__sf.state().me', { timeout: 20000 });
  await sleep(600);
  ok((await view(B)).me === 's1', 'B comes back as the same climber after a refresh');
  ok((await view(A)).climbers.length === 3, 'no ghost climber from the refresh');

  // Climb all five stages (teleporting each body onto the camp).
  for (let s = 0; s < 5; s++) {
    sA = await waitPhase(A, 'climb', 20000);
    const S = world.stages[s];
    for (const [i, P] of phones.entries()) await place(P, 70 + i * 50, S.campY - 3);
    const next = s < 4 ? 'camp' : 'summit';
    await waitPhase(A, next, 20000);
    if (s === 0) {
      const overlay = await A.$eval('#over', (el) => !el.hidden && el.textContent.includes('done'));
      ok(overlay, 'camp overlay shows the stage results');
    }
    console.log(`     … stage ${s + 1}/5 cleared`);
  }
  const end = await waitPhase(A, 'ending', 20000);
  ok(!!end.ending?.title, 'the climb reaches an ending', end.ending?.title);
  const endTitle = await A.$eval('#over h1', (el) => el.textContent);
  ok(endTitle.length > 3, 'ending overlay rendered', endTitle);
  ok(end.climbers.every((c) => c.sc > 0), 'everybody scored');

  const shots = process.env.ARCADE_SHOTS || os.tmpdir();
  await A.screenshot({ path: path.join(shots, 'sf-ending.png') });

  await A.click('#again');
  const fresh = await waitPhase(A, 'intro', 10000);
  ok(fresh.climbers.every((c) => c.sc === 0), 'rematch resets the scores');
  console.log(`\nscreenshots -> ${shots}`);
} catch (err) {
  ok(false, 'BROWSER RUN COMPLETED', err.message);
  console.error(err);
} finally {
  console.log('\n--- console errors ---');
  const noisy = errors.filter((e) => !/favicon|fonts\.g|Failed to load resource.*404/i.test(e));
  console.log(noisy.length ? noisy.slice(0, 15).join('\n') : '(none)');
  ok(noisy.length === 0, 'no console errors on any phone');
  await browser.close();
  finish();
}

function finish() {
  console.log(`\n${fails.length ? 'FAILURES: ' + fails.join(' | ') : 'ALL CHECKS PASSED'}`);
  process.exit(fails.length ? 1 : 0);
}
