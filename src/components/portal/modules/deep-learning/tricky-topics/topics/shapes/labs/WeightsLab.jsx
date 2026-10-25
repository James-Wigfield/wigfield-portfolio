import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Box3, Bead } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import { layerCounts, layerName } from '../../../maths/paramRules.js';
import { layerOut, showTuple, glyphKind } from '../../../maths/shapeRules.js';
import './shapes.css';

/* Step 6 · weight shapes vs data shapes. One layer at a time: the data going
   in, the layer's weights, the data coming out. The data carries a batch
   axis; the weights never do — their shapes come from the sizes in and out,
   and multiplying them out gives the parameter count. One control. */

const LAYERS = {
  dense: { label: 'Dense(300) · L1 s36', prov: '{s|L1 · slide 36}', L: { t: 'dense', units: 300 }, x: [784], batch: 'None' },
  conv: { label: 'Conv2D(32, 7) · L3 s18–19', prov: '{s|L3 · slides 18–19}', L: { t: 'conv2d', filters: 32, k: 7 }, x: [70, 120, 3], batch: 2 },
  rnn: { label: 'SimpleRNN(5) · L4 s10', prov: '{s|L4 · slides 9–10} {own}', L: { t: 'simplernn', units: 5 }, x: [3, 4], batch: 'None', seq: true },
};
const fmt = (v) => v.toLocaleString('en-US');

function WeightPicture({ w, x, y, narrow }) {
  const s = w.shape;
  if (s.length === 4) {
    const k = s[0];
    const side = 6 * k;
    return (
      <g>
        {[2, 1, 0].map((i) => (
          <Box3 key={i} x={x + i * 7} y={y + 10 - i * 5} w={side} h={side} d={10} className="dltt-wbrick" axes={i === 0 ? { w: { role: 'wd', label: s[1] }, h: { role: 'h', label: s[0] }, d: { role: 'c', label: s[2] } } : {}} />
        ))}
        <text x={x + side + 34} y={y + side / 2 + 12} className="dltt-t dltt-t--xs dltt-t--b">× {s[3]}</text>
      </g>
    );
  }
  if (s.length === 2) {
    const sc = narrow ? 2.6 : 3.4;
    const bw = Math.sqrt(s[1]) * sc + 6;
    const bh = Math.sqrt(s[0]) * sc + 6;
    return (
      <g>
        <rect x={x} y={y} width={bw} height={bh} rx={2} className="dltt-wgrid" />
        <text x={x + bw / 2} y={y + bh + 13} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{s[1]}</text>
        <text x={x - 5} y={y + bh / 2 + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">{s[0]}</text>
      </g>
    );
  }
  const n = s[0];
  const show = Math.min(n, 10);
  return (
    <g>
      {Array.from({ length: show }, (_, i) => <Bead key={i} x={x + 5 + i * 9} y={y + 6} r={3.6} />)}
      {n > show && <text x={x + 5 + show * 9} y={y + 10} className="dltt-t dltt-t--xs">…</text>}
    </g>
  );
}

export function WeightsLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [key, setKey] = useState('conv');
  const k = printing ? 'conv' : key;
  const C = LAYERS[k];
  const out = layerOut(C.L, [C.x]);
  const { weights, total } = layerCounts(C.L, [C.x]);
  const W = narrow ? 340 : 780;
  const H = narrow ? 470 : 230;
  const col = narrow ? [[10, 20], [10, 170], [10, 330]] : [[10, 30], [280, 30], [560, 30]];
  return (
    <Stage
      title="Data has a batch axis; weights never do"
      prov={C.prov}
      tryThis="For each layer, say the weight shapes from the sizes in and out before looking at the middle panel."
      caption="Weights are shaped by the layer (sizes in, sizes out, kernel size), so they stay the same for any batch; their sizes multiplied out and added are the parameter count."
      maths={
        <>
          {weights.map((w) => <MLine key={w.name} text={`${w.name}: \`${showTuple(w.shape)}\` → ${w.shape.length ? w.shape.join(' × ') : '1'} = ${fmt(w.n)}`} />)}
          <MLine text={`Parameters: ${weights.map((w) => fmt(w.n)).join(' + ')} = **${fmt(total)}** ${k === 'conv' ? '(this page’s own; slide 19 prints the two shapes)' : k === 'dense' ? '{s|L1 · slide 36}' : '{own}'}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Which layer" value={k} onChange={setKey} options={Object.entries(LAYERS).map(([value, c]) => ({ value, label: c.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layerName(C.L)}: data ${showTuple(C.x)} in, weights ${weights.map((w) => showTuple(w.shape)).join(' and ')}, data ${showTuple(out)} out; ${total} parameters`}>
          <text x={col[0][0]} y={col[0][1] - 12} className="dltt-t dltt-t--xs dltt-t--b">data in · ({C.batch}, {C.x.join(', ')})</text>
          <TensorGlyph x={col[0][0]} y={col[0][1]} shape={C.x} kind={glyphKind(C.x, C.seq)} batch={C.batch} fit={narrow ? [200, 120] : [230, 150]} />
          <text x={col[1][0]} y={col[1][1] - 12} className="dltt-t dltt-t--xs dltt-t--b dltt-t--w">weights · no batch axis</text>
          {weights.map((w, i) => (
            <g key={w.name}>
              <WeightPicture w={w} x={col[1][0] + 24 + (narrow ? 0 : 0)} y={col[1][1] + 10 + i * (C.L.t === 'conv2d' ? 92 : 52)} narrow={narrow} />
              <text x={col[1][0] + (narrow ? 160 : 150)} y={col[1][1] + 24 + i * (C.L.t === 'conv2d' ? 92 : 52)} className="dltt-t dltt-t--xs dltt-t--m">{w.name.replace(/ \(.*\)/, '')} {showTuple(w.shape)}</text>
            </g>
          ))}
          <text x={col[2][0]} y={col[2][1] - 12} className="dltt-t dltt-t--xs dltt-t--b">data out · ({C.batch}, {out.join(', ')})</text>
          <TensorGlyph x={col[2][0]} y={col[2][1]} shape={out} kind={glyphKind(out, C.seq)} batch={C.batch} fit={narrow ? [200, 120] : [210, 150]} />
        </svg>
      </div>
    </Stage>
  );
}
