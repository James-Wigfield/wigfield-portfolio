# Build: Dream Rooms framework at `/dreams` (with the Dream Corridor as its front door)

You're in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`. Read `CLAUDE.md` first and do what it asks (it keeps an Obsidian vault note; the project note is `01-Active-Projects/dream-rooms.md`).

**The spec is `src/components/portal/modules/dream-rooms-plan/build-prompt.md`.** Read all of it now and build what it says. It's also shown on the live plan page `/portal/dream-rooms-plan`. This prompt adds James's answers to the plan's eight questions and three changes he asked for after reading it. **Where this prompt and `build-prompt.md` disagree, this prompt wins.** Everything else in `build-prompt.md` stands, including its 15 decisions, its rules for running the session, the self-test and "Done means".

## How to run this session (repeated here because it matters)

- **Unattended, start to finish.** James can't answer. Never ask, wait for confirmation or use plan mode. When something is unclear, make a sensible call, log it in `tools/dream-rooms/DECISIONS.md` (decision, why, how to change it) and keep going. Tell every subagent the same.
- **Git:** stay on the current branch (usually `main`). Don't create or switch branches or use worktrees, and this applies to subagents too. **Don't commit, push, deploy or create Cloudflare resources.** James reviews first.
- **Other people's work:** the tree may hold someone else's uncommitted work (for example `Documents/memory-rooms/assets/joes-house/`, and anything under `src/memory-rooms/`, `workers/memory-rooms.js` or `tools/memory-rooms/`). Don't touch, format, stage or revert it.
- **Shared files:** only edit the ones `build-prompt.md` lists (`src/App.jsx`, `workers/app.js`, `wrangler.jsonc`, `.dev.vars.example`, `.gitignore`), and keep each change small and additive.
- **Ports and cleanup:** never use port 8787. Stop node, wrangler, workerd, Edge and Blender when you're done.
- **Privacy (decision 14):** dream words never go into the vault, memory, `DECISIONS.md`, commit messages or console output. The fictional sample dream is the only one you may quote.

## James's answers to the plan's questions (settled; don't reopen them)

1. **Real dreams before the build? No.** He wants to start from scratch, writing his dreams now that he knows the tool exists. So build and self-test on the fictional sample and the fixtures below. **Production gets no seed data:** the sample and the fixtures live only in `wrangler dev`'s local R2 and in `tools/dream-rooms/samples/`.
2. **Private only? Yes.**
3. **Own password? Yes.** Use `DREAMS_PASSWORD` (plus `PORTAL_PASSWORD`). It's for James only. `MEMORIES_PASSWORD` must never open dreams.
4. **New free R2 bucket `dream-rooms` for rows and files? Yes.** Don't create it; put it on the final checklist.
5. **When a dream is built: on request.** James says "render my new dreams" in Claude Code. Nothing runs on its own.
6. **Can Claude add things that weren't in the dream? Yes, but only where logical,** to keep the dream flowing. This tightens decision 9:
   - **What's allowed:** invented geometry only as connective tissue: a joining passage, a floor to stand on, a wall to close a space, a doorway the route needs.
   - **How it's marked:** every `invented: true` item also carries `why` (`"joins p1 to p2"`, `"floor for p3"`). `check-world.mjs` fails an invented item without a `why`.
   - **Rubric:** add "Is anything invented that the route doesn't need?" to `RUBRIC.md`.
   - **How it looks:** invented things stay plain (grey, fogged, no detail).
7. **Voice memos? No,** not at this stage. Keyboard dictation in the textarea is enough.
8. **Reuse Memory Rooms models for real places? Later, not the MVP.** In this build, a place in `dream.json` may carry an optional free-text `real` field (James might write "my old house on Fletcher St"). Store it, but don't look anything up and don't import anything from Memory Rooms.

## Change A: the route is `/dreams`, in this repo

This repo, on the existing site. Dream Rooms gets its own top-level route, `/dreams`, next to `/memories`. It isn't a portal module: the portal plan page stays as it is, and you don't edit anything under `src/components/portal/`. The routes in `build-prompt.md` stand, except that `/dreams` itself is now the corridor (Change C).

## Change B: several dreams in one night

A night often holds two or three dreams. Make that a first-class idea.

- **Row fields:**
  - Add `night_order` (an integer from 1, the order he dreamt them, as best he knows).
  - Add `split_from` (a dream id, or null).
  - A night is just its `dreamt_on` date. There's no separate night object.
  - The archive order is `dreamt_on`, then `night_order`.
- **Capture:**
  - After **Save dream**, the screen offers **Another dream from the same night**. It opens a fresh textarea with the same `dreamt_on` and the next `night_order`.
  - The date shows as a small night chip ("Night of Tue 24 Nov"). It's tappable to change, because he won't always capture the next morning. It defaults to the existing before-2-pm rule.
  - Each dream is its own row, with its own `raw_text`, `dream.json`, `world.json` and GLB.
- **Reordering:** `PATCH night_order` is allowed at any status. The list view (below) has up/down controls within a night. Renumbering keeps each night's orders 1..n with no gaps.
- **Splitting.** Half awake, he may dictate two dreams in one go ("…and then I had another one where…"). The skill may split a capture, but only where the text says so explicitly.
  1. `split.mjs <id> --at "<exact words that start the second dream>"` cuts at the phrase. It must find the phrase with `indexOf`, or it fails.
  2. It creates a new row: `split_from` is the original, `dreamt_on` is the same, and `night_order` is the next one, with the later dreams that night shifted along.
  3. The original row keeps its full `raw_text` untouched and gets `split_into: [ids]`. Each part reads only its own slice.
  4. Log the split (ids only) in the work folder, never the words.
  5. Don't split on a guess. If it's ambiguous, render it as one dream and note it in `reading.md`.
- **Night rhythm in the viewer:** inside one dream, the wake is still the end. Waking returns him to the corridor (Change C), where the night's next door is the natural next step.
- **API:** `GET /api/dreams` returns a lean list for the corridor:
  - fields: `id`, `dreamt_on`, `night_order`, `status`, `title`, `first_words`, `still_key`, `split_from`;
  - `first_words` is the first ~6 words, sent only to an authenticated caller;
  - sorted by `dreamt_on` then `night_order`.

## Change C: the Dream Corridor is how you get into dreams

`/dreams` isn't a list page any more. It's **a long, dreamy, walkable corridor**, in the same family as the baked corridor on the plan page:
- `LiminalSketch.jsx`;
- `corridor.glb`, baked by `tools/dream-rooms-plan/blender/corridor.py`;
- the fog and the one merged `dreamPass.js`.

Each door along it is one dream, **in the order the dreams happened** (`dreamt_on`, then `night_order`). Think of the dream corridor in *Inception*: he drifts down the corridor, chooses a door, goes through it, and the dream he described plays. When he wakes, he's back in the corridor, at that door.

**Layout and order**
- **Direction:** the entrance is "now". Walking deeper goes back in time: the newest night's doors are nearest the entrance, and older nights recede into the fog. Make the direction one constant, and log it in `DECISIONS.md` as easy to flip.
- **Nights:** each night is a stretch of corridor with its doors in `night_order`, alternating sides. Between nights there's a **night break**:
  - a slightly wider bay with a dark window;
  - the night's date written into the place (a sign or a stencil on the wall), as a live canvas text plane in the place, not HUD text;
  - a longer gap when nights are far apart, capped so the corridor never becomes tedious.
- **Door signs** (live canvas text, fogged, like decision 8's words): the night's date and the dream's number in the night (`24·XI — 2`). Under that goes the title once it's rendered, or `first_words` before that.
- **Door state** shows in the place, not as UI:
  - **rendered:** the door stands ajar, with light that has no source spilling from the gap;
  - **captured, reading or building:** the door is shut with a thin line of light under it, and the sign reads "not yet";
  - **failed:** the door is shut and dark.
  - Only rendered doors open.
- **The far end** fades into fog. With zero dreams, the corridor is short and ends in one shut door, its sign reading "nothing dreamt yet".

**Movement and entering**
- **Same controls as decision 8:** hold to drift and drag to look; arrow keys work; no WASD and no pointer lock. No HUD in the corridor either.
- **Only two quiet links:** a mono micro-label "new dream" (→ `/dreams/new`) and "list" (→ `?list=1`), faint, in one corner.
- **Phones:** tapping a door sign drifts you to that door and through it, so a long corridor never means a long walk. Drift speed may ease up over a long straight hold (up to about 2×, but never on entry).
- **Through the door:** use decision 5's own trick. The doorway opens onto a 1.5 m bent stub, the fog whitens (dissolve), the dream's GLB loads during the whiteout, and it clears at the dream's spawn.
  - **Loading time:** hold the whiteout while the GLB loads, and show only a faint grain if it takes longer than about 3 s.
  - **Audio:** the first tap in the corridor unlocks audio for the whole session, so the dream page's separate "Enter" tap isn't needed when he comes from the corridor.
- **Waking:** the dream's wake (fade to white, his one line) clears back into the corridor. He stands facing that door, which is now shut. Use `/dreams?at=<id>` for the same thing from a deep link.
- **Direct links still work:** `/dreams/:id` plays one dream with its own Enter tap, and its wake returns to `/dreams?at=<id>`.

**How to build it (strong suggestion; log any change in `DECISIONS.md`)**
- **Bake once and ship it static.** The corridor holds no private data, so its geometry is baked once by the kit and shipped as a static asset, e.g. `public/dreams/corridor-kit.glb`. Everything private (dates, titles, door states) comes from the authenticated API and is drawn live.
- **New Blender script `tools/dream-rooms/blender/corridor_kit.py`,** baked in context like the proof. It builds a small set of segment variants:
  - a segment with a door on the left, one with a door on the right, and one with doors on both sides;
  - a plain segment;
  - the night-break bay;
  - the entrance;
  - the fog end cap.
- **Separate meshes:** door leaves and the light spill are their own meshes, so ajar or shut is a live choice and not a re-bake.
- **The corridor is a world.json made at runtime.** `buildCorridorWorld(rows)` lays the segments out from the list, and the same viewer engine runs it as it runs any dream: fog, the post pass, walk grids, swaps, words. That gives one engine with two kinds of world. Each door is a new link kind, `enter`, carrying the dream id. Add `enter` to the contract, and have `check-contracts.mjs` cover a generated corridor world.
- **Streaming:** keep only about ±12 segments around the walker in the scene, so a corridor of 300 dreams costs the same as one of 10. Reuse one WebGL context between the corridor and dreams, keep the corridor kit loaded, and dispose each dream's GLB on waking.
- **Keep the feel:** things in the corridor may also change while unseen, as decision 6 says (a sign that briefly reads wrong, one tube out). Keep it subtle: it's the hallway, not the dream.
- **Debug hook:** expose `window.__corridor = { doors: [{ id, dreamt_on, night_order, status, z }], at, state }` for scripts.

**The list view (`/dreams?list=1`)**
- **Purpose:** a plain, fast list of the same rows, used on weak devices, with `prefers-reduced-motion`, and for the jobs a corridor is bad at: seeing status, reordering within a night, and editing text before it's read.
- **Layout:** grouped by night, newest first. Use the `.dr-` styles from "The interface" in `build-prompt.md`.
- **Navigation:** a row's "Walk" goes to the corridor at that door and through it.

## Fixtures and the self-test (on top of `build-prompt.md`'s self-test)

- **Local fixtures:** `tools/dream-rooms/samples/fixtures-nights.json` lists about 9 fictional dreams over 5 nights (1, 3, 2, 1, 2 dreams), with mixed statuses and two nights far apart. Each text is one or two invented sentences: never real, and never James's.
- **Seeding:** `seed-local.mjs` loads them into `wrangler dev`'s local R2 only. It refuses any `DREAMS_API` that isn't localhost.
- **Rendered fixtures:** the rendered ones can all point at the sample dream's GLB.
- **The full pipeline still runs on the sample dream,** plus one capture of two dreams in a single textarea, split with `split.mjs`. Both halves must reach `rendered`, or the still fallback for the short half.
- **`page-check.mjs` adds:**
  - **Order:** door positions are monotonic in (`dreamt_on`, `night_order`), and there's a night break exactly where the date changes.
  - **Door states:** each matches its row's status, and only rendered doors open.
  - **Entering and waking:** tapping a door sign drifts you in and plays that dream. `?autopilot=1` then reaches the wake, and waking leaves you at that door (`__corridor.at`).
  - **Empty state:** zero dreams.
  - **Deep links:** `?at=<id>` and `?list=1`.
  - **List view:** reordering within a night works.
  - **Capture:** "Another dream from the same night" gives the same date and the next `night_order`.
  - **Basics:** zero console errors, and screenshots of the corridor at 1440 and 390.
- **`api-check.mjs` adds:** `night_order` renumbering, split invariants (the parent text is untouched and the slices joined equal the original), and that the list without a password is a 404, the same as any dream.
- **Fresh reviewer:** give a fresh subagent corridor frames (near the entrance, a night break and deep in the fog), with no opinion from you. Ask it: "does this feel like a dreamy corridor of doors, a game menu, or the Backrooms, and why?" Fix the worst three things it names.

## Out of scope (unchanged, plus these)

- **Unchanged:** everything in `build-prompt.md`'s "Out of scope". That includes sharing, voice recording, Memory Rooms model reuse and deploying.
- **Also out:**
  - linking a dream to another dream's door (recurring places);
  - a calendar or map view;
  - search.

## Final message

Follow `build-prompt.md`'s "Done means", plus:
- how to capture a night with two dreams on his phone, and how to reorder them;
- a screenshot path for the corridor at 390 px;
- the before-deploy checklist:
  1. create R2 bucket `dream-rooms`;
  2. `wrangler secret put DREAMS_PASSWORD` and `DREAMS_SIGNING_KEY`;
  3. commit;
  4. deploy the Worker from a clean worktree of committed `main`, before pushing anything that depends on it;
  5. confirm production R2 has no fixtures.
