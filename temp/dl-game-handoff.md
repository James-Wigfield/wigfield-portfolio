# HANDOFF PROMPT — "Scrolls of the Philosopher": a 3D deep-learning game in the portal

> Paste everything below this line into a fresh Claude Code session (Fable 5.1) opened at
> `C:\Users\james\Documents\personal-projects\wigfield-portfolio`, with Blender MCP connected.
> Written 2026-09-20 after a full feasibility analysis of the portal modules and the Unreal project.

---

## 0. Mission

Build a browser-based, 3D, third-person exploration game that teaches the CITS5017 Deep Learning
lecture material. You play a Greek philosopher who explores a small terraced island village, enters
houses, and finds scrolls. Each scroll unlocks a **room that IS the diagram** from the lecture slides.

The game lives inside the existing personal portal as a new tab in the **Deep Learning** section, and
can expand to fullscreen.

**Your job in this first session is the vertical slice**, not the whole game: one village, three
houses, one lecture (Lecture 3, Convolutional Neural Networks), shipped and working. Do not start
lectures 1, 2, 4, 5 or 6/7. Do not build a level editor. Get one loop genuinely good.

---

## 1. Read these before writing any code

**In this repo:**

| Path | Why |
|---|---|
| `src/components/portal/registry.js` | How a module is registered. Header comment explains the whole pattern. |
| `src/components/portal/modules/deep-learning/kit.jsx` | The teaching component vocabulary you must reuse: `Tex Hook Fact Unfold Section Outline Sub Eq Jot Note Code RefsProvider Fnote`. |
| `src/components/portal/modules/deep-learning/lecture3/Lecture3.jsx` | The lecture the game accompanies. Read the tab structure and the pedagogical spine. |
| `src/components/portal/modules/deep-learning/lecture3/labs.jsx` | Contains `ConvolutionLab`, `StrideLab`, `ParamShareLab`, `CortexLab`. **The 3D rooms are the spatial counterparts of these. Do not duplicate them, extend them.** |
| `src/components/portal/modules/deep-learning/lecture3/labs2.jsx` | `FeatureMapLab` (the only canvas widget), `StackingLab`, `KerasShapesLab`. |
| `src/components/portal/modules/deep-learning/common.css` | The `--dlv-*` categorical palette and `.dl-*` page framework. Light and dark variants. |
| `src/portara-test/components/hero-3d.tsx` | Working react-three-fiber reference in this repo: `<Canvas>`, `useGLTF`, drei, GSAP. |
| `src/portara-test/components/workers.tsx` | Second `useGLTF` reference, simpler. |
| `src/App.jsx` lines 31-33 and 83-91 | The lazy-load + `Suspense` pattern for a heavy 3D route. Copy this. |
| `CLAUDE.md` | Project memory rules. You must write a vault note at the end. See section 13. |

**Source material on disk (read the slides directly, do not guess the content):**

```
C:\Users\james\Documents\university\cits5017\lectures\cits5017-lect03-CNNs.pdf     (53 slides)
```

Read PDFs with the Read tool and a `pages` range, max 20 pages per call. The slides render as page
images so you get the figures, tables and equations. `pdftotext -layout -f N -l N <file> -` is
available and is the cheap way to locate a page or verify exact numbers in a table before spending
context on the image.

The other five decks are in the same folder. You will need them later; ignore them for now.

**The Unreal project is the art source, not the engine.** Read only these:

```
C:\Users\james\Documents\Unreal Projects\Portara2 5.8 - 2\blender\build_kit.py       (the kit authoring script)
C:\Users\james\Documents\Unreal Projects\Portara2 5.8 - 2\refs\character.glb          (the philosopher)
C:\Users\james\Documents\Unreal Projects\Portara2 5.8 - 2\BUILD_LOG.md                (world plan in metres, ~line 55)
```

Do not open the Unreal editor. Do not modify anything under `Unreal Projects`. Treat that whole tree
as read-only reference.

---

## 2. The concept

- You are a **short, bearded philosopher in a toga and laurel wreath, already holding a scroll.**
- The world is a **small Aegean village**: a plaza, three houses, a short colonnade, a sea edge, a hill
  behind. Warm stone, terracotta, cypress. Think Naxos.
- **Scrolls are hidden in and around the houses.** Picking one up unrolls the scroll in his hand,
  shows one short in-world line of text, and **activates the mechanism in that room**.
- **A room is a diagram you stand inside.** The floor, walls and objects are the figure from the
  slide. You operate it by walking, pushing and placing, not by reading.
- **Each house has an exit test.** A small action, not a multiple-choice wall. The door opens when
  you get it right.
- **The village lights up as you learn.** It starts at dusk with unlit lamps. Every scroll lights
  part of the village. Progress must be visible in the world, not only in a counter.

### The rule that governs every design decision

> **If it can be understood sitting still, it belongs on the 2D lecture tab, not in the game.**

3D earns its place only when **space or time is the lesson**. Convolution sliding across an image is
spatial. A learning-rate schedule is a curve, and a curve is better as an SVG. When in doubt, leave it
in the 2D lab and link to it.

---

## 3. What the three houses teach

Lecture 3 topic map, verified against the deck:

| Slides | Topic |
|---|---|
| 6-8 | Convolution, convolutional layers |
| 9-11 | Connections between layers, filters, feature maps |
| 12-15 | Stacking multiple feature maps, the convolution equation |
| 16-19 | Implementing conv layers with Keras |
| 20-21 | Padding options |
| 22-24 | Memory requirements |
| 25-31 | Pooling layers |
| 32 | Hyperparameters |
| 33-47 | CNN architectures, LeNet-5 onward |
| 48-51 | Pretrained models, transfer learning |

### House I — The House of the Window  (slides 6-11)

- The **floor is an eight by eight greyscale image**, one tile per pixel.
- The philosopher carries a **three by three kernel frame**. Where he stands, the nine tiles beneath
  the frame light up and their weighted sum is displayed on the frame itself.
- A **feature map builds on the far wall**, one tile at a time, as he walks the image.
- Two filter scrolls exist in the house: **a vertical line filter and a horizontal line filter**,
  exactly the two on slide 10. Swapping the scroll changes the wall output, reproducing figure 14-5.
- **Exit test:** the door shows a target feature map. Pick the filter that produces it.

### House II — The House of Many Eyes  (slides 12-15)

- A **three-storey open hall**. On the ground, three stacked translucent planes are the red, green and
  blue channels of the input. This is figure 14-6, built at walking scale.
- A **filter is a solid box that spans all three channels**. Push it and one output sheet forms
  overhead. Add more filters and more sheets form, each its own feature map.
- **Climbing the stairs moves you one layer deeper into the network.** Layer two's input is layer
  one's output, which you just made.
- The **convolution equation from slide 15 is engraved on the back wall**. Touching an object in the
  room lights the matching term in the equation. This is the one place where text and geometry meet.
- **Exit test:** given a filter count, say how many channels leave the layer.

### House III — The House of the Narrow Door  (slides 20-31)

- A **corridor of doorways**. Each doorway is a layer, and its width is set by **stride and padding**.
- Choosing **same** padding keeps the next room the same size. Choosing **valid** shrinks it. You feel
  the shrink because you walk through it.
- **Max pooling collapses a room to a quarter of its area**, keeping only the brightest tile from each
  two by two group. Average pooling blends them instead.
- **Exit test:** predict the output size before stepping through. Get it wrong and the door stays shut
  and shows you the arithmetic.

### Stretch, only if the three houses are finished and good

- An outdoor **colonnade of architectures** (slides 33-47), one column per historical network, growing
  taller and deeper from LeNet-5 to the modern ones. Pure spectacle, very cheap, high payoff.

---

## 4. Where it lives in this repo

Create exactly this:

```
src/components/portal/modules/deep-learning/
  game/
    Game.jsx            module entry, registered in registry.js, owns fullscreen + lazy boundary
    Scene.jsx           the <Canvas>, lighting, sky, post, the frame loop
    game.css            all styling, prefix .dlg-
    world/
      village.jsx       terrain, houses, colonnade, sea, props, instancing
      player.jsx        the philosopher, movement, camera rig
      interact.jsx      proximity prompts, scroll pickup, door gates
      progress.js       which scrolls are found, persisted to localStorage
    rooms/
      houseWindow.jsx   House I mechanism
      houseEyes.jsx     House II mechanism
      houseDoor.jsx     House III mechanism
    content/
      scrolls.js        pure data: id, house, slide range, in-world line, concept name, exit test
```

Models go in:

```
public/dl-game/            *.glb, served at /dl-game/<name>.glb
```

**Registration is one entry in `src/components/portal/registry.js`**, matching the existing shape:

```js
import DeepLearningGame from './modules/deep-learning/game/Game';
// ...
{ id: 'dl-game', label: 'Scrolls · 3D', icon: 'network',
  group: 'Deep Learning', component: DeepLearningGame },
```

Put it after `dl-lecture-3` and before `dl-code-lab`. The `Deep Learning` section already exists in
`SECTIONS`. `icon` must be a name that exists in `./icons.jsx`; reuse `network` rather than adding one.

**Lazy-load the 3D.** The portal must not pay for three.js on every page. `Game.jsx` is a thin shell
that does `lazy(() => import('./Scene'))` inside a `<Suspense>` with a painted fallback, exactly the
way `src/App.jsx` lazy-loads the portara-test route.

**Fullscreen** is the browser Fullscreen API on the canvas wrapper element, with a button in the
corner and Escape to leave. Handle the `fullscreenchange` event so the canvas resizes.

**CSS convention in this repo is plain global CSS with a manual class prefix.** No CSS modules, no
Tailwind. Use `.dlg-` for everything you add. Read the `--dlv-*` palette in `common.css` and use those
colours for anything that represents data, so the game and the 2D labs agree on what blue means.
Honour the dark theme block `.portal[data-portal-theme='arcade']`.

---

## 5. Stack — everything you need is already installed

Do not add a game engine, a physics library, or a state manager. Verified in `package.json`:

| Package | Version |
|---|---|
| three | ^0.185.1 |
| @react-three/fiber | ^9.6.1 |
| @react-three/drei | ^10.7.7 |
| gsap | ^3.15.0 |
| katex | ^0.16.45 |
| shiki | ^4.4.3 |
| react / react-dom | 19.2.4 |
| vite | 8 |

Build and deploy are unchanged: `npm run dev`, and `npm run deploy` runs a Vite build then
`wrangler deploy` to the existing Cloudflare Worker that serves `dist`.

You may add **one** small dev dependency if you need it for verification: `puppeteer-core`, driven
against the locally installed Edge or Chrome. Nothing else without asking.

---

## 6. The character — read this carefully, it de-risks the whole project

The philosopher already exists as a GLB and **he is not a skinned character**. I inspected it in
headless Blender. `refs\character.glb` contains:

- 75 objects: 12 empties and 63 meshes, **no armature and no skin weights**
- A clean rigid hierarchy: `rig` → `lift` → `bodyG`, with `armL`, `armR`, `head` under `bodyG`, and
  `legL`, `legR` under `lift`
- **He is already holding a scroll.** Three meshes named for the scroll spindle, the parchment spiral
  and an orange ribbon tail are parented under `bodyG`.
- 1.2 m tall, 0.87 m wide, 30,415 triangles
- 8 flat materials: toga warm alabaster, beard chalk ivory, laurel and ribbon vermilion orange,
  sandals charcoal leather, eyes polished charcoal, scroll creamy parchment, scroll spindle pale
  stone, stone warm limestone clay

**Therefore: animate him procedurally in three.js by rotating the named nodes.** Walk is a sine on
`legL` and `legR` with a counter-swing on `armL` and `armR` and a small vertical bob on `lift`. Idle is
a slow breath on `lift` plus a head drift. You need no animation clips, no skinning, no retargeting,
and no FBX pipeline. This is the single biggest reason the web version is cheaper than the Unreal one.

Do not try to reuse the Unreal skeletal mesh, its 27 retargeted animations, or the Manny rig. They do
not cross over and you do not need them.

**The scroll in his hand is a gameplay object.** When he picks up a new scroll, unroll the parchment
spiral he is already carrying and show the line on it. That is your diegetic UI.

---

## 7. The world assets — Blender pipeline

There is a proven, deterministic, headless Blender script that authors the entire village kit:

```
C:\Users\james\Documents\Unreal Projects\Portara2 5.8 - 2\blender\build_kit.py
```

Read it. The pattern is: one `def` per piece, metres, Z up, origin at ground centre, a flat material
palette dict at the top, a `piece(fn)` decorator that registers each piece, and a final export loop.
It currently exports FBX for Unreal. **You want GLB for the web.**

Write a new script in this repo at `tools/build_village.py`, modelled on that one but **much smaller**.
Do not copy all 29 pieces. The vertical slice needs roughly:

- 3 house shells, each with an interior volume and a doorway
- floor and wall tiles for the mechanism rooms
- a plaza disc and steps
- a few colonnade columns
- a parapet, a stair, a sea wall segment
- cypress and olive, one each
- a scroll pickup prop
- low-poly terrain with three terraces

**Reuse the exact palette from `build_kit.py`** so the art style matches the existing world. The RGB
values are in the `PALETTE` dict at the top: marble, stucco cream, stucco ochre, sandstone, terracotta,
paving, timber, cypress, olive, bark, rubble, grass, rock, marker. Materials are flat Principled BSDF
with base colour and roughness only. **There are no textures anywhere in the source project and you
should keep it that way.** The look comes from geometry, colour and light.

Run Blender headless when a script is the right tool:

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python tools/build_village.py
```

Blender 5.2.2 LTS is installed and verified working from the command line.

**On Blender MCP versus the CLI:** use MCP for inspection, iteration and anything interactive, since it
is faster to look at a scene than to re-run a script blind. But **the committed artefact must be the
script**, so the village can be rebuilt deterministically. Anything you shape by hand through MCP,
write back into `tools/build_village.py` before you finish. The previous build worked exactly this way
and it is why the world is reproducible.

Export GLB with Draco off, +Y up, metres, and one file per logical group rather than 30 tiny files.
Suggested: `village.glb`, `interiors.glb`, `props.glb`, plus `philosopher.glb` re-exported from
`refs\character.glb` with materials preserved.

**Budget:** total GLB payload under 8 MB. Cloudflare serves whatever you put in `public`, but the page
has to load on a phone. Instance repeated geometry with drei's `<Instances>`. One directional light
with a tight shadow cascade, an ambient or hemisphere fill, and no shadow casting on small props.
Target a steady 60 fps at 1080p.

---

## 8. Content and the scroll data model

Keep all lesson content in `content/scrolls.js` as **data, not JSX**, so the later lectures are cheap:

```js
{
  id: 'conv-filters',
  house: 'window',
  slides: '9-11',
  concept: 'Filters and feature maps',
  line: 'A filter is a small window. Slide it, and the wall remembers what it saw.',
  unlocks: 'filterSwap',
  test: { kind: 'pick-filter', answer: 'vertical' },
  lectureTab: 'filters',
}
```

`line` is the in-world text. It is **one or two sentences, in character, never a paragraph**. The full
treatment already exists on the 2D lecture tab, and `lectureTab` is how you link back to it.

**Do not restate lecture prose in the game.** The game's job is the mechanism. When the player wants
the words, they click through to Lecture 3.

Use KaTeX for the one engraved equation in House II. Do not build a maths renderer.

---

## 9. Progression, feel and polish

These are what make it a game rather than a demo. Budget real time for them.

- **Visible progress.** Village starts at dusk with unlit lamps. Each scroll found lights a lamp or a
  window. When all scrolls in a house are found, that house's roof lantern comes on.
- **Persist it.** `localStorage`, wrapped in try and catch, with the page rendering correctly when it
  comes back empty. Key it per lecture.
- **A companion voice.** One weathered stone bust in the plaza that speaks a line when you approach,
  and a different line when you fail an exit test. Cheap, and it carries the whole tone.
- **Sound.** Footsteps on stone, a distant sea loop, a soft chime on pickup. This is the cheapest
  immersion available and the game feels dead without it. Keep the files small and lazy-load them.
- **Camera.** Third person outside so you can see the philosopher and the village. **Switch to over the
  shoulder or first person inside a mechanism room**, so the lesson is in front of you rather than
  behind his head. This one choice does more for clarity than any amount of polish.
- **Controls.** WASD and arrows, mouse look, E or Space to interact, Escape to leave fullscreen. Show a
  small control hint on first load. Make it work with a trackpad.
- **Accessibility.** Every mechanism must also be operable by keyboard alone, and every room needs a
  text description of its state for anyone who cannot parse the 3D. The existing 2D labs already do
  keyboard-accessible crosshairs; match that standard.

---

## 10. Build order — do not skip ahead

1. **Registry entry and empty shell.** `Game.jsx` renders a placeholder, appears in the sidebar under
   Deep Learning, fullscreen toggle works. Commit.
2. **Scene with a grey box world.** Canvas, lighting, camera, a ground plane and three cubes for
   houses. Movement working. Commit.
3. **The philosopher in, walking.** Load `philosopher.glb`, procedurally animate the named nodes, third
   person camera follow. This is the first moment it feels real. Commit.
4. **The village from Blender.** `tools/build_village.py`, exported GLB, placed, instanced, lit. Commit.
5. **House I complete**, including scroll pickup, the mechanism, and the exit test. Commit.
6. **Houses II and III.** Commit each.
7. **Progression, lamps, bust, sound, polish.** Commit.
8. **Verify, document, deploy.**

Commit at each numbered step. There is no git history on the Unreal work and it has cost real
duplication; do not repeat that here. This repo is on branch `feat/arcade`, so **create a new branch
for this work** rather than building on that one.

---

## 11. Verification

You must actually look at what you build. Three ways, in order of preference:

- **Claude in Chrome** if the session has it. Navigate to the dev server, screenshot, read the console.
- **`puppeteer-core` against local Edge or Chrome.** Launch with a real GPU so the frame rate is
  meaningful rather than software-rendered, take screenshots, read console errors.
- Ask the user to look, as a last resort.

Check on every milestone: no console errors, no WebGL context warnings, the frame rate on the village
at 1080p, the load time of the GLB payload, and that the page still works when localStorage throws.

Also run `npm run lint` and `npm run build` before you call anything done. A Vite build failure is the
one way this breaks the whole portal.

---

## 12. Things not to do

- Do not open, modify, or package the Unreal project. It is read-only art reference.
- Do not add three.js or R3F to the portal's eager bundle. Lazy boundary only.
- Do not rebuild the 2D labs in 3D. `ConvolutionLab` is good; the room is its spatial sibling, not its
  replacement.
- Do not put lecture prose on scrolls. One or two in-character sentences maximum.
- Do not try to cover lectures 1, 2, 4, 5 or 6/7 in this session.
- Do not add textures, a texture pipeline, or downloaded assets. Procedural colour only.
- Do not invent content. Read the actual slides and cite the slide numbers in `scrolls.js`.
- Do not use emoji in the interface. The portal uses single-colour SVG icons.
- Avoid coloured rounded-left-border callout boxes and filled pills. The house style is ruled editorial
  layout with a labelled dot.

---

## 13. Documentation duty

`CLAUDE.md` in this repo requires it, so this is not optional.

The user keeps an Obsidian vault at `C:\Users\james\Documents\james-claude-brain`. When the slice is
working, write:

- A project note at `01-Active-Projects\wigfield-portfolio-dl-game.md` covering what was built, the
  architecture, where things live, and how to add the next lecture.
- A dev log at `03-Dev-Logs\<today>-dl-game-vertical-slice.md`.
- Link both with `[[wikilinks]]` to `[[wigfield-portfolio-management-portal]]`,
  `[[wigfield-portfolio-learning-hub]]` and `[[wigfield-portfolio]]`.

Note for context: **none of the Unreal Portara work is currently in the vault**, which is why this
handoff had to be reconstructed from `BUILD_LOG.md`. Do not leave the same gap behind.

---

## 14. Definition of done for this session

- A new tab **Scrolls · 3D** appears in the portal under Deep Learning and opens a playable scene.
- The philosopher walks around a lit Aegean village of three houses and animates while doing it.
- All three houses are enterable, each has at least one scroll, a working mechanism that reproduces its
  slide's figure at walking scale, and an exit test.
- Progress persists across a reload and is visible in the world.
- Fullscreen works and returns cleanly.
- `npm run lint` and `npm run build` both pass.
- The village rebuilds from `tools/build_village.py` with one command.
- Vault notes written.

---

## 15. Useful facts, gathered so you do not have to

- Blender: **5.2.2 LTS** at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, headless verified.
- The six lecture PDFs total 298 slides. Lecture 3 is 53 of them.
- The existing deep-learning module is 9,540 lines with about 28 distinct interactive widget types,
  across lectures 1 to 3 plus a searchable Code Lab. Lectures 4 to 7 have no module yet.
- The portal already renders at route `/portal`; modules are tabs within it, not separate routes.
- `pdftotext` is on PATH. `pdfinfo` too.
- Two GLB files already load in this repo from `public/portara-test/`, via drei's `useGLTF`, as a
  working reference for path, loading and preload.
- The machine has an RTX 5070 Ti and 31 GB of RAM, but only about 86 GB free on C. Keep artefacts small
  and do not copy the Unreal project.
