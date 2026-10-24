/* ============================================================================
   FIGURE 18-8's MDP — the geometry the labs draw it with (./Mdp188.jsx); positions only
   ----------------------------------------------------------------------------
   Laid out like the figure on slides 41 and 47: s0 left, s1 middle, s2
   right; each state's actions as small diamonds around it (s0: a1 above, a2
   right, a0 below; s1: a2 right, a0 below; s2: a1 above). Every arrow's
   probability and reward comes from slide 47's lists (../rl.js T_188 and
   R_188); only the positions are this file's.
   ========================================================================== */
import { T_188, R_188 } from '../rl.js';

export const W = 720;
export const H = 330;
export const R_STATE = 23;

export const STATES = [
  { id: 0, name: 's0', x: 130, y: 170 },
  { id: 1, name: 's1', x: 390, y: 170 },
  { id: 2, name: 's2', x: 620, y: 170 },
];

// one node per possible (s, a), and the short stub from the state to it
export const ACTS = [
  { s: 0, a: 1, x: 130, y: 76, stub: [130, 147, 130, 94] },
  { s: 0, a: 2, x: 252, y: 170, stub: [153, 170, 234, 170] },
  { s: 0, a: 0, x: 130, y: 264, stub: [130, 193, 130, 246] },
  { s: 1, a: 2, x: 505, y: 170, stub: [413, 170, 487, 170] },
  { s: 1, a: 0, x: 390, y: 264, stub: [390, 193, 390, 246] },
  { s: 2, a: 1, x: 620, y: 76, stub: [620, 147, 620, 94] },
];

/* each (s, a, s') with p > 0: start, end, bend and where its label sits */
export const TRANS = [
  { s: 0, a: 1, sp: 0, from: [112, 68], to: [109, 160], bend: -26, lab: [-34, 4] },
  { s: 0, a: 2, sp: 1, from: [270, 170], to: [366, 170], bend: 0, lab: [0, -9] },
  { s: 0, a: 2, sp: 0, from: [246, 186], to: [150, 183], bend: 9, lab: [2, 20] },
  { s: 0, a: 0, sp: 0, from: [112, 272], to: [109, 181], bend: 26, lab: [-36, 4] },
  { s: 0, a: 0, sp: 1, from: [148, 272], to: [377, 192], bend: 30, lab: [-10, 24] },
  { s: 1, a: 0, sp: 1, from: [408, 272], to: [408, 185], bend: -24, lab: [30, 8] },
  { s: 1, a: 2, sp: 2, from: [523, 170], to: [596, 170], bend: 0, lab: [0, 20] },
  { s: 2, a: 1, sp: 0, from: [603, 64], to: [146, 152], bend: 62, lab: [40, 28] },
  { s: 2, a: 1, sp: 1, from: [606, 88], to: [398, 147], bend: 16, lab: [26, 18] },
  { s: 2, a: 1, sp: 2, from: [638, 72], to: [640, 160], bend: -24, lab: [30, 4] },
].map((t) => ({ ...t, p: T_188[t.s][t.a][t.sp], r: R_188[t.s][t.a][t.sp] }));

/* The same figure squeezed sideways for narrow stages: x positions (not the
   glyphs) scaled by `k`, so the labels keep a readable size on a phone. */
export function geom(compact = false, k = 0.6) {
  if (!compact) return { W, H, STATES, ACTS, TRANS };
  const sx = (x) => Math.round(18 + (x - 30) * k);
  return {
    W: Math.round(36 + (W - 60) * k),
    H,
    STATES: STATES.map((st) => ({ ...st, x: sx(st.x) })),
    ACTS: ACTS.map((n) => ({ ...n, x: sx(n.x), stub: [sx(n.stub[0]), n.stub[1], sx(n.stub[2]), n.stub[3]] })),
    TRANS: TRANS.map((t) => ({ ...t, from: [sx(t.from[0]), t.from[1]], to: [sx(t.to[0]), t.to[1]], bend: t.bend * (t.from[1] === t.to[1] || Math.abs(t.from[0] - t.to[0]) > 100 ? k : 1), lab: [t.lab[0] * k, t.lab[1]] })),
  };
}
