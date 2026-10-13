#!/usr/bin/env python3
"""
PSMA APP GUIDE -- verification gates (Windows Python, Pillow + numpy).

    python -B tools/psma-app-guide/gates.py g1 <textboxes.json>      provenance: every image shown is a
                                                                     manifest capture with its hash; autoPET only
    python -B tools/psma-app-guide/gates.py g2 <textboxes.json>      truth: the result cards against the
                                                                     app's own functions; every number on stage
    python -B tools/psma-app-guide/gates.py g3 <timeline.json>       clicks inside their controls, rings round targets
    python -B tools/psma-app-guide/gates.py g4 <timeline.json> <textboxes.json>
                                                                     reading time, type sizes, contrast
    python -B tools/psma-app-guide/gates.py g5 <diffs.json> <timeline.json> <textboxes.json>
                                                                     no one-frame jumps except declared cuts; safe margins

The timeline JSON comes from `capture.mjs timeline`, the text boxes (and the image files every
0.25 s shows) from `capture.mjs textboxes`, the frame differences from `capture.mjs video`
(mix_frames.py). truth.json comes from truth_wsl.py (WSL, the app's own scoring). Each gate
prints PASS / FAIL with its numbers.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

PORTFOLIO = Path(__file__).resolve().parents[2]
DATA = PORTFOLIO / "motion-data" / "app-guide"
MODULE = PORTFOLIO / "src" / "components" / "portal" / "modules" / "psma-app-guide"
SAFE = 80
TEXT_BOTTOM = 930  # the dialog's video controls cover the frame below this when paused (C4)
CAPTION_TOP = 790  # captions start below the subject area (y 770), two lines at most (C2, C3)
STAGE_W, STAGE_H = 1920, 1080


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def words(text):
    return len([w for w in re.sub(r"[\[\]]", "", text).split() if w])


def manifest():
    return json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))


def files_of(c):
    return [(f["file"], f["sha256"]) for f in c["frames"]] if c["kind"] == "seq" else [(c["file"], c["sha256"])]


# ---- G1 provenance ------------------------------------------------------------------------------
def g1(boxes_path=None):
    m = manifest()
    bad, n_files, cases, known = [], 0, set(), {}
    for cid, c in m["captures"].items():
        for rel, digest in files_of(c):
            n_files += 1
            known[rel] = digest
            p = DATA / rel
            if not p.is_file():
                bad.append(f"{cid}: {rel} missing")
            elif sha256(p) != digest:
                bad.append(f"{cid}: {rel} hash differs from the manifest")
        if c.get("case"):
            cases.add(c["case"])
        blob = json.dumps(c).lower()
        if "deeppsma" in blob or "deep-psma" in blob:
            bad.append(f"{cid}: DEEP-PSMA text in its manifest entry")
    for cs in cases:
        if not cs.startswith("psma_"):
            bad.append(f"case id {cs} is not autoPET-III")
    tool = (PORTFOLIO / "tools" / "psma-app-guide" / "capture_app.py").read_text(encoding="utf-8")
    refuses = "deeppsma" in tool and "refusing" in tool
    shown = []
    if boxes_path:
        shown = json.loads(Path(boxes_path).read_text(encoding="utf-8"))["files"]
        for f in shown:
            rel = f.split("/app-guide/", 1)[-1] if "/app-guide/" in f else f
            if rel not in known:
                bad.append(f"the stage shows {f}, which is not a manifest capture")
    ok = not bad and refuses
    print(f"G1 {'PASS' if ok else 'FAIL'}: {len(m['captures'])} captures, {n_files} files hashed and matching; "
          f"{len(shown)} distinct files shown by the film, all manifest captures; cases {sorted(cases)}; "
          f"the capture tool refuses deeppsma paths: {refuses}")
    for b in bad[:30]:
        print("  ", b)
    return ok


# ---- G2 truth -------------------------------------------------------------------------------------
CARD = re.compile(r"\nResult\n\n(\d+) lesions? predicted, ([\d.]+) mL \((\d+) before the size filter\)\.\n"
                  r"(?:\n(\d+)\nFOUND\n(\d+)\nMISSED\n(\d+)\nFALSE ALARMS\n([\d.]+)%\nLESION F1\n([\d.]+)%\nSENSITIVITY\n"
                  r"([\d.]+)%\nPPV\nVOXEL DICE \(DSC\)\n([\d.]+)%)?")

# numbers the stage itself draws, with where each comes from (the rest of the film's numbers are
# the app's own pixels); structural numbers (chapter numbering) are listed separately
STAGE_NUMBERS = {
    "2026": "TCIA collection page (checked 12 Oct 2026): Jeblick et al. (2026), the data citation",
    "10.7937/R7EP-3X37": "TCIA collection page: the dataset DOI",
    "4.0": "TCIA collection page: licence CC BY 4.0",
}


def g2(boxes_path):
    m = manifest()
    truth = json.loads((DATA / "truth.json").read_text(encoding="utf-8"))
    fails, checked = [], []
    # 1 · each filmed result card against score_prediction + the run's _predict.json (WSL, read only)
    for cid, run in (("D00", "protocol"), ("C90", "protocol"), ("F90", next(k for k in truth["runs"] if k.startswith("custom/"))),
                     ("G90", next(k for k in truth["runs"] if k.startswith("single/")))):
        text = "\n" + m["captures"][cid]["ui_text"]["main"]
        mt = CARD.search(text)
        if not mt:
            fails.append(f"{cid}: no result card text")
            continue
        tr = truth["runs"][run]
        out = tr["output"]
        want = [out["components_after_filter"], f"{out['predicted_volume_ml']:.1f}", out["components_before_filter"]]
        got = [int(mt[1]), mt[2], int(mt[3])]
        if got != want:
            fails.append(f"{cid}: '{mt[1]} lesions predicted, {mt[2]} mL ({mt[3]} before)' != _predict.json {want}")
        if mt[4] is not None:
            s = tr["scores"]
            want = [s["tp"], s["fn"], s["fp"], f"{100 * s['f1']:.1f}", f"{100 * s['sensitivity']:.1f}",
                    f"{100 * s['ppv']:.1f}", f"{100 * s['dsc']:.1f}"]
            got = [int(mt[4]), int(mt[5]), int(mt[6]), mt[7], mt[8], mt[9], mt[10]]
            if got != want:
                fails.append(f"{cid}: card {got} != score_prediction {want}")
            checked.append(f"{cid} ({run}): found {got[0]}, missed {got[1]}, false alarms {got[2]}, F1 {got[3]}%, "
                           f"sensitivity {got[4]}%, PPV {got[5]}%, Dice {got[6]}%")
        else:
            if "scores" in tr:
                fails.append(f"{cid}: a scored run shows no scores")
            checked.append(f"{cid} ({run}): {got[0]} lesions, {got[1]} mL, not scored (no ground truth)")
    # the lesion slices the film rings: each capture's slice is its lesion-list row's centre
    for cid in ("D01", "D02", "D03", "E04"):
        c = m["captures"][cid]
        label = c["state"]["slice_label"]
        if int(label.split()[1]) != c["lesion"]["centre"][1]:
            fails.append(f"{cid}: viewer on {label}, its lesion's centre is coronal {c['lesion']['centre'][1]}")
    # the sped-up tags: their run lengths are the app's own "Finished in N s"
    for run, key in (("C25", "protocol"), ("FR21", "custom"), ("GR20", "single")):
        st = m["captures"][run]["ui_text"]["status"]
        if not re.search(r"Finished in \d+ s", st):
            fails.append(f"{run}: no 'Finished in' in its status box")
    # 2 · every number in stage text traced to a source
    boxes = json.loads(Path(boxes_path).read_text(encoding="utf-8"))["boxes"]
    seen = {}
    for b in boxes:
        for n in re.findall(r"10\.7937/[\w-]+|(?<![\w.])\d+(?:\.\d+)?(?![\w])", b["text"]):  # names like F1, 3D are not numbers
            seen.setdefault(n, set()).add(b["cls"])
    struct = re.compile(r"^(0[0-9]|1[01])$")
    tag_numbers = set()
    for run, key in (("C25", "protocol"), ("FR21", "custom"), ("GR20", "single")):
        tag_numbers.add(re.search(r"Finished in (\d+) s", m["captures"][run]["ui_text"]["status"])[1])
    script = (MODULE / "script.js").read_text(encoding="utf-8")
    speeds = set(re.findall(r"const SPEED(?:_LATER)? = (\d+)", script))
    # the definitions panel shows the result card's own counts and scores (read at build from the
    # captured card text of D03, whose right panel is D00's)
    card = CARD.search("\n" + m["captures"]["D03"]["ui_text"]["main"])
    card_numbers = {card[i] for i in range(4, 11)} if card and card[4] else set()
    card_counts = {card[i] for i in range(4, 7)} if card and card[4] else set()
    # product names quoted from the app's own text (the rule note under Run model)
    app_text = m["captures"]["B18"]["ui_text"]["main"]
    untraced = []
    for n, classes in sorted(seen.items()):
        cls = " ".join(classes)
        if struct.match(n) and ("pag-label" in cls or "pag-agenda" in cls or "pag-card" in cls):
            continue
        if n in STAGE_NUMBERS:
            continue
        if "pag-defs" in cls and (n in card_numbers or ("pag-defs-text" in cls and n == "2")):
            continue  # the card's values; "2" is a constant of the F1 and Dice formulas
        if "pag-callout" in cls and n in card_counts:
            continue  # "Protocol run: 15 found, 3 missed, 2 false alarms": D03's card, as captured
        if ("pag-caption" in cls or "pag-tag" in cls) and n == "5070" and "RTX 5070 Ti" in app_text:
            continue  # "RTX 5070 Ti", quoted from the app's own note under Run model
        if "pag-tag" in cls and (n in tag_numbers or n in speeds):
            continue
        untraced.append(f"{n} ({cls})")
    fails += [f"number on stage with no source: {u}" for u in untraced]
    ok = not fails
    print(f"G2 {'PASS' if ok else 'FAIL'}: {len(checked)} filmed result cards equal the app's own scoring "
          f"(score_prediction, recomputed in WSL) and _predict.json; lesion slices match their rows; "
          f"{len(seen)} distinct numbers in stage text, all traced (tags: the app's 'Finished in' "
          f"{sorted(tag_numbers)} s and the playback speeds {sorted(speeds)}x; credits: the TCIA page)")
    for c in checked:
        print("   ", c)
    for f in fails:
        print("  ", f)
    return ok


# ---- G3 cursor and highlights ---------------------------------------------------------------------
def inside(p, r, tol=0.0):
    return r[0] - tol <= p[0] <= r[0] + r[2] + tol and r[1] - tol <= p[1] <= r[1] + r[3] + tol


def g3(tl_path):
    tl = json.loads(Path(tl_path).read_text(encoding="utf-8"))
    checks = tl["checks"]
    fails = []
    for c in checks["clicks"]:
        if not inside(c["pos"], c["rect"]):
            fails.append(f"click at {c['at']:.2f} s ({c['note']}) at {c['pos']} outside {c['target']} {c['rect']}")
    for r in checks["rings"]:
        ring, t = r["rect"], r["target"]
        if not (ring[0] <= t[0] and ring[1] <= t[1] and ring[0] + ring[2] >= t[0] + t[2] and ring[1] + ring[3] >= t[1] + t[3]):
            fails.append(f"ring {r['k']} {ring} does not enclose {r['ref']} {t}")
    ok = not fails
    print(f"G3 {'PASS' if ok else 'FAIL'}: {len(checks['clicks'])} clicks inside their controls' recorded rects, "
          f"{len(checks['rings'])} rings enclose their targets")
    for f in fails:
        print("  ", f)
    return ok


# ---- G4 reading time, type sizes, contrast --------------------------------------------------------
def lum(c):
    cs = [v / 255 for v in c]
    cs = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in cs]
    return 0.2126 * cs[0] + 0.7152 * cs[1] + 0.0722 * cs[2]


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def over(fg, a, bg):
    return [fg[i] * a + bg[i] * (1 - a) for i in range(3)]


def hexrgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def contrast_pairs():
    """Each kind of stage text against the darkest-to-lightest ground it can sit on, from the
    module's own CSS colours (PsmaAppGuide.css): the worst case of each pair is reported."""
    ink, ink2, gold, agenda = hexrgb("F4F6FA"), hexrgb("C9D2E3"), hexrgb("D6B12B"), hexrgb("98A4BC")
    stage, panel = hexrgb("0B1220"), hexrgb("111B30")
    white, page = [255, 255, 255], hexrgb("EEF1F7")
    scrim = over(stage, 0.985, white)                 # caption band over the brightest app pixels
    callout_bg = over(panel, 0.97, white)
    label_bg = over(stage, 0.88, white)
    tag_bg = over(stage, 0.94, white)
    return [
        ("caption ink on the scrim (over white)", ink, scrim),
        ("caption app name (gold) on the scrim", gold, scrim),
        ("callout text on its panel (over white)", ink, callout_bg),
        ("callout second line on its panel", ink2, callout_bg),
        ("chapter label on its backing (over white)", ink2, label_bg),
        ("sped-up tag on its backing (over white)", ink, tag_bg),
        ("card title on the curtain", ink, stage),
        ("card number (gold) on the curtain", gold, stage),
        ("card chapter list on the curtain", agenda, stage),
        ("title sub on the stage", ink2, stage),
        ("credits on the stage", ink2, stage),
        ("legend / definitions text on their panel", ink2, callout_bg),
    ]


def g4(tl_path, boxes_path):
    tl = json.loads(Path(tl_path).read_text(encoding="utf-8"))
    fails = []
    for c in tl["captions"]:
        need = words(c["text"]) / 3 + 1
        held = c["hidden"] - c["shown"]
        if held + 1e-6 < need:
            fails.append(f"caption '{c['text'][:50]}' held {held:.2f} s < {need:.2f} s")
    for c in tl["callouts"]:
        need = words(f"{c['text']} {c.get('sub') or ''}") / 3 + 1
        held = c["hidden"] - c["shown"]
        if held + 1e-6 < need:
            fails.append(f"callout '{c['text'][:50]}' held {held:.2f} s < {need:.2f} s")
    # a caption holds for every word on screen while a callout shares it (C2, C4)
    for c in tl["captions"]:
        for o in tl["callouts"]:
            if o["shown"] < c["hidden"] and c["shown"] < o["hidden"]:
                need = (words(c["text"]) + words(o["text"])) / 3 + 1
                if c["hidden"] - c["shown"] + 1e-6 < need:
                    fails.append(f"caption '{c['text'][:40]}' shares the screen with '{o['text']}' but holds "
                                 f"{c['hidden'] - c['shown']:.2f} s < {need:.2f} s")
    # a caption pushed more than 1 s past the time the script asked for is out of step with the
    # picture (C2, C3 round 3); script.js logs every push over 0.5 s
    drift = tl.get("checks", {}).get("drift", [])
    for d in drift:
        if d["at"] - d["asked"] > 1.0:
            fails.append(f"caption {d['id']} starts {d['at'] - d['asked']:.2f} s after the time asked for ({d['asked']:.2f})")
    boxes = json.loads(Path(boxes_path).read_text(encoding="utf-8"))["boxes"]
    sizes = {}
    for b in boxes:
        if b["opacity"] < 0.5:
            continue
        cls = b["cls"]
        minimum = 44 if "pag-caption" in cls or "pag-ui" in cls else 36
        key = (cls.split()[0] if cls else "?")
        sizes[key] = min(sizes.get(key, 999), b["fontPx"])
        if b["fontPx"] + 1e-6 < minimum and not ("pag-ui" in cls and b["fontPx"] >= 36):
            fails.append(f"text '{b['text'][:40]}' ({cls}) at {b['fontPx']} px < {minimum} px, t {b['t']}")
    pairs = [(name, contrast(fg, bg)) for name, fg, bg in contrast_pairs()]
    # text held at partial opacity (the legend's dimmed rows): its colour mixed into its panel (C4)
    panel = over(hexrgb("111B30"), 0.97, [255, 255, 255])
    dimmed = []
    for b in boxes:
        if "pag-legend" in b["cls"] and 0.6 <= b["opacity"] <= 0.7:
            fg = [float(v) for v in re.findall(r"[\d.]+", b["color"])[:3]]
            dimmed.append(contrast(over(fg, b["opacity"], panel), panel))
    if dimmed:
        pairs.append((f"dimmed legend rows (lowest of {len(dimmed)} samples, at their opacity)", min(dimmed)))
    worst = min(pairs, key=lambda p: p[1])
    for name, cr in pairs:
        if cr < 4.5:
            fails.append(f"contrast {name} {cr:.2f}:1 < 4.5:1")
    ok = not fails
    print(f"G4 {'PASS' if ok else 'FAIL'}: {len(tl['captions'])} captions and {len(tl['callouts'])} callouts held at "
          f"least words/3 + 1 s (and for every word on screen); smallest text per kind "
          f"{dict(sorted(sizes.items()))}; lowest contrast {worst[1]:.2f}:1 ({worst[0]})")
    for name, cr in pairs:
        print(f"    {cr:5.2f}:1  {name}")
    for d in drift:
        print(f"    drift: caption {d['id']} asked {d['asked']:.2f} s, starts {d['at']:.2f} s (+{d['at'] - d['asked']:.2f})")
    for f in fails[:40]:
        print("  ", f)
    return ok


# ---- G5 smoothness and safe margins ---------------------------------------------------------------
def g5(diff_path, tl_path, boxes_path):
    diffs = json.loads(Path(diff_path).read_text(encoding="utf-8"))
    tl = json.loads(Path(tl_path).read_text(encoding="utf-8"))
    boxes = json.loads(Path(boxes_path).read_text(encoding="utf-8"))
    fps = diffs["fps"]
    # declared cuts: every capture shown by a cut (a layout change, as the app makes it), every
    # model-run frame (the app's own status redraws), and every chapter card's cover
    cut_times = [L["t0"] for L in tl["layers"] if L.get("mode") in ("cut", "reveal", "scroll")]
    cut_times += [c["cover"] for c in tl["cards"]]
    cuts = {round(t * fps) for t in cut_times}
    # a chapter card's curtain sweeping across the frame is a declared transition too
    for c in tl["cards"]:
        for a, z in ((c["at"], c["cover"]), (c["uncover"], c["end"])):
            cuts |= set(range(int(a * fps), int(z * fps) + 2))
    cuts = sorted(cuts)
    d = diffs["diff"]
    spikes = []
    for i in range(1, len(d) - 1):
        # a one-frame spike: much bigger than both neighbours
        if d[i] > 6 and d[i] > 3 * max(d[i - 1], d[i + 1], 0.5) and not any(abs(i - c) <= 1 for c in cuts):
            spikes.append((i, round(i / fps, 3), round(d[i], 2)))
    margin = [b for b in boxes["boxes"] if b["opacity"] >= 0.05 and (
        b["x"] < SAFE - 0.5 or b["y"] < SAFE - 0.5 or b["x"] + b["w"] > STAGE_W - SAFE + 0.5
        or b["y"] + b["h"] > TEXT_BOTTOM + 0.5
        or (("pag-caption" in b["cls"] or "pag-ui" in b["cls"]) and b["y"] < CAPTION_TOP - 0.5))]
    ok = not spikes and not margin
    print(f"G5 {'PASS' if ok else 'FAIL'}: {len(d)} frame differences at {fps:g} fps, {len(spikes)} one-frame spikes "
          f"outside the declared cuts and curtain sweeps ({len(cuts)} frames); {len(margin)} text boxes outside the {SAFE} px safe margins "
          f"or below y {TEXT_BOTTOM}, or captions above y {CAPTION_TOP}")
    for s in spikes[:20]:
        print("   spike", s)
    for b in margin[:20]:
        print("   margin", round(b["t"], 2), b["cls"], b["text"][:40], [round(v) for v in (b["x"], b["y"], b["w"], b["h"])])
    return ok


# ---- G6 the file ----------------------------------------------------------------------------------
FFMPEG = r"C:\Users\james\.venvs\motion\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"


def top_boxes(path):
    """The MP4's top-level boxes, in file order."""
    import struct
    out = []
    with open(path, "rb") as f:
        while True:
            head = f.read(8)
            if len(head) < 8:
                break
            size, kind = struct.unpack(">I4s", head)
            if size == 1:
                size = struct.unpack(">Q", f.read(8))[0]
                f.seek(size - 16, 1)
            else:
                f.seek(size - 8, 1)
            out.append(kind.decode("latin-1"))
    return out


def g6(mp4, duration, fps="30", budget_mb="25", cap_mb="45"):
    import subprocess
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", mp4], capture_output=True, text=True).stderr
    video = [ln.strip() for ln in info.splitlines() if "Stream #" in ln and "Video:" in ln]
    audio = [ln for ln in info.splitlines() if "Stream #" in ln and "Audio:" in ln]
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    secs = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3]) if dur else -1
    boxes = top_boxes(mp4)
    size_mb = Path(mp4).stat().st_size / 1e6
    v = video[0] if video else ""
    fails = []
    if "h264 (High)" not in v:
        fails.append("not H.264 High")
    if "yuv420p" not in v or "bt709" not in v:
        fails.append("not yuv420p with BT.709 tags")
    if "1920x1080" not in v:
        fails.append("not 1920 x 1080")
    if not re.search(rf"\b{fps} fps", v):
        fails.append(f"not {fps} fps")
    if audio:
        fails.append("has an audio stream")
    if "moov" not in boxes or "mdat" not in boxes or boxes.index("moov") > boxes.index("mdat"):
        fails.append(f"moov is not before mdat ({boxes})")
    if size_mb > float(cap_mb):
        fails.append(f"{size_mb:.1f} MB over the {cap_mb} MB cap")
    if abs(secs - float(duration)) > 1 / float(fps) + 0.01:
        fails.append(f"duration {secs:.3f} s vs the timeline's {float(duration):.3f} s")
    ok = not fails
    print(f"G6 {'PASS' if ok else 'FAIL'}: {v}; audio streams {len(audio)}; boxes {boxes}; "
          f"{size_mb:.2f} MB (target {budget_mb}, cap {cap_mb}); duration {secs:.3f} s "
          f"(timeline {float(duration):.3f} s){'; over the size target' if size_mb > float(budget_mb) else ''}")
    for f in fails:
        print("  ", f)
    return ok


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    gate = sys.argv[1]
    ok = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6}[gate](*sys.argv[2:])
    sys.exit(0 if ok else 1)
