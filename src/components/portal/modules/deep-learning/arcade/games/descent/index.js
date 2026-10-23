/* Descent — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { LEVEL_NAMES } from '../../content/descent.js';

export default {
  id: 'descent',
  title: 'Descent',
  lectures: [2],
  concepts: [
    'optim.gd', 'optim.momentum', 'optim.nag', 'optim.adagrad', 'optim.rmsprop', 'optim.adam',
    'optim.adamax', 'optim.nadam', 'optim.adamw', 'optim.summary',
    'clip.gradient', 'sched.why', 'sched.power', 'sched.exponential', 'sched.piecewise', 'sched.performance', 'sched.onecycle',
  ],
  blurb: 'Optimiser golf: call the club that makes par, then swing by the slides’ exact update rules.',
  color: '--dlv-green',
  levels: 3,
  levelNames: LEVEL_NAMES,
  glyph: Glyph,
  art: 'cab-descent.png',
  load: () => import('./Descent.jsx'),
};
