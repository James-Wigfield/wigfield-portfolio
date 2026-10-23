/* Block Builder — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { GAME } from '../../content/block-builder.js';

export default {
  id: 'block-builder',
  title: GAME.title,
  lectures: [3],
  concepts: [
    'arch.lenet5', 'arch.alexnet', 'arch.googlenet', 'arch.inception', 'arch.vgg', 'arch.resnet', 'arch.xception', 'arch.senet',
    'arch.ilsvrc', 'arch.typical', 'shape.pool', 'transfer.finetune', 'transfer.pretrained',
  ],
  blurb: GAME.blurb,
  color: '--dlv-violet',
  levels: 3,
  levelNames: GAME.levelNames,
  glyph: Glyph,
  art: 'cab-block-builder.png',
  load: () => import('./BlockBuilder.jsx'),
};
