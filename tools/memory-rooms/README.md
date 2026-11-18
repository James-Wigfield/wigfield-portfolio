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
| `check-scene.mjs <scene.json \| id>` | schema + geometry: inside the shell, nothing floats or interpenetrates > 2 cm, openings fit, cameras inside and aimed at something |
| `build.mjs <id> [--round N] [--samples 64] [--only cam1,top]` | check-scene → `blender/build_room.py` → `compare.mjs` |
| `blender/build_room.py` | scene.json → `room.blend` + Cycles renders `renders/cam<n>.png`, `top.png`, `three-quarter.png`, `build-report.json` |
| `compare.mjs <id> [--round N]` | `compare.png`: photo \| render \| 50/50 overlay per camera + top-down, with structure/tone/colour scores (`compare.json`) |
| `bake.mjs <id>` | `blender/bake_export.py`: bakes the lighting into one atlas, exports `room.glb` (WebP, ≤ 8 MB target), `renders/hero.png`; then what the map shows: `renders/marker.png` (`lib/marker.mjs`) and `map.glb` (`lib/mapModel.mjs`) |
| `push.mjs <id> [--dry-run]` | uploads `room.glb` + `map.glb` + renders + compare sheets (making `map.glb` / `marker.png` if missing or stale), saves the scene (validated, version +1), status `rendered` |

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
| `api-check.mjs` | every `/api/memories` route (31 checks), against any running Worker |
| `pgrest-stub.mjs` | in-memory PostgREST stand-in to run api-check against the Supabase row store locally |
| `page-check.mjs [--dark] [--swiftshader] [--mapstyle x]` | the screens in headless Edge (real GPU: Mapbox needs WebGL 2) at 1440 and 390 px: gate, the Mapbox map (tiles, clusters, card, elsewhere, reset, ONE map load), markers (never the hero; grow with zoom; card beside them; hero fallback; atlas too), 3D past zoom 15 (draws, cap, click/tap opens the card, a drag on a model pans, zooming out disposes + flattens, room.glb fallback, GPU counts back where they were after panning), the atlas fallback (`?map=atlas`, WebGL off), capture + pick map (pin, offline → atlas), viewer, zero console errors; ~7 Mapbox loads a run; screenshots in `memory-rooms-work/_page-check/` |
| `seed-dev.mjs [--examples-only] [--no-map-assets]` | demo spots for a LOCAL Worker (refuses anything else), with their marker + map.glb unless `--no-map-assets` |
| `backfill-map-assets.mjs [--dry-run] [--only id] [--what marker,map] [--live]` | gives rendered spots pushed before them their `render/marker` and `model/map`, made from the stored hero / room.glb; a non-local Worker needs `--live` |
| `build-atlas.mjs` | rebuilds `src/memory-rooms/map/atlas.json` (the SVG fallback map) from us-atlas + world-atlas |
| `dev/marker-shots.mjs` | the markers and 3D dioramas on the map (country, city, 3D close-ups, a clicked model, atlas; light + dark, 1440 + 390) → `memory-rooms-work/_markers/<tag>-sheet.png` |
| `dev/model-soak.mjs` | fps + GPU texture/geometry counts while dragging the map with 3D models live (12 injected copies, cap 6 / 3), mouse at 1440, touch + CPU ÷4 at 390, 3D on vs off |
| `dev/map-style-shots.mjs` | the Mapbox style candidates side by side (opening view, globe, region, street; light + dark) → `memory-rooms-work/_map-styles/` |
| `dev/`, `dev-viewer/` | the UI agents' deeper headless suites (capture offline/outbox, map clusters on the atlas via `?map=atlas`, viewer alignment, disposal) |
| `examples/` | `bedroom.scene.json` (interior) and `diner.scene.json` (exterior), fixtures for the kit and viewer |

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
