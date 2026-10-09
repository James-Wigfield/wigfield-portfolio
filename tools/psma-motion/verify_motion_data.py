#!/usr/bin/env python3
"""
PSMA motion graphics -- verification gates (runs in WSL, `mamba` conda env).

    PYTHONDONTWRITEBYTECODE=1 ~/miniconda3/envs/mamba/bin/python \
        tools/psma-motion/verify_motion_data.py data --case <case_id>        # G1-G6
    ... verify_motion_data.py frames --case <case_id> --capture <dir>        # G7 (captured PNGs)
    ... verify_motion_data.py numbers --case <case_id> --capture <dir>       # G8 (on-screen numbers)

Each gate prints PASS/FAIL with its measured values and writes a JSON report to
motion-data/<case>/verify/<gate>.json. The gates deliberately avoid the exporter's
own code wherever they check its output (G1, G3, G4, G5, G6); G2 reuses it on
purpose, because G2 asks whether the layers on disk are exactly what the saved
masks produce.
"""

import argparse
import csv
import hashlib
import io
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
PORTFOLIO = HERE.parent.parent
DEFAULT_MAMBA = Path("/mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA")


def sha256_file(path, chunk=1 << 22):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def sha256_array(a):
    a = np.ascontiguousarray(a)
    h = hashlib.sha256()
    h.update(f"{a.dtype.str}|{a.shape}|".encode())
    h.update(a.tobytes())
    return h.hexdigest()


def load_manifest(case_dir):
    return json.loads((case_dir / "manifest.json").read_text())


RENDERER = ["glStage.js", "StageView.jsx", "overlay.js", "buildTimeline.js", "looks.js", "copy.js",
            "Schematic.jsx", "PsmaMotion.jsx", "loadCase.js"]


def provenance():
    """sha256 of the code a report certifies (C1 round 1, S2), recorded in every report."""
    mod = PORTFOLIO / "src/components/portal/modules/psma-motion"
    return {
        "verify_script": sha256_file(Path(__file__)),
        "exporter": sha256_file(HERE / "export_motion_data.py"),
        "renderer": {f: sha256_file(mod / f) for f in RENDERER if (mod / f).exists()},
        "written": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }


def report(case_dir, gate, ok, payload):
    vdir = case_dir / "verify"
    vdir.mkdir(exist_ok=True)
    payload = {"gate": gate, "pass": bool(ok), "provenance": provenance(), **payload}
    (vdir / f"{gate}.json").write_text(json.dumps(payload, indent=1, default=float))
    print(f"{'PASS' if ok else 'FAIL'}  {gate}")
    return ok


def read_rows(path, case):
    out = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if (r["case_id"] == case and float(r["threshold"]) == 0.5
                    and r["expand"] == "False" and r["split"] == "False"):
                out[int(r["min_voxels"])] = r
    return out


def csv_value(v):
    if v == "":
        return None
    if v in ("True", "False"):
        return v == "True"
    try:
        return int(v)
    except ValueError:
        return float(v)


# ----------------------------------------------------------------------------- independent helpers
def components_26(mask):
    """scipy labelling with the full 3x3x3 structure, written here rather than imported."""
    from scipy import ndimage
    return ndimage.label(np.asarray(mask) > 0, structure=np.ones((3, 3, 3), dtype=bool))


def verdict_layers(pred, label, removed):
    """Class masks by slice-wise per-component overlap tests (not the exporter's bincount path)."""
    from scipy import ndimage
    pl, npred = components_26(pred)
    gl, ngt = components_26(label)
    found = np.zeros(label.shape, bool)
    missed = np.zeros(label.shape, bool)
    touch = np.zeros(label.shape, bool)
    fa = np.zeros(label.shape, bool)
    for k, sl in enumerate(ndimage.find_objects(gl), start=1):
        comp = gl[sl] == k
        if (pred[sl][comp] > 0).any():
            found[sl] |= comp
        else:
            missed[sl] |= comp
    for k, sl in enumerate(ndimage.find_objects(pl), start=1):
        comp = pl[sl] == k
        if (label[sl][comp] > 0).any():
            touch[sl] |= comp
        else:
            fa[sl] |= comp
    return {"pred": pred > 0, "gt": label > 0, "found_gt": found, "missed_gt": missed,
            "touch_pred": touch, "fa_pred": fa, "removed": removed > 0}, (pl, npred, gl, ngt)


def quarter_projection(vol, deg):
    """
    Plain max projections on the native grid at the quarter turns, by axis max and flips only.
    Returns (proj[z, k], axis, flip): column k of proj indexes x (deg 0/180) or y (deg 90/270),
    and flip says whether screen columns run against that index.
    """
    if deg in (0, 180):
        return vol.max(axis=1), "x", deg == 180
    return vol.max(axis=2), "y", deg == 270


def proj_to_layer(proj, axis, flip, lay):
    """Sample a native (Z, X or Y) projection at every layer pixel centre (nearest cell)."""
    H, W, p, R = lay["height"], lay["width"], lay["pixel_mm"], lay["radius_mm"]
    sz = lay["spacing_zyx_mm"][0]
    s = lay["spacing_zyx_mm"][2]
    cy, cx = lay["centre_edge_yx"]
    z_top = lay["z_top_mm"]
    r = np.arange(H)
    j = np.arange(W)
    Z = z_top - (r + 0.5) * p
    zc = np.floor(Z / sz).astype(int)
    u = -R + (j + 0.5) * p
    if axis == "x":
        coord = (-u if flip else u) / s + cx
    else:
        coord = (-u if flip else u) / s + cy
    kc = np.floor(coord).astype(int)
    out = np.zeros((H, W), bool)
    okz = (zc >= 0) & (zc < proj.shape[0])
    okk = (kc >= 0) & (kc < proj.shape[1])
    sub = proj[np.ix_(zc[okz], kc[okk])]
    out[np.ix_(np.nonzero(okz)[0], np.nonzero(okk)[0])] = sub
    return out


def iou(a, b):
    a = np.asarray(a, bool)
    b = np.asarray(b, bool)
    u = (a | b).sum()
    return 1.0 if u == 0 else float((a & b).sum() / u)


def mask_png(case_dir, ai):
    from PIL import Image
    return np.asarray(Image.open(case_dir / "frames" / f"mask_{ai:03d}.png"))


def rgb_png(case_dir, ai):
    from PIL import Image
    return np.asarray(Image.open(case_dir / "frames" / f"rgb_{ai:03d}.png"))


# ----------------------------------------------------------------------------- G1 - G6
def gate_data(args):
    case = args.case
    case_dir = Path(args.data_dir) / case
    mamba = Path(args.mamba_repo)
    sys.path.insert(0, str(mamba))
    from evaluation.metrics import remove_small_components, evaluate_case
    man = load_manifest(case_dir)
    lay = man["layer"]
    bits = man["masks"]["bits"]
    n_ang = man["rotation"]["n_angles"]
    results = {}

    # ---- G1: recompute from the raw maps, compare with both CSVs and the saved mask
    t0 = time.time()
    d = np.load(Path(args.cache_dir) / f"{case}.npz")
    label = (np.asarray(d["label"], dtype=np.float32)[0] > 0).astype(np.uint8)
    probs = [np.load(Path(args.probs_dir) / f"fold{k}" / f"{case}.npz")["prob"].astype(np.float32, copy=False)
             for k in range(5)]
    prob = np.mean(np.stack(probs, axis=0), axis=0, dtype=np.float32)
    del probs
    binary = (prob > 0.5).astype(np.uint8)
    pred = remove_small_components(binary, 10).astype(np.uint8)
    res = evaluate_case(pred, label)
    home = read_rows(mamba / man["results"]["csv_home"], case)[10]
    dem = read_rows(mamba / man["results"]["csv_demeter"], case)[10]
    cols = ["n_gt", "n_pred", "tp", "fp", "fn", "f1", "ppv", "sensitivity", "dsc",
            "gt_positive", "pred_positive", "gt_voxels", "pred_voxels"]
    home_eq = {c: res[c] == csv_value(home[c]) for c in cols}
    dem_eq = {c: res[c] == csv_value(dem[c]) for c in ("tp", "fp", "fn", "n_gt", "n_pred")}
    saved_pred = np.load(case_dir / "pred.npz")["pred"]
    saved_label = np.load(case_dir / "label.npz")["label"]
    same_pred = bool(np.array_equal(saved_pred, pred))
    same_label = bool(np.array_equal(saved_label, label))
    ok1 = all(home_eq.values()) and all(dem_eq.values()) and same_pred and same_label
    results["G1"] = report(case_dir, "G1", ok1, {
        "home_columns_equal": home_eq, "demeter_counts_equal": dem_eq,
        "recomputed": {c: res[c] for c in cols},
        "demeter_row": {c: csv_value(dem[c]) for c in cols},
        "pred_voxels_home_minus_demeter": res["pred_voxels"] - csv_value(dem["pred_voxels"]),
        "dsc_home_minus_demeter": res["dsc"] - csv_value(dem["dsc"]),
        "saved_pred_equals_recomputed": same_pred, "saved_label_equals_cache": same_label,
        "seconds": round(time.time() - t0, 1)})
    removed = ((binary > 0) & (pred == 0)).astype(np.uint8)
    del prob, binary

    # ---- G2: regenerate the mask layers from the saved arrays with the exporter's code
    t0 = time.time()
    sys.path.insert(0, str(HERE))
    import export_motion_data as ex
    from PIL import Image
    saved_removed = np.load(case_dir / "removed.npz")["removed"]
    hashes_ok = {
        "pred": sha256_array(saved_pred) == man["masks"]["pred"]["sha256_array"],
        "label": sha256_array(saved_label) == man["masks"]["label"]["sha256_array"],
        "removed": sha256_array(saved_removed) == man["masks"]["removed"]["sha256_array"],
        "pred_file": sha256_file(case_dir / "pred.npz") == man["masks"]["pred"]["sha256_file"],
        "label_file": sha256_file(case_dir / "label.npz") == man["masks"]["label"]["sha256_file"],
        "removed_equals_recomputed": bool(np.array_equal(saved_removed, removed)),
    }
    geom = ex.Geometry(lay["shape_zyx"], lay["spacing_zyx_mm"], (lay["crop_y"], lay["crop_x"]), lay["scale"])
    from evaluation.metrics import connected_components
    pl, npred = connected_components(saved_pred)
    gl, ngt = connected_components(saved_label)
    rl, nrem = connected_components(saved_removed)
    found = np.bincount(gl[saved_pred > 0], minlength=ngt + 1)[1:] > 0
    fa = np.bincount(pl[saved_label > 0], minlength=npred + 1)[1:] == 0
    ms = ex.MaskSet(pl, gl, rl, found, fa)
    step = 9 if args.quick else 1
    mism = []
    for ai in range(0, n_ang, step):
        b, _ = ms.layer(geom, ai * 360.0 / n_ang)
        buf = io.BytesIO()
        Image.fromarray(b, mode="L").save(buf, format="PNG", compress_level=9)
        disk = (case_dir / "frames" / f"mask_{ai:03d}.png").read_bytes()
        if buf.getvalue() != disk or hashlib.sha256(disk).hexdigest() != man["masks"]["mask_png_sha256"][ai]:
            mism.append(ai)
    ok2 = all(hashes_ok.values()) and not mism
    results["G2"] = report(case_dir, "G2", ok2, {
        "array_and_file_hashes": hashes_ok, "angles_checked": len(range(0, n_ang, step)),
        "angles_with_byte_mismatch": mism, "seconds": round(time.time() - t0, 1)})

    # ---- G3: independent projections against the exported layers, exact
    t0 = time.time()
    layers, (pl2, npred2, gl2, ngt2) = verdict_layers(saved_pred, saved_label, saved_removed)
    g3 = {}
    ok3 = True
    # (a) quarter turns by plain axis max and flips, sampled at layer pixel centres
    for deg in (0, 90, 180, 270):
        ai = int(round(deg * n_ang / 360)) % n_ang
        exported = mask_png(case_dir, ai)
        g3[deg] = {}
        for name, vol in layers.items():
            proj, axis, flip = quarter_projection(vol, deg)
            mine = proj_to_layer(proj, axis, flip, lay)
            theirs = ((exported >> bits[name]) & 1).astype(bool)
            mism = int((mine != theirs).sum())
            g3[deg][name] = {"iou": iou(mine, theirs), "mismatched_pixels": mism,
                             "pixels_independent": int(mine.sum()), "pixels_exported": int(theirs.sum())}
            ok3 &= mism == 0
    # (b) every angle: an independent footprint splat (searchsorted on pixel centres, closed
    # form per voxel; shares no code with the exporter), all seven bits, 0 mismatches required
    allang = {name: 0 for name in layers}
    p_mm, R_mm, z_top = lay["pixel_mm"], lay["radius_mm"], lay["z_top_mm"]
    sz_, s_ = lay["spacing_zyx_mm"][0], lay["spacing_zyx_mm"][2]
    cy_, cx_ = lay["centre_edge_yx"]
    Hh, Ww = lay["height"], lay["width"]
    ucent = -R_mm + (np.arange(Ww) + 0.5) * p_mm
    zcent = z_top - (np.arange(Hh) + 0.5) * p_mm          # decreasing with row
    vox = {name: np.nonzero(vol) for name, vol in layers.items()}
    for ai in range(n_ang):
        th = math.radians(ai * 360.0 / n_ang)
        c, sn = math.cos(th), math.sin(th)
        hw = 0.5 * s_ * (abs(c) + abs(sn))
        exported = mask_png(case_dir, ai)
        for name, (zz, yy, xx) in vox.items():
            mine = np.zeros((Hh, Ww), bool)
            if len(zz):
                uc = (xx + 0.5 - cx_) * s_ * c + (yy + 0.5 - cy_) * s_ * sn
                j0 = np.searchsorted(ucent, uc - hw, side="left")
                j1 = np.searchsorted(ucent, uc + hw, side="left")          # centres in [uc-hw, uc+hw)
                # rows whose centre Z is in [z sz, (z+1) sz): zcent is decreasing, search its negation
                negz = -zcent
                r0 = np.searchsorted(negz, -(zz + 1) * sz_, side="right")
                r1 = np.searchsorted(negz, -zz * sz_, side="right")
                assert (r1 - r0).max() <= 4 and (j1 - j0).max() <= 4
                for dr in range(4):
                    rr = r0 + dr
                    okr = rr < r1
                    for dc in range(4):
                        jj = j0 + dc
                        ok = okr & (jj < j1)
                        mine[rr[ok], jj[ok]] = True
            theirs = ((exported >> bits[name]) & 1).astype(bool)
            allang[name] += int((mine != theirs).sum())
    ok3 &= all(v == 0 for v in allang.values())
    results["G3"] = report(case_dir, "G3", ok3, {"quarter_turns": g3, "all_angles_mismatched_pixels": allang,
                                                 "angles": n_ang,
                                                 "pass_rule": "0 mismatched pixels on every bit, quarter turns "
                                                              "(axis max + flips) and all angles (independent splat)",
                                                 "seconds": round(time.time() - t0, 1)})

    # ---- G4: every component visible at every angle; every voxel centre's pixel is set
    t0 = time.time()
    comps = json.loads((case_dir / "components.json").read_text())
    min_area = {}
    for kind in ("pred", "gt", "removed"):
        areas = [min(row[6] for row in o["fp"]) for o in comps[kind]]
        min_area[kind] = min(areas) if areas else None
    p, R, z_top = lay["pixel_mm"], lay["radius_mm"], lay["z_top_mm"]
    sz, s = lay["spacing_zyx_mm"][0], lay["spacing_zyx_mm"][2]
    cy, cx = lay["centre_edge_yx"]
    groups = {}
    for name, lab, n in (("pred", pl2, npred2), ("gt", gl2, ngt2)):
        zz, yy, xx = np.nonzero(lab)
        groups[name] = (zz, yy, xx, lab[zz, yy, xx])
    rl2, _ = components_26(saved_removed)
    zz, yy, xx = np.nonzero(rl2)
    groups["removed"] = (zz, yy, xx, rl2[zz, yy, xx])
    bitname = {"pred": "pred", "gt": "gt", "removed": "removed"}
    unset = {k: 0 for k in groups}
    comp_hidden = {k: 0 for k in groups}
    for ai in range(n_ang):
        th = math.radians(ai * 360.0 / n_ang)
        lay_bits = mask_png(case_dir, ai)
        for name, (zz, yy, xx, labs) in groups.items():
            if len(zz) == 0:
                continue
            X = (xx + 0.5 - cx) * s
            Y = (yy + 0.5 - cy) * s
            u = X * math.cos(th) + Y * math.sin(th)
            Z = (zz + 0.5) * sz
            j = np.floor((u + R) / p).astype(int)
            r = np.floor((z_top - Z) / p).astype(int)
            on = ((lay_bits[r, j] >> bits[bitname[name]]) & 1).astype(bool)
            unset[name] += int((~on).sum())
            seen = np.bincount(labs[on], minlength=labs.max() + 1)[1:]
            present = np.bincount(labs, minlength=labs.max() + 1)[1:] > 0
            comp_hidden[name] += int(((seen == 0) & present).sum())
    ok4 = all(v == 0 for v in unset.values()) and all(v == 0 for v in comp_hidden.values()) \
        and all(a is None or a >= 1 for a in min_area.values())
    results["G4"] = report(case_dir, "G4", ok4, {
        "voxel_centre_pixels_not_set": unset, "component_angle_pairs_with_no_pixel": comp_hidden,
        "min_footprint_area_px": min_area, "angles": n_ang,
        "components": {"pred": npred2, "gt": ngt2, "removed": int(len(comps["removed"]))},
        "seconds": round(time.time() - t0, 1)})

    # ---- G5: masks sit on PET uptake
    t0 = time.time()
    import yaml
    pn = yaml.safe_load((mamba / "configs/baseline.yaml").read_text())["preprocessing"]["normalization"]["PET"]
    suv = np.clip(d["image"][1].astype(np.float32) * float(pn["std"]) + float(pn["mean"]),
                  float(pn["clip_lower"]), float(pn["clip_upper"]))
    med_pred = float(np.median(suv[saved_pred > 0])) if saved_pred.any() else None
    med_gt = float(np.median(suv[saved_label > 0])) if saved_label.any() else None
    med_body = float(np.median(suv[suv > 1.0433]))
    rgb0 = rgb_png(case_dir, 0)
    lo, hi = man["frames"]["pet"]["store_window"]
    pet0 = lo + rgb0[..., 0].astype(np.float32) / 255 * (hi - lo)
    b0 = mask_png(case_dir, 0)
    predpx = ((b0 >> bits["pred"]) & 1).astype(bool)
    gtpx = ((b0 >> bits["gt"]) & 1).astype(bool)
    share_pred = float((pet0[predpx] >= 3.0).mean()) if predpx.any() else None
    share_gt = float((pet0[gtpx] >= 3.0).mean()) if gtpx.any() else None
    # negative controls: the same layer shifted and mirrored should land off the hotspots
    shifted = np.roll(predpx, (0, 40), axis=(0, 1))
    mirrored = predpx[:, ::-1]
    share_shift = float((pet0[shifted] >= 3.0).mean()) if shifted.any() else None
    share_mirror = float((pet0[mirrored] >= 3.0).mean()) if mirrored.any() else None
    ok5 = share_pred is not None and share_pred >= 0.8
    results["G5"] = report(case_dir, "G5", ok5, {
        "median_suv_pred_voxels": med_pred, "median_suv_gt_voxels": med_gt,
        "median_suv_body_above_floor": med_body,
        "angle0_pred_pixels_with_pet_mip_ge_3": share_pred,
        "angle0_gt_pixels_with_pet_mip_ge_3": share_gt,
        "control_pred_shifted_40px_right": share_shift, "control_pred_mirrored_left_right": share_mirror,
        "pass_rule": "share of angle-0 prediction pixels on PET MIP >= SUV 3 is at least 0.8",
        "seconds": round(time.time() - t0, 1)})

    # ---- G6: orientation at angle 0 from the organ labels, independent projection
    organ = np.asarray(d["organ"])[0]
    cents = {}
    for name, cls in (("liver", 3), ("spleen", 1), ("bladder", 4), ("brain", 6), ("skull", 10)):
        vol = organ == cls
        if not vol.any():
            cents[name] = None
            continue
        proj, axis, flip = quarter_projection(vol, 0)
        m = proj_to_layer(proj, axis, flip, lay)
        rr, jj = np.nonzero(m)
        cents[name] = [float(jj.mean()), float(rr.mean())] if len(rr) else None
    head = cents["brain"] or cents["skull"]
    body_cols = np.nonzero(((b0 >= 0) & (rgb0[..., 1] > 0)).any(axis=0))[0]
    checks = {
        "head above liver (smaller row)": bool(head and head[1] < cents["liver"][1]),
        "bladder below liver (larger row)": bool(cents["bladder"][1] > cents["liver"][1]),
        "liver left of spleen on screen (patient's right on viewer's left)": bool(cents["liver"][0] < cents["spleen"][0]),
    }
    # beat 1 organ labels: each anchor lies inside its organ's footprint (independent
    # splat), clear of every lesion / prediction pixel, on uptake >= the manifest's minimum
    # SUV (read back from the stored frame), and the leader's body edge is the silhouette's
    lab_checks = {}
    lb_meta = man.get("labels_beat1", {})
    lo_, hi_ = man["frames"]["pet"]["store_window"]
    for lb in lb_meta.get("labels", []):
        fp = component_footprints((np.isin(organ, lb["classes"])).astype(np.int32), 1, lay, 0, n_ang)[1]
        c_, r_ = int(lb["anchor_px"][0]), int(lb["anchor_px"][1])
        clear = int(lb_meta["clear_px"])
        win = b0[max(0, r_ - clear):r_ + clear + 1, max(0, c_ - clear):c_ + clear + 1]
        lesion_bits = (1 << bits["gt"]) | (1 << bits["pred"]) | (1 << bits["removed"])
        suv_stored = lo_ + float(rgb0[r_, c_, 0]) / 255 * (hi_ - lo_)
        row_body = np.nonzero(rgb0[r_, :, 1] > 0)[0]
        edge = int(row_body.max()) + 1 if lb["side"] == "right" else int(row_body.min())
        lab_checks[lb["name"]] = {
            "anchor_in_organ_footprint": bool(fp[r_, c_]),
            "no_lesion_within_clear_px": bool(((win & lesion_bits) == 0).all()),
            "stored_suv_at_anchor_ge_min": bool(suv_stored >= min(float(lb_meta["min_suv"]), hi_ - 1e-6)),
            "body_edge_matches_silhouette": edge == lb["body_edge_px"],
            "stored_suv_at_anchor": round(suv_stored, 2),
        }
    labels_ok = all(all(v for k, v in c.items() if k != "stored_suv_at_anchor") for c in lab_checks.values())
    ok6 = all(checks.values()) and labels_ok
    results["G6"] = report(case_dir, "G6", ok6, {"angle0_centroids_px": cents, "checks": checks,
                                                 "beat1_labels": lab_checks,
                                                 "beat1_labels_skipped": lb_meta.get("skipped", []),
                                                 "layer_width": lay["width"],
                                                 "body_columns": [int(body_cols.min()), int(body_cols.max())]
                                                 if len(body_cols) else None})
    print(json.dumps({k: bool(v) for k, v in results.items()}))
    return all(results.values())


# ----------------------------------------------------------------------------- G7: rendered frames
def marker_zone(shape, cx, cy, r, H, W, pad):
    """Stage pixels covered by a marker's stroke + halo (an annulus of the marker's own shape)."""
    yy, xx = np.mgrid[0:H, 0:W]
    dx = np.abs(xx - cx)
    dy = np.abs(yy - cy)
    if shape == "square":
        d = np.maximum(dx, dy)
    elif shape == "diamond":
        d = (dx + dy) / 1.3
    else:
        d = np.hypot(dx, dy)
    return np.abs(d - r) <= pad


def ring_samples(shape, cx, cy, r, n=32):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    if shape == "square":
        # points on the square's perimeter
        u = np.linspace(-r, r, n // 4, endpoint=False)
        pts = np.concatenate([np.c_[u, -r + 0 * u], np.c_[r + 0 * u, u], np.c_[-u, r + 0 * u], np.c_[-r + 0 * u, -u]])
        return cx + pts[:, 0], cy + pts[:, 1]
    if shape == "diamond":
        d = 1.3 * r
        u = np.linspace(0, 1, n // 4, endpoint=False)
        corners = [(0, -d), (d, 0), (0, d), (-d, 0), (0, -d)]
        pts = np.concatenate([np.c_[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
                              for a, b in zip(corners[:-1], corners[1:])])
        return cx + pts[:, 0], cy + pts[:, 1]
    return cx + r * np.cos(t), cy + r * np.sin(t)


def component_footprints(lab, n, lay, ai, n_ang):
    """Per-component footprint masks at one angle (independent splat, as in G3b)."""
    p_mm, R_mm, z_top = lay["pixel_mm"], lay["radius_mm"], lay["z_top_mm"]
    sz_, s_ = lay["spacing_zyx_mm"][0], lay["spacing_zyx_mm"][2]
    cy_, cx_ = lay["centre_edge_yx"]
    Hh, Ww = lay["height"], lay["width"]
    ucent = -R_mm + (np.arange(Ww) + 0.5) * p_mm
    negz = -(z_top - (np.arange(Hh) + 0.5) * p_mm)
    th = math.radians(ai * 360.0 / n_ang)
    c, sn = math.cos(th), math.sin(th)
    hw = 0.5 * s_ * (abs(c) + abs(sn))
    zz, yy, xx = np.nonzero(lab)
    ids = lab[zz, yy, xx]
    uc = (xx + 0.5 - cx_) * s_ * c + (yy + 0.5 - cy_) * s_ * sn
    j0 = np.searchsorted(ucent, uc - hw, side="left")
    j1 = np.searchsorted(ucent, uc + hw, side="left")
    r0 = np.searchsorted(negz, -(zz + 1) * sz_, side="right")
    r1 = np.searchsorted(negz, -zz * sz_, side="right")
    out = {}
    for k in range(1, n + 1):
        sel = ids == k
        m = np.zeros((Hh, Ww), bool)
        for dr in range(4):
            rr = r0[sel] + dr
            okr = rr < r1[sel]
            for dc in range(4):
                jj = j0[sel] + dc
                ok = okr & (jj < j1[sel])
                m[rr[ok], jj[ok]] = True
        out[k] = m
    return out


def ring_distance(shape, dx, dy):
    if shape == "square":
        return np.maximum(dx, dy)
    if shape == "diamond":
        return (dx + dy) / 1.3
    return np.hypot(dx, dy)


def gate_frames(args):
    from PIL import Image
    case = args.case
    case_dir = Path(args.data_dir) / case
    cap = Path(args.capture)
    holds = json.loads((cap / "holds.json").read_text())
    slot = next(s for s, cid in holds["caseIds"].items() if cid == case)
    man = load_manifest(case_dir)
    bits = man["masks"]["bits"]
    lay = man["layer"]
    n_ang = man["rotation"]["n_angles"]
    comps = man["components"]
    comp_json = json.loads((case_dir / "components.json").read_text())
    saved_pred = np.load(case_dir / "pred.npz")["pred"]
    saved_label = np.load(case_dir / "label.npz")["label"]
    pl, npred = components_26(saved_pred)
    gl, ngt = components_26(saved_label)
    out = {}
    ok = True
    # classes in draw order: a later class wins where two overlap in projection.
    # Beats 4 and 5: the fill stays the prediction (touching regions in the found blue,
    # false alarms yellow) and missed lesions are filled with their own outline; marker
    # paint is cut away over the missed and false-alarm fills, so those must be exact
    # everywhere, markers or not ("exact" classes).
    verdict_plan = {"classes": [("touch_pred", "found"), ("missed_gt", "missed"), ("fa_pred", "falseAlarm")],
                    "exact": ("missed_gt", "fa_pred"),
                    "marks": {"found": comps["found"], "missed": comps["missed"], "fa": comps["false_alarm"]}}
    # the thresholded-map hold is clip 2c on case A and clip 2 (the condensed method beat) on B
    plans = {
        "2c-threshold|2-model": {"classes": [("pred", "pred")], "exact": (), "marks": {}},
        "3-prediction": {"classes": [("pred", "pred")], "exact": (), "marks": {"pred": comps["n_pred"]}},
        "4-ground-truth": verdict_plan,
        "5-accuracy": verdict_plan,
    }
    for beat_alts, plan in plans.items():
        beat = next(b for b in beat_alts.split("|") if (cap / f"hold-{slot}-{b}.png").exists())
        png = cap / f"hold-{slot}-{beat}.png"
        meta = json.loads(png.with_suffix(".json").read_text())
        img = np.asarray(Image.open(png).convert("RGB")).astype(np.int16)
        Hs, Ws = img.shape[:2]
        L = meta["layout"]
        assert abs(L["scale"] - 1.0) < 1e-9, "G7 assumes the layer is drawn at 1:1"
        ai = L["angleIndex"]
        lay_bits = mask_png(case_dir, ai)
        H, W = lay_bits.shape
        ox, oy = int(L["originX"]), int(L["originY"])
        crop = img[oy:oy + H, ox:ox + W]
        assert crop.shape[:2] == (H, W), "layer runs off the stage"
        excl_stage = np.zeros((Hs, Ws), bool)
        for mk in meta["marks"]:
            excl_stage |= marker_zone(mk["shape"], mk["x"] - 0.5, mk["y"] - 0.5, mk["r"], Hs, Ws,
                                      pad=mk.get("stroke", 6) / 2 + 2.5)
        excl = excl_stage[oy:oy + H, ox:ox + W]
        col = meta["colours"]
        res = {}
        names = [c for c, _ in plan["classes"]]
        for ci, (layer_name, colour_key) in enumerate(plan["classes"]):
            ref = np.array(col[colour_key], dtype=np.int16)
            drawn_all = np.abs(crop - ref).max(axis=-1) <= 2
            drawn = drawn_all & ~excl
            in_layer = ((lay_bits >> bits[layer_name]) & 1).astype(bool)
            for later in names[ci + 1:]:
                in_layer &= ~((lay_bits >> bits[later]) & 1).astype(bool)
            truth = in_layer & ~excl
            mism = int((drawn != truth).sum())
            res[layer_name] = {"iou": iou(drawn, truth), "mismatched_pixels_outside_markers": mism,
                               "pixels_drawn": int(drawn.sum()), "pixels_layer": int(truth.sum()),
                               "layer_pixels_under_markers": int((in_layer & excl).sum())}
            ok &= mism == 0
            if layer_name in plan["exact"]:
                # marker paint is cut away over these fills: every pixel exact, markers or not
                wrong = int((in_layer & ~drawn_all).sum())
                res[layer_name]["layer_pixels_not_exact_anywhere"] = wrong
                ok &= wrong == 0
            # every error lesion must show at least one pixel of its own colour somewhere
            if layer_name in ("missed_gt", "fa_pred"):
                lab, n = (gl, ngt) if layer_name == "missed_gt" else (pl, npred)
                want = "missed" if layer_name == "missed_gt" else "false_alarm"
                group = comp_json["gt"] if layer_name == "missed_gt" else comp_json["pred"]
                ids = [o["id"] for o in group if o["verdict"] == want]
                fps = component_footprints(lab, n, lay, ai, n_ang) if ids else {}
                vis = {str(i): int((fps[i] & drawn_all).sum()) for i in ids}
                res[layer_name]["own_colour_pixels_per_component"] = vis
                ok &= all(x >= 1 for x in vis.values())
        counts = {}
        painted = {}
        for kind, n_expected in plan["marks"].items():
            mks = [m for m in meta["marks"] if m["kind"] == kind]
            counts[kind] = {"drawn": len(mks), "components": n_expected}
            ok &= len(mks) == n_expected
            ck = {"pred": "pred", "found": "found", "missed": "missed", "fa": "falseAlarm"}[kind]
            ref = np.array(col[ck], dtype=np.int16)
            good = occluded = dimmed = 0
            for m in mks:
                if m.get("alpha", 1) < 0.9:
                    dimmed += 1          # deliberately faded: counted, not colour-tested
                    continue
                xs, ys = ring_samples(m["shape"], m["x"] - 0.5, m["y"] - 0.5, m["r"])
                xi = np.clip(np.round(xs).astype(int), 0, Ws - 1)
                yi = np.clip(np.round(ys).astype(int), 0, Hs - 1)
                free = np.ones(len(xi), bool)
                later = meta["marks"][meta["marks"].index(m) + 1:]
                for o in later:
                    d = ring_distance(o["shape"], np.abs(xi + 0.5 - o["x"]), np.abs(yi + 0.5 - o["y"]))
                    free &= np.abs(d - o["r"]) > o.get("stroke", 6) / 2 + 1.5
                if not free.any():
                    occluded += 1
                    good += 1
                    continue
                near = np.zeros(int(free.sum()), bool)
                for oy_ in range(-2, 3):
                    for ox_ in range(-2, 3):
                        yy_ = np.clip(yi[free] + oy_, 0, Hs - 1)
                        xx_ = np.clip(xi[free] + ox_, 0, Ws - 1)
                        near |= np.abs(img[yy_, xx_] - ref).max(axis=-1) <= 40
                good += near.mean() >= (0.4 if m["shape"] == "square" else 0.5)
            painted[kind] = {"full_strength_markers_painted": int(good), "full_strength": len(mks) - dimmed,
                             "dimmed": dimmed, "fully_overdrawn": occluded}
            ok &= good == len(mks) - dimmed
        out[beat] = {"angle_index": ai, "origin": [ox, oy], "classes": res,
                     "marker_counts": counts, "marker_paint": painted}
    summary = {b: {k: v["mismatched_pixels_outside_markers"] for k, v in r["classes"].items()} for b, r in out.items()}
    return report(case_dir, "G7", ok, {"slot": slot, "capture": str(cap), "summary": summary, "detail": out,
                                       "pass_rule": "0 mismatched pixels per class outside marker strokes "
                                                    "(beat 2b thresholded map, beat 3 prediction, beats 4-5 "
                                                    "verdict fills, later class winning where classes overlap); "
                                                    "missed and false-alarm fills exact everywhere, under markers "
                                                    "too; every missed lesion and false alarm shows >= 1 pixel of "
                                                    "its colour; marker count == component count per verdict; "
                                                    "every full-strength marker painted in its class colour"})


# ----------------------------------------------------------------------------- G8: numbers on screen
def check_source(entry, mamba, portfolio, man):
    """Does the entry's source file contain its value? Returns (ok, how)."""
    import re
    src, where, value = entry["source"], entry["where"], entry["value"]
    if src.endswith(".csv"):
        m = re.match(r"line (\d+): .* column (\w+)$", where)
        line, column = int(m.group(1)), m.group(2)
        with open(mamba / src, newline="") as f:
            rows = list(csv.reader(f))
        header, row = rows[0], rows[line - 1]
        got = csv_value(row[header.index(column)])
        case = re.search(r"case_id=([^,]+)", where).group(1)
        return got == value and row[header.index("case_id")] == case, f"{src} line {line} {column} = {got!r}"
    if src.endswith(".json") and "test_summary" in src:
        root_d = json.loads((mamba / src).read_text())

        def lookup(path):
            d = root_d
            parts = path.split(".")
            while parts:   # keys may contain dots (thr0.5_min10): take the shortest prefix that exists
                for j in range(1, len(parts) + 1):
                    k = ".".join(parts[:j])
                    if isinstance(d, dict) and k in d:
                        d = d[k]
                        parts = parts[j:]
                        break
                else:
                    return None
            return d

        # a sum of key paths ("a + b") is checked as the sum of their values
        got = [lookup(p.strip()) for p in where.split(" + ")]
        if any(g is None for g in got):
            return False, f"{src}: no key path in {where}"
        total = got[0] if len(got) == 1 else sum(got)
        return total == value, f"{src} {where} = {total!r}"
    if src.endswith("baseline.yaml"):
        import yaml
        d = yaml.safe_load((mamba / src).read_text())
        for k in where.split(" ")[0].split("."):
            d = d[k]
        return d == value, f"{src} {where.split(' ')[0]} = {d!r}"
    if src.endswith("inference.py"):
        txt = (mamba / src).read_text()
        hit = re.search(r"^DEFAULT_OVERLAP\s*=\s*([0-9.]+)", txt, re.M)
        return hit and float(hit.group(1)) == value, f"{src} DEFAULT_OVERLAP = {hit.group(1) if hit else None}"
    if src.endswith(".md"):
        txt = (mamba / src).read_text(encoding="utf-8")
        probes = {"method.threshold": ("| Threshold |", "0.5"), "method.min_voxels": ("| Size filter |", "min_voxels=10"),
                  "method.min_voxels_ml": ("| ours, ", "0.124 mL"),
                  "method.n_models": ("| Combination |", "five-model ensemble")}
        anchor, needle = probes[entry["key"]]
        line = next((ln for ln in txt.splitlines() if anchor in ln), "")
        return needle in line, f"{src}: line with '{anchor}' contains '{needle}': {needle in line}"
    if src.endswith("cases.json"):
        d = json.loads((portfolio / src).read_text())
        c = next(c for c in d["cases"] if c["case_id"] == man["case_id"])
        name = entry["key"].split(".", 1)[1]
        return c["rule_numbers"][name] == value, f"{src} rule_numbers.{name} = {c['rule_numbers'][name]}"
    if src == "derived":
        if entry["key"] == "method.n_windows":
            shape = man["layer"]["shape_zyx"]
            roi = json.loads((Path(man["_dir"]) / "windows.json").read_text())["roi_zyx"]
            n = 1
            for size, r in zip(shape, roi):
                interval = int(r * (1 - 0.5))   # MONAI _get_scan_interval at overlap 0.5
                num = math.ceil(size / interval)
                dim = next(d for d in range(num) if d * interval + r >= size)
                n *= dim + 1
            return n == value, f"recomputed from shape {shape}, roi {roi}, overlap 0.5: {n}"
        if entry["key"] == "case.pred_components_touching":
            nums = {e["key"]: e["value"] for e in man["numbers"]}
            v = nums["case.n_pred"] - nums["case.fp"]
            return v == value, f"n_pred - fp = {v}"
    return False, f"no checker for source {src}"


def gate_numbers(args):
    import re
    case = args.case
    case_dir = Path(args.data_dir) / case
    cap = Path(args.capture)
    holds = json.loads((cap / "holds.json").read_text())
    slot = next(s for s, cid in holds["caseIds"].items() if cid == case)
    man = load_manifest(case_dir)
    man["_dir"] = str(case_dir)
    entries = {e["key"]: e for e in man["numbers"]}
    mamba = Path(args.mamba_repo)
    # a number token: digits with optional thousands separators and decimals ("4,554", "84.3")
    tok = re.compile(r"(?<![A-Za-z0-9.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![A-Za-z0-9])|"
                     r"(?<![A-Za-z0-9.,])\d+(?:\.\d+)?(?![A-Za-z0-9])")
    problems = []
    used = set()
    seen = []
    for h in holds["holds"]:
        if h["slot"] != slot:
            continue
        meta = json.loads((cap / h["png"]).with_suffix(".json").read_text())
        for t in meta["texts"]:
            visible = t.get("visible", True)
            for m in tok.finditer(t["text"]):
                token = m.group(0)
                seen.append({"beat": h["beat"], "token": token, "key": t["key"], "visible": visible})
                if t["key"] == "counter.window":
                    # the sliding-window position counter: at a hold it must read the window the
                    # timeline is on (floor(win) + 1, clamped to 1..n_windows), never more
                    n_win = entries["method.n_windows"]["value"]
                    want = str(min(n_win, max(1, int(math.floor(meta["state"]["win"])) + 1)))
                    used.add("method.n_windows")
                    if visible and token != want:
                        problems.append(f"{h['beat']}: window counter shows {token}, timeline state says {want}")
                    continue
                e = entries.get(t["key"]) if t["key"] else None
                if e is None:
                    problems.append(f"{h['beat']}: '{token}' in '{t['text'].strip()}' has no manifest key")
                    continue
                used.add(t["key"])
                # hidden counters may sit at their start value; what is shown must be the value
                if visible and token not in tok.findall(e["display"]):
                    problems.append(f"{h['beat']}: visible '{token}' is not the manifest display "
                                    f"'{e['display']}' of {e['key']}")
    sources = {}
    for k in sorted(used):
        okk, how = check_source(entries[k], mamba, PORTFOLIO, man)
        sources[k] = {"ok": bool(okk), "check": how, "display": entries[k]["display"]}
        if not okk:
            problems.append(f"source check failed for {k}: {how}")
    ok = not problems
    return report(case_dir, "G8", ok, {"slot": slot,
                                       "pass_rule": "every number in the stage DOM is bound to a manifest key "
                                                    "(or is the window position counter, which must equal the "
                                                    "timeline's window at the hold); every number visible at a beat "
                                                    "hold equals that key's display value; every key's source file "
                                                    "contains the value",
                                       "summary": {"numbers_in_dom": len(seen),
                                                                   "visible_at_holds": sum(1 for x in seen if x["visible"]),
                                                                   "keys": len(used), "problems": len(problems)},
                                       "problems": problems, "sources": sources, "tokens": seen})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=("data", "frames", "numbers"))
    ap.add_argument("--case", required=True)
    ap.add_argument("--data-dir", default=str(PORTFOLIO / "motion-data"))
    ap.add_argument("--mamba-repo", default=str(DEFAULT_MAMBA))
    ap.add_argument("--probs-dir", default=str(Path.home() / "psma/run5-test-probs"))
    ap.add_argument("--cache-dir", default=str(Path.home() / "psma/psma-cache-run5-test"))
    ap.add_argument("--capture", help="folder written by `capture.mjs holds` (G7, G8)")
    ap.add_argument("--quick", action="store_true", help="G2: regenerate every 9th angle only")
    args = ap.parse_args()
    if args.what == "data":
        ok = gate_data(args)
    elif args.what == "frames":
        ok = gate_frames(args)
    else:
        ok = gate_numbers(args)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
