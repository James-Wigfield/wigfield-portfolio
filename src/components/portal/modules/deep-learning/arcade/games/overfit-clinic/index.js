/* Overfit Clinic — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'overfit-clinic',
  title: 'Overfit Clinic',
  lectures: [1, 2, 3, 4, 5, 6, 8],
  concepts: [
    'reg.earlyStopping', 'reg.l1l2', 'reg.dropout', 'reg.dataAugmentation', 'optim.learningRate', 'sched.why', 'optim.batchSize',
    'init.vanishing', 'init.glorot', 'init.which', 'act.relu', 'act.which', 'act.leakyRelu', 'bn.algorithm', 'clip.gradient',
    'optim.adagrad', 'optim.rmsprop', 'transfer.reuse', 'transfer.freeze', 'arch.typical', 'forecast.simpleRnn1', 'forecast.univar',
    'rnn.deep', 'rnn.longSeq', 'rnn.layerNorm', 'lstm.cell', 'gru.cell', 'ae.stacked', 'gan.modeCollapse', 'gan.instability',
    'dcgan.guidelines', 'transformer.mask', 'encdec.finalState', 'attn.weightedSum', 'transformer.scaling', 'transformer.sdpa',
    'encdec.causal', 'encdec.bidirectional',
  ],
  blurb: 'Diagnose a sick model from its curves, summary or samples and prescribe the fix the slides name. The exam boss.',
  color: '--dlv-red',
  levels: 3,
  levelNames: ['diagnose', 'diagnose + prescribe', 'multi-step cases'],
  glyph: Glyph,
  art: 'cab-overfit-clinic.png',
  load: () => import('./OverfitClinic.jsx'),
};
