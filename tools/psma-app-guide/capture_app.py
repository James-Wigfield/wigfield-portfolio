#!/usr/bin/env python3
"""
PSMA APP GUIDE -- film the real Mamba PSMA app for /portal/psma-app-guide.

Drives the Streamlit app (Mamba_PSMA gui/app.py, commit 9ad3754) on a local port with the CDP
driver in Mamba_PSMA/outputs/gui-capture-tools/cdp.py: a headless Chrome at 1920 x 1080 CSS px,
device scale 2, so every capture is a lossless 3840 x 2160 PNG that stays sharp at a 2x zoom.
Each captured state goes to motion-data/app-guide/captures/<id>.png (gitignored, served only by
the dev server), with an entry in motion-data/app-guide/manifest.json: file, sha256, app commit,
case, settings, the visible text of the sidebar and the main column, the rects (CSS px) of the
controls the cursor and highlights use, scroll positions and the time it was taken.

    python -B tools/psma-app-guide/capture_app.py <shot-list> [--port 8502] [--only A01,A02]

Shot lists are the functions named shots_<name> at the bottom of this file. The rules they
keep (prompt section 3):
  * autoPET-III only. The tool refuses any path or option containing "deeppsma", and every
    case id it records must start with "psma_".
  * Never "Re-run model": click() refuses any button whose text contains "Re-run".
  * Clean frames: after every action, wait for Streamlit to go idle and the viewer image to
    load, blur focus, park the mouse off the controls, then take screenshots until two in a row
    are pixel-identical.
  * Frame sequences (slices, the rotating MIP) are clipped to the player iframe.
"""
import argparse
import base64
import datetime as _dt
import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True  # cdp.py lives in Mamba_PSMA: leave no __pycache__ there
MAMBA = Path(r"C:\Users\james\Documents\university\cits4010\Mamba_PSMA")
sys.path.insert(0, str(MAMBA / "outputs" / "gui-capture-tools"))
from cdp import Browser  # noqa: E402

PORTFOLIO = Path(__file__).resolve().parents[2]
DATA = PORTFOLIO / "motion-data" / "app-guide"
CAPS = DATA / "captures"
MANIFEST = DATA / "manifest.json"
AUTOPET_WIN = r"C:\Users\james\Documents\university\cits4010\datasets\PSMA-PET-CT-Lesions_v3"
IMAGES_WIN = AUTOPET_WIN + r"\imagesTr"
N = "psma_35852148926fc57d_2018-03-23"     # the scan filmed end to end (held-out test, no saved run)

# ---- helpers injected into the app page (read-only DOM queries) ----------------------------
JS_HELPERS = r"""
window.__pag = window.__pag || {
  q: (s, r) => (r || document).querySelector(s),
  qa: (s, r) => [...(r || document).querySelectorAll(s)],
  side() { return document.querySelector('[data-testid="stSidebar"]'); },
  mainEl() { return document.querySelector('[data-testid="stMain"]'); },
  widget(testid, text, exact) {
    return this.qa(`[data-testid="${testid}"]`).find(w => {
      const l = w.querySelector('[data-testid="stWidgetLabel"]');
      const s = (l ? l.innerText : w.innerText).trim();
      return exact ? s === text : s.includes(text);
    }) || null;
  },
  label(text) { return this.qa('label').find(l => l.innerText.trim() === text) || null; },
  button(text) { return this.qa('button').find(b => b.innerText.trim().includes(text)) || null; },
  summary(text) { return this.qa('summary').find(s => s.innerText.includes(text)) || null; },
  frame() { return document.querySelector('[data-testid="stIFrame"]'); },
  fel(sel) { const f = this.frame(); return f && f.contentDocument ? f.contentDocument.querySelector(sel) : null; },
  rect(el) { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; },
  frect(sel) {
    const f = this.frame(); const e = this.fel(sel); if (!f || !e) return null;
    const a = f.getBoundingClientRect(), r = e.getBoundingClientRect();
    return [a.x + r.x, a.y + r.y, r.width, r.height];
  },
  // the drawn image inside the viewer (object-fit: contain), in page CSS px
  imgRect() {
    const f = this.frame(); const im = this.fel('#mp_frame') || this.fel('#mp_spin'); if (!f || !im || !im.naturalWidth) return null;
    const a = f.getBoundingClientRect(), r = im.getBoundingClientRect();
    const s = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    return [a.x + r.x + (r.width - w) / 2, a.y + r.y + (r.height - h) / 2, w, h, im.naturalWidth, im.naturalHeight];
  },
  scrollers() {
    const m = this.mainEl(); const s = document.querySelector('[data-testid="stSidebarContent"]');
    return { main: m ? m.scrollTop : 0, sidebar: s ? s.scrollTop : 0 };
  },
  viewerReady() {
    const f = this.frame(); if (!f) return true;
    const im = this.fel('#mp_frame') || this.fel('#mp_spin');
    return !!(im && im.complete && im.naturalWidth > 0);
  },
  checked(groupLabel) {
    const w = this.widget('stRadio', groupLabel); if (!w) return null;
    const c = w.querySelector('input:checked'); return c ? c.closest('label').innerText.trim() : null;
  },
};
true
"""

# Named rects recorded with every full capture (CSS px, [x, y, w, h]; null if absent).
RECTS = {
    "help_button": "__pag.button('How to use this app')",
    "seg_dataset": "__pag.button('Dataset folder')",
    "seg_single": "__pag.button('Single scan')",
    "dataset_folder": "__pag.widget('stTextInput', 'Dataset folder')?.querySelector('input')",
    "test_toggle": "__pag.widget('stCheckbox', 'Held-out test cases only')",
    "case_picker": "__pag.widget('stSelectbox', 'Case (')?.querySelector('[role=\"group\"]')",
    "single_ct": "__pag.widget('stTextInput', 'CT (NIfTI')?.querySelector('input')",
    "single_pet": "__pag.widget('stTextInput', 'PET (NIfTI')?.querySelector('input')",
    "single_gt": "__pag.widget('stTextInput', 'Ground truth (optional)')?.querySelector('input')",
    "display_radio": "__pag.widget('stRadio', 'Display')",
    "opt_slices": "__pag.label('Slice scrubber')",
    "opt_mip": "__pag.label('3D rotation (MIP)')",
    "image_radio": "__pag.widget('stRadio', 'Image')",
    "opt_ct": "__pag.label('CT')",
    "opt_pet": "__pag.label('PET')",
    "opt_petct": "__pag.label('PET + CT')",
    "overlay_radio": "__pag.widget('stRadio', 'Overlay')",
    "opt_none": "__pag.label('None')",
    "opt_gt": "__pag.label('Ground truth')",
    "opt_pred": "__pag.label('Prediction')",
    "opt_cmp": "__pag.label('Prediction vs ground truth')",
    "opt_prob": "__pag.label('Probability')",
    "plane_radio": "__pag.widget('stRadio', 'Plane')",
    "opt_axial": "__pag.label('axial')",
    "opt_coronal": "__pag.label('coronal')",
    "opt_sagittal": "__pag.label('sagittal')",
    "ct_window": "__pag.widget('stSelectbox', 'CT window')?.querySelector('[role=\"group\"]')",
    "pet_cmap": "__pag.widget('stSelectbox', 'PET colour map')?.querySelector('[role=\"group\"]')",
    "suv_range": "__pag.widget('stSlider', 'PET SUV range')",
    "fusion": "__pag.widget('stSlider', 'PET opacity over CT')",
    "overlay_colours": "__pag.summary('Overlay colours')",
    "scheme": "__pag.widget('stSelectbox', 'Colour scheme')?.querySelector('[role=\"group\"]')",
    "overlay_alpha": "__pag.widget('stSlider', 'Overlay opacity')",
    "overlay_style": "__pag.widget('stRadio', 'Overlay style')",
    "opt_outline": "__pag.label('Outline')",
    "frames_per_turn": "__pag.widget('stSlider', 'Frames per turn')",
    "spin_fps": "__pag.widget('stSlider', 'Speed (fps)')",
    "model_settings": "__pag.summary('Model settings')",
    "reset_protocol": "__pag.button('Reset to protocol')",
    "weights": "__pag.widget('stTextInput', 'Weights (')?.querySelector('input')",
    "threshold": "__pag.widget('stNumberInput', 'Probability threshold')",
    "min_voxels": "__pag.widget('stNumberInput', 'Smallest lesion')",
    "save_prob": "__pag.label('Save the probability map')",
    "results_folder": "__pag.widget('stTextInput', 'Results folder')?.querySelector('input')",
    "viewer": "__pag.frame()",
    "slider": "__pag.frect('#mp_range')",
    "slice_label": "__pag.frect('#mp_idx')",
    "legend": "__pag.frect('.mp-legend')",
    "mip_play": "__pag.frect('#mp_play')",
    "mip_seek": "__pag.frect('#mp_seek')",
    "mip_speed": "__pag.frect('#mp_speed')",
    "badges": "__pag.q('.mp-badge')?.parentElement",
    "badge": "__pag.q('.mp-badge')",
    "case_id": "__pag.q('.mp-case')",
    "run_button": "__pag.button('Run model') || __pag.button('Running...')",
    "rerun_button": "__pag.button('Re-run model')",
    "saved_runs": "__pag.widget('stSelectbox', 'Saved runs for this scan')?.querySelector('[role=\"group\"]')",
    "status": "(__pag.summary('Running the model') || __pag.summary('Finished in') || __pag.summary('predict.py failed'))?.closest('[data-testid=\"stExpander\"]')",
    "saved_note": "__pag.qa('.mp-note').find(p => p.innerText.startsWith('Saved prediction'))",
    "rule_note": "__pag.qa('.mp-note').find(p => p.innerText.includes('-model ensemble'))",
    "metrics": "__pag.q('.mp-metrics')",
    "settings_used": "__pag.summary('Settings used')",
    "dl_mask": "__pag.button('Mask (.nii.gz)')",
    "dl_record": "__pag.button('Record (.json)')",
    "lesions": "__pag.summary('Lesions:')",
    "lesion_table": "__pag.q('[data-testid=\"stDataFrame\"]')",
    "dev_tools": "__pag.summary('Developer tools')",
    "listbox": "__pag.q('[role=\"listbox\"]')",
    "logo": "__pag.q('.mp-logo')",
    "masthead": "__pag.q('.mp-masthead')",
    "welcome": "__pag.qa('[data-testid=\"stVerticalBlockBorderWrapper\"]').find(w => w.innerText.includes('Choose a scan to begin'))",
    "layout_block": "__pag.q('.mp-layout')",
    "sidebar": "__pag.side()",
    "model_head": "__pag.qa('h4').find(h => h.innerText.trim() === 'Model')",
    "result_head": "__pag.qa('h4').find(h => h.innerText.trim() === 'Result')",
    "result_line": "__pag.qa('h4').find(h => h.innerText.trim() === 'Result')?.closest('[data-testid=\"stElementContainer\"]')?.nextElementSibling",
    "grid_note": "__pag.qa('[data-testid=\"stCaptionContainer\"]').find(c => c.innerText.includes(\"scan's own\"))",
    "lesions_caption": "__pag.qa('[data-testid=\"stCaptionContainer\"]').find(c => c.innerText.includes('Pick a row'))",
    "settings_caption": "__pag.qa('[data-testid=\"stCaptionContainer\"]').find(c => c.innerText.includes('pre-registered protocol'))",
    "min_voxels_note": "__pag.qa('[data-testid=\"stCaptionContainer\"]').find(c => c.innerText.includes(\"of the model's\"))",
    "alert_custom": "__pag.qa('[data-testid=\"stAlert\"]').find(a => a.innerText.includes('Custom settings'))",
    "alert_weights": "__pag.qa('[data-testid=\"stAlert\"]').find(a => /weights|checkpoint/i.test(a.innerText))",
    "alert_pet_units": "__pag.qa('[data-testid=\"stAlert\"]').find(a => a.innerText.includes('does not look like SUV'))",
    "alert_ct_units": "__pag.qa('[data-testid=\"stAlert\"]').find(a => a.innerText.includes('no air in the field'))",
    "alert_info": "__pag.qa('[data-testid=\"stAlert\"]').find(a => a.innerText.includes('No ground truth for this scan'))",
    "folds": "__pag.widget('stMultiSelect', 'Folds in the ensemble')",
    "decision_rule": "__pag.qa('[data-testid=\"stSidebar\"] strong').find(s => s.innerText.trim() === 'Decision rule')",
}


def now():
    return _dt.datetime.now().astimezone().isoformat(timespec="seconds")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def app_commit():
    """HEAD of Mamba_PSMA, and a refusal if gui/ differs from it (the app must be 9ad3754)."""
    head = subprocess.run(["git", "-C", str(MAMBA), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "-C", str(MAMBA), "status", "--porcelain", "--", "gui", "scripts/predict.py",
                            "evaluation", "preprocessing"], capture_output=True, text=True).stdout.strip()
    if dirty:
        raise SystemExit(f"the app's code differs from HEAD, refusing to film:\n{dirty}")
    return head


def load_manifest():
    if MANIFEST.is_file():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"about": "Real captures of the Mamba PSMA app for /portal/psma-app-guide (capture_app.py).",
            "app_repo": str(MAMBA), "viewport_css": [1920, 1080], "device_scale": 2, "captures": {},
            "numbers": {}}


class Film:
    def __init__(self, port, cdp_port=9471):
        self.base = f"http://localhost:{port}"
        self.commit = app_commit()
        self.m = load_manifest()
        self.m["app_commit"] = self.commit
        self.m["server"] = self.base
        CAPS.mkdir(parents=True, exist_ok=True)
        self.b = Browser(port=cdp_port, scale=2)
        self.case = None

    # -- page ---------------------------------------------------------------------------------
    def js(self, expr):
        self.b.js(JS_HELPERS)
        return self.b.js(expr)

    def open(self):
        self.b.goto(self.base)
        self.b.wait("document.body.innerText.includes('Mamba PSMA')", timeout=180)
        self.idle(1.5)

    def idle(self, settle=0.8, timeout=600):
        time.sleep(0.6)
        self.b.wait_idle(timeout=timeout)
        t0 = time.time()
        while not self.js("__pag.viewerReady()"):
            if time.time() - t0 > 120:
                raise TimeoutError("viewer image never loaded")
            time.sleep(0.25)
        time.sleep(settle)

    def guard(self):
        """autoPET-III only: the dataset box, the case id and every input path."""
        text = (self.js("document.body.innerText") or "").lower()
        if "deeppsma" in text:
            raise SystemExit("DEEP-PSMA text on screen: refusing to capture")
        cid = self.js("__pag.q('.mp-case')?.innerText || null")
        if cid and not cid.startswith("psma_"):
            raise SystemExit(f"case id {cid!r} is not an autoPET-III id: refusing to capture")
        self.case = cid

    def clean(self):
        """No caret, focus ring or hover left over: blur everything, park the mouse."""
        self.js("""(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur();
            const f = __pag.frame(); if (f && f.contentDocument && f.contentDocument.activeElement) f.contentDocument.activeElement.blur(); })()""")
        self.park()

    def park(self):
        self.b.send("Input.dispatchMouseEvent", type="mouseMoved", x=1912, y=1076)

    # -- actions --------------------------------------------------------------------------------
    def click_el(self, js_el, what):
        r = self.js(f"__pag.rect({js_el})")
        if not r:
            raise RuntimeError(f"nothing to click: {what}")
        self.b.click_xy(r[0] + r[2] / 2, r[1] + r[3] / 2)

    def click(self, text):
        if "Re-run" in text:
            raise SystemExit("never press Re-run model")
        ok = self.js(f"""(() => {{ const b = __pag.button({json.dumps(text)});
            if (!b || b.innerText.includes('Re-run')) return false; b.scrollIntoView({{block: 'nearest'}}); b.click(); return true; }})()""")
        if not ok:
            raise RuntimeError(f"no button {text!r}")

    def toggle(self, text):
        """Flip an st.toggle; checks that it flipped. Returns the switch's centre (CSS px), where
        the film's cursor clicks. The switch is clicked through its own input (react-aria's
        switch ignores a CDP mouse press on its track, though a person's click and the Space
        key both work; the state change is the same)."""
        before = self.js(f"__pag.widget('stCheckbox', {json.dumps(text)})?.querySelector('input')?.checked")
        r = self.js(f"__pag.rect(__pag.widget('stCheckbox', {json.dumps(text)})?.querySelector('label > div'))")
        if not r:
            raise RuntimeError(f"no toggle {text!r}")
        x, y = r[0] + r[2] / 2, r[1] + r[3] / 2
        self.js(f"__pag.widget('stCheckbox', {json.dumps(text)}).querySelector('input').click()")
        self.idle(1.0)
        after = self.js(f"__pag.widget('stCheckbox', {json.dumps(text)})?.querySelector('input')?.checked")
        if after == before:
            raise RuntimeError(f"toggle {text!r} did not flip ({before} -> {after})")
        return [x, y]

    def click_label(self, text):
        """A radio option (or any label) clicked with the mouse, as a user does: on its round
        button at the label's left end. Returns the click point (CSS px)."""
        r = self.js(f"""(() => {{ const l = __pag.label({json.dumps(text)}); if (!l) return null;
            l.scrollIntoView({{block: 'nearest'}}); return __pag.rect(l); }})()""")
        if not r:
            raise RuntimeError(f"no label {text!r}")
        inp = f"__pag.label({json.dumps(text)})?.querySelector('input')"
        before = self.js(f"{inp}?.checked")
        x, y = r[0] + 10, r[1] + r[3] / 2
        self.b.click_xy(x, y)
        time.sleep(0.4)
        if before is not None and self.js(f"{inp}?.checked") == before and not (before and self.js(f"{inp}?.type") == "radio"):
            # the mouse press did not reach a react-aria control: click its own input (same change)
            self.js(f"{inp}.click()")
            time.sleep(0.4)
            if self.js(f"{inp}?.checked") == before:
                raise RuntimeError(f"{text!r} did not change")
        return [x, y]

    def type_text(self, label, text, enter=False, testid="stTextInput", replace=True):
        if "deeppsma" in text.lower():
            raise SystemExit("refusing a DEEP-PSMA path")
        ok = self.js(f"""(() => {{ const w = __pag.widget({json.dumps(testid)}, {json.dumps(label)});
            const i = w && w.querySelector('input'); if (!i) return false; i.focus();
            {'i.select();' if replace else 'i.setSelectionRange(i.value.length, i.value.length);'} return true; }})()""")
        if not ok:
            raise RuntimeError(f"no input {label!r}")
        if replace:
            self.b.send("Input.dispatchKeyEvent", type="keyDown", key="Backspace", code="Backspace", windowsVirtualKeyCode=8)
            self.b.send("Input.dispatchKeyEvent", type="keyUp", key="Backspace", code="Backspace", windowsVirtualKeyCode=8)
        if text:
            self.b.send("Input.insertText", text=text)
        if enter:
            self.enter()

    def enter(self):
        self.b.send("Input.dispatchKeyEvent", type="keyDown", key="Enter", code="Enter", windowsVirtualKeyCode=13, text="\r")
        self.b.send("Input.dispatchKeyEvent", type="keyUp", key="Enter", code="Enter", windowsVirtualKeyCode=13)

    def open_select(self, label):
        """Open a selectbox's list (left open for a capture) with a click on its chevron, at the
        box's right end: a click on the text would drop the caret mid-text."""
        r = self.js(f"__pag.rect(__pag.widget('stSelectbox', {json.dumps(label)})?.querySelector('[role=\"group\"]'))")
        if not r:
            raise RuntimeError(f"no selectbox {label!r}")
        self.b.click_xy(r[0] + r[2] - 18, r[1] + r[3] / 2)
        time.sleep(0.8)

    def select_all(self):
        """Select the focused box's text, as Ctrl+A does, so typing replaces it."""
        self.js("document.activeElement && document.activeElement.select && document.activeElement.select()")
        time.sleep(0.2)

    def pick(self, option):
        if "deeppsma" in option.lower():
            raise SystemExit("refusing a DEEP-PSMA option")
        ok = self.js(f"""(() => {{ const o = [...document.querySelectorAll('[role="option"]')]
            .find(o => o.innerText.includes({json.dumps(option)})); if (!o) return false; o.click(); return true; }})()""")
        if not ok:
            raise RuntimeError(f"no option {option!r}")

    def filter_select(self, text):
        self.b.send("Input.insertText", text=text)
        time.sleep(0.8)

    def select(self, label, option):
        self.open_select(label)
        self.select_all()
        self.filter_select(option)
        self.pick(option)

    def set_number(self, label, value):
        self.js(f"""(() => {{ const w = __pag.widget('stNumberInput', {json.dumps(label)}); const i = w.querySelector('input'); i.focus(); i.select(); }})()""")
        self.b.send("Input.insertText", text=str(value))
        self.enter()

    def open_expander(self, title):
        self.js(f"""(() => {{ const s = __pag.summary({json.dumps(title)}); if (s && !s.parentElement.open) s.click(); }})()""")
        time.sleep(0.9)

    def close_expander(self, title):
        self.js(f"""(() => {{ const s = __pag.summary({json.dumps(title)}); if (s && s.parentElement.open) s.click(); }})()""")
        time.sleep(0.9)

    def scroll_main(self, y):
        self.js(f"__pag.mainEl().scrollTo(0, {y})")
        time.sleep(0.6)

    def scroll_sidebar(self, y):
        self.js(f"document.querySelector('[data-testid=\"stSidebarContent\"]').scrollTo(0, {y})")
        time.sleep(0.6)

    def set_slice(self, k):
        """What a drag of the slice slider does: set its value and fire its input event."""
        self.js(f"""(() => {{ const r = __pag.fel('#mp_range'); r.value = {int(k)}; r.dispatchEvent(new Event('input')); }})()""")

    def mip_hold(self, k):
        """Hold the auto-playing MIP on frame k through the player's own show(): its timer stops and
        the button keeps its 'Pause' label, which is what the playing player shows at that frame."""
        self.js(f"""(() => {{ const w = __pag.frame().contentWindow; w.eval('clearInterval(timer); timer = null; show({int(k)})'); }})()""")

    # -- capture --------------------------------------------------------------------------------
    def _shot(self, clip=None):
        params = {"format": "png"}
        if clip:
            params["clip"] = {"x": clip[0], "y": clip[1], "width": clip[2], "height": clip[3], "scale": 1}
        data = base64.b64decode(self.b.send("Page.captureScreenshot", **params)["data"])
        return data, np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))

    def stable_png(self, clip=None, tries=8, gap=0.35):
        """Screenshots until two in a row are pixel-identical; returns the PNG bytes."""
        prev = None
        for _ in range(tries):
            data, arr = self._shot(clip)
            if prev is not None and arr.shape == prev.shape and np.array_equal(arr, prev):
                return data
            prev = arr
            time.sleep(gap)
        raise RuntimeError("the screen never settled (two screenshots in a row differ)")

    def caret_png(self, box, span=1.5, gap=0.09, tries=3):
        """A frame with text being typed: the focused box's caret blinks, so the screen has two
        states. Screenshots over more than one blink period; everything outside the box must be
        identical in all of them, and the one kept has the caret drawn (the darker of the two
        inside the box), so every typing frame shows it the same way."""
        s = self.b.scale
        x0, y0 = max(0, int((box[0] - 4) * s)), max(0, int((box[1] - 4) * s))
        x1, y1 = int((box[0] + box[2] + 4) * s), int((box[1] + box[3] + 4) * s)
        for _ in range(tries):
            uniq = []
            t0 = time.time()
            while time.time() - t0 < span:
                data, arr = self._shot()
                if not any(np.array_equal(arr, u[1]) for u in uniq):
                    uniq.append((data, arr))
                time.sleep(gap)
            if len(uniq) == 1:
                return uniq[0][0]
            if len(uniq) == 2:
                a, b = uniq[0][1].copy(), uniq[1][1].copy()
                a[y0:y1, x0:x1] = 0
                b[y0:y1, x0:x1] = 0
                if np.array_equal(a, b):
                    return min(uniq, key=lambda u: float(u[1][y0:y1, x0:x1].mean()))[0]
            time.sleep(0.5)
        raise RuntimeError("the screen never settled beyond the caret")

    def focus_box(self):
        """The rect of a focused text box (a caret blinks in it), else None."""
        return self.js("""(() => { const a = document.activeElement;
            return a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['range', 'checkbox', 'radio'].includes(a.type)))
                ? __pag.rect(a) : null; })()""")

    def rects(self):
        exprs = ",\n".join(f"{json.dumps(k)}: __pag.rect({v})" if not v.startswith("__pag.frect")
                           else f"{json.dumps(k)}: {v}" for k, v in RECTS.items())
        return self.js(f"(() => {{ try {{ return {{ {exprs} }}; }} catch (e) {{ return {{error: String(e)}}; }} }})()")

    def state(self):
        return self.js("""(() => ({
            input: [...document.querySelectorAll('[data-testid="stSidebar"] button[kind*="segmented_control"]')]
                .filter(b => b.getAttribute('kind') && b.getAttribute('kind').includes('Active')).map(b => b.innerText.trim())[0] || null,
            display: __pag.checked('Display'), image: __pag.checked('Image'), overlay: __pag.checked('Overlay'),
            plane: __pag.checked('Plane'), overlay_style: __pag.checked('Overlay style'),
            ct_window: __pag.widget('stSelectbox', 'CT window')?.querySelector('input')?.value || null,
            pet_cmap: __pag.widget('stSelectbox', 'PET colour map')?.querySelector('input')?.value || null,
            case_pick: __pag.widget('stSelectbox', 'Case (')?.querySelector('input')?.value || null,
            seg: __pag.qa('[data-testid="stSidebar"] [data-testid="stButtonGroup"] button')
                .map(b => [b.innerText.trim(), b.getAttribute('kind'), b.getAttribute('aria-checked') || b.getAttribute('aria-pressed')]),
            slice_label: __pag.fel('#mp_idx')?.innerText || null,
            mip_caption: __pag.fel('#mp_cap')?.innerText || null,
            scroll: __pag.scrollers(),
        }))()""")

    def snap(self, cid, note="", settle=0.6, clean=True):
        """One full-window capture: captures/<cid>.png + its manifest entry."""
        self.idle(settle)
        if clean:
            self.clean()
        else:
            self.park()       # an open list keeps its focus; only the mouse moves away
        time.sleep(0.3)
        self.guard()
        box = None if clean else self.focus_box()
        png = self.caret_png(box) if box else self.stable_png()
        path = CAPS / f"{cid}.png"
        path.write_bytes(png)
        entry = {
            "id": cid, "kind": "full", "file": f"captures/{cid}.png", "sha256": sha256(path),
            "px": list(Image.open(path).size), "app_commit": self.commit, "case": self.case,
            "state": self.state(), "rects": self.rects(), "img": self.js("__pag.imgRect()"),
            "options": self.js("[...document.querySelectorAll('[role=\"option\"]')].map(o => [o.innerText.trim(), __pag.rect(o)])"),
            "ui_text": {"sidebar": self.js("__pag.side()?.innerText || ''"),
                        "main": self.js("__pag.mainEl()?.innerText || ''")},
            "focus_box": box, "taken": now(), "note": note,
        }
        self.m["captures"][cid] = entry
        self.save()
        print(f"  {cid}: {entry['case']} | {entry['state']['display']} {entry['state']['image']} "
              f"{entry['state']['overlay']} {entry['state']['slice_label'] or ''} | {note}")
        return entry

    def seq(self, sid, values, setter, base=None, note=""):
        """A frame sequence clipped to the viewer iframe: captures/<sid>/f####.png."""
        self.idle(0.5)
        self.clean()
        self.guard()
        clip = self.js("__pag.rect(__pag.frame())")
        d = CAPS / sid
        d.mkdir(parents=True, exist_ok=True)
        frames = []
        for i, v in enumerate(values):
            setter(v)
            time.sleep(0.12)
            t0 = time.time()
            while not self.js("__pag.viewerReady()"):
                if time.time() - t0 > 30:
                    raise TimeoutError("frame image never loaded")
                time.sleep(0.05)
            png = self.stable_png(clip=clip, gap=0.15)
            p = d / f"f{i:04d}.png"
            p.write_bytes(png)
            frames.append({"file": f"captures/{sid}/f{i:04d}.png", "sha256": sha256(p), "value": v,
                           "slider": self.js("__pag.frect('#mp_range') || __pag.frect('#mp_seek')"),
                           "range": self.js("(() => { const r = __pag.fel('#mp_range') || __pag.fel('#mp_seek'); "
                                            "return r ? [+r.min, +r.max, +r.value] : null; })()"),
                           "label": self.js("(__pag.fel('#mp_idx') || __pag.fel('#mp_cap'))?.innerText || null")})
        entry = {"id": sid, "kind": "seq", "clip": clip, "base": base, "app_commit": self.commit, "case": self.case,
                 "state": self.state(), "frames": frames, "px": list(Image.open(d / "f0000.png").size),
                 "taken": now(), "note": note}
        self.m["captures"][sid] = entry
        self.save()
        print(f"  {sid}: {len(frames)} frames, clip {clip} | {note}")
        return entry

    def hi(self, cid, rect, base, note="", density=4):
        """A clip of the screen at device scale `density` (the page re-rasterised, as a browser
        zoom would draw it), for close-ups beyond 2x: captures/<cid>.png, drawn by the stage
        over `base` (a full capture of the same state) inside `rect` (CSS px)."""
        self.idle(0.4)
        self.clean()
        self.guard()
        rect = [round(v, 2) for v in rect]
        k = density / self.b.scale
        prev = None
        for _ in range(8):
            r = self.b.send("Page.captureScreenshot", format="png",
                            clip={"x": rect[0], "y": rect[1], "width": rect[2], "height": rect[3], "scale": k})
            data = base64.b64decode(r["data"])
            arr = np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))
            if prev is not None and arr.shape == prev.shape and np.array_equal(arr, prev):
                break
            prev = arr
            time.sleep(0.3)
        else:
            raise RuntimeError("the clip never settled")
        path = CAPS / f"{cid}.png"
        path.write_bytes(data)
        entry = {"id": cid, "kind": "clip", "file": f"captures/{cid}.png", "sha256": sha256(path),
                 "px": list(Image.open(path).size), "density": density, "rect": rect, "base": base,
                 "app_commit": self.commit, "case": self.case, "state": self.state(),
                 "img": self.js("__pag.imgRect()"), "taken": now(), "note": note}
        self.m["captures"][cid] = entry
        self.save()
        print(f"  {cid}: clip {rect} at {density}x -> {entry['px']} | {note}")
        return entry

    def click_row(self, i):
        """Select row i of the lesion list the way a user does: a click on the row's selection
        box at the grid's left edge (st.dataframe, single-row selection; rows 35 px under a
        35 px header). Returns the click point and the row's rect (CSS px)."""
        g = self.js("__pag.rect(__pag.q('[data-testid=\"stDataFrame\"]'))")
        row = [g[0], g[1] + 35 + 35 * i, g[2], 35]
        x, y = g[0] + 20, row[1] + 17.5
        self.b.click_xy(x, y)
        return [x, y], row

    # -- more actions ----------------------------------------------------------------------------
    def key(self, name, code=None, vk=0, n=1, gap=0.12):
        for _ in range(n):
            self.b.send("Input.dispatchKeyEvent", type="keyDown", key=name, code=code or name, windowsVirtualKeyCode=vk)
            self.b.send("Input.dispatchKeyEvent", type="keyUp", key=name, code=code or name, windowsVirtualKeyCode=vk)
            time.sleep(gap)

    def escape(self):
        self.key("Escape", vk=27)
        time.sleep(0.4)

    def slider_keys(self, label, presses, right=True, thumb=0):
        """Move a Streamlit slider thumb with the keyboard (one step per press), as a user can.
        This Streamlit's sliders are react-aria: each thumb holds a visually hidden range input."""
        ok = self.js(f"""(() => {{ const w = __pag.widget('stSlider', {json.dumps(label)});
            const t = w && w.querySelectorAll('input[type="range"]')[{thumb}]; if (!t) return false; t.focus(); return true; }})()""")
        if not ok:
            raise RuntimeError(f"no slider {label!r}")
        self.key("ArrowRight" if right else "ArrowLeft", vk=39 if right else 37, n=presses)
        self.idle(1.0)

    def slider_value(self, label):
        return self.js(f"""[...(__pag.widget('stSlider', {json.dumps(label)})?.querySelectorAll('input[type="range"]') || [])]
            .map(t => t.value)""")

    def thumbs(self, label):
        """The visible thumbs' rects of a slider (CSS px), for the cursor."""
        return self.js(f"""[...(__pag.widget('stSlider', {json.dumps(label)})?.querySelectorAll('input[type="range"]') || [])]
            .map(t => __pag.rect(t.parentElement.parentElement))""")

    def pick_case(self, cid):
        if not cid.startswith("psma_"):
            raise SystemExit("autoPET-III ids only")
        if self.js("__pag.widget('stSelectbox', 'Case (')?.querySelector('input')?.value") != cid:
            self.select("Case (", cid)
            self.idle(1.0)

    def fresh(self, cid=N):
        """A new browser session on the app, dataset folder as launched, case `cid`."""
        self.open()
        if cid:
            self.pick_case(cid)

    def has_saved(self):
        return bool(self.js("!!__pag.button('Re-run model')"))

    def live(self, cid, note, t_rel):
        """A capture during a model run: one screenshot, no waiting for idle (the status box
        redraws every second); the time since the click is recorded."""
        self.park()
        self.guard()
        data, _ = self._shot()
        path = CAPS / f"{cid}.png"
        path.write_bytes(data)
        status = self.js("""(() => { const s = (__pag.summary('Running the model') || __pag.summary('Finished in')
            || __pag.summary('predict.py failed')); const box = s && s.closest('[data-testid="stExpander"]');
            return box ? box.innerText : null; })()""")
        entry = {"id": cid, "kind": "full", "file": f"captures/{cid}.png", "sha256": sha256(path),
                 "px": list(Image.open(path).size), "app_commit": self.commit, "case": self.case,
                 "state": self.state(), "rects": self.rects(), "img": self.js("__pag.imgRect()"),
                 "options": [], "ui_text": {"status": status, "main": self.js("__pag.mainEl()?.innerText || ''")},
                 "t_since_click": round(t_rel, 2), "taken": now(), "note": note, "live": True}
        self.m["captures"][cid] = entry
        self.save()
        print(f"  {cid}: +{t_rel:.1f} s | {(status or '').splitlines()[0] if status else '-'}")
        return entry

    def run_and_film(self, prefix, every=2.4, timeout=600):
        """Press Run model (never Re-run) and capture the status box until the run ends."""
        if self.has_saved():
            raise SystemExit("this scan already has a saved run for these settings: never press Re-run model")
        if not self.js("!!__pag.button('Run model')"):
            raise SystemExit("no Run model button")
        frames = []
        t0 = time.time()
        self.click("Run model")
        self.b.wait("document.body.innerText.includes('Running the model:')", timeout=60)
        k = 1
        while True:
            t = time.time() - t0
            frames.append(self.live(f"{prefix}{k:02d}", "the run, live", t))
            k += 1
            done = self.js("document.body.innerText.includes('Finished in') || document.body.innerText.includes('predict.py failed')")
            if done:
                break
            if t > timeout:
                raise TimeoutError("the run never finished")
            time.sleep(max(0.2, every - (time.time() - t0 - t)))
        took = time.time() - t0
        return frames, took

    def save(self):
        """Write the manifest atomically. Windows can hold the file for a moment (the dev
        server's watcher, a virus scan), so the replace is retried; a run is never lost to it."""
        DATA.mkdir(parents=True, exist_ok=True)
        tmp = MANIFEST.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.m, indent=1), encoding="utf-8")
        for k in range(40):
            try:
                tmp.replace(MANIFEST)
                return
            except PermissionError:
                time.sleep(0.1 + 0.05 * k)
        raise PermissionError(f"could not replace {MANIFEST} after 40 tries")

    def close(self):
        self.b.close()


# ---- shot lists ----------------------------------------------------------------------------------
def shots_style(f):
    """Three states for the checkpoint's style frames (no model run)."""
    f.open()
    # the welcome page: what a first-time user sees with an empty dataset box
    f.type_text("Dataset folder", "", enter=True)
    f.snap("A01", "welcome page, dataset box empty")
    f.type_text("Dataset folder", AUTOPET_WIN, enter=True)
    f.idle(1.0)
    f.select("Case (", N)
    f.snap("A10", "N loaded: slices, CT, ground truth overlay")
    f.open_select("CT window")
    f.snap("B07", "CT window list open", clean=False)
    f.b.send("Input.dispatchKeyEvent", type="keyDown", key="Escape", code="Escape", windowsVirtualKeyCode=27)
    f.b.send("Input.dispatchKeyEvent", type="keyUp", key="Escape", code="Escape", windowsVirtualKeyCode=27)
    f.idle()


TRAINING = "psma_0179419e313f7d8c_2019-06-10"   # an autoPET-III training case (badge only; never run)
PATH_CHUNKS = ["C:\\Users\\james\\", "Documents\\university\\", "cits4010\\datasets\\", "PSMA-PET-CT-", "Lesions_v3"]
EMPTY_WEIGHTS = r"C:\Users\james\Documents\university\cits4010\Mamba_PSMA\outputs\app-guide\empty-weights"


def shots_pre(f):
    """Chapters 2-3: everything before N's run (N must have no saved result)."""
    f.open()
    # 2 · the welcome page, then the dataset folder typed as a Windows path
    f.type_text("Dataset folder", "", enter=True)
    f.snap("A01", "welcome page, dataset box empty")
    typed = ""
    for i, chunk in enumerate(PATH_CHUNKS):
        f.type_text("Dataset folder", chunk, replace=(i == 0))
        typed += chunk
        f.snap(f"A0{i + 2}", f"typing the folder: {typed}", clean=False, settle=0.3)
    f.enter()
    f.idle(1.5)
    f.snap("A07", "Enter: the held-out test list, first case loaded")
    f.open_select("Case (")
    f.snap("A08", "case picker open", clean=False)
    f.select_all()
    f.filter_select("3585")
    f.snap("A09", "picker filtered by typing 3585", clean=False)
    f.pick(N)
    f.idle(1.5)
    if f.has_saved():
        raise SystemExit("N already has a saved run: pre-run captures need it without one")
    f.snap("A10", "N loaded: slices, CT, ground truth overlay")
    xy = f.toggle("Held-out test cases only")
    f.idle(1.2)
    e = f.snap("A11", "test-only toggle off: every case listed, test first")
    e["click"] = {"at": xy}
    f.save()
    f.open_select("Case (")
    f.select_all()
    f.filter_select("psma_01")
    f.snap("A12", "picker filtered to training cases", clean=False)
    f.pick(TRAINING)
    f.idle(1.5)
    f.snap("A13", "a training case: Training badge")
    f.toggle("Held-out test cases only")
    f.idle(1.2)
    f.pick_case(N)
    f.snap("A10b", "N again (should match A10)")
    f.click("Single scan")
    f.idle(1.2)
    f.snap("A14", "Single scan: CT, PET, ground truth boxes")
    f.click("Dataset folder")
    f.idle(1.2)
    f.pick_case(N)

    # 3 · look around (N, before its run)
    f.snap("B01", "N, slices, coronal, CT, ground truth")
    f.seq("S-SCRUB", list(range(130, 201)), f.set_slice, base="B01", note="coronal slices 130-200, ground truth")
    f.set_slice(169)
    f.click_label("axial")
    f.snap("B02", "axial")
    f.click_label("sagittal")
    f.snap("B03", "sagittal")
    f.click_label("coronal")
    f.click_label("PET")
    f.snap("B04", "PET")
    f.click_label("PET + CT")
    f.snap("B05", "PET + CT, opacity 0.5")
    for i, n in enumerate((2, 2, 2)):
        f.slider_keys("PET opacity over CT", n)
        f.snap(f"B06{'abc'[i]}", f"PET opacity over CT {f.slider_value('PET opacity over CT')}")
    f.slider_keys("PET opacity over CT", 6, right=False)
    f.click_label("CT")
    f.open_select("CT window")
    f.snap("B07", "CT window list open", clean=False)
    f.pick("Lung")
    f.snap("B08", "CT window Lung")
    f.select("CT window", "Bone")
    f.snap("B09", "CT window Bone")
    f.select("CT window", "Soft tissue")
    f.click_label("PET")
    f.open_select("PET colour map")
    f.snap("B10", "PET colour map list open", clean=False)
    f.pick("Inverted grey")
    f.snap("B11", "PET colour map Inverted grey")
    for i in range(3):
        f.slider_keys("PET SUV range", 4, thumb=1)
        f.snap(f"B12{'abc'[i]}", f"SUV range {f.slider_value('PET SUV range')}")
    f.slider_keys("PET SUV range", 12, right=False, thumb=1)
    f.select("PET colour map", "Hot")
    f.click_label("3D rotation (MIP)")
    f.idle(2.0, timeout=900)
    f.mip_hold(0)
    f.snap("B13", "3D rotation (MIP), PET, ground truth, 36 frames per turn")
    f.slider_keys("Frames per turn", 3)
    f.idle(2.0, timeout=900)
    f.mip_hold(0)
    f.snap("B14", "Frames per turn 72")
    f.seq("S-MIP-GT", list(range(72)), f.mip_hold, base="B14", note="the MIP turning, ground truth, 72 frames")
    f.mip_hold(0)
    f.js("__pag.fel('#mp_play').click()")
    f.snap("B15", "MIP paused (Play)")
    f.js("(() => { const s = __pag.fel('#mp_seek'); s.value = 18; s.dispatchEvent(new Event('input')); })()")
    f.snap("B16", "MIP scrubbed to frame 18")
    f.js("(() => { const s = __pag.fel('#mp_speed'); s.value = 20; s.dispatchEvent(new Event('input')); })()")
    f.js("__pag.frame().contentWindow.eval('clearInterval(timer); timer = null')")
    f.snap("B17", "MIP speed 20 fps")
    f.click_label("Slice scrubber")
    f.idle(1.5)
    f.snap("B18", "back on slices (CT, ground truth): the state Run model starts from")


def shots_pre2(f):
    """An extra pre-run state: the CT window list opened again with Lung selected (before Bone),
    so the film never reuses B07's list (Soft tissue selected) after Lung was picked."""
    f.open()
    # the folder as typed in shots_pre (a Windows path), so the sidebar matches B07-B09
    f.type_text("Dataset folder", AUTOPET_WIN, enter=True)
    f.idle(1.5)
    f.pick_case(N)
    if f.has_saved():
        raise SystemExit("N already has a saved run: pre-run captures need it without one")
    f.select("CT window", "Lung")
    f.idle(1.0)
    f.snap("B08c", "CT window Lung, in a new session (should match B08)")
    f.open_select("CT window")
    f.snap("B08b", "CT window list open again, Lung selected", clean=False)
    f.escape()
    f.idle()


def shots_pre3(f):
    """One more pre-run state (N's own run moved aside for it, on a freshly started server so no
    run status is left over): the PET colour map list opened again with Inverted grey selected,
    so the film can go back to Hot on screen before the rotation, as a user would."""
    f.open()
    f.type_text("Dataset folder", AUTOPET_WIN, enter=True)
    f.idle(1.5)
    f.pick_case(N)
    if f.has_saved():
        raise SystemExit("N has a saved run: move this session's run folder aside first")
    f.click_label("PET")
    f.idle(1.0)
    f.select("PET colour map", "Inverted grey")
    f.idle(1.0)
    f.snap("B11c", "PET colour map Inverted grey, in a new session (should match B11)")
    f.open_select("PET colour map")
    f.snap("B11L", "PET colour map list open again, Inverted grey selected", clean=False)
    f.pick("Hot")
    f.idle(1.0)
    f.snap("B04c", "Hot again (should match B04)")


def _type_steps(f, steps, ids, note):
    """Type into the focused box a step at a time, a capture after each (the caret kept)."""
    so_far = ""
    for text, cid in zip(steps, ids):
        f.filter_select(text)
        so_far += text
        f.snap(cid, f"{note}: typed so far '{so_far}'", clean=False, settle=0.3)


def shots_typing1(f):
    """Critic C1: the case filter typed a few characters at a time (before A09). The list's first
    case is loaded (A07), so N's saved run does not matter here."""
    f.open()
    f.type_text("Dataset folder", AUTOPET_WIN, enter=True)
    f.idle(1.5)
    f.open_select("Case (")
    f.snap("A08c", "case picker open (should match A08)", clean=False)
    f.select_all()
    _type_steps(f, ["3", "5", "8"], ["A09a", "A09b", "A09c"], "filtering the case picker")
    f.filter_select("5")
    f.snap("A09d", "picker filtered by typing 3585 (should match A09)", clean=False)
    f.escape()


def shots_typing2(f):
    """Critic C1: with the test-only switch off, the picker opens on every case (test cases
    first), then filters as an id is typed (before A12). N must have no saved run: this
    session's run folder is moved aside first."""
    f.open()
    f.type_text("Dataset folder", AUTOPET_WIN, enter=True)
    f.idle(1.5)
    f.pick_case(N)
    if f.has_saved():
        raise SystemExit("N has a saved run: move this session's run folder aside first")
    f.snap("A10c", "N loaded (should match A10)")
    f.toggle("Held-out test cases only")
    f.idle(1.2)
    f.snap("A11c", "test-only switch off (should match A11)")
    f.open_select("Case (")
    f.snap("A12u", "picker open on every case, held-out test cases first", clean=False)
    f.select_all()
    _type_steps(f, ["ps", "ma_0", "1"], ["A12a", "A12b", "A12c"], "filtering the case picker")
    f.escape()


def shots_typing3(f):
    """Critic C1: the threshold and the smallest lesion typed (F02 -> F03 -> F04), and the
    probability-map box before and after its tick (F05). The custom run's folder is moved aside
    first, so these settings have no saved run (as when F03-F05 were filmed)."""
    f.fresh(N)
    if not f.has_saved():
        raise SystemExit("N's protocol run must be in place")
    f.open_expander("Model settings")
    f.js("__pag.widget('stNumberInput', 'Probability threshold').scrollIntoView({block: 'center'})")
    f.snap("F02c", "settings scrolled to the decision rule (should match F02)")
    f.js("(() => { const i = __pag.widget('stNumberInput', 'Probability threshold').querySelector('input'); i.focus(); i.select(); })()")
    _type_steps(f, ["0", ".", "3"], ["F02t1", "F02t2", "F02t3"], "typing the probability threshold")
    f.enter()
    f.idle(1.2)
    f.snap("F03c", "threshold 0.30 (should match F03)")
    f.js("(() => { const i = __pag.widget('stNumberInput', 'Smallest lesion').querySelector('input'); i.focus(); i.select(); })()")
    _type_steps(f, ["5"], ["F03t1"], "typing the smallest lesion")
    f.enter()
    f.idle(1.2)
    f.snap("F04c", "smallest lesion 5 (should match F04)")
    f.js("__pag.label('Save the probability map').scrollIntoView({block: 'center'})")
    f.snap("F05pre", "scrolled to Output, Save the probability map not yet ticked")
    xy = f.click_label("Save the probability map")
    f.idle(1.0)
    e = f.snap("F05c", "Save the probability map ticked (should match F05)")
    e["click"] = {"at": xy}
    f.save()
    if f.has_saved():
        raise SystemExit("these settings found a saved run: the custom folder was not aside")


def shots_run(f):
    """Chapter 4: Run model on N, filmed live (the one heavy job; nothing else runs)."""
    f.fresh(N)
    f.snap("C00", "N before its run")
    frames, took = f.run_and_film("C", every=2.4)
    f.idle(2.0, timeout=900)
    f.snap("C90", f"the run finished (wall clock {took:.0f} s): result over the scan")
    f.m.setdefault("runs", {})["protocol"] = {"case": N, "wall_s": round(took, 1), "frames": [x["id"] for x in frames]}
    f.save()


def lesion_picks(truth):
    """The largest lesion of each status in the protocol run's lesion list (the app's own rows,
    recomputed in WSL by truth_wsl.py; largest first, as the app sorts them)."""
    rows = truth["runs"]["protocol"]["lesions"]
    picks = {}
    for i, r in enumerate(rows):
        if r["status"] not in picks:
            picks[r["status"]] = (i, r)
    return picks


def shots_post(f):
    """Chapters 1, 5, 6: N's saved protocol result (no run). Needs truth.json (truth_wsl.py)."""
    truth = json.loads((DATA / "truth.json").read_text(encoding="utf-8"))
    f.fresh(N)
    if not f.has_saved():
        raise SystemExit("N has no saved result yet: run shots_run first")
    d00 = f.snap("D00", "N's result: slices, coronal, CT, prediction vs ground truth (opening slice)")
    # 5 · one slice through the largest found, missed and false-alarm lesion (coronal centre)
    for k, status in enumerate(("found", "missed", "false alarm"), 1):
        pick = lesion_picks(truth).get(status)
        if not pick:
            print(f"  no {status} lesion on N: beat skipped")
            continue
        i, r = pick
        f.set_slice(r["centre"][1])
        e = f.snap(f"D0{k}", f"coronal slice {r['centre'][1]}: lesion list row {i + 1}, the largest {status} lesion")
        e["lesion"] = {"row": i, **r}
        f.save()
        img = e["img"]
        f.hi(f"D0{k}h", img[:4], base=f"D0{k}", note=f"the slice image of D0{k} at device scale 4")
    f.set_slice(d00["state"]["slice_label"] and int(d00["state"]["slice_label"].split()[1]) or 0)
    f.open_expander("Settings used")
    f.js("__pag.summary('Settings used').scrollIntoView({block: 'start'})")
    f.snap("D04", "Settings used open")
    f.close_expander("Settings used")
    f.scroll_main(0)
    f.idle(0.8)
    # 1 · the rotating MIP with the comparison colours, 72 frames per turn
    f.click_label("3D rotation (MIP)")
    f.idle(2.0, timeout=900)
    f.slider_keys("Frames per turn", 3)
    f.idle(2.0, timeout=900)
    if f.js("__pag.widget('stSlider', 'Frames per turn')?.innerText || ''").find("72") < 0:
        raise SystemExit("Frames per turn did not reach 72")
    f.mip_hold(0)
    f.snap("D10", "MIP, PET, comparison overlay, 72 frames per turn")
    f.seq("S-MIP-CMP", list(range(72)), f.mip_hold, base="D10", note="the MIP turning, comparison overlay, 72 frames")
    f.click_label("Slice scrubber")
    f.idle(1.5)
    f.snap("D11", "back on slices")
    # 6 · the lesion list: open it, pick a row far from the opening slice, the viewer jumps
    f.js("__pag.summary('Lesions:').scrollIntoView({block: 'center'})")
    f.snap("E01", "scrolled to the lesion list (closed)")
    f.open_expander("Lesions:")
    f.snap("E02a", "lesion list opened in place (same scroll as E01)")
    f.js("__pag.q('[data-testid=\"stDataFrame\"]').scrollIntoView({block: 'end'})")
    f.snap("E02", "lesion list open, scrolled to its end")
    rows = truth["runs"]["protocol"]["lesions"]
    opening = int(d00["state"]["slice_label"].split()[1]) if d00["state"]["slice_label"] else 0
    # the largest found lesion well away from the opening slice, among the rows the grid shows
    # without scrolling, so the jump is plain to see
    shown = [j for j in range(min(len(rows), 10)) if rows[j]["status"] == "found"
             and abs(rows[j]["centre"][1] - opening) >= 20]
    i = max(shown, key=lambda j: rows[j]["voxels"])
    xy, row = f.click_row(i)
    f.idle(1.5)
    e = f.snap("E03", f"row {i + 1} picked ({rows[i]['status']}, centre {rows[i]['centre']})")
    e["click"] = {"at": xy, "row_rect": row, "row": i}
    e["lesion"] = {"row": i, **rows[i]}
    f.save()
    f.scroll_main(0)
    e = f.snap("E04", "scrolled back up: the viewer on the picked lesion")
    want = rows[i]["centre"][1]
    got = e["state"]["slice_label"]
    if not got or int(got.split()[1]) != want:
        raise SystemExit(f"the viewer is on {got!r}, not the picked lesion's coronal slice {want}")
    e["lesion"] = {"row": i, **rows[i]}
    f.save()


def shots_custom(f):
    """Chapter 7: Model settings, a custom run with the probability map, saved runs, reset."""
    f.fresh(N)
    f.open_expander("Model settings")
    f.snap("F01", "Model settings open (protocol)")
    f.js("__pag.widget('stNumberInput', 'Probability threshold').scrollIntoView({block: 'center'})")
    f.snap("F02", "settings scrolled: the decision rule")
    f.set_number("Probability threshold", "0.30")
    f.idle(1.2)
    f.snap("F03", "threshold 0.30")
    f.set_number("Smallest lesion", 5)
    f.idle(1.2)
    f.snap("F04", "smallest lesion 5 voxels: custom")
    f.js("__pag.label('Save the probability map').scrollIntoView({block: 'center'})")
    f.click_label("Save the probability map")
    f.idle(1.2)
    f.snap("F05", "Save the probability map ticked")
    frames, took = f.run_and_film("FR", every=3.0)
    f.idle(2.0, timeout=900)
    f.snap("F90", f"custom run finished (wall clock {took:.0f} s)")
    f.m.setdefault("runs", {})["custom"] = {"case": N, "wall_s": round(took, 1), "frames": [x["id"] for x in frames]}
    f.save()
    f.open_select("Saved runs for this scan")
    f.snap("F91", "saved runs list open", clean=False)
    f.escape()
    f.idle()
    f.click_label("Probability")
    f.snap("F92", "Probability overlay (custom run)")
    f.click("Reset to protocol")
    f.idle(1.5)
    f.snap("F93", "Reset to protocol: the protocol run again")


def shots_custom2(f):
    """The custom settings scrolled to Output before "Save the probability map" is ticked (F05
    is after the tick), so the film can show the tick as a click. Nothing is run: these settings
    without the probability map have no saved run."""
    f.fresh(N)
    f.open_expander("Model settings")
    f.js("__pag.widget('stNumberInput', 'Probability threshold').scrollIntoView({block: 'center'})")
    f.set_number("Probability threshold", "0.30")
    f.idle(1.2)
    f.set_number("Smallest lesion", 5)
    f.idle(1.2)
    f.js("__pag.label('Save the probability map').scrollIntoView({block: 'center'})")
    e = f.snap("F05a", "custom settings, scrolled to Output, probability map not yet ticked")
    if f.has_saved():
        raise SystemExit("these settings have a saved run: not the pre-tick state")
    if e["state"]["scroll"]["sidebar"] != f.m["captures"]["F05"]["state"]["scroll"]["sidebar"]:
        print("  note: sidebar scroll differs from F05", e["state"]["scroll"], f.m["captures"]["F05"]["state"]["scroll"])


def shots_nogt(f):
    """Chapter 8: N's CT and PET as a single scan with no ground truth, run as plain inference."""
    f.fresh(N)
    f.click("Single scan")
    f.idle(1.2)
    head = "C:\\Users\\james\\Documents\\university\\cits4010\\"
    mid = "datasets\\PSMA-PET-CT-Lesions_v3\\imagesTr\\"
    ct = [head, mid, f"{N}_0000.nii.gz"]
    pet = [head, mid, f"{N}_0001.nii.gz"]
    for i, chunk in enumerate(ct):
        f.type_text("CT (NIfTI", chunk, replace=(i == 0))
        f.snap(f"G0{i + 1}", "typing the CT path", clean=False, settle=0.3)
    f.enter()
    f.idle(1.0)
    for i, chunk in enumerate(pet):
        f.type_text("PET (NIfTI", chunk, replace=(i == 0))
        f.snap(f"G0{i + 4}", "typing the PET path", clean=False, settle=0.3)
    f.enter()
    f.idle(2.0)
    f.snap("G07", "single scan loaded: Held-out test + No ground truth")
    frames, took = f.run_and_film("GR", every=3.0)
    f.idle(2.0, timeout=900)
    f.snap("G90", f"plain inference finished (wall clock {took:.0f} s)")
    f.m.setdefault("runs", {})["single"] = {"case": N, "wall_s": round(took, 1), "frames": [x["id"] for x in frames]}
    f.save()
    f.js("__pag.summary('Lesions:').scrollIntoView({block: 'start'})")
    f.snap("G91", "its lesion list (open by default)")


def shots_yours(f):
    """Chapter 9: overlay colours, opacity, outline, schemes; Inverted grey on the MIP."""
    f.fresh(N)
    f.snap("H00", "N's result before the colour changes (sidebar at the top)")
    f.open_expander("Overlay colours")
    # the panel opens at the foot of the sidebar: scroll it into view, as a user would
    f.js("__pag.summary('Overlay colours').scrollIntoView({block: 'start'})")
    f.snap("H01", "Overlay colours open, sidebar scrolled to it")
    f.click_label("Outline")
    f.snap("H02", "Outline")
    f.slider_keys("Overlay opacity", 6)
    f.snap("H03", f"overlay opacity {f.slider_value('Overlay opacity')}")
    f.open_select("Colour scheme")
    f.snap("H04", "colour scheme list open", clean=False)
    f.pick("Motion graphics, dark")
    f.snap("H05", "Motion graphics, dark")
    # 9.2: the PET in Inverted grey, with these overlay settings kept
    f.click_label("PET")
    f.snap("H06", "Image PET (Hot), the dark scheme outlined")
    f.open_select("PET colour map")
    f.snap("H07", "PET colour map list open", clean=False)
    f.pick("Inverted grey")
    f.snap("H08", "PET in Inverted grey: the reading-room look")


def shots_wrong(f):
    """Chapter 10: a weights folder with no weights; CT and PET swapped (unit checks); the foot."""
    Path(EMPTY_WEIGHTS).mkdir(parents=True, exist_ok=True)
    f.fresh(N)
    f.open_expander("Model settings")
    f.type_text("Weights (", EMPTY_WEIGHTS, enter=True)
    f.idle(1.5)
    f.snap("I01", "weights pointed at an empty folder: the error")
    f.click("Reset to protocol")
    f.idle(1.5)
    f.close_expander("Model settings")
    f.click("Single scan")
    f.idle(1.2)
    f.type_text("CT (NIfTI", f"{IMAGES_WIN}\\{N}_0001.nii.gz", enter=True)
    f.idle(0.8)
    f.type_text("PET (NIfTI", f"{IMAGES_WIN}\\{N}_0000.nii.gz", enter=True)
    f.idle(2.0)
    f.snap("I02", "CT and PET swapped: both unit warnings")
    f.click("Dataset folder")
    f.idle(1.2)
    f.pick_case(N)
    f.js("__pag.summary('Developer tools').scrollIntoView({block: 'end'})")
    f.snap("I03", "the foot of the page: Developer tools (closed)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shots")
    ap.add_argument("--port", type=int, default=8502)
    a = ap.parse_args()
    fn = globals().get(f"shots_{a.shots}")
    if fn is None:
        raise SystemExit(f"no shot list {a.shots!r}")
    f = Film(a.port)
    t0 = time.time()
    try:
        fn(f)
    finally:
        f.close()
        print(f"done in {time.time() - t0:.0f} s; manifest {MANIFEST}")


if __name__ == "__main__":
    main()
