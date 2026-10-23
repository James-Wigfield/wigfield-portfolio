/* Signal Keeper — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'signal-keeper',
  title: 'Signal Keeper',
  lectures: [2],
  concepts: [],
  blurb: 'Keep the activations and gradients healthy through a deep stack: pick the init, the activation, BatchNorm and clipping.',
  color: '--dlv-aqua',
  levels: 3,
  glyph: Glyph,
  art: 'cab-signal-keeper.png',
  load: () => import('./SignalKeeper.jsx'),
};
