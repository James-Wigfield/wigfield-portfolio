"""Freeform camera fit: where old photos were taken, the room's size, and any marked points, from pixel marks.

    python tools/memory-rooms/freeform/fit.py <fit-input.json> [--out fit-output.json] [--starts 24] [--quiet]

numpy only (no scipy): Levenberg-Marquardt on a numerical Jacobian with Huber weights, in stages: (1) every camera
that sees enough STRUCTURE (≥ 6 marks / line pixels on the room's corners and lines, fixed and parametric points;
free points are still guesses) and has no viewpoint is found by a grid search (positions × yaws), (2) those cameras +
room + params together on the structure, (3) every free point triangulated from their rays, (4) the cameras that see
little structure (a close-up of a lamp) found by the same grid search against everything they see, (5) everything
together. Cameras are softly kept within 1 m of the room's structure (a weak camera can't run off to infinity). The memory-render skill's "Freeform spots" section says when to use it; CONTRACTS.md 1 and 8
define the frame (metres, x east, y up, z south) and the camera (`fov` across the photo's LONG edge, yaw in rotY's
convention: 0 = looking south (+z), 90 = east; pitch up +; roll + = clockwise as seen by the photographer).

INPUT (write it in the work folder; every part but cameras + marks is optional):
{
  "room":    { "box": { "W": 4, "D": 3, "H": 2.6, "free": ["W", "D", "H"] } }          a box room: named corners
             | { "outline": { "pts": [[x, z], ...], "H": 2.6, "scale": 1, "free": ["scale", "H"] } }
               box corners: NW0 NE0 SE0 SW0 (floor) and NW1 NE1 SE1 SW1 (ceiling), NW = [0, 0];
               outline corners: c<i>_0 (floor) and c<i>_1 (ceiling), each [s*x, 0 | H, s*z]
  "params":  { "bE": { "value": 0.45, "free": true }, "kH": { "value": 0.88 } }            named sizes: free or fixed
  "points":  { "lamp": { "xyz": [x, y, z], "free": true }, "doorTop": { "xyz": [...] },     free (a guess), fixed, or
               "bulk": { "expr": ["W - bE", "H - hE", 0] } }                                 built from the room's
               W / D / H (or scale / H) and the params (a parametric room: a bulkhead, a benchtop, a mullion)
  "anchors": [ { "a": "doorL0", "b": "doorL1", "length": 2.04, "sigma": 0.03 } ]         known lengths: the scale
  "cameras": { "7": { "w": 1536, "h": 2048, "fov": 70, "fovSigma": 3, "lens": "main",
                      "prior": { "x": 1.2, "z": 3.0, "yaw": 40, "conf": "rough" }, "eye": 1.5 } }
             fov: a guess (EXIF focal35 → 2·atan(18 / f35)); fovSigma: how sure (null = free; leave it free when the
             photo looks cropped); cameras with the same "lens" share one fov. prior: James's viewpoint
             (capture.views): conf "exact" = tight (0.15 m, 8°), the camera starts there; "rough" = loose
             (1.5 m, 60°), one more start beside the grid search.
  "viewpointScale": "free"                                                                 James's viewpoints are on his
             SKETCH: its metres are only real when he typed the size (layout.sizeKnown). "free" (the default) = they
             say where the photos are relative to each other, not how big the room is: with an outline room they
             share its scale, else they get their own; "fixed" = take their metres as real (sizeKnown)
  "marks":   [ { "photo": 7, "point": "NE1", "px": [812, 344] } ]                          a pixel ON a named point
  "lines":   [ { "photo": 7, "a": "NW0", "b": "NE0", "px": [400, 1650] } ]                 a pixel on the 3D line a–b
             (wall–floor and wall–ceiling lines, door heads, window sills: far better constrained than points alone)
}
Pixels are in the photo as pulled (photos/<n>.jpg), origin top-left.

OUTPUT (fit-output.json): rms_px, the room (W/D/H or scale/H), every point's xyz, and per camera pos / look (a point
1 m ahead) / yaw / pitch / roll / fov / aspect / rms_px / marks / fit ("good" = ≤ 6 px rms over ≥ 6 marks, else
"rough"), ready to paste into scene.json cameras (+ fit), and every residual. Exit 1 if it couldn't fit.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

DEG = math.pi / 180
CONF = {"exact": (0.15, 8.0), "rough": (1.5, 60.0)}  # (metres, degrees): a viewpoint's sigma (rough: mostly a starting place)
EYE = (1.5, 0.35)  # a standing photographer's camera height and its sigma
HUBER_PX = 6.0
STRUCTURE_MIN = 6  # residual rows on the structure a camera needs to be placed before the free points are known
ROOM_MARGIN = 1.0  # m: a camera may stand this far outside the structure's box before a prior pulls it back
ROLL_SIGMA = 4.0
PIXEL_SIGMA = 2.0  # what one marked pixel is worth against a prior (a prior residual is (value - prior) / sigma * PIXEL_SIGMA)


def corners_box(W, D, H):
    return {
        "NW0": (0, 0, 0), "NE0": (W, 0, 0), "SE0": (W, 0, D), "SW0": (0, 0, D),
        "NW1": (0, H, 0), "NE1": (W, H, 0), "SE1": (W, H, D), "SW1": (0, H, D),
    }


class Model:
    def __init__(self, spec):
        self.spec = spec
        self.room = spec.get("room") or {}
        self.points_in = spec.get("points") or {}
        self.cams_in = {str(k): v for k, v in (spec.get("cameras") or {}).items()}
        self.marks = spec.get("marks") or []
        self.lines = spec.get("lines") or []
        self.anchors = spec.get("anchors") or []
        # the parameter vector: room params, free points, lens fovs, cameras
        self.names = []
        self.x0 = []
        box = self.room.get("box")
        outl = self.room.get("outline")
        self.room_kind = "box" if box else "outline" if outl else None
        self.room_free = []
        if box:
            for k in ("W", "D", "H"):
                if k in (box.get("free") or ["W", "D", "H"]):
                    self.room_free.append(k)
                    self._add(f"room.{k}", box.get(k, {"W": 4, "D": 3.5, "H": 2.6}[k]))
        elif outl:
            for k in ("scale", "H"):
                if k in (outl.get("free") or ["scale", "H"]):
                    self.room_free.append(k)
                    self._add(f"room.{k}", outl.get(k, {"scale": 1.0, "H": 2.6}[k]))
        # named parameters (a bulkhead's depth, a benchtop's height): free ones are unknowns
        self.params_in = spec.get("params") or {}
        for n, p in self.params_in.items():
            if p.get("free"):
                self._add(f"par.{n}", float(p["value"]))
        self.exprs = {n: [compile(str(e), f"<{n}>", "eval") for e in p["expr"]] for n, p in self.points_in.items() if "expr" in p}
        # viewpoints drawn on a rough sketch: their own scale unless they share the outline's (or are fixed)
        self.vp_scale = "fixed" if spec.get("viewpointScale") == "fixed" else ("outline" if self.room.get("outline") else "own")
        if self.vp_scale == "own" and any(c.get("prior") for c in self.cams_in.values()):
            self._add("vp.scale", 1.0)
        self.free_pts = [n for n, p in self.points_in.items() if p.get("free")]
        for n in self.free_pts:
            for i, a in enumerate("xyz"):
                self._add(f"pt.{n}.{a}", float(self.points_in[n]["xyz"][i]))
        # lenses: cameras sharing a "lens" share one fov
        self.lens_of = {}
        self.lenses = {}
        for k, c in self.cams_in.items():
            lens = c.get("lens") or f"cam{k}"
            self.lens_of[k] = lens
            if lens not in self.lenses:
                self.lenses[lens] = {"fov": c.get("fov", 70.0), "sigma": c.get("fovSigma", None), "cams": []}
            self.lenses[lens]["cams"].append(k)
        for lens, L in self.lenses.items():
            self._add(f"lens.{lens}", float(L["fov"]))
        for k, c in self.cams_in.items():
            p = c.get("prior") or {}
            init = c.get("init") or {}
            x = init.get("x", p.get("x", 0.0))
            z = init.get("z", p.get("z", 0.0))
            y = init.get("y", c.get("eye", EYE[0]))
            for a, v in (("x", x), ("y", y), ("z", z), ("yaw", init.get("yaw", p.get("yaw", 0.0))), ("pitch", init.get("pitch", 0.0)), ("roll", 0.0)):
                self._add(f"cam.{k}.{a}", float(v))
        self.x0 = np.array(self.x0, dtype=float)
        self.index = {n: i for i, n in enumerate(self.names)}

    def _add(self, name, v):
        self.names.append(name)
        self.x0.append(float(v))

    def val(self, x, name, default=None):
        i = self.index.get(name)
        return x[i] if i is not None else default

    # ── geometry ──
    def room_points(self, x):
        out = {}
        box = self.room.get("box")
        outl = self.room.get("outline")
        if box:
            W = self.val(x, "room.W", box.get("W"))
            D = self.val(x, "room.D", box.get("D"))
            H = self.val(x, "room.H", box.get("H"))
            out.update({k: np.array(v, dtype=float) for k, v in corners_box(W, D, H).items()})
        elif outl:
            s = self.val(x, "room.scale", outl.get("scale", 1.0))
            H = self.val(x, "room.H", outl.get("H", 2.6))
            for i, (px, pz) in enumerate(outl["pts"]):
                out[f"c{i}_0"] = np.array([s * px, 0.0, s * pz])
                out[f"c{i}_1"] = np.array([s * px, H, s * pz])
        return out

    def scope(self, x):
        """The names a point's expression may use: the room's W / D / H (or scale / H), every param, math."""
        ns = {"math": math}
        box = self.room.get("box")
        outl = self.room.get("outline")
        if box:
            for k in ("W", "D", "H"):
                ns[k] = self.val(x, f"room.{k}", box.get(k))
        elif outl:
            ns["scale"] = self.val(x, "room.scale", outl.get("scale", 1.0))
            ns["H"] = self.val(x, "room.H", outl.get("H", 2.6))
        for n, p in self.params_in.items():
            ns[n] = self.val(x, f"par.{n}", p["value"])
        return ns

    def all_points(self, x):
        pts = self.room_points(x)
        ns = self.scope(x) if self.exprs else None
        for n, p in self.points_in.items():
            if n in self.exprs:
                pts[n] = np.array([eval(c, {"__builtins__": {}}, ns) for c in self.exprs[n]], dtype=float)
            elif p.get("free"):
                pts[n] = np.array([self.val(x, f"pt.{n}.x"), self.val(x, f"pt.{n}.y"), self.val(x, f"pt.{n}.z")])
            else:
                pts[n] = np.array(p["xyz"], dtype=float)
        return pts

    def prior_scale(self, x):
        """How the viewpoints' sketch metres map to the room's: 1 (fixed), the outline's scale, or their own."""
        if self.vp_scale == "fixed":
            return 1.0
        if self.vp_scale == "outline":
            return self.val(x, "room.scale", self.room["outline"].get("scale", 1.0))
        return self.val(x, "vp.scale", 1.0)

    def structure_box(self, pts):
        """[x0, z0, x1, z1] of the non-free points, grown by ROOM_MARGIN (None with fewer than 3)."""
        P = [p for n, p in pts.items() if n not in self.free_pts]
        if len(P) < 3:
            return None
        P = np.array(P)
        return (P[:, 0].min() - ROOM_MARGIN, P[:, 2].min() - ROOM_MARGIN, P[:, 0].max() + ROOM_MARGIN, P[:, 2].max() + ROOM_MARGIN)

    def structure_rows(self, k):
        """How many residual rows camera k has on the structure (marks count twice, line pixels once)."""
        free = set(self.free_pts)
        n = sum(2 for m in self.marks if str(m["photo"]) == k and m["point"] not in free)
        return n + sum(1 for l in self.lines if str(l["photo"]) == k and l["a"] not in free and l["b"] not in free)

    def camera(self, x, k):
        c = self.cams_in[k]
        pos = np.array([self.val(x, f"cam.{k}.x"), self.val(x, f"cam.{k}.y"), self.val(x, f"cam.{k}.z")])
        yaw, pitch, roll = self.val(x, f"cam.{k}.yaw"), self.val(x, f"cam.{k}.pitch"), self.val(x, f"cam.{k}.roll")
        fov = self.val(x, f"lens.{self.lens_of[k]}")
        return cam_basis(pos, yaw, pitch, roll, fov, c["w"], c["h"])

    # ── residuals ──
    def residuals(self, x, cams=None, structure=False):
        """Every residual (px, or px-equivalent for priors). structure: only marks / lines on points that aren't free."""
        pts = self.all_points(x)
        res = []
        meta = []
        cache = {}
        free = set(self.free_pts) if structure else ()
        for m in self.marks:
            k = str(m["photo"])
            if cams is not None and k not in cams:
                continue
            if m["point"] in free:
                continue
            P = pts.get(m["point"])
            if P is None:
                continue
            C = cache.setdefault(k, self.camera(x, k))
            q = project(C, P)
            if q is None:
                res += [50.0, 50.0]
            else:
                res += [q[0] - m["px"][0], q[1] - m["px"][1]]
            meta += [("mark", k, m["point"]), ("mark", k, m["point"])]
        for l in self.lines:
            k = str(l["photo"])
            if cams is not None and k not in cams:
                continue
            if l["a"] in free or l["b"] in free:
                continue
            A, B = pts.get(l["a"]), pts.get(l["b"])
            if A is None or B is None:
                continue
            C = cache.setdefault(k, self.camera(x, k))
            res.append(line_dist(C, A, B, l["px"]))
            meta.append(("line", k, f"{l['a']}-{l['b']}"))
        box = self.structure_box(pts)
        if cams is None:
            for a in self.anchors:
                A, B = pts.get(a["a"]), pts.get(a["b"])
                if A is None or B is None:
                    continue
                res.append((np.linalg.norm(B - A) - a["length"]) / a.get("sigma", 0.03) * PIXEL_SIGMA)
                meta.append(("anchor", None, f"{a['a']}-{a['b']}"))
            for lens, L in self.lenses.items():
                if L["sigma"]:
                    res.append((self.val(x, f"lens.{lens}") - L["fov"]) / L["sigma"] * PIXEL_SIGMA)
                    meta.append(("fov", lens, lens))
        for k, c in self.cams_in.items():
            if cams is not None and k not in cams:
                continue
            p = c.get("prior")
            if p:
                sm, sd = CONF.get(p.get("conf", "rough"), CONF["rough"])
                ps = self.prior_scale(x)
                res.append((self.val(x, f"cam.{k}.x") - ps * p["x"]) / sm * PIXEL_SIGMA)
                res.append((self.val(x, f"cam.{k}.z") - ps * p["z"]) / sm * PIXEL_SIGMA)
                res.append(wrap180(self.val(x, f"cam.{k}.yaw") - p["yaw"]) / sd * PIXEL_SIGMA)
                meta += [("prior", k, "x"), ("prior", k, "z"), ("prior", k, "yaw")]
            res.append((self.val(x, f"cam.{k}.y") - c.get("eye", EYE[0])) / EYE[1] * PIXEL_SIGMA)
            res.append(self.val(x, f"cam.{k}.roll") / ROLL_SIGMA * PIXEL_SIGMA)
            meta += [("eye", k, "y"), ("roll", k, "roll")]
            if box is not None:
                cx, cz = self.val(x, f"cam.{k}.x"), self.val(x, f"cam.{k}.z")
                out = math.hypot(max(0.0, box[0] - cx, cx - box[2]), max(0.0, box[1] - cz, cz - box[3]))
                res.append(out / 0.25 * PIXEL_SIGMA)
                meta.append(("inside", k, "xz"))
        return np.array(res, dtype=float), meta


def wrap180(a):
    return (a + 180.0) % 360.0 - 180.0


def cam_basis(pos, yaw, pitch, roll, fov_long, w, h):
    """Forward from yaw (rotY's convention) + pitch; right = forward × up; roll + = clockwise for the photographer."""
    f = np.array([math.sin(yaw * DEG) * math.cos(pitch * DEG), math.sin(pitch * DEG), math.cos(yaw * DEG) * math.cos(pitch * DEG)])
    up = np.array([0.0, 1.0, 0.0])
    r = np.cross(f, up)
    nr = np.linalg.norm(r)
    r = r / nr if nr > 1e-9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(r, f)
    # roll clockwise (as the photographer sees it) turns the image's up toward its right
    cr, sr = math.cos(roll * DEG), math.sin(roll * DEG)
    r, u = r * cr - u * sr, u * cr + r * sr
    t = math.tan(fov_long * DEG / 2)
    if w >= h:
        tx, ty = t, t * h / w
    else:
        ty, tx = t, t * w / h
    return {"pos": pos, "f": f, "r": r, "u": u, "tx": tx, "ty": ty, "w": w, "h": h}


def project(C, P):
    d = P - C["pos"]
    z = d @ C["f"]
    if z <= 0.05:
        return None
    x = (d @ C["r"]) / (z * C["tx"])
    y = (d @ C["u"]) / (z * C["ty"])
    return ((x + 1) / 2 * C["w"], (1 - y) / 2 * C["h"])


def line_dist(C, A, B, px):
    """Pixel distance from px to the projected 3D line A–B (clipped to the camera's front)."""
    a, b = A.copy(), B.copy()
    za, zb = (a - C["pos"]) @ C["f"], (b - C["pos"]) @ C["f"]
    if za <= 0.05 and zb <= 0.05:
        return 50.0
    if za <= 0.05 or zb <= 0.05:  # clip the segment to just in front of the camera
        t = (0.05 - za) / (zb - za)
        p = a + (b - a) * t
        if za <= 0.05:
            a = p
        else:
            b = p
    qa, qb = project(C, a), project(C, b)
    if qa is None or qb is None:
        return 50.0
    qa, qb, q = np.array(qa), np.array(qb), np.array(px, dtype=float)
    d = qb - qa
    L = np.linalg.norm(d)
    if L < 1e-6:
        return float(np.linalg.norm(q - qa))
    n = np.array([-d[1], d[0]]) / L
    return float((q - qa) @ n)


def huber_weights(r, k=HUBER_PX):
    a = np.abs(r)
    w = np.ones_like(r)
    big = a > k
    w[big] = np.sqrt(k / a[big])
    return w


def lm(model, x0, idx=None, cams=None, iters=60, lam=1e-2, structure=False):
    """Levenberg-Marquardt over the parameters `idx` (all when None), residuals of `cams` (all when None)."""
    x = x0.copy()
    idx = np.arange(len(x)) if idx is None else np.asarray(idx)

    def f(xx):
        r, _ = model.residuals(xx, cams, structure)
        return r * huber_weights(r)

    r = f(x)
    cost = r @ r
    for _ in range(iters):
        J = np.empty((len(r), len(idx)))
        for j, i in enumerate(idx):
            h = 1e-4 * max(1.0, abs(x[i]))
            xp = x.copy()
            xp[i] += h
            J[:, j] = (f(xp) - r) / h
        g = J.T @ r
        A = J.T @ J
        improved = False
        for _ in range(8):
            try:
                step = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-9), -g)
            except np.linalg.LinAlgError:
                lam *= 10
                continue
            xn = x.copy()
            xn[idx] += step
            rn = f(xn)
            cn = rn @ rn
            if cn < cost:
                x, r, cost = xn, rn, cn
                lam = max(lam / 3, 1e-7)
                improved = True
                break
            lam *= 4
        if not improved or np.linalg.norm(step) < 1e-7:
            break
    return x, cost


def cam_idx(model, k):
    return [model.index[f"cam.{k}.{a}"] for a in ("x", "y", "z", "yaw", "pitch", "roll")]


def start_grid(model, x, fine=False):
    """Where a camera with no viewpoint might have stood: a grid inside the room (or its structure's box)."""
    pts = {n: p for n, p in model.all_points(x).items() if n not in model.free_pts}
    P = np.array(list(pts.values())) if pts else np.zeros((1, 3))
    lo, hi = P.min(axis=0), P.max(axis=0)
    span = np.maximum(hi - lo, 1.0)
    steps = (0.12, 0.37, 0.63, 0.88) if fine else (0.15, 0.5, 0.85)
    return [(lo[0] + fx * span[0], lo[2] + fz * span[2]) for fx in steps for fz in steps]


def init_free_cameras(model, x, starts, only=None, structure=True, fine=False, force=False):
    """Each camera in `only` (all when None): the best of a grid of positions × yaws (× pitches when `fine`: a
    close-up looks down), room and points held. An EXACT viewpoint is trusted: the camera starts there (unless
    `force`). A ROUGH viewpoint is one more start beside the grid, never the only one (its prior still counts in each
    start's cost): starting from it alone let the first joint solve slide into a wrong-scale valley (DECISIONS 227)."""
    tried = 0
    for k, c in model.cams_in.items():
        if (only is not None and k not in only) or (c.get("init") and not force):
            continue
        idx = cam_idx(model, k)
        eye = c.get("eye", EYE[0])
        pr = c.get("prior")
        seeds = []
        if pr:
            ps = model.prior_scale(x)
            seeds.append([ps * pr["x"], eye, ps * pr["z"], pr["yaw"], 0.0, 0.0])
            if pr.get("conf", "rough") == "exact" and not force:
                x[idx] = seeds[0]
                continue
        yaws = np.linspace(0, 360, max(12 if fine else 8, starts // 3 if not fine else starts // 2), endpoint=False)
        pitches = (0.0, -30.0) if fine else (0.0,)
        seeds += [[px, eye, pz, yaw, pitch, 0.0] for (px, pz) in start_grid(model, x, fine) for yaw in yaws for pitch in pitches]
        best = None
        for seed in seeds:
            xt = x.copy()
            xt[idx] = seed
            xs, cost = lm(model, xt, idx=idx, cams={k}, iters=12, structure=structure)
            tried += 1
            if best is None or cost < best[1]:
                best = (xs[idx].copy(), cost)
        x[idx] = best[0]
    return x, tried


def camera_rms(model, x):
    """rms px of each camera's marks + line pixels."""
    r, meta = model.residuals(x)
    out = {}
    for k in model.cams_in:
        mine = [v for m, v in zip(meta, r) if m[0] in ("mark", "line") and m[1] == k]
        out[k] = math.sqrt(sum(v * v for v in mine) / len(mine)) if mine else 0.0
    return out


def fit_vp_scale(model, x):
    """The viewpoints' own scale (sketch metres → room metres): least squares of s·prior against where the cameras
    with a viewpoint now stand (closed form)."""
    num = den = 0.0
    for k, c in model.cams_in.items():
        pr = c.get("prior")
        if not pr:
            continue
        cx, cz = model.val(x, f"cam.{k}.x"), model.val(x, f"cam.{k}.z")
        num += pr["x"] * cx + pr["z"] * cz
        den += pr["x"] ** 2 + pr["z"] ** 2
    if den > 1e-9:
        x[model.index["vp.scale"]] = num / den
    return x


def structure_idx(model, cams=None):
    """Every parameter but the free points' (room, params, lenses, and the cameras in `cams`, all when None)."""
    return [i for n, i in model.index.items() if not n.startswith("pt.") and not (cams is not None and n.startswith("cam.") and n.split(".")[1] not in cams)]


def triangulate(model, x, cams=None):
    """Each free point from the rays through its marks in `cams` (least squares: the point nearest every ray); a
    point seen once goes 2.5 m out along its ray."""
    rays = {}
    for m in model.marks:
        n = m["point"]
        if n not in model.free_pts:
            continue
        k = str(m["photo"])
        if cams is not None and k not in cams:
            continue
        C = model.camera(x, k)
        xn = m["px"][0] / C["w"] * 2 - 1
        yn = 1 - m["px"][1] / C["h"] * 2
        d = C["r"] * xn * C["tx"] + C["u"] * yn * C["ty"] + C["f"]
        rays.setdefault(n, []).append((C["pos"], d / np.linalg.norm(d)))
    for n, rs in rays.items():
        if len(rs) == 1:
            c, d = rs[0]
            P = c + d * 2.5
        else:
            A = np.zeros((3, 3))
            b = np.zeros(3)
            for c, d in rs:
                M = np.eye(3) - np.outer(d, d)
                A += M
                b += M @ c
            try:
                P = np.linalg.solve(A, b)
            except np.linalg.LinAlgError:
                c, d = rs[0]
                P = c + d * 2.5
        for i, a in enumerate("xyz"):
            x[model.index[f"pt.{n}.{a}"]] = P[i]
    return x


def summarise(model, x):
    r, meta = model.residuals(x)
    pix = [(m, v) for m, v in zip(meta, r) if m[0] in ("mark", "line")]
    rms = math.sqrt(sum(v * v for _, v in pix) / max(1, len(pix)))
    cams = {}
    for k, c in model.cams_in.items():
        C = model.camera(x, k)
        mine = [v for m, v in pix if m[1] == k]
        n_marks = sum(1 for m in model.marks if str(m["photo"]) == k) + sum(1 for l in model.lines if str(l["photo"]) == k)
        crms = math.sqrt(sum(v * v for v in mine) / max(1, len(mine))) if mine else None
        pos = C["pos"]
        cams[k] = {
            "photo": int(k),
            "pos": [round(float(v), 3) for v in pos],
            "look": [round(float(v), 3) for v in pos + C["f"]],
            "yaw": round(float(model.val(x, f"cam.{k}.yaw")) % 360, 2),
            "pitch": round(float(model.val(x, f"cam.{k}.pitch")), 2),
            "roll": round(float(model.val(x, f"cam.{k}.roll")), 2),
            "fov": round(float(model.val(x, f"lens.{model.lens_of[k]}")), 2),
            "aspect": round(c["w"] / c["h"], 4),
            "rms_px": None if crms is None else round(crms, 2),
            "marks": n_marks,
            "fit": "good" if crms is not None and crms <= 6 and n_marks >= 6 and k not in getattr(model, "unplaced", ()) else "rough",
            "placed": k not in getattr(model, "unplaced", ()),
        }
    room = {}
    if model.room_kind == "box":
        for k in ("W", "D", "H"):
            room[k] = round(float(model.val(x, f"room.{k}", model.room["box"].get(k))), 3)
    elif model.room_kind == "outline":
        for k in ("scale", "H"):
            room[k] = round(float(model.val(x, f"room.{k}", model.room["outline"].get(k, 1.0 if k == "scale" else 2.6))), 3)
    points = {n: [round(float(v), 3) for v in p] for n, p in model.all_points(x).items()}
    params = {n: round(float(model.val(x, f"par.{n}", p["value"])), 4) for n, p in model.params_in.items()}
    return {
        "rms_px": round(rms, 2),
        "room": room,
        "params": params,
        "points": points,
        "cameras": cams,
        "residuals": [{"kind": m[0], "photo": m[1], "name": m[2], "value": round(float(v), 2)} for m, v in zip(meta, r)],
    }


def solve(model, starts):
    """The staged search (1–6) on one model; returns x and how many starts it tried."""
    x = model.x0.copy()
    exact = {k for k, c in model.cams_in.items() if (c.get("prior") or {}).get("conf", "rough") == "exact"}
    strong = {k for k in model.cams_in if k in exact or model.structure_rows(k) >= STRUCTURE_MIN}
    hold = [model.index["vp.scale"]] if model.vp_scale == "own" and "vp.scale" in model.index else []
    weak = set(model.cams_in) - strong
    # 1. the cameras that see enough structure (or stand on an exact viewpoint): a grid search each (+ a rough
    #    viewpoint as one more start), room and params at their guesses
    x, tried = init_free_cameras(model, x, starts, only=strong, structure=True)
    # 2. those cameras + room + params together, on the structure
    x, _ = lm(model, x, idx=[i for i in structure_idx(model, strong) if i not in hold], cams=strong, iters=80, structure=True)
    # 2b. viewpoints on a rough sketch (their own scale): that scale in closed form from where the cameras stand,
    #     held during each solve and fitted again between them (free INSIDE a solve it trades off against the room's
    #     scale: a flat valley the solver stops in)
    if hold:
        x = fit_vp_scale(model, x)
    # 3. the free points from those cameras' rays
    if model.free_pts:
        x = triangulate(model, x, cams=strong)
    # 4. the cameras that see little structure: a finer grid search (and looking down) against everything they see
    if weak:
        x, more = init_free_cameras(model, x, starts, only=weak, structure=False, fine=True)
        tried += more
        if model.free_pts:
            x = triangulate(model, x, cams=strong)
    # 5. everything together (twice: a fresh damping the second time)
    every = [i for i in range(len(x)) if i not in hold]
    for _ in range(3 if hold else 2):
        x, _ = lm(model, x, idx=every, iters=80)
        if hold:
            x = fit_vp_scale(model, x)
    # 6. a camera still far worse than the rest is searched again (finely) against everything; if it stays bad it is
    #    left out of the solve (reported "rough", "placed": false) so it can't bend the room for the others
    rms = camera_rms(model, x)
    med = float(np.median(list(rms.values()))) if rms else 0.0
    bad = {k for k, v in rms.items() if v > max(12.0, 4 * med)}
    if bad:
        x, more = init_free_cameras(model, x, starts, only=bad, structure=False, fine=True, force=True)
        tried += more
        for _ in range(2):
            x, _ = lm(model, x, idx=every, iters=80)
        rms = camera_rms(model, x)
        med = float(np.median(list(rms.values())))
        still = {k for k, v in rms.items() if v > max(12.0, 4 * med)}
        if still:
            model.unplaced = still
            keep = set(model.cams_in) - still
            x, _ = lm(model, x, idx=[i for n, i in model.index.items() if i not in hold and not (n.startswith("cam.") and n.split(".")[1] in still)], cams=keep, iters=80)
    return x, tried


def objective(model, x, cams=None):
    """What lm minimises: every residual (pixels, priors, anchors), Huber-weighted, squared and summed."""
    r, _ = model.residuals(x, cams)
    r = r * huber_weights(r)
    return float(r @ r)


def rough_cams(spec):
    return {str(k) for k, c in spec["cameras"].items() if c.get("prior") and c["prior"].get("conf", "rough") == "rough"}


def fit(spec, starts=24, quiet=False):
    model = Model(spec)
    x, tried = solve(model, starts)
    rough = rough_cams(spec)
    if rough:
        # 7. rough viewpoints are a hint, not the map: the same search again WITHOUT them, then polished with them back
        #    in; whichever ends with the lower objective wins. With them as the only starts the first joint solve can
        #    slide down the room's weakly-held scale (the Batcave known answer came out 32 % too wide at a WORSE pixel
        #    rms than the run with no viewpoints at all; DECISIONS 227)
        bare_spec = {**spec, "cameras": {k: ({kk: vv for kk, vv in c.items() if kk != "prior"} if str(k) in rough else c) for k, c in spec["cameras"].items()}}
        bare = Model(bare_spec)
        xb, more = solve(bare, starts)
        tried += more
        x2 = model.x0.copy()
        for n, i in bare.index.items():
            if n in model.index:
                x2[model.index[n]] = xb[i]
        hold = [model.index["vp.scale"]] if model.vp_scale == "own" and "vp.scale" in model.index else []
        out2 = set(getattr(bare, "unplaced", ()))
        idx = [i for n, i in model.index.items() if i not in hold and not (n.startswith("cam.") and n.split(".")[1] in out2)]
        keep2 = set(model.cams_in) - out2
        for _ in range(3 if hold else 2):
            if hold:
                x2 = fit_vp_scale(model, x2)
            x2, _ = lm(model, x2, idx=idx, cams=keep2, iters=80)
        if hold:
            x2 = fit_vp_scale(model, x2)
        both = keep2 - set(getattr(model, "unplaced", ()))
        if objective(model, x2, both) < objective(model, x, both):
            x = x2
            model.unplaced = out2
            model.chose = "search without the rough viewpoints, then polished with them"
        else:
            model.chose = "search from the viewpoints"
    out = summarise(model, x)
    out["starts"] = tried
    if getattr(model, "chose", None):
        out["chose"] = model.chose
    if not quiet:
        print(f"rms {out['rms_px']} px over {sum(1 for r in out['residuals'] if r['kind'] in ('mark', 'line'))} marks; room {out['room']}; {tried} starts")
        for k, c in sorted(out["cameras"].items(), key=lambda kv: int(kv[0])):
            print(f"  photo {k:>2}: pos {c['pos']} yaw {c['yaw']:6.1f} pitch {c['pitch']:5.1f} roll {c['roll']:5.1f} fov {c['fov']:5.1f}  {c['rms_px']} px / {c['marks']} marks  {c['fit']}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default=None)
    ap.add_argument("--starts", type=int, default=24)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    spec = json.loads(Path(a.input).read_text(encoding="utf-8"))
    out = fit(spec, a.starts, a.quiet)
    dest = Path(a.out) if a.out else Path(a.input).with_name("fit-output.json")
    dest.write_text(json.dumps(out, indent=1), encoding="utf-8")
    if not a.quiet:
        print(f"→ {dest}")
    return 0 if math.isfinite(out["rms_px"]) else 1


if __name__ == "__main__":
    sys.exit(main())
