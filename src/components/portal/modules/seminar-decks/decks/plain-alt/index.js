import plain from '../plain/index.jsx';
import { SECOND } from '../plain/alts/second';

/* ============================================================================
   DERIVED DECK — PLAIN, WITH EVERY SECOND OPTION SWAPPED IN (slug plain-alt)
   ----------------------------------------------------------------------------
   The plain deck exactly as it is, except that each slide with a second
   option (../plain/alts/second.js) uses it. For previewing, presenting and
   gating the second options in place without changing the plain deck. Not on
   the landing page (hidden); Esc from present mode returns to the plain
   deck's Slides tab (exitTo).
   ========================================================================== */

export default {
  ...plain,
  slug: 'plain-alt',
  name: 'Plain Draft, second options',
  concept: 'The plain deck with every second option swapped in, to preview them in place. Not listed on the landing page.',
  hidden: true,
  exitTo: 'plain',
  altSlug: undefined,
  slides: plain.slides.map((s) => (SECOND[s.id] ? { ...s, ...SECOND[s.id], second: true, secondNote: SECOND[s.id].note } : s)),
};
