import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { countModel, layerCounts, working, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 9 · gate copies. A SimpleRNN is one block [W_x | W_h | b]; an LSTM
   stacks four of them (its four fully connected layers, L4 slide 46), a GRU
   three (slide 48) — plus, in Keras's default, a second bias per gate; a
   Bidirectional layer runs two copies side by side. Each model is the
   slide's own (input size and Dense head included), so the slide's printed
   total appears. Controls: the layer; for the GRU, one or two biases. */

const OPTS = {
  rnn: { label: 'SimpleRNN(32)', model: 'l4-rnn32', gates: ['h'], prov: '{s|L4 · slide 27}' },
  lstm: { label: 'LSTM(12)', model: 'l4-lstm', gates: ['f', 'i', 'o', 'g'], prov: '{s|L4 · slide 43} {own}' }, // the slide prints the model total; the split is ours
  gru: { label: 'GRU(20)', model: 'l4-gru', gates: ['z', 'r', 'g'], prov: '{s|L4 · slide 49} {own}' },
  bi: { label: 'Bidirectional', model: 'l8-birnn', gates: ['h'], prov: '{s|L8 · slide 9} {own}' },
};
const fmt = (v) => v.toLocaleString('en-US');

export function GatesLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [kind, setKind] = useState('gru');
  const [twoBias, setTwoBias] = useState(true);
  const k = printing ? 'gru' : kind;
  const opt = OPTS[k];
  const base = MODELS[opt.model].model;
  const model = k === 'gru' && !twoBias ? MODELS['l4-gru-1bias'].model : base;
  const C = countModel(model);
  const rec = C.rows[0];
  const inner = rec.L.t === 'bidir' ? rec.L.layer : rec.L;
  const nIn = rec.ins[0][rec.ins[0].length - 1];
  const u = inner.units;
  const block = layerCounts({ t: 'simplernn', units: u }, [[1, nIn]]).total;
  const extra = k === 'gru' && twoBias;
  const sides = rec.L.t === 'bidir' ? ['forward', 'backward'] : [''];
  const W = narrow ? 360 : 760;
  const rowH = 30;
  const H = 50 + opt.gates.length * (rowH + 8) + (narrow ? 30 : 10);
  const full = narrow ? 240 : 420;
  const scale = full / (nIn * u + u * u + u * (extra ? 2 : 1));
  const colW = sides.length > 1 ? (narrow ? 150 : 300) : full;
  const sc2 = sides.length > 1 ? colW / (nIn * u + u * u + u) : scale;
  const printedNote = k === 'gru' && !twoBias ? 'one bias per gate: this page’s own' : 'printed on the slide';
  return (
    <Stage
      title="LSTM = four blocks, GRU = three, Bidirectional = two copies"
      prov={opt.prov}
      tryThis="Pick a layer and count its blocks before reading the total. For the GRU, flip between one and two biases per gate."
      caption={`Each block is one SimpleRNN-sized set of weights: $\\mathbf{W}_x$ (${nIn} × ${u}), $\\mathbf{W}_h$ (${u} × ${u}) and a bias (${u}). The Dense head is counted separately.`}
      challenge={{ text: 'Find the GRU layer’s count with slide 49’s equations, one bias per gate: 1,320 (1,341 with the Dense head).', done: k === 'gru' && rec.total === 1320 }}
      maths={
        <>
          <MLine text={`One block: $${nIn} \\times ${u} + ${u} \\times ${u} + ${u} = ${block}$.`} />
          {C.rows.map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${working(r.L, r.ins)}`} />)}
          <MLine text={`Total **${fmt(C.total)}** (${printedNote}).`} />
        </>
      }
    >
      <div ref={wrap}>
        <div><Switch label="Which layer" value={k} onChange={setKind} options={Object.entries(OPTS).map(([value, o]) => ({ value, label: o.label }))} /></div>
        {k === 'gru' && (
          <div className="dltt-subswitch">
            <span className="dltt-subswitch__k">GRU biases</span>
            <Switch label="GRU biases" value={twoBias} onChange={setTwoBias} options={[{ value: true, label: 'Keras default: 2 per gate' }, { value: false, label: 'Slide 49’s equations: 1 per gate' }]} />
          </div>
        )}
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layerName(rec.L)}: ${opt.gates.length * sides.length} blocks, ${rec.total} parameters; total with the Dense head ${C.total}`}>
          {sides.map((side, s) => {
            const ox = 40 + s * (colW + 30);
            const sk = sides.length > 1 ? sc2 : scale;
            return (
              <g key={side || 'one'}>
                {side && <text x={ox} y={22} className="dltt-t dltt-t--xs dltt-t--b">{side}</text>}
                {opt.gates.map((g, i) => {
                  const y = 34 + i * (rowH + 8);
                  const a = nIn * u * sk;
                  const b2 = u * u * sk;
                  const c = u * sk;
                  return (
                    <g key={g}>
                      <text x={ox - 8} y={y + rowH / 2 + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m">{g}</text>
                      <rect x={ox} y={y} width={Math.max(2, a)} height={rowH} className="dltt-blk dltt-blk--x" />
                      <rect x={ox + a} y={y} width={b2} height={rowH} className="dltt-blk dltt-blk--h" />
                      <rect x={ox + a + b2} y={y} width={Math.max(2, c)} height={rowH} className="dltt-blk dltt-blk--b" />
                      {extra && <rect x={ox + a + b2 + c + 2} y={y} width={Math.max(2, c)} height={rowH} className="dltt-blk dltt-blk--b2" />}
                      {i === 0 && s === 0 && !narrow && (
                        <>
                          <text x={ox + a / 2} y={y - 4} textAnchor="middle" className="dltt-t dltt-t--xs">W<tspan dy={2} fontSize={7}>x</tspan></text>
                          <text x={ox + a + b2 / 2} y={y - 4} textAnchor="middle" className="dltt-t dltt-t--xs">W<tspan dy={2} fontSize={7}>h</tspan></text>
                          <text x={ox + a + b2 + c / 2} y={y - 4} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--bias">b</text>
                          {extra && <text x={ox + a + b2 + c + 2 + c / 2} y={y - 4} textAnchor="start" className="dltt-t dltt-t--xs dltt-t--bias">+ b (Keras)</text>}
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <g transform={`translate(${narrow ? W / 2 : W - 100} ${narrow ? H - 14 : 70})`}>
            {narrow ? (
              <text x={0} y={0} textAnchor="middle" className="dltt-t dltt-t--m"><tspan className="dltt-t--b">{fmt(rec.total)}</tspan> + head {fmt(C.total - rec.total)} = <tspan className="dltt-t--b">{fmt(C.total)}</tspan></text>
            ) : (
              <>
                <Counter x={0} y={0} value={C.total} size={40} label={`${C.total} parameters`} />
                <text x={0} y={20} textAnchor="middle" className="dltt-t dltt-t--s">with the Dense head</text>
                <text x={0} y={40} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{fmt(rec.total)} + {fmt(C.total - rec.total)}</text>
              </>
            )}
          </g>
        </svg>
      </div>
    </Stage>
  );
}
