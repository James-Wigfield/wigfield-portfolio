import Frame from './Frame';
import { BACKUPS } from '../../shared/backups';
import { CUES, SCRIPTS } from './scripts';
import {
  CloseSlide, DataSlide, EnsembleSlide, FairSlide, IdeaSlide, NetworkSlide, OverviewSlide, ScanSlide,
  SealedSlide, TitleSlide, TwinSlide, VerdictsSlide, WindowsSlide,
} from './slides';
import './one-scan.css';

/* ============================================================================
   DECK 1 — ONE SCAN, START TO FINISH  (slug one-scan, class d1)
   ----------------------------------------------------------------------------
   The audience follows one real held-out scan (case A) through the whole
   pipeline, then the talk zooms out to the sealed test, the fair comparison
   and the twin, and case B closes the loop on failure. Cinematic dark,
   continuous with the PSMA Motion clips: same ground (#0B1220), same type
   (Fraunces, Hanken Grotesk, IBM Plex Mono), same colour meanings (sky
   found / circle, vermillion missed / dashed square, yellow false alarm /
   diamond, gold process: windows, Mamba, the size filter).
   Files: Frame.jsx (chrome), slides.jsx (slide bodies), figures.jsx (motion
   graphics N1-N8 and the closing split), parts.jsx (clips, loop, glyphs),
   geometry.js and content.js (computed sizes, on-screen strings), scripts.js
   (transcripts and cues), one-scan.css (theme).
   ========================================================================== */

// Timing for the panel cover on clip slides: how far down the right panel
// the ground-coloured title slot reaches, per build step, and the delay
// (s) before it moves while a clip plays in, measured from the clips'
// frames (A2a's inset starts at y 293 and is gone 4.2 s into A2b; the A4
// sub-line clears 0.3 s into A5; B5 the same).
const panelAt = (spec) => (ctx) => {
  const p = spec[Math.min(ctx.step, spec.length - 1)];
  const playing = ctx.clip(ctx.step) === 'play';
  return { cover: p[0], delay: playing ? p[1] : 0 };
};

const slides = [
  {
    id: 'title',
    layout: 'title',
    bigLogo: () => true,
    scans: true,
    media: ['clips/case-a-1-scan.mp4'],
    render: (ctx) => <TitleSlide ctx={ctx} />,
    script: SCRIPTS.title,
    cues: CUES.title,
  },
  {
    id: 'scan',
    part: 'problem',
    layout: 'left',
    title: 'This scan holds {{a.gt}} cancer lesions',
    kicker: 'Why this is hard',
    steps: 3,
    scans: true,
    cites: ['kendrick2022'],
    media: ['clips/case-a-1-scan.mp4'],
    render: (ctx) => <ScanSlide ctx={ctx} />,
    script: SCRIPTS.scan,
    cues: CUES.scan,
  },
  {
    id: 'overview',
    part: 'problem',
    layout: 'left',
    title: 'A hybrid CNN-Mamba network found {{r5.found_round}} of lesions at {{r5.prec_round}} precision',
    kicker: 'The project in one breath',
    scans: true,
    media: ['clips/case-a-1-scan.png'],
    render: (ctx) => <OverviewSlide ctx={ctx} />,
    script: SCRIPTS.overview,
    cues: CUES.overview,
  },
  {
    id: 'windows',
    part: 'previous',
    layout: 'left',
    title: "Today's tools read the body one window at a time",
    kicker: 'Previous work · nnU-Net',
    steps: 4,
    scans: true,
    cites: ['isensee2021', 'kendrick2022'],
    media: ['clips/case-a-1-scan.png'],
    render: (ctx) => <WindowsSlide ctx={ctx} />,
    script: SCRIPTS.windows,
    cues: CUES.windows,
  },
  {
    id: 'idea',
    part: 'previous',
    layout: 'full',
    title: 'Mamba reads deep features as one sequence, at linear cost',
    kicker: 'The idea, and the question',
    steps: 4,
    cites: ['gu2023', 'ma2024', 'isensee2024'],
    render: (ctx) => <IdeaSlide ctx={ctx} />,
    script: SCRIPTS.idea,
    cues: CUES.idea,
  },
  {
    id: 'data',
    part: 'mine',
    layout: 'full',
    title: '{{data.total}} scans, {{data.test}} locked away until the very end',
    kicker: 'My work · data and protocol',
    steps: 4,
    cites: ['jeblick2026', 'jackson2025'],
    render: (ctx) => <DataSlide ctx={ctx} />,
    script: SCRIPTS.data,
    cues: CUES.data,
  },
  {
    id: 'network',
    part: 'mine',
    layout: 'full',
    title: 'Mamba runs only in the three deepest stages',
    kicker: 'My work · the network',
    steps: 5,
    cites: ['wasserthal2023'],
    media: ['figures/architecture-option-f.svg'],
    render: (ctx) => <NetworkSlide ctx={ctx} />,
    script: SCRIPTS.network,
    cues: CUES.network,
  },
  {
    id: 'ensemble',
    part: 'mine',
    layout: 'panel',
    title: 'Five models vote, then specks are removed',
    steps: 3,
    scans: true,
    panel: panelAt([[292, 0], [322, 4.1], [322, 0]]),
    media: ['clips/case-a-1-scan.png', 'clips/case-a-2a-model.mp4', 'clips/case-a-2b-ensemble.mp4', 'clips/case-a-2c-threshold.mp4'],
    render: (ctx) => <EnsembleSlide ctx={ctx} />,
    script: SCRIPTS.ensemble,
    cues: CUES.ensemble,
  },
  {
    id: 'verdicts',
    part: 'results',
    layout: 'panel',
    title: 'On this scan, the model found nearly every lesion',
    steps: 3,
    scans: true,
    panel: panelAt([[330, 0], [330, 0], [296, 0.3]]),
    media: ['clips/case-a-2c-threshold.png', 'clips/case-a-3-prediction.mp4', 'clips/case-a-4-ground-truth.mp4', 'clips/case-a-5-accuracy.mp4'],
    render: (ctx) => <VerdictsSlide ctx={ctx} />,
    script: SCRIPTS.verdicts,
    cues: CUES.verdicts,
  },
  {
    id: 'sealed',
    part: 'results',
    layout: 'full',
    title: 'On all {{data.test}} sealed scans, the ensemble scored F1 {{r5.f1}}',
    kicker: 'Results · the sealed test',
    steps: 3,
    render: (ctx) => <SealedSlide ctx={ctx} />,
    script: SCRIPTS.sealed,
    cues: CUES.sealed,
  },
  {
    id: 'fair',
    part: 'results',
    layout: 'full',
    title: 'Run 4 found more lesions than PSMASegmentator, and more false alarms',
    kicker: 'Results · the fair comparison',
    steps: 3,
    media: ['data/fair-per-case.json'],
    render: (ctx) => <FairSlide ctx={ctx} />,
    script: SCRIPTS.fair,
    cues: CUES.fair,
  },
  {
    id: 'twin',
    part: 'results',
    layout: 'full',
    title: 'On unseen scans, a CNN-only twin did as well',
    kicker: 'Results · the twin ablation',
    steps: 4,
    render: (ctx) => <TwinSlide ctx={ctx} />,
    script: SCRIPTS.twin,
    cues: CUES.twin,
  },
  {
    id: 'close',
    part: 'meaning',
    layout: 'panel',
    title: 'Some scans still fail, and the next test is SCGH data',
    steps: 5,
    scans: true,
    panel: panelAt([[330, 0], [330, 0], [330, 0], [330, 0], [330, 0]]),
    hideTitle: (ctx) => ctx.step >= 3,
    bigLogo: (ctx) => ctx.step >= 4,
    media: [
      'clips/case-b-3-prediction.png', 'clips/case-b-4-ground-truth.mp4',
      'clips/d1-model-run.mp4', 'data/d1-cues.json', 'clips/case-a-4-ground-truth.png',
    ],
    render: (ctx) => <CloseSlide ctx={ctx} />,
    script: SCRIPTS.close,
    cues: CUES.close,
  },
];

export default {
  slug: 'one-scan',
  name: 'One Scan, Start to Finish',
  concept: 'Follow one real held-out scan through the whole pipeline, then zoom out to the 130 sealed scans, the fair comparison and the twin that did just as well.',
  wow: [
    'The PSMA Motion clips chain without a seam; titles sit in the clips\' own title slot',
    'Windows drawn to scale on the real scan (PSMASegmentator, runs 3 to 5, run 6)',
    'The verified architecture figure revealed region by region under a moving camera',
    'A closing split of case A beside case B, built from the two holds',
  ],
  risk: 'Thirteen clips and a recorded demo: run the Ready check first, and if a clip stalls, its hold frame shows and the talk carries on.',
  className: 'd1',
  Frame,
  fonts: ['fraunces-normal-400-700.woff2', 'fraunces-italic-400-700.woff2', 'hanken-normal-400-700.woff2', 'plexmono-normal-400.woff2', 'plexmono-normal-500.woff2', 'plexmono-normal-600.woff2'],
  fontFaces: [
    { family: 'SD Fraunces', weight: 600, style: 'normal' },
    { family: 'SD Fraunces', weight: 400, style: 'normal' },
    { family: 'SD Fraunces', weight: 400, style: 'italic' },
    { family: 'SD Hanken', weight: 400, style: 'normal' },
    { family: 'SD Hanken', weight: 500, style: 'normal' },
    { family: 'SD Hanken', weight: 600, style: 'normal' },
    { family: 'SD Hanken', weight: 700, style: 'normal' },
    { family: 'SD Plex Mono', weight: 500, style: 'normal' },
    { family: 'SD Plex Mono', weight: 600, style: 'normal' },
  ],
  slides,
  // The references backup prints full IEEE entries (volumes, pages, arXiv
  // ids): bibliographic labels, not facts, so the list is marked data-tick.
  backups: BACKUPS.map((b) => (b.id === 'b-refs'
    ? { ...b, layout: 'full', render: (ctx) => <div className="d1-refs" data-tick="">{b.render(ctx)}</div> }
    : { ...b, layout: 'full' })),
};
