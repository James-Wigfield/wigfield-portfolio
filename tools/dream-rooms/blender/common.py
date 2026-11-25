"""Dream Rooms · shared Blender plumbing for the kit (tools/dream-rooms/blender/).

Every script runs headless:
    blender.exe -b --factory-startup --python <script> -- <args>

What lives here:
  * dims.json (READ, never copied), the ONE viewer -> Blender conversion `v2b`, the wall table,
    doorway frames and Z-stub legs (a mirror of src/dream-rooms/contracts/layout.js);
  * MeshBuilder: faces in viewer coordinates (x, y up, z; metres), each face given the normal it must
    show (faces point at the walker), a planar `tex` UV in metres for the procedural finishes;
  * GPU + colour management (Cycles, OptiX -> CUDA -> CPU, AgX + "AgX - Base Contrast");
  * material node helpers, the unlit export material, UV + bake helpers, auto exposure.

Viewer coordinates: y up, north = -z. Blender: z up. v2b(x, y, z) = (x, -z, y) is a proper rotation
(det +1), so windings and normals survive it, and glTF export with export_yup=True gives the viewer
coordinates back exactly.
"""

from __future__ import annotations

import argparse
import array
import json
import math
import sys
import time
from pathlib import Path

import bmesh  # noqa: F401  (kept importable for bespoke scripts)
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
REPO = HERE.parents[2]
DIMS_PATH = REPO / "src" / "dream-rooms" / "contracts" / "dims.json"
DIMS = json.loads(DIMS_PATH.read_text(encoding="utf-8"))
DOOR = DIMS["door"]
STUB = DIMS["stub"]
WALKER = DIMS["walker"]
BUDGET = DIMS["budget"]
CORR = DIMS["corridor"]

_T0 = time.perf_counter()


def log(*parts):
    """Ids, counts, timings only (decision 14: never dream words)."""
    print(f"[dr {time.perf_counter() - _T0:6.1f}s]", *parts, flush=True)


def report(obj):
    """The last line Node parses (tools/dream-rooms/lib/blender.mjs)."""
    print("REPORT " + json.dumps(obj), flush=True)


def script_args(parser: argparse.ArgumentParser, argv=None):
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ── coordinates ──────────────────────────────────────────────────────────────
def v2b(x, y=None, z=None):
    """Viewer (x, y up, z) -> Blender (x, -z, y). The one conversion."""
    if y is None:
        x, y, z = x
    return (x, -z, y)


C_V2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
C_B2V = C_V2B.inverted()


def obj_matrix(mv: Matrix) -> Matrix:
    """A viewer-space object matrix -> the Blender object matrix whose glTF node gets mv back."""
    return C_V2B @ mv @ C_B2V


def cam_matrix(mv: Matrix) -> Matrix:
    """A viewer-space camera (looks along local -z, +y up) -> a Blender camera matrix."""
    return C_V2B @ mv


def viewer_matrix(pos, yaw=0.0, pitch=0.0) -> Matrix:
    """T(pos) R_y(yaw) R_x(pitch), three.js sense: yaw 0 looks along -z, + turns left."""
    return Matrix.Translation(Vector(pos)) @ Matrix.Rotation(yaw, 4, "Y") @ Matrix.Rotation(pitch, 4, "X")


FACING_YAW = {"n": 0.0, "w": math.pi / 2, "s": math.pi, "e": -math.pi / 2}
FACING_VEC = {"n": (0, 0, -1), "s": (0, 0, 1), "w": (-1, 0, 0), "e": (1, 0, 0)}


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    n = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


def left_of(h):
    """Left of a horizontal heading h (walking along h, y up). layout.js leftOf."""
    return (h[2], 0.0, -h[0])


def yaw_of(h):
    """yaw of a horizontal heading (0 = -z). layout.js yawOf."""
    return math.atan2(-h[0], -h[2])


def rot_y(v, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return (v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c)


# ── the wall table + doorway frames (CONTRACTS.md §5, layout.js) ─────────────
class Wall:
    __slots__ = ("side", "inward", "along", "length", "_size")

    def __init__(self, side, size):
        w, _, d = size
        self.side = side
        self._size = size
        if side == "n":
            self.inward, self.along, self.length = (0, 0, 1), (1, 0, 0), w
        elif side == "s":
            self.inward, self.along, self.length = (0, 0, -1), (1, 0, 0), w
        elif side == "w":
            self.inward, self.along, self.length = (1, 0, 0), (0, 0, 1), d
        elif side == "e":
            self.inward, self.along, self.length = (-1, 0, 0), (0, 0, 1), d
        else:
            raise ValueError(f"unknown wall {side}")

    def point(self, at, y=0.0, off=0.0):
        """Module-local point at `at` along the wall, height y, `off` metres inward from the plane."""
        w, _, d = self._size
        base = {"n": (at, 0, 0), "s": (at, 0, d), "w": (0, 0, at), "e": (w, 0, at)}[self.side]
        return (base[0] + self.inward[0] * off, y, base[2] + self.inward[2] * off)


def doorway_frame(module, doorway, local=True):
    """layout.js doorwayFrame, module-local (local=True) or world. Keys: centre inward out side b1 b2 b3 m."""
    wall = Wall(doorway["wall"], module["size"])
    centre = wall.point(doorway["at"])
    if not local:
        centre = add(tuple(module["origin"]), centre)
    inward = wall.inward
    out = mul(inward, -1)
    side = left_of(out)
    b1 = add(centre, mul(out, STUB["leg1"]))
    b2 = add(b1, mul(side, STUB["leg2"]))
    b3 = add(b2, mul(out, STUB["leg3"]))
    m = add(b1, mul(side, STUB["leg2"] / 2))
    return {"id": doorway["id"], "wall": doorway["wall"], "at": doorway["at"], "centre": centre, "inward": inward,
            "out": out, "side": side, "b1": b1, "b2": b2, "b3": b3, "m": m, "width": DOOR["w"], "height": DOOR["h"]}


def stub_outline():
    """The Z-stub in its own 2-D frame (s along `side`, o along `out`, o = 0 on the wall's room face):
    [(s, o), ...] walls only (the entry edge at o = wall thickness is left out). Three floor rectangles."""
    h = STUB["width"] / 2
    l1, l2, l3, t = STUB["leg1"], STUB["leg2"], STUB["leg3"], STUB["wall"]
    poly = [(-h, t), (h, t), (h, l1 - h), (l2 + h, l1 - h), (l2 + h, l1 + l3), (l2 - h, l1 + l3), (l2 - h, l1 + h),
            (-h, l1 + h)]
    rects = [(-h, h, 0.0, l1 + h), (h, l2 - h, l1 - h, l1 + h), (l2 - h, l2 + h, l1 - h, l1 + l3)]
    return poly, rects


# ── colour ───────────────────────────────────────────────────────────────────
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hex_lin(h):
    return tuple(srgb_to_lin(c) for c in hex_srgb(h))


def rgba(h, a=1.0):
    return (*hex_lin(h), a)


def srgb_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c * 255))):02x}" for c in rgb)


def mix_hex(a, b, t):
    ra, rb = hex_srgb(a), hex_srgb(b)
    return srgb_hex(tuple(x + (y - x) * t for x, y in zip(ra, rb)))


def shade_hex(h, k):
    """Multiply the sRGB value by k (k < 1 darker)."""
    return srgb_hex(tuple(min(1.0, c * k) for c in hex_srgb(h)))


def warmth_hex(w):
    """look.warmth 0..1 -> a light colour: cool blue-white, neutral, warm amber."""
    w = max(0.0, min(1.0, float(w)))
    if w < 0.5:
        return mix_hex("#c4d3ff", "#fff3e6", w / 0.5)
    return mix_hex("#fff3e6", "#ffbf80", (w - 0.5) / 0.5)


# ── scene, GPU, colour management ────────────────────────────────────────────
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def enable_gpu(sc) -> list:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    used = []
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        devs = [d for d in prefs.devices if d.type == backend]
        for d in prefs.devices:
            d.use = d.type == backend
        if devs:
            used = [f"{backend}:{d.name}" for d in devs]
            break
    sc.cycles.device = "GPU" if used else "CPU"
    return used or ["CPU"]


def setup_render(sc, samples=128, res=(1280, 800)):
    sc.render.engine = "CYCLES"
    devices = enable_gpu(sc)
    sc.cycles.samples = int(samples)
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPTIX"
    except TypeError:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    c = sc.cycles
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 2
    c.transmission_bounces = 4
    c.transparent_max_bounces = 8
    c.volume_bounces = 0
    c.sample_clamp_indirect = 10.0
    c.blur_glossy = 0.5
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Base Contrast"
    except TypeError:
        pass
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    return devices


def dark_world(sc, hexcol="#050505", strength=1.0):
    w = bpy.data.worlds.new("dr_world")
    sc.world = w
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = rgba(hexcol)
    bg.inputs["Strength"].default_value = strength
    return w


def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def sync():
    """view_layer.objects is synced lazily: new objects are missing from it (and from renders and
    bakes) until an update."""
    bpy.context.view_layer.update()


def select_only(objs, active=None):
    sync()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


# ── mesh building (viewer coordinates) ───────────────────────────────────────
class Xf:
    """A local frame: p = o + r*x + u*y + f*z (module-local viewer coordinates)."""

    def __init__(self, o=(0, 0, 0), r=(1, 0, 0), u=(0, 1, 0), f=(0, 0, 1)):
        self.o, self.r, self.u, self.f = tuple(o), tuple(r), tuple(u), tuple(f)

    def p(self, x, y, z):
        o, r, u, f = self.o, self.r, self.u, self.f
        return (o[0] + r[0] * x + u[0] * y + f[0] * z, o[1] + r[1] * x + u[1] * y + f[1] * z,
                o[2] + r[2] * x + u[2] * y + f[2] * z)

    def d(self, x, y, z):
        r, u, f = self.r, self.u, self.f
        return (r[0] * x + u[0] * y + f[0] * z, r[1] * x + u[1] * y + f[1] * z, r[2] * x + u[2] * y + f[2] * z)

    @staticmethod
    def facing(o, fwd):
        """Front along fwd (horizontal), y up, right = up x fwd."""
        f = norm(fwd)
        return Xf(o, (f[2], 0.0, -f[0]), (0, 1, 0), f)


IDENT = Xf()


def newell(pts):
    n = [0.0, 0.0, 0.0]
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return tuple(n)


class MeshBuilder:
    """Faces in viewer coordinates. Every face is given the normal it must show; the winding is fixed to
    match. `base` is added to every point (module origin + copy offset). The `tex` UV is a planar
    projection in metres (floors: x, z; walls: along, y) so procedural finishes tile in metres."""

    def __init__(self, name, base=(0, 0, 0)):
        self.name = name
        self.base = tuple(base)
        self.verts = []
        self.vmap = {}
        self.faces = []
        self.fmat = []
        self.mats = []

    def _v(self, p):
        q = (round(p[0] + self.base[0], 5), round(p[1] + self.base[1], 5), round(p[2] + self.base[2], 5))
        i = self.vmap.get(q)
        if i is None:
            i = len(self.verts)
            self.verts.append(q)
            self.vmap[q] = i
        return i

    def _mi(self, mat):
        for i, m in enumerate(self.mats):
            if m is mat:
                return i
        self.mats.append(mat)
        return len(self.mats) - 1

    def poly(self, pts, mat, normal=None):
        pts = list(pts)
        if normal is not None and dot(newell(pts), normal) < 0:
            pts.reverse()
        idx = []
        for p in pts:
            i = self._v(p)
            if not idx or idx[-1] != i:
                idx.append(i)
        if len(idx) > 1 and idx[0] == idx[-1]:
            idx.pop()
        if len(set(idx)) < 3:
            return
        self.faces.append(idx)
        self.fmat.append(self._mi(mat))

    def rect(self, o, u, v, mat, normal):
        """A rectangle with corner o and edge vectors u, v."""
        self.poly([o, add(o, u), add(add(o, u), v), add(o, v)], mat, normal)

    def box(self, lo, hi, mat, xf=IDENT, skip=()):
        """An axis box in the frame xf (local lo..hi), outward faces. skip: '-x' '+x' '-y' '+y' '-z' '+z'."""
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        P = xf.p
        faces = {
            "-x": ([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], xf.d(-1, 0, 0)),
            "+x": ([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], xf.d(1, 0, 0)),
            "-y": ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], xf.d(0, -1, 0)),
            "+y": ([P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], xf.d(0, 1, 0)),
            "-z": ([P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], xf.d(0, 0, -1)),
            "+z": ([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], xf.d(0, 0, 1)),
        }
        for k, (pts, n) in faces.items():
            if k not in skip:
                self.poly(pts, mat, n)

    def prism(self, pts2, y0, y1, mat, xf=IDENT, caps=(True, True)):
        """Extrude a CCW (seen from +y) polygon [(x, z)...] from y0 to y1 in frame xf."""
        P = xf.p
        n = len(pts2)
        for i in range(n):
            a, b = pts2[i], pts2[(i + 1) % n]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            ex, ez = b[0] - a[0], b[1] - a[1]
            nrm = xf.d(ez, 0, -ex)  # outward for CCW-from-above
            cx = sum(p[0] for p in pts2) / n
            cz = sum(p[1] for p in pts2) / n
            if (mid[0] - cx) * ez + (mid[1] - cz) * (-ex) < 0:
                nrm = mul(nrm, -1)
            self.poly([P(a[0], y0, a[1]), P(b[0], y0, b[1]), P(b[0], y1, b[1]), P(a[0], y1, a[1])], mat, nrm)
        if caps[1]:
            self.poly([P(x, y1, z) for x, z in pts2], mat, xf.d(0, 1, 0))
        if caps[0]:
            self.poly([P(x, y0, z) for x, z in pts2], mat, xf.d(0, -1, 0))

    def panel_grid(self, xf, x0, x1, y0, y1, z, base_mat, rects):
        """A flat, CONNECTED panel in frame xf (plane z, facing +z local) whose cells take the material of
        the last rect [(x0, x1, y0, y1, mat)] covering them: slits, gaps, latches and tags as coloured
        cells of one surface. One UV island however many details it has."""
        xs = {x0, x1}
        ys = {y0, y1}
        for (a, b, c, d, _m) in rects:
            for v in (a, b):
                if x0 < v < x1:
                    xs.add(round(v, 5))
            for v in (c, d):
                if y0 < v < y1:
                    ys.add(round(v, 5))
        xs = sorted(xs)
        ys = sorted(ys)
        n = xf.d(0, 0, 1)
        for j in range(len(ys) - 1):
            cy = (ys[j] + ys[j + 1]) / 2
            row = [r for r in rects if r[2] <= cy <= r[3]]
            for i in range(len(xs) - 1):
                cx = (xs[i] + xs[i + 1]) / 2
                mat = base_mat
                for (a, b, c, d, m) in row:
                    if a <= cx <= b:
                        mat = m
                self.poly([xf.p(xs[i], ys[j], z), xf.p(xs[i + 1], ys[j], z), xf.p(xs[i + 1], ys[j + 1], z),
                           xf.p(xs[i], ys[j + 1], z)], mat, n)

    def empty(self):
        return not self.faces

    def to_object(self, coll, name=None, pivot=None, matrix_v=None):
        """Create the Blender object. pivot (world viewer coords) moves the origin there; matrix_v
        (a viewer-space object matrix) treats the points as object-local instead."""
        name = name or self.name
        me = bpy.data.meshes.new(name)
        if matrix_v is not None:
            vl = self.verts
        elif pivot is not None:
            vl = [sub(v, pivot) for v in self.verts]
        else:
            vl = self.verts
        me.from_pydata([v2b(v) for v in vl], [], self.faces)
        me.validate(clean_customdata=False)
        uv = me.uv_layers.new(name="tex")
        for poly in me.polygons:
            ids = [self.verts[me.loops[li].vertex_index] for li in poly.loop_indices]
            n = newell(ids)
            ax = max(range(3), key=lambda k: abs(n[k]))
            for li, p in zip(poly.loop_indices, ids):
                if ax == 1:
                    uv.data[li].uv = (p[0], -p[2] if n[1] > 0 else p[2])
                elif ax == 0:
                    uv.data[li].uv = (-p[2] if n[0] > 0 else p[2], p[1])
                else:
                    uv.data[li].uv = (p[0] if n[2] > 0 else -p[0], p[1])
        for m in self.mats:
            me.materials.append(m)
        for poly, mi in zip(me.polygons, self.fmat):
            poly.material_index = mi
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        if matrix_v is not None:
            ob.matrix_world = obj_matrix(matrix_v)
        elif pivot is not None:
            ob.location = v2b(pivot)
        return ob


def wall_with_holes(mb_mesh, wall: Wall, height, holes, mat, normal_off=0.0, u_range=None, chunk=None,
                    split_cb=None):
    """Fill a wall plane (u along the wall, v up) with quads, skipping rectangular holes
    [(u0, u1, v0, v1)]. Returns nothing; faces go into mb_mesh (or into split_cb(chunk_index) meshes)."""
    u_lo, u_hi = u_range or (0.0, wall.length)
    us = {u_lo, u_hi}
    vs = {0.0, height}
    for (a, b, c, d) in holes:
        for u in (a, b):
            if u_lo < u < u_hi:
                us.add(u)
        for v in (c, d):
            if 0 < v < height:
                vs.add(v)
    if chunk:
        k = u_lo + chunk
        while k < u_hi - 0.5:
            us.add(k)
            k += chunk
    us = sorted(us)
    vs = sorted(vs)
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            u0, u1, v0, v1 = us[i], us[i + 1], vs[j], vs[j + 1]
            cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
            if any(a <= cu <= b and c <= cv <= d for (a, b, c, d) in holes):
                continue
            target = split_cb(int((cu - u_lo) // chunk)) if (chunk and split_cb) else mb_mesh
            p0 = wall.point(u0, v0, normal_off)
            p1 = wall.point(u1, v0, normal_off)
            p2 = wall.point(u1, v1, normal_off)
            p3 = wall.point(u0, v1, normal_off)
            target.poly([p0, p1, p2, p3], mat, wall.inward)


def floor_with_holes(target_fn, x0, x1, z0, z1, y, holes, mat, up=True, chunk=8.0):
    """A horizontal rectangle at height y facing up (floor) or down (ceiling), skipping holes
    [(x0, x1, z0, z1)], cut into chunk-sized cells; target_fn(ix, iz) returns the MeshBuilder per cell."""
    xs = {x0, x1}
    zs = {z0, z1}
    for (a, b, c, d) in holes:
        for v in (a, b):
            if x0 < v < x1:
                xs.add(v)
        for v in (c, d):
            if z0 < v < z1:
                zs.add(v)
    nx = max(1, math.ceil((x1 - x0) / chunk - 1e-6))
    nz = max(1, math.ceil((z1 - z0) / chunk - 1e-6))
    for k in range(1, nx):
        xs.add(x0 + (x1 - x0) * k / nx)
    for k in range(1, nz):
        zs.add(z0 + (z1 - z0) * k / nz)
    xs = sorted(xs)
    zs = sorted(zs)
    n = (0, 1, 0) if up else (0, -1, 0)
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            a, b, c, d = xs[i], xs[i + 1], zs[j], zs[j + 1]
            cx, cz = (a + b) / 2, (c + d) / 2
            if any(h0 <= cx <= h1 and h2 <= cz <= h3 for (h0, h1, h2, h3) in holes):
                continue
            ix = min(nx - 1, int((cx - x0) / ((x1 - x0) / nx)))
            iz = min(nz - 1, int((cz - z0) / ((z1 - z0) / nz)))
            target_fn(ix, iz).poly([(a, y, c), (b, y, c), (b, y, d), (a, y, d)], mat, n)


def build_stub(mesh, frame, mats, opening=(DOOR["w"], DOOR["h"])):
    """The Z-stub behind a doorway (module-local frame dict): entry face round the opening, walls, floor,
    ceiling, all facing into the passage. mats = dict(floor=, walls=, ceiling=)."""
    c, out, side = frame["centre"], frame["out"], frame["side"]
    H = STUB["height"]
    t = STUB["wall"]
    hw = STUB["width"] / 2

    def P(s, o, y):
        return (c[0] + side[0] * s + out[0] * o, y, c[2] + side[2] * s + out[2] * o)

    poly, rects = stub_outline()
    # floor + ceiling
    for (s0, s1, o0, o1) in rects:
        mesh.poly([P(s0, o0, 0), P(s1, o0, 0), P(s1, o1, 0), P(s0, o1, 0)], mats["floor"], (0, 1, 0))
        mesh.poly([P(s0, o0, H), P(s1, o0, H), P(s1, o1, H), P(s0, o1, H)], mats["ceiling"], (0, -1, 0))
    # walls along the outline (skip the entry edge 0 -> 1), normals toward the passage
    n = len(poly)
    for i in range(1, n):
        a, b = poly[i], poly[(i + 1) % n]
        pa, pb = P(a[0], a[1], 0), P(b[0], b[1], 0)
        mid = ((pa[0] + pb[0]) / 2, 0, (pa[2] + pb[2]) / 2)
        e = sub(pb, pa)
        nrm = norm((e[2], 0, -e[0]))
        # the passage side: test a point a little along the normal against the three floor rects
        probe = add(mid, mul(nrm, 0.05))
        s_p = dot(sub(probe, c), side)
        o_p = dot(sub(probe, c), out)
        if not any(r[0] - 1e-6 <= s_p <= r[1] + 1e-6 and r[2] - 1e-6 <= o_p <= r[3] + 1e-6 for r in rects):
            nrm = mul(nrm, -1)
        mesh.poly([pa, pb, P(b[0], b[1], H), P(a[0], a[1], H)], mats["walls"], nrm)
    # entry face (the wall's back, seen from inside the stub), round the opening
    ow, oh = opening
    into = out  # faces +out (into the stub)
    for (s0, s1, y0, y1) in ((-hw, -ow / 2, 0, oh), (ow / 2, hw, 0, oh), (-hw, hw, oh, H)):
        mesh.poly([P(s0, t, y0), P(s1, t, y0), P(s1, t, y1), P(s0, t, y1)], mats["walls"], into)
    # jambs + head through the wall thickness
    mesh.poly([P(-ow / 2, 0, 0), P(-ow / 2, t, 0), P(-ow / 2, t, oh), P(-ow / 2, 0, oh)], mats["walls"], side)
    mesh.poly([P(ow / 2, 0, 0), P(ow / 2, t, 0), P(ow / 2, t, oh), P(ow / 2, 0, oh)], mats["walls"],
              mul(side, -1))
    mesh.poly([P(-ow / 2, 0, oh), P(ow / 2, 0, oh), P(ow / 2, t, oh), P(-ow / 2, t, oh)], mats["walls"], (0, -1, 0))
    return P


# ── materials ────────────────────────────────────────────────────────────────
def new_material(name):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    return m, nt, b


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def tex_uv(nt, scale=None):
    """The `tex` UV (metres) as a vector socket, optionally scaled per axis."""
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "tex"
    if scale is None:
        return uvn.outputs["UV"]
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(uvn.outputs["UV"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def ramp(nt, fac, stops):
    """stops: [(pos, '#hex'), ...] -> colour socket."""
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], rgba(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], rgba(stops[-1][1])
    for pos, h in stops[1:-1]:
        e = els.new(pos)
        e.color = rgba(h)
    nt.links.new(fac, r.inputs["Fac"])
    return r.outputs["Color"]


def mixrgb(nt, fac, a, b, blend="MIX"):
    m = nt.nodes.new("ShaderNodeMixRGB")
    m.blend_type = blend
    for sock, v in ((m.inputs["Fac"], fac), (m.inputs["Color1"], a), (m.inputs["Color2"], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs["Color"]


def flat(name, hexcol, rough=0.8, emit=None, emit_strength=0.0):
    m, nt, b = new_material(name)
    b.inputs["Base Color"].default_value = rgba(hexcol)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = rgba(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    m["dr_hex"] = hexcol
    return m


def unlit_material(name, image):
    """The export material: emission of the baked atlas for camera rays, transparent otherwise.
    The glTF exporter writes it as KHR_materials_unlit with the atlas as baseColorTexture."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "lightmap"
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = image
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
    m.use_backface_culling = True
    return m


def plain_export_material(name, hexcol):
    """A tiny emissive material for viewer-replaced geometry (spill, underline)."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = rgba(hexcol)
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], outn.inputs["Surface"])
    return m


# ── lights ───────────────────────────────────────────────────────────────────
def area_light(coll, name, pos_v, size, power, hexcol, down=True, visible_glossy=False):
    """A hidden rectangular area light (never visible to the camera or in reflections)."""
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = size
    ld.energy = float(power)
    ld.color = hex_lin(hexcol)
    ob = bpy.data.objects.new(name, ld)
    ob.location = v2b(pos_v)
    if not down:
        ob.rotation_euler = (math.pi, 0, 0)
    ob.visible_glossy = visible_glossy
    ob.visible_transmission = False
    coll.objects.link(ob)
    return ob


def point_light(coll, name, pos_v, power, hexcol, radius=0.25):
    ld = bpy.data.lights.new(name, "POINT")
    ld.energy = float(power)
    ld.color = hex_lin(hexcol)
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = v2b(pos_v)
    ob.visible_glossy = False
    ob.visible_transmission = False
    coll.objects.link(ob)
    return ob


# ── cameras, exposure, stills ────────────────────────────────────────────────
def camera(coll, name, pos_v, yaw, pitch=0.0, fov_v=None):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov_v or WALKER["fov"])
    cd.clip_start = 0.05
    cd.clip_end = 400
    ob = bpy.data.objects.new(name, cd)
    coll.objects.link(ob)
    ob.matrix_world = cam_matrix(viewer_matrix(pos_v, yaw, pitch))
    return ob


def measure_luminance(sc, cam_ob, tmp: Path, res=192, samples=12) -> float:
    """Geometric-mean scene luminance seen by cam_ob at exposure 0 (5-95 % trimmed)."""
    r = sc.render
    saved = (r.resolution_x, r.resolution_y, sc.cycles.samples, sc.cycles.use_denoising, r.image_settings.file_format,
             r.image_settings.color_mode, r.filepath, sc.camera, sc.view_settings.exposure)
    r.resolution_x, r.resolution_y = res, max(8, round(res * saved[1] / max(1, saved[0])))
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    r.image_settings.file_format = "OPEN_EXR"
    r.image_settings.color_mode = "RGB"
    sc.view_settings.exposure = 0.0
    sc.camera = cam_ob
    sync()
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
    (r.resolution_x, r.resolution_y, sc.cycles.samples, sc.cycles.use_denoising, r.image_settings.file_format,
     r.image_settings.color_mode, r.filepath, sc.camera, sc.view_settings.exposure) = saved
    logs = sorted(math.log(max(1e-5, 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]))
                  for i in range(n))
    lo, hi = int(n * 0.05), max(int(n * 0.95), int(n * 0.05) + 1)
    core = logs[lo:hi]
    return math.exp(sum(core) / len(core)) if core else 0.18


def render_still(sc, cam_ob, path: Path, png_copy: Path | None = None, quality=82):
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    sync()
    sc.camera = cam_ob
    r = sc.render
    r.image_settings.file_format = "WEBP"
    r.image_settings.color_mode = "RGB"
    r.image_settings.quality = quality
    r.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if png_copy is not None:
        png_copy = Path(png_copy).resolve()
        png_copy.parent.mkdir(parents=True, exist_ok=True)
        r.image_settings.file_format = "PNG"
        bpy.data.images["Render Result"].save_render(str(png_copy), scene=sc)
    r.image_settings.file_format = "PNG"
    return path


def haze_box(coll, name, lo_v, hi_v, hexcol, density):
    """A volumetric haze box (stills only; volumes don't bake). lo/hi in world viewer coords."""
    me = bpy.data.meshes.new(name)
    bm_ = MeshBuilder(name)
    bm_.box(lo_v, hi_v, None)
    me.from_pydata([v2b(v) for v in bm_.verts], [], bm_.faces)
    m = bpy.data.materials.new(name + "_vol")
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Density"].default_value = density
    pv.inputs["Anisotropy"].default_value = 0.3
    pv.inputs["Color"].default_value = rgba(hexcol)
    nt.links.new(pv.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


# ── UVs + bake ───────────────────────────────────────────────────────────────
def mesh_area(ob):
    return sum(p.area for p in ob.data.polygons)


def _uv_area(uv, p):
    us = [uv[li].uv for li in p.loop_indices]
    a = 0.0
    for k in range(1, len(us) - 1):
        a += abs((us[k].x - us[0].x) * (us[k + 1].y - us[0].y) - (us[k + 1].x - us[0].x) * (us[k].y - us[0].y)) / 2
    return a


def count_islands(ob):
    """UV islands of the lightmap layer (faces joined by an edge whose two loops share UVs)."""
    me = ob.data
    uv = me.uv_layers["lightmap"].data
    parent = list(range(len(me.polygons)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    edge_loops = {}
    for p in me.polygons:
        li = list(p.loop_indices)
        for k, l in enumerate(li):
            a = me.loops[l].vertex_index
            b = me.loops[li[(k + 1) % len(li)]].vertex_index
            key = (min(a, b), max(a, b))
            ua, ub = tuple(uv[l].uv), tuple(uv[li[(k + 1) % len(li)]].uv)
            if a > b:
                ua, ub = ub, ua
            edge_loops.setdefault(key, []).append((p.index, ua, ub))
    for lst in edge_loops.values():
        if len(lst) != 2:
            continue
        (f1, a1, b1), (f2, a2, b2) = lst
        if max(abs(a1[0] - a2[0]), abs(a1[1] - a2[1]), abs(b1[0] - b2[0]), abs(b1[1] - b2[1])) < 1e-6:
            r1, r2 = find(f1), find(f2)
            if r1 != r2:
                parent[r1] = r2
    return len({find(i) for i in range(len(me.polygons))})


def lightmap_uvs(objs, weights, size, margin_px):
    """Smart-project every object into a `lightmap` UV, normalise each to `weight` UV units per metre,
    then pack them all into one square. The margin shrinks when there are many islands (a fixed margin
    per island can't fit thousands of them and the packer collapses). Returns (texels per metre at
    weight 1, margin px used, islands)."""
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    for o in objs:
        uvl = o.data.uv_layers.get("lightmap") or o.data.uv_layers.new(name="lightmap")
        o.data.uv_layers.active = uvl
    select_only(objs)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.reveal()
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    islands = 0
    saved = {}
    for o in objs:
        me = o.data
        uv = me.uv_layers["lightmap"].data
        a3 = sum(p.area for p in me.polygons)
        auv = sum(_uv_area(uv, p) for p in me.polygons)
        islands += count_islands(o)
        if a3 <= 1e-9 or auv <= 1e-12:
            continue
        s = math.sqrt(a3 / auv) * weights.get(o.name, 1.0)
        n = len(uv)
        cx = sum(d.uv.x for d in uv) / n
        cy = sum(d.uv.y for d in uv) / n
        for d in uv:
            d.uv = (cx + (d.uv.x - cx) * s, cy + (d.uv.y - cy) * s)
        saved[o.name] = [tuple(d.uv) for d in uv]
    # pre-fit everything into the unit square (relative sizes kept): the packer is slow from metre scale
    us = [d.uv.x for o in objs for d in o.data.uv_layers["lightmap"].data]
    vs = [d.uv.y for o in objs for d in o.data.uv_layers["lightmap"].data]
    if us:
        u0, v0 = min(us), min(vs)
        ext = max(max(us) - u0, max(vs) - v0, 1e-9)
        for o in objs:
            uv = o.data.uv_layers["lightmap"].data
            for d in uv:
                d.uv = ((d.uv.x - u0) / ext, (d.uv.y - v0) / ext)
            saved[o.name] = [tuple(d.uv) for d in uv]
    # margin: at most ~30 % of the square spent on gutters
    safe = max(1, int(size * math.sqrt(0.3 / max(1, islands)) / 2))
    m = min(margin_px, safe)
    for attempt in range(4):
        select_only(objs)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="AXIS_ALIGNED", scale=True,
                                merge_overlap=False, margin_method="FRACTION", margin=m / size, shape_method="AABB")
        bpy.ops.object.mode_set(mode="OBJECT")
        ok = True
        for o in objs:
            uv = o.data.uv_layers["lightmap"].data
            if any(d.uv.x < -1e-3 or d.uv.x > 1.001 or d.uv.y < -1e-3 or d.uv.y > 1.001 for d in uv) or \
                    sum(_uv_area(uv, p) for p in o.data.polygons) <= 1e-12:
                ok = False
                break
        if ok:
            break
        log("uv pack failed with margin", m, "px; retrying smaller", islands, "islands")
        m = max(0.5, m / 2)
        for o in objs:
            if o.name in saved:
                for d, v in zip(o.data.uv_layers["lightmap"].data, saved[o.name]):
                    d.uv = v
    else:
        raise RuntimeError(f"lightmap packing failed ({islands} islands)")
    a3 = auv = 0.0
    for o in objs:
        w = weights.get(o.name, 1.0)
        uv = o.data.uv_layers["lightmap"].data
        for p in o.data.polygons:
            a3 += p.area * w * w
            auv += _uv_area(uv, p)
    return (size * math.sqrt(auv / a3) if a3 > 0 else 0.0), m, islands


_BAKE_NODES: dict = {}


def bake_node(mat):
    n = _BAKE_NODES.get(mat.name)
    if n is None:
        nt = mat.node_tree
        n = nt.nodes.new("ShaderNodeTexImage")
        n.name = "_dr_bake"
        _BAKE_NODES[mat.name] = n
    for x in mat.node_tree.nodes:
        x.select = False
    n.select = True
    mat.node_tree.nodes.active = n
    return n


def bake(objs, image, margin, clear):
    mats = {s.material for o in objs for s in o.material_slots if s.material}
    for m in mats:
        bake_node(m).image = image
    select_only(objs)
    bpy.ops.object.bake(type="COMBINED",
                        pass_filter={"EMIT", "DIRECT", "INDIRECT", "DIFFUSE", "GLOSSY", "TRANSMISSION"},
                        margin=margin, margin_type="EXTEND", use_clear=clear, uv_layer="lightmap",
                        target="IMAGE_TEXTURES")


def save_display(sc, image, path: Path):
    """Write a float bake through AgX + the scene exposure (display-referred), reload as sRGB."""
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save_render(str(path), scene=sc)
    tex = bpy.data.images.load(str(path), check_existing=False)
    tex.colorspace_settings.name = "sRGB"
    return tex


def keep_only_uv(ob, name="lightmap"):
    me = ob.data
    while len(me.uv_layers) > 1:
        for u in list(me.uv_layers):
            if u.name != name:
                me.uv_layers.remove(u)
                break


def set_extras(ob, **kw):
    for k, v in kw.items():
        ob[k] = v


def pow2ceil(x):
    return 2 ** max(0, math.ceil(math.log2(max(1.0, x))))
