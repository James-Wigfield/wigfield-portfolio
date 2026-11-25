# tools/memory-rooms: the render workflow

Scripts behind Memory Rooms (`/memories`, front end in `src/memory-rooms/`). Node scripts talk to the Worker API;
Python scripts run inside headless Blender 5.2. The Claude Code skill that drives them is
`.claude/skills/memory-render/SKILL.md` ("render spot X", "render the next captured spots").
Contracts: `src/memory-rooms/CONTRACTS.md`. Calls made during the build: `DECISIONS.md`.

## The loop

```
pull.mjs <id> ─► palette.mjs ─► (Claude writes layout.md + scene.json) ─► build.mjs --round 1..3 ─► bake.mjs ─► push.mjs
                                                                         = check-scene + build_room.py + compare
```

| Script | Does |
|---|---|
| `pull.mjs <id> \| --next \| --list` | downloads a spot to `memory-rooms-work/<id>/` (gitignored): photos, thumbs, `spot.json`, `photos.json` (+ each photo's EXIF), `capture.json` (guided / freeform: era, layout, viewpoints, captions, per-photo EXIF), `contact.jpg` (every photo numbered, past 12), scan, saved scene, a `layout.md` template (a "Freeform" block for old photos), `bespoke/`; sets status `modelling` |
| `palette.mjs <id>` | k-means (CIELAB) colours per photo → `palette.json` + `palette.png` |
| `check-scene.mjs <scene.json \| id> [--building <file>]` | schema + geometry: inside the shell, nothing floats or interpenetrates > 2 cm, openings fit, cameras inside and aimed at something. v2 shells (polygon, sloped ceiling, a room of a building) are checked against the normalised shell; a room of a building needs its building.json (`--building`, or `building.json` next to the scene, or `memory-rooms-work/b-<buildingId>/`) |
| `build.mjs <id> [--round N] [--samples 64] [--only cam1,top] [--cams 2,5,7]` | check-scene → `blender/build_room.py` → `compare.mjs`; `--cams`: render + compare only these photo cameras (+ top, three-quarter): a freeform spot keeps up to 40 cameras but compares 6–8 a round |
| `blender/build_room.py` | scene.json → `room.blend` + Cycles renders `renders/cam<n>.png`, `top.png`, `three-quarter.png`, `build-report.json` |
| `compare.mjs <id> [--round N] [--cams 2,5,7]` | `compare.png`: photo \| render \| 50/50 overlay per camera + top-down, with structure/tone/colour scores (`compare.json`) |
| `freeform/fit.py <fit-input.json> [--out …]` | old photos (CONTRACTS.md 8, skill "Freeform spots"): cameras + room size + marked points from pixel marks and line marks, viewpoints as starting places / soft priors, EXIF fov, anchors; numpy only. Its header documents the input. Known answer below |
| `freeform/known_answer.py` | the freeform fit against a known answer (the synthetic self-test room + The Batcave's real marks), shuffled, no EXIF, with and without rough viewpoints → `freeform/known-answer.json` |
| `bake.mjs <id>` | `blender/bake_export.py`: bakes the lighting into one atlas, exports `room.glb` (WebP, ≤ 8 MB target), `renders/hero.png`; then what the map shows: `renders/marker.png` (`lib/marker.mjs`) and `map.glb` (`lib/mapModel.mjs`) |
| `push.mjs <id> [--dry-run]` | uploads `room.glb` + `map.glb` + renders + compare sheets (making `map.glb` / `marker.png` if missing or stale), saves the scene (validated, version +1), status `rendered` |
| `plan-check.mjs <work dir \| building.json> --photo <plan.jpg> --fit a1=x,y a5=x,y [--level id]` | a traced building.json over its floor-plan photo (least-squares fit from node ↔ pixel anchors, residual per anchor): walls, openings, node ids, room names → `plan-check-<level>.png`. Validates first |
| `build-building.mjs <buildingId \| work dir> [--samples 128] [--atlas 2048] [--only level] [--no-bake]` | a whole place: `blender/build_building.py` (each level once in the plan frame + the exterior) → `bake.mjs` per level → `level-<id>.glb`, `exterior.glb` → `blender/slice_rooms.py` (each furnished room's `room.glb` in its spot folder, in its room frame) |
| `push-building.mjs <buildingId> [--dry-run] [--rooms]` | uploads the level GLBs, exterior, renders, PATCHes `plan` (+ planVersion) and the status; `--rooms` pushes each room spot. Refuses a Worker without the building routes / tables |
| `blender/build_building.py`, `building_mesh.py`, `slice_rooms.py` | building.json → level `.blend`s (walls once, junctions mitred, hubs at T's), the roof + site; the junction maths (pure Python); a baked level → per-room slices |

Every Node script reads `MEMORIES_API` (default `http://127.0.0.1:8788`) and `MEMORIES_PASSWORD` from the
environment, falling back to `.dev.vars`. Blender path: `BLENDER` env, default
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.

## The Blender kit (`blender/`)

- `scene_io.py`: loads + validates scene.json with the SAME schema as the web app, and owns the one
  scene → Blender coordinate conversion (`to_bl((x, y, z)) = (x, -z, y)`).
- `common.py`: argv after `--`, OptiX GPU, Cycles + AgX render settings.
- `shell.py`, `lighting.py`, `build_room.py`, `bake_export.py`: the pipeline.
- `materials.py`: the procedural material library (`get`, `floor`, `wall`, `ground`), one look for every spot.
- `kit/`: one module per piece; `kit/README.md` lists every piece, its params and typical sizes;
  `kit/preview.py` renders any pieces on a studio floor plus a contact sheet.
- A piece the kit can't express: `kit: "bespoke"` + `memory-rooms-work/<id>/bespoke/<script>.py` with
  `build(ctx, spec)`, modelled in local space inside the declared box.

## Checks and dev helpers

| | |
|---|---|
| `check-contracts.mjs [--verbose]` | scene.json v2 + building.json + the sketch: the JS validators and their Python mirrors agree on every example and work scene, fail together at the same paths on 33 broken mutations, and agree on the geometry (normalised shells, ceilings, room frames, exterior loops, stairs, lng/lat) to 1e-6 |
| `api-check.mjs` | every `/api/memories` route (132 checks: incl. the edit PATCH, `ifUpdatedAt` → 409, a re-POST never undoing an edit, the walk ticket / presence / socket door: 401, 400, 404, a tampered ticket 403, no upgrade 426, whole places, collections: create once, rename, 409, bounds, a spot and a place in one, a delete that ungroups them, a share link that never shows it), against any running Worker; `--no-collections` / `PGREST_NO_COLLECTIONS=1` (112): spots still save before `memory_collections.sql` has run |
| `pgrest-stub.mjs` | in-memory PostgREST stand-in to run api-check against the Supabase row store locally (`PGREST_NO_BUILDINGS=1` / `PGREST_NO_COLLECTIONS=1` play a project before that SQL; the Worker caches its table probe for 60 s, so wait a minute after swapping stubs) |
| `collections-seed.mjs [--live] [--dry-run]` | the first collection: "Joe's House" holding 34 Jollytail St (idempotent, fixed id), then lists everything left ungrouped. Live needs the SQL + a deployed Worker (ping lists `collections`) |
| `page-check.mjs [--dark] [--swiftshader] [--mapstyle x]` | the screens in headless Edge (real GPU: Mapbox needs WebGL 2) at 1440 and 390 px: gate, the Mapbox map (opens on Perth, tiles, clusters, card, "Back to Perth", ONE map load), the list (`page-check-list.mjs`, on the atlas: no day slider, opens on Perth, collection sections that collapse and stay collapsed after a reload, picking one flies there + Play; on a phone the whole list scrolls with a finger, rows ≥ 44 px, the LAST place opens on a tap, the map still pans), markers (never the hero; grow with zoom; card beside them; hero fallback; atlas too), 3D past zoom 15 (draws, cap, click/tap opens the card, a drag on a model pans, zooming out disposes + flattens, room.glb fallback, GPU counts back where they were after panning), the atlas fallback (`?map=atlas`, WebGL off), capture + pick map (pin, offline → atlas), viewer, the edit walk (`page-check-edit.mjs`: title, day, place by drag / GPS / typed → Save → spot page, reload, marker + 3D at the new place; 0 map loads until "Change location", then 1; offline; `?map=atlas`; a 409 from another phone; leaving asks; every spot it edits is put back), zero console errors; then runs `ar-check`, `fly-check`, `walk-check` and `walk-mp-check` as its own processes (`--no-extras` skips them, `--python` goes to ar-check; logs in `_page-check/<name>-<scheme>.log`); 123 checks, ~14 Mapbox loads a run; screenshots in `memory-rooms-work/_page-check/` |
| `ar-check.mjs [--dark] [--python <usd-core 25.8 python>]` | "See it in your space" for every spot with a model: the iPhone Quick Look links + the USDZ pulled out of the page (`usdchecker.py`, textures, 1:20 / 1:1, no ceiling on the tabletop), WebXR with `navigator.xr` mocked, the desktop QR code read back from its pixels, AR code out of the map route's bundle; no Mapbox loads |
| `usdchecker.py <file.usdz…>` | `usdchecker --arkit` for a usd-core 25.8 venv (the wheel has no CLI; it fetches the usdShaders resources the wheel leaves out) |
| `recall-check.mjs [--base url] [--dark]` | the "Recall" look, no Mapbox loads: the recall's phases (points → room → done, then ready), reduced motion, the title block's live scale bar and north arrow, callouts with leaders, the serif title + signed pull-quote, the phone's bottom sheet, the index's `No. 001`, the day strip (filter, clear), a row lifting its spot on the map, view transitions on Open and Walk in, no sideways scroll; 1440 + 390 |
| `place-check.mjs [--base url] [--dark]` | capturing a whole place on the phone, no Mapbox loads: "A whole place" → name, location, floor plan, outside → saved OFFLINE (the place page opens from the phone alone), rooms added and sketched offline (drag, size, overlap flagged and kept), back online the outbox sends it, a room captured from the checklist lands as a spot of the place; 390 + 1440 |
| `shell-view-check.mjs [--glb room.glb --scene scene.json]…` | the viewer side of any shell shape, in Node: layout previews of every example + work scene (v1, polygons, sloped ceilings, a building room), the dollhouse hiding exactly the walls facing the camera (v1 unchanged), attachedWall parity, the plan cut (clip at 1.2 m, inked walls, restore); with `--glb` a bake's wall extras match the scene |
| `freeform-check.mjs [--base url] [--dark] [--keep]` | old photos in headless Edge (no Mapbox loads): capture end to end (14 photos with EXIF, a caption, the layout step), the layout + viewpoint editor with a mouse at 1440 (outline, a door, drag a thumbnail on, move + aim a wedge, Undo / Redo, R / Delete / Ctrl+Z, no long task while dragging) and with touch at 390 on the edit page (tap thumbnail + plan, a finger drag that never scrolls the page, 44 px handles), the API's capture + EXIF after the outbox; 26 checks, run by page-check |
| `v2-view-check.mjs [--base url] [--dark] [--spot id]` | a v2 room in the real pages, no Mapbox loads: Room / Plan on the spot page (1440 + 390), a photo turns the plan off, a v1 interior has it too, the walk keeps you inside the outline and knows every wall's normal |
| `building-selftest.mjs [--samples 24] [--check-only]` | the building pipeline end to end on the synthetic two-level house: build, bake, slice, then every GLB checked against building.json (walls exactly once, extras, per-room nodes, elevations, roof, the slice's frame and normals) |
| `building-view-check.mjs [--base url] [--dark]` | a built place on its page (seed one with `dev/seed-building.mjs`): the four stages, the level picker, tap a room → its spot, no Mapbox loads; 1440 + 390 |
| `dev/recall-shots.mjs [--only map,spot,…] [--dark] [--base url]` | every page at 1440 and 390 (the spot mid-recall, a pin open, the phone sheet open) → `memory-rooms-work/_recall/`, for design review |
| `fly-check.mjs [--dark]` | "Play the trip": date order, pause/next/prev/exit, 3D at rendered stops, ONE map load, fps, the atlas version, reduced motion |
| `walk-check.mjs [--dark]` | walking a room: collision in every room (hold a key into each wall), tap-to-walk round furniture, photo marks, seats, emotes, views, disposal, fps at 1440 and 390 |
| `walk-mp-check.mjs` | walking together: two isolated browsers see each other, movement / emotes / chat mirror, join / leave, reconnect, tickets refused, teleports clamped, presence on the spot page |
| `build-characters.mjs <PixelLab export> <name> [--skip a/d/f]` | packs a PixelLab character export into the walk page's sprite sheet + layout (`src/memory-rooms/walk/characters/`) |
| `dev/seed-real-rooms.mjs [--only shed,car] [--dirs _v2-shed,_v2-lunch]` | copies the real rendered rooms in `memory-rooms-work/` into a LOCAL Worker as "(local copy)" spots; `--dirs` adds named work copies (the v2 proofs) |
| `seed-dev.mjs [--examples-only] [--no-map-assets]` | demo spots for a LOCAL Worker (refuses anything else), with their marker + map.glb unless `--no-map-assets` |
| `backfill-map-assets.mjs [--dry-run] [--only id] [--what marker,map] [--live]` | gives rendered spots pushed before them their `render/marker` and `model/map`, made from the stored hero / room.glb; a non-local Worker needs `--live` |
| `build-atlas.mjs` | rebuilds `src/memory-rooms/map/atlas.json` (the SVG fallback map) from us-atlas + world-atlas |
| `dev/marker-shots.mjs` | the markers and 3D dioramas on the map (country, city, 3D close-ups, a clicked model, atlas; light + dark, 1440 + 390) → `memory-rooms-work/_markers/<tag>-sheet.png` |
| `dev/model-soak.mjs` | fps + GPU texture/geometry counts while dragging the map with 3D models live (12 injected copies, cap 6 / 3), mouse at 1440, touch + CPU ÷4 at 390, 3D on vs off |
| `dev/map-style-shots.mjs` | the Mapbox style candidates side by side (opening view, globe, region, street; light + dark) → `memory-rooms-work/_map-styles/` |
| `dev/`, `dev-viewer/` | the UI agents' deeper headless suites (capture offline/outbox on the atlas pick map, map clusters on the atlas via `?map=atlas`, viewer alignment, disposal). `dev/map-check.mjs` and `dev/capture-check.mjs` want the fully seeded dev store: `wrangler dev --port 8794 --persist-to .wrangler/state-mr-dev` and `MR_APP=MR_API=http://127.0.0.1:8794` |
| `examples/` | `bedroom.scene.json` (interior) and `diner.scene.json` (exterior), fixtures for the kit and viewer; v2: `shed-octagon.v2.scene.json` (polygon + pyramid), `warehouse-gable.v2.scene.json` (box + off-centre gable), `house.building.json` (two levels, L-shaped ground floor, stairs, hip + skillion roof, site) and `house-living.v2.scene.json` (a room of it) |

## Run everything locally

```
npm run build
npx wrangler dev --port 8788                      # restart after every build; 8787 is another project's
node tools/memory-rooms/seed-dev.mjs --examples-only
node tools/memory-rooms/api-check.mjs
node tools/memory-rooms/page-check.mjs
```

## Worked example: the synthetic self-test

A room with a known answer, run through the whole system exactly as a trip spot would be (2026-11-08).

**The truth**: `selftest/truth/truth.scene.json`, an invented hostel bunk room, 4.40 × 3.40 × 2.75 m, a window on
the north wall, a door on the south wall and 13 objects (two bunks, lockers, table + two chairs, lamp, striped rug,
bookshelf, plant, map print, curtains, paper lantern).

```
node tools/memory-rooms/selftest/make-photos.mjs          # 1. Blender renders the 6 shot-guide "photos" (1536 × 2048), ~75 s
node tools/memory-rooms/selftest/capture.mjs              # 2. headless Edge at 390 px captures them through the REAL UI → SPOT <id>
#  3. a fresh Claude Code agent ran the memory-render skill on <id>, barred from selftest/ and every *truth* file
node tools/memory-rooms/selftest/score.mjs <id>           # 4. reconstruction vs truth → selftest/results.json
node tools/memory-rooms/selftest/screenshot.mjs <id>      #    spot page screenshots
```

Step 2 went gate → who-picker → interior → 6 photos → note + "small room" → GPS (±14 m) → save → outbox upload,
with zero console errors; the API then held 6 photos at 2048 px plus 6 thumbnails.

**Results** (spot `59b48bb5-63e7-42ce-ad0b-2ad1549a6b1c`, frame matched with 0° rotation, i.e. the modeller picked the same north):

| | reconstruction | truth | error |
|---|---|---|---|
| width | 4.29 m | 4.40 m | 0.11 m (2.5 %) |
| depth | 3.31 m | 3.40 m | 0.09 m (2.6 %) |
| height | 2.73 m | 2.75 m | 0.02 m |
| objects found | 13 of 13 (no extras) | 13 | every kit right, every facing right |
| object position | | | mean 0.07 m, median 0.08 m, worst 0.10 m (bookshelf) |
| object size | | | mean 0.03 m per axis |
| door | south, 0.82 m wide | south, 0.82 m | offset 0.11 m |
| window | north, 0.80 m wide | north, 1.20 m | offset 0.21 m, width 0.40 m (the weakest call: the open curtains hide the frame) |
| cameras (6) | | | position mean 0.10 m (0.04–0.14), aim mean 1°, fov within 1° |

Photo vs render, mean over the 6 cameras (compare.json; 1 = identical):

| round | structure | tone | colour |
|---|---|---|---|
| 1 | 0.668 | 0.960 | 0.898 |
| 2 | 0.743 | 0.970 | 0.915 |
| 3 | 0.769 | 0.973 | 0.927 |

Time: pull and palette < 1 s each, writing layout.md + scene.json 23 min (mostly measuring), 3 build rounds of
~22 s each (plus reading the sheets), bake 2 min 41 s, push 1 s: about 37 min for the spot.

**Read these numbers with care.** The photos were rendered by the same kit and renderer the modeller builds with,
so recognising furniture and matching its proportions is easier than it will be with real phone photos (lens
distortion, clutter, mixed light, furniture the kit only approximates), and the scale anchors (door, skirting)
were exact. Real rooms without a floor plan should be expected to land further out; with a floor plan the room
size is given and only the contents are estimated.

What the run taught the skill (already folded into SKILL.md): define "north" as the wall you face from the
doorway; solve the room and cameras together from corner photos; a doorway camera is allowed; read the new
**edges** column of compare.png (photo edges red, render edges blue) for 2–5 cm offsets.

Local artefacts (gitignored): `memory-rooms-work/59b48bb5-…/` (layout.md, scene.json, compare-round1–3.png,
renders/hero.png, room.glb) and `memory-rooms-work/_selftest-truth/` (truth renders, photos, spot-page screenshots).

## Freeform known-answer test: old photos (2026-11-25)

The camera fit for old photos (`freeform/fit.py`, CONTRACTS.md 8, skill "Freeform spots") against rooms with a
known answer, the way an old-photo spot arrives: photos **shuffled** and renumbered, **EXIF stripped** (one shared,
free field of view), **no viewpoints** (run A), then **3 rough viewpoints** (run B: the true spot moved 0.4 m in a
random direction, the yaw off by up to ±20°, as James would drop them on the plan).

```
python tools/memory-rooms/freeform/known_answer.py        # → freeform/known-answer.json (~15 min; --only synthetic|batcave)
```

| | synthetic self-test room, A | synthetic, B | The Batcave, A | The Batcave, B |
|---|---|---|---|---|
| marks (points + line pixels) | 116 (projected truth + 2 px noise) | 116 | 188 (real marks from its guided render) | 188 |
| pixel rms | 1.26 px | 1.26 px | 3.74 px | 3.74 px |
| room W × D × H | 4.405 × 3.421 × 2.759 | 4.399 × 3.417 × 2.755 | 7.242 × 5.215 × 2.674 | 7.242 × 5.215 × 2.674 |
| answer | 4.40 × 3.40 × 2.75 | | plan 7.33 × 5.01 × 2.743 | |
| room error | 0.1 / 0.6 / 0.3 % | 0.0 / 0.5 / 0.2 % | 1.2 / 4.1 / 2.5 % | 1.2 / 4.1 / 2.5 % |
| camera position | mean 2.3 cm (max 3.5) | 2.2 cm (max 3.5) | 0.71 m (max 2.07) vs the guided solve; 0.72 m vs the plan solve (similarity-aligned) | the same |
| camera aim | mean 0.25° (max 0.4°) | 0.24° (max 0.37°) | 4.2° (max 6.2°) vs guided; 4.6° vs plan | the same |
| objects (seen ≥ 2×) | median 1.5 cm, mean 4.6 cm, max 18 cm (8) | median 1.4 cm, mean 4.5 cm | the six downlights + the TV's edge, in plan vs the guided solve: median 0.29 m, max 0.44 m (0.28 m mean vs the plan solve) | the same |

Read it this way:

- **Synthetic** is the ceiling: perfect geometry, honest 2 px noise, no occlusion, a 2.04 m door as the scale.
  Every shuffled photo found its corner by the grid search alone. Five objects were seen in only one photo
  (bunk-east, lockers, shelf, plant, pendant): one view gives a ray, not a place, so the skill sizes those from the
  kit and the photo instead of the fit.
- **The Batcave** is the real case: phone photos, hand-made marks, a room model without the guided session's radial
  distortion and vertical segments, and the only scale a benchtop assumed at 0.88 m. The room lands within 4 % of
  the builder's plan (the guided fit from the same marks made it 7.97 × 5.26, so the freeform fit is closer). The
  cameras sit about 0.7 m and 4° from either reference, and the two references disagree with each other by about as
  much (the plan solve's west wall is 0.9 m from where the marks put it, DECISIONS 189). One camera (photo 5)
  carries most of that at 2.1 m; the other five are 0.3–0.5 m off.
- **Rough viewpoints did not change either room.** That was a FIX, not luck. The first version started each such
  camera only from its viewpoint, and the Batcave came out 9.7 × 6.0 × 3.1 m (32 % too wide) at a worse pixel rms
  than with no viewpoints at all. The room's scale is held weakly (one 0.88 m benchtop), so the first joint solve
  slid down that valley. Now fit.py runs the search both ways and keeps the lower objective (DECISIONS 227). On a
  real old-photo room with less structure in each photo, the viewpoints are what tell a mirrored corner from the
  right one, and that case isn't covered by these two rooms.
