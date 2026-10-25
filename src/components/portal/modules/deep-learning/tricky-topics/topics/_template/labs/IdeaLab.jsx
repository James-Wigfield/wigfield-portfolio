import { useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../../../stage';
import { Scrub, Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';

/* REPLACE ME — the template's one lab: a picture first (bars that grow with
   n), one control (a scrubber), a counter, and the maths drawer. Copy the
   shape of this file for a new lab: the measured wrapper stays mounted in
   every branch, `printing` pins a finished state, ≤ 3 controls, a title +
   one-line "Try this" + ≤ 2 caption sentences. Numbers come from a maths
   module (../../../maths/…), never typed in twice. */

export function IdeaLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [nIn, setNIn] = useState(4);
  const n = printing ? 4 : nIn;
  const units = 3;
  const count = (n + 1) * units;
  const W = narrow ? 340 : 640;
  return (
    <Stage
      title="REPLACE ME: the lab’s title"
      prov="{s|L1 · slide 36} {own}"
      tryThis="REPLACE ME: predict, then drag n, then notice one thing."
      caption="REPLACE ME: at most two caption sentences."
      maths={
        <>
          <MEq tex={'(n_{\\text{in}} + 1) \\times 3'} />
          <MLine text={`With $n_{\\text{in}} = ${n}$: $(${n} + 1) \\times 3 = ${count}$.`} />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dltt-svg" viewBox={`0 0 ${W} 150`} role="img" aria-label={`${n} inputs, ${count} parameters`}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={30 + i * 22} y={40} width={16} height={50} rx={3} className="dltt-vbar dltt-vbar--w" />
          ))}
          <Counter x={W - 70} y={80} value={count} label={`${count} parameters`} />
          <Scrub x0={30} x1={W - 160} y={122} value={n} min={1} max={12} step={1} onChange={setNIn} label="Number of inputs" />
        </svg>
      </div>
    </Stage>
  );
}
