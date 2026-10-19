import { Plate, Row, R, P } from '../scene/Plate';
import { codeCell, mdCell } from '../nbutil';
import BaselinesScene from './scenes/Baselines';
import HorizonScene from './scenes/Horizon';
import LeadMonthsScene from './scenes/LeadMonths';
import BiasScene from './scenes/Bias';

/* ============================================================================
   PLATES 9·1–9·4 — comparing models 2 and 3 over longer horizons  (§9)
   9·1 the two baselines, built from a real test window
   9·2 MAE against horizon (Out [18])
   9·3 lead months on the notebook's own figure (Out [19]) against horizons
   9·4 per-channel bias: why every model loses at Bickley (Out [19], cell 39)
   Every number is printed in Out [3], [8], [18], [19] or written in cells 36
   and 39; the lead-month values are cell 39's own readings of its figure.
   ========================================================================== */

const C_BASE = codeCell('s9', 0); // In [18]: baselines, MAE by horizon
const C_LEAD = codeCell('s9', 1); // In [19]: lead months, val vs test, bias
const M_INTRO = mdCell('s9', 0); // cell 36
const M_DISC = mdCell('s9', 1); // cell 39
const C_STATS = codeCell('s2', 1); // Out [3]: per-split means
const C_M1SUM = codeCell('s6', 0); // Out [8]: model 1 summary
const M_M1TEST = mdCell('s6', 2); // cell 21: model 1 on the test set, Bickley's winters
const M_SUMMARY = mdCell('s13', 0); // cell 50

/* ── 9·1 ─────────────────────────────────────────────────────────────── */

export function BaselinesPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[M_INTRO, C_BASE]}>
      <Row label="Task">
        <p className="dlp2-task">
          Give the horizon comparison a scale. The brief does not ask for baselines; section 9 adds two that have no parameters
          and see only each test window’s own 72 input months.
        </p>
      </Row>
      <Row label="How it works" wide>
        <BaselinesScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>seasonal_naive</code> takes <code>X[:, -12:]</code>, the last 12 input months, and tiles them along the time axis.{' '}
          <code>-(-n_steps // 12)</code> is ceiling division, so a 15-, 18- or 21-month horizon gets two copies and{' '}
          <code>[:, :n_steps]</code> trims the spare months. <R c={C_BASE} code /> Lead month k is the k-th month after the input, so
          lead month 1 is month 73 and lead month 24 is month 96. Cell 36 calls seasonal naive “the same month one year earlier”,
          which holds for lead months 1–12; from lead month 13 the copy is two years old. <R c={M_INTRO} />
        </P>
        <P>
          <code>climatology</code> reshapes each window from (72, 2) to (6, 12, 2): six years of 12 months. That only lines up
          because 72 = 6 × 12, so input month i and month i + 12 are always the same calendar month, whatever month the window starts
          in. Slot 1 is the window’s first calendar month, not January. <code>reduce_mean(axis=1)</code> averages the six years into
          one (12, 2) average year, and the same tile-and-trim stretches it to the horizon. <R c={C_BASE} code />
        </P>
        <P>
          Both functions take exactly the X that models 2 and 3 get, so the comparison is fair: both see only the window the models
          see. <R c={M_INTRO} />
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>baseline</th>
              <th className="num">val · 12 mo</th>
              <th className="num">test · 12 mo</th>
              <th className="num">test · 24 mo</th>
              <th className="num">min MAE / bias</th>
              <th className="num">max MAE / bias</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>seasonal naive</td><td className="num">1.226</td><td className="num">1.235</td><td className="num">1.234</td><td className="num">1.04 / −0.05</td><td className="num">1.43 / −0.06</td></tr>
            <tr><td>climatology</td><td className="num">0.967</td><td className="num">0.958</td><td className="num">0.957</td><td className="num">0.82 / −0.10</td><td className="num">1.10 / −0.11</td></tr>
          </tbody>
        </table>
        <P>
          MAE in °C; 12-month and per-channel columns from <R c={C_LEAD} />, 24-month column from <R c={C_BASE} />. Climatology is
          the stronger of the two on both stations. A copied year brings that one year’s weather into the forecast; an average of six
          years cancels most of it, leaving the station’s smooth seasonal shape.
        </P>
        <P>
          Neither baseline drifts with the horizon (1.231–1.235 and 0.957–0.959 from 12 to 24 months) <R c={C_BASE} />, and the
          tuning log had set the bar before any model trained: to beat a trivial climatology a GRU needs better than about 0.96 °C on
          the test set. <R src="log" />
        </P>
      </Row>
    </Plate>
  );
}

/* ── 9·2 ─────────────────────────────────────────────────────────────── */

const HZ_SERIES = [
  { key: 'sn', label: 'seasonal naive', note: '1.231–1.235', style: 'dashed', marker: 'filled', stroke: 'var(--dlp2-base)', values: [1.235, 1.233, 1.231, 1.232, 1.234], beat: 0 },
  { key: 'cl', label: 'climatology', note: '0.957–0.959', style: 'dotted', marker: 'hollow', stroke: 'var(--ink-2)', values: [0.958, 0.959, 0.958, 0.958, 0.957], beat: 0 },
  {
    key: 'm2', label: 'model 2', note: '+0.063', cls: 'sv-m2', fill: 'sv-fm2', values: [1.407, 1.422, 1.452, 1.468, 1.47], beat: 1,
    marks: { 0: 'above', 4: 'above' }, rise: { x: 38 }, labelDy: -6, shape: 'square', nudge: { 4: -2 },
  },
  {
    key: 'm3', label: 'model 3', note: '+0.136', cls: 'sv-m3', fill: 'sv-fm3', values: [1.321, 1.343, 1.374, 1.417, 1.457], beat: 2,
    // 1.321 sits left of its point: below it, it landed just above model 1's 1.250 dot
    marks: { 0: 'left', 4: 'below' }, rise: { x: 30 }, labelDy: 9, nudge: { 4: 2 },
  },
];
// on the h = 12 column, just above seasonal naive's 1.235; its label sits below right on a leader
const HZ_POINT = { label: 'model 1', note: 'its output is fixed at 12 months', h: 12, value: 1.25, fill: 'sv-fm1', beat: 3 };
const HZ_BEATS = [
  {
    t: 'Two baselines for scale',
    c: 'Each point is the mean error over lead months 1 to h, not the error at lead month h. Seasonal naive and climatology barely move: 1.231–1.235 and 0.957–0.959 °C.',
    fx: 1,
  },
  { t: 'Model 2', c: 'Rolled forward one month at a time, model 2 goes from 1.407 at 12 months to 1.470 at 24, a rise of 0.063.', fx: 1 },
  { t: 'Model 3', c: 'Model 3 starts well ahead at 1.321 but rises 0.136 to 1.457, so by 24 months it has nearly lost its lead.', fx: 1 },
  { t: 'Model 1 stops at 12', c: 'Model 1 has no longer horizons, only its 12-month 1.250. Every model sits above both baselines at every horizon.', fx: 0 },
];

export function HorizonsPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[C_BASE, M_DISC]}>
      <Row label="Task">
        <p className="dlp2-task">
          Evaluate models 2 and 3 on the test set at (72 input months, 15 target months), (72, 18), (72, 21) and (72, 24) as well as (72, 12), without
          retraining, plot MAE against horizon, and say which deteriorates fastest. <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <HorizonScene id="horizons" series={HZ_SERIES} point={HZ_POINT} beats={HZ_BEATS} />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>HORIZONS = [12, 15, 18, 21, 24]</code>. For each h, <code>split_sequences(test_seq, 72, h)</code> cuts the same 72
          input months and the h months after them, which for h = 24 is all 96. The brief’s “simple loop of function calls” is
          exactly that: one loop, four forecasters. <R c={C_BASE} code />
        </P>
        <P>
          Model 2 runs through <code>predict_recursively</code> for h steps, its 72-month window sliding on over its own forecasts.
          Model 3 runs through <code>predict_encoder_decoder</code> for h decoder steps. Nothing is retrained <R c={M_INTRO} />, so
          from lead month 13 on model 3’s decoder is running further than it ever ran in training. <R c={M_DISC} />
        </P>
        <P>
          Model 1 is not in the comparison, as the brief intends: its <code>Dense(24)</code> and <code>Reshape((12, 2))</code> fix the
          output at 12 months, so going further would need a new output layer and new training. <R c={C_M1SUM} />
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th className="num">horizon</th>
              <th className="num">model 2</th>
              <th className="num">model 3</th>
              <th className="num">seasonal naive</th>
              <th className="num">climatology</th>
            </tr>
          </thead>
          <tbody>
            {[
              [12, '1.407', '1.321', '1.235', '0.958'],
              [15, '1.422', '1.343', '1.233', '0.959'],
              [18, '1.452', '1.374', '1.231', '0.958'],
              [21, '1.468', '1.417', '1.232', '0.958'],
              [24, '1.470', '1.457', '1.234', '0.957'],
            ].map(([h, ...v]) => (
              <tr key={h}>
                <td className="num">{h}</td>
                {v.map((x, i) => <td key={i} className="num">{x}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          Test MAE in °C, <R c={C_BASE} />. Model 3 deteriorates faster: +0.136 from 12 to 24 months against model 2’s +0.063, so it
          “starts well ahead and has nearly lost its lead by 24 months”. That is the notebook’s answer to the brief’s first
          question. <R c={M_DISC} />
        </P>
        <P>
          The models sit above both baseline lines at every horizon. And each point is an average over lead months 1 to h, so a rise of
          0.136 by 24 months hides much worse final months; the next plate takes the average apart. <R c={M_DISC} />
        </P>
      </Row>
    </Plate>
  );
}

/* ── 9·3 ─────────────────────────────────────────────────────────────── */

export function LeadMonthsPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[C_LEAD, M_DISC]}>
      <Row label="Task">
        <p className="dlp2-task">
          Find where the horizon error comes from: the error at each lead month of the 24-month horizon. <R c={M_INTRO} />
        </p>
      </Row>
      <Row label="How it works" wide>
        <LeadMonthsScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>tf.reduce_mean(tf.abs(y_24 - y_hat), axis=(0, 2))</code> averages the absolute error over the 297 windows (axis 0)
          and both channels (axis 2) but keeps the 24 lead months apart: one number per lead month for each model and baseline. The grey
          line at 12.5 marks the end of part (i)’s 12-month targets. <R c={C_LEAD} code />
        </P>
        <P>
          A horizon MAE is the mean of the first h of these points. Every horizon run starts from the same 72 input months and both
          models forecast one month at a time, so a 15-month forecast is the first 15 lead months of the 24-month one, and every lead
          month carries the same weight in the MAE. That is why the band and the strip in the diagram{' '}
          <span className="dlp2-screen">move together.</span>
          <span className="dlp2-print">are drawn together, at the same months.</span> <R c={C_BASE} code />
        </P>
        <P>
          The lead-month values were never printed. The lead-month numbers on this plate are the notebook’s own readings of its figure, and the
          overlays sit on the real figure, placed by its axes. <R c={M_DISC} />
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.10 · 1.19</span><span className="dlp2-fignum__k">lead month 1 · model 3, model 2 <R c={M_DISC} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">≈ 1.75</span><span className="dlp2-fignum__k">model 3 at lead month 22 <R c={M_DISC} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">19</span><span className="dlp2-fignum__k">model 3 worse from lead month <R c={M_DISC} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.457 · 1.470</span><span className="dlp2-fignum__k">24-month MAE · model 3, model 2 <R c={C_BASE} /></span></div>
        </div>
        <P>
          Model 3 starts lower, which the notebook guesses is its two-layer state carrying more than model 2’s single Dense
          readout. Its error climbs to about 1.4 by lead month 12, holds for a few lead months, then rises steeply. Its decoder
          trained for 12 steps, so lead months 13 to 24 push the hidden state past anything it saw in training, and that is where the
          error grows fastest. <R c={M_DISC} />
        </P>
        <P>
          Model 2 rises over the first six lead months to about 1.48, then wobbles between about 1.4 and 1.6 with a 12-month rhythm.
          Its sliding window keeps feeding it 72 months of plausible data, so it settles into repeating a slightly wrong year instead
          of drifting away. <R c={M_DISC} /> Both baselines stay flat
          across all 24 lead months. <R c={C_LEAD} />
        </P>
        <P>
          The two are level around lead months 11 to 13. So “model 3 beat model 2 at every horizon” <R c={M_SUMMARY} /> and “from
          [lead] month 19 on model 3 is the worse of the two” are both true. Cell 39 sums it up as “its lead in the cumulative MAE at
          24 months is only what it banked in the first year”. <R c={M_DISC} /> On its figure model 3 is also the lower line over lead
          months 14–18, so the lead it keeps was banked before lead month 19, not in the first year alone. <R c={C_LEAD} />
        </P>
        <P>
          This explainer adds a caution the notebook doesn’t: the 24-month gap is 0.013 °C from one seed, over one station’s
          overlapping windows, and model 3’s validation MAE spanned 1.09 to 1.25 across five tuning seeds (plate 8·3), so that
          ordering could flip. The faster deterioration, +0.136 against +0.063 <R c={M_DISC} />, is the sturdier finding.
        </P>
      </Row>
    </Plate>
  );
}

/* ── 9·4 ─────────────────────────────────────────────────────────────── */

const BIAS_ROWS = [
  ['model 1', '0.79', '−0.08', '1.71', '+0.81'],
  ['model 2', '0.97', '+0.47', '1.84', '+1.14'],
  ['model 3', '0.87', '−0.08', '1.77', '+1.20'],
  ['seasonal naive', '1.04', '−0.05', '1.43', '−0.06'],
  ['climatology', '0.82', '−0.10', '1.10', '−0.11'],
];

export function BiasPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[C_LEAD, M_DISC]}>
      <Row label="Task">
        <p className="dlp2-task">
          Answer the brief’s second question: how well do patterns learned at three stations carry over to a station the models
          never saw? <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <BiasScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          For each forecaster the second half of the cell prints the 12-month MAE on validation and test, then each channel’s test
          MAE and bias, where bias is <code>tf.reduce_mean(y_test_hat - y_test, axis=(0, 1))</code>: the mean signed error over
          windows and months, predicted minus actual. It has nothing to do with the bias vector inside a Dense layer.{' '}
          <R c={C_LEAD} code />
        </P>
        <P>
          Bias and MAE answer different questions. MAE averages the size of every error; bias lets warm and cold errors cancel, so
          it only shows a consistent lean. An MAE can never be smaller than the size of the bias, so a lean of a degree puts a floor
          under the error however well the shape is caught.
        </P>
        <P>
          The station levels come from section 2: Bickley’s maximums average 22.6 °C against 24.7 in the training set, its minimums
          11.3 against 12.2. <R c={C_STATS} />
        </P>
      </Row>
      <Row label="What came out">
        <P>
          Swanbourne’s maximums average 24.1 °C, only 0.6 below the training stations’ <R c={C_STATS} />, and models 1 and 2 match
          climatology on validation: 0.988 and 0.982 against 0.967, with model 3 0.2 behind at 1.178 <R c={C_LEAD} />. On this
          explainer’s reading, the maximum level the models learned fits there. None of the three beats climatology because, once the annual cycle is right, what is left is
          mostly month-to-month noise, which the tuning log names as the limit <R src="log" />. At Bickley the level itself is
          wrong, and that lean is the bias below. <R c={M_DISC} />
        </P>
        <P>
          Swanbourne’s minimums, though, are 1.8 °C warmer than the training stations’ <R c={C_STATS} />, and its validation MAEs are
          still fine; the notebook printed no validation bias, so this explainer can’t say whether they lean. One reading, this
          explainer’s: warmer minimums stay inside the range the training stations reach in summer, while Bickley’s winter maximums
          fall below anything in training (plate 6·2).
        </P>
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>test, 12 months</th>
              <th className="num">min MAE</th>
              <th className="num">min bias</th>
              <th className="num">max MAE</th>
              <th className="num">max bias</th>
            </tr>
          </thead>
          <tbody>
            {BIAS_ROWS.map(([k, ...v]) => (
              <tr key={k}>
                <td>{k}</td>
                {v.map((x, i) => <td key={i} className="num">{x}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          MAE and bias in °C, <R c={C_LEAD} />. The 12-month MAE is the mean of the two channel MAEs: model 1’s (0.79 + 1.71) / 2 =
          1.25, climatology’s (0.82 + 1.10) / 2 = 0.96. On the minimums models 1 and 3 are level with climatology, with MAEs of 0.79
          and 0.87 against 0.82 and a bias of only −0.08 <R c={M_DISC} />, so nearly all of their gap is in the maximums, where model
          3’s +1.20 lean alone is more than climatology’s entire maximum-channel error of 1.10. <R c={C_LEAD} />
        </P>
        <P>
          Bickley’s minimums are only 0.9 °C cooler than the training stations’ <R c={C_STATS} />; the notebook does not say why the
          minimums transfer better.
        </P>
        <P>
          The maximum channel is where the models lose. They over-predict by 0.8 to 1.2 °C, and their maximum MAEs of 1.7 to 1.85 sit
          far above climatology’s 1.10. <R c={M_DISC} /> Bickley’s maximums average 2.1 °C cooler than the training stations’, and
          the models’ lean is not spread evenly over the year. In the plots they get Bickley’s summer peaks about right and stay too
          warm in its winters, which plate 6·2 shows are cooler than anything in the training set. <R c={M_M1TEST} />{' '}
          Averaged over the year, the lean is about half the 2.1 °C gap; the notebook reads that as the models taking about half of
          the difference from the input window and filling in the rest from what they learned at the training stations. The
          baselines copy the station’s own history and have no bias to speak of. Model 2 is the worst case, with a bias on both
          channels, which the notebook puts down to its errors compounding through the recursion. <R c={M_DISC} />
        </P>
        <P>
          The notebook calls this a limit of the design rather than of the training: the models get absolute temperatures and must
          infer a station’s level from 72 months, and the three training stations cover a narrow band of levels, so a cooler
          station is extrapolation. The fix it names is to predict each month’s deviation from the input window’s own average year
          and add that year back, which would make the models level-invariant and give them climatology as a starting point. It
          was not switched on because the test set would have made the decision. <R c={M_DISC} />
        </P>
      </Row>
    </Plate>
  );
}
