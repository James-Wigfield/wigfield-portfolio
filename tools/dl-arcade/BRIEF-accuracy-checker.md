# Brief: accuracy checker (one game, a fresh agent with no stake in the build)

You verify ONE Gradient Arcade mini game against the CITS5017 lecture slides. The game's builder is not you; find
what they got wrong. Working directory: `C:\Users\james\Documents\personal-projects\wigfield-portfolio`. Do not
commit. Do not edit the game: you write one report file and nothing else.

## Sources of truth (nothing else)
1. The lecture PDF: `Documents/cits5017/lectures/<deck>.pdf`. Text: `pdftotext -layout -f N -l N <pdf> -`.
   Figures and equations: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/s` then look at the PNG with the Read
   tool (pdftotext drops Greek letters and operators; never trust it for an equation).
2. The markdown transcript `Documents/cits5017/markdown-lecs/lecture-N.md` (incl. its Quirks section).
The textbook, the internet, your memory and the other study modules are NOT sources. A claim the slides do not
make is NOT IN SLIDES even if it is true.

## What to read
- The game's folder `src/components/portal/modules/deep-learning/arcade/games/<gameId>/` (every file), its
  content `arcade/content/<gameId>.js`, its maths `arcade/maths/<gameId>*.js`, and the concept ids it uses in
  `arcade/content/lecture<N>.js` (a concept's `slides` must actually teach it).
- The item shape: `arcade/kit/useRound.js` header. The why card shows `item.why` + `item.src` as the receipt;
  `item.beyond` marks a claim beyond the slides.

## What to do
1. **Extract every claim** the game makes: content strings, UI strings in the components (prompts, intro lines,
   labels, drawer text), question templates and their why texts, distractors (a distractor that is actually true
   per the slides is WRONG), level copy, and what the mechanics imply (e.g. an animation implying a gate is a
   sigmoid, a default hyperparameter value, a formula the simulation uses).
2. **Verify each claim** against the slide(s) it cites (and the slides it should cite). Render the figure-led and
   equation slides and look at them.
3. **Solve a sample of generated questions blind**: run the generator in Node
   (`node --input-type=module -e "const m = await import('file:///…/arcade/maths/<gameId>.js'); const { rng } = await import('file:///…/arcade/core/rng.js'); …"`)
   for several seeds and levels, print each item's prompt/lines WITHOUT its answer, work the answer out yourself
   from the slides' rules (parameter counts, shapes, gate values, update steps, softmax …), THEN compare with the
   item's `answer` and `why`. At least 30 items per game (60 for Param Sniper and Kernel Rush), spread across the
   levels and item kinds. Record every disagreement with your working.
4. Write `tools/dl-arcade/accuracy/<gameId>.md`: a short header (game, date, sample size), then ONE table:
   `| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |`
   with verdict one of **VERIFIED / WRONG / NOT IN SLIDES / AMBIGUOUS**, and a "Blind sample" section listing the
   items you solved (prompt, your answer, the game's answer, match). End with a 5-line summary: counts per
   verdict and the fixes in priority order. Keep the table rows terse (one line each).

## Standards
- WRONG = contradicts a slide, misattributes a slide, cites a slide that does not say it, or a number/formula
  that does not reproduce. Be strict about slide numbers (off by one is WRONG).
- NOT IN SLIDES = true but not on any slide and not marked `beyond: true`. An item marked `beyond` with a note
  is acceptable; record it as VERIFIED (beyond) so the lead can count them.
- AMBIGUOUS = the slide is unclear or contradicts another slide; say which reading the game took.
- Be economical with tokens: read the files once, render only the slides you need, keep the report tight.

## Report back
The path of the report and the five-line summary.
