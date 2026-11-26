"""The coastline of a v2 landscape as runs the Blender build can stand cliffs on.

    python coast.py <work> [--step 1.0]

Reads src/osm.json (natural=coastline ways), grid2.npz (land heights, the rocky-coast class, the walk flags) and
frame.json. Writes <work>/coast.json:
  { runs: [ { rocky: bool, pts: [[x, z]...] (world, every ~1 m), sea: [[nx, nz]...] (unit, toward the sea),
              top: [h...] (the land's height 1.5-3 m inland: where a cliff face starts) } ] }
Only the stretches inside the frame. A run is a stretch with one class; rocky runs shorter than 6 m fold into
their neighbours. The sea side is measured, not assumed (the land grid on either side of each point).
It also CUTS the cliffs into grid2.npz's ground (h, slope, the slope walk flag): run it after prep2.py and before
scatter.py / shade.py / export_data.py (rebuild.sh does).
"""
import argparse
import json
import os
import sys

import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--step', type=float, default=1.0)
a = ap.parse_args()
W = a.work
fr = F.load(W)
g = np.load(os.path.join(W, 'grid2.npz'))
h = g['h']
rocky = g['rocky'].astype(bool)
R, C = h.shape
z0 = -fr.y1
land = h > 0.05


def cell(x, z):
    c = np.clip(((np.asarray(x) - fr.x0) / fr.cell).astype(int), 0, C - 1)
    r = np.clip(((np.asarray(z) - z0) / fr.cell).astype(int), 0, R - 1)
    return r, c


osm = json.load(open(os.path.join(W, 'src', 'osm.json')))['elements']
nodes = {e['id']: e for e in osm if e['type'] == 'node'}
hmax_in = ndi.maximum_filter(np.where(land, h, 0), size=5)
runs = []
for w in (e for e in osm if e['type'] == 'way' and e.get('tags', {}).get('natural') == 'coastline'):
    pts = [nodes[n] for n in w['nodes'] if n in nodes]
    x, y = fr.to_local([p['lon'] for p in pts], [p['lat'] for p in pts])
    P = np.stack([x, -y], 1)  # world x, z
    # resample to ~step
    seg = np.hypot(*np.diff(P, axis=0).T)
    cum = np.concatenate([[0], np.cumsum(seg)])
    if cum[-1] < 2:
        continue
    s = np.arange(0, cum[-1], a.step)
    Q = np.stack([np.interp(s, cum, P[:, 0]), np.interp(s, cum, P[:, 1])], 1)
    inside = (Q[:, 0] > fr.x0 + 2) & (Q[:, 0] < fr.x0 + C * fr.cell - 2) & (Q[:, 1] > z0 + 2) & (Q[:, 1] < z0 + R * fr.cell - 2)
    # tangent, both normals, which one is the sea
    T = np.gradient(Q, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-6)
    Nl = np.stack([-T[:, 1], T[:, 0]], 1)
    probe = 3.0
    la = land[cell(Q[:, 0] + Nl[:, 0] * probe, Q[:, 1] + Nl[:, 1] * probe)]
    lb = land[cell(Q[:, 0] - Nl[:, 0] * probe, Q[:, 1] - Nl[:, 1] * probe)]
    sea = np.where((~la & lb)[:, None], Nl, -Nl)
    # smooth the normals along the run
    sea = ndi.gaussian_filter1d(sea, 2.0, axis=0)
    sea /= np.maximum(np.linalg.norm(sea, axis=1, keepdims=True), 1e-6)
    # the cliff top: the land's height a little way back (the 5 m LiDAR smears a cliff's lip out over 5-8 m),
    # capped so a dune behind a low rock shelf doesn't become a 10 m wall
    tops = [hmax_in[cell((Q - sea * d)[:, 0], (Q - sea * d)[:, 1])] for d in (2.2, 4.0, 6.0)]
    top = np.minimum(np.maximum.reduce(tops), np.maximum(tops[0] * 1.8, tops[0] + 1.0))
    top = np.minimum(top, 9.0)
    inl = Q - sea * 2.2
    rk = rocky[cell(inl[:, 0], inl[:, 1])] & (top > 0.6)
    # fold short rocky / sandy flickers into their neighbours
    rk = ndi.median_filter(rk.astype(np.uint8), size=7).astype(bool)
    k = 0
    n = len(Q)
    while k < n:
        if not inside[k]:
            k += 1
            continue
        j = k
        while j < n and inside[j] and rk[j] == rk[k]:
            j += 1
        if j - k >= 3:
            runs.append({'rocky': bool(rk[k]), 'pts': Q[k:j].round(2).tolist(), 'sea': sea[k:j].round(3).tolist(),
                         'top': top[k:j].round(2).tolist()})
        k = j
# ---- cut the cliffs into the ground: the 5 m LiDAR smears a cliff into a slope that would bury the face the
# Blender build stands along the coast. Seaward of each rocky lip the ground drops to platform level; for 3 m
# behind it the land is squared up to the cliff top; the face cells become too steep to walk (flag 1).
h2 = h.copy()
X0g = fr.x0
for r_ in runs:
    if not r_['rocky']:
        continue
    for (x, z), (sx, sz), top in zip(r_['pts'], r_['sea'], r_['top']):
        tx, tz = -sz, sx
        c0 = int((x - 8 - X0g) / fr.cell)
        c1 = int((x + 8 - X0g) / fr.cell) + 1
        q0 = int((z - 8 - z0) / fr.cell)
        q1 = int((z + 8 - z0) / fr.cell) + 1
        if c1 < 0 or q1 < 0 or c0 >= C or q0 >= R:
            continue
        c0, q0, c1, q1 = max(c0, 0), max(q0, 0), min(c1, C), min(q1, R)
        cx_ = X0g + (np.arange(c0, c1) + 0.5) * fr.cell
        cz_ = z0 + (np.arange(q0, q1) + 0.5) * fr.cell
        DX = cx_[None, :] - x
        DZ = cz_[:, None] - z
        s_ = DX * sx + DZ * sz           # + toward the sea
        a_ = np.abs(DX * tx + DZ * tz)   # along the coast
        blk = h2[q0:q1, c0:c1]
        near = a_ < 0.8
        sea_side = near & (s_ > 0.3) & (s_ < 7)
        land_side = near & (s_ <= 0.3) & (s_ > -6.0)
        blk = np.where(sea_side, np.minimum(blk, 0.05 - 0.02 * s_), blk)
        blk = np.where(land_side, np.maximum(blk, top - 0.08 * (-s_)), blk)
        h2[q0:q1, c0:c1] = blk
gy, gx = np.gradient(h2, fr.cell)
slope2 = np.degrees(np.arctan(np.hypot(gx, gy)))
block = g['block'].copy()
block = (block & ~np.uint8(1)) | ((h2 > 0.05) & (slope2 > 32)).astype(np.uint8)
data = dict(g)
data['h'] = h2.astype(np.float32)
data['slope'] = slope2.astype(np.float32)
data['block'] = block
np.savez_compressed(os.path.join(W, 'grid2.npz'), **data)
print('cliffs cut: ground changed in', int((np.abs(h2 - h) > 0.05).sum()), 'cells')
json.dump({'runs': runs}, open(os.path.join(W, 'coast.json'), 'w'))
rk_len = sum(len(r['pts']) for r in runs if r['rocky']) * a.step
all_len = sum(len(r['pts']) for r in runs) * a.step
print(f'coast: {len(runs)} runs, {all_len:.0f} m, rocky {rk_len:.0f} m, highest cliff top {max(max(r["top"]) for r in runs if r["rocky"]):.1f} m')
