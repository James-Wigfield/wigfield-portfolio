import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import ReturnStateScene, { SharedLayersScene } from './scenes/ReturnState';
import EncDecScene from './scenes/EncDec';
import OptimismScene from './scenes/Optimism';

/* ============================================================================
   PLATES 8·1–8·3 — model 3, the GRU encoder–decoder  (§8)
   8·1 what a GRU layer hands back: return_sequences / return_state, the
       layer-to-layer hand-over, Connected to, one set of layers in three models
   8·2 teacher forcing against free running (EncDec toggle), model 2 vs model 3
   8·3 why the curves flatter model 3: 0.962 → 1.178 → 1.321 on one axis
   Numbers: Out [15]–[17] (cells 31, 32, 34), Out [14], Out [18], Out [19]
   (cells 28, 37, 38), markdown cells 30, 33, 35, 39; tuning runs from
   experiments/log.md and the handover, labelled as such.
   ========================================================================== */

// beside the shared-layers scene on screen (a print-only sentence under the table carries the gist)
const CALLS_NOTE =
  'Each cell is the call index the summaries print under Connected to: [0] a layer’s first call, [1] its second, [2] its third. model3 calls the shared input scaling layer, normalization_4, twice ([0] for encoder_input, [1] for decoder_input) and the decoder calls it a third time. “used” marks a layer whose call index no summary prints: normalization_5, the inverted scaling on the way out (z-scores back to °C), is the last layer and feeds nothing, and the encoder’s summary has no Connected to column.';

const fig = (v, k, receipt) => (
  <div className="dlp2-fignum">
    <span className="dlp2-fignum__v">{v}</span>
    <span className="dlp2-fignum__k">{k} {receipt}</span>
  </div>
);

export function StatePlate({ meta }) {
  const md = mdCell('s8', 0); // cell 30
  const build = codeCell('s8', 0); // In [15]
  return (
    <Plate meta={meta} cells={[md, build]}>
      <Row label="Task">
        <p className="dlp2-task">
          Pass the final hidden state of each encoder GRU layer to the matching decoder layer, and keep the trained layers usable for
          forecasting one month at a time.
        </p>
      </Row>
      <Row label="How it works" wide>
        <ReturnStateScene />
        <SharedLayersScene note={CALLS_NOTE} />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>build_encoder_decoder</code> creates five layers once: two encoder <code>GRU(16)</code> layers with{' '}
          <code>return_state=True</code> (the first also has <code>return_sequences=True</code>, so the second has a sequence to read), two
          decoder <code>GRU(16)</code> layers with both flags, and a <code>Dense(2)</code> called <code>next_month</code>. One input
          scaling layer serves the encoder and decoder inputs alike, and an inverted one turns the output back into °C. <R c={build} code />
        </P>
        <P>
          Where model 1 put a Dense layer on the last state, model 3 hands both final states over:{' '}
          <code>sequence1, state1 = encoder_gru1(…)</code>, <code>_, state2 = encoder_gru2(sequence1)</code>, then{' '}
          <code>initial_state=state1</code> and <code>initial_state=state2</code> on the two decoder layers. The summaries are printed
          110 characters wide so the Connected to column shows which state feeds which layer. <R c={build} code />
        </P>
        <P>
          The encoder has model 1’s architecture but is trained from scratch. In the tuning runs, copying model 1’s trained layers in
          gave free-running validation MAEs of 1.19 (trainable) and 1.18 (frozen) against 1.16 from scratch, each a two-seed mean{' '}
          <R src="log" /> and within seed noise, so the notebook kept the simpler version <R c={md} />. Free running means the decoder is
          fed its own predictions, as at test time; plate 8·2 shows both ways of running it.
        </P>
        <P>
          Training and forecasting need the decoder wired differently. In training it gets all 12 true previous months in one call
          (teacher forcing, plate 8·2). At test time those months don’t exist yet, so it has to run one month per call on its own last
          output, which needs a model with different inputs: one month and the two states. So the same layer objects are wired into
          three models: <code>model3</code> for <code>fit</code>, an <code>encoder</code> that stops at the two states, and a one-step{' '}
          <code>decoder</code>. Because they share layers they share weights, so nothing is copied after training. <R c={md} />{' '}
          <R c={build} code />
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>layer</th>
              <th>output shape</th>
              <th className="num">params</th>
              <th>connected to</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>encoder_gru1</code></td><td><code>[(None, None, 16), (None, 16)]</code></td><td className="num">960</td><td><code>normalization_4[0][0]</code></td></tr>
            <tr><td><code>decoder_gru1</code></td><td><code>[(None, None, 16), (None, 16)]</code></td><td className="num">960</td><td><code>normalization_4[1][0]</code>, <code>encoder_gru1[0][1]</code></td></tr>
            <tr><td><code>encoder_gru2</code></td><td><code>[(None, 16), (None, 16)]</code></td><td className="num">1,632</td><td><code>encoder_gru1[0][0]</code></td></tr>
            <tr><td><code>decoder_gru2</code></td><td><code>[(None, None, 16), (None, 16)]</code></td><td className="num">1,632</td><td><code>decoder_gru1[0][0]</code>, <code>encoder_gru2[0][1]</code></td></tr>
            <tr><td><code>next_month</code></td><td><code>(None, None, 2)</code></td><td className="num">34</td><td><code>decoder_gru2[0][0]</code></td></tr>
          </tbody>
        </table>
        <P>
          Rows of the <code>model3</code> summary as printed <R c={build} />. In <code>layer[i][j]</code>, i counts the calls of that
          layer and j picks the output, so <code>encoder_gru1[0][1]</code> is the state from its first call and{' '}
          <code>encoder_gru1[0][0]</code> the sequence. <code>None</code> means not fixed: the batch, and for the sequences the length,
          which is 72 for the encoder and 12 for the decoder here.
          <span className="dlp2-print">
            {' '}
            The second diagram’s cells use the same call index; a cell that says “used” is a layer whose call index no summary prints
            (normalization_5, the inverted scaling on the way out, z-scores back to °C, is the last layer and feeds nothing; the encoder’s
            summary has no Connected to column).
          </span>
        </P>
        <div className="dlp2-figs">
          {fig('5,218', 'model3 params', <R c={build} />)}
          {fig('2,592', 'encoder params', <R c={build} />)}
          {fig('2,626', 'decoder params', <R c={build} />)}
        </div>
        <P>
          The encoder’s 960 + 1,632 and the decoder’s 960 + 1,632 + 34 add up to the training model’s total because every weighted layer
          of <code>model3</code> sits in exactly one of the two inference models. <R c={md} />
        </P>
      </Row>
    </Plate>
  );
}

export function EncDecPlate({ meta }) {
  const md = mdCell('s8', 0); // cell 30
  const build = codeCell('s8', 0); // In [15]
  const fitCell = codeCell('s8', 1); // In [16]
  const testCell = codeCell('s8', 2); // In [17]
  return (
    <Plate meta={meta} cells={sectionRange('s8')}>
      <Row label="Task">
        <p className="dlp2-task">
          Train the encoder–decoder on the real previous months, then forecast the test set with the decoder running on its own
          predictions.
        </p>
      </Row>
      <Row label="How it works" wide>
        <EncDecScene id="m3-encdec" start="month 72" units={16} />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>decoder_inputs(X, y)</code> is <code>tf.concat([X[:, -1:], y[:, :-1]], axis=1)</code>: month 72 followed by the first 11
          target months. Training becomes a single forward pass over 12 steps that <code>fit</code> handles like any other model, and the
          validation loss is teacher-forced as well. <R c={build} code /> <R c={fitCell} code /> <R c={md} />
        </P>
        <P>
          The training wiring keeps only the decoder’s sequences: <code>decoded1, _ = decoder_gru1(…)</code>. Inside one call the GRU
          carries its own state from step to step, and after step 12 nothing is left to feed, so the final states are not needed. The
          inference decoder runs one step per call, so it has to return <code>new_state1</code> and <code>new_state2</code> and take
          them back in on the next call. <R c={build} code />
        </P>
        <P>
          <code>predict_encoder_decoder</code> encodes X once, starts from <code>month = X[:, -1:]</code> and loops n_steps times,
          feeding each predicted month and both states straight back in. Nothing from <code>y_test</code> enters the loop, and{' '}
          <code>n_steps</code> lets section 9 run the decoder past the 12 steps it was trained on. <R c={build} code /> <R c={md} />{' '}
          <span className="dlp2-screen">Switch the scene to Test · free running to see the loop.</span>
          <span className="dlp2-print">The Test · free running frames above show the loop.</span>
        </P>
        <P>
          The mismatch between the two phases has a name, exposure bias: training only ever fed the decoder true months, so at test time
          its own mistakes arrive as inputs it never learned to handle, and they compound. Model 2 has the same problem: it was trained
          only on real 72-month windows, and from step 2 its window holds its own guesses.
        </P>
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>each forecast step</th>
              <th>reads</th>
              <th>carries to the next step</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>model 2</td>
              <td>a full 72-month window, re-read from scratch; after step 1 its newest months are its own guesses</td>
              <td>nothing but the window</td>
            </tr>
            <tr>
              <td>model 3</td>
              <td>one month: month 72, then its own previous guess</td>
              <td>two states of 16 numbers</td>
            </tr>
          </tbody>
        </table>
        <P>
          Model 2’s recursion slides the window one month per step <R c={codeCell('s7', 3)} code />; model 3’s memory of the input is
          only what the encoder packed into the two states. <R c={md} />
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          {fig('1.321', 'model 3 test MAE °C', <R c={testCell} />)}
          {fig('1.407', 'model 2 recursive', <R c={codeCell('s7', 3)} />)}
          {fig('1.250', 'model 1', <R c={codeCell('s6', 2)} />)}
        </div>
        <P>
          With the decoder running on its own predictions the test MAE is 1.321 °C, better than model 2’s recursive 1.407 but worse than
          model 1’s 1.250. The examples keep the annual shape and the same warm winter maximums at Bickley: sequence 95’s winter trough is
          predicted at 18 to 20 °C against the recorded 14 to 16, as for the other two models (plate 6·2). <R c={mdCell('s8', 2)} />
        </P>
        <P>
          One step out (lead month 1, the first month after the input), model 3 is ahead of model 2, 1.10 against 1.19, which the
          notebook puts down to the two-layer state carrying more than model 2’s single Dense readout. Its average error grows fastest
          with the horizon, 1.321 at 12 months to 1.457 at 24, against model 2’s 1.407 to 1.470; month by month it is the worse of the
          two from lead month 19. <R c={codeCell('s9', 0)} />{' '}
          <R c={mdCell('s9', 1)} /> The month-by-month readings come from the lead-month plot in plate 9·3.
        </P>
      </Row>
    </Plate>
  );
}

export function OptimismPlate({ meta }) {
  const fitCell = codeCell('s8', 1); // In [16]
  const curveMd = mdCell('s8', 1); // cell 33
  const testCell = codeCell('s8', 2); // In [17]
  const table = codeCell('s9', 1); // In [19]
  return (
    <Plate meta={meta} cells={[fitCell, mdCell('s8', 2)]}>
      <Row label="Task">
        <p className="dlp2-task">
          Read model 3’s learning curve, and check what it says about the free-running forecast that is actually scored.
        </p>
      </Row>
      <Row label="How it works" wide>
        <OptimismScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          Model 3 trains with model 1’s settings (Adam at 0.003, MSE, patience 20). It stopped after 50 epochs (64 s) and kept epoch 30:
          val_loss 1.4601, validation MAE 0.962. <R c={fitCell} /> Training loss falls to 2 in two epochs and then slowly to 1.35;
          validation follows more gradually, is level with it from about epoch 20, bottoms out at 30 and drifts up to around 1.7, the same
          mild overfitting as model 1, handled by early stopping. <R c={curveMd} />
        </P>
        <P>
          The caveat is in the same cell: these curves are teacher-forced, so they measure one month ahead from a perfect history.
          Section 9 runs the decoder free on the validation set and gets 1.178 <R c={table} />, so the curves are “optimistic by about 0.2
          degrees”. <R c={curveMd} />
        </P>
        <P>
          This explainer adds, as its own reading: only part of the 0.216 gap is exposure bias. A teacher-forced score is always a one-month-ahead score; the free-running score
          averages forecasts one to 12 months ahead, and later months are harder even for a model that never sees its own mistakes,
          because a warm or cool spell in the last input months helps with the next month but not with one a year out. On
          the test set, plate 9·3 shows model 3’s error climbing from 1.10 at lead month 1 to about 1.4 by lead month 12{' '}
          <R c={mdCell('s9', 1)} />; that climb is free-running too, so it mixes both effects.
        </P>
        <P>
          Early stopping still watched the teacher-forced val_loss. In separate 100-epoch tuning runs that logged the free-running MAE
          every epoch, the epoch val_loss picked was within 0.04 °C of the best free-running one <R src="log" />, so no free-running
          callback was needed. <R c={curveMd} />
        </P>
        <P>
          Five seeds of the same setup in the tuning script ranged from 1.09 to 1.25 (mean 1.185), the noisiest of the three models; the
          notebook’s 1.178 sits inside that spread. <R src="log" />
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          {fig('0.962', 'teacher-forced val MAE', <R c={fitCell} />)}
          {fig('1.178', 'free-running val MAE', <R c={table} />)}
          {fig('1.321', 'free-running test MAE', <R c={testCell} />)}
        </div>
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>12-month MAE °C</th>
              <th className="num">validation · Swanbourne</th>
              <th className="num">test · Bickley</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>model 1</td><td className="num">0.988</td><td className="num">1.250</td></tr>
            <tr><td>model 2</td><td className="num">0.982</td><td className="num">1.407</td></tr>
            <tr><td>model 3</td><td className="num">1.178</td><td className="num">1.321</td></tr>
          </tbody>
        </table>
        <P>
          Validation and test MAEs as printed <R c={table} />. On Swanbourne, where models 1 and 2 are level with the climatology
          baseline <R c={mdCell('s9', 1)} />, model 3 is the worst of the three; on Bickley it is ahead of model 2 and behind model 1. Its maximums there are too warm by 1.20
          °C on average, the largest bias of the three (models 1 and 2: +0.81 and +1.14), while its minimums are close (−0.08). <R c={table} />{' '}
          Section 9 traces that to Bickley being cooler than the training stations. <R c={mdCell('s9', 1)} />
        </P>
      </Row>
    </Plate>
  );
}
