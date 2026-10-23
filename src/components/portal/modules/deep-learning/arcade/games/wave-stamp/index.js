/* Wave Stamp — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'wave-stamp',
  title: 'Wave Stamp',
  lectures: [8],
  concepts: [],
  blurb: 'Match sinusoidal positional-encoding barcodes to positions (base 1000 vs 10 000), then chop an image into ViT patches.',
  color: '--dlv-green',
  levels: 3,
  glyph: Glyph,
  art: 'cab-wave-stamp.png',
  load: () => import('./WaveStamp.jsx'),
};
