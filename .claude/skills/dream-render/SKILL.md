---
name: dream-render
description: Turn James's captured dreams (typed or dictated at /dreams/new) into walkable, liminal 3D dreams in the Dream Corridor at /dreams. Reads the text into dream.json (what it was) and world.json (one build), builds and bakes it with the headless Blender kit, reviews the autopilot frames, and publishes. Use for "render my new dreams", "render dream X", "re-read dream X", "render the next dream", or "split dream X".
---

# dream-render

## 0. Privacy first (decision 14)

His dream words never leave the dream's own row and its gitignored work folder (`dream-rooms-work/<id>/`). That means:
- **Never** copy dream text, titles, quotes or motifs into the Obsidian vault, Claude's memory, `tools/dream-rooms/DECISIONS.md`, commit messages, console output you choose to print, or your chat summary. In the chat, describe a dream only as much as James needs to follow along; it's his. In the vault and memory, write "dream <id> rendered", nothing more.
- The scripts print ids, counts and statuses only. Keep it that way.
- The fictional sample (`tools/dream-rooms/samples/sample-dream.txt`) is the only dream docs may quote.

## Before you start

- **Where it runs:** everything runs in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`.
- **What to read:** the contracts in `src/dream-rooms/CONTRACTS.md` (§3 dream.json, §4 world.json, §5 geometry; read them before writing either file); the worked example `src/dream-rooms/contracts/fixtures/sample.{dream,world}.json`; the kit's pieces in `tools/dream-rooms/blender/KIT.md`; the rubric in `tools/dream-rooms/RUBRIC.md`.
- **Which API:** the scripts read `DREAMS_API` (default `http://127.0.0.1:8796`) and `DREAMS_PASSWORD` (env, else `.dev.vars`, then `PORTAL_PASSWORD`).
  - **Local:** `npm run build`, then `npx wrangler dev --port 8796` (port 8787 belongs to another project; restart wrangler after every rebuild).
  - **Deployed:** `DREAMS_API=https://jameswigfield.com DREAMS_PASSWORD=<pw> node …`.
- **Frames** are captured from the site at `DREAMS_SITE` (default: the API's origin).
- **Nothing runs on its own:** dreams are rendered only when James asks.

## 1. Pull

```
node tools/dream-rooms/pull.mjs --list            # ids + statuses, stale ones marked
node tools/dream-rooms/pull.mjs --next            # the oldest captured dream (or: <id>)
```
`dream-rooms-work/<id>/raw.txt` (his own text + anything "remembered more") and `row.json`. The status becomes `reading`. A dream stuck in `reading`/`building` for over 2 h is stale: `pull.mjs --reset <id>` puts it back to `captured`. To re-read a rendered dream: `pull.mjs <id> --reread` (its last `dream.json`/`world.json` are saved as `*.prev.json`; a better read keeps what was right).

**Several dreams in one capture?** Only where the text says so explicitly ("…and then I had another one where…"):
```
node tools/dream-rooms/split.mjs <id> --at "<exact words that start the second dream>"
```
The phrase must occur exactly once (indexOf). The original keeps its full text, untouched, and now reads only its own slice: `raw.txt` is rewritten to that slice. The new row is the next dream that night. Pull it next. **Don't split on a guess:** if it's ambiguous, render it as one dream and note it in `reading.md`.

## 2. Read: `reading.md`, then `dream.json`

Read `raw.txt` slowly. In `reading.md` list, with his exact words:
- each place (what it was, and what else it was);
- each figure;
- the objects;
- the feeling;
- every contradiction, vague patch and change;
- links between places, especially impossible ones;
- sounds;
- time.

Rambling, fragments and contradictions are the material, not noise. **Strangeness is data: never clean it up.** When the dream says two things, keep both.

Then write `dream.json` (schema `src/dream-rooms/contracts/dream.schema.json`):
- **Ids:** `p1` place, `l1` link, `f1` figure, `o1` object, `c1` change, `v1` vague, `s1` sound, `time`.
- **Quotes:** every entity quotes his exact words (copy-paste from `raw.txt`; several allowed). Leave `src` out.
- **Certainty** 0–1. A place may carry `real` ("my old house on Fletcher St"): store it, never look it up.
- **Motifs:** lower-case-hyphenated.
- **Title:** short, in his register.

## 3. Spans + check

```
node tools/dream-rooms/quote-spans.mjs <id>   # fills src with indexOf; fails on a quote that isn't his exact words
node tools/dream-rooms/check-dream.mjs <id>   # schema, quotes, references, motifs; prints the strangeness ids
```
Fix the quote, never the span. Never count characters yourself.

## 4. Fit check

Count the entities you'd have to drop to build it: a dream that's mostly people, an argument, flying, open landscape, or two lines long. **If more than half would be dropped, don't build an empty box:**
- set `world.fallback = "still"`;
- give it one or two modules, used only to frame the Cycles stills;
- add `stills` hints, his `words`, `sound` and the `wake` line;
- list the dropped ids in `dropped` with reasons.

The viewer shows the stills, his words and the sound instead of a walk.

## 5. Design `world.json`

One way to build it (schema `world.schema.json`; the contracts in §4–5):
- **Modules:** each place → a module (`room | hall | corridor | pool | bespoke`), `origin` at `[200·i, 0, 0]`, `size` = the inside. Use `scale` 0.6–1.6 to make something 10–25 % wrong in every dream. An endless corridor → `repeat: true`.
- **Impossible spaces** are separate modules joined by links, never non-Euclidean geometry:
  - `walk`/`teleport` (doorway → doorway through Z-stubs; `oneway` when only one direction makes sense);
  - `dissolve` ("then the corridor was the pool": fog whitens after `after` seconds of moving in `from`).
- **Changes** happen only while unseen: `swaps` (`hide`, `show`, `move`, `retint`, `relabel`, with an `after` precondition).
- **Figures are absences:** `silhouette` at fog distance, `voice`, `coat`, `chair-coat`. Never people.
- **His words live in the place:** `words` on a sign, board, door signs, a wall, the water or the floor. They must be his words.
- **The wake:** after the last module, `wake.line` = one line of his own.
- **Cite or invent.** Every finish, fixture, light, prop, doorway, link and module cites dream ids in `for`, or is `invented: true` with a `why` ("joins p1 to p2", "floor for p3"):
  - invent only connective tissue (a joining passage, a floor, a wall, a doorway the route needs);
  - invented things stay plain (grey, no colour, no detail);
  - **no default look:** drop ceilings, fluorescent panels, wallpaper and olive fog only when his words call for them.
- **Cover the strange.** Every id check-dream printed as strangeness must be in some `for`, or in `dropped` with a reason.

```
node tools/dream-rooms/check-world.mjs <id>
```

## 6. Draft build + frames

```
node tools/dream-rooms/build.mjs <id> --draft
```
Builds a quick draft (512 px, 32 samples) and uploads it as the draft. The status becomes `building`. It walks the real viewer headlessly at `/dreams/<id>?draft=1&autopilot=1`, saving a frame per module plus the dissolve and the wake to `dream-rooms-work/<id>/frames/`.

## 7. Review (at most 2 rounds)

Read the frames beside `raw.txt` and score them against `tools/dream-rooms/RUBRIC.md`:
- Is the light sourceless?
- Is anything tidy, generic or game-like?
- Are his details there, and crisp?
- Is the scale off?
- Is it empty?
- Is there a Backrooms default he didn't ask for?
- Is anything invented that the route doesn't need?

Fix the **3 worst** in `world.json` or `bespoke/*.py`, re-run step 6 once if it helps, and write what's still off in `reading.md`.

A `bespoke` module is a script `dream-rooms-work/<id>/bespoke/<name>.py` that defines `build(ctx, module)` inside its declared box (see `KIT.md`). Use it when no kit module fits.

## 8. Bake

```
node tools/dream-rooms/bake.mjs <id>
```
The full bake: `out/world-v<N>.glb` plus a still per module. It fails over budget (6 MB, 150 draw calls, 300 k triangles). Shrink modules or atlases and bake again.

## 9. Push

```
node tools/dream-rooms/push.mjs <id>
```
Uploads the GLB and stills, saves both contracts, points `model_key` at the new GLB (the old one is kept) and sets status `rendered`. If you have to give up:
```
node tools/dream-rooms/push.mjs <id> --fail "<one line, no dream words>"
```

## After a batch

- **The vault:** per `CLAUDE.md`, update `01-Active-Projects/dream-rooms.md` with "dream <id> rendered" lines only (no titles, no words).
- **The chat:** tell James which ids are rendered and that they're behind their doors in the corridor at `/dreams`.

Target: under 30 minutes per dream.
