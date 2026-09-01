import Icon from '../icons';

/* ============================================================================
   RUN 5 HANDOFF — everything from the 2026-09-01 session, on one page
   ----------------------------------------------------------------------------
   Written to be SKIMMED. Four questions, in this order:
     1. what do I say to my supervisor tonight   -> .r5-talk
     2. how did the numbers change               -> the delta table
     3. why (three experiments, one visual each) -> .r5-exp
     4. what do I do at the HPC tomorrow         -> .r5-todo

   All numbers are measured on run 4's checkpoint (epoch 700, val-Dice 0.587)
   over the full 57-scan validation split at the protocol operating point
   (threshold 0.5, 10-voxel minimum, IoU 0.1). Sources:
     evaluation/results/run4/expansion/README.md
     evaluation/results/run4/merging/README.md
     documentation/design-decisions.md  (2026-09-01 entries)

   Diagram colour code, same as the training-runs kit:
     orange = real tumour / PET uptake · blue = the model's prediction
     ink dashes = a boundary the model must respect
   Animations are CSS-only, pause under prefers-reduced-motion, and freeze at
   their end state for print. Export PDF is window.print() + the PRINT block.
   ========================================================================== */

const CSS = `
.r5 { display: flex; flex-direction: column; gap: 1rem; }
.r5 :is(h4, h5) { margin: 0; }

/* ---------- header ---------- */
.r5-head { padding: 1.1rem 1.25rem; }
.r5-printhead { display: none; }
.r5-head__row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.r5-tag { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.6rem;
  font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: var(--accent); padding: 0.2rem 0.45rem; border-radius: 4px; }
.r5-export { margin-left: auto; display: inline-flex; align-items: center; gap: 0.35rem;
  font: inherit; font-size: 0.72rem; font-weight: 600; color: var(--ink-2);
  background: var(--surface-hi); border: 1px solid var(--line); border-radius: 6px;
  padding: 0.3rem 0.6rem; cursor: pointer; }
.r5-export:hover { color: var(--accent-ink); border-color: var(--accent); }
.r5-title { font-size: 1.15rem; letter-spacing: -0.01em; margin: 0.55rem 0 0.3rem; }
.r5-sub { margin: 0; font-size: 0.86rem; color: var(--ink-3); max-width: 78ch; line-height: 1.55; }
.r5-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.7rem; }
.r5-chip { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.6rem;
  color: var(--ink-3); background: var(--ground-2); border: 1px solid var(--line-2);
  border-radius: 4px; padding: 0.2rem 0.4rem; }
.r5-chip b { color: var(--ink); font-weight: 700; }

/* ---------- section shell ---------- */
.r5-sec { padding: 1.1rem 1.25rem; }
.r5-lab { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.6rem;
  font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent-ink); margin: 0 0 0.15rem; }
.r5-sec > h4 { font-size: 1rem; letter-spacing: -0.01em; margin-bottom: 0.5rem; }
.r5-p { margin: 0.45rem 0 0; font-size: 0.85rem; line-height: 1.6; color: var(--ink-2); max-width: 84ch; }
.r5-p code, .r5-code { font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.78em; background: var(--ground-2); border-radius: 3px; padding: 0.05rem 0.25rem; }

/* ---------- talk track (3 cards) ---------- */
.r5-talk { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
.r5-talk__c { background: var(--surface-hi); border: 1px solid var(--line-2);
  border-left: 3px solid var(--accent); border-radius: 8px; padding: 0.75rem 0.85rem; }
.r5-talk__n { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.62rem;
  font-weight: 700; color: var(--accent-ink); }
.r5-talk__t { display: block; font-size: 0.86rem; font-weight: 700; color: var(--ink);
  margin: 0.25rem 0 0.3rem; line-height: 1.35; }
.r5-talk__w { display: block; font-size: 0.78rem; line-height: 1.5; color: var(--ink-3); }

/* ---------- ask-supervisor list ---------- */
.r5-ask { margin: 0.6rem 0 0; padding: 0; list-style: none; counter-reset: q; }
.r5-ask li { position: relative; padding-left: 1.6rem; margin-bottom: 0.5rem;
  font-size: 0.83rem; line-height: 1.5; color: var(--ink-2); }
.r5-ask li::before { counter-increment: q; content: 'Q' counter(q);
  position: absolute; left: 0; top: 0.05rem; font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.6rem; font-weight: 700; color: #fff; background: var(--ink-3);
  border-radius: 3px; padding: 0.1rem 0.2rem; }
.r5-ask li b { color: var(--ink); }
.r5-ask li.is-key::before { background: var(--accent); }

/* ---------- delta table ---------- */
.r5-tw { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; margin-top: 0.6rem; }
.r5-t { border-collapse: collapse; width: 100%; min-width: 560px; font-size: 0.8rem; }
.r5-t th { text-align: left; font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3);
  background: var(--ground-2); padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--line); }
.r5-t td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
.r5-t tr:last-child td { border-bottom: none; }
.r5-t td:first-child { color: var(--ink); font-weight: 600; }
.r5-t .up { color: var(--trx-good, #0d7267); font-weight: 700; }
.r5-t .dn { color: var(--trx-bad, #b5433d); font-weight: 700; }
.r5-t .fl { color: var(--ink-3); }
.r5-v { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.94em; }

/* ---------- experiment cards ---------- */
.r5-exp { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin-top: 0.2rem; }
.r5-card { background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 8px;
  padding: 0.8rem 0.85rem; display: flex; flex-direction: column; gap: 0.45rem; }
.r5-card__v { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.58rem;
  font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.r5-card--bad  .r5-card__v { color: var(--trx-bad, #b5433d); }
.r5-card--fix  .r5-card__v { color: var(--trx-good, #0d7267); }
.r5-card--open .r5-card__v { color: var(--trx-warn, #a07400); }
.r5-card__t { font-size: 0.88rem; font-weight: 700; color: var(--ink); line-height: 1.35; }
.r5-card__w { font-size: 0.78rem; line-height: 1.55; color: var(--ink-3); margin: 0; }
.r5-card__w b { color: var(--ink-2); }
.r5-card svg { display: block; width: 100%; height: auto; background: var(--surface);
  border: 1px solid var(--line-2); border-radius: 6px; }

/* diagram primitives */
.r5 .hot   { fill: var(--trx-s2, #d4551f); opacity: 0.75; }
.r5 .pred  { fill: none; stroke: var(--trx-s1, #2a78d6); stroke-width: 2.2; }
.r5 .bound { fill: none; stroke: var(--ink-3); stroke-width: 1.2; stroke-dasharray: 4 3; }
.r5 .tx    { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 6px; fill: var(--ink-3); }
.r5 .tx--v { font-size: 6.5px; }
.r5 .tx--b { fill: var(--trx-s1, #2a78d6); }
.r5 .tx--r { fill: var(--trx-bad, #b5433d); font-weight: 700; }
.r5 .tx--g { fill: var(--trx-good, #0d7267); font-weight: 700; }

/* animation 1 — the prediction grows to fill the hotspot, then overshoots */
@keyframes r5grow {
  0%, 12%   { transform: scale(0.42); }
  38%, 55%  { transform: scale(1.0); }
  80%, 100% { transform: scale(1.34); }
}
.r5-grow { animation: r5grow 5s ease-in-out infinite; transform-origin: 60px 40px; }
@keyframes r5flash { 0%,45% { opacity: 0; } 60%,100% { opacity: 1; } }
.r5-flash { animation: r5flash 5s ease-in-out infinite; }

/* animation 2 — the old rule stamps CORRECT, the new rule stamps WRONG */
@keyframes r5old { 0%,40% { opacity: 1; } 55%,100% { opacity: 0; } }
@keyframes r5new { 0%,40% { opacity: 0; } 55%,100% { opacity: 1; } }
.r5-old { animation: r5old 4.5s ease-in-out infinite; }
.r5-new { animation: r5new 4.5s ease-in-out infinite; }

/* animation 3 — one blob, then a cut line, then the halves part */
@keyframes r5cut  { 0%,30% { opacity: 0; } 45%,100% { opacity: 1; } }
@keyframes r5partL { 0%,45% { transform: translateX(0); } 65%,100% { transform: translateX(-5px); } }
@keyframes r5partR { 0%,45% { transform: translateX(0); } 65%,100% { transform: translateX(5px); } }
.r5-cut   { animation: r5cut 4.5s ease-in-out infinite; }
.r5-partL { animation: r5partL 4.5s ease-in-out infinite; }
.r5-partR { animation: r5partR 4.5s ease-in-out infinite; }

/* ---------- sensitivity bars ---------- */
.r5-bars { margin-top: 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; }
.r5-bar { display: grid; grid-template-columns: 11rem 1fr 3.2rem; align-items: center;
  gap: 0.6rem; font-size: 0.78rem; }
.r5-bar__k { color: var(--ink-2); }
.r5-bar__t { height: 12px; background: var(--ground-2); border-radius: 3px;
  border: 1px solid var(--line-2); overflow: hidden; }
.r5-bar__f { display: block; height: 100%; border-radius: 2px; background: var(--ink-3);
  width: var(--w); animation: r5fill 1.1s cubic-bezier(.2,.8,.2,1) both; }
.r5-bar__v { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.74rem;
  color: var(--ink); text-align: right; font-weight: 700; }
.r5-bar.is-now  .r5-bar__f { background: var(--trx-s1, #2a78d6); }
.r5-bar.is-ref  .r5-bar__f { background: var(--ink-3); }
.r5-bar.is-cap  .r5-bar__f { background: repeating-linear-gradient(90deg,
    var(--accent) 0 6px, transparent 6px 11px); }
@keyframes r5fill { from { width: 0; } to { width: var(--w); } }

/* ---------- todo / checklist ---------- */
.r5-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.r5-list { margin: 0.5rem 0 0; padding: 0; list-style: none; }
.r5-list li { position: relative; padding-left: 1.5rem; margin-bottom: 0.55rem;
  font-size: 0.83rem; line-height: 1.5; color: var(--ink-2); }
.r5-list li::before { position: absolute; left: 0; top: 0.12rem; width: 0.95rem; height: 0.95rem;
  border-radius: 3px; font-size: 0.6rem; font-weight: 700; display: grid; place-items: center; }
.r5-list li.done::before  { content: '✓'; background: var(--trx-good, #0d7267); color: #fff; }
.r5-list li.todo::before  { content: ''; border: 1.5px solid var(--line); background: var(--surface); }
.r5-list li.block::before { content: '!'; background: var(--trx-warn, #a07400); color: #fff; }
.r5-list li b { color: var(--ink); }
.r5-list li span { display: block; color: var(--ink-3); font-size: 0.78rem; margin-top: 0.1rem; }
.r5-cmd { margin: 0.35rem 0 0; padding: 0.4rem 0.55rem; background: var(--ground-2);
  border: 1px solid var(--line-2); border-radius: 5px; font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.68rem; line-height: 1.5; color: var(--ink-2); white-space: pre-wrap;
  overflow-wrap: anywhere; }

/* ---------- callout ---------- */
.r5-note { margin-top: 0.7rem; padding: 0.7rem 0.85rem; border-radius: 8px;
  background: var(--accent-soft); border-left: 3px solid var(--accent);
  font-size: 0.82rem; line-height: 1.55; color: var(--ink-2); }
.r5-note b { color: var(--ink); }

@media (max-width: 900px) {
  .r5-talk, .r5-exp, .r5-cols { grid-template-columns: 1fr; }
  .r5-bar { grid-template-columns: 8rem 1fr 3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .r5 * { animation: none !important; }
  .r5-old { opacity: 0; } .r5-new, .r5-cut, .r5-flash { opacity: 1; }
  .r5-bar__f { width: var(--w); }
}

/* ============================ PRINT / PDF ============================
   Export PDF is window.print(); this block IS the export format. Freeze every
   animation at its END state (the state that carries the point), force the
   light palette so a dark-theme reader still gets a paper document, and let
   nothing split across a page break. */
@media print {
  @page { size: A4 portrait; margin: 13mm 11mm 15mm; }
  html, body, .portal__body, .portal__main, .portal__content { background: #fff !important; }
  .r5-export, .trn-back { display: none !important; }
  .r5-printhead { display: block !important; font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--ink-3); margin: 0 0 0.5rem; }
  .r5 { -webkit-print-color-adjust: exact; print-color-adjust: exact; display: block;
    --ground: #fff; --ground-2: #eef4f6; --surface: #fff; --surface-hi: #f6fafb;
    --ink: #051b28; --ink-2: #234b5e; --ink-3: #4f6f80;
    --line: rgba(53,86,105,0.30); --line-2: rgba(53,86,105,0.18);
    --accent: #15a292; --accent-ink: #0d7267; --accent-soft: rgba(21,162,146,0.12); }
  .r5 > * + * { margin-top: 0.9rem; }
  .r5 .pt-card { box-shadow: none; }
  /* freeze animations on their final frame */
  .r5 * { animation: none !important; }
  .r5-grow { transform: scale(1.34); }
  .r5-old { opacity: 0; }
  .r5-new, .r5-cut, .r5-flash { opacity: 1; }
  .r5-partL { transform: translateX(-5px); }
  .r5-partR { transform: translateX(5px); }
  .r5-bar__f { width: var(--w); }
  .r5-tw { overflow: visible; }
  .r5-t { font-size: 0.72rem; min-width: 0; }
  .r5-sec, .r5-card, .r5-talk__c, .r5-note, .r5-tw, .r5-list li { break-inside: avoid; }
  .r5-sec > h4, .r5-lab { break-after: avoid; }
}
`;

/* ---- the three sentences for tonight ------------------------------------- */
const TALK = [
  {
    t: 'The expansion algorithm doesn’t help us',
    w: 'Ported it, proved it matches the reference voxel-for-voxel, ran it on all 57 val scans. It finds no extra lesions and costs a point of outline accuracy. Our model isn’t under-segmenting, so growing the outlines only spills over the edges.',
  },
  {
    t: 'We were understating our own recall by a lot',
    w: 'Of run 4’s 498 “missed” lesions, 202 (41%) had actually been segmented — they were absorbed into a blob the scorer credited to a neighbouring lesion. Real sensitivity ceiling is 83%, not 72%.',
  },
  {
    t: 'And one metric was rewarding false alarms',
    w: 'Patient accuracy counted a scan “correct” if the model output anything at all, even with zero overlap. Fixed. Run 4 now scores ahead of run 3 instead of behind it — the flagged regression was the metric, not the model.',
  },
];

/* ---- what to ask, in priority order ------------------------------------- */
const ASK = [
  { key: true, t: <><b>Does lesion count matter clinically, or is it total disease burden?</b> If clinicians care about total tumour volume rather than how many separate lesions there are, merged lesions don’t matter and I should stop chasing this.</> },
  { t: <><b>Is +3 points of sensitivity worth −3 points of precision?</b> That decides whether I report plain F1 (which says my splitter does nothing) or a recall-weighted metric (which says it helps).</> },
  { t: <><b>Should my headline metric be your any-overlap rule or my stricter IoU rule?</b> Mine scores 2.2 points lower on identical predictions, so it changes every number in the dissertation.</> },
];

/* ---- the delta table ----------------------------------------------------- */
const DELTA = [
  ['Lesion F1', '73.7%', '73.7%', 'fl', 'unchanged — nothing this session moved it'],
  ['Lesion sensitivity', '72.0%', '75.2%', 'up', 'if the splitter is adopted; costs 2.9 precision'],
  ['Sensitivity ceiling', '—', '83.4%', 'up', 'newly measured: what perfect de-merging would give'],
  ['Voxel DSC', '0.525', '0.525', 'fl', 'expansion made it worse (0.515); rejected'],
  ['Patient accuracy', '82.5%', '78.9%', 'dn', 'lower but now HONEST — old rule rewarded false alarms'],
  ['…vs run 3 on that metric', '−3.5', '+1.7', 'up', 'the flagged “regression” inverts once fixed'],
];

/* ---- the three experiments ---------------------------------------------- */
const EXPERIMENTS = [
  {
    cls: 'r5-card--bad', v: 'tested · rejected',
    t: 'Growing the outlines (expansion)',
    w: <>The reference grows each predicted lesion outward into the bright PET around it. <b>It assumes the model paints too small — ours doesn’t.</b> No extra lesions found at any setting; outline accuracy fell 0.525 → 0.515.</>,
    svg: (
      <svg viewBox="0 0 120 80" role="img" aria-label="A prediction outline grows to fill a hot region, then overshoots past it.">
        <ellipse className="hot" cx="60" cy="40" rx="26" ry="18" />
        <g className="r5-grow"><ellipse className="pred" cx="60" cy="40" rx="26" ry="18" /></g>
        <text className="tx tx--v tx--r r5-flash" x="60" y="72" textAnchor="middle">over the edges</text>
      </svg>
    ),
  },
  {
    cls: 'r5-card--fix', v: 'found · fixed',
    t: 'A metric that rewarded false alarms',
    w: <>Patient accuracy scored a scan correct whenever the model output <em>any</em> blob — even one overlapping nothing. <b>Now requires a real hit.</b> Run 3 86.0 → 77.2%, run 4 82.5 → 78.9%.</>,
    svg: (
      <svg viewBox="0 0 120 80" role="img" aria-label="A real tumour on the left, the prediction on the right overlapping nothing. The old rule stamps correct, the new rule stamps wrong.">
        <ellipse className="hot" cx="32" cy="34" rx="13" ry="10" />
        <text className="tx" x="32" y="56" textAnchor="middle">real tumour</text>
        <ellipse className="pred" cx="88" cy="34" rx="13" ry="10" />
        <text className="tx tx--b" x="88" y="56" textAnchor="middle">prediction</text>
        <text className="tx tx--v tx--g r5-old" x="60" y="74" textAnchor="middle">OLD: scored correct ✓</text>
        <text className="tx tx--v tx--r r5-new" x="60" y="74" textAnchor="middle">NEW: scored wrong ✗</text>
      </svg>
    ),
  },
  {
    cls: 'r5-card--open', v: 'measured · open',
    t: 'Two lesions counted as one (merging)',
    w: <>One blob can span two real tumours; the scorer credits it to one and books the other as missed. <b>202 of 498 misses are this.</b> Splitting them recovers 56, but costs 89 false positives.</>,
    svg: (
      <svg viewBox="0 0 120 80" role="img" aria-label="One prediction blob containing two separate tumours; a cut line appears and the halves separate.">
        <g className="r5-partL"><ellipse className="hot" cx="45" cy="36" rx="12" ry="10" /></g>
        <g className="r5-partR"><ellipse className="hot" cx="75" cy="36" rx="12" ry="10" /></g>
        <path className="pred" d="M22 36 C22 20 40 16 60 16 C80 16 98 20 98 36 C98 52 80 56 60 56 C40 56 22 52 22 36 Z" />
        <line className="r5-cut" x1="60" y1="14" x2="60" y2="58" stroke="var(--trx-bad, #b5433d)" strokeWidth="1.6" strokeDasharray="3 2" />
        <text className="tx" x="60" y="72" textAnchor="middle">1 blob · 2 real tumours</text>
      </svg>
    ),
  },
];

/* ---- sensitivity bars --------------------------------------------------- */
const BARS = [
  { k: 'run 4, as reported', v: '72.0%', w: 72.0, cls: '' },
  { k: 'the reference', v: '73.0%', w: 73.0, cls: 'is-ref' },
  { k: 'with my splitter', v: '75.2%', w: 75.2, cls: 'is-now' },
  { k: 'ceiling (perfect de-merge)', v: '83.4%', w: 83.4, cls: 'is-cap' },
];

/* ---- tomorrow ----------------------------------------------------------- */
const HPC = [
  {
    s: 'block', t: 'Check the fold plan against the clock before launching anything',
    w: <>Run 4 took <b>21 h</b> on DEMETER’s single 4090. Five folds sequentially is <b>~4.4 days</b>. The hospital box has four 4090s — one fold per GPU is ~21 h total. Decide <em>where</em> run 5 trains before you generate splits.</>,
  },
  {
    s: 'todo', t: 'Regenerate splits as 5 patient-disjoint folds',
    w: <>Must be split by <em>patient</em>, not scan — several patients have two studies. Current split is 430/57/110 from 264/37/77 patients. The 110 test cases stay untouched.</>,
  },
  {
    s: 'todo', t: 'Re-run the audit on the HPC to confirm the numbers transfer',
    w: <>The organ arrays are already in the HPC cache, so no <code>--organs</code> override is needed there. Sanity check: the <code>off</code> row must reproduce run 4’s published figures.</>,
    cmd: 'python scripts/audit_merging.py \\\n  --checkpoint checkpoints/run-4/checkpoint_best.pth \\\n  --split val --cache-dir ~/psma-cache \\\n  --out evaluation/results/run4/merging',
  },
  {
    s: 'todo', t: 'Harmonise DEEP-PSMA before a single case enters training',
    w: <>Resample onto the shared <code>[2.0364, 2.0364, 3.0]</code> grid and <b>confirm its label convention matches AutoPET</b>. Its ground truth is threshold-derived from a normal-organ reference, so the definition of “lesion” may not be identical.</>,
  },
];

const BEFORE_RUN5 = [
  { s: 'done', t: 'patient_accuracy fixed + regression guard', w: 'requires tp > 0; self-test blocks a revert' },
  { s: 'done', t: 'merging audit wired into post_run.py', w: 'step 5 — every future run reports it automatically' },
  { s: 'done', t: 'expansion tested and rejected', w: 'closes the last row of the reference comparison table' },
  { s: 'block', t: 'Splitter: adopt or shelve', w: 'blocked on the supervisor answering Q1 and Q2' },
  { s: 'todo', t: '5 folds generated + fold-0 launched', w: 'the actual start of run 5' },
  { s: 'todo', t: '.gitattributes line-ending fix', w: 'git status currently shows phantom diffs on /mnt/c' },
];

export default function Run5Handoff() {
  const exportPdf = () => {
    const prev = document.title;
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    document.title = 'mamba-psma-run5-handoff';
    window.addEventListener('afterprint', restore);
    window.print();
  };

  return (
    <div className="pt-module r5">
      <style>{CSS}</style>

      <header className="pt-card r5-head">
        <p className="r5-printhead">CITS4010 · Mamba_PSMA · run 5 handoff · 1 Sep 2026</p>
        <div className="r5-head__row">
          <span className="r5-tag">post-run-4</span>
          <span className="r5-chip"><b>57</b> val scans · run 4 checkpoint</span>
          <button type="button" className="r5-export" onClick={exportPdf}
                  title="Print this page to a PDF reference">
            <Icon name="printer" size={13} />
            Export PDF
          </button>
        </div>
        <h4 className="r5-title">Run 5 Handoff — what changed, and what’s left</h4>
        <p className="r5-sub">
          One session, three experiments. <b>One rejected</b> (the reference’s expansion algorithm),
          <b> one bug fixed</b> (a metric that rewarded false alarms), and <b>one real finding</b> —
          41% of run 4’s “missed” lesions had actually been segmented. No headline metric improved;
          what changed is that the numbers are now honest and we know where the recall is hiding.
        </p>
        <div className="r5-meta">
          <span className="r5-chip"><b>date</b> 1 Sep 2026</span>
          <span className="r5-chip"><b>GPU cost</b> ~1 h (5 inference passes)</span>
          <span className="r5-chip"><b>training runs</b> 0</span>
          <span className="r5-chip"><b>new code</b> expansion · splitting · audit_merging</span>
        </div>
      </header>

      {/* ---------------- 1. tonight ---------------- */}
      <section className="pt-card r5-sec">
        <p className="r5-lab">For tonight — 30 seconds</p>
        <h4>Three sentences for your supervisor</h4>
        <div className="r5-talk">
          {TALK.map((c, i) => (
            <div className="r5-talk__c" key={c.t}>
              <span className="r5-talk__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="r5-talk__t">{c.t}</span>
              <span className="r5-talk__w">{c.w}</span>
            </div>
          ))}
        </div>
        <p className="r5-lab" style={{ marginTop: '1rem' }}>Then ask — in this order</p>
        <ol className="r5-ask">
          {ASK.map((q, i) => <li key={i} className={q.key ? 'is-key' : undefined}>{q.t}</li>)}
        </ol>
        <div className="r5-note">
          <b>Q1 is the one to lead with.</b> If disease burden matters more than lesion count, the
          merging finding is a scoring artefact rather than a real deficiency — and that answer could
          save weeks of work before run 5 starts.
        </div>
      </section>

      {/* ---------------- 2. how the numbers changed ---------------- */}
      <section className="pt-card r5-sec">
        <p className="r5-lab">The numbers</p>
        <h4>What moved, and what didn’t</h4>
        <div className="r5-tw">
          <table className="r5-t">
            <thead>
              <tr><th>Metric</th><th>Before</th><th>After</th><th>What it means</th></tr>
            </thead>
            <tbody>
              {DELTA.map(([k, a, b, cls, note]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="r5-v fl">{a}</td>
                  <td className={`r5-v ${cls}`}>{b}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="r5-p">
          The honest summary: <b>no headline number improved.</b> What this session bought is a
          metric that no longer flatters us, a rejected dead end that would otherwise have stayed an
          open excuse, and a measured 11-point pool of recall we now know exists.
        </p>
        <p className="r5-lab" style={{ marginTop: '0.9rem' }}>Where the recall is</p>
        <div className="r5-bars">
          {BARS.map((b) => (
            <div className={`r5-bar ${b.cls}`} key={b.k}>
              <span className="r5-bar__k">{b.k}</span>
              <span className="r5-bar__t"><i className="r5-bar__f" style={{ '--w': `${b.w}%` }} /></span>
              <span className="r5-bar__v">{b.v}</span>
            </div>
          ))}
        </div>
        <p className="r5-p" style={{ fontSize: '0.78rem' }}>
          Lesion sensitivity. The dashed bar is the ceiling if every merged lesion were separated
          perfectly — unreachable in practice, because finding merges requires the ground truth.
        </p>
      </section>

      {/* ---------------- 3. the three experiments ---------------- */}
      <section className="pt-card r5-sec">
        <p className="r5-lab">Why — three experiments</p>
        <h4>Each one in a picture</h4>
        <div className="r5-exp">
          {EXPERIMENTS.map((e) => (
            <div className={`r5-card ${e.cls}`} key={e.t}>
              <span className="r5-card__v">{e.v}</span>
              <span className="r5-card__t">{e.t}</span>
              {e.svg}
              <p className="r5-card__w">{e.w}</p>
            </div>
          ))}
        </div>
        <div className="r5-note">
          <b>Why a null result is still worth having.</b> The expansion port is verified
          voxel-identical to a verbatim copy of the reference’s own code
          (<code>scripts/verify_expansion_parity.py</code>), so “it didn’t help” means the technique
          did nothing — not that it was mistyped. That is what lets the comparison table mark
          organ-aware post-processing <em>tested and rejected</em> instead of untried.
        </div>
      </section>

      {/* ---------------- 4. tomorrow ---------------- */}
      <section className="pt-card r5-sec">
        <p className="r5-lab">Tomorrow — at the HPC</p>
        <h4>Four things, in this order</h4>
        <ul className="r5-list">
          {HPC.map((x) => (
            <li className={x.s} key={x.t}>
              <b>{x.t}</b>
              <span>{x.w}</span>
              {x.cmd && <div className="r5-cmd">{x.cmd}</div>}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- 5. before run 5 ---------------- */}
      <section className="pt-card r5-sec">
        <p className="r5-lab">Gate</p>
        <h4>Before run 5 can start</h4>
        <div className="r5-cols">
          <ul className="r5-list">
            {BEFORE_RUN5.slice(0, 3).map((x) => (
              <li className={x.s} key={x.t}><b>{x.t}</b><span>{x.w}</span></li>
            ))}
          </ul>
          <ul className="r5-list">
            {BEFORE_RUN5.slice(3).map((x) => (
              <li className={x.s} key={x.t}><b>{x.t}</b><span>{x.w}</span></li>
            ))}
          </ul>
        </div>
        <div className="r5-note">
          <b>Do not cross-validate first.</b> Five folds on top of an understated sensitivity metric
          produces five understated numbers instead of one, and the splitter decision changes what
          those numbers mean. Settle the splitter, then train.
        </div>
      </section>
    </div>
  );
}
