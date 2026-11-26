"""Put every v2 source on the v2 frame (frame.py) and read depths off the DoT bathymetry image.

    python sources.py <work> --box W,S,E,N [--ring 250] [--shift dx,dy]

Reads <work>/src/ (fetch_v2.py) and v1's grid for comparison (--v1 <v1 work>). Writes:
  frame.json
  src.npz   h_ga      float32  GA 5 m LiDAR DEM (bilinear to 1 m, m AHD; sea = 0)
            land      uint8    1 = land (OSM coastline, components voted by the DEM)
            depth     float32  sea-floor depth (m, positive down) read off the DoT LiDAR bathymetry colour ramp,
                               holes filled; NaN where there is no survey at all
            depth_ok  uint8    1 = a surveyed pixel (not filled)
            h_v1      float32  v1's built heights, for the comparison only
  bathy-cal.json + bathy-cal.png   the hue -> depth calibration

DoT's image is hill-shaded, so brightness lies but the hue (red shallow -> yellow -> green -> cyan -> blue ->
purple deep) survives the shading. The ramp's depths aren't published with the image, so the hue is calibrated
against DoT's own depth-range polygons ("Bathymetry of WA (DoT)": 0-10 m, 10-20 m, 20-50 m) over the whole
Cockburn Sound survey: the hue that best splits 0-10 from 10-20 is the 10 m hue, and so on. The water's edge
(red, next to the survey's own grey land) anchors 0. It's a survey read back through a colour ramp: call it "modelled from survey", +/- ~1-2 m.
"""
import argparse
import json
import os

import numpy as np
import rasterio
from matplotlib.colors import rgb_to_hsv
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.ndimage import map_coordinates

import frame as F

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--box', required=True)
ap.add_argument('--ring', type=float, default=250)
ap.add_argument('--shift', default='0,0', help='metres to move the GA DEM by (x east, y north) to meet OSM')
ap.add_argument('--v1', default=None)
a = ap.parse_args()
W = a.work
S = os.path.join(W, 'src')
fr = F.Frame([float(v) for v in a.box.split(',')], a.ring)
json.dump(fr.to_json(), open(os.path.join(W, 'frame.json'), 'w'), indent=1)
fetch = json.load(open(os.path.join(S, 'fetch.json')))
X, Y = fr.xy()
LON, LAT = fr.to_lnglat(X, Y)
print('frame', fr.cols, 'x', fr.rows, 'half', [round(v, 1) for v in fr.half])

# ------------------------------------------------------------------ GA DEM
sx, sy = (float(v) for v in a.shift.split(','))
with rasterio.open(os.path.join(S, 'ga5m.tif')) as d:
    dem = d.read(1).astype(np.float32)
    t = d.transform
lon_s, lat_s = fr.to_lnglat(X - sx, Y - sy)
pc = (lon_s - t.c) / t.a - 0.5
pr = (lat_s - t.f) / t.e - 0.5
h_ga = map_coordinates(dem, [pr, pc], order=1, mode='nearest').astype(np.float32)

# ------------------------------------------------------------------ OSM land
osm = json.load(open(os.path.join(S, 'osm.json')))['elements']
nodes = {e['id']: (e['lon'], e['lat']) for e in osm if e['type'] == 'node'}
ways = [e for e in osm if e['type'] == 'way']


def way_px(w):
    pts = [nodes[n] for n in w['nodes'] if n in nodes]
    x, y = fr.to_local([p[0] for p in pts], [p[1] for p in pts])
    c, r = fr.to_px(x, y)
    return list(zip(c.tolist(), r.tolist()))


line = Image.new('L', (fr.cols, fr.rows), 0)
dr = ImageDraw.Draw(line)
for w in ways:
    if w.get('tags', {}).get('natural') == 'coastline':
        dr.line(way_px(w), fill=255, width=2)
barrier = np.array(line) > 0
lab, n = ndi.label(~barrier)
land = np.zeros(barrier.shape, bool)
for i in range(1, n + 1):
    m = lab == i
    if np.mean(h_ga[m] > 0.25) > 0.5:
        land |= m
land |= barrier & ndi.binary_dilation(land, iterations=2)

# how well the DEM's land edge meets OSM's coastline (both are "where the land starts")
ga_land = h_ga > 0.25
core = fr.in_box(X, Y, 100)
best = None
for dx in range(-8, 9):
    for dy in range(-8, 9):
        g = np.roll(np.roll(ga_land, -dy, 0), dx, 1)   # move the DEM by (dx east, dy north)
        iou = np.sum(g & land & core) / max(1, np.sum((g | land) & core))
        if best is None or iou > best[0]:
            best = (iou, dx, dy)
iou0 = np.sum(ga_land & land & core) / max(1, np.sum((ga_land | land) & core))
print(f'DEM vs OSM land IoU {iou0:.4f} as is; best {best[0]:.4f} moving the DEM by {best[1]} m E, {best[2]} m N')

# ------------------------------------------------------------------ DoT bathymetry: hue -> depth


def hue_of(png):
    im = np.asarray(Image.open(png).convert('RGBA')).astype(np.float32) / 255
    hsv = rgb_to_hsv(im[..., :3])
    hue = hsv[..., 0] * 360
    hue = np.where(hue > 330, hue - 360, hue)            # a red just past 0 is the shallowest
    # water pixels are vivid (saturation >= 0.66 for 99 % of open water); the survey's land is a green-grey
    # hill-shade (saturation mostly < 0.5) whose hue would read as 12-15 m deep, so it must not count
    ok = (im[..., 3] > 0.8) & (hsv[..., 1] > 0.6) & (hsv[..., 2] > 0.3)
    return hue, ok


def raster_classes(geojson, box, shape):
    w, s, e, n = box
    H, Wd = shape
    img = Image.new('L', (Wd, H), 0)
    d = ImageDraw.Draw(img)
    code = {'0-10m': 1, '10-20m': 2, '20-50m': 3, 'ISLAND': 9, 'MAINLAND': 9}
    feats = json.load(open(geojson))['features']

    def ring_px(rg):
        return [((p[0] - w) / (e - w) * Wd, (n - p[1]) / (n - s) * H) for p in rg]

    polys = []
    for f in feats:
        g = f['geometry']
        if not g:
            continue
        v = code.get(f['properties']['LABEL'], 0)
        parts = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for p in parts:
            xs = [q[0] for q in p[0]]
            area = (max(xs) - min(xs)) * (max(q[1] for q in p[0]) - min(q[1] for q in p[0]))
            polys.append((area, v, p))
    for area, v, p in sorted(polys, key=lambda t: -t[0]):   # big first: nested smaller ones win
        d.polygon(ring_px(p[0]), fill=v)
        for hole in p[1:]:
            d.polygon(ring_px(hole), fill=255)
    return np.asarray(img)


hue_w, ok_w = hue_of(os.path.join(S, 'dot-bathy-wide.png'))
cls_w = raster_classes(os.path.join(S, 'dot-classes-wide.geojson'), fetch['wide'], hue_w.shape)
# keep away from the class edges: the polygons are coarse
inner = {c: ndi.binary_erosion(cls_w == c, iterations=2) & ok_w for c in (1, 2, 3)}
landish = ndi.binary_dilation((cls_w == 9) | (cls_w == 0), iterations=1)


def split(a_, b_):
    ha, hb = hue_w[a_], hue_w[b_]
    ts = np.arange(-20, 300, 0.5)
    err = [np.mean(ha > t) + np.mean(hb < t) for t in ts]
    i = int(np.argmin(err))
    return float(ts[i]), float(err[i]) / 2


t10, e10 = split(inner[1], inner[2])
t20, e20 = split(inner[2], inner[3])
# The 0 m anchor: the hue of the water pixels right next to the survey's own (grey, hill-shaded) land is red (0 deg,
# median of the ring around DoT's land, 2026-11-26). The class polygons' coast is too coarse to anchor it.
grey = ndi.binary_opening((np.asarray(Image.open(os.path.join(S, 'dot-bathy.png')).convert('RGBA'))[..., 3] > 200)
                          & (rgb_to_hsv(np.asarray(Image.open(os.path.join(S, 'dot-bathy.png')).convert('RGB'))
                                        .astype(np.float32) / 255)[..., 1] < 0.12), iterations=2)
hue_l0, ok_l0 = hue_of(os.path.join(S, 'dot-bathy.png'))
ring_ = ndi.binary_dilation(grey, iterations=2) & ~grey & ok_l0
h0 = float(np.median(hue_l0[ring_])) if ring_.sum() > 10 else 0.0
# Sentinel-2's Stumpf ratio (log B02 / log B03) rises with the hue everywhere (s2 check, 2026-11-26), so the hue
# orders depth; it can't fix the shape near 0 (bright sand vs dark seagrass), so the ramp is taken as linear between
# the knots: 0 m at the waterline, 10 m and 20 m where DoT's classes split.
knots = [(h0, 0.0), (t10, 10.0), (t20, 20.0)]
slope_lo = (t10 - h0) / 10
slope_hi = (t20 - t10) / 10
cal = {'shore_hue': h0, 'note': 'hue of DoT LiDAR bathymetry image -> depth (m, +down); piecewise linear', 'hue_10m': t10, 'hue_20m': t20, 'split_error_10': e10, 'split_error_20': e20,
       'deg_per_m_0_10': slope_lo, 'deg_per_m_10_20': slope_hi, 'knots': knots,
       'n': {k: int(v.sum()) for k, v in inner.items()}, 'n_shore': int(ring_.sum())}
print('calibration', json.dumps(cal))


def depth_of(hue):
    hs = np.array([k[0] for k in knots])
    ds = np.array([k[1] for k in knots])
    d = np.interp(hue, hs, ds)
    d = np.where(hue > hs[-1], ds[-1] + (hue - hs[-1]) / slope_hi, d)       # extrapolate past 20 m
    d = np.where(hue < hs[0], np.maximum(0, ds[0] + (hue - hs[0]) / slope_lo), d)
    return d


# the local image (5 m)
hue_l, ok_l = hue_of(os.path.join(S, 'dot-bathy.png'))
dep_l = depth_of(hue_l)
dep_l = np.where(ok_l, dep_l, np.nan)
# hill-shade speckle: a small median over the valid pixels
med = ndi.generic_filter(np.where(ok_l, dep_l, np.nan), np.nanmedian, size=3, mode='nearest')
dep_l = np.where(ok_l, med, np.nan)
# resample to the frame (bilinear of a hole-filled copy; holes remembered separately)
w, s, e, n = fetch['bbox']
Hl, Wl = dep_l.shape
pc = (LON - w) / (e - w) * Wl - 0.5
pr = (n - LAT) / (n - s) * Hl - 0.5
good = np.isfinite(dep_l)
filled = dep_l.copy()
for sigma in (1.5, 4, 10, 30):
    num = ndi.gaussian_filter(np.where(good, filled, 0), sigma)
    den = ndi.gaussian_filter(good.astype(np.float32), sigma)
    est = np.where(den > 1e-3, num / np.maximum(den, 1e-6), np.nan)
    filled = np.where(good, filled, est)
    good = np.isfinite(filled)
depth = map_coordinates(np.nan_to_num(filled, nan=0), [pr, pc], order=1, mode='nearest').astype(np.float32)
surveyed = map_coordinates(np.isfinite(dep_l).astype(np.float32), [pr, pc], order=1, mode='nearest') > 0.5
anyv = map_coordinates(np.isfinite(filled).astype(np.float32), [pr, pc], order=1, mode='nearest') > 0.5
depth = np.where(anyv, depth, np.nan)
# no hole against the shore: within the sea, depth <= 0.3 m + 1.0 x the distance from the OSM coast (a 45 deg wall
# at most; Peron's cliffs stand in 1-4 m of water)
d_coast = ndi.distance_transform_edt(~land) * fr.cell
depth = np.minimum(depth, 0.3 + 1.0 * d_coast)
sea = ~land
print(f'sea cells surveyed {np.mean(surveyed[sea]):.3f}; depth in the box: '
      f'{np.nanpercentile(depth[sea & fr.in_box(X, Y)], [5, 50, 95]).round(2).tolist()} m')

# ------------------------------------------------------------------ v1 heights for the comparison
h_v1 = np.full(X.shape, np.nan, np.float32)
if a.v1:
    g = np.load(os.path.join(a.v1, 'grid.npz'))
    gj = json.load(open(os.path.join(a.v1, 'grid.json')))
    lon1, lat1 = gj['centre_lnglat']
    x1 = (LON - lon1) * gj['mPerDegLon']
    y1 = (LAT - lat1) * gj['mPerDegLat']
    c1 = (x1 + gj['size'][0] / 2) / gj['step'] - 0.5
    r1 = (gj['size'][1] / 2 - y1) / gj['step'] - 0.5
    h_v1 = map_coordinates(g['h'].astype(np.float32), [r1, c1], order=1, mode='nearest')

np.savez_compressed(os.path.join(W, 'src.npz'), h_ga=h_ga, land=land.astype(np.uint8), depth=depth,
                    depth_ok=surveyed.astype(np.uint8), h_v1=h_v1)
cal['dem_vs_osm'] = {'iou': iou0, 'best_iou': best[0], 'best_shift_m': [best[1], best[2]], 'applied': [sx, sy]}
json.dump(cal, open(os.path.join(W, 'bathy-cal.json'), 'w'), indent=1)

# ------------------------------------------------------------------ calibration plot
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

fig, ax = plt.subplots(1, 2, figsize=(12, 4.2), dpi=110)
bins = np.arange(-20, 300, 2)
for c, lab_, col in ((1, '0–10 m', '#d9534f'), (2, '10–20 m', '#c9a227'), (3, '20–50 m', '#3b7dd8')):
    ax[0].hist(hue_w[inner[c]], bins=bins, histtype='step', lw=1.6, label=f'{lab_} (n={inner[c].sum()})', color=col,
               density=True)
for tt, lbl in ((h0, 'shore'), (t10, '10 m'), (t20, '20 m')):
    ax[0].axvline(tt, color='k', lw=0.8, ls='--')
    ax[0].text(tt + 2, ax[0].get_ylim()[1] * 0.9, lbl, fontsize=8)
ax[0].set_xlabel('hue of the DoT bathymetry ramp (°)')
ax[0].set_title("DoT's depth classes vs the image hue (whole Cockburn Sound survey)")
ax[0].legend(fontsize=8)
hh = np.linspace(-10, 260, 200)
ax[1].plot(hh, depth_of(hh), color='#222')
ax[1].scatter([k[0] for k in knots], [k[1] for k in knots], color='#d9534f', zorder=3)
ax[1].invert_yaxis()
ax[1].set_xlabel('hue (°)')
ax[1].set_ylabel('depth (m)')
ax[1].set_title('hue → depth (piecewise linear through the knots)')
ax[1].grid(alpha=0.3)
fig.tight_layout()
fig.savefig(os.path.join(W, 'bathy-cal.png'))
print('wrote', os.path.join(W, 'src.npz'))
