import { useMemo, useRef, useState } from 'react';
import { Code } from '../../kit';
import { Lab, Chips, Stat } from '../ui';
import { useStudy } from '../context';
import { Diagram } from '../diagrams';
import { CAPTIONS, MODELS, NAMED_CODE } from '../slideData';
import { useVae, useData, loadGan } from '../fashion';
import { ToyGan, GAN_PRESETS, maxChange, decode, toBytes, normals, rng, flow, shapeText, fmt, fmtInt } from '../gen';
import { ImgGrid, Pending } from './parts';
import './labsGan.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LABS FOR §7–§9 (THE GAN)
     GanRolesLab      Figure 17-14 with the two roles, and slide 20's point
                      that the generator does a VAE decoder's job: slide 23's
                      generator next to slide 14's decoder, layer by layer,
                      and images out of each
     PhaseStepperLab  slides 21–22 run for real on this page's toy GAN: each
                      phase's batch and labels, and which network's weights
                      actually changed
     GanCodeLab       slide 25's loop mapped onto the two phases, line by
                      line, with each tensor's shape for slide 24's batch of 32
                      and slide 23's codings_size = 30; the parameter counts;
                      and what this page's TensorFlow run observed about the
                      `trainable` lines
   ========================================================================== */

const GEN = flow(MODELS.generator);
const DISC = flow(MODELS.discriminator);
const VDEC = flow(MODELS.variational_decoder);

const ROLES = {
  generator: {
    hl: ['gen'],
    name: 'Generator',
    goal: 'Goal = trick the discriminator',
    input: 'a random distribution (typically a Gaussian): think of it as the codings of the image to be generated',
    output: 'some data, typically an image',
    text: 'It offers the same functionality as a decoder in a VAE: feed it some Gaussian noise, and it outputs a new image.',
  },
  discriminator: {
    hl: ['disc', 'real'],
    name: 'Discriminator',
    goal: 'Goal = tell fake from real',
    input: 'either a fake image from the generator or a real image from the training set',
    output: 'its guess: is the input image fake or real?',
    text: 'In slide 23’s code it is a regular binary classifier, ending in Dense(1, activation="sigmoid").',
  },
};

export function GanRolesLab() {
  const { printing } = useStudy();
  const vae = useVae();
  const gan = useData(loadGan);
  const [role, setRole] = useState('generator');
  const r = ROLES[role];
  const vaeImgs = useMemo(() => {
    if (!vae) return null;
    const rr = rng(4242);
    return Array.from({ length: 7 }, () => toBytes(decode(vae.dec, normals(rr, vae.VAE.codingsSize))));
  }, [vae]);
  const G = gan?.GAN;
  const last = G?.snapshots[G.snapshots.length - 1];
  return (
    <Lab
      title="Figure 17-14: who does what"
      fig={CAPTIONS.fig1714}
      slides="slides 19–20"
      tryThis="predict what each network takes in and puts out before picking it. Then compare the generator with the VAE’s decoder, layer by layer: notice how little differs."
    >
      <div className="dl-lab__controls">
        <Chips label="network" value={role} options={[{ v: 'generator', l: 'the generator' }, { v: 'discriminator', l: 'the discriminator' }]} onChange={setRole} />
      </div>
      <div className="dl67s-gr">
        <div className="dl67s-gr__fig">{printing ? <Diagram fig="gan" /> : <Diagram fig="gan" lab hl={r.hl} />}</div>
        <div className="dl67s-gr__side">
          {(printing ? Object.values(ROLES) : [r]).map((x) => (
            <div key={x.name} className="dl67s-gr__role">
              <p className="dl67s-stagehead">{x.name} · {x.goal}</p>
              <p className="dl67s-readout"><b>Takes:</b> {x.input}.</p>
              <p className="dl67s-readout"><b>Outputs:</b> {x.output}.</p>
              <p className="dl67s-readout">{x.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="dl67s-gr__cmp">
        <p className="dl67s-stagehead">Slide 20: “the generator offers the same functionality as a decoder in a VAE”</p>
        <div className="dl67s-scroll">
          <table className="dl67s-table">
            <thead><tr><th>step</th><th>generator (slide 23)</th><th>VAE’s variational_decoder (slide 14)</th></tr></thead>
            <tbody>
              <tr><td>input</td><td>{GEN.rows[0].in[0]} random numbers (codings_size = 30)</td><td>{VDEC.rows[0].in[0]} codings (codings_size, 10 on this page)</td></tr>
              {GEN.rows.map((g, i) => (
                <tr key={i}>
                  <td>layer {i + 1}</td>
                  <td><code>{g.call}</code></td>
                  <td><code>{VDEC.rows[i].call}</code></td>
                </tr>
              ))}
              <tr><td>output</td><td>{shapeText(GEN.out)} image, pixels in [0, 1] (sigmoid)</td><td>{shapeText(VDEC.out)} image (no activation)</td></tr>
            </tbody>
            <tfoot><tr><td>parameters</td><td>{fmtInt(GEN.total)}</td><td>{fmtInt(VDEC.total)}</td></tr></tfoot>
          </table>
        </div>
        <div className="dl67s-gr__imgs">
          <div>
            <p className="dl67s-mini">this page’s GAN generator, fed Gaussian noise{G ? ` (after ${G.epochsRun} epochs)` : ''}</p>
            {last ? <ImgGrid cells={last.images.slice(0, 7).map((b64, i) => ({ b64, label: `GAN sample ${i + 1}` }))} cols={7} label="Seven images from this page's GAN generator" /> : <Pending />}
          </div>
          <div>
            <p className="dl67s-mini">this page’s VAE decoder, fed Gaussian noise (decoded here)</p>
            {vaeImgs ? <ImgGrid cells={vaeImgs.map((px, i) => ({ px, label: `VAE sample ${i + 1}` }))} cols={7} label="Seven images from this page's VAE decoder" /> : <Pending />}
          </div>
        </div>
      </div>
      <p className="dl67s-cap">
        The layer lists are slides 23 and 14; the parameter counts are this page’s working (TensorFlow agrees). The two networks differ in their input size, the
        He initialization and the generator’s sigmoid output. <span className="dl67s-own">this page’s own run</span> Both rows of images come from this page’s
        TensorFlow runs of the slides’ models (the GAN of slides 23–25, the VAE of slides 14–15), not from the slides.
      </p>
    </Lab>
  );
}

/* ── §8 · the two phases, run for real on the toy GAN ───────────────────── */
const LEARN = ['learn'];
const PHASE_LINES = { 1: [7, 8, 9, 10, 11, 12, 13], 2: [14, 15, 16, 17, 18, 19, 20] };

function Batch({ fake, real, fakeLabel }) {
  const cell = (v, kind, label, k) => (
    <span key={`${kind}${k}`} className={`dl67s-batch__c dl67s-batch__c--${kind}`} title={`${kind} ${fmt(v, 2)}, label ${label}`}>{label}</span>
  );
  return (
    <div className="dl67s-batch">
      <div className="dl67s-batch__row">
        <span className="dl67s-batch__k">{fake.length} fake</span>
        <span className="dl67s-batch__cells">{fake.map((v, k) => cell(v, 'fake', fakeLabel, k))}</span>
      </div>
      {real && (
        <div className="dl67s-batch__row">
          <span className="dl67s-batch__k">{real.length} real</span>
          <span className="dl67s-batch__cells">{real.map((v, k) => cell(v, 'real', 1, k))}</span>
        </div>
      )}
    </div>
  );
}

function runPhase(gan, phase) {
  const before = gan.snapshot();
  const res = phase === 1 ? gan.phase1() : gan.phase2();
  const after = gan.snapshot();
  return {
    phase,
    fake: res.fake,
    real: res.real ?? null,
    loss: res.loss,
    dG: maxChange(before.G, after.G),
    dD: maxChange(before.D, after.D),
  };
}

export function PhaseStepperLab() {
  const { printing } = useStudy();
  const ganRef = useRef(null);
  const [log, setLog] = useState([]);
  const next = log.length ? (log[log.length - 1].phase === 1 ? 2 : 1) : 1;
  const run = (phase) => {
    ganRef.current ??= new ToyGan(GAN_PRESETS.one);
    const entry = runPhase(ganRef.current, phase);
    setLog((l) => [...l, entry].slice(-8));
  };
  const reset = () => { ganRef.current = null; setLog([]); };
  // the PDF shows one full iteration, computed on its own toy GAN
  const printed = useMemo(() => {
    if (!printing) return null;
    const g = new ToyGan(GAN_PRESETS.one);
    return [runPhase(g, 1), runPhase(g, 2)];
  }, [printing]);
  const shown = printed ?? log;
  const cur = shown[shown.length - 1];
  return (
    <Lab
      title="The two phases, run for real"
      slides="slides 21–22"
      tryThis="before running phase 2, predict which network’s weights will change and which will stay exactly the same. Run the phases in turn, and check the two “largest weight change” numbers each time."
    >
      <div className="dl-lab__controls">
        <div className="dl67s-stepper">
          <button type="button" className="dl-btn" onClick={() => run(1)}>Run phase 1: train the discriminator</button>
          <button type="button" className="dl-btn" onClick={() => run(2)}>Run phase 2: train the generator</button>
          <button type="button" className="dl-btn" onClick={reset} disabled={!log.length}>Reset</button>
          <span className="dl67s-stepper__t">next in the loop: <b>phase {next}</b></span>
        </div>
      </div>
      <div className="dl67s-ps">
        <div className="dl67s-ps__main">
          <Diagram fig="phases" lab hl={cur ? LEARN : undefined} />
          {cur ? (
            <>
              <p className="dl67s-stagehead">Phase {cur.phase}’s batch: {cur.phase === 1 ? 'fake labelled 0, real labelled 1' : 'fake only, all labelled 1'}</p>
              <Batch fake={cur.fake} real={cur.real} fakeLabel={cur.phase === 1 ? 0 : 1} />
              <div className="dl67s-stats dl67s-stats--tight">
                <Stat k="discriminator: largest weight change" v={cur.dD === 0 ? '0 (unchanged)' : fmt(cur.dD, 5)} tone={cur.phase === 1 ? 'accent' : undefined} sub={cur.phase === 1 ? 'it learns in phase 1' : 'frozen in phase 2'} />
                <Stat k="generator: largest weight change" v={cur.dG === 0 ? '0 (unchanged)' : fmt(cur.dG, 5)} tone={cur.phase === 2 ? 'accent' : undefined} sub={cur.phase === 2 ? 'it learns in phase 2' : 'only used to make the fakes'} />
                <Stat k="binary cross-entropy" v={fmt(cur.loss, 3)} sub={`phase ${cur.phase}’s loss on this batch`} />
              </div>
            </>
          ) : <p className="dl67s-readout">Run phase 1 to see its batch.</p>}
        </div>
        <div className="dl67s-noprint dl67s-ps__code">
          <Code code={NAMED_CODE.GAN_TRAIN} label="slide 25" meta={cur ? `phase ${cur.phase}` : 'train_gan'} hl={cur ? PHASE_LINES[cur.phase] : undefined} />
        </div>
      </div>
      {shown.length > 1 && (
        <div className="dl67s-scroll">
          <table className="dl67s-table dl67s-ps__log">
            <thead><tr><th>step</th><th>phase</th><th className="dl67s-num">discriminator Δ</th><th className="dl67s-num">generator Δ</th></tr></thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={i}><td>{i + 1}</td><td>{e.phase}</td><td className="dl67s-num">{e.dD === 0 ? '0' : fmt(e.dD, 5)}</td><td className="dl67s-num">{e.dG === 0 ? '0' : fmt(e.dG, 5)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own toy run</span> The §9 toy GAN, where each “image” is one number: batches of 32 as on slide 24, binary
        cross-entropy, one RMSprop step per phase. The toy is written to follow the slides’ rule (each phase updates one network), so the zeros confirm it
        rather than test Keras; §9 measures the slides’ own Keras code. “Largest weight change” is the biggest change to any one weight or bias in that step,
        measured by comparing copies of the weights before and after.<span className="dl67s-screenonly"> Hover a cell to see its number.</span>
      </p>
    </Lab>
  );
}

/* ── §9 · slide 25's loop, mapped onto the two phases ───────────────────── */
const PARTS = {
  p1: { l: 'phase 1 (lines 7–13)', lines: [7, 8, 9, 10, 11, 12, 13] },
  p2: { l: 'phase 2 (lines 14–20)', lines: [14, 15, 16, 17, 18, 19, 20] },
  star: { l: 'the # *** lines', lines: [12, 19] },
  loop: { l: 'the loops', lines: [1, 2, 3, 4, 5, 6, 22] },
};
const B = 32;
const CS = 30;
const TENSORS = [
  { name: 'X_batch', shape: [B, 28, 28], from: 'the dataset (slide 24): 32 real images', part: 'p1' },
  { name: 'noise', shape: [B, CS], from: 'tf.random.normal(shape=[batch_size, codings_size])', part: 'p1' },
  { name: 'generated_images', shape: [B, 28, 28], from: 'generator(noise)', part: 'p1' },
  { name: 'X_fake_and_real', shape: [2 * B, 28, 28], from: 'tf.concat([generated_images, X_batch], axis=0)', part: 'p1' },
  { name: 'y1', shape: [2 * B, 1], from: '32 × [0.] then 32 × [1.]', part: 'p1' },
  { name: 'noise', shape: [B, CS], from: 'a new draw', part: 'p2' },
  { name: 'y2', shape: [B, 1], from: '32 × [1.]', part: 'p2' },
];

export function GanCodeLab() {
  const gan = useData(loadGan);
  const [part, setPart] = useState('p1');
  const G = gan?.GAN;
  const t = G?.trainableTest;
  return (
    <Lab
      title="train_gan, line by line"
      slides="slides 23–25"
      tryThis="predict the shape of X_fake_and_real and of y1 for a batch of 32 before reading the table. Then switch to the # *** lines and read what this page’s run saw them do."
    >
      <div className="dl-lab__controls">
        <Chips label="highlight" value={part} options={Object.entries(PARTS).map(([v, p]) => ({ v, l: p.l }))} onChange={setPart} />
      </div>
      <div className="dl67s-gc">
        <div className="dl67s-gc__side">
          <p className="dl67s-stagehead">The tensors in one iteration (batch_size = 32, codings_size = 30)</p>
          <div className="dl67s-scroll">
            <table className="dl67s-table">
              <thead><tr><th>tensor</th><th>shape</th><th>from</th></tr></thead>
              <tbody>
                {TENSORS.map((x, i) => (
                  <tr key={i} className={x.part === part ? 'dl67s-row--on' : undefined}><td><code>{x.name}</code></td><td className="dl67s-nowrap">({x.shape.join(', ')})</td><td><code>{x.from}</code></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dl67s-stagehead">Parameters (this page’s working)</p>
          <div className="dl67s-stats dl67s-stats--tight">
            <Stat k="generator" v={fmtInt(GEN.total)} sub="3,100 + 15,150 + 118,384" />
            <Stat k="discriminator" v={fmtInt(DISC.total)} sub="117,750 + 15,100 + 101" />
            <Stat k="gan" v={fmtInt(GEN.total + DISC.total)} sub="both: gan.train_on_batch would train all of these if the discriminator weren’t frozen" />
          </div>
        </div>
        <div className="dl67s-noprint dl67s-gc__code">
          <Code code={NAMED_CODE.GAN_TRAIN} label="slide 25" meta={PARTS[part].l} hl={PARTS[part].lines} />
        </div>
      </div>
      <div className="dl67s-gc__star">
        <p className="dl67s-stagehead">The # *** lines: what this page’s TensorFlow run observed</p>
        {!t ? <Pending /> : <TrainableTable t={t} />}
      </div>
      <p className="dl67s-cap">
        Shapes are this page’s working from slides 23–25 (32 real images per batch because <code>batch_size = 32</code>; <code>drop_remainder=True</code> drops the last, shorter batch). Phase 1 trains{' '}
        <code>discriminator</code> on 64 images; phase 2 trains <code>gan</code>, the generator and the discriminator stacked, on 32 noise vectors whose
        target is “real”.
      </p>
    </Lab>
  );
}

const TRAINABLE_ROWS = [
  ['verbatim', 'slides 24–25 as printed (with the two # *** lines)'],
  ['withoutToggles', 'the same, without the two # *** lines'],
  ['geronOriginal', 'Géron’s book: trainable = False between the two compile() calls, no # *** lines (not on the slides)'],
];

function TrainableTable({ t }) {
  const c = (v) => (v === 0 ? '0' : fmt(v, 4));
  const rows = TRAINABLE_ROWS.filter(([k]) => t[k]?.iterations?.length);
  return (
    <>
      <div className="dl67s-scroll">
        <table className="dl67s-table">
          <thead>
            <tr><th>the loop, first iteration</th><th className="dl67s-num">phase 1: discriminator</th><th className="dl67s-num">phase 1: generator</th><th className="dl67s-num">phase 2: discriminator</th><th className="dl67s-num">phase 2: generator</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, l]) => {
              const x = t[k].iterations[0];
              const bad = (k === 'verbatim' || k === 'withoutToggles') && x.phase2.discriminator > 0;
              return (
                <tr key={k} className={bad ? 'dl67s-row--on' : undefined}>
                  <td>{l}{t[k].warnings?.length ? <span className="dl67s-mini"> · Keras warned: {t[k].warnings.join(' ')}</span> : null}</td>
                  <td className="dl67s-num">{c(x.phase1.discriminator)}</td>
                  <td className="dl67s-num">{c(x.phase1.generator)}</td>
                  <td className="dl67s-num">{c(x.phase2.discriminator)}</td>
                  <td className="dl67s-num">{c(x.phase2.generator)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dl67s-readout">
        Each number is the largest change to any one weight of that network during that phase’s <code>train_on_batch</code> (0 = untouched).
        As printed, phase 1 trains only the discriminator and phase 2 only the generator. Without the two lines, phase 2 trains the discriminator too.
        {t.traceCheck ? ' Keras 3.15.1 reads trainable when a model’s train_on_batch first runs, and keeps that setting: flipping it in later iterations changed nothing in this run. In the slide’s loop the flags are already right at those first calls.' : ''}
      </p>
    </>
  );
}
