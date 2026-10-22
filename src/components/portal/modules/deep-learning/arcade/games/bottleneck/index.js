/* Bottleneck — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'bottleneck',
  title: 'Bottleneck',
  lectures: [5],
  concepts: [],
  blurb: 'Rotate a plane through the cloud, tie the weights, order the training, drop an item on the map.',
  color: '--dlv-violet',
  levels: 3,
  glyph: Glyph,
  load: () => import('./Bottleneck.jsx'),
};
