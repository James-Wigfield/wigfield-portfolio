# Life on the walls — merger brief

*For your Claude Code, from James. Paste this in as the starting brief.*

**Context.** You've built projection-mapping software with an MCP layer: you map a region of a room and ask Claude to design content for it. I've built an artificial-life "Specimen Cabinet" (Lenia, Gray-Scott reaction–diffusion, Physarum slime mould, Particle Life, the Primordial Particle System, an evolving ecology) that runs in a browser. We want to merge them: **every mapped region becomes a habitat, with its own gravity, and Claude becomes the room's naturalist.**

- **Level 1:** project the existing sims onto mapped regions.
- **Level 2:** life that knows the surface it lives on — floor (gravity presses in), wall (gravity drags it down the surface), ceiling (gravity peels it off; a pitched facet also pulls downslope). Creatures crawl, grip, swing like gibbons under the roof, fall, and feed the floor. Lineages split by surface.

I've prototyped all of this in a 3-D visualiser of a real room (Justin's octagonal shed, "the She'd": 4.36 m across the flats, eaves 2.25 m, a pointed 8-facet roof). Numbers it measured are at the end.

**Work rule:** answer the questions in §7 first, from your repo. Then do phase 0 and show me the interface before writing more.

---

## 1. The one interface: region content

Your mapper owns regions, warps and projectors. My side owns what lives inside a region. The join is one interface, sized in **metres** so life keeps its size across regions:

```ts
export interface RegionContent {
  init(region: {
    id: string,
    type: 'floor' | 'wall' | 'ceiling',
    size_m: [number, number],        // local bounding box of the region
    polygon_m: [number, number][],   // the region's outline in local metres
    up_edge: string | null,          // which way is "up" along the surface (null on floors)
    px_per_m: number,                // ONE density for every region
  }): void;
  step(dt_s: number): void;          // fixed ticks inside its own CPU budget
  render(target: ImageData | WebGLTexture): void;   // #000 means "no light here"
  seed(x_m: number, y_m: number): void;
  dispose(): void;
}
```

- Each region renders into **its own texture**, in its own flat 2-D frame; your mapper warps that texture onto the projector output, exactly as it does today.
- Background is **pure black** (`#000`), never a dark grey: anything not black shows as a grey rectangle on a real wall.
- Edges are **real boundaries** (or seams, phase 3), never wrap-around.
- My sims today each expose `create() → { init(w,h), step(dt), render(ctx), seed(x,y), params, setParam, presets, applyPreset, metric(), field(), resize, dispose }` and draw into a fixed-size buffer. Wrapping one as a `RegionContent` is a thin adapter.

## 2. Region metadata (the room model)

Each region carries, on top of what your mapper stores:

| Field | Meaning |
|---|---|
| `type` | `floor` / `wall` / `ceiling` — from the surface normal against world down, with a manual override |
| `size_m`, `polygon_m` | real size and outline, in metres, in the region's own 2-D frame (x along, y up) |
| `up_edge` | which edge is "up": walls `top`, roof facets `apex`, floors none |
| `gravity_local` | `g_t` = the along-surface "down" in local axes; `g_n` = + presses in, − peels off. Wall `g_t=[0,−1], g_n=0`; floor `g_t=[0,0], g_n=+1`; a roof facet of pitch θ: `g_t=[0,−sin θ], g_n=−cos θ` |
| `seams` | which edge meets which edge of which region, plus the 2-D rigid map across it (rotation + translation), so things crossing keep position and heading |
| `masks` | polygons (local metres) where the surface is blocked: door, window, furniture, a loft deck. Masked = black and a wall for agents |

Claude enters this over MCP from a description ("this region is the north wall, 1.81 m wide, 2.25 m tall, its top edge meets roof-N"). A camera can fill it automatically later (phase 6).

## 3. MCP tools (proposed — rename to match yours)

```ts
// phase 1 — life as content
list_life_systems() → { id, name, presets: string[], params: { key, min, max, default }[] }[]
set_region_life(region: string, system: 'grayscott' | 'physarum' | 'particlelife' | 'lenia' | 'off',
                preset?: string, params?: { palette?: string, [k: string]: unknown })
seed_region(region: string, x_m: number, y_m: number)
snapshot_region(region: string) → PNG                // what's in the region's texture now

// phase 2 — the room model
describe_region(region: string, { type, size_m, up_edge, seams, masks })
link_seam(region_a: string, edge_a: string, region_b: string, edge_b: string)
set_mask(region: string, mask_id: string, polygon_m?: [number, number][], on?: boolean)

// phase 3 — climate
set_climate({ gravity, drift, geotaxis, speed, seams, px_per_m })

// phase 4–5 — Plate VII and the naturalist
introduce_species(habitat_or_region: string, count: number,
                  genome: { feet, grip, mass, swing_m, flight_s, ... })
room_census() → { per_region: { [id]: { population, lineages } }, per_habitat: {...}, deaths, falls }
snapshot_room() → PNG                                 // the projector outputs, for Claude to look at
name_species(lineage_id: string, binomial: string)    // "Pendulor tectorum"

// phase 6 — sensing
calibrate_room() → regions                            // structured light
read_shadows() → mask per region                      // webcam
```

The visualiser has an **MCP preview** that prints the exact calls (JSON) that would rebuild any of its scenes on your rig — e.g. 18 × `describe_region`, 18 × `set_region_life`, one `set_climate`. Ask James for a dump of the scene you want to test against.

## 4. Phases — deliverables and acceptance checks

| # | Phase | Deliverables | MCP added | Done when |
|---|---|---|---|---|
| 0 | **Read the repo, agree the interface** | Notes on your stack, region storage, existing tools; `RegionContent` agreed; a test-pattern module | — | A test pattern from a JS module fills one mapped region |
| 1 | **Life as projected content** | Sims pulled out of the cabinet page into a library both repos import (James's `artifical-life` repo stays the source of truth); one sim per region → that region's texture; real boundaries; pure black; projection palettes | `list_life_systems`, `set_region_life`, `seed_region`, `snapshot_region` | Three regions run three different sims at 60 fps; an empty region measures as projector black |
| 2 | **Room model** | Region metadata (§2) stored with your regions; Claude enters it over MCP | `describe_region`, `link_seam`, `set_mask` | The She'd described as 18 regions (8 walls, 8 roof facets, floor, loft deck); every seam pairs up; gravity arrows point the right way |
| 3 | **Cheap spatial wins** | Gray-Scott drift along `g_t` (patterns drip down walls); Physarum geotaxis + agents crossing seams; Particle Life with gravity and grip | `set_climate` | Drips visibly run down a wall; agents cross the eave seam without a jump |
| 4 | **Plate VII** | Fork the ecology sim: grip cells, a timing gene (a per-organism clock: a central pattern generator), pull-off force, pendulum hang, falls between regions, floor detritus. A headless Node evolution harness measuring grips per body, speed and a swing index per surface; pre-evolved starting genomes per surface | `introduce_species` | Ceiling lineages evolve a higher swing index than floor ones with no gait scripted |
| 5 | **Naturalist** | Census, naming in the cabinet's Latin-binomial style, climate, snapshots Claude can look at | `room_census`, `snapshot_room`, `name_species` (+ `set_climate`, `introduce_species`) | Claude runs a census, spots a new lineage in a snapshot and names it |
| 6 | **Sensing** | Webcam shadows feed the light field; structured-light calibration (the projector throws patterns, a camera reads them) captures geometry | `calibrate_room`, `read_shadows` | Auto-calibrated regions land within ~1 cm of the hand-mapped ones |

If your stack isn't browser/JS: either run the sims in a browser output window your mapper captures, or port the two cheapest (Gray-Scott, Physarum) first and leave the rest for later. Decide in phase 0.

## 5. Risks

1. **CPU budget across many regions.** 18 regions × one sim each. One global budget split by region area; cut populations hard (the cabinet's Physarum runs 260k agents on one screen); grid sims on the GPU (ping-pong render targets) if needed.
2. **Black level and ambient light.** A projector's "black" is a faint grey glow over its whole frustum. Dark room, black content, and nothing projected where nothing lives.
3. **Coloured walls.** Projected light is multiplied by the paint (the She'd is pale sage `#cfdad2`). Choose palettes per surface; colour-compensate later.
4. **Seams across regions with different pixel densities.** Simulate in metres at one px/m everywhere; your mapper resamples per region — never the sim.
5. **Projection shadows.** Furniture, a loft and people block light. One projector leaves big shadows; two from opposite corners fill most of them.

## 6. What the visualiser measured

<!-- LEAD FILLS THIS SECTION after the coverage + fps run.
     Source of truth for the page: src/components/portal/modules/projector-life/ui/measurements.js -->

> **Pending.** Numbers go here once measured (headless Edge, d3d11, the Stage's coverage readout with occlusion on).

Computed from the room's geometry (true now):

- A throw ratio of **~1.2** fills one wall flat from the room centre (2.18 m away, 1.81 m wide).
- A typical **standard-throw (~1.5)** projector in a corner throws a picture about **2.7 m** wide on the far wall: about one and a half flats.
- A typical **short-throw (~0.5)** from the same corner throws **~8 m**: the whole far half of the room, corners included — which is why mapping (not one flat rectangle) matters.

To fill:

| Measure | Value |
|---|---|
| Frame rate, default scene | *pending* |
| Coverage, one standard-throw projector | *pending* |
| Coverage, one short-throw projector | *pending* |
| Coverage, two-projector rig (opposite corners) | *pending* |
| Roof facets reached by the two-projector rig | *pending* |
| Surfaces that stay dark | *pending* |

## 7. Questions for you (answer from your repo first)

1. **What's the repo and its stack?** (Browser/JS runs the sims as-is; Python, TouchDesigner or Unity needs an output window or a port.)
2. **How are regions stored?** Polygons in projector pixels, homographies, meshes? Are they labelled floor / wall / ceiling, and do they know their real size in metres?
3. **Is there a camera?** Phase 6 depends on it.
4. **How many regions at once**, and how many projectors? Sets the CPU budget.
5. **Which projector and lens?** Throw ratio, lumens, black level.
6. **Which MCP tools exist already?** New ones should extend your naming, not fight it.

## 8. Honesty notes from the visualiser

- Simulated there: the sims, gravity per surface, creatures/falls/selection, projector optics (throw, aspect, fall-off), occlusion shadows, coverage.
- Illustrated/approximate: the room's look (a Blender light bake), wall colour estimated from that bake, *typical* throw ratios (not your lens), hand-written creature gait families (selection only tunes numbers; real Plate VII evolves the gaits), a centred-lens projector (no lens shift).
