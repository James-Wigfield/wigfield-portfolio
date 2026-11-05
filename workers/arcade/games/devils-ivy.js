/* ============================================================================
   DEVIL'S IVY — rules module
   ----------------------------------------------------------------------------
   Two to four vines in one kitchen. Each vine never stops growing and only
   steers; touch any vine (your own too) and you wilt. Every time a vine
   wilts, every vine still growing scores a point; a sun drop is worth a point
   too. First to TARGET wins the match.

   Authority. The whole round is a deterministic simulation in
   public/arcade/devils-ivy/world.js, a pure function of (seed, roster, input
   logs). Phones send `{t:'in', k, c, q}` — "from tick k my input is c" — and
   this module keeps the logs and runs the simulation DELAY_TICKS behind real
   time, so an input stamped by a phone arrives before its tick is decided.
   Everything that matters is decided here: who wilted, when, on what, who
   took each sun drop, every point. Phones re-run the same simulation from the
   same logs to draw it, and predict the last ~300 ms locally.

   The simulation itself (trails, spatial hash) is too big to live in the
   persisted state, so it is cached per round in this isolate and rebuilt by
   replaying the logs whenever the cache is cold or out of step.

   Bots fill the room up to three vines by default ("auto"); the host can set
   0–3. Bots steer on the server and their choices go into their logs, so
   phones replay them exactly like a person.

   Pure reducer: state in, state out. No sockets, no storage, no timers.
   Every handler that changes anything returns a NEW top-level object —
   ArcadeRoom reads `next === state` as "nothing happened".
   ========================================================================== */

import {
  Sim,
  botDecide,
  TICK_MS,
  DELAY_TICKS,
  MAX_TICKS,
  VARIETIES,
} from '../../../public/arcade/devils-ivy/world.js';

const TARGET = 10;
const MAX_VINES = 4;
const T_COUNTDOWN_FIRST = 5200;
const T_COUNTDOWN = 3600;
const T_ROUNDOVER = 4800;
const STEP_MS = 100; // server wake-up while a round is live
const FEED_TTL = 6500;
const EMPTY_GRACE_MS = 20000;
const MAX_LOG = 6000;
const MAX_INPUTS_PER_S = 40;
const BOT_NAMES = ['Vinnie', 'Ivy', 'Sprout', 'Tendril'];
// Views carry only the last LOG_TAIL entries of each input log; a phone that
// has fallen further behind than that asks for the whole thing ({t:'sync'}).
const LOG_TAIL = 48;
const FULL_LOG_MS = 3000;

// ── Simulation cache ─────────────────────────────────────────────────────────
const sims = new Map();

function simFor(round) {
  let sim = sims.get(round.id);
  if (!sim || sim.tick !== round.simTick) {
    // Cold or out of step (eviction, or a dispatch that threw after advancing):
    // replay the round from its logs. Bots' choices are in their logs too.
    sim = new Sim(round.seed, round.vines.length);
    round.vines.forEach((v, i) => (sim.vines[i].log = v.log));
    while (sim.tick < round.simTick) sim.step();
    sim.events.length = 0;
    sims.set(round.id, sim);
    if (sims.size > 12) sims.delete(sims.keys().next().value);
  }
  // The persisted state is re-parsed on every dispatch; point the simulation
  // at the fresh arrays. Logs only ever grow (or change past simTick), so the
  // read cursors stay valid.
  round.vines.forEach((v, i) => (sim.vines[i].log = v.log));
  return sim;
}

// ── Rules module ─────────────────────────────────────────────────────────────
export default {
  slug: 'devils-ivy',
  title: "Devil's Ivy",
  seats: 4,
  // Inputs arrive several times a second per player plus a 100 ms tick;
  // write the game row at most once a second (ArcadeRoom write-behind).
  persistMs: 1000,

  init() {
    return {
      phase: 'lobby',
      phaseEnds: null,
      last: 0,
      bots: -1, // -1 = auto (fill to three vines)
      target: TARGET,
      roundNo: 0,
      scores: {},
      round: null,
      feed: [],
      fid: 0,
      lastRound: null,
      champion: null,
      awards: null,
    };
  },

  nextTickAt(state) {
    if (state.phase === 'countdown' || state.phase === 'roundover') return state.phaseEnds;
    if (state.phase === 'play') return (state.last || 0) + STEP_MS;
    return null;
  },

  start(state, ctx) {
    if (state.phase !== 'lobby') return null;
    if (!isHost(ctx) || !ctx.players.length) return null;
    return beginMatch(state, ctx);
  },

  rematch(state, ctx) {
    if (state.phase !== 'matchover') return null;
    if (!isHost(ctx)) return null;
    return beginMatch(state, ctx);
  },

  action(state, ctx) {
    const msg = ctx.msg || {};
    switch (msg.t) {
      case 'in':
        return input(state, ctx, msg);
      case 'bots': {
        if (state.phase !== 'lobby' && state.phase !== 'matchover') return null;
        if (!isHost(ctx)) return null;
        const n = Math.round(Number(msg.n));
        if (!(n >= -1 && n <= 3)) return null;
        return { ...state, bots: n };
      }
      case 'sync': {
        // A phone that missed too much (joined mid-round, woke from a pocket)
        // gets whole logs for a moment.
        if (!state.round) return null;
        return { ...state, fullFor: { ...(state.fullFor || {}), [ctx.seat]: ctx.now } };
      }
      case 'end': {
        // Host abandons the match and takes everyone back to the lobby.
        if (!isHost(ctx) || state.phase === 'lobby') return null;
        return toLobby(state);
      }
      default:
        return null;
    }
  },

  tick(state, ctx) {
    const s = state;
    const now = ctx.now;
    if (s.phase === 'lobby' || s.phase === 'matchover') return null;
    // Everybody has gone: don't keep a round running for nobody. A short
    // grace, so one phone locking its screen doesn't end the match.
    if (!ctx.players.length) {
      s.emptySince = s.emptySince || now;
      if (now - s.emptySince > EMPTY_GRACE_MS) return toLobby(s);
    } else {
      s.emptySince = null;
    }

    if (s.phase === 'countdown' && now >= s.phaseEnds) {
      s.phase = 'play';
      s.phaseEnds = null;
    }
    if (s.phase === 'play') advance(s, ctx);
    else if (s.phase === 'roundover' && now >= s.phaseEnds) nextRound(s, ctx);

    s.last = now;
    // A NEW object: ArcadeRoom treats `next === state` as "nothing changed"
    // and would neither save nor broadcast it.
    return { ...s };
  },

  view(state, { seat, players, now }) {
    const r = state.round;
    const me = r ? r.vines.findIndex((v) => !v.bot && v.seat === seat) : -1;
    const full = now - (state.fullFor?.[seat] ?? -Infinity) < FULL_LOG_MS;
    return {
      phase: state.phase,
      phaseEnds: state.phaseEnds,
      target: state.target,
      bots: state.bots,
      botsIfStarted: botCount(state.bots, players.length),
      roundNo: state.roundNo,
      scores: Object.values(state.scores).sort((a, b) => b.pts - a.pts || a.key.localeCompare(b.key)),
      round: r
        ? {
            id: r.id,
            seed: r.seed,
            startAt: r.startAt,
            simTick: r.simTick,
            endTick: r.endTick,
            winner: r.winner,
            vines: r.vines.map((v) => ({
              key: v.key,
              seat: v.seat,
              bot: v.bot,
              name: v.name,
              variety: v.variety,
              // whole log, or {from, tail}: entries [from, from + tail.length)
              ...(full || v.log.length <= LOG_TAIL
                ? { log: v.log }
                : { lt: { from: v.log.length - LOG_TAIL, tail: v.log.slice(-LOG_TAIL) } }),
              q: v.q,
              alive: v.alive,
              deadTick: v.deadTick,
              by: v.by,
              where: v.where,
            })),
          }
        : null,
      me,
      feed: state.feed.filter((e) => now - e.at < FEED_TTL),
      lastRound: state.lastRound,
      champion: state.champion,
      awards: state.awards,
    };
  },
};

// ── Phases ───────────────────────────────────────────────────────────────────
function beginMatch(state, ctx) {
  const s = freshMatch(state);
  newRound(s, ctx, T_COUNTDOWN_FIRST);
  return s;
}

// A clean lobby that keeps the host's bot setting.
function freshMatch(state) {
  return {
    phase: 'lobby',
    phaseEnds: null,
    last: 0,
    bots: state.bots ?? -1,
    target: TARGET,
    roundNo: 0,
    scores: {},
    round: null,
    feed: [],
    fid: state.fid || 0,
    fullFor: {},
    lastRound: null,
    champion: null,
    awards: null,
  };
}

function toLobby(state) {
  return freshMatch(state);
}

function botCount(setting, humans) {
  const want = setting === -1 ? Math.max(0, 3 - humans) : setting;
  return Math.max(0, Math.min(want, MAX_VINES - humans));
}

function newRound(s, ctx, countdownMs) {
  const humans = ctx.players.slice(0, MAX_VINES);
  const nBots = botCount(s.bots, humans.length);
  const taken = new Set();
  const vines = humans.map((seat) => {
    const variety = seat % VARIETIES.length;
    taken.add(variety);
    return { key: `s${seat}`, seat, bot: false, name: nameFor(ctx, seat), variety };
  });
  for (let b = 0; b < nBots; b++) {
    let variety = 0;
    while (taken.has(variety)) variety++;
    taken.add(variety);
    vines.push({ key: `b${b}`, seat: null, bot: true, name: BOT_NAMES[b], variety });
  }

  s.roundNo += 1;
  s.phase = 'countdown';
  s.phaseEnds = ctx.now + countdownMs;
  s.feed = [];
  s.round = {
    id: `${ctx.now.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
    seed: (Math.random() * 4294967296) >>> 0,
    startAt: s.phaseEnds, // tick 0 is the end of the countdown
    simTick: 0,
    endTick: null,
    winner: null,
    vines: vines.map((v) => ({
      ...v,
      log: [],
      q: 0,
      alive: true,
      deadTick: -1,
      by: -1,
      where: null,
      rate: [0, 0],
    })),
  };
  for (const v of vines) {
    const sc = s.scores[v.key] || (s.scores[v.key] = blankScore(v));
    sc.name = v.name;
    sc.variety = v.variety;
    sc.seat = v.seat;
  }
}

function blankScore(v) {
  return {
    key: v.key,
    name: v.name,
    seat: v.seat,
    bot: v.bot,
    variety: v.variety,
    pts: 0,
    rounds: 0,
    suns: 0,
    kills: 0,
    selfs: 0,
    length: 0,
    ceiling: 0,
    fridge: 0,
    floor: 0,
    boost: 0,
  };
}

function nextRound(s, ctx) {
  if (!ctx.players.length) {
    Object.assign(s, freshMatch(s));
    return;
  }
  const ranked = Object.values(s.scores).sort((a, b) => b.pts - a.pts);
  const top = ranked[0];
  if (top && top.pts >= s.target && (!ranked[1] || ranked[1].pts < top.pts)) {
    s.phase = 'matchover';
    s.phaseEnds = null;
    s.champion = top.key;
    s.awards = awards(ranked);
    return;
  }
  newRound(s, ctx, T_COUNTDOWN);
}

// ── Inputs ───────────────────────────────────────────────────────────────────
function input(s, ctx, msg) {
  if (s.phase !== 'play' && s.phase !== 'countdown') return null;
  const r = s.round;
  const v = r.vines.find((x) => !x.bot && x.seat === ctx.seat);
  if (!v || !v.alive) return null;

  const c = Number(msg.c);
  if (!Number.isInteger(c) || c < 0 || c > 5) return null;
  let k = Math.floor(Number(msg.k));
  if (!Number.isFinite(k)) return null;

  // Flood guard: nobody presses more than a few dozen times a second.
  const sec = Math.floor(ctx.now / 1000);
  if (v.rate[0] !== sec) v.rate = [sec, 0];
  if (++v.rate[1] > MAX_INPUTS_PER_S) return null;
  if (v.log.length >= MAX_LOG) return null;

  // A tick that has already been decided can't be changed: late inputs land
  // on the next undecided tick. Inputs can't be stamped far in the future.
  const nowTick = Math.floor((ctx.now - r.startAt) / TICK_MS);
  const stamped = Math.min(k, nowTick + 12);
  k = Math.max(stamped, r.simTick + 1, 1);
  const last = v.log[v.log.length - 1];
  if (last && k < last[0]) k = last[0];
  // Two changes on one tick: the newer wins — unless this one only landed
  // here because it arrived late, in which case it goes on the next tick, so
  // a quick tap that arrives as a press-and-release pair still turns you.
  if (last && last[0] === k && k > stamped) k += 1;
  if (last && last[0] === k) last[1] = c;
  else if (!last || last[1] !== c) v.log.push([k, c]);
  if (Number.isInteger(msg.q) && msg.q > v.q) v.q = msg.q;

  if (s.phase === 'play') {
    advance(s, ctx);
    // Push the next tick out from now, so nextTickAt is never in the past
    // (ArcadeRoom.schedule treats a past time as "no tick").
    s.last = ctx.now;
  }
  return { ...s }; // new object, or the room ignores it (see tick)
}

// ── The round ────────────────────────────────────────────────────────────────
function advance(s, ctx) {
  const r = s.round;
  if (!r || r.endTick != null) return;
  const target = Math.min(Math.floor((ctx.now - r.startAt) / TICK_MS) - DELAY_TICKS, MAX_TICKS);
  if (target <= r.simTick) return;

  const sim = simFor(r);
  const n = r.vines.length;
  while (sim.tick < target) {
    // Bots choose before the tick they act on, every other tick.
    if (sim.tick % 2 === 0) {
      for (let i = 0; i < n; i++) {
        const rv = r.vines[i];
        const sv = sim.vines[i];
        if (!rv.bot || !sv.alive) continue;
        const c = botDecide(sim, sv);
        const last = rv.log[rv.log.length - 1];
        if (c !== (last ? last[1] : 1)) rv.log.push([sim.tick + 1, c]);
      }
    }

    sim.step();
    const deaths = [];
    for (const e of sim.events) {
      if (e.t === 'die') deaths.push(e);
      else if (e.t === 'pick' && e.kind === 0) {
        const who = r.vines[e.i];
        s.scores[who.key].pts += 1;
        pushFeed(s, ctx.now, { t: 'sun', who: e.i, k: e.k });
      }
    }
    sim.events.length = 0;

    if (deaths.length) {
      for (const e of deaths) {
        const rv = r.vines[e.i];
        rv.alive = false;
        rv.deadTick = e.k;
        rv.by = e.by;
        rv.where = e.where;
        pushFeed(s, ctx.now, { t: 'die', who: e.i, by: e.by, where: e.where, k: e.k });
      }
      // Every vine still growing scores a point per vine that just wilted.
      for (let i = 0; i < n; i++) {
        if (sim.vines[i].alive) s.scores[r.vines[i].key].pts += deaths.length;
      }
    }

    const alive = sim.alive();
    if ((n >= 2 && alive <= 1) || (n === 1 && alive === 0) || sim.tick >= MAX_TICKS) {
      endRound(s, ctx, sim);
      break;
    }
  }
  r.simTick = sim.tick;
}

function endRound(s, ctx, sim) {
  const r = s.round;
  r.endTick = sim.tick;
  const survivors = sim.vines.filter((v) => v.alive);
  if (sim.tick >= MAX_TICKS) for (const v of survivors) s.scores[r.vines[v.i].key].pts += 1;
  r.winner = survivors.length === 1 ? r.vines[survivors[0].i].key : null;

  const before = s.lastRoundPts || {};
  const gained = {};
  sim.vines.forEach((v, i) => {
    const rv = r.vines[i];
    const sc = s.scores[rv.key];
    sc.suns += v.stats.suns;
    sc.kills += v.stats.kills;
    if (v.by === v.i) sc.selfs += 1;
    sc.length += v.s;
    sc.ceiling += v.stats.ceiling;
    sc.fridge += v.stats.fridge;
    sc.floor += v.stats.floor;
    sc.boost += v.stats.boost;
    if (rv.key === r.winner) sc.rounds += 1;
    gained[rv.key] = sc.pts - (before[rv.key] || 0);
  });
  s.lastRoundPts = Object.fromEntries(Object.values(s.scores).map((sc) => [sc.key, sc.pts]));
  s.lastRound = { no: s.roundNo, winner: r.winner, gained, endTick: r.endTick };
  s.phase = 'roundover';
  s.phaseEnds = ctx.now + T_ROUNDOVER;
}

function awards(ranked) {
  const out = [];
  const best = (field, title, fmt, line) => {
    let top = null;
    for (const sc of ranked) if (sc[field] > 0 && (!top || sc[field] > top[field])) top = sc;
    if (top) out.push({ key: top.key, title, value: fmt(top[field]), line });
  };
  const secs = (t) => `${Math.round(t / 25)} s`;
  best('length', 'Longest Vine', (m) => `${m.toFixed(1)} m`, 'Grew the most vine all match.');
  best('suns', 'Sun Catcher', (n) => `${n} sun drop${n === 1 ? '' : 's'}`, 'Got to the light first.');
  best('kills', 'Garden Shears', (n) => `${n} cut${n === 1 ? '' : 's'}`, 'Other vines kept running into this one.');
  best('ceiling', 'Ceiling Creeper', secs, 'Spent the most time upside down.');
  best('fridge', 'Fridge Magnet', secs, 'Could not leave the fridge alone.');
  best('selfs', 'Tied in Knots', (n) => `${n} self-tangle${n === 1 ? '' : 's'}`, 'Wilted on its own vine the most.');
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function pushFeed(s, now, e) {
  s.fid = (s.fid || 0) + 1;
  s.feed.push({ id: s.fid, at: now, ...e });
  if (s.feed.length > 8) s.feed.shift();
}

function nameFor(ctx, seat) {
  return ctx.seats.find((x) => x.seat === seat)?.name || `Player ${seat + 1}`;
}

function isHost(ctx) {
  return ctx.players.length > 0 && ctx.seat === ctx.players[0];
}

// Test hook (tools/devils-ivy-check.mjs): forget every cached simulation, as
// if the Durable Object had been evicted, so the replay path gets exercised.
export function _dropSimCache() {
  sims.clear();
}
