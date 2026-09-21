/* ============================================================================
   SOUTHERN LIGHTS — rules module
   ----------------------------------------------------------------------------
   Two friends on a granite headland off the Western Australian coast. Lights
   come and go over the Indian Ocean. Is it the RAAF, is it Starlink, or is it
   something nobody has a word for?

   ASYMMETRY is the whole design. Seat 0 holds the BINOCULARS and gets optical
   evidence by physically tracking the light. Seat 1 has a phone on a rock doing
   long exposures, a cheap radio scanner and a compass, and gets physical
   evidence by choosing which instrument to spend on. Neither can see what the
   other sees without saying it out loud.

   The binding constraint is a SHARED evidence budget: six traits exist per
   sighting and the two of you may only collect FOUR. That is the conversation
   the game is about — "do we need the scanner, or do you want another look?"

   Then both lock a verdict BLIND. Agreement is scored separately from accuracy,
   because two friends who agree on a wrong answer have still had the same night,
   and two who disagree have not.

   PROOF rises when you correctly explain the sky. WONDER rises when you
   correctly refuse to. Guessing ANOMALY and being wrong still builds WONDER —
   the meters measure disposition, not just accuracy. Which one is higher at
   dawn decides which of four endings you get.

   Pure reducer: state in, state out. No sockets, no storage, no timers.
   ========================================================================== */

// ── Timings (ms) ─────────────────────────────────────────────────────────────
const T_BRIEF = 6000;
const T_OBSERVE = 26000;
const T_OBSERVE_SOLO = 34000; // one pair of hands, both instruments
const T_VERDICT = 22000;
const T_REVEAL = 24000;

const EVIDENCE_BUDGET = 4; // shared across both friends, of six available
const SIGHTINGS_PER_NIGHT = 8; // 7 shuffled + the last one

// ── Scoring ──────────────────────────────────────────────────────────────────
const PTS_CORRECT = 60;
const PTS_AGREED = 60; // only when both are also correct
const PTS_EVIDENCE = 12;

const METER_MAX = 100;

// ── The sky ──────────────────────────────────────────────────────────────────
// truth:  'military' | 'mundane' | 'anomaly'
// motion: animation profile, drawn client-side from a shared seed
// optics: revealed IN ORDER as you hold the reticle on the light
// sensors: keyed by instrument, so seat 1 chooses which to spend budget on
// lean:   what this single piece of evidence points at, with a weight 1–3

const SIGHTINGS = [
  {
    id: 'pearl-train',
    name: 'The Pearl Train',
    sub: 'Low in the west, a moment after the last of the light goes',
    truth: 'mundane',
    motion: 'train',
    hue: 200,
    optics: [
      { label: 'Structure', text: 'A string of evenly spaced points, perfectly in line.', lean: 'mundane', weight: 3 },
      { label: 'Colour', text: 'No colour at all. Cold white. Nothing strobes.', lean: 'mundane', weight: 2 },
      { label: 'Behaviour', text: 'They fade out one by one — each at the same point in the sky.', lean: 'mundane', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'One clean straight line per light. No wobble, no arc.', lean: 'mundane', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'Dead band. Not even a carrier.', lean: 'mundane', weight: 1 },
      magnet: { label: 'Compass', text: 'Steady. Silent. Tracking faster than any aircraft.', lean: 'mundane', weight: 3 },
    },
    reveal:
      'Starlink. A launch train, still strung out in a line before they climb to their own orbits. They "vanish" one after another at exactly the same spot because that is where each one crosses into the Earth\'s shadow.',
  },
  {
    id: 'flare-line',
    name: 'Flare Line',
    sub: 'Well offshore, past where the water goes black',
    truth: 'military',
    motion: 'fall',
    hue: 28,
    optics: [
      { label: 'Brightness', text: 'Brilliant orange-white. Far brighter than anything else tonight.', lean: 'military', weight: 2 },
      { label: 'Pattern', text: 'They arrive in pairs, a few seconds apart, then sink.', lean: 'military', weight: 3 },
      { label: 'Detail', text: 'Each one trails smoke you can just make out against the stars.', lean: 'military', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'Vertical streaks, all descending at the same slow rate. Under canopies.', lean: 'military', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'Clipped voices on a UHF air band. Callsigns and numbers, nothing conversational.', lean: 'military', weight: 3 },
      magnet: { label: 'Compass', text: 'No needle movement — but a low jet rumble arrives long after the light.', lean: 'military', weight: 2 },
    },
    reveal:
      'Flares, off a fast jet on a night exercise. The rumble arriving late is the aircraft that dropped them, already kilometres ahead of its own sound.',
  },
  {
    id: 'slow-bright',
    name: 'Slow and Bright',
    sub: 'Rising in the west, in no hurry at all',
    truth: 'mundane',
    motion: 'drift',
    hue: 45,
    optics: [
      { label: 'Colour', text: 'One steady light. No strobe, no red, no green.', lean: 'mundane', weight: 3 },
      { label: 'Brightness', text: 'Brighter than Venus, and still brightening.', lean: 'mundane', weight: 2 },
      { label: 'Structure', text: 'No shape through the glass at all. A point, not an object.', lean: 'mundane', weight: 2 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'A smooth arc, west to east. Not one deviation.', lean: 'mundane', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'Silent on everything you can tune.', lean: 'mundane', weight: 1 },
      magnet: { label: 'Compass', text: 'Crosses the entire sky in about six minutes. Orbital.', lean: 'mundane', weight: 3 },
    },
    reveal:
      'The ISS. West to east, always — that is the direction they launch. Four hundred kilometres up, catching sunlight from a sun that set down here an hour ago.',
  },
  {
    id: 'the-grid',
    name: 'The Grid',
    sub: 'Holding station a kilometre out, over nothing',
    truth: 'military',
    motion: 'swarm',
    hue: 0,
    optics: [
      { label: 'Structure', text: 'Nine lights holding a square lattice. Perfect spacing.', lean: 'military', weight: 3 },
      { label: 'Colour', text: 'Red and green. Aviation nav colours, on every one of them.', lean: 'military', weight: 3 },
      { label: 'Behaviour', text: 'The whole set rotates together, keeping spacing to the metre.', lean: 'military', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'Nine short arcs, concentric. They are turning about a shared centre.', lean: 'military', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'A repeating digital chirp. Control link splatter, 2.4 GHz.', lean: 'military', weight: 3 },
      magnet: { label: 'Compass', text: 'Nothing on the needle. But you can hear it — massed buzzing, like a hive two suburbs away.', lean: 'military', weight: 3 },
    },
    reveal:
      'A swarm. Somebody is doing formation work out over the water, where there is nobody underneath to complain about the noise and nothing to hit.',
  },
  {
    id: 'wrong-star',
    name: 'The Wrong Star',
    sub: 'Sitting just above the horizon, flashing like a warning',
    truth: 'mundane',
    motion: 'fixed',
    hue: 15,
    optics: [
      { label: 'Colour', text: 'Flashing red, then green, then white. Fast, and random.', lean: 'anomaly', weight: 1 },
      { label: 'Position', text: 'Very low. Sitting just over the water.', lean: 'mundane', weight: 3 },
      { label: 'Behaviour', text: 'It never actually moves against the ridgeline. Not once.', lean: 'mundane', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'Four minutes. Zero angular movement. It is fixed to the sky, not to the air.', lean: 'mundane', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'Nothing, on anything.', lean: 'mundane', weight: 1 },
      magnet: { label: 'Compass', text: 'It sets behind the sea — at exactly the rate of the stars either side of it.', lean: 'mundane', weight: 3 },
    },
    reveal:
      'Venus, low down and burning through a lot of atmosphere. The colours are our own air tearing the light apart, not anything up there. Every UFO hotline on Earth takes this call.',
  },
  {
    id: 'right-angle',
    name: 'The Turn',
    sub: 'High, fast, and suddenly not where it was',
    truth: 'anomaly',
    motion: 'angle',
    hue: 35,
    optics: [
      { label: 'Colour', text: 'A single amber point. No strobe. No nav lights.', lean: 'anomaly', weight: 2 },
      { label: 'Behaviour', text: 'It stops. A dead stop, out of speed, with no arc into it.', lean: 'anomaly', weight: 3 },
      { label: 'Edges', text: 'The edge is soft. It does not read as a light. It reads as a hole.', lean: 'anomaly', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'The trail turns ninety degrees. One pixel wide at the corner — it did not slow down.', lean: 'anomaly', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'Silence. Not empty band — a notch, quieter than the noise floor.', lean: 'anomaly', weight: 3 },
      magnet: { label: 'Compass', text: 'The needle swung eleven degrees as it passed, and came back.', lean: 'anomaly', weight: 3 },
    },
    reveal:
      'Neither of you says anything for a while. A ninety-degree turn at that speed is thousands of g — it would liquefy a crew and tear apart anything built to hold one. There is nothing that flies like that. It flew like that.',
  },
  {
    id: 'inbound',
    name: 'Inbound',
    sub: 'Hanging motionless, dead ahead',
    truth: 'mundane',
    motion: 'approach',
    hue: 50,
    optics: [
      { label: 'Brightness', text: 'A hard white light aimed straight down our throats.', lean: 'mundane', weight: 3 },
      { label: 'Colour', text: 'A red anti-collision strobe. Once a second, rock steady.', lean: 'mundane', weight: 3 },
      { label: 'Structure', text: 'As it banks, the one light splits into three separate lamps.', lean: 'mundane', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'A descending line at a constant three degrees. A glideslope.', lean: 'mundane', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'An automated weather loop, then an approach frequency. Plain English.', lean: 'mundane', weight: 3 },
      magnet: { label: 'Compass', text: 'Engine noise, unmistakable, about forty seconds behind the light.', lean: 'mundane', weight: 3 },
    },
    reveal:
      'Perth inbound. The "hovering light" is a landing lamp pointed straight down the approach path — it only looks motionless because it is coming directly at you. It stops looking like a UFO the instant it turns.',
  },
  {
    id: 'silent-one',
    name: 'The Silent One',
    sub: 'Directly overhead, and you only notice by what goes missing',
    truth: 'military',
    motion: 'triangle',
    hue: 30,
    optics: [
      { label: 'Structure', text: 'A dark triangle. You track it by the stars it blots out.', lean: 'anomaly', weight: 2 },
      { label: 'Colour', text: 'Three dim amber lights at the corners. No strobe.', lean: 'anomaly', weight: 2 },
      { label: 'Edges', text: 'The edges are straight. Machine straight, and they meet at points.', lean: 'military', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'A clean straight track at constant speed and heading. Going somewhere specific.', lean: 'military', weight: 2 },
      scanner: { label: 'Radio scanner', text: 'Encrypted burst traffic on a military satellite band. Structured, and not for us.', lean: 'military', weight: 3 },
      magnet: { label: 'Compass', text: 'Silent overhead — then a long low rumble arrives a full minute later.', lean: 'military', weight: 3 },
    },
    reveal:
      'Straight edges, a sound that arrives a minute late, and encrypted traffic on a milsat band. It is ours, or it is somebody\'s. The unsettling part is not that it is unexplained. It is that it is explained, and still nobody will ever tell you what it was.',
  },
  {
    id: 'fireball',
    name: 'Green Fire',
    sub: 'North, and over before you can point at it',
    truth: 'mundane',
    motion: 'meteor',
    hue: 120,
    optics: [
      { label: 'Colour', text: 'Green. Properly green, like a signal flare.', lean: 'mundane', weight: 2 },
      { label: 'Duration', text: 'Under two seconds, start to finish.', lean: 'mundane', weight: 3 },
      { label: 'Behaviour', text: 'It shed sparks and broke into three before it went.', lean: 'mundane', weight: 3 },
    ],
    sensors: {
      exposure: { label: 'Long exposure', text: 'One bright streak burned clean across the frame.', lean: 'mundane', weight: 3 },
      scanner: { label: 'Radio scanner', text: 'A delayed crackle, maybe ninety seconds later. Real, and very old.', lean: 'mundane', weight: 2 },
      magnet: { label: 'Compass', text: 'Faster than anything else all night. By an order of magnitude.', lean: 'mundane', weight: 3 },
    },
    reveal:
      'A fireball. The green is magnesium and nickel burning off at seventy kilometres up. The crackle was not your imagination — big ones really do that, and nobody is entirely sure why.',
  },
];

// The last sighting is always this one.
const FINALE = {
  id: 'the-last-one',
  name: 'The Last One',
  sub: 'You both see it at the same time, and neither of you speaks',
  truth: 'anomaly',
  motion: 'void',
  hue: 280,
  optics: [
    { label: 'Structure', text: 'It is not a light. It is an absence — a disc of sky with no stars in it.', lean: 'anomaly', weight: 3 },
    { label: 'Edges', text: 'Around the rim, the stars are in the wrong places.', lean: 'anomaly', weight: 3 },
    { label: 'Focus', text: 'There is nothing to focus on. The glass will not hold it.', lean: 'anomaly', weight: 3 },
  ],
  sensors: {
    exposure: { label: 'Long exposure', text: 'Thirty seconds, and the frame came back blank. The sensor recorded nothing there.', lean: 'anomaly', weight: 3 },
    scanner: { label: 'Radio scanner', text: 'Every band at once, for half a second. Then dead air across the whole spectrum.', lean: 'anomaly', weight: 3 },
    magnet: { label: 'Compass', text: 'Both our phones lost the time. Eleven seconds, gone from both, and they agree on which eleven.', lean: 'anomaly', weight: 3 },
  },
  reveal:
    'You sit there until the cold gets into you. Whatever that was, it did not want to be photographed, and it took eleven seconds with it when it left. On the drive home neither of you turns the radio on.',
};

const BY_ID = Object.fromEntries([...SIGHTINGS, FINALE].map((s) => [s.id, s]));

// ── Endings ──────────────────────────────────────────────────────────────────
const ENDINGS = {
  'saw-it-too': {
    title: 'You Saw It Too',
    line: 'Both of you called the last one, and both of you called it the same way.',
    body: 'That is the rarest thing on offer out here — not a sighting, but a witness. Whatever you two saw, you saw together, and neither of you will ever be the one who has to convince the other. You will still be talking about this in twenty years, and you will still agree.',
  },
  'honest-answer': {
    title: 'The Honest Answer',
    line: 'You finished the night with more questions than you started with, and you kept them.',
    body: 'You could have explained it away. Plenty of people would have. Instead you wrote down what you actually saw, including the parts that did not fit, and left the conclusion open. That is harder than believing and harder than debunking, and it is the only one of the three that is honest.',
  },
  'just-the-sky': {
    title: 'Just the Sky',
    line: 'Satellites, flares, a planet and an airliner. You worked out nearly all of it.',
    body: 'There is a particular pleasure in knowing what you are looking at, and you earned it — you took the sky apart piece by piece and named the pieces. The sky is not smaller for being understood. It is just the sky, and it was always going to be, and it is still worth driving an hour in the dark for.',
  },
  'different-nights': {
    title: 'Different Nights',
    line: 'You sat on the same rock, watched the same sky, and went home with two different stories.',
    body: 'One of you is sure. One of you is sure of something else. Neither of you is lying and neither of you will move, because you both have the same evidence and it genuinely supports both readings. That is the real story of every sighting anybody has ever had — not what was in the sky, but that two people who trust each other could not agree on it.',
  },
};

// ── Rules module ─────────────────────────────────────────────────────────────
export default {
  slug: 'southern-lights',
  title: 'Southern Lights',
  seats: 2,

  init() {
    return {
      phase: 'lobby',
      round: -1,
      order: [],
      deadline: null,
      proof: 0,
      wonder: 0,
      score: 0,
      log: [],
      cur: null,
      ending: null,
      solo: false,
    };
  },

  nextTickAt(state) {
    return state.deadline ?? null;
  },

  // Host starts the night.
  start(state, ctx) {
    if (state.phase !== 'lobby') return null;
    if (!isHost(ctx)) return null;
    if (!ctx.players.length) return null;
    return beginNight(state, ctx);
  },

  rematch(state, ctx) {
    if (state.phase !== 'ending') return null;
    if (!isHost(ctx)) return null;
    return beginNight(this.init(), ctx);
  },

  action(state, ctx) {
    const msg = ctx.msg || {};
    if (msg.t === 'sample') return sample(state, ctx, msg);
    if (msg.t === 'pick') return pick(state, ctx, msg);
    if (msg.t === 'continue') return isHost(ctx) ? advance(state, ctx) : null;
    return null;
  },

  // A deadline elapsed — push the night forward.
  tick(state, ctx) {
    if (!state.deadline || ctx.now < state.deadline - 250) return null;
    return advance(state, ctx);
  },

  // What one seat is allowed to know.
  view(state, { seat, players, now }) {
    const base = {
      phase: state.phase,
      round: state.round,
      total: SIGHTINGS_PER_NIGHT,
      proof: state.proof,
      wonder: state.wonder,
      score: state.score,
      msLeft: state.deadline ? Math.max(0, state.deadline - now) : null,
      role: roleFor(seat, state.solo),
      solo: state.solo,
      log: state.log,
      ending: state.ending ? { key: state.ending, ...ENDINGS[state.ending] } : null,
    };

    if (!state.cur) return base;

    const s = BY_ID[state.cur.sightingId];
    const revealed = state.phase === 'reveal';

    return {
      ...base,
      sighting: {
        name: s.name,
        sub: s.sub,
        motion: s.motion,
        hue: s.hue,
        seed: state.cur.seed,
        // The truth is simply not in the payload until it is earned.
        truth: revealed ? s.truth : null,
        reveal: revealed ? s.reveal : null,
      },
      budget: state.cur.budget,
      spent: state.cur.found.length,
      // The field notebook is SHARED — the fiction is that you read each entry
      // out loud as you get it. The game is in deciding what to spend on, and in
      // what the two of you make of it, not in hiding cards from a friend.
      notebook: state.cur.found.map((ref) => entryFor(s, ref)),
      opticsFound: state.cur.found.filter((r) => r.startsWith('optics')).length,
      sensorsUsed: state.cur.found.filter((r) => !r.startsWith('optics')),
      // Your own verdict is always visible to you; theirs only once you have
      // both committed, so nobody can follow the other one in.
      myPick: state.cur.picks[seat] ?? null,
      picksIn: Object.values(state.cur.picks).filter(Boolean).length,
      picksNeeded: state.solo ? 1 : Math.max(1, players.length),
      allPicks: revealed || bothPicked(state) ? state.cur.picks : null,
      lastResult: revealed ? state.cur.result ?? null : null,
    };
  },
};

// ── Phase machine ────────────────────────────────────────────────────────────

function beginNight(state, ctx) {
  const solo = ctx.players.length < 2;
  const pool = shuffle(SIGHTINGS.filter((s) => s.id !== 'right-angle')).slice(
    0,
    SIGHTINGS_PER_NIGHT - 2,
  );
  // Guarantee one genuine mid-night anomaly, so WONDER is always reachable and
  // the finale is not the only strange thing that happens.
  const turn = SIGHTINGS.find((s) => s.id === 'right-angle');
  pool.splice(2 + Math.floor(Math.random() * (pool.length - 2)), 0, turn);

  return openSighting(
    {
      ...state,
      solo,
      order: [...pool.map((s) => s.id), FINALE.id],
      round: -1,
      proof: 0,
      wonder: 0,
      score: 0,
      log: [],
      ending: null,
    },
    ctx,
  );
}

function openSighting(state, ctx) {
  const round = state.round + 1;
  if (round >= state.order.length) return finish(state);

  return {
    ...state,
    phase: 'brief',
    round,
    deadline: ctx.now + T_BRIEF,
    cur: {
      sightingId: state.order[round],
      seed: Math.floor(Math.random() * 1e9),
      budget: EVIDENCE_BUDGET,
      found: [],
      picks: {},
      result: null,
    },
  };
}

function advance(state, ctx) {
  switch (state.phase) {
    case 'brief':
      return {
        ...state,
        phase: 'observe',
        deadline: ctx.now + (state.solo ? T_OBSERVE_SOLO : T_OBSERVE),
      };
    case 'observe':
      return { ...state, phase: 'verdict', deadline: ctx.now + T_VERDICT };
    case 'verdict':
      return score(state, ctx);
    case 'reveal':
      return openSighting(state, ctx);
    default:
      return null;
  }
}

function score(state, ctx) {
  const s = BY_ID[state.cur.sightingId];
  const seats = state.solo ? [0] : [0, 1];
  const picks = seats.map((n) => state.cur.picks[n] ?? null);
  const correct = picks.filter((p) => p === s.truth).length;
  const agreed = picks.length > 1 && picks[0] && picks[0] === picks[1];

  let proof = state.proof;
  let wonder = state.wonder;

  for (const p of picks) {
    if (!p) continue;
    if (p === s.truth) {
      if (s.truth === 'anomaly') wonder += 12;
      else proof += 12;
    } else if (p === 'anomaly') {
      // Wrong, but you wanted it to be something. That is still wonder.
      wonder += 6;
    } else {
      proof += 4;
    }
  }

  const evidencePts = state.cur.found.length * PTS_EVIDENCE;
  const gained =
    correct * PTS_CORRECT + (agreed && correct === picks.length ? PTS_AGREED : 0) + evidencePts;

  const result = {
    truth: s.truth,
    picks: { ...state.cur.picks },
    correct,
    agreed,
    evidence: state.cur.found.length,
    points: gained,
  };

  return {
    ...state,
    phase: 'reveal',
    deadline: ctx.now + T_REVEAL,
    score: state.score + gained,
    proof: clamp(proof),
    wonder: clamp(wonder),
    cur: { ...state.cur, result },
    log: [
      ...state.log,
      { id: s.id, name: s.name, truth: s.truth, picks: { ...state.cur.picks }, points: gained },
    ],
  };
}

function finish(state) {
  const last = state.log[state.log.length - 1];
  const picks = Object.values(last?.picks ?? {});
  const disagreed = picks.length > 1 && picks[0] !== picks[1];
  const bothCalledIt =
    picks.length > 1 && picks.every((p) => p === 'anomaly') && last?.truth === 'anomaly';

  let ending;
  if (bothCalledIt) ending = 'saw-it-too';
  else if (disagreed) ending = 'different-nights';
  else if (state.wonder > state.proof) ending = 'honest-answer';
  else ending = 'just-the-sky';

  return { ...state, phase: 'ending', deadline: null, ending, cur: null };
}

// ── Actions ──────────────────────────────────────────────────────────────────

// Spend one unit of the shared evidence budget.
//
// Server authority note: the aiming itself (holding a reticle on a moving light)
// is a local skill mechanic and cannot be verified from here. What the server
// DOES own is everything that decides the outcome — the phase, the shared
// budget, which instruments a seat is allowed to touch, and no double-spending
// a trait. A cheating client can at best make the tracking easy for itself; it
// cannot collect more than four, cannot reach across to the other instrument,
// and cannot see a trait it did not pay for.
function sample(state, ctx, msg) {
  if (state.phase !== 'observe' || !state.cur) return null;
  if (state.cur.found.length >= state.cur.budget) return null;

  const role = roleFor(ctx.seat, state.solo);
  const s = BY_ID[state.cur.sightingId];
  const tool = String(msg.tool || '');

  let ref;
  if (tool === 'optics') {
    if (!role.includes('optics')) return null;
    const n = state.cur.found.filter((r) => r.startsWith('optics')).length;
    if (n >= s.optics.length) return null;
    ref = `optics:${n}`;
  } else {
    if (!role.includes('sensors')) return null;
    if (!s.sensors[tool]) return null;
    ref = tool;
  }

  if (state.cur.found.includes(ref)) return null;

  return { ...state, cur: { ...state.cur, found: [...state.cur.found, ref] } };
}

function pick(state, ctx, msg) {
  if (state.phase !== 'verdict' || !state.cur) return null;
  const verdict = String(msg.verdict || '');
  if (!['military', 'mundane', 'anomaly'].includes(verdict)) return null;
  if (state.cur.picks[ctx.seat]) return null; // locked is locked

  const picks = { ...state.cur.picks, [ctx.seat]: verdict };
  const needed = state.solo ? 1 : 2;
  const next = { ...state, cur: { ...state.cur, picks } };

  // Everyone in — no reason to sit and watch a clock run down.
  if (Object.values(picks).filter(Boolean).length >= needed) return score(next, ctx);
  return next;
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Two friends, two instruments. Alone, you carry both and get longer to do it.
function roleFor(seat, solo) {
  if (solo) return ['optics', 'sensors'];
  return seat === 0 ? ['optics'] : ['sensors'];
}

function entryFor(s, ref) {
  if (ref.startsWith('optics')) {
    const t = s.optics[parseInt(ref.split(':')[1], 10)];
    return { source: 'optics', label: t.label, text: t.text, lean: t.lean, weight: t.weight };
  }
  const t = s.sensors[ref];
  return { source: ref, label: t.label, text: t.text, lean: t.lean, weight: t.weight };
}

function bothPicked(state) {
  const needed = state.solo ? 1 : 2;
  return Object.values(state.cur?.picks ?? {}).filter(Boolean).length >= needed;
}

function isHost(ctx) {
  return ctx.players.length > 0 && ctx.players[0] === ctx.seat;
}

function clamp(n) {
  return Math.max(0, Math.min(METER_MAX, Math.round(n)));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
