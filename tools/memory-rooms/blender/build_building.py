"""building.json -> one .blend per level (+ the exterior), each ready for bake_export.py (CONTRACTS.md 6.4).

    blender.exe -b --factory-startup --python tools/memory-rooms/blender/build_building.py -- \
        --building <work>/building.json --out <work> [--level ground] [--scenes <dir>] [--samples 32] [--res 900]
        [--no-render]
    -> <work>/levels/<levelId>/room.blend (+ renders/three-quarter.png, top.png)
       <work>/exterior/room.blend (+ renders/three-quarter.png)
       <work>/build-report.json

Everything is in the PLAN frame with absolute height (Blender x = plan x, y = -plan z, z = up; a level sits at its
elevation), so a level's GLB drops straight into the building page.

A level:
  - its walls ONCE (`wall__<id>`, a wall between two rooms is one object), mitred at their junctions
    (building_mesh.py; a T or a cross gets a hub piece, part of its thickest wall), windows and doors from the
    building's openings (shell.py's joinery), skirting on each face that has a room; each wall carries
    `mrWall = {id, normal (its left normal, plan xz), exterior, rooms: {left, right}}` (glTF extras);
  - per room `floor__<room>` (its inner outline) and `ceiling__<room>` (flat, at its ceiling height);
    `floor__band` (the section under every wall) and `floor__slab` (the slab's sides and underside);
  - straight stairs `stair__<id>` on their `from` level;
  - every room's furnishing: the room's scene.json (a spot work folder whose shell is {building, room}) built by
    the kit and moved from the room frame into the plan frame, each piece its own top-level node renamed
    `room__<room>__obj__<id>` (the bake joins per top-level node, so a shared parent would merge a room into one);
  - the sky + sun outside (exterior walls lit) and a soft light under each room's ceiling.
The exterior: the roof (explicit `roof.parts`, else the roof level's exterior outline's bounding box) and the site
(ground lot, areas).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import building_io as B  # noqa: E402
import building_mesh as BM  # noqa: E402
import common  # noqa: E402
import polygon2d as P  # noqa: E402
from common import log  # noqa: E402

REPO = HERE.parents[2]
WORK = REPO / "memory-rooms-work"
WALL_COLOUR = "#ece7de"
SECTION = "#e8e2d6"


def parse():
    p = argparse.ArgumentParser(prog="build_building.py")
    p.add_argument("--building", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--id", default="", help="the building's id (default: the out folder's name after 'b-')")
    p.add_argument("--level", default="")
    p.add_argument("--scenes", default=str(WORK), help="where to look for room scenes (<dir>/*/scene.json)")
    p.add_argument("--samples", type=int, default=32)
    p.add_argument("--res", type=int, default=900)
    p.add_argument("--no-render", action="store_true")
    p.add_argument("--no-exterior", action="store_true")
    return common.script_args(p)


def bl(p, z=0.0):
    from mathutils import Vector

    return Vector((float(p[0]), -float(p[1]), float(z)))


def room_scenes(b, scenes_dir):
    """{roomId: (scene, work dir)} for every scene.json under scenes_dir whose shell is a room of this building."""
    out = {}
    root = Path(scenes_dir)
    if not root.exists():
        return out
    for f in sorted(root.glob("*/scene.json")):
        try:
            sc = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        sh = sc.get("shell") or {}
        if sh.get("building") == b.get("id") and sh.get("room"):
            out.setdefault(sh["room"], (sc, f.parent))
    return out


def wall_sides(b, level_id):
    """{wallId: {"left": roomId|None, "right": roomId|None}} (left/right looking from node a to node b)."""
    lines = {w["id"]: w for w in B.wall_lines(b, level_id)}
    sides = {wid: {"left": None, "right": None} for wid in lines}
    for r in b.get("rooms", []):
        if r["level"] != level_id:
            continue
        for e in B.room_edges(b, r):
            if not e["wall"] or e["wall"] not in lines:
                continue
            left = lines[e["wall"]]["left"]
            # the room's outward normal points from the room toward the wall: along `left` = the room is on the right
            side = "right" if e["out"][0] * left[0] + e["out"][1] * left[1] > 0 else "left"
            sides[e["wall"]][side] = r["id"]
    return sides


def build_level(b, level, coll, scenes, report):
    """Walls, floors, ceilings, stairs and furnishing of one level. Returns info for cameras / bake meta."""
    import bpy
    from mathutils import Vector

    import kit as kitmod
    import materials
    import shell as SH
    import shell_v2 as S2
    from mrgeo import MB

    lid = level["id"]
    elev = float(level.get("elevation", 0.0))
    style = b.get("style") or {}
    wcol = (style.get("walls") or {}).get("color") or WALL_COLOUR
    wmat = SH.wall_mat("paint", wcol)
    cmat = SH.section_mat(SECTION)
    glass = materials.get("glass", "#e2eef0", thin=True)
    metal = materials.get("brass", "#b89a5e")
    J = BM.junctions(b, lid)
    sides = wall_sides(b, lid)
    made = {"walls": [], "floors": [], "ceilings": [], "stairs": [], "rooms": [], "hubs": 0, "objects": 0}
    planes = []  # for bake_export's wall-backed split: each face a room looks at

    def link(mb, name, parent=None, bevel_w=0.0, segments=2):
        if not mb.faces:
            return None
        ob = mb.obj(name, coll, bevel_w=bevel_w, segments=segments)
        if parent is not None:
            ob.parent = parent
        return ob

    walls_by_id = {}
    for wid, line in J["lines"].items():
        fr = BM.wall_frame(line, J["walls"][wid])
        t = fr["thickness"]
        F = S2.PolyWallFrame({"id": wid, "length": fr["length"], "a": fr["a"], "b": fr["b"], "out": fr["out"]}, t, fr["ea"], fr["eb"])
        L = fr["length"]
        H = float(line["height"])
        holes = []
        for k, o in enumerate(B.wall_openings(b, wid)):
            a = max(0.0, min(L - 0.05, o["u0"] - fr["shift"]))
            bb = max(a + 0.05, min(L, o["u1"] - fr["shift"]))
            s = max(0.0, min(H - 0.05, o["sill"]))
            h = max(s + 0.05, min(H, o["head"]))
            holes.append({"index": k, "type": o["type"], "a": a, "b": bb, "s": s, "h": h, "spec": o["spec"]})
        name = f"wall__{wid}"
        wall = link(S2.wall_slab(F, H, holes, wmat, cmat), name)
        if wall is None:
            continue
        wall.location.z = elev
        rooms = sides[wid]
        wall["mrWall"] = {"id": wid, "normal": [round(line["left"][0], 6), round(line["left"][1], 6)],
                          "exterior": bool(line["exterior"]), "rooms": {"left": rooms["left"], "right": rooms["right"]}}
        walls_by_id[wid] = wall
        made["walls"].append(wid)
        # skirting on each face with a room (w = 0 is the right face, w = t the left)
        gaps = sorted((o["a"] - 0.07, o["b"] + 0.07) for o in holes if o["s"] < 0.1)
        segs, u = [], 0.0
        for g0, g1 in gaps:
            if g0 > u:
                segs.append((u, g0))
            u = max(u, g1)
        if u < L:
            segs.append((u, L))
        sk = MB()
        skm = SH.trim_mat(SH.TRIM)
        for u0, u1 in segs:
            if u1 - u0 <= 0.02:
                continue
            if rooms["right"]:
                F.wbox(sk, max(0.0, u0), min(L, u1), 0.0, 0.09, -0.014, 0.0, skm)
            if rooms["left"]:
                F.wbox(sk, max(0.0, u0), min(L, u1), 0.0, 0.09, t, t + 0.014, skm)
        link(sk, f"{name}__skirting", wall, bevel_w=0.004)
        th = MB()
        fmat_th = SH.floor_mat("timber", None)
        for o in holes:
            if o["s"] < 0.05:
                F.wbox(th, o["a"], o["b"], 0.0, 0.008, 0.0, t, fmat_th)
        link(th, f"{name}__threshold", wall, bevel_w=0.002, segments=1)
        for k, o in enumerate(holes):
            col = o["spec"].get("color", SH.TRIM)
            tm = SH.trim_mat(col)
            if o["type"] == "window":
                fr_mb, gl = SH._window(F, o, tm, glass, col)
                link(fr_mb, f"{name}__window{k}", wall, bevel_w=0.006)
                gob = link(gl, f"{name}__window{k}_glass", wall)
                if gob is not None:
                    gob.visible_shadow = False
            else:
                hinge_low = o["a"] <= L - o["b"]
                leaf_mat = materials.get("plaster", col)
                fr_mb, leaf, hw = SH._door(F, o, tm, leaf_mat, metal, hinge_low)
                link(fr_mb, f"{name}__door{k}_frame", wall, bevel_w=0.004)
                if leaf is not None:
                    for part in (link(leaf, f"{name}__door{k}_leaf", wall, bevel_w=0.004), link(hw, f"{name}__door{k}_handle", wall, bevel_w=0.003)):
                        if part is not None:
                            part.visible_shadow = False
        # the faces a room looks at, for the bake's wall-backed split
        right = [-line["left"][0], -line["left"][1]]
        if rooms["right"]:
            planes.append({"node": name, "point": fr["a"], "end": fr["b"], "out": list(line["left"])})
        if rooms["left"]:
            pa = [fr["a"][0] + line["left"][0] * t, fr["a"][1] + line["left"][1] * t]
            pb = [fr["b"][0] + line["left"][0] * t, fr["b"][1] + line["left"][1] * t]
            planes.append({"node": name, "point": pa, "end": pb, "out": right})

    # hubs: the junction polygons of T's and crosses, part of their thickest wall
    for k, hub in enumerate(J["hubs"]):
        owner = walls_by_id.get(hub["owner"])
        if owner is None:
            continue
        H = max(float(J["lines"][w]["height"]) for w in J["lines"] if hub["node"] in (J["lines"][w]["a"], J["lines"][w]["b"]))
        mb = MB()
        pts = hub["points"]
        top = [bl(p, H) for p in pts]
        bot = [bl(p, 0.0) for p in pts]
        for tri in S2.triangulate(pts):
            mb.poly([top[i] for i in tri], cmat, (0, 0, 1))
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            a, c = pts[i], pts[j]
            mb.poly([bot[i], bot[j], top[j], top[i]], wmat, (c[1] - a[1], c[0] - a[0], 0))
        link(mb, f"wall__{hub['owner']}__hub{k}", owner)
        made["hubs"] += 1

    # floors, the section band under the walls, the slab
    up = (0, 0, 1)
    rooms_here = [r for r in b.get("rooms", []) if r["level"] == lid]
    room_polys = {}
    for r in rooms_here:
        poly = B.room_inner_polygon(b, r)
        if P.signed_area(poly) < 0:
            poly = list(reversed(poly))
        room_polys[r["id"]] = poly
        fl = r.get("floor") or {}
        fmat = SH.floor_mat(fl.get("finish", "timber"), fl.get("color"))
        mb = MB()
        for tri in S2.triangulate(poly):
            mb.poly([bl(poly[i], 0.0) for i in tri], fmat, up)
        ob = link(mb, f"floor__{r['id']}")
        if ob is not None:
            ob.location.z = elev
            made["floors"].append(r["id"])
        # its ceiling: flat, seen from below, and a slab's thickness of top
        c = r.get("ceiling") or {}
        ch = float(c.get("height", level.get("height", 2.6)))
        cm = materials.get("plaster", c.get("color", "#f3efe6"))
        mb = MB()
        for tri in S2.triangulate(poly):
            lo = [bl(poly[i], ch) for i in tri]
            mb.poly(list(reversed(lo)), cm, (0, 0, -1))
            mb.poly([p + Vector((0, 0, SH.CEIL_T)) for p in lo], cm, up)
        ob = link(mb, f"ceiling__{r['id']}")
        if ob is not None:
            ob.location.z = elev
            made["ceilings"].append(r["id"])
    band = MB()
    for wid in made["walls"]:
        ends = J["walls"][wid]
        quad = [ends["a"]["right"], ends["b"]["right"], ends["b"]["left"], ends["a"]["left"]]
        if P.signed_area(quad) < 0:
            quad = list(reversed(quad))
        for tri in S2.triangulate(quad):
            band.poly([bl(quad[i], 0.0) for i in tri], cmat, up)
    for hub in J["hubs"]:
        for tri in S2.triangulate(hub["points"]):
            band.poly([bl(hub["points"][i], 0.0) for i in tri], cmat, up)
    ob = link(band, "floor__band")
    if ob is not None:
        ob.location.z = elev
    pm = SH.plinth_mat()
    slab = MB()
    for loop in B.exterior_loops(b, lid):
        ext_t = max((J["lines"][w]["thickness"] for w in J["lines"] if J["lines"][w]["exterior"]), default=0.2)
        ring = P.inset_polygon(loop, [-ext_t / 2] * len(loop), 1)
        n = len(ring)
        for i in range(n):
            a, c = ring[i], ring[(i + 1) % n]
            A, C = bl(a), bl(c)
            nrm = (c[1] - a[1], c[0] - a[0], 0)
            slab.poly([A + Vector((0, 0, -SH.FLOOR_T)), C + Vector((0, 0, -SH.FLOOR_T)), C, A], pm, nrm)
        for tri in S2.triangulate(ring):
            slab.poly([bl(ring[i], -SH.FLOOR_T) for i in reversed(tri)], pm, (0, 0, -1))
    ob = link(slab, "floor__slab")
    if ob is not None:
        ob.location.z = elev

    # stairs that start on this level
    tm = SH.floor_mat("timber", "#9a7652")
    for s in b.get("stairs", []):
        if s.get("from") != lid:
            continue
        info = B.stair_steps(b, s)
        n, rise = info["steps"], info["rise"]
        d = B.DIRS[s["dir"]]
        r = (-d[1], d[0])
        run = s["length"] / n
        h = s["width"] / 2
        mb = MB()
        x0, z0 = s["start"]
        for i in range(n):
            a0, a1 = i * run, (i + 1) * run
            top = (i + 1) * rise / n
            cs = [(x0 + d[0] * u + r[0] * v, z0 + d[1] * u + r[1] * v) for u, v in ((a0, -h), (a1, -h), (a1, h), (a0, h))]
            pts8 = [bl(p, 0.0) for p in cs] + [bl(p, top) for p in cs]
            mb.box8([pts8[0], pts8[1], pts8[2], pts8[3], pts8[4], pts8[5], pts8[6], pts8[7]], tm)
        ob = link(mb, f"stair__{s['id']}", bevel_w=0.003)
        if ob is not None:
            ob.location.z = elev
            made["stairs"].append(s["id"])

    # furnishing: each room's scene, in its room frame
    for r in rooms_here:
        if r["id"] not in scenes:
            continue
        sc, work = scenes[r["id"]]
        frame = B.room_frame(b, r)
        ox, oy, oz = frame["origin"]
        offset = bl((ox, oz), oy)
        ctx = kitmod.KitContext(scene=sc, work=Path(work), collection=coll)
        before = set(bpy.data.objects)
        for spec in sc.get("objects", []):
            try:
                root = kitmod.build_object(ctx, spec)
            except Exception as e:  # never abort a level for one piece
                report["warnings"].append(f"{r['id']}/{spec['id']}: {type(e).__name__}: {e}")
                root = kitmod.build_object(ctx, {**spec, "kit": "box"})
            if root is not None:
                # each piece stays its own top-level node (the bake joins per top-level node), moved from the
                # room frame into the plan frame
                root.location = root.location + offset
                made["objects"] += 1
        # names are global in Blender (two rooms may both have a `bed`): prefix this room's now
        for ob in set(bpy.data.objects) - before:
            if ob.name.startswith("obj__"):
                ob.name = f"room__{r['id']}__{ob.name}"
        made["rooms"].append(r["id"])

    # light: a soft area light under each room's ceiling (the sun and sky come from lighting.setup)
    for r in rooms_here:
        poly = room_polys.get(r["id"])
        if not poly:
            continue
        c = B.interior_point(poly)
        ch = float((r.get("ceiling") or {}).get("height", level.get("height", 2.6)))
        bb = P.bbox(poly)
        w = bb["max"][0] - bb["min"][0]
        dd = bb["max"][1] - bb["min"][1]
        ld = bpy.data.lights.new(f"light__{r['id']}", "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = max(0.4, w * 0.5), max(0.4, dd * 0.5)
        ld.energy = 14.0 * w * dd
        ld.color = (1.0, 0.95, 0.88)
        lob = bpy.data.objects.new(ld.name, ld)
        coll.objects.link(lob)
        lob.location = bl(c, elev + ch - 0.05)
        lob.visible_camera = False
        lob.visible_glossy = False

    return {"made": made, "planes": planes, "polys": room_polys, "elev": elev}


def roof_mesh(b, coll):
    """The roof: explicit parts, else the roof level's exterior outline's bounding box (rectangles only)."""
    import materials
    from mrgeo import MB

    roof = b.get("roof") or {}
    lvl = B.roof_level(b)
    if not lvl:
        return None
    base = float(lvl.get("elevation", 0.0)) + float(lvl.get("height", 2.6))
    parts = roof.get("parts")
    if not parts:
        loops = B.exterior_loops(b, lvl["id"])
        if not loops:
            return None
        pts = [p for loop in loops for p in loop]
        bb = P.bbox(pts)
        parts = [{"outline": [[bb["min"][0], bb["min"][1]], [bb["max"][0], bb["min"][1]], [bb["max"][0], bb["max"][1]], [bb["min"][0], bb["max"][1]]], "type": roof.get("type", "gable")}]
    mat = materials.get("tile" if roof.get("finish") == "tile" else "plaster", roof.get("color", "#8a5a44"))
    mb = MB()
    over = float(roof.get("overhang", 0.4))
    for part in parts:
        typ = part.get("type", roof.get("type", "gable"))
        pitch = math.radians(float(part.get("pitch", roof.get("pitch", 25))))
        z0 = base
        if part.get("level"):
            pl = B.level_by_id(b, part["level"])
            if pl:
                z0 = float(pl.get("elevation", 0.0)) + float(pl.get("height", 2.6))
        bb = P.bbox(part["outline"])
        x0, x1 = bb["min"][0] - over, bb["max"][0] + over
        q0, q1 = bb["min"][1] - over, bb["max"][1] + over
        w, d = x1 - x0, q1 - q0
        # corners in Blender (plan z -> -y)
        A, Bc, C, D = bl((x0, q0), z0), bl((x1, q0), z0), bl((x1, q1), z0), bl((x0, q1), z0)
        if typ == "flat":
            mb.poly([A, Bc, C, D], mat, (0, 0, 1))
            continue
        if typ == "skillion":
            low = part.get("low", "south")
            rise = math.tan(pitch) * (d if low in ("north", "south") else w)
            lift = {"north": (0, 0, rise, rise), "south": (rise, rise, 0, 0), "west": (0, rise, rise, 0), "east": (rise, 0, 0, rise)}[low]
            pts = [p.copy() for p in (A, Bc, C, D)]
            for p, dz in zip(pts, lift):
                p.z += dz
            mb.poly(pts, mat, (0, 0, 1))
            continue
        along_x = w >= d  # ridge along the longer side
        half = (d if along_x else w) / 2
        peak = z0 + math.tan(pitch) * half
        if along_x:
            qm = (q0 + q1) / 2
            inset = half if typ == "hip" else 0.0
            R0, R1 = bl((x0 + inset, qm), peak), bl((x1 - inset, qm), peak)
            mb.poly([A, Bc, R1, R0], mat, (0, 1, 1))     # north slope
            mb.poly([C, D, R0, R1], mat, (0, -1, 1))     # south slope
            if typ == "hip":
                mb.poly([D, A, R0], mat, (-1, 0, 1))
                mb.poly([Bc, C, R1], mat, (1, 0, 1))
            else:
                mb.poly([D, A, R0], mat, (-1, 0, 0))     # gable ends (vertical triangles)
                mb.poly([Bc, C, R1], mat, (1, 0, 0))
        else:
            xm = (x0 + x1) / 2
            inset = half if typ == "hip" else 0.0
            R0, R1 = bl((xm, q0 + inset), peak), bl((xm, q1 - inset), peak)
            mb.poly([D, A, R0, R1], mat, (-1, 0, 1))
            mb.poly([Bc, C, R1, R0], mat, (1, 0, 1))
            if typ == "hip":
                mb.poly([A, Bc, R0], mat, (0, 1, 1))
                mb.poly([C, D, R1], mat, (0, -1, 1))
            else:
                mb.poly([A, Bc, R0], mat, (0, 1, 0))
                mb.poly([C, D, R1], mat, (0, -1, 0))
    return mb.obj("roof", coll, bevel_w=0.0) if mb.faces else None


def site_mesh(b, coll):
    import materials  # noqa: F401
    import shell as SH
    from mrgeo import MB

    site = b.get("site") or {}
    made = []
    lot = site.get("lot")
    if lot:
        g = site.get("ground") or {}
        gm = SH.ground_mat(g.get("finish", "grass"), g.get("color"))
        mb = MB()
        poly = lot if P.signed_area(lot) > 0 else list(reversed(lot))
        for tri in __import__("shell_v2").triangulate(poly):
            mb.poly([bl(poly[i], -0.13) for i in tri], gm, (0, 0, 1))
        made.append(mb.obj("ground", coll))
    for a in site.get("areas", []):
        poly = a["outline"] if P.signed_area(a["outline"]) > 0 else list(reversed(a["outline"]))
        finish = {"drive": "concrete", "path": "paving", "deck": "timber", "lawn": "grass", "pool": "concrete"}.get(a.get("kind"), "paving")
        mat = SH.ground_mat(finish, a.get("color"))
        mb = MB()
        for tri in __import__("shell_v2").triangulate(poly):
            mb.poly([bl(poly[i], -0.12 if a.get("kind") != "deck" else 0.0) for i in tri], mat, (0, 0, 1))
        made.append(mb.obj(f"site__{a['id']}", coll))
    return made


def main():
    args = parse()
    t_all = time.perf_counter()
    try:
        b = B.load_building(args.building)
    except B.BuildingError as e:
        print(str(e), flush=True)
        sys.exit(1)

    import bpy

    import build_room as BR
    import lighting
    import materials
    import mrgeo

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    # building.json has no id of its own: the row's id names the work folder (memory-rooms-work/b-<id>)
    b["id"] = args.id or (out.name[2:] if out.name.startswith("b-") else b.get("id"))
    scenes = room_scenes(b, args.scenes)
    log("room scenes", sorted(scenes))
    report = {"building": b.get("id"), "levels": {}, "exterior": None, "warnings": [], "roomScenes": sorted(scenes)}
    levels = [lv for lv in b.get("levels", []) if not args.level or lv["id"] == args.level]
    mood = (b.get("style") or {}).get("mood", "day")

    for level in levels:
        t0 = time.perf_counter()
        lid = level["id"]
        bl_scene = common.reset_scene()
        common.set_render(bl_scene, samples=args.samples)
        common.enable_gpu(bl_scene)
        problems: list = []
        mrgeo.install_material_guard(materials, problems)
        lighting.path_settings(bl_scene)
        look = lighting.apply_look(bl_scene)
        coll = bpy.data.collections.new("room")
        bl_scene.collection.children.link(coll)
        cams = bpy.data.collections.new("cameras")
        bl_scene.collection.children.link(cams)

        built = build_level(b, level, coll, scenes, report)
        # the sun and the sky (the exterior walls' outer faces get daylight too)
        info = {"W": 1, "D": 1, "H": 1, "t": 0.12, "windows": [], "bounds": ((0, 0, 0), (1, 1, 1))}
        light_rep = lighting.setup({"kind": "exterior", "style": {"mood": mood}, "lights": [{"type": "sun"}]}, bl_scene, info, {}, {})

        # framing: the level's walls + floors
        from mathutils import Vector

        pts = []
        for ob in coll.objects:
            if ob.type == "MESH":
                pts.extend(ob.matrix_world @ Vector(c) for c in ob.bound_box)
        if not pts:
            report["warnings"].append(f"level {lid}: nothing built")
            continue
        xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        ext = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.08
        top = BR.make_camera(cams, "top", (cx, cy, max(zs) + 30), (cx, cy, built["elev"]), ortho_scale=ext)
        top.data.clip_end = max(zs) + 80
        pos, center, shift = BR.fit_perspective(pts, 135, 38, 34, 4 / 3)
        tq = BR.make_camera(cams, "three-quarter", pos, center, 34)
        tq.data.shift_x, tq.data.shift_y = shift
        # dollhouse: every ceiling, and the exterior walls whose outward side faces the camera
        hide = [f"ceiling__{rid}" for rid in built["made"]["ceilings"]]
        cam_dir = Vector((pos[0] - cx, pos[1] - cy, 0)).normalized()
        for wid in built["made"]["walls"]:
            ob = bpy.data.objects.get(f"wall__{wid}")
            mw = ob["mrWall"] if ob else None
            if not mw or not mw.get("exterior"):
                continue
            n = mw["normal"]
            # its outside: the left normal when the room is on the right, else the other way
            out_n = (n[0], n[1]) if mw["rooms"]["right"] and not mw["rooms"]["left"] else (-n[0], -n[1])
            if Vector((out_n[0], -out_n[1], 0)).dot(cam_dir) > 0.18:
                hide.append(f"wall__{wid}")
        tq["mr_hide"] = ",".join(hide)

        lv_dir = out / "levels" / lid
        (lv_dir / "renders").mkdir(parents=True, exist_ok=True)
        BR.set_hidden(hide, True)
        bl_scene.render.film_transparent = True
        bl_scene.render.resolution_x, bl_scene.render.resolution_y = BR.res_for(4 / 3, args.res)
        exp_rep = lighting.auto_exposure(bl_scene, tq, lv_dir / "renders", {"style": {"mood": mood}})
        BR.set_hidden(hide, False)

        meta = {"kind": "interior", "building": b.get("id"), "level": lid,
                "info": {"W": max(xs) - min(xs), "D": max(ys) - min(ys), "H": max(zs) - built["elev"], "t": 0.12,
                         "bounds": ((min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))), "v2": True,
                         "wall_planes": built["planes"], "wall_normals": {}},
                "three_quarter": {"hide": hide, "how": "auto azimuth 135"}, "exposure": exp_rep, "mood": mood, "look": look}
        bl_scene["mr_meta"] = json.dumps(meta)
        bl_scene.camera = tq
        txt = bpy.data.texts.new("building.json")
        txt.write(json.dumps(b, indent=1))
        bpy.ops.wm.save_as_mainfile(filepath=str(lv_dir / "room.blend"), compress=True)
        if not args.no_render:
            for name, cam, aspect, hidden in (("three-quarter", tq, 4 / 3, hide), ("top", top, max(0.75, min(1.6, (max(xs) - min(xs)) / max(1e-3, max(ys) - min(ys)))), [f"ceiling__{r}" for r in built["made"]["ceilings"]])):
                BR.set_hidden(hidden, True)
                bl_scene.render.film_transparent = True
                bl_scene.render.resolution_x, bl_scene.render.resolution_y = BR.res_for(aspect, args.res)
                common.render_to(bl_scene, cam, lv_dir / "renders" / f"{name}.png")
                BR.set_hidden(hidden, False)
        report["levels"][lid] = {**{k: v for k, v in built["made"].items()}, "seconds": round(time.perf_counter() - t0, 1),
                                 "materialProblems": problems, "sun": light_rep.get("sun_az")}
        log("level", lid, json.dumps(report["levels"][lid]))

    if not args.no_exterior and not args.level:
        t0 = time.perf_counter()
        bl_scene = common.reset_scene()
        common.set_render(bl_scene, samples=args.samples)
        common.enable_gpu(bl_scene)
        lighting.path_settings(bl_scene)
        look = lighting.apply_look(bl_scene)
        coll = bpy.data.collections.new("room")
        bl_scene.collection.children.link(coll)
        cams = bpy.data.collections.new("cameras")
        bl_scene.collection.children.link(cams)
        roof = roof_mesh(b, coll)
        site = site_mesh(b, coll)
        lighting.setup({"kind": "exterior", "style": {"mood": mood}, "lights": [{"type": "sun"}]}, bl_scene,
                       {"W": 1, "D": 1, "H": 1, "t": 0.12, "windows": [], "bounds": ((0, 0, 0), (1, 1, 1))}, {}, {})
        from mathutils import Vector

        pts = [ob.matrix_world @ Vector(c) for ob in coll.objects if ob.type == "MESH" for c in ob.bound_box]
        ex_dir = out / "exterior"
        (ex_dir / "renders").mkdir(parents=True, exist_ok=True)
        if pts:
            pos, center, shift = BR.fit_perspective(pts, 210, 32, 34, 4 / 3)
            tq = BR.make_camera(cams, "three-quarter", pos, center, 34)
            tq.data.shift_x, tq.data.shift_y = shift
            bl_scene.camera = tq
            # measure the house, not the dark sky behind it
            bl_scene.render.film_transparent = True
            bl_scene.render.resolution_x, bl_scene.render.resolution_y = BR.res_for(4 / 3, args.res)
            exp_rep = lighting.auto_exposure(bl_scene, tq, ex_dir / "renders", {"style": {"mood": mood}})
            meta = {"kind": "exterior", "building": b.get("id"), "info": {}, "three_quarter": {"hide": [], "how": "auto azimuth 210"},
                    "exposure": exp_rep, "mood": mood, "look": look}
            bl_scene["mr_meta"] = json.dumps(meta)
            bpy.ops.wm.save_as_mainfile(filepath=str(ex_dir / "room.blend"), compress=True)
            if not args.no_render:
                bl_scene.render.film_transparent = True
                bl_scene.render.resolution_x, bl_scene.render.resolution_y = BR.res_for(4 / 3, args.res)
                common.render_to(bl_scene, tq, ex_dir / "renders" / "three-quarter.png")
        report["exterior"] = {"roof": roof.name if roof else None, "site": [o.name for o in site], "seconds": round(time.perf_counter() - t0, 1)}

    report["seconds"] = round(time.perf_counter() - t_all, 1)
    (out / "build-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    log("done", json.dumps({k: report[k] for k in ("seconds",)}))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(2)
