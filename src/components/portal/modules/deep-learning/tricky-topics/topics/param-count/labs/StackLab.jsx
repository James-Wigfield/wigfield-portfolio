import { useRef, useState } from 'react';
import { Stage, StoryBar, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStory } from '../../../story';
import { countModel, working, layerName } from '../../../maths/paramRules';
import { MODELS } from '../../../maths/models';
import './param.css';

/* Step 2 · stack the counts: L1 slide 36's 266,610 built layer by layer.
   Top: the layers as boxes whose height is the number of neurons (784 →
   300 → 100 → 10). Bottom: one bar for the whole model, each layer's
   parameters a segment, so you can see where they live. Story beats add
   one layer at a time; hover a segment for its working. */

const M = MODELS['l1-mlp'];
const C = countModel(M.model);
const fmt = (v) => v.toLocaleString('en-US');

export function StackLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const [hot, setHot] = useState(null);
  const beats = [
    ...C.rows.map((r, i) => ({
      label: layerName(r.L),
      say: i === 0
        ? `\`Flatten\` turns 28 × 28 into ${fmt(r.out[0])} numbers. Nothing to learn: **0**.`
        : `${fmt(r.ins[0][0])} inputs to ${r.L.units} neurons: ${working(r.L, r.ins)}.${i === 1 ? ' Most of the model, in one layer.' : ''}`,
    })),
    { label: 'Total', say: `Add them: ${C.rows.map((r) => fmt(r.total)).join(' + ')} = **${fmt(C.total)}**, slide 36’s total.` },
  ];
  const story = useStory(beats.length, { start: -1 }); // opens empty: predict, then play
  const shown = story.beat < 0 ? 0 : Math.min(story.beat + 1, 4);
  const W = narrow ? 360 : 760;
  const H = narrow ? 330 : 280;
  const sizes = [784, 300, 100, 10];
  const labels = ['784', '300', '100', '10'];
  const maxH = narrow ? 120 : 130;
  const colX = (i) => (narrow ? 40 + i * 92 : 90 + i * 150);
  const hOf = (n) => Math.max(6, (n / 784) * maxH);
  const barX0 = narrow ? 20 : 60;
  const barW = W - barX0 * 2;
  const barY = narrow ? 238 : 214;
  const starts = C.rows.reduce((a, r) => [...a, a[a.length - 1] + r.total], [0]);
  const segs = C.rows.map((r, i) => ({ r, i, x: barX0 + (starts[i] / C.total) * barW, w: (r.total / C.total) * barW }));
  const running = C.rows.slice(0, shown).reduce((s, r) => s + r.total, 0);
  const maxCount = Math.max(...C.rows.map((r) => r.total));
  return (
    <Stage
      title="Where slide 36’s 266,610 parameters live"
      prov="{s|L1 · slide 36}"
      tryThis="Before each beat, say that layer’s count out loud; then play it, or hover (or tab to) the bar."
      story={<StoryBar story={story} beats={beats} />}
      caption="Each layer’s inputs are the previous layer’s outputs. The bands between the columns are as thick as each layer’s count: 784 inputs fanning out to 300 neurons make the first Dense layer most of the model."
      maths={
        <>
          {C.rows.map((r) => <MLine key={r.i} text={`\`${layerName(r.L)}\`: ${working(r.L, r.ins)}`} />)}
          <MLine text={`Total: ${C.rows.map((r) => fmt(r.total)).join(' + ')} = **${fmt(C.total)}** {s|L1 · slide 36}`} />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Layers of 784, 300, 100 and 10 neurons; ${fmt(running)} parameters counted so far`}>
          {sizes.map((n, i) => {
            const h = hOf(n);
            const on = i === 0 || i <= shown - 1;
            return (
              <g key={i} className={`dltt-fade${on ? '' : ' dltt-dim'}`}>
                {i > 0 && (() => {
                  // the band between two columns: as thick as that layer's count (the biggest fills the column height)
                  const bh = Math.max(2, (C.rows[i].total / maxCount) * maxH);
                  return <rect x={colX(i - 1) + 14} y={20 + (maxH - bh) / 2} width={colX(i) - colX(i - 1) - 28} height={bh} rx={2} className={`dltt-band${i <= shown - 1 ? ' dltt-band--w' : ''}`} />;
                })()}
                <rect x={colX(i) - 12} y={20 + (maxH - h) / 2} width={24} height={h} rx={5} className={i === 0 ? 'dltt-box3__front' : 'dltt-stack__col'} />
                <text x={colX(i)} y={maxH + 40} textAnchor="middle" className="dltt-t dltt-t--b dltt-t--m">{labels[i]}</text>
                <text x={colX(i)} y={maxH + 54} textAnchor="middle" className="dltt-t dltt-t--xs">{i === 0 ? 'after Flatten' : 'neurons'}</text>
              </g>
            );
          })}
          <rect x={barX0} y={barY} width={barW} height={22} rx={4} className="dltt-stack__track" />
          {segs.map(({ r, i, x, w }) => (
            <rect
              key={i}
              x={x}
              y={barY}
              width={Math.max(i < shown && r.total ? 2.5 : 0, w)}
              height={22}
              className={`dltt-stack__seg dltt-stack__seg--${i % 2}${i < shown ? '' : ' dltt-hide'}${hot === i ? ' dltt-stack__seg--hot' : ''}`}
              tabIndex={i < shown && r.total ? 0 : -1}
              role="img"
              aria-label={`${layerName(r.L)}: ${fmt(r.total)} parameters`}
              onPointerEnter={() => setHot(i)}
              onPointerLeave={() => setHot(null)}
              onFocus={() => setHot(i)}
              onBlur={() => setHot(null)}
            />
          ))}
          <text x={barX0} y={barY - 8} className="dltt-t dltt-t--xs">the whole model, one bar</text>
          <text x={W - barX0} y={barY - 8} textAnchor="end" className="dltt-t dltt-t--b dltt-t--m">{fmt(running)}</text>
          {hot !== null && (
            <text x={W / 2} y={barY + 44} textAnchor="middle" className="dltt-t dltt-t--m">
              {layerName(C.rows[hot].L)}: {working(C.rows[hot].L, C.rows[hot].ins)}
            </text>
          )}
          {hot === null && shown >= 2 && (
            <text x={barX0 + (C.rows[1].total / C.total) * barW / 2} y={barY + 15} textAnchor="middle" className="dltt-t dltt-t--xs dltt-stack__in">{fmt(C.rows[1].total)}</text>
          )}
        </svg>
      </div>
    </Stage>
  );
}
