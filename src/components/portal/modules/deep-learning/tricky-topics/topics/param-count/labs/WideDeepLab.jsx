import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { countModel, working, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 4 · Wide & Deep: the zero-parameter layers, and why Concatenate
   matters. The graph from L1 slide 45 (or sample Q1(c), the same shape):
   the normalized inputs skip past the hidden layers and are glued to their
   output, so the last Dense sees the two widths added (8 + 30 = 38). Each
   box carries its count (greyed when it has nothing to learn, dashed when
   it's non-trainable). One control: which model. */

const CHOICES = {
  'l1-widedeep': { label: 'L1 slide 45', prov: '{s|L1 · slide 45}' },
  'sample-q1c': { label: 'Sample Q1(c)', prov: '{s|Sample Q1(c)} {own}' },
};
const fmt = (v) => v.toLocaleString('en-US');

export function WideDeepLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 620;
  const [key, setKey] = useState('l1-widedeep');
  const M = MODELS[key];
  const C = countModel(M.model);
  const nIn = M.model.input[0];
  const norm = C.rows[0];
  const concat = C.rows.find((r) => r.L.t === 'concat');
  const out = C.rows[C.rows.length - 1];
  const hidden = C.rows.filter((r) => r.L.t === 'dense' && r !== out);
  const nodes = [
    { id: 'in', label: `Input`, sub: `${nIn} features`, kind: 'in' },
    { id: 'norm', label: 'Normalization', sub: `${norm.nonTrainable} non-trainable`, kind: 'nt' },
    ...hidden.map((r, i) => ({ id: `h${i}`, label: layerName(r.L), sub: `${fmt(r.total)}`, kind: 'w', r })),
    { id: 'cat', label: 'Concatenate', sub: `0 · width ${concat.out[0]}`, kind: 'zero' },
    { id: 'out', label: layerName(out.L), sub: `${fmt(out.total)}`, kind: 'w', r: out },
  ];
  const W = narrow ? 360 : 820;
  const H = narrow ? 120 + nodes.length * 62 : 270;
  const pos = (i) => (narrow ? { x: 150, y: 40 + i * 62 } : { x: 70 + i * ((W - 140) / (nodes.length - 1)), y: 160 });
  const bw = narrow ? 150 : 108;
  const catI = nodes.findIndex((n) => n.id === 'cat');
  const normP = pos(1);
  const catP = pos(catI);
  const lastHidden = hidden[hidden.length - 1];
  const wNorm = nIn;
  const wHid = lastHidden.out[0];
  const stackW = narrow ? 120 : 150;
  return (
    <Stage
      title="Concatenate scores 0, but it widens the next layer"
      prov={CHOICES[key].prov}
      tryThis="Before looking at the last box, say how many inputs it gets. Then switch to sample Q1(c): same shape, new numbers."
      caption={`The normalized inputs skip the hidden layers and are glued to their output: ${wNorm} + ${wHid} = ${concat.out[0]} inputs into \`${layerName(out.L)}\`. Grey boxes have nothing to learn; Normalization’s numbers are non-trainable.`}
      challenge={{ text: 'Find the model whose total trainable count is 313.', done: C.trainable === 313 }}
      maths={
        <>
          {C.rows.map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${working(r.L, r.ins)}`} />)}
          <MLine text={`Trainable: **${fmt(C.trainable)}**; non-trainable: **${fmt(C.nonTrainable)}**; total ${fmt(C.total)}${key === 'l1-widedeep' ? ' {s|L1 · slide 45}' : ' (sample Q1(c) asks for the trainable count only)'}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Which model" value={key} onChange={setKey} options={Object.entries(CHOICES).map(([value, c]) => ({ value, label: c.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nodes.map((n) => `${n.label} (${n.sub})`).join(', ')}`}>
          {nodes.slice(1).map((n, i) => {
            const a = pos(i);
            const b = pos(i + 1);
            // the hidden path; Normalization → first hidden; the last hidden → Concatenate
            return narrow
              ? <line key={`e${i}`} x1={a.x} y1={a.y + 17} x2={b.x} y2={b.y - 17} className="dltt-wire dltt-wire--data" />
              : <line key={`e${i}`} x1={a.x + bw / 2} y1={a.y} x2={b.x - bw / 2} y2={b.y} className="dltt-wire dltt-wire--data" />;
          })}
          {/* the wide path: Normalization straight to Concatenate */}
          {narrow ? (
            <path d={`M${normP.x + bw / 2} ${normP.y} H${normP.x + bw / 2 + 34} V${catP.y} H${catP.x + bw / 2 + 4}`} className="dltt-wd__skip" />
          ) : (
            <path d={`M${normP.x} ${normP.y - 17} V${normP.y - 78} H${catP.x} V${catP.y - 19}`} className="dltt-wd__skip" />
          )}
          {!narrow && <text x={(normP.x + catP.x) / 2} y={normP.y - 84} textAnchor="middle" className="dltt-t dltt-t--xs">the wide path: {wNorm} normalized features</text>}
          {nodes.map((n, i) => {
            const p = pos(i);
            return (
              <g key={n.id} className={`dltt-wd__node dltt-wd__node--${n.kind}`}>
                <rect x={p.x - bw / 2} y={p.y - 17} width={bw} height={34} rx={6} />
                <text x={p.x} y={p.y - 1} textAnchor="middle" className="dltt-t dltt-t--b" style={{ fontSize: 12 }}>{n.label}</text>
                <text x={p.x} y={p.y + 12} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{n.sub}</text>
              </g>
            );
          })}
          {/* the concatenated width, as a stacked bar entering the last layer */}
          <g transform={narrow ? `translate(${(W - stackW) / 2} ${H - 52})` : `translate(${catP.x - stackW / 2} ${catP.y + 44})`}>
            <rect x={0} y={0} width={(stackW * wNorm) / concat.out[0]} height={14} className="dltt-wd__part dltt-wd__part--norm" />
            <rect x={(stackW * wNorm) / concat.out[0]} y={0} width={(stackW * wHid) / concat.out[0]} height={14} className="dltt-wd__part dltt-wd__part--hid" />
            <text x={0} y={30} className="dltt-t dltt-t--xs dltt-t--m">{wNorm} + {wHid} = {concat.out[0]} → {layerName(out.L)}</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
