import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import { countModel } from '../../../maths/paramRules.js';
import { MODELS } from '../../../maths/models.js';
import './shapes.css';

/* Step 2 · the batch axis. A model fed 1, 2 or 32 examples: the input and
   output tuples change only in their first number; summary() writes that
   number as None (batch-coloured), and the parameter count never moves.
   Two models: L3 slide 35's CNN, where `shape=[28, 28, 1]` leaves the batch
   out and Keras adds it, and L4 slide 24's `shape=[None, 1]`, where the
   None you write is the time axis and Keras still adds the batch None in
   front. Controls: the model, the batch size. */

const CASES = {
  cnn: {
    label: 'L3 s35 CNN',
    model: 'l3-cnn',
    kind: 'image',
    code: 'InputLayer(shape=[28, 28, 1])',
    // what summary() prints for the input: [text, axis role]
    summaryIn: [['None', 'batch'], ['28', 'h'], ['28', 'wd'], ['1', 'c']],
    summaryOut: [['None', 'batch'], ['10', 'f']],
    note: 'Keras adds the batch axis in front: None = any batch size.',
    prov: '{s|L3 · slides 16, 35} {own}',
  },
  rnn: {
    label: 'L4 s24: shape=[None, 1]',
    model: 'l4-rnn1',
    kind: 'seq',
    code: 'InputLayer(shape=[None, 1])',
    summaryIn: [['None', 'batch'], ['None', 't'], ['1', 'f']],
    summaryOut: [['None', 'batch'], ['1', 'f']],
    note: 'The None you write is the time axis (any length); Keras still adds the batch None in front.',
    prov: '{s|L4 · slides 21, 24, 25} {own}',
  },
};

const fmt = (v) => v.toLocaleString('en-US');

function Tuple({ parts }) {
  return (
    <>
      (
      {parts.map(([v, role], i) => (
        <tspan key={i}>
          {i > 0 && ', '}
          <tspan className={`dltt-axt--${role}${v === 'None' ? ' dltt-t--b' : ''}`}>{v}</tspan>
        </tspan>
      ))}
      )
    </>
  );
}

export function BatchLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [bRaw, setB] = useState(32);
  const [caseRaw, setCase] = useState('cnn');
  const b = printing ? 32 : bRaw;
  const ck = printing ? 'cnn' : caseRaw;
  const K = CASES[ck];
  const M = MODELS[K.model].model;
  const C = countModel(M);
  const OUT = C.rows[C.rows.length - 1].out;
  const W = narrow ? 340 : 720;
  const H = narrow ? 372 : 238;
  const inX = narrow ? 30 : 20;
  const modelX = narrow ? 180 : 290;
  const outX = narrow ? 30 : 470;
  const inRoles = ck === 'cnn' ? ['h', 'wd', 'c'] : ['t', 'f'];
  const tY = narrow ? 238 : 168;
  return (
    <Stage
      title="Only the first number changes"
      prov={K.prov}
      tryThis="Switch the batch size and watch the two tuples: which number moves, and does the parameter count? Then switch to L4’s shape=[None, 1]."
      caption="The batch axis counts the examples processed together, so a model works for any batch size; summary() prints it as None. A None you write yourself is a different axis."
      maths={
        <>
          <MLine text={`In: $(${b}, ${M.input.join(', ')})$ → out: $(${b}, ${OUT.join(', ')})$. \`${K.code}\` → \`summary()\` prints \`(${K.summaryIn.map((p) => p[0]).join(', ')})\` → \`(${K.summaryOut.map((p) => p[0]).join(', ')})\`.`} />
          {ck === 'rnn' && <MLine text="The 56 time steps drawn here are one rail sequence (slide 21 prints `xx.shape = (32, 56)`); the model takes any length {s|L4 · slide 21}." />}
          <MLine text={`Parameters: ${fmt(C.total)} for any batch size {own}: weights are shaped by the layers, not by the number of examples.`} />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dltt-batch__ctl">
          <Switch label="Model" value={ck} onChange={setCase} options={Object.entries(CASES).map(([value, c]) => ({ value, label: c.label }))} />
          <Switch label="Batch size" value={b} onChange={setB} options={[1, 2, 32].map((v) => ({ value: v, label: `${v} example${v > 1 ? 's' : ''}` }))} />
        </div>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A batch of ${b}: input (${b}, ${M.input.join(', ')}), output (${b}, ${OUT.join(', ')}); summary shows (${K.summaryIn.map((p) => p[0]).join(', ')})`}>
          <TensorGlyph x={inX} y={10} shape={M.input} kind={K.kind} batch={b === 1 ? undefined : b} fit={narrow ? [130, 110] : [200, 130]} />
          <g transform={`translate(${modelX} ${narrow ? 40 : 50})`}>
            <rect x={0} y={0} width={120} height={56} rx={8} className="dltt-cell" />
            <text x={60} y={24} textAnchor="middle" className="dltt-t dltt-t--b" style={{ fontSize: 12 }}>{ck === 'cnn' ? 'slide 35’s CNN' : 'SimpleRNN(1)'}</text>
            <text x={60} y={42} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{fmt(C.total)} params</text>
          </g>
          {!narrow && <line x1={250} y1={78} x2={286} y2={78} className="dltt-wire dltt-wire--data" />}
          {!narrow && <line x1={414} y1={78} x2={460} y2={78} className="dltt-wire dltt-wire--data" />}
          <TensorGlyph x={outX + (narrow ? 150 : 0)} y={narrow ? 150 : 50} shape={OUT} kind="vec" batch={b === 1 ? undefined : b} fit={narrow ? [130, 60] : [200, 60]} />
          <g transform={`translate(20 ${tY})`}>
            <text x={0} y={0} className="dltt-t dltt-t--m" style={{ fontSize: 15 }}>
              in (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>
              {M.input.map((v, i) => <tspan key={i}>, <tspan className={`dltt-axt--${inRoles[i]}`}>{v}</tspan></tspan>)})
              {narrow ? '' : '   →   '}
              {!narrow && <>out (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>, {OUT.join(', ')})</>}
            </text>
            {narrow && <text x={0} y={22} className="dltt-t dltt-t--m" style={{ fontSize: 15 }}>out (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>, {OUT.join(', ')})</text>}
            <text x={0} y={narrow ? 50 : 30} className="dltt-t dltt-t--s dltt-t--m">{K.code}</text>
            <text x={0} y={narrow ? 72 : 52} className="dltt-t dltt-t--s">
              summary(): <tspan className="dltt-t--m"><Tuple parts={K.summaryIn} /> → <Tuple parts={K.summaryOut} /></tspan>
            </text>
            <text x={0} y={narrow ? 94 : 72} className="dltt-t dltt-t--xs">{K.note}</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
