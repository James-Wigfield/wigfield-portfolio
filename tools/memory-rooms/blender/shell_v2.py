"""The v2 interior shell (CONTRACTS.md section 6.1): ANY polygon outline and a flat, gable, pyramid or skillion
ceiling, built from the normalised shell (scene_io.resolve_shell, the mirror of src/memory-rooms/scene/shell.js).

It replaces the bespoke octagon.py / gable_roof.py tricks with parameters:
  - every wall is its own object `wall__<id>` (box shells: north / south / east / west; polygons: e0, e1, …), built
    OUTSIDE the inner face like v1, its slab gridded around the openings, its ends mitred at whatever angle the
    corner has (the outer corners come from the outline offset by the wall thickness);
  - a wall's top follows the ceiling: the slab is built to its highest point and cut by the ceiling's planes
    (one per gable side / pyramid face / skillion), the cut capped in the flat section colour;
  - windows, doors, skirting and thresholds reuse shell.py's joinery (they only need a wall frame);
  - the floor is the outline, with the section band under the walls and the plinth round the outer outline;
  - the ceiling is the ceiling surface (split along a gable's ridge, fanned to a pyramid's apex);
  - each wall node carries `mrWall = {"id", "normal": [x, z]}` (its outward normal, scene frame): with
    export_extras on, the viewer hides walls by that normal (any shape), CONTRACTS.md section 6.3.
v1 scenes never come here (shell.build_interior builds them exactly as before).
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Vector

import materials
import polygon2d as P
import scene_io
import shell as SH
from mrgeo import MB

FLOOR_T = SH.FLOOR_T
CEIL_T = SH.CEIL_T


def bl(p):
    """scene [x, z] -> Blender (x, y) on the floor (scene_io.to_bl with y = 0)."""
    return Vector((float(p[0]), -float(p[1]), 0.0))


class PolyWallFrame:
    """shell.WallFrame for a wall at any angle. u along the inner face from its end a (scene offsets), v up,
    w from the inner face (0) out through the wall (t). ea / eb = how far the OUTER face runs past the inner
    face's ends (the mitre: + at a convex corner, - at a reflex one)."""

    def __init__(self, wall, t, ea, eb):
        self.side = wall["id"]
        self.t = float(t)
        self.L = float(wall["length"])
        self.A = bl(wall["a"])
        b = bl(wall["b"])
        self.d = (b - self.A).normalized() if (b - self.A).length > 1e-9 else Vector((1, 0, 0))
        self.o = Vector((wall["out"][0], -wall["out"][1], 0.0)).normalized()
        self.up = Vector((0, 0, 1))
        self.ea, self.eb = float(ea), float(eb)

    def P(self, u, v, w):
        return tuple(self.A + self.d * u + self.up * v + self.o * w)

    def N(self, du, dv, dw):
        return tuple(self.d * du + self.up * dv + self.o * dw)

    @property
    def inward(self):
        return -self.o

    def uo(self, u):
        if u <= 1e-9:
            return -self.ea
        if u >= self.L - 1e-9:
            return self.L + self.eb
        return u

    def wbox(self, mb, u0, u1, v0, v1, w0, w1, mat):
        P_ = self.P
        mb.box8([P_(u0, v0, w0), P_(u1, v0, w0), P_(u1, v0, w1), P_(u0, v0, w1),
                 P_(u0, v1, w0), P_(u1, v1, w0), P_(u1, v1, w1), P_(u0, v1, w1)], mat)


def wall_slab(F: PolyWallFrame, H, holes, wmat, cmat, imat=None, omat=None, bands=None, end_mats=None, top_mat=None):
    """shell._wall_slab for a PolyWallFrame: a gridded slab with clean holes, mitred ends, section-coloured caps.
    imat / omat (optional) replace wmat on the w = 0 / w = t face (a building wall's outside finish).
    bands (optional): [{a, b, s, h, imat?, omat?}] = rectangles of another material on a face (cladding panels);
    the grid is cut at their edges so they sit exactly, and a band that reaches u = 0 / L runs to the mitred end.
    end_mats (optional): (material at u = 0, material at u = L), None = the section colour (a building wall's free end
    is a finished face); top_mat (optional): the top's material (a wall lower than its level has a real top)."""
    L, t = F.L, F.t
    bands = bands or []
    U = sorted({0.0, L, *[o["a"] for o in holes], *[o["b"] for o in holes], *[x["a"] for x in bands], *[x["b"] for x in bands]})
    V = sorted({0.0, H, *[o["s"] for o in holes], *[o["h"] for o in holes], *[x["s"] for x in bands], *[x["h"] for x in bands]})
    nU, nV = len(U), len(V)

    def solid(i, j):
        if i < 0 or j < 0 or i >= nU - 1 or j >= nV - 1:
            return False
        uc, vc = (U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2
        return not any(o["a"] < uc < o["b"] and o["s"] < vc < o["h"] for o in holes)

    def band_mat(i, j, key):
        uc, vc = (U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2
        for x in bands:
            if x.get(key) is not None and x["a"] < uc < x["b"] and x["s"] < vc < x["h"]:
                return x[key]
        return None

    P_, uo = F.P, F.uo
    inn, out = F.N(0, 0, -1), F.N(0, 0, 1)
    mb = MB()
    for i in range(nU - 1):
        for j in range(nV - 1):
            if not solid(i, j):
                continue
            u0, u1, v0, v1 = U[i], U[i + 1], V[j], V[j + 1]
            mb.poly([P_(u0, v0, 0), P_(u1, v0, 0), P_(u1, v1, 0), P_(u0, v1, 0)], band_mat(i, j, "imat") or imat or wmat, inn)
            mb.poly([P_(uo(u0), v0, t), P_(uo(u1), v0, t), P_(uo(u1), v1, t), P_(uo(u0), v1, t)], band_mat(i, j, "omat") or omat or wmat, out)
    for i in range(nU):
        for j in range(nV - 1):
            ls, rs = solid(i - 1, j), solid(i, j)
            if ls == rs:
                continue
            u, v0, v1 = U[i], V[j], V[j + 1]
            if i == 0 or i == nU - 1:
                emat = (end_mats or (None, None))[0 if i == 0 else 1] or cmat
                mb.poly([P_(u, v0, 0), P_(u, v1, 0), P_(uo(u), v1, t), P_(uo(u), v0, t)], emat, F.N(-1 if i == 0 else 1, 0, 0))
            else:
                mb.poly([P_(u, v0, 0), P_(u, v1, 0), P_(u, v1, t), P_(u, v0, t)], wmat, F.N(1 if ls else -1, 0, 0))
    for j in range(nV):
        for i in range(nU - 1):
            bs, ab = solid(i, j - 1), solid(i, j)
            if bs == ab or j == 0:
                continue
            v, u0, u1 = V[j], U[i], U[i + 1]
            if j == nV - 1:
                mb.poly([P_(u0, v, 0), P_(u1, v, 0), P_(uo(u1), v, t), P_(uo(u0), v, t)], top_mat or cmat, F.N(0, 1, 0))
            else:
                mb.poly([P_(u0, v, 0), P_(u1, v, 0), P_(u1, v, t), P_(u0, v, t)], wmat, F.N(0, 1 if bs else -1, 0))
    return mb


# ── the ceiling as planes (for cutting wall tops) and as a surface ───────────
def ceiling_planes(sh):
    """[(point, normal)] in Blender coordinates; the room's inside is BELOW every plane (normal points up/out).
    Flat: none (walls are built to the height)."""
    c = sh["ceiling"]
    H = sh["height"]
    mn, mx = sh["box"]["min"], sh["box"]["max"]
    planes = []

    def plane3(p0, p1, p2):
        a, b, cc = Vector(p0), Vector(p1), Vector(p2)
        n = (b - a).cross(cc - a).normalized()
        if n.z < 0:
            n = -n
        return (a, n)

    if c["shape"] == "gable":
        r = c["ridgeAt"]
        e0, e1 = c["eaves"]
        if c["axis"] == "x":  # ridge runs west-east at z = r; slopes fall to z = mn (e0) and z = mx (e1)
            planes.append(plane3((0, -mn[1], e0), (1, -mn[1], e0), (0, -r, c["peak"])))
            planes.append(plane3((0, -mx[1], e1), (1, -mx[1], e1), (0, -r, c["peak"])))
        else:  # ridge runs north-south at x = r
            planes.append(plane3((mn[0], 0, e0), (mn[0], 1, e0), (r, 0, c["peak"])))
            planes.append(plane3((mx[0], 0, e1), (mx[0], 1, e1), (r, 0, c["peak"])))
    elif c["shape"] == "pyramid":
        ax, az = c["apex"]
        apex = (ax, -az, c["peak"])
        pts = sh["outline"]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            planes.append(plane3((a[0], -a[1], H), (b[0], -b[1], H), apex))
    elif c["shape"] == "skillion":
        lo = c["low"]
        if lo in ("north", "south"):
            z_lo = mn[1] if lo == "north" else mx[1]
            z_hi = mx[1] if lo == "north" else mn[1]
            planes.append(plane3((0, -z_lo, H), (1, -z_lo, H), (0, -z_hi, c["peak"])))
        else:
            x_lo = mn[0] if lo == "west" else mx[0]
            x_hi = mx[0] if lo == "west" else mn[0]
            planes.append(plane3((x_lo, 0, H), (x_lo, 1, H), (x_hi, 0, c["peak"])))
    return planes


def cut_by_planes(ob, planes, cap_mat_index=None):
    """Keep what's below every plane (bisect + clear outer); fill each cut with the section material."""
    if not planes:
        return
    mw = ob.matrix_world.copy()
    inv = mw.inverted()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for co, no in planes:
        lco = inv @ co
        lno = (mw.to_3x3().transposed() @ no).normalized()
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=lco, plane_no=lno, clear_outer=True)
        if cap_mat_index is not None:
            cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if cut:
                try:
                    made = bmesh.ops.holes_fill(bm, edges=cut, sides=0)
                    for f in made.get("faces", []):
                        f.material_index = cap_mat_index
                except Exception:
                    pass
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def triangulate(pts):
    """Ear clipping for a simple polygon (positive winding); returns index triples."""
    idx = list(range(len(pts)))
    tris = []
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        n = len(idx)
        for k in range(n):
            i0, i1, i2 = idx[(k - 1) % n], idx[k], idx[(k + 1) % n]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-12:
                continue  # reflex (positive winding turns positive at convex corners)
            if any(P.point_in_polygon(pts[j], [a, b, c]) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def clip_poly(poly, keep):
    """Sutherland-Hodgman against one half-plane: keep(p) -> signed value (>= 0 kept)."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        fa, fb = keep(a), keep(b)
        if fa >= 0:
            out.append(a)
        if (fa >= 0) != (fb >= 0):
            t = fa / (fa - fb)
            out.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    return out


def ceiling_pieces(sh):
    """Polygons (scene xz) the ceiling surface is flat on: the outline split along a gable's ridge, or fanned
    to a pyramid's apex; flat and skillion are one piece."""
    c = sh["ceiling"]
    out = sh["outline"]
    if c["shape"] == "gable":
        r = c["ridgeAt"]
        k = 1 if c["axis"] == "x" else 0
        a = clip_poly(out, lambda p: r - p[k])
        b = clip_poly(out, lambda p: p[k] - r)
        return [q for q in (a, b) if len(q) >= 3]
    if c["shape"] == "pyramid":
        ap = c["apex"]
        return [[out[i], out[(i + 1) % len(out)], ap] for i in range(len(out))]
    return [out]


def build_polygon(scene: dict, coll) -> dict:
    sh = scene_io.resolve_shell(scene)
    spec = scene["shell"]
    walls_spec = spec.get("walls", {})
    t = float(walls_spec.get("thickness", 0.12))
    wcol = walls_spec.get("color")
    wmat = SH.wall_mat(walls_spec.get("finish", "paint"), wcol)
    cmat = SH.section_mat(wcol or "#e8e2d6")
    glass = materials.get("glass", "#e2eef0", thin=True)
    metal = materials.get("brass", "#b89a5e")
    fl = spec.get("floor", {})
    fmat = SH.floor_mat(fl.get("finish", "timber"), fl.get("color"))
    outline = sh["outline"]  # positive winding, scene xz
    top = sh["top"]
    W, D = sh["box"]["max"][0], sh["box"]["max"][1]
    planes = ceiling_planes(sh)
    # walls are cut by the ceiling only where they rise with it (gable ends, a skillion's sides). Under a
    # pyramid every wall stays at the eaves; cutting each wall by EVERY face's plane would slice through the
    # walls of a non-convex room (an L's other leg), so pyramid walls are never cut.
    cut_planes = [] if sh["ceiling"]["shape"] == "pyramid" else planes
    info = {"walls": {}, "windows": [], "doors": [], "W": W, "D": D, "H": top, "t": t, "v2": True,
            "bounds": ((-t, -D - t, -FLOOR_T), (W + t, t, top + CEIL_T)), "outline": outline,
            "wall_planes": [], "wall_normals": {}}

    def link(mb, name, parent=None, bevel_w=0.0, segments=2):
        if not mb.faces:
            return None
        ob = mb.obj(name, coll, bevel_w=bevel_w, segments=segments)
        if parent is not None:
            ob.parent = parent
        return ob

    # outer corners: the outline moved out by the wall thickness, one line per wall (same order as sh walls,
    # which follow the outline AS WRITTEN: map each wall to its edge of the positive outline by its ends)
    n = len(outline)
    outer = P.inset_edges(outline, [-t] * n, 1)

    def edge_of(w):
        for i in range(n):
            a, b = outline[i], outline[(i + 1) % n]
            if math.hypot(a[0] - w["a"][0], a[1] - w["a"][1]) < 1e-6 and math.hypot(b[0] - w["b"][0], b[1] - w["b"][1]) < 1e-6:
                return i, False
            if math.hypot(a[0] - w["b"][0], a[1] - w["b"][1]) < 1e-6 and math.hypot(b[0] - w["a"][0], b[1] - w["a"][1]) < 1e-6:
                return i, True
        return None, False

    ops_by_wall = {}
    for op in sh["openings"]:
        ops_by_wall.setdefault(op["wall"], []).append(op)
    trim_hex = next((o["spec"].get("color") for o in sh["openings"] if o["spec"].get("color") and o["type"] == "window"), SH.TRIM)

    for w in sh["walls"]:
        i, rev = edge_of(w)
        L = w["length"]
        d = Vector((w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])).normalized()
        if i is None:
            ea = eb = t
        else:
            s0, s1 = outer[i]["start"], outer[i]["end"]
            if rev:
                s0, s1 = s1, s0
            ea = -((s0[0] - w["a"][0]) * d.x + (s0[1] - w["a"][1]) * d.y)
            eb = (s1[0] - w["b"][0]) * d.x + (s1[1] - w["b"][1]) * d.y
        F = PolyWallFrame(w, t, ea, eb)
        # the wall's highest point (sloped ceilings): build to it, then cut along the ceiling
        tops = [scene_io.wall_top_at(sh, w, L * k / 24) for k in range(25)]
        Hw = max(tops) + (0.02 if cut_planes else 0.0)
        holes = []
        for o in ops_by_wall.get(w["id"], []):
            a = max(0.0, min(L - 0.05, o["offset"]))
            b = max(a + 0.05, min(L, o["offset"] + o["width"]))
            s = max(0.0, min(Hw - 0.05, o["sill"]))
            h = max(s + 0.05, min(Hw, o["head"]))
            holes.append({"index": o["index"], "type": o["type"], "a": a, "b": b, "s": s, "h": h, "spec": o["spec"]})
        name = w["node"]
        wall = link(wall_slab(F, Hw, holes, wmat, cmat), name)
        wall["mrWall"] = {"id": w["id"], "normal": [round(w["out"][0], 6), round(w["out"][1], 6)]}
        info["walls"][w["id"]] = wall
        info["wall_normals"][name] = w["out"]
        info["wall_planes"].append({"node": name, "point": list(w["a"]), "end": list(w["b"]), "out": list(w["out"])})
        if cut_planes:
            ci = next((k for k, m in enumerate(wall.data.materials) if m == cmat), None)
            cut_by_planes(wall, cut_planes, ci)
        if walls_spec.get("skirting", True):
            gaps = sorted((o["a"] - 0.07, o["b"] + 0.07) for o in holes if o["s"] < 0.1)
            segs, u = [], 0.0
            for g0, g1 in gaps:
                if g0 > u:
                    segs.append((u, g0))
                u = max(u, g1)
            if u < L:
                segs.append((u, L))
            sk = MB()
            skm = SH.trim_mat(trim_hex)
            for u0, u1 in segs:
                if u1 - u0 > 0.02:
                    F.wbox(sk, max(0.0, u0), min(L, u1), 0.0, 0.09, -0.014, 0.0, skm)
            link(sk, f"{name}__skirting", wall, bevel_w=0.004)
        th = MB()
        for o in holes:
            if o["s"] < 0.05:
                F.wbox(th, o["a"], o["b"], 0.0, 0.008, 0.0, t, fmat)
        link(th, f"{name}__threshold", wall, bevel_w=0.002, segments=1)
        for k, o in enumerate(holes):
            col = o["spec"].get("color", trim_hex)
            tm = SH.trim_mat(col)
            if o["type"] == "window":
                fr, gl = SH._window(F, o, tm, glass, col)
                link(fr, f"{name}__window{k}", wall, bevel_w=0.006)
                gob = link(gl, f"{name}__window{k}_glass", wall)
                if gob is not None:
                    gob.visible_shadow = False
                    gob.visible_diffuse = False
                ctr = Vector(F.P((o["a"] + o["b"]) / 2, (o["s"] + o["h"]) / 2, -0.02))
                info["windows"].append({"wall": w["id"], "center": tuple(ctr), "inward": tuple(F.inward),
                                        "width": o["b"] - o["a"], "height": o["h"] - o["s"], "u_axis": tuple(Vector(F.N(1, 0, 0)))})
            else:
                hinge_low = o["a"] <= L - o["b"]
                leaf_mat = materials.get("plaster", col)
                fr, leaf, hw = SH._door(F, o, tm, leaf_mat, metal, hinge_low)
                link(fr, f"{name}__door{k}_frame", wall, bevel_w=0.004)
                if leaf is not None:
                    for part in (link(leaf, f"{name}__door{k}_leaf", wall, bevel_w=0.004), link(hw, f"{name}__door{k}_handle", wall, bevel_w=0.003)):
                        if part is not None:
                            part.visible_shadow = False
                ctr = Vector(F.P((o["a"] + o["b"]) / 2, o["h"] / 2, 0.0))
                info["doors"].append({"wall": w["id"], "center": tuple(ctr), "inward": tuple(F.inward),
                                      "width": o["b"] - o["a"], "height": o["h"], "type": o["type"]})

    # floor: the outline in its finish; the band under the walls (between the inner and outer outlines) in the
    # section colour; the plinth down the outer outline's sides and underneath
    pm = SH.plinth_mat()
    up = (0, 0, 1)
    mb = MB()
    flo = [bl(p) for p in outline]
    for tri in triangulate(outline):
        mb.poly([flo[k] for k in tri], fmat, up)
    out_pts = []
    for i in range(n):
        e = outer[i]
        out_pts.append(e["start"])
        mb.poly([bl(outline[i]), bl(outline[(i + 1) % n]), bl(e["end"]), bl(e["start"])], cmat, up)
    # the corners between consecutive outer edges (a convex corner's mitre leaves no gap; a step does)
    for i in range(n):
        e0, e1 = outer[(i - 1) % n], outer[i]
        if math.hypot(e0["end"][0] - e1["start"][0], e0["end"][1] - e1["start"][1]) > 1e-6:
            mb.poly([bl(outline[i]), bl(e0["end"]), bl(e1["start"])], cmat, up)
    ring = []
    for i in range(n):
        for p in (outer[i]["start"], outer[i]["end"]):
            if not ring or math.hypot(ring[-1][0] - p[0], ring[-1][1] - p[1]) > 1e-6:
                ring.append(p)
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        A, B = bl(a), bl(b)
        nrm = Vector((b[1] - a[1], b[0] - a[0], 0))  # outward in Blender for a positive scene ring
        mb.poly([A + Vector((0, 0, -FLOOR_T)), B + Vector((0, 0, -FLOOR_T)), B, A], pm, tuple(nrm))
    under = [bl(p) + Vector((0, 0, -FLOOR_T)) for p in ring]
    for tri in triangulate(ring):
        mb.poly([under[k] for k in tri], pm, (0, 0, -1))
    info["floor"] = link(mb, "floor")

    # ceiling: the surface (seen from below) and its top a slab's thickness up
    ce = spec.get("ceiling", {})
    if ce.get("show", True):
        cm = materials.get("plaster", ce.get("color", "#f3efe6"))
        mb = MB()
        for piece in ceiling_pieces(sh):
            if len(piece) < 3:
                continue
            tris = triangulate(piece if P.signed_area(piece) >= 0 else list(reversed(piece)))
            pts = piece if P.signed_area(piece) >= 0 else list(reversed(piece))
            for tri in tris:
                lo = [Vector((pts[k][0], -pts[k][1], scene_io.ceiling_at(sh, pts[k][0], pts[k][1]))) for k in tri]
                mb.poly(lo, cm, (0, 0, -1))
                mb.poly([p + Vector((0, 0, CEIL_T)) for p in lo], cm, (0, 0, 1))
        info["ceiling"] = link(mb, "ceiling")
    info["shell"] = sh
    # where default lights can go: under the ceiling at a point inside the room (an L's box centre is outside it)
    import building_io

    c = building_io.interior_point(outline)
    info["light_at"] = [c[0], c[1], scene_io.ceiling_at(sh, c[0], c[1])]
    info["fill_h"] = sh["height"]  # the lowest ceiling (the eaves): a fill light above it would be blocked
    return info
