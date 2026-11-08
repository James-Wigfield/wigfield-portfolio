"""armchair: one-seat upholstered chair (the sofa builder with armchair proportions: wider rolled arms,
one seat cushion, one back cushion). The seat faces the FRONT (-y).

params: same as sofa (seats defaults to 1, armStyle to "rolled").
Materials: main = upholstery (default linen); accent = legs (default walnut).
Typical: 0.8 x 0.85 x 0.82.
"""

from kit import sofa


def build(ctx, spec):
    spec = dict(spec)
    params = dict(spec.get("params") or {})
    params.setdefault("seats", 1)
    spec["params"] = params
    return sofa.build_seating(ctx, spec, armchair=True)
