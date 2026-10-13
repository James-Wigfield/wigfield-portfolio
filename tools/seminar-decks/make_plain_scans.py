"""Scan layers for the plain deck, slides 2 to 4 (run once; outputs are committed).

Two studies, both CC BY open data, drawn as the dissertation draws Figure 2.1:
coronal maximum-intensity projections of PET in SUV on one window from 0 to 10,
dark on white, with the ground-truth lesion masks as pixel-edge outlines.

  A  psma_26154a761c528fdd_2016-10-22  Figure 2.1 (a): the same study, case rule
     and loading code (Mamba_PSMA/scripts/plot_cohort_examples.py). Slides 2 and 4.
  B  deeppsma_0026                      slide 3, "some scans have over 100 lesions".
     Fixed rule, set before any image was viewed (13 Oct 2026): the run 5 CV per-case
     rows (threshold 0.5, min_voxels 10, no expansion, no splitting; 567 pool cases,
     none in the sealed test set), lesion-positive cases with n_gt > 100 (81 cases),
     the lower median of n_gt (132), then the lowest case_id at that count.

Loading, reorientation to LAS, the projection and the left-right crop are the
dissertation script's own functions (imported, not copied). This script adds:
  - the PET layer as an RGBA PNG: ink colour, alpha = SUV / 10 clipped to [0, 1];
  - for A, a CT layer (a projection of attenuation through the body, so bone reads
    darker than soft tissue and lung lighter), as an RGBA PNG for slide 2;
  - lesion outlines as closed pixel-edge polygons, one per connected region of the
    mask projection (8-connected), in projection pixels;
  - for A, organ leader anchors by the dissertation's rule (organ_anchors), plus the
    patient's left kidney by the same rule, and the lesion nearest the two kidneys.
Writes public/seminar-decks/figures/plain-{a,b}-pet.png, plain-a-ct.png and
src/components/portal/modules/seminar-decks/decks/plain/scans.gen.js.

Usage (Windows Python with numpy, SimpleITK and Pillow):
    python -B tools/seminar-decks/make_plain_scans.py
"""

from __future__ import annotations

import csv
import importlib.util
import json
import statistics
from pathlib import Path

import numpy as np
import SimpleITK as sitk
from PIL import Image

PORTFOLIO = Path(__file__).resolve().parents[2]
CITS = Path("C:/Users/james/Documents/university/cits4010")
REPO = CITS / "Mamba_PSMA"
DATASETS = CITS / "datasets"
DEEPPSMA = CITS / "baseline-deeppsma-eval" / "data"
ORGANS = DATASETS / "autoPET-PSMA_ORGANS_combined_UPDATED"
FIG_OUT = PORTFOLIO / "public" / "seminar-decks" / "figures"
JS_OUT = PORTFOLIO / "src" / "components" / "portal" / "modules" / "seminar-decks" / "decks" / "plain" / "scans.gen.js"

CASE_A = "psma_26154a761c528fdd_2016-10-22"
SUV_MAX = 10.0
INK = (20, 23, 28)        # --sd-ink of the plain deck
CT_INK = (96, 104, 112)   # the CT layer, a cool grey under the PET ink

spec = importlib.util.spec_from_file_location("pce", REPO / "scripts" / "plot_cohort_examples.py")
pce = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pce)


def case_b() -> tuple[str, int]:
    rows = []
    for k in range(5):
        f = REPO / f"evaluation/results/run5-fold{k}/checkpoint_best_val_threshold_sweep_per_case.csv"
        with f.open(newline="") as fh:
            for r in csv.DictReader(fh):
                if (float(r["threshold"]) == 0.5 and int(r["min_voxels"]) == 10
                        and r["expand"] == "False" and r["split"] == "False"):
                    rows.append(r)
    test = set(json.loads((REPO / "splits/test.json").read_text()))
    ids = [r["case_id"] for r in rows]
    assert len(rows) == 567 and len(set(ids)) == 567 and not set(ids) & test
    big = [(r["case_id"], int(r["n_gt"])) for r in rows if int(r["n_gt"]) > 100]
    low = statistics.median_low([n for _, n in big])
    pick = sorted(c for c, n in big if n == low)[0]
    print(f"case B rule: {len(big)} pool cases with n_gt > 100, lower median {low}, pick {pick}")
    return pick, low


def pet_png(p: dict, out: Path) -> None:
    a = np.clip(p["mip"] / SUV_MAX, 0.0, 1.0)[::-1]            # row 0 = head (z up)
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = INK
    rgba[..., 3] = np.round(a * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(out, optimize=True)


def ct_png(ct_path: Path, p: dict, out: Path) -> None:
    img = sitk.DICOMOrient(sitk.ReadImage(str(ct_path)), pce.ORIENT)
    assert np.allclose(img.GetDirection(), pce.LAS_DIRECTION, atol=1e-4)
    ct = sitk.GetArrayFromImage(img).astype(np.float32)          # (z, y, x)
    c0, c1 = p["cols"]
    # Body: tissue above -400 HU, its connected pieces of at least a tenth of the
    # largest (the trunk and raised arms), so the scanner table drops out.
    tissue = sitk.BinaryThreshold(img, -400.0, 4000.0, 1, 0)
    cc = sitk.RelabelComponent(sitk.ConnectedComponent(tissue), sortByObjectSize=True)
    lab = sitk.GetArrayFromImage(cc)[:, :, c0:c1]
    sizes = np.bincount(lab.ravel())
    keep = [k for k in range(1, len(sizes)) if sizes[k] >= 0.1 * sizes[1]]
    body3 = np.isin(lab, keep)
    ct = ct[:, :, c0:c1]
    assert ct.shape[0] == p["mip"].shape[0] and ct.shape[2] == p["mip"].shape[1], (ct.shape, p["mip"].shape)
    body = body3.any(axis=1)                                     # (z, x) silhouette
    bone = np.where(body3, ct, -1000.0).max(axis=1)              # bone MIP inside the body
    b = np.clip((bone - 150.0) / (1100.0 - 150.0), 0.0, 1.0) ** 0.8
    a = np.where(body, 0.09 + 0.46 * b, 0.0)[::-1]
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = CT_INK
    rgba[..., 3] = np.round(a * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(out, optimize=True)


def regions(m2d: np.ndarray) -> np.ndarray:
    img = sitk.GetImageFromArray(m2d.astype(np.uint8))
    return sitk.GetArrayFromImage(sitk.ConnectedComponent(img, True))  # 8-connected


def loops(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """Closed pixel-edge polygons around a 2D mask (rows down, cols right), vertices in pixel corners."""
    H, W = mask.shape
    edges = {}
    for r, c in zip(*np.nonzero(mask)):
        # clockwise on screen: top, right, bottom, left; an edge shared with a mask pixel cancels
        for (a, b), (dr, dc) in ((((c, r), (c + 1, r)), (-1, 0)), (((c + 1, r), (c + 1, r + 1)), (0, 1)),
                                 (((c + 1, r + 1), (c, r + 1)), (1, 0)), (((c, r + 1), (c, r)), (0, -1))):
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and mask[rr, cc]:
                continue
            edges.setdefault(a, []).append(b)
    out = []
    while edges:
        start = next(iter(edges))
        poly = [start]
        cur = start
        while True:
            nxt = edges[cur].pop()
            if not edges[cur]:
                del edges[cur]
            if nxt == start:
                break
            poly.append(nxt)
            cur = nxt
        # drop collinear vertices
        keep = []
        n = len(poly)
        for i in range(n):
            a, b, c = poly[i - 1], poly[i], poly[(i + 1) % n]
            if (b[0] - a[0]) * (c[1] - b[1]) != (b[1] - a[1]) * (c[0] - b[0]):
                keep.append(b)
        out.append(keep)
    return out


def outlines(p: dict) -> list[dict]:
    m = p["mproj"][::-1]                                         # row 0 = head
    lab = regions(m)
    res = []
    for k in range(1, int(lab.max()) + 1):
        r = lab == k
        rr, cc = np.nonzero(r)
        d = " ".join("M" + " ".join(f"{x} {y}" for x, y in poly) + "Z" for poly in loops(r))
        res.append({"d": d, "cx": round(float(cc.mean() + 0.5), 2), "cy": round(float(rr.mean() + 0.5), 2),
                    "px": int(r.sum())})
    res.sort(key=lambda o: (o["cy"], o["cx"]))                   # head to feet
    return res


def anchors_a(case: dict, p: dict) -> dict:
    """Leader anchors in projection pixels (row 0 = head), by the dissertation's rule."""
    organ_path = ORGANS / f"autoPET-PSMA_{CASE_A[len('psma_'):]}.nii.gz"
    got = {lab: (x, z) for lab, _, x, z, _ in pce.organ_anchors(organ_path, case, p)}
    # The patient's left kidney, by the same rule restricted to the left half (high x).
    org = sitk.GetArrayFromImage(sitk.DICOMOrient(sitk.ReadImage(str(organ_path)), pce.ORIENT))
    c0, c1 = p["cols"]
    zz, xx = np.nonzero((org == 2).any(axis=1)[:, c0:c1])
    keep = xx > np.median(xx)
    zz, xx = zz[keep], xx[keep]
    dx, dz = p["dx"], p["dz"]
    pz, px = zz * dz, xx * dx
    lz, lx = np.nonzero(p["mproj"])
    d = np.sqrt((pz[:, None] - lz[None, :] * dz) ** 2 + (px[:, None] - lx[None, :] * dx) ** 2).min(axis=1)
    ok = d >= pce.ORGAN_CLEAR_MM
    cz, cx = pz[ok].mean(), px[ok].mean()
    j = int(np.argmin((pz[ok] - cz) ** 2 + (px[ok] - cx) ** 2))
    got["kidney_left"] = (float(px[ok][j] + 0.5 * dx), float(pz[ok][j] + 0.5 * dz))
    H = p["mip"].shape[0]
    return {k: [round(x / p["dx"], 2), round(H - z / p["dz"], 2)] for k, (x, z) in got.items()}


def geometry(p: dict) -> dict:
    H, W = p["mip"].shape
    return {"w": W, "h": H, "dx": round(p["dx"], 6), "dz": round(p["dz"], 6),
            "widthMm": round(p["width_mm"], 2), "heightMm": round(p["height_mm"], 2)}


def main() -> None:
    FIG_OUT.mkdir(parents=True, exist_ok=True)
    out = {}

    # Study A (Figure 2.1 (a)).
    pet_path, mask_path = pce.paths("autoPET", CASE_A, DATASETS, DEEPPSMA)
    case = pce.load(pet_path, mask_path)
    p = pce.project(case)
    pet_png(p, FIG_OUT / "plain-a-pet.png")
    ct_png(pet_path.with_name(pet_path.name.replace("_0001", "_0000")), p, FIG_OUT / "plain-a-ct.png")
    les = outlines(p)
    anc = anchors_a(case, p)
    kx = (anc["kidney"][0] + anc["kidney_left"][0]) / 2
    ky = (anc["kidney"][1] + anc["kidney_left"][1]) / 2
    near = min(range(len(les)), key=lambda i: (les[i]["cx"] - kx) ** 2 + (les[i]["cy"] - ky) ** 2)
    out["A"] = {"case": CASE_A, **geometry(p), "lesions": les, "anchors": anc, "contextLesion": near,
                "nComponentsNative": case["n_components_native"]}
    print(f"A: {CASE_A} {p['mip'].shape} {p['height_mm']:.0f} x {p['width_mm']:.0f} mm, "
          f"{len(les)} projected regions, anchors {anc}, context lesion {near}")

    # Study B (slide 3).
    cid, n_gt = case_b()
    pce.assert_pool_case(REPO, cid)
    pet_path, mask_path = pce.paths("DeepPSMA", cid, DATASETS, DEEPPSMA)
    case = pce.load(pet_path, mask_path)
    p = pce.project(case)
    pet_png(p, FIG_OUT / "plain-b-pet.png")
    les = outlines(p)
    out["B"] = {"case": cid, "nGt": n_gt, **geometry(p), "lesions": les,
                "nComponentsNative": case["n_components_native"]}
    print(f"B: {cid} n_gt {n_gt}, {case['n_components_native']} native components, {p['mip'].shape} "
          f"{p['height_mm']:.0f} x {p['width_mm']:.0f} mm, {len(les)} projected regions")

    header = (
        "/* GENERATED by tools/seminar-decks/make_plain_scans.py: do not edit.\n"
        "   Projection geometry, lesion outlines (closed pixel-edge polygons in projection\n"
        "   pixels, row 0 at the head) and organ anchors for the plain deck's scan layers\n"
        "   (public/seminar-decks/figures/plain-a-pet.png, plain-a-ct.png, plain-b-pet.png).\n"
        "   dx and dz are mm per projection pixel across and head to toe. */\n"
    )
    JS_OUT.write_text(header + "export const SCANS = " + json.dumps(out, separators=(",", ":")) + ";\n",
                      encoding="ascii")
    print(f"wrote {JS_OUT} ({JS_OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
