# Brief: game builder (one game, one agent)

You are building ONE mini game for the Gradient Arcade, an exam-revision hub inside a React 19 + Vite portal.
The master brief is `Documents/temp/prompt-dumping/build_dl_arcade.md`: read "What you're building", "Where things
are", "Design rules", your game's entry under "The games", and the whole "Accuracy protocol". That document is
binding; this brief tells you how the arcade's kit works so your game plugs in without touching shared files.

You are running unattended. Never ask questions; decide conservatively (keep the slides accurate), note each
decision in your final report, and keep going. Do not commit (the lead commits). Do not edit anything outside the
files listed under "What you may write".

## Where you work

Module root: `src/components/portal/modules/deep-learning/arcade/` (call it `arcade/` below). Read these first:
- `tools/dl-arcade/PLAN.md` — the frozen contract and layout.
- `arcade/kit/useRound.js` (the round engine; its header comment is the API), `arcade/kit/RoundShell.jsx`
  (the frame: `RoundShell`, `Prompt`, `Feedback`), `arcade/kit/Keypad.jsx` (`Keypad`, `ShapePad`),
  `arcade/kit/Choice.jsx`, `arcade/kit/Maths.jsx` (`Maths`, `MLine`, `MEq`), `arcade/kit/why.js` (`receipt`,
  `fmtAnswer`), `arcade/kit/WhyText.jsx` (`Why`: text with `$…$` KaTeX), `arcade/kit/kit.css` (class names).
- `arcade/games/param-sniper/` — the finished pilot: manifest `index.js`, `glyph.jsx`, `ParamSniper.jsx`,
  `param-sniper.css`, with its content in `arcade/content/param-sniper.js` and generator in
  `arcade/maths/paramSniper.js`. Copy its structure.
- `arcade/core/rng.js` (`rng(seed)` → `{ next, int, pick, shuffle, normal, chance, weighted }`), `arcade/core/concepts.js`
  (the catalogue; ids come from `arcade/content/lecture*.js`).
- Your lecture's content file(s) `arcade/content/lecture<N>.js` (pure data written by the slide readers: CONCEPTS,
  EQUATIONS (KaTeX), ANCHORS, FACTS, CODE, QUIRKS, every item with `src: { lecture, slides }`). Use their ids and
  wording. If you need a concept that is not there, add it to `arcade/content/gameConcepts.js` (append to the
  array, same schema, with the slides that teach it) — that is the one shared file you may append to.
- The reusable maths files listed in the master brief ("Reusable maths and live models"). Import them; never edit
  them. If you must change one, copy it into `arcade/maths/` under a new name and adapt the copy.
- Visual language: `arcade/arcade.css` (root `.dla` also carries `.dl` and `.dl8s`, so `--dlv-*` and `--dl8s-*`
  tokens apply), `src/components/portal/modules/deep-learning/lecture8-study/stage.css` (role tokens `--dl8s-q/k/v/
  pos/enc/dec`, `.dl8s-svg`, `.dl8s-tok`, `.dl8s-beam`, `.dl8s-cell`, `.dl8s-knob`, `.dl8s-scrub`), and its
  `svgParts.jsx` (Token, Grid, Beam, Cone, Knob, Tip, Arrow) which you may import directly.

## The contract (frozen)

```js
// arcade/games/<gameId>/index.js
import { Glyph } from './glyph.jsx';
export default {
  id: '<gameId>', title: '…', lectures: [..], concepts: ['…'], blurb: 'One line.',
  color: '--dlv-aqua',                      // one of --dlv-blue/orange/aqua/yellow/magenta/green/violet/red (cabinet marquee)
  levels: 3, levelNames: ['…', '…', '…'],   // what each level adds
  glyph: Glyph,                             // a small procedural SVG for the cabinet (see param-sniper/glyph.jsx)
  load: () => import('./<Game>.jsx'),       // lazy: three.js etc. only load when opened
};
// The component receives { seed, level, mode: 'free'|'mix'|'exam', durationMs, onRoundEnd, onExit, host }
// and calls onRoundEnd({ score, maxScore, outcomes: [{ concept, correct, src }] }) exactly once (useRound does this).
```

Use the kit for the round, so the bot, the results screen and the why cards are uniform:

```jsx
const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);   // your pure generator in arcade/maths/<game>.js
const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
return (
  <RoundShell game={manifest} round={round} host={host} intro={{ line: 'One sentence.', controls: ['…', '…'] }} stageClass="dla-xx">
    {round.current && <YourStage key={round.current.id} item={round.current} round={round} />}
  </RoundShell>
);
```

Item shape (`round.current`): `{ id, concept, src, kind: 'number'|'shape'|'choice'|'custom', answer, choices?, check?,
tol?, why, promptText, beyond? }`. `round.submit(value)` grades (equality, or your `check(given) → boolean` for
`kind: 'custom'`), shows feedback for ~0.5 s (`round.feedback = { correct, item, given }`), then advances; the last
item or the timer ending finishes the round. Items not reached are not recorded. `why` (one or two sentences in
the slides' notation, `$…$` for maths) and `src` appear on the why card for every mistake; `promptText` is its
header. `format(v)` on an item formats a custom answer for the card.

If your game is not a plain question list (a simulation with its own stage), it still runs on useRound: each
"hole", "station", "call" or "stage" is an item whose `answer` is what the player must produce (a club name, a gate
setting, a patching, an ordering) and whose `check` grades it. The dev bot in the headless check will read
`window.__dla.current()` (DEV only) and call `window.__dla.submit(answer)` with the item's own `answer`, so `answer`
must be a value `check` accepts, and the value a wrong bot submits (`skip()` or a mutated answer) must grade
false. Keep every item's `answer` JSON-serialisable.

`durationMs` is set by the host (60 s free/mix, 75 s exam); size the round to fit (a fixed item count also ends
the round; `durationMs` may be `null` for untimed hosts, handle that). Levels: 1 is the entry, 3 the hardest;
difficulty should also ramp within a round.

## What you may write
- `arcade/games/<gameId>/` — everything for your game (manifest, components, CSS with your own prefix `.dla-<xx>`).
- `arcade/content/<gameId>.js` — your game's PURE DATA with `src` on every item (no functions, no imports except
  nothing). Facts, labels, prompts, why texts, distractors, level copy. Mark anything not on the slides
  `beyond: true` with a `note`, and keep those rare.
- `arcade/maths/<gameId>.js` (and helpers `arcade/maths/<gameId>*.js`) — the pure functions behind your questions
  and simulation (seeded; no React, no DOM). Reuse `arcade/maths/params.js` / `shapes.js` for counts and shapes.
- `tools/dl-arcade/check-<gameId>.mjs` — a Node script (`node tools/dl-arcade/check-<gameId>.mjs`) that asserts
  your generator against hand-worked examples from the slide equations (the "fidelity" check in the master brief)
  and that every item of 30 seeded rounds per level has an id, concept (present in the catalogue), src, why and a
  gradable answer. Node ESM, Node globals (the repo's eslint config covers `tools/**/*.mjs`). Node cannot import
  `.jsx`, so keep what the check imports in `.js` files.
- `arcade/content/gameConcepts.js` — append only.

The lead owns `arcade/core/games.js` (he adds your manifest), `registry.js`, `core/`, `kit/`, `hub/`. If the kit
genuinely lacks something, work around it inside your game and say so in your report.

## Accuracy (the master brief's protocol is binding)
- Sources of truth: the lecture PDFs, then the markdown transcripts. Read the slides behind every concept you use
  (`pdftotext -layout -f N -l N <pdf> -`; figures and equations: `pdftoppm -png -r 110 -f N -l N <pdf> <scratch>/s`
  then look at the PNG with the Read tool). The content file is a starting point, not a substitute.
- Use the slides' notation and terms. Every number, formula, label, distractor and why text comes from
  `content/` or a `maths/` function; nothing hard-coded in components.
- Where slides disagree with each other or with Keras, follow the slide being drilled and mention the quirk on the
  why card (the content file's QUIRKS list them).
- A fresh accuracy checker will extract every claim your game makes and verify it against the PDF, and solve 30+
  of your generated questions blind. Build so that it finds nothing.

## Design rules (from how the owner reacts to past modules)
- One idea per game, readable in 5 seconds; at most 2–3 visible controls; picture first, numbers on interaction or
  in a collapsed "Show the maths" drawer (`<Maths>` from the kit) in the slides' notation.
- No walls of text. No coloured rounded boxes with a thick left border, no filled pill badges; tone markers are a
  labelled dot on ruled, editorial layouts (`.dla-k`, `.dla-dot`, borders from `--line`).
- Juice: the kit already shakes on wrong and flashes on right; add your own stage reactions, but nothing under
  `prefers-reduced-motion: reduce` (put every animation/transition behind that media query).
- Mobile first-class: works at 390 px wide with touch, tap targets ≥ 44 px, numeric answers through the kit's
  Keypad/ShapePad, no horizontal page scroll (test it). Keyboard works on desktop (digits/Enter via the kit; add
  keys for your own controls and list them in the intro `controls`).
- Every interactive element has a label; every `svg role="img"` has an `aria-label`.
- All three portal themes (jade, coral, arcade): use the tokens, never hard-coded colours except via `--dlv-*` /
  `--dl8s-*`.
- Zero assets required (procedural SVG/canvas). Lazy-load heavy deps (three.js) inside your component chunk.

## Running and checking
- The dev server is already running on http://localhost:5173 (do not start another; if it is down, run
  `npm run dev -- --port 5173 --strictPort` in the background). Your game is at `/portal/dl-arcade/<gameId>`
  already: a placeholder manifest, glyph and component exist in your folder and are registered in
  `arcade/core/games.js`. Overwrite the three placeholder files (keep the `id`; keep the component filename the
  placeholder's `load` points to, or update `load` in your manifest). Never edit `core/games.js`.
- Screenshots: `MSYS_NO_PATHCONV=1 node tools/dl-arcade/shot.mjs "/portal/dl-arcade/<gameId>?seed=7&level=1" <out.png> <theme> <width> --el --key=Enter`
  (theme jade|coral|arcade, width 1440|390; `--key=Enter` starts the round; `--click=<selector>` clicks). Look at
  every screenshot with the Read tool and fix what looks wrong. Put screenshots in your scratchpad directory,
  never in the repo. It prints console errors: there must be none.
- Lint: `npx eslint src/components/portal/modules/deep-learning/arcade/games/<gameId> src/components/portal/modules/deep-learning/arcade/maths/<gameId>.js src/components/portal/modules/deep-learning/arcade/content/<gameId>.js tools/dl-arcade/check-<gameId>.mjs`
  must be clean. The repo uses the React Compiler lint rules: no `ref.current` reads/writes during render, no
  `setState` directly inside an effect body (derive state, or key a child component to reset it), no impure
  calls like `Date.now()` in render (use lazy `useState(() => …)`), components-only `.jsx` files for Fast Refresh
  (put helpers in `.js`). Windows is case-insensitive: never create `foo.js` next to `Foo.jsx`.
- Node check: `node tools/dl-arcade/check-<gameId>.mjs` passes.

## Report back (short)
- Files written; how to play (one line); what each level adds.
- Every slide you anchored to; anything marked `beyond` and why.
- Decisions made unattended; known issues; anything the kit lacked.
