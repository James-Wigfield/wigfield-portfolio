"""counter: kitchen base cabinets with a worktop. Recessed toe kick, shaker doors and drawers on the
FRONT (-y) in ~60 cm units, bar handles, a slab top overhanging the fronts, optional sink + tap.

params:
  top      material name for the worktop (default: the accentMaterial, else stone)
  topColor "#hex" worktop colour (default: the accent colour, else the material default)
  units    int    cabinet units across (default round(w / 0.6))
  sink     false | 0..1   sink centre as a fraction of the width (default false)
  handles  "bar" | "knob" | "none"   (default bar)
  tap      bool   swan-neck tap behind the sink (rises ~0.3 m above the box; default false)
  stools   int    bar stools tucked in front (only when d >= 0.9: the cabinets shrink to the back
                  0.62 m and the stools stand in the front strip; default 0)
Materials: main = cabinets (default plastic, painted look); accent = worktop; handles are chrome.
Typical: 0.91 high, 0.62 deep (0.6 cabinets + overhang), worktop 3-4 cm.
"""

import math

import bmesh

from kit import _util as U


def build(ctx, spec, bar=False):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "plastic", "#e8e4dc")
    top_name = p.get("top") or spec.get("accentMaterial") or "stone"
    top_col = p.get("topColor") or spec.get("accent")
    top_mat = ctx.materials.get(top_name, top_col)
    chrome = ctx.materials.get("chrome")
    handles = p.get("handles", "bar")
    stools = int(p.get("stools", 0))
    parts = []

    y_back = d / 2
    y_front = -d / 2
    if stools and d >= 0.9:
        y_front = d / 2 - 0.62
    tt = U.clamp(0.04 * h, 0.03, 0.045)
    over = 0.025
    hp = 0.026 if handles != "none" else 0.0
    y_face = y_front + over + hp
    y_car = y_face + 0.019
    kick_h = U.clamp(0.11 * h, 0.07, 0.12)
    zt = h - tt

    cb = bmesh.new()
    U.add_box(cb, (-w / 2, y_car, kick_h), (w / 2, y_back - 0.01, zt), 0.002)
    U.add_box(cb, (-w / 2 + 0.01, y_car + 0.055, 0.0), (w / 2 - 0.01, y_back - 0.02, kick_h + 0.002), 0.002)
    parts.append(U.obj_from_bm(ctx, "cabinets", cb, [main]))
    kick = bmesh.new()
    U.add_box(kick, (-w / 2 + 0.012, y_car + 0.05, 0.0), (w / 2 - 0.012, y_car + 0.056, kick_h), 0.0)
    parts.append(U.obj_from_bm(ctx, "kick", kick, [ctx.materials.get("plastic", U.shade(spec.get("color") or "#e8e4dc", 0.45))]))

    fr = bmesh.new()
    hd = bmesh.new()
    units = int(p.get("units", max(1, round(w / 0.6))))
    gap = 0.004
    z0, z1 = kick_h + 0.004, zt - 0.004
    dh = U.clamp(0.17 * (z1 - z0), 0.12, 0.16)
    sink = p.get("sink", False)
    sink_x = None
    if sink not in (False, None):
        sink_x = -w / 2 + w * U.clamp(float(sink), 0.15, 0.85)
    for u in range(units):
        xa = -w / 2 + w * u / units
        xb = -w / 2 + w * (u + 1) / units
        is_sink = sink_x is not None and xa <= sink_x <= xb
        drawer_stack = (u == 0 and units >= 3 and not is_sink)
        if drawer_stack:
            n = 3
            for i in range(n):
                zb = z1 - (z1 - z0) * i / n
                za = z1 - (z1 - z0) * (i + 1) / n
                U.add_front(fr, xa + gap / 2, xb - gap / 2, za + gap / 2, zb - gap / 2, y_face, y_car - 0.001, "flat")
                U.add_handle(hd, handles, ((xa + xb) / 2, y_face, zb - min(0.05, (zb - za) / 2)),
                             length=U.clamp((xb - xa) * 0.4, 0.08, 0.2))
            continue
        # a false (sink) or real drawer on top, a door (or two) below
        U.add_front(fr, xa + gap / 2, xb - gap / 2, z1 - dh + gap / 2, z1 - gap / 2, y_face, y_car - 0.001, "flat")
        if not is_sink:
            U.add_handle(hd, handles, ((xa + xb) / 2, y_face, z1 - dh / 2), length=U.clamp((xb - xa) * 0.4, 0.08, 0.2))
        ndoor = 2 if (xb - xa) > 0.75 else 1
        for k in range(ndoor):
            da = xa + (xb - xa) * k / ndoor
            db = xa + (xb - xa) * (k + 1) / ndoor
            U.add_front(fr, da + gap / 2, db - gap / 2, z0 + gap / 2, z1 - dh - gap / 2, y_face, y_car - 0.001, "shaker")
            if ndoor == 2:
                hx = db - 0.04 if k == 0 else da + 0.04
            else:
                hx = db - 0.04 if u % 2 == 0 else da + 0.04
            U.add_handle(hd, handles, (hx, y_face, z1 - dh - 0.1), length=U.clamp((z1 - dh - z0) * 0.25, 0.08, 0.16),
                         vertical=True)
    parts.append(U.obj_from_bm(ctx, "fronts", fr, [main]))
    if handles != "none":
        parts.append(U.obj_from_bm(ctx, "handles", hd, [chrome]))
    else:
        hd.free()

    # worktop (split round the sink cut-out)
    tb = bmesh.new()
    ty0, ty1 = y_front, y_back
    if sink_x is None:
        U.add_box(tb, (-w / 2, ty0, zt), (w / 2, ty1, h), 0.004, 3)
    else:
        sw = U.clamp(0.55, 0.3, w * 0.5)
        sd = U.clamp((ty1 - ty0) * 0.62, 0.3, 0.45)
        sx0 = U.clamp(sink_x - sw / 2, -w / 2 + 0.05, w / 2 - 0.05 - sw)
        sx1 = sx0 + sw
        sy0 = ty0 + 0.075
        sy1 = sy0 + sd
        _slab_with_hole(tb, (-w / 2, ty0, zt), (w / 2, ty1, h), (sx0, sy0, sx1, sy1), 0.004)
        # basin: thin stainless walls + floor + drain
        bs = bmesh.new()
        bd = 0.18
        wt = 0.006
        U.add_box(bs, (sx0, sy0, h - bd), (sx1, sy1, h - bd + wt), 0.004)
        U.add_box(bs, (sx0, sy0, h - bd), (sx0 + wt, sy1, h - 0.003), 0.002)
        U.add_box(bs, (sx1 - wt, sy0, h - bd), (sx1, sy1, h - 0.003), 0.002)
        U.add_box(bs, (sx0 + wt, sy0, h - bd), (sx1 - wt, sy0 + wt, h - 0.003), 0.002)
        U.add_box(bs, (sx0 + wt, sy1 - wt, h - bd), (sx1 - wt, sy1, h - 0.003), 0.002)
        U.add_cylinder(bs, ((sx0 + sx1) / 2, (sy0 + sy1) / 2), 0.03, h - bd + wt - 0.001, h - bd + wt + 0.002,
                       segments=16)
        parts.append(U.obj_from_bm(ctx, "sink", bs, [ctx.materials.get("metal", "#c9ccd0")]))
        if p.get("tap", False):
            # swan-neck tap behind the basin (rises ~0.3 m ABOVE the box: opt-in)
            tp = bmesh.new()
            tx, ty = (sx0 + sx1) / 2, min(sy1 + 0.045, ty1 - 0.03)
            U.add_cylinder(tp, (tx, ty), 0.024, h, h + 0.02, segments=16, bevel=0.003)
            U.add_tube(tp, U.fillet([(tx, ty, h + 0.01), (tx, ty, h + 0.3), (tx, ty - 0.17, h + 0.3),
                                     (tx, ty - 0.17, h + 0.22)], 0.07, steps=6), 0.011, segments=12)
            parts.append(U.obj_from_bm(ctx, "tap", tp, [chrome]))
    parts.append(U.obj_from_bm(ctx, "worktop", tb, [top_mat]))

    if stools and d >= 0.9:
        from kit import stool

        n = stools
        sh = U.clamp(h - 0.3, 0.45, 0.8)
        s = 0.38
        for i in range(n):
            x = -w / 2 + w * (i + 0.5) / n
            sub = {"id": f"{spec.get('id', 'counter')}_stool{i}", "kit": "stool", "size": [s, sh, s],
                   "color": spec.get("accent") or "#a8784a", "material": "oak",
                   "accent": "#2b2b2b", "accentMaterial": "metal"}
            yc = -d / 2 + 0.03 + s / 2
            for ob in stool.build(ctx, sub):
                ob.data.transform(__import__("mathutils").Matrix.Translation((x, yc, 0.0)))
                ob.name = f"stool_{i + 1}_{ob.name}"
                parts.append(ob)
    return parts


def _slab_with_hole(bm, lo, hi, hole, bevel):
    """A worktop slab lo..hi with a rectangular through-hole (x0, y0, x1, y1); outer edges bevelled."""
    from mathutils import Matrix, Vector

    lo, hi = Vector(lo), Vector(hi)
    t = bmesh.new()
    size = hi - lo
    bmesh.ops.create_cube(t, size=1.0, matrix=Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((*size, 1.0)))
    x0, y0, x1, y1 = hole
    for co, no in (((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, y0, 0), (0, 1, 0)), ((0, y1, 0), (0, 1, 0))):
        geom = t.verts[:] + t.edges[:] + t.faces[:]
        bmesh.ops.bisect_plane(t, geom=geom, dist=1e-6, plane_co=co, plane_no=no)
    t.normal_update()
    inside = [f for f in t.faces if abs(f.normal.z) > 0.5 and x0 < f.calc_center_median().x < x1
              and y0 < f.calc_center_median().y < y1]
    bmesh.ops.delete(t, geom=inside, context="FACES_ONLY")
    loose = [e for e in t.edges if len(e.link_faces) == 0]
    if loose:
        bmesh.ops.delete(t, geom=loose, context="EDGES")
    boundary = [e for e in t.edges if len(e.link_faces) == 1]
    if boundary:
        bmesh.ops.bridge_loops(t, edges=boundary)
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
    for f in t.faces:
        f.smooth = False
    t.normal_update()

    def in_hole(p, m=0.002):
        return x0 - m <= p.x <= x1 + m and y0 - m <= p.y <= y1 + m

    edges = [e for e in t.edges if len(e.link_faces) == 2
             and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) > 0.8
             and not in_hole((e.verts[0].co + e.verts[1].co) / 2)]
    if bevel > 0 and edges:
        out = bmesh.ops.bevel(t, geom=edges, offset=bevel, segments=3, profile=0.5, affect="EDGES",
                              clamp_overlap=True)
        for f in out["faces"]:
            f.smooth = True
    U.merge_bm(bm, t)
