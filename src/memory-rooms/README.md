# Memory Rooms (`/memories`)

Trip spots captured on a phone, turned into Blender-built 3D rooms, on a map of the USA and western Canada.
Password-gated (`MEMORIES_PASSWORD`, shared with Justin, or the portal password).

| Route | Screen |
|---|---|
| `/memories` | map + list of spots, filter by person and status, outbox status |
| `/memories/new` | capture, phone first: kind + name → photos (shot guide) → the memory → location → save to the outbox |
| `/memories/:spotId` | the spot: 3D viewer (Model ⇄ Scan), photo strip, note, photo viewpoints with a photo/model blend |
| `/memories/group/:group` | every room of one building, assembled in its shared frame |

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
  map/                   SVG map (d3-geo + topojson, atlas.json built by tools/memory-rooms/build-atlas.mjs)
  capture/               the capture flow, photo resizing, IndexedDB outbox, geolocation
  viewer/                plain three.js viewer (GLTFLoader, OrbitControls, Spark) + its thin React wrapper
  pages/                 one component per route
workers/memory-rooms.js  the /api/memories routes, R2 files, local or Supabase row store
supabase/memory_rooms.sql
tools/memory-rooms/      render workflow scripts, Blender kit, checks, self-test (see its README)
.claude/skills/memory-render/SKILL.md   "render spot X"
```

## Rules that keep it portable (it may move to the usa-trip app, React 18, no r3f)

- Nothing here imports from `src/components/portal/` or `@react-three/*`.
- The viewer is a plain class (`viewer/RoomViewer.js`); React only owns its lifecycle.
- The server side is one file (`workers/memory-rooms.js`) plus `scene/validate.js` + the schema.
- A UI restyle starts in the token block of `memory-rooms.css` and in `copy.js`.

## Run it locally

```
npm run build
npx wrangler dev --port 8788          # restart after every build; 8787 belongs to another project
# open http://127.0.0.1:8788/memories, password from .dev.vars (MEMORIES_PASSWORD)
```
With HMR instead: keep `wrangler dev --port 8788` running and start `API_PROXY=http://127.0.0.1:8788 npx vite`.
