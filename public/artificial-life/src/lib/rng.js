// Small deterministic PRNG (mulberry32) so presets and reseeds are reproducible
// when a seed is supplied, and lively when it is not.
export function makeRng(seed = (Math.random() * 4294967296) >>> 0) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = seed;
  // Box-Muller, one value at a time
  rng.normal = () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.int = (n) => (rng() * n) | 0;
  return rng;
}
