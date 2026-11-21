/* Geometry + data for the /skippers art (kept out of the .jsx files so they
   export components only). Angles are degrees, 0 = the bow / up the screen,
   increasing clockwise. Workbook p.31: sidelights 112.5° each side of the
   centre line, masthead 225° forward, stern light 135° aft. */

export const ARC = { side: 112.5, mast: 225, stern: 135 };

export const rad = (d) => (d * Math.PI) / 180;
export const norm180 = (a) => {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return x;
};

// unit vector for an angle (0 = up, clockwise), screen coords (y down)
export const dir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];

// SVG wedge from angle a0 to a1 (clockwise), radius r, centred at 0,0
export function wedge(r, a0, a1) {
  const [x0, y0] = dir(a0).map((v) => v * r);
  const [x1, y1] = dir(a1).map((v) => v * r);
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
  return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/* Which navigation lights a vessel shows, in its own frame:
   x = starboard (+), y = aft (+), h = height above the water (bigger = higher).
   arc: [from, to] relative to the bow, or 'all'. */
const L = 60; // hull length in local units
const B = 20; // beam
export const HULL = { L, B };

// a hull outline pointing up the screen, centred on 0,0
export function hullPath(len = L, beam = B) {
  const h = len / 2;
  const b = beam / 2;
  return `M0 ${-h} C${b * 0.7} ${-h * 0.72} ${b} ${-h * 0.25} ${b} ${h * 0.15} L${b * 0.9} ${h} L${-b * 0.9} ${h} L${-b} ${h * 0.15} C${-b} ${-h * 0.25} ${-b * 0.7} ${-h * 0.72} 0 ${-h} Z`;
}


const side = [
  { id: 'stbd', color: 'green', x: B / 2 - 1, y: -L * 0.12, h: 10, arc: [0, ARC.side] },
  { id: 'port', color: 'red', x: -(B / 2 - 1), y: -L * 0.12, h: 10, arc: [-ARC.side, 0] },
];
const masthead = { id: 'mast', color: 'white', x: 0, y: -L * 0.1, h: 30, arc: [-ARC.side, ARC.side] };
const stern = { id: 'stern', color: 'white', x: 0, y: L / 2 - 1, h: 12, arc: [ARC.side, 360 - ARC.side] };
const allRound = (h = 26, y = 2, id = 'allround') => ({ id, color: 'white', x: 0, y, h, arc: 'all' });

export const VESSELS = {
  'power-lt12': { label: 'Power vessel under 12 m', lights: [...side, allRound(26)] },
  'power-masthead': { label: 'Power vessel (masthead + stern light)', lights: [...side, masthead, stern] },
  'power-lt7': { label: 'Power vessel under 7 m and 7 knots', lights: [allRound(18)] },
  sail: { label: 'Sailing vessel (sidelights + stern light)', lights: [...side, stern], sail: true },
  'sail-tricolour': {
    label: 'Sailing vessel with a masthead tricolour',
    sail: true,
    lights: [
      { id: 'tri-g', color: 'green', x: 0.6, y: 0, h: 46, arc: [0, ARC.side] },
      { id: 'tri-r', color: 'red', x: -0.6, y: 0, h: 46, arc: [-ARC.side, 0] },
      { id: 'tri-w', color: 'white', x: 0, y: 0, h: 46, arc: [ARC.side, 360 - ARC.side] },
    ],
  },
  anchor: { label: 'Vessel at anchor (under 50 m)', lights: [allRound(20, -L * 0.3, 'anchor')], anchored: true },
  'anchor-50': {
    label: 'Vessel at anchor (50 m and over)',
    big: true,
    anchored: true,
    lights: [allRound(34, -L * 0.42, 'anchor-fwd'), allRound(20, L * 0.42, 'anchor-aft')],
  },
  diver: {
    label: 'Diving vessel at night',
    anchored: true,
    lights: [
      { id: 'dv-top', color: 'red', x: 0, y: 0, h: 44, arc: 'all' },
      { id: 'dv-mid', color: 'white', x: 0, y: 0, h: 36, arc: 'all' },
      { id: 'dv-bot', color: 'red', x: 0, y: 0, h: 28, arc: 'all' },
      allRound(20, -L * 0.3, 'anchor'),
    ],
  },
};

export function lightVisible(light, theta) {
  if (light.arc === 'all') return true;
  const t = norm180(theta);
  const [a0, a1] = light.arc;
  if (light.id === 'stern' || light.id === 'tri-w') return Math.abs(t) >= ARC.side - 0.01;
  // head-on (± a hair): both sidelights show
  if (light.color === 'green' && Math.abs(t) < 1.5) return true;
  if (light.color === 'red' && Math.abs(t) < 1.5) return true;
  return t >= a0 - 0.01 && t <= a1 + 0.01;
}

/* Project a light seen by an observer standing at bearing `theta` from the
   vessel's bow (0 = dead ahead of it, 90 = off its starboard beam). Returns
   screen x (right +) for that observer. */
export function screenX(p, theta) {
  const c = Math.cos(rad(theta));
  const s = Math.sin(rad(theta));
  return -p.x * c - p.y * s;
}

// What an observer at `theta` sees, sorted left→right
export function visibleLights(vessel, theta) {
  const v = VESSELS[vessel];
  return v.lights.filter((l) => lightVisible(l, theta)).map((l) => ({ ...l, sx: screenX(l, theta) }));
}

// which named aspect a theta is
export function aspectOf(theta) {
  const t = norm180(theta);
  if (Math.abs(t) <= 8) return 'ahead';
  if (Math.abs(t) >= ARC.side) return 'astern';
  return t > 0 ? 'starboard' : 'port';
}
export const ASPECT_THETA = { ahead: 0, starboard: 60, port: -60, astern: 180 };

export const LIGHT_COLOR = { white: '#fff6d6', red: '#ff4b4b', green: '#33e08a', yellow: '#ffd23f' };

/* ── IALA marks: colours, topmarks, light rhythms (Workbook p.37–39) ──── */
export const MARKS = {
  port: { label: 'Port lateral mark', light: 'red', rhythm: 'Fl R 4s', page: 37 },
  starboard: { label: 'Starboard lateral mark', light: 'green', rhythm: 'Fl G 4s', page: 37 },
  north: { label: 'North cardinal', light: 'white', rhythm: 'Q', page: 39 },
  east: { label: 'East cardinal', light: 'white', rhythm: 'Q(3) 10s', page: 39 },
  south: { label: 'South cardinal', light: 'white', rhythm: 'Q(6)+LFl 15s', page: 39 },
  west: { label: 'West cardinal', light: 'white', rhythm: 'Q(9) 15s', page: 39 },
  isolated: { label: 'Isolated danger mark', light: 'white', rhythm: 'Fl(2) 5s', page: 37 },
  safe: { label: 'Safe water mark', light: 'white', rhythm: 'LFl 10s', page: 38 },
  special: { label: 'Special mark', light: 'yellow', rhythm: 'Fl Y 4s', page: 38 },
};

// rhythm as a list of [onMs, offMs]; the period is their sum
const q = (n) => Array.from({ length: n }, () => [250, 750]);
export const RHYTHMS = {
  'Q': q(1),
  'VQ': [[150, 350]],
  'Q(3) 10s': [...q(2), [250, 750 + 7000]],
  'Q(6)+LFl 15s': [...q(6), [2000, 7000]],
  'Q(9) 15s': [...q(8), [250, 750 + 6000]],
  'Fl(2) 5s': [[400, 600], [400, 3600]],
  'LFl 10s': [[2000, 8000]],
  'Fl R 4s': [[500, 3500]],
  'Fl G 4s': [[500, 3500]],
  'Fl Y 4s': [[500, 3500]],
  'Iso 4s': [[2000, 2000]],
};
export const periodOf = (r) => RHYTHMS[r].reduce((s, [a, b]) => s + a + b, 0);
export function isOn(r, t) {
  const P = periodOf(r);
  let x = ((t % P) + P) % P;
  for (const [on, off] of RHYTHMS[r]) {
    if (x < on) return true;
    x -= on;
    if (x < off) return false;
    x -= off;
  }
  return false;
}
// list of [startMs, endMs] lit intervals in one period (for the strip)
export function litSpans(r) {
  const out = [];
  let t = 0;
  for (const [on, off] of RHYTHMS[r]) {
    out.push([t, t + on]);
    t += on + off;
  }
  return out;
}
