"""Dream Rooms kit · prop `board`: a departure board / notice board on a wall (or at pos).

3.2 x 1.1 m x scale housing, its dark face the text surface S_<module>__<propId> (the viewer draws the
words live). Hung high, like a board you read from across a hall."""

from __future__ import annotations


def size(mb, prop):
    s = mb.scale
    return 3.2 * s, 1.1 * s, 0.18 * s


def reserve(mb, prop):
    w, h, _ = size(mb, prop)
    if prop.get("wall"):
        mb.place(prop, length=w + 0.3, height=mb.h)


def build(mb, prop):
    w, h, dep = size(mb, prop)
    xf, wall = mb.place(prop)
    bottom = min(2.05 * mb.scale, mb.h - h - 0.25)
    bottom = max(1.2, bottom)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    housing = mb.flat("board_housing", prop.get("color") or "#2a2c2e", 0.55)
    face_hex = "#121416"
    face = mb.flat("board_face", face_hex, 0.35)
    z0 = 0.0 if wall else -dep / 2
    g.box((-w / 2, bottom, z0), (w / 2, bottom + h, z0 + dep), housing, xf, skip=("-z",) if wall else ())
    inset = 0.07 * mb.scale
    g.box((-w / 2 + inset, bottom + inset, z0 + dep), (w / 2 - inset, bottom + h - inset, z0 + dep + 0.004), face, xf,
          skip=("-z",))
    if not wall:  # two hanging rods to the ceiling
        rod = mb.flat("board_rod", "#4a4c4e", 0.4)
        for x in (-w * 0.35, w * 0.35):
            g.box((x - 0.012, bottom + h, -0.012), (x + 0.012, mb.h, 0.012), rod, xf, skip=("+y",))
    mb.surface(prop["id"], xf.p(0, bottom + h / 2, z0 + dep + 0.008), xf.f, round(w - 2 * inset - 0.02, 3),
               round(h - 2 * inset - 0.02, 3), face_hex)
