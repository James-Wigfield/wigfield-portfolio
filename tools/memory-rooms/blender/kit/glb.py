"""glb: import <work>/<src> (a .glb asset), keep its materials, and scale it UNIFORMLY to fit `size`.

The asset is centred on its footprint with its base on the origin. glTF's front (+Z) becomes Blender -y,
which is the kit's front, so a well-made asset faces the right way at rotY 0.
params: fit "contain" (default: largest uniform scale inside size) | "width" | "height" | "depth".
"""

from __future__ import annotations

import bpy
from mathutils import Vector


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    path = (ctx.work / spec["src"]).resolve()
    if not path.exists():
        raise FileNotFoundError(f"glb not found: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type in ("CAMERA", "LIGHT"):
            bpy.data.objects.remove(o, do_unlink=True)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        ctx.link(o)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
    if not pts:
        raise ValueError(f"{spec['src']} has no meshes")
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ext = mx - mn
    ratios = {"width": w / max(ext.x, 1e-6), "depth": d / max(ext.y, 1e-6), "height": h / max(ext.z, 1e-6)}
    fit = P.get("fit", "contain")
    s = ratios[fit] if fit in ratios else min(ratios.values())
    holder = bpy.data.objects.new("glb", None)
    ctx.link(holder)
    for o in new:
        if o.parent is None:
            o.parent = holder
    holder.scale = (s, s, s)
    holder.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
    return [holder]
