/* ============================================================================
   PROJECTOR LIFE — drawing glyphs INTO the patch buffers
   ----------------------------------------------------------------------------
   Creatures and detritus are projected content, so they are rasterised into
   the same RGBA buffers as the sims (after the sims paint). Primitives are in
   patch-local METRES; a glyph near a seam is also drawn, mapped through
   seam.M, into the neighbouring patch so a creature straddling a corner is
   not cut in half. Only live cells are written (masks stay black).
   ========================================================================== */

export function createPainter() {
  let D = null;
  let outs = null; // Uint32Array per patch index

  function blend(out, k, c, a) {
    if (a >= 0.999) {
      out[k] = (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
      return;
    }
    const v = out[k];
    const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
    out[k] = (0xff000000 | (((b + (c[2] - b) * a) | 0) << 16) | (((g + (c[1] - g) * a) | 0) << 8) | ((r + (c[0] - r) * a) | 0)) >>> 0;
  }

  function plot(pi, i, j, c, a) {
    const p = D.P[pi];
    if (i < 0 || j < 0 || i >= p.w || j >= p.h) return;
    const k = j * p.w + i;
    if (p.state[k] !== 2) return;
    blend(outs[pi], k, c, a);
  }

  function disc(pi, x, y, r, c, a) {
    const ppm = D.ppm;
    const cx = x * ppm, cy = y * ppm, R = Math.max(0.5, r * ppm);
    const i0 = Math.floor(cx - R), i1 = Math.ceil(cx + R);
    const j0 = Math.floor(cy - R), j1 = Math.ceil(cy + R);
    const R2 = R * R;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 + R) continue;
        const edge = d2 > R2 ? 0.45 : 1;
        plot(pi, i, j, c, a * edge);
      }
    }
  }

  function line(pi, x0, y0, x1, y1, c, a) {
    const ppm = D.ppm;
    const ax = x0 * ppm, ay = y0 * ppm, bx = x1 * ppm, by = y1 * ppm;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.5));
    let li = -1e9, lj = -1e9;
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const i = Math.floor(ax + (bx - ax) * t), j = Math.floor(ay + (by - ay) * t);
      if (i === li && j === lj) continue;
      li = i;
      lj = j;
      plot(pi, i, j, c, a);
    }
  }

  function drawPrims(pi, prims, M) {
    for (const q of prims) {
      if (q.t === 'disc') {
        let x = q.x, y = q.y;
        if (M) {
          const nx = M[0] * x + M[1] * y + M[4];
          y = M[2] * x + M[3] * y + M[5];
          x = nx;
        }
        disc(pi, x, y, q.r, q.c, q.a);
      } else {
        let x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1;
        if (M) {
          const a0 = M[0] * x0 + M[1] * y0 + M[4], b0 = M[2] * x0 + M[3] * y0 + M[5];
          const a1 = M[0] * x1 + M[1] * y1 + M[4], b1 = M[2] * x1 + M[3] * y1 + M[5];
          x0 = a0;
          y0 = b0;
          x1 = a1;
          y1 = b1;
        }
        line(pi, x0, y0, x1, y1, q.c, q.a);
      }
    }
  }

  const api = {
    onTouch: null,
    bind(domain, buffers) {
      D = domain;
      outs = buffers;
    },
    disc,
    line,
    /** Draw primitives on patch pi, spilling across seams within `reach` m of (cx, cy). */
    glyph(pi, prims, cx, cy, reach) {
      if (!outs[pi]) return;
      api.onTouch?.(pi);
      drawPrims(pi, prims, null);
      for (const ed of D.P[pi].edges) {
        if (!ed.seam || !outs[ed.seam.q]) continue;
        const sd = (cx - ed.ax) * ed.nx + (cy - ed.ay) * ed.ny;
        if (sd < -reach) continue;
        const along = (cx - ed.ax) * ed.tx + (cy - ed.ay) * ed.ty;
        if (along < -reach || along > ed.len + reach) continue;
        api.onTouch?.(ed.seam.q);
        drawPrims(ed.seam.q, prims, ed.seam.M);
      }
    },
  };
  return api;
}
