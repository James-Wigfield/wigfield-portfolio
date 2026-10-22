import { useMemo, useState } from 'react';
import { Code, Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { useStudy } from '../context';
import { CAPTIONS, NAMED_CODE, MODELS } from '../slideData';
import { useVae, useData, loadConv, decodeImg, CLASS_NAMES } from '../fashion';
import {
  decode, toBytes, sampleCoding, normals, rng, latentTermSigma, latentTermGamma, sigmaOfGamma,
  flow, shapeText, mse, fmt, fmtInt,
} from '../gen';
import { FashionImg, Pending } from './parts';
import './labsVae.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LABS FOR §3–§5 (THE VAE)
     VaeLiveLab     Figure 17-11 run on this page's trained VAE: a real
                    validation image's codings μ and σ (from the encoder, run
                    offline), a fresh Gaussian sample each time you press
                    Resample, z = μ + σ·ε, and the decoder's output, decoded
                    live in the browser — next to conv_ae's reconstruction,
                    which never changes
     LatentLossLab  slide 12's latent loss for one coding dimension, in its σ
                    and γ forms, with where it is smallest; then the whole
                    loss of a real image's 10 codings
     VaeCodeLab     slide 14's listing walked through with shapes and
                    parameter counts, and its sampling line term by term on
                    real numbers
   ========================================================================== */

const clampV = (v) => Math.max(-1, Math.min(1, v));

// a vector as a row of tinted cells (--v from −1 to 1)
function Vec({ values, scale = 2, label, hl }) {
  return (
    <span className="dl67s-vec" role="group" aria-label={label}>
      {values.map((v, i) => <i key={i} style={{ '--v': clampV(v / scale) }} className={hl === i ? 'dl67s-vec__on' : undefined}>{fmt(v, 2)}</i>)}
    </span>
  );
}

// the twelve validation images as a picker
function Picker({ items, value, onChange, label = 'Pick an image' }) {
  return (
    <div className="dl67s-pick" role="group" aria-label={label}>
      {items.map((it, i) => (
        <button key={it.index} type="button" className={`dl67s-pick__b${i === value ? ' dl67s-pick__b--on' : ''}`} aria-pressed={i === value} onClick={() => onChange(i)} title={CLASS_NAMES[it.label]}>
          <FashionImg b64={it.original} label={`validation image ${it.index + 1}: ${CLASS_NAMES[it.label]}`} />
        </button>
      ))}
    </div>
  );
}

const bytesToUnit = (b) => Array.from(b, (v) => v / 255);
const epsFor = (idx, draw, n) => normals(rng(7001 + idx * 131 + draw * 7919), n);

/* ── §3 · Figure 17-11, live ─────────────────────────────────────────────── */
export function VaeLiveLab() {
  const { printing } = useStudy();
  const vae = useVae();
  const conv = useData(loadConv);
  const [idx, setIdx] = useState(0);
  const [draw, setDraw] = useState(1);
  const run = useMemo(() => {
    if (!vae) return null;
    const { VAE, dec } = vae;
    const it = VAE.items[idx];
    const n = VAE.codingsSize;
    const sigma = it.logVar.map(sigmaOfGamma);
    const orig = bytesToUnit(decodeImg(it.original));
    const draws = Array.from({ length: 6 }, (_, k) => {
      const d = Math.max(1, draw - 5) + k;
      const eps = epsFor(idx, d, n);
      const z = sampleCoding(it.mean, it.logVar, eps);
      const px = decode(dec, z);
      return { d, eps, z, out: toBytes(px), mse: mse(Array.from(px), orig) };
    }).filter((x) => x.d <= Math.max(draw, 6));
    const cur = draws.find((x) => x.d === draw) ?? draws[draws.length - 1];
    return { it, sigma, cur, draws };
  }, [vae, idx, draw]);
  const convItem = conv?.CONV.items.find((c) => run && c.index === run.it.index);
  const shown = printing ? run?.draws : run?.draws.filter((x) => x.d <= draw).slice(-6);
  return (
    <Lab
      title="Figure 17-11, live: two codings, a random sample, a reconstruction"
      fig={CAPTIONS.fig1711}
      slides="slides 10–11"
      tryThis="predict whether pressing Resample, with the same image in, gives the same output. Press it a few times and notice which dimensions of z move most: the ones with the largest σ. Then compare the plain autoencoder below."
    >
      {!run ? <Pending /> : (
        <>
          <div className="dl-lab__controls">
            <Picker items={vae.VAE.items} value={idx} onChange={(i) => { setIdx(i); setDraw(1); }} />
            <div className="dl67s-stepper">
              <button type="button" className="dl-btn" onClick={() => setDraw((d) => d + 1)}>Resample ε</button>
              <span className="dl67s-stepper__t">draw <b>{run.cur.d}</b></span>
            </div>
          </div>
          <div className="dl67s-vl">
            <figure className="dl67s-vl__img">
              <FashionImg b64={run.it.original} label={`input: a ${CLASS_NAMES[run.it.label]}`} />
              <figcaption className="dl67s-mini">input · {CLASS_NAMES[run.it.label]}</figcaption>
            </figure>
            <div className="dl67s-vl__vecs">
              <p className="dl67s-vl__k"><b>μ</b> codings_mean <span className="dl67s-mini">(the encoder’s output)</span></p>
              <Vec values={run.it.mean} label="mu, 10 numbers" />
              <p className="dl67s-vl__k"><b>σ = exp(γ / 2)</b> <span className="dl67s-mini">(γ = codings_log_var)</span></p>
              <Vec values={run.sigma} scale={1} label="sigma, 10 numbers" />
              <p className="dl67s-vl__k"><b>ε</b> Gaussian noise, N(0, 1) <span className="dl67s-mini">draw {run.cur.d}</span></p>
              <Vec values={run.cur.eps} label="epsilon, 10 numbers" />
              <p className="dl67s-vl__k"><b>z = μ + σ · ε</b> the sampled coding</p>
              <Vec values={run.cur.z} label="the sampled coding z, 10 numbers" />
            </div>
            <figure className="dl67s-vl__img">
              <FashionImg px={run.cur.out} label={`the decoder's output for draw ${run.cur.d}`} />
              <figcaption className="dl67s-mini">output · draw {run.cur.d}<br />MSE {fmt(run.cur.mse, 4)}</figcaption>
            </figure>
          </div>
          <div className="dl67s-vl__row">
            <div>
              <p className="dl67s-stagehead">The VAE: the same input, drawn again and again</p>
              <div className="dl67s-vl__strip">
                {shown.map((x) => (
                  <figure key={x.d} className="dl67s-vl__cell">
                    <FashionImg px={x.out} label={`VAE output, draw ${x.d}`} />
                    <figcaption className="dl67s-mini">draw {x.d}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <div>
              <p className="dl67s-stagehead">A plain autoencoder: conv_ae (§1)</p>
              {convItem ? (
                <div className="dl67s-vl__strip">
                  {[0, 1, 2].map((k) => (
                    <figure key={k} className="dl67s-vl__cell">
                      <FashionImg b64={convItem.recon} label="conv_ae's reconstruction, the same every time" />
                      <figcaption className="dl67s-mini">{k === 0 ? 'every time' : 'the same'}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : <Pending />}
            </div>
          </div>
        </>
      )}
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own run</span> The VAE is slides 14–15’s model trained offline with TensorFlow on Fashion MNIST
        ({vae ? `${vae.VAE.epochs} epochs, batch ${vae.VAE.batchSize}, 10 codings` : 'see §5'}). μ and γ for these twelve validation images come from
        its encoder; the decoder runs here, in the browser, from its weights stored as 8-bit numbers with one scale per unit
        {vae?.VAE.check ? ` (largest pixel difference from Keras’s own decoder: ${fmt(vae.VAE.check.quantMaxAbsErr, 3)})` : ''}. ε is this page’s own
        seeded draw. MSE is the output’s mean squared pixel error against the input, on a 0–1 scale. conv_ae is §1’s model (this page’s run): with no
        randomness, the same input always gives the same reconstruction. The VAE’s output changes with every draw, even after training: it is a
        probabilistic autoencoder (slide 10).
      </p>
    </Lab>
  );
}

/* ── §4 · the latent loss ─────────────────────────────────────────────────── */
const W = 250;
const H = 130;
function TermPlot({ xs, ys, at, xLabel, minAt, label }) {
  const m = { l: 30, r: 10, t: 10, b: 24 };
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const top = Math.min(Math.max(...ys), 6);
  const sx = (x) => m.l + ((x - lo) / (hi - lo)) * (W - m.l - m.r);
  const sy = (y) => H - m.b - (Math.min(y, top) / top) * (H - m.t - m.b);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(ys[i]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dl67s-svg dl67s-ll__plot" role="img" aria-label={label}>
      <line x1={m.l} y1={sy(0)} x2={W - m.r} y2={sy(0)} className="dl67s-axis" />
      <line x1={m.l} y1={m.t} x2={m.l} y2={sy(0)} className="dl67s-axis" />
      <text x={m.l - 4} y={sy(0) + 3} textAnchor="end" className="dl67s-tick">0</text>
      <text x={m.l - 4} y={sy(top) + 3} textAnchor="end" className="dl67s-tick">{fmt(top, 1)}</text>
      {[lo, minAt, hi].map((v) => <text key={v} x={sx(v)} y={H - 8} textAnchor="middle" className="dl67s-tick">{fmt(v, v % 1 ? 2 : 0)}</text>)}
      <text x={W - m.r} y={m.t + 2} textAnchor="end" className="dl67s-tick">{xLabel}</text>
      <path d={d} className="dl67s-ll__curve" />
      <circle cx={sx(minAt)} cy={sy(0)} r={3.5} className="dl67s-ll__min"><title>minimum: 0</title></circle>
      <circle cx={sx(at.x)} cy={sy(at.y)} r={5} className="dl67s-ll__dot" />
    </svg>
  );
}

const MU_GRID = Array.from({ length: 121 }, (_, i) => -3 + i * 0.05);
const SG_GRID = Array.from({ length: 120 }, (_, i) => 0.05 + i * 0.025);

export function LatentLossLab() {
  const vae = useVae();
  const [mu, setMu] = useState(1);
  const [sigma, setSigma] = useState(0.5);
  const [mode, setMode] = useState('sigma');
  const [idx, setIdx] = useState(0);
  const gamma = Math.log(sigma * sigma);
  const tS = latentTermSigma(mu, sigma);
  const tG = latentTermGamma(mu, gamma);
  const inside = [1, Math.log(sigma * sigma), -sigma * sigma, -mu * mu];
  const real = useMemo(() => {
    if (!vae) return null;
    const { VAE, dec } = vae;
    const it = VAE.items[idx];
    const rows = it.mean.map((m, i) => ({ m, g: it.logVar[i], s: sigmaOfGamma(it.logVar[i]), t: latentTermGamma(m, it.logVar[i]) }));
    const L = rows.reduce((a, r) => a + r.t, 0);
    const z = sampleCoding(it.mean, it.logVar, epsFor(idx, 1, VAE.codingsSize));
    const rec = mse(Array.from(decode(dec, z)), bytesToUnit(decodeImg(it.original)));
    return { it, rows, L, rec };
  }, [vae, idx]);
  return (
    <Lab
      title="The latent loss, one coding dimension at a time"
      slides="slides 12–13"
      tryThis="predict the μ and σ that make one dimension’s term zero. Drag the sliders to find it, switch between the σ and γ forms and notice the term doesn’t change. Then pick an image to see the loss of all 10 of its codings."
    >
      <div className="dl-lab__controls">
        <Chips label="the encoder outputs" value={mode} options={[{ v: 'sigma', l: 'σ (first formula)' }, { v: 'gamma', l: 'γ = log(σ²) (the tweak)' }]} onChange={setMode} />
        <Range label="μᵢ" value={mu} min={-3} max={3} step={0.05} onChange={setMu} fmt={(v) => fmt(v, 2)} />
        {mode === 'sigma' ? (
          <Range label="σᵢ" value={sigma} min={0.05} max={3} step={0.05} onChange={setSigma} fmt={(v) => fmt(v, 2)} />
        ) : (
          <Range label="γᵢ" value={Math.round(gamma * 20) / 20} min={-6} max={2.2} step={0.05} onChange={(g) => setSigma(Math.exp(g / 2))} fmt={(v) => fmt(v, 2)} />
        )}
      </div>
      <div className="dl67s-ll">
        <div className="dl67s-ll__eqs">
          <p className="dl67s-ll__eq">
            {mode === 'sigma' ? (
              <Tex src={`-\\tfrac{1}{2}\\left[1 + \\log(${fmt(sigma, 2)}^2) - ${fmt(sigma, 2)}^2 - (${fmt(mu, 2)})^2\\right]`} />
            ) : (
              <Tex src={`-\\tfrac{1}{2}\\left[1 + (${fmt(gamma, 2)}) - \\exp(${fmt(gamma, 2)}) - (${fmt(mu, 2)})^2\\right]`} />
            )}
          </p>
          <p className="dl67s-printonly dl67s-readout">
            As text: −1/2 [1 + {mode === 'sigma' ? `log(${fmt(sigma, 2)}²) − ${fmt(sigma, 2)}²` : `(${fmt(gamma, 2)}) − exp(${fmt(gamma, 2)})`} − ({fmt(mu, 2)})²]
          </p>
          <ol className="dl67s-ll__parts">
            <li><span>1</span><b>{fmt(inside[0], 3)}</b></li>
            <li><span>{mode === 'sigma' ? 'log(σᵢ²)' : 'γᵢ'}</span><b>{fmt(inside[1], 3)}</b></li>
            <li><span>{mode === 'sigma' ? '− σᵢ²' : '− exp(γᵢ)'}</span><b>{fmt(inside[2], 3)}</b></li>
            <li><span>− μᵢ²</span><b>{fmt(inside[3], 3)}</b></li>
            <li className="dl67s-ll__sum"><span>× (−½)</span><b>{fmt(mode === 'sigma' ? tS : tG, 4)}</b></li>
          </ol>
          <div className="dl67s-stats dl67s-stats--tight">
            <Stat k={<>this dimension’s term, <span className="dl67s-nocase">σ</span> form</>} v={fmt(tS, 4)} />
            <Stat k={<>the same, <span className="dl67s-nocase">γ</span> form</>} v={fmt(tG, 4)} tone={Math.abs(tS - tG) < 1e-9 ? 'accent' : undefined} sub={`γ = log(σ²) = ${fmt(gamma, 3)}`} />
          </div>
        </div>
        <div className="dl67s-ll__plots">
          <figure className="dl67s-ll__fig">
            <TermPlot xs={MU_GRID} ys={MU_GRID.map((m) => latentTermSigma(m, sigma))} at={{ x: mu, y: tS }} minAt={0} xLabel="μᵢ" label={`The term against mu, with sigma fixed at ${fmt(sigma, 2)}`} />
            <figcaption className="dl67s-mini">the term against μᵢ, σᵢ = {fmt(sigma, 2)}</figcaption>
          </figure>
          <figure className="dl67s-ll__fig">
            <TermPlot xs={SG_GRID} ys={SG_GRID.map((s) => latentTermSigma(mu, s))} at={{ x: sigma, y: tS }} minAt={1} xLabel="σᵢ" label={`The term against sigma, with mu fixed at ${fmt(mu, 2)}`} />
            <figcaption className="dl67s-mini">the term against σᵢ, μᵢ = {fmt(mu, 2)}</figcaption>
          </figure>
        </div>
      </div>
      <p className="dl67s-readout">
        The term is smallest, at 0, when μᵢ = 0 and σᵢ = 1 (γᵢ = 0): the codings of a standard Gaussian. Any other μᵢ or σᵢ costs something, which is
        how the latent loss pushes the codings towards “a cloud of Gaussian points” (slide 12).
      </p>
      <div className="dl67s-ll__real">
        <p className="dl67s-stagehead">The whole latent loss of one real image (this page’s VAE, 10 codings)</p>
        {!real ? <Pending /> : (
          <>
            <Picker items={vae.VAE.items} value={idx} onChange={setIdx} />
            <div className="dl67s-scroll">
              <table className="dl67s-table dl67s-ll__table">
                <thead><tr><th>dimension</th>{real.rows.map((_, i) => <th key={i} className="dl67s-num">{i + 1}</th>)}<th className="dl67s-num">sum</th></tr></thead>
                <tbody>
                  <tr><td>μᵢ</td>{real.rows.map((r, i) => <td key={i} className="dl67s-num">{fmt(r.m, 2)}</td>)}<td /></tr>
                  <tr><td>γᵢ</td>{real.rows.map((r, i) => <td key={i} className="dl67s-num">{fmt(r.g, 2)}</td>)}<td /></tr>
                  <tr><td>σᵢ</td>{real.rows.map((r, i) => <td key={i} className="dl67s-num">{fmt(r.s, 2)}</td>)}<td /></tr>
                  <tr className="dl67s-row--on"><td>term</td>{real.rows.map((r, i) => <td key={i} className="dl67s-num">{fmt(r.t, 2)}</td>)}<td className="dl67s-num"><b>{fmt(real.L, 2)}</b></td></tr>
                </tbody>
              </table>
            </div>
            <div className="dl67s-stats dl67s-stats--tight">
              <Stat k="latent loss ℒ (sum of the terms)" v={fmt(real.L, 3)} />
              <Stat k="ℒ / 784 (as slide 14 adds it)" v={fmt(real.L / 784, 5)} />
              <Stat k="reconstruction MSE (one sample)" v={fmt(real.rec, 5)} />
              <Stat k="this image’s total" v={fmt(real.rec + real.L / 784, 5)} tone="accent" sub="MSE + ℒ / 784 (slide 15: latent + reconstruction)" />
            </div>
          </>
        )}
      </div>
      <p className="dl67s-cap">
        The top half is this page’s working with slide 12’s two formulas. In the bottom half, μ and γ are this page’s trained VAE’s codings for one
        validation image (<span className="dl67s-own">this page’s own run</span>); during training Keras averages these totals over each batch of 128.
      </p>
    </Lab>
  );
}

/* ── §5 · slide 14's listing, walked through ─────────────────────────────── */
const ENC = flow(MODELS.variational_encoder);
const DEC = flow(MODELS.variational_decoder);
const PARTS = {
  sampling: { label: 'Sampling (lines 2–10)', lines: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  encoder: { label: 'the encoder (lines 12–21)', lines: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
  decoder: { label: 'the decoder (lines 23–29)', lines: [23, 24, 25, 26, 27, 28, 29] },
};

function FlowTable({ f, onRow, on, head }) {
  return (
    <table className="dl67s-table">
      <thead><tr><th>{head}</th><th>output</th><th className="dl67s-num">parameters</th></tr></thead>
      <tbody>
        {f.rows.map((r) => (
          <tr key={r.line} className={on === r.line ? 'dl67s-row--on' : undefined}>
            <td>
              <button type="button" className="dl67s-rowbtn" aria-pressed={on === r.line} onClick={() => onRow(r.line)}>
                <code>{r.name ? `${r.name} = ` : ''}{r.call}</code>
              </button>
            </td>
            <td>{shapeText(r.out)}</td>
            <td className="dl67s-num">{fmtInt(r.params)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={2}>total</td><td className="dl67s-num">{fmtInt(f.total)}</td></tr></tfoot>
    </table>
  );
}

export function VaeCodeLab() {
  const vae = useVae();
  const [part, setPart] = useState('sampling');
  const [line, setLine] = useState(null);
  const [dim, setDim] = useState(0);
  const hl = line ? [line] : PARTS[part].lines;
  const ex = useMemo(() => {
    if (!vae) return null;
    const it = vae.VAE.items[0];
    const eps = epsFor(0, 1, vae.VAE.codingsSize);
    return { it, eps };
  }, [vae]);
  const pickPart = (p) => { setPart(p); setLine(null); };
  const m = ex?.it.mean[dim];
  const g = ex?.it.logVar[dim];
  const e = ex?.eps[dim];
  return (
    <Lab
      title="The VAE in Keras, line by line"
      slides="slides 14–15"
      tryThis="before reading the tables, predict which layer of the encoder has the most parameters, and what shape Sampling outputs. Pick rows to find their lines; then step through the sampling line’s terms on a real coding."
    >
      <div className="dl-lab__controls">
        <Chips label="part" value={part} options={Object.entries(PARTS).map(([v, p]) => ({ v, l: p.label }))} onChange={pickPart} />
      </div>
      <div className="dl67s-vc">
        <div className="dl67s-vc__tables">
          <p className="dl67s-stagehead">variational_encoder · input 28 × 28</p>
          <div className="dl67s-scroll"><FlowTable f={ENC} on={line} onRow={(l) => { setPart('encoder'); setLine(l); }} head="layer (slide 14)" /></div>
          <p className="dl67s-stagehead">variational_decoder · input: codings_size = 10</p>
          <div className="dl67s-scroll"><FlowTable f={DEC} on={line} onRow={(l) => { setPart('decoder'); setLine(l); }} head="layer (slide 14)" /></div>
          <p className="dl67s-total">variational_ae: {fmtInt(ENC.total)} + {fmtInt(DEC.total)} = <b>{fmtInt(ENC.total + DEC.total)}</b> parameters <span className="dl67s-own">this page’s working</span></p>
        </div>
        <div className="dl67s-noprint dl67s-vc__code">
          <Code code={NAMED_CODE.VAE_PARTS} label="slide 14" meta={PARTS[part].label} hl={hl} />
        </div>
      </div>
      <div className="dl67s-vc__sample">
        <p className="dl67s-stagehead">The sampling line, term by term (this page’s VAE, validation image 1, one draw)</p>
        <Chips label="coding dimension" value={dim} options={Array.from({ length: 10 }, (_, i) => ({ v: i, l: String(i + 1) }))} onChange={setDim} compact />
        <p className="dl67s-mono dl67s-vc__line">return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean</p>
        {!ex ? <Pending /> : (
          <ol className="dl67s-ll__parts dl67s-vc__terms">
            <li><span>mean (μ)</span><b>{fmt(m, 3)}</b></li>
            <li><span>logvar (γ)</span><b>{fmt(g, 3)}</b></li>
            <li><span>tf.random.normal(…) (ε)</span><b>{fmt(e, 3)}</b></li>
            <li><span>tf.exp(logvar / 2) (σ)</span><b>{fmt(Math.exp(g / 2), 3)}</b></li>
            <li><span>ε × σ</span><b>{fmt(e * Math.exp(g / 2), 3)}</b></li>
            <li className="dl67s-ll__sum"><span>+ mean → this coding</span><b>{fmt(e * Math.exp(g / 2) + m, 3)}</b></li>
          </ol>
        )}
        <p className="dl67s-readout">
          The latent loss lines use the same two vectors: <code>loss</code> adds up the 10 terms for each image (<code>axis=-1</code>), then{' '}
          <code>tf.reduce_mean(loss) / 784.</code> averages over the images in the batch and divides by 784.
        </p>
      </div>
      <p className="dl67s-cap">
        Output shapes and parameter counts are this page’s working (slide 15 leaves them as an exercise: run the two <code>summary()</code> calls); TensorFlow
        reports the same numbers for this page’s run. A Dense layer has inputs × units + units parameters; <code>Flatten</code> and <code>Sampling</code> have none.
        <code> codings_mean</code> and <code>codings_log_var</code> both read the 100 outputs of the second Dense layer. With codings_size = 10 (slide 16’s “10-dimensional”).
      </p>
    </Lab>
  );
}

