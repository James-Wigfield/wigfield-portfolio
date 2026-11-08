"""cylinder: an upright (elliptical if w != d) cylinder filling `size`, with bevelled rims.

Columns, drums, round side tables, bins, planters, pouffes.
params:
  sides  (int, default 48)      facets around
  taper  (0..1, default 1)      top radius as a fraction of the bottom radius (cones / tapered drums)
  bevel  (metres, default 1 cm) rim bevel
"""

from kit import _util as U


def build(ctx, spec):
    w, h, d = U.dims(spec)
    p = U.P(spec)
    sides = int(U.clamp(int(p.get("sides", 48)), 6, 128))
    taper = U.clamp(float(p.get("taper", 1.0)), 0.05, 1.0)
    bevel = min(float(p.get("bevel", 0.01)), 0.15 * min(w, h, d))
    mat = U.mat_main(ctx, spec, "plaster")
    rx = w / 2
    import bmesh

    bm = bmesh.new()
    U.add_cylinder(bm, (0.0, 0.0), rx, 0.0, h, segments=sides, bevel=bevel, bevel_segments=3, r_top=rx * taper,
                   ry=d / 2)
    return [U.obj_from_bm(ctx, "body", bm, [mat])]
