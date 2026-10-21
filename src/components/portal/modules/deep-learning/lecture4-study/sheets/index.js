/* ============================================================================
   LECTURE 4 STUDY — STUDENT-NOTES SHEETS
   ----------------------------------------------------------------------------
   The default "Write" page of every section: the same content as the legacy
   notebook page (sections.js notes / draw / formulas / worked / check),
   re-laid out by idea, the way a student with neat notes and four pens would
   write it. One file per section (sNN.js), prose only — SheetPage.jsx draws
   it. Tick keys come from ./keys.js.

   Pens (sheet.css):  blue = headings · black = body, line-work, formulas,
   numbers · red = bullet markers, step numbers, margin markers · green =
   sparing highlights ({g|…} in text, `hl` parts of a diagram).

   A sheet:
     big       (optional) one "big idea" line under the title, from the slides
     blocks    [{ id, h?, at?, items, fig?, margin? }] — one block per idea
       id      stable, unique in the sheet; tick keys hang off it
       h, at   blue sub-heading; `at` = its slide range, written small
       items   in order, any mix of:
                 'text'                          • bullet (red marker)
                 { line }                        a line with no marker
                 { steps: [...] }                1. 2. 3. (red numbers)
                 { sub }                         small blue heading
                 { formula: tex, read?, tag? }   boxed formula + its reading
                 { code, read?, tag? }           boxed code
                 { worked: [...], title? }       worked number (results {g|…})
                 { table: { head, rows, cols? } } hand-ruled table, row ticks
                 { arrow: [cause, effect] }      cause ⟶ effect
                 { fig, hl?, cap? }              a diagram inside the flow
       fig     (optional) the block's diagram: { key, hl, cap, place }
               place 'below' (default) · 'side' (beside the items when the
               page is wide enough, else below) · 'above'
       margin  asides in the margin column (folded under the block when
               narrow): { nb } remember · { ne } a "≠" contrast · { hook }
               this page's own memory hook · { q, a } self-test (click to
               reveal; not ticked) · { sc } points at a Slide check
   `tag` and worked titles say when a number is this page's own working
   rather than printed on the slides.
   ========================================================================== */
import s00 from './s00.js';
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
import s12 from './s12.js';
import s13a from './s13a.js';
import s13b from './s13b.js';
import s14 from './s14.js';
import s15 from './s15.js';
import s16 from './s16.js';

export const SHEETS = { s00, s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13a, s13b, s14, s15, s16 };

export { sheetKeys } from './keys.js';
