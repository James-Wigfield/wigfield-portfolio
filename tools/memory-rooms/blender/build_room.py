"""scene.json -> room.blend + Cycles renders (CONTRACTS.md section 5).

    blender.exe -b --factory-startup --python tools/memory-rooms/blender/build_room.py -- \
        --scene <work>/scene.json --out <work> [--samples 64] [--res 1200] [--only cam1,top] [--no-render]
    -> <work>/room.blend, <work>/renders/{cam1..camN,top,three-quarter}.png, <work>/build-report.json

Never aborts a room for one bad piece: a missing kit module or a piece that raises is replaced by a
bevelled box of the same size and listed under `fallbacks` in the report. Exits 1 (and prints every
problem) when scene.json is invalid.
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

import common  # noqa: E402
from common import log  # noqa: E402

KIT_DIR = HERE / "kit"
THREE_QUARTER_FOV = 34.0
THREE_QUARTER_ELEV = {"interior": 36.0, "exterior": 30.0}


def parse():
    p = argparse.ArgumentParser(prog="build_room.py")
    p.add_argument("--scene", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--res", type=int, default=1200)
    p.add_argument("--only", default="")
    p.add_argument("--no-render", action="store_true")
    return common.script_args(p)


# ── cameras ───────────────────────────────────────────────────────────────────
def make_camera(coll, name, pos, look, fov_deg=None, roll=0.0, ortho_scale=None):
    import bpy
    from mathutils import Quaternion, Vector

    cam = bpy.data.cameras.new(name)
    cam.sensor_fit = "AUTO"
    cam.clip_start = 0.02
    cam.clip_end = 2000.0
    if ortho_scale is not None:
        cam.type = "ORTHO"
        cam.ortho_scale = float(ortho_scale)
    else:
        cam.angle = math.radians(fov_deg or 70.0)
    ob = bpy.data.objects.new(name, cam)
    coll.objects.link(ob)
    ob.location = Vector(pos)
    d = Vector(look) - Vector(pos)
    if d.length < 1e-6:
        d = Vector((0, 0, -1))
    if abs(d.normalized().z) > 0.9999:  # straight down: north (+y) is up in the image
        q = Quaternion() if d.z < 0 else Quaternion((0, 1, 0, 0))
    else:
        q = d.to_track_quat("-Z", "Y")
    if roll:
        q = q @ Quaternion((0, 0, 1), -math.radians(roll))  # positive = clockwise for the photographer
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = q
    return ob


def res_for(aspect, long_edge):
    if aspect >= 1:
        return int(long_edge), max(8, round(long_edge / aspect))
    return max(8, round(long_edge * aspect)), int(long_edge)


def fit_perspective(points, az_deg, el_deg, fov_deg, aspect, margin=0.05):
    """Camera position + lens shift that frames `points` from azimuth/elevation (deg)."""
    from mathutils import Vector

    pts = [Vector(p) for p in points]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (mn + mx) / 2
    az, el = math.radians(az_deg), math.radians(el_deg)
    back = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    fwd = -back
    q = fwd.to_track_quat("-Z", "Y")
    R = q.to_matrix()
    right, up = R @ Vector((1, 0, 0)), R @ Vector((0, 1, 0))
    half = math.tan(math.radians(fov_deg) / 2)
    tan_h, tan_v = (half, half / aspect) if aspect >= 1 else (half * aspect, half)
    dist = (mx - mn).length / (2 * math.sin(math.radians(fov_deg) / 2))
    sx = sy = 0.0
    for _ in range(12):
        cam = center + back * dist
        xs, ys = [], []
        for p in pts:
            d = p - cam
            z = max(1e-3, d.dot(fwd))
            xs.append(d.dot(right) / z / tan_h)
            ys.append(d.dot(up) / z / tan_v)
        sx, sy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        ext = max((max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2)
        dist *= ext / (1 - margin)
    cam = center + back * dist
    if aspect >= 1:
        shift = (sx / 2, sy / (2 * aspect))
    else:
        shift = (sx * aspect / 2, sy / 2)
    return cam, center, shift


def walls_facing(cam_pos, W, D):
    """Interior walls between the camera and the room (dollhouse: hide these)."""
    x, y = cam_pos[0], cam_pos[1]
    hide = []
    if y > 0:
        hide.append("wall_north")
    if y < -D:
        hide.append("wall_south")
    if x < 0:
        hide.append("wall_west")
    if x > W:
        hide.append("wall_east")
    return hide


def choose_interior_corner(scene, info):
    """Camera azimuth (deg, clockwise from north) over the corner whose two FAR walls hold the most
    windows, doors and wall-mounted things. Ties prefer the south-east corner."""
    W, D = info["W"], info["D"]
    score = {"north": 0.0, "south": 0.0, "east": 0.0, "west": 0.0}
    for o in scene["shell"].get("openings", []):
        score[o["wall"]] += 2.0 if o["type"] == "window" else 1.0
    block = {"north": 0.0, "south": 0.0, "east": 0.0, "west": 0.0}  # tall things the camera looks through
    for ob in scene.get("objects", []):
        x, y, z = ob["at"]
        w, h, d = ob["size"]
        r = max(w, d) / 2 + 0.15
        near = {"north": z - r <= 0, "south": z + r >= D, "west": x - r <= 0, "east": x + r >= W}
        tall = (y + h) > 1.1 and h > 0.9 and ob.get("mount") not in ("wall", "ceiling")
        hung = ob.get("mount") == "wall" or ob["kit"] in ("frame", "curtain")
        for wall, hit in near.items():
            if hit:
                score[wall] += 0.5
                if tall:
                    block[wall] += 3.0 + 2.0 * h * min(w, 1.5)  # blocks the view AND shows its back
                if hung:
                    block[wall] += 8.0  # would float in mid-air once its wall is cut away
    # camera azimuth -> (the two walls it looks AT, the two walls it looks THROUGH)
    corners = [(135, ("north", "west"), ("south", "east")), (225, ("north", "east"), ("south", "west")),
               (45, ("south", "west"), ("north", "east")), (315, ("south", "east"), ("north", "west"))]
    best = max(corners, key=lambda c: (score[c[1][0]] + score[c[1][1]] - block[c[2][0]] - block[c[2][1]],
                                       -corners.index(c)))
    return best[0]


def choose_exterior_azimuth(scene, sun_az):
    objs = scene.get("objects", [])
    if not objs:
        return 150.0
    main = max(objs, key=lambda o: (o["kit"] == "block", o["size"][0] * o["size"][2]))
    front = (180.0 - float(main.get("rotY", 0))) % 360
    cands = [(front + 40) % 360, (front - 40) % 360]

    def adist(a, b):
        return abs((a - b + 180) % 360 - 180)

    return min(cands, key=lambda a: adist(a, sun_az))


def bounds_points(info, roots):
    """World-space points to frame: the shell/site box and every object's bounding box."""
    from mathutils import Vector

    (x0, y0, z0), (x1, y1, z1) = info["bounds"]
    pts = [Vector((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    for root in roots.values():
        for ob in [root, *root.children_recursive]:
            if ob.type == "MESH":
                pts.extend(ob.matrix_world @ Vector(c) for c in ob.bound_box)
    return pts


# ── visibility for dollhouse renders ──────────────────────────────────────────
def set_hidden(names, hidden: bool):
    import bpy

    for nm in names:
        ob = bpy.data.objects.get(nm)
        if not ob:
            continue
        for o in [ob, *ob.children_recursive]:
            o.visible_camera = not hidden


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    args = parse()
    t_all = time.perf_counter()
    timings = {}
    import scene_io

    try:
        scene = scene_io.load_scene(args.scene)
    except scene_io.SceneError as e:
        print(str(e), flush=True)
        sys.exit(1)
    except (OSError, json.JSONDecodeError) as e:
        print(f"cannot read scene: {e}", flush=True)
        sys.exit(1)

    import bpy
    from mathutils import Vector

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / "renders").mkdir(exist_ok=True)

    t = time.perf_counter()
    bl_scene = common.reset_scene()
    common.set_render(bl_scene, samples=args.samples)
    devices = common.enable_gpu(bl_scene)
    log("devices", devices)

    import kit as kitmod
    import lighting
    import materials
    import mrgeo
    import shell

    material_problems: list = []
    mrgeo.install_material_guard(materials, material_problems)
    lighting.path_settings(bl_scene)
    agx_look = lighting.apply_look(bl_scene)

    room = bpy.data.collections.new("room")
    bl_scene.collection.children.link(room)
    cams = bpy.data.collections.new("cameras")
    bl_scene.collection.children.link(cams)

    kind = scene["kind"]
    if kind == "interior":
        info = shell.build_interior(scene, room)
    else:
        info = shell.build_site(scene, room)
    timings["shell"] = round(time.perf_counter() - t, 3)

    # objects
    t = time.perf_counter()
    ctx = kitmod.KitContext(scene=scene, work=out, collection=room)
    roots, specs, built, fallbacks, warnings = {}, {}, [], [], []
    for spec in scene.get("objects", []):
        t0 = time.perf_counter()
        name = spec["kit"]
        reason = None
        if name not in ("bespoke", "glb", "box") and not (KIT_DIR / f"{name}.py").exists():
            reason = f"kit/{name}.py not found"
        root = None
        if reason is None:
            before = set(bpy.data.objects)
            try:
                root = kitmod.build_object(ctx, spec)
            except Exception as e:  # never abort the room for one piece
                reason = f"{type(e).__name__}: {e}"
                traceback.print_exc()
                for ob in set(bpy.data.objects) - before:
                    bpy.data.objects.remove(ob, do_unlink=True)
                root = None
        if root is None:
            root = kitmod.build_object(ctx, {**spec, "kit": "box"})
            root["mr_kit"] = name
            root["mr_fallback"] = reason
            fallbacks.append({"id": spec["id"], "kit": name, "reason": reason})
            log(f"fallback box for {spec['id']} ({name}): {reason}")
        roots[spec["id"]] = root
        specs[spec["id"]] = spec
        parts = [o for o in root.children_recursive if o.type in ("MESH", "CURVE", "FONT")]
        built.append({"id": spec["id"], "kit": name, "parts": len(parts),
                      "ms": round((time.perf_counter() - t0) * 1000), "fallback": reason})
        if not parts:
            warnings.append(f"{spec['id']}: kit '{name}' produced no geometry")
    timings["objects"] = round(time.perf_counter() - t, 3)
    bpy.context.view_layer.update()

    # lights + world
    t = time.perf_counter()
    light_rep = lighting.setup(scene, bl_scene, info, roots, specs)
    timings["lights"] = round(time.perf_counter() - t, 3)

    # exteriors: for the photo renders only, the site's ground runs on to the horizon (never baked/exported)
    horizon = None
    if kind == "exterior":
        photo = bpy.data.collections.new("photo_only")
        bl_scene.collection.children.link(photo)
        g = scene["site"]["ground"]
        hm = shell.ground_mat(g.get("finish", "paving"), g.get("color"))
        mb = mrgeo.MB()
        R = 600.0
        mb.poly([(R * math.cos(2 * math.pi * k / 64), R * math.sin(2 * math.pi * k / 64), -0.004) for k in range(64)],
                hm, (0, 0, 1))
        horizon = mb.obj("horizon", photo, uv=False)
        horizon.hide_render = True

    # cameras
    render_jobs = []  # (name, cam_ob, (rx, ry), transparent, hide)
    for c in scene.get("cameras", []):
        aspect = float(c.get("aspect", 0.75))
        ob = make_camera(cams, f"cam{c['photo']}", scene_io.to_bl(c["pos"]), scene_io.to_bl(c["look"]),
                         c.get("fov", 70), c.get("roll", 0.0))
        render_jobs.append((f"cam{c['photo']}", ob, res_for(aspect, args.res), False, []))

    pts = bounds_points(info, roots)
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    if kind == "interior":
        (bx0, by0, _), (bx1, by1, _) = info["bounds"]
    else:
        bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
    ext_x, ext_y = bx1 - bx0, by1 - by0
    t_aspect = max(0.75, min(1.6, ext_x / max(ext_y, 1e-3)))
    m = 1.08
    scale = max(ext_x, ext_y * t_aspect) * m if t_aspect >= 1 else max(ext_y, ext_x / t_aspect) * m
    top = make_camera(cams, "top", ((bx0 + bx1) / 2, (by0 + by1) / 2, max(zs) + 20),
                      ((bx0 + bx1) / 2, (by0 + by1) / 2, 0), ortho_scale=scale)
    top.data.clip_end = max(zs) + 60
    top_hide = ["ceiling"]
    render_jobs.append(("top", top, res_for(t_aspect, args.res), True, top_hide))

    tq_aspect = 4 / 3
    hero = scene.get("hero")
    if hero:
        pos, look = scene_io.to_bl(hero["pos"]), scene_io.to_bl(hero["look"])
        tq = make_camera(cams, "three-quarter", pos, look, hero.get("fov", THREE_QUARTER_FOV))
        tq_how = "scene.hero"
    else:
        if kind == "interior":
            az = choose_interior_corner(scene, info)
        else:
            az = choose_exterior_azimuth(scene, light_rep.get("sun_az", 250))
            for L in light_rep["lights"]:
                if L["type"] == "sun":
                    az = choose_exterior_azimuth(scene, L["azimuth"])
        pos, center, shift = fit_perspective(pts, az, THREE_QUARTER_ELEV[kind], THREE_QUARTER_FOV, tq_aspect)
        tq = make_camera(cams, "three-quarter", pos, center, THREE_QUARTER_FOV)
        tq.data.shift_x, tq.data.shift_y = shift
        tq_how = f"auto azimuth {az:.0f}"
    hide = ["ceiling"]
    if kind == "interior":
        hide += walls_facing(tq.location, info["W"], info["D"])
    tq["mr_hide"] = ",".join(hide)
    tq["mr_res"] = [1600, 1200]
    render_jobs.append(("three-quarter", tq, res_for(tq_aspect, args.res), True, hide))

    # exposure: measured from the dollhouse view so every spot lands at the same brightness
    t = time.perf_counter()
    set_hidden(hide, True)
    bl_scene.render.film_transparent = True
    bl_scene.render.resolution_x, bl_scene.render.resolution_y = res_for(tq_aspect, args.res)
    exp_rep = lighting.auto_exposure(bl_scene, tq, out / "renders", scene)
    set_hidden(hide, False)
    timings["exposure"] = round(time.perf_counter() - t, 3)
    log("exposure", exp_rep)

    # remember everything bake_export needs
    txt = bpy.data.texts.get("scene.json") or bpy.data.texts.new("scene.json")
    txt.clear()
    txt.write(json.dumps(scene, indent=1))
    meta = {"kind": kind, "info": {k: v for k, v in info.items() if k in ("W", "D", "H", "t", "bounds")},
            "three_quarter": {"hide": hide, "how": tq_how}, "exposure": exp_rep, "mood": light_rep.get("mood"),
            "look": agx_look}
    bl_scene["mr_meta"] = json.dumps(meta)
    bl_scene.camera = tq

    t = time.perf_counter()
    blend = out / "room.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    timings["save"] = round(time.perf_counter() - t, 3)
    log("saved", blend)

    renders = {}
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    if not args.no_render:
        t = time.perf_counter()
        for name, cam, (rx, ry), transparent, hide_names in render_jobs:
            if only and name not in only:
                continue
            t0 = time.perf_counter()
            bl_scene.render.resolution_x, bl_scene.render.resolution_y = rx, ry
            bl_scene.render.film_transparent = transparent
            bl_scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
            set_hidden(hide_names, True)
            cleanup = None
            if kind == "interior" and name == "three-quarter":
                cleanup = lighting.dollhouse_fill(hide_names, info["W"], info["D"], info["H"], info["t"],
                                                  list(roots.values()), exp_rep["measured"], light_rep["mood"])
            if horizon is not None:
                horizon.hide_render = name not in [f"cam{c['photo']}" for c in scene.get("cameras", [])]
            path = common.render_to(bl_scene, cam, out / "renders" / f"{name}.png")
            set_hidden(hide_names, False)
            if cleanup:
                cleanup()
            if horizon is not None:
                horizon.hide_render = True
            renders[name] = {"path": str(path), "res": [rx, ry], "s": round(time.perf_counter() - t0, 2)}
            log("rendered", name, renders[name]["s"], "s")
        timings["render"] = round(time.perf_counter() - t, 3)

    timings["total"] = round(time.perf_counter() - t_all, 3)
    report = {
        "scene": str(Path(args.scene).resolve()), "out": str(out), "kind": kind, "title": scene["title"],
        "blender": bpy.app.version_string, "devices": devices, "samples": args.samples,
        "objects": built, "fallbacks": fallbacks, "warnings": warnings + material_problems,
        "lighting": light_rep, "exposure": exp_rep, "look": agx_look, "three_quarter": meta["three_quarter"],
        "renders": renders, "timings_s": timings, "blend": str(blend),
    }
    (out / "build-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    log("done", json.dumps(timings))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(2)
