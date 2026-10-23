/* Boundary Bash — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'boundary-bash',
  title: 'Boundary Bash',
  lectures: [1],
  concepts: [],
  blurb: 'Apply the perceptron learning rule to keep the boundary separating incoming points; XOR needs a hidden layer.',
  color: '--dlv-yellow',
  levels: 3,
  glyph: Glyph,
  art: 'cab-boundary-bash.png',
  load: () => import('./BoundaryBash.jsx'),
};
