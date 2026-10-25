import { useRef, useState } from 'react';
import { Stage, StoryBar, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { useStory } from '../../../story';
import { countModel, working, layerName } from '../../../maths/paramRules.js';
import { MODELS } from '../../../maths/models.js';
import { convTOut } from '../../../maths/strideRules.js';
import './stride.css';

/* Step 6 · transposed convolutions grow the image back: L6–7 slide 5's
   decoder, 3 × 3 × 16 → 7 × 7 × 32 → 14 × 14 × 16 → 28 × 28 × 1, one beat
   per Conv2DTranspose. Each square's side is the image's height. Switch the
   strides to 1 and the images barely grow — but every layer's parameter
   count stays exactly the same. Above the squares, one row in 1D shows the
   mechanism: each of the 3 inputs stamps a 3-wide kernel onto the output,
   the stamps s apart, overlaps adding up: 3 × 2 + (3 − 2) = 7 at stride 2.
   Controls: the story, the stride switch. */

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
  const sideOf = (out) => Math.max(8, out[0] * unit);
  // lay the squares out by the stride-2 sizes, so switching strides doesn't move them;
  // at strides=1 the stride-2 squares stay as faint outlines for comparison
  const big = countModel(DEC);
  const bigStages = [big.rows.find((r) => r.L.t === 'reshape'), ...big.rows.filter((r) => r.L.t === 'conv2dT')];
  const bigSides = bigStages.map((r) => sideOf(r.out));
  const lefts = bigSides.reduce((a, sd) => [...a, a[a.length - 1] + sd + (narrow ? 16 : 36)], [20]);
  const boxes = stages.map((st, i) => ({ ...st, side: sideOf(st.out), ghost: bigSides[i], x: lefts[i], i }));

  // the 1D mechanism: the first layer's 3 inputs, kernel 3, stride m ("valid")
  const N1 = start.out[0];
  const K1 = tRows[0].L.k;
  const OUT1 = convTOut(N1, K1, m, 'valid');
  const cov = Array.from({ length: OUT1 }, (_, j) => Array.from({ length: N1 }, (_, i) => i).filter((i) => j >= i * m && j < i * m + K1).length);
  const mc = Math.min(narrow ? 38 : 46, (W - 40) / OUT1);
  const mx0 = (W - OUT1 * mc) / 2;
  const MH = 132;
  return (
    <Stage
      title="Stride 2, transposed: the image grows back"
      prov={m === 2 ? '{s|L6–7 · slides 5–6}' : '{s|L6–7 · slides 5–6} {own}'}
      tryThis="Play the decoder, then switch to strides=1: what happens to the sizes, and to the parameter counts?"
      story={<StoryBar story={story} beats={beats} />}
      caption={m === 2
        ? 'Each input stamps the kernel onto the output, the stamps 2 apart, and where stamps overlap they add up: 3 inputs give 3 × 2 + (3 − 2) = 7. Height and width roughly double; the kernel is the same size either way, so the parameter count never changes.'
        : 'At strides=1 the stamps sit only 1 apart, so the image grows by just k − 1 = 2 in the first layer and not at all with "same" padding (the faint squares are the stride-2 sizes). The parameter counts are exactly the same as at stride 2.'}
      maths={
        <>
          {tRows.map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${r.ins[0][0]} → ${r.out[0]}; ${working(r.L, r.ins)}`} />)}
          <MLine text={'Sizes (Keras): “valid” gives $n \\times s + \\max(k - s, 0)$, “same” gives $n \\times s$: $3 \\times 2 + 1 = 7$, $7 \\times 2 = 14$, $14 \\times 2 = 28$ {beyond}. Slide 5 prints the sizes and slide 6 the counts {s|L6–7 · slides 5–6}.'} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Strides" value={m} onChange={setMode} options={[{ value: 2, label: 'strides=2 (slide 5)' }, { value: 1, label: 'strides=1' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${MH}`} role="img" aria-label={`One row of the first layer: ${N1} inputs each stamp a ${K1}-wide kernel, ${m} apart, giving ${OUT1} outputs`}>
          <text x={mx0} y={14} className="dltt-t dltt-t--xs">{narrow ? `${N1} inputs, each stamps the ${K1}-wide kernel (blue)` : `one row of the first layer: ${N1} inputs, each stamps a ${K1}-wide kernel of weights (blue); overlaps add up`}</text>
          {Array.from({ length: N1 }, (_, i) => {
            const x = mx0 + (i * m + (K1 - 1) / 2) * mc;
            return (
              <g key={`in${i}`}>
                <rect x={x + 3} y={24} width={mc - 6} height={mc - 6} rx={3} className="dltt-incell dltt-incell--hit" />
                <text x={x + mc / 2} y={24 + (mc - 6) / 2 + 4} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">x{i + 1}</text>
                <rect x={mx0 + i * m * mc + 2} y={24 + mc + 4 + (i % 2) * 7} width={K1 * mc - 4} height={6} rx={3} className="dltt-stamp" />
                {i > 0 && <path d={`M${mx0 + (i - 1) * m * mc + 4} ${24 + mc + 2} Q ${mx0 + (i - 0.5) * m * mc + 4} ${24 + mc - 12} ${mx0 + i * m * mc + 4} ${24 + mc + 2}`} className="dltt-hop" />}
              </g>
            );
          })}
          <text x={mx0 + OUT1 * mc + 6} y={24 + mc + 2} className="dltt-t dltt-t--xs dltt-t--jump">{m} apart</text>
          {cov.map((c, j) => (
            <g key={`o${j}`}>
              <rect x={mx0 + j * mc + 2} y={MH - mc - 6} width={mc - 4} height={mc - 4} rx={3} className={`dltt-outcell${c > 1 ? ' dltt-outcell--hot' : ''}`} />
              {c > 1 && <text x={mx0 + j * mc + mc / 2} y={MH - mc / 2 - 4} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">+</text>}
            </g>
          ))}
          <text x={mx0 - 6} y={MH - mc / 2 - 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--b">{OUT1}</text>
        </svg>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Decoder sizes ${stages.map((s) => s.out[0]).join(', ')}; parameters ${tRows.map((r) => r.total).join(', ')}`}>
          {boxes.map((bx) => (
            <g key={bx.i} className={`dltt-fade${bx.i <= Math.max(0, b) ? '' : ' dltt-dim'}`}>
              {bx.ghost > bx.side + 1 && <rect x={bx.x} y={base - bx.ghost} width={bx.ghost} height={bx.ghost} rx={3} className="dltt-upbox--ghost" />}
              <rect x={bx.x} y={base - bx.side} width={bx.side} height={bx.side} rx={3} className={`dltt-upbox${bx.i === b ? ' dltt-upbox--on' : ''}`} />
              {/* narrow: height × width, then channels and the count on their own lines, so neighbours don't touch */}
              <text x={bx.x + bx.ghost / 2} y={base + 16} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m dltt-t--b">{narrow ? `${bx.out[0]}×${bx.out[1]}` : `${bx.out[0]}×${bx.out[1]}×${bx.out[2]}`}</text>
              {narrow && <text x={bx.x + bx.ghost / 2} y={base + 29} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m dltt-axt--c">×{bx.out[2]}</text>}
              {bx.r && <text x={bx.x + bx.ghost / 2} y={base + (narrow ? 43 : 32)} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--w">{bx.r.total.toLocaleString('en-US')}{narrow ? '' : ' params'}</text>}
            </g>
          ))}
        </svg>
      </div>
    </Stage>
  );
}
