"""Sentinel-2 L2A reflectance bands on the v2 frame (Element 84 Earth Search, AWS open data, no key).

    python s2_bands.py <work> <item id> [<item id> ...]

For each item: blue (B02), green (B03), red (B04), nir (B08), scl, read over the frame (COG range requests) and
resampled bilinearly to a 2 m copy of the frame grid (S2 is 10 m: finer is pointless). Reflectance is scaled with
the asset's own raster:bands scale / offset (the c1 collection carries the -0.1 offset of baseline 04.00).
Writes <work>/s2/<date>.npz {blue, green, red, nir: float32 reflectance, scl: uint8} at 2 m, row 0 = north.
Contains modified Copernicus Sentinel data.
"""
import json
import os
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import from_bounds
from scipy.ndimage import map_coordinates

sys.path.insert(0, os.path.dirname(__file__))
import frame as F

work = sys.argv[1]
fr = F.load(work)
step = 2.0
cols, rows = int(fr.cols * fr.cell / step), int(fr.rows * fr.cell / step)
xs = fr.x0 + (np.arange(cols) + 0.5) * step
ys = fr.y1 - (np.arange(rows) + 0.5) * step
X, Y = np.meshgrid(xs, ys)
lon, lat = fr.to_lnglat(X, Y)
os.makedirs(os.path.join(work, 's2'), exist_ok=True)


def item(item_id):
    url = f'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{item_id}'
    return json.load(urllib.request.urlopen(url, timeout=60))


def sample(asset, order=1):
    href = asset['href']
    rb = (asset.get('raster:bands') or [{}])[0]
    scale, offset = rb.get('scale', 1.0), rb.get('offset', 0.0)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES'):
        with rasterio.open(href) as src:
            ex, ey = transform('EPSG:4326', src.crs, lon.ravel().tolist(), lat.ravel().tolist())
            ex = np.array(ex).reshape(lon.shape)
            ey = np.array(ey).reshape(lon.shape)
            pad = 60
            win = from_bounds(ex.min() - pad, ey.min() - pad, ex.max() + pad, ey.max() + pad, src.transform)
            win = win.round_offsets().round_lengths()
            data = src.read(1, window=win).astype(np.float32)
            wt = src.window_transform(win)
            pc = (ex - wt.c) / wt.a - 0.5
            pr = (ey - wt.f) / wt.e - 0.5
            out = map_coordinates(data, [pr, pc], order=order, mode='nearest')
    return out if order == 0 else out * scale + offset


for item_id in sys.argv[2:]:
    it = item(item_id)
    date = it['properties']['datetime'][:10]
    A = it['assets']
    out = {k: sample(A[k]).astype(np.float32) for k in ('blue', 'green', 'red', 'nir')}
    out['scl'] = sample(A['scl'], order=0).astype(np.uint8)
    np.savez_compressed(os.path.join(work, 's2', f'{date}.npz'), step=step, **out)
    print(item_id, date, 'ok', out['blue'].shape, 'blue p50', float(np.median(out['blue'])))
