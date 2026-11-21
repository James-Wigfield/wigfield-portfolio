# Skippers · Forms: run notes (portal tab `skippers`)

Built 2026-11-21. Portal tab **Skippers · Forms** (Personal), deep links `/portal/skippers/eyesight` (default) and `/portal/skippers/consent`.

## What it is
- The two WA DoT forms (eyesight + medical declaration, 2 pages, ref 09-11-14-RST-0626-WEB; under-18 letter of consent, 1 page, ref 09-11-23-RST-0626). Each page is shown as the real page image with the filled values laid over it.
- Page images: `tools/skippers/render-forms.mjs` (pdftoppm at 200 dpi, then sharp to 1488 px webp) writes `public/skippers-forms/{eyesight-1,eyesight-2,consent-1}.webp` (188 / 245 / 147 KB).
- Field map: `src/components/portal/modules/skippers/fields.js`. Both PDFs are fillable (AcroForm), so every box is that form field's own `/Rect` (read with `tools/skippers/measure-widgets.py`, which needs pypdf), stored in PDF points and drawn as % of the page.
- Three boxes aren't form fields and were measured on the 200 dpi render: the first "DD" cell of the doctor's date (the PDF has no field for it) and the two printed tick squares on the consent letter.

## Decisions
- **Ink.** Blue = James's details. Red-brown = example only (a doctor, optometrist or parent would write it). Pen font = Patrick Hand, which `index.html` already loads site-wide.
- **EXAMPLE tags.** There's one small mono tag per example section ("Example · only needed if a condition is ticked", "Example · the examiner fills this section", "Example · parent or guardian fills this"). A tag on every red value would clutter the page.
- **Example values are obviously fictional.** People are Dr A. Example / Dr B. Example / Jordan Example. The address is 40 Sample Street, Exampleville WA 6000. Phone numbers use (08) 5550 01xx, the ACMA range kept for fiction.
- **Example dates are 16/11/2026, not 23/11/2026.** The eyesight test and the consent letter both have to be done *before* the assessment day (Mon 23 Nov 2026), so the example is dated a week earlier.
- **Status line wording.** No em-dashes, matching the Resume module's rule. Eyesight: "Not required for James: licence holder. Filled as a worked example." Consent: "Not required for James: over 18. Filled as a worked example." (Reworded from the first draft to avoid gendered pronouns.)
- **Nothing ticked under medical conditions.** The note says "Only tick if one applies. If none, the doctor section isn't needed".
- **Eyesight result.** The example ticks "HAS met ... without aids to vision" with 6/6 in both eyes. "With aids" is left blank, and note 05 explains why.
- **No signatures are drawn anywhere.** The consent letter has a grey pencil note "Sign by hand · no digital signature" next to the form's own "Sign here".
- **Privacy.** Date of birth and street address are never in source. They're entered in "My details · this device only" and saved to `localStorage['skf:applicant']` (`{dob, unit, number, street}`), with every read and write in try/catch. Until then the forms show faint `DDMMYYYY` / `Street no. & name` / `No.` / `Street name` placeholders.
- **Notes layout.** On desktop each note lines up with its section (JS pushes a note down just enough to clear the one above). At 700 px and narrower the notes become a plain list under each page. On phones a "Zoom page 2×" link doubles the page inside its own frame, and the page itself never scrolls sideways.
- **Export PDF** prints the open form only, one A4 sheet per form page, at margin 0 (the `@page` style is added on mount, as in the Resume tab).
  - Notes, counters, tags and placeholders are left out of the print.
  - **Red example values are left OFF by default**, so the printout can go straight to the real optometrist, doctor or parent to finish. A "Print examples" checkbox puts them back.

## Checks
- `npx eslint src/components/portal/modules/skippers tools/skippers` is clean.
- `node tools/skippers/forms-check.mjs <outDir>` runs 116 checks against the dev server at 5173, or `SITE_URL`. It covers:
  - 3 themes × 1440/390 × both forms
  - every value inside its target box, plus the boxes, tags and counters on the paper
  - page counters = note counters, and desktop notes don't overlap
  - no h-scroll at 390, phone zoom, deep links and the switch
  - placeholders, and the editor saving to `skf:applicant`
  - print: no chrome, 1 or 2 A4 sheets checked with pdfinfo, examples off/on
  - console clean
- The optional privacy sweep reads its markers from `SKF_PRIVATE_MARKERS`, so the markers are never written into a file.

## Open questions for James
- Should the PDF carry his own details at all? A printout for a cousin would need their details instead, and the tab currently has no "applicant = someone else" mode.
- Example dates: keep 16/11/2026, or blank them?
