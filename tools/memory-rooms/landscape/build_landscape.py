"""Build a real-world landscape diorama in Blender from the prepared grids (prep.py + albedo.py).

    blender -b --factory-startup --python build_landscape.py -- --work <dir> [--renders hero,top,battery]
        [--samples 96] [--vexag 1.0] [--res 1600x1000] [--stride 1]

Frame: Blender X = east, Y = north, Z = up, metres from grid.json `centre_lnglat`. Writes <work>/landscape.blend
and <work>/renders/<name>.png. The look follows the Memory Rooms kit (Cycles, AgX, sun + Nishita sky).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender"))
from common import log, script_args, reset_scene, set_render, render_to  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--work", required=True)
ap.add_argument("--renders", default="hero,top")
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--vexag", type=float, default=1.0)
ap.add_argument("--res", default="1600x1000")
ap.add_argument("--stride", type=int, default=1)
ap.add_argument("--no-shrubs", action="store_true")
ap.add_argument("--save", action="store_true")
ap.add_argument("--bake", action="store_true", help="ortho-bake the ground into 2x2 tiles and export landscape.glb")
ap.add_argument("--tile", type=int, default=4096)
ap.add_argument("--bake-samples", type=int, default=64)
ap.add_argument("--decimate", type=float, default=0.14)
ap.add_argument("--webp", type=int, default=82)
ap.add_argument("--look", default="AgX - Punchy")
A = script_args(ap)
W = Path(A.work).resolve()
G = json.load(open(W / "grid.json"))
grid = np.load(W / "grid.npz")
H = grid["h"].astype(np.float32)
STEP = G["step"]
SX, SY = G["size"]
ROWS, COLS = H.shape
BASE_Z = -16.0
VX = A.vexag


def lin(c):
    c = np.asarray(c, np.float32) / 255.0
    return tuple(np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).tolist()) + (1.0,)


def height_at(x, y):
    """Bilinear ground height (already exaggerated) at local x, y."""
    c = (x + SX / 2) / STEP
    r = (SY / 2 - y) / STEP
    c = min(max(c, 0), COLS - 1.001)
    r = min(max(r, 0), ROWS - 1.001)
    c0, r0 = int(c), int(r)
    fc, fr = c - c0, r - r0
    v = (H[r0, c0] * (1 - fc) + H[r0, c0 + 1] * fc) * (1 - fr) + (H[r0 + 1, c0] * (1 - fc) + H[r0 + 1, c0 + 1] * fc) * fr
    return float(v) * VX


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


# ── materials ────────────────────────────────────────────────────────────────
def mat_simple(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(rgb)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def mat_terrain():
    m = bpy.data.materials.new("terrain")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(W / "albedo.png"))
    tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.88
    # fine bump so sand and scrub catch the light
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.2
    noise.inputs["Detail"].default_value = 6
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.15
    coord = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_water():
    m = bpy.data.materials.new("water")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.92, 0.98, 1.0, 1)
    b.inputs["Roughness"].default_value = 0.035
    b.inputs["IOR"].default_value = 1.333
    b.inputs["Transmission Weight"].default_value = 1.0
    # gentle swell
    wave = nt.nodes.new("ShaderNodeTexNoise")
    wave.inputs["Scale"].default_value = 0.06
    wave.inputs["Detail"].default_value = 8
    coord = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.4
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_water_side():
    m = bpy.data.materials.new("water_side")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = lin((40, 150, 170))
    em.inputs["Strength"].default_value = 0.35
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.55
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


def mat_strata():
    """Diorama cut faces: sand over limestone, banded by height."""
    m = bpy.data.materials.new("strata")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.08
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    nt.links.new(noise.outputs["Fac"], add.inputs[0])
    add.inputs[1].default_value = 3.0
    nt.links.new(sep.outputs["Z"], add.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mapr = nt.nodes.new("ShaderNodeMapRange")
    mapr.inputs["From Min"].default_value = BASE_Z
    mapr.inputs["From Max"].default_value = 20
    nt.links.new(add.outputs[0], mapr.inputs["Value"])
    nt.links.new(mapr.outputs[0], ramp.inputs["Fac"])
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = lin((120, 108, 88))
    els[1].position = 1.0
    els[1].color = lin((214, 200, 168))
    for pos, col in ((0.22, (150, 138, 112)), (0.30, (176, 166, 140)), (0.42, (158, 146, 120)), (0.55, (196, 184, 152))):
        e = els.new(pos)
        e.color = lin(col)
    ramp.color_ramp.interpolation = "CONSTANT"
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    return m


# ── terrain ──────────────────────────────────────────────────────────────────
def build_terrain(coll):
    s = A.stride
    h = H[::s, ::s] * VX
    rows, cols = h.shape
    xs = -SX / 2 + np.arange(cols) * STEP * s
    ys = SY / 2 - np.arange(rows) * STEP * s
    X, Y = np.meshgrid(xs, ys)
    co = np.stack([X, Y, h], -1).reshape(-1, 3).astype(np.float32)
    idx = np.arange(rows * cols).reshape(rows, cols)
    q = np.stack([idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:], idx[:-1, :-1]], -1).reshape(-1, 4)  # CCW seen from +Z
    me = bpy.data.meshes.new("terrain")
    me.vertices.add(len(co))
    me.vertices.foreach_set("co", co.ravel())
    me.loops.add(q.size)
    me.loops.foreach_set("vertex_index", q.ravel().astype(np.int32))
    me.polygons.add(len(q))
    me.polygons.foreach_set("loop_start", np.arange(0, q.size, 4, dtype=np.int32))
    me.update(calc_edges=True)
    uv = me.uv_layers.new(name="UVMap")
    lv = q.ravel()
    # albedo.png covers the grid cells' extent: pixel centres line up with the grid nodes at 0.5 m
    u = (co[lv, 0] - xs[0] + STEP / 2) / (cols * STEP * s)
    v = (co[lv, 1] - ys[-1] + STEP / 2) / (rows * STEP * s)
    uv.data.foreach_set("uv", np.stack([u, v], -1).ravel().astype(np.float32))
    me.polygons.foreach_set("use_smooth", np.ones(len(q), bool))
    ob = link(bpy.data.objects.new("terrain", me), coll)
    me.materials.append(mat_terrain())
    log(f"terrain {cols}x{rows} = {len(q)} quads")
    return ob, xs, ys, h


def build_skirt(coll, xs, ys, h):
    """Four cut faces down to BASE_Z (earth) + a water band where the seabed is below 0, and the base."""
    earth = mat_strata()
    wside = mat_water_side()
    edges = [
        (xs, np.full_like(xs, ys[0]), h[0, :], (0, 1)),          # north
        (xs[::-1], np.full_like(xs, ys[-1]), h[-1, ::-1], (0, -1)),  # south
        (np.full_like(ys, xs[0]), ys[::-1], h[::-1, 0], (-1, 0)),  # west
        (np.full_like(ys, xs[-1]), ys, h[:, -1], (1, 0)),         # east
    ]
    for name, (ex, ey, ez, nrm) in zip(("n", "s", "w", "e"), edges):
        verts, faces, wverts, wfaces = [], [], [], []
        n = len(ex)
        for i in range(n):
            verts += [(ex[i], ey[i], BASE_Z), (ex[i], ey[i], ez[i])]
        for i in range(n - 1):
            a, b = 2 * i, 2 * i + 2
            faces.append((a, b, b + 1, a + 1))
        # water band from seabed to 0
        for i in range(n):
            wverts += [(ex[i], ey[i], min(ez[i], 0.0)), (ex[i], ey[i], 0.0)]
        for i in range(n - 1):
            if ez[i] < 0 or ez[i + 1] < 0:
                a, b = 2 * i, 2 * i + 2
                wfaces.append((a, b, b + 1, a + 1))
        me = bpy.data.meshes.new(f"skirt_{name}")
        me.from_pydata(verts, [], faces)
        # face outward: our winding goes along the edge with the base first; flip if needed
        me.update()
        ob = link(bpy.data.objects.new(f"skirt_{name}", me), coll)
        me.materials.append(earth)
        fn = me.polygons[0].normal if len(me.polygons) else Vector((0, 0, 0))
        if fn.x * nrm[0] + fn.y * nrm[1] < 0:
            me.flip_normals()
        if wfaces:
            wm = bpy.data.meshes.new(f"waterside_{name}")
            wm.from_pydata(wverts, [], wfaces)
            wm.update()
            if len(wm.polygons) and wm.polygons[0].normal.x * nrm[0] + wm.polygons[0].normal.y * nrm[1] < 0:
                wm.flip_normals()
            wo = link(bpy.data.objects.new(f"waterside_{name}", wm), coll)
            wm.materials.append(wside)
            # nudge out 2 cm so it never fights the earth face
            wo.location = (nrm[0] * 0.3, nrm[1] * 0.3, 0)
    x0, x1, y0, y1 = xs[0], xs[-1], ys[-1], ys[0]
    me = bpy.data.meshes.new("base")
    me.from_pydata([(x0, y0, BASE_Z), (x0, y1, BASE_Z), (x1, y1, BASE_Z), (x1, y0, BASE_Z)], [], [(0, 1, 2, 3)])
    ob = link(bpy.data.objects.new("base", me), coll)
    me.materials.append(earth)


def build_water(coll, xs, ys):
    me = bpy.data.meshes.new("water")
    x0, x1, y0, y1 = xs[0], xs[-1], ys[-1], ys[0]
    me.from_pydata([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], [], [(0, 1, 2, 3)])
    ob = link(bpy.data.objects.new("water", me), coll)
    me.materials.append(mat_water())
    return ob


# ── vegetation ───────────────────────────────────────────────────────────────
def shrub_points():
    img = bpy.data.images.load(str(W / "mask-scrub.png"))
    w, hgt = img.size
    px = np.array(img.pixels[:], np.float32).reshape(hgt, w, -1)[::-1, :, 0]  # row 0 = north
    res = SX / w
    rng = np.random.default_rng(11)
    cell = 2.4  # m
    nx, ny = int(SX / cell), int(SY / cell)
    gx, gy = np.meshgrid(np.arange(nx), np.arange(ny))
    x = (gx + rng.random(gx.shape)) * cell
    y = (gy + rng.random(gy.shape)) * cell
    c = np.clip((x / res).astype(int), 0, w - 1)
    r = np.clip((y / res).astype(int), 0, hgt - 1)
    d = px[r, c]
    keep = rng.random(d.shape) < d * 0.92
    x, y = x[keep] - SX / 2, SY / 2 - y[keep]
    n = len(x)
    # sizes: low coastal heath, 0.5-1.4 m tall, 1-2.6 m across
    sxy = rng.uniform(0.55, 1.35, n) * (0.75 + 0.5 * d[keep])
    sz = sxy * rng.uniform(0.55, 0.85, n)
    z = np.array([height_at(a, b) for a, b in zip(x, y)], np.float32) - 0.15 * sz
    return np.stack([x, y, z], -1).astype(np.float32), np.stack([sxy, sxy * rng.uniform(0.8, 1.2, n), sz], -1).astype(np.float32), rng.uniform(0, 6.283, n).astype(np.float32)


def build_vegetation(coll):
    pts, scale, rot = shrub_points()
    me = bpy.data.meshes.new("shrub_points")
    me.vertices.add(len(pts))
    me.vertices.foreach_set("co", pts.ravel())
    a = me.attributes.new("scale3", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", scale.ravel())
    r = me.attributes.new("rotz", "FLOAT", "POINT")
    r.data.foreach_set("value", rot)
    ob = link(bpy.data.objects.new("shrubs", me), coll)
    # the instance: a lumpy low dome
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    proto = bpy.context.active_object
    proto.name = "shrub_proto"
    for v in proto.data.vertices:
        if v.co.z < -0.2:
            v.co.z = -0.2
        k = 1 + 0.18 * math.sin(v.co.x * 5.1) * math.cos(v.co.y * 4.3) + 0.1 * math.sin(v.co.z * 7.7)
        v.co *= k
    proto.data.polygons.foreach_set("use_smooth", [True] * len(proto.data.polygons))
    sm = bpy.data.materials.new("shrub")
    sm.use_nodes = True
    nt = sm.node_tree
    b = nt.nodes["Principled BSDF"]
    info = nt.nodes.new("ShaderNodeObjectInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin((52, 62, 34))
    ramp.color_ramp.elements[1].color = lin((110, 112, 66))
    e = ramp.color_ramp.elements.new(0.6)
    e.color = lin((78, 88, 48))
    nt.links.new(info.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.9
    proto.data.materials.append(sm)
    for c in proto.users_collection:
        c.objects.unlink(proto)
    hide_coll = bpy.data.collections.new("protos")
    bpy.context.scene.collection.children.link(hide_coll)
    hide_coll.objects.link(proto)
    bpy.context.view_layer.layer_collection.children["protos"].exclude = True
    # geometry nodes: instance on points
    mod = ob.modifiers.new("scatter", "NODES")
    tree = bpy.data.node_groups.new("scatter", "GeometryNodeTree")
    mod.node_group = tree
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = tree.nodes
    gin = N.new("NodeGroupInput")
    gout = N.new("NodeGroupOutput")
    m2p = N.new("GeometryNodeMeshToPoints")
    inst = N.new("GeometryNodeInstanceOnPoints")
    oi = N.new("GeometryNodeObjectInfo")
    oi.inputs["Object"].default_value = proto
    sa = N.new("GeometryNodeInputNamedAttribute")
    sa.data_type = "FLOAT_VECTOR"
    sa.inputs["Name"].default_value = "scale3"
    ra = N.new("GeometryNodeInputNamedAttribute")
    ra.data_type = "FLOAT"
    ra.inputs["Name"].default_value = "rotz"
    comb = N.new("ShaderNodeCombineXYZ")
    L = tree.links
    L.new(gin.outputs[0], m2p.inputs["Mesh"])
    L.new(m2p.outputs[0], inst.inputs["Points"])
    L.new(oi.outputs["Geometry"], inst.inputs["Instance"])
    L.new(sa.outputs["Attribute"], inst.inputs["Scale"])
    L.new(ra.outputs["Attribute"], comb.inputs["Z"])
    L.new(comb.outputs[0], inst.inputs["Rotation"])
    L.new(inst.outputs[0], gout.inputs[0])
    log(f"shrubs {len(pts)}")
    return ob


# ── structures ───────────────────────────────────────────────────────────────
def prism(name, pts, z0, z1, mat_wall, mat_top, coll):
    """Extrude a footprint polygon (local x, y) from z0 to z1."""
    if len(pts) > 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    # make CCW
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    if area < 0:
        pts = pts[::-1]
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.materials.append(mat_wall)
    me.materials.append(mat_top)
    me.polygons[1].material_index = 1
    me.update()
    return link(bpy.data.objects.new(name, me), coll)


def ground_under(pts):
    hs = [height_at(x, y) for x, y in pts]
    return min(hs), max(hs)


def cyl(name, at, r, z0, z1, mat, coll, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(at[0], at[1], (z0 + z1) / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    for c in ob.users_collection:
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob


def box(name, centre, size, rotz, mat, coll):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre, rotation=(0, 0, rotz))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    for c in ob.users_collection:
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob


def sea_direction(at, radius=40):
    """Unit vector from `at` towards the nearest open water (lowest ground in a ring)."""
    best, bdir = 1e9, (0, -1)
    for k in range(36):
        a = k * math.pi / 18
        d = (math.cos(a), math.sin(a))
        z = height_at(at[0] + d[0] * radius, at[1] + d[1] * radius)
        if z < best:
            best, bdir = z, d
    return bdir


def build_structures(coll):
    F = G["features"]
    M = {
        "wall": mat_simple("wall_cream", (222, 212, 192), 0.85),
        "roof_red": mat_simple("roof_terracotta", (150, 72, 56), 0.7),
        "roof_zinc": mat_simple("roof_zinc", (176, 180, 178), 0.45, 0.6),
        "concrete_green": mat_simple("concrete_green", (74, 92, 78), 0.9),
        "concrete": mat_simple("concrete", (168, 164, 154), 0.9),
        "brick": mat_simple("brick", (150, 82, 62), 0.9),
        "steel": mat_simple("galvanised", (190, 194, 196), 0.35, 1.0),
        "gun": mat_simple("gun_green", (62, 74, 58), 0.6, 0.3),
        "timber": mat_simple("timber_grey", (150, 140, 124), 0.8),
        "asphalt": mat_simple("asphalt", (72, 72, 74), 0.9),
        "dark": mat_simple("black", (25, 25, 25), 0.5),
    }
    heights = {"Gymnasium": 7.5, "Dining Hall and Kitchen": 5.5, "Dormitory": 4.2, "Point Peron Camp Reception": 4.2}
    for b in F["buildings"]:
        pts = [tuple(p) for p in b["pts"]]
        lo, hi = ground_under(pts)
        if b["kind"] == "roof":
            prism(f"carport_{b['id']}", pts, hi + 2.6, hi + 2.8, M["roof_zinc"], M["roof_zinc"], coll)
            continue
        ht = heights.get(b.get("name") or "", 4.0 if b["kind"] != "military" else 4.5)
        cx = sum(p[0] for p in pts) / len(pts)
        camp = cx < 100
        prism(f"bldg_{b['id']}", pts, lo - 0.3, hi + ht, M["wall"], M["roof_red"] if camp else M["roof_zinc"], coll)
    for b in F["bunkers"]:
        pts = [tuple(p) for p in b["pts"]]
        lo, hi = ground_under(pts)
        typ = b["tags"].get("bunker_type")
        top = hi + (2.6 if typ == "observation" else 1.4)
        ob = prism(f"bunker_{b['id']}", pts, lo - 0.5, top, M["concrete_green"], M["concrete_green"], coll)
        if typ == "observation":
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            # the lookout's tripod + black disc (the "radar" sculpture on the observation post)
            for k in range(3):
                a = k * 2.094
                leg = cyl(f"tripod_{k}", (cx + 1.1 * math.cos(a), cy + 1.1 * math.sin(a)), 0.05, top, top + 3.2, M["steel"], coll, 8)
                leg.rotation_euler = (0.33 * math.sin(a + 1.57), -0.33 * math.cos(a + 1.57), 0)
            disc = cyl("radar_disc", (cx, cy), 0.9, top + 3.2, top + 3.3, M["dark"], coll, 24)
            disc.rotation_euler = (1.2, 0, 0.6)
    # gun emplacements: brick ring + concrete pad, the restored northern one has the 155 mm gun
    for c in G["features"]["cannons"]:
        at = c["at"]
        z = height_at(*at)
        cyl("emplacement_pad", at, 4.6, z - 0.6, z + 0.15, M["concrete"], coll, 40)
        ring = cyl("emplacement_ring", at, 5.6, z - 0.6, z + 0.9, M["brick"], coll, 48)
        inner = cyl("_cut", at, 4.7, z - 1, z + 2, M["brick"], coll, 48)
        mod = ring.modifiers.new("cut", "BOOLEAN")
        mod.object = inner
        mod.operation = "DIFFERENCE"
        bpy.context.view_layer.objects.active = ring
        bpy.ops.object.modifier_apply(modifier="cut")
        bpy.data.objects.remove(inner)
        if "northern" in c["tags"].get("name", ""):
            sd = sea_direction(at, 60)
            yaw = math.atan2(sd[1], sd[0])
            cyl("gun_mount", at, 0.9, z + 0.15, z + 1.2, M["gun"], coll, 16)
            barrel = cyl("gun_barrel", (at[0] + sd[0] * 2.6, at[1] + sd[1] * 2.6), 0.14, -2.9, 2.9, M["gun"], coll, 12)
            barrel.location.z = z + 1.55
            barrel.rotation_euler = (0, math.radians(84), yaw)
            box("gun_carriage", (at[0], at[1], z + 1.0), (3.2, 1.6, 0.9), yaw, M["gun"], coll)
    # lookouts: Cape Peron = cantilevered steel walkway with two A-frame pylons; John Point = small deck
    for v in F["viewpoints"]:
        at = v["at"]
        name = v["tags"].get("name", "")
        sd = sea_direction(at, 35)
        yaw = math.atan2(sd[1], sd[0])
        z = height_at(*at)
        if "Cape Peron" in name:
            L = 14.0
            cx, cy = at[0] + sd[0] * (L / 2 - 3), at[1] + sd[1] * (L / 2 - 3)
            box("lookout_deck", (cx, cy, z + 0.6), (L, 2.2, 0.25), yaw, M["steel"], coll)
            for side in (-1, 1):
                px_, py_ = -sd[1] * side * 1.3, sd[0] * side * 1.3
                box(f"lookout_rail_{side}", (cx + px_ * 0.85, cy + py_ * 0.85, z + 1.25), (L, 0.06, 1.1), yaw, M["steel"], coll)
                for k, off in enumerate((-4.5, -1.0)):
                    bx, by = at[0] + sd[0] * off + px_, at[1] + sd[1] * off + py_
                    p = cyl(f"pylon_{side}_{k}", (bx, by), 0.14, z, z + 9.0, M["steel"], coll, 10)
                    p.rotation_euler = (0, 0, 0)
                    p.rotation_euler = (-sd[1] * side * 0.12, sd[0] * side * 0.12, 0)
            # cross head + cables to the deck tip
            box("lookout_head", (at[0] + sd[0] * 0.5, at[1] + sd[1] * 0.5, z + 9.0), (0.4, 3.0, 0.3), yaw, M["steel"], coll)
        else:
            box("john_point_deck", (at[0], at[1], z + 0.35), (4.0, 3.0, 0.2), yaw, M["timber"], coll)
    # jetties / pens at the boat ramp
    for p in F["piers"]:
        pts = [tuple(q) for q in p["pts"]]
        if p["tags"].get("area") == "yes" and len(pts) >= 4:
            prism(f"pier_{p['tags'].get('man_made')}", pts, -1.2, 1.1, M["timber"], M["timber"], coll)
        else:
            (x0, y0), (x1, y1) = pts[0], pts[-1]
            L = math.hypot(x1 - x0, y1 - y0)
            box("jetty", ((x0 + x1) / 2, (y0 + y1) / 2, 0.8), (L, 2.4, 0.3), math.atan2(y1 - y0, x1 - x0), M["timber"], coll)
    # Garden Island Causeway bridge: deck from the OSM bridge outline, piers every 18 m
    for b in F["bridges"]:
        pts = [tuple(q) for q in b["pts"]]
        if b["tags"].get("man_made") == "bridge" and len(pts) >= 4:
            prism("causeway_bridge_deck", pts, 3.9, 4.8, M["concrete"], M["asphalt"], coll)
        elif len(pts) == 2:
            (x0, y0), (x1, y1) = pts
            L = math.hypot(x1 - x0, y1 - y0)
            n = max(2, int(L / 18))
            for i in range(1, n):
                t = i / n
                cyl("bridge_pier", (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), 0.7, -6, 3.9, M["concrete"], coll, 12)
    # Mushroom Rock: the free-standing limestone stack off the west shore (undercut by the sea)
    lime = mat_simple("limestone", (198, 190, 170), 0.95)
    for n in F.get("natural", []):
        if n["tags"].get("name") == "Mushroom Rock":
            at = n["at"]
            cyl("mushroom_rock_stem", at, 2.2, -3.0, 2.6, lime, coll, 14)
            cap = cyl("mushroom_rock_cap", at, 4.2, 2.4, 4.6, lime, coll, 16)
            cap.scale = (1.0, 0.8, 1.0)
    log("structures done")


# ── world + cameras ──────────────────────────────────────────────────────────
def build_world(sc):
    w = bpy.data.worlds.new("sky")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "MULTIPLE_SCATTERING"
    except TypeError:
        sky.sky_type = "SINGLE_SCATTERING"
    sky.sun_disc = False
    sun_el, sun_az = 52.0, 330.0  # afternoon in Perth: sun to the north-north-west
    sky.sun_elevation = math.radians(sun_el)
    sky.sun_rotation = math.radians(sun_az)
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs["Strength"].default_value = 0.16
    nt.links.new(bg.outputs[0], out.inputs[0])
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.2
    sun.angle = math.radians(0.6)
    sun.color = (1.0, 0.97, 0.92)
    so = link(bpy.data.objects.new("sun", sun))
    # Blender sun points down -Z; aim it from azimuth (clockwise from north) / elevation
    az = math.radians(sun_az)
    d = Vector((math.sin(az), math.cos(az), math.tan(math.radians(sun_el)))).normalized()  # towards the sun
    so.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()


def camera(name, loc, target, lens=35, ortho=None, clip=(1.0, 20000)):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_start, cam.clip_end = clip
    if ortho:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho
    ob = link(bpy.data.objects.new(name, cam))
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


# ── bake + export ────────────────────────────────────────────────────────────
def unlit_image_material(name, img, uv="UVMap"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = uv
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = img
    im.interpolation = "Linear"
    im.extension = "EXTEND"
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(uvn.outputs["UV"], im.inputs["Vector"])
    nt.links.new(im.outputs["Color"], em.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    mat.use_backface_culling = True
    return mat


def grid_mesh(name, stride):
    s = stride
    h = H[::s, ::s] * VX
    rows, cols = h.shape
    xs = -SX / 2 + np.arange(cols) * STEP * s
    ys = SY / 2 - np.arange(rows) * STEP * s
    X, Y = np.meshgrid(xs, ys)
    co = np.stack([X, Y, h], -1).reshape(-1, 3).astype(np.float32)
    idx = np.arange(rows * cols).reshape(rows, cols)
    q = np.stack([idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:], idx[:-1, :-1]], -1).reshape(-1, 4)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(co))
    me.vertices.foreach_set("co", co.ravel())
    me.loops.add(q.size)
    me.loops.foreach_set("vertex_index", q.ravel().astype(np.int32))
    me.polygons.add(len(q))
    me.polygons.foreach_set("loop_start", np.arange(0, q.size, 4, dtype=np.int32))
    me.update(calc_edges=True)
    return link(bpy.data.objects.new(name, me))


def set_hidden(pred, hidden):
    for ob in bpy.context.scene.objects:
        if pred(ob.name):
            ob.hide_render = hidden


def strata_image(out):
    img = bpy.data.images.new("strata", 4, 256, alpha=False)
    bands = [(0.0, (110, 98, 80)), (0.2, (142, 130, 106)), (0.3, (170, 160, 134)), (0.42, (150, 138, 114)),
             (0.55, (190, 178, 148)), (0.8, (206, 194, 162))]
    px = []
    for r in range(256):
        fz = r / 255
        c = [b for b in bands if b[0] <= fz][-1][1]
        shade = 0.92 + 0.08 * math.sin(r * 0.9)
        lc = [(v / 255) * shade for v in c]
        lc = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in lc]
        px += (lc + [1.0]) * 4
    img.pixels = px
    img.filepath_raw = str(out / "strata.png")
    img.file_format = "PNG"
    img.save()
    return img


def bake_and_export(sc, xs, ys):
    import bmesh

    out = W / "bake"
    out.mkdir(exist_ok=True)
    x0, x1, y0, y1 = float(xs[0]), float(xs[-1]), float(ys[-1]), float(ys[0])
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    tiles = []
    for j, (ty0, ty1) in enumerate(((ym, y1), (y0, ym))):          # j=0 north row
        for i, (tx0, tx1) in enumerate(((x0, xm), (xm, x1))):      # i=0 west column
            tiles.append({"name": f"t{j}{i}", "x": (tx0, tx1), "y": (ty0, ty1)})
    # 1. ortho tiles of the lit ground (shrubs, shadows, roofs and all); water + diorama sides hidden
    hide = lambda n: n == "water" or n.startswith(("waterside_", "skirt_", "base"))
    set_hidden(hide, True)
    sc.render.film_transparent = False
    sc.render.image_settings.color_mode = "RGB"
    sc.cycles.samples = A.bake_samples
    for t in tiles:
        tw, th = t["x"][1] - t["x"][0], t["y"][1] - t["y"][0]
        rx = A.tile
        ry = int(round(A.tile * th / tw))
        sc.render.resolution_x, sc.render.resolution_y = rx, ry
        c = ((t["x"][0] + t["x"][1]) / 2, (t["y"][0] + t["y"][1]) / 2)
        cam = camera(f"cam_{t['name']}", (c[0], c[1], 1500), (c[0], c[1], 0), ortho=max(tw, th))
        t["png"] = str(render_to(sc, cam, out / f"ground_{t['name']}.png"))
        t["px"] = (rx, ry)
        log("baked ground", t["name"], rx, "x", ry)
    set_hidden(hide, False)

    # 2. the export ground: decimated, cut on the tile lines, one object per tile with its own planar UV
    g = grid_mesh("ground_src", 2)
    mod = g.modifiers.new("dec", "DECIMATE")
    mod.ratio = A.decimate
    mod.use_collapse_triangulate = True
    bpy.ops.object.select_all(action="DESELECT")
    g.select_set(True)
    bpy.context.view_layer.objects.active = g
    bpy.ops.object.modifier_apply(modifier="dec")
    bm = bmesh.new()
    bm.from_mesh(g.data)
    for co, no in (((xm, 0, 0), (1, 0, 0)), ((0, ym, 0), (0, 1, 0))):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
    bm.to_mesh(g.data)
    bm.free()
    export_objs = []
    for t in tiles:
        tm = g.data.copy()
        bm = bmesh.new()
        bm.from_mesh(tm)
        kill = []
        for f in bm.faces:
            c = f.calc_center_median()
            if not (t["x"][0] - 1e-3 <= c.x <= t["x"][1] + 1e-3 and t["y"][0] - 1e-3 <= c.y <= t["y"][1] + 1e-3):
                kill.append(f)
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        uvl = bm.loops.layers.uv.new("UVMap")
        tw, th = t["x"][1] - t["x"][0], t["y"][1] - t["y"][0]
        cx, cy = (t["x"][0] + t["x"][1]) / 2, (t["y"][0] + t["y"][1]) / 2
        for f in bm.faces:
            for l in f.loops:
                # the ortho frame spans `sz` along its longer side; the image aspect matches tw:th
                l[uvl].uv = (0.5 + (l.vert.co.x - cx) / tw, 0.5 + (l.vert.co.y - cy) / th)
        bm.to_mesh(tm)
        bm.free()
        ob = link(bpy.data.objects.new(f"ground_{t['name']}", tm))
        img = bpy.data.images.load(t["png"])
        tm.materials.clear()
        tm.materials.append(unlit_image_material(f"ground_{t['name']}", img))
        export_objs.append(ob)
    bpy.data.objects.remove(g)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in export_objs)
    log("ground mesh", tris, "tris")

    # 3. structures: join, unwrap, bake their light into one small atlas
    struct = [o for o in bpy.data.collections["structures"].objects if o.type == "MESH"]
    if struct:
        dup = []
        for o in struct:
            c = o.copy()
            c.data = o.data.copy()
            link(c)
            dup.append(c)
        bpy.ops.object.select_all(action="DESELECT")
        for c in dup:
            c.select_set(True)
        bpy.context.view_layer.objects.active = dup[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join()
        so = bpy.context.active_object
        so.name = "structures"
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
        bpy.ops.object.mode_set(mode="OBJECT")
        simg = bpy.data.images.new("structures_bake", 2048, 2048, alpha=False)
        for m in so.data.materials:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = simg
            m.node_tree.nodes.active = n
        for o in struct:
            o.hide_render = True
        sc.cycles.samples = 128
        sc.render.bake.margin = 6
        bpy.ops.object.select_all(action="DESELECT")
        so.select_set(True)
        bpy.context.view_layer.objects.active = so
        bpy.ops.object.bake(type="COMBINED")
        simg.filepath_raw = str(out / "structures.png")
        simg.file_format = "PNG"
        simg.save()
        so.data.materials.clear()
        so.data.materials.append(unlit_image_material("structures_baked", simg))
        export_objs.append(so)
        log("structures baked")

    # 4. diorama sides: a strata strip (unlit); the water band translucent
    smat = unlit_image_material("diorama_sides", strata_image(out))
    wmat = bpy.data.materials.new("water_sides")
    wmat.use_nodes = True
    b = wmat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin((46, 150, 168))
    b.inputs["Emission Color"].default_value = lin((46, 150, 168))
    b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Alpha"].default_value = 0.5
    try:
        wmat.surface_render_method = "BLENDED"
    except Exception:
        pass
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(("skirt_", "base")):
            c = o.copy()
            c.data = o.data.copy()
            link(c)
            c.name = "side_" + o.name
            c.location = o.location
            uvl = c.data.uv_layers.new(name="UVMap")
            for poly in c.data.polygons:
                for li in poly.loop_indices:
                    z = c.data.vertices[c.data.loops[li].vertex_index].co.z
                    uvl.data[li].uv = (0.5, (z - BASE_Z) / (20 - BASE_Z))
            c.data.materials.clear()
            c.data.materials.append(smat)
            export_objs.append(c)
        elif o.name.startswith("waterside_"):
            c = o.copy()
            c.data = o.data.copy()
            link(c)
            c.name = "side_" + o.name
            c.data.materials.clear()
            c.data.materials.append(wmat)
            export_objs.append(c)

    # 5. export
    for o in export_objs:
        o["mrKind"] = "structure"
    bpy.ops.object.select_all(action="DESELECT")
    for o in export_objs:
        o.hide_render = False
        o.hide_set(False)
        o.select_set(True)
    glb = W / "landscape.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=True, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_image_format="WEBP",
        export_image_quality=A.webp, export_texcoords=True, export_normals=False, export_tangents=False,
        export_materials="EXPORT", export_extras=True, export_vertex_color="NONE")
    mb = round(glb.stat().st_size / 1e6, 2)
    log("exported", glb, mb, "MB")
    json.dump({"tiles": tiles, "ground_tris": tris, "glb_mb": mb, "vexag": VX, "bounds": [x0, x1, y0, y1],
               "base_z": BASE_Z}, open(out / "report.json", "w"), indent=1)


def main():
    sc = reset_scene()
    sc.unit_settings.system = "METRIC"
    base = collection("landscape")
    struct = collection("structures")
    veg = collection("vegetation")
    terrain, xs, ys, h = build_terrain(base)
    build_skirt(base, xs, ys, h)
    water = build_water(base, xs, ys)
    if not A.no_shrubs:
        build_vegetation(veg)
    build_structures(struct)
    build_world(sc)
    rx, ry = map(int, A.res.split("x"))
    set_render(sc, samples=A.samples, res_x=rx, res_y=ry)
    sc.cycles.max_bounces = 6
    try:
        sc.view_settings.look = A.look
    except TypeError:
        log("no look", A.look)
    sc.cycles.transmission_bounces = 4
    cams = {
        "hero": camera("cam_hero", (2300, -2500, 2100), (-60, 60, -6), lens=40),
        "top": camera("cam_top", (0, 0, 3000), (0, 0, 0), ortho=max(SX, SY) * 1.02),
        "headland": camera("cam_headland", (-120, -420, 260), (-520, 420, 0), lens=35),
        "battery": camera("cam_battery", (-420, 330, 70), (-540, 470, 8), lens=30),
        "lookout": camera("cam_lookout", (-430, -80, 40), (-505, 30, 10), lens=30),
        "causeway": camera("cam_causeway", (300, -150, 160), (620, 540, 0), lens=32),
        "north": camera("cam_north", (-300, 1600, 700), (-350, 300, 0), lens=40),
    }
    if A.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(W / "landscape.blend"))
    for name in [n for n in A.renders.split(",") if n]:
        sc.render.film_transparent = name == "hero"
        sc.render.image_settings.color_mode = "RGBA" if name == "hero" else "RGB"
        bpy.data.objects["water"].hide_render = False
        if name == "top":
            sc.render.resolution_x = sc.render.resolution_y = max(rx, ry)
        else:
            sc.render.resolution_x, sc.render.resolution_y = rx, ry
        render_to(sc, cams[name], W / "renders" / f"{name}.png")
        log("rendered", name)
    if A.bake:
        bake_and_export(sc, xs, ys)


main()
