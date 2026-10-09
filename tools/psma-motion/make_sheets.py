#!/usr/bin/env python3
"""
Compose the critics' contact sheets and transition strips from `capture.mjs sheets` output.

    python tools/psma-motion/make_sheets.py <frames-dir> <out-dir>

One sheet per case and beat (a frame every 0.5 s, timestamp on each tile) and one strip per
beat boundary or major move (8 frames in order). Needs numpy-free Pillow only.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def tile_grid(items, cols, tile_w, label_font, title, title_font):
    imgs = [Image.open(p).convert("RGB") for p, _ in items]
    w0, h0 = imgs[0].size
    tile_h = round(tile_w * h0 / w0)
    rows = (len(imgs) + cols - 1) // cols
    pad = 10
    head = 56
    sheet = Image.new("RGB", (cols * (tile_w + pad) + pad, head + rows * (tile_h + pad + 30) + pad), (32, 32, 36))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 14), title, fill=(240, 240, 240), font=title_font)
    for i, (im, (_, lab)) in enumerate(zip(imgs, items)):
        r, c = divmod(i, cols)
        x = pad + c * (tile_w + pad)
        y = head + r * (tile_h + pad + 30)
        sheet.paste(im.resize((tile_w, tile_h), Image.LANCZOS), (x, y))
        d.text((x, y + tile_h + 4), lab, fill=(220, 220, 220), font=label_font)
    return sheet


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    meta = json.loads((src / "frames.json").read_text())
    lf, tf = font(20), font(28)
    groups = {}
    for f in meta["frames"]:
        key = (f["kind"], f["slot"], f.get("beat") or f.get("at"))
        groups.setdefault(key, []).append(f)
    made = []
    for (kind, slot, name), frames in groups.items():
        items = [(src / f["file"], f"t = {f['t']:.2f} s") for f in frames]
        title = f"case {slot} - {'beat ' + name if kind == 'sheet' else name} ({meta['look']} look)"
        cols = 4 if kind == "sheet" else 4
        sheet = tile_grid(items, cols, 460, lf, title, tf)
        safe = name.replace(" ", "_").replace(">", "").replace("(", "").replace(")", "")
        fn = out / f"{kind}-{slot}-{safe}.png"
        sheet.save(fn)
        made.append(fn.name)
    (out / "index.json").write_text(json.dumps({"look": meta["look"], "sheets": made}, indent=1))
    print("\n".join(made))


if __name__ == "__main__":
    main()
