/* The Long Short-Term Line — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'long-line',
  title: 'The Long Short-Term Line',
  lectures: [4],
  concepts: [
    'rnn.neuron', 'rnn.memoryCell', 'rnn.equations', 'rnn.discardedOutputs', 'rnn.longSeq', 'rnn.bptt',
    'lstm.cell', 'lstm.gates', 'lstm.equations', 'gru.cell', 'gru.update',
  ],
  blurb: 'Run a memory cell as a train: set the gates so early cargo arrives many stations later.',
  color: '--dlv-magenta',
  levels: 3,
  levelNames: ['SimpleRNN · the fade', 'LSTM · f, i, o', 'GRU · z, r'],
  glyph: Glyph,
  art: 'cab-long-line.png',
  load: () => import('./LongLine.jsx'),
};
