"""fridge: a fridge-freezer. Rounded cabinet, doors with soft edges and gaps on the FRONT (-y),
long bar handles, a dark kick grille at the bottom.

params:
  layout  "bottom-freezer" | "top-freezer" | "french" | "side-by-side" | "single"
          (default: single below 1.0 m, french when wider than 0.85 m, else bottom-freezer)
  hinge   "left" | "right"   hinge side for single-column layouts; the handle goes on the other side
Materials: main = cabinet + doors (default metal, stainless #cfd2d6; plastic gives an enamel fridge);
           accent = handles (default chrome).
Typical: 0.76 x 1.78 x 0.74, French door 0.91 x 1.78 x 0.8, under-counter 0.6 x 0.85 x 0.6.
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "metal", "#cfd2d6")
    acc = U.mat_accent(ctx, spec, "chrome", "#d8dadd")
    dark = ctx.materials.get("plastic", "#1e1f21")
    layout = p.get("layout", "single" if h < 1.0 else ("french" if w > 0.85 else "bottom-freezer"))
    hinge = p.get("hinge", "left")
    parts = []

    hp = 0.04            # handle projection
    dt = 0.05            # door thickness
    y_face = -d / 2 + hp
    y_body = y_face + dt
    kick = 0.07
    cb = bmesh.new()
    U.add_box(cb, (-w / 2 + 0.003, y_body - 0.002, 0.012), (w / 2 - 0.003, d / 2, h), 0.02, 4)
    parts.append(U.obj_from_bm(ctx, "cabinet", cb, [main]))
    kb = bmesh.new()
    U.add_box(kb, (-w / 2 + 0.03, y_body - 0.03, 0.012), (w / 2 - 0.03, y_body + 0.01, kick), 0.004)
    for sx in (-1, 1):
        U.add_cylinder(kb, (sx * (w / 2 - 0.06), y_body + 0.02), 0.02, 0.0, 0.014, segments=12, bevel=0.003)
    parts.append(U.obj_from_bm(ctx, "kick", kb, [dark]))

    db = bmesh.new()
    hb = bmesh.new()
    g = 0.005
    x0, x1 = -w / 2, w / 2
    z0, z1 = kick + 0.004, h - 0.004
    bev = 0.012

    def door(xa, xb, za, zb, handle_side, handle_len, vertical=True, handle_z=None):
        U.add_box(db, (xa + g / 2, y_face, za + g / 2), (xb - g / 2, y_body - 0.001, zb - g / 2), bev, 3)
        if handle_side is None:
            return
        if vertical:
            hx = xb - 0.045 if handle_side > 0 else xa + 0.045
            hz = handle_z if handle_z is not None else (za + zb) / 2
            U.add_handle(hb, "bar", (hx, y_face, hz), length=handle_len, vertical=True, proj=hp - 0.004,
                         radius=0.009)
        else:
            U.add_handle(hb, "bar", ((xa + xb) / 2, y_face, zb - 0.06), length=handle_len, proj=hp - 0.004,
                         radius=0.009)

    hside = 1 if hinge == "left" else -1
    if layout == "single":
        door(x0, x1, z0, z1, hside, U.clamp((z1 - z0) * 0.35, 0.15, 0.5))
    elif layout == "top-freezer":
        zs = z1 - (z1 - z0) * 0.3
        door(x0, x1, zs, z1, hside, 0.22, handle_z=zs + 0.16)
        door(x0, x1, z0, zs, hside, U.clamp((zs - z0) * 0.45, 0.2, 0.6), handle_z=zs - 0.05 - (zs - z0) * 0.22)
    elif layout == "side-by-side":
        xm = x0 + (x1 - x0) * 0.42
        door(x0, xm, z0, z1, 1, (z1 - z0) * 0.45)
        door(xm, x1, z0, z1, -1, (z1 - z0) * 0.45)
    elif layout == "french":
        zs = z0 + (z1 - z0) * 0.32
        door(x0, 0.0, zs, z1, 1, U.clamp((z1 - zs) * 0.55, 0.3, 0.8))
        door(0.0, x1, zs, z1, -1, U.clamp((z1 - zs) * 0.55, 0.3, 0.8))
        door(x0, x1, z0, zs, 0, (x1 - x0) * 0.6, vertical=False)
    else:  # bottom-freezer
        zs = z0 + (z1 - z0) * 0.32
        door(x0, x1, zs, z1, hside, U.clamp((z1 - zs) * 0.45, 0.25, 0.7), handle_z=zs + (z1 - zs) * 0.4)
        door(x0, x1, z0, zs, 0, (x1 - x0) * 0.55, vertical=False)
    parts.append(U.obj_from_bm(ctx, "doors", db, [main]))
    parts.append(U.obj_from_bm(ctx, "handles", hb, [acc]))
    return parts
