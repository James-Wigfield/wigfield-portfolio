/* Block Builder — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'block-builder',
  title: 'Block Builder',
  lectures: [3],
  concepts: [],
  blurb: 'Assemble or identify LeNet-5, AlexNet, GoogLeNet’s inception module, VGG, the ResNet unit, Xception and SENet from parts.',
  color: '--dlv-violet',
  levels: 3,
  glyph: Glyph,
  art: 'cab-block-builder.png',
  load: () => import('./BlockBuilder.jsx'),
};
