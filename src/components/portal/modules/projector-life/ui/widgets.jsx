import { useRef, useState } from 'react';
import { THROW_PRESETS, readParam, regionParams } from '../params.js';
import { ParamControl, Switch } from './controls';
import { useStats, pct, num } from './store';
import {
  APOTHEM, C, CIRCUM, FLATS, TYPE_LABEL, clampToOctagon, corner, flatNormal, floorLocalToPlan, octagon, patchName, planToWorld, pts,
} from './geom';

/* ============================================================================
   PROJECTOR LIFE — the panel's special widgets
     ApexProfile      roof section + slide/peel split for the apex slider
     ThrowQuick       "typical" throw-ratio buttons for one projector
     CoverageReadout  % floor / wall / roof / total + reached-by-N bar
     RegionMap        plan + roof maps of every patch; click to edit a region
     Histograms       creature trait histograms, three habitat series
     CreatureCounters alive / born / died / fell / landed / in flight
     Populations      agents alive per habitat
     ProjectorPlan    drag projectors and their aim in plan view
   Everything reading Stage stats codes defensively: the producers land
   concurrently, so any field can be null or missing.
   ========================================================================== */

const r2 = (v) => Math.round(v * 100) / 100;

/* ── Apex: section through the shed + the slide/peel split of gravity ────── */
export function ApexProfile({ apex, pitchDeg }) {
  const p = (pitchDeg * Math.PI) / 180;
  const slide = Math.sin(p);
  const peel = Math.cos(p);
  const A = APOTHEM;
  return (
    <div className="pjl-apex">
      <svg className="pjl-apex__svg" viewBox="-2.75 -4.45 5.5 4.75" aria-hidden="true">
        <line className="pjl-apex__ground" x1={-2.6} y1={0} x2={2.6} y2={0} />
        <polyline className="pjl-apex__shell" points={pts([[-A, 0], [-A, -2.25], [0, -apex], [A, -2.25], [A, 0]])} />
        <line className="pjl-apex__eave" x1={-A} y1={-2.25} x2={A} y2={-2.25} />
        <path className="pjl-apex__arc" d={`M ${A - 0.9} -2.25 A 0.9 0.9 0 0 0 ${A - 0.9 * Math.cos(p)} ${-2.25 - 0.9 * Math.sin(p)}`} />
        <text className="pjl-apex__deg" x={A - 1.15} y={-2.42} textAnchor="end">
          {pitchDeg.toFixed(1)}°
        </text>
      </svg>
      <div className="pjl-apex__bars">
        <span className="pjl-apex__k">slide</span>
        <span className="pjl-apex__bar">
          <i style={{ width: `${slide * 100}%` }} />
        </span>
        <span className="pjl-apex__v">{slide.toFixed(2)}</span>
        <span className="pjl-apex__k">peel</span>
        <span className="pjl-apex__bar">
          <i style={{ width: `${peel * 100}%` }} />
        </span>
        <span className="pjl-apex__v">{peel.toFixed(2)}</span>
      </div>
    </div>
  );
}

/* ── Throw ratio quick buttons (typical, not the mate's lens) ─────────────── */
export function ThrowQuick({ projector, value, onChange }) {
  const key = `p${projector}.throw`;
  return (
    <div className="pjl-throw">
      <span className="pjl-throw__tag">typical</span>
      {THROW_PRESETS.map((t) => {
        const on = Math.abs((value ?? 0) - t.value) < 0.006;
        return (
          <button key={t.label} type="button" className={`pjl-throw__btn${on ? ' is-on' : ''}`} aria-pressed={on} title={t.note} onClick={() => onChange(key, t.value)}>
            {t.label} <b>{t.value}</b>
          </button>
        );
      })}
      <span className="pjl-throw__calc">picture ≈ {num(3 / (value || 1), 1)} m wide from 3 m</span>
    </div>
  );
}

/* ── Coverage readout ─────────────────────────────────────────────────────── */
const COVER_ROWS = [
  { k: 'floor', label: 'Floor' },
  { k: 'wall', label: 'Walls' },
  { k: 'ceiling', label: 'Roof' },
  { k: 'total', label: 'Total' },
];

export function CoverageView({ coverage, dark = false }) {
  if (!coverage) {
    return <div className="pjl-wait">coverage — waiting for the projection model</div>;
  }
  const by = Array.isArray(coverage.byCount) ? coverage.byCount : null;
  return (
    <div className={`pjl-cov${dark ? ' pjl-cov--dark' : ''}`}>
      {COVER_ROWS.map((r) => {
        const v = coverage[r.k];
        return (
          <div key={r.k} className={`pjl-cov__row pjl-cov__row--${r.k}`}>
            <span className="pjl-cov__k">
              <span className={`pjl-dot pjl-dot--${r.k}`} />
              {r.label}
            </span>
            <span className="pjl-cov__bar">
              <i style={{ width: `${Number.isFinite(v) ? Math.max(0, Math.min(1, v)) * 100 : 0}%` }} />
            </span>
            <span className="pjl-cov__v">{pct(v)}</span>
          </div>
        );
      })}
      {by && by.length > 0 && (
        <div className="pjl-cov__by">
          <span className="pjl-cov__bytrack" aria-hidden="true">
            {by.map((f, i) => (
              <i key={i} className={`pjl-cov__seg pjl-cov__seg--${i}`} style={{ flexGrow: Math.max(0, f || 0) }} />
            ))}
          </span>
          <span className="pjl-cov__bylabel">
            {by.map((f, i) => (
              <span key={i}>
                {i === 0 ? 'dark' : `${i}×`} {pct(f)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

export function CoverageReadout({ stage }) {
  const s = useStats(stage);
  return <CoverageView coverage={s?.coverage || null} />;
}

/* ── Region map: every patch, click to edit ──────────────────────────────── */
const RING_IN = APOTHEM + 0.07;
const RING_OUT = APOTHEM + 0.62;
const rAt = (a) => a / Math.cos(Math.PI / 8);
// Fallback loft outline (plan coords) until the room reports the real patch:
// front edge from the SW flat to the N flat, back to the N|NW, NW|W, W|SW corners.
const LOFT_FALLBACK = [[-1.03, 2.05], [-0.18, -2.18], corner(0), corner(7), corner(6)];

function effType(values, p, id) {
  const t = readParam(values, `region.${id}.type`);
  if (t && t !== 'auto') return t;
  if (p?.typeAuto) return p.typeAuto;
  if (id.startsWith('roof')) return 'ceiling';
  if (id.startsWith('wall')) return 'wall';
  return 'floor';
}

function RegionShape({ id, d, points, type, on, sel, label, onPick, lx, ly, text }) {
  const cls = `pjl-rg pjl-rg--${type}${on ? '' : ' is-off'}${sel ? ' is-sel' : ''}`;
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(id);
    }
  };
  return (
    <g className={cls} role="button" tabIndex={0} aria-pressed={sel} aria-label={label} onClick={() => onPick(id)} onKeyDown={onKey}>
      {points ? <polygon points={points} /> : <path d={d} />}
      {text && (
        <text x={lx} y={ly} className="pjl-rg__t" textAnchor="middle" dominantBaseline="central">
          {text}
        </text>
      )}
    </g>
  );
}

const SYSTEM_SHORT = { off: 'off', grayscott: 'Gray-Scott', physarum: 'Physarum', particlelife: 'Particle Life', lenia: 'Lenia' };

export function RegionMap({ stage, patches, values, onChange, apply }) {
  const s = useStats(stage);
  const [sel, setSel] = useState('wall-N');
  const byId = Object.fromEntries((patches || []).map((p) => [p.id, p]));
  const covPatch = s?.coverage?.perPatch || null;

  const info = (id) => {
    const type = effType(values, byId[id], id);
    const on = readParam(values, `region.${id}.on`) !== false;
    return { type, on, label: `${patchName(id)} — ${TYPE_LABEL[type] || type}, ${on ? 'on' : 'off'}` };
  };

  const walls = FLATS.map((f, k) => {
    const id = `wall-${f}`;
    const poly = [corner(k, rAt(RING_IN)), corner(k + 1, rAt(RING_IN)), corner(k + 1, rAt(RING_OUT)), corner(k, rAt(RING_OUT))];
    const [nx, nz] = flatNormal(k);
    const m = (RING_IN + RING_OUT) / 2;
    return { id, points: pts(poly), lx: nx * m, ly: nz * m, text: f, ...info(id) };
  });
  const roofs = FLATS.map((f, k) => {
    const id = `roof-${f}`;
    const a = corner(k);
    const b = corner(k + 1);
    return { id, points: pts([[0, 0], a, b]), lx: (a[0] + b[0]) / 3, ly: (a[1] + b[1]) / 3, text: f, ...info(id) };
  });
  const loftPoly = byId.loft?.polygon ? byId.loft.polygon.map(floorLocalToPlan) : LOFT_FALLBACK;

  const selP = byId[sel];
  const selInfo = info(sel);
  const defs = regionParams(sel).map((d) =>
    d.key.endsWith('.type') ? { ...d, options: d.options.map((o) => ({ ...o, label: o.value === 'auto' ? 'Auto' : o.value === 'ceiling' ? 'Ceiling' : o.label })) } : d,
  );
  const sys = readParam(values, `region.${sel}.system`);
  const sysEff = sys && sys !== 'auto' ? sys : values[`life.sys.${selInfo.type}`];

  const allOn = () => {
    const ids = patches?.length ? patches.map((p) => p.id) : [...walls, ...roofs].map((w) => w.id).concat(['floor', 'loft']);
    const partial = {};
    for (const id of ids) {
      partial[`region.${id}.on`] = true;
      partial[`region.${id}.type`] = 'auto';
      partial[`region.${id}.system`] = 'auto';
    }
    apply(partial);
  };

  return (
    <div className="pjl-regions">
      <div className="pjl-regions__maps">
        <figure className="pjl-regions__fig">
          <svg viewBox="-3 -3 6 6" className="pjl-regions__svg">
            <title>Floor, loft and the eight walls, in plan</title>
            {walls.map((w) => (
              <RegionShape key={w.id} {...w} sel={sel === w.id} onPick={setSel} />
            ))}
            <RegionShape id="floor" points={pts(octagon(APOTHEM - 0.02))} sel={sel === 'floor'} onPick={setSel} lx={0.95} ly={0.4} text="floor" {...info('floor')} />
            <RegionShape id="loft" points={pts(loftPoly)} sel={sel === 'loft'} onPick={setSel} lx={-1.35} ly={-0.2} text="loft" {...info('loft')} />
          </svg>
          <figcaption>walls + floor · plan</figcaption>
        </figure>
        <figure className="pjl-regions__fig">
          <svg viewBox="-3 -3 6 6" className="pjl-regions__svg">
            <title>The eight roof facets, from above</title>
            {roofs.map((w) => (
              <RegionShape key={w.id} {...w} sel={sel === w.id} onPick={setSel} />
            ))}
          </svg>
          <figcaption>roof · from above</figcaption>
        </figure>
      </div>

      <div className="pjl-regions__ed" aria-live="polite">
        <div className="pjl-regions__head">
          <span className={`pjl-dot pjl-dot--${selInfo.type}`} />
          <span className="pjl-regions__name">{patchName(sel)}</span>
          <span className="pjl-regions__meta">
            {selP ? `${num(selP.area, 1)} m²` : ''}
            {covPatch && Number.isFinite(covPatch[sel]) ? ` · lit ${pct(covPatch[sel])}` : ''}
            {` · ${SYSTEM_SHORT[sysEff] || sysEff || '—'}`}
          </span>
        </div>
        {defs.map((d) =>
          d.type === 'toggle' ? (
            <Switch key={d.key} id={`pjl-c-${d.key}`} label="Region on" checked={readParam(values, d.key) !== false} onFlip={(v) => onChange(d.key, v)} />
          ) : (
            <ParamControl key={d.key} def={d} value={readParam(values, d.key)} onChange={onChange} />
          ),
        )}
        <button type="button" className="pjl-textbtn" onClick={allOn}>
          Reset every region to auto
        </button>
      </div>
    </div>
  );
}

/* ── Trait histograms, three habitat series ──────────────────────────────── */
const TRAITS = [
  { k: 'feet', label: 'Feet' },
  { k: 'grip', label: 'Grip' },
  { k: 'mass', label: 'Mass' },
  { k: 'swing', label: 'Swing' },
  { k: 'flight', label: 'Flight' },
];
const SERIES = [
  { k: 'floor', label: 'Floor' },
  { k: 'wall', label: 'Walls' },
  { k: 'ceiling', label: 'Roof' },
];

function share(arr) {
  const a = Array.isArray(arr) ? arr.map((v) => (Number.isFinite(v) ? v : 0)) : [];
  const sum = a.reduce((x, y) => x + y, 0);
  return sum > 0 ? a.map((v) => v / sum) : a.map(() => 0);
}

function fmtEdge(v) {
  if (!Number.isFinite(v)) return '';
  return Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2);
}

function TraitChart({ trait, h }) {
  const series = SERIES.map((s) => share(h?.[s.k]));
  const bins = Math.max(0, ...series.map((x) => x.length));
  if (!bins) return null;
  const max = Math.max(1e-9, ...series.flat());
  const W = 12;
  const edges = Array.isArray(h.edges) ? h.edges : [];
  const lo = edges[0];
  const hi = edges[edges.length - 1];
  const binLabel = (i) => (edges.length > i + 1 ? `${fmtEdge(edges[i])}–${fmtEdge(edges[i + 1])}` : `bin ${i + 1}`);
  return (
    <div className="pjl-hist__row">
      <span className="pjl-hist__k">{trait.label}</span>
      <div className="pjl-hist__plot">
        <svg viewBox={`0 0 ${bins * W} 30`} preserveAspectRatio="none" className="pjl-hist__svg" role="img" aria-label={`${trait.label} distribution by habitat`}>
          <line x1="0" y1="30" x2={bins * W} y2="30" className="pjl-hist__base" />
          {Array.from({ length: bins }, (_, i) => (
            <g key={i}>
              <title>
                {`${trait.label} ${binLabel(i)}: ` + SERIES.map((s, j) => `${s.label.toLowerCase()} ${Math.round((series[j][i] || 0) * 100)}%`).join(' · ')}
              </title>
              <rect x={i * W} y="0" width={W} height="30" className="pjl-hist__hit" />
              {SERIES.map((s, j) => {
                const v = series[j][i] || 0;
                const hh = (v / max) * 28;
                return <rect key={s.k} className={`pjl-hist__bar pjl-hist__bar--${s.k}`} x={i * W + 1 + j * 3.4} y={30 - hh} width={3} height={hh} />;
              })}
            </g>
          ))}
        </svg>
        <span className="pjl-hist__ax">
          <span>{fmtEdge(lo)}</span>
          <span>{fmtEdge(hi)}</span>
        </span>
      </div>
    </div>
  );
}

export function Histograms({ stage }) {
  const s = useStats(stage);
  const hs = s?.life?.histograms;
  const any = hs && TRAITS.some((t) => hs[t.k]);
  return (
    <div className="pjl-hist">
      <div className="pjl-legend">
        {SERIES.map((x) => (
          <span key={x.k} className="pjl-legend__i">
            <span className={`pjl-dot pjl-dot--${x.k}`} />
            {x.label}
          </span>
        ))}
        <span className="pjl-legend__note">share of each population</span>
      </div>
      {any ? TRAITS.map((t) => (hs[t.k] ? <TraitChart key={t.k} trait={t} h={hs[t.k]} /> : null)) : <div className="pjl-wait">histograms — waiting for creatures</div>}
    </div>
  );
}

/* ── Creature counters + populations ─────────────────────────────────────── */
const CR_KEYS = [
  { k: 'alive', label: 'alive' },
  { k: 'born', label: 'born' },
  { k: 'died', label: 'died' },
  { k: 'fell', label: 'fell' },
  { k: 'landed', label: 'landed' },
  { k: 'onAir', label: 'in flight' },
];

export function CreatureCounters({ stage }) {
  const s = useStats(stage);
  const c = s?.life?.creatures;
  return (
    <dl className="pjl-counters">
      {CR_KEYS.map((x) => (
        <div key={x.k} className="pjl-counters__c">
          <dt>{x.label}</dt>
          <dd>{c && Number.isFinite(c[x.k]) ? c[x.k] : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Populations({ stage }) {
  const s = useStats(stage);
  const p = s?.life?.populations;
  const ms = s?.life?.simMs;
  return (
    <div className="pjl-pops">
      {SERIES.map((x) => (
        <span key={x.k} className="pjl-pops__i">
          <span className={`pjl-dot pjl-dot--${x.k}`} />
          {x.label}
          <b>{p && Number.isFinite(p[x.k]) ? p[x.k].toLocaleString() : '—'}</b>
        </span>
      ))}
      {Number.isFinite(ms) && <span className="pjl-pops__ms">sim {ms.toFixed(1)} ms</span>}
    </div>
  );
}

/* ── Projector placement in plan view (drag the body, drag the aim) ───────── */
function rayToWall(px, pz, dx, dz) {
  let best = 6;
  for (let k = 0; k < 8; k++) {
    const [nx, nz] = flatNormal(k);
    const dn = dx * nx + dz * nz;
    if (dn <= 1e-6) continue;
    const t = (APOTHEM - (px * nx + pz * nz)) / dn;
    if (t > 0 && t < best) best = t;
  }
  return best;
}

export function ProjectorPlan({ values, apply, count, patches }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const loftPoly = patches?.find((p) => p.id === 'loft')?.polygon?.map(floorLocalToPlan) || LOFT_FALLBACK;

  const toPlan = (e) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  const setPos = (i, px, pz) => {
    const [cx, cz] = clampToOctagon(px, pz, 0.1);
    const [x, z] = planToWorld(cx, cz);
    apply({ [`p${i}.x`]: r2(x), [`p${i}.z`]: r2(z) });
  };
  const setAim = (i, px, pz) => {
    const x = values[`p${i}.x`] - C;
    const z = values[`p${i}.z`] - C;
    const yaw = (Math.atan2(px - x, -(pz - z)) * 180) / Math.PI;
    apply({ [`p${i}.yaw`]: Math.round(yaw) });
  };
  const down = (i, mode) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { i, mode };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toPlan(e);
    if (!p) return;
    if (d.mode === 'pos') setPos(d.i, p[0], p[1]);
    else setAim(d.i, p[0], p[1]);
  };
  const up = () => {
    drag.current = null;
  };
  const keyPos = (i) => (e) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    setPos(i, values[`p${i}.x`] - C + dir[0] * step, values[`p${i}.z`] - C + dir[1] * step);
  };
  const keyAim = (i) => (e) => {
    const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
    if (!d) return;
    e.preventDefault();
    let y = (values[`p${i}.yaw`] || 0) + (e.shiftKey ? d * 3 : d);
    if (y > 180) y -= 360;
    if (y < -180) y += 360;
    apply({ [`p${i}.yaw`]: y });
  };

  const projs = [];
  for (let i = 0; i < count; i++) {
    const x = (values[`p${i}.x`] ?? C) - C;
    const z = (values[`p${i}.z`] ?? C) - C;
    const yaw = ((values[`p${i}.yaw`] ?? 0) * Math.PI) / 180;
    const pitch = values[`p${i}.pitch`] ?? 0;
    const thr = Math.max(0.1, values[`p${i}.throw`] ?? 1);
    const half = Math.atan(1 / (2 * thr));
    const dir = (a) => [Math.sin(a), -Math.cos(a)];
    const steep = Math.abs(pitch) > 55;
    const dc = dir(yaw);
    const d1 = dir(yaw - half);
    const d2 = dir(yaw + half);
    const t1 = rayToWall(x, z, ...d1);
    const tc = rayToWall(x, z, ...dc);
    const t2 = rayToWall(x, z, ...d2);
    const cone = [[x, z], [x + d1[0] * t1, z + d1[1] * t1], [x + dc[0] * tc, z + dc[1] * tc], [x + d2[0] * t2, z + d2[1] * t2]];
    const hl = Math.min(0.75, tc * 0.6);
    projs.push({ i, x, z, cone, steep, pitch, handle: [x + dc[0] * hl, z + dc[1] * hl] });
  }

  return (
    <figure className="pjl-pplan">
      <svg ref={svgRef} viewBox="-2.75 -2.75 5.5 5.5" className="pjl-pplan__svg" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <title>Projector placement, plan view (north up)</title>
        <polygon className="pjl-pplan__room" points={pts(octagon())} />
        <polygon className="pjl-pplan__loft" points={pts(loftPoly)} />
        <text className="pjl-pplan__lbl" x={-1.3} y={0.05} textAnchor="middle">
          loft
        </text>
        <line className="pjl-pplan__door" x1={-0.47} y1={APOTHEM} x2={0.47} y2={APOTHEM} />
        <text className="pjl-pplan__lbl" x={0} y={APOTHEM - 0.18} textAnchor="middle">
          door
        </text>
        <text className="pjl-pplan__lbl pjl-pplan__n" x={0} y={-CIRCUM - 0.12} textAnchor="middle">
          N
        </text>
        {projs.map((p) => (
          <g key={p.i} className="pjl-pplan__p">
            {p.steep ? (
              <circle className="pjl-pplan__cone" cx={p.x} cy={p.z} r={0.5} />
            ) : (
              <polygon className="pjl-pplan__cone" points={pts(p.cone)} />
            )}
            {!p.steep && (
              <circle
                className="pjl-pplan__aim"
                cx={p.handle[0]}
                cy={p.handle[1]}
                r={0.12}
                tabIndex={0}
                role="slider"
                aria-label={`Projector ${p.i + 1} heading`}
                aria-valuenow={values[`p${p.i}.yaw`]}
                aria-valuemin={-180}
                aria-valuemax={180}
                onPointerDown={down(p.i, 'aim')}
                onKeyDown={keyAim(p.i)}
              />
            )}
            <circle
              className="pjl-pplan__body"
              cx={p.x}
              cy={p.z}
              r={0.2}
              tabIndex={0}
              role="button"
              aria-label={`Projector ${p.i + 1} position — arrow keys move it`}
              onPointerDown={down(p.i, 'pos')}
              onKeyDown={keyPos(p.i)}
            />
            <text className="pjl-pplan__num" x={p.x} y={p.z} textAnchor="middle" dominantBaseline="central">
              {p.i + 1}
            </text>
            {p.steep && (
              <text className="pjl-pplan__lbl" x={p.x} y={p.z + 0.72} textAnchor="middle">
                {p.pitch > 0 ? 'aims up' : 'aims down'}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption>drag a projector · drag its aim dot · arrow keys work too</figcaption>
    </figure>
  );
}
