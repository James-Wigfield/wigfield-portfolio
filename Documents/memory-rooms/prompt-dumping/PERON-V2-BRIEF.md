# Brief: Point Peron v2, a walkable headland (for a fresh Claude Code session)

You're picking up Memory Rooms (`/memories` on jameswigfield.com). v1 of Point Peron is live (spot
`f4c3f982-39d1-4e18-8d90-f41dd453249b`), and James isn't happy with it. Your job is v2: a smaller area, much more
detail, and a place you can walk around. James is in TL;DR mode: keep chat replies short and in bullets, and put
detail in files.

## What James said about v1 (fix all of it)
- It's hard to navigate and see: 2.4 km across is too big for the site.
- It "feels like you took a screenshot of Point Peron from satellite view, warped the landscape a bit to make it seem
  like it's got hills, and then just created some renders of a couple of those buildings on top."
- The hills and landform aren't accurate or detailed enough.
- The water should be actual water, and the beaches should be more accurate.
- Paths shouldn't just be a smooth painted surface.
- Trees and shrubs should actually come out of the ground.
- He wants the area from the road / car park onwards to be "somewhat playable".
- Focus only on the old military sites, the paths, the beaches and the nature.

## Why v1 looks like that (don't repeat it)
- **Colour:** it was painted from one top-down orthographic bake (`albedo.py` + 4 × 4096 ortho renders) onto a
  decimated mesh, with unlit materials. From ground level, that reads as a draped satellite photo.
- **Heights:** they come from Terrarium z15 tiles, which in Australia are SRTM-derived at about 30 m. Cliffs were
  faked by carrying heights out to the edge.
- **Shrubs:** they were baked into the texture, so nothing stands up in the viewer.
- **Water:** it was a coloured flat plane. The sea floor was guessed from distance offshore plus brightness.

## Scope
- **The headland west of the main Point Peron car park.** OSM parking ways 200037007 / 200037018 / 200037029 are
  around 115.6873–115.6893 E, −32.2704 to −32.2713. Include:
  - Peron Battery: the gun positions (OSM nodes 7497148005/6), the operations centre, the observation post and the
    storage bunker north;
  - the Cape Peron lookout and Mushroom Rock;
  - the walking paths, the boardwalks and steps;
  - the beaches on both sides and the near-shore reefs.
- **Approximate box:** 115.679,−32.2745 to 115.692,−32.264 (about 1.2 × 1.15 km). Confirm it with James at
  checkpoint 1, using an extent image over the hillshade.
- **Leave out:** the causeway, the camp school and Garden Island. Show the land beyond the box only as a low-detail
  horizon, or not at all.

## Hard rules
- **No orders, forms, sign-ups or account creation** for any data source. James said "Do not process an order." Use
  only endpoints that answer a plain GET/POST with no key or a key we already have. If good data needs an order,
  tell James and move on.
- **Ask James before downloading asset packs** (textures, models). Prefer tileable textures you generate yourself in
  Blender (procedural → baked), and rocks and plants you model yourself.
- **Never type the production password into a browser.**
  - Check the live site through the API (`MEMORIES_API=https://jameswigfield.com`, `MEMORIES_PASSWORD` =
    PORTAL_PASSWORD from `.dev.vars`).
  - Check pages on the local Worker (its gate password is in `.dev.vars.example`).
- **Keep v1 live** until James approves v2. Stage v2 as a new spot; he decides whether v1 is hidden.
- **Don't deploy or push to live** until James has seen the local build and said yes.
- **Contract changes:** they go in `src/memory-rooms/CONTRACTS.md` plus `tools/memory-rooms/DECISIONS.md`, with
  `node tools/memory-rooms/check-contracts.mjs` passing. The live Worker validates scenes with its bundled schema,
  so deploy the Worker before pushing a scene that uses new fields.
- **Deploy procedure:**
  1. Commit to main and push.
  2. In `.claude/worktrees/mr-deploy`, check out that commit, detached.
  3. Run `npm run build`, then `npx wrangler deploy`.

## Read first
- `tools/memory-rooms/landscape/README.md`, which covers the v1 pipeline. Reuse what helps: `fetch-dem.mjs`,
  `fetch_s2.py`, the OSM step and `prep.py`'s land mask.
- `src/memory-rooms/CONTRACTS.md` §6.8 and `tools/memory-rooms/DECISIONS.md` 205–207.
- The vault notes: `C:\Users\james\Documents\james-claude-brain\03-Dev-Logs\2026-11-24-memory-rooms-point-peron-landscape.md`
  and `01-Active-Projects/memory-rooms.md`.
- `src/memory-rooms/walk/WalkGame.js` and `walk/grid.js`.
  - They are the existing walk. It has sprite characters, multiplayer through the Durable Object, touch controls
    and photo marks, but its walkable grid is a flat 5 cm grid on one floor height.
  - A landscape needs a heightfield walker instead. Extend the walk; don't fork it.
- `src/memory-rooms/viewer/RoomViewer.js`: its `this.landscape` branches, `farFor` and `computeHome`.
- The work folder from v1 is `memory-rooms-work/_peron/` (gitignored, with its own `.venv`): `osm.json`, the
  Sentinel-2 scenes and the DEM. Put v2 in `memory-rooms-work/_peron2/`.

## What "good" looks like
1. **Accurate landform at about 1 m.**
   - First look for the Geoscience Australia 5 m LiDAR DEM (ELVIS / FSDF). Check whether services.ga.gov.au (or
     elevation.fsdf.org.au) exposes it as an open ArcGIS ImageServer or WCS with `exportImage`. That's a plain GET,
     not an order.
   - Fall back to the Terrarium tiles, then sculpt the landform from the aerial photos and Google Maps 3D/terrain
     views (for reference only, never extracted).
   - Model real features as geometry:
     - limestone cliffs with sea-level wave-cut notches;
     - Mushroom Rock's undercut;
     - rock platforms and boulders;
     - dune ridges;
     - the battery's earthworks and gun pits.
2. **Real ground materials, not a painted photo.**
   - A splat or blend material (sand, wet sand, limestone, compacted path, heath soil, bitumen, concrete), driven by
     masks from OSM, Sentinel-2 and the slope.
   - Tileable detail textures with normal maps. Satellite colour only as a faint low-frequency tint, if at all.
3. **Paths that are built, not painted.**
   - Sunk ribbons with edges, crushed limestone or compacted sand, and kerbing where it exists.
   - Boardwalks and steps as geometry, with handrails where photos show them.
4. **Vegetation that stands up.**
   - Instanced 3D plants, a few species-like types read off photos:
     - low dense coastal heath, 0.3–1.5 m;
     - taller shrubs and small trees, 2–5 m;
     - beach grass and spinifex on the foredunes.
   - Placed from NDVI plus class masks, with clumping and bare gaps that match the aerials, and grounded (no
     floating, no z-fighting skirts).
   - A gentle wind sway in the shader. LOD or impostors far away.
5. **Real water.**
   - An animated shader surface: normals, Fresnel, sun glint.
   - Colour by depth over a modelled sea floor, with reefs visible through clear water.
   - A shore foam and swash line from a distance-to-shore field, and wet sand at the waterline.
   - For depth, try Sentinel-2 satellite-derived bathymetry: a Stumpf log-ratio of the B02/B03 reflectance bands
     (extend `fetch_s2.py`), calibrated to a couple of chart depths you can cite. It's still "modelled"; say so in
     the scene notes.
6. **Military sites modelled from photos.**
   - The gun emplacements (rings, holdfasts, ready-use lockers), the observation post with its slots, the operations
     centre, the bunkers and tunnel mouths, and the lookout.
   - Use real dimensions where any source gives them, in metres. Name your sources in the scene notes.
7. **Somewhat playable.**
   - Spawn at the car park at ground level and walk or run (third person, with V for first person), using the
     existing walk controls, sprites and multiplayer.
   - The heightfield walker needs:
     - height sampling (a sidecar heights grid);
     - a slope limit, so you can't climb cliffs;
     - water: wade to about knee depth, then a soft stop;
     - blocking for buildings, rocks and dense shrubs.
   - POI markers at the battery, the observation post, the lookout and Mushroom Rock, each with a short info card,
     fact-checked and sourced.
   - A small minimap.
   - The spot page also keeps an orbit view, but it opens close in (about 300 m), not on a km-scale overview.
8. **Performance budget.**
   - 60 fps on desktop and at least 30 on a mid phone; under about 30 MB total download.
   - Check what the viewer already supports (meshopt / Draco / KTX2) before choosing. Use chunked terrain with LOD
     if needed.

## How to work (checkpoints with James, keep each report short)
1. **Data + extent (about 1 hour in).**
   - Show: the hillshade of the best DEM you could get vs v1; the extent box; the bathymetry approach.
   - Send images with SendUserFile.
2. **Vertical slice.**
   - Fully dress one patch of about 200 × 200 m around the battery and observation post, including a path, a beach
     edge and water.
   - Make it walkable locally. Send screenshots plus a short GIF from ground level.
   - Don't scale up until James likes the slice.
3. **Full headland.**
   - The whole box, POIs and the minimap. Run a perf check on a throttled headless run.
4. **Ship (only on James's yes).**
   - The contract and decisions, a Worker deploy, then the spot push.
   - A vault dev log (`03-Dev-Logs/`) and an update to the project note.
   - An update to the README, plus a `MEMORY.md` line.

Throughout: render from ground level, not just from above. Compare every view side by side with the photos you
studied, and write down what's still wrong before saying it's done.
