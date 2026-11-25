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


def room_scenes(b, scenes_dir, every=False):
    """{roomId: (scene, work dir)} for every scene.json under scenes_dir whose shell is a room of this building (the
    first per room furnishes it); every=True: {roomId: [(scene, work dir), ...]} (each gets the room's slice)."""
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
            if every:
                out.setdefault(sh["room"], []).append((sc, f.parent))
            else:
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


# a wall's `outside.finish` (building.json) -> the wall helper's finish for its outer face
OUTSIDE_FINISH = {"render": "paint", "paint": "paint", "brick": "brick", "weatherboard": "timber", "timber": "timber",
                  "stone": "plaster", "concrete": "concrete", "metal": "concrete"}
FASCIA = 0.24          # depth of the dark band round each roof part's edge
FASCIA_COLOUR = "#2a2b2d"


def outside_mat(SH, spec):
    """The outer-face material of a wall with `outside`, else None (the face keeps the wall colour)."""
    o = spec.get("outside") or {}
    if not o:
        return None
    return SH.wall_mat(OUTSIDE_FINISH.get(o.get("finish"), "paint"), o.get("color"))


def is_outside(b, room_id):
    """A wall face looks outside when no room is on that side or the room there is an outdoor one."""
    if not room_id:
        return True
    r = next((r for r in b.get("rooms", []) if r["id"] == room_id), None)
    return bool(r) and r.get("kind") == "outdoor"


def roof_parts(b):
    """The roof's parts exactly as roof_mesh builds them: [{part, typ, level, z0, pitch, over, x0, x1, q0, q1}]
    (x0..x1, q0..q1 = the part's bbox grown by the overhang; z0 = its eaves, absolute)."""
    roof = b.get("roof") or {}
    lvl = B.roof_level(b)
    if not lvl:
        return []
    parts = roof.get("parts")
    if not parts:
        loops = B.exterior_loops(b, lvl["id"])
        if not loops:
            return []
        pts = [p for loop in loops for p in loop]
        bb = P.bbox(pts)
        parts = [{"outline": [[bb["min"][0], bb["min"][1]], [bb["max"][0], bb["min"][1]], [bb["max"][0], bb["max"][1]], [bb["min"][0], bb["max"][1]]], "type": roof.get("type", "gable")}]
    over = float(roof.get("overhang", 0.4))
    out = []
    for part in parts:
        pl = B.level_by_id(b, part["level"]) if part.get("level") else lvl
        pl = pl or lvl
        z0 = float(pl.get("elevation", 0.0)) + float(pl.get("height", 2.6))
        bb = P.bbox(part["outline"])
        out.append({"part": part, "typ": part.get("type", roof.get("type", "gable")), "level": pl["id"], "z0": z0,
                    "low": part.get("low", roof.get("low", "south")),
                    "pitch": math.radians(float(part.get("pitch", roof.get("pitch", 25)))), "over": over,
                    "x0": bb["min"][0] - over, "x1": bb["max"][0] + over, "q0": bb["min"][1] - over, "q1": bb["max"][1] + over,
                    "bb": bb})
    return out


def skillion_height(rp, x, q):
    """Absolute height of a skillion part's plane over plan (x, q)."""
    d = {"west": x - rp["x0"], "east": rp["x1"] - x, "north": q - rp["q0"], "south": rp["q1"] - q}[rp["low"]]
    return rp["z0"] + math.tan(rp["pitch"]) * d


def clip_to_skillion(ob, rp, elev, cap_mat):
    """Cut a wall object (mesh in plan-world X = x, Y = -q, z relative to elev) to a skillion part's plane: the part
    above it is removed and the cut capped with cap_mat. No-op when the plane is above the whole wall."""
    import bmesh
    from mathutils import Vector

    k = math.tan(rp["pitch"])
    # z_local = c + gx * X + gy * Y  (Y = -q)
    c = rp["z0"] - elev
    gx = gy = 0.0
    if rp["low"] == "west":
        c, gx = c - k * rp["x0"], k
    elif rp["low"] == "east":
        c, gx = c + k * rp["x1"], -k
    elif rp["low"] == "north":
        c, gy = c - k * rp["q0"], -k
    else:  # south
        c, gy = c + k * rp["q1"], k
    me = ob.data
    if all(v.co.z <= c + gx * v.co.x + gy * v.co.y + 1e-4 for v in me.vertices):
        return False
    if cap_mat.name not in [m.name for m in me.materials if m]:
        me.materials.append(cap_mat)
    cap_idx = [m.name if m else "" for m in me.materials].index(cap_mat.name)
    bm = bmesh.new()
    bm.from_mesh(me)
    co = Vector((0.0, 0.0, c))
    no = Vector((-gx, -gy, 1.0)).normalized()
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no,
                                 clear_outer=True)
    cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    if cut:
        filled = bmesh.ops.holes_fill(bm, edges=cut, sides=0)
        for f in filled["faces"]:
            f.material_index = cap_idx
    bm.to_mesh(me)
    bm.free()
    me.update()
    return True


def rake_part_for(rparts, level_id, line):
    """The skillion part over a wall (its midpoint inside the part's outline bbox, a few cm of slack), else None."""
    mx, mq = (line["pa"][0] + line["pb"][0]) / 2, (line["pa"][1] + line["pb"][1]) / 2
    for rp in rparts:
        if rp["typ"] != "skillion" or rp["level"] != level_id:
            continue
        bb = rp["bb"]
        if bb["min"][0] - 0.05 <= mx <= bb["max"][0] + 0.05 and bb["min"][1] - 0.05 <= mq <= bb["max"][1] + 0.05:
            return rp
    return None


def common_mix(a, b, t):
    from mrgeo import mix

    return mix(a, b, t)


STAIR_WAIST = 0.15      # a solid flight's slab under the inner corners of its steps
STAIR_WALL_T = 0.19     # raking side walls: thickness, and height above the nosings
STAIR_WALL_H = 1.0
STAIR_WALL_COLOUR = "#f2f1ec"
STEEL_SPINE = "#1c1d20"     # finish steel: the floating stair's centre spine + brackets
STEEL_SPINE_W = 0.14
STEEL_SPINE_D = 0.24        # its depth square to the pitch
STEEL_TREAD_T = 0.085       # timber treads (a colour given); plates are 0.04
STEEL_GAP = 0.05            # the spine's top under the treads


def build_stair(b, s, level, coll, link, made, report):
    """One straight flight on its `from` level (object `stair__<id>`, level-local heights; the caller's level sits at
    its elevation). finish timber (default): stepped blocks down to the floor, as before. tile / concrete: a solid
    flight with a sloping soffit (WAIST under the inner corners), treads and risers in `color`, the soffit and sides
    rendered; steel: a floating stair (treads in `color`, timber, on one charcoal centre spine with a bracket per tread;
    charcoal plates when no colour), open underneath. `walls` adds solid raking side walls (STAIR_WALL_T thick,
    STAIR_WALL_H above the nosings, left / right looking up the flight): from the ground where they stand outside
    the level's exterior loop, from the flight's underside where they pass over its rooms (a bulkhead inside). Walls (and ceilings) of this
    level inside the flight's footprint are then cut down to its underside (a boolean inside the footprint only)."""
    import bpy
    from mathutils import Vector

    import materials
    import shell as SH
    import shell_v2 as S2
    from mrgeo import MB

    lid = level["id"]
    elev = float(level.get("elevation", 0.0))
    info = B.stair_steps(b, s)
    n, rise = int(info["steps"]), float(info["rise"])
    d = B.DIRS[s["dir"]]
    r = (-d[1], d[0])           # the climber's right
    L = float(s["length"])
    h = float(s["width"]) / 2
    x0, z0 = s["start"]
    finish = s.get("finish", "timber")

    def P3(u, v, hh):
        return bl((x0 + d[0] * u + r[0] * v, z0 + d[1] * u + r[1] * v), hh)

    mb = MB()
    rr = rise / n
    if finish == "timber":
        # unchanged look: n blocks of run L / n, each down to the floor
        tm = SH.floor_mat("timber", s.get("color") or "#9a7652")
        run = L / n
        for i in range(n):
            a0, a1, top = i * run, (i + 1) * run, (i + 1) * rr
            cs = [(a0, -h), (a1, -h), (a1, h), (a0, h)]
            mb.box8([P3(u, v, 0.0) for u, v in cs] + [P3(u, v, top) for u, v in cs], tm)
        soffit = lambda u: 0.0  # noqa: E731  (blocks reach the floor: nothing passes under)
        bevel_w = 0.003
    else:
        # the schema's flight: steps - 1 treads of going g between the first riser (u = 0) and the last (u = L)
        g = L / max(1, n - 1)
        slope = rr / g
        wv = STAIR_WAIST * math.sqrt(1 + slope * slope)
        soffit = lambda u: u * slope - wv  # noqa: E731  (level-local height of the underside)
        col = s.get("color") or {"tile": "#5a5c5f", "concrete": "#a19d96", "steel": "#2a2b2d"}.get(finish, "#8a8a8a")
        tread_mat = SH.floor_mat("tile" if finish == "tile" else "concrete", col) if finish != "steel" else materials.get("metal", col)
        under_mat = SH.wall_mat("paint", s.get("wallColor") or STAIR_WALL_COLOUR)
        if finish == "steel":
            # a floating stair (2026-11-23, 12B Fletcher's foyer): thick treads (timber in `color`; charcoal steel
            # plates when no colour is given) on ONE centre spine (a charcoal box section along the pitch) with a
            # winged bracket under each tread. Open underneath: nothing is cut (see below).
            spine_mat = materials.get("metal", STEEL_SPINE)
            if s.get("color"):
                tread_mat = SH.floor_mat("timber", s["color"])
            tt = STEEL_TREAD_T if s.get("color") else 0.04
            for k in range(n - 1):
                top = (k + 1) * rr
                cs = [(k * g - 0.02, -h), ((k + 1) * g + 0.02, -h), ((k + 1) * g + 0.02, h), (k * g - 0.02, h)]
                mb.box8([P3(u, v, top - tt) for u, v in cs] + [P3(u, v, top) for u, v in cs], tread_mat)
            # the spine: its top runs STEEL_GAP under the treads' undersides (the nosing line - tt - gap)
            sw, sd = STEEL_SPINE_W / 2, STEEL_SPINE_D * math.sqrt(1 + slope * slope)
            stop = lambda u: rr + u * slope - tt - STEEL_GAP  # noqa: E731
            ua = max(-0.3, (tt + STEEL_GAP - rr) / slope)          # where its top meets the floor
            u1 = min(L, ua + sd / slope)                          # where its underside leaves the floor
            prof = [(ua, 0.0), (u1, 0.0), (L, stop(L) - sd), (L, stop(L))]
            mb.box8([P3(u, -sw, z) for u, z in prof] + [P3(u, sw, z) for u, z in prof], spine_mat)
            # a bracket under each tread: narrow on the spine, winging out to ~70 % of the width under the tread
            for k in range(n - 1):
                ub0, ub1 = k * g + 0.06, (k + 1) * g - 0.04
                if ub1 <= ub0:
                    continue
                zt = (k + 1) * rr - tt
                bw = h * 0.7
                lo = [(ub0, -sw, stop(ub0)), (ub1, -sw, stop(ub1)), (ub1, sw, stop(ub1)), (ub0, sw, stop(ub0))]
                hi_ = [(ub0, -bw, zt), (ub1, -bw, zt), (ub1, bw, zt), (ub0, bw, zt)]
                mb.box8([P3(u, v, z) for u, v, z in lo] + [P3(u, v, z) for u, v, z in hi_], spine_mat)
            soffit = lambda u: max(0.0, stop(u) - sd)  # noqa: E731
        else:
            # the profile in (u, height): up the steps, then down the soffit to the ground
            prof = [(0.0, 0.0)]
            for k in range(n - 1):
                prof += [(k * g, (k + 1) * rr), ((k + 1) * g, (k + 1) * rr)]
            prof.append((L, rise))
            prof.append((L, max(0.0, soffit(L))))
            u0 = min(L, max(0.0, wv / slope))
            if u0 > 1e-4:
                prof.append((u0, 0.0))
            # clean consecutive duplicates
            clean = []
            for p in prof:
                if not clean or abs(clean[-1][0] - p[0]) > 1e-6 or abs(clean[-1][1] - p[1]) > 1e-6:
                    clean.append(p)
            prof = clean
            area2 = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1] for i in range(len(prof)))
            if area2 < 0:
                prof = list(reversed(prof))
            m = len(prof)
            side_mat = under_mat
            for v, sg in ((-h, -1), (h, 1)):
                for tri in S2.triangulate(prof):
                    mb.poly([P3(prof[i][0], v, prof[i][1]) for i in tri], side_mat, (sg * r[0], -sg * r[1], 0))
            for i in range(m):
                (ua, ha), (ub, hb) = prof[i], prof[(i + 1) % m]
                horiz, vert = abs(hb - ha) < 1e-6, abs(ub - ua) < 1e-6
                # treads (horizontal, above the ground) and risers (vertical, not the soffit's back end) are tiled
                is_tread = horiz and ha > 1e-6
                is_riser = vert and not (ua >= L - 1e-6 and min(ha, hb) < rise - rr - 1e-6)
                mat = tread_mat if (is_tread or is_riser) else under_mat
                du, dh = ub - ua, hb - ha  # CCW profile: outward normal (dh, -du) in (u, height)
                mb.poly([P3(ua, -h, ha), P3(ub, -h, hb), P3(ub, h, hb), P3(ua, h, ha)], mat, (d[0] * dh, -d[1] * dh, -du))
        bevel_w = 0.0
    ob = link(mb, f"stair__{s['id']}", bevel_w=bevel_w)
    if ob is None:
        return None
    ob.location.z = elev

    # raking side walls
    sides = {"left": [-1], "right": [1], "both": [-1, 1]}.get(s.get("walls", "none"), [])
    if sides:
        wm = SH.wall_mat("paint", s.get("wallColor") or STAIR_WALL_COLOUR)
        loops = B.exterior_loops(b, lid)
        top = lambda u: rr + u * (rise - rr) / L + STAIR_WALL_H  # noqa: E731  (the nosing line + the wall height)
        wmb = MB()
        for sg in sides:
            vc = sg * (h + STAIR_WALL_T / 2)
            inside = lambda u: any(P.point_in_polygon((x0 + d[0] * u + r[0] * vc, z0 + d[1] * u + r[1] * vc), lp) for lp in loops)  # noqa: E731
            # cut u at every change of inside / outside (5 cm steps, then bisection)
            cuts, step = [0.0], 0.05
            u = step
            while u < L - 1e-9:
                if inside(u) != inside(u - step):
                    lo, hi = u - step, u
                    for _ in range(20):
                        mid = (lo + hi) / 2
                        if inside(mid) == inside(lo):
                            lo = mid
                        else:
                            hi = mid
                    cuts.append((lo + hi) / 2)
                u += step
            cuts.append(L)
            for ua, ub in zip(cuts, cuts[1:]):
                if ub - ua < 1e-3:
                    continue
                # outside: down to the ground; over a room: down to the flight's underside (a bulkhead inside it)
                over = inside((ua + ub) / 2)
                ba, bb = (max(0.0, soffit(ua)), max(0.0, soffit(ub))) if over else (0.0, 0.0)
                v0, v1 = vc - STAIR_WALL_T / 2, vc + STAIR_WALL_T / 2
                wmb.box8([P3(ua, v0, ba), P3(ub, v0, bb), P3(ub, v1, bb), P3(ua, v1, ba),
                          P3(ua, v0, top(ua)), P3(ub, v0, top(ub)), P3(ub, v1, top(ub)), P3(ua, v1, top(ua))], wm)
        wob = link(wmb, f"stair__{s['id']}__walls")
        if wob is not None:
            wob.location.z = elev

    # cut this level's walls (and ceilings) inside the footprint down to the flight's underside
    if finish not in ("timber", "steel"):  # a floating (steel) flight is open underneath
        cutter_mb = MB()
        e = 0.002
        bot0, bot1 = max(0.0, soffit(0.0)), soffit(L)
        hi = 40.0
        cutter_mb.box8([P3(-e, -h, bot0 - e), P3(L + e, -h, bot1), P3(L + e, h, bot1), P3(-e, h, bot0 - e),
                        P3(-e, -h, hi), P3(L + e, -h, hi), P3(L + e, h, hi), P3(-e, h, hi)], None)
        cutter = cutter_mb.obj(f"cutter__{s['id']}", coll, uv=False)
        cutter.location.z = elev
        bpy.context.view_layer.update()
        fx = [x0 - r[0] * h, x0 + r[0] * h, x0 + d[0] * L - r[0] * h, x0 + d[0] * L + r[0] * h]
        fz = [z0 - r[1] * h, z0 + r[1] * h, z0 + d[1] * L - r[1] * h, z0 + d[1] * L + r[1] * h]
        xmin, xmax, ymin, ymax = min(fx), max(fx), -max(fz), -min(fz)
        lowest = elev + min(bot0, bot1)
        cut = []
        for o2 in list(coll.objects):
            if o2.type != "MESH" or o2 is cutter or not (o2.name.startswith("wall__") or o2.name.startswith("ceiling__")):
                continue
            bb = [o2.matrix_world @ Vector(c) for c in o2.bound_box]
            if (min(p.x for p in bb) > xmax - 0.01 or max(p.x for p in bb) < xmin + 0.01 or min(p.y for p in bb) > ymax - 0.01
                    or max(p.y for p in bb) < ymin + 0.01 or max(p.z for p in bb) < lowest + 0.01):
                continue
            mod = o2.modifiers.new("stair_cut", "BOOLEAN")
            mod.operation, mod.object, mod.solver = "DIFFERENCE", cutter, "EXACT"
            dg = bpy.context.evaluated_depsgraph_get()
            me = bpy.data.meshes.new_from_object(o2.evaluated_get(dg))
            o2.modifiers.clear()
            old = o2.data
            o2.data = me
            if old.users == 0:
                bpy.data.meshes.remove(old)
            cut.append(o2.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        made.setdefault("stairCuts", {})[s["id"]] = cut
    return ob


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
    rparts = roof_parts(b)
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
    for wid, line0 in J["lines"].items():
        rooms = sides[wid]
        ends0 = J["walls"][wid]
        flip = bool(rooms["left"]) and not rooms["right"]
        if flip:
            line = {**line0, "pa": line0["pb"], "pb": line0["pa"], "a": line0["b"], "b": line0["a"],
                    "dir": [-line0["dir"][0], -line0["dir"][1]], "left": [-line0["left"][0], -line0["left"][1]]}
            ends = {"a": {"left": ends0["b"]["right"], "right": ends0["b"]["left"]},
                    "b": {"left": ends0["a"]["right"], "right": ends0["a"]["left"]}}
            rooms = {"left": rooms["right"], "right": rooms["left"]}
        else:
            line, ends = line0, ends0
        fr = BM.wall_frame(line, ends)
        t = fr["thickness"]
        F = S2.PolyWallFrame({"id": wid, "length": fr["length"], "a": fr["a"], "b": fr["b"], "out": fr["out"]}, t, fr["ea"], fr["eb"])
        L = fr["length"]
        H = float(line["height"])
        holes = []
        for k, o in enumerate(B.wall_openings(b, wid)):
            u0, u1 = (line0["length"] - o["u1"], line0["length"] - o["u0"]) if flip else (o["u0"], o["u1"])
            a = max(0.0, min(L - 0.05, u0 - fr["shift"]))
            bb = max(a + 0.05, min(L, u1 - fr["shift"]))
            s = max(0.0, min(H - 0.05, o["sill"]))
            h = max(s + 0.05, min(H, o["head"]))
            holes.append({"index": k, "type": o["type"], "a": a, "b": bb, "s": s, "h": h, "spec": o["spec"]})
        name = f"wall__{wid}"
        # an exterior wall's outside finish goes on the face(s) that look outside (w = 0 is the right face)
        omat_ext = outside_mat(SH, line0.get("spec") or {}) if line0["exterior"] or (line0.get("spec") or {}).get("outside") else None
        f_in = omat_ext if omat_ext is not None and is_outside(b, rooms["right"]) else None
        f_out = omat_ext if omat_ext is not None and is_outside(b, rooms["left"]) else None
        # cladding panels (outside.panels): face-only bands on the faces that look outside
        osp = (line0.get("spec") or {}).get("outside") or {}
        bands = []
        for pnl in osp.get("panels") or []:
            p0, p1 = float(pnl["offset"]), float(pnl["offset"]) + float(pnl["width"])
            at_a, at_b = p0 <= 1e-3, p1 >= line0["length"] - 1e-3
            if flip:
                p0, p1, at_a, at_b = line0["length"] - p1, line0["length"] - p0, at_b, at_a
            a_ = 0.0 if at_a else max(0.0, min(L, p0 - fr["shift"]))
            b_ = L if at_b else max(0.0, min(L, p1 - fr["shift"]))
            s_ = max(0.0, min(H, float(pnl.get("sill", 0.0))))
            h_ = min(H, s_ + float(pnl["height"])) if "height" in pnl else H
            if b_ - a_ > 0.005 and h_ - s_ > 0.005 and (f_in is not None or f_out is not None):
                pmat = SH.wall_mat(OUTSIDE_FINISH.get(pnl.get("finish"), "paint"), pnl.get("color"))
                bands.append({"a": a_, "b": b_, "s": s_, "h": h_, "imat": pmat if f_in is not None else None,
                              "omat": pmat if f_out is not None else None})
        wall = link(S2.wall_slab(F, H, holes, wmat, cmat, imat=f_in, omat=f_out, bands=bands), name)
        if wall is None:
            continue
        wall.location.z = elev
        # under a skillion part, a full-height wall rises to the roof plane (a raking top) instead of stopping at
        # the level's height and leaving a wedge of sky under the roof
        # (only walls on the building's skin: inside walls stop at the flat ceilings)
        skin = line0["exterior"] or is_outside(b, rooms["left"]) or is_outside(b, rooms["right"])
        rp = rake_part_for(rparts, lid, line0) if skin and H >= float(level.get("height", 2.6)) - 1e-6 else None
        if H > float(level.get("height", 2.6)) + 1e-6:
            # a wall TALLER than its level (a clerestory band over a stacker; an inside wall that closes the wedge
            # under a raking ceiling; 12B Fletcher St 2026-11-25) is cut to the roof plane wherever the plane drops
            # below its top, so it never pokes through the roof at the low end
            rp_clip = rake_part_for(rparts, lid, line0)
            if rp_clip is not None:
                clip_to_skillion(wall, rp_clip, elev, cmat)
        if rp is not None:
            t2 = line0["thickness"] / 2
            d, lf = line0["dir"], line0["left"]
            # each end grown by half a thickness to close corners, but not where another wall carries straight on
            # (2026-11-23, 34 Jollytail St: two grown bands overlapped at a straight joint and their coplanar faces
            # rendered as black slits up the gable)
            def _straight_on(nid):
                for w2 in J["lines"].values():
                    if w2["id"] == wid or nid not in (w2["a"], w2["b"]):
                        continue
                    if abs(w2["dir"][0] * line0["dir"][1] - w2["dir"][1] * line0["dir"][0]) < 1e-3:
                        return True
                return False

            ends = [(line0["pa"], 0.0 if _straight_on(line0["a"]) else -t2),
                    (line0["pb"], 0.0 if _straight_on(line0["b"]) else t2)]
            base_z = elev + H
            # the band follows whichever skillion part is over each stretch of the wall (2026-11-23: a wall that
            # runs under two parts, e.g. under a 10 deg roof then a higher 15 deg one, steps up where they meet
            # instead of following the first part and leaving a wedge of sky under the higher one)
            pa0 = line0["pa"]
            u_lo, u_hi = ends[0][1], line0["length"] + ends[1][1]
            cuts = {u_lo, u_hi}
            for rp2 in rparts:
                if rp2["typ"] != "skillion" or rp2["level"] != lid:
                    continue
                for ax in (0, 1):
                    if abs(d[ax]) < 1e-9:
                        continue
                    for edge in (rp2["bb"]["min"][ax], rp2["bb"]["max"][ax]):
                        u = (edge - pa0[ax]) / d[ax]
                        if u_lo + 0.01 < u < u_hi - 0.01:
                            cuts.add(u)
            cuts = sorted(cuts)

            def _part_at(x, q):
                for rp2 in rparts:
                    if rp2["typ"] != "skillion" or rp2["level"] != lid:
                        continue
                    bb2 = rp2["bb"]
                    if bb2["min"][0] - 0.05 <= x <= bb2["max"][0] + 0.05 and bb2["min"][1] - 0.05 <= q <= bb2["max"][1] + 0.05:
                        return rp2
                return None

            left_mat = f_out if not flip else f_in   # the corners at +lf are on line0's left side
            right_mat = f_in if not flip else f_out
            rk_spec = osp.get("rake") or {}
            if rk_spec:  # the raking band has its own finish on the faces that look outside
                rmat = SH.wall_mat(OUTSIDE_FINISH.get(rk_spec.get("finish", osp.get("finish")), "paint"),
                                   rk_spec.get("color") or osp.get("color"))
                left_mat = rmat if left_mat is not None else None
                right_mat = rmat if right_mat is not None else None
            rk = MB()
            n_seg = 0
            for u0, u1 in zip(cuts, cuts[1:]):
                um = (u0 + u1) / 2
                rps = _part_at(pa0[0] + d[0] * um, pa0[1] + d[1] * um) or rp
                ring = []  # absolute heights, then made wall-local (the wall object sits at z = elev)
                for u, s in ((u0, 1), (u1, 1), (u1, -1), (u0, -1)):
                    x = pa0[0] + d[0] * u + lf[0] * t2 * s
                    q = pa0[1] + d[1] * u + lf[1] * t2 * s
                    ring.append((x, q, max(base_z, skillion_height(rps, x, q))))
                if max(r[2] for r in ring) - base_z <= 0.02:
                    continue
                bot = [bl((x, q), H) for x, q, _ in ring]
                top = [bl((x, q), z - elev) for x, q, z in ring]
                rk.poly([bot[0], bot[1], top[1], top[0]], left_mat or wmat, (lf[0], -lf[1], 0))
                rk.poly([bot[2], bot[3], top[3], top[2]], right_mat or wmat, (-lf[0], lf[1], 0))
                rk.poly([bot[1], bot[2], top[2], top[1]], wmat, (d[0], -d[1], 0))
                rk.poly([bot[3], bot[0], top[0], top[3]], wmat, (-d[0], d[1], 0))
                rk.poly(top, cmat, (0, 0, 1))
                n_seg += 1
            if n_seg:
                if link(rk, f"{name}__rake", wall) is not None:
                    made["rakes"] = made.get("rakes", 0) + 1
        # the extras always describe the wall as building.json has it (a to b), whichever way it was built
        wall["mrWall"] = {"id": wid, "normal": [round(line0["left"][0], 6), round(line0["left"][1], 6)],
                          "exterior": bool(line0["exterior"]), "rooms": {"left": sides[wid]["left"], "right": sides[wid]["right"]}}
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
                F.wbox(sk, F.uo(max(0.0, u0)), F.uo(min(L, u1)), 0.0, 0.09, t, t + 0.014, skm)
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
                hinge = o["spec"].get("hinge")
                if hinge in ("a", "b"):
                    hinge_low = (hinge == "a") != flip
                else:
                    hinge_low = o["a"] <= L - o["b"]
                leaf_mat = materials.get("plaster", col)
                fr_mb, leaf, hw = SH._door(F, o, tm, leaf_mat, metal, hinge_low)
                if o["type"] != "garage":  # a garage door sits in a plain rendered reveal (no frame)
                    link(fr_mb, f"{name}__door{k}_frame", wall, bevel_w=0.004)
                if leaf is not None:
                    for part in (link(leaf, f"{name}__door{k}_leaf", wall, bevel_w=0.004), link(hw, f"{name}__door{k}_handle", wall, bevel_w=0.003)):
                        if part is not None:
                            part.visible_shadow = False
                if o["type"] == "garage":
                    # a closed sectional door: one panel near-flush with the outside face (a few cm back in its
                    # reveal), with fine horizontal ribs every ~0.17 m on the street side (a Colorbond panel)
                    gd = MB()
                    if f_out is not None:
                        w0, w1, rib_w = t - 0.075, t - 0.035, (t - 0.035, t - 0.031)
                    elif f_in is not None:
                        w0, w1, rib_w = 0.035, 0.075, (0.031, 0.035)
                    else:
                        w0, w1, rib_w = t * 0.5 - 0.02, t * 0.5 + 0.02, (t * 0.5 + 0.02, t * 0.5 + 0.024)
                    F.wbox(gd, o["a"] + 0.01, o["b"] - 0.01, 0.0, o["h"] - 0.01, w0, w1, leaf_mat)
                    rib_mat = materials.get("plaster", common_mix(col, "#ffffff", 0.14))
                    hh = o["h"] - 0.01
                    nrib = max(1, int(round(hh / 0.17)))
                    for r_ in range(1, nrib):
                        v = hh * r_ / nrib
                        F.wbox(gd, o["a"] + 0.02, o["b"] - 0.02, v - 0.006, v + 0.006, rib_w[0], rib_w[1], rib_mat)
                    link(gd, f"{name}__door{k}_leaf", wall, bevel_w=0.002, segments=1)
        # the faces a room looks at, for the bake's wall-backed split
        right = [-line["left"][0], -line["left"][1]]
        if rooms["right"]:  # (the frame's w = 0 face)
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
        hub_ob = link(mb, f"wall__{hub['owner']}__hub__{hub['node']}")
        if hub_ob is not None:
            hub_ob.location.z = elev
            mw = owner["mrWall"]
            hub_ob["mrWall"] = mw.to_dict() if hasattr(mw, "to_dict") else dict(mw)
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
        if r.get("kind") != "void":  # a void (the upper half of a double-height room below) has no floor
            for tri in S2.triangulate(poly):
                mb.poly([bl(poly[i], 0.0) for i in tri], fmat, up)
        ob = link(mb, f"floor__{r['id']}")
        if ob is not None:
            ob.location.z = elev
            made["floors"].append(r["id"])
        # its ceiling: flat, seen from below, and a slab's thickness of top (none when `ceiling.show` is false:
        # the room is open to the level above through a void)
        c = r.get("ceiling") or {}
        if c.get("show", True) is False:
            continue
        ch = float(c.get("height", level.get("height", 2.6)))
        cm = materials.get("plaster", c.get("color", "#f3efe6"))
        mb = MB()
        # a skillion ceiling slopes from `height` on its low side to `peak` on the far side of the room's inner
        # bbox (shell.js ceilingAt); before 2026-11-25 every ceiling was built flat at `height`, which hid the
        # Upstairs Living's raking ceiling and the hi-lites above 2.657
        cz = lambda p: ch  # noqa: E731
        if c.get("shape") == "skillion" and c.get("peak") is not None:
            bx = P.bbox(poly)
            (x0, q0), (x1, q1) = bx["min"], bx["max"]
            pk, low = float(c["peak"]), c.get("low", "south")

            def cz(p, x0=x0, x1=x1, q0=q0, q1=q1, pk=pk, low=low):
                f = {"west": (p[0] - x0) / ((x1 - x0) or 1), "east": (x1 - p[0]) / ((x1 - x0) or 1),
                     "north": (p[1] - q0) / ((q1 - q0) or 1), "south": (q1 - p[1]) / ((q1 - q0) or 1)}[low]
                return ch + (pk - ch) * max(0.0, min(1.0, f))
        for tri in S2.triangulate(poly):
            lo = [bl(poly[i], cz(poly[i])) for i in tri]
            mb.poly(list(reversed(lo)), cm, (0, 0, -1))
            mb.poly([p + Vector((0, 0, SH.CEIL_T)) for p in lo], cm, up)
        ob = link(mb, f"ceiling__{r['id']}")
        if ob is not None:
            ob.location.z = elev
            made["ceilings"].append(r["id"])
    # voids on this level: holes in its slab (their inner outlines)
    void_holes = [room_polys[r["id"]] for r in rooms_here if r.get("kind") == "void" and r["id"] in room_polys]
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
    # the slab's edge reads as part of the facade: give it the level's exterior walls' outside finish if they have one
    for w in level.get("walls", []):
        if w.get("exterior") and w.get("outside") and (w["outside"].get("finish") in (None, "render", "paint")):
            pm = outside_mat(SH, w)
            break
    below = [lv for lv in b.get("levels", []) if float(lv.get("elevation", 0.0)) < elev - 1e-6]
    if below:
        lb = max(below, key=lambda lv: float(lv.get("elevation", 0.0)))
        gap = elev - (float(lb.get("elevation", 0.0)) + float(lb.get("height", 2.6)))
        slab_t = float(level.get("slab", max(SH.FLOOR_T, gap)))
    else:
        slab_t = float(level.get("slab", SH.FLOOR_T))
    slab = MB()
    for loop in B.exterior_loops(b, lid):
        ext_t = max((J["lines"][w]["thickness"] for w in J["lines"] if J["lines"][w]["exterior"]), default=0.2)
        ring = P.inset_polygon(loop, [-ext_t / 2] * len(loop), 1)
        n = len(ring)
        for i in range(n):
            a, c = ring[i], ring[(i + 1) % n]
            A, C = bl(a), bl(c)
            nrm = (c[1] - a[1], c[0] - a[0], 0)
            slab.poly([A + Vector((0, 0, -slab_t)), C + Vector((0, 0, -slab_t)), C, A], pm, nrm)
        holes_in = [h for h in void_holes if all(P.point_in_polygon(p, ring) for p in h)]
        if not holes_in:
            for tri in S2.triangulate(ring):
                slab.poly([bl(ring[i], -slab_t) for i in reversed(tri)], pm, (0, 0, -1))
            continue
        # a void room over this ring (2026-11-23): the underside with its hole(s) (scanfill), and the hole's sides =
        # the landing fascia seen from the double-height room below
        import bmesh
        tb = bmesh.new()
        edges = []
        for pts in [ring, *holes_in]:
            vs = [tb.verts.new((x, z, 0.0)) for x, z in pts]
            edges += [tb.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
        bmesh.ops.triangle_fill(tb, use_beauty=True, use_dissolve=False, edges=edges)
        for f in tb.faces:
            slab.poly([bl((v.co.x, v.co.y), -slab_t) for v in f.verts], pm, (0, 0, -1))
        tb.free()
        for h in holes_in:
            cx, cz = sum(p[0] for p in h) / len(h), sum(p[1] for p in h) / len(h)
            for i in range(len(h)):
                a, c = h[i], h[(i + 1) % len(h)]
                nx, nz = -(c[1] - a[1]), c[0] - a[0]
                if nx * (cx - (a[0] + c[0]) / 2) + nz * (cz - (a[1] + c[1]) / 2) < 0:
                    nx, nz = -nx, -nz
                A, C = bl(a), bl(c)
                slab.poly([A + Vector((0, 0, -slab_t)), C + Vector((0, 0, -slab_t)), C, A], pm, (nx, -nz, 0))
    ob = link(slab, "floor__slab")
    if ob is not None:
        ob.location.z = elev
    # an upper level's rooms outside its exterior loop (a balcony, a deck) get their own slab, so nothing shows
    # through between the walls below and the room: the room's outline grown under its own walls, but stopping at
    # the faces of the level's exterior walls (the main slab covers those)
    if below:
        ext_t = max((J["lines"][w]["thickness"] for w in J["lines"] if J["lines"][w]["exterior"]), default=0.2)
        loops = B.exterior_loops(b, lid)
        oslab = MB()
        for r in rooms_here:
            pts_c = B.room_polygon(b, r)
            if any(P.point_in_polygon(B.interior_point(pts_c), loop) for loop in loops):
                continue
            edges = B.room_edges(b, r)
            dists = [0.0 if not e["wall"] else (ext_t / 2 if J["lines"][e["wall"]]["exterior"] else -e["thickness"] / 2)
                     for e in edges]
            ring = P.inset_polygon([e["a"] for e in edges], dists, P.winding_sign(pts_c))
            if P.signed_area(ring) < 0:
                ring = list(reversed(ring))
            n = len(ring)
            for i in range(n):
                a, c = ring[i], ring[(i + 1) % n]
                A, C = bl(a), bl(c)
                oslab.poly([A + Vector((0, 0, -slab_t)), C + Vector((0, 0, -slab_t)), C, A], pm, (c[1] - a[1], c[0] - a[0], 0))
            for tri in S2.triangulate(ring):
                oslab.poly([bl(ring[i], -slab_t) for i in reversed(tri)], pm, (0, 0, -1))
            made.setdefault("outdoorSlabs", []).append(r["id"])
        ob = link(oslab, "floor__slab_outdoor")
        if ob is not None:
            ob.location.z = elev

    # stairs that start on this level
    for s in b.get("stairs", []):
        if s.get("from") != lid:
            continue
        if build_stair(b, s, level, coll, link, made, report) is not None:
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
            mark = set(bpy.data.objects)
            try:
                root = kitmod.build_object(ctx, spec)
            except Exception as e:  # never abort a level for one piece
                report["warnings"].append(f"{r['id']}/{spec['id']}: {type(e).__name__}: {e}")
                for ob in set(bpy.data.objects) - mark:
                    bpy.data.objects.remove(ob, do_unlink=True)
                try:
                    root = kitmod.build_object(ctx, {**spec, "kit": "box"})
                except Exception as e2:
                    report["warnings"].append(f"{r['id']}/{spec['id']}: box fallback failed too: {e2}")
                    root = None
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
    """The roof: explicit parts, else the roof level's exterior outline's bounding box (rectangles only), each part
    edged with a dark fascia band (FASCIA deep) so the thin roof plane reads as a roof."""
    import materials
    from mrgeo import MB

    roof = b.get("roof") or {}
    rparts = roof_parts(b)
    if not rparts:
        return None
    mat = materials.get("tile" if roof.get("finish") == "tile" else "plaster", roof.get("color", "#8a5a44"))
    fmat = materials.get("plaster", FASCIA_COLOUR)
    mb = MB()

    def fascia(ring):
        """A band hanging FASCIA below each edge of a closed ring of roof-edge points (+ the soffit under it)."""
        n = len(ring)
        cx = sum(p.x for p in ring) / n
        cy = sum(p.y for p in ring) / n
        for k in range(n):
            p0, p1 = ring[k], ring[(k + 1) % n]
            q0, q1 = p0.copy(), p1.copy()
            q0.z -= FASCIA
            q1.z -= FASCIA
            mx, my = (p0.x + p1.x) / 2 - cx, (p0.y + p1.y) / 2 - cy
            mb.poly([p0, p1, q1, q0], fmat, (mx, my, 0))
        low = [p.copy() for p in ring]
        for p in low:
            p.z -= FASCIA
        mb.poly(list(reversed(low)), fmat, (0, 0, -1))

    for rp in rparts:
        typ, z0, pitch = rp["typ"], rp["z0"], rp["pitch"]
        x0, x1, q0, q1 = rp["x0"], rp["x1"], rp["q0"], rp["q1"]
        w, d = x1 - x0, q1 - q0
        # corners in Blender (plan z -> -y)
        A, Bc, C, D = bl((x0, q0), z0), bl((x1, q0), z0), bl((x1, q1), z0), bl((x0, q1), z0)
        if typ == "flat":
            mb.poly([A, Bc, C, D], mat, (0, 0, 1))
            fascia([A, Bc, C, D])
            continue
        if typ == "skillion":
            pts = [bl((x, q), skillion_height(rp, x, q)) for x, q in ((x0, q0), (x1, q0), (x1, q1), (x0, q1))]
            mb.poly(pts, mat, (0, 0, 1))
            fascia(pts)
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
        fascia([A, Bc, C, D])
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
    for a, top in zip(site.get("areas", []), area_tops(site.get("areas", []))):
        poly = a["outline"] if P.signed_area(a["outline"]) > 0 else list(reversed(a["outline"]))
        finish = {"drive": "concrete", "path": "paving", "deck": "timber", "lawn": "grass", "pool": "concrete",
                  "garden": "dirt"}.get(a.get("kind"), "paving")
        mat = SH.ground_mat(finish, a.get("color"))
        mb = MB()
        # a slab, not a sheet: its top at `top`, its edges down into the lot (no bottom face)
        for tri in __import__("shell_v2").triangulate(poly):
            mb.poly([bl(poly[i], top) for i in tri], mat, (0, 0, 1))
        if a.get("kind") != "deck":
            bot = GROUND_Y - AREA_SINK
            for i in range(len(poly)):
                p, q = poly[i], poly[(i + 1) % len(poly)]
                ox, oz = q[1] - p[1], -(q[0] - p[0])
                mid = ((p[0] + q[0]) / 2 + ox * 1e-3, (p[1] + q[1]) / 2 + oz * 1e-3)
                if P.point_in_polygon(mid, poly):  # that way is inward: face the other way
                    ox, oz = -ox, -oz
                mb.poly([bl(p, top), bl(q, top), bl(q, bot), bl(p, bot)], mat, tuple(bl((ox, oz), 0)))
        made.append(mb.obj(f"site__{a['id']}", coll))
    # fences: metal / timber / picket = upright slats on a pitch (+ a top rail); masonry / glass / hedge = one panel
    for f in site.get("fences", []):
        h = float(f.get("height", 1.8))
        kind = f.get("kind", "timber")
        col = f.get("color") or {"timber": "#8a6a4a", "picket": "#f2efe8", "metal": "#2a2b2d", "masonry": "#d8d2c6",
                                 "hedge": "#4f7a4a", "glass": "#cfe3e8"}.get(kind, "#8a6a4a")
        fm = materials.get({"timber": "pine", "picket": "plaster", "metal": "plaster", "masonry": "plaster",
                            "hedge": "plant", "glass": "glass"}.get(kind, "plaster"), col)
        mb = MB()
        line = f["line"]
        for k in range(len(line) - 1):
            (ax, aq), (bx, bq) = line[k], line[k + 1]
            L = math.hypot(bx - ax, bq - aq)
            if L < 1e-6:
                continue
            ux, uq = (bx - ax) / L, (bq - aq) / L
            ang = math.atan2(-uq, ux)  # Blender: plan z -> -y
            from mathutils import Matrix
            if kind in ("metal", "timber", "picket"):
                pitch, sw = (0.10, 0.05) if kind == "metal" else (0.14, 0.09)
                n = max(1, int(L / pitch))
                for i in range(n + 1):
                    s_ = min(L, i * pitch)
                    c = (ax + ux * s_, aq + uq * s_)
                    m = Matrix.Translation(bl(c, h / 2 - 0.13)) @ Matrix.Rotation(ang, 4, "Z")
                    mb.tbox(m, (sw, 0.025, h), fm)
                m = Matrix.Translation(bl(((ax + bx) / 2, (aq + bq) / 2), h - 0.13 - 0.02)) @ Matrix.Rotation(ang, 4, "Z")
                mb.tbox(m, (L, 0.04, 0.04), fm)
            elif kind == "sheet":
                # sheet-metal panels (Colorbond): one thin panel with a vertical rib every ~0.19 m on both faces
                m = Matrix.Translation(bl(((ax + bx) / 2, (aq + bq) / 2), h / 2 - 0.13)) @ Matrix.Rotation(ang, 4, "Z")
                mb.tbox(m, (L, 0.025, h), fm)
                rib = materials.get("plaster", common_mix(col, "#ffffff", 0.1))
                n = max(1, int(L / 0.19))
                for i in range(1, n):
                    c = (ax + ux * L * i / n, aq + uq * L * i / n)
                    for off in (-0.017, 0.017):
                        mr = Matrix.Translation(bl(c, h / 2 - 0.13)) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Translation((0, off, 0))
                        mb.tbox(mr, (0.022, 0.01, h - 0.02), rib)
            else:
                m = Matrix.Translation(bl(((ax + bx) / 2, (aq + bq) / 2), h / 2 - 0.13)) @ Matrix.Rotation(ang, 4, "Z")
                mb.tbox(m, (L, 0.06 if kind != "hedge" else 0.6, h), fm)
        if mb.faces:
            made.append(mb.obj(f"site__{f['id']}", coll))
    # trees: a trunk and a lumpy canopy (palm: a tall bare trunk + a small crown; shrub: canopy only, on the ground)
    for t in site.get("trees", []):
        h = float(t.get("height", 6.0))
        kind = t.get("kind", "tree")
        spread = float(t.get("spread", h * 0.6))
        mb = MB()
        bark = materials.get("walnut", "#5a4636")
        leaf = materials.get("plant", "#44613a" if kind != "pine" else "#3f5a3a")
        base = bl(t["at"], -0.13)
        if kind == "shrub":
            mb.blob((base.x, base.y, base.z + h / 2), (spread / 2, spread / 2, h / 2), leaf, seed=float(sum(map(ord, t["id"])) % 97))
        else:
            trunk_h = h * (0.85 if kind == "palm" else 0.45)
            mb.cyl((base.x, base.y, base.z), max(0.06, h * 0.025), trunk_h, bark, n=10, r_top=max(0.04, h * 0.015))
            cr = spread / 2 if kind != "palm" else max(0.8, spread / 3)
            ch = (h - trunk_h) / 2 + 0.2 if kind != "pine" else (h - trunk_h)
            mb.blob((base.x, base.y, base.z + trunk_h + ch * 0.8), (cr, cr, max(0.4, ch)), leaf, seed=float(sum(map(ord, t["id"])) % 97))
        made.append(mb.obj(f"site__{t['id']}", coll))
    for f in site.get("features", []):
        ob = site_feature(f, coll)
        if ob is not None:
            made.append(ob)
    return made


# a feature's `finish` -> (material, default colour)
FEATURE_MATS = {"render": ("plaster", "#f2f1ec"), "concrete": ("concrete", "#d3cfc7"), "stone": ("stone", "#d8d0bd"),
                "steel": ("plaster", "#1f2022"), "timber": ("pine", "#8a6a4a"), "plant": ("plant", "#5f7d4c"),
                "paving": ("stone", "#bdb8ae")}
FEATURE_DEFAULT_FINISH = {"shrub": "plant", "ring": "steel", "letterbox": "steel", "disc": "stone"}
GROUND_Y = -0.13  # the site's ground plane (the lot sits there)

# Site areas are slabs standing proud of the lot, each kind at its own height above it (m). Never two surfaces a
# few mm apart: the viewer can't tell which is in front, and they swap as the view turns (z-fighting). An area
# that overlaps an earlier one sits at least AREA_STEP above it, so later areas always read on top.
AREA_RISE = {"lawn": 0.015, "garden": 0.02, "water": 0.02, "path": 0.03, "paving": 0.03, "pool": 0.03, "drive": 0.04}
AREA_STEP = 0.012
AREA_SINK = 0.02  # an area's edges run this far below the lot, so no gap shows at a low angle
AREA_MIN_GAP = 0.008  # the build fails below this (between overlapping areas, or an area and the lot)


def area_tops(areas):
    """Each site area's top height (world y), in order. A deck stays at floor level (0). Raises when two
    overlapping areas would end up closer than AREA_MIN_GAP (the z-fighting guard)."""
    tops, polys = [], []
    for a in areas:
        poly = a["outline"]
        if a.get("kind") == "deck":
            top = 0.0
        else:
            top = GROUND_Y + AREA_RISE.get(a.get("kind"), 0.03)
            for prev, ptop in zip(polys, tops):
                if ptop != 0.0 and P.polygons_overlap(poly, prev):
                    top = max(top, ptop + AREA_STEP)
        tops.append(round(top, 4))
        polys.append(poly)
    for i, (a, t) in enumerate(zip(areas, tops)):
        if t - GROUND_Y < AREA_MIN_GAP:
            raise ValueError(f"site area {a['id']} sits {t - GROUND_Y:.4f} m above the lot (< {AREA_MIN_GAP})")
        for j in range(i):
            if abs(t - tops[j]) < AREA_MIN_GAP and P.polygons_overlap(a["outline"], areas[j]["outline"]):
                raise ValueError(f"site areas {areas[j]['id']} and {a['id']} overlap {abs(t - tops[j]):.4f} m apart (z-fighting)")
    return tops


def site_feature(f, coll):
    """One `site.features` item -> `site__<id>` (built in world coordinates; a letterbox's label is a child
    `site__<id>__label`). Local frame: w along x, d along y (its front faces local -y = plan +z at rotY 0), h up."""
    import bpy
    from mathutils import Matrix

    import materials
    from mrgeo import MB

    kind = f["kind"]
    w, hgt, dep = (float(v) for v in f["size"])
    fin = f.get("finish") or FEATURE_DEFAULT_FINISH.get(kind, "concrete")
    base, dcol = FEATURE_MATS.get(fin, FEATURE_MATS["concrete"])
    col = f.get("color") or dcol
    mat = materials.get(base, col)
    seed = float(sum(map(ord, f["id"])) % 97)
    m = Matrix.Translation(bl(f["at"], GROUND_Y + float(f.get("y", 0.0)))) @ Matrix.Rotation(math.radians(float(f.get("rotY", 0.0))), 4, "Z")
    oval = m @ Matrix.Diagonal((w / 2, dep / 2, 1.0, 1.0))
    mb = MB()
    if kind == "box":
        mb.tbox(m, (w, dep, hgt), mat, base=True)
    elif kind in ("cylinder", "disc"):
        mb.lathe([(1.0, 0.0), (1.0, hgt)], mat, n=28 if kind == "disc" else 20, m=oval, smooth=True)
    elif kind == "ring":
        th = min(0.04, w * 0.05)
        ri = 1.0 - 2 * th / w
        mb.lathe([(1.0, 0.0), (1.0, hgt), (ri, hgt), (ri, hgt - 0.07)], mat, n=40, m=oval, smooth=True)
        soil = materials.get("dirt", "#4a3a2c")
        mb.lathe([(ri, hgt - 0.075), (ri, hgt - 0.07)], soil, n=40, m=oval, smooth=True)
    elif kind == "shrub":
        c = (m @ Matrix.Translation((0, 0, hgt / 2))).to_translation()
        mb.blob((c.x, c.y, c.z), (w / 2, dep / 2, hgt / 2), mat, subdiv=3, rough=0.08, freq=2.2, seed=seed)
    elif kind == "letterbox":
        # a long black block: a slot and a door near the right end of its front, succulents along the top
        mb.tbox(m, (w, dep, hgt), mat, base=True)
        slot = materials.get("plaster", common_mix(col, "#000000", 0.5))
        mb.tbox(m @ Matrix.Translation((w * 0.36, -dep / 2 - 0.004, hgt * 0.8)), (0.3, 0.012, 0.035), slot)
        mb.tbox(m @ Matrix.Translation((w * 0.36, -dep / 2 - 0.004, hgt * 0.42)), (0.26, 0.012, 0.4),
                materials.get("plaster", common_mix(col, "#ffffff", 0.06)))
        soil = materials.get("dirt", "#4a3a2c")
        mb.tbox(m @ Matrix.Translation((0, 0, hgt - 0.03)), (w - 0.06, dep - 0.06, 0.04), soil)
        leaf = materials.get("plant", "#b7c4bf")  # silver-leaf succulents
        k = max(2, int(w / 0.32))
        for i in range(k):
            px = -w / 2 + 0.16 + (w - 0.32) * i / max(1, k - 1)
            c = (m @ Matrix.Translation((px, 0.03 * math.sin(i * 2.1), hgt + 0.1))).to_translation()
            mb.blob((c.x, c.y, c.z), (0.17, 0.15, 0.13), leaf, subdiv=2, rough=0.3, freq=3.0, seed=seed + i)
    else:
        return None
    ob = mb.obj(f"site__{f['id']}", coll, bevel_w=0.004 if kind in ("box", "letterbox") else 0.0)
    if kind == "letterbox" and f.get("label"):
        cu = bpy.data.curves.new(f"label__{f['id']}", "FONT")
        cu.body = f["label"]
        cu.size = min(0.26, hgt * 0.3)
        cu.align_x, cu.align_y = "CENTER", "CENTER"
        cu.extrude = 0.004
        tob = bpy.data.objects.new(f"label__{f['id']}", cu)
        coll.objects.link(tob)
        tob.matrix_world = m @ Matrix.Translation((w * 0.12, -dep / 2 - 0.006, hgt * 0.5)) @ Matrix.Rotation(math.radians(90), 4, "X")
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tob.evaluated_get(dg))
        mw = tob.matrix_world.copy()
        bpy.data.objects.remove(tob, do_unlink=True)
        me.materials.clear()
        me.materials.append(materials.get("plaster", "#f4f4f2"))
        lob = bpy.data.objects.new(f"site__{f['id']}__label", me)
        coll.objects.link(lob)
        lob.parent = ob
        lob.matrix_world = mw
    return ob


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
