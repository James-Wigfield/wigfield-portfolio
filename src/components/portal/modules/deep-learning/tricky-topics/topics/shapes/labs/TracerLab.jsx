import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import { traceShapes, showShape, glyphKind, prod } from '../../../maths/shapeRules.js';
import { layerName } from '../../../maths/paramRules.js';
import { MODELS } from '../../../maths/models.js';
import { shapeRule } from '../shapeText.js';
import './shapes.css';

/* Step 5 · the shape tracer. Pick one of the unit's models and step through
   it: the tensor going into the current layer, the layer and its shape rule,
   the tensor coming out. The ribbon underneath lists every layer's output
   shape (batch as None). Two controls: the model and the layer. */

const CHOICES = {
  'l3-cnn': { label: 'L3 s35 CNN', prov: '{s|L3 · slide 35} {own}', seq: false },
  'l67-convae': { label: 'L6–7 conv AE', prov: '{s|L6–7 · slides 5–6} {own}', seq: false },
  'l4-cnngru': { label: 'L4 s50 Conv1D + GRU', prov: '{s|L4 · slide 50} {own}', seq: true },
  'l67-dcgan-g': { label: 'DCGAN generator', prov: '{s|L6–7 · slide 29} {own}', seq: false },
};

export function TracerLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [key, setKey] = useState('l67-convae');
  const [stepRaw, setStep] = useState(10);
  const ch = CHOICES[key];
  const rows = traceShapes(MODELS[key].model);
  const step = printing ? Math.min(10, rows.length - 1) : Math.min(stepRaw, rows.length - 1);
  const r = rows[step];
  const W = narrow ? 340 : 760;
  const H = narrow ? 380 : 230;
  const kindOf = (s) => glyphKind(s, ch.seq);
  const fit = narrow ? [150, 120] : [230, 150];
  // the strip under the stage: one bar per layer, as tall as the log of how many numbers come out
  const sizes = [MODELS[key].model.input, ...rows.map((row) => row.out)].map((s) => Math.log10(prod(s.map((v) => v ?? 1)) + 1));
  const maxSize = Math.max(...sizes);
  const next = rows[step + 1];
  return (
    <Stage
      title="Watch a model reshape its data, layer by layer"
      prov={ch.prov}
      tryThis="Before each step, predict the next shape. Then drag the layer slider (or use the arrow keys)."
      caption="Convolutions and pooling resize height and width, Dense changes only the last axis, Flatten multiplies everything out; the batch axis never changes."
      maths={
        <>
          <MLine text={`\`${layerName(r.L)}\`: \`${showShape(r.ins[0])}\` → \`${showShape(r.out)}\`. ${shapeRule(r.L, r.ins, r.out)}`} />
          {key === 'l67-convae' && <MLine text="Slide 5’s comments print these sizes: 14 × 14 × 16, 7 × 7 × 32, 3 × 3 × 64, 3 × 3 × 30, 30, then 3 × 3 × 16, 7 × 7 × 32, 14 × 14 × 16, 28 × 28 × 1 {s|L6–7 · slide 5}." />}
          <MLine text={`Every output in turn: ${[MODELS[key].model.input, ...rows.map((row) => row.out)].map((s) => `\`${showShape(s)}\``).join(' → ')}.`} />
          {key === 'l4-cnngru' && <MLine text="Slide 50 doesn’t print the lengths: 56 comes from slide 20’s `seq_length = 56`; valid padding gives 56 → 54 → 26 {own}." />}
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Which model" value={key} onChange={(v) => { setKey(v); setStep(0); }} options={Object.entries(CHOICES).map(([value, c]) => ({ value, label: c.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Layer ${step + 1} of ${rows.length}: ${layerName(r.L)} turns ${showShape(r.ins[0])} into ${showShape(r.out)}`}>
          <text x={narrow ? 20 : 20} y={16} className="dltt-t dltt-t--xs">in</text>
          <TensorGlyph x={narrow ? 10 : 10} y={22} shape={r.ins[0]} kind={kindOf(r.ins[0])} fit={fit} />
          <g transform={`translate(${narrow ? 190 : 290} ${narrow ? 40 : 60})`}>
            <rect x={-6} y={-20} width={narrow ? 140 : 180} height={narrow ? 66 : 70} rx={7} className="dltt-cell" />
            <text x={4} y={0} className="dltt-t dltt-t--b dltt-t--m" style={{ fontSize: 12 }}>{layerName(r.L).length > 26 ? layerName(r.L).slice(0, 25) + '…' : layerName(r.L)}</text>
            <text x={4} y={20} className="dltt-t dltt-t--xs">layer {step + 1} of {rows.length}</text>
            <text x={4} y={36} className="dltt-t dltt-t--xs dltt-t--m">{showShape(r.out)}</text>
          </g>
          <text x={narrow ? 20 : 500} y={narrow ? 176 : 16} className="dltt-t dltt-t--xs">out</text>
          <TensorGlyph x={narrow ? 10 : 500} y={narrow ? 182 : 22} shape={r.out} kind={kindOf(r.out)} fit={fit} />
          <Scrub x0={30} x1={W - 30} y={H - 26} value={step} min={0} max={rows.length - 1} step={1} onChange={setStep} label="Layer" show={(v) => `${v + 1}`} ticks={[0, rows.length - 1]} tickLabel={(v) => `${v + 1}`} />
        </svg>
        <div className="dltt-ribbon" aria-label="How many numbers each layer outputs (log scale); pick a layer">
          <span className="dltt-ribbon__bar dltt-ribbon__bar--in" style={{ height: `${4 + (sizes[0] / maxSize) * 30}px` }} title={`input ${showShape(MODELS[key].model.input)}`} />
          {rows.map((row, i) => (
            <button
              key={i}
              type="button"
              className={`dltt-ribbon__btn${i === step ? ' dltt-ribbon--on' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Layer ${i + 1}, ${layerName(row.L)}: ${showShape(row.out)}`}
              aria-current={i === step ? 'step' : undefined}
              title={`${layerName(row.L)} → ${showShape(row.out)}`}
            >
              <span className="dltt-ribbon__bar" style={{ height: `${4 + (sizes[i + 1] / maxSize) * 30}px` }} />
            </button>
          ))}
        </div>
        <p className="dltt-ribbon__now">
          now <code>{showShape(r.out)}</code>{next ? <> → next <code>{showShape(next.out)}</code></> : ' (the output)'}
        </p>
      </div>
    </Stage>
  );
}
