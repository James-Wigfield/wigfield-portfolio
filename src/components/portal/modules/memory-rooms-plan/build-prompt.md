# Build: Memory Rooms (trip spots → Blender-built 3D rooms on a map)

You're in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`: a Vite + React 19 SPA (react-router-dom 7, three 0.185) served by a Cloudflare Worker (`workers/app.js`, `wrangler.jsonc`) that also hosts a server-side `/api/*` layer. Supabase holds data. Read `CLAUDE.md` first and do what it asks (it keeps an Obsidian vault note). The plan behind this prompt is the portal page `/portal/memory-rooms-plan` (`src/components/portal/modules/memory-rooms-plan/`). This prompt is the spec.

## How to run this session

- **Unattended, start to finish.** James has left the PC and can't answer. Never stop to ask or wait for confirmation. When something is unclear, make a sensible call, write it in `tools/memory-rooms/DECISIONS.md` (decision, why, how to change it), and keep going. When something truly needs James (running SQL, creating cloud resources, his real photos and floor plan), prepare everything and put it on the checklist in your final message.
- **Branch `feat/memory-rooms`.** Don't commit, push, deploy, run SQL against Supabase, or create Cloudflare resources. Everything must run locally without them (see "Local first").
- **Use subagents when they help.** Use the Agent tool to run independent pieces in parallel, for example the Blender kit, the capture UI, the map and the Worker API, once the shared contracts exist. Write `scene.schema.json` and the API shapes yourself first, because every part depends on them. Brief each subagent fully: goal, files it owns, the contracts it must follow, how to check its work. Its brief is all the context it gets. Also use a fresh subagent as an unbiased reviewer: give it the screenshots or renders and ask for the worst problems, without your own opinion. Don't spawn agents for small tasks you can do in a few tool calls, and run no more than about 4 at once.
- **Priority order:** (1) the framework (capture → storage → Blender pipeline → viewer, all working end to end), (2) a minimal, professional UI. James will refine the UI afterwards in conversation, so build it to be easy to change rather than perfect.

## What it is

James and his mate Justin travel the USA and a bit of Canada from 16 Dec 2026 to 15 Jan 2027 (New York, Calgary/Banff, San Diego, Santa Barbara, Big Sur, San Francisco, New Orleans, the Gulf Coast, Miami). At a place with a real memory attached ("the common room of that hostel"), one of them opens `/memories/new` on their phone, marks it interior or exterior, takes 4–8 photos, writes one line about why it matters, and saves the spot with its location. After the trip, a Claude Code session turns each spot into a detailed 3D room or building, modelled and lit in Blender. The site shows a map of the USA plus western Canada; clicking a spot opens its explorable 3D model.

## Decisions already made (don't reopen them)

1. **Blender models and lights. three.js only displays.** For each spot, Claude writes a `scene.json` layout from the photos (schema below). A Blender Python kit, run headless, turns it into a detailed scene: bevels, smoothed cushions, cloth-simulated duvets and curtains, procedural wood, fabric and wall materials. Cycles renders it and bakes the lighting into textures, and Blender exports a GLB. The web viewer loads the GLB with three.js. The aim is a polished, stylised miniature, not photoreal, and every spot shares one look.
2. **`scene.json` stays the layout contract.** It holds sizes, positions, openings and one camera per photo, which keeps every spot checkable (`check-scene.mjs`) and comparable against its photos. For an object the kit can't express, Claude writes a bespoke Blender function (`kit: "bespoke"`). The entry still declares `id`, `size` and `at`, so the checks still work.
3. **Run Blender headless.** It's verified on this machine: Blender 5.2.2 LTS at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, with an RTX 5070 Ti on OptiX. A test room built in 1.2 s, rendered with Cycles at 1200×900 with 128 samples and denoising in 4.4 s, baked a 1K lightmap in 2.4 s and exported a 400 KB GLB in 0.4 s. Run it as `blender.exe -b --factory-startup --python <script> -- <args>`. Enable the GPU in every script: `prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "OPTIX"; prefs.get_devices()`, set `d.use = True` for each OptiX device, and set `scene.cycles.device = "GPU"`. Use the AgX view transform. The Blender MCP in `.mcp.json` (the blender.org Lab server) needs the Blender app open, so the pipeline must never depend on it. It's fine for optional live touch-ups.
4. **Bake for the web.** Give each object a second UV map for its lightmap (Smart UV Project or Lightmap Pack, with margin) and bake diffuse lighting (direct + indirect) into one atlas per room, or per large object. Export GLB with WebP textures and stay under about 8 MB per room. The viewer shows baked surfaces with `MeshBasicMaterial` (lighting already included), so it runs smoothly on a phone. Name wall meshes `wall_north|south|east|west` so the viewer can hide the walls facing the camera in dollhouse view. Also save Cycles stills: a 3/4 hero shot for the map card, and the per-photo renders for comparison.
5. **Optional photoreal lane: a Scaniverse scan.** If they also scanned the spot with the free Scaniverse phone app (it builds a Gaussian splat on the phone and exports `.spz`), they attach the `.spz` to the spot. The viewer shows it with Spark (`@sparkjsdev/spark`, three ≥ 0.180) and offers a Model ⇄ Scan toggle.
6. **Plain three.js viewer.** No `@react-three/*` in `src/memory-rooms/`, because the trip site this may move to runs React 18 with three and no r3f. Use GLTFLoader, OrbitControls and Spark, with a thin React wrapper that owns the renderer, resize and disposal.
7. **Storage behind one interface.** Rows go in Supabase `public.memory_spots` + `public.memory_media` (RLS on, no policies; the Worker uses `SUPABASE_SECRET_KEY`, the same pattern as `supabase/papers.sql` + `workers/papers.js`). Files go in a Cloudflare R2 bucket `memory-rooms`, binding `MEMORIES`. (Supabase's free storage is about 1 GB and shared with another app; R2 has 10 GB free.) Uploads go phone → Worker → R2; a Worker request body can be up to 100 MB.
8. **Local first.** The row store sits behind an interface with two implementations: `supabase` (the deploy target) and `local` (rows saved as JSON objects in the R2 binding). `MEMORIES_ROW_STORE=local` is the default in the example dev vars. `wrangler dev` simulates R2, so the whole loop runs on this PC with no Supabase SQL and no Cloudflare setup. Write `supabase/memory_rooms.sql` anyway, for James to run before deploying.
9. **Location comes from the browser at save time**, not photo EXIF, because iOS and Android strip GPS from photos picked in a web page. `navigator.geolocation` only works on HTTPS or localhost; when it fails, the user drops a pin or types a place. The pin stays draggable.
10. **Works offline.** Each capture goes into an IndexedDB outbox and uploads when there's signal, with visible status. Photos are resized on the phone to a 2048 px long edge (JPEG, quality ≈ 0.85) plus a 480 px thumbnail; HEIC decodes through `createImageBitmap`. A capture must never be lost.
11. **Gate.** `/memories` asks for a password once per device. The Worker checks a bearer token against `MEMORIES_PASSWORD` (shared with Justin) or `PORTAL_PASSWORD`, mirroring `requirePortalAuth` in `workers/app.js`. The device then picks "James" or "Justin" once, saved as `created_by`.
12. **Map.** SVG with d3-geo + topojson-client. Draw the USA states plus the Canada outline (from `us-atlas` / `world-atlas`, trimmed by a script into one committed TopoJSON under ~250 KB), with a conic projection fitted to the lower 48 plus southern BC and Alberta. Clicking a cluster zooms in. A spot's dot shows its status: a ring for captured, half-filled for modelling, filled for rendered.
13. **Scale.** A floor plan, when there is one, is the truth for room size. Otherwise, scale from anchors in the photos: a US interior door is about 2.03 × 0.81 m, ceilings run 2.4–2.7 m, a single bed is about 0.99 × 1.91 m. Use the scale hint typed at capture too.
14. **Houses go room by room in a shared frame.** Each room's spec has `frame: { group, origin, rotY }`, and `/memories/group/:group` assembles every rendered room's GLB into the whole building.
15. **Portable layout.** Front end in `src/memory-rooms/` (no imports from `src/components/portal/`), Worker code in `workers/memory-rooms.js` (mounted from `workers/app.js`), scripts in `tools/memory-rooms/`, the Blender kit in `tools/memory-rooms/blender/`, SQL in `supabase/memory_rooms.sql`, and the skill in `.claude/skills/memory-render/`.

## Routes

Add these to `src/App.jsx`, lazy-loaded with Suspense like `/films`:

- `/memories`: the map plus a list of spots, filterable by person and status.
- `/memories/new`: the capture flow, phone first.
- `/memories/:spotId`: the spot, with a photo strip, the note, the 3D viewer (Model / Scan toggle) and photo viewpoints.
- `/memories/group/:group`: the whole building.

## Capture flow

Phone first: one screen per step, with big buttons within thumb reach.

1. **Kind and name.** Interior or exterior, then a name.
2. **Photos**, with an on-screen shot guide. Interior: stand in each corner and shoot across the room (4), then the detail you'll remember, then one wide shot from the door. Exterior: four angles, one wide shot with context, one detail. Use `<input type="file" accept="image/*" multiple capture="environment">` plus "add from library". Require at least 4 photos and allow up to 12.
3. **The memory.** One required line, a scale hint (presets: small room / big room / hall / house / big building, or free text), and an optional `.spz` file.
4. **Location.** "Use where I am" runs GPS and shows its accuracy; otherwise use a pin or a typed place. Save puts the spot in the outbox.

Also show this tip: "Film a slow 20-second walk-around and keep it in your camera roll." It's insurance for a future reconstruction and isn't uploaded.

## Data

`memory_spots`: `id uuid pk`, `created_at`, `updated_at`, `created_by ('james'|'justin')`, `title`, `note`, `kind ('interior'|'exterior')`, `lat`, `lng`, `loc_accuracy_m`, `place_label`, `scale_hint`, `captured_at`, `status ('captured'|'modelling'|'rendered')`, `frame_group`, `scene jsonb`, `scene_version int`, `trip_stop_id text null`, `deleted_at` (soft delete).

`memory_media`: `id`, `spot_id` (foreign key, cascade), `type ('photo'|'thumb'|'scan'|'model'|'render'|'compare')`, `r2_key`, `width`, `height`, `bytes`, `sort`, `created_at`.

R2 keys: `spots/<id>/photos/<n>.jpg`, `…/thumbs/<n>.jpg`, `…/scan.spz`, `…/model/room.glb`, `…/renders/<name>.png`. The local row store uses `rows/spots/<id>.json` and `rows/media/<id>.json`.

Worker API (`workers/memory-rooms.js`, all routes bearer-gated):

- `GET /api/memories/spots`, `GET /api/memories/spots/:id`.
- `POST /api/memories/spots`: the client generates the uuid and the route upserts, so a retry can't make a duplicate.
- `PUT /api/memories/spots/:id/media/:type/:n` takes a raw body.
- `PATCH /api/memories/spots/:id`: a scene write is schema-validated and bumps `scene_version`.
- `GET /api/memories/file/<r2_key>` accepts the bearer token or a short-lived HMAC-signed query token, so `<img>`, GLTFLoader and Spark can load files.
- `DELETE /api/memories/spots/:id` soft-deletes.

Add `r2_buckets` (binding `MEMORIES`, bucket `memory-rooms`) to `wrangler.jsonc`, and add `MEMORIES_PASSWORD` and `MEMORIES_ROW_STORE` to the example dev vars.

## scene.json v1 (the contract — write it first)

Write it as a JSON Schema at `src/memory-rooms/scene/scene.schema.json` with one validator shared by the Worker, the viewer and the scripts. Python reads the same schema.

- Units are metres, and the floor is at y = 0.
- x runs west → east and z runs north → south. The origin is the room's north-west floor corner (interior) or the centre of the site (exterior).
- `at` is the centre of the footprint, on the object's base. `rotY` is in degrees.
- Walls: north is z = 0, south is z = depth, west is x = 0, east is x = width. An opening's `offset` runs along its wall from the wall's lower-x or lower-z end.
- Blender is z-up, so convert exactly once, in one function in the kit.

```json
{ "version": 1, "kind": "interior", "title": "Front bedroom",
  "style": { "mood": "evening", "palette": ["#e9e2d4", "#a7774f", "#56677f"] },
  "shell": { "width": 3.6, "depth": 4.1, "height": 2.7,
    "floor": { "finish": "timber", "color": "#a7774f" },
    "walls": { "finish": "paint", "color": "#e9e2d4" }, "ceiling": { "show": false },
    "openings": [
      { "wall": "north", "type": "window", "offset": 1.0, "width": 1.6, "height": 1.2, "sill": 0.9 },
      { "wall": "east",  "type": "door",   "offset": 0.3, "width": 0.82, "height": 2.04 } ] },
  "objects": [
    { "id": "bed",  "kit": "bed",  "size": [1.53, 0.5, 2.03], "at": [1.2, 0, 2.6], "rotY": 0, "color": "#ddd6c8", "accent": "#56677f", "material": "linen" },
    { "id": "desk", "kit": "desk", "size": [1.2, 0.75, 0.6],  "at": [2.9, 0, 0.4], "rotY": 180, "color": "#7a5a3c", "material": "oak" },
    { "id": "lamp-shade", "kit": "bespoke", "script": "pleated_shade", "size": [0.3, 0.25, 0.3], "at": [2.9, 0.75, 0.3] } ],
  "lights":  [ { "type": "lamp", "at": [2.9, 1.0, 0.3], "color": "#ffd8a0", "intensity": 1.0 },
               { "type": "sun", "from": "north", "elevation": 35 } ],
  "pins":    [ { "at": [1.2, 0.8, 2.6], "text": "Where the whole trip got planned" } ],
  "cameras": [ { "photo": 1, "pos": [0.3, 1.5, 3.9], "look": [2.4, 1.0, 0.6], "fov": 68 } ],
  "frame":   { "group": "home", "origin": [4.2, 0.0], "rotY": 0 } }
```

An exterior spec replaces `shell` with `site: { ground: { finish: "asphalt" | "grass" | "sand" | "snow" | "paving", size: [w, d] } }`, uses exterior kit pieces, and is lit by Blender's sky texture.

**Kit v1** lives in `tools/memory-rooms/blender/kit/`, one Python module per piece, sized by `size` = [w, h, d]:

- Interior: `box, cylinder, bed, bunk, sofa, armchair, table, desk, chair, stool, shelf, cabinet, counter, bar, fridge, tv, rug, lamp, pendant, plant, frame, curtain, sign`.
- Exterior: `block` (massing with `roof`, `windows: { rows, cols, faces }` and a door), `awning, tree, palm, pine, streetlight, car, fence, bench, sign`.
- Both: `glb` (an imported asset) and `bespoke` (a function in `memory-rooms-work/<id>/bespoke/<script>.py` that adds objects inside the declared box).

The shared materials library is `tools/memory-rooms/blender/materials.py`: oak, pine, walnut, painted plaster, brick, concrete, tile, linen, wool, leather, metal, glass, plants. Each is procedural and tinted by `color`. Quality bar: bevelled edges, soft cushions, real surface variation. Pieces should look carefully made, not like boxes. An unknown kit name fails validation.

**The viewer** has three views:

- Interior "dollhouse": orbit, with the walls between the camera and the room's centre hidden.
- Exterior: orbit, with a ground disc.
- `pins` render as numbered markers that open their note.

**Photo viewpoints:** each `cameras[]` entry shows as a small glyph. Clicking it flies the view there (0.8 s eased; with reduced motion it jumps) and crossfades the real photo over the model, with a blend slider.

## The render workflow (the framework — the most important part)

Write a project skill, `.claude/skills/memory-render/SKILL.md`, for "render spot X" or "render the next captured spots". Its scripts are in `tools/memory-rooms/`: Node for the API work, Python run inside Blender for 3D. Each script reads `MEMORIES_API` and `MEMORIES_PASSWORD` from the environment or the dev vars.

1. `pull.mjs <spotId|--next>` downloads the spot to `memory-rooms-work/<id>/` (gitignored) and sets the status to `modelling`.
2. `palette.mjs` finds dominant colours per photo and writes `palette.json`.
3. Claude reads every photo and any floor plan, then writes `layout.md` (dimensions and how they were derived, the objects, which photo shows what) and then `scene.json`.
4. `check-scene.mjs` validates against the schema and checks that objects sit inside the shell, nothing floats or interpenetrates by more than 2 cm, each door and window fits inside its wall, and every camera is inside the room and pointing at something.
5. `blender/build_room.py` turns `scene.json` into `room.blend`. It renders each `cameras[]` view plus a top-down and a 3/4 view with Cycles; draft at 64 samples is fine during iteration.
6. `compare.mjs` builds `compare.png`: each photo beside its Cycles render, plus the top-down. Claude reads it, names the 3 biggest mismatches and fixes `scene.json` or the bespoke scripts. Stop after 3 rounds and note what's still off in `layout.md`.
7. `blender/bake_export.py` bakes the lighting, exports `room.glb` with WebP textures, and saves the final hero render at full samples.
8. `push.mjs` uploads the GLB, the hero render and `compare.png`, saves the scene, and sets the status to `rendered`.

Document the skill in `tools/memory-rooms/README.md`.

## Self-test (do this, since James isn't here)

Make a **synthetic spot** with a known answer:

1. Write a ground-truth `scene.json` for an invented room, build it in Blender, and render 6 "photos" from the shot-guide positions.
2. Capture those photos as a spot through the real UI, driven headlessly with puppeteer-core and local Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`). Run it against `npm run build && npx wrangler dev --port 8788`. Port 8787 is taken by another project on this machine, and you must restart wrangler after each rebuild because it serves stale assets.
3. Run the skill on that spot without looking at the ground truth.
4. Report how far the reconstruction is from the truth: room dimensions, object positions and the per-camera comparison.

Keep the synthetic spot as the README's worked example.

## Done means

- `npm run build` passes, and `npx eslint src/memory-rooms workers/memory-rooms.js tools/memory-rooms` is clean.
- `tools/memory-rooms/page-check.mjs` passes. It checks the map, capture at 390 px, and the viewer loading a GLB with zero console errors, and it saves screenshots at 1440 and 390 px.
- The synthetic self-test has run end to end, with its error numbers in your final message.
- James can test one room of his house. Your final message tells him exactly how: take photos, capture the spot, give Claude the floor plan, run the skill. It also lists every decision from `DECISIONS.md` and what he must do before deploying (run the SQL, create the R2 bucket, set the secrets).
- The vault note and memory entry are written, per `CLAUDE.md`.

## The interface: professional, minimal, easy to change

- Quiet and confident: generous whitespace, one typeface pair, a restrained neutral palette with one accent, hairline rules, mono uppercase micro-labels, status as a small labelled dot beside the text. Avoid coloured rounded callout boxes with a left border, alert banners, filled pill badges, gradients and emoji.
- The 3D model and the photos are the heroes; the UI frames them and stays out of the way. Avoid long scrolling pages.
- Capture is phone first. The map and viewer are desktop first but must work at 390 px.
- **Built for iteration:** one scoped stylesheet (`.mr-` prefix) whose design tokens (colour, type, spacing, radius) all sit on the `.mr` root, with light and dark themes via `prefers-color-scheme`. Keep components small, put the UI copy in one file, and keep layout separate from logic, so a later "make it feel like X" pass touches tokens and a few components, not the framework.
- Before you finish, screenshot the main screens and have a fresh subagent review them. Fix the worst problems it finds.

## Out of scope for stage 1

MCP tools, server-side photogrammetry or splat training, AI image-to-3D services, video upload, public sharing, deploying, and the move to the trip site. Keep them possible: the API is the seam a future MCP would wrap.
