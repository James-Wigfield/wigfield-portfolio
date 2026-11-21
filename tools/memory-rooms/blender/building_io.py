"""building.json I/O for the Blender kit: the Python mirror of src/memory-rooms/building/validate.js and
src/memory-rooms/building/geometry.js (same checks, same error paths, same frames; CONTRACTS.md section 6).

Validates with the SAME schema file the web app uses (src/memory-rooms/building/building.schema.json) and the
scene validator's keyword subset. Pure Python (no bpy), so it runs outside Blender:
    python tools/memory-rooms/blender/building_io.py tools/memory-rooms/examples/house.building.json
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import polygon2d as P  # noqa: E402
import scene_io  # noqa: E402

SCHEMA_PATH = scene_io.REPO / "src" / "memory-rooms" / "building" / "building.schema.json"
THICKNESS = {"exterior": 0.25, "interior": 0.1}
SLAB = 0.25
STEP_RISE = 0.18
TOL = 0.01

_schema_cache: dict | None = None


def schema() -> dict:
    global _schema_cache
    if _schema_cache is None:
        _schema_cache = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return _schema_cache


# ── geometry (mirror of building/geometry.js) ────────────────────────────────

def level_by_id(b, lid):
    return next((lvl for lvl in b.get("levels", []) if lvl["id"] == lid), None)


def room_by_id(b, rid):
    return next((r for r in b.get("rooms", []) if r["id"] == rid), None)


def node_map(level):
    return {n["id"]: n["at"] for n in (level or {}).get("nodes", [])}


def wall_thickness(w):
    return w.get("thickness", THICKNESS["exterior"] if w.get("exterior") else THICKNESS["interior"])


def wall_lines(b, level_id):
    level = level_by_id(b, level_id)
    if not level:
        return []
    nodes = node_map(level)
    out = []
    for w in level.get("walls", []):
        pa, pb = nodes.get(w["a"]), nodes.get(w["b"])
        if pa is None or pb is None:
            continue
        dx, dz = pb[0] - pa[0], pb[1] - pa[1]
        length = math.hypot(dx, dz)
        d = [dx / length, dz / length] if length else [1.0, 0.0]
        out.append({"id": w["id"], "a": w["a"], "b": w["b"], "pa": pa, "pb": pb, "length": length, "dir": d,
                    "left": [d[1], -d[0]], "thickness": wall_thickness(w), "height": w.get("height", level["height"]),
                    "exterior": bool(w.get("exterior")), "level": level["id"], "spec": w})
    return out


def wall_index(b):
    return {w["id"]: w for lvl in b.get("levels", []) for w in wall_lines(b, lvl["id"])}


def wall_between(lines, a, c):
    return next((w for w in lines if (w["a"] == a and w["b"] == c) or (w["a"] == c and w["b"] == a)), None)


def room_polygon(b, room):
    nodes = node_map(level_by_id(b, room["level"]))
    return [nodes[i] for i in room["outline"] if i in nodes]


def room_frame(b, room):
    level = level_by_id(b, room["level"])
    box = P.bbox(room_polygon(b, room))
    return {"level": level["id"] if level else None,
            "origin": [box["min"][0], level["elevation"] if level else 0.0, box["min"][1]]}


def room_edges(b, room):
    lines = wall_lines(b, room["level"])
    pts = room_polygon(b, room)
    sign = P.winding_sign(pts)
    n = len(pts)
    out = []
    for i, a in enumerate(pts):
        c = pts[(i + 1) % n]
        w = wall_between(lines, room["outline"][i], room["outline"][(i + 1) % len(room["outline"])])
        out.append({"i": i, "a": a, "b": c, "wall": w["id"] if w else None, "thickness": w["thickness"] if w else 0.0,
                    "out": P.edge_out(a, c, sign), "line": w})
    return out


def room_inner_polygon(b, room):
    edges = room_edges(b, room)
    pts = [e["a"] for e in edges]
    return P.inset_polygon(pts, [e["thickness"] / 2 for e in edges], P.winding_sign(pts))


def wall_openings(b, wall_id):
    out = []
    for o in b.get("openings", []):
        if o["wall"] != wall_id:
            continue
        sill = o.get("sill", 0.9 if o["type"] == "window" else 0.0)
        out.append({"id": o["id"], "type": o["type"], "wall": wall_id, "sill": sill, "head": sill + o["height"],
                    "u0": o["offset"], "u1": o["offset"] + o["width"], "spec": o})
    return out


def exterior_loops(b, level_id):
    lines = [w for w in wall_lines(b, level_id) if w["exterior"]]
    nodes = node_map(level_by_id(b, level_id))
    adj: dict = {}
    for w in lines:
        for p, q in ((w["a"], w["b"]), (w["b"], w["a"])):
            adj.setdefault(p, []).append({"to": q, "wall": w["id"]})
    used: set = set()
    loops = []
    for w in lines:
        if w["id"] in used:
            continue
        ids = [w["a"]]
        used.add(w["id"])
        cur = w["b"]
        ok = True
        while cur != w["a"]:
            ids.append(cur)
            nxt = next((e for e in adj.get(cur, []) if e["wall"] not in used), None)
            if not nxt or len(ids) > len(lines) + 1:
                ok = False
                break
            used.add(nxt["wall"])
            cur = nxt["to"]
        if not ok or len(ids) < 3:
            continue
        pts = [nodes[i] for i in ids]
        if P.signed_area(pts) < 0:
            pts = list(reversed(pts))
        loops.append(pts)
    return sorted(loops, key=lambda p: -P.signed_area(p))


def roof_level(b):
    if b.get("roof", {}).get("level"):
        return level_by_id(b, b["roof"]["level"])
    levels = sorted(b.get("levels", []), key=lambda lvl: -lvl["elevation"])
    return levels[0] if levels else None


DIRS = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}


def stair_footprint(s):
    d = DIRS[s["dir"]]
    r = (-d[1], d[0])
    h = s["width"] / 2
    x, z = s["start"]
    top = (x + d[0] * s["length"], z + d[1] * s["length"])
    return [[x - r[0] * h, z - r[1] * h], [x + r[0] * h, z + r[1] * h],
            [top[0] + r[0] * h, top[1] + r[1] * h], [top[0] - r[0] * h, top[1] - r[1] * h]]


def stair_steps(b, s):
    rise = (level_by_id(b, s["to"]) or {}).get("elevation", 0) - (level_by_id(b, s["from"]) or {}).get("elevation", 0)
    return {"rise": rise, "steps": s.get("steps", max(2, round(rise / STEP_RISE)))}


def plan_to_lnglat(geo, p):
    t = math.radians(geo.get("north", 0))
    x, z = p
    e = x * math.cos(t) - z * math.sin(t)
    n = -x * math.sin(t) - z * math.cos(t)
    lat = geo["lat"] + n / 111_320
    lng = geo["lng"] + e / (111_320 * math.cos(math.radians(geo["lat"])))
    return [lng, lat]


def room_shell(b, room_id):
    """A building's room as a normalised shell in the room frame (mirror of buildingRoomShell in shell.js)."""
    room = room_by_id(b, room_id)
    if not room:
        return None
    level = level_by_id(b, room["level"])
    frame = room_frame(b, room)
    ox, _, oz = frame["origin"]

    def loc(p):
        return [p[0] - ox, p[1] - oz]

    edges = room_edges(b, room)
    centre = [e["a"] for e in edges]
    dists = [e["thickness"] / 2 for e in edges]
    faces = P.inset_edges(centre, dists, P.winding_sign(centre))
    inner = [loc(p) for p in P.inset_polygon(centre, dists, P.winding_sign(centre))]
    walls, openings = [], []
    for i, e in enumerate(edges):
        a, bb = loc(e["a"]), loc(e["b"])
        ia, ib = loc(faces[i]["start"]), loc(faces[i]["end"])
        wid = e["wall"] or f"open-{i}"
        w = {"id": wid, "node": f"wall__{e['wall']}" if e["wall"] else None, "a": ia, "b": ib, "out": e["out"],
             "length": math.hypot(ib[0] - ia[0], ib[1] - ia[1]), "thickness": e["thickness"], "legacy": None,
             "open": not e["wall"]}
        walls.append(w)
        if not e["wall"]:
            continue
        line = e["line"]
        forward = line["a"] == room["outline"][i]
        lab = math.hypot(bb[0] - a[0], bb[1] - a[1]) or 1
        shift = ((ia[0] - a[0]) * (bb[0] - a[0]) + (ia[1] - a[1]) * (bb[1] - a[1])) / lab
        for o in wall_openings(b, e["wall"]):
            u0 = o["u0"] if forward else line["length"] - o["u1"]
            op = {"type": o["type"], "offset": u0 - shift, "width": o["u1"] - o["u0"], "height": o["head"] - o["sill"],
                  "sill": o["sill"], "id": o["id"]}
            openings.append(scene_io._place_opening(len(openings), w, op))
    outline = inner if P.winding_sign(inner) > 0 else list(reversed(inner))
    c = room.get("ceiling") or {}
    return scene_io.finish_shell({"kind": "building", "outline": outline, "box": P.bbox(outline), "walls": walls,
                                  "openings": openings, "height": c.get("height", level["height"] if level else 2.6),
                                  "ceilingSpec": c, "floor": room.get("floor") or {}, "wallsSpec": room.get("walls") or {},
                                  "frame": frame, "room": room})


# ── validation (mirror of building/validate.js) ──────────────────────────────

def _fmt(p):
    return "[" + ", ".join(str(round(v, 3)) for v in p) + "]"


def validate_building(b) -> list[tuple[str, str]]:
    root = schema()
    errors: list[tuple[str, str]] = []
    scene_io._check(root, root, b, "", errors)
    if errors or not isinstance(b, dict):
        return errors

    def err(path, msg):
        errors.append((path, msg))

    def uniq(items, path, label):
        seen = {}
        for i, x in enumerate(items or []):
            if x["id"] in seen:
                err(f"{path}/{i}/id", f'duplicate {label} id "{x["id"]}" (also {path}/{seen[x["id"]]})')
            else:
                seen[x["id"]] = i

    site = b.get("site") or {}
    uniq(b.get("levels"), "/levels", "level")
    uniq(b.get("rooms"), "/rooms", "room")
    uniq(b.get("openings"), "/openings", "opening")
    uniq(b.get("stairs"), "/stairs", "stair")
    uniq(site.get("areas"), "/site/areas", "area")
    uniq(site.get("fences"), "/site/fences", "fence")
    uniq(site.get("trees"), "/site/trees", "tree")
    wall_at = {}
    for li, level in enumerate(b["levels"]):
        uniq(level["nodes"], f"/levels/{li}/nodes", "node")
        for wi, w in enumerate(level["walls"]):
            if w["id"] in wall_at:
                err(f"/levels/{li}/walls/{wi}/id", f'duplicate wall id "{w["id"]}" (also {wall_at[w["id"]]})')
            else:
                wall_at[w["id"]] = f"/levels/{li}/walls/{wi}"

    for li, level in enumerate(b["levels"]):
        nodes = node_map(level)
        at = f"/levels/{li}"
        for wi, w in enumerate(level["walls"]):
            if w["a"] not in nodes:
                err(f"{at}/walls/{wi}/a", f'no node "{w["a"]}" on level "{level["id"]}"')
            if w["b"] not in nodes:
                err(f"{at}/walls/{wi}/b", f'no node "{w["b"]}" on level "{level["id"]}"')
            if w["a"] == w["b"]:
                err(f"{at}/walls/{wi}", "a wall needs two different nodes")
        lines = wall_lines(b, level["id"])
        path_of = {w["id"]: f"{at}/walls/{wi}" for wi, w in enumerate(level["walls"])}
        for w in lines:
            if w["length"] < 0.05:
                err(path_of[w["id"]], f"is only {w['length'] * 100:.1f} cm long")
        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                p, q = lines[i], lines[j]
                if (p["a"] == q["a"] and p["b"] == q["b"]) or (p["a"] == q["b"] and p["b"] == q["a"]):
                    err(path_of[q["id"]], f'walls "{p["id"]}" and "{q["id"]}" join the same two nodes: a shared wall exists once')
                    continue
                ov = P.collinear_overlap(p["pa"], p["pb"], q["pa"], q["pb"], TOL)
                if ov > TOL:
                    err(path_of[q["id"]], f'walls "{p["id"]}" and "{q["id"]}" overlap along {ov:.2f} m: a shared wall exists once')
                x = P.proper_crossing(p["pa"], p["pb"], q["pa"], q["pb"])
                if x:
                    err(path_of[q["id"]], f'walls "{p["id"]}" and "{q["id"]}" cross at {_fmt(x)} without a node: split both there')
        for n in level["nodes"]:
            for w in lines:
                if n["id"] in (w["a"], w["b"]):
                    continue
                d, t = P.seg_dist(n["at"], w["pa"], w["pb"])
                if d <= TOL and 1e-6 < t < 1 - 1e-6:
                    err(path_of[w["id"]], f'node "{n["id"]}" sits on wall "{w["id"]}": split the wall at it')
        degree: dict = {}
        for w in lines:
            if w["exterior"]:
                degree[w["a"]] = degree.get(w["a"], 0) + 1
                degree[w["b"]] = degree.get(w["b"], 0) + 1
        for nid, deg in degree.items():
            if deg != 2:
                err(f"{at}/walls", f'the exterior walls must close into loops, but node "{nid}" has {deg} exterior wall(s)')

    polys = []
    spot_room = {}
    for ri, room in enumerate(b["rooms"]):
        at = f"/rooms/{ri}"
        level = level_by_id(b, room["level"])
        if not level:
            err(f"{at}/level", f'no level "{room["level"]}"')
            continue
        nodes = node_map(level)
        bad = False
        for k, nid in enumerate(room["outline"]):
            if nid not in nodes:
                err(f"{at}/outline/{k}", f'no node "{nid}" on level "{level["id"]}"')
                bad = True
        if len(set(room["outline"])) != len(room["outline"]):
            err(f"{at}/outline", "lists a node twice")
            bad = True
        for k, sid in enumerate(room.get("spotIds", [])):
            if sid in spot_room:
                err(f"{at}/spotIds/{k}", f'spot {sid} is already in room "{spot_room[sid]}"')
            else:
                spot_room[sid] = room["id"]
        if bad:
            continue
        pts = room_polygon(b, room)
        if not P.is_simple(pts, 0.05):
            err(f"{at}/outline", "must be a simple polygon")
            continue
        if P.area(pts) < 0.5:
            err(f"{at}/outline", f"encloses only {P.area(pts):.2f} m2 (at least 0.5)")
        c = room.get("ceiling") or {}
        h = c.get("height", level["height"])
        if c.get("shape") and c["shape"] != "flat" and not c.get("peak", 0) > max(h, *(c.get("eaves") or [h])):
            err(f"{at}/ceiling/peak", f"must be above the eaves, got {c.get('peak')}")
        polys.append((room, ri, pts))
    for i in range(len(polys)):
        for j in range(i + 1, len(polys)):
            (ra, _, pa), (rb, rbi, pb) = polys[i], polys[j]
            if ra["level"] == rb["level"] and rooms_overlap(pa, pb):
                err(f"/rooms/{rbi}/outline", f'overlaps room "{ra["id"]}"')

    walls = wall_index(b)
    by_wall: dict = {}
    for oi, o in enumerate(b.get("openings", [])):
        at = f"/openings/{oi}"
        w = walls.get(o["wall"])
        if not w:
            err(f"{at}/wall", f'no wall "{o["wall"]}"')
            continue
        sill = o.get("sill", 0.9 if o["type"] == "window" else 0.0)
        if o["offset"] + o["width"] > w["length"] + 0.001:
            err(at, f'runs past the end of wall "{w["id"]}"')
        if sill + o["height"] > w["height"] + 0.001:
            err(at, f'its top is above wall "{w["id"]}"')
        by_wall.setdefault(o["wall"], []).append((oi, o["offset"], o["offset"] + o["width"], sill, sill + o["height"]))
    for items in by_wall.values():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                p, q = items[i], items[j]
                if min(p[2], q[2]) - max(p[1], q[1]) > 0.001 and min(p[4], q[4]) - max(p[3], q[3]) > 0.001:
                    err(f"/openings/{q[0]}", f"overlaps opening {p[0]}")

    for si, s in enumerate(b.get("stairs", [])):
        frm, to = level_by_id(b, s["from"]), level_by_id(b, s["to"])
        if not frm:
            err(f"/stairs/{si}/from", f'no level "{s["from"]}"')
        if not to:
            err(f"/stairs/{si}/to", f'no level "{s["to"]}"')
        if frm and to and not to["elevation"] > frm["elevation"]:
            err(f"/stairs/{si}/to", f'must be above "{s["from"]}"')
    roof = b.get("roof") or {}
    if roof.get("level") and not level_by_id(b, roof["level"]):
        err("/roof/level", f'no level "{roof["level"]}"')
    for pi, part in enumerate(roof.get("parts", [])):
        if not P.is_simple(part["outline"], 0.05):
            err(f"/roof/parts/{pi}/outline", "must be a simple polygon")
        if part.get("level") and not level_by_id(b, part["level"]):
            err(f"/roof/parts/{pi}/level", f'no level "{part["level"]}"')
    if site:
        if not P.is_simple(site["lot"], 0.05):
            err("/site/lot", "must be a simple polygon")
        for ai, area in enumerate(site.get("areas", [])):
            if not P.is_simple(area["outline"], 0.02):
                err(f"/site/areas/{ai}/outline", "must be a simple polygon")
    return errors


def _min_dist(p, poly):
    return min(P.seg_dist(p, poly[i], poly[(i + 1) % len(poly)])[0] for i in range(len(poly)))


def interior_point(poly):
    c = [sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)]
    if P.point_in_polygon(c, poly) and _min_dist(c, poly) > 0.05:
        return c
    sign = 1 if P.signed_area(poly) >= 0 else -1
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        length = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        inward = (-sign * (b[1] - a[1]) / length, sign * (b[0] - a[0]) / length)
        p = [(a[0] + b[0]) / 2 + inward[0] * 0.05, (a[1] + b[1]) / 2 + inward[1] * 0.05]
        if P.point_in_polygon(p, poly):
            return p
    return c


def rooms_overlap(pa, pb):
    for i in range(len(pa)):
        for j in range(len(pb)):
            if P.proper_crossing(pa[i], pa[(i + 1) % len(pa)], pb[j], pb[(j + 1) % len(pb)]):
                return True

    def inside(p, poly):
        return P.point_in_polygon(p, poly) and _min_dist(p, poly) > TOL

    if any(inside(p, pb) for p in pa) or any(inside(q, pa) for q in pb):
        return True
    return inside(interior_point(pa), pb) or inside(interior_point(pb), pa)


class BuildingError(ValueError):
    pass


def load_building(path) -> dict:
    b = json.loads(Path(path).read_text(encoding="utf-8"))
    errors = validate_building(b)
    if errors:
        raise BuildingError("building.json is invalid:\n" + "\n".join(f"  {p or '/'} {m}" for p, m in errors))
    return b


if __name__ == "__main__":
    bad = False
    for arg in sys.argv[1:]:
        try:
            load_building(arg)
            print(f"ok  {arg}")
        except BuildingError as e:
            print(f"BAD {arg}\n{e}")
            bad = True
    sys.exit(1 if bad else 0)
