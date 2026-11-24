"""Paint the landscape's base colour (albedo) at 0.5 m from grid.npz + grid.json.

    python albedo.py <work dir> [--res 0.5]

Low frequencies come from Sentinel-2 (graded); the detail is procedural per class (scrub, sand, limestone, beach,
seabed); roads, tracks, paths, car parks and beaches are drawn crisp from the OSM vectors. Writes albedo.png
(row 0 = north edge, same extent as grid.npz), mask-scrub.png (shrub density, 0-255) and land-hr.png.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--res', type=float, default=0.5)
a = ap.parse_args()
W = a.work
g = np.load(os.path.join(W, 'grid.npz'))
meta = json.load(open(os.path.join(W, 'grid.json')))
step = meta['step']
k = int(round(step / a.res))           # upsample factor
R, C = meta['rows'] * k, meta['cols'] * k
sx, sy = meta['size']
rng = np.random.default_rng(7)


def up(arr, order=1):
    return ndi.zoom(arr.astype(np.float32), k, order=order, mode='nearest')[:R, :C]


def noise(scale_px, octaves=3, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((R, C), np.float32)
    amp, tot = 1.0, 0.0
    s = scale_px
    for _ in range(octaves):
        small = r.standard_normal((max(2, int(R / s)) + 2, max(2, int(C / s)) + 2)).astype(np.float32)
        z = ndi.zoom(small, (R / (small.shape[0] - 2), C / (small.shape[1] - 2)), order=3)[:R, :C]
        out += amp * z
        tot += amp
        amp *= 0.5
        s /= 2.2
    out /= tot
    return out / (out.std() + 1e-6)


def to_px(p):
    return ((p[0] + sx / 2) / a.res, (sy / 2 - p[1]) / a.res)


# Land at high res, smooth coast.
land_f = ndi.gaussian_filter(up(g['land']), k * 0.6)
land = land_f > 0.5
h = up(g['h'])
dist_land = ndi.distance_transform_edt(land) * a.res
dist_sea = ndi.distance_transform_edt(~land) * a.res
cls = up(g['cls'], order=0).astype(np.uint8)
rocky = up(g['rocky']) > 0.5

# Sentinel-2, graded: TCI is dark; lift water and land differently, soft shoulder at the top.
s2 = np.stack([up(g['rgb'][..., i], order=3) for i in range(3)], -1) / 255.0
s2 = ndi.gaussian_filter(s2, (k * 0.5, k * 0.5, 0))


def grade(x, gain):
    y = x * gain
    return 1 - np.exp(-y * 1.15)


# near the shore the 10 m pixels mix sand and water (stair-steps): refill the first 30 m from further out
far = (~land) & (dist_sea > 30) & (dist_sea < 90)
for i in range(3):
    pass
sig = 18 / a.res
num = np.stack([ndi.gaussian_filter(np.where(far, s2[..., i], 0), sig) for i in range(3)], -1)
den = ndi.gaussian_filter(far.astype(np.float32), sig)[..., None]
near_fill = num / np.maximum(den, 1e-4)
wnear = np.clip(1 - (dist_sea - 18) / 22, 0, 1)[..., None] * (den > 0.02)
s2 = np.where(land[..., None], s2, s2 * (1 - wnear) + near_fill * wnear)
water = grade(s2, 2.4)
wm = water.mean(axis=2, keepdims=True)
water = np.clip(wm + (water - wm) * 1.35, 0, 1)
lands2 = grade(s2, 1.35)

srgb = lambda c: np.array(c, np.float32) / 255.0
n_big = noise(60 / a.res, 3, 1)
n_mid = noise(8 / a.res, 3, 2)
n_fine = noise(1.5 / a.res, 2, 3)

col = np.zeros((R, C, 3), np.float32)

rocky_near = ndi.binary_dilation(rocky, iterations=int(14 / a.res))
# --- seabed: satellite colour + fine ripples; a pale wet-sand band along beaches
sea_col = water * (1 + 0.05 * n_mid[..., None] + 0.03 * n_fine[..., None])
shore_band = (np.clip(1 - dist_sea / 16.0, 0, 1) * ~rocky_near)[..., None]
sea_col = sea_col * (1 - 0.4 * shore_band) + srgb([110, 200, 192]) * 0.4 * shore_band
# rocky shores: a dark reef-platform fringe and a broken line of foam
reef_band = (np.clip(1 - dist_sea / 10.0, 0, 1) * rocky_near)[..., None]
sea_col = sea_col * (1 - 0.45 * reef_band) + srgb([70, 82, 70]) * 0.45 * reef_band
foam = (np.clip(1 - np.abs(dist_sea - 1.5) / 1.6, 0, 1) * rocky_near * np.clip(0.4 + 0.8 * noise(3 / a.res, 2, 9), 0, 1))[..., None]
sea_col = sea_col * (1 - 0.7 * foam) + 0.95 * 0.7 * foam
col = np.where(land[..., None], col, sea_col)

# --- land classes
scrub_dark = srgb([62, 72, 44])
scrub_light = srgb([112, 118, 72])
sand = srgb([214, 202, 168])
sand_grey = srgb([188, 182, 160])
lime = srgb([198, 192, 176])
lime_dark = srgb([150, 146, 132])
beach = srgb([234, 224, 196])

t = np.clip(0.5 + 0.35 * n_mid + 0.15 * n_fine, 0, 1)[..., None]
scrub = scrub_dark * (1 - t) + scrub_light * t
sandc = sand * (1 - 0.35 * np.clip(0.5 + 0.5 * n_big, 0, 1)[..., None]) + sand_grey * 0.35 * np.clip(0.5 + 0.5 * n_big, 0, 1)[..., None]
sandc = sandc * (1 + 0.04 * n_fine[..., None])
# mix: satellite says how vegetated each 10 m patch is; detail decides where inside it
veg = np.clip((0.72 - lands2.mean(axis=2)) / 0.34, 0, 1)            # 1 = dark heath
veg = np.clip(veg + 0.35 * n_mid * (veg * (1 - veg) * 4) + 0.1 * n_fine, 0, 1)
vegm = np.clip((veg - 0.35) / 0.25, 0, 1)[..., None]
land_col = sandc * (1 - vegm) + scrub * vegm
# tint towards the satellite hue a little so patches keep their real character
land_col = land_col * 0.8 + lands2 * 0.2
# limestone where steep or on the rocky shore (not beaches)
gy, gx = np.gradient(h, a.res)
slope = np.hypot(gx, gy)
rock = np.clip((slope - 0.35) / 0.4, 0, 1)
rock = np.maximum(rock, np.clip(1 - (dist_land - 6) / 5.0, 0, 1) * rocky)
rock = np.clip(rock + 0.25 * n_fine * rock, 0, 1)[..., None]
limec = lime * (1 - 0.4 * np.clip(0.5 + 0.5 * n_mid, 0, 1)[..., None]) + lime_dark * 0.4 * np.clip(0.5 + 0.5 * n_mid, 0, 1)[..., None]
land_col = land_col * (1 - rock) + limec * rock
col = np.where(land[..., None], land_col, col)

# --- vectors (drawn at 2x then downsampled for anti-aliasing)
ss = 2
vec = Image.new('RGBA', (C * ss, R * ss), (0, 0, 0, 0))
d = ImageDraw.Draw(vec)
f = meta['features']
P = lambda pts: [(x * ss, y * ss) for x, y in (to_px(p) for p in pts)]
for b in f['beaches']:
    d.polygon(P(b['pts']), fill=(240, 230, 204, 255))
vec_beach = np.array(vec)[..., 3]
vec = Image.new('RGBA', (C * ss, R * ss), (0, 0, 0, 0))
d = ImageDraw.Draw(vec)
for pk in f['parking']:
    d.polygon(P(pk['pts']), fill=(104, 104, 102, 255))
for p in f['paths']:
    w = max(1, int(p['width'] / a.res * ss))
    c = (214, 204, 178, 255) if p['kind'] != 'track' else (205, 192, 160, 255)
    d.line(P(p['pts']), fill=c, width=w, joint='curve')
for r in sorted(f['roads'], key=lambda r: r['width']):
    w = max(1, int(r['width'] / a.res * ss))
    d.line(P(r['pts']), fill=(178, 172, 160, 255), width=w + int(1.2 / a.res * ss), joint='curve')  # gravel shoulder
for r in sorted(f['roads'], key=lambda r: r['width']):
    w = max(1, int(r['width'] / a.res * ss))
    d.line(P(r['pts']), fill=(74, 74, 76, 255), width=w, joint='curve')
vec = vec.resize((C, R), Image.LANCZOS)
v = np.asarray(vec).astype(np.float32) / 255.0
va = v[..., 3:4] * land[..., None]
vcol = v[..., :3] * (1 + 0.05 * n_fine[..., None])
col = col * (1 - va) + vcol * va
vb = (np.asarray(Image.fromarray(vec_beach).resize((C, R), Image.LANCZOS)).astype(np.float32) / 255.0)
vb = (vb * land * (1 - v[..., 3]))[..., None]
col = col * (1 - vb) + (beach * (1 + 0.03 * n_fine[..., None])) * vb

col = np.clip(col, 0, 1)
Image.fromarray((col * 255).astype(np.uint8)).save(os.path.join(W, 'albedo.png'))
# shrub density: vegetated land, not on vectors / beaches / rock
dens = vegm[..., 0] * (1 - va[..., 0]) * (1 - vb[..., 0]) * (1 - rock[..., 0]) * land
Image.fromarray((np.clip(dens, 0, 1) * 255).astype(np.uint8)).save(os.path.join(W, 'mask-scrub.png'))
Image.fromarray((land * 255).astype(np.uint8)).save(os.path.join(W, 'land-hr.png'))
Image.fromarray((col * 255).astype(np.uint8)).resize((C // 4, R // 4), Image.LANCZOS).save(os.path.join(W, 'albedo-small.png'))
print('albedo', C, 'x', R, 'at', a.res, 'm')
