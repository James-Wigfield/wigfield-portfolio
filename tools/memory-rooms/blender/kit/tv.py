"""tv: a flat-screen TV / monitor. Thin panel with a bezel and a back housing; the SCREEN faces the
front (-y). On a pedestal stand, or wall-mounted (the panel then sits at the back of the box).

params:
  stand   bool      pedestal stand at the bottom of the box (default true)
  on      bool      screen glows (an `emit…` material in `screen` colour) instead of black glass-look
  screen  "#hex"    the glow colour when on (default a soft blue-grey)
Materials: main = bezel + housing (default plastic, near-black); accent = stand (default metal, dark).
Typical: 55" 1.23 x 0.78 x 0.25 on its stand, 65" wall-mounted 1.45 x 0.84 x 0.06, monitor 0.6 x 0.45 x 0.2.
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    body = U.mat_main(ctx, spec, "plastic", "#1d1e20")
    stand_mat = U.mat_accent(ctx, spec, "metal", "#3a3b3e")
    stand = bool(p.get("stand", True))
    on = bool(p.get("on", False))
    parts = []

    pt = U.clamp(min(0.045, d * 0.6 if stand else d), 0.012, 0.06)
    sh = w * 9 / 16
    stand_h = 0.0
    if stand:
        stand_h = U.clamp(h - sh, 0.05, 0.3)
        sh = h - stand_h
    else:
        sh = h  # wall-mounted: the panel fills the measured box
    z0 = (h - sh) if not stand else stand_h
    z1 = z0 + sh
    y0 = -pt / 2 if stand else d / 2 - pt
    y1 = y0 + pt

    pb = bmesh.new()
    U.add_box(pb, (-w / 2, y0 + pt * 0.3, z0), (w / 2, y1 - pt * 0.45, z1), 0.004, 3)       # slim panel
    U.add_box(pb, (-w * 0.36, y1 - pt * 0.5, z0 + sh * 0.12), (w * 0.36, y1, z1 - sh * 0.2), 0.012, 3)  # housing
    parts.append(U.obj_from_bm(ctx, "panel", pb, [body]))

    bezel = U.clamp(0.008 * w, 0.004, 0.012)
    if on:
        scr = ctx.materials.get("emissive", p.get("screen") or "#8fa9c4", strength=2.5)
    else:
        scr = ctx.materials.get("plastic", "#08090b", gloss=True)
    sb = bmesh.new()
    yf = y0 + pt * 0.3
    U.add_box(sb, (-w / 2 + bezel, yf - 0.0012, z0 + bezel * 1.4), (w / 2 - bezel, yf + 0.0005, z1 - bezel), 0.0)
    parts.append(U.obj_from_bm(ctx, "screen", sb, [scr]))

    if stand:
        st = bmesh.new()
        bw = U.clamp(w * 0.32, 0.18, 0.5)
        bd = U.clamp(d * 0.95, 0.12, 0.3)
        U.add_box(st, (-bw / 2, -bd / 2, 0.0), (bw / 2, bd / 2, 0.016), 0.006, 3)
        U.add_box(st, (-0.03, -0.012 + pt * 0.3, 0.012), (0.03, 0.012 + pt * 0.3, z0 + sh * 0.25), 0.006, 3)
        parts.append(U.obj_from_bm(ctx, "stand", st, [stand_mat]))
    else:
        mb = bmesh.new()
        U.add_box(mb, (-w * 0.15, d / 2 - 0.006, z0 + sh * 0.3), (w * 0.15, d / 2, z1 - sh * 0.3), 0.002)
        parts.append(U.obj_from_bm(ctx, "mount", mb, [stand_mat]))
    return parts
