/* ============================================================================
   LECTURES 6–7 STUDY — NOTEBOOK PAGES
   ----------------------------------------------------------------------------
   The Write beat of each section, laid out by idea the way a student with
   neat notes and four pens would write it. One file per section (sNN.js),
   prose only — SheetPage.jsx draws it. Tick keys come from ./keys.js.

   A page carries only what is worth copying; the Read and Play beats cover
   every concept. Sections with nothing to copy (the intro and the summary)
   have no file and no Write beat.

   Pens (sheet.css):  blue = headings · black = body, line-work, formulas,
   numbers · red = bullet markers and step numbers · green = sparing
   highlights ({g|…} in text, `hl` parts of a diagram).

   A sheet:
     big       (optional) one plain "big idea" sentence under the title
     blocks    [{ id, h?, at?, items, fig?, margin? }] — one block per idea
       id      stable, unique in the sheet; tick keys hang off it
       h, at   blue sub-heading; `at` = its slide range, written small
       items   in order, any mix of:
                 'text'                          • a sentence (red marker)
                 { line }                        a line with no marker
                 { steps: [...] }                1. 2. 3. (red numbers)
                 { sub }                         small blue heading
                 { formula: tex, read?, tag? }   boxed formula + its reading
                 { code, read?, tag? }           boxed code line(s)
                 { worked: [...], title? }       worked number (results {g|…})
                 { table: { head, rows, cols? } } hand-ruled table, row ticks
                 { fig, hl?, cap? }              a diagram inside the flow
       fig     (optional) the block's diagram: { key, hl, cap, place }
               place 'below' (default) · 'side' (beside the items when the
               page is wide enough, else below) · 'above'
       margin  asides in the margin column (folded under the block when
               narrow): { nb } a "remember" note · { q, a } self-test
               (click to reveal; not ticked) · { sc } points at a Slide check
     skip      (optional) the quiet closing line "Not in these notes (see
               Read): …" naming what was deliberately left out
   `tag` and worked titles say when a number is this page's own working
   rather than printed on the slides.
   ========================================================================== */
import s01 from './s01.js';
import s02 from './s02.js';
import s03 from './s03.js';
import s04 from './s04.js';
import s05 from './s05.js';
import s06 from './s06.js';
import s07 from './s07.js';
import s08 from './s08.js';
import s09 from './s09.js';
import s10 from './s10.js';
import s11 from './s11.js';

export const SHEETS = { s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11 };

export { sheetKeys } from './keys.js';
