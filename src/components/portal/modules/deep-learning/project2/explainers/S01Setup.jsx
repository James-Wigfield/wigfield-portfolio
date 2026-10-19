import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import SeedScene from './scenes/Seed';

/* ============================================================================
   PLATE 1·1 — same seed, same numbers (cells 1–2)
   ========================================================================== */

const MD = mdCell('s1', 0); // cell 1
const SETUP = codeCell('s1', 0); // In [1]

export function SeedPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('s1')}>
      <Row label="Task">
        <p className="dlp2-task">Make a re-run of the notebook reproduce the numbers quoted in its text.</p>
      </Row>
      <Row label="How it works" wide>
        <SeedScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          The setup cell does three things before any data is loaded <R c={SETUP} code />. It sets <code>TF_CPP_MIN_LOG_LEVEL</code> to
          "3" ahead of the TensorFlow import, which the notebook says hides TensorFlow’s own log lines; on this GPU they include a stream
          of harmless warnings about compiling kernels for a card newer than the TensorFlow build <R c={MD} />. For the saved run the variable
          was also set in the kernel’s environment: inside Jupyter the cell line alone did not hide them, and a run with only the cell line
          carried about 55 of them <R src="handover" />. It calls <code>keras.utils.set_random_seed(42)</code>, and it switches on op
          determinism <R c={MD} />.
        </P>
        <P>
          The seed alone was not enough. In the environment checks, the same seeded run on the GPU without op determinism gave val_mae
          1.591829 one time and 1.591826 the next; with determinism on the two runs matched to every digit, at no cost for the tanh GRU,
          which runs on cuDNN (the GPU’s fast GRU routine) <R src="log" />. The cause is ordinary: a GPU adds many numbers in parallel, the order the partial sums meet can change
          between runs, and a floating-point sum comes out very slightly different when the order changes.
        </P>
        <P>
          Three different things are called a kernel in this explainer. The Jupyter kernel runs the notebook (tf-2.20-gpu, a kernel name only;
          it runs TensorFlow 2.21.0 <R c={SETUP} />). A GPU kernel is a
          compiled routine the card runs, which is what those log warnings are about. A layer’s kernel is Keras’s name for its main
          weight matrix, and the seed decides where those weights start.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          TensorFlow 2.21.0, Keras 3.15.1 and NumPy 2.5.2, with one GPU found <R c={SETUP} />. Two trial runs and five final runs on this
          GPU printed identical numbers, and the final run took 3 min 49 s for the whole notebook <R src="handover" />.
        </P>
        <P>
          On other hardware the numbers move a little. A CPU run matched every GRU result to within 0.001 with the same stopping epochs,
          but the VAE stopped after 49 epochs with its best at 29, where the saved run has 43 and 23 <R src="handover" />. That is why
          the notebook says the values quoted in its text are the ones from the saved run <R c={MD} />.
        </P>
      </Row>
    </Plate>
  );
}
