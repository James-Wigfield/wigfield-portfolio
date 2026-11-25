"""Dream Rooms kit · module `room`: four walls, a floor, a ceiling, its doorways (+ Z-stubs) and props."""

from __future__ import annotations

from kit import build_props, reserve_props, shell


def build(mb):
    reserve_props(mb)
    shell.build_shell(mb)
    build_props(mb)
