"""Known-answer test of the freeform branch's camera fit (tools/memory-rooms/freeform/fit.py), two rooms, two runs.

    python tools/memory-rooms/freeform/known_answer.py [--out tools/memory-rooms/freeform/known-answer.json]

Each room is made into a FREEFORM copy: its photos shuffled and renumbered, their EXIF stripped (the field of view
is a free unknown, one shared lens), and NO viewpoints, so nothing says which photo is which corner. fit.py then
solves it twice: A) as is (every camera found by its grid search), B) with 3 ROUGH viewpoints (the true position
moved 0.4 m in a random direction, the yaw off by up to ±20°, conf "rough"), as James would drop them on the plan.
Errors are measured against the known answer after mapping the shuffled numbers back.

1. The synthetic self-test room (selftest/truth/truth.scene.json, 4.40 × 3.40 × 2.75 m, 6 photos): the truth
   geometry (room corners, the door and window corners, the 13 objects' top centres) projected into the true
   cameras, 2 px of marking noise, only what lands in front of the camera and inside the frame (occlusion is not
   modelled: easier than real photos). Wall–floor and wall–ceiling lines as line marks. Scale: the door is 2.04 m.
2. "The Batcave" (a real room, 6 real phone photos): the 400-odd REAL pixel marks its guided render made
   (memory-rooms-work/59b68a1b-…/fit/obs.json: wall, ceiling, bulkhead, benchtop, glazing and door lines, the six
   downlights), ported to fit.py's parametric room (the same room model that session wrote, minus its radial
   distortion and its vertical-segment terms). Scale: the benchtop's front edge at 0.88 m, as that session assumed.
   The answer: the room's size from the builder's plan (7.33 × 5.01 m); the cameras two ways: against the
   GUIDED solve of the same marks (fit/fit-result-final.json: the corner-shot assumption, radial distortion and
   the vertical segments; the same frame), and against the cameras re-solved with the room fixed to the plan
   (fit/fit-plan.json, 5.3 px rms; DECISIONS 190) after a similarity alignment in plan (a freeform session picks its
   own frame and scale, and the plan solve's west wall sits 0.9 m from where these marks put it: the kitchen zone of
   DECISIONS 189). The rough viewpoints of run B are drawn around the guided cameras (the marks' own frame).
   The guided fit without the plan made the room 7.97 × 5.26 m.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE))
from fit import cam_basis, fit, project  # noqa: E402

DEG = math.pi / 180


def yaw_of(f):
    return (math.atan2(f[0], f[2]) / DEG) % 360


def angle_between(a, b):
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    return math.degrees(math.acos(max(-1.0, min(1.0, float(a @ b)))))


def rough_prior(rng, pos, yaw):
    a = rng.uniform(0, 2 * math.pi)
    return {"x": round(pos[0] + 0.4 * math.cos(a), 3), "z": round(pos[2] + 0.4 * math.sin(a), 3), "yaw": round((yaw + rng.uniform(-20, 20)) % 360, 1), "conf": "rough"}


# ── 1. the synthetic self-test room ─────────────────────────────────────────


def synthetic(rng, with_priors):
    spec, cams, free, W, D, H, n_obs = synthetic_spec(rng, with_priors)
    out = fit(spec, quiet=True)
    room_err = {"W": abs(out["room"]["W"] - W), "D": abs(out["room"]["D"] - D), "H": abs(out["room"]["H"] - H)}
    cam_err = []
    for k, v in cams.items():
        got = out["cameras"][k]
        t = v["_truth"]
        cam_err.append({"photo": t["photo"], "shown_as": int(k), "pos": float(np.linalg.norm(np.array(got["pos"]) - np.array(t["pos"]))), "aim": angle_between(np.array(got["look"]) - np.array(got["pos"]), t["f"]), "fit": got["fit"]})
    # objects seen in 2+ photos are triangulated; one seen once can only be guessed along its ray (reported apart)
    seen = {}
    for m in spec["marks"]:
        seen.setdefault(m["point"], set()).add(m["photo"])
    obj_err = [float(np.linalg.norm(np.array(out["points"][n]) - np.array(P))) for n, P in free.items() if n.startswith("obj.") and len(seen.get(n, ())) >= 2]
    single = [n[4:] for n in free if n.startswith("obj.") and len(seen.get(n, ())) < 2]
    r = summary("synthetic self-test room", {"W": W, "D": D, "H": H}, out, room_err, cam_err, obj_err, n_obs, with_priors)
    r["objects"]["single_view"] = single
    return r


def synthetic_spec(rng, with_priors):
    truth = json.loads((REPO / "tools/memory-rooms/selftest/truth/truth.scene.json").read_text(encoding="utf-8"))
    sh = truth["shell"]
    W, D, H = sh["width"], sh["depth"], sh["height"]
    pts = {
        "NW0": (0, 0, 0), "NE0": (W, 0, 0), "SE0": (W, 0, D), "SW0": (0, 0, D),
        "NW1": (0, H, 0), "NE1": (W, H, 0), "SE1": (W, H, D), "SW1": (0, H, D),
    }
    free = {}
    for o in sh["openings"]:
        sill = o.get("sill", 0)
        top = sill + o["height"]
        if o["wall"] == "south":
            a, b = (o["offset"], D), (o["offset"] + o["width"], D)
        elif o["wall"] == "north":
            a, b = (o["offset"], 0), (o["offset"] + o["width"], 0)
        else:
            continue
        name = o["type"]
        for i, (x, z) in enumerate((a, b)):
            for j, y in enumerate((sill, top)):
                free[f"{name}{i}{j}"] = (x, y, z)
    for ob in truth["objects"]:
        free[f"obj.{ob['id']}"] = (ob["at"][0], ob["at"][1] + ob["size"][1], ob["at"][2])
    allpts = {**pts, **free}
    # shuffle: photo k is shown as perm[k]
    photos = [c["photo"] for c in truth["cameras"]]
    shuffled = photos[:]
    rng.shuffle(shuffled)
    perm = dict(zip(photos, shuffled))
    w, h = 1536, 2048
    marks, lines, cams = [], [], {}
    for c in truth["cameras"]:
        f = np.array(c["look"], float) - np.array(c["pos"], float)
        yaw = yaw_of(f)
        pitch = math.degrees(math.asin(f[1] / np.linalg.norm(f)))
        C = cam_basis(np.array(c["pos"], float), yaw, pitch, 0.0, c.get("fov", 70), w, h)
        k = perm[c["photo"]]
        for n, P in allpts.items():
            q = project(C, np.array(P, float))
            if q is None or not (8 < q[0] < w - 8 and 8 < q[1] < h - 8):
                continue
            marks.append({"photo": k, "point": n, "px": [q[0] + rng.gauss(0, 2), q[1] + rng.gauss(0, 2)]})
        # wall–floor and wall–ceiling lines: 3 points along each visible stretch
        for a, b in (("NW0", "NE0"), ("NE0", "SE0"), ("SE0", "SW0"), ("SW0", "NW0"), ("NW1", "NE1"), ("NE1", "SE1"), ("SE1", "SW1"), ("SW1", "NW1")):
            A, B = np.array(pts[a], float), np.array(pts[b], float)
            seen = []
            for t in np.linspace(0.05, 0.95, 19):
                q = project(C, A + (B - A) * t)
                if q is not None and 8 < q[0] < w - 8 and 8 < q[1] < h - 8:
                    seen.append(q)
            for q in seen[:: max(1, len(seen) // 3)][:3]:
                lines.append({"photo": k, "a": a, "b": b, "px": [q[0] + rng.gauss(0, 2), q[1] + rng.gauss(0, 2)]})
        cams[str(k)] = {"w": w, "h": h, "fov": 70.0, "fovSigma": None, "lens": "phone", "_truth": {"pos": c["pos"], "f": (f / np.linalg.norm(f)).tolist(), "fov": c.get("fov", 70), "photo": c["photo"]}}
    if with_priors:
        for k in list(cams)[:3]:
            t = cams[k]["_truth"]
            cams[k]["prior"] = rough_prior(rng, t["pos"], yaw_of(t["f"]))
    spec = {
        "room": {"box": {"W": 4.0, "D": 3.5, "H": 2.6, "free": ["W", "D", "H"]}},
        "points": {n: {"xyz": [W / 2, 1.0, D / 2] if not n.startswith("obj.") else [2.0, 1.0, 1.75], "free": True} for n in free},
        "anchors": [{"a": "door00", "b": "door01", "length": 2.04, "sigma": 0.02}, {"a": "door10", "b": "door11", "length": 2.04, "sigma": 0.02}],
        "cameras": {k: {kk: vv for kk, vv in v.items() if not kk.startswith("_")} for k, v in cams.items()},
        "marks": marks,
        "lines": lines,
    }
    return spec, cams, free, W, D, H, len(marks) + len(lines)


# ── 2. The Batcave: its real marks, its room model ──────────────────────────

BATCAVE = REPO / "memory-rooms-work/59b68a1b-c157-44c3-a92c-c2be9bb43092/fit"
# the guided session's room model (fit/fit.py `ent` / `pent`): each line a point + a direction, each in terms of
# the room (W, D, H) and its params. Ported to fit.py as two points per line (P and P + 3·dir).
LINES = {
    "N_ceil": (("0", "H", "0.15"), "X"), "N_head": (("0", "H - hHead", "cN"), "X"), "N_hem": (("0", "0.02", "cN"), "X"),
    "S_ceil": (("0", "H", "D"), "X"), "S_ceilc": (("0", "H", "D - 0.15"), "X"), "S_head": (("0", "H - hHead", "D - cS"), "X"),
    "E_bk_top": (("W - bE", "H", "0"), "Z"), "E_bk_bot": (("W - bE", "H - hE", "0"), "Z"), "E_bk_wall": (("W", "H - hE", "0"), "Z"),
    "W_bk_top": (("bW", "H", "0"), "Z"), "W_bk_bot": (("bW", "H - hW", "0"), "Z"), "W_bk_wall": (("0", "H - hW", "0"), "Z"),
    "W_bk_end": (("bW", "0", "0"), "Y"), "K_bench": (("kF", "kH", "0"), "Z"), "K_upper": (("uF", "uB", "0"), "Z"),
    "C_NE": (("W", "0", "0"), "Y"), "C_SE": (("W", "0", "D"), "Y"), "C_SW": (("0", "0", "D"), "Y"), "C_NW": (("0", "0", "0"), "Y"),
    "N_jamb0": (("gN0", "0", "0"), "Y"), "N_mull": (("gNm", "0", "0"), "Y"), "N_jamb1": (("gN1", "0", "0"), "Y"),
    "TV_s": (("tvX", "0", "tvS"), "Y"), "TV_n": (("tvX", "0", "tvN"), "Y"), "TV_top": (("tvX", "tvTop", "0"), "Z"),
    "D_ce": (("dCe", "0", "D"), "Y"), "D_top": (("0", "dSh", "D + 0.05"), "X"),
}
POINTS = {
    "W_bk_N_bot": ("bW", "H - hW", "0"), "W_bk_N_top": ("bW", "H", "0"), "W_bk_S_bot": ("bW", "H - hW", "D"),
    "TV_st": ("tvX", "tvTop", "tvS"), "D_ce_bot": ("dCe", "0", "D"),
    **{f"L{k}": (f"L{k}x", "H", f"L{k}z") for k in "ABCDEF"},
}
# the session's first guesses (fit.py G0) and the sizes it held fixed (FIXED); the downlights' guesses too
G0 = dict(bE=0.45, hE=0.30, bW=0.75, hW=0.35, uB=1.50, gN0=0.6, gNm=3.9, gN1=7.2, tvX=7.75, tvTop=1.5, tvS=3.6, tvN=1.9, dCe=2.9, dSh=2.1,
          LAx=3.4, LAz=1.3, LBx=5.3, LBz=1.3, LCx=7.2, LCz=1.3, LDx=3.4, LDz=3.9, LEx=5.3, LEz=3.9, LFx=7.2, LFz=3.9)
FIXED = dict(cN=0.12, cS=0.12, kH=0.88, hHead=0.08, kF=0.63, uF=0.34)


def batcave(rng, with_priors):
    obs = json.loads((BATCAVE / "obs.json").read_text(encoding="utf-8"))
    plan = json.loads((BATCAVE / "fit-plan.json").read_text(encoding="utf-8"))
    photos = sorted({o[0] for o in obs})
    shuffled = photos[:]
    rng.shuffle(shuffled)
    perm = dict(zip(photos, shuffled))
    step = {"X": ("3", "0", "0"), "Y": ("0", "3", "0"), "Z": ("0", "0", "3")}
    points = {}
    for name, (P, d) in LINES.items():
        points[f"{name}.a"] = {"expr": list(P)}
        points[f"{name}.b"] = {"expr": [f"({p}) + {q}" for p, q in zip(P, step[d])]}
    for name, P in POINTS.items():
        points[name] = {"expr": list(P)}
    marks, lines = [], []
    for photo, name, pxs in obs:
        k = perm[photo]
        for px in pxs:
            if name.startswith("pt:"):
                marks.append({"photo": k, "point": name[3:], "px": px})
            elif name in LINES:
                lines.append({"photo": k, "a": f"{name}.a", "b": f"{name}.b", "px": px})
    guided = json.loads((BATCAVE / "fit-result-final.json").read_text(encoding="utf-8"))

    def cam_of(c):
        # fit.py there: yaw clockwise from north (F = (sin a, 0, -cos a)); here rotY's (F = (sin y, 0, cos y))
        ya, pi = c["yaw"] * DEG, c["pitch"] * DEG
        return {"pos": c["pos"], "f": [math.sin(ya) * math.cos(pi), math.sin(pi), -math.cos(ya) * math.cos(pi)]}

    cams = {}
    truth = {}
    for photo in photos:
        k = str(perm[photo])
        truth[k] = {"photo": photo, "guided": cam_of(guided["cams"][str(photo)]), "plan": cam_of(plan["cams"][str(photo)])}
        cams[k] = {"w": 1536, "h": 2048, "fov": 70.0, "fovSigma": None, "lens": "phone", "eye": 1.5}
    if with_priors:
        for k in list(cams)[:3]:
            t = truth[k]["guided"]
            cams[k]["prior"] = rough_prior(rng, t["pos"], yaw_of(t["f"]))
    spec = {
        "room": {"box": {"W": 8.0, "D": 6.0, "H": 2.7, "free": ["W", "D", "H"]}},
        "params": {**{k: {"value": v, "free": True} for k, v in G0.items()}, **{k: {"value": v} for k, v in FIXED.items()}},
        "points": points,
        "cameras": cams,
        "marks": marks,
        "lines": lines,
    }
    out = fit(spec, quiet=True)
    g = plan["g"]
    room_err = {"W": abs(out["room"]["W"] - g["W"]), "D": abs(out["room"]["D"] - g["D"]), "H": abs(out["room"]["H"] - g["H"])}
    # against the guided solve: the same marks, the same frame
    cam_err = []
    for k, t in truth.items():
        got = out["cameras"][k]
        tg = t["guided"]
        cam_err.append({"photo": t["photo"], "shown_as": int(k), "pos": float(np.linalg.norm(np.array(got["pos"]) - np.array(tg["pos"]))), "aim": angle_between(np.array(got["look"]) - np.array(got["pos"]), tg["f"]), "fit": got["fit"]})
    # against the plan-fixed solve, after the best similarity alignment in plan (camera positions)
    ks = list(truth)
    # (a similarity: the scale error is already the room-size error above; this is the SHAPE of the solve)
    to_plan, R, sc = align2d([[out["cameras"][k]["pos"][0], out["cameras"][k]["pos"][2]] for k in ks], [[truth[k]["plan"]["pos"][0], truth[k]["plan"]["pos"][2]] for k in ks], scale=True)
    plan_err = []
    for k in ks:
        got = out["cameras"][k]
        q = to_plan([got["pos"][0], got["pos"][2]])
        P = truth[k]["plan"]["pos"]
        f = np.array(got["look"]) - np.array(got["pos"])
        fx = R @ np.array([f[0], f[2]])
        plan_err.append({"photo": truth[k]["photo"], "pos": math.sqrt((q[0] - P[0]) ** 2 + (sc * got["pos"][1] - P[1]) ** 2 + (q[1] - P[2]) ** 2), "aim": angle_between([fx[0], f[1], fx[1]], truth[k]["plan"]["f"])})
    # "objects": the six downlights and the TV's top south corner, against the guided solve (same frame) and the plan
    # solve (aligned)
    p = out["params"]
    gg = guided["g"]
    obj_err = [math.hypot(p[f"L{k}x"] - gg[f"L{k}x"], p[f"L{k}z"] - gg[f"L{k}z"]) for k in "ABCDEF"] + [math.hypot(p["tvX"] - gg["tvX"], p["tvS"] - gg["tvS"])]
    obj_plan = [float(np.linalg.norm(to_plan([p[f"L{k}x"], p[f"L{k}z"]]) - np.array([g[f"L{k}x"], g[f"L{k}z"]]))) for k in "ABCDEF"] + [float(np.linalg.norm(to_plan([p["tvX"], p["tvS"]]) - np.array([g["tvX"], g["tvS"]])))]
    r = summary("The Batcave (real photos, real marks)", {"W": g["W"], "D": g["D"], "H": g["H"]}, out, room_err, cam_err, obj_err, len(marks) + len(lines), with_priors)
    r["cameras_vs"] = "the guided solve of the same marks (same frame)"
    r["objects_vs"] = "the six downlights + the TV's south edge, vs the guided solve"
    r["vs_plan_aligned"] = {
        "cameras": {"pos_mean_m": round(float(np.mean([e["pos"] for e in plan_err])), 3), "pos_max_m": round(float(np.max([e["pos"] for e in plan_err])), 3), "aim_mean_deg": round(float(np.mean([e["aim"] for e in plan_err])), 2), "aim_max_deg": round(float(np.max([e["aim"] for e in plan_err])), 2)},
        "objects": {"mean_m": round(float(np.mean(obj_plan)), 3), "median_m": round(float(np.median(obj_plan)), 3), "max_m": round(float(np.max(obj_plan)), 3)},
        "rotation_deg": round(math.degrees(math.atan2(R[1, 0], R[0, 0])), 2),
        "scale": round(sc, 4),
    }
    r["guided_room"] = {"W": round(gg["W"], 3), "D": round(gg["D"], 3), "H": round(gg["H"], 3)}
    return r


def align2d(src, dst, scale=False):
    """The rotation (about y) + translation (+ a scale, when asked) in plan that best maps src [[x, z]…] onto dst
    (Kabsch / Umeyama). → (map, R, s)."""
    A = np.array(src, float)
    B = np.array(dst, float)
    ca, cb = A.mean(axis=0), B.mean(axis=0)
    H = (A - ca).T @ (B - cb)
    U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1.0, d])
    R = Vt.T @ D @ U.T
    sc = float((S * np.diag(D)).sum() / ((A - ca) ** 2).sum()) if scale else 1.0
    return (lambda p: sc * (R @ (np.asarray(p, float) - ca)) + cb), R, sc


def summary(name, true_room, out, room_err, cam_err, obj_err, n_obs, with_priors):
    pe = [c["pos"] for c in cam_err]
    ae = [c["aim"] for c in cam_err]
    return {
        "room": name,
        "run": "B: 3 rough viewpoints" if with_priors else "A: no viewpoints",
        "observations": n_obs,
        "rms_px": out["rms_px"],
        "starts": out["starts"],
        "chose": out.get("chose"),
        "size": {k: round(out["room"][k], 3) for k in ("W", "D", "H")},
        "truth": true_room,
        "size_error_m": {k: round(v, 3) for k, v in room_err.items()},
        "size_error_pct": {k: round(100 * room_err[k] / true_room[k], 1) for k in ("W", "D", "H")},
        "cameras": {"pos_mean_m": round(float(np.mean(pe)), 3), "pos_max_m": round(float(np.max(pe)), 3), "aim_mean_deg": round(float(np.mean(ae)), 2), "aim_max_deg": round(float(np.max(ae)), 2), "fov": [round(c["fov"], 1) for c in out["cameras"].values()][0]},
        "per_camera": [{**c, "pos": round(c["pos"], 3), "aim": round(c["aim"], 2)} for c in sorted(cam_err, key=lambda c: c["photo"])],
        "objects": {"n": len(obj_err), "mean_m": round(float(np.mean(obj_err)), 3), "median_m": round(float(np.median(obj_err)), 3), "max_m": round(float(np.max(obj_err)), 3)},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "known-answer.json"))
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--only", default="synthetic,batcave")
    a = ap.parse_args()
    results = []
    for which in a.only.split(","):
        for with_priors in (False, True):
            rng = random.Random(a.seed)
            if which == "synthetic":
                r = synthetic(rng, with_priors)
            elif which == "batcave":
                if not (BATCAVE / "obs.json").exists():
                    print("The Batcave's work folder isn't here: skipped")
                    continue
                r = batcave(rng, with_priors)
            else:
                continue
            results.append(r)
            print(f"{r['room']} · {r['run']}: {r['observations']} marks, rms {r['rms_px']} px, {r['starts']} starts{'; ' + r['chose'] if r['chose'] else ''}")
            print(f"  size {r['size']} vs {r['truth']}: off {r['size_error_m']} m ({r['size_error_pct']} %)")
            print(f"  cameras: position mean {r['cameras']['pos_mean_m']} m (max {r['cameras']['pos_max_m']}), aim mean {r['cameras']['aim_mean_deg']}° (max {r['cameras']['aim_max_deg']}°), fov {r['cameras']['fov']}°")
            if r.get("vs_plan_aligned"):
                v = r["vs_plan_aligned"]
                print(f"  vs the plan solve (similarity-aligned: {v['rotation_deg']}°, ×{v['scale']}): cameras {v['cameras']['pos_mean_m']} m (max {v['cameras']['pos_max_m']}) / {v['cameras']['aim_mean_deg']}°, objects mean {v['objects']['mean_m']} m (max {v['objects']['max_m']}); the guided room was {r['guided_room']}")
            print(f"  objects: mean {r['objects']['mean_m']} m, median {r['objects']['median_m']}, max {r['objects']['max_m']} ({r['objects']['n']}{', seen once: ' + ', '.join(r['objects']['single_view']) if r['objects'].get('single_view') else ''})")
    Path(a.out).write_text(json.dumps(results, indent=1), encoding="utf-8")
    print(f"→ {a.out}")


if __name__ == "__main__":
    main()
