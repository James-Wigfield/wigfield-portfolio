---
name: memory-render
description: Turn a Memory Rooms trip spot (phone photos + one line) into a Blender-built, baked 3D room on /memories. Use for "render spot X", "render the next captured spots", "model the hostel room", "redo the bedroom render", or James handing over a floor plan for a house room.
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
Bakes the lighting into one atlas, exports `room.glb` (WebP, target ≤ 8 MB) and renders `renders/hero.png` at full samples. Read `hero.png`: it's the map card, so it must look good.

## 8. Push

```
node tools/memory-rooms/push.mjs <spotId>
```
Uploads room.glb, every render and compare sheet, saves the scene (validated again by the Worker, `sceneVersion` +1) and sets the status to `rendered`. Then open `/memories/<spotId>` to see it.

## "Render the next captured spots"

Loop: `pull.mjs --next` → steps 2–8 → repeat until `--next` says nothing is waiting. Do one spot fully before starting the next. At the end, report per spot: dimensions and their source, rounds used, final scores from `compare.json`, what's still off.

## Quality bar

A polished, stylised miniature that is recognisably THAT place: right proportions, right furniture in the right spots, right colours, the memory's object pinned. Not photoreal. Every spot shares one look (the kit's materials and lighting); don't fight it with odd exposure settings unless the photos are clearly night or golden hour (`style.mood`).
