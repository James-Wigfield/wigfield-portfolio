"""Tileable ground textures for a v2 landscape, generated here (no downloaded packs): procedural height + colour
fields made periodic by filtering on a torus (scipy mode='wrap'), then a normal map from the height.

    python textures.py <work> [--size 512]

Writes <work>/data/tex/<name>-a.png (sRGB colour) and <name>-n.png (tangent-space normal in RG, height in B), both
opaque (an alpha channel would be premultiplied away by the browser's 2D-canvas decode), for each of
  sand, limestone, soil, weed, path, concrete, bitumen
plus tex.json (tile sizes in metres, one roughness per layer). The runtime samples two scales and blends them to
hide the repeat. Colours follow the reference photos (Point Peron: golden-cream beach sand, cream-grey honeycombed
Tamala limestone, grey-brown heath floor with litter, dark Posidonia seagrass).
"""
import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument('work')
ap.add_argument('--size', type=int, default=512)
a = ap.parse_args()
S = a.size
OUT = os.path.join(a.work, 'data', 'tex')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(5)
ROUGH = {}
TILE = {}


def noise(sigma, seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    n = ndi.gaussian_filter(g.standard_normal((S, S)).astype(np.float32), sigma, mode='wrap')
    return (n - n.mean()) / (n.std() + 1e-6)


def fbm(sigmas, weights, seed=None):
    g = np.random.default_rng(seed)
    out = sum(w * noise(s, int(g.integers(1 << 30))) for s, w in zip(sigmas, weights))
    return out / np.sqrt(sum(w * w for w in weights))


def worley(n_pts, seed=0):
    """F1, F2 distances to random points on the torus (pixels)."""
    g = np.random.default_rng(seed)
    pts = g.uniform(0, S, (n_pts, 2))
    gy, gx = np.mgrid[0:S, 0:S].astype(np.float32)
    f1 = np.full((S, S), 1e9, np.float32)
    f2 = np.full((S, S), 1e9, np.float32)
    for px, py in pts:
        dx = np.abs(gx - px)
        dx = np.minimum(dx, S - dx)
        dy = np.abs(gy - py)
        dy = np.minimum(dy, S - dy)
        d = np.sqrt(dx * dx + dy * dy)
        f2 = np.where(d < f1, f1, np.minimum(f2, d))
        f1 = np.minimum(f1, d)
    return f1, f2


def specks(count, radius, seed):
    g = np.random.default_rng(seed)
    m = np.zeros((S, S), np.float32)
    ys = g.integers(0, S, count)
    xs = g.integers(0, S, count)
    m[ys, xs] = g.uniform(0.5, 1.0, count)
    return np.clip(ndi.gaussian_filter(m, radius, mode='wrap') * (2 * np.pi * radius * radius), 0, 1)


def srgb(c):
    return np.asarray(c, np.float32) / 255.0


def normal_map(hgt, strength):
    gy, gx = np.gradient(np.pad(hgt, 1, mode='wrap'))
    gx, gy = gx[1:-1, 1:-1], gy[1:-1, 1:-1]
    nx, ny, nz = -gx * strength, gy * strength, np.ones_like(gx)   # +y up in the image = -row
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / ln, ny / ln


def save(name, col, hgt, strength, rough):
    h01 = (hgt - hgt.min()) / (hgt.max() - hgt.min() + 1e-6)
    nx, ny = normal_map(hgt, strength)
    full = np.full((S, S), 255, np.float32)
    A = np.dstack([np.clip(col, 0, 1) * 255, full])
    Nm = np.dstack([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, h01 * 255, full])
    Image.fromarray(A.round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{name}-a.png'), optimize=True)
    Image.fromarray(Nm.round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{name}-n.png'), optimize=True)
    ROUGH[name] = float(np.mean(rough))
    # a quick look: colour shaded by the normal from the north-west
    shade = np.clip(0.75 + 0.6 * (-nx * 0.6 + ny * 0.6), 0, 1.3)
    Image.fromarray(np.clip(col * shade[..., None] * 255, 0, 255).astype(np.uint8)).save(
        os.path.join(OUT, f'_{name}-look.png'))


yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S

# ---- sand: fine grain, wind ripples (~8 cm) bending with a slow noise, a few shell grits. Tile 2 m.
warp = fbm([40, 90], [1, 0.6], seed=1) * 0.05
rip = np.sin(2 * np.pi * (24 * (yy + 0.25 * xx)) + 9 * warp * np.pi)
rip = rip * (0.5 + 0.5 * np.clip(fbm([60], [1], seed=2), -1, 1))
grain = noise(0.6, 3)
hgt = 0.6 * rip + 0.25 * grain + 0.8 * fbm([30, 80], [1, 1], seed=4)
base = srgb([206, 176, 122])   # golden (the beach photos)
tone = fbm([6, 25, 70], [0.3, 0.6, 1.0], seed=5)
col = base[None, None] * (1 + 0.06 * tone[..., None] + 0.05 * grain[..., None])
grit = specks(900, 0.6, 6)
col = col * (1 - 0.35 * grit[..., None]) + srgb([245, 238, 225]) * 0.35 * grit[..., None]
dark = specks(500, 0.5, 7)
col = col * (1 - 0.3 * dark[..., None])
save('sand', col, hgt, 2.2, 0.92)
TILE['sand'] = 2.0

# ---- limestone (Tamala): honeycomb pits (worley), solution pans, crusty ridges; cream-grey, dark in the pits.
f1, f2 = worley(260, 8)
cells = (f2 - f1)
pits = np.clip(1 - f1 / 14, 0, 1) ** 2
ridges = np.clip(1 - cells / 6, 0, 1)
crust = fbm([1.5, 5, 20], [0.4, 0.8, 1], seed=9)
hgt = -1.4 * pits + 0.5 * ridges + 0.6 * crust
base = srgb([186, 166, 128])   # golden-cream Tamala limestone; grey where it has weathered (below)
col = base[None, None] * (1 + 0.1 * crust[..., None])
grey = np.clip(fbm([18, 50], [1, 1], seed=12) * 0.8, 0, 1)
col = col * (1 - 0.45 * grey[..., None]) + srgb([150, 148, 140]) * 0.45 * grey[..., None]
col = col * (1 - 0.45 * pits[..., None]) + srgb([120, 104, 80]) * 0.25 * pits[..., None]
lichen = np.clip(fbm([10, 30], [1, 1], seed=10) - 0.9, 0, 1)
col = col * (1 - 0.4 * lichen[..., None]) + srgb([150, 150, 120]) * 0.4 * lichen[..., None]
ocre = np.clip(fbm([25, 60], [1, 1], seed=11) - 1.0, 0, 1)
col = col * (1 - 0.5 * ocre[..., None]) + srgb([214, 168, 110]) * 0.5 * ocre[..., None]
save('limestone', col, hgt, 3.5, 0.88)
TILE['limestone'] = 3.0

# ---- heath soil: grey-brown sand under the plants, leaf litter, twigs.
grain = noise(0.7, 12)
hgt = 0.3 * grain + 0.7 * fbm([8, 30], [1, 1], seed=13)
base = srgb([112, 100, 80])
tone = fbm([4, 16, 60], [0.4, 0.8, 1], seed=14)
col = base[None, None] * (1 + 0.12 * tone[..., None] + 0.06 * grain[..., None])
litter = specks(1400, 1.2, 15)
col = col * (1 - 0.5 * litter[..., None]) + srgb([92, 72, 48]) * 0.5 * litter[..., None]
leaves = specks(500, 1.8, 16)
col = col * (1 - 0.5 * leaves[..., None]) + srgb([150, 140, 96]) * 0.5 * leaves[..., None]
pale = specks(700, 0.7, 17)
col = col * (1 - 0.3 * pale[..., None]) + srgb([200, 186, 150]) * 0.3 * pale[..., None]
twig = np.zeros((S, S), np.float32)
g = np.random.default_rng(18)
for _ in range(160):
    x0, y0 = g.uniform(0, S, 2)
    ang = g.uniform(0, np.pi)
    ln = g.uniform(6, 26)
    for t in np.linspace(0, 1, int(ln * 2)):
        twig[int(y0 + np.sin(ang) * ln * t) % S, int(x0 + np.cos(ang) * ln * t) % S] = 1
twig = np.clip(ndi.gaussian_filter(twig, 0.6, mode='wrap') * 3, 0, 1)
col = col * (1 - 0.55 * twig[..., None]) + srgb([70, 52, 34]) * 0.55 * twig[..., None]
hgt = hgt + 0.8 * litter + 0.6 * twig
save('soil', col, hgt, 2.0, 0.92)
TILE['soil'] = 2.0

# ---- weed: Posidonia seagrass seen from above: dark streaky blades on sand, swaying the same way.
str_ = np.sin(2 * np.pi * (60 * xx + 4 * fbm([20], [1], seed=19) * 0.05 * 60))
mat_ = np.clip(fbm([12, 40], [0.6, 1], seed=20) + 0.4, 0, 1)
hgt = 0.6 * str_ * mat_ + 0.6 * mat_
base = srgb([44, 62, 38])
col = base[None, None] * (1 + 0.25 * str_[..., None] * 0.5 + 0.2 * fbm([6, 30], [1, 1], seed=21)[..., None])
col = col * mat_[..., None] + srgb([150, 140, 100]) * (1 - mat_[..., None])
save('weed', col, hgt, 1.5, 0.9)
TILE['weed'] = 3.0

# ---- path: crushed limestone, compacted: pale cream-grey gravel, wheel-polished in places.
f1g, f2g = worley(1400, 22)
stones = np.clip(1 - f1g / 5.5, 0, 1)
hgt = 0.8 * stones + 0.4 * fbm([1, 12], [0.5, 1], seed=23)
base = srgb([200, 192, 172])
col = base[None, None] * (1 + 0.07 * fbm([1.5, 8, 40], [0.6, 0.8, 1], seed=24)[..., None])
col = col * (1 - 0.18 * (1 - stones)[..., None])
dots = specks(900, 0.8, 25)
col = col * (1 - 0.3 * dots[..., None]) + srgb([150, 135, 110]) * 0.3 * dots[..., None]
save('path', col, hgt, 2.6, 0.88)
TILE['path'] = 2.0

# ---- concrete (the battery, kerbs, the lookout pad): grey, aggregate, weathered stains.
agg = specks(2500, 0.6, 26)
stain = fbm([20, 60], [0.7, 1], seed=27)
hgt = 0.3 * agg + 0.25 * fbm([1, 6], [1, 1], seed=28)
base = srgb([168, 164, 154])
col = base[None, None] * (1 + 0.05 * fbm([2, 10], [1, 1], seed=29)[..., None] - 0.12 * np.clip(stain, 0, 2)[..., None])
col = col * (1 - 0.2 * agg[..., None]) + srgb([120, 112, 100]) * 0.2 * agg[..., None]
save('concrete', col, hgt, 1.6, 0.8)
TILE['concrete'] = 2.0

# ---- bitumen: dark grey, light aggregate, faded.
agg = specks(3000, 0.5, 30)
hgt = 0.5 * agg + 0.3 * noise(0.8, 31)
base = srgb([70, 70, 68])
col = base[None, None] * (1 + 0.08 * fbm([3, 20, 60], [0.5, 0.8, 1], seed=32)[..., None])
col = col * (1 - 0.5 * agg[..., None]) + srgb([150, 146, 138]) * 0.5 * agg[..., None]
save('bitumen', col, hgt, 1.8, 0.75)
TILE['bitumen'] = 2.0

# ---- brick pavers (the restored gun pit): red-orange, varied per brick, mortar lines, a stretcher bond.
bw, bh = S // 8, S // 16            # 8 bricks across a 2 m tile: 0.25 x 0.125 m
row = (np.arange(S)[:, None] // bh)
off = (row % 2) * (bw // 2)
col_i = ((np.arange(S)[None, :] + off) // bw)
bid = (row * 97 + col_i * 31) % 1009
g = np.random.default_rng(33)
tone_b = g.uniform(0.75, 1.15, 1009)[bid]
hue_b = g.uniform(-0.08, 0.08, 1009)[bid]
mort = ((np.arange(S)[:, None] % bh) < 2) | (((np.arange(S)[None, :] + off) % bw) < 2)
base = srgb([168, 82, 58])
col = base[None, None] * tone_b[..., None] * (1 + np.stack([hue_b, -hue_b * 0.5, -hue_b], -1))
col = col * (1 + 0.06 * noise(0.8, 34)[..., None])
col = np.where(mort[..., None], srgb([178, 170, 150])[None, None], col)
hgt = np.where(mort, -1.0, 0.0) + 0.15 * noise(1.2, 35)
save('brick', col, hgt, 2.4, 0.85)
TILE['brick'] = 2.0

json.dump({'size': S, 'tile': TILE, 'rough': ROUGH, 'order': list(TILE)}, open(os.path.join(OUT, 'tex.json'), 'w'),
          indent=1)
print('wrote', OUT, list(TILE))

# ---- the sea's normal map: a Phillips-spectrum height field (inverse FFT, so it tiles), wind from the south-west.
N_ = 512
kx = np.fft.fftfreq(N_) * N_
ky = np.fft.fftfreq(N_) * N_
KX, KY = np.meshgrid(kx, ky)
K = np.hypot(KX, KY) + 1e-6
wind = np.array([0.6, -0.8])
align = ((KX * wind[0] + KY * wind[1]) / K) ** 2
L = 18.0
P = np.exp(-1.0 / (K / L) ** 2) / K ** 4 * (0.25 + align) * np.exp(-(K / 140.0) ** 2)
P[0, 0] = 0
g = np.random.default_rng(40)
spec = (g.standard_normal((N_, N_)) + 1j * g.standard_normal((N_, N_))) * np.sqrt(P)
hgt = np.real(np.fft.ifft2(spec))
hgt = (hgt - hgt.mean()) / hgt.std()
gy_, gx_ = np.gradient(np.pad(hgt, 1, mode='wrap'))
gx_, gy_ = gx_[1:-1, 1:-1], gy_[1:-1, 1:-1]
sc = 0.9 / max(np.percentile(np.abs(gx_), 99), np.percentile(np.abs(gy_), 99))
wn = np.dstack([np.clip(0.5 + 0.5 * gx_ * sc, 0, 1) * 255, np.clip(0.5 + 0.5 * gy_ * sc, 0, 1) * 255,
                np.clip(0.5 + 0.25 * hgt, 0, 1) * 255, np.full((N_, N_), 255.0)])
Image.fromarray(wn.round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'waves.png'), optimize=True)
print('waves.png')
