"""Dream Rooms kit · prop `door`: a shut door on a wall (decoration; real openings are doorways).

A touch tall on purpose (2.2 m x scale, clamped under the ceiling). The leaf sits in a 4 cm reveal cut
into the wall (real geometry), with two raised panels, a lever handle and an architrave. A door that a
swap targets (P_ node) is built proud of the wall instead, so hiding it never leaves a hole.
The corridor kit calls reserve_decorative() / decorative() for its numbered doors.
"""

from __future__ import annotations

from common import Wall, Xf

REVEAL = 0.04
FRAME_W = 0.075
FRAME_D = 0.022


def dims(mb):
    s = mb.scale
    lw = min(0.92 * s, 1.05)
    lh = min(2.2 * s, mb.h - 0.5)
    return lw, lh


def reserve_decorative(mb, side, at, recessed=True):
    lw, lh = dims(mb)
    if recessed:
        mb.holes[side].append((at - lw / 2, at + lw / 2, 0.0, lh, "door"))
    mb.obstacle(side, at - lw / 2 - FRAME_W - 0.1, at + lw / 2 + FRAME_W + 0.1, 0.0, lh + 0.45)


LEAF = "#57473a"   # doors that matter: darker than any plain wall (no dream colour exists for doors)


def decorative(mb, side, at, mesh=None, recessed=True, colour=LEAF, sign=None):
    """Build one shut door at `at` on wall `side` into `mesh` (default: the module's door group).
    sign: True/False to force a numbered plaque; None = when the module has numbered doors."""
    lw, lh = dims(mb)
    wall = Wall(side, mb.size)
    xf = Xf.facing(wall.point(at), wall.inward)
    g = mesh or mb.group("doors", 0.9)
    leaf = mb.flat("door_leaf", colour, 0.55)
    panel = mb.flat("door_panel", "#625142" if colour == LEAF else colour, 0.5)
    trim = mb.trim_mat()
    metal = mb.flat("door_handle", "#b3aa96", 0.35)
    z = -REVEAL if recessed else 0.035
    if recessed:
        g.poly([xf.p(-lw / 2, 0, -REVEAL), xf.p(-lw / 2, 0, 0), xf.p(-lw / 2, lh, 0), xf.p(-lw / 2, lh, -REVEAL)],
               trim, xf.d(1, 0, 0))
        g.poly([xf.p(lw / 2, 0, -REVEAL), xf.p(lw / 2, lh, -REVEAL), xf.p(lw / 2, lh, 0), xf.p(lw / 2, 0, 0)],
               trim, xf.d(-1, 0, 0))
        g.poly([xf.p(-lw / 2, lh, -REVEAL), xf.p(-lw / 2, lh, 0), xf.p(lw / 2, lh, 0), xf.p(lw / 2, lh, -REVEAL)],
               trim, xf.d(0, -1, 0))
        g.poly([xf.p(-lw / 2, 0, z), xf.p(lw / 2, 0, z), xf.p(lw / 2, lh, z), xf.p(-lw / 2, lh, z)], leaf, xf.f)
    else:
        g.box((-lw / 2, 0, 0), (lw / 2, lh, 0.035), leaf, xf, skip=("-z", "-y"))
    # two raised panels
    m = 0.11
    ph = (lh - 3 * m) / 2
    for k in range(2):
        y0 = m + k * (ph + m)
        g.box((-lw / 2 + m, y0, z), (lw / 2 - m, y0 + ph, z + 0.012), panel, xf, skip=("-z",))
    # lever handle (hinge on the left as you face it)
    hx = lw / 2 - 0.085
    g.box((hx - 0.025, 0.98, z), (hx + 0.025, 1.12, z + 0.012), metal, xf, skip=("-z",))
    g.box((hx - 0.13, 1.03, z + 0.012), (hx + 0.012, 1.055, z + 0.06), metal, xf, skip=())
    # architrave
    g.box((-lw / 2 - FRAME_W, 0, 0), (-lw / 2, lh + FRAME_W, FRAME_D), trim, xf, skip=("-z", "-y"))
    g.box((lw / 2, 0, 0), (lw / 2 + FRAME_W, lh + FRAME_W, FRAME_D), trim, xf, skip=("-z", "-y"))
    g.box((-lw / 2, lh, 0), (lw / 2, lh + FRAME_W, FRAME_D), trim, xf, skip=("-z", "-x", "+x"))
    if sign or (sign is None and mb.numbered):
        mb.sign_above(xf, lh + FRAME_W)
    return xf


def reserve(mb, prop):
    if prop.get("wall"):
        reserve_decorative(mb, prop["wall"], float(prop.get("at", Wall(prop["wall"], mb.size).length / 2)),
                           recessed=prop["id"] not in mb.swapped)


def build(mb, prop):
    colour = prop.get("color") or LEAF
    if prop.get("wall"):
        at = float(prop.get("at", Wall(prop["wall"], mb.size).length / 2))
        recessed = prop["id"] not in mb.swapped
        pivot = Wall(prop["wall"], mb.size).point(at)
        g = mb.prop_mesh(prop, pivot_local=pivot)
        decorative(mb, prop["wall"], at, g, recessed, colour, sign=False)
        return
    xf, _ = mb.place(prop)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    lw, lh = dims(mb)
    leaf = mb.flat("door_leaf", colour, 0.55)
    trim = mb.trim_mat()
    g.box((-lw / 2, 0, -0.02), (lw / 2, lh, 0.02), leaf, xf, skip=("-y",))
    g.box((-lw / 2 - FRAME_W, 0, -0.05), (-lw / 2, lh + FRAME_W, 0.05), trim, xf, skip=("-y",))
    g.box((lw / 2, 0, -0.05), (lw / 2 + FRAME_W, lh + FRAME_W, 0.05), trim, xf, skip=("-y",))
    g.box((-lw / 2, lh, -0.05), (lw / 2, lh + FRAME_W, 0.05), trim, xf, skip=())
