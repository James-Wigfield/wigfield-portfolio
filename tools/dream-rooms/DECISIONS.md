# Dream Rooms: decisions made during the unattended build (2026-11-25)

Each entry: the decision, why, and how to change it. The spec is `src/components/portal/modules/dream-rooms-plan/build-prompt.md` plus `Documents/dream-rooms/prompt-dumping/build-dreams-framework.md` (which wins where they differ). The contracts everything shares are `src/dream-rooms/CONTRACTS.md`. Nothing here contains dream words (decision 14).

## Setup

1. **`.dev.vars` got two lines appended:** a comment and `DREAMS_PASSWORD=dreams-local`. Nothing else in it was touched. *Why:* `wrangler dev` needs a password to run the loop locally. *Change:* edit `.dev.vars`.
2. **`.gitignore` gained `dream-rooms-work/` and `tools/dream-rooms/out/`** before anything wrote there.
3. **JSON is imported with `with { type: 'json' }`** (`dims.json` and the two schemas) in code shared by Vite, wrangler/esbuild and Node 24. *Why:* one file of numbers that the viewer, the checks and (by reading the same JSON) the Blender kit all share. *Change:* a `.js` copy of the JSON, if an old toolchain ever chokes.

## Contracts

4. **The stub behind a doorway is a Z (out 0.9 m, sideways 1.6 m, out 0.9 m), not a single 1.5 m L.** The jump happens in the middle of the sideways leg. *Why:* the Z is 180° symmetric, so the view from the jump point is the same in both stubs, and neither doorway nor the dead end is in view. A single L can't hide the cut from both sides. *Change:* `stub` in `src/dream-rooms/contracts/dims.json` (and its Python mirror reads the same file).
5. **`walk` and `teleport` links work the same way** (stub to stub). Modules are always 200 m apart, so even an ordinary doorway is a jump. The kind only says whether the door goes where you'd expect. *Change:* none needed. A future kit could build two modules side by side for a true `walk`.
6. **Links can be `oneway`.** A doorway is the departure end of at most one link, but several one-way links may arrive at the same doorway. *Why:* the sample's "every door leads back to the start" needs the corridor's start door to lead back to the hall while the numbered door leads to it. *Change:* the `oneway` field in `world.schema.json`.
7. **A dissolve's `after` is seconds spent moving in `from`** (standing still doesn't count). *Why:* one meaning for every module, repeating or not. *Change:* `validate.js` + the viewer's dissolve timer.
8. **Every mechanism is cited or invented-with-a-why,** and `invented` is only accepted on connective tissue: modules, doorways, links, finishes (`plain` only, no colour), ceilings, lights (`glow` only), look, sound and the wake. Props, swaps, figures and words can't be invented. *Why:* James's answer 6 ("only where logical, to keep the dream flowing"). *Change:* `ALLOW_INVENTED` in `validate.js`.
9. **Words and the wake line are matched loosely** (case, spacing and end punctuation ignored), while dream.json quotes are matched exactly with `indexOf`. *Why:* a line on a wall reads better with a capital and a full stop; quotes feed spans, so they must be exact. *Change:* `foundIn` in `validate.js`.
10. **The sample world puts a second bank of lockers in the pool,** and they're what vanishes. *Why:* in the sample dream he turns round and the lockers are gone *after* the corridor became the pool, so the change has to happen where he is. *Change:* `src/dream-rooms/contracts/fixtures/sample.world.json`.
11. **The row gained `own` ([start, end] of `raw_text`)** next to `split_from` / `split_into`. *Why:* a split leaves the parent's `raw_text` untouched, so the parent needs to know which slice is its own. `ownText(row)` in `contracts/rows.js` is the one implementation.

## The corridor

12. **Direction: the newest night is nearest the entrance**, and older nights recede into the fog. *Change:* flip `NEWEST_NEAREST` in `src/dream-rooms/contracts/corridorWorld.js`.
13. **One door per 4 m piece, alternating sides** (1 left, 2 right, …). `K_door_lr` is baked but unused. *Why:* order reads as depth, with one door at a time. *Change:* `buildCorridorWorld`.
14. **Every night starts with a break bay carrying its date,** including the first night just after the entrance. Between nights, the extra gap is `min(3, floor(log2(days apart)))` plain pieces. *Change:* `dims.json → corridor.gap`.
15. **A door sign has up to three lines:** `24·XI — 2`; then the title (rendered) or the first words; then "not yet" (captured, reading or building). *Why:* the spec asks for both the first words and "not yet" before a dream is rendered.
16. **The hallway shifts a little while unseen:** about one sign in five briefly reads wrong (the day's digits swapped, or the number off by one) and reverts after 18 s. *Change:* the `hash(row.id) % 5` line in `buildCorridorWorld`.

## The API (`workers/dream-rooms.js`)

17. **Unauthenticated means 404 everywhere, including `ping`.** So the gate reads a 404 from `ping` as "wrong password", and no route reveals whether a dream exists. A wrong non-empty password waits 600 ms first. A bad file token with no bearer answers at once. An optional `DREAMS_RATE_LIMIT` binding is honoured if one is ever configured.
18. **Unknown PATCH fields are a 400** (typos fail loudly), apart from a matching `id`. *Change:* the `unknown` check in `patchRoute`.
19. **`raw_text` freezes once a row has been split** (parent or child), even while `captured`. An edit would break `own` and the rule that the slices join back into the original. Re-sending identical text is a no-op.
20. **Renumbering doesn't bump siblings' `updated_at`.** It's bookkeeping, and an open edit form on a sibling shouldn't hit a 409 because of it. The moved row is bumped.
21. **A `POST` with `night_order: k` inserts at k** and shifts later rows; without one, the row goes to the end of its night. A client `created_at` is accepted but clamped to now.
22. **The split is one Worker route** (`POST /api/dreams/:id/split`, 201 `{ parent, child }`), so it's atomic and `api-check` can test its invariants. `split.mjs` calls it. A phrase at the very start of the own slice (leaving nothing for the parent) is a 400.
23. **Soft-deleted rows:** `GET /:id` still answers (with `deleted_at`); PATCH, split and PUT → 404; there's no restore route yet. Purge deletes orphan files even when the row is gone.
24. **Signed URLs** expire 50–60 min after issue (10-minute windows, so a URL is stable for a while). Tokens claiming more than about an hour are refused. The fallback key is derived as `dreams-derived|DREAMS_PASSWORD|PORTAL_PASSWORD`, so it can never equal Memory Rooms' key.
25. **`model_key`/`still_key` must name a file in this dream's own folder that already exists in R2**, or 400. A `kind: 'corridor'` world is never stored (400).
26. **`api-check` refuses a non-local API unless `--remote-ok` is passed**, because it writes (and purges) test rows on random 19xx nights.
27. **Known gap:** deleting a split child doesn't give its text back to the parent's `own` slice. Undo by hand if ever needed.

## The pages (`src/dream-rooms/`)

28. **DreamStage loads lazily**, in its own chunk inside the Dreams chunk, so capture never waits for three.js. App.jsx still uses one helper (`dreams(page)`). *Change:* a static import in `CorridorPage`/`DreamPage`.
29. **With `prefers-reduced-motion` (or no WebGL), `/dreams` opens the list**, with a quiet "walk the corridor anyway" link. `?walk=1`, `?at` and `?enter` still walk. *Change:* the top of `CorridorPage.jsx`.
30. **A dream's title never goes into the tab title or browser history.** The tab always reads "Dreams". *Change:* `useTakeover` in `DreamRoomsApp.jsx`.
31. **The next `night_order` is worked out at Save time** from a small IndexedDB store of numbers only (id, date, order; no words), which the server's list refreshes whenever it loads. The server renumbers collisions anyway.
32. **An empty "another dream" draft older than 12 h starts fresh,** so an old night doesn't stick to the chip. *Change:* `STALE_EMPTY_DRAFT_MS`.
33. **The outbox counts an upload as confirmed** when the server answers with the same id; the words are then deleted from the phone. A 400/409/413 keeps the dream on the phone with "try again". A 404 re-pings, then retries or shows the gate.
34. **A split row's text can't be edited while waiting to be read** (it would break the slice positions); it links to its other part instead.
35. **The dream page shows the row's own part under "as told"** and additions under "remembered later". Esc leaves a walk (there's no HUD to leave by).
36. **A service worker is included:** production only, scope `/dreams`, network first, falling back to `/dreams/new`, so capture opens with no signal. It never touches `/api`. *Change:* delete `public/dreams-sw.js` and `useOfflineShell`.
37. **Capture sizes itself to the visible screen above the keyboard** (`visualViewport`), so Save stays at the thumb while dictating.
38. **The corridor's two corner links** ("new dream", "list") have a soft dark halo so they stay legible yet faint on a pale fog.

## The Blender kit (`tools/dream-rooms/blender/`)

39. **File layout:** the nine finishes share one `kit/finishes.py`; each module and each prop is its own file; the plumbing is in `kit/base.py`, `kit/shell.py` and `kit/lights.py`. `bake_export.py` is a thin wrapper that runs `build_world.py` in full mode. `KIT.md` documents it and the bespoke API.
40. **GLB measuring** (`measureGlb`/`overBudget` in `lib/blender.mjs`) registers `EXT_texture_webp` next to `KHRONOS_EXTENSIONS`, since Blender writes it and the reader refuses the file otherwise.
41. **Node transforms:**
    - `M_` empties are identity, with `kit`/`origin`/`size` extras.
    - `P_` nodes sit at their anchor (the wall point at floor level, or `pos`), so a `move` swap is `position = origin + to`.
    - `S_` quads sit at their centre, with local +z = facing and +y = up; floor and water quads read the right way up for whoever walks in.
    - `D_` local +z = inward.
42. **Sign numbering:** `doors-sign-<k>` numbers the decorative doors first, then the doorways in `world.doorways` order.
43. **Still cameras follow the CONTRACTS order,** except when a room is shallower than 4 m across from the entry doorway: then the camera looks along the long axis (a repeating corridor looks north).
44. **Exposure is automatic per module** from its still camera, keyed on `look.light`: night 0.14, afternoon/evening 0.19, day 0.25, and ×0.55 for `lights: none`. Still haze is 0.7 × `fog.density`, in the fog colour.
45. **Cited props without a colour get muted neutrals** (lockers `#7f8a84`, door leaves `#57473a`, frames `#77706a`); the schema has no colour field for doors or trims. Invented grey is `#76746f`, so his named things carry the image.
46. **Bake order:** the shell bakes first with swap targets and text quads hidden, then the separate nodes bake with everything visible. A door prop that a swap targets is built proud of the wall, so hiding it never leaves a hole.
47. **Pool:** a deck band of min(1.6 m, w/4, d/4), a basin 1.4 m deep, water 0.12 m below the deck. Lane lines only when the floor is cited.
48. **Hall columns:** about 7 m apart and ≥ 3 m from the walls, kept clear of the spawn, doorway approaches and the dissolve arrival.
49. **The corridor kit's look:**
    - **Feel:** a hotel or school at night. Warm and dim, lit from a cove you never see (hidden area lights, not glowing strips), an oxblood runner, panelling to a rail, and an end that dissolves into fog, never a wall.
    - **The bay:** `K_break` has its dark window on the right (+x) and the stencil wall on the left.
    - **The empty state:** `K_end_door` has a shut leaf baked into its end wall.
    - **Baking:** one exposure for the whole kit; 512 samples; 313 KB.
50. **`build.mjs` always drafts;** `--stills` adds preview stills. Upload is skipped unless the Worker lists `draft`. **`bake.mjs` empties `out/stills` first,** because `push.mjs` uploads everything there. Bakes aren't denoised: quality comes from samples (≥ 384 for the full bake).

## The viewer (`src/dream-rooms/viewer/`)

51. **DreamStage gained four props:** `mood` (a fallback; the dream's own mood wins), `still` (stills + words only), `kitUrl` (`null` = the grey-box kit) and `onAt(id)` (a wake left him at a door). In corridor mode the stage handles the return from a dream itself, including `history.replaceState` to `?at=<id>`; `onWake` is for the direct dream page.
52. **A woken-from door shows shut,** then quietly goes back to ajar once it has been unseen ≥ 1.5 s with him more than 5 m away.
53. **Standing at a door** (after a wake or `?at=`) means across the corridor (|x| = 0.7) with a slight upward look, so the door and its sign are both in frame.
54. **Portrait screens widen the vertical FOV,** so the horizontal stays at least ~40° (capped at 78°); landscape stays at 62°. A phone is otherwise a peephole. *Change:* `resize` in `viewer/stage.js`.
55. **Text is a coverage mask:** lettering is drawn white-on-black and used as the `alphaMap`, so there are no fringes at any distance. Signs are cream ink on the kit's plaque, 20 mm proud of the wall. The text guides for water, floor and wall are hidden; only the ink shows.
56. **The dream pass rotates its glow taps per pixel** (no ghost copies of bright text), and the glow threshold went from 0.6 to 0.64. Still one pass.
57. **Repeat modules vary per logical segment by hash:** about 1 door sign in 3 relabels while unseen; tubes and props about 1 segment in 2; words on every third segment. A teleport into a repeat module (the numbered door) resets it to segment 0: "the start".
58. **Figures:**
    - The silhouette holds at about 1/fog-density m (8–16 m), slightly off-axis and faint, and moves only while unseen; in a finite room it thins out if he gets within 6 m.
    - Coats go against the wall furthest from where he arrives.
    - `other-room` voices sit 4 m beyond that wall.
59. **Swap preconditions:** `time:N` counts seconds present in the module since entering it; `visited:` means at any time. Autopilot turns round in the last module 4.5 s before the wake, so a change can be witnessed.
60. **Failures fall back quietly:** a GLB that fails becomes the grey box; a failed dream load clears back to the corridor at that door (`console.warn` with the id only).
61. **Taps hit generous invisible boxes** round each door and sign (the nearest sign wins, or within 36 px if it's within 18 m). A long straight hold eases from 1× to 2× between 4 and 10 s, never within 3–4 s of entering or waking; tap-drifts longer than 6 m ramp up on their own.
62. **`frames.mjs` takes the dissolve frame at white ≥ 0.6** (the real peak is pure white), and module frames only once the screen is neither black nor white.

## Integration and the self-test

63. **`?draft=1` walks the draft at any status** (DreamPage), because `build.mjs` reviews a dream that is still `building`. Found when the first frame run came back empty.
64. **`push.mjs` never overwrites the live GLB:** the file number is max(world_version, live number + 1), so a re-render with an unchanged world still gets a new `world-v<N>.glb` and the old one stays in R2.
65. **`tools/dream-rooms/capture.mjs`** types a text file into the real capture page headlessly (390 px), saves it, and prints the new id. It's for the self-test and fixtures, never for real dreams.
66. **The adversarial samples** (`samples/adversarial/`, fictional):
    - the flying dream goes to the still fallback (3 of 4 entities dropped);
    - the mostly-an-argument dream stays a small walk: one room, a voice-only figure, a coat and one line (1 of 5 dropped);
    - the two-line dream stays a tiny one-room walk (0 of 3 dropped).

    Figures-as-absences carry more of a "mostly people" dream than the spec expected. *Change:* judge it in the skill's fit check.
67. **Still worlds skip the GLB budget checks** (stills are rendered, never baked).
68. **Fresh review of the sample** ("mostly the Backrooms, built like a game level"). Fixed:
    - **Too little school-airport mix:** lockers along two walls, six big dark windows, the board beside the gate.
    - **Words like pasted captions:** the pool's line moved off the water onto the wall beside him.
    - **Still water like concrete:** the water's reflectivity is down from 0.42 to 0.2, so the baked teal shows.

    Also:
    - the silhouette holds nearer (0.75/fog density, 7–13 m) so she can be glimpsed;
    - a repeating corridor's still uses 15 copies, so its open end is lost in haze, never read as a wall.
69. **Fresh review of the corridor** ("mostly the Backrooms dressed as a hotel"; not a game menu). Fixed:
    - **The far end was a black void:** the fog is now a warm pale haze (`#6a5848` at 0.05, from `#1d1a17` at 0.055).
    - **The doors barely showed:** live door leaves are lighter than the walls, and the spill and slit glow are brighter.
    - **The date read as floating UI:** the night's date is now brass lettering set into the floor of the bay (on the wall, the corner hid half of it).

    Also: grain is down from 0.06 to 0.04, and the always-on centre blur from 0.18 to 0.07.
70. **Still off (not fixed):**
    - every corridor segment is a copy: no drift with age, curve or ceiling change;
    - a phone sees a lot of ceiling;
    - an ajar door shows light but no glimpse of its dream;
    - the pool water is flatter than its still;
    - the dissolve is a white-out, not a morph;
    - the corridor kit has no tubes, so its unseen changes are signs and doors only.

    These are good next asks.
