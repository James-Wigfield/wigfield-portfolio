# Dream Rooms · the Blender kit

Headless Blender (5.2) turns a `world.json` into a baked, unlit GLB plus Cycles stills, and bakes the static
corridor kit for `/dreams`. The contracts are `src/dream-rooms/CONTRACTS.md` §4–7; the shared numbers are
`src/dream-rooms/contracts/dims.json` (read by `common.py`, never copied). Never use the Blender MCP: everything
runs as

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python <script> -- <args>
```

(`BLENDER` overrides the path; Node runs it through `tools/dream-rooms/lib/blender.mjs`). Scripts print ids,
counts, sizes and timings only, and their last line is `REPORT {json}` (decision 14: never dream words).

## The scripts

| script | does |
| --- | --- |
| `build_world.py --world <abs> --out <abs> [--draft \| --full] [--work <abs>] [--glb-name] [--scratch] [--atlas] [--samples] [--stills] [--png-copies]` | world.json → GLB. `--draft`: 512 px atlases, 32 samples (≈ 30 s for the sample). `--full`: 2048 px, 384 samples, plus stills. |
| `bake_export.py` (same flags) | `build_world.py` in `--full` mode: `world-v<N>.glb` + `stills/<module>.webp` (1280 × 800, volumetric haze at 0.7 × `look.fog.density`, in the fog colour). A `fallback: "still"` world renders `stills/still-<k>.webp` only. |
| `corridor_kit.py --out <abs dir> [--samples 512] [--atlas 1024] [--preview <abs png>]` | `public/dreams/corridor-kit.glb` (static). `--preview` renders the baked pieces down a sample layout (entrance, break, door_l, door_r, plain, break, door_l, end) with viewer-like fog, plus `-bay.png` inside the break bay. |

From Node: `node tools/dream-rooms/build.mjs <id> --draft [--no-upload] [--no-frames] [--stills]` and
`node tools/dream-rooms/bake.mjs <id> [--version N] [--samples N] [--atlas N]` (it measures the real GLB with
`@gltf-transform/core` and fails over budget). Blender logs go to `build/draft-blender.log` / `build/bake-blender.log`
in the work folder; atlases to `build/atlas/`; PNG copies of the stills to `build/stills-png/` (never uploaded).

## How a build works (`build_world.py`)

1. **Build** every module at its world `origin` (viewer coordinates: x, y up, z, north = −z; metres). A
   `repeat: true` corridor is built as copies at z ± d: three for the bake (the middle one is exported), seven
   for its still. `v2b(x, y, z) = (x, −z, y)` in `common.py` is the only viewer → Blender conversion; it is a
   proper rotation, so windings survive, and the export uses `export_yup=True` to give the viewer its coordinates
   back.
2. **Light** (`kit/lights.py`): `glow` = hidden area lights under the ceiling (±40 % uneven, seeded by module id,
   the same in every copy) plus a wide up-light that washes the ceiling; lights never show to the camera, in
   reflections or through glass. `panels` (cited only) = emissive `F_` panels + a weaker glow. `windows` = lit glass
   + a light per window unless the look's windows are dark. `none` = a faint glow. Colour = `look.warmth`.
   Every doorway's Z-stub gets a faint fill in leg 2.
3. **Exposure** per module from its still camera (geometric-mean luminance, trimmed): target by `look.light`
   keyword (night 0.14, afternoon/evening 0.19, day 0.25; `lights: none` × 0.55). Atlases and stills share it.
4. **Stills** (full): the entry camera of each module, haze on for that module only, text quads hidden.
5. **Bake** per module: lightmap UVs (smart project, each object normalised to its salience weight, pre-fit
   into the unit square, packed with an island-count-aware margin and checked; bad packs retry with a smaller
   margin), split into ≤ 4 atlases (≈ 100 texels/m on cited surfaces at weight 1). COMBINED is baked into a
   float image in two passes: the shell with swap targets (`P_`) and text quads (`S_`) hidden (a hidden prop leaves
   no shadow), then the separate nodes with everything visible. Saved display-referred through AgX
   (`save_render`), reloaded as sRGB.
6. **Export**: one unlit material per atlas (emission for camera rays, transparent otherwise →
   `KHR_materials_unlit`), shell objects joined per atlas, WebP (`EXT_texture_webp`), extras on every node.

### Salience weights (texel density relative to 100/m)

| surface | cited | invented / unnamed |
| --- | --- | --- |
| floor | 1.0 | 0.4 |
| walls (and hall columns) | 0.9 | 0.35 |
| ceiling | 0.6 (drop tiles 0.7) | 0.3 (high-dark / none 0.12) |
| props | 1.0 | 0.5 |
| trims, frames, plaques | 0.6 | |
| Z-stubs | 0.45 | |
| text quads 0.6 · fixtures 0.15 · water 0.3 (the viewer swaps in a live material) | | |

### GLB node names (CONTRACTS §6)

`M_<module>` (empty, identity transform; extras `kit`, `origin`, `size`) parents:
`M_<module>__shell`, `__shell_1..3` (one per atlas) · `P_<module>__<propId>` (props a swap targets; origin at the
prop's anchor: wall point at floor level, or `pos`) · `S_<module>__<surface>` (one quad, origin at its centre, local
+z = the way it faces, local +y = up on it; extras `w`, `h`) · `W_<module>` · `F_<module>__<k>` (origin at the panel
centre) · `D_<module>__<doorway>` (empty at the doorway centre, local +z = inward). Every node: extras
`dr` (`module|shell|prop|surface|water|fixture|doorway`), `module`, `id`. Materials: `baked_<m>_<i>`,
`prop_<m>__<id>`, `surface_<m>__<surface>`, `fixture_<m>__<k>`, `water_<m>` (several share one atlas image).

Text surfaces: every `sign` / `board` prop (surface = prop id); `doors-sign-<k>` above every numbered door and
every doorway of a module with `doors.sign` (or whose doors-sign is a word or swap target), numbered decorative
doors first (in wall order), then doorways in `world.doorways` order; `wall-<side>` (the widest free stretch of
that wall at eye height, away from openings and wall props), `floor`, `water`, only when a word is on them.

## Adding a module kit

1. `kit/<name>.py` with `build(mb)`; add the name to `MODULE_KITS` in `kit/__init__.py` (and to the schema's
   `kit` enum + validate.js if it's new to the contract).
2. Work in module-local metres through `mb` (`kit/base.py`):
   - `mb.size`, `mb.w/h/d`, `mb.scale`, `mb.fin["floor"|"walls"|"ceiling"|"water"]` (`.mat`, `.weight`, `.hex`, `.cited`);
   - `mb.group(key, weight)` → a `MeshBuilder` for shell geometry; `mb.mesh(name, role, weight, pivot_local)` for
     a separate node; `mb.prop_mesh(prop)` does the right one for a prop;
   - `MeshBuilder.poly(points, mat, normal)` (give the normal the face must SHOW: faces point at the walker),
     `.box(lo, hi, mat, xf, skip)`, `.prism(...)`, `.panel_grid(...)` (one connected panel with coloured cells:
     use it for fine details, thousands of separate boxes become thousands of UV islands);
   - `mb.holes[side].append((u0, u1, v0, v1, tag))` BEFORE `shell.build_shell(mb, walls=..., floor_holes=...)`
     cuts real openings; doorways are cut and given frames + Z-stubs automatically.
3. Call `reserve_props(mb)` before the shell and `build_props(mb)` after it. Lights come from `kit/lights.py`
   after your `build`.

## Adding a prop

`kit/<name_with_underscores>.py` with `build(mb, prop)` and optionally `reserve(mb, prop)` (claim wall space with
`mb.place(prop, length=, height=)`, or cut a hole with `mb.holes`). Add it to `PROP_KITS` (and the schema enum).
Use `xf, wall = mb.place(prop)`: a frame whose origin is on the wall plane at floor level (or `pos`), local +z =
out from the wall (inward), +y up, +x along. Size everything by `mb.scale`. Colour: the prop's `color`, else a
muted neutral; a prop that can carry words adds `mb.surface(prop["id"], centre, normal, w, h, hex)`.

## Finishes

`kit/finishes.py`: `carpet`, `tile` (0.15 m on walls, 0.25 m on floors), `terrazzo`, `painted-block`,
`wallpaper` (cited only), `timber`, `linoleum`, `water`, `plain`, plus `drop_tiles()` (cited only) and
`dark_ceiling()`. All read the `tex` UV (planar, metres) and are tinted by the finish's `color`. Invented →
`plain` grey `#76746f`. Add one: `_<name>(nt, b, col, role)` + an entry in `FINISHES` (+ the schema enum).

## Bespoke modules

`{ "kit": "bespoke", "bespoke": "<name>" }` runs `dream-rooms-work/<id>/bespoke/<name>.py` (pass `--work`):

```python
SHELL = True          # False: build your own enclosure (call ctx.shell(...) for any part of the standard one)

def build(ctx, module):
    # module-local metres: x 0..ctx.w, y 0..ctx.h, z 0..ctx.d (north = -z); ctx.scale; ctx.fin[...]
    stone = ctx.finish("terrazzo", "#b8b0a2", role="floor")      # only what the dream cites
    ctx.box((2, 0, 2), (4, 0.45, 3), stone)                       # into the shell
    ctx.prism([(5, 5), (6, 5), (5.5, 6)], 0, 2.4, ctx.flat("#555049"))
    lamp = ctx.prop_mesh("lamp", pivot=(3, 0, 6))                 # a separate P_<module>__lamp for a swap
    lamp.box((2.9, 0, 5.9), (3.1, 1.6, 6.1), ctx.flat("#2c2a28"))
    ctx.surface("wall-n", (ctx.w / 2, 1.55, 0.004), (0, 0, 1), 2.0, 0.5, "#76746f")
    ctx.light((ctx.w / 2, ctx.h - 0.2, ctx.d / 2), size=(3, 3))   # hidden, sourceless
```

`ctx.hole(side, u0, u1, v0, v1)` cuts a wall opening (before `ctx.shell`). Geometry more than 3.5 m outside the
box (stubs live just outside) is counted and reported as a warning.

## The corridor kit (`corridor_kit.py`)

Pieces per CONTRACTS §7 and `dims.json → corridor`, each built at the origin from z = 0 to −length, x centred,
floor y = 0, baked in context with plain neighbours at both ends (one for the entrance and the ends), one exposure
for the whole kit (target 0.085), 512 samples, ≤ 1024 px each. The look: dim, warm-dark hotel-or-school at night;
light from a cove you never see (area lights on a cornice ledge) and a glow from nowhere (area lights under the
ceiling), both uniform along z so pieces tile in any order; timber wainscot, a dado rail, muted mottled plaster,
an oxblood runner on dark boards, tall door frames with a blank plaque at `signY`. `K_break`: 0.6 m narrow ends,
the dark window on the right (+x), the stencil wall on the left (node extras give both). `K_end`: no end wall,
the light dies away over ~6.5 m. `K_end_door`: a shut leaf baked into an end wall. `K_leaf`, `K_spill`,
`K_underline`: hinge-frame geometry for the viewer (extras say so); `spill` / `underline` materials are
placeholders the viewer replaces.

## Gotchas

- `view_layer.objects` is synced lazily: new objects are missing from selections, renders and bakes until
  `common.sync()` (select_only / measure_luminance / render_still call it).
- `pack_islands` from metre-scale UVs is slow (30 s+): pre-fit into the unit square first; with thousands of
  islands a fixed per-island margin can't fit and the packer collapses islands to points; `lightmap_uvs` caps
  the margin and checks the result.
- Mesh emitters bake noisily next to the surfaces they light: use hidden area lights for coves.
- The bake margin must be at most half the pack gutter, or a separate node's bake paints over shell texels.
- gltf-transform needs `EXTTextureWebP` registered next to `KHRONOS_EXTENSIONS` to read the GLB.
