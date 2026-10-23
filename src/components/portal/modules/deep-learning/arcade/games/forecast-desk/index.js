/* Forecast Desk — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'forecast-desk',
  title: 'Forecast Desk',
  lectures: [4],
  concepts: [
    'forecast.naive', 'forecast.mae', 'forecast.windowing', 'forecast.split', 'forecast.linear', 'forecast.simpleRnn1',
    'rnn.input3d', 'forecast.univar', 'rnn.deep', 'forecast.multivariate', 'forecast.multiOutput', 'forecast.multiStep',
    'forecast.oneStepLoop', 'forecast.aheadModel', 'forecast.seq2seq', 'forecast.leaderboard',
  ],
  blurb: 'Bus/rail forecasting: copy last week, score MAE and MAPE, window the series, then beat the 7-day baseline.',
  color: '--dlv-blue',
  levels: 3,
  levelNames: ['Naive baseline · MAE, MAPE', 'Windows · linear vs RNN', 'Multivariate · multi-step'],
  glyph: Glyph,
  art: 'cab-forecast-desk.png',
  load: () => import('./ForecastDesk.jsx'),
};
