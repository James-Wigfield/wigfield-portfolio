"""table: dining / coffee / side / cafe table. Top at height h, legs or a pedestal underneath.

params:
  shape  "rect" | "round"                 (default rect; round tops are elliptical when w != d)
  legs   4 | "pedestal" | "trestle"       (default: rect -> 4, round -> pedestal)
  apron  bool                             rails under a rect top (default true when h > 0.5)
  top    float                            top thickness in metres (default ~3-4 cm)
Materials: main = top (default oak); accent = legs / base (default: the main wood, grain vertical).
"""

import math

import bmesh
from mathutils import Matrix

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    shape = p.get("shape", "rect")
    legs = p.get("legs", "pedestal" if shape == "round" else 4)
    apron = bool(p.get("apron", h > 0.5))
    tt = float(p.get("top", U.clamp(0.025 + 0.008 * max(w, d), 0.025, 0.045)))
    main = U.mat_main(ctx, spec, "oak")
    lm = U.legs_mat(ctx, spec, main)
    parts = []

    tb = bmesh.new()
    if shape == "round":
        U.add_cylinder(tb, (0.0, 0.0), w / 2, h - tt, h, segments=64, bevel=min(0.01, tt * 0.4), bevel_segments=3,
                       ry=d / 2)
    else:
        U.add_box(tb, (-w / 2, -d / 2, h - tt), (w / 2, d / 2, h), min(0.008, tt * 0.3), 3)
    parts.append(U.obj_from_bm(ctx, "top", tb, [main]))

    zt = h - tt
    lb = bmesh.new()
    if legs == "pedestal":
        rf = U.clamp(min(w, d) * 0.32, 0.12, 0.4)
        rc = U.clamp(min(w, d) * 0.06, 0.03, 0.07)
        prof = [(0.0, 0.0), (rf, 0.0), (rf, 0.012), (rf * 0.92, 0.03), (rf * 0.45, 0.06), (rc * 1.5, 0.11),
                (rc, 0.17), (rc, zt - 0.08), (rc * 1.4, zt - 0.04), (rc * 2.6, zt - 0.012), (rc * 2.6, zt),
                (0.0, zt)]
        U.add_lathe(lb, prof, segments=40, sharp_rows=(1, 10))
    elif legs == "trestle":
        for sx in (-1, 1):
            x = sx * (w / 2 - 0.12)
            U.add_box(lb, (x - 0.025, -d / 2 + 0.07, 0.0), (x + 0.025, d / 2 - 0.07, 0.05), 0.006)
            U.add_box(lb, (x - 0.02, -0.06, 0.04), (x + 0.02, 0.06, zt), 0.005)
            U.add_box(lb, (x - 0.025, -d / 2 + 0.09, zt - 0.05), (x + 0.025, d / 2 - 0.09, zt), 0.006)
        U.add_box(lb, (-w / 2 + 0.12, -0.02, 0.18), (w / 2 - 0.12, 0.02, 0.24), 0.005)
    else:
        n = int(legs) if str(legs).isdigit() else 4
        if shape == "round":
            rr = min(w, d) / 2 * 0.55
            for i in range(n):
                a = math.pi / 4 + 2 * math.pi * i / n
                U.add_leg(lb, (rr * math.cos(a), rr * math.sin(a)), 0.0, zt, top=0.045, bottom=0.03, shape="round",
                          lean=(0.06 * math.cos(a), 0.06 * math.sin(a)))
            if apron:
                U.add_tube(lb, [(rr * 0.9 * math.cos(2 * math.pi * k / 48), rr * 0.9 * math.sin(2 * math.pi * k / 48),
                                 zt - 0.04) for k in range(48)], 0.012, closed=True)
        else:
            lt = U.clamp(min(w, d) * 0.06, 0.04, 0.07)
            ins = lt / 2 + U.clamp(min(w, d) * 0.05, 0.02, 0.06)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    U.add_leg(lb, (sx * (w / 2 - ins), sy * (d / 2 - ins)), 0.0, zt, top=lt, bottom=lt * 0.65,
                              shape="square", bevel=0.004)
            if apron and h > 0.4:
                ah = U.clamp(0.1 * h, 0.05, 0.09)
                at = 0.02
                xo, yo = w / 2 - ins, d / 2 - ins
                face = lt / 2 - 0.012
                for sy in (-1, 1):
                    y = sy * (yo + face - at / 2)
                    U.add_box(lb, (-xo, y - at / 2, zt - ah), (xo, y + at / 2, zt), 0.002)
                for sx in (-1, 1):
                    x = sx * (xo + face - at / 2)
                    U.add_box(lb, (x - at / 2, -yo, zt - ah), (x + at / 2, yo, zt), 0.002)
            if n > 4:
                pass
    parts.append(U.obj_from_bm(ctx, "base", lb, [lm]))
    return parts
