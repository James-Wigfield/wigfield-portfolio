# life/ — notes from the life agent

Decisions (one line each + why), then the API as built. The lead merges these
into `DECISIONS.md`.

## Files

| File | What |
|---|---|
| `index.js` | entry: re-exports `createLifeHost`, `TICK`, `BUDGET`, `HIST_EDGES`, `PALETTE_IDS` |
| `host.js` | the host (CONTRACTS §4): domain, system assignment, fixed ticks + budget, painting, raw frame, stats |
| `domain.js` | one cell grid over every patch at one ppm; masks; seam neighbour table; halo lookups; `nbFor()` |
| `systems/grayScott.js` `physarum.js` `particleLife.js` `lenia.js` | adapted copies of `public/artificial-life/src/systems/*` (provenance headers) |
| `creatures.js` | Plate VII prototype: gaits, falls, selection, detritus, histograms |
| `fall.js` | world-space ballistic flight + landing (creatures, peeled particles, waste) |
| `draw.js` | rasterises creature/detritus glyphs into patch buffers, spilling across seams |
| `palettes.js` | neon / ember / aurora / bio / mono, all starting at pure black |
| `lib/rng.js` `lib/palette.js` | copies of the cabinet's helpers (provenance headers); `lib/geom.js` seam maths |

## Decisions

- **One global domain, one index space.** Every patch's grid is laid end to end, so each field is one Float32Array and a seam neighbour is just another index. Why: seam exchange for grid sims becomes a table lookup; no per-patch special cases.
- **Grid sims exchange edge cells across seams (no soft-fade fallback needed).** 4-neighbour table built from `seam.M` (unfolding isometry, equal ppm); measured ~5.5k cross-patch links. Why: it was solid — slime veins and Lenia ridges run continuously over the eave, hips and corners (looked at in the unfolded net PNGs).
- **A seam to a patch running another system is a zero-flux wall** (`domain.nbFor(ownedMask)`). Why: with Dirichlet "empty" neighbours, Gray-Scott drift poured empty substrate in from the eave and washed the walls clean (measured mean v 0.12 → 0.01).
- **Gray-Scott drift = upwind advection of u and v together along g_t**, 0.12 cells/step at drift 1. Why: u at half speed tore the spots apart; together, drops travel intact. Pitch enters through |g_t| = sin(pitch); none on the floor.
- **Gray-Scott "rain".** While drift is on, single nuclei land along each patch's upstream band (top of walls, apex end of facets) ∝ drift × |g_t|. Why: a drifting Turing pattern with no source washes off a wall in < 1 min; real rain on glass has a source. Default wall preset changed to `worms` ("Rain"): coral fills the wall and locks into flow-aligned stripes.
- **Physarum parameters in metres** (sensor 0.09 m, step 0.025 m) and the default `network` re-tuned by eye (sensor angle 30°, decay 0.06, turnover 0.004). Why: the cabinet's 22.5°/9 px coarsened to three or four trunks on a 4 m floor; this holds a cellular reticulum with capillaries.
- **Physarum sensing reads through a padded halo table** (`domain.halo`) so probes see across seams; agents cross with position via `seam.M` and heading + `mapAngle(M)`. Blocked (mask, seamless edge, another system) → Jones' rule: random heading, stay.
- **Geotaxis turns the heading** toward (down) / away from (up) g_t by up to 15° × strength × |g_t| per step. Why: independent of trail magnitude, so the sign reads the same on any preset.
- **Particle Life: ghost particles across seams + crossing.** Each patch's hash also holds neighbours' particles within rmax of a shared edge. Why: clusters don't feel a cut at the hips.
- **Particle Life is sparser and wider than the cabinet** (115 particles/m², rmax 0.26 m, one step per 30 Hz tick with friction rate-corrected). Why: cost 6 ms → 1.2 ms per tick; clusters still form and read as blobs from across the room.
- **Particle Life gravity + grip:** six castes with fixed grips (0.25…1.4); slide ∝ g_t × (1 − 0.7 grip); floor press-in adds friction; facets peel particles off when pull > grip × (0.6 + 0.12 × neighbours). Peeled particles fall in world space and land: join a PL patch, or dab food into the patch's system ("spores").
- **Lenia runs direct convolution on a half-resolution domain** (pruned ring kernel, ~88 taps, R ≈ 0.28 m), steps every k-th tick if over budget. Why: the cabinet's FFT needs a periodic power-of-two torus; patches are neither. No `life.leniaPreset`/`life.leniaPalette` keys exist, so it reads them if present, else `labyrinth` + the Gray-Scott palette.
- **Fixed 30 Hz ticks, ≤ 4 per step() call, 9 ms budget, debt dropped.** Why: heavy settings slow the sim instead of stalling (measured: heavy scene 90 ticks/s asked → keeps frames < 16 ms).
- **Budget split by area inside each system:** Physarum ≤ 45k agents (0.35 per live cell), Particle Life ≤ 6k particles, Lenia ≤ 2.6M taps/tick. Why: one global cap, any assignment.
- **Rebuild by patch ID, lazily.** `setPatches()` marks dirty; the rebuild happens on the next `step()`/`surfaces()`; systems re-bind fields by local position and ownership by ID. Why: the loft (and any patch) can disappear (bug report from the room agent, fixed); apex drags coalesce to one rebuild per frame (5–20 ms).
- **Surfaces entries are replaced when w/h/ppm change** (new object + data), otherwise reused. Why: projection can keep its DataTexture until the size changes.
- **Creature world runs at toy gravity 0.3 g (× cr.gscale).** Why: at 1 g a 22 cm pendulum swings at 1 Hz and an eave fall lasts 0.68 s — too fast to read on a wall.
- **Hold model:** an adhesive foot holds 0.4 body weights in shear (walls) and 0.45 × that against peel (ceiling); a hooked hand holds 2.6 (a gibbon peaks near 2), up to 60 % more when the rope runs along the surface. Why: walls select for planted feet × grip; the roof makes swinging the economic gait; pitch changes ceiling outcomes.
- **Ceiling gait = pendulum hang + brachiation only** (an inverted crawl only on arrival from a wall). Why: the brief's ceiling gait; with a safe crawl option selection evolved 8-footed super-grip crawlers instead.
- **Swing trait = propensity:** keen swingers rest less, swing higher (release 30° + 25° × s past the rest point) and browse a wider circle; long arms cost upkeep. Why: it then trades risk for food on the roof and is pure cost on the floor.
- **Release is measured from the pendulum's rest point**, not the anchor, and a catch carries the flight direction on. Why: on a pitched facet the body hangs downslope, so uphill travel pumped to huge amplitudes and tore its grip (traced).
- **Fecundity selection: vacancies are filled by a parent chosen ∝ stored energy²;** crowding culls the hungriest (not the oldest). Why: culling the oldest let falls and slides replace natives with migrants, homogenising the habitats.
- **Falls kill only on a hard landing** (mass × gscale × drop > 1.6). Light creatures survive a roof fall and join the floor.
- **Genes are relative to the sliders** (grip = cr.grip × gene, feet = cr.feet + gene…). Why: sliders act live and evolution keeps its gains.
- **Food = the sim under the creature** (GS v, Physarum trail, PL glow, Lenia A) averaged over a ±4 cm mouthful, + 0.3 ambient, depleted where grazed (10 cm cells, regrowing 12 %/s). Why: links creatures to the sims; ambient lets them live on black patches.
- **Creature glyphs are drawn into the buffers** (body, legs, white planted feet, dim lifted feet, white head dot, red when slipping, white swing arm + anchor) at ~30 cm span, spilling across seams.
- **airborne() returns a reused array** of reused objects (valid until the next call). Why: no per-frame garbage.
- **Raw frame = a separate 8 × 4.5 m "wall" at 40 px/m (320 × 180)** running `life.sys.wall` with wall gravity; it only simulates while `frame()` was called in the last 1.5 s. Row 0 is the BOTTOM of the projector image (same convention as the patches).

## Honesty line for the UI

> The three gaits (crawl, insect stepping, pendulum swinging) are hand-written; selection only tunes each creature's numbers (feet, grip, mass, swing, flight time). The real Plate VII would evolve the gaits themselves.

## API as built (CONTRACTS §4 plus additions)

```js
import { createLifeHost } from './life/index.js';
const life = createLifeHost({ patches, landing, values, seed? });   // seed: optional uint, deterministic runs
life.setPatches(patches)            // lazy: rebuilt on the next step()/surfaces(); any ids may come or go
life.setParams(values, changedKeys) // life.*, cr.*, region.<id>.*, map.mask.*; other keys ignored
life.step(dtSeconds)                // fixed 30 Hz ticks × life.speed, ≤ 4 per call, 9 ms budget
life.surfaces()  → Map<patchId, { w, h, ppm, data: Uint8Array RGBA, version }>   // entry replaced if w/h/ppm change
life.frame()     → { w: 320, h: 180, data, version }   // row 0 = bottom of the image
life.airborne()  → [{ x, y, z, r, color: [r,g,b] 0..1 }]   // reused array/objects
life.seed(patchId, x, y) → { patchId, x, y, system } | null   // + a creature if that habitat has room
life.reseed(); life.clear();
life.stats() → {
  simMs, tickMs, tick, tickRate,                       // simMs = EMA ms per step() call
  populations: { floor, wall, ceiling },               // CREATURES per habitat (current surface)
  particles:   { floor, wall, ceiling },               // Physarum agents + PL particles per habitat
  creatures: { alive, born, died, fell, landed, onAir, starved, hardLandings, aged, slips, slid,
               releases, catches, misses, crossings, culled, pellets, scavenged, detritus,
               fallWhy, fallsFrom, crossKinds, deaths, energyFlow, modes, simTime },
  histograms: { feet|grip|mass|swing|flight: { edges, floor, wall, ceiling } },   // counts
  means: { floor|wall|ceiling: { feet, grip, mass, swing, flight } },
  seams: { physarum, particles, creatures },          // crossings so far
  systems: { grayscott: {meanV}, physarum: {agents, crossings, crossKinds, coverage},
             particlelife: {particles, crossings, crossKinds, detached, sporesLanded},
             lenia: {mass, every, taps, R} },
  assignment: { [patchId]: 'grayscott'|'physarum'|'particlelife'|'lenia'|'off' },
  ppm, lastSeed,
}
life._debug()   // checks only: { D, sys, creatures, sysOf, habOf, rng }
life.dispose()
```

## Proposed contract additions (for the lead)

- `params.js`: `life.leniaPreset` (labyrinth / soup / bubbles) and `life.leniaPalette` — the host already reads them.
- CONTRACTS §4: `seed` option, `stats().particles/means/assignment`, `frame()` row order (row 0 = bottom), `airborne()` array reuse, `surfaces()` entry replacement on resize.
- `cr.flight` default changed 0.35 → 0.2 s, range 0–0.8 (0.35 s under toy gravity drops the body out of reach of the next grip).

## params.js changes (options / defaults / ranges / hints only)

- `life.gsPreset`: default `coral` → `worms`; labels Rain (worms) / Droplets (mitosis) / Coral (fills, then streaks) / Front (one line); hint.
- `life.physPreset` labels: Network / Long veins / Rings (one per surface). `life.plPreset` labels: Cells (shelled) / Chasers (chase cycle) / Diatoms (rings).
- Hints on `life.speed`, `life.substeps`, `life.gravity`, `life.drift`, `life.geotaxis`, `cr.feet`, `cr.grip`, `cr.mass`, `cr.swing`, `cr.flight`, `cr.gscale`, `cr.selection`, `cr.mutation`, `cr.detritus`.
- `cr.flight`: default 0.35 → 0.2, max 1.5 → 0.8.

## Checks

- `node tools/projector-life/sim-check.mjs` (≈ 4 min; `--quick` skips the 2 × 4 sim-min evolution run). Last run: 19 PASS, 0 WARN, 0 FAIL.

## Measured (2026-11-18, this PC)

- Default scene, browser (Edge d3d11, `/portal/projector-life`): life `simMs` ≈ 0.85–1.0 ms per frame, 3.8–5 ms per 30 Hz tick, 30 ticks/s held, page 130–150 fps.
- Default scene, Node: 1.9 ms per 60 Hz frame, 4.9 ms per tick (Node lacks the browser's warm JIT profile; the browser is faster).
- Worst tick, one system on every patch: Gray-Scott 1.6, Physarum 1.9, Particle Life 3.9, Lenia 7.3 ms.
- Heavy (Physarum everywhere, ×4 substeps, ×3 speed, 180 creatures): 9.4 ms/frame avg, ticks capped (162 of 270 asked per s), no stall.
- Pitch, uniform roof population (genes = 1, 30 creatures, grip 1): apex 2.7 / 3.3 / 4.2 → falls 1.6 / 2.9 / 5.9 and catches 37 / 29 / 16 per creature-minute; Particle Life peel-offs 122 / 113 / 85 per minute. Steeper = less pull-off (fewer particles peel, hooks hold better) but the downslope pull speeds swings and flights downhill, so more catches fail.
- Evolution (4 sim-min × 2 seeds, default scene): grip floor / wall / roof 1.01 / 1.80 / 1.52 — the robust split (gripping is wasted on the floor). Swing and mass splits are real but seed-dependent with populations of 10–15 (genetic drift, and survivors of roof falls join the floor). Bigger populations (cr.* up to 60) make the histograms steadier.

## Looked at (PNG dumps of the buffers, unfolded net; scratchpad `life-png/`)

- `default45-net.png`: rain drips from the eave down every wall, stopping cleanly at the door/window/loft masks; physarum on the floor and loft; particle castes on the roof settling on the eave ledge.
- `gs-presets-d0.35.png`: coral grows fingers down from the eave then locks into stripes; worms = rain on glass; mitosis = droplets.
- `phys-sweep.png`: the old network coarsened to 3–4 trunks; the new one holds cells + capillaries.
- `slime40-net.png`: veins continuous over the eave, hips, corners and wall→floor.
- `lenia40-net.png`: labyrinth ridges continuous across seams (loft soup died out).
- `swingers*-roof-W.png`, `default45-wall-E.png`, `default45-floor.png`: creatures legible (body, legs, white planted feet, head dot; red while slipping; hanging bodies on a white arm below a white anchor).

## Unfinished / known

- Lenia has no preset/palette keys (proposed above); its loft deck can die out from soup.
- Habitat divergence beyond grip is noisy at default population sizes (see Measured).
- Creature glyphs are ~30 cm; at 40 px/m that is ~12 px — legible in 3-D, crisper at 64 px/m.
