/* Kernel Rush — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'kernel-rush',
  title: 'Kernel Rush',
  lectures: [3],
  concepts: ['shape.conv2d', 'cnn.padding', 'cnn.featureMaps', 'params.conv2d', 'shape.pool', 'params.pool', 'pool.global', 'cnn.stride'],
  blurb: 'A conv or pooling layer drops onto the input block. Size the output block before it lands.',
  color: '--dlv-aqua',
  levels: 3,
  levelNames: ['valid vs same · stride', 'filters span channels · pooling', 'stacks · receptive field'],
  glyph: Glyph,
  art: 'cab-kernel-rush.png',
  load: () => import('./KernelRush.jsx'),
};
