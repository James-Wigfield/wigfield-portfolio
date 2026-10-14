import { createElement } from 'react';
import { TwinSlideB } from './TwinB';

// Second option entry for slide 12 (TwinB.jsx); merged into SECOND by ./second.js.
// It shows a scan, so the attribution line prints (scans: true). Motion ends as the
// main slide's (54.4 s); its clip is over by 17.5 s.
export const ENTRY = {
  'results-twin': {
    render: (ctx) => createElement(TwinSlideB, { ctx }),
    scans: true,
    media: ['clips/plain-a-grow1.mp4', 'clips/plain-a-grow1.png'],
    timeline: 54.4,
    note: 'The two flat patches become the patches to scale on a whole-body scan, so where each sits on the body shows; the larger one grows from the first as the chart moves to it.',
  },
};
