"""Dream Rooms kit · the room shell every module kit shares.

    build_shell(mb, walls="nsew", floor_holes=(), ceiling=True)

  * floor + ceiling, cut into <= 8 m cells (so a big hall can spread over several atlases);
  * walls facing inward, built AROUND their openings (doorways + anything a kit put in mb.holes);
  * per doorway: the frame on the room face, the jambs through the wall, the Z-stub behind it
    (CONTRACTS.md §5: out 0.9, sideways 1.6 toward the left of `out`, out 0.9, a dead end; 1.1 m wide,
    2.25 m tall), a faint sourceless fill inside it, a numbered plaque + doors-sign surface when the
    module has numbered doors, and a D_ empty at its centre (copy 0).
Everything faces the walker.
"""

from __future__ import annotations

import common as C
from common import DOOR, STUB, Wall, Xf

CHUNK = 8.0
FRAME_W = 0.07
FRAME_D = 0.022


def build_shell(mb, walls="nsew", floor_holes=(), ceiling=True, wall_top=None):
    w, h, d = mb.size
    F = mb.fin
    C.floor_with_holes(lambda ix, iz: mb.group(("floor", ix, iz), F["floor"].weight), 0.0, w, 0.0, d, 0.0,
                       list(floor_holes), F["floor"].mat, up=True, chunk=CHUNK)
    if ceiling:
        C.floor_with_holes(lambda ix, iz: mb.group(("ceiling", ix, iz), F["ceiling"].weight), 0.0, w, 0.0, d, h,
                           [], F["ceiling"].mat, up=False, chunk=CHUNK)
    for side in walls:
        wall = Wall(side, mb.size)
        C.wall_with_holes(None, wall, wall_top or h, [hh[:4] for hh in mb.holes[side]], F["walls"].mat,
                          chunk=CHUNK, split_cb=lambda k, s=side: mb.group(("wall", s, k), F["walls"].weight))
    for dw, fr in mb.doorways:
        doorway(mb, dw, fr)


def doorway(mb, dw, fr):
    F = mb.fin
    stub = mb.group(("stub", dw["id"]), 0.45)
    C.build_stub(stub, fr, {"floor": F["floor"].mat, "walls": F["walls"].mat, "ceiling": F["ceiling"].mat})
    xf = Xf.facing(fr["centre"], fr["inward"])
    trim = mb.group("trim", 0.6)
    tm = mb.trim_mat()
    hw = DOOR["w"] / 2
    trim.box((-hw - FRAME_W, 0, 0), (-hw, DOOR["h"] + FRAME_W, FRAME_D), tm, xf, skip=("-z", "-y"))
    trim.box((hw, 0, 0), (hw + FRAME_W, DOOR["h"] + FRAME_W, FRAME_D), tm, xf, skip=("-z", "-y"))
    trim.box((-hw, DOOR["h"], 0), (hw, DOOR["h"] + FRAME_W, FRAME_D), tm, xf, skip=("-z", "-x", "+x"))
    if mb.numbered:
        mb.sign_above(xf, DOOR["h"] + FRAME_W)
    # a faint sourceless fill in leg 2, so the stub is never black (no fixture you could see)
    m = fr["m"]
    mb.lights.append(C.point_light(mb.coll, f"L_{mb.id}_{mb.copy}_stub_{dw['id']}", C.add(mb.base, (m[0], 1.7, m[2])),
                                   mb.light_level * 0.25, C.warmth_hex(mb.world["look"].get("warmth", 0.5)), 0.3))
    if mb.copy == 0:
        mb.doorway_empties.append((dw["id"], C.add(mb.base, fr["centre"]), fr["inward"]))


def free_spot(mb, side, want_w, y0, y1, margin=0.3, ends=0.3):
    """The widest free stretch of a wall between y0 and y1 (away from openings and wall props):
    returns (u_centre, width) or None."""
    wall = Wall(side, mb.size)
    lo, hi = ends, wall.length - ends
    blocks = sorted((a - margin, b + margin) for (a, b, c, dd) in mb.obstacles[side] if c < y1 and dd > y0)
    best = None
    cur = lo
    for a, b in blocks + [(hi, hi)]:
        if a > cur:
            seg = (cur, min(a, hi))
            if seg[1] > seg[0] and (best is None or seg[1] - seg[0] > best[1] - best[0]):
                best = seg
        cur = max(cur, b)
        if cur >= hi:
            break
    if not best:
        return None
    width = min(want_w, best[1] - best[0])
    return ((best[0] + best[1]) / 2, width)


def wall_word_surface(mb, side):
    """S_<module>__wall-<side>: a free spot at eye height on that wall, away from doorways."""
    eye = C.WALKER["eye"]
    h = 0.6
    spot = free_spot(mb, side, 2.4, eye - h / 2, eye + h / 2)
    wall = Wall(side, mb.size)
    if spot is None or spot[1] < 0.5:
        # everything at eye height is taken: go above it, or sit in the middle anyway
        spot2 = free_spot(mb, side, 2.4, mb.h - 0.75, mb.h - 0.15) if mb.h > 3.2 else None
        if spot2 and spot2[1] >= 0.8:
            u, ww = spot2
            y = mb.h - 0.45
        else:
            u, ww = wall.length / 2, min(1.6, wall.length - 0.6)
            y = eye
    else:
        u, ww = spot
        y = eye
    ww = max(0.4, ww - 0.1)
    hh = min(h, max(0.25, ww * 0.3))
    centre = wall.point(u, y, 0.004)
    hexcol = mb.fin["walls"].hex
    return mb.surface(f"wall-{side}", centre, wall.inward, round(ww, 3), round(hh, 3), hexcol)


def floor_word_surface(mb):
    x, z = mb.floor_spot or (mb.w / 2, mb.d / 2)
    ww = min(2.4, mb.w - 0.6)
    hh = min(1.0, mb.d - 0.6)
    return mb.surface("floor", (x, 0.004, z), (0, 1, 0), round(ww, 3), round(hh, 3), mb.fin["floor"].hex)


def water_word_surface(mb):
    wt = mb.water
    if not wt:
        return None
    x = (wt["x0"] + wt["x1"]) / 2
    z = (wt["z0"] + wt["z1"]) / 2
    ww = min(5.0, wt["x1"] - wt["x0"] - 1.0)
    hh = min(1.4, wt["z1"] - wt["z0"] - 1.0)
    return mb.surface("water", (x, wt["y"] + 0.004, z), (0, 1, 0), round(ww, 3), round(hh, 3), mb.fin["water"].hex)


def stub_reach():
    """How far a stub reaches beyond its wall (metres), for haze boxes and in-context bounds."""
    return STUB["leg1"] + STUB["leg3"] + STUB["width"]
