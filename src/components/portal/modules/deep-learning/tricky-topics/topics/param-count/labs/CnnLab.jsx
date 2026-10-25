import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Box3 } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { countModel, working, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 7 · a whole CNN: L3 slide 35's Fashion MNIST model. Top: the shape
   ribbon — each layer's output as a box (height × width, depth = channels,
   drawn on a gentle scale), so the image shrinks 28 → 14 → 7 → 3 while it
   gets deeper. Bottom: one bar for the whole model, a segment per layer
   with parameters. Switch Flatten ↔ GlobalAvgPool2D and watch the first
   Dense layer's segment collapse. One control. */

const BASE = MODELS['l3-cnn'].model;
const GAP = { ...BASE, layers: BASE.layers.map((L) => (L.t === 'flatten' ? { t: 'gap2d' } : L)) };
const fmt = (v) => v.toLocaleString('en-US');

export function CnnLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 620;
  const { printing } = useStudy();
  const [mode, setMode] = useState('flatten');
  const [hot, setHot] = useState(null);
  const m = printing ? 'flatten' : mode;
  const C = countModel(m === 'flatten' ? BASE : GAP);
  const spatial = C.rows.filter((r) => r.out.length === 3);
  const vec = C.rows.find((r) => r.L.t === 'flatten' || r.L.t === 'gap2d');
  const W = narrow ? 360 : 820;
  const H = narrow ? 330 : 270;
  const stepX = (W - (narrow ? 90 : 170)) / 9;
  const side = (n) => 6 + n * (narrow ? 1.2 : 2.3);
  const dep = (c) => 4 + Math.sqrt(c) * (narrow ? 1.1 : 1.8);
  const baseY = narrow ? 120 : 140;
  const params = C.rows.filter((r) => r.total > 0);
  const starts = params.reduce((a, r) => [...a, a[a.length - 1] + r.total], [0]);
  const barX = narrow ? 14 : 40;
  const barW = W - barX * 2;
  const barY = narrow ? 230 : 196;
  const dense1 = C.rows.find((r) => r.L.t === 'dense');
  return (
    <Stage
      title="Where a CNN’s parameters live, and what Flatten costs"
      prov="{s|L3 · slide 35} {own}"
      tryThis="Guess which single layer holds the most parameters. Then switch Flatten to GlobalAvgPool2D."
      caption={`The image shrinks while it deepens; \`${layerName(vec.L)}\` hands ${fmt(vec.out[0])} numbers to the first Dense layer, which then holds ${fmt(dense1.total)} parameters.`}
      challenge={{ text: 'Find the version whose total is under 1.2 million.', done: C.total < 1200000 }}
      maths={
        <>
          {C.rows.filter((r) => r.total > 0 || r.L.t === 'flatten' || r.L.t === 'gap2d').map((r) => (
            <MLine key={r.i} text={`\`${layerName(r.L)}\` → (${r.out.join(', ')}): ${working(r.L, r.ins)}`} />
          ))}
          <MLine text={`Total: **${fmt(C.total)}** ${m === 'flatten' ? '(slide 35’s model; the slide prints no total)' : '(the same model with GlobalAvgPool2D: this page’s own variant)'} {own}`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Before the Dense layers" value={m} onChange={setMode} options={[{ value: 'flatten', label: 'Flatten (slide 35)' }, { value: 'gap', label: 'GlobalAvgPool2D' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Shapes ${spatial.map((r) => r.out.join(' by ')).join(', ')}; ${layerName(vec.L)} gives ${vec.out[0]}; total ${C.total} parameters`}>
          <text x={8} y={18} className="dltt-t dltt-t--xs">each layer’s output (height × width × channels)</text>
          {[{ out: BASE.input, L: { t: 'input' } }, ...spatial].map((r, i, all) => {
            const s = side(r.out[0]);
            const x = 14 + i * stepX;
            // narrow: label only where the size changes (the input and each pool)
            const label = !narrow || i === 0 || r.out[0] !== all[i - 1].out[0];
            return (
              <g key={i}>
                <Box3 x={x} y={baseY - s} w={s} h={s} d={dep(r.out[2])} axes={{ d: { role: 'c' } }} />
                {label && <text x={x + s / 2} y={baseY + 16} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{r.out[0]}×{r.out[1]}</text>}
                {label && <text x={x + s / 2} y={baseY + 28} textAnchor="middle" className="dltt-t dltt-t--xs dltt-axt--c">×{r.out[2]}</text>}
              </g>
            );
          })}
          {/* the vector that reaches the Dense layers */}
          <g transform={`translate(${W - (narrow ? 84 : 150)} ${baseY - 70})`}>
            <rect x={0} y={0} width={10} height={Math.max(8, Math.sqrt(vec.out[0]) * (narrow ? 1.2 : 1.45))} rx={3} className="dltt-pbox" />
            <text x={14} y={20} className="dltt-t dltt-t--xs dltt-t--b">{layerName(vec.L).replace('()', '')}</text>
            <text x={14} y={34} className="dltt-t dltt-t--xs dltt-t--m">{fmt(vec.out[0])} numbers</text>
          </g>
          {/* where the parameters live */}
          <text x={barX} y={barY - 10} className="dltt-t dltt-t--xs">the parameters, one segment per layer</text>
          <text x={W - barX} y={barY - 10} textAnchor="end" className="dltt-t dltt-t--b dltt-t--m">{fmt(C.total)}</text>
          {params.map((r, i) => {
            const x = barX + (starts[i] / C.total) * barW;
            const w = (r.total / C.total) * barW;
            return (
              <rect
                key={r.i}
                x={x}
                y={barY}
                width={Math.max(1.5, w)}
                height={24}
                className={`dltt-stack__seg dltt-stack__seg--${r.L.t === 'dense' ? 'd' : i % 2}${hot === r.i ? ' dltt-stack__seg--hot' : ''}`}
                onPointerEnter={() => setHot(r.i)}
                onPointerLeave={() => setHot(null)}
              />
            );
          })}
          <text x={W / 2} y={barY + 46} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--s">
            {hot !== null ? `${layerName(C.rows[hot].L)}: ${working(C.rows[hot].L, C.rows[hot].ins)}` : `first Dense: ${working(dense1.L, dense1.ins)}`}
          </text>
          <text x={barX} y={barY + 66} className="dltt-t dltt-t--xs"><tspan className="dltt-legend dltt-legend--c">■</tspan> conv layers  <tspan className="dltt-legend dltt-legend--d">■</tspan> dense layers</text>
        </svg>
      </div>
    </Stage>
  );
}
