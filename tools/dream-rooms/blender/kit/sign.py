"""Dream Rooms kit · prop `sign`: a plaque on a wall (or at pos) whose face is the text surface
S_<module>__<propId>. The words are drawn live by the viewer; the bake shows a blank lit plaque.
Size 0.9 x 0.3 m x scale (longer when `text` is long), hung a little above head height."""

from __future__ import annotations


def size(mb, prop):
    s = mb.scale
    n = len(prop.get("text") or "")
    w = min(2.6, max(0.9, 0.06 * n)) * s
    return w, 0.3 * s


def reserve(mb, prop):
    w, h = size(mb, prop)
    if prop.get("wall"):
        mb.place(prop, length=w + 0.2, height=min(mb.h, 2.2 * mb.scale + h))


def build(mb, prop):
    w, h = size(mb, prop)
    xf, wall = mb.place(prop)
    cy = min(2.1 * mb.scale, mb.h - h / 2 - 0.15)
    if not wall and prop.get("pos"):
        cy = max(h / 2 + 0.05, float(prop["pos"][1]) or cy)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    face = prop.get("color") or "#2f3638"
    body = mb.flat("sign_body", face, 0.5)
    g.box((-w / 2, cy - h / 2, 0.0), (w / 2, cy + h / 2, 0.03), body, xf, skip=("-z",) if wall else ())
    mb.surface(prop["id"], xf.p(0, cy, 0.034), xf.f, round(w - 0.04, 3), round(h - 0.04, 3), face)
