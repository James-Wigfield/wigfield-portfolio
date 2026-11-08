"""shelf: bookcase / open shelving. Two sides, top, bottom on a recessed kick, shelf boards and an
optional back panel; the OPEN side faces -y. Optionally filled with books and a few objects.

params:
  shelves  int       compartments stacked vertically (default ~ one per 0.35 m)
  books    bool      fill compartments with books (default false)
  decor    bool      a vase / box / stack among the books (default true when books)
  back     bool      back panel (default true)
  fill     0..1      how full each compartment is (default 0.72)
Materials: main = carcass (default pine); book colours come from a muted palette, seeded by the object
id so a rebuild is identical; accent = the decor vase (default ceramic).
"""

import math

import bmesh
from mathutils import Matrix

from kit import _util as U

BOOK_COLORS = ["#8c3b2e", "#2f4858", "#c9a24b", "#556b2f", "#e8e0cc", "#6b4f72", "#2c2c2c", "#b5643c",
               "#4a6670", "#a83f3f", "#d6cbb0", "#3d5a80"]


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    rng = ctx.rng
    main = U.mat_main(ctx, spec, "pine")
    vert = U.with_grain(ctx, main, "z")
    n = int(p.get("shelves", max(1, round((h - 0.1) / 0.35))))
    n = max(1, min(n, 12))
    has_back = bool(p.get("back", True))
    books = bool(p.get("books", False))
    decor = bool(p.get("decor", books))
    fill = U.clamp(float(p.get("fill", 0.72)), 0.1, 1.0)

    t = U.clamp(w * 0.025, 0.016, 0.025)   # board thickness
    kick = U.clamp(h * 0.04, 0.04, 0.08)
    bt = 0.008 if has_back else 0.0
    parts = []

    car = bmesh.new()
    sides = bmesh.new()
    for sx in (-1, 1):
        x = sx * (w / 2 - t / 2)
        U.add_box(sides, (x - t / 2, -d / 2, 0.0), (x + t / 2, d / 2, h - t + 0.0005), 0.003)
    U.add_box(car, (-w / 2, -d / 2, h - t), (w / 2, d / 2, h), 0.004, 3)  # top
    U.add_box(car, (-w / 2 + t - 0.001, -d / 2 + 0.025, 0.0), (w / 2 - t + 0.001, d / 2 - bt - 0.002, kick), 0.002)
    inner_lo = kick
    inner_hi = h - t
    boards = [inner_lo + (inner_hi - inner_lo) * i / n for i in range(n)]  # z of each board bottom
    comp = []
    for i, zb in enumerate(boards):
        zt = zb + t
        U.add_box(car, (-w / 2 + t - 0.001, -d / 2 + 0.004, zb), (w / 2 - t + 0.001, d / 2 - bt - 0.001, zt), 0.003)
        top = boards[i + 1] if i + 1 < n else inner_hi
        comp.append((zt, top))
    if has_back:
        U.add_box(car, (-w / 2 + t - 0.002, d / 2 - bt, kick * 0.5), (w / 2 - t + 0.002, d / 2, h - t + 0.002), 0.001)
    parts.append(U.obj_from_bm(ctx, "carcass", car, [main]))
    parts.append(U.obj_from_bm(ctx, "sides", sides, [vert]))

    if books:
        palette = BOOK_COLORS[:]
        rng.shuffle(palette)
        palette = palette[:6]
        mats = [ctx.materials.get("paper", c) for c in palette]
        bb = bmesh.new()
        dec = bmesh.new()
        xl, xr = -w / 2 + t + 0.004, w / 2 - t - 0.004
        depth_max = d - bt - 0.03
        for ci, (z0, z1) in enumerate(comp):
            ch = z1 - z0
            if ch < 0.08:
                continue
            x = xl + rng.uniform(0.0, 0.03)
            limit = xl + (xr - xl) * fill * rng.uniform(0.85, 1.12)
            limit = min(limit, xr)
            decor_at = rng.choice([None, "start", "end"]) if decor and ci % 2 == 1 else None
            if decor_at == "start":
                x = _decor(dec, rng, x, z0, min(ch, 0.3), -d / 2 + 0.03, depth_max) + 0.02
            run = 0
            while x < limit - 0.012:
                if run > 4 and rng.random() < 0.12 and limit - x > 0.2:
                    # a short horizontal stack
                    sw = rng.uniform(0.15, min(0.24, depth_max * 1.2))
                    zz = z0
                    for _ in range(rng.randint(2, 4)):
                        bh = rng.uniform(0.02, 0.04)
                        ln = sw * rng.uniform(0.85, 1.0)
                        if zz + bh > z1 - 0.01:
                            break
                        dep = min(depth_max, rng.uniform(0.13, 0.2))
                        y0 = -d / 2 + 0.025 + rng.uniform(0, 0.01)
                        U.add_box(bb, (x, y0, zz), (x + ln, y0 + dep, zz + bh), 0.002, 1, rng.randrange(6))
                        zz += bh
                    x += sw + 0.01
                    run = 0
                    continue
                bw = rng.uniform(0.016, 0.045)
                bh = min(ch - 0.015, rng.uniform(0.6, 0.92) * min(ch, 0.32))
                dep = min(depth_max, rng.uniform(0.13, 0.22))
                y0 = -d / 2 + 0.02 + rng.uniform(0.0, 0.012)
                if x + bw > limit:
                    break
                ang = math.radians(rng.uniform(9, 16))
                lean_room = bh * math.sin(ang) + bw
                if run > 2 and rng.random() < 0.18 and xr - x > lean_room + 0.01:
                    # the last book of the run leans into the gap, pivoting on its bottom-right edge
                    tb = bmesh.new()
                    U.add_box(tb, (x, y0, z0), (x + bw, y0 + dep, z0 + bh), 0.0015, 1, rng.randrange(6))
                    m = (Matrix.Translation((x + bw, 0, z0)) @ Matrix.Rotation(ang, 4, "Y")
                         @ Matrix.Translation((-(x + bw), 0, -z0)))
                    bmesh.ops.transform(tb, matrix=m, verts=tb.verts[:])
                    U.merge_bm(bb, tb)
                    x += lean_room
                    break
                U.add_box(bb, (x, y0, z0), (x + bw, y0 + dep, z0 + bh), 0.0015, 1, rng.randrange(6))
                x += bw + rng.uniform(0.0, 0.002)
                run += 1
            if decor_at == "end" and xr - x > 0.12:
                _decor(dec, rng, xr - 0.11, z0, min(ch, 0.3), -d / 2 + 0.03, depth_max)
        parts.append(U.obj_from_bm(ctx, "books", bb, mats))
        if len(dec.verts):
            parts.append(U.obj_from_bm(ctx, "decor", dec, [U.mat_accent(ctx, spec, "ceramic", "#e9e4da")]))
        else:
            dec.free()
    return parts


def _decor(bm, rng, x, z0, ch, y0, depth):
    """A small vase (lathe) sitting at x..x+~0.1. Returns the right edge."""
    r = min(0.045, depth * 0.3)
    hh = min(ch - 0.03, rng.uniform(0.12, 0.2))
    cx = x + r + 0.005
    cy = y0 + depth * 0.5
    prof = [(0.0, 0.0), (r * 0.7, 0.0), (r * 0.95, hh * 0.2), (r, hh * 0.45), (r * 0.6, hh * 0.8), (r * 0.42, hh * 0.92),
            (r * 0.5, hh), (r * 0.4, hh), (r * 0.36, hh * 0.9), (0.0, hh * 0.86)]
    U.add_lathe(bm, prof, segments=24, center=(cx, cy, z0))
    return cx + r
