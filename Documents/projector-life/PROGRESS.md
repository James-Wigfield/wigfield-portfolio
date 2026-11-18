# Projector Life — progress log

Brief: `Documents/temp/prompt-dumping/build_projector_life_visualiser.md` (main checkout, untracked).
Worktree: `.claude/worktrees/projector-life`, branch `feat/projector-life`. Dev server: `npx vite --port 5191 --strictPort`.
Contracts: `src/components/portal/modules/projector-life/CONTRACTS.md`. Decisions: `…/DECISIONS.md`.
Checks: `node tools/projector-life/room-check.mjs` · `projection-check.mjs` · `sim-check.mjs [--quick]` · (QA) `page-check.mjs`, `shots.mjs`, `soak.mjs`.

## Done
- 2026-11-18 lead: worktree + npm ci; GLB measured (CONTRACTS §1); `room/roomModel.js` reference; `params.js` schema; `engine/Stage.js`; stubs; registry entry + `projector` icon. (`c770345`)
- Room agent: GLB + pointed roof + measured masks + landing heightfield + views + cutaway + aids + pick; room-check 143/143. (`50739fd`)
- Projection agent: projectors, light on paint, shadow maps, coverage view + readout, pixel view, raw/mapped, both insets; projection-check 41/41. UI agent: shell, tabs, generated controls, presets, MCP preview, Plan + Applications, merger-plan.md. (`b6a924a`)
- Life agent: shared seam grid, GS rain, Physarum geotaxis + seams, Particle Life grip, Lenia, Plate VII creatures + selection; sim-check 18/18 quick (19/19 full). Lead: Lenia keys, Stage `onValues`, dispose on failed init. (`05e3c38`)
- Lead: hero tuning (searched SE pose, darker room, brighter projectors), stage fills the viewport on open (`e4717a6`); measured coverage + build lessons into the Plan tab and merger-plan.md (`4c73cc2`).

## In flight
- QA agent: page-check / shots / soak + qa-report.md.

## Next
- Fix QA findings, two fresh-eyes reviewers (visual critic, code reviewer), fix, re-shoot.
- Fill `fps-heavy` in ui/measurements.js from QA numbers.
- Merge to local main if the merge touches none of main's dirty paths; vault + memory + run-report.md.

## Broken / watch
- Main checkout dirty paths at start: `Documents/temp/prompt-dumping/*` (13 deletions) + untracked `Documents/memory-rooms/prompt-dumping/edit-spot-details.md`, `Documents/temp/prompt-dumping/build_projector_life_visualiser.md`. The branch touches none of them (verify before merging).
