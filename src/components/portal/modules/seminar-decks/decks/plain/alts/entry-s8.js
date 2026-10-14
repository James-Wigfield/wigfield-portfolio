import { createElement } from 'react';
import { FIG_MEDIA } from '../geometry';
import { DesignSlideB } from './DesignB';
import { S8X } from './s8.gen';

// Slide 8's second option (alts/DesignB.jsx); merged into SECOND by ./second.js.
export const ENTRY = {
  design: {
    render: (ctx) => createElement(DesignSlideB, { ctx }),
    media: [...FIG_MEDIA, 'figures/plain-a-pet.png', 'clips/plain-c-run.mp4', 'clips/plain-c-run.png'],
    timeline: S8X.end + 0.4, // the last caption leaves over 0.4 s (cap 52.5 s)
    note: 'At the five-model sentence, the final model runs on a sealed test scan: one version reads it patch by patch in the real order, the five are averaged, then the threshold and the size filter.',
  },
};
