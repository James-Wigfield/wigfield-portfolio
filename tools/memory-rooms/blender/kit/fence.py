"""fence: a run of fence along local x (w = length, h = height, d = thickness).

params: style "picket" (default: pointed pickets on two rails between capped posts) | "rail" (ranch: posts
and three horizontal boards) | "panel" (closed vertical boards), post (m between posts, default 2.2).
The pickets / boards sit on the FRONT (local -y) face.
"""

from __future__ import annotations

import math

from mrgeo import MB


def build(ctx, spec):
    w, h, d = (float(v) for v in spec["size"])
    P = spec.get("params") or {}
    style = P.get("style", "picket")
    mat = ctx.mat(spec, fallback="pine")
    acc = ctx.mat(spec, "accent", fallback=spec.get("material") or "pine") if spec.get("accent") else mat
    pt = max(0.06, min(0.12, d))
    npost = max(2, math.ceil(w / float(P.get("post", 2.2))) + 1)
    posts = MB()
    cap = 0.05
    for i in range(npost):
        x = -w / 2 + pt / 2 + (w - pt) * i / (npost - 1)
        posts.box((x - pt / 2, -pt / 2, 0), (x + pt / 2, pt / 2, h - cap), acc)
        c = posts.add_verts([(x - pt * 0.62, -pt * 0.62, h - cap), (x + pt * 0.62, -pt * 0.62, h - cap),
                             (x + pt * 0.62, pt * 0.62, h - cap), (x - pt * 0.62, pt * 0.62, h - cap),
                             (x, 0, h)])
        posts.face((c, c + 1, c + 4), acc)
        posts.face((c + 1, c + 2, c + 4), acc)
        posts.face((c + 2, c + 3, c + 4), acc)
        posts.face((c + 3, c, c + 4), acc)
        posts.face((c + 3, c + 2, c + 1, c), acc)
    boards = MB()
    yf = -pt / 2
    if style == "rail":
        for z in (h * 0.25, h * 0.52, h * 0.79):
            boards.box((-w / 2, yf - 0.03, z - 0.06), (w / 2, yf, z + 0.06), mat)
    else:
        for z in (h * 0.22, h * 0.7):
            boards.box((-w / 2 + pt, -0.025, z - 0.035), (w / 2 - pt, 0.02, z + 0.035), mat)
        pw = 0.075 if style == "picket" else 0.11
        gap = 0.05 if style == "picket" else 0.006
        n = max(1, int((w - 2 * pt) / (pw + gap)))
        span = n * (pw + gap) - gap
        x0 = -span / 2
        ph = h * 0.9 if style == "picket" else h * 0.95
        for i in range(n):
            a = x0 + i * (pw + gap)
            b = a + pw
            if style == "picket":
                prof = [(0.05, a), (0.05, b), (ph - pw * 0.55, b), (ph, (a + b) / 2), (ph - pw * 0.55, a)]
            else:
                prof = [(0.03, a), (0.03, b), (ph, b), (ph, a)]
            boards.prism(prof, "y", yf - 0.022, yf - 0.002 if style != "picket" else yf, mat)
    return [posts.obj("posts", ctx.collection, bevel_w=0.008, segments=2),
            boards.obj("boards", ctx.collection, bevel_w=0.004, segments=1)]
