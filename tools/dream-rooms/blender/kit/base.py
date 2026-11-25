"""Dream Rooms kit · ModuleBuild, the context every kit piece builds into.

One ModuleBuild per module copy (a repeating corridor is built as copies at z offsets of ±d; only
copy 0 is exported, the others are its baking context). Kit code works in MODULE-LOCAL viewer
coordinates (x across 0..w, y up, z 0..d, north = -z); the builder adds the origin + copy offset.

    mb.group(key, weight, role="shell")   a MeshBuilder shared by everything with the same key
    mb.mesh(name, role, weight, pivot)    a MeshBuilder of its own (props a swap targets, fixtures)
    mb.fin["floor"|"walls"|"ceiling"|"water"] -> Finish(mat, weight, hex, cited)
    mb.flat(name, hex, rough)             a cached plain material
    mb.place(prop)                        -> (Xf frame, wall side or None) for a prop
    mb.surface(name, centre, normal, w, h, hex)   an S_ text quad (copy 0 only)
    mb.obstacle(side, u0, u1, y0, y1)     keep word surfaces off it
    mb.light_*                            hidden lights (kit/lights.py)

Roles: "shell" (joined into M_<module>__shell*), ("prop", id) -> P_, ("surface", name, w, h) -> S_,
"water" -> W_, ("fixture", k) -> F_, "context" (baked around, never exported).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import common as C
from common import DOOR, MeshBuilder, Wall, Xf
from kit import finishes

TRIM_HEX = "#77706a"  # frames round openings: a muted neutral (no default look; see KIT.md)


@dataclass
class Finish:
    mat: object
    weight: float
    hex: str
    cited: bool


def cited(o):
    return bool(o and o.get("for") and not o.get("invented"))


class ModuleBuild:
    def __init__(self, world, module, coll, copy=0, opts=None):
        self.world = world
        self.module = module
        self.opts = opts or {}
        self.id = module["id"]
        self.kit = module["kit"]
        self.size = tuple(float(v) for v in module["size"])
        self.w, self.h, self.d = self.size
        self.origin = tuple(float(v) for v in module["origin"])
        self.scale = float(module.get("scale", 1.0))
        self.copy = copy
        self.dz = copy * self.d if module.get("repeat") else 0.0
        self.base = C.add(self.origin, (0.0, 0.0, self.dz))
        self.coll = coll
        self.invented = bool(module.get("invented"))
        self.groups = {}
        self.meshes = []      # [MeshBuilder, role, weight, pivot, matrix_v, role as asked]
        self.objects = []     # [(ob, role, weight, role as asked)]
        self.lights = []
        self.holes = {s: [] for s in "nsew"}
        self.obstacles = {s: [] for s in "nsew"}
        self.doorway_empties = []   # (doorway id, world centre, inward) — copy 0
        self.windows = []           # (centre local, inward, w, h) for lights.is == windows
        self.sign_k = 0
        self.fixture_k = 0
        self.light_level = 20.0     # W per m2 of floor for sourceless glow (auto exposure sets the brightness)
        self.water = None           # pool: dict(y, x0, x1, z0, z1)
        self.floor_spot = None      # where a floor word goes (module-local x, z)
        self.entry_facing = (0, 0, -1)
        self._flats = {}
        self.swapped = set()
        for s in world.get("swaps") or []:
            mid, _, target = s["target"].partition("/")
            if mid == self.id:
                self.swapped.add(target)
        words = [w for w in world.get("words") or [] if w["on"].split("/")[0] == self.id]
        self.word_targets = {w["on"].split("/", 1)[1] for w in words}
        doors = module.get("doors") or {}
        self.numbered = bool(doors.get("sign")) or "doors-sign" in self.word_targets or "doors-sign" in self.swapped
        self.doorways = []
        for dw in world.get("doorways") or []:
            if dw["module"] == self.id:
                fr = C.doorway_frame(module, dw, local=True)
                self.doorways.append((dw, fr))
                a = dw["at"]
                self.holes[dw["wall"]].append((a - DOOR["w"] / 2, a + DOOR["w"] / 2, 0.0, DOOR["h"]))
                self.obstacle(dw["wall"], a - DOOR["w"] / 2 - 0.15, a + DOOR["w"] / 2 + 0.15, 0.0, DOOR["h"] + 0.45)
        self.fin = self._finishes()

    # ── materials ────────────────────────────────────────────────────────────
    def _finishes(self):
        f = self.module.get("finishes") or {}
        out = {}
        spec = {"floor": (1.0, 0.4), "walls": (0.9, 0.35), "ceiling": (0.6, 0.3), "water": (0.3, 0.3)}
        for slot, (w_cited, w_plain) in spec.items():
            fi = f.get(slot)
            is_cited = cited(fi) and not self.invented
            kind = fi["is"] if fi else ("water" if slot == "water" else "plain")
            color = fi.get("color") if fi else None
            mat = finishes.make(kind, color, slot, invented=not is_cited and kind != "water")
            out[slot] = Finish(mat, w_cited if is_cited else w_plain, finishes.base_hex(mat), is_cited)
        ce = self.module.get("ceiling") or {}
        if ce.get("is") == "drop-tiles":
            fc = f.get("ceiling") if cited(f.get("ceiling")) else None
            mat = finishes.drop_tiles(fc.get("color") if fc else None)
            out["ceiling"] = Finish(mat, 0.7, finishes.base_hex(mat), True)
        elif ce.get("is") in ("high-dark", "none"):
            mat = finishes.dark_ceiling(ce["is"])
            out["ceiling"] = Finish(mat, 0.12, finishes.base_hex(mat), cited(ce))
        return out

    def flat(self, name, hexcol, rough=0.7, emit=None, strength=0.0):
        key = (name, hexcol, rough, emit, strength)
        m = self._flats.get(key)
        if m is None:
            m = C.flat(f"src_{name}_{hexcol.lstrip('#')}", hexcol, rough, emit, strength)
            self._flats[key] = m
        return m

    def trim_mat(self):
        return self.flat("trim", TRIM_HEX if not self.invented else finishes.GREY, 0.6)

    # ── meshes ───────────────────────────────────────────────────────────────
    def _role(self, role):
        return "context" if self.copy != 0 else role

    def group(self, key, weight, role="shell"):
        k = (key, role if isinstance(role, str) else tuple(role))
        g = self.groups.get(k)
        if g is None:
            name = f"{self.id}_{self.copy}_" + "_".join(str(x) for x in (key if isinstance(key, tuple) else (key,)))
            g = MeshBuilder(name, self.base)
            self.groups[k] = g
            self.meshes.append([g, self._role(role), weight, None, None, role])
        return g

    def mesh(self, name, role="shell", weight=1.0, pivot_local=None):
        m = MeshBuilder(f"{self.id}_{self.copy}_{name}", self.base)
        pivot = C.add(self.base, pivot_local) if pivot_local is not None else None
        self.meshes.append([m, self._role(role), weight, pivot, None, role])
        return m

    def prop_mesh(self, prop, weight=None, pivot_local=None):
        """Everything a prop builds goes here: its own P_ mesh when a swap targets it, else the shell."""
        w = weight if weight is not None else (1.0 if cited(prop) else 0.5)
        if prop["id"] in self.swapped:
            return self.mesh(f"prop_{prop['id']}", ("prop", prop["id"]), w, pivot_local)
        return self.group(("props", round(w, 2)), w)

    def finish(self):
        """Create the Blender objects (once the kit is done)."""
        for g, role, weight, pivot, mv, orig in self.meshes:
            if g.empty():
                continue
            ob = g.to_object(self.coll, pivot=pivot, matrix_v=mv)
            self.objects.append((ob, role, weight, orig))
        self.meshes = []
        return self.objects

    # ── placement ────────────────────────────────────────────────────────────
    def obstacle(self, side, u0, u1, y0, y1):
        self.obstacles[side].append((u0, u1, y0, y1))

    def place(self, prop, depth=0.0, height=None, length=None):
        """A prop's frame: wall + at (origin on the wall plane at floor, front = inward) or pos + rotY
        (front = +z turned by rotY degrees). Registers a wall obstacle when length/height are given."""
        if prop.get("wall"):
            wall = Wall(prop["wall"], self.size)
            o = wall.point(float(prop.get("at", wall.length / 2)))
            fr = Xf.facing(o, wall.inward)
            if length is not None:
                a = float(prop.get("at", wall.length / 2))
                self.obstacle(prop["wall"], a - length / 2, a + length / 2, 0.0, height or self.h)
            return fr, prop["wall"]
        pos = prop.get("pos") or [self.w / 2, 0, self.d / 2]
        yaw = math.radians(float(prop.get("rotY", 0.0)))
        fwd = C.rot_y((0, 0, 1), yaw)
        return Xf.facing(tuple(float(v) for v in pos), fwd), None

    # ── text surfaces ────────────────────────────────────────────────────────
    def surface(self, name, centre, normal, w, h, hexcol, up=None):
        """An S_<module>__<name> quad: one quad facing `normal`, w x h metres, origin at its centre,
        local +z = the normal (glTF), local +y = up on the quad. Copy 0 only."""
        if self.copy != 0:
            return None
        if abs(normal[1]) > 0.9:
            f = up or self.entry_facing
            yaw = C.yaw_of(f)
            mv = C.viewer_matrix(C.add(self.base, centre), yaw, -math.pi / 2 if normal[1] > 0 else math.pi / 2)
        else:
            yaw = math.atan2(normal[0], normal[2])
            mv = C.viewer_matrix(C.add(self.base, centre), yaw, 0.0)
        m = MeshBuilder(f"{self.id}_surf_{name}")
        mat = C.flat(f"src_surface_{self.id}__{name}", hexcol, 0.85)
        m.poly([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], mat, (0, 0, 1))
        role = ("surface", name, round(w, 3), round(h, 3))
        self.meshes.append([m, role, 0.6, None, mv, role])
        return m

    def next_sign(self):
        k = self.sign_k
        self.sign_k += 1
        return f"doors-sign-{k}"

    def sign_above(self, xf, top_y, width=0.36, height=0.17):
        """A blank plaque above a numbered door (frame xf on the wall plane, front = inward) plus its
        doors-sign-<k> surface. Returns the surface name."""
        name = self.next_sign() if self.copy == 0 else None
        cy = min(top_y + 0.06 + height / 2 + 0.02, self.h - height / 2 - 0.08)
        g = self.group("trim", 0.6)
        g.box((-width / 2 - 0.025, cy - height / 2 - 0.025, 0.0), (width / 2 + 0.025, cy + height / 2 + 0.025, 0.012),
              self.flat("plaque", "#3b3731", 0.5), xf, skip=("-z",))
        if name:
            self.surface(name, xf.p(0, cy, 0.015), xf.f, width, height, "#d9d3c4")
        return name
