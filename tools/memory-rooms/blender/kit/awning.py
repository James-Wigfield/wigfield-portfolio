"""awning: a striped shop awning with a scalloped valance, side cheeks and a slim metal frame.

size = [w, h, d]: w along the wall, h from the strut feet up to where it meets the wall, d = how far it
projects. The BACK (local +y) is the wall side, the front edge hangs at local -y.
color = main stripe, accent = second stripe (omit for a plain awning).
params: stripe (m, default 0.32), sides (default true), valance (m, default 0.36 * h).
"""

from __future__ import annotations

import math

from mrgeo import MB


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    main = ctx.mat(spec, fallback="linen")
    alt = ctx.materials.get(spec.get("accentMaterial") or spec.get("material") or "linen",
                            spec.get("accent")) if spec.get("accent") else main
    frame_m = ctx.materials.get("metal", "#2e3134", painted=True)
    n = max(1, round(w / float(P.get("stripe", 0.32))))
    sw = w / n
    hv = max(0.08, min(h * 0.9, float(P.get("valance", h * 0.36))))  # valance top, at the front edge
    sc = min(0.07, hv * 0.3)                                        # scallop depth
    th = 0.014
    yb, yf = d / 2, -d / 2
    cloth = MB()
    for i in range(n):
        x0, x1 = -w / 2 + i * sw, -w / 2 + (i + 1) * sw
        m = main if i % 2 == 0 else alt
        cloth.box8([(x0, yf, hv - th), (x1, yf, hv - th), (x1, yb, h - th), (x0, yb, h - th),
                    (x0, yf, hv), (x1, yf, hv), (x1, yb, h), (x0, yb, h)], m)
        pts = [(hv, x0), (hv, x1)]
        steps = 10
        for k in range(steps + 1):
            t = 1 - k / steps
            pts.append((sc * (1 - math.sin(math.pi * t)) + 0.0, x0 + t * sw))
        pts = [(z, x) for z, x in pts]
        cloth.prism(pts, "y", yf - th / 2, yf + th / 2, m)
    if P.get("sides", True):
        for sx in (-1, 1):
            x = sx * w / 2
            cloth.prism([(yb, h), (yf, hv), (yb, hv)], "x", x - th / 2, x + th / 2, main)
    frame = MB()
    frame.tube([(-w / 2, yf + 0.02, hv - 0.03), (w / 2, yf + 0.02, hv - 0.03)], 0.014, frame_m, n=8)
    frame.tube([(-w / 2, yb - 0.02, h - 0.03), (w / 2, yb - 0.02, h - 0.03)], 0.016, frame_m, n=8)
    nst = max(2, round(w / 2.5) + 1)
    for k in range(nst):
        x = -w / 2 + 0.05 + (w - 0.1) * k / (nst - 1)
        frame.tube([(x, yb - 0.01, 0.02), (x, yf + 0.03, hv - 0.04)], 0.012, frame_m, n=8)
        frame.cbox((x, yb - 0.01, 0.02), (0.05, 0.02, 0.07), frame_m)
    return [cloth.obj("cloth", ctx.collection, bevel_w=0.003, segments=1),
            frame.obj("frame", ctx.collection)]
