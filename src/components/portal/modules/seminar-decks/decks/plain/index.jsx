import { TALK } from '../../shared/meta';
import { BACKUPS } from '../../shared/backups';
import { Body, Frame } from './parts';
import { SKELETON } from './skeleton';
import { BackgroundSlide, BaselinesSlide, MambaSlide, ProblemSlide, QuestionSlide, TitleSlide } from './slides';
import './plain.css';

/* ============================================================================
   DECK 4 — PLAIN DRAFT (slug plain)
   ----------------------------------------------------------------------------
   The talk rebuilt from the bare basics, in the dissertation's order. Content
   lives in ./skeleton.js. Slides 1 to 6 are built (./slides.jsx): one build
   step each, with a timeline that plays once on entry (./motion.js) and a
   finished state everywhere else. Slides 7 to 14 keep the draft layout
   (./parts.jsx): points, numbers and a dashed box for the planned visual.
   Purpose, numbers and visual show as cues in the presenter and script views;
   the presenter view reads `said` (James's transcript) where a slide has one.
   ========================================================================== */

// Built slides. `timeline` is when the slide's last motion ends, in seconds from
// entering it (from slides.jsx), for the presenter view's progress line.
const BUILT = {
  title: { render: (ctx) => <TitleSlide ctx={ctx} />, bare: true, timeline: 3.0 },
  background: {
    render: (ctx) => <BackgroundSlide ctx={ctx} />,
    scans: true,
    cites: ['kendrick2022', 'sheikhbahaei2017'],
    media: ['figures/plain-a-pet.png', 'figures/plain-a-ct.png'],
    timeline: 61.6,
  },
  problem: {
    render: (ctx) => <ProblemSlide ctx={ctx} />,
    scans: true,
    cites: ['kendrick2022'],
    media: ['figures/plain-b-pet.png'],
    timeline: 31.5,
  },
  baselines: {
    render: (ctx) => <BaselinesSlide ctx={ctx} />,
    scans: true,
    cites: ['isensee2021'],
    media: ['figures/plain-a-pet.png'],
    timeline: 25.3,
  },
  mamba: { render: (ctx) => <MambaSlide ctx={ctx} />, cites: ['gu2023'], timeline: 35.6 },
  question: { render: (ctx) => <QuestionSlide ctx={ctx} />, timeline: 8.6 },
};

const slides = SKELETON.map((s) => {
  const built = BUILT[s.id];
  return {
    id: s.id,
    section: s.section,
    title: s.id === 'title' ? TALK.title : s.title,
    ...(built ? { stage: !built.bare, ...built } : { render: () => <Body s={s} /> }),
    script: { seconds: s.seconds, text: s.points.join(' · ') },
    said: s.said,
    saidSecs: s.saidSecs,
    cues: [
      `Purpose: ${s.purpose}`,
      ...(s.numbers.length ? [`Numbers: ${s.numbers.join('; ')}`] : []),
      `Visual: ${s.visual}`,
    ],
  };
});

export default {
  slug: 'plain',
  name: 'Plain Draft',
  concept: "The talk in the dissertation's order on plain white slides. Slides 1 to 6 are built, each with one timed animation that plays once on entry; slides 7 to 14 are still the draft layout with talking points and a target time.",
  wow: ['Slide 2: PET and CT fused, then the anatomy around a lesion', 'Slide 5: a 3D feature block flattened into one long sequence'],
  risk: 'Each built slide animates on its own clock from entry, timed to finish before the transcript does at a pace 15% faster than James measured.',
  className: 'dp',
  Frame,
  fonts: ['sourcesans-normal-400-700.woff2'],
  fontFaces: [
    { family: 'SD Source Sans', weight: 400, style: 'normal' },
    { family: 'SD Source Sans', weight: 600, style: 'normal' },
  ],
  slides,
  // Only the references backup so far: it lists the works the built slides cite.
  backups: BACKUPS.filter((b) => b.id === 'b-refs').map((b) => ({ ...b, section: 'Backup' })),
};
