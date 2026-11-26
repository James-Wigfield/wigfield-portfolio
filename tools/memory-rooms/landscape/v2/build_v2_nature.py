"""Blender (imported by build_v2.py): the limestone of a v2 landscape and the lookouts.

  build_cliffs(coast, H, coll)          site__cliffs__limestone: a cliff face along every rocky coast run
                                        (coast.json), from just inland of the lip down past the waterline, with
                                        the wave-cut notch at sea level, a flared foot, cross-bedded strata and
                                        honeycomb lumps (Tamala limestone, photos)
  rock_protos(coll)                     proto__rock<a-d>__0 / __1: boulders for instancing (scatter.py types 6-9)
  build_mushroom(site, coll)            Mushroom Rock: an undercut stack on the reef
  build_lookout_walkway(site, H, coll)  Cape Peron lookout: octagonal pad, plinth, railings, boards, cantilevered
                                        walkway on stays from two masts with a crossbar
  build_lookout_pad(site, H, coll)      John Point lookout: a platform, a curved railing, a bench

Blender coords: x east, y north, z up (world z south = -y). Vertex colour R = AO (build_v2.bake_ao), G = 0.
"""
import math

import bmesh
import bpy
from mathutils import Vector, noise


def _n3(x, y, z, scale=1.0, octaves=3):
    return noise.fractal(Vector((x * scale, y * scale, z * scale)), 0.5, 2.0, octaves)


def strata(z, x, y):
    """cross-bedded aeolianite: thin beds that lean a little, plus honeycomb lumps"""
    bed = math.sin(z * 7.5 + 1.7 * _n3(x, y, z, 0.15, 2)) * 0.06
    lumps = _n3(x, y, z, 0.9, 3) * 0.22 + _n3(x, y, z, 3.0, 2) * 0.06
    return bed + lumps


def _mesh_obj(name, bm, coll):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def build_cliffs(coast, H, coll):
    """a strip mesh per rocky run: rows = a profile (offset toward the sea, height), columns = the coast points"""
    bm = bmesh.new()
    for run in coast['runs']:
        if not run['rocky'] or len(run['pts']) < 4:
            continue
        pts = run['pts']
        sea = run['sea']
        top = run['top']
        n = len(pts)
        cols = []
        cave_at = set()
        for i in range(n):
            # an occasional sea cave: a deeper notch over a few metres where the cliff is tall enough
            if top[i] > 3.5 and _n3(pts[i][0] * 0.07, pts[i][1] * 0.07, 3.3, 1.0, 2) > 0.32:
                cave_at.add(i)
        for i in range(n):
            x, z = pts[i]
            sx, sz = sea[i]
            # the lip isn't a straight line: notched and slumped along the run
            t = max(0.4, top[i] + 0.9 * _n3(x * 0.18, z * 0.18, 1.7, 1.0, 3) - 0.3)
            # taper the run's ends into the ground
            end = min(1.0, min(i, n - 1 - i) / 3.0)
            notch = min(1.0, t / 2.5) * (2.0 if i in cave_at else 1.0)
            # (offset seaward m, height m) from inland down to under the water
            lean = 0.35 * _n3(x * 0.11, z * 0.11, 5.1, 1.0, 2)      # overhangs and slumps along the face
            prof = [(-2.2, t - 0.35), (-1.0, t - 0.05), (-0.35, t + 0.05), (0.0 + lean, t * 0.85), (0.1 - lean * 0.5, t * 0.6),
                    (0.05, max(1.3, t * 0.35)), (-0.45 * notch, 0.9 * min(notch, 1.6)), (-0.85 * notch, 0.4), (-0.4 * notch, -0.05),
                    (0.7, -0.3), (1.6, -0.85), (2.4, -1.4)]
            # densify the face (every ~0.3 m of height)
            dense = [prof[0]]
            for (o0, h0), (o1, h1) in zip(prof[:-1], prof[1:]):
                k = max(1, int(abs(h1 - h0) / 0.4 + abs(o1 - o0) / 0.6))
                for j in range(1, k + 1):
                    f = j / k
                    dense.append((o0 + (o1 - o0) * f, h0 + (h1 - h0) * f))
            col = []
            for o, hh in dense:
                o *= end
                hh = hh * end + (H(x - sx * 2.2, z - sz * 2.2) - 0.4) * (1 - end) if end < 1 else hh
                wx = x + sx * o
                wz = z + sz * o
                # rock texture as displacement along the sea normal (more on the face than on the buried top)
                face = 1.0 if -0.6 < o < 1.8 else 0.3
                d = strata(hh, wx, -wz) * face * end
                wx += sx * d
                wz += sz * d
                col.append(bm.verts.new((wx, -wz, hh)))
            cols.append(col)
        rows = min(len(c) for c in cols)
        for i in range(n - 1):
            a, b = cols[i], cols[i + 1]
            for r in range(rows - 1):
                try:
                    bm.faces.new((a[r], b[r], b[r + 1], a[r + 1]))
                except ValueError:
                    pass
    # face the sea: make every face point away from the land (out of the cliff)
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median()
        # land is where the ground is high; the face normal should point toward lower ground nearby
        probe = c + f.normal * 1.0
        if H(probe.x, -probe.y) > c.z + 0.5:
            f.normal_flip()
    return [_mesh_obj('site__cliffs__limestone', bm, coll)]


def _rock(name, coll, seed, sub, scale):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in bm.verts:
        d = v.co.normalized()
        p = d * 1.3 + off
        r = 1 + 0.28 * noise.fractal(p, 0.55, 2.0, 4) + 0.06 * math.sin(d.z * 9 + seed)
        v.co = Vector((d.x * scale[0] * r, d.y * scale[1] * r, d.z * scale[2] * r))
        if v.co.z < -0.15 * scale[2]:
            v.co.z = -0.15 * scale[2] + (v.co.z + 0.15 * scale[2]) * 0.15   # a flat-ish bed to sit on
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for v in me.vertices:
        ao = max(0.35, min(1.0, 0.55 + 0.5 * (v.co.z / scale[2]) + 0.2 * v.normal.z))
        col.data[v.index].color = (ao, 0.0, 0.0, 1.0)
    me.color_attributes.active_color = col
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def rock_protos(coll):
    shapes = {'a': (1.0, 0.8, 0.6), 'b': (0.9, 0.9, 0.75), 'c': (1.3, 0.7, 0.5), 'd': (0.8, 0.7, 0.9)}
    for k, (key, sc) in enumerate(shapes.items()):
        _rock(f'proto__rock{key}__0', coll, k + 1, 3, sc)
        _rock(f'proto__rock{key}__1', coll, k + 1, 1, sc)


def build_mushroom(site, coll):
    """rings stacked up: a narrow undercut stem on the reef, a wide layered cap, a rounded top"""
    cx, cz = site['at']
    cy = -cz
    # (height, radius): a reef foot, the deep wave-cut waist, the flaring cap, the rounded top (photos 2019-2023)
    prof = [(-1.4, 3.3), (-0.6, 3.0), (0.0, 2.7), (0.45, 2.45), (0.9, 2.6), (1.4, 3.2), (2.0, 4.1), (2.6, 4.8),
            (3.4, 5.15), (4.2, 5.0), (4.8, 4.5), (5.3, 3.6), (5.6, 2.4), (5.75, 1.0)]
    segs = 72
    bm = bmesh.new()
    rings = []
    hs = []
    for (h0, r0), (h1, r1) in zip(prof[:-1], prof[1:]):
        k = max(1, int((h1 - h0) / 0.12))
        for j in range(k):
            f = j / k
            hs.append((h0 + (h1 - h0) * f, r0 + (r1 - r0) * f))
    hs.append(prof[-1])
    for h, r in hs:
        ring_ = []
        for s in range(segs):
            a = 2 * math.pi * s / segs
            # an oval, longer north-south, the cap leaning toward the swell (north-west)
            rx = r * 1.12
            ry = r * 0.88
            wob = 1 + 0.22 * _n3(math.cos(a) * 2, math.sin(a) * 2, h * 0.5, 1.0, 3)                 + 0.1 * _n3(math.cos(a) * 6, math.sin(a) * 6, h * 1.7, 1.0, 2)
            x = cx + math.cos(a) * rx * wob
            y = cy + math.sin(a) * ry * wob
            lean = max(0.0, h - 1.5) * 0.08
            x -= lean * 0.7
            y += lean * 0.7
            d = strata(h, x, y) * 0.75 + (0.3 * max(0.0, 1.0 - abs(h - 2.0)) * _n3(x, y, h, 1.3, 2))   # ledges under the cap
            x += math.cos(a) * d
            y += math.sin(a) * d
            ring_.append(bm.verts.new((x, y, h - 0.1)))
        rings.append(ring_)
    for a_, b_ in zip(rings[:-1], rings[1:]):
        for s in range(segs):
            n = (s + 1) % segs
            bm.faces.new((a_[s], a_[n], b_[n], b_[s]))
    bm.faces.new(rings[-1])
    return [_mesh_obj('site__mushroom_rock__limestone', bm, coll)]


def _railing(P, bm_name, pts, z0, tube, height=1.05, post=1.6, closed=False):
    seq = pts + ([pts[0]] if closed else [])
    for a, b in zip(seq[:-1], seq[1:]):
        L = (b - a).length
        n = max(2, int(L / post) + 1)
        for k in range(n):
            p = a + (b - a) * (k / (n - 1))
            tube(P.bm(bm_name), Vector((p.x, p.y, z0)), Vector((p.x, p.y, z0 + height)), 0.03, 0.03, 8)
        for hh in (0.5, height):
            tube(P.bm(bm_name), Vector((a.x, a.y, z0 + hh)), Vector((b.x, b.y, z0 + hh)), 0.03, 0.03, 8)


def build_lookout_walkway(site, H, coll, Parts, oriented_box, cyl, tube):
    P = Parts()
    cx, cz = site['at']
    c = Vector((cx, -cz, 0))
    G = site['ground']
    az = math.radians(site['facing'])
    fwd = Vector((math.sin(az), math.cos(az), 0))
    side = Vector((-fwd.y, fwd.x, 0))
    # the octagonal pad and its plinth
    bm = P.bm('concrete')
    R = 3.6
    ring_b = [bm.verts.new((c.x + R * math.cos(2 * math.pi * k / 8 + math.pi / 8), c.y + R * math.sin(2 * math.pi * k / 8 + math.pi / 8), G - 0.3)) for k in range(8)]
    ring_t = [bm.verts.new((v.co.x, v.co.y, G + 0.08)) for v in ring_b]
    bm.faces.new(ring_t)
    for k in range(8):
        n = (k + 1) % 8
        bm.faces.new((ring_b[k], ring_b[n], ring_t[n], ring_t[k]))
    oriented_box(P.bm('concrete'), c.to_2d(), fwd.to_2d(), side.to_2d(), 0.55, 0.55, G, G + 0.62)
    # railings round the land side of the pad, open toward the walkway
    pts = []
    for k in range(9):
        a = az + math.radians(35 + k * (290 / 8))
        pts.append(c + Vector((math.sin(a), math.cos(a), 0)) * (R - 0.15))
    _railing(P, 'steel', pts, G + 0.08, tube)
    # information boards on posts, either side of the walkway's start
    for sgn in (-1, 1):
        b0 = c + fwd * (R - 0.6) + side * (sgn * 2.2)
        tube(P.bm('steel'), Vector((b0.x, b0.y, G)), Vector((b0.x, b0.y, G + 0.9)), 0.04, 0.04, 6)
        oriented_box(P.bm('sign'), b0.to_2d(), side.to_2d(), fwd.to_2d(), 0.5, 0.03, G + 0.85, G + 1.45)
    # the walkway: deck, side screens, railings, out over the cliff, hung from two masts with a crossbar
    L = 11.0
    w = 0.85
    start = c + fwd * (R - 0.2)
    end = start + fwd * L
    deck_c = (start + end) / 2
    oriented_box(P.bm('steel'), deck_c.to_2d(), fwd.to_2d(), side.to_2d(), L / 2, w, G - 0.05, G + 0.08)
    for sgn in (-1, 1):
        a = start + side * (sgn * w)
        b = end + side * (sgn * w)
        oriented_box(P.bm('steel'), ((a + b) / 2).to_2d(), fwd.to_2d(), side.to_2d(), L / 2, 0.02, G + 0.08, G + 0.95)
        tube(P.bm('steel'), Vector((a.x, a.y, G + 1.1)), Vector((b.x, b.y, G + 1.1)), 0.03, 0.03, 8)
    # end platform rail
    e1 = end + side * w
    e2 = end - side * w
    tube(P.bm('steel'), Vector((e1.x, e1.y, G + 1.1)), Vector((e2.x, e2.y, G + 1.1)), 0.03, 0.03, 8)
    m0 = start + fwd * 1.0
    for sgn in (-1, 1):
        base = m0 + side * (sgn * (w + 0.35))
        tube(P.bm('steel'), Vector((base.x, base.y, G - 0.2)), Vector((base.x, base.y, G + 6.0)), 0.09, 0.08, 10)
        for f in (0.45, 0.75, 1.0):
            anchor = start + fwd * (L * f) + side * (sgn * w)
            tube(P.bm('steel'), Vector((base.x, base.y, G + 5.9)), Vector((anchor.x, anchor.y, G + 1.0)), 0.015, 0.015, 4)
    a = m0 + side * (w + 0.35)
    b = m0 - side * (w + 0.35)
    tube(P.bm('steel'), Vector((a.x, a.y, G + 6.0)), Vector((b.x, b.y, G + 6.0)), 0.07, 0.07, 8)
    return P.finish(f'site__{site["id"]}', coll)


def build_lookout_pad(site, H, coll, Parts, oriented_box, cyl, tube):
    P = Parts()
    cx, cz = site['at']
    c = Vector((cx, -cz, 0))
    G = site['ground']
    az = math.radians(site['facing'])
    fwd = Vector((math.sin(az), math.cos(az), 0))
    side = Vector((-fwd.y, fwd.x, 0))
    oriented_box(P.bm('concrete'), (c + fwd * 1.0).to_2d(), fwd.to_2d(), side.to_2d(), 2.6, 3.2, G - 0.3, G + 0.06)
    # a curved railing round the seaward end
    pts = []
    for k in range(9):
        a = az + math.radians(-80 + k * 20)
        pts.append(c + fwd * 1.0 + Vector((math.sin(a), math.cos(a), 0)) * 2.8)
    _railing(P, 'steel', pts, G + 0.06, tube)
    # the bench: a concrete block, rounded at the ends
    oriented_box(P.bm('concrete'), (c + fwd * 0.6).to_2d(), side.to_2d(), fwd.to_2d(), 0.75, 0.32, G, G + 0.45)
    b0 = c - fwd * 1.2 + side * 2.4
    tube(P.bm('steel'), Vector((b0.x, b0.y, G)), Vector((b0.x, b0.y, G + 0.9)), 0.04, 0.04, 6)
    oriented_box(P.bm('sign'), b0.to_2d(), side.to_2d(), fwd.to_2d(), 0.45, 0.03, G + 0.8, G + 1.35)
    return P.finish(f'site__{site["id"]}', coll)
