# Skippers practical sim — assets

Venue (Palm Beach EAST ramp, Rockingham) + the 5.5 m centre-console runabout for
`/skippers/practical/drive`. Headless Blender, the Memory Rooms way.

## Rebuild

```
node tools/skippers-sim/build-assets.mjs              # layout + venue + boat, meshopt-compressed
node tools/skippers-sim/build-assets.mjs --only venue # or --only boat;  --raw = skip compression; --no-ao
node tools/skippers-sim/layout.mjs                    # just venue-layout.json
```

Needs Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` (override with
`BLENDER=`). Takes ~10 s. Logs + node lists: `tools/skippers-sim/logs/`.

| file | what |
|---|---|
| `layout.mjs` | every measured number → `public/skippers-sim/venue-layout.json` (physics + GLB source); checks colliders are convex + CCW |
| `blender/kit.py` | materials, bmesh `Builder` (one object per group), empties, glTF export |
| `blender/venue.py` | `venue.glb` from the layout JSON (no water surface) |
| `blender/boat.py` | `boat.glb` + `boat-footprint.json` |
| `blender/preview.py` | Workbench check renders: `--glb f --out dir --views "name:ex,ey,ez:tx,ty,tz:lens;..."` |

Check renders live in `Documents/skippers/sim/shots/`; measuring method in `Documents/skippers/sim/layout.md`.

## Loading in three.js

`venue.glb` uses `EXT_meshopt_compression` + `KHR_mesh_quantization`:
`loader.setMeshoptDecoder(MeshoptDecoder)` (`three/examples/jsm/libs/meshopt_decoder.module.js`).
Quantization shifts venue node origins (geometry is exact) — read positions from venue-layout.json,
not from venue node transforms. `boat.glb` is uncompressed so its pivots stay exactly on the hubs.
Blender frame X east / Y north / Z up → three (x, z, −y): north = −Z, boat bow = −Z.
Materials are plain PBR colours (no textures). The venue's near meshes (rocks, jetty, ramp, trees,
boats, beaches) carry baked ambient occlusion as vertex colours (`COLOR_0`, 0.55–1.0, multiplies the
base colour; GLTFLoader turns `vertexColors` on by itself; `--no-ao` to build without); `glass_windscreen` is alpha-blended,
`lamp_glow` is emissive. Venue far scenery sits ~2.5 km out — camera far ≥ 3000.

## Animated boat nodes (three.js axes)

- `outboard` — origin on the swivel axis at the transom. Steer = `rotation.y`; **+ = cowling/prop swing to
  starboard, thrust pushes the stern to port, boat turns to starboard** (wheel turned to starboard).
- `prop` (child of `outboard`) — origin at the hub; spin = `rotation.z` (Blender local Y).
- `wheel` — origin at the hub, node is tilted 35°; spin = `rotateZ` (local; Blender local Y).
- `lever` — origin at the pivot on the console's starboard face; **forward throttle = negative
  `rotation.x`** (handle tips toward the bow), neutral = 0.
