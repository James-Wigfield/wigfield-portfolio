import { useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Stat } from '../ui';
import { MODELS, NAMED_CODE, PARAMS } from '../slideData';
import { useData, loadConv, CLASS_NAMES } from '../fashion';
import { flow, shapeText, fmt, fmtInt } from '../gen';
import { ImgRows, LossCurve, Pending } from './parts';
import './labsConv.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LAB FOR §1
     ConvFlowLab   slide 5's conv_encoder and conv_decoder, layer by layer:
                   every output shape and parameter count worked out live and
                   checked against the slide's shape comments and slide 6's
                   totals (13,873 and 54,479); the shapes drawn as a strip,
                   each one linked to its line of code; and this page's own
                   run of conv_ae on Fashion MNIST
   ========================================================================== */

const ENC = flow(MODELS.conv_encoder);
const DEC = flow(MODELS.conv_decoder);
const STAGES = [
  { part: 'enc', i: -1, shape: [28, 28], label: 'input' },
  ...ENC.rows.map((r, i) => ({ part: 'enc', i, shape: r.out, label: r.type })),
  ...DEC.rows.map((r, i) => ({ part: 'dec', i, shape: r.out, label: r.type })),
];

// one shape as a box: side grows with height × width, a stack of sheets
// for the depth (log scale), or a bar for a flat vector
function ShapeStrip({ on, onPick }) {
  const W = 760;
  const H = 150;
  const cell = W / STAGES.length;
  const base = 104;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dl67s-svg dl67s-cf__strip" role="img" aria-label="Every layer's output shape, from the 28 by 28 input through the 30 codings and back to 28 by 28">
      <line x1={cell * 10} y1={8} x2={cell * 10} y2={H - 16} className="dl67s-cf__mid" />
      <text x={cell * 5} y={12} textAnchor="middle" className="dl67s-svg__label">conv_encoder</text>
      <text x={cell * 10 + cell * 3.5} y={12} textAnchor="middle" className="dl67s-svg__label">conv_decoder</text>
      {STAGES.map((st, k) => {
        const cx = cell * k + cell / 2;
        const sel = on.part === st.part && on.i === st.i;
        const flat = st.shape.length === 1;
        const side = flat ? 0 : 8 + (st.shape[0] / 28) * 40;
        const depth = flat ? 0 : Math.min(6, Math.max(1, Math.round(Math.log2(st.shape[2] || 1)) - 1));
        const go = () => st.i >= 0 && onPick({ part: st.part, i: st.i });
        return (
          <g key={k} className={`dl67s-cf__st${sel ? ' dl67s-cf__st--on' : ''}${st.i >= 0 ? ' dl67s-cf__st--pick' : ''}`} onClick={go}>
            <rect x={cx - cell / 2 + 1} y={18} width={cell - 2} height={H - 30} className="dl67s-cf__hit" />
            {flat ? (
              <rect x={cx - 3} y={base - Math.min(70, 8 + st.shape[0] / 3)} width={6} height={Math.min(70, 8 + st.shape[0] / 3)} className="dl67s-cf__box" />
            ) : (
              Array.from({ length: depth }, (_, d) => (
                <rect key={d} x={cx - side / 2 + d * 2.2 - depth} y={base - side - d * 2.2} width={side} height={side} className="dl67s-cf__box" />
              ))
            )}
            <text x={cx} y={base + 14} textAnchor="middle" className="dl67s-cf__shape">{flat ? st.shape[0] : `${st.shape[0]}×${st.shape[1]}`}</text>
            {st.shape.length === 3 && <text x={cx} y={base + 25} textAnchor="middle" className="dl67s-cf__shape">×{st.shape[2]}</text>}
            <title>{`${st.label}: ${shapeText(st.shape)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

function FlowTable({ f, part, on, onPick }) {
  return (
    <table className="dl67s-table dl67s-cf__table">
      <thead><tr><th>layer (slide 5)</th><th>output (this page’s working)</th><th>slide 5’s comment</th><th className="dl67s-num">parameters</th></tr></thead>
      <tbody>
        {f.rows.map((r, i) => {
          const sel = on.part === part && on.i === i;
          const agrees = r.comment && (r.comment === shapeText(r.out) || r.comment === `${r.out[0]} neurons`);
          return (
            <tr key={i} className={sel ? 'dl67s-row--on' : undefined}>
              <td><button type="button" className="dl67s-rowbtn" aria-pressed={sel} onClick={() => onPick({ part, i })}><code>{r.call}</code></button></td>
              <td>{shapeText(r.out)}</td>
              <td>{r.comment ? <><code>{/neurons$/.test(r.comment) ? `# ${r.comment}` : `# output: ${r.comment}`}</code>{agrees && <Icon name="check" size={12} strokeWidth={2.4} className="dl67s-cf__ok" />}</> : <span className="dl67s-mini">—</span>}</td>
              <td className="dl67s-num">{fmtInt(r.params)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot><tr><td colSpan={3}>{part === 'enc' ? 'conv_encoder' : 'conv_decoder'}</td><td className="dl67s-num">{fmtInt(f.total)}</td></tr></tfoot>
    </table>
  );
}

export function ConvFlowLab() {
  const conv = useData(loadConv);
  const [view, setView] = useState('shapes');
  const [on, setOn] = useState({ part: 'dec', i: 2 });
  const rows = on.part === 'enc' ? ENC.rows : DEC.rows;
  const row = rows[on.i];
  const hl = row.lines ?? [row.line];
  const C = conv?.CONV;
  const total = ENC.total + DEC.total;
  return (
    <Lab
      title="conv_ae, layer by layer"
      slides="slides 5–6"
      tryThis="predict the output shape after each MaxPool2D before reading the table, especially the third. Then pick a layer in the strip or the table to find its line of code, and notice which layers hold the parameters."
    >
      <div className="dl-lab__controls">
        <Chips label="show" value={view} options={[{ v: 'shapes', l: 'shapes and parameters' }, { v: 'run', l: 'this page’s run of conv_ae' }]} onChange={setView} />
      </div>
      <div className={view === 'shapes' ? undefined : 'dl67s-screenonly-hidden'}>
        <div className="dl67s-wide"><ShapeStrip on={on} onPick={setOn} /></div>
        <div className="dl67s-cf">
          <div className="dl67s-cf__tables">
            <div className="dl67s-scroll"><FlowTable f={ENC} part="enc" on={on} onPick={setOn} /></div>
            <div className="dl67s-scroll"><FlowTable f={DEC} part="dec" on={on} onPick={setOn} /></div>
          </div>
          <div className="dl67s-noprint dl67s-cf__code">
            <Code code={NAMED_CODE.CONV_AE} label="slide 5" meta={`line ${row.line}`} hl={hl} />
          </div>
        </div>
        <div className="dl67s-stats dl67s-stats--tight">
          <Stat k="conv_encoder" v={fmtInt(ENC.total)} sub="this page’s working (slide 6 shows only the decoder)" />
          <Stat k="conv_decoder" v={fmtInt(DEC.total)} tone={DEC.total === PARAMS.convDecoder.value ? 'accent' : undefined} sub={DEC.total === PARAMS.convDecoder.value ? 'slide 6: “Total params: 13,873”' : 'this page’s count'} />
          <Stat k="conv_ae.count_params()" v={fmtInt(total)} tone={total === PARAMS.convAe.value ? 'accent' : undefined} sub={total === PARAMS.convAe.value ? 'slide 6 prints 54479' : 'this page’s count'} />
          <Stat k="selected layer" v={fmtInt(row.params)} sub={row.type === 'Dense' ? `${row.in[0]} × ${row.out[0]} + ${row.out[0]}` : row.type === 'Conv2D' || row.type === 'Conv2DTranspose' ? `${row.k} × ${row.k} × ${row.in[2]} × ${row.filters} + ${row.filters}` : 'no weights: only reshapes or pools'} />
        </div>
      </div>
      <div className={view === 'run' ? undefined : 'dl67s-screenonly-hidden'}>
        {!C ? <Pending /> : (
          <div className="dl67s-cf__run">
            <div className="dl67s-scroll">
              <ImgRows
                rows={[
                  { key: 'o', label: 'originals', cells: C.items.slice(0, 6).map((it) => ({ b64: it.original, label: `original: ${CLASS_NAMES[it.label]}`, note: CLASS_NAMES[it.label] })) },
                  { key: 'r', label: 'conv_ae', cells: C.items.slice(0, 6).map((it) => ({ b64: it.recon, label: `conv_ae's reconstruction of ${CLASS_NAMES[it.label]}`, note: `MSE ${fmt(it.mse, 4)}` })) },
                ]}
              />
            </div>
            <div className="dl67s-cf__low">
              <figure className="dl67s-cf__curve">
                <figcaption className="dl67s-stagehead">conv_ae’s loss by epoch (MSE)</figcaption>
                <LossCurve label={`conv_ae training and validation loss over ${C.epochs} epochs`} series={[{ label: 'train', values: C.loss, tone: 'a' }, { label: 'valid', values: C.valLoss, tone: 'b' }]} />
              </figure>
              <div className="dl67s-stats dl67s-stats--col">
                <Stat k={`validation MSE after ${C.epochs} epochs`} v={fmt(C.finalValidMse, 4)} sub="this page’s run" />
                <Stat k="parameters (TensorFlow’s count)" v={fmtInt(C.params.conv_ae)} tone={C.params.conv_ae === PARAMS.convAe.value ? 'accent' : undefined} sub="as slide 6" />
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="dl67s-cap">
        Output shapes and per-layer counts are this page’s working with Keras’s rules (TensorFlow reports the same for this page’s run); the totals
        13,873 and 54,479 are slide 6’s. In the strip each box’s size follows the height and width, the stack of sheets the number of channels (log scale), and a bar
        is a flat vector. <span className="dl67s-own">this page’s own run</span> conv_ae built and trained as slide 5 (Nadam, MSE{C ? `, ${C.epochs} epochs` : ''}) with
        TensorFlow on Fashion MNIST; the first validation images. No slide shows conv_ae’s reconstructions.
      </p>
    </Lab>
  );
}

