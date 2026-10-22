import { useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Token, Grid, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { attention, softmax, transpose, rng, dot, fmt, fmtVec, pct } from '../attn';
import { maxAbs } from '../svgFill';
import { EN, ES, Q4, K3, V3 } from '../toys';

/* ============================================================================
   §11 · SCALED DOT-PRODUCT ATTENTION  (slides 37–38)
   ----------------------------------------------------------------------------
   FourMovesLab   the formula as four moves on tiny heatmaps, laid out as
                  matrix products (Q on the left, Kᵀ on top; the weights on
                  the left, V on top): QKᵀ → ÷ √d_keys → softmax (every row
                  adds up to 1) → × V. 4 queries (the Spanish words) against
                  3 keys/values (the English words), d_keys = d_values = 4.
                  Opens finished, with the "fútbol" row traced through.
   SaturateLab    why the 1/√d_keys: one query against three keys, random
                  vectors of d_keys numbers (this page's own). Drag d_keys up
                  and the unscaled softmax snaps to one key (saturates) while
                  the scaled one stays soft.
   ========================================================================== */

const BEATS = [
  { label: 'QKᵀ', say: 'Each query row meets each key: one similarity score per query/key pair, in a $[n_{\\text{queries}}, n_{\\text{keys}}]$ grid.' },
  { label: '÷ √d_keys', say: 'Every score is divided by $\\sqrt{d_{\\text{keys}}} = \\sqrt{4} = 2$: the same picture, quieter.' },
  { label: 'softmax', say: 'Softmax works along each row, so every row of weights adds up to 1.' },
  { label: '× V', say: 'Each output row is the weighted sum of the value rows: $[n_{\\text{queries}}, d_{\\text{values}}]$.' },
];

const A = attention(Q4, K3, V3);
const KT = transpose(K3);
const SMAX = maxAbs(A.scores);
const QMAX = Math.max(maxAbs(Q4), maxAbs(K3));

function geom(narrow) {
  if (narrow) {
    const c = 27;
    return {
      narrow, c, W: 330, H: 600,
      q: [62, 168], kt: [184, 40], s: [184, 168], sums: [184 + 3 * c + 8, 168],
      w2: [62, 446], v: [174, 446 - 14 - 3 * c], out: [174, 446],
    };
  }
  const c = 32;
  return {
    narrow, c, W: 580, H: 366,
    q: [84, 198], kt: [234, 48], s: [234, 198], sums: [234 + 3 * c + 8, 198],
    w2: null, v: [396, 198 - 22 - 3 * c], out: [396, 198],
  };
}

function Caption({ x, y, name, dims, anchor = 'start' }) {
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor} className="dl8s-t dl8s-t--b">{name}</text>
      <text x={x} y={y + 14} textAnchor={anchor} className="dl8s-t dl8s-t--xs dl8s-t--m">{dims}</text>
    </g>
  );
}

export function FourMovesLab() {
  const wrap = useRef(null);
  const G = geom(useWidth(wrap) < 500);
  const { c } = G;
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [row, setRow] = useState(3);
  const [hover, setHover] = useState(null);

  // what the middle grid shows at each beat
  const mid = beat <= 0 ? A.scores : beat === 1 ? A.scaled : A.weights;
  const midIsWeights = beat >= 2;
  const showMid = beat >= 0;
  const showOut = beat >= 3;
  const hitRow = hover && hover.grid === 's' ? hover.i : row;
  const hitCol = hover && hover.grid === 's' && beat <= 1 ? hover.j : null;
  const rowTokW = G.narrow ? 50 : 56;

  const tipFor = (h) => {
    if (!h) return null;
    const g = { q: [G.q, Q4], kt: [G.kt, KT], v: [G.v, V3], out: [G.out, A.out], s: [G.s, mid], w2: [G.w2, A.weights] }[h.grid];
    if (!g || !g[0]) return null;
    const [[gx, gy]] = g;
    const text = h.grid === 's' && beat === 0 ? `${ES[h.i]} · ${EN[h.j]} = ${fmt(h.v)}` : fmt(h.v);
    return <Tip x={gx + h.j * c + c / 2} y={gy + h.i * c} text={text} />;
  };
  const hov = (grid) => (x) => setHover(x ? { ...x, grid } : null);

  return (
    <Stage
      title="Attention in four moves"
      slides="slides 37–38"
      tryThis="Predict which English word “el” draws on most, then click “el” and press ▶ to watch its row go through the four moves."
      story={<StoryBar story={story} beats={BEATS} />}
      maths={
        <>
          <MEq tex={'\\text{Attention}(\\mathbf{Q},\\mathbf{K},\\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^\\top}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}'} />
          <MLine text={`Shapes here: $\\mathbf{Q}$ $[n_{\\text{queries}}, d_{\\text{keys}}] = [4, 4]$, $\\mathbf{K}$ $[n_{\\text{keys}}, d_{\\text{keys}}] = [3, 4]$, $\\mathbf{V}$ $[n_{\\text{keys}}, d_{\\text{values}}] = [3, 4]$, so $\\mathbf{Q}\\mathbf{K}^\\top$ is $[4, 3]$ and the output $[4, 4]$.`} />
          <MLine text={`Row “${ES[row]}”: scores $${fmtVec(A.scores[row])}$ → ÷ 2 → $${fmtVec(A.scaled[row])}$ → softmax → $${fmtVec(A.weights[row])}$ (sum 1).`} />
          <MLine text={`Output row $= ${A.weights[row].map((w, j) => `${fmt(w)}\\,\\mathbf{v}_{\\text{${EN[j]}}}`).join(' + ')} = ${fmtVec(A.out[row])}$.`} />
          <p className="dl8s-mnote">Q, K and V are this page’s own toy numbers (the values reuse §6’s encoder outputs). Here the queries come from the Spanish words and the keys and values from the English ones: the decoder’s cross-attention (§13).</p>
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl8s-svg" viewBox={`0 0 ${G.W} ${G.H}`} style={G.narrow ? undefined : { maxWidth: 760 }} role="group" aria-label={`Scaled dot-product attention, beat ${Math.max(beat, 0) + 1} of 4. Row ${ES[row]}: weights ${A.weights[row].map((w, j) => `${EN[j]} ${pct(w)}`).join(', ')}`}>
          {/* Kᵀ on top, with the key words over its columns */}
          {EN.map((w, j) => (
            <text key={w} x={G.kt[0] + j * c + c / 2 - 2} y={G.kt[1] - 8} transform={`rotate(-38 ${G.kt[0] + j * c + c / 2 - 2} ${G.kt[1] - 8})`} className="dl8s-t dl8s-t--s dl8s-t--enc">{w}</text>
          ))}
          <Grid x={G.kt[0]} y={G.kt[1]} M={KT} c={c} role="k" max={QMAX} hlCol={hitCol} onHover={hov('kt')} />
          <Caption x={G.kt[0] - 12} y={G.kt[1] + 2 * c - 4} name="Kᵀ" dims="K: 3 × 4" anchor="end" />

          {/* Q on the left, its rows = the Spanish words (click one) */}
          {ES.map((w, i) => (
            <Token key={w} x={G.q[0] - rowTokW / 2 - 8} y={G.q[1] + i * c + c / 2} w={rowTokW} h={c - 6} word={w} role="dec" on={i === row} onPick={() => setRow(i)} label={`Trace the query row “${w}”`} />
          ))}
          <Grid x={G.q[0]} y={G.q[1]} M={Q4} c={c} role="q" max={QMAX} hlRow={hitRow} onHover={hov('q')} />
          <Caption x={G.q[0]} y={G.q[1] + 4 * c + 18} name="Q" dims="4 × 4" />

          {/* the middle grid: scores → scaled → weights */}
          <Grid
            x={G.s[0]}
            y={G.s[1]}
            M={showMid ? mid : mid.map((r) => r.map(() => 0))}
            c={c}
            role={midIsWeights ? 'w' : 's'}
            weights={midIsWeights}
            max={SMAX}
            hlRow={hitRow}
            onHover={hov('s')}
          />
          <Caption x={G.s[0]} y={G.s[1] + 4 * c + 18} name={midIsWeights ? 'weights' : beat === 1 ? 'QKᵀ / √d_keys' : 'QKᵀ'} dims="4 × 3" />
          <g className={`dl8s-fade${midIsWeights ? '' : ' dl8s-hide'}`}>
            {A.weights.map((_, i) => (
              <text key={i} x={G.sums[0]} y={G.sums[1] + i * c + c / 2 + 4} className="dl8s-t dl8s-t--xs dl8s-t--m">= 1</text>
            ))}
          </g>
          <g className={`dl8s-fade${beat === 1 ? '' : ' dl8s-hide'}`}>
            <text x={G.sums[0]} y={G.s[1] + 2 * c + 4} className="dl8s-t dl8s-t--b dl8s-t--q">÷ 2</text>
          </g>

          {/* narrow: the weights again, as the left operand of × V */}
          {G.w2 && (
            <g className={`dl8s-fade${showOut ? '' : ' dl8s-dim'}`}>
              {ES.map((w, i) => (
                <text key={w} x={G.w2[0] - 8} y={G.w2[1] + i * c + c / 2 + 4} textAnchor="end" className={`dl8s-t dl8s-t--s dl8s-t--dec${i === row ? ' dl8s-t--b' : ''}`}>{w}</text>
              ))}
              <Grid x={G.w2[0]} y={G.w2[1]} M={A.weights} c={c} role="w" weights hlRow={row} onHover={hov('w2')} />
              <Caption x={G.w2[0]} y={G.w2[1] + 4 * c + 18} name="weights" dims="4 × 3" />
            </g>
          )}

          {/* V on top of the output, its rows = the English words */}
          {EN.map((w, j) => (
            <text key={w} x={G.v[0] - 8} y={G.v[1] + j * c + c / 2 + 4} textAnchor="end" className="dl8s-t dl8s-t--s dl8s-t--enc">{w}</text>
          ))}
          <Grid x={G.v[0]} y={G.v[1]} M={V3} c={c} role="v" max={1} onHover={hov('v')} />
          <Caption x={G.v[0] + 4 * c + 10} y={G.v[1] + c} name="V" dims="3 × 4" />

          <Grid x={G.out[0]} y={G.out[1]} M={showOut ? A.out : A.out.map((r) => r.map(() => 0))} c={c} role="v" max={1} hlRow={showOut ? row : null} onHover={hov('out')} />
          <Caption x={G.out[0]} y={G.out[1] + 4 * c + 18} name="output" dims="4 × 4" />

          {tipFor(hover)}
        </svg>
      </div>
    </Stage>
  );
}

/* ── why divide by √d_keys ───────────────────────────────────────────── */
const DMAX = 512;
const R = rng(20261022);
const QV = Array.from({ length: DMAX }, () => R.normal());
const KV = [0, 1, 2].map(() => Array.from({ length: DMAX }, () => R.normal()));
const KEYS = ['k₁', 'k₂', 'k₃'];
const raw = (d) => KV.map((k) => dot(QV.slice(0, d), k.slice(0, d)));
const L2 = (d) => Math.log2(d);

function Bars({ x, y, h, ws, title, sub, bw = 34, gap = 16 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-30} className="dl8s-t dl8s-t--b">{title}</text>
      <text x={0} y={-15} className="dl8s-t dl8s-t--xs dl8s-t--m">{sub}</text>
      <line x1={-6} y1={h} x2={3 * (bw + gap) - gap + 6} y2={h} stroke="var(--line)" />
      {ws.map((w, j) => (
        <g key={j}>
          <rect x={j * (bw + gap)} y={0} width={bw} height={h} rx={4} fill="var(--line-2)" opacity={0.5} />
          <rect
            className="dl8s-sbar"
            x={j * (bw + gap)}
            y={0}
            width={bw}
            height={h}
            rx={4}
            style={{ transformOrigin: `0px ${h}px`, transform: `scaleY(${Math.max(0.004, w)})` }}
          />
          <text x={j * (bw + gap) + bw / 2} y={h + 16} textAnchor="middle" className="dl8s-t dl8s-t--s">{KEYS[j]}</text>
        </g>
      ))}
    </g>
  );
}

export function SaturateLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 500;
  const [d, setD] = useState(4);
  const [drag, setDrag] = useState(false);
  const svgRef = useRef(null);
  const s = useMemo(() => raw(d), [d]);
  const un = softmax(s);
  const sc = softmax(s.map((x) => x / Math.sqrt(d)));
  const sat = Math.max(...un) > 0.99;

  // the d_keys scrubber: log₂ scale from 2 to 512
  const X0 = narrow ? 44 : 60;
  const X1 = narrow ? 316 : 500;
  const toX = (v) => X0 + ((L2(v) - 1) / (L2(DMAX) - 1)) * (X1 - X0);
  const fromX = (px) => Math.round(2 ** (1 + ((Math.max(X0, Math.min(X1, px)) - X0) / (X1 - X0)) * (L2(DMAX) - 1)));
  const onPtr = (e) => {
    const pt = svgPoint(e, svgRef.current);
    if (pt) setD(fromX(pt.x));
  };
  const onKey = (e) => {
    const k = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: 0.5, ArrowDown: 0.5 }[e.key];
    if (k) { e.preventDefault(); setD((v) => Math.max(2, Math.min(DMAX, Math.round(v * k)))); }
    else if (e.key === 'Home') { e.preventDefault(); setD(2); }
    else if (e.key === 'End') { e.preventDefault(); setD(DMAX); }
  };

  return (
    <Stage
      title="Why divide by √d_keys?"
      slides="slide 38"
      tryThis="Predict what happens to the left bars as the vectors get longer, then drag d_keys to the right."
      caption="A softmax that snaps to one key is saturated, which would lead to tiny gradients (slide 38)."
      challenge={{ text: 'Find a d_keys where the unscaled softmax saturates (its top weight passes 0.99).', done: sat }}
      own="random query and keys · this page’s own"
      maths={
        <>
          <MLine text={`$d_{\\text{keys}} = ${d}$, so $\\sqrt{d_{\\text{keys}}} = ${fmt(Math.sqrt(d))}$. Dot products $\\mathbf{q}\\cdot\\mathbf{k}_j$: $${fmtVec(s)}$.`} />
          <MLine text={`softmax of the raw scores: $${fmtVec(un, 3)}$. softmax of the scores $\\div\\sqrt{d_{\\text{keys}}}$: $${fmtVec(sc, 3)}$.`} />
          <MLine text={'Each vector here has $d_{\\text{keys}}$ random numbers (this page’s own). Longer vectors give dot products that spread further apart, so the raw softmax piles almost all its weight on one key; dividing by $\\sqrt{d_{\\text{keys}}}$ keeps the spread, and the weights, moderate. The slides state the reason (avoid saturating the softmax); the random vectors are this page’s illustration.'} />
        </>
      }
    >
      <div ref={wrap}>
      <svg ref={svgRef} className="dl8s-svg" viewBox={narrow ? '0 0 340 300' : '0 0 560 300'} style={{ maxWidth: 640 }} role="group" aria-label={`d_keys ${d}: unscaled weights ${un.map(pct).join(', ')}; scaled weights ${sc.map(pct).join(', ')}`}>
        {narrow ? (
          <>
            <Bars x={24} y={64} h={130} ws={un} title="softmax(q · k)" sub="no scaling" bw={28} gap={12} />
            <Bars x={196} y={64} h={130} ws={sc} title="÷ √d_keys first" sub="slide 37’s formula" bw={28} gap={12} />
          </>
        ) : (
          <>
            <Bars x={60} y={64} h={130} ws={un} title="softmax(q · k)" sub="no scaling" />
            <Bars x={330} y={64} h={130} ws={sc} title="softmax(q · k / √d_keys)" sub="slide 37’s formula" />
          </>
        )}
        {sat && <text x={narrow ? 24 : 60} y={238} className="dl8s-t dl8s-t--s dl8s-t--q">saturated</text>}

        {/* d_keys scrubber */}
        <g
          className={`dl8s-scrub${drag ? ' dl8s-scrub--drag' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label="d_keys, the length of the query and key vectors"
          aria-valuemin={2}
          aria-valuemax={DMAX}
          aria-valuenow={d}
          onKeyDown={onKey}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); onPtr(e); }}
          onPointerMove={(e) => { if (drag) onPtr(e); }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <rect x={X0 - 12} y={250} width={X1 - X0 + 24} height={40} fill="transparent" />
          <line x1={X0} y1={268} x2={X1} y2={268} className="dl8s-scrub__track" />
          {[2, 8, 32, 128, 512].map((v) => (
            <g key={v}>
              <line x1={toX(v)} y1={263} x2={toX(v)} y2={273} stroke="var(--ink-3)" />
              <text x={toX(v)} y={292} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">{v}</text>
            </g>
          ))}
          {!narrow && <text x={X0 - 14} y={272} textAnchor="end" className="dl8s-t dl8s-t--s dl8s-t--m">d_keys</text>}
          <g style={{ transform: `translateX(${toX(d)}px)` }} className="dl8s-scrub__knob">
            <circle cx={0} cy={268} r={9} />
            <text x={0} y={250} textAnchor="middle" className="dl8s-t dl8s-t--b dl8s-t--m">{narrow ? `d_keys = ${d}` : d}</text>
          </g>
        </g>
      </svg>
      </div>
    </Stage>
  );
}
