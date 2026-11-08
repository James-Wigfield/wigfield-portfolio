"""bar: a bar counter. The CUSTOMER side is the front (-y): panelled front, a brass foot rail, a thick
top with a rounded bullnose that overhangs the customers; the bartender side (+y) has an underbar shelf.

params:
  top      material name for the bar top (default: the main material)
  topColor "#hex" (default: the main colour, a shade darker)
  front    "panels" | "planks" | "plain"   front treatment (default panels)
  rail     bool   foot rail (default true)
  stools   int    stools in front of the bar (only when d >= 0.9; default 0)
Materials: main = body + top (default walnut); accent = foot rail + brackets (default brass).
Typical: 1.07 high, 0.6-0.75 deep incl. the overhang; back bar 0.91.
"""

import math

import bmesh
from mathutils import Matrix

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "walnut", "#5e3f2a")
    vert = U.with_grain(ctx, main)
    acc = U.mat_accent(ctx, spec, "brass")
    top_name = p.get("top") or U.main_name(spec, "walnut")
    top_mat = ctx.materials.get(top_name, p.get("topColor") or U.shade(spec.get("color") or "#5e3f2a", 0.85))
    stools = int(p.get("stools", 0))
    parts = []

    y_front = -d / 2
    if stools and d >= 0.9:
        y_front = d / 2 - 0.62
    tt = U.clamp(0.045 * h, 0.04, 0.06)
    zt = h - tt
    over = U.clamp(0.3 * (d / 2 - y_front), 0.12, 0.25)
    yb0 = y_front + over          # body front face
    rail = bool(p.get("rail", True))

    body = bmesh.new()
    U.add_box(body, (-w / 2 + 0.01, yb0, 0.08), (w / 2 - 0.01, d / 2 - 0.01, zt), 0.004)
    U.add_box(body, (-w / 2 + 0.02, yb0 + 0.03, 0.0), (w / 2 - 0.02, d / 2 - 0.02, 0.082), 0.002)   # kick
    # underbar shelf on the bartender side
    U.add_box(body, (-w / 2 + 0.03, d / 2 - 0.012, zt - 0.32), (w / 2 - 0.03, d / 2, zt - 0.3), 0.002)
    parts.append(U.obj_from_bm(ctx, "body", body, [main]))

    fb = bmesh.new()
    style = p.get("front", "panels")
    if style == "planks":
        n = max(3, int(w / 0.11))
        U.add_planks(fb, (-w / 2 + 0.01, yb0 - 0.014, 0.085), (w / 2 - 0.01, yb0 + 0.001, zt - 0.03), n, axis="x",
                     gap=0.003, bevel=0.002)
    elif style == "panels":
        n = max(1, round(w / 0.6))
        za, zb = 0.1, zt - 0.05
        # stiles + rails, then a raised panel in each bay
        U.add_box(fb, (-w / 2 + 0.01, yb0 - 0.018, za - 0.02), (w / 2 - 0.01, yb0 + 0.001, za + 0.04), 0.003)
        U.add_box(fb, (-w / 2 + 0.01, yb0 - 0.018, zb - 0.05), (w / 2 - 0.01, yb0 + 0.001, zb + 0.02), 0.003)
        for i in range(n + 1):
            x = -w / 2 + 0.01 + (w - 0.02) * i / n
            x0 = max(-w / 2 + 0.01, x - 0.035)
            x1 = min(w / 2 - 0.01, x + 0.035)
            U.add_box(fb, (x0, yb0 - 0.018, za - 0.02), (x1, yb0 + 0.001, zb + 0.02), 0.003)
        for i in range(n):
            xa = -w / 2 + 0.01 + (w - 0.02) * i / n + 0.035
            xb = -w / 2 + 0.01 + (w - 0.02) * (i + 1) / n - 0.035
            pb = bmesh.new()
            U.add_box(pb, (xa + 0.012, yb0 - 0.022, za + 0.052), (xb - 0.012, yb0 - 0.006, zb - 0.062), 0.012, 3)
            U.merge_bm(fb, pb)
            U.add_box(fb, (xa - 0.001, yb0 - 0.008, za + 0.039), (xb + 0.001, yb0 + 0.0005, zb - 0.049), 0.0)
    if len(fb.verts):
        parts.append(U.obj_from_bm(ctx, "front", fb, [vert]))
    else:
        fb.free()

    # top with a bullnose front edge
    tb = bmesh.new()
    U.add_box(tb, (-w / 2, y_front + 0.004, zt), (w / 2, d / 2, h), tt * 0.45, 5)
    parts.append(U.obj_from_bm(ctx, "top", tb, [top_mat]))

    if rail:
        rb = bmesh.new()
        rr = 0.024
        zr = 0.2
        yr = y_front + rr + 0.012
        if yr + rr < yb0 - 0.02:
            U.add_tube(rb, [(-w / 2 + 0.06, yr, zr), (w / 2 - 0.06, yr, zr)], rr, segments=16)
            for sx in (-1, 1):  # domed end caps
                cap = bmesh.new()
                U.add_lathe(cap, [(0.0, 0.0), (rr, 0.0), (rr * 0.8, rr * 0.6), (0.0, rr * 0.8)], segments=16)
                m = Matrix.Translation((sx * (w / 2 - 0.06), yr, zr)) @ Matrix.Rotation(math.radians(90 * sx), 4, "Y")
                bmesh.ops.transform(cap, matrix=m, verts=cap.verts[:])
                U.merge_bm(rb, cap)
            nb = max(2, int(w / 0.9) + 1)
            for i in range(nb):
                x = -w / 2 + 0.12 + (w - 0.24) * i / (nb - 1)
                U.add_tube(rb, [(x, yr, zr), (x, yb0 - 0.01, zr + 0.06)], 0.009, segments=10)
                U.add_cylinder(rb, (0.0, 0.0), 0.022, 0.0, 0.006, segments=16, bevel=0.002,
                               matrix=Matrix.Translation((x, yb0 - 0.014, zr + 0.06)) @ Matrix.Rotation(
                                   math.radians(-90), 4, "X"))
            parts.append(U.obj_from_bm(ctx, "rail", rb, [acc]))
        else:
            rb.free()

    if stools and d >= 0.9:
        from kit import stool

        sh = U.clamp(h - 0.32, 0.55, 0.8)
        s = 0.4
        for i in range(stools):
            x = -w / 2 + w * (i + 0.5) / stools
            sub = {"id": f"{spec.get('id', 'bar')}_stool{i}", "kit": "stool", "size": [s, sh, s],
                   "color": spec.get("color") or "#5e3f2a", "material": U.main_name(spec, "walnut"),
                   "accent": spec.get("accent") or "#c49a4a", "accentMaterial": U.accent_name(spec, "brass")}
            for ob in stool.build(ctx, sub):
                ob.data.transform(Matrix.Translation((x, -d / 2 + 0.03 + s / 2, 0.0)))
                ob.name = f"stool_{i + 1}_{ob.name}"
                parts.append(ob)
    return parts
