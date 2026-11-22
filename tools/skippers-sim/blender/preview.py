"""Render quick check views of a built GLB (Workbench, material colours).

  blender -b --factory-startup --python preview.py -- --glb <file> --out <dir> --views name:ex,ey,ez:tx,ty,tz:lens[;...]

Coordinates are in the Blender frame (X east/starboard, Y north/forward, Z up).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
GLB = a[a.index("--glb") + 1]
OUT = a[a.index("--out") + 1]
VIEWS = a[a.index("--views") + 1]
RES = int(a[a.index("--res") + 1]) if "--res" in a else 900

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_shadows = True
sc.display.shading.show_cavity = True
sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 0.62)
w = bpy.data.worlds.new("w")
sc.world = w
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.clip_end = 8000
os.makedirs(OUT, exist_ok=True)
for v in VIEWS.split(";"):
    name, e, t, lens = v.split(":")
    e = Vector([float(x) for x in e.split(",")])
    t = Vector([float(x) for x in t.split(",")])
    cam.location = e
    cam.rotation_euler = (t - e).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = float(lens)
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", sc.render.filepath, flush=True)
