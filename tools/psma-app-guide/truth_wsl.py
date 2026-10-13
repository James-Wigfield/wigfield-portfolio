#!/usr/bin/env python3
"""
PSMA APP GUIDE -- what the app should have shown, recomputed (runs in WSL, `mamba` env).

For each saved run the film shows, this calls the app's own functions, read only, on the files
the app wrote: gui.viz.score_prediction (the result card), gui.viz.load_pair + load_mask +
lesion_rows (the lesion list, on the display grid the viewer indexes), and the run's
<case>_predict.json (predicted count, volume, timings). Gate G2 compares this with the text
captured from the app. Mamba_PSMA is never written to (no __pycache__ either).

It also places each lesion on the coronal slice through its centre (the slice the app opens
when its row is picked): where the lesion's own colour shows on that slice, as fractions of the
drawn slice image (u across, v down; the app flips coronal slices so the head is up and
stretches them to their true proportions, so fractions carry over to the screen unchanged).
The stage rings lesions from this, never by eye.

    PYTHONDONTWRITEBYTECODE=1 ~/miniconda3/envs/mamba/bin/python -B \
        tools/psma-app-guide/truth_wsl.py --out motion-data/app-guide/truth.json
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

sys.dont_write_bytecode = True
MAMBA = Path("/mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA")
sys.path.insert(0, str(MAMBA))
from evaluation.metrics import connected_components  # noqa: E402
from gui.viz import (FALSE_ALARM, FOUND, MISSED, case_paths, comparison_map, lesion_rows,  # noqa: E402
                     load_mask, load_pair, score_prediction)

DATASET = Path("/mnt/c/Users/james/Documents/university/cits4010/datasets/PSMA-PET-CT-Lesions_v3")
PRED = MAMBA / "outputs" / "gui-predictions"
CLASS = {"found": FOUND, "missed": MISSED, "false alarm": FALSE_ALARM, None: 1}


def place(rows, pred, gt):
    """Each row's lesion on the coronal slice through its centre: the bbox (u0, v0, u1, v1) of
    the overlay colour it shows there and that colour's class, as fractions of the slice image."""
    pred = np.asarray(pred) > 0
    classes = comparison_map(pred, gt)[0] if gt is not None else pred.astype(np.uint8)
    plab, _ = connected_components(pred)
    glab, _ = connected_components(np.asarray(gt) > 0) if gt is not None else (None, 0)
    Z, Y, X = pred.shape
    for r in rows:
        z, y, x = r["centre"]
        own = glab if r["status"] == "missed" else plab
        # the row's lesion: the component of the row's size nearest its centre (sizes can tie)
        ids, sizes = np.unique(own[own > 0], return_counts=True)
        comp = min(ids[sizes == r["voxels"]], key=lambda c: _dist(own == c, (z, y, x)))
        mine = (own == comp)[:, y, :][::-1]                       # (Z, X), head up, as the app draws it
        colour = (classes[:, y, :][::-1] == CLASS[r["status"]])
        lab2, _ = ndimage.label(colour)
        parts = [k for k in np.unique(lab2[mine & colour]) if k]
        region = np.isin(lab2, parts) if parts else mine
        on_slice = bool(mine.any())
        if not region.any():
            region = (own == comp).any(axis=1)[::-1]           # nothing on this slice: its projection
        vs, us = np.nonzero(region)
        r["coronal"] = {"slice": y, "on_slice": on_slice, "centre_uv": [(x + 0.5) / X, (Z - 1 - z + 0.5) / Z],
                        "bbox_uv": [us.min() / X, vs.min() / Z, (us.max() + 1) / X, (vs.max() + 1) / Z],
                        "grid_zx": [Z, X]}
    return rows


def _dist(m, p):
    zz, yy, xx = np.nonzero(m)
    return float(((zz - p[0]) ** 2 + (yy - p[1]) ** 2 + (xx - p[2]) ** 2).min())


def one(case, folder, with_label=True):
    images, labels = DATASET / "imagesTr", DATASET / "labelsTr"
    ct, pet, label = case_paths(images, case, labels)
    if not with_label:
        label = None
    mask = folder / f"{case}.nii.gz"
    meta = json.loads((folder / f"{case}_predict.json").read_text())
    out = {"folder": str(folder.relative_to(MAMBA)), "mask": mask.name,
           "predict_json": {k: meta.get(k) for k in ("written", "repo_commit", "timing_s", "peak_vram_gib", "gpu")},
           "output": meta.get("output"), "rule": meta.get("rule")}
    if label is not None:
        out["scores"] = score_prediction(mask, label)
    pair = load_pair(ct, pet, label)
    pred = load_mask(mask, pet)
    rows = lesion_rows(pred, pair["label"], pair["pet"], pair["spacing"])
    rows = [{**r, "centre": list(r["centre"])} for r in rows]
    out["lesions"] = place(rows, pred, pair["label"])
    out["n_gt"] = pair["n_lesions"]
    out["spacing"] = list(pair["spacing"])
    out["shape_zyx"] = list(pair["pet"].shape)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", default="psma_35852148926fc57d_2018-03-23")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    res = {"case": a.case, "runs": {}}
    base = PRED / a.case
    if (base / f"{a.case}.nii.gz").is_file():
        res["runs"]["protocol"] = one(a.case, base)
    for d in sorted((base / "custom").glob("*")) if (base / "custom").is_dir() else []:
        res["runs"][f"custom/{d.name}"] = one(a.case, d)
    for d in sorted((PRED / "single").glob(f"{a.case}-*")) if (PRED / "single").is_dir() else []:
        res["runs"][f"single/{d.name}"] = one(a.case, d, with_label=False)
    Path(a.out).write_text(json.dumps(res, indent=1, default=float))
    for k, v in res["runs"].items():
        s = v.get("scores") or {}
        print(k, {x: s.get(x) for x in ("tp", "fp", "fn", "f1", "sensitivity", "ppv", "dsc")}, len(v["lesions"]), "rows")
        for r in v["lesions"][:6]:
            print("   ", r["status"], r["voxels"], r["centre"], [round(t, 3) for t in r["coronal"]["bbox_uv"]],
                  "on slice" if r["coronal"]["on_slice"] else "NOT on its centre slice")


if __name__ == "__main__":
    main()
