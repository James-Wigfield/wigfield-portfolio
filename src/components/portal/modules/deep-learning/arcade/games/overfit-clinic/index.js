/* Overfit Clinic — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'overfit-clinic',
  title: 'Overfit Clinic',
  lectures: [1, 2, 3, 4, 5, 6, 8],
  concepts: [],
  blurb: 'Diagnose a sick model from its curves, summary or samples and prescribe the fix the slides name. The exam boss.',
  color: '--dlv-red',
  levels: 3,
  glyph: Glyph,
  art: 'cab-overfit-clinic.png',
  load: () => import('./OverfitClinic.jsx'),
};
