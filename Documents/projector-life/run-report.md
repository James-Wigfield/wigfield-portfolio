# Projector Life — run report (2026-11-18, unattended)

## What was built, and how to open it

A new portal tab **Projector Life** (`/portal/projector-life`, Personal group, right after Artificial Life; icon = a projector throwing a cone). Run `npm run dev` and open `http://localhost:5173/portal/projector-life`. The Artificial Life tab is untouched.

- **Visualiser** (opens first, already alive in ~2 s): the She'd from Memory Rooms in 3-D with a **new pointed 8-facet roof** (apex slider 2.7–4.2 m, pitch shown), life running on 18 surfaces (8 walls, 8 roof facets, floor, loft deck), lit by 1–3 virtual projectors. The page glides so the stage fills the viewport under the portal header.
  - Stage toolbar: play/pause, step, reseed, clear, save PNG, reset, fullscreen; six one-click views (cutaway ¾, door, armchair, loft looking up, projector's eye, plan); click a surface to seed life there.
  - Insets: **what projector N actually outputs** (the pre-warp) and **the room, unfolded** (the patch net with the sims running flat and the seams drawn).
  - Panel generated from `params.js`: Room, Projectors (pose, throw with "typical" buttons, aspect, brightness, black level, frustum, coverage view + readout, occlusion, pixel-size view, a drag-the-projector plan), Mapping (mapped/raw, masks, a clickable region map), Life, Creatures (census + trait histograms per surface), Visual aids. 7 presets.
  - A **simulated vs illustrated** key under the stage, and the **MCP preview** drawer (42 proposed tool calls that would rebuild the scene on your mate's rig).
- **Plan**: the merger plan — phases 0–6 timeline, architecture diagram, risks (+ what building it taught us), what the visualiser measured, questions for your mate, and "copy the brief".
- **Applications**: 8 animated cards.
- **`Documents/projector-life/merger-plan.md`**: the standalone brief for your mate's Claude Code.

## Merge status

See the end of this file (filled in after the merge step).

## Measured

| | |
|---|---|
| Load to a live render | **1.95 s** cold cache, ~1.0 s warm (headless Edge, d3d11) |
| Frame rate | **146 fps on every preset** — the headless cap. Uncapped: default ≈ 2,100 fps, heaviest (Room food web) ≈ 885 fps. Target was ≥ 45. |
| CPU per frame | ~1.1 ms (sims ~0.7 ms, 3.2 ms per 30 Hz tick) |
| Soak (5 min default + all presets) | fps flat (146.5 → 146.6), sim cost flat, heap +0.12 MB/min |
| Leaks (10 tab cycles, 20 rebuilds) | 1 live WebGL context, every disposed stage garbage-collected, renderer counts unchanged, heap +4 MB |
| Console | 0 errors, 0 warnings |
| Apex drag | ~94 fps (median 7 ms) |
| Coverage, one standard-throw (1.5) projector | at best **8 %** of the shed |
| Coverage, one short-throw (0.5) | at best **35 %** |
| Two short-throw, opposite corners at the eave | **63 %** (roof 88 %, floor 17 %) |
| + a straight-down third | **75 %** (floor 55 %) |
| Roof pitch effect (2.7 → 4.2 m, equal sim time) | Particle Life peel-off −44 %, creature roof falls 16 → 73, swing releases −48 % |

## Checks (all in `tools/projector-life/`)

| Check | Result |
|---|---|
| `room-check.mjs` (patches close the room, seams pair, gravity, masks, flats vs the GLB) | 143 / 143 |
| `projection-check.mjs` (throw → FOV, poses, coverage maths) | 41 / 41 |
| `sim-check.mjs --quick` (no NaN, bounded, budget, seams crossed, drift, geotaxis, falls, pitch, masks, churn, no creep) | 19 / 19 (full run adds the evolution check) |
| `page-check.mjs` (load, fps per preset, presets, roof, seed, PNG, MCP, tabs, leaks, layout 1440/390, reduced motion, broken storage, console) | see "Final page-check" below |
| `shots.mjs` | 76 screenshots |
| `soak.mjs` | flat (above) |
| `npx eslint src/components/portal/modules/projector-life tools/projector-life` | clean |
| `npm run build` | passes |

## How it was built

Lead + 4 build agents in parallel (room, life, projection, UI + plan) against `CONTRACTS.md`, then a QA agent, a fresh-eyes code reviewer and a fresh-eyes visual critic; every finding fixed and re-checked. Decisions made unattended: **`src/components/portal/modules/projector-life/DECISIONS.md`** (one line each + why). Progress log: `Documents/projector-life/PROGRESS.md`. QA report: `Documents/projector-life/qa-report.md`.

Notable catches:

- The reviewer found that every tab switch leaked a whole Stage. OrbitControls hangs a keydown listener on `document`, and React detaches the DOM before effect cleanups run, so `controls.dispose()` missed it. Fixed and verified collected.
- Turning the loft off and then picking a preset froze the stage. Fixed, and it's in sim-check now.
- QA's soak caught the roof's Particle Life creeping from 2k to 5k particles (tick 3 → 13 ms). The total is now capped, with a regression check.
- The critic made the presets better: mounted projectors, a coverage view that dims the room instead of flooding it maroon, darker rooms and warmer palettes, and a swingers preset you can actually read.

## Approximate or unfinished (honest list)

- **Gaits are hand-written** (crawl, insect stepping, pendulum swing); selection only tunes numbers (feet, grip, mass, swing, flight). With 10–15 creatures per surface, grip separates by habitat reliably; mass and swing drift with the random seed. The real Plate VII (Plan, phase 4) evolves the gaits.
- **Ceiling swingers runs with selection off**, so immigrants keep the roof populated and the falls are a steady show. With selection on, a low-grip steep roof empties.
- **Projector model**: centred lens (no lens shift), typical throw ratios (not your mate's lens), light fall-off is a plausible model, not photometry. The "Projector's view" camera stays upright at the canvas aspect; the output inset is the exact image.
- **Room look** is the Blender bake from Memory Rooms; wall albedo is estimated from it. The new roof's colour is sampled from the old roof's bake, flat between the hips.
- **Loft deck has no seams** (creatures reach it by falling). Clicking the loft's bags doesn't seed (they're "furniture" to the ray).
- The default cutaway uses one projector, so the floor under the loft stays dark; that's physics (the deck shadows it), and the Plan says so.
- Not pushed, not deployed.

## Screenshots

`Documents/projector-life/screenshots/` — every preset × {arcade (dark), jade (light)} × {1440, 390}, coral once, stage-only hero shots (`stage-NN-*.jpg`), the Plan and Applications tabs, the MCP drawer; `soak/` and `page-check/` hold the raw numbers.
