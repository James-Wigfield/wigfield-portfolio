"""The leaf atlas for the v2 plants: four cells of foliage sprites with alpha, drawn here (no downloaded packs).

    python leaves.py <work>

Writes <work>/data/tex/leaves.png (1024 x 1024 RGBA, 2 x 2 cells of 512):
  cell 0 (top-left)     Olearia axillaris (coastal daisy bush): small narrow silvery grey-green leaves, dense
  cell 1 (top-right)    Scaevola crassifolia / Rhagodia: bright green rounded fleshy leaves
  cell 2 (bottom-left)  Acacia rostellifera: dark olive narrow phyllodes, some yellowing
  cell 3 (bottom-right) Spinifex longifolius: long thin blades, pale grey-green to straw
Each cell is one foliage clump seen side-on (a card): twigs from the bottom centre, leaves along them, so a card
reads as a piece of bush, not a flat disc. Colours from the reference photos (Peron, 2019-2023).
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W = sys.argv[1]
OUT = os.path.join(W, 'data', 'tex')
os.makedirs(OUT, exist_ok=True)
S = 512
SS = 2  # supersample
rng = np.random.default_rng(12)


def jitter(c, amt):
    return tuple(int(np.clip(v + rng.normal(0, amt), 0, 255)) for v in c)


def leaf(dr, x, y, ang, ln, wd, col):
    """an elliptic leaf from (x, y) pointing along ang: two halves in slightly different tones (the light catches
    one side of the midrib), the midrib itself a darker line"""
    lo = tuple(int(c * 0.82) for c in col[:3]) + (255,)
    hi = tuple(min(255, int(c * 1.1)) for c in col[:3]) + (255,)
    half = []
    for k in range(14):
        t = k / 13
        r = math.sin(math.pi * t) * wd / 2
        half.append((x + math.cos(ang) * ln * t - math.sin(ang) * r, y + math.sin(ang) * ln * t + math.cos(ang) * r))
    spine = [(x + math.cos(ang) * ln * t, y + math.sin(ang) * ln * t) for t in (1.0, 0.0)]
    dr.polygon(half + spine, fill=hi)
    half2 = []
    for k in range(14):
        t = k / 13
        r = math.sin(math.pi * t) * wd / 2
        half2.append((x + math.cos(ang) * ln * t + math.sin(ang) * r, y + math.sin(ang) * ln * t - math.cos(ang) * r))
    dr.polygon(half2 + spine, fill=lo)
    dr.line([spine[1], spine[0]], fill=tuple(int(c * 0.65) for c in col[:3]) + (255,), width=max(1, int(wd / 6)))
    return
    pts = []
    for k in range(14):
        t = k / 13
        r = math.sin(math.pi * t) * wd / 2
        px = x + math.cos(ang) * ln * t
        py = y + math.sin(ang) * ln * t
        pts.append((px - math.sin(ang) * r, py + math.cos(ang) * r))
    for k in range(13, -1, -1):
        t = k / 13
        r = math.sin(math.pi * t) * wd / 2
        px = x + math.cos(ang) * ln * t
        py = y + math.sin(ang) * ln * t
        pts.append((px + math.sin(ang) * r, py - math.cos(ang) * r))
    dr.polygon(pts, fill=col)


def clump(kind):
    img = Image.new('RGBA', (S * SS, S * SS), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    cx, base = S * SS / 2, S * SS * 0.98
    if kind == 'spinifex':
        for _ in range(70):
            ang = -math.pi / 2 + rng.normal(0, 0.55)
            ln = rng.uniform(0.45, 0.95) * S * SS
            bend = rng.normal(0, 0.25)
            col = jitter((168, 170, 128), 18) if rng.random() < 0.75 else jitter((200, 182, 120), 15)
            x, y = cx + rng.normal(0, 18), base
            w = rng.uniform(5, 9)
            for k in range(30):
                t = k / 30
                a2 = ang + bend * t
                nx, ny = x + math.cos(a2) * ln / 30, y + math.sin(a2) * ln / 30
                dr.line([(x, y), (nx, ny)], fill=col + (255,), width=max(2, int(w * (1 - 0.8 * t))))
                x, y = nx, ny
        return img
    spec = {
        'olearia': dict(leaf=(30, 8), cols=[(128, 142, 116), (108, 124, 98), (150, 162, 136), (94, 108, 86)], n=1500,
                        twig=(110, 104, 92)),
        'scaevola': dict(leaf=(24, 14), cols=[(86, 140, 58), (70, 122, 48), (104, 156, 70), (58, 104, 40)], n=1250,
                         twig=(92, 84, 64)),
        'acacia': dict(leaf=(42, 7), cols=[(78, 94, 52), (64, 80, 44), (96, 108, 62), (120, 118, 64)], n=1300,
                       twig=(84, 72, 56)),
    }[kind]
    # twigs: a few forks from the base
    tips = []
    for _ in range(9):
        ang = -math.pi / 2 + rng.normal(0, 0.7)
        x, y = cx + rng.normal(0, 25), base
        ln = rng.uniform(0.35, 0.8) * S * SS
        for k in range(12):
            a2 = ang + rng.normal(0, 0.12)
            nx, ny = x + math.cos(a2) * ln / 12, y + math.sin(a2) * ln / 12
            dr.line([(x, y), (nx, ny)], fill=spec['twig'] + (255,), width=max(2, int(9 * (1 - k / 12))))
            x, y = nx, ny
            if k > 3:
                tips.append((x, y))
    # leaves: dense in a rounded crown, thinning at the edges
    L, Wd = spec['leaf']
    for _ in range(spec['n']):
        r = math.sqrt(rng.random()) * 0.46 * S * SS
        th = rng.uniform(0, 2 * math.pi)
        x = cx + r * math.cos(th)
        y = S * SS * 0.47 + r * math.sin(th) * 0.92
        if y > base - 10:
            continue
        ang = rng.uniform(0, 2 * math.pi)
        col = spec['cols'][rng.integers(0, len(spec['cols']))]
        shade = 0.75 + 0.25 * (1 - r / (0.46 * S * SS)) + rng.normal(0, 0.05)
        col = tuple(int(np.clip(c * shade, 0, 255)) for c in col)
        leaf(dr, x, y, ang, L * SS * rng.uniform(0.7, 1.2), Wd * SS * rng.uniform(0.8, 1.2), col + (255,))
    return img


cells = [clump('olearia'), clump('scaevola'), clump('acacia'), clump('spinifex')]
atlas = Image.new('RGBA', (S * 2, S * 2), (0, 0, 0, 0))
for k, c in enumerate(cells):
    c = c.resize((S, S), Image.LANCZOS)
    atlas.paste(c, ((k % 2) * S, (k // 2) * S))
# bleed colour into the transparent texels (so mipmaps don't fringe dark)
arr = np.asarray(atlas).astype(np.float32)
alpha = arr[..., 3:] / 255
rgb = arr[..., :3]
from scipy import ndimage as ndi  # noqa: E402

num = ndi.gaussian_filter(rgb * alpha, (6, 6, 0))
den = ndi.gaussian_filter(alpha, (6, 6, 0))
fill = num / np.maximum(den, 1e-4)
rgb = np.where(alpha > 0.5, rgb, fill)
out = np.dstack([rgb, arr[..., 3]]).clip(0, 255).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'leaves.png'), optimize=True)
print('leaves.png', os.path.getsize(os.path.join(OUT, 'leaves.png')) // 1024, 'KB')
