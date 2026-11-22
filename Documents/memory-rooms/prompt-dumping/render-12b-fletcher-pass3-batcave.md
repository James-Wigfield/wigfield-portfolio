# 12B Fletcher St, pass 3: merge "The Batcave" into the house

Run this **after pass 2 is pushed**: the stair fix changes the Batcave's kitchen corner.

Use the `memory-render` skill (both the single-spot steps and "Whole places"). Work in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`, live: `MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=memories` (`--live` on the building push). First read:
- the vault note `01-Active-Projects/memory-rooms.md`;
- the dev log `03-Dev-Logs/2026-11-22-memory-rooms-12b-fletcher-exterior.md` (its "Linking The Batcave" section);
- `03-Dev-Logs/2026-11-08-memory-rooms-first-real-render.md`;
- `src/memory-rooms/CONTRACTS.md` §6 (room scenes v2, room frame, slices, `push.mjs` refusing a mismatched `roomId`).

## The two sides
- **Spot** `59b68a1b-c157-44c3-a92c-c2be9bb43092` "The Batcave". Live, rendered, v1 box 7.965 × 5.255 × 2.757, 53 objects, 6 photos, 1 pin.
  - Work folder: `memory-rooms-work/59b68a1b-…/` (`scene.json`, `layout.md`, `bespoke/`, and a reusable camera/room fit toolkit in `fit/`).
  - Its frame matches the house: north = the back stacker wall; west = the kitchen under the external stair; south = the 970 cavity-slider doorway + a glazed bay.
- **Room** `james-dungeon` (Multi-Purpose) in building `001c25b7-a2bd-4d71-a476-739b941f8f69` (work folder `memory-rooms-work/b-001c25b7-…/`, source of truth `trace.py`).
  - Inner faces x 1.23–8.56, z 0.954–5.964, ceiling 2.743.
  - Openings from the house:
    - back stacker 5.81 m at plan x 2.186–7.996;
    - south slider 2.41 m at x 5.39–7.80;
    - 970 cavity slider at x 3.95–4.92.
  - The external stair's flight passes over the west strip (pantry / fridge zone: PTY, sink, FR on A.04 at x ~1.23–1.9).
  - The plan says polished concrete floor.

## Why not just scale it
- A uniform scale (7.97 → 7.33) leaves the doorway, the glazing's west edge and the stair edge **0.7–0.9 m** off.
- The best straight-line fit still leaves errors of up to 0.6 m.
- The error sits in the **west kitchen zone**: the old fit made it 1.78 m deep, the plan's bench / fridge line is ~0.7 m.
- From the sofa east (TV wall, desk corner) it's already close.

## Do this
1. **Back up** the live spot first, into `memory-rooms-work/59b68a1b-…/backup-v1/`: `scene.json`, `room.glb`, `map.glb`, `renders/`, and the row (GET).
2. **Link it:**
   - PATCH the spot `buildingId` + `roomId: "james-dungeon"`.
   - In trace.py: the room's `spotIds`, a pinned `origin`, and the Batcave's finishes on the room (floor concrete `#8a857c`, walls `#e4e2dc`, ceiling `#eeede9`).
3. **Convert the scene to v2** (`shell: { building, room }`; openings come from the house) with an **anchoring script** (`merge.py` in the spot folder). No global scale:
   - **Kitchen group** (understair, bench, cooktop, uppers, fridge column + panels, soffit, vents) → west wall. Shrink the zone to the plan's ~0.7 m. Drop or shorten the under-stair rake piece where the house's real stair soffit now shows.
   - **Desk corner** (desk, monitors, pc, neon, books, mat, keyboard, chair, speaker, north curtain) → NE corner.
   - **TV wall** (tv-unit, tv, soundbar, plinth, lamp, monstera, yellow chair, east bulkhead) → east wall.
   - **Console + coffee machine + toaster** → just west of the doorway. South curtain → the slider.
   - **Sofa / corner / chaise / pillows / rug / coffee table / bar / stools** → re-placed between the TV wall and the kitchen, keeping their spacing to the TV.
   - **z** (north–south): keep each piece's distance to the wall it's against. Re-space the downlights on the plan.
   - The pin stays on the desk.
4. **Re-solve the 6 cameras** with the fit toolkit, the room **fixed** at the plan size (cameras only, then small object nudges). Report the residuals: big ones mean the photos disagree with the plan somewhere.
5. **Compare loop, max 3 rounds:**
   - `check-scene.mjs 59b68a1b-…` (it finds the building).
   - `build-building.mjs 001c25b7-… --no-bake --only ground`.
   - Render the six scene cameras inside the level blend (extend the house's `compose.py`) and make a photo | render sheet like `compare.png`.
6. **Bake and push:**
   - Full `build-building.mjs` (the slice writes `59b68a1b-…/room.glb`).
   - Re-render the spot's hero / marker / map.glb (the skill's bake step, or `bake.mjs` + `push.mjs` behaviour; read them first).
   - `push.mjs 59b68a1b-…` (scene v2, sceneVersion + 1), then `push-building.mjs 001c25b7-… --live`.
7. **Check on the live site** (headless Edge, light + dark):
   - `/memories/59b68a1b-…` (viewer, pin, photo viewpoints, AR button, walk);
   - `/memories/b/001c25b7-…` (Inside shows the room furnished; tapping Multi-Purpose opens The Batcave);
   - the map marker.

## Decisions already made (James)
- The Batcave takes the plan's size, and its live room becomes the house slice (rollback = the backup).
- Keep every id. Don't furnish other rooms.

## Report back (short bullets)
- How each group was anchored, and the camera residuals.
- The compare rounds and what's still off.
- The push results and links.
- Update the vault (a new dev log + project note), DECISIONS, the skill's notes and the Memory Rooms memory, per `CLAUDE.md`. Don't commit unless asked.
