/* ============================================================================
   ARCADE — check for /arcade/rotto-sub-hunt
   ----------------------------------------------------------------------------
   Two passes, same approach as tools/arcade-check.mjs:

   1. RULES, in-process. The rules module is a pure reducer, so every rule and
      every server-authority guarantee is driven directly — including hundreds
      of full simulated games (PvP and vs the CPU) with the state JSON-round-
      tripped between every step, exactly as the Durable Object stores it.

   2. BROWSER, two isolated contexts against a running Worker: create/join,
      placement, firing, the hidden-information boundary as it actually arrives
      over the socket, reconnect-to-same-seat, a full game to the end, rematch.

     npx wrangler dev --port 8788 --local     # in one terminal
     node tools/sub-hunt-check.mjs            # in another

   SUBHUNT_RULES_ONLY=1  skip the browser pass
   ARCADE_BASE=<origin>  run the browser pass against a deployed Worker
   ARCADE_SHOTS=<dir>    write screenshots somewhere
   ARCADE_BROWSER=<exe>  Chrome/Edge executable (defaults per platform)
   ========================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import rules, { randomFleet } from '../workers/arcade/games/rotto-sub-hunt.js';

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Rules pass ───────────────────────────────────────────────────────────────
const SIZE = 8;
const rt = (s) => JSON.parse(JSON.stringify(s)); // what the DO's SQLite does to state
let NOW = 1_000_000;
const c = (extra = {}) => ({ seat: 0, now: NOW, players: [0, 1], seats: [], msg: null, ...extra });
const act = (s, seat, msg, players = [0, 1]) => {
  const n = rules.action(rt(s), c({ seat, msg, players }));
  return n ? rt(n) : null;
};
const view = (s, seat) => rules.view(rt(s), { seat, players: [0, 1], seats: [], now: NOW });
const cellsOf = (sh) =>
  Array.from({ length: sh.len }, (_, k) => [sh.x + (sh.dir === 'h' ? k : 0), sh.y + (sh.dir === 'v' ? k : 0)]);
const LAYOUT = [
  { id: 'sub', x: 0, y: 0, dir: 'h' },
  { id: 'ferry', x: 0, y: 2, dir: 'h' },
  { id: 'patrol', x: 0, y: 4, dir: 'h' },
  { id: 'tinny', x: 0, y: 6, dir: 'h' },
];

function invariants(s, label) {
  if (!s.boards) return;
  for (const seat of [0, 1]) {
    const b = s.boards[seat];
    const shipCells = new Set(b.ships.flatMap((sh) => cellsOf(sh).map(([x, y]) => y * SIZE + x)));
    for (const q of b.quokkas) {
      const i = q.y * SIZE + q.x;
      if (shipCells.has(i) || b.shots[i] !== '.' || q.x < 0 || q.y < 0 || q.x >= SIZE || q.y >= SIZE) {
        throw new Error(`${label}: quokka on illegal cell ${q.x},${q.y} (board ${seat})`);
      }
    }
    if (new Set(b.quokkas.map((q) => `${q.x},${q.y}`)).size !== b.quokkas.length) {
      throw new Error(`${label}: two quokkas share a cell`);
    }
    if (b.shots.length !== SIZE * SIZE) throw new Error(`${label}: shot grid corrupted`);
  }
}

// Fire until somebody wins. Humans pick random open cells; the CPU (if any)
// moves on tick. Returns the final state.
function playOut(s, { players = [0, 1], sonarEvery = 0, maxSteps = 600 } = {}) {
  for (let step = 0; step < maxSteps && s.phase === 'battle'; step++) {
    NOW += 500;
    invariants(s, `step ${step}`);
    if (s.turn === s.bot) {
      NOW = s.deadline;
      s = rt(rules.tick(rt(s), c({ players })));
      continue;
    }
    const target = s.boards[1 - s.turn];
    const open = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (target.shots[i] === '.') open.push(i);
    const i = open[Math.floor(Math.random() * open.length)];
    const useSonar = sonarEvery && step % sonarEvery === 0 && s.sonar[s.turn] > 0;
    const next = act(s, s.turn, { t: useSonar ? 'sonar' : 'fire', x: i % SIZE, y: Math.floor(i / SIZE) }, players);
    if (!next) throw new Error(`legal ${useSonar ? 'sonar' : 'shot'} rejected at step ${step}`);
    s = next;
  }
  return s;
}

console.log('--- rules (in-process) ---');
{
  let s = rt(rules.init());
  ok(s.phase === 'lobby', 'starts in the lobby');
  ok(rules.start(rt(s), c({ seat: 1 })) === null, 'non-host CANNOT start');
  s = rt(rules.start(rt(s), c({ seat: 0 })));
  ok(s.phase === 'placing' && s.mode === 'pvp' && s.bot === null, 'two players → PvP placement', s.mode);
  ok(s.deadline === NOW + 90000, 'placement has a 90s clock');

  // ── fleet validation is server-side ───────────────────────────────────────
  const bad = {
    'overlapping ships': LAYOUT.map((f, i) => (i === 1 ? { ...f, y: 0 } : f)),
    'ship off the board': LAYOUT.map((f, i) => (i === 0 ? { ...f, x: 5 } : f)),
    'a ship missing': LAYOUT.slice(1),
    'a ship duplicated': [...LAYOUT.slice(0, 3), { ...LAYOUT[2], y: 7 }],
    'an extra ship': [...LAYOUT, { id: 'tinny', x: 4, y: 7, dir: 'h' }],
    'a bad direction': LAYOUT.map((f, i) => (i === 0 ? { ...f, dir: 'd' } : f)),
    'fractional coords': LAYOUT.map((f, i) => (i === 0 ? { ...f, x: 0.5 } : f)),
    'negative coords': LAYOUT.map((f, i) => (i === 3 ? { ...f, x: -1 } : f)),
    'an unknown ship': LAYOUT.map((f, i) => (i === 3 ? { ...f, id: 'yacht' } : f)),
    'a string not an array': 'sub',
    '__proto__ ids (zero-cell ghost ships)': ['__proto__', 'constructor', 'toString', 'valueOf'].map((id, i) => ({ id, x: 0, y: i * 2, dir: 'h' })),
    'one __proto__ ghost replacing the tinny': [...LAYOUT.slice(0, 3), { id: '__proto__', x: 0, y: 6, dir: 'h' }],
    'array-valued ids (four tinnies)': [0, 2, 4, 6].map((y) => ({ id: ['tinny'], x: 0, y, dir: 'h' })),
    'array-valued ids (four subs)': [0, 2, 4, 6].map((y) => ({ id: ['sub'], x: 0, y, dir: 'h' })),
    'hasOwnProperty as an id': [...LAYOUT.slice(0, 3), { id: 'hasOwnProperty', x: 0, y: 6, dir: 'h' }],
  };
  for (const [what, fleet] of Object.entries(bad)) {
    ok(act(s, 0, { t: 'ready', fleet }) === null, `rejects a fleet with ${what}`);
  }
  ok(act(s, 0, { t: 'fire', x: 0, y: 0 }) === null, 'cannot fire during placement');

  s = act(s, 0, { t: 'ready', fleet: LAYOUT });
  ok(s && s.ready[0] && !s.ready[1] && s.phase === 'placing', 'seat 0 ready, waiting on seat 1');
  ok(act(s, 0, { t: 'ready', fleet: LAYOUT }) === null, 'cannot ready twice');
  const un = act(s, 0, { t: 'unready' });
  ok(un && !un.ready[0] && un.boards[0].ships.length === 0, 'can pull the fleet back before battle');
  ok(view(s, 1).mine.ships.length === 0 && view(s, 1).theirs.ships.length === 0, "seat 1 sees nothing of seat 0's fleet during placement");

  const fleet1 = randomFleet().map(({ id, x, y, dir }) => ({ id, x, y, dir }));
  s = act(s, 1, { t: 'ready', fleet: fleet1 });
  ok(s.phase === 'battle', 'both ready → battle starts immediately');
  ok([0, 1].includes(s.turn), 'somebody has the first shot', String(s.turn));
  ok(s.boards[0].quokkas.length === 2 && s.boards[1].quokkas.length === 2, 'two quokkas per side');
  invariants(s, 'battle start');

  // ── hidden information ────────────────────────────────────────────────────
  const v0 = view(s, 0);
  ok(v0.theirs.ships.length === 0, 'no enemy ship positions in the payload at battle start');
  ok(v0.theirs.quokkas === null, 'enemy quokkas are NOT in the payload');
  ok(v0.mine.quokkas.length === 2, 'your own quokkas are visible to you');
  ok(!JSON.stringify(v0.theirs).includes('"dir"'), 'no ship geometry leaks via theirs');
  ok(v0.theirs.afloat.length === 4, 'enemy fleet count is public');

  // ── turn authority ────────────────────────────────────────────────────────
  const shooter = s.turn;
  const other = 1 - shooter;
  ok(act(s, other, { t: 'fire', x: 3, y: 3 }) === null, 'cannot fire out of turn');
  ok(act(s, shooter, { t: 'fire', x: 8, y: 0 }) === null, 'cannot fire off the board');
  ok(act(s, shooter, { t: 'fire', x: '1', y: 0 }) === null, 'cannot fire with string coords');

  // Make the shooter's target cell known: aim at open water with no quokka.
  const tb = s.boards[other];
  const occupied = new Set(tb.ships.flatMap((sh) => cellsOf(sh).map(([x, y]) => y * SIZE + x)));
  const quok = new Set(tb.quokkas.map((q) => q.y * SIZE + q.x));
  let water = -1;
  for (let i = 0; i < 64; i++) if (!occupied.has(i) && !quok.has(i)) { water = i; break; }
  let m = act(s, shooter, { t: 'fire', x: water % 8, y: Math.floor(water / 8) });
  ok(m && m.boards[other].shots[water] === 'o', 'a miss is recorded');
  ok(m.turn === other, 'turn passes after a miss');
  ok(m.feed.at(-1).result === 'miss', 'the feed says miss');
  ok(act(m, other, { t: 'fire', x: 9, y: 9 }) === null, 'bad coords still rejected on the other side');
  // other fires somewhere, then shooter can't re-fire the same cell
  const back = act(m, other, { t: 'fire', x: 7, y: 7 }) ?? m;
  if (back.turn === shooter) {
    ok(act(back, shooter, { t: 'fire', x: water % 8, y: Math.floor(water / 8) }) === null, 'cannot fire the same cell twice');
  }

  // ── hit and sink ──────────────────────────────────────────────────────────
  // Rig a fresh battle with seat 0 to move and known fleets on both sides.
  let r = rt(rules.start(rt(rules.init()), c()));
  r = act(r, 0, { t: 'ready', fleet: LAYOUT });
  r = act(r, 1, { t: 'ready', fleet: LAYOUT });
  r.turn = 0;
  r.boards[1].quokkas = [{ x: 7, y: 7 }, { x: 6, y: 7 }];
  r.boards[0].quokkas = [{ x: 7, y: 7 }, { x: 6, y: 7 }];
  // Quokkas swim, so pin them to the bottom-right corner each step.
  const pin = (st) => { st.boards[1].quokkas = [{ x: 7, y: 7 }, { x: 6, y: 7 }]; st.boards[0].quokkas = [{ x: 7, y: 7 }, { x: 6, y: 7 }]; return st; };

  r = pin(act(r, 0, { t: 'fire', x: 0, y: 6 })); // tinny, cell 1
  ok(r.feed.at(-1).result === 'hit', 'a hit is a hit');
  ok(r.feed.at(-1).ship === null, 'a plain hit does NOT name the ship');
  ok(view(r, 0).theirs.ships.length === 0, 'one hit does not reveal the ship');
  r = pin(act(r, 1, { t: 'fire', x: 5, y: 5 }));
  r = pin(act(r, 0, { t: 'fire', x: 1, y: 6 })); // tinny, cell 2 → sunk
  ok(r.feed.at(-1).result === 'sunk' && r.feed.at(-1).ship === 'tinny', 'sinking announces the ship', JSON.stringify(r.feed.at(-1)));
  const vs = view(r, 0);
  ok(vs.theirs.ships.length === 1 && vs.theirs.ships[0].id === 'tinny' && vs.theirs.ships[0].sunk, 'a SUNK ship is revealed to the attacker');
  ok(vs.theirs.afloat.length === 3, 'afloat count drops to 3');
  ok(view(r, 1).mine.ships.find((x) => x.id === 'tinny').sunk, 'the owner sees their ship marked sunk');

  // ── quokka: bonk → you lose your next turn ────────────────────────────────
  r = pin(act(r, 1, { t: 'fire', x: 5, y: 6 }));
  ok(r.turn === 0, 'back to seat 0');
  r.boards[1].quokkas = [{ x: 4, y: 5 }];
  r = act(r, 0, { t: 'fire', x: 4, y: 5 });
  ok(r.boards[1].shots[5 * 8 + 4] === 'q', 'firing on a quokka marks the cell');
  ok(r.feed.at(-1).result === 'quokka', 'the feed says quokka');
  ok(r.skip[0] === 1, 'the shooter owes a turn');
  ok(r.boards[1].quokkas.length === 1 && !(r.boards[1].quokkas[0].x === 4 && r.boards[1].quokkas[0].y === 5), 'the quokka swims off');
  ok(r.stats[0].quokkas === 1, 'quokka bonk counted');
  invariants(r, 'after bonk');
  ok(r.turn === 1, 'seat 1 shoots next');
  r = pin(act(r, 1, { t: 'fire', x: 4, y: 4 }));
  ok(r.turn === 1, 'seat 1 shoots AGAIN — seat 0 lost a turn');
  ok(r.skip[0] === 0, 'the fine is paid');
  ok(r.feed.some((e) => e.kind === 'fined' && e.by === 0), 'the feed says seat 0 was fined');
  r = pin(act(r, 1, { t: 'fire', x: 3, y: 4 }));
  ok(r.turn === 0, 'then normal alternation resumes');

  // ── sonar ─────────────────────────────────────────────────────────────────
  // Seat 0 pings (1,1) on seat 1's board: 3×3 covers sub cells (0..2,0) and
  // ferry cells (0..2,2) → 6 un-hit sections.
  r.boards[1].quokkas = [{ x: 2, y: 1 }];
  const before = r.sonar[0];
  r = act(r, 0, { t: 'sonar', x: 1, y: 1 });
  const ping = r.boards[1].pings.at(-1);
  ok(ping && ping.ships === 6, 'sonar counts un-hit ship sections in the 3×3', String(ping?.ships));
  ok(ping.quokkas === 1, 'sonar counts quokkas in the 3×3', String(ping?.quokkas));
  ok(r.sonar[0] === before - 1, 'sonar charge spent');
  ok(r.turn === 1, 'sonar uses your turn');
  ok(view(r, 0).theirs.pings.length === 1, 'attacker sees their ping result');
  r = pin(act(r, 1, { t: 'fire', x: 2, y: 4 }));
  r = pin(act(r, 0, { t: 'sonar', x: 4, y: 4 }));
  ok(r.sonar[0] === 0, 'second ping spends the last charge');
  r = pin(act(r, 1, { t: 'fire', x: 1, y: 4 }));
  ok(act(r, 0, { t: 'sonar', x: 6, y: 1 }) === null, 'no third ping');

  // ── timeout ───────────────────────────────────────────────────────────────
  const who = r.turn;
  ok(rules.tick(rt(r), c({ now: r.deadline - 5000 })) === null, 'tick before the deadline does nothing');
  const t = rt(rules.tick(rt(r), c({ now: r.deadline })));
  ok(t.turn === 1 - who && t.feed.at(-1).kind === 'timeout', 'sitting on your shot forfeits it');

  // ── win, wins tally, rematch ──────────────────────────────────────────────
  let w = rt(rules.start(rt(rules.init()), c()));
  w = act(w, 0, { t: 'ready', fleet: LAYOUT });
  w = act(w, 1, { t: 'ready', fleet: LAYOUT });
  w.turn = 0;
  const targets = LAYOUT.flatMap((f) => cellsOf({ ...f, len: { sub: 4, ferry: 3, patrol: 3, tinny: 2 }[f.id] }));
  for (const [x, y] of targets) {
    if (w.phase !== 'battle') break;
    w.boards[1].quokkas = [];
    w.boards[0].quokkas = [];
    w = act(w, 0, { t: 'fire', x, y });
    if (w.phase === 'battle') w = act(w, 1, { t: 'fire', x: 7 - (targets.indexOf([x, y]) % 8), y: 7 }) ?? w;
    if (w.phase === 'battle' && w.turn === 1) {
      // seat 1 might have already fired that cell; pick any open one
      const i = w.boards[0].shots.indexOf('.');
      w = act(w, 1, { t: 'fire', x: i % 8, y: Math.floor(i / 8) });
    }
  }
  ok(w.phase === 'over' && w.winner === 0, 'sinking every ship wins', `${w.phase} ${w.winner}`);
  ok(w.wins[0] === 1 && w.wins[1] === 0, 'the series tally counts it');
  ok(view(w, 1).theirs.ships.length === 4, 'the loser sees the whole enemy fleet at the end');
  ok(Array.isArray(view(w, 1).theirs.quokkas), 'and where the quokkas were');
  ok(act(w, 0, { t: 'fire', x: 7, y: 7 }) === null, 'no shots after the game');
  ok(rules.rematch(rt(w), c({ seat: 1 })) === null, 'non-host CANNOT rematch');
  const re = rt(rules.rematch(rt(w), c({ seat: 0 })));
  ok(re.phase === 'placing' && re.wins[0] === 1 && re.game === 2, 'rematch → new placement, tally kept');
  ok(re.boards[0].shots === '.'.repeat(64), 'rematch clears the boards');

  // ── concede ───────────────────────────────────────────────────────────────
  let cc = rt(rules.start(rt(rules.init()), c()));
  cc = act(cc, 0, { t: 'ready', fleet: LAYOUT });
  cc = act(cc, 1, { t: 'ready', fleet: LAYOUT });
  cc = act(cc, 1, { t: 'concede' });
  ok(cc.phase === 'over' && cc.winner === 0 && cc.conceded, 'conceding hands the win over');

  // ── placement timeout ─────────────────────────────────────────────────────
  let pt = rt(rules.start(rt(rules.init()), c()));
  pt = act(pt, 0, { t: 'ready', fleet: LAYOUT });
  pt = rt(rules.tick(rt(pt), c({ now: pt.deadline })));
  ok(pt.phase === 'battle' && pt.boards[1].ships.length === 4, 'placement clock out → random fleet for the slow one, battle on');
  ok(JSON.stringify(pt.boards[0].ships.map(({ id, x, y, dir }) => ({ id, x, y, dir }))) === JSON.stringify(LAYOUT), "the ready player's fleet is untouched");

  // ── an action on the buzzer never strands an overdue clock ────────────────
  for (const lateBy of [-1, 0, 3, 50]) {
    let bz = rt(rules.start(rt(rules.init()), c()));
    const at = bz.deadline + lateBy;
    const res = rules.action(rt(bz), c({ seat: 0, now: at, msg: { t: 'ready', fleet: LAYOUT } }));
    const fin = rt(res);
    const stranded = fin.deadline && fin.deadline <= at;
    ok(!stranded, `ready ${lateBy >= 0 ? lateBy + 'ms after' : -lateBy + 'ms before'} the placement buzzer leaves no overdue clock`, `${fin.phase} deadline-now=${fin.deadline ? fin.deadline - at : 'null'}`);
    if (lateBy >= 0) ok(fin.phase === 'battle' && JSON.stringify(fin.boards[0].ships.map(({ id, x, y, dir }) => ({ id, x, y, dir }))) === JSON.stringify(LAYOUT), `…and the late ready still counts (${lateBy}ms)`);
  }
  {
    // Any message (even a rejected one) on an overdue battle clock settles it.
    let ob = rt(rules.start(rt(rules.init()), c()));
    ob = act(ob, 0, { t: 'ready', fleet: LAYOUT });
    ob = act(ob, 1, { t: 'ready', fleet: LAYOUT });
    const waiting = 1 - ob.turn;
    const res = rt(rules.action(rt(ob), c({ seat: waiting, now: ob.deadline + 5, msg: { t: 'fire', x: 9, y: 9 } })));
    ok(res && res.turn === waiting && res.feed.at(-1).kind === 'timeout', 'a stray message on an overdue turn clock forfeits the turn instead of stranding it');
  }

  // ── fines are counted, and opposite fines cancel ──────────────────────────
  {
    let f = rt(rules.start(rt(rules.init()), c()));
    f = act(f, 0, { t: 'ready', fleet: LAYOUT });
    f = act(f, 1, { t: 'ready', fleet: LAYOUT });
    const quokkaAt = (seat, x, y) => { f.boards[seat].quokkas = [{ x, y }]; };
    const calm = () => { f.boards[0].quokkas = []; f.boards[1].quokkas = []; };
    f.turn = 1;
    quokkaAt(0, 7, 0); f = act(f, 1, { t: 'fire', x: 7, y: 0 }); calm(); // B bonks
    ok(f.turn === 0 && f.skip[1] === 1, 'B bonks → A to shoot, B owes one');
    quokkaAt(1, 7, 0); f = act(f, 0, { t: 'fire', x: 7, y: 0 }); calm(); // A bonks
    ok(f.skip[0] === 0 && f.skip[1] === 0, 'both owing → the fines cancel');
    ok(f.turn === 1, '…and a bonk never earns an immediate re-shot');
    f = act(f, 1, { t: 'fire', x: 7, y: 1 }); calm();
    quokkaAt(1, 7, 1); f = act(f, 0, { t: 'fire', x: 7, y: 1 }); calm(); // A bonks again
    ok(f.skip[0] === 1 && f.turn === 1, 'a later bonk is a full fine');
    f = act(f, 1, { t: 'fire', x: 7, y: 2 }); calm();
    ok(f.turn === 1 && f.skip[0] === 0, 'A pays it: B shoots twice in a row');
    const v = view(f, 0);
    ok(v.skipMe === false && typeof v.skipThem === 'boolean', 'the view still exposes fines as booleans');
  }

  // ── the tally belongs to the matchup ──────────────────────────────────────
  {
    let g1 = rt(rules.start(rt(rules.init()), c({ players: [0] })));
    g1 = act(g1, 0, { t: 'ready', fleet: LAYOUT }, [0]);
    g1 = act(g1, 0, { t: 'concede' }, [0]);
    ok(g1.phase === 'over' && g1.wins[1] === 1, 'losing to the CPU scores the CPU seat');
    const pvp = rt(rules.rematch(rt(g1), c({ seat: 0, players: [0, 1] })));
    ok(pvp.mode === 'pvp' && pvp.wins[0] === 0 && pvp.wins[1] === 0, "a friend taking the CPU's seat does NOT inherit its wins");
    let g2 = act(pvp, 0, { t: 'ready', fleet: LAYOUT });
    g2 = act(g2, 1, { t: 'ready', fleet: LAYOUT });
    g2 = act(g2, 1, { t: 'concede' });
    const again = rt(rules.rematch(rt(g2), c({ seat: 0, players: [0, 1] })));
    ok(again.wins[0] === 1, 'same two players → the tally carries on');
  }

  // ── the solo human can always call the rematch ────────────────────────────
  {
    let sh = rt(rules.start(rt(rules.init()), c({ seat: 1, players: [1] })));
    ok(sh.bot === 0, 'solo human in seat 1, CPU in seat 0');
    sh = act(sh, 1, { t: 'ready', fleet: LAYOUT }, [1]);
    sh = act(sh, 1, { t: 'concede' }, [1]);
    // seat 0's owner reconnects and becomes host by seat order
    const re1 = rules.rematch(rt(sh), c({ seat: 1, players: [0, 1] }));
    ok(re1 && re1.phase === 'placing', 'the solo human can rematch even when not host');
    ok(rules.rematch(rt(sh), c({ seat: 0, players: [0, 1] })) !== null, '…and the host still can too');
  }

  // ── CPU never wanders off a wounded ship ──────────────────────────────────
  {
    let wander = 0, cpuShots = 0;
    for (let g = 0; g < 200; g++) {
      let x = rt(rules.start(rt(rules.init()), c({ players: [0] })));
      x = act(x, 0, { t: 'ready', fleet: randomFleet().map(({ id, x: a, y: b, dir }) => ({ id, x: a, y: b, dir })) }, [0]);
      for (let step = 0; step < 400 && x.phase === 'battle'; step++) {
        if (x.turn === x.bot) {
          const b = x.boards[0];
          const sunk = new Set(b.ships.filter((sh) => cellsOf(sh).every(([cx, cy]) => b.shots[cy * 8 + cx] === 'x')).flatMap((sh) => cellsOf(sh).map(([cx, cy]) => cy * 8 + cx)));
          const woundedOpenNbr = [];
          for (let i = 0; i < 64; i++) {
            if (b.shots[i] !== 'x' || sunk.has(i)) continue;
            const wx = i % 8, wy = Math.floor(i / 8);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = wx + dx, ny = wy + dy;
              if (nx >= 0 && ny >= 0 && nx < 8 && ny < 8 && b.shots[ny * 8 + nx] === '.') woundedOpenNbr.push(ny * 8 + nx);
            }
          }
          const before = b.shots;
          NOW = x.deadline;
          x = rt(rules.tick(rt(x), c({ players: [0] })));
          const after = x.boards[0].shots;
          let fired = -1;
          for (let i = 0; i < 64; i++) if (before[i] !== after[i]) fired = i;
          if (fired >= 0) {
            cpuShots++;
            if (woundedOpenNbr.length && !woundedOpenNbr.includes(fired)) wander++;
          }
        } else {
          const t = x.boards[1].shots.indexOf('.');
          x = act(x, 0, { t: 'fire', x: t % 8, y: Math.floor(t / 8) }, [0]);
        }
      }
    }
    ok(wander === 0, 'the CPU always follows up a wounded ship', `${wander} wandering shots of ${cpuShots}`);
  }

  // ── solo vs the CPU ───────────────────────────────────────────────────────
  let so = rt(rules.start(rt(rules.init()), c({ players: [0] })));
  ok(so.mode === 'solo' && so.bot === 1 && so.ready[1], 'alone → CPU takes seat 1 and is ready');
  ok(act(so, 1, { t: 'ready', fleet: LAYOUT }, [0, 1]) === null, 'nobody can act for the CPU seat');
  ok(view(so, 1).spectator === true, "someone who lands in the CPU's seat is a spectator");
  ok(!('theirs' in view(so, 1)), "…and gets none of the CPU's board");
  so = act(so, 0, { t: 'ready', fleet: LAYOUT }, [0]);
  ok(so.phase === 'battle', 'solo battle starts as soon as you are ready');
  so.turn = 1;
  so.deadline = NOW + 1300;
  NOW = so.deadline;
  const bt = rt(rules.tick(rt(so), c({ players: [0] })));
  ok(bt.turn === 0 && (bt.stats[1].shots === 1 || bt.stats[1].sonar === 1), 'the CPU moves on its tick');

  // Every CPU turn must DO something — a shot or a ping, never a silent pass.
  let idle = 0, cpuPings = 0;
  for (let k = 0; k < 1500; k++) {
    let x = rt(rules.start(rt(rules.init()), c({ players: [0] })));
    x = act(x, 0, { t: 'ready', fleet: LAYOUT }, [0]);
    x.turn = 1;
    x.deadline = NOW;
    const y = rt(rules.tick(rt(x), c({ players: [0] })));
    const did = y.stats[1].shots + y.stats[1].sonar;
    if (did !== 1) idle++;
    cpuPings += y.stats[1].sonar;
  }
  ok(idle === 0, 'every CPU turn is a shot or a ping (no wasted turns)', `${idle} idle of 1500`);
  ok(cpuPings > 0, 'the CPU really uses its sonar', String(cpuPings));

  let soloLeft = rt(rules.start(rt(rules.init()), c({ seat: 1, players: [1] })));
  ok(soloLeft.bot === 0, 'alone in seat 1 → CPU takes seat 0');

  // ── soak: lots of complete games, JSON round-tripped every step ───────────
  let pvpDone = 0, soloDone = 0, botWins = 0, bonks = 0, pings = 0, maxShots = 0;
  try {
    for (let g = 0; g < 300; g++) {
      let x = rt(rules.start(rt(rules.init()), c()));
      x = act(x, 0, { t: 'ready', fleet: randomFleet().map(({ id, x: a, y: b, dir }) => ({ id, x: a, y: b, dir })) });
      x = act(x, 1, { t: 'ready', fleet: randomFleet().map(({ id, x: a, y: b, dir }) => ({ id, x: a, y: b, dir })) });
      x = playOut(x, { sonarEvery: 7 });
      if (x.phase === 'over') pvpDone++;
      bonks += x.stats[0].quokkas + x.stats[1].quokkas;
      pings += x.stats[0].sonar + x.stats[1].sonar;
    }
    for (let g = 0; g < 300; g++) {
      let x = rt(rules.start(rt(rules.init()), c({ players: [0] })));
      x = act(x, 0, { t: 'ready', fleet: randomFleet().map(({ id, x: a, y: b, dir }) => ({ id, x: a, y: b, dir })) }, [0]);
      x = playOut(x, { players: [0] });
      if (x.phase === 'over') soloDone++;
      if (x.winner === 1) botWins++;
      maxShots = Math.max(maxShots, x.stats[1].shots);
      pings += x.stats[1].sonar;
    }
  } catch (err) {
    ok(false, 'soak run threw', err.message);
  }
  ok(pvpDone === 300, '300 random PvP games all finish', String(pvpDone));
  ok(soloDone === 300, '300 games vs the CPU all finish', String(soloDone));
  ok(bonks > 0, 'quokkas actually get bonked in real play', String(bonks));
  ok(pings > 0, 'sonar gets used (incl. by the CPU)', String(pings));
  ok(botWins > 240, 'the CPU beats a random shooter most of the time', `${botWins}/300`);
  ok(maxShots <= 64, 'the CPU never needs more shots than there are cells', String(maxShots));
}

if (process.env.SUBHUNT_RULES_ONLY) {
  console.log(`\n${fails.length ? 'FAILURES: ' + fails.join(' | ') : 'ALL CHECKS PASSED'}`);
  process.exit(fails.length ? 1 : 0);
}

// ── Browser pass ─────────────────────────────────────────────────────────────
console.log('');
console.log('--- browser (two phones) ---');

const { default: puppeteer } = await import('puppeteer-core');
const BASE = process.env.ARCADE_BASE || 'http://127.0.0.1:8788';
const URL = `${BASE}/arcade/rotto-sub-hunt/`;
const BROWSERS = [
  process.env.ARCADE_BROWSER,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const executablePath = BROWSERS.find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=430,900', '--autoplay-policy=no-user-gesture-required'],
});

const errors = [];
async function newPage(tag) {
  // Isolated contexts: two people on two phones must not share localStorage.
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: 400, height: 860, deviceScaleFactor: 2 });
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${tag}] ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
  return p;
}
const st = (p) => p.evaluate(() => window.__sh?.state() ?? null);
const send = (p, m) => p.evaluate((mm) => window.__sh.room.send(mm), m);
async function waitFor(p, fn, label, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await st(p);
    if (s && fn(s)) return s;
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label} (phase ${(await st(p))?.phase})`);
}
// Tap the centre of a board cell through the real pointer path.
async function tapCell(p, board, x, y) {
  const box = await p.evaluate((b) => {
    const r = document.querySelector(`canvas[data-board="${b}"]`).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, board);
  await p.mouse.click(box.x + ((x + 0.5) * box.w) / 8, box.y + ((y + 0.5) * box.h) / 8);
}

// ── Seats: picking your own seat back up from another browser ───────────────
// Pure HTTP + raw sockets against the real Durable Object.
{
  const api = async (p, body) => {
    const r = await fetch(`${BASE}/api/arcade/rotto-sub-hunt${p}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const open = (code, token) => new Promise((res, rej) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/arcade/rotto-sub-hunt/room/${code}/ws?token=${token}`);
    ws.onopen = () => res(ws);
    ws.onerror = rej;
  });
  const ana = (await api('/create', { name: 'Ana' })).body;
  const code = ana.code;
  const bob = (await api(`/room/${code}/join`, { name: 'Bob' })).body;
  ok(ana.seat === 0 && bob.seat === 1, 'seats: Ana 0, Bob 1');
  // Both offline (no sockets). Bob comes back on a new browser — no token.
  const bob2 = await api(`/room/${code}/join`, { name: ' bob ' });
  ok(bob2.status === 200 && bob2.body.seat === 1, 'Bob (new browser, same name) gets HIS seat back, not the lowest free one', JSON.stringify(bob2.body));
  ok(bob2.body.token !== bob.token, '…with a fresh token');
  const wsBob2 = await open(code, bob2.body.token);
  await sleep(200);
  const old = await api(`/room/${code}/join`, { name: 'Bob', token: bob.token });
  ok(old.status === 409, "Bob's old browser can't take the seat while the new one is connected", String(old.status));
  wsBob2.close();
  await sleep(300);
  const old2 = await api(`/room/${code}/join`, { name: 'Bob', token: bob.token });
  ok(old2.status === 200 && old2.body.seat === 1, '…but can once the new one has gone', JSON.stringify(old2.body));
  const zed = await api(`/room/${code}/join`, { name: 'Zed' });
  ok(zed.status === 409, 'a stranger cannot take an empty chair in a full room', String(zed.status));
  const anaAgain = await api(`/room/${code}/join`, { name: 'Ana', token: ana.token });
  ok(anaAgain.body.seat === 0, 'Ana reopening her own browser lands in her own seat');
  const wsAna = await open(code, ana.token);
  await sleep(200);
  const imp = await api(`/room/${code}/join`, { name: 'Ana' });
  ok(imp.status === 409, "nobody can take Ana's seat by name while she is ONLINE", String(imp.status));
  wsAna.close();
}

const shots = process.env.ARCADE_SHOTS || os.tmpdir();
try {
  const A = await newPage('A');
  await A.goto(URL, { waitUntil: 'networkidle2' });
  await A.type('#ar-name', 'James');
  await A.click('#ar-create');
  await A.waitForFunction('!!window.__sh && window.__sh.state() !== null', { timeout: 15000 });
  const code = await A.evaluate(() => window.__sh.room.code());
  ok(/^[A-Z]{5}$/.test(code), 'room code is 5 letters', code);
  ok((await st(A)).phase === 'lobby', 'A lands in the lobby');
  await A.screenshot({ path: path.join(shots, 'sh-lobby.png') });

  const B = await newPage('B');
  await B.goto(`${URL}?c=${code}`, { waitUntil: 'networkidle2' });
  await B.type('#ar-name', 'Mate');
  await B.click('#ar-join');
  await B.waitForFunction('!!window.__sh && window.__sh.state() !== null', { timeout: 15000 });
  await sleep(500);
  ok((await B.evaluate(() => window.__sh.room.seat())) === 1, 'B took seat 1');
  ok((await A.evaluate(() => window.__sh.players())).length === 2, 'A sees both players');

  // B is not host: their start is ignored.
  await send(B, { t: 'start' });
  await sleep(400);
  ok((await st(A)).phase === 'lobby', 'non-host start ignored over the wire');

  // A starts via the real button.
  await A.click('#go');
  await waitFor(A, (s) => s.phase === 'placing', 'placing');
  await waitFor(B, (s) => s.phase === 'placing', 'placing on B');
  ok((await st(A)).mode === 'pvp', 'PvP with two phones');

  // Placement UI: a local fleet exists, shuffle changes it, ready sends it.
  const f1 = await A.evaluate(() => JSON.stringify(window.__sh.localFleet()));
  await A.click('#pl-shuffle');
  const f2 = await A.evaluate(() => JSON.stringify(window.__sh.localFleet()));
  ok(f1 !== f2, 'shuffle rearranges the fleet');
  ok(JSON.parse(f2).length === 4, 'four ships to place');

  // Select the tinny by tapping it, then move it by tapping open water.
  const tinny = JSON.parse(f2).find((s) => s.id === 'tinny');
  await tapCell(A, 'main', tinny.x, tinny.y);
  ok((await A.evaluate(() => window.__sh.selected())) === 'tinny', 'tapping a ship selects it');
  await A.click('#pl-rotate');
  const rot = await A.evaluate(() => window.__sh.localFleet().find((s) => s.id === 'tinny'));
  ok(rot.dir !== tinny.dir || rot.x !== tinny.x || rot.y !== tinny.y, 'rotate turns (or nudges) the selected ship');
  await A.screenshot({ path: path.join(shots, 'sh-placing.png') });

  await A.click('#pl-ready');
  await waitFor(A, (s) => s.ready?.me, 'A ready');
  ok((await st(B)).ready.them === true, "B is told A is ready (and nothing else)");
  ok((await st(B)).theirs.ships.length === 0, "B gets none of A's ship positions");
  await B.click('#pl-ready');
  await waitFor(A, (s) => s.phase === 'battle', 'battle');
  await waitFor(B, (s) => s.phase === 'battle', 'battle on B');

  const fleetA = (await st(A)).mine.ships;
  ok(fleetA.length === 4, "A's fleet is on the server");

  // Over the wire: no enemy positions or quokkas.
  const raw = await B.evaluate(() => JSON.stringify(window.__sh.state().theirs));
  ok(!raw.includes('"dir"'), "B's payload holds no geometry for A's ships");
  ok((await st(B)).theirs.quokkas === null, "B's payload holds no enemy quokkas");

  // Whoever is up fires through the real UI: tap a cell, then the FIRE button.
  const sa = await st(A);
  const [P, Q] = sa.turn === 0 ? [A, B] : [B, A];
  ok(!(await st(Q)).myTurn, 'only one player has the shot');
  await tapCell(Q, 'main', 0, 0);
  await sleep(300);
  ok((await st(Q)).theirs.shots[0] === '.', 'tapping out of turn does nothing');
  await tapCell(P, 'main', 3, 3);
  await sleep(150);
  ok((await P.evaluate(() => window.__sh.aim())) !== null, 'first tap aims');
  await P.click('#act-fire');
  await waitFor(P, (s) => s.theirs.shots[3 * 8 + 3] !== '.', 'shot to land');
  const landed = (await st(P)).theirs.shots[27];
  ok(['o', 'x', 'q'].includes(landed), 'the shot lands on the server', landed);
  await waitFor(Q, (s) => s.mine.shots[27] === landed, 'the other phone sees it on their own waters');
  ok(true, 'the target sees the incoming shot on their own board');
  await P.screenshot({ path: path.join(shots, 'sh-battle-P.png') });
  await Q.screenshot({ path: path.join(shots, 'sh-battle-Q.png') });

  // Reconnect: B refreshes mid-battle and keeps their seat and board.
  const bBefore = await st(B);
  await B.reload({ waitUntil: 'networkidle2' });
  await B.waitForFunction('!!window.__sh && window.__sh.state() !== null', { timeout: 20000 });
  await sleep(600);
  ok((await B.evaluate(() => window.__sh.room.seat())) === 1, 'B reconnects to the same seat');
  const bAfter = await st(B);
  ok(JSON.stringify(bAfter.mine.ships) === JSON.stringify(bBefore.mine.ships), "B's fleet survives the refresh");
  ok((await A.evaluate(() => window.__sh.players())).length === 2, 'no ghost player after refresh');

  // Play the rest out fast over the socket: each side fires its open cells in
  // order. Sonar once each, to exercise the path.
  const pvpT0 = Date.now();
  let pinged = { 0: false, 1: false };
  for (;;) {
    const s = await st(A);
    if (s.phase === 'over' || Date.now() - pvpT0 > 240000) break;
    if (s.phase !== 'battle') { await sleep(150); continue; }
    const page = s.turn === 0 ? A : B;
    const ps = await st(page);
    if (!ps.myTurn) { await sleep(120); continue; }
    if (!pinged[s.turn] && ps.sonarLeft > 0) {
      pinged[s.turn] = true;
      await send(page, { t: 'sonar', x: 4, y: 4 });
    } else {
      const i = ps.theirs.shots.indexOf('.');
      await send(page, { t: 'fire', x: i % 8, y: Math.floor(i / 8) });
    }
    const n = ps.n;
    await page.waitForFunction((nn) => window.__sh.state().n > nn, { timeout: 8000 }, n).catch(() => {});
  }
  const endA = await waitFor(A, (s) => s.phase === 'over', 'game over', 30000);
  const endB = await waitFor(B, (s) => s.phase === 'over', 'game over on B', 10000);
  ok([0, 1].includes(endA.winner), 'the game reaches a winner', String(endA.winner));
  ok(endA.wins[endA.winner] === 1, 'the series tally counts the win');
  ok(endB.theirs.ships.length === 4, 'the whole enemy fleet is revealed at the end');
  ok(await A.waitForFunction(() => document.querySelector('#over')?.hidden === false, { timeout: 5000 }).then(() => true, () => false), 'game-over screen rendered (after the final boom)');
  ok(endA.stats[0].sonar === 1 && endA.stats[1].sonar === 1, 'sonar used once each over the wire');
  await A.screenshot({ path: path.join(shots, 'sh-over-A.png') });
  await B.screenshot({ path: path.join(shots, 'sh-over-B.png') });

  // Rematch via the host's button.
  await A.click('#go');
  const re = await waitFor(A, (s) => s.phase === 'placing', 'rematch placing');
  ok(re.game === 2 && re.wins[endA.winner] === 1, 'rematch keeps the tally', `game ${re.game}`);

  // Solo in a fresh room: the CPU plays.
  const C = await newPage('C');
  await C.goto(URL, { waitUntil: 'networkidle2' });
  await C.type('#ar-name', 'Solo');
  await C.click('#ar-create');
  await C.waitForFunction('!!window.__sh && window.__sh.state() !== null', { timeout: 15000 });
  await C.click('#go');
  await waitFor(C, (s) => s.phase === 'placing' && s.mode === 'solo', 'solo placing');
  await C.click('#pl-ready');
  await waitFor(C, (s) => s.phase === 'battle', 'solo battle');
  const soloT0 = Date.now();
  for (;;) {
    const s = await st(C);
    if (s.phase === 'over' || Date.now() - soloT0 > 240000) break;
    if (!s.myTurn) { await sleep(200); continue; }
    const i = s.theirs.shots.indexOf('.');
    await send(C, { t: 'fire', x: i % 8, y: Math.floor(i / 8) });
    await C.waitForFunction((nn) => window.__sh.state().n > nn, { timeout: 8000 }, s.n).catch(() => {});
  }
  const soloEnd = await waitFor(C, (s) => s.phase === 'over', 'solo over', 15000);
  ok(soloEnd.stats[1].shots + soloEnd.stats[1].sonar > 0, 'the CPU took its turns over the real alarm tick');
  await C.screenshot({ path: path.join(shots, 'sh-solo-over.png') });
  console.log(`\nscreenshots -> ${shots}`);
} catch (err) {
  ok(false, 'RUN COMPLETED', err.message);
  console.error(err);
} finally {
  console.log('\n--- console errors ---');
  const noisy = errors.filter((e) => !/favicon|fonts\.googleapis|Failed to load resource.*404/i.test(e));
  console.log(noisy.length ? noisy.slice(0, 15).join('\n') : '(none)');
  ok(noisy.length === 0, 'no console errors in any browser');
  console.log(`\n${fails.length ? 'FAILURES: ' + fails.join(' | ') : 'ALL CHECKS PASSED'}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
}
