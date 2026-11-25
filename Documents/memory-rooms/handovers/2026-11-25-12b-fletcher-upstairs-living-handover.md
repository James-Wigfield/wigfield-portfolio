# Handover: 12B Fletcher St, the Upstairs Living (2026-11-25)

The Upstairs Living (spot `20a4171c-e111-47f0-b582-61e250046034`, room `upstairs-living`) is **rendered and live**.
It is the house's third room, after The Batcave and the Foyer. Next candidate: the Library Hallway spot
`3922493f-34da-48ef-a2d3-2a6dad481dea` (captured, 6 photos, still `captured`).

## Where things stand
- **Live:**
  - spot: https://jameswigfield.com/memories/20a4171c-e111-47f0-b582-61e250046034
  - place: https://jameswigfield.com/memories/b/001c25b7-a2bd-4d71-a476-739b941f8f69
  - `live-shot.mjs` (headless Edge): both pages ready, no console errors. The place reads "4 of 12 rooms captured".
- **Building:** plan **v7** pushed. All level GLBs, the exterior, the renders and the marker went up again; ground +
  exterior are the unchanged 23/24 Nov files.
- **Spot:** scene v1, status rendered. Pushed room.glb 4.1 MB, map.glb 1.0 MB, room-empty.glb 0.7 MB, hero, marker.
- **No Worker deploy needed.** No contract or schema change: `wall.height` already existed.
- **Nothing is committed.** Suggested message: `memory rooms: Upstairs Living (12B Fletcher) + raking skillion ceilings,
  over-tall walls clipped to the roof (DECISIONS 208-209)`.
- **Not pushed on purpose:** the Batcave's and Foyer's local `room.glb` slices. Both are newer than live (they were
  re-sliced in the Foyer session). So push this house WITHOUT `--rooms`, then `push.mjs` for one spot at a time.

## Uncommitted repo changes
| File | What changed |
|---|---|
| `tools/memory-rooms/blender/build_building.py` | Room ceilings with `shape: "skillion"` are now built **raking** (`height` → `peak` across the room's inner bbox, same formula as shell.js `ceilingAt`); before this every building ceiling was flat. New `clip_to_skillion()`: a wall whose `height` exceeds its level's is bisected by the roof part's plane and capped (skin AND inside walls). |
| `tools/memory-rooms/DECISIONS.md` | 208 (raking skillion ceilings), 209 (walls taller than their level cut to the roof plane) |

Both changes affect any building rebuilt from now on. **34 Jollytail St** has five skillion rooms (kitchen, dining,
living, master-bed, wir) that were baked flat. They will rake on the next build: check them, and re-push if they
look right.

Untracked and staying out of git: `Documents/memory-rooms/assets/`, `prompt-dumping/`, `Documents/dream-rooms/`.

## Building plan changes (work folder `memory-rooms-work/b-001c25b7-a2bd-4d71-a476-739b941f8f69/`, git-ignored)
`trace.py` is still the source of truth; `python trace.py` writes `building.json`. Backups from before this pass:
`trace.pre-living.py`, `building.pre-living.json`, `backup-pre-living/` (the old first level + level-first.glb +
exterior.glb).
- **Scullery as its own room** (`scullery`, kind wet): its 90 stud wall is on x 2.535 (in line with the PDR2 wall),
  running from the family wall north to z 10.63. Its north wall at 10.63 has an 0.8 m opening (`scull-way`). Sources:
  the A.05 chains "2,060 SCULLERY 90" and "5,070 KITCHEN 650 P. 3,290".
  - The scullery's east face is the **painting wall** in photos 2 and 6.
  - New nodes: `fsw`, `fsc`, `fsa`.
  - `f-w1` / `f-s1` were split: `f-w1n` and `f-s1w` are the new pieces; the openings keep their old wall ids.
- **Hi-lites** (A.05 notes: "10c HI-LITE WINDOW OVER", "RAKING HI-LITES OVER"):
  - East wall `f-e1` (`h` 3.66): three bays `fam-hilite-e1..3`, sill 2.72, 0.86 tall.
  - North wall `f-n2` (`h` 3.6): six panes `fam-hilite-n1..6` over the stacker, sill 2.5. Each is as tall as the
    raking ceiling allows at its west end, so their tops step up eastward. The builder clips the wall to the roof.
- **Inside walls reach the raking ceiling:**
  - `f-s1` (`h` 3.3), `f-sc-e` and `f-sc-n` (`h` 3.0). All three are cut to the roof plane, so there is no slot
    above them.
- **Hallway doorway** `hall-fam` moved from 2.9 to **2.62** (plan x): the photos show it hard against the painting
  wall.
- **Room pins:**
  - `upstairs-living`: `origin` [0.315, 4.829], `spotIds` [LIVING]. Its outline is now an L: f1 f2 f3 f4 f5 fsa fsc fsw.
  - `library-hallway`'s outline gained `fsa`.
- **Floors:** first-floor timber is now **#c2a283**, the photographed light oak. This covers living, scullery, library
  hallway and landing.

## The spot folder (`memory-rooms-work/20a4171c-e111-47f0-b582-61e250046034/`)
- `layout.md`: sources, dimensions, cameras, objects, compare rounds, still-off list.
- `fit/` (run with `PYTHONPATH=<scratchpad>/pylib`; scipy was pip-installed there, so reinstall it in a new session):
  - `fit.py`: plan points plus **LINE marks**. A line mark is a pixel that must lie on a known 3D line: hi-lite
    sills and heads, the stacker head and sill, wall–floor lines. Much better constrained than points alone.
  - `bundle.py`: a **joint solve** of all six cameras with the island box, the painting and the TV (corners seen from
    2–5 photos), with the hi-lite heights left free. Writes `cams.json` + `objects.json`.
  - `overlay.py <n>`: the plan's wireframe + scene boxes drawn over photo n → `ov_<n>.png`.
  - `bp.py <n> <x|y|z> <v> px,py`: back-projects original pixels onto a plane.
  - `make_scene.py` **writes scene.json** (edit there, not in scene.json). The room-frame constants and the ceiling
    formula `c(x)` are at its top.
- `bespoke/`:
  - `living_bits.py` (new): waterfall `island`, `linear` pendant, ceiling `fan` (param `above` lets the canopy reach
    a raking ceiling), swivel `tub` chair, `pouf`.
  - `live_edge.py`: copied from the Batcave, plus `legs: "block"` (square timber legs + an apron).
  - `wave_curtain.py`, `soft.py`: copied from the Batcave.
  - `canvas.py`: copied from the Foyer. Its face is `painting_birds.jpg`, rectified out of photo 2 with the sax neck
    patched out.
- `roomcams.py`: renders the photo cameras inside `levels/first/room.blend` into `r<n>/`; then run
  `compare.mjs <dir>/r<n> --round n`.
- `herocut.py <spot> 8.11 9.06`: makes the hero from the room's slice.
- `live-shot.mjs`: screenshots the live spot + place pages into `live/`.

## Commands (repo root)
```
python memory-rooms-work/b-001c25b7-a2bd-4d71-a476-739b941f8f69/trace.py                     # building.json
node tools/memory-rooms/check-scene.mjs 20a4171c-e111-47f0-b582-61e250046034                 # 0 errors now
node tools/memory-rooms/build-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --only first --no-bake --samples 32   # ~4 s
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b <abs>/levels/first/room.blend \
  --python <abs spot>/roomcams.py -- <abs spot> <abs spot>/r4 32 && node tools/memory-rooms/compare.mjs <abs spot>/r4 --round 4
node tools/memory-rooms/build-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --only first --samples 128            # full bake ~18 min, also slices the room
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python <abs spot>/herocut.py -- <abs spot> 8.11 9.06
MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=<PORTAL_PASSWORD from .dev.vars> \
  node tools/memory-rooms/push-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --live      # NO --rooms (see above)
MEMORIES_API=... MEMORIES_PASSWORD=... node tools/memory-rooms/push.mjs 20a4171c-e111-47f0-b582-61e250046034 --live
```
`--only first` bakes and slices only the first floor. Ground and exterior are untouched, and the Foyer's slice
(which appends the first floor's bake) is NOT re-made.

## Results
- Compare structure, by round:
  - round 1: **0.334** (flat ceiling, generic painting)
  - round 2: **0.343** (raking ceiling + hi-lites, photo painting)
  - round 3: **0.331** (photo 5 better; photo 2's lowered camera was worse and was reverted to round 2)
  - For comparison, the Foyer finished at 0.30.
- Cameras: 10–20 px rms.
  - They solve at **fov 71–82°**, wider than the plain 1× lens. The house's `photo-notes.md` lists 18 mm and 24 mm
    shots, so the lens may have varied.
  - Cameras 3 and 4 sit at the room's south limit (z 9.0). Camera 6 is in the hallway doorway (z 9.6, shot low
    ~1.0 m). Cameras 2 and 4 come out held high (2.2 m).
- First-level bake: 1056 s at 128 samples (furnished + empty).

## Still off
- **Live dollhouse:** the south window's sheer (`curtain-s`) stays visible in front of the sofa when the viewer cuts
  that wall away. `herocut.py` hides it, but the viewer doesn't, because the curtain isn't attached to its wall.
  - Possible fix: drop the sheer.
  - Or find how the viewer hides wall-mounted pieces (the Batcave's curtains) and do the same.
  - Either way the fix needs another `--only first` bake + push.
- Camera poses are approximate, so the photo ↔ model blend lines up roughly, not exactly.
- Furniture approximations:
  - The kit sofa is tighter and squarer than the real loose modular.
  - The clear acrylic chairs bake white.
  - The poufs are plain (really floral).
  - Fans float a little in the dollhouse (the ceiling is cut away).
- Not modelled: the TV-wall timber battens, the robot vacuum, the wine fridge in the coffee nook.

## Gotchas learned
- **Building ceilings used to be flat whatever the scene said.** If a raking room looks flat, check the
  `ceiling__<room>` vertex heights in the level blend first.
- **A window above the level height needs the wall's `h` raised.** The builder then clips the wall to the roof.
  Raking panes are separate rectangles, each topped at its low end's ceiling.
- **Photos taken from a doorway or held high push the solve to the bounds.** Keep the cameras inside the room with
  bounds and loosen the eye-height prior per photo (`EYE` in `bundle.py`). Photo 6 was shot at ~1.0 m.
- **Fans under a raking ceiling:** a 1.3 m footprint "pokes through" on its low side. Use `mount: "free"` +
  `above: 0.08`.
- **Cushions on a sofa:** `mount: "on"` fails (the sofa box top isn't the seat). Use `mount: "free"`.
- Blender `-b <blend>` needs ABSOLUTE output paths.

## Records
- Vault:
  - `03-Dev-Logs/2026-11-25-memory-rooms-upstairs-living.md`
  - `01-Active-Projects/memory-rooms.md` (status line + dev-log list)
- Memory: `project_memory_rooms.md` (the Upstairs Living paragraph), `MEMORY.md` index line.
- `tools/memory-rooms/DECISIONS.md` 208–209.
