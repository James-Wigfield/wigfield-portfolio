"""D1: the seminar cut of a real model run in the Mamba PSMA app.

Built from the PSMA App Guide's lossless captures of one filmed run
(motion-data/app-guide/, read only): the scan loaded (C00), the run in
progress (C01-C25, the protocol run, 58.4 s from click to result), and the
result in the app's 3D view (S-MIP-CMP, 72 frames). Only the app's image area
is used, cropped by the manifest's own image rectangles, so no case id, no
seconds figure, no tutorial caption and no chapter bar reach the clip. The
run is a time-lapse: each capture appears at t_since_click / SPEED, so the
speed label ("sped up 6x") is exact. Display scaling to 1080p uses a box
(area) filter; nothing else is done to a pixel. The cut to the 3D view goes
through black (a brightness fade, never a blend of two images).

Writes (portfolio repo):
  public/seminar-decks/clips/d1-model-run.mp4   1920x1080, H.264, yuv420p, faststart
  public/seminar-decks/clips/d1-model-run.png   the last frame (hold, poster)
  public/seminar-decks/data/d1-cues.json        status text and phases by time,
                                                for each deck's own overlay type
Run: python -I tools/seminar-decks/make_d1.py  (from the portfolio root)
"""
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
AG = os.path.join(ROOT, 'motion-data', 'app-guide')
OUT_MP4 = os.path.join(ROOT, 'public', 'seminar-decks', 'clips', 'd1-model-run.mp4')
OUT_PNG = os.path.join(ROOT, 'public', 'seminar-decks', 'clips', 'd1-model-run.png')
OUT_CUES = os.path.join(ROOT, 'public', 'seminar-decks', 'data', 'd1-cues.json')
FFMPEG = r'C:\Users\james\.venvs\motion\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'

W, H, FPS = 1920, 1080, 30
SPEED = 6            # time-lapse factor of the run section
LEAD = 1.5           # seconds on the loaded scan before the click
RESULT_HOLD = 1.6    # seconds on the result slice
FADE = 0.4           # fade to and from black, each way
MIP_FPS = 18         # 72 frames = one turn in 4 s
END_HOLD = 0.6
IMG_H = 1000         # displayed image height on the 1080 frame
DEVICE = 2           # the captures are at device scale 2

# The app's own overlay colours, sampled from the legend swatches of C25 / C00.
APP_COLOURS = {'found': '#2ECC71', 'missed': '#22D3EE', 'false_alarm': '#FF4FD8', 'ground_truth': '#22D3EE'}


def crop_box(rect, origin=(0.0, 0.0)):
    x, y, w, h = rect[:4]
    x -= origin[0]
    y -= origin[1]
    return tuple(round(v * DEVICE) for v in (x, y, x + w, y + h))


def place(img):
    """Scale to IMG_H with a box filter and centre on a black 1920x1080 frame."""
    w = round(img.width * IMG_H / img.height)
    small = img.resize((w, IMG_H), Image.BOX)
    frame = Image.new('RGB', (W, H), (0, 0, 0))
    frame.paste(small, ((W - w) // 2, (H - IMG_H) // 2))
    return frame


def fade(frame, a):
    if a >= 1:
        return frame
    return Image.eval(frame, lambda v: int(v * max(0.0, a)))


def main():
    m = json.load(open(os.path.join(AG, 'manifest.json'), encoding='utf-8'))
    caps = m['captures']
    run = m['runs']['protocol']
    ids = ['C00'] + run['frames']

    def load(cid):
        c = caps[cid]
        p = os.path.join(AG, c['file'])
        digest = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        assert digest == c['sha256'], f'{cid}: sha256 mismatch'
        im = Image.open(p).convert('RGB').crop(crop_box(c['img']))
        return place(im)

    # Timeline of (start time, frame) for the run section.
    shots = [(0.0, load('C00'))]
    for cid in run['frames']:
        t = LEAD + caps[cid]['t_since_click'] / SPEED
        shots.append((t, load(cid)))
    t_result = shots[-1][0]
    t_fade = t_result + RESULT_HOLD

    seq = caps['S-MIP-CMP']
    origin = seq['clip'][:2]
    mip_box = crop_box(caps['D10']['img'], origin)
    mip = []
    for fr in seq['frames']:
        p = os.path.join(AG, fr['file'])
        assert hashlib.sha256(open(p, 'rb').read()).hexdigest() == fr['sha256'], fr['file']
        mip.append(place(Image.open(p).convert('RGB').crop(mip_box)))

    t_mip = t_fade + 2 * FADE
    total = t_mip + len(mip) / MIP_FPS + END_HOLD
    n = int(round(total * FPS))

    os.makedirs(os.path.dirname(OUT_MP4), exist_ok=True)
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', OUT_MP4]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    last = None
    cache = {}
    for i in range(n):
        t = i / FPS
        if t < t_fade:
            fr = [f for (s, f) in shots if s <= t + 1e-9][-1]
            key = id(fr)
            out = fr
        elif t < t_fade + FADE:
            fr = shots[-1][1]
            a = 1 - (t - t_fade) / FADE
            key = ('fo', round(a, 3))
            out = cache.get(key) or fade(fr, a)
        elif t < t_mip:
            a = (t - t_fade - FADE) / FADE
            key = ('fi', round(a, 3))
            out = cache.get(key) or fade(mip[0], a)
        else:
            k = min(len(mip) - 1, int((t - t_mip) * MIP_FPS))
            key = ('m', k)
            out = mip[k]
        cache[key] = out
        last = out
        proc.stdin.write(out.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit('ffmpeg failed')
    last.save(OUT_PNG)

    stages = [
        (0.0, 'scan', 'Scan loaded, ground truth shown'),
        (LEAD, 'run', 'Starting Python and CUDA'),
        (LEAD + caps['C05']['t_since_click'] / SPEED, 'run', 'Loading the models'),
        (LEAD + caps['C07']['t_since_click'] / SPEED, 'run', 'Segmenting the scan with all five models'),
        (LEAD + caps['C21']['t_since_click'] / SPEED, 'run', 'Writing the mask'),
        (t_result, 'result', 'Result over the scan'),
        (t_fade, 'mip', 'Result in the app\'s 3D view'),
    ]
    cues = {
        'about': 'D1 overlay cues. Times are in the clip (seconds). Stage names are the app\'s own status lines from the '
                 'captured run (motion-data/app-guide/manifest.json, C01-C25), with "(1 of 5)" counts dropped and '
                 '"5" written as "five". No numbers from the app are shown.',
        'speed': SPEED,
        'duration': round(n / FPS, 3),
        'run': {'start': LEAD, 'end': round(t_result, 3)},
        'result_at': round(t_result, 3),
        'mip_at': round(t_mip, 3),
        'stages': [{'t': round(t, 3), 'phase': ph, 'text': tx} for (t, ph, tx) in stages],
        'colours': APP_COLOURS,
        'legend': {
            'scan': [{'key': 'ground_truth', 'label': 'Ground truth (expert outline)'}],
            'result': [{'key': 'found', 'label': 'Found'}, {'key': 'missed', 'label': 'Missed'}, {'key': 'false_alarm', 'label': 'False alarm'}],
        },
        'source': {'captures': 'motion-data/app-guide/manifest.json', 'run': 'runs.protocol', 'mip': 'S-MIP-CMP'},
    }
    json.dump(cues, open(OUT_CUES, 'w', encoding='utf-8'), indent=1)
    print(json.dumps({'frames': n, 'seconds': round(n / FPS, 2), 'result_at': round(t_result, 2), 'mip_at': round(t_mip, 2),
                      'mp4_bytes': os.path.getsize(OUT_MP4)}))


if __name__ == '__main__':
    main()
