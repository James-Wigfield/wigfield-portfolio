/* ============================================================================
   LECTURE 3 STUDY — PRINT / PDF EXPORT ("Read + Play")
   ----------------------------------------------------------------------------
   Export PDF puts html.dl3s-printing on the page and calls window.print(), so
   THIS block is the export format. Every rule sits under that class, so
   printing any other page is untouched. It is mounted as a <style> inside
   the module (not bundled) so its @page out-cascades the full-bleed @page
   portal.css installs for Wall Art, and disappears with the module.

     1 · paper — A4 portrait, document margins, page numbers; a print-only
         cover (.dl3s-printonly) says what the PDF holds
     2 · one palette — the jade tokens and the light --dlv-* steps are forced
         onto .dl3s, so coral and arcade readers still get a light document;
         code prints in VS Code's Light+ colours
     3 · Read + Play only — every notebook (Write) page, the sticky bar, the
         index, the hero's buttons and the export UI never print; neither do
         the §12.1–12.3 deep dives unless html.dl3s-print-dd asks for them
     4 · everything expanded — Unfold bodies open, footnotes listed under each
         section, "Slide check" notes kept
     5 · labs frozen — sliders, play / step / reset buttons and unpicked chips
         go; the picked chip stays as text, so every value reads on paper
     6 · maths as text — the typeset KaTeX is swapped for the plain-text twin
         ./texPlain.js writes on entering print mode, so the PDF's text layer
         holds each equation once, in reading order
     7 · nothing split that matters — figures, tables, equations, code, stat
         rows; headings keep with what follows; each section starts a page
   ========================================================================== */

const P = 'html.dl3s-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 15mm;
    @bottom-right { content: counter(page); font: 7.5pt Consolas, ui-monospace, monospace; color: #6f8fa0; }
    @bottom-left { content: 'CITS5017 Lecture 3 · CNNs · Read + Play'; font: 7.5pt Consolas, ui-monospace, monospace; color: #6f8fa0; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__content { animation: none !important; transform: none !important; padding: 0 !important; }

  /* 2 · one light palette */
  ${P} .dl.dl3s {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f4f8f9;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.32); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
    color: var(--ink-2); background: #fff;
  }
  ${P} .hp.portal[data-portal-theme] .dl.dl3s {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* focus mode never reaches paper (the button leaves it first; this covers Ctrl+P) */
  ${P} .dl3s:fullscreen, ${P} .dl3s.dl3s--pseudo { position: static !important; width: auto !important; height: auto !important; overflow: visible !important; padding: 0 !important; }

  /* 3 · screen-only chrome, the Write beat, and the deep dives unless asked for */
  ${P} .dl3s-bar, ${P} .dl3s-rail, ${P} .dl3s-drop, ${P} .dl3s-hero__lead, ${P} .dl3s-hero__actions, ${P} .dl3s-hero__stats,
  ${P} .dl3s-nlm, ${P} .dl3s-beat--write, ${P} .dl3s-nb, ${P} .dl3s-screenonly { display: none !important; }
  ${P}:not(.dl3s-print-dd) .dl3s-sec--opt, ${P}:not(.dl3s-print-dd) .dl3s-ddref, ${P}:not(.dl3s-print-dd) .dl3s-print-dd-on { display: none !important; }
  ${P}.dl3s-print-dd .dl3s-print-dd-off { display: none !important; }
  ${P} .dl3s-printonly { display: block !important; }
  ${P} .dl3s-layout, ${P} .dl3s-layout--rail, ${P} .dl3s-flow { display: block !important; margin: 0 !important; max-width: none !important; }

  /* 1 · the cover */
  ${P} .dl3s-hero { display: block; padding: 0; }
  ${P} .dl3s-hero__kicker { margin: 0 0 3mm; }
  ${P} .dl3s-hero__title { font-size: 1.9rem; max-width: none; margin: 0 0 4mm; padding-bottom: 4mm; border-bottom: 2px solid var(--ink); }
  ${P} .dl3s-cover { margin: 0 0 2mm; font-size: 0.8rem; line-height: 1.55; color: var(--ink-2); }
  ${P} .dl3s-cover p { margin: 0 0 2mm; }
  ${P} .dl3s-cover b { color: var(--ink); }

  /* sections: one per page, heads kept with their first lines */
  ${P} .dl3s-sec { display: block; break-before: page; margin: 0; }
  ${P} .dl3s-hero + .dl3s-sec { break-before: auto; margin-top: 7mm; }
  ${P} .dl3s-sec > * + * { margin-top: 4mm; }
  ${P} .dl3s-sec__head { padding-top: 2.5mm; break-after: avoid; }
  ${P} .dl3s-sec__no { font-size: 1.3rem; }
  ${P} .dl3s-sec__title { font-size: 1.35rem; min-width: 0; }
  ${P} .dl3s-beat { display: block; }
  ${P} .dl3s-beat > * + * { margin-top: 2.5mm; }
  ${P} .dl3s-beat__label { break-after: avoid; letter-spacing: 0.05em; }
  ${P} .dl3s-beat__label + * { break-before: avoid; }
  ${P} .dl3s-read { display: block; max-width: none; }
  ${P} .dl3s-read > * + * { margin-top: 2.2mm; }
  ${P} .dl3s-p, ${P} .dl3s-list li { font-size: 0.8rem; line-height: 1.55; }
  ${P} .dl3s-read .dlk-eq, ${P} .dl3s-read .dlk-code, ${P} .dl3s-read .dlk-note, ${P} .dl3s-read .dlk-unfold { max-width: none; }
  ${P} .dl3s-link { color: var(--ink); text-decoration: none; padding: 0; }
  /* inline code: no chip padding, which pdftotext reads as stray spaces */
  ${P} .dl3s code:not(.dlk-code__code) { padding: 0 !important; background: none !important; border: 0 !important; }
  ${P} .dl3s p, ${P} .dl3s li { orphans: 3; widows: 3; }

  /* 4 · expanded: unfolds open, footnotes listed */
  ${P} .dl3s .dlk-unfold__body { display: block !important; }
  ${P} .dl3s .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dl3s .dlk-unfold__plus { display: none; }
  ${P} .dl3s .dlk-unfold__head { padding-left: 0; cursor: default; break-after: avoid; }
  ${P} .dl3s .dlk-fnote__pop { display: none !important; }
  ${P} .dl3s .dlk-fnote__btn { color: var(--ink-3); padding: 0; }
  ${P} .dl3s .dlk-fnote__btn::before { content: '['; }
  ${P} .dl3s .dlk-fnote__btn::after { content: ']'; }
  ${P} .dl3s-fns { display: block !important; margin: 3mm 0 0; padding: 2mm 0 0 5mm; border-top: 1px solid var(--line-2); font-size: 0.66rem; line-height: 1.45; color: var(--ink-3); break-inside: avoid; }
  ${P} .dl3s-fns li { margin: 0.4mm 0; }

  /* 2 · code on paper: Light+ on a pale ground, wrapped, nothing dimmed */
  ${P} .dl3s .dlk-code { border: 1px solid var(--line); box-shadow: none; border-radius: 4px; }
  ${P} .dl3s .dlk-code__bar { background: #eef1f3; border-bottom: 1px solid var(--line-2); padding: 1mm 2.5mm; }
  ${P} .dl3s .dlk-code__dots { display: none; }
  ${P} .dl3s .dlk-code__file { color: #1f1f1f; font-weight: 700; }
  ${P} .dl3s .dlk-code__meta { color: #5a6570; }
  ${P} .dl3s .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; overflow: visible; font-size: 0.64rem; line-height: 1.5; padding: 1.5mm 0; }
  ${P} .dl3s .dlk-code__code { min-width: 0; }
  ${P} .dl3s .dlk-code__line { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: 3.1em; text-indent: -3.1em; }
  ${P} .dl3s .dlk-code__line::before { width: 2.2em; margin-right: 0.9em; color: #8a949c; text-indent: 0; }
  ${P} .dl3s .dlk-code__line--dim { opacity: 1; }
  ${P} .dl3s .dlk-code__line--hl { background: #e4eefb; box-shadow: inset 2px 0 0 #2a78d6; }
  ${P} .dl3s .dlk-code__line--hl::before { color: #4f6f80; }
  ${P} .dl3s .tok-cm { color: #3d7a2f; }
  ${P} .dl3s .tok-st { color: #a31515; }
  ${P} .dl3s .tok-nu { color: #098658; }
  ${P} .dl3s .tok-kw { color: #af00db; }
  ${P} .dl3s .tok-ct { color: #0000ff; }
  ${P} .dl3s .tok-fn { color: #795e26; }
  ${P} .dl3s .tok-pr { color: #6e7681; }
  ${P} .dl3s .dl3s-nb__code, ${P} .dl3s pre { white-space: pre-wrap; }

  /* 6 · maths: the plain-text twin, never the typeset copy */
  ${P} .dl3s .katex { display: none !important; }
  ${P} .dl3s .dl3s-texprint { display: inline !important; font-family: Cambria, 'Cambria Math', Georgia, serif; color: var(--ink); }
  ${P} .dl3s .dlk-tex-block .dl3s-texprint { display: block !important; margin: 1mm 0; text-align: center; font-size: 0.92rem; }
  ${P} .dl3s .dlk-tex-block { overflow: visible; }
  ${P} .dl3s .dl3s-texprint { text-transform: none; letter-spacing: 0; }
  ${P} .dl3s-filters .dl3s-texprint { white-space: nowrap; font-size: 0.74rem; }

  /* 5 · labs frozen in their default state */
  ${P} .dl3s-lab { break-inside: avoid; padding: 3mm 3.5mm; border-color: var(--line); background: #fff; box-shadow: none; }
  ${P} .dl3s-lab__bar, ${P} .dl3s-try { break-after: avoid; }
  ${P} .dl3s-try { font-size: 0.72rem; }
  ${P} .dl3s input[type='range'] { display: none !important; }
  ${P} .dl3s .dl-chip:not(.dl-chip--on) { display: none !important; }
  ${P} .dl3s .dl-chip.dl-chip--on { background: none !important; border-color: transparent !important; color: var(--ink) !important; padding: 0 !important; font-weight: 700; box-shadow: none !important; }
  ${P} .dl3s .dl-btn, ${P} .dl3s .dl3s-btnrow, ${P} .dl3s .dl3s-minichips { display: none !important; }
  ${P} .dl3s .dl-tablewrap { overflow: visible !important; }
  ${P} .dl3s svg text { stroke: none !important; }
  /* the three labs taller than a page (§2 stepper, §5 channel sum, §14
     transfer) shrink so their last lines don't spill onto a page of their own */
  ${P} .dl3s-lab { gap: 2.2mm; }
  ${P} .dl3s-grid { max-width: 190px; }
  ${P} .dl3s-mat { max-width: 200px; }
  ${P} .dl3s-stack { max-width: 520px; }
  ${P} .dl3s .dl3s-conv { grid-template-columns: 180px minmax(0, 1fr) 180px !important; gap: 4mm; }
  ${P} .dl3s .dl3s-conv > :last-child { grid-column: auto !important; }
  ${P} .dl3s .dlk-code__pre { line-height: 1.38; }
  ${P} .dl3s-stat { padding: 1.5mm 2.2mm; }
  ${P} .dl3s-stat__v { font-size: 1rem; }
  ${P} .dl3s-cap, ${P} .dl3s-readout { max-width: none; }

  /* 7 · nothing split that matters */
  ${P} .dl3s svg, ${P} .dl3s figure, ${P} .dl3s table, ${P} .dl3s tr, ${P} .dl3s .dlk-eq, ${P} .dl3s .dlk-code,
  ${P} .dl3s .dlk-note, ${P} .dl3s-stats, ${P} .dl3s-stat, ${P} .dl3s-cap, ${P} .dl3s-readout, ${P} .dl3s .katex-display,
  ${P} .dl3s-arch, ${P} .dl3s-compare__card, ${P} canvas { break-inside: avoid; }
  ${P} .dl3s-leadlist__lead, ${P} .dl3s-stagehead, ${P} .dl3s .dlk-eq__head { break-after: avoid; }
  /* a lab too tall for one page still breaks, but its closing caption or
     readout travels with the part above it instead of landing alone */
  ${P} .dl3s-lab > :last-child, ${P} .dl3s-lab .dl3s-cap { break-before: avoid; }
  ${P} .dl3s-decodeprint { width: 100%; font-size: 0.7rem; margin-top: 1.5mm; }

  ${P} .dl3s-end { margin-top: 8mm; }
}
`;
