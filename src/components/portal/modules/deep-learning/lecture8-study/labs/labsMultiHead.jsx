import { useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Grid, Arrow, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { maxAbs } from '../svgFill';
import { fmtVec } from '../attn';
import { multiHead, WORDS, D_MODEL } from './multiHead';
import './labsMultiHead.css';

/* ============================================================================
   §12 · MULTI-HEAD ATTENTION  (slide 39, Figure 16-10)
   ----------------------------------------------------------------------------
   MultiHeadLab  Figure 16-10 as a left-to-right flow over "I like soccer"
                 (self-attention, d = 8): Linear (Q, K, V) → Split into H
                 parts → one scaled dot-product attention per head → Concat
                 → Linear. The heads' attention maps sit in the middle and
                 come out different from each other: the "aha" of slide 39
                 ("different characters of the words"). H = 1, 2 or 4.
                 All weights are the page's own seeded random toy values; a
                 trained model learns its own heads.
   ========================================================================== */

const BEATS = [
  { label: 'Linear', say: 'Each of V, K and Q goes through its own Linear layer.' },
  { label: 'Split', say: 'Each is split into H parts, one per head (Figure 16-10’s Split boxes).' },
  { label: 'attend', say: 'Every head runs scaled dot-product attention on its own part, so each head gets its own map.' },
  { label: 'Concat', say: 'The heads’ outputs are concatenated back to the full width (the Concat box).' },
  { label: 'Linear', say: 'A final Linear layer mixes them: one output row per word.' },
];

function Sliced({ x, y, M, c, role, H, split, label, max }) {
  const dh = D_MODEL / H;
  const gap = split ? 5 : 0;
  return (
    <g>
      <text x={x - 8} y={y + 1.5 * c + 4} textAnchor="end" className={`dl8s-t dl8s-t--b dl8s-t--${role}`}>{label}</text>
      {Array.from({ length: H }, (_, h) => (
        <g key={h} className="dl8s-mh__slice" style={{ transform: `translateX(${h * gap}px)` }}>
          <Grid x={x + h * dh * c} y={y} M={M.map((r) => r.slice(h * dh, (h + 1) * dh))} c={c} role={role} max={max} frame={split} />
        </g>
      ))}
    </g>
  );
}

export function MultiHeadLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [H, setH] = useState(2);
  const [hover, setHover] = useState(null);
  const r = useMemo(() => multiHead(H), [H]);
  const qkvMax = Math.max(maxAbs(r.Q), maxAbs(r.K), maxAbs(r.V));
  const outMax = maxAbs(r.out);
  const catMax = maxAbs(r.concat);

  const c = narrow ? 10 : 13;
  const mc = narrow ? (H === 4 ? 17 : 22) : (H === 4 ? 20 : 26);
  const W = narrow ? 370 : 780;
  const H_ = narrow ? 386 : 262;
  // column anchors
  const L = narrow
    ? { qkv: [40, 20], maps: [40, 196], cat: [40, 330], out: [210, 330], flowY: 22 }
    : { qkv: [44, 80], maps: [256, 104], cat: [560, 104], out: [672, 104], flowY: 30 };
  const mapsW = H * mc * 3 + (H - 1) * 16;
  const show = (k) => beat >= k;

  const FLOW = narrow
    ? []
    : [
      { label: 'V K Q → Linear', x: 44, w: 120, k: 0 },
      { label: 'Split', x: 174, w: 56, k: 1 },
      { label: `Scaled Dot-Product Attention × ${H}`, x: 250, w: Math.max(250, mapsW), k: 2 },
      { label: 'Concat', x: 560, w: 96, k: 3 },
      { label: 'Linear', x: 680, w: 84, k: 4 },
    ];

  return (
    <Stage
      title="Several heads, several views"
      slides="slide 39 · Figure 16-10"
      tryThis="Predict whether two heads draw the same map, press ▶, then try H = 4."
      story={<StoryBar story={story} beats={BEATS} />}
      caption="Each head attends with its own slice, so the heads can pick up different things about the same words."
      own="random toy weights · this page’s own (d = 8)"
      maths={
        <>
          <MLine text={`Here: 3 words × ${D_MODEL} numbers. $\\mathbf{Q}$, $\\mathbf{K}$, $\\mathbf{V}$ each $[3, ${D_MODEL}]$ after their Linear layers; split into $H = ${H}$ parts of $[3, ${r.dHead}]$.`} />
          <MEq tex={`\\text{head}_h = \\text{softmax}\\left(\\frac{\\mathbf{Q}_h\\mathbf{K}_h^{\\top}}{\\sqrt{${r.dHead}}}\\right)\\mathbf{V}_h`} />
          <MLine text={`Each head’s map is $[3, 3]$ and its output $[3, ${r.dHead}]$; Concat gives $[3, ${D_MODEL}]$ again, and the final Linear keeps $[3, ${D_MODEL}]$.`} />
          <MLine text={`Head 1’s weights for “like”: $${fmtVec(r.heads[0].weights[1])}$${H > 1 ? `; head 2’s: $${fmtVec(r.heads[1].weights[1])}$` : ''}.`} />
          <p className="dl8s-mnote">The per-head formula is §11’s scaled dot-product attention applied to one part, with d_keys = {r.dHead} (this page’s notation for the head; Figure 16-10 draws it as the stack of H boxes).</p>
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl8s-switch" role="group" aria-label="Number of heads H">
          {[1, 2, 4].map((h) => (
            <button key={h} type="button" className={`dl8s-switch__opt${h === H ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={h === H} onClick={() => setH(h)}>H = {h}</button>
          ))}
        </div>
        <svg className="dl8s-svg" viewBox={`0 0 ${W} ${H_}`} role="group" aria-label={`Multi-head attention with ${H} heads over I like soccer`}>
          {/* Figure 16-10, flowing left to right */}
          {FLOW.map((f, i) => (
            <g key={f.label} className={`dl8s-mh__box${beat === f.k ? ' dl8s-mh__box--now' : ''}`}>
              <rect x={f.x} y={L.flowY - 14} width={f.w} height={24} rx={5} />
              <text x={f.x + f.w / 2} y={L.flowY + 3} textAnchor="middle" className="dl8s-t dl8s-t--s">{f.label}</text>
              {i > 0 && <Arrow x1={FLOW[i - 1].x + FLOW[i - 1].w + 2} y1={L.flowY - 2} x2={f.x - 3} y2={L.flowY - 2} />}
            </g>
          ))}

          {/* Q, K, V after their Linear layers; split into H parts */}
          <g className={`dl8s-fade${show(0) ? '' : ' dl8s-dim'}`}>
            {[['q', 'Q', r.Q], ['k', 'K', r.K], ['v', 'V', r.V]].map(([role, name, M], n) => (
              <Sliced key={name} x={L.qkv[0]} y={L.qkv[1] + n * (3 * c + 16)} M={M} c={c} role={role} H={H} split={show(1)} label={name} max={qkvMax} />
            ))}
          </g>

          {/* one attention map per head */}
          <g className={`dl8s-fade${show(2) ? '' : ' dl8s-hide'}`}>
            {r.heads.map((a, h) => {
              const x = L.maps[0] + h * (3 * mc + 16);
              return (
                <g key={h}>
                  <text x={x + 1.5 * mc} y={L.maps[1] - 34} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--b">head {h + 1}</text>
                  {WORDS.map((w, j) => (
                    <text key={w} x={x + j * mc + mc / 2 - 2} y={L.maps[1] - 5} transform={`rotate(-40 ${x + j * mc + mc / 2 - 2} ${L.maps[1] - 5})`} className="dl8s-t dl8s-t--xs">{w}</text>
                  ))}
                  <Grid
                    x={x}
                    y={L.maps[1]}
                    M={a.weights}
                    c={mc}
                    role="w"
                    weights
                    hlRow={1}
                    rowLabels={h === 0 ? WORDS : undefined}
                    colLabels={undefined}
                    onHover={(x2) => setHover(x2 ? { ...x2, h } : null)}
                  />
                </g>
              );
            })}
          </g>

          {/* concat, then the final Linear */}
          <g className={`dl8s-fade${show(3) ? '' : ' dl8s-hide'}`}>
            <text x={L.cat[0]} y={L.cat[1] - 10} className="dl8s-t dl8s-t--xs">concat [3, 8]</text>
            <Sliced x={L.cat[0]} y={L.cat[1]} M={r.concat} c={c} role="v" H={H} split={false} label="" max={catMax} />
          </g>
          <g className={`dl8s-fade${show(4) ? '' : ' dl8s-hide'}`}>
            <text x={L.out[0]} y={L.out[1] - 10} className="dl8s-t dl8s-t--xs">output [3, 8]</text>
            <Grid x={L.out[0]} y={L.out[1]} M={r.out} c={c} role="v" max={outMax} />
          </g>
          {hover && (
            <Tip x={L.maps[0] + hover.h * (3 * mc + 16) + hover.j * mc + mc / 2} y={L.maps[1] + hover.i * mc} text={`${WORDS[hover.i]} → ${WORDS[hover.j]}: ${Math.round(hover.v * 100)}%`} />
          )}
        </svg>
      </div>
    </Stage>
  );
}
