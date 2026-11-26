"""Checkpoint 1 pictures for a v2 landscape: the DEM vs v1, the extent, the bathymetry.

    python cp1.py <work>

Reads frame.json, src.npz, src/osm.json, src/dot-bathy.png. Writes <work>/cp1/{hillshade,extent,bathy}.png.
"""
import json
import os
import sys

import matplotlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

W = sys.argv[1]
fr = F.load(W)
src = np.load(os.path.join(W, 'src.npz'))
OUT = os.path.join(W, 'cp1')
os.makedirs(OUT, exist_ok=True)
land = src['land'].astype(bool)
depth = np.nan_to_num(src['depth'], nan=8.0)
h2 = np.where(land, np.maximum(src['h_ga'], 0.0), -depth)          # v2 terrain: land LiDAR + sea floor
h1 = src['h_v1']
X, Y = fr.xy()
ext = [fr.x0, fr.x0 + fr.cols * fr.cell, fr.y1 - fr.rows * fr.cell, fr.y1]
hx, hy = fr.half


def hillshade(h, az=315, alt=40, z=2.0, cell=1.0):
    gy, gx = np.gradient(h * z, cell)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, e = np.radians(az), np.radians(alt)
    hs = np.sin(e) * np.cos(slope) + np.cos(e) * np.sin(slope) * np.cos(a - aspect)
    return np.clip(hs, 0, 1)


def multi(h, z=2.0, cell=1.0):
    return (0.5 * hillshade(h, 315, 40, z, cell) + 0.3 * hillshade(h, 15, 45, z, cell)
            + 0.2 * hillshade(h, 255, 45, z, cell))


# ------------------------------------------------------------------ OSM features
osm = json.load(open(os.path.join(W, 'src', 'osm.json')))['elements']
nodes = {e['id']: e for e in osm if e['type'] == 'node'}


def loc(ids):
    pts = [nodes[n] for n in ids if n in nodes]
    return fr.to_local([p['lon'] for p in pts], [p['lat'] for p in pts])


ways = [e for e in osm if e['type'] == 'way' and e.get('tags')]
pois = {
    7497148005: 'N gun', 7497148006: 'S gun', 3296307127: 'Cape Peron lookout', 6612984248: 'John Point',
    7497184690: 'Mushroom Rock',
}
named_ways = {322833804: 'observation post', 322833800: 'operations centre', 322833798: 'storage bunker N'}
camp = next((w for w in ways if w['id'] == 1072146501), None)


def draw_features(ax, labels=True):
    for w in ways:
        t = w['tags']
        x, y = loc(w['nodes'])
        if len(x) < 2:
            continue
        hw = t.get('highway')
        if hw in ('path', 'footway', 'steps', 'track'):
            ax.plot(x, y, color='#ffef9a' if hw != 'steps' else '#ff7a00', lw=1.0, alpha=0.95)
        elif hw:
            ax.plot(x, y, color='#3b3b3b', lw=2.2, alpha=0.9)
        elif t.get('amenity') == 'parking':
            ax.fill(x, y, color='#7d7d7d', alpha=0.8, lw=0)
        elif t.get('military') == 'bunker':
            ax.fill(x, y, color='#c0392b', alpha=0.95, lw=0)
        elif 'building' in t:
            ax.fill(x, y, color='#8e44ad', alpha=0.6, lw=0)
    if camp is not None:
        x, y = loc(camp['nodes'])
        ax.fill(x, y, facecolor='none', edgecolor='#8e44ad', lw=1.2, ls='--')
        if labels:
            ax.text(np.mean(x), np.mean(y), 'camp school\n(leave out?)', color='#5b2c6f', fontsize=7, ha='center')
    if not labels:
        return
    for nid, name in pois.items():
        if nid in nodes:
            x, y = fr.to_local(nodes[nid]['lon'], nodes[nid]['lat'])
            ax.plot(x, y, 'o', ms=5, mfc='#e74c3c', mec='white', mew=1)
            ax.annotate(name, (x, y), xytext=(6, 4), textcoords='offset points', fontsize=7.5, color='black',
                        bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.75))
    for wid, name in named_ways.items():
        w = next((v for v in ways if v['id'] == wid), None)
        if w:
            x, y = loc(w['nodes'])
            ax.annotate(name, (np.mean(x), np.mean(y)), xytext=(6, -10), textcoords='offset points', fontsize=7,
                        color='#7b241c', bbox=dict(boxstyle='round,pad=0.12', fc='white', ec='none', alpha=0.7))


def box(ax, **kw):
    ax.plot([-hx, hx, hx, -hx, -hx], [-hy, -hy, hy, hy, -hy], **({'color': '#e67e22', 'lw': 2.0} | kw))


def scalebar(ax, x, y, m=200):
    ax.plot([x, x + m], [y, y], color='black', lw=3)
    ax.text(x + m / 2, y + 15, f'{m} m', ha='center', fontsize=8)


sea_cmap = LinearSegmentedColormap.from_list('sea', ['#bff3ee', '#5cc6d0', '#1f7fa6', '#0d3f6b'])
land_cmap = LinearSegmentedColormap.from_list('land', ['#d8c99b', '#b5b07a', '#8c8f5a', '#6b6f45'])


def tinted(h, hs, lnd, vmax_land=27, vmax_sea=10):
    lc = land_cmap(np.clip(h / vmax_land, 0, 1))[..., :3]
    sc = sea_cmap(np.clip(-h / vmax_sea, 0, 1))[..., :3]
    c = np.where(lnd[..., None], lc, sc)
    shade = np.where(lnd[..., None], 0.35 + 0.75 * hs[..., None], 0.55 + 0.5 * hs[..., None])
    return np.clip(c * shade, 0, 1)


# window: the box + 120 m
pad = 120
win = (np.abs(X) <= hx + pad) & (np.abs(Y) <= hy + pad)
rows = np.where(win.any(1))[0]
cols = np.where(win.any(0))[0]
sl = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))
wext = [X[sl].min(), X[sl].max(), Y[sl].min(), Y[sl].max()]

# ------------------------------------------------------------------ 1. hillshade v1 vs v2 + a profile
hs1 = multi(np.nan_to_num(h1[sl], nan=0))
hs2 = multi(h2[sl])
land1 = (np.nan_to_num(h1[sl]) > 0.2)
fig = plt.figure(figsize=(16, 11), dpi=110)
gs = fig.add_gridspec(2, 2, height_ratios=[3.2, 1])
for k, (img, ttl) in enumerate(((tinted(np.nan_to_num(h1[sl]), hs1, land1), 'v1 (live): Terrarium z15 (SRTM-derived, ~30 m) + hand-made cliffs'),
                                (tinted(h2[sl], hs2, land[sl]), 'v2: GA 5 m LiDAR (bare earth) + DoT LiDAR bathymetry'))):
    ax = fig.add_subplot(gs[0, k])
    ax.imshow(img, extent=wext, interpolation='bilinear')
    box(ax)
    ax.set_title(ttl, fontsize=10)
    ax.set_xticks([])
    ax.set_yticks([])
    scalebar(ax, wext[0] + 40, wext[2] + 40)
# a profile across the headland through the battery (south gun -> north coast)
g = nodes.get(7497148006)
gx_, gy_ = fr.to_local(g['lon'], g['lat']) if g else (0, 0)
t = np.linspace(-1, 1, 1200)
px_ = gx_ + 0 * t
py_ = gy_ + t * 420
ax = fig.add_subplot(gs[1, :])
from scipy.ndimage import map_coordinates
c_, r_ = fr.to_px(px_, py_)
for h, col, lbl in ((np.nan_to_num(h1, nan=0), '#c0392b', 'v1'), (h2, '#1f4e79', 'v2 (LiDAR)')):
    ax.plot(py_ - gy_, map_coordinates(h, [r_ - 0.5, c_ - 0.5], order=1), color=col, lw=1.6, label=lbl)
ax.axhline(0, color='#5dade2', lw=0.8)
ax.set_xlabel('metres north of the southern gun position (a north-south line through it)')
ax.set_ylabel('height (m, true scale)')
ax.legend(fontsize=9)
ax.grid(alpha=0.3)
for k in (0, 1):
    fig.axes[k].plot(px_, py_, color='white', lw=0.8, ls=':')
fig.suptitle('Point Peron v2 · landform: v1 vs v2 (hillshade ×2, same light; orange = the proposed box)', fontsize=12)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'hillshade.png'))
plt.close(fig)

# ------------------------------------------------------------------ 2. extent
fig, ax = plt.subplots(figsize=(13, 12.5), dpi=110)
ax.imshow(tinted(h2[sl], hs2, land[sl]), extent=wext, interpolation='bilinear')
draw_features(ax)
box(ax)
ax.text(-hx + 8, hy - 22, f'box {2 * hx:.0f} × {2 * hy:.0f} m\n{fr.box[0]},{fr.box[1]} → {fr.box[2]},{fr.box[3]}',
        fontsize=8.5, color='#a04000', bbox=dict(fc='white', ec='none', alpha=0.8))
scalebar(ax, wext[0] + 40, wext[2] + 40)
ax.annotate('N', (wext[1] - 40, wext[3] - 90), xytext=(wext[1] - 40, wext[3] - 160),
            arrowprops=dict(arrowstyle='->', lw=2), ha='center', fontsize=12, weight='bold')
ax.set_xticks([])
ax.set_yticks([])
ax.set_xlim(wext[0], wext[1])
ax.set_ylim(wext[2], wext[3])
ax.set_title('Point Peron v2 · proposed extent over the LiDAR hillshade (paths yellow, steps orange, '
             'battery red, roads grey)', fontsize=10)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'extent.png'))
plt.close(fig)

# ------------------------------------------------------------------ 3. bathymetry
fetch = json.load(open(os.path.join(W, 'src', 'fetch.json')))
dot = np.asarray(Image.open(os.path.join(W, 'src', 'dot-bathy.png')).convert('RGBA'))
w_, s_, e_, n_ = fetch['bbox']
dext = [*fr.to_local(np.array([w_, e_]), np.array([0, 0]))[0], *fr.to_local(np.array([0, 0]), np.array([s_, n_]))[1]]
fig, axs = plt.subplots(1, 2, figsize=(17, 8.4), dpi=110)
axs[0].imshow(dot, extent=dext)
axs[0].set_xlim(wext[0], wext[1])
axs[0].set_ylim(wext[2], wext[3])
axs[0].set_title('WA DoT LiDAR bathymetry (colour ramp, hill-shaded): the source', fontsize=10)
dd = np.where(land[sl], np.nan, src['depth'][sl])
im = axs[1].imshow(dd, extent=wext, cmap=sea_cmap, vmin=0, vmax=10, interpolation='bilinear')
axs[1].imshow(np.where(land[sl][..., None], np.dstack([hs2] * 3) * 0.6 + 0.35, np.nan), extent=wext)
cs = axs[1].contour(np.flipud(np.where(land[sl], np.nan, dd)), levels=[1, 2, 3, 5, 7.5, 10], colors='k',
                    linewidths=0.5, extent=wext, origin='lower')
axs[1].clabel(cs, fontsize=7, fmt='%g m')
ok = src['depth_ok'][sl].astype(bool) | land[sl]
axs[1].contourf(np.flipud(~ok), levels=[0.5, 1.5], colors='none', hatches=['////'], extent=wext, origin='lower')
plt.colorbar(im, ax=axs[1], fraction=0.04, label='depth (m)')
axs[1].set_title('v2 sea floor: depth read off the ramp\'s hue (hatched = no survey, filled)', fontsize=10)
for ax in axs:
    box(ax, lw=1.5)
    ax.set_xticks([])
    ax.set_yticks([])
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'bathy.png'))
plt.close(fig)
print('wrote', OUT)
