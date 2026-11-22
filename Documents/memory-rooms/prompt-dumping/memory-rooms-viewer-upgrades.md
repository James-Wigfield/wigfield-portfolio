# Memory Rooms: viewer upgrades (theme, spin, level slider, side-by-side plans, empty/furnished, place walk, open sheers)

Work in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`. The site is live at https://jameswigfield.com/memories.
Live API: `MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=memories`. Local: `npm run build` then
`npx wrangler dev --port 8788` (8787 belongs to another project; restart wrangler after every rebuild).

## Read first
- `CLAUDE.md` (the Obsidian vault rule) and the vault note `01-Active-Projects/memory-rooms.md`, plus the dev logs
  `03-Dev-Logs/2026-11-21-memory-rooms-building-page.md`, `…-building-pipeline.md`, `2026-11-19-memory-rooms-ar-flyover-walk.md`
  and `2026-11-22-memory-rooms-12b-fletcher-pass3-batcave.md`.
- `src/memory-rooms/CONTRACTS.md` (§4 GLB, §6 buildings + scene v2, §6.3 node naming) and `tools/memory-rooms/DECISIONS.md`
  (168–177 = the building page, 172 = what was left out, 189–191 = pass 3).
- The `memory-render` skill (`.claude/skills/memory-render/SKILL.md`), for the re-bake in part 7.
- Code you'll touch: `src/memory-rooms/viewer/` (`RoomViewer.js`, `ViewerControls.jsx`, `buildingStage.js`, `dollhouse.js`,
  `planCut.js`, `bakedMaterials.js`), `src/memory-rooms/pages/place/` (`BuildingView.jsx`, `PlanView.jsx`),
  `src/memory-rooms/walk/` + `pages/WalkPage.jsx` + `workers/memory-walk.js` (Durable Object `MemoryWalkRoom`),
  `src/memory-rooms/memory-rooms.css` (tokens; light + dark follow `prefers-color-scheme` today),
  `tools/memory-rooms/blender/` (`build_building.py`, `bake_export.py`, `slice_rooms.py`), `tools/memory-rooms/build-building.mjs`,
  `push-building.mjs`, `workers/memory-rooms.js`.

## First: commit what pass 3 left
`git status` will show `tools/memory-rooms/DECISIONS.md` (189–191) and `.claude/skills/memory-render/SKILL.md` changed by
pass 3 (The Batcave merged into 12B Fletcher St; already live). Commit them on their own first:
`memory rooms: 12B Fletcher pass 3 - The Batcave merged into the house (DECISIONS 189-191)`.

## Decisions already made (James)
- Theme toggle: **Memory Rooms pages only** (`/memories…`), not the rest of jameswigfield.com.
- Empty / furnished: **two bakes per level, swap textures** (exact look both ways, no ghost shadows).
- A place is walkable **like a room: multiplayer, with stairs between levels**.
- Ship it: **commit in logical pieces, deploy the Worker, re-bake + push 12B Fletcher and The Batcave live, verify on the
  live site (light + dark)**.
- Look: keep the existing Recall editorial style (ruled layouts, small caps labels, a labelled dot for state). No
  coloured rounded left-border callout boxes, no filled pills, no new visual language. Every new control works by
  keyboard, has a visible focus state, and fits a 390 px phone with no sideways scroll.

## The changes

### 1. Light / dark toggle (small)
- A toggle in the `/memories` header (every Memory Rooms page: map, spot, place, walk, capture, edit).
- Three states are fine (System / Light / Dark) or two with System as the unset default: until the person picks, it
  follows `prefers-color-scheme`; once picked it's remembered on that device (localStorage, wrapped in try/catch).
- Implement it as `data-theme` on the Memory Rooms root driving the SAME tokens the media queries set today (refactor
  the `@media (prefers-color-scheme: dark)` blocks in `memory-rooms.css` so both routes share one token block; no
  duplicated colour values). The three.js viewer, the Mapbox style tokens (`--mr-map-*`), the map's SVG atlas, the
  walk and the AR panel must all follow it live, without a reload. No flash of the wrong theme on load.

### 2. Slow cinematic spin (small)
- A "Spin" toggle in the viewer controls of every room (spot page), place (building page, every stage) and group page.
- A slow turntable round the model's centre: about one turn per 60–90 s, eased in and out (no snap), constant
  elevation. Off by default. A drag / pinch / wheel or flying to a photo viewpoint stops it (the toggle shows that);
  it stops when the tab is hidden. `prefers-reduced-motion: reduce` → the toggle still works but only when pressed,
  never auto. No extra cost when off (no extra render loop: drive it from the existing frame loop).

### 3. Structure vs furniture, and the empty / furnished toggle (the core change; do it before 4–7)
- **Label it in the GLB, not by guessing from names.** Every node a bake exports gets glTF extras
  `mrKind: "structure" | "furniture"` (walls, floors, ceilings, stairs, slabs, roof, site = structure; every scene
  object = furniture). Add it to CONTRACTS.md §4 / §6.3 and to the validators' docs; the viewer falls back to the
  name rules (`obj__…`, `room__<room>__obj__…` = furniture) for GLBs baked before this.
- **Two bakes per level.** `build-building.mjs` / `bake_export.py`: after the furnished bake, bake the level's
  STRUCTURE again with the furniture hidden from the render (so walls and floors get clean light, no furniture
  shadows), into the same lightmap UV layout. Ship only what differs: the empty-state atlas texture(s) of the
  structural meshes (WebP, as the main atlas), not a second copy of the geometry. Name and store them as new media on
  the building (e.g. `model/level-<id>-empty` or `texture/…`; design the R2 key + the Worker route + the ping feature
  flag, and document them in CONTRACTS.md §6.4). The same for a building room's slice (`room.glb` on its spot) so the
  spot page can toggle too; a plain spot (no building) has no empty state and doesn't show the toggle.
- **The toggle** ("Furnished" on / off) on the place page (Inside, Levels, Plan, Outside) and on a building room's spot
  page. Off = hide every `furniture` node and swap the structural materials' baked map to the empty atlas. Load the
  empty atlas lazily on first use, then switching is instant (texture swap + visibility only: no geometry reload, no
  re-parse). One state shared by every stage on the page.
- check-contracts / building-selftest / building-view-check / page-check cover it (labels present, toggle hides only
  furniture, the empty atlas loads once, no console errors).

### 4. Plan: every level side by side (a standard for multi-level buildings)
- Plan no longer has Ground floor / First floor sub-tabs: it shows **every level in one top-down view**, side by side
  in level order (lowest first), each cut at 1.2 m with its section cap, the same scale and the same plan north, a
  fixed gap between them, each labelled with its level name in the Recall style.
- Make the arrangement one pure, shared function (e.g. `levelPlanLayout(building, aspect)` in
  `src/memory-rooms/building/`) that every multi-level building uses: left → right on a wide screen, top → bottom when
  the view is portrait (phones), N levels, levels of different footprints aligned on their shared plan origin. Taps
  on a room still map back to the right level and open its spot; the framing fits all levels. Document it in
  CONTRACTS.md (§6) and add a check (2-level 12B Fletcher + a synthetic 3-level case in building-selftest).

### 5. Inside: a level slider
- Inside currently opens only the top level, which hides every lower floor (on 12B Fletcher the furnished Batcave is
  invisible). Add a slider (vertical, labelled with the level names, top level at the top) that moves the cut down
  through the building: picking a lower level lifts the levels above it up and away (eased, cinematic, they fade),
  opens that level as the dollhouse and re-frames the camera on it. Dragging the slider scrubs smoothly between
  levels. Default = the top level (as now). Keyboard: arrow keys move a level.

### 6. Walk a whole place (multiplayer, with stairs)
- `/memories/b/:id/walk` + a "Walk in" button on the place page, the same game as a room walk (DECISIONS 172 listed it
  as not built): your PixelLab traveller, others in the same place, chat, sit / wave / jump, photo marks of every
  captured room's photos.
- The Durable Object `MemoryWalkRoom` keyed by the building (namespace the key so a building id can never collide with
  a spot id), the same signed ticket.
- Collision per level from the level GLBs (as rooms do from room.glb); stairs from building.json (`stairFootprint`):
  walking up a flight moves you to the next level (and down again), with each player's level in the presence state so
  you only see the people on your level (plus a "Justin is upstairs" note). The camera follows across levels; the
  upper levels hide above you as in the dollhouse. Furnished rooms show furnished.
- The place page says who is walking in it (as the spot page does). Extend walk-check / walk-mp-check (two players,
  one goes upstairs).

### 7. The Batcave: sheers open, re-rendered
- In the real room the sheer wave curtains cover the 5810 stacker (north, the back of the house) and the 2410 slider
  (south). James wants them OPEN, so that from behind the house you can look through the stacker's glass into the
  furnished room.
- `bespoke/wave_curtain.py` in `memory-rooms-work/59b68a1b-c157-44c3-a92c-c2be9bb43092/` draws a closed sheer: give
  it an `open` param that bunches the fabric into tight stacks at the ends of its track (realistic stack width for a
  sheer, ~10–12 % of the track per side), clear of the glass. Set it on `curtain-n` and `curtain-s` in `merge.py`
  (scene.json is generated by `merge.py`: change it there, then run it with numpy; layout.md explains the pieces).
- Re-bake (both bakes, part 3), slice, re-render the spot's hero with `herocut.py` (same folder), `push.mjs
  59b68a1b-…` and `push-building.mjs 001c25b7-… --live`. Prove it: a render (and the live Outside stage) from behind
  the house showing the room through the stacker (`memory-rooms-work/b-001c25b7-…/compose.py` has the back
  camera `p5-back`). Glass is exported at alpha 0.18, so it should read; if the viewer makes it opaque, fix that.

## Shipping order and checks
1. The pass 3 commit. 2. Theme. 3. Spin. 4. Structure labels + two bakes + the toggle (contract → Blender → Worker →
   viewer). 5. Side-by-side plan. 6. Inside slider. 7. Re-bake 12B Fletcher with the open sheers (both bakes) and push
   it. 8. The place walk. Commit after each piece with a plain message; add DECISIONS entries (192+) as you go.
- Checks to keep green (light + dark): `check-contracts`, `building-selftest`, `api-check`, `page-check` (runs
  ar / fly / walk / walk-mp checks), `building-view-check`, `walk-check`, `walk-mp-check`, `shell-view-check` on the new
  slices. Use local Edge headless (`puppeteer-core`, `--use-angle=d3d11`) and set `localStorage mr:map = atlas` in
  checks (Mapbox loads are billed).
- Deploy: `npm run build` + the Worker deploy **from local `main`** (a deploy once went out from another worktree and
  missed features). After deploying, check the live ping lists every new feature flag BEFORE any live push: the Worker
  validates pushed plans with its bundled schema, and a push to an old Worker fails or, worse, overwrites. A push to
  GitHub is not a deploy.
- Live verification (headless Edge, light + dark, 1440 and 390 wide): theme toggle on each page type, spin on a spot
  and on the place, the Inside slider showing the ground floor with the Batcave, Plan showing both floors side by side,
  the empty / furnished toggle (Plan of the ground floor with and without the Batcave's furniture, no ghost shadows),
  the Outside view from the back seeing into the room, a two-player place walk going upstairs, no console errors.

## Report back (short bullets)
- What each change does and where it lives; the new contract fields / media / routes.
- Bake times and sizes (furnished + empty), the live links, check results, anything you couldn't finish or verify.
- Update the vault (a new dev log + the project note), DECISIONS, CONTRACTS.md, the memory-render skill notes and the
  Memory Rooms memory, per `CLAUDE.md`.
