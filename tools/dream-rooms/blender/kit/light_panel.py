"""Dream Rooms kit · prop `light-panel`: one cited light fixture (a glowing panel).

At `pos`: flush under the ceiling above pos (0.6 x 1.2 m x scale). On a wall: a wall-mounted light box
at 2.2 m x scale. It is a real emitter: it lights the bake."""

from __future__ import annotations


def reserve(mb, prop):
    if prop.get("wall"):
        mb.place(prop, length=0.9 * mb.scale, height=mb.h)


def build(mb, prop):
    s = mb.scale
    col = prop.get("color") or "#f2f0e6"
    mat = mb.flat("light_panel", "#f4f4ee", 0.4, emit=col, strength=6.0)
    rim = mb.flat("light_rim", "#cfcdc6", 0.5)
    if prop.get("wall"):
        xf, _ = mb.place(prop)
        g = mb.prop_mesh(prop, pivot_local=xf.o)
        y = min(2.2 * s, mb.h - 0.4)
        g.box((-0.45 * s, y, 0), (0.45 * s, y + 0.18 * s, 0.1), rim, xf, skip=("-z",))
        g.box((-0.42 * s, y + 0.02, 0.1), (0.42 * s, y + 0.18 * s - 0.02, 0.104), mat, xf, skip=("-z",))
        return
    x, _, z = prop.get("pos") or [mb.w / 2, 0, mb.d / 2]
    h = mb.h
    g = mb.prop_mesh(prop, pivot_local=(x, h, z))
    pw, pl = 0.6 * s, 1.2 * s
    g.box((x - pw / 2 - 0.02, h - 0.03, z - pl / 2 - 0.02), (x + pw / 2 + 0.02, h, z + pl / 2 + 0.02), rim,
          skip=("+y",))
    g.box((x - pw / 2, h - 0.034, z - pl / 2), (x + pw / 2, h - 0.03, z + pl / 2), mat, skip=("+y",))
