import { useState } from 'react';
import { Lab, Chips, Stat } from '../ui';
import { useStudy } from '../context';
import { Diagram } from '../diagrams';
import { denseParams, fmtInt } from '../ae';
import './labsPretrain.css';

/* ============================================================================
   LECTURE 5 STUDY — LAB FOR §7
     PretrainLab   Figure 17-6 as a stepper: train the autoencoder on all the
                   data (no labels) → copy Hidden 1 and Hidden 2 → add the new
                   output layer and softmax → train on the labelled data.
                   Which layers are reused and which are new, and how many
                   parameters still need training (this page's example sizes:
                   slide 12's encoder and a 10-class output layer)
   ========================================================================== */

const STEPS = [
  { hl: ['p1', 'copy'], title: 'Phase 1 · train the autoencoder on all the data', text: 'Train a stacked autoencoder on all the training data. This needs no labels: the inputs are their own targets.' },
  { hl: ['copy'], title: 'Copy the lower layers', text: 'Reuse the trained autoencoder’s lower layers, Hidden 1 and Hidden 2 (its encoder). Their parameters are copied into a new network for the actual task.' },
  { hl: ['head'], title: 'Add the new top', text: 'On top of the copied layers goes a new Output layer with a Softmax, for the classification task. Hidden 3 and the autoencoder’s Output layer are not reused.' },
  { hl: ['head', 'copy'], title: 'Phase 2 · train the classifier on the labelled data', text: 'Train the new network using the labelled data. The copied layers already hold feature detectors, so there is less left to learn, and it can cope with fewer labelled examples.' },
];

// this page's example sizes: slide 12's encoder (784 → 100 → 30) and an output
// layer for Fashion MNIST's 10 classes
const REUSED = [{ name: 'Hidden 1', p: denseParams(784, 100) }, { name: 'Hidden 2', p: denseParams(100, 30) }];
const HEAD = { name: 'Output (10 classes) + Softmax', p: denseParams(30, 10) };

export function PretrainLab() {
  const { printing } = useStudy();
  const [step, setStep] = useState(0);
  const [frozen, setFrozen] = useState(true);
  const at = printing ? STEPS.length - 1 : step;
  const s = STEPS[at];
  const reused = REUSED.reduce((a, r) => a + r.p, 0);
  const training = frozen ? HEAD.p : reused + HEAD.p;
  return (
    <Lab
      title="Figure 17-6, step by step"
      slides="slides 16–17"
      tryThis="before the last step, predict how many parameters the classifier still has to learn from labelled data. Then switch the copied layers between fixed and trained, and notice the difference."
    >
      <div className="dl-lab__controls">
        <div className="dl5s-stepper">
          <button type="button" className="dl-btn" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={at === 0}>Back</button>
          <button type="button" className="dl-btn" onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))} disabled={at === STEPS.length - 1}>Next step</button>
          <span className="dl5s-stepper__t">step <b>{at + 1}</b> of {STEPS.length}</span>
        </div>
        <Chips label="copied layers" value={frozen} options={[{ v: true, l: 'kept fixed' }, { v: false, l: 'trained further' }]} onChange={setFrozen} />
      </div>
      <div className="dl5s-pre">
        <div className="dl5s-pre__fig"><Diagram fig="pretrain" lab hl={s.hl} /></div>
        <div className="dl5s-pre__side">
          <p className="dl5s-stagehead">{s.title}</p>
          <p className="dl5s-readout">{s.text}</p>
          <div className="dl5s-scroll">
            <table className="dl5s-table">
              <thead><tr><th>layer</th><th>where from</th><th className="dl5s-num">parameters</th></tr></thead>
              <tbody>
                {REUSED.map((r) => <tr key={r.name}><td>{r.name}</td><td>copied (Phase 1)</td><td className="dl5s-num">{fmtInt(r.p)}</td></tr>)}
                <tr><td>{HEAD.name}</td><td>new</td><td className="dl5s-num">{fmtInt(HEAD.p)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="dl5s-stats dl5s-stats--tight">
            <Stat k="learned without labels" v={fmtInt(reused)} sub="Phase 1, all the data" />
            <Stat k="to learn from labelled data" v={fmtInt(training)} tone="accent" sub={frozen ? 'only the new layer' : 'the new layer and the copied ones'} />
          </div>
        </div>
      </div>
      <p className="dl5s-cap">
        The figure is Figure 17-6 redrawn; the numbers are this page’s example, not the slides’: slide 12’s encoder sizes (784 → 100 → 30) with a
        10-class output layer, as for Fashion MNIST. The slides say the new network has “fewer layers that require training”. They don’t say whether the
        copied layers are then kept fixed or trained further, so the page shows both.
      </p>
    </Lab>
  );
}
