"""car: a toy-like saloon: a rounded body with real wheel arches, a tapered glasshouse with inset
windows, wheels with rims, bumpers, lights, grille, mirrors and plates.

size = [w, h, d] = width x height x length; the FRONT is local -y. color = paint, accent = trim
(bumpers / rims). params: lit (headlights + tail lights glow; default at evening / night),
style "saloon" (default) | "van" | "pickup".
"""

from __future__ import annotations

import math

from mathutils import Matrix

from mrgeo import MB, flat_emit, shade


def build(ctx, spec):
    W, H, L = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    mood = ((ctx.scene.get("style") or {}).get("mood")) or "day"
    lit = bool(P.get("lit", mood in ("evening", "night")))
    style = P.get("style", "saloon")
    M = ctx.materials
    paint = ctx.mat(spec, fallback="metal")
    acc_hex = spec.get("accent") or "#d8d8d8"
    trim = M.get(spec.get("accentMaterial") or "chrome", acc_hex)
    glass = M.get("plastic", "#1d2731")
    tyre = M.get("plastic", "#1b1b1d")
    dark = M.get("plastic", "#2a2c2f")
    plate = M.get("plastic", "#f1efe6")
    head_m = flat_emit("emit_headlight", "#fff3d2", 3.0) if lit else M.get("ceramic", "#f4f1e6")
    tail_m = flat_emit("emit_taillight", "#ff3a2c", 2.0) if lit else M.get("plastic", "#b0261d")

    r = H * 0.235
    gc = H * 0.12
    af, ar = -L / 2 + L * 0.185, L / 2 - L * 0.2
    ra = r + 0.035

    def arch(axle):
        th0 = math.asin(max(-1.0, min(1.0, (gc - r) / ra)))
        pts = []
        for k in range(13):
            th = th0 + (math.pi - 2 * th0) * k / 12
            pts.append((axle + ra * math.cos(th), r + ra * math.sin(th)))
        return pts

    belt = H * (0.62 if style != "van" else 0.58)
    body_prof = [
        (-L / 2 + L * 0.025, gc), (-L / 2, gc + H * 0.13), (-L / 2, H * 0.44), (-L / 2 + L * 0.05, H * 0.535),
        (-L / 2 + L * 0.29, belt - H * 0.02), (L / 2 - L * 0.15, belt), (L / 2 - L * 0.025, belt - H * 0.03),
        (L / 2, H * 0.47), (L / 2, gc + H * 0.13), (L / 2 - L * 0.025, gc),
    ]
    body_prof += arch(ar) + arch(af)
    body = MB()
    body.prism(body_prof, "x", -W / 2, W / 2, paint)

    if style == "van":
        cab = [(-L / 2 + L * 0.2, belt - 0.05), (-L / 2 + L * 0.34, H * 0.985), (L / 2 - L * 0.02, H * 0.985),
               (L / 2 - L * 0.02, belt - 0.05)]
    elif style == "pickup":
        cab = [(-L / 2 + L * 0.29, belt - 0.05), (-L / 2 + L * 0.42, H * 0.985), (L * 0.06, H * 0.985),
               (L * 0.08, belt - 0.05)]
    else:
        cab = [(-L / 2 + L * 0.29, belt - 0.05), (-L / 2 + L * 0.47, H * 0.985), (L / 2 - L * 0.31, H * 0.985),
               (L / 2 - L * 0.14, belt - 0.05)]
    Wc = W * 0.9
    zlo, zhi = belt - 0.05, H * 0.985
    taper = 0.15

    def xs(z):
        f = max(0.0, min(1.0, (z - zlo) / (zhi - zlo)))
        return Wc / 2 * (1 - taper * f)

    cabin = MB()
    cabin.prism(cab, "x", -Wc / 2, Wc / 2, paint)
    for i, v in enumerate(cabin.verts):
        v.x = math.copysign(xs(v.z), v.x)
    body.verts.extend(cabin.verts)
    off = len(body.verts) - len(cabin.verts)
    for f, mi, sm in zip(cabin.faces, cabin.face_mat, cabin.face_smooth):
        body.face([off + i for i in f], paint, sm)

    # windows: inset panels on the sloped glasshouse, a hair proud of it
    c0, c1, c2, c3 = cab
    m = 0.05

    def side_window(ya, yb, za, zb, sgn):
        def P(y, z):
            return (sgn * (xs(z) + 0.004), y, z)
        f_lo = c0[0] + (za - c0[1]) * (c1[0] - c0[0]) / (c1[1] - c0[1])
        f_hi = c0[0] + (zb - c0[1]) * (c1[0] - c0[0]) / (c1[1] - c0[1])
        r_lo = c3[0] + (za - c3[1]) * (c2[0] - c3[0]) / (c2[1] - c3[1])
        r_hi = c3[0] + (zb - c3[1]) * (c2[0] - c3[0]) / (c2[1] - c3[1])
        lo_a, hi_a = max(ya, f_lo + m * 1.4), max(ya, f_hi + m * 1.4)
        lo_b, hi_b = min(yb, r_lo - m * 1.4), min(yb, r_hi - m * 1.4)
        if lo_b - lo_a > 0.08 and hi_b - hi_a > 0.04:
            body.poly([P(lo_a, za), P(lo_b, za), P(hi_b, zb), P(hi_a, zb)], glass, (sgn, 0, 0))

    za, zb = belt + 0.03, zhi - 0.06
    yb_p = (c1[0] + c2[0]) / 2 + L * 0.03
    for sgn in (-1, 1):
        side_window(-L, yb_p - 0.04, za, zb, sgn)
        side_window(yb_p + 0.04, L, za, zb, sgn)

    def slope_window(pa, pb, outward_y):
        (ya, za_), (yb, zb_) = pa, pb
        pts = []
        for s, sx in ((0.1, -1), (0.1, 1), (0.9, 1), (0.9, -1)):
            y = ya + (yb - ya) * s
            z = za_ + (zb_ - za_) * s
            ny, nz = -(zb_ - za_), (yb - ya)
            nl = math.hypot(ny, nz)
            ny, nz = ny / nl * outward_y, nz / nl * outward_y
            pts.append((sx * (xs(z) - 0.07), y + ny * 0.004, z + nz * 0.004))
        body.poly(pts, glass, (0, -(zb_ - za_), (yb - ya)))

    slope_window(c0, c1, 1)
    slope_window(c2, c3, 1)

    # details
    det = MB()
    det.cbox((0, -L / 2 - 0.01, gc + H * 0.1), (W * 0.98, 0.1, H * 0.1), trim)
    det.cbox((0, L / 2 + 0.01, gc + H * 0.1), (W * 0.98, 0.1, H * 0.1), trim)
    det.cbox((0, -L / 2 - 0.006, H * 0.36), (W * 0.4, 0.03, H * 0.09), dark)
    det.cbox((0, -L / 2 - 0.065, gc + H * 0.1), (0.36, 0.02, 0.1), plate)
    det.cbox((0, L / 2 + 0.065, gc + H * 0.13), (0.36, 0.02, 0.1), plate)
    lights = MB()
    for sx in (-1, 1):
        lights.cbox((sx * W * 0.34, -L / 2 - 0.004, H * 0.425), (W * 0.2, 0.03, H * 0.07), head_m)
        lights.cbox((sx * W * 0.38, L / 2 + 0.004, H * 0.43), (W * 0.16, 0.03, H * 0.06), tail_m)
        det.cbox((sx * (xs(belt) + 0.06), c0[0] + 0.14, belt + 0.07), (0.1, 0.07, 0.08), paint)
        for yh in (-L * 0.04, L * 0.17):
            det.cbox((sx * (W / 2 + 0.006), yh, belt - 0.1), (0.02, 0.12, 0.025), trim)
    wheels = MB()
    tw = min(0.24, W * 0.13)
    for sx in (-1, 1):
        for ay in (af, ar):
            mtx = Matrix.Translation((sx * (W / 2 - tw / 2 - 0.02), ay, r)) @ Matrix.Rotation(
                math.radians(90 * sx), 4, "Y")
            wheels.lathe([(r * 0.6, -tw / 2), (r * 0.93, -tw / 2), (r, -tw / 2 + 0.03), (r, tw / 2 - 0.03),
                          (r * 0.93, tw / 2), (r * 0.62, tw / 2)], tyre, n=28, m=mtx, cap_bottom=False,
                         cap_top=False)
            wheels.lathe([(0.0, -tw / 2 + 0.01), (r * 0.61, -tw / 2 + 0.01), (r * 0.61, tw / 2 - 0.012),
                          (r * 0.52, tw / 2 - 0.004), (r * 0.42, tw / 2 - 0.022), (r * 0.16, tw / 2 - 0.016),
                          (r * 0.1, tw / 2 + 0.008), (0.0, tw / 2 + 0.01)], trim, n=28, m=mtx)
    return [body.obj("body", ctx.collection, bevel_w=min(0.06, H * 0.04), segments=3, angle=30),
            det.obj("trim", ctx.collection, bevel_w=0.012, segments=2),
            lights.obj("lights", ctx.collection, bevel_w=0.008, segments=2),
            wheels.obj("wheels", ctx.collection, smooth_angle=50)]
