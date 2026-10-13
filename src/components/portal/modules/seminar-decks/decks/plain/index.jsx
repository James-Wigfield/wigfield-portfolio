import { TALK } from '../../shared/meta';
import { Body, Cover, Frame } from './parts';
import { SKELETON } from './skeleton';
import './plain.css';

/* ============================================================================
   DECK 4 — PLAIN DRAFT (slug plain)
   ----------------------------------------------------------------------------
   The talk rebuilt from the bare basics, in the dissertation's order: plain
   white slides with a title, the talking points, the numbers and a dashed box
   for the planned visual. Content lives in ./skeleton.js, layout in
   ./parts.jsx. Purpose, numbers and visual also show as cues in the presenter
   and script views, and the points are the "transcript" (spoken in James's
   own words, so the word-based timing is not meaningful yet: use the targets).
   ========================================================================== */

const slides = SKELETON.map((s) => ({
  id: s.id,
  section: s.section,
  title: s.id === 'title' ? TALK.title : s.title,
  bare: s.id === 'title',
  render: () => (s.id === 'title' ? <Cover /> : <Body s={s} />),
  script: { seconds: s.seconds, text: s.points.join(' · ') },
  said: s.said,
  saidSecs: s.saidSecs,
  cues: [
    `Purpose: ${s.purpose}`,
    ...(s.numbers.length ? [`Numbers: ${s.numbers.join('; ')}`] : []),
    `Visual: ${s.visual}`,
  ],
}));

export default {
  slug: 'plain',
  name: 'Plain Draft',
  concept: "Draft 1, the skeleton: the talk in the dissertation's order on plain slides, with talking points, numbers and a target time for each. Visuals come last.",
  wow: ['None yet: visuals are added after the talking points are settled'],
  risk: 'Talking points, not a script: James speaks to them in his own words. Times are targets (12:00 in total), not word counts.',
  className: 'dp',
  Frame,
  fonts: ['sourcesans-normal-400-700.woff2'],
  fontFaces: [
    { family: 'SD Source Sans', weight: 400, style: 'normal' },
    { family: 'SD Source Sans', weight: 600, style: 'normal' },
  ],
  slides,
  backups: [],
};
