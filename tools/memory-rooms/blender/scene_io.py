"""scene.json I/O for the Blender kit.

Reads the SAME schema file the web app uses (src/memory-rooms/scene/scene.schema.json)
and validates with the same keyword subset as src/memory-rooms/scene/validate.js.
Also holds the ONE scene -> Blender coordinate conversion (see CONTRACTS.md section 1).

Pure Python (no bpy import at module level), so it can be unit-tested outside Blender:
    python tools/memory-rooms/blender/scene_io.py tools/memory-rooms/examples/bedroom.scene.json
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import polygon2d as P  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO / "src" / "memory-rooms" / "scene" / "scene.schema.json"

ANNOTATIONS = {"$schema", "$id", "$comment", "$defs", "title", "description", "default", "examples"}
SUPPORTED = {
    "type", "enum", "const", "properties", "required", "additionalProperties", "items", "prefixItems",
    "minItems", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength",
    "maxLength", "pattern", "allOf", "anyOf", "oneOf", "not", "if", "then", "else", "$ref",
}

_schema_cache: dict | None = None


def schema() -> dict:
    global _schema_cache
    if _schema_cache is None:
        _schema_cache = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return _schema_cache


def kits() -> list[str]:
    return list(schema()["$defs"]["kit"]["enum"])


def material_names() -> list[str]:
    return list(schema()["$defs"]["material"]["enum"])


# ── validator (mirror of validate.js) ─────────────────────────────────────────

def _type_of(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "integer" if v.is_integer() else "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def _is_type(v, t):
    a = _type_of(v)
    if t == "number":
        return a in ("number", "integer")
    return a == t


def _same(a, b):
    """JSON equality as validate.js sees it (JSON.stringify): true is not 1, 1.0 is 1."""
    na = isinstance(a, (int, float)) and not isinstance(a, bool)
    nb = isinstance(b, (int, float)) and not isinstance(b, bool)
    if na or nb:
        return na and nb and a == b
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def _matches(pattern, value):
    """RegExp.test semantics: a trailing $ means the very end (Python's $ also matches before a final newline)."""
    m = re.search(pattern, value)
    return bool(m) and (not pattern.endswith("$") or m.end() == len(value))


def _resolve(root, ref):
    if not ref.startswith("#/"):
        raise ValueError(f"Only local $ref is supported, got {ref}")
    node = root
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def _check(root, node, value, path, errors):
    if node is True:
        return
    if node is False:
        errors.append((path, "is not allowed here"))
        return
    for key in node:
        if key not in ANNOTATIONS and key not in SUPPORTED:
            raise ValueError(f"scene validator: unsupported schema keyword {key!r} at {path or '/'}")
    if "$ref" in node:
        _check(root, _resolve(root, node["$ref"]), value, path, errors)
    if "type" in node:
        types = node["type"] if isinstance(node["type"], list) else [node["type"]]
        if not any(_is_type(value, t) for t in types):
            errors.append((path, f"must be {' or '.join(types)} (got {_type_of(value)})"))
            return
    if "const" in node and not _same(value, node["const"]):
        errors.append((path, f"must be {json.dumps(node['const'])}"))
    if "enum" in node and not any(_same(value, e) for e in node["enum"]):
        errors.append((path, f"{json.dumps(value)} is not one of: {', '.join(map(str, node['enum'][:12]))}"))
    if _type_of(value) in ("number", "integer"):
        if "minimum" in node and value < node["minimum"]:
            errors.append((path, f"must be >= {node['minimum']} (got {value})"))
        if "maximum" in node and value > node["maximum"]:
            errors.append((path, f"must be <= {node['maximum']} (got {value})"))
        if "exclusiveMinimum" in node and value <= node["exclusiveMinimum"]:
            errors.append((path, f"must be > {node['exclusiveMinimum']} (got {value})"))
        if "exclusiveMaximum" in node and value >= node["exclusiveMaximum"]:
            errors.append((path, f"must be < {node['exclusiveMaximum']} (got {value})"))
    if isinstance(value, str):
        if "minLength" in node and len(value) < node["minLength"]:
            errors.append((path, f"must be at least {node['minLength']} characters"))
        if "maxLength" in node and len(value) > node["maxLength"]:
            errors.append((path, f"must be at most {node['maxLength']} characters"))
        if "pattern" in node and not _matches(node["pattern"], value):
            errors.append((path, f"{value!r} does not match {node['pattern']}"))
    if isinstance(value, list):
        if "minItems" in node and len(value) < node["minItems"]:
            errors.append((path, f"must have at least {node['minItems']} items"))
        if "maxItems" in node and len(value) > node["maxItems"]:
            errors.append((path, f"must have at most {node['maxItems']} items"))
        prefix = node.get("prefixItems", [])
        for i, sub in enumerate(prefix):
            if i < len(value):
                _check(root, sub, value[i], f"{path}/{i}", errors)
        if "items" in node:
            for i in range(len(prefix), len(value)):
                _check(root, node["items"], value[i], f"{path}/{i}", errors)
    if isinstance(value, dict):
        for req in node.get("required", []):
            if req not in value:
                errors.append((path, f'is missing required "{req}"'))
        props = node.get("properties", {})
        extra = node.get("additionalProperties", True)
        for k, v in value.items():
            if k in props:
                _check(root, props[k], v, f"{path}/{k}", errors)
            elif extra is False:
                errors.append((f"{path}/{k}", f'unknown property "{k}"'))
            elif isinstance(extra, dict):
                _check(root, extra, v, f"{path}/{k}", errors)
    for sub in node.get("allOf", []):
        _check(root, sub, value, path, errors)
    if "anyOf" in node and not any(_passes(root, s, value) for s in node["anyOf"]):
        errors.append((path, "matches none of the allowed shapes (anyOf)"))
    if "oneOf" in node:
        n = sum(1 for s in node["oneOf"] if _passes(root, s, value))
        if n != 1:
            errors.append((path, f"must match exactly one shape (oneOf), matched {n}"))
    if "not" in node and _passes(root, node["not"], value):
        req = node["not"].get("required")
        errors.append((path, f'must not have "{req[0]}"' if req else "matches a forbidden shape"))
    if "if" in node:
        if _passes(root, node["if"], value):
            if "then" in node:
                _check(root, node["then"], value, path, errors)
        elif "else" in node:
            _check(root, node["else"], value, path, errors)


def _passes(root, node, value):
    errs: list = []
    _check(root, node, value, "", errs)
    return not errs


def validate_scene(scene: dict) -> list[tuple[str, str]]:
    """Schema + cross-reference checks (same as validateScene in validate.js)."""
    root = schema()
    errors: list[tuple[str, str]] = []
    _check(root, root, scene, "", errors)
    if errors or not isinstance(scene, dict):
        return errors
    ids: dict[str, int] = {}
    for i, o in enumerate(scene.get("objects", [])):
        if o["id"] in ids:
            errors.append((f"/objects/{i}/id", f'duplicate id "{o["id"]}"'))
        else:
            ids[o["id"]] = i
    for i, o in enumerate(scene.get("objects", [])):
        for j, other in enumerate(o.get("overlaps", [])):
            if other not in ids:
                errors.append((f"/objects/{i}/overlaps/{j}", f'no object with id "{other}"'))
    for i, light in enumerate(scene.get("lights", [])):
        if light.get("object") and light["object"] not in ids:
            errors.append((f"/lights/{i}/object", f'no object with id "{light["object"]}"'))
    seen: set[int] = set()
    for i, c in enumerate(scene.get("cameras", [])):
        if c["photo"] in seen:
            errors.append((f"/cameras/{i}/photo", f"photo {c['photo']} already has a camera"))
        seen.add(c["photo"])
    if scene.get("shell"):
        _shell_checks(scene["shell"], errors)
    return errors


def _shell_checks(sh, errors):
    """v2 shell rules a schema can't say (mirror of shellChecks in validate.js)."""
    if sh.get("building"):
        return
    polygon = isinstance(sh.get("outline"), list)
    if polygon:
        pts = sh["outline"]
        box = P.bbox(pts)
        if not P.is_simple(pts, 0.05):
            errors.append(("/shell/outline", "must be a simple polygon (no crossing or touching edges, no spikes, every edge at least 5 cm)"))
        elif P.area(pts) < 0.5:
            errors.append(("/shell/outline", f"encloses only {P.area(pts):.2f} m2 (at least 0.5)"))
        if abs(box["min"][0]) > 0.001 or abs(box["min"][1]) > 0.001:
            errors.append(("/shell/outline", f"its bounding box must start at [0, 0]; it starts at {box['min']}"))
    for i, op in enumerate(sh.get("openings", [])):
        if polygon and "wall" in op:
            errors.append((f"/shell/openings/{i}/wall", "a polygon shell names its walls by edge, not by compass side"))
        if not polygon and "edge" in op:
            errors.append((f"/shell/openings/{i}/edge", "a box shell names its walls (north, south, east, west), not edges"))
        if polygon and "edge" in op and op["edge"] >= len(sh["outline"]):
            errors.append((f"/shell/openings/{i}/edge", f"edge {op['edge']} doesn't exist (the outline has {len(sh['outline'])} edges)"))
    c = sh.get("ceiling") or {}
    if c.get("shape") and c["shape"] != "flat":
        eaves = c.get("eaves") or [sh["height"], sh["height"]]
        top = max(sh["height"], *eaves)
        if not c.get("peak", 0) > top:
            errors.append(("/shell/ceiling/peak", f"must be above the eaves ({top} m), got {c.get('peak')}"))
        pts = sh["outline"] if polygon else [[0, 0], [sh["width"], 0], [sh["width"], sh["depth"]], [0, sh["depth"]]]
        box = P.bbox(pts)
        if c["shape"] == "gable" and "ridgeAt" in c:
            axis = c.get("axis") or ("x" if box["max"][0] - box["min"][0] >= box["max"][1] - box["min"][1] else "z")
            lo, hi = (box["min"][1], box["max"][1]) if axis == "x" else (box["min"][0], box["max"][0])
            if not lo < c["ridgeAt"] < hi:
                errors.append(("/shell/ceiling/ridgeAt", f"must lie inside the room across the ridge ({lo}-{hi}), got {c['ridgeAt']}"))
        if c["shape"] == "pyramid" and c.get("apex") and not P.point_in_polygon(c["apex"], pts):
            errors.append(("/shell/ceiling/apex", f"{c['apex']} is outside the room"))


# ── the normalised shell (mirror of src/memory-rooms/scene/shell.js) ──────────
SIDES = ("north", "south", "east", "west")
SIDE_OUT = {"north": [0, -1], "south": [0, 1], "west": [-1, 0], "east": [1, 0]}


def shell_kind(sh):
    if not sh:
        return None
    if sh.get("building"):
        return "building"
    if sh.get("outline"):
        return "polygon"
    return "box"


def _default_sill(op):
    return op.get("sill", 0.9 if op["type"] == "window" else 0.0)


def _place_opening(index, w, op):
    ux = (w["b"][0] - w["a"][0]) / (w["length"] or 1)
    uz = (w["b"][1] - w["a"][1]) / (w["length"] or 1)
    sill = _default_sill(op)
    off, width = op["offset"], op["width"]
    return {"index": index, "wall": w["id"], "type": op["type"], "offset": off, "width": width,
            "height": op["height"], "sill": sill, "head": sill + op["height"],
            "from": [w["a"][0] + ux * off, w["a"][1] + uz * off],
            "to": [w["a"][0] + ux * (off + width), w["a"][1] + uz * (off + width)], "spec": op}


def resolve_shell(scene, building=None, legacy_names=None):
    """Any shell -> the normalised shell dict (same keys as resolveShell in shell.js), or None."""
    sh = scene.get("shell")
    kind = shell_kind(sh)
    if not kind:
        return None
    if legacy_names is None:
        legacy_names = scene.get("version", 1) < 2
    if kind == "building":
        if building is None:
            return None
        import building_io  # noqa: PLC0415 (lazy: building_io imports this module)
        return building_io.room_shell(building, sh["room"])
    thickness = (sh.get("walls") or {}).get("thickness", 0.12)
    if kind == "box":
        W, D = sh["width"], sh["depth"]
        outline = [[0, 0], [W, 0], [W, D], [0, D]]
        ends = {"north": ([0, 0], [W, 0]), "south": ([0, D], [W, D]), "west": ([0, 0], [0, D]), "east": ([W, 0], [W, D])}
        walls = []
        for side in SIDES:
            a, b = ends[side]
            walls.append({"id": side, "node": f"wall_{side}" if legacy_names else f"wall__{side}", "a": a, "b": b,
                          "out": SIDE_OUT[side], "length": W if side in ("north", "south") else D,
                          "thickness": thickness, "legacy": side})
    else:
        pts = [[float(x), float(z)] for x, z in sh["outline"]]
        sign = P.winding_sign(pts)
        walls = []
        for i, a in enumerate(pts):
            b = pts[(i + 1) % len(pts)]
            walls.append({"id": f"e{i}", "node": f"wall__e{i}", "a": a, "b": b, "out": P.edge_out(a, b, sign),
                          "length": math.hypot(b[0] - a[0], b[1] - a[1]), "thickness": thickness, "legacy": None})
        outline = pts if sign > 0 else list(reversed(pts))
    by_id = {w["id"]: w for w in walls}
    openings = []
    for index, op in enumerate(sh.get("openings", [])):
        w = by_id.get(f"e{op['edge']}" if "edge" in op else op.get("wall"))
        if w:
            openings.append(_place_opening(index, w, op))
    return finish_shell({"kind": kind, "outline": outline, "box": P.bbox(outline), "walls": walls, "openings": openings,
                         "height": sh["height"], "ceilingSpec": sh.get("ceiling") or {}, "floor": sh.get("floor") or {},
                         "wallsSpec": sh.get("walls") or {}})


def finish_shell(s):
    spec = s["ceilingSpec"]
    shape = spec.get("shape", "flat")
    box = s["box"]
    W = box["max"][0] - box["min"][0]
    D = box["max"][1] - box["min"][1]
    axis = spec.get("axis") or ("x" if W >= D else "z")
    mid = (box["min"][1] + box["max"][1]) / 2 if axis == "x" else (box["min"][0] + box["max"][0]) / 2
    ceiling = {"shape": shape, "show": spec.get("show", True), "color": spec.get("color"),
               "peak": s["height"] if shape == "flat" else spec["peak"], "axis": axis,
               "ridgeAt": spec.get("ridgeAt", mid), "eaves": spec.get("eaves") or [s["height"], s["height"]],
               "apex": spec.get("apex") or P.centroid(s["outline"]), "low": spec.get("low")}
    out = {"kind": s["kind"], "outline": s["outline"], "box": box, "width": W, "depth": D, "height": s["height"],
           "ceiling": ceiling, "walls": s["walls"], "openings": s["openings"], "floor": s["floor"],
           "wallsSpec": s["wallsSpec"]}
    for k in ("frame", "room"):
        if k in s:
            out[k] = s[k]
    out["top"] = s["height"] if shape == "flat" else max(s["height"], ceiling["peak"], *ceiling["eaves"])
    return out


def ceiling_at(sh, x, z):
    """Ceiling height at [x, z] (room frame) of a normalised shell."""
    c = sh["ceiling"]
    H = sh["height"]
    mn, mx = sh["box"]["min"], sh["box"]["max"]
    if c["shape"] == "gable":
        across = z if c["axis"] == "x" else x
        lo, hi = (mn[1], mx[1]) if c["axis"] == "x" else (mn[0], mx[0])
        r = c["ridgeAt"]
        if across <= r:
            return c["peak"] if r - lo < 1e-9 else c["eaves"][0] + (c["peak"] - c["eaves"][0]) * (across - lo) / (r - lo)
        return c["peak"] if hi - r < 1e-9 else c["eaves"][1] + (c["peak"] - c["eaves"][1]) * (hi - across) / (hi - r)
    if c["shape"] == "pyramid":
        s = min(1.0, P.ray_scale(c["apex"], [x, z], sh["outline"]))
        return c["peak"] - (c["peak"] - H) * s
    if c["shape"] == "skillion":
        f = {"north": (z - mn[1]) / ((mx[1] - mn[1]) or 1), "south": (mx[1] - z) / ((mx[1] - mn[1]) or 1),
             "west": (x - mn[0]) / ((mx[0] - mn[0]) or 1), "east": (mx[0] - x) / ((mx[0] - mn[0]) or 1)}[c["low"]]
        return H + (c["peak"] - H) * max(0.0, min(1.0, f))
    return H


def wall_top_at(sh, wall, u):
    t = max(0.0, min(1.0, u / (wall["length"] or 1)))
    return ceiling_at(sh, wall["a"][0] + (wall["b"][0] - wall["a"][0]) * t, wall["a"][1] + (wall["b"][1] - wall["a"][1]) * t)


class SceneError(ValueError):
    pass


def load_scene(path) -> dict:
    """Read + validate scene.json. Raises SceneError listing every problem."""
    scene = json.loads(Path(path).read_text(encoding="utf-8"))
    errors = validate_scene(scene)
    if errors:
        raise SceneError("scene.json is invalid:\n" + "\n".join(f"  {p or '/'} {m}" for p, m in errors))
    return scene


# ── the ONE coordinate conversion ─────────────────────────────────────────────
# scene: x east, y up, z south.  Blender: x east, y north, z up.
# The glTF exporter (+Y up) maps Blender (x, y, z) -> glTF (x, z, -y), which
# gives back exactly the scene coordinates.

def to_bl(p):
    """scene (x, y, z) -> Blender (x, -z, y)."""
    x, y, z = p
    return (float(x), -float(z), float(y))


def from_bl(p):
    """Blender (x, y, z) -> scene (x, z, -y). Inverse of to_bl."""
    x, y, z = p
    return (float(x), float(z), -float(y))


def rot_bl(rot_y_deg) -> float:
    """scene rotY (degrees about +y) -> Blender rotation_euler.z (radians about +z). Same sense."""
    return math.radians(float(rot_y_deg or 0.0))


def hex_rgb(h: str, linear: bool = True):
    """'#rrggbb' -> (r, g, b) floats. Linear (scene-referred) by default, for Blender colour sockets."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    if linear:
        c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return tuple(c)


def hex_rgba(h: str, alpha: float = 1.0, linear: bool = True):
    return (*hex_rgb(h, linear), alpha)


def camera_angle_rad(cam: dict) -> float:
    """Blender camera angle for sensor_fit AUTO (= across the long edge)."""
    return math.radians(float(cam.get("fov", 70)))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        try:
            load_scene(arg)
            print(f"ok  {arg}")
        except SceneError as e:
            print(f"BAD {arg}\n{e}")
            sys.exit(1)
