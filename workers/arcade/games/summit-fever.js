/* ============================================================================
   SUMMIT FEVER — rules module
   ----------------------------------------------------------------------------
   Three or four friends, one mountain, five stages, and every kind of weather
   it can throw at them. Get the whole party to each camp before the stage
   clock runs out, and to the summit at the end.

   The resource is WARMTH. Rain soaks you, wet clothes in wind freeze you, a
   blizzard will take you from full to nothing in under twenty seconds. At zero
   you freeze solid — unless you are carrying a COOKIE, which saves you on the
   spot. A frozen climber can only be thawed by a friend standing next to them
   (or fed a cookie), so the party keeps having to decide whether to go back
   down for someone.

   Server authority is drawn at the OUTCOME (see the arcade vault note). The
   platforming itself runs in each browser — input lag on a jump is not
   something anyone forgives — and positions are reported here. Everything
   that decides who wins is decided here: the weather and its timing, warmth,
   wetness, freezing, cookie saves, thawing, who got an item first, where
   lightning and rockfall land and who they hit, who reached camp in what
   order, chopper rescues, and every point.

   Bots ("guides") fill a party up to three. The host's browser walks them;
   the server treats them exactly like any other climber.

   Pure reducer: state in, state out. No sockets, no storage, no timers.
   ========================================================================== */

import {
  buildWorld,
  inBivvy,
  byFire,
  groundBelow,
  STAGES,
  WEATHER,
  ITEMS,
  GEM_POINTS,
  TILE,
  WORLD_W,
  PHYS,
} from '../../../public/arcade/summit-fever/world.js';

// ── Timings (ms) ─────────────────────────────────────────────────────────────
const T_INTRO = 7000;
const T_CAMP = 9000;
const T_SUMMIT = 9000;
const STEP_MS = 250;
const FROZEN_RESCUE_MS = 22000; // the chopper finds anyone left frozen this long
const EVENT_TTL = 4500;
// After a thaw or a cookie save you get a few seconds of not losing warmth, so
// a blizzard can't refreeze you before you have taken a step.
const AFTERGLOW_MS = 4000;
// Movement plausibility. Generous enough that no real climb ever trips it
// (rope 80 px/s, a jump averages ~105 px/s upward, an energy-bar jump peaks at
// 86 px), tight enough that a devtools teleport can't vacuum up a stage.
const MAX_DX_PER_S = 260;
const UP_RATE = 210;
const UP_CAP = 170;
const POS_MIN_MS = 45; // nobody sends faster than this; flooders get dropped
const BOT_STALE_MS = 4000;

const MIN_PARTY = 3;
const SEAT_COLOURS = ['red', 'blue', 'yellow', 'green'];
const BOTS = [
  { id: 'b0', name: 'Ranger Rae', color: 'purple' },
  { id: 'b1', name: 'Old Bram', color: 'orange' },
];

// ── Scoring ──────────────────────────────────────────────────────────────────
const PTS_ARRIVE = [100, 70, 50, 40, 30, 30];
const PTS_ITEM = 5;
const PTS_THAW = 50;
const PTS_FEED = 70;
const PTS_COCOA_SHARE = 15;
const PTS_FROZEN = -25;
const PTS_CHOPPER = -60;
const PTS_SUMMIT_FIRST = 150;

// ── Strikes ──────────────────────────────────────────────────────────────────
const STRIKE = {
  bolt: { warn: 1300, stun: 1500, warmth: 12, r: 15 },
  rock: { warn: 1500, stun: 1000, warmth: 6, r: 14 },
  ice: { warn: 1400, stun: 1000, warmth: 8, r: 14 },
  snow: { warn: 1100, stun: 900, warmth: 8, r: 18 }, // avalanche slough
};

// ── Endings ──────────────────────────────────────────────────────────────────
const ENDINGS = {
  'roped-together': {
    title: 'Roped Together',
    line: 'Every one of you walked onto that summit on your own two feet.',
    body: 'Nobody got left on a ledge, nobody got winched into a helicopter, and the cookies went where they were needed. That is the whole of mountaineering, really — not who got there first, but that everybody who set out came home with a story and all their fingers.',
  },
  'summit-fever': {
    title: 'Summit Fever',
    line: 'Somebody stood on top of the world while a friend stood frozen below it.',
    body: 'Climbers have a name for it: the pull of the top that makes good people walk past someone in trouble. The view was incredible. It will be slightly less incredible every time the friend you left on the ice wall brings it up, which will be forever.',
  },
  'mountain-rescue': {
    title: 'Mountain Rescue',
    line: 'You made the summit. The helicopter crew know you all by name now.',
    body: 'Technically everybody got to the top. Some of you got there wrapped in a foil blanket, dangling under a rotor, waving. The rescue crew have asked that next time you check the forecast, bring more cookies, and maybe stand closer together.',
  },
  frostbitten: {
    title: 'Frostbitten, Not Beaten',
    line: 'It was not pretty, but the whole party got there.',
    body: 'Somebody froze, somebody got zapped, somebody ate a cookie they were meant to be saving for a friend. Nobody is going to frame the photo from the ice wall. But you are standing on the summit together with the sun coming up, and the mountain does not hand out style points.',
  },
};

// ── World cache ──────────────────────────────────────────────────────────────
const worlds = new Map();
function getWorld(seed) {
  let w = worlds.get(seed);
  if (!w) {
    w = buildWorld(seed);
    worlds.set(seed, w);
    if (worlds.size > 6) worlds.delete(worlds.keys().next().value);
  }
  return w;
}

// ── Rules module ─────────────────────────────────────────────────────────────
export default {
  slug: 'summit-fever',
  title: 'Summit Fever',
  seats: 4,
  // Positions arrive ~10×/s per climber; write the game row at most once a
  // second (see ArcadeRoom.setGameState). Everything is still broadcast live.
  persistMs: 1000,

  init() {
    return {
      phase: 'lobby',
      seed: 0,
      stage: 0,
      phaseEnds: null,
      stageStarted: null,
      stageEnds: null,
      climbers: {},
      order: [],
      taken: {},
      drops: [],
      fronts: [],
      strikes: [],
      events: [],
      ev: 0,
      sid: 0,
      last: 0,
      nextBolt: 0,
      nextRock: 0,
      avalancheAt: null,
      dropAt: null,
      results: [],
      firstSummit: null,
      ending: null,
      awards: null,
      startedAt: null,
    };
  },

  nextTickAt(state) {
    if (state.phase === 'lobby' || state.phase === 'ending') return null;
    if (state.pausedAt) return null; // nobody connected — no need to wake up
    const step = (state.last || 0) + (state.phase === 'climb' ? STEP_MS : 500);
    return state.phaseEnds ? Math.min(step, state.phaseEnds) : step;
  },

  start(state, ctx) {
    if (state.phase !== 'lobby') return null;
    if (!isHost(ctx) || !ctx.players.length) return null;
    return beginClimb(this.init(), ctx);
  },

  rematch(state, ctx) {
    if (state.phase !== 'ending') return null;
    if (!isHost(ctx)) return null;
    return beginClimb(this.init(), ctx);
  },

  action(state, ctx) {
    const msg = ctx.msg || {};
    if (state.phase === 'lobby' || state.phase === 'ending') return null;
    switch (msg.t) {
      case 'pos':
        return pos(state, ctx, msg);
      case 'grab':
        return grab(state, ctx, msg);
      case 'use':
        return applyUse(state, ctx);
      case 'shiver':
        return shiver(state, ctx);
      default:
        return null;
    }
  },

  tick(state, ctx) {
    if (state.phase === 'lobby' || state.phase === 'ending') return null;
    const s = state;
    step(s, ctx);
    return { ...s };
  },

  view(state, { seat, players, now }) {
    const present = new Set(players);
    const climbers = Object.values(state.climbers).map((c) => ({
      id: c.id,
      seat: c.seat,
      bot: c.bot,
      n: c.name,
      c: c.color,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      vx: Math.round(c.vx),
      f: c.f,
      a: c.a,
      tp: c.tp,
      w: Math.round(c.warmth),
      wet: Math.round(c.wet),
      fz: c.frozen,
      th: Math.round(c.thaw * 100) / 100,
      st: c.stun,
      bf: c.buffs,
      ck: c.cookies,
      co: c.cocoa,
      arr: c.arrived,
      sc: c.score,
      on: c.bot ? players.length > 0 : present.has(c.seat),
      fzAt: c.frozen ? c.frozenAt : null,
      gl: c.glow > now ? c.glow : 0,
      stats: state.phase === 'ending' ? c.stats : undefined,
    }));

    return {
      phase: state.phase,
      stage: state.stage,
      seed: state.seed,
      me: state.climbers[`s${seat}`] ? `s${seat}` : null,
      phaseEnds: state.phaseEnds,
      stageStarted: state.stageStarted,
      stageEnds: state.stageEnds,
      msLeft:
        state.phase === 'climb'
          ? Math.max(0, state.stageEnds - now)
          : state.phaseEnds
            ? Math.max(0, state.phaseEnds - now)
            : null,
      climbers,
      taken: Object.keys(state.taken).map(Number),
      drops: state.drops,
      fronts: state.phase === 'climb' ? state.fronts : [],
      strikes: state.strikes,
      avalancheAt: state.avalancheAt,
      ev: state.events.filter((e) => now - e.at < EVENT_TTL),
      results: state.results,
      partyNeeded: MIN_PARTY,
      botsIfStarted: Math.max(0, MIN_PARTY - players.length),
      ending: state.ending ? { key: state.ending, ...ENDINGS[state.ending] } : null,
      awards: state.awards,
      startedAt: state.startedAt,
      finalMs: state.finalMs ?? null,
    };
  },
};

// ── Phase machine ────────────────────────────────────────────────────────────

function beginClimb(base, ctx) {
  const s = base;
  s.seed = (Math.random() * 2 ** 31) >>> 0;
  s.last = ctx.now;
  s.startedAt = ctx.now;
  const world = getWorld(s.seed);

  const humans = [...ctx.players];
  const bots = BOTS.slice(0, Math.max(0, MIN_PARTY - humans.length));
  const roster = [
    ...humans.map((seat) => ({
      id: `s${seat}`,
      seat,
      bot: false,
      name: nameFor(ctx, seat),
      color: SEAT_COLOURS[seat % SEAT_COLOURS.length],
    })),
    ...bots.map((b) => ({ ...b, seat: null, bot: true })),
  ];

  const gap = (WORLD_W - 80) / Math.max(1, roster.length - 1);
  roster.forEach((r, i) => {
    s.climbers[r.id] = makeClimber(r, 40 + i * gap, world.floorY);
  });

  s.phase = 'intro';
  s.stage = 0;
  s.phaseEnds = ctx.now + T_INTRO;
  pushEvent(s, ctx.now, { k: 'intro' });
  return s;
}

function startStage(s, ctx, index) {
  const def = STAGES[index];
  const now = ctx.now;
  s.phase = 'climb';
  s.stage = index;
  s.stageStarted = now;
  s.stageEnds = now + def.time * 1000;
  s.phaseEnds = null;
  s.order = [];
  s.strikes = [];
  s.drops = [];
  s.fronts = rollFronts(def, now, s.stageEnds);
  s.nextBolt = now + 3000;
  s.nextRock = now + 6000;
  // Set pieces land inside a ~35 s climb, not after the party is at camp.
  s.avalancheAt = def.avalanche ? now + rand(12000, 20000) : null;
  s.dropAt = now + rand(10000, 16000);
  s.skyBroke = false;
  for (const c of Object.values(s.climbers)) c.scoreAtStart = c.score;
  for (const c of Object.values(s.climbers)) {
    c.arrived = -1;
    c.stun = 0;
    c.lastArrivePts = 0;
    c.flew = false;
  }
  pushEvent(s, now, { k: 'stage', stage: index });
}

function endStage(s, ctx, reason) {
  const world = getWorld(s.seed);
  const st = world.stages[s.stage];
  const now = ctx.now;
  const active = new Set(activeIds(s, ctx));

  for (const c of Object.values(s.climbers)) {
    const atCamp = c.y <= st.campY + 1;
    if (c.arrived >= 0) {
      // Made camp once, then went back down for someone: walk them back up.
      if (!atCamp) placeAtCamp(c, st);
      continue;
    }
    // Anyone still on the mountain gets winched off it. Climbers who are
    // offline (and bots nobody is walking) are moved silently.
    if (active.has(c.id) && !(c.bot && botStale(c, s, now))) {
      chopper(s, c, st, now, 'timeout');
    } else {
      placeAtCamp(c, st);
      c.arrived = s.order.length;
      c.lastArrivePts = 0;
      c.away = true;
      s.order.push(c.id);
    }
  }

  s.results.push({
    stage: s.stage,
    reason,
    ms: now - s.stageStarted,
    order: s.order.map((id) => {
      const c = s.climbers[id];
      return { id, pts: c?.lastArrivePts ?? 0, gained: c ? c.score - (c.scoreAtStart ?? 0) : 0, flew: !!c?.flew, away: !!c?.away };
    }),
  });
  for (const c of Object.values(s.climbers)) c.away = false;

  s.strikes = [];
  s.drops = [];
  s.avalancheAt = null;
  s.dropAt = null;

  if (s.stage >= STAGES.length - 1) {
    s.phase = 'summit';
    s.phaseEnds = now + T_SUMMIT;
    pushEvent(s, now, { k: 'summit' });
  } else {
    s.phase = 'camp';
    s.phaseEnds = now + T_CAMP;
    pushEvent(s, now, { k: 'camp', stage: s.stage });
  }
}

function finish(s, ctx) {
  const list = Object.values(s.climbers);
  const lastResult = s.results[s.results.length - 1];
  const summitChoppers = list.filter((c) => c.summitChopper).length;
  const totalChoppers = list.reduce((n, c) => n + c.stats.chopper, 0);
  const totalFrozen = list.reduce((n, c) => n + c.stats.frozen, 0);

  let ending;
  if (s.firstSummit?.frozenOthers) ending = 'summit-fever';
  else if (totalChoppers === 0 && totalFrozen <= 1) ending = 'roped-together';
  else if (summitChoppers >= Math.ceil(list.length / 2)) ending = 'mountain-rescue';
  else ending = 'frostbitten';

  s.ending = ending;
  s.awards = awards(list);
  s.phase = 'ending';
  s.phaseEnds = null;
  s.finalMs = lastResult ? ctx.now - s.startedAt : null;
  pushEvent(s, ctx.now, { k: 'ending' });
}

// ── The simulation step ──────────────────────────────────────────────────────
// Called from every tick and every action, so time is integrated from the last
// call regardless of what woke the room.
function step(s, ctx) {
  const now = ctx.now;
  // Nobody connected: stop the mountain's clock rather than let the room play
  // itself to the end while every phone is asleep.
  if (!ctx.players.length) {
    if (!s.pausedAt) s.pausedAt = now;
    s.last = now;
    return;
  }
  if (s.pausedAt) {
    shiftTimes(s, now - s.pausedAt);
    s.pausedAt = null;
  }
  const dt = Math.min(1, Math.max(0, (now - (s.last || now)) / 1000));
  s.last = now;
  syncRoster(s, ctx);

  // Old events and spent strikes age out.
  s.events = s.events.filter((e) => now - e.at < EVENT_TTL);
  s.strikes = s.strikes.filter((k) => !k.done || now - k.at < 1400);

  if (s.phase === 'intro') {
    if (now >= s.phaseEnds - 40) startStage(s, ctx, 0);
    return;
  }
  if (s.phase === 'camp' || s.phase === 'summit') {
    for (const c of Object.values(s.climbers)) {
      c.warmth = Math.min(100, c.warmth + 18 * dt);
      // Camp warms you right up but only half-dries you: a soaking on the
      // scree is still in your clothes on the glacier.
      c.wet = Math.max(0, c.wet - 4 * dt);
      c.frozen = false;
      c.thaw = 0;
      c.buffs = {};
    }
    if (now >= s.phaseEnds - 40) {
      if (s.phase === 'camp') startStage(s, ctx, s.stage + 1);
      else finish(s, ctx);
    }
    return;
  }
  if (s.phase !== 'climb') return;

  const world = getWorld(s.seed);
  const def = STAGES[s.stage];
  const st = world.stages[s.stage];
  const front = currentFront(s, now);
  const W = WEATHER[front?.kind] || WEATHER.clear;
  const active = activeIds(s, ctx).map((id) => s.climbers[id]);

  // ── Warmth and wetness ──────────────────────────────────────────────────
  for (const c of active) {
    for (const k of Object.keys(c.buffs)) if (c.buffs[k] <= now) delete c.buffs[k];
    if (c.frozen) continue;

    const atCamp = c.y <= st.campY + 1;
    if (atCamp || byFire(world, c.x, c.y)) {
      c.warmth = Math.min(100, c.warmth + 12 * dt);
      c.wet = Math.max(0, c.wet - 18 * dt);
      continue;
    }

    const sheltered = inBivvy(world, c.x, c.y);
    const huddled = active.some(
      (o) => o !== c && !o.frozen && Math.abs(o.x - c.x) <= 34 && Math.abs(o.y - c.y) <= 30,
    );
    let rate = W.cold + def.cold;
    let wetRate = W.wet;
    if (c.glow > now && rate < 0) rate = 0;
    if (sheltered) wetRate = Math.min(wetRate, -5);
    if (c.buffs.brolly && wetRate > 0) wetRate = -1;
    if (rate < 0) {
      rate *= 1 + (c.wet / 100) * 0.8;
      if (sheltered) rate *= 0.25;
      if (huddled) rate *= 0.55;
      if (c.buffs.down) rate *= 0.4;
      if (c.bot) rate *= 0.6; // guides have proper gear
    } else if (huddled) {
      rate += 0.4;
    }
    c.wet = clamp(c.wet + wetRate * dt, 0, 100);
    c.warmth = clamp(c.warmth + rate * dt, 0, 100);
    c.sheltered = sheltered;
    c.huddled = huddled;

    if (c.warmth <= 0) freezeOrSave(s, c, now);
  }

  // ── Thawing ─────────────────────────────────────────────────────────────
  for (const c of active) {
    if (!c.frozen) continue;
    const helpers = active.filter(
      (o) => o !== c && !o.frozen && Math.abs(o.x - c.x) <= 28 && Math.abs(o.y - c.y) <= 24,
    );
    if (helpers.length) c.thaw += (dt / 2.6) * Math.min(2, helpers.length);
    if (c.thaw >= 1) {
      thawOut(s, c, now, 45);
      for (const h of helpers) {
        h.score += PTS_THAW;
        h.stats.revives++;
      }
      pushEvent(s, now, { k: 'thaw', who: c.id, by: helpers.map((h) => h.id) });
    } else if (now - c.frozenAt > FROZEN_RESCUE_MS) {
      chopper(s, c, st, now, 'frozen');
    }
  }

  // ── Bots use their own pack ─────────────────────────────────────────────
  for (const b of active) {
    if (!b.bot || b.frozen) continue;
    if (b.cookies > 0 && nearestFrozen(active, b, 44)) feedCookie(s, b, nearestFrozen(active, b, 44), now);
    else if (b.cocoa > 0 && b.warmth < 35) drinkCocoa(s, b, active, now);
  }

  // ── Strikes land ────────────────────────────────────────────────────────
  for (const k of s.strikes) {
    if (k.done || now < k.at) continue;
    k.done = true;
    resolveStrike(s, k, active, world, st, now);
  }

  // ── New strikes ─────────────────────────────────────────────────────────
  const exposed = active.filter(
    (c) => !c.frozen && c.y > st.campY + 1 && !inBivvy(world, c.x, c.y),
  );
  if (W.bolts && now >= s.nextBolt) {
    // An open umbrella in a thunderstorm is a lightning rod. It is the joke and
    // the lesson.
    const t = weightedPick(exposed, (c) => (c.buffs.brolly ? 4 : 1));
    if (t) addStrike(s, 'bolt', t.x + rand(-9, 9), t.y, now);
    s.nextBolt = now + rand(1500, 2600);
  }
  if (def.hazard && now >= s.nextRock) {
    const t = exposed[Math.floor(Math.random() * exposed.length)];
    if (t) addStrike(s, def.hazard, t.x + rand(-12, 12), t.y, now);
    s.nextRock = now + rand(2600, 4200);
  }
  if (s.avalancheAt && now >= s.avalancheAt) {
    if (!s.avalancheAnnounced) {
      s.avalancheAnnounced = true;
      pushEvent(s, now, { k: 'avalanche' });
    }
    if (now < s.avalancheAt + 7000) {
      if (!s.nextSlough || now >= s.nextSlough) {
        const t = exposed[Math.floor(Math.random() * exposed.length)];
        if (t) addStrike(s, 'snow', clamp(t.x + rand(-40, 40), 20, WORLD_W - 20), t.y, now);
        s.nextSlough = now + rand(350, 600);
      }
    } else {
      s.avalancheAt = null;
      s.avalancheAnnounced = false;
    }
  }

  // ── Supply drop ─────────────────────────────────────────────────────────
  if (s.dropAt && now >= s.dropAt) {
    s.dropAt = null;
    const drop = supplyDrop(s, st, active, now);
    if (drop) {
      s.drops.push(drop);
      pushEvent(s, now, { k: 'drop', kind: drop.kind, x: drop.x, y: drop.y });
    }
  }

  // ── The summit gets its sunrise ─────────────────────────────────────────
  // A fast party would otherwise top out in the whiteout. As soon as anyone is
  // within 14 rows of the summit, skip straight to the clear front.
  if (s.stage === STAGES.length - 1 && !s.skyBroke && active.some((c) => c.y < st.campY + 14 * TILE)) {
    s.skyBroke = true;
    const i = s.fronts.indexOf(front);
    const last = s.fronts[s.fronts.length - 1];
    if (front && front !== last && last.kind === 'clear') {
      front.to = now;
      s.fronts = [...s.fronts.slice(0, i + 1), { ...last, from: now }];
    }
  }

  // ── Weather fronts change ───────────────────────────────────────────────
  if (front && s.lastFront !== front.from) {
    s.lastFront = front.from;
    pushEvent(s, now, { k: 'front', kind: front.kind });
  }

  // ── Arrivals ────────────────────────────────────────────────────────────
  for (const c of active) {
    if (c.arrived >= 0 || c.frozen) continue;
    if (c.y > st.campY + 1) continue;
    arrive(s, c, now, active);
  }

  // ── Stage over? ─────────────────────────────────────────────────────────
  // Everyone has to be standing at camp NOW — someone who arrived and then
  // dropped back down for a friend is still out on the mountain. A bot whose
  // host has gone quiet (phone in a pocket) doesn't hold the party up.
  const waitingOn = active.filter((c) => !(c.bot && botStale(c, s, now)));
  if (waitingOn.length && waitingOn.every((c) => c.arrived >= 0 && c.y <= st.campY + 1)) {
    endStage(s, ctx, 'clear');
    return;
  }
  if (active.length && active.every((c) => c.frozen)) {
    // The whole party is frozen and nobody is coming.
    for (const c of active) chopper(s, c, st, now, 'wipe');
    pushEvent(s, now, { k: 'wipe' });
    endStage(s, ctx, 'wipe');
    return;
  }
  if (now >= s.stageEnds) endStage(s, ctx, 'timeout');
}

// ── Actions ──────────────────────────────────────────────────────────────────

function pos(s, ctx, msg) {
  const c = actor(s, ctx, msg);
  if (!c) return null;
  if (msg.tp !== c.tp) return null; // sent before a teleport — stale
  const world = getWorld(s.seed);

  const x = Number(msg.x);
  const y = Number(msg.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (c.seen && ctx.now - c.seen < POS_MIN_MS) return null;

  // Plausibility: a climber can only cover so much ground between reports,
  // and only climb so fast. Falling is never limited.
  const dt = c.seen ? Math.min(2, (ctx.now - c.seen) / 1000) : 1;
  const maxDx = MAX_DX_PER_S * dt + 24;
  let nx = clamp(clamp(x, c.x - maxDx, c.x + maxDx), 4, WORLD_W - 4);
  let ny = clamp(y, 0, world.floorY);
  c.up = Math.min(UP_CAP, (c.up ?? UP_CAP) + UP_RATE * dt);
  if (ny < c.y) {
    const rise = Math.min(c.y - ny, c.up);
    c.up -= rise;
    ny = c.y - rise;
  }
  // Frozen solid: you can topple off a ledge, you can't walk.
  if (c.frozen) {
    nx = c.x;
    ny = Math.max(ny, c.y);
  }
  c.x = nx;
  c.y = ny;
  // A closed gate above the current camp is a hard ceiling on the server too.
  const gate = world.stages[s.stage]?.gateY;
  if (gate != null && c.y < gate + TILE + PHYS.H) c.y = gate + TILE + PHYS.H;
  c.vx = clamp(Number(msg.vx) || 0, -400, 400);
  c.f = msg.f === -1 ? -1 : 1;
  c.a = typeof msg.a === 'string' ? msg.a.slice(0, 8) : 'idle';
  c.seen = ctx.now;

  step(s, ctx);
  return { ...s };
}

function grab(s, ctx, msg) {
  if (s.phase !== 'climb' && s.phase !== 'camp') return null;
  const c = actor(s, ctx, msg);
  if (!c || c.frozen || c.stun > ctx.now) return null;
  const id = Number(msg.id);
  if (!Number.isFinite(id) || s.taken[id]) return null;

  const world = getWorld(s.seed);
  const p = world.pickups.get(id) || s.drops.find((d) => d.id === id);
  if (!p) return null;
  if (p.stage != null && p.stage !== s.stage) return null;
  // Positions are a frame or two stale by the time they get here; be
  // generous, but not so generous you can grab across a ledge.
  if (Math.abs(c.x - p.x) > 26 || Math.abs(c.y - PHYS.H / 2 - p.y) > 30) return null;

  s.taken[id] = c.id;
  const now = ctx.now;
  // One cookie per pocket: a second one stays on the ledge for someone else,
  // so feeding a frozen friend really does cost you your own save.
  if (p.kind === 'cookie' && c.cookies >= 1) return null;
  if (ITEMS[p.kind]) {
    c.stats.items++;
    c.score += PTS_ITEM;
    if (p.kind === 'cookie') c.cookies = 1;
    else if (p.kind === 'cocoa') c.cocoa = Math.min(2, c.cocoa + 1);
    else c.buffs[p.kind] = now + ITEMS[p.kind].dur;
    const thunder = WEATHER[currentFront(s, now)?.kind]?.bolts;
    pushEvent(s, now, { k: 'grab', who: c.id, kind: p.kind, rod: p.kind === 'brolly' && !!thunder });
  } else {
    c.stats.gems++;
    c.score += GEM_POINTS;
    pushEvent(s, now, { k: 'gem', who: c.id, kind: p.kind, x: p.x, y: p.y, quiet: true });
  }
  s.drops = s.drops.filter((d) => d.id !== id);
  step(s, ctx);
  return { ...s };
}

function applyUse(s, ctx) {
  if (s.phase !== 'climb') return null;
  const c = s.climbers[`s${ctx.seat}`];
  if (!c || c.frozen || c.stun > ctx.now) return null;
  const active = activeIds(s, ctx).map((id) => s.climbers[id]);
  const now = ctx.now;

  const friend = nearestFrozen(active, c, 44);
  if (friend && c.cookies > 0) feedCookie(s, c, friend, now);
  else if (c.cocoa > 0) drinkCocoa(s, c, active, now);
  else if (c.cookies > 0 && c.warmth < 50) {
    c.cookies--;
    c.warmth = Math.min(100, c.warmth + 50);
    c.stats.cookies++;
    pushEvent(s, now, { k: 'eat', who: c.id });
  } else return null;

  step(s, ctx);
  return { ...s };
}

// Mashing jump while frozen: you can shiver your own way out, slowly.
function shiver(s, ctx) {
  if (s.phase !== 'climb') return null;
  const c = s.climbers[`s${ctx.seat}`];
  if (!c || !c.frozen) return null;
  if (ctx.now - (c.lastShiver || 0) < 110) return null;
  c.lastShiver = ctx.now;
  c.thaw = Math.min(1, c.thaw + 0.014); // ~70 presses: a friend is far quicker
  if (c.thaw >= 1) {
    thawOut(s, c, ctx.now, 30);
    pushEvent(s, ctx.now, { k: 'shiver', who: c.id });
  }
  return { ...s };
}

// ── Mechanics ────────────────────────────────────────────────────────────────

function freezeOrSave(s, c, now) {
  if (c.cookies > 0) {
    c.cookies--;
    c.warmth = 65;
    c.glow = now + AFTERGLOW_MS;
    c.stats.cookies++;
    pushEvent(s, now, { k: 'cookie', who: c.id });
    return;
  }
  c.frozen = true;
  c.frozenAt = now;
  c.thaw = 0;
  c.warmth = 0;
  c.buffs = {};
  c.score += PTS_FROZEN;
  c.stats.frozen++;
  pushEvent(s, now, { k: 'frozen', who: c.id });
}

function thawOut(s, c, now, warmth) {
  c.frozen = false;
  c.thaw = 0;
  c.warmth = warmth;
  c.stun = now + 400;
  c.glow = now + AFTERGLOW_MS;
}

function feedCookie(s, c, friend, now) {
  c.cookies--;
  c.score += PTS_FEED;
  c.stats.fed++;
  thawOut(s, friend, now, 70);
  pushEvent(s, now, { k: 'feed', who: c.id, to: friend.id });
}

function drinkCocoa(s, c, active, now) {
  c.cocoa--;
  c.warmth = Math.min(100, c.warmth + 40);
  let shared = 0;
  for (const o of active) {
    if (o === c || Math.abs(o.x - c.x) > 64 || Math.abs(o.y - c.y) > 48) continue;
    if (o.frozen) o.thaw = Math.min(0.99, o.thaw + 0.5);
    else o.warmth = Math.min(100, o.warmth + 30);
    shared++;
  }
  c.score += shared * PTS_COCOA_SHARE;
  c.stats.cocoa += shared;
  pushEvent(s, now, { k: 'cocoa', who: c.id, n: shared });
}

function arrive(s, c, now, active) {
  const idx = s.order.length;
  s.order.push(c.id);
  c.arrived = idx;
  let pts = PTS_ARRIVE[idx] ?? 30;
  if (idx === 0) c.stats.firsts++;
  const summit = s.stage === STAGES.length - 1;
  if (summit && idx === 0) {
    pts += PTS_SUMMIT_FIRST;
    s.firstSummit = { id: c.id, frozenOthers: active.some((o) => o !== c && o.frozen) };
  }
  c.score += pts;
  c.lastArrivePts = pts;
  pushEvent(s, now, { k: 'arrive', who: c.id, idx, pts, summit });
}

function chopper(s, c, st, now, why) {
  const from = { x: c.x, y: c.y };
  placeAtCamp(c, st);
  c.frozen = false;
  c.thaw = 0;
  c.warmth = Math.max(c.warmth, 55);
  // Someone who had already made camp and went back down for a friend is a
  // hero, not a straggler: the ride is free.
  const hero = c.arrived >= 0;
  if (!hero) {
    c.score += PTS_CHOPPER;
    c.stats.chopper++;
    c.flew = true;
    if (s.stage === STAGES.length - 1) c.summitChopper = true;
    c.arrived = s.order.length;
    s.order.push(c.id);
    c.lastArrivePts = PTS_CHOPPER;
  }
  pushEvent(s, now, { k: 'chopper', who: c.id, why, hero, fx: from.x, fy: from.y, tx: c.x, ty: c.y });
}

function placeAtCamp(c, st) {
  c.x = clamp(st.hutX + rand(-50, 50), 30, WORLD_W - 30);
  c.y = st.campY;
  c.vx = 0;
  c.up = UP_CAP;
  c.tp++;
}

function botStale(c, s, now) {
  return c.bot && s.phase === 'climb' && now - s.stageStarted > BOT_STALE_MS + 1000 && now - (c.seen || 0) > BOT_STALE_MS;
}

// Slide every absolute timestamp forward by `d` ms (used to pause the clock).
function shiftTimes(s, d) {
  if (!d) return;
  for (const k of ['stageEnds', 'phaseEnds', 'stageStarted', 'nextBolt', 'nextRock', 'avalancheAt', 'dropAt', 'nextSlough', 'startedAt']) {
    if (s[k]) s[k] += d;
  }
  for (const f of s.fronts) {
    f.from += d;
    f.to += d;
  }
  for (const k of s.strikes) k.at += d;
  for (const dr of s.drops) dr.at += d;
  for (const c of Object.values(s.climbers)) {
    if (c.frozenAt) c.frozenAt += d;
    if (c.stun) c.stun += d;
    if (c.glow) c.glow += d;
    if (c.seen) c.seen += d;
    for (const b of Object.keys(c.buffs)) c.buffs[b] += d;
  }
}

function addStrike(s, kind, x, y, now) {
  const sx = Math.round(clamp(x, 12, WORLD_W - 12));
  // Aim at the ledge under the target, so the warning sits on something you
  // can stand on rather than floating where they were mid-jump.
  const gy = groundBelow(getWorld(s.seed), sx, y);
  const sy = gy - y < 48 ? gy : y;
  s.strikes.push({ id: ++s.sid, k: kind, x: sx, y: Math.round(sy), at: now + STRIKE[kind].warn });
}

function resolveStrike(s, k, active, world, st, now) {
  const spec = STRIKE[k.k];
  for (const c of active) {
    if (c.frozen || c.y <= st.campY + 1) continue;
    if (inBivvy(world, c.x, c.y)) continue;
    const r = k.k === 'bolt' && c.buffs.brolly ? spec.r * 2 : spec.r;
    if (Math.abs(c.x - k.x) > r || Math.abs(c.y - k.y) > 26) continue;
    c.stun = now + spec.stun;
    c.warmth = Math.max(0, c.warmth - spec.warmth);
    let fried = false;
    if (k.k === 'bolt') {
      c.stats.zapped++;
      if (c.buffs.brolly) {
        delete c.buffs.brolly;
        fried = true;
      }
    } else c.stats.bonked++;
    pushEvent(s, now, { k: k.k === 'bolt' ? 'zap' : 'bonk', who: c.id, kind: k.k, x: k.x, fried });
    if (c.warmth <= 0) freezeOrSave(s, c, now);
  }
}

function supplyDrop(s, st, active, now) {
  const ys = active.filter((c) => c.arrived < 0).map((c) => c.y);
  if (!ys.length) return null;
  ys.sort((a, b) => a - b);
  // A little above the middle of the pack: worth racing for, worth waiting for.
  const target = ys[Math.floor(ys.length / 2)] - 3 * TILE;
  const candidates = st.route.filter((l) => l.row * TILE < target + TILE * 2 && l.row * TILE > st.campY + TILE * 4);
  const l = candidates[0] || st.route[st.route.length - 2] || st.route[0];
  if (!l) return null;
  const kinds = ['cookie', 'cookie', 'cocoa', 'cocoa', 'down', 'bar', 'lamp'];
  return {
    id: 9000 + s.stage * 10 + s.drops.length,
    kind: kinds[Math.floor(Math.random() * kinds.length)],
    x: Math.round(((l.c0 + l.c1 + 1) / 2) * TILE),
    y: l.row * TILE - 10,
    at: now,
  };
}

function rollFronts(def, now, ends) {
  const fronts = [];
  let t = now;
  def.weather.forEach(([kind, a, b], i) => {
    const last = i === def.weather.length - 1;
    const dur = (a + Math.random() * (b - a)) * 1000;
    const to = last ? Math.max(t + dur, ends + 60000) : t + dur;
    fronts.push({ kind, from: Math.round(t), to: Math.round(to), dir: Math.random() < 0.5 ? -1 : 1, ph: Math.round(Math.random() * 628) / 100 });
    t = to;
  });
  return fronts;
}

function currentFront(s, now) {
  const f = s.fronts;
  if (!f.length) return null;
  return f.find((x) => now >= x.from && now < x.to) || f[f.length - 1];
}

// ── Awards ───────────────────────────────────────────────────────────────────
function awards(list) {
  const defs = [
    { key: 'goat', title: 'Mountain Goat', line: 'First into the most camps', stat: (c) => c.stats.firsts },
    { key: 'angel', title: 'Guardian Angel', line: 'Thawed or fed the most frozen friends', stat: (c) => c.stats.revives + c.stats.fed },
    { key: 'cookie', title: 'Cookie Monster', line: 'Ate the most cookies', stat: (c) => c.stats.cookies },
    { key: 'popsicle', title: 'Human Popsicle', line: 'Froze solid the most times', stat: (c) => c.stats.frozen },
    { key: 'rod', title: 'Lightning Rod', line: 'Struck by lightning the most', stat: (c) => c.stats.zapped },
    { key: 'helmet', title: 'Should Have Worn a Helmet', line: 'Hit by the most falling rock and ice', stat: (c) => c.stats.bonked },
    { key: 'magpie', title: 'Magpie', line: 'Picked up the most shiny things', stat: (c) => c.stats.gems + c.stats.items },
    { key: 'barista', title: 'Barista', line: 'Shared the most cocoa', stat: (c) => c.stats.cocoa },
    { key: 'chopper', title: 'Frequent Flyer', line: 'Rode the rescue chopper the most', stat: (c) => c.stats.chopper },
  ];
  const out = [];
  for (const d of defs) {
    const best = Math.max(0, ...list.map(d.stat));
    if (best < 1) continue;
    out.push({ key: d.key, title: d.title, line: d.line, value: best, who: list.filter((c) => d.stat(c) === best).map((c) => c.id) });
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function makeClimber(r, x, y) {
  return {
    id: r.id,
    seat: r.seat,
    bot: r.bot,
    name: r.name,
    color: r.color,
    x,
    y,
    vx: 0,
    f: 1,
    a: 'idle',
    tp: 1,
    warmth: 100,
    wet: 0,
    frozen: false,
    frozenAt: 0,
    thaw: 0,
    stun: 0,
    buffs: {},
    cookies: 0,
    cocoa: 0,
    arrived: -1,
    score: 0,
    seen: 0,
    stats: { firsts: 0, revives: 0, fed: 0, cookies: 0, frozen: 0, zapped: 0, bonked: 0, gems: 0, items: 0, cocoa: 0, chopper: 0 },
  };
}

// Late joiners get a climber at the current camp; names follow the seat list.
function syncRoster(s, ctx) {
  const world = getWorld(s.seed);
  for (const seat of ctx.players) {
    const id = `s${seat}`;
    const c = s.climbers[id];
    if (c) {
      c.name = nameFor(ctx, seat);
      continue;
    }
    const st = world.stages[Math.max(0, s.stage - (s.phase === 'climb' ? 1 : 0))];
    const y = s.phase === 'intro' || (s.phase === 'climb' && s.stage === 0) ? world.floorY : st.campY;
    const nc = makeClimber(
      { id, seat, bot: false, name: nameFor(ctx, seat), color: SEAT_COLOURS[seat % SEAT_COLOURS.length] },
      WORLD_W / 2 + rand(-40, 40),
      y,
    );
    if (s.phase !== 'climb') nc.arrived = 0;
    // A real person turning up takes over a bot guide's boots — position,
    // progress and pack — rather than growing the party past four.
    const bot = Object.values(s.climbers).find((c) => c.bot);
    if (bot) {
      Object.assign(nc, {
        x: bot.x, y: bot.y, arrived: bot.arrived, warmth: bot.warmth, wet: bot.wet,
        cookies: bot.cookies, cocoa: bot.cocoa, buffs: bot.buffs, frozen: bot.frozen, frozenAt: bot.frozenAt,
      });
      delete s.climbers[bot.id];
      s.order = s.order.map((o) => (o === bot.id ? id : o));
      pushEvent(s, ctx.now, { k: 'takeover', who: id, bot: bot.name });
    }
    s.climbers[id] = nc;
  }
}

// Climbers who count right now: humans with a live socket, and bots while any
// human is around to walk them.
function activeIds(s, ctx) {
  const present = new Set(ctx.players);
  return Object.values(s.climbers)
    .filter((c) => (c.bot ? present.size > 0 : present.has(c.seat)))
    .map((c) => c.id);
}

// Whose body does this message move? Your own, or — for the host only — a bot.
function actor(s, ctx, msg) {
  if (msg.who && String(msg.who).startsWith('b')) {
    if (!isHost(ctx)) return null;
    const b = s.climbers[msg.who];
    return b && b.bot ? b : null;
  }
  return s.climbers[`s${ctx.seat}`] || null;
}

function nearestFrozen(active, c, r) {
  let best = null;
  let bd = Infinity;
  for (const o of active) {
    if (o === c || !o.frozen) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d <= r && d < bd) {
      best = o;
      bd = d;
    }
  }
  return best;
}

function nameFor(ctx, seat) {
  return ctx.seats.find((x) => x.seat === seat)?.name || `Climber ${seat + 1}`;
}

function pushEvent(s, now, e) {
  s.events.push({ id: ++s.ev, at: now, ...e });
  if (s.events.length > 24) s.events.splice(0, s.events.length - 24);
}

function weightedPick(arr, wf) {
  if (!arr.length) return null;
  const total = arr.reduce((n, x) => n + wf(x), 0);
  let r = Math.random() * total;
  for (const x of arr) if ((r -= wf(x)) <= 0) return x;
  return arr[arr.length - 1];
}

function isHost(ctx) {
  return ctx.players.length > 0 && ctx.players[0] === ctx.seat;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
