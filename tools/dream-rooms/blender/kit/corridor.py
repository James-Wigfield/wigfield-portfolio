"""Dream Rooms kit · module `corridor`: a corridor with shut, numbered doors along its long walls.

`doors: { count, sign, sides }` puts `count` decorative doors (shut, recessed, a plaque above each)
alternately on the two long walls (or only `e`/`w`), spread over the free wall between doorways.
`repeat: true` makes it a tileable segment open at n and s: build_world builds copies at z ± d, bakes
the middle one in context and exports only it (the viewer copies it end to end).
A non-repeating corridor is closed at both ends. Ceilings, panels and finishes come from the module
like any other kit (drop tiles / panels only when cited)."""

from __future__ import annotations

from common import DOOR, Wall
from kit import build_props, door, reserve_props, shell

END_CLEAR = 0.85   # keep doors this far from the segment ends (so a tile seam never cuts one)
DOORWAY_CLEAR = 1.25


def long_walls(mb):
    return ("w", "e") if mb.d >= mb.w else ("n", "s")


def plan_doors(mb):
    """[(side, at)] for the decorative doors, alternating sides, spread over the free stretches."""
    doors = mb.module.get("doors") or {}
    n = int(doors.get("count", 0))
    if n <= 0:
        return []
    a, b = long_walls(mb)
    sides = {"both": (a, b), "w": (a,), "e": (b,)}.get(doors.get("sides", "both"), (a, b))
    per = {s: 0 for s in sides}
    for i in range(n):
        per[sides[i % len(sides)]] += 1
    out = []
    lw = door.dims(mb)[0]
    for side, k in per.items():
        if not k:
            continue
        L = Wall(side, mb.size).length
        free = [(END_CLEAR, L - END_CLEAR)]
        for dw, _ in mb.doorways:
            if dw["wall"] != side:
                continue
            cut = (dw["at"] - DOOR["w"] / 2 - DOORWAY_CLEAR + 0.5, dw["at"] + DOOR["w"] / 2 + DOORWAY_CLEAR - 0.5)
            nxt = []
            for (u0, u1) in free:
                if cut[1] <= u0 or cut[0] >= u1:
                    nxt.append((u0, u1))
                    continue
                if cut[0] > u0:
                    nxt.append((u0, cut[0]))
                if cut[1] < u1:
                    nxt.append((cut[1], u1))
            free = nxt
        free = [f for f in free if f[1] - f[0] >= lw + 0.2]
        total = sum(f[1] - f[0] for f in free)
        if not free or total <= 0:
            continue
        # share the k doors across the stretches by length, each centred in an equal slot
        shares = [max(0, round(k * (f[1] - f[0]) / total)) for f in free]
        while sum(shares) < k:
            shares[max(range(len(free)), key=lambda i: (free[i][1] - free[i][0]) / (shares[i] + 1))] += 1
        while sum(shares) > k:
            shares[max(range(len(free)), key=lambda i: shares[i])] -= 1
        for (u0, u1), m in zip(free, shares):
            if not m:
                continue
            slot = (u1 - u0) / m
            if slot < lw + 0.35:
                m = max(1, int((u1 - u0) / (lw + 0.35)))
                slot = (u1 - u0) / m
            for j in range(m):
                out.append((side, round(u0 + (j + 0.5) * slot, 3)))
    return sorted(out)


def build(mb):
    plan = plan_doors(mb)
    for side, at in plan:
        door.reserve_decorative(mb, side, at, recessed=True)
    reserve_props(mb)
    for side, at in plan:
        door.decorative(mb, side, at, recessed=True)
    walls = "".join(long_walls(mb)) if mb.module.get("repeat") else "nsew"
    shell.build_shell(mb, walls=walls)
    build_props(mb)
    mb.planned_doors = plan
