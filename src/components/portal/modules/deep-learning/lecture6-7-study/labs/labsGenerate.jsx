import { useMemo, useState } from 'react';
import { Lab, Chips, Range, Stat } from '../ui';
import { CAPTIONS } from '../slideData';
import { useVae, CLASS_NAMES } from '../fashion';
import { decode, toBytes, normals, rng, linspace, fmt } from '../gen';
import { FashionImg, ImgGrid, Pending } from './parts';
import './labsGenerate.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LABS FOR §6 (GENERATING WITH THE VAE)
     GenerateLab   slide 16 live: draw 3 × 7 codings from the normal
                   distribution and decode them with this page's trained
                   decoder, in the browser; or take one of them and move
                   its 10 coding numbers by hand
     InterpLab     slides 17–18 live: 10 codings evenly spaced between two
                   codings (np.linspace, endpoints included), decoded, beside
                   the same two images blended at the pixel level
   ========================================================================== */

const decodeBytes = (dec, z) => toBytes(decode(dec, z));

export function GenerateLab() {
  const vae = useVae();
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState('grid');
  const [pick, setPick] = useState(0);
  const [edits, setEdits] = useState({});
  const n = vae?.VAE.codingsSize ?? 10;
  const codings = useMemo(() => {
    const r = rng(3100 + seed * 977);
    return Array.from({ length: 21 }, () => normals(r, n));
  }, [seed, n]);
  const imgs = useMemo(() => (vae ? codings.map((z) => decodeBytes(vae.dec, z)) : []), [vae, codings]);
  const z = codings[pick].map((v, i) => edits[i] ?? v);
  const one = useMemo(() => (vae ? decodeBytes(vae.dec, z) : null), [vae, z]);
  const redraw = () => { setSeed((s) => s + 1); setEdits({}); };
  return (
    <Lab
      title="Generate new images (slide 16), live"
      fig={CAPTIONS.fig1712}
      slides="slide 16"
      tryThis="before drawing, predict how many of the 21 will look like a real item. Draw a few sets; then pick one image, switch to “move one coding” and slide its numbers, noticing which ones change the kind of item."
    >
      <div className="dl-lab__controls">
        <Chips label="mode" value={mode} options={[{ v: 'grid', l: '3 × 7 random codings' }, { v: 'one', l: 'move one coding by hand' }]} onChange={setMode} />
        <div className="dl67s-stepper">
          <button type="button" className="dl-btn" onClick={redraw}>Draw 21 new codings</button>
          <span className="dl67s-stepper__t">set <b>{seed}</b></span>
        </div>
      </div>
      {!vae ? <Pending /> : mode === 'grid' ? (
        <div className="dl67s-gen">
          <div role="group" aria-label="21 generated images; click one to edit its coding" className="dl67s-gen__grid">
            {imgs.map((px, i) => (
              <button key={i} type="button" className={`dl67s-gen__b${i === pick ? ' dl67s-gen__b--on' : ''}`} aria-pressed={i === pick} onClick={() => { setPick(i); setEdits({}); }}>
                <FashionImg px={px} label={`generated image ${i + 1}`} />
              </button>
            ))}
          </div>
          <p className="dl67s-readout">
            <code>codings = tf.random.normal(shape=[3 * 7, codings_size])</code>: 21 codings of {n} numbers, each drawn from N(0, 1);{' '}
            <code>variational_decoder(codings)</code> turns them into 21 images of 28 × 28. Click one to edit it.
          </p>
        </div>
      ) : (
        <div className="dl67s-gen__one">
          <figure className="dl67s-gen__big">
            <FashionImg px={one} label={`generated image ${pick + 1}, with its coding edited`} />
            <figcaption className="dl67s-mini">image {pick + 1} of set {seed}{Object.keys(edits).length ? ' (edited)' : ''}</figcaption>
            <button type="button" className="dl-btn" onClick={() => setEdits({})} disabled={!Object.keys(edits).length}>Undo edits</button>
          </figure>
          <div className="dl67s-gen__sliders">
            {z.map((v, i) => (
              <Range key={i} label={`z${i + 1}`} value={Math.round(v * 20) / 20} min={-3} max={3} step={0.05} onChange={(x) => setEdits((e) => ({ ...e, [i]: x }))} fmt={(x) => fmt(x, 2)} />
            ))}
          </div>
        </div>
      )}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> These are not Figure 17-12’s images: the codings are this page’s seeded draws, decoded in your browser
        by the decoder of this page’s VAE (slides 14–15 trained with TensorFlow{vae ? `, ${vae.VAE.epochs} epochs` : ''}). Like the slide’s, most look like
        Fashion MNIST items, if fuzzy. Codings far outside the range the encoder learned (say beyond ±3) decode to blurrier shapes.
      </p>
    </Lab>
  );
}

/* ── slides 17–18: semantic interpolation ───────────────────────────────── */
function pairOfItems(items) {
  const a = items.findIndex((it) => it.label === 0);
  const b = items.findIndex((it) => it.label === 7);
  if (a >= 0 && b >= 0) return [a, b];
  const c = items.findIndex((it) => it.label !== items[0].label);
  return [0, c >= 0 ? c : 1];
}

export function InterpLab() {
  const vae = useVae();
  const [src, setSrc] = useState('random');
  const [seed, setSeed] = useState(123);
  const n = vae?.VAE.codingsSize ?? 10;
  const pair = useMemo(() => (vae ? pairOfItems(vae.VAE.items) : [0, 1]), [vae]);
  const ends = useMemo(() => {
    if (!vae) return null;
    if (src === 'random') {
      const r = rng(seed);
      return [normals(r, n), normals(r, n)];
    }
    return pair.map((k) => vae.VAE.items[k].mean);
  }, [vae, src, seed, n, pair]);
  const rows = useMemo(() => {
    if (!vae || !ends) return null;
    const inter = linspace(ends[0], ends[1], 10);
    const latent = inter.map((z) => decodeBytes(vae.dec, z));
    const A = latent[0];
    const B = latent[9];
    const pixel = Array.from({ length: 10 }, (_, k) => {
      const t = k / 9;
      return Uint8Array.from(A, (v, i) => Math.round(v * (1 - t) + B[i] * t));
    });
    return { latent, pixel };
  }, [vae, ends]);
  return (
    <Lab
      title="Semantic interpolation (slides 17–18), live"
      fig={CAPTIONS.slide18}
      slides="slides 17–18"
      tryThis="predict what the middle images will look like in each row. Then compare: the top row changes the item; the bottom row only fades one picture into the other. Draw new codings, or start from two real images."
    >
      <div className="dl-lab__controls">
        <Chips label="the two codings" value={src} options={[{ v: 'random', l: 'drawn from the normal distribution (slide 18)' }, { v: 'images', l: 'two real images, through the encoder (slide 17, step 1)' }]} onChange={setSrc} />
        {src === 'random' && (
          <div className="dl67s-stepper">
            <button type="button" className="dl-btn" onClick={() => setSeed((s) => s + 1)}>Draw two new codings</button>
            <span className="dl67s-stepper__t">seed <b>{seed}</b></span>
          </div>
        )}
      </div>
      {!rows ? <Pending /> : (
        <div className="dl67s-ip">
          {src === 'images' && (
            <div className="dl67s-ip__ends">
              {pair.map((k) => (
                <figure key={k} className="dl67s-ip__end">
                  <FashionImg b64={vae.VAE.items[k].original} label={`real image: ${CLASS_NAMES[vae.VAE.items[k].label]}`} />
                  <figcaption className="dl67s-mini">{CLASS_NAMES[vae.VAE.items[k].label]} → μ</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="dl67s-stagehead">codings level: np.linspace(codings[0], codings[1], 10), decoded</p>
          <div className="dl67s-scroll"><ImgGrid cells={rows.latent.map((px, k) => ({ px, label: `interpolated coding ${k + 1} of 10, decoded` }))} cols={10} label="Ten decoded codings" /></div>
          <p className="dl67s-stagehead">pixel level: the two end images blended (“as if the two images were overlaid”)</p>
          <div className="dl67s-scroll"><ImgGrid cells={rows.pixel.map((px, k) => ({ px, label: `pixel blend ${k + 1} of 10` }))} cols={10} label="Ten pixel-level blends" /></div>
          <ol className="dl67s-ip__t" aria-hidden="true">{Array.from({ length: 10 }, (_, k) => <li key={k}>{fmt(k / 9, 2)}</li>)}</ol>
          <div className="dl67s-stats dl67s-stats--tight">
            <Stat k="steps" v="10" sub="np.linspace includes both ends: weights 0, 1/9, …, 1" />
            <Stat k="what moves" v="the codings" tone="accent" sub={`${n} numbers each, decoded at every step`} />
          </div>
        </div>
      )}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> Decoded in your browser by this page’s VAE decoder. “Drawn from the normal distribution” uses this page’s
        own seeded generator: seed 123 here is not TensorFlow’s <code>tf.random.set_seed(123)</code>, so it doesn’t give slide 18’s T-shirt and Sneaker. With
        “two real images”, the codings are the encoder’s mean codings μ for a T-shirt/top and a Sneaker among this page’s validation images. Both end images in
        the pixel row are the decoded end codings, so the two rows start and finish on the same pictures.
      </p>
    </Lab>
  );
}

