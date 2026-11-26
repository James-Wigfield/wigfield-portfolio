"""Bake the sun's shadows and the ambient occlusion of a v2 landscape into a 1 m grid (the runtime lights live; this
is only where the light can't reach).

    python shade.py <work> [--az 320] [--el 42] [--sites peron-sites.json]

Reads grid2.npz (ground h), plants.npz (scatter.py), features.json + the sites spec. Writes <work>/shade.npz:
  sun     float32  0-1, the sun's visibility at the GROUND (under a bush it's dark: the bush covers it)
  ao      float32  0-1, sky visibility at the ground (multi-scale height-field occlusion)
  top     float32  0-1, the sun's visibility at the TOP of whatever stands there (a bush, a roof): plants and
                   roofs sample this, so a shrub isn't shadowed by itself
  canopy  float32  the height of the top surface (ground, plant crowns, roofs)
and data.json gets "sun": { azimuth, elevation } (export_data.py copies it).

Shadows: march toward the sun over the canopy height field, 0.5 m steps out to 45 m, with a penumbra that widens
with distance (soft, like a 0.5 deg sun plus the leaf scatter). Plants are ellipsoid crowns (their prototype size x
scale); sites are their footprints / pits / lockers at their real heights.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from scipy import ndimage as ndi
from scipy.ndimage import map_coordinates

sys.path.insert(0, os.path.dirname(__file__))
import frame as F
import sites as SITES

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--az', type=float, default=320)
ap.add_argument('--el', type=float, default=42)
ap.add_argument('--sites', default=None)
a = ap.parse_args()
W = a.work
fr = F.load(W)
g = np.load(os.path.join(W, 'grid2.npz'))
h = g['h'].astype(np.float32)
R, C = h.shape
z0 = -fr.y1
canopy = h.copy()
cover = np.zeros_like(h)          # how solid the canopy is (1 = opaque: a roof; 0.8 = a dense bush)

# ---- plants: ellipsoid crowns
pp = os.path.join(W, 'plants.npz')
if os.path.exists(pp):
    P = np.load(pp)
    #            radius, height, crown base (fraction of height), opacity
    SHAPE = {0: (0.8, 1.0, 0.0, 0.85), 1: (0.8, 1.0, 0.0, 0.9), 2: (0.8, 1.0, 0.0, 0.85), 3: (1.3, 3.0, 0.45, 0.7),
             4: (0.35, 0.6, 0.0, 0.45), 5: (0.55, 0.85, 0.0, 0.35),
             6: (0.95, 0.55, 0.0, 1.0), 7: (0.85, 0.65, 0.0, 1.0), 8: (1.15, 0.45, 0.0, 1.0), 9: (0.75, 0.8, 0.0, 1.0)}
    for t, (rad0, hgt0, base0, op) in SHAPE.items():
        m = P['type'] == t
        xs, zs, ys, ss, sys_ = P['x'][m], P['z'][m], P['y'][m], P['s'][m], P['sy'][m]
        for x, z, y, s, sy in zip(xs, zs, ys, ss, sys_):
            r = rad0 * s
            H = hgt0 * s * sy
            c0 = int((x - r - fr.x0) / fr.cell)
            c1 = int((x + r - fr.x0) / fr.cell) + 1
            r0 = int((z - r - z0) / fr.cell)
            r1 = int((z + r - z0) / fr.cell) + 1
            if c1 < 0 or r1 < 0 or c0 >= C or r0 >= R:
                continue
            c0, r0, c1, r1 = max(c0, 0), max(r0, 0), min(c1, C), min(r1, R)
            cx = fr.x0 + (np.arange(c0, c1) + 0.5) * fr.cell
            cz = z0 + (np.arange(r0, r1) + 0.5) * fr.cell
            dd = np.hypot(cx[None, :] - x, cz[:, None] - z) / r
            inside = dd < 1
            top = y + H * np.sqrt(np.clip(1 - dd * dd, 0, 1)) * (1 - base0) + H * base0
            blk = canopy[r0:r1, c0:c1]
            canopy[r0:r1, c0:c1] = np.where(inside, np.maximum(blk, top), blk)
            cv = cover[r0:r1, c0:c1]
            cover[r0:r1, c0:c1] = np.where(inside, np.maximum(cv, op * np.clip(1.4 - dd, 0, 1)), cv)

# ---- sites: footprints at their roof heights, lockers, pedestals
features = json.load(open(os.path.join(W, 'features.json')))
X, Y = fr.xy()
Z = -Y
for s in SITES.load(a.sites):
    G = s['ground']
    if s['kind'] == 'panama':
        cx, cz = s['at']
        r = np.hypot(X - cx, Z - cz)
        Fl = G - s['pit']['floor']
        ped = r < (2.05 if s['restored'] else 1.7)
        canopy = np.where(ped, np.maximum(canopy, Fl + 0.95 + (1.2 if s.get('replica') else 0)), canopy)
        cover = np.where(ped, 1.0, cover)
        rx, rz = SITES.rear_dir(s)
        tx, tz = -rz, rx
        for side in (-1, 1):
            mx = cx + rx * (s['pit']['r_out'] + 1.7) + tx * 2.2 * side
            mz = cz + rz * (s['pit']['r_out'] + 1.7) + tz * 2.2 * side
            along = np.abs((X - mx) * tx + (Z - mz) * tz)
            acr = np.abs((X - mx) * rx + (Z - mz) * rz)
            box = (along < 1.3) & (acr < 0.75)
            canopy = np.where(box, np.maximum(canopy, G + 1.27), canopy)
            cover = np.where(box, 1.0, cover)
    elif s['kind'] == 'mushroom':
        cx, cz = s['at']
        rr_ = np.hypot(X - cx, Z - cz)
        canopy = np.where(rr_ < 4.8, np.maximum(canopy, 5.6), canopy)
        cover = np.where(rr_ < 4.8, 1.0, cover)
    elif s['kind'] in ('lookout_walkway', 'lookout_pad'):
        continue    # flat pads (the walkway's masts are too thin to matter at 1 m)
    else:
        poly = SITES.footprint(s, features)
        d = SITES.poly_dist(X, Z, poly)
        top = G + s['above'] + (0.22 if s['kind'] != 'op' else 0.3)
        inside = d < 0.2
        canopy = np.where(inside, np.maximum(canopy, top), canopy)
        cover = np.where(inside, 1.0, cover)

# ---- sun visibility by marching toward the sun over the canopy
az = math.radians(a.az)
el = math.radians(a.el)
tan_el = math.tan(el)
dcol = math.sin(az) / fr.cell        # cells per metre east
drow = -math.cos(az) / fr.cell       # rows per metre (north = up = fewer rows)
rr, cc = np.mgrid[0:R, 0:C].astype(np.float32)


def march(start):
    vis = np.ones((R, C), np.float32)
    t = 0.5
    while t <= 45:
        samp = map_coordinates(canopy, [rr + drow * t, cc + dcol * t], order=1, mode='nearest')
        cov = map_coordinates(cover, [rr + drow * t, cc + dcol * t], order=1, mode='nearest')
        ray = start + t * tan_el
        pen = 0.08 + 0.045 * t                  # penumbra width (m) grows with distance
        occl = np.clip((samp - ray) / pen + 0.5, 0, 1)
        # terrain (cover 0) is opaque; plants let a little through
        opa = np.where(cov > 0, np.clip(cov, 0, 1), 1.0)
        vis = np.minimum(vis, 1 - occl * opa)
        t += 0.5 if t < 12 else 1.0
    return vis


sun = march(h + 0.05)
top = march(canopy + 0.05)

# ---- ambient occlusion at the ground (and a little for the tops)
ao = np.ones((R, C), np.float32)
for sigma, w in ((1.0, 0.45), (3.0, 0.35), (8.0, 0.25), (20.0, 0.15)):
    blur = ndi.gaussian_filter(canopy, sigma)
    ao -= w * np.clip((blur - h) / (sigma * 1.2), 0, 1)
ao = np.clip(ao, 0.15, 1)
under = canopy - h > 0.15
ao = np.where(under, ao * (1 - 0.5 * cover), ao)

np.savez_compressed(os.path.join(W, 'shade.npz'), sun=sun.astype(np.float32), ao=ao.astype(np.float32),
                    top=top.astype(np.float32), canopy=canopy.astype(np.float32), az=a.az, el=a.el)
print('shade: sun mean', float(sun.mean()), 'top mean', float(top.mean()), 'ao mean', float(ao.mean()))
from PIL import Image  # noqa: E402

inb = fr.in_box(X, Y, 0)
rows = np.where(inb.any(1))[0]
cols = np.where(inb.any(0))[0]
sl = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))
Image.fromarray((np.dstack([sun[sl], ao[sl], top[sl]]) * 255).astype(np.uint8)).save(os.path.join(W, 'shade-preview.png'))
