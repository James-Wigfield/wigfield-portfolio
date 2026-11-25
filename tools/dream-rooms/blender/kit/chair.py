"""Dream Rooms kit · prop `chair`: a plain school/waiting-room chair (seat, back, four legs).

At `pos` facing +z turned by `rotY`, or against a wall at `at` (pulled 0.3 m off it, facing in).
Sized by module.scale. Colour: the prop's `color`, else a muted grey-brown."""

from __future__ import annotations

from common import Xf, add, mul


def reserve(mb, prop):
    if prop.get("wall"):
        mb.place(prop, length=0.6 * mb.scale, height=0.95 * mb.scale)


def build(mb, prop):
    s = mb.scale
    xf, wall = mb.place(prop)
    if wall:
        xf = Xf(add(xf.o, mul(xf.f, 0.3 * s)), xf.r, xf.u, xf.f)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    col = prop.get("color") or "#6e6a63"
    seat = mb.flat("chair_seat", col, 0.6)
    leg = mb.flat("chair_leg", "#3c3d3e", 0.4)
    w, dep, sh, bh = 0.44 * s, 0.42 * s, 0.46 * s, 0.42 * s
    t = 0.025 * s
    g.box((-w / 2, sh - 0.03 * s, -dep / 2), (w / 2, sh, dep / 2), seat, xf)
    g.box((-w / 2, sh + 0.06 * s, -dep / 2 - t), (w / 2, sh + 0.06 * s + bh * 0.62, -dep / 2), seat, xf)
    for x in (-w / 2 + t, w / 2 - t):
        for z in (-dep / 2 + t, dep / 2 - t):
            g.box((x - t / 2, 0, z - t / 2), (x + t / 2, sh - 0.03 * s, z + t / 2), leg, xf, skip=("-y",))
        g.box((x - t / 2, sh, -dep / 2 - t), (x + t / 2, sh + 0.06 * s + bh * 0.62, -dep / 2), leg, xf)
