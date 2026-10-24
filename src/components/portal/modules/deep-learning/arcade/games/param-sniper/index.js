/* Param Sniper — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'param-sniper',
  title: 'Param Sniper',
  lectures: [1, 2, 3, 4, 5, 6, 8],
  concepts: ['params.dense', 'params.conv2d', 'params.convT', 'params.conv1d', 'params.pool', 'bn.params', 'params.simpleRnn', 'params.lstm', 'params.gru', 'params.bidirectional', 'params.tied', 'params.mha', 'shape.conv2d', 'shape.pool', 'shape.flatten', 'rnn.deep'],
  blurb: 'Layer specs fly in. Count the parameters (and size the output) before they reach the line.',
  color: '--dlv-blue',
  levels: 3,
  levelNames: ['single layers · 4 choices', 'keypad · stacks · shapes', 'model.summary()'],
  glyph: Glyph,
  art: 'cab-param-sniper.png',
  load: () => import('./ParamSniper.jsx'),
};
