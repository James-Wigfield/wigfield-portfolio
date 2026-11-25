"""Dream Rooms kit: one Python module per piece (see ../KIT.md).

Modules (world.json modules[].kit): room, hall, corridor, pool, bespoke  -> kit/<name>.py: build(mb)
Props   (modules[].props[].kit):    door, locker-bank, sign, board, light-panel, window-dark, chair, coat
                                    -> kit/<name with _>.py: reserve(mb, prop) (optional), build(mb, prop)
Finishes: kit/finishes.py. Light: kit/lights.py. The shared shell: kit/shell.py. Context: kit/base.py.
"""

from __future__ import annotations

import importlib

MODULE_KITS = ("room", "hall", "corridor", "pool", "bespoke")
PROP_KITS = ("door", "locker-bank", "sign", "board", "light-panel", "window-dark", "chair", "coat")


def module_kit(name):
    if name not in MODULE_KITS:
        raise ValueError(f"no module kit {name}")
    return importlib.import_module(f"kit.{name}")


def prop_kit(name):
    if name not in PROP_KITS:
        raise ValueError(f"no prop kit {name}")
    return importlib.import_module(f"kit.{name.replace('-', '_')}")


def reserve_props(mb):
    """Before the walls: let props cut holes / claim wall space."""
    for p in mb.module.get("props") or []:
        k = prop_kit(p["kit"])
        if hasattr(k, "reserve"):
            k.reserve(mb, p)


def build_props(mb):
    for p in mb.module.get("props") or []:
        prop_kit(p["kit"]).build(mb, p)
