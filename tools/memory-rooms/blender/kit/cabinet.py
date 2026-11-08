"""cabinet: nightstand / dresser / sideboard / cupboard. Carcass, overhanging top, drawers and/or
doors on the FRONT (-y), handles (accent), on a recessed plinth or short legs.

params (defaults depend on the size):
  drawers  int    number of drawer rows (low pieces: 2-3, tall pieces: 1)
  doors    int    door columns under the drawers (low: 0, tall: 2 if w >= 0.6 else 1)
  columns  int    drawer columns (default 2 when w > 1.1)
  base     "plinth" | "legs" | "none"   (default legs below 0.8 m tall, else plinth)
  handles  "bar" | "knob" | "none"      (default bar; doors on tall pieces get vertical bars)
  style    "flat" | "shaker"            door style (default shaker)
Materials: main = body + fronts (default oak), accent = handles + legs if metal (default brass).
"""

import bmesh

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    main = U.mat_main(ctx, spec, "oak")
    acc = U.mat_accent(ctx, spec, "brass")
    tall = h >= 0.8
    drawers = int(p.get("drawers", 1 if tall else (3 if h > 0.66 else 2)))
    doors = int(p.get("doors", (2 if w >= 0.6 else 1) if tall else 0))
    if drawers + doors == 0:
        doors = 1
    columns = int(p.get("columns", 2 if w > 1.1 else 1))
    base = p.get("base", "plinth" if tall else "legs")
    handles = p.get("handles", "bar")
    style = p.get("style", "shaker")

    hp = 0.0 if handles == "none" else (0.026 if handles == "bar" else 0.024)
    ft = 0.018
    top_t = U.clamp(0.022 * (1.2 if w > 1 else 1.0), 0.018, 0.03)
    y_face = -d / 2 + hp
    y_car = y_face + ft + 0.001
    base_h = {"legs": U.clamp(0.2 * h, 0.08, 0.16), "plinth": U.clamp(0.08 * h, 0.05, 0.09)}.get(base, 0.0)

    body = bmesh.new()
    # carcass, inset a little under the top
    U.add_box(body, (-w / 2 + 0.006, y_car, base_h), (w / 2 - 0.006, d / 2 - 0.004, h - top_t), 0.003)
    # top: covers the fronts, small rounded edge
    U.add_box(body, (-w / 2, y_face - 0.004, h - top_t), (w / 2, d / 2, h), 0.004, 3)
    if base == "plinth":
        U.add_box(body, (-w / 2 + 0.03, y_car + 0.035, 0.0), (w / 2 - 0.03, d / 2 - 0.025, base_h + 0.002), 0.002)
    parts = []

    fr = bmesh.new()
    hd = bmesh.new()
    x0, x1 = -w / 2 + 0.006, w / 2 - 0.006
    z0, z1 = base_h + 0.006, h - top_t - 0.003
    gap = 0.004
    region = z1 - z0
    if doors and drawers:
        dh = min(0.17, region * 0.28)
    else:
        dh = region / max(drawers, 1)
    zc = z1
    for i in range(drawers):
        za, zb = zc - dh, zc
        cols = columns
        for c in range(cols):
            xa = x0 + (x1 - x0) * c / cols
            xb = x0 + (x1 - x0) * (c + 1) / cols
            U.add_front(fr, xa + gap / 2, xb - gap / 2, za + gap / 2, zb - gap / 2, y_face, y_car - 0.001, "flat")
            hl = U.clamp((xb - xa) * 0.35, 0.07, 0.16)
            U.add_handle(hd, handles, ((xa + xb) / 2, y_face, (za + zb) / 2 + (0.0 if dh < 0.2 else dh * 0.2)),
                         length=hl)
        zc = za
    if doors:
        za, zb = z0, zc
        for c in range(doors):
            xa = x0 + (x1 - x0) * c / doors
            xb = x0 + (x1 - x0) * (c + 1) / doors
            U.add_front(fr, xa + gap / 2, xb - gap / 2, za + gap / 2, zb - gap / 2, y_face, y_car - 0.001, style)
            # handle near the opening edge
            if doors == 1:
                hx = xb - 0.05
            else:
                hx = xb - 0.04 if c % 2 == 0 else xa + 0.04
            vert = (zb - za) > 0.3
            hz = zb - min(0.12, (zb - za) * 0.3) if vert else (za + zb) / 2
            U.add_handle(hd, "knob" if handles == "knob" else handles, (hx, y_face, hz),
                         length=U.clamp((zb - za) * 0.3, 0.08, 0.2), vertical=vert)

    parts.append(U.obj_from_bm(ctx, "body", body, [main]))
    parts.append(U.obj_from_bm(ctx, "fronts", fr, [main]))
    if handles != "none":
        parts.append(U.obj_from_bm(ctx, "handles", hd, [acc]))
    else:
        hd.free()
    if base == "legs":
        lg = bmesh.new()
        ins = 0.045
        for sx in (-1, 1):
            for sy in (-1, 1):
                U.add_leg(lg, (sx * (w / 2 - ins), sy * (d / 2 - ins) + (hp / 2 if sy < 0 else 0.0)), 0.0,
                          base_h + 0.004, top=0.04, bottom=0.026, shape="round",
                          lean=(sx * 0.018, sy * 0.012))
        lm = acc if acc.get("mr_material") in U.METALS and spec.get("accentMaterial") else U.with_grain(ctx, main)
        parts.append(U.obj_from_bm(ctx, "legs", lg, [lm]))
    return parts
