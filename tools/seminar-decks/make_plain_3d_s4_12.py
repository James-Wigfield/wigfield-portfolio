"""
Slides 4 and 12, second options: patches drawn to scale in 3D on scan A as it turns.

Scan A (psma_26154a761c528fdd_2016-10-22, Figure 2.1 (a)) turns about the head-to-toe axis
through the body's centre (plain3d.Turner, PET only, as both slides draw it). A patch is drawn
as a wireframe box, to scale in all three directions, from the fact manifest
(shared/facts.js): the box turns with the body, so its depth, which the coronal view hides,
shows. Rotation 0 is the still's own projection.

  Slide 4  (dropped 14 Oct on the design critic's advice: turned to 45 degrees, the 521 mm box
           projects wider than the body and reads as the patch growing while James says the
           CNN "can't see the entire scan at once". Its builder is kept in the build session's
           scratchpad, dropped/s4.)
  Slide 12 The final model's patch (patch.small_*_mm: 288 x 391 x 196 mm, z x y x x) under the
           chart's first column, and under the second the larger patch (patch.large_mm:
           672 x 391 x 391 mm), each on its own copy of the scan, both at 0.25 px per mm (so
           the scans clear the footer; the two patches stay to scale with each other and the
           body). The second scan comes in and its box grows from the first's size to its own,
           as the main slide's second patch does. No turn (the critic: the turns added nothing
           the transcript says, and competed with the chart's first points).

The clip is short and starts when the slide reaches it (alts/useAt.js), waiting paused on its
first frame until then, so a late start can never pull it out of step with the slide.

Writes (portfolio repo):
  public/seminar-decks/clips/plain-a-grow1.mp4 + .png   slide 12: the second scan comes in and
                                                        its patch grows (hold = the finished state)
  src/components/portal/modules/seminar-decks/decks/plain/alts/s4_12.gen.js
Run (portfolio root): python -I tools/seminar-decks/make_plain_3d_s4_12.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import plain3d as P  # noqa: E402

FACTS_JS = P.PORTFOLIO / 'src' / 'components' / 'portal' / 'modules' / 'seminar-decks' / 'shared' / 'facts.js'
OUT_JS = P.ALTS / 's4_12.gen.js'
FPS = 30
SCALE = 2
ACC = np.array(P.ACCENT, np.float32)

# ── slide timing (seconds from entering the slide; see the components) ──
S12_K = 0.25             # px per mm (the main slide draws its flat patches at 0.3; 0.25 keeps the
                         # scans clear of the footer, ending at about y 957)
S12_COLS = (1150, 1540)  # geometry.js S12.cols
S12_TOP = 742            # geometry.js S12.top
S12_RIGHT_IN = (15.8, 16.2)   # the second body fades in (as col-1 at 15.8)
S12_GROW = (16.2, 17.2)       # its box grows from the small patch to the large (main: 16.2 to 17.2)
S12_CLIPS = ((12.2, 17.5),)   # slide times the clip covers (start, last frame)
S12_STROKE = 3           # main slide: .dp12-patch stroke-width 3
S12_HALF = 112           # display px either side of each column kept in the clip
WASH = 0.07              # --dp-accent-wash


def facts():
    """value of each `'key': f(value, ...)` entry in shared/facts.js (numbers and strings)."""
    txt = FACTS_JS.read_text(encoding='utf-8')
    out = {}
    for m in re.finditer(r"'([\w.]+)':\s*f\(\s*('([^']*)'|[-\d.]+)\s*,", txt):
        out[m.group(1)] = m.group(3) if m.group(3) is not None else float(m.group(2))
    return out


def dims_large(F):
    z, y, x = (float(v) for v in F['patch.large_mm'].split(' x '))
    return z, y, x


class Box:
    """An axis-aligned box in the scan's physical frame (mm): centre (x, y) and z range."""

    def __init__(self, cx, cy, z0, z1, wx, wy):
        self.cx, self.cy, self.z0, self.z1, self.wx, self.wy = cx, cy, z0, z1, wx, wy

    def corners_xy(self):
        hx, hy = self.wx / 2, self.wy / 2
        return [(self.cx + sx * hx, self.cy + sy * hy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


def project(T, box, theta):
    """The box at this angle in the Turner's output pixels: the four vertical edges
    (x, depth) and the top and bottom rows. Rotation as the volume's: a point q shows at
    R(-theta)(q - c) + c (SimpleITK resamples output p from input T(p))."""
    th = math.radians(T.quantise(theta))
    c, s = math.cos(-th), math.sin(-th)
    cxm, cym = T.centre[0], T.centre[1]
    sx, sz = T.sx, T.sz
    fx = T.out_w / (T.xb - T.xa)
    fz = T.out_h / T.Z
    verts = []
    for (x, y) in box.corners_xy():
        dx, dy = x - cxm, y - cym
        px, py = cxm + c * dx - s * dy, cym + s * dx + c * dy
        verts.append(((px / sx + 0.5 - T.xa) * fx, py))
    rows = [(T.Z - 0.5 - z / sz) * fz for z in (box.z1, box.z0)]  # top, bottom
    return verts, rows


def draw_box(rgb, T, box, theta, stroke, dim=0.0, wash=0.0):
    """Dim outside the box's projection (slide 4), wash inside (slide 12), then its edges:
    the silhouette and the nearest vertical edge solid, the farthest one dashed (behind)."""
    verts, (r0, r1) = project(T, box, theta)
    xs = [v[0] for v in verts]
    x0, x1 = min(xs), max(xs)
    H, W = rgb.shape[:2]
    ia, ib = int(round(max(0, x0))), int(round(min(W, x1)))
    ja, jb = int(round(max(0, r0))), int(round(min(H, r1)))
    if dim > 0:
        keep = np.zeros((H, W), bool)
        keep[ja:jb, ia:ib] = True
        rgb[~keep] = rgb[~keep] * (1 - dim) + P.WHITE * dim
    if wash > 0:
        rgb[ja:jb, ia:ib] = rgb[ja:jb, ia:ib] * (1 - wash) + ACC * wash
    im = Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    w = int(round(stroke * SCALE))
    col = tuple(int(v) for v in P.ACCENT)
    order = sorted(range(4), key=lambda i: verts[i][1])  # by depth (y; larger = nearer the viewer)
    far = order[0]
    sil = {xs.index(x0), xs.index(x1)}
    for i in range(4):
        x = verts[i][0]
        if i == far and i not in sil:
            n = max(2, int((r1 - r0) / (6 * SCALE)))
            for k in range(0, n, 2):
                ya = r0 + (r1 - r0) * k / n
                yb = r0 + (r1 - r0) * min(n, k + 1) / n
                d.line([(x, ya), (x, yb)], fill=col, width=max(1, w // 2))
        else:
            d.line([(x, r0), (x, r1)], fill=col, width=w)
    for r in (r0, r1):
        d.line([(x0 - w / 2 + 0.5, r), (x1 + w / 2 - 0.5, r)], fill=col, width=w)
    return np.asarray(im, np.float32)


def check_rotation(T, scan):
    """A lesion's centroid, rotated by project()'s rule, must land on its mask in the frame."""
    lab, n = scan.labels()
    sizes = np.bincount(lab.ravel())
    big = int(np.argmax(sizes[1:]) + 1)
    zz, yy, xx = np.nonzero(lab == big)
    q = (xx.mean() * T.sx, yy.mean() * T.sx, zz.mean() * T.sz)
    for deg in (0, 60, 135):
        th = math.radians(deg)
        pr = T.projections(th, need=('lab',))
        m = T.lesion_mask(pr, ids=[big])
        rr, cc = np.nonzero(m)
        c, s = math.cos(-th), math.sin(-th)
        dx, dy = q[0] - T.centre[0], q[1] - T.centre[1]
        px = T.centre[0] + c * dx - s * dy
        col = (px / T.sx + 0.5 - T.xa) * T.out_w / (T.xb - T.xa)
        err = abs(col - cc.mean())
        assert err < 3 * SCALE, f'rotation check failed at {deg} deg: {err:.1f} px'
    return True


def build_s12(F, scan):
    T = P.Turner(scan, display_h=scan.pet.shape[0] * scan.spacing[2] * S12_K, scale=SCALE, pad_mm=140.0, step_deg=1.0)
    check_rotation(T, scan)
    sz_, sy_, sx_ = float(F['patch.small_z_mm']), float(F['patch.small_y_mm']), float(F['patch.small_x_mm'])
    lz, ly, lx = dims_large(F)
    axis_x, axis_y = T.centre[0], T.centre[1]
    zmid = T.centre[2]

    def box_at(u):
        """u = 0: the final model's patch; 1: the larger one; both centred on the body."""
        e = P.smooth(u)
        z, y, x = sz_ + (lz - sz_) * e, sy_ + (ly - sy_) * e, sx_ + (lx - sx_) * e
        return Box(axis_x, axis_y, zmid - z / 2, zmid + z / 2, x, y)

    # The clip: both columns, S12_HALF display px either side of each, and the bodies' height.
    left = S12_COLS[0] - S12_HALF
    W = int(round((S12_COLS[1] + S12_HALF - left) * SCALE / 2) * 2)
    H = T.out_h
    axis_col = (axis_x / T.sx + 0.5 - T.xa) * T.out_w / (T.xb - T.xa)  # in a body frame, output px

    def body(theta, u, alpha=1.0):
        pr = T.projections(theta, need=('pet',))
        rgb = T.base(pr, pet_a=1.0, ct_a=0.0)
        rgb = draw_box(rgb, T, box_at(u), theta, S12_STROKE, wash=WASH)
        if alpha < 1.0:
            rgb = rgb * alpha + P.WHITE * (1 - alpha)
        return rgb

    def canvas(theta, u_right, a_right):
        cv = np.empty((H, W, 3), np.float32)
        cv[:] = P.WHITE
        for c, (u, a) in enumerate(((0.0, 1.0), (u_right, a_right))):
            if a <= 0:
                continue
            b = body(theta, u, a)
            ox = int(round((S12_COLS[c] - left) * SCALE - axis_col))
            xa, xb = max(0, ox), min(W, ox + b.shape[1])
            cv[:, xa:xb] = np.minimum(cv[:, xa:xb], b[:, xa - ox:xb - ox])
        return np.clip(cv + 0.5, 0, 255).astype(np.uint8)

    front = canvas(0.0, 1.0, 1.0)

    # the clip: the first scan alone, the second comes in, its patch grows; then it holds
    c0, c1 = S12_CLIPS[0]
    enc = P.Encoder(P.CLIPS / 'plain-a-grow1.mp4', W, H, FPS, crf=22)
    enc.hold(canvas(0.0, 0.0, 0.0), int(round((S12_RIGHT_IN[0] - c0) * FPS)))
    a0, a1 = S12_RIGHT_IN
    n = int(round((a1 - a0) * FPS))
    for i in range(n):
        enc.write(canvas(0.0, 0.0, P.smooth((i + 1) / n)))
    g0, g1 = S12_GROW
    n = int(round((g1 - g0) * FPS))
    for i in range(1, n + 1):
        enc.write(canvas(0.0, i / n, 1.0))
    enc.hold(front, int(round((c1 - c0) * FPS)) - enc.n)
    size1, n1 = enc.close(), enc.n
    Image.fromarray(front).save(P.CLIPS / 'plain-a-grow1.png', optimize=True)
    return {'left': left, 'top': S12_TOP, 'w': W / SCALE, 'h': H / SCALE, 'rightIn': list(S12_RIGHT_IN),
            'grow': list(S12_GROW), 'clips': [list(c) for c in S12_CLIPS],
            'clip': [W, H], 'seconds': [round(n1 / FPS, 3)], 'bytes': [size1]}


def main():
    F = facts()
    scan = P.load_a(with_ct=False)
    gen = {'s12': build_s12(F, scan)}
    print('s12', json.dumps(gen['s12']))
    js = ('// Generated by tools/seminar-decks/make_plain_3d_s4_12.py; do not edit.\n'
          '// Slide 12, second option: where its clip sits and when it plays (seconds from entry).\n'
          f'export const S4_12 = {json.dumps(gen)};\n')
    OUT_JS.write_text(js, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
