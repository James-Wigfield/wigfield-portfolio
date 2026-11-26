"""Fetch the open inputs for a v2 landscape (Point Peron v2, 2026-11-26). Plain GETs, no key, nothing ordered.

    python fetch_v2.py <work dir> --bbox W,S,E,N [--wide W,S,E,N]

Writes into <work>/src/:
  ga5m.tif           Geoscience Australia, DEM of Australia derived from LiDAR 5 m grid (bare earth), WCS 1.0.0
                     GetCoverage at the native cell (EPSG:4283), float32 m AHD, sea = 0. CC BY 4.0.
  dot-bathy.png      WA Department of Transport LiDAR bathymetry (DOT_CockburnSound_5m_Image, SLIP
                     Landgate_Public_Maps/WA_Bathymetry MapServer layer 21), exported at ~5 m. A hill-shaded
                     colour ramp, NOT depths: bathy.py reads depth back off the hue. CC BY 3.0 AU.
  dot-bathy-wide.png the same layer over --wide at ~20 m (for the hue -> depth calibration).
  dot-classes.geojson / dot-classes-wide.geojson
                     "Bathymetry of WA (DoT)" depth-range polygons (0-10 m, 10-20 m, ...) from the public
                     ArcGIS Online FeatureServer; only used to calibrate the hue.
  osm.json           OpenStreetMap API map.json for the bbox. (c) OpenStreetMap contributors, ODbL.

The GA services sit behind CloudFront, which turns away curl / urllib's default user agent: send a generic browser
one (no name, no contact: see the repo's privacy rule). The OSM API is the other way round: it 429s a browser
user agent and wants a client name (`landscape-builder/2.0`).
"""
import argparse
import json
import os
import urllib.parse
import urllib.request

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
GA_WCS = 'https://services.ga.gov.au/gis/services/DEM_LiDAR_5m_2025/MapServer/WCSServer'
GA_RES = (5.5063478185957097e-05, 5.16012325277870332e-05)  # the coverage's native cell (DescribeCoverage)
DOT = 'https://public-services.slip.wa.gov.au/public/rest/services/Landgate_Public_Maps/WA_Bathymetry/MapServer'
CLASSES = 'https://services6.arcgis.com/CubtY3H3UowKJNc4/ArcGIS/rest/services/Bathymetry_WA_DoT/FeatureServer/311'
OSM = 'https://api.openstreetmap.org/api/0.6/map.json'
M_LON, M_LAT = 94204.18, 110892.26  # m per degree at -32.27


def get(url, params, out, timeout=180, ua=UA):
    full = url + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(full, headers={'User-Agent': ua})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        ctype = r.headers.get('Content-Type', '')
    if 'xml' in ctype or 'html' in ctype:
        raise SystemExit(f'{out}: got {ctype}: {data[:300]!r}')
    open(out, 'wb').write(data)
    print(f'{os.path.basename(out)}: {len(data) / 1024:.0f} KB')


def export_px(bbox, metres):
    w, s, e, n = bbox
    return round((e - w) * M_LON / metres), round((n - s) * M_LAT / metres)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('work')
    ap.add_argument('--bbox', required=True)
    ap.add_argument('--wide', default='115.5285,-32.3213,115.797,-32.0931')
    a = ap.parse_args()
    bbox = [float(v) for v in a.bbox.split(',')]
    wide = [float(v) for v in a.wide.split(',')]
    src = os.path.join(a.work, 'src')
    os.makedirs(src, exist_ok=True)
    bb = ','.join(str(v) for v in bbox)

    get(GA_WCS, {'service': 'WCS', 'request': 'GetCoverage', 'version': '1.0.0', 'coverage': '1', 'crs': 'EPSG:4283',
                 'bbox': bb, 'resx': GA_RES[0], 'resy': GA_RES[1], 'format': 'GeoTIFF'}, os.path.join(src, 'ga5m.tif'))
    for name, box, m in (('dot-bathy.png', bbox, 5), ('dot-bathy-wide.png', wide, 20)):
        wpx, hpx = export_px(box, m)
        get(DOT + '/export', {'bbox': ','.join(str(v) for v in box), 'bboxSR': 4326, 'imageSR': 4326,
                              'size': f'{wpx},{hpx}', 'layers': 'show:21', 'format': 'png32', 'transparent': 'true',
                              'f': 'image'}, os.path.join(src, name))
    for name, box in (('dot-classes.geojson', bbox), ('dot-classes-wide.geojson', wide)):
        get(CLASSES + '/query', {'where': '1=1', 'geometry': ','.join(str(v) for v in box),
                                 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
                                 'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'CODE,LABEL',
                                 'returnGeometry': 'true', 'outSR': 4326, 'geometryPrecision': 6, 'f': 'geojson'},
            os.path.join(src, name))
    # the OSM API rate-limits browser user agents (429): it wants a client name (generic, no contact details)
    get(OSM, {'bbox': bb}, os.path.join(src, 'osm.json'), ua='landscape-builder/2.0')
    json.dump({'bbox': bbox, 'wide': wide}, open(os.path.join(src, 'fetch.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
