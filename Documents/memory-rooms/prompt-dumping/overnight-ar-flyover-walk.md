Overnight build: finish spot editing, then build three new Memory Rooms features (AR, the trip flyover, and
walking around a room together as characters), check everything with subagents, then commit, push to GitHub
and deploy the live site.

How to work tonight
- I'm away from the computer overnight. Don't ask me anything, and don't wait for plan approval.
  - Where a default below doesn't fit, pick the best option yourself.
  - Write each such call in DECISIONS.md (continue the numbering) and in the morning report.
- Order:
  0. Finish and verify the edit feature (edit-spot-details.md) if it isn't done.
  1. AR.
  2. Flyover.
  3. Walk in together.
  4. Full verification.
  5. Commit, push, deploy.
  6. Live smoke check.
  7. Morning report.
- Commit each feature locally on main once its checks pass (checkpoints). Push and deploy once, at the end.
- This prompt replaces the "don't commit or deploy" line in edit-spot-details.md: commit, push and deploy are
  approved for tonight, at the end, after every check passes.
- A feature that can't pass its checks by the end doesn't ship half-working:
  - leave it switched off (not linked, behind a flag);
  - make sure it can't break the existing pages;
  - say so in the report.
  The rest still ships.
- Not in scope: the time-capsule idea and the gamify ideas (fog of war, claiming states, bounties, hidden
  objects). I passed on those.

Context
- Read first:
  - src/memory-rooms/README.md and CONTRACTS.md;
  - tools/memory-rooms/README.md and DECISIONS.md;
  - in the vault (C:\Users\james\Documents\james-claude-brain): 01-Active-Projects/memory-rooms.md and the
    2026-11-18 dev logs (mapbox-globe, map-3d);
  - for multiplayer: 01-Active-Projects/wigfield-portfolio-arcade-multiplayer.md and
    02-Architecture/ADR-005-arcade-durable-object-topology.md.
- What exists:
  - A Mapbox GL globe on /memories (map/mapbox/), with the SVG atlas as the fallback (no token, no WebGL 2,
    offline, a runtime failure; ?map=atlas forces it).
    - Every new mapboxgl.Map() is a billed load (no-card trial, 5,000 a month): ONE per page, and
      window.__mrMapLoads proves it.
    - Rendered spots stand as hero markers. Past zoom 15 they stand as live 3D dioramas: one three.js custom layer
      in Mapbox's own context (map/mapbox/models3d.js), map.glb, a cap of 3 on a phone and 6 on a desktop.
  - The spot page has a three.js viewer (viewer/):
    - baked GLBs drawn unlit (bakedMaterials.js);
    - a dollhouse cut-away (dollhouse.js);
    - photo viewpoints that fly to where each photo was taken and blend photo ↔ model;
    - dispose.js.
  - GLBs (CONTRACTS §4): y-up metres, floor at y = 0, interior origin = the NW floor corner, exterior origin = the
    site centre. Walls are nodes named wall_north/south/east/west (+ children); objects are obj__<id>.
    scene.json has the room size, openings, objects (at, size, rotY) and the photo cameras.
  - A room's "north" = the wall you face from its main doorway, not true north (DECISIONS 40).
  - Live spots: The Batcave, Lunch Room (gable warehouse), She'd (octagonal shed), Mazda (an exterior: a car).
    All four are in WA. Locally, seed-dev.mjs --examples-only gives the NYC bedroom and the San Diego diner.
- Another session may still be finishing the map work.
  - Check git status and file modification times before you start.
  - In shared files (copy.js, memory-rooms.css, page-check.mjs, DECISIONS.md, the READMEs), re-read just before
    each edit and make small edits.
  - Never revert changes you didn't make.

1. AR: "See it in your space"
- A button on the spot page of every spot that has a GLB.
- Two scales:
  - tabletop: the dollhouse cut-away, about 1:20, on a table;
  - life size: 1:1, so you can stand inside the room. This is the wow one.
- Android / Chrome: WebXR immersive-ar inside the existing viewer.
  - Hit-test to place it on the floor or a table; drag to move, pinch to scale, twist to rotate.
  - Reuse bakedMaterials.js and dollhouse.js; don't copy them.
- iPhone has no WebXR, so it's Quick Look with a USDZ.
  - Default: make the USDZ in the browser with three's USDZExporter, from the loaded and cut-away scene. Put the
    baked texture where Quick Look won't relight it (e.g. emissive with a black base colour; test what holds up).
  - Cache it per spot. This needs no pipeline change and no backfill of the four live spots.
  - If that can't be made to look right, fall back to a bake-time USDZ as `model/usdz`. That's a CONTRACTS +
    Worker change. Push nothing live; list it for me.
- Desktop: no AR. Show a small QR code that opens this spot's AR on a phone (lazy-load the QR code).
- Verify (real AR can't run headless, so check everything around it):
  - an emulated iPhone Safari UA gets a `rel="ar"` Quick Look link;
  - with navigator.xr mocked as supported, the WebXR button shows;
  - a desktop gets the QR code;
  - the generated USDZ is valid: install usd-core in a scratch venv and pass `usdchecker --arkit`, with textures
    present and a sensible size;
  - the AR code stays out of the map route's bundle.
  - Write a real-phone test checklist for me (iPhone + Android) in the report.

2. Flyover: "Play the trip"
- A Play button on /memories (and `/memories?play=1`). The globe flies through every spot with a location, in
  capturedAt order, drawing the route as it goes: great-circle arcs as a GeoJSON line layer on the SAME map.
  Layers are free; a new Map is not.
- Each stop:
  - fly in, then a caption with the title, note, date and who (in the house style: no callout boxes);
  - linger about 4 s;
  - rendered spots dive past zoom 15 so the 3D diorama stands up, and the camera slowly orbits it (pitch ~55°);
  - captured-only spots show their first photo thumbnail;
  - then fly on.
  - Long hops (WA → USA) pull out to the globe.
  - It ends on the whole route.
- Controls:
  - play/pause, previous/next, 1×/2× speed, exit; space, arrows, Escape;
  - tap the caption to open the spot;
  - on a phone, a bottom bar within thumb reach.
- The filters (who / kind) apply. prefers-reduced-motion gets cuts with a crossfade instead of flights.
- On the atlas fallback: a simpler version (pan/zoom the atlas, no 3D), not a broken button.
- Exiting restores the map exactly as it was, and models from the flight are disposed.
- Verify:
  - stops are visited in date order (expose the current index as a data attribute);
  - pause holds the camera; next/prev and exit work;
  - the 3D layer loads at rendered stops within the cap and disposes after;
  - __mrMapLoads === 1 throughout;
  - fps during flights at 1440 and 390 (headless-soak kit: puppeteer-core + local Edge, ANGLE d3d11);
  - zero console errors.

3. Walk in together
- "Walk in" on the spot page of every spot with a GLB opens `/memories/:id/walk` (add it in routes.js).
- You're your character (who = the person picked at the gate, `mr:who`). Everyone walking the same spot at the
  same time shares the room live.
- Camera:
  - third person, behind and above your character;
  - the wall between the camera and you hides, the dollhouse way, so the room never blocks the view;
  - V toggles first person.
- Characters:
  - Default: PixelLab 8-direction pixel characters, one each for James and Justin, with idle and walk animations.
    They're drawn as camera-facing sprites in the baked 3D room, the frame picked from heading vs camera angle.
  - Keep them generic (two friendly travellers told apart by colour), not likenesses.
  - Call get_balance first. Never buy credit: the trial is spent, only the daily bonus is left.
  - If PixelLab can't make them tonight, use a CC0 animated low-poly character (Kenney or Quaternius; check the
    licence, credit it in the README) or a simple procedural figure, tinted per person.
  - Either way, a character is swapped by changing one file.
- Controls:
  - PC: WASD / arrows to move, Shift to run, drag (or click for pointer lock) to turn, wheel for camera distance,
    E to interact, 1–3 for emotes (wave, jump, sit).
  - Phone: a left-thumb joystick, drag on the right half to turn, pinch for camera distance, tap the floor to walk
    there (pathfinding around furniture), and buttons for interact and emote. Portrait and landscape.
  - The keyboard alone is enough to play.
- Collision: you can't walk through walls or furniture.
  - Default: build a 2D walkable grid from the GLB when it loads (geometry roughly 0.15–1.7 m above the floor,
    ~5 cm cells). It must handle the octagon shed, the gable warehouse and walking around the car.
  - Flat things (rugs) don't block. Slide along obstacles.
  - Interiors stay inside the room; exteriors stay on the ground plate.
  - Tap-to-walk uses A* on the same grid.
- Things to do (light, not the gamify stuff I passed on):
  - Photo spots: each scene photo camera shows as a mark on the floor where it was taken. Step on one and the view
    blends into that exact photo (reuse the viewer's photo viewpoint blend). Standing where you took the photo is
    the point.
  - Sit on chairs, sofas and beds (from scene.json objects).
  - Wave and jump emotes, name tags, and short chat bubbles (text ≤ 80 chars, never stored).
- Multiplayer:
  - Default: a new Durable Object class (e.g. MemoryWalkRoom, a v3 migration in wrangler.jsonc), one instance per
    spot id, WebSockets with hibernation.
    - Not the arcade's ArcadeRoom: /arcade is public and memories are behind the password.
    - Borrow the arcade's patterns (rate limits, plausibility checks on positions, write-behind), not its code.
  - Auth:
    - Browser WebSockets can't send the bearer header, so an authenticated endpoint (e.g.
      `POST /api/memories/spots/:id/walk`) returns a short-lived signed ticket, and the socket connects with it.
    - No ticket or a bad ticket is refused.
    - Update CONTRACTS §3.
  - Send position, heading and animation about 12 Hz, only while moving. Draw others about 100 ms behind,
    interpolated; snap on big jumps; the server clamps impossible moves.
  - Join and leave show up for everyone.
  - Lost connection → reconnect with backoff; offline → keep walking alone, with one line saying so.
  - No SQL changes. Nothing is stored except who's present.
  - The spot page shows "Justin is in this room" with Walk in, from the DO's presence.
- Performance:
  - one WebGL context; the full room.glb; dispose everything on leave;
  - ≥ 50 fps at 1440 and ≥ 30 fps at 390 with touch emulation, measured;
  - a lower pixel ratio on phones if needed.
- Verify (and see Subagents):
  - two isolated browser contexts (James, Justin) in one room each see the other within 500 ms, and movement,
    emotes and chat mirror;
  - leave/join works;
  - killing a socket reconnects;
  - a client without a ticket is refused;
  - a spoofed teleport is clamped;
  - holding W into each wall for 5 s, in every seeded room, stays in the walkable area;
  - tap-to-walk reaches a far corner around furniture;
  - stepping on a photo mark blends to that photo;
  - zero console errors.

Subagents
- After each feature, spawn a fresh verification subagent.
  - Give it the feature's section from this prompt, the files, and how to run the local loop. Don't give it your
    conclusions.
  - It extends page-check (or adds a focused check script), runs it, and reports what fails.
  - You fix, then re-run it until it's clean.
- Multiplayer gets its own subagent driving the two-browser test above.
- At the end, run the code-review skill at high effort over the whole diff and fix the CONFIRMED findings.
- Subagents running wrangler dev at the same time use separate ports (8789, 8790…). 8787 is another project's.
  Kill orphans by port: TaskStop leaves node + workerd holding them.

Budgets
- Mapbox: at most 400 map loads tonight in total. Add up __mrMapLoads per run, and use ?map=atlas for checks that
  aren't about the globe.
- PixelLab: the daily bonus only, no purchases. No other paid services.

Constraints (these still apply)
- Still ONE map load per page; the flyover uses the existing map.
- Don't regress the capture flow, the edit page, the spot viewer, the map markers / 3D, any fallback, or /arcade
  (run tools/arcade-check.mjs).
- Phones first. Lazy-load everything new and heavy: AR, the walk page, the characters and the QR code stay out of
  the map route's bundle.
- All copy goes in copy.js; all colours are the .mr tokens in memory-rooms.css (light + dark). Design rule: no
  coloured rounded left-border callout boxes or filled pills.
- Stay on main (no branch; if you use worktrees for subagents, merge back into main).
- Don't write to live data: no live password is needed tonight, and none is available.

Full verification before shipping
- npm run build, lint on the files you touched, api-check.mjs, page-check.mjs and --dark (every section, including
  edit, AR, flyover and walk), the multiplayer test, arcade-check, the model soak, and fps for the flyover and the
  walk.
- Screenshots at 390 and 1440, light and dark: edit, AR button / QR, the flyover mid-flight and at a 3D stop, and
  the walk with both characters. Make one contact sheet.

Ship (only after the full verification passes)
1. git status.
   - Commit the night's work and anything the map session left finished and uncommitted. The whole page-check
     must pass over all of it.
   - Never commit .env.local, .dev.vars or other secrets, or memory-rooms-work/.
   - If the dev-setup files (src/components/portal/modules/dev-setup/) show as modified, leave them out: they're
     my work in progress.
   - Clear commit messages, one or more per feature.
2. git push origin main.
   - If it's rejected because the remote moved: fetch, then rebase or merge, re-run the checks, and push again.
     Never force-push.
   - Never print the remote URL anywhere (it holds a credential).
3. Deploy:
   - Check npx wrangler whoami. If it isn't logged in, stop here and say so in the report (login is
     interactive).
   - Check that .env.local has VITE_MAPBOX_TOKEN, since the build bakes it in.
   - npm run deploy (vite build + wrangler deploy; the DO migration applies on deploy).
4. Live smoke check (no password needed):
   - https://jameswigfield.com/memories loads and the gate shows, with no console errors;
   - /api/memories/ping answers 401 without auth, not 404 or 503;
   - the new walk and ticket routes answer 401, not 404;
   - /, /arcade and /films still load.
   - If the live site is broken and the fix isn't quick: npx wrangler deployments list → npx wrangler rollback.
     If the new DO migration blocks a rollback, deploy a fix with walking switched off instead.

Morning report (last chat message + a vault dev log)
- Update the vault note (memory-rooms.md), add a dev log for tonight, and add the DECISIONS.md entries, per
  CLAUDE.md.
- The report:
  - what shipped and what was held back, and why;
  - commit hashes and the deploy version;
  - the check results (with numbers: fps, map loads used, PixelLab spend);
  - the contact sheet's path;
  - every decision you made without me.
  - My to-do list:
    - fix Mazda's place in the edit UI;
    - run backfill-map-assets.mjs --live with the live password;
    - the real-phone AR checklist;
    - a walk-in test with Justin.
