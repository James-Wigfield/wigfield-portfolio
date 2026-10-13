#!/usr/bin/env python3
"""
Compose the critics' contact sheets and transition strips from `capture.mjs sheets` or `shots`.

    python tools/psma-app-guide/make_sheets.py sheets <frames-dir> <out-dir>
    python tools/psma-app-guide/make_sheets.py strip <out.png> <title> <frame.png> [<frame.png> ...]

`sheets`: one sheet per chapter (a frame every 0.5 s, its time on each tile) and one strip per
chapter change (8 frames in order), from frames.json. `strip`: one row of any frames, in order.
Pillow only.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for f in ("C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def tile_grid(items, cols, tile_w, title):
    lf, tf = font(20), font(28)
    imgs = [Image.open(p).convert("RGB") for p, _ in items]
    w0, h0 = imgs[0].size
    tile_h = round(tile_w * h0 / w0)
    rows = (len(imgs) + cols - 1) // cols
    pad, head = 10, 56
    sheet = Image.new("RGB", (cols * (tile_w + pad) + pad, head + rows * (tile_h + pad + 30) + pad), (32, 32, 36))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 14), title, fill=(240, 240, 240), font=tf)
    for i, (im, (_, lab)) in enumerate(zip(imgs, items)):
        r, c = divmod(i, cols)
        x = pad + c * (tile_w + pad)
        y = head + r * (tile_h + pad + 30)
        sheet.paste(im.resize((tile_w, tile_h), Image.LANCZOS), (x, y))
        d.text((x, y + tile_h + 4), lab, fill=(220, 220, 220), font=lf)
    return sheet


def sheets(src, out):
    out.mkdir(parents=True, exist_ok=True)
    meta = json.loads((src / "frames.json").read_text())
    groups = {}
    for f in meta["frames"]:
        if f["kind"] == "move":
            groups.setdefault(("move", f"{f['move']:02d}", "camera"), []).append(f)
        else:
            groups.setdefault((f["kind"], f["num"], f["chapter"]), []).append(f)
    made = []
    for (kind, num, ch), frames in sorted(groups.items()):
        items = [(src / f["file"], f"t = {f['t']:.2f} s") for f in frames]
        if kind == "move":
            title = f"camera move {num}: 8 frames from {frames[0]['t']:.2f} to {frames[-1]['t']:.2f} s"
            img = tile_grid(items, 4, 460, title)
            name = f"move-{num}.png"
        elif kind == "sheet":
            title = f"chapter {num} ({ch}): a frame every 0.5 s"
            img = tile_grid(items, 5, 360, title)
            name = f"sheet-{num}-{ch}.png"
        else:
            title = f"into chapter {num} ({ch}): 8 frames, every {frames[0].get('every', 1)} frames at {meta['fps']} fps"
            img = tile_grid(items, 4, 460, title)
            name = f"strip-{num}-{ch}.png"
        img.save(out / name)
        made.append(name)
    print("\n".join(made))


def strip(out, title, frames):
    items = [(Path(f), Path(f).stem) for f in frames]
    tile_grid(items, 4, 460, title).save(out)
    print(out)


if __name__ == "__main__":
    if sys.argv[1] == "sheets":
        sheets(Path(sys.argv[2]), Path(sys.argv[3]))
    elif sys.argv[1] == "strip":
        strip(Path(sys.argv[2]), sys.argv[3], sys.argv[4:])
    else:
        raise SystemExit(__doc__)
