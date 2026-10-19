import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import StationMapScene from './scenes/StationMap';
import ProjectFlowScene from './scenes/ProjectFlow';

/* ============================================================================
   PLATES 0·x — overview (under the title cell)
     0·1 The project in one picture   the whole notebook as one animation
     0·2 Five stations, three splits  where the data comes from (Out [2], [3])
   ========================================================================== */

// Out [2] shapes and Out [3] statistics (mean, std in °C)
const COUNTS = { train: 1522, val: 313, test: 297 };
const STATS = {
  train: { min: [12.2, 3.8], max: [24.7, 5.1] },
  val: { min: [14.0, 3.3], max: [24.1, 4.4] },
  test: { min: [11.3, 3.2], max: [22.6, 5.7] },
};

const TITLE = 0;
const LOAD = codeCell('s2', 0); // In [2]
const STATS_CELL = codeCell('s2', 1); // In [3]
const M1_TEST = codeCell('s6', 2); // In [10]
const M2_ROLL = codeCell('s7', 3); // In [14]
const M3_TEST = codeCell('s8', 2); // In [17]
const HORIZON = codeCell('s9', 0); // In [18]
const TRANSFER = codeCell('s9', 1); // In [19]
const VAE_MODEL = codeCell('s11', 0); // In [21]
const SAMPLES = codeCell('s12', 0); // In [23]
const SUMMARY = mdCell('s13', 0); // cell 50

export function ProjectPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('title')}>
      <Row label="Task">
        <p className="dlp2-task">
          Forecast the next 12 months of Perth’s monthly minimum and maximum temperatures from the previous 72 with three GRU models,
          compare two of them over longer horizons on a station they never saw, then train a VAE to make up new maximum-temperature
          sequences.
        </p>
      </Row>
      <Row label="How it works" wide>
        <ProjectFlowScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          The data is five Bureau of Meteorology stations around Perth <R c={TITLE} />, already split by station: three for training,
          Swanbourne for validation and Bickley for the test <R c={mdCell('s2', 0)} />. Every model reads 72 months and forecasts 12. Model 1 predicts all 12
          at once <R c={mdCell('s6', 0)} />, model 2 predicts one month and is rolled forward <R c={mdCell('s7', 0)} />, and model 3
          is a GRU encoder–decoder <R c={mdCell('s8', 0)} />.
        </P>
        <P>
          Section 9 runs models 2 and 3 past part (i)’s 12 months, out to 24 <R c={HORIZON} />, and puts two
          parameter-free baselines on the same scale: seasonal naive repeats the last 12 input months and climatology repeats the station’s
          average year <R c={HORIZON} code />. Part (ii) trains a convolutional VAE that encodes each 84-month maximum sequence as 4
          numbers (codings) <R c={VAE_MODEL} /> and decodes draws from N(0, I) <R c={SAMPLES} code />.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>forecaster</th>
              <th className="num">val · 12 months</th>
              <th className="num">test · 12 months</th>
              <th className="num">test · 24 months</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>model 1 · 12 at once</td><td className="num">0.988</td><td className="num">1.250</td><td className="num">–</td></tr>
            <tr><td>model 2 · 1 month, rolled</td><td className="num">0.982</td><td className="num">1.407</td><td className="num">1.470</td></tr>
            <tr><td>model 3 · encoder–decoder</td><td className="num">1.178</td><td className="num">1.321</td><td className="num">1.457</td></tr>
            <tr><td>seasonal naive</td><td className="num">1.226</td><td className="num">1.235</td><td className="num">1.234</td></tr>
            <tr><td>climatology</td><td className="num">0.967</td><td className="num">0.958</td><td className="num">0.957</td></tr>
          </tbody>
        </table>
        <P>
          MAE in °C. Test, 12 months: <R c={M1_TEST} />, <R c={M2_ROLL} />, <R c={M3_TEST} />; 24 months and the baselines{' '}
          <R c={HORIZON} />; validation <R c={TRANSFER} />; the table is the notebook’s own summary <R c={SUMMARY} />.
        </P>
        <P>
          In the notebook’s words, all three models learn the annual cycle and forecast Swanbourne “about as well as the average of its own
          past six years”, within 0.03 °C for models 1 and 2 (model 3 is 0.2 behind <R c={mdCell('s9', 1)} />). On Bickley they over-predict the maximums by about a degree and finish behind both baselines,
          because they carry the warmth of the training stations with them. Model 3 beat model 2 at every horizon but deteriorated
          faster past the 12 steps it was trained for. The VAE makes smooth, plausibly varied annual cycles at the right level, without
          the month-to-month roughness of real data, and about a fifth of its prior samples are too flat to pass for real{' '}
          <R c={SUMMARY} />.
        </P>
      </Row>
    </Plate>
  );
}

export function StationsPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('title')}>
      <Row label="Task">
        <p className="dlp2-task">Find out which stations supply each split and what each split is used for.</p>
      </Row>
      <Row label="How it works" wide>
        <StationMapScene id="stations" counts={COUNTS} stats={STATS} />
      </Row>
      <Row label="What the notebook did">
        <P>
          The split is fixed by the data file, not chosen in the notebook. The training set comes from three stations on the coastal
          plain, Perth Airport, Jandakot Aero and Perth Metro, and is already shuffled. Swanbourne, right on the coast, is the validation
          set, and Bickley, up in the hills east of the city, is the test set <R c={mdCell('s2', 0)} />.
        </P>
        <P>
          Validation drives every decision that follows: early stopping, the learning rates and the other tuning choices are all made on
          Swanbourne <R c={mdCell('s5', 0)} /> <R src="log" />. Bickley is only used for the reported results, so it measures how well the models
          transfer to a station with a different climate.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          The three training stations give 1522 sequences of 84 months, Swanbourne 313 and Bickley 297, a year longer at 96 months{' '}
          <R c={LOAD} />. The map’s ledger adds each split’s mean ± standard deviation <R c={STATS_CELL} />. Section 2 tabulates the
          shapes (2·1) and the statistics (2·3), and 2·2 looks at what the shapes hide.
        </P>
      </Row>
    </Plate>
  );
}
