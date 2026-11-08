"""The interior shell (floor, walls with real openings, joinery, ceiling) and the exterior site plate.

Interior box (CONTRACTS.md section 1): scene x 0..width, z 0..depth, y 0..height, i.e. Blender
x 0..W, y -D..0, z 0..H. Walls are built OUTSIDE that box with `walls.thickness`, so the interior
width/depth stay exact. Every wall is ONE object `wall_<side>` (its slab, with the openings cut
cleanly as a gridded mesh, no booleans); its skirting, window frames, sills, glass, door lining,
architraves and door leaf are child objects named `wall_<side>__…` (GLB contract section 4).

Corners are mitred, so the viewer can hide any two walls in dollhouse view and the rest still
meet cleanly. Wall tops, mitres and the floor band under the walls are a flat dark "section" colour
(an `emit…` material), like an architectural cut-away, so they never depend on baked light.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

import materials
from mrgeo import MB, bevel, flat_emit, mix, shade

SECTION = "#3a3531"      # cut wall tops / floor band (flat colour)
PLINTH = "#4b443e"       # sides of the floor slab / ground plate
TRIM = "#f4f1ea"         # default frame / skirting colour
FLOOR_T = 0.12           # floor slab thickness (a diorama plinth)
CEIL_T = 0.05

FLOOR_FALLBACK = {"timber": "oak", "carpet": "wool", "tile": "tile", "concrete": "concrete",
                  "vinyl": "plastic", "stone": "stone"}
WALL_FALLBACK = {"paint": "plaster", "plaster": "plaster", "brick": "brick", "timber": "pine", "tile": "tile",
                 "concrete": "concrete", "wallpaper": "plaster"}
GROUND_FALLBACK = {"asphalt": "concrete", "grass": "plant", "sand": "plaster", "snow": "plaster",
                   "paving": "stone", "concrete": "concrete", "gravel": "stone", "dirt": "stone"}
GROUND_COLOR = {"asphalt": "#4c4c4f", "grass": "#6d8c4c", "sand": "#d9c59c", "snow": "#eef2f5",
                "paving": "#b9b2a6", "concrete": "#a8a49c", "gravel": "#9c958b", "dirt": "#7c6148"}

SIDES = ("north", "south", "east", "west")


def _helper_mat(helper: str, finish: str, color, fallback_table: dict, default: str):
    fn = getattr(materials, helper, None)
    if fn is not None:
        try:
            m = fn(finish, color)
            if m is not None:
                return m
        except Exception as e:  # the kit agent's helper failed: fall back, but say so
            print(f"[shell] materials.{helper}({finish!r}) failed: {e}")
    return materials.get(fallback_table.get(finish, default), color)


def floor_mat(finish, color):
    return _helper_mat("floor", finish or "timber", color, FLOOR_FALLBACK, "oak")


def wall_mat(finish, color):
    return _helper_mat("wall", finish or "paint", color, WALL_FALLBACK, "plaster")


def ground_mat(finish, color):
    return _helper_mat("ground", finish or "paving", color or GROUND_COLOR.get(finish), GROUND_FALLBACK, "concrete")


def section_mat(wall_hex=None):
    """Flat 'cut' colour for wall tops / mitres / the floor band: the wall colour, much darker."""
    hexc = mix(shade(wall_hex, -0.62), SECTION, 0.35) if wall_hex else SECTION
    return flat_emit(f"emit_section_{hexc.lstrip('#')}", hexc, 1.0)


def plinth_mat():
    return materials.get("concrete", PLINTH)


def trim_mat(color):
    return materials.get("plaster", color or TRIM)


# ── wall frames ───────────────────────────────────────────────────────────────
class WallFrame:
    """Wall-local coordinates: u along the wall from its lower-x / lower-z end (the scene offset axis),
    v up, w from the inner face (0) out through the wall (t). Negative w is inside the room."""

    def __init__(self, side, W, D, t):
        self.side, self.W, self.D, self.t = side, W, D, t
        self.L = W if side in ("north", "south") else D

    def P(self, u, v, w):
        s = self.side
        if s == "north":
            return (u, w, v)
        if s == "south":
            return (u, -self.D - w, v)
        if s == "west":
            return (-w, -u, v)
        return (self.W + w, -u, v)

    def N(self, du, dv, dw):
        s = self.side
        if s == "north":
            return (du, dw, dv)
        if s == "south":
            return (du, -dw, dv)
        if s == "west":
            return (-dw, -du, dv)
        return (dw, -du, dv)

    @property
    def inward(self):
        return Vector(self.N(0, 0, -1))

    def wbox(self, mb, u0, u1, v0, v1, w0, w1, mat):
        a = self.P(u0, v0, w0)
        b = self.P(u1, v1, w1)
        mb.box(tuple(min(p, q) for p, q in zip(a, b)), tuple(max(p, q) for p, q in zip(a, b)), mat)


def _openings_for(shell, side, L, H):
    out = []
    for i, op in enumerate(shell.get("openings", [])):
        if op["wall"] != side:
            continue
        typ = op["type"]
        sill = op.get("sill", 0.9 if typ == "window" else 0.0)
        a = max(0.0, min(L - 0.05, float(op["offset"])))
        b = max(a + 0.05, min(L, a + float(op["width"])))
        s = max(0.0, min(H - 0.05, float(sill)))
        h = max(s + 0.05, min(H, s + float(op["height"])))
        out.append({"index": i, "type": typ, "a": a, "b": b, "s": s, "h": h, "spec": op})
    return out


def _wall_slab(F: WallFrame, H, holes, wmat, cmat):
    """The wall body: a gridded mesh with clean rectangular holes, mitred ends, section-coloured caps."""
    L, t = F.L, F.t
    U = sorted({0.0, L, *[o["a"] for o in holes], *[o["b"] for o in holes]})
    V = sorted({0.0, H, *[o["s"] for o in holes], *[o["h"] for o in holes]})
    nU, nV = len(U), len(V)

    def solid(i, j):
        if i < 0 or j < 0 or i >= nU - 1 or j >= nV - 1:
            return False
        uc, vc = (U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2
        return not any(o["a"] < uc < o["b"] and o["s"] < vc < o["h"] for o in holes)

    def uo(u):  # outer-face u (mitred corners)
        if u <= 1e-9:
            return -t
        if u >= L - 1e-9:
            return L + t
        return u

    P = F.P
    inn, out = F.N(0, 0, -1), F.N(0, 0, 1)
    mb = MB()
    for i in range(nU - 1):
        for j in range(nV - 1):
            if not solid(i, j):
                continue
            u0, u1, v0, v1 = U[i], U[i + 1], V[j], V[j + 1]
            mb.poly([P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)], wmat, inn)
            mb.poly([P(uo(u0), v0, t), P(uo(u1), v0, t), P(uo(u1), v1, t), P(uo(u0), v1, t)], wmat, out)
    for i in range(nU):  # vertical boundaries
        for j in range(nV - 1):
            ls, rs = solid(i - 1, j), solid(i, j)
            if ls == rs:
                continue
            u, v0, v1 = U[i], V[j], V[j + 1]
            if i == 0 or i == nU - 1:
                mb.poly([P(u, v0, 0), P(u, v1, 0), P(uo(u), v1, t), P(uo(u), v0, t)], cmat,
                        F.N(-1 if i == 0 else 1, 0, 0))
            else:
                mb.poly([P(u, v0, 0), P(u, v1, 0), P(u, v1, t), P(u, v0, t)], wmat, F.N(1 if ls else -1, 0, 0))
    for j in range(nV):  # horizontal boundaries
        for i in range(nU - 1):
            bs, ab = solid(i, j - 1), solid(i, j)
            if bs == ab or j == 0:
                continue
            v, u0, u1 = V[j], U[i], U[i + 1]
            if j == nV - 1:
                mb.poly([P(u0, v, 0), P(u1, v, 0), P(uo(u1), v, t), P(uo(u0), v, t)], cmat, F.N(0, 1, 0))
            else:
                mb.poly([P(u0, v, 0), P(u1, v, 0), P(u1, v, t), P(u0, v, t)], wmat, F.N(0, 1 if bs else -1, 0))
    return mb


def _window(F: WallFrame, o, trim, glass_mat, trim_hex=TRIM):
    a, b, s, h, t = o["a"], o["b"], o["s"], o["h"], F.t
    width, height = b - a, h - s
    fw = max(0.035, min(0.055, min(width, height) * 0.06))
    fd = min(0.075, t * 0.55)
    wc = t * 0.55
    w0, w1 = wc - fd / 2, wc + fd / 2
    sill_mat = materials.get("plaster", shade(trim_hex, -0.04))
    mb = MB()
    wb = F.wbox
    wb(mb, a, a + fw, s, h, w0, w1, trim)
    wb(mb, b - fw, b, s, h, w0, w1, trim)
    wb(mb, a + fw, b - fw, s, s + fw, w0, w1, trim)
    wb(mb, a + fw, b - fw, h - fw, h, w0, w1, trim)
    panes = max(1, round(width / 0.85))
    inner = width - 2 * fw
    for k in range(1, panes):
        uc = a + fw + inner * k / panes
        wb(mb, uc - fw * 0.38, uc + fw * 0.38, s + fw, h - fw, w0 + 0.008, w1 - 0.008, trim)
    if height > 1.45:
        vc = h - height * 0.28
        wb(mb, a + fw, b - fw, vc - fw * 0.38, vc + fw * 0.38, w0 + 0.008, w1 - 0.008, trim)
    # inside: window board + apron + architrave; outside: a sill that sheds water
    wb(mb, a - 0.07, b + 0.07, s - 0.032, s, -0.055, w0, sill_mat)
    wb(mb, a - 0.05, b + 0.05, s - 0.032 - 0.07, s - 0.032, -0.014, 0.0, trim)
    aw = 0.06
    wb(mb, a - aw, a, s, h + aw, -0.014, 0.0, trim)
    wb(mb, b, b + aw, s, h + aw, -0.014, 0.0, trim)
    wb(mb, a - aw, b + aw, h, h + aw, -0.014, 0.0, trim)
    wb(mb, a - 0.06, b + 0.06, s - 0.045, s, w1, t + 0.055, sill_mat)
    g = MB()
    wb(g, a + fw * 0.5, b - fw * 0.5, s + fw * 0.5, h - fw * 0.5, wc - 0.003, wc + 0.003, glass_mat)
    return mb, g


def _door(F: WallFrame, o, trim, leaf_mat, metal, hinge_low: bool):
    a, b, h, t = o["a"], o["b"], o["h"], F.t
    lt, aw, at = 0.028, 0.07, 0.016
    wb = F.wbox
    frame = MB()
    wb(frame, a, a + lt, 0, h, -0.006, t + 0.006, trim)
    wb(frame, b - lt, b, 0, h, -0.006, t + 0.006, trim)
    wb(frame, a, b, h - lt, h, -0.006, t + 0.006, trim)
    for w0, w1 in ((-at, 0.0), (t, t + at)):
        wb(frame, a - aw + 0.01, a + 0.01, 0, h + aw - 0.01, w0, w1, trim)
        wb(frame, b - 0.01, b + aw - 0.01, 0, h + aw - 0.01, w0, w1, trim)
        wb(frame, a - aw + 0.01, b + aw - 0.01, h - 0.01, h + aw - 0.01, w0, w1, trim)
    if o["type"] != "door":
        return frame, None, None

    cw = (b - a) - 2 * lt - 0.006
    lh = h - lt - 0.003 - 0.008
    th = 0.04
    theta = math.radians(90.0 * float(o["spec"].get("open", 0.0)))
    c, s_ = math.cos(theta), math.sin(theta)
    uh = a + lt + 0.003 if hinge_low else b - lt - 0.003
    sign = 1.0 if hinge_low else -1.0

    def LP(du, v, dw):
        u = uh + sign * (du * c + dw * s_)
        w = -du * s_ + dw * c
        return F.P(u, 0.008 + v, w)

    def lbox(mb, du0, du1, v0, v1, dw0, dw1, mat):
        mb.box8([LP(du0, v0, dw0), LP(du1, v0, dw0), LP(du1, v0, dw1), LP(du0, v0, dw1),
                 LP(du0, v1, dw0), LP(du1, v1, dw0), LP(du1, v1, dw1), LP(du0, v1, dw1)], mat)

    leaf = MB()
    lbox(leaf, 0, cw, 0, lh, 0, th, leaf_mat)
    st = min(0.11, cw * 0.16)
    for v0, v1 in ((0.16, lh * 0.47), (lh * 0.55, lh - 0.13)):
        for dw0, dw1 in ((-0.007, 0.0), (th, th + 0.007)):
            lbox(leaf, st, cw - st, v0, v1, dw0, dw1, leaf_mat)
    hw = MB()
    hu = cw - 0.075
    for side in (-1, 1):
        f = 0.0 if side < 0 else th
        d = -1 if side < 0 else 1
        lbox(hw, hu - 0.022, hu + 0.022, 0.98, 1.06, f, f + d * 0.01, metal)
        lbox(hw, hu - 0.012, hu + 0.012, 1.008, 1.032, f + d * 0.01, f + d * 0.045, metal)
        lbox(hw, hu - 0.12, hu, 1.008, 1.032, f + d * 0.035, f + d * 0.055, metal)
    return frame, leaf, hw


def build_interior(scene: dict, coll) -> dict:
    sh = scene["shell"]
    W, D, H = float(sh["width"]), float(sh["depth"]), float(sh["height"])
    walls = sh.get("walls", {})
    t = float(walls.get("thickness", 0.12))
    wcol = walls.get("color")
    wmat = wall_mat(walls.get("finish", "paint"), wcol)
    cmat = section_mat(wcol or "#e8e2d6")
    glass = materials.get("glass", "#e2eef0", thin=True)
    metal = materials.get("brass", "#b89a5e")
    ops = sh.get("openings", [])
    # Skirting follows the WINDOW frame colour (else off-white); a painted door's colour never
    # leaks into the skirting, whatever order the openings are listed in.
    trim_hex = next((o.get("color") for o in ops if o.get("color") and o.get("type") == "window"), TRIM)
    info = {"walls": {}, "windows": [], "doors": [], "W": W, "D": D, "H": H, "t": t,
            "bounds": ((-t, -D - t, -FLOOR_T), (W + t, t, H + CEIL_T))}

    def link(mb, name, parent=None, bevel_w=0.0, segments=2):
        if not mb.faces:
            return None
        ob = mb.obj(name, coll, bevel_w=bevel_w, segments=segments)
        if parent is not None:
            ob.parent = parent
        return ob

    fl = sh.get("floor", {})
    fmat = floor_mat(fl.get("finish", "timber"), fl.get("color"))
    for side in SIDES:
        F = WallFrame(side, W, D, t)
        holes = _openings_for(sh, side, F.L, H)
        wall = link(_wall_slab(F, H, holes, wmat, cmat), f"wall_{side}")
        wall["mr_wall"] = side
        info["walls"][side] = wall
        # skirting, broken at doors / floor-level openings (and their architraves)
        if walls.get("skirting", True):
            gaps = sorted((o["a"] - 0.07, o["b"] + 0.07) for o in holes if o["s"] < 0.1)
            segs, u = [], 0.0
            for g0, g1 in gaps:
                if g0 > u:
                    segs.append((u, g0))
                u = max(u, g1)
            if u < F.L:
                segs.append((u, F.L))
            sk = MB()
            skm = trim_mat(trim_hex)
            for u0, u1 in segs:
                if u1 - u0 > 0.02:
                    F.wbox(sk, max(0.0, u0), min(F.L, u1), 0.0, 0.09, -0.014, 0.0, skm)
            link(sk, f"wall_{side}__skirting", wall, bevel_w=0.004)
        # floor-level openings: a threshold in the floor finish across the wall thickness, OWNED BY THE WALL
        # (it hides with the wall in dollhouse view; underneath, the floor band is the flat section colour)
        th = MB()
        for o in holes:
            if o["s"] < 0.05:
                F.wbox(th, o["a"], o["b"], 0.0, 0.008, 0.0, t, fmat)
        link(th, f"wall_{side}__threshold", wall, bevel_w=0.002, segments=1)
        for k, o in enumerate(holes):
            col = o["spec"].get("color", trim_hex)
            tm = trim_mat(col)
            if o["type"] == "window":
                fr, gl = _window(F, o, tm, glass, col)
                link(fr, f"wall_{side}__window{k}", wall, bevel_w=0.006)
                gob = link(gl, f"wall_{side}__window{k}_glass", wall)
                if gob is not None:
                    gob.visible_shadow = False
                    gob.visible_diffuse = False
                ctr = Vector(F.P((o["a"] + o["b"]) / 2, (o["s"] + o["h"]) / 2, -0.02))
                info["windows"].append({"wall": side, "center": tuple(ctr), "inward": tuple(F.inward),
                                        "width": o["b"] - o["a"], "height": o["h"] - o["s"],
                                        "u_axis": tuple(Vector(F.N(1, 0, 0)))})
            else:
                hinge_low = o["a"] <= F.L - o["b"]
                leaf_mat = materials.get("plaster", col)
                fr, leaf, hw = _door(F, o, tm, leaf_mat, metal, hinge_low)
                link(fr, f"wall_{side}__door{k}_frame", wall, bevel_w=0.004)
                if leaf is not None:
                    # no shadows: the leaf disappears with its wall in dollhouse view, its shadow must too
                    for part in (link(leaf, f"wall_{side}__door{k}_leaf", wall, bevel_w=0.004),
                                 link(hw, f"wall_{side}__door{k}_handle", wall, bevel_w=0.003)):
                        if part is not None:
                            part.visible_shadow = False
                ctr = Vector(F.P((o["a"] + o["b"]) / 2, o["h"] / 2, 0.0))
                info["doors"].append({"wall": side, "center": tuple(ctr), "inward": tuple(F.inward),
                                      "width": o["b"] - o["a"], "height": o["h"], "type": o["type"]})

    # floor slab: finish inside, flat section band under the walls (thresholds belong to the walls), plinth sides
    pm = plinth_mat()
    mb = MB()
    up = (0, 0, 1)
    mb.poly([(0, -D, 0), (W, -D, 0), (W, 0, 0), (0, 0, 0)], fmat, up)
    for side in SIDES:
        F = WallFrame(side, W, D, t)
        lo, hi = (-t, F.L + t) if side in ("north", "south") else (0.0, F.L)
        mb.poly([F.P(lo, 0, 0), F.P(hi, 0, 0), F.P(hi, 0, t), F.P(lo, 0, t)], cmat, up)
    x0, x1, y0, y1, z0 = -t, W + t, -D - t, t, -FLOOR_T
    mb.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, 0), (x0, y0, 0)], pm, (0, -1, 0))
    mb.poly([(x1, y1, z0), (x0, y1, z0), (x0, y1, 0), (x1, y1, 0)], pm, (0, 1, 0))
    mb.poly([(x0, y1, z0), (x0, y0, z0), (x0, y0, 0), (x0, y1, 0)], pm, (-1, 0, 0))
    mb.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, 0), (x1, y0, 0)], pm, (1, 0, 0))
    mb.poly([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], pm, (0, 0, -1))
    info["floor"] = link(mb, "floor")

    ce = sh.get("ceiling", {})
    if ce.get("show", True):
        cm = materials.get("plaster", ce.get("color", "#f3efe6"))
        mb = MB()
        mb.box((0, -D, H), (W, 0, H + CEIL_T), cm)
        info["ceiling"] = link(mb, "ceiling")
    return info


# ── exterior ──────────────────────────────────────────────────────────────────
def _rounded_rect(w, d, r, seg=6):
    pts = []
    corners = [(w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180),
               (w / 2 - r, -d / 2 + r, 270)]
    for cx, cy, a0 in corners:
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def build_site(scene: dict, coll) -> dict:
    g = scene["site"]["ground"]
    w, d = float(g["size"][0]), float(g["size"][1])
    finish = g.get("finish", "paving")
    gm = ground_mat(finish, g.get("color"))
    pm = materials.get("stone", "#5a5048")
    r = max(0.25, min(1.2, min(w, d) * 0.035))
    th = max(0.18, min(0.6, min(w, d) * 0.018))
    pts = _rounded_rect(w, d, r)
    mb = MB()
    n = len(pts)
    top = mb.add_verts([(x, y, 0.0) for x, y in pts])
    bot = mb.add_verts([(x, y, -th) for x, y in pts])
    mb.face([top + i for i in range(n)], gm)
    mb.face([bot + i for i in reversed(range(n))], pm)
    for i in range(n):
        j = (i + 1) % n
        mb.face((bot + i, bot + j, top + j, top + i), pm)
    ob = mb.obj("ground", coll, bevel_w=min(0.06, th * 0.3), segments=3, angle=60)
    return {"ground": ob, "W": w, "D": d, "bounds": ((-w / 2, -d / 2, -th), (w / 2, d / 2, 0.0))}
