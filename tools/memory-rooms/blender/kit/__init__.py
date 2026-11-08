"""Kit registry: scene object spec -> Blender objects.

    from kit import KitContext, build_object
    ctx = KitContext(scene=scene_dict, work=Path(work_dir), collection=coll)
    root = build_object(ctx, spec)      # an empty named obj__<id>, placed and rotated

Each piece lives in kit/<name>.py and defines build(ctx, spec) -> list[Object], modelled in
LOCAL space (see src/memory-rooms/CONTRACTS.md section 5):
    base centre at the origin; size [w, h, d] -> Blender x = w, z = h, y = d;
    the object's FRONT faces local -y (which is scene south at rotY 0).
Objects the piece returns are parented to the obj__<id> empty here, so a piece never
places itself in the room.
"""

from __future__ import annotations

import importlib
import importlib.util
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

import bpy

import materials as _materials
from scene_io import rot_bl, to_bl


@dataclass
class KitContext:
    scene: dict
    work: Path
    collection: bpy.types.Collection
    materials: object = _materials
    rng: random.Random = field(default_factory=random.Random)
    current_id: str = ""

    def seed(self, key: str):
        """Seed the rng from an object id so a rebuild is identical."""
        self.rng = random.Random(sum((i + 1) * ord(ch) for i, ch in enumerate(key)))
        self.current_id = key

    def link(self, obj):
        """Put an object into the room's collection (and nowhere else)."""
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        self.collection.objects.link(obj)
        return obj

    def mat(self, spec: dict, which: str = "main", fallback: str = "plaster"):
        """The material for a spec's main colour or its accent."""
        if which == "accent":
            return self.materials.get(spec.get("accentMaterial") or spec.get("material") or fallback,
                                      spec.get("accent") or spec.get("color"))
        return self.materials.get(spec.get("material") or fallback, spec.get("color"))


def _load_piece(name: str):
    return importlib.import_module(f"kit.{name}")


def _load_bespoke(ctx: KitContext, script: str):
    path = ctx.work / "bespoke" / f"{script}.py"
    if not path.exists():
        raise FileNotFoundError(f"bespoke script not found: {path}")
    mod_name = f"bespoke_{script}"
    spec = importlib.util.spec_from_file_location(mod_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


def build_object(ctx: KitContext, spec: dict):
    """Build one scene object; returns its root empty `obj__<id>`."""
    ctx.seed(spec["id"])
    kit = spec["kit"]
    if kit == "bespoke":
        module = _load_bespoke(ctx, spec["script"])
    else:
        module = _load_piece(kit)
    parts = module.build(ctx, spec) or []

    root = bpy.data.objects.new(f"obj__{spec['id']}", None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.1
    ctx.link(root)
    for i, ob in enumerate(parts):
        if ob.parent is None:
            ob.parent = root
        if not ob.name.startswith(f"obj__{spec['id']}"):
            ob.name = f"obj__{spec['id']}__{ob.name or i}"
    root.location = to_bl(spec["at"])
    root.rotation_euler = (0.0, 0.0, rot_bl(spec.get("rotY", 0)))
    root["mr_id"] = spec["id"]
    root["mr_kit"] = kit
    return root
