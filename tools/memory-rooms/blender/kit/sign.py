"""sign: a lettered sign (shop sign, door plaque, neon). A rounded backing board with a raised rim and
3-D letters on the FRONT (-y); the back (+y) mounts to a wall or roof. Text uses Blender's built-in
font, converted to a mesh and fitted inside the board. Works for interiors and exteriors.

params:
  text   str     (default: the spec's label, else "OPEN"); "\\n" for two lines
  lit    bool    neon-ish: letters become glowing tubes in an `emit…` material (accent colour)
  style  "board" | "letters"   letters = no board, channel letters on a thin rail (default board)
Materials: main = board (default plastic; painted metal / wood work too);
           accent = letter colour (default cream); lit letters use emissive with the accent colour.
Typical: door plaque 0.4 x 0.15 x 0.02, shop fascia 3 x 0.6 x 0.12, roof sign 4.5 x 1.4 x 0.25.
"""

import bmesh
from mathutils import Matrix

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    text = str(p.get("text") or spec.get("label") or "OPEN").replace("\\n", "\n")
    lit = bool(p.get("lit", False))
    style = p.get("style", "board")
    board_mat = U.mat_main(ctx, spec, "plastic", "#23313b")
    accent = spec.get("accent") or "#fff3d6"
    parts = []

    bt = U.clamp(0.55 * d, 0.01, 0.2) if style == "board" else U.clamp(0.25 * d, 0.01, 0.05)
    letter_d = d - bt
    m = U.clamp(0.08 * min(w, h), 0.01, 0.15)  # margin
    if style == "board":
        bb = bmesh.new()
        U.add_box(bb, (-w / 2, d / 2 - bt, 0.0), (w / 2, d / 2, h), min(0.25 * min(w, h), 0.012 + 0.02 * min(w, h)), 4)
        parts.append(U.obj_from_bm(ctx, "board", bb, [board_mat]))
        # raised rim (picture-frame style) in the letter colour
        rim = bmesh.new()
        rw = U.clamp(0.025 * min(w, h), 0.004, 0.04)
        hw, hh = w / 2 - m * 0.45, h / 2 - m * 0.45
        path = [(-hw, d / 2 - bt, h / 2 - hh), (hw, d / 2 - bt, h / 2 - hh), (hw, d / 2 - bt, h / 2 + hh),
                (-hw, d / 2 - bt, h / 2 + hh)]
        prof = U.rounded_rect_profile(rw, min(letter_d * 0.5, 0.03) * 2, rw * 0.45, 2)
        U.add_sweep(rim, U.fillet(path, rw * 2, steps=3, closed=True), prof, closed=True, up=(0, -1, 0))
        rim_mat = ctx.materials.get("emissive", accent, strength=3.0) if lit else ctx.materials.get("plastic", accent)
        parts.append(U.obj_from_bm(ctx, "rim", rim, [rim_mat]))
        inner_w, inner_h = w - 2 * m * 1.4, h - 2 * m * 1.4
    else:
        rail = bmesh.new()
        U.add_box(rail, (-w / 2 + 0.02, d / 2 - bt, h * 0.42), (w / 2 - 0.02, d / 2, h * 0.58), 0.004)
        parts.append(U.obj_from_bm(ctx, "rail", rail, [board_mat]))
        inner_w, inner_h = w * 0.98, h * 0.98

    # letters: build at size 1, fit into inner_w x inner_h, extrude toward -y
    depth = U.clamp(letter_d * 0.8, 0.004, 0.08)
    if lit:
        ob = U.text_object(ctx, "letters", text, size=1.0, extrude=0.0, bevel=0.035, fill=False, resolution=6)
    else:
        ob = U.text_object(ctx, "letters", text, size=1.0, extrude=0.5, bevel=0.012, fill=True, resolution=4)
    me = ob.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    if not xs:
        return parts
    tw, th = max(xs) - min(xs), max(ys) - min(ys)
    tz = max(zs) - min(zs)
    s = min(inner_w / tw, inner_h / th)
    sz = depth / max(tz, 1e-4)
    cx, cy, cz = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)
    # text lies in XY facing +z: centre it (back face at z=0), scale, rotate +90 about x (z -> -y, y -> z)
    # so the letters stand proud of the board toward the front
    me.transform(Matrix.Translation((0.0, d / 2 - bt - 0.001, h / 2)) @ Matrix.Rotation(1.5707963, 4, "X")
                 @ Matrix.Diagonal((s, s, sz, 1.0)) @ Matrix.Translation((-cx, -cy, -cz)))
    me.update()
    U.set_smooth(ob, False) if not lit else U.set_smooth(ob, True)
    letter_mat = ctx.materials.get("emissive", accent, strength=5.0) if lit else ctx.materials.get("plastic", accent)
    me.materials.clear()
    me.materials.append(letter_mat)
    parts.append(ob)
    return parts
