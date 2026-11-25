# Dream Rooms · contracts

Every part of Dream Rooms (the Worker, the Node scripts, the Blender kit and the viewer) agrees on what's in this file. The spec is `src/components/portal/modules/dream-rooms-plan/build-prompt.md` plus `Documents/dream-rooms/prompt-dumping/build-dreams-framework.md` (the second wins where they disagree). Calls made during the build are in `tools/dream-rooms/DECISIONS.md`.

**Privacy (decision 14):** dream words (text, titles, quotes, motifs) never go into the vault, memory, `DECISIONS.md`, commit messages or console output. Scripts print ids, counts and statuses only. The fictional sample dream (`tools/dream-rooms/samples/sample-dream.txt`) is the only one docs may quote.

Contents:
1. The row
2. The Worker API
3. `dream.json` v1
4. `world.json` v1
5. Geometry: modules, walls, doorways, Z-stubs, teleports
6. The GLB contract (Blender → viewer)
7. The corridor kit and the corridor world
8. The viewer's surface: `<DreamStage>`, query flags, debug hooks
9. Work folders and files

---

## 1. The row

R2 object `rows/dreams/<id>.json` (bucket `dream-rooms`, binding `DREAMS`):

| field | type | notes |
| --- | --- | --- |
| `id` | uuid | client-made (capture) or Worker-made (split) |
| `created_at`, `updated_at` | ISO string | Worker-set |
| `dreamt_on` | `YYYY-MM-DD` | the night. Capture stamps it: before 2 pm local = yesterday's date |
| `night_order` | int ≥ 1 | the order he dreamt them that night. Each night is kept 1..n with no gaps |
| `raw_text` | string ≤ 20 000 | his words. Frozen once `status` leaves `captured` |
| `extra_text` | string ≤ 20 000 | "Remembered more", added after the read; the next read takes it in |
| `own` | `[start, end]` or null | this row's own slice of `raw_text` once something was split off it; null = all of it |
| `split_from` | uuid or null | the row this one was split out of |
| `split_into` | uuid[] | rows split out of this one (in order) |
| `visibility` | `private` | only `private` in this build |
| `status` | `captured \| reading \| building \| rendered \| failed` | |
| `status_at` | ISO string | when `status` last changed. `reading`/`building` older than 2 h = stale |
| `fail_reason` | string or null | one line, no dream words |
| `title` | string or null | Claude's title, set with the read |
| `dream`, `dream_version` | dream.json or null, int | version bumps on every change of `dream` |
| `world`, `world_version` | world.json or null, int | version bumps on every change of `world` |
| `model_key` | R2 key or null | the live GLB, `dreams/<id>/model/world-v<N>.glb` |
| `still_key` | R2 key or null | the hero still, `dreams/<id>/stills/<name>.webp` |
| `motifs` | string[] | lower-case-hyphenated, copied from dream.json |
| `deleted_at` | ISO string or null | soft delete |

The text a read works from is `ownText(row)` = `raw_text.slice(own[0], own[1])` (or all of it), plus `"\n\n" + extra_text` when there is any. Quotes and spans in `dream.json` index into exactly that string. `src/dream-rooms/contracts/rowText.js` has the one implementation.

**Archive order:** `dreamt_on` ascending, then `night_order` ascending (the API returns this order; the corridor reverses nights so the newest is nearest the entrance).

## 2. The Worker API (`workers/dream-rooms.js`, mounted at `/api/dreams/`)

Every response carries `cache-control: private, no-store` and `x-robots-tag: noindex, nofollow`. JSON bodies are `{ data }` or `{ error, details? }`.

**Auth.** `Authorization: Bearer <DREAMS_PASSWORD or PORTAL_PASSWORD>`, compared as SHA-256 digests in constant time. `MEMORIES_PASSWORD` never opens dreams. Neither secret set → `503` (fail closed). No bearer, or a wrong one, on ANY route (including `ping`, the list, any id real or not, a bad file token) → the same `404 {"error":"Not found"}`. A wrong (non-empty) password waits 600 ms first.

| route | does |
| --- | --- |
| `GET /api/dreams/ping` | `{ data: { ok: true, store: 'r2', features: [...] } }`. features: `nights`, `split`, `draft`, `purge`, `corridor`. Scripts refuse to upload what's not listed. |
| `GET /api/dreams` | the lean list for the corridor: `[{ id, dreamt_on, night_order, status, title, first_words, still_key, split_from }]`, sorted by `dreamt_on` then `night_order`, deleted rows left out. `first_words` = the first 6 words of `ownText` (+ `…` if longer). |
| `GET /api/dreams/:id` | the whole row plus `files: { model_url, still_url, stills: [{ name, url }], draft: { world_url, model_url } \| null }` (signed URLs, ≤ 1 h). |
| `POST /api/dreams` | create once by client uuid: `{ id, dreamt_on, night_order?, raw_text, created_at? }`. Sending the same id again returns the stored row unchanged (200). Status starts `captured`. The night is renumbered (see below). |
| `PATCH /api/dreams/:id` | any of: `ifUpdatedAt`, `raw_text`, `extra_text`, `dreamt_on`, `night_order`, `status`, `fail_reason`, `title`, `dream`, `world`, `model_key`, `still_key`, `motifs`, `own`. `ifUpdatedAt` ≠ stored `updated_at` → 409. `raw_text` when status ≠ `captured` → 409 `raw_text is frozen`. `dream`/`world` are validated with `src/dream-rooms/contracts/validate.js` (400 with `details`), and bump their version. `night_order` may change at any status. |
| `POST /api/dreams/:id/split` | `{ at: "<exact words that start the second dream>" }`. The phrase must occur exactly once in the row's own slice (`indexOf`, and no second hit) or 400. Creates a new row (Worker uuid): `raw_text` = the slice from the phrase to the end of the own slice, `split_from` = this id, same `dreamt_on`, `night_order` = this row's + 1 (later rows that night shift along), status `captured`. This row keeps its full `raw_text` untouched; its `own` becomes `[ownStart, cut]` and the new id is appended to `split_into`. Returns `{ data: { parent, child } }`. Allowed while `captured` or `reading`. |
| `PUT /api/dreams/:id/file/<path>` | raw body into R2 at `dreams/<id>/<path>`. Paths: `model/world-v<N>.glb` (≤ 12 MB), `stills/<name>.webp\|jpg\|png` (≤ 4 MB), `draft/world.glb` (≤ 12 MB), `draft/world.json` (≤ 1 MB, validated), `draft/stills/<name>.webp` (≤ 4 MB). |
| `DELETE /api/dreams/:id/file/draft` | removes every `dreams/<id>/draft/*` object. |
| `DELETE /api/dreams/:id` | soft delete (`deleted_at`); its night is renumbered without it. `?purge=1` deletes the row and every `dreams/<id>/*` object for good and answers `{ data: { purged: true, work: 'dream-rooms-work/<id>/' } }` (the script deletes that local folder). |
| `GET /api/dreams/file/<r2_key>?t=<exp>.<sig>` | the file. `r2_key` must match `^dreams/<uuid>/[a-z0-9/_.-]+$`. `sig` = base64url HMAC-SHA256 of `<r2_key>.<exp>` with `DREAMS_SIGNING_KEY` (or a key derived from the two passwords). `exp` ≤ now + 3600 s. Bad or expired → 404. A bearer also works instead of `t`. |

**Night renumbering.** After any create, `dreamt_on` change, `night_order` change, split or delete, every live row of each affected night is sorted by (`night_order`, then `created_at`) and given 1..n. A `PATCH night_order: k` first moves that row to position k (clamped to 1..n), then renumbers. A `PATCH dreamt_on` moves the row to the end of its new night.

## 3. `dream.json` v1: the interpretation

Schema: `src/dream-rooms/contracts/dream.schema.json`. Example: `contracts/fixtures/sample.dream.json`. Ids are short and typed: `p1` place, `l1` link, `f1` figure, `o1` object, `c1` change, `v1` vague, `s1` sound, and `time`. Every entity has `quote` (his exact words; several allowed). `src` (spans, `[[start, end], ...]` parallel to `quote`) is filled by `tools/dream-rooms/quote-spans.mjs` with `indexOf`; Claude never counts characters. Certainty is 0–1. When the dream says two things, both are kept.

Places may carry an optional free-text `real` ("my old house on Fletcher St"): stored, never looked up.

Enums: `archetype` = `corridor | room | hall | pool | other`; `presence` = `glimpse | voice-only | always-far | felt`; `impossible` = `loops-back | wrong-place | bigger-inside | transforms | two-at-once | none`; `trigger` = `look-away | return | approach | time`.

Checks (`checkDream(dream, text)` in `validate.js`, run by `check-dream.mjs`): the schema; ids unique; every quote found in the text; when `src` is present it matches its quote exactly; every reference resolves (`links.from/to`, `figures.at`, `objects.at` → place ids; `changes.target` → any entity id; `fragments.at` → a place id or `wake`); `fragments[].text` found in the text; motifs lower-case-hyphenated.

**Strangeness ids** (each must be covered by a world mechanism's `for`, or listed in `world.dropped` with a reason): every place with 2+ `is`, every link whose `impossible` isn't `none`, every change, every vague patch, and `time` when `time.contradiction` is true.

## 4. `world.json` v1: one build

Schema: `src/dream-rooms/contracts/world.schema.json`. Example: `contracts/fixtures/sample.world.json`. Units are metres, y up (viewer coordinates). `kind` is `dream` (default) or `corridor` (§7, made at runtime, never stored).

- `look`: `light`, `windows`, `warmth` 0–1, `fog { color, density }`, `for`.
- `sound`: `bed` (`hum-100 | room-tone | water | wind | none`), `reverb` (`dry | room | big | too-big`), `for`.
- `modules[]`: `{ id, kit, origin [x,y,z], size [w,h,d], scale?, repeat?, walkable?, finishes?, ceiling?, lights?, doors?, props?, bespoke?, for | invented+why }`.
  - `kit` = `room | hall | corridor | pool | bespoke`. `bespoke` names a script in `dream-rooms-work/<id>/bespoke/<bespoke>.py`.
  - `origin` is the module's min corner (x min, floor, z min). Modules sit ≥ 200 m apart (the kit puts module i at `[200·i, 0, 0]`).
  - `size` is the inside as built. `scale` (0.6–1.6, default 1) multiplies the props and fixtures inside it: the "scale is off" knob.
  - `repeat: true` (kit `corridor` only): one baked segment of depth `d`, open at n and s, copied end to end by the viewer: an endless corridor. Its doorways go on `e`/`w` walls only.
  - `walkable`: `all` (default) or `edge-only` (a pool: only a 1.6 m band round the edge is walkable).
  - `finishes.{floor,walls,ceiling,water}` = `{ is, color?, for | invented+why }`; `is` ∈ `carpet | tile | terrazzo | painted-block | wallpaper | timber | linoleum | water | plain`. An invented finish must be `plain`.
  - `ceiling` = `{ is: drop-tiles | plain | none | high-dark, for | invented+why }`; `lights` = `{ is: panels | glow | windows | none, for | invented+why }`. An invented `lights` must be `glow` (sourceless). `drop-tiles`, `panels` and `wallpaper` need a non-empty `for` (decision 9).
  - `doors` (corridor kit): `{ count, sign?, sides?: both|e|w, for }`: shut, numbered doors along the walls (decoration; real openings are `doorways`).
  - `props[]`: `{ id, kit, wall?, at?, pos?, length?, count?, text?, color?, rotY?, for | invented+why }`; `kit` ∈ `door | locker-bank | sign | board | light-panel | window-dark | chair | coat`. `wall` + `at` (metres along the wall, see §5) or `pos` [x,y,z] in module-local metres.
- `doorways[]`: `{ id, module, wall, at, for | invented+why }`. A standard opening 1.0 × 2.1 m with a Z-stub behind it (§5).
- `links[]`:
  - `{ kind: 'walk' | 'teleport', a, b, oneway?, for | invented+why }`: doorway to doorway, both ways unless `oneway` (then only a → b). Both kinds work the same way (stub to stub, §5); `walk` means "the door goes where you'd expect" and `teleport` means it doesn't. A doorway is the departure end of at most one link, but several one-way links may arrive at the same doorway (every door 14 leads back to the start).
  - `{ kind: 'dissolve', from, to, after, at?, facing?, for }`: no door. After `after` seconds of moving in `from`, the fog whitens over 3 s while you keep walking, the jump happens at the peak, and it clears in `to` at `at` (module-local [x,y,z]; default: `to`'s centre, or spawn if `to` is the spawn module) facing `facing`.
  - `{ kind: 'enter', door, dream }`: corridor worlds only.
- `swaps[]`: `{ target, action, to?, when: 'unseen', after?, revert?, for }`.
  - `target` = `<module>/<propId>` or `<module>/doors-sign` (every numbered door's sign) or `<module>/tube` (a fixture panel).
  - `action` = `show | hide | move | retint | relabel`; `to` = text (relabel), `#rrggbb` (retint) or [x,y,z] module-local (move).
  - `after` (optional precondition) = `visited:<module>` or `time:<seconds in the target's module>`.
  - It fires only when the target has been unseen (outside a frustum 30 % wider than the camera's, or > 15 m away) for ≥ 1.5 s. `show` targets start hidden.
- `figures[]`: `{ as: silhouette | voice | coat | chair-coat, module, keep: fog-distance | other-room, for }`. Absences, never 3D people.
- `words[]`: `{ text, on, for }`. `on` = `<module>/<propId>` (a sign or a board), `<module>/doors-sign`, `<module>/wall-<n|s|e|w>`, `<module>/water` or `<module>/floor`. Text must be his words (it's checked against the text). Drawn live as canvas text planes, fogged, painted while unseen.
- `route[]`: module ids in walking order. `spawn { module, at [x,y,z] module-local, facing n|s|e|w }`.
- `wake { after, delay?, line, for }`: `delay` (s of moving in `after`, default 14) then fade to white and `line` (his words).
- `dropped[]`: `{ id, reason }`: dream ids deliberately not built, with why.
- `fallback`: `"still"` → no walk: the viewer shows `stills` + `words` + `sound`, then the wake line. Set by the fit check (more than half the entities would be dropped).
- `stills[]` (optional): `{ name, module, at [x,y,z], facing, pitch? }`: camera hints for the Cycles stills. Default: one per module from its entry.

**Every mechanism** (module, finish, ceiling, lights, prop, doors, doorway, link, swap, figure, word, wake) has a non-empty `for` OR `invented: true` plus a `why` ("joins p1 to p2", "floor for p3"). Invented things are connective tissue only (a joining passage, a floor, a wall, a doorway the route needs) and stay plain (grey, fogged, no detail).

Checks (`checkWorld(world, dream, text)` in `validate.js`, run by `check-world.mjs`): the schema; unique ids; references resolve; modules ≥ 200 m apart and within 1.5–60 m per side; doorways inside their walls (≥ 0.3 m from each corner, module ≥ 2.4 m tall) and never on n/s of a repeat module; every doorway in at most one link; the route is reachable from `spawn.module` through links and each consecutive pair is directly linked; spawn inside its module; the budget estimate (≤ 4 atlases per module, estimated GLB ≤ 6 MB); every `for` id exists in dream.json; `invented` ⇒ `why`; invented finishes `plain`, invented lights `glow`; `drop-tiles`/`panels`/`wallpaper` cited; words found in the text; the **strangeness check**; and the scale warning (no module or prop off by ≥ 10 % → warning).

## 5. Geometry (`contracts/layout.js`; Python mirror in `tools/dream-rooms/blender/common.py`)

Numbers live in `contracts/dims.json`.

**Module-local frame:** x across (0..w), y up (0..h), z (0..d). North is −z: the `n` wall is z = 0, `s` is z = d, `w` is x = 0, `e` is x = w. World position = `origin + local`.

| wall | plane | inward normal | `at` runs along | from |
| --- | --- | --- | --- | --- |
| n | z = 0 | +z | +x | x = 0 |
| s | z = d | −z | +x | x = 0 |
| w | x = 0 | +x | +z | z = 0 |
| e | x = w | −x | +z | z = 0 |

`facing` → yaw (three.js, rotation about +y, 0 looks along −z): n = 0, w = +π/2, s = π, e = −π/2.

**Doorway frame:** centre `c` = the opening's centre on the wall plane at floor height; `inward` = the wall's inward normal; `out` = −inward. Opening `door.w` wide × `door.h` tall.

**Z-stub** (behind every doorway, outside the module): a passage `stub.width` wide and `stub.height` tall.
- `side` = left of `out` = `(out.z, 0, −out.x)`.
- leg 1 from `c` to `b1 = c + out·leg1`;
- leg 2 from `b1` to `b2 = b1 + side·leg2`;
- leg 3 from `b2` to `b3 = b2 + out·leg3`, a dead end;
- **jump point** `m = b1 + side·leg2/2`; jump plane through `m`, normal `side`.

Walls close the passage; the floor and ceiling continue. A stub is lit only by what spills in from its doorway (plus a faint sourceless fill). From `m`, neither the doorway nor the dead end is in view.

**Teleport** across a link (a ↔ b): when the walker in a's leg 2 crosses a's jump plane moving along `side_a`, they are moved by the rigid map that takes `m_a → m_b`, `side_a → −side_b` and `out_a → −out_b` (a rotation about y by `δ = yaw(−out_b) − yaw(out_a)`): `p' = m_b + R(p − m_a)`, `yaw' = yaw + δ`. They arrive in b's leg 2 walking towards b's doorway. The same in reverse. The Z is 180° symmetric, so the view at the jump is identical. In a repeat module, every copy has the opening and its stub.

## 6. The GLB contract (Blender → viewer)

One GLB per dream build: `world-v<N>.glb` (or `draft/world.glb`). y-up, metres, every module built at its world origin. Materials are unlit (`KHR_materials_unlit`), each sampling one baked atlas (WebP) on UV0. Node names (Blender object names, exported as glTF node names; no dots, so Blender's `.001` never collides):

| node | what |
| --- | --- |
| `M_<module>` | an empty parenting everything of that module |
| `M_<module>__shell`, `__shell_1` … `__shell_3` | the joined static bake, one per atlas |
| `P_<module>__<propId>` | a prop that a swap targets (hide/show/move/retint), kept separate. Baked in context; the shell is baked with it excluded, so a hidden prop leaves no shadow |
| `S_<module>__<surface>` | a text surface: one quad facing the walker, extras `{ "w": m, "h": m }`, material `surface_<module>__<surface>` baked plain. Surfaces: `<propId>` (signs, boards), `doors-sign-<k>` (each numbered door's sign, k from 0), `wall-<side>` (for words on a wall), `floor`, `water` |
| `W_<module>` | the water plane (pool kit). The viewer swaps in the one live material (a cheap planar or cube-map reflection) |
| `F_<module>__<k>` | a light fixture panel (emissive look, baked), kept separate so one can flicker or go out |
| `D_<module>__<doorway>` | an empty at a doorway's centre `c`, rotated so its local +z = `inward` (for scripts and debug) |

Node extras (Blender custom props): `{ "dr": "shell|prop|surface|water|fixture|doorway", "module": "<id>", "id": "<propId|surface|k>" }`.

**Budget per dream:** ≤ 6 MB GLB, ≤ 150 draw calls, ≤ 300 k triangles; ≈ 100 texels/m on named things, less on what fog swallows; ≤ 4 atlases of 2048 px per module. `bake.mjs` measures the real GLB and fails over budget.

**Stills:** `stills/<module>.webp` (1280 × 800 Cycles, volumetric haze), named after the module they show; fallback dreams get `stills/still-<k>.webp`. `still_key` is the first route module's still.

## 7. The corridor kit and the corridor world

**Kit GLB** `public/dreams/corridor-kit.glb` (static, no private data; baked once by `tools/dream-rooms/blender/corridor_kit.py`). Each piece is a top-level node built at the origin, running from z = 0 to z = −length along −z, x centred (−width/2 … +width/2), floor at y = 0. Pieces (`K_<name>`; baked, unlit, its own atlas):

| node | length | what |
| --- | --- | --- |
| `K_entrance` | entrance.length | the "now" end: a closed wall behind z = 0 (+z side), the corridor opens to −z |
| `K_plain` | segment | walls, floor, ceiling, no doors |
| `K_door_l`, `K_door_r`, `K_door_lr` | segment | a door opening at z = −doorZ on the left (x = −width/2), the right, or both, each with its Z-stub behind it |
| `K_break` | break.length | the night-break bay: wider (`break.width`), a dark window on one side, a blank wall on the other for the date stencil |
| `K_end` | end.length | the far end: the corridor carries on into darkness; it never reads as a wall |
| `K_end_door` | segment | the empty-state end: an end wall with one shut door in it |
| `K_leaf` | | a door leaf, hinge at the origin, leaf along −z (`door.w`), facing +x when shut in a left opening; the viewer rotates and mirrors it |
| `K_spill`, `K_underline` | | plain geometry for the light: a floor wedge spilling from a gap, and a thin line under a shut door. Material named `spill`/`underline`; the viewer replaces it with an additive gradient |

**`buildCorridorWorld(rows, opts)`** (`contracts/corridorWorld.js`, pure): a `world.json` with `kind: 'corridor'`, one module `corridor` (kit `dream-corridor`) and:
- `pieces: [{ piece, z, door?, night? }]`: the WORLD z of the piece's start (its +z end). The entrance starts at z = 0; deeper = more negative z. A piece's own geometry runs from its z to z − length. (`spawn.at` stays module-local, as in any world; the module's origin is `[−break.width/2, 0, −D]`.)
- `doors: [{ id, dream, dreamt_on, night_order, status, state, sign: [line1, line2], side, z }]`: `state` = `ajar` (rendered), `shut-lit` (captured, reading or building: a thin line of light under it, sign line 2 reads "not yet"), `shut-dark` (failed). `z` is the world z of the door's centre.
- `breaks: [{ night, z, label }]`.
- `links: [{ kind: 'enter', door, dream }]` for ajar doors.
- `spawn`, and `swaps` for the small changes while unseen.

**Order:** newest night nearest the entrance, older nights deeper (`NEWEST_NEAREST = true`, one constant in `corridorWorld.js`). Within a night, doors follow `night_order` going deeper, alternating sides (1 left, 2 right, …). Every night starts with a break bay carrying its date, so a break sits exactly where the date changes. Between nights the gap gets `min(maxPlain, floor(log2(days apart)))` extra plain pieces. With zero rows: entrance, one plain piece, `K_end_door` with the sign "nothing dreamt yet".

**Door sign:** line 1 is `<d>·<ROMAN MONTH> — <night_order>` (e.g. `24·XI — 2`); line 2 is the title (rendered), `first_words` (before that), or "not yet" (not rendered).

## 8. The viewer's surface

`src/dream-rooms/viewer/DreamStage.jsx`, default export:

```jsx
<DreamStage
  mode="corridor" | "dream"
  rows={rows}                 // corridor: the lean list (§2)
  at={id | null}              // corridor: start standing at this door, facing it
  dream={{ id, world, model_url, stills }}   // dream mode (direct link /dreams/:id)
  loadDream={async (id) => ({ world, model_url, stills })}  // corridor: fetches a dream to enter
  enter={id | null}           // corridor: on load, drift to this door and through it (the list's "Walk")
  autopilot={bool}            // ?autopilot=1
  onWake={(id) => {}}         // dream mode: the page navigates to /dreams?at=<id>
  onState={(state) => {}}
/>
```

**Audio** (`src/dream-rooms/viewer/audio.js`): `unlockAudio()` must be called synchronously inside a user gesture (the dream page's Enter tap, or the corridor's first tap). It creates or resumes the one shared `AudioContext`, plays a silent buffer and sets `navigator.audioSession.type = 'playback'` where it exists. Then `startDreamAudio(world.sound)` / `stop()` run the bed: the hum (100 Hz family, weighted to 200–400 Hz), pink-noise room tone, and a `ConvolverNode` with a generated impulse sized by `reverb`. The first tap in the corridor unlocks audio for the whole session, so a dream entered from the corridor needs no Enter tap.

One `THREE.WebGLRenderer` for the stage's life, reused between the corridor and every dream; the corridor kit stays loaded; a dream's GLB and grids are disposed on waking; `webglcontextlost` is handled. Pixel ratio ≤ 1.5 on touch devices.

**Query flags:** `?autopilot=1` follows the route to the wake (dream) or, in the corridor, plays the entered dream on autopilot; `?still=1` shows stills and words only; `?draft=1` (dream page) loads `files.draft`; `?at=<id>` (corridor) starts at that door; `?list=1` the plain list.

**Debug hooks:** `window.__dream = { state, module, fps, lap, swaps, events }`, with `state` ∈ `loading | black | fading-in | walking | dissolving | teleporting | waking | woken | error`. `window.__corridor = { doors: [{ id, dreamt_on, night_order, status, z }], breaks: [{ night, z }], at, state, signScreen(id) → {x, y} | null, enter(id) }`, with `state` ∈ `loading | corridor | entering | dream | waking | error`.

## 9. Work folders and files

`dream-rooms-work/<id>/` (gitignored):
- `raw.txt`, `row.json` (from `pull.mjs`);
- `reading.md`, `dream.json`, `world.json` (Claude);
- `bespoke/*.py`;
- `build/` (blend, atlases, `draft.glb`);
- `frames/*.png` (autopilot frames);
- `out/world-v<N>.glb` and `out/stills/*.webp`;
- `log.json` (ids, timings, sizes only: never words).

R2 keys: `rows/dreams/<id>.json`, `dreams/<id>/model/world-v<N>.glb` (the previous one is kept), `dreams/<id>/stills/<name>.webp`, `dreams/<id>/draft/{world.glb,world.json,stills/*}`.
