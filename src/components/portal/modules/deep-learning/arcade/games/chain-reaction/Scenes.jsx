import { G, EDGES, BIASES, param, seg, arrowHead, glyphPath, plotter, INSET } from './layout.js';
import { fmt, PHI, DPHI, curve, subDigit } from '../../maths/chainReaction.js';
import { ACTIVATIONS, HEAD, LABELS } from '../../content/chain-reaction.js';

/* ============================================================================
   CHAIN REACTION — THE PICTURES
   ----------------------------------------------------------------------------
   NetGraph       the tiny MLP as a computation graph (left → right): blue
                  sparks for the forward pass, orange for gradients flowing
                  back, a pulsing ring on the quantity being asked
   ActInset       the hidden activation's curve with z marked (read h off it)
   CollapseScene  slide 23: layers with their activation removed merge into
                  one linear layer
   CurveScene     one curve from Figure 10-8 (left or right panel)
   CardScene      a task card + the output layer the player is building
   Ledger         the reverse pass so far, as a ruled strip
   Every number comes from the item (maths/chainReaction.js); every label
   from content/chain-reaction.js. Styles: chain-reaction.css (.dla-cr*).
   ========================================================================== */

const S = ['₁', '₂'];
const CW = 440;   // the collapse and curve scenes' viewBox width

export function NetGraph({ stage, reveal = null }) {
  const { net, vals, show, target, hot, flow, update, dim } = stage;
  const dir = flow === 'fwd' ? 1 : flow === 'bwd' ? -1 : 0;
  const grad = flow === 'bwd' || flow === 'update';
  const q = (key) => (target === key ? (reveal !== null ? fmt(reveal) : '?') : null);
  const actLabel = ACTIVATIONS[net.act]?.label ?? net.act;
  const aria = [
    `Computation graph: inputs x₁ = ${fmt(net.x[0])}, x₂ = ${fmt(net.x[1])}; two ${actLabel} hidden neurons; one linear output ŷ.`,
    stage.scene ?? '',
    target ? `The pulsing mark is the value being asked for.` : '',
  ].join(' ').trim();

  return (
    <svg className={`dla-svg dla-cr__graph${dim ? ' dla-cr__graph--dim' : ''}${flow ? ` dla-cr__graph--${flow}` : ''}`} viewBox={`0 0 ${G.w} ${G.h}`} role="img" aria-label={aria}>
      {/* connections */}
      {EDGES.map((e) => {
        const s = seg(e.a, e.b, e.ra, e.rb);
        const isHot = hot.includes(e.id);
        const cls = isHot ? (grad ? ' dla-cr__edge--grad' : ' dla-cr__edge--hot') : '';
        return (
          <g key={e.id}>
            <line className={`dla-cr__edge${cls}`} {...s} />
            {isHot && dir !== 0 && <line className={`dla-cr__spark dla-cr__spark--${dir > 0 ? 'fwd' : 'bwd'}`} x1={dir > 0 ? s.x1 : s.x2} y1={dir > 0 ? s.y1 : s.y2} x2={dir > 0 ? s.x2 : s.x1} y2={dir > 0 ? s.y2 : s.y1} />}
            {isHot && dir !== 0 && <polygon className={`dla-cr__arrow${dir < 0 ? ' dla-cr__arrow--grad' : ''}`} points={arrowHead(s, dir > 0 ? 0.7 : 0.3, dir)} />}
          </g>
        );
      })}
      {/* weight labels (after the lines so the halo covers them) */}
      {EDGES.map((e) => {
        const isHot = hot.includes(e.id);
        const upd = update && (update.all ? update.to?.[e.id] !== undefined : update.key === e.id);
        return (
          <g key={`l-${e.id}`}>
            <text className={`dla-t dla-halo dla-cr__wl${isHot ? ' dla-cr__wl--hot' : ''}`} x={e.at[0]} y={e.at[1]} textAnchor="middle">
              <tspan className="dla-cr__wn">{e.name}</tspan> <tspan className="dla-cr__wv">{fmt(param(net, e.p))}</tspan>
              {upd && <tspan className="dla-cr__wu"> → {update.all ? fmt(update.to[e.id]) : (reveal !== null ? fmt(reveal) : '?')}</tspan>}
            </text>
          </g>
        );
      })}
      {BIASES.map((b) => (
        <text key={b.id} className={`dla-t dla-halo dla-cr__wl${hot.includes(b.id) ? ' dla-cr__wl--hot' : ''}`} x={b.at[0]} y={b.at[1]} textAnchor="middle">
          <tspan className="dla-cr__wn">{b.name}</tspan> <tspan className="dla-cr__wv">{fmt(param(net, b.p))}</tspan>
        </text>
      ))}

      {/* inputs */}
      {G.inp.map(([cx, cy], i) => (
        <g key={`x${i}`}>
          <circle className="dla-cr__node dla-cr__node--in" cx={cx} cy={cy} r={G.rIn} />
          <text className="dla-t dla-t--m dla-t--b" x={cx} y={cy + 4.5} textAnchor="middle">{fmt(net.x[i])}</text>
          <text className="dla-t dla-cr__xn" x={cx} y={i === 0 ? cy - 26 : cy + 34} textAnchor="middle">x{S[i]}</text>
        </g>
      ))}

      {/* hidden neurons: φ above, Σ below (Figures 10-7 / 10-9) */}
      {G.hid.map(([cx, cy], j) => {
        const lit = show.h[j];
        const ringT = target === `z${j}` || target === `h${j}` || target === `ds${j}` || target === `dz${j}`;
        const gradRing = target === `ds${j}` || target === `dz${j}`;
        const zq = q(`z${j}`);
        const hq = q(`h${j}`);
        const ty = j === 0 ? cy - 31 : cy + 40;
        return (
          <g key={`h${j}`}>
            <circle className={`dla-cr__node${lit ? ' dla-cr__node--lit' : ''}`} cx={cx} cy={cy} r={G.rHid} />
            <line className="dla-cr__div" x1={cx - G.rHid + 3} y1={cy} x2={cx + G.rHid - 3} y2={cy} />
            <path className="dla-cr__glyph" d={glyphPath(net.act, cx, cy - 10, 26, 12)} />
            <text className="dla-cr__sigma" x={cx} y={cy + 16} textAnchor="middle">Σ</text>
            {ringT && <circle className={`dla-cr__ring${gradRing ? ' dla-cr__ring--grad' : ''}`} cx={cx} cy={cy} r={G.rHid + 6} />}
            {(show.z[j] || zq !== null) && (
              <text className={`dla-t dla-halo dla-cr__tag${zq !== null ? ' dla-cr__tag--q' : ''}`} x={cx - 30} y={ty} textAnchor="end">z{S[j]} {zq ?? fmt(vals.z[j])}</text>
            )}
            {(show.h[j] || hq !== null) && (
              <text className={`dla-t dla-halo dla-cr__tag${hq !== null ? ' dla-cr__tag--q' : ''}`} x={cx + 30} y={ty} textAnchor="start">h{S[j]} {hq ?? fmt(vals.h[j])}</text>
            )}
          </g>
        );
      })}

      {/* the output neuron (linear: Σ only), the target y and the error */}
      {(() => {
        const [cx, cy] = G.out;
        const yq = q('yhat');
        const eq = q('e');
        const lit = show.yhat;
        return (
          <g>
            <circle className={`dla-cr__node dla-cr__node--out${lit ? ' dla-cr__node--lit' : ''}`} cx={cx} cy={cy} r={G.rOut} />
            <text className="dla-cr__sigma" x={cx} y={cy + 5} textAnchor="middle">Σ</text>
            {(target === 'yhat' || target === 'e') && <circle className="dla-cr__ring" cx={cx} cy={cy} r={G.rOut + 6} />}
            {(show.yhat || yq !== null) && (
              <text className={`dla-t dla-halo dla-cr__tag${yq !== null ? ' dla-cr__tag--q' : ''}`} x={G.yhatAt[0]} y={G.yhatAt[1]} textAnchor="middle">ŷ {yq ?? fmt(vals.yhat)}</text>
            )}
            {show.y && vals.y !== null && (
              <>
                {flow === 'error' && <line className="dla-cr__gap" x1={cx} y1={cy + G.rOut + 2} x2={cx} y2={G.yAt[1] - 12} />}
                <text className="dla-t dla-halo dla-cr__tag dla-cr__tag--y" x={G.yAt[0]} y={G.yAt[1]} textAnchor="middle">{LABELS.target} {fmt(vals.y)}</text>
              </>
            )}
            {(show.e || eq !== null) && vals.e !== null && (
              <text className={`dla-t dla-halo dla-cr__tag ${eq !== null ? 'dla-cr__tag--q' : 'dla-cr__tag--grad'}`} x={G.eAt[0]} y={G.eAt[1]} textAnchor="middle">ŷ − y {eq ?? fmt(vals.e)}</text>
            )}
          </g>
        );
      })()}
    </svg>
  );
}

/* The hidden activation's curve with z marked; h is read off it. */
export function ActInset({ inset }) {
  const key = inset.deriv ? 'dsigmoid' : inset.act;
  const cfg = INSET[key];
  const f = inset.deriv ? DPHI.sigmoid : PHI[inset.act];
  const P = plotter([34, 16, 156, 92], [-3, 3], cfg.yr);
  const pts = Array.from({ length: 61 }, (_, i) => -3 + i / 10).map((z) => [z, f(z)]);
  const zx = P.sx(inset.z);
  const fy = P.sy(f(inset.z));
  const name = inset.deriv ? `${ACTIVATIONS.sigmoid.plain}′(z)` : `${ACTIVATIONS[inset.act]?.plain ?? inset.act}(z)`;
  const zName = `z${subDigit((inset.j ?? 0) + 1)}`;
  return (
    <svg className="dla-svg dla-cr__inset" viewBox="0 0 200 132" role="img" aria-label={`${name} plotted for z from −3 to 3, with ${zName} = ${fmt(inset.z)} marked on the curve.`}>
      <text className="dla-t dla-t--s dla-t--m" x={34} y={10}>{name}</text>
      {cfg.ticks.map((t) => <line key={t} className="dla-cr__grid" x1={34} x2={190} y1={P.sy(t)} y2={P.sy(t)} />)}
      {[-3, -2, -1, 0, 1, 2, 3].map((z) => <line key={z} className="dla-cr__grid" x1={P.sx(z)} x2={P.sx(z)} y1={16} y2={108} />)}
      <line className="dla-cr__axis" x1={34} x2={190} y1={P.sy(0)} y2={P.sy(0)} />
      <line className="dla-cr__axis" x1={P.sx(0)} x2={P.sx(0)} y1={16} y2={108} />
      {cfg.labels.map((t) => <text key={t} className="dla-t dla-t--xs dla-t--m" x={29} y={P.sy(t) + 3.5} textAnchor="end">{fmt(t)}</text>)}
      {[-3, 0, 3].map((z) => <text key={z} className="dla-t dla-t--xs dla-t--m" x={P.sx(z)} y={121} textAnchor="middle">{fmt(z)}</text>)}
      <path className="dla-cr__curve dla-cr__curve--thin" d={P.path(pts)} />
      <line className="dla-cr__guide" x1={zx} x2={zx} y1={P.sy(cfg.yr[0])} y2={fy} />
      <line className="dla-cr__guide" x1={34} x2={zx} y1={fy} y2={fy} />
      <circle className="dla-cr__dot" cx={zx} cy={fy} r={4} />
      <text className="dla-t dla-t--xs dla-t--m dla-halo dla-cr__zl" x={zx} y={130} textAnchor="middle">{zName} = {fmt(inset.z)}</text>
    </svg>
  );
}

/* Slide 23: the activations come out and the stack merges into one layer. */
export function CollapseScene({ stage, reveal = null }) {
  const n = stage.layers.length;
  const bw = n === 2 ? 104 : 92;
  const pw = 30;
  const gap = 8;
  const total = n * bw + (n - 1) * (pw + 2 * gap);
  const x0 = (CW - total) / 2 + 6;
  const boxes = stage.layers.map((L, i) => ({ ...L, x: x0 + i * (bw + pw + 2 * gap) }));
  const phis = boxes.slice(0, -1).map((B) => B.x + bw + gap);
  const split = (label) => {
    const at = label.indexOf(' = ');
    return at < 0 ? [label, ''] : [label.slice(0, at), label.slice(at + 3)];
  };
  const a = stage.slope;
  const slopeTxt = stage.ask === 'slope' ? (reveal !== null ? fmt(reveal) : '?') : fmt(a);
  const interTxt = stage.ask === 'intercept' ? (reveal !== null ? fmt(reveal) : '?') : '?';
  const mw = 236;
  const mx = (CW - mw) / 2;
  return (
    <svg className="dla-svg dla-cr__collapse" viewBox={`0 0 ${CW} 196`} role="img" aria-label={`${stage.layers.map((L) => L.label).join(', then ')}, with the activation between them removed; they collapse to one linear layer ${stage.comp}.`}>
      <text className="dla-t dla-t--m" x={x0 - 18} y={57} textAnchor="middle">z</text>
      <line className="dla-cr__wire" x1={x0 - 10} y1={52} x2={x0 - 2} y2={52} />
      {boxes.map((B, i) => {
        const [nm, fx] = split(B.label);
        return (
          <g key={B.name} className="dla-cr__layer" style={{ '--i': i }}>
            <rect className="dla-cr__lbox" x={B.x} y={26} width={bw} height={52} rx={8} />
            <text className="dla-t dla-t--s dla-t--m" x={B.x + bw / 2} y={43} textAnchor="middle">{nm}</text>
            <text className="dla-t dla-t--m dla-t--b dla-cr__lfx" x={B.x + bw / 2} y={68} textAnchor="middle">{fx}</text>
            {i < n - 1 && <line className="dla-cr__wire" x1={B.x + bw} y1={52} x2={phis[i]} y2={52} />}
            {i > 0 && <line className="dla-cr__wire" x1={phis[i - 1] + pw} y1={52} x2={B.x} y2={52} />}
            <line className="dla-cr__funnel" x1={B.x + bw / 2} y1={80} x2={CW / 2 + (B.x + bw / 2 - CW / 2) * 0.35} y2={124} />
          </g>
        );
      })}
      {phis.map((px, i) => (
        <g key={`phi${i}`} className="dla-cr__phi">
          <rect className="dla-cr__phibox" x={px} y={37} width={pw} height={30} rx={6} />
          <text className="dla-t dla-t--s" x={px + pw / 2} y={57} textAnchor="middle">φ</text>
          <line className="dla-cr__strike" x1={px - 3} y1={70} x2={px + pw + 3} y2={34} />
        </g>
      ))}
      <text className="dla-t dla-t--xs dla-t--m dla-cr__removed" x={CW / 2} y={14} textAnchor="middle">{stage.removed}</text>
      <g className="dla-cr__merged">
        <rect className="dla-cr__mbox" x={mx} y={126} width={mw} height={58} rx={10} />
        <text className="dla-t dla-t--s dla-t--m" x={CW / 2} y={144} textAnchor="middle">{stage.comp} =</text>
        <text className="dla-t dla-t--m dla-t--b dla-cr__mline" x={CW / 2} y={174} textAnchor="middle">
          <tspan className={stage.ask === 'slope' ? 'dla-cr__mq' : ''}>{slopeTxt}</tspan>
          <tspan>{' '}z + </tspan>
          <tspan className={stage.ask === 'intercept' ? 'dla-cr__mq' : ''}>{interTxt}</tspan>
        </text>
      </g>
    </svg>
  );
}

/* One curve of Figure 10-8 (slide 22). */
export function CurveScene({ stage }) {
  const P = plotter([44, 30, 384, 156], [-4.5, 4.5], stage.range);
  const C = curve(stage.fn, stage.panel);
  const deriv = stage.panel === 'deriv';
  const yt = deriv ? [0, 0.25, 0.5, 0.75, 1] : [-1, 0, 1, 2];
  const yl = deriv ? [0, 0.5, 1] : [-1, 0, 1, 2];
  const top = P.sy(stage.range[1]);
  const bot = P.sy(stage.range[0]);
  return (
    <svg className="dla-svg dla-cr__curvebox" viewBox={`0 0 ${CW} 214`} role="img" aria-label={`Figure 10-8, ${stage.title} panel: one curve for z from −4 to 4. Which function is it?`}>
      <text className="dla-t dla-t--s dla-t--m" x={44} y={20}>{stage.title}</text>
      {yt.map((t) => <line key={`y${t}`} className="dla-cr__grid" x1={44} x2={428} y1={P.sy(t)} y2={P.sy(t)} />)}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((z) => <line key={`z${z}`} className="dla-cr__grid" x1={P.sx(z)} x2={P.sx(z)} y1={top} y2={bot} />)}
      <line className="dla-cr__axis" x1={44} x2={428} y1={P.sy(0)} y2={P.sy(0)} />
      <line className="dla-cr__axis" x1={P.sx(0)} x2={P.sx(0)} y1={top} y2={bot} />
      {yl.map((t) => <text key={`yl${t}`} className="dla-t dla-t--xs dla-t--m" x={38} y={P.sy(t) + 3.5} textAnchor="end">{fmt(t)}</text>)}
      {[-4, -2, 0, 2, 4].map((z) => <text key={`zl${z}`} className="dla-t dla-t--xs dla-t--m" x={P.sx(z)} y={204} textAnchor="middle">{fmt(z)}</text>)}
      {C.jump && C.segments.length === 2 && (
        <line className="dla-cr__jump" x1={P.sx(0)} x2={P.sx(0)} y1={P.sy(C.segments[0][C.segments[0].length - 1][1])} y2={P.sy(C.segments[1][0][1])} />
      )}
      {C.segments.map((pts, i) => <path key={i} className="dla-cr__curve dla-cr__curve--draw" pathLength={1} d={P.path(pts)} />)}
      {C.markers.map(([z, v], i) => (
        <g key={`m${i}`} className="dla-cr__x">
          <line x1={P.sx(z) - 5} y1={P.sy(v) - 5} x2={P.sx(z) + 5} y2={P.sy(v) + 5} />
          <line x1={P.sx(z) - 5} y1={P.sy(v) + 5} x2={P.sx(z) + 5} y2={P.sy(v) - 5} />
        </g>
      ))}
    </svg>
  );
}

/* A task card and the output layer being built (Figures 10-7 / 10-9 style). */
export function CardScene({ stage, pick }) {
  return (
    <div className="dla-cr__card">
      <div className="dla-cr__cardtext">
        <p className="dla-k"><span className="dla-dot" aria-hidden="true" />{stage.kicker}</p>
        <p className="dla-cr__cardline">{stage.text}</p>
      </div>
      <HeadPicture pick={pick} />
    </div>
  );
}

function HeadPicture({ pick }) {
  const n = pick.neurons ?? 0;
  const xs = n ? Array.from({ length: n }, (_, i) => (n === 1 ? 120 : 30 + (180 * i) / (n - 1))) : [120];
  const r = n > 3 ? 8 : 14;
  const hid = [70, 120, 170];
  const actL = HEAD.acts.find((a) => a.id === pick.act)?.label;
  const lossL = HEAD.losses.find((a) => a.id === pick.loss)?.label;
  const softmax = pick.act === 'softmax';
  const glyph = pick.act && pick.act !== 'none' && !softmax ? pick.act : null;
  const aria = n || actL || lossL
    ? `Output layer: ${n || 'no'} neuron${n === 1 ? '' : 's'}, activation ${actL ?? 'not chosen'}, loss ${lossL ?? 'not chosen'}.`
    : 'Output layer: not built yet.';
  return (
    <svg className="dla-svg dla-cr__headpic" viewBox="0 0 240 176" role="img" aria-label={aria}>
      <text className={`dla-t dla-t--m dla-cr__losst${lossL ? '' : ' dla-cr__losst--q'}`} x={120} y={16} textAnchor="middle">{HEAD.rows.loss}: {lossL ?? '?'}</text>
      {hid.map((hx) => xs.map((ox, i) => <line key={`${hx}-${i}`} className="dla-cr__edge" x1={hx} y1={146} x2={ox} y2={74 + r} />))}
      {softmax && n > 0 && (
        <g>
          <rect className="dla-cr__softmax" x={Math.min(...xs) - r - 6} y={34} width={Math.max(...xs) - Math.min(...xs) + 2 * r + 12} height={16} rx={6} />
          <text className="dla-t dla-t--xs" x={120} y={46} textAnchor="middle">Softmax</text>
        </g>
      )}
      {xs.map((ox, i) => (
        <g key={i}>
          {n > 0 && !softmax && <line className="dla-cr__edge" x1={ox} y1={74 - r} x2={ox} y2={46} />}
          <circle className={`dla-cr__node${n ? ' dla-cr__node--lit' : ' dla-cr__node--ghost'}`} cx={ox} cy={74} r={r} />
          {!n && <text className="dla-t dla-t--m dla-cr__tag--q" x={ox} y={79} textAnchor="middle">?</text>}
          {n > 0 && glyph && r > 10 && <path className="dla-cr__glyph" d={glyphPath(glyph, ox, 74 - 5, 16, 8)} />}
          {n > 0 && r > 10 && <text className="dla-cr__sigma dla-cr__sigma--s" x={ox} y={glyph ? 84 : 78} textAnchor="middle">Σ</text>}
        </g>
      ))}
      {hid.map((hx) => (
        <g key={`h${hx}`}>
          <circle className="dla-cr__node" cx={hx} cy={146} r={13} />
          <path className="dla-cr__glyph" d={glyphPath('relu', hx, 146, 14, 9)} />
        </g>
      ))}
      <text className="dla-t dla-t--xs dla-t--m" x={120} y={172} textAnchor="middle">{actL ? `${HEAD.rows.act}: ${actL}` : `${HEAD.rows.act}: ?`}</text>
    </svg>
  );
}

/* The reverse pass so far, as a ruled strip. */
export function Ledger({ items, reveal = null }) {
  return (
    <div className="dla-cr__ledger" role="group" aria-label={LABELS.ledger}>
      <span className="dla-k">{LABELS.ledger}</span>
      {items.map((it) => (
        <span key={it.key} className={`dla-cr__lg${it.target ? ' dla-cr__lg--target' : ''}`}>
          <span className="dla-cr__lgk">{it.label}</span>
          <span className="dla-cr__lgv">{it.value === null ? (reveal !== null ? fmt(reveal) : '?') : fmt(it.value)}</span>
        </span>
      ))}
    </div>
  );
}
