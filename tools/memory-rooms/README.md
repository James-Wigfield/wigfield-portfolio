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
| `pull.mjs <id> \| --next \| --list` | downloads a spot to `memory-rooms-work/<id>/` (gitignored): photos, thumbs, `spot.json`, `photos.json`, scan, saved scene, a `layout.md` template, `bespoke/`; sets status `modelling` |
| `palette.mjs <id>` | k-means (CIELAB) colours per photo → `palette.json` + `palette.png` |
| `check-scene.mjs <scene.json \| id> [--building <file>]` | schema + geometry: inside the shell, nothing floats or interpenetrates > 2 cm, openings fit, cameras inside and aimed at something. v2 shells (polygon, sloped ceiling, a room of a building) are checked against the normalised shell; a room of a building needs its building.json (`--building`, or `building.json` next to the scene, or `memory-rooms-work/b-<buildingId>/`) |
| `build.mjs <id> [--round N] [--samples 64] [--only cam1,top]` | check-scene → `blender/build_room.py` → `compare.mjs` |
| `blender/build_room.py` | scene.json → `room.blend` + Cycles renders `renders/cam<n>.png`, `top.png`, `three-quarter.png`, `build-report.json` |
| `compare.mjs <id> [--round N]` | `compare.png`: photo \| render \| 50/50 overlay per camera + top-down, with structure/tone/colour scores (`compare.json`) |
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
| `api-check.mjs` | every `/api/memories` route (73 checks: incl. the edit PATCH, `ifUpdatedAt` → 409, a re-POST never undoing an edit, the walk ticket / presence / socket door: 401, 400, 404, a tampered ticket 403, no upgrade 426), against any running Worker |
| `pgrest-stub.mjs` | in-memory PostgREST stand-in to run api-check against the Supabase row store locally |
| `page-check.mjs [--dark] [--swiftshader] [--mapstyle x]` | the screens in headless Edge (real GPU: Mapbox needs WebGL 2) at 1440 and 390 px: gate, the Mapbox map (tiles, clusters, card, elsewhere, reset, ONE map load), markers (never the hero; grow with zoom; card beside them; hero fallback; atlas too), 3D past zoom 15 (draws, cap, click/tap opens the card, a drag on a model pans, zooming out disposes + flattens, room.glb fallback, GPU counts back where they were after panning), the atlas fallback (`?map=atlas`, WebGL off), capture + pick map (pin, offline → atlas), viewer, the edit walk (`page-check-edit.mjs`: title, day, place by drag / GPS / typed → Save → spot page, reload, marker + 3D at the new place; 0 map loads until "Change location", then 1; offline; `?map=atlas`; a 409 from another phone; leaving asks; every spot it edits is put back), zero console errors; then runs `ar-check`, `fly-check`, `walk-check` and `walk-mp-check` as its own processes (`--no-extras` skips them, `--python` goes to ar-check; logs in `_page-check/<name>-<scheme>.log`); 123 checks, ~14 Mapbox loads a run; screenshots in `memory-rooms-work/_page-check/` |
| `ar-check.mjs [--dark] [--python <usd-core 25.8 python>]` | "See it in your space" for every spot with a model: the iPhone Quick Look links + the USDZ pulled out of the page (`usdchecker.py`, textures, 1:20 / 1:1, no ceiling on the tabletop), WebXR with `navigator.xr` mocked, the desktop QR code read back from its pixels, AR code out of the map route's bundle; no Mapbox loads |
| `usdchecker.py <file.usdz…>` | `usdchecker --arkit` for a usd-core 25.8 venv (the wheel has no CLI; it fetches the usdShaders resources the wheel leaves out) |
| `recall-check.mjs [--base url] [--dark]` | the "Recall" look, no Mapbox loads: the recall's phases (points → room → done, then ready), reduced motion, the title block's live scale bar and north arrow, callouts with leaders, the serif title + signed pull-quote, the phone's bottom sheet, the index's `No. 001`, the day strip (filter, clear), a row lifting its spot on the map, view transitions on Open and Walk in, no sideways scroll; 1440 + 390 |
| `place-check.mjs [--base url] [--dark]` | capturing a whole place on the phone, no Mapbox loads: "A whole place" → name, location, floor plan, outside → saved OFFLINE (the place page opens from the phone alone), rooms added and sketched offline (drag, size, overlap flagged and kept), back online the outbox sends it, a room captured from the checklist lands as a spot of the place; 390 + 1440 |
| `shell-view-check.mjs [--glb room.glb --scene scene.json]…` | the viewer side of any shell shape, in Node: layout previews of every example + work scene (v1, polygons, sloped ceilings, a building room), the dollhouse hiding exactly the walls facing the camera (v1 unchanged), attachedWall parity, the plan cut (clip at 1.2 m, inked walls, restore); with `--glb` a bake's wall extras match the scene |
| `v2-view-check.mjs [--base url] [--dark] [--spot id]` | a v2 room in the real pages, no Mapbox loads: Room / Plan on the spot page (1440 + 390), a photo turns the plan off, a v1 interior has it too, the walk keeps you inside the outline and knows every wall's normal |
| `building-selftest.mjs [--samples 24] [--check-only]` | the building pipeline end to end on the synthetic two-level house: build, bake, slice, then every GLB checked against building.json (walls exactly once, extras, per-room nodes, elevations, roof, the slice's frame and normals) |
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
