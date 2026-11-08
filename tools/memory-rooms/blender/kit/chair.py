"""chair: dining / desk chair. Four legs, a seat at ~0.46 m, back posts that rake back and a back
(top rail + slats) at +y. The seat's FRONT faces -y.

params:
  back     "slats" | "panel" | "spindles" | "ladder"   (default slats)
  cushion  bool        a seat pad in the accent material (default false; default fabric linen)
  seat     float       seat height in metres (default ~0.52 * h, clamped 0.38-0.48)
Materials: main = frame + seat (default oak); accent = seat pad.
"""

import math

import bmesh
from mathutils import Matrix, Vector

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "oak")
    vert = U.with_grain(ctx, main, "z")
    back = p.get("back", "slats")
    sh = float(p.get("seat", U.clamp(0.52 * h, 0.38, 0.48)))
    st = 0.032
    pad = bool(p.get("cushion", False))
    pad_t = 0.03 if pad else 0.0
    zs = sh - pad_t  # top of the wooden seat
    lw = U.clamp(w * 0.08, 0.03, 0.042)
    parts = []

    # back posts: floor -> seat (slight rake) -> top (raked back)
    y_foot = d / 2 - lw / 2 - 0.004
    y_seat = d / 2 - lw / 2 - 0.035
    y_top = d / 2 - lw / 2 - 0.004
    frame = bmesh.new()
    prof = U.rounded_rect_profile(lw, lw * 0.85, lw * 0.25, 2)
    x_post = w / 2 - lw / 2 - 0.004
    for sx in (-1, 1):
        x = sx * x_post
        path = U.fillet([(x, y_foot, 0.0), (x, y_seat, zs - st), (x, y_top, h - 0.004)], 0.25, steps=6)
        U.add_sweep(frame, path, prof, up=(0, 1, 0), sharp_cols=())
    # front legs (slightly splayed forward)
    for sx in (-1, 1):
        U.add_leg(frame, (sx * x_post, -d / 2 + lw / 2 + 0.012), 0.0, zs - st, top=lw, bottom=lw * 0.8,
                  shape="square", lean=(0.0, -0.008), bevel=0.003)
    # stretchers
    for sx in (-1, 1):
        x = sx * (x_post - 0.002)
        U.add_tube(frame, [(x, -d / 2 + 0.04, 0.16), (x, y_seat - 0.01, 0.16)], 0.0085, segments=10)
    U.add_tube(frame, [(-x_post, -d / 2 + 0.03, 0.22), (x_post, -d / 2 + 0.03, 0.22)], 0.0085, segments=10)
    parts.append(U.obj_from_bm(ctx, "frame", frame, [vert]))

    # seat: slightly rounded board
    seat = bmesh.new()
    U.add_box(seat, (-w / 2 + 0.002, -d / 2 + 0.002, zs - st), (w / 2 - 0.002, y_seat + lw / 2 + 0.005, zs), 0.011, 3)
    parts.append(U.obj_from_bm(ctx, "seat", seat, [main]))

    # back assembly, built upright in the plane y = 0 then raked onto the posts
    z0, z1 = zs + 0.07, h - 0.012
    rake = math.atan2(y_top - y_seat, (h - 0.004) - (zs - st))
    xi = x_post - lw / 2 + 0.002
    bk = bmesh.new()
    rail_h = U.clamp((z1 - z0) * 0.22, 0.05, 0.09)
    U.add_box(bk, (-xi - 0.004, -0.011, z1 - rail_h), (xi + 0.004, 0.011, z1), 0.006, 3)
    if back == "panel":
        U.add_box(bk, (-xi, -0.008, z0 + (z1 - z0) * 0.35), (xi, 0.008, z1 - rail_h + 0.002), 0.004)
    elif back == "ladder":
        for k in range(1, 3):
            zz = z0 + (z1 - rail_h - z0) * k / 3
            U.add_box(bk, (-xi, -0.009, zz - 0.022), (xi, 0.009, zz + 0.022), 0.005)
    elif back == "spindles":
        U.add_box(bk, (-xi, -0.01, z0), (xi, 0.01, z0 + 0.03), 0.004)
        n = 5
        for k in range(n):
            x = -xi + (2 * xi) * (k + 0.5) / n
            U.add_cylinder(bk, (x, 0.0), 0.007, z0 + 0.025, z1 - rail_h + 0.005, segments=10, r_top=0.006)
    else:
        U.add_box(bk, (-xi, -0.009, z0), (xi, 0.009, z0 + 0.03), 0.004)
        n = 3 if w < 0.5 else 4
        sw = U.clamp(w * 0.07, 0.025, 0.04)
        for k in range(n):
            x = -xi + (2 * xi) * (k + 0.5) / n
            U.add_box(bk, (x - sw / 2, -0.007, z0 + 0.028), (x + sw / 2, 0.007, z1 - rail_h + 0.002), 0.003)
    # curve the back slightly (concave toward the sitter) and rake it
    for v in bk.verts:
        v.co.y += 0.018 * (v.co.x / max(xi, 1e-3)) ** 2
    m = (Matrix.Translation((0.0, y_seat, zs - st)) @ Matrix.Rotation(-rake, 4, "X")
         @ Matrix.Translation((0.0, 0.0, -(zs - st))))
    bmesh.ops.transform(bk, matrix=m, verts=bk.verts[:])
    parts.append(U.obj_from_bm(ctx, "back", bk, [vert]))

    if pad:
        acc = U.mat_accent(ctx, spec, "linen")
        parts.append(U.cushion(ctx, "cushion_seat", (-w / 2 + 0.012, -d / 2 + 0.01, zs - 0.002),
                               (w / 2 - 0.012, y_seat - 0.01, sh), acc, radius=0.015, pillow=0.008))
    return parts
