/* Wave Stamp — the manifest (frozen contract, tools/dl-arcade/PLAN.md).
   vit.variants (slide 47 onward, not examined) is left out of `concepts` so
   the scheduler never sends a player here to drill it; the one item about
   its exam status still records under it. */
import { Glyph } from './glyph.jsx';
import { COPY } from '../../content/wave-stamp.js';

export default {
  id: 'wave-stamp',
  title: 'Wave Stamp',
  lectures: [8],
  concepts: ['posenc.formula', 'posenc.why', 'posenc.code', 'vit.patches', 'vit.dataHungry', 'vit.visualAttention'],
  blurb: 'Match sinusoidal positional-encoding barcodes to positions (base 1000 vs 10 000), then chop an image into ViT patches.',
  color: '--dlv-green',
  levels: 3,
  levelNames: COPY.levelNames,
  glyph: Glyph,
  art: 'cab-wave-stamp.png',
  load: () => import('./WaveStamp.jsx'),
};
