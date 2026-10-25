import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Token, Arrow } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { softmax, sigmoid } from '../../../maths/softmax.js';
import { num, score, tex, texScore, sum, starts, Z_WALK } from './sm.js';
import './softmax.css';

/* Step 3 · softmax or sigmoid? One output layer, three ways (a Switch):
   binary = one score through a sigmoid, the other class gets 1 − p;
   multilabel = the same three scores each through its own sigmoid (they
   needn't add up to 1); multiclass = the same three scores through one
   softmax (they do). Under the bars, a 0–1 axis ("1 = certain") gives
   their scale; beside them, a "sum" tower stacks them (one purple, gaps
   between) against a mark at 1, so the difference is a picture, not a
   sentence. */

const Z = Z_WALK;
const MODES = [
  { value: 'binary', label: 'Binary' },
  { value: 'multilabel', label: 'Multilabel' },
  { value: 'multiclass', label: 'Multiclass' },
];
const SAY = {
  binary: 'one yes/no answer: one output, one sigmoid',
  multilabel: 'several independent yes/no labels: a sigmoid each',
  multiclass: 'one class out of three: one softmax over all three',
};

function outputs(mode) {
  if (mode === 'binary') {
    const p = sigmoid(Z[0]);
    return { z: [Z[0]], p: [p], ghost: 1 - p };
  }
  if (mode === 'multilabel') return { z: Z, p: Z.map(sigmoid), ghost: null };
  return { z: Z, p: softmax(Z), ghost: null };
}

const WIDE = { W: 760, H: 300, nx: 150, rows: [92, 162, 232], one: [162], ax: 214, aw: 86, bx: 340, bl: 230, tx: 668, tw: 30, tBase: 254, tUnit: 90, sayY: 24, axisY: 262, ticks: [0, 0.5, 1] };
const NARROW = { W: 340, H: 310, nx: 26, rows: [96, 164, 232], one: [164], ax: 58, aw: 58, bx: 130, bl: 110, tx: 288, tw: 24, tBase: 262, tUnit: 80, sayY: 22, axisY: 262, ticks: [0, 1] };

export function VsLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [modeState, setMode] = useState('multiclass');
  const mode = printing ? 'multiclass' : modeState;
  const G = narrow ? NARROW : WIDE;
  const o = outputs(mode);
  const multi = mode !== 'binary';
  const ys = multi ? G.rows : G.one;
  const parts = o.ghost === null ? o.p : [...o.p, o.ghost];
  const total = sum(parts);
  const st = starts(parts);
  const exact = Math.abs(total - 1) < 1e-9;
  const barY = (i) => (multi ? ys[i] : ys[0] - 20 + i * 40);
  const ml = outputs('multilabel');
  const mc = outputs('multiclass');
  const bin = outputs('binary');
  const z0 = texScore(Z[0]);
  return (
    <Stage
      title="Separate yes/no answers, or one share-out?"
      prov="{s|L1 · slides 29, 31} {s|L9 · slide 25}"
      tryThis="Predict which of the three output layers adds up to exactly 1, then switch between them."
      caption="Multilabel sigmoids are separate yes/no answers, so their sum can be anything; softmax makes the classes compete for one total of 1. CartPole has two actions but one sigmoid output: left with probability $p$ {s|L9 · slides 23, 25}, right with $1 - p$ {own}."
      maths={
        <>
          <MLine text={`Binary: $\\sigma(${z0}) = 1/(1 + e^{-${z0}}) = ${tex(bin.p[0], 3)}$; one logistic output {s|L1 · slide 29}; the other class gets $1 - ${tex(bin.p[0], 3)} = ${tex(bin.ghost, 3)}$ {own}.`} />
          <MLine text={`Multilabel: $${Z.map((v) => `\\sigma(${texScore(v)})`).join(', ')} = ${ml.p.map((v) => tex(v, 3)).join(', ')}$, which add up to $${tex(sum(ml.p), 3)}$: each label is its own question {s|L1 · slide 29}.`} />
          <MLine text={`Multiclass: softmax of $(${Z.map(texScore).join(', ')})$ is $(${mc.p.map((v) => tex(v, 3)).join(', ')})$, which add up to $${tex(sum(mc.p), 3)}$ {s|L1 · slide 29}. All three train with cross-entropy {s|L1 · slide 31}.`} />
          <MLine text={`A two-class softmax over $(${z0}, 0)$ gives $${tex(softmax([Z[0], 0])[0], 3)}$, the same as $\\sigma(${z0})$: one sigmoid is enough for two classes {beyond}.`} />
          <MLine text={'CartPole: `Dense(1, activation="sigmoid")` gives the probability of left {s|L9 · slides 23, 25}; right gets $1 - p$ {own}.'} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Output layer" value={mode} onChange={setMode} options={MODES} />
        <svg className="dltt-svg" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label={`${SAY[mode]}: outputs ${parts.map((v) => num(v, 3)).join(', ')}, adding up to ${num(total, 3)}`}>
          <text x={narrow ? 12 : 30} y={G.sayY} className="dltt-t dltt-t--s">{SAY[mode]}</text>
          {!narrow && <text x={G.nx} y={56} textAnchor="middle" className="dltt-t dltt-t--xs">scores z</text>}
          {!narrow && <text x={G.bx} y={56} className="dltt-t dltt-t--xs dltt-t--p">outputs</text>}

          {/* the last hidden layer's wires (wide only) */}
          {!narrow && [110, 145, 180, 215].map((y) => ys.map((ny) => (
            <line key={`${y}-${ny}`} x1={46} y1={y} x2={G.nx - 16} y2={ny} className="dltt-wire" />
          )))}
          {!narrow && [110, 145, 180, 215].map((y) => <circle key={y} cx={40} cy={y} r={5} fill="var(--dltt-floor)" stroke="var(--ink-3)" strokeWidth={1.4} />)}

          {/* output neurons holding their scores */}
          {o.z.map((v, i) => (
            <g key={`n${mode}${i}`}>
              <circle cx={G.nx} cy={ys[i]} r={16} fill="var(--dltt-floor)" stroke="var(--dltt-data)" strokeWidth={1.8} />
              <text x={G.nx} y={ys[i] + 4} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--data" style={{ fontSize: 12 }}>{score(v)}</text>
            </g>
          ))}

          {/* the activation: one σ per output, or one softmax over all of them */}
          {mode === 'multiclass' ? (
            <>
              {ys.map((y) => <Arrow key={`w${y}`} x1={G.nx + 17} y1={y} x2={G.ax - 2} y2={y} role="data" />)}
              <Token x={G.ax + G.aw / 2} y={(ys[0] + ys[2]) / 2} w={G.aw} h={ys[2] - ys[0] + 40} word="softmax" role="p" className="dltt-sm-tok" />
            </>
          ) : (
            o.z.map((_, i) => (
              <g key={`a${mode}${i}`}>
                <Arrow x1={G.nx + 17} y1={ys[i]} x2={G.ax - 2} y2={ys[i]} role="data" />
                <Token x={G.ax + G.aw / 2} y={ys[i]} w={G.aw} h={34} word={narrow ? 'σ' : 'sigmoid'} role="p" className="dltt-sm-tok" />
              </g>
            ))
          )}

          {/* the probabilities, as horizontal bars on a 0–1 axis (1 = certain) */}
          <line x1={G.bx} y1={G.axisY} x2={G.bx + G.bl} y2={G.axisY} className="dltt-sm-axis" />
          {G.ticks.map((t) => (
            <g key={`k${t}`}>
              <line x1={G.bx + t * G.bl} y1={G.axisY} x2={G.bx + t * G.bl} y2={G.axisY + 5} className="dltt-sm-axis" />
              <text x={G.bx + t * G.bl + (narrow && t === 1 ? 4 : 0)} y={G.axisY + 17} textAnchor={narrow && t === 1 ? 'end' : 'middle'} className={`dltt-t dltt-t--xs dltt-t--m${t === 1 ? ' dltt-t--b dltt-t--p' : ''}`}>{t === 1 ? '1 = certain' : t}</text>
            </g>
          ))}
          {o.p.map((v, i) => (
            <g key={`b${mode}${i}`}>
              {multi || i === 0 ? <line x1={G.ax + G.aw + 2} y1={ys[multi ? i : 0]} x2={G.bx - 4} y2={barY(i)} className="dltt-wire dltt-wire--p" /> : null}
              <rect x={G.bx} y={barY(i) - 11} width={Math.max(1, v * G.bl)} height={22} className="dltt-sm-p dltt-sm-inx" />
              <text x={G.bx + v * G.bl + 6} y={barY(i) + 4} className="dltt-t dltt-t--m dltt-t--b dltt-t--p dltt-halo" style={{ fontSize: 12 }}>{num(v, 3)}</text>
            </g>
          ))}
          {o.ghost !== null && (
            <g key="ghost">
              <rect x={G.bx} y={barY(1) - 11} width={o.ghost * G.bl} height={22} className="dltt-sm-p--ghost dltt-sm-inx" />
              <text x={G.bx + o.ghost * G.bl + 6} y={barY(1) + 4} className="dltt-t dltt-t--m dltt-t--p dltt-halo" style={{ fontSize: 12 }}>{num(o.ghost, 3)}</text>
              <text x={G.bx} y={barY(1) + 28} className="dltt-t dltt-t--xs">{narrow ? '1 − p: the other class' : 'the other class: 1 − p (no output of its own)'}</text>
              <text x={G.bx} y={barY(0) - 17} className="dltt-t dltt-t--xs">p</text>
            </g>
          )}

          {/* the sum tower: the bars stacked, against the dashed line at 1 */}
          <text x={G.tx + G.tw / 2} y={G.tBase - total * G.tUnit - 10} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b">Σ = {num(total, 3)}</text>
          <line x1={G.tx - 12} y1={G.tBase - G.tUnit} x2={G.tx + G.tw + 12} y2={G.tBase - G.tUnit} className="dltt-sm-one" />
          <text x={G.tx - 16} y={G.tBase - G.tUnit + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m dltt-t--p">1</text>
          <line x1={G.tx - 12} y1={G.tBase} x2={G.tx + G.tw + 12} y2={G.tBase} className="dltt-sm-base" />
          {parts.map((v, i) => (
            <rect
              key={`t${mode}${i}`}
              x={G.tx}
              y={G.tBase - (st[i] + v) * G.tUnit}
              width={G.tw}
              height={Math.max(0.5, v * G.tUnit)}
              className={`${o.ghost !== null && i === parts.length - 1 ? 'dltt-sm-p--ghost' : 'dltt-sm-seg'} dltt-sm-iny`}
            />
          ))}
          <text x={G.tx + G.tw / 2} y={G.tBase + 18} textAnchor="middle" className={`dltt-t dltt-t--xs dltt-t--b ${exact ? 'dltt-t--p' : 'dltt-sm-warn'}`}>{exact ? 'exactly 1' : 'not 1'}</text>
          <text x={G.tx + G.tw / 2} y={G.tBase + 32} textAnchor="middle" className="dltt-t dltt-t--xs">sum</text>
        </svg>
      </div>
    </Stage>
  );
}
