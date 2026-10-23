/* Signal Keeper — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { LEVEL_NAMES } from '../../content/signal-keeper.js';

export default {
  id: 'signal-keeper',
  title: 'Signal Keeper',
  lectures: [2],
  concepts: [
    'init.vanishing', 'init.glorot', 'init.he', 'init.lecun', 'init.which',
    'act.leakyRelu', 'act.elu', 'act.selu', 'act.which',
    'bn.algorithm', 'bn.params', 'bn.benefits', 'bn.placement', 'clip.gradient',
  ],
  blurb: 'Keep the activations and gradients healthy through a deep stack: pick the init, the activation, BatchNorm and clipping.',
  color: '--dlv-aqua',
  levels: 3,
  levelNames: LEVEL_NAMES,
  glyph: Glyph,
  art: 'cab-signal-keeper.png',
  load: () => import('./SignalKeeper.jsx'),
};
