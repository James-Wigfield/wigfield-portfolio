"""Turn the raw inputs (dem.f32 + dem.json, osm.json, s2-<date>.npz) into the grids the Blender build reads.

    python prep.py <work dir> --s2 2026-10-29 --crop c0,r0,c1,r1

Frame: local metres, x east, y north, origin = the DEM box centre (dem.json `centre`), 2 m grid.
Writes <work>/grid.npz:
  h      float32 (rows, cols)  ground / seabed height (m, ~AHD; sea floor negative)
  land   uint8                 1 = land (OSM coastline)
  rgb    uint8 (rows, cols, 3) Sentinel-2 colour, graded
  cls    uint8                 0 sea, 1 sand, 2 limestone, 3 scrub, 4 sparse scrub, 5 sealed road, 6 path/track, 7 parking,
                               8 building, 9 beach, 10 reef-shallow
and grid.json (frame, crop, origin lon/lat, features: buildings/bunkers/piers/viewpoints/cannons as local polygons)
plus previews (grid-*.png).
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--s2', default='2026-10-29')
ap.add_argument('--crop', default='300,330,1500,1450')
a = ap.parse_args()
W = a.work
meta = json.load(open(os.path.join(W, 'dem.json')))
cols, rows, step = meta['cols'], meta['rows'], meta['step']
lon0, lat0 = meta['centre']
dem = np.fromfile(os.path.join(W, 'dem.f32'), dtype=np.float32).reshape(rows, cols)


def to_px(lon, lat):
    x = (lon - lon0) * meta['mPerDegLon']
    y = (lat - lat0) * meta['mPerDegLat']
    return ((x + meta['width'] / 2) / step, (meta['height'] / 2 - y) / step)


def px_to_local(c, r):
    return (-meta['width'] / 2 + c * step, meta['height'] / 2 - r * step)


# ---------------------------------------------------------------- OSM
osm = json.load(open(os.path.join(W, 'osm.json')))['elements']
nodes = {e['id']: (e['lon'], e['lat']) for e in osm if e['type'] == 'node'}
ways = {e['id']: e for e in osm if e['type'] == 'way'}
rels = [e for e in osm if e['type'] == 'relation']


def way_px(w):
    return [to_px(*nodes[n]) for n in w['nodes'] if n in nodes]


# Land mask: draw the coastline, flood the sea from the west edge (OSM: land on the left of the line).
line = Image.new('L', (cols, rows), 0)
d = ImageDraw.Draw(line)
coast = [w for w in ways.values() if w.get('tags', {}).get('natural') == 'coastline']
for w in coast:
    d.line(way_px(w), fill=255, width=2)
barrier = np.array(line) > 0
sea = ndi.label(~barrier)[0]
seed = sea[rows // 2, 2]
sea_mask = sea == seed
# other components: decide by the coastline orientation is fiddly; use the DEM + S2 NIR to vote instead.
s2 = np.load(os.path.join(W, f's2-{a.s2}.npz'))
nir = s2['nir'].astype(np.float32)
rgb = s2['rgb'].astype(np.float32)
lab, n = ndi.label(~barrier)
land = np.zeros((rows, cols), bool)
for i in range(1, n + 1):
    m = lab == i
    if i == seed:
        continue
    # land if most of it is bright in NIR (land > ~1500 reflectance*1e4 scale) or above sea level in the DEM
    vote = np.mean((nir[m] > 1400) | (dem[m] > 1.5))
    if vote > 0.5:
        land |= m
land |= barrier & ndi.binary_dilation(land, iterations=2)
land = ndi.binary_closing(land, iterations=1)

# ---------------------------------------------------------------- heights
h = dem.copy()
# DEM voids / pits inside land (<0.3 m): fill from the surrounding land by normalised convolution.
good = land & (h > 0.3)
for sigma in (3, 8, 20):
    num = ndi.gaussian_filter(np.where(good, h, 0), sigma)
    den = ndi.gaussian_filter(good.astype(np.float32), sigma)
    fill = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0.6)
    h = np.where(land & ~good, fill, h)
    good = land & (h > 0.3)
dist_land = ndi.distance_transform_edt(land) * step     # m inland from the coast
dist_sea = ndi.distance_transform_edt(~land) * step     # m offshore

# Which coasts are limestone cliffs / rock platforms and which are beaches. No open dataset says, so this comes from
# the satellite + drone photos (2026-11-24): the north tip (John Point) and the north-west shore, and the south shore
# from Cape Peron round to the lookout are cliffs and platforms; the west crescent, the north shore (Jonas Beach,
# Cape Peron Beach East), the neck and Mangles Bay are sand. Offshore islets are limestone.
c0_, r0_, c1_, r1_ = map(int, a.crop.split(','))
cx_loc = -meta['width'] / 2 + (c0_ + (c1_ - c0_ - 1) / 2) * step
cy_loc = meta['height'] / 2 - (r0_ + (r1_ - r0_ - 1) / 2) * step
XX = -meta['width'] / 2 + np.arange(cols)[None, :] * step - cx_loc   # crop-local metres
YY = meta['height'] / 2 - np.arange(rows)[:, None] * step - cy_loc
rocky_region = ((XX < -560) & (YY > 470)) | (YY > 640) | ((XX > -720) & (XX < -330) & (YY < 70) & (YY > -120))
comp, ncomp = ndi.label(land)
islet = np.zeros_like(land)
for i in range(1, ncomp + 1):
    m = comp == i
    if m.sum() * step * step < 60000 and not (m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any()):
        islet |= m
rocky_region = rocky_region | ndi.binary_dilation(islet, iterations=8)

# Shore: the DEM coastline is stair-stepped (30 m SRTM mask). Ease land heights up from 0.4 m at the waterline.
# Its edge also steps inland, so within ~70 m of the coast blend towards a heavily smoothed copy.
h_smooth = ndi.gaussian_filter(np.where(land, np.maximum(h, 0.4), 0.4), 6)
wblend = np.clip((dist_land - 8) / 60.0, 0, 1)
h_mix = h_smooth * (1 - wblend) + np.maximum(h, 0.4) * wblend
shore = np.clip(dist_land / 22.0, 0, 1)
h_beach = 0.4 + (np.maximum(h_mix, 0.4) - 0.4) * (shore ** 0.8)
# Cliffs: carry the height found ~20-40 m inland right out to the edge, over a 0.8 m rock platform.
inland = np.where(land & (dist_land > 18), h, 0)
h_in = ndi.gaussian_filter(ndi.maximum_filter(inland, size=21), 4)
edge = np.clip((dist_land - 2.5) / 5.0, 0, 1)
h_cliff = np.maximum(h_mix, 0.8 + (np.maximum(h_in * 0.92, h_mix) - 0.8) * edge)
# islets: the DEM barely sees them; low limestone plateaus with cliffed edges
h_isl = np.minimum(1.0 + dist_land * 0.55, 6.5) * np.clip(0.75 + 0.25 * np.sin(XX / 9.0) * np.cos(YY / 7.0), 0.5, 1)
h_cliff = np.where(islet, np.maximum(h_cliff, h_isl), h_cliff)
rw = ndi.gaussian_filter(rocky_region.astype(np.float32), 6)
h_land = h_beach * (1 - rw) + h_cliff * rw
h_land = ndi.gaussian_filter(h_land, 0.7)
rocky = land & (rw > 0.5)

# Sea floor: no open survey covers it at this scale, so it is modelled. Depth grows with distance offshore; dark
# water in the satellite (seagrass / reef on deeper ground or the Cockburn Sound basin) sits deeper, bright sand
# banks shallower.
bright = rgb.mean(axis=2)
bright_s = ndi.gaussian_filter(bright, 4)
lum = (bright_s - np.percentile(bright_s[~land], 5)) / (np.percentile(bright_s[~land], 95) - np.percentile(bright_s[~land], 5))
lum = np.clip(lum, 0, 1)
base = 0.6 + 7.5 * (1 - np.exp(-dist_sea / 420.0))
depth = base * (1.25 - 0.65 * lum)
depth = ndi.gaussian_filter(depth, 2.0)
h_sea = -np.maximum(depth, 0.35)
h = np.where(land, h_land, h_sea).astype(np.float32)

# ---------------------------------------------------------------- classes (land from S2 + OSM)
# TCI is a display product, so classify land by brightness: heath scrub is dark (~40-90), bare sand / limestone
# and sealed ground bright (>110). In between = sparse scrub on sand (cls 4).
cls = np.zeros((rows, cols), np.uint8)
lumc = ndi.gaussian_filter(rgb.mean(axis=2), 0.7)
cls[land] = 4
cls[land & (lumc < 85)] = 3
cls[land & (lumc >= 115)] = 1
cls[~land & (lum > 0.55) & (dist_sea < 260)] = 10

img = Image.new('L', (cols, rows), 0)
dd = ImageDraw.Draw(img)
feat = {'buildings': [], 'bunkers': [], 'piers': [], 'viewpoints': [], 'cannons': [], 'bridges': [], 'roads': [],
        'paths': [], 'beaches': [], 'parking': []}
for w in ways.values():
    t = w.get('tags', {})
    pts = way_px(w)
    if len(pts) < 2:
        continue
    loc = [px_to_local(c, r) for c, r in pts]
    hw = t.get('highway')
    if hw in ('tertiary', 'unclassified', 'service', 'residential', 'primary', 'secondary'):
        wid = {'tertiary': 7, 'unclassified': 6, 'service': 4.5}.get(hw, 5)
        dd.line(pts, fill=5, width=max(1, round(wid / step)))
        feat['roads'].append({'id': w['id'], 'kind': hw, 'width': wid, 'pts': loc, 'name': t.get('name')})
    elif hw in ('path', 'footway', 'track', 'steps', 'cycleway'):
        wid = 3.0 if hw == 'track' else 1.6
        dd.line(pts, fill=6, width=max(1, round(wid / step)))
        feat['paths'].append({'id': w['id'], 'kind': hw, 'width': wid, 'pts': loc})
    if t.get('amenity') == 'parking':
        dd.polygon(pts, fill=7)
        feat['parking'].append({'id': w['id'], 'pts': loc})
    if t.get('natural') == 'beach':
        feat['beaches'].append({'id': w['id'], 'pts': loc})
    if t.get('military') == 'bunker':
        feat['bunkers'].append({'id': w['id'], 'pts': loc, 'tags': t})
    elif 'building' in t:
        lv = t.get('building:levels')
        feat['buildings'].append({'id': w['id'], 'pts': loc, 'kind': t['building'], 'name': t.get('name'),
                                  'levels': int(lv) if lv and lv.isdigit() else None, 'tags': t})
    if t.get('man_made') in ('pier', 'groyne', 'breakwater') or t.get('man_made') == 'bridge' or t.get('bridge'):
        feat['piers' if t.get('man_made') in ('pier', 'groyne', 'breakwater') else 'bridges'].append(
            {'id': w['id'], 'pts': loc, 'tags': t})
for e in osm:
    if e['type'] != 'node':
        continue
    t = e.get('tags', {})
    c, r = to_px(e['lon'], e['lat'])
    p = px_to_local(c, r)
    if t.get('tourism') == 'viewpoint':
        feat['viewpoints'].append({'at': p, 'tags': t})
    if t.get('historic') == 'cannon':
        feat['cannons'].append({'at': p, 'tags': t})
    if t.get('natural') in ('cape', 'cliff', 'peak'):
        feat.setdefault('natural', []).append({'at': p, 'tags': t})
osm_cls = np.array(img)
for b in feat['buildings'] + feat['bunkers']:
    pass
cls = np.where((osm_cls > 0) & land, osm_cls, cls)
# beaches: land within 40 m of the sea that the satellite sees as bright sand
cls[land & (dist_land < 40) & (cls == 1)] = 9
# limestone: bare, steep land (cliffs / rock platforms)
gy, gx = np.gradient(h, step)
slope = np.hypot(gx, gy)
cls[land & (slope > 0.45) & (cls != 5) & (cls != 7)] = 2

# ---------------------------------------------------------------- crop + write
c0, r0, c1, r1 = map(int, a.crop.split(','))
sl = (slice(r0, r1), slice(c0, c1))
ox, oy = px_to_local(c0, r0)
H, Wd = r1 - r0, c1 - c0
centre_local = (ox + (Wd - 1) * step / 2, oy - (H - 1) * step / 2)
centre_ll = (lon0 + centre_local[0] / meta['mPerDegLon'], lat0 + centre_local[1] / meta['mPerDegLat'])


def recentre(p):
    return [round(p[0] - centre_local[0], 2), round(p[1] - centre_local[1], 2)]


def walk(o):
    if isinstance(o, dict):
        return {k: (recentre(v) if k == 'at' else [recentre(q) for q in v] if k == 'pts' else walk(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [walk(v) for v in o]
    return o


feat = walk(feat)
np.savez_compressed(os.path.join(W, 'grid.npz'), h=h[sl], land=land[sl].astype(np.uint8), rgb=s2['rgb'][sl], cls=cls[sl],
                    rocky=rocky[sl].astype(np.uint8), islet=islet[sl].astype(np.uint8))
json.dump({'step': step, 'cols': Wd, 'rows': H, 'size': [Wd * step, H * step],
           'centre_lnglat': centre_ll, 'frame': 'x east, y north, metres from centre_lnglat; row 0 = north edge',
           'mPerDegLon': meta['mPerDegLon'], 'mPerDegLat': meta['mPerDegLat'],
           'h_range': [float(h[sl].min()), float(h[sl].max())], 's2': a.s2, 'features': feat},
          open(os.path.join(W, 'grid.json'), 'w'), indent=1)

# previews
pal = np.array([[30, 70, 120], [235, 220, 180], [200, 195, 180], [90, 110, 60], [120, 160, 70], [60, 60, 60],
                [210, 190, 150], [110, 110, 110], [200, 60, 60], [250, 240, 200], [60, 170, 170]], np.uint8)
Image.fromarray(pal[cls[sl]]).save(os.path.join(W, 'grid-cls.png'))
hp = h[sl]
v = np.clip((hp + 9) / 30, 0, 1)
gy, gx = np.gradient(hp, step)
shade = np.clip(0.7 + (-gx + gy) * 1.2, 0, 1)
im = np.stack([v * shade, v * shade * 0.95 + np.where(hp < 0, 0.15, 0), np.where(hp < 0, 0.5 + v * 0.3, v * shade * 0.7)], -1)
Image.fromarray((np.clip(im, 0, 1) * 255).astype(np.uint8)).save(os.path.join(W, 'grid-h.png'))
ov = (np.clip(s2['rgb'][sl].astype(np.float32) * 2.2, 0, 255)).astype(np.uint8)
edge = ndi.binary_dilation(land[sl]) & ~land[sl]
ov[edge] = [255, 40, 40]
Image.fromarray(ov).save(os.path.join(W, 'grid-coast.png'))
print(json.dumps({'crop': [c0, r0, c1, r1], 'size_m': [Wd * step, H * step], 'centre': centre_ll,
                  'h': [float(hp.min()), float(hp.max())], 'land_frac': float(land[sl].mean()),
                  'n': {k: len(v) for k, v in feat.items()}}))
