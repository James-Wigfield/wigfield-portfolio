"""2-D polygon maths in the plan's [x, z]: the Python mirror of src/memory-rooms/scene/polygon.js.

Same names in snake_case, same winding rule: "positive" = the shoelace sum over (x, z) is > 0, which is
clockwise on a north-up map (NW -> NE -> SE -> SW); for a positive polygon the outward normal of edge
a -> b is (dz, -dx) / |d|. Pure Python (no bpy), so the contract checks run outside Blender.
"""

from __future__ import annotations

import math

EPS = 1e-9


def signed_area(pts):
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        s += x1 * z2 - x2 * z1
    return s / 2


def area(pts):
    return abs(signed_area(pts))


def winding_sign(pts):
    return 1 if signed_area(pts) >= 0 else -1


def edge_out(a, b, sign=1):
    dx, dz = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dx, dz) or 1.0
    return [sign * dz / l, -sign * dx / l]


def bbox(pts):
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return {"min": [min(xs), min(zs)], "max": [max(xs), max(zs)]}


def centroid(pts):
    a = signed_area(pts)
    n = len(pts)
    if abs(a) < EPS:
        return [sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n]
    cx = cz = 0.0
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        f = x1 * z2 - x2 * z1
        cx += (x1 + x2) * f
        cz += (z1 + z2) * f
    return [cx / (6 * a), cz / (6 * a)]


def point_in_polygon(p, poly):
    x, z = p
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(p, a, b):
    """(distance, t) from p to segment a-b; t = 0 at a, 1 at b."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dz * dz
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 if l2 > EPS else 0.0
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)), t


def dist_to_boundary(p, poly):
    return min(seg_dist(p, poly[i], poly[(i + 1) % len(poly)])[0] for i in range(len(poly)))


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def proper_crossing(p1, p2, q1, q2, tol=1e-6):
    d1 = _cross(q1, q2, p1)
    d2 = _cross(q1, q2, p2)
    d3 = _cross(p1, p2, q1)
    d4 = _cross(p1, p2, q2)
    if ((d1 > tol and d2 < -tol) or (d1 < -tol and d2 > tol)) and ((d3 > tol and d4 < -tol) or (d3 < -tol and d4 > tol)):
        t = d1 / (d1 - d2)
        return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]
    return None


def collinear_overlap(p1, p2, q1, q2, tol=0.01):
    length = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    if length < EPS:
        return 0.0
    ux, uz = (p2[0] - p1[0]) / length, (p2[1] - p1[1]) / length

    def off(q):
        return abs((q[0] - p1[0]) * uz - (q[1] - p1[1]) * ux)

    if off(q1) > tol or off(q2) > tol:
        return 0.0

    def s(q):
        return (q[0] - p1[0]) * ux + (q[1] - p1[1]) * uz

    a, b = min(s(q1), s(q2)), max(s(q1), s(q2))
    return max(0.0, min(length, b) - max(0.0, a))


def is_simple(pts, min_edge=0.01):
    n = len(pts)
    if n < 3:
        return False
    for k in range(n):
        prev, cur, nxt = pts[(k - 1) % n], pts[k], pts[(k + 1) % n]
        if math.hypot(nxt[0] - cur[0], nxt[1] - cur[1]) < min_edge:
            return False
        d1 = (cur[0] - prev[0], cur[1] - prev[1])
        d2 = (nxt[0] - cur[0], nxt[1] - cur[1])
        crs = d1[0] * d2[1] - d1[1] * d2[0]
        dot = d1[0] * d2[0] + d1[1] * d2[1]
        if abs(crs) < 1e-9 * ((math.hypot(*d1) * math.hypot(*d2)) or 1) and dot < 0:
            return False
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            a1, a2, b1, b2 = pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]
            if proper_crossing(a1, a2, b1, b2):
                return False
            if min(seg_dist(b1, a1, a2)[0], seg_dist(b2, a1, a2)[0], seg_dist(a1, b1, b2)[0], seg_dist(a2, b1, b2)[0]) < 1e-4:
                return False
    return True


def is_convex(pts):
    sign = 0
    n = len(pts)
    for i in range(n):
        c = _cross(pts[i], pts[(i + 1) % n], pts[(i + 2) % n])
        if abs(c) < 1e-9:
            continue
        if not sign:
            sign = 1 if c > 0 else -1
        elif (1 if c > 0 else -1) != sign:
            return False
    return True


def line_intersect(a1, a2, b1, b2):
    d1 = (a2[0] - a1[0], a2[1] - a1[1])
    d2 = (b2[0] - b1[0], b2[1] - b1[1])
    den = d1[0] * d2[1] - d1[1] * d2[0]
    scale = math.hypot(*d1) * math.hypot(*d2)
    if abs(den) < 1e-9 * (scale or 1):
        return None
    t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den
    return [a1[0] + t * d1[0], a1[1] + t * d1[1]]


def inset_edges(pts, dists, sign=None):
    """Per edge i: {"start", "end"} on its line moved inward by dists[i] (see polygon.js insetEdges)."""
    n = len(pts)
    sign = winding_sign(pts) if sign is None else sign
    lines = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        o = edge_out(a, b, sign)
        d = dists[i] or 0.0
        lines.append(([a[0] - o[0] * d, a[1] - o[1] * d], [b[0] - o[0] * d, b[1] - o[1] * d]))

    def corner(i):
        l1, l2 = lines[(i - 1) % n], lines[i]
        hit = line_intersect(l1[0], l1[1], l2[0], l2[1])
        return (hit, hit) if hit else (l1[1], l2[0])

    corners = [corner(i) for i in range(n)]
    return [{"start": corners[i][1], "end": corners[(i + 1) % n][0]} for i in range(n)]


def inset_polygon(pts, dists, sign=None):
    out = []

    def add(p):
        if not out or math.hypot(out[-1][0] - p[0], out[-1][1] - p[1]) > 1e-6:
            out.append(p)

    for e in inset_edges(pts, dists, sign):
        add(e["start"])
        add(e["end"])
    if len(out) > 1 and math.hypot(out[-1][0] - out[0][0], out[-1][1] - out[0][1]) <= 1e-6:
        out.pop()
    return out


def ray_scale(c, p, poly):
    dx, dz = p[0] - c[0], p[1] - c[1]
    if math.hypot(dx, dz) < EPS:
        return 0.0
    best = math.inf
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ex, ez = b[0] - a[0], b[1] - a[1]
        den = dx * ez - dz * ex
        if abs(den) < EPS:
            continue
        t = ((a[0] - c[0]) * ez - (a[1] - c[1]) * ex) / den
        u = ((a[0] - c[0]) * dz - (a[1] - c[1]) * dx) / den
        if t > EPS and -1e-9 <= u <= 1 + 1e-9 and t < best:
            best = t
    return 1 / best if math.isfinite(best) else math.inf
