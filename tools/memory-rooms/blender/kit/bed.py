"""bed: frame + headboard, mattress, pillows, a cloth-simulated duvet and a throw.
The FOOT faces the front (-y); the headboard is at +y.

params:
  pillows    int     (default 2 when w >= 1.15, else 1)
  duvet      bool    cloth-draped duvet (default true)
  throw      bool    folded throw across the foot (default true)
  fold       bool    duvet turned down at the head (default true)
  headboard  bool    (default true; its height = the box height h)
  mattress   float   mattress-top height (default 0.55 for tall boxes; h - 0.14 when h < 0.8, so a
                     box that only covers the bedding still fits)
  sim        bool    run the cloth simulation (default true; false = procedural drape)
Materials: main = bedding (default linen): duvet in `color`, sheet + pillows lighter.
           accent = frame + headboard (default oak). A fabric accent (linen/wool/velvet/leather) makes an
           upholstered bed: padded base and headboard on short dark legs.
Typical: single 0.99 x 1.91, double 1.37 x 1.91, queen 1.53 x 2.03, king 1.93 x 2.03; mattress top ~0.55.
"""

import math

import bmesh
from mathutils import Matrix, Vector

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    color = spec.get("color") or "#e8e2d6"
    bed_name = U.main_name(spec, "linen")
    duvet_mat = ctx.materials.get(bed_name, color)
    sheet_mat = ctx.materials.get("linen", U.mix_hex(color, "#f8f6f1", 0.7))
    pillow_mat = ctx.materials.get("linen" if bed_name not in U.FABRICS else bed_name, U.mix_hex(color, "#ffffff", 0.45))
    frame_name = U.accent_name(spec, "oak")
    upholstered = frame_name in U.FABRICS
    frame_mat = U.mat_accent(ctx, spec, "oak", "#9a6f4a")
    rng = ctx.rng
    parts = []

    headboard = bool(p.get("headboard", True))
    hb_t = (0.085 if upholstered else 0.05) if headboard else 0.0
    if h >= 0.8:
        mt = U.clamp(float(p.get("mattress", 0.55)), 0.3, h - 0.2)
    else:
        mt = U.clamp(float(p.get("mattress", h - 0.14)), min(0.22, h * 0.6), h - 0.06)
    m_thick = U.clamp(0.42 * mt, 0.12, 0.24)
    mb = mt - m_thick
    rail_top = mb + U.clamp(0.3 * m_thick, 0.03, 0.06)
    leg_h = U.clamp(0.45 * mb, 0.03, 0.14)
    inset = 0.04

    # ── frame ────────────────────────────────────────────────────────────────
    y_head_in = d / 2 - hb_t  # inner face of the headboard
    if upholstered:
        parts.append(U.cushion(ctx, "frame", (-w / 2, -d / 2, leg_h), (w / 2, y_head_in + 0.02, rail_top), frame_mat,
                               radius=0.03, pillow=0.0, bulge=0.004, cell=0.3, levels=1))
        lg = bmesh.new()
        for sx in (-1, 1):
            for sy in (-1, 1):
                U.add_leg(lg, (sx * (w / 2 - 0.08), sy * (d / 2 - 0.1)), 0.0, leg_h + 0.01, top=0.045, bottom=0.032,
                          shape="round")
        parts.append(U.obj_from_bm(ctx, "legs", lg, [ctx.materials.get("walnut", "#3b2a1f", grain="z")]))
        if headboard:
            parts.append(U.cushion(ctx, "headboard", (-w / 2, y_head_in, leg_h), (w / 2, d / 2, h), frame_mat,
                                   radius=0.04, pillow=0.022, bulge=0.004, up="-y", cell=0.22))
    else:
        fb = bmesh.new()
        vt = bmesh.new()
        rt = 0.03
        lw = 0.06
        # rails: sides + foot, the mattress sinks into them
        for sx in (-1, 1):
            x = sx * (w / 2 - rt / 2)
            U.add_box(fb, (x - rt / 2, -d / 2 + lw - 0.005, leg_h + 0.04), (x + rt / 2, y_head_in, rail_top), 0.004)
        U.add_box(fb, (-w / 2 + lw - 0.005, -d / 2, leg_h + 0.04), (w / 2 - lw + 0.005, -d / 2 + rt, rail_top), 0.004)
        # hidden slat deck under the mattress
        U.add_box(fb, (-w / 2 + rt, -d / 2 + rt, mb - 0.02), (w / 2 - rt, y_head_in, mb), 0.0)
        # foot posts
        for sx in (-1, 1):
            U.add_box(vt, (sx * w / 2 - (lw if sx > 0 else 0), -d / 2, 0.0),
                      (sx * w / 2 + (0 if sx > 0 else lw), -d / 2 + lw, rail_top + 0.025), 0.006, 3)
        if headboard:
            for sx in (-1, 1):
                U.add_box(vt, (sx * w / 2 - (lw if sx > 0 else 0), y_head_in, 0.0),
                          (sx * w / 2 + (0 if sx > 0 else lw), d / 2, h - 0.035), 0.006, 3)
            panel_lo = rail_top - 0.04
            U.add_box(fb, (-w / 2 + lw - 0.004, y_head_in + 0.012, panel_lo), (w / 2 - lw + 0.004, d / 2 - 0.012,
                                                                               h - 0.035), 0.004)
            U.add_box(fb, (-w / 2, y_head_in - 0.008, h - 0.04), (w / 2, d / 2, h), 0.008, 3)
        parts.append(U.obj_from_bm(ctx, "frame", fb, [frame_mat]))
        parts.append(U.obj_from_bm(ctx, "posts", vt, [U.with_grain(ctx, frame_mat)]))
        inset = rt + 0.012

    # ── mattress ─────────────────────────────────────────────────────────────
    mx = w / 2 - inset
    my0 = -d / 2 + inset
    my1 = y_head_in - 0.012
    parts.append(U.cushion(ctx, "mattress", (-mx, my0, mb), (mx, my1, mt), sheet_mat, radius=0.04, pillow=0.008,
                           bulge=0.006, cell=0.25))

    # ── pillows ──────────────────────────────────────────────────────────────
    n = int(p.get("pillows", 2 if w >= 1.15 else 1))
    n = max(0, min(n, 4))
    pil_h = U.clamp(h - mt - 0.003, 0.06, 0.15)
    pd = U.clamp(0.24 * (my1 - my0), 0.3, 0.46)
    py1 = my1 - 0.02
    py0 = py1 - pd
    if n:
        span = 2 * mx - 0.06
        pw = min(0.72, (span - 0.03 * (n - 1)) / n)
        x_start = -(pw * n + 0.03 * (n - 1)) / 2
        for i in range(n):
            xa = x_start + i * (pw + 0.03)
            ob = U.cushion(ctx, f"pillow_{i + 1}", (xa, py0, mt - 0.01), (xa + pw, py1, mt - 0.01 + pil_h), pillow_mat,
                           radius=0.05, pillow=0.4 * pil_h, pillow_bottom=0.12 * pil_h, bulge=0.012, cell=0.22)
            # a touch of randomness so two pillows never match exactly
            ang = math.radians(rng.uniform(-2.5, 2.5))
            c = Vector(((xa + xa + pw) / 2, (py0 + py1) / 2, mt))
            ob.data.transform(Matrix.Translation(c) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Translation(-c))
            parts.append(ob)

    # ── duvet ────────────────────────────────────────────────────────────────
    if p.get("duvet", True):
        y_head = (py0 - 0.1) if n else (my1 - 0.35)
        drop = U.clamp(mt - rail_top - 0.012, 0.06, 0.28)
        fold = U.clamp(0.2 * (y_head - my0), 0.0, 0.3) if p.get("fold", True) else 0.0
        duvet, band = drape_cover(ctx, "duvet", (-mx, my0, mb), (mx, my1, mt), y_head, drop, duvet_mat,
                                  limit=(w / 2 - 0.004, -d / 2 + 0.004), sim=bool(p.get("sim", True)),
                                  thickness=0.03, fold=fold, puff=0.012)
        parts.append(duvet)
        # ── throw across the foot ──
        if p.get("throw", True):
            accent = spec.get("accent")
            if upholstered and accent:
                tcol = U.mix_hex(accent, color, 0.3)
            elif accent and U.accent_name(spec, "") in U.FABRICS:
                tcol = accent
            else:
                tcol = U.shade(color, 0.62, 1.6)
            throw_mat = ctx.materials.get("wool", tcol)
            tw = U.clamp(0.24 * (my1 - my0), 0.28, 0.5)
            yc = my0 + 0.06 + tw / 2
            ztop, xside = band(yc - tw / 2, yc + tw / 2)
            th = 0.02
            xs = min(xside + 0.004 + th / 2, w / 2 - th / 2 - 0.004)
            zc = ztop + th / 2 + 0.001
            hang = U.clamp(drop * 0.8, 0.04, 0.2)
            path = U.fillet([(-xs, yc, zc - hang), (-xs, yc, zc), (xs, yc, zc), (xs, yc, zc - hang)], 0.035, steps=5)
            tb = bmesh.new()
            U.add_sweep(tb, path, U.rounded_rect_profile(tw, th, th * 0.45, 2), up=(-1, 0, 0))
            for v in tb.verts:  # soft, not ruler-straight
                v.co.y += 0.008 * math.sin(v.co.x * 5.1 + 0.7) + 0.004 * math.sin(v.co.x * 13.0)
                v.co.z += 0.003 * math.sin(v.co.x * 9.0 + v.co.y * 4.0)
            parts.append(U.obj_from_bm(ctx, "throw", tb, [throw_mat]))
    return parts


# ── duvet: cloth sim with a procedural fallback ──────────────────────────────

def _drape_point(x, y, mx, my0, z_top, r=0.03):
    """Procedural drape: flat on top, rolling over the side / foot edges and hanging down."""
    ex = max(0.0, abs(x) - mx)
    ey = max(0.0, my0 - y)

    def roll(s):
        if s <= 0:
            return 0.0, 0.0
        arc = math.pi / 2 * r
        if s < arc:
            a = s / r
            return r * math.sin(a), r * (1 - math.cos(a))
        return r, r + (s - arc)

    ox, dzx = roll(ex)
    oy, dzy = roll(ey)
    nx = (mx + ox) * (1 if x >= 0 else -1) if ex > 0 else x
    ny = (my0 - oy) if ey > 0 else y
    return nx, ny, z_top - max(dzx, dzy)


def drape_cover(ctx, name, mlo, mhi, y_head, drop, mat, limit, sim=True, thickness=0.024, spacing=0.042,
                fold=0.0, puff=0.0):
    """A duvet over the mattress box mlo..mhi: covers from `drop` past the foot to y_head, hangs `drop`
    over the sides. Cloth-simulated (~0.5-1 s) when sim, else procedurally draped. `fold` metres of the
    head end are turned back over the top (a turn-down cuff); `puff` lifts the top in soft lumps.
    The result is clamped to |x| <= limit[0], y >= limit[1], solidified and smooth-shaded.
    Returns (object, band) where band(y0, y1) -> (top z, max |x|) of the duvet in that y range
    (used to lay a throw on it). The object gets custom props mr_cloth ("simulated"/"procedural")."""
    mx = mhi[0]
    my0 = mlo[1]
    mt = mhi[2]
    x0, x1 = -mx - drop, mx + drop
    y0, y1 = my0 - drop, y_head + fold
    nx = max(8, int(round((x1 - x0) / spacing)))
    ny = max(6, int(round((y1 - y0) / spacing)))
    rng = ctx.rng
    bm = bmesh.new()
    grid = []
    z0 = mt + 0.02
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            row.append(bm.verts.new((x, y, z0 + rng.uniform(-0.002, 0.002))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    ob = U.obj_from_bm(ctx, name, bm, [mat], smooth=True)

    ok = False
    if sim:
        col = U.box(ctx, name + "_collider", (mlo[0], mlo[1], mlo[2]), (mhi[0], mhi[1], mhi[2] - 0.004),
                    mat, bevel=0.03, segments=3)

        def sane(me):
            for v in me.vertices:
                if v.co.z < mlo[2] - 0.15 or v.co.z > mt + 0.2 or abs(v.co.x) > mx + drop + 0.2:
                    return False
            return True

        ok = U.cloth_sim(ob, frames=24, colliders=[col], quality=4, mass=0.25, tension=12.0, shear=4.0,
                         bending=0.08, air=1.5, distance=0.008, friction=8.0, time_budget=2.2, check=sane)
        data = col.data
        bpy_remove(col)
        if data.users == 0:
            import bpy

            bpy.data.meshes.remove(data)
    if not ok:
        for v in ob.data.vertices:
            x, y, _ = v.co
            px, py, pz = _drape_point(x, y, mx, my0, mt + 0.006)
            v.co = (px, py, pz + 0.004 * math.sin(x * 7.0 + y * 3.0) * (1.0 if abs(x) < mx and y > my0 else 0.3))
        ob.data.update()
        ob["mr_cloth"] = "procedural"
    else:
        ob["mr_cloth"] = "simulated"

    me = ob.data
    if puff > 0:
        ph = [rng.uniform(0.0, 6.283) for _ in range(3)]
        for v in me.vertices:
            x, y, z = v.co
            if abs(x) < mx and y > my0 and z > mt - 0.012:
                edge = min(1.0, (mx - abs(x)) / 0.1) * min(1.0, (y - my0) / 0.1)
                lump = math.sin(x * 6.1 + ph[0]) * math.sin(y * 4.3 + ph[1]) + 0.5 * math.sin(x * 11.0 + y * 7.0 + ph[2])
                v.co.z += puff * edge * (0.55 + 0.45 * lump)
    if fold > 0:
        rf = thickness * 1.25
        for v in me.vertices:
            s = v.co.y - y_head
            if s <= 0:
                continue
            if s < math.pi * rf:
                a = s / rf
                v.co.y = y_head + rf * math.sin(a)
                dz = rf * (1.0 - math.cos(a))
            else:
                v.co.y = y_head - (s - math.pi * rf)
                dz = 2 * rf
            v.co.z += dz
            ex = abs(v.co.x) - mx
            if ex > 0:
                v.co.x += math.copysign(min(1.0, ex / 0.03) * 2 * rf, v.co.x)
    me.update()
    # keep the drape inside the box before giving it thickness
    lx, ly = limit
    for v in me.vertices:
        x, y, z = v.co
        v.co.x = max(-(lx - thickness), min(lx - thickness, x))
        v.co.y = max(ly + thickness, y)
    me.update()
    U.solidify(ob, thickness, offset=1.0)
    for v in ob.data.vertices:
        v.co.x = max(-lx, min(lx, v.co.x))
        v.co.y = max(ly, v.co.y)
    U.set_smooth(ob, True)
    zs = [v.co.z for v in ob.data.vertices]
    ob["mr_top"] = max(zs) if zs else mt

    verts = [tuple(v.co) for v in ob.data.vertices]

    def band(ya, yb):
        inband = [c for c in verts if ya <= c[1] <= yb]
        if not inband:
            return mt + thickness, mx
        top = max(c[2] for c in inband if abs(c[0]) < mx * 0.9) if any(abs(c[0]) < mx * 0.9 for c in inband) else mt
        side = max(abs(c[0]) for c in inband)
        return top, side

    return ob, band


def bpy_remove(ob):
    import bpy

    bpy.data.objects.remove(ob)
