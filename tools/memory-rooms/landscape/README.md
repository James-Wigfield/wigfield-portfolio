# tools/memory-rooms/landscape: real places as terrain dioramas

Builds a km-scale landscape (first one: Point Peron, Rockingham, 2026-11-24) from open data, bakes it in Blender and
stages it as a Memory Rooms exterior spot with `site.terrain` (CONTRACTS.md §6.8). Work folder: any
`memory-rooms-work/_<name>/` (gitignored). The Python steps want a venv with `rasterio scipy shapely pillow numpy`
(`python -m venv .venv` in the work folder).

```
fetch-dem.mjs  ─► OSM map.json ─► fetch_s2.py ─► prep.py ─► albedo.py ─► build_landscape.py --bake ─► stage-spot.mjs ─► push.mjs
   heights          vectors        colour        grids       0.5 m paint   Blender + GLB               spot + scene
```

| Step | Command (from the work folder unless noted) | Writes |
|---|---|---|
| Heights | `node tools/memory-rooms/landscape/fetch-dem.mjs --bbox W,S,E,N --z 15 --out <work> --step 2` (repo root) | `dem.f32`, `dem.json`, `dem.png` (AWS Terrarium tiles, no key; `--source mapbox` uses the token) |
| Vectors | `curl "https://api.openstreetmap.org/api/0.6/map.json?bbox=W,S,E,N" -o osm.json` | `osm.json` (coastline, roads, paths, buildings, bunkers, piers, viewpoints) |
| Colour | find clear scenes: POST `https://earth-search.aws.element84.com/v1/search` (`sentinel-2-c1-l2a`, `eo:cloud_cover < 2`), then `.venv/Scripts/python fetch_s2.py . <item ids…>` | `s2-<date>.npz/.png` |
| Grids | `.venv/Scripts/python prep.py . --s2 <date> --crop c0,r0,c1,r1` | `grid.npz` (h, land, rgb, cls, rocky, islet), `grid.json` (frame + OSM features in local metres), previews |
| Paint | `.venv/Scripts/python albedo.py .` | `albedo.png` (0.5 m), `mask-scrub.png`, `land-hr.png` |
| Build | `blender -b --factory-startup --python build_landscape.py -- --work . --renders hero,top --bake --tile 4096 --save` | `landscape.blend`, `renders/*.png`, `bake/ground_t*.png`, `bake/structures.png`, `landscape.glb`, `bake/report.json` |
| Stage | `node tools/memory-rooms/landscape/stage-spot.mjs <work> [--create] [--id <spot>] [--live]` (repo root) | `memory-rooms-work/<spot>/room.glb, scene.json, renders/` |
| Publish | `node tools/memory-rooms/push.mjs <spot>` (repo root; `MEMORIES_API=https://jameswigfield.com` for live) | uploads, scene, status rendered |

Place-specific knowledge lives in two spots, both marked in the code:
- `prep.py`: which coasts are cliffs (`rocky_region`, in crop-local metres, read off satellite + drone photos) and
  the islet rule. A new place needs its own regions.
- `build_landscape.py` `build_structures`: building heights by OSM name, the battery, lookouts, piers, the
  causeway bridge, Mushroom Rock. Generic OSM buildings / piers / bridges work anywhere.

Frame: local metres from `grid.json centre_lnglat`, x east, y north in Blender (glTF export makes it x east, y up,
z south, i.e. the scene frame). True vertical scale (`--vexag 1`).

Attribution (the scene's `site.terrain.sources`): Terrarium tiles (Mapzen / Tilezen, AWS Open Data),
© OpenStreetMap contributors (ODbL), contains modified Copernicus Sentinel data.
