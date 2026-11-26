"""The built sites of a v2 landscape (peron-sites.json): their footprints and the ground edits under them.

Shared by prep2.py (numpy, applies the edits to the height grid) and build_v2.py (Blender, builds on the same
heights). World metres: x east, z south. A site's footprint polygon comes from OSM (features.json bunkers by way
id); a Panama gun pit is a circle round its OSM node.
"""
import json
import math
import os

import numpy as np

HERE = os.path.dirname(__file__)


def load(path=None):
    return json.load(open(path or os.path.join(HERE, 'peron-sites.json')))['sites']


def footprint(site, features):
    """World (x, z) polygon (closed, no repeat) of an OSM-way site, else None."""
    if not site.get('osm', '').startswith('way '):
        return None
    wid = int(site['osm'].split()[1])
    for b in features.get('bunkers', []):
        if b['id'] == wid:
            pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']
            return [(p[0], -p[1]) for p in pts]
    raise KeyError(f'{site["id"]}: OSM way {wid} not in features.json')


def rect_frame(poly):
    """centre, unit axis u (along the longest edge), v, half sizes (hu, hv) of a near-rectangle."""
    P = np.array(poly, float)
    c = P.mean(0)
    best = None
    for i in range(len(P)):
        e = P[(i + 1) % len(P)] - P[i]
        if best is None or np.hypot(*e) > np.hypot(*best):
            best = e
    u = best / np.hypot(*best)
    v = np.array([-u[1], u[0]])
    du = (P - c) @ u
    dv = (P - c) @ v
    return c, u, v, (du.max() - du.min()) / 2, (dv.max() - dv.min()) / 2


def poly_dist(px, pz, poly):
    """signed distance (m) from points to a convex-ish polygon: negative inside."""
    P = np.array(poly, float)
    n = len(P)
    d = np.full(np.shape(px), np.inf)
    inside = np.ones(np.shape(px), bool)
    area = 0.0
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        area += a[0] * b[1] - b[0] * a[1]
    sgn = 1 if area > 0 else -1
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        ab = b - a
        t = np.clip(((px - a[0]) * ab[0] + (pz - a[1]) * ab[1]) / (ab @ ab), 0, 1)
        qx, qz = a[0] + t * ab[0], a[1] + t * ab[1]
        d = np.minimum(d, np.hypot(px - qx, pz - qz))
        cross = ab[0] * (pz - a[1]) - ab[1] * (px - a[0])
        inside &= sgn * cross >= 0
    return np.where(inside, -d, d)


def rear_dir(site):
    """unit (x, z) toward the site's rear (azimuth clockwise from north; north = -z)."""
    az = math.radians(site.get('rear', 90))
    return math.sin(az), -math.cos(az)


def apply_ground(h, X, Z, sites, features):
    """Edit the height grid h (rows = z, cols = x; X, Z the cell centres) in place. Returns a uint8 mask of the
    cells that must not be walked (pedestals, footprints)."""
    blockm = np.zeros(h.shape, np.uint8)
    for s in sites:
        G = s['ground']
        if s['kind'] == 'panama':
            cx, cz = s['at']
            r = np.hypot(X - cx, Z - cz)
            pit = s['pit']
            pad = s['pad']
            near = r < pad['r'] + pad['blend'] + 1
            if not near.any():
                continue
            w = np.clip((r - pad['r']) / pad['blend'], 0, 1)
            w = w * w * (3 - 2 * w)
            hz = np.full(h.shape, G, np.float32)
            floor = G - pit['floor']
            # the pit: a flat floor right out to the lip (the brick terraces / wall are meshes standing on it, so the
            # ground never pokes through them), then up to the pad within 0.3 m
            wall = np.clip((r - pit['r_lip']) / 0.3, 0, 1)
            hz = np.where(r < pit['r_lip'] + 0.3, (floor - 0.04) + (G - floor + 0.04) * wall, hz)
            # steps down at the rear: a 1.3 m wide strip ramps from the lip out to 2 m past it
            rx, rz = rear_dir(s)
            along = (X - cx) * rx + (Z - cz) * rz
            across = np.abs(-(X - cx) * rz + (Z - cz) * rx)
            ramp = (across < 0.65) & (along > pit['r_floor'] - 0.2) & (along < pit['r_out'] + 2.0)
            t = np.clip((along - pit['r_floor']) / (pit['r_out'] + 2.0 - pit['r_floor']), 0, 1)
            hz = np.where(ramp, floor + (G - floor) * t, hz)
            h[near] = (hz * (1 - w) + h * w)[near]
            blockm |= ((r < 2.2) & near).astype(np.uint8)  # the pedestal (and the replica gun on it)
        elif s['kind'] in ('lookout_walkway', 'lookout_pad'):
            # a round concrete pad flattened at the lookout's height
            cx, cz = s['at']
            r = np.hypot(X - cx, Z - cz)
            pad = s['pad']
            near = r < pad['r'] + pad['blend'] + 1
            if not near.any():
                continue
            w = np.clip((r - pad['r']) / pad['blend'], 0, 1)
            w = w * w * (3 - 2 * w)
            h[near] = (G * (1 - w) + h * w)[near]
        elif s['kind'] == 'mushroom':
            cx, cz = s['at']
            blockm |= (np.hypot(X - cx, Z - cz) < 5.5).astype(np.uint8)
        else:
            poly = footprint(s, features)
            d = poly_dist(X, Z, poly)
            pad = s['pad']
            near = d < pad['pad'] + pad['blend'] + 1
            if not near.any():
                continue
            w = np.clip((d - pad['pad']) / pad['blend'], 0, 1)
            w = w * w * (3 - 2 * w)
            h[near] = (G * (1 - w) + h * w)[near]
            blockm |= ((d < 0.3) & near).astype(np.uint8)
    return blockm
