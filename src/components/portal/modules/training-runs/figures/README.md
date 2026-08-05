# Training-run figures (W&B exports)

PNG figures exported from Weights & Biases (or any other tool) that a run's
analysis page embeds. Kept next to the run pages so everything about one run
lives in two sibling places: its page in `../runs/` and its images here.

## Structure — one folder per run, named exactly after the run id

```
figures/
  README.md            ← this file
  run-00-sample/       ← matches `id: 'run-00-sample'` in ../runs.js
  run-01-baseline/     ← created when run 01 lands, and so on
```

## Conventions

- **Folder name = the run's `id`** from `../runs.js` (`run-<nn>-<shortname>`).
  Never share a folder between runs — cross-run comparison images belong to
  the newer run's folder.
- **Filenames are kebab-case metric names**: `val-dice.png`, `train-loss.png`,
  `lesion-f1.png`, `gpu-util.png`. No spaces, no `W&B Chart 12_3_2026.png` —
  rename on export.
- Export at 2x size from W&B for crisp rendering; PNGs land in the bundle via
  Vite import, so keep them a few hundred KB, not multi-MB.

## Using a figure on a run page

```jsx
import valDice from '../figures/run-01-baseline/val-dice.png';

<Section label="W&B figures">
  <FigureGrid>
    <Figure src={valDice} caption="val Dice per epoch — the curve the checkpoint was picked on" />
  </FigureGrid>
</Section>
```

`<Figure>` (from `../kit`) puts every image on a white frame so light W&B
exports stay legible on the dark arcade theme, and renders a dashed
placeholder if `src` is omitted — so the page can be written before the
exports are dropped in.

**Every figure with a `src` is clickable and expands into a lightbox** (Escape or
the backdrop closes it). That is why the 2x export rule matters: inline, a figure
renders around 650px wide in the 2-up grid, but expanded it can fill a 1600px
panel — so a 1x export looks soft exactly when someone is trying to read the
axis labels. The grid is never 3-up, deliberately: a third column takes these
charts below the width at which their tick text is legible.
