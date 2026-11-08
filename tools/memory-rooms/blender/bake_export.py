"""room.blend -> room.glb (baked, display-referred atlas) + renders/hero.png + export-report.json.

    blender.exe -b --factory-startup --python tools/memory-rooms/blender/bake_export.py -- \
        --blend <work>/room.blend --out <work> [--atlas 2048] [--samples 256]

GLB contract (src/memory-rooms/CONTRACTS.md section 4):
  * Every baked surface: material `baked_atlas` (KHR_materials_unlit) whose baseColorTexture is ONE atlas on
    the mesh's only UV set (the lightmap UV). The atlas is DISPLAY-REFERRED: Cycles bakes COMBINED light into
    a 32-bit float image (nothing clips), then the image is written through the scene's own colour management
    (AgX + the auto exposure saved by build_room.py), so the viewer can show it with MeshBasicMaterial, an sRGB
    texture and NO tone mapping and still match renders/three-quarter.png. ("colorSpace": "display-agx-srgb")
  * `glass…` materials: baseColorFactor = tint (alpha 0.18). `emit…` materials: emissive = base colour = the
    display colour the emitter has in the Cycles render.
  * Node names: floor, ceiling, ground, wall_<side> (wall meshes joined into that node), obj__<id> roots with
    one joined child obj__<id>__mesh. WebP textures, y-up, no cameras / lights / animation.

Order matters: meshes are baked BEFORE they are joined, because the procedural materials use Object
coordinates; joining first would shift every wood grain and tile joint away from the Cycles stills.
"""

from __future__ import annotations

import argparse
import array
import json
import math
import re
import struct
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import common  # noqa: E402
from common import log  # noqa: E402

NAME_OK = re.compile(r"^[A-Za-z0-9_-]+$")
TARGET_MB, FAIL_MB = 8.0, 15.0
ISLAND_STATS: dict = {}
TARGET_DENSITY = 110.0  # texels per metre for weight-1 faces
PACK_EFF = 0.5
MAX_ATLASES = 4
BACKED_GAP = 0.06  # m: furniture faces this close to a wall / the ceiling get the dollhouse bake pass
MAX_ISLAND = 6.0  # metres (at weight 1) before an island is cut into chunks
SIDE_INWARD = {"north": (0, -1, 0), "south": (0, 1, 0), "west": (1, 0, 0), "east": (-1, 0, 0)}


def parse():
    p = argparse.ArgumentParser(prog="bake_export.py")
    p.add_argument("--blend", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--atlas", type=int, default=2048)
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--hero-samples", type=int, default=0, help="defaults to --samples")
    p.add_argument("--no-hero", action="store_true")
    p.add_argument("--pass", dest="bake_pass", choices=["combined", "diffuse"], default="combined")
    p.add_argument("--margin", type=int, default=12, help="bake margin in pixels")
    p.add_argument("--webp-quality", type=int, default=90)
    p.add_argument("--normals", action="store_true", help="also export vertex normals (unused by the viewer)")
    return common.script_args(p)


def sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", name)


def set_hidden(names, hidden):
    import bpy

    for nm in names:
        ob = bpy.data.objects.get(nm)
        if ob:
            for o in [ob, *ob.children_recursive]:
                o.visible_camera = not hidden


def select_only(objs, active=None):
    import bpy

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def top_root(ob):
    while ob.parent is not None:
        ob = ob.parent
    return ob


def kind_of(mat) -> str:
    if mat is None:
        return "baked"
    n = mat.name.lower()
    if n.startswith("glass"):
        return "glass"
    if n.startswith("emit"):
        return "emit"
    return "baked"


# ── colour helpers ────────────────────────────────────────────────────────────
def to_display(sc, linear_rgbs, tmp: Path):
    """Linear scene colours -> sRGB display values through the scene's view transform (AgX + exposure)."""
    import bpy

    if not linear_rgbs:
        return []
    n = len(linear_rgbs)
    img = bpy.data.images.new("_mr_disp", n, 1, alpha=False, float_buffer=True)
    px = []
    for r, g, b in linear_rgbs:
        px += [r, g, b, 1.0]
    img.pixels.foreach_set(px)
    path = tmp / "_display.png"
    img.save_render(str(path), scene=sc)
    bpy.data.images.remove(img)
    im = bpy.data.images.load(str(path), check_existing=False)
    vals = array.array("f", [0.0]) * (n * 4)
    im.pixels.foreach_get(vals)
    bpy.data.images.remove(im)
    path.unlink(missing_ok=True)
    return [(vals[i * 4], vals[i * 4 + 1], vals[i * 4 + 2]) for i in range(n)]


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def principled(mat):
    if not mat or not mat.node_tree:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def emission_of(mat):
    """(linear rgb * strength) of an emitter, best effort."""
    from scene_io import hex_rgb

    b = principled(mat)
    if b is not None:
        col = b.inputs["Emission Color"]
        strength = b.inputs["Emission Strength"].default_value
        if col.is_linked and mat.get("mr_color"):
            rgb = hex_rgb(mat["mr_color"])
        else:
            rgb = tuple(col.default_value[:3])
        return tuple(c * strength for c in rgb)
    if mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "EMISSION":
                c = n.inputs["Color"].default_value
                s = n.inputs["Strength"].default_value
                return (c[0] * s, c[1] * s, c[2] * s)
    return (1.0, 1.0, 1.0)


def glass_tint(mat):
    from scene_io import hex_rgb

    if mat.get("mr_color"):
        return hex_rgb(mat["mr_color"], linear=False)
    b = principled(mat)
    if b is not None:
        c = b.inputs["Base Color"].default_value
        return tuple(min(1.0, max(0.0, (1.055 * v ** (1 / 2.4) - 0.055) if v > 0.0031308 else 12.92 * v))
                     for v in c[:3])
    return (0.85, 0.92, 0.95)


# ── UV islands ────────────────────────────────────────────────────────────────
def scale_islands(ob, weights_fn, id_base=0):
    """Uniform texel density across every object, times a per-face weight (undersides, outer wall faces,
    glass and emitters get less). Works on the active (lightmap) UV layer of an object in edit mode."""
    import bmesh

    bm = bmesh.from_edit_mesh(ob.data)
    lay = bm.faces.layers.int.get("mr_island") or bm.faces.layers.int.new("mr_island")  # before taking refs
    uv = bm.loops.layers.uv.active
    faces = list(bm.faces)
    if not faces or uv is None:
        return (0.0, 0.0)
    idx = {f: i for i, f in enumerate(faces)}
    parent = list(range(len(faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def close(a, b):
        return abs(a.x - b.x) < 1e-6 and abs(a.y - b.y) < 1e-6

    for e in bm.edges:
        ll = e.link_loops
        if len(ll) != 2:
            continue
        a, b = ll
        a1, a2 = a[uv].uv, a.link_loop_next[uv].uv
        b1, b2 = b[uv].uv, b.link_loop_next[uv].uv
        ok = (close(a1, b1) and close(a2, b2)) if a.vert == b.vert else (close(a1, b2) and close(a2, b1))
        if ok:
            ra, rb = find(idx[a.face]), find(idx[b.face])
            if ra != rb:
                parent[ra] = rb
    mw = ob.matrix_world
    m3 = mw.to_3x3()
    islands: dict[int, list] = {}
    for f in faces:
        islands.setdefault(find(idx[f]), []).append(f)
    for k, fs in enumerate(islands.values()):
        for f in fs:
            f[lay] = id_base + k + 1
    tot3d = totuv = 0.0
    for fs in islands.values():
        a3 = auv = wsum = 0.0
        for f in fs:
            pts = [mw @ v.co for v in f.verts]
            fa = 0.0
            for k in range(1, len(pts) - 1):
                fa += (pts[k] - pts[0]).cross(pts[k + 1] - pts[0]).length / 2
            ua = 0.0
            uvs = [l[uv].uv for l in f.loops]
            for k in range(1, len(uvs) - 1):
                ua += abs((uvs[k].x - uvs[0].x) * (uvs[k + 1].y - uvs[0].y) -
                          (uvs[k + 1].x - uvs[0].x) * (uvs[k].y - uvs[0].y)) / 2
            n = (m3 @ f.normal).normalized()
            wsum += weights_fn(f, n) * fa
            a3 += fa
            auv += ua
        if a3 <= 1e-12 or auv <= 1e-14:
            s = 1e-3
        else:
            s = math.sqrt(a3 / auv) * (wsum / a3)
        cx = sum(l[uv].uv.x for f in fs for l in f.loops) / sum(len(f.loops) for f in fs)
        cy = sum(l[uv].uv.y for f in fs for l in f.loops) / sum(len(f.loops) for f in fs)
        for f in fs:
            for l in f.loops:
                l[uv].uv.x = cx + (l[uv].uv.x - cx) * s
                l[uv].uv.y = cy + (l[uv].uv.y - cy) * s
        # long thin islands (a plinth rim, a skirting run) would force the packer to shrink everything:
        # cut them into chunks of at most MAX_ISLAND metres (each chunk becomes its own island)
        us = [l[uv].uv.x for f in fs for l in f.loops]
        vs = [l[uv].uv.y for f in fs for l in f.loops]
        ex, ey = max(us) - min(us), max(vs) - min(vs)
        long_ext = max(ex, ey)
        if long_ext > MAX_ISLAND and len(fs) > 1:
            axis = 0 if ex >= ey else 1
            lo = min(us) if axis == 0 else min(vs)
            nb = math.ceil(long_ext / MAX_ISLAND)
            step = long_ext / nb
            for f in fs:
                c = sum((l[uv].uv.x if axis == 0 else l[uv].uv.y) for l in f.loops) / len(f.loops)
                k = min(nb - 1, int((c - lo) / step))
                if k:
                    for l in f.loops:
                        if axis == 0:
                            l[uv].uv.y += k * 1000.0
                        else:
                            l[uv].uv.x += k * 1000.0
        tot3d += a3
        totuv += auv * s * s
    bmesh.update_edit_mesh(ob.data)
    ISLAND_STATS[ob.name] = (len(islands), round(tot3d, 2), round(totuv, 2))
    return tot3d, totuv


def uv_density(objs, atlas):
    """Texels per metre for weight-1 faces after packing (from the area ratio of all faces)."""
    a3 = auv = 0.0
    for ob in objs:
        me = ob.data
        uv = me.uv_layers.get("lightmap")
        if uv is None:
            continue
        mw = ob.matrix_world
        for p in me.polygons:
            pts = [mw @ me.vertices[v].co for v in p.vertices]
            for k in range(1, len(pts) - 1):
                a3 += (pts[k] - pts[0]).cross(pts[k + 1] - pts[0]).length / 2
            u = [uv.data[li].uv for li in p.loop_indices]
            for k in range(1, len(u) - 1):
                auv += abs((u[k].x - u[0].x) * (u[k + 1].y - u[0].y) - (u[k + 1].x - u[0].x) * (u[k].y - u[0].y)) / 2
    return atlas * math.sqrt(auv / a3) if a3 > 0 else 0.0, auv


def split_wall_backed(objs, info, log_fn):
    """Interior only. Faces of furniture that face a wall (or the ceiling) from within BACKED_GAP are dark in a
    normal bake (the wall blocks their light) but are exactly what the dollhouse view shows once that wall is
    hidden. Split them into their own `…__backed` meshes so they can be baked with walls + ceiling hidden."""
    import bpy
    from mathutils import Vector

    W, D, H = info.get("W"), info.get("D"), info.get("H")
    if not (W and D and H):
        return []
    planes = [  # (outward normal toward the wall, signed distance fn)
        (Vector((0, 1, 0)), lambda c: -c.y),          # north wall at y = 0
        (Vector((0, -1, 0)), lambda c: c.y + D),      # south wall at y = -D
        (Vector((-1, 0, 0)), lambda c: c.x),          # west wall at x = 0
        (Vector((1, 0, 0)), lambda c: W - c.x),       # east wall at x = W
        (Vector((0, 0, 1)), lambda c: H - c.z),       # ceiling
    ]
    made = []
    for ob in list(objs):
        if not top_root(ob).name.startswith("obj__"):
            continue
        mw = ob.matrix_world
        m3 = mw.to_3x3()
        marks = []
        for p in ob.data.polygons:
            n = (m3 @ p.normal).normalized()
            c = mw @ p.center
            hit = False
            for nrm, dist in planes:
                if n.dot(nrm) > 0.7 and -0.02 < dist(c) < BACKED_GAP:
                    hit = True
                    break
            marks.append(hit)
        if not any(marks):
            continue
        if all(marks):
            ob["mr_backed"] = True
            made.append(ob)
            continue
        ob.data.polygons.foreach_set("select", marks)
        before = set(bpy.data.objects)
        select_only([ob])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        for nb in set(bpy.data.objects) - before:
            nb.name = f"{ob.name}__backed"
            nb["mr_backed"] = True
            made.append(nb)
    log_fn("wall-backed meshes", len(made))
    return made


def stand_in_world(sc, meta):
    """While the wall-backed faces bake, light them like the room's average: a uniform warm-neutral world
    whose radiance comes from the brightness build_room.py measured for its exposure. Returns a restore fn."""
    w = sc.world
    nt = w.node_tree if w else None
    if nt is None:
        return lambda: None
    exp = (meta.get("exposure") or {})
    lum = float(exp.get("measured", 0.2))
    mood = ((meta.get("mood")) or "")
    warm = mood in ("evening", "night", "golden")
    col = (1.0, 0.86, 0.7, 1.0) if warm else (0.95, 0.95, 0.94, 1.0)
    strength = max(0.05, min(5.0, lum * 2.2))
    saved = []
    for n in nt.nodes:
        if n.type == "BACKGROUND":
            c, s_ = n.inputs["Color"], n.inputs["Strength"]
            saved.append((n, tuple(c.default_value), s_.default_value,
                          [lk.from_socket for lk in nt.links if lk.to_socket == c]))
            for lk in list(nt.links):
                if lk.to_socket == c:
                    nt.links.remove(lk)
            c.default_value = col
            s_.default_value = strength

    def restore():
        for n, c, st, links in saved:
            n.inputs["Color"].default_value = c
            n.inputs["Strength"].default_value = st
            for src in links:
                try:
                    nt.links.new(src, n.inputs["Color"])
                except Exception:
                    pass
    return restore


def island_colors(me):
    """Face colour attribute encoding the face's UV island id (for the island-id bake)."""
    a = me.attributes.get("mr_island")
    n = len(me.polygons)
    if a is None or not n:
        return
    vals = array.array("i", [0]) * n
    a.data.foreach_get("value", vals)
    col = me.color_attributes.get("mr_island_col") or me.color_attributes.new("mr_island_col", "FLOAT_COLOR", "FACE")
    rgba = array.array("f", [0.0]) * (n * 4)
    for i, v in enumerate(vals):
        rgba[i * 4] = (v & 255) / 255.0
        rgba[i * 4 + 1] = ((v >> 8) & 255) / 255.0
        rgba[i * 4 + 2] = ((v >> 16) & 255) / 255.0
        rgba[i * 4 + 3] = 1.0
    col.data.foreach_set("color", rgba)


def bake_island_ids(sc, A, bake_nodes):
    """1-sample EMIT bake of each texel's UV island id into a float image (0 = gutter)."""
    import bpy

    idm = bpy.data.materials.get("_mr_island_ids")
    if idm is None:
        idm = bpy.data.materials.new("_mr_island_ids")
        try:
            idm.use_nodes = True
        except Exception:
            pass
        nt = idm.node_tree
        nt.nodes.clear()
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_name = "mr_island_col"
        em = nt.nodes.new("ShaderNodeEmission")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(at.outputs["Color"], em.inputs["Color"])
        nt.links.new(em.outputs[0], out.inputs["Surface"])
        node = nt.nodes.new("ShaderNodeTexImage")
        node.name = "_mr_bake"
        nt.nodes.active = node
    node = idm.node_tree.nodes["_mr_bake"]
    img = bpy.data.images.new(f"atlas{A['index']}_ids", A["size"], A["size"], alpha=False, float_buffer=True)
    node.image = img
    idm.node_tree.nodes.active = node
    saved = {o: [s.material for s in o.material_slots] for o in A["objects"]}
    for o in A["objects"]:
        for s in o.material_slots:
            s.material = idm
    samples = sc.cycles.samples
    sc.cycles.samples = 1
    select_only(A["objects"])
    try:
        bpy.ops.object.bake(type="EMIT", margin=0, use_clear=True, uv_layer="lightmap", target="IMAGE_TEXTURES")
    finally:
        sc.cycles.samples = samples
        for o, mats in saved.items():
            for s, m in zip(o.material_slots, mats):
                s.material = m
    return img


def fill_dead_texels(img, exposure, idimg=None, iters=6, gutter_iters=4):
    """Texels whose centre sits inside other geometry (a pillow sunk into a duvet, a leg in the floor) bake to
    ~zero and, at lightmap resolution, bleed a black seam past the intersection. Fill those dead texels from
    lit neighbours OF THE SAME UV ISLAND (island ids from bake_island_ids), then re-extend the gutters so the
    old black edge cannot creep back in through filtering. Returns how many texels were filled."""
    import numpy as np

    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(h, w, 4)
    if idimg is not None:
        b = np.empty(w * h * 4, dtype=np.float32)
        idimg.pixels.foreach_get(b)
        b = b.reshape(h, w, 4)
        ids = (np.rint(b[..., 0] * 255).astype(np.int64) + np.rint(b[..., 1] * 255).astype(np.int64) * 256 +
               np.rint(b[..., 2] * 255).astype(np.int64) * 65536)
    else:
        ids = np.ones((h, w), np.int64)
    inside = ids > 0
    lum = a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722
    alive = (lum >= 0.0025 / (2.0 ** exposure)) & inside
    rgb = a[..., :3].copy()
    shifts = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    filled = 0
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros((h, w), np.float32)
        for dy, dx in shifts:
            ok = np.roll(np.roll(alive, dy, 0), dx, 1) & (np.roll(np.roll(ids, dy, 0), dx, 1) == ids)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * ok[..., None]
            cnt += ok
        grow = inside & ~alive & (cnt >= 2)
        n = int(grow.sum())
        if not n:
            break
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        alive |= grow
        filled += n
    # re-extend the gutters from the (now filled) island edges. Each gutter texel copies ONE island (the nearest,
    # ties -> highest id), never an average of two: mixing islands bled floor / plinth colours into wall edges.
    lab = np.where(inside, ids, 0)
    for _ in range(gutter_iters):
        best = np.zeros_like(lab)
        for dy, dx in shifts:
            best = np.maximum(best, np.roll(np.roll(lab, dy, 0), dx, 1))
        grow = (lab == 0) & (best > 0)
        if not grow.any():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros((h, w), np.float32)
        for dy, dx in shifts:
            ok = (np.roll(np.roll(lab, dy, 0), dx, 1) == best) & grow
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * ok[..., None]
            cnt += ok
        rgb[grow] = acc[grow] / np.maximum(cnt[grow], 1)[:, None]
        lab[grow] = best[grow]
    a[..., :3] = rgb
    img.pixels.foreach_set(a.ravel())
    return filled

# ── GLB inspection ────────────────────────────────────────────────────────────
def inspect_glb(path: Path) -> dict:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError("not a GLB")
    clen, ctype = struct.unpack_from("<II", data, 12)
    gj = json.loads(data[20:20 + clen].decode("utf-8"))
    nodes = gj.get("nodes", [])
    mats = gj.get("materials", [])
    images = gj.get("images", [])
    acc = gj.get("accessors", [])
    verts = tris = 0
    prims_without_uv = 0
    for m in gj.get("meshes", []):
        for p in m.get("primitives", []):
            verts += acc[p["attributes"]["POSITION"]]["count"]
            if "indices" in p:
                tris += acc[p["indices"]]["count"] // 3
            mat = mats[p["material"]] if "material" in p else {}
            if mat.get("name", "").startswith("baked") and "TEXCOORD_0" not in p["attributes"]:
                prims_without_uv += 1
    names = [n.get("name", "") for n in nodes]
    bad = [n for n in names if not NAME_OK.match(n)]
    return {
        "bytes": len(data), "mb": round(len(data) / 1e6, 3), "glbVersion": version,
        "nodes": names, "badNodeNames": bad,
        "materials": [{"name": m.get("name"),
                       "baseColorTexture": "baseColorTexture" in m.get("pbrMetallicRoughness", {}),
                       "baseColorFactor": m.get("pbrMetallicRoughness", {}).get("baseColorFactor"),
                       "emissiveFactor": m.get("emissiveFactor"), "alphaMode": m.get("alphaMode", "OPAQUE"),
                       "extensions": sorted((m.get("extensions") or {}).keys())} for m in mats],
        "images": [{"name": i.get("name"), "mimeType": i.get("mimeType")} for i in images],
        "cameras": len(gj.get("cameras", [])), "animations": len(gj.get("animations", [])),
        "lights": len((gj.get("extensions") or {}).get("KHR_lights_punctual", {}).get("lights", [])),
        "meshes": len(gj.get("meshes", [])), "vertices": verts, "triangles": tris,
        "bakedPrimitivesWithoutUV": prims_without_uv, "extensionsUsed": gj.get("extensionsUsed", []),
    }


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    args = parse()
    import bmesh  # noqa: F401
    import bpy
    from mathutils import Vector

    t_all = time.perf_counter()
    T = {}
    out = Path(args.out).resolve()
    (out / "renders").mkdir(parents=True, exist_ok=True)
    bake_dir = out / "bake"
    bake_dir.mkdir(exist_ok=True)
    warnings = []

    t = time.perf_counter()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    sc = bpy.context.scene
    meta = json.loads(sc.get("mr_meta", "{}"))
    scene_json = json.loads(bpy.data.texts["scene.json"].as_string()) if "scene.json" in bpy.data.texts else {}
    kind = meta.get("kind", scene_json.get("kind", "interior"))
    exposure = sc.view_settings.exposure
    common.set_render(sc, samples=args.samples, res_x=1600, res_y=1200, exposure=exposure, transparent=True)
    devices = common.enable_gpu(sc)
    import lighting
    lighting.path_settings(sc)
    agx_look = lighting.apply_look(sc, meta.get("look"))
    T["open"] = round(time.perf_counter() - t, 3)
    log("opened", args.blend, "exposure", exposure, devices)

    tq = bpy.data.objects.get("three-quarter")
    hide = (meta.get("three_quarter") or {}).get("hide", ["ceiling"])
    view = None
    if tq is not None:
        from scene_io import from_bl

        fwd = tq.matrix_world.to_3x3() @ Vector((0, 0, -1))
        look = tq.matrix_world.translation + fwd * 5.0
        cam = tq.data
        view = {"pos": [round(v, 4) for v in from_bl(tq.matrix_world.translation)],
                "look": [round(v, 4) for v in from_bl(look)],
                "fov": round(math.degrees(cam.angle), 3), "aspect": 4 / 3,
                "shift": [round(cam.shift_x, 5), round(cam.shift_y, 5)], "hide": hide}

    # 1. hero still (full samples, dollhouse visibility, transparent film)
    if not args.no_hero and tq is not None:
        t = time.perf_counter()
        sc.cycles.samples = args.hero_samples or args.samples
        sc.render.resolution_x, sc.render.resolution_y = 1600, 1200
        sc.render.film_transparent = True
        sc.render.image_settings.color_mode = "RGBA"
        set_hidden(hide, True)
        cleanup = None
        inf = meta.get("info") or {}
        if kind == "interior" and inf.get("W"):
            roots_now = [o for o in bpy.data.collections["room"].objects
                         if o.parent is None and o.name.startswith("obj__")]
            cleanup = lighting.dollhouse_fill(hide, inf["W"], inf["D"], inf["H"], inf.get("t", 0.12), roots_now,
                                              float((meta.get("exposure") or {}).get("measured", 0.2)),
                                              meta.get("mood") or "")
        common.render_to(sc, tq, out / "renders" / "hero.png")
        if cleanup:
            cleanup()
        set_hidden(hide, False)
        T["hero"] = round(time.perf_counter() - t, 3)
        log("hero", T["hero"], "s")

    # 2. real meshes: drop photo-only helpers, realise instances, apply modifiers
    t = time.perf_counter()
    for coll_name in ("photo_only",):
        c = bpy.data.collections.get(coll_name)
        if c:
            for o in list(c.all_objects):
                bpy.data.objects.remove(o, do_unlink=True)
    room = bpy.data.collections["room"]
    for o in list(room.all_objects):
        if o.hide_render:
            bpy.data.objects.remove(o, do_unlink=True)
    inst = [o for o in room.all_objects if o.instance_type != "NONE" and o.type == "EMPTY" and o.instance_collection]
    inst += [o for o in room.all_objects if o.type == "MESH" and len(o.particle_systems)]
    if inst:
        select_only(inst)
        bpy.ops.object.duplicates_make_real(use_base_parent=True, use_hierarchy=True)
    geo = [o for o in room.all_objects if o.type in ("MESH", "CURVE", "FONT", "SURFACE", "META")]
    select_only(geo)
    bpy.ops.object.make_single_user(type="SELECTED_OBJECTS", object=True, obdata=True)
    bpy.ops.object.convert(target="MESH")
    meshes = [o for o in room.all_objects if o.type == "MESH"]
    for o in list(meshes):
        if len(o.data.polygons) == 0:
            meshes.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
    plain = bpy.data.materials.get("plaster_fallback_bake") or bpy.data.materials.new("plaster_fallback_bake")
    for o in meshes:
        if not o.material_slots:
            o.data.materials.append(plain)
        for s in o.material_slots:
            if s.material is None:
                s.material = plain
    backed = []
    if kind == "interior":
        backed = split_wall_backed(meshes, meta.get("info") or {}, log)
        meshes += [o for o in backed if o not in meshes]
    T["prepare"] = round(time.perf_counter() - t, 3)
    nfaces = sum(len(o.data.polygons) for o in meshes)
    log("meshes", len(meshes), "faces", nfaces)

    # 3. lightmap UVs: smart project, uniform density x weights, one packed atlas
    t = time.perf_counter()
    for o in meshes:
        uvl = o.data.uv_layers.get("lightmap") or o.data.uv_layers.new(name="lightmap")
        o.data.uv_layers.active = uvl
    groups = {o.name: top_root(o).name for o in meshes}
    W = (meta.get("info") or {}).get("W", 0)
    D = (meta.get("info") or {}).get("D", 0)

    def weights_for(ob):
        key = groups[ob.name]
        kinds = [kind_of(s.material) for s in ob.material_slots]
        side = key[5:] if key.startswith("wall_") else None
        shell = key in ("floor", "ceiling", "ground") or side is not None
        inward = Vector(SIDE_INWARD[side]) if side in SIDE_INWARD else None

        plantish = [bool(s.material and s.material.get("mr_material") == "plant") for s in ob.material_slots]

        def fn(f, n):
            mi = f.material_index if f.material_index < len(kinds) else 0
            if kinds and kinds[mi] != "baked":
                return 0.05
            w = 1.0
            if shell:
                # shell faces: the ceiling is SEEN from below (its top almost never), window / door heads face
                # down and are seen from inside, floor / ground bottoms are never seen
                if key == "ceiling":
                    w *= 0.6 if n.z < -0.6 else 0.15
                elif key in ("floor", "ground") and n.z < -0.6:
                    w *= 0.05
                if key == "ground":
                    w *= 0.6
                if inward is not None and n.dot(inward) < -0.5:
                    w *= 0.5
                return w
            if n.z < -0.6:  # furniture undersides
                w *= 0.2
            if plantish and plantish[mi]:
                w *= 0.6
            return w
        return fn

    select_only(meshes)
    sc.tool_settings.use_uv_select_sync = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.reveal()
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    T["uv_unwrap"] = round(time.perf_counter() - t, 3)
    t2 = time.perf_counter()
    id_base = 0
    for o in meshes:
        scale_islands(o, weights_for(o), id_base)
        id_base += ISLAND_STATS[o.name][0]
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in meshes:
        island_colors(o.data)
    T["uv_scale"] = round(time.perf_counter() - t2, 3)
    n_islands = sum(v[0] for v in ISLAND_STATS.values())
    weighted = sum(v[2] for v in ISLAND_STATS.values())
    log("islands", n_islands, "weighted m2", round(weighted, 1))

    # atlases: one per room unless that would drop below TARGET_DENSITY; then the biggest meshes get their own
    # (assigned per mesh, so one large building can spread over two atlases; its joined node then simply
    # carries one baked material per atlas)
    area_by_mesh = {o.name: ISLAND_STATS.get(o.name, (0, 0, 0.0))[2] for o in meshes}
    capacity = (args.atlas / TARGET_DENSITY) ** 2 * PACK_EFF
    if weighted / capacity > MAX_ATLASES:
        capacity = weighted / MAX_ATLASES * 1.02
    bins: list = []
    for name, a in sorted(area_by_mesh.items(), key=lambda kv: -kv[1]):
        for b in bins:
            if b["area"] + a <= capacity:
                b["names"].append(name)
                b["area"] += a
                break
        else:
            bins.append({"names": [name], "area": a})
    if len(bins) > MAX_ATLASES:  # first-fit could not merge the tail: fold the smallest bins together
        bins.sort(key=lambda b: -b["area"])
        while len(bins) > MAX_ATLASES:
            b = bins.pop()
            bins[-1]["names"] += b["names"]
            bins[-1]["area"] += b["area"]
    atlases = []
    by_name = {o.name: o for o in meshes}
    for i, b in enumerate(sorted(bins, key=lambda b: -b["area"])):
        need = args.atlas * math.sqrt(min(1.0, b["area"] / capacity))
        size = max(512, min(args.atlas, 2 ** math.ceil(math.log2(max(need, 1.0)))))
        objs = [by_name[n] for n in b["names"]]
        roots_in = sorted({groups[o.name] for o in objs})
        atlases.append({"index": i, "size": size, "roots": roots_in, "objects": objs, "area": b["area"]})

    t2 = time.perf_counter()
    for A in atlases:
        select_only(A["objects"])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        margin_frac = max(6, args.margin // 2) / A["size"]  # >= 6 px between islands
        bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="ANY", scale=True,
                                merge_overlap=False, margin_method="FRACTION", margin=margin_frac,
                                shape_method="CONCAVE")
        bpy.ops.object.mode_set(mode="OBJECT")
        d, used = uv_density(A["objects"], A["size"])
        A["texelsPerMetre"] = round(A["size"] * math.sqrt(used / A["area"]), 1) if A["area"] > 0 else 0.0
        A["uvUsed"] = round(used, 3)
    T["uv_pack"] = round(time.perf_counter() - t2, 3)
    log("atlases", [(A["size"], len(A["objects"]), round(A["area"], 1), A["texelsPerMetre"], A["uvUsed"])
                    for A in atlases])

    # 4. bake COMBINED (or DIFFUSE) light into 32-bit float atlases, one atlas at a time
    t = time.perf_counter()
    mats = {s.material for o in meshes for s in o.material_slots if s.material}
    bake_nodes = {}
    for m in mats:
        if not m.node_tree:
            try:
                m.use_nodes = True
            except Exception:
                pass
        node = m.node_tree.nodes.new("ShaderNodeTexImage")
        node.name = "_mr_bake"
        for n in m.node_tree.nodes:
            n.select = False
        node.select = True
        m.node_tree.nodes.active = node
        bake_nodes[m] = node
    sc.render.engine = "CYCLES"
    sc.cycles.samples = args.samples
    sc.render.bake.margin = args.margin
    sc.render.bake.margin_type = "EXTEND"
    sc.render.bake.use_clear = True
    sc.render.bake.target = "IMAGE_TEXTURES"
    set_hidden(hide, False)
    if args.bake_pass == "combined":
        btype, pf = "COMBINED", {"EMIT", "DIRECT", "INDIRECT", "DIFFUSE", "GLOSSY", "TRANSMISSION"}
    else:
        btype, pf = "DIFFUSE", {"DIRECT", "INDIRECT", "COLOR"}
    sc.cycles.bake_type = btype
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    T["bake"] = 0.0
    T["atlas_save"] = 0.0
    for A in atlases:
        tb = time.perf_counter()
        img = bpy.data.images.new(f"atlas{A['index']}_float", A["size"], A["size"], alpha=False, float_buffer=True)
        for m in {s.material for o in A["objects"] for s in o.material_slots if s.material}:
            bake_nodes[m].image = img
            m.node_tree.nodes.active = bake_nodes[m]
        idimg = bake_island_ids(sc, A, bake_nodes)
        main = [o for o in A["objects"] if not o.get("mr_backed")]
        back = [o for o in A["objects"] if o.get("mr_backed")]
        if main:
            select_only(main)
            bpy.ops.object.bake(type=btype, pass_filter=pf, margin=args.margin, margin_type="EXTEND",
                                use_clear=True, uv_layer="lightmap", target="IMAGE_TEXTURES")
        if back:  # dollhouse pass: walls + ceiling out of the way, same atlas, no clear, tiny margin
            cut = [o for o in bpy.data.objects
                   if (top_root(o).name.startswith("wall_") or top_root(o).name == "ceiling") and not o.hide_render]
            for o in cut:
                o.hide_render = True
            restore = stand_in_world(sc, meta)
            select_only(back)
            # margin 0: a margin here would paint over the edges of neighbouring, already-baked islands
            # (ceiling / skirting / trim edges). fill_dead_texels rebuilds these gutters per island.
            bpy.ops.object.bake(type=btype, pass_filter=pf, margin=0, margin_type="EXTEND",
                                use_clear=not main, uv_layer="lightmap", target="IMAGE_TEXTURES")
            restore()
            for o in cut:
                o.hide_render = False
        A["deadFilled"] = fill_dead_texels(img, exposure, idimg)
        bpy.data.images.remove(idimg)
        A["bake_s"] = round(time.perf_counter() - tb, 3)
        T["bake"] += A["bake_s"]
        log("baked atlas", A["index"], A["size"], btype, args.samples, "samples", A["bake_s"], "s")
        # 5. write it through the view transform (display-referred sRGB)
        ts = time.perf_counter()
        png = bake_dir / f"atlas{A['index']}.png"
        img.save_render(str(png), scene=sc)
        tex = bpy.data.images.load(str(png), check_existing=False)
        tex.name = f"atlas{A['index']}"
        tex.colorspace_settings.name = "sRGB"
        A["png"] = png
        A["tex"] = tex
        T["atlas_save"] += time.perf_counter() - ts
    T["bake"] = round(T["bake"], 3)
    T["atlas_save"] = round(T["atlas_save"], 3)
    for old in bake_dir.glob("atlas*.png"):
        if old not in [A["png"] for A in atlases]:
            old.unlink(missing_ok=True)

    # 6. export materials: one unlit baked material per atlas
    def baked_material(A):
        mat = bpy.data.materials.new(f"baked_atlas{A['index']}")
        try:
            mat.use_nodes = True
        except Exception:
            pass
        nt = mat.node_tree
        nt.nodes.clear()
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "lightmap"
        im = nt.nodes.new("ShaderNodeTexImage")
        im.image = A["tex"]
        im.interpolation = "Linear"
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
        mat.use_backface_culling = True
        return mat

    baked_for = {}
    for A in atlases:
        bm_ = baked_material(A)
        for o in A["objects"]:
            baked_for[o.name] = bm_

    emit_src = sorted({m for m in mats if kind_of(m) == "emit"}, key=lambda m: m.name)
    disp = to_display(sc, [emission_of(m) for m in emit_src], bake_dir)
    export_mat = {}
    report_emit = {}
    clean = {m: sanitize(m.name) for m in mats}
    glass_src = sorted({m for m in mats if kind_of(m) == "glass"}, key=lambda m: m.name)
    for m in mats:  # free the clean names for the export materials
        if kind_of(m) != "baked":
            m.name = "_src_" + m.name
    for m, rgb in zip(emit_src, disp):
        e = bpy.data.materials.new(clean[m])
        try:
            e.use_nodes = True
        except Exception:
            pass
        b = principled(e)
        lin = tuple(srgb_to_linear(c) for c in rgb)
        b.inputs["Base Color"].default_value = (*lin, 1.0)
        b.inputs["Emission Color"].default_value = (*lin, 1.0)
        b.inputs["Emission Strength"].default_value = 1.0
        b.inputs["Roughness"].default_value = 1.0
        export_mat[m] = e
        report_emit[e.name] = "#" + "".join(f"{round(c * 255):02x}" for c in rgb)
    for m in glass_src:
        g = bpy.data.materials.new(clean[m])
        try:
            g.use_nodes = True
        except Exception:
            pass
        b = principled(g)
        tint = glass_tint(m)
        b.inputs["Base Color"].default_value = (*(srgb_to_linear(c) for c in tint), 1.0)
        b.inputs["Alpha"].default_value = 0.18
        b.inputs["Roughness"].default_value = 0.05
        try:
            g.surface_render_method = "BLENDED"
        except Exception:
            g.blend_method = "BLEND"
        export_mat[m] = g
    for o in meshes:
        for s in o.material_slots:
            s.material = export_mat.get(s.material, baked_for[o.name])
        while len(o.data.uv_layers) > 1:
            for uvl in list(o.data.uv_layers):
                if uvl.name != "lightmap":
                    o.data.uv_layers.remove(uvl)
                    break
        if o.data.color_attributes:
            for ca in list(o.data.color_attributes):
                o.data.color_attributes.remove(ca)

    # 7. join per node: walls / floor / ceiling / ground absorb their children; obj__<id> gets one child mesh
    t = time.perf_counter()
    by_root: dict = {}
    for o in meshes:
        by_root.setdefault(top_root(o).name, []).append(o)
    for root_name, objs in by_root.items():
        root = bpy.data.objects[root_name]
        if root.type == "MESH":
            target = root
        else:
            target = objs[0]
        if len(objs) > 1:
            select_only(objs, target)
            bpy.ops.object.join()
        if root.type != "MESH":
            mw = target.matrix_world.copy()
            target.parent = root
            target.matrix_world = mw
            target.name = f"{sanitize(root_name)}__mesh"
            target.data.name = target.name
        else:
            target.data.name = target.name
    for o in list(room.all_objects):  # stray empties under the roots
        if o.type == "EMPTY" and o.parent is not None:
            for c in list(o.children):
                mw = c.matrix_world.copy()
                c.parent = top_root(o)
                c.matrix_world = mw
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA") or (o.name not in room.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in room.all_objects:
        o.name = sanitize(o.name)
    T["join"] = round(time.perf_counter() - t, 3)

    # 8. export
    t = time.perf_counter()
    glb = out / "room.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=False, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_image_format="WEBP",
        export_image_quality=args.webp_quality, export_texcoords=True, export_normals=bool(args.normals),
        export_tangents=False, export_materials="EXPORT", export_extras=False, export_vertex_color="NONE")
    T["export"] = round(time.perf_counter() - t, 3)
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "room-baked.blend"), compress=True)
    except Exception as e:
        warnings.append(f"could not save room-baked.blend: {e}")

    info = inspect_glb(glb)
    T["total"] = round(time.perf_counter() - t_all, 3)
    status = "ok"
    if info["mb"] > FAIL_MB:
        status = "fail"
        warnings.append(f"room.glb is {info['mb']} MB (> {FAIL_MB} MB)")
    elif info["mb"] > TARGET_MB:
        status = "warn"
        warnings.append(f"room.glb is {info['mb']} MB (> {TARGET_MB} MB target)")
    if info["badNodeNames"]:
        warnings.append(f"node names with bad characters: {info['badNodeNames']}")
    if any(i.get("mimeType") != "image/webp" for i in info["images"]):
        warnings.append("non-WebP image in GLB")
    if info["cameras"] or info["lights"] or info["animations"]:
        warnings.append("GLB contains cameras / lights / animations")
    if info["bakedPrimitivesWithoutUV"]:
        warnings.append(f"{info['bakedPrimitivesWithoutUV']} baked primitives have no UV")
    report = {
        "status": status, "glb": str(glb), "colorSpace": "display-agx-srgb",
        "colorNote": "baseColorTexture already went through AgX (+ look) and the scene exposure; show it with "
                     "MeshBasicMaterial, an sRGB texture and NO tone mapping.",
        "kind": kind, "exposure": exposure, "viewTransform": "AgX", "look": agx_look,
        "atlas": {"maxSize": args.atlas, "bake": btype, "samples": args.samples, "margin": args.margin,
                  "islands": n_islands, "weightedAreaM2": round(weighted, 1),
                  "atlases": [{"index": A["index"], "size": A["size"], "png": str(A["png"]),
                               "pngBytes": A["png"].stat().st_size, "texelsPerMetre": A["texelsPerMetre"],
                               "uvUsed": A["uvUsed"], "weightedAreaM2": round(A["area"], 1),
                               "bakeSeconds": A["bake_s"], "deadTexelsFilled": A["deadFilled"],
                               "nodes": sorted(A["roots"])} for A in atlases]},
        "meshesBaked": len(meshes), "facesBaked": nfaces, "emitDisplayColors": report_emit,
        "threeQuarterView": view, "hero": str(out / "renders" / "hero.png") if "hero" in T else None,
        "devices": devices, "timings_s": T, "warnings": warnings, "glbInfo": info,
    }
    (out / "export-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    log("glb", info["mb"], "MB", status, json.dumps(T))
    if status == "fail":
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(2)
