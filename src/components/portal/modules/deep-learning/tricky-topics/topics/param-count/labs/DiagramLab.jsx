import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Neuron, Bead, Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { countModel } from '../../../maths/paramRules';
import './param.css';

/* Step 3 · counting from a diagram. Click each neuron that isn't an input:
   its incoming arrows (weights) and its bias light up and join the tally.
   Click an input and it says why it scores nothing. Three figures: L1
   slide 7's Figure 10-5 (2 → 3), slide 17's XOR network (2 → 2 → 1, biases
   drawn as small circles) and this page's own 3 → 4 → 2. The target total
   comes from paramRules (a Dense stack). One control: the figure. */

const FIGS = {
  f105: { label: 'Figure 10-5 · L1 s7', sizes: [2, 3], prov: '{s|L1 · slide 7}' },
  xor: { label: 'XOR network · L1 s17', sizes: [2, 2, 1], prov: '{s|L1 · slide 17}' },
  own: { label: '3 → 4 → 2 (own)', sizes: [3, 4, 2], prov: '{own}' },
};

const asModel = (sizes) => ({ input: [sizes[0]], layers: sizes.slice(1).map((u) => ({ t: 'dense', units: u })) });

export function DiagramLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [figKey, setFigKey] = useState('f105');
  const [picked, setPicked] = useState(() => new Set());
  const [flash, setFlash] = useState('');
  const fig = FIGS[figKey];
  const sizes = fig.sizes;
  const target = countModel(asModel(sizes)).total;
  const all = new Set();
  sizes.forEach((n, l) => { if (l > 0) for (let j = 0; j < n; j++) all.add(`${l}:${j}`); });
  const on = printing ? all : picked;
  const tally = [...on].reduce((s, k) => s + sizes[Number(k.split(':')[0]) - 1] + 1, 0);
  const done = on.size === all.size;
  const W = narrow ? 360 : 640;
  const H = 250;
  const colX = (l) => (narrow ? 50 : 80) + l * ((narrow ? 200 : 300) / Math.max(1, sizes.length - 1));
  const rowY = (l, j) => 125 + (j - (sizes[l] - 1) / 2) * (narrow ? 50 : 56);
  const pick = (l, j) => {
    if (l === 0) {
      setFlash('An input neuron only holds a number from the data: no weights, no bias. It scores 0.');
      return;
    }
    setFlash('');
    setPicked((prev) => {
      const next = new Set(prev);
      const k = `${l}:${j}`;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const switchFig = (k) => { setFigKey(k); setPicked(new Set()); setFlash(''); };
  return (
    <Stage
      title="Arrows are weights; every non-input neuron adds a bias"
      prov={`${fig.prov}${figKey !== 'own' ? ' {own}' : ''}`}
      tryThis="Count this figure in your head first. Then click each neuron that isn’t an input, and try clicking an input too."
      caption="Each clicked neuron adds the arrows coming into it plus its own bias. The tally is the layer rule, done by hand."
      challenge={{ text: 'Tally every neuron of the 3 → 4 → 2 network.', done: figKey === 'own' && done }}
      maths={
        <>
          {sizes.slice(1).map((n, l) => (
            <MLine key={l} text={`Layer ${l + 1}: ${sizes[l]} inputs × ${n} neurons $= ${sizes[l] * n}$ arrows, $+ ${n}$ biases $= ${(sizes[l] + 1) * n}$.`} />
          ))}
          <MLine text={`Total: **${target}** (${figKey === 'own' ? 'this page’s own network' : 'the slide draws the figure; the count is this page’s own'}).`} />
        </>
      }
    >
      <div ref={wrap} className="dltt-diag">
        <Switch label="Which figure" value={figKey} onChange={switchFig} options={Object.entries(FIGS).map(([value, f]) => ({ value, label: f.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Click neurons to tally: ${tally} of ${target} parameters counted`}>
          {sizes.slice(1).map((n, l1) =>
            Array.from({ length: n }, (_, j) =>
              Array.from({ length: sizes[l1] }, (_, i) => {
                const lit = on.has(`${l1 + 1}:${j}`);
                return <line key={`${l1}-${i}-${j}`} x1={colX(l1) + 12} y1={rowY(l1, i)} x2={colX(l1 + 1) - 13} y2={rowY(l1 + 1, j)} className={`dltt-link-w${lit ? ' dltt-link-w--hot' : ''}`} />;
              }),
            ),
          )}
          {sizes.map((n, l) =>
            Array.from({ length: n }, (_, j) => {
              const k = `${l}:${j}`;
              const lit = on.has(k);
              return (
                <g
                  key={k}
                  role="button"
                  tabIndex={0}
                  aria-pressed={l > 0 ? lit : undefined}
                  aria-label={l === 0 ? `Input ${j + 1}` : `Neuron ${j + 1} of layer ${l}`}
                  className="dltt-diag__n"
                  onClick={() => pick(l, j)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(l, j); } }}
                >
                  <Neuron x={colX(l)} y={rowY(l, j)} r={l === 0 ? 12 : 14} role={l === 0 ? 'data' : 'w'} />
                  {l > 0 && <Bead x={colX(l) + 12} y={rowY(l, j) - 12} r={lit ? 5.5 : 4} on={lit} />}
                  {lit && <circle cx={colX(l)} cy={rowY(l, j)} r={19} className="dltt-diag__ring" />}
                </g>
              );
            }),
          )}
          <text x={colX(0)} y={H - 8} textAnchor="middle" className="dltt-t dltt-t--xs">inputs</text>
          <g transform={`translate(${narrow ? W - 50 : W - 80} 112)`}>
            <Counter x={0} y={0} value={tally} size={narrow ? 30 : 40} label={`${tally} counted`} />
            <text x={0} y={22} textAnchor="middle" className="dltt-t dltt-t--s">{done ? 'all counted ✓' : 'tally'}</text>
          </g>
        </svg>
        <p className="dltt-diag__flash" aria-live="polite">{flash}</p>
      </div>
    </Stage>
  );
}
