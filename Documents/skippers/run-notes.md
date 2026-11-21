# Skippers build — run notes (2026-11-21, autonomous run)

## Decisions I made

- **Source = DoT RST Workbook 8th ed. (July 2026)**, downloaded to `Documents/skippers/source/` with *Boating Rules at a Glance*. Read cover to cover via a page-marked text extract (`workbook-compact.txt`, printed page = PDF page − 2) plus rendered images of the table/figure pages.
- **Safety-gear thresholds follow the 2026 workbook, not the prompt's "2, 5 and 20 NM".** The 2026 rules only have two lines: **400 m from shore** (protected → unprotected: GPS EPIRB/PLB, flares/EVDS, lifejacket *wearing* for vessels < 4.8 m and kids 1–12) and **4 NM** (VHF/HF radio on registrable vessels). The gear slider uses those. Older material (incl. ABC's 2023 pre-study guide and possibly ABC's public quiz) still uses the old EPIRB-beyond-5 NM style rules.
- **Parachute flares**: the 2026 workbook only details red hand-held, orange smoke and EVDS (p.54–55); a "red parachute flare" appears only in the list of recognised distress signals (p.84). The flare picker teaches only the three the workbook describes; parachute flares get no range or burn-time claims anywhere on the site.
- **Practical assessment wording**: the workbook says 62 criteria, pass = 56 (six wrong or less), about 30 minutes (p.6, p.91); ABC says ~10–15 min for the formal part after training. The site shows both, attributed.
- **Theory retry**: workbook p.6 — 34+ to pass, 30–33 may sit a *different set of questions the same day*, < 30 another day, max two attempts a day.
- Gmail registration email read via the connector: name, suburb, state, postcode, phone and email used; DOB and street address were **not** written anywhere in source (device-only editor in the portal tab).
- Work split: question bank and portal forms tab were written by two background agents against fixed specs (question schema + figure specs, forms brief); I built the site, labs and exam room, then reviewed and verified their output.

- **Level structure**: 12 top tabs (Start, 8 study levels, Practical, Exam room, Night-before sheet). Every view is one concept (steps inside a level), so no long scroll. Start itself is split into Plan / How the test works / Your levels.
- **Mock weighting** (sum 40): ticket 2, rules 6, collision 5, lights 5, buoyage 5, maintenance 3, safety 7, operations 4, emergencies 3. The real paper's split isn't published; this follows the workbook's chapter weight.
- **Readiness** = last three mocks all at 36+/40 (ABC's "90 % repeatedly" advice). The top bar shows a green "ready" dot when met.
- **Leitner deck**: only misses enter it (box 1, due now); a right answer moves it up a box and waits 10 min → 1 h → 6 h → 1 day.
- **Lab list (16)**: age ladder, 8-knot harbour map (to scale), four encounters (story + tap the give-way vessel), horn signals (WebAudio), light arcs (drag yourself round a vessel), "what is it?" night challenge, lateral channel in/out, cardinal compass with live rhythms, other marks day/night, maintenance schedule sorter, gear by distance, flare picker, flotation, anchoring scope, stability (stiff vs tender), which radio call.
- **Hero copy and labels never use personal details**; the site is generic for anyone sitting the WA RST.
- **Question bank** (359, original): written by a background agent from the workbook against a fixed schema; it self-checked 25 answers, I spot-checked a further 20 rows (facts + questions) against the PDF text — all correct (`node tools/skippers/fact-check.mjs --sample 20`).
- **Portal forms tab**: built by a background agent; details in `run-notes-forms.md`. Example dates are 16/11/2026 (before the assessment); red example values are left off the PDF export by default (checkbox to include).
- **Sources not committed**: `Documents/skippers/source/` is git-ignored (17 MB DoT PDF + extracts). `fact-check.mjs` re-extracts text when the PDF is present.
- **Deploy** was done from a clean `git worktree` of the new commit, so the uncommitted Memory Rooms work was not shipped.

## Open questions for James

1. **Rules the 2026 workbook states two ways** (the site follows the specific rule page, not the glossary):
   - protected waters: p.49 includes "within 400 m of shore", the glossary (p.116) doesn't
   - 27 MHz radios beyond 4 NM: p.49 says VHF/HF required, p.60 says 27 MHz "still acceptable" during a phase-out with no start date
   - fire extinguisher stowage: p.50 vs p.86
   - EVDS: p.49 needs a PLB *worn*, p.55 reads as if the EPIRB must be worn too
   - strong wind warning: "more than 25" (p.78) vs "25 to 33" in the self-test answers

   Worth asking Sean on the day if any of these come up.
2. **Fuel rule (p.73)**: "25 % out, 25 % back, 50 % reserve" vs the worked example (reserve = ⅓ of the total). The site teaches "carry 50 % more than you expect to use", which both agree on.
3. **ABC's public quiz may use pre-2026 gear distances** (the old EPIRB/flare offshore distances). If ABC's online course does too, the exam on Monday might as well. The site follows the 2026 workbook and says so on the Start page.
4. **Forms tab**: should the PDF export support a cousin's details ("applicant = someone else" mode)? Currently it always prints James's.
5. **Mock weighting**: if Sean says the paper leans on particular chapters, change `examWeight` in `src/skippers/content/questions/index.js`.

## Things I couldn't do

- **ABC's private online course**: the login email hadn't arrived; the `abcCourse` hook in `src/skippers/content/levels.js` is empty and ready.
- **Embedding ABC's videos**: not done by design (link-outs only, per the brief).
- **Parachute flare details**: the 2026 workbook gives no burn time or range for them, so the flare picker doesn't teach them beyond "a recognised distress signal".
