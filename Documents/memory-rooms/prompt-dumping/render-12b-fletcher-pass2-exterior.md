# 12B Fletcher St, pass 2: exterior fixes + outside details

Use the `memory-render` skill ("Whole places: render building X"). Work in `C:\Users\james\Documents\personal-projects\wigfield-portfolio` against the **live** site: `MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=memories`, and `push-building.mjs … --live`. First read:
- the vault note `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md`;
- the dev log `03-Dev-Logs/2026-11-22-memory-rooms-12b-fletcher-exterior.md`;
- `tools/memory-rooms/DECISIONS.md` 178–182.

## Where things are
- Building `001c25b7-a2bd-4d71-a476-739b941f8f69`, live at `/memories/b/001c25b7-…` (plan v2).
- Work folder `memory-rooms-work/b-001c25b7-a2bd-4d71-a476-739b941f8f69/`:
  - **`trace.py`** is the source of truth: it writes `building.json`. Edit trace.py, never building.json by hand.
  - `compose.py` + `sheet.py`: Cycles renders of the whole house from the photo positions → `compare/house-<round>.jpg`.
  - `glbview.py`: the baked GLBs, unlit as the viewer shows them. Set cameras with the `GLBSHOTS` / `GLBLENS` env vars.
  - `live-shot.mjs`: screenshots of the live page's four stages.
  - `bake-day/`: the earlier day-mood bake (for reference only).
- Sources are in `Documents/memory-rooms/assets/`:
  - `12b-Fletcher-Plans.pdf`. It's vector: read dimensions with PyMuPDF (`pip install --target <scratchpad>/pylib pymupdf`). Pages: A.03 = p3, A.04 = p4, A.05 = p5, A.06 = p6, A.19/A.20 = p18–20. Frame: x = 0 at the left of "9,990 OVERALL", z = 0 at the back of "34,290 OVERALL", 28.3465 pt/m.
  - `outside-jpg/` and `photo-notes.md` (lens per photo).
- Kit: `tools/memory-rooms/blender/build_building.py` (+ `shell_v2.py`).

## Scale and layout are right: don't re-trace. Fix and add these, all in ONE rebuild
1. **Balcony ↔ ground floor gap.** The balcony is a single floor plate with no slab, so from below you see through between the GF wall top and the balcony upstand.
   - Kit: give rooms on an upper level that lie outside its exterior loop (outdoor rooms, the balcony) their own slab: white render edge and underside, same thickness as the level's slab.
   - Data: add the **two back piers** (A.04, z 0.004–0.704): west x 1.74–2.19, east x 7.99–8.79. Put them on both levels, rising to the roof (rakes). Run the balcony upstand between the piers and start the balcony's east wall at the east pier.
2. **External stair.** Photos 5–6: charcoal tile treads and risers (~`#5a5c5f`), solid concrete, solid **white rendered raking walls on both sides** (0.19 thick, about 1 m above the nosings).
   - It is NOT timber; today the kit always tints its timber material.
   - The plan has the flight's upper half climbing **over** the Multi-Purpose west strip ("190w raking bwk over stairs", "skimcoat to u/side of stairs inside multi-purpose", "external cavity bwk to underside of external stairs"). The MP west wall (`g-mp-w`) and back wall (`g-mp-n`) currently poke up through the treads.
   - Kit: stairs get an optional `finish` (timber | tile | concrete | steel) and `walls` (none | left | right | both, + colour). Walls on the `from` level inside a flight's footprint are cut to the stair's underside (a boolean or bisect within the footprint only).
   - The internal stair stays a floating timber stair.
3. **Garage door.** Measured from photos 1–2: dark **navy** Colorbond, `#171e27`–`#1d2226` in sun (use ~`#222b38` so the bake doesn't crush it). Fine horizontal ribs about every **0.17 m**, not 4 coarse ribs. It sits near-flush with a white reveal. Fix the kit's garage panel (rib pitch) and the colour in trace.py.
4. **Timber cladding on the master box** (photos 1–2, A.05 bottom chain "200 | 3600 WINDOW | 990 | 1200"):
   - The panel is the **990, hard against the window** (x ≈ 6.6–7.59). The 1200 to the corner is white. Today it's rendered the wrong way round, with a white gap between the window and the panel.
   - The raking band between the box top and the roof (the rake) is **timber** across the front, in both photos.
   - Check the box's west face against photo 1 and A.06 Elevation 1/2 (cladding hatch) before assuming.
   - The rake needs its own finish: propose the smallest contract addition (e.g. `outside.rake: {finish, color}`), then add it to both validators.
5. **Courtyard** (photos 9–10), x 5.39–10.01, z 14.49–20.10. Areas draw in order, later on top:
   - a dark mulch garden bed over the whole courtyard;
   - a grey **bluestone crazy-paving path** (~1.1 m wide) along the passage wall from the alfresco to the store;
   - about **6 round sandstone stepping stones** (Ø ~0.6 m, cream ~`#d8d0bd`) on the curve the photos show;
   - the magnolia (tall, narrow, bronze-green, ~4.5 m) in a **round black steel ring planter** (Ø ~1.8 m, ~0.45 m high) near the fence;
   - a few shrubs and leafy groundcover;
   - the black Colorbond fence on the east boundary.
6. **Front garden + letterbox** (photos 1–3):
   - lawn;
   - mulched beds with clipped grey-green shrub balls along the path and drive;
   - the Japanese maple beside the path;
   - the entry path as **large pale rectangular concrete stepping pavers** interleaved with sandstone crazy paving, stepping up toward the porch;
   - a low white rendered retaining wall along the west side;
   - the black pergola beams over the porch (photo 3).
   - **Letterbox:** a long black rectangular planter/letterbox block (~2.0 × 0.5 × 0.9 m) beside the drive near the front boundary, white "12B" numerals and a slot on its face, silver-leaf succulents planted on top. The exposed-aggregate drive should read as light speckled concrete.
7. **The kit has no site objects** (only areas, fences, trees).
   - Propose the smallest clean addition (e.g. `site.features[]`: `{id, kind: box | cylinder | ring | disc | shrub | letterbox, at, size, rotY, color, finish}`), built in `site_mesh` into exterior.glb as `site__<id>`.
   - Keep the area / stair / site fields **optional**: every existing building must stay valid.
   - Update `building.schema.json`, `validate.js` and `building_io.py` together. `check-contracts.mjs` must pass (add a broken-mutation case per new field), and so must `building-selftest.mjs`.

## Decisions already made (James)
- The optional schema additions above are approved.
- Keep `style.mood: "overcast"` (level bakes are exposed for interiors; see DECISIONS 182).
- No photo shows the roof: keep the dark Colorbond guess.

## Loop
- Build quick with `node tools/memory-rooms/build-building.mjs 001c25b7-… --no-bake --samples 24`, then run `compose.py` (add cameras for photos 3, 6, 9, 10) and `sheet.py`.
- Compare by eye, **max 3 rounds**, biggest mismatches first. Also check the baked look with `glbview.py` after the final bake.
- Then a full bake (`--samples 128`, ~18 min), then `push-building.mjs 001c25b7-… --live` (no `--rooms`), then `live-shot.mjs`.
- Don't commit. List the changed files at the end.

## Out of scope
- Merging The Batcave: that's pass 3, `render-12b-fletcher-pass3-batcave.md`.
- Furnishing rooms.
- The exterior exposure fix (only note it if you see an easy win).

## Report back (short bullets)
- What changed in the kit and the contract, with check-contracts / selftest counts.
- The compare rounds and what's still off.
- The push results and the live link.
- Update the vault dev log + project note, DECISIONS (next numbers after 182), the memory-render skill's "Learned on 12B Fletcher" notes, and the Memory Rooms memory, per `CLAUDE.md`.
