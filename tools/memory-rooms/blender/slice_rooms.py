"""A baked level -> one room.glb per furnished room, in its room frame (CONTRACTS.md 6.4).

    blender.exe -b <work>/levels/<levelId>/room-baked.blend --python tools/memory-rooms/blender/slice_rooms.py -- \
        --building <work>/building.json --id <buildingId> --scenes <dir> [--out <dir>]

For every room of this level that has a scene (a spot work folder whose scene.json shell is {building, room}):
keep its walls (with their windows, doors, skirting, hubs), `floor__<room>`, `ceiling__<room>` and its furnishing
(`room__<room>__obj__<id>` -> renamed `obj__<id>`), move them into the room frame (the frame's origin to 0), give
each wall `mrWall.normal` = the outward normal FROM THIS ROOM (the spot page has no building to ask), and export
<scenes>/<spot>/room.glb (or <out>/<room>.glb). The spot page, the walk and AR then treat it like any baked room.
Re-opens the level for each room, so one room's deletions never touch the next.
"""

from __future__ import annotations

import argparse
import json
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
        frame = B.room_frame(b, r)
        ox, oy, oz = frame["origin"]
        shift = Vector((ox, -oz, oy))
        for o in bpy.data.objects:
            if o.parent is None:
                o.location = o.location - shift
        for o in list(bpy.data.objects):
            if o.name.startswith(prefix):
                o.name = o.name[len(prefix):]
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
        report.append({"room": rid, "glb": str(out), "objects": len(bpy.data.objects), "walls": sorted(outward)})
        log("slice", rid, str(out))
    print("SLICES " + json.dumps(report), flush=True)
    if level is None:
        print(f"no level {level_id!r} in the building", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
