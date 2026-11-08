"""bunk: two-tier bunk bed (hostels!). Four posts, two decks with mattresses, pillows and duvets,
guard rails round the top bunk, end panels and a ladder. The FOOT end faces the front (-y).

params:
  ladder   "right" | "left" | "side-right" | "side-left" | "none"
           right/left = on the foot end (-y), at that side (+x / -x);
           side-* = on that long side, near the foot (default "right")
  pillows  bool   one pillow per bunk (default true)
  duvet    bool   cloth-draped duvets (default true)
  sim      bool   run the cloth sims (default true; ~0.5 s each)
Materials: main = bedding (default linen); accent = frame (default pine; metal gives a hostel bunk).
Typical: 0.99 x 1.65 x 1.98 (twin bunk), 0.9 x 1.6 x 2.0 (hostel).
"""

import bmesh

from kit import _util as U
from kit.bed import drape_cover


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    color = spec.get("color") or "#e3ddd0"
    bed_name = U.main_name(spec, "linen")
    duvet_mat = ctx.materials.get(bed_name, color)
    sheet_mat = ctx.materials.get("linen", U.mix_hex(color, "#f8f6f1", 0.7))
    pillow_mat = ctx.materials.get("linen", U.mix_hex(color, "#ffffff", 0.45))
    frame_mat = U.mat_accent(ctx, spec, "pine", "#c9a273")
    metal = frame_mat.get("mr_material") in U.METALS
    vert = U.with_grain(ctx, frame_mat)
    ladder = p.get("ladder", "right")
    parts = []

    pw = 0.045 if metal else 0.055          # post width
    rt = 0.03 if metal else 0.026           # rail thickness
    # vertical layout
    mt2 = h - U.clamp(0.16 * h, 0.2, 0.3)    # top mattress top (guard rail above it)
    mthick = U.clamp(0.09 * h, 0.1, 0.16)
    mb2 = mt2 - mthick
    mb1 = U.clamp(0.13 * h, 0.12, 0.26)
    mt1 = mb1 + mthick
    rh = 0.1                                 # deck rail height

    fr = bmesh.new()
    vt = bmesh.new()
    corners = [(sx * (w / 2 - pw / 2), sy * (d / 2 - pw / 2)) for sx in (-1, 1) for sy in (-1, 1)]
    for x, y in corners:
        if metal:
            U.add_tube(vt, [(x, y, 0.0), (x, y, h - 0.004)], pw / 2, segments=14)
            U.add_cylinder(vt, (x, y), pw / 2 + 0.003, h - 0.012, h, segments=14, bevel=0.004)
        else:
            U.add_box(vt, (x - pw / 2, y - pw / 2, 0.0), (x + pw / 2, y + pw / 2, h), 0.006, 3)

    def rail_x(z0, z1, y_side, x0=-w / 2 + pw, x1=w / 2 - pw):
        U.add_box(fr, (x0 - 0.002, y_side - rt / 2, z0), (x1 + 0.002, y_side + rt / 2, z1), 0.004)

    def rail_y(z0, z1, x_side, y0=-d / 2 + pw, y1=d / 2 - pw):
        U.add_box(fr, (x_side - rt / 2, y0 - 0.002, z0), (x_side + rt / 2, y1 + 0.002, z1), 0.004)

    side_ladder = ladder in ("side-right", "side-left")
    lsx = 1 if ladder in ("right", "side-right") else -1
    lad_w = U.clamp(0.36, 0.3, w - 2 * pw - 0.1)
    lad_y = (-d / 2 + pw, -d / 2 + pw + lad_w)   # side ladder span along y
    for mb in (mb1, mb2):
        z0, z1 = mb - rh + 0.02, mb + 0.03
        for sx in (-1, 1):
            rail_y(z0, z1, sx * (w / 2 - rt / 2))
        # deck under the mattress
        U.add_box(fr, (-w / 2 + rt, -d / 2 + pw, mb - 0.018), (w / 2 - rt, d / 2 - pw, mb), 0.0)
    # end panels: head (+y) taller, foot (-y)
    for (mb, mt, top) in ((mb1, mt1, mb2 - rh - 0.02), (mb2, mt2, h - 0.004)):
        head_top = min(top, mt + 0.32)
        U.add_box(fr, (-w / 2 + pw - 0.002, d / 2 - pw / 2 - 0.009, mb - rh + 0.02), (w / 2 - pw + 0.002, d / 2 - pw / 2 + 0.009,
                                                                                    head_top), 0.003)
        foot_top = min(top, mt + 0.2)
        x0, x1 = -w / 2 + pw - 0.002, w / 2 - pw + 0.002
        if ladder in ("right", "left") and mb == mb2:
            if lsx > 0:
                x1 = w / 2 - pw - lad_w
            else:
                x0 = -w / 2 + pw + lad_w
        U.add_box(fr, (x0, -d / 2 + pw / 2 - 0.009, mb - rh + 0.02), (x1, -d / 2 + pw / 2 + 0.009, foot_top), 0.003)
    # guard rails round the top bunk
    zg0, zg1 = h - 0.07, h - 0.025
    for sx in (-1, 1):
        x = sx * (w / 2 - rt / 2)
        if side_ladder and sx == lsx:
            rail_y(zg0, zg1, x, y0=lad_y[1] + 0.02)
        else:
            rail_y(zg0, zg1, x)
            rail_y(mt2 + 0.02, mt2 + 0.06, x)
    # ladder
    if ladder != "none":
        rung_r = 0.014
        if side_ladder:
            x = lsx * (w / 2 - pw / 2)
            y_in = lad_y[1]
            U.add_box(vt, (x - pw / 2, y_in - 0.02, 0.0), (x + pw / 2, y_in + 0.02, h - 0.03), 0.005)
            z = 0.28
            while z < mt2 - 0.05:
                U.add_tube(fr, [(x, lad_y[0] - 0.005, z), (x, y_in + 0.005, z)], rung_r, segments=10)
                z += 0.26
        else:
            y = -d / 2 + pw / 2
            x_in = lsx * (w / 2 - pw - lad_w)
            U.add_box(vt, (x_in - 0.02, y - pw / 2, 0.0), (x_in + 0.02, y + pw / 2, mt2 + 0.2), 0.005)
            xa, xb = sorted((x_in, lsx * (w / 2 - pw / 2)))
            z = 0.28
            while z < mt2 - 0.05:
                U.add_tube(fr, [(xa - 0.005, y, z), (xb + 0.005, y, z)], rung_r, segments=10)
                z += 0.26
    parts.append(U.obj_from_bm(ctx, "frame", fr, [frame_mat]))
    parts.append(U.obj_from_bm(ctx, "posts", vt, [vert]))

    # bedding per tier
    mx = w / 2 - rt - 0.008
    my0, my1 = -d / 2 + pw / 2 + 0.012, d / 2 - pw / 2 - 0.012
    for tier, (mb, mt) in enumerate(((mb1, mt1), (mb2, mt2)), start=1):
        parts.append(U.cushion(ctx, f"mattress_{tier}", (-mx, my0, mb), (mx, my1, mt), sheet_mat, radius=0.035,
                               pillow=0.006, bulge=0.004, cell=0.3))
        pd = 0.36
        if p.get("pillows", True):
            pwid = min(0.62, 2 * mx - 0.1)
            parts.append(U.cushion(ctx, f"pillow_{tier}", (-pwid / 2, my1 - 0.02 - pd, mt - 0.008),
                                   (pwid / 2, my1 - 0.02, mt + 0.11), pillow_mat, radius=0.045, pillow=0.045,
                                   pillow_bottom=0.012, bulge=0.01, cell=0.16))
        if p.get("duvet", True):
            drop = U.clamp(mt - (mb + 0.03) - 0.01, 0.05, 0.14)
            duvet, _ = drape_cover(ctx, f"duvet_{tier}", (-mx, my0, mb), (mx, my1, mt), my1 - 0.02 - pd - 0.1, drop,
                                   duvet_mat, limit=(w / 2 - 0.004, -d / 2 + 0.004), sim=bool(p.get("sim", True)),
                                   thickness=0.022, fold=0.18, puff=0.008)
            parts.append(duvet)
    return parts
