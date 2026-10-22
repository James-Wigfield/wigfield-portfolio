import { loadAll } from './fashion';

/* ============================================================================
   LECTURES 6–7 STUDY — PRINT / PDF EXPORT
   ----------------------------------------------------------------------------
   Export PDF is the browser's print pipeline (Save as PDF), so the text stays
   real and selectable for NotebookLM, nothing new is bundled, and the PDF is
   always the page as it is now. The shell puts html.dl67s-printing on while it
   prints; every rule below is scoped to it. The block is mounted as a <style>
   inside the module, so its @page beats the portal's full-bleed print page and
   leaves with the module. Jobs:

     paper     A4 portrait with document margins; the jade tokens forced on,
               whatever the portal theme; print-color-adjust: exact
     content   the hero title, then every section (§, title, slide range),
               its Read beat in full — unfolds expanded, footnotes written
               out, slide checks kept — and its Play beat as a finished state
               (the labs read `printing`: trained, not epoch 0)
     left out  every notebook (Write) page, the portal and module chrome,
               the rail, Resume, the hero's buttons and this export UI, tick
               boxes, and controls that mean nothing on paper
     maths     each formula prints its plain-text twin (.dl67s-texalt), so the
               PDF's text layer reads as words; KaTeX stays for the eye on
               display equations
     code      VS Code's Light+ palette on paper, wrapped, no line numbers
     breaks    sections start on a new page; figures, tables, equations, code
               and stat rows stay whole; headings stay with what follows
   ========================================================================== */

// Everything the PDF needs, settled: the lazy Fashion MNIST data, fonts, and
// a beat for React to re-render the labs in their printing state (the toy
// GANs train to the end) and for KaTeX (rendered in effects) to catch up.
export async function preparePrint() {
  try {
    await loadAll();
  } catch {
    /* the labs print their "couldn't load" state instead */
  }
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are a nicety */
  }
  await new Promise((r) => setTimeout(r, 900));
}

const P = 'html.dl67s-printing';

export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 14mm 13mm 16mm;
    @bottom-right { content: counter(page); font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
    @bottom-left { content: 'CITS5017 Lectures 6–7 · AEs and GANs · Read + Play'; font: 7.5pt ui-monospace, monospace; color: #4f6f80; }
  }

  ${P}, ${P} body, ${P} .hp.portal, ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { background: #fff !important; }
  ${P} .portal__body, ${P} .portal__main, ${P} .portal__content { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; animation: none !important; transform: none !important; }
  ${P} .portal__banner, ${P} .portal__sidebar, ${P} .portal__topbar { display: none !important; }

  /* one paper palette, whatever the theme */
  ${P} .dl.dl67s {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    max-width: none; color: #234b5e;
    --ground: #ffffff; --ground-2: #eef4f6; --surface: #ffffff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80; --text-faint: #6f8fa0;
    --line: rgba(53, 86, 105, 0.30); --line-2: rgba(53, 86, 105, 0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21, 162, 146, 0.12);
  }
  ${P} .hp.portal[data-portal-theme] .dl.dl67s {
    --dlv-blue: #2a78d6; --dlv-orange: #eb6834; --dlv-aqua: #1baf7a; --dlv-yellow: #eda100;
    --dlv-magenta: #e87ba4; --dlv-green: #008300; --dlv-violet: #4a3aa7; --dlv-red: #e34948;
  }

  /* left out: chrome, the Write beat, controls */
  ${P} .dl67s-bar, ${P} .dl67s-rail, ${P} .dl67s-drop, ${P} .dl67s-hero__actions, ${P} .dl67s-hero__lead, ${P} .dl67s-hero__stats,
  ${P} .dl67s-beat--write, ${P} .dl67s-try, ${P} .dl-lab__controls, ${P} .dl67s-noprint, ${P} .dl67s-export, ${P} .dl67s-nlm,
  ${P} .dl67s-end, ${P} .dlk-fnote__pop, ${P} .dl67s-screenonly { display: none !important; }
  ${P} .dl67s-hero__printlead { display: block !important; }
  ${P} .dl67s-printonly { display: block !important; }
  ${P} .dl67s-screenonly-hidden { display: block !important; }

  /* blocks, not grids that page badly */
  ${P} .dl67s, ${P} .dl67s-layout, ${P} .dl67s-layout--rail, ${P} .dl67s-flow { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; position: static !important; }
  ${P} .dl67s-hero { padding: 0 0 4mm; border-bottom: 2px solid var(--ink); }
  ${P} .dl67s-hero__title { font-size: 1.7rem; max-width: none; }
  ${P} .dl67s-hero__printlead { margin: 3mm 0 0; font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); }
  ${P} .dl67s-sec { display: block; break-before: page; }
  ${P} .dl67s-hero + .dl67s-sec { break-before: auto; margin-top: 6mm; }
  ${P} .dl67s-sec__head { border-top: 2px solid var(--ink); padding-top: 2mm; break-after: avoid; }
  ${P} .dl67s-beat { display: block; margin-top: 4mm; }
  ${P} .dl67s-beat__label { break-after: avoid; margin-bottom: 2mm; }
  ${P} .dl67s-read { max-width: none; display: block; }
  ${P} .dl67s-read > * + * { margin-top: 2.2mm; }
  ${P} .dl67s-p, ${P} .dl67s-list li { font-size: 0.84rem; line-height: 1.55; }
  ${P} .dl67s p, ${P} .dl67s li { orphans: 3; widows: 3; }

  /* Read: unfolds open, footnotes written out */
  ${P} .dlk-unfold__body { grid-template-rows: 1fr !important; }
  ${P} .dlk-unfold__inner { overflow: visible !important; }
  ${P} .dlk-unfold__plus { display: none; }
  ${P} .dlk-unfold__head { padding-left: 0; font-weight: 700; color: var(--ink); break-after: avoid-page; }
  ${P} .dlk-unfold { break-inside: avoid-page; }
  ${P} .dl67s-printfn { display: block !important; margin: 3mm 0 0; padding: 2mm 0 0 5mm; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--ink-2); }
  ${P} .dlk-fnote__btn { border: none; background: none; padding: 0; font-size: 0.62em; vertical-align: super; color: var(--ink); }

  /* maths: the plain-text twin carries the meaning on paper */
  ${P} .dl67s-m .dlk-tex-inline { display: none !important; }
  ${P} .dl67s-m .dl67s-texalt { display: inline !important; font-style: italic; }
  ${P} .dl67s-eq .dl67s-texalt--block { display: block !important; margin: 0.5mm 0 0; font-size: 0.78rem; color: var(--ink-2); }
  ${P} .dl67s-eq .dl67s-texalt--block::before { content: 'As text: '; font-style: normal; color: var(--ink-3); }

  /* code: Light+ on paper, wrapped, no line numbers */
  ${P} .dl67s .dlk-code { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
  ${P} .dl67s .dlk-code__bar { background: #eef2f4; border-bottom: 1px solid var(--line); }
  ${P} .dl67s .dlk-code__file { color: #333; }
  ${P} .dl67s .dlk-code__pre { background: #f7f9fa; color: #1f1f1f; font-size: 0.66rem; line-height: 1.5; overflow: visible; white-space: pre-wrap; padding: 2mm 3mm; }
  ${P} .dl67s .dlk-code__code { min-width: 0; }
  ${P} .dl67s .dlk-code__line { padding-left: 2.2em; text-indent: -2.2em; white-space: pre-wrap; opacity: 1 !important; }
  ${P} .dl67s .dlk-code__line::before { content: none; }
  ${P} .dl67s .dlk-code__line--hl { background: rgba(56, 139, 253, 0.12); }
  ${P} .dl67s .tok-cm { color: #3d7a2f; }
  ${P} .dl67s .tok-st { color: #a31515; }
  ${P} .dl67s .tok-nu { color: #098658; }
  ${P} .dl67s .tok-kw { color: #af00db; }
  ${P} .dl67s .tok-ct { color: #0000ff; }
  ${P} .dl67s .tok-fn { color: #795e26; }

  /* Play: the lab as a finished picture with its readouts */
  ${P} .dl67s-lab { break-inside: auto; border: 1px solid var(--line); padding: 3mm 3.5mm; margin-top: 3mm; display: block; }
  ${P} .dl67s-lab > * + * { margin-top: 2.5mm; }
  ${P} .dl67s-lab__bar { break-after: avoid; }
  ${P} .dl67s-wide, ${P} .dl67s-scroll { overflow: visible !important; }
  ${P} .dl67s-wide > svg { min-width: 0 !important; }
  /* drawings at a reading size, not stretched to the full column */
  ${P} .dl67s-lab svg.dl67s-svg { max-width: 125mm; }
  ${P} .dl67s-lab .dl67s-figwrap .dl67s-fig { max-width: 105mm; }
  ${P} .dl67s-cf__strip { min-width: 0 !important; max-width: 170mm; }
  ${P} .dl67s-tc__grid { width: 52mm !important; max-width: 52mm !important; }
  ${P} .dl67s-tc__grid--k { width: 20mm !important; max-width: 20mm !important; }
  ${P} .dl67s-tc, ${P} .dl67s-tl__wrap { break-inside: avoid; }
  ${P} .dl67s-rgrid { min-width: 0; max-width: 150mm; }
  ${P} .dl67s-ip .dl67s-igrid, ${P} .dl67s-ip__t { min-width: 0; }
  ${P} .dl67s-lab .dl67s-table { font-size: 0.68rem; }
  ${P} .dl67s-lab .dl67s-table :is(th, td) { padding: 0.7mm 1.4mm; }
  ${P} .dl67s-lab .dl67s-table code { font-size: 0.64rem; }
  /* what only makes sense on screen */
  ${P} .dl67s-road__prog, ${P} .dl67s-outcome__tick, ${P} .dl67s-outcome__prog, ${P} .dl67s-outcome__nb, ${P} .dl67s-pick,
  ${P} .dl67s-fwait, ${P} .dl67s-stepper, ${P} .dl67s-gen__sliders, ${P} .dl67s-tl__wrap .dl-lab__controls { display: none !important; }
  ${P} .dl67s-stats--col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  ${P} .dl67s-road__item { grid-template-columns: 1.6rem minmax(0, 1fr); padding: 1.2mm 0; }
  ${P} .dl67s-outcome { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'text' 'links'; padding: 1.2mm 0; }
  ${P} .dl67s svg text { stroke: none !important; }
  ${P} .dl67s-cap { font-size: 0.72rem; max-width: none; }
  ${P} .dl67s-readout { font-size: 0.78rem; max-width: none; }
  ${P} .dl67s-vec i { min-width: 2.1rem; font-size: 0.56rem; }

  /* lab layouts print as blocks: the drawing, then its readouts at full width */
  ${P} .dl67s-cf, ${P} .dl67s-cf__low, ${P} .dl67s-tc, ${P} .dl67s-vl__row, ${P} .dl67s-ll, ${P} .dl67s-vc, ${P} .dl67s-gr, ${P} .dl67s-gr__imgs,
  ${P} .dl67s-ps, ${P} .dl67s-gc, ${P} .dl67s-toy__grid, ${P} .dl67s-sm, ${P} .dl67s-dc, ${P} .dl67s-gen__one { display: block; }
  ${P} .dl67s-cf > * + *, ${P} .dl67s-cf__low > * + *, ${P} .dl67s-tc > * + *, ${P} .dl67s-vl__row > * + *, ${P} .dl67s-ll > * + *, ${P} .dl67s-vc > * + *,
  ${P} .dl67s-gr > * + *, ${P} .dl67s-gr__imgs > * + *, ${P} .dl67s-ps > * + *, ${P} .dl67s-gc > * + *, ${P} .dl67s-toy__grid > * + *, ${P} .dl67s-sm > * + *,
  ${P} .dl67s-dc > * + * { margin-top: 3mm; }
  ${P} .dl67s-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  ${P} .dl67s-rgrid, ${P} .dl67s-igrid, ${P} .dl67s-toy__fig, ${P} .dl67s-tl, ${P} .dl67s-vl { break-inside: avoid; }
  /* letter-spaced caps extract as "P L AY"; on paper they are set solid */
  ${P} .dl67s :is(.dl67s-beat__label, .dl67s-lab__name, .dl67s-lab__slides, .dl67s-stagehead, .dl67s-receipt, .dl67s-own, .dl67s-stat__k, .dl67s-hero__kicker, .dl67s-figcap__k, .dlk-note__label, .dlk-eq__name, .dl67s-rgrid__k, .dl67s-batch__k, .dl67s-cs__k) { letter-spacing: 0 !important; }
  /* a beat's label stays with its first block */
  ${P} .dl67s-beat__label { break-after: avoid-page; }
  ${P} .dl67s-beat > .dl67s-beat__label + * { break-before: avoid-page; }
  ${P} .dl67s-lab__bar, ${P} .dl67s-lab__bar + * { break-after: avoid-page; }
  /* §12's outcomes, tight */
  ${P} .dl67s-outcome { padding: 0.8mm 0; }
  ${P} .dl67s-outcome__text { font-size: 0.8rem; }
  ${P} .dl67s-outcomes + .dl67s-cap, ${P} .dl67s-cap + .dl67s-cap { margin-top: 1mm; }

  /* nothing split that matters */
  ${P} figure, ${P} table, ${P} .dlk-eq, ${P} .dl67s-eq, ${P} .dl67s-stats, ${P} .dl67s-stat, ${P} .dlk-note, ${P} svg, ${P} .dl67s-keep { break-inside: avoid; }
  ${P} .dl67s-stagehead, ${P} h2, ${P} h3, ${P} h4 { break-after: avoid; }
  ${P} .dl67s-figcap { break-before: avoid; }
  ${P} .dl67s-road__item { break-inside: avoid; }
}
`;
