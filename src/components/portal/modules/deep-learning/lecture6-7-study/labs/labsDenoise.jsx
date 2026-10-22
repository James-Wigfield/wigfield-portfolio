import { useMemo, useState } from 'react';
import { Lab, Chips, Range, Stat } from '../ui';
import { CAPTIONS } from '../slideData';
import { useData, loadDenoise, decodeImg, CLASS_NAMES } from '../fashion';
import { rng, gauss, fmt, fmtInt } from '../gen';
import { ImgRows, Pending } from './parts';
import './labsDenoise.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LABS FOR §2
     NoiseLab        Figure 17-8's two kinds of noise on real Fashion MNIST
                     images: dropout as slide 9 implements it (half the
                     pixels switched off) with this page's trained
                     dropout_ae's reconstructions, or Gaussian noise added
                     in the browser (no model on the slides is trained on it)
     CodingSizeLab   slide 7's undercomplete vs overcomplete: the coding
                     layer against the 784 inputs
   ========================================================================== */

const N = 6;

function gaussNoisy(b64, sd, seed) {
  const px = decodeImg(b64);
  const r = rng(seed);
  return Uint8Array.from(px, (v) => Math.round(Math.min(1, Math.max(0, v / 255 + sd * gauss(r))) * 255));
}

export function NoiseLab() {
  const data = useData(loadDenoise);
  const [kind, setKind] = useState('dropout');
  const [sd, setSd] = useState(0.2);
  const D = data?.DENOISE;
  const items = D?.items.slice(0, N) ?? [];
  // share of the ink pixels that the exported noisy images switched off
  const off = useMemo(() => {
    if (!D) return null;
    let ink = 0;
    let gone = 0;
    D.items.forEach((it) => {
      const o = decodeImg(it.original);
      const n = decodeImg(it.noisy);
      for (let i = 0; i < 784; i++) if (o[i] > 0) { ink += 1; if (n[i] === 0) gone += 1; }
    });
    return gone / ink;
  }, [D]);
  return (
    <Lab
      title="Two kinds of noise (Figure 17-8), on real images"
      fig={CAPTIONS.fig179}
      slides="slides 8–9"
      tryThis="predict how much of each item survives Dropout(0.5) and whether the network can still rebuild it. Look at the noisy row, then the reconstructions; then switch to Gaussian noise and turn it up."
    >
      <div className="dl-lab__controls">
        <Chips label="noise" value={kind} options={[{ v: 'dropout', l: 'Dropout(0.5) (slide 9)' }, { v: 'gauss', l: 'Gaussian noise (Figure 17-8, left)' }]} onChange={setKind} />
        {kind === 'gauss' && <Range label="noise standard deviation" value={sd} min={0.05} max={0.6} step={0.05} onChange={setSd} fmt={(v) => fmt(v, 2)} />}
      </div>
      {!D ? <Pending /> : (
        <>
          <div className="dl67s-scroll">
            <ImgRows
              rows={kind === 'dropout' ? [
                { key: 'o', label: 'originals', cells: items.map((it) => ({ b64: it.original, label: `original: ${CLASS_NAMES[it.label]}`, note: CLASS_NAMES[it.label] })) },
                { key: 'n', label: 'noisy: half the pixels off', cells: items.map((it) => ({ b64: it.noisy, label: 'noisy input' })) },
                { key: 'r', label: 'dropout_ae', cells: items.map((it) => ({ b64: it.recon, label: 'reconstruction', note: `MSE ${fmt(it.mse, 4)}` })) },
              ] : [
                { key: 'o', label: 'originals', cells: items.map((it) => ({ b64: it.original, label: `original: ${CLASS_NAMES[it.label]}`, note: CLASS_NAMES[it.label] })) },
                { key: 'g', label: `+ Gaussian noise, sd ${fmt(sd, 2)}`, cells: items.map((it, i) => ({ px: gaussNoisy(it.original, sd, 500 + i), label: 'with Gaussian noise added' })) },
              ]}
            />
          </div>
          <div className="dl67s-stats dl67s-stats--tight">
            {kind === 'dropout' ? (
              <>
                <Stat k="ink pixels switched off" v={`${Math.round(off * 100)}%`} sub={`in these ${D.items.length} noisy images; Dropout(0.5) drops each input with probability 0.5`} />
                <Stat k={`dropout_ae, validation MSE after ${D.epochs} epochs`} v={fmt(D.valLoss[D.valLoss.length - 1], 4)} sub={`on the clean images (Dropout is off outside training)${D.validMseNoisyInput ? `; ${fmt(D.validMseNoisyInput, 4)} on noisy ones` : ''}`} />
                <Stat k="parameters (TensorFlow’s count)" v={fmtInt(D.params.dropout_ae)} sub="Dropout itself has none" />
              </>
            ) : (
              <Stat k="model" v="none trained" sub="slide 9 implements only the dropout version" />
            )}
          </div>
        </>
      )}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> <code>dropout_ae</code> built and trained as slide 9 (Nadam, MSE{D ? `, ${D.epochs} epochs` : ''}) with TensorFlow on Fashion MNIST.
        The slides don’t say how Figure 17-9’s noisy images were made; here the noisy row is <code>Dropout(0.5)</code> applied to the validation images
        with <code>training=True</code> (as in Géron’s notebook), drawn with the dropped pixels white; Keras’s <code>Dropout</code> also doubles the
        pixels it keeps during training, which the picture leaves out (this page’s note). The reconstructions are the trained model’s output for those noisy
        images. The Gaussian row is this page’s illustration of Figure 17-8 (left), made in the browser.
      </p>
    </Lab>
  );
}

const SIZES = [
  { v: 30, l: '30 (dropout_ae, slide 9)' },
  { v: 784, l: '784 (as large as the inputs)' },
  { v: 1500, l: '1,500 (larger: this page’s example)' },
];

export function CodingSizeLab() {
  const [n, setN] = useState(30);
  const max = 1500;
  const kind = n < 784 ? 'undercomplete' : 'overcomplete';
  return (
    <Lab
      title="Undercomplete or overcomplete?"
      slides="slide 7"
      tryThis="predict which coding sizes make the autoencoder undercomplete. Pick each size and notice what stops the larger ones from simply copying their inputs."
    >
      <div className="dl-lab__controls">
        <Chips label="coding layer" value={n} options={SIZES} onChange={setN} />
      </div>
      <div className="dl67s-cs">
        <div className="dl67s-cs__row"><span className="dl67s-cs__k">inputs</span><span className="dl67s-cs__bar dl67s-cs__bar--in" style={{ width: `${(784 / max) * 100}%` }} /><span className="dl67s-cs__n">784</span></div>
        <div className="dl67s-cs__row"><span className="dl67s-cs__k">codings</span><span className={`dl67s-cs__bar dl67s-cs__bar--${kind}`} style={{ width: `${(n / max) * 100}%` }} /><span className="dl67s-cs__n">{fmtInt(n)}</span></div>
      </div>
      <div className="dl67s-stats dl67s-stats--tight">
        <Stat k="this autoencoder is" v={kind} tone="accent" sub={n < 784 ? 'the coding layer is smaller than the inputs' : n === 784 ? 'the coding layer is just as large as the inputs' : 'the coding layer is larger than the inputs'} />
        <Stat k="what forces it to learn" v={n < 784 ? 'the small coding layer' : 'another constraint'} sub={n < 784 ? 'slide 7: “we have limited the size of the coding layer”' : 'e.g. noise on the inputs (denoising, slide 8)'} />
      </div>
      <p className="dl67s-cap">
        Slide 7: up to now the coding layer has been kept small (undercomplete); other kinds of constraints allow it to be just as large as the inputs, or even
        larger (overcomplete). Lecture 5 gave the reason for keeping it small: an undercomplete autoencoder cannot trivially copy its inputs to the codings. The
        sizes 784 and 1,500 are this page’s examples; no slide builds an overcomplete autoencoder.
      </p>
    </Lab>
  );
}
