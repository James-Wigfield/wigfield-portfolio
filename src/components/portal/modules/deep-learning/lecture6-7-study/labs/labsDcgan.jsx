import { useState } from 'react';
import { Code } from '../../kit';
import { Lab, Chips, Stat } from '../ui';
import { CAPTIONS, GUIDELINES, GUIDELINE_CHECKS, MODELS, NAMED_CODE } from '../slideData';
import { useData, loadGan, loadDcgan } from '../fashion';
import { flow, shapeText, fmtInt } from '../gen';
import { ImgGrid, LossCurve, Pending } from './parts';
import './labsDcgan.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LABS FOR §10–§11 (WHAT THE GANs MAKE; THE DCGAN)
     GanSamplesLab     this page's run of slides 23–25's GAN: the same noise
                       vectors decoded after epoch 1 (Figure 17-15's moment),
                       part-way, and at the end
     DcganLab          slide 28's five guidelines held against slide 29's
                       code, line by line; and the DCGAN's shapes and
                       parameters, layer by layer
     DcganSamplesLab   this page's run of slide 29's DCGAN, the same way
   ========================================================================== */

function Samples({ run, which, fig, figLabel }) {
  const [at, setAt] = useState(run.snapshots.length - 1);
  const s = run.snapshots[at];
  const cols = s.images.length >= 21 ? 7 : s.images.length;
  const h = run.history;
  return (
    <>
      <div className="dl-lab__controls">
        <Chips
          label="after"
          value={at}
          options={run.snapshots.map((x, i) => ({ v: i, l: `epoch ${x.epoch}`, tag: x.epoch === fig ? figLabel : undefined }))}
          onChange={setAt}
        />
      </div>
      <div className="dl67s-sm">
        <div className="dl67s-sm__grid">
          <ImgGrid cells={s.images.map((b64, i) => ({ b64, label: `${which} sample ${i + 1} after epoch ${s.epoch}` }))} cols={cols} label={`${s.images.length} images from this page's ${which} after epoch ${s.epoch}`} />
          <p className="dl67s-mini">{s.images.length} images after epoch {s.epoch} of this page’s {run.epochsRun}; the same {s.images.length} noise vectors at every epoch</p>
        </div>
        <div className="dl67s-sm__side">
          {h?.dLoss?.length > 1 && (
            <figure className="dl67s-sm__curve">
              <figcaption className="dl67s-stagehead">mean loss per epoch (this page’s logging)</figcaption>
              <LossCurve label={`${which}: the discriminator's and the generator's mean loss per epoch`} series={[{ label: 'phase 1', values: h.dLoss, tone: 'a' }, { label: 'phase 2', values: h.gLoss, tone: 'b' }]} />
            </figure>
          )}
          <div className="dl67s-stats dl67s-stats--tight">
            <Stat k="epochs, this page’s run" v={String(run.epochsRun)} sub={`the slides’ code: n_epochs=${run.epochsSlide}`} />
            <Stat k="codings_size" v={String(run.codingsSize)} sub={`batch ${run.batchSize}`} />
          </div>
        </div>
      </div>
    </>
  );
}

export function GanSamplesLab() {
  const data = useData(loadGan);
  const G = data?.GAN;
  return (
    <Lab
      title="What this page’s GAN generated, epoch by epoch"
      fig={CAPTIONS.fig1715}
      slides="slide 26"
      tryThis="predict whether the images will be sharper at the end than after epoch 1. Step through the epochs and notice what improves, and what doesn’t."
    >
      {!G ? <Pending /> : <Samples run={G} which="GAN" fig={1} figLabel="as Figure 17-15" />}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> Slides 23–25’s GAN trained with TensorFlow on Fashion MNIST
        {G ? ` for ${G.epochsRun} epochs (the slide’s train_gan call says n_epochs=${G.epochsSlide})` : ''}, and the same fixed noise vectors fed to its generator
        after each listed epoch. Figure 17-15 shows the slide’s own GAN after one epoch: “very noisy” images that, slide 26 says, never really get much
        better. The phase 1 and phase 2 losses are the mean <code>train_on_batch</code> values over each epoch, logged by this page (slide 25’s loop doesn’t record them).
      </p>
    </Lab>
  );
}

export function DcganSamplesLab() {
  const data = useData(loadDcgan);
  const D = data?.DCGAN;
  return (
    <Lab
      title="What this page’s DCGAN generated"
      fig={CAPTIONS.fig1716}
      slides="slide 30"
      tryThis="compare these with §10’s GAN images at the same epoch: predict which network’s images are sharper, then check."
    >
      {!D ? <Pending /> : <Samples run={D} which="DCGAN" fig={50} figLabel="as Figure 17-16" />}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> Slide 29’s DCGAN trained with TensorFlow on Fashion MNIST
        {D ? ` for ${D.epochsRun} epochs` : ''}, compiled and trained like the GAN (“similar to the code for GANs”). Before training, this page rescaled the images to
        [−1, 1] and gave them a channel axis (<code>X_train.reshape(-1, 28, 28, 1) * 2. - 1.</code>, as in Géron’s notebook): a step not on the slides, to match the
        generator’s tanh output and the first Conv2D’s input. The tanh outputs are drawn as (x + 1) / 2. Figure 17-16 shows the slide’s DCGAN after 50 epochs.
      </p>
    </Lab>
  );
}

/* ── §11 · the guidelines against the code ──────────────────────────────── */
const DG = flow(MODELS.dcgan_generator);
const DD = flow(MODELS.dcgan_discriminator);

function DcTable({ f, head }) {
  return (
    <table className="dl67s-table dl67s-dc__table">
      <thead><tr><th>{head}</th><th>output</th><th className="dl67s-num">parameters</th></tr></thead>
      <tbody>
        {f.rows.map((r, i) => (
          <tr key={i}>
            <td><code>{r.call}</code></td>
            <td>{shapeText(r.out)}</td>
            <td className="dl67s-num">{fmtInt(r.params)}{r.type === 'BatchNormalization' ? ` (${fmtInt(r.trainable)} trainable)` : ''}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={2}>total ({fmtInt(f.trainable)} trainable)</td><td className="dl67s-num">{fmtInt(f.total)}</td></tr></tfoot>
    </table>
  );
}

export function DcganLab() {
  const [g, setG] = useState(1);
  const [view, setView] = useState('guide');
  const c = GUIDELINE_CHECKS[g];
  return (
    <Lab
      title="Slide 28’s guidelines, held against slide 29’s code"
      slides="slides 28–29"
      tryThis="for each guideline, predict whether slide 29’s code follows it before clicking. Then click it to light up the lines that decide."
    >
      <div className="dl-lab__controls">
        <Chips label="show" value={view} options={[{ v: 'guide', l: 'the five guidelines' }, { v: 'shapes', l: 'shapes and parameters' }]} onChange={setView} />
      </div>
      <div className={view === 'guide' ? 'dl67s-dc' : 'dl67s-dc dl67s-screenonly-hidden'}>
        <ol className="dl67s-dc__list">
          {GUIDELINES.map((text, i) => {
            const ck = GUIDELINE_CHECKS[i];
            return (
              <li key={i} className={`dl67s-dc__item${i === g ? ' dl67s-dc__item--on' : ''}`}>
                <button type="button" className="dl67s-dc__btn" aria-pressed={i === g} onClick={() => setG(i)}>
                  <span className="dl67s-dc__no">{i + 1}</span>
                  <span className="dl67s-dc__text">{text}</span>
                  <span className={`dl67s-dc__status dl67s-dc__status--${ck.status}`}><span className="dl67s-dot" />{ck.status === 'yes' ? 'followed' : 'partly'}</span>
                </button>
                <p className="dl67s-printonly dl67s-readout">{ck.note}</p>
              </li>
            );
          })}
        </ol>
        <div className="dl67s-dc__side">
          <p className="dl67s-readout dl67s-noprint"><b>Guideline {g + 1}:</b> {c.note}</p>
          <div className="dl67s-noprint"><Code code={NAMED_CODE.DCGAN} label="slide 29" meta={`guideline ${g + 1}`} hl={c.lines} /></div>
        </div>
      </div>
      <div className={view === 'shapes' ? 'dl67s-dc__shapes' : 'dl67s-dc__shapes dl67s-screenonly-hidden'}>
        <div className="dl67s-scroll"><DcTable f={DG} head="generator (codings_size = 100)" /></div>
        <div className="dl67s-scroll"><DcTable f={DD} head="discriminator (reads the 28 × 28 × 1 output)" /></div>
        <div className="dl67s-stats dl67s-stats--tight">
          <Stat k="generator" v={fmtInt(DG.total)} sub={`${fmtInt(DG.trainable)} trainable; BatchNormalization’s moving mean and variance are not`} />
          <Stat k="discriminator" v={fmtInt(DD.total)} />
          <Stat k="gan" v={fmtInt(DG.total + DD.total)} sub="this page’s working" />
          <Stat k="upsampling" v="7 → 14 → 28" sub="two strides=2 transposed convolutions with padding “same”" />
        </div>
      </div>
      <p className="dl67s-cap">
        The guideline text is slide 28’s; the verdicts are this page’s reading of slide 29’s code. Slide 28 says the guidelines “will work in many cases, but
        not always”. Shapes and parameter counts are this page’s working with Keras’s rules (TensorFlow agrees): a 5 × 5 kernel has 25 weights per input
        channel per filter, and BatchNormalization keeps 4 numbers per channel, 2 of them trained (4 × 128 = 512 for the first one).
      </p>
    </Lab>
  );
}
