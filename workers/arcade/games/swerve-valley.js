/* ============================================================================
   SWERVE VALLEY — rules module
   ----------------------------------------------------------------------------
   A wine tour on an open-top double-decker. Five cellar doors, then home.
   Every player is one of the eleven people on the tour; whoever nobody picked
   still comes along and causes trouble on their own.

   The day alternates between two things:
     DRIVE  — one phone has the wheel (the leg's designated driver, always on
              grape juice). Everyone else is in the back doing quick jobs:
              catching bottles, pulling people back into their seats, leaning
              into bends, smiling for photos. Every job somebody fumbles
              shoves the bus sideways under the driver.
     STOP   — everybody picks a pour (spit / sip / glass / skull), then plays
              that winery's tasting game at the same time.
   The keys for the next leg go to the soberest person who hasn't driven yet,
   so how much you drink decides whether you drive.

   Server authority is drawn at the OUTCOME (see the arcade vault note). The
   driver's phone runs the bus physics — steering lag is unforgivable — and
   reports where the bus is. The server owns the road (from the seed), judges
   every hazard crossing from two consecutive reports, the fork, the parking,
   every job, every drink, every point, the tour rating and the keys.

   Pure reducer: state in, state out. No sockets, no storage, no timers.
   ========================================================================== */

import {
  CAST,
  CAST_IDS,
  CAST_BY_ID,
  WINERIES,
  DECOYS,
  HOME,
  LEGS,
  STOPS,
  DRINKS,
  tier,
  SLEEP_AT,
  PHYS,
  HAZARDS,
  buildLeg,
  safeLine,
  crossings,
  JOBS,
  SOLO_JOBS,
  SETPIECES,
  GAMES,
  GAME_INTRO_MS,
  POUR_ROUNDS,
  POUR_ROUND_MS,
  QUIZ_Q,
  QUIZ_Q_MS,
  STOMP_MAX_RATE,
  FOOD,
  FOOD_TTL,
  buildPlatter,
  buildQuiz,
  pourTargets,
  endingFor,
  AWARDS,
  AWARD_FALLBACKS,
  mulberry32,
  shuffle,
  clamp,
} from '../../../public/arcade/swerve-valley/world.js';

// ── Timings (ms) ─────────────────────────────────────────────────────────────
const T_BRIEF = 8000;
const T_ARRIVE = 4500;
const T_POUR = 9000;
const T_TALLY = 5000;
const DRIVE_STEP = 200;
const LEG_MAX_MS = 130000;
const POS_MIN_MS = 55;
const DRIVER_STALE_MS = 2600;
const AUTO_V = 6200;
const CLAIM_MS = 2600; //      an NPC's trouble waits this long for a hero
const EVENT_TTL = 6000;
const PEN_MS = 3200; //        wrong turn: chucking a U-ey
const GRACE_MS = 700;

const RATING_START = 100;

// ── Rules module ─────────────────────────────────────────────────────────────
export default {
  slug: 'swerve-valley',
  title: 'Swerve Valley',
  seats: 11,
  // The driver reports ~10×/s; write the game row at most once a second.
  persistMs: 1000,

  init() {
    return {
      phase: 'lobby',
      seed: 0,
      picks: {},
      last: 0,
    };
  },

  nextTickAt(s) {
    if (s.phase === 'lobby' || s.phase === 'ending') return null;
    if (s.idleAt) return null;
    const step = s.phase === 'drive' ? DRIVE_STEP : s.phase === 'game' ? 250 : 500;
    // Cadence comes from the last TICK, not the last message: the driver's
    // 10 Hz reports would otherwise keep pushing the alarm back. It must still
    // be in the future (room.schedule() falls back to the expiry otherwise),
    // and `last` is "now" whenever a reducer ran.
    const next = (s.tickAt || s.last || 0) + step;
    const due = s.phaseEnds ? Math.min(next, s.phaseEnds) : next;
    return Math.max(due, (s.last || 0) + 20);
  },

  start(state, ctx) {
    if (state.phase !== 'lobby') return null;
    if (!isHost(ctx) || !ctx.players.length) return null;
    return beginTour(state, ctx);
  },

  rematch(state, ctx) {
    if (state.phase !== 'ending') return null;
    if (!isHost(ctx)) return null;
    return beginTour(state, ctx);
  },

  action(state, ctx) {
    const msg = ctx.msg || {};
    const s = state;
    if (msg.t === 'pick') return pick(s, ctx, msg);
    // 'hi' only matters to wake an idle room; otherwise it's a free broadcast.
    if (msg.t === 'hi') return s.idleAt ? hello(s, ctx) : null;
    if (s.phase === 'lobby' || s.phase === 'ending') return null;
    if (s.idleAt) {
      hello(s, ctx);
      return handle(s, ctx, msg) ?? { ...s };
    }
    return handle(s, ctx, msg);
  },

  tick(state, ctx) {
    const s = state;
    if (s.phase === 'lobby' || s.phase === 'ending') return null;
    if (!ctx.players.length) {
      if (s.idleAt) return null;
      s.idleAt = ctx.now;
      return { ...s };
    }
    if (s.idleAt) hello(s, ctx);
    advance(s, ctx);
    s.tickAt = ctx.now;
    return { ...s };
  },

  view(s, args) {
    return viewFor(s, args);
  },
};

function handle(s, ctx, msg) {
  switch (msg.t) {
    case 'pos':
      return pos(s, ctx, msg);
    case 'job':
      return jobResult(s, ctx, msg);
    case 'claim':
      return claim(s, ctx, msg);
    case 'horn':
      return horn(s, ctx);
    case 'spot':
      return spot(s, ctx, msg);
    case 'drink':
      return drink(s, ctx, msg);
    case 'pour':
    case 'stomp':
    case 'eat':
    case 'ans':
    case 'stack':
      return gameInput(s, ctx, msg);
    default:
      return null;
  }
}

function viewFor(s, { seat, players, now }) {
  const present = new Set(players);
  const me = s.picks?.[seat] || null;
  const hm = {};
  for (const [st, cid] of Object.entries(s.picks || {})) hm[cid] = [Number(st), present.has(Number(st)) ? 1 : 0];

  const base = {
    ph: s.phase,
    seed: s.seed,
    me,
    hm,
    now,
    ends: s.phaseEnds ?? null,
    idle: s.idleAt ? 1 : 0,
  };
  if (s.phase === 'lobby') return base;

  const ch = CAST_IDS.map((id) => {
    const c = s.ch[id];
    return [Math.round(c.tip), c.fun, (c.asleep ? 1 : 0) | (c.lost ? 2 : 0), c.drink || 0];
  });

  const v = {
    ...base,
    leg: s.leg,
    stop: s.stop,
    // Only the cellar doors already reached; the rest is the navigators' secret.
    order: s.order.slice(0, revealed(s)),
    dest: s.dest,
    driver: s.driver,
    nav: s.nav,
    nextDriver: s.nextDriver,
    drives: s.drives,
    rating: Math.round(s.rating),
    ch,
    ev: s.events.filter((e) => now - e.at < EVENT_TTL),
    party: Math.round(partyLevel(s) * 100) / 100,
    decoy: s.decoy,
  };

  if (s.phase === 'drive') {
    const b = s.bus;
    v.bus = {
      z: Math.round(b.z),
      x: Math.round(b.x * 1000) / 1000,
      v: Math.round(b.v),
      at: b.at,
      auto: b.auto ? 1 : 0,
      pen: b.pen > now ? b.pen : 0,
      tp: b.tp,
      side: b.side || 0,
    };
    // Only the navigator knows where we're going — or the driver, when there
    // is nobody else to ask.
    if (!(me && (me === s.nav || (me === s.driver && !s.nav)))) v.dest = null;
    // Both fork signs, left then right. Everyone sees these; only the
    // navigator knows which one is today's.
    const track = getTrack(s.seed, s.leg);
    const destName = s.dest === 'home' ? HOME.name : WINERIES[s.dest].name;
    v.signs = track.forkSide === -1 ? [destName, s.decoy] : [s.decoy, destName];
    v.hits = s.hits;
    v.jobs = s.jobs.filter((j) => !j.done).map(jobView);
    v.imps = s.imps;
    v.grip = s.grip && s.grip.until > now ? s.grip : null;
    v.splat = s.splat;
    v.legStart = s.legStart;
    v.leans = s.leansDone;
    v.spotted = s.spotted;
  }
  if (s.phase === 'arrive') {
    v.parked = s.parked;
    v.legLog = s.legLog;
  }
  if (s.phase === 'pour' || s.phase === 'game' || s.phase === 'tally' || s.phase === 'arrive') {
    v.winery = s.order[s.stop];
  }
  if (s.phase === 'game') v.sg = gameView(s, me, now);
  if (s.phase === 'tally') v.tally = s.tally;
  if (s.phase === 'ending') {
    v.final = s.final;
    v.photos = s.photos;
  }
  return v;
}

// ── Tour lifecycle ───────────────────────────────────────────────────────────

function revealed(s) {
  if (s.phase === 'ending') return STOPS;
  if (s.phase === 'drive') return Math.min(s.leg, STOPS);
  if (s.phase === 'brief') return 0;
  return Math.min((s.stop ?? 0) + 1, STOPS);
}

function beginTour(prev, ctx) {
  const now = ctx.now;
  const seed = (Math.random() * 0x7fffffff) >>> 0;
  const rnd = mulberry32(seed);
  const s = {
    phase: 'brief',
    seed,
    // The quiz is built from a seed that never leaves the server, so nobody
    // can compute the answers from the view.
    qseed: (Math.random() * 0x7fffffff) >>> 0,
    picks: { ...(prev.picks || {}) },
    last: now,
    phaseAt: now,
    phaseEnds: now + T_BRIEF,
    leg: 0,
    stop: null,
    order: shuffle([0, 1, 2, 3, 4], rnd),
    ch: {},
    thirst: {},
    drives: {},
    navs: {},
    driver: null,
    nav: null,
    nextDriver: null,
    dest: null,
    decoy: null,
    rating: RATING_START,
    events: [],
    evSeq: 0,
    jobs: [],
    jobSeq: 0,
    imps: [],
    photos: [],
    final: null,
    idleAt: null,
  };
  for (const id of CAST_IDS) {
    s.ch[id] = {
      tip: 0,
      fun: 0,
      asleep: false,
      lost: false,
      drink: null,
      sleepAt: null,
      st: {
        spit: 0, sip: 0, glass: 0, skull: 0, juice: 0,
        ok: 0, fail: 0, hero: 0, butter: 0, nap: 0, smile: 0, blink: 0,
        roo: 0, drives: 0, driveScore: 0, quiz: 0, stomp: 0, cheese: 0, pour: 0, stack: 0,
      },
    };
    s.thirst[id] = 0.2 + rnd() * 0.6;
  }
  // Anyone present without a character gets a free one.
  dropGhostPicks(s, ctx);
  for (const seat of ctx.players) if (!s.picks[seat]) s.picks[seat] = freeCast(s)[0] || null;

  const humans = humanCids(s, ctx);
  s.driver = humans[Math.floor(rnd() * humans.length)] || null;
  pushEvent(s, now, { k: 'keys', who: s.driver, first: 1 });
  return s;
}

function startLeg(s, ctx, leg) {
  const now = ctx.now;
  const track = getTrack(s.seed, leg);
  s.phase = 'drive';
  s.leg = leg;
  s.stop = null;
  s.phaseAt = now;
  s.phaseEnds = now + LEG_MAX_MS;
  s.legStart = now;
  s.dest = leg < STOPS ? s.order[leg] : 'home';
  // Wrong-way sign: another winery, so the sign alone gives nothing away.
  if (leg < STOPS) {
    const others = WINERIES.map((_, i) => i).filter((i) => i !== s.order[leg]);
    const pool = [...others.map((i) => WINERIES[i].name), ...DECOYS.slice(0, 3)];
    s.decoy = pool[(s.seed + leg * 7) % pool.length];
  } else s.decoy = HOME.decoy;

  // Keys: whoever was picked at the last stop, if they're still here.
  const humans = humanCids(s, ctx);
  if (leg > 0) {
    s.driver = s.nextDriver && humans.includes(s.nextDriver) ? s.nextDriver : chooseDriver(s, ctx, s.driver);
  } else if (!humans.includes(s.driver)) s.driver = humans[0] || null;
  s.nextDriver = null;
  // Navigator: another human, the one who's navigated least.
  const navPool = humans.filter((c) => c !== s.driver);
  navPool.sort((a, b) => (s.navs[a] || 0) - (s.navs[b] || 0) || Math.random() - 0.5);
  s.nav = navPool[0] || null;
  if (s.nav) s.navs[s.nav] = (s.navs[s.nav] || 0) + 1;

  const prevTp = s.bus?.tp || 0;
  s.bus = { z: track.startZ, x: 0, v: 0, at: now, lastPosAt: 0, auto: false, pen: 0, tp: prevTp + 1 };
  s.judged = [];
  s.hits = [];
  s.offAcc = 0;
  s.forkDone = false;
  s.parked = null;
  s.legLog = { leg, driver: s.driver, hits: [], wrong: false, sign: false, park: null, score: 0, offroad: 0 };
  s.jobs = [];
  s.imps = [];
  s.grip = null;
  s.splat = null;
  s.leansDone = [];
  s.spotted = [];
  s.spotAt = {};
  s.photoDone = false;
  s.setDone = false;
  s.nextNpc = now + 3500;
  s.nextJob = {};
  for (const c of humans) if (c !== s.driver) s.nextJob[c] = now + 2600 + Math.random() * 2500;

  for (const id of CAST_IDS) {
    const c = s.ch[id];
    c.asleep = false;
    c.drink = null;
    c.tip = Math.max(0, c.tip - 2); // fresh air on the top deck
    c.sleepAt = id !== s.driver && c.tip >= SLEEP_AT ? now + 7000 + Math.random() * 16000 : null;
  }
  pushEvent(s, now, { k: 'depart', leg, who: s.driver, nav: s.nav });
}

function endLeg(s, ctx, park) {
  const now = ctx.now;
  const log = s.legLog;
  log.park = park.q;
  const parkPts = { perfect: 15, ok: 6, miss: 0, hedge: -5, tow: -10, auto: 4 }[park.q] ?? 0;
  const clean = log.hits.length === 0 && !log.wrong;
  log.score = Math.max(0, 25 + (clean ? 15 : 0) - log.hits.length * 6 + parkPts + (log.wrong ? 0 : 10));
  if (park.q === 'perfect') s.rating += 2;
  if (park.q === 'miss') s.rating -= 2;
  if (park.q === 'hedge') s.rating -= 3;
  if (park.q === 'tow') s.rating -= 6;
  if (clean) s.rating += 5;
  s.rating = clamp(s.rating, 0, 100);

  const d = s.driver && s.ch[s.driver];
  if (d) {
    d.fun += log.score;
    d.st.drives++;
    d.st.driveScore += log.score;
    s.drives[s.driver] = (s.drives[s.driver] || 0) + 1;
  }
  s.parked = { ...park };
  s.jobs = [];
  s.imps = [];
  for (const id of CAST_IDS) s.ch[id].asleep = false;

  if (s.leg >= LEGS - 1) return finish(s, ctx);

  s.phase = 'arrive';
  s.stop = s.leg;
  s.phaseAt = now;
  s.phaseEnds = now + T_ARRIVE;
  s.nextDriver = chooseDriver(s, ctx, s.driver);
  pushEvent(s, now, { k: 'park', q: park.q });
}

function beginPour(s, ctx) {
  s.phase = 'pour';
  s.phaseAt = ctx.now;
  s.phaseEnds = ctx.now + T_POUR;
  for (const id of CAST_IDS) s.ch[id].drink = null;
  // The next leg's driver is on the grape juice — but only when there's a
  // choice of drivers. Alone, you're everybody's designated everything.
  if (s.nextDriver && humanCids(s, ctx).length >= 2) s.ch[s.nextDriver].drink = 'juice';
}

function endPour(s, ctx) {
  const humans = new Set(humanCids(s, ctx));
  for (const id of CAST_IDS) {
    const c = s.ch[id];
    if (!c.drink) c.drink = humans.has(id) || isPicked(s, id) ? 'sip' : npcDrink(s, id);
    const d = DRINKS[c.drink];
    c.tip = clamp(c.tip + d.tip, 0, 100);
    c.fun += d.fun;
    c.st[c.drink]++;
  }
  beginGame(s, ctx);
}

function beginGame(s, ctx) {
  const now = ctx.now;
  const w = WINERIES[s.order[s.stop]];
  s.phase = 'game';
  s.phaseAt = now;
  const t0 = now + GAME_INTRO_MS;
  s.phaseEnds = t0 + GAMES[w.game].ms;
  const sg = { k: w.game, t0 };
  if (w.game === 'pour') {
    sg.targets = pourTargets(s.seed, s.stop);
    sg.res = {};
  } else if (w.game === 'stomp') {
    sg.n = {};
    sg.at = {};
  } else if (w.game === 'cheese') {
    sg.eaten = {};
    sg.cnt = {};
  } else if (w.game === 'quiz') {
    sg.ans = {};
  } else if (w.game === 'stack') {
    sg.n = {};
    sg.p = {};
    sg.at = {};
  }
  s.sg = sg;
}

function endGame(s, ctx) {
  const now = ctx.now;
  const sg = s.sg;
  const scores = {};
  const humans = new Set(humanCids(s, ctx));
  const npc = (id) => !humans.has(id) && !isPicked(s, id);
  const rnd = Math.random;

  for (const id of CAST_IDS) {
    const t = tier(s.ch[id].tip);
    let sc = 0;
    if (sg.k === 'pour') {
      let vals = sg.res[id];
      if (!vals && npc(id)) {
        vals = sg.targets.map((tg) => tg + gauss(rnd) * (0.13 + 0.05 * t));
      }
      vals = vals || [];
      for (let r = 0; r < POUR_ROUNDS; r++) sc += pourScore(sg.targets[r], vals[r]);
      s.ch[id].st.pour = Math.max(s.ch[id].st.pour, sc);
    } else if (sg.k === 'stomp') {
      let n = sg.n[id];
      if (n == null && npc(id)) n = Math.round((GAMES.stomp.ms / 1000) * (3.4 + rnd() * 2.6 - t * 0.4));
      sc = n || 0;
      s.ch[id].st.stomp += sc;
    } else if (sg.k === 'cheese') {
      sc = (sg.cnt[id] || 0) * 10;
      s.ch[id].st.cheese += sg.cnt[id] || 0;
    } else if (sg.k === 'quiz') {
      let a = sg.ans[id];
      if (!a && npc(id)) {
        const qs = buildQuiz(s.qseed, s.stop);
        a = qs.map((q) => {
          const right = rnd() < 0.42 - 0.06 * t;
          return [right ? q.a : (q.a + 1 + Math.floor(rnd() * 3)) % 4, 2600 + rnd() * 2600];
        });
      }
      sc = quizScore(s, a);
      s.ch[id].st.quiz += sc;
    } else if (sg.k === 'stack') {
      let n = sg.n[id];
      let p = sg.p[id] || 0;
      if (n == null && npc(id)) {
        n = Math.max(2, Math.round(4 + rnd() * 5 - t * 0.8));
        p = Math.floor(rnd() * 2);
      }
      sc = (n || 0) * 10 + p * 5;
      s.ch[id].st.stack += n || 0;
    }
    scores[id] = Math.round(sc);
  }

  const rank = CAST_IDS.map((id) => ({ id, sc: scores[id] })).sort(
    (a, b) => b.sc - a.sc || (humans.has(b.id) ? 1 : 0) - (humans.has(a.id) ? 1 : 0),
  );
  const prize = [30, 20, 12];
  rank.forEach((r, i) => {
    r.pts = i < 3 && r.sc > 0 ? prize[i] : r.sc > 0 ? 5 : 0;
    s.ch[r.id].fun += r.pts;
  });

  s.tally = {
    stop: s.stop,
    winery: s.order[s.stop],
    game: sg.k,
    rank,
    drinks: Object.fromEntries(CAST_IDS.map((id) => [id, s.ch[id].drink])),
    nextDriver: s.nextDriver,
  };
  s.phase = 'tally';
  s.phaseAt = now;
  s.phaseEnds = now + T_TALLY;
  s.sg = null;
}

function finish(s, ctx) {
  const now = ctx.now;
  s.phase = 'ending';
  s.phaseAt = now;
  s.phaseEnds = null;
  s.rating = clamp(Math.round(s.rating), 0, 100);
  const ending = endingFor(s.rating);
  const humans = new Set(Object.values(s.picks));
  const ranking = CAST_IDS.map((id) => ({ id, fun: s.ch[id].fun, h: humans.has(id) ? 1 : 0 })).sort(
    (a, b) => b.fun - a.fun || b.h - a.h,
  );
  s.final = {
    rating: s.rating,
    stars: Math.round((s.rating / 20) * 2) / 2,
    ending: { key: ending.key, title: ending.title, line: ending.line, body: ending.body },
    ranking,
    awards: assignAwards(s, humans),
  };
  s.jobs = [];
  s.bus = null;
}

// ── Phase machine ────────────────────────────────────────────────────────────

function advance(s, ctx) {
  const now = ctx.now;
  if (s.phase === 'drive') stepDrive(s, ctx);
  else if (s.phase === 'game') stepGame(s, ctx);

  if (s.phaseEnds && now >= s.phaseEnds) {
    if (s.phase === 'brief') startLeg(s, ctx, 0);
    else if (s.phase === 'drive') {
      // Leg ran out of time: the tour company sends a tow truck.
      pushEvent(s, now, { k: 'tow' });
      endLeg(s, ctx, { q: 'tow', d: null });
    } else if (s.phase === 'arrive') beginPour(s, ctx);
    else if (s.phase === 'pour') endPour(s, ctx);
    else if (s.phase === 'game') endGame(s, ctx);
    else if (s.phase === 'tally') startLeg(s, ctx, s.stop + 1);
  }
  s.last = now;
  pruneEvents(s, now);
}

// ── The drive ────────────────────────────────────────────────────────────────

function stepDrive(s, ctx) {
  const now = ctx.now;
  const track = getTrack(s.seed, s.leg);
  const b = s.bus;

  // Autopilot when the driver's phone is gone or silent.
  const drvSeat = seatOf(s, s.driver, ctx.players);
  const drvOnline = drvSeat != null && ctx.players.includes(drvSeat);
  const stale = now - (b.lastPosAt || s.legStart) > DRIVER_STALE_MS;
  if (!drvOnline || stale) autopilot(s, ctx, track);
  if (s.phase !== 'drive') return;

  // Sleepers nod off.
  for (const id of CAST_IDS) {
    const c = s.ch[id];
    if (c.sleepAt && now >= c.sleepAt && !c.asleep && id !== s.driver) {
      c.asleep = true;
      c.sleepAt = null;
      c.st.nap++;
      pushEvent(s, now, { k: 'snooze', who: id });
      if (isHumanNow(s, ctx, id)) {
        s.jobs = s.jobs.filter((j) => j.done || j.cid !== id || JOBS[j.k].group);
        addJob(s, now, { k: 'wake', cid: id });
      }
    }
  }

  // Close out jobs whose time is up; NPCs nobody rescued sort themselves out.
  for (const j of s.jobs) {
    if (j.done) continue;
    if (JOBS[j.k].group) {
      if (now >= j.end) resolveGroup(s, ctx, j);
      continue;
    }
    if (j.open && !j.by && now >= j.at + CLAIM_MS) {
      const t = tier(s.ch[j.cid].tip);
      const ok = !s.ch[j.cid].asleep && Math.random() < 0.7 - 0.13 * t;
      finishJob(s, ctx, j, ok, null);
      continue;
    }
    if (now >= j.end + GRACE_MS) finishJob(s, ctx, j, false, j.by || j.cid);
  }
  s.jobs = s.jobs.filter((j) => !j.done || now - j.end < 1500);

  const z = b.z;
  // Bends: everybody leans.
  for (const l of track.leans) {
    if (s.leansDone.includes(l.id)) continue;
    if (z >= l.z - PHYS.CRUISE_V * 1.5 && z < l.z + 2000) {
      s.leansDone.push(l.id);
      addJob(s, now, { k: 'lean', cid: null, dir: l.dir });
    }
  }
  // Mid-leg group photo.
  if (!s.photoDone && z >= track.photoZ) {
    s.photoDone = true;
    addJob(s, now, { k: 'photo', cid: null });
  }
  // The leg's set piece.
  if (!s.setDone && z >= track.setZ) {
    s.setDone = true;
    setPiece(s, ctx);
  }

  // Deal jobs to people in the back — but not while a LEAN or the photo has
  // everyone's screen; a job dealt then would lose most of its time.
  const groupLive = s.jobs.some((j) => !j.done && JOBS[j.k].group && now >= j.at - 300 && now < j.end);
  if (z < track.forkZ - 20 * PHYS.SEG && !groupLive) {
    const busy = busyCids(s);
    for (const cid of humanCids(s, ctx)) {
      if (cid === s.driver || s.ch[cid].asleep) continue;
      if (s.nextJob[cid] == null) s.nextJob[cid] = now + 2500;
      if (now < s.nextJob[cid] || busy.has(cid)) continue;
      dealPersonal(s, now, cid);
      const gap = lerp(4800, 2800, s.leg / (LEGS - 1));
      s.nextJob[cid] = now + gap * (0.75 + Math.random() * 0.5);
    }
    if (now >= s.nextNpc) {
      const npcs = CAST_IDS.filter((id) => id !== s.driver && !isHumanNow(s, ctx, id) && !s.ch[id].asleep);
      if (npcs.length) {
        const pickW = npcs.map((id) => 1 + s.ch[id].tip / 25);
        dealNpc(s, now, npcs[weighted(pickW)]);
      }
      const gap = lerp(6200, 2800, s.leg / (LEGS - 1)) * clamp(6 / Math.max(1, npcs.length), 0.8, 2.2);
      s.nextNpc = now + gap * (0.7 + Math.random() * 0.6);
    }
  }

  // Keep the impulse list short.
  s.imps = s.imps.filter((im) => now - im.at < 3000);
}

function autopilot(s, ctx, track) {
  const now = ctx.now;
  const b = s.bus;
  if (!b.auto) {
    b.auto = true;
    b.autoFrom = b.z;
    b.tp++;
  }
  const dt = Math.min(1, Math.max(0, (now - b.at) / 1000));
  b.at = now;
  if (b.pen > now) return;
  // Going quiet in the car park (or past the bay) is not a free valet.
  if (b.z >= track.parkZ - 2500 && b.autoFrom >= track.parkZ - PHYS.PARK_LEAD) {
    b.v = 0;
    endLeg(s, ctx, { q: b.z >= track.endZ - 1 ? 'hedge' : 'miss', d: Math.round(b.z - track.parkZ) });
    return;
  }
  b.v = AUTO_V;
  // Steer for the clearest line through whatever is coming — except that an
  // autopilot that took over right before the fork doesn't know the way.
  const lateAtFork = b.autoFrom > track.forkZ - 9000 && b.autoFrom < track.forkZ;
  let target = safeLine(track, b.z, b.x);
  if (lateAtFork && b.z < track.forkZ) target = (b.x < 0 ? -1 : 1) * 0.6;
  const z0 = b.z;
  b.x += clamp(target - b.x, -1.6 * dt, 1.6 * dt);
  b.z += b.v * dt;
  // Autopilot never hits anything; it just marks everything as passed.
  for (const c of crossings(track, z0, b.x, b.z, b.x, new Set(s.judged))) s.judged.push(c.h.id);
  if (!s.forkDone && b.z >= track.forkZ) {
    s.forkDone = true;
    const side = b.x < 0 ? -1 : 1;
    if (side !== track.forkSide) {
      s.legLog.wrong = true;
      s.rating = clamp(s.rating - 6, 0, 100);
      b.x = track.forkSide * 0.3;
      b.tp++;
      pushEvent(s, now, { k: 'wrong', who: s.driver });
    }
    b.side = track.forkSide;
  }
  if (b.z >= track.parkZ) {
    b.z = track.parkZ;
    b.v = 0;
    endLeg(s, ctx, { q: 'auto', d: 0 });
  }
}

function pos(s, ctx, msg) {
  if (s.phase !== 'drive') return null;
  const me = s.picks[ctx.seat];
  if (!me || me !== s.driver) return null;
  const now = ctx.now;
  const b = s.bus;
  if (now - (b.lastPosAt || 0) < POS_MIN_MS) return null;
  if (msg.tp !== b.tp) return null; // a report from before a server-side move

  const z = Number(msg.z);
  const x = Number(msg.x);
  const v = Number(msg.v);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(v)) return null;

  const track = getTrack(s.seed, s.leg);
  const dt = Math.min(1.2, Math.max(0.05, (now - (b.lastPosAt || now - 100)) / 1000));
  const z0 = b.z;
  const x0 = b.x;
  let nz = z;
  if (b.auto) {
    // Taking the wheel back from the autopilot: accept anywhere near it.
    if (Math.abs(z - b.z) > 2500) return null;
  } else {
    if (z < z0 - 400) return null;
    const maxDz = PHYS.MAX_V * dt * 1.25 + 150;
    nz = Math.min(z, z0 + maxDz);
  }
  if (b.pen > now) nz = Math.min(nz, z0 + 50);
  nz = Math.min(nz, track.endZ);
  const maxDx = 3.6 * dt + 0.35;
  const nx = clamp(clamp(x, x0 - maxDx, x0 + maxDx), -PHYS.X_LIMIT, PHYS.X_LIMIT);

  b.auto = false;
  b.z = nz;
  b.x = nx;
  b.v = clamp(v, 0, PHYS.MAX_V);
  b.at = now;
  b.lastPosAt = now;

  // Hazards crossed between the two reports.
  const judged = new Set(s.judged);
  for (const c of crossings(track, z0, x0, nz, nx, judged)) {
    s.judged.push(c.h.id);
    if (c.hit) hitHazard(s, ctx, c.h);
  }

  // Gravel.
  if (Math.abs(nx) > 1.05 && nz > z0) {
    s.offAcc += dt * 1000;
    s.legLog.offroad += dt;
    if (s.offAcc >= 1300) {
      s.offAcc = 0;
      s.rating = clamp(s.rating - 1, 0, 100);
      pushEvent(s, now, { k: 'gravel' });
    }
  }

  // The fork.
  if (!s.forkDone && z0 < track.forkZ && nz >= track.forkZ) {
    s.forkDone = true;
    const t = (track.forkZ - z0) / Math.max(1, nz - z0);
    const xc = x0 + (nx - x0) * t;
    const side = xc < 0 ? -1 : 1;
    const signHit = s.legLog.hits.some((h) => h.k === 'sign');
    if (signHit || side !== track.forkSide) {
      // Straight into the signpost is no shortcut: you still back off it and
      // go the right way, just with less of a detour than a wrong turn.
      if (!signHit) {
        s.legLog.wrong = true;
        s.rating = clamp(s.rating - 6, 0, 100);
        pushEvent(s, now, { k: 'wrong', who: s.driver });
      }
      b.pen = now + (signHit ? 2000 : PEN_MS);
      b.tp++;
      b.v = 0;
      b.x = track.forkSide * 0.3;
      b.z = track.forkZ + 200;
      b.side = track.forkSide;
    } else {
      b.side = side;
      pushEvent(s, now, { k: 'right', who: s.driver, nav: s.nav });
    }
  }

  // Parking: stopped in the car park, or into the hedge.
  if (nz >= track.endZ - 1) {
    endLeg(s, ctx, { q: 'hedge', d: Math.round(nz - track.parkZ) });
  } else if (nz >= track.parkZ - 2500 && b.v < 140) {
    const d = Math.abs(nz - track.parkZ);
    let q = d <= PHYS.PARK_PERFECT ? 'perfect' : d <= PHYS.PARK_OK ? 'ok' : 'miss';
    if (Math.abs(nx) > 0.85 && q !== 'miss') q = q === 'perfect' ? 'ok' : 'miss';
    endLeg(s, ctx, { q, d: Math.round(nz - track.parkZ) });
  }

  s.last = now;
  return { ...s };
}

function hitHazard(s, ctx, h) {
  const now = ctx.now;
  const def = HAZARDS[h.k];
  s.hits.push(h.id);
  s.legLog.hits.push({ k: h.k });
  s.rating = clamp(s.rating + def.rating, 0, 100);
  if (h.k === 'roo' && s.ch[s.driver]) s.ch[s.driver].st.roo++;
  // Everybody in the back goes flying.
  s.imps.push({ id: ++s.jobSeq, at: now, dx: (Math.random() < 0.5 ? -1 : 1) * 0.4 });
  pushEvent(s, now, { k: 'hit', h: h.k, id: h.id, who: s.driver });
}

// A passenger with nothing to do taps a hazard on their road view: the driver
// gets it flashed on theirs. First spot of each hazard scores.
function spot(s, ctx, msg) {
  if (s.phase !== 'drive') return null;
  const me = s.picks[ctx.seat];
  if (!me || me === s.driver || s.ch[me].asleep) return null;
  const now = ctx.now;
  if (now - (s.spotAt[me] || 0) < 1200) return null;
  const track = getTrack(s.seed, s.leg);
  const h = track.haz.find((x) => x.id === msg.id);
  if (!h || h.k === 'sign' || s.spotted.includes(h.id) || s.judged.includes(h.id)) return null;
  const ahead = h.cz - s.bus.z;
  if (ahead < 600 || ahead > 34000) return null;
  s.spotAt[me] = now;
  s.spotted.push(h.id);
  s.ch[me].fun += 2;
  s.ch[me].st.spots = (s.ch[me].st.spots || 0) + 1;
  pushEvent(s, now, { k: 'spot', who: me, id: h.id, h: h.k });
  s.last = now;
  return { ...s };
}

function horn(s, ctx) {
  if (s.phase !== 'drive') return null;
  if (s.picks[ctx.seat] !== s.driver) return null;
  const now = ctx.now;
  if (now - (s.lastHorn || 0) < 900) return null;
  s.lastHorn = now;
  pushEvent(s, now, { k: 'horn' });
  s.last = now;
  return { ...s };
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

function addJob(s, now, j) {
  const def = JOBS[j.k];
  const job = {
    id: ++s.jobSeq,
    k: j.k,
    cid: j.cid ?? null,
    sub: j.sub ?? null,
    by: null,
    open: !!j.open,
    at: now,
    end: now + (j.open ? CLAIM_MS + def.dur : def.dur),
    r: Math.floor(Math.random() * 1e6),
    dir: j.dir ?? null,
    conga: j.conga ? 1 : 0,
    res: def.group ? {} : null,
    done: false,
    ok: null,
  };
  // A group moment takes over every passenger's screen, so whatever they were
  // doing gets that long back.
  if (def.group) {
    for (const o of s.jobs) if (!o.done && !JOBS[o.k].group) o.end += def.dur;
  }
  s.jobs.push(job);
  return job;
}

function jobView(j) {
  return {
    id: j.id,
    k: j.k,
    cid: j.cid,
    sub: j.sub,
    by: j.by,
    open: j.open ? 1 : 0,
    at: j.at,
    end: j.end,
    r: j.r,
    dir: j.dir,
    conga: j.conga,
  };
}

function busyCids(s) {
  const out = new Set();
  for (const j of s.jobs) {
    if (j.done || JOBS[j.k].group) continue;
    if (j.by) out.add(j.by);
    else if (!j.open && j.cid) out.add(j.cid);
  }
  return out;
}

function dealPersonal(s, now, cid) {
  const t = tier(s.ch[cid].tip);
  // Tipsier passengers get more of the wobbly jobs.
  const w = {
    bottle: 3,
    sitdown: 2 + t,
    hiccup: 1 + t * 1.2,
    hat: 2,
    platter: 2,
    sing: 1.5 + (s.leg >= 1 ? 1 : 0),
  };
  const kinds = SOLO_JOBS;
  const k = kinds[weighted(kinds.map((x) => w[x]))];
  const others = CAST_IDS.filter((id) => id !== cid && id !== s.driver);
  const sub = k === 'hat' ? (Math.random() < 0.5 ? cid : rand(others)) : rand(others);
  addJob(s, now, { k, cid, sub });
}

function dealNpc(s, now, cid) {
  const k = rand(['bottle', 'sitdown', 'sitdown', 'hat', 'hiccup', 'platter']);
  addJob(s, now, { k, cid, sub: cid, open: true });
  pushEvent(s, now, { k: 'trouble', who: cid, job: k });
}

function claim(s, ctx, msg) {
  if (s.phase !== 'drive') return null;
  const me = s.picks[ctx.seat];
  if (!me || me === s.driver || s.ch[me].asleep) return null;
  const j = s.jobs.find((x) => x.id === msg.id);
  if (!j || j.done || !j.open || j.by) return null;
  if (ctx.now >= j.at + CLAIM_MS) return null;
  if (busyCids(s).has(me)) return null;
  j.by = me;
  j.end = ctx.now + JOBS[j.k].dur;
  s.last = ctx.now;
  return { ...s };
}

function jobResult(s, ctx, msg) {
  if (s.phase !== 'drive') return null;
  const me = s.picks[ctx.seat];
  if (!me) return null;
  const j = s.jobs.find((x) => x.id === msg.id);
  if (!j || j.done) return null;
  const now = ctx.now;
  if (now > j.end + GRACE_MS) return null;
  const q = clamp(Number(msg.q) || 0, 0, 1);
  if (JOBS[j.k].group) {
    if (me === s.driver) return null;
    if (j.res[me] != null) return null;
    j.res[me] = msg.ok ? Math.max(q, 0.6) : Math.min(q, 0.59);
    s.last = now;
    return { ...s };
  }
  const doer = j.open ? j.by : j.cid;
  if (doer !== me) return null;
  // Someone who isn't asleep can't "fail" faster than a human could try.
  finishJob(s, ctx, j, !!msg.ok, me);
  s.last = now;
  return { ...s };
}

function finishJob(s, ctx, j, ok, doer) {
  const now = ctx.now;
  j.done = true;
  j.ok = ok;
  j.end = Math.min(j.end, now);
  const def = JOBS[j.k];
  const d = doer ? s.ch[doer] : null;

  if (j.k === 'wake') {
    const c = s.ch[j.cid];
    if (ok) {
      c.asleep = false;
      c.tip = Math.min(c.tip, SLEEP_AT - 7);
      pushEvent(s, now, { k: 'woke', who: j.cid });
    } else {
      // Snoring rocks the bus; try again in a moment.
      s.imps.push({ id: ++s.jobSeq, at: now, dx: (j.r % 2 ? 1 : -1) * 0.25 });
      if (s.phase === 'drive') {
        const again = addJob(s, now + 2500, { k: 'wake', cid: j.cid });
        again.at = now + 2500;
        again.end = again.at + JOBS.wake.dur;
      }
    }
    return;
  }

  if (ok) {
    if (d) {
      d.fun += j.open ? 10 : 6;
      d.st.ok++;
      if (j.open && doer !== j.cid) d.st.hero++;
    }
    if (j.open && doer && doer !== j.cid) pushEvent(s, now, { k: 'saved', who: doer, sub: j.cid, job: j.k });
    return;
  }

  if (d) d.st.fail++;
  // An NPC nobody rescued isn't the party's fault — it only shoves the bus.
  if (doer) s.rating = clamp(s.rating + def.rating, 0, 100);
  const dir = j.r % 2 ? 1 : -1;
  if (def.imp) s.imps.push({ id: ++s.jobSeq, at: now, dx: dir * def.imp });
  const who = j.open ? j.cid : doer || j.cid;
  if (j.k === 'bottle') {
    if (s.ch[who]) s.ch[who].st.butter++;
    if (j.r % 3 === 0) s.splat = { at: now, n: 3 };
  }
  if (j.k === 'hat') {
    const owner = j.sub || j.cid;
    if (s.ch[owner]) s.ch[owner].lost = true;
  }
  pushEvent(s, now, { k: 'fail', job: j.k, who, sub: j.sub });
}

function resolveGroup(s, ctx, j) {
  const now = ctx.now;
  j.done = true;
  const pax = CAST_IDS.filter((id) => id !== s.driver);
  const humans = new Set(humanCids(s, ctx));
  if (j.k === 'lean') {
    let good = 0;
    for (const id of pax) {
      const c = s.ch[id];
      let ok;
      if (humans.has(id) && !c.asleep) ok = (j.res[id] ?? 0) >= 0.6;
      else ok = !c.asleep && Math.random() < 0.82 - 0.12 * tier(c.tip);
      if (ok) {
        good++;
        if (humans.has(id)) c.fun += 3;
      }
    }
    const q = pax.length ? good / pax.length : 1;
    j.ok = q;
    if (q >= 0.7) {
      s.grip = { until: now + 5000, g: 0.5 };
      pushEvent(s, now, { k: 'lean-ok', q: Math.round(q * 100), conga: j.conga });
    } else if (q < 0.5) {
      const mag = JOBS.lean.imp * (1 - q) * (j.conga ? 1.6 : 1.2);
      s.imps.push({ id: ++s.jobSeq, at: now, dx: -(j.dir || 1) * mag });
      s.rating = clamp(s.rating + JOBS.lean.rating * (1 - q), 0, 100);
      pushEvent(s, now, { k: 'lean-fail', q: Math.round(q * 100), conga: j.conga, dir: j.dir });
    } else {
      pushEvent(s, now, { k: 'lean-meh', q: Math.round(q * 100), conga: j.conga });
    }
    return;
  }
  if (j.k === 'photo') {
    const who = {};
    for (const id of CAST_IDS) {
      const c = s.ch[id];
      if (id === s.driver) who[id] = 'd';
      else if (c.asleep) who[id] = 'z';
      else if (humans.has(id)) who[id] = (j.res[id] ?? 0) >= 0.6 ? 's' : 'b';
      else who[id] = Math.random() < 0.8 - 0.1 * tier(c.tip) ? 's' : 'b';
      if (who[id] === 's') {
        c.st.smile++;
        if (humans.has(id)) c.fun += 3;
      }
      if (who[id] === 'b') c.st.blink++;
    }
    s.photos.push({ leg: s.leg, who, lost: CAST_IDS.filter((id) => s.ch[id].lost) });
    pushEvent(s, now, { k: 'photo' });
  }
}

function setPiece(s, ctx) {
  const now = ctx.now;
  const sp = SETPIECES[s.leg];
  if (!sp) return;
  pushEvent(s, now, { k: 'set', set: sp.k });
  const humans = humanCids(s, ctx).filter((c) => c !== s.driver && !s.ch[c].asleep);
  const busy = busyCids(s);
  if (sp.k === 'singalong') {
    for (const c of humans) if (!busy.has(c)) addJob(s, now, { k: 'sing', cid: c, sub: c });
  } else if (sp.k === 'conga') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    addJob(s, now, { k: 'lean', cid: null, dir, conga: true });
  } else if (sp.k === 'cork') {
    s.splat = { at: now, n: 7 };
  } else if (sp.k === 'gust') {
    for (const c of humans) if (!busy.has(c)) addJob(s, now, { k: 'hat', cid: c, sub: c });
    for (const id of CAST_IDS) {
      if (id === s.driver || humans.includes(id)) continue;
      if (Math.random() < 0.25) {
        s.ch[id].lost = true;
        pushEvent(s, now, { k: 'fail', job: 'hat', who: id, sub: id });
      }
    }
  }
}

// ── Stops ────────────────────────────────────────────────────────────────────

function drink(s, ctx, msg) {
  if (s.phase !== 'pour') return null;
  const me = s.picks[ctx.seat];
  if (!me) return null;
  if (!['spit', 'sip', 'glass', 'skull'].includes(msg.k)) return null;
  const c = s.ch[me];
  if (c.drink === 'juice') return null; // designated driver — no
  if (c.drink === msg.k) return null;
  c.drink = msg.k;
  // Everybody's chosen? No need to stare at the countdown.
  if (humanCids(s, ctx).every((id) => s.ch[id].drink)) s.phaseEnds = Math.min(s.phaseEnds, ctx.now + 1500);
  s.last = ctx.now;
  return { ...s };
}

function gameInput(s, ctx, msg) {
  if (s.phase !== 'game' || !s.sg) return null;
  const me = s.picks[ctx.seat];
  if (!me) return null;
  const sg = s.sg;
  const now = ctx.now;
  const t = now - sg.t0;
  if (t < -200 || now > s.phaseEnds + GRACE_MS) return null;

  if (sg.k === 'pour' && msg.t === 'pour') {
    const r = Number(msg.r);
    if (!(r >= 0 && r < POUR_ROUNDS)) return null;
    // Rounds are on a clock; a little grace either side for latency.
    if (t < r * POUR_ROUND_MS - 300 || t > (r + 1) * POUR_ROUND_MS + GRACE_MS) return null;
    const res = (sg.res[me] = sg.res[me] || []);
    if (res[r] != null) return null;
    const v = clamp(Number(msg.v) || 0, 0, 1.5);
    res[r] = Math.round(v * 1000) / 1000;
    if (v > 1) {
      s.ch[me].tip = clamp(s.ch[me].tip + 3, 0, 100);
      pushEvent(s, now, { k: 'spill', who: me });
    }
  } else if (sg.k === 'stomp' && msg.t === 'stomp') {
    const n = Math.floor(Number(msg.n) || 0);
    const prev = sg.n[me] || 0;
    if (n <= prev) return null;
    const allowed = Math.ceil((STOMP_MAX_RATE * Math.max(0, now - sg.t0)) / 1000) + 2;
    if (prev >= allowed) return null;
    sg.n[me] = Math.min(n, allowed);
    sg.at[me] = now;
  } else if (sg.k === 'cheese' && msg.t === 'eat') {
    const items = buildPlatter(s.seed, s.stop);
    const it = items.find((i) => i.id === msg.id);
    if (!it || sg.eaten[it.id] != null) return null;
    if (t < it.at - 40 || t > it.at + FOOD_TTL + 300) return null;
    sg.at = sg.at || {};
    if (now - (sg.at[me] || 0) < 260) return null; // one mouth, one bite at a time
    sg.at[me] = now;
    eat(s, me, it, now);
  } else if (sg.k === 'quiz' && msg.t === 'ans') {
    const q = Math.floor(t / QUIZ_Q_MS);
    if (msg.q !== q && !(msg.q === q - 1 && t - q * QUIZ_Q_MS < 300)) return null;
    if (!(msg.q >= 0 && msg.q < QUIZ_Q)) return null;
    const a = (sg.ans[me] = sg.ans[me] || []);
    if (a[msg.q]) return null;
    const i = Math.floor(Number(msg.i));
    if (!(i >= 0 && i < 4)) return null;
    a[msg.q] = [i, Math.max(0, t - msg.q * QUIZ_Q_MS)];
  } else if (sg.k === 'stack' && msg.t === 'stack') {
    const n = Math.floor(Number(msg.n) || 0);
    const prev = sg.n[me] || 0;
    if (n !== prev + 1) return null;
    if (now - (sg.at[me] || 0) < 420) return null;
    if (n > Math.floor(Math.max(0, now - sg.t0) / 420) + 1) return null;
    sg.n[me] = n;
    sg.at[me] = now;
    if (msg.p) sg.p[me] = (sg.p[me] || 0) + 1;
  } else return null;

  s.last = now;
  return { ...s };
}

function eat(s, cid, it, now) {
  const f = FOOD[it.k];
  s.sg.eaten[it.id] = CAST_IDS.indexOf(cid);
  s.sg.cnt[cid] = (s.sg.cnt[cid] || 0) + 1;
  const c = s.ch[cid];
  c.fun += f.fun;
  c.tip = clamp(c.tip + f.tip, 0, 100);
  if (it.k === 'brie' || it.k === 'chilli') pushEvent(s, now, { k: it.k, who: cid });
}

function stepGame(s, ctx) {
  const sg = s.sg;
  if (!sg || sg.k !== 'cheese') return;
  // NPCs reach for the platter too — slower than a hungry human.
  const now = ctx.now;
  const t = now - sg.t0;
  const humans = new Set(humanCids(s, ctx));
  const npcs = CAST_IDS.filter((id) => !humans.has(id) && !isPicked(s, id));
  if (!npcs.length) return;
  for (const it of buildPlatter(s.seed, s.stop)) {
    if (sg.eaten[it.id] != null) continue;
    const h = (it.id * 2654435761) >>> 0;
    if (h % 100 > 38) continue;
    const delay = 1250 + (h % 1300);
    if (t >= it.at + delay && t <= it.at + FOOD_TTL) eat(s, npcs[h % npcs.length], it, now);
  }
}

function gameView(s, me, now) {
  const sg = s.sg;
  if (!sg) return null;
  const t = now - sg.t0;
  const out = { k: sg.k, t0: sg.t0 };
  const named = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v]));
  if (sg.k === 'pour') {
    out.targets = sg.targets;
    out.mine = sg.res[me] || [];
  } else if (sg.k === 'stomp') {
    out.n = named(sg.n);
  } else if (sg.k === 'cheese') {
    out.eaten = sg.eaten;
    out.cnt = named(sg.cnt);
  } else if (sg.k === 'quiz') {
    const qs = buildQuiz(s.qseed, s.stop);
    const q = clamp(Math.floor(Math.max(0, t) / QUIZ_Q_MS), 0, QUIZ_Q - 1);
    out.q = t < 0 ? -1 : q;
    out.qs = qs.map((x, i) => ({
      kind: x.kind,
      opts: i <= q && t >= 0 ? x.opts : null,
      // the answer only once that question has closed
      a: t >= (i + 1) * QUIZ_Q_MS ? x.a : null,
    }));
    out.mine = sg.ans[me] || [];
    out.score = quizScore(s, sg.ans[me]);
  } else if (sg.k === 'stack') {
    out.n = named(sg.n);
  }
  return out;
}

function pourScore(target, v) {
  if (v == null || !Number.isFinite(v)) return 0;
  if (v > 1) return 0;
  return Math.max(0, Math.round(100 - Math.abs(v - target) * 260));
}

function quizScore(s, ans) {
  if (!ans) return 0;
  const qs = buildQuiz(s.qseed, s.stop);
  let sc = 0;
  for (let q = 0; q < QUIZ_Q; q++) {
    const a = ans[q];
    if (!a) continue;
    if (a[0] === qs[q].a) sc += 20 + Math.round(15 * clamp(1 - a[1] / QUIZ_Q_MS, 0, 1));
  }
  return sc;
}

function npcDrink(s, id) {
  const th = s.thirst[id];
  const c = s.ch[id];
  const sensible = c.tip >= 62;
  const w = sensible ? [0.45, 0.4, 0.15, 0] : [(1 - th) * 0.35, 0.35, 0.22 + th * 0.2, th * 0.32];
  return ['spit', 'sip', 'glass', 'skull'][weighted(w)];
}

// ── Keys, picks, presence ────────────────────────────────────────────────────

function chooseDriver(s, ctx, exclude) {
  let pool = humanCids(s, ctx);
  if (pool.length >= 2 && exclude) pool = pool.filter((c) => c !== exclude);
  if (!pool.length) return null;
  pool.sort(
    (a, b) =>
      (s.drives[a] || 0) - (s.drives[b] || 0) || s.ch[a].tip - s.ch[b].tip || Math.random() - 0.5,
  );
  const who = pool[0];
  pushEvent(s, ctx.now, { k: 'keys', who });
  return who;
}

function pick(s, ctx, msg) {
  const cid = String(msg.cid || '');
  if (!Object.hasOwn(CAST_BY_ID, cid)) return null;
  const seat = ctx.seat;
  if (s.picks[seat] === cid) return null;
  // Taken by somebody who's here right now?
  const holder = Object.entries(s.picks).find(([st, c]) => c === cid && Number(st) !== seat);
  if (holder && ctx.players.includes(Number(holder[0]))) return null;
  if (s.phase !== 'lobby') {
    // Mid-tour you keep who you are, and you can only become someone nobody
    // has — not a friend who is mid-reload.
    if (s.picks[seat] || holder) return null;
  }
  if (holder) delete s.picks[holder[0]];
  s.picks[seat] = cid;
  s.last = ctx.now;
  return { ...s };
}

// Someone (re)connecting, or anyone at all after the room went quiet.
function hello(s, ctx) {
  if (s.idleAt) {
    shiftTimes(s, ctx.now - s.idleAt);
    s.idleAt = null;
  }
  s.last = ctx.now;
  return { ...s };
}

function shiftTimes(s, d) {
  if (!d) return;
  const sh = (o, k) => {
    if (o && typeof o[k] === 'number' && o[k]) o[k] += d;
  };
  sh(s, 'phaseAt');
  sh(s, 'phaseEnds');
  sh(s, 'legStart');
  sh(s, 'nextNpc');
  if (s.bus) {
    sh(s.bus, 'at');
    sh(s.bus, 'lastPosAt');
    sh(s.bus, 'pen');
  }
  for (const j of s.jobs || []) {
    sh(j, 'at');
    sh(j, 'end');
  }
  for (const k in s.nextJob || {}) s.nextJob[k] += d;
  for (const id in s.ch || {}) sh(s.ch[id], 'sleepAt');
  for (const im of s.imps || []) sh(im, 'at');
  if (s.sg) sh(s.sg, 't0');
  if (s.grip) sh(s.grip, 'until');
}

function dropGhostPicks(s, ctx) {
  for (const st of Object.keys(s.picks)) {
    if (!ctx.seats.some((x) => x.seat === Number(st))) delete s.picks[st];
  }
}

function freeCast(s) {
  const held = new Set(Object.values(s.picks));
  return shuffle(
    CAST_IDS.filter((id) => !held.has(id)),
    Math.random,
  );
}

function humanCids(s, ctx) {
  const out = [];
  for (const seat of ctx.players) {
    const c = s.picks[seat];
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

function isHumanNow(s, ctx, cid) {
  return ctx.players.some((seat) => s.picks[seat] === cid);
}

function isPicked(s, cid) {
  return Object.values(s.picks).includes(cid);
}

function seatOf(s, cid, players) {
  const seats = Object.entries(s.picks)
    .filter(([, c]) => c === cid)
    .map(([st]) => Number(st));
  if (players) {
    const live = seats.find((st) => players.includes(st));
    if (live != null) return live;
  }
  return seats.length ? seats[0] : null;
}

function partyLevel(s) {
  const pax = CAST_IDS.filter((id) => id !== s.driver);
  if (!pax.length) return 0;
  let sum = 0;
  for (const id of pax) sum += s.ch[id].tip + (s.ch[id].asleep ? 10 : 0);
  return clamp(sum / pax.length / 100 + (s.leg || 0) * 0.04, 0, 1);
}

// ── Awards ───────────────────────────────────────────────────────────────────

function assignAwards(s, humans) {
  const st = (id) => s.ch[id].st;
  const metric = {
    party: (id) => s.ch[id].fun,
    legend: (id) => (st(id).drives ? st(id).driveScore / st(id).drives : -1),
    hero: (id) => (st(id).hero + (st(id).spots || 0) / 3 >= 2 ? st(id).hero + (st(id).spots || 0) / 3 : -1),
    somm: (id) => (st(id).quiz > 0 ? st(id).quiz : -1),
    steady: (id) => (st(id).pour > 0 ? st(id).pour : -1),
    stomp: (id) => (st(id).stomp > 0 ? st(id).stomp : -1),
    cheese: (id) => (st(id).cheese >= 3 ? st(id).cheese : -1),
    stack: (id) => (st(id).stack > 0 ? st(id).stack : -1),
    skull: (id) => (st(id).skull >= 2 ? st(id).skull : -1),
    spit: (id) => (st(id).spit >= 3 ? st(id).spit : -1),
    smile: (id) => (st(id).smile >= 4 ? st(id).smile : -1),
    roo: (id) => (st(id).roo >= 1 ? st(id).roo : -1),
    lost: (id) => (s.ch[id].lost ? 1 : -1),
    butter: (id) => (st(id).butter >= 2 ? st(id).butter : -1),
    nap: (id) => (st(id).nap >= 1 ? st(id).nap : -1),
    blink: (id) => (st(id).blink >= 2 ? st(id).blink : -1),
  };
  const order = Object.keys(metric);
  // The cheeky ones only go to people who were actually holding a phone —
  // nobody gets "Bottoms Up" for a day the game played on their behalf.
  const HUMAN_ONLY = new Set(['skull', 'butter', 'nap', 'blink', 'roo', 'lost']);
  const taken = new Set();
  const out = {};
  for (const key of order) {
    let best = null;
    let bestV = -1;
    for (const id of CAST_IDS) {
      if (taken.has(id)) continue;
      if (HUMAN_ONLY.has(key) && !humans.has(id)) continue;
      const v = metric[key](id);
      if (v < 0) continue;
      if (v > bestV || (v === bestV && humans.has(id) && !humans.has(best))) {
        best = id;
        bestV = v;
      }
    }
    if (best) {
      taken.add(best);
      const a = AWARDS[key];
      out[best] = { key, title: a.title, line: a.line.replace('{wear}', CAST_BY_ID[best].wear) };
    }
  }
  const rnd = mulberry32(s.seed ^ 0xabcdef);
  const fb = shuffle(AWARD_FALLBACKS.slice(), rnd);
  let i = 0;
  for (const id of CAST_IDS) {
    if (out[id]) continue;
    const a = fb[i++ % fb.length];
    out[id] = { key: 'fallback', title: a.title, line: a.line };
  }
  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const tracks = new Map();
function getTrack(seed, leg) {
  const key = `${seed}:${leg}`;
  let t = tracks.get(key);
  if (!t) {
    t = buildLeg(seed, leg);
    tracks.set(key, t);
    if (tracks.size > 32) tracks.delete(tracks.keys().next().value);
  }
  return t;
}

function pushEvent(s, now, e) {
  s.evSeq = (s.evSeq || 0) + 1;
  s.events.push({ id: s.evSeq, at: now, ...e });
  if (s.events.length > 18) s.events.splice(0, s.events.length - 18);
}

function pruneEvents(s, now) {
  if (s.events.length > 6) s.events = s.events.filter((e) => now - e.at < EVENT_TTL);
}

function isHost(ctx) {
  return ctx.players.length > 0 && ctx.players[0] === ctx.seat;
}

function weighted(ws) {
  let total = 0;
  for (const w of ws) total += Math.max(0, w);
  let r = Math.random() * total;
  for (let i = 0; i < ws.length; i++) {
    r -= Math.max(0, ws[i]);
    if (r <= 0) return i;
  }
  return ws.length - 1;
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function gauss(rnd) {
  return (rnd() + rnd() + rnd() - 1.5) / 0.75;
}

// Exposed for the headless check.
export const _test = { getTrack, assignAwards, partyLevel, pourScore, quizScore, CAST };
