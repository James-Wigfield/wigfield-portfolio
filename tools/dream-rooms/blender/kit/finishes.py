"""Dream Rooms kit · procedural, tinted finishes (decision 9: used only when cited).

    make(kind, color=None, role="floor"|"walls"|"ceiling"|"water", invented=False) -> bpy material

Every finish reads the `tex` UV (planar, metres; see common.MeshBuilder), so patterns are in real
units and continue across chunks. `color` tints it; with no colour a finish takes a muted default of
its own kind. Anything invented is `plain`: untextured grey (the validator already enforces that).
Materials are cached by (kind, colour, role).

Add a finish: write `_<name>(nt, b, col, role)` below and register it in FINISHES.
"""

from __future__ import annotations

import common as C

GREY = "#76746f"  # invented: plain mid grey, swallowed by fog (named things carry the image)

DEFAULTS = {
    "carpet": "#6f6658", "tile": "#d9dbd6", "terrazzo": "#c9c2b4", "painted-block": "#b9b4a8",
    "wallpaper": "#bfb49c", "timber": "#8a6446", "linoleum": "#a9a48f", "water": "#3f6f78", "plain": GREY,
}

_CACHE: dict = {}


def _carpet(nt, b, col, role):
    fine = C.node(nt, "ShaderNodeTexNoise", Scale=90.0, Detail=6.0, Roughness=0.7)
    nt.links.new(C.tex_uv(nt), fine.inputs["Vector"])
    big = C.node(nt, "ShaderNodeTexNoise", Scale=0.9, Detail=2.0)
    nt.links.new(C.tex_uv(nt), big.inputs["Vector"])
    c_fine = C.ramp(nt, fine.outputs["Fac"], [(0.3, C.shade_hex(col, 0.78)), (0.7, C.shade_hex(col, 1.12))])
    c_big = C.ramp(nt, big.outputs["Fac"], [(0.35, C.shade_hex(col, 0.9)), (0.65, C.shade_hex(col, 1.05))])
    nt.links.new(C.mixrgb(nt, 0.5, c_fine, c_big, "MULTIPLY"), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    bump = C.node(nt, "ShaderNodeBump", Strength=0.25, Distance=0.002)
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])


def _grid(nt, b, col, size_w, size_h, mortar, mortar_hex, offset=0.0, vary=0.06, rough=0.35, bump=0.4):
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = offset
    br.squash_frequency = 1
    br.inputs["Color1"].default_value = C.rgba(C.shade_hex(col, 1.0 + vary))
    br.inputs["Color2"].default_value = C.rgba(C.shade_hex(col, 1.0 - vary))
    br.inputs["Mortar"].default_value = C.rgba(mortar_hex)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Mortar Smooth"].default_value = 0.2
    br.inputs["Brick Width"].default_value = size_w
    br.inputs["Row Height"].default_value = size_h
    nt.links.new(C.tex_uv(nt), br.inputs["Vector"])
    b.inputs["Roughness"].default_value = rough
    if bump:
        bn = C.node(nt, "ShaderNodeBump", Strength=bump, Distance=0.003)
        nt.links.new(br.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return br


def _tile(nt, b, col, role):
    size = 0.15 if role == "walls" else 0.25
    br = _grid(nt, b, col, size, size, 0.004, C.shade_hex(col, 0.86), vary=0.035, rough=0.3)
    nt.links.new(br.outputs["Color"], b.inputs["Base Color"])


def _terrazzo(nt, b, col, role):
    vor = C.node(nt, "ShaderNodeTexVoronoi", Scale=55.0, Randomness=1.0)
    nt.links.new(C.tex_uv(nt), vor.inputs["Vector"])
    chip = nt.nodes.new("ShaderNodeMath")
    chip.operation = "LESS_THAN"
    nt.links.new(vor.outputs["Distance"], chip.inputs[0])
    chip.inputs[1].default_value = 0.28
    chips = C.ramp(nt, vor.outputs["Color"], [(0.0, C.shade_hex(col, 0.55)), (0.45, C.shade_hex(col, 1.25)),
                                              (0.8, C.mix_hex(col, "#9a6a4a", 0.5)), (1.0, "#f2efe8")])
    base_n = C.node(nt, "ShaderNodeTexNoise", Scale=4.0, Detail=3.0)
    nt.links.new(C.tex_uv(nt), base_n.inputs["Vector"])
    base = C.ramp(nt, base_n.outputs["Fac"], [(0.3, C.shade_hex(col, 0.95)), (0.7, C.shade_hex(col, 1.04))])
    nt.links.new(C.mixrgb(nt, chip.outputs[0], base, chips), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.35


def _painted_block(nt, b, col, role):
    br = _grid(nt, b, col, 0.39, 0.19, 0.011, C.shade_hex(col, 0.9), offset=0.5, vary=0.02, rough=0.75, bump=0.5)
    n = C.node(nt, "ShaderNodeTexNoise", Scale=30.0, Detail=4.0)
    nt.links.new(C.tex_uv(nt), n.inputs["Vector"])
    speck = C.ramp(nt, n.outputs["Fac"], [(0.4, C.shade_hex(col, 0.95)), (0.6, C.shade_hex(col, 1.03))])
    nt.links.new(C.mixrgb(nt, 0.35, br.outputs["Color"], speck, "MULTIPLY"), b.inputs["Base Color"])


def _wallpaper(nt, b, col, role):
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(C.tex_uv(nt), sep.inputs["Vector"])
    per = nt.nodes.new("ShaderNodeMath")
    per.operation = "MULTIPLY"
    per.inputs[1].default_value = 1 / 0.16  # one stripe pair every 16 cm
    nt.links.new(sep.outputs["X"], per.inputs[0])
    fr = nt.nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    nt.links.new(per.outputs[0], fr.inputs[0])
    st = C.ramp(nt, fr.outputs[0], [(0.0, C.shade_hex(col, 0.9)), (0.48, C.shade_hex(col, 0.9)),
                                     (0.52, C.shade_hex(col, 1.04)), (1.0, C.shade_hex(col, 1.04))])
    # the ramp is linear between stops; harden it with a constant-interpolation ramp
    st.node.color_ramp.interpolation = "CONSTANT"
    n = C.node(nt, "ShaderNodeTexNoise", Scale=6.0, Detail=2.0)
    nt.links.new(C.tex_uv(nt), n.inputs["Vector"])
    age = C.ramp(nt, n.outputs["Fac"], [(0.3, "#e9e4da"), (0.7, "#ffffff")])
    nt.links.new(C.mixrgb(nt, 1.0, st, age, "MULTIPLY"), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85


def _timber(nt, b, col, role):
    br = _grid(nt, b, col, 1.2, 0.14, 0.0025, C.shade_hex(col, 0.45), offset=0.37, vary=0.1, rough=0.5, bump=0.3)
    grain = C.node(nt, "ShaderNodeTexNoise", Scale=3.0, Detail=8.0, Distortion=1.5)
    nt.links.new(C.tex_uv(nt, (1.0, 14.0, 1.0)), grain.inputs["Vector"])
    g = C.ramp(nt, grain.outputs["Fac"], [(0.35, "#b8b8b8"), (0.65, "#ffffff")])
    nt.links.new(C.mixrgb(nt, 1.0, br.outputs["Color"], g, "MULTIPLY"), b.inputs["Base Color"])


def _linoleum(nt, b, col, role):
    big = C.node(nt, "ShaderNodeTexNoise", Scale=1.6, Detail=3.0)
    nt.links.new(C.tex_uv(nt), big.inputs["Vector"])
    vor = C.node(nt, "ShaderNodeTexVoronoi", Scale=140.0)
    nt.links.new(C.tex_uv(nt), vor.inputs["Vector"])
    a = C.ramp(nt, big.outputs["Fac"], [(0.3, C.shade_hex(col, 0.95)), (0.7, C.shade_hex(col, 1.05))])
    s = C.ramp(nt, vor.outputs["Distance"], [(0.05, C.shade_hex(col, 0.8)), (0.12, "#ffffff")])
    nt.links.new(C.mixrgb(nt, 1.0, a, s, "MULTIPLY"), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.4


def _water(nt, b, col, role):
    b.inputs["Base Color"].default_value = C.rgba(col)
    b.inputs["Roughness"].default_value = 0.03
    b.inputs["IOR"].default_value = 1.33
    b.inputs["Transmission Weight"].default_value = 0.6


def _plain(nt, b, col, role):
    b.inputs["Base Color"].default_value = C.rgba(col)
    b.inputs["Roughness"].default_value = 0.9


FINISHES = {
    "carpet": _carpet, "tile": _tile, "terrazzo": _terrazzo, "painted-block": _painted_block,
    "wallpaper": _wallpaper, "timber": _timber, "linoleum": _linoleum, "water": _water, "plain": _plain,
}


def make(kind, color=None, role="floor", invented=False):
    if invented or kind not in FINISHES:
        kind, color = "plain", None
    col = color or DEFAULTS[kind]
    key = (kind, col.lower(), role)
    if key in _CACHE:
        return _CACHE[key]
    m, nt, b = C.new_material(f"src_{kind}_{role}_{col.lstrip('#')}")
    FINISHES[kind](nt, b, col, role)
    m["dr_hex"] = col
    _CACHE[key] = m
    return m


def drop_tiles(color=None):
    """A suspended ceiling: 1.2 x 0.6 m mineral-fibre tiles in a pale T-bar grid (cited only)."""
    col = color or "#d4cfbf"
    key = ("drop-tiles", col, "ceiling")
    if key in _CACHE:
        return _CACHE[key]
    m, nt, b = C.new_material(f"src_droptiles_{col.lstrip('#')}")
    br = _grid(nt, b, col, 1.2, 0.6, 0.024, "#e4e1d8", vary=0.025, rough=0.95, bump=0.6)
    n = C.node(nt, "ShaderNodeTexNoise", Scale=120.0, Detail=4.0)
    nt.links.new(C.tex_uv(nt), n.inputs["Vector"])
    fis = C.ramp(nt, n.outputs["Fac"], [(0.35, "#c8c8c8"), (0.6, "#ffffff")])
    nt.links.new(C.mixrgb(nt, 0.6, br.outputs["Color"], fis, "MULTIPLY"), b.inputs["Base Color"])
    m["dr_hex"] = col
    _CACHE[key] = m
    return m


def dark_ceiling(kind):
    """high-dark / none: a ceiling the light never reaches."""
    col = "#1b1917" if kind == "high-dark" else "#070707"
    key = (kind, col, "ceiling")
    if key not in _CACHE:
        _CACHE[key] = C.flat(f"src_{kind}_ceiling", col, rough=1.0)
    return _CACHE[key]


def base_hex(mat):
    return mat.get("dr_hex", GREY) if mat else GREY
