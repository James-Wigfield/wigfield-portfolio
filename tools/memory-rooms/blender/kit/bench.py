"""bench: a park bench: two cast-metal side frames with armrests, timber seat slats and a raked back.

size = [w, h, d]; the sitter faces the FRONT (local -y). color/material = slats, accent = frames.
params: arms (default true), back (default true).
"""

from __future__ import annotations

import math

from mathutils import Matrix

from mrgeo import MB


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    slat_m = ctx.mat(spec, fallback="oak")
    frame_m = ctx.materials.get(spec.get("accentMaterial") or "metal", spec.get("accent") or "#2f3236",
                                painted=True)
    back = bool(P.get("back", True)) and h > 0.6
    sh = min(0.46, h * (0.54 if back else 0.9))
    yf, yb = -d / 2, d / 2
    frames = MB()
    rt = 0.022
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.1)
        frames.tube([(x, yf + 0.07, 0.0), (x, yf + 0.09, sh - 0.03)], rt, frame_m, n=10)
        if back:
            frames.tube([(x, yb - 0.06, 0.0), (x, yb - 0.14, sh - 0.03), (x, yb - 0.04, h - 0.02)], rt,
                        frame_m, n=10)
        else:
            frames.tube([(x, yb - 0.07, 0.0), (x, yb - 0.09, sh - 0.03)], rt, frame_m, n=10)
        frames.tube([(x, yf + 0.04, sh - 0.035), (x, yb - 0.1, sh - 0.035)], rt * 0.9, frame_m, n=10)
        frames.cbox((x, yf + 0.07, 0.012), (0.07, 0.09, 0.024), frame_m)
        frames.cbox((x, yb - 0.06, 0.012), (0.07, 0.09, 0.024), frame_m)
        if P.get("arms", True):
            za = sh + 0.22
            frames.tube([(x, yf + 0.09, sh - 0.03), (x, yf + 0.07, za - 0.04), (x, yf + 0.12, za),
                         (x, yb - 0.17, za + 0.01)], rt * 0.85, frame_m, n=10)
    slats = MB()
    ns = 4
    depth = d - 0.12
    sw = (depth - 0.012 * (ns - 1)) / ns
    for i in range(ns):
        y0 = yf + 0.02 + i * (sw + 0.012)
        slats.box((-w / 2, y0, sh - 0.01), (w / 2, y0 + sw, sh + 0.025), slat_m)
    if back:
        tilt = math.radians(14)
        nb = 3
        bh = (h - sh - 0.1) / nb
        for i in range(nb):
            zc = sh + 0.1 + (i + 0.5) * bh
            yc = yb - 0.1 + (zc - sh) * math.tan(tilt) * 0.6
            m = Matrix.Translation((0, yc, zc)) @ Matrix.Rotation(-tilt, 4, "X")
            slats.tbox(m, (w, 0.03, bh * 0.82), slat_m)
    return [frames.obj("frames", ctx.collection), slats.obj("slats", ctx.collection, bevel_w=0.006, segments=2)]
