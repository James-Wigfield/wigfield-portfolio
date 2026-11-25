"""Dream Rooms kit · module `pool`: an indoor pool.

A sunken basin (1.4 m deep below the deck, y = 0 is the deck) inside a 1.6 m deck band round the edge
(the only walkable part when `walkable: edge-only`), a coping edge, dark lane lines on the basin floor,
and the water plane W_<module> (the one live material: the viewer swaps in a cheap reflection; the bake
is its fallback). Floor finish -> deck + basin, walls finish -> the room's walls, water finish -> W."""

from __future__ import annotations

import common as C
from kit import build_props, finishes, reserve_props, shell

BAND = 1.6
DEPTH = 1.4
WATER_Y = -0.12


def build(mb):
    w, h, d = mb.size
    band = min(BAND, w / 4, d / 4)
    x0, x1, z0, z1 = band, w - band, band, d - band
    reserve_props(mb)
    shell.build_shell(mb, floor_holes=[(x0, x1, z0, z1)])
    F = mb.fin
    fl = F["floor"]
    basin_walls = finishes.make("tile" if fl.cited else "plain", (mb.module.get("finishes") or {}).get(
        "floor", {}).get("color"), "walls", invented=not fl.cited)
    # basin floor, walls (facing into the basin)
    C.floor_with_holes(lambda ix, iz: mb.group(("basin_floor", ix, iz), fl.weight * 0.5), x0, x1, z0, z1, -DEPTH, [],
                       fl.mat, up=True)
    bw = mb.group("basin_walls", fl.weight * 0.6)
    y0, y1 = -DEPTH, 0.0
    bw.poly([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], basin_walls, (0, 0, 1))
    bw.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], basin_walls, (0, 0, -1))
    bw.poly([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], basin_walls, (1, 0, 0))
    bw.poly([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], basin_walls, (-1, 0, 0))
    # coping: a pale lip round the basin, a little proud of the deck
    lip = mb.flat("coping", C.mix_hex(fl.hex, "#efece4", 0.55) if fl.cited else finishes.GREY, 0.45)
    cp = mb.group("coping", fl.weight * 0.8)
    t = 0.28
    for (a, b) in (((x0 - t, z0 - t), (x1 + t, z0)), ((x0 - t, z1), (x1 + t, z1 + t)),
                   ((x0 - t, z0), (x0, z1)), ((x1, z0), (x1 + t, z1))):
        cp.box((a[0], 0.0, a[1]), (b[0], 0.025, b[1]), lip, skip=("-y",))
    # lane lines (a pool from swimming lessons): dark stripes on the basin floor, only when the floor is cited
    if fl.cited:
        lane = mb.flat("lane", C.shade_hex(fl.hex, 0.32), 0.4)
        lanes = max(2, round((x1 - x0) / 2.2))
        for i in range(lanes):
            cx = x0 + (i + 0.5) * (x1 - x0) / lanes
            g = mb.group(("lanes",), fl.weight * 0.5)
            g.box((cx - 0.12, -DEPTH, z0 + 2.0), (cx + 0.12, -DEPTH + 0.004, z1 - 2.0), lane, skip=("-y",))
            g.box((cx - 0.5, -DEPTH, z0 + 2.0), (cx + 0.5, -DEPTH + 0.004, z0 + 2.24), lane, skip=("-y",))
            g.box((cx - 0.5, -DEPTH, z1 - 2.24), (cx + 0.5, -DEPTH + 0.004, z1 - 2.0), lane, skip=("-y",))
    # the water plane (W_<module>)
    water = mb.mesh("water", "water", F["water"].weight, pivot_local=((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2))
    water.poly([(x0, WATER_Y, z0), (x1, WATER_Y, z0), (x1, WATER_Y, z1), (x0, WATER_Y, z1)], F["water"].mat, (0, 1, 0))
    mb.water = {"y": WATER_Y, "x0": x0, "x1": x1, "z0": z0, "z1": z1}
    mb.floor_spot = (w / 2, band / 2)
    build_props(mb)
