import { useState } from 'react';
import { Code } from '../../kit';
import { Lab, Stat } from '../ui';
import { useStudy } from '../context';
import { Diagram } from '../diagrams';
import { CAPTIONS, NAMED_CODE } from '../slideData';
import { loadRecon, useData } from '../fashion';
import { denseParams, fmt, fmtInt } from '../ae';
import { ReconGrid, LossCurve } from './parts';
import './labsPhases.css';

/* ============================================================================
   LECTURE 5 STUDY — LAB FOR §9
     PhasesLab   Figure 17-7 as a stepper: Phase 1 (784 → 100 → 784 on the
                 flattened images), Phase 2 (100 → 30 → 100 on the first
                 encoder's codings), Phase 3 (the stack), and slide 25's
                 optional fine-tuning — each with its data shapes, its
                 parameters, its lines of slide 24's code, and this page's
                 own run of it
   ========================================================================== */

const PHASES = [
  {
    key: 'p1',
    hl: ['p1'],
    name: 'Phase 1',
    what: 'Train the first autoencoder on the flattened images, to learn a compressed representation X₍₁₎ of the inputs.',
    shapes: ['X_train_flat (n, 784)', 'enc1: Dense(100, "relu") → X_train_enc1 (n, 100)', 'dec1: Dense(784) → (n, 784)'],
    target: 'X_train_flat, the inputs',
    params: [['enc1', denseParams(784, 100)], ['dec1', denseParams(100, 784)]],
    lines: [12, 13, 15, 16, 17, 18],
    code: 'TRAIN_1BY1',
  },
  {
    key: 'p2',
    hl: ['p2'],
    name: 'Phase 2',
    what: 'Using X₍₁₎ as input data, train the second autoencoder to learn an even more compressed representation X₍₂₎.',
    shapes: ['X_train_enc1 (n, 100)', 'enc2: Dense(30, "relu") → (n, 30)', 'dec2: Dense(100, "relu") → (n, 100)'],
    target: 'X_train_enc1, its own inputs',
    params: [['enc2', denseParams(100, 30)], ['dec2', denseParams(30, 100)]],
    lines: [20, 21, 22],
    code: 'TRAIN_1BY1',
  },
  {
    key: 'p3',
    hl: ['p3', 'copy'],
    name: 'Phase 3',
    what: 'Build a big sandwich using all these autoencoders: stacked_ae_1_by_1.',
    shapes: ['Flatten: (n, 28, 28) → (n, 784)', 'enc1 → (n, 100) · enc2 → (n, 30)', 'dec2 → (n, 100) · dec1 → (n, 784) · Reshape → (n, 28, 28)'],
    target: '(stacked; nothing trained in this step)',
    params: [['enc1 + enc2 + dec2 + dec1', denseParams(784, 100) + denseParams(100, 30) + denseParams(30, 100) + denseParams(100, 784)]],
    lines: [24, 25, 26, 27, 28, 29],
    code: 'TRAIN_1BY1',
  },
  {
    key: 'ft',
    hl: ['p3'],
    name: 'Fine-tune (slide 25)',
    what: 'If needed, continue training the full stacked autoencoder for a few epochs, then visualize its reconstructions.',
    shapes: ['X_train (n, 28, 28) → stacked_ae_1_by_1 → (n, 28, 28)'],
    target: 'X_train, the inputs',
    params: [['all four Dense layers', denseParams(784, 100) + denseParams(100, 30) + denseParams(30, 100) + denseParams(100, 784)]],
    lines: [3, 4, 5],
    code: 'CONTINUE_1BY1',
  },
];

export function PhasesLab() {
  const { printing } = useStudy();
  const data = useData(loadRecon);
  const [step, setStep] = useState(0);
  const at = printing ? PHASES.length - 1 : step;
  const ph = PHASES[at];
  const tr = data?.TRAINING.oneByOne;
  return (
    <Lab
      title="Figure 17-7, one phase at a time"
      fig={CAPTIONS.fig177}
      slides="slides 23–25"
      tryThis="before stepping to Phase 2, predict the shape of its input data and what its targets are. Then step on and notice whether the shapes and the highlighted lines of code match your prediction."
    >
      <div className="dl-lab__controls">
        <div className="dl5s-stepper">
          <button type="button" className="dl-btn" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={at === 0}>Back</button>
          <button type="button" className="dl-btn" onClick={() => setStep((v) => Math.min(PHASES.length - 1, v + 1))} disabled={at === PHASES.length - 1}>Next phase</button>
          <span className="dl5s-stepper__t"><b>{ph.name}</b> · step {at + 1} of {PHASES.length}</span>
        </div>
      </div>
      <div className="dl5s-ph">
        <div className="dl5s-ph__fig"><Diagram fig="phases" lab hl={ph.hl} /></div>
        <div className="dl5s-ph__side">
          <p className="dl5s-stagehead">{ph.name}</p>
          <p className="dl5s-readout">{ph.what}</p>
          <ol className="dl5s-ph__shapes">{ph.shapes.map((s) => <li key={s}><code>{s}</code></li>)}</ol>
          <p className="dl5s-readout"><b>Target:</b> {ph.target}</p>
          <div className="dl5s-stats dl5s-stats--tight">
            {ph.params.map(([k, v]) => <Stat key={k} k={k} v={fmtInt(v)} sub="parameters (this page’s working)" />)}
          </div>
        </div>
      </div>
      <div className="dl5s-scroll">
        <table className="dl5s-table dl5s-ph__table">
          <thead><tr><th>phase</th><th>input</th><th>codings</th><th>output (target)</th><th className="dl5s-num">parameters (this page’s working)</th></tr></thead>
          <tbody>
            <tr className={at === 0 ? 'dl5s-row--on' : undefined}><td>1</td><td>784 (flattened image)</td><td>100: X₍₁₎</td><td>784 (the input)</td><td className="dl5s-num">{fmtInt(denseParams(784, 100) + denseParams(100, 784))}</td></tr>
            <tr className={at === 1 ? 'dl5s-row--on' : undefined}><td>2</td><td>100 (X₍₁₎)</td><td>30: X₍₂₎</td><td>100 (X₍₁₎)</td><td className="dl5s-num">{fmtInt(denseParams(100, 30) + denseParams(30, 100))}</td></tr>
            <tr className={at >= 2 ? 'dl5s-row--on' : undefined}><td>3</td><td>28 × 28</td><td>30</td><td>28 × 28</td><td className="dl5s-num">{fmtInt(PHASES[2].params[0][1])}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="dl5s-noprint">
        <Code code={NAMED_CODE[ph.code]} label={ph.code === 'TRAIN_1BY1' ? 'slide 24' : 'slide 25'} meta={ph.name} hl={ph.lines} />
      </div>
      {tr && (at >= 2 || printing) && (
        <div className="dl5s-ph__run">
          <p className="dl5s-stagehead">This page’s run of slides 24–25</p>
          <div className="dl5s-ph__curves">
            <figure className="dl5s-ph__curve">
              <figcaption className="dl5s-mini">Phase 1 (784 → 100 → 784), MSE by epoch</figcaption>
              <LossCurve label="Phase 1 training and validation loss" series={[{ label: 'train', values: tr.phase1.loss, tone: 'a' }, { label: 'valid', values: tr.phase1.valLoss, tone: 'b' }]} />
            </figure>
            <figure className="dl5s-ph__curve">
              <figcaption className="dl5s-mini">Phase 2 (100 → 30 → 100, on X₍₁₎), MSE by epoch</figcaption>
              <LossCurve label="Phase 2 training and validation loss" series={[{ label: 'train', values: tr.phase2.loss, tone: 'a' }, { label: 'valid', values: tr.phase2.valLoss, tone: 'b' }]} />
            </figure>
          </div>
          <div className="dl5s-stats dl5s-stats--tight">
            <Stat k="stack, before fine-tuning" v={fmt(tr.validMseBeforeFineTune, 4)} sub="validation MSE" />
            <Stat k="after 5 more epochs" v={fmt(tr.finalValidMse, 4)} sub="validation MSE (slide 25’s fit)" tone="accent" />
          </div>
          <p className="dl5s-stagehead">stacked_ae_1_by_1’s reconstructions (slide 25’s check)</p>
          <div className="dl5s-scroll"><ReconGrid data={data} model="oneByOne" n={5} /></div>
          <p className="dl5s-figcap"><span className="dl5s-figcap__k">On slide 25:</span> {CAPTIONS.slide25}</p>
        </div>
      )}
      <p className="dl5s-cap">
        n is the number of images; the shapes follow slide 24’s code. Phase 2’s losses are measured on the 100 numbers of X₍₁₎, not on pixels, so they
        aren’t comparable with Phase 1’s. <span className="dl5s-own">this page’s own run</span> The curves, errors and reconstructions come from running
        slides 24–25’s code with TensorFlow on Fashion MNIST, not from the slides.
      </p>
    </Lab>
  );
}
