# Decisions — made while James was away (2026-10-17)

One line each: decision · why.

## Sources and accuracy
- I read the ANZ IB in full from pdftotext, plus rendered images of the diagram pages · the brief says don't rely on its summary.
- Breville video links use en-au where that guide exists and en-us otherwise; all 12 URLs were checked with curl on 2026-10-17 · en-au only lists 6 of the 12.
- The backflush has no steps in the guide. It appears as a linked Breville video plus the two sentences Breville actually publishes · the page text has no button sequence (verified on en-us and en-nz).
- No AU part codes or prices · nothing on breville.com/en-au confirmed them, and only third-party sellers came up.
- "Tablet not dissolved → repeat" reuses the same tablet, and the restock maths reflects this · IB p.22 step 7 ("repeat from step 4 … until the tablet is dissolved").
- The steam purge says "briefly", not "2 s"; the tip soak has no duration; the hot cloth is a labelled tip · these three numbers aren't in the IB.
- "Never wet the burrs" is kept as a tip, and "no vinegar" is dropped · the IB says neither (p.24 just brushes the burrs).
- The schedule's hands-on durations are my estimates, labelled "est." in the Gantt and totals · the IB times only the machine cycles and soaks.

## Structure
- Seven tabs as recommended, with inner switches on Every day & week (4 parts) and Deep clean (Schedule / Steps) · keeps each view to one concept with no long scroll.
- The deep clean has 16 player steps, in the order the scheduler computes · the optimised order interleaves the wand jobs around the shower screen, so they have to be separate steps.
- The wand's hot cloth goes on before the shower screen and softens while James works on the screen · the kettle is freshest just after setup, and the wrap takes nothing off the hands-on time.
- The filter comes out at the descale step, not at setup · the tank stays seated for the grinder run (IB p.10: the machine won't operate below MIN).
- The basket soak starts after the grinder and is rinsed before the cleaning cycle · the grinder needs the portafilter and the cycle needs the 1 CUP basket, so this avoids the shared-resource clash.
- Four status gauges instead of three: Deep clean, Filter, Clean cycle, Descale · the deep clean also recurs from a date.
- The clean-cycle and descale gauges never predict: the needle shows days since last done on a 6-month dial, and the red zone only lights when James says the light is flashing or solid · the brief says the machine decides.
- The filter date defaults to the purchase date and is labelled "assumed: fitted at first use" · there's no log yet, and the box filter goes in at first use (IB p.9).
- The purchase date defaults to six months before the first open and is editable in the Log tab · per the brief.
- The weekly checklist has 7 items; the burr brush is marked "only if the light flashed this week" and doesn't count toward completing the week · per the brief, and the IB pairs it with the light.
- Restock "on hand" starts at 2 tablets, 1 sachet, 0 spare filters, 0 seals · the brief says to assume box contents only.
- Extra storage keys `bxi:restock:v1`, `bxi:prefs:v1` and `bxi:timers:v1` alongside the three in the brief · restock must persist, the sound toggle must persist, and background soaks must survive a reload.

## Design
- My own `.bxi-*` copies of Hook, Fact and Unfold instead of importing the deep-learning `kit.jsx` · that kit pulls in KaTeX and its styles assume desktop widths; this guide is phone-first.
- The machine art uses theme tokens (ink lines, surface fills); the material colours (water, coffee, milk, steam, scale, LED) are fixed per theme in `scenes.css` with arcade overrides · it reads as a blueprint on Arcade and a line drawing on the light themes.
- Instruction markup `[1 CUP]` → steel chip and `{25 s}` → mono value, parsed in `ui.jsx` · content stays plain strings in `content.js`.

## Made during the build
- Phone shell: at ≤ 760 px the portal sidebar stacks above the content, so a deep link opens on the full nav list. The guide scrolls itself into view on mount at phone widths, and the shell isn't refactored · the brief says to record shell issues rather than refactor the shell.
- On phones the guide trims the portal's 24 px content gutter to 16 px with a negative margin scoped to `.pt-module.bxi` · this meets the brief's 16 px gutter without touching portal.css.
- The deep clean's Prev / Mark done / Next sit in a sticky bottom dock, shared with the background-timer mini-bar · keeps the primary action in thumb reach on every step.
- Each scene's numbered actions are an HTML legend under the art, with only mono numbers in the SVG · SVG text shrinks to ~7 px on a phone, and HTML stays legible and accessible.
- The light decoder is the single input for clean-cycle and descale status: James says Off / Flashing / Solid, it's persisted, and "Done it" sets it back to Off · the machine decides; the guide never predicts.
- The sequencer covers the six months from the last deep clean. While the deep clean is overdue it shows the next six months from this week · otherwise it would only show the past half-year.
- Breville video links use the shortest verified slug per locale; runtimes are shown only where the page stated one (descale 2:57, backflush 0:56, wand 1:03) · no guessing.
- Step 13 (finish the soak) links Breville's "Filter basket rinse" video · coverage mapping found it unused.
- Instruction values like `{25 s}` are drawn as a mono number plus a proportional unit · mono spacing made "25  s" gape.
- Part codes and prices are omitted from Restock · nothing was verifiable on breville.com/en-au.
- I didn't import `deep-learning/kit.jsx`; `.bxi-*` copies of Hook, Fact and Unfold live in `ui.jsx` · see Design above.
