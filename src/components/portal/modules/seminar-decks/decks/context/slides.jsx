import { CUES, SCRIPTS } from './scripts';
import { BetSlide, ContextSlide, SpotSlide, TitleSlide, WindowSlide } from './slidesA';
import { AnatomySlide, AnswerSlide, FairSlide, InsideSlide, ScansSlide, SealedSlide, TwinSlide } from './slidesB';

/* ============================================================================
   DECK 3 (context) — THE TWELVE MAIN SLIDES
   ----------------------------------------------------------------------------
   One camera move across the talk: body, window, network, tokens, then back
   out to 697 scans, the sealed 130, the 100 unseen, and the 2x2. Twelve
   slides: the overview is the last build of slide 2 (critics, 13 Oct). Each slide's
   `layout` tells the frame where its title sits: 'top' (across the canvas)
   or 'side' (right column beside a full-height monitor or plate).
   ========================================================================== */

const A1 = 'clips/case-a-1-scan.png';
const OPTF = 'figures/architecture-option-f.svg';

const slide = (id, o) => ({ id, ...o, script: SCRIPTS[id], cues: CUES[id] });

export const SLIDES = [
  slide('title', {
    bare: true,
    scans: true,
    media: [A1],
    render: (ctx) => <TitleSlide ctx={ctx} />,
  }),
  slide('spot', {
    part: 'problem',
    layout: 'side',
    title: 'Outlining every lesion by hand is slow, and experts disagree',
    steps: 5,
    scans: true,
    cites: ['kendrick2022'],
    media: [A1, 'clips/case-a-3-prediction.png', 'clips/case-a-4-ground-truth.mp4', 'clips/case-a-4-ground-truth.png'],
    render: (ctx) => <SpotSlide ctx={ctx} />,
  }),
  slide('context', {
    part: 'problem',
    layout: 'side',
    title: 'Healthy organs glow too, so a model needs context',
    steps: 3,
    scans: true,
    cites: ['sheikhbahaei2017', 'rokuss2024'],
    media: ['figures/bg-psma-mip.png'],
    render: (ctx) => <ContextSlide ctx={ctx} />,
  }),
  slide('window', {
    part: 'previous',
    layout: 'side',
    title: 'A CNN reads the body one window at a time',
    steps: 3,
    scans: true,
    cites: ['isensee2021', 'kendrick2022'],
    media: [A1],
    render: (ctx) => <WindowSlide ctx={ctx} />,
  }),
  slide('bet', {
    part: 'previous',
    title: "Mamba's linear cost could buy a bigger window",
    steps: 4,
    cites: ['gu2023', 'isensee2024'],
    render: (ctx) => <BetSlide ctx={ctx} />,
  }),
  slide('inside', {
    part: 'mine',
    title: 'Mamba sits only in the deepest stages, where sequences are short',
    steps: 4,
    scans: true,
    cites: ['xing2024a'],
    media: [A1, OPTF],
    render: (ctx) => <InsideSlide ctx={ctx} />,
  }),
  slide('anatomy', {
    part: 'mine',
    title: 'A training-only organ task cut false alarms on lesion-free scans',
    steps: 2,
    cites: ['wasserthal2023', 'rokuss2024'],
    scans: true,
    media: [OPTF],
    render: (ctx) => <AnatomySlide ctx={ctx} />,
  }),
  slide('scans', {
    part: 'mine',
    title: 'All {{data.total}} scans, with {{data.test}} sealed away until the end',
    steps: 3,
    scans: true,
    cites: ['jeblick2026', 'jackson2025'],
    media: [A1],
    render: (ctx) => <ScansSlide ctx={ctx} />,
  }),
  slide('sealed', {
    part: 'results',
    layout: 'side',
    title: 'Scored once on the sealed scans, the ensemble found most lesions',
    steps: 2,
    scans: true,
    media: ['clips/case-a-4-ground-truth.png'],
    render: (ctx) => <SealedSlide ctx={ctx} />,
  }),
  slide('fair', {
    part: 'results',
    title: 'On {{fair.n}} scans neither saw, run 4 found more lesions than PSMASegmentator',
    steps: 3,
    media: ['data/fair-per-case.json'],
    render: (ctx) => <FairSlide ctx={ctx} />,
  }),
  slide('twin', {
    part: 'results',
    layout: 'side',
    title: 'A bigger window cost the hybrid more F1 than its twin',
    steps: 3,
    scans: true,
    cites: ['isensee2024'],
    media: [A1],
    render: (ctx) => <TwinSlide ctx={ctx} />,
  }),
  slide('answer', {
    part: 'meaning',
    title: "As trained, a bigger window helped neither; the gain is not Mamba's",
    steps: 4,
    scans: true,
    closing: true,
    media: ['clips/case-b-4-ground-truth.png', 'clips/d1-model-run.mp4', 'clips/d1-model-run.png', 'data/d1-cues.json'],
    render: (ctx) => <AnswerSlide ctx={ctx} />,
  }),
];
