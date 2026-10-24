/* Boundary Bash — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { LEVEL_NAMES } from '../../content/boundary-bash.js';

export default {
  id: 'boundary-bash',
  title: 'Boundary Bash',
  lectures: [1],
  concepts: ['perceptron.tlu', 'perceptron.step', 'perceptron.hebb', 'perceptron.rule', 'perceptron.boundary', 'perceptron.sklearn', 'perceptron.vsLogistic', 'perceptron.xor', 'mlp.xor'],
  blurb: 'Apply the Perceptron learning rule to keep one TLU’s boundary separating the incoming points; XOR needs a hidden layer.',
  color: '--dlv-yellow',
  levels: 3,
  levelNames: LEVEL_NAMES,
  glyph: Glyph,
  art: 'cab-boundary-bash.png',
  load: () => import('./BoundaryBash.jsx'),
};
