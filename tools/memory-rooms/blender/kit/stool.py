"""stool: round (or square) seat on splayed legs; bar stools (h > 0.55) get a footrest ring.

params:
  legs     3 | 4                 (default 4 when h > 0.6 else 3)
  shape    "round" | "square"    seat shape (default round)
  footrest bool                  ring at ~30 % height (default true when h > 0.55)
  back     bool                  a low back rest at +y; the seat drops so it fits the box (default false)
Materials: main = seat (default oak); accent = legs + footrest (default: main wood; metal looks great).
"""

import math

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "oak")
    lm = U.legs_mat(ctx, spec, main)
    metal_legs = lm.get("mr_material") in U.METALS
    n = int(p.get("legs", 4 if h > 0.6 else 3))
    shape = p.get("shape", "round")
    r = min(w, d) / 2
    has_back = bool(p.get("back", False))
    box_h = h
    if has_back:
        h = box_h - U.clamp(0.28 * box_h, 0.18, 0.3)   # seat height; the back rest fills the rest
    st = U.clamp(0.08 * h, 0.03, 0.045)
    parts = []

    sb = bmesh.new()
    if shape == "square":
        U.add_box(sb, (-w / 2, -d / 2, h - st), (w / 2, d / 2, h), 0.01, 3)
    else:
        prof = [(0.0, h - st), (r * 0.94, h - st), (r, h - st + 0.01), (r, h - 0.01), (r * 0.96, h - 0.0005),
                (r * 0.5, h - 0.003), (0.0, h - 0.004)]
        U.add_lathe(sb, prof, segments=48)
    parts.append(U.obj_from_bm(ctx, "seat", sb, [main]))

    lb = bmesh.new()
    rt = r * 0.52
    rb = r * 0.9
    zt = h - st
    lw = 0.022 if metal_legs else U.clamp(r * 0.16, 0.026, 0.04)
    a0 = math.pi / 4 if n == 4 else -math.pi / 2
    feet = []
    for i in range(n):
        a = a0 + 2 * math.pi * i / n
        top = (rt * math.cos(a), rt * math.sin(a))
        foot = (rb * math.cos(a), rb * math.sin(a))
        feet.append((top, foot))
        if metal_legs:
            U.add_tube(lb, [(top[0], top[1], zt + 0.002), (foot[0], foot[1], 0.006)], lw / 2, segments=12)
            U.add_cylinder(lb, foot, lw * 0.7, 0.0, 0.008, segments=12, bevel=0.002)
        else:
            U.add_leg(lb, top, 0.0, zt + 0.002, top=lw, bottom=lw * 0.8, shape="round",
                      lean=(foot[0] - top[0], foot[1] - top[1]))
    if p.get("footrest", h > 0.55):
        zf = U.clamp(0.3 * h, 0.2, 0.35)
        t = zf / zt
        rr = rb + (rt - rb) * t
        U.add_torus(lb, (0.0, 0.0, zf), rr - 0.002, 0.009 if metal_legs else 0.011, segments=40)
    else:
        zf = 0.12
        t = zf / zt
        rr = rb + (rt - rb) * t
        pts = [(rr * math.cos(a0 + 2 * math.pi * i / n), rr * math.sin(a0 + 2 * math.pi * i / n), zf)
               for i in range(n)]
        for i in range(n):
            U.add_tube(lb, [pts[i], pts[(i + 1) % n]], 0.008, segments=10)
    if has_back:
        yb = r * 0.72
        top = box_h - 0.002
        for sx in (-1, 1):
            U.add_tube(lb, [(sx * r * 0.45, yb, h - 0.01), (sx * r * 0.5, min(d / 2 - 0.012, yb + 0.04), top - 0.04)],
                       0.009)
        parts.append(U.box(ctx, "back", (-r * 0.62, min(d / 2 - 0.03, yb + 0.02), top - (box_h - h) * 0.45),
                           (r * 0.62, min(d / 2, yb + 0.05), top), main, 0.008))
    parts.append(U.obj_from_bm(ctx, "legs", lb, [lm]))
    return parts
