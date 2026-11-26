"""Place the plants of a v2 landscape: every shrub, tussock and dead bush as an instance on the ground.

    python scatter.py <work> [--box x0,z0,x1,z1] [--seed 3]

Reads grid2.npz (densities, heights, slope, walk blockers) and features.json. Writes <work>/plants.npz:
  type  uint8    0 olearia mound (grey-green), 1 scaevola mound (bright green), 2 acacia mound (dark olive),
                 3 tall shrub (2-4.5 m), 4 spinifex tussock (dune grass), 5 dead twiggy bush,
                 6-9 limestone boulders a-d (cliff feet from coast.json, platforms, heath outcrops)
  x, z  float32  world metres (x east, z south)
  y     float32  ground height under it (the lowest of its footprint, so it never floats), sunk 5 cm
  rot   float32  radians about +y
  s     float32  scale (1 = the prototype's size: mound 1.6 m wide x 1.0 m tall; tall shrub 3 m; tussock 0.8 m)
  sy    float32  extra vertical scale (squat or tall mounds)
  tint  uint8    0-255 colour variation
and plants-preview.png. --box limits it to a part (the vertical slice), world x / z.

Spacing comes from a jittered grid whose cells are kept by the density (low heath clumps into mounds that touch;
gaps where the aerials show sand). Species follow slow noise patches and the coast: olearia and scaevola on the
exposed coastal side, acacia in hollows and inland, spinifex on the foredunes, a few dead grey bushes everywhere
(the photos show plenty).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--box', default=None)
ap.add_argument('--seed', type=int, default=3)
a = ap.parse_args()
W = a.work
fr = F.load(W)
g = np.load(os.path.join(W, 'grid2.npz'))
rng = np.random.default_rng(a.seed)
h = g['h']
veg = g['veg'].astype(np.float32) / 255
slope = g['slope']
block = g['block']
shore = g['shore']
R, C = h.shape
z0 = -fr.y1


def sample(arr, x, z, order=0):
    c = np.clip(((x - fr.x0) / fr.cell).astype(int), 0, C - 1)
    r = np.clip(((z - z0) / fr.cell).astype(int), 0, R - 1)
    return arr[r, c]


def hmin(x, z, rad):
    out = sample(h, x, z)
    for dx, dz in ((rad, 0), (-rad, 0), (0, rad), (0, -rad), (0.7 * rad, 0.7 * rad), (-0.7 * rad, -0.7 * rad),
                   (0.7 * rad, -0.7 * rad), (-0.7 * rad, 0.7 * rad)):
        out = np.minimum(out, sample(h, x + dx, z + dz))
    return out


def noise_field(sigma, seed):
    n = ndi.gaussian_filter(np.random.default_rng(seed).standard_normal((R, C)).astype(np.float32), sigma)
    return n / (n.std() + 1e-6)


species_a = noise_field(3.5, 101) + 0.6 * noise_field(1.2, 104)   # olearia vs scaevola: small mixed patches
species_b = noise_field(5, 102) + 0.5 * noise_field(1.5, 105)     # acacia
deadn = noise_field(2.5, 103)
d_built = g['d_built'].astype(np.float32)
d_bunker = g['d_bunker'].astype(np.float32)

# the area to fill
X0, Z0, X1, Z1 = (fr.x0, z0, fr.x0 + C * fr.cell, z0 + R * fr.cell)
if a.box:
    X0, Z0, X1, Z1 = (float(v) for v in a.box.split(','))
X0, X1 = max(X0, fr.x0), min(X1, fr.x0 + C * fr.cell)
Z0, Z1 = max(Z0, z0), min(Z1, z0 + R * fr.cell)
out = {k: [] for k in ('type', 'x', 'z', 'y', 'rot', 's', 'sy', 'tint')}


def emit(t, x, z, s, sy, rad):
    # the whole footprint stays off the paths / roads (1.1 m from their centre lines); crowns may brush the sites
    clear = (sample(d_built, x, z) > 1.1 + rad * s) & (sample(d_bunker, x, z) > 0.4 + rad * s * 0.7)
    x, z, s, sy = x[clear], z[clear], s[clear], sy[clear]
    n = len(x)
    if not n:
        return
    out['type'].append(np.full(n, t, np.uint8))
    out['x'].append(x.astype(np.float32))
    out['z'].append(z.astype(np.float32))
    out['y'].append((hmin(x, z, rad) - 0.05).astype(np.float32))
    out['rot'].append(rng.uniform(0, 2 * np.pi, n).astype(np.float32))
    out['s'].append(s.astype(np.float32))
    out['sy'].append(sy.astype(np.float32))
    out['tint'].append(rng.integers(0, 256, n).astype(np.uint8))


def jitter_grid(step):
    xs = np.arange(X0 + step / 2, X1, step)
    zs = np.arange(Z0 + step / 2, Z1, step)
    gx, gz = np.meshgrid(xs, zs)
    gx = gx.ravel() + rng.uniform(-0.45, 0.45, gx.size) * step
    gz = gz.ravel() + rng.uniform(-0.45, 0.45, gz.size) * step
    return gx, gz


ok_ground = (block & 0b110) == 0          # not fenced, not a bunker
# ---- low heath mounds: one per 1.35 m cell where the density keeps it
x, z = jitter_grid(1.35)
d = sample(veg[..., 0], x, z)
keep = (rng.random(x.size) < np.clip(d * 1.35, 0, 1) ** 0.8) & sample(ok_ground, x, z) & (sample(slope, x, z) < 38) & (sample(h, x, z) > 0.3)
x, z, d = x[keep], z[keep], d[keep]
sa = sample(species_a, x, z)
sb = sample(species_b, x, z)
coastal = np.clip(1 - sample(shore, x, z) / 80, 0, 1)
dead = (sample(deadn, x, z) > 1.3) | (rng.random(x.size) < 0.04)
acacia = (sb > 0.9 - 0.7 * (1 - coastal)) & ~dead
olearia = (sa > -0.2 + 0.4 * coastal) & ~acacia & ~dead
scaevola = ~olearia & ~acacia & ~dead
s = rng.uniform(0.85, 1.35, x.size) * (0.8 + 0.5 * d)
sy = rng.uniform(0.6, 1.15, x.size) * (0.75 + 0.45 * d)
# on the exposed coast the wind clips them low
sy = sy * (1 - 0.35 * coastal)
for t, m in ((0, olearia), (1, scaevola), (2, acacia), (5, dead)):
    emit(t, x[m], z[m], s[m] * (0.8 if t == 5 else 1), sy[m] * (0.9 if t == 5 else 1), 0.7)

# ---- tall shrubs (acacia / melaleuca thickets): sparser, in the hollows
x, z = jitter_grid(3.2)
d = sample(veg[..., 1], x, z)
keep = (rng.random(x.size) < d * 0.9) & sample(ok_ground, x, z) & (sample(slope, x, z) < 30) & (sample(h, x, z) > 0.5)
x, z = x[keep], z[keep]
emit(3, x, z, rng.uniform(0.7, 1.35, x.size), rng.uniform(0.8, 1.2, x.size), 1.2)

# ---- spinifex tussocks on the foredunes
x, z = jitter_grid(1.1)
d = sample(veg[..., 2], x, z)
keep = (rng.random(x.size) < d) & sample(ok_ground, x, z) & (sample(slope, x, z) < 34) & (sample(h, x, z) > 0.6)
x, z = x[keep], z[keep]
emit(4, x, z, rng.uniform(0.7, 1.4, x.size), rng.uniform(0.8, 1.2, x.size), 0.35)

# ---- limestone boulders (types 6-9: rock a-d): at the foot of the cliffs, on the platforms, outcrops in the heath
splat = g['splat'].astype(np.float32) / 255
rockw = splat[..., 1]
platform = g['platform'].astype(bool)
cp = os.path.join(W, 'coast.json')
bx, bz, bs = [], [], []
if os.path.exists(cp):
    for run in json.load(open(cp))['runs']:
        if not run['rocky']:
            continue
        for (x, z), (sx, sz), top in zip(run['pts'], run['sea'], run['top']):
            if not (X0 <= x <= X1 and Z0 <= z <= Z1) or rng.random() > 0.45:
                continue
            o = rng.uniform(0.6, 3.2)
            bx.append(x + sx * o + rng.normal(0, 0.4))
            bz.append(z + sz * o + rng.normal(0, 0.4))
            bs.append(rng.uniform(0.45, 1.6) * (0.7 + min(top, 8) / 12))
x, z = jitter_grid(5.0)
keep = (rng.random(x.size) < 0.25) & sample(platform, x, z)
bx += list(x[keep]); bz += list(z[keep]); bs += list(rng.uniform(0.3, 0.9, keep.sum()))
x, z = jitter_grid(3.5)
keep = (rng.random(x.size) < sample(rockw, x, z) * 0.3) & (sample(h, x, z) > 0.4) & sample(ok_ground, x, z)
bx += list(x[keep]); bz += list(z[keep]); bs += list(rng.uniform(0.35, 1.1, keep.sum()))
# limestone rocks lining the steep paved paths (the steps up to the observation post, photos 2020-2021)
feats = json.load(open(os.path.join(W, 'features.json')))
for p_ in feats['paths']:
    if p_.get('surface') != 'paved':
        continue
    P2 = np.array([(q[0], -q[1]) for q in p_['pts']], float)
    for a2, b2 in zip(P2[:-1], P2[1:]):
        L = float(np.hypot(*(b2 - a2)))
        if L < 1:
            continue
        ha, hb = float(sample(h, np.array([a2[0]]), np.array([a2[1]]))[0]), float(sample(h, np.array([b2[0]]), np.array([b2[1]]))[0])
        if abs(hb - ha) / L < 0.22:
            continue
        t_ = (b2 - a2) / L
        n_ = np.array([-t_[1], t_[0]])
        for k in np.arange(0.3, L, 0.75):
            for side in (-1, 1):
                q = a2 + t_ * k + n_ * side * (p_['width'] / 2 + 0.35 + rng.uniform(-0.05, 0.1))
                bx.append(q[0]); bz.append(q[1]); bs.append(rng.uniform(0.22, 0.38))
bx, bz, bs = np.array(bx), np.array(bz), np.array(bs)
if len(bx):
    kinds = rng.integers(6, 10, len(bx))
    clear = (sample(d_built, bx, bz) > 1.2 + bs * 0.8) | (bs < 0.4)   # the small edging stones may sit by the path
    for t in range(6, 10):
        m = (kinds == t) & clear
        n = int(m.sum())
        if not n:
            continue
        out['type'].append(np.full(n, t, np.uint8))
        out['x'].append(bx[m].astype(np.float32))
        out['z'].append(bz[m].astype(np.float32))
        # half buried: their bed sits under the lowest ground round them
        out['y'].append((hmin(bx[m], bz[m], 0.6 * bs[m]) - 0.18 * bs[m]).astype(np.float32))
        out['rot'].append(rng.uniform(0, 2 * np.pi, n).astype(np.float32))
        out['s'].append(bs[m].astype(np.float32))
        out['sy'].append(rng.uniform(0.7, 1.2, n).astype(np.float32))
        out['tint'].append(rng.integers(0, 256, n).astype(np.uint8))

# ---- the tuft on Mushroom Rock (photos: a cap of low heath and grass, cormorants on the bare rim)
import sites as SITES  # noqa: E402
for s_ in SITES.load():
    if s_['kind'] != 'mushroom':
        continue
    cx, cz = s_['at']
    if not (X0 <= cx <= X1 and Z0 <= cz <= Z1):
        continue
    k = 9
    ang = rng.uniform(0, 2 * np.pi, k)
    rad = np.sqrt(rng.uniform(0, 1, k)) * 2.4
    tx = cx + np.cos(ang) * rad - 0.4
    tz = cz + np.sin(ang) * rad * 0.85 - 0.4
    for t, sel in ((1, slice(0, 5)), (0, slice(5, 7)), (4, slice(7, 9))):
        n_ = len(tx[sel])
        out['type'].append(np.full(n_, t, np.uint8))
        out['x'].append(tx[sel].astype(np.float32))
        out['z'].append(tz[sel].astype(np.float32))
        out['y'].append(np.full(n_, 5.35, np.float32))
        out['rot'].append(rng.uniform(0, 2 * np.pi, n_).astype(np.float32))
        out['s'].append(rng.uniform(0.9, 1.4, n_).astype(np.float32))
        out['sy'].append(rng.uniform(0.35, 0.6, n_).astype(np.float32))
        out['tint'].append(rng.integers(0, 256, n_).astype(np.uint8))

res = {k: np.concatenate(v) if v else np.zeros(0) for k, v in out.items()}
np.savez_compressed(os.path.join(W, 'plants.npz'), **res)
counts = np.bincount(res['type'], minlength=10)
print('plants', len(res['x']), 'by type', counts.tolist())

# preview over the area
sc = 2
pw, ph = int((X1 - X0) * sc), int((Z1 - Z0) * sc)
img = Image.new('RGB', (pw, ph), (205, 190, 150))
from PIL import ImageDraw  # noqa: E402

dr = ImageDraw.Draw(img)
COL = [(150, 165, 140), (70, 150, 60), (70, 85, 45), (40, 70, 35), (200, 190, 110), (140, 130, 120)] + [(230, 225, 210)] * 4
RAD = [0.8, 0.8, 0.8, 1.6, 0.4, 0.6] + [0.9] * 4
order = np.argsort(res['type'] == 3)
for i in order:
    t = res['type'][i]
    cx = (res['x'][i] - X0) * sc
    cz = (res['z'][i] - Z0) * sc
    r = RAD[t] * res['s'][i] * sc
    dr.ellipse([cx - r, cz - r, cx + r, cz + r], fill=COL[t])
img.save(os.path.join(W, 'plants-preview.png'))
