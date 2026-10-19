import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import GruCellScene from './scenes/GruCell';
import UnrollScene, { Seq95Scene } from './scenes/Unroll';

/* ============================================================================
   PLATES 6·x — model 1  (§6, cells 16–21)
   6·1 what one GRU cell computes each month and where the 3,000 parameters
       sit (Out [8]); 6·2 the whole model unrolled over one window, with the
       shapes from the summary, then training and test results.
   ========================================================================== */

const SUMMARY = 17; // In [8]  model1.summary()
const HELPERS = 15; // In [7]  build_gru_model, train_model
const HELPERS_MD = 14;

export function GruPlate({ meta }) {
  const md = mdCell('s6', 0); // cell 16
  return (
    <Plate meta={meta} cells={[md, SUMMARY]}>
      <Row label="Task">
        <p className="dlp2-task">
          Model 1: two GRU layers of 16 units read 72 months of minimum and maximum temperatures, and the model forecasts the next 12
          months in one go.
        </p>
      </Row>
      <Row label="How it works" wide>
        <GruCellScene id="m1-gru" units={16} act="tanh" inputs={2} />
      </Row>
      <Row label="What the notebook did">
        <P>
          Both layers are <code>GRU(16, activation=&quot;tanh&quot;)</code>, the first with <code>return_sequences=True</code> so the second
          gets a state for every month <R c={HELPERS} code />. The gates keep Keras’s default sigmoid. Tanh is also the default for the
          candidate, and the only choice that runs on cuDNN: a ReLU GRU matched it within seed noise on
          scaled inputs but took about 20 seconds per epoch instead of one <R c={HELPERS_MD} />. Sixteen units is the most the brief
          suggests; 8 units did worse, about 1.4 °C validation MAE against 1.0 <R c={md} />.
        </P>
        <P>
          Gating is what lets a unit hold a value, such as the station’s level, across all 72 months: with z near 1 the old state passes
          through almost unchanged, and so does its gradient. A plain RNN rewrites its whole state every month, and over 72 steps its
          gradients fade.
        </P>
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>layer</th>
              <th className="num">inputs per unit</th>
              <th>count</th>
              <th className="num">Param #</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>gru</td><td className="num">2</td><td>3 × (16·2 + 16² + 2·16) = 3 × 320</td><td className="num">960</td></tr>
            <tr><td>gru_1</td><td className="num">16</td><td>3 × (16·16 + 16² + 2·16) = 3 × 544</td><td className="num">1,632</td></tr>
            <tr><td>dense</td><td className="num">16</td><td>16·24 weights + 24 biases</td><td className="num">408</td></tr>
            <tr><td>normalization ×2, reshape</td><td className="num" /><td>fixed mean and variance, no weights</td><td className="num">0</td></tr>
            <tr><td>total</td><td className="num" /><td /><td className="num">3,000</td></tr>
          </tbody>
        </table>
        <P>
          The two biases per unit come from Keras’s default, <code>reset_after=True</code>; the course slides have one, and the diagram’s
          left column says where the two differ. The second layer reads the first layer’s 16 outputs instead of the 2 temperature channels, which
          is the whole difference between 960 and 1,632. <R c={SUMMARY} />
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">960</span><span className="dlp2-fignum__k">gru <R c={SUMMARY} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1,632</span><span className="dlp2-fignum__k">gru_1 <R c={SUMMARY} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">408</span><span className="dlp2-fignum__k">dense <R c={SUMMARY} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">3,000</span><span className="dlp2-fignum__k">total, all trainable <R c={SUMMARY} /></span></div>
        </div>
        <P>
          The two Normalization layers carry the training mean and variance as fixed values, so they add nothing to the count{' '}
          <R c={SUMMARY} />. The notebook calls 3,000 modest next to the data even with the windows overlapping: about 1770 distinct
          months over the three training stations, each month a target for up to 12 different windows <R c={md} />.
        </P>
      </Row>
    </Plate>
  );
}

export function UnrollPlate({ meta }) {
  const train = codeCell('s6', 1); // In [9]
  const test = codeCell('s6', 2); // In [10]
  const curveMd = mdCell('s6', 1); // cell 19
  const testMd = mdCell('s6', 2); // cell 21
  return (
    <Plate meta={meta} cells={sectionRange('s6')}>
      <Row label="Task">
        <p className="dlp2-task">
          Turn the 72 input months into all 12 target months in a single step, train on the three coastal-plain stations, and test on
          Bickley.
        </p>
      </Row>
      <Row label="How it works" wide>
        <UnrollScene id="m1-unroll" />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>build_gru_model(12)</code> stacks Input <code>(None, 2)</code>, Normalization, the two GRUs, <code>Dense(24)</code> and{' '}
          <code>Reshape((12, 2))</code>, with the inverted Normalization last <R c={HELPERS} code />. The summary prints the time axis as
          None because the input length is left open, so the builder takes any number of months <R c={mdCell('s6', 0)} />; model 2
          reuses it with <code>target_length=1</code> <R c={mdCell('s7', 0)} />. With 72 months fed in, the first GRU’s{' '}
          <code>(None, None, 16)</code> is <code>(N, 72, 16)</code> <R c={SUMMARY} />.
        </P>
        <P>
          The second GRU returns only its final state, so the Dense layer sees a 16-number summary of the 72 months and maps it straight to
          12 months of minimums and maximums <R c={mdCell('s6', 0)} />. All 12 months come from the same 16 numbers at once; nothing the
          model predicts for month 73 is used to predict month 74.
        </P>
        <P>
          Training uses Adam at 0.003 on the MSE loss, batches of 32 (48 steps per epoch <R c={HELPERS_MD} />) for at most 100 epochs, and early stopping on the
          validation loss with patience 20 and the best weights restored <R c={HELPERS} code />. The rate is 0.003 because at the default
          0.001 the model was still improving after 100 epochs, and at 0.01 it became unstable <R c={HELPERS_MD} />.
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">66 → 46</span><span className="dlp2-fignum__k">stopped · kept epoch <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.5473</span><span className="dlp2-fignum__k">val loss °C² <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">0.988</span><span className="dlp2-fignum__k">val MAE °C <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.250</span><span className="dlp2-fignum__k">test MAE °C <R c={test} /></span></div>
        </div>
        <P>
          The loss is the mean squared error in °C² and the metric the mean absolute error in °C, so 1.5473 and 0.988 describe the same
          epoch-46 weights. At that epoch the training and validation curves lie almost on top of each other; afterwards the validation loss
          drifts up to about 1.7, mild overfitting that early stopping throws away <R c={curveMd} />.
        </P>
        <P>
          On Bickley the MAE is 1.250, about a quarter of a degree worse than on Swanbourne <R c={testMd} />. The minimum channel is fine;
          the maximum channel carries the error and is over-predicted by 0.81 °C on average <R c={38} />.
        </P>
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>test channel</th>
              <th className="num">MAE °C</th>
              <th className="num">mean error °C (predicted − actual)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>min</td><td className="num">0.79</td><td className="num">−0.08</td></tr>
            <tr><td>max</td><td className="num">1.71</td><td className="num">+0.81</td></tr>
          </tbody>
        </table>
        <P>
          The plots show where. The shape of the year is right in all three test sequences and the summer peaks of the maximum are within
          two or three degrees. In sequence 95, the window drawn above and in the notebook’s own panel below, the model predicts about 17.5 to 19 °C for the winter trough where
          Bickley recorded 14 to 16; the same happens, less strongly, in the other two. Bickley’s winters are cooler than anything in the
          training set, and the model only partly adjusts to that from the input <R c={testMd} />. Plate 9·4 follows the same bias through
          every model.
        </P>
      </Row>
      <Row label="Sequence 95, forecast" wide>
        <Seq95Scene id="m1-unroll-b" />
      </Row>
    </Plate>
  );
}
