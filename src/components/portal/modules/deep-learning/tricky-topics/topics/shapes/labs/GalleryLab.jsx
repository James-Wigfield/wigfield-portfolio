import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import './shapes.css';

/* Step 4 · the shape gallery: the unit's four data layouts drawn with the
   same box picture and the page's fixed axis colours. Tabular rows, images,
   sequences, and attention's matrices (toy sizes, this page's own). One
   control: which kind of data. */

const KINDS = {
  tab: {
    label: 'Tabular',
    prov: '{s|L1 · slide 45}',
    tuple: '[batch, features]',
    parts: [['batch', 'batch'], ['features', 'f']],
    eg: '(None, 8): California housing’s 8 features',
    words: 'Each example is one row of numbers.',
  },
  img: {
    label: 'Images',
    prov: '{s|L3 · slides 16–17}',
    tuple: '[batch, height, width, channels]',
    parts: [['batch', 'batch'], ['height', 'h'], ['width', 'wd'], ['channels', 'c']],
    eg: '(2, 70, 120, 3)',
    words: 'Each example is a box: rows, columns, colour channels.',
  },
  seq: {
    label: 'Sequences',
    prov: '{s|L4 · slides 24, 36}',
    tuple: '[batch size, time steps, dimensionality]',
    parts: [['batch size', 'batch'], ['time steps', 't'], ['dim.', 'f']],
    eg: '(32, 56, 5): 56 days of 5 numbers',
    words: 'Each example is a slab: time along one axis, the numbers per step along the other.',
  },
  att: {
    label: 'Attention',
    prov: '{s|L8 · slides 37–38} {own}',
    tuple: 'Q [n_queries, d_keys], K [n_keys, d_keys]',
    parts: [['scores: n_queries', null], ['n_keys', null]],
    eg: 'toy sizes: 3 queries, 4 keys, d_keys = 6',
    words: 'Every query meets every key: the scores are [n_queries, n_keys], one row per query.',
  },
};

export function GalleryLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [kRaw, setK] = useState('seq');
  const k = printing ? 'seq' : kRaw;
  const K = KINDS[k];
  const W = narrow ? 340 : 720;
  const H = narrow ? 260 : 200;
  return (
    <Stage
      title="Four kinds of data, one picture language"
      prov={K.prov}
      tryThis="Flip through the four kinds. Which axis is always first? Which colour is the time axis?"
      caption={k === 'att' ? `${K.words} Toy sizes for one example, so no batch is drawn; Kᵀ is K turned on its side.` : `${K.words} The batch is always the first axis (the ghost copies), the same colour in every layout.`}
      maths={
        <>
          <MLine text={`Layout: ${K.tuple}. Example: ${K.eg}.`} />
          {k === 'att' && <MLine text="$\mathbf{Q}\mathbf{K}^\top$: $[n_{\text{queries}}, d_{\text{keys}}] \times [d_{\text{keys}}, n_{\text{keys}}] = [n_{\text{queries}}, n_{\text{keys}}]$ {s|L8 · slide 38}." />}
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Kind of data" value={k} onChange={setK} options={Object.entries(KINDS).map(([value, x]) => ({ value, label: x.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${K.label}: ${K.tuple}, for example ${K.eg}`}>
          {k === 'tab' && <TensorGlyph x={narrow ? 40 : 60} y={40} shape={[8]} kind="vec" batch="None" fit={[260, 80]} />}
          {k === 'img' && <TensorGlyph x={narrow ? 40 : 60} y={6} shape={[70, 120, 3]} kind="image" batch={2} fit={narrow ? [250, 150] : [300, 170]} />}
          {k === 'seq' && <TensorGlyph x={narrow ? 30 : 40} y={20} shape={[56, 5]} kind="seq" batch={32} fit={narrow ? [280, 130] : [330, 160]} />}
          {k === 'att' && (
            <g>
              <TensorGlyph x={narrow ? 0 : 30} y={20} shape={[3, 6]} kind="grid" fit={[120, 110]} />
              <text x={narrow ? 60 : 90} y={14} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">Q</text>
              <TensorGlyph x={narrow ? 110 : 190} y={20} shape={[6, 4]} kind="grid" fit={[120, 110]} />
              <text x={narrow ? 170 : 250} y={14} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">Kᵀ</text>
              <TensorGlyph x={narrow ? 220 : 360} y={20} shape={[3, 4]} kind="grid" fit={[120, 110]} />
              <text x={narrow ? 275 : 415} y={14} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">scores QKᵀ</text>
            </g>
          )}
          <g transform={`translate(${narrow ? 20 : 400} ${narrow ? H - 60 : 70})`}>
            {!(k === 'att' && !narrow) && (
              <>
                <text x={0} y={0} className="dltt-t dltt-t--m" style={{ fontSize: 14 }}>
                  [{K.parts.map(([w, role], i) => <tspan key={w}>{i > 0 && ', '}<tspan className={role ? `dltt-axt--${role} dltt-t--b` : 'dltt-t--b'}>{w}</tspan></tspan>)}]
                </text>
                <text x={0} y={22} className="dltt-t dltt-t--s">{K.eg}</text>
              </>
            )}
          </g>
          {k === 'att' && !narrow && (
            <g transform={`translate(30 ${H - 30})`}>
              <text x={0} y={0} className="dltt-t dltt-t--m" style={{ fontSize: 14 }}>Q [n_queries, d_keys] × Kᵀ [d_keys, n_keys] → scores [n_queries, n_keys]</text>
            </g>
          )}
        </svg>
      </div>
    </Stage>
  );
}
