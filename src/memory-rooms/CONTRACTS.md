# Memory Rooms — contracts

The shapes every part of Memory Rooms agrees on: capture UI, Worker API, row stores,
Node scripts, Blender kit and viewer. Change a contract here first, then the code.

- `scene.json` v1 + v2: `src/memory-rooms/scene/scene.schema.json` (validator `scene/validate.js`,
  geometry helpers `scene/geometry.js`, Python mirror `tools/memory-rooms/blender/scene_io.py`).
- `building.json` v1: `src/memory-rooms/building/building.schema.json` (validator `building/validate.js`, geometry
  `building/geometry.js`, Python mirror `tools/memory-rooms/blender/building_io.py`); the phone's sketch plan
  `building/sketch.schema.json`. Section 6.
- Worked examples: `tools/memory-rooms/examples/*.scene.json`, `*.building.json`.

## 1. Coordinates (one sentence each)

- Metres. Floor at y = 0. x runs west → east, z runs north → south, y up (three.js and glTF).
- Interior origin = the room's north-west floor corner; exterior origin = the site centre.
- `at` = centre of the object's footprint on its base. `size` = `[w, h, d]` in the object's own frame.
- `rotY` degrees about +y. At 0 the object's **front faces south (+z)**; 90 → east, 180 → north, 270 → west.
  (A desk against the north wall has rotY 0: its knee space faces into the room. A bed whose head is on the
  west wall has rotY 90: its foot points east.)
- Walls: north z = 0, south z = depth, west x = 0, east x = width. Opening `offset` runs along the wall
  from its lower-x end (north/south) or lower-z end (east/west).
- Blender is z-up. The kit converts exactly once, in `scene_io.to_bl((x, y, z)) = (x, -z, y)`; rotY maps to
  Blender `rotation_euler.z = radians(rotY)`. The glTF exporter's +Y-up conversion then gives back the scene
  coordinates exactly, so the GLB and scene.json share one frame.
- Camera `fov` is across the photo's **long** edge; `aspect` = photo width / height. three.js vertical fov =
  `geometry.verticalFov(cam)`. Blender: `sensor_fit = 'AUTO'`, `angle = radians(fov)`, render resolution
  matching the aspect.

## 2. Data rows (API JSON is camelCase; SQL is snake_case)

```jsonc
// Spot
{
  "id": "uuid (client-generated)",
  "createdAt": "ISO", "updatedAt": "ISO", "deletedAt": null,
  "createdBy": "james" | "justin",
  "title": "Hostel common room",
  "note": "one line: why it matters",
  "kind": "interior" | "exterior",
  "lat": 40.7128, "lng": -74.006, "locAccuracyM": 18, "placeLabel": "New York, NY",
  "locSource": "gps" | "pin" | "typed",           // stored inside the row (column loc_source)
  "scaleHint": "small room" | "big room" | "hall" | "house" | "big building" | free text,
  "capturedAt": "ISO (phone clock at save)",
  "status": "captured" | "modelling" | "rendered",
  "frameGroup": "home" | null,
  "buildingId": "uuid" | null, "roomId": "kitchen" | null,   // a room of a whole place (section 6.4)
  "scene": { …scene.json v1 or v2… } | null,
  "sceneVersion": 0,                               // bumped by every scene write
  "tripStopId": null,
  "media": [Media…]                                // sorted by type, then sort
}
// Media
{
  "id": "uuid (deterministic: uuidFromKey(spotId + ':' + type + ':' + n))",
  "spotId": "uuid",
  "type": "photo" | "thumb" | "scan" | "model" | "render" | "compare",
  "name": "1" | "hero" | "cam1" | …,                // the :n path segment
  "r2Key": "spots/<id>/photos/1.jpg",
  "width": 2048, "height": 1536, "bytes": 412345, "sort": 1,
  "contentType": "image/jpeg",
  "createdAt": "ISO",
  "url": "/api/memories/file/spots/<id>/photos/1.jpg?t=<exp>.<sig>"   // signed, ~12 h; added by GET routes
}
```

### R2 keys (bucket `memory-rooms`, binding `MEMORIES`)

| type | `:n` | key |
|---|---|---|
| photo | 1…12 | `spots/<id>/photos/<n>.jpg` |
| thumb | 1…12 | `spots/<id>/thumbs/<n>.jpg` |
| scan | `scan` (ignored) | `spots/<id>/scan.spz` |
| model | `room` (any other name too) | `spots/<id>/model/room.glb`: the baked room the viewer shows |
| model | `map` | `spots/<id>/model/map.glb`: its small copy for the map's 3D dioramas (§4) |
| model | `empty` | `spots/<id>/model/empty.glb`: a building room's EMPTY bake, a texture-only GLB (§6.4). Uploaded only to a Worker whose ping lists `"empty"` in `models` (an older one stores every model name as room.glb) |
| render | name `[a-z0-9-]+` | `spots/<id>/renders/<name>.png` (`hero`, `marker`, `top`, `three-quarter`, `cam1`…) |
| compare | name `[a-z0-9-]+` | `spots/<id>/compare/<name>.png` (`compare`, `round1`…) |

Local row store (`MEMORIES_ROW_STORE=local`): `rows/spots/<id>.json`, `rows/media/<id>.json` in the same bucket.

## 3. Worker API (`workers/memory-rooms.js`, mounted at `/api/memories/`)

Auth on every route: `Authorization: Bearer <MEMORIES_PASSWORD or PORTAL_PASSWORD>`. Fails closed (503) when
neither secret is set. `/file/` also accepts `?t=<exp>.<sig>` (HMAC-SHA256 of `<r2Key>.<exp>`, key =
`MEMORIES_SIGNING_KEY` or, when unset, a hash of the passwords). `/walk/ws` takes only its walk ticket
`<spotId>.<who>.<exp>.<sig>` (HMAC of `walk|<spotId>|<who>|<exp>`, same key), minted by the bearer-checked
`POST /spots/:id/walk`.

Every JSON response is `{ data }` or `{ error, details? }`.

| Method & path | Body | Response |
|---|---|---|
| `GET /api/memories/ping` | – | `{ data: { ok: true, rowStore: "local"\|"supabase", models: ["room", "map", "empty"], features: ["buildings", "empty", "place-walk"] } }` (the gate's password check; scripts upload `model/map` / `model/empty` only when `models` has it: an older Worker stores every model name as room.glb. `features`: `buildings` once the building tables answer, `empty` = the empty / furnished bake (§6.4), `place-walk` = walking a whole place) |
| `GET /api/memories/spots` | `?deleted=1` includes soft-deleted | `{ data: [Spot…] }` newest `capturedAt` first, media with signed urls |
| `GET /api/memories/spots/:id` | – | `{ data: Spot }` (404 if missing) |
| `POST /api/memories/spots` | Spot capture fields incl. client `id` | `{ data: Spot }` 201 new / 200 existing. **Create once**: a POST for an id that already exists changes nothing and returns the stored row, so a retry never duplicates and never resets anything, and a late outbox re-send can't undo an edit. Every later change goes through PATCH. |
| `PUT /api/memories/spots/:id/media/:type/:n` | raw bytes; headers `content-type`, optional `x-width`, `x-height` | `{ data: Media }` (upserts the media row; the spot must exist) |
| `PATCH /api/memories/spots/:id` | any of `title, note, kind, lat, lng, locAccuracyM, placeLabel, locSource, scaleHint, capturedAt, createdBy, status, frameGroup, tripStopId, scene`, plus optional `ifUpdatedAt` | `{ data: Spot }`, its `updatedAt` the stored one (send it back as the next `ifUpdatedAt`). A `scene` is validated with `validateScene` (400 + `details: errors[]` if invalid), bumps `sceneVersion`, and sets `frameGroup` from `scene.frame.group`. Other fields are checked as listed below (400, every problem in `details`); unknown fields are ignored. |
| `DELETE /api/memories/spots/:id` | – | soft delete → `{ data: { id, deletedAt } }` |
| `POST /api/memories/spots/:id/restore` | – | clears `deletedAt` |
| `GET /api/memories/file/<r2Key>` | bearer or `?t=` | the bytes, with `content-type`, `etag`, `cache-control: private, max-age=3600` |
| `POST /api/memories/spots/:id/walk` | `{ who: "james"\|"justin" }` | `{ data: { ticket, expiresAt, socket: "/api/memories/walk/ws?t=<ticket>" } }`: a signed ticket for walking this spot's room together, valid **120 s** (to connect; the socket then lives on). 404 if the spot doesn't exist, 400 for a bad `who`. |
| `GET /api/memories/spots/:id/walk` | – | `{ data: { people: [{ who, since }] } }`: who is walking this room right now (one entry per person) |
| `GET /api/memories/walk/ws?t=<ticket>` | WebSocket upgrade, **no bearer** (browsers can't send one on a WebSocket) | 101 into the walk room (Durable Object `MemoryWalkRoom`, one per spot id, or per whole place keyed `b:<buildingId>`). No ticket: 401; a bad or expired one: 403; not an upgrade: 426. Messages: `workers/memory-walk.js` header (a state carries `l`, the walker's level id in a place). Nothing is stored: the room keeps only who's connected. |
| `POST /api/memories/buildings/:id/walk` | `{ who }` | as the spot's, for walking the whole place: a ticket `b:<id>.<who>.<exp>.<sig>` (HMAC of `walk\|b:<id>\|<who>\|<exp>`), so a place's room can never be a spot's. 404 if the place doesn't exist |
| `GET /api/memories/buildings/:id/walk` | – | `{ data: { people: [{ who, since, level? }] } }`: who is walking the place now, and on which level |

PATCH checks (POST shares the location and date ones; each `details` entry starts with the field it's about,
so a form can show it next to that field):

- `title` 1–120 characters, `note` 1–600, `kind` interior | exterior, `status` captured | modelling | rendered.
- `lat` and `lng` go together (send both, or neither), each a number in range or both `null` (no location).
- `locSource` gps | pin | typed | `null`; `createdBy` james | justin.
- `capturedAt` an ISO 8601 date-time with a zone (`2026-12-20T19:30:00.000Z`).
- `kind` can't change while the spot has a scene (the 3D room was built as that kind): 400.
- `ifUpdatedAt`: when present and not the spot's current `updatedAt`, nothing is saved and the answer is
  **409** (someone else changed the spot since the form opened). The edit page sends it; scripts don't.

Limits: photo/thumb must be `image/jpeg` ≤ 15 MB; scan ≤ 100 MB; model ≤ 40 MB (`model/gltf-binary`);
render/compare `image/png` or `image/jpeg` ≤ 25 MB. `:n` for photo/thumb is 1–12.

Clients: browser `src/memory-rooms/lib/api.js`, Node `tools/memory-rooms/lib/api.mjs`.

## 4. GLB contract (Blender `bake_export.py` → viewer)

- One file per spot: `room.glb`, y-up, metres, **same coordinates as scene.json** (no recentring).
- Every visible surface carries its **baked** look: material `baseColorTexture` = the baked atlas
  (diffuse colour × direct + indirect light), on the mesh's first UV set (the lightmap UV). The viewer swaps
  each material for `MeshBasicMaterial({ map })`, so lighting is never recomputed on the phone.
- Exceptions, by **material name prefix**:
  - `glass…` → viewer draws `MeshBasicMaterial({ color: baseColorFactor, transparent, opacity: 0.18 })`.
  - `emit…` → viewer draws `MeshBasicMaterial({ color: emissive or baseColor })` (lamp shades, signs, screens).
- **What a node is** (2026-11-22): every node a bake exports carries glTF extras `mrKind: "structure" | "furniture"`
  (three.js `userData.mrKind`): walls, hubs, floors, ceilings, stairs, slabs, roof, site, ground = structure; every
  scene object (`obj__<id>`, a building's `room__<room>__obj__<id>`) and its parts = furniture. The viewer reads the
  nearest labelled ancestor; a GLB baked before the label falls back to the name rule (a node named `obj__…` or
  `room__<room>__obj__…`, or under one, is furniture). `viewer/furnishing.js`.
- **Node names** (Blender object names; avoid `.` `:` `/` `[` `]` and spaces, three.js strips them):
  - `floor`, `ceiling`, `ground` (exterior plate).
  - `wall_north`, `wall_south`, `wall_east`, `wall_west` — every mesh that belongs to a wall (wall slab, skirting,
    window frame, glass, door frame, door leaf) is that node **or a child of it**, or is named with that prefix
    (`wall_north__window0_frame`). The viewer hides a whole wall by prefix in dollhouse view.
  - `obj__<id>` for each scene object (children `obj__<id>__<part>`).
  - `pin__<n>` is NOT exported; the viewer draws pins from scene.json.
- Textures WebP. Target ≤ 8 MB per room (warn above, fail above 15 MB).
- No cameras, no lights, no animations in the GLB.

### What the map shows (made from the above by `tools/memory-rooms/lib/`, no Blender)

- `renders/marker.png` (render `marker`): `renders/hero.png` trimmed to its non-transparent content
  (+2 px), shrunk to fit 240 × 240, palette PNG with alpha; an edge where the content ran into the
  hero's frame fades out. The map stands a rendered spot on its location as this image (bottom
  centre on the point). `lib/marker.mjs`.
- `map.glb` (model `map`): `room.glb` with every texture shrunk to fit 512 px (WebP) and the geometry
  quantised + meshopt-compressed (`EXT_meshopt_compression`, `KHR_mesh_quantization`). Same frame,
  node names and material names as `room.glb` (checked: it fails if a node name is lost), so the
  dollhouse cut-away and the material prefixes work the same. ~3–4× smaller (bedroom 2.0 MB →
  563 KB). The map's 3D diorama past zoom 15. `lib/mapModel.mjs`.
- `bake.mjs` makes both, `push.mjs` makes either when missing or older than its source,
  `backfill-map-assets.mjs` makes them for spots already pushed. A spot without them still works:
  the map shrinks the hero, or room.glb's textures, in the browser (more to download).

## 5. Blender kit API (`tools/memory-rooms/blender/`)

```
blender.exe -b --factory-startup --python tools/memory-rooms/blender/build_room.py -- \
    --scene <work>/scene.json --out <work> [--samples 64] [--res 1200] [--only cam1,top] [--no-render]
  → <work>/room.blend, <work>/renders/{cam1..camN,top,three-quarter}.png, <work>/build-report.json

blender.exe -b --factory-startup --python tools/memory-rooms/blender/bake_export.py -- \
    --blend <work>/room.blend --out <work> [--atlas 2048] [--samples 256]
  → <work>/room.glb, <work>/renders/hero.png, <work>/export-report.json
```

- `scene_io.py`: `load_scene(path) -> dict` (validates with the same schema; raises with every error),
  `to_bl(p)`, `rot_bl(rotY)`, `hex_rgba(hex)`.
- `materials.py`: `get(name, color=None, accent=None, **opts) -> bpy.types.Material` (cached per name+colour).
- `kit/<name>.py` each define `build(ctx, spec) -> list[bpy.types.Object]`. They model in **local space**: base
  centre at the origin, `size` = [w, h, d] mapped to Blender (x = w, y = d with the FRONT toward **-y**, z = h).
  (Scene +z = south = Blender -y, so a front facing local -y faces south at rotY 0.) `build_room.py` parents
  the result under an empty `obj__<id>`, then places it with `to_bl(at)` and `rot_bl(rotY)`.
  `ctx` gives `ctx.materials`, `ctx.scene` (the dict), `ctx.work` (Path), `ctx.collection`, `ctx.rng` (seeded
  per object id, so rebuilds are identical) and helpers in `kit/_util.py` (bevelled boxes, cushions, etc.).
- `kit: "bespoke"`: `<work>/bespoke/<script>.py` defines `build(ctx, spec)` with the same contract.
- `kit: "glb"`: imports `<work>/<src>`, scales it to fit `size`, keeps its materials.

## 6. Whole buildings + scene.json v2 (2026-11-21)

Three files say it in code: `scene/scene.schema.json` (v1 + v2), `building/building.schema.json` (building.json v1),
`building/sketch.schema.json` (the phone's sketch plan). Validators: `scene/validate.js`, `building/validate.js`
(JS, shared by the Worker, the viewer and the scripts) and their Python mirrors `blender/scene_io.py`,
`blender/building_io.py` (+ `blender/polygon2d.py` = `scene/polygon.js`). Geometry: `scene/shell.js` (every shell
shape → one normalised shell) and `building/geometry.js` (+ the same functions in `building_io.py`).
`node tools/memory-rooms/check-contracts.mjs` proves the JS and Python sides agree (valid examples, broken
mutations failing at the same paths, shells / frames / loops / ceilings to 1e-6). Worked examples:
`tools/memory-rooms/examples/house.building.json`, `house-living.v2.scene.json`, `shed-octagon.v2.scene.json`,
`warehouse-gable.v2.scene.json`.

### 6.1 scene.json v2 (v1 stays valid and renders unchanged)

`"version": 2` allows three shells (v1 allows only the first, and no ceiling shape):

| shell | fields | frame |
|---|---|---|
| box | `width, depth, height` (+ floor, walls, ceiling, openings as v1) | NW floor corner = [0, 0] |
| polygon | `outline: [[x, z]…]` (the walls' inner faces, 3–64 corners, either direction, simple, ≥ 0.5 m²) + `height` | the outline's bounding box starts at [0, 0] (checked) |
| room of a building | `{ building: <buildingId>, room: <roomId> }`, nothing else | the room frame (6.2); walls, floor, ceiling, openings come from building.json; no `frame` |

- **Ceiling** (`shell.ceiling`, a v2 box or polygon): `shape` flat (default) | gable | pyramid | skillion. The shell
  `height` is the walls at the eaves; `peak` the highest point (required unless flat, above the eaves).
  - gable: the ridge runs along `axis` (x = west–east, z = north–south; default the bounding box's longer side) at
    `ridgeAt` (across the other axis; default the middle). `eaves: [low side, high side]` when they differ. The walls
    under the ridge's ends rise to it (the gable ends).
  - pyramid: every wall at the eaves, rising to `peak` at `apex` (default the outline's centroid); its faces run from
    each edge to the apex (the room should be convex, or at least star-shaped about the apex).
  - skillion: one plane, `height` on the `low` side, `peak` on the opposite side.
  - `ceilingAt(shell, x, z)` (`scene/shell.js`, Python `scene_io.ceiling_at`) is the one definition, over the outline's
    bounding box. A wall's top follows it (`wallTopAt`).
- **Openings**: a box names `wall` (north | south | east | west, offset from the lower-x / lower-z end, as v1); a
  polygon names `edge` (0 = outline[0] → outline[1]; offset from outline[edge] toward the next corner). Edge numbers
  (and `wall__e<i>`) follow the outline **as written**, even when `resolveShell` reverses it to positive winding.
- **The normalised shell** (`resolveShell(scene, building?)` → `{ kind, outline (positive winding), box, width, depth,
  height, top, ceiling, walls: [{ id, node, a, b, out, length, thickness, legacy }], openings: [{ wall, type, offset,
  width, height, sill, head, from, to }] }`) is what the viewer, check-scene, the walk grid and AR read. Don't branch
  on the shell's shape anywhere else. `walls[].node` is the name a fresh bake would give; a GLB is always matched by
  `parseWallNode` (either form), never by `node`, so a v1 room re-labelled v2 without a rebuild still works.
- Winding: "positive" = shoelace over (x, z) > 0 = clockwise on a north-up map (NW → NE → SE → SW); the outward normal
  of a positive edge a → b is (dz, −dx)/|d|.
- **Objects may give a `footprint`** (any version): their real plan outline, `[[x, z]…]` in the scene frame, for a piece
  that is not a box in plan (a loft or a bench fitted to an angled wall). check-scene tests the walls and the ceiling
  at its corners instead of the box's (and the door swing, when it is convex); it must lie inside the box's
  footprint, and only `bespoke` or `glb` pieces may have one (a kit always draws its box). Blender ignores it (the
  bespoke script / the GLB draws the real shape).

### 6.2 building.json v1

```
version 1, title, notes?, source? (plan | sketch | photos | mixed), style?
geo?       { lat, lng, north }   plan origin [0, 0] on Earth; north = compass bearing of plan up (−z), ° clockwise from true north
levels[]   { id, name?, elevation, height, slab?, nodes: [{ id, at: [x, z] }], walls: [{ id, a, b, thickness?, height?, exterior?, outside? }] }
rooms[]    { id, name, level, outline: [nodeId…], kind?, floor?, walls?, ceiling?, spotIds?: [spotId…] }
openings[] { id, wall, type: door | window | opening | garage, offset, width, height, sill?, swing?, hinge?, open?, color? }
stairs[]   { id, from, to, start: [x, z], dir: north | south | east | west, width, length, steps?, color?,
             finish?: timber | tile | concrete | steel, walls?: none | left | right | both, wallColor? }
roof?      { type: gable | hip | skillion | flat, pitch?, overhang?, ridge?, low?, level?, height?, finish?, color?, parts?[] }
site?      { lot: polygon, ground?, areas?[] (drive | path | paving | deck | lawn | garden | pool | water), fences?[], trees?[],
             features?[]: { id, kind: box | cylinder | ring | disc | shrub | letterbox, at: [x, z], y?, size: [w, h, d], rotY?, color?, finish?, label? } }
wall.outside? { finish?, color?, rake?: { finish?, color? }, panels?: [{ offset, width, sill?, height?, finish, color? }] }
```

- **Plan frame** = x east, z south, y up (the scene frame, building-wide). A level's floor is at y = `elevation`.
  `geo.north` places it on Earth: plan [x, z] → metres east e = x·cos t − z·sin t and north n = −x·sin t − z·cos t
  (`planToLngLat`).
- **The wall graph** is per level. A wall is a centreline between two nodes; wall ids are unique across the building
  (openings name them without a level), node ids per level. **Every wall exists once**: two walls on the same node
  pair, collinear overlaps, crossings without a node, and a node sitting on another wall's middle are all errors
  (split the wall at the node). Thickness defaults: 0.25 m exterior, 0.1 m inside.
- **Exterior walls** (`exterior: true`) must close into loops (every node they touch has exactly two). The largest
  loop of the roof's level is the outline the roof follows (`exteriorLoops`).
- **Rooms** are polygons over their level's nodes (centrelines), in order, either direction; simple, ≥ 0.5 m², no two
  overlapping on a level. Consecutive nodes joined by a wall have it on that side; otherwise the side is open (an
  arch, an open-plan edge). A spot belongs to at most one room.
- **Room frame**: the building frame moved to `room.origin` (plan [x, z], fixed once the room has a scene), else to the
  north-west corner of the room's wall-CENTRELINE bounding box, on its level's floor (`roomFrame` →
  `origin = [x0, elevation, z0]`). `sketchToBuilding` pins every room's origin to its sketched corner, so tracing the
  real walls later never moves a room's furniture, cameras or pins. A room's scene.json v2 (`shell: { building, room }`)
  places its objects, lights, pins and cameras in this frame. Its floor is bounded by the inner faces (each side inset
  by half its wall's thickness; a step where two walls of different thickness meet in line): `buildingRoomShell`.
- **Openings** run along their wall's centreline from node a toward b (`offset` to the near edge) and must clear the
  walls they meet at each end (offset ≥ half the thickest other wall at node a; the same at b). `swing` = the side a
  door leaf opens into, looking from a to b; `hinge` = the end its hinges are on. In a room's normalised shell they
  are re-measured along that room's inner face, with swing and hinge turned round for a room running b → a.
- **Levels stack**: a level's floor structure (`elevation − slab`, slab default 0.25) may not cut into the level below
  (its `elevation + height`); exterior walls run up to the next level's floor, so the facade has no gap.
- **Stairs** are straight flights: `start` = the middle of the first riser, climbing toward `dir` to the last riser
  `length` m further on, `width` wide (`stairFootprint`: corners in the climber's order, which winds the other way to
  rooms). `steps` = risers (default rise / 0.18 m rounded half up, the same in JS and Python); the last lands on the
  `to` floor, so a tread's going = length / (steps − 1). The `to` level's floor gets a
  hole over the footprint (no void room needed). Optional (2026-11-22): `finish` (default timber = stepped blocks;
  tile / concrete = a solid flight with a sloping soffit, treads and risers in `color`; steel = plates), `walls`
  (solid raking side walls 0.19 thick, 1 m above the nosings, left / right looking up the flight, in `wallColor`;
  from the ground outside the `from` level's exterior loop, from the flight's underside over its rooms). Walls and
  ceilings of the `from` level inside the footprint of a non-timber flight are cut down to its underside.
- **Outside finishes** (`wall.outside`) go on the faces that look outside (no room on that side, or an outdoor room).
  Optional (2026-11-22): `rake` = the finish of the raking band between the wall's top and a skillion roof above it;
  `panels` = face-only bands of another finish (a cladding panel beside a window), placed like an opening (`offset`
  from node a along the centreline, `width`, `sill` default 0, `height` default up to the top) but with no hole and
  no clearance rule, so a panel may run to a wall's end and sit hard against a window. A panel must fit its wall.
- **Site features** are small objects on the ground (`y` above it, default 0): `size` = [w, h, d] in the feature's
  frame (round kinds: w and d are diameters), `rotY` as in scenes. ring = a hollow round planter with soil;
  letterbox = a block with `label` (≤ 8 chars) and a slot on its front; shrub = a clipped ball. Built into
  exterior.glb as `site__<id>`. Fences may also be `sheet` (ribbed sheet metal); a `garden` area is a mulched bed;
  areas draw in order, each a few mm above the one before.
- **Roof**: the outline is split into rectangles (or `parts` give them, on the walls' centrelines like everything else,
  each optionally on its own `level` with its own type: a single-storey wing), each gets its own roof and they merge
  (valleys where they meet). Eaves at `height` above the level's floor (default its height), the overhang (default
  0.45 m) measured from the walls' outer faces, pitch default 22.5° (skillion 5°). v1 limits: ridges run along x or z,
  a skillion falls to a plan side, an angled wing needs a `parts` rectangle in its own axes later, and a courtyard loop
  gets no roof of its own.
- **Directions** in a building (`stair.dir`, `roof.low`, `roof.ridge`) are **plan** directions; only `geo.north` knows
  true north. The map turns a model by `rotation.y = −north` (radians), the opposite sense to `rotY`.
- **Who's in which room**: the phone writes `spot.buildingId` + `spot.roomId` at capture (the truth for "captured");
  the render side lists them in `rooms[].spotIds` when it traces the plan, and a room's scene says
  `shell: { building, room }`. `push.mjs` refuses a scene whose `shell.room` differs from its spot's `roomId`, and
  sets the spot's `buildingId` / `roomId` from building.json when they were missing.

### 6.3 GLB naming for v2 walls (the dollhouse works for any shape)

- v1 scenes keep `wall_<side>` exactly as before (section 4). **v2 scenes and buildings** name each wall `wall__<id>`
  (two underscores; parts `wall__<id>__<part>`), with **glTF extras** on the wall node:
  `{ "mrWall": { "id", "normal": [nx, nz] } }` (three.js: `node.userData.mrWall`). For a room shell `normal` is the
  wall's **outward** normal from the room; for a building wall it is the left normal looking from a to b, plus
  `"rooms": { "left", "right" }` (room ids or null) and `"exterior"`.
- The viewer hides walls **by normal** (`viewer/dollhouse.js`): the normalised shell's `out` for that wall id when the
  scene is at hand, else the node's extras (`scene/shell.js` `wallNormalOf`), else the legacy name (`wall_north` →
  [0, −1], `wall_south` → [0, 1], `wall_west` → [−1, 0], `wall_east` → [1, 0]). They agree by construction;
  `tools/memory-rooms/shell-view-check.mjs --glb <room.glb> --scene <scene.json>` proves it on a bake.
- Blender: every v2 interior (boxes too) is built by `blender/shell_v2.py` (any polygon, any ceiling shape, mitred
  walls, gable ends cut to the ceiling with a section cap); v1 scenes still go through `shell.py` unchanged.
- Ids: v2 box walls `north | south | east | west` (→ `wall__north`), polygon edges `e<i>` (→ `wall__e3`), building walls
  their building.json id (→ `wall__g-n1`). Building ids never contain `_`, so `__` splits a name unambiguously.
- `bake_export.py` exports with `export_extras` on for v2 scenes and buildings (custom properties become extras; the
  viewer ignores the rest). v1 bakes are unchanged.

### 6.4 Building rows, API and files

```jsonc
// Building (API camelCase; SQL memory_buildings, snake_case)
{
  "id": "uuid (client-generated)", "createdAt", "updatedAt", "deletedAt": null,
  "createdBy": "james" | "justin",
  "title": "Brooklyn apartment", "note": "one line" | null,
  "lat", "lng", "locAccuracyM", "placeLabel", "locSource",   // as a spot
  "capturedAt": "ISO", "status": "captured" | "modelling" | "rendered",
  "sketch": { …sketch v1… } | null,     // the phone's room checklist / sketch plan (building/sketch.schema.json)
  "plan": { …building.json v1… } | null, // the render side's building (validated); planVersion +1 per write
  "planVersion": 0, "tripStopId": null,
  "media": [Media…]                     // as a spot's, with buildingId instead of spotId
}
// Spot gains: "buildingId": uuid | null, "roomId": "kitchen" | null   (frameGroup stays, legacy)
```

- **Sketch v1** (`building/sketch.schema.json`, `validateSketch`): `{ version: 1, grid?, north?, levels: [{ id, name }],
  rooms: [{ id, name, level, rect?: [x, z, w, d], mark?: { photo, u, v } }] }`. `rect` = the room drawn on the sketch
  grid (metres, plan frame); `mark` = where its label sits on floor-plan photo `photo` (u, v in 0..1). A room is "done"
  when a spot has its `roomId` (never stored in the sketch). Room ids are building.json ids: the render side keeps them
  when it traces the plan, so captured spots land in the right rooms.
- **Routes** (same auth and `{ data }` / `{ error, details }` shapes as spots): `GET /buildings[?deleted=1]`,
  `GET /buildings/:id`, `POST /buildings` (create once by client uuid; a re-send changes nothing),
  `PATCH /buildings/:id` (any of `title, note, lat, lng, locAccuracyM, placeLabel, locSource, capturedAt, createdBy,
  status, tripStopId, sketch, plan` + `ifUpdatedAt` → 409; `sketch` → `validateSketch`, `plan` → `validateBuilding`,
  both 400 with `details`), `DELETE /buildings/:id` (soft), `POST /buildings/:id/restore`,
  `PUT /buildings/:id/media/:type/:n`. Spots: POST and PATCH take `buildingId` (uuid or null) and `roomId` (building
  id pattern or null; needs a `buildingId`). The building need not exist yet (the outbox sends it first, but a spot
  never fails on it).
- **Before `supabase/memory_buildings.sql` has run** (the live database until James runs it): the building routes and a
  spot carrying `buildingId` / `roomId` answer `503 { error, code: 'needs-sql' }` (a missing table or column), plain
  spots save as ever, and `GET /ping` lists `features: ['buildings']` only once the table answers. The phone's outbox
  holds a `needs-sql` entry (kept on the phone, retried every few minutes) and carries on with the rest.
- **Sketch edits from two phones merge** (`building/sketch.js` `mergeSketch`, in the outbox just before the PATCH):
  the server's sketch, this phone's rooms on top by id, minus the rooms this phone removed; sent with
  `ifUpdatedAt` = the server's `updatedAt` it merged into (a 409 is merged again on the next try).
- **R2 keys**: `buildings/<id>/plan/<n>.jpg` (media type `plan`, 1–4: floor-plan photos), `buildings/<id>/photos/<n>.jpg`
  + `thumbs/<n>.jpg` (1–12: the outside shots), `buildings/<id>/model/<name>.glb` (`exterior`, `level-<levelId>`, `map`),
  `buildings/<id>/renders/<name>.png`, `buildings/<id>/compare/<name>.png`. Local row store: `rows/buildings/<id>.json`,
  `rows/bmedia/<id>.json`. `/file/` serves `spots/…` and `buildings/…` keys.
- **What the render side makes** (`build_building.py`), every GLB in the **plan frame with absolute y** (a level's
  GLB already sits at its elevation): per level `level-<levelId>.glb` (its walls once, floors,
  ceilings, stairs, every room's furnishing; one light solve per level with the sky and sun, so
  the exterior walls' outer faces are lit too), `exterior.glb` (roof + site), `renders/hero.png` + `marker.png`,
  and for every spot in `rooms[].spotIds` its own `room.glb` (its slice of the level
  bake, moved into its room frame, so the spot page, walk and AR work as for any spot). Node names in a level GLB:
  `floor__<roomId>`, `ceiling__<roomId>`, `floor__band` (the section under the walls), `floor__slab`,
  `wall__<wallId>` (+ `__window0`, `__door0_leaf`…, joined into the wall by the bake; its extras `mrWall = {id,
  normal: its left normal, exterior, rooms: {left, right}}`), `wall__<ownerWallId>__hub__<nodeId>` (the junction
  piece at a T or a cross, its own node so a room's slice keeps the corners it touches; it hides with its owner),
  `stair__<id>`, and each furnishing piece as its own top-level
  node `room__<roomId>__obj__<id>` (Blender names are global, and two rooms may both have a `bed`; no shared parent:
  the bake joins meshes per top-level node). A room's `room.glb` slice renames them back to `obj__<id>`, moves
  everything into the room frame, and gives each of its walls `mrWall.normal` = the outward normal from that room. Floors are built facing up (a fan over a positive outline faces down: reverse it). `exterior.glb`: `roof` (one mesh, every part), `ground`,
  `site__<areaId>` (fences and trees: not built yet). No `model/map` for a building yet (the map shows its marker).
  Several spots in one room's `spotIds` each get the same slice (the first room scene found furnishes it).

### 6.5 Every level in one plan (2026-11-22, the standard for a multi-level place)

`building/planLayout.js` `levelPlanLayout(building, aspect, { gap = 1.8, ids })` is the ONE arrangement every
multi-level plan uses (pure; `building-selftest.mjs` checks it on 12B Fletcher and a synthetic 3-level case):

- Levels lowest first: left → right when the view is wide (`aspect >= 1`, `direction: 'row'`), top → bottom when
  it is portrait (`'column'`). Same scale, same plan north, nothing rotated: a level only ever MOVES by `offset`.
- Cells: the union of every level's footprint (walls ± half their thickness), one per level at a fixed pitch (the
  union's extent along the axis + `gap`). So each level sits where it sits on the plan, registered with the
  levels beside it (aligned on the shared plan origin); a smaller level leaves its cell partly empty.
- `levels[i] = { id, name, index, elevation, offset: [dx, dz], cell: { min, max }, box: { min, max } }`;
  `bounds` = all of it. `levelAtLayoutPoint(lay, [x, z])` → `{ id, plan: [x, z] }` maps a layout point back.
- The 3D plan (`viewer/buildingStage.js`): each level's holder moves to `[dx, −elevation, dz]` (every floor on the
  drafting table, so one world cut plane at `CUT_Y` clips them all), its section cap from building.json, a label
  (its name, Recall mono small caps) above its cell's north-west corner, the drafting table moved under the whole
  layout without a contact shadow. A tap subtracts the hit level's holder position: the plan point on that level.

### 6.6 Walking a whole place (2026-11-22)

`/memories/b/:id/walk` (`pages/WalkPage.jsx` `PlaceWalkPage`, `walk/WalkGame.js` `loadPlace`):

- Every level GLB is a floor (plan frame, absolute y) with its own walkable grid: the band (0.15–1.7 m) is
  measured from the level's floor; every `door` / `opening` / `garage` of the level (sill ≤ 0.2) is cleared through
  its wall (the bake shuts door leaves), and a flight's footprint is blocked on its `to` level (the hole).
- A flight (`stairs[]`) is walked in one dimension: a step toward it within 0.75 m of its foot (on `from`) or its
  head (on `to`), heading within ~60° of along it, puts you on it; y = lerp(from, to elevation, u / length); you
  are on `from` for the lower half and `to` for the upper; stepping off either end lands you on that level's grid.
- The floors above yours hide; the exterior's site shows, its roof does not. Photo marks and seats come from every
  captured room's scene, moved by its room frame's origin (`roomFrame`).
- The walk room is `MemoryWalkRoom` keyed `b:<buildingId>`; a state's `p` is plan-frame with absolute y and `l` is
  the level id. You draw only the people whose `l` is yours; the others are listed ("Justin is upstairs").
