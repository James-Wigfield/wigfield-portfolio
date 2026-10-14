import { createElement } from 'react';
import { ResultsSlideB } from './ResultsB';
import { ENTRY as S2 } from './entry-s2';
import { ENTRY as S3 } from './entry-s3';
import { ENTRY as S4 } from './entry-s4';
import { ENTRY as S8 } from './entry-s8';
import { ENTRY as S12 } from './entry-s12';

/* ============================================================================
   PLAIN DECK — SECOND OPTIONS (data; no JSX, so this file may export an object)
   ----------------------------------------------------------------------------
   Each entry replaces one main slide's render (and its motion end time, media
   and notes) in place: same id, same transcript, same timing caps. They are
   shown together in the hidden derived deck `plain-alt` (../../plain-alt) and
   offered under each tile of the plain deck's Slides tab. `note` is the one
   line shown there: what is different and why.
   ========================================================================== */

// 14 Oct (day): the 3D options, one entry file per slide (entry-s<n>.js), so they can be built
// side by side; each entry is { '<slide id>': { render, media, timeline, note } } or empty.
export const SECOND = {
  ...S2,
  ...S3,
  ...S4,
  ...S8,
  ...S12,
  'results-test': {
    render: (ctx) => createElement(ResultsSlideB, { ctx }),
    media: ['figures/plain-c-pet.png', 'clips/plain-c-spin.mp4'],
    timeline: 48.6,
    note: 'Motion only, so it ends as the tile above: the PET of the sealed test scan first turns once in 3D, then settles into the same view; the rest is unchanged.',
  },
};
