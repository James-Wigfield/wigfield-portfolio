/* ============================================================================
   ROTTO SUB HUNT — rules module
   ----------------------------------------------------------------------------
   Battleship, in the water off Rottnest. Each of you hides a small fleet on an
   8×8 grid of your own, then you take turns firing at the other one's waters.
   First to sink everything wins.

   Two twists on the classic:

   QUOKKAS. Two of them are paddling around each side's waters, on open water
   only, and they move one square after every shot or ping on that board. The
   owner can see their own quokkas; the attacker never can. Fire on one and the
   ranger fines you — you miss your next turn. That is the drunk element: you
   cannot fully play around it, you can only be unlucky with style.

   SONAR. Twice a game, instead of firing, you can ping a square. It tells you
   how many un-hit ship sections AND how many quokkas are in the 3×3 around it,
   but not where. It costs your turn, and the quokkas swim off straight after,
   so the quokka count is only true for a moment.

   Solo is supported: alone, the empty seat is taken by a CPU skipper who plays
   by the same rules and cannot see your fleet (or the quokkas).

   Pure reducer: state in, state out. No sockets, no storage, no timers. Every
   mutating path works on a structuredClone, so `next !== state` is always a
   real change and a rejected move is always `null`.
   ========================================================================== */

// ── Board ────────────────────────────────────────────────────────────────────
const SIZE = 8;
const CELLS = SIZE * SIZE;

// Ordered biggest-first so random placement packs reliably.
const FLEET = [
  { id: 'sub', name: 'Collins-class sub', len: 4 },
  { id: 'ferry', name: 'Rotto ferry', len: 3 },
  { id: 'patrol', name: 'Patrol boat', len: 3 },
  { id: 'tinny', name: 'Tinny', len: 2 },
];
const FLEET_BY_ID = Object.fromEntries(FLEET.map((f) => [f.id, f]));

const QUOKKAS = 2;
const SONAR_PER_GAME = 2;

// ── Timings (ms) ─────────────────────────────────────────────────────────────
const T_PLACE = 90000; // anyone not ready by then gets a random fleet
const T_TURN = 30000; // sit on your shot this long and you lose it
// The CPU skipper "thinks". Longer than the client's 1.4s board-swap hold, so
// you actually see its shot land on the big board, not just the mini one.
const T_BOT = 2200;
const CPU_SLOPPY = 0.2; // share of the CPU's search shots that are a random punt

// Shot grid codes, one char per cell (row-major, index = y * SIZE + x).
const UNSHOT = '.';
const MISS = 'o';
const HIT = 'x';
const BONK = 'q'; // you fired on a quokka

const FEED_MAX = 8;

// ── Rules module ─────────────────────────────────────────────────────────────
export default {
  slug: 'rotto-sub-hunt',
  title: 'Rotto Sub Hunt',
  seats: 2,

  init() {
    return {
      phase: 'lobby',
      mode: null, // 'pvp' | 'solo'
      bot: null, // seat number the CPU plays, solo only
      game: 0, // how many games this room has started
      wins: { 0: 0, 1: 0 },
      deadline: null,
      boards: null,
      ready: { 0: false, 1: false },
      turn: null,
      skip: { 0: 0, 1: 0 }, // turns owed to the ranger
      sonar: { 0: SONAR_PER_GAME, 1: SONAR_PER_GAME },
      stats: freshStats(),
      feed: [],
      n: 0, // event counter, so clients can animate each event exactly once
      winner: null,
      conceded: false,
    };
  },

  nextTickAt(state) {
    return state.deadline ?? null;
  },

  start(state, ctx) {
    if (state.phase !== 'lobby') return null;
    if (!isHost(ctx) || !ctx.players.length) return null;
    return beginPlacing(structuredClone(state), ctx);
  },

  rematch(state, ctx) {
    if (state.phase !== 'over') return null;
    if (!ctx.players.length) return null;
    // The host can always call it. So can the human who was playing the CPU,
    // even if someone in the CPU's seat has since become host by seat order.
    const soloHuman = state.bot !== null && ctx.seat === 1 - state.bot;
    if (!isHost(ctx) && !soloHuman) return null;
    return beginPlacing(structuredClone(state), ctx);
  },

  action(state, ctx) {
    const msg = ctx.msg || {};
    // The CPU's seat is not a human's to play, even if someone claims it mid-game.
    if (state.bot !== null && ctx.seat === state.bot) return null;
    if (ctx.seat !== 0 && ctx.seat !== 1) return null;

    let next = null;
    if (msg.t === 'ready') next = ready(state, ctx, msg);
    else if (msg.t === 'unready') next = unready(state, ctx);
    else if (msg.t === 'fire') next = fire(state, ctx, msg);
    else if (msg.t === 'sonar') next = sonar(state, ctx, msg);
    else if (msg.t === 'concede') next = concede(state, ctx);

    // A message can land after the clock ran out but before the alarm got to
    // it. The move itself still counts (that's network latency, not a stall),
    // but if the clock is STILL overdue afterwards, settle it here — otherwise
    // the room could be left with a past deadline and no alarm to act on it
    // (a "ready" on the placement buzzer froze rooms exactly like that).
    const cur = next ?? state;
    if (cur.deadline && ctx.now >= cur.deadline) return this.tick(cur, ctx) ?? next;
    return next;
  },

  tick(state, ctx) {
    if (!state.deadline || ctx.now < state.deadline - 250) return null;
    const s = structuredClone(state);

    if (s.phase === 'placing') {
      // Out of time: anyone still fiddling gets a random fleet, and we sail.
      for (const seat of [0, 1]) {
        if (!s.ready[seat]) {
          s.boards[seat].ships = randomFleet();
          s.ready[seat] = true;
        }
      }
      return beginBattle(s, ctx);
    }

    if (s.phase === 'battle') {
      if (s.turn === s.bot) return botMove(s, ctx);
      // A human sat on their shot. It's gone.
      pushFeed(s, { by: s.turn, kind: 'timeout' });
      return passTurn(s, s.turn, ctx);
    }

    return null;
  },

  view(state, { seat, now }) {
    const base = {
      phase: state.phase,
      mode: state.mode,
      size: SIZE,
      fleet: FLEET,
      sonarMax: SONAR_PER_GAME,
      game: state.game,
      wins: state.wins,
      n: state.n,
      msLeft: state.deadline ? Math.max(0, state.deadline - now) : null,
      bot: state.bot,
    };

    // In the lobby there is nothing secret yet.
    if (state.phase === 'lobby' || !state.boards) return base;

    // Somebody who wandered into the CPU's seat mid-solo-game watches nothing:
    // that seat's view would be the CPU's own fleet.
    if (state.bot !== null && seat === state.bot) return { ...base, spectator: true };
    if (seat !== 0 && seat !== 1) return { ...base, spectator: true };

    const me = seat;
    const them = 1 - seat;
    const mine = state.boards[me];
    const theirs = state.boards[them];
    const over = state.phase === 'over';

    return {
      ...base,
      you: me,
      turn: state.turn,
      myTurn: state.phase === 'battle' && state.turn === me,
      ready: { me: state.ready[me], them: state.ready[them] },
      sonarLeft: state.sonar[me],
      sonarThem: state.sonar[them],
      skipMe: state.skip[me] > 0,
      skipThem: state.skip[them] > 0,
      winner: state.winner,
      conceded: state.conceded,
      stats: state.stats,
      feed: state.feed,

      // Everything about my own waters is mine to see.
      mine: {
        ships: mine.ships.map((sh) => withSunk(sh, mine.shots)),
        shots: mine.shots,
        quokkas: mine.quokkas,
        pings: mine.pings,
      },

      // Their waters: only what my own shots have earned. A ship's position is
      // in the payload once it is SUNK — never from a single hit — and the
      // quokkas only surface when the game is over.
      theirs: {
        ships: theirs.ships
          .map((sh) => withSunk(sh, theirs.shots))
          .filter((sh) => sh.sunk || over),
        shots: theirs.shots,
        pings: theirs.pings,
        quokkas: over ? theirs.quokkas : null,
        afloat: theirs.ships.filter((sh) => !isSunk(sh, theirs.shots)).map((sh) => sh.id),
      },
    };
  },
};

// ── Phases ───────────────────────────────────────────────────────────────────

function beginPlacing(s, ctx) {
  const solo = ctx.players.length < 2;
  // Alone: the CPU takes whichever seat is NOT the human in front of us.
  const bot = solo ? 1 - ctx.players[0] : null;

  // The tally belongs to a matchup. If the CPU joins, leaves or swaps seats,
  // a seat's wins would otherwise pass to whoever sits there next.
  if (s.game > 0 && (s.mode !== (solo ? 'solo' : 'pvp') || s.bot !== bot)) {
    s.wins = { 0: 0, 1: 0 };
  }

  s.phase = 'placing';
  s.mode = solo ? 'solo' : 'pvp';
  s.bot = bot;
  s.game += 1;
  s.deadline = ctx.now + T_PLACE;
  s.boards = { 0: emptyBoard(), 1: emptyBoard() };
  s.ready = { 0: false, 1: false };
  s.turn = null;
  s.skip = { 0: 0, 1: 0 };
  s.sonar = { 0: SONAR_PER_GAME, 1: SONAR_PER_GAME };
  s.stats = freshStats();
  s.feed = [];
  s.winner = null;
  s.conceded = false;
  s.n += 1;

  if (bot !== null) {
    s.boards[bot].ships = randomFleet();
    s.ready[bot] = true;
  }
  return s;
}

function beginBattle(s, ctx) {
  for (const seat of [0, 1]) {
    const b = s.boards[seat];
    b.quokkas = [];
    for (let i = 0; i < QUOKKAS; i++) {
      const spot = randomOpenCell(b);
      if (spot) b.quokkas.push(spot);
    }
  }
  s.phase = 'battle';
  s.turn = Math.random() < 0.5 ? 0 : 1;
  pushFeed(s, { by: s.turn, kind: 'first' });
  s.deadline = ctx.now + turnLength(s);
  return s;
}

function finish(s, winner) {
  s.phase = 'over';
  s.winner = winner;
  s.deadline = null;
  s.turn = null;
  s.wins[winner] = (s.wins[winner] || 0) + 1;
  return s;
}

// After `from` has used their turn, hand it over — unless the other side owes
// a turn for bonking a quokka, in which case `from` goes again. Fines owed by
// both sides cancel out first, so a bonk never earns an immediate re-shot.
function passTurn(s, from, ctx) {
  const both = Math.min(s.skip[0], s.skip[1]);
  if (both > 0) {
    s.skip[0] -= both;
    s.skip[1] -= both;
  }
  let next = 1 - from;
  if (s.skip[next] > 0) {
    s.skip[next] -= 1;
    pushFeed(s, { by: next, kind: 'fined' });
    next = from;
  }
  s.turn = next;
  s.deadline = ctx.now + turnLength(s);
  return s;
}

function turnLength(s) {
  return s.turn === s.bot ? T_BOT : T_TURN;
}

// ── Actions ──────────────────────────────────────────────────────────────────

function ready(state, ctx, msg) {
  if (state.phase !== 'placing') return null;
  if (state.ready[ctx.seat]) return null;
  const ships = validFleet(msg.fleet);
  if (!ships) return null;

  const s = structuredClone(state);
  s.boards[ctx.seat].ships = ships;
  s.ready[ctx.seat] = true;
  s.n += 1;
  if (s.ready[0] && s.ready[1]) return beginBattle(s, ctx);
  return s;
}

// Changed your mind before they finished? Pull your fleet back to the dock.
function unready(state, ctx) {
  if (state.phase !== 'placing') return null;
  if (!state.ready[ctx.seat]) return null;
  const s = structuredClone(state);
  s.ready[ctx.seat] = false;
  s.boards[ctx.seat].ships = [];
  s.n += 1;
  return s;
}

function fire(state, ctx, msg) {
  const at = cellOf(msg);
  if (!at || !canAct(state, ctx)) return null;
  const target = state.boards[1 - ctx.seat];
  if (target.shots[at.i] !== UNSHOT) return null;

  const s = structuredClone(state);
  return resolveShot(s, ctx.seat, at, ctx);
}

function sonar(state, ctx, msg) {
  const at = cellOf(msg);
  if (!at || !canAct(state, ctx)) return null;
  if (state.sonar[ctx.seat] <= 0) return null;

  const s = structuredClone(state);
  const b = s.boards[1 - ctx.seat];
  let ships = 0;
  let quokkas = 0;
  for (const [x, y] of around(at.x, at.y)) {
    const i = y * SIZE + x;
    if (shipAt(b, x, y) && b.shots[i] !== HIT) ships++;
    if (b.quokkas.some((q) => q.x === x && q.y === y)) quokkas++;
  }

  s.sonar[ctx.seat] -= 1;
  s.stats[ctx.seat].sonar += 1;
  b.pings.push({ x: at.x, y: at.y, ships, quokkas, n: s.n + 1 });
  pushFeed(s, { by: ctx.seat, kind: 'sonar', x: at.x, y: at.y, ships, quokkas });
  swimQuokkas(b);
  return passTurn(s, ctx.seat, ctx);
}

function concede(state, ctx) {
  if (state.phase !== 'battle') return null;
  const s = structuredClone(state);
  s.conceded = true;
  pushFeed(s, { by: ctx.seat, kind: 'concede' });
  return finish(s, 1 - ctx.seat);
}

function canAct(state, ctx) {
  return state.phase === 'battle' && state.turn === ctx.seat;
}

// Shared by humans and the CPU. `s` is already a clone.
function resolveShot(s, by, at, ctx) {
  const b = s.boards[1 - by];
  const st = s.stats[by];
  st.shots += 1;

  const quokka = b.quokkas.findIndex((q) => q.x === at.x && q.y === at.y);
  if (quokka !== -1) {
    // Bonk. The quokka is fine (indignant, but fine) and swims off somewhere
    // else; the shooter owes a turn.
    b.shots = setCell(b.shots, at.i, BONK);
    b.quokkas.splice(quokka, 1);
    const spot = randomOpenCell(b);
    if (spot) b.quokkas.push(spot);
    s.skip[by] += 1;
    st.quokkas += 1;
    pushFeed(s, { by, kind: 'shot', x: at.x, y: at.y, result: 'quokka' });
    swimQuokkas(b);
    return passTurn(s, by, ctx);
  }

  const ship = shipAt(b, at.x, at.y);
  if (!ship) {
    b.shots = setCell(b.shots, at.i, MISS);
    pushFeed(s, { by, kind: 'shot', x: at.x, y: at.y, result: 'miss' });
    swimQuokkas(b);
    return passTurn(s, by, ctx);
  }

  b.shots = setCell(b.shots, at.i, HIT);
  st.hits += 1;
  const sunk = isSunk(ship, b.shots);
  pushFeed(s, {
    by,
    kind: 'shot',
    x: at.x,
    y: at.y,
    result: sunk ? 'sunk' : 'hit',
    // Which ship you hit is only announced when it goes down.
    ship: sunk ? ship.id : null,
  });
  swimQuokkas(b);

  if (b.ships.every((sh) => isSunk(sh, b.shots))) return finish(s, by);
  return passTurn(s, by, ctx);
}

// ── The CPU skipper ──────────────────────────────────────────────────────────
// Plays only from what a human would know: its own shot grid, which enemy
// ships have been announced sunk, and its own sonar returns. Never peeks at
// ship positions or quokkas.
function botMove(s, ctx) {
  const by = s.bot;
  const b = s.boards[1 - by];
  const shots = b.shots;
  const sunkCells = new Set();
  for (const sh of b.ships) {
    if (isSunk(sh, shots)) for (const c of shipCells(sh)) sunkCells.add(c.y * SIZE + c.x);
  }
  const open = (x, y) => inBounds(x, y) && shots[y * SIZE + x] === UNSHOT;

  // TARGET: hits that don't belong to a sunk ship are a wounded ship. Score
  // every way an afloat ship could lie THROUGH those hits (over open water or
  // other wounded cells), weighting placements that explain more hits, and
  // fire at the open cell most of them share. Handles two ships hit side by
  // side, which a simple "extend the line" rule gets wrong.
  const wounded = new Set();
  for (let i = 0; i < CELLS; i++) if (shots[i] === HIT && !sunkCells.has(i)) wounded.add(i);

  let pick = null;
  if (wounded.size) {
    const heat = new Array(CELLS).fill(0);
    for (const def of FLEET) {
      const sh = b.ships.find((x) => x.id === def.id);
      if (sh && isSunk(sh, shots)) continue; // sunk ships are public knowledge
      for (const dir of ['h', 'v']) {
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const cells = shipCells({ x, y, dir, len: def.len });
            let covers = 0;
            let fits = true;
            for (const cc of cells) {
              if (!inBounds(cc.x, cc.y)) { fits = false; break; }
              const i = cc.y * SIZE + cc.x;
              if (wounded.has(i)) covers++;
              else if (shots[i] !== UNSHOT) { fits = false; break; }
            }
            if (!fits || !covers) continue;
            const w = 4 ** covers;
            for (const cc of cells) if (open(cc.x, cc.y)) heat[cc.y * SIZE + cc.x] += w;
          }
        }
      }
    }
    // Equally likely squares: prefer one touching the damage, which is what
    // anyone watching expects the next shot to be.
    for (const i of wounded) {
      const wx = i % SIZE;
      const wy = Math.floor(i / SIZE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (wy + dy) * SIZE + wx + dx;
        if (open(wx + dx, wy + dy) && heat[j] > 0) heat[j] += 0.5;
      }
    }
    let best = 0;
    const top = [];
    for (let i = 0; i < CELLS; i++) {
      if (heat[i] > best) { best = heat[i]; top.length = 0; top.push(i); }
      else if (heat[i] === best && best > 0) top.push(i);
    }
    if (top.length) {
      const i = top[Math.floor(Math.random() * top.length)];
      pick = { x: i % SIZE, y: Math.floor(i / SIZE) };
    }
  }

  // SONAR: when hunting blind, spend a ping on the open cell whose 3×3 has the
  // most unknown water, then use what came back.
  if (!pick && s.sonar[by] > 0 && Math.random() < 0.3) {
    let best = null;
    let bestScore = -1;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        if (!open(x, y)) continue;
        if (b.pings.some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1)) continue;
        const score = around(x, y).filter(([ax, ay]) => open(ax, ay)).length + Math.random();
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    if (best) {
      const pinged = sonar(s, { ...ctx, seat: by }, { x: best.x, y: best.y });
      if (pinged) return pinged;
    }
  }

  // HUNT: probability density. For every ship still afloat (public knowledge),
  // count each way it could lie across water not yet ruled out; fire where
  // the most of those placements overlap. A ping that heard nothing rules its
  // whole 3×3 out for good — ships don't move — and one that heard something
  // makes placements through it likelier.
  if (!pick) {
    const ruledOut = new Set();
    for (const p of b.pings) {
      if (p.ships === 0) for (const [ax, ay] of around(p.x, p.y)) ruledOut.add(ay * SIZE + ax);
    }
    const heat = new Array(CELLS).fill(0);
    for (const sh of b.ships) {
      if (isSunk(sh, shots)) continue;
      for (const dir of ['h', 'v']) {
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const cells = shipCells({ x, y, dir, len: sh.len });
            if (!cells.every((cc) => open(cc.x, cc.y) && !ruledOut.has(cc.y * SIZE + cc.x))) continue;
            let w = 1;
            for (const p of b.pings) {
              if (p.ships > 0 && cells.some((cc) => Math.abs(cc.x - p.x) <= 1 && Math.abs(cc.y - p.y) <= 1)) w += p.ships;
            }
            for (const cc of cells) heat[cc.y * SIZE + cc.x] += w;
          }
        }
      }
    }
    let best = -1;
    let ties = [];
    for (let i = 0; i < CELLS; i++) {
      if (shots[i] !== UNSHOT) continue;
      const h = heat[i] + Math.random() * 0.5; // jitter so it isn't predictable
      if (h > best + 1e-9) {
        best = h;
        ties = [i];
      } else if (Math.abs(h - best) < 1e-9) ties.push(i);
    }
    // The skipper has had a few too: one search shot in five is a punt on any
    // open square, so a decent human can beat it.
    if (Math.random() < CPU_SLOPPY) {
      ties = [];
      for (let i = 0; i < CELLS; i++) if (shots[i] === UNSHOT) ties.push(i);
    }
    if (ties.length) {
      const i = ties[Math.floor(Math.random() * ties.length)];
      pick = { x: i % SIZE, y: Math.floor(i / SIZE) };
    }
  }

  if (!pick) return passTurn(s, by, ctx); // the board is full — cannot happen
  return resolveShot(s, by, { x: pick.x, y: pick.y, i: pick.y * SIZE + pick.x }, ctx);
}

// ── Quokkas ──────────────────────────────────────────────────────────────────

// Every quokka on this board drifts one square (or stays put) onto open water:
// no ship, not already shot, not another quokka.
function swimQuokkas(b) {
  for (const q of b.quokkas) {
    const options = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: q.x + dx, y: q.y + dy }))
      .filter(
        (c) =>
          (c.x === q.x && c.y === q.y) ||
          (isOpenWater(b, c.x, c.y) && !b.quokkas.some((o) => o.x === c.x && o.y === c.y)),
      );
    const to = options[Math.floor(Math.random() * options.length)];
    q.x = to.x;
    q.y = to.y;
  }
}

function isOpenWater(b, x, y) {
  return inBounds(x, y) && b.shots[y * SIZE + x] === UNSHOT && !shipAt(b, x, y);
}

function randomOpenCell(b) {
  const free = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isOpenWater(b, x, y) && !b.quokkas.some((q) => q.x === x && q.y === y)) free.push({ x, y });
    }
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

// ── Fleet ────────────────────────────────────────────────────────────────────

// Validate a client-submitted fleet. The server owns this completely: exactly
// one of each ship, in bounds, no overlaps. Returns clean ship records or null.
function validFleet(raw) {
  if (!Array.isArray(raw) || raw.length !== FLEET.length) return null;
  const taken = new Set();
  const out = [];
  const seen = new Set();
  for (const r of raw) {
    if (!r || typeof r !== 'object') return null;
    // Own string keys only: `__proto__`, `constructor` or an array that
    // stringifies to a real id must never resolve to a ship definition.
    if (typeof r.id !== 'string' || !Object.hasOwn(FLEET_BY_ID, r.id)) return null;
    const def = FLEET_BY_ID[r.id];
    if (seen.has(def.id)) return null;
    seen.add(def.id);
    const x = r.x;
    const y = r.y;
    const dir = r.dir;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    if (dir !== 'h' && dir !== 'v') return null;
    const ship = { id: def.id, len: def.len, x, y, dir };
    for (const c of shipCells(ship)) {
      if (!inBounds(c.x, c.y)) return null;
      const k = c.y * SIZE + c.x;
      if (taken.has(k)) return null;
      taken.add(k);
    }
    out.push(ship);
  }
  // Exactly one of each — belt and braces on top of the length + dedupe checks.
  if (FLEET.some((f) => !seen.has(f.id))) return null;
  return out;
}

export function randomFleet() {
  for (;;) {
    const taken = new Set();
    const out = [];
    let ok = true;
    for (const def of FLEET) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const dir = Math.random() < 0.5 ? 'h' : 'v';
        const x = Math.floor(Math.random() * (dir === 'h' ? SIZE - def.len + 1 : SIZE));
        const y = Math.floor(Math.random() * (dir === 'v' ? SIZE - def.len + 1 : SIZE));
        const ship = { id: def.id, len: def.len, x, y, dir };
        const cells = shipCells(ship).map((c) => c.y * SIZE + c.x);
        if (cells.some((k) => taken.has(k))) continue;
        cells.forEach((k) => taken.add(k));
        out.push(ship);
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return out;
  }
}

function shipCells(ship) {
  return Array.from({ length: ship.len }, (_, k) => ({
    x: ship.x + (ship.dir === 'h' ? k : 0),
    y: ship.y + (ship.dir === 'v' ? k : 0),
  }));
}

function shipAt(b, x, y) {
  return b.ships.find((sh) => shipCells(sh).some((c) => c.x === x && c.y === y)) || null;
}

function isSunk(ship, shots) {
  return shipCells(ship).every((c) => shots[c.y * SIZE + c.x] === HIT);
}

function withSunk(ship, shots) {
  return { ...ship, sunk: isSunk(ship, shots) };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function emptyBoard() {
  return { ships: [], shots: UNSHOT.repeat(CELLS), quokkas: [], pings: [] };
}

function freshStats() {
  const one = () => ({ shots: 0, hits: 0, quokkas: 0, sonar: 0 });
  return { 0: one(), 1: one() };
}

function pushFeed(s, ev) {
  s.n += 1;
  s.feed = [...s.feed, { ...ev, n: s.n }].slice(-FEED_MAX);
}

function cellOf(msg) {
  const x = msg?.x;
  const y = msg?.y;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x, y)) return null;
  return { x, y, i: y * SIZE + x };
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

function around(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (inBounds(x + dx, y + dy)) out.push([x + dx, y + dy]);
  }
  return out;
}

function setCell(str, i, ch) {
  return str.slice(0, i) + ch + str.slice(i + 1);
}

function isHost(ctx) {
  return ctx.players.length > 0 && ctx.players[0] === ctx.seat;
}
