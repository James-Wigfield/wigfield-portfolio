/* ============================================================================
   PROJECTOR LIFE — unfolded-room inset (the room model, laid flat)
   ----------------------------------------------------------------------------
   A star-shaped net in the floor's own frame (x east, y north, metres):
     floor octagon in the middle,
     each wall folded out from its floor edge   (the wall→floor seam map),
     each roof facet folded out from its wall's eave (roof→wall ∘ wall→floor),
     the loft deck beside it (it has no seams — creatures reach it by falling).
   Every piece shows its live life buffer (an offscreen canvas per patch,
   putImageData only when the buffer's version moves, then one affine
   drawImage clipped to the polygon). Seams: an edge whose two sides land on
   the same net points is JOINED (thin line); otherwise it is CUT (wall–wall
   corners, roof hips): dashed in a colour shared by its two edges, with the
   same tick count on both (1 = wall corner, 2 = roof hip).
   Crisp at devicePixelRatio; cheap enough for ~10 draws a second.
   ========================================================================== */

const I = [1, 0, 0, 1, 0, 0];

function compose(A, B) {
  return [
    A[0] * B[0] + A[1] * B[2],
    A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2],
    A[2] * B[1] + A[3] * B[3],
    A[0] * B[4] + A[1] * B[5] + A[4],
    A[2] * B[4] + A[3] * B[5] + A[5],
  ];
}

const apply = (M, [x, y]) => [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];

function seamTo(p, to, edge = null) {
  return (p.seams || []).find((s) => s.to === to && (edge == null || s.edge === edge)) || null;
}

/** Net transform (patch local → floor-plane net coords) for every patch. */
export function netTransforms(patches) {
  const byId = new Map(patches.map((p) => [p.id, p]));
  const T = new Map();
  if (byId.has('floor')) T.set('floor', I);
  for (const p of patches) {
    if (p.kind !== 'wall') continue;
    const s = seamTo(p, 'floor', 0) || seamTo(p, 'floor');
    if (s) T.set(p.id, s.M);
  }
  for (const p of patches) {
    if (p.kind !== 'roof') continue;
    const wallId = `wall-${p.flat}`;
    const s = seamTo(p, wallId, 0) || seamTo(p, wallId);
    if (s && T.has(wallId)) T.set(p.id, compose(T.get(wallId), s.M));
  }
  return T;
}

function bbox(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

function seamColour(k, roof) {
  const hue = (k * 45 + (roof ? 22 : 0)) % 360;
  return `hsl(${hue} 85% ${roof ? 70 : 62}%)`;
}

export function createNet() {
  let layout = null;
  const offs = new Map(); // patch id → { canvas, ctx, w, h, data, version }

  function offFor(id, s) {
    let o = offs.get(id);
    if (!o || o.w !== s.w || o.h !== s.h) {
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(s.w, s.h) : Object.assign(document.createElement('canvas'), { width: s.w, height: s.h });
      o = { canvas, ctx: canvas.getContext('2d'), w: s.w, h: s.h, data: null, version: -1 };
      offs.set(id, o);
    }
    if (o.data !== s.data || o.version !== s.version) {
      const px = new Uint8ClampedArray(s.data.buffer, s.data.byteOffset, s.w * s.h * 4);
      o.ctx.putImageData(new ImageData(px, s.w, s.h), 0, 0);
      o.data = s.data;
      o.version = s.version;
    }
    return o;
  }

  function build(patches, W, H, dpr) {
    const T = netTransforms(patches);
    const star = [];
    for (const p of patches) if (T.has(p.id)) for (const q of p.polygon) star.push(apply(T.get(p.id), q));
    if (!star.length) return null;
    const sb = bbox(star);
    // the loft (no seams) sits to the right of the star, same scale, same orientation
    const loft = patches.find((p) => p.kind === 'loft' && !T.has(p.id));
    if (loft) {
      const lb = bbox(loft.polygon);
      const gap = 0.6;
      const dx = sb.x1 + gap - lb.x0;
      const dy = (sb.y0 + sb.y1) / 2 - (lb.y0 + lb.y1) / 2;
      T.set(loft.id, [1, 0, 0, 1, dx, dy]);
      for (const q of loft.polygon) star.push(apply(T.get(loft.id), q));
    }
    const b = bbox(star);
    const pad = 10 * dpr;
    const s = Math.min((W - 2 * pad) / (b.x1 - b.x0), (H - 2 * pad) / (b.y1 - b.y0));
    const ox = (W - s * (b.x1 - b.x0)) / 2 - s * b.x0;
    const oy = (H + s * (b.y1 - b.y0)) / 2 + s * b.y0; // canvas y = oy − s·Y
    const toCanvas = [s, 0, 0, -s, ox, oy]; // net → canvas px
    const pieces = [];
    const byId = new Map();
    for (const p of patches) {
      if (!T.has(p.id)) continue;
      const M = compose(toCanvas, T.get(p.id)); // patch local → canvas px
      const piece = { patch: p, M, path: p.polygon.map((q) => apply(M, q)) };
      pieces.push(piece);
      byId.set(p.id, piece);
    }
    // seams: joined vs cut, decided by where the two sides land on the net
    const joined = [];
    const cut = [];
    const seen = new Set();
    for (const piece of pieces) {
      const p = piece.patch;
      for (const sm of p.seams || []) {
        const other = byId.get(sm.to);
        if (!other) continue;
        const key = [p.id, sm.edge, sm.to, sm.toEdge].join(':');
        const back = [sm.to, sm.toEdge, p.id, sm.edge].join(':');
        const n = p.polygon.length;
        const a = piece.path[sm.edge];
        const b2 = piece.path[(sm.edge + 1) % n];
        const on = other.patch.polygon.length;
        const c = other.path[sm.toEdge];
        const d = other.path[(sm.toEdge + 1) % on];
        const tol = 0.5 * dpr;
        const same = Math.hypot(a[0] - d[0], a[1] - d[1]) < tol && Math.hypot(b2[0] - c[0], b2[1] - c[1]) < tol;
        if (same) {
          if (!seen.has(back)) joined.push([a, b2]);
          seen.add(key);
          continue;
        }
        const roof = p.kind === 'roof' && other.patch.kind === 'roof';
        // pair id: the corner/hip index (k of the right-hand patch of the pair)
        const kA = p.k ?? 0;
        const kB = other.patch.k ?? 0;
        const k = (kA + 1) % 8 === kB ? kB : kA;
        cut.push({ a, b: b2, colour: seamColour(k, roof), ticks: roof ? 2 : 1 });
      }
    }
    return { key: '', W, H, dpr, s, pieces, joined, cut };
  }

  function strokeTicks(ctx, a, b, n, colour, dpr, k = 1) {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / L;
    const ty = (b[1] - a[1]) / L;
    const len = 4 * dpr * k;
    const gap = 3 * dpr * k;
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, 1.2 * dpr * k);
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap;
      const cx = mx + tx * o;
      const cy = my + ty * o;
      ctx.moveTo(cx - ty * len, cy + tx * len);
      ctx.lineTo(cx + ty * len, cy - tx * len);
    }
    ctx.stroke();
  }

  /**
   * Draw the net into a DOM canvas.
   *   surfaces: Map<patchId, { w, h, ppm, data, version }> (CONTRACTS §2)
   *   values:   the params (active masks, region on/off)
   */
  function draw(canvas, { patches, surfaces, values }) {
    if (!canvas || !patches?.length) return;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    if (!cw || !ch) return;
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const key = `${W}x${H}@${dpr}|${patches.map((p) => p.id).join(',')}|${patches[0]?.corners3d?.[0]?.join(',')}|${patches.find((p) => p.kind === 'roof')?.height}`;
    if (!layout || layout.key !== key || layout.patches !== patches) {
      layout = build(patches, W, H, dpr);
      if (!layout) return;
      layout.key = key;
      layout.patches = patches;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;

    const get = (id) => (surfaces ? (typeof surfaces.get === 'function' ? surfaces.get(id) : surfaces[id]) : null);
    const pathOf = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };

    for (const piece of layout.pieces) {
      const { patch, M, path } = piece;
      const s = get(patch.id);
      const on = values?.[`region.${patch.id}.on`] !== false;
      ctx.save();
      pathOf(path);
      ctx.clip();
      ctx.fillStyle = on ? '#050506' : '#000';
      ctx.fill();
      if (s?.data && on) {
        const o = offFor(patch.id, s);
        const k = 1 / s.ppm;
        // offscreen px → local metres → canvas px
        ctx.setTransform(M[0] * k, M[2] * k, M[1] * k, M[3] * k, M[4], M[5]);
        ctx.drawImage(o.canvas, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
      // active masks: a thin grey outline (the buffer is black there)
      for (const m of patch.masks || []) {
        if (!values?.[`map.mask.${m.kind}`] || !m.polygon || m.polygon.length < 3) continue;
        pathOf(m.polygon.map((q) => apply(M, q)));
        ctx.strokeStyle = 'rgba(160,160,170,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2 * layout.dpr, 2 * layout.dpr]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      pathOf(path);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1 * layout.dpr;
      ctx.stroke();
    }

    // Decorations scale with the net: at inset size (~200 px) they must not
    // drown the life on the pieces. k = 1 at a ~420 px net.
    const k = Math.max(0.55, Math.min(1, Math.min(cw, ch) / 420));
    const dpr2 = layout.dpr;

    // joined seams: thin, quiet
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.26)';
    ctx.lineWidth = Math.max(1, dpr2 * k);
    ctx.beginPath();
    for (const [a, b] of layout.joined) {
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    // cut seams: dashed, colour-paired, ticks (only when the edge is long enough to carry them)
    for (const c of layout.cut) {
      ctx.setLineDash([3 * dpr2 * k, 3 * dpr2 * k]);
      ctx.strokeStyle = c.colour;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1, dpr2 * k);
      ctx.beginPath();
      ctx.moveTo(c.a[0], c.a[1]);
      ctx.lineTo(c.b[0], c.b[1]);
      ctx.stroke();
      if (Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) > 16 * dpr2) strokeTicks(ctx, c.a, c.b, c.ticks, c.colour, dpr2, k);
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);

    // labels (only when there is room for them)
    if (Math.min(cw, ch) >= 300) {
      ctx.font = `${Math.round(9 * layout.dpr)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const piece of layout.pieces) {
        const p = piece.patch;
        if (p.kind === 'roof') continue;
        const c = piece.path.reduce((acc, q) => [acc[0] + q[0] / piece.path.length, acc[1] + q[1] / piece.path.length], [0, 0]);
        const label = p.kind === 'wall' ? p.flat : p.kind === 'loft' ? 'loft' : p.id;
        // walls: label near the eave so it doesn't sit on the floor seam
        ctx.fillText(label, c[0], c[1]);
      }
    }
  }

  function dispose() {
    offs.clear();
    layout = null;
  }

  return { draw, dispose };
}
