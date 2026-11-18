/* ============================================================================
   PROJECTOR LIFE — test card (debug content)
   ----------------------------------------------------------------------------
   Stand-in content in the life host's exact buffer convention (CONTRACTS §2:
   row j = local y ∈ [j/ppm, (j+1)/ppm), RGBA, black outside the polygon), so
   the projection pipeline can be checked without the sims:
     mapped → 25 cm checkers stay SQUARE on every patch (the mapping works),
     raw    → one flat checker card warps across the corners.
   Turn on with projection.setTestCard(true).
   ========================================================================== */

import { pointInPolygon } from '../room/roomModel.js';

const TYPE_COL = { floor: [255, 170, 60], wall: [80, 220, 200], ceiling: [200, 120, 255] };
const SQ = 0.25; // metres

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Copy canvas pixels into a buffer with row 0 = the BOTTOM of the drawing. */
function flipInto(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) out.set(img.subarray((h - 1 - j) * w * 4, (h - j) * w * 4), j * w * 4);
  return out;
}

export function makeTestSurface(patch, ppm = 40) {
  const w = Math.max(1, Math.ceil(patch.width * ppm));
  const h = Math.max(1, Math.ceil(patch.height * ppm));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const col = TYPE_COL[patch.typeAuto] || [255, 255, 255];
  // draw in local metres with y up
  ctx.setTransform(ppm, 0, 0, -ppm, 0, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w / ppm, h / ppm);
  for (let y = 0; y * SQ < patch.height; y++) {
    for (let x = 0; x * SQ < patch.width; x++) {
      const on = (x + y) % 2 === 0;
      ctx.fillStyle = on ? `rgb(${col[0]},${col[1]},${col[2]})` : 'rgb(20,20,28)';
      ctx.fillRect(x * SQ, y * SQ, SQ, SQ);
    }
  }
  // an "up" arrow along local +y and the patch id, so orientation shows
  const cx = patch.width / 2;
  const cy = Math.min(patch.height / 2, 1.0);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 0.32);
  ctx.lineTo(cx - 0.14, cy + 0.08);
  ctx.lineTo(cx - 0.05, cy + 0.08);
  ctx.lineTo(cx - 0.05, cy - 0.2);
  ctx.lineTo(cx + 0.05, cy - 0.2);
  ctx.lineTo(cx + 0.05, cy + 0.08);
  ctx.lineTo(cx + 0.14, cy + 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `bold ${Math.round(ppm * 0.26)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(patch.id, cx * ppm, h - (cy - 0.36) * ppm);
  const data = flipInto(ctx, w, h);
  // black outside the polygon (contract)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!pointInPolygon((i + 0.5) / ppm, (j + 0.5) / ppm, patch.polygon)) {
        const k = (j * w + i) * 4;
        data[k] = data[k + 1] = data[k + 2] = 0;
        data[k + 3] = 255;
      }
    }
  }
  return { w, h, ppm, data, version: 1 };
}

export function makeTestFrame(w = 640, h = 360) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const n = 16;
  const s = w / n;
  for (let y = 0; y * s < h; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? 'rgb(20,20,28)' : 'rgb(240,240,240)';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  ctx.strokeStyle = '#ff3b6b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23b';
  ctx.font = `bold ${Math.round(h * 0.12)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('RAW FRAME  ↑', w / 2, h * 0.16);
  return { w, h, data: flipInto(ctx, w, h), version: 1 };
}
