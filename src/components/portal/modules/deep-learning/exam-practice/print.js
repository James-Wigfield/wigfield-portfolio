/* ============================================================================
   EXAM PRACTICE — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   A copy of the Lecture 8 study's print.js, re-aimed at the papers. Export
   PDF is the browser's print pipeline (Save as PDF), so the text stays real
   and selectable for NotebookLM, and nothing new is bundled. The shell puts
   html.dlxp-printing on while it prints and mounts ./PrintBook.jsx; every rule
   below is scoped to that class. The block is mounted as a <style> inside the
   module, so its @page beats the portal's and leaves with the module. Jobs:

     paper     A4 portrait, white, whatever the portal theme;
               print-color-adjust: exact (the red ticks, the lecture dots)
     content   a title page, then per paper: its cover, its questions in exam
               layout (no ruled space), then its "Model answers"
     left out  everything on screen (tabs, stepper, reveal, self-marks, the
               filter, the export UI, the portal chrome): only the book prints
     maths     each inline formula prints its plain-text twin (.dlxp-texalt);
               display formulas keep KaTeX and add an "As text:" line
     breaks    each paper and its answers start on a new page; a part never
               splits from its label; an answer stays with its heading
   ========================================================================== */

export async function preparePrint() {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  // a beat for React to mount the book and KaTeX (rendered in effects) to fill it
  await new Promise((r) => setTimeout(r, 450));
}

const P = 'html.dlxp-printing';

export const PRINT_CSS = `
@media screen {
  .dlxp-book { display: none !important; }
}
@media print {
  @page {
    size: A4 portrait; margin: 15mm 15mm 17mm;
    @bottom-right { content: counter(page); font: 8pt "Times New Roman", serif; color: #555; }
    @bottom-left { content: 'CITS5017 Exam Practice · sample paper, practice papers A and B, model answers'; font: 8pt "Times New Roman", serif; color: #555; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* only the book prints */
  ${P} .dl.dlxp { display: block !important; max-width: none; color: #141414; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${P} .dl.dlxp > :not(.dlxp-book) { display: none !important; }
  ${P} .dlxp-book { display: block !important; font-family: KaTeX_Main, "Times New Roman", Times, serif; font-size: 10.5pt; line-height: 1.45; color: #141414; }

  /* title page */
  ${P} .dlxp-book__title { padding-top: 40mm; }
  ${P} .dlxp-book__kicker { margin: 0; font-size: 10pt; color: #444; }
  ${P} .dlxp-book__h { margin: 2mm 0 6mm; font-size: 26pt; font-weight: 700; color: #111; }
  ${P} .dlxp-book__lead { margin: 0 0 3mm; max-width: 150mm; }
  ${P} .dlxp-book__toc { margin: 0 0 4mm; padding-left: 6mm; }

  /* a paper: cover page, questions, model answers */
  ${P} .dlxp-book__paper { break-before: page; }
  ${P} .dlxp-book__cover { break-after: page; }
  ${P} .dlxp-book__papername { margin: 0 0 4mm; font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0; }
  ${P} .dlxp-book .dlxp-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; aspect-ratio: auto !important; min-height: 0 !important; max-width: none !important; background: #fff !important; }
  ${P} .dlxp-book .dlxp-cover { padding-top: 20mm; }
  ${P} .dlxp-book__q { break-before: page; }
  ${P} .dlxp-book__q:first-of-type { break-before: auto; }
  ${P} .dlxp-book .dlxp-qhead { break-after: avoid; margin: 0 0 1mm; font-size: 11.5pt; }
  ${P} .dlxp-book .dlxp-topics { break-after: avoid; margin: 0 0 4mm; font-size: 8.5pt; }
  ${P} .dlxp-book__part { break-inside: avoid; margin: 0 0 5mm; }
  ${P} .dlxp-book .dlxp-mlabel { position: static !important; display: inline; width: auto; }
  ${P} .dlxp-book .dlxp-mlabel__t { display: inline; margin-right: 2.5mm; }
  ${P} .dlxp-book__covers { margin: 1mm 0 0; font-size: 8pt; color: #555; }
  ${P} .dlxp-book .dlxp-figdesc { display: block !important; margin: 1mm auto 0; max-width: 150mm; font-size: 8pt; font-style: italic; color: #444; text-align: center; }
  ${P} .dlxp-book .dlxp-topics__more { display: none; }
  ${P} .dlxp-book .dlxp-topics__rest { position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal; }
  ${P} .dlxp-book .dlxp-nobr { white-space: normal; }
  /* answer sketches: drawn large enough to read, the description underneath */
  ${P} .dlxp-book .dlxp-ink__fig { flex-direction: column; align-items: flex-start; }
  ${P} .dlxp-book .dlxp-ink__fig .dlxp-fig { min-width: 62%; max-width: 72% !important; }
  ${P} .dlxp-book .dlxp-ink__fig .dlxp-figdesc { margin: 1.5mm 0 0; max-width: none; font-size: 8.5pt; text-align: left; }
  ${P} .dlxp-book .dlxp-ink__tblwrap { flex-direction: column; align-items: flex-start; }
  ${P} .dlxp-book .dlxp-ink__eq .dlxp-tick, ${P} .dlxp-book .dlxp-ink__tblwrap .dlxp-tick, ${P} .dlxp-book .dlxp-ink__fig .dlxp-tick { position: static !important; margin: 0; font-size: 11pt; }

  /* model answers */
  ${P} .dlxp-book__answers { break-before: page; }
  ${P} .dlxp-book__ah { margin: 0 0 1mm; font-size: 15pt; font-weight: 700; color: #111; break-after: avoid; }
  ${P} .dlxp-book__alead { margin: 0 0 5mm; font-size: 9pt; color: #444; }
  ${P} .dlxp-book__ans { break-inside: avoid-page; margin: 0 0 5mm; padding-top: 2mm; border-top: 0.6pt solid #bbb; }
  ${P} .dlxp-book__al { margin: 0 0 1mm; font-size: 10.5pt; font-weight: 700; color: #111; break-after: avoid; }
  ${P} .dlxp-book__am { font-weight: 400; color: #444; }
  ${P} .dlxp-book .dlxp-ink { padding: 0; }
  ${P} .dlxp-book .dlxp-ink * { animation: none !important; }
  ${P} .dlxp-book .dlxp-ink__w, ${P} .dlxp-book .dlxp-ink__ul li { line-height: 1.45; font-size: 11pt; }
  ${P} .dlxp-book .dlxp-ink__h { line-height: 1.3; font-size: 13pt; margin-top: 1mm; }
  ${P} .dlxp-book .dlxp-ink__eq, ${P} .dlxp-book .dlxp-ink__tblwrap, ${P} .dlxp-book .dlxp-ink__fig { min-height: 0 !important; margin: 1mm 0; break-inside: avoid; }
  ${P} .dlxp-book .dlxp-tick { position: static !important; display: inline; margin-left: 2mm; font-size: 11pt; }
  ${P} .dlxp-book .dlxp-ink__receipt { margin-top: 1mm; font-size: 8pt; }
  ${P} .dlxp-book .dlxp-fig--pen { max-width: 95mm !important; }
  ${P} .dlxp-book .dlxp-fig--printed { max-width: 120mm !important; }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dlxp-m .dlk-tex-inline { display: none !important; }
  ${P} .dlxp-m .dlxp-texalt { display: inline !important; font-style: italic; }
  ${P} .dlxp-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 8.5pt; color: #444; font-family: "Times New Roman", serif; }
  ${P} .dlxp-texalt--block::before { content: 'As text: '; font-style: normal; color: #666; }

  /* code: Light+ on paper, wrapped */
  ${P} .dlxp-book .dlxp-code { font-size: 8pt; white-space: pre-wrap; overflow: visible; break-inside: avoid; }

  ${P} figure, ${P} table, ${P} svg { break-inside: avoid; }
  ${P} h3, ${P} h4 { break-after: avoid; }
}
`;
