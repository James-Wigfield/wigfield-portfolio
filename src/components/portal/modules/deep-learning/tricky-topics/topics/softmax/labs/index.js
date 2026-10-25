/* Topic 3's labs by key (topic.js names them in hero, steps' play, drill). */
import { SoftmaxHero } from './SoftmaxHero';
import { SharesLab } from './SharesLab';
import { ByHandLab } from './ByHandLab';
import { VsLab } from './VsLab';
import { LossLab } from './LossLab';
import { AttnLab } from './AttnLab';
import { LastLab } from './LastLab';
import { SoftmaxDrill } from './SoftmaxDrill';

export const LABS = {
  hero: SoftmaxHero,
  shares: SharesLab, // 1 · what softmax does
  byhand: ByHandLab, // 2 · the formula, by hand
  vs: VsLab, // 3 · softmax or sigmoid?
  loss: LossLab, // 4 · cross-entropy and argmax
  attn: AttnLab, // 5 · attention
  last: LastLab, // 6 · the last layer
  drill: SoftmaxDrill,
};
