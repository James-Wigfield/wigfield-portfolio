import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { layerCounts, countModel } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 5 · Normalization vs BatchNormalization. One column per feature:
   Normalization keeps a mean and a variance per feature plus one count, all
   non-trainable (greyed, dashed); BatchNormalization keeps γ and β
   (trainable, in the parameter colour) and a moving mean and variance
   (non-trainable). Under it, L2 slide 27's three BN layers add up to the
   summary's 2,368 non-trainable. Controls: the layer, the feature count. */

const fmt = (v) => v.toLocaleString('en-US');
const BN_MODEL = countModel(MODELS['l2-bn'].model);

export function NormLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [kind, setKind] = useState('bn');
  const [nRaw, setN] = useState(8);
  const n = printing ? 8 : Math.min(nRaw, narrow ? 8 : 12);
  const k = printing ? 'bn' : kind;
  const c = layerCounts({ t: k }, [[n]]);
  const W = narrow ? 360 : 760;
  const cw = Math.min(narrow ? 30 : 56, (W - 160) / n);
  const x0 = 40;
  const box = Math.min(cw - 6, 26);
  const rows = k === 'bn' ? [['γ', true], ['β', true], ['μ', false], ['σ²', false]] : [['mean', false], ['var', false]];
  const H = 44 + rows.length * (box + 6) + (narrow ? 40 : 10);
  const bnRows = BN_MODEL.rows.filter((r) => r.L.t === 'bn');
  return (
    <Stage
      title="Four numbers per feature for BN, two (plus one) for Normalization"
      prov="{s|L1 · slide 45} {s|L2 · slide 27}"
      tryThis="Set 8 features and switch layers: which numbers are coloured (trainable) and which are grey?"
      caption="Coloured boxes are learned by gradient descent; grey dashed boxes are stored statistics, counted as non-trainable. Normalization adds one more grey number: the count."
      challenge={{ text: 'Find Wide & Deep’s 17 non-trainable numbers.', done: k === 'norm' && n === 8 }}
      maths={
        <>
          <MLine text={k === 'bn' ? `BatchNormalization on ${n} features: $4 \\times ${n} = ${4 * n}$: $${2 * n}$ trainable ($\\gamma$, $\\beta$) + $${2 * n}$ non-trainable.` : `Normalization on ${n} features: $2 \\times ${n} + 1 = ${2 * n + 1}$, all non-trainable.`} />
          <MLine text={`L2 slide 27: BN on ${bnRows.map((r) => r.ins[0][0]).join(', ')} features gives ${bnRows.map((r) => fmt(r.total)).join(' + ')}; non-trainable $2 \\times (${bnRows.map((r) => r.ins[0][0]).join(' + ')}) = ${fmt(BN_MODEL.nonTrainable)}$ {s|L2 · slide 27}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Which layer" value={k} onChange={setKind} options={[{ value: 'norm', label: 'Normalization' }, { value: 'bn', label: 'BatchNormalization' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${k === 'bn' ? 'BatchNormalization' : 'Normalization'} on ${n} features: ${c.trainable} trainable, ${c.nonTrainable} non-trainable`}>
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <text x={x0 + i * cw + box / 2} y={24} textAnchor="middle" className="dltt-t dltt-t--xs">f{i + 1}</text>
              {rows.map(([lab, tr], r) => (
                <g key={lab}>
                  <rect x={x0 + i * cw} y={34 + r * (box + 6)} width={box} height={box} rx={4} className={tr ? 'dltt-pbox' : 'dltt-pbox dltt-pbox--nt'} />
                  {(cw > 30 || i === 0) && <text x={x0 + i * cw + box / 2} y={34 + r * (box + 6) + box / 2 + 4} textAnchor="middle" className="dltt-t dltt-t--xs" style={{ fontSize: 9 }}>{lab}</text>}
                </g>
              ))}
            </g>
          ))}
          {k === 'norm' && (
            <g>
              <rect x={x0 + n * cw + 8} y={34} width={box} height={box} rx={4} className="dltt-pbox dltt-pbox--nt" />
              <text x={x0 + n * cw + 8 + box / 2} y={34 + box / 2 + 4} textAnchor="middle" className="dltt-t dltt-t--xs" style={{ fontSize: 9 }}>n</text>
              <text x={x0 + n * cw + 8 + box / 2} y={34 + box + 14} textAnchor="middle" className="dltt-t dltt-t--xs">count</text>
            </g>
          )}
          <g transform={`translate(${narrow ? 40 : W - 150} ${narrow ? H - 26 : 60})`}>
            {narrow ? (
              <text x={0} y={0} className="dltt-t dltt-t--m"><tspan className="dltt-t--w dltt-t--b">{c.trainable}</tspan> trainable · <tspan className="dltt-t--nt dltt-t--b">{c.nonTrainable}</tspan> non-trainable</text>
            ) : (
              <>
                <text x={0} y={0} className="dltt-counter dltt-t--w" style={{ fontSize: 30 }}>{c.trainable}</text>
                <text x={0} y={18} className="dltt-t dltt-t--xs">trainable</text>
                <text x={0} y={62} className="dltt-counter" style={{ fontSize: 30, fill: 'var(--dltt-nt)' }}>{c.nonTrainable}</text>
                <text x={0} y={80} className="dltt-t dltt-t--xs">non-trainable</text>
              </>
            )}
          </g>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} 60`} role="group" aria-label="Number of features">
          <text x={20} y={14} className="dltt-t dltt-t--s">features n</text>
          <Scrub x0={30} x1={W - 30} y={38} value={n} min={1} max={narrow ? 8 : 12} step={1} onChange={setN} label="Number of features" ticks={[1, narrow ? 8 : 12]} />
        </svg>
      </div>
    </Stage>
  );
}
