#!/usr/bin/env python3
"""
SEMINAR DECKS -- the plain deck's demo clip (B1) from a take filmed by record_gui_demo.py.

Reads motion-data/gui-demo/<take>/ (raw screencast frames, the action log and the blur log) and
writes, for the demo slide:
    public/seminar-decks/clips/plain-gui-demo.mp4      H.264, 1600 x 900, 30 fps, loops cleanly
    public/seminar-decks/clips/plain-gui-demo.png      its hold frame (the result on the slices)
    public/seminar-decks/data/plain-gui-demo-cues.json what the clip shows when (the slide's status
                                                       line), the speed-up and the run's facts
What is changed from the recording, and nothing else:
  * the two waits for the app (the model run, and rendering the 3D view) play SPEED times faster;
    clicks, scrolling and the 3D turn play in real time;
  * the case id and the local paths are blurred where the page logged them (+-0.3 s, padded);
    with --run-log-box (take1 only, whose run log was filmed), the run log's area too: it prints
    the checkpoint folders, whose names carry a development run number the slides never show
    (from take2 the recorder hides that log in the page instead);
  * a cursor and a ring at each click are drawn where the logged mouse events went;
  * the clip loops with a plain cut (LOOP_S = 0; a dissolve ghosted two screens over each other).

    python -I tools/seminar-decks/make_gui_demo.py --take take2
"""
import argparse
import bisect
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PORTFOLIO = Path(__file__).resolve().parents[2]
FFMPEG = r'C:\Users\james\.venvs\motion\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
OUT_MP4 = PORTFOLIO / 'public' / 'seminar-decks' / 'clips' / 'plain-gui-demo.mp4'
OUT_PNG = PORTFOLIO / 'public' / 'seminar-decks' / 'clips' / 'plain-gui-demo.png'
OUT_CUES = PORTFOLIO / 'public' / 'seminar-decks' / 'data' / 'plain-gui-demo-cues.json'

FPS = 30
SPEED = 20          # waits for the app play this many times faster
LEAD = 0.45         # a wait starts this long after its click, so the click itself plays in real time
LOOP_S = 0.0        # no dissolve at the loop point: a plain cut
BLUR_PAD = 4
BLUR_WIN = 0.3
# take1's logger also logged every select box in the sidebar (CT window, PET colour map); of the
# box-shaped rects (inputs, >= 30 px tall) keep only the dataset folder and the case picker
KEEP_INPUT_X = 29.8
KEEP_INPUT_Y = (252.0, 367.2)
# the run log (a code block under the status line, right column) while the model runs, CSS px
RUN_LOG = (1276, 604, 1558, 900)
RING = (0, 114, 178)  # the plain deck's blue


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def cursor_sprite(k=1.35):
    """A plain arrow pointer, black with a white edge, drawn at 4x and reduced."""
    s = 4 * k
    pts = [(0, 0), (0, 17), (4.2, 13.2), (7.2, 19.6), (9.6, 18.6), (6.6, 12.3), (12, 12.3)]
    w, h = int(16 * s), int(24 * s)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = [(x * s + 2 * s, y * s + 2 * s) for x, y in pts]
    d.polygon(p, fill=(255, 255, 255, 255))
    d.line(p + [p[0]], fill=(255, 255, 255, 255), width=int(3 * s))
    q = [(x * s + 2 * s, y * s + 2 * s) for x, y in pts]
    d.polygon(q, fill=(17, 20, 24, 255))
    im = im.resize((w // 4, h // 4), Image.LANCZOS)
    return im, (round(2 * k), round(2 * k))  # hotspot offset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--take', required=True)
    ap.add_argument('--crf', type=int, default=24)
    ap.add_argument('--run-log-box', action='store_true')
    a = ap.parse_args()
    src = PORTFOLIO / 'motion-data' / 'gui-demo' / a.take
    frames = json.loads((src / 'frames.json').read_text())
    log = json.loads((src / 'log.json').read_text())
    ev = log['events']
    marks = {e['name']: e['t'] for e in ev if e['kind'] == 'mark'}
    T0, TEND = marks['start'], marks['end']

    # source-time segments: (start, end, speed)
    waits = [(marks['run_click'] + LEAD, marks['run_done']), (marks['mip_click'] + LEAD, marks['mip_ready'])]
    segs, t = [], T0
    for w0, w1 in waits:
        if w1 - w0 < 1.0:
            continue
        segs.append((t, w0, 1.0))
        segs.append((w0, w1, float(SPEED)))
        t = w1
    segs.append((t, TEND, 1.0))
    out_len = sum((s1 - s0) / sp for s0, s1, sp in segs)

    def src_time(to):
        acc = 0.0
        for s0, s1, sp in segs:
            d = (s1 - s0) / sp
            if to <= acc + d:
                return s0 + (to - acc) * sp
            acc += d
        return TEND

    def out_time(ts):
        acc = 0.0
        for s0, s1, sp in segs:
            if ts <= s1:
                return acc + max(0.0, ts - s0) / sp
            acc += (s1 - s0) / sp
        return acc

    ft = [f['t'] for f in frames]
    cache = {}

    def frame_at(ts):
        i = max(0, bisect.bisect_right(ft, ts) - 1)
        if i not in cache:
            if len(cache) > 8:
                cache.clear()
            cache[i] = Image.open(src / 'frames' / frames[i]['file']).convert('RGB')
        return cache[i]

    blur = log['blur']
    bt = [b['t'] for b in blur]

    def blur_rects(ts):
        i0 = max(0, bisect.bisect_right(bt, ts - BLUR_WIN) - 1)
        i1 = bisect.bisect_right(bt, ts + BLUR_WIN)
        rs = []
        for b in blur[i0:max(i1, i0 + 1)]:
            for x, y, w, h in b['rects']:
                if h >= 30 and not (abs(x - KEEP_INPUT_X) < 2 and min(abs(y - k) for k in KEEP_INPUT_Y) < 3):
                    continue
                rs.append([x, y, w, h])
        if a.run_log_box and marks['run_click'] + 0.3 <= ts <= marks['run_done']:
            x0, y0, x1, y1 = RUN_LOG
            rs.append([x0, y0, x1 - x0, y1 - y0])
        return rs

    moves = [e for e in ev if e['kind'] == 'move']
    clicks = [e for e in ev if e['kind'] == 'click']
    start_xy = moves[0]['from'] if moves else [0, 0]

    def cursor_at(ts):
        xy = start_xy
        for m in moves:
            if ts < m['t0']:
                break
            if ts >= m['t1']:
                xy = m['to']
            else:
                e = smooth((ts - m['t0']) / (m['t1'] - m['t0']))
                xy = [m['from'][0] + (m['to'][0] - m['from'][0]) * e, m['from'][1] + (m['to'][1] - m['from'][1]) * e]
                break
        return xy

    sprite, hot = cursor_sprite()

    def compose(to):
        ts = src_time(to)
        im = frame_at(ts).copy()
        W, H = im.size
        for x, y, w, h in blur_rects(ts):
            x0, y0 = max(0, int(x - BLUR_PAD)), max(0, int(y - BLUR_PAD))
            x1, y1 = min(W, int(x + w + BLUR_PAD + 1)), min(H, int(y + h + BLUR_PAD + 1))
            if x1 - x0 < 2 or y1 - y0 < 2:
                continue
            reg = im.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(radius=min(9, max(4, h * 0.38))))
            im.paste(reg, (x0, y0))
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for c in clicks:
            # rings are timed in OUTPUT time, so a click before a sped-up wait still shows its ring
            age = to - out_time(c['t'])
            if 0 <= age <= 0.45:
                u = age / 0.45
                r = 7 + 20 * smooth(u)
                al = int(190 * (1 - u))
                cx, cy = c['at']
                d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=RING + (al,), width=3)
        cx, cy = cursor_at(ts)
        ov.alpha_composite(sprite, (int(round(cx)) - hot[0], int(round(cy)) - hot[1]))
        im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
        return im

    n = int(round(out_len * FPS))
    first = compose(0.0)
    W, H = first.size
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-pix_fmt', 'yuv420p',
           '-movflags', '+faststart', '-an', str(OUT_MP4)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    first_np = np.asarray(first, dtype=np.float32)
    loop_n = int(LOOP_S * FPS)
    for i in range(n):
        to = i / FPS
        im = compose(to)
        if loop_n and i >= n - loop_n:
            u = smooth((i - (n - loop_n) + 1) / loop_n)
            arr = np.asarray(im, dtype=np.float32) * (1 - u) + first_np * u
            im = Image.fromarray(arr.round().astype(np.uint8))
        p.stdin.write(im.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        sys.exit('ffmpeg failed')

    # hold frame: the result in the app's 3D view, near front on (0.6 s into the turn), which shows
    # every lesion at once (a single slice shows only a few)
    hold_t = out_time(marks['mip_ready']) + 0.6
    compose(hold_t).save(OUT_PNG, optimize=True)

    # status cues for the slide (output time)
    r0, r1 = out_time(marks['run_click']), out_time(marks['run_done'])
    m0, m1 = out_time(marks['mip_click']), out_time(marks['mip_ready'])
    cues = {
        'note': 'Generated by tools/seminar-decks/make_gui_demo.py from motion-data/gui-demo/' + a.take + '. Times are in the clip.',
        'case': log['case'],
        'case_rule': ('autoPET-III sealed test scans with 10 to 50 lesions, at least one missed lesion and one false alarm, '
                      'no saved app run; per-case F1 (ensemble, threshold 0.5, 10 voxels) closest to the median over the '
                      '102 lesion-positive autoPET-III test scans (0.80, with the 9 scans that have no detection counted '
                      'as F1 0); exact ties broken by case id; picked before any image was viewed'),
        'look': 'the app set to its "Motion graphics, light" overlay colours (Figure 4.7 and slide 10\'s) and the Inverted grey PET map before filming',
        'speed': SPEED,
        'duration': round(n / FPS, 3),
        'run_s_real': round(marks['run_done'] - marks['run_click'], 1),
        # labels carry no digits (the slide's gate G1): the speed-up is the manifest key gui.speed
        'cues': [
            {'t': 0.0, 'label': 'The sealed test scan, its ground truth in dark blue'},
            {'t': round(r0, 2), 'label': 'The model running (sped up)'},
            {'t': round(r1, 2), 'label': 'The result: found, missed and false alarms'},
            {'t': round(m0, 2), 'label': 'Rendering the 3D view (sped up)'},
            {'t': round(m1, 2), 'label': "The result in the app's 3D view"},
        ],
        'hold': "The result in the app's 3D view",
        'hold_t': round(hold_t, 2),
    }
    OUT_CUES.write_text(json.dumps(cues, indent=1) + '\n')
    mb = OUT_MP4.stat().st_size / 1e6
    print(f'{n} frames, {n / FPS:.1f} s, {W}x{H}, {mb:.2f} MB; hold at {hold_t:.1f} s; cues {[c["t"] for c in cues["cues"]]}')


if __name__ == '__main__':
    main()
