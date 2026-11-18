# room/ — notes (room agent, 2026-11-18)

The She'd as a runtime (CONTRACTS §3) and as a pure patch model (§2).
Check: `node tools/projector-life/room-check.mjs` (143 checks, PASS/FAIL table,
exit 1 on failure). Re-measure the GLB: `… room-check.mjs --write` → `measured.js`.

## Files

| File | What | three.js? |
|---|---|---|
| `index.js` | `loadRoom({ renderer, values })` — wires everything to the contract | yes |
| `loadShed.js` | GLB → unlit baked twins; walls split into 8 flats, old roof into 8 sectors; world triangle soups | yes |
| `roof.js` | the new pointed roof, in-place `setApex()` | yes |
| `fades.js` | cutaway fades (per flat / facet / old sector) | no (duck-typed) |
| `aids.js` | gravity arrows + g_n rings, seam ribbons, labels | yes |
| `pick.js` | patch under a ray | uses the raycaster |
| `roomModel.js` | patches, seams, gravity (lead's reference, extended) | no |
| `measure.js`, `geom2d.js` | measuring the GLB (used by room-check `--write`), 2-D helpers | no |
| `measured.js` | GENERATED numbers from the GLB (deck, door, window, masks) | no |
| `heightfield.js` | `landing()` | no |
| `views.js` | camera views | no |

## Measured (from `assets/she-d.glb`)

* **Flats**: all 8 inner faces at d = 2.180 (mode of the ±1 cm band), spanning x 0…1.806, y 0…2.250; eave = max y of every wall = 2.250; every wall patch corner is a GLB vertex (< 2 mm); no wall vertex beyond the outer face.
* **Loft deck**: y **1.100**; outline (floor-local, x east / y north from the SW bounding corner, CCW) `[[1.148,0.13],[1.998,4.36],[1.277,4.36],[0,3.083],[0,1.277]]`, 5.18 m². Front edge from the SW flat (world 1.148, 4.230) to the N flat (world 1.998, 0). Measured = hull of `obj__loft`'s upward faces at the modal height, clipped to the inner faces (the beam ends poke 9 mm into the N wall and 2 cm into the SW wall).
* **Door** (wall-S local): leaf flush with the inner face at x 0.467–1.338, y 0–2.046 (0.871 × 2.046); lining 0.433–1.373 × 0–2.080 (the brief's 0.94 × 2.08); **mask** (leaf + lining + architrave) **x 0.369–1.437, y 0–2.144**.
* **Window** (wall-NE local): glazed hole x 0.658–1.268, y 0.436–2.039 (centre +0.06 along the flat ✓); **mask** (frame + sill) **x 0.553–1.373, y 0.345–2.125**.
* **Old roof** (`ceiling`): eave ring r 2.3598 at y 2.25, cap at y 2.680 → virtual apex 2.738, pitch 12.6°.
* **Masks** (23): door (wall-S); window (wall-NE); loft: wall-N x 0–0.721, wall-NW / wall-W full width, wall-SW x 0.183–1.806 (all y 0–1.10) + the balustrade end post on wall-SW x 0.103–0.263 × 0–1.89, and the deck footprint on the floor; furniture: floor footprints of armchair, barrel, cabinet, car_seat, chair, duvet, trunk, tub, wheelchair; walls stood against: armchair (wall-N x 1.095–1.806, wall-NE x 0–0.411, y 0–0.859), barrel (wall-N 0.479–1.027 × 0–0.829), chair (wall-S 0.015–0.471 × 0–0.917, wall-SE 1.738–1.806), heater (wall-W 0.553–1.353 × 0.15–0.60).

## Decisions (one line each + why)

1. **Walls split per flat** (8 fade groups, not 4 nodes): each wall node's triangles go to the nearer of its own two flats. — A finer cutaway while orbiting (a flat hides only when the camera is round to ITS outside, not its node-partner's), and each wall mesh maps 1:1 to its patch (`userData.pjl.patchId`).
2. **Old roof split into 8 sectors** the same way and faded per sector. — The old/new roof comparison then works in the cutaway too.
3. **Every split piece has its own material clone** (sharing the atlas texture); materials are never swapped after load; fades change `opacity`/`transparent` only (+ `needsUpdate` when `transparent` flips — `OPAQUE` is a program define in r185).
4. **Fully faded meshes move to `FADED_LAYER` (7), never `.visible = false`.** — `.visible` stays the physical-presence flag (furniture, loft, which roof); the projection's shadow proxies already read it that way.
5. **Cutaway rule**: inside the room (or `room.cutaway` off) everything shows; outside, a wall hides when `out·camDir > 0.18` (dollhouse.js); a roof facet shows only if the camera is **below its plane** (sees the underside) and it is not a near facet. — Far facets read as a tent over the far walls; from above (plan) the roof vanishes by itself.
6. **Roof underside plane passes exactly through the inner wall face's top edge** and continues along its own plane inside the wall slab to an overhang at apothem 2.46. — The 16 mm fascia band hides the junction; no coplanar faces, so no gap and no z-fighting (checked from inside at 2.7 / 3.3 / 4.2).
7. **Top sheet = the same pyramid lifted by (0.03 + 0.1·sin p)/cos p**, plus a fascia at the overhang. — Thick enough to bury the wall's top lip at every pitch.
8. **Hip battens 6 × 2.5 cm, an apex boss (r 7.5 cm) tucked under the apex**; a batten follows the brighter of its two facets. — The old roof's battens, and a tidy junction where 8 battens meet.
9. **Roof colours sampled from the old roof's bake** (atlas along each facet's centre line): eave colours per sector → a common apex colour (169, 150, 124), ±3.5 % per-facet shade, in linear vertex colours. — The roof is unlit, so its colour IS its lit look; flat #efede8 glowed against the night bake. **#efede8 stays the albedo** (`userData.pjl.albedo`) for the projection.
10. **`room.oldRoof`**: patches use the old roof's virtual apex 2.738 (12.6°); the 0.2 m² cap folds into the 8 facets. Moving the apex slider while the old roof shows reshapes the hidden new roof but leaves the patches alone (`patchesChanged: false`).
11. **Masks are measured offline into `measured.js`** (room-check `--write`), not at load. — Zero load cost, deterministic, and `buildPatches()` in Node (life's sim-check) gets the real masks by default; the check fails if measured.js and the GLB drift by > 2 mm.
12. **Door/window masks include their trim** (architrave, frame, sill). — Otherwise life grows in 5–10 cm slivers around them.
13. **Loft masks cover the walls from the floor to the deck top where the deck meets them, the balustrade end post, and the deck's footprint on the floor.** — The under-loft walls and floor are the same "no projector reaches here" space; `map.mask.loft` turns all three off.
14. **Furniture masks**: floor footprint = convex hull for objects standing on the floor (min y < 5 cm; lamp, jacket, heater excluded); a wall mask where an object comes within 8 cm of a flat (its back 25 cm projected onto the wall). — The car seat (12 cm off wall-SW, under the loft anyway) and duvet (11.5 cm off wall-S) don't count.
15. **Heightfield**: 4 cm cells over the bounding square, 8 height layers per cell tagged floor / loft / loft-other / furniture; the loft's mattress and bags (inside the deck outline, ≤ 45 cm above it) count as the **loft** patch, its rail and post tops as furniture. Points outside the octagon are pulled just inside. `local` is in the floor frame for every surface. — 14 ms build, 0.35 µs per query.
16. **Hero cutaway**: bearing 152° (SSE), 6.3 m out, 3.75 m up (≈ 24° down), fov 46. — The default projector throws west, so the loft, the W/NW/N walls and their roof facets are the far side from here. The height drops with the pitch (≥ 1.1 m under the highest far-facet plane: 2.84 m at apex 2.7) so the roof never vanishes, and the view dollies back on portrait canvases (aspect from the renderer at load, then the camera each frame). The plan rises on portrait too.
17. **Door** view: eye 1.6 m in the doorway, target slightly down/left, fov 78 (floor, far walls and apex all in frame). **Armchair**: eye 1.12 m at the chair's back. **Loft**: eye 1.3 m by the W wall between the two black bags, looking up-east at the apex, fov 80.
18. **Aids**: g_t amber arrow (0.6·|g_t| m); g_n ring r = 0.05 + 0.18·|g_n|, green + inward chevrons = presses in, magenta + outward chevrons = peels off, grey dot-ring at 0; seams = cyan ribbons on both sides of every seam, grey outline round the loft (no seams); labels = a dot in the habitat colour + id + type (+ pitch, "(override)") on a dark plate, scaled with distance, hidden within 0.9 m. Aids follow their patch's fade. Built lazily (only when shown).
19. **Pick**: ray vs every shown patch plane from its room side, inside its polygon; null if a visible mesh (furniture, loft, an outer wall/roof face) is hit first and stands > 3 cm off that surface (trims ≤ 2 cm don't block); null inside an active mask.

## API — what `loadRoom()` returns (CONTRACTS §3 + additions)

```js
{
  root, patches /* getter */, landing(x, z, fromY), views, surfaceMeshes, occluders,
  setParams(values, changed) → { patchesChanged }, update(camera, dtMs), pick(raycaster), dispose(),
  // additions
  fadedLayer: 7,           // fully faded cutaway meshes sit on this layer (not .visible = false)
  measured: MEASURED,      // deck, door, window, masks (measured.js)
  roofApex,                // getter: the apex the roof patches use (room.apex, or 2.738 with room.oldRoof)
}
```

* `views.cutaway` and `views.plan` are **getters** (they depend on the pitch and the canvas aspect); door / armchair / loft are fixed.
* `surfaceMeshes` = 8 wall flats, floor, loft, furniture, the 8 new-roof undersides + 8 hip battens + boss, the 8 old-roof sectors (hidden unless `room.oldRoof`). `occluders` = the same list. Glass and the new roof's outside sheet are in neither.
* Every surface mesh carries `userData.pjl = { part, patchId, albedo, object? }` — part ∈ `wall | floor | loft | furniture | roof | roofTrim | roofTop | oldRoof | glass`; `patchId` for walls (`wall-N`…), roof undersides and old sectors (`roof-N`…), floor; `albedo` = paint colour (#cfdad2 walls, #5f4b3c floor, #efede8 roof, #f1efe9 trim) or null (use the bake).
* `setParams` handles `room.apex` (roof rebuilt in place — same geometry and material objects), `room.oldRoof`, `room.furniture`, `room.loft` (all → `patchesChanged: true`, except an apex move while the old roof shows), `room.cutaway`, `aid.gravity|seams|labels`, `region.<id>.type` (relabels), and reads `map.mask.*` for picking.
* `landing()` → `{ y, patchId: 'floor'|'loft'|null, local: [x, y] (floor frame), surface: 'floor'|'loft'|'furniture' }`; honours `room.furniture` / `room.loft`.
* `roomModel.js` additions (shape unchanged): `SHED.wallThickness`, `SHED.oldRoof.apex / pitchDeg`, `effectiveApex(values)`, `buildPatches({ …, loftY, furniture, masks })` with the measured loft outline, deck height and masks as defaults.

## Proposed CONTRACTS changes (for the lead)

* §1: add the measured deck (y 1.100 + outline + 5.18 m²), the door leaf/lining/mask, the window hole/mask, the old roof's virtual apex 2.738 / 12.6°.
* §2: mask kinds `door | window | loft | furniture`; mask ids = `door`, `window`, `loft`, `loft-post`, or the furniture object name (`armchair`, `barrel`, …); loft masks exist only with the loft shown, furniture masks only with furniture shown.
* §3: add `fadedLayer`, `measured`, `roofApex`, the `userData.pjl` tags, "views.cutaway/plan are getters", and the rule "the cutaway never sets `.visible`; `.visible` = physically present".

## Unfinished / approximate

* The new roof's facets are flat-shaded between the hips (the old bake had soft AO darkening along its hips).
* No BVH: `pick()` raycasts the furniture meshes (≈ 45 k vertices) on each click — fine for clicks, not for per-frame hover.
* Seeding on the loft's bags/mattress returns null (it's "furniture" to the ray), though `landing()` counts them as the loft.
