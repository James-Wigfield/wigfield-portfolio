import { APP_W, APP_H, CAP_SCALE, LOOK, MAX_Z, STAGE_H, STAGE_W, SUBJECT, WIDE_Z } from './looks';

/* ============================================================================
   PSMA APP GUIDE — CAMERA AND CANVAS MARKS
   ----------------------------------------------------------------------------
   A camera is { cx, cy, z }: the app point (cx, cy) (CSS px of the captured
   1920 x 1080 window) sits at the subject area's centre, z stage px per app px.
   A move between two cameras is a pure zoom about the one point both views
   share when the zoom changes (no swerve on a push-in), a straight pan when it
   does not; the zoom is interpolated geometrically, so it reads as even speed.

   Everything drawn here is the motion layer around the real captures: the
   window's frame and shadow, the spotlight, highlight rings, leaders, the
   cursor and its click ripple. The captures themselves are drawn untouched
   (scaled by the camera, with high-quality smoothing).
   ========================================================================== */

const ANCHOR = [SUBJECT.x + SUBJECT.w / 2, SUBJECT.y + SUBJECT.h / 2];
export const WIDE = { cx: APP_W / 2, cy: APP_H / 2, z: WIDE_Z };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The camera that frames app rect [x, y, w, h] in the subject area (pad in app px). */
export function frameRect(r, { pad = 24, maxZ = MAX_Z, minZ = WIDE_Z, at = null } = {}) {
  const w = r[2] + 2 * pad;
  const h = r[3] + 2 * pad;
  const z = Math.max(minZ, Math.min(maxZ, SUBJECT.w / w, SUBJECT.h / h));
  let cx = r[0] + r[2] / 2;
  let cy = r[1] + r[3] / 2;
  if (at) {
    // place the rect's centre at a given stage point instead of the subject centre
    cx += (ANCHOR[0] - at[0]) / z;
    cy += (ANCHOR[1] - at[1]) / z;
  }
  return clampCam({ cx, cy, z });
}

/**
 * One framing rule (C2): a close-up (z >= 1) keeps the window over the frame's top and both
 * sides, so those edges leave the frame; its bottom edge may rise to the subject area's bottom
 * (y 770), because the band below belongs to the captions and the player's controls, and the
 * app's lowest controls must still be framed above it. A wider shot floats, centred where it
 * cannot fill.
 */
export function clampCam(c) {
  const [ax, ay] = ANCHOR;
  const range = (lo, hi, v, mid) => (lo <= hi ? Math.min(hi, Math.max(lo, v)) : mid);
  if (c.z >= 1) {
    return {
      cx: range(ax / c.z, APP_W - (STAGE_W - ax) / c.z, c.cx, APP_W / 2),
      cy: range(ay / c.z, APP_H - (SUBJECT.y + SUBJECT.h - ay) / c.z, c.cy, APP_H / 2),
      z: c.z,
    };
  }
  const halfW = SUBJECT.w / 2 / c.z;
  const halfH = SUBJECT.h / 2 / c.z;
  return {
    cx: range(halfW, APP_W - halfW, c.cx, APP_W / 2),
    cy: range(halfH, APP_H - halfH, c.cy, APP_H / 2),
    z: c.z,
  };
}

/** Stage point -> app point (inverse of toStage). */
export function toApp(cam, sx, sy) {
  return [cam.cx + (sx - ANCHOR[0]) / cam.z, cam.cy + (sy - ANCHOR[1]) / cam.z];
}

export function lerpCam(a, b, p) {
  if (p <= 0) return a;
  if (p >= 1) return b;
  const z = a.z * (b.z / a.z) ** p;
  if (Math.abs(b.z - a.z) > 1e-6 * a.z) {
    // the app point that stays put when zooming from a to b
    const fx = (b.z * b.cx - a.z * a.cx) / (b.z - a.z);
    const fy = (b.z * b.cy - a.z * a.cy) / (b.z - a.z);
    const fixedOk = Math.hypot(fx - a.cx, fy - a.cy) < 6 * APP_W;
    if (fixedOk) {
      const k = a.z / z;
      return { cx: fx + (a.cx - fx) * k, cy: fy + (a.cy - fy) * k, z };
    }
  }
  return { cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p, z };
}

/** App point -> stage point. */
export function toStage(cam, ax, ay) {
  return [ANCHOR[0] + (ax - cam.cx) * cam.z, ANCHOR[1] + (ay - cam.cy) * cam.z];
}

export function rectToStage(cam, r) {
  const [x, y] = toStage(cam, r[0], r[1]);
  return [x, y, r[2] * cam.z, r[3] * cam.z];
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const WINDOW_RADIUS = 14; // app px: the corners scale with the window

/**
 * The app window: shadow, then every visible capture layer (in order) clipped to the
 * rounded window. layers: [{ img, alpha, rect? (app px, for clipped sequence frames) }].
 */
let winBuf = null;

export function drawWindow(ctx, cam, layers, { lift = 0, dim = 0, alpha = 1 } = {}) {
  if (alpha < 0.999) {
    // a fading window is composited at full opacity first, then faded as one image, so a fade
    // never reveals what lies under the top capture (C2)
    const c = ctx.canvas;
    if (!winBuf) winBuf = document.createElement('canvas');
    if (winBuf.width !== c.width || winBuf.height !== c.height) { winBuf.width = c.width; winBuf.height = c.height; }
    const b = winBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, winBuf.width, winBuf.height);
    b.setTransform(ctx.getTransform());
    drawWindow(b, cam, layers, { lift, dim, alpha: 1 });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(winBuf, 0, 0);
    ctx.restore();
    return;
  }
  const [x, y, w, h] = rectToStage(cam, [0, 0, APP_W, APP_H]);
  const r = WINDOW_RADIUS * cam.z;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 70 + 30 * lift;
  ctx.shadowOffsetY = 26 + 10 * lift;
  ctx.fillStyle = '#EEF1F7'; // the app's own backdrop (PAL["page"]) while a capture decodes
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const L of layers) {
    if (!L.img || L.alpha <= 0.001) continue;
    ctx.globalAlpha = alpha * Math.min(1, L.alpha);
    if (L.rect) {
      // a clipped player frame, at its own place in the window
      const [rx, ry, rw, rh] = rectToStage(cam, L.rect);
      ctx.drawImage(L.img, rx, ry, rw, rh);
    } else if (L.clip) {
      // part of a capture (a list unrolling, or the main column sliding by `shift` app px)
      const [cx, cy, cw, ch] = rectToStage(cam, L.clip);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cw, ch);
      ctx.clip();
      ctx.drawImage(L.img, 0, 0, APP_W * CAP_SCALE, APP_H * CAP_SCALE, x, y + (L.shift ?? 0) * cam.z, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(L.img, 0, 0, APP_W * CAP_SCALE, APP_H * CAP_SCALE, x, y, w, h);
    }
  }
  ctx.globalAlpha = alpha;
  if (dim > 0.001) {
    ctx.fillStyle = `rgba(11, 18, 32, ${dim.toFixed(4)})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  // hairline edge
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  ctx.restore();
}

let spotCanvas = null;

/**
 * Spotlight: the window dims to LOOK.dim everywhere except the hole (stage rect, the same rect
 * as its ring), whose edge is feathered so it never draws a second outline beside the ring.
 */
export function drawSpotlight(ctx, cam, hole, amount, dpr = 1) {
  if (amount <= 0.001) return;
  const [x, y, w, h] = rectToStage(cam, [0, 0, APP_W, APP_H]);
  const W = Math.round(STAGE_W * dpr);
  const H = Math.round(STAGE_H * dpr);
  if (!spotCanvas) spotCanvas = document.createElement('canvas');
  if (spotCanvas.width !== W || spotCanvas.height !== H) { spotCanvas.width = W; spotCanvas.height = H; }
  const s = spotCanvas.getContext('2d');
  s.setTransform(dpr, 0, 0, dpr, 0, 0);
  s.clearRect(0, 0, STAGE_W, STAGE_H);
  s.fillStyle = `rgba(11, 18, 32, ${(LOOK.dim * amount).toFixed(4)})`;
  roundRect(s, x, y, w, h, WINDOW_RADIUS * cam.z);
  s.fill();
  if (hole) {
    s.save();
    s.globalCompositeOperation = 'destination-out';
    s.filter = 'blur(7px)';
    s.fillStyle = '#000';
    roundRect(s, hole[0], hole[1], hole[2], hole[3], 12);
    s.fill();
    s.restore();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(spotCanvas, 0, 0);
  ctx.restore();
}

/** A ring round a lesion (stage centre, radius): dark halo, white stroke, drawn on by `draw`. */
export function drawLesionRing(ctx, c, r, draw, alpha) {
  if (alpha <= 0.001 || draw <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * clamp01(draw));
  ctx.lineCap = 'round';
  ctx.strokeStyle = LOOK.halo;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/**
 * Highlight ring round a stage rect: gold 4 px on a dark 8 px keyline (so it reads
 * on the app's white UI and on the dimmed area), traced on clockwise from the top
 * left as `draw` goes 0 -> 1, faded by `alpha`.
 */
export function drawRing(ctx, rect, draw, alpha) {
  if (alpha <= 0.001 || draw <= 0.001) return;
  const [x, y, w, h] = rect;
  const r = 12;
  const per = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  roundRect(ctx, x, y, w, h, r);
  ctx.setLineDash([per * clamp01(draw), per]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = LOOK.halo;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = LOOK.gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** Leader from a target point to a label edge: a dot on the target, a line with a halo. */
export function drawLeader(ctx, from, to, alpha, draw = 1) {
  if (alpha <= 0.001) return;
  const p = clamp01(draw);
  const ex = from[0] + (to[0] - from[0]) * p;
  const ey = from[1] + (to[1] - from[1]) * p;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = LOOK.halo;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = LOOK.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(from[0], from[1], 8, 0, Math.PI * 2);
  ctx.fillStyle = LOOK.halo;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(from[0], from[1], 5.5, 0, Math.PI * 2);
  ctx.fillStyle = LOOK.gold;
  ctx.fill();
  ctx.restore();
}

// Arrow pointer, tip at (0, 0), drawn at 1.45x (about 42 px tall on the stage).
const ARROW = new Path2D('M0 0 L0 23.5 L5.6 18.2 L9.4 26.6 L13.1 25 L9.4 16.8 L16.8 16.8 Z');

export function drawCursor(ctx, pos, alpha, press = 0) {
  if (alpha <= 0.001 || !pos) return;
  const s = 1.45 * (1 - 0.12 * clamp01(press));
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.translate(pos[0], pos[1]);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 1.2;
  ctx.shadowOffsetY = 2.4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(ARROW);
  ctx.shadowColor = 'transparent';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#0B1220';
  ctx.stroke(ARROW);
  ctx.restore();
}

/** Click ripple: a gold ring growing from the cursor tip and a soft fill, both fading. */
export function drawRipple(ctx, pos, p) {
  if (!pos || p <= 0.001 || p >= 0.999) return;
  const e = 1 - (1 - p) ** 3;
  ctx.save();
  ctx.globalAlpha = (1 - p) ** 1.3;
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], 6 + 34 * e, 0, Math.PI * 2);
  ctx.strokeStyle = LOOK.gold;
  ctx.lineWidth = 4 * (1 - 0.5 * p);
  ctx.stroke();
  ctx.globalAlpha = 0.35 * (1 - p);
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], 4 + 18 * e, 0, Math.PI * 2);
  ctx.fillStyle = LOOK.gold;
  ctx.fill();
  ctx.restore();
}

/**
 * The cursor's path between two stage points: x and y on different eases make a
 * natural arc (quick start along the long axis, a soft settle onto the target).
 */
export function cursorPath(a, b, p, easeX, easeY) {
  return [a[0] + (b[0] - a[0]) * easeX(p), a[1] + (b[1] - a[1]) * easeY(p)];
}
