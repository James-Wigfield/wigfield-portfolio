"""Slide 10, second option: the sealed test scan of slide 10 turning once in 3D.

The same study, labels, prediction and classes as make_plain_scans.py's study C
(deeppsma_0004, Figure 4.7 (b): the app's saved run of the five run 5 fold models at
threshold 0.5 with the 10-voxel filter, on the scan's own PET grid; found / missed /
false alarm as the app and Figure 4.7 class them, checked against the app's counts).
Here the volume turns about a vertical axis through the body's centre and each frame
is the maximum-intensity projection front to back, drawn as the slide draws the
still: PET in SUV from 0 to 10, ink on white. The classes are not drawn on the turn
(DRAW_CLASSES): slide 10 draws found, missed and false alarm in turn as they are
named, so the turn shows the scan alone. One turn, ending on the front view, which is
the still's own projection (rotation 0 is the identity), so the slide can cross-fade
to its own layers.

Writes (portfolio repo):
  public/seminar-decks/clips/plain-c-spin.mp4   H.264, white ground, one turn
  public/seminar-decks/clips/plain-c-spin.png   its last frame (the front view)
  src/components/portal/modules/seminar-decks/decks/plain/alts/spin.gen.js
                                                where the frame sits on the still
Run (portfolio root): python -I tools/seminar-decks/make_plain_spin.py
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I leaves the script's folder off the path
import make_plain_scans as mps  # noqa: E402  (its main() runs only as a script)
import numpy as np  # noqa: E402
import SimpleITK as sitk  # noqa: E402
from PIL import Image  # noqa: E402

FFMPEG = r'C:\Users\james\.venvs\motion\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
OUT_MP4 = mps.PORTFOLIO / 'public' / 'seminar-decks' / 'clips' / 'plain-c-spin.mp4'
OUT_PNG = mps.PORTFOLIO / 'public' / 'seminar-decks' / 'clips' / 'plain-c-spin.png'
OUT_JS = mps.PORTFOLIO / 'src' / 'components' / 'portal' / 'modules' / 'seminar-decks' / 'decks' / 'plain' / 'alts' / 'spin.gen.js'

FPS = 30
TURN_S = 4.0          # one full turn
HOLD_S = 0.4          # the front view held at the end
SCALE = 2             # output pixels per display pixel (sharp on a Retina screen)
DISPLAY_H = 680       # the still's height on slide 10 (geometry.js S10)
PAD_MM = 70           # room either side of the still for the body as it turns
WHITE = np.array([255, 255, 255], np.float32)
COLOURS = {'found': (0, 114, 178), 'missed': (204, 121, 167), 'falseAlarm': (230, 159, 0)}  # Figure 4.7 / plain.css
FILL_ALPHA = 0.35
DRAW_CLASSES = False  # True draws the three classes on every frame


def classes_and_case():
    """study_c's classes, with its checks (same files, same rule, same counts as the app)."""
    C = mps.CASE_C
    run = mps.APP_RUNS / C
    settings = json.loads((run / 'gui_settings.json').read_text())['settings']
    meta = json.loads((run / f'{C}_predict.json').read_text())
    assert settings['threshold'] == 0.5 and settings['min_voxels'] == 10 and not settings['tta'], settings
    assert meta['model']['n_folds'] == 5
    assert C in set(json.loads((mps.REPO / 'splits/test.json').read_text())), 'not a sealed test case'
    pet_path = mps.TEST_DP / 'imagesTr' / f'{C}_0001.nii.gz'
    gt_path = mps.TEST_DP / 'labelsTr' / f'{C}.nii.gz'
    pr_img = sitk.ReadImage(str(run / f'{C}.nii.gz'))
    gt_img = sitk.ReadImage(str(gt_path))

    def cc(img):
        lab = sitk.ConnectedComponent(sitk.Cast(img > 0, sitk.sitkUInt8), True)
        a = sitk.GetArrayFromImage(lab)
        return a, int(a.max())

    gt_lab, n_gt = cc(gt_img)
    pr_lab, n_pr = cc(pr_img)
    gt, pr = gt_lab > 0, pr_lab > 0
    hit_lesions = np.unique(gt_lab[pr & gt])
    hit_blobs = np.unique(pr_lab[gt & pr])
    found = np.isin(gt_lab, hit_lesions) & gt
    true_blobs = np.isin(pr_lab, hit_blobs) & pr
    classes = np.zeros(gt.shape, np.uint8)
    classes[gt & ~found] = 2
    classes[pr & ~true_blobs] = 3
    classes[found | true_blobs] = 1
    truth = json.loads(mps.APP_TRUTH.read_text())['cases'][C]['overlay_counts']
    counts = (int(hit_lesions.size), int(n_gt - hit_lesions.size), int(n_pr - hit_blobs.size))
    assert counts == (truth['found'], truth['missed'], truth['false_alarm']), (counts, truth)
    cls_img = sitk.GetImageFromArray(classes)
    cls_img.CopyInformation(pr_img)
    cls_img = sitk.DICOMOrient(cls_img, mps.pce.ORIENT)
    case = mps.pce.load(pet_path, gt_path)
    return case, cls_img, counts


def main():
    case, cls_img, counts = classes_and_case()
    p = mps.pce.project(case)
    c0, c1 = p['cols']
    sx, sy, sz = case['spacing_xyz']
    assert abs(sx - sy) < 1e-4, 'in-plane spacing must be square to turn the volume'
    pet = case['pet']                                   # (z, y, x), LAS
    Z, Y, X = pet.shape
    # The turning axis: the body's centre in the axial plane (PET above the body threshold).
    body = pet.max(axis=0) > 0.3
    ys, xs = np.nonzero(body)
    yc, xc = float(ys.mean()), float(xs.mean())
    # Output columns: the still's crop widened by PAD_MM each side.
    pad = int(round(PAD_MM / sx))
    xa, xb = c0 - pad, c1 + pad
    k = DISPLAY_H / (Z * sz)                            # display px per mm (as S10)
    out_h = int(round(DISPLAY_H * SCALE / 2) * 2)
    out_w = int(round((xb - xa) * sx * k * SCALE / 2) * 2)

    pet_img = sitk.GetImageFromArray(pet)
    pet_img.SetSpacing((sx, sy, sz))
    cls_arr = sitk.GetArrayFromImage(cls_img)
    assert cls_arr.shape == pet.shape
    cls_lin = sitk.GetImageFromArray(cls_arr)
    cls_lin.SetSpacing((sx, sy, sz))
    centre = (xc * sx, yc * sy, (Z - 1) * sz / 2)

    def turned(img, theta, interp):
        tr = sitk.Euler3DTransform()
        tr.SetCenter(centre)
        tr.SetRotation(0.0, 0.0, theta)
        return sitk.GetArrayFromImage(sitk.Resample(img, img, tr, interp, 0.0))

    def frame(theta):
        mip = turned(pet_img, theta, sitk.sitkLinear).max(axis=1)        # (z, x)
        cl = turned(cls_lin, theta, sitk.sitkNearestNeighbor)
        cols = slice(max(0, xa), min(X, xb))
        alpha = np.zeros((Z, xb - xa), np.float32)
        alpha[:, cols.start - xa:cols.stop - xa] = np.clip(mip[:, cols] / mps.SUV_MAX, 0, 1)
        img = WHITE * (1 - alpha[..., None]) + np.array(mps.INK, np.float32) * alpha[..., None]
        masks = {}
        for name, val in (('found', 1), ('missed', 2), ('falseAlarm', 3)):
            m = np.zeros((Z, xb - xa), bool)
            m[:, cols.start - xa:cols.stop - xa] = (cl[:, :, cols] == val).any(axis=1)
            masks[name] = m
        img = img[::-1]                                                  # row 0 = head
        big = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').resize((out_w, out_h), Image.NEAREST)
        rgb = np.asarray(big, np.float32).copy()
        for name in ('found', 'missed', 'falseAlarm') if DRAW_CLASSES else ():   # the slide's drawing order
            m = np.asarray(Image.fromarray(masks[name][::-1].astype(np.uint8) * 255).resize((out_w, out_h), Image.NEAREST)) > 0
            if not m.any():
                continue
            col = np.array(COLOURS[name], np.float32)
            rgb[m] = rgb[m] * (1 - FILL_ALPHA) + col * FILL_ALPHA
            inner = m.copy()
            inner[1:, :] &= m[:-1, :]
            inner[:-1, :] &= m[1:, :]
            inner[:, 1:] &= m[:, :-1]
            inner[:, :-1] &= m[:, 1:]
            inner2 = inner.copy()
            inner2[1:, :] &= inner[:-1, :]
            inner2[:-1, :] &= inner[1:, :]
            inner2[:, 1:] &= inner[:, :-1]
            inner2[:, :-1] &= inner[:, 1:]
            rgb[m & ~inner2] = col                                       # a 2 px edge in the class colour
        return np.clip(rgb, 0, 255).astype(np.uint8)

    n_turn = int(round(TURN_S * FPS))
    n_hold = int(round(HOLD_S * FPS))
    os.makedirs(OUT_MP4.parent, exist_ok=True)
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{out_w}x{out_h}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', str(OUT_MP4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    front = None
    for i in range(n_turn + 1):
        # ease in and out over the turn; the last frame is a full turn, the front view
        u = i / n_turn
        theta = 2 * math.pi * (u * u * (3 - 2 * u))
        f = frame(theta if i < n_turn else 0.0)
        if i == n_turn:
            front = f
        proc.stdin.write(f.tobytes())
    for _ in range(n_hold):
        proc.stdin.write(front.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit('ffmpeg failed')
    Image.fromarray(front, 'RGB').save(OUT_PNG, optimize=True)
    # Where the frame sits relative to the still (S10.scan): its left edge is column xa.
    js = (
        '// Generated by tools/seminar-decks/make_plain_spin.py; do not edit.\n'
        '// The turning frame of slide 10\'s second option, in the still\'s projection columns:\n'
        '// it starts `padCols` columns left of the still and spans `cols` columns.\n'
        f'export const SPIN = {{ padCols: {c0 - xa}, cols: {xb - xa}, seconds: {round((n_turn + 1 + n_hold) / FPS, 3)}, turn: {TURN_S} }};\n'
    )
    OUT_JS.write_text(js, encoding='utf-8', newline='\n')
    print(json.dumps({'counts (found, missed, fa)': counts, 'frames': n_turn + 1 + n_hold, 'size': [out_w, out_h],
                      'mp4_bytes': OUT_MP4.stat().st_size, 'png_bytes': OUT_PNG.stat().st_size, 'axis_col': round(xc, 1)}))


if __name__ == '__main__':
    main()
