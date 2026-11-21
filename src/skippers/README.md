# /skippers — WA Recreational Skipper's Ticket study site

Public and unlisted (the page adds `noindex`), with no login and no backend. Progress is
saved in the browser's localStorage under `sk:` keys (`progress`, `deck`, `mocks`, `plan`,
`practical`, `theme`, `lightsBest`). Every fact traces to the **DoT RST Workbook, 8th
edition (July 2026)**. Page numbers are the *printed* workbook pages, which are the PDF
page number minus 2.

## Layout

| Path | What |
|---|---|
| `SkippersApp.jsx` | Shell: the top level tabs, theme (auto / light / dark), routing `/skippers/<level>/<step>` |
| `skippers.css` | The only stylesheet. Scoped to `.sk` with an `sk-` prefix; tokens are on `.sk` |
| `content/levels.js` | The tabs and each level's steps (lab / facts / cards / check / custom). Holds the `abcCourse` hook |
| `content/facts.js` | "Numbers to know" rows `{ big, unit, text, page }` |
| `content/cards.jsx` | Rule cards `{ title, text, page, art, more }` |
| `content/questions/*.js` | The question bank (one file per topic) + `index.js` (`QUESTIONS`, `TOPICS` with `examWeight`) |
| `content/bank.js` | Loads the bank through `import.meta.glob` and builds check-ins and 40-question mocks |
| `art/` | SVG vocabulary: `geometry.js` (light arcs, vessels, marks, rhythms), `parts.jsx`, `Figure.jsx` (question figures) |
| `kit/` | Stage / StoryBar / Facts / Cards (a re-tokened copy of the portal's lecture8-study kit), hooks, storage |
| `labs/` | One file per lab group; `labs/index.js` is the registry |
| `pages/` | Start, level page, quiz, exam room, night-before sheet |

## Add a question

Add an object to the topic file in `content/questions/`:

```js
{ id: 'lights-042', topic: 'lights', page: 32, q: '…', options: ['…','…','…','…'], answer: 1,
  why: 'Rule in your own words.', cover: ['lights-types'], figure: { kind: 'night', vessel: 'sail', aspect: 'port' } }
```

Figure kinds:
- `night` — `vessel` × `aspect`
- `mark` — `mark`, plus optional `topmark: false` or `light: true`
- `rhythm` — `mark`
- `encounter` — two boats `{ id, type, x, y, heading }`
- `flag` — `alpha`
- `horn` — `blasts: 'sss'`

Then run `node tools/skippers/check-questions.mjs`. Write questions in your own words; don't copy them from the workbook or from ABC.

## Add a lab

1. Write the component in `labs/`, using `Stage` from `kit/kit.jsx`. Keep to one idea, at most 3 controls and 2 caption sentences.
2. Register it in `labs/index.js`.
3. Add a `{ kind: 'lab', lab: 'Name' }` step to the level in `content/levels.js`.

## Checks

- `node tools/skippers/check-questions.mjs` — checks the bank: unique ids, exactly one answer, pages, the coverage list, figure specs.
- `node tools/skippers/fact-check.mjs [--sample 20]` — every fact's figure must appear on its cited page. This needs the workbook PDF in `Documents/skippers/source/`.
- `node tools/skippers/site-check.mjs [base] [outDir]` — opens every view at 1440 and 390 in light and dark. It checks for console errors, overflow and noindex, runs a full mock exam, and prints the cram sheet to one A4 page.
- `node tools/skippers/shots.mjs <outDir> <paths> [widths] [themes]` — quick screenshots. In Git Bash, prefix with `MSYS_NO_PATHCONV=1`.

## Sources (not committed)

`Documents/skippers/source/` is git-ignored. Download into it:
- https://www.transport.wa.gov.au/getmedia/4ca427b2-485e-49be-ab4d-f33014ef8e49/MAC_P_RST_Workbook2026.pdf
- https://www.transport.wa.gov.au/mediaFiles/marine/MAC_B_BoatingRulesAtAGlance.pdf

## ABC's online course

ABC's private course login hadn't arrived when this was built. When it does, list its modules as `abcCourse` in `content/levels.js` and they will show on the Start page.
