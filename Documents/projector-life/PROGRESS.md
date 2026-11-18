# Projector Life — progress log

Brief: `Documents/temp/prompt-dumping/build_projector_life_visualiser.md` (main checkout, untracked).
Worktree: `.claude/worktrees/projector-life`, branch `feat/projector-life`. Dev server: `npx vite --port 5191 --strictPort`.
Contracts: `src/components/portal/modules/projector-life/CONTRACTS.md`. Decisions: `…/DECISIONS.md`.

## Done
- 2026-11-18 lead: worktree + npm ci; GLB measured (CONTRACTS §1); `room/roomModel.js` reference (18 patches, 64 seams, gravity verified in Node); `params.js` schema; `engine/Stage.js`; stubs for room/life/projection + shell; registry entry `projector-life` + `projector` icon. Stub page renders the GLB at ~180 fps headless.

## In flight
- Room agent (room/), Life agent (life/ + sim-check), Projection agent (projection/), UI + Plan agent (shell, ui/, css, presets, merger-plan.md).

## Next
- Integrate, QA agent (page-check, shots, soak), two fresh-eyes reviewers, fix, re-shoot; merge to local main if clean; vault + memory + run-report.

## Broken / watch
- (none yet)
