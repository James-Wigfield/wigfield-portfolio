"""Lighting for a Memory Rooms spot: `style.mood` -> world + sun, `lights[]` -> Blender lights,
lamp shades that glow, a soft default fill, and an auto-exposure pass so every spot lands at the
same brightness (then `style.exposure` nudges it, in stops).

Interiors get a soft neutral world (brighter for camera rays, so windows read as daylight) and an
area light in every window for `window` lights. Exteriors get a sky texture (no sun disc) plus a
separate sun lamp, which keeps the shadows controllable. Glass never blocks light (glass objects
are invisible to shadow and diffuse rays, see shell.py), so sun patches fall through windows.
"""

from __future__ import annotations

import array
import math
from pathlib import Path

import bpy
from mathutils import Vector

from mrgeo import flat_emit, mix, shade
from scene_io import hex_rgb, to_bl

COMPASS = {"north": 0, "northeast": 45, "east": 90, "southeast": 135, "south": 180, "southwest": 225,
           "west": 270, "northwest": 315}

# Relative levels; auto-exposure sets the absolute brightness per mood (`target`).
MOODS = {
    "morning": dict(elev=22, az=110, sun="#ffe0bd", sun_e=3.2, sky_cam="#dfe8f6", amb="#c4d2e8", amb_e=0.55,
                    win="#e6edfb", win_k=1.0, fill=1.0, target=0.30, lamp_k=0.7),
    "day": dict(elev=48, az=200, sun="#fff2e0", sun_e=3.6, sky_cam="#e8eef8", amb="#d0dbee", amb_e=0.6,
                win="#f1f4fc", win_k=1.15, fill=1.0, target=0.32, lamp_k=0.6),
    "golden": dict(elev=12, az=255, sun="#ffc285", sun_e=3.4, sky_cam="#f6dcc0", amb="#d6c9c0", amb_e=0.5,
                   win="#ffe3c2", win_k=0.9, fill=0.85, target=0.28, lamp_k=0.8),
    "evening": dict(elev=4, az=285, sun="#ff9a5e", sun_e=1.6, sky_cam="#8494bd", amb="#5f6f98", amb_e=0.35,
                    win="#a7b6dc", win_k=0.4, fill=0.6, target=0.22, lamp_k=1.0),
    "night": dict(elev=35, az=160, sun="#a9bcff", sun_e=0.15, sky_cam="#1d2744", amb="#151c33", amb_e=0.25,
                  win="#40508a", win_k=0.12, fill=0.45, target=0.15, lamp_k=1.2),
    "overcast": dict(elev=40, az=180, sun="#e9edf2", sun_e=0.0, sky_cam="#d9dde3", amb="#c2c8d0", amb_e=0.75,
                     win="#eef1f5", win_k=1.3, fill=1.1, target=0.28, lamp_k=0.6),
}

# Blender watts (sun: W/m2) for intensity = 1.
BASE = {"lamp": 45.0, "pendant": 70.0, "ceiling": 160.0, "spot": 320.0, "area": 220.0, "window": 85.0}
DEFAULT_COLOR = {"lamp": "#ffd29a", "pendant": "#ffdcae", "ceiling": "#fff0dc", "spot": "#ffe6c4",
                 "area": "#fff4e6", "window": None, "sun": None}
GLOW_KITS = {"lamp", "pendant", "streetlight", "sign"}


def mood_of(scene: dict) -> str:
    return (scene.get("style") or {}).get("mood") or "day"


def _col(h):
    return (*hex_rgb(h), 1.0) if h else (1, 1, 1, 1)


def _light(coll, name, typ, loc, energy, color_hex, **kw):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = float(energy)
    ld.color = hex_rgb(color_hex) if color_hex else (1.0, 1.0, 1.0)
    for k, v in kw.items():
        setattr(ld, k, v)
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    coll.objects.link(ob)
    return ob


def _aim(ob, target: Vector):
    d = Vector(target) - ob.location
    if d.length < 1e-6:
        d = Vector((0, 0, -1))
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def sun_dir(az_deg, elev_deg) -> Vector:
    """Unit vector from the scene toward the sun (Blender axes: +y north, +x east)."""
    az, el = math.radians(az_deg), math.radians(elev_deg)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


# ── world ─────────────────────────────────────────────────────────────────────
def _world(bl_scene, kind, mood, M, sun_az, sun_el):
    w = bpy.data.worlds.new("mr_world")
    bl_scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg_cam = nt.nodes.new("ShaderNodeBackground")
    bg_lit = nt.nodes.new("ShaderNodeBackground")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mixn = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mixn.inputs[0])
    nt.links.new(bg_lit.outputs[0], mixn.inputs[1])
    nt.links.new(bg_cam.outputs[0], mixn.inputs[2])
    nt.links.new(mixn.outputs[0], out.inputs["Surface"])
    if kind == "exterior" and mood not in ("night", "overcast"):
        sky = nt.nodes.new("ShaderNodeTexSky")
        try:
            sky.sky_type = "MULTIPLE_SCATTERING"
        except TypeError:
            sky.sky_type = "SINGLE_SCATTERING"
        sky.sun_disc = False
        sky.sun_elevation = math.radians(max(0.5, sun_el))
        sky.sun_rotation = math.radians(sun_az)
        nt.links.new(sky.outputs[0], bg_cam.inputs["Color"])
        nt.links.new(sky.outputs[0], bg_lit.inputs["Color"])
        # the sky lights the shadows; the sun lamp does the rest (sun/sky balance per mood)
        k_lit = {"golden": 0.045, "evening": 0.2, "morning": 0.045}.get(mood, 0.04)
        k_cam = {"golden": 0.24, "evening": 0.45, "morning": 0.17}.get(mood, 0.13)
        bg_cam.inputs["Strength"].default_value = k_cam
        bg_lit.inputs["Strength"].default_value = k_lit
    else:
        # gradient-free soft world: brighter for camera rays (windows, exterior backgrounds)
        bg_cam.inputs["Color"].default_value = _col(M["sky_cam"])
        bg_cam.inputs["Strength"].default_value = 1.0 if kind == "interior" else 0.9
        bg_lit.inputs["Color"].default_value = _col(M["amb"])
        bg_lit.inputs["Strength"].default_value = M["amb_e"] if kind == "interior" else M["amb_e"] * 0.9
    return w


# ── glowing shades ────────────────────────────────────────────────────────────
def _descendants(ob):
    out = []
    for c in ob.children:
        out.append(c)
        out.extend(_descendants(c))
    return out


def _world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _inside(p, bb, pad=0.0):
    return all(bb[0][i] - pad <= p[i] <= bb[1][i] + pad for i in range(3))


def _glow(root, spec, light_pos: Vector, light_hex: str, strength: float, report: list):
    """Make the light's object glow: parts named *shade* get an emissive material; any part that would
    trap the light (its bbox holds the light) stops casting shadows so the light gets out."""
    bpy.context.view_layer.update()
    shade_col = spec.get("color") or "#f2e6c8"
    emit_hex = mix(shade(light_hex, 0.15), shade_col, 0.35)
    k = max(0.6, min(6.0, 3.0 * strength))
    mat = flat_emit(f"emit_glow_{spec['id']}", emit_hex, k)
    glowing = []
    for ob in _descendants(root):
        if ob.type != "MESH":
            continue
        nm = ob.name.lower()
        if "shade" in nm or "bulb" in nm or "lens" in nm:
            for i in range(len(ob.material_slots)):
                ob.material_slots[i].material = mat
            if not ob.material_slots:
                ob.data.materials.append(mat)
            ob.visible_shadow = False
            glowing.append(ob.name)
        elif _inside(light_pos, _world_bbox(ob), pad=0.01):
            ob.visible_shadow = False
    report.append({"object": spec["id"], "glowing": glowing})


# ── main entry ────────────────────────────────────────────────────────────────
def setup(scene: dict, bl_scene, info: dict, roots: dict, specs: dict) -> dict:
    kind = scene["kind"]
    mood = mood_of(scene)
    M = MOODS.get(mood, MOODS["day"])
    coll = bpy.data.collections.new("lights")
    bl_scene.collection.children.link(coll)
    lights = list(scene.get("lights") or [])
    rep = {"mood": mood, "lights": [], "defaults": [], "glow": []}

    sun_spec = next((l for l in lights if l["type"] == "sun"), None)
    if sun_spec:
        az = sun_spec.get("azimuth")
        if az is None:
            az = COMPASS.get(sun_spec.get("from", ""), M["az"])
        el = sun_spec.get("elevation", M["elev"])
    else:
        az, el = M["az"], M["elev"]
    _world(bl_scene, kind, mood, M, az, el)

    interior_sources = {"lamp", "pendant", "ceiling", "spot", "area", "window"}
    has_interior = any(l["type"] in interior_sources for l in lights)
    if kind == "interior" and not lights:
        lights = [{"type": "window", "intensity": 1.0}]
        if mood in ("morning", "day", "golden"):
            lights.append({"type": "sun"})
            sun_spec = lights[-1]
        if not info.get("windows"):
            W, D, H = info["W"], info["D"], info["H"]
            lights.append({"type": "ceiling", "at": [W / 2, H - 0.02, D / 2], "size": max(0.6, min(W, D) * 0.4)})
        rep["defaults"].append("no lights[]: window + mood sun (+ ceiling if windowless)")
    if kind == "exterior" and not sun_spec and M["sun_e"] > 0:
        lights.append({"type": "sun"})
        rep["defaults"].append(f"mood sun ({mood})")

    for i, L in enumerate(lights):
        typ = L["type"]
        inten = float(L.get("intensity", 1.0))
        col = L.get("color") or DEFAULT_COLOR.get(typ)
        name = f"light{i}_{typ}"
        if typ == "sun":
            a = L.get("azimuth", COMPASS.get(L.get("from", ""), az if L is sun_spec else M["az"]))
            e = L.get("elevation", el if L is sun_spec else M["elev"])
            energy = M["sun_e"] * inten if M["sun_e"] > 0 else 0.6 * inten
            ob = _light(coll, name, "SUN", (0, 0, 0), energy, col or M["sun"], angle=math.radians(2.5))
            ob.rotation_euler = sun_dir(a, e).to_track_quat("Z", "Y").to_euler()
            rep["lights"].append({"type": "sun", "azimuth": a, "elevation": e, "energy": round(energy, 3)})
            continue
        if typ == "window":
            if kind != "interior":
                continue
            for k, win in enumerate(info.get("windows", [])):
                area = win["width"] * win["height"]
                energy = BASE["window"] * area * inten * M["win_k"]
                c = Vector(win["center"])
                ob = _light(coll, f"{name}_{k}", "AREA", c, energy, col or M["win"], shape="RECTANGLE",
                            size=win["width"] * 0.95, size_y=win["height"] * 0.95)
                inward = Vector(win["inward"])
                ob.rotation_euler = inward.to_track_quat("-Z", "Y").to_euler()  # emits along local -Z
                ob.visible_camera = False
                ob.visible_glossy = False
                rep["lights"].append({"type": "window", "wall": win["wall"], "energy": round(energy, 2)})
            continue
        pos = Vector(to_bl(L["at"]))
        if kind == "exterior" and typ in ("spot", "area"):
            inten *= 3.0
        if typ in ("lamp", "pendant"):
            r = float(L.get("size", 0.05 if typ == "lamp" else 0.08))
            energy = BASE[typ] * inten * M["lamp_k"]
            ob = _light(coll, name, "POINT", pos, energy, col, shadow_soft_size=r)
        elif typ == "ceiling":
            sz = float(L.get("size", 0.8))
            if kind == "interior":
                pos.z = min(pos.z, info["H"] - 0.03)
            energy = BASE["ceiling"] * inten * (sz / 0.8) ** 2 * M["lamp_k"]
            ob = _light(coll, name, "AREA", pos, energy, col, shape="SQUARE", size=sz)
            ob.rotation_euler = (0, 0, 0)
        elif typ == "spot":
            energy = BASE["spot"] * inten * M["lamp_k"]
            ob = _light(coll, name, "SPOT", pos, energy, col, spot_size=math.radians(70), spot_blend=0.65,
                        shadow_soft_size=float(L.get("size", 0.06)))
            _aim(ob, Vector(to_bl(L["look"])) if L.get("look") else pos - Vector((0, 0, 1)))
        else:  # area
            sz = float(L.get("size", 1.0))
            energy = BASE["area"] * inten * sz * sz
            ob = _light(coll, name, "AREA", pos, energy, col, shape="SQUARE", size=sz)
            _aim(ob, Vector(to_bl(L["look"])) if L.get("look") else pos - Vector((0, 0, 1)))
            ob.visible_camera = False
        rep["lights"].append({"type": typ, "at": L["at"], "energy": round(energy, 2)})

        # which object glows: the named one, or a glowing kit piece the light sits in
        oid = L.get("object")
        if not oid:
            for sid, root in roots.items():
                if specs[sid]["kit"] in GLOW_KITS:
                    descs = [d for d in _descendants(root) if d.type == "MESH"]
                    if any(_inside(pos, _world_bbox(d), pad=0.35) for d in descs):
                        oid = sid
                        break
        if oid and oid in roots:
            _glow(roots[oid], specs[oid], pos, col or "#ffd8a0", inten, rep["glow"])

    # soft fill so corners never go muddy (camera- and glossy-invisible)
    if kind == "interior":
        W, D, H = info["W"], info["D"], info["H"]
        energy = 9.0 * W * D * M["fill"] * (0.6 if has_interior else 1.0)
        ob = _light(coll, "fill", "AREA", (W / 2, -D / 2, H - 0.06), energy, "#fff6ea", shape="RECTANGLE",
                    size=W * 0.75, size_y=D * 0.75)
        ob.visible_camera = False
        ob.visible_glossy = False
        rep["defaults"].append(f"fill {energy:.0f} W")
    else:
        # a faint sky-coloured bounce from below the horizon is handled by the world; nothing else
        pass
    return rep


# ── auto exposure ─────────────────────────────────────────────────────────────
def measure_luminance(bl_scene, cam_ob, tmp: Path, res=256, samples=16) -> float:
    r = bl_scene.render
    saved = (r.resolution_x, r.resolution_y, r.resolution_percentage, bl_scene.cycles.samples,
             bl_scene.cycles.use_denoising, r.image_settings.file_format, r.filepath, bl_scene.camera,
             bl_scene.view_settings.exposure, r.image_settings.color_mode)
    aspect = saved[0] / max(1, saved[1])
    r.resolution_x, r.resolution_y = (res, max(8, round(res / aspect))) if aspect >= 1 else \
        (max(8, round(res * aspect)), res)
    r.resolution_percentage = 100
    bl_scene.cycles.samples = samples
    bl_scene.cycles.use_denoising = False
    r.image_settings.file_format = "OPEN_EXR"
    r.image_settings.color_mode = "RGBA"
    bl_scene.view_settings.exposure = 0.0
    bl_scene.camera = cam_ob
    path = Path(tmp).resolve() / "_exposure.exr"
    path.parent.mkdir(parents=True, exist_ok=True)
    r.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(path), check_existing=False)
    n = img.size[0] * img.size[1]
    px = array.array("f", [0.0]) * (n * 4)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    try:
        path.unlink()
    except OSError:
        pass
    (r.resolution_x, r.resolution_y, r.resolution_percentage, bl_scene.cycles.samples,
     bl_scene.cycles.use_denoising, r.image_settings.file_format, r.filepath, bl_scene.camera,
     bl_scene.view_settings.exposure, r.image_settings.color_mode) = saved
    logs = []
    for i in range(n):
        if px[i * 4 + 3] < 0.5:
            continue
        lum = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]
        logs.append(math.log(max(lum, 1e-5)))
    if not logs:
        return 0.18
    logs.sort()
    lo, hi = int(len(logs) * 0.05), max(int(len(logs) * 0.95), int(len(logs) * 0.05) + 1)
    core = logs[lo:hi]
    return math.exp(sum(core) / len(core))


def auto_exposure(bl_scene, cam_ob, tmp: Path, scene: dict) -> dict:
    M = MOODS.get(mood_of(scene), MOODS["day"])
    lum = measure_luminance(bl_scene, cam_ob, tmp)
    ev = math.log2(M["target"] / max(lum, 1e-5))
    ev = max(-6.0, min(6.0, ev))
    user = float((scene.get("style") or {}).get("exposure", 0.0))
    bl_scene.view_settings.exposure = ev + user
    return {"measured": round(lum, 5), "target": M["target"], "auto_ev": round(ev, 3), "user_ev": user,
            "exposure": round(ev + user, 3)}


# ── dollhouse renders ─────────────────────────────────────────────────────────
BACKED_GAP = 0.06  # m (same as bake_export.BACKED_GAP)
WALL_PLANES = {  # outward normal toward the wall, signed distance from the room side
    "north": ((0, 1, 0), lambda c, W, D: -c.y),
    "south": ((0, -1, 0), lambda c, W, D: c.y + D),
    "west": ((-1, 0, 0), lambda c, W, D: c.x),
    "east": ((1, 0, 0), lambda c, W, D: W - c.x),
}


def backed_parts(roots, W, D, side, gap=BACKED_GAP):
    """Mesh parts of scene objects with faces pressed against wall `side` (facing it from within `gap`)."""
    nrm, dist = WALL_PLANES[side]
    nrm = Vector(nrm)
    out = []
    for root in roots:
        for ob in [root, *root.children_recursive]:
            if ob.type != "MESH" or not ob.data.polygons:
                continue
            mw = ob.matrix_world
            m3 = mw.to_3x3()
            for p in ob.data.polygons:
                if (m3 @ p.normal).normalized().dot(nrm) > 0.7 and -0.02 < dist(mw @ p.center, W, D) < gap:
                    out.append(ob)
                    break
    return out


def dollhouse_fill(hide_names, W, D, H, t, roots, measured_lum, mood):
    """For three-quarter / hero renders: furniture pressed against a cut-away wall would show a pitch-black
    back (the hidden wall still blocks its light). bake_export.py bakes those faces with walls hidden and a
    stand-in world; this adds the matching light for the stills: an area light outside each hidden wall that
    lights ONLY those parts and is shadowed ONLY by them (Cycles light + shadow linking).
    Returns a cleanup function."""
    made, colls = [], []
    warm = mood in ("evening", "night", "golden")
    col = (1.0, 0.86, 0.7) if warm else (0.95, 0.95, 0.94)
    L = max(0.05, min(5.0, measured_lum * 2.2))
    for name in hide_names:
        if not name.startswith("wall_"):
            continue
        side = name[5:]
        if side not in WALL_PLANES:
            continue
        parts = backed_parts(roots, W, D, side)
        if not parts:
            continue
        coll = bpy.data.collections.new(f"_mr_dollhouse_{side}")
        for p in parts:
            coll.objects.link(p)
        length = W if side in ("north", "south") else D
        area = length * H
        nrm = Vector(WALL_PLANES[side][0])
        center = {"north": Vector((W / 2, t + 0.05, H / 2)), "south": Vector((W / 2, -D - t - 0.05, H / 2)),
                  "west": Vector((-t - 0.05, -D / 2, H / 2)), "east": Vector((W + t + 0.05, -D / 2, H / 2))}[side]
        ld = bpy.data.lights.new(f"_mr_dollhouse_{side}", "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = length, H
        ld.energy = area * math.pi * L
        ld.color = col
        ob = bpy.data.objects.new(ld.name, ld)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = center
        ob.rotation_euler = (-nrm).to_track_quat("-Z", "Y").to_euler()  # emits along -Z, into the room
        ob.visible_camera = False
        ob.visible_glossy = False
        ob.light_linking.receiver_collection = coll
        ob.light_linking.blocker_collection = coll
        made.append(ob)
        colls.append(coll)

    def cleanup():
        for ob in made:
            ld = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.lights.remove(ld)
        for c in colls:
            bpy.data.collections.remove(c)
    return cleanup


LOOK = "AgX - Medium High Contrast"  # the one look every spot shares (renders AND the display-referred atlas)


def apply_look(bl_scene, look=None):
    try:
        bl_scene.view_settings.look = look or LOOK
    except TypeError:
        pass
    return bl_scene.view_settings.look


def path_settings(bl_scene):
    """Bounce limits shared by every render AND bake, so the baked atlas matches the stills."""
    c = bl_scene.cycles
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 2
    c.transmission_bounces = 4
    c.transparent_max_bounces = 8
    c.volume_bounces = 0
    c.sample_clamp_indirect = 10.0
    c.blur_glossy = 0.5
