#!/usr/bin/env python3
"""
PSMA APP GUIDE -- the render's frame mixer (Windows Python, Pillow + numpy).

capture.mjs sends every output frame as a group of PNG screenshots of the stage: one for a
still frame, several sub-frame samples across a 180-degree shutter where the camera, the
curtain, the cursor or a scroll is moving (motion blur; never across a step of a captured frame
sequence or a cut, which capture.mjs leaves as one sample). This averages each group and writes
the frame to a lossless master (libx264rgb -qp 0) through ffmpeg. It also records, for gate G5,
the mean absolute difference between consecutive output frames.

    stdin: per frame  <u32 n> then n x (<u32 length> <png bytes>);  n = 0 ends the stream
    python -B tools/psma-app-guide/mix_frames.py --ffmpeg <exe> --out master.mkv --fps 30 \
        --size 1920x1080 --diffs diffs.json
"""
import argparse
import io
import json
import struct
import subprocess
import sys

import numpy as np
from PIL import Image


def read_exact(f, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = f.read(n - len(buf))
        if not chunk:
            raise EOFError("stream ended mid-frame")
        buf += chunk
    return bytes(buf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ffmpeg", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", required=True)
    ap.add_argument("--size", required=True)
    ap.add_argument("--diffs", required=True)
    a = ap.parse_args()
    w, h = (int(v) for v in a.size.split("x"))
    ff = subprocess.Popen([a.ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{w}x{h}", "-r", a.fps, "-i", "-", "-c:v", "libx264rgb", "-qp", "0",
                           "-preset", "ultrafast", "-pix_fmt", "rgb24", a.out], stdin=subprocess.PIPE)
    src = sys.stdin.buffer
    diffs, samples, prev = [], [], None
    while True:
        n = struct.unpack("<I", read_exact(src, 4))[0]
        if n == 0:
            break
        acc = None
        for _ in range(n):
            size = struct.unpack("<I", read_exact(src, 4))[0]
            im = Image.open(io.BytesIO(read_exact(src, size))).convert("RGB")
            if im.size != (w, h):
                raise SystemExit(f"frame is {im.size}, expected {(w, h)}")
            arr = np.asarray(im)
            if n == 1:
                acc = arr
            else:
                acc = arr.astype(np.float32) if acc is None else acc + arr
        frame = np.clip(acc / n + 0.5, 0, 255).astype(np.uint8) if n > 1 else acc
        ff.stdin.write(frame.tobytes())
        small = frame[::4, ::4].astype(np.int16)
        diffs.append(0.0 if prev is None else float(np.abs(small - prev).mean()))
        samples.append(n)
        prev = small
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ffmpeg failed")
    with open(a.diffs, "w", encoding="utf-8") as f:
        json.dump({"fps": float(a.fps), "diff": diffs, "samples": samples}, f)
    print(f"mixed {len(samples)} frames ({sum(1 for s in samples if s > 1)} with motion blur) -> {a.out}")


if __name__ == "__main__":
    main()
