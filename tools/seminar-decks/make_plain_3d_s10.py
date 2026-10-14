#!/usr/bin/env python3
"""
SEMINAR DECKS -- slide 10's second option, the second turn: study C with its result, in 3D.

Study C (deeppsma_0004, Figure 4.7 (b)) turns once about the body's axis with found, missed and
false alarm drawn on every angle in slide 10's own colours and style (the classes are
make_plain_spin.classes_and_case's: the app's saved run, classed as the app and Figure 4.7 class
them, with the app's counts checked). It starts and ends on the front view, which is the still's
own projection, so the slide fades it in over its outlines, turns, and fades back.
Same geometry as plain-c-spin.mp4 (DISPLAY_H 680, PAD_MM 70, SCALE 2), so it sits in the same box.

Writes public/seminar-decks/clips/plain-c-turn.mp4 and .png, and decks/plain/alts/s10.gen.js.
    python -I tools/seminar-decks/make_plain_3d_s10.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import plain3d as P  # noqa: E402

OUT_MP4 = P.CLIPS / 'plain-c-turn.mp4'
OUT_PNG = P.CLIPS / 'plain-c-turn.png'
OUT_JS = P.ALTS / 's10.gen.js'
FPS = 30
DISPLAY_H = 680
SCALE = 2
LEAD_S = 0.3     # the front view, while the slide fades the clip in over its outlines
TURN_S = 3.6
HOLD_S = 0.6
START = 13.7     # slide time the clip starts (all three classes are on screen by 13.8)

# slide 10's outline style (plain.css .dp10-o): casing and edge widths in display px
STYLE = {
    'found': dict(edge=1.1, casing=1.7),
    'missed': dict(edge=1.5, casing=2.5),
    'falseAlarm': dict(edge=1.1, casing=1.7),
}


def main():
    c = P.load_c()
    T = P.Turner(c, DISPLAY_H, scale=SCALE, pad_mm=70)

    def frame(theta):
        pr = T.projections(theta, need=('pet', 'cls'))
        rgb = T.base(pr, 1.0, 0.0)
        for name in ('found', 'missed', 'falseAlarm'):   # the slide's drawing order (later on top)
            m = T._up(pr['cls_' + name])
            st = STYLE[name]
            rgb = T.outline(rgb, m, P.CLASS[name], P.CLASS_FILL[name], 1.0, 0.35,
                            edge_w=max(1, round(st['edge'] * SCALE)), casing_w=max(1, round(st['casing'] * SCALE)))
        return T.done(rgb)

    enc = P.Encoder(OUT_MP4, T.out_w, T.out_h, FPS, crf=20)
    front = frame(0.0)
    enc.hold(front, int(round(LEAD_S * FPS)))
    n = int(round(TURN_S * FPS))
    for i in range(1, n):
        u = P.smooth(i / n)
        enc.write(frame(2 * math.pi * u))
    enc.hold(front, int(round(HOLD_S * FPS)) + 1)
    size = enc.close()
    Image.fromarray(front, 'RGB').save(OUT_PNG, optimize=True)
    gen = {'start': START, 'lead': LEAD_S, 'turn': TURN_S, 'hold': HOLD_S, 'seconds': round(enc.n / FPS, 3),
           'padCols': T.pad_cols, 'cols': T.xb - T.xa, 'counts': c.counts}
    P.write_gen(OUT_JS, 'TURN10', gen, 'make_plain_3d_s10.py')
    print(json.dumps({'size': [T.out_w, T.out_h], 'frames': enc.n, 'mp4_bytes': size, 'counts': c.counts}))


if __name__ == '__main__':
    main()
