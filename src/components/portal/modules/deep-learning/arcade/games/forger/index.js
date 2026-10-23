/* Forger — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { LEVEL_NAMES } from '../../content/forger.js';

export default {
  id: 'forger',
  title: 'Forger',
  lectures: [6],
  concepts: [
    'gan.phase1', 'gan.phase2', 'gan.trainLoop', 'gan.idea', 'gan.keras', 'gan.nash', 'gan.modeCollapse', 'gan.instability',
    'dcgan.guidelines', 'dcgan.keras', 'dcgan.vsGuidelines', 'bn.dcgan',
  ],
  blurb: 'Run a GAN’s two training phases in the right order, spot mode collapse in a live run, build a DCGAN by the slide-28 rules.',
  color: '--dlv-magenta',
  levels: 3,
  levelNames: LEVEL_NAMES,
  glyph: Glyph,
  art: 'cab-forger.png',
  load: () => import('./Forger.jsx'),
};
