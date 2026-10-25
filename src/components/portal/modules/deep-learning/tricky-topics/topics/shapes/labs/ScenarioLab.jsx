import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import TensorGlyph from '../../../TensorGlyph';
import './shapes.css';

/* Step 7 · the exam move: a scenario → the shapes of X and y. Four of the
   unit's scenarios: L4 slide 11's weather cell, Lab Sheet 4's two tasks and
   the sample paper's star. Left: the scenario, inputs as time steps and the
   target marked; right: X as (examples, time steps, numbers per step) and y
   as what each example predicts. One control: the scenario. */

const SC = {
  l4s11: {
    label: 'L4 slide 11',
    prov: '{s|L4 · slide 11}',
    what: '3 days of temperature, precipitation, pressure and wind speed → the next day’s temperature and precipitation',
    n: 'N', steps: 3, per: 4, y: [2], yWords: '2 numbers per example',
    steps_words: ['day 0', 'day 1', 'day 2'], target: 'day 3',
  },
  ls4t2: {
    label: 'Lab Sheet 4 · task 2',
    prov: '{s|Lab Sheet 4}',
    what: '4 noisy vertices (x, y) of a square → clockwise (1) or anticlockwise (0)',
    n: 200, steps: 4, per: 2, y: [], yWords: 'one label per example',
    steps_words: ['v0', 'v1', 'v2', 'v3'], target: 'label',
  },
  ls4t3: {
    label: 'Lab Sheet 4 · task 3',
    prov: '{s|Lab Sheet 4}',
    what: 'the first 3 vertices → the 4th vertex’s (x, y)',
    n: 200, steps: 3, per: 2, y: [2], yWords: '2 numbers per example',
    steps_words: ['v0', 'v1', 'v2'], target: 'v3',
  },
  q2a: {
    label: 'Sample Q2(a) i.',
    prov: '{s|Sample Q2(a)}',
    what: 'the 2D coordinates of a hand-sketched star’s first 4 corners → its last corner',
    n: 'N', steps: 4, per: 2, y: [2], yWords: '2 numbers per example',
    steps_words: ['c0', 'c1', 'c2', 'c3'], target: 'c4',
  },
};

export function ScenarioLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [kRaw, setK] = useState('q2a');
  const k = printing ? 'q2a' : kRaw;
  const S = SC[k];
  const W = narrow ? 340 : 760;
  const H = narrow ? 400 : 220;
  const xTuple = `(${S.n}, ${S.steps}, ${S.per})`;
  const yTuple = S.y.length ? `(${S.n}, ${S.y.join(', ')})` : `(${S.n},)`;
  const dotX = (i) => (narrow ? 30 : 40) + i * (narrow ? 58 : 62);
  return (
    <Stage
      title="From a story to the shapes of X and y"
      prov={S.prov}
      tryThis="Read the scenario, write X’s and y’s shapes on paper, then check against the picture."
      caption="X is (examples, time steps, numbers per step), the 3D input recurrent layers expect; y is (examples, what is predicted), or (examples,) for one label each."
      maths={
        <>
          <MLine text={`Scenario: ${S.what}.`} />
          <MLine text={`X ${xTuple}: ${S.n} example${S.n === 1 ? '' : 's'}, ${S.steps} time steps, ${S.per} numbers per step. y ${yTuple}: ${S.yWords}.`} />
          {k === 'q2a' && <MLine text="The sample paper gives no dataset size, so N. Part iii (3 corners in, 2 out) gives X $(N, 3, 2)$ and y $(N, 4)$: the two corners’ coordinates in one row (Exam Practice’s answer)." />}
          {k.startsWith('ls4') && <MLine text="Lab Sheet 4 prints `(200, 4, 2)`, `(60, 4, 2)`, `(200, )`, `(60, )` for task 2, and `X_train[:, :3, :]` (200, 3, 2) → `X_train[:, 3, :]` (200, 2) for task 3 {s|Lab Sheet 4}." />}
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Scenario" value={k} onChange={setK} options={Object.entries(SC).map(([value, s]) => ({ value, label: s.label }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${S.what}: X ${xTuple}, y ${yTuple}`}>
          <text x={narrow ? 20 : 30} y={18} className="dltt-t dltt-t--xs">one example</text>
          {Array.from({ length: S.steps }, (_, i) => (
            <g key={i}>
              <circle cx={dotX(i)} cy={60} r={13} className="dltt-scn__in" />
              <text x={dotX(i)} y={64} textAnchor="middle" className="dltt-t dltt-t--xs">{S.per}</text>
              <text x={dotX(i)} y={90} textAnchor="middle" className="dltt-t dltt-t--xs dltt-axt--t">{S.steps_words[i]}</text>
              {i > 0 && <line x1={dotX(i - 1) + 14} y1={60} x2={dotX(i) - 14} y2={60} className="dltt-wire dltt-wire--data" />}
            </g>
          ))}
          <line x1={dotX(S.steps - 1) + 14} y1={60} x2={dotX(S.steps) - 18} y2={60} className="dltt-wire" strokeDasharray="4 3" />
          <rect x={dotX(S.steps) - 16} y={44} width={32} height={32} rx={6} className="dltt-scn__target" />
          <text x={dotX(S.steps)} y={64} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b">{S.y.length ? S.y[0] : '0/1'}</text>
          <text x={dotX(S.steps)} y={90} textAnchor="middle" className="dltt-t dltt-t--xs">{S.target}</text>
          <text x={narrow ? 20 : 30} y={118} className="dltt-t dltt-t--xs">circles: time steps (each holds {S.per} numbers) · square: what is predicted</text>
          <g transform={`translate(${narrow ? 20 : 430} ${narrow ? 140 : 14})`}>
            <text x={0} y={10} className="dltt-t dltt-t--b dltt-t--m" style={{ fontSize: 15 }}>X {xTuple}</text>
            <TensorGlyph x={0} y={20} shape={[S.steps, S.per]} kind="seq" batch={S.n} fit={[200, 100]} />
            <text x={narrow ? 0 : 0} y={narrow ? 150 : 150} className="dltt-t dltt-t--b dltt-t--m" style={{ fontSize: 15 }}>y {yTuple}</text>
            <text x={0} y={narrow ? 170 : 170} className="dltt-t dltt-t--xs">{S.yWords}</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}
