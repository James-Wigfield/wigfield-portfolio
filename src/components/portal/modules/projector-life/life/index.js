/* PROJECTOR LIFE — life/ entry. STUB by the lead so the tab renders; the life
   agent replaces this file (contract: CONTRACTS.md §4). */
export function createLifeHost({ patches }) {
  let list = patches;
  const surfaces = new Map();
  let t = 0;
  const alloc = () => {
    surfaces.clear();
    for (const p of list) {
      const w = Math.max(1, Math.ceil(p.width * 24));
      const h = Math.max(1, Math.ceil(p.height * 24));
      surfaces.set(p.id, { w, h, ppm: 24, data: new Uint8Array(w * h * 4), version: 0 });
    }
  };
  alloc();
  return {
    setPatches(p) {
      list = p;
      alloc();
    },
    setParams() {},
    step(dt) {
      t += dt;
    },
    surfaces: () => surfaces,
    frame: () => null,
    airborne: () => [],
    seed() {},
    reseed() {},
    clear() {},
    stats: () => ({ simMs: 0, t, populations: { floor: 0, wall: 0, ceiling: 0 } }),
    dispose() {
      surfaces.clear();
    },
  };
}
