#!/usr/bin/env python3
"""
PSMA APP GUIDE -- find the slider thumbs in the captures (Windows Python, Pillow + numpy).

The film's cursor drags a slider by its thumb, so it needs each thumb's place in each capture.
Streamlit's sliders draw the thumb as a filled disc in the app's primary blue on a 4 px track;
this finds the discs inside a slider's recorded rect (columns where the blue is taller than the
track) and stores them in the capture's manifest entry as thumbs[<rect name>] = [[x, y, w, h]]
in CSS px, with the method noted. Read from the capture itself, so G3 checks the cursor against
the very pixels on screen.

    python -B tools/psma-app-guide/thumbs.py B06a:fusion B12a:suv_range ...
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DATA = Path(__file__).resolve().parents[2] / "motion-data" / "app-guide"
MANIFEST = DATA / "manifest.json"
S = 2  # device scale of the captures


def find(img, rect):
    x, y, w, h = (int(round(v * S)) for v in rect)
    a = np.asarray(img.convert("RGB"), dtype=np.int16)[y:y + h, x:x + w]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > 120) & (b - r > 60) & (b - g > 25) & (r < 90)        # the primary blue, not the pale track
    tall = blue.sum(axis=0) >= 8 * S                                 # the disc is taller than the 4 px track
    cols = np.flatnonzero(tall)
    if not cols.size:
        return []
    groups = np.split(cols, np.flatnonzero(np.diff(cols) > 2) + 1)
    out = []
    for gcols in groups:
        if gcols.max() + 1 - gcols.min() < 3 * S:      # digits of the value label are thin columns
            continue
        dens = blue[:, gcols].sum(axis=1)
        cy = int(np.argmax(dens))
        cx = (gcols.min() + gcols.max() + 1) / 2
        # a thumb is a 14 px disc; report it centred where it was found
        out.append([round(float((x + cx) / S - 7), 2), round(float((y + cy) / S - 7), 2), 14.0, 14.0])
    return out


def main():
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for item in sys.argv[1:]:
        cid, name = item.split(":")
        c = m["captures"][cid]
        rect = c["rects"].get(name)
        if not rect:
            raise SystemExit(f"{cid} has no rect {name}")
        found = find(Image.open(DATA / c["file"]), rect)
        if not found:
            raise SystemExit(f"{cid}:{name}: no thumb found in {rect}")
        c.setdefault("thumbs", {})[name] = found
        c["thumbs_method"] = "thumbs.py: the primary-blue disc inside the slider's rect, read from this capture"
        print(cid, name, found)
    MANIFEST.write_text(json.dumps(m, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
