/* ============================================================================
   LECTURE 4 STUDY — PRINT / "READ + PLAY" PDF EXPORT
   ----------------------------------------------------------------------------
   Export PDF is window.print() and the browser's "Save as PDF", so THIS block
   is the export format. The shell mounts it as a <style> only while an export
   is under way (html.dl4s-printing), so its @page beats the full-bleed @page
   Wall Art installs portal-wide, and nothing here can touch another page.

     1 · paper — A4 portrait, document margins, a running footer; the jade
         palette (and the light --dlv-* steps) forced on, so a coral or arcade
         reader still gets a light document; code prints in VS Code's Light+
     2 · Read + Play only — every notebook page (both tabs), the sticky bar,
         the index rail, Resume, the hero's buttons and the export UI never
         print; "Try this" prompts and on-screen hints neither
     3 · everything open — Unfold bodies expanded, footnotes printed under
         their Read beat (Lecture4Study.jsx), every Slide check shown
     4 · controls as text — a chip row prints only its chosen value, a slider
         only its "label = value", a stepper only its readout; buttons,
         tick boxes and range tracks never print
     5 · nothing clipped — wide labs that scroll sideways on screen (.dl4s-wide
         and the lab stages) shrink to the page width; code wraps
     6 · nothing split that matters — figures, tables, equations, code and
         stat rows stay whole; every section starts on a new page
     7 · equations readable as text — each typeset equation prints its LaTeX
         source in a small line under it (.dl4s-ptex, added at print time),
         so the PDF's extracted text carries the maths NotebookLM can read
   ========================================================================== */

const P = 'html.dl4s-printing';

// 7 · Under each typeset display equation, a print-only line with its LaTeX
// source (KaTeX keeps it in the MathML annotation), so the PDF's text holds
// maths a reader — or NotebookLM — can follow. The lines go inside the
// KaTeX-owned span (React never renders children there) and come out again
// after printing. The notebook pages never print, so they are skipped.
export function addPrintTex(root) {
  if (!root) return;
  root.querySelectorAll('.katex-display').forEach((d) => {
    if (d.closest('.dl4s-beat--write') || d.nextElementSibling?.classList.contains('dl4s-ptex')) return;
    const src = d.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    if (!src) return;
    const line = document.createElement('span');
    line.className = 'dl4s-ptex';
    // TeX ignores spaces between commands, so one before each \command gives
    // the line safe places to wrap; every token is unbreakable, so it never
    // wraps after a "-" (PDF text extraction joins "t-" + "1" into "t1")
    const tokens = `LaTeX: ${src.replace(/([^\s\\])\\(?=[a-zA-Z])/g, '$1 \\').replace(/\s+/g, ' ')}`.split(' ');
    tokens.forEach((tok, i) => {
      const s = document.createElement('span');
      s.className = 'dl4s-ptex__tok';
      s.textContent = tok;
      line.append(s, i < tokens.length - 1 ? ' ' : '');
    });
    d.after(line);
  });
}

export function removePrintTex(root) {
  root?.querySelectorAll('.dl4s-ptex').forEach((el) => el.remove());
}

export const PRINT_TITLE = 'CITS5017 L4 RNNs — Read + Play';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-left { content: 'CITS5017 Lecture 4 · Processing sequences using RNNs and CNNs · Read + Play'; font: 7pt 'IBM Plex Mono', monospace; color: #6f8fa0; }
    @bottom-right { content: counter(page); font: 7pt 'IBM Plex Mono', monospace; color: #6f8fa0; }
  }

  /* 1 · paper */
  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__content { animation: none !important; transform: none !important; padding: 0 !important; }
  ${P} .dl.dl4s {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    position: static !important; height: auto !important; width: auto !important; overflow: visible !important;
    padding: 0 !important; margin: 0 !important; background: #fff !important; max-width: none !important;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12); --accent-pale: #c3fad4;
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
    color: var(--ink-2);
  }
  ${P} .dl4s * { animation: none !important; transition: none !important; }

  /* 2 · Read + Play only */
  ${P} .dl4s-bar, ${P} .dl4s-rail, ${P} .dl4s-drop, ${P} .dl4s-resume, ${P} .dl4s-hero__actions,
  ${P} .dl4s-hero__stats, ${P} .dl4s-hero__lead, ${P} .dl4s-road__prog, ${P} .dl4s-outcome__prog, ${P} .dl4s-export, ${P} .dl4s-beat--write, ${P} .dl4s-nbt, ${P} .dl4s-try,
  ${P} .dl4s-seq-swipe, ${P} .dl4s-seq-sortbar, ${P} .dl4s-seq-show, ${P} .dl4s-c1d-wedit button, ${P} .dl4s-outcome__tick,
  ${P} .dl4s-outcome__nb, ${P} .dlk-unfold__plus, ${P} .dlk-fnote__pop { display: none !important; }
  ${P} .dl4s-layout, ${P} .dl4s-layout--rail, ${P} .dl4s-flow { display: block !important; margin: 0 !important; max-width: none !important; }
  ${P} .dl4s-hero { padding: 0 0 4mm; border-bottom: 2px solid var(--ink); margin-bottom: 4mm; }
  ${P} .dl4s-hero__title { font-size: 1.9rem; max-width: none; }
  ${P} .dl4s-hero__lead { font-size: 0.86rem; max-width: none; }
  ${P} .dl4s-print-only { display: block !important; }
  ${P} .dl4s-print-note { margin: 2mm 0 0; font-size: 0.74rem; line-height: 1.5; color: var(--ink-3); }

  /* 6 · one section per page; the hero shares page 1 with §0 */
  ${P} .dl4s-sec { display: block; break-before: page; scroll-margin: 0; }
  ${P} .dl4s-hero + .dl4s-sec { break-before: auto; }
  ${P} .dl4s-sec + .dl4s-sec, ${P} .dl4s-hero + .dl4s-sec { margin-top: 0; }
  ${P} .dl4s-sec__head { break-after: avoid; }
  ${P} .dl4s-sec__title { font-size: 1.45rem; }
  ${P} .dl4s-receipt { border: 0; padding: 0; }
  ${P} .dl4s-beat { display: block; margin-top: 4mm; }
  ${P} .dl4s-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dl4s-beat__n { border-width: 1px; }
  ${P} .dl4s-end { break-before: avoid; margin-top: 6mm; }

  /* 3 · Read, all of it */
  ${P} .dl4s-read { max-width: none; display: block; }
  ${P} .dl4s-read > * + * { margin-top: 2.2mm; }
  ${P} .dl4s-p, ${P} .dl4s-list li { font-size: 0.8rem; line-height: 1.55; }
  ${P} .dlk-unfold { border-color: var(--line-2); }
  ${P} .dlk-unfold__head { padding: 1.5mm 0 1mm; font-size: 0.72rem; color: var(--ink-3); pointer-events: none; }
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; display: block !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-fnote__btn { border: 0; background: none; padding: 0; font-size: 0.62rem; vertical-align: super; color: var(--accent-ink); }
  ${P} .dlk-fnote__btn::before { content: '['; } ${P} .dlk-fnote__btn::after { content: ']'; }
  ${P} .dl4s-printrefs { margin: 2.5mm 0 0; padding: 1.5mm 0 0 5mm; border-top: 1px solid var(--line-2); font-size: 0.7rem; line-height: 1.45; color: var(--ink-3); }
  ${P} .dl4s-printrefs li { margin: 0.6mm 0; }
  ${P} .dlk-note { break-inside: avoid; }
  ${P} .dl4s-readfig { max-width: 150mm; }

  /* equations: whole, readable, with their LaTeX under them as text */
  ${P} .dlk-eq, ${P} .dlk-tex-block { break-inside: avoid; }
  ${P} .dlk-tex-block { overflow: visible !important; }
  ${P} .dlk-eq { margin: 2mm 0; }
  ${P} .dl4s-ptex { display: block; margin: 0.6mm 0 1.2mm; font-family: 'Cascadia Mono', Consolas, 'IBM Plex Mono', monospace; font-size: 6.6pt; line-height: 1.35; color: #6f8fa0; white-space: normal; text-align: left; }
  ${P} .dl4s-ptex__tok { white-space: nowrap; }

  /* code: VS Code's Light+, wrapped, whole when short */
  ${P} .dlk-code { background: #f6f8fa !important; border: 1px solid var(--line); box-shadow: none !important; break-inside: avoid; }
  ${P} .dlk-code__bar { background: #eef1f4 !important; border-bottom: 1px solid var(--line-2); color: #4f6f80 !important; }
  ${P} .dlk-code__file, ${P} .dlk-code__meta { color: #4f6f80 !important; }
  ${P} .dlk-code__pre { background: #f6f8fa !important; color: #1f1f1f !important; overflow: visible !important; font-size: 0.62rem; line-height: 1.5; }
  ${P} .dlk-code__code { min-width: 0 !important; white-space: pre-wrap; overflow-wrap: anywhere; }
  ${P} .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; }
  ${P} .dlk-code__line::before { color: #9aa7b0 !important; }
  ${P} .dlk-code__line--hl { background: rgba(56, 139, 253, 0.08) !important; box-shadow: inset 2px 0 0 #388bfd !important; }
  ${P} .dlk-code__line--dim { opacity: 1 !important; }
  ${P} .dlk-code .tok-cm { color: #3d7a2f; } ${P} .dlk-code .tok-st { color: #a31515; } ${P} .dlk-code .tok-nu { color: #098658; }
  ${P} .dlk-code .tok-kw { color: #af00db; } ${P} .dlk-code .tok-ct { color: #0000ff; } ${P} .dlk-code .tok-fn { color: #795e26; }
  ${P} .dlk-code .tok-pr { color: #6e7681; }
  ${P} .dl4s pre:not(.dlk-code__pre) { white-space: pre-wrap; overflow: visible; }

  /* Play: the labs as figures */
  /* a lab is a ruled block, not a box: a frame split by a page break would
     leave an empty bordered strip at the foot of a page */
  ${P} .dl4s-lab { break-inside: auto; border: 0; border-top: 1.5px solid var(--line); border-radius: 0; background: none; padding: 2.5mm 0 0; margin-top: 4mm; }
  ${P} .dl4s-lab__bar { break-after: avoid; }
  ${P} .dl4s-lab svg, ${P} .dl4s-stats, ${P} .dl4s-stat, ${P} .dl-table, ${P} table, ${P} .dl4s-readout, ${P} .dl4s-total, ${P} .dl4s-tl4,
  ${P} .dl4s-eqrow, ${P} .dl4s-c1d-fmap, ${P} .dl4s-seq-card, ${P} .dl4s-road__item, ${P} .dl4s-outcome { break-inside: avoid; }
  ${P} .dl4s-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  ${P} .dl4s-seq-printpanel { break-inside: avoid; }
  ${P} .dl4s-seq-printpanel + .dl4s-seq-printpanel { margin-top: 3mm; padding-top: 2mm; border-top: 1px solid var(--line-2); }
  ${P} .dl4s-stat__v { font-size: 1rem; }

  /* 4 · controls as text */
  ${P} .dl-btn, ${P} .dl4s-btn, ${P} input[type='range'], ${P} .dl-chip:not(.dl-chip--on), ${P} .dl-check input { display: none !important; }
  ${P} .dl-chip.dl-chip--on { border: 0 !important; background: none !important; padding: 0 !important; color: var(--ink) !important; font-weight: 700; box-shadow: none !important; }
  ${P} .dl-chip__tag { margin-left: 0.4em; }
  ${P} .dl-ctl { gap: 0.2rem 0.6rem; }
  ${P} .dl-ctl__label { min-width: 0; color: var(--ink-3); }
  ${P} .dl-ctl__label::after { content: ':'; }
  ${P} .dl-sliders { display: flex; flex-wrap: wrap; gap: 0.2rem 1.2rem; }
  ${P} .dl-slider, ${P} .dl4s-range { min-width: 0 !important; font-size: 0.72rem; }
  ${P} .dl-lab__controls { gap: 1mm; font-size: 0.72rem; }
  ${P} .dl4s-stepper { gap: 0.2rem; }
  ${P} .dl4s-stepper .dl-chip { display: none !important; }
  ${P} .dl4s-stepper .dl-chip.dl-chip--on { display: inline !important; }
  ${P} .dl4s-secchip { border: 0; background: none; padding: 0; }
  ${P} .dl4s-link { text-decoration: none; color: inherit; }
  ${P} button { cursor: default; }
  ${P} [tabindex] { outline: none !important; }

  /* 5 · nothing clipped */
  ${P} .dl4s-wide, ${P} .dl-tablewrap, ${P} .dl4s-c1d-stage, ${P} .dl4s-c1d-fmap, ${P} .dl4s-seq-stage, ${P} .dl4s-neuron__stage { overflow: visible !important; }
  ${P} .dl4s-wide > svg, ${P} .dl4s-c1d-stage > svg, ${P} .dl4s-seq-stage > svg { min-width: 0 !important; width: 100% !important; height: auto; }
  ${P} .dl4s-c1d-fmap__grid { min-width: 0 !important; }
  ${P} .dl4s-lab svg { max-height: 120mm; }
  /* a haloed SVG label is written twice into the PDF's text: no halos on paper */
  ${P} .dl4s svg text { paint-order: normal !important; stroke: none !important; }

  ${P} .dl4s p, ${P} .dl4s li { orphans: 3; widows: 3; }
}
`;
