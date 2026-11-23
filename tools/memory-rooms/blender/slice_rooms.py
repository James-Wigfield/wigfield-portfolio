"""A baked level -> one room.glb per furnished room, in its room frame (CONTRACTS.md 6.4).

    blender.exe -b <work>/levels/<levelId>/room-baked.blend --python tools/memory-rooms/blender/slice_rooms.py -- \
        --building <work>/building.json --id <buildingId> --scenes <dir> [--out <dir>]

For every room of this level that has a scene (a spot work folder whose scene.json shell is {building, room}):
keep its walls (with their windows, doors, skirting, hubs), `floor__<room>`, `ceiling__<room>`, the flights that start
inside it (`stair__<id>`, 2026-11-23), and its furnishing
(`room__<room>__obj__<id>` -> renamed `obj__<id>`), move them into the room frame (the frame's origin to 0), give
each wall `mrWall.normal` = the outward normal FROM THIS ROOM (the spot page has no building to ask), and export
<scenes>/<spot>/room.glb (or <out>/<room>.glb). The spot page, the walk and AR then treat it like any baked room.
Every node keeps its `mrKind` extras (furniture = the renamed `obj__<id>` pieces); the level's room-empty.glb
(build-building.mjs copies it next to the slice) fits the slice as is: same `baked_atlas<i>` material names.
Re-opens the level for each room, so one room's deletions never touch the next.
A room with no ceiling (`ceiling.show` false) under a `void` room of the level above (a double-height foyer) also gets
that level's structure over its box, from levels/<up>/room-baked.blend, clipped (append_upper): build-building.mjs
therefore slices after every level is baked.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import building_io as B  # noqa: E402
import common  # noqa: E402
from common import log  # noqa: E402


def parse():
    p = argparse.ArgumentParser(prog="slice_rooms.py")
    p.add_argument("--building", required=True)
    p.add_argument("--id", required=True)
    p.add_argument("--scenes", required=True)
    p.add_argument("--out", default="")
    p.add_argument("--webp-quality", type=int, default=90)
    return common.script_args(p)


def top_root(o):
    while o.parent is not None:
        o = o.parent
    return o


UP_MARGIN = 0.15  # the upper structure is clipped to the room's centreline box grown by this (keeps whole walls)
UP_PREFIXES = ("wall__", "floor__", "ceiling__")


def open_levels_above(b, r):
    """A room with no ceiling of its own (`ceiling.show` false) under a void room of the next level up is open to
    that level (a double-height foyer): the levels it reaches, lowest first, each with its void rooms."""
    if (r.get("ceiling") or {}).get("show", True) is not False:
        return []
    poly = B.room_polygon(b, r)
    base = B.level_by_id(b, r["level"])
    above = sorted((L for L in b.get("levels", []) if L["elevation"] > base["elevation"]), key=lambda L: L["elevation"])
    out = []
    for L in above:
        voids = [v for v in b.get("rooms", []) if v["level"] == L["id"] and v.get("kind") == "void"
                 and B.rooms_overlap(B.room_polygon(b, v), poly)]
        if not voids:
            break
        out.append((L, voids))
    return out


def append_upper(b, r, blend, outward, report):
    """Append the structure of every level this room is open to (its baked blend: walls with their windows, floors,
    ceilings, hubs) that stands over the room's box, clipped to that box grown by UP_MARGIN. Its walls get this room's
    outward normals (`outward`, updated in place) so the dollhouse cut works; its atlas materials are renamed
    `<level>__baked_atlas<i>` so the empty-state swap (same-named atlases) leaves them alone."""
    import re

    import bmesh
    import bpy
    from mathutils import Vector

    import polygon2d as P

    poly = B.room_polygon(b, r)
    bb = P.bbox(poly)
    x0, x1 = bb["min"][0] - UP_MARGIN, bb["max"][0] + UP_MARGIN
    z0, z1 = bb["min"][1] - UP_MARGIN, bb["max"][1] + UP_MARGIN
    cx, cz = (bb["min"][0] + bb["max"][0]) / 2, (bb["min"][1] + bb["max"][1]) / 2
    added = []
    for L, voids in open_levels_above(b, r):
        src_blend = Path(blend).parent.parent / L["id"] / "room-baked.blend"
        if not src_blend.exists():
            log("slice", r["id"], f"open to {L['id']} but {src_blend} is missing: no upper structure")
            continue
        mats_before = {m.name for m in bpy.data.materials}
        with bpy.data.libraries.load(str(src_blend), link=False) as (src, dst):
            dst.objects = [n for n in src.objects if n.startswith(UP_PREFIXES) and not n.startswith("floor__slab_outdoor")]
        new = [o for o in dst.objects if o is not None]
        new_names = [o.name for o in new]
        for o in new:
            bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.update()
        # keep the roots over the box (Blender y = -z)
        roots = {top_root(o) for o in new}
        gone = set()
        for root in roots:
            pts = [root.matrix_world @ Vector(c) for c in root.bound_box]
            for ch in root.children_recursive:
                pts += [ch.matrix_world @ Vector(c) for c in ch.bound_box]
            ox0, ox1 = min(p.x for p in pts), max(p.x for p in pts)
            oz0, oz1 = min(-p.y for p in pts), max(-p.y for p in pts)
            if ox1 <= x0 + 1e-3 or ox0 >= x1 - 1e-3 or oz1 <= z0 + 1e-3 or oz0 >= z1 - 1e-3:
                for o in [root, *root.children_recursive]:
                    gone.add(o.name)
                for o in [*root.children_recursive, root]:
                    bpy.data.objects.remove(o, do_unlink=True)
        # clip every remaining mesh to the box (planes in world space, taken into each object's space): walls to the
        # grown box (whole thicknesses), floors / ceilings / the slab to the room's inner faces (no strips over walls)
        planes_w = [((x0, 0, 0), (-1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, -z0, 0), (0, 1, 0)), ((0, -z1, 0), (0, -1, 0))]
        ib = P.bbox(B.room_inner_polygon(b, r))
        e = 0.005
        planes_i = [((ib["min"][0] - e, 0, 0), (-1, 0, 0)), ((ib["max"][0] + e, 0, 0), (1, 0, 0)),
                    ((0, -(ib["min"][1] - e), 0), (0, 1, 0)), ((0, -(ib["max"][1] + e), 0), (0, -1, 0))]
        kept = [bpy.data.objects[n] for n in new_names if n not in gone and n in bpy.data.objects]
        for o in kept:
            if o.type != "MESH":
                continue
            planes = planes_w if top_root(o).name.startswith("wall__") else planes_i
            inv = o.matrix_world.inverted()
            rot_t = o.matrix_world.to_3x3().transposed()
            bm = bmesh.new()
            bm.from_mesh(o.data)
            for co, no in planes:
                co_l = inv @ Vector(co)
                no_l = (rot_t @ Vector(no)).normalized()
                bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co_l, plane_no=no_l, clear_outer=True)
            bm.to_mesh(o.data)
            bm.free()
            o.data.update()
        # a slab / floor edge face standing against one of this room's walls (the void's sides over the walls
        # below) goes with that wall: `wall__<id>__upper_<n>`, so the dollhouse cut hides it with the wall
        edges = [ed for ed in B.room_edges(b, r) if ed["wall"]]
        moved = 0
        for o in list(kept):
            if o.type != "MESH" or top_root(o).name.startswith("wall__"):
                continue
            mw = o.matrix_world
            rot = mw.to_3x3()
            assign = {}
            for f in o.data.polygons:
                nw = (rot @ f.normal).normalized()
                if abs(nw.z) > 0.3:
                    continue
                c = mw @ f.center
                px, pz, fx, fz = c.x, -c.y, nw.x, -nw.y
                for ed in edges:
                    (ax, az), (bx, bz) = ed["a"], ed["b"]
                    ox_, oz_ = ed["out"]
                    if fx * ox_ + fz * oz_ > -0.7:
                        continue  # not looking into the room off this wall
                    dx, dz = bx - ax, bz - az
                    ll = dx * dx + dz * dz or 1.0
                    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / ll))
                    if math.hypot(px - (ax + dx * t), pz - (az + dz * t)) < 0.3:
                        assign.setdefault(ed["wall"], []).append(f.index)
                        break
            for wid, idx in assign.items():
                dup = o.copy()
                dup.data = o.data.copy()
                dup.name = f"wall__{wid}__upper_{moved}"
                bpy.context.scene.collection.objects.link(dup)
                keep_idx = set(idx)
                bm = bmesh.new()
                bm.from_mesh(dup.data)
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep_idx], context="FACES")
                bm.to_mesh(dup.data)
                bm.free()
                dup["mrKind"] = "structure"
                kept.append(dup)
                moved += 1
            if assign:
                drop = {i for idx in assign.values() for i in idx}
                bm = bmesh.new()
                bm.from_mesh(o.data)
                bm.faces.ensure_lookup_table()
                bmesh.ops.delete(bm, geom=[bm.faces[i] for i in drop], context="FACES")
                bm.to_mesh(o.data)
                bm.free()
        # this room's outward normals for the upper walls on its sides (mrWall), and clear atlas names
        lines = {ln["id"]: ln for ln in B.wall_lines(b, L["id"])}
        for o in kept:
            if o.name.startswith("wall__") and "__" not in o.name[6:]:
                ln = lines.get(o.name[6:])
                if ln:
                    mx, mz = (ln["pa"][0] + ln["pb"][0]) / 2, (ln["pa"][1] + ln["pb"][1]) / 2
                    nx, nz = ln["left"]
                    if nx * (mx - cx) + nz * (mz - cz) < 0:
                        nx, nz = -nx, -nz
                    outward[o.name[6:]] = (nx, nz)
            if "mrKind" not in o:
                o["mrKind"] = "structure"
            added.append(o.name)
        for m in bpy.data.materials:
            if m.name not in mats_before:
                base = re.sub(r"\.\d+$", "", m.name)
                m.name = f"{L['id']}__{base}"
        report.append({"openTo": L["id"], "voids": [v["id"] for v in voids], "objects": len(kept)})
        log("slice", r["id"], f"open to {L['id']}: {len(kept)} upper objects")
    return added


def main():
    import bpy
    from mathutils import Vector

    import build_building as BB

    args = parse()
    b = B.load_building(args.building)
    b["id"] = args.id
    blend = bpy.data.filepath
    meta = json.loads(bpy.context.scene.get("mr_meta", "{}"))
    level_id = meta.get("level")
    level = B.level_by_id(b, level_id)
    scenes = BB.room_scenes(b, args.scenes, every=True)
    rooms = [r for r in b.get("rooms", []) if r["level"] == level_id and r["id"] in scenes]
    report = []
    jobs = [(r, sc_dir) for r in rooms for (_sc, sc_dir) in scenes[r["id"]]]
    for r, spot_dir in jobs:
        bpy.ops.wm.open_mainfile(filepath=blend)
        rid = r["id"]
        edges = B.room_edges(b, r)
        outward = {e["wall"]: e["out"] for e in edges if e["wall"]}
        keep_roots = {f"floor__{rid}", f"ceiling__{rid}", *(f"wall__{w}" for w in outward)}
        # a flight that starts on this level inside the room (its middle in the outline) belongs to its slice
        import polygon2d as P
        rpoly = B.room_polygon(b, r)
        for s in b.get("stairs", []):
            fp = B.stair_footprint(s)
            mid = (sum(p[0] for p in fp) / 4, sum(p[1] for p in fp) / 4)
            if s["from"] == level_id and P.point_in_polygon(mid, rpoly):
                keep_roots |= {f"stair__{s['id']}", f"stair__{s['id']}__walls"}
        corners = set(r["outline"])  # the junction hubs at this room's corners (whoever owns them)
        prefix = f"room__{rid}__"
        kept = set()
        for o in bpy.data.objects:
            root = top_root(o)
            hub = root.name.rsplit("__hub__", 1)[1] if "__hub__" in root.name else None
            if root.name in keep_roots or root.name.startswith(prefix) or (hub and hub in corners):
                kept.add(o.name)
        for o in list(bpy.data.objects):
            if o.name not in kept:
                bpy.data.objects.remove(o, do_unlink=True)
        outward = dict(outward)
        upper = []
        append_upper(b, r, blend, outward, upper)
        frame = B.room_frame(b, r)
        ox, oy, oz = frame["origin"]
        shift = Vector((ox, -oz, oy))
        for o in bpy.data.objects:
            if o.parent is None:
                o.location = o.location - shift
        for o in list(bpy.data.objects):
            if o.name.startswith(prefix):
                o.name = o.name[len(prefix):]
        for o in bpy.data.objects:
            # mrKind (CONTRACTS.md 4) rides along from the level bake; a level baked before it gets it here
            if "mrKind" not in o:
                root = top_root(o).name
                o["mrKind"] = "furniture" if root.startswith("obj__") or "__obj__" in root else "structure"
            if o.name.startswith("wall__") and "__" not in o.name[6:] and o.get("mrWall"):
                wid = o.name[6:]
                mw = dict(o["mrWall"])
                n = outward.get(wid)
                if n:
                    mw = {"id": wid, "normal": [round(n[0], 6), round(n[1], 6)]}
                o["mrWall"] = mw
        out = Path(args.out) / f"{rid}.glb" if args.out else Path(spot_dir) / "room.glb"
        out.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=str(out), export_format="GLB", use_selection=False, export_cameras=False, export_lights=False,
            export_animations=False, export_apply=True, export_yup=True, export_image_format="WEBP",
            export_image_quality=args.webp_quality, export_texcoords=True, export_normals=False,
            export_tangents=False, export_materials="EXPORT", export_extras=True, export_vertex_color="NONE")
        report.append({"room": rid, "glb": str(out), "objects": len(bpy.data.objects), "walls": sorted(outward), "upper": upper})
        log("slice", rid, str(out))
    print("SLICES " + json.dumps(report), flush=True)
    if level is None:
        print(f"no level {level_id!r} in the building", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
