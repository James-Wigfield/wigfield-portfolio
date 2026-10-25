import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { rove } from '../../../rove';
import { windows } from '../../../maths/strideRules.js';
import './stride.css';

/* Step 3 · stride in 2D: Figure 14-4. A 5 × 7 input (with its ring of
   zeros when "same"), a 3 × 3 receptive field, vertical and horizontal
   strides. The output grid sits beside it; hover an output cell to see the
   window it reads. Opens on the figure: stride 2 both ways → 3 × 4.
   Controls: s_h, s_w, padding. */

const H_IN = 5;
const W_IN = 7;
const F = 3;

export function Grid2dLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [sh, setSh] = useState(2);
  const [sw, setSw] = useState(2);
  const [padRaw, setPad] = useState('same');
  const [hot, setHot] = useState({ r: 0, c: 0 });
  const s1 = printing ? 2 : sh;
  const s2 = printing ? 2 : sw;
  const pad = printing ? 'same' : padRaw;
  const rows = windows(H_IN, F, s1, pad);
  const cols = windows(W_IN, F, s2, pad);
  const cell = narrow ? 20 : 26;
  const totR = H_IN + rows.padLeft + rows.padRight;
  const totC = W_IN + cols.padLeft + cols.padRight;
  const gx = 30;
  const gy = 30;
  const ox = narrow ? 30 : gx + totC * cell + 70;
  const oy = narrow ? gy + totR * cell + 60 : gy + cell;
  const W = narrow ? 340 : 720;
  const H = narrow ? oy + rows.out * cell + 40 : gy + totR * cell + 50;
  // print: the second window down and across, so both jumps show
  const r = Math.min(printing ? 1 : hot.r, rows.out - 1);
  const c = Math.min(printing ? 1 : hot.c, cols.out - 1);
  const fr = rows.wins[r];
  const fc = cols.wins[c];
  const inWin = (i, j) => fr && fc && i >= fr.from && i <= fr.to && j >= fc.from && j <= fc.to;
  return (
    <Stage
      title="In 2D the window jumps down and across"
      prov={s1 === 2 && s2 === 2 && pad === 'same' ? '{s|L3 · slide 9}' : '{s|L3 · slide 9} {own}'}
      tryThis="Hover (or tab to) the output cells one by one: watch the 3 × 3 window jump. Then change one stride only."
      caption={`Rows: ${H_IN} → ${rows.out} with stride ${s1}; columns: ${W_IN} → ${cols.out} with stride ${s2}. Each direction shrinks on its own.`}
      maths={
        <>
          <MLine text={`Output row $i$, column $j$ reads rows $i\\,s_h$ to $i\\,s_h + f_h - 1$ and columns $j\\,s_w$ to $j\\,s_w + f_w - 1$ of the ${pad === 'same' ? 'padded ' : ''}input {s|L3 · slide 9}.`} />
          <MLine text={pad === 'same'
            ? `"same": $\\lceil ${H_IN} / ${s1} \\rceil \\times \\lceil ${W_IN} / ${s2} \\rceil = ${rows.out} \\times ${cols.out}$ {beyond}. Slide 9’s figure: 3 × 4 with stride 2 both ways and one zero all round {s|L3 · slide 9}.`
            : `"valid": $(\\lfloor (${H_IN} - 3) / ${s1} \\rfloor + 1) \\times (\\lfloor (${W_IN} - 3) / ${s2} \\rfloor + 1) = ${rows.out} \\times ${cols.out}$ {beyond}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Padding" value={pad} onChange={setPad} options={[{ value: 'same', label: '"same" (Figure 14-4)' }, { value: 'valid', label: '"valid"' }]} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`A ${H_IN} by ${W_IN} input, 3 by 3 window, strides ${s1} and ${s2}: a ${rows.out} by ${cols.out} output`}>
          <defs>
            <pattern id="g2d-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" className="dltt-pad-line" /></pattern>
          </defs>
          <text x={gx} y={gy - 10} className="dltt-t dltt-t--xs">input {H_IN} × {W_IN}{pad === 'same' ? ' + zeros' : ''}</text>
          {Array.from({ length: totR }, (_, ti) => Array.from({ length: totC }, (_, tj) => {
            const i = ti - rows.padLeft;
            const j = tj - cols.padLeft;
            const padCell = i < 0 || i >= H_IN || j < 0 || j >= W_IN;
            const lit = inWin(i, j);
            return (
              <rect
                key={`${ti}-${tj}`}
                x={gx + tj * cell + 1}
                y={gy + ti * cell + 1}
                width={cell - 2}
                height={cell - 2}
                rx={3}
                className={padCell ? `dltt-pad${lit ? ' dltt-pad--hit' : ''}` : `dltt-incell${lit ? ' dltt-incell--hit' : ''}`}
                style={padCell && !lit ? { fill: 'url(#g2d-hatch)' } : undefined}
              />
            );
          }))}
          {fr && fc && (
            <rect x={gx + (fc.from + cols.padLeft) * cell} y={gy + (fr.from + rows.padLeft) * cell} width={F * cell} height={F * cell} rx={4} className="dltt-win" />
          )}
          {/* the jump that brought the window here: across from the previous column, down from the previous row */}
          {fr && fc && c > 0 && (() => {
            const px = gx + (cols.wins[c - 1].from + cols.padLeft) * cell + cell / 2;
            const cx = gx + (fc.from + cols.padLeft) * cell + cell / 2;
            const y0 = gy + (fr.from + rows.padLeft) * cell - 2;
            return <path d={`M${px} ${y0} Q ${(px + cx) / 2} ${y0 - 14} ${cx} ${y0}`} className="dltt-hop" />;
          })()}
          {fr && fc && r > 0 && (() => {
            const py = gy + (rows.wins[r - 1].from + rows.padLeft) * cell + cell / 2;
            const cy = gy + (fr.from + rows.padLeft) * cell + cell / 2;
            const x0 = gx + (fc.from + cols.padLeft + F) * cell + 2;
            return <path d={`M${x0} ${py} Q ${x0 + 14} ${(py + cy) / 2} ${x0} ${cy}`} className="dltt-hop" />;
          })()}
          <text x={gx - 8} y={gy + (totR * cell) / 2} textAnchor="end" className="dltt-t dltt-t--xs dltt-axt--h">s<tspan dy={3} fontSize={8}>h</tspan><tspan dy={-3}>={s1}</tspan></text>
          <text x={gx + (totC * cell) / 2} y={gy + totR * cell + 16} textAnchor="middle" className="dltt-t dltt-t--xs dltt-axt--wd">s<tspan dy={3} fontSize={8}>w</tspan><tspan dy={-3}>={s2}</tspan></text>
          <text x={ox} y={oy - 10} className="dltt-t dltt-t--xs">output {rows.out} × {cols.out}</text>
          {Array.from({ length: rows.out }, (_, i) => Array.from({ length: cols.out }, (_, j) => (
            <rect
              key={`o${i}-${j}`}
              x={ox + j * cell + 1}
              y={oy + i * cell + 1}
              width={cell - 2}
              height={cell - 2}
              rx={3}
              {...rove('g2d', i * cols.out + j, rows.out * cols.out, cols.out, r * cols.out + c)}
              aria-label={`Output row ${i + 1}, column ${j + 1}`}
              className={`dltt-outcell${i === r && j === c ? ' dltt-outcell--hot' : ''}`}
              onPointerEnter={() => setHot({ r: i, c: j })}
              onFocus={() => setHot({ r: i, c: j })}
            />
          )))}
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 120 : 64}`} role="group" aria-label="Vertical and horizontal strides">
          <text x={20} y={16} className="dltt-t dltt-t--s dltt-axt--h">vertical stride s_h</text>
          <Scrub x0={30} x1={narrow ? W - 30 : W / 2 - 40} y={40} value={s1} min={1} max={3} step={1} onChange={setSh} label="Vertical stride" ticks={[1, 2, 3]} />
          <text x={narrow ? 20 : W / 2 + 10} y={narrow ? 76 : 16} className="dltt-t dltt-t--s dltt-axt--wd">horizontal stride s_w</text>
          <Scrub x0={narrow ? 30 : W / 2 + 20} x1={W - 30} y={narrow ? 100 : 40} value={s2} min={1} max={3} step={1} onChange={setSw} label="Horizontal stride" ticks={[1, 2, 3]} />
        </svg>
      </div>
    </Stage>
  );
}
