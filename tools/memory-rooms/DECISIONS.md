# Memory Rooms: decisions made during the unattended build (2026-11-08)

Each entry: the decision, why, and how to change it. The build prompt
(`src/components/portal/modules/memory-rooms-plan/build-prompt.md`) is the spec;
these are the calls it left open.

## Repo and setup

1. **Branch `feat/memory-rooms` was cut from `feat/memory-rooms-plan` with its uncommitted work** (the plan module, `registry.js`, the prompt dump). `git checkout -b` carries the working tree, so the plan page is still there, uncommitted. *Change:* commit the plan on `feat/memory-rooms-plan` first, or `git stash` it, before committing this branch.
2. **`.dev.vars` got two lines appended**: `MEMORIES_PASSWORD=trip-local` and `MEMORIES_ROW_STORE=local`. Nothing else in it was touched. A new `.dev.vars.example` documents every variable. *Change:* edit `.dev.vars`.
3. **`vite.config.js` gained an opt-in dev proxy**: `API_PROXY=http://127.0.0.1:8788 npx vite` forwards `/api/*` to `wrangler dev`, so the UI can be developed with HMR. Unset = no change to existing behaviour. *Change:* delete the `server:` line.
4. **New packages.** dependencies: `d3-geo`, `topojson-client`, `@sparkjsdev/spark` 2.4.0. devDependencies: `us-atlas`, `world-atlas`, `topojson-server`, `topojson-simplify` (only `build-atlas.mjs` uses them) and `sharp` (already installed through wrangler/miniflare; now explicit because the Node scripts use it).
5. **Routes**: `src/App.jsx` has the four routes the spec lists, all rendering one lazy chunk (`MemoryRoomsApp`) with a `page` prop, so the feature is one import to move. Every in-app URL comes from `src/memory-rooms/routes.js` (`BASE = '/memories'`).

## scene.json v1

6. **`rotY` convention: at 0 an object's front faces south (+z)**; 90 east, 180 north, 270 west (the three.js / Blender sense of rotation about up). The prompt's example had a desk on the north wall at `rotY: 180`, which under this rule faces the wall; the shipped example uses `rotY: 0`. *Why:* one fixed rule makes check-scene, the kit and the scorer agree. *Change:* only by rewriting every kit piece; don't.
7. **Camera `fov` is across the photo's long edge**, plus an optional `aspect` (width / height, default 0.75 portrait) and `roll`. *Why:* phones are held both ways, and "long edge" stays the same number (≈ 69–72° for a main camera) either way. three.js gets the vertical fov from `geometry.verticalFov()`.
8. **Schema additions beyond the prompt** (all optional): `notes`, `hero` view, object `label` / `mount` / `overlaps` / `params` / `accentMaterial` / `photos`, opening `color` / `open`, wall `thickness` / `skirting`, `style.exposure`, light `look` / `size` / `azimuth` / `object` and types `ceiling`, `spot`, `area`, `window`, `frame.y` (upper floors). Materials add stone, marble, velvet, chrome, brass, ceramic, plastic, paper, emissive; ground finishes add concrete, gravel, dirt. *Why:* each one removes a reason to write a bespoke script or to fail the 2 cm checks on purpose (`overlaps` for a chair under a desk, `mount` for wall-hung things).
9. **One validator, hand-written**: `validate.js` interprets exactly the JSON Schema keywords the schema uses and throws on any other keyword, and `scene_io.py` mirrors it line for line. *Why:* Ajv compiles validators with `new Function`, which Cloudflare Workers forbid, and Python needed the same rules without pip installs inside Blender.
10. **Walls are built outside the interior box** (`walls.thickness`, default 0.12 m), so `width`/`depth` are always the inside measurements you'd take with a tape.

## Storage and API

11. **Media row ids are derived from (spot, type, name)** (a v5-style uuid), and `memory_media` has two extra columns, `name` and `content_type`; `memory_spots` has `loc_source` ('gps' | 'pin' | 'typed'). *Why:* re-uploading photo 3 or a new render overwrites the same row instead of piling up duplicates, which makes every upload safely retryable from the outbox.
12. **`POST /spots` is an upsert that only refreshes the capture fields** and never resets `status`, `scene` or `sceneVersion`, so a late retry from a phone can't undo modelling work.
13. **Signed file links**: HMAC-SHA256 over `<r2Key>.<exp>`, `exp` rounded to 6-hour windows (12–18 h validity). *Why:* the URL stays identical within a window, so browsers cache photos and GLBs. The key is `MEMORIES_SIGNING_KEY`, or derived from the passwords when unset (changing a password then expires every link, which is fine).
14. **`MEMORIES_ROW_STORE` is `"supabase"` in `wrangler.jsonc` vars and `"local"` in `.dev.vars`** (which overrides vars in `wrangler dev`). Production therefore fails closed with a clear 503 until the SQL has been run, rather than silently writing JSON rows into R2.
15. **The R2 binding is in `wrangler.jsonc` now**, which means the next `npm run deploy` (of anything) fails until the bucket exists: `npx wrangler r2 bucket create memory-rooms`. It's on the deploy checklist.
16. **Uploads stream straight into R2** when the request has a content length (a 100 MB scan never sits in Worker memory). Limits: photo 15 MB, thumb 2 MB, scan 100 MB, model 40 MB, render/compare 25 MB.
17. **The Supabase row store has not run against the real database** (the SQL wasn't run, per the rules). Both stores pass `tools/memory-rooms/api-check.mjs` (31/31): the local store directly, and the Supabase store against `tools/memory-rooms/pgrest-stub.mjs`, an in-memory PostgREST stand-in that enforces the SQL's checks, foreign key and unique keys; the rows it stored have exactly the SQL's columns. *Do:* after running the SQL, set `MEMORIES_ROW_STORE=supabase` in `.dev.vars` and run `api-check.mjs` once against the real project.

## Map

18. **The atlas also draws Mexico, faintly, north of 24°N**, so the border near San Diego and the Gulf doesn't end in the void. Canada is clipped south of 60.5°N (BC and Alberta's northern border is 60°N). 196 KB, 40% of the source points kept. *Change:* `tools/memory-rooms/build-atlas.mjs`, then re-run it.
19. **Typed places come from an offline gazetteer** of trip places (plus raw `lat, lng`), not a geocoding service. *Why:* works with no signal, no API key, no third-party calls from the phone.

## Render workflow

20. **Wrappers**: `build.mjs` = check-scene → build_room.py → compare (one compare round), `bake.mjs` = bake_export.py. The individual scripts still exist and are what the wrappers call.
21. **`compare.png` has four columns per photo: photo | render | 50/50 overlay | edges** (photo edges red, render edges blue, matching edges dark), and three scores per camera (structure = edge-map correlation, tone, colour). *Why:* misaligned cameras are obvious in the overlay, the self-test's modeller found 2–5 cm offsets only by comparing edges (so that column was added after the run), and the scores show whether a round helped. They're guides, not grades.
22. **check-scene's float rule**: a thing is held up if its base is on the floor, on another object's top under its centre, against a wall/object side (wall-mountable kits or `mount: "wall"`), or its top touches the ceiling. `mount: "free"` opts out. Door swings are a warning, not an error.
23. **Baked textures are display-referred**: the bake goes through AgX (the same view transform as the Cycles stills) before it is saved, so the viewer draws them with no tone mapping and matches the renders.

## Blender pipeline and kit

24. **Every interior piece is real geometry, built in local space inside its size box** (checked to 1 cm by `kit/preview.py`); duvets and curtains run a short cloth simulation and fall back to a procedural drape if it misbehaves. Piece options are in `kit/README.md` (e.g. bunk `ladder`, sofa `seats`/`arms`, shelf `books`). The bed's `accent` is its frame and headboard (a fabric accent gives an upholstered bed).
25. **Walls are mitred at the corners and their cut tops are a flat dark colour**, like an architectural section, so the dollhouse cut reads clearly.
26. **Look: Cycles + AgX "Medium High Contrast", auto exposure per `style.mood`.** One look for every spot. *Change:* `lighting.py` / `common.py`.
27. **The bake captures all lighting (not diffuse only)** so metals keep their colour, and furniture faces within 6 cm of a wall are baked a second time with the walls hidden, so the back of a bookcase against a cut-away wall isn't black.
28. **Up to 4 atlases per room** (2048 px each) when one would fall below ~110 texels/m; materials are `baked_atlas0..3` with `KHR_materials_unlit`; each object is one joined mesh `obj__<id>__mesh`; each wall one `wall_<side>` mesh including its glass and door. Bedroom: 2.1 MB, 1 atlas; diner: 2.1 MB, 4 atlases.
29. **The three-quarter/hero camera picks the corner whose cut-away walls have the fewest tall or wall-hung pieces against them.**
30. **Exterior photo-camera renders get a ground that runs to the horizon** (only in the stills, never baked), so they compare fairly against real photos.
31. **Baking is the slow step** (~2–2.5 min per room at 256 samples; build + 64-sample renders ~10–15 s). Blender bakes can't sample adaptively. *Change:* `bake.mjs --samples 128` halves it at some noise cost.

## Front end

32. **The 3D pages (spot, group) load on demand behind an error boundary**, so the map and capture flow (often on a weak signal) never download three.js and can't be broken by a viewer error. Spark (2.8 MB) loads only when Scan is chosen.
33. **The capture draft is saved to IndexedDB as you go** (stores `draft`, `draftPhotos`), so iOS dropping the tab loses nothing; Save moves it to the outbox (`outbox` + `outboxFiles`) in one transaction. Retries back off 5 s → 5 min; a 401 pauses the queue and shows the gate; files rejected for good (400/413/415) wait for a manual Retry; sent entries are pruned after 24 h, unsent ones never.
34. **A service worker (`public/memories-sw.js`, scope `/memories`, production builds only)** caches the app shell so `/memories/new` opens with no signal once the site has been visited. It never caches `/api/`.
35. **Save is allowed without a location** (the spot shows under "No location"); typed places store the place's rough radius as `locAccuracyM`.
36. **The who-picker appears only on the map and capture pages**; spot and group pages don't need it.
37. **The viewer stays mounted between spots** (one WebGL context per visit); panning is off (orbit + zoom only); arriving at a photo viewpoint shows the photo fully, and you slide towards the model.
38. **Pins and viewpoints are off in Scan mode**, because a Scaniverse scan has its own coordinates. Scans are flipped 180° about x by one constant (`SCAN_CORRECTION`); only Spark's public sample `.spz` has been tested, not a real room scan.
39. **Status reads by shape, not colour** (captured = ring, modelling = half, rendered = filled) on the map and in every status dot, so the palette keeps one accent (terracotta) for selection and emphasis, plus red for errors only. (From the screenshot review.)

## From the self-test

40. **"North" = the wall you face standing in the main doorway.** The capture shot guide's back-left / back-right / front-right / front-left corners are then NW / NE / SE / SW, the order photos 1–4 arrive in. *Why:* the self-test's modeller found "the wall the first photo looks at" ambiguous (a corner photo sees two walls).
41. **check-scene allows a camera standing in a doorway** (up to 0.6 m outside the wall line, within a door or opening's span), as a warning: "wide from the door" photos are taken there.
42. **Skirting takes the first WINDOW's colour (else off-white)**, never a door's. Before, whichever opening was listed first with a colour won, so a painted door made teal skirting.
43. **The self-test truth closes its door** and photo 6 stands just inside it: with the door half open, the camera in the doorway saw only the door leaf.
44. **The self-test is honest about its advantage**: the photos come from the same kit and renderer the modeller uses, so expect larger errors on real phone photos (see the README's worked example).
45. **In dollhouse view only wall-HUNG things hide with their wall** (`mount: "wall"`, or a frame/curtain/tv/sign/shelf flush with the wall and off the floor; curtains even when floor-length). A bookcase or TV unit standing on the floor against a hidden wall stays, because hiding it only reveals the dark floor it shaded in the bake.
46. **Bake fixes after the self-test**: each door gets a `wall_<side>__threshold` that hides with its wall, the band under walls is always the flat section colour, and the furniture-only second bake pass now has 6 px island gaps and no margin bleed, so it no longer paints a tan band along the wall/ceiling line.
