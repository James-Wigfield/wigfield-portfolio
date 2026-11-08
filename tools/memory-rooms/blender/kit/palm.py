"""palm: a leaning, ringed palm trunk with a crown of drooping, folded fronds and a few coconuts.

size = [w, h, d] = crown spread x total height. color = fronds, accent = trunk.
params: fronds (default 14), lean (metres the crown sits off-centre, default 0.12 * w), coconuts (default true).
"""

from __future__ import annotations

import math

from mathutils import Vector

from mrgeo import MB, shade, solidify


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    rng = ctx.rng
    frond_hex = spec.get("color") or "#4f7a3a"
    trunk_hex = spec.get("accent") or "#8a6a4a"
    M = ctx.materials
    fronds_m = [M.get(spec.get("material") or "plant", shade(frond_hex, k)) for k in (-0.12, 0.0, 0.1)]
    bark = M.get(spec.get("accentMaterial") or "oak", trunk_hex, grain="z")
    bark_dark = M.get(spec.get("accentMaterial") or "oak", shade(trunk_hex, -0.22), grain="z")
    nut_m = M.get("wool", "#6b4a2c")

    ht = h * 0.86
    lean = float(P.get("lean", w * 0.12))
    la = rng.uniform(0, 2 * math.pi)
    lx, ly = math.cos(la) * lean, math.sin(la) * lean
    r0 = max(0.09, min(0.3, min(w, d) * 0.05))

    def spine(t):
        return Vector((lx * t ** 1.7, ly * t ** 1.7, ht * t))

    nseg = max(10, int(ht / 0.42))
    path, radii, mats = [], [], []
    trunk = MB()
    for i in range(nseg):
        t0, t1 = i / nseg, (i + 1) / nseg
        ra, rb = r0 * (1 - 0.32 * t0), r0 * (1 - 0.32 * t1)
        seg = [spine(t0 + (t1 - t0) * f) for f in (0.0, 0.62, 0.9, 1.0)]
        rs = [ra * 0.93, ra * 1.08, rb * 1.02, rb * 0.93]
        if i == 0:
            seg.insert(0, spine(0) - Vector((0, 0, 0.01)))
            rs.insert(0, r0 * 1.3)
        trunk.tube(seg, rs, bark if i % 2 == 0 else bark_dark, n=12, cap=(i == 0 or i == nseg - 1))
    top = spine(1.0)
    crown = MB()
    crown.blob(tuple(top + Vector((0, 0, 0.05))), (r0 * 1.2, r0 * 1.2, r0 * 1.0), fronds_m[0], subdiv=2,
               rough=0.1)
    if P.get("coconuts", True):
        for k in range(4):
            a = 2 * math.pi * k / 4 + rng.uniform(-0.3, 0.3)
            p = top + Vector((math.cos(a) * r0 * 1.05, math.sin(a) * r0 * 1.05, -r0 * 0.9))
            crown.blob(tuple(p), (r0 * 0.55,) * 3, nut_m, subdiv=2, rough=0.05)

    fronds = MB()
    nf = int(P.get("fronds", 14))
    reach = (w + d) / 4
    for k in range(nf):
        a = 2 * math.pi * k / nf + rng.uniform(-0.2, 0.2)
        dirv = Vector((math.cos(a), math.sin(a), 0.0))
        side = Vector((-dirv.y, dirv.x, 0.0))
        L = reach * rng.uniform(0.85, 1.08)
        lift = rng.uniform(0.25, 0.6)
        droop = rng.uniform(0.75, 1.15)
        n = 14
        rows = []
        for j in range(n + 1):
            t = j / n
            c = top + dirv * (L * t) + Vector((0, 0, L * (lift * t - droop * t * t)))
            hw = L * 0.2 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7
            hw *= 1.0 if j % 2 == 0 else 0.62  # leaflet serration
            fold = Vector((0, 0, -hw * 0.45))
            rows.append([c + side * hw + fold, c + Vector((0, 0, 0.004)), c - side * hw + fold])
        m = fronds_m[k % 3]
        for j in range(n):
            a0, a1 = rows[j], rows[j + 1]
            fronds.poly([a0[0], a1[0], a1[1], a0[1]], m, (0, 0, 1), smooth=True)
            fronds.poly([a0[1], a1[1], a1[2], a0[2]], m, (0, 0, 1), smooth=True)
    fob = fronds.obj("fronds", ctx.collection)
    solidify(fob, 0.012, 0.0)
    return [trunk.obj("trunk", ctx.collection), crown.obj("crown", ctx.collection), fob]
