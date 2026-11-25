"""Dream Rooms kit · module `hall`: a big room with a grid of square columns.

Columns stand ~7 m apart, at least 3 m in from the walls, and keep clear of the spawn, every doorway's
approach and anything placed at `pos`. They wear the walls' finish (plain grey when the walls are
invented) and are a touch thin for the size of the room; module.scale thickens them."""

from __future__ import annotations

import math

from kit import build_props, reserve_props, shell

SPACING = 7.0
INSET = 3.0


def column_spots(mb):
    w, _, d = mb.size
    nx = max(0, math.floor((w - 2 * INSET) / SPACING) + 1) if w > 2 * INSET + 1 else 0
    nz = max(0, math.floor((d - 2 * INSET) / SPACING) + 1) if d > 2 * INSET + 1 else 0
    if not nx or not nz:
        return []
    xs = [w / 2] if nx == 1 else [INSET + i * (w - 2 * INSET) / (nx - 1) for i in range(nx)]
    zs = [d / 2] if nz == 1 else [INSET + j * (d - 2 * INSET) / (nz - 1) for j in range(nz)]
    keep_clear = []
    sp = mb.world.get("spawn") or {}
    if sp.get("module") == mb.id:
        keep_clear.append((sp["at"][0], sp["at"][2], 1.8))
    for _, fr in mb.doorways:
        c, n = fr["centre"], fr["inward"]
        for k in (0.8, 2.0, 3.2):
            keep_clear.append((c[0] + n[0] * k, c[2] + n[2] * k, 1.6))
    for p in mb.module.get("props") or []:
        if p.get("pos"):
            keep_clear.append((p["pos"][0], p["pos"][2], 1.5))
    for lk in mb.world.get("links") or []:
        if lk.get("kind") == "dissolve" and lk.get("to") == mb.id and lk.get("at"):
            keep_clear.append((lk["at"][0], lk["at"][2], 1.8))
    out = []
    for x in xs:
        for z in zs:
            if all((x - a) ** 2 + (z - b) ** 2 > r * r for a, b, r in keep_clear):
                out.append((x, z))
    return out


def build(mb):
    reserve_props(mb)
    shell.build_shell(mb)
    s = 0.24 * mb.scale  # half width
    mat = mb.fin["walls"].mat
    for i, (x, z) in enumerate(column_spots(mb)):
        g = mb.group(("column", i), mb.fin["walls"].weight)
        g.box((x - s, 0, z - s), (x + s, mb.h, z + s), mat, skip=("-y", "+y"))
    build_props(mb)
