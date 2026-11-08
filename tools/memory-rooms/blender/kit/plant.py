"""plant: a potted plant. A turned pot (accent), soil, stems and curved leaves (main colour).
Leaves are seeded from the object id, so a rebuild is identical. Round, so it has no real front.

params:
  kind  "leafy" | "tall" | "succulent"
        leafy = broad leaves on arching stems (rubber plant / pothos), tall = upright sword leaves
        (snake plant), succulent = a fleshy rosette. Default: tall when h > 2.6 x width, leafy otherwise
        (succulent when the box is under 0.25 m tall).
  leaves int   leaf count (default by kind / size)
  pot    float pot height as a fraction of h (default by kind)
Materials: main = leaves (default plant); accent = pot (default ceramic, terracotta #b56a45).
"""

import math

import bmesh
from mathutils import Matrix, Vector

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    rng = ctx.rng
    r_box = min(w, d) / 2
    kind = p.get("kind") or ("succulent" if h < 0.25 else ("tall" if h > 2.6 * min(w, d) else "leafy"))
    leaf_mat = U.mat_main(ctx, spec, "plant", "#4f7a4a")
    pot_mat = U.mat_accent(ctx, spec, "ceramic", "#b56a45")
    soil_mat = ctx.materials.ground("dirt", "#3d2c20")
    stem_mat = ctx.materials.get("plant", U.shade(spec.get("color") or "#4f7a4a", 0.75, 0.8))
    parts = []

    # pot
    frac = float(p.get("pot", {"leafy": 0.3, "tall": 0.27, "succulent": 0.5}[kind]))
    ph = U.clamp(frac * h, 0.05, 0.5)
    rp = U.clamp(r_box * {"leafy": 0.62, "tall": 0.78, "succulent": 0.9}[kind], 0.03, 0.35)
    rp = min(rp, ph * 1.4 if kind != "succulent" else rp)
    prof = [(0.0, 0.002), (rp * 0.7, 0.0), (rp * 0.74, 0.006), (rp * 0.9, ph * 0.8), (rp * 0.93, ph * 0.84),
            (rp, ph * 0.86), (rp, ph), (rp * 0.93, ph), (rp * 0.9, ph * 0.92), (rp * 0.88, ph * 0.86), (0.0, ph * 0.84)]
    pb = bmesh.new()
    U.add_lathe(pb, prof, segments=40, sharp_rows=(5, 6, 7))
    parts.append(U.obj_from_bm(ctx, "pot", pb, [pot_mat]))
    zs = ph * 0.885
    sb = bmesh.new()
    U.add_cylinder(sb, (0.0, 0.0), rp * 0.885, ph * 0.84, zs, segments=32)
    for v in sb.verts:  # lumpy soil
        if v.co.z > zs - 1e-4:
            v.co.z += 0.004 * math.sin(v.co.x * 61 + 1.3) * math.cos(v.co.y * 53)
    parts.append(U.obj_from_bm(ctx, "soil", sb, [soil_mat]))

    lb = bmesh.new()
    tb = bmesh.new()
    avail_h = h - zs
    if kind == "tall":
        n = int(p.get("leaves", rng.randint(8, 12)))
        for i in range(n):
            a = 2.39996 * i + rng.uniform(-0.3, 0.3)
            rr = rp * 0.45 * math.sqrt(rng.random())
            base = Vector((rr * math.cos(a), rr * math.sin(a), zs - 0.01))
            tilt = math.radians(rng.uniform(3, 14))
            out = Vector((math.cos(a), math.sin(a), 0.0))
            dirv = (Vector((0, 0, 1)) * math.cos(tilt) + out * math.sin(tilt)).normalized()
            L = avail_h * rng.uniform(0.55, 0.98)
            width = U.clamp(L * 0.11, 0.025, 0.08)
            U.add_leaf(lb, base, dirv, L, width, up=-out, fold=0.18, droop=-0.04, twist=rng.uniform(-0.6, 0.6),
                       segs=(8, 2), tip=1.25)
    elif kind == "succulent":
        n = int(p.get("leaves", 22))
        for i in range(n):
            k = i / n
            a = 2.39996 * i
            elev = math.radians(15 + 60 * k)
            L = (avail_h * 0.6 + rp * 0.7) * (1.0 - 0.55 * k)
            out = Vector((math.cos(a), math.sin(a), 0.0))
            dirv = (out * math.cos(elev) + Vector((0, 0, 1)) * math.sin(elev)).normalized()
            base = Vector((0.0, 0.0, zs + 0.004)) + out * (rp * 0.05)
            U.add_leaf(lb, base, dirv, L, L * 0.55, up=Vector((0, 0, 1)), fold=0.55, droop=-0.12, segs=(5, 2),
                       tip=0.75)
    else:
        # a few arching main stems, broad leaves alternating along each (rubber plant / pothos look)
        stems = int(p.get("stems", int(U.clamp(3 + 3 * h, 3, 7))))
        n = int(p.get("leaves", int(U.clamp(14 + 22 * h, 14, 40))))
        per = max(2, n // stems)
        L0 = U.clamp(min(0.36 * avail_h, r_box * 0.95), 0.05, 0.3)
        for s_i in range(stems):
            a = 2.39996 * s_i + rng.uniform(-0.3, 0.3)
            out = Vector((math.cos(a), math.sin(a), 0.0))
            height = avail_h * rng.uniform(0.55, 0.92) * (1.0 if s_i else 1.05)
            lean = r_box * rng.uniform(0.15, 0.45)
            base = Vector((rng.uniform(-0.25, 0.25) * rp, rng.uniform(-0.25, 0.25) * rp, zs - 0.01))
            top = Vector((0, 0, zs + height)) + out * lean
            mid = base.lerp(top, 0.5) + out * (lean * 0.15)
            path = U.fillet([base, mid, top], 0.1, steps=5)
            U.add_tube(tb, path, U.clamp(0.0025 + 0.004 * h, 0.003, 0.007), segments=6)
            for j in range(per):
                t = 0.3 + 0.7 * (j + 0.5) / per
                node = base.lerp(mid, min(1.0, t * 2)) if t < 0.5 else mid.lerp(top, (t - 0.5) * 2)
                side = a + (1.0 if j % 2 else -1.0) * rng.uniform(0.9, 1.8) + rng.uniform(-0.2, 0.2)
                sv = Vector((math.cos(side), math.sin(side), 0.0))
                elev = math.radians(rng.uniform(-5, 35) + 25 * t)
                dirv = (sv * math.cos(elev) + Vector((0, 0, 1)) * math.sin(elev)).normalized()
                L = L0 * rng.uniform(0.7, 1.0) * (0.75 + 0.35 * (1 - t))
                # short petiole, then the blade
                pet = node + dirv * (L * 0.18)
                U.add_tube(tb, [node, pet], 0.0022, segments=5)
                U.add_leaf(lb, pet, dirv, L, L * 0.56, up=Vector((0, 0, 1)), fold=0.2, droop=0.3,
                           twist=rng.uniform(-0.35, 0.35), segs=(7, 2), tip=0.85)

    # fit the foliage inside the box: scale about the soil centre
    allv = list(lb.verts) + list(tb.verts)
    if allv:
        rmax = max(math.hypot(v.co.x, v.co.y) for v in allv)
        ztop = max(v.co.z for v in allv)
        sxy = min(1.0, (r_box - 0.004) / rmax) if rmax > 0 else 1.0
        sz = min(1.0, (h - 0.002 - zs) / (ztop - zs)) if ztop > zs else 1.0
        m = Matrix.Translation((0, 0, zs)) @ Matrix.Diagonal((sxy, sxy, sz, 1.0)) @ Matrix.Translation((0, 0, -zs))
        for v in allv:
            v.co = m @ v.co
    parts.append(U.obj_from_bm(ctx, "leaves", lb, [leaf_mat]))
    if len(tb.verts):
        parts.append(U.obj_from_bm(ctx, "stems", tb, [stem_mat]))
    else:
        tb.free()
    return parts
