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
    if "const" in node and value != node["const"]:
        errors.append((path, f"must be {json.dumps(node['const'])}"))
    if "enum" in node and value not in node["enum"]:
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
        if "pattern" in node and not re.search(node["pattern"], value):
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
    seen: set[int] = set()
    for i, c in enumerate(scene.get("cameras", [])):
        if c["photo"] in seen:
            errors.append((f"/cameras/{i}/photo", f"photo {c['photo']} already has a camera"))
        seen.add(c["photo"])
    return errors


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
