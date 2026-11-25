# Dream Rooms · tools

A dream typed at 6 am becomes a walkable, liminal 3D dream behind a door in the **Dream Corridor** at `/dreams`. This folder holds the scripts, the headless Blender kit and the checks. The site code is in `src/dream-rooms/` (front end) and `workers/dream-rooms.js` (API). The contracts everyone shares are in `src/dream-rooms/CONTRACTS.md`. The calls made during the build are in `DECISIONS.md`.

**Privacy (decision 14):** dream words never go into the vault, memory, `DECISIONS.md`, commit messages or console output. The scripts print ids, counts and statuses. Work folders (`dream-rooms-work/`) are gitignored.

## The loop

```
phone  ──/dreams/new──▶  outbox (IndexedDB)  ──POST /api/dreams──▶  R2 row (captured)
                                                                        │
"render my new dreams" in Claude Code  ── skill .claude/skills/dream-render ──┘
   pull → reading.md + dream.json → quote-spans → check-dream → fit check →
   world.json → check-world → build --draft (+ autopilot frames) → review (≤ 2 rounds) →
   bake → push  ──▶  row rendered, GLB + stills in R2  ──▶  a door ajar in /dreams
```

## Run it locally (no Cloudflare setup)

```
npm run build
npx wrangler dev --port 8796            # never 8787; restart after every rebuild (stale assets)
node tools/dream-rooms/seed-local.mjs   # optional: 9 fictional dreams over 5 nights (local only)
```
Then open `http://127.0.0.1:8796/dreams` (password: `DREAMS_PASSWORD` from `.dev.vars`). `wrangler dev` simulates the R2 bucket in `.wrangler/state`.

## The render workflow (what the skill runs)

| step | command | writes |
| --- | --- | --- |
| 1 | `node tools/dream-rooms/pull.mjs --next` (or `<id>`, `--reread`, `--list`, `--reset <id>`) | `dream-rooms-work/<id>/raw.txt`, `row.json`; status `reading` |
| 1b | `node tools/dream-rooms/split.mjs <id> --at "<exact words>"` (only when the text says so) | a new row for the second dream |
| 2 | Claude writes `reading.md` and `dream.json` | |
| 3 | `node tools/dream-rooms/quote-spans.mjs <id>`, then `node tools/dream-rooms/check-dream.mjs <id>` | `src` spans |
| 4–5 | Claude: the fit check, then `world.json`; `node tools/dream-rooms/check-world.mjs <id>` | |
| 6 | `node tools/dream-rooms/build.mjs <id> --draft` | `build/draft.glb`, the draft in R2, `frames/*.png`; status `building` |
| 7 | Claude reviews the frames against `RUBRIC.md` (≤ 2 rounds) | `reading.md` notes |
| 8 | `node tools/dream-rooms/bake.mjs <id>` | `out/world-v<N>.glb`, `out/stills/*.webp` |
| 9 | `node tools/dream-rooms/push.mjs <id>` (or `--fail "<reason>"`) | status `rendered` |

Target: under 30 minutes per dream.

## Checks

| check | what |
| --- | --- |
| `node tools/dream-rooms/check-contracts.mjs` | both contracts accept the samples and reject broken mutations; the teleport map; rows; the corridor world |
| `node tools/dream-rooms/api-check.mjs` | every route 404s without the password; a wrong password is slow; signed URLs expire; `raw_text` frozen after read; night renumbering; split invariants; purge leaves nothing |
| `node tools/dream-rooms/page-check.mjs` | capture at 390 px, the list, the dream page in every status, enter/walk/wake, the corridor (order, night breaks, door states, tap a sign → dream → wake at that door), the empty state, deep links, zero console errors, screenshots |
| `node tools/dream-rooms/check-world.mjs <dir> --must-keep tools/dream-rooms/samples/must-keep.json` | the self-test's must-keep list |

## Files

```
src/dream-rooms/
  CONTRACTS.md            the shared contracts (row, API, dream.json, world.json, geometry, GLB, corridor, viewer)
  contracts/              dream.schema.json, world.schema.json, validate.js (the one validator),
                          layout.js (geometry), dims.json (numbers shared with Blender), rows.js,
                          spans.js, corridorWorld.js, fixtures/
  DreamRoomsApp.jsx …     the pages (capture, corridor, list, dream), lib/ (api, outbox, idb)
  viewer/                 the three.js viewer (DreamStage) for dreams and the corridor
workers/dream-rooms.js    /api/dreams/* (R2 rows + files, signed URLs, the password)
tools/dream-rooms/
  pull / quote-spans / check-dream / check-world / split / build / bake / push .mjs
  capture.mjs             types a text file into the real /dreams/new headlessly (self-test only)
  seed-local.mjs          9 fictional dreams over 5 nights into wrangler dev's local R2 (refuses any non-local API)
  dev-viewer/             a vite harness for the viewer + check.mjs (no API needed)
  lib/                    api.mjs (Node client), work.mjs, blender.mjs, frames.mjs
  blender/                the headless kit (KIT.md), corridor_kit.py → public/dreams/corridor-kit.glb
  samples/                the fictional sample + must-keep, the night fixtures, adversarial samples
  RUBRIC.md, DECISIONS.md
.claude/skills/dream-render/SKILL.md
```

## Before the first deploy

1. `npx wrangler r2 bucket create dream-rooms` (the binding is in `wrangler.jsonc`: a deploy fails until the bucket exists).
2. `npx wrangler secret put DREAMS_PASSWORD` and `npx wrangler secret put DREAMS_SIGNING_KEY`.
3. Commit, then deploy the Worker from a clean worktree of committed `main` before pushing anything that depends on it.
4. Confirm production R2 has no fixtures (`seed-local.mjs` refuses any non-localhost API).
