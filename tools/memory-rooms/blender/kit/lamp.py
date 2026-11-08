"""lamp: table lamp (h <= 1 m) or floor lamp (h > 1 m): a turned base, a stem and a thin-walled shade
open at top and bottom. The shade part is named `shade` (the pipeline may give it an emissive look; the
scene's `lights` entry with `object` = this id places the bulb). Round, so it has no real front.

params:
  shade  "drum" | "empire" | "cone"      (default empire for table lamps, drum for floor lamps)
  base   "vase" | "stick" | "ginger"     table-lamp base (default vase)
Materials: main = shade (default linen); accent = base / pole (default ceramic for table lamps, metal for
floor lamps). The stem / socket is brass unless the accent is a metal.
Typical: table lamp 0.3 x 0.5 x 0.3, floor lamp 0.45 x 1.6 x 0.45.
"""

import math

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    floor = h > 1.0
    shade_mat = U.mat_main(ctx, spec, "linen", "#f2e6c8")
    base_mat = U.mat_accent(ctx, spec, "metal" if floor else "ceramic", "#2b2b2b" if floor else "#e9e4da")
    stem_mat = base_mat if base_mat.get("mr_material") in U.METALS else ctx.materials.get("brass")
    shape = p.get("shade", "drum" if floor else "empire")
    r = min(w, d) / 2 - 0.002
    parts = []

    # shade
    sh = U.clamp((0.22 if floor else 0.42) * h, 0.1, 0.42)
    z1 = h - 0.012
    z0 = z1 - sh
    rb = r
    rt = r * {"empire": 0.6, "cone": 0.4, "drum": 0.94}.get(shape, 0.94)
    t = 0.003
    prof = [(rb, z0), (rb * 0.5 + rt * 0.5 + 0.002, (z0 + z1) / 2), (rt, z1), (rt - t, z1), (rb * 0.5 + rt * 0.5 - t + 0.002, (z0 + z1) / 2),
            (rb - t, z0), (rb, z0)]
    sb = bmesh.new()
    U.add_lathe(sb, prof, segments=48, sharp_rows=(0, 2, 3, 5))
    bmesh.ops.remove_doubles(sb, verts=sb.verts[:], dist=1e-5)
    # rolled trim bands at the rims
    U.add_torus(sb, (0.0, 0.0, z0 + 0.002), rb - t / 2, 0.003, segments=48, ring_segments=6)
    U.add_torus(sb, (0.0, 0.0, z1 - 0.002), rt - t / 2, 0.003, segments=48, ring_segments=6)
    parts.append(U.obj_from_bm(ctx, "shade", sb, [shade_mat]))

    bb = bmesh.new()
    st = bmesh.new()
    sock_z = z0 + sh * 0.35
    if floor:
        rd = U.clamp(r * 0.62, 0.1, 0.2)
        U.add_lathe(bb, [(0.0, 0.0), (rd, 0.0), (rd, 0.012), (rd * 0.9, 0.026), (rd * 0.3, 0.032), (0.0, 0.034)],
                    segments=48, sharp_rows=(1,))
        U.add_tube(st, [(0.0, 0.0, 0.03), (0.0, 0.0, sock_z)], 0.011, segments=14)
        U.add_cylinder(st, (0.0, 0.0), 0.016, sock_z - 0.01, sock_z + 0.06, segments=16, bevel=0.003)
    else:
        kind = p.get("base", "vase")
        vh = U.clamp(z0 + sh * 0.1, 0.06, h * 0.6)
        rv = U.clamp(r * 0.5, 0.035, 0.12)
        if kind == "stick":
            prof = [(0.0, 0.0), (rv, 0.0), (rv, 0.014), (rv * 0.85, 0.024), (0.016, 0.03), (0.012, vh * 0.5),
                    (0.016, vh), (0.0, vh)]
        elif kind == "ginger":
            prof = [(0.0, 0.0), (rv * 0.62, 0.0), (rv * 0.66, 0.006), (rv * 0.98, vh * 0.32), (rv, vh * 0.55),
                    (rv * 0.86, vh * 0.78), (rv * 0.5, vh * 0.92), (rv * 0.42, vh * 0.94), (rv * 0.42, vh),
                    (0.0, vh)]
        else:  # vase
            prof = [(0.0, 0.0), (rv * 0.55, 0.0), (rv * 0.58, 0.008), (rv * 0.9, vh * 0.22), (rv, vh * 0.45),
                    (rv * 0.82, vh * 0.7), (rv * 0.36, vh * 0.9), (rv * 0.3, vh * 0.96), (rv * 0.36, vh),
                    (0.0, vh)]
        U.add_lathe(bb, prof, segments=40)
        U.add_tube(st, [(0.0, 0.0, vh - 0.004), (0.0, 0.0, sock_z)], 0.0065, segments=12)
        U.add_cylinder(st, (0.0, 0.0), 0.014, sock_z - 0.008, sock_z + 0.045, segments=16, bevel=0.002)
        # harp up to the finial on top of the shade
        harp_r = U.clamp(rt * 0.55, 0.03, 0.08)
        for a in (0.0, math.pi):
            U.add_tube(st, [(0.0, 0.0, sock_z + 0.02), (harp_r * math.cos(a), harp_r * math.sin(a), sock_z + 0.03),
                            (harp_r * math.cos(a), harp_r * math.sin(a), z1 - 0.03), (0.0, 0.0, z1 - 0.004)], 0.0022,
                       segments=8, fillet_r=0.02)
        U.add_lathe(st, [(0.0, z1 - 0.006), (0.006, z1 - 0.006), (0.009, z1 - 0.001), (0.007, h - 0.003),
                         (0.0, h)], segments=16)
    parts.append(U.obj_from_bm(ctx, "base", bb, [base_mat]))
    parts.append(U.obj_from_bm(ctx, "stem", st, [stem_mat]))
    return parts
