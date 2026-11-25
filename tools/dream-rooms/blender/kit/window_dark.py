"""Dream Rooms kit · prop `window-dark`: windows with nothing behind them but dark.

`count` windows (default 1) centred at `at` along the wall, 1.4 x 1.8 m x scale, sill at 0.9 m x scale,
spaced 1.2 m x scale apart. Dark, faintly glossy glass in a frame with a mullion and a sill; no hole,
no light through it (decision 8: "dark outside the windows"). When lights.is == windows and the look's
windows aren't dark, kit/lights.py puts a light in each one."""

from __future__ import annotations


def dims(mb, prop):
    s = mb.scale
    n = int(prop.get("count", 1))
    ww, wh, sill, gap = 1.4 * s, 1.8 * s, 0.9 * s, 1.2 * s
    wh = min(wh, mb.h - sill - 0.25)
    return n, ww, wh, sill, gap


def reserve(mb, prop):
    n, ww, wh, sill, gap = dims(mb, prop)
    if prop.get("wall"):
        mb.place(prop, length=n * ww + (n - 1) * gap + 0.3, height=sill + wh + 0.2)


def build(mb, prop):
    n, ww, wh, sill, gap = dims(mb, prop)
    xf, wall = mb.place(prop)
    g = mb.prop_mesh(prop, pivot_local=xf.o)
    lit = (mb.module.get("lights") or {}).get("is") == "windows" and \
        (mb.world["look"].get("windows") or "").lower() != "dark"
    glass = mb.flat("glass_dark", "#06080a", 0.06) if not lit else mb.flat("glass_lit", "#dfe6ee", 0.2,
                                                                         emit="#dfe6ee", strength=2.0)
    if not lit:  # dark outside: weak reflections, so the glass reads black, not as a mirror of the room
        b = glass.node_tree.nodes.get("Principled BSDF")
        b.inputs["IOR"].default_value = 1.05
        b.inputs["Specular IOR Level"].default_value = 0.12
        b.inputs["Roughness"].default_value = 0.12
    frame = mb.flat("window_frame", prop.get("color") or "#5d5a55", 0.5)
    total = n * ww + (n - 1) * gap
    fw = 0.06 * mb.scale
    for i in range(n):
        x0 = -total / 2 + i * (ww + gap)
        x1 = x0 + ww
        y0, y1 = sill, sill + wh
        g.box((x0, y0, 0.0), (x1, y1, 0.012), glass, xf, skip=("-z",))
        g.box((x0 - fw, y0 - fw, 0), (x0, y1 + fw, 0.05), frame, xf, skip=("-z",))
        g.box((x1, y0 - fw, 0), (x1 + fw, y1 + fw, 0.05), frame, xf, skip=("-z",))
        g.box((x0, y1, 0), (x1, y1 + fw, 0.05), frame, xf, skip=("-z", "-x", "+x"))
        g.box((x0, y0 - fw, 0), (x1, y0, 0.05), frame, xf, skip=("-z", "-x", "+x"))
        mx = (x0 + x1) / 2
        g.box((mx - fw / 2, y0, 0.012), (mx + fw / 2, y1, 0.045), frame, xf, skip=("-z", "-y", "+y"))
        g.box((x0, y0 + wh * 0.62, 0.012), (x1, y0 + wh * 0.62 + fw * 0.8, 0.045), frame, xf,
              skip=("-z", "-x", "+x"))
        g.box((x0 - fw - 0.03, y0 - fw - 0.035, 0), (x1 + fw + 0.03, y0 - fw, 0.16), frame, xf, skip=("-z",))
        mb.windows.append((xf.p((x0 + x1) / 2, (y0 + y1) / 2, 0.0), xf.f, ww, wh))
