// EVOLVING ECOLOGY — organisms built out of Particle Life, carrying genomes
// that are literally lists of rules, and a dial that caps how many rules a
// genome may hold.
//
// A cell has one of four roles. Leaves harvest light and are shaded by the
// cells around them (their own body's cells count half). Burners live on what
// nearby leaves give off, and in return make those leaves photosynthesise
// faster: neither needs the other to be kin, so the payoff is the same
// whether the partner is in your own body or someone else's. Mouths eat
// cells of other species they touch, if that body is no bigger than their
// own. Shells cannot be eaten. An organism pools the energy of its cells,
// grows a cell at a time to the size its genome names, then divides in two;
// a daughter may inherit a mutated copy of the genome. Two species that have
// each evolved a rule drawing them to the other may fuse into one organism.
//
// A genome is a list of rules of two kinds:
//   grow   "build cells of role r, in proportion w"            (up to 4)
//   move   "my role a, near a [kin | foreign] cell of role b,
//           is attracted (or repelled) with strength f"          (up to 32)
// Anything a genome has no rule for falls back to a default: kin cohere,
// strangers keep a little apart, mouths close on strangers. The rules dial
// caps the total; every cell built pays to copy the genome, so a rule only
// survives if it pays for itself. The readout's trace is the mean number of
// rules in use.
import { makeRng } from '../lib/rng.js';
import { Surface } from '../lib/surface.js';
import { hex, pack } from '../lib/palette.js';

const DT = 0.02;        // physics step, as Particle Life
const TICK = 1 / 60;    // seconds of metabolism per tick
const ROLES = 4;
const LEAF = 0, BURN = 1, MOUTH = 2, SHELL = 3;
const SLOTS = ROLES * 2 * ROLES;       // 32 move rules: me x {kin, foreign} x them
const RULES_MAX = ROLES + SLOTS;       // 36
const NCAP = 12000;                    // hard cell capacity
const OCAP = NCAP;
const GCAP = 8192;
const TARGET_PX = 480000;

// physics
const RMAX = 0.05;
const BETA = 0.3;
const FORCE = 10;
const FRICTION = 0.85;
const KIN_DEFAULT = 0.5;
const FOREIGN_DEFAULT = -0.12;
const HUNT_DEFAULT = 0.45;  // a mouth with no rule about it closes on strangers
// The membrane: a cell may sit anywhere inside its body's radius, which grows
// with the square root of the body's size, but not outside it. Without this,
// evolution's answer to shading is to dissolve the body into a lattice of
// lone cells; with it, the answer has to be an arrangement.
const MEMBRANE = 2.5;
const BODY_R = 0.0145;    // radius of a body of one cell; scales with sqrt(size)
const CONTACT = 0.42;     // bite reach, as a fraction of rmax

// metabolism, per second unless noted
const UPKEEP = 1.0;      // per cell for a body of one; Kleiber's law below
const SHELL_UPKEEP = 0.6;  // fraction of a working cell's cost
const BURN_RATE = 2.4;
const CELL_COST = 4;
const BITE_COOL = 0.8;
const RULE_COST = 0.07;   // energy per rule, paid for every cell built: each one copies the genome
const SHADE_FREE = 4;     // neighbours a leaf can have before shading starts
const SHADE_N = 3;
const KIN_HUE = 0.05;     // hue distance under which a mouth will not bite
const LIFESPAN = 40;      // seconds an organism may go without dividing
const MAX_BODY = 48;
const CROWD_EXP = 6;      // how sharply upkeep rises as the dish nears capacity

// Symbiogenesis: two species touching, each holding a rule that draws it to
// the other, may fuse into one organism with one merged genome. The merged
// rule list has to fit under the rules dial, so the dial decides whether
// partners can ever become a single body.
const FUSE_MIN = 0.35;    // strength each partner's attraction rule must have
const FUSE_P = 0.002;     // chance per touching pair per tick
const FUSE_Q = 32;        // fusions considered per tick

const ROLE_INFO = [
  { name: 'leaf', hex: '#93b96b' },
  { name: 'burner', hex: '#e0a54a' },
  { name: 'mouth', hex: '#d8607f' },
  { name: 'shell', hex: '#cfc7b4' },
];

const BG = pack(9, 9, 8);

export const meta = {
  id: 'ecology',
  name: 'Evolving ecology',
  latin: 'Consortium mutabile',
  accession: 'AL·0906',
  plate: 'VI',
  described: 2026,
  accent: '#5f9fc8',
  note: 'Particle Life with heredity. Each organism carries its own list of rules, and the first dial caps how long that list may get. Starve it of rules and the dish stays a field of simple blobs. Give it room and bodies grow and differentiate, prey learn to flee, and partners fuse into one organism. Wind the substeps up: evolution takes minutes.',
  source: 'Synthesis for this cabinet. Force law after Mohr, T. (2022) Particle Life; symbiosis after Margulis, L. (1967) On the origin of mitosing cells; rule-list genomes after Ray, T. (1991) Tierra.',
};

// slot k = me*8 + (foreign ? 4 : 0) + them
function defaultFor(k) {
  if (!(k & 4)) return KIN_DEFAULT;
  const me = k >> 3, them = k & 3;
  return me === MOUTH && them !== MOUTH ? HUNT_DEFAULT : FOREIGN_DEFAULT;
}

function popcount(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function create({ pixels = TARGET_PX } = {}) {
  const params = [
    { key: 'rules', label: 'rules per genome', min: 1, max: RULES_MAX, step: 1, value: 24, integer: true },
    { key: 'mutation', label: 'mutation rate', min: 0, max: 1, step: 0.01, value: 0.4 },
    { key: 'light', label: 'light', min: 0.5, max: 4, step: 0.05, value: 1.6 },
    { key: 'symbiosis', label: 'symbiosis payoff', min: 0, max: 3, step: 0.05, value: 1.5 },
    { key: 'predation', label: 'predation yield', min: 0, max: 2, step: 0.05, value: 0.8 },
    { key: 'budget', label: 'carrying capacity', min: 1000, max: NCAP, step: 250, value: 6000, integer: true },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  let rng = makeRng();
  let worldW = 1.78, worldH = 1;
  let nx = 4, ny = 4, cw = RMAX, ch = RMAX;
  let surf = null, SW = 0, SH = 0;
  let discDX, discDY, discW, haloDX, haloDY, haloW;
  let tick = 0;

  // ---- cells: compact arrays, dead ones swept at the end of every tick
  let n = 0;
  let px, py, vx, vy, cOrg, cRole, cCool, dead;
  let fx, fy, nAll, nLeaf, nBurn, nLeafX, nBurnX, prey, cGen, cHue, items;
  let cellStart, cellCount;

  // ---- organisms
  let oGen, oE, oAge, oLife, oGrowT, oStarveT, oAlive, oBirth, oGenN;
  let oSize, oCount, oCx, oCy, oRad, oUp, oInc, oPart, orgStart, orgItems, oFree;
  let oFreeN = 0, orgHi = 0, orgLive = 0;

  // ---- genomes
  let gEff, gMask, gGrow, gSize, gHue, gRules, gRef, gCol, gCells, gFree;
  let gFreeN = 0, gLive = 0;
  const fuseA = new Int32Array(FUSE_Q), fuseB = new Int32Array(FUSE_Q);
  let fuseN = 0, fusions = 0;

  // ---- census, refreshed every tick
  const census = {
    orgs: 0, cells: 0, genotypes: 0, meanRules: 0, maxRules: 0, maxGen: 0,
    symbiotic: 0, largest: 0, fusions: 0, roles: new Int32Array(ROLES), lead: -1, leadCells: 0,
  };

  const roleCol = ROLE_INFO.map((r) => hex(r.hex));

  function alloc() {
    px = new Float32Array(NCAP); py = new Float32Array(NCAP);
    vx = new Float32Array(NCAP); vy = new Float32Array(NCAP);
    cOrg = new Int32Array(NCAP); cRole = new Uint8Array(NCAP);
    cCool = new Float32Array(NCAP); dead = new Uint8Array(NCAP);
    fx = new Float32Array(NCAP); fy = new Float32Array(NCAP);
    nAll = new Uint16Array(NCAP); nLeaf = new Uint16Array(NCAP); nBurn = new Uint16Array(NCAP);
    nLeafX = new Uint16Array(NCAP); nBurnX = new Uint16Array(NCAP);
    prey = new Int32Array(NCAP); cGen = new Int32Array(NCAP); cHue = new Float32Array(NCAP);
    items = new Uint32Array(NCAP);

    oGen = new Int32Array(OCAP); oE = new Float32Array(OCAP); oAge = new Float32Array(OCAP);
    oLife = new Float32Array(OCAP); oGrowT = new Float32Array(OCAP); oStarveT = new Float32Array(OCAP);
    oAlive = new Uint8Array(OCAP); oBirth = new Int32Array(OCAP); oGenN = new Uint32Array(OCAP);
    oSize = new Int32Array(OCAP); oCount = new Int32Array(OCAP * ROLES);
    oCx = new Float32Array(OCAP); oCy = new Float32Array(OCAP); oRad = new Float32Array(OCAP);
    oInc = new Float32Array(OCAP); oPart = new Float32Array(OCAP); oUp = new Float32Array(OCAP);
    orgStart = new Int32Array(OCAP + 1); orgItems = new Int32Array(NCAP);
    oFree = new Int32Array(OCAP);

    gEff = new Float32Array(GCAP * SLOTS); gMask = new Uint32Array(GCAP);
    gGrow = new Float32Array(GCAP * ROLES); gSize = new Uint8Array(GCAP);
    gHue = new Float32Array(GCAP); gRules = new Uint8Array(GCAP); gRef = new Int32Array(GCAP);
    gCol = new Uint8Array(GCAP * 3); gCells = new Int32Array(GCAP); gFree = new Int32Array(GCAP);
  }

  function clearWorld() {
    n = 0;
    orgHi = 0; orgLive = 0;
    oAlive.fill(0);
    oFreeN = 0;
    for (let o = OCAP - 1; o >= 0; o--) oFree[oFreeN++] = o;
    gRef.fill(0);
    gFreeN = 0; gLive = 0;
    for (let g = GCAP - 1; g >= 0; g--) gFree[gFreeN++] = g;
    tick = 0;
    fuseN = 0; fusions = 0;
  }

  // ---------- genomes ---------------------------------------------------

  function allocGenome() {
    if (gFreeN === 0) return -1;
    const g = gFree[--gFreeN];
    gLive++;
    gRef[g] = 0;
    return g;
  }

  function discardGenome(g) {
    gFree[gFreeN++] = g;
    gLive--;
  }

  function releaseGenome(g) {
    if (--gRef[g] === 0) { gFree[gFreeN++] = g; gLive--; }
  }

  function blankGenome(g) {
    const e = g * SLOTS;
    for (let k = 0; k < SLOTS; k++) gEff[e + k] = defaultFor(k);
    gMask[g] = 0;
    for (let r = 0; r < ROLES; r++) gGrow[g * ROLES + r] = 0;
  }

  function finishGenome(g) {
    let grow = 0;
    for (let r = 0; r < ROLES; r++) if (gGrow[g * ROLES + r] > 0) grow++;
    gRules[g] = grow + popcount(gMask[g]);
    // halo: the organism's lineage colour, kept quiet so the roles read first
    const c = hslToRgb(gHue[g], 0.5, 0.52);
    gCol[g * 3] = c[0]; gCol[g * 3 + 1] = c[1]; gCol[g * 3 + 2] = c[2];
  }

  function growCount(g) {
    let k = 0;
    for (let r = 0; r < ROLES; r++) if (gGrow[g * ROLES + r] > 0) k++;
    return k;
  }

  function setMove(g, k, v) {
    gEff[g * SLOTS + k] = v;
    gMask[g] = (gMask[g] | (1 << k)) >>> 0;
  }

  function clearMove(g, k) {
    gEff[g * SLOTS + k] = defaultFor(k);
    gMask[g] = (gMask[g] & ~(1 << k)) >>> 0;
  }

  function addRule(g) {
    const grows = growCount(g);
    if (grows + popcount(gMask[g]) >= p.rules) return;
    if (grows < ROLES && rng() < 0.3) {
      let r = rng.int(ROLES);
      while (gGrow[g * ROLES + r] > 0) r = (r + 1) % ROLES;
      gGrow[g * ROLES + r] = 0.2 + rng() * 0.6;
      return;
    }
    if (gMask[g] === 0xffffffff) return;
    let k = rng.int(SLOTS);
    while (gMask[g] & (1 << k)) k = (k + 1) % SLOTS;
    setMove(g, k, Math.round((rng() * 2 - 1) * 100) / 100);
  }

  function removeRule(g, preferMove = false) {
    const grows = growCount(g);
    const moves = popcount(gMask[g]);
    if (moves === 0 && grows <= 1) return false;
    const pickMove = moves > 0 && (preferMove || grows <= 1 || rng.int(grows + moves) < moves);
    if (pickMove) {
      let t = rng.int(moves);
      for (let k = 0; k < SLOTS; k++) {
        if (!(gMask[g] & (1 << k))) continue;
        if (t-- === 0) { clearMove(g, k); break; }
      }
    } else {
      let t = rng.int(grows);
      for (let r = 0; r < ROLES; r++) {
        if (!(gGrow[g * ROLES + r] > 0)) continue;
        if (t-- === 0) { gGrow[g * ROLES + r] = 0; break; }
      }
    }
    return true;
  }

  function enforceCap(g) {
    while (growCount(g) + popcount(gMask[g]) > p.rules) {
      if (!removeRule(g, true)) break;
    }
    finishGenome(g);
  }

  function primordialGenome(hue) {
    const g = allocGenome();
    if (g < 0) return -1;
    blankGenome(g);
    gGrow[g * ROLES + LEAF] = 1;
    gSize[g] = 4 + rng.int(4);
    gHue[g] = hue;
    finishGenome(g);
    return g;
  }

  function randomGenome(hue) {
    const g = allocGenome();
    if (g < 0) return -1;
    blankGenome(g);
    gGrow[g * ROLES + (rng() < 0.75 ? LEAF : BURN)] = 0.4 + rng() * 0.6;
    for (let r = 0; r < ROLES; r++) if (rng() < 0.35 && !(gGrow[g * ROLES + r] > 0)) gGrow[g * ROLES + r] = 0.2 + rng() * 0.6;
    const want = rng.int(Math.max(1, Math.min(SLOTS, p.rules) / 3 | 0) + 1);
    for (let i = 0; i < want; i++) setMove(g, rng.int(SLOTS), Math.round((rng() * 2 - 1) * 100) / 100);
    gSize[g] = 6 + rng.int(14);
    gHue[g] = hue;
    enforceCap(g);
    return g;
  }

  function mutate(src) {
    const g = allocGenome();
    if (g < 0) return src;
    gEff.copyWithin(g * SLOTS, src * SLOTS, src * SLOTS + SLOTS);
    gGrow.copyWithin(g * ROLES, src * ROLES, src * ROLES + ROLES);
    gMask[g] = gMask[src];
    gSize[g] = gSize[src];
    let h = gHue[src] + rng.normal() * 0.025;
    gHue[g] = h - Math.floor(h);

    if (rng() < 0.4) gSize[g] = Math.max(4, Math.min(48, Math.round(gSize[src] + rng.normal() * 2.5)));
    for (let k = 0; k < SLOTS; k++) {
      if (!(gMask[g] & (1 << k)) || rng() >= 0.25) continue;
      const v = gEff[g * SLOTS + k] + rng.normal() * 0.3;
      gEff[g * SLOTS + k] = Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
    }
    for (let r = 0; r < ROLES; r++) {
      const i = g * ROLES + r;
      if (gGrow[i] > 0 && rng() < 0.3) gGrow[i] = Math.max(0.05, Math.min(1, gGrow[i] * Math.exp(rng.normal() * 0.4)));
    }
    if (rng() < 0.4) addRule(g);
    if (rng() < 0.25) removeRule(g);
    enforceCap(g);
    return g;
  }

  // Two genomes become one. Body plan: the cells each partner brings. Move
  // rules: the union, the larger partner winning a conflict. Then whatever
  // drew the two together as strangers is written in again as kin rules, so
  // the partnership becomes anatomy. Refused (-1) if it will not fit the cap.
  function mergeGenomes(ga, gb, sa, sb) {
    const g = allocGenome();
    if (g < 0) return -1;
    blankGenome(g);
    let wa = 0, wb = 0;
    for (let r = 0; r < ROLES; r++) { wa += gGrow[ga * ROLES + r]; wb += gGrow[gb * ROLES + r]; }
    let mx = 0;
    for (let r = 0; r < ROLES; r++) {
      const w = (wa > 0 ? gGrow[ga * ROLES + r] / wa * sa : 0) + (wb > 0 ? gGrow[gb * ROLES + r] / wb * sb : 0);
      gGrow[g * ROLES + r] = w;
      if (w > mx) mx = w;
    }
    for (let r = 0; r < ROLES; r++) gGrow[g * ROLES + r] = mx > 0 ? gGrow[g * ROLES + r] / mx : 0;
    const big = sa >= sb ? ga : gb, small = big === ga ? gb : ga;
    for (let k = 0; k < SLOTS; k++) {
      const bit = 1 << k;
      if (gMask[big] & bit) setMove(g, k, gEff[big * SLOTS + k]);
      else if (gMask[small] & bit) setMove(g, k, gEff[small * SLOTS + k]);
    }
    gSize[g] = Math.min(MAX_BODY, gSize[ga] + gSize[gb]);
    // hue: circular mean, weighted by size
    const ta = gHue[ga] * Math.PI * 2, tb = gHue[gb] * Math.PI * 2;
    const h = Math.atan2(sa * Math.sin(ta) + sb * Math.sin(tb), sa * Math.cos(ta) + sb * Math.cos(tb)) / (Math.PI * 2);
    gHue[g] = h - Math.floor(h);
    let rules = growCount(g) + popcount(gMask[g]);
    if (rules > p.rules) { discardGenome(g); return -1; }
    for (let k = 0; k < SLOTS && rules < p.rules; k++) {
      if (!(k & 4) || !(gMask[g] & (1 << k)) || gEff[g * SLOTS + k] <= 0) continue;
      const kin = k & ~4;
      if (gMask[g] & (1 << kin)) continue;
      setMove(g, kin, gEff[g * SLOTS + k]);
      rules++;
    }
    finishGenome(g);
    return g;
  }

  // ---------- organisms and cells ---------------------------------------

  function newOrg(g) {
    if (oFreeN === 0 || g < 0) return -1;
    const o = oFree[--oFreeN];
    if (o >= orgHi) orgHi = o + 1;
    oAlive[o] = 1; orgLive++;
    oGen[o] = g; gRef[g]++;
    oE[o] = 0; oAge[o] = 0; oLife[o] = LIFESPAN * (0.7 + rng() * 0.6);
    oGrowT[o] = 0; oStarveT[o] = 0; oBirth[o] = tick; oGenN[o] = 0;
    oSize[o] = 0; oInc[o] = 0; oPart[o] = 0;
    for (let r = 0; r < ROLES; r++) oCount[o * ROLES + r] = 0;
    return o;
  }

  function killOrg(o) {
    oAlive[o] = 0; orgLive--;
    releaseGenome(oGen[o]);
    oFree[oFreeN++] = o;
  }

  function addCell(o, role, x, y) {
    if (n >= Math.min(NCAP, p.budget)) return -1;
    const i = n++;
    if (x < 0) x += worldW; else if (x >= worldW) x -= worldW;
    if (y < 0) y += worldH; else if (y >= worldH) y -= worldH;
    px[i] = x; py[i] = y; vx[i] = 0; vy[i] = 0;
    cOrg[i] = o; cRole[i] = role; cCool[i] = 0; dead[i] = 0;
    oSize[o]++; oCount[o * ROLES + role]++;
    return i;
  }

  function nextRole(o, g) {
    let total = 0;
    for (let r = 0; r < ROLES; r++) total += gGrow[g * ROLES + r];
    if (total <= 0) return LEAF;
    const size = oSize[o] + 1;
    let best = LEAF, bestD = -Infinity;
    for (let r = 0; r < ROLES; r++) {
      const w = gGrow[g * ROLES + r];
      if (!(w > 0)) continue;
      const d = (w / total) * size - oCount[o * ROLES + r];
      if (d > bestD) { bestD = d; best = r; }
    }
    return best;
  }

  function spawnOrg(g, x, y, cells, energy) {
    const o = newOrg(g);
    if (o < 0) { if (gRef[g] === 0) { gRef[g] = 1; releaseGenome(g); } return -1; }
    oE[o] = energy;
    for (let k = 0; k < cells; k++) {
      const a = rng() * Math.PI * 2, r = RMAX * 0.3 * Math.sqrt(rng());
      addCell(o, nextRole(o, g), x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    if (oSize[o] === 0) { killOrg(o); return -1; }
    return o;
  }

  // a random living member of o, from this tick's index
  function pickMember(o) {
    const a = orgStart[o], b = orgStart[o + 1];
    if (b <= a) return -1;
    for (let t = 0; t < 4; t++) {
      const i = orgItems[a + rng.int(b - a)];
      if (!dead[i]) return i;
    }
    for (let k = a; k < b; k++) if (!dead[orgItems[k]]) return orgItems[k];
    return -1;
  }

  function killMember(o) {
    const i = pickMember(o);
    if (i < 0) return;
    dead[i] = 1;
    oSize[o]--;
    oCount[o * ROLES + cRole[i]]--;
  }

  // ---------- world -----------------------------------------------------

  function buildCells() {
    nx = Math.max(4, Math.floor(worldW / RMAX));
    ny = Math.max(4, Math.floor(worldH / RMAX));
    cw = worldW / nx;
    ch = worldH / ny;
    cellCount = new Uint32Array(nx * ny + 1);
    cellStart = new Uint32Array(nx * ny + 1);
  }

  function stamp(rad, soft) {
    const ri = Math.ceil(rad + 1);
    const dxs = [], dys = [], ws = [];
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > rad + 0.5) continue;
        let w;
        if (soft) {
          // a flat plateau with a soft edge: neighbouring halos merge into
          // one membrane instead of reading as a ring of separate glows
          const t = Math.max(0, Math.min(1, (rad + 0.5 - d) / (rad * 0.45)));
          w = t * t * (3 - 2 * t);
        } else {
          const t = Math.max(0, Math.min(1, (rad + 0.5 - d) / 1.4));
          w = t * t * (3 - 2 * t);
        }
        if (w <= 0.003) continue;
        dxs.push(dx); dys.push(dy); ws.push(w);
      }
    }
    return [Int8Array.from(dxs), Int8Array.from(dys), Float32Array.from(ws)];
  }

  function buildSurface(aspect) {
    const h = Math.max(240, Math.round(Math.sqrt(pixels / aspect)));
    const w = Math.max(240, Math.round(h * aspect));
    if (surf && w === SW && h === SH) return;
    if (surf) surf.dispose();
    SW = w; SH = h;
    surf = new Surface(SW, SH);
    surf.u32.fill(BG);
    const rad = Math.max(1.6, SH * 0.0062);
    [discDX, discDY, discW] = stamp(rad, false);
    [haloDX, haloDY, haloW] = stamp(rad * 2.1, true);
  }

  function setParam(key, val) {
    if (!(key in p)) return;
    if (key === 'rules' || key === 'budget') val = Math.round(val);
    p[key] = val;
    const d = params.find((q) => q.key === key);
    if (d) d.value = val;
    if (key === 'rules' && gRef) {
      // A smaller budget applies to the living at once: the population is
      // dumbed down in place rather than waiting generations to notice.
      for (let g = 0; g < GCAP; g++) if (gRef[g] > 0 && gRules[g] > p.rules) enforceCap(g);
    }
  }

  // ---------- seeding ---------------------------------------------------

  function soup(kind, count) {
    for (let k = 0; k < count; k++) {
      const hue = rng();
      const g = kind === 'random' ? randomGenome(hue) : primordialGenome(hue);
      if (g < 0) break;
      spawnOrg(g, rng() * worldW, rng() * worldH, 2 + rng.int(2), CELL_COST * 0.5);
    }
  }

  const presets = [
    {
      name: 'primordial',
      note: 'one-rule leaf blobs in a 24-rule world: watch the genomes lengthen',
      values: { rules: 24, mutation: 0.4, light: 1.6, symbiosis: 1.5, predation: 0.8 },
      seed() { clearWorld(); soup('primordial', 140); },
    },
    {
      name: 'two rules',
      note: 'the same soup with two rules per genome: a leaf and one other thing, ever',
      values: { rules: 2, mutation: 0.4, light: 1.6, symbiosis: 1.5, predation: 0.8 },
      seed() { clearWorld(); soup('primordial', 140); },
    },
    {
      name: 'open genome',
      note: 'every rule allowed, and a soup of random genomes to start from',
      values: { rules: 36, mutation: 0.4, light: 1.6, symbiosis: 1.5, predation: 0.8 },
      seed() { clearWorld(); soup('random', 160); },
    },
    {
      name: 'consortia',
      note: 'partners pay triple and nothing bites: a world for symbiosis',
      values: { rules: 16, mutation: 0.4, light: 1.3, symbiosis: 3, predation: 0 },
      seed() { clearWorld(); soup('random', 160); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) setParam(k, pr.values[k]);
    pr.seed();
    current = presets.indexOf(pr);
  }

  // ---------- one tick --------------------------------------------------

  function indexOrganisms() {
    // counting sort of cells by organism: member lists, sizes, role counts,
    // torus-aware centroids
    orgStart.fill(0, 0, orgHi + 1);
    for (let i = 0; i < n; i++) orgStart[cOrg[i] + 1]++;
    for (let o = 0; o < orgHi; o++) orgStart[o + 1] += orgStart[o];
    const cursor = oSize; // reused as a write cursor, then rebuilt as a size
    for (let o = 0; o < orgHi; o++) cursor[o] = orgStart[o];
    for (let i = 0; i < n; i++) orgItems[cursor[cOrg[i]]++] = i;
    oCount.fill(0, 0, orgHi * ROLES);
    const halfW = worldW / 2, halfH = worldH / 2;
    for (let o = 0; o < orgHi; o++) {
      const a = orgStart[o], b = orgStart[o + 1];
      oSize[o] = b - a;
      if (b === a) continue;
      const i0 = orgItems[a];
      const x0 = px[i0], y0 = py[i0];
      let sx = 0, sy = 0;
      for (let k = a; k < b; k++) {
        const i = orgItems[k];
        let dx = px[i] - x0;
        if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
        let dy = py[i] - y0;
        if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
        sx += dx; sy += dy;
        oCount[o * ROLES + cRole[i]]++;
      }
      let cx = x0 + sx / (b - a), cy = y0 + sy / (b - a);
      if (cx < 0) cx += worldW; else if (cx >= worldW) cx -= worldW;
      if (cy < 0) cy += worldH; else if (cy >= worldH) cy -= worldH;
      oCx[o] = cx; oCy[o] = cy;
      oRad[o] = Math.sqrt(b - a);
    }
    for (let i = 0; i < n; i++) {
      const g = oGen[cOrg[i]];
      cGen[i] = g;
      cHue[i] = gHue[g];
    }
  }

  function takeCensus() {
    let orgs = 0, rules = 0, maxRules = 0, maxGen = 0, sym = 0, largest = 0;
    for (let o = 0; o < orgHi; o++) {
      if (!oAlive[o] || oSize[o] === 0) continue;
      gCells[oGen[o]] = 0;
    }
    let lead = -1, leadCells = 0;
    for (let o = 0; o < orgHi; o++) {
      if (!oAlive[o] || oSize[o] === 0) continue;
      const g = oGen[o];
      orgs++;
      rules += gRules[g];
      if (gRules[g] > maxRules) maxRules = gRules[g];
      if (oGenN[o] > maxGen) maxGen = oGenN[o];
      if (oSize[o] > largest) largest = oSize[o];
      if (oInc[o] > 0 && oPart[o] > 0.25 * oInc[o]) sym++;
      gCells[g] += oSize[o];
      if (gCells[g] > leadCells) { leadCells = gCells[g]; lead = g; }
    }
    census.orgs = orgs;
    census.cells = n;
    census.genotypes = gLive;
    census.meanRules = orgs ? rules / orgs : 0;
    census.maxRules = maxRules;
    census.maxGen = maxGen;
    census.symbiotic = orgs ? sym / orgs : 0;
    census.largest = largest;
    census.fusions = fusions;
    census.lead = lead;
    census.leadCells = leadCells;
    census.roles.fill(0);
    for (let i = 0; i < n; i++) census.roles[cRole[i]]++;
  }

  function step() {
    tick++;
    // the world never empties: if it nearly has, the soup starts again
    if (orgLive < 6) soup('primordial', 24);

    indexOrganisms();
    takeCensus();

    const rmax = RMAX, beta = BETA;
    const rmax2 = rmax * rmax, contact2 = (CONTACT * rmax) * (CONTACT * rmax);
    const halfW = worldW / 2, halfH = worldH / 2;
    const nCells = nx * ny;

    // --- spatial hash by counting sort
    cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      const c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
      cellCount[c < 0 ? 0 : c >= nCells ? nCells - 1 : c]++;
    }
    let acc = 0;
    for (let c = 0; c < nCells; c++) { cellStart[c] = acc; acc += cellCount[c]; }
    cellStart[nCells] = acc;
    for (let c = 0; c < nCells; c++) cellCount[c] = cellStart[c];
    for (let i = 0; i < n; i++) {
      let c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
      c = c < 0 ? 0 : c >= nCells ? nCells - 1 : c;
      items[cellCount[c]++] = i;
    }

    fx.fill(0, 0, n); fy.fill(0, 0, n);
    nAll.fill(0, 0, n); nLeaf.fill(0, 0, n); nBurn.fill(0, 0, n);
    nLeafX.fill(0, 0, n); nBurnX.fill(0, 0, n);
    prey.fill(-1, 0, n);

    // --- pairs, each visited once (see Particle Life). One pass gives the
    // forces, the neighbour census that metabolism reads, and bite contacts.
    const invBeta = 1 / beta, invRest = 1 / (1 - beta);
    for (let gy = 0; gy < ny; gy++) {
      for (let gx = 0; gx < nx; gx++) {
        const c = gy * nx + gx;
        const a0 = cellStart[c], a1 = cellStart[c + 1];
        if (a1 === a0) continue;
        for (let t = 0; t < 5; t++) {
          let d;
          if (t === 0) d = c;
          else {
            let hx = gx + (t === 1 ? 1 : t === 2 ? -1 : t === 3 ? 0 : 1);
            let hy = gy + (t === 1 ? 0 : 1);
            if (hx < 0) hx += nx; else if (hx >= nx) hx -= nx;
            if (hy >= ny) hy -= ny;
            d = hy * nx + hx;
          }
          const b0 = cellStart[d], b1 = cellStart[d + 1];
          if (b1 === b0) continue;
          for (let k1 = a0; k1 < a1; k1++) {
            const i = items[k1];
            const xi = px[i], yi = py[i], ri = cRole[i], oi = cOrg[i];
            const rowi = cGen[i] * SLOTS + ri * 8;
            const k2s = t === 0 ? k1 + 1 : b0;
            for (let k2 = k2s; k2 < b1; k2++) {
              const j = items[k2];
              let dx = px[j] - xi;
              if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
              let dy = py[j] - yi;
              if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
              const d2 = dx * dx + dy * dy;
              if (d2 >= rmax2 || d2 === 0) continue;
              const rj = cRole[j];
              const same = oi === cOrg[j];
              const dist = Math.sqrt(d2);
              const q = dist / rmax;
              let fi, fj;
              if (q < beta) {
                fi = q * invBeta - 1;
                fj = fi;
              } else {
                const shape = 1 - Math.abs(2 * q - 1 - beta) * invRest;
                const off = same ? 0 : 4;
                fi = gEff[rowi + off + rj] * shape;
                fj = gEff[cGen[j] * SLOTS + rj * 8 + off + ri] * shape;
              }
              const ux = dx / dist, uy = dy / dist;
              fx[i] += ux * fi; fy[i] += uy * fi;
              fx[j] -= ux * fj; fy[j] -= uy * fj;

              // crowding, in half-cells: your own body shades you half as
              // much as a stranger does, because it grows arranged
              const crowd = same ? 1 : 2;
              nAll[i] += crowd; nAll[j] += crowd;
              if (rj === LEAF) nLeaf[i]++; else if (rj === BURN) nBurn[i]++;
              if (ri === LEAF) nLeaf[j]++; else if (ri === BURN) nBurn[j]++;
              if (same) continue;
              let dh = cHue[i] - cHue[j];
              if (dh < 0) dh = -dh;
              if (dh > 0.5) dh = 1 - dh;
              if (dh < KIN_HUE) continue;
              // a different species: count it as a partner, and as food
              if (rj === LEAF) nLeafX[i]++; else if (rj === BURN) nBurnX[i]++;
              if (ri === LEAF) nLeafX[j]++; else if (ri === BURN) nBurnX[j]++;
              if (d2 < contact2) {
                // gape limit: a mouth can only bite a body no bigger than its own
                if (ri === MOUTH && rj !== SHELL && prey[i] < 0 && oSize[cOrg[j]] <= oSize[oi]) prey[i] = j;
                if (rj === MOUTH && ri !== SHELL && prey[j] < 0 && oSize[oi] <= oSize[cOrg[j]]) prey[j] = i;
                // mutual attraction, written as a rule on both sides: a
                // candidate for fusion. Mouths hunt; they do not partner.
                if (fuseN < FUSE_Q && ri !== MOUTH && rj !== MOUTH) {
                  const gi = cGen[i], gj = cGen[j];
                  const ki = ri * 8 + 4 + rj, kj = rj * 8 + 4 + ri;
                  if ((gMask[gi] & (1 << ki)) && (gMask[gj] & (1 << kj))
                    && gEff[gi * SLOTS + ki] > FUSE_MIN && gEff[gj * SLOTS + kj] > FUSE_MIN
                    && rng() < FUSE_P) {
                    fuseA[fuseN] = oi; fuseB[fuseN] = cOrg[j]; fuseN++;
                  }
                }
              }
            }
          }
        }
      }
    }

    // --- hold each body together and integrate
    const kick = rmax * FORCE * DT;
    for (let i = 0; i < n; i++) {
      const o = cOrg[i];
      let dx = oCx[o] - px[i];
      if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
      let dy = oCy[o] - py[i];
      if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
      const dd = Math.sqrt(dx * dx + dy * dy);
      const over = dd - BODY_R * oRad[o];
      if (over > 0) {
        const f = MEMBRANE * Math.min(2, over / rmax) / dd;
        fx[i] += dx * f; fy[i] += dy * f;
      }
      vx[i] = vx[i] * FRICTION + fx[i] * kick;
      vy[i] = vy[i] * FRICTION + fy[i] * kick;
      let x = px[i] + vx[i] * DT, y = py[i] + vy[i] * DT;
      if (x < 0) x += worldW; else if (x >= worldW) x -= worldW;
      if (y < 0) y += worldH; else if (y >= worldH) y -= worldH;
      px[i] = x; py[i] = y;
    }

    // --- metabolism
    for (let o = 0; o < orgHi; o++) { oInc[o] = 0; oPart[o] = 0; }
    // Kleiber's law: metabolic rate goes as mass^3/4, so the cost per cell
    // falls as size^-1/4. A body of 16 runs at half the per-cell cost of a
    // lone cell. It is the only thing here that rewards being big.
    // The dish itself is finite: upkeep climbs steeply as the population
    // nears carrying capacity, so the dial is approached rather than hit.
    const press = UPKEEP * (1 + 2 * Math.pow(n / p.budget, CROWD_EXP));
    for (let o = 0; o < orgHi; o++) oUp[o] = oSize[o] > 0 ? press / Math.sqrt(Math.sqrt(oSize[o])) : press;
    const light = p.light, sym = p.symbiosis;
    for (let i = 0; i < n; i++) {
      const o = cOrg[i];
      let inc = 0, part = 0, up = oUp[o];
      const role = cRole[i];
      if (role === LEAF) {
        // shading steepens with crowding, so it caps density and not just
        // income: past a dozen or so neighbours no partner can pay for a leaf
        const na = nAll[i] * 0.5;
        const sx = na <= SHADE_FREE ? 0 : (na - SHADE_FREE) / SHADE_N;
        const shade = 1 / (1 + sx * sx);
        const nb = nBurn[i];
        const boost = nb >= 2 ? 1 : nb * 0.5;
        inc = light * shade * (1 + sym * boost);
        if (nb > 0) part = light * shade * sym * boost * (nBurnX[i] / nb);
      } else if (role === BURN) {
        // leaf exhaust is shared among every burner that can reach it
        const nl = nLeaf[i];
        const share = nl / (1.5 * (nBurn[i] + 1));
        inc = BURN_RATE * (share >= 1 ? 1 : share);
        if (nl > 0) part = inc * (nLeafX[i] / nl);
      } else if (role === SHELL) {
        up *= SHELL_UPKEEP;
      }
      oInc[o] += inc;
      oPart[o] += part;
      oE[o] += (inc - up) * TICK;
      if (cCool[i] > 0) cCool[i] -= TICK;
    }

    // --- predation: a mouth takes one foreign cell it is touching
    const bite = p.predation * CELL_COST;
    if (p.predation > 0) {
      for (let i = 0; i < n; i++) {
        const j = prey[i];
        if (j < 0 || dead[i] || dead[j] || cCool[i] > 0) continue;
        dead[j] = 1;
        const v = cOrg[j];
        oSize[v]--; oCount[v * ROLES + cRole[j]]--;
        oE[cOrg[i]] += bite;
        cCool[i] = BITE_COOL;
      }
    }

    // --- symbiogenesis
    for (let q = 0; q < fuseN; q++) fuse(fuseA[q], fuseB[q]);
    fuseN = 0;

    // --- life cycle
    const mut = p.mutation;
    const hiNow = orgHi;
    for (let o = 0; o < hiNow; o++) {
      if (!oAlive[o] || oBirth[o] === tick) continue;
      if (oSize[o] <= 0) { killOrg(o); continue; }
      const g = oGen[o];
      oAge[o] += TICK;
      oGrowT[o] -= TICK;
      oStarveT[o] -= TICK;
      if (oE[o] < 0) {
        if (oStarveT[o] <= 0) {
          killMember(o);
          oE[o] += CELL_COST * 0.5;
          oStarveT[o] = 0.2;
        }
        continue;
      }
      if (oAge[o] > oLife[o]) {
        // too long without dividing: it falls apart a cell at a time
        if (oStarveT[o] <= 0) { killMember(o); oStarveT[o] = 0.4; }
        continue;
      }
      const cost = CELL_COST + RULE_COST * gRules[g];
      if (oSize[o] < gSize[g]) {
        if (oE[o] >= cost && oGrowT[o] <= 0) {
          const m = pickMember(o);
          if (m >= 0) {
            const a = rng() * Math.PI * 2;
            if (addCell(o, nextRole(o, g), px[m] + Math.cos(a) * rmax * 0.25, py[m] + Math.sin(a) * rmax * 0.25) >= 0) {
              oE[o] -= cost;
              oGrowT[o] = 0.15;
            }
          }
        }
        continue;
      }
      if (oE[o] >= CELL_COST) divide(o, g, mut);
    }

    // --- sweep the dead out of the cell arrays
    let w = 0;
    for (let i = 0; i < n; i++) {
      if (dead[i]) continue;
      if (w !== i) {
        px[w] = px[i]; py[w] = py[i]; vx[w] = vx[i]; vy[w] = vy[i];
        cOrg[w] = cOrg[i]; cRole[w] = cRole[i]; cCool[w] = cCool[i];
      }
      dead[w] = 0;
      w++;
    }
    n = w;
  }

  function fuse(a, b) {
    if (a === b || !oAlive[a] || !oAlive[b] || oBirth[a] === tick || oBirth[b] === tick) return;
    if (oSize[a] <= 0 || oSize[b] <= 0 || oSize[a] + oSize[b] > MAX_BODY) return;
    const g = mergeGenomes(oGen[a], oGen[b], oSize[a], oSize[b]);
    if (g < 0) return;
    for (let k = orgStart[b]; k < orgStart[b + 1]; k++) {
      const i = orgItems[k];
      if (dead[i]) continue;
      cOrg[i] = a;
      oSize[a]++; oCount[a * ROLES + cRole[i]]++;
    }
    oSize[b] = 0;
    oE[a] += oE[b];
    killOrg(b);
    releaseGenome(oGen[a]);
    oGen[a] = g; gRef[g]++;
    oAge[a] = 0; oLife[a] = LIFESPAN * (0.7 + rng() * 0.6);
    oGenN[a] = Math.max(oGenN[a], oGenN[b]) + 1;
    oBirth[a] = tick; // its member index is stale until the next tick
    fusions++;
  }

  // Binary fission across a random axis through the centroid. The half on
  // the far side becomes a new organism, which may carry a mutated genome.
  function divide(o, g, mut) {
    const a = orgStart[o], b = orgStart[o + 1];
    const th = rng() * Math.PI * 2;
    const ux = Math.cos(th), uy = Math.sin(th);
    const halfW = worldW / 2, halfH = worldH / 2;
    let side = 0, live = 0;
    for (let k = a; k < b; k++) {
      const i = orgItems[k];
      if (dead[i]) continue;
      live++;
      let dx = px[i] - oCx[o];
      if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
      let dy = py[i] - oCy[o];
      if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
      if (dx * ux + dy * uy > 0) side++;
    }
    if (side === 0 || side === live) { oGrowT[o] = 0.1; return; }
    const ng = rng() < mut ? mutate(g) : g;
    const d = newOrg(ng);
    if (d < 0) { if (ng !== g && gRef[ng] === 0) { gRef[ng] = 1; releaseGenome(ng); } return; }
    const imp = 0.35 * RMAX / DT * 0.1;
    for (let k = a; k < b; k++) {
      const i = orgItems[k];
      if (dead[i]) continue;
      let dx = px[i] - oCx[o];
      if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
      let dy = py[i] - oCy[o];
      if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
      if (dx * ux + dy * uy > 0) {
        cOrg[i] = d;
        oSize[d]++; oSize[o]--;
        oCount[d * ROLES + cRole[i]]++; oCount[o * ROLES + cRole[i]]--;
        vx[i] += ux * imp; vy[i] += uy * imp;
      } else {
        vx[i] -= ux * imp; vy[i] -= uy * imp;
      }
    }
    const e = oE[o];
    oE[d] = e * (side / live);
    oE[o] = e - oE[d];
    oAge[o] = 0; oLife[o] = LIFESPAN * (0.7 + rng() * 0.6);
    oGenN[o]++;
    oGenN[d] = oGenN[o];
    oGrowT[o] = oGrowT[d] = 0.3;
  }

  // ---------- drawing ---------------------------------------------------

  function paintInto(out) {
    out.fill(BG);
    const sx = SW / worldW, sy = SH / worldH;
    // halo pass: lineage colour, faint, so a body reads as one being
    const nh = haloW.length;
    for (let i = 0; i < n; i++) {
      const x = (px[i] * sx) | 0, y = (py[i] * sy) | 0;
      const g = oGen[cOrg[i]] * 3;
      const cr = gCol[g], cg = gCol[g + 1], cb = gCol[g + 2];
      for (let k = 0; k < nh; k++) {
        let xx = x + haloDX[k];
        if (xx < 0) xx += SW; else if (xx >= SW) xx -= SW;
        let yy = y + haloDY[k];
        if (yy < 0) yy += SH; else if (yy >= SH) yy -= SH;
        const idx = yy * SW + xx;
        const wt = haloW[k] * 0.085;
        const v = out[idx];
        const r = (v & 255) + (cr - (v & 255)) * wt;
        const gg = ((v >>> 8) & 255) + (cg - ((v >>> 8) & 255)) * wt;
        const bb = ((v >>> 16) & 255) + (cb - ((v >>> 16) & 255)) * wt;
        out[idx] = 0xff000000 | ((bb | 0) << 16) | ((gg | 0) << 8) | (r | 0);
      }
    }
    // cells: role colour, alpha composited as in Particle Life
    const nd = discW.length;
    for (let i = 0; i < n; i++) {
      const x = (px[i] * sx) | 0, y = (py[i] * sy) | 0;
      const c = roleCol[cRole[i]];
      const cr = c[0], cg = c[1], cb = c[2];
      for (let k = 0; k < nd; k++) {
        let xx = x + discDX[k];
        if (xx < 0) xx += SW; else if (xx >= SW) xx -= SW;
        let yy = y + discDY[k];
        if (yy < 0) yy += SH; else if (yy >= SH) yy -= SH;
        const idx = yy * SW + xx;
        const wt = discW[k];
        const v = out[idx];
        const r = (v & 255) + (cr - (v & 255)) * wt;
        const gg = ((v >>> 8) & 255) + (cg - ((v >>> 8) & 255)) * wt;
        const bb = ((v >>> 16) & 255) + (cb - ((v >>> 16) & 255)) * wt;
        out[idx] = 0xff000000 | ((bb | 0) << 16) | ((gg | 0) << 8) | (r | 0);
      }
    }
  }

  // ---------- the leading genome, for the panel ---------------------------

  function leadGenome() {
    const g = census.lead;
    if (g < 0 || gRef[g] === 0) return null;
    const grow = [], kin = [], foreign = [];
    let total = 0;
    for (let r = 0; r < ROLES; r++) total += gGrow[g * ROLES + r];
    for (let r = 0; r < ROLES; r++) grow.push(total > 0 ? gGrow[g * ROLES + r] / total : 0);
    for (let a = 0; a < ROLES; a++) {
      for (let b = 0; b < ROLES; b++) {
        const kk = a * 8 + b, kf = a * 8 + 4 + b;
        kin.push(gMask[g] & (1 << kk) ? gEff[g * SLOTS + kk] : null);
        foreign.push(gMask[g] & (1 << kf) ? gEff[g * SLOTS + kf] : null);
      }
    }
    return {
      rules: gRules[g], size: gSize[g], cells: census.leadCells,
      colour: `rgb(${gCol[g * 3]},${gCol[g * 3 + 1]},${gCol[g * 3 + 2]})`,
      grow, kin, foreign,
    };
  }

  const S = {
    ...meta,
    params,
    presets,

    // live figures for the panel; ui.js renders these if present
    census() {
      const total = Math.max(1, census.cells);
      return {
        // the mean rule count is the readout's metric, so only the max here
        rows: [
          ['organisms', String(census.orgs)],
          ['genotypes', String(census.genotypes)],
          ['generation', String(census.maxGen)],
          ['most rules', String(census.maxRules)],
          ['symbiotic', `${Math.round(census.symbiotic * 100)}%`],
          ['fusions', String(census.fusions)],
          ['largest body', `${census.largest} cells`],
        ],
        mix: ROLE_INFO.map((r, k) => ({ name: r.name, colour: r.hex, frac: census.roles[k] / total })),
        genome: leadGenome(),
        cap: p.rules,
        roles: ROLE_INFO.map((r) => r.name),
        colours: ROLE_INFO.map((r) => r.hex),
      };
    },

    init(cwid, chei) {
      const aspect = (cwid || 16) / (chei || 9);
      worldW = aspect; worldH = 1;
      if (!px) alloc();
      buildCells();
      buildSurface(aspect);
      applyPreset(0);
    },

    step,
    paintInto,

    render(ctx) {
      paintInto(surf.u32);
      surf.blit(ctx, { smooth: true, mode: 'stretch' });
    },

    mapPointer(pxx, pyy, cwid, chei) { return surf.toLocal(pxx, pyy, cwid, chei, 'stretch'); },

    seed(nxn, nyn) {
      // inoculate: a stranger with a random genome, dropped where you point
      if (rng() > 0.35) return;
      const g = randomGenome(rng());
      if (g >= 0) spawnOrg(g, nxn * worldW, nyn * worldH, 3, CELL_COST);
    },

    reset() {
      rng = makeRng();
      presets[current].seed();
    },

    metric() {
      return { label: 'rules in use', value: census.meanRules, text: census.meanRules.toFixed(2) };
    },

    grab() { paintInto(surf.u32); return { data: surf.u32, w: SW, h: SH }; },
    stats() { return { ...census, roles: Array.from(census.roles), cells: n, tick }; },
    // Pool invariants, for tests: every living organism holds exactly one
    // genome reference, and a genome is live exactly when referenced.
    audit() {
      let orgs = 0, refs = 0, referenced = 0, cells = 0;
      for (let o = 0; o < orgHi; o++) if (oAlive[o]) orgs++;
      for (let g = 0; g < GCAP; g++) { refs += gRef[g]; if (gRef[g] > 0) referenced++; }
      for (let i = 0; i < n; i++) if (oAlive[cOrg[i]]) cells++;
      return { orgs, orgLive, refs, referenced, gLive, cells, n, free: gFreeN };
    },
    // organism sizes, ages and energies, for measuring outside a browser
    organisms() {
      const out = [];
      for (let o = 0; o < orgHi; o++) {
        if (!oAlive[o] || oSize[o] === 0) continue;
        out.push({ size: oSize[o], genome: oGen[o], adult: gSize[oGen[o]], age: oAge[o], e: oE[o], inc: oInc[o], rules: gRules[oGen[o]] });
      }
      return out;
    },
    applyPreset,
    get preset() { return current; },
    setParam,

    resize(cwid, chei) {
      const aspect = cwid / chei;
      const scale = aspect / worldW;
      for (let i = 0; i < n; i++) px[i] *= scale;
      worldW = aspect;
      buildCells();
      buildSurface(aspect);
    },

    dispose() {
      if (surf) surf.dispose();
      surf = null;
      px = py = vx = vy = cOrg = cRole = cCool = dead = null;
      fx = fy = nAll = nLeaf = nBurn = nLeafX = nBurnX = prey = cGen = cHue = items = null;
      oGen = oE = oAge = oLife = oGrowT = oStarveT = oAlive = oBirth = oGenN = null;
      oSize = oCount = oCx = oCy = oRad = oUp = oInc = oPart = orgStart = orgItems = oFree = null;
      gEff = gMask = gGrow = gSize = gHue = gRules = gRef = gCol = gCells = gFree = null;
      cellStart = cellCount = null;
    },
  };
  return S;
}
