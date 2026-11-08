"""box: a plain bevelled block, sized exactly by `size`. The fallback piece.

params: bevel (metres, default 1.2 cm, clamped to 10 % of the smallest side).
"""

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    bevel = float(U.P(spec).get("bevel", 0.012))
    bevel = min(bevel, 0.1 * min(w, h, d))
    mat = U.mat_main(ctx, spec, "plaster")
    return [U.box(ctx, "body", (-w / 2, -d / 2, 0.0), (w / 2, d / 2, h), mat, bevel=bevel, segments=3)]
