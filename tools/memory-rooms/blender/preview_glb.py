"""Render room.glb the way the web viewer shows it: no lights, no tone mapping, every material unlit.

    blender.exe -b --factory-startup --python tools/memory-rooms/blender/preview_glb.py -- \
        --work <work> [--out <work>/renders/glb-preview.png] [--res 1200]

Baked materials (KHR_materials_unlit, re-imported as emission-for-camera-rays) show the atlas texel values
1:1 under the Standard view transform; `glass…` = 18 % of its baseColorFactor over what is behind it;
`emit…` = its colour. The camera and the hidden (dollhouse) walls come from export-report.json, so the
result can be compared pixel-for-pixel with renders/three-quarter.png.
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

import common  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--work", required=True)
    p.add_argument("--out", default="")
    p.add_argument("--res", type=int, default=1200)
    p.add_argument("--cam", type=int, default=0, help="photo N from scene.json (camera inside, nothing hidden)")
    p.add_argument("--no-cull", action="store_true", help="draw back faces too (three.js FrontSide culls them)")
    args = common.script_args(p)
    import bpy
    from mathutils import Vector

    from scene_io import to_bl

    work = Path(args.work).resolve()
    rep = json.loads((work / "export-report.json").read_text(encoding="utf-8"))
    view = rep["threeQuarterView"]
    aspect = 4 / 3
    if args.cam:
        scene = json.loads((work / "scene.json").read_text(encoding="utf-8"))
        c = next(c for c in scene["cameras"] if c["photo"] == args.cam)
        aspect = float(c.get("aspect", 0.75))
        view = {"pos": c["pos"], "look": c["look"], "fov": c.get("fov", 70), "shift": [0.0, 0.0], "hide": [],
                "roll": c.get("roll", 0.0)}
    sc = common.reset_scene()
    rx, ry = (args.res, round(args.res / aspect)) if aspect >= 1 else (round(args.res * aspect), args.res)
    common.set_render(sc, samples=16, res_x=rx, res_y=ry, denoise=False, transparent=not args.cam)
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.cycles.max_bounces = 2
    sc.cycles.transparent_max_bounces = 16
    w = bpy.data.worlds.new("black")
    sc.world = w
    bpy.ops.import_scene.gltf(filepath=str(work / "room.glb"))
    for m in bpy.data.materials:
        if m.name.startswith("glass") or m.name.startswith("emit"):
            nt = m.node_tree
            b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b is None:
                continue
            col = b.inputs["Emission Color"].default_value[:] if m.name.startswith("emit") else \
                b.inputs["Base Color"].default_value[:]
            nt.nodes.clear()
            out = nt.nodes.new("ShaderNodeOutputMaterial")
            em = nt.nodes.new("ShaderNodeEmission")
            em.inputs["Color"].default_value = (col[0], col[1], col[2], 1.0)
            if m.name.startswith("glass"):
                tr = nt.nodes.new("ShaderNodeBsdfTransparent")
                mx = nt.nodes.new("ShaderNodeMixShader")
                mx.inputs[0].default_value = 0.18
                nt.links.new(tr.outputs[0], mx.inputs[1])
                nt.links.new(em.outputs[0], mx.inputs[2])
                nt.links.new(mx.outputs[0], out.inputs["Surface"])
            else:
                nt.links.new(em.outputs[0], out.inputs["Surface"])
    if not args.no_cull:  # three.js MeshBasicMaterial is FrontSide: back faces are invisible
        for m in bpy.data.materials:
            nt = m.node_tree
            if nt is None:
                continue
            out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
            if out is None or not out.inputs["Surface"].is_linked:
                continue
            src = out.inputs["Surface"].links[0].from_socket
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            tr = nt.nodes.new("ShaderNodeBsdfTransparent")
            mx = nt.nodes.new("ShaderNodeMixShader")
            nt.links.new(geo.outputs["Backfacing"], mx.inputs[0])
            nt.links.new(src, mx.inputs[1])
            nt.links.new(tr.outputs[0], mx.inputs[2])
            nt.links.new(mx.outputs[0], out.inputs["Surface"])
    for name in view.get("hide", []):
        for o in bpy.data.objects:
            if o.name == name or o.name.startswith(name + "__") or (o.parent and o.parent.name == name):
                o.hide_render = True
    cam = bpy.data.cameras.new("view")
    cam.sensor_fit = "AUTO"
    cam.angle = math.radians(view["fov"])
    cam.shift_x, cam.shift_y = view["shift"]
    cam.clip_start = 0.02
    ob = bpy.data.objects.new("view", cam)
    sc.collection.objects.link(ob)
    ob.location = Vector(to_bl(view["pos"]))
    d = Vector(to_bl(view["look"])) - ob.location
    q = d.to_track_quat("-Z", "Y")
    if view.get("roll"):
        from mathutils import Quaternion
        q = q @ Quaternion((0, 0, 1), -math.radians(view["roll"]))
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = q
    default = f"glb-preview-cam{args.cam}.png" if args.cam else "glb-preview.png"
    path = Path(args.out).resolve() if args.out else work / "renders" / default
    common.render_to(sc, ob, path)
    common.log("preview", path)


if __name__ == "__main__":
    main()
