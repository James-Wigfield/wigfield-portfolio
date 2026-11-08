"""Procedural material library for Memory Rooms: the one look every spot shares.

API (stable; kit pieces, the shell builder and the exporter depend on it):

    get(name, color=None, accent=None, **opts) -> bpy.types.Material
    floor(finish, color=None)   # shell floor finishes  (timber carpet tile concrete vinyl stone)
    wall(finish, color=None)    # shell wall finishes   (paint plaster brick timber tile concrete wallpaper)
    ground(finish, color=None)  # exterior ground plate (asphalt grass sand snow paving concrete gravel dirt)

`name` is one of the scene schema's material enum (scene_io.material_names()):
    oak pine walnut plaster brick concrete tile stone marble linen wool velvet leather
    metal chrome brass glass ceramic plastic paper plant emissive
plus the ground-only recipes asphalt grass sand snow gravel dirt.

Every material is procedural (noise / wave / voronoi / brick nodes, no image files) and TINTED by
`color` ('#rrggbb', sRGB; converted with scene_io.hex_rgba, which returns linear values). `accent`
is used where a recipe has a second colour (brick mortar, tile grout, marble veins, frame art).
Materials are cached per (name, color, accent, opts), so a room reuses them.

Texture space: Object coordinates, in metres, so patterns sit at real-world scale without UVs.
2-D patterns (brick, tile, planks, pavers) are box-projected: each face picks the plane of its
dominant object-space normal. Keep object scale at 1 (apply scale) or the patterns scale with it.

Names: glass materials start with `glass`, self-lit ones with `emit` (the GLB contract in
src/memory-rooms/CONTRACTS.md and the web viewer rely on those prefixes); every other material starts
with its recipe name (`oak_a8784a`, `tile_e6e4df_size0p3`, `grass_5b7f45`).

Bake-friendly: every material ends in a single Principled BSDF (bump only through its Normal input,
no view-dependent mixing, no light-path tricks). Each material also carries custom properties
`mr_material` (recipe), `mr_color` (hex) and `mr_albedo` (linear RGB) so a baker can treat metals
(which have no diffuse colour) specially.

Options (`**opts`) understood by recipes (unknown ones are ignored but still part of the cache key):
    oak/pine/walnut  grain="x"|"y"|"z" (grain direction, default x), planks="floor"|"wall"
    plaster          paint=True (smoother, flatter painted finish)
    concrete         polished=True, joints=<metres between saw-cut joints>
    tile             size=0.15 (metres), aspect=1 (width/height), offset=0 (0.5 = running bond), grout_w=0.004
    stone            flags=True (paving flags), pavers=True (small square pavers)
    wool             pile=True (carpet loop pile)
    metal            painted=True (powder coat instead of bare brushed metal)
    ceramic          matte=True (unglazed terracotta)
    plastic          vinyl=True (sheet floor with chips), gloss=True (screens, lacquer)
    paper            wallpaper=True (two-tone stripe), art="abstract"|"photo"|"map", seed=<int>
    glass            thin=True (thin-wall pane)
    emissive         strength=4.0
"""

from __future__ import annotations

import colorsys
import re
import warnings

import bpy

from scene_io import hex_rgb, hex_rgba

NAMES = (
    "oak", "pine", "walnut", "plaster", "brick", "concrete", "tile", "stone", "marble", "linen", "wool",
    "velvet", "leather", "metal", "chrome", "brass", "glass", "ceramic", "plastic", "paper", "plant", "emissive",
)
GROUND_NAMES = ("asphalt", "grass", "sand", "snow", "gravel", "dirt")

DEFAULT_COLOR = {
    "oak": "#a8784a", "pine": "#c9a273", "walnut": "#5e3f2a", "plaster": "#e8e2d6", "brick": "#9a4f3a",
    "concrete": "#9d9a94", "tile": "#e6e4df", "stone": "#8f8a80", "marble": "#ece9e4", "linen": "#dcd5c8",
    "wool": "#b9a88f", "velvet": "#7a4b52", "leather": "#6b4630", "metal": "#8c8f93", "chrome": "#d8dadd",
    "brass": "#c49a4a", "glass": "#cfe3e8", "ceramic": "#f0ece4", "plastic": "#d9d9d9", "paper": "#f1ead8",
    "plant": "#4f7a4a", "emissive": "#ffe2b0",
    "asphalt": "#3b3c3e", "grass": "#5b7f45", "sand": "#d8c39a", "snow": "#f2f4f6", "gravel": "#9a948a",
    "dirt": "#7a5e44",
}

# Shell finishes -> (recipe, opts, default colour)
FLOOR = {
    "timber": ("oak", {"planks": "floor"}, "#a7774f"),
    "carpet": ("wool", {"pile": True}, "#9a8f80"),
    "tile": ("tile", {"size": 0.3, "grout_w": 0.005}, "#e6e4df"),
    "concrete": ("concrete", {"polished": True}, "#a19d96"),
    "vinyl": ("plastic", {"vinyl": True}, "#cfc8bb"),
    "stone": ("stone", {"flags": True}, "#a39b8c"),
}
WALL = {
    "paint": ("plaster", {"paint": True}, "#ebe6dc"),
    "plaster": ("plaster", {}, "#e3dccf"),
    "brick": ("brick", {}, "#9a4f3a"),
    "timber": ("pine", {"planks": "wall"}, "#c9a273"),
    "tile": ("tile", {"size": 0.15}, "#f0eee9"),
    "concrete": ("concrete", {}, "#a5a29c"),
    "wallpaper": ("paper", {"wallpaper": True}, "#e6dcc8"),
}
GROUND = {
    "asphalt": ("asphalt", {}, "#3b3c3e"),
    "grass": ("grass", {}, "#5b7f45"),
    "sand": ("sand", {}, "#d8c39a"),
    "snow": ("snow", {}, "#f2f4f6"),
    "paving": ("stone", {"pavers": True}, "#b9b2a6"),
    "concrete": ("concrete", {"joints": 1.5}, "#aaa69e"),
    "gravel": ("gravel", {}, "#9a948a"),
    "dirt": ("dirt", {}, "#7a5e44"),
}

_cache: dict = {}


# ── colour helpers ────────────────────────────────────────────────────────────

def _norm_hex(h):
    if not h:
        return None
    h = str(h).strip()
    if not h.startswith("#"):
        h = "#" + h
    return h.lower() if re.fullmatch(r"#[0-9a-fA-F]{6}", h) else None


def _lin(h, alpha=1.0):
    return hex_rgba(h, alpha)


def _hsv_hex(h, dv=1.0, ds=1.0, dh=0.0):
    """Adjust an sRGB hex colour in HSV (value/saturation multipliers, hue offset) -> hex."""
    r, g, b = hex_rgb(h, linear=False)
    hh, s, v = colorsys.rgb_to_hsv(r, g, b)
    r, g, b = colorsys.hsv_to_rgb((hh + dh) % 1.0, min(1.0, s * ds), min(1.0, v * dv))
    return "#%02x%02x%02x" % tuple(round(max(0.0, min(1.0, c)) * 255) for c in (r, g, b))


def _mix_hex(a, b, t):
    ra, rb = hex_rgb(a, linear=False), hex_rgb(b, linear=False)
    return "#%02x%02x%02x" % tuple(round((x + (y - x) * t) * 255) for x, y in zip(ra, rb))


def _mul(rgba, f):
    return (rgba[0] * f, rgba[1] * f, rgba[2] * f, 1.0)


# ── node-graph builder ────────────────────────────────────────────────────────

class _G:
    """Tiny helper around a material node tree. Every recipe ends in self.bsdf (Principled)."""

    def __init__(self, mat):
        if mat.node_tree is None:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        self.nt, self.N, self.L = nt, nt.nodes, nt.links
        self.out = self.N.new("ShaderNodeOutputMaterial")
        self.out.location = (1200, 0)
        self.bsdf = self.N.new("ShaderNodeBsdfPrincipled")
        self.bsdf.location = (900, 0)
        self.L.new(self.bsdf.outputs[0], self.out.inputs["Surface"])
        self._tc = None
        self._box = None
        self._i = 0

    # plumbing
    def n(self, kind, **props):
        node = self.N.new(kind)
        self._i += 1
        node.location = (-200 * (self._i % 6), -160 * (self._i // 6))
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def put(self, sock, v):
        if v is None:
            return
        if isinstance(v, bpy.types.NodeSocket):
            self.L.new(v, sock)
        else:
            sock.default_value = v

    @property
    def tc(self):
        if self._tc is None:
            self._tc = self.n("ShaderNodeTexCoord")
        return self._tc

    @property
    def obj(self):
        return self.tc.outputs["Object"]

    @property
    def gen(self):
        return self.tc.outputs["Generated"]

    # maths
    def math(self, op, a, b=0.0, clamp=False):
        node = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.put(node.inputs[0], a)
        self.put(node.inputs[1], b)
        return node.outputs[0]

    def mul(self, *vals):
        out = vals[0]
        for v in vals[1:]:
            out = self.math("MULTIPLY", out, v)
        return out

    def vmath(self, op, a, b=None, scale=None):
        node = self.n("ShaderNodeVectorMath", operation=op)
        self.put(node.inputs[0], a)
        if b is not None:
            self.put(node.inputs[1], b)
        if scale is not None:
            self.put(node.inputs[3], scale)
        return node.outputs[1] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else node.outputs[0]

    def sep(self, v):
        node = self.n("ShaderNodeSeparateXYZ")
        self.put(node.inputs[0], v)
        return node.outputs[0], node.outputs[1], node.outputs[2]

    def comb(self, x, y, z):
        node = self.n("ShaderNodeCombineXYZ")
        for i, c in enumerate((x, y, z)):
            self.put(node.inputs[i], c)
        return node.outputs[0]

    def map(self, v, a, b, c, d, clamp=True, smooth=False):
        node = self.n("ShaderNodeMapRange", clamp=clamp, interpolation_type="SMOOTHSTEP" if smooth else "LINEAR")
        for i, x in enumerate((v, a, b, c, d)):
            self.put(node.inputs[i], x)
        return node.outputs[0]

    def stretch(self, v, sx, sy, sz):
        return self.vmath("MULTIPLY", v, (sx, sy, sz))

    # textures
    def noise(self, vec, scale=5.0, detail=2.0, rough=0.5, dist=0.0, lac=2.0, kind="FBM", w=None, color=False):
        node = self.n("ShaderNodeTexNoise", noise_dimensions="4D" if w is not None else "3D")
        node.noise_type = kind
        node.normalize = True
        for k, v in (("Vector", vec), ("Scale", scale), ("Detail", detail), ("Roughness", rough),
                     ("Distortion", dist), ("Lacunarity", lac), ("W", w)):
            if v is not None:
                self.put(node.inputs[k], v)
        return node.outputs[1] if color else node.outputs[0]

    def voronoi(self, vec, scale=5.0, feature="F1", rand=1.0, out="Distance", w=None):
        node = self.n("ShaderNodeTexVoronoi", feature=feature,
                      voronoi_dimensions="4D" if w is not None else "3D")
        for k, v in (("Vector", vec), ("Scale", scale), ("Randomness", rand), ("W", w)):
            if v is not None:
                self.put(node.inputs[k], v)
        return node.outputs[out]

    def wave(self, vec, scale=5.0, kind="BANDS", direction="X", dist=0.0, detail=2.0, dscale=1.0, drough=0.5,
             profile="SIN", phase=0.0):
        node = self.n("ShaderNodeTexWave", wave_type=kind, wave_profile=profile)
        if kind == "BANDS":
            node.bands_direction = direction
        else:
            node.rings_direction = direction
        for k, v in (("Vector", vec), ("Scale", scale), ("Distortion", dist), ("Detail", detail),
                     ("Detail Scale", dscale), ("Detail Roughness", drough), ("Phase Offset", phase)):
            if v is not None:
                self.put(node.inputs[k], v)
        return node.outputs["Factor"]

    def brick(self, vec, width, height, mortar=0.01, smooth=0.1, offset=0.5, freq=2,
              c1=(0, 0, 0, 1), c2=(1, 1, 1, 1), cm=(0, 0, 0, 1), bias=0.0):
        """Returns (colour, mortar mask). With the default colours, colour = per-brick random grey."""
        node = self.n("ShaderNodeTexBrick", offset=offset, offset_frequency=freq, squash=1.0, squash_frequency=2)
        for k, v in (("Vector", vec), ("Color1", c1), ("Color2", c2), ("Mortar", cm), ("Scale", 1.0),
                     ("Mortar Size", mortar), ("Mortar Smooth", smooth), ("Bias", bias),
                     ("Brick Width", width), ("Row Height", height)):
            if v is not None:
                self.put(node.inputs[k], v)
        return node.outputs["Color"], node.outputs["Factor"]

    # colour
    def hsv(self, color, value=1.0, hue=0.5, sat=1.0):
        node = self.n("ShaderNodeHueSaturation")
        for k, v in (("Hue", hue), ("Saturation", sat), ("Value", value), ("Fac", 1.0), ("Color", color)):
            sock = next(s for s in node.inputs if s.identifier == k)
            self.put(sock, v)
        return node.outputs[0]

    def mix(self, fac, a, b, blend="MIX"):
        node = self.n("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_result=True)
        self.put(node.inputs[0], fac)
        self.put(node.inputs[6], a)
        self.put(node.inputs[7], b)
        return node.outputs[2]

    def vmix(self, fac, a, b):
        node = self.n("ShaderNodeMix", data_type="VECTOR")
        self.put(node.inputs[0], fac)
        self.put(node.inputs[4], a)
        self.put(node.inputs[5], b)
        return node.outputs[1]

    def ramp(self, fac, stops, interp="LINEAR"):
        node = self.n("ShaderNodeValToRGB")
        cr = node.color_ramp
        cr.interpolation = interp
        els = cr.elements
        els[0].position, els[0].color = stops[0][0], stops[0][1]
        els[1].position, els[1].color = stops[-1][0], stops[-1][1]
        for pos, col in stops[1:-1]:
            e = els.new(pos)
            e.color = col
        self.put(node.inputs[0], fac)
        return node.outputs[0]

    def bump(self, height, strength=0.1, distance=0.005, normal=None):
        node = self.n("ShaderNodeBump")
        for k, v in (("Strength", strength), ("Distance", distance), ("Height", height), ("Normal", normal)):
            if v is not None:
                self.put(node.inputs[k], v)
        return node.outputs[0]

    def box(self):
        """Box-projected coordinates: xy of the result = the plane of the dominant object normal."""
        if self._box is not None:
            return self._box
        nx, ny, nz = self.sep(self.vmath("ABSOLUTE", self.tc.outputs["Normal"]))
        px, py, pz = self.sep(self.obj)
        fx = self.math("MULTIPLY", self.math("GREATER_THAN", nx, ny), self.math("GREATER_THAN", nx, nz))
        fy = self.math("MULTIPLY", self.math("GREATER_THAN", ny, nz), self.math("SUBTRACT", 1.0, fx))
        fz = self.math("SUBTRACT", self.math("SUBTRACT", 1.0, fx), fy)
        vx = self.vmath("SCALE", self.comb(py, pz, px), scale=fx)
        vy = self.vmath("SCALE", self.comb(px, pz, py), scale=fy)
        vz = self.vmath("SCALE", self.comb(px, py, pz), scale=fz)
        self._box = self.vmath("ADD", self.vmath("ADD", vx, vy), vz)
        return self._box

    def vary(self, color, fac, lo, hi, hue=None):
        """Colour x value in [lo, hi] driven by a 0..1 socket (optionally a hue wobble socket 0..1)."""
        v = self.map(fac, 0.0, 1.0, lo, hi)
        h = self.map(hue[0], 0.0, 1.0, 0.5 - hue[1], 0.5 + hue[1]) if hue else 0.5
        return self.hsv(color, value=v, hue=h)

    # output
    _BSDF = {
        "sheen": "Sheen Weight", "sheen_rough": "Sheen Roughness", "sheen_tint": "Sheen Tint",
        "coat": "Coat Weight", "coat_rough": "Coat Roughness", "spec": "Specular IOR Level",
        "transmission": "Transmission Weight", "ior": "IOR", "emission": "Emission Color",
        "strength": "Emission Strength", "alpha": "Alpha", "thin": "Thin Wall",
    }

    def surface(self, color, rough=0.5, metal=0.0, normal=None, **extra):
        b = self.bsdf.inputs
        self.put(b["Base Color"], color)
        self.put(b["Roughness"], rough)
        self.put(b["Metallic"], metal)
        if normal is not None:
            self.put(b["Normal"], normal)
        for k, v in extra.items():
            self.put(b[self._BSDF.get(k, k)], v)


# ── recipes ───────────────────────────────────────────────────────────────────

WOOD = {
    #          ring scale, distortion, latewood value, pores, knots, roughness, along-grain stretch
    "oak": dict(ring=20.0, dist=7.0, late=0.72, pores=True, knots=False, rough=0.55, stretch=0.1),
    "pine": dict(ring=14.0, dist=5.0, late=0.64, pores=False, knots=True, rough=0.62, stretch=0.08),
    "walnut": dict(ring=22.0, dist=8.0, late=0.72, pores=True, knots=False, rough=0.46, stretch=0.12),
}
_AXIS = {"x": ("X", (1, 0, 0)), "y": ("Y", (0, 1, 0)), "z": ("Z", (0, 0, 1))}


def _wood(g, col, acc, o, species):
    S = WOOD[species]
    C = _lin(col)
    axis = o.get("grain", "x") if o.get("grain") in _AXIS else "x"
    direction, ax = _AXIS[axis]
    p = g.obj
    plank = None
    seam = None
    planks = o.get("planks")
    if planks:
        bc = g.box()
        if planks == "wall":
            col_r, seam = g.brick(bc, 0.13, 2.45, mortar=0.002, smooth=0.4, offset=0.37, freq=1)
        else:
            col_r, seam = g.brick(bc, 1.22, 0.142, mortar=0.0016, smooth=0.4, offset=0.37, freq=1)
        plank = g.math("ADD", col_r, 0.0)  # colour -> float (per-plank random 0..1)
        p = g.vmath("ADD", p, g.vmath("SCALE", (13.7, 5.3, 7.9), scale=plank))
    # move the ring centre well off the piece so the rings read as long flat-sawn arcs
    off = tuple(0.0 if a else v for a, v in zip(ax, (0.19, -0.27, 0.16)))
    st = tuple(S["stretch"] if a else 1.0 for a in ax)
    q = g.stretch(g.vmath("ADD", p, off), *st)
    rings = g.wave(q, scale=S["ring"], kind="RINGS", direction=direction, dist=S["dist"], detail=3.0,
                   dscale=1.4, drough=0.6)
    band = g.math("POWER", rings, 3.0)
    v = g.map(band, 0.0, 1.0, 1.0, S["late"])
    # broad figure: slow, along-grain variation
    fig = g.noise(g.stretch(p, *(0.25 if a else 1.0 for a in ax)), scale=2.4, detail=3.0, rough=0.55)
    v = g.mul(v, g.map(fig, 0.2, 0.8, 0.9, 1.08))
    height = g.math("MULTIPLY", band, 0.5)
    if S["pores"]:
        pq = g.stretch(p, *(0.02 if a else 1.0 for a in ax))
        pores = g.map(g.noise(pq, scale=420.0, detail=1.0, rough=0.5), 0.63, 0.75, 0.0, 1.0)
        v = g.mul(v, g.map(pores, 0.0, 1.0, 1.0, 0.92))
        height = g.math("SUBTRACT", height, g.math("MULTIPLY", pores, 0.35))
    if S["knots"]:
        kp = g.stretch(p, *(0.35 if a else 1.0 for a in ax))
        kd = g.voronoi(kp, scale=3.2, out="Distance")
        kc = g.voronoi(kp, scale=3.2, out="Color")
        keep = g.math("GREATER_THAN", g.math("ADD", kc, 0.0), 0.78)
        knot = g.mul(g.map(kd, 0.015, 0.05, 1.0, 0.0, smooth=True), keep)
        v = g.mul(v, g.map(knot, 0.0, 1.0, 1.0, 0.55))
    hue = 0.5
    if plank is not None:
        v = g.mul(v, g.map(plank, 0.0, 1.0, 0.86, 1.1))
        hue = g.map(plank, 0.0, 1.0, 0.49, 0.51)
        v = g.mul(v, g.map(seam, 0.0, 1.0, 1.0, 0.45))
        height = g.math("SUBTRACT", height, g.math("MULTIPLY", seam, 2.0))
    color = g.hsv(C, value=v, hue=hue)
    rough = g.map(band, 0.0, 1.0, S["rough"] - 0.05, S["rough"] + 0.08)
    normal = g.bump(height, strength=0.12 if planks else 0.06, distance=0.002)
    g.surface(color, rough=rough, normal=normal, spec=0.45)


def _oak(g, c, a, o):
    _wood(g, c, a, o, "oak")


def _pine(g, c, a, o):
    _wood(g, c, a, o, "pine")


def _walnut(g, c, a, o):
    _wood(g, c, a, o, "walnut")


def _plaster(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    paint = bool(o.get("paint"))
    big = g.noise(p, scale=1.1, detail=3.0, rough=0.55)
    mid = g.noise(p, scale=7.0, detail=4.0, rough=0.6)
    v = g.mul(g.map(big, 0.25, 0.75, 0.975 if paint else 0.95, 1.02 if paint else 1.04),
              g.map(mid, 0.25, 0.75, 0.99 if paint else 0.98, 1.01 if paint else 1.02))
    fine = g.noise(p, scale=260.0 if paint else 150.0, detail=2.0, rough=0.6)
    height = g.math("MULTIPLY", fine, 0.6)
    if not paint:
        trowel = g.noise(g.stretch(p, 1.0, 1.0, 0.6), scale=3.5, detail=6.0, rough=0.7, kind="RIDGED_MULTIFRACTAL")
        height = g.math("ADD", height, g.math("MULTIPLY", trowel, 0.25))
        v = g.mul(v, g.map(trowel, 0.0, 1.0, 1.0, 0.975))
    normal = g.bump(height, strength=0.035 if paint else 0.06, distance=0.001)
    g.surface(g.hsv(C, value=v), rough=g.map(mid, 0.0, 1.0, 0.82, 0.93), normal=normal, spec=0.35)


def _brick(g, col, acc, o):
    C = _lin(col)
    M = _lin(acc or "#c4bcb0")
    bc = g.box()
    bcol, mort = g.brick(bc, 0.225, 0.075, mortar=0.01, smooth=0.2, offset=0.5, freq=2,
                         c1=_mul(C, 0.72), c2=_mul(C, 1.18), cm=M)
    p = g.obj
    burn = g.noise(p, scale=11.0, detail=3.0, rough=0.6)
    speck = g.noise(p, scale=140.0, detail=2.0, rough=0.6)
    v = g.mul(g.map(burn, 0.2, 0.8, 0.9, 1.08), g.map(speck, 0.3, 0.75, 0.86, 1.04))
    color = g.hsv(bcol, value=v, hue=g.map(burn, 0.0, 1.0, 0.49, 0.51))
    height = g.math("SUBTRACT", g.math("MULTIPLY", g.math("SUBTRACT", 1.0, mort), 1.0),
                    g.math("MULTIPLY", speck, 0.12))
    normal = g.bump(height, strength=0.35, distance=0.004)
    g.surface(color, rough=g.map(mort, 0.0, 1.0, 0.82, 0.95), normal=normal, spec=0.3)


def _concrete(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    big = g.noise(p, scale=0.8, detail=4.0, rough=0.6)
    mid = g.noise(p, scale=6.0, detail=5.0, rough=0.65)
    pits = g.map(g.voronoi(p, scale=90.0), 0.0, 0.09, 1.0, 0.0)
    v = g.mul(g.map(big, 0.2, 0.8, 0.92, 1.06), g.map(mid, 0.2, 0.8, 0.96, 1.04), g.map(pits, 0.0, 1.0, 1.0, 0.8))
    height = g.math("SUBTRACT", g.math("MULTIPLY", mid, 0.4), g.math("MULTIPLY", pits, 0.6))
    if o.get("joints"):
        s = float(o["joints"])
        _, joint = g.brick(g.box(), s, s, mortar=0.008, smooth=0.2, offset=0.0)
        v = g.mul(v, g.map(joint, 0.0, 1.0, 1.0, 0.55))
        height = g.math("SUBTRACT", height, g.math("MULTIPLY", joint, 2.0))
    polished = bool(o.get("polished"))
    rough = g.map(mid, 0.0, 1.0, 0.3, 0.45) if polished else g.map(mid, 0.0, 1.0, 0.78, 0.92)
    normal = g.bump(height, strength=0.06 if polished else 0.12, distance=0.002)
    g.surface(g.hsv(C, value=v), rough=rough, normal=normal, spec=0.4)


def _tile(g, col, acc, o):
    C = _lin(col)
    G = _lin(acc or _hsv_hex(col, dv=0.82, ds=0.5))
    size = float(o.get("size", 0.15))
    aspect = float(o.get("aspect", 1.0))
    tcol, grout = g.brick(g.box(), size * aspect, size, mortar=float(o.get("grout_w", 0.004)), smooth=0.35,
                          offset=float(o.get("offset", 0.0)), freq=2, c1=_mul(C, 0.93), c2=_mul(C, 1.05), cm=G)
    glaze = g.noise(g.obj, scale=4.0, detail=3.0, rough=0.55)
    color = g.hsv(tcol, value=g.map(glaze, 0.2, 0.8, 0.97, 1.03))
    height = g.math("SUBTRACT", 1.0, grout)
    normal = g.bump(height, strength=0.3, distance=0.003)
    g.surface(color, rough=g.map(grout, 0.0, 1.0, 0.16, 0.85), normal=normal, spec=0.55)


def _stone(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    big = g.noise(p, scale=2.0, detail=5.0, rough=0.6)
    grain = g.voronoi(p, scale=260.0, out="Color")
    v = g.mul(g.map(big, 0.2, 0.8, 0.88, 1.08), g.map(g.math("ADD", grain, 0.0), 0.0, 1.0, 0.86, 1.1))
    height = g.math("ADD", g.math("MULTIPLY", big, 0.3), g.math("MULTIPLY", grain, 0.15))
    rough = g.map(big, 0.0, 1.0, 0.6, 0.78)
    if o.get("flags") or o.get("pavers"):
        J = _lin(acc or _hsv_hex(col, dv=0.7, ds=0.6))
        if o.get("pavers"):
            fcol, joint = g.brick(g.box(), 0.4, 0.2, mortar=0.006, smooth=0.3, offset=0.5,
                                  c1=_mul(C, 0.88), c2=_mul(C, 1.08), cm=J)
        else:
            fcol, joint = g.brick(g.box(), 0.62, 0.41, mortar=0.01, smooth=0.25, offset=0.43,
                                  c1=_mul(C, 0.86), c2=_mul(C, 1.1), cm=J)
        color = g.hsv(fcol, value=v)
        height = g.math("SUBTRACT", height, g.math("MULTIPLY", joint, 2.0))
        rough = g.map(joint, 0.0, 1.0, 0.68, 0.9)
    else:
        color = g.hsv(C, value=v)
    normal = g.bump(height, strength=0.18, distance=0.003)
    g.surface(color, rough=rough, normal=normal, spec=0.4)


def _marble(g, col, acc, o):
    C = _lin(col)
    V = _lin(acc) if acc else _lin(_hsv_hex(col, dv=0.55, ds=0.5))
    p = g.obj
    warp = g.wave(p, scale=1.1, kind="BANDS", direction="DIAGONAL", dist=14.0, detail=6.0, dscale=1.4, drough=0.62)
    vein = g.map(warp, 0.0, 0.05, 1.0, 0.0, smooth=True)
    warp2 = g.wave(g.vmath("ADD", p, (3.1, 1.7, 0.4)), scale=2.3, kind="BANDS", direction="DIAGONAL", dist=18.0,
                   detail=8.0, dscale=2.0, drough=0.65)
    vein2 = g.map(warp2, 0.0, 0.03, 0.55, 0.0, smooth=True)
    veins = g.math("MAXIMUM", vein, vein2)
    cloud = g.noise(p, scale=1.6, detail=4.0, rough=0.6)
    base = g.hsv(C, value=g.map(cloud, 0.2, 0.8, 0.94, 1.03))
    color = g.mix(g.math("MULTIPLY", veins, 0.85), base, V)
    normal = g.bump(veins, strength=0.02, distance=0.001)
    g.surface(color, rough=g.map(veins, 0.0, 1.0, 0.1, 0.18), normal=normal, spec=0.6)


def _weave(g, p, pitch):
    """3-D thread grid (bands along x, y and z), so it reads on any face without projection."""
    s = 6.2832 / (20.0 * pitch)
    wx = g.wave(p, scale=s, kind="BANDS", direction="X")
    wy = g.wave(p, scale=s, kind="BANDS", direction="Y")
    wz = g.wave(p, scale=s, kind="BANDS", direction="Z")
    return g.math("ADD", g.math("ADD", wx, wy), wz)


def _linen(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    slub_a = g.noise(g.stretch(p, 3.0, 80.0, 80.0), scale=1.0, detail=2.0, rough=0.5)
    slub_b = g.noise(g.stretch(p, 80.0, 3.0, 80.0), scale=1.0, detail=2.0, rough=0.5)
    mottle = g.noise(p, scale=3.0, detail=3.0, rough=0.55)
    v = g.mul(g.map(slub_a, 0.3, 0.7, 0.95, 1.04), g.map(slub_b, 0.3, 0.7, 0.96, 1.03),
              g.map(mottle, 0.2, 0.8, 0.97, 1.03))
    weave = _weave(g, p, 0.0022)
    normal = g.bump(g.math("ADD", weave, g.math("MULTIPLY", slub_a, 0.8)), strength=0.1, distance=0.0012)
    g.surface(g.hsv(C, value=v), rough=0.92, normal=normal, sheen=0.25, sheen_rough=0.5, spec=0.3)


def _wool(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    heather = g.noise(p, scale=220.0, detail=3.0, rough=0.7)
    clump = g.noise(p, scale=16.0, detail=4.0, rough=0.6)
    v = g.mul(g.map(heather, 0.25, 0.75, 0.86, 1.1), g.map(clump, 0.2, 0.8, 0.95, 1.04))
    color = g.hsv(C, value=v, hue=g.map(heather, 0.0, 1.0, 0.495, 0.505))
    fuzz = g.noise(p, scale=520.0, detail=2.0, rough=0.6)
    height = g.math("ADD", fuzz, g.math("MULTIPLY", heather, 0.5))
    if o.get("pile"):
        loops = g.voronoi(p, scale=260.0)
        height = g.math("SUBTRACT", height, g.math("MULTIPLY", loops, 1.5))
    normal = g.bump(height, strength=0.18, distance=0.0015)
    g.surface(color, rough=1.0, normal=normal, sheen=0.4, sheen_rough=0.6, spec=0.25)


def _velvet(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    crushed = g.noise(p, scale=2.6, detail=5.0, rough=0.65, dist=0.6)
    fine = g.noise(p, scale=300.0, detail=2.0, rough=0.5)
    v = g.mul(g.map(crushed, 0.2, 0.8, 0.8, 1.06), g.map(fine, 0.3, 0.7, 0.97, 1.03))
    sheen_tint = _lin(_mix_hex(col, "#ffffff", 0.55))
    normal = g.bump(fine, strength=0.03, distance=0.001)
    g.surface(g.hsv(C, value=v), rough=0.82, normal=normal, sheen=1.0, sheen_rough=0.32, sheen_tint=sheen_tint,
              spec=0.3)


def _leather(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    grain = g.voronoi(p, scale=380.0, feature="DISTANCE_TO_EDGE")
    crease = g.map(grain, 0.0, 0.08, 1.0, 0.0, smooth=True)
    fine = g.noise(p, scale=600.0, detail=2.0, rough=0.5)
    patina = g.noise(p, scale=2.2, detail=4.0, rough=0.6)
    v = g.mul(g.map(patina, 0.2, 0.8, 0.84, 1.08), g.map(crease, 0.0, 1.0, 1.0, 0.82))
    height = g.math("SUBTRACT", g.math("MULTIPLY", fine, 0.2), g.math("MULTIPLY", crease, 0.6))
    normal = g.bump(height, strength=0.25, distance=0.0012)
    rough = g.math("ADD", g.map(crease, 0.0, 1.0, 0.36, 0.56), g.map(patina, 0.0, 1.0, -0.04, 0.06))
    g.surface(g.hsv(C, value=v), rough=rough, normal=normal, coat=0.12, coat_rough=0.3, spec=0.4)


def _metal(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    if o.get("painted"):
        peel = g.noise(p, scale=380.0, detail=2.0, rough=0.5)
        mottle = g.noise(p, scale=4.0, detail=3.0)
        normal = g.bump(peel, strength=0.04, distance=0.001)
        g.surface(g.hsv(C, value=g.map(mottle, 0.2, 0.8, 0.97, 1.03)), rough=0.42, normal=normal, spec=0.5)
        return
    brushed = g.noise(g.stretch(p, 1.0, 260.0, 260.0), scale=1.5, detail=3.0, rough=0.6)
    smudge = g.noise(p, scale=3.0, detail=3.0, rough=0.6)
    v = g.mul(g.map(brushed, 0.3, 0.7, 0.95, 1.04), g.map(smudge, 0.2, 0.8, 0.97, 1.03))
    rough = g.math("ADD", g.map(brushed, 0.0, 1.0, 0.26, 0.4), g.map(smudge, 0.0, 1.0, -0.03, 0.05))
    normal = g.bump(brushed, strength=0.02, distance=0.0005)
    g.surface(g.hsv(C, value=v), rough=rough, metal=1.0, normal=normal)


def _chrome(g, col, acc, o):
    C = _lin(col)
    smudge = g.noise(g.obj, scale=8.0, detail=3.0, rough=0.6)
    g.surface(C, rough=g.map(smudge, 0.2, 0.8, 0.04, 0.1), metal=1.0)


def _brass(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    tarnish = g.noise(p, scale=5.0, detail=4.0, rough=0.6)
    fine = g.noise(g.stretch(p, 1.0, 120.0, 120.0), scale=1.5, detail=2.0)
    v = g.map(tarnish, 0.2, 0.8, 0.82, 1.04)
    rough = g.math("ADD", g.map(tarnish, 0.0, 1.0, 0.18, 0.36), g.map(fine, 0.0, 1.0, -0.03, 0.03))
    g.surface(g.hsv(C, value=v, sat=g.map(tarnish, 0.0, 1.0, 1.05, 0.9)), rough=rough, metal=1.0)


def _glass(g, col, acc, o):
    C = _lin(col)
    g.surface(C, rough=0.02, transmission=1.0, ior=1.45, spec=0.5)
    if o.get("thin"):
        g.put(g.bsdf.inputs["Thin Wall"], True)


def _ceramic(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    glaze = g.noise(p, scale=5.0, detail=3.0, rough=0.55)
    sd = g.voronoi(p, scale=220.0)
    sc = g.voronoi(p, scale=220.0, out="Color")
    speck = g.mul(g.map(sd, 0.0, 0.07, 1.0, 0.0), g.math("GREATER_THAN", g.math("ADD", sc, 0.0), 0.62))
    v = g.mul(g.map(glaze, 0.2, 0.8, 0.96, 1.03), g.map(speck, 0.0, 1.0, 1.0, 0.72))
    if o.get("matte"):
        mott = g.noise(p, scale=12.0, detail=4.0)
        v = g.mul(v, g.map(mott, 0.2, 0.8, 0.92, 1.06))
        normal = g.bump(g.noise(p, scale=300.0), strength=0.08, distance=0.001)
        g.surface(g.hsv(C, value=v), rough=0.78, normal=normal, spec=0.35)
        return
    g.surface(g.hsv(C, value=v), rough=g.map(glaze, 0.0, 1.0, 0.16, 0.26), coat=0.5, coat_rough=0.05, spec=0.5)


def _plastic(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    if o.get("vinyl"):
        chips = g.voronoi(p, scale=120.0, out="Color")
        big = g.noise(p, scale=1.5, detail=3.0)
        v = g.mul(g.map(g.math("ADD", chips, 0.0), 0.0, 1.0, 0.93, 1.06), g.map(big, 0.2, 0.8, 0.97, 1.03))
        normal = g.bump(g.noise(p, scale=300.0), strength=0.03, distance=0.001)
        g.surface(g.hsv(C, value=v), rough=0.45, normal=normal, spec=0.45)
        return
    v = g.noise(p, scale=3.0, detail=2.0)
    smudge = g.noise(p, scale=25.0, detail=2.0)
    if o.get("gloss"):
        g.surface(C, rough=g.map(smudge, 0.0, 1.0, 0.04, 0.09), spec=0.6, coat=0.3, coat_rough=0.03)
        return
    peel = g.noise(p, scale=420.0, detail=1.0)
    normal = g.bump(peel, strength=0.015, distance=0.0005)
    g.surface(g.hsv(C, value=g.map(v, 0.2, 0.8, 0.98, 1.02)), rough=g.map(smudge, 0.0, 1.0, 0.3, 0.42),
              normal=normal, spec=0.5)


def _art(g, col, acc, o):
    """Printed artwork on paper, in Generated coordinates (0..1 across the art plane)."""
    kind = o.get("art", "abstract")
    seed = float(o.get("seed", 0)) * 1.618
    p = g.gen
    A = acc or col
    if kind == "photo":
        # landscape: sky gradient, two hill silhouettes, a sunlit field
        x, y, z = g.sep(p)
        hill1 = g.math("ADD", 0.42, g.math("MULTIPLY", g.noise(g.comb(x, 0.0, 0.0), scale=2.2, w=seed, detail=3.0), 0.28))
        hill2 = g.math("ADD", 0.3, g.math("MULTIPLY", g.noise(g.comb(x, 3.0, 0.0), scale=3.5, w=seed, detail=4.0), 0.2))
        sky = g.ramp(z, [(0.3, _lin(_mix_hex(A, "#f4d9b0", 0.6))), (1.0, _lin(_mix_hex(A, "#7fa7c9", 0.75)))])
        far = _lin(_mix_hex(A, "#6f8597", 0.7))
        near = _lin(_mix_hex(A, "#4d6b3c", 0.7))
        c = g.mix(g.math("LESS_THAN", z, hill1), sky, far)
        c = g.mix(g.math("LESS_THAN", z, hill2), c, near)
        grain = g.noise(p, scale=400.0, detail=1.0)
        color = g.hsv(c, value=g.map(grain, 0.0, 1.0, 0.96, 1.04))
        g.surface(color, rough=0.35, spec=0.5)
        return
    if kind == "map":
        paper = _lin(_mix_hex("#efe6cf", A, 0.08))
        water = _lin(_mix_hex("#9ec3d6", A, 0.15))
        park = _lin(_mix_hex("#b7cf9a", A, 0.1))
        road = _lin("#ffffff")
        ink = _lin(_mix_hex("#5a5148", A, 0.25))
        q = g.vmath("MULTIPLY", p, (1.0, 1.0, 1.0))
        wat = g.math("GREATER_THAN", g.noise(q, scale=1.6, w=seed, detail=3.0), 0.62)
        prk = g.math("GREATER_THAN", g.noise(q, scale=4.5, w=seed + 7.0, detail=2.0), 0.66)
        streets_a = g.map(g.wave(q, scale=1.2, kind="BANDS", direction="X", dist=1.5, detail=1.0, profile="SAW"),
                          0.0, 0.06, 1.0, 0.0)
        streets_b = g.map(g.wave(q, scale=1.3, kind="BANDS", direction="Z", dist=1.5, detail=1.0, profile="SAW"),
                          0.0, 0.06, 1.0, 0.0)
        streets = g.math("MAXIMUM", streets_a, streets_b)
        major = g.map(g.wave(q, scale=0.35, kind="BANDS", direction="DIAGONAL", dist=2.0, detail=1.0),
                      0.0, 0.03, 1.0, 0.0)
        c = g.mix(prk, paper, park)
        c = g.mix(g.math("MULTIPLY", streets, 0.85), c, road)
        c = g.mix(wat, c, water)
        c = g.mix(major, c, ink)
        g.surface(c, rough=0.6, spec=0.4)
        return
    # abstract: soft posterised shapes in a palette built around the accent colour
    n1 = g.noise(p, scale=1.4, detail=1.0, rough=0.4, w=seed, dist=0.4)
    stops = [
        (0.0, _lin(_mix_hex(A, "#f1e9da", 0.75))),
        (0.36, _lin(A)),
        (0.5, _lin(_hsv_hex(A, dv=0.55, dh=0.04))),
        (0.62, _lin(_mix_hex(_hsv_hex(A, dh=0.5, ds=0.45), "#d9d2c3", 0.35))),
        (0.76, _lin(_mix_hex(A, "#f1e9da", 0.75))),
    ]
    c = g.ramp(n1, stops, interp="CONSTANT")
    rings = g.voronoi(p, scale=2.2, w=seed + 3.0, feature="F1")
    dot = g.map(rings, 0.16, 0.175, 1.0, 0.0)
    c = g.mix(g.math("MULTIPLY", dot, 0.9), c, _lin(_hsv_hex(A, dv=0.35)))
    grain = g.noise(p, scale=500.0, detail=1.0)
    g.surface(g.hsv(c, value=g.map(grain, 0.0, 1.0, 0.97, 1.03)), rough=0.7, spec=0.35)


def _paper(g, col, acc, o):
    if o.get("art"):
        _art(g, col, acc, o)
        return
    C = _lin(col)
    p = g.obj
    fibre = g.noise(p, scale=350.0, detail=3.0, rough=0.6)
    blotch = g.noise(p, scale=6.0, detail=3.0)
    v = g.mul(g.map(fibre, 0.25, 0.75, 0.97, 1.03), g.map(blotch, 0.2, 0.8, 0.98, 1.02))
    color = g.hsv(C, value=v)
    if o.get("wallpaper"):
        u = g.sep(g.box())[0]
        stripe = g.wave(g.comb(u, 0.0, 0.0), scale=6.2832 / (20.0 * 0.16), kind="BANDS", direction="X",
                        profile="SIN")
        band = g.map(stripe, 0.55, 0.62, 0.0, 1.0)
        C2 = _lin(_hsv_hex(col, dv=0.9, ds=1.15))
        color = g.mix(g.math("MULTIPLY", band, 0.8), color, g.hsv(C2, value=v))
    normal = g.bump(fibre, strength=0.04, distance=0.001)
    g.surface(color, rough=0.88, normal=normal, sheen=0.1, spec=0.3)


def _plant(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    leafvar = g.noise(p, scale=9.0, detail=3.0, rough=0.6)
    huevar = g.noise(p, scale=4.0, detail=2.0)
    color = g.hsv(C, value=g.map(leafvar, 0.2, 0.8, 0.8, 1.1), hue=g.map(huevar, 0.0, 1.0, 0.485, 0.515))
    normal = g.bump(g.noise(p, scale=120.0), strength=0.05, distance=0.001)
    g.surface(color, rough=g.map(leafvar, 0.0, 1.0, 0.4, 0.55), normal=normal, sheen=0.15, spec=0.45)


def _emissive(g, col, acc, o):
    C = _lin(col)
    g.surface(C, rough=0.5, emission=C, strength=float(o.get("strength", 4.0)))


# ground-only recipes

def _asphalt(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    agg = g.voronoi(p, scale=420.0, out="Color")
    aggd = g.voronoi(p, scale=420.0)
    patch = g.noise(p, scale=0.7, detail=4.0)
    v = g.mul(g.map(g.math("ADD", agg, 0.0), 0.0, 1.0, 0.72, 1.3), g.map(patch, 0.2, 0.8, 0.9, 1.08))
    normal = g.bump(g.math("SUBTRACT", 1.0, aggd), strength=0.25, distance=0.002)
    g.surface(g.hsv(C, value=v), rough=g.map(patch, 0.0, 1.0, 0.82, 0.95), normal=normal, spec=0.35)


def _grass(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    clump = g.noise(p, scale=5.0, detail=4.0, rough=0.6)
    blades = g.noise(g.stretch(p, 1.0, 1.0, 0.3), scale=260.0, detail=2.0)
    hue = g.noise(p, scale=1.5, detail=2.0)
    color = g.hsv(C, value=g.mul(g.map(clump, 0.2, 0.8, 0.74, 1.1), g.map(blades, 0.2, 0.8, 0.85, 1.08)),
                  hue=g.map(hue, 0.0, 1.0, 0.48, 0.52))
    normal = g.bump(blades, strength=0.4, distance=0.003)
    g.surface(color, rough=0.9, normal=normal, sheen=0.3, spec=0.3)


def _sand(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    ripple = g.wave(p, scale=3.0, kind="BANDS", direction="DIAGONAL", dist=4.0, detail=3.0)
    grains = g.noise(p, scale=800.0, detail=1.0)
    big = g.noise(p, scale=0.9, detail=3.0)
    v = g.mul(g.map(big, 0.2, 0.8, 0.94, 1.05), g.map(grains, 0.2, 0.8, 0.93, 1.06))
    normal = g.bump(g.math("ADD", ripple, g.math("MULTIPLY", grains, 0.3)), strength=0.15, distance=0.003)
    g.surface(g.hsv(C, value=v), rough=0.95, normal=normal, spec=0.3)


def _snow(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    drift = g.noise(p, scale=1.4, detail=4.0)
    fine = g.noise(p, scale=300.0, detail=2.0)
    v = g.map(drift, 0.2, 0.8, 0.96, 1.02)
    normal = g.bump(g.math("ADD", drift, g.math("MULTIPLY", fine, 0.15)), strength=0.25, distance=0.01)
    g.surface(g.hsv(C, value=v), rough=0.55, normal=normal, sheen=0.2, spec=0.45)


def _gravel(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    stones = g.voronoi(p, scale=60.0, out="Color")
    d = g.voronoi(p, scale=60.0)
    hue = g.math("ADD", stones, 0.0)
    color = g.hsv(C, value=g.map(hue, 0.0, 1.0, 0.7, 1.22), hue=g.map(hue, 0.0, 1.0, 0.48, 0.52))
    normal = g.bump(g.math("SUBTRACT", 1.0, d), strength=0.6, distance=0.006)
    g.surface(color, rough=0.85, normal=normal, spec=0.35)


def _dirt(g, col, acc, o):
    C = _lin(col)
    p = g.obj
    big = g.noise(p, scale=2.5, detail=5.0, rough=0.6)
    pebbles = g.map(g.voronoi(p, scale=40.0), 0.0, 0.12, 1.0, 0.0)
    v = g.mul(g.map(big, 0.2, 0.8, 0.8, 1.1), g.map(pebbles, 0.0, 1.0, 1.0, 1.15))
    normal = g.bump(g.math("ADD", big, pebbles), strength=0.3, distance=0.004)
    g.surface(g.hsv(C, value=v), rough=0.95, normal=normal, spec=0.3)


RECIPES = {
    "oak": _oak, "pine": _pine, "walnut": _walnut, "plaster": _plaster, "brick": _brick, "concrete": _concrete,
    "tile": _tile, "stone": _stone, "marble": _marble, "linen": _linen, "wool": _wool, "velvet": _velvet,
    "leather": _leather, "metal": _metal, "chrome": _chrome, "brass": _brass, "glass": _glass,
    "ceramic": _ceramic, "plastic": _plastic, "paper": _paper, "plant": _plant, "emissive": _emissive,
    "asphalt": _asphalt, "grass": _grass, "sand": _sand, "snow": _snow, "gravel": _gravel, "dirt": _dirt,
}
METALLIC = {"metal", "chrome", "brass"}


# ── public API ────────────────────────────────────────────────────────────────

def _freeze(v):
    if isinstance(v, dict):
        return tuple(sorted((k, _freeze(x)) for k, x in v.items()))
    if isinstance(v, (list, tuple)):
        return tuple(_freeze(x) for x in v)
    return v


def _alive(mat):
    try:
        return bpy.data.materials.get(mat.name) == mat
    except ReferenceError:
        return False


def _label(prefix, color, accent, opts):
    parts = [prefix, color.lstrip("#")]
    if accent:
        parts.append("a" + accent.lstrip("#"))
    for k in sorted(opts):
        v = opts[k]
        if v is True:
            parts.append(k)
        elif v not in (False, None):
            parts.append(re.sub(r"[^a-z0-9]", "", f"{k}{v}".lower().replace(".", "p")))
    name = "_".join(parts)[:56]
    base, i = name, 2
    while name in bpy.data.materials:
        name = f"{base}_{i}"
        i += 1
    return name


def get(name: str, color: str | None = None, accent: str | None = None, **opts) -> bpy.types.Material:
    """The cached procedural material `name` tinted by `color` (and `accent`)."""
    name = (name or "plaster").lower()
    if name not in RECIPES:
        print(f"[materials] unknown material {name!r}, using plaster")
        name = "plaster"
    color = _norm_hex(color) or DEFAULT_COLOR.get(name, "#cccccc")
    accent = _norm_hex(accent)
    key = (name, color, accent, _freeze(opts))
    mat = _cache.get(key)
    if mat is not None and _alive(mat):
        return mat

    prefix = "glass" if name == "glass" else "emit" if name == "emissive" else name
    mat = bpy.data.materials.new(_label(prefix, color, accent, opts))
    g = _G(mat)
    RECIPES[name](g, color, accent, opts)
    rgb = hex_rgb(color)
    mat.diffuse_color = (*rgb, 1.0)
    mat.roughness = 0.5
    mat.metallic = 1.0 if name in METALLIC else 0.0
    mat["mr_material"] = name
    mat["mr_color"] = color
    mat["mr_albedo"] = list(rgb)
    _cache[key] = mat
    return mat


def _finish(table, finish, color, kind):
    if finish not in table:
        print(f"[materials] unknown {kind} finish {finish!r}, using {next(iter(table))}")
        finish = next(iter(table))
    name, opts, default = table[finish]
    return get(name, color or default, **opts)


def floor(finish: str = "timber", color: str | None = None) -> bpy.types.Material:
    """Shell floor: timber | carpet | tile | concrete | vinyl | stone."""
    return _finish(FLOOR, finish or "timber", color, "floor")


def wall(finish: str = "paint", color: str | None = None) -> bpy.types.Material:
    """Shell walls: paint | plaster | brick | timber | tile | concrete | wallpaper."""
    return _finish(WALL, finish or "paint", color, "wall")


def ground(finish: str = "paving", color: str | None = None) -> bpy.types.Material:
    """Exterior ground plate: asphalt | grass | sand | snow | paving | concrete | gravel | dirt."""
    return _finish(GROUND, finish or "paving", color, "ground")


def clear_cache():
    _cache.clear()
