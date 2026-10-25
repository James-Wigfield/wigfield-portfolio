import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Token, Arrow, Tip } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { softmax, argmax } from '../../../maths/softmax.js';
import { num } from './sm.js';
import './softmax.css';

/* Step 6 · the last layer. Translating "I like soccer": at each decoding
   step the Dense ("Linear") layer scores every word of a small Spanish
   vocabulary (this page's own toy logits), softmax turns the scores into
   probabilities, and the tallest bar is the next word, appended to the
   sentence above. One switch: the step. The little stack on the left says
   where the parameters are: all in the Linear layer, none in the softmax.
   Narrow stages draw the vocabulary as rows. */

const VOCAB = ['me', 'gusta', 'encanta', 'el', 'la', 'fútbol', 'tenis', '<eos>'];
// this page's own toy logits, one row per decoding step
const LOGITS = [
  [3.0, 0.6, 0.2, 1.2, 0.8, 0.1, -0.6, -1.2],
  [-0.8, 2.8, 2.0, 0.1, -0.1, 0.4, -0.3, -1.0],
  [-1.0, -0.6, -0.7, 2.5, 1.8, 0.9, 0.2, -0.5],
  [-1.2, -0.5, -0.9, -0.4, -0.3, 3.2, 1.5, 0.1],
  [-0.7, -1.0, -1.1, -0.5, -0.6, 0.2, -0.9, 2.9],
];
const PROBS = LOGITS.map(softmax);
const PRED = PROBS.map((p) => VOCAB[argmax(p)]);
const SHOWN = PRED.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w));
const STEPS = PRED.map((_, i) => ({ value: i, label: `step ${i + 1}` }));
const PRINT_STEP = 3;

export function LastLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [stepState, setStep] = useState(PRINT_STEP);
  const [hot, setHot] = useState(null);
  const s = printing ? PRINT_STEP : stepState;
  const p = PROBS[s];
  const k = argmax(p);
  const W = narrow ? 340 : 760;
  const H = narrow ? 412 : 330;
  // wide: vertical bars over the vocabulary
  const bx = (i) => 240 + i * 66;
  const base = 286;
  const pH = 170;
  // narrow: one row per word
  const ry = (i) => 168 + i * 30;
  const rx = 92;
  const rl = 190;
  const tok = narrow ? { x: (i) => 40 + i * 65, y: 50, w: 60 } : { x: (i) => 250 + i * 92, y: 48, w: 84 };
  return (
    <Stage
      title="The last layer: one probability per word"
      prov="{s|L8 · slides 26, 28, 41} {own}"
      tryThis="Before switching, guess which word wins the next step, then step through the sentence."
      caption="Softmax has no parameters of its own: the vocabulary-sized Dense (“Linear”) layer before it holds them all. Softmax only turns that layer’s scores into one probability per word, and the prediction is the tallest bar."
      maths={
        <>
          <MLine text={`Step ${s + 1}: the Dense layer scores all ${VOCAB.length} words (toy scores) {own}; softmax gives ${VOCAB.map((w, i) => `${w} ${num(p[i], 3)}`).join(' · ')}.`} />
          <MLine text={`The tallest is “${VOCAB[k]}” at $${num(p[k], 3)}$, so it is the next word; the probabilities add up to $${num(p.reduce((a, b) => a + b, 0), 3)}$.`} />
          <MLine text={'Translation ends `Dense(vocab_size, activation="softmax")`: “The length of the `Y_proba` array corresponds to the vocabulary size” {s|L8 · slides 26, 28}. The transformer ends Linear → Softmax → Output Probabilities {s|L8 · slide 41}.'} />
          <MLine text="Softmax has nothing to learn; a Dense layer from $d$ inputs to the vocabulary holds $(d + 1) \times \text{vocab\_size}$ parameters ([parameter counts](@param-count)) {beyond}." />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Decoding step" value={s} onChange={setStep} options={STEPS} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Step ${s + 1}: the tallest bar is “${VOCAB[k]}” at ${num(p[k], 2)}; the sentence so far: ${SHOWN.slice(0, s + 1).join(' ')}`}>
          {/* the sentence so far */}
          <text x={narrow ? 10 : 24} y={narrow ? 16 : 26} className="dltt-t dltt-t--xs">translating</text>
          <text x={narrow ? 10 : 24} y={narrow ? 16 : 50} dx={narrow ? 62 : 0} className="dltt-t dltt-t--m dltt-t--b" style={{ fontSize: narrow ? 12 : 15 }}>I like soccer</text>
          {!narrow && <Arrow x1={150} y1={46} x2={198} y2={46} />}
          {SHOWN.map((w, i) => (
            <Token
              key={`o${i}`}
              x={tok.x(i)}
              y={tok.y}
              w={tok.w}
              h={30}
              word={i <= s ? w : '…'}
              role={i === s ? 'p' : 'data'}
              on={i === s}
              ghost={i > s}
              className="dltt-sm-tok"
            />
          ))}

          {/* where the parameters are */}
          {narrow ? (
            <g>
              <Token x={80} y={106} w={130} h={30} word="Linear (Dense)" role="w" className="dltt-sm-tok" />
              <text x={80} y={136} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--w">W, b: all the parameters</text>
              <Arrow x1={148} y1={106} x2={190} y2={106} />
              <Token x={256} y={106} w={120} h={30} word="Softmax" role="nt" className="dltt-sm-tok" />
              <text x={256} y={136} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--nt">0 parameters</text>
            </g>
          ) : (
            <g>
              <text x={97} y={110} textAnchor="middle" className="dltt-t dltt-t--xs">decoder output</text>
              <Arrow x1={97} y1={116} x2={97} y2={134} />
              <Token x={97} y={152} w={150} h={34} word="Linear (Dense)" role="w" className="dltt-sm-tok" />
              <text x={97} y={184} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--w">W, b: all the parameters</text>
              <Arrow x1={97} y1={192} x2={97} y2={210} />
              <Token x={97} y={228} w={150} h={34} word="Softmax" role="nt" className="dltt-sm-tok" />
              <text x={97} y={260} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--nt">0 parameters</text>
              <Arrow x1={174} y1={228} x2={206} y2={228} role="p" />
            </g>
          )}

          {/* P(next word) over the vocabulary; the tallest is the prediction */}
          {narrow ? (
            <g>
              <line x1={rx} y1={ry(0) - 16} x2={rx} y2={ry(VOCAB.length - 1) + 14} className="dltt-sm-base" />
              {VOCAB.map((w, i) => (
                <g key={w}>
                  <text x={rx - 8} y={ry(i) + 4} textAnchor="end" className={`dltt-t ${i === k ? 'dltt-t--b dltt-t--p' : ''}`} style={{ fontSize: 12 }}>{w}</text>
                  <rect x={rx} y={ry(i) - 9} width={rl} height={18} className={`${i === k ? 'dltt-sm-p' : 'dltt-sm-p dltt-sm-p--soft'} dltt-sm-sx`} style={{ transform: `scaleX(${Math.max(0.002, p[i])})` }} />
                  <text x={rx + p[i] * rl + 6} y={ry(i) + 4} className={`dltt-t dltt-t--xs dltt-t--m ${i === k ? 'dltt-t--b dltt-t--p' : ''}`}>{num(p[i], 2)}{i === k ? '  argmax' : ''}</text>
                </g>
              ))}
            </g>
          ) : (
            <g>
              <text x={bx(0) - 26} y={base - pH - 14} className="dltt-t dltt-t--xs dltt-t--p dltt-t--b">P(next word)</text>
              <line x1={bx(0) - 26} y1={base - pH} x2={bx(VOCAB.length - 1) + 26} y2={base - pH} className="dltt-sm-one" />
              <text x={bx(0) - 30} y={base - pH + 4} textAnchor="end" className="dltt-t dltt-t--xs dltt-t--m dltt-t--p">1</text>
              <line x1={bx(0) - 26} y1={base} x2={bx(VOCAB.length - 1) + 26} y2={base} className="dltt-sm-base" />
              {VOCAB.map((w, i) => (
                <g key={w} onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)}>
                  <rect x={bx(i) - 22} y={base - pH} width={44} height={pH} fill="transparent" />
                  <rect x={bx(i) - 18} y={base - pH} width={36} height={pH} className={`${i === k ? 'dltt-sm-p' : 'dltt-sm-p dltt-sm-p--soft'} dltt-sm-sy`} style={{ transform: `scaleY(${Math.max(0.004, p[i])})` }} />
                  <text x={bx(i)} y={base + 18} textAnchor="middle" className={`dltt-t ${i === k ? 'dltt-t--b dltt-t--p' : ''}`} style={{ fontSize: 13 }}>{w}</text>
                </g>
              ))}
              <polygon points={`${bx(k) - 6},${base - p[k] * pH - 27} ${bx(k) + 6},${base - p[k] * pH - 27} ${bx(k)},${base - p[k] * pH - 18}`} className="dltt-sm-caret" />
              <text x={bx(k)} y={base - p[k] * pH - 5} textAnchor="middle" className="dltt-t dltt-t--m dltt-t--b dltt-t--p dltt-halo" style={{ fontSize: 12 }}>{num(p[k], 2)}</text>
              <text x={bx(k)} y={base - p[k] * pH - 32} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--b dltt-t--ink dltt-halo">argmax</text>
              {hot !== null && hot !== k && <Tip x={bx(hot)} y={base - p[hot] * pH - 4} text={num(p[hot], 3)} />}
            </g>
          )}
        </svg>
      </div>
    </Stage>
  );
}
