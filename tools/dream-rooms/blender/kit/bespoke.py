"""Dream Rooms kit · module `bespoke`: a dream-specific script builds inside the module's box.

world.json: { "kit": "bespoke", "bespoke": "<name>", ... } runs
    dream-rooms-work/<id>/bespoke/<name>.py
which must define

    def build(ctx, module):
        ...

`module` is the world.json module (dict). `ctx` (BespokeCtx below) works in MODULE-LOCAL viewer
metres (x 0..w, y up 0..h, z 0..d, north = -z). Unless the script sets `SHELL = False`, the standard
shell (floor, ceiling, walls with the doorways cut, Z-stubs) is built first; with SHELL = False the
script builds its own enclosure and calls ctx.shell(...) for whatever part it wants (doorways and
their stubs are always built by ctx.shell / ctx.doorways()). Faces outside the box are counted and
reported (a warning, not an error). See ../KIT.md for the full API and an example.
"""

from __future__ import annotations

from pathlib import Path

import common as C
from kit import build_props, finishes, reserve_props, shell


class BespokeCtx:
    def __init__(self, mb):
        self.mb = mb
        self.size = mb.size
        self.w, self.h, self.d = mb.size
        self.scale = mb.scale
        self.fin = mb.fin
        self.C = C

    # materials
    def finish(self, kind, color=None, role="walls"):
        """A procedural finish (carpet, tile, ...). Use only what the dream cites."""
        return finishes.make(kind, color, role)

    def flat(self, hexcol, rough=0.8, name="bespoke"):
        return self.mb.flat(name, hexcol, rough)

    def glow_material(self, hexcol, strength=4.0, name="bespoke_glow"):
        return self.mb.flat(name, hexcol, 0.5, emit=hexcol, strength=strength)

    # geometry (all into the shell unless role is given)
    def mesh(self, key="bespoke", weight=1.0):
        return self.mb.group(("bespoke", key), weight)

    def box(self, lo, hi, mat, skip=(), key="bespoke", weight=1.0):
        self.mesh(key, weight).box(lo, hi, mat, skip=skip)

    def quad(self, pts, mat, normal, key="bespoke", weight=1.0):
        self.mesh(key, weight).poly(pts, mat, normal)

    def prism(self, pts2, y0, y1, mat, key="bespoke", weight=1.0):
        self.mesh(key, weight).prism(pts2, y0, y1, mat)

    def prop_mesh(self, prop_id, pivot, weight=1.0):
        """A separate P_<module>__<prop_id> mesh (for a swap target)."""
        return self.mb.mesh(f"prop_{prop_id}", ("prop", prop_id), weight, pivot_local=pivot)

    def surface(self, name, centre, normal, w, h, hexcol="#d9d3c4"):
        return self.mb.surface(name, centre, normal, w, h, hexcol)

    def light(self, pos, size=(2.0, 2.0), power=None, hexcol=None, down=True):
        """A hidden area light (never visible): pos module-local."""
        col = hexcol or C.warmth_hex(self.mb.world["look"].get("warmth", 0.5))
        p = power if power is not None else self.mb.light_level * size[0] * size[1]
        ob = C.area_light(self.mb.coll, f"L_{self.mb.id}_{self.mb.copy}_b{len(self.mb.lights)}",
                          C.add(self.mb.base, pos), size, p, col, down=down)
        self.mb.lights.append(ob)
        return ob

    def shell(self, walls="nsew", floor_holes=(), ceiling=True):
        shell.build_shell(self.mb, walls=walls, floor_holes=floor_holes, ceiling=ceiling)

    def hole(self, side, u0, u1, v0, v1):
        """Cut an extra opening in a wall (call before ctx.shell)."""
        self.mb.holes[side].append((u0, u1, v0, v1, "bespoke"))


def build(mb):
    work = mb.opts.get("work")
    name = mb.module.get("bespoke")
    if not work or not name:
        raise RuntimeError(f"bespoke module {mb.id}: needs --work and module.bespoke")
    path = Path(work) / "bespoke" / f"{name}.py"
    if not path.exists():
        raise FileNotFoundError(f"bespoke module {mb.id}: no bespoke/{name}.py in the work folder")
    ns = {"__name__": f"bespoke_{name}", "__file__": str(path)}
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), ns)
    if "build" not in ns:
        raise RuntimeError(f"bespoke/{name}.py defines no build(ctx, module)")
    reserve_props(mb)
    ctx = BespokeCtx(mb)
    if ns.get("SHELL", True):
        shell.build_shell(mb)
    ns["build"](ctx, mb.module)
    build_props(mb)
    # inside its box?
    w, h, d = mb.size
    out = 0
    for g, role, *_ in mb.meshes:
        for v in g.verts:
            x, y, z = (v[0] - mb.base[0], v[1] - mb.base[1], v[2] - mb.base[2])
            if x < -3.5 or x > w + 3.5 or z < -3.5 or z > d + 3.5 or y < -2.0 or y > h + 0.05:
                out += 1
    mb.bespoke_outside = out
