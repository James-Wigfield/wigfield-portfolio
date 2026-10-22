
/* ============================================================================
   LECTURE 8 STUDY — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   Export PDF is the browser's print pipeline (Save as PDF), so the text stays
   real and selectable for NotebookLM, nothing new is bundled, and the PDF is
   always the page as it is now. The shell puts html.dl8s-printing on while it
   prints; every rule below is scoped to it. The block is mounted as a <style>
   inside the module, so its @page beats the portal's full-bleed print page and
   leaves with the module. Jobs:

     paper     A4 portrait with document margins; the jade tokens forced on,
               whatever the portal theme; print-color-adjust: exact
     content   the hero title, then every section (§, title, slide range,
               §16's "not examined" flag),
               its Read beat in full — unfolds expanded, footnotes written
               out, slide checks kept — and its Play beat as a finished state
               (the labs read `printing`: trained, not epoch 0)
     left out  every notebook (Write) page, the portal and module chrome,
               the rail, Resume, the hero's buttons and this export UI, tick
               boxes, and controls that mean nothing on paper
     maths     each formula prints its plain-text twin (.dl8s-texalt), so the
               PDF's text layer reads as words; KaTeX stays for the eye on
               display equations
     code      VS Code's Light+ palette on paper, wrapped, no line numbers
     breaks    sections start on a new page; figures, tables, equations, code
               and stat rows stay whole; headings stay with what follows
   ========================================================================== */

// Everything the PDF needs, settled: the lazy data (bus/rail runs, the toy
// transformer), fonts, and a beat for React to re-render the labs in their
// printing state and for KaTeX (rendered in effects) to catch up.
export async function preparePrint() {
  try {
    await Promise.all([import('./data/busrail.js'), import('./data/toyMT.js')]);
  } catch {
    /* the labs print their "couldn't load" state instead */
  }
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  await new Promise((r) => setTimeout(r, 300));
}

const P = 'html.dl8s-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Lecture 8 · Attention & Transformers · Read + Play'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dl8s {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }
  ${P} .hp.portal[data-portal-theme] .dl.dl8s {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* left out: chrome, the Write beat, controls */
  ${P} .dl8s-bar, ${P} .dl8s-rail, ${P} .dl8s-drop, ${P} .dl8s-hero__actions, ${P} .dl8s-hero__lead, ${P} .dl8s-hero__stats,
  ${P} .dl8s-beat--write, ${P} .dl8s-try, ${P} .dl-lab__controls, ${P} .dl8s-noprint, ${P} .dl8s-export, ${P} .dl8s-nlm,
  ${P} .dl8s-end, ${P} .dlk-fnote__pop, ${P} .dl8s-screenonly { display: none !important; }
  ${P} .dl8s-hero__printlead { display: block !important; }
  ${P} .dl8s-printonly { display: block !important; }
  ${P} .dl8s-screenonly-hidden { display: block !important; }

  /* blocks, not grids that page badly */
  ${P} .dl8s, ${P} .dl8s-layout, ${P} .dl8s-layout--rail, ${P} .dl8s-flow { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; position: static !important; }
  ${P} .dl8s-hero { padding: 0 0 4mm; border-bottom: 2px solid var(--ink); }
  ${P} .dl8s-hero__title { font-size: 1.7rem; max-width: none; }
  ${P} .dl8s-hero__printlead { margin: 3mm 0 0; font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); }
  ${P} .dl8s-sec { display: block; break-before: page; }
  ${P} .dl8s-hero + .dl8s-sec { break-before: auto; margin-top: 6mm; }
  ${P} .dl8s-sec__head { border-top: 2px solid var(--ink); padding-top: 2mm; break-after: avoid; }
  ${P} .dl8s-beat { display: block; margin-top: 4mm; }
  ${P} .dl8s-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dl8s-read { max-width: none; display: block; }
  ${P} .dl8s-read > * + * { margin-top: 2.2mm; }
  ${P} .dl8s-p, ${P} .dl8s-list li { font-size: 0.84rem; line-height: 1.55; }
  ${P} .dl8s p, ${P} .dl8s li { orphans: 3; widows: 3; }

  /* Read: unfolds open, footnotes written out */
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-unfold__plus { display: none; }
  ${P} .dlk-unfold__head { padding-left: 0; font-weight: 700; color: var(--ink); break-after: avoid-page; }
  ${P} .dlk-unfold { break-inside: avoid-page; }
  ${P} .dl8s-printfn { display: block !important; margin: 3mm 0 0; padding: 2mm 0 0 5mm; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--ink-2); }
  ${P} .dlk-fnote__btn { border: none; background: none; padding: 0; font-size: 0.62em; vertical-align: super; color: var(--ink); }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dl8s-m .dlk-tex-inline { display: none !important; }
  ${P} .dl8s-m .dl8s-texalt { display: inline !important; font-style: italic; }
  ${P} .dl8s-eq .dl8s-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.78rem; color: var(--ink-2); }
  ${P} .dl8s-eq .dl8s-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }

  /* code: Light+ on paper, wrapped, no line numbers */
  ${P} .dl8s .dlk-code { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
  ${P} .dl8s .dlk-code__bar { background: #eef2f4; border-bottom: 1px solid var(--line); }
  ${P} .dl8s .dlk-code__file { color: #333; }
  ${P} .dl8s .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; font-size: 0.66rem; line-height: 1.5; overflow: visible; white-space: pre-wrap; }
  ${P} .dl8s .dlk-code__code { min-width: 0; }
  ${P} .dl8s .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; white-space: pre-wrap; opacity: 1 !important; }
  ${P} .dl8s .dlk-code__line::before { content: none; }
  ${P} .dl8s .dlk-code__line--hl { background: rgba(56, 139, 253, 0.12); }
  ${P} .dl8s .tok-cm { color: #3d7a2f; }
  ${P} .dl8s .tok-st { color: #a31515; }
  ${P} .dl8s .tok-nu { color: #098658; }
  ${P} .dl8s .tok-kw { color: #af00db; }
  ${P} .dl8s .tok-ct { color: #0000ff; }
  ${P} .dl8s .tok-fn { color: #795e26; }

  /* Play: each lab prints its finished picture (story labs pin their last
     beat), its caption, and its maths drawer opened with the lab's values */
  ${P} .hp.portal[data-portal-theme] .dl.dl8s {
    --dl8s-q: #c2410c; --dl8s-k: #1d5fc9; --dl8s-v: #15803d; --dl8s-pos: #6d3fc0; --dl8s-mask: #64748b;
    --dl8s-enc: #0e7490; --dl8s-dec: #be185d; --dl8s-neg: #8a8178; --dl8s-bwd: #c98500;
    --dl8s-floor: #ffffff; --dl8s-floor-line: transparent; --dl8s-shadow: none;
  }
  ${P} .dl8s-stage { break-inside: auto; margin-top: 4mm; display: block; }
  ${P} .dl8s-stage > * + * { margin-top: 2mm; }
  ${P} .dl8s-stage__head { break-after: avoid; }
  ${P} .dl8s-stage__title { font-size: 1.05rem; }
  ${P} .dl8s-stage__floor { background: #fff; background-image: none; box-shadow: none; border: 1px solid var(--line); padding: 3mm; break-inside: avoid; }
  ${P} .dl8s-stage__floor svg.dl8s-svg { max-width: 165mm; margin: 0 auto; }
  ${P} .dl8s-stage__cap { font-size: 0.78rem; max-width: none; }
  ${P} .dl8s-stage__try, ${P} .dl8s-story__row, ${P} .dl8s-chal, ${P} .dl8s-floorbtn, ${P} .dl8s-maths__btn, ${P} .dl8s-br__loop .dl8s-story__play, ${P} .dl8s-lk__code { display: none !important; }
  ${P} .dl8s-story__say { font-size: 0.8rem; font-style: italic; }
  ${P} .dl8s-story__say::before { content: 'Final step shown: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl8s-switch { border-bottom: none; margin-bottom: 1mm; }
  ${P} .dl8s-switch__opt { padding: 0 1.5mm 0 0; font-size: 0.72rem; }
  ${P} .dl8s-switch__opt:not(.dl8s-switch__opt--on) { display: none; }
  ${P} .dl8s-switch__opt--on::before { content: 'Shown: '; color: var(--ink-3); }
  ${P} .dl8s-maths { border-top: 1px solid var(--line-2); padding-top: 1.5mm; }
  ${P} .dl8s-maths__printk { display: block !important; margin: 0 0 1mm; font-size: 0.72rem; font-weight: 700; color: var(--ink-2); }
  ${P} .dl8s-maths__body { padding: 0; gap: 1.2mm; max-width: none; }
  ${P} .dl8s-mline { font-size: 0.78rem; line-height: 1.5; overflow: visible; }
  ${P} .dl8s-meq .dl8s-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.76rem; color: var(--ink-2); }
  ${P} .dl8s-meq .dl8s-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl8s-mnote { font-size: 0.72rem; }
  ${P} .dl8s-own { font-size: 0.62rem; }
  ${P} .dl8s svg text { stroke: none !important; }
  ${P} .dl8s .dl8s-halo { stroke: #fff !important; }
  ${P} .dl8s-tip { display: none; }
  ${P} .dl8s-route__stop { padding: 1mm 0; }
  ${P} .dl8s-route__count { display: none; }
  ${P} .dl8s-br__score { max-width: none; }
  /* letter-spaced caps extract as "P L AY"; on paper they are set solid */
  ${P} .dl8s :is(.dl8s-beat__label, .dl8s-stage__slides, .dl8s-receipt, .dl8s-own, .dl8s-hero__kicker, .dlk-note__label, .dlk-eq__name, .dl8s-flag, .dl8s-br__winsk) { letter-spacing: 0 !important; }
  /* a beat's label stays with its first block */
  ${P} .dl8s-beat__label { break-after: avoid-page; }
  ${P} .dl8s-beat > .dl8s-beat__label + * { break-before: avoid-page; }
  /* §16: still printed, visibly flagged */
  ${P} .dl8s-flag { font-weight: 700; color: var(--ink); }

  /* nothing split that matters */
  ${P} figure, ${P} table, ${P} .dlk-eq, ${P} .dl8s-eq, ${P} .dl8s-stats, ${P} .dl8s-stat, ${P} .dlk-note, ${P} svg, ${P} .dl8s-keep { break-inside: avoid; }
  ${P} .dl8s-stagehead, ${P} h2, ${P} h3, ${P} h4 { break-after: avoid; }
}
`;
