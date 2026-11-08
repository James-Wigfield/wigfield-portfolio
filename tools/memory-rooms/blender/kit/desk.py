"""desk: writing desk. Top, a drawer pedestal on one side, legs on the other, a modesty panel at the
back (+y). The knee space faces the FRONT (-y).

params:
  drawers   "right" | "left" | "none"   pedestal side (default right; none below 0.9 m wide)
  count     int                         drawers in the pedestal (default 3, 2 if the desk is low)
  side      "legs" | "panel"            the open end (default legs)
  modesty   bool                        back panel (default true)
  handles   "bar" | "knob" | "none"     (default bar)
Materials: main = top + carcass (default oak); accent = handles (default brass).
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "oak")
    acc = U.mat_accent(ctx, spec, "brass")
    side = p.get("drawers", "right" if w >= 0.9 else "none")
    handles = p.get("handles", "bar")
    tt = 0.03
    zt = h - tt
    parts = []

    body = bmesh.new()
    U.add_box(body, (-w / 2, -d / 2, zt), (w / 2, d / 2, h), 0.006, 3)

    hp = 0.024 if handles != "none" else 0.0
    open_x = None
    if side in ("left", "right"):
        pw = U.clamp(w * 0.34, 0.32, 0.45)
        sgn = 1 if side == "right" else -1
        xa, xb = sorted((sgn * (w / 2 - 0.012), sgn * (w / 2 - 0.012 - pw)))
        y_face = -d / 2 + hp + 0.01
        y_car = y_face + 0.019
        U.add_box(body, (xa, y_car, 0.0), (xb, d / 2 - 0.02, zt), 0.003)
        U.add_box(body, (xa + 0.015, y_car - 0.016, 0.0), (xb - 0.015, y_car + 0.01, 0.045), 0.002)  # kick
        fr = bmesh.new()
        hd = bmesh.new()
        count = int(p.get("count", 3 if zt > 0.55 else 2))
        z0, z1 = 0.05, zt - 0.004
        gap = 0.004
        for i in range(count):
            za = z0 + (z1 - z0) * i / count
            zb = z0 + (z1 - z0) * (i + 1) / count
            U.add_front(fr, xa + gap, xb - gap, za + gap / 2, zb - gap / 2, y_face, y_car - 0.001)
            U.add_handle(hd, handles, ((xa + xb) / 2, y_face, (za + zb) / 2 + (zb - za) * 0.12),
                         length=U.clamp(pw * 0.35, 0.07, 0.14))
        parts.append(U.obj_from_bm(ctx, "fronts", fr, [main]))
        if handles != "none":
            parts.append(U.obj_from_bm(ctx, "handles", hd, [acc]))
        else:
            hd.free()
        open_x = -sgn
        inner_x = xa if sgn > 0 else xb
    else:
        inner_x = None

    lg = bmesh.new()
    ends = [open_x] if open_x is not None else [-1, 1]
    for sx in ends:
        if p.get("side", "legs") == "panel":
            x = sx * (w / 2 - 0.03)
            U.add_box(lg, (x - 0.011, -d / 2 + 0.04, 0.0), (x + 0.011, d / 2 - 0.02, zt), 0.003)
        else:
            for sy in (-1, 1):
                U.add_leg(lg, (sx * (w / 2 - 0.035), sy * (d / 2 - 0.035)), 0.0, zt, top=0.045, bottom=0.034,
                          shape="square", bevel=0.004)
            # side stretcher between the two legs
            x = sx * (w / 2 - 0.035)
            U.add_box(lg, (x - 0.012, -d / 2 + 0.05, 0.12), (x + 0.012, d / 2 - 0.05, 0.15), 0.003)
    if p.get("modesty", True):
        xa = -w / 2 + 0.06 if (open_x is None or open_x < 0) else w / 2 - 0.06
        xb = inner_x if inner_x is not None else (w / 2 - 0.06)
        xa, xb = sorted((xa, xb))
        y = d / 2 - 0.035
        U.add_box(lg, (xa, y - 0.009, zt - U.clamp(0.42 * zt, 0.2, 0.34)), (xb, y + 0.009, zt), 0.002)
    parts.append(U.obj_from_bm(ctx, "body", body, [main]))
    parts.append(U.obj_from_bm(ctx, "legs", lg, [U.with_grain(ctx, main)]))
    return parts
