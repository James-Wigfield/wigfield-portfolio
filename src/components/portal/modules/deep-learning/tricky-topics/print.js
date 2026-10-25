/* ============================================================================
   TRICKY TOPICS — PRINT / PDF EXPORT (one topic at a time)
   ----------------------------------------------------------------------------
   Export PDF is the browser's print pipeline (Save as PDF), so the text stays
   real and selectable for NotebookLM, nothing new is bundled, and the PDF is
   always the page as it is now. The topic shell puts html.dltt-printing on
   while it prints; every rule below is scoped to it. The block is mounted as
   a <style> inside the page (printCss(title) — the footer names the topic),
   so its @page beats the portal's full-bleed print page and leaves with the
   page. Jobs:

     paper     A4 portrait with document margins; the jade tokens forced on,
               whatever the portal theme; print-color-adjust: exact
     content   the CURRENT topic only: its opener (one sentence, the hero
               animation's end state, where it shows up, what the exam asks),
               then every step (Read in full — slide checks open — and Play as
               a finished state: story labs on their last beat, maths drawers
               open), then the drill as a short worked set with answers
     left out  the notebook (Write) pages, the page hero and topic tabs, the
               sticky bar, the rail, Resume, the opener's buttons and this
               export UI, "got it" toggles, controls that mean nothing on paper
     maths     each formula prints its plain-text twin (.dltt-texalt), so the
               PDF's text layer reads as words; KaTeX stays for the eye on
               display equations
     labels    provenance labels print as outlined text, so the PDF says
               what is the slides', the page's own, or beyond the slides
     code      VS Code's Light+ palette on paper, wrapped, no line numbers
     breaks    steps start on a new page; figures, tables, equations, code
               and stages stay whole; headings stay with what follows
   ========================================================================== */

// Everything the PDF needs, settled: fonts, and a beat for React to
// re-render the labs in their printing state and for KaTeX (rendered in
// effects) to catch up.
export async function preparePrint() {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  await new Promise((r) => setTimeout(r, 350));
}

const P = 'html.dltt-printing';
const esc = (s) => String(s).replace(/['\\]/g, '');

export const printCss = (title) => `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Tricky Topics · ${esc(title)} · Read + Play'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dltt {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }
  ${P} .hp.portal[data-portal-theme] .dl.dltt {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
    --dltt-w: #2c4bb5; --dltt-b: #7a6a00; --dltt-data: #4a5a68; --dltt-batch: #7b5137; --dltt-h: #c2510a;
    --dltt-wd: #c2185b; --dltt-c: #00838f; --dltt-t: #6a3fb5; --dltt-f: #2e7d32; --dltt-p: #a21caf;
    --dltt-win: #14202e; --dltt-jump: #c62828; --dltt-nt: #7d8794; --dltt-neg: #c62828;
    --dltt-floor: #ffffff; --dltt-floor-line: transparent; --dltt-shadow: none;
  }

  /* left out: chrome, the Write beat, controls */
  ${P} .dltt-top, ${P} .dltt-tabs, ${P} .dltt-bar, ${P} .dltt-rail, ${P} .dltt-drop, ${P} .dltt-opener__actions,
  ${P} .dltt-sec--write, ${P} .dltt-done, ${P} .dltt-noprint, ${P} .dltt-export, ${P} .dltt-nlm, ${P} .dltt-measure,
  ${P} .dltt-end, ${P} .dltt-screenonly, ${P} .dltt-replay, ${P} .dltt-drill__live { display: none !important; }
  ${P} .dltt-printonly, ${P} .dltt-opener__printlead { display: block !important; }
  ${P} .dltt-drill__print { display: block !important; }
  /* controls mean nothing on paper: the picture prints its current state */
  ${P} .dltt-ctl, ${P} .dltt-qbtn, ${P} .dltt-preset, ${P} .dltt-strip__more { display: none !important; }

  /* blocks, not grids that page badly */
  ${P} .dltt, ${P} .dltt-topic, ${P} .dltt-layout, ${P} .dltt-layout--rail, ${P} .dltt-flow { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; position: static !important; }
  ${P} .dltt-opener { padding: 0 0 3mm; border-bottom: 2px solid var(--ink); }
  ${P} .dltt-opener__title { font-size: 1.7rem; max-width: none; }
  ${P} .dltt-opener__printlead { margin: 2mm 0 0; font-size: 0.82rem; line-height: 1.5; color: var(--ink-2); }
  ${P} .dltt-sec { display: block; break-before: page; }
  ${P} .dltt-opener.dltt-sec { break-before: auto; }
  ${P} .dltt-sec__head { border-top: 2px solid var(--ink); padding-top: 2mm; break-after: avoid; }
  ${P} .dltt-beat { display: block; margin-top: 4mm; }
  ${P} .dltt-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dltt-read { max-width: none; display: block; }
  ${P} .dltt-read > * + * { margin-top: 2.2mm; }
  ${P} .dltt-p, ${P} .dltt-list li { font-size: 0.84rem; line-height: 1.55; }
  ${P} .dltt p, ${P} .dltt li { orphans: 3; widows: 3; }
  ${P} .dltt-gist { font-size: 0.95rem; }

  /* the opener's strips */
  ${P} .dltt-strip { break-inside: avoid; }
  ${P} .dltt-strip__row { padding: 1mm 0; }
  ${P} .dltt-strip__go { display: none !important; }
  ${P} .dltt-hero-anim { max-width: 150mm; }

  /* Read: unfolds open */
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-unfold__plus { display: none; }
  ${P} .dlk-unfold__head { padding-left: 0; font-weight: 700; color: var(--ink); break-after: avoid-page; }
  ${P} .dlk-unfold { break-inside: avoid-page; }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dltt-m .dlk-tex-inline { display: none !important; }
  ${P} .dltt-m .dltt-texalt { display: inline !important; font-style: italic; }
  ${P} .dltt-eq .dltt-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.78rem; color: var(--ink-2); }
  ${P} .dltt-eq .dltt-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }

  /* provenance labels: outlined text on paper */
  ${P} .dltt-prov { font-size: 0.6rem; color: #234b5e; border-color: rgba(53, 86, 105, 0.45); }

  /* code: Light+ on paper, wrapped, no line numbers */
  ${P} .dltt .dlk-code { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
  ${P} .dltt .dlk-code__bar { background: #eef2f4; border-bottom: 1px solid var(--line); }
  ${P} .dltt .dlk-code__file { color: #333; }
  ${P} .dltt .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; font-size: 0.66rem; line-height: 1.5; overflow: visible; white-space: pre-wrap; }
  ${P} .dltt .dlk-code__code { min-width: 0; }
  ${P} .dltt .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; white-space: pre-wrap; opacity: 1 !important; }
  ${P} .dltt .dlk-code__line::before { content: none; }
  ${P} .dltt .dlk-code__line--hl { background: rgba(56, 139, 253, 0.12); }
  ${P} .dltt .tok-cm { color: #3d7a2f; }
  ${P} .dltt .tok-st { color: #a31515; }
  ${P} .dltt .tok-nu { color: #098658; }
  ${P} .dltt .tok-kw { color: #af00db; }
  ${P} .dltt .tok-ct { color: #0000ff; }
  ${P} .dltt .tok-fn { color: #795e26; }

  /* Play: each lab prints its finished picture (story labs pin their last
     beat), its caption, and its maths drawer opened with the lab's values */
  ${P} .dltt-stage { break-inside: auto; margin-top: 4mm; display: block; }
  ${P} .dltt-stage > * + * { margin-top: 2mm; }
  ${P} .dltt-stage__head { break-after: avoid; }
  ${P} .dltt-stage__title { font-size: 1.05rem; }
  ${P} .dltt-stage__floor { background: #fff; background-image: none; box-shadow: none; border: 1px solid var(--line); padding: 3mm; break-inside: avoid; }
  ${P} .dltt-stage__floor svg.dltt-svg { max-width: 165mm; margin: 0 auto; }
  ${P} .dltt-stage__cap { font-size: 0.78rem; max-width: none; }
  ${P} .dltt-stage__try, ${P} .dltt-story__row, ${P} .dltt-chal, ${P} .dltt-floorbtn, ${P} .dltt-maths__btn { display: none !important; }
  ${P} .dltt-story__say { font-size: 0.8rem; font-style: italic; }
  ${P} .dltt-story__say::before { content: 'Final step shown: '; font-style: normal; color: var(--ink-3); }
  ${P} .dltt-switch { border-bottom: none; margin-bottom: 1mm; }
  ${P} .dltt-switch__opt { padding: 0 1.5mm 0 0; font-size: 0.72rem; }
  ${P} .dltt-switch__opt:not(.dltt-switch__opt--on) { display: none; }
  ${P} .dltt-switch__opt--on::before { content: 'Shown: '; color: var(--ink-3); }
  ${P} .dltt-maths { border-top: 1px solid var(--line-2); padding-top: 1.5mm; }
  ${P} .dltt-maths__printk { display: block !important; margin: 0 0 1mm; font-size: 0.72rem; font-weight: 700; color: var(--ink-2); }
  ${P} .dltt-maths__body { padding: 0; gap: 1.2mm; max-width: none; }
  ${P} .dltt-mline { font-size: 0.78rem; line-height: 1.5; overflow: visible; }
  ${P} .dltt-meq .dltt-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.76rem; color: var(--ink-2); }
  ${P} .dltt-meq .dltt-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }
  ${P} .dltt-mnote { font-size: 0.72rem; }
  ${P} .dltt svg text { stroke: none !important; }
  ${P} .dltt .dltt-halo { stroke: #fff !important; }
  ${P} .dltt-tip { display: none; }
  /* letter-spaced caps extract as "P L AY"; on paper they are set solid */
  ${P} .dltt :is(.dltt-beat__label, .dltt-prov, .dltt-receipt, .dltt-opener__kicker, .dlk-note__label, .dlk-eq__name, .dltt-card__k, .dltt-strip__k, .dltt-tbl__th, .dltt-drill__k) { letter-spacing: 0 !important; }
  /* a beat's label stays with its first block */
  ${P} .dltt-beat__label { break-after: avoid-page; }
  ${P} .dltt-beat > .dltt-beat__label + * { break-before: avoid-page; }
  /* code cards: the prompt, the lines and the model answer */
  ${P} .dltt-card { break-inside: avoid; border: 1px solid var(--line); padding: 2.5mm 3mm; margin-top: 3mm; }
  ${P} .dltt-card__reveal, ${P} .dltt-card__hint { display: none !important; }
  ${P} .dltt-card__answer { display: block !important; }
  ${P} .dltt-card__answer::before { content: 'Model answer: '; font-weight: 700; color: var(--ink); }
  /* the drill: a short worked set with answers */
  ${P} .dltt-drill__q { break-inside: avoid; border-top: 1px solid var(--line); padding: 2mm 0; }

  /* nothing split that matters */
  ${P} figure, ${P} .dltt-tbl, ${P} .dlk-eq, ${P} .dltt-eq, ${P} .dlk-note, ${P} svg, ${P} .dltt-keep { break-inside: avoid; }
  ${P} h2, ${P} h3, ${P} h4, ${P} .dltt-gist { break-after: avoid; }
}
`;
