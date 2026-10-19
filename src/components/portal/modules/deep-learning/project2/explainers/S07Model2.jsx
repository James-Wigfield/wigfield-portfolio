import { Plate, Row, R, P } from '../scene/Plate';
import { codeCell, mdCell } from '../nbutil';
import LearningRateScene, { CurveCostScene } from './scenes/LearningRate';
import RecursionScene from './scenes/Recursion';

/* ============================================================================
   PLATES 7·x — model 2  (§7, cells 22–29)
   7·1 the learning rate: the tuning grid behind cell 22's sentence, then the
       price of 0.01 read off the notebook's own learning curve (Out [12]).
   7·2 the recursive rollout: predict_recursively's loop, why Reshape(1, 2),
       window against growing input, and the 1.188 → 1.407 cost.
   ========================================================================== */

const HELPERS_MD = 14;
const HELPERS = 15; // In [7]  LEARNING_RATE = 3e-3
const PER_CHANNEL = 38; // In [19]
const DISCUSSION = 39;
const M1_TEST = 20; // In [10]
const M1_TRAIN = 18; // In [9]   model 1 val_mae 0.988
const M2_TRAIN = 24; // In [12]  model 2 val_mae 0.882 (month 73)

export function LearningRatePlate({ meta }) {
  const intro = mdCell('s7', 0); // cell 22
  const summary = codeCell('s7', 0); // In [11]
  const train = codeCell('s7', 1); // In [12]
  const curveMd = mdCell('s7', 1); // cell 25
  return (
    <Plate meta={meta} cells={[intro, curveMd]}>
      <Row label="Task">
        <p className="dlp2-task">
          Model 2: the same two GRU layers with the output cut down to a single month, trained on month 73 only, at a learning rate of its
          own.
        </p>
      </Row>
      <Row label="How it works" wide>
        <LearningRateScene id="m2-lr" />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>build_gru_model(1)</code> reuses the builder, so <code>Dense(2)</code> and <code>Reshape((1, 2))</code> take the place of{' '}
          <code>Dense(24)</code> and <code>Reshape((12, 2))</code>. The GRU layers keep their 960 and 1,632 parameters and the Dense layer
          has 16·2 + 2 = 34, for 2,626 in all <R c={summary} />. It trains on <code>y_train[:, :1]</code> and validates on{' '}
          <code>y_val[:, :1]</code>, shapes (1522, 1, 2) and (313, 1, 2) <R c={train} code />.
        </P>
        <P>
          The learning rate is 0.01 <R c={train} code /> instead of the 0.003 the other models use <R c={HELPERS} code />. The
          notebook’s reason is measured, not derived: in the tuning runs model 2 was better at the higher rate, while model 1 fell apart
          at 0.01 <R c={intro} />.
        </P>
        <P>
          The chart is the two-seed tuning grid behind cell 22’s sentence. At 0.01 model 2 scored 0.855 for month 73 and 0.974 rolled
          out, against 0.896 and 1.042 at 0.003. Five seeds at 0.01 (the grid’s two and three more) averaged 0.881 and 1.008: those are
          the notebook’s “about 0.88” and “1.01”. Its 0.90 and 1.04 at 0.003 are the two-seed values. Model 1 went the other way, 1.009 at
          0.003 against 1.110 at 0.01 <R src="log" />.
        </P>
        <P>
          These are the two usual ways a learning rate goes wrong. Too small, and the model is still improving when the 100-epoch cap
          ends the run, as model 1 was at 0.001; too large, and the best epoch comes early and the validation loss climbs after it, as
          for model 1 at 0.01 <R c={HELPERS_MD} /> <R src="log" />. Model 2 at 0.01 does show that shape (best at epoch 20, then a sharp
          climb <R c={train} />), but its best validation MAE was still lower than at 0.003, 0.855 against 0.896 in the two-seed means{' '}
          <R src="log" />, so the faster rate won on validation and early stopping keeps that minimum.
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">40 → 20</span><span className="dlp2-fignum__k">stopped · kept epoch <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.2393</span><span className="dlp2-fignum__k">val loss °C² <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">0.882</span><span className="dlp2-fignum__k">val MAE °C · month 73 <R c={train} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">2,626</span><span className="dlp2-fignum__k">parameters <R c={summary} /></span></div>
        </div>
        <P>
          The notebook calls this the least tidy curve of the three. The readings on its plot below, and the dropout runs that did worse,
          are from that discussion <R c={curveMd} />. Early stopping restores epoch 20’s weights, so the saved model is not the overfitted
          one, but the curve is a warning that this model is sensitive to when it stops <R c={curveMd} />.
        </P>
      </Row>
      <Row label="Model 2’s curve at 0.01" wide>
        <CurveCostScene id="m2-lr-b" />
      </Row>
    </Plate>
  );
}

export function RecursionPlate({ meta }) {
  const testOne = codeCell('s7', 2); // In [13]
  const roll = codeCell('s7', 3); // In [14]
  const loopMd = mdCell('s7', 2); // cell 27
  const resultMd = mdCell('s7', 3); // cell 29
  return (
    <Plate meta={meta} cells={[testOne, resultMd]}>
      <Row label="Task">
        <p className="dlp2-task">Forecast all 12 months with the one-month model by feeding each prediction back in as the newest input month.</p>
      </Row>
      <Row label="How it works" wide>
        <RecursionScene id="m2-recursion" mode="slide" />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>predict_recursively</code> starts from <code>window = X</code> and loops <code>n_steps</code> times: the model predicts{' '}
          <code>y_next</code>, shape (N, 1, 2), the prediction is kept, and{' '}
          <code>window = tf.concat([window[:, 1:], y_next], axis=1)</code> drops the oldest month and appends the new one{' '}
          <R c={roll} code />. Nothing past month 72 is ever real data; every later input month is the model’s own output <R c={loopMd} />.
        </P>
        <P>
          The <code>Reshape((1, 2))</code> at the end of model 2 is what keeps that line simple. The prediction keeps a time axis of
          length one, so it joins the (N, 71, 2) slice along axis 1 and the window is (N, 72, 2) again, ready for the next pass. A bare{' '}
          <code>Dense(2)</code> output of shape (N, 2) would need an extra axis first.
        </P>
        <P>
          Géron’s example lets the input grow, so the model sees 73, then 74, up to 83 months. The notebook slides a 72-month window
          instead, so the model only ever sees inputs of the length it was trained on. For this model both gave the same 12-month
          validation MAE, which makes the window a safety choice: a ReLU variant went badly wrong when its input was allowed to grow,
          3.4 °C against 1.1 with the window <R c={loopMd} />. In the tuning log the two tanh rollouts agree to three decimals and the ReLU
          pair is 3.444 against 1.122 <R src="log" />.
        </P>
        <P>
          This is not the data window of plate 2·2. Those are the rows of <code>test_seq</code>, cut from Bickley’s record before any model
          runs; this is the model’s input inside one row, and it slides onto the model’s own guesses, never onto the next row’s real months.
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.188</span><span className="dlp2-fignum__k">test MAE · month 73 <R c={testOne} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.407</span><span className="dlp2-fignum__k">test MAE · 12 months <R c={roll} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">0.982</span><span className="dlp2-fignum__k">val MAE · 12 months <R c={PER_CHANNEL} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">1.250</span><span className="dlp2-fignum__k">model 1 test, for scale <R c={M1_TEST} /></span></div>
        </div>
        <P>
          Rolled out to 12 months, the test MAE climbs from 1.188 to 1.407, which the notebook calls “the cost of feeding predictions back
          in: each month’s error becomes part of the input for the next” <R c={resultMd} />. That is the notebook’s reading. This
          explainer adds a second cause the notebook doesn’t name: a warm or cool spell in the last input months tends to carry on into
          month 73, and a model can use it; a year out that help is gone. The baselines never carry a recent spell forward, and their error is
          flat across all 24 lead months (plate 9·3), so the seasons themselves are no harder to forecast a year out; what a model loses
          with distance is the help the last few months gave it. The notebook doesn’t say how the 0.219 rise splits between the two
          causes. Plate 8·3 makes the same point about model 3’s gap.
        </P>
        <P>
          The 12-month figure is also worse than model 1’s 1.250, so predicting the 12 months jointly beats chaining single-month
          predictions here <R c={resultMd} />. The examples keep the shape of the year, including the climb into summer in sequence 259,
          but the predicted curve is smoother than the real one, and sequence 95’s winter maximums are again too warm by around 3 degrees,
          as model 1’s were in plate 6·2 <R c={resultMd} />.
        </P>
        <P>
          On validation, model 2’s one-month error, 0.882 <R c={M2_TRAIN} />, is already close to model 1’s 12-month average, 0.988{' '}
          <R c={M1_TRAIN} />: much of what is left is month-to-month noise. The sequences carry a lot of it on top of the annual cycle{' '}
          <R c={13}>cell 13</R>, and the tuning log puts model 1’s plateau near 1.0 °C on validation down to that noise and the small
          effective data set <R src="log" />. At Bickley a large part of the remainder is the warm bias of plate 9·4.
        </P>
        <P>
          The two stations rank the models differently. On Swanbourne the rolled-out model 2 is level with model 1, 0.982 against
          0.988 <R c={PER_CHANNEL} />. On Bickley it falls behind and is biased warm on both channels, +0.47 °C on the minimum and
          +1.14 °C on the maximum <R c={PER_CHANNEL} />, the worst transfer of the three because its errors compound through the
          recursion <R c={DISCUSSION} />.
        </P>
      </Row>
    </Plate>
  );
}
