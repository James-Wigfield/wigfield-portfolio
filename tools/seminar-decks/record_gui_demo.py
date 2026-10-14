#!/usr/bin/env python3
"""
SEMINAR DECKS -- film the real Mamba PSMA app for the plain deck's demo slide (B1).

Drives the Streamlit app (Mamba_PSMA gui/app.py, started with
Mamba_PSMA/outputs/gui-capture-tools/gui_server.sh) in a headless Chrome through that folder's
cdp.py, and records it as it runs: frames come from a CDP screencast on a second DevTools
connection to the same page; every cursor move, click and wheel step is logged; and a small
read-only script in the page logs, every 50 ms, the screen rectangles of the case id and of any
local path (so make_gui_demo.py can blur exactly those). Nothing in the app's DOM is changed.

Raw output (gitignored, never published): motion-data/gui-demo/<take>/
    frames/NNNNN.jpg     screencast frames (only when the page repaints)
    frames.json          [{file, t}] with t in seconds (wall clock, as time.time())
    log.json             cursor moves, clicks, wheel steps, marks (run start/end and so on),
                         the blur rectangles over time, the app's result text, settings

    python -I tools/seminar-decks/record_gui_demo.py --case <id> --take <name> [--port 8501]
           [--rehearse]   allow a case that already has a saved run (no Run click; tests the rest)
           [--scheme "Motion graphics, light"] [--pet-cmap "Inverted grey"] [--first-image PET]
                          set before filming: the app's overlay colours and PET colour map, and
                          the image the take first switches to (default "PET + CT")
While filming, the run log under the status line (a code block that prints checkpoint folders,
whose names carry a development run number) is hidden by a style rule in the page; nothing else
of the app is changed.

Rules (Mamba_PSMA/outputs/gui-capture-tools/README.md): autoPET test scans only on camera; never
press "Re-run model"; one heavy WSL job at a time. A real take writes a new saved run under
Mamba_PSMA/outputs/gui-predictions/<case>/ (the app's own output).
"""
import argparse
import base64
import json
import math
import sys
import threading
import time
import urllib.request
from pathlib import Path

import websocket

sys.dont_write_bytecode = True  # cdp.py lives in Mamba_PSMA: leave no __pycache__ there
TOOLS = Path(r'C:\Users\james\Documents\university\cits4010\Mamba_PSMA\outputs\gui-capture-tools')
sys.path.insert(0, str(TOOLS))
from cdp import Browser  # noqa: E402

PORTFOLIO = Path(__file__).resolve().parents[2]
CDP_PORT = 9487

# Read-only logger: rectangles (CSS px) of every case-id or local-path text run, in the page and
# in its same-origin iframes, and of the two inputs that hold them. Logged only when they change.
LOGGER = r"""
(() => {
  if (window.__blur) return 'already';
  const PATS = [/psma_[0-9a-f]{8,}[\w-]*/g, /deeppsma_\d+/g, /\/mnt\/[^\s|'"<>]*/g, /[A-Z]:\\Users[^\s|'"<>]*/g,
    /checkpoints\/[^\s|'"<>]*/g, /\brun\d+\b/g];
  const out = [];
  let last = '';
  const textRects = (doc, ox, oy, acc) => {
    const w = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const s = n.data;
      if (!s || s.length < 6) continue;
      for (const re of PATS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(s))) {
          const r = doc.createRange();
          r.setStart(n, m.index);
          r.setEnd(n, m.index + m[0].length);
          for (const q of r.getClientRects()) {
            if (q.width > 0 && q.height > 0) acc.push([q.x + ox, q.y + oy, q.width, q.height].map((v) => Math.round(v * 10) / 10));
          }
        }
      }
    }
  };
  const tick = () => {
    const acc = [];
    try {
      textRects(document, 0, 0, acc);
      document.querySelectorAll('input').forEach((el) => {
        const v = el.value || '';
        if (/psma_|deeppsma_|\/mnt\/|:\\/.test(v)) {
          const q = el.getBoundingClientRect();
          if (q.width > 0) acc.push([q.x, q.y, q.width, q.height].map((v) => Math.round(v * 10) / 10));
        }
      });
      document.querySelectorAll('iframe').forEach((f) => {
        try {
          const d = f.contentDocument;
          if (!d || !d.body) return;
          const q = f.getBoundingClientRect();
          textRects(d, q.x, q.y, acc);
        } catch (e) { /* cross-origin: none in this app */ }
      });
    } catch (e) { /* mid-render; next tick */ }
    const key = JSON.stringify(acc);
    if (key !== last) { last = key; out.push({ t: Date.now() / 1000, rects: acc }); }
  };
  window.__blur = out;
  window.__blurTimer = setInterval(tick, 50);
  tick();
  return 'ok';
})()
"""


class Recorder:
    """CDP screencast on its own connection, in a thread."""

    def __init__(self, ws_url, out):
        self.out = out
        self.frames = []
        self.ws = websocket.create_connection(ws_url, timeout=600, suppress_origin=True)
        self.stop = threading.Event()
        self.n = 0
        self.th = threading.Thread(target=self.loop, daemon=True)

    def send(self, mid, method, **params):
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))

    def start(self, w, h):
        self.send(1, 'Page.startScreencast', format='jpeg', quality=94, maxWidth=w, maxHeight=h, everyNthFrame=1)
        self.th.start()

    def loop(self):
        mid = 100
        while not self.stop.is_set():
            try:
                msg = json.loads(self.ws.recv())
            except Exception:
                continue
            if msg.get('method') == 'Page.screencastFrame':
                p = msg['params']
                t = p['metadata'].get('timestamp') or time.time()
                name = f'{self.n:05d}.jpg'
                (self.out / name).write_bytes(base64.b64decode(p['data']))
                self.frames.append({'file': name, 't': t, 'recv': time.time()})
                self.n += 1
                mid += 1
                self.send(mid, 'Page.screencastFrameAck', sessionId=p['sessionId'])

    def finish(self):
        self.send(2, 'Page.stopScreencast')
        time.sleep(0.5)
        self.stop.set()
        self.th.join(timeout=5)
        self.ws.close()


class Film:
    def __init__(self, port, w, h, scale):
        self.b = Browser(port=CDP_PORT, width=w, height=h, scale=scale)
        self.base = f'http://localhost:{port}'
        self.log = []
        self.cur = (w * 0.62, h * 0.55)

    # ── logging helpers ──
    def mark(self, name, **kw):
        self.log.append({'kind': 'mark', 'name': name, 't': time.time(), **kw})

    def js(self, expr):
        return self.b.js(expr)

    def idle(self, timeout=300):
        self.b.wait_idle(timeout=timeout)

    # ── the cursor: real mouse events, logged for drawing afterwards ──
    def move(self, x, y, dur=0.7):
        x0, y0 = self.cur
        t0 = time.time()
        self.log.append({'kind': 'move', 't0': t0, 't1': t0 + dur, 'from': [x0, y0], 'to': [x, y]})
        steps = max(4, int(dur * 30))
        for i in range(1, steps + 1):
            u = i / steps
            e = u * u * (3 - 2 * u)  # smoothstep, as drawn
            px, py = x0 + (x - x0) * e, y0 + (y - y0) * e
            self.b.send('Input.dispatchMouseEvent', type='mouseMoved', x=px, y=py)
            target = t0 + dur * u
            time.sleep(max(0.0, target - time.time()))
        self.cur = (x, y)

    def click(self, x=None, y=None, dur=0.7, pause=0.15):
        if x is not None:
            self.move(x, y, dur)
        time.sleep(pause)
        x, y = self.cur
        self.log.append({'kind': 'click', 't': time.time(), 'at': [x, y]})
        self.b.send('Input.dispatchMouseEvent', type='mousePressed', x=x, y=y, button='left', clickCount=1)
        time.sleep(0.06)
        self.b.send('Input.dispatchMouseEvent', type='mouseReleased', x=x, y=y, button='left', clickCount=1)

    def wheel(self, n, dy=100, gap=0.12):
        x, y = self.cur
        for _ in range(abs(n)):
            self.log.append({'kind': 'wheel', 't': time.time(), 'at': [x, y], 'dy': math.copysign(dy, n)})
            self.b.send('Input.dispatchMouseEvent', type='mouseWheel', x=x, y=y, deltaX=0, deltaY=math.copysign(dy, n))
            time.sleep(gap)

    def centre(self, js_el):
        r = self.js(f"(() => {{ const el = {js_el}; if (!el) return null; const q = el.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2, q.width, q.height]; }})()")
        if not r:
            raise RuntimeError(f'no element: {js_el}')
        return r


LABEL = "[...document.querySelectorAll('label')].find(l => l.innerText.trim() === {t!r})"
BUTTON = "[...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith({t!r}))"
SUMMARY = "[...document.querySelectorAll('summary')].find(x => x.innerText.includes({t!r}))"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--case', required=True)
    ap.add_argument('--take', required=True)
    ap.add_argument('--port', type=int, default=8501)
    ap.add_argument('--width', type=int, default=1600)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--scale', type=float, default=1.2)
    ap.add_argument('--rehearse', action='store_true')
    ap.add_argument('--scheme', default=None)
    ap.add_argument('--pet-cmap', default=None)
    ap.add_argument('--first-image', default='PET + CT')
    a = ap.parse_args()
    if not a.case.startswith('psma_'):
        sys.exit('autoPET test scans only on camera')
    out = PORTFOLIO / 'motion-data' / 'gui-demo' / a.take
    (out / 'frames').mkdir(parents=True, exist_ok=True)

    f = Film(a.port, a.width, a.height, a.scale)
    b = f.b
    rec = None
    try:
        b.goto(f.base)
        b.wait("document.body.innerText.includes('Mamba PSMA')", timeout=120)
        time.sleep(1)
        f.idle()
        if not b.js(f"{LABEL.format(t='Held-out test cases only')} && document.body.innerText.includes('Held-out test cases only')"):
            sys.exit('no held-out toggle')
        b.select_option('Case (', a.case)
        time.sleep(1)
        f.idle()
        time.sleep(2)
        saved = b.js(f"!!{BUTTON.format(t='Re-run model')}")
        if saved and not a.rehearse:
            sys.exit(f'{a.case} already has a saved run; never re-run a saved result')
        if not saved and a.rehearse:
            sys.exit('rehearse needs a case with a saved run (no Run click)')
        if not b.js("document.body.innerText.includes('HELD-OUT TEST')"):
            sys.exit('the case is not marked held-out test')
        # the look, set before filming
        if a.scheme:
            b.js(f"{SUMMARY.format(t='Overlay colours')}.click()")
            time.sleep(0.8)
            f.idle()
            b.select_option('Colour scheme', a.scheme)
            time.sleep(0.8)
            f.idle()
            b.js(f"{SUMMARY.format(t='Overlay colours')}.click()")
            time.sleep(0.8)
            f.idle()
        if a.pet_cmap:
            b.select_option('PET colour map', a.pet_cmap)
            time.sleep(0.8)
            f.idle()
        b.js("document.querySelectorAll('[data-testid=\"stSidebar\"] *').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })")
        time.sleep(0.5)
        print('look:', b.js("[...document.querySelectorAll('[data-testid=\"stSelectbox\"]')].map(s => s.innerText.replace(/\\n/g, ' ')).join(' | ')"))
        # the run log (checkpoint folder names carry a development run number): hidden while filming
        b.js("(() => { const s = document.createElement('style'); s.textContent = '[data-testid=\"stExpanderDetails\"] [data-testid=\"stCode\"], [data-testid=\"stStatusWidget\"] ~ * [data-testid=\"stCode\"] { display: none !important; }'; document.head.appendChild(s); })()")
        # the real mouse rests where the drawn cursor starts; the page settles first
        b.send('Input.dispatchMouseEvent', type='mouseMoved', x=f.cur[0], y=f.cur[1])
        b.js("document.activeElement && document.activeElement.blur()")
        time.sleep(1.5)
        print('logger:', b.js(LOGGER))

        tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{CDP_PORT}/json').read())
        page = [t for t in tabs if t.get('type') == 'page'][0]
        rec = Recorder(page['webSocketDebuggerUrl'], out / 'frames')
        rec.start(round(a.width * a.scale), round(a.height * a.scale))
        time.sleep(0.3)
        b.js("window.scrollBy(0, 0); document.body.style.outline = '0px solid transparent'")  # one repaint
        f.mark('start')
        time.sleep(2.2)

        # 1. the scan as PET + CT (or the image asked for), then a few slices either way
        f.click(*f.centre(LABEL.format(t=a.first_image))[:2], dur=0.9)
        time.sleep(0.4)
        f.idle()
        time.sleep(1.2)
        vx, vy, vw, vh = f.centre("document.querySelector('[data-testid=\"stIFrame\"]')")
        f.move(vx, vy - vh * 0.05, 0.8)
        time.sleep(0.3)
        f.wheel(-14, gap=0.09)
        time.sleep(0.4)
        f.wheel(14, gap=0.09)
        time.sleep(0.8)

        # 2. the run (or, rehearsing, the saved result)
        if not a.rehearse:
            f.click(*f.centre(BUTTON.format(t='Run model'))[:2], dur=1.0)
            f.mark('run_click')
            b.wait("document.body.innerText.includes('Running the model:')", timeout=90)
            b.wait("document.body.innerText.includes('Finished in') || document.body.innerText.includes('predict.py failed')", timeout=900)
            if b.js("document.body.innerText.includes('predict.py failed')"):
                raise RuntimeError('the run failed')
            f.idle(timeout=600)
            f.mark('run_done')
            time.sleep(0.6)
        else:
            f.mark('run_click')
            time.sleep(1.0)
            f.mark('run_done')
        result = b.js("""(() => { const c = [...document.querySelectorAll('[data-testid="stColumn"]')].find(c => c.innerText.includes('Result')); return c ? c.innerText : ''; })()""")
        print('RESULT:', (result or '')[:600].replace('\n', ' | '))
        # the result card: let the eye land on it
        rx, ry = f.centre(f"[...document.querySelectorAll('[data-testid=\"stColumn\"]')].find(c => c.innerText.includes('Result'))")[:2]
        f.move(rx, ry, 1.0)
        time.sleep(2.6)

        # 3. the result on a few slices
        f.move(vx, vy, 0.9)
        time.sleep(0.3)
        f.wheel(-10, gap=0.11)
        time.sleep(0.6)
        f.wheel(10, gap=0.11)
        time.sleep(0.8)

        # 4. the 3D view of the PET with the result, one turn
        if a.first_image != 'PET':
            f.click(*f.centre(LABEL.format(t='PET'))[:2], dur=0.9)
            time.sleep(0.3)
            f.idle()
            time.sleep(0.6)
        f.click(*f.centre(LABEL.format(t='3D rotation (MIP)'))[:2], dur=0.8)
        f.mark('mip_click')
        f.idle(timeout=300)
        b.wait("(() => { const fr = document.querySelector('[data-testid=\"stIFrame\"]'); const d = fr && fr.contentDocument; return !!(d && d.getElementById('mp_spin') && d.getElementById('mp_spin').complete); })()", timeout=300)
        f.mark('mip_ready')
        playing = b.js("(() => { const d = document.querySelector('[data-testid=\"stIFrame\"]').contentDocument; const p = d.getElementById('mp_play'); return p ? p.innerText : ''; })()")
        print('MIP play button:', playing)
        if playing and playing.strip().lower().startswith('play'):
            fr = f.centre("document.querySelector('[data-testid=\"stIFrame\"]')")
            pr = b.js("(() => { const d = document.querySelector('[data-testid=\"stIFrame\"]').contentDocument; const q = d.getElementById('mp_play').getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; })()")
            f.click(fr[0] - fr[2] / 2 + pr[0], fr[1] - fr[3] / 2 + pr[1], dur=0.8)
            f.mark('mip_play')
        f.move(vx + vw * 0.36, vy + vh * 0.2, 1.2)
        time.sleep(9.5)
        f.mark('end')
        time.sleep(0.4)
    finally:
        if rec:
            rec.finish()
        blur = []
        try:
            blur = b.js('window.__blur || []') or []
        except Exception as e:  # noqa: BLE001
            print('blur log not read:', e)
        settings = {}
        try:
            settings = {'text': b.js('document.body.innerText')[:6000]}
        except Exception:
            pass
        (out / 'frames.json').write_text(json.dumps(rec.frames if rec else [], indent=0))
        (out / 'log.json').write_text(json.dumps({
            'case': a.case, 'rehearse': a.rehearse, 'viewport_css': [a.width, a.height], 'scale': a.scale,
            'events': f.log, 'blur': blur, 'page_text_end': settings.get('text', ''),
        }, indent=1))
        print('frames:', len(rec.frames) if rec else 0, '| events:', len(f.log), '| blur states:', len(blur))
        b.close()


if __name__ == '__main__':
    main()
