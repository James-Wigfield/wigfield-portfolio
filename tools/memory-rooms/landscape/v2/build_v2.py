"""Blender: the geometry of a v2 landscape that isn't ground: plant prototypes and the built sites.

    blender -b --factory-startup --python build_v2.py -- --work <work> [--sites peron-sites.json] [--only plants|sites]

Writes <work>/build/props.glb (+ props.blend). No textures and no lighting in the GLB: the browser lights it
(src/memory-rooms/landscape/) and picks the material from the node name:

  proto__<species>__<lod>      a plant prototype, instanced at runtime (plants.npz). Its own frame: base at the
                               origin, +y up (glTF). Vertex colour R = ambient occlusion, G = how much it sways.
                               species: olearia scaevola acacia tall tussock dead; lod 0 = cards (alpha, the leaf
                               atlas tex/leaves.png, cell in the UVs), lod 1 = a solid low-poly blob (no alpha).
  site__<siteId>__<material>   a built site in world metres; material: concrete brick paint steel rust sign gun.
                               Vertex colour R = ambient occlusion (raycast against the sites and the ground).

World metres: Blender x east, y north, z up (glTF export turns that into x east, y up, z south = the scene frame).
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--work', required=True)
ap.add_argument('--sites', default=os.path.join(os.path.dirname(__file__), 'peron-sites.json'))
ap.add_argument('--only', default=None)
ap.add_argument('--ao-rays', type=int, default=24)
A = ap.parse_args(argv)
sys.path.insert(0, os.path.dirname(__file__))
import frame as F  # noqa: E402
import sites as SITES  # noqa: E402
import build_v2_nature as NAT  # noqa: E402

W = A.work
OUT = os.path.join(W, 'build')
os.makedirs(OUT, exist_ok=True)
fr = F.load(W)
g = np.load(os.path.join(W, 'grid2.npz'))
HGT = g['h']
R_, C_ = HGT.shape
Z0 = -fr.y1
rng = np.random.default_rng(9)
features = __import__('json').load(open(os.path.join(W, 'features.json')))


def H(x, z):
    """ground height (bilinear) at world x, z"""
    fx = (x - fr.x0) / fr.cell - 0.5
    fz = (z - Z0) / fr.cell - 0.5
    i, j = int(math.floor(fx)), int(math.floor(fz))
    tx, tz = fx - i, fz - j
    i0, i1 = max(0, min(C_ - 1, i)), max(0, min(C_ - 1, i + 1))
    j0, j1 = max(0, min(R_ - 1, j)), max(0, min(R_ - 1, j + 1))
    a = HGT[j0, i0] + (HGT[j0, i1] - HGT[j0, i0]) * tx
    b = HGT[j1, i0] + (HGT[j1, i1] - HGT[j1, i0]) * tx
    return float(a + (b - a) * tz)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def B(x, z, y=0.0):
    """world (x east, z south, y up) -> Blender Vector (x, y north, z up)"""
    return Vector((x, -z, y))


# ================================================================== mesh builders (bmesh, Blender coords)

class Parts:
    """bmeshes by material for one object group; .finish(prefix) makes the objects"""

    def __init__(self):
        self.bms = {}

    def bm(self, mat):
        if mat not in self.bms:
            self.bms[mat] = bmesh.new()
        return self.bms[mat]

    def finish(self, prefix, coll):
        obs = []
        for mat, bm in self.bms.items():
            if not bm.verts:
                continue
            me = bpy.data.meshes.new(f'{prefix}__{mat}')
            bm.normal_update()
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(f'{prefix}__{mat}', me)
            coll.objects.link(ob)
            obs.append(ob)
        return obs


def quad(bm, a, b, c, d):
    vs = [bm.verts.new(p) for p in (a, b, c, d)]
    return bm.faces.new(vs)


def box(bm, centre, size, rot=0.0, z0=None):
    """axis box; centre (Vector, Blender), size (sx, sy, sz); rot about z (radians); z0: base height instead"""
    sx, sy, sz = (s / 2 for s in size)
    c = Vector(centre)
    if z0 is not None:
        c.z = z0 + sz
    m = Matrix.Rotation(rot, 3, 'Z')
    P = [c + m @ Vector((x, y, z)) for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
    v = [bm.verts.new(p) for p in P]
    for f in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
        bm.faces.new([v[k] for k in f])


def oriented_box(bm, c, u, v, hu, hv, z0, z1):
    """box from a 2D frame (Blender xy centre c, unit axes u, v, half sizes) between heights z0..z1"""
    if u.x * v.y - u.y * v.x < 0:
        v = -v      # a left-handed frame (world z south -> Blender y north mirrors it) would build it inside out
    P = []
    for z in (z0, z1):
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            q = c + u * (su * hu) + v * (sv * hv)
            P.append(Vector((q.x, q.y, z)))
    vs = [bm.verts.new(p) for p in P]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([vs[k] for k in f])


def ring(bm, cx, cy, r_in, r_out, z0, z1, segs=64, inner=True, outer=True, bottom=False):
    """annulus prism"""
    def circ(r, z):
        return [bm.verts.new((cx + r * math.cos(2 * math.pi * k / segs), cy + r * math.sin(2 * math.pi * k / segs), z))
                for k in range(segs)]
    ib, ob, it, ot = circ(r_in, z0), circ(r_out, z0), circ(r_in, z1), circ(r_out, z1)
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((it[k], ot[k], ot[n], it[n]))       # top
        if outer:
            bm.faces.new((ob[k], ob[n], ot[n], ot[k]))
        if inner:
            bm.faces.new((ib[k], it[k], it[n], ib[n]))
        if bottom:
            bm.faces.new((ib[k], ib[n], ob[n], ob[k]))


def band(bm, cx, cy, r0, z0, r1, z1, segs=64):
    """a sloped band (frustum side) from radius r0 at z0 to r1 at z1, facing inward (toward the axis)"""
    a = [bm.verts.new((cx + r0 * math.cos(2 * math.pi * k / segs), cy + r0 * math.sin(2 * math.pi * k / segs), z0))
         for k in range(segs)]
    b = [bm.verts.new((cx + r1 * math.cos(2 * math.pi * k / segs), cy + r1 * math.sin(2 * math.pi * k / segs), z1))
         for k in range(segs)]
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((a[k], b[k], b[n], a[n]))


def cyl(bm, cx, cy, r, z0, z1, segs=32, top=True, bottom=False):
    bot = [bm.verts.new((cx + r * math.cos(2 * math.pi * k / segs), cy + r * math.sin(2 * math.pi * k / segs), z0))
           for k in range(segs)]
    tp = [bm.verts.new((cx + r * math.cos(2 * math.pi * k / segs), cy + r * math.sin(2 * math.pi * k / segs), z1))
          for k in range(segs)]
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((bot[k], bot[n], tp[n], tp[k]))
    if top:
        bm.faces.new(tp)
    if bottom:
        bm.faces.new(list(reversed(bot)))


def disc(bm, cx, cy, r, z, segs=48):
    vs = [bm.verts.new((cx + r * math.cos(2 * math.pi * k / segs), cy + r * math.sin(2 * math.pi * k / segs), z))
          for k in range(segs)]
    bm.faces.new(vs)


def tube(bm, a, b, r0, r1, segs=8, caps=True):
    """tapered cylinder from a to b (Vectors)"""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    t = d.orthogonal().normalized()
    s = d.cross(t)
    ra = [bm.verts.new(a + (t * math.cos(2 * math.pi * k / segs) + s * math.sin(2 * math.pi * k / segs)) * r0)
          for k in range(segs)]
    rb = [bm.verts.new(b + (t * math.cos(2 * math.pi * k / segs) + s * math.sin(2 * math.pi * k / segs)) * r1)
          for k in range(segs)]
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((ra[k], ra[n], rb[n], rb[k]))
    if caps:
        bm.faces.new(list(reversed(ra)))
        bm.faces.new(rb)


def beam(bm, a, b, w, h, up=Vector((0, 0, 1))):
    """a rectangular beam from a to b (Vectors), w wide, h tall"""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    side = d.cross(up).normalized() * (w / 2)
    upv = side.cross(d).normalized() * (h / 2)
    P = [p + sx * side + sz * upv for p in (a, b) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    v = [bm.verts.new(p) for p in P]
    for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([v[k] for k in f])


# ================================================================== sites

def build_panama(s, coll):
    P = Parts()
    cx, cz = s['at']
    c = B(cx, cz)
    G = s['ground']
    pit = s['pit']
    Fl = G - pit['floor']
    rf, rl, ro = pit['r_floor'], pit['r_lip'], pit['r_out']
    restored = s['restored']
    wallm = 'brick' if restored else 'concrete'
    # the floor (restored: brick rings; unrestored: sand = the ground itself)
    if restored:
        disc(P.bm('brick'), c.x, c.y, rf + 0.05, Fl + 0.02, 64)
    # inner wall: restored = brick terraces (two benches, photos 2020-2021), unrestored = a plain concrete wall
    if restored:
        rise = (G - Fl) / 3
        steps_r = [rf, rf + (rl - rf) * 0.4, rf + (rl - rf) * 0.75]
        for k, r0 in enumerate(steps_r):
            r1 = rl if k == 2 else steps_r[k + 1]
            ring(P.bm('brick'), c.x, c.y, r0, r1 + 0.02, Fl - 0.1, Fl + rise * (k + 1), 64, outer=False)
    else:
        ring(P.bm('concrete'), c.x, c.y, rf, rl, Fl - 0.1, G - 0.02, 64, outer=False)
    ring(P.bm('concrete'), c.x, c.y, rl - 0.05, rl + 0.35, G - 0.3, G + 0.12, 64)
    # the lip out to the edge of the pad, a hair above the ground
    ring(P.bm('concrete'), c.x, c.y, rl + 0.35, ro, G - 0.3, G + 0.05, 64, inner=False)
    # rails: one in the floor by the wall, one on the lip
    ring(P.bm('rust'), c.x, c.y, rf - 0.55, rf - 0.45, Fl, Fl + 0.07, 96, bottom=False)
    ring(P.bm('rust'), c.x, c.y, ro - 0.3, ro - 0.2, G + 0.05, G + 0.1, 96)
    # pedestal
    if restored:
        cyl(P.bm('brick'), c.x, c.y, 2.05, Fl, Fl + 0.3, 48)
        cyl(P.bm('paint'), c.x, c.y, 1.45, Fl + 0.3, Fl + 0.85, 48)
        cyl(P.bm('steel'), c.x, c.y, 1.32, Fl + 0.85, Fl + 0.92, 48)
        top = Fl + 0.92
    else:
        cyl(P.bm('concrete'), c.x, c.y, 1.7, Fl - 0.2, Fl + 0.95, 40)
        cyl(P.bm('rust'), c.x, c.y, 1.55, Fl + 0.95, Fl + 1.0, 40)
        top = Fl + 1.0
    for k in range(10):
        a = 2 * math.pi * k / 10
        cyl(P.bm('steel'), c.x + 1.12 * math.cos(a), c.y + 1.12 * math.sin(a), 0.05, top, top + 0.09, 8)
    # steps down at the rear, inside the ramp strip prep2 cut
    rx, rz = SITES.rear_dir(s)
    rb = Vector((rx, -rz, 0))
    tb = Vector((-rb.y, rb.x, 0))
    n_steps = 4
    for k in range(n_steps):
        t0 = rf - 0.15 + (rl + 0.35 - (rf - 0.15)) * k / n_steps
        t1 = rf - 0.15 + (rl + 0.35 - (rf - 0.15)) * (k + 1) / n_steps
        zt = Fl + (G - Fl) * (k + 1) / n_steps
        mid = c + rb * ((t0 + t1) / 2)
        oriented_box(P.bm('concrete'), mid.to_2d(), rb.to_2d(), tb.to_2d(), (t1 - t0) / 2, 0.68, Fl - 0.1, zt)
    # ready-use lockers: two green concrete boxes at the rear, doors facing the pit
    for side in (-1, 1):
        m = c + rb * (ro + 1.7) + tb * (2.2 * side)
        gz = H(m.x, -m.y)
        oriented_box(P.bm('paint'), m.to_2d(), tb.to_2d(), rb.to_2d(), 1.2, 0.65, gz - 0.2, gz + 1.15)
        oriented_box(P.bm('concrete'), m.to_2d(), tb.to_2d(), rb.to_2d(), 1.3, 0.75, gz + 1.15, gz + 1.27)
        door = m - rb * 0.66
        oriented_box(P.bm('steel'), door.to_2d(), tb.to_2d(), rb.to_2d(), 0.85, 0.02, gz + 0.1, gz + 0.95)
    if restored:
        # the interpretive sign: a rusty steel box with a sloping panel, at the front left of the pit
        fa = math.radians(s.get('rear', 90) + 150)
        sp = c + Vector((math.sin(fa), math.cos(fa), 0)) * (ro + 0.9)
        gz = H(sp.x, -sp.y)
        to_c = (c - sp).normalized()
        sdv = Vector((-to_c.y, to_c.x, 0))
        oriented_box(P.bm('rust'), sp.to_2d(), sdv.to_2d(), to_c.to_2d(), 0.32, 0.17, gz - 0.1, gz + 0.85)
        a0 = sp + to_c * 0.05 + Vector((0, 0, gz + 0.85))
        quad(P.bm('sign'), a0 - sdv * 0.34 - to_c * 0.2, a0 + sdv * 0.34 - to_c * 0.2,
             a0 + sdv * 0.34 + to_c * 0.22 + Vector((0, 0, 0.18)), a0 - sdv * 0.34 + to_c * 0.22 + Vector((0, 0, 0.18)))
    if s.get('replica'):
        build_gun(P, c, top, facing=math.radians(270))
    return P.finish(f'site__{s["id"]}', coll)


def build_gun(P, c, top, facing):
    """the replica Canon de 155 mm GPF (photos Jan 2021): a cradle on the pedestal, two big tyred wheels on a
    stub axle, a ~6 m barrel with a thick breech and a muzzle ring, the recuperator under it, split trails with
    spades resting toward the pit floor"""
    fwd = Vector((math.sin(facing), math.cos(facing), 0))      # azimuth clockwise from north
    side = Vector((-fwd.y, fwd.x, 0))
    base = Vector((c.x, c.y, top))
    bm = P.bm('gun')
    oriented_box(bm, base.to_2d(), fwd.to_2d(), side.to_2d(), 0.85, 0.42, top, top + 0.45)
    axle = base + Vector((0, 0, 0.62))
    tube(P.bm('steel'), axle - side * 0.98, axle + side * 0.98, 0.07, 0.07, 10)
    for sgn in (-1, 1):
        w = axle + side * (0.8 * sgn)
        tube(P.bm('tyre'), w - side * 0.17, w + side * 0.17, 0.62, 0.62, 28)        # the tyre
        tube(bm, w - side * 0.19, w + side * 0.19, 0.34, 0.34, 16)                  # the rim / hub
    piv = base + Vector((0, 0, 1.05)) - fwd * 0.3
    el = math.radians(10)
    dirb = (fwd * math.cos(el) + Vector((0, 0, math.sin(el)))).normalized()
    oriented_box(bm, (piv - dirb * 0.2).to_2d(), fwd.to_2d(), side.to_2d(), 0.8, 0.3, top + 0.45, top + 1.0)
    tube(bm, piv - dirb * 1.3, piv - dirb * 0.2, 0.24, 0.22, 16)       # breech
    tube(bm, piv - dirb * 0.2, piv + dirb * 5.0, 0.16, 0.1, 16)         # barrel
    tube(bm, piv + dirb * 4.95, piv + dirb * 5.15, 0.13, 0.13, 16)      # muzzle ring
    under = Vector((0, 0, -0.24))
    tube(bm, piv - dirb * 1.0 + under, piv + dirb * 1.7 + under, 0.11, 0.11, 12)   # recuperator
    for sgn in (-1, 1):
        a = base - fwd * 0.55 + side * (0.3 * sgn) + Vector((0, 0, 0.35))
        tdir = (-fwd * math.cos(math.radians(24)) + side * (sgn * math.sin(math.radians(24)))).normalized()
        b = base + tdir * 4.7 + Vector((0, 0, -0.62))
        beam(bm, a, b, 0.2, 0.28)
        sp = b + tdir * 0.05
        oriented_box(bm, sp.to_2d(), side.to_2d(), tdir.to_2d(), 0.35, 0.05, sp.z - 0.25, sp.z + 0.15)


def build_rect_site(s, coll):
    P = Parts()
    poly = SITES.footprint(s, features)
    c2, u2, v2, hu, hv = SITES.rect_frame(poly)
    c = Vector((c2[0], -c2[1]))
    u = Vector((u2[0], -u2[1]))
    v = Vector((v2[0], -v2[1]))
    G = s['ground']
    up = s['above']
    kind = s['kind']
    # which face is the sea side (west-ish) and which the entry (east-ish)
    west = Vector((-1, 0))
    seav = u if abs(u.dot(west)) > abs(v.dot(west)) else v
    if seav.dot(west) < 0:
        seav = -seav
    if kind in ('bunker', 'opscentre'):
        oriented_box(P.bm('paint'), c, u, v, hu, hv, G - 0.4, G + up)
        oriented_box(P.bm('concrete'), c, u, v, hu + 0.15, hv + 0.15, G + up, G + up + 0.22)
        door = c - seav * (hu if seav == u or seav == -u else hv)
        dv = Vector((-seav.y, seav.x))
        oriented_box(P.bm('steel'), (door - seav * 0.02), dv, seav, 0.55, 0.03, G - 0.05, G + min(up, 1.0) - 0.05)
        if kind == 'opscentre':
            # the raised block along the landward side and the bars on the roof
            hb = (hu if seav == u or seav == -u else hv)
            rc = c - seav * (hb * 0.55)
            hu2, hv2 = (hu * 0.45, hv) if seav == u or seav == -u else (hu, hv * 0.45)
            oriented_box(P.bm('paint'), rc, u, v, hu2, hv2, G + up, G + up + 0.5)
            oriented_box(P.bm('concrete'), rc, u, v, hu2 + 0.12, hv2 + 0.12, G + up + 0.5, G + up + 0.7)
            for off in (-0.5, 0.5):
                bc = c + seav * (hb * 0.35) + Vector((-seav.y, seav.x)) * (off * hb)
                oriented_box(P.bm('concrete'), bc, seav, Vector((-seav.y, seav.x)), 1.4, 0.2, G + up + 0.22, G + up + 0.55)
    elif kind == 'op':
        sea_is_u = abs(seav.dot(u)) > 0.5
        hs = hu if sea_is_u else hv     # half size along the sea axis
        ha = hv if sea_is_u else hu     # across
        acr = Vector((-seav.y, seav.x))
        # the stepped form (photos 2020-2023): a lower block, a slit storey that juts out over its sea face, a roof
        # slab jutting further, and a lower annex on one side
        oriented_box(P.bm('paint'), c - seav * 0.3, seav, acr, hs - 0.3, ha, G - 0.3, G + 2.2)
        annex = c - acr * (ha + 0.7) - seav * 0.6
        oriented_box(P.bm('paint'), annex, seav, acr, hs * 0.55, 0.7, G - 0.3, G + 1.6)
        oriented_box(P.bm('concrete'), annex, seav, acr, hs * 0.55 + 0.1, 0.8, G + 1.6, G + 1.78)
        top_c = c + seav * 0.25
        oriented_box(P.bm('paint'), top_c - seav * 0.3, seav, acr, hs - 0.05, ha, G + 2.2, G + 3.05)
        # the slit: a dark recess along the sea face, a band below it, a deep sill
        oriented_box(P.bm('paint'), top_c + seav * (hs - 0.2), seav, acr, 0.22, ha + 0.05, G + 2.1, G + 2.45)
        oriented_box(P.bm('steel'), top_c + seav * (hs - 0.45), seav, acr, 0.02, ha - 0.25, G + 2.45, G + 2.78)
        oriented_box(P.bm('paint'), top_c + seav * (hs - 0.2), seav, acr, 0.22, ha + 0.05, G + 2.78, G + 3.05)
        roof = c + seav * 0.55
        oriented_box(P.bm('concrete'), roof, seav, acr, hs + 0.55, ha + 0.3, G + 3.05, G + 3.32)
        # the tripod and its disc (an art piece above the post)
        apex = Vector((c.x, c.y, G + 3.32 + 4.2))
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.4
            foot = Vector((c.x + 1.6 * math.cos(a), c.y + 1.6 * math.sin(a), G + 3.32))
            tube(P.bm('steel'), foot, apex, 0.035, 0.03, 6)
        d0 = apex + Vector((0, 0, 0.55))
        tube(P.bm('steel'), d0 - Vector((seav.x, seav.y, 0)) * 0.03, d0 + Vector((seav.x, seav.y, 0)) * 0.03, 0.55, 0.55, 28)
        # apron on the sea side, with a steel railing round its outer edges
        ap_c = c + seav * (hs + 1.6)
        gz = G
        oriented_box(P.bm('concrete'), ap_c, seav, acr, 1.6, ha + 1.2, gz - 0.25, gz + 0.06)
        corners = [ap_c + seav * 1.55 + acr * (ha + 1.15), ap_c + seav * 1.55 - acr * (ha + 1.15),
                   ap_c - seav * 1.55 - acr * (ha + 1.15)]
        for a, b in zip(corners[:-1], corners[1:]):
            L = (b - a).length
            n = max(2, int(L / 1.6) + 1)
            for k in range(n):
                p = a + (b - a) * (k / (n - 1))
                tube(P.bm('steel'), Vector((p.x, p.y, gz)), Vector((p.x, p.y, gz + 1.05)), 0.025, 0.025, 6)
            for hgt in (0.5, 1.02):
                tube(P.bm('steel'), Vector((a.x, a.y, gz + hgt)), Vector((b.x, b.y, gz + hgt)), 0.022, 0.022, 6)
    return P.finish(f'site__{s["id"]}', coll)


def ground_patch(cx, cy, rad, step=1.0):
    """a terrain mesh round a site (the AO occluder)"""
    bm = bmesh.new()
    n = int(2 * rad / step) + 1
    vs = []
    for j in range(n):
        row = []
        for i in range(n):
            x = cx - rad + i * step
            y = cy - rad + j * step
            row.append(bm.verts.new((x, y, H(x, -y))))
        vs.append(row)
    for j in range(n - 1):
        for i in range(n - 1):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    return bm


def densify(ob, max_edge=0.45):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(6):
        long = [e for e in bm.edges if e.calc_length() > max_edge]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()


def bake_ao(obs, extra_bms, rays=24, reach=4.0):
    """per-vertex AO: cosine-weighted hemisphere rays against every site mesh + the ground patches"""
    bm_all = bmesh.new()
    for ob in obs:
        bm_all.from_mesh(ob.data)
    for bm in extra_bms:
        tmp = bpy.data.meshes.new('tmp')
        bm.to_mesh(tmp)
        bm_all.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    tree = BVHTree.FromBMesh(bm_all)
    dirs = []
    for k in range(rays):   # a fixed spiral of cosine-weighted directions (around +z), rotated per vertex
        u = (k + 0.5) / rays
        r = math.sqrt(u)
        th = k * 2.39996
        dirs.append(Vector((r * math.cos(th), r * math.sin(th), math.sqrt(1 - u))))
    for ob in obs:
        me = ob.data
        me.calc_loop_triangles()
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for v in me.vertices:
            n = v.normal
            rot = n.to_track_quat('Z', 'Y').to_matrix()
            o = v.co + n * 0.02
            hits = 0
            for d in dirs:
                if tree.ray_cast(o, rot @ d, reach)[0] is not None:
                    hits += 1
            ao = max(0.3, 1.0 - 0.8 * hits / rays)
            col.data[v.index].color = (ao, 0.0, 0.0, 1.0)
        me.color_attributes.active_color = col


# ================================================================== plants

SPECIES = {  # leaf-atlas cell (u0, v0) in glTF UV space (v down from the top), size, colour of the solid LOD
    'olearia': (0.0, 0.0),
    'scaevola': (0.5, 0.0),
    'acacia': (0.0, 0.5),
    'tussock': (0.5, 0.5),
}


def card(bm, uvl, centre, normal, size, roll, cell, ao_at, sway_at, radial_from):
    n = normal.normalized()
    t = n.orthogonal().normalized()
    t.rotate(Matrix.Rotation(roll, 3, n))
    b = n.cross(t)
    hs = size / 2
    P = [centre + (-t - b) * hs, centre + (t - b) * hs, centre + (t + b) * hs, centre + (-t + b) * hs]
    UV = [(0, 1), (1, 1), (1, 0), (0, 0)]
    vs = [bm.verts.new(p) for p in P]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, UV):
        loop[uvl].uv = (cell[0] + u * 0.5, 1 - (cell[1] + v * 0.5))
    for v_ in vs:
        v_.normal = (v_.co - radial_from).normalized() * 0.7 + n * 0.3
    return vs


def plant_object(name, bm, coll, ao_fn, sway_fn, normals=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for v in me.vertices:
        col.data[v.index].color = (ao_fn(v.co), sway_fn(v.co), 0.0, 1.0)
    me.color_attributes.active_color = col
    if normals is not None:
        me.normals_split_custom_set_from_vertices([normals(v.co) for v in me.vertices])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def mound(name, cell, coll, n_cards=70, rx=0.8, rz=1.0, card_size=0.62, lod=0):
    """a rounded heath mound: cards on a noisy ellipsoid shell facing out, a few inside; base at z = 0"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    centre = Vector((0, 0, rz * 0.45))
    k = 0
    tries = 0
    while k < n_cards and tries < n_cards * 10:
        tries += 1
        d = Vector(rng.normal(0, 1, 3))
        d.normalize()
        if d.z < -0.35:
            continue
        r = rng.uniform(0.55, 1.0) if rng.random() < 0.8 else rng.uniform(0.2, 0.5)
        p = centre + Vector((d.x * rx * r, d.y * rx * r, d.z * rz * 0.55 * r))
        if p.z < 0.08:
            continue
        normal = (p - centre)
        normal.z *= 0.6
        if normal.length < 1e-3:
            normal = Vector((0, 0, 1))
        card(bm, uvl, p, normal + Vector(rng.normal(0, 0.35, 3)), card_size * rng.uniform(0.8, 1.2),
             rng.uniform(0, 2 * math.pi), cell, None, None, centre)
        k += 1
    top = rz
    return plant_object(f'proto__{name}__0', bm, coll,
                        lambda co: max(0.25, min(1.0, 0.3 + 0.75 * (co.z / top) + 0.25 * ((co.xy.length) / rx))),
                        lambda co: max(0.0, min(1.0, (max(0.0, co.z) / top) ** 1.4)),
                        lambda co: (co - centre).normalized())


def mound_far(name, cell, coll, rx=0.8, rz=1.0):
    """the far LOD: 7 big cards in a mound (14 triangles), the same leaves"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    centre = Vector((0, 0, rz * 0.45))
    for k in range(7):
        if k < 5:
            a = 2 * math.pi * k / 5 + 0.3
            p = centre + Vector((math.cos(a) * rx * 0.45, math.sin(a) * rx * 0.45, 0.05))
            nrm = Vector((math.cos(a), math.sin(a), 0.35))
        else:
            p = centre + Vector((0.12 * (k - 5.5), 0.0, rz * 0.3))
            nrm = Vector((0.2 * (k - 5.5), 0.3, 1.0))
        card(bm, uvl, p, nrm, 1.25, rng.uniform(-0.3, 0.3), cell, None, None, centre)
    top = rz
    return plant_object(f'proto__{name}__1', bm, coll,
                        lambda co: max(0.35, min(1.0, 0.4 + 0.65 * (max(0.0, co.z) / top))),
                        lambda co: max(0.0, min(1.0, (max(0.0, co.z) / top) ** 1.4)),
                        lambda co: (co - centre).normalized())


def blob(name, coll, rx=0.8, rz=1.0, suffix='1'):
    """the far LOD: a lumpy closed mound, ~90 triangles, base at z = 0"""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        d = v.co.normalized()
        lump = 1 + 0.12 * math.sin(5 * d.x + 2) * math.sin(4 * d.y + 1) + 0.08 * math.sin(7 * d.z)
        v.co = Vector((d.x * rx * lump, d.y * rx * lump, max(0.0, (d.z * 0.55 + 0.45)) * rz * lump))
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.01)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=0.005)
    top = rz
    return plant_object(f'proto__{name}__{suffix}', bm, coll,
                        lambda co: max(0.3, min(1.0, 0.35 + 0.7 * co.z / top)),
                        lambda co: max(0.0, min(1.0, (max(0.0, co.z) / top) ** 1.4)))


def tall(coll):
    """a tall coastal shrub (Acacia rostellifera / Melaleuca): a few leaning stems, a broken crown; ~3 m"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    bark = bmesh.new()
    crowns = []
    for k in range(4):
        a = 2 * math.pi * k / 4 + rng.uniform(-0.4, 0.4)
        lean = Vector((math.cos(a) * 0.35, math.sin(a) * 0.35, 1)).normalized()
        top = lean * rng.uniform(1.9, 2.5)
        tube(bark, Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0)), top, 0.07, 0.035, 6)
        crowns.append(top)
    for ctr in crowns:
        for _ in range(28):
            d = Vector(rng.normal(0, 1, 3)).normalized()
            p = ctr + Vector((d.x * 0.75, d.y * 0.75, d.z * 0.5 + 0.25))
            card(bm, uvl, p, (p - ctr) + Vector(rng.normal(0, 0.3, 3)), 0.7 * rng.uniform(0.8, 1.2),
                 rng.uniform(0, 6.28), SPECIES['acacia'], None, None, ctr)
    leaves = plant_object('proto__tall__0', bm, coll, lambda co: max(0.3, min(1.0, 0.25 + co.z / 3.2)),
                          lambda co: max(0.0, min(1.0, (max(0.0, co.z) / 3.0) ** 1.5)), lambda co: (co - Vector((0, 0, 2.2))).normalized())
    me = bpy.data.meshes.new('proto__tall__0__bark')
    bark.to_mesh(me)
    bark.free()
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for v in me.vertices:
        col.data[v.index].color = (0.55 + 0.3 * min(1, v.co.z / 2.5), max(0.0, min(1.0, (max(0.0, v.co.z) / 3.0) ** 1.5)), 0.0, 1.0)
    ob = bpy.data.objects.new('proto__tall__0__bark', me)
    coll.objects.link(ob)
    # far LOD: three blobs on stems
    bm2 = bmesh.new()
    for ctr in crowns[:3]:
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=0.8)
        for v in tmp.verts:
            v.co = Vector((v.co.x + ctr.x, v.co.y + ctr.y, v.co.z * 0.7 + ctr.z + 0.2))
        tme = bpy.data.meshes.new('t')
        tmp.to_mesh(tme)
        tmp.free()
        bm2.from_mesh(tme)
        bpy.data.meshes.remove(tme)
    plant_object('proto__tall__1', bm2, coll, lambda co: max(0.35, min(1.0, 0.3 + co.z / 3.0)),
                 lambda co: max(0.0, min(1.0, (max(0.0, co.z) / 3.0) ** 1.5)))
    return leaves


def tussock(coll, n=16, lod='0'):
    """spinifex: blades fanning from one root, as crossed vertical cards; 0.8 m"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    for k in range(n):
        a = math.pi * k / n + rng.uniform(-0.1, 0.1)
        tilt = rng.uniform(-0.25, 0.25)
        nrm = Vector((math.cos(a), math.sin(a), tilt)).normalized()
        c = Vector((rng.normal(0, 0.05), rng.normal(0, 0.05), 0.4))
        t = Vector((-math.sin(a), math.cos(a), 0))
        up = Vector((0, 0, 1))
        hs = 0.42
        P = [c - t * hs - up * 0.4, c + t * hs - up * 0.4, c + t * hs + up * 0.42, c - t * hs + up * 0.42]
        vs = [bm.verts.new(p) for p in P]
        f = bm.faces.new(vs)
        cell = SPECIES['tussock']
        for loop, (u, v) in zip(f.loops, [(0, 1), (1, 1), (1, 0), (0, 0)]):
            loop[uvl].uv = (cell[0] + u * 0.5, 1 - (cell[1] + v * 0.5))
    return plant_object(f'proto__tussock__{lod}', bm, coll, lambda co: max(0.35, min(1.0, 0.35 + co.z / 0.8)),
                        lambda co: max(0.0, min(1.0, (max(0.0, co.z) / 0.8) ** 1.2)), lambda co: Vector((co.x, co.y, 0.6)).normalized())


def dead(coll):
    """a dead grey bush: forked twigs, 0.9 m"""
    bm = bmesh.new()

    def branch(p, d, ln, r, depth):
        e = p + d * ln
        tube(bm, p, e, r, r * 0.6, 4, caps=False)
        if depth > 0:
            for _ in range(2 if depth < 3 else 3):
                nd = (d + Vector(rng.normal(0, 0.55, 3))).normalized()
                nd.z = abs(nd.z) * 0.8 + 0.2
                branch(e, nd.normalized(), ln * 0.7, r * 0.6, depth - 1)
    for k in range(5):
        a = 2 * math.pi * k / 5
        branch(Vector((0, 0, 0)), Vector((math.cos(a) * 0.4, math.sin(a) * 0.4, 1)).normalized(), 0.32, 0.025, 3)
    return plant_object('proto__dead__0', bm, coll, lambda co: max(0.4, min(1.0, 0.4 + co.z)),
                        lambda co: max(0.0, min(1.0, co.z / 0.9)))


def main():
    reset()
    coll = bpy.data.collections.new('props')
    bpy.context.scene.collection.children.link(coll)
    if A.only in (None, 'plants'):
        mound('olearia', SPECIES['olearia'], coll, n_cards=74)
        mound('scaevola', SPECIES['scaevola'], coll, n_cards=70, card_size=0.58)
        mound('acacia', SPECIES['acacia'], coll, n_cards=66, card_size=0.7)
        for sp in ('olearia', 'scaevola', 'acacia'):
            mound_far(sp, SPECIES[sp], coll)
        tall(coll)
        NAT.rock_protos(coll)
        tussock(coll, 16, '0')
        tussock(coll, 5, '1')
        dead(coll)
    if A.only in (None, 'sites'):
        site_obs = []
        patches = []
        for s in SITES.load(A.sites):
            if s['kind'] == 'panama':
                obs = build_panama(s, coll)
            elif s['kind'] == 'lookout_walkway':
                obs = NAT.build_lookout_walkway(s, H, coll, Parts, oriented_box, cyl, tube)
            elif s['kind'] == 'lookout_pad':
                obs = NAT.build_lookout_pad(s, H, coll, Parts, oriented_box, cyl, tube)
            elif s['kind'] == 'mushroom':
                obs = NAT.build_mushroom(s, coll)
            else:
                obs = build_rect_site(s, coll)
            for ob in obs:
                # only the big flat surfaces need more vertices for their AO; rails, tubes and the rock don't
                if ob.name.rsplit('__', 1)[-1] in ('concrete', 'paint', 'brick'):
                    densify(ob, 0.6)
            site_obs += obs
            if 'at' in s:
                cx, cy = s['at'][0], -s['at'][1]
            else:
                c2 = SITES.rect_frame(SITES.footprint(s, features))[0]
                cx, cy = c2[0], -c2[1]
            patches.append(ground_patch(cx, cy, 16))
            print('site', s['id'], [o.name for o in obs], flush=True)
        bake_ao(site_obs, patches, rays=A.ao_rays)
        # the cliffs along every rocky coast run (coast.json), AO against themselves only (a km of coast)
        cp = os.path.join(W, 'coast.json')
        if os.path.exists(cp):
            cl = NAT.build_cliffs(__import__('json').load(open(cp)), H, coll)
            bake_ao(cl, [], rays=12, reach=3.0)
            print('cliffs', len(cl[0].data.vertices), 'verts', flush=True)
    bpy.ops.object.select_all(action='SELECT')
    glb = os.path.join(OUT, 'props.glb')
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
        export_tangents=False, export_materials='NONE', export_extras=True, export_vertex_color='ACTIVE')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'props.blend'))
    print('exported', glb, round(os.path.getsize(glb) / 1e6, 2), 'MB', flush=True)


main()
