/* Every URL Memory Rooms links to, in one place, so the feature can move to
   another site (the usa-trip app) by changing BASE. */

export const BASE = '/memories';

export const paths = {
  home: () => BASE,
  capture: () => `${BASE}/new`,
  spot: (id) => `${BASE}/${encodeURIComponent(id)}`,
  edit: (id) => `${BASE}/${encodeURIComponent(id)}/edit`,
  walk: (id) => `${BASE}/${encodeURIComponent(id)}/walk`,
  group: (group) => `${BASE}/group/${encodeURIComponent(group)}`,
  // whole places (CONTRACTS.md 6.4): the place page, its sketch plan, capturing one, a room of one
  place: (id) => `${BASE}/b/${encodeURIComponent(id)}`,
  placePlan: (id) => `${BASE}/b/${encodeURIComponent(id)}/plan`,
  capturePlace: () => `${BASE}/new/place`,
  captureRoom: (buildingId, roomId, name, of) => {
    const q = new URLSearchParams({ building: buildingId, room: roomId });
    if (name) q.set('name', name);
    if (of) q.set('of', of);
    return `${BASE}/new?${q}`;
  },
};
