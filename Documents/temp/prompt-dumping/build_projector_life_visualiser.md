# Build: "Projector Life", a 3D visualiser of artificial life projection-mapped onto the She'd (portal, Personal)

## You are running unattended

I've left my PC on and I'm not here. **Do not ask me anything**: no AskUserQuestion, no plan mode (EnterPlanMode/ExitPlanMode would sit waiting for approval), no "shall I continue?". When something is ambiguous, make the call a good engineer would make, write it down in `DECISIONS.md` (see below), and keep going. Don't stop early. Keep working until the quality bar at the end is met. If something is truly blocked, take the best fallback, note it, and carry on with everything else.

The run will be long and your context may get compacted. Keep a running log at `Documents/projector-life/PROGRESS.md`: what's done, what's next, what's broken. Then you (or a resumed you) can always pick up where you left off. Commit checkpoints as you go (see Git).

---

## What this is and why

My mate has bought a projector. He's had Claude build him **projection-mapping software with an MCP layer**. He maps a region of the room and asks Claude to design content for it. I've got an **artificial-life simulation**, the "Specimen Cabinet" (Lenia, Gray-Scott reaction–diffusion, Physarum slime mould, Particle Life, the Primordial Particle System and an evolving ecology). It runs in my portal's **Artificial Life** tab. We want to merge the two:

1. **Level 1:** project the existing simulations onto mapped regions of a real room.
2. **Level 2, the interesting one:** life that **understands the surface it lives on**. Every mapped surface becomes a habitat with its own gravity:

| Surface | What gravity does there | What life should do |
|---|---|---|
| **Floor** | presses into the surface | crawl freely; gripping is a wasted cost |
| **Wall** | drags along the surface, downward | grip or slide; many feet and alternating steps, **insect-like** |
| **Ceiling / roof** | peels off the surface (plus a downslope pull on a pitched facet) | hang on. Hanging from one grip point makes the body a **pendulum**: seen from below, a spring pulling it back toward the anchor. So it can **swing**, let go at the top of the swing, coast and re-grip, the way gibbons swing (brachiation). Let go too long and it **falls** onto whatever is below |

Out of that comes a room-wide food web. Ceiling-dwellers drop waste and bodies, the floor becomes a scavenger habitat, and the eave line is a ledge. Lineages split by surface because each surface favours different traits. The long-term version is a new specimen, "Plate VII", that **evolves** grip and gait rather than having them scripted. A Claude-driven MCP layer then acts as the room's naturalist: it counts the population, names new species in the cabinet's Latin-binomial style, and sets the "climate".

**I can't see any of this yet.** I want a page that shows me, in a real 3D model of a real room, what this would look like once it's built. It also has to hold the plan for building it. The room is the **"She'd"** from my Memory Rooms project: Justin's octagonal shed in Perth. It's been modelled and light-baked, so the dimensions are real.

---

## What to build

A **new portal page** in the **Personal** sidebar group, **separate from the existing Artificial Life tab**. Leave that tab exactly as it is.

- Registry id **`projector-life`**, label **`Projector Life`**, placed directly after `artificial-life` in `src/components/portal/registry.js`. Route: `/portal/projector-life`.
- A new single-colour SVG icon in `src/components/portal/icons.jsx` (a projector, or a projector cone onto a surface; never emoji).

### Page layout

- **The first thing I see is the render.** The 3D stage fills most of the viewport when the tab opens. It loads in about 2 s and is **already alive**: life is running on the surfaces and the projector is on, playing the default scenario. No intro text above it, and no long-scroll page.
- Top tabs (see the memory note "Engaging learning pages"):
  1. **Visualiser** (default): the stage, plus a controls panel. On desktop the panel is a collapsible side panel; at phone width it's a drawer below the stage. Every control group can be collapsed.
  2. **Plan**: the merger plan (see "Plan tab").
  3. **Applications**: what this could be used for, shown visually, with short bullets.
- Follow my design feedback in memory. In particular: **no** coloured rounded left-border callout boxes and **no** filled pills. Use a labelled dot on ruled, editorial layouts, **no big text chunks**, and make it exciting. Use the portal's tokens for light and dark theme on the panel and tabs. The 3D stage itself is a dark room in both themes, because projection needs the dark.

### 1. The scene: the She'd, with a new pointed roof

**Source model:** `memory-rooms-work/50ead10e-e75f-4aa5-8f39-3dc2f5e47149/room.glb`. That folder is gitignored work, so **copy** the GLB into the module (e.g. `src/components/portal/modules/projector-life/assets/she-d.glb`, imported with `?url`). Never modify anything in `memory-rooms-work/`, the live spot, or `src/memory-rooms/`.

What I know about it. Check every number yourself against the GLB (accessor min/max, node transforms) before relying on it, and record the measured values in `CONTRACTS.md`:
- **Regular octagon**, 4.36 m across the flats (apothem 2.18 m), side 1.81 m, 4.72 m across the corners (circumradius 2.36 m).
- Walls rise 2.14 m to a white fascia band. Eaves (top of the band) are at **2.25 m**. A horizontal panel-joint batten runs at 1.23 m.
- The **current roof** is a low battened pyramid (about 12°) up to a small flat octagonal cap (circumradius 0.28 m) at 2.68 m.
- Frame: **north = the flat facing the door**. The door is on the **south** flat: 0.94 m wide including the lining, 2.08 m tall, centred. The **NE flat** has a tall narrow window: 0.67 m wide, sill 0.40 m, top 2.07 m, cream frame, dark glass, diamond security grille.
- A **sleeping loft** with a deck at 1.10 m runs across the SW, W and NW flats, with a balustrade to 1.88 m. Furniture: a car seat, heater and cabinet under the loft, a barrel, a rust armchair against the N flat, a wheelchair by the window, a road-case trunk with a desk lamp, a chair with a duvet heaped on it by the door, and a tub with a jacket on it.
- Full detail: `memory-rooms-work/50ead10e-…/layout.md` and `scene.json`. The shell is the 4.36 m bounding square; `bespoke/octagon.py` in that folder is the Blender script that trimmed it into the octagon.
- GLB facts:
  - 33 nodes: `ceiling` (the old pyramid roof), `floor`, `wall_north/east/south/west`, `obj__octagon` (band, battens, joints, fluoro, switch, possibly the cap) and the `obj__*` furniture.
  - **Each axis wall node also owns one diagonal flat** (NE→north, SE→east, SW→south, NW→west). So **derive the 8 wall flats geometrically** (centre, apothem, eave height), not from node names. Then verify your flats against the GLB's actual vertices.
  - Materials: one baked atlas, **unlit** (`KHR_materials_unlit`), with a webp texture (`EXT_texture_webp`), plus a glass material. Blender did all the lighting.
  - Copy the loading conventions from `src/memory-rooms/viewer/RoomViewer.js` and `bakedMaterials.js`: unlit, sRGB out, no tone mapping. Don't import or change those files; take what you need.

**The new roof (my request):** replace the low roof with a **slightly pointed octagonal roof**. Build it in three.js at runtime, with no Blender re-bake:
- **8 triangles** from the 8 eave corners (circumradius about 2.36 m at the eave height, 2.25 m) to **one central apex**.
- Hide the old `ceiling` node, plus the flat cap wherever it lives.
- Apex height is a **slider**. Default about **3.3 m**, a pitch of roughly 25°. Range from about 2.7 m (≈12°, the original look) to about 4.2 m (≈42°). Show the pitch in degrees next to it.
- Give the facets a quiet unlit material that sits with the baked look: the old ceiling colour `#efede8`, slight per-facet shading so the facets read, and thin hip battens down the 8 hips.
- It doesn't have to be perfect. It does need to close the room cleanly at the eave, with no gaps or z-fighting visible from inside.
- The roof facets are projection surfaces too. They're the "ceiling" habitat, and **their pitch matters**: a steeper facet has more downslope pull and less pull-off. So the apex slider should visibly change ceiling behaviour.

**Cameras:**
- Orbit controls.
- One-click views:
  - **Cutaway three-quarter**, the default if it looks best. The near walls fade like the Memory Rooms dollhouse, so roof, walls and floor all show at once.
  - **Standing at the door**, eye height 1.6 m.
  - **Sitting in the armchair**.
  - **Lying on the loft looking up at the roof**.
  - **Projector's point of view**.
  - **Top-down plan**.
- Smooth transitions between views. Respect `prefers-reduced-motion`.

### 2. The room as habitats (the room model)

Build a **room model**: a list of planar **patches**, each with:
- its 3D corners, normal, size in metres and surface type (`floor`, `wall` or `ceiling`, from the normal against world down, with a manual override);
- masks (door, window, loft and furniture where it blocks the surface);
- a local 2D frame, plus **seams** (which edge meets which edge of which patch, and how the coordinates map across).

That covers 8 wall flats, 8 roof facets, the octagonal floor, and ideally the loft deck as a floor-type patch at 1.10 m. All of it has to rebuild when the apex slider moves.

For every patch, compute its **gravity in local coordinates**:
- `g_t`: the component along the surface, which is the "down" direction on that patch;
- `g_n`: pressing in versus peeling off.

Simulate in **metres**, at one consistent pixels-per-metre (a tweakable "sim resolution"), so things keep their size when they cross a seam.

### 3. Life on the surfaces

**Reuse the real simulations.** The modules live in `public/artificial-life/src/systems/*.js`, with helpers in `src/lib/`. Each `create()` returns `{ init(w,h), step(dt), render(ctx), seed(x,y), params, setParam, presets, applyPreset, metric(), field(), resize, dispose }`. Each draws into a fixed-size `Surface` buffer.

**Don't edit `public/artificial-life/`**. It's a mirror of my `artifical-life` repo, and the Artificial Life tab depends on it. Copy the systems you need into this module's folder and adapt the copies. Give each copied file a provenance header saying where it came from and what changed.

Adaptations:
- **One simulation per patch** (or per group of patches), hosted on a mask instead of a wrap-around grid. The sims' edges currently wrap; Gray-Scott runs on a 256×256 grid whose bottom joins its top. Edges must be real boundaries, or seams.
- **Pure-black background** (`#000`) for anything projected. The cabinet's `#0a0a09` would show as a grey rectangle on a real wall. Use brighter, more saturated palettes suited to projection, with a palette option per system.
- **Spatial variants** (the cheap "wow" wins):
  - **Gray-Scott with drift along `g_t`**: patterns drip down the walls like rain on glass, and creep down the roof facets.
  - **Physarum pulled up or down** (geotaxis, a tweakable sign and strength), with agents that **cross seams**: wall to roof at the eave, wall to wall at the corners, wall to floor at the bottom.
  - **Particle Life with gravity and grip**.
  - For grid simulations, exchange edge cells across seams if you can make it solid. If not, keep each patch independent with a soft edge fade, and record that in DECISIONS.
- **Creatures (a "Plate VII" prototype):**
  - Agents with a body, N feet, grip strength and mass, living in patch coordinates and crossing seams.
  - Gaits by surface: crawl on the floor; insect-style alternating steps on walls (enough feet planted at all times, otherwise slip and slide down); on the ceiling, **pendulum hang and brachiation**: a one-foot hang acts as a spring toward the anchor, then release at speed, a timed free flight, and re-grip.
  - If grip × planted feet can't hold mass × gravity, the creature **falls**. Animate it falling through the 3D room in world space, ray-cast onto whatever is below (floor, loft deck, furniture tops), and land it there. Mark mid-air bodies as **"not projectable"**, with a toggle to hide them for a "what the real projection shows" view.
  - **Light selection toy:** each creature carries a small trait vector (feet, grip, mass, swing propensity, free-flight time). Falling or starving kills; survivors reproduce with mutation. Show **trait histograms per surface type** so I can watch ceiling, wall and floor populations drift apart.
  - **Be honest on the page:** the gait families are hand-written, and selection only tunes the numbers. The real Plate VII would evolve the gaits themselves (Plan, phase 4).
  - Optional food web: fallen bodies become detritus on the floor, and floor scavengers seek it.
- Budget the work: one global simulation budget split by patch area. There are about 18 patches, so cut populations a lot from the cabinet's (Physarum runs 260k agents on one screen). Use Web Workers, or GPU ping-pong render targets for the grid simulations, if the frame rate needs it. Pause when the tab is hidden or the module unmounts.

### 4. The projector

The point of the visualiser is to show **what a real projector would actually put on this room**, not just paint textures on the walls.

- A **virtual projector** in the room with a visible frustum. Position, aim, roll, **throw ratio** and aspect are adjustable, with presets for typical throw ratios: standard (~1.5), short throw (~0.5) and ultra-short (~0.25). Label these "typical"; I don't know my mate's model. Brightness and **black level** are adjustable too: real projectors throw a faint grey glow across the whole frustum, even for black pixels.
- **1 to 3 projectors.** A **coverage view** colours the surfaces by how many projectors reach them, including **occlusion**: shadow-map from each projector, so the loft and furniture cast real projection shadows. Readout: % of each surface type covered.
- **Light model:** the result should look like light landing on paint:
  - an ambient/room-lights slider darkens the baked scene;
  - projected light gets multiplied by the surface's colour (the walls are pastel sage `#cfdad2`, so projection on them is tinted);
  - fall-off with distance and incidence angle, so grazing surfaces look dimmer and stretched;
  - optional pixel-size visualisation: projector pixels per metre at that throw.
- **Mapping modes:**
  - **Mapped:** the software has mapped regions, so content sits undistorted on each patch wherever coverage exists.
  - **Raw/unmapped:** the projector throws one flat rectangle, and the content warps across the corners. This before/after shows why mapping matters.
- **Projector-view inset:** picture-in-picture of **what the projector must actually output**, the pre-warped image from the projector's point of view. This is the mapping software's job made visible.
- **Unfolded-room inset:** the room's patches laid flat as a net (like a cube net, but walls, roof facets and floor), with the simulations running flat on it and the seams drawn. This shows the room model itself.

### 5. Controls: lots of them, grouped

Put **one source of truth** in `params.js`: every control's key, label, group, range, default and unit. Presets are partial overrides of those defaults. Starting groups (add more where they earn their place):

- **Room:** apex height and pitch; show furniture; show loft; wall cutaway/fade; room lights (ambient); show old vs new roof.
- **Projectors:** count; per projector position, aim, roll, throw ratio, aspect, brightness, black level; frustum on/off; coverage view; occlusion on/off; pixel-size view.
- **Mapping:** mapped/raw; region list with on/off per patch, surface-type override and mask toggles (door, window, loft, furniture).
- **Life:**
  - which system per surface type, or per patch;
  - system preset, sim speed and substeps;
  - seed / reseed / clear, and seeding by clicking a surface in 3D;
  - gravity strength; drift strength; geotaxis sign and strength;
  - seams on/off; sim resolution (px/m); palette.
- **Creatures:** population per surface; feet; grip; mass; swing length; free-flight time; gravity scale; selection on/off; mutation rate; detritus/food web; show mid-air (not projectable).
- **Visual aids:** gravity arrows per patch (`g_t` arrow, `g_n` as a colour or ring); seam lines; patch labels; both insets; fps readout.
- **Stage:** play/pause/step; **save PNG**; reset all.
- **MCP preview drawer:** shows the **MCP tool calls** that would reproduce the current scene on the real system (e.g. `describe_region`, `set_region_life(region, system, preset, params)`, `seed_region`, `set_climate`), as JSON in a VS Code-style code block. This turns the visualiser into a spec for my mate's MCP layer.

### 6. Presets (one click, each a hero shot)

Each preset sets many controls and moves the camera. Starting list:
- **The living shed** (the default): mixed systems, one well-placed projector, creatures on.
- **Slime-mould shed**: Physarum on every surface, crossing the seams.
- **Coral walls, dripping**: Gray-Scott with drift.
- **Ceiling swingers**: creatures on the roof, steep apex, low grip, falls visible.
- **Room food web**: selection on, detritus, histograms open.
- **Projector reality check**: one standard-throw projector, coverage view, raw vs mapped.
- **Two-projector rig**: a placement that covers most of the room. Find a good one using the coverage readout.

Every preset must look good in a screenshot (see Quality bar).

### 7. Plan tab

Turn the concept above into the **merger plan**, refined by what building the visualiser taught you. Starting phases:

0. **Read the projection-mapping repo** and agree a "region content" interface. Unknowns: its stack (if it isn't browser/JS, the simulations run in a browser output window or get ported); how regions are stored; its existing MCP tools.
1. **Life as projected content:** pull the simulations out of the cabinet page into a library both projects import (my `artifical-life` repo stays the source of truth); one simulation per region rendering to that region's texture; boundaries instead of wrap-around; pure black; MCP v1 (`list_life_systems`, `set_region_life`, `seed_region`, `snapshot_region`).
2. **Room model:** region metadata (surface type, size in metres, up edge, seams, obstacle masks) entered by Claude over MCP; camera auto-detection later.
3. **Cheap spatial wins:** drift on Gray-Scott, geotaxis and seams on Physarum, gravity on Particle Life.
4. **Plate VII:** fork the ecology simulation and add grip cells, a timing gene (an internal clock per organism, i.e. a central pattern generator), pull-off force, pendulum hang, falling between regions and floor detritus. Run a headless evolution harness in Node, measuring grips per body, speed and a swing index per surface. Pre-evolve starting genomes per surface.
5. **Naturalist MCP layer:** `room_census`, `introduce_species`, `set_climate`, a snapshot Claude can look at, and naming species.
6. **Sensing:** webcam shadows feed the light field. Structured-light calibration (the projector throws patterns, a camera reads them) captures the geometry automatically.

Also on the Plan tab:
- **Risks:** CPU budget across many regions; black level and ambient light; coloured walls; seams across regions with different pixel densities.
- **What the visualiser showed:** e.g. what throw ratio and how many projectors this 4.36 m shed needs, and which surfaces stay uncovered. Use real numbers from the coverage readout.
- **Questions for my mate:** his repo/stack; whether regions are labelled floor/wall/ceiling; whether there's a camera; how many regions at once.

Make it visual (a phase timeline, diagrams, short bullets), not text walls. Also write the plan as `Documents/projector-life/merger-plan.md`, written so I can hand it straight to my mate's Claude Code as a starting brief.

---

## Where things are

| What | Path |
|---|---|
| Portal registry (add the entry) | `src/components/portal/registry.js` |
| Portal icons (add one) | `src/components/portal/icons.jsx` |
| Existing Artificial Life tab (**don't change**; shows the iframe and fullscreen pattern) | `src/components/portal/modules/ArtificialLife.jsx` + `.css` |
| The simulations (**read-only**; copy what you need) | `public/artificial-life/src/systems/*.js`, `src/lib/{surface,palette,rng,fft}.js`, `src/main.js` (fixed-tick loop and budget) |
| She'd model and its notes (**read-only**) | `memory-rooms-work/50ead10e-e75f-4aa5-8f39-3dc2f5e47149/` (`room.glb`, `layout.md`, `scene.json`, `bespoke/octagon.py`, `renders/`) |
| Memory Rooms viewer (unlit baked loading, dollhouse fades, camera helpers; **read-only**) | `src/memory-rooms/viewer/RoomViewer.js`, `bakedMaterials.js`, `dollhouse.js`, `helpers.js`, `src/memory-rooms/scene/geometry.js` |
| An existing headless page check (portal gate seeding, puppeteer-core + local Edge) | `tools/dl-lecture4-study/page-check.mjs`; also my memory note "Headless soak kit" |
| three.js, React Three Fiber, drei and GSAP are already dependencies | `package.json` (three ^0.185). Plain three.js like RoomViewer, or R3F, is your call; record it |
| Obsidian vault | `C:\Users\james\Documents\james-claude-brain` |

Suggested layout (adjust if you have a better one, and record why):
```
src/components/portal/modules/projector-life/
  ProjectorLife.jsx        shell + tabs
  projector-life.css       scoped classes (pick a prefix nothing else uses)
  CONTRACTS.md             room model, sim host, projector API, params schema
  DECISIONS.md             every call you made unattended, one line each + why
  params.js  presets.js
  room/        GLB load, roof, patches + seams + gravity, cameras
  life/        adapted sims, patch host, creatures, selection
  projection/  projector(s), projective shader, shadows/coverage, insets
  ui/          controls, insets, MCP preview, Plan + Applications tabs
  assets/she-d.glb
tools/projector-life/       sim-check.mjs (headless, Node), page-check.mjs, shots.mjs, soak
Documents/projector-life/  merger-plan.md, PROGRESS.md, run-report.md, screenshots/
```

## Constraints

- **The main working tree has uncommitted work from another session** (Memory Rooms map files, `package.json`, `package-lock.json` and others). Don't touch, stage, stash, reset or commit any of it. That's why you work in a worktree (see Git).
- Don't change: `public/artificial-life/`, `ArtificialLife.jsx/.css`, `src/memory-rooms/`, `workers/`, `memory-rooms-work/`.
- No new npm dependency unless it clearly earns its place. If you add one, record why in DECISIONS.
- Unmounting must clean up completely: cancel requestAnimationFrame, terminate workers, dispose geometries, materials and textures, and call `renderer.dispose()` plus a context release. Switching portal tabs back and forth must not leak WebGL contexts or throw.
- Lint only your own files: `npx eslint src/components/portal/modules/projector-life tools/projector-life`. `npm run build` must pass.

## Team: use subagents

Use the Agent tool to run focused subagents. Keep the team lean, about 6, and avoid near-duplicate agents. **Subagents only know what you give them**, so give each one the path to this file, the section it owns, `CONTRACTS.md`, and the folders it may write. **File ownership must not overlap**; you integrate.

1. **You (lead), first:**
   - Set up the worktree and install dependencies.
   - Read the files above.
   - Measure the GLB frame (axes, octagon centre, eave and cap heights, which node holds the cap).
   - Write `CONTRACTS.md`: patch shape, seam mapping, sim-host interface, projector API, and the `params.js` schema.
   - Stub the module so the tab renders.
2. **Room agent** (owns `room/`): GLB loading, the new roof, patch extraction with masks, seams and gravity, cameras. Includes a Node check that the patches close the room, the seams pair up, and the gravity directions are right for floor, wall and pitched roof.
3. **Life agent** (owns `life/` + `tools/projector-life/sim-check.mjs`): adapted simulations on patches, spatial variants, seam crossing, creatures and selection. Headless checks: no NaN, populations stay bounded, ms per step within budget.
4. **Projection agent** (owns `projection/`): projectors, projective texturing, occlusion and coverage, light model, raw vs mapped, both insets.
5. **UI + Plan agent** (owns `ui/`, `ProjectorLife.jsx`, the CSS, `params.js`/`presets.js` contents, `merger-plan.md`): tabs, the controls generated from `params.js`, presets, MCP preview, Plan and Applications tabs. Works against the contract with stubs until the others land.
6. **QA agent, after integration** (owns `tools/projector-life/page-check.mjs`, `shots.mjs`, soak):
   - Headless Edge with real GPU (see the "Headless soak kit" memory note) through the portal gate.
   - Screenshot every preset and every tab, in light and dark theme, at desktop and phone width.
   - Measure fps.
   - Switch tabs 10× to check for leaks.
   - Check for console errors.
7. **Two fresh-eyes reviewers, after QA**, each given the brief and the code or screenshots, **not your conclusions**:
   - a **visual critic**: does each screenshot meet this brief, and does it look good?
   - a **code reviewer**: correctness, leaks, performance traps.

Fix what they find, re-shoot, and repeat until it's right.

## Quality bar (check all of these before you finish)

- Opening `/portal/projector-life` shows the live render within about 2 s, with the default preset running and nothing above it but the tabs.
- The pointed roof closes the room cleanly; the apex slider works and changes ceiling behaviour.
- You have **looked at** a screenshot of every preset in both themes and at phone width, and each one is a good-looking hero shot: no blank stage, no z-fighting, no seams tearing, no unreadable panel.
- Frame rate: **at least 45 fps at the default preset** on this PC's GPU (headless Edge with d3d11). Heavy presets degrade gracefully. Report the measured numbers.
- No console errors, no WebGL context leaks across 10 tab switches, `npm run build` passes, lint is clean for the new folders.
- The page is honest about what is simulated versus illustrated.
- `merger-plan.md` reads as a standalone brief for my mate's Claude Code.

## Git

- Work in an isolated worktree on branch **`feat/projector-life`**. Prefer the EnterWorktree tool. If you can't, use `git worktree add` to a folder inside the repo, and make sure git ignores it. Run `npm ci` there.
- Run the Vite dev server for the worktree on a free port. Vite here listens on `localhost` (::1) only, and port 8787 is taken by another project.
- Commit checkpoints on the branch as each part lands. Commit only your own paths, staged by explicit path, never `git add -A`.
- **At the end**, merge `feat/projector-life` into **local `main`**, so the tab shows up when I run `npm run dev` from the normal folder. Do it **only** if the merge touches none of the paths that are dirty in the main working tree. Never stash, reset or check out anyone else's files to make it work. If it isn't clean, leave the work on the branch and tell me why. **Never push. Never deploy.**

## Wrap-up

- **Vault** (per `CLAUDE.md`):
  - create `01-Active-Projects/wigfield-portfolio-projector-life.md`: what it is, the concept, the architecture, where things live, and the open questions for my mate;
  - add a dev log in `03-Dev-Logs/` dated today;
  - link them with [[wigfield-portfolio-management-portal]], [[memory-rooms]], [[wigfield-portfolio]] and any relevant knowledge notes.
- **Memory:** add a project memory entry for the new tab (how it's built, how to add a preset or a simulation, and the checks), with a pointer line in MEMORY.md.
- **Report:** write `Documents/projector-life/run-report.md` and finish with a short summary covering:
  - what was built and how to open it;
  - the merge status;
  - measured fps;
  - the decisions you made unattended (link DECISIONS.md);
  - what's approximate or unfinished;
  - the screenshots folder.
