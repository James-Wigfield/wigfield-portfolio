/* Forecast Desk — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'forecast-desk',
  title: 'Forecast Desk',
  lectures: [4],
  concepts: [],
  blurb: 'Bus/rail forecasting: naive baseline, MAE/MAPE, windowing, linear vs RNN, multi-step strategies. Beat the baseline.',
  color: '--dlv-blue',
  levels: 3,
  glyph: Glyph,
  art: 'cab-forecast-desk.png',
  load: () => import('./ForecastDesk.jsx'),
};
