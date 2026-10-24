
/* ============================================================================
   LECTURE 9 STUDY — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   Export PDF is the browser's print pipeline (Save as PDF), so the text stays
   real and selectable for NotebookLM, nothing new is bundled, and the PDF is
   always the page as it is now. The shell puts html.dl9s-printing on while it
   prints; every rule below is scoped to it. The block is mounted as a <style>
   inside the module, so its @page beats the portal's full-bleed print page and
   leaves with the module. Jobs:

     paper     A4 portrait with document margins; the jade tokens forced on,
               whatever the portal theme; print-color-adjust: exact
     content   the hero title, then every section (§, title, slide range),
               its Read beat in full — unfolds expanded, footnotes written
               out, slide checks kept — and its Play beat as a finished state
               (the labs read `printing`: the Q-table converged, CartPole as
               a filmstrip, story labs on their last beat), with every
               "Explain this code" card opened on its model answer
     left out  every notebook (Write) page, the portal and module chrome,
               the rail, Resume, the hero's buttons and this export UI, tick
               boxes, and controls that mean nothing on paper
     maths     each formula prints its plain-text twin (.dl9s-texalt), so the
               PDF's text layer reads as words; KaTeX stays for the eye on
               display equations
     code      VS Code's Light+ palette on paper, wrapped, no line numbers
     breaks    sections start on a new page; figures, tables, equations, code
               and stat rows stay whole; headings stay with what follows
   ========================================================================== */

// Everything the PDF needs, settled: the lazy data (the page's own policy-
// gradient and DQN runs), fonts, and a beat for React to re-render the labs
// in their printing state and for KaTeX (rendered in effects) to catch up.
export async function preparePrint() {
  try {
    await Promise.all([import('./data/pgRun.js'), import('./data/dqnRun.js')]);
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

const P = 'html.dl9s-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Lecture 9 · Reinforcement Learning · Read + Play'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dl9s {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }
  ${P} .hp.portal[data-portal-theme] .dl.dl9s {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* left out: chrome, the Write beat, controls */
  ${P} .dl9s-bar, ${P} .dl9s-rail, ${P} .dl9s-drop, ${P} .dl9s-hero__actions, ${P} .dl9s-hero__lead, ${P} .dl9s-hero__stats,
  ${P} .dl9s-beat--write, ${P} .dl9s-try, ${P} .dl-lab__controls, ${P} .dl9s-noprint, ${P} .dl9s-export, ${P} .dl9s-nlm,
  ${P} .dl9s-end, ${P} .dlk-fnote__pop, ${P} .dl9s-screenonly { display: none !important; }
  ${P} .dl9s-hero__printlead { display: block !important; }
  ${P} .dl9s-printonly { display: block !important; }
  ${P} .dl9s-screenonly-hidden { display: block !important; }

  /* blocks, not grids that page badly */
  ${P} .dl9s, ${P} .dl9s-layout, ${P} .dl9s-layout--rail, ${P} .dl9s-flow { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; position: static !important; }
  ${P} .dl9s-hero { padding: 0 0 4mm; border-bottom: 2px solid var(--ink); }
  ${P} .dl9s-hero__title { font-size: 1.7rem; max-width: none; }
  ${P} .dl9s-hero__printlead { margin: 3mm 0 0; font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); }
  ${P} .dl9s-sec { display: block; break-before: page; }
  ${P} .dl9s-hero + .dl9s-sec { break-before: auto; margin-top: 6mm; }
  ${P} .dl9s-sec__head { border-top: 2px solid var(--ink); padding-top: 2mm; break-after: avoid; }
  ${P} .dl9s-beat { display: block; margin-top: 4mm; }
  ${P} .dl9s-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dl9s-read { max-width: none; display: block; }
  ${P} .dl9s-read > * + * { margin-top: 2.2mm; }
  ${P} .dl9s-p, ${P} .dl9s-list li { font-size: 0.84rem; line-height: 1.55; }
  ${P} .dl9s p, ${P} .dl9s li { orphans: 3; widows: 3; }

  /* Read: unfolds open, footnotes written out */
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-unfold__plus { display: none; }
  ${P} .dlk-unfold__head { padding-left: 0; font-weight: 700; color: var(--ink); break-after: avoid-page; }
  ${P} .dlk-unfold { break-inside: avoid-page; }
  ${P} .dl9s-printfn { display: block !important; margin: 3mm 0 0; padding: 2mm 0 0 5mm; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--ink-2); }
  ${P} .dlk-fnote__btn { border: none; background: none; padding: 0; font-size: 0.62em; vertical-align: super; color: var(--ink); }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dl9s-m .dlk-tex-inline { display: none !important; }
  ${P} .dl9s-m .dl9s-texalt { display: inline !important; font-style: italic; }
  ${P} .dl9s-eq .dl9s-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.78rem; color: var(--ink-2); }
  ${P} .dl9s-eq .dl9s-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }

  /* code: Light+ on paper, wrapped, no line numbers */
  ${P} .dl9s .dlk-code { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
  ${P} .dl9s .dlk-code__bar { background: #eef2f4; border-bottom: 1px solid var(--line); }
  ${P} .dl9s .dlk-code__file { color: #333; }
  ${P} .dl9s .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; font-size: 0.66rem; line-height: 1.5; overflow: visible; white-space: pre-wrap; }
  ${P} .dl9s .dlk-code__code { min-width: 0; }
  ${P} .dl9s .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; white-space: pre-wrap; opacity: 1 !important; }
  ${P} .dl9s .dlk-code__line::before { content: none; }
  ${P} .dl9s .dlk-code__line--hl { background: rgba(56, 139, 253, 0.12); }
  ${P} .dl9s .tok-cm { color: #3d7a2f; }
  ${P} .dl9s .tok-st { color: #a31515; }
  ${P} .dl9s .tok-nu { color: #098658; }
  ${P} .dl9s .tok-kw { color: #af00db; }
  ${P} .dl9s .tok-ct { color: #0000ff; }
  ${P} .dl9s .tok-fn { color: #795e26; }

  /* Play: each lab prints its finished picture (story labs pin their last
     beat), its caption, and its maths drawer opened with the lab's values */
  ${P} .hp.portal[data-portal-theme] .dl.dl9s {
    --dl9s-agent: #6d3fc0; --dl9s-env: #52606d; --dl9s-obs: #0e7490; --dl9s-act: #c2410c; --dl9s-rpos: #15803d;
    --dl9s-rneg: #c42b2b; --dl9s-ret: #9a6700; --dl9s-pol: #be185d; --dl9s-val: #1d5fc9; --dl9s-mask: #64748b; --dl9s-neg: #c42b2b;
    --dl9s-floor: #ffffff; --dl9s-floor-line: transparent; --dl9s-shadow: none;
  }
  ${P} .dl9s-stage { break-inside: auto; margin-top: 4mm; display: block; }
  ${P} .dl9s-stage > * + * { margin-top: 2mm; }
  ${P} .dl9s-stage__head { break-after: avoid; }
  ${P} .dl9s-stage__title { font-size: 1.05rem; }
  ${P} .dl9s-stage__floor { background: #fff; background-image: none; box-shadow: none; border: 1px solid var(--line); padding: 3mm; break-inside: avoid; }
  ${P} .dl9s-stage__floor svg.dl9s-svg { max-width: 165mm; margin: 0 auto; }
  ${P} .dl9s-stage__cap { font-size: 0.78rem; max-width: none; }
  ${P} .dl9s-stage__try, ${P} .dl9s-story__row, ${P} .dl9s-chal, ${P} .dl9s-floorbtn, ${P} .dl9s-maths__btn { display: none !important; }
  ${P} .dl9s-story__say { font-size: 0.8rem; font-style: italic; }
  ${P} .dl9s-story__say::before { content: 'Final step shown: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl9s-switch { border-bottom: none; margin-bottom: 1mm; }
  ${P} .dl9s-switch__opt { padding: 0 1.5mm 0 0; font-size: 0.72rem; }
  ${P} .dl9s-switch__opt:not(.dl9s-switch__opt--on) { display: none; }
  ${P} .dl9s-switch__opt--on::before { content: 'Shown: '; color: var(--ink-3); }
  ${P} .dl9s-maths { border-top: 1px solid var(--line-2); padding-top: 1.5mm; }
  ${P} .dl9s-maths__printk { display: block !important; margin: 0 0 1mm; font-size: 0.72rem; font-weight: 700; color: var(--ink-2); }
  ${P} .dl9s-maths__body { padding: 0; gap: 1.2mm; max-width: none; }
  ${P} .dl9s-mline { font-size: 0.78rem; line-height: 1.5; overflow: visible; }
  ${P} .dl9s-meq .dl9s-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.76rem; color: var(--ink-2); }
  ${P} .dl9s-meq .dl9s-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }
  ${P} .dl9s-mnote { font-size: 0.72rem; }
  ${P} .dl9s-own { font-size: 0.62rem; }
  ${P} .dl9s svg text { stroke: none !important; }
  ${P} .dl9s .dl9s-halo { stroke: #fff !important; }
  ${P} .dl9s-tip { display: none; }
  ${P} .dl9s-route__stop { padding: 1mm 0; }
  ${P} .dl9s-route__count { display: none; }
  /* letter-spaced caps extract as "P L AY"; on paper they are set solid */
  ${P} .dl9s :is(.dl9s-beat__label, .dl9s-stage__slides, .dl9s-receipt, .dl9s-own, .dl9s-hero__kicker, .dlk-note__label, .dlk-eq__name, .dl9s-card__k) { letter-spacing: 0 !important; }
  /* a beat's label stays with its first block */
  ${P} .dl9s-beat__label { break-after: avoid-page; }
  ${P} .dl9s-beat > .dl9s-beat__label + * { break-before: avoid-page; }
  /* code cards: the prompt, the verbatim lines and the model answer */
  ${P} .dl9s-card { break-inside: avoid; border: 1px solid var(--line); padding: 2.5mm 3mm; margin-top: 3mm; }
  ${P} .dl9s-card__reveal, ${P} .dl9s-card__hint { display: none !important; }
  ${P} .dl9s-card__answer { display: block !important; }
  ${P} .dl9s-card__answer::before { content: 'Model answer: '; font-weight: 700; color: var(--ink); }
  ${P} .dl9s-qt__play, ${P} .dl9s-cp__pads, ${P} .dl9s-switch { display: none !important; }

  /* nothing split that matters */
  ${P} figure, ${P} table, ${P} .dlk-eq, ${P} .dl9s-eq, ${P} .dl9s-stats, ${P} .dl9s-stat, ${P} .dlk-note, ${P} svg, ${P} .dl9s-keep { break-inside: avoid; }
  ${P} .dl9s-stagehead, ${P} h2, ${P} h3, ${P} h4 { break-after: avoid; }
}
`;
