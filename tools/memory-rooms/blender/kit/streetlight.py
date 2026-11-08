"""streetlight: a cast base, tapered pole, swan-neck arm and a lamp head with a lens.

size = [w, h, d]: w = base width, h = height to the top of the arm, d = reach of the arm.
The pole stands at the BACK (local +y) and the head hangs at the FRONT (local -y), so rotY points the
arm. The lens is a part named `shade`, so a light near it (or one with `object` = this id) makes it glow.
params: heads (1 or 2; 2 = a double arm, mirrored to the back).
"""

from __future__ import annotations

import math

from mrgeo import MB


def _arm(mb, yp, h, y_head, mat, r, sign=1):
    ra = min(0.35, h * 0.06)
    z0 = h - 0.08 - ra
    pts = []
    for k in range(9):
        th = math.radians(90 * k / 8)
        pts.append((0.0, yp - sign * (ra - ra * math.cos(th)), z0 + ra * math.sin(th)))
    pts.append((0.0, y_head + sign * 0.12, h - 0.08))
    mb.tube(pts, r, mat, n=10)
    return z0


def _head(body, lens, y, h, mat, lens_m):
    zc = h - 0.12
    body.lathe([(0.21, 0.0), (0.2, 0.03), (0.14, 0.1), (0.06, 0.14), (0.0, 0.15)], mat, n=24,
               center=(0.0, y, zc - 0.06))
    body.cyl((0.0, y, zc - 0.06 - 0.02), 0.21, 0.02, mat, n=24)
    lens.lathe([(0.0, -0.04), (0.16, -0.035), (0.17, 0.0)], lens_m, n=24, center=(0.0, y, zc - 0.08),
               cap_bottom=False, cap_top=True)


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    M = ctx.materials
    mat = ctx.mat(spec, fallback="metal")
    lens_m = M.get("plastic", "#f1ebdc")
    rb = max(0.12, min(w, d * 0.5) / 2)
    yp = d / 2 - rb if d > 2 * rb else 0.0
    body = MB()
    body.lathe([(rb, 0.0), (rb, 0.07), (rb * 0.78, 0.12), (rb * 0.55, 0.42), (rb * 0.42, 0.55),
                (rb * 0.42, 0.62), (0.075, 0.68)], mat, n=20, center=(0, yp, 0))
    body.lathe([(0.075, 0.68), (0.05, h - 0.45)], mat, n=16, center=(0, yp, 0), cap_bottom=False)
    body.cyl((0, yp, h * 0.55), 0.068, 0.06, mat, n=16)
    lens = MB()
    heads = int(P.get("heads", 1))
    y_head = -d / 2 + 0.22
    _arm(body, yp, h, y_head, mat, 0.035)
    _head(body, lens, y_head, h, mat, lens_m)
    if heads >= 2:
        y2 = yp + (yp - y_head)
        _arm(body, yp, h, y2, mat, 0.035, sign=-1)
        _head(body, lens, y2, h, mat, lens_m)
    return [body.obj("post", ctx.collection), lens.obj("shade", ctx.collection)]
