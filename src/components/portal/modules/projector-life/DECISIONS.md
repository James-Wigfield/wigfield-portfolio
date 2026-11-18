# Projector Life — decisions made unattended

One line each: the call, then why. Newest at the bottom of each section.

## Setup (lead)
- Worktree via EnterWorktree at `.claude/worktrees/projector-life` (ignored by `.git/info/exclude`), branch renamed to `feat/projector-life`. — the brief's preferred route; the folder is already git-ignored.
- The main checkout's dirty paths at start were only `Documents/temp/prompt-dumping/*` deletions and two untracked prompt files (not package.json as the brief expected). — recorded so the final merge check compares against the real list.
- Plain three.js, not R3F. — one imperative engine owns the loop, custom shaders and render targets, and teardown is explicit (renderer.dispose + forceContextLoss), which is what the leak test needs.
- World frame = the GLB's own frame (no recentring). — furniture, loft and the measured numbers all stay in one frame; `SHED.centre` = (2.18, 0, 2.18).
- Patch frames are right-handed about the inward normal, polygons CCW. — every shared edge is walked in opposite directions, so a seam map is a pure rotation + translation (verified: 64 seams, world error < 1e-14).
- The cap of the old roof lives in the `ceiling` node (the `obj__octagon` node is empty). — hiding `ceiling` removes the whole old roof.
- Loft deck = floor-type patch with no seams. — its edges meet walls mid-height, not edge to edge; creatures reach it by falling.
- Engine is a dynamic import from the shell. — three.js and the sims only download when the tab opens.
- Projector-output inset is drawn inside the same WebGL canvas (scissored viewport); the net inset is a DOM 2D canvas. — no second WebGL context, no GPU readback per frame.
- Dev server for the worktree on port 5191 (`npx vite --port 5191 --strictPort`).
