"""Dream Rooms kit · light (decisions 8-9): no visible source, or more glow than its source explains.

    rig(mb)        after the kit has built the module's geometry

  * glow    (sourceless): hidden area lights under the ceiling pointing down, unevenly (+-40 %, seeded
            by the module id, so light pools a little), plus a wide up-light at mid height that washes
            the ceiling like a cove you never see. Lights are invisible to the camera, glossy and
            transmission rays.
  * panels  (cited only): emissive fluorescent panels, each its own F_<module>__<k> node, plus a
            weaker glow (more glow than the panels explain).
  * windows lit window glass + a light in each window when the windows aren't dark; else glow.
  * none    a very faint glow (auto exposure keeps it dim, see TARGETS).
Colour follows look.warmth. Absolute power doesn't matter: build_world sets the exposure per module
from its still camera (target by look.light keyword).
"""

from __future__ import annotations

import math
import random
import zlib

import common as C

TARGETS = [  # look.light keyword -> geometric-mean luminance after exposure
    (("night", "dark", "midnight", "late"), 0.14),
    (("dusk", "evening", "afternoon", "golden", "sunset"), 0.19),
    (("morning", "day", "noon", "bright", "sunny"), 0.25),
]


def exposure_target(world, module):
    light = (world.get("look") or {}).get("light", "").lower()
    t = 0.19
    for keys, v in TARGETS:
        if any(k in light for k in keys):
            t = v
            break
    if ((module.get("lights") or {}).get("is")) == "none":
        t *= 0.55
    return t


def panel_hex(warmth):
    return C.mix_hex("#eaf5ea", C.warmth_hex(warmth), 0.3)


def glow(mb, k=1.0):
    w, h, d = mb.size
    col = C.warmth_hex(mb.world["look"].get("warmth", 0.5))
    rnd = random.Random(zlib.crc32(mb.id.encode()))  # the same pattern in every copy (tiles match)
    nx = max(1, math.ceil(w / 6.0))
    nz = max(1, math.ceil(d / 6.0))
    cw, cd = w / nx, d / nz
    y = h - 0.18
    total = 0.0
    for i in range(nx):
        for j in range(nz):
            p = mb.light_level * k * cw * cd * rnd.uniform(0.6, 1.4)
            total += p
            mb.lights.append(C.area_light(mb.coll, f"L_{mb.id}_{mb.copy}_g{i}_{j}",
                                          C.add(mb.base, ((i + 0.5) * cw, y, (j + 0.5) * cd)),
                                          (cw * 0.75, cd * 0.75), p, col))
    mb.lights.append(C.area_light(mb.coll, f"L_{mb.id}_{mb.copy}_cove", C.add(mb.base, (w / 2, h * 0.5, d / 2)),
                                  (w * 0.6, d * 0.6), total * 0.22, col, down=False))
    return total


def panels(mb):
    """Fluorescent panels flush under the ceiling (y = h), sized by module.scale. One F_ node each."""
    w, h, d = mb.size
    s = mb.scale
    pw, pl = 0.6 * s, 1.2 * s
    if w < 3.5:
        xs = [w / 2]
    else:
        xs = [(i + 0.5) * w / max(1, round(w / 3.2)) for i in range(max(1, round(w / 3.2)))]
    nz = max(1, round(d / 2.7))
    zs = [(j + 0.5) * d / nz for j in range(nz)]
    col = panel_hex(mb.world["look"].get("warmth", 0.5))
    mat = mb.flat("panel", "#f4f6f0", 0.4, emit=col, strength=7.0)
    for x in xs:
        for z in zs:
            k = mb.fixture_k
            mb.fixture_k += 1
            m = mb.mesh(f"fixture_{k}", ("fixture", str(k)), 0.15, pivot_local=(x, h, z))
            m.box((x - pw / 2, h - 0.025, z - pl / 2), (x + pw / 2, h, z + pl / 2), mat, skip=("+y",))
    return len(xs) * len(zs)


def window_lights(mb):
    if not mb.windows or (mb.world["look"].get("windows") or "").lower() == "dark":
        return False
    col = C.mix_hex("#dfe6f2", C.warmth_hex(mb.world["look"].get("warmth", 0.5)), 0.5)
    for i, (c, inward, ww, wh) in enumerate(mb.windows):
        p = C.add(mb.base, C.add(c, C.mul(inward, 0.05)))
        ob = C.area_light(mb.coll, f"L_{mb.id}_{mb.copy}_win{i}", p, (ww, wh), mb.light_level * ww * wh * 6, col)
        # aim it inward: local -Z (Blender) -> v2b(inward)
        ob.matrix_world = C.obj_matrix(C.viewer_matrix(p, C.yaw_of(inward), 0.0)) @ _down_to_forward()
    return True


def _down_to_forward():
    from mathutils import Matrix
    return Matrix.Rotation(math.pi / 2, 4, "X")


def rig(mb):
    kind = ((mb.module.get("lights") or {}).get("is")) or "glow"
    if kind == "panels":
        panels(mb)
        glow(mb, 0.35)
    elif kind == "windows":
        glow(mb, 0.4 if window_lights(mb) else 1.0)
    elif kind == "none":
        glow(mb, 0.15)
    else:
        glow(mb, 1.0)
    return kind
