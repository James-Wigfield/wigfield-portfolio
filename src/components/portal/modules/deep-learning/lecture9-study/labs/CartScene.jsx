import { X_LIMIT, THETA_LIMIT } from '../cartpole';

/* ============================================================================
   THE CARTPOLE PICTURE (this page's port; ../cartpole.js)
   ----------------------------------------------------------------------------
   The track with its ±2.4 limits, the cart, the pole at its angle (0 =
   vertical, positive = clockwise, as slide 17 defines it), the ±12° fan the
   pole must stay inside, and the push: an arrow in the action colour on the
   side the cart is pushed towards. When the episode is over (done) the pole
   turns the negative-reward colour.
     obs        [x, x_dot, theta, theta_dot]
     action     0 (left) · 1 (right) · null (nothing pushed yet)
     W          the drawing's width in px (the viewBox); the height is fixed
     mini       a small filmstrip frame (no labels)
   ========================================================================== */

export default function CartScene({ obs, action = null, done = false, W = 640, H = 200, mini = false, label, className = '' }) {
  const pad = mini ? 10 : 34;
  const trackY = H - (mini ? 28 : 44);
  const scale = (W - 2 * pad) / (2 * X_LIMIT);
  const toX = (x) => W / 2 + x * scale;
  const [x, , theta] = obs;
  const cx = toX(Math.max(-X_LIMIT * 1.08, Math.min(X_LIMIT * 1.08, x)));
  const cartW = mini ? 26 : 52;
  const cartH = mini ? 13 : 24;
  const hingeY = trackY - cartH;
  const L = Math.min(scale * 1.0, trackY - 18); // the pole is 2 × 0.5 = 1.0 long
  const tipX = cx + L * Math.sin(theta);
  const tipY = hingeY - L * Math.cos(theta);
  const fan = (s) => [cx + L * 0.92 * Math.sin(s * THETA_LIMIT), hingeY - L * 0.92 * Math.cos(s * THETA_LIMIT)];
  const [lx, ly] = fan(-1);
  const [rx, ry] = fan(1);
  const push = action === null ? null : action === 1 ? 1 : -1;
  const ax0 = cx - push * (cartW / 2 + 34);
  const ax1 = cx - push * (cartW / 2 + 4);
  return (
    <svg className={`dl9s-svg dl9s-cart ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? `CartPole: cart at ${x.toFixed(2)}, pole at ${(theta * 180 / Math.PI).toFixed(1)} degrees${done ? ', the episode is over' : ''}`}>
      {/* track and its limits */}
      <line x1={pad - 10} y1={trackY} x2={W - pad + 10} y2={trackY} className="dl9s-cart__track" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <line x1={toX(s * X_LIMIT)} y1={trackY - (mini ? 16 : 30)} x2={toX(s * X_LIMIT)} y2={trackY + 6} className="dl9s-cart__limit" />
          {!mini && <text x={toX(s * X_LIMIT)} y={trackY + 20} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{s < 0 ? '−2.4' : '+2.4'}</text>}
        </g>
      ))}
      <line x1={toX(0)} y1={trackY} x2={toX(0)} y2={trackY + 6} className="dl9s-cart__tick" />
      {!mini && <text x={toX(0)} y={trackY + 20} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">0</text>}
      {/* the ±12° fan */}
      <path d={`M${lx} ${ly} L${cx} ${hingeY} L${rx} ${ry}`} className="dl9s-cart__fan" />
      {!mini && <text x={rx + 4} y={ry + 4} className="dl9s-t dl9s-t--xs dl9s-t--m">12°</text>}
      {/* cart, pole, hinge */}
      <rect x={cx - cartW / 2} y={hingeY} width={cartW} height={cartH} rx={3} className="dl9s-cart__cart" />
      <line x1={cx} y1={hingeY} x2={tipX} y2={tipY} className={`dl9s-cart__pole${done ? ' dl9s-cart__pole--done' : ''}`} style={{ strokeWidth: mini ? 4 : 7 }} />
      <circle cx={cx} cy={hingeY} r={mini ? 2.5 : 4} className="dl9s-cart__hinge" />
      {/* the push */}
      {push !== null && !done && (
        <g className="dl9s-cart__push">
          <line x1={ax0} y1={hingeY + cartH / 2} x2={ax1 - push * 6} y2={hingeY + cartH / 2} />
          <polygon points={`${ax1},${hingeY + cartH / 2} ${ax1 - push * 9},${hingeY + cartH / 2 - 6} ${ax1 - push * 9},${hingeY + cartH / 2 + 6}`} />
        </g>
      )}
    </svg>
  );
}
