"""Where a building's walls meet (pure Python, no bpy: build_building.py uses it; building-selftest.mjs checks the result).

Every wall of a level's graph is a slab along its centreline, `thickness` wide. At each node the walls meeting
there are sorted by angle; between two neighbours the faces that look at each other meet at one corner (the
mitre). So:
  - two walls (an L, or a straight run with a node in it): a clean mitre, nothing left over;
  - three or more (a T, a cross): each wall ends on its two corners and the polygon those corners make round the
    node (the "hub") is filled once, as part of the thickest wall there;
  - one wall (a free end): a square end.
A corner further than MITRE_LIMIT thicknesses from its node (a very sharp angle) falls back to the square end
and the hub covers the joint.

Coordinates are the plan frame (x east, z south), as building.json. A wall's "left" is building_io's: looking
from node a to node b, left = [d.z, -d.x].
"""

from __future__ import annotations

import math

import building_io as B
import polygon2d as P

MITRE_LIMIT = 3.0


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b, k=1.0):
    return (a[0] + b[0] * k, a[1] + b[1] * k)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def _rot_plus(v):
    """+90 degrees in the plan's angle sense (atan2(z, x) grows): x -> z."""
    return (-v[1], v[0])


def _rot_minus(v):
    return (v[1], -v[0])


def _meet(p0, d0, p1, d1):
    """Where the line p0 + s d0 meets p1 + t d1 (None when parallel)."""
    den = d0[0] * d1[1] - d0[1] * d1[0]
    if abs(den) < 1e-9:
        return None
    w = _sub(p1, p0)
    s = (w[0] * d1[1] - w[1] * d1[0]) / den
    return _add(p0, d0, s)


def junctions(b, level_id):
    """{ wall_id: {"a": {"left", "right", "free"}, "b": {...}} } corner points of each wall's faces at its two
    ends (free = no other wall meets that end), plus "hubs": [{"node", "points", "owner"}] for nodes where three or more walls meet."""
    lines = B.wall_lines(b, level_id)
    nodes = B.node_map(B.level_by_id(b, level_id))
    at_node: dict = {}
    for w in lines:
        at_node.setdefault(w["a"], []).append((w, "a"))
        at_node.setdefault(w["b"], []).append((w, "b"))
    out = {w["id"]: {"a": {}, "b": {}} for w in lines}
    hubs = []
    for nid, ends in at_node.items():
        n = tuple(nodes[nid])
        items = []
        for w, end in ends:
            v = tuple(w["dir"]) if end == "a" else (-w["dir"][0], -w["dir"][1])
            items.append({"w": w, "end": end, "v": v, "h": w["thickness"] / 2, "ang": math.atan2(v[1], v[0])})
        items.sort(key=lambda it: it["ang"])
        k = len(items)
        for i, it in enumerate(items):
            plus_n = _rot_plus(it["v"])
            minus_n = _rot_minus(it["v"])
            square_plus = _add(n, plus_n, it["h"])
            square_minus = _add(n, minus_n, it["h"])
            if k == 1:
                c_plus, c_minus = square_plus, square_minus
            else:
                nxt = items[(i + 1) % k]
                prv = items[(i - 1) % k]
                # my +side face meets the next wall's -side face; my -side face meets the previous wall's +side face
                c_plus = _meet(square_plus, it["v"], _add(n, _rot_minus(nxt["v"]), nxt["h"]), nxt["v"])
                c_minus = _meet(square_minus, it["v"], _add(n, _rot_plus(prv["v"]), prv["h"]), prv["v"])
                lim = MITRE_LIMIT * max(it["h"] * 2, 0.05)
                if c_plus is None or math.hypot(*_sub(c_plus, n)) > lim or _dot(_sub(c_plus, n), it["v"]) < -lim:
                    c_plus = square_plus
                if c_minus is None or math.hypot(*_sub(c_minus, n)) > lim or _dot(_sub(c_minus, n), it["v"]) < -lim:
                    c_minus = square_minus
            # map the wall's own left / right (looking a -> b): at a, v = d so left = rot_minus; at b it flips
            # "free": no other wall meets this end (a wall ending in a room: its end is a finished face, not a cap)
            if it["end"] == "a":
                out[it["w"]["id"]]["a"] = {"left": c_minus, "right": c_plus, "free": k == 1}
            else:
                out[it["w"]["id"]]["b"] = {"left": c_plus, "right": c_minus, "free": k == 1}
            it["c_plus"], it["c_minus"] = c_plus, c_minus
        if k >= 3:
            ring = []
            for it in items:
                for p in (it["c_minus"], it["c_plus"]):
                    if not ring or math.hypot(*_sub(ring[-1], p)) > 1e-6:
                        ring.append(p)
            if len(ring) > 1 and math.hypot(*_sub(ring[0], ring[-1])) < 1e-6:
                ring.pop()
            pts = [list(p) for p in ring]
            if len(pts) >= 3 and abs(P.signed_area(pts)) > 1e-8:
                owner = max(items, key=lambda it: (it["h"], it["w"]["length"]))["w"]["id"]
                hubs.append({"node": nid, "points": pts if P.signed_area(pts) > 0 else list(reversed(pts)), "owner": owner})
    return {"walls": out, "hubs": hubs, "lines": {w["id"]: w for w in lines}}


def wall_frame(line, ends):
    """A PolyWallFrame-ready description of one wall: the RIGHT face is w = 0 (from its corner at a to its corner at
    b), the left face is w = thickness (its ends `ea` / `eb` past the right face's, + = longer), `shift` = where the
    right face starts along the centreline (centreline offsets u -> frame u = u - shift)."""
    pa, d = line["pa"], line["dir"]
    left = line["left"]
    h = line["thickness"] / 2

    def along(p):
        return (p[0] - pa[0]) * d[0] + (p[1] - pa[1]) * d[1]

    ura, urb = along(ends["a"]["right"]), along(ends["b"]["right"])
    ula, ulb = along(ends["a"]["left"]), along(ends["b"]["left"])
    start = [pa[0] + d[0] * ura - left[0] * h, pa[1] + d[1] * ura - left[1] * h]
    end = [pa[0] + d[0] * urb - left[0] * h, pa[1] + d[1] * urb - left[1] * h]
    return {"id": line["id"], "a": start, "b": end, "out": list(left), "length": urb - ura,
            "ea": ura - ula, "eb": ulb - urb, "shift": ura, "thickness": line["thickness"]}
