# tools/memory-rooms/landscape/v2: live, walkable landscapes

v2 of the landscapes (first: Point Peron, 2026-11-26). v1 (`../`) baked a km-scale diorama into top-down ortho
textures; v2 is a **live** landscape: the browser builds the ground from a heights grid, lights everything with one
sun, draws real water, stands every plant up as an instance, and you can **walk** it (first person, the existing
walk, multiplayer). The runtime is `src/memory-rooms/landscape/`; the walk's height-field grid is
`src/memory-rooms/walk/heightfield.js`. Contract: `site.terrain.live` (CONTRACTS §6.8).

Work folder: `memory-rooms-work/_<name>/` (gitignored), Python from a venv with `rasterio scipy shapely pillow
numpy matplotlib` (Point Peron uses `memory-rooms-work/_peron/.venv`). `rebuild.sh` in the work folder runs
everything after the sources.

```
fetch_v2 ─► sources ─► s2_bands ─► prep2 ─► coast ─► scatter ─► shade ─► textures + leaves ─► build_v2 (Blender) ─► export_data ─► pack ─► stage-v2 ─► push
 open data   frame +    S2 bands    grids    cliffs    plants,    sun +     tileable layers,     props.glb:          data maps      ONE       spot +    (repo
 (no keys)   depths     on frame             cut in    boulders   AO        leaf atlas           plants + sites      + plants.bin   room.glb  scene     push.mjs)
```

| Step | Command (repo root) | What it does |
|---|---|---|
| Fetch | `python fetch_v2.py <work> --bbox W,S,E,N` | GA 5 m LiDAR (WCS GetCoverage, a browser UA), WA DoT LiDAR bathymetry **image** (SLIP `WA_Bathymetry` layer 21) + DoT depth-range polygons, OSM `map.json` (UA `landscape-builder/2.0`) |
| Sources | `python sources.py <work> --box W,S,E,N [--v1 <v1 work>]` | the frame (`frame.json`: box + 250 m ring, 1 m cells), DEM on it, OSM land mask, **depth read off the DoT colour ramp** (hue; red = waterline, green = 10 m, cyan = 20 m, calibrated on DoT's own depth bands) |
| S2 | `python s2_bands.py <work> <item ids>` | Sentinel-2 L2A reflectance (Earth Search) on the frame at 2 m |
| Grids | `python prep2.py <work>` | `grid2.npz`: heights (beach foreshore, rock platforms, **site ground edits** from the site spec), ground materials, plant densities, walk flags; `features.json` (OSM in local metres) |
| Coast | `python coast.py <work>` | `coast.json` rocky / sandy runs; **cuts the cliffs into grid2** (the 5 m LiDAR smears a cliff) |
| Plants | `python scatter.py <work> [--box=x0,z0,x1,z1]` | `plants.npz`: 6 plant kinds + 4 boulder kinds, cleared off paths and sites, the tuft on Mushroom Rock, stones lining steep paved paths |
| Shade | `python shade.py <work> [--az 320 --el 42]` | sun visibility (ground + tops) and AO at 1 m from a canopy height field |
| Textures | `python textures.py <work>` · `python leaves.py <work>` | tileable ground layers (sand, limestone, soil, weed, path, concrete, bitumen, brick) + an FFT sea normal map; the leaf atlas. Made here, no downloaded packs |
| Blender | `blender -b --factory-startup --python build_v2.py -- --work <work>` | `build/props.glb`: plant prototypes (cards + far cards), boulders, every site of the spec, the cliffs (`build_v2_nature.py`), per-vertex AO |
| Data | `python export_data.py <work>` | `data/`: heights / splat / veg / water / shade PNGs (opaque: a 2D canvas decode premultiplies alpha), `plants.bin`, `data.json` (frame, encodings, sun, OSM ways) |
| Pack | `node pack.mjs <work>` | `build/room.glb`: props quantised + meshopt, every data file as a `mrLand:<file>` byte accessor (WebP / JPEG), root extras `mrLandscape` |
| Stage | `node stage-v2.mjs <work> --create \| --id <spot> --spawn x,z,yaw [--live]` | spot, `scene.json` (`site.terrain.live { spawn, home, pois }` from `<work>/pois.json`), a small vertex-coloured `map.glb`, the hero from the harness |

**Place-specific knowledge** lives in `peron-sites.json` (the battery's pits, bunkers, observation post, lookouts,
Mushroom Rock: positions from OSM, sizes from the Commons photos, each with notes) and `<work>/pois.json` (the info
cards, each with its sources). A new place needs its own of both.

**Checks / views:**
- `harness/index.html?data=…` (or `&glb=…/build/room.glb`) on the Vite dev server, `shots.mjs`, `probe.mjs`
- `walk-land.mjs <spot> <out> --at name=x,z,@tx,tz --gif name=x,z,yaw,secs[,tx,tz] [--size 390x844 --cpu 4]` (the
  real walk page on the local Worker: load, ground, fps standing / running, a GIF), `walk-mp-land.mjs <spot>`
  (two walkers), `spot-shot.mjs <spot> <png>` (the spot page). `walk-check.mjs` skips landscapes.

**Gotchas:** run Git Bash commands with `MSYS_NO_PATHCONV=1` when an argument starts with `/`; Blender's frame (y
north) mirrors world z, so a box built from a world frame needs its axes re-handed (`oriented_box`); the walk server
corrects any move over 7 m/s, so a test teleport must re-read the floor after x / z (fixed in WalkGame).

**Attribution** (scene notes / `site.terrain.sources`): DEM of Australia derived from LiDAR 5 m grid © Geoscience
Australia (CC BY 4.0); WA Department of Transport LiDAR bathymetry via Landgate SLIP (CC BY 3.0 AU); © OpenStreetMap
contributors (ODbL); contains modified Copernicus Sentinel data; reference photos Wikimedia Commons (CC BY-SA).
