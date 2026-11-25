# Build: Dream Rooms (a dream, typed at 6 am → a walkable, liminal 3D dream on the site)

You're in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`: a Vite + React 19 SPA (react-router-dom 7, three 0.185) served by a Cloudflare Worker (`workers/app.js`, `wrangler.jsonc`) that also hosts a server-side `/api/*` layer. Read `CLAUDE.md` first and do what it asks (it keeps an Obsidian vault note). The plan behind this prompt is the portal page `/portal/dream-rooms-plan` (`src/components/portal/modules/dream-rooms-plan/`). This prompt is the spec.

## How to run this session

- **Unattended, start to finish.** James has left the PC and can't answer. Never stop to ask or wait for confirmation, and don't use plan mode. When something is unclear, make a sensible call, write it in `tools/dream-rooms/DECISIONS.md` (decision, why, how to change it), and keep going. When something truly needs James (creating the R2 bucket, setting secrets, his real dreams), prepare everything and put it on the checklist in your final message.
- **Git:** stay on the current branch (`git branch --show-current`, usually `main`). Don't create or switch branches or use worktrees; this applies to subagents too. Don't commit, push, deploy, or create Cloudflare resources. Everything must run locally (decision 10).
- **Other people's work:** the tree may hold someone else's uncommitted Memory Rooms work (`src/memory-rooms/`, `workers/memory-rooms.js`, `tools/memory-rooms/`, `supabase/memory_*.sql`). Don't touch, format, stage or revert it. The only shared files you edit are `src/App.jsx`, `workers/app.js`, `wrangler.jsonc`, `.dev.vars.example` and `.gitignore`, each with a small additive change. Add `dream-rooms-work/` to `.gitignore` before anything writes there.
- **Use subagents when they help.** Write the two contracts and the API shapes yourself first, because every part depends on them. Then run independent parts in parallel (the Blender kit, the capture page, the Worker API, the viewer), at most about 4 at once. Brief each fully: goal, files it owns, contracts, how to check its work. Use a fresh subagent as an unbiased reviewer of viewer frames: give it the pictures and the dream text, not your opinion.
- **Priority order:** (1) the framework, working end to end on the sample dream: capture → storage → skill + Blender → viewer → wake; (2) the feel: it must not read as a game level, a tidy model or the Backrooms again; (3) a minimal UI that's easy to change. James refines the UI later in conversation.

## What it is

James wakes up and types or dictates a dream on his phone at `/dreams/new`: rambling, fragmented, contradictory. Later he tells Claude Code "render my new dreams". A skill reads the text and writes down what the dream *was* (`dream.json`), then designs one way to build it (`world.json`). A headless Blender kit builds the spaces, bakes their light and exports a small GLB. The site lets him walk through it in first person: empty, too-quiet spaces, fog, light with no source, doors and dissolves that lead somewhere they shouldn't, things that change while he isn't looking, his own words written into the place. It ends by waking. Every dream is private in this build.

Dream Rooms is standalone. It copies patterns and small files from Memory Rooms but never imports from `src/memory-rooms/`, `workers/memory-rooms.js` or `tools/memory-rooms/`.

## Decisions already made (don't reopen them)

1. **Headless Blender builds and bakes; three.js only shows.** Run `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python <script> -- <args>` (path overridable by `BLENDER`). The Blender MCP needs the GUI open; never depend on it. Verified on this PC: a corridor segment with fluorescent panels built in 0.2 s, a 1280×800 Cycles still with volumetric haze rendered in 11 s at 256 samples (OptiX, RTX 5070 Ti), a 2048 px COMBINED bake took 20 s at 384 samples, and the unlit GLB with WebP was 57 KB. The proof script is `tools/dream-rooms-plan/blender/corridor.py`; read it before writing the kit. Enable the GPU in every script (OptiX, then CUDA, then CPU), use AgX with the "Base Contrast" look, and pass absolute output paths.
2. **Bake for the web, Memory Rooms style.** COMBINED light baked display-referred (through AgX), exported as `KHR_materials_unlit` (the emission + transparent + Light Path "Is Camera Ray" trick in `corridor.py`) with WebP textures. The viewer shows `MeshBasicMaterial` with `NoToneMapping`. Bake each mesh before joining when materials use Object coordinates. Faces point at the walker (the proof's first bake came out black because a wall faced out). Aim for about 100 texels per metre: a module whose surfaces need more than one 2048 px atlas splits into up to 4. Budget per dream: ≤ 6 MB GLB in total, ≤ 150 draw calls, ≤ 300 k triangles. Exactly one live material is allowed per dream: still water, as a cheap planar or cube-map reflection.
3. **Two contracts.** `dream.json` is the *interpretation*: what was in the dream, kept and versioned. `world.json` is *one build* of it. A better kit later rebuilds a dream from the same `dream.json`. Both are JSON Schemas in `src/dream-rooms/contracts/` with one hand-written validator (no Ajv: Workers forbid `new Function`) shared by the Worker, the viewer and the Node scripts. Blender trusts its input because Node validates first; there is no Python mirror. The samples in this prompt live in `src/dream-rooms/contracts/fixtures/` and `check-contracts.mjs` must accept them and reject a set of broken mutations.
4. **Strangeness is data, never cleaned up.** Every entity in `dream.json` has an `id` and a `quote` (his exact words; several allowed). `quote-spans.mjs` turns quotes into `src` character spans with `indexOf` and fails when a quote isn't in the text; Claude never counts characters. Every impossible place, impossible link, change, vague patch and contradiction must be covered by a `world.json` mechanism whose `for` array lists its id, or be listed in `world.json.dropped` with a reason. `check-world.mjs` fails otherwise.
5. **Impossible spaces are separate modules joined by teleports or dissolves.** Never build non-Euclidean geometry. Each module is built at its own spot in the GLB, 200 m from the next. Three link kinds: `walk` (a normal doorway), `teleport` (a doorway that arrives at another doorway with the same frame, keeping offset and facing) and `dissolve` (no door: fog thickens to a whiteout over about 3 s while you keep walking, the jump happens at the peak, and it clears somewhere else; use it for "then the corridor was the pool"). Every teleport doorway opens onto a baked 1.5 m stub that turns 90°, so the cut is never in view; the jump fires inside the stub. An endless corridor is copies of one baked segment plus a one-segment teleport, the segment baked "in context" (three built, the middle exported), which the plan page shows live. No stencil portals.
6. **Things change only while unseen.** A swap fires when its target has been outside a frustum 30 % wider than the camera's, or further than 15 m, for at least 1.5 s. Never animate a change on screen. Swaps are listed in `world.json.swaps` (`show`, `hide`, `move`, `retint`, `relabel`). Anything a swap hides is baked with the target excluded, so it leaves no shadow behind. Copies of a repeating module vary while unseen (a door ajar, one tube out, a sign's 14 drifting to 41), so the loop never feels like a perfect tile.
7. **The browser does what can't be baked:** `FogExp2` in the materials (volumes don't bake), one merged post pass, teleports, dissolves, swaps, the dream's words, audio, and the odd flickering tube. The post pass is ONE custom `ShaderPass` (soft focus toward the edges, glow from the same taps, radial chromatic aberration, faded grade, vignette, animated grain, sRGB encode). Start from a copy of `src/components/portal/modules/dream-rooms-plan/dreamPass.js`. Measured here at iPhone resolution (1170×2532): it adds 0.12 ms per frame on this GPU against 0.43 ms for three's stock `UnrealBloomPass` + `BokehPass` + `FilmPass` + `OutputPass` (2 full-screen draws against 16). No new post-processing dependency. Pixel ratio ≤ 1.5 on touch devices.
8. **A dream, not a game level.**
   - **On screen:** no HUD, crosshair, prompts or map. Black and sound for 2 s, then a slow fade in.
   - **Moving:** hold (mouse or finger) to drift forward and drag to look. Arrow keys work for accessibility, but there's no WASD and no pointer lock by default. Speed is about 0.9–1.3 m/s, set by `mood.intensity`, with eased starts and no head bob, no running, no jumping. The field of view stays near 62°.
   - **Light** has no visible source, or more glow than its source explains.
   - **Scale** is off by 10–25 % somewhere in every dream.
   - **Figures are absences**, never 3D people: a voice from a room you can't find, a silhouette that stays at fog distance, a coat on a chair.
   - **His words live in the place**, not as subtitles: on a door sign, a departure board, a wall, the water's surface. They're live text planes (canvas textures, fogged) that appear while unseen. Screen text is for the wake only.
   - **The dream ends by waking**: fade to white and one line of his own words.
9. **No default look.** Every finish, fixture and colour either cites words from the dream (`for`) or is marked `invented: true` and kept plain: untextured grey, fading into fog. Detail follows salience: things he named are crisp, everything else is lower resolution and swallowed by fog. Drop ceilings, fluorescent panels, striped wallpaper and olive fog are only allowed when the dream calls for them (the sample does: "a hum … like the lights"). Otherwise the rubric fails them.
10. **Local first, one store.** Rows are JSON objects in the R2 bucket (`rows/dreams/<id>.json`), in production too: James will have dozens of dreams, not millions, so no Supabase table is needed. `wrangler dev` simulates R2, so the whole loop runs on this PC with no setup. If a later phase moves rows to Supabase, the table gets row level security on with no policies (the `memory_*.sql` pattern), because the SPA ships the anon key.
11. **Private only in this build.** The JS bundle is public, so privacy lives only in the Worker. The row has `visibility` (`private`, `unlisted`, `public`), but this build only implements `private`: every dream route needs the password, and unauthenticated requests for any dream id, real or not, get the same 404. Sharing (unlisted links and public dreams, with an allow-list that also strips `world` of every `for`, `dropped` reason and unshared word) is phase 2. Signed file URLs last at most 1 hour and are keyed to `^dreams/<uuid>/`. Responses carry `cache-control: private, no-store` and `x-robots-tag: noindex, nofollow`.
12. **Its own password.** The Worker accepts `DREAMS_PASSWORD` or `PORTAL_PASSWORD`, compares SHA-256 digests in constant time, and fails closed with 503 if neither is set. `MEMORIES_PASSWORD` must not open dreams, because Justin has it. A wrong password waits 600 ms before answering, or use the Workers rate-limiting binding if it's configured.
13. **Capture is a textarea.** A big, dark, already-focused textarea; iOS keyboard dictation works in it with no code. Don't use the Web Speech API (unreliable on iOS, worse from the home screen). Every keystroke autosaves to IndexedDB; Save moves the draft into an offline outbox that uploads when there's signal. The phone's copy is deleted once the upload is confirmed.
14. **Dream words stay out of logs.** The skill must never copy dream text, titles, quotes or motifs into the vault, memory, `DECISIONS.md`, commit messages or console output. Vault notes about a render say "dream <id> rendered", nothing more. The sample dream is fictional and is the only one these docs may quote.
15. **Portable layout.** Front end in `src/dream-rooms/` (no imports from `src/components/portal/` or `src/memory-rooms/`), Worker code in `workers/dream-rooms.js` (mounted from `workers/app.js` under `/api/dreams/`), scripts in `tools/dream-rooms/`, the Blender kit in `tools/dream-rooms/blender/`, the skill in `.claude/skills/dream-render/`, work folders in `dream-rooms-work/<id>/` (gitignored). R2 bucket `dream-rooms`, binding `DREAMS`.

## Routes

Add to `src/App.jsx`, lazy-loaded with Suspense like `/memories`, through one helper so the app is a single chunk. Every page sets `<meta name="robots" content="noindex, nofollow">`, and the password gate covers them all.

- `/dreams`: the archive, newest first. Each row shows the night's date, a title (Claude's, or the first words before it's read), a status dot and "Walk" once rendered.
- `/dreams/new`: capture, phone first, dark. Add a `manifest` link so "Add to Home Screen" opens it.
- `/dreams/:id`: the dream.
  - **captured / reading / building:** his text and a status dot ("waiting to be read", "being built").
  - **failed:** the text and the reason.
  - **rendered:** a still and an "Enter" tap (the tap unlocks audio on iOS), then the walk.

## Capture flow (6 am, half awake)

One screen. Nothing to decide before the words are down.

1. Open → a dark page with one textarea filling the screen and the hint "Tap, then the mic on your keyboard. Just talk." Near-black background, warm grey text, no white anywhere.
2. Type or dictate. Autosave on every input (IndexedDB, survives the tab being killed), shown as a small dot.
3. **Save dream**, one big button at the thumb. It stamps `dreamt_on` (before 2 pm: the previous night's date) and moves the dream to the outbox.

Editing: the text stays editable until the dream is read. After that `raw_text` is frozen, and later additions go to `extra_text` ("Remembered more"), which the next read takes in.

The outbox follows Memory Rooms (`src/memory-rooms/lib/outbox.js`, `idb.js`): client UUIDs so a retry can't duplicate, backoff 5 s → 5 min, triggers on `online`, visibility and app load, a 401 pauses it and shows the gate. Copy and trim it; don't import it.

## Data

A dream row (`rows/dreams/<id>.json`): `id` (client uuid), `created_at`, `updated_at`, `dreamt_on`, `raw_text`, `extra_text`, `visibility` (`private` in this build), `status` (`captured | reading | building | rendered | failed`), `status_at`, `fail_reason`, `title`, `dream` (dream.json), `dream_version`, `world` (world.json), `world_version`, `model_key` (the current GLB), `motifs`, `deleted_at`.

Files in R2: `dreams/<id>/model/world-v<N>.glb` (versioned; the previous one is kept, so a re-render never breaks the live dream), `…/stills/<name>.webp`. A dream's files are listed from R2, with no separate media table.

Worker API (`workers/dream-rooms.js`, everything bearer-gated):

- `GET /api/dreams/ping` lists `features`, so scripts refuse to upload what an older Worker can't take.
- `GET /api/dreams` and `GET /api/dreams/:id`.
- `POST /api/dreams`: client uuid, create-once.
- `PATCH /api/dreams/:id`: contracts validated, versions bumped, `ifUpdatedAt` → 409, `raw_text` refused once read.
- `PUT /api/dreams/:id/file/<path>`: raw body.
- `DELETE /api/dreams/:id` soft-deletes. `?purge=1` removes the row, every file and the work folder hint, for good.
- `GET /api/dreams/file/<r2_key>?t=<exp>.<sig>`: HMAC-SHA256 with `DREAMS_SIGNING_KEY`, or a key derived from the passwords; ≤ 1 h; constant-time compare.

Add `r2_buckets` (binding `DREAMS`, bucket `dream-rooms`) to `wrangler.jsonc`, and `DREAMS_PASSWORD` and `DREAMS_SIGNING_KEY` to `.dev.vars.example`.

## dream.json v1 (the interpretation — write it first)

Ids are short and typed (`p1` place, `l1` link, `f1` figure, `o1` object, `c1` change, `v1` vague, `s1` sound, `time`). `quote` holds his exact words; `src` is filled in by `quote-spans.mjs`. Certainty is 0–1. When the dream says two things, both are kept. The sample is the plan page's sample dream (trimmed):

```json
{ "version": 1, "title": "The gate I couldn't find",
  "mood": { "felt": ["searching", "uneasy"], "intensity": 0.6, "valence": -0.2, "quote": ["more like I'd forgotten something really important"] },
  "time": { "id": "time", "said": ["late afternoon", "dark outside"], "contradiction": true, "quote": ["it was late afternoon but also dark outside the windows somehow"] },
  "places": [
    { "id": "p1", "is": ["school", "Perth airport hall"], "archetype": "hall", "certainty": 0.8, "scale": 1.3,
      "features": ["year 9 lockers along the walls", "green school carpet", "everyone already gone"],
      "quote": ["I was back at school but it was also the airport", "the year 9 lockers all along the walls", "that green school carpet"] },
    { "id": "p2", "is": ["corridor"], "archetype": "corridor", "endless": true, "features": ["every door numbered 14"],
      "quote": ["it just kept going", "every door had the same number, 14"] },
    { "id": "p3", "is": ["indoor pool from swimming lessons"], "archetype": "pool", "features": ["water completely still"],
      "rule": "not allowed in", "quote": ["the indoor pool from swimming lessons", "I knew I wasn't allowed in"] } ],
  "links": [
    { "id": "l1", "from": "p2", "to": "p2", "via": "door", "impossible": "loops-back", "quote": ["when I went through one I was back at the start of the same corridor"] },
    { "id": "l2", "from": "p2", "to": "p3", "via": "became", "impossible": "transforms", "quote": ["then the corridor was the indoor pool"] } ],
  "figures": [ { "id": "f1", "who": "mum, or someone who was mum", "certainty": 0.5, "presence": "always-far", "at": "p2",
      "quote": ["or someone who was mum", "but I never got any closer"] } ],
  "objects": [ { "id": "o1", "what": "year 9 lockers", "at": "p1", "salience": 0.7, "quote": ["the year 9 lockers"] } ],
  "changes": [ { "id": "c1", "target": "o1", "to": "gone", "trigger": "look-away", "quote": ["when I turned around the lockers were gone"] } ],
  "vague": [ { "id": "v1", "what": "the ending", "quote": ["can't remember the end"] },
             { "id": "v2", "what": "where the flight went", "quote": ["I didn't know where to"] } ],
  "sound": [ { "id": "s1", "what": "a hum like the lights", "quote": ["a hum the whole time like the lights"] } ],
  "fragments": [ { "text": "every door had the same number, 14", "at": "p2" }, { "text": "I think I just stood there", "at": "wake" } ],
  "motifs": ["school", "airport", "corridor", "pool", "mum", "missed-flight", "lockers"] }
```

Enums: `archetype` is a kit module or `other`; `presence` is `glimpse | voice-only | always-far | felt`; `impossible` is `loops-back | wrong-place | bigger-inside | transforms | two-at-once | none`; `trigger` is `look-away | return | approach | time`.

## world.json v1 (one build — the kit's input and the viewer's runtime)

Units are metres, y up in the viewer; Blender is z up, converted once in one function. Each module sits at its own `origin`, 200 m from the next. Every mechanism has `for`, an array of dream ids. Things Claude adds that the dream didn't ask for carry `invented: true`.

```json
{ "version": 1, "dream_version": 1,
  "look": { "light": "late-afternoon", "windows": "dark", "warmth": 0.3, "fog": { "color": "#a59b80", "density": 0.085 }, "for": ["time"] },
  "sound": { "bed": "hum-100", "reverb": "too-big", "for": ["s1"] },
  "modules": [
    { "id": "hall", "kit": "hall", "origin": [0, 0, 0], "size": [24, 5.2, 16], "scale": 1.3,
      "finishes": { "floor": { "is": "carpet", "color": "#4f6b4a", "for": ["p1"] }, "walls": { "is": "plain", "invented": true } },
      "props": [ { "id": "lockers", "kit": "locker-bank", "wall": "n", "for": ["o1"] },
                 { "id": "board", "kit": "board", "wall": "e", "text": "", "for": ["p1", "v2"] } ],
      "for": ["p1"] },
    { "id": "corridor", "kit": "corridor", "origin": [200, 0, 0], "size": [2.2, 2.6, 8], "repeat": true,
      "doors": { "count": 3, "sign": "14" }, "ceiling": "drop-tiles", "lights": "panels", "for": ["p2", "s1"] },
    { "id": "pool", "kit": "pool", "origin": [400, 0, 0], "size": [12, 4, 25], "walkable": "edge-only", "for": ["p3"] } ],
  "doorways": [ { "id": "d1", "module": "hall", "wall": "e", "at": 8 }, { "id": "d2", "module": "corridor", "wall": "s", "at": 1.1 } ],
  "links": [
    { "kind": "teleport", "a": "d1", "b": "d2", "for": [] },
    { "kind": "teleport", "a": "corridor:end", "b": "corridor:start", "for": ["l1"] },
    { "kind": "dissolve", "from": "corridor", "after": 3, "to": "pool", "for": ["l2"] } ],
  "swaps": [
    { "target": "hall/lockers", "action": "hide", "when": "unseen", "after": "visited:corridor", "for": ["c1"] },
    { "target": "corridor/doors.sign", "action": "relabel", "to": "41", "when": "unseen", "for": ["p2"] } ],
  "figures": [ { "as": "silhouette", "module": "corridor", "keep": "fog-distance", "for": ["f1"] } ],
  "words": [ { "text": "every door had the same number, 14", "on": "corridor/doors.sign", "for": ["p2"] } ],
  "route": ["hall", "corridor", "pool"], "spawn": { "module": "hall", "at": [3, 0, 8], "facing": "e" },
  "wake": { "after": "pool", "line": "I think I just stood there.", "for": ["v1"] },
  "dropped": [] }
```

**Kit v1** (`tools/dream-rooms/blender/kit/`, one Python module per piece, sized by `size` = [w, h, d], all with standard doorways 1.0 × 2.1 m and 1.5 m bent stubs behind teleport doorways):

- **Modules:** `corridor` (tileable, doors per side), `room`, `hall` (big, columns) and `pool` (water as the one live material), plus `bespoke` (a function in `dream-rooms-work/<id>/bespoke/<name>.py` that builds inside its declared box).
- **Props:** `door`, `locker-bank`, `sign`, `board`, `light-panel`, `window-dark`, `chair`, `coat`.
- **Finishes:** procedural, tinted, and only used when cited: `carpet`, `tile`, `terrazzo`, `painted-block`, `wallpaper`, `timber`, `linoleum`, `water`, `plain`.

Default proportions are slightly off on purpose; `scale` pushes them further. Stair, outdoor and imported GLBs are phase 2.

## The render workflow (the framework — the most important part)

Write `.claude/skills/dream-render/SKILL.md` for "render my new dreams", "render dream X" and "re-read dream X". Its scripts live in `tools/dream-rooms/` (Node for the API, Python inside Blender for 3D) and read `DREAMS_API` and `DREAMS_PASSWORD` from the environment or the dev vars. The skill states decision 14 at the top.

1. `pull.mjs <id|--next>` writes `dream-rooms-work/<id>/` with `raw.txt` and `row.json`, and sets status `reading`. A dream stuck in `reading` or `building` for over 2 hours counts as stale; `pull --reset <id>` puts it back to `captured`.
2. Claude reads the text (plus `extra_text`) and writes `reading.md`: each place, figure, object, feeling, contradiction, vague patch and change, with his exact words. Then `dream.json`, with quotes and no spans.
3. `quote-spans.mjs` fills `src`. `check-dream.mjs` checks the schema, that every quote is found, that every reference resolves, and that motifs are lower-case and hyphenated.
4. **Fit check.** If more than half the dream's entities would be dropped (a dream that's mostly people, or flying, or two lines long), don't build an empty box: set `world.fallback = "still"`. Render one or two Cycles stills plus his words and the sound, which the viewer shows instead of a walk.
5. Claude designs `world.json`. `check-world.mjs` checks:
   - the schema;
   - the size and atlas budgets;
   - that the route is walkable from spawn through every module via links;
   - that doorways sit inside their walls;
   - the **strangeness check**: every two-place `is`, every `impossible` link, every change, every vague patch and `time.contradiction` is covered by some `for` or listed in `dropped` with a reason;
   - the **no-default-look check**: every finish, fixture and light is cited or `invented`.
6. `build.mjs <id> --draft` runs `blender/build_world.py` and a quick bake (512 px atlases, 32 samples), then opens the real viewer headlessly with `?autopilot=1`. It saves a frame per module plus the dissolve and the wake to `frames/`, and sets status `building`.
7. **Review, at most 2 rounds.** Claude reads the frames beside `raw.txt` and scores them against `tools/dream-rooms/RUBRIC.md`:
   - Is the light sourceless?
   - Is anything tidy, generic or game-like?
   - Are his details there, and crisp?
   - Is the scale off?
   - Is it empty?
   - Is there a Backrooms default he didn't ask for?

   Fix the 3 worst problems in `world.json` or the bespoke scripts, and note what's still off in `reading.md`.
8. `bake.mjs` runs the full bake (`blender/bake_export.py`): modules baked in context, swap targets excluded from their surroundings' bake, then `world-v<N>.glb` (≤ 6 MB) and a still per module for the dream page.
9. `push.mjs` uploads the files, saves both contracts, points `model_key` at the new GLB and sets status `rendered`. On any failure it sets `failed` with a one-line reason.

Document it in `tools/dream-rooms/README.md`. Target: under 30 minutes per dream.

## The viewer

Plain three.js (no `@react-three/*` in `src/dream-rooms/`) with a thin React wrapper that owns the renderer, resize and disposal. One WebGL context, reused; dispose everything on leave; handle `webglcontextlost`.

- Load the GLB, set materials to `MeshBasicMaterial`, and add `FogExp2` from `world.look.fog`.
- **Collision: one walk grid per module.** Port the idea from `src/memory-rooms/walk/grid.js`: triangles 0.15–1.7 m above the floor block 5 cm cells. Flood-fill from each of that module's doorways and spawn, including the stubs. Build a module's grid when it's first entered and keep at most two in memory.
- **Links, swaps and figures:** teleports fire inside stubs, and dissolves whiten the fog, jump, and clear. Swaps follow the unseen rule, figures stay at fog distance, words appear on their surfaces while unseen, and the wake comes at the end of the route.
- **Audio** starts on the Enter tap:
  - a procedural hum (100 Hz family, weighted to 200–400 Hz for phone speakers);
  - pink-noise room tone;
  - a `ConvolverNode` with a generated impulse, sized by `world.sound.reverb`.

  Set `navigator.audioSession.type = 'playback'` where it exists, so the silent switch doesn't mute it.
- **Query flags:**
  - `?still=1` shows the stills and words only, for weak devices and the fallback.
  - `?autopilot=1` follows `route` link by link to the wake and exposes `window.__dream = { state, module, fps }` for scripts.

## Self-test (do this, since James isn't here)

Use the plan page's sample dream (`content.js`, `SAMPLE_DREAM`) as `tools/dream-rooms/samples/sample-dream.txt`, with `samples/must-keep.json` listing what has to survive:
- school and airport at once;
- the door back to the same corridor;
- the endless corridor;
- "Mum, or someone who was Mum", kept uncertain and far;
- late afternoon and dark at once;
- the lockers gone when he turns round;
- the corridor becoming the pool;
- the pool he isn't allowed into;
- the forgotten ending.

1. Capture it through the real UI, driven headlessly with puppeteer-core and local Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, `--use-angle=d3d11`), against `npm run build && npx wrangler dev --port 8796`. Port 8787 belongs to another project; restart wrangler after each rebuild because it serves stale assets.
2. Run the skill on it end to end, then walk it with `?autopilot=1` from spawn to the wake, with zero console errors. The frame rate measured here is a smoke test, not a phone number.
3. Check every `must-keep` item maps to a mechanism.
4. Write three adversarial samples (a dream that's mostly an argument with a friend, a flying dream, a two-line dream). Run them through `check-dream` and `check-world` only, and confirm the fit check sends at least one to the still fallback.
5. Have a fresh subagent look at the autopilot frames with the dream text and answer: "does this feel like a dream, a game level, or the Backrooms, and why?" Fix the worst three things it names.

## Done means

- `npm run build` passes and `npx eslint src/dream-rooms workers/dream-rooms.js tools/dream-rooms` is clean.
- `check-contracts.mjs`, `api-check.mjs` and `page-check.mjs` all pass:
  - `api-check`: every dream route 404s without the password; a wrong password is slow; signed URLs expire; `raw_text` is frozen after read; a purge leaves nothing in R2.
  - `page-check`: capture at 390 px; the archive; the dream page in every status; entering, walking and waking; zero console errors; screenshots at 1440 and 390.
- The self-test has run end to end, with its results in your final message.
- Your final message tells James how to capture his first real dream on his phone and render it. It lists every decision in `DECISIONS.md`, and what he must do before deploying: create the R2 bucket, set `DREAMS_PASSWORD`, deploy from a clean worktree of committed main.
- The vault note and memory entry are written, per `CLAUDE.md` and decision 14.

## The interface

- Quiet and dark-leaning: the dream is the hero. One typeface pair, hairline rules, mono uppercase micro-labels, status as a small labelled dot. No coloured rounded callout boxes with a left border, no alert banners, no filled pills, no emoji.
- Capture is phone first; the archive and dream page are desktop first but work at 390 px.
- One scoped stylesheet (`.dr-` prefix) with tokens on the `.dr` root, UI copy in one file, layout separate from logic.

## Out of scope for this build

Sharing (unlisted and public), the dream postcard, the "how did it feel" step, voice recording + Whisper, the archive map, linking recurring places across dreams, stair and outdoor modules, AR, VHS and painterly modes, multiplayer, Supabase, and deploying. Keep them possible: `visibility` and `motifs` are already on the row, the stills feed the postcard, and the API is the seam a future MCP would wrap.
