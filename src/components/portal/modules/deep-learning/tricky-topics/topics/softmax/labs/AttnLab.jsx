import { useRef, useState } from 'react';
import { Stage, Switch, MLine, MEq } from '../../../stage';
import { Token, Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { attention, argmax } from '../../../maths/softmax.js';
import { ShareStrip } from './SmParts';
import { num, tex, texScore, sum } from './sm.js';
import './softmax.css';

/* Step 5 · softmax in attention. The decoder, about to write "fútbol",
   looks back at three encoder outputs, "I like soccer" (L8's example;
   slide 21 says "soccer" should get the largest weight). Toy scores (this
   page's own) × a score size, optionally ÷ √d_keys (d_keys = 64, so ÷ 8),
   go through softmax: each cone's width and opacity is its weight α, and
   the strip shows the three weights adding up to 1. Under each word sits
   a small toy vector y (dashed) with its share α·y filled in; the filled
   bars add up to h̃ = Σ α y, which looks more and more like the top word
   as the softmax saturates. A gauge shows α(1 − α) for the top weight,
   which collapses towards 0 when the softmax saturates. The vectors are
   drawn, never printed as numbers. */

const WORDS = ['I', 'like', 'soccer'];
const S = [1, 0.5, 2]; // this page's own toy scores
const DK = 64;
const SCALE = Math.sqrt(DK);
// this page's own toy encoder outputs y_(i): four numbers each, one shape per word
const Y = [
  [0.9, 0.3, 0.15, 0.2],
  [0.25, 0.9, 0.45, 0.15],
  [0.15, 0.35, 0.7, 1],
];

const WIDE = {
  W: 760, H: 392, dec: [290, 50], dw: 116, enc: [110, 290, 470], ey: 252, ew: 92, coneTop: 68, coneBot: 234, hw: 44,
  strip: { x: 560, y: 66, len: 180 }, stripLab: 40, sumAt: [560, 172], gauge: { x: 560, y: 222, len: 180 },
  vBase: 366, vh: 44, vbw: 9, vgap: 4, plus: [200, 380], eq: [530, 352], h: [604, 366], hbw: 12, hgap: 5, hLab: [560, 312], hNote: [560, 384],
};
const NARROW = {
  W: 340, H: 600, dec: [170, 48], dw: 104, enc: [58, 170, 282], ey: 224, ew: 80, coneTop: 66, coneBot: 206, hw: 34,
  strip: { x: 20, y: 448, len: 300 }, stripLab: 434, sumAt: [320, 434], gauge: { x: 20, y: 556, len: 300 },
  vBase: 334, vh: 44, vbw: 8, vgap: 3, plus: [114, 226], eq: [124, 398], h: [170, 404], hbw: 10, hgap: 4, hLab: [206, 378], hNote: [206, 394],
};

// a vector as four small bars on a baseline; `ghost` = the full vector, dashed
function Vec({ cx, base, v, ghost, vh, bw, gap }) {
  const w = v.length * bw + (v.length - 1) * gap;
  const x0 = cx - w / 2;
  return (
    <g>
      {v.map((d, k) => {
        const x = x0 + k * (bw + gap);
        return (
          <g key={k}>
            {ghost && <rect x={x} y={base - ghost[k] * vh} width={bw} height={ghost[k] * vh} className="dltt-sm-vghost" />}
            <rect x={x} y={base - d * vh} width={bw} height={Math.max(0.5, d * vh)} className="dltt-sm-vbar dltt-sm-geo" />
          </g>
        );
      })}
      <line x1={x0 - 4} y1={base} x2={x0 + w + 4} y2={base} className="dltt-sm-base" />
    </g>
  );
}

export function AttnLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [multState, setMult] = useState(8);
  const [onState, setOn] = useState(true);
  const m = printing ? 8 : multState;
  const on = printing ? true : onState;
  const raw = S.map((v) => v * m);
  const div = on ? SCALE : 1;
  const a = attention(raw, div);
  const eff = raw.map((v) => v / div);
  const top = argmax(a);
  const sens = a[top] * (1 - a[top]);
  const total = sum(a);
  // each word's share α_i · y_i, and their sum h̃ (drawn only)
  const shares = Y.map((y, i) => y.map((d) => a[i] * d));
  const blend = Y[0].map((_, k) => shares.reduce((acc, s) => acc + s[k], 0));
  const G = narrow ? NARROW : WIDE;
  const tiny = sens < 0.02;
  const W = G.W;
  return (
    <Stage
      title="Attention weights are a softmax"
      prov="{s|L8 · slides 21–25} {s|L8 · slides 37–38} {own} {beyond}"
      tryThis="Switch the ÷ √d_keys off, then drag the score size up and watch the weights snap onto one word."
      caption="Every set of weights adds up to 1, whatever the scale. Big scores saturate the softmax: one word takes nearly all the weight and its sensitivity α(1 − α) collapses towards 0, the “tiny gradients” that dividing by √d_keys avoids {s|L8 · slide 38}."
      challenge={{ text: 'Saturate it: push the top weight above 0.99.', done: a[top] > 0.99 }}
      maths={
        <>
          <MEq tex={'\\alpha_{(t,i)} = \\frac{\\exp(e_{(t,i)})}{\\sum_{i\'} \\exp(e_{(t,i\')})}'} />
          <MLine text={`Scores: this page’s toy $(${S.map(texScore).join(', ')})$, $\\times ${texScore(m)}$${on ? `, $\\div \\sqrt{${DK}} = \\div ${texScore(SCALE)}$` : ''}, so $e = (${eff.map((x) => tex(x, 2)).join(', ')})$ {own}.`} />
          <MLine text={`Weights: $\\alpha = (${a.map((x) => tex(x, 3)).join(', ')})$; they add up to $${tex(total, 3)}$, like every row of $\\text{softmax}(\\mathbf{Q}\\mathbf{K}^\\top / \\sqrt{d_{\\text{keys}}})$ {s|L8 · slide 38}.`} />
          <MLine text={`The decoder uses the weighted sum $\\widetilde{\\mathbf{h}}_{(t)} = \\sum_i \\alpha_{(t,i)}\\,\\mathbf{y}_{(i)}$: here ${a.map((x, i) => `${tex(x, 2)} of “${WORDS[i]}”`).join(', ')} {s|L8 · slide 25}.`} />
          <MLine text="In the picture each word’s vector $\mathbf{y}_{(i)}$ is a made-up four-number toy (dashed), its share $\alpha_{(t,i)}\,\mathbf{y}_{(i)}$ is filled in, and the filled bars stack up to $\widetilde{\mathbf{h}}_{(t)}$: the bigger a word’s weight, the more $\widetilde{\mathbf{h}}_{(t)}$ looks like that word." />
          <MLine text={`Sensitivity of the top weight to its own score (the softmax’s derivative there): $\\alpha(1 - \\alpha) = ${tex(sens, 4)}$, at most $0.25$ {beyond}. Scaling down avoids “saturating the softmax function, which would lead to tiny gradients” {s|L8 · slide 38}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dltt-sm-ctl">
          <span className="dltt-sm-ctl__k">scale</span>
          <Switch
            label="Divide the scores by the square root of d_keys"
            value={on}
            onChange={setOn}
            options={[
              { value: false, label: 'raw scores' },
              { value: true, label: <>÷ √<i>d</i><sub>keys</sub> = ÷ {texScore(SCALE)}</> },
            ]}
          />
        </div>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${G.H}`} role="img" aria-label={`Attention weights on I, like, soccer: ${a.map((x) => num(x, 2)).join(', ')}; the weighted sum looks most like ${WORDS[top]}; top weight sensitivity ${num(sens, 3)}`}>
          {/* cones: width and opacity = α */}
          {a.map((x, i) => {
            const hw = 3 + G.hw * x;
            return (
              <polygon
                key={`c${i}`}
                points={`${G.dec[0] - 5},${G.coneTop} ${G.dec[0] + 5},${G.coneTop} ${G.enc[i] + hw},${G.coneBot} ${G.enc[i] - hw},${G.coneBot}`}
                className="dltt-sm-cone"
                style={{ opacity: 0.08 + 0.72 * x }}
              />
            );
          })}
          <text x={G.dec[0]} y={G.dec[1] - 26} textAnchor="middle" className="dltt-t dltt-t--xs">decoder, about to write</text>
          {!narrow && <text x={G.enc[0] - G.ew / 2 - 10} y={G.ey + 4} textAnchor="end" className="dltt-t dltt-t--xs">encoder</text>}
          <Token x={G.dec[0]} y={G.dec[1]} w={G.dw} h={34} word="fútbol" role="data" />
          {WORDS.map((w, i) => (
            <g key={w}>
              <Token x={G.enc[i]} y={G.ey} w={G.ew} h={34} word={w} role="data" on={i === top} />
              <text x={G.enc[i]} y={G.ey + 36} textAnchor="middle" className="dltt-t dltt-t--b dltt-t--p dltt-sm-num" style={{ fontSize: 13 }}>α = {num(a[i], 2)}</text>
              <text x={G.enc[i]} y={G.ey + 52} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m dltt-t--data">e = {num(eff[i], 2)}</text>
              {/* the word's vector y (dashed) and its share α·y (filled) */}
              <Vec cx={G.enc[i]} base={G.vBase} v={shares[i]} ghost={Y[i]} vh={G.vh} bw={G.vbw} gap={G.vgap} />
            </g>
          ))}
          {!narrow && <text x={G.enc[0] - G.ew / 2 - 10} y={G.vBase - 14} textAnchor="end" className="dltt-t dltt-t--xs">α · y</text>}
          {G.plus.map((x) => <text key={`plus${x}`} x={x} y={G.vBase - 14} textAnchor="middle" className="dltt-t dltt-sm-op">+</text>)}

          {/* the weighted sum h̃: the filled bars added up */}
          <text x={G.eq[0]} y={G.eq[1]} textAnchor="middle" className="dltt-t dltt-sm-op">=</text>
          <text x={G.hLab[0]} y={G.hLab[1]} className="dltt-t dltt-t--xs dltt-t--b">weighted sum h̃ = Σ α y</text>
          <Vec cx={G.h[0]} base={G.h[1]} v={blend} vh={G.vh} bw={G.hbw} gap={G.hgap} />
          <text x={G.hNote[0]} y={G.hNote[1]} className="dltt-t dltt-t--xs">{a[top] > 0.5 ? `mostly “${WORDS[top]}”` : 'a blend of all three'}</text>

          {/* the weights: one 100% strip */}
          <text x={G.strip.x} y={G.stripLab} className="dltt-t dltt-t--xs dltt-t--b dltt-t--p">weights α (add up to 1)</text>
          <ShareStrip x={G.strip.x} y={G.strip.y} len={G.strip.len} thick={24} p={a} names={WORDS} end={false} />
          <text x={G.sumAt[0]} y={G.sumAt[1]} textAnchor={narrow ? 'end' : 'start'} className="dltt-t dltt-t--b dltt-t--p dltt-sm-num">Σ α = {num(total, 3)}</text>

          {/* the top weight's sensitivity α(1 − α), 0 … 0.25 */}
          <text x={G.gauge.x} y={G.gauge.y - 10} className="dltt-t dltt-t--xs">sensitivity of the top weight, α(1 − α)</text>
          <rect x={G.gauge.x} y={G.gauge.y} width={G.gauge.len} height={10} className="dltt-sm-gauge" />
          <rect x={G.gauge.x} y={G.gauge.y} width={Math.max(0.5, (sens / 0.25) * G.gauge.len)} height={10} className="dltt-sm-gauge__fill" />
          <text x={G.gauge.x + G.gauge.len} y={G.gauge.y + 30} textAnchor="end" className="dltt-t dltt-t--m dltt-t--b" style={{ fontSize: 15 }}>{num(sens, 3)}</text>
          <text x={G.gauge.x} y={G.gauge.y + 28} className={`dltt-t dltt-t--s dltt-sm-warn dltt-fade${tiny ? '' : ' dltt-hide'}`}>tiny gradients</text>
        </svg>
        <svg className="dltt-svg" viewBox={`0 0 ${W} 84`} role="group" aria-label="Score size">
          <text x={20} y={14} className="dltt-t dltt-t--s">score size (dot products grow with d<tspan dy={3} fontSize={9}>keys</tspan><tspan dy={-3}>)</tspan></text>
          <Scrub
            x0={40}
            x1={W - 40}
            y={52}
            value={m}
            min={0.5}
            max={12}
            step={0.5}
            big={2}
            onChange={setMult}
            label="Score size: multiply the toy scores"
            ticks={[1, 8, 12]}
            tickLabel={(t) => `×${t}`}
            show={(t) => `×${texScore(t)}`}
          />
        </svg>
      </div>
    </Stage>
  );
}
