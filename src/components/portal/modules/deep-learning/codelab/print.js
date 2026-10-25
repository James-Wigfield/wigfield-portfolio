import { CARDS, fullLabel } from './cards/index.js';
import { panelImage } from './panelImage.js';

/* ============================================================================
   CODE LAB — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   Copied from lecture9-study/print.js: Export PDF is the browser's print
   pipeline (Save as PDF), so nothing new is bundled and the PDF is always
   the page as it is now. The shell puts html.dlc-printing on while it
   prints; every rule below is scoped to it, mounted as a <style> inside the
   module, so its @page beats the portal's print page and leaves with it.

     paper     A4 portrait; one light paper palette whatever the theme
     content   a cover (title, date, purpose, contents of every card label),
               then every tab in order, Labs & Projects first, with every
               card (Core only and search are ignored) and its exam moves
     code      NOT the study modules' "Light+ on paper" rule: every panel
               prints exactly as on screen, the dark Dark+ editor with its
               title bar, dots, filename, card label, line numbers and marks,
               as one embedded image (./panelImage.js, 3×), with the code as
               real text laid under it. Images print whatever the "Background
               graphics" setting; the text under them carries pdftotext.
     maths     KaTeX for the eye plus the plain-text twin (texText.js)
     left out  the tab bar, search, Core only, copy buttons, the export UI
               and the portal chrome
     breaks    each tab starts a new page; a card never splits
   ========================================================================== */

// Draw every card's panel as an image; returns { [cardId]: image }.
export async function preparePrint(root) {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  // let React render every tab first, so a code element exists to read the font from
  await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 50)));
  const pre = root?.querySelector('.dlc-code__pre');
  const family = (pre && window.getComputedStyle(pre).fontFamily) || 'Consolas, ui-monospace, monospace';
  const out = {};
  CARDS.forEach((c) => {
    try {
      out[c.id] = panelImage({ code: c.code, marks: c.marks, file: c.file, meta: fullLabel(c), family });
    } catch {
      /* this panel prints as the vector editor instead */
    }
  });
  return out;
}

const P = 'html.dlc-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 9mm 10mm 12mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Code Lab · the exam’s code'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dlc {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; display: block; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.38); --line-2: rgba(53, 86, 105, 0.2);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }

  /* left out */
  ${P} .dlc-bar, ${P} .dlc-hero__actions, ${P} .dlc-hero__stats, ${P} .dlc-copy, ${P} .dlc-card__tools,
  ${P} .dlc-export, ${P} .dlc-nlm, ${P} .dlc-card__tab, ${P} .dlc-results, ${P} .dlc-empty, ${P} .dlc-index, ${P} .dlc-fold > summary { display: none !important; }

  /* hero + cover = page 1 */
  ${P} .dlc-hero { display: block; padding: 0 0 3mm; border-bottom: 2px solid var(--ink); animation: none; }
  ${P} .dlc-hero__title { font-size: 1.9rem; }
  ${P} .dlc-hero__lead { max-width: none; font-size: 0.86rem; }
  ${P} .dlc-cover { display: block !important; margin-top: 3mm; }
  ${P} .dlc-cover__date { margin: 0; font: 0.72rem ui-monospace, monospace; color: var(--ink-3); }
  ${P} .dlc-cover__lead { margin: 2mm 0 4mm; font-size: 0.8rem; line-height: 1.5; color: var(--ink-2); }
  ${P} .dlc-cover__k { margin: 0 0 1.5mm; font-size: 0.9rem; color: var(--ink); }
  ${P} .dlc-cover__toc { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 8mm; }
  ${P} .dlc-cover__toc li { break-inside: avoid; margin: 0 0 1.6mm; }
  ${P} .dlc-cover__sec { display: block; font-size: 0.74rem; font-weight: 800; color: var(--ink); border-bottom: 1px solid var(--line-2); }
  ${P} .dlc-cover__cards { display: flex; flex-direction: column; font-size: 0.66rem; line-height: 1.38; color: var(--ink-2); }

  /* sections: each tab on a new page */
  ${P} .dlc-sec { display: block; break-before: page; margin: 0; }
  ${P} .dlc-sec__head { break-after: avoid; padding-top: 0; }
  ${P} .dlc-list { display: block; }
  ${P} .dlc-card, ${P} .dlc-lp { animation: none; }
  /* a card on paper, about half a page: the code panel beside its legend,
     the equations full width, then the count table beside the diagram */
  ${P} .dlc-card { display: block; break-inside: avoid; margin: 0; padding: 1.8mm 0 2mm; }
  ${P} .dlc-card > * + * { margin-top: 1mm; }
  ${P} .dlc-card__head { gap: 0.6mm 2.5mm; }
  ${P} .dlc-card__title { font-size: 0.86rem; }
  ${P} .dlc-card__why { font-size: 0.7rem; line-height: 1.35; max-width: none; }
  ${P} .dlc-card__body { grid-template-columns: minmax(0, 1fr) 66mm; column-gap: 4mm; row-gap: 1.6mm; }
  ${P} .dlc-card__colA .dlc-move--draw, ${P} .dlc-card__colB .dlc-move--draw { display: none; }
  ${P} .dlc-move--pdraw { display: flex; grid-column: 1 / -1; }
  ${P} .dlc-dg--across .dlc-dg__svg { max-width: 100%; height: auto; }
  /* Shapes in the narrow column: name and shape on a line, meaning below */
  ${P} .dlc-card__colB .dlc-shapes, ${P} .dlc-card__colB .dlc-shapes tbody { display: block; }
  ${P} .dlc-card__colB .dlc-shapes tr { display: block; padding: 0.3mm 0; border-bottom: 1px solid var(--line-2); }
  ${P} .dlc-card__colB .dlc-shapes th, ${P} .dlc-card__colB .dlc-shapes td { display: inline; padding: 0 1.5mm 0 0; border: none; }
  ${P} .dlc-card__colB .dlc-shapes td:last-child { display: block; padding: 0; }
  ${P} .dlc-card__colA, ${P} .dlc-card__colB { gap: 1.3mm; }
  ${P} .dlc-card__side { gap: 1mm; margin: 0; }
  ${P} .dlc-move { gap: 0.5mm; }
  /* "Draw it", "Count it" as the prompts name them (no capitals on paper) */
  ${P} .dlc-move__k { font-size: 0.6rem; padding-bottom: 0.2mm; line-height: 1.1; text-transform: none; }
  ${P} .dlc-legend { gap: 0.5mm; }
  ${P} .dlc-legend li, ${P} .dlc-card__for, ${P} .dlc-card__move { font-size: 0.64rem; line-height: 1.3; }
  ${P} .dlc-legend li { padding-left: 1.2rem; text-indent: -1.2rem; }
  ${P} .dlc-legend__n { width: 1.2rem; }
  ${P} .dlc .dlc-legend__q { font-size: 0.58rem; padding: 0 0.15em; }
  ${P} .dlc-legend__where { font-size: 0.56rem; }
  ${P} .dlc-shapes { font-size: 0.6rem; line-height: 1.25; }
  ${P} .dlc-shapes th, ${P} .dlc-shapes td { padding: 0.2mm 2mm 0.2mm 0; }
  ${P} .dlc-count { font-size: 0.6rem; line-height: 1.12; max-width: none; }
  ${P} .dlc-count th, ${P} .dlc-count td { padding: 0.1mm 1.8mm 0.1mm 0; }
  ${P} .dlc-count th { font-size: 0.56rem; }
  ${P} .dlc-count__rule { font-size: 0.58rem; }
  ${P} .dlc-count td.dlc-mono { font-size: 0.58rem; }
  ${P} .dlc-count + .dlc-count { margin-top: 1.5mm; }
  ${P} .dlc-eqs { gap: 1mm; }
  ${P} .dlc-eq { padding-left: 2mm; }
  ${P} .dlc-eq .dlk-tex-block { padding: 0; font-size: 0.9em; }
  ${P} .dlc-eq__plain, ${P} .dlc-eq__code { font-size: 0.62rem; line-height: 1.3; }
  ${P} .dlc-card__foot { padding-top: 1mm; margin-top: 1.2mm; }
  ${P} .dlc-card__pcheck { display: block; border-top: 1px dashed var(--line-2); padding-top: 0.8mm; }
  ${P} .dlc-card__scheck, ${P} .dlc-card__foot--pempty { display: none; }
  ${P} .dlc-check, ${P} .dlc-xref { font-size: 0.58rem; line-height: 1.28; }
  ${P} .dlc-xref { display: none; }
  ${P} .dlc-sec__head { padding-bottom: 1.5mm; }
  ${P} .dlc-sec__title { font-size: 1.15rem; }
  ${P} .dlc-lp__head { break-after: avoid; }
  ${P} .dlc-lp { display: block; margin: 0; padding: 2.5mm 0 0; }
  ${P} .dlc-lp__title { font-size: 1rem; }
  /* the facts as label-led paragraphs (Card.jsx PrintFacts): each label
     starts the line of its own text and no labels line up in a column, so
     the PDF's text reads label, text, label, text; never split */
  ${P} .dlc-lp__pfacts { margin: 1mm 0 0; break-inside: avoid; }
  ${P} .dlc-lp__pf { margin: 0 0 0.7mm; font-size: 0.64rem; line-height: 1.3; color: var(--ink-2); }
  ${P} .dlc-lp__pk { margin-right: 1.8mm; font-family: ui-monospace, monospace; font-size: 0.56rem; font-weight: 700; text-transform: uppercase; color: var(--ink); }
  ${P} .dlc-lp__pf .dlc-lp__line { display: inline; border: none; padding: 0; margin: 0; }
  ${P} .dlc .dlc-lp__pf .dlc-lp__q { display: inline; font-size: 0.62rem; }

  /* the code panel: the image, with the code as real text under it */
  ${P} .dlc-codewrap--img .dlc-code { display: none !important; }
  /* overflow: the text layer stays inside the panel (it still extracts) */
  ${P} .dlc-pimg { display: block !important; position: relative; margin: 0; break-inside: avoid; container-type: inline-size; overflow: hidden; }
  ${P} .dlc-pimg__img { position: relative; z-index: 1; display: block; width: 100%; height: auto; border-radius: 6px; }
  ${P} .dlc-pimg__text { position: absolute; z-index: 0; right: 0; margin: 0; color: #000; font-family: ui-monospace, Menlo, Consolas, monospace; white-space: pre; }
  /* a panel without an image prints as the vector editor */
  ${P} .dlc-code { box-shadow: none; break-inside: avoid; }
  ${P} .dlc-code__pre { overflow: visible; white-space: pre-wrap; }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dlc-eq__plain { display: block !important; }

  /* letter-spaced caps extract as "C ORE"; on paper they are set solid */
  ${P} .dlc :is(.dlc-rate, .dlc-src, .dlc-prov, .dlc-move__k, .dlc-hero__kicker, .dlc-eq__k, .dlc-sec__no, .dlc-card__label) { letter-spacing: 0 !important; }

  /* nothing split that matters */
  ${P} figure, ${P} table, ${P} svg, ${P} .dlc-eq, ${P} .dlc-legend { break-inside: avoid; }
  ${P} h2, ${P} h3, ${P} h4 { break-after: avoid; }
}
`;
