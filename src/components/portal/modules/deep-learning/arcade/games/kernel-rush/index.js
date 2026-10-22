/* Kernel Rush — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'kernel-rush',
  title: 'Kernel Rush',
  lectures: [3],
  concepts: [],
  blurb: 'A conv or pooling spec drops onto the input block. Size the output before it lands.',
  color: '--dlv-aqua',
  levels: 3,
  glyph: Glyph,
  load: () => import('./KernelRush.jsx'),
};
