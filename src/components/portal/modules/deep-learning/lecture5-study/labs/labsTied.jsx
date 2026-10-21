import { useState } from 'react';
import { Lab, Chips, Stat } from '../ui';
import { Tex } from '../../kit';
import { CAPTIONS, PARAMS } from '../slideData';
import { loadRecon, useData } from '../fashion';
import { stackParams, tiedParams, fmt, fmtInt } from '../ae';
import { texText } from '../texText';
import { ReconGrid } from './parts';
import './labsTied.css';

/* ============================================================================
   LECTURE 5 STUDY — LABS FOR §8
     TiedRuleLab    slide 19's rule W_{N−ℓ+1} = W_ℓᵀ on the stack: pick ℓ and
                    see which decoder layer it fills, with both shapes
                    (N = 4 as on the slide, or a deeper N = 6 example)
     TiedCountLab   stacked_ae's 163,814 against tied_ae's 82,414, layer by
                    layer: which weights are shared, which biases remain;
                    DenseTranspose's bias shape; and this page's own run of
                    tied_ae (reconstructions, validation error)
   ========================================================================== */

const SIZES = { 4: [784, 100, 30, 100, 784], 6: [784, 300, 100, 30, 100, 300, 784] };
const sub = (n) => String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]).join('');

function TiedStack({ sizes, l }) {
  const N = sizes.length - 1;
  const gap = 46;
  const H = 24 + gap * N + 30;
  const y = (i) => H - 30 - i * gap;
  const cx = 220;
  const w = (n) => 40 + 22 * Math.log2(n);
  const name = (i) => (i === 0 ? 'Input layer' : i === N ? 'Output layer' : `Hidden ${i}`);
  const pair = new Set([l, N - l + 1]);
  return (
    <svg viewBox={`0 0 470 ${H}`} className="dl5s-svg dl5s-tied" role="img" aria-label={`A stack of ${N} layers above the input layer; layer ${N - l + 1} uses W${l} transposed`}>
      {sizes.map((n, i) => (
        <g key={i}>
          {i > 0 && (
            <g className={pair.has(i) ? 'dl5s-tied__on' : undefined}>
              <line x1={cx} y1={y(i) + 22} x2={cx} y2={y(i - 1)} className="dl5s-tied__link" />
              <text x={cx + 14} y={(y(i) + 22 + y(i - 1)) / 2 + 4} className="dl5s-tied__w">
                {i <= N / 2 ? `W${sub(i)}` : `W${sub(i)} = W${sub(N - i + 1)}ᵀ`}
              </text>
              <text x={cx + 104} y={(y(i) + 22 + y(i - 1)) / 2 + 4} className="dl5s-tied__shape">
                {sizes[i - 1]} × {sizes[i]}{i > N / 2 ? ' (shared)' : ''}
              </text>
            </g>
          )}
          <rect x={cx - w(n) / 2} y={y(i)} width={w(n)} height={22} rx={5} className={`dl5s-tied__box${i === N / 2 ? ' dl5s-tied__box--code' : ''}`} />
          <text x={cx} y={y(i) + 15} textAnchor="middle" className="dl5s-tied__name">{name(i)}</text>
          <text x={cx - w(n) / 2 - 8} y={y(i) + 15} textAnchor="end" className="dl5s-tied__units">{n} units</text>
        </g>
      ))}
    </svg>
  );
}

export function TiedRuleLab() {
  const [N, setN] = useState(4);
  const [l, setL] = useState(1);
  const sizes = SIZES[N];
  const ll = Math.min(l, N / 2);
  const dec = N - ll + 1;
  const rule = `\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_{${N}-${ll}+1} = \\mathbf{W}_{${dec}} = \\mathbf{W}_{${ll}}^{\\top}`;
  return (
    <Lab
      title="The tied-weights rule, layer by layer"
      fig={CAPTIONS.slide19}
      slides="slide 19"
      tryThis="before picking ℓ = 2, predict which decoder layer reuses W₂, and what shape that layer’s weights must have. Then try N = 6 and check the rule still pairs each layer with its mirror."
    >
      <div className="dl-lab__controls">
        <Chips label="N (layers, not counting the input)" value={N} options={[{ v: 4, l: 'N = 4', tag: 'slide 19' }, { v: 6, l: 'N = 6 (this page’s example)' }]} onChange={(v) => { setN(v); setL(1); }} />
        <Chips label="ℓ" value={ll} options={Array.from({ length: N / 2 }, (_, i) => ({ v: i + 1, l: `ℓ = ${i + 1}` }))} onChange={setL} />
      </div>
      <div className="dl5s-tiedrule">
        <div className="dl5s-wide"><TiedStack sizes={sizes} l={ll} /></div>
        <div className="dl5s-tiedrule__side">
          <p className="dl5s-tiedrule__eq">
            <Tex src={rule} />
          </p>
          <p className="dl5s-printonly dl5s-readout">As text: {texText(rule)}</p>
          <div className="dl5s-stats dl5s-stats--col">
            <Stat k={`encoder layer ${ll}: W${sub(ll)}`} v={`${sizes[ll - 1]} × ${sizes[ll]}`} sub={`from ${sizes[ll - 1]} inputs to ${sizes[ll]} units`} />
            <Stat k={`decoder layer ${dec}: W${sub(dec)} = W${sub(ll)}ᵀ`} v={`${sizes[dec - 1]} × ${sizes[dec]}`} tone="accent" sub="the same numbers, transposed: nothing new to learn" />
          </div>
          <p className="dl5s-readout">
            Layer 1 is the first hidden layer, layer N/2 = {N / 2} the coding layer and layer N = {N} the output layer. The decoder’s layers are {Array.from({ length: N / 2 }, (_, i) => N / 2 + i + 1).join(', ')}; each one is tied to its mirror in the encoder.
          </p>
        </div>
      </div>
      <p className="dl5s-cap">
        Shapes are written inputs × units, as Keras stores a Dense layer’s weights. N = 4 is slide 19’s example; the N = 6 sizes are this page’s own, to show the
        rule for ℓ up to N/2 = 3.
      </p>
    </Lab>
  );
}

export function TiedCountLab() {
  const data = useData(loadRecon);
  const [view, setView] = useState('count');
  const sizes = SIZES[4];
  const full = stackParams(sizes);
  const tied = tiedParams(sizes);
  const wFull = full.layers.reduce((s, x) => s + x.weights, 0);
  const wTied = tied.layers.reduce((s, x) => s + x.weights, 0);
  const bias = full.layers.reduce((s, x) => s + x.biases, 0);
  const tr = data?.TRAINING;
  return (
    <Lab
      title="163,814 against 82,414, and this page’s tied_ae"
      slides="slides 20–22"
      tryThis="predict whether tying the weights halves the parameters exactly, then read the weights and biases rows. Then switch to this page’s run and compare the two models’ errors at the same number of epochs."
    >
      <div className="dl-lab__controls">
        <Chips label="show" value={view} options={[{ v: 'count', l: 'the parameter count' }, { v: 'run', l: 'this page’s tied_ae run' }]} onChange={setView} />
      </div>
      <div className={view === 'count' ? undefined : 'dl5s-screenonly-hidden'}>
        <div className="dl5s-scroll dl5s-scroll--cue">
          <table className="dl5s-table">
            <thead>
              <tr><th>layer ℓ · stacked_ae / tied_ae</th><th>stacked_ae (slide 12)</th><th className="dl5s-num">params</th><th>tied_ae (slide 21)</th><th className="dl5s-num">params</th></tr>
            </thead>
            <tbody>
              {full.layers.map((x, i) => {
                const t = tied.layers[i];
                return (
                  <tr key={i}>
                    <td>{['1 · Dense(100) / dense_1', '2 · Dense(30) / dense_2', '3 · Dense(100) / DenseTranspose(dense_2)', '4 · Dense(28 * 28) / DenseTranspose(dense_1)'][i]}</td>
                    <td>W {x.inputs} × {x.units} + b {x.units}</td>
                    <td className="dl5s-num">{fmtInt(x.total)}</td>
                    <td>{t.tiedTo ? <>W{sub(t.tiedTo)}ᵀ (shared) + b {t.biases}</> : <>W {x.inputs} × {x.units} + b {x.units}</>}</td>
                    <td className="dl5s-num">{fmtInt(t.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td>weights</td><td /><td className="dl5s-num">{fmtInt(wFull)}</td><td /><td className="dl5s-num">{fmtInt(wTied)}</td></tr>
              <tr><td>biases</td><td /><td className="dl5s-num">{fmtInt(bias)}</td><td /><td className="dl5s-num">{fmtInt(bias)}</td></tr>
              <tr><td>total</td><td /><td className="dl5s-num">{fmtInt(full.total)}</td><td /><td className="dl5s-num">{fmtInt(tied.total)}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="dl5s-stats dl5s-stats--tight">
          <Stat k="stacked_ae" v={fmtInt(full.total)} sub={full.total === PARAMS.stacked.value ? 'matches slide 12' : 'this page’s count'} />
          <Stat k="tied_ae" v={fmtInt(tied.total)} tone="accent" sub={tied.total === PARAMS.tied.value ? 'matches slide 21' : 'this page’s count'} />
          <Stat k="weights" v={`${fmtInt(wFull)} → ${fmtInt(wTied)}`} sub="exactly halved" />
          <Stat k="biases" v={`${fmtInt(bias)} → ${fmtInt(bias)}`} sub="not tied, so the total is only almost halved" />
        </div>
        <p className="dl5s-readout">
          <b>DenseTranspose’s biases</b> (slide 20, the line marked <code># ***</code>): <code>shape=[self.dense.input.shape[-1]]</code>, the input size of the
          Dense layer it transposes. <code>DenseTranspose(dense_2)</code>: dense_2 takes 100 inputs, so 100 biases, and its output is 100 wide.{' '}
          <code>DenseTranspose(dense_1)</code>: dense_1 takes 784 inputs, so 784 biases and a 784-wide output.
        </p>
      </div>
      <div className={view === 'run' ? undefined : 'dl5s-screenonly-hidden'}>
        {!tr ? <p className="dl5s-readout dl5s-fwait">Loading this page’s Fashion MNIST run…</p> : (
          <>
            <p className="dl5s-stagehead">tied_ae’s reconstructions (slide 22’s check)</p>
            <div className="dl5s-scroll"><ReconGrid data={data} model="tied" n={5} /></div>
            <p className="dl5s-figcap"><span className="dl5s-figcap__k">On slide 22:</span> {CAPTIONS.slide22}</p>
            <div className="dl5s-scroll">
              <table className="dl5s-table">
                <thead><tr><th>this page’s run</th><th className="dl5s-num">epochs</th><th className="dl5s-num">validation MSE</th></tr></thead>
                <tbody>
                  <tr><td>stacked_ae, after 10 epochs</td><td className="dl5s-num">10</td><td className="dl5s-num">{fmt(tr.stacked.valLoss[9], 5)}</td></tr>
                  <tr><td>tied_ae, after 10 epochs (slide 21’s fit)</td><td className="dl5s-num">10</td><td className="dl5s-num">{fmt(tr.tied.finalValidMse, 5)}</td></tr>
                  <tr><td>stacked_ae, after 20 epochs (slide 12’s fit)</td><td className="dl5s-num">20</td><td className="dl5s-num">{fmt(tr.stacked.finalValidMse, 5)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <p className={`dl5s-cap${view === 'count' ? '' : ' dl5s-screenonly-hidden'}`}>
        The two totals are the slides’ (slides 12 and 21); the per-layer split is this page’s working. Tying shares the decoder’s weight matrices
        with the encoder’s, so it removes {fmtInt(wFull - wTied)} weights. Every layer keeps its own biases.
      </p>
      <p className={`dl5s-cap${view === 'run' ? '' : ' dl5s-screenonly-hidden'}`}>
        <span className="dl5s-own">this page’s own run</span> Slide 21 says <code>tied_ae</code> “achieves a slightly lower reconstruction error than{' '}
        <code>stacked_ae</code>” but prints no errors, and its two models train for different numbers of epochs (10 and 20).
        {tr && (
          <>
            {' '}In this run, after the same 10 epochs, <code>tied_ae</code> is {tr.tied.finalValidMse < tr.stacked.valLoss[9] ? 'slightly lower' : 'higher'} than{' '}
            <code>stacked_ae</code>; after its full 20 epochs <code>stacked_ae</code> is {tr.stacked.finalValidMse < tr.tied.finalValidMse ? 'lower than both' : 'still higher than tied_ae'}.
          </>
        )}{' '}
        One seeded run, not a general result.
      </p>
    </Lab>
  );
}
