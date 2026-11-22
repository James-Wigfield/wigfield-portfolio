# Drive it: asset contract

The sim at `/skippers/practical/drive` loads two GLBs and one JSON from `public/skippers-sim/`. All three are built headless by `node tools/skippers-sim/build-assets.mjs` (Blender 5.2, the Memory Rooms way). How to rebuild is in `tools/skippers-sim/README.md`, and the measurements and method are in `Documents/skippers/sim/layout.md`.

## Frames
- **World:** metres. Blender X = east, Y = north, Z = up. The origin is the seaward end (head) of the centre jetty at the eastern Palm Beach ramp (-32.27532, 115.71691), with z = 0 at mean water level.
- **three.js:** glTF is +Y up, so a world point `(x east, y north, h)` sits at `(x, h, -y)`. North is -Z.
- **Boat local frame:** +X = starboard, +Y = up, -Z = bow. A heading `psi` (compass, clockwise from north) maps to `rotation.y = -psi`.
- **Physics (`physics.js`):** plain 2D `(x east, y north)`, the same numbers as the layout JSON.

## `venue-layout.json` (read by the game and by Node checks)
`rampHeadingDeg`, `jetty` (`poly`, `cleats[]`, `lightPole`), `berths[]` (`id` east|west, `edge` [[x,y],[x,y]], `outward` unit normal), `colliders[]` (convex CCW `poly`, `kind` jetty|rock|ramp|shore|closed_ramp|moored), `moorings[]`, `transits[]` (`front`/`back` {name,x,y,h}, `sayAs`), `landmarks[]`.
- **Take positions from this JSON, not from venue node transforms.** Meshopt compression moves node origins.
- The game falls back to `world.js → provisionalLayout()` (same shape) if the fetch fails.

## `venue.glb` (meshopt, ~0.7 MB)
Static scenery with no water surface; the game renders the water in-engine. The game hides `seabed`. The other nodes are reference only (the game doesn't look them up):
- **Ramp and jetty:** `ramp`, `ramp_surrounds`, `jetty_centre`, `jetty_light_pole`, `cleat_e1–e4`, `cleat_w1–w4`
- **Rocks:** `rock_west`, `rock_east`
- **Shore:** `beach_west_polo`, `beach_east_esplanade`, `esplanade`, `esplanade_buildings`, `hinterland`
- **Trees:** `big_tree_behind_ramp`, `norfolk_pine_a–f`, `pines_esplanade`, `park_trees`
- **Boats:** `moored_01–14`, `mooring_buoys`
- **Closed west ramp:** `closed_ramp_west`, `closed_groyne_west`
- **Palm Beach jetty:** `palm_beach_jetty`, `palm_beach_jetty_head_light`
- **Distant:** `garden_island`, `coast_far_north`, `industrial_shore_ne`

## `boat.glb` (uncompressed, ~0.14 MB, so the pivots stay exact)

| Node | Use in the game |
|---|---|
| `outboard` | `rotation.y = wheel × legMax` (+ = starboard) |
| `prop` (child of outboard) | spin (`rotation.z`) |
| `wheel` | `rotation.z` spin (the node is tilted 35°) |
| `lever` | `rotation.x = -gear × 0.11` (negative = ahead) |
| `person_skipper_seat` | helm eye / camera mount |
| `person_skipper` | hidden (the camera is in its head) |
| `person_assessor`, `person_passenger` | static |

**Hotspot empties** (E / click). The game finds these **by name**, converts each to the boat's local frame once at load, and falls back to `hotspots.js → HOTSPOTS[id].p3` when one is missing:
- **Lines and cleats:** `hs_line_bow`, `hs_line_stern`, `hs_line_spring`, `hs_cleat_bow`, `hs_cleat_stern`, `hs_cleat_mid_port`, `hs_cleat_mid_stbd`
- **Fuel:** `hs_fuel_bulb`, `hs_fuel_line`, `hs_fuel_gauge` (on the portable tank)
- **Engine and controls:** `hs_intakes` (on `outboard`), `hs_prop` (on `prop`), `hs_lever` (on `lever`), `hs_lanyard`, `hs_key`
- **Safety gear:** `hs_lifejackets`, `hs_epirb`, `hs_flares`, `hs_extinguisher`, `hs_bilge`, `hs_bucket`, `hs_anchor`, `hs_radio`
- **Rego:** `hs_rego`

The jetty cleat (`hs_jetty_cleat`) is virtual. It sits at the nearest `jetty.cleats[]` entry from the layout JSON.

## `boat-footprint.json`
An 11-point convex hull plus draft and deck figures. The physics currently uses its own 9-point `FOOTPRINT` in `physics.js`, matched to the same 5.5 × 2.2 m hull.

## Adding or renaming a hotspot
1. Add the empty in `tools/skippers-sim/blender/boat.py` and rebuild.
2. Add `{ label, p3, phases }` to `hotspots.js`.
3. Handle it in that phase's `hs()` in `game.js`.
4. If a criterion depends on it, give the textbook script in `tools/skippers/sim-check.mjs` the same step.
