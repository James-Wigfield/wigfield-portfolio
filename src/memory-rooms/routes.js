/* Every URL Memory Rooms links to, in one place, so the feature can move to
   another site (the usa-trip app) by changing BASE. */

export const BASE = '/memories';

export const paths = {
  home: () => BASE,
  capture: () => `${BASE}/new`,
  spot: (id) => `${BASE}/${encodeURIComponent(id)}`,
  group: (group) => `${BASE}/group/${encodeURIComponent(group)}`,
};
