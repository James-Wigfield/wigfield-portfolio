/* ============================================================================
   GRADIENT ARCADE — SEEDED RANDOMNESS
   ----------------------------------------------------------------------------
   Every round is reproducible from its seed (the headless bot plays known
   rounds; a daily mix is the same for everyone that day). mulberry32, the
   same generator the study modules use, plus the helpers games need.

     rng(seed)       → { next, int, pick, shuffle, normal, chance, weighted }
     hashSeed(str)   → a 32-bit seed from a string ('param-sniper:2026-10-22')
     daySeed(date)   → the seed for a calendar day (local time)
     todayISO()      → 'YYYY-MM-DD' in local time
   ========================================================================== */

export function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // integer in [lo, hi] inclusive
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  // Fisher–Yates on a copy
  const shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  // Box–Muller standard normal
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const chance = (p) => next() < p;
  // pick an index by weight (weights ≥ 0; all-zero → uniform)
  const weighted = (weights) => {
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return Math.floor(next() * weights.length);
    let r = next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return i;
    }
    return weights.length - 1;
  };
  return { next, int, pick, shuffle, normal, chance, weighted };
}

// FNV-1a over the string's UTF-16 code units
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const daySeed = (iso = todayISO()) => hashSeed(`dla:${iso}`);

// a fresh seed for a free-play round (time-based, but still a plain integer)
export const freshSeed = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
