
/* ============================================================================
   LECTURES 1–2 REFRESHER — PRINT / PDF EXPORT  (copied from Lecture 8)
   ----------------------------------------------------------------------------
   Export PDF is the browser's print pipeline (Save as PDF), so the text stays
   real and selectable for NotebookLM. The shell puts html.dl12r-printing on
   while it prints; every rule below is scoped to it. The block is mounted as
   a <style> inside the module, so its @page beats the portal's own print page
   and leaves with the module. Jobs:

     paper     A4 portrait; the jade tokens forced on, whatever the theme
     content   the hero title, then the two parts in order — each part head
               ("Lecture 1 · …"), every section's §, title and "L1 · slides"
               receipt (the outlined L1/L2 mark prints), its Read beat in
               full (unfolds open, slide checks kept) and its Play beat as a
               finished state (the labs read `printing`)
     left out  all three notebook pages (and their hidden measuring copies),
               the portal and module chrome, the rail, Resume, the hero's
               buttons, this export UI, the Go-deeper links, controls that
               mean nothing on paper
     maths     each formula prints its plain-text twin (.dl12r-texalt)
     code      VS Code's Light+ palette on paper, wrapped, no line numbers
     breaks    sections start on a new page; figures, tables, equations, code
               stay whole; headings stay with what follows
   ========================================================================== */

// Everything the PDF needs, settled: fonts, and a beat for React to re-render
// the labs in their printing state and for KaTeX to catch up.
export async function preparePrint() {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  await new Promise((r) => setTimeout(r, 300));
}

const P = 'html.dl12r-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Lectures 1–2 · Refresher · Read + Play'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dl12r {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }
  ${P} .hp.portal[data-portal-theme] .dl.dl12r {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* left out: chrome, the Write beat, controls */
  ${P} .dl12r-bar, ${P} .dl12r-rail, ${P} .dl12r-drop, ${P} .dl12r-hero__actions, ${P} .dl12r-hero__lead, ${P} .dl12r-hero__stats,
  ${P} .dl12r-beat--write, ${P} .dl12r-try, ${P} .dl-lab__controls, ${P} .dl12r-noprint, ${P} .dl12r-export, ${P} .dl12r-nlm,
  ${P} .dl12r-end, ${P} .dlk-fnote__pop, ${P} .dl12r-screenonly,
  ${P} .dl12r-nbsec, ${P} .dl12r-measure, ${P} .dl12r-deeper, ${P} .dl12r-sr { display: none !important; }
  ${P} .dl12r-hero__printlead { display: block !important; }
  ${P} .dl12r-printonly { display: block !important; }
  ${P} .dl12r-screenonly-hidden { display: block !important; }

  /* blocks, not grids that page badly */
  ${P} .dl12r, ${P} .dl12r-layout, ${P} .dl12r-layout--rail, ${P} .dl12r-flow { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; position: static !important; }
  ${P} .dl12r-hero { padding: 0 0 4mm; border-bottom: 2px solid var(--ink); }
  ${P} .dl12r-hero__title { font-size: 1.7rem; max-width: none; }
  ${P} .dl12r-hero__printlead { margin: 3mm 0 0; font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); }
  ${P} .dl12r-sec { display: block; break-before: page; }
  ${P} .dl12r-part { display: block; break-before: page; margin: 0; padding-top: 3mm; }
  ${P} .dl12r-part + .dl12r-sec { break-before: avoid; margin-top: 6mm; }
  ${P} .dl12r-hero + .dl12r-part { break-before: auto; margin-top: 6mm; }
  ${P} .dl12r-part__title { font-size: 1.5rem; }
  ${P} .dl12r-gist { font-size: 0.95rem; }
  ${P} .dl12r-table--read { min-width: 0; font-size: 0.74rem; }
  ${P} .dl12r-tablewrap { overflow: visible; }
  ${P} .dl12r-receipt { color: var(--ink-2); }
  ${P} .dl12r-sec__head { border-top: 2px solid var(--ink); padding-top: 2mm; break-after: avoid; }
  ${P} .dl12r-beat { display: block; margin-top: 4mm; }
  ${P} .dl12r-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dl12r-read { max-width: none; display: block; }
  ${P} .dl12r-read > * + * { margin-top: 2.2mm; }
  ${P} .dl12r-p, ${P} .dl12r-list li { font-size: 0.84rem; line-height: 1.55; }
  ${P} .dl12r p, ${P} .dl12r li { orphans: 3; widows: 3; }

  /* Read: unfolds open, footnotes written out */
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-unfold__plus { display: none; }
  ${P} .dlk-unfold__head { padding-left: 0; font-weight: 700; color: var(--ink); break-after: avoid-page; }
  ${P} .dlk-unfold { break-inside: avoid-page; }
  ${P} .dl12r-printfn { display: block !important; margin: 3mm 0 0; padding: 2mm 0 0 5mm; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--ink-2); }
  ${P} .dlk-fnote__btn { border: none; background: none; padding: 0; font-size: 0.62em; vertical-align: super; color: var(--ink); }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dl12r-m .dlk-tex-inline { display: none !important; }
  ${P} .dl12r-m .dl12r-texalt { display: inline !important; font-style: italic; }
  ${P} .dl12r-eq .dl12r-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.78rem; color: var(--ink-2); }
  ${P} .dl12r-eq .dl12r-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }

  /* code: Light+ on paper, wrapped, no line numbers */
  ${P} .dl12r .dlk-code { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
  ${P} .dl12r .dlk-code__bar { background: #eef2f4; border-bottom: 1px solid var(--line); }
  ${P} .dl12r .dlk-code__file { color: #333; }
  ${P} .dl12r .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; font-size: 0.66rem; line-height: 1.5; overflow: visible; white-space: pre-wrap; }
  ${P} .dl12r .dlk-code__code { min-width: 0; }
  ${P} .dl12r .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; white-space: pre-wrap; opacity: 1 !important; }
  ${P} .dl12r .dlk-code__line::before { content: none; }
  ${P} .dl12r .dlk-code__line--hl { background: rgba(56, 139, 253, 0.12); }
  ${P} .dl12r .tok-cm { color: #3d7a2f; }
  ${P} .dl12r .tok-st { color: #a31515; }
  ${P} .dl12r .tok-nu { color: #098658; }
  ${P} .dl12r .tok-kw { color: #af00db; }
  ${P} .dl12r .tok-ct { color: #0000ff; }
  ${P} .dl12r .tok-fn { color: #795e26; }

  /* Play: each lab prints its finished picture (story labs pin their last
     beat), its caption, and its maths drawer opened with the lab's values */
  ${P} .hp.portal[data-portal-theme] .dl.dl12r {
    --dl12r-c1: #c2410c; --dl12r-c0: #1d5fc9; --dl12r-fwd: #0e7490; --dl12r-bwd: #be185d; --dl12r-w: #6d3fc0;
    --dl12r-off: #64748b; --dl12r-neg: #8a8178; --dl12r-l1: #1f45a6; --dl12r-l2: #9a3c0e;
    --dl12r-floor: #ffffff; --dl12r-floor-line: transparent; --dl12r-shadow: none;
  }
  ${P} .dl12r-stage { break-inside: auto; margin-top: 4mm; display: block; }
  ${P} .dl12r-stage > * + * { margin-top: 2mm; }
  ${P} .dl12r-stage__head { break-after: avoid; }
  ${P} .dl12r-stage__title { font-size: 1.05rem; }
  ${P} .dl12r-stage__floor { background: #fff; background-image: none; box-shadow: none; border: 1px solid var(--line); padding: 3mm; break-inside: avoid; }
  ${P} .dl12r-stage__floor svg.dl12r-svg { max-width: 165mm; margin: 0 auto; }
  ${P} .dl12r-stage__cap { font-size: 0.78rem; max-width: none; }
  ${P} .dl12r-stage__try, ${P} .dl12r-story__row, ${P} .dl12r-chal, ${P} .dl12r-floorbtn, ${P} .dl12r-maths__btn { display: none !important; }
  ${P} .dl12r-story__say { font-size: 0.8rem; font-style: italic; }
  ${P} .dl12r-story__say::before { content: 'Final step shown: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl12r-switch { border-bottom: none; margin-bottom: 1mm; }
  ${P} .dl12r-switch__opt { padding: 0 1.5mm 0 0; font-size: 0.72rem; }
  ${P} .dl12r-switch__opt:not(.dl12r-switch__opt--on) { display: none; }
  ${P} .dl12r-switch__opt--on::before { content: 'Shown: '; color: var(--ink-3); }
  ${P} .dl12r-maths { border-top: 1px solid var(--line-2); padding-top: 1.5mm; }
  ${P} .dl12r-maths__printk { display: block !important; margin: 0 0 1mm; font-size: 0.72rem; font-weight: 700; color: var(--ink-2); }
  ${P} .dl12r-maths__body { padding: 0; gap: 1.2mm; max-width: none; }
  ${P} .dl12r-mline { font-size: 0.78rem; line-height: 1.5; overflow: visible; }
  ${P} .dl12r-meq .dl12r-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.76rem; color: var(--ink-2); }
  ${P} .dl12r-meq .dl12r-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl12r-mnote { font-size: 0.72rem; }
  ${P} .dl12r-own { font-size: 0.62rem; }
  ${P} .dl12r svg text { stroke: none !important; }
  ${P} .dl12r .dl12r-halo { stroke: #fff !important; }
  ${P} .dl12r-tip { display: none; }
  /* letter-spaced caps extract as "P L AY"; on paper they are set solid */
  ${P} .dl12r :is(.dl12r-beat__label, .dl12r-stage__slides, .dl12r-receipt, .dl12r-own, .dl12r-hero__kicker, .dlk-note__label, .dlk-eq__name, .dl12r-lec, .dl12r-part__k) { letter-spacing: 0 !important; }
  /* a beat's label stays with its first block */
  ${P} .dl12r-beat__label { break-after: avoid-page; }
  ${P} .dl12r-beat > .dl12r-beat__label + * { break-before: avoid-page; }

  /* nothing split that matters */
  ${P} figure, ${P} table, ${P} .dlk-eq, ${P} .dl12r-eq, ${P} .dl12r-stats, ${P} .dl12r-stat, ${P} .dlk-note, ${P} svg, ${P} .dl12r-keep { break-inside: avoid; }
  ${P} .dl12r-stagehead, ${P} h2, ${P} h3, ${P} h4 { break-after: avoid; }
}
`;
