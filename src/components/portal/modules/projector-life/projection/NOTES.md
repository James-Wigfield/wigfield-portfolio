# projection/ — notes (projection agent)

What a real projector would put on the She'd. Contract: CONTRACTS.md §5.
The lead merges the decisions below into DECISIONS.md.

## Files

| File | What |
|---|---|
| `index.js` | `createProjection()` — the §5 API; orchestrates the rest, owns dirty flags |
| `projector.js` | pure maths (Node-safe): throw → FOV, pose basis, project / ray-cast against patches, px/m |
| `contentScene.js` | what each projector must OUTPUT: patch polygons + life DataTextures (mapped) or one quad (raw); masks |
| `lightMaterial.js` | the `onBeforeCompile` patch: light landing on paint, coverage + pixel views, shared uniforms |
| `shadows.js` | occluder proxies (shared geometry) + one packed-depth map per projector, CPU readback |
| `coverage.js` | area-weighted coverage readout (CPU, scanline sampling) |
| `helpers.js` | projector bodies, frustum rays, landed frame outline, faint light volume |
| `netInset.js` | the unfolded-room inset (star net) |
| `testCard.js` | debug content in the life buffer convention (`setTestCard(true)`) |
| `legend.js` | coverage / pixel-view legends + projector colours — **no three.js**, safe for the React shell to import statically |
| `tools/projector-life/projection-check.mjs` | Node checks (41): FOV, pose conventions, round trips, ray casts, depth packing, coverage, net seams |

## API as implemented (§5 + additions)

```js
const pj = createProjection({ renderer, scene, room, life, values });
pj.attach(room)                 // patch room.surfaceMeshes materials, mirror room.occluders, build content
pj.setPatches(patches)
pj.setParams(values, changedKeys)
pj.update(dt)                   // life textures → outputs (only if changed) ; depth maps only when dirty
pj.beforeRender(camera)         // hides a projector's own helpers when the camera sits in its lens
pj.outputs() → [{ index, texture, aspect }]          // sRGB render targets, 1024 px wide
pj.projectorView(i) → { position, target, fov, up, aspect }   // target = where the axis lands
pj.coverage({ force }?) → { floor, wall, ceiling, total, perPatch, byCount,
                           pxPerM: { floor, wall, ceiling },   // median projector px per metre on covered area
                           area: { floor, wall, ceiling },     // m² sampled (active masks excluded)
                           occlusion, samples, ms, computeMs }
pj.drawNet(canvas)
pj.dispose()
// additions
pj.setTestCard(on)              // 25 cm checkers per patch (mapped) / one flat card (raw)
pj.debug()                      // { depthRenders, outputRenders, coverageMs, projectors, patched, dirty }
export COVERAGE_LEGEND, PIXEL_LEGEND, GRID_PX, PROJECTOR_COLORS, hfovFromThrow, vfovFromThrow
```

`coverage({ force: true })` skips the 200 ms throttle (used by placement searches).

## Decisions (one line each + why)

- **Lens model: centred lens (no lens shift).** The optical axis goes through the image centre; you aim with pitch. Real ceiling/table projectors usually shift the picture ~100 % up — leaving it out keeps the pose controls and maths honest and simple; a shift param can be added later as an off-axis projection matrix.
- **Throw ratio t → horizontal FOV = 2·atan(1 / 2t); vertical = 2·atan(1 / (2t·aspect)).** Definition of throw ratio (distance ÷ image width); checked in `projection-check.mjs`.
- **Pose basis:** yaw 0 = north (−z), 90 = east (+x); pitch + up; roll + = picture turns clockwise seen from behind; right vector stays horizontal before roll so ±90° pitch is defined.
- **Output = the content scene rendered from the projector camera.** Each patch is a world-space polygon carrying its life buffer (uv = local metres, `texture.repeat = ppm / size`, flipY false, sRGB). Projecting that image back from the same lens IS the mapping software's pre-warp, so mapped content lands undistorted by construction.
- **Masks in the output:** door / window (and every mask polygon the room gives a patch) draw black 2 mm in front of the patch; furniture and the loft draw black as depth-tested PROXY meshes that share the room's geometry. With a mask off, the wall content behind is emitted, so it spills onto the furniture in 3-D — the honest "what if you don't mask it" picture.
- **Raw mode = `life.frame()` stretched over the whole frame** (no masks — it is the unmapped "before"). If the host returns no frame, the test card is shown instead of black.
- **Output render targets are sRGB 8-bit** (`colorSpace: SRGBColorSpace` → SRGB8_ALPHA8): hardware encode/decode, no banding in the dark end, works everywhere WebGL2 does (no float RT needed). The Stage's inset samples them with correct colour.
- **Outputs re-render only when a life buffer version, a projector pose, the mapping mode, a mask or a region toggle changes** (one render per active projector, never more).
- **Light on paint: `out = baked·ambient + albedo·Σ light`.** The room stays MeshBasicMaterial; one `onBeforeCompile` patch, one shared uniforms object, `customProgramCacheKey = 'pjl-light-v1'`. Patched materials are tracked in a WeakMap (Material.clone copies userData but not onBeforeCompile, so a userData flag would lie).
- **Albedo from the bake:** the bake is a warm night look (inner-wall mean sRGB #9b856b, floor median luminance ≈ 0.001). White-balance gains (0.699, 1.085, 1.62) map the mean inner wall onto the sage paint #cfdad2 (luminance-neutral), then luminance is soft-compressed `1 − exp(−(L + 0.03)·6)` so baked shadow pools are still paint, not holes. Measured from the atlas with a Node + sharp script (sampled over the GLB's inner-wall, floor, loft-deck and ceiling triangles).
- **Paint hints from the room:** when every mesh using a material carries the same `userData.pjl.albedo` (walls #cfdad2, roof #efede8), the albedo leans 80 % to that paint via a per-material uniform. The floor shares the atlas material with furniture, so it keeps the bake-derived albedo.
- **Fall-off: `brightness · cosθ · min((W_ref·t)² / d², 3)` with W_ref = 4 m.** Inverse square at the ray distance; the t² term is "same lumens spread over a bigger picture" (a short-throw lens at the same distance is dimmer). brightness 1 = full white on a 4 m-wide image, perpendicular; clamp 3 stops the lens's own neighbourhood blowing out.
- **Black level** is a fraction of white (`black + (1 − black)·output`) that falls off like light, so the whole frustum footprint glows faintly — visible at ambient 0.
- **Normals from `dFdx/dFdy` of world position** (the GLB has none). They face the viewer, so `cosθ ≤ 0` = the projector is behind that face = unlit; physically right even with occlusion off.
- **Shadows: one packed linear-depth map per projector** (axial depth ÷ FAR=14 m in RGB8, 1024 px wide), 4-tap PCF, bias `1.2 cm + texel·tanθ·1.5` in metres. Same texels are read back for coverage(), so the view and the readout always agree. Re-rendered only when a pose / count / roof / furniture / loft / old-roof changes (`debug().depthRenders`).
- **Occluder visibility:** proxies mirror `room.occluders` with shared geometry; walls/floor always count (the cutaway is a viewing aid); others count when `.visible` along their parent chain (the room's furniture/loft/roof toggles). The room fades meshes by moving them to a layer, not `.visible`, so the cutaway never changes shadows.
- **Coverage view colours (legend-able):** 0 = deep maroon #5a2330 (dark, reads as "nothing here" without shouting), 1 = green #2fbf71, 2 = blue #2f8fe0, 3 = violet #b07cff, shaded by albedo so the room still reads; edges blend by the PCF fraction (no stair-steps). Exported as `COVERAGE_LEGEND`.
- **Pixel view: a grid line every 32 projector pixels, each line coloured by local px/m** (log ramp 100 → 1000 px/m, red → amber → green → cyan) **over a faint fill of the same colour.** The grid alone shows *shape* (keystone, stretching at grazing angles, the grid jumping across corners); the colour alone shows *density*. Together they answer "how big are the pixels here, and why". Resolution changes show directly (720p: 40 columns, 4K: 120). Exported as `PIXEL_LEGEND`, `GRID_PX`.
- **Coverage readout:** cell-centred 5 cm grid on every patch (≈20 k samples), active masks excluded from numerator and denominator, type = region override or `typeAuto` (the loft deck counts as floor). Scanline intervals + allocation-free loop: ~5–7 ms compute + ~3 ms readback; throttled to ≤ 5 recomputes/s, never per frame.
- **Frustum helpers:** 4 corner rays (30 % opacity), the frame outline where it actually lands (ray-cast against the patches, 40 samples per edge, so it bends across corners), and a 3.5 % additive light volume fanned along that outline. Bodies always show (they're real objects); `proj.frustum` toggles the rest. Hidden for a projector when the camera sits in its lens.
- **Net inset:** floor in the middle, walls via their wall→floor seam maps, roof facets via roof→wall ∘ wall→floor; the loft (no seams) sits beside the star at the same scale. Joined vs cut is decided geometrically (do the two sides land on the same net points?). Cut seams: dashed in a colour shared by both edges + the same tick count (1 = wall corner, 2 = roof hip). Decorations scale down with the canvas; labels only ≥ 300 px.

## Measured

- Default preset in the full page (headless Edge d3d11, 1440×900): **~179 fps, frame ≈ 1.1–1.5 ms** CPU, life ≈ 0.8 ms. 3 projectors + coverage + pixel view: still ~180 fps, ≈ 1.0–1.25 ms.
- Coverage recompute: 9–12 ms incl. depth readback (1–3 projectors); 41 Node checks pass.
- `projection.dispose()` frees everything it made (renderer.info: textures 28 → 1 = the room's atlas, geometries back to the room's own, helpers gone, material patches restored).

## Placement search (real occlusion-aware coverage, masks on, apex 3.3)

Exhaustive grid in the browser (`coverage({ force: true })`, ~1.7 ms per pose): positions on a 0.425 m grid inside
the octagon (r ≤ 1.95 m), heights 0.4 / 1.3 / 2.05 / 2.3 m but always ≥ 15 cm below the roof, yaw every 22.5°,
6 pitches, throw 0.5 (typical short throw); greedy + one round of coordinate descent for rigs.
Score = total + 0.25·min(floor, wall, ceiling) (keeps all three habitats in play).

| Rig | Poses (x, y, z, yaw, pitch, throw) | Total | Floor | Walls | Roof |
|---|---|---|---|---|---|
| 1 projector (best) | (1.35, 2.05, 3.90, 45, −12, 0.5) — over the loft, SW, aiming NE | 36.3 % | 18 % | 49 % | 35 % |
| 2 projectors | + (2.20, 2.30, 0.50, −157.5, −12, 0.5) — high on the N wall, aiming SSW | **62.7 %** | 27 % | 76 % | 72 % |
| 3 projectors | + (3.90, 2.30, 1.78, −135, −60, 0.5) — high NE, steeply down | **70.4 %** | 56 % | 78 % | 72 % |
| UI `seShort` (default preset) | (3.45, 2.15, 3.45, −45, −12, 0.5) | 25.5 % | 5 % | 27 % | 39 % |
| UI two-projector rig `seLevel + nwLevel` | | 53.9 % | 4 % | 54 % | 89 % |
| UI three `seShort + nwLoft + floorUp` | | 56.5 % | 7 % | 57 % | 92 % |
| UI `seStandard` (throw 1.5) | | 4.3 % | 2 % | 9 % | 1 % |

Throw ratio at the best single pose: **1.5 → 5 %** (645 px/m on walls), **0.5 → 36 %** (~215 px/m),
**0.35 → 50 %** (~150 px/m), **0.25 → 59 %** (~100 px/m ≈ 1 cm pixels, and a centred-lens 0.25 is a fisheye
no real UST is). Overlap is small: the 2-rig has 1 % double-covered, the 3-rig 10 %.
Two short-throw projectors is the sweet spot for this shed; the third mostly buys floor.

Coverage-optimal is not hero-optimal: the best single throws much of its frame onto the walls the cutaway
camera fades. A second search scored "share of the patches the cutaway camera shows" (walls N/NE/W/NW, their
roof facets, floor, loft): UI `seShort` 35 %, best 45 % (over the door, aiming N, but floor 8 %), runner-up
**(1.35, 2.05, 3.90, yaw 22.5, pitch −12) = 43 % of the visible half, 34.5 % total, floor 19 %** — chosen.

**`params.js` projector defaults (changed by the projection agent, keys untouched):**

| | Pose | Alone / cumulative |
|---|---|---|
| p0 | (1.35, 2.05, 3.90) yaw 22.5 pitch −12 t 0.5 — over the loft's south end, aiming NNE | 34.5 % (F 19 · W 42 · C 37) |
| p1 | (2.20, 2.30, 0.50) yaw −157.5 pitch −12 t 0.5 — high on the N wall above the armchair | p0+p1 61.3 % (28 · 71 · 73) |
| p2 | (3.90, 2.30, 1.78) yaw −135 pitch −60 t 0.5 — high NE, steeply down | all three 72.2 % (58 · 80 · 73) |

Suggested for presets.js (UI agent / lead): the *Two-projector rig* = p0 (yaw 45 variant) + p1 → **62.7 %**
vs the current `seLevel + nwLevel` 53.9 % (whose floor is 4 %).

## For the lead

- `projectorView(i)` returns `up` (roll) and `aspect`; the Stage's OrbitControls keeps `camera.up = +y`, so roll isn't shown in the Projector's view. Fine for now.
- `coverage()` extras (`pxPerM`, `area`) are there for the Plan tab's "what the visualiser showed".
- UI: legends for the coverage and pixel views can come from `projection/legend.js` (no three.js).
- Proposed CONTRACTS.md §5 additions (all backwards compatible): `coverage({ force })` and its extra fields,
  `projectorView().up/aspect`, `setTestCard(on)`, `debug()`, `legend.js`. §3 note: the projection reads the
  room's `userData.pjl.{part, patchId, albedo}` tags (classification, paint hints, cutaway-aware outline) and
  treats `.visible` along the parent chain as "physically present" (fades use layers, so they never change shadows).
