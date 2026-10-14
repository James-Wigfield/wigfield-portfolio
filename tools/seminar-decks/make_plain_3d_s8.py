#!/usr/bin/env python3
"""
SEMINAR DECKS -- slide 8's second option: the final model running on a sealed test scan.

Study C (deeppsma_0004, slide 10's scan: Figure 4.7 (b)) from the PSMA Motion export
(motion-data/deeppsma_0004, made by tools/psma-motion/export_motion_data.py and
replay_accumulator.py; its counts were checked there against the run of record), drawn front on in
the plain deck's style, in four steps that follow the end of slide 8's transcript:
  1. one version (fold 0) reads the scan patch by patch: its 70 patches in MONAI's real order
     (windows.json), with its real running estimate after each patch (accum/acc_NNN.png; the
     replay's final map equals the saved fold-0 map exactly);
  2. that version's map becomes the mean of the five versions (anterior/prob_fold0.png ->
     prob_mean.png);
  3. the threshold: probability above 0.5 becomes the binary output, in the model's blue;
  4. the size filter: the predicted pieces under 10 voxels (mask bit `removed`) are ringed, then
     dissolve, leaving the prediction (mask bit `pred`).
The scan is drawn as slide 10 draws its PET (ink on white, alpha = SUV / 10), with no bone.
The clip starts when the panel comes up (slide time T_IN; the slide holds it paused on its first
frame until then, alts/useAt.js), so clip time 0 is slide time T_IN; everything is over by END,
inside the 52.5 s cap. All times below are slide times.

Writes public/seminar-decks/clips/plain-c-run.mp4 and .png (the last frame, the finished state)
and decks/plain/alts/s8.gen.js (panel size and step times for alts/DesignB.jsx).
    python -I tools/seminar-decks/make_plain_3d_s8.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import SimpleITK as sitk  # noqa: E402
from PIL import Image  # noqa: E402
import plain3d as P  # noqa: E402

CASE = 'deeppsma_0004'
SRC = P.PORTFOLIO / 'motion-data' / CASE
OUT_MP4 = P.CLIPS / 'plain-c-run.mp4'
OUT_PNG = P.CLIPS / 'plain-c-run.png'
OUT_JS = P.ALTS / 's8.gen.js'

FPS = 30
PANEL_H = 610          # display px (as slide 8's scan)
SCALE = 2
# (design critic, 14 Oct: the panel comes up after "21 to 7" has landed on its own; the five
# maps differ too little to show one by one, so one version's map becomes the mean in one move)
T_IN = 41.6            # the panel fades in over the main slide's scan ("ensemble" beat, 43.1)
SWEEP = (42.2, 46.6)   # 70 patches
MEAN = (46.8, 47.8)    # fold 0's map -> the mean of the five versions
THRESH = (48.0, 49.1)  # heat out, binary in (a wipe head to toe)
FILTER = (50.0, 50.3, 51.3, 51.9)  # removed pieces ringed, held, then ring and piece dissolve
END = 52.0
STEPS = [SWEEP[0], MEAN[0], THRESH[0], FILTER[0]]
RING = (20, 23, 28)    # the deck's ink, with a white halo

HEAT = [np.array(c, np.float32) for c in ((255, 230, 163), (242, 142, 43), (178, 24, 43))]  # light ramp


def load_png(rel, mode=None):
    im = Image.open(SRC / rel)
    return np.asarray(im if mode is None else im.convert(mode))


def main():
    man = json.loads((SRC / 'manifest.json').read_text())
    win = json.loads((SRC / 'windows.json').read_text())
    lay = man['layer']
    LW, LH = lay['width'], lay['height']
    rgba = load_png('frames/rgb_000.png', 'RGBA').astype(np.float32)
    mask = load_png('frames/mask_000.png', 'L')
    folds = [load_png(f'anterior/prob_fold{k}.png', 'L').astype(np.float32) / 255 for k in range(5)]
    mean = load_png('anterior/prob_mean.png', 'L').astype(np.float32) / 255
    acc = [load_png(f'accum/acc_{i:03d}.png', 'L').astype(np.float32) / 255 for i in range(win['n'])]
    assert len(win['windows']) == win['n'] == len(acc)
    assert np.abs(acc[-1] - folds[0]).max() <= 2 / 255, 'the replayed sweep must end on the saved fold-0 map'

    out_h = int(round(PANEL_H * SCALE / 2) * 2)
    s = out_h / LH
    out_w = int(round(LW * s / 2) * 2)

    def up(a, nearest=False):
        im = Image.fromarray(a.astype(np.float32), 'F').resize((out_w, out_h), Image.NEAREST if nearest else Image.BILINEAR)
        return np.asarray(im, np.float32)

    def upm(bits):
        return np.asarray(Image.fromarray(bits.astype(np.uint8) * 255).resize((out_w, out_h), Image.NEAREST)) > 0

    # the scan, drawn as the plain deck draws PET (ink, alpha = SUV / 10) over a faint body and bone
    suv = 1.0433 + rgba[..., 0] / 255 * (12.0 - 1.0433)
    suv[rgba[..., 0] == 0] = 0.0
    g = rgba[..., 1]
    body = up((g > 0).astype(np.float32)) > 0.5
    bone = up(np.maximum(g - 1, 0) / 254)
    pet_a = np.clip(up(suv) / 10.0, 0, 1)
    base = np.empty((out_h, out_w, 3), np.float32)
    base[:] = P.WHITE
    # PET only, as slide 10 (no body silhouette or bone: the critic asked for the deck's one
    # projection style; the silhouette also took in what lies beside the patient at the elbows)
    del body, bone
    base = base * (1 - pet_a[..., None]) + P.INK * pet_a[..., None]
    dimmed = base * 0.72 + P.WHITE * 0.28      # under the heat and the masks, as the motion graphics dim it

    pred = upm((mask & 1) > 0)
    removed = upm((mask & 64) > 0)
    folds_u = [up(folds[0])]
    mean_u = up(mean)

    # one ring round each removed piece (its own region in this view), big enough to see:
    # radius = half its extent + 14 px, at least 30 px (output px; half that on the slide)
    lab = sitk.GetArrayFromImage(sitk.ConnectedComponent(sitk.GetImageFromArray((removed & ~pred).astype(np.uint8)), True))
    yy, xx = np.mgrid[0:out_h, 0:out_w]
    rings = np.zeros((out_h, out_w), bool)
    rings_halo = np.zeros((out_h, out_w), bool)
    n_rings = int(lab.max())
    for k in range(1, n_rings + 1):
        ys, xs = np.nonzero(lab == k)
        cy, cx = ys.mean(), xs.mean()
        r = max(30.0, 0.5 * math.hypot(np.ptp(ys) + 1, np.ptp(xs) + 1) + 14)
        d = np.hypot(yy - cy, xx - cx)
        rings |= (d >= r) & (d < r + 5)
        rings_halo |= ((d >= r - 3) & (d < r)) | ((d >= r + 5) & (d < r + 8))
    rings_halo &= ~rings
    acc_cache = {}

    def heat_rgb(q):
        q = np.clip(q, 0, 1)
        lo = q < 0.5
        u = np.where(lo, q * 2, (q - 0.5) * 2)[..., None]
        c = np.where(lo[..., None], HEAT[0] * (1 - u) + HEAT[1] * u, HEAT[1] * (1 - u) + HEAT[2] * u)
        al = np.clip((q - 0.03) / (0.35 - 0.03), 0, 1)
        al = al * al * (3 - 2 * al)
        return c, al

    def comp_heat(rgb, q, amount):
        if amount <= 0:
            return rgb
        c, al = heat_rgb(q)
        al = al * amount
        return rgb * (1 - al[..., None]) + c * al[..., None]

    def rect(rgb, w, alpha=1.0):
        x0, x1 = w['col0'] * s, w['col1'] * s
        y0, y1 = w['row0'] * s, w['row1'] * s
        x0i, x1i = int(round(max(0, x0))), int(round(min(out_w, x1)))
        y0i, y1i = int(round(max(0, y0))), int(round(min(out_h, y1)))
        if x1i <= x0i or y1i <= y0i:
            return rgb
        acc_c = np.array(P.ACCENT, np.float32)
        sub = rgb[y0i:y1i, x0i:x1i]
        sub[:] = sub * (1 - 0.07 * alpha) + acc_c * 0.07 * alpha
        lw, halo = 3 * SCALE // 2 + 1, 2
        m = np.zeros((out_h, out_w), bool)
        m[y0i:y1i, x0i:x1i] = True
        inner = np.zeros_like(m)
        inner[y0i + lw:y1i - lw, x0i + lw:x1i - lw] = True
        edge = m & ~inner
        outer = P._band(m, halo) & ~m
        inner2 = np.zeros_like(m)
        inner2[y0i + lw + halo:y1i - lw - halo, x0i + lw + halo:x1i - lw - halo] = True
        halo_in = inner & ~inner2
        for hm in (outer, halo_in):
            rgb[hm] = rgb[hm] * (1 - 0.85 * alpha) + P.WHITE * 0.85 * alpha
        rgb[edge] = rgb[edge] * (1 - alpha) + acc_c * alpha
        return rgb

    def fill(rgb, m, colour, alpha, casing=True):
        if alpha <= 0 or not m.any():
            return rgb
        col = np.array(colour, np.float32)
        if casing:
            ring = P._band(m, 2) & ~m
            rgb[ring] = rgb[ring] * (1 - alpha) + P.WHITE * alpha
        rgb[m] = rgb[m] * (1 - 0.9 * alpha) + col * 0.9 * alpha
        return rgb

    sm = P.smooth

    def frame(t):
        if t < SWEEP[0]:
            return base.copy()
        # how much the scan is dimmed: in over the sweep's first half second
        dim = sm((t - SWEEP[0]) / 0.5)
        rgb = base * (1 - dim) + dimmed * dim
        thr = sm((t - THRESH[0]) / (THRESH[1] - THRESH[0]))       # 0 -> 1 over the threshold step
        if t < SWEEP[1]:
            i = min(win['n'] - 1, int((t - SWEEP[0]) / (SWEEP[1] - SWEEP[0]) * win['n']))
            if i not in acc_cache:
                acc_cache.clear()
                acc_cache[i] = up(acc[i])
            rgb = comp_heat(rgb, acc_cache[i], 1.0)
            rgb = rect(rgb, win['windows'][i])
            return rgb
        # after the sweep: fold 0's map becomes the mean of the five
        q = folds_u[0]
        u = sm((t - MEAN[0]) / (MEAN[1] - MEAN[0]))
        if u > 0:
            q = q * (1 - u) + mean_u * u
        rgb = comp_heat(rgb, q, 1.0 - thr)
        # the patch frame lingers a moment after the last patch, then goes
        if t < SWEEP[1] + 0.3:
            rgb = rect(rgb, win['windows'][-1], 1 - sm((t - SWEEP[1]) / 0.3))
        if thr > 0:
            # the binary output appears from head to toe (a soft band), in the model's blue
            rows = np.arange(out_h, dtype=np.float32)[:, None] / out_h
            band = 0.08
            wipe = np.clip((thr * (1 + band) - rows) / band, 0, 1)
            bin_m = pred | removed
            show = bin_m & (wipe > 0.5)
            ring_in = sm((t - FILTER[0]) / (FILTER[1] - FILTER[0]))
            gone = sm((t - FILTER[2]) / (FILTER[3] - FILTER[2]))
            keep = show & pred
            rgb = fill(rgb, keep, P.ACCENT, 1.0)
            spk = show & removed & ~pred
            if spk.any():
                rgb = fill(rgb, spk, P.ACCENT, 1.0 - gone)
                al = ring_in * (1 - gone)
                if al > 0:
                    rgb[rings_halo] = rgb[rings_halo] * (1 - al) + P.WHITE * al
                    rgb[rings] = rgb[rings] * (1 - al) + np.array(RING, np.float32) * al
        return rgb

    n = int(round((END - T_IN) * FPS)) + 1
    enc = P.Encoder(OUT_MP4, out_w, out_h, FPS, crf=21)
    last = None
    for i in range(n):
        f = np.clip(frame(T_IN + i / FPS) + 0.5, 0, 255).astype(np.uint8)
        enc.write(f)
        last = f
    size = enc.close()
    Image.fromarray(last, 'RGB').save(OUT_PNG, optimize=True)
    gen = {'w': out_w / SCALE, 'h': PANEL_H, 'tIn': T_IN, 'steps': STEPS, 'end': END,
           'counts': {k: man['results']['recomputed_min10'][k] for k in ('n_gt', 'tp', 'fp', 'fn')},
           'windows': win['n']}
    P.write_gen(OUT_JS, 'S8X', gen, 'make_plain_3d_s8.py')
    print(json.dumps({'size': [out_w, out_h], 'frames': n, 'seconds': round(n / FPS, 2), 'mp4_bytes': size,
                      'png_bytes': OUT_PNG.stat().st_size, 'removed_px': int(removed.sum()), 'pred_px': int(pred.sum())}))


if __name__ == '__main__':
    main()
