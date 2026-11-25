"""Dream Rooms · the Dream Corridor kit -> public/dreams/corridor-kit.glb (static, no private data).

    blender.exe -b --factory-startup --python tools/dream-rooms/blender/corridor_kit.py -- \
        --out <abs dir> [--samples 384] [--atlas 1024] [--preview <abs png>] [--scratch <abs dir>]

CONTRACTS.md §7 + dims.json -> corridor. Every piece is a top-level node built at the origin, running
from z = 0 to z = -length along -z, x centred, floor at y = 0, baked unlit into its own atlas:

  K_entrance  the "now" end: a closed wall at z = 0 (facing -z), the corridor opening to -z
  K_plain     a plain segment
  K_door_l / K_door_r / K_door_lr   a door OPENING at z = -doorZ on the left (x = -width/2), the right,
              or both, each with its Z-stub behind it (dims.json -> stub, the same shape as dream
              doorways) and a blank plaque above it at signY. No leaf: the viewer adds K_leaf.
  K_break     the night-break bay: 0.6 m narrow at each end (so it tiles), break.width wide between;
              a dark window on the RIGHT (+x), a blank wall on the LEFT (-x) for the date stencil at
              stencilY (node extras say where)
  K_end       the far end: walls, floor and ceiling carry on and the light dies away; no end wall
  K_end_door  the empty-state end: an end wall at z = -segment with one shut door (baked) in it
  K_leaf      a door leaf: hinge at the origin, leaf along -z (door.w), front facing +x when shut in a
              left opening (baked shut in a left opening). The viewer rotates / mirrors it.
  K_spill, K_underline   plain floor geometry with materials named `spill` / `underline` (the viewer
              swaps in an additive gradient); same frame as K_leaf; uv.y = 0 at the door, 1 far away

The look: a hotel-or-school-at-night corridor that is too long. Dim and warm-dark; the light comes from
a cove you never see (hidden area lights on top of a cornice ledge wash the ceiling) and a soft glow
from nowhere (hidden area lights under the ceiling); a dark runner on
dark boards; timber wainscot to a dado rail, muted plaster above; doors a touch tall in tall frames
(the ceiling a touch high too). No drop ceiling, no fluorescent panels, no striped wallpaper.
Each piece is baked IN CONTEXT with plain neighbours at both ends (only one where it is an end), so
any order tiles. One exposure for the whole kit, so pieces match.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

import common as C  # noqa: E402
from common import CORR, DOOR, MeshBuilder, Xf, log  # noqa: E402
from kit import finishes  # noqa: E402

W = CORR["width"]
H = CORR["height"]
SEG = CORR["segment"]
DZ = CORR["doorZ"]
BRK = CORR["break"]
LEN = {"entrance": CORR["entrance"]["length"], "plain": SEG, "door_l": SEG, "door_r": SEG, "door_lr": SEG,
       "break": BRK["length"], "end": CORR["end"]["length"], "end_door": SEG}
NARROW = 0.6           # the break bay's narrow ends (stubs of neighbouring doors reach 0.25 m in)
DADO = 0.95
SKIRT = 0.12
CORN0, CORN1, CORN_OUT = 2.56, 2.62, 0.13
FRAME_W, FRAME_D = 0.085, 0.028
LEAF_T = 0.045
REVEAL = 0.04
TARGET = 0.085         # geometric-mean luminance: dim, warm-dark
COVE_HEX = "#ffc794"
COVE_W_PER_M = 4.4     # the cove: hidden area lights on the cornice ledge, pointing up
FILL_HEX = "#ffe3c8"
FILL_W_PER_M2 = 9.0    # the glow from nowhere: a hidden area light under the ceiling, uniform along z

PIECES = ["entrance", "plain", "door_l", "door_r", "door_lr", "break", "end", "end_door", "leaf"]


def parse():
    p = argparse.ArgumentParser(prog="corridor_kit.py")
    p.add_argument("--out", required=True)
    p.add_argument("--scratch", default=None)
    p.add_argument("--samples", type=int, default=512)
    p.add_argument("--atlas", type=int, default=1024, help="max atlas size per piece")
    p.add_argument("--preview", default=None, help="render a still down a sample layout to this PNG")
    p.add_argument("--webp-quality", type=int, default=86)
    return C.script_args(p)


# ── materials ────────────────────────────────────────────────────────────────
def mottled(name, hexcol):
    """Old paint: a faint, large mottling (+-4 %), so long walls never look computer-flat."""
    m, nt, b = C.new_material(name)
    n = C.node(nt, "ShaderNodeTexNoise", Scale=1.3, Detail=3.0, Roughness=0.55)
    nt.links.new(C.tex_uv(nt), n.inputs["Vector"])
    nt.links.new(C.ramp(nt, n.outputs["Fac"], [(0.3, C.shade_hex(hexcol, 0.95)), (0.7, C.shade_hex(hexcol, 1.04))]),
                 b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.88
    return m


class Mats:
    def __init__(self):
        self.plaster = mottled("src_k_plaster", "#9c8673")
        self.ceiling = mottled("src_k_ceiling", "#ad9c88")
        self.wainscot = finishes.make("timber", "#5e4231", "walls")
        self.trim = C.flat("src_k_trim", "#3d2a20", 0.45)
        self.frame = C.flat("src_k_frame", "#4a3326", 0.45)
        self.floor = finishes.make("timber", "#4d3a2c", "floor")
        self.runner = finishes.make("carpet", "#6a3631", "floor")
        self.border = C.flat("src_k_runner_border", "#6a5434", 0.9)
        self.plaque = C.flat("src_k_plaque", "#2b231d", 0.4)
        self.plaque_rim = C.flat("src_k_plaque_rim", "#8c7448", 0.35)
        self.leaf = C.flat("src_k_leaf", "#553a2b", 0.5)
        self.leaf_panel = C.flat("src_k_leaf_panel", "#5e4130", 0.45)
        self.handle = C.flat("src_k_handle", "#a48a5a", 0.3)
        self.glass = C.flat("src_k_glass", "#05070a", 0.05)
        self.black = C.flat("src_k_black", "#000000", 1.0)
        self.stub_wall = C.flat("src_k_stub_wall", "#8a7563", 0.9)


# ── a piece under construction ───────────────────────────────────────────────
class Piece:
    """Geometry groups for one piece at z offset z0 (piece-local z runs 0 -> -length)."""

    def __init__(self, coll, name, z0, context=False):
        self.coll = coll
        self.name = name
        self.z0 = z0
        self.context = context
        self.groups = {}
        self.lights = []

    def g(self, key, weight):
        if key not in self.groups:
            self.groups[key] = (MeshBuilder(f"{self.name}_{key}_{self.z0:g}", (0.0, 0.0, self.z0)), weight)
        return self.groups[key][0]

    def finish(self):
        objs = []
        for key, (m, w) in self.groups.items():
            if m.empty():
                continue
            ob = m.to_object(self.coll)
            ob["k_weight"] = w
            objs.append(ob)
        self.objects = objs
        self.names = [o.name for o in objs]
        self.light_names = [lt.name for lt in self.lights]
        return objs


def side_wall(P, M, side, z_from, z_to, holes, cove_k=lambda z: 1.0, upper_mat=None):
    """A long wall (side -1 = left at x = -W/2 .. or the given plane) from z_from to z_to (z_from > z_to),
    holes [(z_centre, width, y0, y1)]. Plaster above a timber wainscot, skirting, dado rail, the cornice
    ledge with its hidden cove strip. All facing into the corridor."""
    x = side * W / 2 if isinstance(side, int) else side[0]
    n = (-1 if x > 0 else 1, 0, 0)
    return wall_run(P, M, lambda u, y, off=0.0: (x + n[0] * off, y, z_from - u), n, z_from - z_to, holes_u(holes, z_from),
                    cove_k=lambda u: cove_k(z_from - u), upper_mat=upper_mat)


def holes_u(holes, z_from):
    return [(z_from - zc - wd / 2, z_from - zc + wd / 2, y0, y1) for (zc, wd, y0, y1) in holes]


def free_runs(L, holes, y0, y1):
    """u-intervals of [0, L] not cut by a hole spanning [y0, y1]."""
    cuts = sorted((a, b) for (a, b, c, d) in holes if c < y1 and d > y0)
    out, cur = [], 0.0
    for a, b in cuts:
        if a > cur:
            out.append((cur, a))
        cur = max(cur, b)
    if cur < L:
        out.append((cur, L))
    return [r for r in out if r[1] - r[0] > 1e-4]


def wall_run(P, M, pt, n, L, holes, cove_k=lambda u: 1.0, upper_mat=None, weight=1.0):
    """A wall in its own (u along, y up) parametrisation: pt(u, y, off) -> point, n = inward normal."""
    walls = P.g("walls", weight)
    lower = P.g("wainscot", weight)
    trim = P.g("trim", 0.7)

    def plane(target, mat, v0, v1):
        us = {0.0, L}
        vs = {v0, v1}
        for (a, b, c, d) in holes:
            for u in (a, b):
                if 0 < u < L:
                    us.add(u)
            for v in (c, d):
                if v0 < v < v1:
                    vs.add(v)
        us, vs_ = sorted(us), sorted(vs)
        for i in range(len(us) - 1):
            for j in range(len(vs_) - 1):
                a, b, c, d = us[i], us[i + 1], vs_[j], vs_[j + 1]
                cu, cv = (a + b) / 2, (c + d) / 2
                if any(h0 <= cu <= h1 and h2 <= cv <= h3 for (h0, h1, h2, h3) in holes):
                    continue
                target.poly([pt(a, c), pt(b, c), pt(b, d), pt(a, d)], mat, n)

    plane(lower, M.wainscot, 0.0, DADO)
    plane(walls, upper_mat or M.plaster, DADO, H)

    def strip(target, mat, u0, u1, y0, y1, out, skip_ends=False):
        a0, a1 = pt(u0, y0), pt(u1, y0)
        b0, b1 = pt(u0, y1), pt(u1, y1)
        o0, o1 = pt(u0, y0, out), pt(u1, y0, out)
        p0, p1 = pt(u0, y1, out), pt(u1, y1, out)
        target.poly([o0, o1, p1, p0], mat, n)                       # front
        target.poly([b0, b1, p1, p0], mat, (0, 1, 0))               # top
        target.poly([a0, a1, o1, o0], mat, (0, -1, 0))              # underside
        if not skip_ends:
            e = C.sub(pt(u1, 0), pt(u0, 0))
            e = C.norm(e)
            target.poly([a0, o0, p0, b0], mat, C.mul(e, -1))
            target.poly([a1, o1, p1, b1], mat, e)

    for (u0, u1) in free_runs(L, holes, 0.0, SKIRT):
        strip(trim, M.trim, u0, u1, 0.0, SKIRT, 0.016)
    for (u0, u1) in free_runs(L, holes, DADO - 0.02, DADO + 0.02):
        strip(trim, M.trim, u0, u1, DADO - 0.02, DADO + 0.025, 0.024)
    for (u0, u1) in free_runs(L, holes, CORN0, CORN1):
        strip(trim, M.trim, u0, u1, CORN0, CORN1, CORN_OUT, skip_ends=True)
        # the hidden cove: an area light lying on the ledge pointing up (never seen, not even in a
        # reflection), in 1 m pieces so it can fade (K_end)
        k = max(1, math.ceil(u1 - u0 - 1e-6))
        for i in range(k):
            a = u0 + (u1 - u0) * i / k
            b = u0 + (u1 - u0) * (i + 1) / k
            f = cove_k((a + b) / 2)
            if f <= 0.01:
                continue
            c = pt((a + b) / 2, CORN1 + 0.01, (0.02 + CORN_OUT - 0.015) / 2)
            e = C.sub(pt(b, 0), pt(a, 0))
            ln = b - a
            size = (ln, CORN_OUT - 0.035) if abs(e[0]) > abs(e[2]) else (CORN_OUT - 0.035, ln)
            P.lights.append(C.area_light(P.coll, f"L_{P.name}_cove_{P.z0:g}_{len(P.lights)}", C.add(c, (0, 0, P.z0)),
                                         size, COVE_W_PER_M * ln * f, COVE_HEX, down=False))


def floor_ceiling(P, M, x0, x1, z_from, z_to, runner=True, ceiling=True):
    fl = P.g("floor", 0.8)
    fl.poly([(x0, 0, z_from), (x1, 0, z_from), (x1, 0, z_to), (x0, 0, z_to)], M.floor, (0, 1, 0))
    if ceiling:
        ce = P.g("ceiling", 0.5)
        ce.poly([(x0, H, z_from), (x1, H, z_from), (x1, H, z_to), (x0, H, z_to)], M.ceiling, (0, -1, 0))


def fill(P, x0, x1, z_from, z_to, fade=lambda z: 1.0):
    """The sourceless glow: hidden area lights just under the ceiling, 1 m long each so the light is
    uniform along z (pieces tile) and can fade (K_end). Never visible, not even in reflections."""
    n = max(1, round(z_from - z_to))
    step = (z_from - z_to) / n
    for i in range(n):
        za = z_from - i * step
        zc = za - step / 2
        k = fade(zc)
        if k <= 0.01:
            continue
        pw = FILL_W_PER_M2 * (x1 - x0) * step * k
        P.lights.append(C.area_light(P.coll, f"L_{P.name}_fill_{P.z0:g}_{i}", ((x0 + x1) / 2, H - 0.04, zc + P.z0),
                                     ((x1 - x0) * 0.8, step), pw, FILL_HEX))


def runner(P, M, z_from, z_to, fade=None):
    """The runner: 1.1 m wide, 7 mm proud, a thin border line near each edge. One connected panel."""
    rw = 1.1
    t = 0.007
    xf = Xf((0, 0, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0))  # local x = x, local y = deeper (-z), z = up
    g = P.g("runner", 0.8)
    y0, y1 = -z_from, -z_to
    rects = [(-rw / 2 + 0.06, -rw / 2 + 0.075, y0, y1, M.border), (rw / 2 - 0.075, rw / 2 - 0.06, y0, y1, M.border)]
    g.panel_grid(xf, -rw / 2, rw / 2, y0, y1, t, M.runner, rects)
    for x, nx in ((-rw / 2, -1), (rw / 2, 1)):
        g.poly([(x, 0, z_from), (x, 0, z_to), (x, t, z_to), (x, t, z_from)], M.runner, (nx, 0, 0))


def opening_frame(P, M, xf, w, h):
    """An architrave round an opening (frame xf: origin = bottom centre on the wall plane, f = into the
    corridor)."""
    g = P.g("frames", 0.9)
    g.box((-w / 2 - FRAME_W, 0, 0), (-w / 2, h + FRAME_W, FRAME_D), M.frame, xf, skip=("-z", "-y"))
    g.box((w / 2, 0, 0), (w / 2 + FRAME_W, h + FRAME_W, FRAME_D), M.frame, xf, skip=("-z", "-y"))
    g.box((-w / 2, h, 0), (w / 2, h + FRAME_W, FRAME_D), M.frame, xf, skip=("-z", "-x", "+x"))


def plaque(P, M, xf):
    """The blank sign plaque above a door, centred at signY (the viewer draws the sign there)."""
    g = P.g("frames", 0.9)
    sw, sh = CORR["signW"], CORR["signH"]
    y = CORR["signY"]
    g.box((-sw / 2 - 0.03, y - sh / 2 - 0.03, 0), (sw / 2 + 0.03, y + sh / 2 + 0.03, 0.012), M.plaque_rim, xf,
          skip=("-z",))
    g.box((-sw / 2, y - sh / 2, 0.012), (sw / 2, y + sh / 2, 0.016), M.plaque, xf, skip=("-z",))


def door_side(P, M, side):
    """An opening at z = -doorZ on `side` (-1 left, +1 right) + frame + plaque + Z-stub."""
    x = side * W / 2
    inward = (-side, 0, 0)
    xf = Xf.facing((x, 0, -DZ), inward)
    opening_frame(P, M, xf, DOOR["w"], DOOR["h"])
    plaque(P, M, xf)
    fr = {"centre": (x, 0.0, -DZ), "inward": inward, "out": (side, 0, 0), "side": C.left_of((side, 0, 0))}
    st = P.g("stub", 0.4)
    C.build_stub(st, fr, {"floor": M.floor, "walls": M.stub_wall, "ceiling": M.stub_wall})
    s = fr["side"]
    m = (x + side * C.STUB["leg1"] + s[0] * C.STUB["leg2"] / 2, 1.7, -DZ + s[2] * C.STUB["leg2"] / 2)
    P.lights.append(C.point_light(P.coll, f"L_{P.name}_stub_{side}_{P.z0:g}", C.add(m, (0, 0, P.z0)), 1.2,
                                  "#ffcf9e", 0.3))


def build_piece(coll, kind, z0=0.0, context=False, M=None):
    """Build piece `kind` with its start at world z0 (its geometry runs z0 .. z0 - length)."""
    P = Piece(coll, kind, z0, context)
    L = LEN.get(kind, SEG)
    door_hole = (-DZ, DOOR["w"], 0.0, DOOR["h"])
    if kind in ("plain", "door_l", "door_r", "door_lr", "entrance", "end", "end_door"):
        fade = (lambda z: max(0.0, 1.0 - (-z) / 6.5) ** 1.6) if kind == "end" else (lambda z: 1.0)
        lh = [door_hole] if kind in ("door_l", "door_lr") else []
        rh = [door_hole] if kind in ("door_r", "door_lr") else []
        side_wall(P, M, -1, 0.0, -L, lh, cove_k=fade)
        side_wall(P, M, 1, 0.0, -L, rh, cove_k=fade)
        floor_ceiling(P, M, -W / 2, W / 2, 0.0, -L)
        runner(P, M, 0.0, -L)
        fill(P, -W / 2, W / 2, 0.0, -L, fade)
        if kind in ("door_l", "door_lr"):
            door_side(P, M, -1)
        if kind in ("door_r", "door_lr"):
            door_side(P, M, 1)
        if kind == "entrance":
            end_wall(P, M, 0.0, facing=-1)
        if kind == "end_door":
            end_wall(P, M, -L, facing=1, door=True)
    elif kind == "break":
        build_break(P, M)
    P.finish()
    return P


def end_wall(P, M, z, facing, door=False):
    """A wall across the corridor at z, facing +z (facing=1) or -z (-1), with an optional shut door."""
    n = (0, 0, facing)
    # parametrise u along +x from the left wall (seen from inside, the wall's u direction doesn't matter)
    pt = (lambda u, y, off=0.0: (-W / 2 + u, y, z + facing * off))
    holes = [(W / 2 - DOOR["w"] / 2, W / 2 + DOOR["w"] / 2, 0.0, DOOR["h"])] if door else []
    wall_run(P, M, pt, n, W, holes)
    if door:
        xf = Xf.facing((0.0, 0.0, z), n)
        opening_frame(P, M, xf, DOOR["w"], DOOR["h"])
        plaque(P, M, xf)
        g = P.g("frames", 0.9)
        hw = DOOR["w"] / 2
        # reveal + a shut leaf, baked (this door never opens)
        g.poly([xf.p(-hw, 0, -REVEAL), xf.p(-hw, 0, 0), xf.p(-hw, DOOR["h"], 0), xf.p(-hw, DOOR["h"], -REVEAL)],
               M.frame, xf.d(1, 0, 0))
        g.poly([xf.p(hw, 0, -REVEAL), xf.p(hw, DOOR["h"], -REVEAL), xf.p(hw, DOOR["h"], 0), xf.p(hw, 0, 0)],
               M.frame, xf.d(-1, 0, 0))
        g.poly([xf.p(-hw, DOOR["h"], -REVEAL), xf.p(-hw, DOOR["h"], 0), xf.p(hw, DOOR["h"], 0),
                xf.p(hw, DOOR["h"], -REVEAL)], M.frame, xf.d(0, -1, 0))
        leaf_faces(g, M, Xf(xf.p(hw, 0, -REVEAL), C.mul(xf.r, -1), xf.u, xf.f), front_only=True)


def leaf_faces(g, M, xf, front_only=False):
    """A panelled leaf in frame xf: hinge edge at local x = 0, the leaf along local +x for door.w, front
    face at local z = 0 facing +z, thickness behind it."""
    lw = DOOR["w"] - 0.006
    lh = DOOR["h"] - 0.006
    if front_only:
        g.poly([xf.p(0, 0, 0), xf.p(lw, 0, 0), xf.p(lw, lh, 0), xf.p(0, lh, 0)], M.leaf, xf.f)
    else:
        g.box((0, 0, -LEAF_T), (lw, lh, 0), M.leaf, xf, skip=("-y",))
    m = 0.12
    ph = (lh - 3 * m) / 2
    faces = [(0, 1)] if front_only else [(0, 1), (-LEAF_T, -1)]
    for zf, sgn in faces:
        for k in range(2):
            y0 = m + k * (ph + m)
            if sgn > 0:
                g.box((m, y0, zf), (lw - m, y0 + ph, zf + 0.012), M.leaf_panel, xf, skip=("-z",))
            else:
                g.box((m, y0, zf - 0.012), (lw - m, y0 + ph, zf), M.leaf_panel, xf, skip=("+z",))
        hx = lw - 0.085
        if sgn > 0:
            g.box((hx - 0.025, 0.97, zf), (hx + 0.025, 1.11, zf + 0.012), M.handle, xf, skip=("-z",))
            g.box((hx - 0.12, 1.025, zf + 0.012), (hx + 0.012, 1.05, zf + 0.06), M.handle, xf)
        else:
            g.box((hx - 0.025, 0.97, zf - 0.012), (hx + 0.025, 1.11, zf), M.handle, xf, skip=("+z",))
            g.box((hx - 0.12, 1.025, zf - 0.06), (hx + 0.012, 1.05, zf - 0.012), M.handle, xf)


def build_break(P, M):
    L = BRK["length"]
    bw = BRK["width"]
    a, b = -NARROW, -(L - NARROW)
    # narrow ends: the normal corridor cross-section, so the bay tiles with anything
    for (z_from, z_to) in ((0.0, a), (b, -L)):
        side_wall(P, M, -1, z_from, z_to, [])
        side_wall(P, M, 1, z_from, z_to, [])
        floor_ceiling(P, M, -W / 2, W / 2, z_from, z_to)
    fill(P, -W / 2, W / 2, 0.0, a)
    fill(P, -W / 2, W / 2, b, -L)
    # the bay
    floor_ceiling(P, M, -bw / 2, bw / 2, a, b)
    fill(P, -bw / 2, bw / 2, a, b)
    runner(P, M, 0.0, -L)
    zc = -L / 2
    win = (zc, BRK["windowW"], BRK["windowSill"], BRK["windowSill"] + BRK["windowH"])
    side_wall(P, M, (-bw / 2,), a, b, [])                 # the stencil wall (left)
    side_wall(P, M, (bw / 2,), a, b, [win])               # the window wall (right)
    # the returns where the bay widens / narrows (facing into the bay)
    for z, facing in ((a, -1), (b, 1)):
        for sgn in (-1, 1):
            x_in, x_out = sgn * W / 2, sgn * bw / 2
            lo, hi = min(x_in, x_out), max(x_in, x_out)
            pt = (lambda u, y, off=0.0, lo=lo, z=z, facing=facing: (lo + u, y, z + facing * off))
            wall_run(P, M, pt, (0, 0, facing), hi - lo, [])
    # the window: a deep reveal, dark glass at the back, black beyond, a sill
    x = bw / 2
    y0, y1 = win[2], win[3]
    z0, z1 = zc + BRK["windowW"] / 2, zc - BRK["windowW"] / 2
    depth = 0.26
    g = P.g("window", 0.9)
    g.poly([(x, y0, z0), (x + depth, y0, z0), (x + depth, y0, z1), (x, y0, z1)], M.trim, (0, 1, 0))
    g.poly([(x, y1, z0), (x, y1, z1), (x + depth, y1, z1), (x + depth, y1, z0)], M.frame, (0, -1, 0))
    g.poly([(x, y0, z0), (x, y1, z0), (x + depth, y1, z0), (x + depth, y0, z0)], M.frame, (0, 0, -1))
    g.poly([(x, y0, z1), (x + depth, y0, z1), (x + depth, y1, z1), (x, y1, z1)], M.frame, (0, 0, 1))
    g.poly([(x + depth, y0, z0), (x + depth, y0, z1), (x + depth, y1, z1), (x + depth, y1, z0)], M.glass, (-1, 0, 0))
    xf = Xf.facing((x + depth - 0.002, 0, zc), (-1, 0, 0))
    fw = 0.05
    ww, wh = BRK["windowW"], BRK["windowH"]
    g.box((-fw / 2, y0, 0), (fw / 2, y1, 0.04), M.frame, xf, skip=("-z", "-y", "+y"))
    g.box((-ww / 2, y0 + wh * 0.6, 0), (ww / 2, y0 + wh * 0.6 + fw, 0.04), M.frame, xf, skip=("-z", "-x", "+x"))
    g.box((-ww / 2 - 0.05, y0 - 0.04, 0), (ww / 2 + 0.05, y0, 0.3), M.trim, Xf.facing((x, 0, zc), (-1, 0, 0)),
          skip=("-z",))
    opening_frame(P, M, Xf.facing((x, y0 - 0.0, zc), (-1, 0, 0)), ww, 0.0)  # side + head casing only
    bl = P.g("outside", 0.05)
    bl.poly([(x + depth + 0.3, y0 - 0.2, z0 + 0.3), (x + depth + 0.3, y0 - 0.2, z1 - 0.3),
             (x + depth + 0.3, y1 + 0.2, z1 - 0.3), (x + depth + 0.3, y1 + 0.2, z0 + 0.3)], M.black, (-1, 0, 0))


# ── bake ─────────────────────────────────────────────────────────────────────
def neighbours(kind):
    before = kind != "entrance"
    after = kind not in ("end", "end_door")
    return before, after


def bake_piece(sc, coll_ctx, kind, M, args, scratch, exposure, keep):
    """Build `kind` at the origin with plain neighbours, bake it into its own atlas, return its node."""
    L = LEN.get(kind, SEG)
    built = []
    before, after = neighbours(kind)
    base_kind = "door_l" if kind == "leaf" else kind
    P = build_piece(coll_ctx, base_kind, 0.0, M=M)
    built.append(P)
    if before:
        built.append(build_piece(coll_ctx, "plain", SEG, True, M))
    if after:
        built.append(build_piece(coll_ctx, "plain", -L if kind != "leaf" else -SEG, True, M))
    if kind == "leaf":
        leaf = MeshBuilder("leaf")
        leaf_faces(leaf, M, Xf((0, 0, 0), (0, 0, -1), (0, 1, 0), (1, 0, 0)))
        hinge = (-W / 2 - 0.02, 0.0, -DZ + DOOR["w"] / 2 - 0.003)
        lob = leaf.to_object(coll_ctx, matrix_v=Matrix.Translation(hinge))
        lob["k_weight"] = 0.9
        targets = [lob]
    else:
        targets = P.objects
    weights = {o.name: float(o.get("k_weight", 1.0)) for o in targets}
    texels = sum(C.mesh_area(o) * (C.BUDGET["texelsPerMetre"] * weights[o.name]) ** 2 for o in targets)
    size = int(min(args.atlas, max(256, C.pow2ceil(math.sqrt(texels / 0.6)))))
    tpm, pack_px, islands = C.lightmap_uvs(targets, weights, size, 14 if size >= 1024 else 8)
    margin = max(1, int((pack_px - 1) // 2))
    img = bpy.data.images.new(f"k_bake_{kind}", size, size, alpha=False, float_buffer=True)
    t = time.perf_counter()
    C.bake(targets, img, margin, clear=True)
    dt = time.perf_counter() - t
    sc.view_settings.exposure = exposure
    tex = C.save_display(sc, img, scratch / "atlas" / f"K_{kind}.png")
    bpy.data.images.remove(img)
    mat = C.unlit_material(f"kit_{kind}", tex)
    for o in targets:
        o.data.materials.clear()
        o.data.materials.append(mat)
        o.data.polygons.foreach_set("material_index", [0] * len(o.data.polygons))
        C.keep_only_uv(o, "lightmap")
    keep_names = {o.name for o in targets}
    C.select_only(targets, targets[0])
    if len(targets) > 1:
        bpy.ops.object.join()
    node = bpy.context.view_layer.objects.active
    for c in list(node.users_collection):
        c.objects.unlink(node)
    keep.objects.link(node)
    node.name = f"K_{kind}"
    node.data.name = f"K_{kind}"
    # clean the context away
    names = [n for p in built for n in p.names if n not in keep_names] + [n for p in built for n in p.light_names]
    if kind == "leaf":  # the leaf was baked inside a door piece: that piece goes too
        names += [n for n in built[0].names]
    for n in names:
        o = bpy.data.objects.get(n)
        if o is not None and o != node:
            bpy.data.objects.remove(o, do_unlink=True)
    node.hide_render = True  # out of the later bakes
    log("baked", f"K_{kind}", size, "px", islands, "islands", round(tpm), "tpm", round(dt, 1), "s")
    return node, {"size": size, "texelsPerMetre": round(tpm, 1), "bake_s": round(dt, 2), "islands": islands}


def light_geometry(keep):
    """K_spill + K_underline: plain floor shapes in the K_leaf frame (hinge at the origin, opening along
    -z for door.w, the corridor toward +x). uv.y runs 0 at the door -> 1 at the far edge."""
    out = []
    dw = DOOR["w"]
    for name, pts, uvs in (
        ("spill", [(0.0, 0.012, 0.0), (0.0, 0.012, -dw), (1.7, 0.012, -dw - 0.7), (1.7, 0.012, 0.45)],
         [(0, 0), (1, 0), (1, 1), (0, 1)]),
        ("underline", [(0.0, 0.012, 0.0), (0.0, 0.012, -dw), (0.07, 0.012, -dw), (0.07, 0.012, 0.0)],
         [(0, 0), (1, 0), (1, 1), (0, 1)]),
    ):
        me = bpy.data.meshes.new(f"K_{name}")
        me.from_pydata([C.v2b(p) for p in pts], [], [(0, 1, 2, 3)])
        # face up (+y viewer): fix the winding if needed
        if me.polygons[0].normal.z < 0:
            me.flip_normals()
        uvl = me.uv_layers.new(name="uv")
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                uvl.data[li].uv = uvs[vi]
        mat = C.plain_export_material(name, "#ffd9a8" if name == "spill" else "#ffcf96")
        me.materials.append(mat)
        ob = bpy.data.objects.new(f"K_{name}", me)
        keep.objects.link(ob)
        out.append(ob)
    return out


# ── preview ──────────────────────────────────────────────────────────────────
def additive_preview_mat(name, hexcol, k):
    """What the viewer does with spill / underline: an additive glow fading along uv.y."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "uv"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uvn.outputs["UV"], sep.inputs["Vector"])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["Y"], inv.inputs[1])
    sq = nt.nodes.new("ShaderNodeMath")
    sq.operation = "POWER"
    sq.inputs[1].default_value = 2.0
    nt.links.new(inv.outputs[0], sq.inputs[0])
    st = nt.nodes.new("ShaderNodeMath")
    st.operation = "MULTIPLY"
    st.inputs[1].default_value = k
    nt.links.new(sq.outputs[0], st.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = C.rgba(hexcol)
    nt.links.new(st.outputs[0], em.inputs["Strength"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], ad.inputs[0])
    nt.links.new(em.outputs[0], ad.inputs[1])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(ad.outputs[0], out.inputs["Surface"])
    return m


def preview(sc, nodes, path: Path):
    """A still down a sample layout built from the BAKED pieces (what the viewer will show), with
    exponential fog toward the corridor's fog colour."""
    layout = ["entrance", "break", "door_l", "door_r", "plain", "break", "door_l", "end"]
    coll = C.collection("preview")
    z = 0.0
    doors = []
    for kind in layout:
        src = nodes[f"K_{kind}"]
        ob = bpy.data.objects.new(f"pv_{kind}_{z:g}", src.data)
        coll.objects.link(ob)
        ob.matrix_world = C.obj_matrix(Matrix.Translation((0, 0, z)))
        if kind.startswith("door"):
            doors.append((kind, z - DZ))
        z -= LEN[kind]
    ajar = math.radians(CORR["leafAjarDeg"])
    for i, (kind, zd) in enumerate(doors):
        side = -1 if kind.endswith("_l") else 1
        hinge = (side * (W / 2 + 0.02), 0.0, zd + DOOR["w"] / 2 - 0.003)
        mv = Matrix.Translation(hinge)
        if side > 0:
            mv = mv @ Matrix.Scale(-1, 4, (1, 0, 0))
        state = ["ajar", "shut-lit", "shut-dark"][i % 3]
        leaf = bpy.data.objects.new(f"pv_leaf_{i}", nodes["K_leaf"].data)
        coll.objects.link(leaf)
        leaf.matrix_world = C.obj_matrix(mv @ Matrix.Rotation(ajar if state == "ajar" else 0.0, 4, "Y"))
        if state in ("ajar", "shut-lit"):
            src = nodes["K_spill" if state == "ajar" else "K_underline"]
            me = src.data.copy()
            me.materials.clear()
            me.materials.append(additive_preview_mat(f"pv_{state}_{i}", "#ffd2a0", 0.55 if state == "ajar" else 2.5))
            ob = bpy.data.objects.new(f"pv_light_{i}", me)
            coll.objects.link(ob)
            ob.matrix_world = C.obj_matrix(mv)
    # fog: absorption + emission of the fog colour (exp fog toward #1d1a17, like the viewer's)
    fog_hex, dens = "#1d1a17", 0.055
    me = bpy.data.meshes.new("pv_fog")
    mbx = MeshBuilder("pv_fog")
    mbx.box((-3, -0.5, z - 2), (3, H + 0.5, 2), None)
    me.from_pydata([C.v2b(v) for v in mbx.verts], [], mbx.faces)
    m = bpy.data.materials.new("pv_fog")
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    ab = nt.nodes.new("ShaderNodeVolumeAbsorption")
    ab.inputs["Color"].default_value = (0, 0, 0, 1)
    ab.inputs["Density"].default_value = dens * 1.6
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = C.rgba(fog_hex)
    em.inputs["Strength"].default_value = dens * 1.6
    ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(ab.outputs[0], ad.inputs[0])
    nt.links.new(em.outputs[0], ad.inputs[1])
    nt.links.new(ad.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    me.materials.append(m)
    fob = bpy.data.objects.new("pv_fog", me)
    coll.objects.link(fob)
    for n in nodes.values():
        n.hide_render = True
    cam = C.camera(coll, "pv_cam", (0.15, C.WALKER["eye"], -1.6), 0.03, 0.0)
    # inside the first break bay, looking across at the dark window
    zb = -LEN["entrance"] - LEN["break"] / 2
    cam_bay = C.camera(coll, "pv_cam_bay", (-0.9, C.WALKER["eye"], zb + 2.2), math.radians(-52), 0.0)
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = C.rgba(fog_hex)
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    sc.camera = cam
    path.parent.mkdir(parents=True, exist_ok=True)
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = str(path)
    C.sync()
    bpy.ops.render.render(write_still=True)
    sc.camera = cam_bay
    sc.render.filepath = str(path.with_name(path.stem + "-bay" + path.suffix))
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(fob, do_unlink=True)
    for o in list(coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for n in nodes.values():
        n.hide_render = False
    return layout


def main():
    args = parse()
    out = Path(args.out).resolve()
    scratch = Path(args.scratch).resolve() if args.scratch else out.parent / "_corridor-kit-build"
    out.mkdir(parents=True, exist_ok=True)
    scratch.mkdir(parents=True, exist_ok=True)
    t_all = time.perf_counter()
    sc = C.reset_scene()
    R = {"device": C.setup_render(sc, args.samples, (1280, 800)), "pieces": {}}
    C.dark_world(sc, "#020202", 1.0)
    M = Mats()
    keep = C.collection("kit")
    ctx = C.collection("context")

    # one exposure for the whole kit: a plain stretch seen from 1.6 m in, looking deeper
    probe = [build_piece(ctx, "entrance", 0.0, M=M), build_piece(ctx, "plain", -LEN["entrance"], M=M),
             build_piece(ctx, "door_l", -LEN["entrance"] - SEG, M=M), build_piece(ctx, "plain", -LEN["entrance"] - 2 * SEG, M=M)]
    cam = C.camera(ctx, "probe_cam", (0.0, C.WALKER["eye"], -1.6), 0.0)
    lum = C.measure_luminance(sc, cam, scratch)
    exposure = max(-6.0, min(8.0, math.log2(TARGET / max(lum, 1e-6))))
    R["exposure"] = round(exposure, 3)
    R["measured"] = round(lum, 5)
    for p in probe:
        for n in p.names + p.light_names:
            if bpy.data.objects.get(n) is not None:
                bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    log("kit exposure", R["exposure"])

    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = False
    nodes = {}
    for kind in PIECES:
        node, info = bake_piece(sc, ctx, kind, M, args, scratch, exposure, keep)
        L = LEN.get(kind, 0.0)
        extras = {"dr": "kit", "piece": kind, "length": L, "width": W, "height": H}
        if kind.startswith("door_"):
            extras["doors"] = [{"side": s, "z": -DZ, "x": (-1 if s == "l" else 1) * W / 2}
                               for s in ("l", "r") if s in kind[5:]]
        if kind == "break":
            extras.update(width=BRK["width"], narrow=NARROW, window={"side": "r", "x": BRK["width"] / 2, "z": -L / 2},
                          stencil={"side": "l", "x": -BRK["width"] / 2, "y": CORR["break"]["stencilY"], "z": -L / 2,
                                   "facing": "+x"})
        if kind == "end_door":
            extras["door"] = {"x": 0.0, "z": -L, "facing": "+z", "signY": CORR["signY"]}
        if kind == "leaf":
            # baked shut in a left opening; exported with its hinge at the origin
            node.matrix_world = Matrix.Identity(4)
            extras = {"dr": "kit", "piece": "leaf", "length": DOOR["w"], "height": DOOR["h"], "hinge": [0, 0, 0],
                      "front": "+x", "thickness": LEAF_T, "ajarDeg": CORR["leafAjarDeg"]}
        if "k_weight" in node.keys():
            del node["k_weight"]
        C.set_extras(node, **extras)
        nodes[node.name] = node
        R["pieces"][node.name] = info
    for ob in light_geometry(keep):
        C.set_extras(ob, dr="kit", piece=ob.name[2:])
        nodes[ob.name] = ob
    for n in nodes.values():
        n.hide_render = False
    glb = out / "corridor-kit.glb"
    C.select_only(list(nodes.values()))
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=True, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_image_format="WEBP",
        export_image_quality=args.webp_quality, export_texcoords=True, export_normals=False, export_tangents=False,
        export_materials="EXPORT", export_extras=True, export_vertex_color="NONE")
    R["glb"] = {"path": str(glb), "bytes": glb.stat().st_size,
                "triangles": sum(sum(len(p.vertices) - 2 for p in n.data.polygons) for n in nodes.values()),
                "nodes": sorted(nodes)}
    if args.preview:
        t = time.perf_counter()
        R["preview"] = {"path": str(Path(args.preview).resolve()), "layout": preview(sc, nodes, Path(args.preview).resolve()),
                        "s": round(time.perf_counter() - t, 2)}
    R["total_s"] = round(time.perf_counter() - t_all, 2)
    log("corridor kit", R["glb"]["bytes"], "bytes", R["total_s"], "s")
    C.report(R)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        C.report({"error": f"{type(e).__name__}: {str(e)[:300]}"})
        sys.exit(1)
