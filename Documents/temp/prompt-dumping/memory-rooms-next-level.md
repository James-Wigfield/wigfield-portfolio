# Memory Rooms · next level: build it, unattended

You are working in `C:\Users\james\Documents\personal-projects\wigfield-portfolio` on the `/memories` tool
(Memory Rooms). James has approved a plan and left the computer. **Work unattended from start to finish.
Never stop to ask, never wait for confirmation, never end your turn early with "should I continue?".**
When something is unclear, make a sensible call, write it in `tools/memory-rooms/DECISIONS.md` (decision,
why, how to change it, numbered after the last entry, currently 96), and keep going. Anything that truly needs
James goes on a checklist in your final message.

## 0 · Read first (in this order)

1. `CLAUDE.md` (repo) and the Obsidian vault project note
   `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md`.
2. **The plan:** `C:\Users\james\Documents\james-claude-brain\03-Dev-Logs\2026-11-21-memory-rooms-next-level-plan.md`.
   This is the spec. Follow it, including its phase order.
3. **The visual target:** `src/components/portal/modules/memory-rooms-plan/NextLevel.jsx` + `next-level.css`
   (portal tab `/portal/memory-rooms-plan/next`). It's a rough mock of the "Recall" look and the building
   ideas. Match its spirit, but build it properly in the real tool.
4. `src/memory-rooms/README.md`, `src/memory-rooms/CONTRACTS.md`, `src/memory-rooms/scene/scene.schema.json`,
   `tools/memory-rooms/README.md`, `tools/memory-rooms/DECISIONS.md`, `tools/memory-rooms/blender/kit/README.md`,
   `.claude/skills/memory-render/SKILL.md`.
5. The auto-memory files under
   `C:\Users\james\.claude\projects\C--Users-james-Documents-personal-projects-wigfield-portfolio\memory\`,
   especially `project_memory_rooms.md`, `feedback_no_ai_callout_styling.md`,
   `reference_wrangler_dev_orphans.md` and `reference_headless_soak_kit.md`. They hold gotchas that cost hours.

## 1 · What to build (priority order; the USA trip starts 16 Dec 2026)

Capture happens on the trip and rendering happens after it, so the phone-side work comes first. Finish and
verify each phase before starting the next, and commit at the end of each phase. If you run out of road, stop
at a clean, committed, green phase boundary.

**Phase 0 · Contracts (do this before any feature code)**
- `building.json` v1: levels; a per-level wall graph (nodes + walls with thickness/height/exterior, shared walls
  once); rooms as polygons with linked spotIds; openings on wall ids; stairs; a roof generated from the exterior
  outline (gable / hip / skillion / flat); a site (lot, ground finishes, drive, paths, pool, fences, trees);
  `geo` (origin lat/lng + true-north angle). JSON Schema + a JS validator + a Python mirror, the same pattern
  as `scene.schema.json` / `validate.js` / `scene_io.py`.
- scene.json **v2**: `shell.outline` (polygon) + ceiling shape (flat / gable / pyramid / skillion), and
  `shell: { building, room }` for a room inside a building. **v1 scenes must keep validating and rendering
  unchanged.**
- GLB walls as `wall__<id>` with their outward normal in glTF extras; the old `wall_<side>` names map to normals.
- Document all of it in `CONTRACTS.md` (new section) first, then code.

**Phase 1 · The "Recall" design pass on /memories (all pages: map, spot, group, capture, edit, walk, AR)**
- Recall load: sample `map.glb` (loads first) into a coloured point cloud (`MeshSurfaceSampler`), then condense
  into the solid `room.glb`. Reduced motion: a plain crossfade.
- Title block on the 3D stage (sheet number, place, date, live scale bar, north arrow that turns with the orbit).
- Drafting-grid ground instead of the grey ellipse; pins as numbered leader-line callouts; thin ink photo
  frustums with the thumbnail on hover.
- Instrument Serif for titles + the note only (add it to the existing Google Fonts link in `index.html`); the
  note as a pull-quote "— James". Mono labels and grotesk body stay.
- Map list as a numbered index (`No. 001`) with the `marker.png` cut-outs; a trip day strip (16 Dec → 15 Jan)
  that filters and scrubs.
- View Transitions map → spot and spot → walk; phone: full-bleed stage + bottom-sheet panel, a lighter header.
- Darkroom dark mode; night spots (`style.mood`) open on the dark stage.
- Rules: tokens first in `memory-rooms.css`, every word in `copy.js`, no coloured left-border callout boxes and
  no filled pills (status = labelled dot on ruled layouts), light + dark, works at 390 px with no sideways scroll.

**Phase 2 · Capturing a whole place (phone side)**
- API + storage for buildings: Worker routes, the local row store, `supabase/memory_buildings.sql` (write the
  file; **do not run it against the real Supabase**), spots gain `buildingId` + `roomId` (`frameGroup` stays as
  legacy). Update `api-check.mjs` and the pgrest stub.
- Capture: a new first choice "A whole place" → name + location → floor plan photo (optional) → exterior shots
  → a **room checklist on the plan** that fills in as rooms are captured (each room uses the normal shot guide).
- A phone **sketch plan** for places without a floor plan (drag rooms on a grid, label, rough sizes) at
  `/memories/b/:id/plan`. It has to work offline through the outbox like the rest of capture.

**Phase 3 · Polygon shells + the plan cut (helps today's single rooms too)**
- Blender `shell.py` builds any polygon outline + ceiling shape. Prove it by re-expressing the octagon shed and
  the gable warehouse as v2 parameters, without their bespoke scripts, in a LOCAL work copy.
- The viewer hides walls by normal (any shape) and gains a **plan cut**: a clipping plane at 1.2 m, back faces in
  the flat section ink. Update the walk grid and AR for v2 shells.

**Phase 4 · Building pipeline (render side)**
- Floor-plan tracing step for the skill: plan image → `building.json`, plus `plan-check.mjs`, which overlays the
  traced walls on the source image (the plan's compare loop).
- `build_building.py`: walls once from the graph, openings, floors, ceilings, stairs, roof, site; each room's
  objects dropped in; one Cycles light solve per level, an atlas per room; outputs `level-<n>.glb` +
  `exterior.glb` (+ hero, marker, map model). Extend `bake.mjs` / `push.mjs`. Update the `memory-render` skill
  with a "render building X" path.
- **Self-test:** there is no real floor plan yet. Make a synthetic 2-level house (`building.json` → draw its plan
  as a PNG → trace it back blind → compare against the truth), like the existing synthetic room self-test.
  Report the errors in the tools README.

**Phase 5 · The building page + whole-house walk**
- `/memories/b/:id`: outside view → lift the roof → plan cut → stacked levels → tap a room to fly in (its memory
  in the panel) → walk the whole house (per-level grids joined by stairs; the walk Durable Object keyed by
  building). The map stands the building at its true orientation and scale past zoom 17. AR tabletop of the
  whole house with the roof lifted. `/memories/group/:group` keeps working.

**Phase 6 · Extras (only if everything above is green)**
Voice memories (`audio` media type, plays near its pin in walk mode), real sun from lat/lng + capturedAt,
postcard video export (canvas `MediaRecorder`), trip chapters via `tripStopId`.

## 2 · Hard limits (unattended safety)

- Commit to `main` locally (James keeps Memory Rooms on main), one commit or more per phase, with clear
  messages. **Do not push, deploy (`wrangler deploy`), run SQL against the real Supabase, or write to the live
  site** (`https://jameswigfield.com`). There is no live password in this session; don't look for one.
- Don't delete or rewrite real spot work folders in `memory-rooms-work/<id>/`; copy them to a new folder to
  experiment. Never `git reset --hard`, force anything, or skip hooks.
- Mapbox: every `new Map()` is a billed load (5,000 a month on the trial). Keep ONE map per page, and don't run
  `page-check.mjs` more than about 6 times in total (it costs ~11 loads each). For styling iterations use
  `?map=atlas`, which is free.
- Don't spend PixelLab credits.
- Don't touch other portal modules or the global stylesheet. Memory Rooms stays portable (no imports from
  `src/components/portal/`, no `@react-three/*`, React only owns the plain three.js classes' lifecycle).

## 3 · How to run and check it

- Local loop: `npm run build` → `npx wrangler dev --port 8788` (run_in_background; **restart after every
  build**; port 8787 belongs to another project; local password `trip-local`). Use a clean store for page-check
  (`--persist-to .wrangler/state-pc` + `seed-dev.mjs --examples-only`). For the real room shapes use another
  store: `--persist-to .wrangler/state-walk` already has them seeded (`dev/seed-real-rooms.mjs`).
  HMR alternative: `API_PROXY=http://127.0.0.1:8788 npx vite`.
- Stopping wrangler with TaskStop leaves node/workerd holding the port. Free it by PID (PowerShell
  `Get-NetTCPConnection -LocalPort 8788`).
- Headless browser: puppeteer-core + local Edge (`tools/memory-rooms/dev/lib.mjs`, GPU flags in
  `page-check.mjs`). Write scripts longer than a few lines with the Write tool; Bash heredocs strip backslashes.
  Use `MSYS_NO_PATHCONV=1` for curl paths in Git Bash.
- Blender: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` (env `BLENDER`). A bake takes ~4 min per
  room; always run `blender/preview_glb.py` after a bake (decal faces facing the wrong way bake black).
- **Every existing check must stay green at the end:** `api-check`, `check-scene` on all examples, the synthetic
  self-test, `page-check` (it spawns `ar-check`, `fly-check`, `walk-check`, `walk-mp-check` and the edit walk),
  `dev/capture-check.mjs`, `dev/map-check.mjs`, `tools/memory-rooms-plan/page-check.mjs`, and `npx eslint` on
  everything you touched. Add new checks for every new feature (building API, capture of a whole place, sketch
  plan, plan cut, building page, building walk), in the same style.

## 4 · Use subagents to check your work

Spin up subagents whenever it helps accuracy, and at least these:
- **After Phase 0:** a fresh agent that reviews the contracts against the plan and against the existing v1
  data, hunting for anything that would break existing spots or the Blender ↔ viewer coordinate agreement.
- **After each phase:** an independent reviewer that gets the diff, not your conclusions, and looks for
  correctness bugs. Fix what it confirms.
- **A "does it actually work" tester per phase:** it drives the real app in headless Edge on desktop (1440) and
  phone (390, touch), light and dark. It takes screenshots, clicks through every new flow (capture a whole place
  offline then online, sketch a plan, open the building, lift the roof, plan cut, walk between rooms and up the
  stairs) and reports what's broken or ugly with screenshot paths.
- **A design critic for Phase 1:** compare screenshots of the restyled pages with the mock tab and the plan's
  design rules (no callout boxes or filled pills, one serif only for titles + note, calm paper/ink). Iterate
  until it has nothing real left to say.
Keep agents focused on one job each. Don't trust a "looks good"; ask for evidence (check output, screenshots).

## 5 · Write it down as you go

- `tools/memory-rooms/DECISIONS.md` for every call you make; `CONTRACTS.md` and the READMEs kept true.
- Obsidian vault (per CLAUDE.md): a dev log `03-Dev-Logs/2026-11-2X-memory-rooms-<topic>.md` per phase, with
  [[wikilinks]] to [[memory-rooms]], [[three.js]], [[Blender]], [[Mapbox]]; update
  `01-Active-Projects/memory-rooms.md`; an ADR in `02-Architecture/` for `building.json` + scene v2 (next number
  after ADR-008).
- Update the auto-memory file `project_memory_rooms.md` with the new facts, routes and gotchas (keep it concise).

## 6 · Final message (James reads this when he's back)

- What's done per phase, with commit hashes, and what's not done.
- Every check, with its pass count (light + dark), and anything still failing, with the output.
- Screenshot paths of the new pages (desktop + phone).
- New DECISIONS entries, one line each.
- James's checklist: run `supabase/memory_buildings.sql`, deploy order (Worker first, then
  `backfill-map-assets.mjs --live` if needed), a real-phone test of whole-place capture before 16 Dec, his
  house's floor plan for the pilot ("render building <id> using the floor plan at <path>").
