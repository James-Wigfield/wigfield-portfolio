/* Chain Reaction — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'chain-reaction',
  title: 'Chain Reaction',
  lectures: [1],
  concepts: ['perceptron.tlu', 'act.sigmoid', 'act.tanh', 'act.relu', 'backprop.algorithm', 'perceptron.ruleGradient', 'act.derivatives', 'act.why', 'mlp.regression', 'mlp.classification'],
  blurb: 'A tiny MLP as a computation graph: light the forward pass, then fill the gradients backwards before the fuse burns out.',
  color: '--dlv-red',
  levels: 3,
  levelNames: ['forward pass · collapse', 'backprop · the fuse', 'task cards · deeper collapse'],
  glyph: Glyph,
  art: 'cab-chain-reaction.png',
  load: () => import('./ChainReaction.jsx'),
};
