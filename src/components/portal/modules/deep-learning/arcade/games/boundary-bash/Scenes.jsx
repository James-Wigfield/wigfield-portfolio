import { makeView, halfPlane, boundarySeg, wArrow, segLabel, pointLabel, clip, box, MLP, edge, arrowHead } from './geometry.js';
import { fmt, vec, fill, mlpForward } from '../../maths/boundaryBash.js';
import { LABELS, XOR } from '../../content/boundary-bash.js';

/* ============================================================================
   BOUNDARY BASH — THE PICTURES
   ----------------------------------------------------------------------------
   Plane    the (x₁, x₂) plane: the TLU's boundary wᵀx + b = 0, the tinted
            ŷ = 1 side, the w arrow, the stream's points (squares y = 1,
            triangles y = 0), the incoming point or a probe, dashed candidate
            boundaries (level 1's rule items); on feedback the boundary
            swings to the updated w
   Ledger   the TLU's numbers as a ruled strip (w, b, η, x, y, ŷ)
   XorPlot  Figure 10-6a's four points; one TLU's failed tries, then the two
            hidden TLUs' boundaries and the band the MLP outputs 1 on
   MlpNet   Figure 10-6b: weights, biases, blanks ("?"), the node being asked
   Numbers come from the item (maths/boundaryBash.js); labels from
   content/boundary-bash.js. Styles: boundary-bash.css (.dla-bb*).
   ========================================================================== */

const LO = -4;
const HI = 4;
const V = makeView(LO, HI, 320, 16);
const pt = (view, p) => `${view.sx(p[0])},${view.sy(p[1])}`;
const poly = (view, ps) => ps.map((p) => pt(view, p)).join(' ');
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

function Marker({ view, x, y, size = 6, cls = '' }) {
  const cx = view.sx(x[0]);
  const cy = view.sy(x[1]);
  if (y === 1) return <rect className={`dla-bb__pt dla-bb__pt--1 ${cls}`} x={cx - size} y={cy - size} width={size * 2} height={size * 2} rx={1.5} />;
  return <polygon className={`dla-bb__pt dla-bb__pt--0 ${cls}`} points={`${cx},${cy - size * 1.2} ${cx + size * 1.15},${cy + size * 0.85} ${cx - size * 1.15},${cy + size * 0.85}`} />;
}

export function Plane({ scene, reveal = false, given = null, answer = null }) {
  const { w, b, pts, cur, probe, ghosts, after, fresh } = scene;
  const moved = reveal && after && !same(after, w);
  const wShow = moved ? after : w;
  const seg = boundarySeg(w, b, LO, HI);
  const segShow = boundarySeg(wShow, b, LO, HI);
  const arrow = wArrow(wShow, b, LO, HI, 1.25, (cur ?? probe)?.x ?? null);
  const curAt = cur ? pointLabel(V, w, b, cur.x, 24) : null;
  const probeAt = probe ? pointLabel(V, w, b, probe.x, 24) : null;
  const ticks = [-3, -2, -1, 1, 2, 3];
  const aria = [
    LABELS.planeAria,
    fill(LABELS.aria.w, { w: vec(w), b: fmt(b) }),
    cur ? fill(LABELS.aria.cur, { x: vec(cur.x), y: cur.y }) : '',
    probe ? fill(LABELS.aria.probe, { x: vec(probe.x) }) : '',
    ghosts.length ? fill(LABELS.aria.ghosts, { n: ghosts.length }) : '',
    moved ? fill(LABELS.aria.moved, { w: vec(after) }) : '',
  ].join(' ').replace(/\s+/g, ' ').trim();

  return (
    <svg className={`dla-svg dla-bb__plane${moved ? ' dla-bb__plane--moved' : ''}`} viewBox={`0 0 ${V.size} ${V.size}`} role="img" aria-label={aria}>
      <rect className="dla-bb__bg" x={V.sx(LO)} y={V.sy(HI)} width={V.sx(HI) - V.sx(LO)} height={V.sy(LO) - V.sy(HI)} rx={6} />
      <polygon key={`pos-${wShow}`} className="dla-bb__side dla-bb__side--1" points={poly(V, halfPlane(wShow, b, LO, HI, 1))} />
      <polygon key={`neg-${wShow}`} className="dla-bb__side dla-bb__side--0" points={poly(V, halfPlane(wShow, b, LO, HI, -1))} />
      {Array.from({ length: HI - LO + 1 }, (_, i) => LO + i).map((g) => (
        <g key={g}>
          <line className={`dla-bb__grid${g === 0 ? ' dla-bb__grid--axis' : ''}`} x1={V.sx(g)} y1={V.sy(LO)} x2={V.sx(g)} y2={V.sy(HI)} />
          <line className={`dla-bb__grid${g === 0 ? ' dla-bb__grid--axis' : ''}`} x1={V.sx(LO)} y1={V.sy(g)} x2={V.sx(HI)} y2={V.sy(g)} />
        </g>
      ))}
      {ticks.map((t) => (
        <g key={`t${t}`}>
          <text className="dla-t dla-t--xs" x={V.sx(t)} y={V.sy(0) + 11} textAnchor="middle">{fmt(t)}</text>
          <text className="dla-t dla-t--xs" x={V.sx(0) - 4} y={V.sy(t) + 3} textAnchor="end">{fmt(t)}</text>
        </g>
      ))}
      <text className="dla-t dla-bb__axl" x={V.sx(HI) - 4} y={V.sy(0) - 5} textAnchor="end">x₁</text>
      <text className="dla-t dla-bb__axl" x={V.sx(0) + 5} y={V.sy(HI) + 12}>x₂</text>

      {/* candidate boundaries (level 1's rule items) */}
      {ghosts.map((g, i) => {
        const s = boundarySeg(g.w, b, LO, HI);
        if (!s) return null;
        const at = segLabel(s, LO, HI, 0.55 + 0.5 * i, i % 2);
        const st = reveal ? (g.value === answer ? ' dla-bb__ghost--right' : g.value === given ? ' dla-bb__ghost--wrong' : ' dla-bb__ghost--off') : '';
        return (
          <g key={g.n} className={`dla-bb__ghost${st}`}>
            <line x1={V.sx(s[0][0])} y1={V.sy(s[0][1])} x2={V.sx(s[1][0])} y2={V.sy(s[1][1])} />
            <circle cx={V.sx(at[0])} cy={V.sy(at[1])} r={9} />
            <text className="dla-t dla-bb__ghostn" x={V.sx(at[0])} y={V.sy(at[1]) + 4} textAnchor="middle">{g.n}</text>
          </g>
        );
      })}

      {/* the boundary: the old one ghosts out when the weights move */}
      {seg && <line className={`dla-bb__line${moved ? ' dla-bb__line--old' : ''}`} x1={V.sx(seg[0][0])} y1={V.sy(seg[0][1])} x2={V.sx(seg[1][0])} y2={V.sy(seg[1][1])} />}
      {moved && segShow && <line key={`line-${after}`} className="dla-bb__line dla-bb__line--new" pathLength={1} x1={V.sx(segShow[0][0])} y1={V.sy(segShow[0][1])} x2={V.sx(segShow[1][0])} y2={V.sy(segShow[1][1])} />}
      {arrow && (
        <g className="dla-bb__w">
          <line x1={V.sx(arrow.foot[0])} y1={V.sy(arrow.foot[1])} x2={V.sx(arrow.tip[0])} y2={V.sy(arrow.tip[1])} />
          <polygon points={arrowHead(V.sx(arrow.tip[0]), V.sy(arrow.tip[1]), V.sx(arrow.foot[0]), V.sy(arrow.foot[1]))} />
          <text className="dla-t dla-halo dla-bb__wl" x={V.sx(arrow.tip[0]) + 6} y={V.sy(arrow.tip[1]) - 4}>{LABELS.w}</text>
        </g>
      )}

      {/* the stream so far */}
      {pts.map((p) => <Marker key={`${p.x}`} view={V} x={p.x} y={p.y} cls="dla-bb__pt--old" />)}

      {cur && (
        <g className="dla-bb__cur">
          <circle className="dla-bb__ring" cx={V.sx(cur.x[0])} cy={V.sy(cur.x[1])} r={13} />
          <Marker view={V} x={cur.x} y={cur.y} size={7.5} cls="dla-bb__pt--cur" />
          <text className="dla-t dla-halo dla-bb__xl" x={curAt[0]} y={curAt[1]} textAnchor="middle">{vec(cur.x)}</text>
        </g>
      )}
      {probe && (
        <g className="dla-bb__probe">
          <circle className="dla-bb__ring" cx={V.sx(probe.x[0])} cy={V.sy(probe.x[1])} r={12} />
          <circle className="dla-bb__probedot" cx={V.sx(probe.x[0])} cy={V.sy(probe.x[1])} r={5.5} />
          <text className="dla-t dla-halo dla-bb__xl" x={probeAt[0]} y={probeAt[1]} textAnchor="middle">{vec(probe.x)}</text>
        </g>
      )}
      {fresh && <text className="dla-t dla-halo dla-bb__fresh" x={V.sx(LO) + 8} y={V.sy(HI) + 16}>{LABELS.fresh[fresh]}</text>}
    </svg>
  );
}

export function Ledger({ scene, reveal = false, ask = null }) {
  const { w, b, eta, cur, probe, after } = scene;
  const moved = reveal && after && !same(after, w);
  const x = cur?.x ?? probe?.x ?? null;
  const L = LABELS.ledger;
  return (
    <dl className="dla-bb__ledger">
      <div className="dla-bb__lrow">
        <dt>{L.w}</dt>
        <dd>
          ({w.map((v, i) => <span key={i}>{i ? ', ' : ''}<span className={ask === i ? 'dla-bb__ask' : undefined}>{fmt(v)}</span></span>)})
          {moved && <span className="dla-bb__next"> → {vec(after)}</span>}
        </dd>
      </div>
      <div className="dla-bb__lrow"><dt>{L.b}</dt><dd>{fmt(b)} <span className="dla-k">{LABELS.fixed}</span></dd></div>
      {cur && <div className="dla-bb__lrow"><dt>{L.eta}</dt><dd>{fmt(eta)}</dd></div>}
      {x && <div className="dla-bb__lrow"><dt>{L.x}</dt><dd>{vec(x)}</dd></div>}
      {cur && (
        <div className="dla-bb__lrow">
          <dt>{L.y}</dt>
          <dd><span className={`dla-bb__chip dla-bb__chip--${cur.y}`} aria-hidden="true" />{cur.y}</dd>
        </div>
      )}
      {cur && <div className="dla-bb__lrow"><dt>{L.yhat}</dt><dd>{cur.showYhat || reveal ? cur.yhat : <span className="dla-bb__hid">{LABELS.hidden}</span>}</dd></div>}
    </dl>
  );
}

/* ── level 3 ──────────────────────────────────────────────────────────── */
const XV = makeView(-0.5, 1.5, 240, 14);
const XLO = -0.5;
const XHI = 1.5;
const HID = [0, 1].map((j) => ({ w: [XOR.net.W[0][j], XOR.net.W[1][j]], b: XOR.net.b[j] }));

export function XorPlot({ scene, reveal = false }) {
  const { phase, tries, input } = scene;
  // the MLP outputs 1 between the hidden boundaries: right TLU on (≥ 0) and left TLU off (< 0)
  const band = clip(clip(box(XLO, XHI), HID[1].w, HID[1].b, 1), HID[0].w, HID[0].b, -1);
  return (
    <svg className="dla-svg dla-bb__xor" viewBox={`0 0 ${XV.size} ${XV.size}`} role="img" aria-label={`${LABELS.xorAria}${phase === 'flat' ? LABELS.aria.tries : LABELS.aria.band}`}>
      <rect className="dla-bb__bg" x={XV.sx(XLO)} y={XV.sy(XHI)} width={XV.sx(XHI) - XV.sx(XLO)} height={XV.sy(XLO) - XV.sy(XHI)} rx={6} />
      {phase === 'mlp' && <polygon className="dla-bb__side dla-bb__side--1 dla-bb__band" points={poly(XV, band)} />}
      {[0, 1].map((g) => (
        <g key={g}>
          <line className={`dla-bb__grid${g === 0 ? ' dla-bb__grid--axis' : ''}`} x1={XV.sx(g)} y1={XV.sy(XLO)} x2={XV.sx(g)} y2={XV.sy(XHI)} />
          <line className={`dla-bb__grid${g === 0 ? ' dla-bb__grid--axis' : ''}`} x1={XV.sx(XLO)} y1={XV.sy(g)} x2={XV.sx(XHI)} y2={XV.sy(g)} />
          <text className="dla-t dla-t--xs" x={XV.sx(g)} y={XV.sy(XLO) - 4} textAnchor="middle">{g}</text>
          <text className="dla-t dla-t--xs" x={XV.sx(XLO) + 4} y={XV.sy(g) + 4}>{g}</text>
        </g>
      ))}
      <text className="dla-t dla-bb__axl" x={XV.sx(XHI) - 4} y={XV.sy(0) + 14} textAnchor="end">x₁</text>
      <text className="dla-t dla-bb__axl" x={XV.sx(0) - 5} y={XV.sy(XHI) + 12} textAnchor="end">x₂</text>
      {phase === 'flat' && tries.map((t, i) => {
        const s = boundarySeg(t.w, t.b, XLO, XHI);
        if (!s) return null;
        const [top, bot] = s[0][1] >= s[1][1] ? s : [s[1], s[0]];
        const at = [top[0] + 0.24 * (bot[0] - top[0]), top[1] + 0.24 * (bot[1] - top[1])];
        const right = at[0] > 0.9;
        return (
          <g key={i} className="dla-bb__try" style={{ '--i': i }}>
            <line x1={XV.sx(s[0][0])} y1={XV.sy(s[0][1])} x2={XV.sx(s[1][0])} y2={XV.sy(s[1][1])} />
            <text className="dla-t dla-halo dla-bb__tryl" x={XV.sx(at[0]) + (right ? -7 : 7)} y={XV.sy(at[1]) + 4} textAnchor={right ? 'end' : 'start'}>{fill(LABELS.wrongN, { n: t.wrong })}</text>
          </g>
        );
      })}
      {phase === 'mlp' && HID.map((h, j) => {
        const s = boundarySeg(h.w, h.b, XLO, XHI);
        const [top, bot] = s[0][1] >= s[1][1] ? s : [s[1], s[0]];
        const t = j === 0 ? 0.25 : 0.75;
        const at = [top[0] + t * (bot[0] - top[0]), top[1] + t * (bot[1] - top[1])];
        return (
          <g key={j} className="dla-bb__hidline">
            <line x1={XV.sx(s[0][0])} y1={XV.sy(s[0][1])} x2={XV.sx(s[1][0])} y2={XV.sy(s[1][1])} />
            <text className="dla-t dla-halo dla-bb__hl" x={XV.sx(at[0]) + (j === 0 ? 9 : -9)} y={XV.sy(at[1]) + (j === 0 ? -5 : 15)} textAnchor={j === 0 ? 'start' : 'end'}>{`h${j ? '₂' : '₁'}`}</text>
          </g>
        );
      })}
      {XOR.points.map((p) => <Marker key={`${p.x}`} view={XV} x={p.x} y={p.y} size={8} />)}
      {input && <circle className={`dla-bb__ring${reveal ? ' dla-bb__ring--done' : ''}`} cx={XV.sx(input[0])} cy={XV.sy(input[1])} r={15} />}
    </svg>
  );
}

function Tlu({ at, r, hot }) {
  const [cx, cy] = at;
  return (
    <g className={`dla-bb__tlu${hot ? ' dla-bb__tlu--hot' : ''}`}>
      <circle cx={cx} cy={cy} r={r} />
      <line className="dla-bb__tludiv" x1={cx - r + 3} y1={cy} x2={cx + r - 3} y2={cy} />
      <path className="dla-bb__tlustep" d={`M${cx - 9} ${cy - 4}h8v-9h10`} />
      <text className="dla-bb__sigma" x={cx} y={cy + 14} textAnchor="middle">Σ</text>
    </g>
  );
}

function Slot({ at, text, blank, reveal, small = false }) {
  const q = blank && !reveal;
  return (
    <g className={`dla-bb__slot${blank ? ' dla-bb__slot--blank' : ''}${small ? ' dla-bb__slot--s' : ''}`}>
      <circle cx={at[0]} cy={at[1]} r={small ? 12 : 13} />
      <text className="dla-t" x={at[0]} y={at[1] + 4} textAnchor="middle">{q ? '?' : text}</text>
    </g>
  );
}

export function MlpNet({ scene, reveal = false }) {
  const { blank, focus, input, show } = scene;
  const S = XOR.show;
  const f = input ? mlpForward(XOR.net, input) : null;
  const hotIn = (j) => focus === `h${j + 1}` || focus === 'out';
  const tag = reveal && f && focus
    ? (focus === 'out' ? `ŷ = ${f.out}` : show === 'z' ? `z = ${fmt(f.z[Number(focus[1]) - 1])}` : `h${focus === 'h1' ? '₁' : '₂'} = ${f.h[Number(focus[1]) - 1]}`)
    : null;
  const tagAt = focus === 'out'
    ? [MLP.out[0] - MLP.r - 10, MLP.out[1] + 4, 'end']
    : focus === 'h1' ? [MLP.hid[0][0] - MLP.r - 4, MLP.hid[0][1] - 26, 'end'] : [MLP.hid[1][0] + MLP.r + 2, MLP.hid[1][1] - 34, 'start'];
  return (
    <svg className="dla-svg dla-bb__mlp" viewBox={`0 0 ${MLP.w} ${MLP.h}`} role="img" aria-label={`${LABELS.mlpAria}${blank ? LABELS.aria.blank : ''}${input ? fill(LABELS.aria.input, { a: input[0], b: input[1] }) : ''}`}>
      {/* input → hidden */}
      {[0, 1].map((i) => [0, 1].map((j) => {
        const e = edge(MLP.x[i], MLP.hid[j], 9, MLP.r);
        return (
          <g key={`e${i}${j}`} className={`dla-bb__edge${hotIn(j) && input ? ' dla-bb__edge--hot' : ''}`}>
            <line {...e} />
            <polygon points={arrowHead(e.x2, e.y2, e.x1, e.y1)} />
          </g>
        );
      }))}
      {/* hidden → output, output → */}
      {[0, 1].map((j) => {
        const e = edge(MLP.hid[j], MLP.out, MLP.r, MLP.r);
        return (
          <g key={`o${j}`} className={`dla-bb__edge${focus === 'out' ? ' dla-bb__edge--hot' : ''}`}>
            <line {...e} />
            <polygon points={arrowHead(e.x2, e.y2, e.x1, e.y1)} />
          </g>
        );
      })}
      <g className="dla-bb__edge">
        <line x1={MLP.out[0]} y1={MLP.out[1] - MLP.r} x2={MLP.out[0]} y2={8} />
        <polygon points={arrowHead(MLP.out[0], 6, MLP.out[0], 20)} />
      </g>
      {[0, 1].map((i) => [0, 1].map((j) => <Slot key={`w${i}${j}`} at={MLP.wIn[i][j]} text={S.W[i][j]} small />))}
      {[0, 1].map((j) => <Slot key={`v${j}`} at={MLP.wOut[j]} text={S.v[j]} blank={blank === 'ov'} reveal={reveal} />)}
      {[0, 1].map((j) => <Tlu key={`h${j}`} at={MLP.hid[j]} r={MLP.r} hot={focus === `h${j + 1}` || (focus === 'out' && !!input)} />)}
      <Tlu at={MLP.out} r={MLP.r} hot={focus === 'out'} />
      {[0, 1].map((j) => <Slot key={`b${j}`} at={MLP.bias[j]} text={S.b[j]} blank={blank === 'hb'} reveal={reveal} />)}
      <Slot at={MLP.biasOut} text={S.c} blank={blank === 'oc'} reveal={reveal} />
      <text className="dla-t dla-t--s" x={MLP.hid[0][0] - MLP.r - 6} y={MLP.hid[0][1] + 4} textAnchor="end">{LABELS.left}</text>
      <text className="dla-t dla-t--s" x={MLP.hid[1][0] - MLP.r - 6} y={MLP.hid[1][1] + 4} textAnchor="end">{LABELS.right}</text>
      {[0, 1].map((i) => (
        <text key={`x${i}`} className="dla-t dla-bb__xn" x={MLP.x[i][0]} y={MLP.x[i][1] + 18} textAnchor="middle">
          {`x${i ? '₂' : '₁'}`}{input ? ` = ${input[i]}` : ''}
        </text>
      ))}
      {focus && <circle className="dla-bb__ring" cx={(focus === 'out' ? MLP.out : MLP.hid[Number(focus[1]) - 1])[0]} cy={(focus === 'out' ? MLP.out : MLP.hid[Number(focus[1]) - 1])[1]} r={MLP.r + 6} />}
      {tag && <text className="dla-t dla-halo dla-bb__tag" x={tagAt[0]} y={tagAt[1]} textAnchor={tagAt[2]}>{tag}</text>}
    </svg>
  );
}
