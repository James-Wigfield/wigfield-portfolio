# Memory Rooms kit pieces

Each piece is `kit/<name>.py` with `build(ctx, spec) -> [Object]`, modelled in LOCAL space: base centre at the
origin, `size` = `[w, h, d]` -> Blender x = w, z = h (from 0 up), y = d, **front toward -y** (scene south at
rotY 0). Parts stay inside the size box (checked by `preview.py`, tolerance 1 cm). Randomness comes from
`ctx.rng` (seeded per object id), so rebuilds are identical. `material`/`color` = main, `accentMaterial`/`accent`
= accent; when only `accent` is given the piece's default accent material is used with that colour.
Unknown params are ignored.

| piece | builds | front (-y) | params (default) | typical size w x h x d (m) |
|---|---|---|---|---|
| `box` | bevelled block | - | `bevel` (0.012) | anything |
| `cylinder` | upright (elliptical) cylinder, bevelled rims | - | `sides` (48), `taper` top/bottom radius (1), `bevel` (0.01) | side table 0.45 x 0.5 x 0.45 |
| `bed` | frame + headboard, mattress, pillows, cloth-simulated duvet with turn-down, throw | foot of the bed | `pillows` (2 if w >= 1.15 else 1), `duvet` (true), `fold` (true), `throw` (true), `headboard` (true), `mattress` top height (0.55; h - 0.14 when h < 0.8), `sim` (true). Fabric accent = upholstered frame | single 0.99 x 0.55-1.0 x 1.91, double 1.37 x .. x 1.91, queen 1.53 x .. x 2.03, king 1.93 x .. x 2.03 |
| `bunk` | 4 posts, two decks, mattresses, pillows, two simulated duvets, guard rails, ladder | foot end | `ladder` "right" \| "left" (on the foot end) \| "side-right" \| "side-left" \| "none" ("right"), `pillows` (true), `duvet` (true), `sim` (true); metal accent = hostel bunk | 0.99 x 1.65 x 1.98, hostel 0.9 x 1.6 x 2.0 |
| `sofa` | upholstered base, back, arms, pillowed seat + back cushions, legs | seat side | `seats` (from width), `arms` "both" \| "none" \| "left" \| "right", `armStyle` "square" \| "rolled", `backCushions` (true), `legs` (true), `seat` height (~0.53 h) | 3-seat 2.1 x 0.85 x 0.92, loveseat 1.5 x 0.85 x 0.9; seat 0.45 |
| `armchair` | the sofa builder with one seat and rolled arms | seat side | as sofa (`seats` 1, `armStyle` "rolled") | 0.8 x 0.85 x 0.82 |
| `table` | top + legs / pedestal / trestle, apron | - | `shape` "rect" \| "round" ("rect"; round is elliptical when w != d), `legs` 4 \| "pedestal" \| "trestle" (rect 4, round pedestal), `apron` (h > 0.5), `top` thickness (~0.03-0.045) | dining 1.6 x 0.75 x 0.9, cafe 0.7 x 0.74 x 0.7, coffee 1.1 x 0.45 x 0.6 |
| `desk` | top, drawer pedestal, legs + stretcher or panel end, modesty panel | knee space | `drawers` "right" \| "left" \| "none" ("right"; none below 0.9 m), `count` (3), `side` "legs" \| "panel", `modesty` (true), `handles` "bar" \| "knob" \| "none" | 1.2 x 0.75 x 0.6 |
| `chair` | 4 legs, raked back posts, seat, back, stretchers, optional pad | seat front | `back` "slats" \| "panel" \| "spindles" \| "ladder", `cushion` (false; accent fabric), `seat` height (~0.46) | 0.46 x 0.88 x 0.5 |
| `stool` | round/square seat, splayed legs, footrest ring (bar height) or stretchers | - | `legs` 3 \| 4 (4 when h > 0.6), `shape` "round" \| "square", `footrest` (h > 0.55), `back` (false) | low 0.35 x 0.45 x 0.35, bar 0.4 x 0.75 x 0.4 |
| `shelf` | bookcase: sides, top, kick, boards, back, optional books + vase | open side | `shelves` compartments (~h / 0.35), `books` (false), `decor` (books), `back` (true), `fill` 0..1 (0.72) | 0.8 x 1.8 x 0.32 |
| `cabinet` | carcass, top, drawers / shaker doors, handles, plinth or legs | fronts | `drawers` (low 2-3, tall 1), `doors` (low 0, tall 2 if w >= 0.6), `columns` (2 if w > 1.1), `base` "plinth" \| "legs" \| "none" (legs below 0.8 m), `handles` "bar" \| "knob" \| "none", `style` "shaker" \| "flat" | nightstand 0.45 x 0.55 x 0.4, dresser 1.2 x 0.8 x 0.45, cupboard 0.9 x 1.2 x 0.45 |
| `counter` | kitchen base units, recessed kick, shaker doors + drawers, worktop, optional sink | doors | `top` worktop material (accentMaterial, else stone), `topColor` (accent), `units` (w / 0.6), `sink` false \| 0..1 position, `tap` (false; rises 0.3 m above the box), `handles`, `stools` n (only when d >= 0.9) | 1.8 x 0.91 x 0.62 |
| `bar` | bar counter: body, raised-panel / plank front, bullnose top, brass foot rail, underbar shelf | customer side | `top` material (main), `topColor` (main, darker), `front` "panels" \| "planks" \| "plain", `rail` (true), `stools` n (d >= 0.9) | 2.4 x 1.07 x 0.75 |
| `fridge` | rounded cabinet, doors with gaps, bar handles, kick grille | doors | `layout` "bottom-freezer" \| "top-freezer" \| "french" \| "side-by-side" \| "single" (by size), `hinge` "left" \| "right" | 0.76 x 1.78 x 0.74, French 0.91 x 1.78 x 0.8 |
| `tv` | slim panel + housing, screen, pedestal stand or wall mount | screen | `stand` (true; false = wall-mounted, panel fills the box), `on` (false: glossy black; true: `emit…` screen), `screen` glow colour | 55" 1.23 x 0.78 x 0.25, 65" wall 1.45 x 0.84 x 0.06 |
| `rug` | pile slab with raised border / stripes, fringes + binding on the short ends | - | `pattern` "border" \| "stripe" \| "plain" (border if accent), `fringe` (patterned), `stripes` (5) | 1.6 x 0.012 x 1.1, 2.4 x 0.012 x 1.7 |
| `lamp` | turned base, stem / harp / finial, thin-walled open shade **named `shade`**; floor lamp when h > 1 | - | `shade` "empire" \| "drum" \| "cone" (table empire, floor drum), `base` "vase" \| "stick" \| "ginger" | table 0.3 x 0.5 x 0.3, floor 0.45 x 1.6 x 0.45 |
| `pendant` | ceiling canopy at z = h, cord, shade **named `shade`** with its bottom at z = 0 | - | `shape` "lantern" \| "dome" \| "globe" \| "drum" \| "cone" (paper lantern, glass globe, metals dome, else drum) | 0.36 x 0.55 x 0.36 (base = ceiling - 0.55) |
| `plant` | turned pot (accent), soil, stems + curved leaves | - | `kind` "leafy" \| "tall" \| "succulent" (tall when h > 2.6 w, succulent when h < 0.25), `leaves`, `stems`, `pot` height fraction | floor plant 0.45 x 0.95 x 0.45, snake plant 0.35 x 1.1 x 0.35, succulent 0.18 x 0.16 x 0.18 |
| `frame` | mitred moulding, mat, procedural print, backing (back flat at +y) | picture face | `art` "abstract" \| "photo" \| "map" \| "plain", `mat` (> 25 cm), `seed`; accent = the print's key colour | poster 0.5 x 0.7 x 0.025 |
| `curtain` | rod + finials + brackets + rings, 1-2 pleated panels relaxed by a pinned cloth sim | room side | `open` 0..1 (0.3), `panels` 1 \| 2 (2 if w > 1), `side` "left" \| "right" (single panel), `sim` (true) | window + 0.3 wide, rod to hem tall, 0.1 deep |
| `sign` | rounded board with a raised rim, 3-D text fitted inside (Blender built-in font) | lettering | `text` (label, else "OPEN"; `\n` = new line), `lit` (false; neon tubes in `emit…` accent), `style` "board" \| "letters" | plaque 0.4 x 0.15 x 0.02, fascia 3 x 0.6 x 0.12, roof sign 4.5 x 1.4 x 0.25 |

Other typical sizes: kitchen counter 0.91 high, bar 1.07 high, desk 0.75 high, sofa seat 0.45, US interior door
0.81 x 2.03.

## Materials (`../materials.py`)

`get(name, color=None, accent=None, **opts)`, cached per (name, colour, accent, opts). Names = the schema's
material enum (plus ground-only `asphalt grass sand snow gravel dirt`). Shell helpers:
`floor(finish, color)`, `wall(finish, color)`, `ground(finish, color)`. All procedural, Object-space at
real-world scale (keep object scale 1), 2-D patterns box-projected, Principled-only (bake friendly).
Name prefixes: `glass…`, `emit…`, else the recipe name. Every material carries `mr_material`, `mr_color`,
`mr_albedo` custom props (metals have no diffuse colour; a baker can use `mr_albedo`).

## Helpers (`_util.py`)

Bevelled boxes, cylinders, lathe, profile sweeps with mitred corners, tubes, legs, planks, leaves, cushions
(subdivided rounded boxes with a pillowed face), drawer/door fronts + handles, text meshes, `cloth_sim`
(headless, time-boxed, applies the result, never raises), `apply_modifiers`, `join`, `bounds`, `tri_count`.
Exterior pieces can import them: `from kit import _util as U`.

## Preview / checks

```
blender -b --factory-startup --python tools/memory-rooms/blender/kit/preview.py -- \
    --pieces all --variants --out memory-rooms-work/_dev/kit-preview [--samples 64] \
    [--scene tools/memory-rooms/examples/bedroom.scene.json] [--materials] [--no-render]
```

Prints build time, triangles and the bounding-box check per piece; writes `<id>.png`, `contact_sheet.png`,
`contact_scene.png`, `contact_materials.png` and `preview-report.json`.
