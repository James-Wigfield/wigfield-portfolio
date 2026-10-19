# Builder brief — DL Project 2 explainer plates (shared by every builder)

You are building explainer **plates** for one section group of a portal page that renders James's
CITS5017 Project 2 notebook as a fake Jupyter notebook, with animated explainers between its sections.
The shell, data pipeline, scene frame and several reference scenes already exist and work. Copy their
patterns exactly.

## Where things are

Repo: `C:\Users\james\Documents\personal-projects\wigfield-portfolio` (run node/npm/eslint from Windows: PowerShell or Git Bash).

Module: `src/components/portal/modules/deep-learning/project2/`

| File | What it is | Who edits |
|---|---|---|
| `scene/Scene.jsx` | the scene frame: one paused GSAP timeline, beats, captions, controls, print storyboard, reduced motion, `window.__dlp2` | lead only |
| `scene/Plate.jsx` | `Plate`, `Row`, `R` (receipt), `P` (paragraph) | lead only |
| `scene/geom.js` | `lin`, `pathOf`, `seriesPath`, `fmt`, `thou`, `range`, `bracket` | lead only |
| `nbutil.js` | `sectionRange(key)`, `codeCell(key, k)`, `mdCell(key, k)`, `outLabel(c)` | lead only |
| `data/notebook.js` | GENERATED cells (`CELLS`, `SECTIONS`, `NB_META`) | never by hand |
| `data/series.js` | GENERATED real data excerpts (`SERIES`) for drawing temperature curves | never by hand |
| `project2.css`, `print.js` | page + print styles; the `sv-*` SVG vocabulary | lead only |
| `explainers/index.js` | the plate registry | lead only |
| `explainers/Sxx*.jsx`, `explainers/scenes/*.jsx` | plates and scenes | **you, only the files assigned to you** |

Reference scenes to copy: `explainers/S03Split.jsx` (real data, five beats, the full plate rhythm),
`scenes/GruCell.jsx`, `scenes/Recursion.jsx`, `scenes/EncDec.jsx` (toggle of two scenes), `scenes/Reparam.jsx`,
`scenes/EarlyStop.jsx`, `scenes/Horizon.jsx`, `scenes/StationMap.jsx`.

## The scene API (read `scene/Scene.jsx` header)

```jsx
<Scene id="unique-id" label="real description for role=img" viewBox="0 0 800 H"
       beats={[{ t: 'Short title', c: 'One caption sentence.' }, …]}
       art={art} build={build} keyframes={[…beat indices for print…]} schematic="…" />
```

- `art(step, uid)` returns SVG children for the picture **at the end of beat `step`**. Pure JSX, no GSAP.
  It is the finished frame (JSX defaults), the reduced-motion frame, the print storyboard frames and the
  reduced-motion step-through. Every element that appears in beat k must be visible iff `step >= k`.
- `build(tl, { q, uid, beat })` fills one paused timeline. `q('.cls')` is scoped to the live stage.
  - Start with `tl.set(q('…'), { …reset state…, immediateRender: true }, 0)` for everything that is not
    visible at t=0.
  - Call `beat(i, position)` once per beat, in order (`beat(0, 0)`, then `beat(1, '+=0.5')` …) and place
    that beat's tweens at the label `'b<i>'` (or `'b<i>+=0.3'`).
  - **Every stateful tween is a `fromTo` with explicit values.** Never `invalidate()`; replay is `restart()`.
  - Animate transforms, opacity and SVG attributes only (`attr: { x, width, cy … }`, `strokeDashoffset`).
  - Line draws: `const L = path.getTotalLength(); tl.fromTo(path, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, immediateRender: true }, at)`.
  - Do not use dashed strokes on paths you line-draw (the dasharray is taken over).
  - End with a short hold: `tl.to({}, { duration: 1 })`.
- `art` and `build` must be stable: module-level functions, or `useMemo` factories keyed on props.
- SVG ids (patterns, gradients, markers) must use the `uid` argument: `id={`${uid}hatch`}`.
- The end state of the animation must be pixel-identical to `art(last)` (the headless check compares them).
- viewBox width 800; the stage renders ~830 px wide on a 1440 screen, so 11 px SVG text ≈ 11 px.
- Use the `sv-*` classes (see the SVG vocabulary block in `project2.css`) instead of literal colours:
  `sv-lab`, `sv-lab-strong`, `sv-cap`, `sv-num`, `sv-big`, `sv-title`, `sv-axis`, `sv-grid`, `sv-ink`,
  `sv-ink2`, `sv-faint`, `sv-box`, `sv-box-strong`, `sv-fill-ground2`, `sv-accent`, `sv-accent-fill`,
  `sv-line`, `sv-pred` (dashed), `sv-base` (dashed grey reference). Inline `style={{ fill: 'var(--ink-2)' }}` is fine for one-offs.

## One colour mapping (never deviate)

| Meaning | Class / token |
|---|---|
| min temperature | `sv-min` / `sv-fmin` (`--dlp2-min`, blue) |
| max temperature | `sv-max` / `sv-fmax` (`--dlp2-max`, orange) |
| train / val / test | `sv-train`, `sv-val`, `sv-test` (+ `sv-f…` fills) — green / yellow / magenta |
| model 1 / 2 / 3 | `sv-m1`, `sv-m2`, `sv-m3` (+ `sv-fm…`) — red / aqua / violet |
| seasonal-naive baseline | `sv-base` (dashed grey) |
| truth vs prediction | truth = solid line; prediction = dashed line (`sv-pred`) + hollow markers |
| VAE real vs synthetic | real = `--ink-3`; synthetic = `sv-max` (orange, the max channel) |

Every series must carry a direct text label (two of the hue pairs sit in the colour-blind floor band, so
identity is never colour alone).

## The plate rhythm

Each section file exports one named component per plate; the registry (`explainers/index.js`, lead-owned) is the
single source of each plate's id, number, kicker and title, and passes its entry in as `meta`. Keep the export
names already in your stub files. If you want a plate retitled, say so in your report and the lead changes the
registry.

```jsx
export function UnrollPlate({ meta }) {
  return (
<Plate meta={meta} cells={sectionRange('s6')}>   {/* or [from, to] cell indices from nbutil */}
  <Row label="Task"><p className="dlp2-task">One line, from the brief.</p></Row>
  <Row label="How it works" wide><MyScene … /></Row>
  <Row label="What the notebook did"><P>… real choices and numbers, why each beat its alternatives … <R c={codeCell('s6', 1)} /></P></Row>
  <Row label="What came out"><P>… results, issues, how the notebook discusses them … <R c={…} /></P></Row>
</Plate>
  );
}
```

Scene ids: use the plate id for the plate's main scene (`id="m1-unroll"`), suffixes for extra scenes in the
same plate (`m1-unroll-b`). A phase toggle of several scenes follows `scenes/EncDec.jsx` (buttons carry
`data-shows="<scene id>"`, panes `dlp2-toggle-scene__pane`, both print).

To show one of the notebook's own figures inside a scene, use an SVG `<image>`:
`import fig from '../figures/cell38_0.png';` then `<image href={fig} x=… y=… width=… height=… preserveAspectRatio="xMidYMid meet" />`
(figure sizes: cell12_* 1390×425, cell18/24/32/45 1090×377, cell20/26/28/34 1390×425, cell37_0 690×390,
cell38_0 689×390, cell48_* 1490×593). Put a white `<rect>` behind it (the figures are white).

Skip a row that doesn't apply. Several plates per section are fine (model 3 probably needs three).
Small ruled number tables: `<table className="dlp2-tbl">`, or `<div className="dlp2-figs">` of
`<div className="dlp2-fignum"><span className="dlp2-fignum__v">0.95</span><span className="dlp2-fignum__k">test MAE °C <R c={…}/></span></div>`.

## Honesty (hard rules)

- Every number and shape you show comes from the notebook (receipt `<R c={cellIndex} />` → "Out [n]" for what a code cell prints; `<R c={cellIndex} code />` → "In [n]" for a fact in its code, e.g. a learning rate;
  "Out [n]"), or from the handover / `experiments/log.md` for experiments not in the notebook
  (`<R src="log" />`, `<R src="handover" />`). Never from memory, never "what should happen".
- Temperature curves may be drawn from `SERIES` (real data excerpts). Never invent predictions or
  synthetic sequences as data: draw the mechanism, or show the notebook's own figure.
- Label illustrative parts `schematic` (the Scene prop), e.g. gate activations, latent clouds, curve shapes.
- Use the course slides' notation: GRU `z(t)`, `r(t)`, `g(t)`, `h(t) = z(t) ⊗ h(t−1) + (1 − z(t)) ⊗ g(t)`;
  VAE `μ`, `γ = log σ²`, `σ = exp(γ/2)`, `ε ~ N(0, I)`, `z = μ + σ ⊗ ε`, latent loss `−½ Σ (1 + γ − exp(γ) − μ²)`, "codings", "codings size".

## Prose

Short, plain, specific, Australian spelling. Typographic symbols (°C, ×, →, −) are fine here.
Banned: "delve", "leverage", "robust", "seamless", "crucial", "notably", "it's worth noting",
"this highlights", "plays a key role", "Let's", "In summary", "not just X but Y", rhythmic lists of three,
bold lead-ins, emoji. Teach a general concept only as far as needed to follow this notebook's choice.

## Design (James's rules)

Theme tokens only (jade, coral, arcade must all work), hairline rules, mono uppercase micro-labels.
No coloured rounded left-border callout boxes, no alert banners, no filled number pills, no
glassmorphism, no gradient text, no icon-card grids, no emoji. Tone = a small labelled dot.

## Before you return

1. `npx eslint <your files>` clean.
2. Screenshot each of your scenes in all three themes, after the animation ends:
   `node tools/dl-project2/shot.mjs <outDir> theme=jade,coral,arcade width=1440 full=0 scroll="#dlp2-scene-<id>" settle=<ms> tag=<id>`
   (dev server on http://localhost:5173 is already running). Look at every screenshot; fix collisions,
   clipped labels, unreadable contrast.
3. `SCENES=<your-scene-ids comma-separated> ONLY=scenes,reduced node tools/dl-project2/page-check.mjs <outDir>` must pass for your scenes (it prints PASS/FAIL per scene).
4. Report: files written, scenes (id, beats, keyframes), every number you used with its receipt, anything
   you were unsure of.
