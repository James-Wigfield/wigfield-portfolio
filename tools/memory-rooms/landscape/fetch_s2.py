"""Sample open Sentinel-2 L2A scenes (Element 84 Earth Search, AWS open data, no key) onto the DEM grid.

    python fetch_s2.py <work dir> <item id> [<item id> ...]

For each item: reads the true-colour TCI and the NIR band over the DEM's box (COG range requests), resamples
bilinearly onto the DEM's local metric grid (dem.json) and writes s2-<date>.npz {rgb uint8 HxWx3, nir uint16 HxW}
+ s2-<date>.png. Contains modified Copernicus Sentinel data.
"""
import json
import os
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import from_bounds
from PIL import Image
from scipy.ndimage import map_coordinates

work = sys.argv[1]
meta = json.load(open(os.path.join(work, 'dem.json')))
cols, rows, step = meta['cols'], meta['rows'], meta['step']
lon0, lat0 = meta['centre']
xs = -meta['width'] / 2 + np.arange(cols) * step
ys = meta['height'] / 2 - np.arange(rows) * step
X, Y = np.meshgrid(xs, ys)
lon = lon0 + X / meta['mPerDegLon']
lat = lat0 + Y / meta['mPerDegLat']


def item(item_id):
    url = f'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{item_id}'
    return json.load(urllib.request.urlopen(url, timeout=60))


def sample(href, bands):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES'):
        with rasterio.open(href) as src:
            ex, ey = transform('EPSG:4326', src.crs, lon.ravel().tolist(), lat.ravel().tolist())
            ex = np.array(ex).reshape(lon.shape)
            ey = np.array(ey).reshape(lon.shape)
            pad = 40
            win = from_bounds(ex.min() - pad, ey.min() - pad, ex.max() + pad, ey.max() + pad, src.transform)
            win = win.round_offsets().round_lengths()
            data = src.read(bands, window=win).astype(np.float32)
            wt = src.window_transform(win)
            # pixel centres: col = (x - c) / a - 0.5
            pc = (ex - wt.c) / wt.a - 0.5
            pr = (ey - wt.f) / wt.e - 0.5
            return np.stack([map_coordinates(b, [pr, pc], order=1, mode='nearest') for b in data])


for item_id in sys.argv[2:]:
    it = item(item_id)
    date = it['properties']['datetime'][:10]
    rgb = sample(it['assets']['visual']['href'], [1, 2, 3])
    nir = sample(it['assets']['nir']['href'], [1])[0]
    rgb8 = np.clip(rgb, 0, 255).astype(np.uint8).transpose(1, 2, 0)
    np.savez_compressed(os.path.join(work, f's2-{date}.npz'), rgb=rgb8, nir=nir.astype(np.uint16))
    # Brightened preview (TCI is dark over water).
    prev = np.clip(rgb.transpose(1, 2, 0) * 2.2, 0, 255).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(work, f's2-{date}.png'))
    print(item_id, date, 'ok', rgb8.shape)
