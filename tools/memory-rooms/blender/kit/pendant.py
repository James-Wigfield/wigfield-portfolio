"""pendant: ceiling light. A canopy at the top of the box (z = h, against the ceiling), a cord and a shade
whose bottom is at z = 0. The shade part is named `shade`. Round, so it has no real front.

params:
  shape  "lantern" | "dome" | "globe" | "drum" | "cone"
         default: paper -> lantern (ribbed paper globe), glass -> globe, metal/brass/chrome -> dome, else drum
Materials: main = shade (default paper); accent = canopy + cap (default white plastic). The cord is dark.
Typical: 0.36 x 0.55 x 0.36 with the base at ceiling height - 0.55.
"""

import math

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    name = U.main_name(spec, "paper")
    shade_mat = U.mat_main(ctx, spec, "paper", "#efe8da")
    cap_mat = U.mat_accent(ctx, spec, "plastic", "#ecebe7")
    cord_mat = ctx.materials.get("plastic", "#262626")
    default = {"paper": "lantern", "glass": "globe", "metal": "dome", "brass": "dome", "chrome": "dome"}.get(name, "drum")
    shape = p.get("shape", default)
    R = min(w, d) / 2 - 0.002
    parts = []

    sb = bmesh.new()
    if shape == "lantern":
        H = min(2 * R * 0.95, h - 0.1)
        n = 84
        ribs = 21
        pts = []
        for i in range(n + 1):
            phi = -math.pi / 2 + math.pi * i / n
            rib = abs(math.cos(ribs * phi)) ** 6          # sharp wire ridges between soft paper bays
            r = R * math.cos(phi) * (0.985 + 0.02 * rib)
            pts.append((max(r, 0.0), H / 2 + (H / 2) * math.sin(phi)))
        bottom_open, top_open = R * 0.32, R * 0.18
        outer = [(r, z) for r, z in pts if r >= bottom_open or z > H / 2]
        outer = [(r, z) for r, z in outer if r >= top_open or z < H / 2]
        prof = [(bottom_open, outer[0][1])] + outer + [(top_open, outer[-1][1])]
        U.add_lathe(sb, prof, segments=32)
        top = prof[-1][1]
        ob = U.obj_from_bm(ctx, "shade", sb, [shade_mat])
        U.solidify(ob, 0.0015, offset=-1.0)
        parts.append(ob)
        cap_r, cap_z = top_open + 0.004, top
    elif shape == "globe":
        H = min(2 * R, h - 0.12)
        n = 24
        prof = []
        for i in range(n + 1):
            phi = -math.pi / 2 + math.pi * 0.86 * i / n
            prof.append((R * math.cos(phi) if i else 0.0, H / 2 + (H / 2) * math.sin(phi)))
        U.add_lathe(sb, prof, segments=40)
        parts.append(U.obj_from_bm(ctx, "shade", sb, [shade_mat]))
        cap_r, cap_z = prof[-1][0] + 0.006, prof[-1][1]
    else:
        H = {"dome": R * 1.05, "drum": R * 1.1, "cone": R * 1.3}.get(shape, R)
        H = min(H, h - 0.1)
        if shape == "dome":
            prof = [(R, 0.0)] + [(R * (0.18 + 0.82 * math.cos(a)), H * math.sin(a))
                                 for a in [math.pi / 2 * k / 10 for k in range(1, 11)]]
            prof[-1] = (R * 0.16, H)
        elif shape == "cone":
            prof = [(R, 0.0), (R * 0.95, 0.05 * H), (R * 0.15, H)]
        else:
            prof = [(R, 0.0), (R, H)]
        U.add_lathe(sb, prof, segments=48, sharp_rows=(0,))
        ob = U.obj_from_bm(ctx, "shade", sb, [shade_mat])
        U.solidify(ob, 0.0025, offset=-1.0)
        parts.append(ob)
        cap_r, cap_z = (prof[-1][0] + 0.005 if shape != "drum" else 0.03), H
        if shape == "drum":
            # spider bracket + bulb cap inside the drum
            br = bmesh.new()
            for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
                U.add_tube(br, [(0.0, 0.0, H * 0.85), (R * 0.99 * math.cos(a), R * 0.99 * math.sin(a), H * 0.85)], 0.002,
                           segments=6)
            parts.append(U.obj_from_bm(ctx, "spider", br, [cap_mat]))

    hw = bmesh.new()
    U.add_cylinder(hw, (0.0, 0.0), max(cap_r, 0.018), cap_z - 0.004, cap_z + 0.03, segments=24, bevel=0.004,
                   r_top=max(cap_r * 0.6, 0.015))
    rc = U.clamp(min(w, d) * 0.2, 0.035, 0.07)
    U.add_cylinder(hw, (0.0, 0.0), rc, h - 0.024, h, segments=32, bevel=0.005)
    parts.append(U.obj_from_bm(ctx, "canopy", hw, [cap_mat]))
    cb = bmesh.new()
    U.add_tube(cb, [(0.0, 0.0, cap_z + 0.025), (0.0, 0.0, h - 0.02)], 0.0028, segments=8)
    parts.append(U.obj_from_bm(ctx, "cord", cb, [cord_mat]))
    return parts
