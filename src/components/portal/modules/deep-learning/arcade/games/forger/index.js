/* Forger — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'forger',
  title: 'Forger',
  lectures: [6],
  concepts: [],
  blurb: 'Run a GAN’s two training phases in the right order: discriminator on real + fake, then generator through a frozen discriminator.',
  color: '--dlv-magenta',
  levels: 3,
  glyph: Glyph,
  art: 'cab-forger.png',
  load: () => import('./Forger.jsx'),
};
