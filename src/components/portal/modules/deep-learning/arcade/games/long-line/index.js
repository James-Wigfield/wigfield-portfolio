/* The Long Short-Term Line — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'long-line',
  title: 'The Long Short-Term Line',
  lectures: [4],
  concepts: [],
  blurb: 'Run a memory cell as a train: set the gates so early cargo arrives many stations later.',
  color: '--dlv-magenta',
  levels: 3,
  glyph: Glyph,
  load: () => import('./LongLine.jsx'),
};
