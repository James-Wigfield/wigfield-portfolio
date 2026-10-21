import { useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Stat } from '../ui';
import { CAPTIONS, NAMED_CODE, PARAMS, STACKED_LINE_LAYER } from '../slideData';
import { stackParams, fmtInt } from '../ae';
import './labsStacked.css';

/* ============================================================================
   LECTURE 5 STUDY — LABS FOR §4 AND §5
     SandwichLab     Figure 17-3 as a builder: a symmetric stack around the
                     coding layer, every layer's size and every connection's
                     weight shape and parameter count; and slide 10's
                     thought experiment, an encoder "too powerful" to learn
                     anything useful
     StackedCodeLab  slide 12's stacked_ae, layer by layer: output size and
                     parameters for each line, summing to slide 12's 163,814;
                     pick a row to light up its line of code
   ========================================================================== */

/* ── §4 · the sandwich ───────────────────────────────────────────────────── */
const HIDDEN = [50, 100, 300];
const CODING = [2, 10, 30, 100];

function StackSvg({ sizes }) {
  const names = ['Input layer', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output layer'];
  const w = (n) => 40 + 26 * Math.log2(n);
  const gap = 58;
  const H = 30 + gap * 4 + 34;
  const y = (i) => H - 34 - i * gap;
  const cx = 250;
  const { layers } = stackParams(sizes);
  return (
    <svg viewBox={`0 0 520 ${H}`} className="dl5s-svg dl5s-sand" role="img" aria-label={`A stacked autoencoder: ${sizes.join(' to ')} units, drawn bottom to top`}>
      {sizes.map((n, i) => (
        <g key={i}>
          {i > 0 && (
            <g>
              <line x1={cx} y1={y(i) + 24} x2={cx} y2={y(i - 1)} className="dl5s-sand__link" />
              <text x={cx + 10} y={(y(i) + 24 + y(i - 1)) / 2 + 4} className="dl5s-sand__w">
                W {fmtInt(layers[i - 1].inputs)} × {fmtInt(layers[i - 1].units)} + b {fmtInt(layers[i - 1].units)} = {fmtInt(layers[i - 1].total)}
              </text>
            </g>
          )}
          <rect x={cx - w(n) / 2} y={y(i)} width={w(n)} height={24} rx={5} className={`dl5s-sand__box dl5s-sand__box--${i === 0 || i === 4 ? 'io' : i === 2 ? 'code' : 'hid'}`} />
          <text x={cx} y={y(i) + 16} textAnchor="middle" className="dl5s-sand__name">{names[i]}</text>
          <text x={cx - w(n) / 2 - 10} y={y(i) + 16} textAnchor="end" className="dl5s-sand__units">{fmtInt(n)} units</text>
        </g>
      ))}
      <text x={cx - w(sizes[2]) / 2 - 10} y={y(2) - 6} textAnchor="end" className="dl5s-sand__tag">coding layer → codings</text>
      <text x={cx - w(sizes[4]) / 2 - 10} y={y(4) - 6} textAnchor="end" className="dl5s-sand__tag">reconstruction</text>
    </svg>
  );
}

const TOY = [
  { name: 'training image 1', code: 0.137 },
  { name: 'training image 2', code: 0.802 },
  { name: 'training image 3', code: 0.415 },
  { name: 'training image 4', code: 0.958 },
];

export function SandwichLab() {
  const [hidden, setHidden] = useState(100);
  const [coding, setCoding] = useState(30);
  const [mode, setMode] = useState('useful');
  const sizes = [784, hidden, coding, hidden, 784];
  const { total } = stackParams(sizes);
  const notSandwich = coding >= hidden;
  return (
    <Lab
      title="Build the sandwich (Figure 17-3)"
      fig={CAPTIONS.fig173}
      slides="slides 10–11"
      tryThis="predict how the parameter count changes if you halve the hidden layers, then try it. Then switch to “too powerful” and notice what perfect training reconstructions leave out."
    >
      <div className="dl-lab__controls">
        <Chips label="hidden layers" value={hidden} options={HIDDEN.map((v) => ({ v, l: `${v} units`, tag: v === 100 ? 'slide 11' : undefined }))} onChange={setHidden} />
        <Chips label="coding layer" value={coding} options={CODING.map((v) => ({ v, l: `${v} units`, tag: v === 30 ? 'slide 11' : undefined }))} onChange={setCoding} />
        <Chips label="encoder" value={mode} options={[{ v: 'useful', l: 'learns a useful code' }, { v: 'powerful', l: 'too powerful (slide 10)' }]} onChange={setMode} />
      </div>
      {mode === 'useful' ? (
        <div className="dl5s-sand__grid">
          <div className="dl5s-wide"><StackSvg sizes={sizes} /></div>
          <div className="dl5s-stats dl5s-stats--col">
            <Stat k="the sandwich" v={sizes.join(' → ')} sub="symmetric about the coding layer" />
            <Stat k="parameters" v={fmtInt(total)} tone={total === PARAMS.stacked.value ? 'accent' : undefined} sub={total === PARAMS.stacked.value ? 'slide 12’s count for this shape' : 'weights + biases of the four Dense layers'} />
            <Stat k="numbers per image" v={`784 → ${coding}`} sub={`about 1/${Math.round(784 / coding)} as many numbers (this page’s arithmetic)`} />
          </div>
        </div>
      ) : (
        <div className="dl5s-sand__toy" role="group" aria-label="Slide 10's thought experiment">
          <p className="dl5s-stagehead">An encoder that maps each input to a single arbitrary number</p>
          <ol className="dl5s-sand__map">
            {TOY.map((t) => (
              <li key={t.name}>
                <span>{t.name}</span><span className="dl5s-sand__arrow">→</span><code>{t.code}</code><span className="dl5s-sand__arrow">→</span><span>{t.name}, exactly</span>
              </li>
            ))}
            <li className="dl5s-sand__new">
              <span>a new image</span><span className="dl5s-sand__arrow">→</span><code>?</code><span className="dl5s-sand__arrow">→</span><span>no number was learned for it</span>
            </li>
          </ol>
          <div className="dl5s-stats dl5s-stats--tight">
            <Stat k="training reconstructions" v="perfect" />
            <Stat k="useful representation" v="none" sub="the number says nothing about the image" />
            <Stat k="new instances" v="unlikely to generalize" sub="slide 10" />
          </div>
        </div>
      )}
      <p className="dl5s-cap">
        {notSandwich && mode === 'useful' && <><b>Not a sandwich:</b> the coding layer is no longer the narrowest layer. </>}
        {mode === 'useful'
          ? 'Box widths grow with the number of units (on a log scale). Each connection is one Dense layer: a weight per input per unit plus a bias per unit (this page’s working; slide 12 prints only the total). The page builds the decoder as the encoder’s mirror image, as Figure 17-3 does.'
          : 'This page’s illustration of slide 10’s thought experiment: the numbers are arbitrary, as the slide says. The decoder learns the reverse lookup, so it reconstructs the training data perfectly, but nothing about the images was learned along the way. More layers help an autoencoder learn more complex codings; too much power lets it memorise instead.'}
      </p>
    </Lab>
  );
}

/* ── §5 · slide 12's stacked_ae, layer by layer ──────────────────────────── */
const ROWS = [
  { id: 'input', layer: 'InputLayer(shape=[28,28])', part: 'stacked_encoder', out: '28 × 28', w: null, b: null },
  { id: 'flatten', layer: 'Flatten()', part: 'stacked_encoder', out: '784', w: null, b: null },
  { id: 'enc1', layer: 'Dense(100, activation="relu")', part: 'stacked_encoder', out: '100', w: [784, 100], b: 100 },
  { id: 'enc2', layer: 'Dense(30, activation="relu")', part: 'stacked_encoder', out: '30 (the codings)', w: [100, 30], b: 30 },
  { id: 'dec1', layer: 'Dense(100, activation="relu")', part: 'stacked_decoder', out: '100', w: [30, 100], b: 100 },
  { id: 'dec2', layer: 'Dense(28 * 28)', part: 'stacked_decoder', out: '784', w: [100, 784], b: 784 },
  { id: 'reshape', layer: 'Reshape([28, 28])', part: 'stacked_decoder', out: '28 × 28', w: null, b: null },
];
const LINES_FOR = Object.entries(STACKED_LINE_LAYER).reduce((acc, [line, id]) => {
  (acc[id] ||= []).push(Number(line));
  return acc;
}, {});
const rowParams = (r) => (r.w ? r.w[0] * r.w[1] + r.b : 0);
const TOTAL = ROWS.reduce((s, r) => s + rowParams(r), 0);

export function StackedCodeLab() {
  const [on, setOn] = useState('enc1');
  const hl = LINES_FOR[on] ?? [];
  return (
    <Lab
      title="stacked_ae, layer by layer"
      slides="slide 12"
      tryThis="before reading the right-hand column, predict which layer holds the most parameters. Then pick each row to find its line in the code, and notice which two layers hold almost all of them; pick the fit() line to see what the targets are."
    >
      <div className="dl5s-scode">
        <div className="dl5s-scroll">
          <table className="dl5s-table dl5s-scode__table">
            <thead>
              <tr><th>layer</th><th>output per image</th><th>weights W</th><th className="dl5s-num">+ biases</th><th className="dl5s-num">parameters</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.id} className={on === r.id ? 'dl5s-row--on' : undefined}>
                  <td>
                    {(i === 0 || ROWS[i - 1].part !== r.part) && <span className="dl5s-scode__part">{r.part}</span>}
                    <button type="button" className="dl5s-rowbtn" aria-pressed={on === r.id} onClick={() => setOn(r.id)}><code>{r.layer}</code></button>
                  </td>
                  <td>{r.out}</td>
                  <td>{r.w ? `${r.w[0]} × ${r.w[1]} = ${fmtInt(r.w[0] * r.w[1])}` : 'none'}</td>
                  <td className="dl5s-num">{r.b ? fmtInt(r.b) : '—'}</td>
                  <td className="dl5s-num">{fmtInt(rowParams(r))}</td>
                </tr>
              ))}
              <tr className={on === 'fit' ? 'dl5s-row--on' : undefined}>
                <td colSpan={5}>
                  <button type="button" className="dl5s-rowbtn" aria-pressed={on === 'fit'} onClick={() => setOn('fit')}><code>stacked_ae.fit(X_train, X_train, …)</code></button>
                  {' '}the inputs are also the targets, for training and validation
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>total trainable parameters</td>
                <td className="dl5s-num">{fmtInt(TOTAL)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="dl5s-noprint">
          <Code code={NAMED_CODE.STACKED_AE} label="slide 12" meta="stacked_ae" hl={hl} />
        </div>
      </div>
      <p className="dl5s-total">
        {ROWS.filter((r) => r.w).map((r) => fmtInt(rowParams(r))).join(' + ')} = <b>{fmtInt(TOTAL)}</b>{' '}
        {TOTAL === PARAMS.stacked.value && <span className="dl5s-scode__ok"><Icon name="check" size={13} strokeWidth={2.4} /> slide 12: “163,814 trainable parameters”</span>}
      </p>
      <p className="dl5s-cap">
        The per-layer split is this page’s working; slide 12 prints only the total. A Dense layer’s parameters are its inputs × units weights plus one bias per unit.
        <code> InputLayer</code>, <code>Flatten</code> and <code>Reshape</code> have no weights: <code>InputLayer</code> only declares the input shape, and the other two only reshape the data. The two biggest layers are the two that touch the 784 pixels.
      </p>
    </Lab>
  );
}
