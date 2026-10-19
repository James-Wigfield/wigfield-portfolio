import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import ScalingScene from './scenes/Scaling';
import { EarlyStopToggle } from './scenes/EarlyStop';
import CurveReadingScene from './scenes/CurveReading';

/* ============================================================================
   PLATES 5·x — shared helpers  (§5: In [7] and the markdown above it)
     5·1 scaling inside the model      (Scaling scene)
     5·2 early stopping and the rewind (EarlyStop, four runs behind a toggle)
     5·3 reading a learning curve      (CurveReading scene)
   ========================================================================== */

const HELPERS = codeCell('s5', 0); // In [7]
const NOTES = mdCell('s5', 0); // cell 14

// the four training runs, as printed by train_model
const RUNS = [
  { key: 'm1', label: 'Model 1', best: 46, stop: 66, loss: '1.5473', secs: 66, what: 'validation loss', cell: codeCell('s6', 1) },
  { key: 'm2', label: 'Model 2', best: 20, stop: 40, loss: '1.2393', secs: 40, what: 'validation loss (month 73 only)', cell: codeCell('s7', 1) },
  { key: 'm3', label: 'Model 3', best: 30, stop: 50, loss: '1.4601', secs: 64, what: 'teacher-forced validation loss (see plate 8·2)', cell: codeCell('s8', 1) },
  { key: 'vae', label: 'VAE', best: 23, stop: 43, loss: '0.0950', secs: 32, what: 'total validation loss (reconstruction + weighted KL, plate 11·3)', cell: codeCell('s11', 1) },
];

export function ScalingPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('s5')}>
      <Row label="Task">
        <p className="dlp2-task">
          Put the temperatures on a scale the GRU layers can learn from, using statistics from the training data only, without
          changing the shape of any sequence.
        </p>
      </Row>
      <Row label="How it works" wide>
        <ScalingScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          In [7] takes the mean and standard deviation of <code>X_train</code> over every sequence and month, separately for each channel
          (<code>axis=(0, 1)</code>) <R c={HELPERS} code />: mean 12.22 and 24.69 °C, standard deviation 3.8 and 5.1 <R c={HELPERS} />. Only the training
          inputs go in, so nothing about Swanbourne or Bickley reaches the scaling.
        </P>
        <P>
          <code>scaling_layers()</code> builds a fresh pair of <code>Normalization</code> layers for each model from those two numbers per
          channel. The layer is given a variance, so the standard deviation is squared: <code>variance=STD ** 2</code>{' '}
          <R c={HELPERS} code />. Forward it computes
          (x − mean)/√var (a z-score); with <code>invert=True</code> it computes mean + x·√var, and the round trip is exact <R src="handover" />. The
          statistics are fixed, not learned, which is why both layers show 0 parameters in every summary <R c={codeCell('s6', 0)} />. Model 3
          shares one pair between its encoder and decoder inputs. <R c={NOTES} />
        </P>
        <P>
          ReLU was the other way out: its state is unbounded and could carry raw temperatures. In the tuning runs it matched tanh once the
          inputs were scaled, did worse on raw ones, and took about 20 seconds an epoch instead of one, because only a tanh GRU runs on
          cuDNN (see 1·1). So the models use tanh on scaled inputs. <R c={NOTES} />
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>12-month model, tuning runs</th>
              <th className="num">val MAE °C</th>
              <th>per epoch on the GPU</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>tanh, raw °C</td><td className="num">3.5</td><td>about 1 s</td></tr>
            <tr><td>ReLU, raw °C</td><td className="num">1.5</td><td>about 20 s</td></tr>
            <tr><td>tanh or ReLU, scaled</td><td className="num">about 1.0</td><td>tanh 1 s · ReLU 20 s</td></tr>
          </tbody>
        </table>
        <P>
          Figures as the notebook quotes them from the tuning runs <R c={NOTES} />; the log has them to three places (3.531, 1.528, 1.038 for
          scaled tanh, in the first grid at learning rate 0.001) <R src="log" />. The raw tanh model was worse than repeating last year, which scores 1.226 on validation{' '}
          <R c={codeCell('s9', 1)} />. The log gives the output side of the problem too: raw temperatures into a tanh GRU “learn very slowly because the Dense
          output has to produce values around 12 to 25 from hidden states bounded to [-1, 1]” <R src="log" />, which is what the
          inverted layer takes off the Dense head.
        </P>
        <P>
          Because the scaling lives inside the models, everything the notebook prints is in real units: the MSE loss in °C², the MAE in
          °C. The statistics come from <code>X_train</code>’s 72 input months, which is why section 10’s single-channel scaling of all 84
          months gets a slightly different maximum mean <R c={codeCell('s10', 0)} />, compared in plate 10·1.
        </P>
      </Row>
    </Plate>
  );
}

export function EarlyStopPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('s5')}>
      <Row label="Task">
        <p className="dlp2-task">Train for at most 100 epochs, stop once the validation loss has stopped improving, and keep the best weights rather than the last.</p>
      </Row>
      <Row label="How it works" wide>
        <EarlyStopToggle id="early-stop" runs={RUNS} patience={20} />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>train_model</code> compiles with Adam and the MSE loss and fits for up to 100 epochs, batch 32, with{' '}
          <code>EarlyStopping(monitor=&quot;val_loss&quot;, patience=20, restore_best_weights=True)</code>. Afterwards it finds the best epoch
          from the history and prints where training stopped, how long it took and which epoch’s weights were kept. <R c={HELPERS} code /> Every forecast is then scored by{' '}
          <code>evaluate_mae</code>: the mean absolute error in °C over every sequence, month and both channels together. <R c={HELPERS} code />
        </P>
        <P>
          The compile call also passes <code>jit_compile=False</code> <R c={HELPERS} code />, which turns off XLA, a compiler TensorFlow
          can apply to a model’s computations. In the notebook’s words, “on my GPU the default XLA compilation fails on the first training
          step for some of these models, and the flag turns it off without changing anything else” <R c={NOTES} />.
        </P>
        <P>
          Patience is 20 rather than 10 because the validation loss is noisy and a couple of early runs stopped on a bump. <R c={NOTES} /> What
          “validation loss” means differs by model: model 2’s covers month 73 only, model 3’s is teacher-forced (each decoder step is
          given the true previous month; see 8·2 and 8·3) <R c={mdCell('s8', 1)} />, and the VAE’s is the total of its two loss terms,
          reconstruction and weighted KL (see 11·3), which the notebook checked <R c={mdCell('s11', 0)} />.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>run</th>
              <th className="num">best epoch</th>
              <th className="num">stopped</th>
              <th className="num">val_loss kept</th>
              <th className="num">time</th>
              <th>printed in</th>
            </tr>
          </thead>
          <tbody>
            {RUNS.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{r.best}</td>
                <td className="num">{r.stop}</td>
                <td className="num">{r.loss}</td>
                <td className="num">{r.secs} s</td>
                <td><R c={r.cell} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          Every run stops exactly 20 epochs after its best: 46 → 66, 20 → 40, 30 → 50, 23 → 43. None came near the 100-epoch cap, so
          each spent its last 20 epochs confirming that the best had passed, and those epochs are thrown away when the best weights are
          put back (Keras 3 does this when training ends, and would at the cap too). The curves in the diagram are traced from each run’s
          own figure; model 2’s shows why the rewind matters, its validation loss doubling to about 2.5 by epoch 40{' '}
          <R c={mdCell('s7', 1)} />. The four runs belong to sections 6, 7, 8 and 11 and are gathered here, ahead of their models,
          because they all go through this one helper.
        </P>
      </Row>
    </Plate>
  );
}

export function CurveReadingPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('s5')}>
      <Row label="Task">
        <p className="dlp2-task">Plot the training and validation loss and MAE for every epoch, and mark the epoch whose weights were kept.</p>
      </Row>
      <Row label="How it works" wide>
        <CurveReadingScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>plot_learning_curve</code> draws two panels from <code>history.history</code>: <code>loss</code> and <code>val_loss</code> on the
          left, <code>mae</code> and <code>val_mae</code> on the right, and a grey dotted line at the epoch with the lowest validation loss.{' '}
          <R c={HELPERS} code /> The loss is MSE because its gradients shrink as the error shrinks, which gave smoother validation curves;
          MAE and Huber losses reached the same validation MAE within noise. MAE is the metric because it reads directly in °C.{' '}
          <R c={NOTES} />
        </P>
        <P>
          The VAE reuses the same function with the reconstruction MSE as its metric and new axis labels, so its left panel is the total
          loss (reconstruction plus weighted KL, plate 11·3) and its right panel the reconstruction alone, in z-score units.{' '}
          <R c={codeCell('s11', 1)} code />
        </P>
      </Row>
      <Row label="What came out">
        <P>
          Model 1’s curve, the one in the diagram, read the way the notebook reads it: the validation loss starts below training, sits on a
          shelf around 2.8 to 3.0 between epochs 10 and 22, meets training at about epoch 45 and then drifts up to about 1.7 while training
          keeps inching down <R c={mdCell('s6', 1)} />. The other three curves are read with their models: model 2’s in plate 7·1, model
          3’s teacher-forced one in 8·3 and the VAE’s in 11·3.
        </P>
        <P>
          Model 1’s best epoch has a validation loss of 1.5473 °C² and a validation MAE of 0.988 °C <R c={codeCell('s6', 1)} />. MSE
          squares each error before averaging, so the loss is in °C², and its square root, 1.24 °C, sits above the MAE because squaring
          gives the large errors more weight. The MAE is the one to compare with the test results and the baselines.
        </P>
      </Row>
    </Plate>
  );
}
