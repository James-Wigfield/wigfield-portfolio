#!/usr/bin/env python3
"""
PSMA motion graphics -- per-case data export (runs in WSL, `mamba` conda env).

Builds everything the /portal/psma-motion module draws for ONE run 5 test case:
the rotating PET / CT / probability MIPs, the lossless mask layers, per-component
data at every angle, the sliding-window rectangles and the anterior extras for
the "running the model" beat. Output goes to wigfield-portfolio/motion-data/<case>/,
which is gitignored and only ever served by the dev-only Vite middleware.

    PYTHONDONTWRITEBYTECODE=1 ~/miniconda3/envs/mamba/bin/python \
        tools/psma-motion/export_motion_data.py --case psma_7e25beff54698eb8_2021-06-21 --slot A

Nothing here re-implements scoring. The ensemble, threshold, size filter and
lesion counts are the Mamba_PSMA code the run of record used
(scripts/sweep_threshold.py lines ~311-366, evaluation/metrics.py), imported
read-only from --mamba-repo. The export refuses to write anything if the
recomputed counts disagree with either per-case CSV.

Geometry (all recorded in manifest.json):
  * cache grid: (Z, Y, X) at (3.0, 2.0364, 2.0364) mm, LAS -- x to the patient's
    left, y to anterior, z to superior (checked here against the organ labels).
  * the body turns about the head-to-foot axis through a voxel corner (cy, cx).
    X = (x + 0.5 - cx) * 2.0364 mm, Y = (y + 0.5 - cy) * 2.0364 mm.
    Screen column coordinate u = X cos t + Y sin t, depth w = X sin t - Y cos t
    (w grows away from the viewer). t = 0 is the anterior view with the
    patient's right on the viewer's left; t = 90 looks at the patient's right side.
  * layer pixel (row r, col j) has centre u = -R + (j + 0.5) p and
    Z = z_top - (r + 0.5) p, with p = 2.0364 / scale mm.
  * masks are never resampled: each voxel's exact orthographic footprint (an
    axis-aligned rectangle once rotated about z) is rasterised by the pixel-centre
    rule, so every voxel lands in at least one pixel at every angle.
"""

import argparse
import csv
import datetime as _dt
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # Mamba_PSMA is read only: no __pycache__ in it

HERE = Path(__file__).resolve().parent
PORTFOLIO = HERE.parent.parent
DEFAULT_MAMBA = Path("/mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA")

# Run of record and home reproduction, per-case rows (threshold 0.5, 10-voxel filter).
CSV_DEMETER = "evaluation/results/run5-test/ensemble/ensemble5_test_threshold_sweep_per_case.csv"
CSV_HOME = "evaluation/results/run5-test-home/ensemble/ensemble5_test_threshold_sweep_per_case.csv"
TEST_SUMMARY = "evaluation/results/run5-test/test_summary.json"
PROTOCOL_DOC = "hpc-documentation/run5-cv-results-and-test-protocol.md"

THRESHOLD = 0.5
MIN_VOXELS = 10

# 8-bit storage windows for the RGB frame channels. The display window is applied
# later in the shader; these only bound what can be shown.
PET_STORE = (1.0433, 12.0)       # SUV; 1.0433 is the cache's PET clip floor
CT_STORE = (-832.0627, 1127.7585)  # HU; the cache's CT clip bounds (baseline.yaml)
BONE_WINDOW = (150.0, 1100.0)      # HU mapped to 0..1 for the CT bone layer
BONE_DEPTH_ALPHA = 0.6             # depth cue on the bone layer only (see mip_angle)
THICK_MAX_MM = 600.0               # body path length mapped to the alpha channel's 0..255

# Bit layout of frames/mask_NNN.png (one byte per pixel).
BITS = {
    "pred": 0,          # final prediction (threshold 0.5, components >= 10 voxels)
    "gt": 1,            # ground truth
    "found_gt": 2,      # ground-truth lesions that any predicted voxel touches (TP)
    "missed_gt": 3,     # ground-truth lesions no predicted voxel touches (FN)
    "touch_pred": 4,    # predicted components that touch a ground-truth voxel
    "fa_pred": 5,       # predicted components that touch no ground-truth voxel (FP)
    "removed": 6,       # components of (prob > 0.5) under 10 voxels, removed by the filter
}   # bit 7 is unused, so every mask PNG is reproducible from the saved masks alone (G2)

ORGAN_NAMES = {0: "background", 1: "spleen", 2: "kidneys", 3: "liver", 4: "urinary bladder",
               5: "lungs", 6: "brain", 7: "heart", 8: "stomach", 9: "prostate", 10: "skull",
               11: "sacrum", 12: "lumbar spine", 13: "thoracic spine", 14: "cervical spine",
               15: "clavicle", 16: "scapula", 17: "sternum", 18: "ribs", 19: "humerus",
               20: "femur", 21: "hips", 22: "gluteus maximus", 23: "parotid gland",
               24: "submandibular gland"}

# Beat 1 labels: organs whose tracer uptake is normal, pointed at in the anterior view.
# (display name, organ classes, side of the body the label sits on in the anterior view:
# the liver is on the patient's right, i.e. the viewer's left; bilateral organs are labelled
# on the viewer's right.)
LABEL_ORGANS = [("salivary glands", (23, 24), "right"), ("liver", (3,), "left"),
                ("kidneys", (2,), "right"), ("bladder", (4,), "right")]
LABEL_MIN_SUV = 5.0      # an organ is labelled only where its uptake is clearly bright on the MIP
LABEL_CLEAR_PX = 6       # and the anchor keeps this far from any lesion or predicted region
LABEL_EDGE_ROWS = 16     # and stays out of the feathered first and last rows


# ----------------------------------------------------------------------------- helpers
def sha256_file(path, chunk=1 << 22):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def sha256_array(a):
    """Content hash of an array: dtype, shape and C-order bytes (npz files carry zip timestamps)."""
    a = np.ascontiguousarray(a)
    h = hashlib.sha256()
    h.update(f"{a.dtype.str}|{a.shape}|".encode())
    h.update(a.tobytes())
    return h.hexdigest()


def rel(path, root):
    try:
        return str(Path(path).resolve().relative_to(Path(root).resolve()))
    except ValueError:
        return str(path)


def read_case_rows(csv_path, case_id):
    """{min_voxels: row} for the case at threshold 0.5, expansion and splitting off."""
    out = {}
    with open(csv_path, newline="") as f:
        for i, r in enumerate(csv.DictReader(f), start=2):  # line 1 is the header
            if (r["case_id"] == case_id and float(r["threshold"]) == THRESHOLD
                    and r["expand"] == "False" and r["split"] == "False"):
                r = dict(r)
                r["_line"] = i
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


def pct1(x):
    return f"{100 * x:.1f}"


# ----------------------------------------------------------------------------- geometry
class Geometry:
    """Everything that maps cache voxels to layer pixels (see the module docstring)."""

    def __init__(self, shape_zyx, spacing_zyx, crop_yx, scale):
        self.Zn, self.Yn, self.Xn = (int(v) for v in shape_zyx)
        self.sz, self.sy, self.sx = (float(v) for v in spacing_zyx)
        assert abs(self.sy - self.sx) < 1e-9, "in-plane spacing must be square"
        self.s = self.sx
        (self.y0, self.y1), (self.x0, self.x1) = crop_yx
        self.scale = int(scale)
        self.p = self.s / self.scale                       # layer pixel pitch, mm
        # rotation axis on a voxel corner, so pixel edges meet voxel edges at the quarter turns
        self.cy = int(round((self.y0 + self.y1) / 2))
        self.cx = int(round((self.x0 + self.x1) / 2))
        rmax = max(math.hypot(y - self.cy, x - self.cx)
                   for y in (self.y0, self.y1) for x in (self.x0, self.x1))
        self.Rv = int(math.ceil(rmax))                      # radius, in voxels
        self.R = self.Rv * self.s                           # radius, mm
        self.W = 2 * self.Rv * self.scale
        self.z_top = self.Zn * self.sz
        # rows whose centre lies inside the volume: Z = z_top - (r + 0.5) p >= 0
        self.H = int(math.floor(self.z_top / self.p + 0.5))

    def as_dict(self):
        return {
            "shape_zyx": [self.Zn, self.Yn, self.Xn],
            "spacing_zyx_mm": [self.sz, self.sy, self.sx],
            "crop_y": [self.y0, self.y1], "crop_x": [self.x0, self.x1],
            "centre_edge_yx": [self.cy, self.cx],
            "radius_voxels": self.Rv, "radius_mm": self.R,
            "scale": self.scale, "pixel_mm": self.p,
            "width": self.W, "height": self.H, "z_top_mm": self.z_top,
            "pixel_centre": "u = -R + (j + 0.5) * pixel_mm ; Z = z_top - (r + 0.5) * pixel_mm",
            "voxel_centre": "X = (x + 0.5 - cx) * s ; Y = (y + 0.5 - cy) * s ; Z = (z + 0.5) * sz",
            "rotation": "u = X cos(t) + Y sin(t) ; w = X sin(t) - Y cos(t) ; w grows away from the viewer",
        }

    # -- voxels -> mm
    def voxel_mm(self, zz, yy, xx):
        X = (xx + 0.5 - self.cx) * self.s
        Y = (yy + 0.5 - self.cy) * self.s
        Z = (zz + 0.5) * self.sz
        return X, Y, Z

    def splat(self, zz, yy, xx, theta_deg):
        """
        Exact orthographic footprint of every voxel at angle theta, by the pixel-centre rule.
        Returns (rows, cols, index-into-input) for every covered pixel (with repeats).
        """
        zz = np.asarray(zz, dtype=np.float64)
        yy = np.asarray(yy, dtype=np.float64)
        xx = np.asarray(xx, dtype=np.float64)
        th = math.radians(theta_deg)
        c, s_ = math.cos(th), math.sin(th)
        X = (xx + 0.5 - self.cx) * self.s
        Y = (yy + 0.5 - self.cy) * self.s
        uc = X * c + Y * s_
        hw = 0.5 * self.s * (abs(c) + abs(s_))
        # columns whose centre lies in [uc - hw, uc + hw)
        jlo = np.ceil((uc - hw + self.R) / self.p - 0.5).astype(np.int64)
        jhi = np.ceil((uc + hw + self.R) / self.p - 0.5).astype(np.int64) - 1
        # rows whose centre Z lies in [z sz, (z + 1) sz)
        lo = (self.z_top - (zz + 1) * self.sz) / self.p - 0.5
        hi = (self.z_top - zz * self.sz) / self.p - 0.5
        rlo = np.floor(lo).astype(np.int64) + 1
        rhi = np.floor(hi).astype(np.int64)
        ncol = int(math.ceil(2 * hw / self.p)) + 1
        nrow = int(math.ceil(self.sz / self.p)) + 1
        idx = np.arange(len(zz))
        R_, C_, I_ = [], [], []
        for dr in range(nrow):
            r = rlo + dr
            okr = r <= rhi
            for dc in range(ncol):
                j = jlo + dc
                ok = okr & (j <= jhi)
                R_.append(r[ok]); C_.append(j[ok]); I_.append(idx[ok])
        rows = np.concatenate(R_); cols = np.concatenate(C_); ii = np.concatenate(I_)
        keep = (rows >= 0) & (rows < self.H) & (cols >= 0) & (cols < self.W)
        if not keep.all():
            raise AssertionError(f"{(~keep).sum()} footprint pixels fell outside the layer")
        # every voxel must own at least one pixel (lossless across rotation)
        if len(zz) and np.bincount(ii, minlength=len(zz)).min() == 0:
            raise AssertionError("a voxel produced an empty footprint")
        return rows, cols, ii

    def window_rect(self, z_s, y_s, x_s, roi):
        """A sliding window's extent in the anterior (t = 0) view, layer pixels, plus depth in mm."""
        dz, dy, dx = roi
        j0 = (x_s - self.cx) * self.scale + self.Rv * self.scale
        j1 = (x_s + dx - self.cx) * self.scale + self.Rv * self.scale
        r_top = (self.z_top - (z_s + dz) * self.sz) / self.p
        r_bot = (self.z_top - z_s * self.sz) / self.p
        w_near = -((y_s + dy) - self.cy) * self.s   # t = 0: w = -Y
        w_far = -(y_s - self.cy) * self.s
        return {"col0": j0, "col1": j1, "row0": r_top, "row1": r_bot,
                "depth_mm": [w_near, w_far]}


# ----------------------------------------------------------------------------- MIPs (GPU)
def mip_angle(vol, geom, theta_deg, torch, F, chunk=24, depth_weight=None, sum_channels=()):
    """
    Trilinear-sampled maximum-intensity projection of a (1, C, Z, Yc, Xc) cuda tensor.
    depth_weight: optional {channel: alpha}; that channel's samples are multiplied by
    1 - alpha * (w + R) / 2R before the max, so structures nearer the viewer read brighter.
    sum_channels: channels projected as a path integral (sum * step, in mm) instead of a max.
    """
    dev = vol.device
    C = vol.shape[1]
    Zc, Yc, Xc = vol.shape[2:]
    th = math.radians(theta_deg)
    c, s_ = math.cos(th), math.sin(th)
    u = -geom.R + (torch.arange(geom.W, device=dev, dtype=torch.float64) + 0.5) * geom.p
    w = -geom.R + (torch.arange(geom.W, device=dev, dtype=torch.float64) + 0.5) * geom.p
    X = u[:, None] * c + w[None, :] * s_
    Y = u[:, None] * s_ - w[None, :] * c
    xi = geom.cx + X / geom.s - 0.5 - geom.x0
    yi = geom.cy + Y / geom.s - 0.5 - geom.y0
    gx = (2 * xi / (Xc - 1) - 1).float()
    gy = (2 * yi / (Yc - 1) - 1).float()
    dw = None
    if depth_weight:
        dw = torch.ones((C, 1, 1, geom.W), device=dev, dtype=torch.float32)
        t = ((w + geom.R) / (2 * geom.R)).float()
        for ch, alpha in depth_weight.items():
            dw[ch, 0, 0] = 1.0 - alpha * t
    out = torch.empty((C, geom.H, geom.W), device=dev, dtype=torch.float32)
    for r0 in range(0, geom.H, chunk):
        r = torch.arange(r0, min(r0 + chunk, geom.H), device=dev, dtype=torch.float64)
        Z = geom.z_top - (r + 0.5) * geom.p
        zi = Z / geom.sz - 0.5
        gz = (2 * zi / (Zc - 1) - 1).float()
        n = len(r)
        grid = torch.stack((gx.expand(n, -1, -1), gy.expand(n, -1, -1),
                            gz[:, None, None].expand(n, geom.W, geom.W)), dim=-1)
        samp = F.grid_sample(vol, grid[None], mode="bilinear", padding_mode="border",
                             align_corners=True)[0]
        if dw is not None:
            samp = samp * dw
        out[:, r0:r0 + n] = samp.amax(dim=-1)
        for ch in sum_channels:
            out[ch, r0:r0 + n] = samp[ch].sum(dim=-1) * geom.p
    return out


def to_u8(x, lo, hi):
    return np.round(np.clip((x - lo) / (hi - lo), 0.0, 1.0) * 255.0).astype(np.uint8)


# ----------------------------------------------------------------------------- mask layers
class MaskSet:
    """The voxels of every class layer, with the component each voxel belongs to."""

    def __init__(self, pred_lab, gt_lab, rem_lab, found, fa):
        self.groups = {}
        for name, lab in (("pred", pred_lab), ("gt", gt_lab), ("removed", rem_lab)):
            zz, yy, xx = np.nonzero(lab)
            self.groups[name] = (zz, yy, xx, lab[zz, yy, xx].astype(np.int64))
        self.found = found        # bool per GT component (index 0 = component 1)
        self.fa = fa              # bool per predicted component

    def layer(self, geom, theta):
        """(H, W) uint8 bit field at angle theta, plus per-component footprint pixels."""
        bits = np.zeros((geom.H, geom.W), dtype=np.uint8)
        fp = {}
        for name, (zz, yy, xx, labs) in self.groups.items():
            if len(zz) == 0:
                fp[name] = (np.zeros(0, np.int64),) * 3
                continue
            rows, cols, ii = geom.splat(zz, yy, xx, theta)
            l = labs[ii]
            if name == "pred":
                bits[rows, cols] |= np.uint8(1 << BITS["pred"])
                fa_px = self.fa[l - 1]
                bits[rows[fa_px], cols[fa_px]] |= np.uint8(1 << BITS["fa_pred"])
                bits[rows[~fa_px], cols[~fa_px]] |= np.uint8(1 << BITS["touch_pred"])
            elif name == "gt":
                bits[rows, cols] |= np.uint8(1 << BITS["gt"])
                fo = self.found[l - 1]
                bits[rows[fo], cols[fo]] |= np.uint8(1 << BITS["found_gt"])
                bits[rows[~fo], cols[~fo]] |= np.uint8(1 << BITS["missed_gt"])
            else:
                bits[rows, cols] |= np.uint8(1 << BITS["removed"])
            fp[name] = (rows, cols, l)
        return bits, fp


def footprint_stats(rows, cols, labs, n, H, W):
    """Per-component unique-pixel area, area centroid and bbox (inclusive pixel indices)."""
    out = np.full((n + 1, 7), np.nan)
    if len(rows) == 0:
        return out
    key = labs * (H * W) + rows * W + cols
    uk = np.unique(key)
    lab_u = uk // (H * W)
    pix = uk % (H * W)
    ru = pix // W
    cu = pix % W
    cnt = np.bincount(lab_u, minlength=n + 1).astype(np.float64)
    sr = np.bincount(lab_u, weights=ru, minlength=n + 1)
    sc = np.bincount(lab_u, weights=cu, minlength=n + 1)
    starts = np.r_[0, np.nonzero(np.diff(lab_u))[0] + 1]
    ids = lab_u[starts]
    out[ids, 0] = sc[ids] / cnt[ids] + 0.5     # centroid x (pixel units, edge coordinates)
    out[ids, 1] = sr[ids] / cnt[ids] + 0.5     # centroid y
    out[ids, 2] = np.minimum.reduceat(cu, starts)
    out[ids, 3] = np.minimum.reduceat(ru, starts)
    out[ids, 4] = np.maximum.reduceat(cu, starts) + 1   # exclusive right edge
    out[ids, 5] = np.maximum.reduceat(ru, starts) + 1   # exclusive bottom edge
    out[ids, 6] = cnt[ids]
    return out


# ----------------------------------------------------------------------------- main
def parse_args(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--case", required=True)
    ap.add_argument("--slot", default=None, choices=("A", "B", "alt"),
                    help="which stage slot this case fills (written to motion-data/index.json)")
    ap.add_argument("--mamba-repo", default=str(DEFAULT_MAMBA))
    ap.add_argument("--probs-dir", default=str(Path.home() / "psma/run5-test-probs"))
    ap.add_argument("--cache-dir", default=str(Path.home() / "psma/psma-cache-run5-test"))
    ap.add_argument("--bundle-sums", default=str(Path.home() / "psma/run5-test-bundle/SHA256SUMS.txt"))
    ap.add_argument("--out", default=str(PORTFOLIO / "motion-data"))
    ap.add_argument("--angles", type=int, default=180, help="angles per full turn (>= 180)")
    ap.add_argument("--scale", type=int, default=2, help="layer pixels per in-plane voxel")
    ap.add_argument("--margin", type=int, default=6, help="body-crop margin, voxels")
    ap.add_argument("--device", default="cuda")
    return ap.parse_args(argv)


def load_cases_config():
    return json.loads((HERE / "cases.json").read_text())


def main(argv=None):
    args = parse_args(argv)
    t_start = time.time()
    timings = {}

    def tick(name, t0):
        timings[name] = round(time.time() - t0, 2)
        print(f"  [{name}] {timings[name]:.1f}s", flush=True)

    case = args.case
    mamba = Path(args.mamba_repo)
    sys.path.insert(0, str(mamba))
    import yaml
    import torch
    import torch.nn.functional as F
    from PIL import Image
    from evaluation.metrics import (connected_components, remove_small_components,
                                    evaluate_case, MATCHING_RULE)
    from evaluation.expansion import suv_from_normalised
    from monai.inferers.utils import _get_scan_interval
    from monai.data.utils import dense_patch_slices

    cases_cfg = load_cases_config()
    entry = next((c for c in cases_cfg["cases"] if c["case_id"] == case), None)
    if entry is None:
        raise SystemExit(f"{case} is not listed in tools/psma-motion/cases.json")
    if args.angles < 180:
        raise SystemExit("--angles must be at least 180 (2 degrees per step)")

    out_dir = Path(args.out) / case
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)
    (out_dir / "anterior").mkdir(parents=True, exist_ok=True)
    for stale in list((out_dir / "frames").glob("*.png")) + list((out_dir / "anterior").glob("*.png")):
        stale.unlink()   # a previous export with another angle count must not leave frames behind
    print(f"[export] {case} -> {out_dir}")

    # ---- 1. the cache must be the tensor DEMETER scored -----------------------------
    t0 = time.time()
    cache_path = Path(args.cache_dir) / f"{case}.npz"
    cache_sha = sha256_file(cache_path)
    want = None
    for line in Path(args.bundle_sums).read_text().splitlines():
        hh, name = line.split(None, 1)
        if name.strip() == f"./cache/{case}.npz":
            want = hh
    if cache_sha != want:
        raise SystemExit(f"cache hash mismatch for {case}: {cache_sha} vs bundle {want}")
    tick("hash_check", t0)

    # ---- 2. checkpoint configs (architecture facts + ensemble identity) -------------
    t0 = time.time()
    ck_meta = []
    ck_cfg0 = None
    for k in range(5):
        p = mamba / f"checkpoints/run5/fold{k}/checkpoint_best.pth"
        ck = torch.load(p, map_location="cpu", weights_only=False)
        cfg = ck["config"]
        if ck_cfg0 is None:
            ck_cfg0 = cfg
        for sec in ("preprocessing", "patch_sampling", "model"):
            if cfg.get(sec) != ck_cfg0.get(sec):
                raise SystemExit(f"fold {k}: '{sec}' differs from fold 0")
        n_all = int(sum(v.numel() for v in ck["model"].values()))
        n_organ = int(sum(v.numel() for kk, v in ck["model"].items() if "organ_head" in kk))
        ck_meta.append({"fold": (cfg.get("run") or {}).get("fold"), "iter": ck.get("iter"),
                        "seed": (cfg.get("training") or {}).get("seed"),
                        "path": rel(p, mamba), "params_total": n_all,
                        "params_organ_head": n_organ})
        del ck
    tick("checkpoint_configs", t0)
    yaml_cfg = yaml.safe_load((mamba / "configs/baseline.yaml").read_text())
    if yaml_cfg["preprocessing"]["normalization"] != ck_cfg0["preprocessing"]["normalization"]:
        raise SystemExit("baseline.yaml normalisation differs from the checkpoints' stored config")

    # ---- 3. ensemble, threshold, filter, score: exactly as sweep_threshold.py -------
    t0 = time.time()
    d = np.load(cache_path)
    image = np.asarray(d["image"], dtype=np.float32)
    label = (np.asarray(d["label"], dtype=np.float32)[0] > 0).astype(np.uint8)
    organ = np.asarray(d["organ"])[0].astype(np.uint8)
    probs = []
    prob_sha = []
    for k in range(5):
        f = Path(args.probs_dir) / f"fold{k}" / f"{case}.npz"
        prob_sha.append(sha256_file(f))
        pk = np.load(f)["prob"]
        if pk.shape != label.shape:
            raise SystemExit(f"{f}: shape {pk.shape} != label {label.shape}")
        probs.append(pk.astype(np.float32, copy=False))
    prob = np.mean(np.stack(probs, axis=0), axis=0, dtype=np.float32)
    binary = (prob > THRESHOLD).astype(np.uint8)
    pred = remove_small_components(binary, MIN_VOXELS).astype(np.uint8)
    tick("ensemble", t0)

    t0 = time.time()
    res10 = evaluate_case(pred, label)
    res0 = evaluate_case(binary, label)
    tick("evaluate_case", t0)

    # ---- 4. counts against both per-case CSVs ---------------------------------------
    rows_home = read_case_rows(mamba / CSV_HOME, case)
    rows_dem = read_case_rows(mamba / CSV_DEMETER, case)
    cols = ["n_gt", "n_pred", "tp", "fp", "fn", "f1", "ppv", "sensitivity", "dsc",
            "gt_positive", "pred_positive", "gt_voxels", "pred_voxels"]
    g1 = {"home": {}, "demeter": {}}
    for mv, res in ((10, res10), (0, res0)):
        rh, rd = rows_home[mv], rows_dem[mv]
        for c in cols:
            mine = res[c]
            home_v = csv_value(rh[c])
            if mine != home_v:
                raise SystemExit(f"G1 FAIL: min_voxels={mv} {c}: recomputed {mine!r} != home CSV {home_v!r}")
        for c in ("tp", "fp", "fn", "n_gt", "n_pred"):
            if res[c] != csv_value(rd[c]):
                raise SystemExit(f"G1 FAIL: min_voxels={mv} {c}: recomputed {res[c]} != DEMETER {rd[c]}")
        g1["home"][str(mv)] = {"line": rh["_line"], "all_columns_equal": True}
        g1["demeter"][str(mv)] = {
            "line": rd["_line"], "counts_equal": True,
            "pred_voxels_demeter": csv_value(rd["pred_voxels"]),
            "pred_voxels_home": res["pred_voxels"],
            "pred_voxel_diff_home_minus_demeter": res["pred_voxels"] - csv_value(rd["pred_voxels"]),
            "dsc_demeter": csv_value(rd["dsc"]), "dsc_home": res["dsc"],
        }
    print(f"  G1 counts: TP/FP/FN {res10['tp']}/{res10['fp']}/{res10['fn']}  n_gt {res10['n_gt']}  "
          f"n_pred {res0['n_pred']} -> {res10['n_pred']}  pred voxels home {res10['pred_voxels']} "
          f"DEMETER {rows_dem[10]['pred_voxels']}")

    # ---- 5. components and verdicts (the any-overlap rule, checked against the counts)
    t0 = time.time()
    pred_lab, n_pred = connected_components(pred)
    gt_lab, n_gt = connected_components(label)
    bin_lab, n_bin = connected_components(binary)
    sizes_bin = np.bincount(bin_lab.ravel(), minlength=n_bin + 1)
    small = np.nonzero((sizes_bin < MIN_VOXELS) & (np.arange(n_bin + 1) > 0))[0]
    rem_map = np.zeros(n_bin + 1, dtype=np.int32)
    rem_map[small] = np.arange(1, len(small) + 1)
    rem_lab = rem_map[bin_lab]
    n_rem = len(small)
    if not np.array_equal(rem_lab > 0, (binary > 0) & (pred == 0)):
        raise SystemExit("removed-component layer does not equal binary minus pred")
    gt_touch = np.bincount(gt_lab[pred > 0], minlength=n_gt + 1)[1:]
    found = gt_touch > 0
    pred_hit = np.bincount(pred_lab[label > 0], minlength=n_pred + 1)[1:]
    fa = pred_hit == 0
    assert n_pred == res10["n_pred"] and n_gt == res10["n_gt"] and n_bin == res0["n_pred"]
    assert int(found.sum()) == res10["tp"] and int((~found).sum()) == res10["fn"]
    assert int(fa.sum()) == res10["fp"]
    both = (pred_lab > 0) & (gt_lab > 0)
    pairs = np.unique(np.stack([pred_lab[both], gt_lab[both]], axis=1), axis=0) if both.any() \
        else np.zeros((0, 2), dtype=np.int64)
    tick("components", t0)

    # ---- 6. save the masks (content hashes; npz zip headers carry timestamps) -------
    np.savez_compressed(out_dir / "pred.npz", pred=pred)
    np.savez_compressed(out_dir / "label.npz", label=label)
    removed = ((binary > 0) & (pred == 0)).astype(np.uint8)
    np.savez_compressed(out_dir / "removed.npz", removed=removed)

    # ---- 7. intensities --------------------------------------------------------------
    suv = suv_from_normalised(image, ck_cfg0).astype(np.float32)
    ctn = ck_cfg0["preprocessing"]["normalization"]["CT"]
    hu = np.clip(image[0] * float(ctn["std"]) + float(ctn["mean"]),
                 float(ctn["clip_lower"]), float(ctn["clip_upper"])).astype(np.float32)

    # ---- 8. orientation from the organ pseudo-labels ---------------------------------
    def organ_centroid(cls):
        idx = np.argwhere(organ == cls)
        return None if len(idx) == 0 else idx.mean(axis=0)

    oc = {n: organ_centroid(c) for c, n in ((3, "liver"), (1, "spleen"), (4, "urinary bladder"),
                                           (6, "brain"), (10, "skull"), (7, "heart"), (2, "kidneys"))}
    head = oc["brain"] if oc["brain"] is not None else oc["skull"]
    orient = {
        "liver_x_lt_spleen_x (liver on the patient's right = low x)": bool(oc["liver"][2] < oc["spleen"][2]),
        "bladder_z_lt_liver_z (bladder below liver)": bool(oc["urinary bladder"][0] < oc["liver"][0]),
        "liver_z_lt_head_z (head at high z)": bool(head is not None and oc["liver"][0] < head[0]),
        "kidneys_y_lt_heart_y (anterior = high y)": bool(oc["kidneys"][1] < oc["heart"][1]),
    }
    if not all(orient.values()):
        raise SystemExit(f"orientation check failed: {orient}")

    # ---- 9. body crop and layer geometry ---------------------------------------------
    # The body is the largest connected component of CT > -500 HU; the scanner table is a
    # separate component and is blanked to air in the CT layer only (PET and masks untouched).
    from scipy import ndimage
    dense = hu > -500.0
    blab, nb = ndimage.label(dense)
    bsizes = np.bincount(blab.ravel())
    bsizes[0] = 0
    body = blab == int(bsizes.argmax())
    table_voxels = int(dense.sum() - body.sum())
    del blab
    lesion_outside_body = int(((pred > 0) | (label > 0))[~body].sum())
    hu_display = np.where(body, hu, np.float32(CT_STORE[0])).astype(np.float32)
    keep = body | (pred > 0) | (label > 0) | (binary > 0)   # every mask voxel stays in frame
    ys = np.nonzero(keep.any(axis=(0, 2)))[0]
    xs = np.nonzero(keep.any(axis=(0, 1)))[0]
    del keep
    Zn, Yn, Xn = label.shape
    m = args.margin
    crop = ((max(int(ys.min()) - m, 0), min(int(ys.max()) + 1 + m, Yn)),
            (max(int(xs.min()) - m, 0), min(int(xs.max()) + 1 + m, Xn)))
    spacing = (float(ck_cfg0["preprocessing"]["target_spacing"][2]),
               float(ck_cfg0["preprocessing"]["target_spacing"][1]),
               float(ck_cfg0["preprocessing"]["target_spacing"][0]))   # yaml is (x, y, z)
    geom = Geometry(label.shape, spacing, crop, args.scale)
    print(f"  layer {geom.W} x {geom.H} px at {geom.p:.4f} mm, crop y {crop[0]} x {crop[1]}")

    # ---- 10. rotating layers -----------------------------------------------------------
    dev = torch.device(args.device)
    (yy0, yy1), (xx0, xx1) = crop
    bone = np.clip((hu_display - BONE_WINDOW[0]) / (BONE_WINDOW[1] - BONE_WINDOW[0]), 0, 1).astype(np.float32)
    vol = torch.from_numpy(np.stack([suv[:, yy0:yy1, xx0:xx1], bone[:, yy0:yy1, xx0:xx1],
                                     prob[:, yy0:yy1, xx0:xx1],
                                     body[:, yy0:yy1, xx0:xx1].astype(np.float32),
                                     body[:, yy0:yy1, xx0:xx1].astype(np.float32)], axis=0)[None].copy()).to(dev)
    del bone
    masks = MaskSet(pred_lab, gt_lab, rem_lab, found, fa)
    n_ang = args.angles
    angles = [i * 360.0 / n_ang for i in range(n_ang)]
    comp_fp = {"pred": np.full((n_ang, n_pred + 1, 7), np.nan),
               "gt": np.full((n_ang, n_gt + 1, 7), np.nan),
               "removed": np.full((n_ang, n_rem + 1, 7), np.nan)}
    layer_sha = []
    t0 = time.time()
    t_mip = t_mask = t_png = 0.0
    mip0 = None
    for ai, th in enumerate(angles):
        ta = time.time()
        mip = mip_angle(vol, geom, th, torch, F, depth_weight={1: BONE_DEPTH_ALPHA},
                        sum_channels=(4,)).cpu().numpy()
        t_mip += time.time() - ta
        if ai == 0:
            mip0 = mip.copy()
        ta = time.time()
        bits, fp = masks.layer(geom, th)
        if ai == 0:
            bits0, fp0 = bits.copy(), fp
        for name, n in (("pred", n_pred), ("gt", n_gt), ("removed", n_rem)):
            rows, cols_, labs = fp[name]
            comp_fp[name][ai] = footprint_stats(rows, cols_, labs, n, geom.H, geom.W)
        t_mask += time.time() - ta
        ta = time.time()
        # G: 0 outside the body silhouette, 1..255 = 1 + 254 * depth-cued bone inside it
        sil = mip[3] >= 0.5
        g = np.where(sil, 1 + np.round(254 * np.clip(mip[1], 0, 1)), 0).astype(np.uint8)
        rgb = np.stack([to_u8(mip[0], *PET_STORE), g, to_u8(mip[2], 0.0, 1.0),
                        to_u8(mip[4], 0.0, THICK_MAX_MM)], axis=-1)
        Image.fromarray(rgb, mode="RGBA").save(out_dir / "frames" / f"rgb_{ai:03d}.png", compress_level=6)
        Image.fromarray(bits, mode="L").save(out_dir / "frames" / f"mask_{ai:03d}.png", compress_level=9)
        layer_sha.append(sha256_file(out_dir / "frames" / f"mask_{ai:03d}.png"))
        t_png += time.time() - ta
        if ai % 30 == 0:
            print(f"    angle {th:6.1f}  ({time.time() - t0:.0f}s)", flush=True)
    timings["rotating_layers"] = round(time.time() - t0, 1)
    timings["rotating_mip_gpu"] = round(t_mip, 1)
    timings["rotating_mask_splat"] = round(t_mask, 1)
    timings["rotating_png_write"] = round(t_png, 1)
    del vol
    torch.cuda.empty_cache()

    # every component must own pixels at every angle (G4 precondition)
    for name in comp_fp:
        area = comp_fp[name][:, 1:, 6]
        if area.size and not (np.nan_to_num(area) >= 1).all():
            raise SystemExit(f"{name}: a component has no footprint at some angle")

    # ---- 11. anterior extras: per-fold probability MIPs and the ensemble mean --------
    t0 = time.time()
    fold_vol = torch.from_numpy(np.stack([p_[:, yy0:yy1, xx0:xx1] for p_ in probs] +
                                         [prob[:, yy0:yy1, xx0:xx1]], axis=0)[None].copy()).to(dev)
    fmip = mip_angle(fold_vol, geom, 0.0, torch, F).cpu().numpy()
    del fold_vol
    torch.cuda.empty_cache()
    for k in range(5):
        Image.fromarray(to_u8(fmip[k], 0.0, 1.0), mode="L").save(out_dir / "anterior" / f"prob_fold{k}.png")
    Image.fromarray(to_u8(fmip[5], 0.0, 1.0), mode="L").save(out_dir / "anterior" / "prob_mean.png")
    prob_mip_max = [float(fmip[k].max()) for k in range(6)]
    tick("anterior_extras", t0)
    del probs

    # ---- 12. sliding windows, MONAI's own functions and order ------------------------
    roi = tuple(int(v) for v in ck_cfg0["patch_sampling"]["patch_size"])
    sys.path.insert(0, str(mamba))
    from evaluation.inference import DEFAULT_OVERLAP, DEFAULT_SW_BATCH
    scan_interval = _get_scan_interval(label.shape, roi, 3, (DEFAULT_OVERLAP,) * 3)
    slices = dense_patch_slices(label.shape, roi, scan_interval)
    y_starts = sorted({int(s[1].start) for s in slices})
    windows = []
    for i, s in enumerate(slices):
        z_s, y_s, x_s = int(s[0].start), int(s[1].start), int(s[2].start)
        rect = geom.window_rect(z_s, y_s, x_s, roi)
        windows.append({"i": i, "batch": i // DEFAULT_SW_BATCH, "start_zyx": [z_s, y_s, x_s],
                        "y_slab": y_starts.index(y_s), **rect})
    sigma_vox = [0.125 * r for r in roi]
    (out_dir / "windows.json").write_text(json.dumps({
        "roi_zyx": list(roi), "scan_interval_zyx": [int(v) for v in scan_interval],
        "overlap": DEFAULT_OVERLAP, "sw_batch_size": DEFAULT_SW_BATCH, "n": len(windows),
        "order": "monai.data.utils.dense_patch_slices: meshgrid(indexing='ij') flattened, x fastest, "
                 "then y, then z; sliding_window_inference runs them in this order, sw_batch_size at a time",
        "importance_map": {"mode": "gaussian", "sigma_scale": 0.125, "sigma_voxels_zyx": sigma_vox},
        "y_slabs": y_starts, "windows": windows,
    }, indent=1))

    # ---- 13. per-component data --------------------------------------------------------
    t0 = time.time()

    def comp_records(kind, lab, n, verdicts):
        objs = []
        if n == 0:
            return objs
        idx = np.argwhere(lab > 0)
        labs = lab[idx[:, 0], idx[:, 1], idx[:, 2]].astype(np.int64)
        order = np.argsort(labs, kind="stable")
        idx, labs = idx[order], labs[order]
        starts = np.r_[0, np.nonzero(np.diff(labs))[0] + 1, len(labs)]
        for k in range(n):
            a, b = starts[k], starts[k + 1]
            vox = idx[a:b]
            cid = int(labs[a])
            assert cid == k + 1
            zz, yy, xx = vox[:, 0], vox[:, 1], vox[:, 2]
            X, Y, Z = geom.voxel_mm(zz, yy, xx)
            Xc, Yc, Zc = float(X.mean()), float(Y.mean()), float(Z.mean())
            sv = suv[zz, yy, xx]
            org_vals = organ[zz, yy, xx]
            nz = org_vals[org_vals > 0]
            if len(nz):
                oc_ = np.bincount(nz, minlength=25)
                top = int(oc_.argmax())
                organ_info = {"organ": ORGAN_NAMES[top], "share": round(float(oc_[top] / len(org_vals)), 3)}
            else:
                organ_info = {"organ": "none (outside the 24 labelled structures)", "share": 0.0}
            fpa = comp_fp[kind][:, cid, :]
            th = np.radians(np.array(angles))
            depth = Xc * np.sin(th) - Yc * np.cos(th)
            objs.append({
                "id": cid, "kind": kind, "verdict": verdicts(cid),
                "voxels": int(b - a), "volume_ml": round(float((b - a) * geom.sz * geom.s * geom.s / 1000), 4),
                "centroid_zyx": [round(float(zz.mean()), 2), round(float(yy.mean()), 2), round(float(xx.mean()), 2)],
                "centroid_mm": [round(Xc, 2), round(Yc, 2), round(Zc, 2)],
                "suv_max": round(float(sv.max()), 2), "suv_median": round(float(np.median(sv)), 2),
                **organ_info,
                # per angle: [cx, cy, x0, y0, x1, y1, area_px, depth_mm]
                "fp": [[round(float(v), 1) for v in row] + [round(float(dd), 1)]
                       for row, dd in zip(fpa, depth)],
            })
        return objs

    touches_pred = {}
    touches_gt = {}
    for pid, gid in pairs:
        touches_pred.setdefault(int(pid), []).append(int(gid))
        touches_gt.setdefault(int(gid), []).append(int(pid))
    pred_objs = comp_records("pred", pred_lab, n_pred,
                             lambda i: "false_alarm" if fa[i - 1] else "touches_lesion")
    gt_objs = comp_records("gt", gt_lab, n_gt, lambda i: "found" if found[i - 1] else "missed")
    rem_objs = comp_records("removed", rem_lab, n_rem, lambda i: "removed_by_filter")
    for o in pred_objs:
        o["touches"] = touches_pred.get(o["id"], [])
    for o in gt_objs:
        o["touched_by"] = touches_gt.get(o["id"], [])

    # Missed lesions that a found region overlaps in the anterior view (beats 4-5 hold at
    # angle 0): the stage notes that close is not enough. The 3D gap is recorded with them.
    near = None
    if (~found).any():
        dist = ndimage.distance_transform_edt(pred == 0, sampling=(geom.sz, geom.s, geom.s))
        touch0 = ((bits0 >> BITS["touch_pred"]) & 1).astype(bool)
        touch0 = ndimage.binary_dilation(touch0, structure=np.ones((3, 3), bool))
        g_rows, g_cols, g_labs = fp0["gt"]
        near = {}
        for o in gt_objs:
            if o["verdict"] != "missed":
                continue
            sel = g_labs == o["id"]
            vox = gt_lab == o["id"]
            o["gap_to_pred_mm"] = round(float(dist[vox].min()), 1) if pred.any() else None
            o["overlaps_found_region_angle0"] = bool(touch0[g_rows[sel], g_cols[sel]].any())
            near[o["id"]] = [o["gap_to_pred_mm"], o["overlaps_found_region_angle0"]]
        del dist
    (out_dir / "components.json").write_text(json.dumps({
        "fields": ["cx", "cy", "x0", "y0", "x1", "y1", "area_px", "depth_mm"],
        "note": "layer pixels; cx/cy are the area centroid of the footprint in edge coordinates "
                "(pixel j spans [j, j+1)); x1/y1 exclusive; depth_mm is the 3D centroid's w "
                "(positive = farther from the viewer); one row per angle",
        "angles_deg": angles, "pred": pred_objs, "gt": gt_objs, "removed": rem_objs,
    }, separators=(",", ":")))
    tick("components_json", t0)

    # ---- 14. G6 inputs: organ centroids projected at angle 0 --------------------------
    def proj0(c):
        if c is None:
            return None
        X, Y, Z = geom.voxel_mm(c[0], c[1], c[2])
        return [round(float((X + geom.R) / geom.p), 1), round(float((geom.z_top - Z) / geom.p), 1)]

    orient_angle0 = {k: proj0(v) for k, v in oc.items()}

    # ---- 14b. beat 1 labels: organs with normal uptake, anchored inside their footprint ----
    # Candidates are interior pixels of the organ's angle-0 footprint (on the label's side of
    # the body for bilateral organs) that keep clear of every lesion and predicted region;
    # the anchor is the brightest of them on the PET MIP, and the organ is labelled only if
    # that is at least SUV 5, so a label never points at dim tissue or at disease.
    sil0 = mip0[3] >= 0.5
    lesionish = (bits0 & np.uint8((1 << BITS["gt"]) | (1 << BITS["pred"]) | (1 << BITS["removed"]))) > 0
    near_lesion = ndimage.binary_dilation(lesionish, structure=np.ones((3, 3), bool), iterations=LABEL_CLEAR_PX)
    labels_b1 = []
    labels_skipped = []
    for name, classes, side in LABEL_ORGANS:
        zz, yy, xx = np.nonzero(np.isin(organ, classes))
        if len(zz) == 0:
            continue
        frows, fcols, _ = geom.splat(zz, yy, xx, 0.0)
        foot = np.zeros((geom.H, geom.W), bool)
        foot[frows, fcols] = True
        if len(classes) > 1 or name == "kidneys":
            mid = int(round(fcols.mean()))
            if side == "right":
                foot[:, :mid] = False
            else:
                foot[:, mid:] = False
        flab, nf = ndimage.label(foot, structure=np.ones((3, 3), bool))
        if nf == 0:
            continue
        fsz = np.bincount(flab.ravel())
        fsz[0] = 0
        part = flab == int(fsz.argmax())
        edt = ndimage.distance_transform_edt(part)
        cand = (edt >= max(3.0, 0.35 * float(edt.max()))) & ~near_lesion
        cand[:LABEL_EDGE_ROWS] = False
        cand[-LABEL_EDGE_ROWS:] = False
        if not cand.any():
            labels_skipped.append({"name": name, "reason": "no interior pixel clear of lesions"})
            continue
        r, c = np.unravel_index(int(np.where(cand, mip0[0], -np.inf).argmax()), cand.shape)
        if float(mip0[0][r, c]) < LABEL_MIN_SUV:
            labels_skipped.append({"name": name, "reason": f"brightest interior pixel is SUV "
                                                          f"{float(mip0[0][r, c]):.2f} < {LABEL_MIN_SUV}"})
            continue
        row_sil = np.nonzero(sil0[r])[0]
        edge = int(row_sil.max()) + 1 if side == "right" else int(row_sil.min())
        labels_b1.append({
            "name": name, "classes": list(classes), "side": side,
            "anchor_px": [c + 0.5, r + 0.5], "body_edge_px": edge,
            "anchor_depth_px": round(float(edt[r, c]), 1), "footprint_px": int(part.sum()),
            "anchor_suv_mip": round(float(mip0[0][r, c]), 2),
        })

    # ---- 15. manifest -------------------------------------------------------------------
    summ = json.loads((mamba / TEST_SUMMARY).read_text())
    row10 = summ["rows"]["thr0.5_min10"]
    cohort_key = "autoPET" if case.startswith("psma_") else "DeepPSMA"
    pooled = row10["pooled"]["ensemble"]
    cohort = row10[cohort_key]["ensemble"]
    rd10, rd0 = rows_dem[10], rows_dem[0]
    dem_src = CSV_DEMETER
    row_desc10 = f"line {rd10['_line']}: threshold=0.5, min_voxels=10, case_id={case}"
    row_desc0 = f"line {rd0['_line']}: threshold=0.5, min_voxels=0, case_id={case}"

    def num(key, value, display, source, where, note=None):
        e = {"key": key, "value": value, "display": display, "source": source, "where": where}
        if note:
            e["note"] = note
        return e

    voxel_ml = MIN_VOXELS * geom.sz * geom.s * geom.s / 1000.0
    numbers = [
        num("case.f1", csv_value(rd10["f1"]), pct1(csv_value(rd10["f1"])), dem_src, row_desc10 + ", column f1"),
        num("case.ppv", csv_value(rd10["ppv"]), pct1(csv_value(rd10["ppv"])), dem_src, row_desc10 + ", column ppv"),
        num("case.sensitivity", csv_value(rd10["sensitivity"]), pct1(csv_value(rd10["sensitivity"])), dem_src,
            row_desc10 + ", column sensitivity"),
        num("case.dsc", csv_value(rd10["dsc"]), pct1(csv_value(rd10["dsc"])), dem_src, row_desc10 + ", column dsc"),
        num("case.tp", csv_value(rd10["tp"]), str(csv_value(rd10["tp"])), dem_src, row_desc10 + ", column tp"),
        num("case.fp", csv_value(rd10["fp"]), str(csv_value(rd10["fp"])), dem_src, row_desc10 + ", column fp"),
        num("case.fn", csv_value(rd10["fn"]), str(csv_value(rd10["fn"])), dem_src, row_desc10 + ", column fn"),
        num("case.n_gt", csv_value(rd10["n_gt"]), str(csv_value(rd10["n_gt"])), dem_src, row_desc10 + ", column n_gt"),
        num("case.n_pred", csv_value(rd10["n_pred"]), str(csv_value(rd10["n_pred"])), dem_src,
            row_desc10 + ", column n_pred"),
        num("case.n_pred_unfiltered", csv_value(rd0["n_pred"]), str(csv_value(rd0["n_pred"])), dem_src,
            row_desc0 + ", column n_pred"),
        num("case.pred_components_touching", int(n_pred - fa.sum()), str(int(n_pred - fa.sum())),
            "derived", "n_pred - fp from the DEMETER row; equals the components touching a lesion "
                       "in the exported pred mask"),
        num("test.pooled.f1", pooled["lesion_f1"], pct1(pooled["lesion_f1"]), TEST_SUMMARY,
            "rows.thr0.5_min10.pooled.ensemble.lesion_f1"),
        num("test.pooled.n_cases", pooled["n_cases"], str(pooled["n_cases"]), TEST_SUMMARY,
            "rows.thr0.5_min10.pooled.ensemble.n_cases"),
        num("test.pooled.sensitivity", pooled["lesion_sensitivity"], pct1(pooled["lesion_sensitivity"]),
            TEST_SUMMARY, "rows.thr0.5_min10.pooled.ensemble.lesion_sensitivity"),
        num("test.pooled.ppv", pooled["lesion_ppv"], pct1(pooled["lesion_ppv"]), TEST_SUMMARY,
            "rows.thr0.5_min10.pooled.ensemble.lesion_ppv"),
        num("test.pooled.n_lesions", pooled["lesion_tp"] + pooled["lesion_fn"],
            f"{pooled['lesion_tp'] + pooled['lesion_fn']:,}", TEST_SUMMARY,
            "rows.thr0.5_min10.pooled.ensemble.lesion_tp + rows.thr0.5_min10.pooled.ensemble.lesion_fn",
            note="ground-truth lesions in the test set: found plus missed"),
        num("test.cohort.f1", cohort["lesion_f1"], pct1(cohort["lesion_f1"]), TEST_SUMMARY,
            f"rows.thr0.5_min10.{cohort_key}.ensemble.lesion_f1"),
        num("test.cohort.n_cases", cohort["n_cases"], str(cohort["n_cases"]), TEST_SUMMARY,
            f"rows.thr0.5_min10.{cohort_key}.ensemble.n_cases"),
        num("method.threshold", THRESHOLD, "0.5", PROTOCOL_DOC, "section 5, row 'Threshold'"),
        num("method.min_voxels", MIN_VOXELS, "10", PROTOCOL_DOC, "section 5, row 'Size filter'"),
        num("method.min_voxels_ml", round(voxel_ml, 3), f"{voxel_ml:.2f}", PROTOCOL_DOC,
            "section 4.3, '10 of our voxels = 0.124 mL'"),
        num("method.n_models", 5, "5", PROTOCOL_DOC, "section 5, row 'Combination' (five-model ensemble)"),
        num("method.n_windows", len(windows), str(len(windows)), "derived",
            "monai.data.utils.dense_patch_slices(shape, patch_size, _get_scan_interval(..., overlap 0.5)) "
            f"on the cache shape {list(label.shape)}"),
        num("method.patch_zyx", list(roi), " x ".join(str(v) for v in roi), "configs/baseline.yaml",
            "patch_sampling.patch_size (also every checkpoint's stored config)"),
        num("method.overlap", DEFAULT_OVERLAP, "50%", "evaluation/inference.py", "DEFAULT_OVERLAP = 0.5"),
        num("method.features", ck_cfg0["model"]["features"],
            ", ".join(str(v) for v in ck_cfg0["model"]["features"]), "configs/baseline.yaml",
            "model.features (also every checkpoint's stored config)"),
        num("method.mamba_blocks", ck_cfg0["model"]["mamba_blocks"],
            ", ".join(str(v) for v in ck_cfg0["model"]["mamba_blocks"]), "configs/baseline.yaml",
            "model.mamba_blocks (also every checkpoint's stored config)"),
        num("method.n_directions", ck_cfg0["model"]["mamba"]["n_directions"],
            str(ck_cfg0["model"]["mamba"]["n_directions"]), "configs/baseline.yaml",
            "model.mamba.n_directions (also every checkpoint's stored config)"),
    ]

    for name, value in entry.get("rule_numbers", {}).items():
        numbers.append(num(f"selection.{name}", value, str(value), "tools/psma-motion/cases.json",
                           f"cases[case_id={case}].rule_numbers.{name} (the selection rule's own parameter)"))

    pred_info = {"file": "pred.npz", "key": "pred", "sha256_array": sha256_array(pred),
                 "sha256_file": sha256_file(out_dir / "pred.npz"), "voxels": int(pred.sum())}
    label_info = {"file": "label.npz", "key": "label", "sha256_array": sha256_array(label),
                  "sha256_file": sha256_file(out_dir / "label.npz"), "voxels": int(label.sum())}
    removed_info = {"file": "removed.npz", "key": "removed", "sha256_array": sha256_array(removed),
                    "sha256_file": sha256_file(out_dir / "removed.npz"), "voxels": int(removed.sum()),
                    "definition": "(prob > 0.5) minus pred: the components the 10-voxel filter removed"}
    exporter_sha = sha256_file(Path(__file__))
    mip0_stats = {
        "pet_suv_max": float(mip0[0].max()),
        "prob_max": float(mip0[2].max()),
    }
    manifest = {
        "schema": 1,
        "case_id": case,
        "slot": args.slot or entry.get("slot"),
        "cohort": entry["cohort"],
        "role": entry["role"],
        "label": entry["label"],
        "selection_rule": entry["rule"],
        "selection_rule_short": entry["rule_short"],
        "selection_rule_numbers": entry.get("rule_numbers", {}),
        "generated": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "exporter": {"path": "tools/psma-motion/export_motion_data.py", "sha256": exporter_sha,
                     "python": sys.version.split()[0], "numpy": np.__version__, "torch": torch.__version__},
        "provenance": (
            "Masks are recomputed from the home reproduction's saved probability maps "
            "(~/psma/run5-test-probs, commit a6b9d71, RTX 5070 Ti) of the same five "
            "checkpoint_best.pth on the same cached tensors DEMETER scored. Lesion counts equal "
            "DEMETER's run of record; voxel counts differ by the amount in g1.demeter. On-screen "
            "numbers are DEMETER's (the run of record)."),
        "inputs": {
            "cache": {"path": str(cache_path), "sha256": cache_sha, "bundle_sha256": want,
                      "bundle_sums": args.bundle_sums, "match": True},
            "prob_maps": [{"fold": k, "path": str(Path(args.probs_dir) / f"fold{k}" / f"{case}.npz"),
                           "sha256": prob_sha[k]} for k in range(5)],
            "checkpoints": ck_meta,
            "mamba_repo": str(mamba),
        },
        "ensemble": {
            "rule": "np.mean(np.stack(probs, axis=0), axis=0, dtype=np.float32) over folds 0-4; "
                    "binary = prob > 0.5 (strict); pred = remove_small_components(binary, 10); "
                    "evaluate_case(pred, label)  [scripts/sweep_threshold.py]",
            "matching_rule": MATCHING_RULE,
        },
        "results": {"recomputed_min10": {k: res10[k] for k in cols},
                    "recomputed_min0": {k: res0[k] for k in cols},
                    "csv_home": CSV_HOME, "csv_demeter": CSV_DEMETER},
        "g1": g1,
        "components": {"n_pred": n_pred, "n_gt": n_gt, "n_removed": n_rem, "n_binary": n_bin,
                       "found": int(found.sum()), "missed": int((~found).sum()),
                       "false_alarm": int(fa.sum()), "touching": int((~fa).sum()),
                       "pred_gt_pairs": [[int(a), int(b)] for a, b in pairs],
                       "missed_gap_and_overlap_angle0": near,
                       "missed_note": "gap_to_pred_mm: smallest centre-to-centre distance from the missed "
                                      "lesion's voxels to a predicted voxel; overlap: its angle-0 footprint "
                                      "meets (3 x 3) a found region's footprint"},
        "labels_beat1": {
            "rule": "organ classes from the cache's TotalSegmentator pseudo-labels; footprint = exact "
                    "angle-0 splat of the organ voxels (bilateral organs: the half on the label's side, "
                    "largest 8-connected part); candidates = footprint pixels at least max(3, 0.35 x the "
                    "deepest) px from its edge, outside the first and last 16 rows, and at least 6 px from "
                    "any ground-truth, predicted or removed pixel; anchor = the candidate with the highest "
                    "PET MIP; labelled only if that is >= SUV 5; body_edge_px = the silhouette's edge "
                    "column on that side, in the anchor's row",
            "min_suv": LABEL_MIN_SUV, "clear_px": LABEL_CLEAR_PX,
            "labels": labels_b1, "skipped": labels_skipped,
        },
        "masks": {"pred": pred_info, "label": label_info, "removed": removed_info, "bits": BITS,
                  "mask_png_sha256": layer_sha},
        "orientation": {
            "cache": "LAS (sitk.DICOMOrient): x to the patient's left, y to anterior, z to superior",
            "checks": orient,
            "organ_centroids_zyx": {k: (None if v is None else [round(float(x), 1) for x in v])
                                    for k, v in oc.items()},
            "organ_centroids_angle0_px": orient_angle0,
            "transform": "angle 0 = anterior view: screen x = patient's left (radiological "
                         "convention: patient's right on the viewer's left), screen y = head at the top. "
                         "Equivalent to np.flipud(vol.max(axis=1)) on the (Z, Y, X) array.",
        },
        "layer": geom.as_dict(),
        "rotation": {"n_angles": n_ang, "deg_per_step": 360.0 / n_ang, "angle0": "anterior",
                     "angle90": "patient's right side (anterior on screen right)",
                     "sense": "camera moves from the front toward the patient's right; the body "
                              "appears to turn to its own left"},
        "frames": {
            "rgb": "frames/rgb_NNN.png  R = PET MIP, G = body silhouette + CT bone layer (depth-cued MIP), "
                   "B = ensemble probability MIP, A = body thickness along the ray",
            "thickness": {"quantity": "path length through the body mask, mm (display shading only)",
                          "encoding": "A = round(255 * clip(sum over depth of body * step / 600, 0, 1))"},
            "mask": "frames/mask_NNN.png  one byte per pixel, bits as in masks.bits",
            "pet": {"quantity": "SUV (clipped at 1.0433 and 51.21 by the cache)", "store_window": list(PET_STORE),
                    "encoding": "R = round(255 * clip((SUV - 1.0433) / (12.0 - 1.0433), 0, 1))"},
            "ct": {"quantity": "bone = clip((HU - 150) / 950, 0, 1); HU clipped at -832.06 and 1127.76 by the cache",
                   "bone_window_hu": list(BONE_WINDOW), "depth_alpha": BONE_DEPTH_ALPHA,
                   "encoding": "G = 0 outside the body silhouette (MIP of the body mask >= 0.5), else "
                               "1 + round(254 * max over depth of bone * (1 - 0.6 * (w + R) / 2R)); "
                               "w = depth from the viewer: a depth-cued MIP, nearer bone brighter",
                   "body_mask": "largest 6-connected component of HU > -500; CT voxels outside it set to "
                                "-832.06 HU before projection (removes the scanner table). PET and masks "
                                "are not masked.",
                   "table_voxels_blanked": table_voxels,
                   "mask_voxels_outside_body": lesion_outside_body},
            "prob": {"quantity": "ensemble mean sigmoid probability", "encoding": "B = round(255 * p)"},
            "mip": "trilinear sampling at pixel_mm spacing in-plane and in depth, max along depth",
            "angle0_stats": mip0_stats,
        },
        "anterior": {"prob_fold": [f"anterior/prob_fold{k}.png" for k in range(5)],
                     "prob_mean": "anterior/prob_mean.png", "encoding": "L = round(255 * p)",
                     "prob_mip_max": prob_mip_max},
        "windows_file": "windows.json",
        "components_file": "components.json",
        "numbers": numbers,
        "timings_s": timings,
    }
    timings["total"] = round(time.time() - t_start, 1)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1))

    # ---- 16. index of exported cases (the module reads this) --------------------------
    idx_path = Path(args.out) / "index.json"
    index = json.loads(idx_path.read_text()) if idx_path.exists() else {"cases": {}}
    index["cases"][case] = {"slot": manifest["slot"], "cohort": entry["cohort"],
                            "label": entry["label"], "generated": manifest["generated"]}
    if manifest["slot"] in ("A", "B"):
        for cid, v in index["cases"].items():
            if cid != case and v.get("slot") == manifest["slot"]:
                v["slot"] = "alt"
    idx_path.write_text(json.dumps(index, indent=1))
    write_sheet(out_dir, manifest, Image)
    size = sum(f.stat().st_size for f in out_dir.rglob("*") if f.is_file())
    print(f"[export] done in {timings['total']:.0f}s, {size / 1e6:.1f} MB")


# Verdict colours for the still sheet only (Okabe-Ito); the module has its own palette.
SHEET_COLOURS = {"found_gt": (0, 114, 178), "missed_gt": (204, 121, 167), "fa_pred": (230, 159, 0)}


def write_sheet(out_dir, manifest, Image):
    """A still sheet: inverted PET (SUV 1.04-8) at 0/90/180/270 deg, verdict layers on top."""
    from PIL import ImageDraw, ImageFont
    n = manifest["rotation"]["n_angles"]
    tiles = []
    for deg in (0, 90, 180, 270):
        ai = int(round(deg * n / 360)) % n
        rgb = np.asarray(Image.open(out_dir / "frames" / f"rgb_{ai:03d}.png"))
        bits = np.asarray(Image.open(out_dir / "frames" / f"mask_{ai:03d}.png"))
        suv = PET_STORE[0] + rgb[..., 0].astype(np.float32) / 255 * (PET_STORE[1] - PET_STORE[0])
        g = 255 * (1 - np.clip((suv - PET_STORE[0]) / (8.0 - PET_STORE[0]), 0, 1))
        im = np.repeat(g[..., None], 3, axis=2)
        for name, col in SHEET_COLOURS.items():
            m = ((bits >> BITS[name]) & 1).astype(bool)
            im[m] = 0.15 * im[m] + 0.85 * np.array(col, dtype=np.float32)
        tiles.append(np.round(im).astype(np.uint8))
    sheet = np.concatenate(tiles, axis=1)
    pad = np.full((90, sheet.shape[1], 3), 255, np.uint8)
    img = Image.fromarray(np.concatenate([pad, sheet], axis=0))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
    except OSError:
        font = ImageFont.load_default()
    dr = ImageDraw.Draw(img)
    c = manifest["components"]
    dr.text((16, 12), f"{manifest['label']} ({manifest['cohort']}): anterior, right side, posterior, left side",
            fill=(20, 20, 20), font=font)
    dr.text((16, 50), f"found {c['found']} (blue)   missed {c['missed']} (purple)   "
                      f"false alarms {c['false_alarm']} (orange)   PET SUV 1.04-8, inverted",
            fill=(20, 20, 20), font=font)
    img.save(out_dir / "sheet.png")


if __name__ == "__main__":
    main()
