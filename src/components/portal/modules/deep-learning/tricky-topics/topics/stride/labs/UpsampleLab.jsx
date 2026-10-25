import { useRef, useState } from 'react';
import { Stage, StoryBar, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { useStory } from '../../../story';
import { countModel, working, layerName } from '../../../maths/paramRules.js';
import { MODELS } from '../../../maths/models.js';
import './stride.css';

/* Step 6 · transposed convolutions grow the image back: L6–7 slide 5's
   decoder, 3 × 3 × 16 → 7 × 7 × 32 → 14 × 14 × 16 → 28 × 28 × 1, one beat
   per Conv2DTranspose. Each square's side is the image's height. Switch the
   strides to 1 and the images barely grow — but every layer's parameter
   count stays exactly the same. Controls: the story, the stride switch. */

const DEC = MODELS['l67-convdec'].model;
const S1 = { ...DEC, layers: DEC.layers.map((L) => (L.t === 'conv2dT' ? { ...L, s: 1 } : L)) };

export function UpsampleLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [mode, setMode] = useState(2);
  const m = printing ? 2 : mode;
  const C = countModel(m === 2 ? DEC : S1);
  const tRows = C.rows.filter((r) => r.L.t === 'conv2dT');
  const start = C.rows.find((r) => r.L.t === 'reshape');
  const stages = [{ out: start.out, label: 'Reshape' }, ...tRows.map((r) => ({ out: r.out, r }))];
  const beats = stages.map((st, i) => ({
    label: `${st.out[0]} × ${st.out[1]}`,
    say: i === 0
      ? 'The decoder starts from a 3 × 3 × 16 block (the Dense layer’s 144 numbers, reshaped).'
      : `\`${layerName(st.r.L)}\`: ${st.r.ins[0][0]} → ${st.out[0]}; ${working(st.r.L, st.r.ins)} parameters, whatever the stride.`,
  }));
  const story = useStory(beats.length);
  const b = story.beat;
  const W = narrow ? 340 : 760;
  const H = narrow ? 300 : 240;
  const unit = narrow ? 5.2 : 6.2;
  const base = H - 50;
  const sides = stages.map((st) => Math.max(8, st.out[0] * unit));
  const lefts = sides.reduce((a, sd) => [...a, a[a.length - 1] + sd + (narrow ? 16 : 36)], [20]);
  const boxes = stages.map((st, i) => ({ ...st, side: sides[i], x: lefts[i], i }));
  return (
    <Stage
      title="Stride 2, transposed: the image grows back"
      prov={m === 2 ? '{s|L6–7 · slides 5–6}' : '{s|L6–7 · slides 5–6} {own}'}
      tryThis="Play the decoder, then switch to strides=1: what happens to the sizes, and to the parameter counts?"
      story={<StoryBar story={story} beats={beats} />}
      caption="A stride-2 transposed convolution spreads each input over a window twice as far apart, so height and width roughly double. The kernel is the same size either way, so the parameter count never changes."
      maths={
        <>
          {tRows.map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${r.ins[0][0]} → ${r.out[0]}; ${working(r.L, r.ins)}`} />)}
          <MLine text={'Sizes (Keras): “valid” gives $n \\times s + \\max(k - s, 0)$, “same” gives $n \\times s$: $3 \\times 2 + 1 = 7$, $7 \\times 2 = 14$, $14 \\times 2 = 28$ {beyond}. Slide 5 prints the sizes and slide 6 the counts {s|L6–7 · slides 5–6}.'} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Strides" value={m} onChange={setMode} options={[{ value: 2, label: 'strides=2 (slide 5)' }, { value: 1, label: 'strides=1' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Decoder sizes ${stages.map((s) => s.out[0]).join(', ')}; parameters ${tRows.map((r) => r.total).join(', ')}`}>
          {boxes.map((bx) => (
            <g key={bx.i} className={`dltt-fade${bx.i <= Math.max(0, b) ? '' : ' dltt-dim'}`}>
              <rect x={bx.x} y={base - bx.side} width={bx.side} height={bx.side} rx={3} className={`dltt-upbox${bx.i === b ? ' dltt-upbox--on' : ''}`} />
              <text x={bx.x + bx.side / 2} y={base + 16} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m dltt-t--b">{bx.out[0]}×{bx.out[1]}×{bx.out[2]}</text>
              {bx.r && <text x={bx.x + bx.side / 2} y={base + 32} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--w">{bx.r.total.toLocaleString('en-US')} params</text>}
            </g>
          ))}
        </svg>
      </div>
    </Stage>
  );
}
