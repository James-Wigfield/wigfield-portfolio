/* ============================================================================
   DL PROJECT 2 — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   Export PDF is window.print() and nothing more, so THIS block is the export
   format. It is mounted as a <style> inside the page (not bundled), so its
   @page out-cascades the full-bleed @page Wall Art installs portal-wide and
   disappears with the tab. Jobs:

     1 · paper — A4 portrait with document margins; a print-only cover page
     2 · one palette — the jade tokens (and the light --dlv-* steps) are forced
         onto .dlp2 so a coral or arcade reader still gets a paper document;
         print-color-adjust: exact keeps the series colours; code prints Light+
     3 · everything expanded — every cell, all code, all outputs (collapse is
         screen-only); stderr shrinks to a one-line note; the rail, controls,
         Export button and the NotebookLM prompt never print
     4 · frozen scenes — each plate's live stage is swapped for its storyboard
         strip (2–4 key frames for process scenes) plus the full narration as
         text, so the PDF reads from its extracted text alone (NotebookLM)
     5 · nothing clipped — code and text outputs wrap instead of scrolling;
         flex columns become blocks
     6 · nothing split — cells, figures, frames and table rows stay whole;
         headings never orphan from what follows
   ========================================================================== */

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 13mm 12mm 15mm;
    @bottom-right { content: counter(page); font: 7.5pt 'IBM Plex Mono', monospace; color: #6f8fa0; }
    @bottom-left { content: 'CITS5017 Project 2 · explained notebook'; font: 7.5pt 'IBM Plex Mono', monospace; color: #6f8fa0; }
  }
  @page :first { @bottom-right { content: none; } @bottom-left { content: none; } }

  html, body, .hp.portal, .portal__body, .portal__main, .portal__content { background: #fff !important; }
  .portal__content { animation: none !important; padding: 0 !important; }

  .dl.dlp2 {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
    --error: #c24a52;
    --dlp2-gutter: 3.7rem;
  }
  .hp.portal[data-portal-theme] .dl.dlp2 {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* 3 · screen-only chrome */
  .dlp2-head__actions, .dlp2-nlm, .dlp2-chrome, .dlp2-rail, .dlp2-drop, .dlp2-collapser,
  .dlp2-cell__stub, .dlp2-loading, .dlp2-scene__grid, .dlp2-err__head, .dlp2-err__body, .dlp2-scene__devframes { display: none !important; }

  /* 1 · the cover */
  .dlp2-cover { display: block; break-after: page; padding-top: 30mm; }
  .dlp2-cover__kicker { margin: 0 0 6mm; font-family: var(--dlp2-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); }
  .dlp2-cover__title { margin: 0 0 8mm; font-family: var(--dlp2-serif); font-size: 2.1rem; line-height: 1.1; font-weight: 600; color: var(--ink); padding-bottom: 6mm; border-bottom: 2px solid var(--ink); }
  .dlp2-cover__what { margin: 0 0 10mm; font-size: 0.92rem; line-height: 1.6; color: var(--ink-2); max-width: 150mm; }
  .dlp2-cover__meta { margin: 0; display: grid; grid-template-columns: 38mm 1fr; gap: 0; border-top: 1px solid var(--line); }
  .dlp2-cover__meta div { display: contents; }
  .dlp2-cover__meta dt, .dlp2-cover__meta dd { margin: 0; padding: 2mm 0; border-bottom: 1px solid var(--line-2); font-size: 0.74rem; }
  .dlp2-cover__meta dt { font-family: var(--dlp2-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
  .dlp2-cover__meta dd { font-family: var(--dlp2-mono); color: var(--ink); overflow-wrap: anywhere; }

  .dlp2-head { border-bottom-width: 1px; padding-bottom: 4mm; grid-template-columns: 1fr; }
  .dlp2-head__title { font-size: 1.5rem; }
  .dlp2-facts { margin-top: 3mm; }

  /* 5 · blocks, not flex columns */
  .dlp2-layout, .dlp2-layout--rail, .dlp2-flow, .dlp2-plates, .dlp2-plate__body, .dlp2-outs, .dlp2-summary, .dlp2-scene { display: block !important; }
  .dlp2-layout { margin-top: 4mm; }
  .dlp2-sheet { border: 0; box-shadow: none; padding: 0; background-image: none; }
  /* positioned boxes paint after in-flow content, which put each "In [n]:" after
     its code in the PDF's text order; in print everything flows in DOM order */
  .dlp2-sheet, .dlp2-cell, .dlp2-gutter, .dlp2-scene, .dlp2-plate { position: static !important; }
  .dlp2 code { padding: 0 0.08em; }
  /* a wrapped code line continues indented, so it never reads as a new statement */
  .dlp2-code__line { padding-left: 2.2em; text-indent: -2.2em; }
  .dlp2-screen { display: none !important; }
  .dlp2-print { display: inline !important; }
  .dlp2-plates { margin: 6mm 0 7mm; }
  .dlp2-plate + .dlp2-plate { margin-top: 8mm; }
  .dlp2-outs > * + *, .dlp2-summary > * + * { margin-top: 1mm; }

  /* 3 · every cell expanded */
  .dlp2-cell__row--shut .dlp2-cell__fold { display: block !important; }
  .dlp2-code { white-space: pre-wrap; overflow: visible; overflow-wrap: anywhere; font-size: 0.6rem; line-height: 1.5; padding: 2mm 3mm; }
  /* code on paper is VS Code's Light+ rather than Dark+: 23 near-black blocks
     made a third of the pages mostly ink */
  .dlp2 .dlp2-code { background: #f5f8f9; color: #1f1f1f; border: 1px solid var(--line); }
  .dlp2 .dlp2-code .tok-cm { color: #3d7a2f; }
  .dlp2 .dlp2-code .tok-st { color: #a31515; }
  .dlp2 .dlp2-code .tok-nu { color: #098658; }
  .dlp2 .dlp2-code .tok-kw { color: #af00db; }
  .dlp2 .dlp2-code .tok-ct { color: #0000ff; }
  .dlp2 .dlp2-code .tok-fn, .dlp2 .dlp2-code .dlp2-tok-dec { color: #795e26; }
  .dlp2 .dlp2-code .dlp2-tok-cls { color: #267f99; }
  .dlp2-fig__print { display: block; margin: 1mm 0 0; font-size: 0.64rem; line-height: 1.4; color: var(--ink-2); }
  .dlp2-fig__print b { color: var(--ink); }
  .dlp2 .dlp2-code code.dlp2-code__code { min-width: 0; white-space: pre-wrap; }
  .dlp2-out__text { white-space: pre-wrap; overflow: visible; overflow-wrap: anywhere; font-size: 0.58rem; line-height: 1.12; }
  .dlp2-md__tablewrap { overflow: visible; }
  .dlp2-md { font-size: 0.82rem; line-height: 1.55; }
  .dlp2-md h1 { font-size: 1.45rem; } .dlp2-md h2 { font-size: 1.18rem; } .dlp2-md h3 { font-size: 0.98rem; }
  .dlp2-prompt { font-size: 0.6rem; }
  .dlp2-err__print { display: block; margin: 0.5mm 0; font-family: var(--dlp2-mono); font-size: 0.56rem; color: var(--ink-3); }
  .dlp2-fig { border: 0; padding: 0; }
  .dlp2-fig img { max-height: 120mm; width: auto !important; max-width: 100%; }

  /* 4 · frozen scenes: the storyboard + its narration */
  .dlp2-seg--big { display: none !important; }
  .dlp2-toggle-scene__pane { display: block !important; }
  .dlp2-toggle-scene__pane + .dlp2-toggle-scene__pane { margin-top: 5mm; }
  .dlp2-toggle-scene__printlab { display: block; margin: 0 0 1.5mm; font-family: var(--dlp2-mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
  .dlp2-scene__board { display: block; }
  /* a stroked (haloed) SVG label is written twice into the PDF's text layer: no halos on paper */
  .dlp2 svg text { stroke: none !important; }
  /* every frame prints full width so its labels stay readable; earlier beats
     are capped in height (a scene can crop them with frameBoxes so the cap
     rarely bites), the final frame is not */
  .dlp2-board { display: block; }
  .dlp2-board__frame + .dlp2-board__frame { margin-top: 3mm; }
  .dlp2-board__frame:not(:last-child) svg { max-height: 104mm; }
  .dlp2-board__schem { margin: 0 0 1.5mm; font-family: var(--dlp2-mono); font-size: 0.58rem; letter-spacing: 0.06em; color: var(--ink-3); }
  .dlp2-board__frame svg { display: block; width: 100%; height: auto; border: 1px solid var(--line); background: #fff; }
  /* a single frame may be tall: at 86 mm the tallest printed at half the column and 4 pt */
  .dlp2-board--n1 .dlp2-board__frame svg { max-height: 128mm; }
  .dlp2-board__cap { margin: 1.2mm 0 0; font-size: 0.66rem; line-height: 1.4; color: var(--ink-2); }
  .dlp2-board__cap b { color: var(--ink); }
  .dlp2-board__all { margin: 2.5mm 0 0; padding-left: 5mm; font-size: 0.66rem; line-height: 1.4; color: var(--ink-2); }
  .dlp2-board__all li { margin: 0.6mm 0; }
  /* rows print as blocks (label above its body): a grid item ignores
     break-after, and the label must stay with what follows it */
  .dlp2-row, .dlp2-row--wide { display: block; padding: 2.2mm 0; }
  .dlp2-row__label { margin: 0 0 1mm; }
  .dlp2-p { font-size: 0.8rem; line-height: 1.5; max-width: none; }
  .dlp2-task { font-size: 0.88rem; }
  .dlp2-r--link { text-decoration: none; color: var(--ink-3); }
  .dlp2-plate__explains { border: 0; color: var(--ink-3); padding: 0; }
  .dlp2-plate__explains svg { display: none; }

  /* 6 · nothing split that matters, nothing pushed that need not be: long code
     and long paragraphs may break; outputs, figures, frames and tables may not;
     headings, a plate's head + task + "How it works" label, and a code cell's
     input stay with what follows them */
  .dlp2-fig, .dlp2-out__text, .dlp2-board__frame, .dlp2-tbl, .dlp2-figs, .dlp2-md__table, .dlp2-md__table tr, .dlp2-board__cap, .dlp2-board__schem { break-inside: avoid; }
  .dlp2-md h1, .dlp2-md h2, .dlp2-md h3, .dlp2-plate__head, .dlp2-plate__title { break-inside: avoid; break-after: avoid; }
  .dlp2-plate__head, .dlp2-row__label, .dlp2-toggle-scene__printlab, .dlp2-board__schem { break-after: avoid; }
  /* a plate's task line travels with its "How it works" label and first frame */
  .dlp2-plate__body > .dlp2-row:first-child { break-inside: avoid; break-after: avoid; }
  .dlp2-board__all { break-inside: avoid; }
  /* a short code cell prints whole with its output; a long one may break so
     its Keras summary can stay whole (both rules at once made Chrome split
     the summary and leave a three-quarter-empty page) */
  .dlp2-cell--short { break-inside: avoid; }
  .dlp2-cell--short .dlp2-cell__row:not(.dlp2-cell__row--out):has(+ .dlp2-cell__row--out) { break-after: avoid; }
  /* a Keras summary (title, table, three param lines) prints as one block */
  .dlp2-summary { break-inside: avoid; }
  .dlp2 p, .dlp2 li, .dlp2-code { orphans: 3; widows: 3; }
  .dlp2-end { break-inside: avoid; }
}
`;
