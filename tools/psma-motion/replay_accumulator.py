#!/usr/bin/env python3
"""
PSMA motion graphics -- stretch goal: replay fold 0's sliding window and snapshot the
real accumulator (runs in WSL, `mamba` env, GPU).

Beat 2 reveals the probability map window by window. Without this script that reveal is
a metaphor (the final fold-0 map shown inside the windows processed so far). This script
re-runs fold 0's checkpoint over the case with a loop that copies MONAI's
sliding_window_inference exactly: the same dense_patch_slices order, batches of
sw_batch_size, the same compute_importance_map (gaussian, sigma 0.125), the same
weighted-logit accumulation. After every window (MONAI adds a batch's windows to the
accumulator one at a time, in order) it stores the running estimate
sigmoid(sum(w * logits) / sum(w)) as an anterior MIP, so the stage can show exactly the
windows its counter has reached.

The replay is accepted only if its final map matches the saved fold-0 map from the home
reproduction: max |difference| <= 1e-3 and thresholded (> 0.5) voxel count within 0.1 %.
Otherwise nothing is written and the module keeps the metaphor.

    PYTHONDONTWRITEBYTECODE=1 ~/miniconda3/envs/mamba/bin/python \
        tools/psma-motion/replay_accumulator.py --case psma_7e25beff54698eb8_2021-06-21
"""

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
PORTFOLIO = HERE.parent.parent
DEFAULT_MAMBA = Path("/mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", required=True)
    ap.add_argument("--fold", type=int, default=0)
    ap.add_argument("--mamba-repo", default=str(DEFAULT_MAMBA))
    ap.add_argument("--probs-dir", default=str(Path.home() / "psma/run5-test-probs"))
    ap.add_argument("--cache-dir", default=str(Path.home() / "psma/psma-cache-run5-test"))
    ap.add_argument("--out", default=str(PORTFOLIO / "motion-data"))
    args = ap.parse_args()
    mamba = Path(args.mamba_repo)
    sys.path.insert(0, str(mamba))
    sys.path.insert(0, str(HERE))
    import torch
    import torch.nn.functional as F
    from PIL import Image
    from monai.data.utils import compute_importance_map, dense_patch_slices
    from monai.inferers.utils import _get_scan_interval
    from evaluation.inference import load_model, _make_predictor, DEFAULT_OVERLAP, DEFAULT_SW_BATCH
    import export_motion_data as ex

    case_dir = Path(args.out) / args.case
    man = json.loads((case_dir / "manifest.json").read_text())
    lay = man["layer"]
    geom = ex.Geometry(lay["shape_zyx"], lay["spacing_zyx_mm"], (lay["crop_y"], lay["crop_x"]), lay["scale"])
    dev = torch.device("cuda")
    t0 = time.time()

    ckpt = mamba / f"checkpoints/run5/fold{args.fold}/checkpoint_best.pth"
    model, cfg = load_model(str(ckpt), device=dev)
    roi = tuple(int(v) for v in cfg["patch_sampling"]["patch_size"])
    amp_dtype = getattr(torch, cfg.get("training", {}).get("amp_dtype", "bfloat16"))
    predictor = _make_predictor(model, True, amp_dtype, True, tta=False)

    image = np.load(Path(args.cache_dir) / f"{args.case}.npz")["image"].astype(np.float32)
    x = torch.from_numpy(image)[None].to(dev)                      # (1, 2, Z, Y, X)
    size = tuple(x.shape[2:])
    interval = _get_scan_interval(size, roi, 3, (DEFAULT_OVERLAP,) * 3)
    slices = dense_patch_slices(size, roi, interval)
    w = compute_importance_map(roi, mode="gaussian", sigma_scale=0.125, device=dev, dtype=torch.float32)[None, None]
    acc = torch.zeros((1, 1) + size, device=dev, dtype=torch.float32)
    cnt = torch.zeros((1, 1) + size, device=dev, dtype=torch.float32)

    (yy0, yy1), (xx0, xx1) = lay["crop_y"], lay["crop_x"]
    snaps = []
    with torch.no_grad():
        for b in range(0, len(slices), DEFAULT_SW_BATCH):
            batch = slices[b:b + DEFAULT_SW_BATCH]
            win = torch.cat([x[(slice(None), slice(None)) + tuple(s)] for s in batch])
            out = predictor(win) * w
            for p, s in zip(out, batch):
                acc[(slice(None), slice(None)) + tuple(s)] += p
                cnt[(slice(None), slice(None)) + tuple(s)] += w[0]
                # running estimate where any window has landed, 0 elsewhere
                est = torch.where(cnt > 0, torch.sigmoid(acc / cnt.clamp_min(1e-12)), torch.zeros_like(acc))
                crop = est[:, :, :, yy0:yy1, xx0:xx1]
                mip = ex.mip_angle(crop, geom, 0.0, torch, F)[0].cpu().numpy()
                snaps.append(ex.to_u8(mip, 0.0, 1.0))
    final = torch.sigmoid(acc / cnt).cpu().numpy()[0, 0]
    saved = np.load(Path(args.probs_dir) / f"fold{args.fold}" / f"{args.case}.npz")["prob"]
    max_abs = float(np.abs(final - saved).max())
    n_rep = int((final > 0.5).sum())
    n_saved = int((saved > 0.5).sum())
    rel = abs(n_rep - n_saved) / max(1, n_saved)
    accept = max_abs <= 1e-3 and rel <= 1e-3
    report = {"case": args.case, "fold": args.fold, "windows": len(slices),
              "batches": -(-len(slices) // DEFAULT_SW_BATCH), "snapshots": len(snaps),
              "snapshot_after": "every window (acc_NNN.png = the estimate once windows 0..NNN are in)",
              "max_abs_difference": max_abs, "voxels_above_0.5_replay": n_rep, "voxels_above_0.5_saved": n_saved,
              "relative_count_difference": rel, "accepted": accept,
              "rule": "accept if max |diff| <= 1e-3 and thresholded count within 0.1 %",
              "seconds": round(time.time() - t0, 1)}
    print(json.dumps(report, indent=1))
    adir = case_dir / "accum"
    adir.mkdir(exist_ok=True)
    for old in adir.glob("*.png"):
        old.unlink()
    (adir / "report.json").write_text(json.dumps(report, indent=1))
    if accept:
        for i, im in enumerate(snaps):
            Image.fromarray(im, mode="L").save(adir / f"acc_{i:03d}.png")
    sys.exit(0 if accept else 2)


if __name__ == "__main__":
    main()
