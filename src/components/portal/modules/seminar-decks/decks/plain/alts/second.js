import { createElement } from 'react';
import { ResultsSlideB } from './ResultsB';

/* ============================================================================
   PLAIN DECK — SECOND OPTIONS (data; no JSX, so this file may export an object)
   ----------------------------------------------------------------------------
   Each entry replaces one main slide's render (and its motion end time, media
   and notes) in place: same id, same transcript, same timing caps. They are
   shown together in the hidden derived deck `plain-alt` (../../plain-alt) and
   offered under each tile of the plain deck's Slides tab. `note` is the one
   line shown there: what is different and why.
   ========================================================================== */

export const SECOND = {
  'results-test': {
    render: (ctx) => createElement(ResultsSlideB, { ctx }),
    media: ['figures/plain-c-pet.png', 'clips/plain-c-spin.mp4'],
    timeline: 48.6,
    note: 'Motion only, so it ends as the tile above: the PET of the sealed test scan first turns once in 3D, then settles into the same view; the rest is unchanged.',
  },
};
