#!/usr/bin/env python3
"""
PSMA APP GUIDE -- gate G7: the video inside the app's own help dialog.

Opens the app (a local server on --port), clicks "How to use this app", and checks the dialog's
<video>: it loads (readyState >= 2), its duration matches the film's, it plays to about 10 s.
Screenshots the dialog at 10 s and measures the video's rendered width, then re-checks gate G4's
type sizes at that scale (captions should stay about 24 px or more on screen).

    python -B tools/psma-app-guide/g7_dialog.py --port 8502 --duration 248.0 --out <dir>
"""
import argparse
import base64
import json
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
MAMBA = Path(r"C:\Users\james\Documents\university\cits4010\Mamba_PSMA")
sys.path.insert(0, str(MAMBA / "outputs" / "gui-capture-tools"))
from cdp import Browser  # noqa: E402

CAPTION_PX, LABEL_PX = 48, 36  # the stage's smallest caption and label sizes at 1080p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8502)
    ap.add_argument("--duration", type=float, required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    b = Browser(port=9475, scale=1)
    res = {}
    try:
        b.goto(f"http://localhost:{a.port}")
        b.wait("document.body.innerText.includes('How to use this app')", timeout=180)
        b.wait_idle(timeout=300)
        time.sleep(1.0)
        b.js("[...document.querySelectorAll('button')].find(x => x.innerText.includes('How to use this app')).click()")
        b.wait("!!document.querySelector('[role=dialog] video')", timeout=60)
        time.sleep(1.0)
        b.wait("document.querySelector('[role=dialog] video').readyState >= 2", timeout=120)
        v = "document.querySelector('[role=dialog] video')"
        res["readyState"] = b.js(f"{v}.readyState")
        res["duration"] = b.js(f"{v}.duration")
        res["src_kind"] = b.js(f"{v}.currentSrc.split(':')[0]")
        r = b.js(f"(() => {{ const r = {v}.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }})()")
        res["video_rect_css"] = r
        res["dialog_rect_css"] = b.js("(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
        # play it (muted: no user gesture in a scripted browser) and let it run to about 10 s
        b.js(f"(() => {{ const e = {v}; e.muted = true; e.play(); }})()")
        t0 = time.time()
        while time.time() - t0 < 30:
            if (b.js(f"{v}.currentTime") or 0) >= 10.0:
                break
            time.sleep(0.25)
        res["played_to"] = b.js(f"{v}.currentTime")
        res["paused"] = b.js(f"{v}.paused")
        shot = base64.b64decode(b.send("Page.captureScreenshot", format="png")["data"])
        (out / "g7-dialog-10s.png").write_bytes(shot)
        scale = r[2] / 1920.0
        res["scale"] = round(scale, 4)
        res["caption_px_on_screen"] = round(CAPTION_PX * scale, 1)
        res["label_px_on_screen"] = round(LABEL_PX * scale, 1)
    finally:
        b.close()
    ok = (res.get("readyState", 0) >= 2 and abs((res.get("duration") or 0) - a.duration) <= 1 / 30 + 0.05
          and (res.get("played_to") or 0) >= 9.5 and res.get("caption_px_on_screen", 0) >= 24)
    (out / "g7.json").write_text(json.dumps(res, indent=1))
    print(f"G7 {'PASS' if ok else 'FAIL'}: readyState {res.get('readyState')}, duration {res.get('duration')} s "
          f"(film {a.duration:.3f} s), played to {res.get('played_to'):.2f} s, video {res.get('video_rect_css')} CSS px "
          f"in a {res.get('dialog_rect_css')} dialog: scale {res.get('scale')}, captions {res.get('caption_px_on_screen')} px, "
          f"labels {res.get('label_px_on_screen')} px on screen")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
