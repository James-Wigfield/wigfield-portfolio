"""Small mesh-building helpers for the Memory Rooms shell, site and exterior kit pieces.

Everything is built from Python lists with `Mesh.from_pydata` (fast, deterministic), with
correct outward winding, per-face materials, a box-projected `UVMap` (metres) so UV-based
procedural materials still work, smooth-by-angle shading and an optional bevel modifier.

    from mrgeo import MB, bevel
    mb = MB()
    mb.box((0, 0, 0), (1, 0.5, 0.8), mat)            # axis-aligned min/max corners
    mb.cyl((0, 0, 0), 0.1, 1.0, mat, n=24)             # vertical cylinder
    ob = mb.obj("frame", ctx.collection, bevel_w=0.01)

All coordinates are Blender coordinates (z up) in whatever space the caller is modelling in
(kit pieces: local space, base centre at the origin, front toward -y).
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise


def _v(p):
    return Vector((float(p[0]), float(p[1]), float(p[2])))


class MB:
    """Mesh builder: accumulate faces with materials, then make one object."""

    def __init__(self):
        self.verts: list[Vector] = []
        self.faces: list[tuple[int, ...]] = []
        self.face_mat: list[int] = []
        self.face_smooth: list[bool] = []
        self.mats: list = []

    # ── bookkeeping ──────────────────────────────────────────────────────────
    def _mi(self, mat):
        if mat is None:
            return 0
        for i, m in enumerate(self.mats):
            if m == mat:
                return i
        self.mats.append(mat)
        return len(self.mats) - 1

    def add_verts(self, pts):
        base = len(self.verts)
        self.verts.extend(_v(p) for p in pts)
        return base

    def face(self, idx, mat=None, smooth=False):
        self.faces.append(tuple(idx))
        self.face_mat.append(self._mi(mat))
        self.face_smooth.append(bool(smooth))

    def poly(self, pts, mat=None, normal=None, smooth=False):
        """One polygon from world points; flipped if it disagrees with `normal`."""
        pts = [_v(p) for p in pts]
        if normal is not None:
            n = Vector((0.0, 0.0, 0.0))
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                n.x += (a.y - b.y) * (a.z + b.z)
                n.y += (a.z - b.z) * (a.x + b.x)
                n.z += (a.x - b.x) * (a.y + b.y)
            if n.dot(_v(normal)) < 0:
                pts.reverse()
        b = self.add_verts(pts)
        self.face(range(b, b + len(pts)), mat, smooth)

    # ── primitives ───────────────────────────────────────────────────────────
    def box8(self, c, mat=None, skip=()):
        """Hexahedron from 8 corners ordered x0y0z0, x1y0z0, x1y1z0, x0y1z0, then the same at z1.
        `skip` may hold 'bottom', 'top', 'front' (y0), 'back' (y1), 'left' (x0), 'right' (x1)."""
        c = [_v(p) for p in c]
        if (c[1] - c[0]).cross(c[3] - c[0]).dot(c[4] - c[0]) < 0:  # mirrored frame: swap x0/x1
            c = [c[i] for i in (1, 0, 3, 2, 5, 4, 7, 6)]
            skip = tuple({"left": "right", "right": "left"}.get(s, s) for s in skip)
        b = self.add_verts(c)
        faces = {
            "bottom": (0, 3, 2, 1), "top": (4, 5, 6, 7), "front": (0, 1, 5, 4),
            "back": (2, 3, 7, 6), "left": (3, 0, 4, 7), "right": (1, 2, 6, 5),
        }
        for k, f in faces.items():
            if k not in skip:
                self.face([b + i for i in f], mat)
        return b

    def box(self, mn, mx, mat=None, skip=()):
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        if z1 < z0:
            z0, z1 = z1, z0
        return self.box8([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mat, skip)

    def cbox(self, center, size, mat=None, skip=()):
        """Box from its centre and full size."""
        cx, cy, cz = center
        sx, sy, sz = size
        return self.box((cx - sx / 2, cy - sy / 2, cz - sz / 2), (cx + sx / 2, cy + sy / 2, cz + sz / 2), mat, skip)

    def tbox(self, m: Matrix, size, mat=None, base=False):
        """Box of `size` transformed by matrix `m` (centred on its local origin, or base-centred)."""
        sx, sy, sz = size
        z0, z1 = (0.0, sz) if base else (-sz / 2, sz / 2)
        loc = [(-sx / 2, -sy / 2, z0), (sx / 2, -sy / 2, z0), (sx / 2, sy / 2, z0), (-sx / 2, sy / 2, z0),
               (-sx / 2, -sy / 2, z1), (sx / 2, -sy / 2, z1), (sx / 2, sy / 2, z1), (-sx / 2, sy / 2, z1)]
        return self.box8([m @ Vector(p) for p in loc], mat)

    def lathe(self, profile, mat=None, n=24, center=(0, 0, 0), cap_bottom=True, cap_top=True,
              smooth=True, m: Matrix | None = None, phase=0.0):
        """Surface of revolution about local +z. profile = [(r, z), ...] from bottom to top."""
        cx, cy, cz = center
        rings = []
        for r, z in profile:
            ring = []
            for i in range(n):
                a = phase + 2 * math.pi * i / n
                p = Vector((cx + r * math.cos(a), cy + r * math.sin(a), cz + z))
                ring.append(m @ p if m is not None else p)
            rings.append(self.add_verts(ring))
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                self.face((a + i, a + j, b + j, b + i), mat, smooth)
        if cap_bottom and profile[0][0] > 1e-6:
            self.face([rings[0] + i for i in reversed(range(n))], mat)
        if cap_top and profile[-1][0] > 1e-6:
            self.face([rings[-1] + i for i in range(n)], mat)

    def cyl(self, base, r, h, mat=None, n=24, r_top=None, m: Matrix | None = None, smooth=True):
        rt = r if r_top is None else r_top
        self.lathe([(r, 0.0), (rt, h)], mat, n=n, center=base, smooth=smooth, m=m)

    def prism(self, pts2d, axis, c0, c1, mat=None, side_mat=None, smooth=False):
        """Extrude a 2D polygon. axis 'x': pts are (y, z); 'y': (z, x); 'z': (x, y). c0..c1 along axis."""
        area = 0.0
        for i in range(len(pts2d)):
            p, q = pts2d[i], pts2d[(i + 1) % len(pts2d)]
            area += p[0] * q[1] - q[0] * p[1]
        pts = list(pts2d) if area > 0 else list(reversed(pts2d))

        def to3(p, c):
            if axis == "x":
                return (c, p[0], p[1])
            if axis == "y":
                return (p[1], c, p[0])
            return (p[0], p[1], c)

        n = len(pts)
        b0 = self.add_verts([to3(p, c0) for p in pts])
        b1 = self.add_verts([to3(p, c1) for p in pts])
        self.face([b1 + i for i in range(n)], mat)
        self.face([b0 + i for i in reversed(range(n))], mat)
        for i in range(n):
            j = (i + 1) % n
            self.face((b0 + i, b0 + j, b1 + j, b1 + i), side_mat or mat, smooth)

    def tube(self, path, r, mat=None, n=12, cap=True, smooth=True):
        """A tube along a polyline (list of points), radius r (number or list per point)."""
        path = [_v(p) for p in path]
        rs = r if isinstance(r, (list, tuple)) else [r] * len(path)
        rings = []
        prev_n = None
        for i, p in enumerate(path):
            if i == 0:
                t = (path[1] - path[0]).normalized()
            elif i == len(path) - 1:
                t = (path[-1] - path[-2]).normalized()
            else:
                t = ((path[i + 1] - path[i]).normalized() + (path[i] - path[i - 1]).normalized()).normalized()
            if prev_n is None:
                ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
                nv = t.cross(ref).normalized()
            else:
                nv = (prev_n - t * prev_n.dot(t)).normalized()
            bv = t.cross(nv).normalized()
            prev_n = nv
            ring = [p + (nv * math.cos(2 * math.pi * k / n) + bv * math.sin(2 * math.pi * k / n)) * rs[i]
                    for k in range(n)]
            rings.append(self.add_verts(ring))
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                self.face((a + i, a + j, b + j, b + i), mat, smooth)  # outward (rings run CCW about t)
        if cap:
            self.face([rings[0] + i for i in reversed(range(n))], mat)
            self.face([rings[-1] + i for i in range(n)], mat)

    def blob(self, center, radii, mat=None, subdiv=3, rough=0.18, freq=1.6, seed=0.0):
        """A lumpy ellipsoid (icosphere displaced by smooth noise): foliage puffs, bushes."""
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
        off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
        pts = []
        for v in bm.verts:
            d = v.co.normalized()
            k = 1.0 + rough * noise.noise(d * freq + off) + rough * 0.45 * noise.noise(d * freq * 2.7 + off)
            pts.append(Vector((center[0] + d.x * radii[0] * k, center[1] + d.y * radii[1] * k,
                               center[2] + d.z * radii[2] * k)))
        base = self.add_verts(pts)
        for f in bm.faces:
            self.face([base + v.index for v in f.verts], mat, True)
        bm.free()

    # ── output ───────────────────────────────────────────────────────────────
    def obj(self, name, collection, bevel_w=0.0, segments=2, angle=35.0, smooth_angle=35.0,
            weld=True, uv=True, harden=True):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        mesh.polygons.foreach_set("material_index", self.face_mat)
        smooth = [True] * len(self.faces) if bevel_w > 0 else self.face_smooth
        mesh.polygons.foreach_set("use_smooth", smooth)
        mesh.validate(clean_customdata=False)
        for m in self.mats or [None]:
            mesh.materials.append(m)
        if weld:
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            bm.to_mesh(mesh)
            bm.free()
        if uv:
            box_uv(mesh)
        try:
            mesh.set_sharp_from_angle(angle=math.radians(smooth_angle))
        except Exception:
            pass
        ob = bpy.data.objects.new(name, mesh)
        collection.objects.link(ob)
        if bevel_w > 0:
            bevel(ob, bevel_w, segments, angle, harden)
        return ob


def box_uv(mesh, scale=1.0, name="UVMap"):
    """Box-projected UVs in metres (one UV unit = 1 m / scale)."""
    if not mesh.polygons:
        return
    uv = mesh.uv_layers.new(name=name) if name not in mesh.uv_layers else mesh.uv_layers[name]
    data = uv.data
    co = [v.co for v in mesh.vertices]
    for poly in mesh.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            p = co[mesh.loops[li].vertex_index]
            if az >= ax and az >= ay:
                u, v = p.x, p.y
            elif ax >= ay:
                u, v = p.y, p.z
            else:
                u, v = p.x, p.z
            data[li].uv = (u * scale, v * scale)


def bevel(ob, width, segments=2, angle=35.0, harden=True):
    mod = ob.modifiers.new("bevel", "BEVEL")
    mod.width = float(width)
    mod.segments = int(segments)
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.use_clamp_overlap = True
    try:
        mod.harden_normals = bool(harden)
    except Exception:
        pass
    return mod


def solidify(ob, thickness, offset=-1.0):
    mod = ob.modifiers.new("solidify", "SOLIDIFY")
    mod.thickness = float(thickness)
    mod.offset = float(offset)
    mod.use_even_offset = True
    return mod


def rot_z(deg):
    return Matrix.Rotation(math.radians(deg), 4, "Z")


def tr(x, y, z):
    return Matrix.Translation((x, y, z))


def shade(hex_color: str, k: float) -> str:
    """Lighten (k > 0) or darken (k < 0) a '#rrggbb' colour, in display space."""
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    if k >= 0:
        c = [round(v + (255 - v) * k) for v in c]
    else:
        c = [round(v * (1 + k)) for v in c]
    return "#" + "".join(f"{max(0, min(255, v)):02x}" for v in c)


def mix(a: str, b: str, t: float) -> str:
    ha, hb = a.lstrip("#"), b.lstrip("#")
    ca = [int(ha[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(hb[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ca, cb))


def flat_emit(name: str, color_hex: str, strength: float = 1.0):
    """A self-lit flat-colour material whose name starts with 'emit' (GLB contract)."""
    from scene_io import hex_rgba

    nm = name if name.startswith("emit") else f"emit_{name}"
    mat = bpy.data.materials.get(nm)
    if mat:
        return mat
    mat = bpy.data.materials.new(nm)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)  # pure emission: one predictable colour
    bsdf.inputs["Roughness"].default_value = 1.0
    try:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    except KeyError:
        pass
    bsdf.inputs["Emission Color"].default_value = hex_rgba(color_hex)
    bsdf.inputs["Emission Strength"].default_value = float(strength)
    mat["mr_emit_hex"] = color_hex
    return mat


# ── material guard ────────────────────────────────────────────────────────────
_SIMPLE_ROUGH = {"chrome": 0.08, "brass": 0.25, "metal": 0.35, "glass": 0.02, "ceramic": 0.2, "tile": 0.25,
                 "marble": 0.2, "leather": 0.45, "plastic": 0.4}
_SIMPLE_COLOR = {"oak": "#a8784a", "pine": "#c9a273", "walnut": "#5e3f2a", "plaster": "#e8e2d6", "brick": "#9a4f3a",
                 "concrete": "#9d9a94", "tile": "#e6e4df", "stone": "#8f8a80", "marble": "#ece9e4",
                 "linen": "#dcd5c8", "wool": "#b9a88f", "velvet": "#7a4b52", "leather": "#6b4630",
                 "metal": "#8c8f93", "chrome": "#d8dadd", "brass": "#c49a4a", "glass": "#cfe3e8",
                 "ceramic": "#f0ece4", "plastic": "#d9d9d9", "paper": "#f1ead8", "plant": "#4f7a4a",
                 "emissive": "#ffe2b0"}


def simple_material(name, color=None, **opts):
    """A plain Principled material with the right name prefix (used only when materials.py fails)."""
    from scene_io import hex_rgba

    name = name if name in _SIMPLE_COLOR else "plaster"
    color = color or _SIMPLE_COLOR[name]
    prefix = "glass" if name == "glass" else "emit" if name == "emissive" else name
    key = f"{prefix}_{color.lstrip('#')}_simple"
    mat = bpy.data.materials.get(key)
    if mat:
        return mat
    mat = bpy.data.materials.new(key)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hex_rgba(color)
    b.inputs["Roughness"].default_value = _SIMPLE_ROUGH.get(name, 0.7)
    b.inputs["Metallic"].default_value = 1.0 if name in ("metal", "chrome", "brass") else 0.0
    if name == "glass":
        b.inputs["Transmission Weight"].default_value = 1.0
    if name == "emissive":
        b.inputs["Emission Color"].default_value = hex_rgba(color)
        b.inputs["Emission Strength"].default_value = float(opts.get("strength", 4.0))
    mat["mr_material"] = name
    mat["mr_color"] = color
    return mat


def install_material_guard(materials_mod, problems: list):
    """Wrap materials.get/floor/wall/ground so one broken recipe can never abort a build."""
    if getattr(materials_mod, "_mr_guarded", False):
        return
    seen = set()

    def note(what, e):
        msg = f"materials.{what} failed ({type(e).__name__}: {e}); used a plain material"
        if msg not in seen:
            seen.add(msg)
            problems.append(msg)
            print("[mr]", msg, flush=True)

    orig_get = materials_mod.get

    def get(name, color=None, accent=None, **opts):
        try:
            return orig_get(name, color, accent, **opts)
        except Exception as e:
            note(f"get({name!r})", e)
            return simple_material(name, color, **opts)

    materials_mod.get = get
    fallback = {"floor": ("oak", {"carpet": "wool", "tile": "tile", "concrete": "concrete", "vinyl": "plastic",
                                  "stone": "stone"}),
                "wall": ("plaster", {"brick": "brick", "timber": "pine", "tile": "tile", "concrete": "concrete"}),
                "ground": ("concrete", {"grass": "plant", "paving": "stone", "gravel": "stone", "dirt": "stone"})}
    for helper, (default, table) in fallback.items():
        fn = getattr(materials_mod, helper, None)
        if fn is None:
            continue

        def wrapped(finish=None, color=None, _fn=fn, _helper=helper, _default=default, _table=table):
            try:
                return _fn(finish, color)
            except Exception as e:
                note(f"{_helper}({finish!r})", e)
                return simple_material(_table.get(finish, _default), color)

        setattr(materials_mod, helper, wrapped)
    materials_mod._mr_guarded = True
