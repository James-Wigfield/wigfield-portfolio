import { createElement } from 'react';
import { BaselinesSlideB } from './BaselinesB';
import { S4_12 } from './s4_12.gen';

// Second option entry for slide 4 (BaselinesB.jsx); merged into SECOND by ./second.js.
// Motion ends when the dimensions fade in after the step down: turn end + 0.3 + 0.25 + 1.6 + 0.7.
const END = Math.round((S4_12.s4.turn[1] + 0.3 + 0.25 + 1.6 + 0.7) * 10) / 10;

export const ENTRY = {
  baselines: {
    render: (ctx) => createElement(BaselinesSlideB, { ctx }),
    media: ['figures/plain-a-pet.png', 'clips/plain-a-patch.mp4', 'clips/plain-a-patch.png'],
    timeline: END,
    note: 'Motion only, so it ends as the tile above: once the patch is drawn, the scan and PSMASegmentator\'s patch, a box to scale, turn once in 3D before it steps down.',
  },
};
