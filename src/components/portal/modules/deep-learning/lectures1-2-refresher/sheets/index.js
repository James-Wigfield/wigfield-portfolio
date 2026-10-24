/* ============================================================================
   LECTURES 1–2 REFRESHER — THE THREE NOTEBOOK PAGES
   ----------------------------------------------------------------------------
   The module's whole Write beat: three pages (p1 = Lecture 1; p2 = Lecture
   2, stable training; p3 = Lecture 2, faster and regularized training), each
   laid out by idea the way a student with neat notes and four pens would
   write it, and each sized to ONE real notebook page: at most 30 rules at
   the 760 px reference width, everything included (page-check.mjs asserts
   it). Prose only — SheetPage.jsx draws it. Tick keys come from ./keys.js.

   A page carries only the key concepts, as dense as clarity allows: tables
   for comparisons, a few boxed formulas, a diagram only where a sketch beats
   words. The Read and Play beats cover everything else; each page's grey
   "Not in these notes" line names what it left out.

   Pens (sheet.css):  blue = headings · black = body, line-work, formulas,
   numbers · red = bullet markers and step numbers · green = sparing
   highlights ({g|…} in text, `hl` parts of a diagram).

   A sheet:
     big       (optional) one plain "big idea" sentence under the title
     blocks    [{ id, h?, at?, items, fig?, margin? }] — one block per idea
       id      stable, unique in the sheet; tick keys hang off it
       h, at   blue sub-heading; `at` = its receipt, written as "L1 · 18–23"
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
import p1 from './p1.js';
import p2 from './p2.js';
import p3 from './p3.js';

export const SHEETS = { p1, p2, p3 };

export { sheetKeys } from './keys.js';
