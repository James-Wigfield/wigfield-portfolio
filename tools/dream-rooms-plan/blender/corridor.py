"""Dream Rooms plan · headless Blender proof: a liminal corridor that loops.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
        --python tools/dream-rooms-plan/blender/corridor.py -- --out tools/dream-rooms-plan/out

What it proves (numbers go in out/report.json):
  1. a Cycles still with volumetric haze and only fluorescent ceiling panels as light (no visible source)
  2. a tileable corridor segment: built three in a row, the MIDDLE one baked "in context" so its ends get
     the light of its neighbours, then exported alone as a small unlit GLB (KHR_materials_unlit, WebP).
     The browser places copies end to end and teleports the walker back one segment: an endless corridor.
  3. doors keep their own material names in the GLB, so the browser can swap one when you look away.

Throwaway plan-page experiment, not the Dream Rooms kit.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="tools/dream-rooms-plan/out")
ap.add_argument("--atlas", type=int, default=2048)
ap.add_argument("--bake-samples", type=int, default=384)
ap.add_argument("--still-samples", type=int, default=256)
args = ap.parse_args(ARGV)
OUT = Path(args.out).resolve()
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {"blender": bpy.app.version_string}
T0 = time.perf_counter()

L = 8.0   # segment length (m), along +y
W = 2.2   # corridor width
H = 2.6   # ceiling height


def lin(c):
    """sRGB 0-1 -> linear."""
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def hexc(h):
    h = h.lstrip("#")
    return lin(tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))) + (1.0,)


# ── scene + GPU ────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
used = []
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
    except TypeError:
        continue
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == backend
    used = [d.name for d in prefs.devices if d.type == backend]
    if used:
        break
sc.cycles.device = "GPU" if used else "CPU"
REPORT["device"] = used or ["CPU"]
sc.view_settings.view_transform = "AgX"
try:
    sc.view_settings.look = "AgX - Base Contrast"
except TypeError:
    pass

world = bpy.data.worlds.new("dream_world")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = hexc("#1a1712")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.15


# ── materials (procedural, tinted) ─────────────────────────────────────────
def mat_base(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    return m, nt, b


def mat_carpet():
    m, nt, b = mat_base("carpet")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 38.0
    n.inputs["Detail"].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc("#5e6b52")
    ramp.color_ramp.elements[1].color = hexc("#8a8a5c")
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    return m


def mat_wallpaper():
    m, nt, b = mat_base("wallpaper")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 9.0
    wave.inputs["Distortion"].default_value = 0.0
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc("#c9b97c")
    ramp.color_ramp.elements[1].color = hexc("#d6c98f")
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    return m


def mat_tiles():
    m, nt, b = mat_base("ceiling_tiles")
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.squash_frequency = 1
    brick.inputs["Color1"].default_value = hexc("#d9d4c3")
    brick.inputs["Color2"].default_value = hexc("#d2ccba")
    brick.inputs["Mortar"].default_value = hexc("#8f8a78")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.012
    brick.inputs["Brick Width"].default_value = 0.6
    brick.inputs["Row Height"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    return m


def mat_flat(name, hx, rough=0.7):
    m, nt, b = mat_base(name)
    b.inputs["Base Color"].default_value = hexc(hx)
    b.inputs["Roughness"].default_value = rough
    return m


def mat_panel():
    m, nt, b = mat_base("fluoro")
    b.inputs["Base Color"].default_value = hexc("#eef7ea")
    b.inputs["Emission Color"].default_value = hexc("#e9f6e4")
    b.inputs["Emission Strength"].default_value = 9.0
    return m


MATS = {
    "carpet": mat_carpet(),
    "wallpaper": mat_wallpaper(),
    "tiles": mat_tiles(),
    "skirting": mat_flat("skirting", "#6d5c45", 0.5),
    "frame": mat_flat("door_frame", "#8a7457", 0.5),
    "door_a": mat_flat("door_a", "#9b8160", 0.55),
    "door_b": mat_flat("door_b", "#9b8160", 0.55),
    "door_c": mat_flat("door_c", "#9b8160", 0.55),
    "fluoro": mat_panel(),
}


# ── geometry helpers ───────────────────────────────────────────────────────
def box(name, size, loc, mat, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(MATS[mat])
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    return o


def plane(name, size, loc, rot, mat, col):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(MATS[mat])
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    return o


def segment(i):
    """One corridor segment from y = i*L to (i+1)*L. Returns its collection."""
    col = bpy.data.collections.new(f"seg{i}")
    sc.collection.children.link(col)
    y0 = i * L
    yc = y0 + L / 2
    plane(f"floor{i}", (W, L), (0, yc, 0), (0, 0, 0), "carpet", col)
    plane(f"ceil{i}", (W, L), (0, yc, H), (math.pi, 0, 0), "tiles", col)
    plane(f"wallL{i}", (L, H), (-W / 2, yc, H / 2), (math.pi / 2, 0, math.pi / 2), "wallpaper", col)
    plane(f"wallR{i}", (L, H), (W / 2, yc, H / 2), (math.pi / 2, 0, -math.pi / 2), "wallpaper", col)
    box(f"skirtL{i}", (0.02, L, 0.09), (-W / 2 + 0.01, yc, 0.045), "skirting", col)
    box(f"skirtR{i}", (0.02, L, 0.09), (W / 2 - 0.01, yc, 0.045), "skirting", col)
    # two fluorescent panels per segment, slightly proud of the ceiling
    for k, fy in enumerate((0.25, 0.75)):
        box(f"fluoro{i}_{k}", (0.6, 1.2, 0.02), (0, y0 + fy * L, H - 0.012), "fluoro", col)
    # doors: (side, y fraction, material)
    for k, (side, fy, dm) in enumerate((( -1, 0.22, "door_a"), (1, 0.55, "door_b"), (-1, 0.82, "door_c"))):
        x = side * (W / 2 - 0.02)
        y = y0 + fy * L
        box(f"frame{i}_{k}", (0.04, 1.0, 2.15), (x, y, 1.075), "frame", col)
        box(f"door{i}_{k}", (0.05, 0.86, 2.04), (x - side * 0.006, y, 1.02), dm, col)
    return col


# ── 1. the still: seven segments, volumetric haze ──────────────────────────
t = time.perf_counter()
cols = [segment(i) for i in range(-1, 6)]
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 2.5 * L, H / 2))
haze = bpy.context.active_object
haze.name = "haze"
haze.scale = (W + 0.2, 7.5 * L, H + 0.2)
vm = bpy.data.materials.new("haze")
vm.use_nodes = True
vnt = vm.node_tree
vnt.nodes.remove(vnt.nodes["Principled BSDF"])
pv = vnt.nodes.new("ShaderNodeVolumePrincipled")
pv.inputs["Density"].default_value = 0.06
pv.inputs["Anisotropy"].default_value = 0.35
pv.inputs["Color"].default_value = hexc("#efe8d8")
vnt.links.new(pv.outputs["Volume"], vnt.nodes["Material Output"].inputs["Volume"])
haze.data.materials.append(vm)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 24
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
cam.location = (0.25, 0.6, 1.55)
cam.rotation_euler = (math.radians(88), 0, math.radians(-2))
sc.camera = cam
REPORT["build_s"] = round(time.perf_counter() - t, 2)

sc.cycles.samples = args.still_samples
sc.cycles.use_adaptive_sampling = True
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = "OPTIX"
except TypeError:
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.max_bounces = 8
sc.cycles.volume_bounces = 1
sc.render.resolution_x = 1280
sc.render.resolution_y = 800
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "WEBP"
sc.render.image_settings.quality = 82
t = time.perf_counter()
sc.render.filepath = str(OUT / "corridor-still.webp")
bpy.ops.render.render(write_still=True)
REPORT["still_s"] = round(time.perf_counter() - t, 2)
REPORT["still"] = {"res": [1280, 800], "samples": args.still_samples, "volume_density": 0.06}

# same view without haze, to show what the volume adds
haze.hide_render = True
t = time.perf_counter()
sc.render.filepath = str(OUT / "corridor-still-nohaze.webp")
bpy.ops.render.render(write_still=True)
REPORT["still_nohaze_s"] = round(time.perf_counter() - t, 2)

# ── 2. bake the middle segment in context (segments -1, 0, 1 present) ─────
for c in cols:
    if c.name not in ("seg-1", "seg0", "seg1"):
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
bpy.data.objects.remove(haze, do_unlink=True)

mid = [o for o in bpy.data.collections["seg0"].objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in mid:
    o.select_set(True)
bpy.context.view_layer.objects.active = mid[0]
# object-space procedural textures: join AFTER baking would be ideal; for this proof, materials use Object
# coords only on wallpaper/tiles, whose objects are single planes, so joining first changes nothing visible
bpy.ops.object.join()
seg = bpy.context.active_object
seg.name = "corridor_segment"
uvl = seg.data.uv_layers.new(name="lightmap")
seg.data.uv_layers.active = uvl
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
t = time.perf_counter()
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")
REPORT["uv_s"] = round(time.perf_counter() - t, 2)

img = bpy.data.images.new("atlas", args.atlas, args.atlas, float_buffer=True)
for m in seg.data.materials:
    nt = m.node_tree
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = img
    nt.nodes.active = n
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "lightmap"
    nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])

sc.cycles.samples = args.bake_samples
sc.render.bake.margin = 8
sc.render.bake.margin_type = "EXTEND"
sc.render.bake.use_clear = True
sc.render.bake.target = "IMAGE_TEXTURES"
t = time.perf_counter()
bpy.ops.object.bake(type="COMBINED", margin=8, use_clear=True, uv_layer="lightmap", target="IMAGE_TEXTURES")
REPORT["bake_s"] = round(time.perf_counter() - t, 2)
REPORT["bake"] = {"atlas": args.atlas, "samples": args.bake_samples, "pass": "COMBINED"}

# display-referred atlas (through AgX), saved as PNG then used as the export texture
sc.render.image_settings.file_format = "PNG"
png = OUT / "corridor-atlas.png"
img.save_render(str(png), scene=sc)
tex = bpy.data.images.load(str(png), check_existing=False)
tex.colorspace_settings.name = "sRGB"

# ── 3. unlit export materials (one per source material: doors stay addressable) ──
for slot in seg.material_slots:
    src = slot.material
    m = bpy.data.materials.new(src.name)  # Blender suffixes .001; renamed below
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "lightmap"
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = tex
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(uvn.outputs["UV"], im.inputs["Vector"])
    nt.links.new(im.outputs["Color"], em.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], outn.inputs["Surface"])
    m.use_backface_culling = True
    name = src.name
    src.name = "_src_" + name
    m.name = name
    slot.material = m
while len(seg.data.uv_layers) > 1:
    for u in list(seg.data.uv_layers):
        if u.name != "lightmap":
            seg.data.uv_layers.remove(u)
            break

# delete the context segments, keep the middle one only
for cname in ("seg-1", "seg1"):
    for o in list(bpy.data.collections[cname].objects):
        bpy.data.objects.remove(o, do_unlink=True)
for o in list(sc.objects):
    if o.type == "CAMERA":
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
seg.select_set(True)
bpy.context.view_layer.objects.active = seg
glb = OUT / "corridor.glb"
t = time.perf_counter()
bpy.ops.export_scene.gltf(
    filepath=str(glb), export_format="GLB", use_selection=True, export_image_format="WEBP",
    export_image_quality=82, export_apply=True, export_yup=True, export_texcoords=True, export_normals=False,
    export_materials="EXPORT",
)
REPORT["export_s"] = round(time.perf_counter() - t, 2)
REPORT["glb_bytes"] = glb.stat().st_size
REPORT["tris"] = sum(len(p.vertices) - 2 for p in seg.data.polygons)
REPORT["segment_m"] = [W, L, H]
REPORT["total_s"] = round(time.perf_counter() - T0, 2)
(OUT / "report.json").write_text(json.dumps(REPORT, indent=2))
print("REPORT", json.dumps(REPORT))
