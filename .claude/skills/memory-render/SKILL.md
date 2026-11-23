---
name: memory-render
description: Turn a Memory Rooms trip spot (phone photos + one line) into a Blender-built, baked 3D room on /memories, or a whole captured place (a house, an apartment) into a building with levels, a roof and its rooms. Use for "render spot X", "render the next captured spots", "model the hostel room", "redo the bedroom render", "render building X" / "render the place X using the floor plan at <path>", or James handing over a floor plan.
---

# memory-render

Turns one captured spot into `scene.json` → Blender room → Cycles renders → compare loop (max 3 rounds) → baked `room.glb` → published. Everything runs in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`. Contracts: `src/memory-rooms/CONTRACTS.md` and `src/memory-rooms/scene/scene.schema.json` (read both before writing a scene; they are short). Kit pieces and their params: `tools/memory-rooms/blender/kit/README.md`. Worked example: `tools/memory-rooms/README.md` ("Synthetic self-test").

## 0. Where the spots live

The scripts talk to the Worker API. They read `MEMORIES_API` (default `http://127.0.0.1:8788`) and `MEMORIES_PASSWORD` (env, else `.dev.vars`).
- Local: `npm run build` then `npx wrangler dev --port 8788` (restart wrangler after every rebuild; port 8787 belongs to another project).
- Deployed: `MEMORIES_API=https://<site> MEMORIES_PASSWORD=<pw> node …`.
Check with `node tools/memory-rooms/pull.mjs --list`.

## 1. Pull

```
node tools/memory-rooms/pull.mjs <spotId>      # or --next for the oldest "captured" spot
```
Creates `memory-rooms-work/<id>/` (gitignored) with `photos/<n>.jpg`, `spot.json` (title, note, kind, place, scale hint, who), `photos.json` (sizes), `layout.md` (template), `bespoke/`, and `scan.spz` if they scanned it. Sets the status to `modelling`. If James gave you a floor plan, copy it into that folder as `floorplan.<ext>`.

## 2. Palette

```
node tools/memory-rooms/palette.mjs <spotId>
```
`palette.json` holds k-means colours per photo; look at `palette.png`. Use these hex values for walls, floor and objects instead of guessing.

## 3. Look, then write layout.md, then scene.json

Read EVERY photo (Read tool) and the floor plan if any. Then fill in `layout.md` FIRST:
- **Frame.** "North" is the scene frame, not the compass: **north = the wall you face standing in the main doorway** (with a floor plan: the plan's top). The capture shot guide follows the same frame, so interior photos 1–4 are the back-left, back-right, front-right and front-left corners = **NW, NE, SE, SW**, 5 = the detail, 6 = wide from the door. x runs west→east, z north→south, origin = the room's north-west floor corner (interior) or the site centre (exterior).
- **Dimensions and how you got them.** A floor plan beats everything. Otherwise scale from anchors: US interior door ≈ 0.81 × 2.03 m (handle ≈ 0.9–1.0 m), ceilings 2.4–2.7 m (older/hostel 2.7–3.0), skirting 0.07–0.15 m, single bed 0.99 × 1.91, double 1.37 × 1.91, queen 1.53 × 2.03, bunk ≈ 1.0 × 1.6–1.75 high, kitchen counter 0.91 high, table 0.75, chair seat 0.45, light switch 1.2 m, power point 0.3 m, floor tiles 0.3/0.6 m, timber boards ~0.14 m. Count tiles/boards along a wall when you can. Use the typed scale hint as a sanity check. Write down each number and the anchor it came from.
- **Sizing a room from corner photos (no plan).** Each corner photo sees two walls, so solve the room and the cameras together: (1) in every photo, mark the pixel positions of the room's vertical corners and where walls meet floor and ceiling; (2) find things visible from two or more corners (rug corners, curtain-rod ends, the window, a bunk post) to tie opposite walls together; (3) fit width, depth, height and each camera's pos/look/fov to those marks by least squares (a short numpy script in the work folder is worth it; numpy is in system Python and Blender's Python), with one shared fov for all main-camera photos; (4) fix the absolute scale with the anchors above. Note the fit's residual in layout.md. The self-test room (README) came out within 2.5 % this way.
- **Openings** per wall with offsets (from the wall's lower-x / lower-z end).
- **Objects**: id · kit · size · position · which photos show it. Prefer kit pieces; set `params` (see kit/README.md); set `material`/`accentMaterial` from what you see; colours from palette.json.
- **Cameras**: for each photo, where it was taken from and what it looks at. Interior: 1–4 corners (NW, NE, SE, SW, but check against what each photo shows), 5 = the detail, 6 = wide from the door (a camera standing IN the doorway, up to 0.6 m outside the wall line, is allowed); exterior 1–4 = four angles, 5 = wide with context, 6 = detail. Phones: eye height 1.4–1.6 m, main camera fov ≈ 69–72° across the LONG edge (0.5× ultrawide ≈ 105–120°, 2× ≈ 40°). `aspect` = width / height from photos.json (portrait 0.75). Pin the look direction with the room's vertical corners and where walls meet the floor in the frame.

Then write `scene.json` (schema v1). Rules that keep it checkable:
- `at` = footprint centre on the object's BASE; `size` = [w, h, d] in the object's own frame; `rotY` 0 = front faces south (+z), 90 east, 180 north, 270 west. A desk on the north wall: rotY 0; a bed with its head on the west wall: rotY 90.
- Things on other things: base y = the supporter's top (lamp on a nightstand: y = 0.55). Wall-hung: touch the wall plane and set `mount: "wall"`. Pendants: top at the ceiling, `mount: "ceiling"`.
- Intentional overlaps (chair under a desk, rug under a bed) go in `overlaps`.
- 1–3 `pins` with James's note (or what the note points at), placed on the object it's about.
- `lights`: what you see (lamps, pendants, `window` daylight, a `sun` direction) and `style.mood` from the photos' light.
- If the kit can't express something that matters (a distinctive bar back, a mural, a pool table), use `kit: "bespoke"` with `script` and write `bespoke/<script>.py` defining `build(ctx, spec)` that models inside the declared box in LOCAL space (see CONTRACTS.md §5 and any kit piece as a template). `kit: "glb"` imports a model file you place in the work folder.
- Kit quirks worth knowing: skirting takes the first WINDOW's `color` (else off-white), never a door's; `velvet` adds a strong sheen that lifts dark colours (use `wool` or `leather` for dark upholstery); the kit can't make asymmetric curtain panels or match specific books/prints/leaves (they're procedural), so don't spend rounds on them.
- Houses: give every room of the same building `frame: { group, origin: [x, z], rotY }` in one shared frame (from the floor plan), so `/memories/group/<group>` assembles them.

## 4–6. Check, build, compare (the loop, max 3 rounds)

```
node tools/memory-rooms/build.mjs <spotId> --round 1
```
= `check-scene.mjs` (schema, objects inside the shell, nothing floating or interpenetrating > 2 cm, openings fit, cameras inside and aimed at something) → `blender/build_room.py` (Cycles, 64 samples, renders `cam<n>`, `top`, `three-quarter`) → `compare.mjs` (`compare.png`: photo | render | 50/50 overlay per camera + the top-down, with structure/tone/colour scores). Fix check-scene errors before anything else.

Then READ `compare.png` (per photo: photo | render | 50/50 overlay | **edges**, where photo edges are red, render edges blue and matching edges dark: a red line beside a blue one is an offset; the edges column shows 2–5 cm errors the blend hides). Write the **3 biggest mismatches** under "Compare rounds" in layout.md (be concrete: "photo 2: the bunk is 40 cm too far east", "the window is on the wrong wall", "walls are too yellow"), fix them in scene.json / bespoke scripts, and run the next round (`--round 2`, then `--round 3`). Order of attack: camera pose (if the overlay's room corners don't line up, fix the camera before moving furniture) → room size and openings → big furniture → colours and small things. Use the scores to confirm a round helped (structure should rise). **Stop after round 3**, even if imperfect, and list what's still off under "Still off after the last round".

Speed: `--only cam2,top` re-renders just what you're fixing; `--samples 32` for quick looks.

## 7. Bake + export

```
node tools/memory-rooms/bake.mjs <spotId>
```
Bakes the lighting into one atlas, exports `room.glb` (WebP, target ≤ 8 MB) and renders `renders/hero.png` at full samples. Read `hero.png`: it's the map card, so it must look good. It then makes what the `/memories` map shows: `renders/marker.png` (the hero trimmed to its content, 240 px: the spot stands on the map as this) and `map.glb` (room.glb with 512 px textures, meshopt-compressed: the 3D diorama past zoom 15). The hero's view is also the diorama's default view, so a hero that reads well from its corner is a map that reads well.

## 8. Push

```
node tools/memory-rooms/push.mjs <spotId>
```
Uploads room.glb and map.glb (making map.glb and renders/marker.png first if they're missing or older than room.glb / the hero), every render and compare sheet, saves the scene (validated again by the Worker, `sceneVersion` +1) and sets the status to `rendered`. Then open `/memories/<spotId>` to see it.

## "Render the next captured spots"

Loop: `pull.mjs --next` → steps 2–8 → repeat until `--next` says nothing is waiting. Do one spot fully before starting the next. At the end, report per spot: dimensions and their source, rounds used, final scores from `compare.json`, what's still off.

## Whole places: "render building X"

A whole place is a building row (`/memories/b/<id>`): the phone captured its name, location, a floor-plan photo, outside shots and its rooms one by one (each room is an ordinary spot with `buildingId` + `roomId`; the place's `sketch` lists the rooms, maybe as rough rectangles). Contracts: `CONTRACTS.md` 6.2 (building.json) and 6.4. Worked example: `tools/memory-rooms/examples/house.building.json` (+ `house-living.v2.scene.json`, a room of it).

1. **Folder**: `memory-rooms-work/b-<buildingId>/` (the id is the row's; building.json has none). Get the row (`GET /buildings/<id>`): its `sketch` (room ids, names, levels, rough rects, north), its media (the floor-plan photo(s), the outside shots), and pull each room spot as usual (`pull.mjs <spotId>`).
2. **Trace the plan** into `building.json`: per level a wall graph (nodes + walls, a shared wall ONCE, T-junctions split, thickness: exterior ~0.2, interior ~0.1), rooms as node outlines **with the sketch's room ids** (so the captured spots land in them) and their `spotIds`, openings on wall ids (offset from node a), stairs, the roof (`parts` for an L or a lean-to), the site, `geo` (lat/lng from the row, `north` = the bearing of plan north if the plan isn't north-up). Scale from a known dimension on the plan or the rooms' photos. Validate as you go: `node tools/memory-rooms/check-contracts.mjs` covers the examples; for this file `node -e` with `validateBuilding` from `src/memory-rooms/building/validate.js`, or just run plan-check (it validates first).
3. **Check the tracing on the photo**: `node tools/memory-rooms/plan-check.mjs memory-rooms-work/b-<id> --photo <plan.jpg> --level ground --fit <node>=x,y <node>=x,y <node>=x,y` → `plan-check-ground.png` (the walls, openings and room names over the photo) + per-anchor residuals. Read the PNG; fix until every wall sits on the drawn wall.
4. **Each room's scene** (`memory-rooms-work/<spotId>/scene.json`): `"version": 2`, `"shell": { "building": "<buildingId>", "room": "<roomId>" }` and nothing else in the shell (walls, floor, ceiling, openings come from building.json), objects / cameras / pins in the ROOM frame (the room's wall-centreline bbox min, or its pinned `origin`). `check-scene.mjs <spotId>` finds `../b-<id>/building.json` itself. Do the usual look → layout.md → compare loop per room (`build.mjs` can't build a building room on its own: use step 5 with `--only <level>` and compare by eye against the photos).
5. **Build**: `node tools/memory-rooms/build-building.mjs <buildingId> [--samples 128] [--atlas 2048]` → `levels/<id>/` (blend, renders/three-quarter.png + top.png: READ them), `level-<id>.glb`, `exterior.glb`, and each furnished room's `room.glb` slice written into its spot folder (in the room frame, walls' normals pointing out of that room: the spot page, walk and AR need no building code). `--no-bake` for a quick look, `--only ground` to iterate on one level.
6. **Push**: `node tools/memory-rooms/push-building.mjs <buildingId> --rooms` (level GLBs, exterior, renders, `plan` → planVersion +1, status rendered; `--rooms` runs push.mjs for each room spot). Needs a Worker with the building routes AND `supabase/memory_buildings.sql` run (it refuses otherwise).

Self-test of the whole pipeline (no real data): `node tools/memory-rooms/building-selftest.mjs`.

Learned on 12B Fletcher St (`memory-rooms-work/b-001c25b7…/`, reuse its helpers):
- A **vector builder PDF** traces exactly: PyMuPDF (`pip install --target <scratchpad>/pylib pymupdf`) gives the red
  dimension ticks and the labels, so each chain resolves to mm (`trace.py` there writes building.json from them).
  WA window sizes are brick courses × width (28c = 2.408 m).
- Nothing in the pipeline shows the whole house from the street: `compose.py` (both level blends + the exterior, Cycles,
  cameras at the photo positions) + `sheet.py` is the compare loop; `glbview.py` shows the baked GLBs unlit as the viewer
  does; `live-shot.mjs` screenshots the live page's four stages.
- `wall.outside` finishes, raking walls under a skillion, fascias, garage doors, fences and trees are built (DECISIONS
  178–181). Level bakes are exposed for the interiors, so a sun mood bakes shaded outer walls navy: use
  `style.mood: "overcast"` until that's fixed (DECISIONS 182).
- Pass 2 (DECISIONS 183–188) added optional contract fields; reach for them before hacking geometry:
  `wall.outside.panels[]` (a cladding band beside a window: placed like an opening, no hole, no clearance rule, so it
  can sit hard against the window; DON'T split the wall at a node for this, an opening must clear half the other
  wall's thickness even at a straight joint), `wall.outside.rake` (the band under a skillion), stair `finish`
  (tile / concrete = solid flight + soffit; the `from` level's walls inside its footprint are cut to the soffit) and
  `walls` (raking side walls), `site.features[]` (planters, stepping stones, letterbox with a label, pergola beams, a
  white canopy slab, clipped shrubs), fence kind `sheet` (Colorbond). An upper level's outdoor room gets its own slab.
- **Site areas are slabs, never sheets a few mm apart (2026-11-24).** Two surfaces closer than ~1 cm z-fight in the
  viewer: they flicker and swap as the view spins (34 Jollytail's grass sawtoothed through its drive). The builder
  sets every `site.areas` top by kind above the lot (lawn 1.5 cm, garden / water 2, path / paving / pool 3, drive
  4; `AREA_RISE` in build_building.py), with edges down into the lot. An area that OVERLAPS an earlier one sits
  ≥ 1.2 cm above it (later = on top), and the build FAILS if two overlapping areas end up < 8 mm apart. So: list
  areas bottom-up (lawn, then beds, then paths, then the drive), don't stack more than you need, and never model
  ground cover as a bespoke flat plane at the lot's height (or a spot exterior's ground: verge, bays). Check a spin of the outside after every
  bake: `node tools/memory-rooms/dev/zfight-shots.mjs --building <id>` (8 far views + a flicker % per 0.3°;
  `--old-near` shows it as the old viewer did). The viewer also scales its near plane to the orbit distance
  (RoomViewer `nearFor`), which hides most of it on older bakes, but the builder rule is what fixes it.
- Elevations decide finishes: a plan chain says where a panel is, A.06 says how tall (the 990 panel only runs
  39c..63c). Check every cladding face against the elevations AND a photo; pass 1 had the box's west face reversed.
- **Merging an already-rendered spot into its building** (pass 3, DECISIONS 189–191; the Batcave folder keeps the
  scripts): back up the live row + model + renders first (`backup.mjs`), PATCH `buildingId` / `roomId`, pin
  `room.origin` + `spotIds` + finishes in trace.py, then `merge.py` (anchor per group, never a global scale) →
  `fit/fit_plan.py` (cameras re-solved with the room fixed; `diag_plan.py` frees one constraint at a time to say where
  the photos disagree with the plan) → `roomcams.py` (the photo cameras rendered inside `levels/<id>/room.blend`, a
  folder `compare.mjs` reads) → full build-building (the slice writes the spot's room.glb) → `herocut.py` (the spot's
  hero from its slice, unlit, dollhouse cut, transparent) → push.mjs → push-building. Free-standing furniture follows
  the photos by back-projection (old camera → pixel → new camera), not a wall rule. A door the photos show open
  blinds a doorway camera: make it an `opening`. The building bake ignores the scene's lights / mood (day look).
  Blender with `-b <blend>` resolves a relative output path against the drive root: pass absolute paths.
- **Two bakes per level (2026-11-22)**: build-building bakes every level with `--empty` (the structure again with
  the furniture hidden: clean walls / floors, no ghost shadows) → `level-<id>-empty.glb` + a `room-empty.glb` beside
  each slice; a level with no furniture gets none. push-building / push.mjs upload them as `model/level-<id>-empty`
  and `model/empty` only when the Worker's ping says `empty` (an older Worker stores every spot model as room.glb):
  deploy first, check ping, then push. Every node now carries glTF extras `mrKind` (structure / furniture by the
  `obj__` / `__obj__` name rule), so name furniture that way and nothing else. Add ~40 % to a level's bake time
  (12B ground: 592 s + 226 s at 128 samples). Check the empty look with `b-<id>/proof.py` (absolute paths).
- An open curtain: the Batcave's `bespoke/wave_curtain.py` takes `open` (deep-folded stacks, ~11 % of the track a
  side, clear of the glass); reuse it for any sheer the person wants drawn back.
- `compose.py <work> <round> <samples> [cam,cam]` takes a camera list; `x-*` cameras are inspection views (under the
  balcony, the stair head, inside the MP strip) that only render when named. Plants render pale in Cycles: pick
  shrub colours a notch darker than the photo (#4d5a47 grey-green, #2b3f26 leafy).

Learned on 34 Jollytail St (`memory-rooms-work/b-fa81b29a…/`, a plans-only new build, reuse its helpers):
- A 1:100 A2 vector sheet: 1 pt = 35.28 mm; the 0.96 pt black slashes are the dimension ticks, each drawn as two
  half-strokes (merge centres < 3.5 pt). `chains.py` prints every chain with its labels; trace from chain SUMS.
- No photos: furnished rooms still need spots. Create them through the API (POST /spots with `buildingId` + `roomId`,
  no media), write their scenes in plan coords and move them to the room frame (`gen_scenes.py`), pin each room's
  `origin` + `spotIds` in trace.py. Pendants under a raking ceiling: `fit_pendants.mjs` (shell.js `ceilingAt`).
- Building room scenes are `kind: "interior"` even for an outdoor room (an exterior scene can't have a shell).
- Roof step where two skillions meet over a room with no wall on the step line: a white site `box` feature closes it.
- A room spot's hero: `herocut.py <spot dir> <w> <d>` (unlit dollhouse cut; wall pieces matched by ancestor node).
- Live pushes need `--live` (push-building passes it on to `--rooms` since 2026-11-23).

## Quality bar

A polished, stylised miniature that is recognisably THAT place: right proportions, right furniture in the right spots, right colours, the memory's object pinned. Not photoreal. Every spot shares one look (the kit's materials and lighting); don't fight it with odd exposure settings unless the photos are clearly night or golden hour (`style.mood`).
