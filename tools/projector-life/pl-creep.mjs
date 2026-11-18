/* Lead's probe (kept as a tool): run the DEFAULT scene (the living-shed
   preset) headless for N sim-minutes and print, every 15 s of sim time, the
   per-system population and the cost per 30 Hz tick — to catch slow creep.
     node tools/projector-life/pl-creep.mjs [minutes=4] */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/projector-life');
const imp = (p) => import(pathToFileURL(path.join(MOD, p)).href);
const { buildPatches } = await imp('room/roomModel.js');
const { createLifeHost, TICK } = await imp('life/index.js');
const { defaults } = await imp('params.js');
const { DEFAULT_PRESET } = await imp('presets.js');

const minutes = Number(process.argv[2]) || 4;
const patches = buildPatches({ apex: 3.3 });
const landing = (x, z) => ({ y: 0, patchId: 'floor', local: [x, 4.36 - z], surface: 'floor' });
const values = { ...defaults(), ...DEFAULT_PRESET.values };
const host = createLifeHost({ patches, landing, values, seed: 11 });
const ticks = Math.round((minutes * 60) / TICK);
let acc = 0;
let n = 0;
for (let i = 1; i <= ticks; i++) {
  const t0 = performance.now();
  host.step(TICK);
  acc += performance.now() - t0;
  n++;
  if (i % Math.round(15 / TICK) === 0) {
    const s = host.stats();
    const { sys } = host._debug();
    const pl = sys.particlelife.stats?.() || {};
    console.log(
      `t=${(i * TICK).toFixed(0).padStart(4)}s  ms/tick=${(acc / n).toFixed(2)}  particles=${JSON.stringify(s.particles)}  pl=${JSON.stringify(pl).slice(0, 160)}  creatures=${s.creatures?.alive}`,
    );
    acc = 0;
    n = 0;
  }
}
host.dispose();
