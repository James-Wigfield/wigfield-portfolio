/* Bottleneck — the manifest (frozen contract, tools/dl-arcade/PLAN.md). Lecture 5 only.
   levelNames mirror content/bottleneck.js LEVELS (kept here so the hub doesn't load the content). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'bottleneck',
  title: 'Bottleneck',
  lectures: [5],
  concepts: ['pca.linearAe', 'ae.symmetric', 'params.tied', 'tied.index', 'ae.oneAtATime', 'ae.trainAutoencoderFn', 'pretrain.ae', 'ae.tsne'],
  blurb: 'Tilt the plane through the cloud, build and tie the sandwich, order the training, drop items on the t-SNE map.',
  color: '--dlv-violet',
  levels: 3,
  levelNames: ['the four stages', 'tie the weights · pretraining', 'deeper stacks · decoys'],
  glyph: Glyph,
  art: 'cab-bottleneck.png',
  load: () => import('./Bottleneck.jsx'),
};
