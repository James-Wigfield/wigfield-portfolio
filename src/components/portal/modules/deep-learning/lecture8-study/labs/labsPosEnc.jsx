import { useId, useMemo, useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../stage';
import { Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { fmt, PE_BASE } from '../attn';
import { Code } from '../../kit';
import { Rich } from '../Rich';
import { peMatrix, peMasks, peAt, pePeriod, PE_LEN, PE_D, PE_XS } from './posEncMaps';
import './labsPosEnc.css';

/* ============================================================================
   §10 · POSITIONAL ENCODINGS: THE WAVE ORGAN  (slides 32–36, Figure 16-9)
   ----------------------------------------------------------------------------
   Figure 16-9, live. Bottom: the positional-encoding matrix P as a heatmap
   (x = position p, y = dimension i, 0 at the bottom; --dl8s-pos positive,
   --dl8s-neg negative). Top: the waves of one dimension pair (sin in the
   even row, cos in the odd row, same period), opening on the figure's
   i = 100 and 101. A dashed line marks position p; that column, pulled out
   on the right, is p's fingerprint. Low rows wiggle fast, high rows slowly,
   so every column is different (slide 33).
     drag / click the heatmap   crosshair: the column p and the row pair
     the p handle (← →)         scrub the position
     the i handle (↑ ↓)         pick the dimension pair
     the switch                 slide 35's code (base 10_000, default) or
                                slide 32's formula as typeset (base 1000)
   200 positions × d = 512 are this page's own choice (the slides give no d).
   ========================================================================== */

const VARIANTS = [
  { key: 'code', label: 'slide 35’s code: 10_000' },
  { key: 'slide', label: 'slide 32’s formula: 1000' },
];
const BASE_TEX = { code: '10000', slide: '1000' };

// slide 35, the four lines that build P (verbatim; indented as on the slide,
// less the 8 spaces of the method body)
const SLIDE35 = `p, i = np.meshgrid(np.arange(max_length),
                   2 * np.arange(embed_size // 2))
pos_emb = np.empty((1, max_length, embed_size))
pos_emb[0, :, ::2] = np.sin(p / 10_000 ** (i / embed_size)).T
pos_emb[0, :, 1::2] = np.cos(p / 10_000 ** (i / embed_size)).T`;

const SLIDE32_TEX = '\\mathbf{P}_{p,i} = \\begin{cases} \\sin\\left(p/1000^{i/d}\\right) & \\text{if } i \\text{ is even} \\\\ \\cos\\left(p/1000^{(i-1)/d}\\right) & \\text{if } i \\text{ is odd} \\end{cases}';

function layout(narrow) {
  if (narrow) {
    return { narrow, W: 360, H: 346, HX: 30, HW: 262, WY: 26, WH: 64, HY: 112, HH: 196, SX: 304, SW: 18, AY: 322 };
  }
  return { narrow, W: 760, H: 482, HX: 64, HW: 520, WY: 26, WH: 100, HY: 148, HH: 288, SX: 606, SW: 26, AY: 448 };
}

const clampP = (v) => Math.max(0, Math.min(PE_LEN - 1, v));
const clampK = (v) => Math.max(0, Math.min(PE_D / 2 - 1, v));

export function WaveOrganLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const L = layout(useWidth(wrap) < 520);
  const [variant, setVariant] = useState('code');
  const [p, setP] = useState(22);
  const [k, setK] = useState(50); // the dimension pair (2k, 2k + 1): opens on i = 100, 101
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const P = peMatrix(variant);
  const masks = useMemo(() => peMasks(variant, L.HH), [variant, L.HH]);

  const i0 = 2 * k;
  const i1 = i0 + 1;
  const dx = L.HW / PE_LEN;
  const dy = L.HH / PE_D;
  const xOf = (pp) => L.HX + (pp + 0.5) * dx;
  const yOf = (i) => L.HY + L.HH - (i + 0.5) * dy;
  const cy = L.WY + L.WH / 2;
  const amp = L.WH / 2 - 5;

  const waves = useMemo(() => {
    const n = Math.round(L.HW * 1.6);
    const path = (i) => {
      let d = '';
      for (let s = 0; s <= n; s++) {
        const pp = (s / n) * (PE_LEN - 1);
        d += `${s ? 'L' : 'M'}${(L.HX + (pp + 0.5) * (L.HW / PE_LEN)).toFixed(1)} ${(cy - amp * peAt(pp, i, variant)).toFixed(1)}`;
      }
      return d;
    };
    return [path(i0), path(i1)];
  }, [i0, i1, variant, L.HX, L.HW, cy, amp]);

  const v0 = P[p][i0];
  const v1 = P[p][i1];
  const base = PE_BASE[variant];
  const B = BASE_TEX[variant];
  const angle = p / base ** (i0 / PE_D);

  // pointer: the heatmap is a crosshair; the wave panel and the p handle move p; the i handle moves the pair
  const at = (e) => svgPoint(e, svgRef.current);
  const pFrom = (pt) => clampP(Math.round((pt.x - L.HX) / dx - 0.5));
  const iFrom = (pt) => Math.max(0, Math.min(PE_D - 1, Math.floor((L.HY + L.HH - pt.y) / dy)));
  const apply = (mode, e) => {
    const pt = at(e);
    if (!pt) return;
    if (mode === 'heat' || mode === 'wave' || mode === 'p') setP(pFrom(pt));
    if (mode === 'heat' || mode === 'i') setK(clampK(Math.floor(iFrom(pt) / 2)));
  };
  const grab = (mode) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(mode); apply(mode, e); },
    onPointerMove: (e) => {
      if (drag === mode) apply(mode, e);
      if (mode === 'heat') {
        const pt = at(e);
        if (pt) setHover({ p: pFrom(pt), i: iFrom(pt), x: pt.x, y: pt.y });
      }
    },
    onPointerUp: () => setDrag(null),
    onPointerCancel: () => setDrag(null),
    ...(mode === 'heat' ? { onPointerLeave: () => setHover(null) } : {}),
  });
  const keysP = (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d !== undefined) { e.preventDefault(); setP((v) => clampP(v + d)); }
    else if (e.key === 'Home') { e.preventDefault(); setP(0); }
    else if (e.key === 'End') { e.preventDefault(); setP(PE_LEN - 1); }
  };
  const keysI = (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 16, PageDown: -16 }[e.key];
    if (d !== undefined) { e.preventDefault(); setK((v) => clampK(v + d)); }
    else if (e.key === 'Home') { e.preventDefault(); setK(0); }
    else if (e.key === 'End') { e.preventDefault(); setK(PE_D / 2 - 1); }
  };

  const ticksP = L.narrow ? [0, 50, 100, 150, 200] : [0, 25, 50, 75, 100, 125, 150, 175, 200];
  const ticksI = L.narrow ? [0, 256, 511] : [0, 100, 200, 300, 400, 500];
  const heatmap = (vb) => (
    <svg x={vb.x} y={L.HY} width={vb.w} height={L.HH} viewBox={vb.box} preserveAspectRatio="none" aria-hidden="true">
      <rect width={PE_LEN * PE_XS} height={L.HH} className="dl8s-wave__ink dl8s-wave__ink--pos" mask={`url(#${uid}-pos)`} />
      <rect width={PE_LEN * PE_XS} height={L.HH} className="dl8s-wave__ink dl8s-wave__ink--neg" mask={`url(#${uid}-neg)`} />
    </svg>
  );

  return (
    <Stage
      title="Every position gets its own fingerprint"
      slides="slides 32–35 · Figure 16-9"
      tryThis="Predict whether the low or the high rows wiggle faster, click one of each, then drag p and watch its fingerprint change."
      caption="Fast waves in the low dimensions, slow ones in the high: every column is different, so *each position has a unique positional encoding* (slide 33)."
      challenge={{ text: 'Find the dimension whose wave repeats fastest.', done: k === 0 }}
      own="200 positions × d = 512 · this page’s own"
      maths={
        <>
          <MLine text="Slide 32’s formula (base 1000), for position $p$ and component $i$ of a $d$-dimensional vector:" />
          <MEq tex={SLIDE32_TEX} />
          <MLine text="Slide 35’s `PositionalEncoding` code uses the same formula with base `10_000`:" />
          <Code code={SLIDE35} label="slide 35 · PositionalEncoding (excerpt)" hl={[4, 5]} />
          <p className="dl8s-mnote"><Rich text="In the code, `i` steps by 2 (`2 * np.arange(embed_size // 2)`), so the cosine in column $2k+1$ uses the same exponent as the sine in column $2k$: slide 32’s $(i-1)/d$. The two agree on everything but the base, 1000 on slide 32 and `10_000` in slide 35’s code; the switch above draws either." /></p>
          <MLine text={`With ${variant === 'code' ? 'the code' : 'slide 32’s formula'}, $d = 512$, at $p = ${p}$: $\\mathbf{P}_{${p},${i0}} = \\sin\\big(${p}/${B}^{${i0}/512}\\big) = \\sin(${fmt(angle)}) = ${fmt(v0)}$ and $\\mathbf{P}_{${p},${i1}} = \\cos\\big(${p}/${B}^{(${i1}-1)/512}\\big) = ${fmt(v1)}$.`} />
          <MLine text={`This pair repeats every $2\\pi \\cdot ${B}^{${i0}/512} \\approx ${fmt(pePeriod(i0, variant), 1)}$ positions.`} />
          <p className="dl8s-mnote">The slides don’t give the size behind Figure 16-9; 200 positions × d = 512 are this page’s own choice.</p>
        </>
      }
    >
      <div ref={wrap} className="dl8s-wave">
        <div className="dl8s-wave__switch" role="group" aria-label="Which base to draw">
          {VARIANTS.map((o) => (
            <button key={o.key} type="button" className={`dl8s-wave__sw${variant === o.key ? ' dl8s-wave__sw--on' : ''}`} aria-pressed={variant === o.key} onClick={() => setVariant(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
        <svg
          ref={svgRef}
          className="dl8s-svg dl8s-wave__svg"
          viewBox={`0 0 ${L.W} ${L.H}`}
          role="group"
          aria-label={`Positional-encoding matrix, ${PE_LEN} positions by ${PE_D} dimensions. Position ${p}; dimension ${i0} is ${fmt(v0)}, dimension ${i1} is ${fmt(v1)}.`}
        >
          <defs>
            <mask id={`${uid}-pos`} maskUnits="userSpaceOnUse" x={0} y={0} width={PE_LEN * PE_XS} height={L.HH}>
              <image href={masks.pos} width={PE_LEN * PE_XS} height={L.HH} preserveAspectRatio="none" />
            </mask>
            <mask id={`${uid}-neg`} maskUnits="userSpaceOnUse" x={0} y={0} width={PE_LEN * PE_XS} height={L.HH}>
              <image href={masks.neg} width={PE_LEN * PE_XS} height={L.HH} preserveAspectRatio="none" />
            </mask>
          </defs>

          {/* ── top: the waves of the chosen pair ── */}
          <text x={L.HX} y={L.WY - 10} className="dl8s-t dl8s-t--xs dl8s-t--m">P(p, i)</text>
          {[-1, 0, 1].map((v) => (
            <g key={v}>
              <line x1={L.HX} x2={L.HX + L.HW} y1={cy - amp * v} y2={cy - amp * v} className={v === 0 ? 'dl8s-wave__zero' : 'dl8s-wave__grid'} />
              {!L.narrow && <text x={L.HX - 8} y={cy - amp * v + 3.5} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{v === -1 ? '−1' : v}</text>}
            </g>
          ))}
          <path d={waves[0]} className="dl8s-wave__curve" />
          <path d={waves[1]} className="dl8s-wave__curve dl8s-wave__curve--cos" />
          <rect x={L.HX} y={L.WY} width={L.HW} height={L.WH} fill="transparent" className="dl8s-wave__hit" {...grab('wave')} />
          {L.narrow ? (
            <g>
              <line x1={L.HX + 110} x2={L.HX + 126} y1={L.WY - 14} y2={L.WY - 14} className="dl8s-wave__curve" />
              <text x={L.HX + 130} y={L.WY - 10} className="dl8s-t dl8s-t--xs">i = {i0} sin</text>
              <line x1={L.HX + 192} x2={L.HX + 208} y1={L.WY - 14} y2={L.WY - 14} className="dl8s-wave__curve dl8s-wave__curve--cos" />
              <text x={L.HX + 212} y={L.WY - 10} className="dl8s-t dl8s-t--xs">i = {i1} cos</text>
            </g>
          ) : (
            <g>
              <line x1={L.HX + L.HW + 14} x2={L.HX + L.HW + 34} y1={cy - 14} y2={cy - 14} className="dl8s-wave__curve" />
              <text x={L.HX + L.HW + 40} y={cy - 10} className="dl8s-t dl8s-t--s">i = {i0} · sin</text>
              <line x1={L.HX + L.HW + 14} x2={L.HX + L.HW + 34} y1={cy + 12} y2={cy + 12} className="dl8s-wave__curve dl8s-wave__curve--cos" />
              <text x={L.HX + L.HW + 40} y={cy + 16} className="dl8s-t dl8s-t--s">i = {i1} · cos</text>
            </g>
          )}

          {/* ── bottom: the matrix P (x = p, y = i), and p's column pulled out ── */}
          <rect x={L.HX} y={L.HY} width={L.HW} height={L.HH} className="dl8s-wave__bed" />
          {heatmap({ x: L.HX, w: L.HW, box: `0 0 ${PE_LEN * PE_XS} ${L.HH}` })}
          <rect x={L.SX} y={L.HY} width={L.SW} height={L.HH} className="dl8s-wave__bed" />
          {heatmap({ x: L.SX, w: L.SW, box: `${p * PE_XS + 0.5} 0 ${PE_XS - 1} ${L.HH}` })}
          <rect x={L.SX - 0.5} y={L.HY - 0.5} width={L.SW + 1} height={L.HH + 1} rx={2} className="dl8s-wave__frame" />
          <text x={L.SX + L.SW / 2} y={L.HY - (L.narrow ? 7 : 20)} textAnchor="middle" className="dl8s-t dl8s-t--b dl8s-t--pos">p = {p}</text>
          {!L.narrow && <text x={L.SX + L.SW / 2} y={L.HY - 7} textAnchor="middle" className="dl8s-t dl8s-t--xs">fingerprint</text>}
          <text x={L.SX + L.SW + 6} y={L.HY + 10} className="dl8s-t dl8s-t--xs">slow{L.narrow ? '' : ' waves'}</text>
          <text x={L.SX + L.SW + 6} y={L.HY + L.HH - 2} className="dl8s-t dl8s-t--xs">fast{L.narrow ? '' : ' waves'}</text>

          {/* the chosen pair's rows, on the matrix and on the fingerprint */}
          <line x1={L.HX} x2={L.HX + L.HW} y1={yOf(i0 + 0.5)} y2={yOf(i0 + 0.5)} className="dl8s-wave__row" />
          <line x1={L.SX - 5} x2={L.SX + L.SW + 3} y1={yOf(i0 + 0.5)} y2={yOf(i0 + 0.5)} className="dl8s-wave__row" />

          {/* position p: dashed through both panels, dots on the waves */}
          <line x1={xOf(p)} x2={xOf(p)} y1={L.WY} y2={L.HY + L.HH} className="dl8s-wave__pline" />
          <circle cx={xOf(p)} cy={cy - amp * v0} r={4.5} className="dl8s-wave__dot" />
          <circle cx={xOf(p)} cy={cy - amp * v1} r={4.5} className="dl8s-wave__dot dl8s-wave__dot--cos" />

          <rect x={L.HX} y={L.HY} width={L.HW} height={L.HH} fill="transparent" className="dl8s-wave__hit dl8s-wave__hit--heat" {...grab('heat')} />

          {/* the i handle (left edge) */}
          <g
            className={`dl8s-wave__handle${drag === 'i' ? ' dl8s-wave__handle--drag' : ''}`}
            role="slider"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Dimension pair i (the sine row; the cosine row is i + 1)"
            aria-valuemin={0}
            aria-valuemax={PE_D - 2}
            aria-valuenow={i0}
            aria-valuetext={`i = ${i0} and ${i1}`}
            onKeyDown={keysI}
            {...grab('i')}
          >
            <rect x={L.HX - 16} y={L.HY - 6} width={16} height={L.HH + 12} fill="transparent" />
            <line x1={L.HX - 7} x2={L.HX - 7} y1={L.HY} y2={L.HY + L.HH} className="dl8s-wave__track" />
            <path d={`M${L.HX - 13} ${yOf(i0 + 0.5) - 6} L${L.HX - 2} ${yOf(i0 + 0.5)} L${L.HX - 13} ${yOf(i0 + 0.5) + 6} Z`} className="dl8s-wave__knob" />
          </g>
          {ticksI.map((v) => (
            <text key={v} x={L.HX - 19} y={yOf(v) + 3.5} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{v}</text>
          ))}
          {!L.narrow && (
            <text x={14} y={L.HY + L.HH / 2} textAnchor="middle" transform={`rotate(-90 14 ${L.HY + L.HH / 2})`} className="dl8s-t dl8s-t--s">dimension i</text>
          )}

          {/* the p handle (bottom edge) */}
          <g
            className={`dl8s-wave__handle${drag === 'p' ? ' dl8s-wave__handle--drag' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Position p"
            aria-valuemin={0}
            aria-valuemax={PE_LEN - 1}
            aria-valuenow={p}
            onKeyDown={keysP}
            {...grab('p')}
          >
            <rect x={L.HX - 6} y={L.AY - 12} width={L.HW + 12} height={24} fill="transparent" />
            <line x1={L.HX} x2={L.HX + L.HW} y1={L.AY} y2={L.AY} className="dl8s-wave__track" />
            <circle cx={xOf(p)} cy={L.AY} r={7.5} className="dl8s-wave__knob" />
          </g>
          {ticksP.map((v) => (
            <text key={v} x={L.HX + v * dx} y={L.AY + 22} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">{v}</text>
          ))}
          <text x={L.HX + L.HW + 12} y={L.AY + 4} className="dl8s-t dl8s-t--s">{L.narrow ? 'p' : 'position p'}</text>

          {hover && <Tip x={Math.min(L.HX + L.HW - 40, Math.max(L.HX + 40, hover.x))} y={hover.y - 6} text={`p ${hover.p} · i ${hover.i} · ${fmt(P[hover.p][hover.i])}`} />}
        </svg>
      </div>
    </Stage>
  );
}
