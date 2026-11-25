"""Dream Rooms kit · prop `coat`: a coat hanging on a hook (an absence, never a person).

On a wall at `at`: a hook at 1.75 m x scale with the coat hanging from it. At `pos`: a free-standing
coat stand with the coat on it. Colour: the prop's `color`, else a dark grey."""

from __future__ import annotations


def reserve(mb, prop):
    if prop.get("wall"):
        mb.place(prop, length=0.7 * mb.scale, height=1.9 * mb.scale)


def coat(g, xf, s, cloth, z0, hook_y):
    # shoulders, body, hem: three stacked slabs that widen toward the hem; a collar
    y = hook_y - 0.06 * s
    g.box((-0.2 * s, y - 0.16 * s, z0), (0.2 * s, y, z0 + 0.16 * s), cloth, xf)
    g.box((-0.24 * s, y - 0.78 * s, z0 + 0.005), (0.24 * s, y - 0.16 * s, z0 + 0.17 * s), cloth, xf)
    g.box((-0.27 * s, y - 1.02 * s, z0 + 0.01), (0.27 * s, y - 0.78 * s, z0 + 0.18 * s), cloth, xf)
    g.box((-0.09 * s, y - 0.02 * s, z0 + 0.02 * s), (0.09 * s, y + 0.05 * s, z0 + 0.14 * s), cloth, xf)
    for x in (-0.3 * s, 0.3 * s):  # sleeves
        g.box((x - 0.05 * s, y - 0.7 * s, z0 + 0.03 * s), (x + 0.05 * s, y - 0.1 * s, z0 + 0.15 * s), cloth, xf)


def build(mb, prop):
    s = mb.scale
    xf, wall = mb.place(prop)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    cloth = mb.flat("coat", prop.get("color") or "#43484d", 0.95)
    metal = mb.flat("coat_hook", "#8d8a84", 0.35)
    hook_y = 1.75 * s
    if wall:
        g.box((-0.02, hook_y - 0.04, 0), (0.02, hook_y + 0.04, 0.07), metal, xf, skip=("-z",))
        coat(g, xf, s, cloth, 0.02, hook_y)
        return
    # a coat stand: base, pole, the coat hung on its arm
    g.box((-0.2 * s, 0, -0.2 * s), (0.2 * s, 0.03, 0.2 * s), metal, xf, skip=("-y",))
    g.box((-0.02, 0.03, -0.02), (0.02, hook_y + 0.12 * s, 0.02), metal, xf)
    coat(g, xf, s, cloth, 0.03, hook_y)
