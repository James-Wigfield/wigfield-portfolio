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
