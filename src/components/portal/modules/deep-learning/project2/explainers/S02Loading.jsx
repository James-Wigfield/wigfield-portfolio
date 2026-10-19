import { Plate, Row, R, P } from '../scene/Plate';
import { codeCell, mdCell } from '../nbutil';
import TensorBlockScene from './scenes/TensorBlock';
import WindowsScene from './scenes/Windows';
import ClimatesScene from './scenes/Climates';

/* ============================================================================
   PLATES 2·x — loading the data (cells 3–6)
     2·1 One block of numbers   shapes and axes of the three tensors (Out [2])
     2·2 Windows that overlap   stride-1 windows over one record (Out [3], cell 6)
     2·3 Three climates         mean ± std per split and channel (Out [3])
   ========================================================================== */

const MD_INTRO = mdCell('s2', 0); // cell 3
const LOAD = codeCell('s2', 0); // In [2]
const STATS = codeCell('s2', 1); // In [3]
const MD_DISC = mdCell('s2', 1); // cell 6
const SPLIT = codeCell('s3', 0); // In [4]: X = months 1–72, y = months 73–84 of every window
const PLOT = codeCell('s4', 0); // In [5]: display_temperatures converts a slice to NumPy to plot it
const SAMPLES = codeCell('s12', 0); // In [23]: plot_sequences and the sample statistics, in NumPy

export function TensorPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[MD_INTRO, LOAD]}>
      <Row label="Task">
        <p className="dlp2-task">Load the three splits from the pickle with the brief’s load_data function and find out what shape the data is in.</p>
      </Row>
      <Row label="How it works" wide>
        <TensorBlockScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          load_data unpickles three TensorFlow tensors, one per split, and the notebook keeps them as tensors from here on rather than
          converting to NumPy <R c={MD_INTRO} />, so slicing and averaging are TensorFlow operations everywhere except the plotting helpers and
          the VAE sample statistics, which convert to NumPy: the plotted rows, and for the statistics the 500 samples and all 1522
          training maximum sequences <R c={PLOT} code /> <R c={SAMPLES} code />. The statistics cell
          confirms the type: every split is an EagerTensor of float32 <R c={STATS} />.
        </P>
        <P>
          Reading a shape is reading the axes in order. Axis 0 counts sequences, axis 1 counts the months in each sequence, and axis 2
          holds the two channels, index 0 the monthly mean minimum and index 1 the monthly mean maximum, both in °C{' '}
          <R c={MD_INTRO} />. Averaging over axes 0 and 1 together, as the next cell does <R c={STATS} code />, collapses every sequence and
          every month and leaves one value per channel <R c={STATS} />.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>tensor</th>
              <th>shape</th>
              <th>station</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>train_seq</td><td>(1522, 84, 2)</td><td>Perth Airport, Jandakot Aero, Perth Metro · shuffled</td></tr>
            <tr><td>val_seq</td><td>(313, 84, 2)</td><td>Swanbourne</td></tr>
            <tr><td>test_seq</td><td>(297, 96, 2)</td><td>Bickley</td></tr>
          </tbody>
        </table>
        <P>
          Shapes as printed <R c={LOAD} />. The test sequences are 12 months longer than the others. Those extra months only enter the
          descriptive statistics in the next cell and the longer horizons in section 9; no model sees them before then <R c={MD_INTRO} />.
        </P>
      </Row>
    </Plate>
  );
}

export function WindowsPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[STATS, MD_DISC]}>
      <Row label="Task">
        <p className="dlp2-task">Work out how the sequences relate to each other before treating them as samples.</p>
      </Row>
      <Row label="How it works" wide>
        <WindowsScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          The second half of the statistics cell compares every row with the next one. <code>test_seq[1:, :-1]</code> is every row but the
          first, without its last month; <code>test_seq[:-1, 1:]</code> is every row but the last, without its first month. If each row is
          the previous one moved along by a month, the two are equal element for element, and <code>tf.reduce_all</code> turns the whole
          comparison into a single True or False <R c={STATS} code />. It prints True for the validation set and for the test set{' '}
          <R c={STATS} />.
        </P>
        <P>
          With the record lengths from the brief, the counts follow: 396 − 84 + 1 = 313 validation rows from Swanbourne and
          392 − 96 + 1 = 297 test rows from Bickley. Perth Airport (987 months) and Jandakot Aero (392) give 904 and 309 windows of 84
          months, and 904 + 309 + 309 = 1522 is exactly the training count, so Perth Metro must have 392 months as well{' '}
          <R c={MD_DISC} />. The training set cannot be checked the same way because it is shuffled, but the data checks behind the
          notebook found that 1519 of its 1522 rows have a twin shifted by one month, which is three window series <R src="log" />.
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">True</span><span className="dlp2-fignum__k">val windows overlap <R c={STATS} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">True</span><span className="dlp2-fignum__k">test windows overlap <R c={STATS} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">≈1770</span><span className="dlp2-fignum__k">distinct training months · 987 + 392 + 392 = 1771 <R c={MD_DISC} /></span></div>
        </div>
        <P>
          None of the sets is a collection of independent samples. A test MAE is the error over one station’s history rather than over 297
          separate cases, and the 1522 training rows hold about 1770 distinct months (987 + 392 + 392 = 1771) <R c={MD_DISC} />. Every
          target month is scored in up to 12 windows: each window’s targets are its months 73 to 84 <R c={SPLIT} code /> and
          consecutive windows start a month apart, the same count the notebook gives for the training records <R c={mdCell('s6', 0)} />.
          So the 297 test windows are one 392-month record seen many times, and small differences between models carry less weight than
          297 separate cases would give them.
        </P>
        <P>
          Shuffling reorders whole rows and
          never the months inside one, so “sequence 566” in a section 4 plot title is a row number in the shuffled block, and a plot’s
          month axis counts positions in the window: not a date, and not a calendar month.
        </P>
        <P>
          The overlap has an upside the notebook points out: consecutive windows start one month apart, so the 12 target months can begin
          anywhere in the annual cycle, which gives the models useful variety <R c={MD_DISC} />.
        </P>
      </Row>
    </Plate>
  );
}

export function ClimatesPlate({ meta }) {
  return (
    <Plate meta={meta} cells={[STATS, MD_DISC]}>
      <Row label="Task">
        <p className="dlp2-task">Compare the three splits’ temperatures before any modelling, to know what the models will be asked to transfer to.</p>
      </Row>
      <Row label="How it works" wide>
        <ClimatesScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          For each split the cell takes <code>tf.reduce_mean</code> and <code>tf.math.reduce_std</code> over axes 0 and 1, every sequence
          and every month at once <R c={STATS} code />, and prints a mean and a standard deviation per channel to one decimal{' '}
          <R c={STATS} />.
        </P>
        <P>
          Because the standard deviation is taken over all months together, most of it is the annual cycle: summer maximums of 30 to 35
          degrees against winter ones of 15 to 19 <R c={mdCell('s4', 1)} />, so a bigger spread here mostly means a bigger swing between
          summer and winter, not a more erratic station. The notebook still reads Swanbourne’s smaller spread (4.4 against 5.1 on the
          maximums) as making its next month easier to predict <R c={mdCell('s7', 1)} /> (plate 7·1), and puts that smaller spread down to
          the sea moderating its temperatures <R c={MD_DISC} />. Why it should help is this explainer’s reading, not the notebook’s: a forecast
          slightly off in timing or size misses by fewer degrees when the summer–winter swing is smaller.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>split</th>
              <th>station</th>
              <th className="num">min °C</th>
              <th className="num">max °C</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>train</td><td>Airport, Jandakot, Metro</td><td className="num">12.2 ± 3.8</td><td className="num">24.7 ± 5.1</td></tr>
            <tr><td>val</td><td>Swanbourne</td><td className="num">14.0 ± 3.3</td><td className="num">24.1 ± 4.4</td></tr>
            <tr><td>test</td><td>Bickley</td><td className="num">11.3 ± 3.2</td><td className="num">22.6 ± 5.7</td></tr>
          </tbody>
        </table>
        <P>
          Mean ± standard deviation as printed <R c={STATS} />. Bickley is cooler on both channels and its maximums swing more; Swanbourne’s
          minimums are warmer and both its channels vary less. A model trained on the three training stations therefore has to
          extrapolate a little to predict Bickley <R c={MD_DISC} />.
        </P>
        <P>
          That is what section 9 finds. Bickley’s maximums average 2.1 °C cooler than the training stations’, and all three models
          over-predict them by 0.8 to 1.2 °C on average, while the two baselines, which copy the station’s own past, have almost no bias{' '}
          <R c={mdCell('s9', 1)} />.
        </P>
      </Row>
    </Plate>
  );
}
