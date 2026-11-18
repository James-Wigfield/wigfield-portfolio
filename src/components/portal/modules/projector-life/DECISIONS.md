# Projector Life — decisions made unattended

One line each: the call, then why. Newest at the bottom of each section.

## Setup (lead)
- Worktree via EnterWorktree at `.claude/worktrees/projector-life` (ignored by `.git/info/exclude`), branch renamed to `feat/projector-life`. — the brief's preferred route; the folder is already git-ignored.
- The main checkout's dirty paths at start were only `Documents/temp/prompt-dumping/*` deletions and two untracked prompt files (not package.json as the brief expected). — recorded so the final merge check compares against the real list.
- Plain three.js, not R3F. — one imperative engine owns the loop, custom shaders and render targets, and teardown is explicit (renderer.dispose + forceContextLoss), which is what the leak test needs.
- World frame = the GLB's own frame (no recentring). — furniture, loft and the measured numbers all stay in one frame; `SHED.centre` = (2.18, 0, 2.18).
- Patch frames are right-handed about the inward normal, polygons CCW. — every shared edge is walked in opposite directions, so a seam map is a pure rotation + translation (verified: 64 seams, world error < 1e-14).
- The cap of the old roof lives in the `ceiling` node (the `obj__octagon` node is empty). — hiding `ceiling` removes the whole old roof.
- Loft deck = floor-type patch with no seams. — its edges meet walls mid-height, not edge to edge; creatures reach it by falling.
- Engine is a dynamic import from the shell. — three.js and the sims only download when the tab opens.
- Projector-output inset is drawn inside the same WebGL canvas (scissored viewport); the net inset is a DOM 2D canvas. — no second WebGL context, no GPU readback per frame.
- Dev server for the worktree on port 5191 (`npx vite --port 5191 --strictPort`).

## Room (room agent — full reasoning in `room/NOTES.md`)
- Walls split per flat (8 fade groups, not 4 nodes); old roof split into 8 sectors. — finer cutaway, and each wall mesh maps 1:1 to its patch.
- Each split piece has its own material clone; materials never swapped after load; fades only change opacity/transparent. — projection keeps its onBeforeCompile patch on stable instances.
- Fully faded meshes move to layer 7, never `.visible = false`. — `.visible` stays "physically present" for shadows and coverage.
- Cutaway: inside or cutaway-off shows all; outside hides a wall when out·camDir > 0.18 (dollhouse.js); a roof facet shows only if the camera is below its plane and it isn't a near facet. — far facets read as a tent; from above the roof vanishes by itself.
- Roof underside plane passes exactly through the inner wall face's top edge and runs on inside the wall slab to an overhang at apothem 2.46. — no coplanar faces: no gap, no z-fighting at 2.7 / 3.3 / 4.2.
- Roof colour sampled from the old roof's bake (±3.5 % per facet); #efede8 kept as the roof's albedo for the light model. — the roof is unlit, so its colour is its lit look; flat #efede8 glowed against the night bake.
- `room.oldRoof` → roof patches use the old roof's virtual apex 2.738 (12.6°). — the comparison changes ceiling behaviour honestly.
- Masks measured offline into `room/measured.js` (room-check --write), not at load; door/window masks include their trim; loft masks cover the walls below the deck, the end post and the deck footprint. — zero load cost; no life slivers around frames; no projector reaches under the loft.
- Landing heightfield: 4 cm cells, 8 height layers, loft bags count as the loft. — 14 ms build, 0.35 µs/query.
- Hero cutaway from the SSE (bearing 152°, 3.75 m up, fov 46), dropping with the pitch and dollying back on portrait canvases. — the default projector throws west, so the lit side faces the camera.

## Projection (projection agent — full reasoning and the placement search in `projection/NOTES.md`)
- Centred lens (no lens shift); throw t → hFOV = 2·atan(1/2t). — honest, simple pose maths; a shift can come later as an off-axis matrix.
- A projector's output = the content scene (patch polygons + life buffers) rendered from its own camera. — projecting it back through the same lens IS the mapping pre-warp, so mapped content is undistorted by construction.
- Masks: door/window draw black 2 mm in front of the patch; furniture and loft draw black as depth-tested proxies. With a mask off the wall content is emitted and spills onto the furniture in 3-D. — the honest "what if you don't mask it" picture.
- Raw mode = `life.frame()` stretched over the whole frame, no masks. — the unmapped "before".
- Light on paint: `baked·ambient + albedo·Σ light`, albedo white-balanced from the bake onto the sage paint (#cfdad2), leaning 80 % to the room's paint hints. — the bake is a warm night look, not albedo.
- Fall-off: brightness·cosθ·min((4 m·t)²/d², 3); black level falls off like light across the whole frustum. — inverse square + same lumens spread over a bigger picture; the grey glow is visible at ambient 0.
- Shadows: one packed linear-depth map per projector, 4-tap PCF, re-rendered only on pose/count/roof/furniture/loft change; the same texels feed coverage(). — view and readout always agree.
- Coverage view: 0 maroon, 1 green, 2 blue, 3 violet, shaded by albedo. Pixel view: a grid line every 32 projector pixels coloured by px/m. — grid shows shape (keystone, stretch), colour shows density.
- Coverage readout: 5 cm grid on every patch (~20 k samples), masks excluded, ≤ 5 recomputes/s (~10 ms incl. readback), never per frame.
- Projector defaults in `params.js` came from an exhaustive occlusion-aware placement search (36 % best single at throw 0.5; 62.7 % best pair; ~72 % with three). — numbers grounded in the model, not guesses.

## Life (life agent — full reasoning in `life/NOTES.md`)
- One global domain: every patch's grid laid end to end in one index space at one px/m. — seam exchange for grid sims is a table lookup; no soft-fade fallback was needed (5.5k cross-patch links).
- A seam to a patch running ANOTHER system is a zero-flux wall. — "empty" neighbours poured blank substrate in from the eave and washed walls clean.
- Gray-Scott drift = upwind advection of u and v together along g_t; while drifting, nuclei "rain" in along each patch's upstream band; default wall preset = worms ("Rain"). — a drifting pattern with no source washes off a wall in < 1 min.
- Physarum in metres, `network` re-tuned (30° sensors, decay 0.06); sensing reads across seams through a halo table; agents cross with seam.M + mapAngle. — the cabinet's tuning coarsened to 3–4 trunks on a 4 m floor.
- Particle Life sparser and wider (115/m², rmax 0.26 m) with ghost particles across seams; six castes of grip; facets peel particles off and they fall and land. — 6 ms → 1.2 ms per tick, clusters still read across a room.
- Lenia: direct convolution on a half-resolution domain (pruned ring kernel). — the cabinet's FFT needs a periodic power-of-two torus; patches are neither.
- Fixed 30 Hz ticks, ≤ 4 per frame, 9 ms budget, debt dropped; budgets split by area inside each system (≤ 45k Physarum agents, ≤ 6k particles). — heavy settings slow down instead of stalling.
- Rebuild by patch id, lazily on the next step. — patches can appear/disappear (loft toggle) and apex drags coalesce to one rebuild per frame.
- Creatures at toy gravity 0.3 g; hold model: adhesive feet in shear (walls), peel (ceiling), a hooked hand ~2.6 body weights for brachiation; ceiling gait = pendulum hang + brachiation only. — at 1 g swings are too fast to read; with a safe ceiling crawl, selection evolved crawlers instead of swingers.
- Selection: parents ∝ stored energy², crowding culls the hungriest; falls kill only on a hard landing; genes are relative to the sliders; food = the sim under the creature + a little ambient. — culling the oldest homogenised the habitats; sliders act live.
- Creature glyphs (~30 cm, dark halo, white planted feet, red when slipping, white swing arm) are drawn INTO the patch buffers. — they are projected content; mid-air bodies are the Stage's 3-D spheres.

## UI (UI + Plan agent — full list in `ui/NOTES.md`)
- The page always opens on the Visualiser (tab not remembered); scene state lives in the shell so a trip to Plan disposes the Stage and rebuilds it on return. — "first thing I see is the render", and no hidden render loop while reading.
- Plan and Applications tabs are React.lazy chunks; the engine is a dynamic import. — the portal's main chunk pays nothing.
- Every control generated from params.js (group → section → per-projector sub-groups); widget by def type. — adding a control = adding a def.
- Values mirrored in React and flushed to the Stage once per animation frame; the Stage echoes external changes back (`onValues`). — an apex drag rebuilds once a frame; QA/console changes reach the panel.
- Habitat colours: a validated categorical trio (floor amber, wall teal, roof violet) used in panel, histograms, coverage and region map. — one identity everywhere.
- Presets may `open` panel groups and show an on-stage Coverage · Raw · Mapped `compare` switch; Reset returns to the first preset. — the food web shows histograms; the reality check flips raw/mapped in one click.
- MCP preview: one call per line, pretty toggle, group filters, copy copies exactly what's shown; tool names labelled "proposed". — scannable, and honest that the names are a proposal.

## Integration (lead)
- Hero rig searched for what the cutaway camera sees (SE corner 2.1 m, heading −22.5°, tilt −22°, throw 0.35): 50 % of the visible half, floor 39 % (was 5 %). — the default scene should show all three habitats alive.
- Default room lights 0.14 → 0.06 (living shed 0.05) and projector brightness 1 → 1.5 (living shed 1.8). — at 0.14 the bake washed the projection to pastel; projection needs the dark.
- On opening, the page glides so the tab bar meets the portal's sticky page header and the stage (100vh − header − tabs) fills the viewport. Only from near the top, once per visit, instant under reduced motion. — the portal banner + header put the stage 420 px down; "the first thing I see is the render".
- Added `life.leniaPreset` / `life.leniaPalette` keys; Stage: dispose on failed init, smaller projector inset, "Projector's view" follows any projector, `onValues()`.
- Screenshots kept as JPEG (q≈80) in `Documents/projector-life/screenshots/`. — the full matrix as PNG would add ~50 MB to the repo.

## Code review fixes (fresh-eyes reviewer, 2026-11-18)
- life host: while a rebuild is pending (setPatches since the last step), setParams defers assignment + reseeds to rebuild(); reseed/clear/stats rebuild first. — loft off + a preset froze the stage (new indices mapped onto the old domain); now in sim-check's churn test.
- Stage: OrbitControls' capture keydown listener is removed from the root node remembered at init, and teardown nulls every reference. — React detaches the DOM before effect cleanups, so controls.dispose() missed it and each tab switch leaked a whole Stage (canvas, lost context, DOM).
- room/pick.js: the raycast hit list is local. — a module-level array kept the last mesh and its 16 MB atlas bitmap alive after unmount.
- Stage inset: needsUpdate only when the map appears/disappears. — with 2–3 projectors it bumped material.version twice a frame.
- Stage: patch hand-over to life/projection coalesced to ≤ 1 per 180 ms during a drag (+ a trailing flush; presets flush at once). — apex drags ran at ~35 fps (life domain rebuild ~11 ms per step); now ~94 fps, median 7 ms.
- Visualiser: a preset picked while the stage loads lands fully after load (replace + its camera). — only the values used to catch up.
- "Projector's view" stays upright at the canvas aspect: OrbitControls caches camera.up at construction, so rolling it would break orbiting. The projector-output inset shows the true (rolled, true-aspect) output. — honest and simple; noted in CONTRACTS §6.

## QA + visual-critic fixes (lead, 2026-11-18)
- Particle Life top-up caps the TOTAL at the summed targets and thins a patch over 1.5× its share. — particles crowded round the apex while starved facets respawned: the roof crept 2k → 5.6k particles and the tick 3 → 13 ms in 4 sim-min; now flat at 2.0k / 3.2 ms (regression check in sim-check, probe `tools/projector-life/pl-creep.mjs`).
- Ceiling swingers runs selection OFF, grip 0.7, short flights, a projector on a 1 m stand, roof background off, viewed lying on the loft. — with selection on, falls outran births and the roof emptied; the loft view shows the hanging bodies on their arms.
- Coral walls uses Gray-Scott "Rain" at 2.2× speed × 2 substeps, the hero rig and the warm ember palette. — coral proper took 30–45 s to fill; aurora's pink + green read as colour fringing.
- Phone opening scroll re-aims at 0.75 / 1.3 / 2 / 2.8 s until the first user input. — the portal chrome shrinks ~70 px after the first measure.
- Roof overhang 18 → 6 cm past the outer wall face. — beside faded facets the overhang corners read as stray spikes.
- Mid-air bodies are matcap-shaded beads at 0.75× radius. — flat pink discs.
- Projectors get a mount: a rod to the roof when nearer the roof, else a stand to the floor/loft deck with a plate. — bodies "floated like placeholders".
- Coverage view: not reached = the room dimmed (not maroon); reached = the count colour with the life showing through. — the maroon flood hid the room the view is about.
- Frustum rays off in the life-first presets (living shed, slime, coral, swingers, food web); on in the reality check and the two-projector rig. — rays slashed across the hero shots; the mounted body still says where the projector is.
- Darker rooms (0.03–0.05 ambient) and brighter projectors (1.8–2.5) in the presets; living-shed walls ember between the cyan floor and neon roof. — projected life must outshine the room.
- Honesty key moved directly under the stage (above the MCP drawer); MCP JSON soft-wraps; phones open only Scenes; a preset's `open` groups aren't persisted. — the key was buried and phones opened every group (~4,700 px).
