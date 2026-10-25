import { useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useStudy } from '../../../context';
import { countModel, layerName } from '../../../maths/paramRules';
import { showTuple } from '../../../maths/shapeRules';
import { MODELS } from '../../../maths/models';
import FormView from '../FormView';
import './param.css';

/* Step 12 · one model, five disguises. L4 slide 10's example — 4 inputs
   per step, a simple RNN with 5 neurons, a 2-number prediction — shown as
   code, a sketch, a summary, a sentence or slide 9's equations. Whatever
   the form, the table underneath (layers, weight shapes, counts) never
   changes. One control: the form. */

const M = MODELS['l4-cell'].model;
const C = countModel(M);
const FORMS = [
  { value: 'code', label: 'Code' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'summary', label: 'summary()' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'equations', label: 'Equations' },
];
const HINT = {
  code: 'Read `units` off each layer and the input size off `InputLayer(shape=[None, 4])`.',
  diagram: 'Each box is a layer; its label gives the size. The input box gives $n_{\\text{in}}$.',
  summary: 'Each Output Shape is the next layer’s input: `(None, 5)` means the Dense layer gets 5.',
  sentence: '“5 neurons” and “4-dimensional inputs” are all the counting needs.',
  equations: '$\\mathbf{x}_{(t)} \\in \\mathbb{R}^4$ and $\\mathbf{h}_{(t)} \\in \\mathbb{R}^5$ fix $\\mathbf{W}_x$ at 4 × 5 and $\\mathbf{W}_h$ at 5 × 5 (slide 10).',
};

export function DisguiseLab() {
  const { printing } = useStudy();
  const [form, setForm] = useState('equations');
  const f = printing ? 'equations' : form;
  return (
    <Stage
      title="Same model, five disguises, one answer"
      prov="{s|L4 · slides 9–10} {own}"
      tryThis="Count it from the equations first. Then flip through the other forms: the table underneath never changes."
      caption={HINT[f]}
      maths={
        <>
          <MLine text="Slide 10’s sizes: $\mathbf{W}_h \in \mathbb{R}^{5 \times 5}$, $\mathbf{W}_x \in \mathbb{R}^{4 \times 5}$, $\mathbf{W}_y \in \mathbb{R}^{5 \times 2}$ {s|L4 · slide 10}." />
          <MLine text={`So $20 + 25 + 5 = ${C.rows[0].total}$ for the recurrent layer and $10 + 2 = ${C.rows[1].total}$ for the output: **${C.total}** {own}. Keras splits them the same way: \`SimpleRNN(5)\` then \`Dense(2)\`.`} />
        </>
      }
    >
      <div className="dltt-disguise">
        <Switch label="Form" value={f} onChange={setForm} options={FORMS} />
        <div className="dltt-disguise__form">
          <FormView model={M} form={f} />
        </div>
        <table className="dltt-drill__table dltt-disguise__table">
          <thead>
            <tr><th>Layer</th><th>Weights (shape → count)</th><th className="dltt-num">Params</th></tr>
          </thead>
          <tbody>
            {C.rows.map((r) => (
              <tr key={r.i}>
                <td><code>{layerName(r.L)}</code></td>
                <td>{r.weights.map((w) => `${w.name.replace(/ \(.*\)/, '')} ${showTuple(w.shape)} → ${w.n}`).join(' · ')}</td>
                <td className="dltt-num">{r.total}</td>
              </tr>
            ))}
            <tr className="dltt-disguise__total"><td>Total</td><td /><td className="dltt-num"><b>{C.total}</b></td></tr>
          </tbody>
        </table>
      </div>
    </Stage>
  );
}
