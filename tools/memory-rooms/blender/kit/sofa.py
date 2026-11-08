"""sofa: upholstered sofa. Base, back, arms, soft pillowed seat + back cushions, short legs.
The seat side faces the FRONT (-y); the back is at +y.

params:
  seats         int                              seat cushions (default from the width, 1-4)
  arms          "both" | "none" | "left" | "right"   (true/false also accepted; left = -x)
  armStyle      "square" | "rolled"              (default square; armchair defaults to rolled)
  backCushions  bool                             loose back cushions (default true)
  legs          bool                             short legs; false = skirt to the floor (default true)
  seat          float                            seat height (default ~0.53 * h, 0.34-0.48)
Materials: main = upholstery (default linen); accent = legs (default walnut).
Typical: 3-seat 2.1 x 0.85 x 0.92, loveseat 1.5 x 0.85 x 0.9, seat height 0.45.
"""

import math

import bmesh
from mathutils import Matrix

from kit import _util as U


def build(ctx, spec):
    return build_seating(ctx, spec)


def build_seating(ctx, spec, armchair=False):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "linen")
    acc = U.mat_accent(ctx, spec, "walnut", "#4a3426")
    arms = p.get("arms", "both")
    if arms is True:
        arms = "both"
    elif arms is False:
        arms = "none"
    left = arms in ("both", "left")
    right = arms in ("both", "right")
    rolled = p.get("armStyle", "rolled" if armchair else "square") == "rolled"
    has_legs = bool(p.get("legs", True))
    back_cushions = bool(p.get("backCushions", True))

    lh = U.clamp(0.11 * h, 0.06, 0.12) if has_legs else 0.0
    st = float(p.get("seat", U.clamp(0.53 * h, 0.34, 0.48)))
    aw = U.clamp((0.2 if armchair else 0.085) * w, 0.11, 0.2) if (left or right) else 0.0
    at = U.clamp(st + 0.18, st + 0.06, h - 0.08)
    bt = U.clamp(0.19 * d, 0.13, 0.22)
    ct = U.clamp(0.32 * (st - lh), 0.09, 0.15)
    base_top = st - ct
    xl = -w / 2 + (aw if left else 0.0)
    xr = w / 2 - (aw if right else 0.0)
    inner = xr - xl
    seats = int(p.get("seats", max(1, min(4, round(inner / 0.62)))))
    seats = max(1, min(seats, 6))
    parts = []

    # base platform between the arms
    parts.append(U.cushion(ctx, "base", (xl - (0.02 if left else 0.0), -d / 2 + 0.01, lh),
                           (xr + (0.02 if right else 0.0), d / 2 - bt + 0.03, base_top),
                           main, radius=0.03, pillow=0.0, bulge=0.004, cell=0.35, levels=1))
    # back frame, full width
    back_top = h - (0.05 if back_cushions else 0.0)
    parts.append(U.cushion(ctx, "back", (-w / 2 + 0.002, d / 2 - bt, lh), (w / 2 - 0.002, d / 2, back_top), main,
                           radius=0.045, pillow=0.012, bulge=0.006, cell=0.3))
    # arms
    for on, sx, name in ((left, -1, "arm_left"), (right, 1, "arm_right")):
        if not on:
            continue
        xa, xb = sorted((sx * w / 2, sx * (w / 2 - aw)))
        r = 0.07 if rolled else 0.04
        pil = 0.03 if rolled else 0.012
        parts.append(U.cushion(ctx, name, (xa, -d / 2, lh), (xb, d / 2 - bt + 0.04, at), main, radius=r, pillow=pil,
                               bulge=0.008 if rolled else 0.004))
    # seat cushions
    gap = 0.004
    y_back = d / 2 - bt - (U.clamp(0.17 * d, 0.12, 0.18) * 0.55 if back_cushions else 0.0)
    for i in range(seats):
        xa = xl + inner * i / seats + gap
        xb = xl + inner * (i + 1) / seats - gap
        parts.append(U.cushion(ctx, f"cushion_seat_{i + 1}", (xa, -d / 2 - 0.0, base_top - 0.004), (xb, y_back, st),
                               main, radius=0.04, pillow=0.02, bulge=0.008))
    # back cushions, pillowed toward the sitter and raked back
    if back_cushions:
        bct = U.clamp(0.17 * d, 0.12, 0.18)
        rake = math.radians(9.0)
        for i in range(seats):
            xa = xl + inner * i / seats + gap
            xb = xl + inner * (i + 1) / seats - gap
            ya = d / 2 - bt - bct
            ob = U.cushion(ctx, f"cushion_back_{i + 1}", (xa, ya, st - 0.03), (xb, d / 2 - bt + 0.015, h - 0.004),
                           main, radius=0.045, pillow=0.035, bulge=0.006, up="-y")
            pivot = (0.0, d / 2 - bt + 0.015, st - 0.03)
            m = Matrix.Translation(pivot) @ Matrix.Rotation(-rake, 4, "X") @ Matrix.Translation([-c for c in pivot])
            ob.data.transform(m)
            # keep the top inside the box after the rake
            top = max(v.co.z for v in ob.data.vertices)
            if top > h:
                ob.data.transform(Matrix.Translation((0, 0, h - top)))
            parts.append(ob)
    # legs
    if has_legs:
        lg = bmesh.new()
        xs = [-w / 2 + 0.07, w / 2 - 0.07]
        if w > 1.9:
            xs.append(0.0)
        for x in xs:
            for sy in (-1, 1):
                sx = 0 if x == 0 else (1 if x > 0 else -1)
                U.add_leg(lg, (x, sy * (d / 2 - 0.07)), 0.0, lh + 0.01, top=0.042, bottom=0.028, shape="round",
                          lean=(sx * 0.012, sy * 0.012))
        parts.append(U.obj_from_bm(ctx, "legs", lg, [U.with_grain(ctx, acc)]))
    return parts
