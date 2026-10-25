import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { countModel, working, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 10 · tied weights. L5's stacked autoencoder (784 → 100 → 30 → 100 →
   784) with each weight matrix drawn as a block whose area is its size.
   Tie the weights and the decoder's two blocks fade to dashed "borrowed"
   outlines — W₂ᵀ and W₁ᵀ, L5 slide 19 — leaving only their bias rows:
   163,814 → 82,414 (slides 12 and 21). One control. */

const fmt = (v) => v.toLocaleString('en-US');
const UNTIED = countModel(MODELS['l5-stacked'].model);
const TIED = countModel(MODELS['l5-tied'].model);
const SIZES = [784, 100, 30, 100, 784];
const NAMES = ['W₁', 'W₂', 'W₃', 'W₄'];
const BORROW = [null, null, 'W₂ᵀ', 'W₁ᵀ'];

export function TiedLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [tiedRaw, setTied] = useState(true);
  const tied = printing ? true : tiedRaw;
  const C = tied ? TIED : UNTIED;
  const W = narrow ? 360 : 780;
  const H = narrow ? 250 : 260;
  const colX = (i) => (narrow ? 22 : 50) + i * ((W - (narrow ? 44 : 250)) / 4);
  const midY = 120;
  const colH = (n) => 18 + Math.sqrt(n) * (narrow ? 4.2 : 5.4);
  const blockSide = (n) => Math.sqrt(n) * (narrow ? 0.16 : 0.2);
  return (
    <Stage
      title="Tie the weights and the decoder keeps only its biases"
      prov="{s|L5 · slides 12, 19, 21}"
      tryThis="Before switching: how many parameters will the tied decoder add? Then tie the weights."
      caption="A tied decoder layer multiplies by the transpose of its encoder twin’s kernel, so it learns nothing new but its own biases (100 and 784 of them)."
      maths={
        <>
          {C.rows.filter((r) => r.total > 0).map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${working(r.L, r.ins)}`} />)}
          <MLine text={`Total **${fmt(C.total)}** {s|L5 · slide ${tied ? 21 : 12}}. Tied: $\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$ {s|L5 · slide 19}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Weights" value={tied} onChange={setTied} options={[{ value: false, label: 'Stacked (untied)' }, { value: true, label: 'Tied' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tied ? 'Tied' : 'Untied'} autoencoder 784, 100, 30, 100, 784: ${C.total} parameters`}>
          {SIZES.map((n, i) => (
            <g key={i}>
              <rect x={colX(i) - 7} y={midY - colH(n) / 2} width={14} height={colH(n)} rx={5} className={i === 2 ? 'dltt-ae__col dltt-ae__col--code' : 'dltt-ae__col'} />
              <text x={colX(i)} y={midY + colH(784) / 2 + 18} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{n}</text>
            </g>
          ))}
          {SIZES.slice(1).map((n, i) => {
            const count = SIZES[i] * n;
            const s = blockSide(count);
            const x = (colX(i) + colX(i + 1)) / 2;
            const borrowed = tied && i >= 2;
            return (
              <g key={`w${i}`}>
                <rect x={x - s / 2} y={midY - s / 2} width={s} height={s} rx={3} className={`dltt-ae__w${borrowed ? ' dltt-ae__w--borrowed' : ''}`} />
                <text x={x} y={midY - s / 2 - 6} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--b${borrowed ? '' : ' dltt-t--w'}`}>{borrowed ? BORROW[i] : NAMES[i]}</text>
                <text x={x} y={midY + s / 2 + 13} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{borrowed ? 'borrowed' : `${SIZES[i]}×${n}`}</text>
                <rect x={x - 12} y={midY + s / 2 + 20} width={24} height={5} rx={2} className="dltt-ae__b" />
              </g>
            );
          })}
          {tied && (
            <>
              <path d={`M${(colX(2) + colX(3)) / 2} ${midY - 32} C ${(colX(2) + colX(3)) / 2} ${midY - 80}, ${(colX(1) + colX(2)) / 2} ${midY - 80}, ${(colX(1) + colX(2)) / 2} ${midY - 22}`} className="dltt-tie" />
              <path d={`M${(colX(3) + colX(4)) / 2} ${midY - 40} C ${(colX(3) + colX(4)) / 2} ${midY - 110}, ${(colX(0) + colX(1)) / 2} ${midY - 110}, ${(colX(0) + colX(1)) / 2} ${midY - 40}`} className="dltt-tie" />
            </>
          )}
          <text x={(colX(0) + colX(2)) / 2} y={H - 8} textAnchor="middle" className="dltt-t dltt-t--xs">encoder</text>
          <text x={(colX(2) + colX(4)) / 2} y={H - 8} textAnchor="middle" className="dltt-t dltt-t--xs">decoder</text>
          <g transform={`translate(${narrow ? W - 60 : W - 80} ${narrow ? 30 : 110})`}>
            <Counter x={0} y={0} value={C.total} size={narrow ? 22 : 34} label={`${C.total} parameters`} />
            <text x={0} y={18} textAnchor="middle" className="dltt-t dltt-t--xs">trainable</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
