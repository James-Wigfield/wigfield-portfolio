/* Dream Rooms URLs, in one place. The routes themselves are in src/App.jsx:
     /dreams        the Dream Corridor (?list=1 the plain list)
     /dreams/new    capture (phone first)
     /dreams/:id    one dream

   Query flags (CONTRACTS.md §8):
     corridor  ?at=<id> start at that door · ?enter=1 (with at) walk straight through it
               ?autopilot=1 play the entered dream on autopilot · ?list=1 the plain list
               ?walk=1 the corridor even with reduced motion (the list's "walk the corridor anyway")
     dream     ?autopilot=1 no Enter tap, follow the route to the wake · ?still=1 stills and words only
               ?draft=1 the draft build (files.draft) */

export const BASE = '/dreams';
export const NEW_PATH = `${BASE}/new`;
export const MANIFEST_URL = `${BASE}/manifest.webmanifest`;
export const TOUCH_ICON_URL = `${BASE}/apple-touch-icon.png`;

function withQuery(path, params) {
  const q = new URLSearchParams();
  for (const [k, v] of params) if (v) q.set(k, v === true ? '1' : String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** /dreams with its flags: { list, walk, at, enter, autopilot }. */
export const corridorUrl = ({ list, walk, at, enter, autopilot } = {}) =>
  withQuery(BASE, [['list', list], ['walk', walk], ['at', at], ['enter', Boolean(enter && at)], ['autopilot', autopilot]]);

export const listUrl = () => corridorUrl({ list: true });

/** The list's "Walk": the corridor at that door, and straight through it. */
export const walkUrl = (id) => corridorUrl({ at: id, enter: true });

/** /dreams/:id with its flags: { autopilot, still, draft }. */
export const dreamUrl = (id, { autopilot, still, draft } = {}) =>
  withQuery(`${BASE}/${encodeURIComponent(id)}`, [['autopilot', autopilot], ['still', still], ['draft', draft]]);

const on = (params, k) => params.get(k) === '1';

/** Every flag read from a URLSearchParams. */
export function readFlags(params) {
  return {
    list: on(params, 'list'),
    walk: on(params, 'walk'),
    at: params.get('at') || null,
    enter: on(params, 'enter'),
    autopilot: on(params, 'autopilot'),
    still: on(params, 'still'),
    draft: on(params, 'draft'),
  };
}
