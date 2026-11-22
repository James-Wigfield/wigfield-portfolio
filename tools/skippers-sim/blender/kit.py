"""Shared helpers for the Skippers sim Blender scripts (venue + boat).

Pattern copied from tools/memory-rooms/blender/common.py + materials.py, cut down: plain
Principled materials (no bake), bmesh primitives accumulated per object so the GLB stays small.
Blender frame: X = east (venue) / starboard (boat), Y = north / forward, Z = up. glTF export +Y up.
"""
import math
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


def args_after_dashdash():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0


_MATS = {}


def mat(name, rgb, rough=0.8, metal=0.0, emit=None):
    """Principled material, cached by name. rgb in 0–1 sRGB-ish (glTF baseColorFactor is linear;
    we convert so the hex we pick is what three.js shows)."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    b.inputs["Base Color"].default_value = (*lin, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*lin, 1.0)
        b.inputs["Emission Strength"].default_value = emit
    if name.startswith("glass"):
        b.inputs["Alpha"].default_value = 0.35
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            m.blend_method = "BLEND"
    m.diffuse_color = (*lin, 1.0)
    _MATS[name] = m
    return m


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


class Builder:
    """Accumulates bmesh primitives (each with a material) and makes ONE object."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _paint(self, verts, m, smooth=False):
        i = self._mi(m)
        for v in verts:
            for f in v.link_faces:
                f.material_index = i
                f.smooth = smooth
        return verts

    def box(self, m, center, size, rz=0.0, rx=0.0, ry=0.0):
        M = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rx, 4, "X") @ Matrix.Diagonal((*size, 1))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        return self._paint(r["verts"], m)

    def cyl(self, m, base, r1, r2, h, seg=8, rz=0.0, axis=None, smooth=False, caps=True):
        """Cylinder/cone standing on `base` (z up), or along `axis` ('x'|'y') centred on base."""
        if axis == "x":
            R = Matrix.Rotation(math.pi / 2, 4, "Y")
            M = Matrix.Translation(Vector(base)) @ Matrix.Rotation(rz, 4, "Z") @ R
        elif axis == "y":
            R = Matrix.Rotation(-math.pi / 2, 4, "X")
            M = Matrix.Translation(Vector(base)) @ Matrix.Rotation(rz, 4, "Z") @ R
        else:
            M = Matrix.Translation(Vector(base) + Vector((0, 0, h / 2))) @ Matrix.Rotation(rz, 4, "Z")
        r = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=M)
        return self._paint(r["verts"], m, smooth)

    def ico(self, m, center, radius, scale=(1, 1, 1), sub=1, jitter=0.0, rz=0.0, rng=None):
        M = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Diagonal((*scale, 1))
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=radius, matrix=M)
        if jitter and rng:
            for v in r["verts"]:
                v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter
        return self._paint(r["verts"], m)

    def poly(self, m, verts, faces, smooth=False):
        vs = [self.bm.verts.new(Vector(v)) for v in verts]
        i = self._mi(m)
        for f in faces:
            try:
                face = self.bm.faces.new([vs[k] for k in f])
                face.material_index = i
                face.smooth = smooth
            except ValueError:
                pass
        return vs

    def grid(self, m, rows, smooth=False):
        """rows: list of equal-length lists of (x,y,z) → quad strip surface."""
        n = len(rows[0])
        verts = [p for row in rows for p in row]
        faces = [(r * n + c, r * n + c + 1, (r + 1) * n + c + 1, (r + 1) * n + c) for r in range(len(rows) - 1) for c in range(n - 1)]
        return self.poly(m, verts, faces, smooth)

    def finish(self, parent=None, origin=(0, 0, 0)):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        if origin != (0, 0, 0):
            bmesh.ops.translate(self.bm, vec=-Vector(origin), verts=self.bm.verts)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = origin
        if parent:
            ob.parent = parent
        return ob


def empty(name, loc, parent=None, size=0.15):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = size
    bpy.context.scene.collection.objects.link(e)
    if parent:
        e.parent = parent
        e.location = Vector(loc) - parent.location
    else:
        e.location = loc
    return e


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=False, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_texcoords=False, export_normals=True,
        export_tangents=False, export_materials="EXPORT", export_extras=True, export_vertex_color="NONE")


def rng(seed):
    return random.Random(seed)
