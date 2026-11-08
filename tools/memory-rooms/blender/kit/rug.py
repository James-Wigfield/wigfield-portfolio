"""rug: a flat rug with soft rounded edges, a woven pattern built from real (slightly raised) pile
panels, and fringes on the short ends. size = [w, pile height (~0.01), d].

params:
  pattern  "border" | "stripe" | "plain"   (default border when an accent colour is given, else plain)
  fringe   bool     tassel fringes on the two short ends (default true for border / stripe)
  stripes  int      stripe count (default 5)
Materials: main = field (default wool); accent = border / stripes (default: a darker main colour).
The pile is the wool material with a loop-pile bump.
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    color = spec.get("color") or "#c8a46a"
    accent = spec.get("accent") or U.shade(color, 0.6, 1.1)
    name = U.main_name(spec, "wool")
    field = ctx.materials.get(name, color, pile=True) if name == "wool" else ctx.materials.get(name, color)
    aname = U.accent_name(spec, name)
    trim = ctx.materials.get(aname, accent, pile=True) if aname == "wool" else ctx.materials.get(aname, accent)
    pattern = p.get("pattern", "border" if spec.get("accent") else "plain")
    fringe = bool(p.get("fringe", pattern != "plain"))
    long_x = w >= d
    L, S = (w, d) if long_x else (d, w)
    fl = U.clamp(0.06 * L, 0.03, 0.08) if fringe else 0.0
    hl = L / 2 - fl            # half length of the woven body
    hs = S / 2
    t = max(h, 0.004)
    parts = []

    def rect(bm, a0, a1, b0, b1, z0, z1, bevel, mat=0):
        """a = along the long axis, b = across."""
        if long_x:
            U.add_box(bm, (a0, b0, z0), (a1, b1, z1), bevel, 2, mat)
        else:
            U.add_box(bm, (b0, a0, z0), (b1, a1, z1), bevel, 2, mat)

    body = bmesh.new()
    if pattern == "border":
        bw = U.clamp(0.1 * S, 0.05, 0.16)
        rect(body, -hl, hl, -hs, hs, 0.0, t * 0.82, min(t * 0.4, 0.004), 1)
        # thin inner line, then the field slightly proud of the border pile
        rect(body, -hl + bw, hl - bw, -hs + bw, hs - bw, t * 0.5, t * 0.9, 0.0015, 0)
        g = U.clamp(0.25 * bw, 0.012, 0.03)
        rect(body, -hl + bw + g, hl - bw - g, -hs + bw + g, hs - bw - g, t * 0.6, t, 0.0015, 1)
        rect(body, -hl + bw + 2 * g, hl - bw - 2 * g, -hs + bw + 2 * g, hs - bw - 2 * g, t * 0.65, t * 1.0005 + 0.0003,
             0.0015, 0)
    elif pattern == "stripe":
        n = int(p.get("stripes", 5))
        rect(body, -hl, hl, -hs, hs, 0.0, t * 0.85, min(t * 0.4, 0.004), 0)
        span = 2 * hl
        sw = span / (2 * n + 1)
        for i in range(n):
            a0 = -hl + sw * (2 * i + 1)
            rect(body, a0, a0 + sw, -hs + 0.012, hs - 0.012, t * 0.5, t, 0.0015, 1)
    else:
        rect(body, -hl, hl, -hs, hs, 0.0, t, min(t * 0.4, 0.004), 0)
    parts.append(U.obj_from_bm(ctx, "rug", body, [field, trim]))

    if fringe:
        fb = bmesh.new()
        pitch = 0.008
        n = int((2 * hs - 0.03) / pitch)
        rng = ctx.rng
        for end in (-1, 1):
            for i in range(n):
                b = -hs + 0.015 + i * pitch + pitch / 2 + rng.uniform(-0.0012, 0.0012)
                a0 = end * hl - end * 0.004
                a1 = end * (hl + fl * rng.uniform(0.78, 1.0))
                a0, a1 = sorted((a0, a1))
                rect(fb, a0, a1, b - 0.0014, b + 0.0014, 0.0, 0.002, 0.0)
            # whipped binding where the fringe leaves the pile
            rect(fb, end * hl - 0.006 if end > 0 else -hl - 0.002, end * hl + 0.002 if end > 0 else -hl + 0.006,
                 -hs + 0.004, hs - 0.004, 0.0, t * 0.7, 0.0015)
        parts.append(U.obj_from_bm(ctx, "fringe", fb, [ctx.materials.get("linen", "#ece4d2")]))
    return parts
