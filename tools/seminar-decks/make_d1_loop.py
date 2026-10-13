"""D1 loop: the plain deck's demo slide cut of the same real model run (make_d1.py's source).

A seamless loop for a slide left up during questions. Same captures, crops, scaling and
time-lapse as make_d1.py (it imports that script's helpers and constants, so the two cuts
cannot drift apart), with three differences:
  - it fades up from black at the start and down to black at the end, so the loop's seam
    passes through black, as the existing cut to the 3D view already does;
  - the result in the app's 3D view turns TURNS times (one turn is the 72 captured frames,
    a full rotation), a longer hold on the 3D view for questions;
  - its poster (the hold frame for thumbnails, export and reduced motion) is the first 3D
    frame with the result, not the last frame, which is black.
The run section is a time-lapse at make_d1.SPEED (each capture at t_since_click / SPEED), so
"sped up 6x" stays exact for that section. No case id, score, caption or chapter bar is in
the frame: only the app's image rectangles are used, as in make_d1.py.

Writes (portfolio repo; make_d1.py's outputs are not touched):
  public/seminar-decks/clips/d1-model-run-loop.mp4
  public/seminar-decks/clips/d1-model-run-loop.png
  public/seminar-decks/data/d1-loop-cues.json
Run: python -I tools/seminar-decks/make_d1_loop.py  (from the portfolio root)
"""
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # python -I leaves the script's folder off the path
import make_d1 as d1  # noqa: E402
from PIL import Image  # noqa: E402

OUT_MP4 = os.path.join(d1.ROOT, 'public', 'seminar-decks', 'clips', 'd1-model-run-loop.mp4')
OUT_PNG = os.path.join(d1.ROOT, 'public', 'seminar-decks', 'clips', 'd1-model-run-loop.png')
OUT_CUES = os.path.join(d1.ROOT, 'public', 'seminar-decks', 'data', 'd1-loop-cues.json')
EDGE = 0.5   # fade up at the start and down at the end, seconds
TURNS = 2


def main():
    m = json.load(open(os.path.join(d1.AG, 'manifest.json'), encoding='utf-8'))
    caps = m['captures']
    run = m['runs']['protocol']

    def load(cid):
        c = caps[cid]
        p = os.path.join(d1.AG, c['file'])
        assert hashlib.sha256(open(p, 'rb').read()).hexdigest() == c['sha256'], f'{cid}: sha256 mismatch'
        return d1.place(Image.open(p).convert('RGB').crop(d1.crop_box(c['img'])))

    shots = [(0.0, load('C00'))]
    for cid in run['frames']:
        shots.append((d1.LEAD + caps[cid]['t_since_click'] / d1.SPEED, load(cid)))
    t_result = shots[-1][0]
    t_fade = t_result + d1.RESULT_HOLD

    seq = caps['S-MIP-CMP']
    origin = seq['clip'][:2]
    mip_box = d1.crop_box(caps['D10']['img'], origin)
    mip = []
    for fr in seq['frames']:
        p = os.path.join(d1.AG, fr['file'])
        assert hashlib.sha256(open(p, 'rb').read()).hexdigest() == fr['sha256'], fr['file']
        mip.append(d1.place(Image.open(p).convert('RGB').crop(mip_box)))

    t_mip = t_fade + 2 * d1.FADE
    turn = len(mip) / d1.MIP_FPS
    t_end = t_mip + TURNS * turn
    total = t_end + EDGE
    n = int(round(total * d1.FPS))

    cmd = [d1.FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{d1.W}x{d1.H}', '-r', str(d1.FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', OUT_MP4]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        t = i / d1.FPS
        if t < t_fade:
            out = [f for (s, f) in shots if s <= t + 1e-9][-1]
            if t < EDGE:
                out = d1.fade(out, t / EDGE)
        elif t < t_fade + d1.FADE:
            out = d1.fade(shots[-1][1], 1 - (t - t_fade) / d1.FADE)
        elif t < t_mip:
            out = d1.fade(mip[0], (t - t_fade - d1.FADE) / d1.FADE)
        else:
            k = int((t - t_mip) * d1.MIP_FPS) % len(mip)
            out = mip[k]
            if t >= t_end:
                out = d1.fade(out, 1 - (t - t_end) / EDGE)
        proc.stdin.write(out.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit('ffmpeg failed')
    mip[0].save(OUT_PNG)

    stages = [
        (0.0, 'scan', 'Scan loaded, ground truth shown'),
        (d1.LEAD, 'run', 'Starting Python and CUDA'),
        (d1.LEAD + caps['C05']['t_since_click'] / d1.SPEED, 'run', 'Loading the models'),
        (d1.LEAD + caps['C07']['t_since_click'] / d1.SPEED, 'run', 'Segmenting the scan with all five models'),
        (d1.LEAD + caps['C21']['t_since_click'] / d1.SPEED, 'run', 'Writing the mask'),
        (t_result, 'result', 'Result over the scan'),
        (t_fade, 'mip', 'Result in the app\'s 3D view'),
    ]
    cues = {
        'about': 'D1 loop overlay cues (make_d1_loop.py). Times are in the clip (seconds); the clip loops. Stage '
                 'names are the app\'s own status lines from the captured run, as in d1-cues.json.',
        'speed': d1.SPEED,
        'duration': round(n / d1.FPS, 3),
        'run': {'start': d1.LEAD, 'end': round(t_result, 3)},
        'result_at': round(t_result, 3),
        'mip_at': round(t_mip, 3),
        'turns': TURNS,
        'stages': [{'t': round(t, 3), 'phase': ph, 'text': tx} for (t, ph, tx) in stages],
        'colours': d1.APP_COLOURS,
        'legend': {
            'scan': [{'key': 'ground_truth', 'label': 'Ground truth (expert outline)'}],
            'result': [{'key': 'found', 'label': 'Found'}, {'key': 'missed', 'label': 'Missed'}, {'key': 'false_alarm', 'label': 'False alarm'}],
        },
        'source': {'captures': 'motion-data/app-guide/manifest.json', 'run': 'runs.protocol', 'mip': 'S-MIP-CMP', 'case_in': 'Mamba_PSMA/splits/test.json'},
    }
    json.dump(cues, open(OUT_CUES, 'w', encoding='utf-8'), indent=1)
    print(json.dumps({'frames': n, 'seconds': round(n / d1.FPS, 2), 'result_at': round(t_result, 2), 'mip_at': round(t_mip, 2),
                      'mp4_bytes': os.path.getsize(OUT_MP4)}))


if __name__ == '__main__':
    main()
