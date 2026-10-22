/* Chain Reaction — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'chain-reaction',
  title: 'Chain Reaction',
  lectures: [1],
  concepts: [],
  blurb: 'A tiny MLP as a computation graph: light the forward pass, fill the gradients before the fuse burns out.',
  color: '--dlv-red',
  levels: 3,
  glyph: Glyph,
  load: () => import('./ChainReaction.jsx'),
};
