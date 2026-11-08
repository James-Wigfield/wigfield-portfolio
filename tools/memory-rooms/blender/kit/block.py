"""block: a building massing with real window reveals, a recessed door, plinth, cornice and a roof.

size = [w, h, d]: footprint w x d, total height h (to the top of the parapet coping or the ridge).
Front = local -y ("south" at rotY 0). Faces in params are named in the object's own frame:
south = front (-y), north = back, east = +x, west = -x.

params (all optional):
    roof      "flat" (default) | "gable" | "hip" | "shed"
    parapet   metres of parapet above a flat roof (default 0.4 for flat, 0 otherwise)
    pitch     roof pitch in degrees for gable / hip / shed (default 30 / 30 / 12)
    roofColor '#rrggbb' for pitched roofs (default dark terracotta)
    storeys   number of floors (default: height / 3.4)
    windows   { rows, cols, faces: [...], width, height, sill }  (rows default = storeys, cols by width,
              faces default ["south"]; width/height/sill in metres override the automatic sizes)
    door      { face, offset (m from the face's left end as seen from outside), width, height }
    lit       true -> warm glowing interiors behind the glass (default: mood golden / evening / night)
    rooftop   false -> no AC units / vents on a flat roof
"""

from __future__ import annotations

import math

from mrgeo import MB, flat_emit, mix, shade

FACES = ("south", "north", "east", "west")


class Face:
    """Facade frame: u along the face from its left end (seen from outside), z up, k into the building."""

    def __init__(self, name, w, d):
        self.name = name
        self.L = w if name in ("south", "north") else d
        self.w, self.d = w, d

    def P(self, u, z, k=0.0):
        w, d = self.w, self.d
        if self.name == "south":
            return (-w / 2 + u, -d / 2 + k, z)
        if self.name == "north":
            return (w / 2 - u, d / 2 - k, z)
        if self.name == "east":
            return (w / 2 - k, -d / 2 + u, z)
        return (-w / 2 + k, d / 2 - u, z)

    def N(self, du, dz, dk):
        if self.name == "south":
            return (du, dk, dz)
        if self.name == "north":
            return (-du, -dk, dz)
        if self.name == "east":
            return (-dk, du, dz)
        return (dk, -du, dz)

    def box(self, mb, u0, u1, z0, z1, k0, k1, mat):
        a, b = self.P(u0, z0, k0), self.P(u1, z1, k1)
        mb.box(tuple(min(p, q) for p, q in zip(a, b)), tuple(max(p, q) for p, q in zip(a, b)), mat)


def _facade(mb, F: Face, H, holes, wall_m, reveal_m, inner_m, back_m):
    """Outer skin of one face up to height H with rectangular holes; each hole is a tunnel whose
    first `rv` metres are wall reveal and the rest interior, closed by a back face."""
    L = F.L
    U = sorted({0.0, L, *[x for o in holes for x in (o["u0"], o["u1"])]})
    V = sorted({0.0, H, *[x for o in holes for x in (o["z0"], o["z1"])]})

    def hole_at(i, j):
        if i < 0 or j < 0 or i >= len(U) - 1 or j >= len(V) - 1:
            return None
        uc, vc = (U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2
        for o in holes:
            if o["u0"] < uc < o["u1"] and o["z0"] < vc < o["z1"]:
                return o
        return "solid"

    out_n = F.N(0, 0, -1)
    for i in range(len(U) - 1):
        for j in range(len(V) - 1):
            if hole_at(i, j) == "solid":
                u0, u1, z0, z1 = U[i], U[i + 1], V[j], V[j + 1]
                mb.poly([F.P(u0, z0), F.P(u1, z0), F.P(u1, z1), F.P(u0, z1)], wall_m, out_n)

    def tunnel(p0, p1, normal, o):
        rv, depth = o["rv"], o["depth"]
        mb.poly([F.P(*p0, 0), F.P(*p1, 0), F.P(*p1, rv), F.P(*p0, rv)], reveal_m, normal)
        mb.poly([F.P(*p0, rv), F.P(*p1, rv), F.P(*p1, depth), F.P(*p0, depth)], inner_m, normal)

    for i in range(len(U)):
        for j in range(len(V) - 1):
            a, b = hole_at(i - 1, j), hole_at(i, j)
            if a == "solid" and isinstance(b, dict):
                tunnel((U[i], V[j]), (U[i], V[j + 1]), F.N(1, 0, 0), b)
            elif b == "solid" and isinstance(a, dict):
                tunnel((U[i], V[j]), (U[i], V[j + 1]), F.N(-1, 0, 0), a)
    for j in range(len(V)):
        for i in range(len(U) - 1):
            a, b = hole_at(i, j - 1), hole_at(i, j)
            if a == "solid" and isinstance(b, dict):
                tunnel((U[i], V[j]), (U[i + 1], V[j]), F.N(0, 1, 0), b)
            elif b == "solid" and isinstance(a, dict):
                tunnel((U[i], V[j]), (U[i + 1], V[j]), F.N(0, -1, 0), a)
            elif j == 0 and isinstance(b, dict):  # door threshold: floor of the recess
                tunnel((U[i], 0.0), (U[i + 1], 0.0), F.N(0, 1, 0), b)
    for o in holes:
        k = o["depth"]
        mb.poly([F.P(o["u0"], o["z0"], k), F.P(o["u1"], o["z0"], k), F.P(o["u1"], o["z1"], k),
                 F.P(o["u0"], o["z1"], k)], back_m, out_n)


def _window_unit(mb, glass, F: Face, o, frame_m, sill_m, band_m):
    u0, u1, z0, z1, rv = o["u0"], o["u1"], o["z0"], o["z1"], o["rv"]
    width, height = u1 - u0, z1 - z0
    fw = max(0.045, min(0.07, min(width, height) * 0.05))
    k0, k1 = rv - 0.035, rv + 0.035
    F.box(mb, u0, u0 + fw, z0, z1, k0, k1, frame_m)
    F.box(mb, u1 - fw, u1, z0, z1, k0, k1, frame_m)
    F.box(mb, u0 + fw, u1 - fw, z0, z0 + fw, k0, k1, frame_m)
    F.box(mb, u0 + fw, u1 - fw, z1 - fw, z1, k0, k1, frame_m)
    panes = max(1, round(width / 0.9))
    for p in range(1, panes):
        uc = u0 + fw + (width - 2 * fw) * p / panes
        F.box(mb, uc - fw * 0.35, uc + fw * 0.35, z0 + fw, z1 - fw, k0 + 0.01, k1 - 0.01, frame_m)
    if height > 1.5:
        zc = z1 - height * 0.26
        F.box(mb, u0 + fw, u1 - fw, zc - fw * 0.35, zc + fw * 0.35, k0 + 0.01, k1 - 0.01, frame_m)
    F.box(glass, u0 + fw * 0.5, u1 - fw * 0.5, z0 + fw * 0.5, z1 - fw * 0.5, rv - 0.004, rv + 0.004, None)
    # projecting sill and a slim lintel
    F.box(mb, u0 - 0.07, u1 + 0.07, z0 - 0.07, z0, -0.08, rv - 0.035, sill_m)
    F.box(mb, u0 - 0.07, u1 + 0.07, z1, z1 + 0.11, -0.025, 0.0, band_m)


def _door_unit(mb, glass, F: Face, o, frame_m, metal_m, step_m):
    u0, u1, z1, rv = o["u0"], o["u1"], o["z1"], o["rv"]
    width = u1 - u0
    fw = 0.07
    k0, k1 = rv - 0.03, rv + 0.03
    step = 0.1
    F.box(mb, u0 - 0.18, u1 + 0.18, 0.0, step, -0.32, rv, step_m)
    F.box(mb, u0, u0 + fw, step, z1, k0, k1, frame_m)
    F.box(mb, u1 - fw, u1, step, z1, k0, k1, frame_m)
    F.box(mb, u0, u1, z1 - fw, z1, k0, k1, frame_m)
    leaves = 2 if width > 1.45 else 1
    lw = (width - 2 * fw) / leaves
    top = z1 - fw
    transom = top - 0.32 if (top - step) > 2.3 else None
    leaf_top = transom if transom else top
    if transom:
        F.box(mb, u0 + fw, u1 - fw, transom - 0.03, transom + 0.03, k0, k1, frame_m)
        F.box(glass, u0 + fw, u1 - fw, transom, top, rv - 0.004, rv + 0.004, None)
    for i in range(leaves):
        a = u0 + fw + i * lw + 0.004
        b = a + lw - 0.008
        st = min(0.1, lw * 0.14)
        kk0, kk1 = rv - 0.022, rv + 0.022
        F.box(mb, a, a + st, step + 0.004, leaf_top, kk0, kk1, frame_m)
        F.box(mb, b - st, b, step + 0.004, leaf_top, kk0, kk1, frame_m)
        F.box(mb, a + st, b - st, leaf_top - 0.1, leaf_top, kk0, kk1, frame_m)
        F.box(mb, a + st, b - st, step + 0.004, step + 0.32, kk0, kk1, frame_m)
        F.box(glass, a + st, b - st, step + 0.32, leaf_top - 0.1, rv - 0.004, rv + 0.004, None)
        # push bar on the outside, nearer the meeting stile
        hu0, hu1 = (b - st - 0.35, b - st - 0.05) if (leaves == 1 or i == 0) else (a + st + 0.05, a + st + 0.35)
        F.box(mb, hu0, hu1, 1.0, 1.035, kk0 - 0.05, kk0 - 0.03, metal_m)
        F.box(mb, hu0, hu0 + 0.03, 1.0, 1.035, kk0 - 0.03, kk0, metal_m)
        F.box(mb, hu1 - 0.03, hu1, 1.0, 1.035, kk0 - 0.03, kk0, metal_m)


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    mood = ((ctx.scene.get("style") or {}).get("mood")) or "day"
    roof = P.get("roof", "flat")
    if roof not in ("flat", "gable", "hip", "shed"):
        roof = "flat"
    lit = bool(P.get("lit", mood in ("golden", "evening", "night")))
    col = spec.get("color") or "#e8e2d6"
    acc = spec.get("accent") or "#3d4a52"
    M = ctx.materials
    wall_m = ctx.mat(spec, fallback="plaster")
    reveal_m = M.get(spec.get("material") or "plaster", shade(col, -0.06))
    band_m = M.get(spec.get("material") or "plaster", shade(col, 0.35))
    frame_m = M.get(spec.get("accentMaterial") or "metal", acc, painted=True)
    plinth_m = M.get("concrete", mix(col, "#5f5a54", 0.65))
    sill_m = M.get("stone", mix(col, "#d8d2c8", 0.6))
    metal_m = M.get("chrome", "#d6d8da")
    glass_m = M.get("glass", "#cfe2e8", thin=True)
    inner_m = M.get("plaster", "#8c8076" if lit else "#4e4945")
    back_m = flat_emit("emit_window_warm", "#ffd59a", 2.2) if lit else M.get("plaster", "#3e3a37")
    roof_hex = P.get("roofColor") or "#7b4a3c"

    # vertical layout
    parapet = float(P.get("parapet", 0.4 if roof == "flat" else 0.0))
    coping = 0.07
    tv = 0.14  # pitched roof slab vertical thickness
    if roof == "flat":
        z_roof = max(1.0, h - coping - parapet)
        eave = h - coping
    elif roof == "shed":
        pitch = math.radians(float(P.get("pitch", 12)))
        rise = min(h * 0.35, d * math.tan(pitch))
        eave = h - tv - rise
        z_roof = eave
    else:
        pitch = math.radians(float(P.get("pitch", 30)))
        span = min(w, d)
        rise = min(h * 0.42, span / 2 * math.tan(pitch))
        eave = h - tv - rise
        z_roof = eave
    storeys = int(P.get("storeys") or max(1, round(z_roof / 3.4)))
    plinth_h = min(0.45, z_roof * 0.08)

    # holes per face
    win = P.get("windows") or {}
    rows = int(win.get("rows", storeys))
    faces_w = [f for f in win.get("faces", ["south"]) if f in FACES]
    door = P.get("door")
    holes = {f: [] for f in FACES}
    door_face = None
    if door is not None:
        door_face = door.get("face", "south") if door.get("face") in FACES else "south"
        F = Face(door_face, w, d)
        dw = float(door.get("width", 1.1))
        dh = min(float(door.get("height", 2.2)), z_roof - 0.3)
        u0 = max(0.25, min(F.L - dw - 0.25, float(door.get("offset", (F.L - dw) / 2))))
        holes[door_face].append({"u0": u0, "u1": u0 + dw, "z0": 0.0, "z1": dh, "rv": 0.32, "depth": 0.75,
                                 "kind": "door"})
    for f in faces_w:
        F = Face(f, w, d)
        cols = int(win.get("cols", max(1, round(F.L / 3.0))))
        if cols < 1 or rows < 1:
            continue
        pitch_u = (F.L - 1.0) / cols
        ww = float(win.get("width", max(0.5, min(2.2, pitch_u * 0.58))))
        ww = min(ww, pitch_u - 0.2)
        rh = z_roof / rows
        wh = float(win.get("height", max(0.6, min(2.2, rh * 0.52))))
        wh = min(wh, rh - 0.45)
        for r in range(rows):
            base = r * rh
            z0 = base + rh * 0.27
            if r == 0:
                z0 = float(win.get("sill", max(z0, plinth_h + 0.25)))
            z1 = min(z0 + wh, base + rh - 0.2, z_roof - 0.25)
            if z1 - z0 < 0.3:
                continue
            for c in range(cols):
                uc = 0.5 + pitch_u * (c + 0.5)
                u0, u1 = uc - ww / 2, uc + ww / 2
                clash = any(o["kind"] == "door" and u0 < o["u1"] + 0.25 and u1 > o["u0"] - 0.25 and z0 < o["z1"]
                            for o in holes[f])
                if not clash:
                    holes[f].append({"u0": u0, "u1": u1, "z0": z0, "z1": z1, "rv": 0.14, "depth": 0.6,
                                     "kind": "window"})

    body = MB()
    detail = MB()
    glass = MB()
    for f in FACES:
        F = Face(f, w, d)
        _facade(body, F, eave, holes[f], wall_m, reveal_m, inner_m, back_m)
        for o in holes[f]:
            if o["kind"] == "window":
                _window_unit(detail, glass, F, o, frame_m, sill_m, band_m)
            else:
                _door_unit(detail, glass, F, o, frame_m, metal_m, sill_m)
        # plinth band, broken at doors
        cuts = [(-0.045, F.L + 0.045)]
        for o in holes[f]:
            if o["kind"] == "door":
                nxt = []
                for a, b in cuts:
                    if o["u0"] - 0.18 > a:
                        nxt.append((a, o["u0"] - 0.18))
                    if o["u1"] + 0.18 < b:
                        nxt.append((o["u1"] + 0.18, b))
                cuts = nxt
        for a, b in cuts:
            F.box(detail, a, b, 0.0, plinth_h, -0.045, 0.0, plinth_m)
        # storey bands
        for s in range(1, storeys):
            zb = z_roof * s / storeys
            F.box(detail, -0.035, F.L + 0.035, zb - 0.06, zb + 0.06, -0.035, 0.0, band_m)
        if roof == "flat":
            F.box(detail, -0.06, F.L + 0.06, z_roof - 0.24, z_roof - 0.02, -0.06, 0.0, band_m)
            F.box(detail, -0.035, F.L + 0.035, z_roof - 0.30, z_roof - 0.24, -0.035, 0.0, band_m)

    roof_parts = MB()
    roof_m = M.get("tile", roof_hex, size=0.22, aspect=1.6, offset=0.5) if roof != "flat" else None
    if roof == "flat":
        pt = 0.2 if parapet > 0.01 else 0.0
        top_m = M.get("concrete", "#8d8881")
        zr = z_roof
        x0, x1, y0, y1 = -w / 2 + pt, w / 2 - pt, -d / 2 + pt, d / 2 - pt
        body.poly([(x0, y0, zr), (x1, y0, zr), (x1, y1, zr), (x0, y1, zr)], top_m, (0, 0, 1))
        if pt > 0:
            zt = eave
            body.poly([(x0, y0, zr), (x1, y0, zr), (x1, y0, zt), (x0, y0, zt)], reveal_m, (0, 1, 0))
            body.poly([(x1, y1, zr), (x0, y1, zr), (x0, y1, zt), (x1, y1, zt)], reveal_m, (0, -1, 0))
            body.poly([(x0, y1, zr), (x0, y0, zr), (x0, y0, zt), (x0, y1, zt)], reveal_m, (1, 0, 0))
            body.poly([(x1, y0, zr), (x1, y1, zr), (x1, y1, zt), (x1, y0, zt)], reveal_m, (-1, 0, 0))
            ring = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
            inner = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            for i in range(4):
                j = (i + 1) % 4
                body.poly([(*ring[i], zt), (*ring[j], zt), (*inner[j], zt), (*inner[i], zt)], band_m, (0, 0, 1))
        # coping
        c = 0.05
        cw = max(pt, 0.2) + 0.03
        roof_parts.box((-w / 2 - c, -d / 2 - c, eave), (w / 2 + c, -d / 2 + cw, h), band_m)
        roof_parts.box((-w / 2 - c, d / 2 - cw, eave), (w / 2 + c, d / 2 + c, h), band_m)
        roof_parts.box((-w / 2 - c, -d / 2 + cw, eave), (-w / 2 + cw, d / 2 - cw, h), band_m)
        roof_parts.box((w / 2 - cw, -d / 2 + cw, eave), (w / 2 + c, d / 2 - cw, h), band_m)
        if P.get("rooftop", True) and w > 3 and d > 3:
            rng = ctx.rng
            unit_m = M.get("metal", "#b9bcbf", painted=True)
            dark_m = M.get("metal", "#4a4d50", painted=True)
            n = 1 if w * d < 40 else 2
            for k in range(n):
                ux = (-w / 2 + pt + 1.0) + (w - 2 * pt - 2.0) * (0.25 + 0.5 * rng.random()) if n == 1 else \
                    (-w / 4 if k == 0 else w / 4) + rng.uniform(-0.4, 0.4)
                uy = d / 2 - pt - 1.0 - rng.uniform(0, 0.4)
                roof_parts.box((ux - 0.55, uy - 0.35, zr), (ux + 0.55, uy + 0.35, zr + 0.62), unit_m)
                roof_parts.cyl((ux + 0.2, uy, zr + 0.62), 0.24, 0.025, dark_m, n=20)
                roof_parts.box((ux - 0.48, uy - 0.36, zr + 0.08), (ux - 0.05, uy - 0.35, zr + 0.55), dark_m)
            px, py = -w / 2 + pt + 0.6 + rng.uniform(0, 0.5), -d / 2 + pt + 0.8 + rng.uniform(0, 0.5)
            roof_parts.cyl((px, py, zr), 0.07, 0.55, unit_m, n=16)
            roof_parts.cyl((px, py, zr + 0.55), 0.11, 0.08, unit_m, n=16)
    else:
        trim_m = M.get("plaster", shade(col, 0.4))
        o = 0.32  # eave overhang
        if roof == "shed":
            # front (-y) low, back (+y) high; walls: back facade continues up with a triangle infill
            t_ = math.tan(pitch)
            z_at = lambda y: eave + tv + (y + d / 2) * t_  # noqa: E731 (top surface height)
            xa, xb, ya, yb = -w / 2 - o, w / 2 + o, -d / 2 - o, d / 2 + o
            roof_parts.box8([(xa, ya, z_at(ya) - tv), (xb, ya, z_at(ya) - tv), (xb, yb, z_at(yb) - tv),
                             (xa, yb, z_at(yb) - tv), (xa, ya, z_at(ya)), (xb, ya, z_at(ya)),
                             (xb, yb, z_at(yb)), (xa, yb, z_at(yb))], roof_m)
            for sx in (-1, 1):
                x = sx * w / 2
                body.prism([(-d / 2, eave), (d / 2, eave), (d / 2, z_at(d / 2) - tv)], "x",
                           x - (0.2 if sx > 0 else 0), x + (0 if sx > 0 else 0.2), wall_m)
            body.prism([(eave, -w / 2), (z_at(d / 2) - tv, -w / 2), (z_at(d / 2) - tv, w / 2), (eave, w / 2)],
                       "y", d / 2 - 0.2, d / 2, wall_m)
            roof_parts.box((xa, ya - 0.02, z_at(ya) - tv - 0.12), (xb, ya + 0.03, z_at(ya)), trim_m)
        else:
            along_x = w >= d
            Lr, S = (w, d) if along_x else (d, w)
            t_ = math.tan(pitch)
            ridge_top = h

            def to_xyz(a, b, z):  # a along the ridge, b across it
                return (a, b, z) if along_x else (b, a, z)

            def ztop(b):
                return ridge_top - abs(b) * t_

            if roof == "gable":
                og = 0.22
                for sb in (-1, 1):
                    b0, b1 = 0.0, sb * (S / 2 + o)
                    a0, a1 = -Lr / 2 - og, Lr / 2 + og
                    c = [to_xyz(a0, b0, ztop(b0) - tv), to_xyz(a1, b0, ztop(b0) - tv),
                         to_xyz(a1, b1, ztop(b1) - tv), to_xyz(a0, b1, ztop(b1) - tv),
                         to_xyz(a0, b0, ztop(b0)), to_xyz(a1, b0, ztop(b0)),
                         to_xyz(a1, b1, ztop(b1)), to_xyz(a0, b1, ztop(b1))]
                    roof_parts.box8(c, roof_m)
                    # fascia along the eave
                    fb = sb * (S / 2 + o)
                    fz = ztop(fb)
                    p0 = to_xyz(-Lr / 2 - og, fb - sb * 0.03, fz - tv - 0.1)
                    p1 = to_xyz(Lr / 2 + og, fb + sb * 0.02, fz + 0.01)
                    roof_parts.box(tuple(min(a, b) for a, b in zip(p0, p1)), tuple(max(a, b) for a, b in zip(p0, p1)),
                                   trim_m)
                # gable-end triangles (infill above the eave) on both short faces
                for sa in (-1, 1):
                    a = sa * Lr / 2
                    tri = [(-S / 2, eave), (S / 2, eave), (0.0, ztop(0) - tv)]
                    lo, hi = (a - 0.2, a) if sa > 0 else (a, a + 0.2)
                    if along_x:
                        body.prism(tri, "x", lo, hi, wall_m)
                    else:
                        body.prism([(q, p) for p, q in tri], "y", lo, hi, wall_m)
                p0, p1 = to_xyz(-Lr / 2 - og, -0.09, ridge_top - 0.05), to_xyz(Lr / 2 + og, 0.09, ridge_top + 0.035)
                roof_parts.box(tuple(min(a, b) for a, b in zip(p0, p1)), tuple(max(a, b) for a, b in zip(p0, p1)),
                               M.get("tile", shade(roof_hex, -0.2)))
            else:  # hip
                half_ridge = max(0.0, (Lr - S) / 2)
                ez = ztop(S / 2 + o)
                A, B = Lr / 2 + o, S / 2 + o
                top = [to_xyz(-A, -B, ez), to_xyz(A, -B, ez), to_xyz(A, B, ez), to_xyz(-A, B, ez)]
                r0, r1 = to_xyz(-half_ridge, 0, ridge_top), to_xyz(half_ridge, 0, ridge_top)
                faces = [[top[0], top[1], r1, r0], [top[1], top[2], r1], [top[2], top[3], r0, r1], [top[3], top[0], r0]]
                for f in faces:
                    roof_parts.poly(f, roof_m, (0, 0, 1))
                    roof_parts.poly([(x, y, z - tv) for x, y, z in f], roof_m, (0, 0, -1))
                for i in range(4):
                    a, b = top[i], top[(i + 1) % 4]
                    roof_parts.poly([a, b, (b[0], b[1], b[2] - tv), (a[0], a[1], a[2] - tv)], trim_m,
                                    (a[0] + b[0], a[1] + b[1], 0))
                p0, p1 = to_xyz(-half_ridge - 0.05, -0.08, ridge_top - 0.04), to_xyz(half_ridge + 0.05, 0.08,
                                                                                       ridge_top + 0.03)
                if half_ridge > 0.05:
                    roof_parts.box(tuple(min(a, b) for a, b in zip(p0, p1)),
                                   tuple(max(a, b) for a, b in zip(p0, p1)), M.get("tile", shade(roof_hex, -0.2)))

    parts = []
    ob = body.obj("body", ctx.collection)
    parts.append(ob)
    det = detail.obj("detail", ctx.collection, bevel_w=0.008, segments=2)
    parts.append(det)
    if roof_parts.faces:
        parts.append(roof_parts.obj("roof", ctx.collection, bevel_w=0.012, segments=2))
    if glass.faces:
        glass.mats = [glass_m]
        g = glass.obj("glass", ctx.collection)
        g.visible_shadow = False
        g.visible_diffuse = False
        parts.append(g)
    return parts
