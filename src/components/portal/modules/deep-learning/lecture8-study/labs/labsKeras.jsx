import { useId, useRef, useState } from 'react';
import { Stage, MLine } from '../stage';
import { Token, Grid, Cone, Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { softmax, dot, weightedSum, fmt, fmtVec, pct } from '../attn';
import { EN, ES, Q4, K3 } from '../toys';
import './labsKeras.css';

/* ============================================================================
   §8 · KEYS, VALUES AND QUERIES: A SOFT DICTIONARY LOOKUP  (slides 26–28)
   ----------------------------------------------------------------------------
   SoftLookupLab  slide 27's dictionary lookup, made soft. Three drawers, one
                  per English word: the key on the front (blue), the value
                  inside (green). Slide 26's call has two inputs, so the values
                  are the keys (slide 28): the same numbers in both places. The decoder's query (orange) shines on
                  them; each drawer opens as far as its weight, softmax of
                  the query·key scores. A sharpness handle slides from a soft
                  lookup (every drawer half open, the answer a blend) to a
                  hard one (one drawer, like a Python dict). Under the stage,
                  slide 26's Keras line: hover a name to light up its part.
                  Q and K are §11's toy numbers; the sharpness handle is this
                  page's illustration, not a Keras argument.
   ========================================================================== */

const CODE = [
  { t: 'attention_outputs', part: 'out', cls: 'tok-var' },
  { t: ' = ', cls: '' },
  { t: 'attention_layer', part: 'layer', cls: 'tok-fn' },
  { t: '([', cls: '' },
  { t: 'decoder_outputs', part: 'q', cls: 'tok-var' },
  { t: ', ', cls: '' },
  { t: 'encoder_outputs', part: 'kv', cls: 'tok-var' },
  { t: '])', cls: '' },
];
const PART_SAY = {
  q: '`decoder_outputs` are the **queries** (slide 28).',
  kv: '`encoder_outputs` are the **keys**, and the **values** too, since no third input is given (slide 28).',
  layer: '`attention_layer = tf.keras.layers.Attention()`: Luong’s dot-product scores by default (slide 26).',
  out: '`attention_outputs`: one blended answer per query, next turned into word probabilities by `Dense(vocab_size, activation="softmax")`.',
};

export function SoftLookupLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const gid = `dl8s-lk-${useId().replace(/:/g, '')}`;
  const narrow = useWidth(wrap) < 560;
  const [qi, setQi] = useState(1); // "gusta": it needs the verb
  const [sharp, setSharp] = useState(0.5);
  const [part, setPart] = useState(null);
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(null);

  const q = Q4[qi];
  const scores = K3.map((k) => dot(q, k));
  const w = softmax(scores.map((s) => s * sharp));
  // slide 26's call has two inputs, so the values ARE the keys (slide 28)
  const blend = weightedSum(w, K3);
  const even = w.every((x) => Math.abs(x - 1 / 3) < 0.05);

  const W = narrow ? 370 : 760;
  const H = narrow ? 520 : 340;
  const qx = narrow ? 185 : 120;
  const qy = narrow ? 92 : 150;
  const dx = narrow ? [72, 185, 298] : [470, 470, 470];
  const dy = narrow ? [240, 240, 240] : [62, 150, 238];
  const dw = narrow ? 100 : 150;
  const dh = narrow ? 64 : 64;
  const c = narrow ? 12 : 15;
  const lit = (p) => part === p;
  const open = (i) => (narrow ? 0 : w[i] * 70);
  const openY = (i) => (narrow ? w[i] * 46 : 0);

  // the sharpness handle
  const S0 = narrow ? 40 : 300;
  const S1 = narrow ? 330 : 700;
  const SY = narrow ? 470 : 316;
  const toX = (s) => S0 + (s / 2) * (S1 - S0);
  const onPtr = (e) => {
    const pt = svgPoint(e, svgRef.current);
    if (pt) setSharp(Math.round(Math.max(0, Math.min(2, ((pt.x - S0) / (S1 - S0)) * 2)) * 20) / 20);
  };
  const onKey = (e) => {
    const d = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1 }[e.key];
    if (d) { e.preventDefault(); setSharp((v) => Math.round(Math.max(0, Math.min(2, v + d)) * 20) / 20); }
  };

  return (
    <Stage
      title="A soft dictionary lookup"
      slides="slides 26–28"
      tryThis="Predict which drawer “gusta” opens, then slide toward soft and watch the answer become a blend of all three."
      caption="A hard lookup opens one drawer; attention opens every drawer a little, by how well its key matches the query."
      challenge={{ text: 'Make an even blend: all three drawers open the same amount.', done: even }}
      own="toy numbers (§11’s) · the sharpness handle is this page’s illustration"
      maths={
        <>
          <MLine text={`Query “${ES[qi]}” $= ${fmtVec(q)}$. Scores, query · key: ${scores.map((s, i) => `${EN[i]} $${fmt(s)}$`).join(', ')}.`} />
          <MLine text={`Weights = softmax(sharpness × score) with sharpness ${fmt(sharp)}: ${w.map((x, i) => `${EN[i]} $${fmt(x)}$`).join(', ')} (they add up to 1). Sharpness 0.5 is the same as §11’s $\\div\\sqrt{d_{\\text{keys}}} = \\div 2$.`} />
          <MLine text={`Answer = $\\sum$ weight × value $= ${fmtVec(blend)}$. With two inputs the values are the keys (slide 28), so each drawer holds its own key’s numbers.`} />
        </>
      }
    >
      <div ref={wrap}>
        <svg ref={svgRef} className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={(e) => { if (drag) onPtr(e); }} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} role="group" aria-label={`Query ${ES[qi]}: drawers ${w.map((x, i) => `${EN[i]} ${pct(x)}`).join(', ')}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2={narrow ? '0' : '1'} y2={narrow ? '1' : '0'}>
              <stop offset="0" className="dl8s-cone__top" />
              <stop offset="1" className="dl8s-cone__bot" />
            </linearGradient>
          </defs>
          {/* the query words */}
          <text x={narrow ? 8 : 20} y={narrow ? 16 : 36} className={`dl8s-t dl8s-t--b dl8s-t--dec${lit('q') ? ' dl8s-lk__lit' : ''}`}>decoder · the query</text>
          {ES.map((word, i) => (
            <Token
              key={word}
              x={narrow ? 50 + i * 90 : 60 + (i % 2) * 110}
              y={narrow ? 40 : 66 + Math.floor(i / 2) * 40}
              w={narrow ? 78 : 92}
              h={28}
              word={word}
              role="dec"
              on={i === qi}
              onPick={() => setQi(i)}
              label={`Query: ${word}`}
            />
          ))}
          <g className={lit('q') ? 'dl8s-lk__glow' : undefined}>
            <Grid x={qx - 2 * c} y={qy + (narrow ? -10 : 18)} M={[q]} c={c} role="q" max={2.5} frame={false} />
          </g>

          {/* the light from the query onto each drawer */}
          {EN.map((word, i) => (
            narrow ? (
              <Cone key={word} gid={gid} x1={qx} y1={qy + c + 2} x2={dx[i]} y2={dy[i] - dh / 2 + openY(i)} half={dw / 2 - 4} w={w[i]} />
            ) : (
              <path
                key={word}
                className="dl8s-cone"
                fill={`url(#${gid})`}
                d={`M${qx + 2 * c + 4} ${qy + 18 + c / 2 - 1.5} L${dx[i] - dw / 2 + open(i)} ${dy[i] - dh / 2 + 4} L${dx[i] - dw / 2 + open(i)} ${dy[i] + dh / 2 - 4} L${qx + 2 * c + 4} ${qy + 18 + c / 2 + 1.5} Z`}
                style={{ opacity: 0.06 + 0.86 * w[i] }}
              />
            )
          ))}

          {/* the drawers */}
          {EN.map((word, i) => {
            const x0 = dx[i] - dw / 2;
            const y0 = dy[i] - dh / 2;
            return (
              <g key={word} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                {/* the cabinet slot */}
                <rect className="dl8s-lk__slot" x={x0 - 4} y={y0 - 4} width={dw + 8} height={dh + 8} rx={8} />
                {/* the value inside, behind the front: the further the drawer
                    opens, the more of it shows */}
                <g className={lit('kv') ? 'dl8s-lk__glow' : undefined}>
                  <Grid x={narrow ? x0 + dw / 2 - 2 * c : x0 + 6} y={narrow ? y0 + 6 : y0 + dh / 2 - c / 2} M={[K3[i]]} c={c} role="v" max={2.5} frame={false} />
                </g>
                {/* the drawer front: the key */}
                <g className="dl8s-lk__front" style={{ transform: narrow ? `translateY(${openY(i)}px)` : `translateX(${open(i)}px)` }}>
                  <rect className={`dl8s-lk__drawer${lit('kv') ? ' dl8s-lk__drawer--lit' : ''}`} x={x0} y={y0} width={dw} height={dh} rx={6} />
                  <text x={x0 + 10} y={y0 + 20} className="dl8s-t dl8s-t--b dl8s-t--enc">{word}</text>
                  <Grid x={x0 + 10} y={y0 + 30} M={[K3[i]]} c={c} role="k" max={2.5} frame={false} />
                  <rect className="dl8s-lk__handle" x={x0 + dw - 22} y={y0 + dh / 2 - 9} width={10} height={18} rx={3} />
                </g>
              </g>
            );
          })}
          {!narrow && (
            <>
              <text x={dx[0] - dw / 2} y={dy[0] - dh / 2 - 14} className={`dl8s-t dl8s-t--xs${lit('kv') ? ' dl8s-lk__lit' : ''}`}>encoder outputs: <tspan className="dl8s-t--k">key</tspan> on the front, <tspan className="dl8s-t--v">value</tspan> inside (the same vector here)</text>
            </>
          )}
          {hover !== null && <Tip x={dx[hover]} y={dy[hover] - dh / 2 - (narrow ? 4 : 6)} text={`weight ${pct(w[hover])}`} />}

          {/* the blended answer */}
          <g className={lit('out') ? 'dl8s-lk__glow' : undefined}>
            <text x={narrow ? 120 : 20} y={narrow ? 400 : 258} className="dl8s-t dl8s-t--s">answer = Σ weight × value</text>
            <Grid x={narrow ? 150 : 40} y={narrow ? 410 : 268} M={[blend]} c={c + 2} role="v" max={2.5} frame={false} />
          </g>

          {/* soft ↔ hard */}
          <g
            className={`dl8s-scrub${drag ? ' dl8s-scrub--drag' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Sharpness, from a soft lookup to a hard one"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={sharp}
            onKeyDown={onKey}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); onPtr(e); }}
          >
            <rect x={S0 - 10} y={SY - 16} width={S1 - S0 + 20} height={32} fill="transparent" />
            <line className="dl8s-scrub__track" x1={S0} y1={SY} x2={S1} y2={SY} />
            <text x={S0} y={SY + 22} className="dl8s-t dl8s-t--xs">soft (a blend)</text>
            <text x={S1} y={SY + 22} textAnchor="end" className="dl8s-t dl8s-t--xs">hard (one drawer)</text>
            <g className="dl8s-scrub__knob" style={{ transform: `translateX(${toX(sharp)}px)` }}>
              <circle cx={0} cy={SY} r={9} />
            </g>
          </g>
        </svg>

        {/* slide 26's line, hoverable */}
        <figure className="dlk-code dl8s-lk__code">
          <figcaption className="dlk-code__bar">
            <span className="dlk-code__dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="dlk-code__file">slide 26 · hover a name</span>
          </figcaption>
          <pre className="dlk-code__pre"><code className="dlk-code__code">
            <span className="dlk-code__line">
              {CODE.map((tk, i) => (tk.part ? (
                <button
                  key={i}
                  type="button"
                  className={`dl8s-lk__tok ${tk.cls}${part === tk.part ? ' dl8s-lk__tok--on' : ''}`}
                  onPointerEnter={() => setPart(tk.part)}
                  onPointerLeave={() => setPart(null)}
                  onFocus={() => setPart(tk.part)}
                  onBlur={() => setPart(null)}
                >
                  {tk.t}
                </button>
              ) : <span key={i}>{tk.t}</span>))}
            </span>
          </code></pre>
        </figure>
        <div className="dl8s-lk__say" aria-live="polite">{part ? <MLine text={PART_SAY[part]} /> : <p className="dl8s-mline">&nbsp;</p>}</div>
      </div>
    </Stage>
  );
}
