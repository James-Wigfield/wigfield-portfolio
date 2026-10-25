import { Code, Tex } from '../../../kit';
import { texText } from '../../texText';
import { kerasCode, summaryRows, sentence, equations } from './forms';

/* ============================================================================
   TOPIC 1 · A MODEL IN ONE OF ITS FIVE FORMS (the lab and the drill)
   ----------------------------------------------------------------------------
   <FormView model form blanks /> — form: code | diagram | summary | sentence |
   equations. `blanks` (summary only) = row indices whose Param # is shown as
   "?" (and 'total' to hide the totals). The diagram is the exam's kind of
   sketch: one box per layer, top to bottom, with the skip arrow a
   Concatenate needs.
   ========================================================================== */

function boxLabel(L) {
  const k = Array.isArray(L.k) ? `${L.k[0]}×${L.k[1]}` : `${L.k}×${L.k}`;
  switch (L.t) {
    case 'dense': return `Dense · ${L.units} unit${L.units > 1 ? 's' : ''}${L.bias === false ? ', no bias' : ''}`;
    case 'conv2d': return `Conv2D · ${L.filters} filters ${k}${L.s && L.s !== 1 ? `, stride ${L.s}` : ''}${L.pad === 'same' ? ', same' : ''}`;
    case 'conv1d': return `Conv1D · ${L.filters} kernels, size ${L.k}${L.s && L.s !== 1 ? `, stride ${L.s}` : ''}`;
    case 'conv2dT': return `Conv2DTranspose · ${L.filters} filters ${k}, stride ${L.s ?? 1}`;
    case 'maxpool2d': return `MaxPool ${L.p ?? 2}×${L.p ?? 2}`;
    case 'avgpool2d': return `AvgPool ${L.p ?? 2}×${L.p ?? 2}`;
    case 'maxpool1d': return `MaxPool1D ${L.p ?? 2}`;
    case 'gap2d': return 'Global avg pool';
    case 'gap1d': return 'Global avg pool (1D)';
    case 'flatten': return 'Flatten';
    case 'dropout': return `Dropout ${L.rate ?? 0.5}`;
    case 'bn': return 'Batch norm';
    case 'norm': return 'Normalization';
    case 'concat': return 'Concat';
    case 'simplernn': return `SimpleRNN · ${L.units} neurons${L.seq ? ' (seq)' : ''}`;
    case 'lstm': return `LSTM · ${L.units} units${L.seq ? ' (seq)' : ''}`;
    case 'gru': return `GRU · ${L.units} units${L.seq ? ' (seq)' : ''}`;
    case 'bidir': return `Bidirectional ${boxLabel(L.layer)}`;
    case 'reshape': return `Reshape ${L.to.join('×')}`;
    default: return L.t;
  }
}

function inputLabel(model) {
  const s = model.input;
  if (s.length === 1) return `Input · ${s[0]} features`;
  if (s.length === 2 && model.layers.some((L) => ['simplernn', 'lstm', 'gru', 'bidir', 'conv1d'].includes(L.t))) return `Input · sequences, ${s[1]} per step`;
  return `Input · ${s.join(' × ')}`;
}

export function ModelSketch({ model, compact = false }) {
  const rowH = compact ? 30 : 34;
  const bw = 248;
  const x0 = 26;
  const W = 340;
  const items = [{ label: inputLabel(model), id: 'input', input: true }, ...model.layers.map((L, i) => ({ label: boxLabel(L), id: L.id ?? `l${i}`, L }))];
  const H = items.length * rowH + 8;
  const yOf = (i) => 4 + i * rowH;
  const idx = Object.fromEntries(items.map((it, i) => [it.id, i]));
  return (
    <svg className="dltt-fig dltt-sketch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A sketch of the model: ${items.map((it) => it.label).join(', then ')}`}>
      {items.map((it, i) => {
        const y = yOf(i);
        return (
          <g key={it.id + i}>
            {i > 0 && <line x1={x0 + bw / 2} y1={y - (rowH - 22)} x2={x0 + bw / 2} y2={y - 1} className="dltt-sketch__wire" />}
            <rect x={x0} y={y} width={bw} height={22} rx={4} className={`dltt-sketch__box${it.input ? ' dltt-sketch__box--in' : ''}`} />
            <text x={x0 + bw / 2} y={y + 15} textAnchor="middle" className="dltt-fig__t" fontSize={11}>{it.label}</text>
          </g>
        );
      })}
      {/* the Concatenate's skip input: an elbow on the right from its first source */}
      {items.map((it, i) => {
        if (it.L?.t !== 'concat') return null;
        const src = idx[it.L.in[0]];
        if (src === undefined) return null;
        const ys = yOf(src) + 11;
        const yd = yOf(i) + 11;
        const xr = x0 + bw + 22;
        return (
          <g key={`skip${i}`} className="dltt-sketch__skip">
            <path d={`M${x0 + bw} ${ys} H${xr} V${yd} H${x0 + bw + 6}`} />
            <path d={`M${x0 + bw + 11} ${yd - 4} L${x0 + bw + 5} ${yd} L${x0 + bw + 11} ${yd + 4}`} />
          </g>
        );
      })}
      {/* arrowheads on the straight wires */}
      {items.map((it, i) => (i > 0 ? <path key={`h${i}`} d={`M${x0 + bw / 2 - 4} ${yOf(i) - 6} L${x0 + bw / 2} ${yOf(i) - 1} L${x0 + bw / 2 + 4} ${yOf(i) - 6}`} className="dltt-sketch__wire" /> : null))}
    </svg>
  );
}

export function SummaryTable({ model, blanks = [], showTotal = true }) {
  const s = summaryRows(model);
  const hide = new Set(blanks);
  return (
    <div className="dltt-scroll">
      <table className="dltt-summary">
        <thead>
          <tr><th>Layer (type)</th><th>Output Shape</th><th className="dltt-num">Param #</th></tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={i}>
              <td><code>{r.name}</code></td>
              <td><code>{r.out}</code></td>
              <td className="dltt-num">{hide.has(i) ? <span className="dltt-blank" aria-label="blank">?</span> : r.params.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total params: {showTotal && !hide.has('total') ? s.total.toLocaleString('en-US') : <span className="dltt-blank">?</span>}</td></tr>
          {s.nonTrainable > 0 && (
            <>
              <tr><td colSpan={3}>Trainable params: {showTotal && !hide.has('total') ? s.trainable.toLocaleString('en-US') : <span className="dltt-blank">?</span>}</td></tr>
              <tr><td colSpan={3}>Non-trainable params: {showTotal && !hide.has('total') ? s.nonTrainable.toLocaleString('en-US') : <span className="dltt-blank">?</span>}</td></tr>
            </>
          )}
        </tfoot>
      </table>
    </div>
  );
}

export default function FormView({ model, form, blanks, codeLabel = 'model.py · generated', compact }) {
  if (form === 'code') return <Code code={kerasCode(model)} label={codeLabel} />;
  if (form === 'diagram') return <figure className="dltt-formfig"><ModelSketch model={model} compact={compact} /></figure>;
  if (form === 'summary') return <SummaryTable model={model} blanks={blanks} />;
  if (form === 'sentence') return <p className="dltt-sentence">“{sentence(model)}”</p>;
  if (form === 'equations') {
    return (
      <div className="dltt-eqs">
        {equations(model).map((t) => (
          <div key={t} className="dltt-eqs__line">
            <Tex block src={t} />
            <p className="dltt-texalt dltt-texalt--block">{texText(t)}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
