"""Dream Rooms kit · prop `locker-bank`: a run of two-tier school lockers against a wall.

`length` metres long (default 4) at `at`; 1.83 m x scale tall, 0.45 m x scale deep, 0.38 m x scale per
column, so a module `scale` of 1.3 makes them too tall, as the dream says. The front is ONE connected
panel a little proud of the carcass: door gaps, louvre slits, latches and blank number tags are
coloured cells of it (one UV island, however many lockers). Colour: the prop's `color`, else a muted
painted-metal grey-green (see KIT.md, "no default look")."""

from __future__ import annotations

DEFAULT = "#7f8a84"


def size(mb, prop):
    s = mb.scale
    return float(prop.get("length", 4.0)), 1.83 * s, 0.45 * s, 0.38 * s


def reserve(mb, prop):
    length, h, _, _ = size(mb, prop)
    if prop.get("wall"):
        mb.place(prop, length=length, height=h)


def build(mb, prop):
    length, H, D, cw = size(mb, prop)
    xf, wall = mb.place(prop)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    col = prop.get("color") or DEFAULT
    paint = mb.flat("locker", col, 0.5)
    gap = mb.flat("locker_gap", "#232524", 0.8)
    slit = mb.flat("locker_slit", "#151617", 0.8)
    metal = mb.flat("locker_latch", "#a3a59f", 0.35)
    tag = mb.flat("locker_tag", "#d8d4c8", 0.6)
    plinth = mb.flat("locker_plinth", "#2a2b2a", 0.7)
    n = max(1, int(length / cw))
    length = n * cw
    x0 = -length / 2
    s = mb.scale
    base_h = 0.1 * s
    top_h = 0.04 * s
    back = 0.0 if wall else -D
    skip = ("-z", "-y") if wall else ("-y",)
    g.box((x0, base_h, back), (x0 + length, H, back + D), paint, xf, skip=skip + ("+z",))
    g.box((x0 + 0.01, 0, back + 0.03), (x0 + length - 0.01, base_h, back + D - 0.03), plinth, xf, skip=skip)
    front = back + D + 0.008
    tier = (H - base_h - top_h) / 2
    gw = 0.007
    rects = []
    for i in range(n):
        cx0, cx1 = x0 + i * cw, x0 + (i + 1) * cw
        rects.append((cx0, cx0 + gw, base_h, H - top_h, gap))
        rects.append((cx1 - gw, cx1, base_h, H - top_h, gap))
        sw = (cw - 2 * gw) * 0.55
        sx = (cx0 + cx1) / 2 - sw / 2
        for t in range(2):
            y0 = base_h + t * tier
            y1 = y0 + tier
            rects.append((cx0, cx1, y1 - gw, y1, gap))
            for k in range(3):
                for yy in (y1 - 0.065 - k * 0.03, y0 + 0.05 + k * 0.03):
                    rects.append((sx, sx + sw, yy, yy + 0.012, slit))
            lx = cx1 - 0.055
            ly = y0 + tier * 0.5
            rects.append((lx - 0.013, lx + 0.013, ly - 0.06, ly + 0.06, metal))
            rects.append((cx0 + 0.04, cx0 + 0.1, y1 - 0.17, y1 - 0.135, tag))
    g.panel_grid(xf, x0, x0 + length, base_h, H - top_h, front, paint, rects)
    # the carcass front edges round the panel (top band + the panel's own lip)
    g.poly([xf.p(x0, H - top_h, back + D), xf.p(x0 + length, H - top_h, back + D), xf.p(x0 + length, H, back + D),
            xf.p(x0, H, back + D)], paint, xf.d(0, 0, 1))
    g.poly([xf.p(x0, H - top_h, back + D), xf.p(x0, H - top_h, front), xf.p(x0 + length, H - top_h, front),
            xf.p(x0 + length, H - top_h, back + D)], paint, xf.d(0, 1, 0))
    g.poly([xf.p(x0, base_h, back + D), xf.p(x0 + length, base_h, back + D), xf.p(x0 + length, base_h, front),
            xf.p(x0, base_h, front)], paint, xf.d(0, -1, 0))
    for x, nx in ((x0, -1), (x0 + length, 1)):
        g.poly([xf.p(x, base_h, back + D), xf.p(x, base_h, front), xf.p(x, H - top_h, front),
                xf.p(x, H - top_h, back + D)], paint, xf.d(nx, 0, 0))
