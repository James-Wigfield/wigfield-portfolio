Make every rendered spot on the /memories map show as its own 3D render, standing on the map at its
location, instead of a plain status dot.

Context
- Read first: src/memory-rooms/README.md, src/memory-rooms/CONTRACTS.md (§2 R2 keys, §4 GLB contract),
  tools/memory-rooms/README.md, tools/memory-rooms/DECISIONS.md (47–54 are the Mapbox map), and the vault notes
  C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md and
  03-Dev-Logs\2026-11-18-memory-rooms-mapbox-globe.md.
- The map (built 2026-11-18; it may still be uncommitted, so build on it and don't revert it):
  - map/SpotsMap.jsx chooses an engine:
    - mapbox/MapboxSpotsMap.jsx, a Mapbox GL v3 globe;
    - AtlasSpotsMap.jsx, the SVG fallback (no token, no WebGL 2, offline, or a runtime failure; ?map=atlas forces it).
  - mapbox/useMapbox.js makes ONE map per page. Every new mapboxgl.Map() is a billed load (no-card trial,
    5,000 a month). page-check asserts window.__mrMapLoads === 1.
  - Spots and clusters are an SVG overlay above the map canvas: SpotDot / ClusterDot from clusters.js, placed with
    map.project() and redrawn every camera move. mapbox/project.js toScreen() drops points on the far side of the
    globe.
  - The SVG dots are the real buttons: role=button, focus, aria, data-mr hooks. Card anchoring (cardPlace.js) and
    place-label avoidance (PlaceLabels.jsx) read their screen positions.
  - The container holds its map at el.__mrMap, so checks can move the camera.
- What a rendered spot already has (spot.media; signed urls that last ~12 h; helpers in lib/spots.js, e.g. heroOf):
  - render "hero" = renders/hero.png: 1600×1200 with a TRANSPARENT background, the baked dollhouse three-quarter view
    of the room (or the exterior's site). It's already a cut-out.
  - model = model/room.glb, 1–4 MB here, with up to 4 baked 2048 px atlases:
    - y-up, metres. Interior origin = the NW floor corner; exterior origin = the site centre.
    - The light is baked in. The viewer swaps every material to MeshBasicMaterial (viewer/bakedMaterials.js); the
      glass… and emit… prefixes are special.
    - The walls and ceiling are named, and viewer/dollhouse.js hides them for the cut-away. Exteriors have a
      `ground` plate.
  - Only status "rendered" spots have these. Captured and modelling spots keep their status glyph dots.
  - push.mjs uploads every renders/*.png as a render media row, so a new render name (e.g. "marker") needs no API
    change. Names are [a-z0-9-]+.
- A room's "north" is the wall you face from its main doorway (DECISIONS 40), NOT true north, and no bearing is
  stored. Any rotation on the map is a display choice, so don't present it as the real orientation.
- Scale: a 5 m room covers about 6 px at zoom 17. True scale is invisible, so a render on the map has to be a
  diorama with a fixed screen size, not a footprint.

Choices (my defaults, flag anything you'd change before building)
- Two phases. Show me screenshots after phase 1 before starting phase 2.
  1. Render markers. Every rendered spot shows its hero cut-out, anchored at its location (the bottom centre of the
     render's footprint sits on the point), with a soft contact shadow. Small at country scale, larger as you zoom
     in.
     - Use a small "marker" render made at bake/push time (trimmed to the content, ~240 px, transparent; WebP or
       PNG, your call). Never the 1600 px hero.
     - Fall back to the hero, resized client-side once, for spots that don't have a marker yet.
     - Add a backfill script for spots already live, but run it against the LIVE site only after I say so.
     - The atlas fallback shows the same markers (SVG <image>).
  2. Live 3D up close. Past a zoom threshold (≈ 15+), the actual baked GLB of each visible rendered spot stands on
     the map as a diorama. It's cut away like the viewer's dollhouse (no ceiling; the walls facing the camera hide
     or fade), unlit (the bake is the light), with a fixed screen size, and it turns as the map rotates or pitches.
     Below the threshold, or if anything fails, it's the phase 1 marker.
- Engine for phase 2: one three.js custom layer sharing Mapbox's WebGL context (no second context). Reuse
  bakedMaterials.js / dollhouse.js; don't copy them.
  - Compare it against Mapbox's native `model` layer (style-spec, GLB). It may not be able to hide nodes or skip
    lighting, and signed urls expire. Tell me which you picked and why.
  - Check how custom layers behave on the globe (the globe turns into mercator as you zoom in).
- Clusters: keep the numbered disc. If a cluster holds rendered spots, show up to 3 of their markers fanned behind
  the number. Decide, and tell me why.
- Interaction doesn't change: the SVG overlay keeps an invisible hit target, ring and focus over each marker/model,
  so a click, a tap or the keyboard opens the same card, and clusters, card anchoring and label avoidance keep
  working.
- Allowing pitch: the map is flat now (pitch 0). Phase 2 looks best tilted. Propose a way (e.g. pitch allowed past
  zoom 15, or a gentle auto-tilt when the models appear) that doesn't break the overlay maths.

Constraints
- Still exactly ONE map load per page: the custom layer goes onto the existing map, never a new Map. Keep
  window.__mrMapLoads === 1 through zooming into 3D and back out.
- Phones first.
  - Phase 2 loads GLBs lazily: only past the threshold, only the spots on screen, nearest first.
  - Cap how many are live at once (e.g. 3 on a phone, 6 on a desktop).
  - Downscale textures for the map (512 px is plenty at diorama size), or propose a small map-LOD GLB made at bake
    time (that would be a CONTRACTS.md change: say so first).
  - Dispose everything that leaves (viewer/dispose.js). Show me GPU/texture counts staying flat while you pan around.
- Don't regress the spot page viewer, the capture pick map, or any fallback. Offline or no-WebGL still draws the
  atlas, which still shows markers.
- Lazy-load anything new and heavy (three's GLTFLoader is already in the viewer chunk; keep the map route light
  until 3D is needed).
- All copy goes in copy.js; all colours are the .mr tokens in memory-rooms.css (light + dark). Design rule: no
  coloured rounded left-border callout boxes or filled pills.
- Stay on main (no branch). Don't touch the uncommitted dev-setup files. Don't commit, deploy, or write to the live
  site without asking me.

Verify
- Local loop: npm run build → npx wrangler dev --port 8788 (restart after every build; 8787 is taken)
  → node tools/memory-rooms/seed-dev.mjs --examples-only (two rendered spots with GLB + renders: the NYC bedroom and
  the San Diego diner) → node tools/memory-rooms/page-check.mjs and --dark. Local password: trip-local.
- page-check runs Edge on the real GPU (ANGLE d3d11). Extend it:
  - rendered spots show markers (atlas too);
  - past the threshold the 3D layer draws (canvas pixels change, models loaded > 0, within the cap);
  - a click on a model opens its card;
  - zooming back out disposes them;
  - one map load the whole way;
  - zero console errors.
- Measure fps while panning with models live (memory: puppeteer + local Edge, d3d11), at 1440 and at 390 with
  touch emulation.
- Screenshots, light + dark, 1440 + 390: country view (markers), city view (bigger markers), and close-up 3D
  dioramas (phase 2). Make one contact sheet and show me.

When done: update the vault note, add a dev log, and add DECISIONS.md entries per CLAUDE.md.
