/* Descent — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'descent',
  title: 'Descent',
  lectures: [2],
  concepts: [],
  blurb: 'Optimiser golf: predict which club makes par, then swing by the slides’ exact update rules.',
  color: '--dlv-green',
  levels: 3,
  glyph: Glyph,
  load: () => import('./Descent.jsx'),
};
