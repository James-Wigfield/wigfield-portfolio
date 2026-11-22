# Handover: 12B Fletcher St after pass 2 (2026-11-22)

Pass 2 (exterior fixes + outside details) is **done and live**. Next up is pass 3 (merge The Batcave), brief:
`Documents/memory-rooms/prompt-dumping/render-12b-fletcher-pass3-batcave.md`.

## Where things stand
- **Live:** https://jameswigfield.com/memories/b/001c25b7-a2bd-4d71-a476-739b941f8f69. Plan v3, status rendered, both
  level GLBs + exterior + hero + marker uploaded. `live-shot.mjs`: all four stages ready, no page problems.
- **Worker redeployed** (James approved): version `4eba4b3d-8e5c-4f7f-b4c5-39ea81563385` = the previous live
  `aa45ffe` + the new schema/validator. Live ping: `features: ["buildings"]`.
- **Nothing is committed.** The deployed Worker runs validator code that only exists in the working tree, so commit
  before starting pass 3 (suggested message: `memory rooms: 12B Fletcher exterior passes 1-2 (DECISIONS 178-188)`).
- Checks: `check-contracts` **288/288**, `building-selftest` **26/26**.

## Uncommitted files (passes 1 + 2)
| File | What changed |
|---|---|
| `src/memory-rooms/building/building.schema.json` | optional `wall.outside.rake` / `.panels[]`, stair `finish` / `walls` / `wallColor`, fence kind `sheet`, `site.features[]` |
| `src/memory-rooms/building/validate.js` | unique feature ids; a panel must fit its wall |
| `src/memory-rooms/CONTRACTS.md` | §6.2 documents the new fields |
| `tools/memory-rooms/blender/build_building.py` | outdoor-room slab, `build_stair` (solid flight, raking walls, boolean cut), panels + rake, garage door, `site_feature`, sheet fences, stacked areas (+ pass 1: outside finishes, rakes, fascias, fences, trees) |
| `tools/memory-rooms/blender/shell_v2.py` | `wall_slab(..., bands=)` for face-only panels (+ pass 1: per-face materials) |
| `tools/memory-rooms/blender/building_io.py` | Python mirror of the validator additions |
| `tools/memory-rooms/check-contracts.mjs` | a valid house with every new field + 11 broken cases |
| `tools/memory-rooms/building-selftest.mjs` | pass 1 only (storey bounds allow a skillion rise) |
| `tools/memory-rooms/DECISIONS.md` | 178–182 (pass 1), 183–188 (pass 2) |
| `.claude/skills/memory-render/SKILL.md` | "Learned on 12B Fletcher" notes |

Untracked and probably staying out of git: `Documents/memory-rooms/assets/` (builder PDF, HEICs, photo JPEGs) and
the `prompt-dumping/` briefs.

## The work folder (git-ignored): `memory-rooms-work/b-001c25b7-a2bd-4d71-a476-739b941f8f69/`
- `trace.py` is the **source of truth**: edit it, then `python trace.py` writes `building.json`. The pass 1 version is
  kept as `trace.pass1.py`.
- `compose.py <work> <round> <samples> [cam,cam]`: Cycles renders from the photo positions. Default cameras: p1, p2,
  p3 (porch), p5, p6 (stair), p9, p10 (courtyard). `x-under-bal`, `x-stair-top` and `x-mp-strip` are inspection views
  that only render when named. Then run `sheet.py <work> <round>`.
- `glbview.py`: the baked GLBs, unlit as the viewer shows them (`GLBSHOTS` / `GLBLENS` env vars).
- `live-shot.mjs`: screenshots the live page's four stages into `compare/live-*.png`.
- Pass 2 outputs: `compare/house-p2r1..3*`, `compare/glb-p2*`, `compare/live-p2.jpg`, `build-pass2.log`.

## Commands
```
node tools/memory-rooms/build-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --no-bake --samples 24   # quick, ~7 s
node tools/memory-rooms/build-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --samples 128            # full bake, ~17 min
MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=memories \
  node tools/memory-rooms/push-building.mjs 001c25b7-a2bd-4d71-a476-739b941f8f69 --live                  # add --rooms once a room is furnished
node tools/memory-rooms/check-contracts.mjs
node tools/memory-rooms/building-selftest.mjs                                                            # ~7 min
```

## Gotchas learned in pass 2
- **A contract addition needs a Worker deploy before `push-building --live`.** The Worker validates a pushed plan with
  its bundled schema and refuses unknown fields. The plan is written first, so a refused push uploads nothing.
- **Don't split a wall at a node to place cladding.** An opening must clear half the other wall's thickness even at a
  straight joint, which leaves a white strip. Use `outside.panels[]` instead.
- **Elevations decide finishes.** The plan chain says where a panel sits; A.06 says how tall it is (the 990 panel only
  runs 39c..63c). Check every clad face against the elevations AND a photo: pass 1 had the box's west face reversed.
- **Plants render pale in Cycles.** Pick colours a notch darker than the photo (#4d5a47 grey-green, #2b3f26 leafy).
- Bash heredocs with nested quotes fail here: write patch scripts with the Write tool, then run them.
- Blender: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. PyMuPDF was installed into the session
  scratchpad (`pip install --target <scratchpad>/pylib pymupdf`), so reinstall it if you need the PDF again.

## Still off (not blocking pass 3)
- Plants are stylised blobs and the magnolia is a smooth oval (trees have no colour or shape field).
- The bluestone path renders as tidy pavers, not crazy paving.
- Not modelled: the balcony's glass balustrade and black slat screen, and the beams under the balcony roof.
- Windows can't wrap a corner (an opening stops at the corner's inner face).
- **Exposure gap (DECISIONS 182):** level walls bake mid-grey while exterior-baked features (the porch canopy) bake
  bright white. The garage door bakes near-black navy and its fine ribs disappear at atlas resolution.
- The roof colour is still a guess (no photo shows it).

## Pass 3 notes
- The external stair now cuts the MP's west and back walls and its ceiling down to the stair's underside. Over the MP
  strip (x 1.23–1.74, z 0.95–2.90) the stair's east side wall comes down to that underside as a white bulkhead. The
  Batcave's kitchen / under-stair pieces must fit under it: drop or shorten the old under-stair rake piece.
- `james-dungeon` inner faces: x 1.23–8.56, z 0.954–5.964, ceiling 2.743. The back piers stand outside the MP back
  wall (z 0.004–0.704) and don't affect the room.
- Furnishing a room means `push-building --live --rooms`, and its slice must go to the spot (`push.mjs`).

## Records
- Vault: `03-Dev-Logs/2026-11-22-memory-rooms-12b-fletcher-pass2.md`, `01-Active-Projects/memory-rooms.md`.
- `tools/memory-rooms/DECISIONS.md` 183–188.
- Memory: `project_memory_rooms.md` (pass 2 line).
