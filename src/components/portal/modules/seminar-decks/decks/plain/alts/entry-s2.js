// Second option entry for one slide (filled by its builder); merged into SECOND by ./second.js.
import { createElement } from 'react';
import { BackgroundSlideB } from './BackgroundB';

export const ENTRY = {
  background: {
    render: (ctx) => createElement(BackgroundSlideB, { ctx }),
    media: ['figures/plain-a-pet.png', 'figures/plain-a-ct.png', 'clips/plain-a-turn.mp4', 'clips/plain-a-turn.png'],
    timeline: 61.6,
    note: 'Motion only, so it ends as the tile above: the PET turns once in 3D as it appears, the CT fuses in during the turn, and it lands as the same fused view; the rest is unchanged.',
  },
};
