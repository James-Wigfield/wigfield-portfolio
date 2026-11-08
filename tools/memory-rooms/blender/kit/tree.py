"""tree: a stylised broadleaf tree: flared trunk, a few branches and a cloud of lumpy foliage puffs.

size = [w, h, d] = canopy spread x total height. color = foliage, accent = bark.
params: puffs (default 7), trunk (fraction of height that is bare trunk, default 0.42).
"""

from __future__ import annotations

import math

from mrgeo import MB, shade


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    rng = ctx.rng
    leaf_hex = spec.get("color") or "#5b7f45"
    bark_hex = spec.get("accent") or "#5a4632"
    M = ctx.materials
    leaf_name = spec.get("material") or "plant"
    leaves = [M.get(leaf_name, shade(leaf_hex, k)) for k in (-0.14, 0.0, 0.12)]
    bark = M.get(spec.get("accentMaterial") or "oak", bark_hex, grain="z")
    bare = float(P.get("trunk", 0.42))
    r0 = max(0.06, min(0.35, min(w, d) * 0.055))
    trunk = MB()
    trunk.lathe([(r0 * 1.45, 0.0), (r0 * 1.1, 0.12), (r0, 0.3), (r0 * 0.82, h * bare),
                 (r0 * 0.55, h * (bare + 0.18))], bark, n=14)
    fork = h * bare
    cz = h - (h - fork) * 0.5 - h * 0.02
    rx, ry, rz = w / 2 * 0.92, d / 2 * 0.92, (h - fork) * 0.55
    for k in range(3):
        a = 2 * math.pi * k / 3 + rng.uniform(-0.4, 0.4)
        tip = (math.cos(a) * rx * 0.45, math.sin(a) * ry * 0.45, cz + rng.uniform(-0.1, 0.25) * rz)
        mid = (tip[0] * 0.45, tip[1] * 0.45, fork + (tip[2] - fork) * 0.55)
        trunk.tube([(0, 0, fork - 0.15), mid, tip], [r0 * 0.6, r0 * 0.42, r0 * 0.2], bark, n=8)
    crown = MB()
    crown.blob((0, 0, cz), (rx * 0.72, ry * 0.72, rz * 0.82), leaves[1], subdiv=3, rough=0.16,
               seed=rng.random() * 10)
    n = int(P.get("puffs", 7))
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.3, 0.3)
        el = rng.uniform(-0.45, 0.65)
        s = rng.uniform(0.8, 1.05)
        pr = (rx * 0.5 * s, ry * 0.5 * s, rz * 0.52 * s)
        px = math.cos(a) * (rx - pr[0] * 1.1) * 0.95
        py = math.sin(a) * (ry - pr[1] * 1.1) * 0.95
        pz = min(cz + el * rz * 0.55, h - pr[2] * 1.2)
        crown.blob((px, py, pz), pr, leaves[k % 3], subdiv=3, rough=0.2, seed=rng.random() * 10)
    return [trunk.obj("trunk", ctx.collection), crown.obj("crown", ctx.collection)]
