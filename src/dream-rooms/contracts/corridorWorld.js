/* Dream Rooms · the Dream Corridor as a world.json made at runtime (CONTRACTS.md §7).

     const world = buildCorridorWorld(rows, { at: dreamId?, now?: Date })

   Pure: rows in (the lean list from GET /api/dreams), a `kind: 'corridor'` world out.
   The viewer instantiates its pieces from public/dreams/corridor-kit.glb and draws
   every private thing (dates, titles, door states) live.

   All z values in pieces / doors / breaks are WORLD z: the entrance is z = 0 and
   deeper is more negative. spawn.at is module-local, as in any world. */

import dims from './dims.json' with { type: 'json' };
import { daysBetween, nightLabel, signDate } from './rows.js';

/** The direction: true = the newest night is nearest the entrance and older nights recede into the fog.
    Flip it (false) to walk forward in time instead. Logged in tools/dream-rooms/DECISIONS.md. */
export const NEWEST_NEAREST = true;

const C = dims.corridor;
const LEN = {
  entrance: C.entrance.length,
  plain: C.segment,
  door_l: C.segment,
  door_r: C.segment,
  door_lr: C.segment,
  break: C.break.length,
  end: C.end.length,
  end_door: C.segment,
};

/** The hallway's own look: not a dream's, so it's marked invented (it's the place between dreams). */
export const CORRIDOR_LOOK = {
  light: 'between-dreams',
  warmth: 0.55,
  fog: { color: '#6a5848', density: 0.05 },
  invented: true,
  why: 'the hallway between dreams',
};
export const CORRIDOR_SOUND = { bed: 'room-tone', reverb: 'big', invented: true, why: 'the hallway between dreams' };

export const doorIdFor = (dreamId) => `d${String(dreamId).replace(/-/g, '').toLowerCase()}`;

export function doorState(status) {
  if (status === 'rendered') return 'ajar';
  if (status === 'failed') return 'shut-dark';
  return 'shut-lit';
}

/** The sign's lines: date — number, then the title (rendered) or the first words, then "not yet". */
export function signLines(row) {
  const l1 = `${signDate(row.dreamt_on)} — ${row.night_order}`;
  if (row.status === 'rendered') return [l1, row.title || row.first_words || ''];
  if (row.status === 'failed') return [l1, row.first_words || ''];
  return [l1, row.first_words || '', 'not yet'];
}

/** A small, stable hash (for picking which signs misbehave while unseen). */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "24·XI — 2" read wrong for a moment: the day's digits swapped, or the number off by one. */
function misread(line, h) {
  const m = /^(\d+)(·\S+) — (\d+)$/.exec(line);
  if (!m) return line;
  const day = m[1].length === 2 && m[1][0] !== m[1][1] ? m[1][1] + m[1][0] : String(Number(m[1]) + 1);
  return h % 2 ? `${day}${m[2]} — ${m[3]}` : `${m[1]}${m[2]} — ${Number(m[3]) + 1}`;
}

export function buildCorridorWorld(rows, { at = null, now = new Date() } = {}) {
  const live = (rows || []).filter((r) => r && !r.deleted_at && r.dreamt_on);
  const nights = new Map();
  for (const r of live) {
    if (!nights.has(r.dreamt_on)) nights.set(r.dreamt_on, []);
    nights.get(r.dreamt_on).push(r);
  }
  const keys = [...nights.keys()].sort();
  if (NEWEST_NEAREST) keys.reverse();
  for (const k of keys) nights.get(k).sort((a, b) => (a.night_order || 0) - (b.night_order || 0));

  const pieces = [];
  const doors = [];
  const breaks = [];
  const links = [];
  const swaps = [];
  let depth = 0; // metres from the entrance, growing deeper
  const put = (piece, extra = {}) => {
    pieces.push({ piece, z: -depth, ...extra });
    const start = depth;
    depth += LEN[piece];
    return start;
  };

  put('entrance');
  if (!keys.length) {
    put('plain');
    const start = put('end_door', { door: 'dempty' });
    doors.push({ id: 'dempty', state: 'shut-lit', sign: ['nothing dreamt yet'], side: 'end', z: -(start + LEN.end_door) });
  } else {
    keys.forEach((night, i) => {
      if (i > 0) {
        const days = Math.abs(daysBetween(night, keys[i - 1]));
        const extra = Math.min(C.gap.maxPlain, Math.floor(Math.log2(Math.max(1, days))) * C.gap.perLog2Days);
        for (let k = 0; k < extra; k++) put('plain');
      }
      const b = put('break', { night });
      breaks.push({ night, z: -(b + LEN.break / 2), label: nightLabel(night, now) });
      nights.get(night).forEach((row, k) => {
        const side = k % 2 === 0 ? 'l' : 'r';
        const id = doorIdFor(row.id);
        const start = put(side === 'l' ? 'door_l' : 'door_r', { door: id, night });
        const state = doorState(row.status);
        const sign = signLines(row);
        doors.push({ id, dream: row.id, dreamt_on: row.dreamt_on, night_order: row.night_order, status: row.status, state, sign, side, z: -(start + C.doorZ) });
        if (state === 'ajar') links.push({ kind: 'enter', door: id, dream: row.id });
        const h = hash(row.id);
        if (h % 5 === 2) swaps.push({ target: `corridor/sign:${id}`, action: 'relabel', to: misread(sign[0], h), when: 'unseen', revert: 18, invented: true, why: 'the hallway shifts while unseen' });
      });
    });
    put('plain');
    put('plain');
    put('end');
  }

  const D = depth;
  const W = C.break.width;
  const module = {
    id: 'corridor',
    kit: 'dream-corridor',
    origin: [-W / 2, 0, -D],
    size: [W, C.height, D],
    invented: true,
    why: 'the hallway between dreams',
  };

  // spawn: just inside the entrance facing deeper, or at a door facing it
  let spawn = { module: 'corridor', at: [W / 2, 0, D - 1.6], facing: 'n' };
  const atDoor = at ? doors.find((d) => d.dream === at) : null;
  if (atDoor) spawn = { module: 'corridor', at: [W / 2, 0, D + atDoor.z], facing: atDoor.side === 'l' ? 'w' : 'e' };

  return {
    version: 1,
    kind: 'corridor',
    look: { ...CORRIDOR_LOOK, fog: { ...CORRIDOR_LOOK.fog } },
    sound: { ...CORRIDOR_SOUND },
    modules: [module],
    links,
    swaps,
    route: ['corridor'],
    spawn,
    pieces,
    doors,
    breaks,
  };
}
