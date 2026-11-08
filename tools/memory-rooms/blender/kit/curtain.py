"""curtain: a rod with finials and brackets, and one or two pleated fabric panels hanging from it.
The room-facing side is the FRONT (-y); the brackets reach back to the wall (+y). Panels are pleated
procedurally, then relaxed by a short cloth simulation (top row pinned) and applied; if the sim fails
the procedural pleats are kept. size = [rod width, top of rod to the hem, depth (~0.1)].

params:
  open    0..1     0 = closed (panels meet), 1 = fully gathered at the sides (default 0.3)
  panels  1 | 2    (default 2 when wider than 1 m)
  side    "left" | "right"   where a single panel gathers (default left)
  sim     bool     run the cloth relax (default true)
Materials: main = fabric (default linen); accent = rod / finials / brackets (default metal, dark bronze).
"""

import math

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    rng = ctx.rng
    fabric = U.mat_main(ctx, spec, "linen", "#e9e2d4")
    hw_mat = U.mat_accent(ctx, spec, "metal", "#4a4038")
    opn = U.clamp(float(p.get("open", 0.3)), 0.0, 1.0)
    panels = int(p.get("panels", 2 if w > 1.0 else 1))
    panels = 1 if panels < 2 else 2
    parts = []

    rod_r = U.clamp(0.006 * (1 + w), 0.008, 0.016)
    rod_z = h - rod_r - 0.004
    rod_y = 0.0
    fin = U.clamp(0.022 + 0.005 * w, 0.02, 0.04)
    hb = bmesh.new()
    U.add_tube(hb, [(-w / 2 + fin * 1.6, rod_y, rod_z), (w / 2 - fin * 1.6, rod_y, rod_z)], rod_r, segments=14)
    for sx in (-1, 1):
        cx = sx * (w / 2 - fin * 0.9)
        # finial: a turned ball on a collar, axis along x
        t = bmesh.new()
        U.add_lathe(t, [(0.0, -fin * 0.9), (rod_r * 1.3, -fin * 0.9), (rod_r * 1.3, -fin * 0.6), (fin * 0.55, -fin * 0.3),
                        (fin * 0.62, 0.0), (fin * 0.5, fin * 0.4), (0.0, fin * 0.62)], segments=20)
        import mathutils

        rot = mathutils.Matrix.Rotation(math.radians(90 * sx), 4, "Y")
        bmesh.ops.transform(t, matrix=mathutils.Matrix.Translation((cx, rod_y, rod_z)) @ rot, verts=t.verts[:])
        U.merge_bm(hb, t)
        # bracket back to the wall
        bx = sx * (w / 2 - fin * 2.6)
        U.add_tube(hb, [(bx, rod_y, rod_z), (bx, d / 2 - 0.012, rod_z + 0.0)], 0.005, segments=8)
        U.add_box(hb, (bx - 0.018, d / 2 - 0.006, rod_z - 0.05), (bx + 0.018, d / 2, min(rod_z + 0.012, h - 0.001)), 0.003)
    parts.append(U.obj_from_bm(ctx, "rod", hb, [hw_mat]))

    # panels
    top = rod_z - rod_r - 0.01
    bottom = 0.008
    amp_max = min(d / 2 - 0.012, 0.045)
    spans = []
    if panels == 2:
        half = w / 2 - fin * 1.8
        cover = half * (1.0 - 0.78 * opn)        # width each panel covers
        spans = [(-w / 2 + fin * 1.8, -w / 2 + fin * 1.8 + cover), (w / 2 - fin * 1.8 - cover, w / 2 - fin * 1.8)]
    else:
        full = w - 2 * fin * 1.8
        cover = full * (1.0 - 0.8 * opn)
        if p.get("side", "left") == "right":
            spans = [(w / 2 - fin * 1.8 - cover, w / 2 - fin * 1.8)]
        else:
            spans = [(-w / 2 + fin * 1.8, -w / 2 + fin * 1.8 + cover)]
    flat_w = (w / panels) * 1.15
    for k, (x0, x1) in enumerate(spans):
        ob = _panel(ctx, f"panel_{k + 1}", x0, x1, bottom, top, flat_w, amp_max, rng, fabric)
        if p.get("sim", True):
            _relax(ob, top)
        _finish(ob, (-w / 2, w / 2), (-d / 2, d / 2), bottom)
        parts.append(ob)
    # rings at the panel tops
    rb = bmesh.new()
    for (x0, x1) in spans:
        n = max(3, int((x1 - x0) / 0.1) + 1)
        for i in range(n):
            x = x0 + (x1 - x0) * i / max(n - 1, 1)
            ring = bmesh.new()
            U.add_torus(ring, (0.0, 0.0, 0.0), rod_r + 0.006, 0.0025, segments=14, ring_segments=6)
            import mathutils

            m = mathutils.Matrix.Translation((x, rod_y, rod_z)) @ mathutils.Matrix.Rotation(math.radians(90), 4, "Y")
            bmesh.ops.transform(ring, matrix=m, verts=ring.verts[:])
            U.merge_bm(rb, ring)
    parts.append(U.obj_from_bm(ctx, "rings", rb, [hw_mat]))
    return parts


def _panel(ctx, name, x0, x1, z0, z1, flat_w, amp_max, rng, mat):
    """A pleated panel: columns follow a sine whose amplitude comes from how much fabric is gathered."""
    span = max(x1 - x0, 0.05)
    lam = U.clamp(span / max(2, round(span / 0.11)), 0.06, 0.14)
    ratio = max(1.05, flat_w / span)
    amp = min(amp_max, (lam / math.pi) * math.sqrt(ratio - 1.0) * 0.9)
    amp = max(amp, 0.012)
    nx = max(12, int(span / lam * 10))
    nz = max(8, int((z1 - z0) / 0.06))
    phases = [rng.uniform(-0.25, 0.25) for _ in range(int(span / lam) + 3)]
    bm = bmesh.new()
    grid = []
    pin = []
    for j in range(nz + 1):
        v = j / nz                 # 0 at the hem, 1 at the top
        z = z0 + (z1 - z0) * v
        row = []
        flare = 1.0 + 0.35 * (1 - v) ** 2
        for i in range(nx + 1):
            u = i / nx
            x = x0 + span * u
            ph = 2 * math.pi * (span * u) / lam
            wave = int(span * u / lam)
            a = amp * flare * (1.0 + 0.25 * phases[min(wave, len(phases) - 1)])
            y = a * math.sin(ph + phases[0] + 0.6 * (1 - v) * math.sin(u * 7.0 + phases[1]))
            row.append(bm.verts.new((x, -abs(amp_max) * 0.25 + y, z)))
        grid.append(row)
        if j == nz:
            pin = row
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.verts.index_update()
    pin_idx = [v.index for v in pin]
    ob = U.obj_from_bm(ctx, name, bm, [mat], smooth=True)
    vg = ob.vertex_groups.new(name="pin")
    vg.add(pin_idx, 1.0, "REPLACE")
    ob["mr_cloth"] = "procedural"
    return ob


def _relax(ob, top):
    """Short pinned cloth relax: the pleats settle and the hem swings a little."""
    zmin0 = min(v.co.z for v in ob.data.vertices)

    def sane(me):
        zs = [v.co.z for v in me.vertices]
        return min(zs) > zmin0 - 0.12 and max(zs) < top + 0.05

    if U.cloth_sim(ob, frames=14, pin_group="pin", quality=4, mass=0.15, tension=20.0, shear=8.0, bending=2.0,
                   air=4.0, time_budget=1.5, check=sane):
        ob["mr_cloth"] = "simulated"


def _finish(ob, xr, yr, bottom):
    me = ob.data
    for v in me.vertices:
        v.co.x = max(xr[0] + 0.004, min(xr[1] - 0.004, v.co.x))
        v.co.y = max(yr[0] + 0.006, min(yr[1] - 0.016, v.co.y))
        v.co.z = max(bottom, v.co.z)
    me.update()
    if ob.vertex_groups:
        ob.vertex_groups.clear()
    U.solidify(ob, 0.004, offset=0.0)
    U.set_smooth(ob, True)
