import { useEffect, useMemo, useRef, useState } from 'react';
import { PLANE } from '../../content/bottleneck';
import { planeFit, planeFrame, project, meterFrac, anglesFrom, fill, fmtSig, clamp } from '../../maths/bottleneck';
import { StageHead, Lines } from './Parts';

/* ============================================================================
   BOTTLENECK · STAGE 1 — THE PLANE (slides 8–9)
   ----------------------------------------------------------------------------
   The page's own 60 points in 3D, a plane through their mean, and a grey
   line from every point x to its reconstruction x′ on the plane (slide 9's
   picture: bright / light red = above / below, blue = the projections).
   Two sliders (its tilt along x1 and along x2), a drag on the picture or
   the arrow keys move the plane; the meter is the reconstruction MSE. Enter locks the plane,
   graded by its angle to the PCA plane (maths/bottleneck.js).
   ========================================================================== */
const W = 420;
const H = 300;
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const fmtDeg = (v) => `${v}°`.replace('-', '−');

export function PlaneStage({ item, round }) {
  const [ang, setAng] = useState(() => item.start.slice());
  const drag = useRef(null);
  const live = round.state === 'play' && !round.feedback;
  const { X, mean, floor, top } = item.cloud;
  const [lo, hi] = item.range;
  const shown = [Math.round(ang[0]), Math.round(ang[1])];
  const fit = planeFit(X, mean, shown);
  const frac = meterFrac(fit.mse, floor, top);

  // the drawing: centred on the mean, scaled to fit, projected once per angle
  const geo = useMemo(() => {
    const C = X.map((p) => p.map((v, j) => v - mean[j]));
    const R = Math.max(...C.map((d) => Math.hypot(d[0], d[1], d[2])));
    const S = 112 / R;
    const P = (d) => {
      const [x, y, z] = project(d);
      return [W / 2 + x * S, H / 2 + 6 + y * S, z];
    };
    return { C, R, P };
  }, [X, mean]);

  const quad = (angles, k = 1.05) => {
    const { u, v } = planeFrame(angles);
    const a = geo.R * k;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, t]) => geo.P(u.map((uj, j) => a * (s * uj + t * v[j]))).slice(0, 2).join(',')).join(' ');
  };

  const pts = geo.C.map((d, i) => {
    const r = d.map((v, j) => v - fit.dist[i] * fit.n[j]);
    const [x, y, z] = geo.P(d);
    const [rx, ry] = geo.P(r);
    return { i, x, y, z, rx, ry, above: fit.dist[i] >= 0 };
  }).sort((a, b) => a.z - b.z);

  const submit = () => { if (live) round.submit(shown); };
  const nudge = (da, db) => setAng(([a, b]) => [clamp(Math.round(a) + da, lo, hi), clamp(Math.round(b) + db, lo, hi)]);

  // keys: ← → the x1 tilt, ↑ ↓ the x2 tilt (Shift = ×5), Enter locks; a focused slider handles its own arrows
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (e.key === 'Enter') {
        if (/^(textarea|select)$/i.test(tag) || (tag === 'BUTTON' && !e.target.dataset?.enter)) return;
        e.preventDefault();
        submit();
        return;
      }
      if (/^(input|textarea|select)$/i.test(tag)) return;
      const k = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-k, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(k, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, k); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, -k); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDown = (e) => {
    if (!live) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || !live) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setAng(([a, b]) => [clamp(a + dx * 0.4, lo, hi), clamp(b - dy * 0.4, lo, hi)]);
  };
  const onUp = () => { drag.current = null; };

  const fb = round.feedback;
  const target = fb ? anglesFrom(item.normal) : null;
  const o = [44, H - 30];

  return (
    <>
      <StageHead item={item} round={round} />
      <div className="dla-stagegrid dla-bn__grid">
        <div className="dla-floor dla-bn__floor">
          <svg
            className={`dla-svg dla-bn__cloud${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Sixty 3D points and a plane: ${PLANE.controls.a} ${shown[0]} degrees, ${PLANE.controls.b} ${shown[1]} degrees; reconstruction MSE ${fmtSig(fit.mse)}. Drag to tilt the plane.`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <polygon className="dla-bn__plane" points={quad(shown)} style={{ '--q': 1 - frac }} />
            {pts.map((p) => <line key={`r${p.i}`} className="dla-bn__res" x1={p.x} y1={p.y} x2={p.rx} y2={p.ry} />)}
            {pts.map((p) => <rect key={`p${p.i}`} className="dla-bn__proj" x={p.rx - 1.8} y={p.ry - 1.8} width="3.6" height="3.6" />)}
            {pts.map((p) => <circle key={`x${p.i}`} className={`dla-bn__pt${p.above ? '' : ' dla-bn__pt--below'}`} cx={p.x} cy={p.y} r="3.6" />)}
            {target && <polygon className="dla-bn__target" points={quad(target, 1.12)} />}
            <g className="dla-bn__axes" aria-hidden="true">
              {AXES.map((a, k) => {
                const [x, y] = project(a);
                return (
                  <g key={k}>
                    <line x1={o[0]} y1={o[1]} x2={o[0] + x * 22} y2={o[1] + y * 22} />
                    <text className="dla-t--xs" x={o[0] + x * 31} y={o[1] + y * 31 + 3} textAnchor="middle">{PLANE.axes[k]}</text>
                  </g>
                );
              })}
            </g>
          </svg>
          <p className="dla-bn__legend">
            <span><i className="dla-bn__sw dla-bn__sw--above" />{PLANE.legend.above}</span>
            <span><i className="dla-bn__sw dla-bn__sw--below" />{PLANE.legend.below}</span>
            <span><i className="dla-bn__sw dla-bn__sw--proj" />{PLANE.legend.proj}</span>
            <span className="dla-own">{PLANE.own}</span>
          </p>
        </div>
        <div className="dla-bn__side">
          <div className="dla-bn__meter" aria-live="polite">
            <span className="dla-k">{PLANE.meter.label}</span>
            <span className="dla-bn__mse">{fmtSig(fit.mse)}</span>
            <span className="dla-bn__bar" aria-hidden="true"><span className="dla-bn__fill" style={{ transform: `scaleX(${Math.max(0.015, frac)})` }} /></span>
            {item.showFloor && <span className="dla-bn__floorv">{PLANE.meter.floor} {fmtSig(floor)}</span>}
          </div>
          <label className="dla-bn__slider">
            <span className="dla-k">{PLANE.controls.a}</span>
            <input type="range" min={lo} max={hi} step="1" value={shown[0]} disabled={!live} onChange={(e) => setAng(([, b]) => [Number(e.target.value), b])} aria-label={`${PLANE.controls.a}, degrees`} />
            <output>{fmtDeg(shown[0])}</output>
          </label>
          <label className="dla-bn__slider">
            <span className="dla-k">{PLANE.controls.b}</span>
            <input type="range" min={lo} max={hi} step="1" value={shown[1]} disabled={!live} onChange={(e) => setAng(([a]) => [a, Number(e.target.value)])} aria-label={`${PLANE.controls.b}, degrees`} />
            <output>{fmtDeg(shown[1])}</output>
          </label>
          <button type="button" className="dla-btn dla-btn--primary dla-bn__go" onClick={submit} disabled={!live}>
            {PLANE.controls.lock} <span className="dla-btn__key">Enter</span>
          </button>
        </div>
      </div>
      <Lines lines={PLANE.drawer} extra={<p className="dla-mline">{fill(PLANE.live, { mse: fmtSig(fit.mse) })}{item.showFloor && fill(PLANE.liveFloor, { floor: fmtSig(floor) })}</p>} />
    </>
  );
}
