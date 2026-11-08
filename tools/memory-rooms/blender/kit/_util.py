"""Shared geometry helpers for Memory Rooms kit pieces (interior and exterior).

Every helper builds REAL geometry (bevels, rounded cushions, swept profiles) in the piece's LOCAL
space: metres, z up, the piece's front toward -y (see src/memory-rooms/CONTRACTS.md section 5).

Two layers:
  * `add_*(bm, ...)` append geometry to a bmesh you own (cheap; join many parts into one object).
  * `box(ctx, ...)`, `cylinder(ctx, ...)`, `cushion(ctx, ...)`, ... return a finished, linked Object.
    Finish a bmesh yourself with `obj_from_bm(ctx, name, bm, [mat, ...])`.

Shading convention: flat faces stay flat, bevel/round faces are smooth (no auto-smooth needed).
Modifiers used by helpers (subdivision on cushions, solidify on cloth) are APPLIED inside the helper,
so returned objects are plain meshes whose bounds you can trust.

Colour helpers work on sRGB hex strings ('#rrggbb'), the scene.json format.

Quick reference
    P(spec), dims(spec)                         params dict, (w, h, d) floats
    mat_main / mat_accent                       material with a piece default
    add_box(bm, lo, hi, bevel, segments)        bevelled cuboid between two corners
    add_cylinder(bm, (x, y), r, z0, z1, ...)    (elliptical / tapered) cylinder, bevelled caps
    add_lathe(bm, [(r, z), ...], ...)           revolve a profile about z (pots, lamp bases, shades)
    add_sweep(bm, path, profile, ...)           sweep a 2-D profile along a 3-D path (mitred corners)
    add_tube(bm, path, radius, ...)             round sweep (rails, rods, wire, cords)
    add_leg(bm, (x, y), z0, z1, top, bottom)    tapered square or round leg, optional lean
    add_planks(bm, lo, hi, n, axis, gap)        plank array with tiny deterministic jitter
    add_leaf(bm, base, direction, ...)          a curved leaf blade (plants, trees)
    fillet(points, radius)                      round the corners of a polyline
    cushion(ctx, name, lo, hi, mat, ...)        subdivided rounded box with a soft pillowed face
    text_object(ctx, name, text, ...)           Blender text converted to a mesh
    cloth_sim(ob, frames, colliders, pin_group) short cloth simulation, result applied (with timeout)
    apply_modifiers(ob), join(ctx, objs, name), solidify(ob, t), subsurf(ob, levels)
    bounds(objs)                                world-space AABB of evaluated meshes
"""

from __future__ import annotations

import colorsys
import math
import time

import bmesh
import bpy
from mathutils import Matrix, Vector

FABRICS = {"linen", "wool", "velvet", "leather"}
WOODS = {"oak", "pine", "walnut"}
METALS = {"metal", "chrome", "brass"}


# ── spec helpers ──────────────────────────────────────────────────────────────

def P(spec) -> dict:
    """The spec's params dict (never None)."""
    return spec.get("params") or {}


def dims(spec):
    w, h, d = (float(v) for v in spec["size"])
    return w, h, d


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def mat_main(ctx, spec, default_name, default_color=None, **opts):
    """Main material: spec.material/color, else the piece's default."""
    return ctx.materials.get(spec.get("material") or default_name, spec.get("color") or default_color, **opts)


def mat_accent(ctx, spec, default_name, default_color=None, **opts):
    """Accent material: spec.accentMaterial/accent, else the piece's default (NOT the main material)."""
    return ctx.materials.get(spec.get("accentMaterial") or default_name, spec.get("accent") or default_color, **opts)


def main_name(spec, default):
    return spec.get("material") or default


def accent_name(spec, default):
    return spec.get("accentMaterial") or default


def with_grain(ctx, mat, axis="z"):
    """The same material with its wood grain turned to `axis` (legs, posts, stiles). Non-wood: unchanged."""
    name = mat.get("mr_material") if mat is not None else None
    if name not in WOODS:
        return mat
    return ctx.materials.get(name, mat.get("mr_color"), grain=axis)


def legs_mat(ctx, spec, main, default=None):
    """Legs/posts: the accent material when the spec gives one, else the main wood turned vertical."""
    if spec.get("accentMaterial") or spec.get("accent"):
        m = mat_accent(ctx, spec, default or main.get("mr_material") or "oak")
        return with_grain(ctx, m, "z")
    if default:
        return ctx.materials.get(default)
    return with_grain(ctx, main, "z")


# ── colours (sRGB hex) ────────────────────────────────────────────────────────

def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _hex(rgb):
    return "#%02x%02x%02x" % tuple(round(clamp(c, 0.0, 1.0) * 255) for c in rgb)


def shade(h, value=1.0, sat=1.0, hue=0.0):
    """Multiply a colour's HSV value / saturation, shift its hue."""
    hh, s, v = colorsys.rgb_to_hsv(*_rgb(h))
    return _hex(colorsys.hsv_to_rgb((hh + hue) % 1.0, clamp(s * sat, 0, 1), clamp(v * value, 0, 1)))


def mix_hex(a, b, t):
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(x + (y - x) * t for x, y in zip(ra, rb)))


def luminance(h):
    r, g, b = _rgb(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ── objects ───────────────────────────────────────────────────────────────────

def obj_from_bm(ctx, name, bm, mats=(), smooth=None):
    """Write a bmesh into a new linked mesh object (frees the bmesh). smooth=True/False forces shading."""
    me = bpy.data.meshes.new(name)
    if smooth is not None:
        for f in bm.faces:
            f.smooth = smooth
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ctx.link(ob)
    return ob


def merge_bm(dst, src):
    """Append every vert/face of bmesh `src` to `dst` (keeps smooth flags, material indices and
    sharp edges), then free `src`. Build a part in its own bmesh, transform it, merge it."""
    src.verts.index_update()
    newv = [dst.verts.new(v.co) for v in src.verts]
    out = []
    for f in src.faces:
        try:
            nf = dst.faces.new([newv[v.index] for v in f.verts])
        except ValueError:
            continue
        nf.smooth = f.smooth
        nf.material_index = f.material_index
        out.append(nf)
    for e in src.edges:
        if not e.smooth:
            de = dst.edges.get((newv[e.verts[0].index], newv[e.verts[1].index]))
            if de:
                de.smooth = False
    src.free()
    return newv, out


def add_box(bm, lo, hi, bevel=0.0, segments=2, mat=0, profile=0.5):
    """Cuboid between corners lo and hi, optional real bevel (flat faces flat, bevel faces smooth)."""
    lo, hi = Vector(lo), Vector(hi)
    size = hi - lo
    size = Vector((max(size.x, 1e-5), max(size.y, 1e-5), max(size.z, 1e-5)))
    c = (lo + hi) / 2
    m = Matrix.Translation(c) @ Matrix.Diagonal((size.x, size.y, size.z, 1.0))
    verts = bmesh.ops.create_cube(bm, size=1.0, matrix=m)["verts"]
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.material_index = mat
        f.smooth = False
    r = min(bevel, 0.49 * min(size))
    if r > 1e-5:
        edges = list({e for v in verts for e in v.link_edges})
        out = bmesh.ops.bevel(bm, geom=edges + list(verts), offset=r, offset_type="OFFSET", segments=segments,
                              profile=profile, affect="EDGES", clamp_overlap=True)
        for f in out["faces"]:
            f.smooth = True
            f.material_index = mat
    return verts


def box(ctx, name, lo, hi, mat, bevel=0.005, segments=2):
    bm = bmesh.new()
    add_box(bm, lo, hi, bevel, segments)
    return obj_from_bm(ctx, name, bm, [mat])


def add_cylinder(bm, center, r, z0, z1, segments=32, bevel=0.0, bevel_segments=2, r_top=None, ry=None, mat=0,
                 cap_top=True, cap_bottom=True, matrix=None):
    """Upright cylinder / cone frustum at center (x, y) from z0 to z1. ry != r makes it elliptical.
    Caps are flat, the side is smooth, cap rims get a real bevel. `matrix` transforms the part."""
    r_top = r if r_top is None else r_top
    ry = r if ry is None else ry
    prof = []
    if cap_bottom:
        prof.append((0.0, z0))
    prof += [(r, z0), (r_top, z1)]
    if cap_top:
        prof.append((0.0, z1))
    t = bmesh.new()
    add_lathe(t, prof, segments=segments, center=(center[0], center[1], 0.0), mat=mat,
              scale_y=ry / r if r else 1.0)
    t.normal_update()
    for f in t.faces:
        f.smooth = abs(f.normal.z) < 0.5
    if bevel > 1e-5:
        rim = set()
        for f in t.faces:
            if abs(f.normal.z) < 0.5:
                for e in f.edges:
                    if len(e.link_faces) == 2 and any(abs(g.normal.z) >= 0.5 for g in e.link_faces):
                        rim.add(e)
        if rim:
            off = min(bevel, 0.45 * abs(z1 - z0), 0.45 * min(r, r_top or r))
            out = bmesh.ops.bevel(t, geom=list(rim), offset=off, segments=bevel_segments, profile=0.5,
                                  affect="EDGES", clamp_overlap=True)
            for f in out["faces"]:
                f.smooth = True
                f.material_index = mat
    if matrix is not None:
        bmesh.ops.transform(t, matrix=matrix, verts=t.verts[:])
    return merge_bm(bm, t)


def cylinder(ctx, name, center, r, z0, z1, mat, segments=32, bevel=0.003, r_top=None, ry=None):
    bm = bmesh.new()
    add_cylinder(bm, center, r, z0, z1, segments, bevel, r_top=r_top, ry=ry)
    return obj_from_bm(ctx, name, bm, [mat])


def add_lathe(bm, profile, segments=32, center=(0.0, 0.0, 0.0), mat=0, smooth=True, sharp_rows=(),
              scale_y=1.0, angle=(0.0, 2 * math.pi)):
    """Revolve [(r, z), ...] (bottom to top) about the vertical axis through `center`.
    r == 0 points become poles (closed ends). Rows listed in sharp_rows get sharp edges."""
    cx, cy, cz = center
    a0, a1 = angle
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    n = segments
    cols = n if full else n + 1
    rings = []
    for (r, z) in profile:
        if r <= 1e-7:
            rings.append([bm.verts.new((cx, cy, cz + z))])
        else:
            ring = []
            for i in range(cols):
                a = a0 + (a1 - a0) * i / n
                ring.append(bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a) * scale_y, cz + z)))
            rings.append(ring)
    sharp = set(sharp_rows)
    faces = []
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % cols if full else i + 1
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                vs = (A[0], B[j], B[i])
            elif len(B) == 1:
                vs = (A[i], A[j], B[0])
            else:
                vs = (A[i], A[j], B[j], B[i])
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.material_index = mat
            f.smooth = smooth
            faces.append(f)
    if sharp:
        for k in sharp:
            if 0 <= k < len(rings) and len(rings[k]) > 1:
                ring = rings[k]
                for i in range(n):
                    j = (i + 1) % cols if full else i + 1
                    e = bm.edges.get((ring[i], ring[j]))
                    if e:
                        e.smooth = False
    return faces


def lathe(ctx, name, profile, mat, segments=32, center=(0.0, 0.0, 0.0), sharp_rows=(), smooth=True):
    bm = bmesh.new()
    add_lathe(bm, profile, segments, center, sharp_rows=sharp_rows, smooth=smooth)
    return obj_from_bm(ctx, name, bm, [mat])


def circle_profile(r, n=12, ry=None):
    ry = r if ry is None else ry
    return [(r * math.cos(2 * math.pi * i / n), ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rounded_rect_profile(w, h, r, steps=3):
    """Closed CCW profile of a w x h rectangle with corner radius r, centred on (0, 0)."""
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0.0), (-w / 2 + r, h / 2 - r, 90.0),
                       (-w / 2 + r, -h / 2 + r, 180.0), (w / 2 - r, -h / 2 + r, 270.0)):
        for s in range(steps + 1):
            a = math.radians(a0 + 90.0 * s / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def fillet(points, radius, steps=4, closed=False):
    """Round each interior corner of a polyline with a quadratic arc of ~radius."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    if n < 3 or radius <= 0:
        return pts
    out = []
    idx = range(n) if closed else range(1, n - 1)
    if not closed:
        out.append(pts[0])
    for i in idx:
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        a, b = (p0 - p1), (p2 - p1)
        la, lb = a.length, b.length
        if la < 1e-6 or lb < 1e-6:
            out.append(p1)
            continue
        ang = a.angle(b, math.pi)
        if ang > math.pi - 1e-3:
            out.append(p1)
            continue
        d = min(radius / max(math.tan(ang / 2), 1e-4), la * 0.49, lb * 0.49)
        s, e = p1 + a.normalized() * d, p1 + b.normalized() * d
        for k in range(steps + 1):
            t = k / steps
            out.append((1 - t) ** 2 * s + 2 * (1 - t) * t * p1 + t * t * e)
    if not closed:
        out.append(pts[-1])
    return out


def _frames(path, closed, up):
    """Rotation-minimising frames (tangent, normal, binormal) along a polyline."""
    n = len(path)
    tangents = []
    for i in range(n):
        if closed:
            a = (path[i] - path[i - 1]).normalized()
            b = (path[(i + 1) % n] - path[i]).normalized()
        else:
            a = (path[i] - path[i - 1]).normalized() if i > 0 else (path[1] - path[0]).normalized()
            b = (path[i + 1] - path[i]).normalized() if i < n - 1 else a
        t = a + b
        tangents.append((t.normalized() if t.length > 1e-6 else b, a, b))
    up = Vector(up)
    t0 = tangents[0][0]
    nrm = up - up.dot(t0) * t0
    if nrm.length < 1e-6:
        alt = Vector((0, 1, 0)) if abs(t0.y) < 0.9 else Vector((1, 0, 0))
        nrm = alt - alt.dot(t0) * t0
    nrm.normalize()
    frames = []
    prev_t = t0
    for (t, a, b) in tangents:
        rot = prev_t.rotation_difference(t)
        nrm = rot @ nrm
        nrm = (nrm - nrm.dot(t) * t).normalized()
        frames.append((t, nrm, t.cross(nrm), a, b))
        prev_t = t
    return frames


def add_sweep(bm, path, profile, closed=False, caps=True, up=(0, 0, 1), mat=0, smooth=True, scales=None,
              sharp_cols=(), miter=True):
    """Sweep a closed 2-D profile [(u, v), ...] along a 3-D path.
    u runs along the frame's binormal (t x n), v along the normal (initialised from `up`).
    `scales` = optional per-path-point profile scale. Corners are mitred so mouldings stay square."""
    path = [Vector(p) for p in path]
    n_p = len(profile)
    area = sum(profile[i][0] * profile[(i + 1) % n_p][1] - profile[(i + 1) % n_p][0] * profile[i][1]
               for i in range(n_p))
    if area < 0:
        profile = list(reversed(profile))
    frames = _frames(path, closed, up)
    m = len(profile)
    rings = []
    for i, (p, (t, nrm, bn, a, b)) in enumerate(zip(path, frames)):
        s = scales[i] if scales else 1.0
        k = None
        inv = 1.0
        if miter and ((closed) or (0 < i < len(path) - 1)):
            cosh = a.dot(t)
            if cosh > 0.2 and (a - b).length > 1e-6:
                k = (a - b)
                k = (k - k.dot(t) * t)
                if k.length > 1e-6:
                    k.normalize()
                    inv = 1.0 / cosh
                else:
                    k = None
        ring = []
        for (u, v) in profile:
            o = bn * (u * s) + nrm * (v * s)
            if k is not None:
                c = o.dot(k)
                o = o + k * c * (inv - 1.0)
            ring.append(bm.verts.new(p + o))
        rings.append(ring)
    faces = []
    count = len(rings) if closed else len(rings) - 1
    sharp = set(sharp_cols)
    for i in range(count):
        A, B = rings[i], rings[(i + 1) % len(rings)]
        for j in range(m):
            jj = (j + 1) % m
            try:
                f = bm.faces.new((A[j], B[j], B[jj], A[jj]))
            except ValueError:
                continue
            f.material_index = mat
            f.smooth = smooth
            faces.append(f)
    if sharp:
        for i in range(len(rings) - (0 if closed else 1)):
            A, B = rings[i], rings[(i + 1) % len(rings)]
            for j in sharp:
                e = bm.edges.get((A[j % m], B[j % m]))
                if e:
                    e.smooth = False
    if caps and not closed:
        for ring, flip in ((rings[0], False), (rings[-1], True)):
            try:
                f = bm.faces.new(list(reversed(ring)) if flip else ring)
                f.material_index = mat
                f.smooth = False
                faces.append(f)
            except ValueError:
                pass
    return faces


def sweep(ctx, name, path, profile, mat, closed=False, caps=True, up=(0, 0, 1), smooth=True):
    bm = bmesh.new()
    add_sweep(bm, path, profile, closed, caps, up, smooth=smooth)
    return obj_from_bm(ctx, name, bm, [mat])


def add_tube(bm, path, radius, segments=12, closed=False, caps=True, mat=0, up=(0, 0, 1), fillet_r=0.0):
    pts = fillet(path, fillet_r, closed=closed) if fillet_r > 0 else path
    return add_sweep(bm, pts, circle_profile(radius, segments), closed=closed, caps=caps, up=up, mat=mat,
                     miter=False)


def tube(ctx, name, path, radius, mat, segments=12, closed=False, fillet_r=0.0):
    bm = bmesh.new()
    add_tube(bm, path, radius, segments, closed, fillet_r=fillet_r)
    return obj_from_bm(ctx, name, bm, [mat])


def add_torus(bm, center, R, r, segments=32, ring_segments=10, mat=0):
    """Horizontal ring (footrests, curtain rings) of major radius R, tube radius r."""
    cx, cy, cz = center
    path = [(cx + R * math.cos(2 * math.pi * i / segments), cy + R * math.sin(2 * math.pi * i / segments), cz)
            for i in range(segments)]
    return add_sweep(bm, path, circle_profile(r, ring_segments), closed=True, mat=mat, miter=False)


def add_leg(bm, xy, z0, z1, top=0.045, bottom=0.032, shape="square", lean=(0.0, 0.0), bevel=0.004, mat=0,
            segments=16):
    """A tapered leg: `top` / `bottom` = width (square) or diameter (round) at z1 / z0.
    lean = (dx, dy) offset of the FOOT relative to the top (splayed legs)."""
    x, y = xy
    h = z1 - z0
    t = bmesh.new()
    if shape == "round":
        add_cylinder(t, (0.0, 0.0), bottom / 2, 0.0, h, segments=segments, bevel=bevel * 0.6, r_top=top / 2, mat=mat)
    else:
        verts = add_box(t, (-0.5, -0.5, 0.0), (0.5, 0.5, 1.0), 0.0, mat=mat)
        for v in verts:
            s = top if v.co.z > 0.5 else bottom
            v.co.x *= s
            v.co.y *= s
            v.co.z *= h
        if bevel > 0:
            edges = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
            out = bmesh.ops.bevel(t, geom=edges, offset=min(bevel, bottom * 0.3), segments=2, profile=0.5,
                                  affect="EDGES", clamp_overlap=True)
            for f in out["faces"]:
                f.smooth = True
                f.material_index = mat
    for v in t.verts:
        k = 1.0 - v.co.z / h if h > 0 else 0.0  # 1 at the foot
        v.co.x += x + lean[0] * k
        v.co.y += y + lean[1] * k
        v.co.z += z0
    return merge_bm(bm, t)


def add_planks(bm, lo, hi, n, axis="x", gap=0.004, bevel=0.002, jitter=0.0, rng=None, mat=0):
    """n planks filling the box lo..hi, laid side by side along `axis` with `gap` between them.
    jitter (metres) nudges each plank's thickness so a run never looks machine-perfect."""
    lo, hi = Vector(lo), Vector(hi)
    ai = "xyz".index(axis)
    span = hi[ai] - lo[ai]
    pw = (span - gap * (n - 1)) / n
    for i in range(n):
        a = lo.copy()
        b = hi.copy()
        a[ai] = lo[ai] + i * (pw + gap)
        b[ai] = a[ai] + pw
        if jitter and rng is not None:
            b.z -= rng.uniform(0.0, jitter)
        add_box(bm, a, b, bevel, 2, mat)


def add_leaf(bm, base, direction, length, width, up=(0, 0, 1), fold=0.25, droop=0.25, twist=0.0, segs=(7, 2),
             tip=0.85, mat=0):
    """A single leaf blade starting at `base`, pointing along `direction`.
    fold = V-fold across the midrib (fraction of width), droop = tip drop (fraction of length),
    tip = shape exponent (<1 = widest near the base, >1 = widest near the tip). Single-sided."""
    base, dvec = Vector(base), Vector(direction).normalized()
    upv = Vector(up).normalized()
    side = dvec.cross(upv)
    if side.length < 1e-5:
        side = dvec.cross(Vector((0, 1, 0)))
    side.normalize()
    nrm = side.cross(dvec).normalized()
    nu, nv = segs
    rows = []
    for i in range(nu):
        u = i / nu
        wu = width * 0.5 * (math.sin(math.pi * (u ** tip)) ** 0.8) + width * 0.03
        ang = twist * u
        s_rot = side * math.cos(ang) + nrm * math.sin(ang)
        n_rot = nrm * math.cos(ang) - side * math.sin(ang)
        row = []
        for j in range(-nv, nv + 1):
            v = j / nv
            pos = (base + dvec * (u * length) + s_rot * (v * wu) + n_rot * (abs(v) * wu * fold)
                   - upv * (droop * length * u * u))
            row.append(bm.verts.new(pos))
        rows.append(row)
    tip_v = bm.verts.new(base + dvec * length - upv * (droop * length))
    faces = []
    for i in range(nu):
        for j in range(2 * nv):
            if i == nu - 1:
                vs = (rows[i][j], rows[i][j + 1], tip_v)
            else:
                vs = (rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j])
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.smooth = True
            f.material_index = mat
            faces.append(f)
    return faces


# ── casework (drawer / door fronts, handles) ──────────────────────────────────

def add_front(bm, x0, x1, z0, z1, y0, y1, style="flat", bevel=0.003, mat=0):
    """A drawer or door front filling x0..x1, z0..z1 with its face at y0 (the -y side) and back at y1.
    style 'flat' = one bevelled slab; 'shaker' = frame (stiles + rails) around a recessed panel."""
    fw, fh = x1 - x0, z1 - z0
    if style != "shaker" or fw < 0.22 or fh < 0.22:
        add_box(bm, (x0, y0, z0), (x1, y1, z1), bevel, 2, mat)
        return
    rw = min(0.065, 0.2 * min(fw, fh))
    add_box(bm, (x0, y0, z0), (x0 + rw, y1, z1), bevel, 2, mat)
    add_box(bm, (x1 - rw, y0, z0), (x1, y1, z1), bevel, 2, mat)
    add_box(bm, (x0 + rw - 0.001, y0, z1 - rw), (x1 - rw + 0.001, y1, z1), bevel, 2, mat)
    add_box(bm, (x0 + rw - 0.001, y0, z0), (x1 - rw + 0.001, y1, z0 + rw), bevel, 2, mat)
    add_box(bm, (x0 + rw - 0.002, y0 + (y1 - y0) * 0.45, z0 + rw - 0.002), (x1 - rw + 0.002, y1, z1 - rw + 0.002),
            bevel * 0.5, 2, mat)


def add_handle(bm, kind, center, length=0.12, vertical=False, proj=0.024, radius=0.0055, mat=0):
    """A pull on a front whose face is the plane y = center[1]; it projects toward -y by `proj`.
    kind: 'bar' (rounded D-pull of `length`), 'knob', 'none'."""
    x, yf, z = center
    if kind in (None, "none", False):
        return
    if kind == "knob":
        prof = [(0.0, -0.002), (0.0065, -0.002), (0.0055, proj * 0.45), (0.012, proj * 0.75), (0.0135, proj * 0.92),
                (0.011, proj), (0.0, proj)]
        t = bmesh.new()
        add_lathe(t, prof, segments=16, mat=mat)
        bmesh.ops.transform(t, matrix=Matrix.Translation((x, yf, z)) @ Matrix.Rotation(math.radians(90), 4, "X"),
                            verts=t.verts[:])
        merge_bm(bm, t)
        return
    half = length / 2
    yb = yf + 0.002
    if vertical:
        pts = [(x, yb, z - half), (x, yf - proj, z - half), (x, yf - proj, z + half), (x, yb, z + half)]
    else:
        pts = [(x - half, yb, z), (x - half, yf - proj, z), (x + half, yf - proj, z), (x + half, yb, z)]
    add_tube(bm, pts, radius, segments=10, fillet_r=proj * 0.55, mat=mat)


# ── modifiers / mesh ops ──────────────────────────────────────────────────────

def apply_modifiers(ob):
    """Bake the object's modifier stack into its mesh (no bpy.ops, works headless)."""
    if not ob.modifiers:
        return ob
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = old.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def subsurf(ob, levels=2, apply=True):
    mod = ob.modifiers.new("subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    mod.quality = 3
    return apply_modifiers(ob) if apply else ob


def solidify(ob, thickness, offset=1.0, apply=True, even=False):
    """Give a sheet real thickness. even=False + clamp keep folded cloth from spiking."""
    mod = ob.modifiers.new("solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = even
    mod.use_quality_normals = True
    mod.thickness_clamp = 1.0
    return apply_modifiers(ob) if apply else ob


def set_smooth(ob, smooth=True):
    ob.data.polygons.foreach_set("use_smooth", [smooth] * len(ob.data.polygons))
    ob.data.update()
    return ob


def join(ctx, objs, name):
    """Merge mesh objects (modifiers applied, transforms baked, materials remapped) into one object.
    The inputs are removed."""
    objs = [o for o in objs if o is not None and o.type == "MESH"]
    if not objs:
        return None
    mats = []
    bm = bmesh.new()
    for ob in objs:
        apply_modifiers(ob)
        me = ob.data.copy()
        me.transform(ob.matrix_basis)
        if ob.matrix_basis.determinant() < 0:
            me.flip_normals()
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        if remap:
            idx = [0] * len(me.polygons)
            me.polygons.foreach_get("material_index", idx)
            me.polygons.foreach_set("material_index", [remap[i] if i < len(remap) else 0 for i in idx])
        t = bmesh.new()
        t.from_mesh(me)
        merge_bm(bm, t)
        bpy.data.meshes.remove(me)
    for ob in objs:
        data = ob.data
        bpy.data.objects.remove(ob)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    return obj_from_bm(ctx, name, bm, mats)


def transform_bm_verts(verts, matrix):
    for v in verts:
        v.co = matrix @ v.co


# ── cushions ──────────────────────────────────────────────────────────────────

def _cushion_bm(lo, hi, radius, pillow, pillow_bottom, bulge, cell):
    """Cage for a soft rounded box (support loops at `radius` from every edge), pillow displaced."""
    lo, hi = Vector(lo), Vector(hi)
    size = hi - lo
    r = min(radius, 0.45 * min(size))
    bm = bmesh.new()
    m = Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((size.x, size.y, size.z, 1.0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    cuts = []
    for ai, axis in enumerate("xyz"):
        a, b = lo[ai], hi[ai]
        pos = [a + r, b - r]
        inner = b - a - 2 * r
        if axis != "z" or (pillow > 0 or pillow_bottom > 0 or bulge > 0):
            k = min(5, max(0, int(round(inner / cell)) - 1))
            pos += [a + r + inner * (i + 1) / (k + 1) for i in range(k)]
        for p in pos:
            no = Vector((0, 0, 0))
            no[ai] = 1.0
            co = Vector((0, 0, 0))
            co[ai] = p
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=co, plane_no=no)
    c = (lo + hi) / 2
    hx, hy, hz = size.x / 2, size.y / 2, size.z / 2

    def fall(t):
        t = min(1.0, abs(t))
        return max(0.0, 1.0 - t ** 2.6)

    for v in bm.verts:
        u = (v.co.x - c.x) / hx
        w = (v.co.y - c.y) / hy
        s = (v.co.z - c.z) / hz
        f = fall(u) * fall(w)
        if s > 0.999 and pillow:
            v.co.z += pillow * f
        elif s < -0.999 and pillow_bottom:
            v.co.z -= pillow_bottom * f
        if bulge and abs(s) < 0.999:
            g = max(0.0, 1.0 - s * s)
            if abs(u) > 0.999:
                v.co.x += math.copysign(bulge * g * fall(w), u)
            if abs(w) > 0.999:
                v.co.y += math.copysign(bulge * g * fall(u), w)
    for f in bm.faces:
        f.smooth = True
    return bm


def cushion(ctx, name, lo, hi, mat, radius=0.04, pillow=0.015, pillow_bottom=0.0, bulge=0.0, levels=2,
            up="z", cell=0.2):
    """Soft upholstered block inside lo..hi: rounded edges (~radius), a pillowed `up` face
    ('z' = top, '-y' = front, '+y' = back) and optional side bulge. Subdivided and applied.
    The pillow is taken out of the box height, so the result stays inside lo..hi."""
    lo, hi = Vector(lo), Vector(hi)
    if up == "z":
        clo, chi = lo.copy(), hi.copy()
        chi.z -= pillow * 0.8
        clo.z += pillow_bottom * 0.8
        rot = None
    else:
        # build with the pillow on +z, then rotate +z onto -y (front) or +y (back)
        sgn = -1.0 if up == "-y" else 1.0
        if sgn < 0:   # +90 about x: (x, y, z) -> (x, -z, y)
            clo = Vector((lo.x, lo.z, -hi.y))
            chi = Vector((hi.x, hi.z, -lo.y))
        else:         # -90 about x: (x, y, z) -> (x, z, -y)
            clo = Vector((lo.x, -hi.z, lo.y))
            chi = Vector((hi.x, -lo.z, hi.y))
        chi.z -= pillow * 0.8
        clo.z += pillow_bottom * 0.8
        rot = Matrix.Rotation(math.radians(90.0 if sgn < 0 else -90.0), 4, "X")
    bm = _cushion_bm(clo, chi, radius, pillow, pillow_bottom, bulge, cell)
    if rot is not None:
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts[:])
    ob = obj_from_bm(ctx, name, bm, [mat])
    subsurf(ob, levels)
    return ob


# ── text ──────────────────────────────────────────────────────────────────────

def text_object(ctx, name, text, size=1.0, extrude=0.0, bevel=0.0, fill=True, align="CENTER", resolution=4,
                font=None):
    """Blender text (built-in font unless `font` is a loaded VectorFont) converted to a mesh object.
    The text lies in the XY plane facing +z, centred on the origin."""
    cu = bpy.data.curves.new(name + "_txt", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    cu.resolution_u = resolution
    if font is not None:
        cu.font = font
    if not fill:
        cu.fill_mode = "NONE"
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    ctx.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    ctx.link(ob)
    return ob


# ── cloth ─────────────────────────────────────────────────────────────────────

def cloth_sim(ob, frames=30, colliders=(), pin_group=None, quality=5, mass=0.3, tension=15.0, shear=5.0,
              bending=0.5, air=1.0, distance=0.006, friction=5.0, time_budget=3.0, check=None):
    """Run a short cloth simulation on `ob` and apply the final frame as its mesh.
    colliders get a temporary COLLISION modifier; pin_group names a vertex group of pinned verts.
    Steps frames with scene.frame_set (works headless). Stops early past `time_budget` seconds.
    `check(mesh) -> bool` can reject the result (e.g. exploded verts). Returns True if applied;
    on any failure the original mesh is kept and False is returned (callers fall back)."""
    scene = bpy.context.scene
    old_frame = scene.frame_current
    added = []
    mod = None
    ok = False
    t0 = time.perf_counter()
    try:
        for c in colliders:
            cm = c.modifiers.new("mr_collision", "COLLISION")
            added.append((c, cm))
            c.collision.thickness_outer = 0.004
            c.collision.thickness_inner = 0.02
            c.collision.cloth_friction = friction
            c.collision.damping = 0.5
        mod = ob.modifiers.new("mr_cloth", "CLOTH")
        s = mod.settings
        s.quality = quality
        s.mass = mass
        s.air_damping = air
        s.tension_stiffness = tension
        s.compression_stiffness = tension
        s.shear_stiffness = shear
        s.bending_stiffness = bending
        s.bending_damping = 0.5
        if pin_group:
            s.vertex_group_mass = pin_group
            s.pin_stiffness = 1.0
        cs = mod.collision_settings
        cs.use_collision = bool(colliders)
        cs.distance_min = distance
        cs.collision_quality = 3
        cs.use_self_collision = False
        mod.point_cache.frame_start = 1
        mod.point_cache.frame_end = max(2, frames)
        for f in range(1, frames + 1):
            scene.frame_set(f)
            if time.perf_counter() - t0 > time_budget:
                print(f"[kit] cloth sim on {ob.name} stopped at frame {f} (time budget)")
                break
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
        good = all(math.isfinite(c) for v in me.vertices for c in v.co)
        if good and check is not None:
            good = bool(check(me))
        if good:
            ob.modifiers.remove(mod)
            mod = None
            old = ob.data
            ob.data = me
            if old.users == 0:
                bpy.data.meshes.remove(old)
            ok = True
        else:
            bpy.data.meshes.remove(me)
    except Exception as e:  # never let a sim take the build down
        print(f"[kit] cloth sim on {ob.name} failed: {e}")
        ok = False
    finally:
        if mod is not None:
            try:
                ob.modifiers.remove(mod)
            except Exception:
                pass
        for c, cm in added:
            try:
                c.modifiers.remove(cm)
            except Exception:
                pass
        scene.frame_set(old_frame)
    return ok


# ── measuring ─────────────────────────────────────────────────────────────────

def bounds(objs):
    """World-space (min, max) Vectors of the evaluated meshes of objs (and their children)."""
    import numpy as np

    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    lo = np.full(3, np.inf)
    hi = np.full(3, -np.inf)
    seen = set()
    stack = list(objs)
    while stack:
        ob = stack.pop()
        if ob.name in seen:
            continue
        seen.add(ob.name)
        stack.extend(ob.children)
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        n = len(me.vertices)
        if n:
            co = np.empty(n * 3, dtype=np.float64)
            me.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            mw = np.array(ev.matrix_world)
            w = co @ mw[:3, :3].T + mw[:3, 3]
            lo = np.minimum(lo, w.min(axis=0))
            hi = np.maximum(hi, w.max(axis=0))
        ev.to_mesh_clear()
    return Vector(lo.tolist()), Vector(hi.tolist())


def tri_count(objs):
    """Triangles of the evaluated meshes of objs (and children)."""
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    seen = set()
    stack = list(objs)
    while stack:
        ob = stack.pop()
        if ob.name in seen:
            continue
        seen.add(ob.name)
        stack.extend(ob.children)
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        ev.to_mesh_clear()
    return n
