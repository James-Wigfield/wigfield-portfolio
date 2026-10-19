import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import ConvPathScene from './scenes/ConvPath';
import ReparamScene from './scenes/Reparam';
import KlPullScene from './scenes/KlPull';

/* ============================================================================
   PLATES 11·1–11·3 — the VAE model  (§11)
   11·1 the conv path and its parameter counts (Out [21])
   11·2 the reparameterisation trick (Sampling layer)
   11·3 the KL term: per-coding KL, the 0.5/84 weight, loss against metric,
        the weight sweep (cell 43, experiments/log.md)
   ========================================================================== */

const LAYERS = [
  ['Conv1D(16, 5, strides=2)', '(42, 16)', '96', '5 × 1 × 16 + 16'],
  ['Conv1D(32, 5, strides=2)', '(21, 32)', '2,592', '5 × 16 × 32 + 32'],
  ['Flatten', '672', '0', '21 × 32 values'],
  ['Dense(4) z_mean', '4', '2,692', '672 × 4 + 4'],
  ['Dense(4) z_log_var', '4', '2,692', '672 × 4 + 4'],
  ['Dense(672)', '672', '3,360', '4 × 672 + 672'],
  ['Conv1DTranspose(16, 5, strides=2)', '(42, 16)', '2,576', '5 × 32 × 16 + 16'],
  ['Conv1DTranspose(1, 5, strides=2)', '(84, 1)', '81', '5 × 16 × 1 + 1'],
];

export function VaeShapePlate({ meta }) {
  const build = codeCell('s11', 0);
  const fit = codeCell('s11', 1);
  const why = mdCell('s11', 0);
  return (
    <Plate meta={meta} cells={sectionRange('s11')}>
      <Row label="Task">
        <p className="dlp2-task">
          Feed the VAE 84-month maximum-temperature sequences from train_seq, choose a suitable codings size, and use two layers in
          each half: Dense, or Conv1D in the encoder and Conv1DTranspose in the decoder. <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <ConvPathScene id="vae-shape" />
      </Row>
      <Row label="What the notebook did">
        <P>
          A VAE is an autoencoder: it squeezes each sequence into a short code and rebuilds the sequence from it. Here the code is 4
          numbers. The notebook calls each of the 4 numbers a coding (its text also calls them latent dimensions); Géron’s{' '}
          <code>codings_size</code> is how many there are. For each coding the encoder outputs a small
          distribution, a mean and a spread, rather than a single point, and the loss adds a KL term that pulls those distributions
          towards N(0, I). If that works, any code drawn from N(0, I) decodes to a plausible sequence, which is how section 12 makes
          new ones. This plate is the shape, 11·2 the sampling, 11·3 the KL.
        </P>
        <P>
          The codings size is 4. An 84-month maximum series is close to a fixed annual cycle, so a code has to give the level, the
          amplitude, the phase (which calendar month the window starts in, a circular quantity that needs two numbers) and a little
          year-to-year wobble. Runs with 2, 3, 4, 6, 8 and 16 codings all used between two and five of them, so the notebook settled
          on 4 and prints the KL per coding after training to show how many are in use (plate 11·3). <R c={why} />
        </P>
        <P>
          It chose convolutions because the signal is local and repeating: a filter that picks out a summer peak is reused at each of
          the seven summers. Both encoder layers use kernel 5, stride 2 and <code>padding="same"</code>, so the length halves exactly,
          84 → 42 → 21, while the filters go 1 → 16 → 32. The decoder mirrors it: a Dense layer to 672 values, a Reshape to (21, 32)
          and two Conv1DTranspose layers back to 84 months. A stride-2 Conv1DTranspose runs a convolution in reverse: each input step
          spreads its values over 5 output steps and neighbouring steps land 2 apart, so the length doubles, 21 → 42 → 84. The hidden layers use ReLU, which has no flat top to saturate on,
          and the output is linear because z-scores can be negative. <R c={why} /> <R c={build} code />
        </P>
        <P>
          The Dense version it was compared with reconstructed validation sequences slightly worse in the tuning runs, about 0.95 °C
          against 0.93 for the convolutions (the final run gives 0.940) <R c={why} />, and the tuning log has it making more flat
          samples, 27% against 22% <R src="log" />.
        </P>
        <P>
          The VAE learns to reproduce its input: <code>train_model(vae, z_train, z_train, z_val, z_val, metrics=("mse",))</code> passes
          the same array as input and target <R c={fit} code />, the maximums as z-scores, (x − 24.70) / 5.11, with Swanbourne’s 313
          sequences for validation. <R c={codeCell('s10', 0)} /> Two different things are called z on this plate:{' '}
          <code>z_train</code> is the z-scored data, while the z at the foot of the diagram, and on plates 11·2 and 11·3, is the code.
          Neither is the GRU’s update gate z(t) from plate 6·1.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>layer</th>
              <th>output</th>
              <th className="num">params</th>
              <th>from</th>
            </tr>
          </thead>
          <tbody>
            {LAYERS.map(([l, o, n, f]) => (
              <tr key={l}>
                <td><code>{l}</code></td>
                <td>{o}</td>
                <td className="num">{n}</td>
                <td>{f}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          8,072 parameters in the encoder and 6,017 in the decoder <R c={build} />. A convolution’s weight count depends on its kernel
          and channels, not on the length of the sequence, which is why the layers at the two ends have only 96 and 81. The three Dense
          layers on either side of the 672 values hold most of the model. The summaries print every shape with <code>None</code> first,
          the batch dimension.
        </P>
      </Row>
    </Plate>
  );
}

export function ReparamPlate({ meta }) {
  const build = codeCell('s11', 0);
  const fit = codeCell('s11', 1);
  return (
    <Plate meta={meta} cells={sectionRange('s11')}>
      <Row label="Task">
        <p className="dlp2-task">Draw a random code inside the model on every training step, and still train the encoder by backpropagation.</p>
      </Row>
      <Row label="How it works" wide>
        <ReparamScene id="vae-reparam" codings={4} />
      </Row>
      <Row label="What the notebook did">
        <P>
          The <code>Sampling</code> layer draws <code>epsilon = keras.random.normal(shape=tf.shape(z_mean))</code> and returns{' '}
          <code>z_mean + tf.exp(0.5 * z_log_var) * epsilon</code>. In the course notation that is z = μ + σ ⊗ ε with σ = exp(γ/2) and
          ε ~ N(0, I). The encoder outputs γ = log σ² rather than σ because a Dense layer can give any real number, and exp turns it into
          a spread that is always positive. <R c={build} code /> <R c={mdCell('s11', 0)} />
        </P>
        <P>
          The rewriting is the point of the layer. A number drawn straight from N(μ, σ²) has no gradient back to μ or σ, so the
          reconstruction loss could never train the encoder through it. Written as μ + σ ⊗ ε, z is plain arithmetic on μ
          and σ, and the randomness sits in ε, which has nothing to learn: “the randomness sits outside the gradient path”, in the
          notebook’s words. <R c={mdCell('s11', 0)} />
        </P>
        <P>
          The same layer adds the KL term to the model’s losses with <code>self.add_loss</code>, the Keras 3 way of doing what Géron
          does on the model (plate 11·3). The draws come from Keras’s global generator, which <code>keras.utils.set_random_seed(42)</code>{' '}
          seeds in the setup cell <R c={2} code />, so on the same machine the samples repeat from run to run <R src="handover" />.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          Because z is sampled on validation passes too, the validation curve is a little bumpy from epoch to epoch. For its
          reconstruction score the notebook skips the sampling and decodes each validation sequence from its mean code μ: 0.940 °C,
          a little above model 2’s one-month validation error of 0.882 on the same station; the code keeps the level and the cycle,
          not the month-to-month noise. <R c={fit} /> <R c={mdCell('s11', 1)} /> This explainer adds that the two numbers are not like
          for like: a reconstruction sees the months it rebuilds; a forecast doesn’t.
        </P>
        <P>
          One of the four codings ended up unused (plate 11·3), which is why the diagram draws z1 at μ 0 and σ 1: its sample is ε itself,
          and the decoder ignores it.
        </P>
      </Row>
    </Plate>
  );
}

export function KlPlate({ meta }) {
  const build = codeCell('s11', 0);
  const fit = codeCell('s11', 1);
  const why = mdCell('s11', 0);
  const read = mdCell('s11', 1);
  return (
    <Plate meta={meta} cells={sectionRange('s11')}>
      <Row label="Task">
        <p className="dlp2-task">
          Train the VAE with an appropriate optimiser and early stopping, using val_seq’s maximum temperatures as the validation set,
          and show the learning curve. <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <KlPullScene id="vae-kl" />
      </Row>
      <Row label="What the notebook did">
        <P>
          The latent loss, −½ Σ (1 + γ − exp(γ) − μ²) in the course notation, is the KL divergence between the encoder’s distribution
          N(μ, σ²) (the approximate posterior q(z|x)) and the prior N(0, I). For each coding it is zero only at μ = 0 and σ = 1, and grows
          as the distribution moves off centre or its spread moves away from 1. It is measured in nats: information counted with the
          natural logarithm, where bits use base 2. <code>Sampling</code> sums it over the 4 codings, averages it over the batch and adds
          it with <code>self.add_loss</code>. <R c={build} code />
        </P>
        <P>
          <code>KL_WEIGHT = 0.5 / 84</code>. The compiled loss <code>"mse"</code> is a mean over the 84 months, so dividing the summed KL
          by 84 puts it per month like the MSE (Géron divides by the 784 pixels of an MNIST image for the same reason); the 0.5 then
          halves it. <R c={build} code /> <R c={why} /> The weighing only makes sense because the sequences are scaled outside the model, so the decoder’s
          output and its MSE are in z-score units. <R c={mdCell('s10', 0)} />
        </P>
        <P>
          The half was tuned. At the full per-month weight only two codings stayed in use whatever the codings size, and the Dense
          model’s samples all came out at the same level. At half the weight a third coding came into use, the samples spread in level
          like the real data, and the validation reconstruction MAE improved from 0.95 to 0.93 °C (a separate comparison from 11·1’s
          Dense against Conv1D, with the same two numbers). A quarter freed a fourth coding but
          made more flat samples <R c={why} />: in the tuning log 16%, 22% and 26% of prior samples had a range under 10 °C at ×1, ×½
          and ×¼ (Conv1D, codings 4, three seeds; the final run at ×½ gives 21%) <R src="log" />.
        </P>
        <P>
          Training reuses <code>train_model</code>: Adam at learning rate 3e-3, batches of 32, up to 100 epochs, and early stopping with
          patience 20 on the validation loss that restores the best epoch’s weights <R c={codeCell('s5', 0)} code />, with loss and metric
          both <code>"mse"</code> <R c={fit} code />.
          <code> add_loss</code> feeds the loss but not the metrics, so the curve’s left panel is reconstruction plus weighted KL and the
          right panel reconstruction alone; the notebook checked that early stopping watches the total. <R c={why} />
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum">
            <span className="dlp2-fignum__v">43 / 23</span>
            <span className="dlp2-fignum__k">stopped / kept epoch <R c={fit} /></span>
          </div>
          <div className="dlp2-fignum">
            <span className="dlp2-fignum__v">0.0950</span>
            <span className="dlp2-fignum__k">val loss, MSE + weighted KL <R c={fit} /></span>
          </div>
          <div className="dlp2-fignum">
            <span className="dlp2-fignum__v">0.067</span>
            <span className="dlp2-fignum__k">val MSE, z-score units <R c={fit} /></span>
          </div>
          <div className="dlp2-fignum">
            <span className="dlp2-fignum__v">3 of 4</span>
            <span className="dlp2-fignum__k">codings in use · KL 0, 2.00, 0.75, 1.88 nats <R c={fit} /></span>
          </div>
        </div>
        <P>
          Three codings in use and one dead. The KL can’t go below zero, so a coding can only average 0 if the encoder gives μ = 0,
          σ = 1 for every sequence: the coding then carries nothing and the decoder learns to ignore it. <R c={fit} /> <R c={read} />
        </P>
        <P>
          This explainer’s reading, not the notebook’s: the KL is a price each coding pays for carrying information. If the three in use are the level and a two-number phase, as
          the notebook guesses, they already rebuild the validation sequences to a 0.940 °C error, so a fourth coding would buy little reconstruction for
          its cost; the cheapest answer is to switch it off completely, at KL 0. A heavier weight raises the price, which fits ×1
          keeping only two. <R c={read} /> <R c={why} />
        </P>
        <P>
          The printed numbers agree: 0.067 + (0.5 / 84) × (0 + 2.00 + 0.75 + 1.88) = 0.067 + 0.0276 = 0.0946, the validation loss of
          0.0950 to within the rounding of the printed values. <R c={fit} />
        </P>
        <P>
          Three numbers is one fewer than level, amplitude and a two-number phase. The notebook’s guess is that the three are the level
          and the two phase numbers, with the amplitude coming from how far from the origin the phase pair sits, which would also explain
          the flat samples in section 12. The curve shows very mild overfitting: the total validation loss runs level with or a touch
          below training until the mid 30s, and the reconstruction part creeps above training from about epoch 20. <R c={read} />
        </P>
      </Row>
    </Plate>
  );
}
