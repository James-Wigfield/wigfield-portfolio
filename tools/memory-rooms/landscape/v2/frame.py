"""The v2 frame: local metres around the box centre, x east, y north (Blender), 1 m cells, row 0 = north edge.

Every v2 step imports this so the grids line up. `box` is the playable / detailed area; `ring` is how far beyond it
the low-detail horizon goes.
"""
import json
import os

import numpy as np

M_LON = 94204.18025152721   # m per degree of longitude at -32.27 (same as v1's dem.json)
M_LAT = 110892.2640921701


class Frame:
    def __init__(self, box, ring=250.0, cell=1.0):
        w, s, e, n = box
        self.box = box
        self.lon0 = (w + e) / 2
        self.lat0 = (s + n) / 2
        self.half = ((e - w) * M_LON / 2, (n - s) * M_LAT / 2)   # box half-size in metres (x, y)
        self.ring = ring
        self.cell = cell
        self.x0 = -self.half[0] - ring          # west edge of the grid (m)
        self.y1 = self.half[1] + ring           # north edge
        self.cols = int(round(2 * (self.half[0] + ring) / cell))
        self.rows = int(round(2 * (self.half[1] + ring) / cell))

    # local metres <-> lon/lat
    def to_local(self, lon, lat):
        return (np.asarray(lon) - self.lon0) * M_LON, (np.asarray(lat) - self.lat0) * M_LAT

    def to_lnglat(self, x, y):
        return self.lon0 + np.asarray(x) / M_LON, self.lat0 + np.asarray(y) / M_LAT

    # local metres <-> grid pixel (col, row), pixel centres at +0.5
    def to_px(self, x, y):
        return (np.asarray(x) - self.x0) / self.cell, (self.y1 - np.asarray(y)) / self.cell

    def xy(self):
        """Cell-centre coordinates (X, Y), each (rows, cols)."""
        xs = self.x0 + (np.arange(self.cols) + 0.5) * self.cell
        ys = self.y1 - (np.arange(self.rows) + 0.5) * self.cell
        return np.meshgrid(xs, ys)

    def in_box(self, x, y, pad=0.0):
        return (np.abs(x) <= self.half[0] + pad) & (np.abs(y) <= self.half[1] + pad)

    def to_json(self):
        return {'box': self.box, 'centre_lnglat': [self.lon0, self.lat0], 'half': self.half, 'ring': self.ring,
                'cell': self.cell, 'cols': self.cols, 'rows': self.rows, 'x0': self.x0, 'y1': self.y1,
                'mPerDegLon': M_LON, 'mPerDegLat': M_LAT,
                'frame': 'x east, y north, metres from centre_lnglat; row 0 = north edge; cell centres at +0.5'}


def load(work):
    j = json.load(open(os.path.join(work, 'frame.json')))
    return Frame(j['box'], j['ring'], j['cell'])
