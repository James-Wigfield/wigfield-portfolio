import { createElement } from 'react';
import { TwinSlideB } from './TwinB';

// Second option entry for slide 12 (TwinB.jsx); merged into SECOND by ./second.js.
// It shows a scan, so the attribution line prints (scans: true). Motion ends as the
// main slide's (54.4 s): the second clip's turn ends at 44.6 s.
export const ENTRY = {
  'results-twin': {
    render: (ctx) => createElement(TwinSlideB, { ctx }),
    scans: true,
    media: ['clips/plain-a-grow1.mp4', 'clips/plain-a-grow1.png', 'clips/plain-a-grow2.mp4', 'clips/plain-a-grow2.png'],
    timeline: 54.4,
    note: 'The two flat patches become the patches to scale on a whole-body scan; the larger one grows from the first, and both turn in 3D, so their depth shows.',
  },
};
