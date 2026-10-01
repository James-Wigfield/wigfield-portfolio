import { useMemo, useRef, useState } from 'react';
import { Lab, Range } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { ROADMAP } from '../slideData';
import { svgPoint } from '../hooks';
import { mulberry32 } from '../../mathfns';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §0 AND §1
     RoadmapLab      slide 3's topic list, wired to the sections that teach it
     OrientationLab  Hubel & Wiesel in miniature: rotate and move a light bar
                     over a receptive field; four orientation-tuned neurons
                     compute their responses live
     DepthFieldLab   neurons that each see 3 below them, stacked 3 deep: pick
                     one and watch its receptive field on the input grow
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

/* ── §0 · the roadmap ─────────────────────────────────────────────────────── */
export function RoadmapLab() {
  const { stats, jumpTo } = useStudy();
  return (
    <Lab
      title="Slide 3’s roadmap, mapped onto this page"
      slides="slide 3"
      tryThis="click a section chip to jump to it — the bar beside each topic fills as you tick off that topic’s notebook lines."
    >
      <ol className="dl3s-road">
        {ROADMAP.map((t, i) => {
          const done = t.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = t.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={t.topic} className="dl3s-road__item">
              <span className="dl3s-road__no" aria-hidden="true">{i + 1}</span>
              <span className="dl3s-road__topic">{t.topic}</span>
              <span className="dl3s-road__prog" aria-label={`${done} of ${total} notebook lines copied`}>
                <span className="dl3s-road__track"><span className="dl3s-road__fill" style={{ width: `${pct}%` }} /></span>
                <span className="dl3s-road__pct">{done}/{total}</span>
              </span>
              <span className="dl3s-road__secs">
                {t.secs.map((id) => (
                  <button key={id} type="button" className="dl3s-secchip" onClick={() => jumpTo(id)}>
                    <b>§{SEC[id].no}</b> {SEC[id].short}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="dl3s-cap">
        Not on slide 3: <button type="button" className="dl3s-link" onClick={() => jumpTo('s01')}>§1 Origins</button> opens the deck (slides 4–5) and{' '}
        <button type="button" className="dl3s-link" onClick={() => jumpTo('s15')}>§15 Summary</button> closes it (slides 52–53).
      </p>
    </Lab>
  );
}

/* ── §1 · orientation-tuned neurons ──────────────────────────────────────── */
const VF = { w: 360, h: 220 };
const RF = { cx: 168, cy: 110, r: 48 };
const BAR_LEN = 124;
const SIGMA = 16; // tuning width, degrees
const NEURONS = [
  { pref: 0, color: 'var(--dlv-blue)' },
  { pref: 45, color: 'var(--dlv-orange)' },
  { pref: 90, color: 'var(--dlv-aqua)' },
  { pref: 135, color: 'var(--dlv-violet)' },
];
const SLOTS = 24;

// Fraction of the receptive field's diameter the bar covers (0–1).
function coverage(bx, by, deg) {
  const t = (deg * Math.PI) / 180;
  const dx = Math.cos(t) * BAR_LEN;
  const dy = -Math.sin(t) * BAR_LEN;
  const x0 = bx - dx / 2;
  const y0 = by - dy / 2;
  const fx = x0 - RF.cx;
  const fy = y0 - RF.cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - RF.r * RF.r;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return 0;
  const s = Math.sqrt(disc);
  const t1 = Math.max(0, (-b - s) / (2 * a));
  const t2 = Math.min(1, (-b + s) / (2 * a));
  return Math.max(0, t2 - t1) * Math.sqrt(a) / (2 * RF.r);
}

const tuning = (deg, pref) => {
  const d = ((deg - pref + 90 + 1800) % 180) - 90;
  return Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
};

export function OrientationLab() {
  const [deg, setDeg] = useState(90);
  const [pos, setPos] = useState({ x: 168, y: 110 });
  const svgRef = useRef(null);
  const drag = useRef(false);
  const slots = useMemo(() => NEURONS.map((_, i) => {
    const rng = mulberry32(31 + i * 7);
    return Array.from({ length: SLOTS }, () => rng());
  }), []);

  const cov = coverage(pos.x, pos.y, deg);
  const resp = NEURONS.map((n) => cov * tuning(deg, n.pref));
  const best = resp.indexOf(Math.max(...resp));

  const t = (deg * Math.PI) / 180;
  const hx = (Math.cos(t) * BAR_LEN) / 2;
  const hy = (-Math.sin(t) * BAR_LEN) / 2;

  const move = (e) => {
    const p = svgPoint(e, svgRef.current);
    if (p) setPos({ x: Math.round(Math.min(VF.w - 10, Math.max(10, p.x))), y: Math.round(Math.min(VF.h - 10, Math.max(10, p.y))) });
  };

  // tuning curves at the current position (x = bar angle 0–180)
  const PW = 300;
  const PH = 120;
  const px = (a) => 34 + (a / 180) * (PW - 44);
  const py = (v) => 12 + (1 - v) * (PH - 36);
  const curve = (pref) => {
    let d = '';
    for (let a = 0; a <= 180; a += 2) d += `${d ? 'L' : 'M'}${px(a).toFixed(1)} ${py(cov * tuning(a, pref)).toFixed(1)}`;
    return d;
  };

  return (
    <Lab
      title="Orientation-tuned neurons · Figure 14-1’s first level"
      slides="slide 4"
      tryThis="rotate the bar slowly and watch the firing move from neuron to neuron; then drag the bar out of the dashed circle — every neuron goes quiet, whatever the angle."
    >
      <div className="dl3s-orient">
        <div className="dl3s-orient__field">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VF.w} ${VF.h}`}
            className="dl3s-svg dl3s-orient__svg"
            role="img"
            aria-label={`Visual field with a light bar at ${deg} degrees; ${Math.round(cov * 100)}% of the receptive field is covered`}
            onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); move(e); }}
            onPointerMove={(e) => { if (drag.current) move(e); }}
            onPointerUp={() => { drag.current = false; }}
            onPointerCancel={() => { drag.current = false; }}
          >
            <rect x={0} y={0} width={VF.w} height={VF.h} className="dl3s-orient__bg" />
            <text x={10} y={18} className="dl3s-svg__label">visual field — drag the bar</text>
            <circle cx={RF.cx} cy={RF.cy} r={RF.r} className="dl3s-orient__rf" />
            <line x1={pos.x - hx} y1={pos.y - hy} x2={pos.x + hx} y2={pos.y + hy} className="dl3s-orient__bar" />
            <text x={RF.cx + RF.r + 6} y={RF.cy + RF.r - 4} className="dl3s-svg__label dl3s-halo">receptive field</text>
            <text x={pos.x + hx + (hx >= 0 ? 6 : -6)} y={pos.y + hy - 4} textAnchor={hx >= 0 ? 'start' : 'end'} className="dl3s-svg__label dl3s-svg__label--ink">
              bar {deg}°
            </text>
          </svg>
          <div className="dl-sliders">
            <Range label="bar angle" value={deg} min={0} max={179} onChange={setDeg} fmt={(v) => `${v}°`} />
            <Range label="bar x" value={pos.x} min={10} max={VF.w - 10} onChange={(x) => setPos((p) => ({ ...p, x }))} />
            <Range label="bar y" value={pos.y} min={10} max={VF.h - 10} onChange={(y) => setPos((p) => ({ ...p, y }))} />
          </div>
        </div>

        <div className="dl3s-orient__cells">
          <p className="dl3s-stagehead">Four neurons, one receptive field — {Math.round(cov * 100)}% of it covered</p>
          {NEURONS.map((n, i) => (
            <div key={n.pref} className={`dl3s-neuron${i === best && resp[i] > 0.05 ? ' dl3s-neuron--best' : ''}`}>
              <svg viewBox="0 0 24 24" className="dl3s-neuron__glyph" aria-hidden="true">
                <line
                  x1={12 - 9 * Math.cos((n.pref * Math.PI) / 180)}
                  y1={12 + 9 * Math.sin((n.pref * Math.PI) / 180)}
                  x2={12 + 9 * Math.cos((n.pref * Math.PI) / 180)}
                  y2={12 - 9 * Math.sin((n.pref * Math.PI) / 180)}
                  style={{ stroke: n.color }}
                />
              </svg>
              <span className="dl3s-neuron__name">prefers {n.pref}°</span>
              <span className="dl3s-neuron__spikes" aria-hidden="true">
                {slots[i].map((th, k) => <i key={k} className={th < resp[i] ? 'on' : ''} style={th < resp[i] ? { background: n.color } : undefined} />)}
              </span>
              <span className="dl3s-neuron__val">{resp[i].toFixed(2)}</span>
            </div>
          ))}
          <svg viewBox={`0 0 ${PW} ${PH}`} className="dl3s-svg dl3s-orient__plot" role="img" aria-label="Each neuron's response against bar angle at the current bar position">
            <line x1={px(0)} y1={py(0)} x2={px(180)} y2={py(0)} className="dl3s-axis" />
            {[0, 45, 90, 135, 180].map((a) => (
              <text key={a} x={px(a)} y={PH - 8} textAnchor="middle" className="dl3s-tick">{a}°</text>
            ))}
            <text x={6} y={py(1) + 4} className="dl3s-tick">1</text>
            <text x={6} y={py(0) + 4} className="dl3s-tick">0</text>
            {NEURONS.map((n) => <path key={n.pref} d={curve(n.pref)} className="dl3s-curve" style={{ stroke: n.color }} />)}
            {NEURONS.map((n) => (
              <text key={`l${n.pref}`} x={px(n.pref) + (n.pref === 0 ? 4 : 0)} y={py(cov) - 4} textAnchor={n.pref === 0 ? 'start' : 'middle'} className="dl3s-svg__label" style={{ fill: n.color }}>
                {n.pref}°
              </text>
            ))}
            <line x1={px(deg)} y1={py(1) - 4} x2={px(deg)} y2={py(0)} className="dl3s-marker" />
          </svg>
          <p className="dl3s-cap">Response = how much of the field the bar covers × how close its angle is to the neuron’s favourite.</p>
        </div>
      </div>
    </Lab>
  );
}

/* ── §1 · receptive fields grow with depth ───────────────────────────────── */
const DEPTH = [
  { name: 'layer 3', n: 7 },
  { name: 'layer 2', n: 9 },
  { name: 'layer 1', n: 11 },
  { name: 'input', n: 13 },
];
const DX = 30;
const X0 = 98;
const ROW_Y = [34, 92, 150, 208];

export function DepthFieldLab() {
  const [sel, setSel] = useState({ l: 0, j: 3 }); // l: 0 = layer 3 … 3 = input
  const depth = 3 - sel.l; // how many conv layers above the input
  const lo = sel.j;
  const hi = sel.j + 2 * depth;

  // x of neuron j in row l: centred over its receptive field on the input
  const xOf = (l, j) => X0 + (j + (3 - l)) * DX;

  // the cone: which neurons in each lower row feed the selected one
  const cone = DEPTH.map((_, l) => {
    if (l < sel.l) return null;
    const d = l - sel.l;
    return [sel.j, sel.j + 2 * d];
  });

  const onKey = (e) => {
    let { l, j } = sel;
    if (e.key === 'ArrowLeft') j = Math.max(0, j - 1);
    else if (e.key === 'ArrowRight') j = Math.min(DEPTH[l].n - 1, j + 1);
    else if (e.key === 'ArrowUp') { if (l > 0) { l -= 1; j = Math.min(DEPTH[l].n - 1, Math.max(0, j - 1)); } }
    else if (e.key === 'ArrowDown') { if (l < 3) { l += 1; j = Math.min(DEPTH[l].n - 1, j + 1); } }
    else return;
    e.preventDefault();
    setSel({ l, j });
  };

  return (
    <Lab
      title="Receptive fields grow with depth"
      slides="slides 4 & 7"
      tryThis="point at a neuron in layer 3, then one in layer 1 (or focus the diagram and use the arrow keys): each connects to only 3 below it, yet the deeper one sees 7 input pixels."
    >
      <svg
        viewBox="0 0 520 246"
        className="dl3s-svg dl3s-depth"
        tabIndex={0}
        role="application"
        aria-label={`${DEPTH[sel.l].name} neuron ${sel.j + 1} selected; it sees input pixels ${lo + 1} to ${hi + 1}. Arrow keys move the selection.`}
        onKeyDown={onKey}
      >
        {/* edges */}
        {DEPTH.slice(0, 3).map((row, l) =>
          Array.from({ length: row.n }, (_, j) =>
            [0, 1, 2].map((k) => {
              const on = cone[l] && j >= cone[l][0] && j <= cone[l][1];
              return (
                <line
                  key={`${l}-${j}-${k}`}
                  x1={xOf(l, j)}
                  y1={ROW_Y[l] + 9}
                  x2={xOf(l + 1, j + k)}
                  y2={ROW_Y[l + 1] - 9}
                  className={on ? 'dl3s-depth__edge dl3s-depth__edge--on' : 'dl3s-depth__edge'}
                />
              );
            }),
          ),
        )}
        {/* neurons + input pixels */}
        {DEPTH.map((row, l) => (
          <g key={row.name}>
            <text x={12} y={ROW_Y[l] + 4} className="dl3s-svg__label">{row.name}</text>
            {Array.from({ length: row.n }, (_, j) => {
              const inCone = cone[l] && j >= cone[l][0] && j <= cone[l][1];
              const isSel = l === sel.l && j === sel.j;
              const cls = `dl3s-depth__node${inCone ? ' dl3s-depth__node--cone' : ''}${isSel ? ' dl3s-depth__node--sel' : ''}`;
              return l === 3 ? (
                <rect key={j} x={xOf(l, j) - 9} y={ROW_Y[l] - 9} width={18} height={18} className={cls} onPointerEnter={() => setSel({ l, j })} onClick={() => setSel({ l, j })} />
              ) : (
                <circle key={j} cx={xOf(l, j)} cy={ROW_Y[l]} r={8} className={cls} onPointerEnter={() => setSel({ l, j })} onClick={() => setSel({ l, j })} />
              );
            })}
          </g>
        ))}
        {/* the receptive field on the input */}
        <path
          d={`M${xOf(3, lo) - 10} ${ROW_Y[3] + 14} v6 H${xOf(3, hi) + 10} v-6`}
          className="dl3s-depth__brace"
        />
        <text x={(xOf(3, lo) + xOf(3, hi)) / 2} y={ROW_Y[3] + 34} textAnchor="middle" className="dl3s-svg__label dl3s-svg__label--ink">
          receptive field: {hi - lo + 1} pixel{hi > lo ? 's' : ''}
        </text>
      </svg>
      <div className="dl3s-depthread">
        {[3, 2, 1].map((d) => (
          <span key={d} className={`dl3s-pill${depth === d ? ' dl3s-pill--on' : ''}`}>
            layer {d} neuron → {2 * d + 1} input pixels
          </span>
        ))}
      </div>
      <p className="dl3s-cap">
        Every neuron connects only to a small window of the layer below (slide 7), but stacked windows reach further and further:
        3 → 5 → 7 pixels. In the cortex this is the climb from lines to shapes to whole objects (Figure 14-1).
      </p>
    </Lab>
  );
}
