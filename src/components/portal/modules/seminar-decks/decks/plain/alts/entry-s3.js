// Second option entry for one slide (filled by its builder); merged into SECOND by ./second.js.
import { createElement } from 'react';
import { ProblemSlideB } from './ProblemB';

export const ENTRY = {
  problem: {
    render: (ctx) => createElement(ProblemSlideB, { ctx }),
    media: ['figures/plain-b-pet.png', 'clips/plain-b-turn.mp4', 'clips/plain-b-turn.png'],
    timeline: 31.5,
    note: 'Motion only, so it ends as the tile above: the scan turns once in 3D while its lesions are outlined from the head down, landing as the same view; the rest is unchanged.',
  },
};
