import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import { prod } from '../../../maths/shapeRules.js';
import './shapes.css';

/* Step 3 · read the tuple. Real tuples the slides print; hover or focus each
   number and its axis lights up on the picture, with what it counts in
   plain words. One control: which tuple. */

const TUPLES = {
  s17: { label: 'L3 slide 17', prov: '{s|L3 · slide 17}', code: 'images.shape', shape: [2, 70, 120, 3], kind: 'image', roles: ['batch', 'h', 'w', 'c'], words: ['2 images', '70 rows (height)', '120 columns (width)', '3 colour channels (RGB)'] },
  s18: { label: 'L3 slide 18', prov: '{s|L3 · slide 18}', code: 'fmaps.shape', shape: [2, 64, 114, 32], kind: 'image', roles: ['batch', 'h', 'w', 'c'], words: ['still 2 images', '64 rows (6 fewer)', '114 columns (6 fewer)', '32 feature maps: one per filter'] },
  s36: { label: 'L4 slide 36', prov: '{s|L4 · slide 36}', code: 'x.shape', shape: [32, 56, 5], kind: 'seq', roles: ['batch', 't', 'f'], words: ['32 sequences in the batch', '56 days (time steps)', '5 numbers per day (dimensionality)'] },
  s48: { label: 'L3 slide 48', prov: '{s|L3 · slide 48}', code: 'Y_proba.shape', shape: [2, 1000], kind: 'vec', roles: ['batch', 'f'], words: ['2 images', '1,000 class probabilities each'] },
};
const LIT = { batch: 'batch', h: 'h', w: 'w', c: 'c', t: 't', f: 'f' };
const AXT = { batch: 'batch', h: 'h', w: 'wd', c: 'c', t: 't', f: 'f' };

export function TupleLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [key, setKey] = useState('s17');
  const [lit, setLit] = useState(printing ? null : 0);
  const T = TUPLES[key];
  const one = T.shape.slice(1);
  const W = narrow ? 340 : 720;
  const H = narrow ? 300 : 190;
  const roleLit = lit === null ? null : LIT[T.roles[lit]];
  return (
    <Stage
      title="Read a tuple one number at a time"
      prov={T.prov}
      tryThis="Hover (or tab to) each number in the tuple and say what it counts before reading the line under it."
      caption="Left to right is outside to inside: the first number counts whole examples, the last counts the numbers at the innermost level."
      maths={
        <>
          <MLine text={`\`${T.code}\` → \`(${T.shape.join(', ')})\`: ${T.words.join(' × ')}.`} />
          <MLine text={`That is $${T.shape.join(' \\times ')} = ${prod(T.shape).toLocaleString('en-US')}$ numbers in all {own}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Which tuple" value={key} onChange={(v) => { setKey(v); setLit(0); }} options={Object.entries(TUPLES).map(([value, t]) => ({ value, label: t.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${T.code} = (${T.shape.join(', ')}): ${T.words.join(', ')}`}>
          <TensorGlyph x={narrow ? 40 : 30} y={8} shape={one} kind={T.kind} batch={T.shape[0]} fit={narrow ? [260, 150] : [300, 180]} lit={roleLit} />
          <g transform={`translate(${narrow ? 20 : 380} ${narrow ? 214 : 70})`}>
            <text x={0} y={0} className="dltt-t dltt-t--s dltt-t--m">{T.code}</text>
            <text x={0} y={30} className="dltt-t dltt-t--m" style={{ fontSize: 22 }}>
              (
              {T.shape.map((n, i) => (
                <tspan key={i}>
                  <tspan
                    className={`dltt-tnum dltt-axt--${AXT[T.roles[i]]}${lit === i ? ' dltt-tnum--on' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n}: ${T.words[i]}`}
                    onPointerEnter={() => setLit(i)}
                    onFocus={() => setLit(i)}
                  >
                    {n}
                  </tspan>
                  {i < T.shape.length - 1 ? ', ' : ''}
                </tspan>
              ))}
              )
            </text>
            <text x={0} y={58} className="dltt-t dltt-t--b" style={{ fontSize: 14 }}>{lit === null ? 'hover a number' : T.words[lit]}</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
