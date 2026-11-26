"""Pack the v2 grids into the small PNG data maps the browser runtime reads (src/memory-rooms/landscape/).

    python export_data.py <work>

Reads frame.json, grid2.npz (+ shade.npz from shade.py when it exists). Writes <work>/data/:
  heights.png  RGBA8, 1 m: R,G = uint16 of (h + 20 m) * 1000 (mm), B = walk flags (grid2 block | 8 water too deep
               to wade | 16 sea), A = 255
  splat.png    RGBA8, 1 m: sand, limestone, heath soil; weed = 255 - their sum; A = 255 (every map is opaque:
               the browser's 2D-canvas decode premultiplies, so an alpha channel would wipe the colour)
  veg.png      RGBA8, 1 m: plant densities (low heath, tall shrub, dune grass), A = 255
  water.png    RGBA8, 1 m: R = depth (0.1 m units, 0-25.5 m), G = signed shore distance (128 + 2 per m, clamped
               to +/-63.5 m), B = rock platform (255) , A = 255
  shade.png    RGBA8, 1 m: R = sun visibility at the ground, G = ambient occlusion, B = sun visibility at the top
               of whatever stands there (plants, roofs), A = 255
               (all 255 until shade.py has run)
  data.json    the frame + encodings (the runtime reads this first)

Row 0 of every map = the frame's north edge; column 0 = its west edge. Cell centres at +0.5.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

W = sys.argv[1]
fr = F.load(W)
g = np.load(os.path.join(W, 'grid2.npz'))
OUT = os.path.join(W, 'data')
os.makedirs(OUT, exist_ok=True)
H_OFF, H_SCALE = 20.0, 1000.0
WADE = 0.6          # m: deeper than this you can't walk (a soft stop at runtime)

h = g['h'].astype(np.float64)
q = np.clip(np.round((h + H_OFF) * H_SCALE), 0, 65535).astype(np.uint16)
sea = h < 0
flags = g['block'].astype(np.uint8) | ((h < -WADE).astype(np.uint8) * 8) | (sea.astype(np.uint8) * 16)
A = np.full(h.shape, 255, np.uint8)
Image.fromarray(np.dstack([(q >> 8).astype(np.uint8), (q & 255).astype(np.uint8), flags, A]), 'RGBA').save(
    os.path.join(OUT, 'heights.png'), optimize=True)
Image.fromarray(np.dstack([g['splat'][..., :3], A]), 'RGBA').save(os.path.join(OUT, 'splat.png'), optimize=True)
Image.fromarray(np.dstack([g['veg'], A]), 'RGBA').save(os.path.join(OUT, 'veg.png'), optimize=True)
depth = np.clip(-h, 0, 25.5)
shore = np.clip(128 + 2 * g['shore'], 1, 255)
Image.fromarray(np.dstack([np.round(depth * 10).astype(np.uint8), np.round(shore).astype(np.uint8),
                           g['platform'].astype(np.uint8) * 255, A]), 'RGBA').save(os.path.join(OUT, 'water.png'),
                                                                                    optimize=True)
sp = os.path.join(W, 'shade.npz')
SUN = {'azimuth': 320.0, 'elevation': 42.0}
if os.path.exists(sp):
    s = np.load(sp)
    sh = np.dstack([np.round(s['sun'] * 255), np.round(s['ao'] * 255), np.round(s['top'] * 255), A])
    SUN = {'azimuth': float(s['az']), 'elevation': float(s['el'])}
else:
    sh = np.dstack([A, A, np.zeros_like(A), A])
Image.fromarray(sh.astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'shade.png'), optimize=True)

meta = {'frame': fr.to_json(), 'heights': {'offset': H_OFF, 'scale': H_SCALE, 'flags': {
    'slope': 1, 'fence': 2, 'bunker': 4, 'deep': 8, 'sea': 16}, 'wade': WADE},
    'water': {'depthScale': 0.1, 'shoreZero': 128, 'shorePerM': 2}, 'shade': {'canopyScale': 0.05},
    'hRange': [float(h.min()), float(h.max())], 'sun': SUN}
# plants (scatter.py): 12 bytes each, sorted by type then by 32 m cell (so the runtime can slice ranges)
pp = os.path.join(W, 'plants.npz')
if os.path.exists(pp):
    P = np.load(pp)
    n = len(P['x'])
    cellx = np.floor((P['x'] - fr.x0) / 32).astype(np.int32)
    cellz = np.floor((P['z'] + fr.y1) / 32).astype(np.int32)
    order = np.lexsort((cellx, cellz, P['type']))
    W_ = fr.cols * fr.cell
    D_ = fr.rows * fr.cell
    qx = np.clip(np.round((P['x'][order] - fr.x0) / W_ * 65535), 0, 65535).astype('<u2')
    qz = np.clip(np.round((P['z'][order] + fr.y1) / D_ * 65535), 0, 65535).astype('<u2')
    qy = np.clip(np.round((P['y'][order] + 20) * 100), 0, 65535).astype('<u2')
    rec = np.zeros(n, dtype=[('x', '<u2'), ('z', '<u2'), ('y', '<u2'), ('t', 'u1'), ('rot', 'u1'), ('s', 'u1'),
                             ('sy', 'u1'), ('tint', 'u1'), ('pad', 'u1')])
    rec['x'], rec['z'], rec['y'] = qx, qz, qy
    rec['t'] = P['type'][order]
    rec['rot'] = np.round(P['rot'][order] / (2 * np.pi) * 255).astype(np.uint8)
    rec['s'] = np.clip(np.round(P['s'][order] / 2.0 * 255), 1, 255).astype(np.uint8)
    rec['sy'] = np.clip(np.round(P['sy'][order] / 2.0 * 255), 1, 255).astype(np.uint8)
    rec['tint'] = P['tint'][order]
    rec.tofile(os.path.join(OUT, 'plants.bin'))
    meta['plants'] = {'count': int(n), 'stride': 12, 'types': ['olearia', 'scaevola', 'acacia', 'tall', 'tussock', 'dead', 'rocka', 'rockb', 'rockc', 'rockd'],
                      'byType': np.bincount(P['type'], minlength=10).tolist(),
                      'encoding': 'u16 x, u16 z (0-65535 across the frame), u16 y ((m + 20) * 100), u8 type, u8 rot '
                                  '(x 2pi / 255), u8 s (x 2 / 255), u8 sy (x 2 / 255), u8 tint, u8 pad'}
    print('plants.bin', os.path.getsize(os.path.join(OUT, 'plants.bin')) // 1024, 'KB', n)
# OSM ways the runtime builds as geometry (paths, roads, car parks), in WORLD x / z, clipped to the frame
feat = json.load(open(os.path.join(W, 'features.json')))
fx0, fx1 = fr.x0, fr.x0 + fr.cols * fr.cell
fz0, fz1 = -fr.y1, -fr.y1 + fr.rows * fr.cell


def world(pts):
    return [[round(p[0], 2), round(-p[1], 2)] for p in pts]


def inside(pts):
    return any(fx0 <= p[0] <= fx1 and fz0 <= -p[1] <= fz1 for p in pts)


meta['ways'] = {
    'paths': [{'id': p['id'], 'kind': p['kind'], 'surface': p['surface'], 'width': p['width'], 'pts': world(p['pts'])}
              for p in feat['paths'] if inside(p['pts'])],
    'roads': [{'id': r['id'], 'kind': r['kind'], 'name': r['name'], 'width': r['width'], 'pts': world(r['pts'])}
              for r in feat['roads'] if inside(r['pts'])],
    'parking': [{'id': p['id'], 'kind': p['kind'], 'pts': world(p['pts'])} for p in feat['parking'] if inside(p['pts'])],
}
tex = os.path.join(OUT, 'tex', 'tex.json')
if os.path.exists(tex):
    meta['textures'] = json.load(open(tex))
json.dump(meta, open(os.path.join(OUT, 'data.json'), 'w'), indent=1)
for f in ('heights', 'splat', 'veg', 'water', 'shade'):
    print(f, os.path.getsize(os.path.join(OUT, f + '.png')) // 1024, 'KB')
