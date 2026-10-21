import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { Lab, Chips, Range, Stat } from '../ui';
import { useStudy } from '../context';
import { CAPTIONS } from '../slideData';
import { useReducedMotion } from '../hooks';
import { X3, PCA3, RUN } from '../aeRun';
import { AE_DEFAULTS, trainAE, encode, reconstruct, decoderPlane, planeAngle, codeAxes, dot, norm, fmt } from '../ae';
import './labsPca.css';

/* ============================================================================
   LECTURE 5 STUDY — LAB FOR §3
     PcaLab   slides 8–9 for real: Figure 17-1's linear autoencoder (Dense(2)
              → Dense(3), no activation, MSE, SGD) trained in the browser on
              this page's own 60 points, replayed epoch by epoch —
                · the 3D set with the learned plane (blue) and PCA's plane
                  (dashed), each point joined to its reconstruction
                · the loss falling towards PCA's error
                · the 2D codings beside PCA's 2D projection: the same picture
                  up to a rotation, stretch and skew
   Nothing here is the slide's figure; the slide's data isn't given.
   ========================================================================== */

const LRS = [0.5, 0.1, 0.02];
const RUNS = new Map([[AE_DEFAULTS.lr, RUN]]);
const runFor = (lr) => {
  if (!RUNS.has(lr)) RUNS.set(lr, trainAE(X3, { ...AE_DEFAULTS, lr }));
  return RUNS.get(lr);
};

// unit vectors spanning a plane, from two vectors in it
function frame(a, b) {
  const u = a.map((v) => v / norm(a));
  const w = b.map((v, i) => v - dot(b, u) * u[i]);
  return [u, w.map((v) => v / norm(w))];
}

// the corners of a patch of the plane (centre c, frame u, v) that covers pts
function patch(c, [u, v], pts, pad = 0.15) {
  let a0 = 0;
  let a1 = 0;
  let b0 = 0;
  let b1 = 0;
  pts.forEach((p) => {
    const d = p.map((x, i) => x - c[i]);
    const a = dot(d, u);
    const b = dot(d, v);
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  });
  const at = (a, b) => c.map((x, i) => x + a * u[i] + b * v[i]);
  return [at(a0 - pad, b0 - pad), at(a1 + pad, b0 - pad), at(a1 + pad, b1 + pad), at(a0 - pad, b1 + pad)];
}

/* ── the 3D view: orthographic, x3 up, turned by the azimuth slider ─────── */
const W3 = 380;
const H3 = 300;
function makeView(az, el = 22) {
  const t = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const c = PCA3.mean;
  const s = 108;
  return (p) => {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    const z = p[2] - c[2];
    const xr = Math.cos(t) * x - Math.sin(t) * y;
    const yr = Math.sin(t) * x + Math.cos(t) * y;
    return [W3 / 2 + s * xr, H3 / 2 - s * (z * Math.cos(e) - yr * Math.sin(e)), yr];
  };
}

function View3D({ ae, az, showPca, hover, onHover }) {
  const view = useMemo(() => makeView(az), [az]);
  const recon = X3.map((p) => reconstruct(ae, p));
  const plane = decoderPlane(ae);
  const centre = recon.reduce((s, p) => s.map((v, i) => v + p[i] / recon.length), [0, 0, 0]);
  const fr = frame(plane.basis[0], plane.basis[1]);
  const aePatch = patch(centre, fr, recon).map(view);
  const pcaPatch = patch(PCA3.mean, [PCA3.comps[0], PCA3.comps[1]], X3).map(view);
  const pts = X3.map((p, i) => {
    const side = dot(p.map((v, j) => v - recon[i][j]), plane.normal) >= 0;
    return { i, p: view(p), r: view(recon[i]), above: side };
  }).sort((a, b) => b.p[2] - a.p[2]);
  const poly = (ps) => ps.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const axis = (v, label) => {
    const o = view(PCA3.mean.map((m, i) => m - [1.35, 1.0, 0.85][i]));
    const e = view(PCA3.mean.map((m, i) => m - [1.35, 1.0, 0.85][i] + v[i] * 0.45));
    return (
      <g key={label}>
        <line x1={o[0]} y1={o[1]} x2={e[0]} y2={e[1]} className="dl5s-pca__axis" />
        <text x={e[0] + (e[0] - o[0]) * 0.25} y={e[1] + (e[1] - o[1]) * 0.25 + 3} textAnchor="middle" className="dl5s-tick">{label}</text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W3} ${H3}`} className="dl5s-svg dl5s-pca__v3" role="img" aria-label="The 60 training points in 3D, the autoencoder's plane, PCA's plane, and each point joined to its reconstruction on the autoencoder's plane">
      <polygon points={poly(aePatch)} className="dl5s-pca__plane" />
      {showPca && <polygon points={poly(pcaPatch)} className="dl5s-pca__pcaplane" />}
      {axis([1, 0, 0], 'x₁')}
      {axis([0, 1, 0], 'x₂')}
      {axis([0, 0, 1], 'x₃')}
      {pts.map(({ i, p, r, above }) => (
        <g key={i} className={hover === i ? 'dl5s-pca__pt dl5s-pca__pt--on' : 'dl5s-pca__pt'} onPointerEnter={() => onHover(i)} onPointerLeave={() => onHover(null)}>
          <line x1={p[0]} y1={p[1]} x2={r[0]} y2={r[1]} className={above ? 'dl5s-pca__drop' : 'dl5s-pca__drop dl5s-pca__drop--below'} />
          <path d={`M${r[0] - 3} ${r[1]} H${r[0] + 3} M${r[0]} ${r[1] - 3} V${r[1] + 3}`} className="dl5s-pca__proj" />
          <circle cx={p[0]} cy={p[1]} r={hover === i ? 5.5 : 3.6} className={above ? 'dl5s-pca__dot' : 'dl5s-pca__dot dl5s-pca__dot--below'} />
          <circle cx={p[0]} cy={p[1]} r={9} className="dl5s-pca__hit"><title>{`point ${i + 1}`}</title></circle>
        </g>
      ))}
    </svg>
  );
}

/* ── a 2D scatter with equal axes (codings or PCA projection) ────────────── */
const S2 = 220;
function Scatter2D({ pts, xl, yl, hover, onHover, label, shade }) {
  const ext = Math.max(...pts.flat().map((v) => Math.abs(v))) * 1.12 || 1;
  const m = 26;
  const sx = (v) => m + ((v + ext) / (2 * ext)) * (S2 - 2 * m);
  const sy = (v) => S2 - m - ((v + ext) / (2 * ext)) * (S2 - 2 * m);
  return (
    <svg viewBox={`0 0 ${S2} ${S2}`} className="dl5s-svg dl5s-pca__s2" role="img" aria-label={label}>
      <line x1={sx(-ext)} y1={sy(0)} x2={sx(ext)} y2={sy(0)} className="dl5s-gridline" />
      <line x1={sx(0)} y1={sy(-ext)} x2={sx(0)} y2={sy(ext)} className="dl5s-gridline" />
      <text x={S2 - 6} y={sy(0) - 5} textAnchor="end" className="dl5s-tick">{xl}</text>
      <text x={sx(0) + 5} y={14} className="dl5s-tick">{yl}</text>
      {pts.map((p, i) => (
        <g key={i} onPointerEnter={() => onHover(i)} onPointerLeave={() => onHover(null)}>
          <circle cx={sx(p[0])} cy={sy(p[1])} r={hover === i ? 5.5 : 3.6} className={`dl5s-pca__c${hover === i ? ' dl5s-pca__c--on' : ''}`} style={{ '--t': shade[i] }} />
          <circle cx={sx(p[0])} cy={sy(p[1])} r={8} className="dl5s-pca__hit"><title>{`point ${i + 1}: (${fmt(p[0], 2)}, ${fmt(p[1], 2)})`}</title></circle>
        </g>
      ))}
    </svg>
  );
}

/* ── the loss curve ──────────────────────────────────────────────────────── */
const WL = 380;
const HL = 170;
function LossChart({ history, epoch, floor }) {
  const m = { l: 44, r: 12, t: 12, b: 26 };
  const lo = Math.log10(Math.min(floor, ...history) * 0.8);
  const hi = Math.log10(Math.max(...history) * 1.2);
  const n = history.length - 1;
  const sx = (e) => m.l + (e / n) * (WL - m.l - m.r);
  const sy = (v) => m.t + ((hi - Math.log10(v)) / (hi - lo)) * (HL - m.t - m.b);
  const path = history.slice(0, epoch + 1).map((v, e) => `${e ? 'L' : 'M'}${sx(e).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  const ticks = [];
  for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) ticks.push(10 ** k);
  return (
    <svg viewBox={`0 0 ${WL} ${HL}`} className="dl5s-svg" role="img" aria-label={`Training loss over ${n} epochs on a log scale, falling towards PCA's error`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} y1={sy(t)} x2={WL - m.r} y2={sy(t)} className="dl5s-gridline" />
          <text x={m.l - 5} y={sy(t) + 3} textAnchor="end" className="dl5s-tick">{t >= 1 ? t : t.toExponential(0)}</text>
        </g>
      ))}
      {[0, 100, 200, 300, 400, 500].filter((e) => e <= n).map((e) => <text key={e} x={sx(e)} y={HL - 8} textAnchor="middle" className="dl5s-tick">{e}</text>)}
      <line x1={m.l} y1={sy(floor)} x2={WL - m.r} y2={sy(floor)} className="dl5s-pca__floor" />
      <text x={m.l + 6} y={sy(floor) + 13} className="dl5s-svg__label">PCA’s error {fmt(floor, 5)}</text>
      <path d={path} className="dl5s-pca__loss" />
      <line x1={sx(epoch)} y1={m.t} x2={sx(epoch)} y2={HL - m.b} className="dl5s-marker" />
      <circle cx={sx(epoch)} cy={sy(history[epoch])} r={4} className="dl5s-pca__now" />
    </svg>
  );
}

export function PcaLab() {
  const { printing } = useStudy();
  const reduced = useReducedMotion();
  const [lr, setLr] = useState(AE_DEFAULTS.lr);
  const [snap, setSnap] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [az, setAz] = useState(-50);
  const [showPca, setShowPca] = useState(true);
  const [hover, setHover] = useState(null);
  const run = useMemo(() => runFor(lr), [lr]);
  const last = run.snaps.length - 1;
  const at = printing ? last : Math.min(snap, last);
  const { epoch, ae } = run.snaps[at];

  useEffect(() => {
    if (!playing) return undefined;
    const id = setTimeout(() => {
      if (at >= last) setPlaying(false);
      else setSnap(reduced ? last : at + 1);
    }, reduced ? 0 : 45);
    return () => clearTimeout(id);
  }, [playing, at, last, reduced]);

  const plane = decoderPlane(ae);
  const tilt = planeAngle(plane.normal, PCA3.comps[2]);
  const axes = codeAxes(ae);
  const codes = X3.map((p) => encode(ae, p));
  const shade = useMemo(() => {
    const v = PCA3.proj.map((p) => p[0]);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return v.map((x) => (x - lo) / (hi - lo));
  }, []);
  const loss = run.history[epoch];
  const hp = hover == null ? null : { x: X3[hover], z: codes[hover], p: PCA3.proj[hover] };

  return (
    <Lab
      title="Train the linear autoencoder, watch it find PCA’s plane"
      fig={CAPTIONS.slide9}
      slides="slides 8–9"
      tryThis="before pressing Train, predict where the blue plane will settle. Then compare the codings with PCA’s projection: notice the same layout, but turned, stretched and skewed. Lower the learning rate and see whether 500 epochs is still enough."
    >
      <div className="dl-lab__controls">
        <div className="dl5s-pca__run">
          <button type="button" className="dl-btn dl5s-ibtn" onClick={() => { if (at >= last) setSnap(0); setPlaying((p) => !p); }} aria-pressed={playing}>
            <Icon name={playing ? 'pause' : 'arrowRight'} size={14} /> {playing ? 'Pause' : at >= last ? 'Train again' : at > 0 ? 'Resume' : 'Train'}
          </button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setSnap(0); }} disabled={at === 0}>Reset to epoch 0</button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setSnap(last); }} disabled={at === last}>Jump to epoch {AE_DEFAULTS.epochs}</button>
        </div>
        <Range label="epoch" value={at} min={0} max={last} onChange={(v) => { setPlaying(false); setSnap(v); }} fmt={() => `${epoch} of ${AE_DEFAULTS.epochs}`} />
        <Chips label="learning_rate" code value={lr} options={LRS.map((v) => ({ v, l: String(v), tag: v === 0.5 ? 'slide 8' : undefined }))} onChange={(v) => { setPlaying(false); setLr(v); }} />
        <Range label="turn the 3D view" value={az} min={-180} max={180} step={5} onChange={setAz} fmt={(v) => `${v}°`} />
        <label className="dl-check"><input type="checkbox" checked={showPca} onChange={(e) => setShowPca(e.target.checked)} /> show PCA’s plane (dashed)</label>
      </div>

      <div className="dl5s-pca__top">
        <figure className="dl5s-pca__fig">
          <figcaption className="dl5s-stagehead">The 3D training set and the learned plane · epoch {epoch}</figcaption>
          <div className="dl5s-wide"><View3D ae={ae} az={az} showPca={showPca} hover={hover} onHover={setHover} /></div>
          <p className="dl5s-pca__key">
            <span><i className="dl5s-pca__k dl5s-pca__k--above" /> above the blue plane</span>
            <span><i className="dl5s-pca__k dl5s-pca__k--below" /> below it</span>
            <span><i className="dl5s-pca__k dl5s-pca__k--proj" /> its reconstruction (on the plane)</span>
            {showPca && <span><i className="dl5s-pca__k dl5s-pca__k--pca" /> PCA’s plane</span>}
          </p>
        </figure>
        <figure className="dl5s-pca__fig">
          <figcaption className="dl5s-stagehead">Training loss by epoch (MSE, log scale)</figcaption>
          <div className="dl5s-wide"><LossChart history={run.history} epoch={epoch} floor={PCA3.mse} /></div>
          <div className="dl5s-stats dl5s-stats--tight">
            <Stat k="loss now" v={fmt(loss, 5)} sub={`epoch ${epoch}`} />
            <Stat k="tilt from PCA’s plane" v={`${fmt(tilt, 1)}°`} tone={tilt < 1 ? 'accent' : undefined} sub="angle between the two planes" />
            <Stat k="angle between code axes" v={`${fmt(axes.angle, 0)}°`} sub={`lengths ${fmt(axes.lengths[0], 2)} and ${fmt(axes.lengths[1], 2)}; PCA’s axes: 90°, equal`} />
          </div>
        </figure>
      </div>

      <div className="dl5s-pca__pair">
        <figure className="dl5s-pca__fig">
          <figcaption className="dl5s-stagehead"><code>codings = encoder.predict(X_train)</code> · epoch {epoch}</figcaption>
          <Scatter2D pts={codes} xl="z₁" yl="z₂" hover={hover} onHover={setHover} shade={shade} label="The 60 points' 2D codings from the autoencoder" />
        </figure>
        <figure className="dl5s-pca__fig">
          <figcaption className="dl5s-stagehead">PCA’s 2D projection (first two components)</figcaption>
          <Scatter2D pts={PCA3.proj} xl="PC1" yl="PC2" hover={hover} onHover={setHover} shade={shade} label="The 60 points projected onto PCA's first two principal components" />
        </figure>
        <p className="dl5s-readout dl5s-pca__hover" aria-live="polite">
          {hp ? (
            <>Point {hover + 1}: x = ({hp.x.map((v) => fmt(v, 2)).join(', ')}) · codings ({fmt(hp.z[0], 2)}, {fmt(hp.z[1], 2)}) · PCA ({fmt(hp.p[0], 2)}, {fmt(hp.p[1], 2)})</>
          ) : (
            <>Hover a point to find it in all three views. Shading runs light to dark along PCA’s first component, in both scatters.</>
          )}
        </p>
      </div>

      <p className="dl5s-cap">
        <span className="dl5s-own">this page’s own run</span> {X3.length} points of this page’s own 3D data (seeded; the slide’s data isn’t given), PCA from
        their 3×3 covariance matrix, and the autoencoder trained here as slides 8–9 set it up (SGD, MSE, 500 epochs), with learning_rate={lr}{lr !== AE_DEFAULTS.lr ? ' in this run (slide 8 uses 0.5)' : ''} and mini-batches of 32 (Keras’s default; no slide gives one). PCA keeps
        {' '}{fmt(PCA3.explained[0] * 100 + PCA3.explained[1] * 100, 1)}% of this set’s variance in its plane. PCA’s error is the smallest mean squared
        error any flat 2D code can reach on these points. At epoch {AE_DEFAULTS.epochs} with the slide’s learning rate, the autoencoder’s plane is within{' '}
        {fmt(planeAngle(decoderPlane(RUN.ae).normal, PCA3.comps[2]), 1)}° of PCA’s and its loss is {fmt(RUN.history[RUN.history.length - 1], 5)} against PCA’s {fmt(PCA3.mse, 5)}. Its code
        axes, though, meet at {fmt(codeAxes(RUN.ae).angle, 0)}° and have different lengths, so the codings are PCA’s projection turned, stretched and
        skewed: the same subspace, not the same axes.
      </p>
    </Lab>
  );
}
