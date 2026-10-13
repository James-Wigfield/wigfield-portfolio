import { BACKUPS } from '../../shared/backups';
import Frame from './Frame';
import { SLIDES } from './slides';
import './context.css';

/* ============================================================================
   DECK 3 — "How Much of the Body Does a Model Need to See?" (slug: context)
   ----------------------------------------------------------------------------
   Context is the thread. A deep-black imaging suite, the PET colour ramp as
   the only accent, and one camera move across the talk: body, window,
   network, token sequence, then back out to 697 scans, the sealed 130, the
   100 unseen, and the 2x2 where the window grows and the hybrid's F1 falls.
   Files: slides.jsx (the list), slidesA.jsx / slidesB.jsx (one component per
   slide), stage.jsx (camera, scan views, windows, option F, countdown),
   geometry.js and layouts.js (numbers from the manifest), scripts.js
   (transcripts and cues), Frame.jsx, context.css (all under .sd-slide.d3).
   ========================================================================== */

export default {
  slug: 'context',
  name: 'How Much of the Body Does a Model Need to See?',
  concept: 'Context is the thread: one camera move from a body, into a window, through the network to its token lanes, then back out to 697 scans and the 2x2 where a bigger window made the hybrid worse.',
  wow: [
    'Spot the lesions: a five-second countdown on case A, then the reveal',
    'Windows drawn to scale on a real body: mine, PSMASegmentator\'s, run 6\'s',
    'The camera flies from the body into option F and out along six token lanes',
    'The window grows on the body while the hybrid\'s F1 line falls',
  ],
  risk: 'Many camera moves: rehearse the clicks so no zoom lands while the audience is reading, and check the countdown and clip A4 on the room projector.',
  className: 'd3',
  Frame,
  fonts: ['plexsans-normal-400-700.woff2', 'plexmono-normal-400.woff2', 'plexmono-normal-500.woff2', 'plexmono-normal-600.woff2'],
  fontFaces: [
    { family: 'SD Plex Sans', weight: 400, style: 'normal' },
    { family: 'SD Plex Sans', weight: 600, style: 'normal' },
    { family: 'SD Plex Mono', weight: 400, style: 'normal' },
    { family: 'SD Plex Mono', weight: 500, style: 'normal' },
    { family: 'SD Plex Mono', weight: 600, style: 'normal' },
  ],
  slides: SLIDES,
  backups: BACKUPS,
  media: [],
};
