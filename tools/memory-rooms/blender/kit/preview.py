"""Kit preview harness: build pieces on a neutral studio floor, check them, render a contact sheet.

    blender -b --factory-startup --python tools/memory-rooms/blender/kit/preview.py -- \
        --pieces bed,sofa,lamp --out <dir> [--samples 64] [--scene <scene.json>] [--variants]
        [--tile 640x480] [--cols 5] [--no-render] [--materials]

  --pieces     comma list of kit names, or `all` (every interior piece) [default all]
  --scene      also build every object of this scene.json whose kit is in --pieces, with its own spec
               (placed at the origin, rotY 0) -> <out>/scene/<id>.png + <out>/contact_scene.png
  --variants   also build the param variants in VARIANTS (round table, tall plant, map frame, ...)
  --materials  render a swatch of every material + floor / wall / ground finish -> contact_materials.png
  --no-render  build + check only (fast)

For every built piece it prints the build time, triangle count and a bounding-box check against `size`
(any side more than 1 cm outside the box, or a base that does not touch z = 0, is flagged).
Renders: <out>/<id>.png per piece and <out>/contact_sheet.png (a numpy-assembled grid).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BL = HERE.parent
if str(BL) not in sys.path:
    sys.path.insert(0, str(BL))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import common  # noqa: E402
import materials  # noqa: E402
import scene_io  # noqa: E402
from kit import KitContext, build_object  # noqa: E402
from kit import _util as U  # noqa: E402

INTERIOR = ["box", "cylinder", "bed", "bunk", "sofa", "armchair", "table", "desk", "chair", "stool", "shelf",
            "cabinet", "counter", "bar", "fridge", "tv", "rug", "lamp", "pendant", "plant", "frame", "curtain", "sign"]

# Typical specs used when a piece is previewed on its own.
DEFAULTS = {
    "box": dict(size=[0.5, 0.45, 0.5], color="#c9a273", material="pine"),
    "cylinder": dict(size=[0.42, 0.48, 0.42], color="#b56a45", material="ceramic"),
    "bed": dict(size=[1.53, 1.05, 2.03], color="#e7e1d5", material="linen", accent="#9a6f4a", accentMaterial="oak"),
    "bunk": dict(size=[0.99, 1.65, 1.98], color="#d9d2c4", material="linen", accent="#c9a273", accentMaterial="pine",
                 params={"ladder": "right"}),
    "sofa": dict(size=[2.1, 0.85, 0.92], color="#7d8a7a", material="linen", accent="#5e3f2a", accentMaterial="walnut"),
    "armchair": dict(size=[0.82, 0.88, 0.84], color="#9c6b4e", material="velvet", accent="#3a2a1e",
                     accentMaterial="walnut"),
    "table": dict(size=[1.6, 0.75, 0.9], color="#a8784a", material="oak"),
    "desk": dict(size=[1.2, 0.75, 0.6], color="#7a5a3c", material="walnut", accent="#c49a4a", accentMaterial="brass"),
    "chair": dict(size=[0.46, 0.88, 0.5], color="#3f4a5c", material="oak"),
    "stool": dict(size=[0.4, 0.75, 0.4], color="#a8784a", material="oak", accent="#2b2b2b", accentMaterial="metal"),
    "shelf": dict(size=[0.8, 1.8, 0.32], color="#8a6a4a", material="pine", params={"shelves": 4, "books": True}),
    "cabinet": dict(size=[0.45, 0.55, 0.4], color="#7a5a3c", material="walnut", accent="#c49a4a",
                    accentMaterial="brass"),
    "counter": dict(size=[1.8, 0.91, 0.62], color="#5d7a78", material="plastic", accent="#e9e6e0",
                    accentMaterial="marble", params={"sink": 0.6}),
    "bar": dict(size=[2.4, 1.07, 0.75], color="#5e3f2a", material="walnut", accent="#c49a4a", accentMaterial="brass"),
    "fridge": dict(size=[0.76, 1.78, 0.74], color="#d5d8dc", material="metal"),
    "tv": dict(size=[1.23, 0.78, 0.25], color="#1d1e20", material="plastic", params={"on": True}),
    "rug": dict(size=[1.6, 0.012, 1.1], color="#c8a46a", material="wool", accent="#8a4f3a"),
    "lamp": dict(size=[0.3, 0.52, 0.3], color="#f2e6c8", material="linen", accent="#3c5a6b", accentMaterial="ceramic"),
    "pendant": dict(size=[0.36, 0.55, 0.36], color="#e8dcc4", material="paper"),
    "plant": dict(size=[0.45, 0.95, 0.45], color="#4f7a4a", material="plant", accent="#b56a45",
                  accentMaterial="ceramic"),
    "frame": dict(size=[0.7, 0.5, 0.03], color="#2d3340", accent="#d9744a", params={"art": "abstract"}),
    "curtain": dict(size=[1.9, 1.7, 0.1], color="#56677f", material="linen", params={"open": 0.6}),
    "sign": dict(size=[1.2, 0.42, 0.08], color="#23313b", accent="#ffcf7a", params={"text": "OPEN", "lit": True}),
}

VARIANTS = [
    ("table-round", "table", dict(size=[1.0, 0.75, 1.0], color="#5e3f2a", material="walnut", params={"shape": "round"})),
    ("table-cafe", "table", dict(size=[0.7, 0.74, 0.7], color="#d8d4cc", material="marble", accent="#2b2b2b",
                                  accentMaterial="metal", params={"shape": "round", "legs": "pedestal"})),
    ("sofa-2", "sofa", dict(size=[1.6, 0.8, 0.86], color="#6b4630", material="leather", params={"seats": 2})),
    ("bed-single", "bed", dict(size=[0.99, 0.55, 1.91], color="#ddd6c8", material="linen", accent="#56677f",
                                accentMaterial="wool")),
    ("plant-tall", "plant", dict(size=[0.35, 1.1, 0.35], color="#3f6b45", accent="#e9e4da", accentMaterial="ceramic",
                                  params={"kind": "tall"})),
    ("plant-succulent", "plant", dict(size=[0.18, 0.16, 0.18], color="#7fa38a", accent="#c9b8a0",
                                       accentMaterial="ceramic", params={"kind": "succulent"})),
    ("frame-photo", "frame", dict(size=[0.5, 0.4, 0.025], color="#c9a273", material="oak", accent="#7fa7c9",
                                   params={"art": "photo"})),
    ("frame-map", "frame", dict(size=[0.9, 0.6, 0.03], color="#1f1f1f", material="metal", accent="#4a6670",
                                 params={"art": "map"})),
    ("rug-stripe", "rug", dict(size=[2.0, 0.01, 1.4], color="#e3d9c6", accent="#3c5a6b", params={"pattern": "stripe"})),
    ("curtain-closed", "curtain", dict(size=[1.4, 2.2, 0.1], color="#e9e2d4", material="linen", params={"open": 0.0})),
    ("lamp-floor", "lamp", dict(size=[0.45, 1.6, 0.45], color="#efe4cf", material="linen", accent="#2b2b2b",
                                 accentMaterial="metal")),
    ("pendant-dome", "pendant", dict(size=[0.4, 0.6, 0.4], color="#2f4a3a", material="metal", accent="#c49a4a",
                                      accentMaterial="brass")),
    ("sign-diner", "sign", dict(size=[4.5, 1.4, 0.25], color="#c2453a", accent="#fff3d6",
                                 params={"text": "DINER", "lit": True})),
    ("cabinet-tall", "cabinet", dict(size=[0.9, 1.2, 0.45], color="#e8e2d6", material="plaster", accent="#2b2b2b",
                                      accentMaterial="metal")),
    ("tv-wall", "tv", dict(size=[1.45, 0.84, 0.06], params={"stand": False})),
]

FRONT_DIR = Vector((0.95, -1.4, 0.95)).normalized()  # camera from front-right-above (front = -y)


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pieces", default="all")
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--scene", default=None)
    ap.add_argument("--variants", action="store_true")
    ap.add_argument("--materials", action="store_true")
    ap.add_argument("--tile", default="640x480")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--only-scene", action="store_true", help="skip the default-spec pieces")
    return common.script_args(ap)


# ── studio ────────────────────────────────────────────────────────────────────

class Studio:
    def __init__(self, scene, tile, samples):
        self.scene = scene
        tw, th = (int(v) for v in tile.lower().split("x"))
        common.set_render(scene, samples=samples, res_x=tw, res_y=th)
        r = scene.render
        r.use_stamp = True
        for p in r.bl_rna.properties:
            if p.identifier.startswith("use_stamp_") and p.identifier not in ("use_stamp_note",):
                try:
                    setattr(r, p.identifier, False)
                except (AttributeError, TypeError):
                    pass
        r.use_stamp_note = True
        r.stamp_font_size = 16
        r.stamp_background = (0.08, 0.08, 0.09, 0.75)
        r.stamp_foreground = (1, 1, 1, 1)

        world = bpy.data.worlds.new("studio")
        if world.node_tree is None:
            world.use_nodes = True
        bg = world.node_tree.nodes["Background"]
        bg.inputs["Color"].default_value = (0.62, 0.64, 0.68, 1.0)
        bg.inputs["Strength"].default_value = 0.3
        scene.world = world

        me = bpy.data.meshes.new("studio_floor")
        s = 40.0
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        self.floor = bpy.data.objects.new("studio_floor", me)
        me.materials.append(materials.get("plaster", "#d3cfc8", paint=True))
        scene.collection.objects.link(self.floor)

        self.lights = []
        for name, energy, size in (("key", 300.0, 1.6), ("fill", 70.0, 2.4), ("rim", 160.0, 1.2)):
            ld = bpy.data.lights.new(name, "AREA")
            ld.shape = "DISK"
            ld.size = size
            ld.energy = energy
            ld.color = {"key": (1.0, 0.95, 0.88), "fill": (0.86, 0.92, 1.0), "rim": (1.0, 1.0, 1.0)}[name]
            ob = bpy.data.objects.new(name, ld)
            scene.collection.objects.link(ob)
            self.lights.append((ob, energy, size))

        cd = bpy.data.cameras.new("cam")
        cd.lens = 55
        cd.sensor_fit = "AUTO"
        cd.clip_start = 0.01
        cd.clip_end = 500
        self.cam = bpy.data.objects.new("cam", cd)
        scene.collection.objects.link(self.cam)
        scene.camera = self.cam

    def frame(self, lo, hi):
        c = (lo + hi) / 2
        size = hi - lo
        r = max(0.5 * size.length, 0.08)
        s = max(r, 0.35)
        offsets = {"key": Vector((-2.2, -2.6, 3.2)), "fill": Vector((3.0, -1.6, 1.4)), "rim": Vector((-1.2, 3.0, 2.8))}
        for ob, energy, size_l in self.lights:
            pos = c + offsets[ob.name] * s
            ob.location = pos
            ob.rotation_euler = (c - pos).to_track_quat("-Z", "Y").to_euler()
            ob.data.energy = energy * s * s
            ob.data.size = size_l * s
        tw, th = self.scene.render.resolution_x, self.scene.render.resolution_y
        vfov = 2 * math.atan(18.0 / self.cam.data.lens * min(1.0, th / tw))
        dist = r / math.sin(vfov / 2) * 1.02
        pos = c + FRONT_DIR * dist
        self.cam.location = pos
        self.cam.rotation_euler = (c - pos).to_track_quat("-Z", "Y").to_euler()

    def render(self, label, path):
        self.scene.render.stamp_note_text = label
        return common.render_to(self.scene, self.cam, path)


# ── build + check ─────────────────────────────────────────────────────────────

def remove_tree(root):
    obs = []
    stack = [root]
    while stack:
        o = stack.pop()
        obs.append(o)
        stack.extend(o.children)
    for o in obs:
        bpy.data.objects.remove(o)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)
    for cu in list(bpy.data.curves):
        if cu.users == 0:
            bpy.data.curves.remove(cu)


def check(spec, lo, hi, tol=0.01):
    w, h, d = (float(v) for v in spec["size"])
    problems = []
    for axis, a, b, half in (("x", lo.x, hi.x, w / 2), ("y", lo.y, hi.y, d / 2)):
        if a < -half - tol:
            problems.append(f"-{axis} by {(-half - a) * 100:.1f} cm")
        if b > half + tol:
            problems.append(f"+{axis} by {(b - half) * 100:.1f} cm")
    if hi.z > h + tol:
        problems.append(f"top by {(hi.z - h) * 100:.1f} cm")
    if lo.z < -tol:
        problems.append(f"below floor by {-lo.z * 100:.1f} cm")
    if lo.z > tol:
        problems.append(f"floats {lo.z * 100:.1f} cm above z=0")
    return problems


def run_specs(ctx, studio, specs, out_dir, render, label_prefix=""):
    rows = []
    paths = []
    for spec in specs:
        spec = dict(spec)
        spec["at"] = [0, 0, 0]
        spec["rotY"] = 0
        t0 = time.perf_counter()
        try:
            root = build_object(ctx, spec)
        except Exception as e:  # report, keep going
            import traceback

            traceback.print_exc()
            rows.append((spec["id"], spec["kit"], -1, 0, [f"BUILD FAILED: {e}"]))
            continue
        dt = time.perf_counter() - t0
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, 0)
        lo, hi = U.bounds([root])
        tris = U.tri_count([root])
        problems = check(spec, lo, hi)
        rows.append((spec["id"], spec["kit"], dt, tris, problems))
        print(f"[preview] {spec['id']:<18} {spec['kit']:<9} {dt:6.2f}s {tris:7d} tris  "
              f"bbox x[{lo.x:+.3f},{hi.x:+.3f}] y[{lo.y:+.3f},{hi.y:+.3f}] z[{lo.z:+.3f},{hi.z:+.3f}]"
              + (f"  !! {'; '.join(problems)}" if problems else "  ok"), flush=True)
        if render:
            w, h, d = (float(v) for v in spec["size"])
            studio.frame(Vector((-w / 2, -d / 2, 0.0)), Vector((w / 2, d / 2, h)))
            label = f"{label_prefix}{spec['id']}  ({spec['kit']})  {dt:.1f}s  {tris // 1000}k tris"
            p = studio.render(label, out_dir / f"{spec['id']}.png")
            paths.append(p)
        remove_tree(root)
    return rows, paths


def contact_sheet(paths, out_path, cols):
    if not paths:
        return None
    imgs = [bpy.data.images.load(str(p), check_existing=False) for p in paths]
    tw, th = imgs[0].size
    cols = max(1, min(cols, len(imgs)))
    rows = math.ceil(len(imgs) / cols)
    sheet = np.full((rows * th, cols * tw, 4), 0.12, dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, im in enumerate(imgs):
        if tuple(im.size) != (tw, th):
            continue
        px = np.empty(tw * th * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        px = px.reshape(th, tw, 4)
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * th
        sheet[y0:y0 + th, c * tw:(c + 1) * tw] = px
        sheet[y0:y0 + th, c * tw:(c + 1) * tw, 3] = 1.0
    img = bpy.data.images.new("contact_sheet", cols * tw, rows * th, alpha=False)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = str(out_path)
    img.file_format = "PNG"
    img.save()
    for im in imgs:
        bpy.data.images.remove(im)
    bpy.data.images.remove(img)
    print(f"[preview] contact sheet -> {out_path}")
    return out_path


def material_swatches(ctx, studio, out_dir, render):
    """One swatch per material and per shell finish."""
    import bmesh

    items = [(n, materials.get(n), "obj") for n in materials.NAMES]
    items += [(f"floor-{f}", materials.floor(f), "shell") for f in materials.FLOOR]
    items += [(f"wall-{f}", materials.wall(f), "shell") for f in materials.WALL]
    items += [(f"ground-{f}", materials.ground(f), "shell") for f in materials.GROUND]
    paths = []
    for label, mat, kind in items:
        obs = []
        if kind == "obj":
            obs.append(U.box(ctx, "sw_box", (-0.32, -0.18, 0.0), (0.04, 0.18, 0.36), mat, bevel=0.02, segments=3))
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.15,
                                      matrix=__import__("mathutils").Matrix.Translation((0.22, -0.02, 0.15)))
            obs.append(U.obj_from_bm(ctx, "sw_ball", bm, [mat], smooth=True))
            lo, hi = Vector((-0.34, -0.2, 0)), Vector((0.38, 0.2, 0.36))
        else:
            obs.append(U.box(ctx, "sw_floor", (-0.8, -0.6, 0.0), (0.8, 0.6, 0.03), mat, bevel=0.004))
            obs.append(U.box(ctx, "sw_wall", (-0.8, 0.6, 0.0), (0.8, 0.66, 1.0), mat, bevel=0.004))
            lo, hi = Vector((-0.8, -0.6, 0)), Vector((0.8, 0.66, 1.0))
        if render:
            studio.frame(lo, hi)
            paths.append(studio.render(f"{label}  [{mat.name}]", out_dir / f"{label}.png"))
        for o in obs:
            bpy.data.objects.remove(o)
    return paths


def main():
    args = parse()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    scene = common.reset_scene()
    studio = Studio(scene, args.tile, args.samples)
    coll = bpy.data.collections.new("kit_preview")
    scene.collection.children.link(coll)
    render = not args.no_render

    pieces = INTERIOR if args.pieces in ("all", "") else [p.strip() for p in args.pieces.split(",") if p.strip()]
    scene_dict = {"version": 1, "kind": "interior", "title": "kit preview", "objects": [], "cameras": []}
    if args.scene:
        scene_dict = scene_io.load_scene(args.scene)
    ctx = KitContext(scene=scene_dict, work=out, collection=coll)

    report = {"pieces": [], "scene": []}
    if args.materials:
        mpaths = material_swatches(ctx, studio, out / "materials", render)
        contact_sheet(mpaths, out / "contact_materials.png", 6)

    all_paths = []
    if not args.only_scene:
        specs = []
        for p in pieces:
            spec = {"id": p, "kit": p, **DEFAULTS.get(p, {"size": [0.5, 0.5, 0.5]})}
            specs.append(spec)
        if args.variants:
            for vid, kit, s in VARIANTS:
                if kit in pieces:
                    specs.append({"id": vid, "kit": kit, **s})
        rows, paths = run_specs(ctx, studio, specs, out, render)
        report["pieces"] = rows
        all_paths += paths
        if render:
            contact_sheet(paths, out / "contact_sheet.png", args.cols)

    if args.scene:
        specs = [o for o in scene_dict["objects"] if o["kit"] in pieces]
        rows, paths = run_specs(ctx, studio, specs, out / "scene", render, label_prefix="scene: ")
        report["scene"] = rows
        total = sum(r[2] for r in rows if r[2] > 0)
        print(f"[preview] scene objects build total: {total:.2f}s for {len(rows)} objects")
        if render:
            contact_sheet(paths, out / "contact_scene.png", args.cols)

    bad = [(r[0], r[4]) for r in report["pieces"] + report["scene"] if r[4]]
    print("[preview] ---- summary ----")
    for name, kit, dt, tris, problems in report["pieces"] + report["scene"]:
        print(f"  {name:<18} {kit:<9} {dt:6.2f}s {tris:7d} tris  {'; '.join(problems) if problems else 'ok'}")
    print(f"[preview] {len(bad)} piece(s) with bounding-box problems")
    (out / "preview-report.json").write_text(json.dumps(
        {k: [dict(id=r[0], kit=r[1], seconds=round(r[2], 3), tris=r[3], problems=r[4]) for r in v]
         for k, v in report.items()}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
