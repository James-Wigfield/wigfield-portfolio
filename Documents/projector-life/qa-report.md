# Projector Life — QA report

QA agent, 2026-11-18. Branch `feat/projector-life` (worktree `.claude/worktrees/projector-life`). The
first runs were on `e4717a6`. The lead landed `4c73cc2`, `f8726ce` and `0854bfe` (code-review fixes)
during the pass, so **every number, table and screenshot below is from a final re-run on `0854bfe`**
unless it is marked otherwise. Dev server `http://localhost:5191`, headless Edge on the real GPU
(`--use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist`), puppeteer-core 25, through the portal
gate. No product code was changed by QA.

Tools (all lint-clean: `npx eslint tools/projector-life`):

| Tool | Run | What |
|---|---|---|
| `tools/projector-life/page-check.mjs` | `node tools/projector-life/page-check.mjs [outDir]` (`ONLY=load,fps,…`, `SITE_URL`, `UNCAPPED=1`) | PASS/FAIL table, exit 1 on any FAIL; `results.json` + the saved PNG in `Documents/projector-life/screenshots/page-check/` |
| `tools/projector-life/shots.mjs` | `node tools/projector-life/shots.mjs [outDir]` (`ONLY=presets,stage,tabs,coral,mcp`, `THEMES`, `WIDTHS`, `SETTLE`) | every preset × theme × width, Plan (every sub-section) + Applications, coral, stage-only heroes, MCP drawer |
| `tools/projector-life/soak.mjs` | `node tools/projector-life/soak.mjs [outDir]` (`SOAK_MIN`, `CYCLE_S`, `SAMPLE_S`) | default preset ~5 min + every preset 20 s, sampled every 10 s → `soak.csv` / `soak.json` in `screenshots/soak/`, exit 1 on any flag |
| `tools/projector-life/qa-kit.mjs` | (shared) | launch, portal-gate seeding, WebGL-context ledger, rAF counter, preset-by-click, canvas-light sampling, heap/renderer sampling |

## Page check — `0854bfe`, 53 PASS · 1 FAIL

`node tools/projector-life/page-check.mjs` against HEAD `0854bfe` (the lead's code-review fixes),
headless Edge on the real GPU, 1440 × 900 unless stated. Results JSON:
`Documents/projector-life/screenshots/page-check/results.json`.

- **Load:** live render (stage ready, life ticking, ≥ 5 % of the stage lit) in **1.80–2.14 s** from
  navigation on a cold browser cache (two full runs), **0.92–1.0 s** warm. Nothing above the stage
  but the tab bar; the stage fills 79 % of the viewport after the opening glide (desktop).
- **fps (vsync-capped headless, 1440 × 900, in-page rAF counter, 5–6 s per scene):** every preset
  holds the **≈ 145 fps** headless cap: default 145.0 (6 s right after load), living shed 145.1,
  slime 144.8, coral 144.9, swingers 144.9, food web 145.2, reality check 145.2, two-projector
  144.9. Frame gaps p99 ≤ 7.5 ms, none over 20 ms. CPU per frame 0.73–1.38 ms; sim tick
  1.7–4.8 ms right after a preset is applied (but see the soak: the default scene's tick cost grows
  over minutes).
- **Roof:** the apex slider moves pitch 11.7° ↔ 41.8°, and the roof patches' |g_t| goes 0.202 → 0.667
  and g_n −0.979 → −0.745. Over equal sim time (2 runs × 60 s each, ticks equal), going from 2.7 m to
  4.2 m changes Particle Life peel-off **254 → 148 (−42 %)** and creature swing releases
  **954 → 383 (−60 %)**. Creature roof falls 20 → 35 is noisy run to run (an earlier run gave
  27 → 22).
- **Only FAIL:** at 390 × 844 the opening glide parks the tab bar under the sticky portal header
  (tab bar 39–81 px, header bottom 101 px). See visual problem #2.

| check | result | what | measured |
|---|---|---|---|
| load | PASS | live render (stage ready, life ticking, canvas lit) in 2.14 s — target ≈ 2 s, FAIL > 4 s (cold browser cache) | ticking at 1960 ms, 38 % of the stage lit at 2143 ms (screenshot latency included), DOMContentLoaded 1174 ms |
| load | PASS | nothing in the module above the stage except the tab bar (DOM order + boxes) | clean |
| load | PASS | after the opening glide the whole stage is in view and fills most of the viewport | stage 168–882 px of 900 (79 %), tab bar 109–154 vs the sticky header's bottom 111, scrollY 250 |
| load | PASS | default preset "The living shed" on stage (name, tab-bar status, cutaway view, values) | The living shed · The living shed · cutaway |
| load | info | warm reloads (HTTP cache primed): stage ready + ticking | 962 ms, 844 ms |
| fps | PASS | default preset ≥ 45 fps at 1440×900 (in-page rAF counter, 6.0 s) | 145.0 fps · Stage 144.5 fps · frame 1.16 ms (CPU) · sim 0.76 ms/frame, 3.54 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.5 / max 7.8 ms, 0 > 20 ms |
| presets | PASS | 01 The living shed: applies by click — name, blurb, values, cutaway view, no errors | ok |
| fps | PASS | The living shed: 145.1 fps (≥ 45) | Stage 144.7 fps · frame 1.10 ms (CPU) · sim 0.72 ms/frame, 3.56 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.5 / max 8.0 ms, 0 > 20 ms |
| presets | PASS | 02 Slime-mould shed: applies by click — name, blurb, values, armchair view, no errors | ok |
| fps | PASS | Slime-mould shed: 144.8 fps (≥ 20) | Stage 145.5 fps · frame 1.21 ms (CPU) · sim 0.50 ms/frame, 2.52 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.5 / max 7.6 ms, 0 > 20 ms |
| presets | PASS | 03 Coral walls, dripping: applies by click — name, blurb, values, door view, no errors | ok |
| fps | PASS | Coral walls, dripping: 144.9 fps (≥ 20) | Stage 145.4 fps · frame 1.02 ms (CPU) · sim 0.56 ms/frame, 1.91 ms/tick at 42 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.5 / max 7.6 ms, 0 > 20 ms |
| presets | PASS | 04 Ceiling swingers: applies by click — name, blurb, values, loft view, no errors | ok |
| fps | PASS | Ceiling swingers: 144.9 fps (≥ 20) | Stage 144.8 fps · frame 0.73 ms (CPU) · sim 0.34 ms/frame, 1.71 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.4 / max 7.6 ms, 0 > 20 ms |
| presets | PASS | 05 Room food web: applies by click — name, blurb, values, cutaway view, no errors | ok |
| fps | PASS | Room food web: 145.2 fps (≥ 20) | Stage 144.4 fps · frame 0.88 ms (CPU) · sim 0.40 ms/frame, 1.86 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.2 / max 7.6 ms, 0 > 20 ms |
| presets | PASS | 06 Projector reality check: applies by click — name, blurb, values, cutaway view, no errors | ok |
| fps | PASS | Projector reality check: 145.2 fps (≥ 20) | Stage 145.0 fps · frame 1.38 ms (CPU) · sim 1.01 ms/frame, 4.77 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.5 / max 7.7 ms, 0 > 20 ms |
| presets | PASS | 07 Two-projector rig: applies by click — name, blurb, values, cutaway view, no errors | ok |
| fps | PASS | Two-projector rig: 144.9 fps (≥ 20) | Stage 145.1 fps · frame 1.22 ms (CPU) · sim 0.77 ms/frame, 3.46 ms/tick at 30 ticks/s · frame gaps p50 7.0 / p95 7.1 / p99 7.4 / max 7.5 ms, 0 > 20 ms |
| presets | PASS | the ‹ › arrows on the stage cycle the scenes (and wrap) | → Slime-mould shed; ← ← Two-projector rig |
| roof | PASS | the apex slider (keyboard Home / End) sets 2.70 m and 4.20 m and stats.pitchDeg follows | 3.3 m 25.7° → 2.7 m 11.7° → 4.2 m 41.8°; readout "2.70 m · 11.7°" / "4.20 m · 41.8°" |
| roof | PASS | roof patches rebuild: steeper roof = more downslope g_t, less peel-off g_n | /g_t/ 0.202 → 0.667, g_n -0.979 → -0.745, facet pitch 11.7° → 41.8° |
| roof | info | apex 2.70 m (11.7°), 2 × 1800 ticks | peel 134, roof falls 13 (all falls 16), releases 458, catches 373, misses 1, PL on roof at end 3380 // peel 120, roof falls 7 (all falls 9), releases 496, catches 412, misses 2, PL on roof at end 3371 |
| roof | info | apex 4.20 m (41.8°), 2 × 1800 ticks | peel 64, roof falls 17 (all falls 19), releases 213, catches 140, misses 4, PL on roof at end 4712 // peel 84, roof falls 18 (all falls 22), releases 170, catches 100, misses 2, PL on roof at end 4202 |
| roof | PASS | the apex visibly changes ceiling behaviour over equal sim time (≥ 25 % change in roof peel-off, roof falls or swing releases) | 2.7 m → 4.2 m: Particle Life peel-off 254 → 148 (-42 %), creature roof falls 20 → 35, swing releases 954 → 383 (-60 %) — sums of 2 runs × 60 s sim; ticks equal: true |
| seed | PASS | a click (not a drag) on a lit wall in the cutaway seeds life there (_stats().lastSeed) | wall-NE (coverage 89 %) at (921, 394) → lastSeed wall-NE local [0.54, 1.69] · hint "seeded · Wall NE — click again" |
| seed | PASS | a drag (orbit) on the same wall does not seed |  |
| png | PASS | Save PNG downloads a blob that is a non-empty, non-black PNG | projector-life-living-shed.png · blob:http://… · 446587 bytes · 778×714, 36 % lit |
| tabs | PASS | the MCP preview drawer opens and its JSON parses (one call per line) | 42 calls (bar says 42) · tools: set_projector, describe_region, set_climate, set_region_life, introduce_species, seed_region |
| tabs | PASS | pretty-printed JSON parses too | 42 |
| tabs | PASS | Plan tab renders (and the stage is gone: canvas removed, 0 live WebGL contexts) | 688 px tall, 2 SVGs, ~177 words; stage canvas present: false; live GL contexts 0 |
| tabs | PASS | Plan: all 5 sub-sections render (Phases · Architecture · Risks · What it showed · Ask him) | Phases 396px/103w/1svg, Architecture 765px/162w/2svg, Risks 792px/205w/0svg, What it showed 1003px/386w/0svg, Ask him 479px/105w/0svg |
| tabs | PASS | Plan: the phase timeline shows each of its 7 phases | 0. Read his repo, agree the interface · 1. Life as projected content · 2. The room model · 3. Cheap spatial wins · 4. Plate VII — life that evolves its grip · 5. Claude, the room’s naturalist · 6. The room looks back |
| tabs | PASS | Applications tab renders (and the stage is gone: canvas removed, 0 live WebGL contexts) | 1022 px tall, 8 SVGs, ~326 words, 8 cards; stage canvas present: false; live GL contexts 0 |
| tabs | PASS | arrow keys / Home / End move focus and selection along the top tabs (wrapping) | Plan:true, Applications:true, Visualiser:true, Applications:true, Visualiser:true, Applications:true, Visualiser:true |
| leaks | PASS | live WebGL contexts after 10 cycles (20 stage rebuilds): 1 | created 42, lost 39, collected 2 (start: created 2, lost 1); live: [{"type":"webgl2","cls":"pjl-canvas","connected":true}] |
| leaks | PASS | every stage the switches created released its context (webglcontextlost, or its canvas was collected first) | +40 created (2 per mount: React StrictMode mounts twice in dev), +38 lost events, +2 collected before the event |
| leaks | PASS | renderer.info of the fresh stage ≤ the first stage (geometries / textures / programs) | first 99 / 23 / 13 → fresh 99 / 23 / 13 |
| leaks | PASS | disposed stages are garbage-collectable (no lost-context canvas still reachable after a forced GC) | 0 of 39 disposed stage canvases still reachable |
| leaks | PASS | no document-level listeners left behind (keydown on document, via CDP) | document listeners 5 → 5; keydown 1 → 1 |
| leaks | PASS | JS heap roughly flat after 20 rebuilds (forced GC; FAIL ≥ 25 MB) | 110.6 MB → 114.8 MB → 115.0 MB after a further settle (+4.4 MB); a cycle took 1933 ms |
| layout | PASS | 1440: after the opening glide the tab bar sits below the sticky portal header (visible) and the stage is in view | header bottom 111, tab bar 109–154, stage 168–882 of 900, scrollY 250 |
| layout | PASS | 1440×900: no horizontal page scroll | 0 px |
| layout | PASS | 1440: side panel sits beside the stage, not over it | stage 778×714, panel 316 px wide at x 1079 |
| layout | PASS | 1440: panel text readable (HTML ≥ 8.5 px — the mono micro-labels are 0.56–0.6 rem by design — SVG labels ≥ 8 px rendered, nothing clipped without an ellipsis) | smallest HTML 8.96px "on"; smallest SVG label ≈ 9.2px "25.7°" |
| layout | PASS | 1440: projector-output inset, net inset and overlay blocks never collide (all 7 presets) | clean |
| layout | **FAIL** | 390: after the opening glide the tab bar sits below the sticky portal header (visible) and the stage is in view | header bottom 101, tab bar 39–81, stage 95–619 of 844, scrollY 3201 |
| layout | PASS | 390×844: no horizontal page scroll | 0 px |
| layout | PASS | 390: the controls are a drawer below the stage | stage 340×523 ends at 619, panel starts at 619 |
| layout | PASS | 390: panel text readable (HTML ≥ 8.5 px — the mono micro-labels are 0.56–0.6 rem by design — SVG labels ≥ 8 px rendered, nothing clipped without an ellipsis) | smallest HTML 8.96px "on"; smallest SVG label ≈ 9.2px "25.7°" |
| layout | PASS | 390: projector-output inset, net inset and overlay blocks never collide (all 7 presets) | clean |
| reduced | PASS | prefers-reduced-motion: the stage renders and is alive | 38 % lit |
| reduced | PASS | prefers-reduced-motion: views (buttons and presets) switch instantly, on the next frame | Door: 0.0000 m · Plan: 0.0000 m · Loft: 0.0000 m · Cutaway: 0.0000 m · preset → loft: 0.0000 m |
| storage | PASS | with localStorage throwing, the page still renders a live stage | 38 % lit |
| storage | PASS | with localStorage throwing, presets and the Plan tab still work | 688 px |
| console | PASS | zero console errors and warnings attributable to the page across the whole run | excluded 0 (none) |

## Soak

`node tools/projector-life/soak.mjs`: the default preset for 5 min, then each preset for 20 s,
then back to the default; samples every 10 s (rAF fps over the window, Stage `frameMs`, life `simMs`
and `tickMs`, `renderer.info`, JS heap after a forced GC). Output in
`Documents/projector-life/screenshots/soak/soak.{csv,json}` (from the `0854bfe` run).

| | soak 1 (straddled `e4717a6` → `0854bfe`) | soak 2 (`0854bfe`) |
|---|---|---|
| Default preset fps, mean (min) | 144.7 (140.9) | **136.7 (116.3)** |
| fps, first min → last min | 145.2 → 144.9 (−0.2 %) | **145.1 → 118.7 (−18 %)**: FLAG |
| Sim **tick** cost (ms per 30 Hz tick), start → end | 7.7 → 8.6 | **4.1 → 12.5** |
| Particles (Physarum agents + Particle Life), start → end | ~10.7 k flat | **9.2 k → 12.3 k** |
| Heap (after GC) | 109.4 → 110.1 MB (+0.13 MB/min) | 109.3 → 110.0 MB (+0.11 MB/min) |
| `renderer.info` geometries / textures / programs | 99 / 23 / 13 flat | 99 / 23 / 13 flat |
| Every preset, 20 s each | 144.8–145.3 fps | 145.0–145.4 fps |
| Back to the default after the cycle | geo 99 → 104, tex 23 → 28, prog 13 → 17 (FLAG, bounded) | same (FLAG, bounded) |
| Console | 0 | 0 |

**The default scene gets slower the longer it runs (soak 2).** The life host's own per-tick cost
rises steadily as the particle population grows. It passes the host's 9 ms budget at about
2.5 min, and after that the frames that carry a tick overrun the headless 6.9 ms (145 Hz) frame and
fps falls to about 118. On a 60 Hz screen a 12 ms tick still fits a 16.7 ms frame, so this shows up
as dropped sim ticks rather than dropped frames. On a 120/144 Hz screen it's visible stutter.

**What grows (10-minute probe on `0854bfe`, default preset, sampled every 30 s):** Physarum is
fixed at 7,013 agents on the floor. The growth is **Particle Life on the roof**: 2.1 k at load,
3.1 k at 30 s, about 3.7 k by 2 min, then flat at 3.6–3.9 k and a 7.7–8.8 ms tick (145 fps) until
about 9 min, when it jumps again to 4.3 k and 4.6 k. At that point the tick is 9.9 → 10.3 ms, fps is
138 → 130, and the p99 frame gap doubles from 7.5 to 14 ms. Peel-off (719) and spores (538)
accumulate steadily. In soak 2 the same climb happened inside 5 minutes (Particle Life ≈ 5.3 k, tick
12.5 ms). Tick cost grows faster than particle count (3.1 k → 5.7 ms; 3.8 k → 8 ms; 4.6 k → 10.3 ms),
which suggests denser clusters (more neighbours per particle). The 6 k Particle Life budget is too
high to keep the default scene inside the 9 ms tick budget. A lower cap, a neighbour cap, or
adaptive substeps on the roof would hold it. The fps bar (≥ 45) is still met with a lot of margin;
this is about smoothness on high-refresh screens and about the sim slowing down.

## Leaks (10 cycles = 20 stage rebuilds)

Each cycle: Visualiser → Plan → Applications → Visualiser, then away to "Dev Setup · Home PC" via the
sidebar and back to Projector Life (fresh page, arcade 1440 × 900, `--expose-gc`, forced GC before
every heap read, document listeners counted over CDP `DOMDebugger.getEventListeners`).

| Measure | `e4717a6` (first run) | `0854bfe` (current HEAD) |
|---|---|---|
| Live WebGL contexts after the cycles | 1 | **1** (the current `pjl-canvas`) |
| Contexts created / released | +40 / +40 | +40 / +40 (2 per mount: React StrictMode double-mounts in dev, and the throwaway stage disposes itself when it resolves) |
| `renderer.info` of the fresh stage vs the first (geometries / textures / programs) | 99 / 23 / 13 → same | 99 / 23 / 13 → same |
| Disposed stage canvases still reachable after GC | **20 of 41** (every mounted stage) | **0 of 39** |
| `keydown` listeners on `document` | **1 → 21** | **1 → 1** |
| JS heap after the cycles + GC | see note | **+4.1 MB and +4.4 MB** (two runs; 108.8 → 112.9, 110.6 → 115.0 MB) |

**The leak that was real, now fixed in `0854bfe`.** On `e4717a6` every mounted Stage stayed reachable
after unmount. Retaining path from a heap snapshot:
`Window → document → keydown listener (capture) → bound OrbitControls._interceptControlDown →
OrbitControls._listeners.start[0] → closure → Stage` (and through `Stage.container`, the detached
Visualiser DOM and fiber tree). Cause: OrbitControls (three 0.185.1, `OrbitControls.js:505/524`) adds
that listener to `domElement.getRootNode()` in `connect()` and removes it from `getRootNode()` in
`disconnect()`. `Stage.dispose()` runs in a useEffect cleanup, after React has detached the canvas, so
`getRootNode()` no longer returns `document` and the listener stayed. The lead's `0854bfe` remembers
the root at init (`this._keyRoot`), removes keydown/keyup from it in `_teardown()`, and nulls the
Stage's references. Re-checked on `0854bfe`: all leak rows pass.

**Note on the heap number.** My first leak runs reported +49.5 MB on `e4717a6` and +47.9 MB on
`0854bfe`. Part of that was my own test: the "new stage ready" wait returned `window.__pjlStage.room`,
and puppeteer kept a JSHandle to every room it returned (a heap snapshot showed the rooms held by
DevTools global handles). The predicate now returns a boolean and disposes its handle. The clean
number on `0854bfe` is **+4.1 MB over 20 rebuilds**, which is flat. The `e4717a6` growth was the
retained stages plus my handles; I didn't re-measure the old commit separately.

**Bounded, not a leak (from the soak):** after the first full trip through all seven presets, the
default scene keeps geometries 99 → 104, textures 23 → 28 and programs 13 → 17, plus about 10 MB of
heap. Further trips don't add more (rounds 2–4 stay at 104 / 28 / 17, heap +0.3–0.6 MB per round).
This looks like per-projector outputs and depth targets (and compiled shader variants) kept after
`proj.count` drops back to 1. Fine as a cache; free them on count change if memory matters.

## Console

**Zero errors and zero warnings** from the page across every run: page-check (11 pages: load, presets,
roof, seed, PNG, tabs, leaks with 20 rebuilds, layout at two widths, reduced motion, broken storage),
shots (7 pages, 76 shots), and the soak (≈ 8 min). Captured: `console.error`, `console.warn`
(puppeteer type `warn`), `console.assert`, uncaught `pageerror`, and failed requests other than
aborted ones. No noise needed excluding. The exclusion list in `qa-kit.mjs` (React DevTools banner,
Vite HMR chatter) matched nothing.

## Visual review (every screenshot opened and looked at)

Screenshots: `Documents/projector-life/screenshots/` (JPEG q80; `stage-NN-*.jpg` are the canvas-only
heroes, overlay hidden). Every preset was applied by clicking it in the side panel's Scenes list and
given 7 s to settle. Stage coordinates below are in the 778 × 714 stage canvas at 1440 (the `stage-*`
files), page coordinates in the 1440 × 900 / 390 × 844 viewport shots.

### Ranked problems (worst first)

1. **"Ceiling swingers" is an empty hero shot.** The roof population collapses almost at once: the
   preset asks for 40 roof creatures. On `0854bfe`, 7 s after the click **9** are on the roof (46
   falls already), **1** at 20 s and **2** at 45 s (`life.stats().populations.ceiling`, measured live;
   on `e4717a6` it was 3 / 4 / 2). The loft view
   then shows a flat, uniformly lit brown roof with one to five 30 cm creatures (two shoot sets), and the loft camera's
   foreground is clutter: a red shape bottom-left and a black mass across the bottom-right fifth of the
   frame (stage-04 x 500–778, y 565–714). No fall is visible. The story on the card ("hang, swing, let
   go — and some of them fall") reads as "they all fell".
   `stage-04-ceiling-swingers.jpg`, `preset-04-ceiling-swingers-{arcade,jade}-{1440,390}.jpg`.
2. **Phone: the top tab bar ends up hidden under the sticky portal header.** After the opening glide
   at 390 × 844 the tab bar sits at 39–81 px, entirely behind the sticky header (0–101 px), and the
   stage starts 4 px under it, so Visualiser / Plan / Applications are invisible on a phone until
   you scroll back up. Cause (measured): `ProjectorLife.jsx` computes the scroll target at ≈ 0.8 s,
   then the content above the module shrinks by 67 px (the `.pjl` document top goes 3307 → 3240), so the
   glide overshoots by 67 px. At 1440 a fresh load lands within 2 px. A reload restores the old scroll
   offset and skips the glide, leaving the tab bar's top 18 px under the header (cosmetic).
   Every `preset-*-390.jpg`.
3. **"Coral walls, dripping" does not drip yet when the shot is taken.** 7 s after the click there are
   about six fuzzy blobs on the roof and the walls are blank (Gray-Scott mean v 0.06). It takes
   30–45 s to fill into the advertised streaks running down the facets and walls (mean v 0.11 at 20 s,
   0.16 at 45 s; the 45 s frame is a good hero). The patterns also show a soft halo at this camera
   distance (40 px/m magnified). `stage-03-coral-drip.jpg`, `preset-03-*`.
4. **"Projector reality check" at phone width: the coverage readout covers half the room.** The
   on-stage coverage card spans roughly x 35–255, y 255–430 of a 340 × 524 stage, over the cutaway
   and the green lit patch it is describing. At 1440 it is smaller but still sits over the projector
   body (page x 540–580, y 450–470). `preset-06-reality-check-{arcade,jade}-390.jpg`, `…-1440.jpg`.
5. **Loose dark slivers at the eave corners in every cutaway.** Two thin dark blades stick out past
   the walls at eave height on both sides (stage x 60–110, y 200–215 and x 715–750, y 215–230), plus a
   small dark nub above the apex (x 390–410, y 58–68). They look like trim/hip battens of the faded
   near-side roof facets that are not faded with them. Not z-fighting, but visible in all four
   cutaway presets. `stage-01/05/06/07-*.jpg` (zoomed crops confirmed).
6. **Phone: projector-output inset labels truncate to nothing.** With 3 projectors they read
   "PROJECTOR _ PROJECTOR _ PROJECTOR _", with 2 "PROJECTOR 1 OUT… PROJECTOR 2 OUT…".
   `preset-02-slime-mould-*-390.jpg`, `preset-05/07-*-390.jpg`.
7. **"Slime-mould shed" from the armchair: a projector body hangs top-centre.** The centre-down
   projector (2.2 m under the apex) is a large dark box with a glowing pink lens in the top-centre of
   the frame (stage x 320–400, y 10–100), and at this close range the veins read as soft, wide
   aurora bands rather than a fine slime network. Still a good-looking shot.
   `stage-02-slime-mould.jpg`.
8. **Plan → "What it showed" has an unfinished row:** "Frame rate, heaviest preset — PENDING"
   (`ui/measurements.js:63`, `fps-heavy`, value null). Measured on `0854bfe`: every preset holds the
   145 fps headless cap. Uncapped (no vsync), the heaviest is **Room food web at 885 fps**
   (two-projector 1170, reality check 1268, slime 1440, coral 2014, default 2106, swingers 2255).
   The default row says "150 fps"; measured is 145.
   `tab-plan-what-it-showed-*.jpg`.
9. **Plan → Architecture: SVG labels overflow their boxes.** At 1440, "masks" runs about 12 px past
   the Mapper box's right edge, and "init · step · render" and "shadows · calibration" touch their
   borders. At 390 the stacked diagram's edge labels ("set_region_life", "describe_region", "texture")
   render at about 6 px, and the two arcs run through "set_region_life" and "describe_region".
   `tab-plan-architecture-*.jpg`.
10. **Mid-air bodies are flat pink discs.** The "not projectable" bodies render as unlit 15–20 px
    pink circles (e.g. living-shed jade at page 645, 357 and 670, 318; food-web page 765, 533). In a
    hero shot they read as UI dots, not falling creatures. Minor.
11. **Micro-labels are small.** The mono uppercase labels are 0.56–0.6 rem (8.96–9.6 px): scene
    kicker, view buttons, fps, group summaries, "on", inset labels, legend notes. They are consistent
    and legible on a desktop screen, but at the small end. Minor.

### Per shot

| Shot | Verdict |
|---|---|
| `preset-01-living-shed-arcade-1440` / `stage-01` | OK, strong hero: coral on the walls, particles on the roof, slime on the floor, loft shadow on the wall. Eave slivers (#5). |
| `preset-01-living-shed-jade-1440` | OK (light panel, dark stage). Two pink mid-air discs near the roof (#10). |
| `preset-01-living-shed-coral-1440` | OK. |
| `preset-01-living-shed-{arcade,jade}-390` | Stage fine; tab bar hidden under the header (#2). |
| `preset-02-slime-mould-{arcade,jade}-1440` / `stage-02` | OK; projector body top-centre, soft veins (#7). |
| `preset-02-slime-mould-{arcade,jade}-390` | Sparse (one or two veins in view); inset labels "PROJECTOR _" (#6); tab bar hidden (#2). |
| `preset-03-coral-drip-{arcade,jade}-1440` / `stage-03` | Weak at 7 s: a few blobs on the roof, walls blank (#3). |
| `preset-03-coral-drip-{arcade,jade}-390` | Same (#3); tab bar hidden (#2). |
| `preset-04-ceiling-swingers-*` / `stage-04` | **Not a hero**: empty roof, foreground clutter (#1). At 390 one big pink disc. |
| `preset-05-food-web-{arcade,jade}-1440` / `stage-05` | OK, good: ember slime on the floor, histograms open in the panel (the honesty line is below the panel's fold, reachable by scrolling it). Eave slivers (#5). |
| `preset-05-food-web-*-390` | OK; inset labels truncated (#6); tab bar hidden (#2). |
| `preset-06-reality-check-{arcade,jade}-1440` / `stage-06` | OK and clear (maroon = dark, green = lit, 7 %). Coverage card over the projector body (#4). |
| `preset-06-reality-check-*-390` | Coverage card covers half the room (#4); tab bar hidden (#2). |
| `preset-07-two-projector-{arcade,jade}-1440` / `stage-07` | OK, strong: both projectors, frustums, 63 % readout in the panel. Eave slivers (#5). |
| `preset-07-two-projector-*-390` | OK; inset labels truncated (#6); tab bar hidden (#2). |
| `mcp-{arcade,jade}-1440` | OK: VS Code block, filters, labelled-dot "proposed tool names" note; long lines scroll inside the block. Simulated / Illustrated honesty lists below. |
| `tab-plan-*-{arcade,jade,coral}-1440` (Phases, Architecture, Risks, What it showed, Ask him) | OK: editorial, ruled, labelled dots, no callout boxes or filled pills, VS Code interface block. Architecture label overflow (#9), "PENDING" row (#8). |
| `tab-plan-*-390` | OK; sub-nav wraps to two lines; timeline labels tight but readable; architecture labels tiny (#9). |
| `tab-apps-{arcade,jade,coral}-1440` | OK, good: 8 cards with dark vignettes, unlocks / rig rows with dots. |
| `tab-apps-*-390` | OK: one-row scroll-snap carousel, the next card peeks in as the hint. |

Design rules: no coloured rounded left-border callout boxes and no filled pills anywhere. The only
`border-radius` in the module CSS is on dots, slider thumbs and the code block's traffic lights. The
stage is a dark room in all three themes.

## What I'd fix first

1. **Ceiling swingers (visual #1).** The preset has to keep a roof population. Raise `cr.grip`
   (0.55 drops 40 → 3 in 7 s) or ease `cr.swing` / `cr.flight` until about 15–25 creatures stay up
   for over 30 s, with a fall every few seconds. Give the roof a dim projected sim instead of `off`,
   so the facets aren't one flat brown. Reframe the loft view, or give this preset a camera clear of
   the red and black foreground shapes. Re-check with
   `SETTLE=20000 THEMES=arcade WIDTHS=1440 ONLY=presets,stage node tools/projector-life/shots.mjs`
   plus `window.__pjlStage.life.stats().populations.ceiling`.
2. **Default-scene tick growth (soak 2).** Cap the live particle population, or the per-tick
   work (the roof's Particle Life grows from 2.1 k to 4.6–5.3 k), so the default scene's tick stays
   inside the 9 ms budget for good (measured 4 → 12.5 ms in 5 min in soak 2, and 3.4 → 10.3 ms by
   10 min in the probe). Then re-run `node tools/projector-life/soak.mjs` and expect fps decay
   under 15 % and the tick flat.
3. **Phone opening glide (visual #2, the page-check FAIL).** Compute the scroll target after
   layout settles (for example in a rAF once the stage is ready, or re-measure when the smooth
   scroll ends), or `scrollIntoView` with a `scroll-margin-top` of the header height, so the tab bar
   lands below the 101 px sticky header at 390 px. Then `ONLY=layout node tools/projector-life/page-check.mjs`.
4. **Coral walls, dripping (visual #3).** Pre-warm Gray-Scott when the preset is applied (run
   20–30 s of ticks over the first second, or seed denser along the eaves), so the first view shows
   the streaks it promises.
5. **Reality-check coverage card at phone width (visual #4).** Shrink it to one line at narrow
   widths, or move it under the stage. At desktop, keep it off the projector body.
6. **Eave-corner slivers in the cutaway (visual #5).** Fade the faded facets' trim and hip battens
   with them.
7. **Small stuff:** phone inset labels (#6, e.g. "P1 out"); fill "Frame rate, heaviest preset" and
   correct 150 → 145 fps (#8); architecture SVG labels (#9); free per-projector targets when
   `proj.count` drops if memory matters (soak flag, bounded); presets' `open` groups accumulate in
   the phone drawer (4.6 k px after a few scenes).

Already fixed by the lead during this QA pass: the Stage retained after unmount (`0854bfe`), which
was found here as `keydown` listeners on `document` 1 → 21 and 20 of 20 mounted stages reachable,
and is re-checked clean.
