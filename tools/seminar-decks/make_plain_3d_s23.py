#!/usr/bin/env python3
"""
SEMINAR DECKS -- the plain deck's second options for slides 2 and 3: the scan turning in 3D.

Both clips are drawn by the shared turn engine (plain3d.py) from the same files, loaders and
projection as the main slides' stills, and both play from the moment the slide is entered, so
every time below is in seconds from entering the slide (the slides' own timelines use the same
times, from alts/s23.gen.js, which this script writes).

Slide 2 (study A, Figure 2.1 (a)); this clip starts 31.5 s into the slide, waiting paused and
preloaded until then (alts/useAt.js), so a late start cannot pull it out of step. The PET appears
and turns once about the head-to-toe axis;
during the turn the CT fuses in (at the opacity the slide's fused view uses); the turn lands on
the front view, which is the still's own projection, and the slide cross-fades to its layers.
    public/seminar-decks/clips/plain-a-turn.mp4 (+ .png, its last frame)

Slide 3 (study B, the over-100-lesion scan): the scan turns once while its lesions appear in
quick succession, head to toe (the label's own 26-connected components, ordered by their centre
from the head down), in the slides' outline style; it lands on the front view with every lesion
drawn (outlines rasterised as the slide's SVG draws them), which is the still's projection
with its outlines.
    public/seminar-decks/clips/plain-b-turn.mp4 (+ .png)

    python -I tools/seminar-decks/make_plain_3d_s23.py [s2] [s3]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I leaves the script's folder off the path
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import plain3d as P  # noqa: E402

FPS = 30
GEN = P.ALTS / 's23.gen.js'
MAX_MB = 5.0

# Slide 2 (plain deck geometry S2: study A at k = 0.76 px per mm)
S2_K = 0.76
S2 = {'start': 31.5, 'turn0': 32.0, 'turn1': 41.6, 'ct0': 37.6, 'ct1': 39.0, 'ct_a': 0.75, 'end': 42.9}
# Slide 3 (geometry S3: study B 650 px tall; 'many' sits 34 px right of the scan)
S3_H = 650.0
S3 = {'turn0': 0.6, 'turn1': 7.0, 'les0': 0.9, 'les1': 6.1, 'fade': 0.2, 'end': 7.9}


def theta_at(t, t0, t1):
    if t >= t1:
        return 0.0                                  # the front view, exactly
    return 2 * math.pi * P.smooth((t - t0) / (t1 - t0))



def svg_outline(rgb, m, scale, alpha=1.0, casing=3.0, edge=1.6, fill_a=0.35):
    """The slide's SVG outline, rasterised: the fill over the whole region, then a white casing
    and the accent edge, each stroke CENTRED on the region's boundary as SVG draws it
    (dp3-outlines: casing 3 px, edge 1.6 px, in display px), so the clip's landed frame
    matches the slide's own outlines."""
    if alpha <= 0 or not m.any():
        return rgb
    c = max(1, int(round(casing / 2 * scale)))
    e = max(1, int(round(edge / 2 * scale)))
    ring = lambda r: (P._band(m, r) & ~m) | (m & ~P._erode(m, r))  # noqa: E731
    fill = np.array(P.ACCENT_SOFT, np.float32)
    acc = np.array(P.ACCENT, np.float32)
    a = fill_a * alpha
    rgb[m] = rgb[m] * (1 - a) + fill * a
    cas = ring(c)
    rgb[cas] = rgb[cas] * (1 - alpha) + P.WHITE * alpha
    ed = ring(e)
    rgb[ed] = rgb[ed] * (1 - alpha) + acc * alpha
    return rgb

def edge_ink(frame):
    """Darkest value in the outermost two columns (255 = clean)."""
    return int(min(frame[:, :2].min(), frame[:, -2:].min()))


def encode(path, frames, w, h, crf):
    """frames: iterable of (key, make) where equal keys reuse the previous frame."""
    enc = P.Encoder(path, w, h, FPS, crf)
    last_key, last = None, None
    worst = 255
    for key, make in frames:
        if key != last_key:
            last = make()
            last_key = key
            worst = min(worst, edge_ink(last))
        enc.write(last)
    size = enc.close()
    return last, size, worst


def build_s2(crf=21):
    scan = P.load_a(with_ct=True)
    T = P.Turner(scan, display_h=scan.p['height_mm'] * S2_K, scale=2, pad_mm=70, step_deg=0.25)
    n = int(round((S2['end'] - S2['start']) * FPS))

    def ct_at(t):
        return S2['ct_a'] * P.smooth((t - S2['ct0']) / (S2['ct1'] - S2['ct0']))

    def frames():
        for i in range(n + 1):
            t = S2['start'] + i / FPS             # the clip starts at S2['start'] (alts/useAt.js)
            th = theta_at(t, S2['turn0'], S2['turn1'])
            ca = round(ct_at(t), 3)
            key = (T.quantise(th), ca)

            def make(th=th, ca=ca):
                need = ('pet', 'ct') if ca > 0 else ('pet',)
                pr = T.projections(th, need=need)
                return T.done(T.base(pr, 1.0, ca))
            yield key, make

    out = P.CLIPS / 'plain-a-turn.mp4'
    last, size, worst = encode(out, frames(), T.out_w, T.out_h, crf)
    Image.fromarray(last, 'RGB').save(out.with_suffix('.png'), optimize=True)
    # angle 0 with the CT at 0.75 against the slide's own layers (the cross-fade target)
    fig = P.PORTFOLIO / 'public' / 'seminar-decks' / 'figures'
    pet, ct = Image.open(fig / 'plain-a-pet.png').convert('RGBA'), Image.open(fig / 'plain-a-ct.png').convert('RGBA')
    ct_arr = np.asarray(ct).copy()
    ct_arr[..., 3] = np.round(ct_arr[..., 3] * S2['ct_a']).astype(np.uint8)
    bg = Image.new('RGBA', pet.size, (255, 255, 255, 255))
    bg.alpha_composite(Image.fromarray(ct_arr, 'RGBA'))
    bg.alpha_composite(pet)
    W0 = int(round((T.c1 - T.c0) * T.sx * T.k * T.scale))
    x0 = int(round(T.pad_cols * T.sx * T.k * T.scale))
    still = np.asarray(bg.convert('RGB').resize((W0, T.out_h), Image.NEAREST), np.float32)
    d = np.abs(still - last[:, x0:x0 + W0].astype(np.float32))
    return {'clip': out.name, 'bytes': size, 'seconds': round((n + 1) / FPS, 3), 'size': [T.out_w, T.out_h],
            'padCols': T.pad_cols, 'cols': T.xb - T.xa, 'edgeInkMin': worst,
            'vsStill': {'meanAbs': round(float(d.mean()), 3), 'pxOver8': int((d.max(axis=2) > 8).sum()), 'px': int(d.shape[0] * d.shape[1])}}


def build_s3(crf=21):
    scan = P.load_b()
    lab, n_lab = scan.labels()
    # appearance order: centre from the head down (array z grows toward the head)
    zz = np.nonzero(lab)[0]
    ids = lab[lab > 0]
    zc = np.bincount(ids, weights=zz, minlength=n_lab + 1)[1:] / np.maximum(np.bincount(ids, minlength=n_lab + 1)[1:], 1)
    order = [int(k) + 1 for k in np.argsort(-zc, kind='stable')]
    span = S3['les1'] - S3['les0']
    appear = {cid: S3['les0'] + span * i / max(1, n_lab - 1) for i, cid in enumerate(order)}

    # pad: the turning frame must stay clear of the 'Over 100 lesions' label (34 px right of the scan)
    k = S3_H / scan.p['height_mm']
    pad_mm = 28.0 / k
    T = P.Turner(scan, display_h=S3_H, scale=2, pad_mm=pad_mm, step_deg=0.25)
    n = int(round(S3['end'] * FPS))

    def state(t):
        full = tuple(c for c in order if t >= appear[c] + S3['fade'])
        fading = tuple((c, round((t - appear[c]) / S3['fade'], 2)) for c in order if appear[c] <= t < appear[c] + S3['fade'])
        return full, fading

    def frames():
        for i in range(n + 1):
            t = i / FPS
            th = theta_at(t, S3['turn0'], S3['turn1'])
            full, fading = state(t)
            key = (T.quantise(th), len(full), fading)

            def make(th=th, full=full, fading=fading):
                need = ('pet', 'lab') if (full or fading) else ('pet',)
                pr = T.projections(th, need=need)
                rgb = T.base(pr, 1.0, 0.0)
                if full:
                    rgb = svg_outline(rgb, T.lesion_mask(pr, set(full)), T.scale)
                for cid, a in fading:
                    rgb = svg_outline(rgb, T.lesion_mask(pr, {cid}), T.scale, alpha=P.smooth(a))
                T._cache.clear()  # the cache would keep a full rotated label volume per angle
                return T.done(rgb)
            yield key, make

    out = P.CLIPS / 'plain-b-turn.mp4'
    last, size, worst = encode(out, frames(), T.out_w, T.out_h, crf)
    Image.fromarray(last, 'RGB').save(out.with_suffix('.png'), optimize=True)
    # the landed frame's lesion pixels against the still's projected mask
    pr0 = T.projections(0.0, need=('pet', 'lab'))
    m_all = T.lesion_mask(pr0)
    T._cache.clear()
    mproj = scan.p['mproj'][::-1]
    W0 = int(round((T.c1 - T.c0) * T.sx * T.k * T.scale))
    x0 = int(round(T.pad_cols * T.sx * T.k * T.scale))
    still_m = np.asarray(Image.fromarray(mproj.astype(np.uint8) * 255).resize((W0, T.out_h), Image.NEAREST)) > 0
    mine = m_all[:, x0:x0 + W0]
    w = min(mine.shape[1], still_m.shape[1])
    mism = int((mine[:, :w] != still_m[:, :w]).sum())
    return {'clip': out.name, 'bytes': size, 'seconds': round((n + 1) / FPS, 3), 'size': [T.out_w, T.out_h],
            'padCols': T.pad_cols, 'cols': T.xb - T.xa, 'edgeInkMin': worst, 'lesions': n_lab,
            'maskVsStill': {'mismatchPx': mism, 'stillPx': int(still_m.sum())}}


def main():
    which = sys.argv[1:] or ['s2', 's3']
    gen = {}
    if GEN.exists():
        txt = GEN.read_text(encoding='utf-8')
        for name in ('TURN2', 'TURN3'):
            i = txt.find(f'export const {name} = ')
            if i >= 0:
                j = txt.index(';\n', i)
                gen[name] = json.loads(txt[i + len(f'export const {name} = '):j])
    if 's2' in which:
        r = build_s2()
        if r['bytes'] > MAX_MB * 1e6:
            r = build_s2(crf=24)
        print('s2', json.dumps(r))
        gen['TURN2'] = {**S2, 'land': S2['turn1'], 'padCols': r['padCols'], 'cols': r['cols'], 'seconds': r['seconds']}
    if 's3' in which:
        r = build_s3()
        if r['bytes'] > MAX_MB * 1e6:
            r = build_s3(crf=24)
        print('s3', json.dumps(r))
        gen['TURN3'] = {**S3, 'land': S3['turn1'], 'padCols': r['padCols'], 'cols': r['cols'], 'seconds': r['seconds'],
                        'lesions': r['lesions']}
    head = ('// Generated by tools/seminar-decks/make_plain_3d_s23.py; do not edit.\n'
            '// Slides 2 and 3, second options: where each turning clip sits on its still (projection\n'
            '// columns: it starts `padCols` columns left of the still and spans `cols`) and its times,\n'
            '// in seconds from entering the slide (the clip plays from entry).\n')
    body = ''.join(f'export const {k} = {json.dumps(v, separators=(", ", ": "))};\n' for k, v in sorted(gen.items()))
    GEN.write_text(head + body, encoding='utf-8', newline='\n')
    print('wrote', GEN)


if __name__ == '__main__':
    main()
