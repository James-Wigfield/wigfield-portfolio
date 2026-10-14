"""
SEMINAR DECKS -- the plain deck's 3D turn engine (shared by the make_plain_3d_*.py clip builders).

Turns a scan about the head-to-toe axis through the body's centre and draws each angle as the
plain deck draws its stills (make_plain_scans.py): the PET maximum-intensity projection front to
back, ink on white with alpha = SUV / 10; for study A the CT layer under it (a cool-grey body
silhouette and a bone MIP inside the body); lesions or the result classes in the slides' own
style (a faint fill, a white casing and a coloured edge). Rotation 0 is the identity, so a turn
that ends on the front view ends on the still's own projection and a slide can cross-fade to its
layers without a jump.

Scans (the same files, loaders and checks as the stills):
  A  psma_26154a761c528fdd_2016-10-22  Figure 2.1 (a); slides 2, 4 and 12
  B  the over-100-lesion pool case     slide 3 (make_plain_scans.case_b's rule)
  C  deeppsma_0004                     slide 10 (Figure 4.7 (b)); classes as the app counts them

Everything here is data in, pixels out: no number is invented, and lesion components are the
label's own 26-connected components.
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I leaves the script's folder off the path
import make_plain_scans as mps  # noqa: E402
import numpy as np  # noqa: E402
import SimpleITK as sitk  # noqa: E402
from PIL import Image  # noqa: E402

FFMPEG = r'C:\Users\james\.venvs\motion\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
PORTFOLIO = mps.PORTFOLIO
CLIPS = PORTFOLIO / 'public' / 'seminar-decks' / 'clips'
ALTS = PORTFOLIO / 'src' / 'components' / 'portal' / 'modules' / 'seminar-decks' / 'decks' / 'plain' / 'alts'

WHITE = np.array([255, 255, 255], np.float32)
INK = np.array(mps.INK, np.float32)
CT_INK = np.array(mps.CT_INK, np.float32)
ACCENT = (0, 114, 178)        # --dp-accent
ACCENT_SOFT = (157, 195, 224)  # --dp-accent-soft
CLASS = {'found': (0, 114, 178), 'missed': (204, 121, 167), 'falseAlarm': (230, 159, 0)}  # Figure 4.7
CLASS_FILL = {'found': ACCENT_SOFT, 'missed': CLASS['missed'], 'falseAlarm': CLASS['falseAlarm']}


class Scan:
    """A scan in LAS (z, y, x) with its still's projection p (make_plain_scans / pce)."""

    def __init__(self, key, case_id, case, p, ct=None, body3=None, cls=None):
        self.key, self.case_id, self.case, self.p = key, case_id, case, p
        self.pet = case['pet']
        self.mask = case['mask']
        self.spacing = case['spacing_xyz']
        self.ct, self.body3, self.cls = ct, body3, cls
        self._lab = None

    def labels(self):
        """The label's 26-connected components (1..n), and n."""
        if self._lab is None:
            img = sitk.GetImageFromArray(self.mask.astype(np.uint8))
            lab = sitk.GetArrayFromImage(sitk.ConnectedComponent(img, True))
            self._lab = (lab.astype(np.int32), int(lab.max()))
        return self._lab


def load_a(with_ct=True):
    pet_path, mask_path = mps.pce.paths('autoPET', mps.CASE_A, mps.DATASETS, mps.DEEPPSMA)
    case = mps.pce.load(pet_path, mask_path)
    p = mps.pce.project(case)
    ct = body3 = None
    if with_ct:
        img = sitk.DICOMOrient(sitk.ReadImage(str(pet_path.with_name(pet_path.name.replace('_0001', '_0000')))), mps.pce.ORIENT)
        assert np.allclose(img.GetDirection(), mps.pce.LAS_DIRECTION, atol=1e-4)
        ct = sitk.GetArrayFromImage(img).astype(np.float32)
        assert ct.shape == case['pet'].shape, (ct.shape, case['pet'].shape)
        # as make_plain_scans.ct_png: tissue above -400 HU, pieces of at least a tenth of the largest
        tissue = sitk.BinaryThreshold(img, -400.0, 4000.0, 1, 0)
        cc = sitk.RelabelComponent(sitk.ConnectedComponent(tissue), sortByObjectSize=True)
        lab = sitk.GetArrayFromImage(cc)
        sizes = np.bincount(lab.ravel())
        keep = [k for k in range(1, len(sizes)) if sizes[k] >= 0.1 * sizes[1]]
        body3 = np.isin(lab, keep)
    return Scan('A', mps.CASE_A, case, p, ct=ct, body3=body3)


def load_b():
    cid, n_gt = mps.case_b()
    mps.pce.assert_pool_case(mps.REPO, cid)
    pet_path, mask_path = mps.pce.paths('DeepPSMA', cid, mps.DATASETS, mps.DEEPPSMA)
    case = mps.pce.load(pet_path, mask_path)
    p = mps.pce.project(case)
    s = Scan('B', cid, case, p)
    s.n_gt = n_gt
    return s


def load_c():
    import make_plain_spin as mspin  # study C's classes, with their checks against the app's counts
    case, cls_img, counts = mspin.classes_and_case()
    cls = sitk.GetArrayFromImage(cls_img)
    assert cls.shape == case['pet'].shape
    case['mask'] = cls > 0
    p = mps.pce.project(case)
    s = Scan('C', mps.CASE_C, case, p, cls=cls)
    s.counts = counts
    return s


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def _band(m, r):
    """Pixels within r (chessboard) of m."""
    out = m.copy()
    for _ in range(r):
        g = out.copy()
        g[1:, :] |= out[:-1, :]
        g[:-1, :] |= out[1:, :]
        g[:, 1:] |= out[:, :-1]
        g[:, :-1] |= out[:, 1:]
        out = g
    return out


def _erode(m, r):
    return ~_band(~m, r)


class Turner:
    """Frames of a scan turning about z, in the still's projection and scale."""

    def __init__(self, scan: Scan, display_h, scale=2.0, pad_mm=70.0, step_deg=1.0):
        self.s = scan
        p = scan.p
        self.c0, self.c1 = p['cols']
        sx, sy, sz = scan.spacing
        assert abs(sx - sy) < 1e-4, 'in-plane spacing must be square to turn the volume'
        self.sx, self.sz = sx, sz
        Z, Y, X = scan.pet.shape
        self.Z, self.X = Z, X
        body = scan.pet.max(axis=0) > 0.3
        ys, xs = np.nonzero(body)
        self.yc, self.xc = float(ys.mean()), float(xs.mean())
        pad = int(round(pad_mm / sx))
        self.xa, self.xb = self.c0 - pad, self.c1 + pad
        self.pad_cols = pad
        self.k = display_h / (Z * sz)                    # display px per mm
        self.display_h = display_h
        self.scale = scale
        self.out_h = int(round(display_h * scale / 2) * 2)
        self.out_w = int(round((self.xb - self.xa) * sx * self.k * scale / 2) * 2)
        self.display_w = self.out_w / scale
        self.centre = (self.xc * sx, self.yc * sy, (Z - 1) * sz / 2)
        self.step = step_deg
        self._img = {}
        self._cache = {}

    # ── volumes as sitk images (spacing only; LAS arrays) ──
    def _image(self, name):
        if name not in self._img:
            if name == 'lab':
                arr = self.s.labels()[0]
            elif name == 'body':
                arr = self.s.body3.astype(np.uint8)
            else:
                arr = {'pet': self.s.pet, 'ct': self.s.ct, 'cls': self.s.cls}[name]
            img = sitk.GetImageFromArray(arr)
            img.SetSpacing(tuple(float(v) for v in self.s.spacing))
            self._img[name] = img
        return self._img[name]

    def _turned(self, name, theta, interp, default=0.0):
        tr = sitk.Euler3DTransform()
        tr.SetCenter(self.centre)
        tr.SetRotation(0.0, 0.0, theta)
        img = self._image(name)
        return sitk.GetArrayFromImage(sitk.Resample(img, img, tr, interp, default))

    def quantise(self, theta):
        q = round(math.degrees(theta) / self.step) * self.step
        return q % 360.0

    def projections(self, theta, need=('pet',)):
        """Projections (z, cols xa..xb) at the quantised angle, cached."""
        q = self.quantise(theta)
        key = (q, tuple(sorted(need)))
        if key in self._cache:
            return self._cache[key]
        th = math.radians(q)
        cols = slice(max(0, self.xa), min(self.X, self.xb))
        W = self.xb - self.xa
        j0, j1 = cols.start - self.xa, cols.stop - self.xa

        def place(a2, fill=0):
            out = np.full((self.Z, W), fill, a2.dtype)
            out[:, j0:j1] = a2[:, cols]
            return out

        res = {}
        if 'pet' in need:
            res['pet'] = place(self._turned('pet', th, sitk.sitkLinear).max(axis=1))
        if 'ct' in need:
            ct = self._turned('ct', th, sitk.sitkLinear, -1000.0)
            body = self._turned('body', th, sitk.sitkNearestNeighbor) > 0
            res['ct_body'] = place(body.any(axis=1))
            res['ct_bone'] = place(np.where(body, ct, -1000.0).max(axis=1), -1000.0)
        if 'lab' in need:
            lab = self._turned('lab', th, sitk.sitkNearestNeighbor)
            res['lab'] = lab  # full volume: the caller projects the components it shows
            res['lab_cols'] = (cols, j0, j1)
        if 'cls' in need:
            cl = self._turned('cls', th, sitk.sitkNearestNeighbor)
            for name, v in (('found', 1), ('missed', 2), ('falseAlarm', 3)):
                res['cls_' + name] = place((cl == v).any(axis=1))
        # projections are small; a turned label volume ('lab') is the whole scan (tens of MB),
        # so results that hold one are never cached
        if 'lab' not in need:
            if len(self._cache) > 400:
                self._cache.clear()
            self._cache[key] = res
        return res

    # ── drawing ──
    def _up(self, a2):
        """Projection (row 0 = feet) to output size, row 0 = head, nearest (as the stills draw)."""
        a2 = a2[::-1]
        if a2.dtype == bool:
            im = Image.fromarray(a2.astype(np.uint8) * 255).resize((self.out_w, self.out_h), Image.NEAREST)
            return np.asarray(im) > 0
        im = Image.fromarray(a2.astype(np.float32), 'F').resize((self.out_w, self.out_h), Image.NEAREST)
        return np.asarray(im, np.float32)

    def base(self, pr, pet_a=1.0, ct_a=0.0):
        rgb = np.empty((self.out_h, self.out_w, 3), np.float32)
        rgb[:] = WHITE
        if ct_a > 0 and 'ct_body' in pr:
            body = self._up(pr['ct_body'])
            bone = self._up(pr['ct_bone'])
            b = np.clip((bone - 150.0) / (1100.0 - 150.0), 0.0, 1.0) ** 0.8
            a = np.where(body, 0.09 + 0.46 * b, 0.0) * ct_a
            rgb = rgb * (1 - a[..., None]) + CT_INK * a[..., None]
        if pet_a > 0:
            a = np.clip(self._up(pr['pet']) / mps.SUV_MAX, 0.0, 1.0) * pet_a
            rgb = rgb * (1 - a[..., None]) + INK * a[..., None]
        return rgb

    def outline(self, rgb, m, edge, fill, alpha=1.0, fill_a=0.35, edge_w=None, casing_w=None):
        """The slides' lesion style on an output-size mask: fill, white casing, coloured edge."""
        if alpha <= 0 or not m.any():
            return rgb
        ew = edge_w or max(1, int(round(0.9 * self.scale)))
        cw = casing_w or max(1, int(round(1.8 * self.scale)))
        inner = _erode(m, ew)
        edge_band = m & ~inner
        casing = _band(m, cw) & ~m
        f = np.array(fill, np.float32)
        e = np.array(edge, np.float32)
        a = fill_a * alpha
        rgb[inner] = rgb[inner] * (1 - a) + f * a
        rgb[casing] = rgb[casing] * (1 - alpha) + WHITE * alpha
        rgb[edge_band] = rgb[edge_band] * (1 - alpha) + e * alpha
        return rgb

    def lesion_mask(self, pr, ids=None):
        """Output-size mask of the label components in ids (all if None), at this angle."""
        lab = pr['lab']
        cols, j0, j1 = pr['lab_cols']
        sub = lab[:, :, cols]
        sel = sub > 0 if ids is None else np.isin(sub, np.asarray(sorted(ids), np.int32))
        m = np.zeros((self.Z, self.xb - self.xa), bool)
        m[:, j0:j1] = sel.any(axis=1)
        return self._up(m)

    def done(self, rgb):
        return np.clip(rgb + 0.5, 0, 255).astype(np.uint8)


class Encoder:
    """Raw RGB frames into an H.264 MP4 (white ground, Rec. 709 tags, fast start)."""

    def __init__(self, path, w, h, fps=30, crf=21):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps),
               '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
               '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
               '-an', str(self.path)]
        self.p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        self.n = 0
        self.last = None

    def write(self, frame):
        self.p.stdin.write(frame.tobytes())
        self.n += 1
        self.last = frame

    def hold(self, frame, n):
        b = frame.tobytes()
        for _ in range(n):
            self.p.stdin.write(b)
        self.n += n
        self.last = frame

    def close(self):
        self.p.stdin.close()
        if self.p.wait() != 0:
            sys.exit(f'ffmpeg failed for {self.path}')
        return self.path.stat().st_size


def write_gen(path, name, obj, source):
    """A small generated JS module with the clip's geometry and timing."""
    import json
    js = (f'// Generated by tools/seminar-decks/{source}; do not edit.\n'
          f'export const {name} = {json.dumps(obj, separators=(", ", ": "))};\n')
    Path(path).write_text(js, encoding='utf-8', newline='\n')
