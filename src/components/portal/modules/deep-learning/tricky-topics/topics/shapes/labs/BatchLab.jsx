import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import { countModel } from '../../../maths/paramRules.js';
import { showShape } from '../../../maths/shapeRules.js';
import { MODELS } from '../../../maths/models.js';
import './shapes.css';

/* Step 2 · the batch axis. L3 slide 35's CNN fed 1, 2 or 32 images: the
   input and output tuples change only in their first number; summary()
   writes that number as None, and the parameter count never moves. One
   control: the batch size. */

const M = MODELS['l3-cnn'].model;
const C = countModel(M);
const OUT = C.rows[C.rows.length - 1].out;

export function BatchLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [bRaw, setB] = useState(32);
  const b = printing ? 32 : bRaw;
  const W = narrow ? 340 : 720;
  const H = narrow ? 330 : 210;
  const inX = narrow ? 30 : 20;
  const modelX = narrow ? 120 : 290;
  const outX = narrow ? 30 : 470;
  return (
    <Stage
      title="Only the first number changes"
      prov="{s|L3 · slides 16, 35} {s|L1 · slide 36} {own}"
      tryThis="Switch the batch size and watch the two tuples: which number moves, and does the parameter count?"
      caption="The batch axis counts the examples processed together, so a model works for any batch size; summary() prints it as None."
      maths={
        <>
          <MLine text={`In: $(${b}, ${M.input.join(', ')})$ → out: $(${b}, ${OUT.join(', ')})$. In \`summary()\`: \`${showShape(M.input)}\` → \`${showShape(OUT)}\`.`} />
          <MLine text={`Parameters: ${C.total.toLocaleString('en-US')} for any batch size {own}: weights are shaped by the layers, not by the number of examples.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Batch size" value={b} onChange={setB} options={[1, 2, 32].map((v) => ({ value: v, label: `${v} image${v > 1 ? 's' : ''}` }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A batch of ${b}: input (${b}, 28, 28, 1), output (${b}, 10); summary shows None`}>
          <TensorGlyph x={inX} y={10} shape={M.input} kind="image" batch={b === 1 ? undefined : b} fit={narrow ? [130, 110] : [200, 130]} />
          <g transform={`translate(${modelX} ${narrow ? 40 : 50})`}>
            <rect x={0} y={0} width={narrow ? 120 : 120} height={56} rx={8} className="dltt-cell" />
            <text x={60} y={24} textAnchor="middle" className="dltt-t dltt-t--b" style={{ fontSize: 12 }}>slide 35’s CNN</text>
            <text x={60} y={42} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{C.total.toLocaleString('en-US')} params</text>
          </g>
          {!narrow && <line x1={250} y1={78} x2={286} y2={78} className="dltt-wire dltt-wire--data" />}
          {!narrow && <line x1={414} y1={78} x2={460} y2={78} className="dltt-wire dltt-wire--data" />}
          <TensorGlyph x={outX} y={narrow ? 150 : 50} shape={OUT} kind="vec" batch={b === 1 ? undefined : b} fit={[200, 60]} />
          <g transform={`translate(${narrow ? 20 : 20} ${narrow ? 236 : 168})`}>
            <text x={0} y={0} className="dltt-t dltt-t--m" style={{ fontSize: 15 }}>
              in (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>, 28, 28, 1){narrow ? '' : '   →   '}
              {!narrow && <>out (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>, 10)</>}
            </text>
            {narrow && <text x={0} y={24} className="dltt-t dltt-t--m" style={{ fontSize: 15 }}>out (<tspan className="dltt-axt--batch dltt-t--b">{b}</tspan>, 10)</text>}
            <text x={0} y={narrow ? 52 : 26} className="dltt-t dltt-t--s">summary(): <tspan className="dltt-t--m">{showShape(M.input)} → {showShape(OUT)}</tspan></text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
