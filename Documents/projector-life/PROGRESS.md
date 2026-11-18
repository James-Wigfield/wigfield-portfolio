# Projector Life — progress log

Brief: `Documents/temp/prompt-dumping/build_projector_life_visualiser.md` (main checkout, untracked).
Worktree: `.claude/worktrees/projector-life`, branch `feat/projector-life`. Dev server: `npx vite --port 5191 --strictPort`.
Contracts: `src/components/portal/modules/projector-life/CONTRACTS.md`. Decisions: `…/DECISIONS.md`.

## Done
- 2026-11-18 lead: worktree + npm ci; GLB measured (CONTRACTS §1); `room/roomModel.js` reference (18 patches, 64 seams, gravity verified in Node); `params.js` schema; `engine/Stage.js`; stubs for room/life/projection + shell; registry entry `projector-life` + `projector` icon. Stub page renders the GLB at ~180 fps headless.

- 2026-11-18 lead: scaffold committed (`c770345`); `npm run build` passes with the scaffold.

## In flight
- Launched in parallel (background subagents, no commits by them; lead commits by explicit path): Room agent (room/ + tools/projector-life/room-check.mjs), Life agent (life/ + sim-check.mjs), Projection agent (projection/), UI + Plan agent (ProjectorLife.jsx, css, ui/, presets.js, params labels, merger-plan.md). Each writes `<folder>/NOTES.md` with decisions → lead merges into DECISIONS.md.

## Next
- Integrate, QA agent (page-check, shots, soak), two fresh-eyes reviewers, fix, re-shoot; merge to local main if clean; vault + memory + run-report.

## Broken / watch
- (none yet)
