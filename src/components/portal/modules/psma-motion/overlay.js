/* ============================================================================
   PSMA MOTION — 2D OVERLAY
   ----------------------------------------------------------------------------
   Vector marks drawn over the WebGL scan on a canvas 2D layer: one marker per
   lesion, the sliding window with its Gaussian weighting and the scan's field
   of view, the depth inset, the five model cards and the turntable cue. A
   pure function of (frame, case data): every position comes from
   components.json / windows.json, which the exporter computed from the
   projected footprints, so nothing here re-projects a mask.

   One object per lesion through beat 4: each ground-truth lesion gets an ink
   ring that traces on, turns blue if found or becomes a vermillion dashed square
   if missed; each false alarm grows a yellow diamond. Marker paint is then cut
   away over the missed and false-alarm fills, so no marker ever hides the
   pixels it points at. G7 reads the marker list.
   ========================================================================== */

// Each ring traces, and each found ring pops, over this many steps of its wave, so a
// 30-35 ms stagger still gives every item about a quarter of a second of motion.
export const WAVE_SPAN = 8;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - (1 - t) ** 3;
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// Stage position of a layer-pixel point.
const toStage = (L, x, y) => [L.originX + x * L.scale, L.originY + y * L.scale];

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `rgb(${A.map((c, i) => Math.round(c + (B[i] - c) * t)).join(',')})`;
}

function shapePath(ctx, shape, x, y, r, frac = 1) {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.rect(x - r, y - r, 2 * r, 2 * r);
  } else if (shape === 'diamond') {
    const d = r * 1.3;
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.closePath();
  } else {
    // a ring that traces on clockwise from 12 o'clock
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  }
}

// marker radius grows with the footprint but is capped
export const markerRadius = (f, scale, minR = 12, maxR = 24) =>
  Math.max(minR, Math.min(maxR, 0.6 * Math.sqrt(f[6]) * scale + 6));

/* Draw one marker and report it (G7 masks marker strokes out of its pixel test). */
function mark(ctx, out, m, look) {
  if (m.alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = m.alpha;
  shapePath(ctx, m.shape, m.x, m.y, m.r, m.frac ?? 1);
  if (m.dashed) ctx.setLineDash(m.dash ?? [10, 6]);
  const halo = m.halo ?? 1;
  const haloW = m.haloW ?? 3;
  if (halo > 0) {
    ctx.globalAlpha = m.alpha * halo;
    ctx.lineWidth = m.width + haloW;
    ctx.strokeStyle = look.marker.halo;
    ctx.stroke();
    ctx.globalAlpha = m.alpha;
  }
  ctx.lineWidth = m.width;
  ctx.strokeStyle = m.colour;
  ctx.stroke();
  ctx.restore();
  out?.push({ kind: m.kind, id: m.id, x: m.x, y: m.y, r: m.r, shape: m.shape, alpha: m.alpha,
    stroke: m.width + haloW, colour: m.colourHex ?? null });
}

/* Simple per-component markers that pop in as a count runs (prediction, removed). */
export function drawCounted(ctx, L, set, look, out) {
  if (!set || set.alpha <= 0) return;
  const { items, count, alpha, shape, colour, width = 3, dashed = false, kind } = set;
  for (let i = 0; i < items.length; i++) {
    const local = clamp01(count - i);
    if (local <= 0) break;
    const f = items[i].fp[L.angleIndex];
    const [x, y] = toStage(L, f[0], f[1]);
    const r = markerRadius(f, L.scale) * (1 + 0.7 * (1 - easeOut(local)));
    mark(ctx, out, { kind, id: items[i].id, x, y, r, shape, alpha: alpha * clamp01(local * 1.6),
      colour, colourHex: colour, width, dashed }, look);
  }
}

/* Beat 4: one object per lesion, from ground-truth ring to verdict marker.
   Drawn in three passes so error markers always sit on top: rings, then the
   missed squares, then the false-alarm diamonds. */
export function drawVerdict(ctx, L, dv, S, look, out) {
  if (S.gtRingA <= 0 && S.verdict <= 0) return;
  const ink = look.marker.gt;
  const foundAlpha = 1 - 0.6 * S.foundDim;
  const at = (c) => {
    const f = c.fp[L.angleIndex];
    const [x, y] = toStage(L, f[0], f[1]);
    return { f, x, y };
  };
  // pass 1: rings, in reveal order (top of the body first)
  dv.gtOrder.forEach((c, i) => {
    const frac = clamp01((S.gtTrace - i) / WAVE_SPAN);
    if (frac <= 0) return;
    const { f, x, y } = at(c);
    const r = markerRadius(f, L.scale);
    if (c.verdict === 'found') {
      const j = dv.foundIndex.get(c.id);
      const p = clamp01((S.foundWave - j) / (dv.foundSpan ?? WAVE_SPAN));
      const pop = p > 0 && p < 1 ? 1 + 0.3 * Math.sin(Math.PI * p) : 1;
      // once counted, crowded found rings thin out and step back: the blue fill already
      // marks them, and the errors are the talking point
      mark(ctx, out, { kind: 'found', id: c.id, x, y, r: r * pop, shape: 'circle', frac,
        alpha: S.gtRingA * foundAlpha, width: 3 - S.foundDim, halo: 1 - S.foundDim,
        colour: mixHex(ink, look.marker.found, S.verdict), colourHex: look.marker.found }, look);
    } else {
      const morph = clamp01(S.nMissed - dv.missedIndex.get(c.id));
      // the ring hands over to a dashed square as the missed counter reaches it
      mark(ctx, null, { kind: 'missed-ring', id: c.id, x, y, r, shape: 'circle', frac,
        alpha: S.gtRingA * (1 - morph), width: 3, colour: mixHex(ink, look.marker.missed, S.verdict) }, look);
    }
  });
  // pass 2: missed lesions as dashed squares, with a 3 px dark halo either side of the
  // stroke (they often sit on a blue region); squares that would overlap are pushed apart
  // along their main axis, never so far that the lesion leaves its square
  const sq = [];
  dv.gtOrder.forEach((c) => {
    if (c.verdict === 'found') return;
    const morph = clamp01(S.nMissed - dv.missedIndex.get(c.id));
    if (morph <= 0) return;
    const { f, x, y } = at(c);
    const r0 = Math.max(16, markerRadius(f, L.scale));
    const [bx0, by0] = toStage(L, f[2], f[3]);
    const [bx1, by1] = toStage(L, f[4], f[5]);
    sq.push({ c, x, y, r0, morph, box: [bx0, by0, bx1, by1] });
  });
  separateSquares(sq, 12);   // 12 px between square edges clears their 10.5 px stroke + halo
  sq.forEach(({ c, x, y, r0, morph }) => {
    const pr = r0 * (0.6 + 0.4 * backOut(morph));
    mark(ctx, out, { kind: 'missed', id: c.id, x, y, r: pr, shape: 'square', alpha: morph,
      width: 4.5, haloW: 6, dashed: true, colour: look.marker.missed, colourHex: look.marker.missed }, look);
  });
  // pass 3: false alarms grow out of their prediction markers
  dv.fa.forEach((c, j) => {
    const grow = clamp01(S.nFa - j);
    if (grow <= 0) return;
    const { f, x, y } = at(c);
    const r = markerRadius(f, L.scale, 16) * (0.5 + 0.5 * backOut(grow));
    mark(ctx, out, { kind: 'fa', id: c.id, x, y, r, shape: 'diamond', alpha: clamp01(grow * 1.5),
      width: 4.5, haloW: 6, colour: look.marker.falseAlarm, colourHex: look.marker.falseAlarm }, look);
  });
  // cut all marker paint away over the missed and false-alarm fills (grown by 1 px), so
  // a marker never hides the pixels it points at. The cut-out is the exported angle-0
  // layer; beats 4 and 5 always hold at angle 0.
  if (S.verdict > 0 && dv.errCut && L.angleIndex === 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = clamp01(S.verdict);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(dv.errCut, L.originX, L.originY, L.W * L.scale, L.H * L.scale);
    ctx.restore();
  }
}

/* Push overlapping squares apart (pairwise, deterministic, in place). Each square moves
   half the overlap plus `gap` along the axis where the centres differ more, but only as far
   as keeps its lesion's footprint box inside the square with 2 px to spare. */
function separateSquares(sq, gap) {
  for (let i = 0; i < sq.length; i++) {
    for (let j = i + 1; j < sq.length; j++) {
      const a = sq[i];
      const b = sq[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const need = a.r0 + b.r0 + gap;
      if (Math.abs(dx) >= need || Math.abs(dy) >= need) continue;
      const axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      const d = axis === 'y' ? dy : dx;
      const sign = d >= 0 ? 1 : -1;
      const push = (need - Math.abs(d)) / 2;
      const room = (s, dir) => {
        // how far s may move in direction dir along the axis and still hold its box
        const [x0, y0, x1, y1] = s.box;
        const lo = axis === 'y' ? y0 : x0;
        const hi = axis === 'y' ? y1 : x1;
        const centre = axis === 'y' ? s.y : s.x;
        return dir > 0 ? Math.max(0, lo - (centre - s.r0 + 2)) : Math.max(0, (centre + s.r0 - 2) - hi);
      };
      const ma = Math.min(push, room(a, -sign));
      const mb = Math.min(push, room(b, sign));
      if (axis === 'y') { a.y -= sign * ma; b.y += sign * mb; } else { a.x -= sign * ma; b.x += sign * mb; }
    }
  }
}

/* Angle-0 cut-out for drawVerdict: opaque where the missed-lesion or false-alarm bit is
   set in the mask layer, grown by one pixel (3 x 3). */
export function errorCutout(maskBitmap, bits) {
  const W = maskBitmap.width;
  const H = maskBitmap.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(maskBitmap, 0, 0);
  const src = g.getImageData(0, 0, W, H).data;
  const want = (1 << bits.missed_gt) | (1 << bits.fa_pred);
  const on = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) on[i] = (src[4 * i] & want) ? 1 : 0;
  const im = g.createImageData(W, H);
  const d = im.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && on[yy * W + xx]) { hit = 1; break; }
        }
      }
      if (hit) d[4 * (y * W + x) + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* Beat 1: thin leader lines from organs with normal uptake to their labels (the label
   text is DOM). Items are in stage pixels: anchor (ax, ay), elbow (ex, ty), text side. */
export function drawOrganLeaders(ctx, items, alpha, look) {
  if (alpha <= 0 || !items?.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  items.forEach((it) => {
    const tx = it.side === 'right' ? it.ex + 14 : it.ex - 14;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(it.ax, it.ay);
      ctx.lineTo(it.ex, it.ty);
      ctx.lineTo(tx, it.ty);
    };
    path();
    ctx.lineWidth = 5;
    ctx.strokeStyle = look.marker.halo;
    ctx.stroke();
    path();
    ctx.lineWidth = 2;
    ctx.strokeStyle = look.ink2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(it.ax, it.ay, 4.5, 0, TAU);
    ctx.fillStyle = look.ink2;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = look.marker.halo;
    ctx.stroke();
  });
  ctx.restore();
}

/* The scan's whole field of view in the anterior view, so off-body windows read as
   tiling the volume, not as missing the body. */
export function drawFov(ctx, L, data, alpha, look) {
  if (alpha <= 0) return;
  const lay = data.manifest.layer;
  const [Zn, , Xn] = lay.shape_zyx;
  const col0 = (0 - lay.centre_edge_yx[1] + lay.radius_voxels) * lay.scale;
  const col1 = (Xn - lay.centre_edge_yx[1] + lay.radius_voxels) * lay.scale;
  const [x0, y0] = toStage(L, col0, 0);
  const [x1] = toStage(L, col1, 0);
  const y1 = L.originY + (Zn * lay.spacing_zyx_mm[0] / lay.pixel_mm) * L.scale;
  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = look.muted;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/* The current sliding window in the anterior view, with the Gaussian weight
   MONAI applies (sigma = 0.125 x the window size along each axis). */
export function drawWindow(ctx, L, win, frame, look) {
  if (!win || frame.winAlpha <= 0) return;
  const [x0, y0] = toStage(L, win.col0, win.row0);
  const [x1, y1] = toStage(L, win.col1, win.row1);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sx = 0.125 * (x1 - x0);
  const sy = 0.125 * (y1 - y0);
  ctx.save();
  ctx.globalAlpha = frame.winAlpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 3);
  g.addColorStop(0, look.windowGlow);
  g.addColorStop(0.45, look.windowGlow.replace(/[\d.]+\)$/, '0.08)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  const tk = 18;
  const corners = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + tk); ctx.lineTo(x0, y0); ctx.lineTo(x0 + tk, y0);
    ctx.moveTo(x1 - tk, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + tk);
    ctx.moveTo(x0, y1 - tk); ctx.lineTo(x0, y1); ctx.lineTo(x0 + tk, y1);
    ctx.moveTo(x1 - tk, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - tk);
  };
  // dark halo first, 3 px either side of the gold, so the gold holds on the scan and on
  // the orange end of the heat ramp alike (deuteranopes see gold and orange as one hue)
  ctx.strokeStyle = look.windowHalo;
  ctx.lineWidth = 9;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  corners();
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = look.windowStroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  corners();
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

/* Depth inset: the scan volume in cabinet projection, front face = the anterior
   view (a faint thumbnail of the body sits on it), depth receding up and to the
   right. The current window is a gold block inside it. */
export function drawInset(ctx, frame, data, look, box, thumb, label) {
  if (frame.insetAlpha <= 0) return;
  const [Zn, Yn, Xn] = data.manifest.layer.shape_zyx;
  const sp = data.manifest.layer.spacing_zyx_mm;
  const X = Xn * sp[2];
  const Y = Yn * sp[1];
  const Z = Zn * sp[0];
  const kx = Math.cos(Math.PI / 4) * 0.5;
  const w = X + Y * kx;
  const h = Z + Y * kx;
  const k = Math.min(box.w / w, box.h / h);
  const ox = box.x + (box.w - w * k) / 2;
  const oy = box.y + (box.h - h * k) / 2 + Y * kx * k;
  const P = (x, d, z) => [ox + (x + d * kx) * k, oy + (Z - z) * k - d * kx * k];
  const box3 = (x0, d0, z0, x1, d1, z1) => [[x0, d0, z0], [x1, d0, z0], [x1, d1, z0], [x0, d1, z0],
    [x0, d0, z1], [x1, d0, z1], [x1, d1, z1], [x0, d1, z1]].map((q) => P(...q));
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const poly = (v, idx) => { ctx.beginPath(); idx.forEach((i, j) => (j ? ctx.lineTo(...v[i]) : ctx.moveTo(...v[i]))); ctx.closePath(); };

  ctx.save();
  ctx.globalAlpha = frame.insetAlpha;
  const vol = box3(0, 0, 0, X, Y, Z);
  ctx.fillStyle = look.panel;
  poly(vol, [0, 1, 5, 4]);
  ctx.fill();
  if (thumb) {
    // the front face is the anterior view: same crop and orientation as the body
    const lay = data.manifest.layer;
    const fx0 = P((lay.centre_edge_yx[1] - lay.radius_voxels) * sp[2], 0, Z);
    const fx1 = P((lay.centre_edge_yx[1] + lay.radius_voxels) * sp[2], 0, 0);
    ctx.save();
    ctx.globalAlpha = frame.insetAlpha * 0.55;
    poly(vol, [0, 1, 5, 4]);
    ctx.clip();
    ctx.drawImage(thumb, fx0[0], fx0[1], fx1[0] - fx0[0], fx1[1] - fx0[1]);
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = look.muted;
  ctx.beginPath();
  E.forEach(([a, b]) => { ctx.moveTo(...vol[a]); ctx.lineTo(...vol[b]); });
  ctx.stroke();
  if (label) {
    // "depth" along the receding top edge
    const a = vol[5];
    const b = vol[6];
    ctx.save();
    ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
    ctx.fillStyle = look.ink2;
    ctx.font = "600 28px 'Hanken Grotesk', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -10);
    ctx.restore();
  }

  const win = frame.win;
  if (win) {
    const [zs, ys, xs] = win.start_zyx;
    const roi = data.windows.roi_zyx;
    // y index runs posterior -> anterior; depth d is measured from the anterior surface
    const d0 = (Yn - (ys + roi[1])) * sp[1];
    const d1 = (Yn - ys) * sp[1];
    const blk = box3(xs * sp[2], d0, zs * sp[0], (xs + roi[2]) * sp[2], d1, (zs + roi[0]) * sp[0]);
    ctx.fillStyle = look.windowGlow;
    [[0, 1, 5, 4], [4, 5, 6, 7], [1, 2, 6, 5]].forEach((f) => { poly(blk, f); ctx.fill(); });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = look.windowStroke;
    ctx.beginPath();
    E.forEach(([a, b]) => { ctx.moveTo(...blk[a]); ctx.lineTo(...blk[b]); });
    ctx.stroke();
  }
  ctx.restore();
}

/* A turntable under the feet: an ellipse with a gold dot at the direction the patient
   faces. At 0 degrees the dot is at the front; it swings to screen right as the body
   turns, which fixes the spin direction a MIP alone leaves ambiguous. */
export function drawTurntable(ctx, L, angleDeg, alpha, look) {
  if (alpha <= 0) return;
  const cx = L.originX + (L.W * L.scale) / 2;
  const cy = L.originY + L.H * L.scale + 26;
  const rx = Math.min(200, (L.W * L.scale) * 0.36);
  const ry = 16;
  const th = (angleDeg * Math.PI) / 180;
  const dx = cx + rx * Math.sin(th);
  const dy = cy + ry * Math.cos(th);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = look.muted;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = look.gold;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(dx, dy, 6, 0, TAU);
  ctx.fillStyle = look.gold;
  ctx.fill();
  ctx.restore();
}

/* Five per-fold probability MIPs fan out like a hand of cards, then close into
   one stack whose top card is their per-voxel mean. */
export function drawFoldCards(ctx, frame, cards, look, area) {
  if (frame.cardsAlpha <= 0 || !cards) return;
  const n = 5;
  const { cw, ch } = area;
  const pivotX = area.x + area.w / 2;
  const pivotY = area.y + ch + 300;
  const merge = clamp01(frame.cardsMerge);   // the timeline's ease alone shapes the merge
  ctx.save();
  for (let i = 0; i < n; i++) {
    const appear = easeOut(clamp01(frame.cardsFan * 1.6 - i * 0.15));
    if (appear <= 0) continue;
    const spread = appear * (1 - merge);
    const angle = ((i - 2) * 9 * Math.PI / 180) * spread;   // outer cards at 18 deg
    ctx.save();
    ctx.globalAlpha = frame.cardsAlpha * clamp01(appear * 1.4) * (i === 2 ? 1 : 1 - merge);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    ctx.translate(-cw / 2, -(300 + ch) + 24 * (1 - appear));
    ctx.shadowColor = 'rgba(13,40,106,0.22)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = look.panel;
    ctx.fillRect(0, 0, cw, ch);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = look.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, cw, ch);
    const img = i === 2 && merge > 0.5 ? cards.mean : cards.folds[i];
    ctx.drawImage(img, 8, 8, cw - 16, ch - 16);
    ctx.restore();
  }
  ctx.restore();
}

/* Heat-coloured copy of a greyscale probability MIP, for the cards. */
export function heatCanvas(bitmap, look) {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const [h0, h1, h2] = look.gl.prob;
  const base = look.gl.body;
  for (let i = 0; i < d.length; i += 4) {
    const q = d[i] / 255;
    const a = Math.min(1, Math.max(0, (q - 0.03) / 0.32));
    const t = q < 0.5 ? q * 2 : (q - 0.5) * 2;
    const A = q < 0.5 ? h0 : h1;
    const B = q < 0.5 ? h1 : h2;
    for (let k = 0; k < 3; k++) {
      const heat = A[k] + (B[k] - A[k]) * t;
      d[i + k] = Math.round(255 * (base[k] + (heat - base[k]) * a));
    }
    d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
