"""pine: a conifer of stacked, jagged, drooping tiers on a short trunk (optionally snow-capped).

size = [w, h, d] = spread x height. color = needles, accent = bark.
params: tiers (default by height, 4..7), snow (default true when the ground finish is snow).
"""

from __future__ import annotations

import math

from mrgeo import MB, shade


def _tier(mb, z_base, height, R, mat, rng, n=28, jag=0.1, lift=0.0):
    apex = mb.add_verts([(0, 0, z_base + height)])
    mid = []
    outer = []
    for k in range(n):
        a = 2 * math.pi * (k + rng.uniform(-0.15, 0.15)) / n
        tip = 1.0 + (jag if k % 2 == 0 else -jag * 0.6)
        mid.append((math.cos(a) * R * 0.52, math.sin(a) * R * 0.52, z_base + height * 0.42 + lift))
        outer.append((math.cos(a) * R * tip, math.sin(a) * R * tip,
                      z_base + lift - (R * 0.08 if k % 2 == 0 else 0.0)))
    bm = mb.add_verts(mid)
    bo = mb.add_verts(outer)
    under = mb.add_verts([(0, 0, z_base + height * 0.18 + lift)])
    for k in range(n):
        j = (k + 1) % n
        mb.face((apex, bm + k, bm + j), mat, True)
        mb.face((bm + k, bo + k, bo + j, bm + j), mat, True)
        mb.face((bo + j, bo + k, under), mat, True)


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    rng = ctx.rng
    ndl = spec.get("color") or "#2f5a3d"
    M = ctx.materials
    ground = ((ctx.scene.get("site") or {}).get("ground") or {}).get("finish")
    snow = bool(P.get("snow", ground == "snow"))
    mats = [M.get(spec.get("material") or "plant", shade(ndl, k)) for k in (-0.1, 0.0, 0.08)]
    bark = M.get(spec.get("accentMaterial") or "oak", spec.get("accent") or "#5a4632", grain="z")
    snow_m = M.get("plaster", "#f3f6f8")
    tiers = int(P.get("tiers", max(4, min(7, round(h / 1.4)))))
    R0 = min(w, d) / 2
    r0 = max(0.05, min(0.25, R0 * 0.09))
    trunk = MB()
    trunk.lathe([(r0 * 1.4, 0.0), (r0, 0.15), (r0 * 0.7, h * 0.85)], bark, n=12)
    crown = MB()
    snowmb = MB()
    z0 = h * 0.14
    for i in range(tiers):
        f = i / max(1, tiers - 1)
        R = R0 * (1.0 - 0.78 * f) * rng.uniform(0.94, 1.04)
        zb = z0 + (h * 0.86 - z0 - h * 0.12) * f * 0.92
        ht = min(h - zb, h * (0.34 - 0.08 * f))
        _tier(crown, zb, ht, R, mats[i % 3], rng)
        if snow:
            _tier(snowmb, zb + ht * 0.45, ht * 0.56, R * 0.6, snow_m, rng, n=20, jag=0.14, lift=0.012)
    parts = [trunk.obj("trunk", ctx.collection), crown.obj("crown", ctx.collection, smooth_angle=60)]
    if snow:
        parts.append(snowmb.obj("snow", ctx.collection, smooth_angle=60))
    return parts
