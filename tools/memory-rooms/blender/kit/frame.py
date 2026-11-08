"""frame: a framed picture / poster / mirror-less print hung on a wall. A mitred moulding swept round
the edge, an optional mat (passe-partout), the art and a backing board. The visible face is the FRONT
(-y); the back (+y) sits flat against the wall. size = [width, height, depth].

params:
  art   "abstract" | "photo" | "map" | "plain"   procedural print (default abstract)
  mat   bool    a white mat round the art (default true when the frame is > 25 cm)
  seed  int     varies the artwork (default: from the object id)
Materials: main = moulding (default oak; metal / plastic give thin modern frames);
           accent = the art's key colour (the print itself is a paper material).
Typical: poster 0.5 x 0.7 x 0.025, print 0.3 x 0.4 x 0.02.
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h_box, depth = U.dims(spec)
    p = U.P(spec)
    # a frame lies in the x-z plane: width w, height h, depth d (toward the wall)
    W, H, D = w, h_box, depth
    rng = ctx.rng
    mould_mat = U.mat_main(ctx, spec, "oak", "#2d3340")
    thin = U.main_name(spec, "oak") in U.METALS or U.main_name(spec, "oak") == "plastic"
    art = p.get("art", "abstract")
    use_mat = bool(p.get("mat", min(W, H) > 0.25 and art != "map"))
    seed = int(p.get("seed", rng.randint(0, 999)))
    mw = U.clamp((0.03 if thin else 0.065) * min(W, H), 0.008, 0.07)
    parts = []

    # moulding: closed rectangle path (CCW seen from the front), profile u = outward, v = toward the front
    hw, hh = W / 2 - mw / 2, H / 2 - mw / 2
    zc = H / 2
    path = [(-hw, 0.0, zc - hh), (hw, 0.0, zc - hh), (hw, 0.0, zc + hh), (-hw, 0.0, zc + hh)]
    a = mw / 2
    b = D / 2
    if thin:
        prof = [(a, -b), (a, b - 0.001), (a - 0.001, b), (-a + 0.001, b), (-a, b - 0.001), (-a, -b)]
    else:
        prof = [(a, -b), (a, b * 0.55), (a * 0.85, b * 0.92), (a * 0.55, b), (a * 0.2, b * 0.9), (-a * 0.35, b * 0.55),
                (-a * 0.7, b * 0.5), (-a, b * 0.3), (-a, -b)]
    mb = bmesh.new()
    U.add_sweep(mb, path, prof, closed=True, up=(0, -1, 0), smooth=False)
    parts.append(U.obj_from_bm(ctx, "moulding", mb, [mould_mat]))

    # inner window
    ix, iz0, iz1 = W / 2 - mw + 0.002, mw - 0.002, H - mw + 0.002
    y_art = -D / 2 + D * 0.45
    bb = bmesh.new()
    U.add_box(bb, (-ix, D / 2 - 0.003, iz0), (ix, D / 2, iz1), 0.0)
    parts.append(U.obj_from_bm(ctx, "backing", bb, [ctx.materials.get("paper", "#a08a6a")]))
    if use_mat:
        border = U.clamp(0.11 * min(W, H), 0.02, 0.12)
        mat_paper = ctx.materials.get("paper", "#f2eee6")
        mt = bmesh.new()
        y0, y1 = y_art - 0.0035, y_art - 0.0005
        wx0, wx1, wz0, wz1 = -ix + border, ix - border, iz0 + border, iz1 - border * 1.1
        U.add_box(mt, (-ix, y0, iz0), (ix, y1, wz0), 0.0008)
        U.add_box(mt, (-ix, y0, wz1), (ix, y1, iz1), 0.0008)
        U.add_box(mt, (-ix, y0, wz0 - 0.0005), (wx0, y1, wz1 + 0.0005), 0.0008)
        U.add_box(mt, (wx1, y0, wz0 - 0.0005), (ix, y1, wz1 + 0.0005), 0.0008)
        parts.append(U.obj_from_bm(ctx, "mat", mt, [mat_paper]))
        ax0, ax1, az0, az1 = wx0 - 0.004, wx1 + 0.004, wz0 - 0.004, wz1 + 0.004
    else:
        ax0, ax1, az0, az1 = -ix, ix, iz0, iz1
    if art == "plain":
        art_mat = ctx.materials.get("paper", spec.get("accent") or "#d9744a")
    else:
        art_mat = ctx.materials.get("paper", spec.get("accent") or "#d9744a", art=art, seed=seed)
    ab = bmesh.new()
    U.add_box(ab, (ax0, y_art, az0), (ax1, y_art + 0.0015, az1), 0.0)
    parts.append(U.obj_from_bm(ctx, "art", ab, [art_mat]))
    return parts
