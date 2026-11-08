# Memory Rooms — contracts

The shapes every part of Memory Rooms agrees on: capture UI, Worker API, row stores,
Node scripts, Blender kit and viewer. Change a contract here first, then the code.

- `scene.json` v1: `src/memory-rooms/scene/scene.schema.json` (validator `scene/validate.js`,
  geometry helpers `scene/geometry.js`, Python mirror `tools/memory-rooms/blender/scene_io.py`).
- Worked examples: `tools/memory-rooms/examples/*.scene.json`.

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
  "scene": { …scene.json v1… } | null,
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
| model | `room` (ignored) | `spots/<id>/model/room.glb` |
| render | name `[a-z0-9-]+` | `spots/<id>/renders/<name>.png` (`hero`, `top`, `three-quarter`, `cam1`…) |
| compare | name `[a-z0-9-]+` | `spots/<id>/compare/<name>.png` (`compare`, `round1`…) |

Local row store (`MEMORIES_ROW_STORE=local`): `rows/spots/<id>.json`, `rows/media/<id>.json` in the same bucket.

## 3. Worker API (`workers/memory-rooms.js`, mounted at `/api/memories/`)

Auth on every route: `Authorization: Bearer <MEMORIES_PASSWORD or PORTAL_PASSWORD>`. Fails closed (503) when
neither secret is set. `/file/` also accepts `?t=<exp>.<sig>` (HMAC-SHA256 of `<r2Key>.<exp>`, key =
`MEMORIES_SIGNING_KEY` or, when unset, a hash of the passwords).

Every JSON response is `{ data }` or `{ error, details? }`.

| Method & path | Body | Response |
|---|---|---|
| `GET /api/memories/ping` | – | `{ data: { ok: true, rowStore: "local"\|"supabase" } }` (the gate's password check) |
| `GET /api/memories/spots` | `?deleted=1` includes soft-deleted | `{ data: [Spot…] }` newest `capturedAt` first, media with signed urls |
| `GET /api/memories/spots/:id` | – | `{ data: Spot }` (404 if missing) |
| `POST /api/memories/spots` | Spot capture fields incl. client `id` | `{ data: Spot }` 201 new / 200 existing. **Upsert**: a retry never duplicates and never resets `status`, `scene` or `sceneVersion`. |
| `PUT /api/memories/spots/:id/media/:type/:n` | raw bytes; headers `content-type`, optional `x-width`, `x-height` | `{ data: Media }` (upserts the media row; the spot must exist) |
| `PATCH /api/memories/spots/:id` | any of `title, note, kind, lat, lng, locAccuracyM, placeLabel, scaleHint, status, frameGroup, tripStopId, scene` | `{ data: Spot }`. A `scene` is validated with `validateScene` (400 + `details: errors[]` if invalid), bumps `sceneVersion`, and sets `frameGroup` from `scene.frame.group`. |
| `DELETE /api/memories/spots/:id` | – | soft delete → `{ data: { id, deletedAt } }` |
| `POST /api/memories/spots/:id/restore` | – | clears `deletedAt` |
| `GET /api/memories/file/<r2Key>` | bearer or `?t=` | the bytes, with `content-type`, `etag`, `cache-control: private, max-age=3600` |

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
- **Node names** (Blender object names; avoid `.` `:` `/` `[` `]` and spaces, three.js strips them):
  - `floor`, `ceiling`, `ground` (exterior plate).
  - `wall_north`, `wall_south`, `wall_east`, `wall_west` — every mesh that belongs to a wall (wall slab, skirting,
    window frame, glass, door frame, door leaf) is that node **or a child of it**, or is named with that prefix
    (`wall_north__window0_frame`). The viewer hides a whole wall by prefix in dollhouse view.
  - `obj__<id>` for each scene object (children `obj__<id>__<part>`).
  - `pin__<n>` is NOT exported; the viewer draws pins from scene.json.
- Textures WebP. Target ≤ 8 MB per room (warn above, fail above 15 MB).
- No cameras, no lights, no animations in the GLB.

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
