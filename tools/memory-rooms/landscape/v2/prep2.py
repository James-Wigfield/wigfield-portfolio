"""The v2 grids every later step reads: final heights, ground materials, plant densities, the walk mask, the shore.

    python prep2.py <work> [--s2 2026-10-29]

Reads frame.json, src.npz + src/ga5m.tif (sources.py), s2/<date>.npz (s2_bands.py), src/osm.json. Writes
<work>/grid2.npz (1 m cells on the frame, row 0 = north) and features.json (OSM features in local metres) plus
previews in <work>/prep2/.

grid2.npz
  h        float32  ground / sea-floor height (m AHD, sea floor negative). Land: the GA 5 m LiDAR, bicubic. Sea:
                    DoT's survey depth smoothed 3 m; beaches get a 1:16 foreshore, rocky coasts a wave-cut platform
                    just under the surface where the survey is shallow.
  shore    float32  signed distance to the OSM coastline (m, + on land, - at sea)
  rocky    uint8    1 = a cliff / rock coast (the land within 4 m of the coast stands 2 m+), by the nearest coast
  splat    uint8 (H, W, 4)  ground weights summing to 255: sand, limestone, heath soil, weed (seagrass / dark reef)
  veg      uint8 (H, W, 3)  densities 0-255: low heath, tall shrub, dune grass
  block    uint8    walk blockers known here: 1 slope > 32 deg, 2 fenced (the camp school), 4 a bunker footprint
  ndvi     float32  Sentinel-2 NDVI (10 m, bilinear)
"""
import argparse
import json
import os
import sys

import numpy as np
import rasterio
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.ndimage import map_coordinates

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--s2', default='2026-10-29')
ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args()
W = a.work
fr = F.load(W)
rng = np.random.default_rng(a.seed)
src = np.load(os.path.join(W, 'src.npz'))
OUT = os.path.join(W, 'prep2')
os.makedirs(OUT, exist_ok=True)
X, Y = fr.xy()
LON, LAT = fr.to_lnglat(X, Y)
R, C = fr.rows, fr.cols
land = src['land'].astype(bool)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(scales, weights=None, seed=0):
    g = np.random.default_rng(a.seed + seed)
    out = np.zeros((R, C), np.float32)
    weights = weights or [1.0] * len(scales)
    for s, w in zip(scales, weights):
        n = ndi.gaussian_filter(g.standard_normal((R, C)).astype(np.float32), s)
        out += w * n / (n.std() + 1e-6)
    return out / (np.sqrt(sum(w * w for w in weights)))


# ------------------------------------------------------------------ land heights: GA 5 m, bicubic
with rasterio.open(os.path.join(W, 'src', 'ga5m.tif')) as d:
    dem = d.read(1).astype(np.float32)
    t = d.transform
pc = (LON - t.c) / t.a - 0.5
pr = (LAT - t.f) / t.e - 0.5
h_land = map_coordinates(dem, [pr, pc], order=3, mode='nearest').astype(np.float32)
h_land = np.maximum(h_land, 0)

d_in = ndi.distance_transform_edt(land) * fr.cell
d_out = ndi.distance_transform_edt(~land) * fr.cell
shore = np.where(land, d_in, -d_out).astype(np.float32)
coast = land & (d_in <= 1.0)

# ------------------------------------------------------------------ Sentinel-2 on the 1 m grid
s2 = np.load(os.path.join(W, 's2', f'{a.s2}.npz'))
step = float(s2['step'])


def up(b):
    rr = (np.arange(R) + 0.5) * fr.cell / step - 0.5
    cc = (np.arange(C) + 0.5) * fr.cell / step - 0.5
    return map_coordinates(b.astype(np.float32), np.meshgrid(rr, cc, indexing='ij'), order=1, mode='nearest')


red, green, blue, nir = (up(s2[k]) for k in ('red', 'green', 'blue', 'nir'))
ndvi = (nir - red) / (nir + red + 1e-6)
bright = (red + green + blue) / 3

# ------------------------------------------------------------------ the dark sea floor (reef / seagrass)
depth = np.nan_to_num(src['depth'], nan=6.0)
dsm = ndi.gaussian_filter(depth, 3.0)                    # the ramp is banded: lose the terraces
# Sentinel-2's brightness against what that depth would give (log brightness falls ~linearly with depth)
sea = ~land
bt = np.log(np.maximum((green + blue) / 2, 1e-3))
dd = np.clip(dsm, 0.2, 12)
m_fit = sea & (d_out > 15)
A = np.vstack([dd[m_fit], np.ones(m_fit.sum())]).T
coef, *_ = np.linalg.lstsq(A, bt[m_fit], rcond=None)
resid = bt - (coef[0] * dd + coef[1])
dark = smoothstep(-0.05, -0.35, resid)

# ------------------------------------------------------------------ cliffs vs beaches, by the nearest coast cell
# a cliff: the land within 4 m of the water already stands 2 m+ (dunes behind a beach start further back)
hmax4 = ndi.maximum_filter(np.where(land, h_land, 0), size=9)
# or a low rock shore: dark reef right off it (within 12 m) and no bright beach on it
dark12 = ndi.maximum_filter(np.where(sea & (d_out < 12), dark, 0), size=25)
sandy = ndi.uniform_filter(np.where(land & (d_in < 6), bright, 0), 9) / np.maximum(
    ndi.uniform_filter((land & (d_in < 6)).astype(np.float32), 9), 1e-3)
rock_c = ((hmax4 >= 2.0) | ((dark12 > 0.6) & (sandy < np.percentile(sandy[coast], 40)))).astype(np.float32)
num = ndi.gaussian_filter(np.where(coast, rock_c, 0), 5)
den = ndi.gaussian_filter(coast.astype(np.float32), 5)
rock_c = np.where(coast, (num / np.maximum(den, 1e-6)) > 0.5, False)
_, (ri, ci) = ndi.distance_transform_edt(~coast, return_indices=True)
rocky = rock_c[ri, ci]

# ------------------------------------------------------------------ the sea floor
z_sea = -dsm
# beaches: a 1:16 foreshore into the survey (never deeper than the survey further out)
fore = -(0.05 + d_out / 16.0)
z_sea = np.where(~rocky, np.maximum(z_sea, fore), z_sea)
# rocky coasts: where the survey is shallow near the cliff, a wave-cut platform just under the surface
plat_n = fbm([1.5, 6], [0.4, 1.0], seed=11)
platform = (~land) & rocky & (dsm < 0.9) & (d_out < 45) & (dark > 0.3)   # rock, not a shallow sand flat
platform = ndi.binary_opening(platform, iterations=1)
z_plat = -0.18 + 0.06 * plat_n
z_sea = np.where(platform, np.maximum(z_sea, z_plat), z_sea)
# and the cliff foot itself: no deeper than 0.4 m + 0.9 x the distance out (a notch, not a hole)
z_sea = np.maximum(z_sea, -(0.4 + 0.9 * d_out))
z_sea = np.minimum(z_sea, -0.04)

h_l = np.maximum(h_land, 0.2 + np.minimum(d_in, 3) * 0.05)
h = np.where(land, h_l, z_sea).astype(np.float32)

gy, gx = np.gradient(h, fr.cell)
slope = np.degrees(np.arctan(np.hypot(gx, gy)))

# ------------------------------------------------------------------ OSM features in local metres
osm = json.load(open(os.path.join(W, 'src', 'osm.json')))['elements']
nodes = {e['id']: e for e in osm if e['type'] == 'node'}


def loc(ids):
    pts = [nodes[n] for n in ids if n in nodes]
    x, y = fr.to_local([p['lon'] for p in pts], [p['lat'] for p in pts])
    return [[round(float(u), 2), round(float(v), 2)] for u, v in zip(x, y)]


feat = {'paths': [], 'roads': [], 'parking': [], 'bunkers': [], 'guns': [], 'viewpoints': [], 'rocks': [],
        'camp': None, 'buildings_left_out': 0}
PATH_W = {'paved': 2.0, 'sand': 1.2, None: 1.3}
for e in osm:
    tg = e.get('tags', {})
    if e['type'] == 'way':
        hw = tg.get('highway')
        if hw in ('path', 'footway', 'track', 'steps', 'cycleway', 'bridleway'):
            surf = tg.get('surface')
            feat['paths'].append({'id': e['id'], 'kind': hw, 'surface': surf, 'width': PATH_W.get(surf, 1.3),
                                  'pts': loc(e['nodes'])})
        elif hw in ('unclassified', 'service', 'residential', 'tertiary'):
            feat['roads'].append({'id': e['id'], 'kind': hw, 'name': tg.get('name'), 'width': 6.0 if hw != 'service' else 4.5,
                                  'pts': loc(e['nodes'])})
        elif tg.get('amenity') == 'parking':
            feat['parking'].append({'id': e['id'], 'kind': tg.get('parking'), 'pts': loc(e['nodes'])})
        elif tg.get('military') == 'bunker':
            feat['bunkers'].append({'id': e['id'], 'name': tg.get('name'), 'type': tg.get('bunker_type'),
                                    'pts': loc(e['nodes']), 'tags': tg})
        elif e['id'] == 1072146501:
            feat['camp'] = {'id': e['id'], 'name': tg.get('name'), 'pts': loc(e['nodes'])}
        elif 'building' in tg:
            feat['buildings_left_out'] += 1
    elif e['type'] == 'node' and tg:
        p = loc([e['id']])[0]
        if tg.get('historic') == 'cannon':
            feat['guns'].append({'id': e['id'], 'name': tg.get('name'), 'description': tg.get('description'), 'at': p})
        elif tg.get('tourism') == 'viewpoint':
            feat['viewpoints'].append({'id': e['id'], 'name': tg.get('name'), 'description': tg.get('description'), 'at': p})
        elif e['id'] == 7497184690:
            feat['rocks'].append({'id': e['id'], 'name': tg.get('name'), 'description': tg.get('description'), 'at': p})


def raster(polys=(), lines=(), width=1.0, fill=1):
    img = Image.new('L', (C, R), 0)
    dr = ImageDraw.Draw(img)
    for pts in polys:
        c_, r_ = fr.to_px(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
        dr.polygon(list(zip(c_.tolist(), r_.tolist())), fill=fill)
    for pts in lines:
        c_, r_ = fr.to_px(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
        dr.line(list(zip(c_.tolist(), r_.tolist())), fill=fill, width=max(1, int(round(width / fr.cell))))
    return np.asarray(img) > 0


# distance to anything built people walk or drive on (paths, roads, parking)
built_line = raster(lines=[p['pts'] for p in feat['paths']]) | raster(lines=[r['pts'] for r in feat['roads']])
built_area = raster(polys=[p['pts'] for p in feat['parking']])
d_built = ndi.distance_transform_edt(~(built_line | built_area)) * fr.cell
bunker = raster(polys=[b['pts'] for b in feat['bunkers']])
# ------------------------------------------------------------------ the built sites (peron-sites.json): pads, gun pits
import sites as SITES  # noqa: E402

site_list = SITES.load()
site_block = SITES.apply_ground(h, X, -Y, site_list, feat)
gy, gx = np.gradient(h, fr.cell)
slope = np.degrees(np.arctan(np.hypot(gx, gy)))
for s_ in site_list:
    if s_['kind'] == 'panama':
        bunker |= np.hypot(X - s_['at'][0], -Y - s_['at'][1]) < s_['pit']['r_out'] + 0.2   # heath up to the lip
    elif s_['kind'] in ('lookout_walkway', 'lookout_pad'):
        bunker |= np.hypot(X - s_['at'][0], -Y - s_['at'][1]) < s_['pad']['r']
d_bunker = ndi.distance_transform_edt(~bunker) * fr.cell
camp = raster(polys=[feat['camp']['pts']]) if feat['camp'] else np.zeros((R, C), bool)

# ------------------------------------------------------------------ ground materials
veg = smoothstep(0.22, 0.55, ndvi)
n_mid = fbm([4, 12], [0.6, 1.0], seed=21)
# beaches: bright, bare, near a sandy coast; dunes behind them where the plants thin out
beach = land & ~rocky & (d_in < 45) & (ndvi < 0.25 + 0.05 * n_mid)
sand_w = np.where(land, np.clip(1.2 - 2.2 * veg, 0, 1), 0)
sand_w = np.maximum(sand_w, beach.astype(np.float32))
# round the battery's pits and bunkers the ground is trodden pale sand and grit (photos)
sand_w = np.maximum(sand_w, land * smoothstep(3.5, 0.8, d_bunker) * 0.85)
rock_w = np.zeros((R, C), np.float32)
rock_w = np.maximum(rock_w, (land & rocky & (d_in < 7 + 3 * n_mid)).astype(np.float32))
rock_w = np.maximum(rock_w, land * smoothstep(28, 42, slope))
rock_w = np.maximum(rock_w, (land & (veg < 0.35) & (slope > 14) & (n_mid > 0.4)).astype(np.float32) * 0.8)
soil_w = np.where(land, veg, 0) * (1 - 0.6 * rock_w)
# under water: sand vs dark (seagrass / reef), from `dark` above
weed_w = np.where(sea & ~platform, dark, 0)
rock_w = np.where(sea, np.maximum(platform.astype(np.float32), dark * rocky * smoothstep(80, 10, d_out)), rock_w)
weed_w = weed_w * (1 - rock_w)
sand_w = np.where(sea, 1 - np.maximum(weed_w, rock_w), sand_w)
Wt = np.stack([sand_w, rock_w, soil_w, weed_w], -1)
Wt = ndi.gaussian_filter(Wt, (1.0, 1.0, 0))
# under water the reef / seagrass edges come from 10 m satellite pixels: soften them more (no blocky patches)
Wt = np.where(sea[..., None], ndi.gaussian_filter(Wt, (2.5, 2.5, 0)), Wt)
Wt = Wt / np.maximum(Wt.sum(-1, keepdims=True), 1e-6)
splat = np.round(Wt * 255).astype(np.uint8)

# ------------------------------------------------------------------ plant densities
clump = fbm([2.5, 7, 18], [0.5, 1.0, 0.7], seed=31)
clear_ = smoothstep(0.6, 1.6, d_built) * smoothstep(1.0, 3.0, d_bunker)
heath = land & ~beach
heath_d = np.sqrt(veg) * smoothstep(-1.5, -0.1, clump) * clear_ * (1 - rock_w) * smoothstep(42, 30, slope)
heath_d = np.where(heath, heath_d, 0)
loc_mean = ndi.uniform_filter(h, 41)
hollow = smoothstep(0.3, -1.5, h - loc_mean)                   # sheltered: lower than around it
shrub_d = smoothstep(0.5, 0.72, ndvi) * (0.35 + 0.65 * hollow) * smoothstep(0.2, 1.2, clump) * clear_
shrub_d = np.where(heath, shrub_d * (1 - rock_w), 0) * smoothstep(3, 12, d_in)
grass_d = land & ~rocky & (d_in > 4) & (d_in < 55)
grass_d = grass_d * smoothstep(0.05, 0.22, ndvi) * smoothstep(0.5, 0.15, veg + 0.1 * clump) * clear_
grass_d = np.maximum(grass_d, beach * smoothstep(8, 18, d_in) * smoothstep(-0.2, 0.8, clump) * 0.5 * clear_)
# the camp school: bush, no buildings (James, checkpoint 1)
heath_d = np.where(camp, np.maximum(heath_d, 0.55 * smoothstep(-1.0, 0.2, clump)), heath_d)
shrub_d = np.where(camp, np.maximum(shrub_d, 0.25 * smoothstep(0.2, 1.0, clump)), shrub_d)
vegd = np.round(np.stack([heath_d, shrub_d, grass_d], -1).clip(0, 1) * 255).astype(np.uint8)

# ------------------------------------------------------------------ walk blockers known now
block = np.zeros((R, C), np.uint8)
block |= (land & (slope > 32)).astype(np.uint8) * 1
fence = camp & ~raster(lines=[r['pts'] for r in feat['roads']], width=8)
block |= fence.astype(np.uint8) * 2
block |= site_block * 4                               # pedestals and building footprints (the pits are walkable)

np.savez_compressed(os.path.join(W, 'grid2.npz'), h=h, shore=shore, rocky=rocky.astype(np.uint8), splat=splat,
                    veg=vegd, block=block, ndvi=ndvi.astype(np.float32), platform=platform.astype(np.uint8),
                    d_built=np.minimum(d_built, 250).astype(np.float16), d_bunker=np.minimum(d_bunker, 250).astype(np.float16),
                    slope=slope.astype(np.float32))
feat['frame'] = fr.to_json()
feat['sea_floor_fit'] = {'log_brightness_per_m': float(coef[0]), 'at_0': float(coef[1])}
json.dump(feat, open(os.path.join(W, 'features.json'), 'w'))

# ------------------------------------------------------------------ previews
inb = fr.in_box(X, Y, 20)
rows = np.where(inb.any(1))[0]
cols = np.where(inb.any(0))[0]
sl = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))
pal = np.array([[222, 205, 160], [168, 160, 140], [92, 84, 60], [40, 70, 55]], np.float32)
img = (Wt[sl] @ pal)
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'splat.png'))
Image.fromarray(vegd[sl]).save(os.path.join(OUT, 'veg.png'))
Image.fromarray((np.stack([rocky[sl], platform[sl], (block[sl] > 0)], -1) * 255).astype(np.uint8)).save(
    os.path.join(OUT, 'rocky-platform-block.png'))
print('heights', float(h.min()), float(h.max()), 'rocky coast frac', float(rock_c[coast].mean()),
      'platform cells', int(platform.sum()), 'sea fit', coef.round(3).tolist())
print('paths', len(feat['paths']), 'roads', len(feat['roads']), 'parking', len(feat['parking']), 'bunkers',
      len(feat['bunkers']), 'guns', len(feat['guns']), 'viewpoints', len(feat['viewpoints']))
