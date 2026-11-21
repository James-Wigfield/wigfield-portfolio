# Memory Rooms (`/memories`)

Trip spots captured on a phone, turned into Blender-built 3D rooms, on a Mapbox globe that opens on the USA and western Canada.
Password-gated (`MEMORIES_PASSWORD`, shared with Justin, or the portal password).

| Route | Screen |
|---|---|
| `/memories` | map + the index of spots (`No. 001`, each room's cut-out), filter by person, status and day of the trip (the day strip), outbox status; **Play the trip** (`?play=1`): the globe flies through every spot in capture order, drawing the route, standing rendered rooms up in 3D |
| `/memories/new` | capture, phone first: kind + name → photos (shot guide) → the memory → location → save to the outbox |
| `/memories/new/place` | capture **a whole place** (the third kind on `/memories/new`): name + note → location → a floor-plan photo (optional) → outside shots (optional) → saved on the phone, uploaded by the outbox; works offline |
| `/memories/:spotId` | the spot as a drawing sheet: the room **recalls itself** from a cloud of points, a drafting grid under it, a title block (sheet MR-###, place, date, live scale bar, north arrow), numbered callouts for its pins, thin ink photo frustums; 3D viewer (Model ⇄ Scan), photo strip, the note as a pull-quote, photo viewpoints with a photo/model blend; **Walk in** (+ who's in the room now) and **See it in your space** (AR: Quick Look on iPhone, WebXR on Android, a QR code on a desktop; `?ar=1` opens it). On a phone the panel is a bottom sheet |
| `/memories/:spotId/edit` | fix its details after capture: the place (pin / GPS / typed, + its name), name, note, captured day, who saved it; kind + size until it has a 3D room. One PATCH with `ifUpdatedAt` (409 → reload theirs under yours); needs signal, the typed draft waits in sessionStorage |
| `/memories/:spotId/walk` | walk the 3D room as your pixel character, together with whoever else is in it (a Durable Object per spot): WASD / joystick, photo marks that blend into the real photo, sit, wave, jump, chat |
| `/memories/group/:group` | every room of one building, assembled in its shared frame |
| `/memories/b/:buildingId` | a whole place: once built, the 3D building on top (Outside · Inside with the roof lifted · Plan per level · Levels pulled apart; tap a room to fly into its spot); its plan (the sketch, or rooms marked on the floor-plan photo) and its room checklist (captured / waiting to upload / to capture); a room's Capture opens the normal capture prefilled (`?building=&room=&name=&of=`). Offline from IndexedDB `places` + the outbox |
| `/memories/b/:buildingId/plan` | the sketch plan: rooms as rectangles on a half-metre grid (drag, corner to size), levels, north, or marked on the floor-plan photo; overlapping rooms are kept on the phone until fixed |

## Where things are

```
src/memory-rooms/
  MemoryRoomsApp.jsx     lazy entry (App.jsx), shell, password gate, who-picker
  routes.js              every URL (BASE = '/memories'), change here to move the feature
  copy.js                ALL user-facing text
  memory-rooms.css       the one design system: tokens on .mr (light + dark), every class .mr-*
  CONTRACTS.md           shapes every part agrees on: coordinates, API, R2 keys, GLB, Blender kit
  scene/                 scene.schema.json + validate.js (shared with the Worker and scripts) + geometry.js
  lib/api.js             browser client for /api/memories
  map/                   the maps: SpotsMap.jsx / PickMap.jsx choose an engine
                         markers.js + markerImages.js: rendered spots stand as their hero cut-out (both engines)
    mapbox/              Mapbox GL globe (engine.js loader + fallback rules, useMapbox.js = one map per page,
                         style.js = the look from the --mr-map-* tokens, project.js screen maths)
                         models.js / useModels.js / models3d.js: past zoom 15 the rendered spots on screen
                         stand as live 3D dioramas, one three.js custom layer in the map's own context (lazy)
    Atlas*.jsx, geo.js   the SVG atlas fallback (d3-geo + topojson, atlas.json built by tools/memory-rooms/build-atlas.mjs)
    flyover/             "Play the trip": plan.js (stops + great-circle route), useFlyover.js (the state machine),
                         FlyoverOverlay.jsx (caption + bar), useFlyoverAtlas.js; the globe's driver is
                         mapbox/useFlyoverMapbox.js (a line layer on the same map)
  capture/               the capture flow, photo resizing, IndexedDB outbox, geolocation
                         LocationPicker.jsx: the location picker, shared by capture (step 4) and the edit page
  viewer/                plain three.js viewer (GLTFLoader, OrbitControls, Spark) + its thin React wrapper
                         recall.js: the "Recall" load (points condensing into the room); helpers.js: the drafting
                         grid ground + ink frustums; dollhouse.js: the cut-away (and what the opening view hides)
  lib/trip.js            the trip's days, a spot's day (where it was captured), sheet numbers (MR-004 / No. 004)
  lib/transition.js      View Transitions around a navigation (the router can't, it's a <BrowserRouter>)
  ar/                    "See it in your space": ArEntry.jsx (lazy), usdz.js (Quick Look file made in the browser),
                         xr.js (WebXR inside the viewer), qr.js (the desktop's QR code)
  walk/                  walking in together: WalkGame.js (plain three.js), grid.js (walkable grid from the GLB +
                         A*), net.js (the room's socket), characters.js (THE file to swap a character) +
                         characters/ (PixelLab sheets), WalkEntry.jsx (the spot page's Walk in)
  pages/                 one component per route
    edit/                the edit page's parts: form.js (diff → PATCH, merge on reload), draft.js, EditPlace.jsx
workers/memory-rooms.js  the /api/memories routes, R2 files, local or Supabase row store
workers/memory-walk.js   MemoryWalkRoom, the Durable Object behind walking in together (one per spot)
supabase/memory_rooms.sql
tools/memory-rooms/      render workflow scripts, Blender kit, checks, self-test (see its README)
.claude/skills/memory-render/SKILL.md   "render spot X"
```

## Rules that keep it portable (it may move to the usa-trip app, React 18, no r3f)

- Nothing here imports from `src/components/portal/` or `@react-three/*`.
- The viewer is a plain class (`viewer/RoomViewer.js`); React only owns its lifecycle.
- The server side is one file (`workers/memory-rooms.js`) plus `scene/validate.js` + the schema.
- A UI restyle starts in the token block of `memory-rooms.css` and in `copy.js`. That includes the Mapbox map:
  `map/mapbox/style.js` paints its layers from the `--mr-map-*` tokens, and the 3D stage: `RoomViewer.js` reads
  `--mr-grid-*`, `--mr-frustum` and `--mr-stage` from the stage (a night spot's stage overrides them).
- The look ("Recall", 2026-11-21): paper and ink, hairline rules, mono labels, ONE serif (Instrument Serif) for titles
  and the note only, status as a labelled dot (never a filled pill or a coloured callout box), a darkroom dark mode.
- The maps need `VITE_MAPBOX_TOKEN` (a public `pk.` token, in `.env.local`, never in code or `.dev.vars`). Without it,
  without WebGL 2, or offline, both maps draw the SVG atlas instead. Every Mapbox `Map` is a billed load, so
  each page makes one (see `map/mapbox/useMapbox.js`); `mapbox-gl` is a lazy chunk only the maps fetch.
  The 3D dioramas go onto that same map as a custom layer (never a second map or WebGL context), and
  three.js + GLTFLoader load only once the map passes zoom 15.

## Run it locally

```
npm run build
npx wrangler dev --port 8788          # restart after every build; 8787 belongs to another project
# open http://127.0.0.1:8788/memories, password from .dev.vars (MEMORIES_PASSWORD)
# ?map=atlas forces the SVG fallback; ?mapstyle=standard tries the other Mapbox style
```
With HMR instead: keep `wrangler dev --port 8788` running and start `API_PROXY=http://127.0.0.1:8788 npx vite`.
