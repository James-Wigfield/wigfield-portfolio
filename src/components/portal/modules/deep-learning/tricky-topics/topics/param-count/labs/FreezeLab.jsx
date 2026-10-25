import { useRef, useState } from 'react';
import { Stage, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { countModel, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 11 · frozen layers. Slide 36's MLP, one lock per Dense layer
   (layer.trainable = False, L2 slide 31). Locking a layer moves its whole
   count from the trainable bar to the non-trainable bar; the total never
   changes. Three controls: the three locks. */

const BASE = MODELS['l1-mlp'].model;
const fmt = (v) => v.toLocaleString('en-US');

export function FreezeLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [locked, setLocked] = useState([true, true, false]);
  const lk = printing ? [true, true, false] : locked;
  const denseIdx = BASE.layers.map((L, i) => (L.t === 'dense' ? i : -1)).filter((i) => i >= 0);
  const model = { ...BASE, layers: BASE.layers.map((L, i) => (denseIdx.includes(i) && lk[denseIdx.indexOf(i)] ? { ...L, frozen: true } : L)) };
  const C = countModel(model);
  const W = narrow ? 340 : 700;
  const bar = (v) => (v / C.total) * (W - 40);
  const toggle = (j) => setLocked((p) => p.map((v, i) => (i === j ? !v : v)));
  const dense = C.rows.filter((r) => r.L.t === 'dense');
  return (
    <Stage
      title="Freezing moves parameters, it doesn’t delete them"
      prov="{s|L2 · slide 31} {s|L1 · slide 36} {beyond}"
      tryThis="Freeze the two hidden layers (transfer learning keeps the reused layers fixed): what is left to train?"
      caption="Only the unlocked layers are updated during training; the frozen weights are still part of the model (and still part of the total)."
      challenge={{ text: 'Leave exactly 1,010 trainable parameters.', done: C.trainable === 1010 }}
      maths={
        <>
          {dense.map((r, j) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${fmt(r.total)} → ${lk[j] ? 'non-trainable (frozen)' : 'trainable'}`} />)}
          <MLine text={`Trainable ${fmt(C.trainable)} + non-trainable ${fmt(C.nonTrainable)} = ${fmt(C.total)}, the same total as slide 36 {s|L1 · slide 36}.`} />
        </>
      }
    >
      <div ref={wrap} className="dltt-freeze">
        <ul className="dltt-freeze__rows">
          {dense.map((r, j) => (
            <li key={r.i} className={`dltt-freeze__row${lk[j] ? ' dltt-freeze__row--on' : ''}`}>
              <button type="button" className="dltt-lock" aria-pressed={lk[j]} onClick={() => toggle(j)} aria-label={`${lk[j] ? 'Unfreeze' : 'Freeze'} ${layerName(r.L)}`}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <rect x="4" y="9" width="12" height="9" rx="2" />
                  <path d={lk[j] ? 'M6.5 9 V6.5 a3.5 3.5 0 0 1 7 0 V9' : 'M6.5 9 V6.5 a3.5 3.5 0 0 1 7 0'} />
                </svg>
              </button>
              <code>{layerName(r.L)}</code>
              <span className="dltt-freeze__n">{fmt(r.total)}</span>
              <span className="dltt-freeze__state">{lk[j] ? 'frozen' : 'trainable'}</span>
            </li>
          ))}
        </ul>
        <svg className="dltt-svg" viewBox={`0 0 ${W} 96`} role="img" aria-label={`${C.trainable} trainable and ${C.nonTrainable} non-trainable parameters`}>
          <text x={20} y={16} className="dltt-t dltt-t--xs">trainable</text>
          <rect x={20} y={22} width={Math.max(2, bar(C.trainable))} height={16} rx={3} className="dltt-vbar dltt-vbar--w" />
          <text x={24 + bar(C.trainable)} y={35} className="dltt-t dltt-t--xs dltt-t--m">{fmt(C.trainable)}</text>
          <text x={20} y={60} className="dltt-t dltt-t--xs">non-trainable</text>
          <rect x={20} y={66} width={Math.max(2, bar(C.nonTrainable))} height={16} rx={3} className="dltt-vbar dltt-vbar--nt" />
          <text x={Math.min(24 + bar(C.nonTrainable), W - 70)} y={79} className="dltt-t dltt-t--xs dltt-t--m">{fmt(C.nonTrainable)}</text>
        </svg>
      </div>
    </Stage>
  );
}
