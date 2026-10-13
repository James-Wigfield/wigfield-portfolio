import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Stage from './Stage';
import { ImageStore, loadManifest, DATA_URL } from './assets';
import { buildScript } from './script';
import { cameraOf, cursorOf, filesOf, seqIndex } from './timeline';
import { lerpCam, toApp, toStage } from './camera';
import { STAGE_H, STAGE_W, SUBJECT } from './looks';
import { CHAPTERS } from './copy';
import { useFitScale } from '../useFitScale';
import './PsmaAppGuide.css';

/* ============================================================================
   PSMA APP GUIDE — "How to use the app" walkthrough  (University)
   ----------------------------------------------------------------------------
   A motion-graphics walkthrough of the Mamba PSMA Streamlit app (Mamba_PSMA
   gui/app.py), exported as gui/assets/how-to-use.mp4, the video its "How to
   use this app" button plays. The app on screen is always the real app:
   captures of the running program at commit 9ad3754 (autoPET-III scans only),
   taken by tools/psma-app-guide/capture_app.py. The motion layer around and
   over them is drawn here: camera moves, crossfades between captured states, a
   drawn cursor, highlight rings, spotlight dimming, callouts, captions, chapter
   cards and the chapter strip. The model run is shown sped up, with its real
   duration on screen.

   Data: wigfield-portfolio/motion-data/app-guide/ (gitignored), served ONLY by
   the dev server (vite.config.js `psma-motion-data`, apply: 'serve'). A
   production build contains no capture and shows a "local only" notice.

   Keys: space / right = next chapter, left = previous chapter, R = replay,
   F = full screen. ?stage=1 renders the bare stage over the whole viewport
   (frame capture); ?script=style renders the checkpoint's style stub.
   window.__psmaAppGuide is the capture hook (tools/psma-app-guide/capture.mjs).
   ========================================================================== */

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const CANVAS = { w: STAGE_W, h: STAGE_H };
// a promise the capture hook hands out, resolved once the first frame can be drawn
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

export default function PsmaAppGuide() {
  if (!import.meta.env.DEV) return <LocalOnly />;
  return <PsmaAppGuideDev />;
}

function LocalOnly() {
  return (
    <div className="pt-module pag">
      <section className="pt-card pag-notice">
        <h2>PSMA app guide · local only</h2>
        <p>
          This walkthrough is built from captures of the Mamba PSMA app showing patient PET/CT scans from the
          autoPET-III dataset. The captures stay on the PC that took them: they are served by the development server
          only and are never bundled or deployed. Run <code>npm run dev</code> on that PC and open
          {' '}<code>/portal/psma-app-guide</code>. The exported video lives in the Mamba_PSMA repo as
          {' '}<code>gui/assets/how-to-use.mp4</code>.
        </p>
      </section>
    </div>
  );
}

function PsmaAppGuideDev() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const stageOnly = params.get('stage') === '1';
  const which = params.get('script') === 'style' ? 'style' : 'full';
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const [manifest, setManifest] = useState(null);
  const [B, setB] = useState(null);
  const [error, setError] = useState(null);
  const [chapter, setChapter] = useState(-1);
  const [playing, setPlaying] = useState(false);
  // state initialisers, not render-time refs: one store and one ready promise per mount
  const [store] = useState(() => new ImageStore());
  const [ready] = useState(deferred);
  const stage = useRef(null);
  const frameRef = useRef(null);
  const { ref: fitRef, s: fitS, left: fitLeft, top: fitTop } = useFitScale(CANVAS);
  const play = useRef(null);
  const chapterRef = useRef(chapter);
  useLayoutEffect(() => { chapterRef.current = chapter; });
  const dpr = stageOnly ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  // ---- load the manifest, build the timeline, decode the first frame's captures ------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await loadManifest();
        const built = buildScript(m, which);
        if (cancelled) return;
        setManifest(m);
        setB(built);
        built.tl.seek(0);
        await store.need(filesOf(built, built.S));
        // the title card's logo is cropped from the welcome-page capture (a CSS background)
        await new Promise((res, rej) => { const im = new Image(); im.onload = res; im.onerror = rej; im.src = `${DATA_URL}/captures/A01.png`; });
        await document.fonts.load("600 120px 'Fraunces'");
        await document.fonts.load("500 48px 'Hanken Grotesk'");
        await document.fonts.load("600 40px 'Hanken Grotesk'");
        await document.fonts.load("500 36px 'IBM Plex Mono'");
        await document.fonts.ready;
        if (cancelled) return;
        await nextFrame();
        stage.current?.draw(dpr);
        await nextFrame();
        ready.resolve(true);
      } catch (e) {
        console.error(e);
        window.__psmaAppGuideStatus = { error: String(e.message || e) };
        if (!cancelled) setError(String(e.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [which, dpr, store, ready]);

  useEffect(() => {
    if (!B) return undefined;
    B.tl.eventCallback('onUpdate', () => stage.current?.draw(dpr));
    stage.current?.draw(dpr);
    return () => B.tl.eventCallback('onUpdate', null);
  }, [B, dpr]);

  const chapters = useMemo(() => (B ? B.chapters : []), [B]);

  // ---- playback ---------------------------------------------------------------------------------
  const stop = useCallback(() => {
    play.current?.kill();
    play.current = null;
    setPlaying(false);
  }, []);

  const goChapter = useCallback(async (target, animate) => {
    if (!B) return;
    const i = Math.max(-1, Math.min(chapters.length - 1, target));
    stop();
    const tl = B.tl;
    tl.pause();
    if (i < 0) {
      tl.seek(0);
    } else if (animate && !reduced) {
      const c = chapters[i];
      await store.need(B.filesBetween(c.start, c.start + 3));
      B.filesBetween(c.start, c.end).forEach((f) => store.load(f).catch(() => {}));
      tl.seek(c.start);
      play.current = tl.tweenTo(c.end, { ease: 'none', onComplete: () => { play.current = null; setPlaying(false); } });
      setPlaying(true);
    } else {
      // reduced motion (or a jump): the chapter's final frame
      tl.seek(Math.max(chapters[i].start, chapters[i].end - 0.02));
      await store.need(filesOf(B, B.S));
    }
    stage.current?.draw(dpr);
    setChapter(i);
  }, [B, chapters, reduced, stop, dpr, store]);

  const next = useCallback(() => {
    if (play.current) { goChapter(chapterRef.current, false); return; }
    if (chapterRef.current < chapters.length - 1) goChapter(chapterRef.current + 1, true);
  }, [chapters, goChapter]);
  const prev = useCallback(() => goChapter(chapterRef.current - 1, false), [goChapter]);

  const toggleFull = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'r' || e.key === 'R') { goChapter(0, true); }
      else if (e.key === 'f' || e.key === 'F') toggleFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goChapter, toggleFull]);

  useEffect(() => () => play.current?.kill(), []);

  // ---- capture hook ---------------------------------------------------------------------------------
  useEffect(() => {
    if (!B) return undefined;
    // seek without the onUpdate draw (the hook draws once, after the frame's images are decoded)
    const quietSeek = (t) => {
      const cb = B.tl.eventCallback('onUpdate');
      B.tl.eventCallback('onUpdate', null);
      B.tl.seek(t);
      B.tl.eventCallback('onUpdate', cb);
    };
    const hook = {
      ready: ready.promise,
      script: which,
      duration: B.duration,
      chapters: B.chapters.map((c) => ({ id: c.id, num: c.num, name: c.name, start: c.start, end: c.end })),
      seek: async (t) => {
        play.current?.kill();
        play.current = null;
        B.tl.pause();
        quietSeek(t);
        await store.need(filesOf(B, B.S));
        stage.current?.draw(dpr);
        await nextFrame();
        return true;
      },
      // A motion-blur sample at ts whose captured content (which capture shows, the frame of a
      // sequence, a list's reveal) is held as it is at tf, the output frame's own time: the
      // camera, curtain and cursor still blur across a cut or a sequence step, and two app states
      // are never blended into one frame (C2).
      seekFrozen: async (ts, tf) => {
        play.current?.kill();
        play.current = null;
        B.tl.pause();
        quietSeek(tf);
        const frozen = {};
        Object.keys(B.S).forEach((k) => { if (/^(L|F|RV)\d+$/.test(k)) frozen[k] = B.S[k]; });
        quietSeek(ts);
        const saved = {};
        Object.keys(frozen).forEach((k) => { saved[k] = B.S[k]; B.S[k] = frozen[k]; });
        await store.need(filesOf(B, B.S));
        stage.current?.draw(dpr);
        await nextFrame();
        Object.assign(B.S, saved);
        return true;
      },
      // How far anything moves on the stage between two times (stage px), for motion blur; and
      // whether a cut or a step of a captured frame sequence falls between them (never blended).
      motion: (a, b) => {
        const keep = B.tl.time();
        const at = (tt) => { quietSeek(tt); return { S: { ...B.S }, cam: cameraOf(B, B.S, lerpCam), cur: cursorOf(B, B.S) }; };
        const A = at(a);
        const Z = at(b);
        quietSeek(keep);
        let move = 0;
        [[SUBJECT.x, SUBJECT.y], [SUBJECT.x + SUBJECT.w, SUBJECT.y], [SUBJECT.x, SUBJECT.y + SUBJECT.h],
          [SUBJECT.x + SUBJECT.w, SUBJECT.y + SUBJECT.h]].forEach(([sx, sy]) => {
          const p = toApp(A.cam, sx, sy);
          const q = toStage(Z.cam, p[0], p[1]);
          move = Math.max(move, Math.hypot(q[0] - sx, q[1] - sy));
        });
        if (A.cur && Z.cur && Math.max(A.S.curA ?? 0, Z.S.curA ?? 0) > 0.01) {
          const p = toStage(A.cam, A.cur[0], A.cur[1]);
          const q = toStage(Z.cam, Z.cur[0], Z.cur[1]);
          move = Math.max(move, Math.hypot(q[0] - p[0], q[1] - p[1]));
        }
        B.cards.forEach((c) => {
          move = Math.max(move, Math.abs((Z.S[`cdC${c.k}`] ?? 0) - (A.S[`cdC${c.k}`] ?? 0)) * (STAGE_W + 720));
        });
        let cut = false;
        B.layers.forEach((L) => {
          if (L.scrollFrom) {
            move = Math.max(move, Math.abs((Z.S[`SC${L.i}`] ?? 0) - (A.S[`SC${L.i}`] ?? 0)) * Math.abs(L.scrollFrom.dy) * Z.cam.z);
          }
          if (Math.abs((Z.S[`L${L.i}`] ?? 0) - (A.S[`L${L.i}`] ?? 0)) > 0.5) cut = true;
          if (L.kind === 'seq' && (A.S[`L${L.i}`] ?? 0) > 0 && (Z.S[`L${L.i}`] ?? 0) > 0 && seqIndex(L, A.S) !== seqIndex(L, Z.S)) cut = true;
        });
        return { move, cut };
      },
      // every visible piece of stage text, in stage px (gates G4 and G5)
      textBoxes: () => {
        const root = document.querySelector('.pag-stage');
        if (!root) return [];
        const rs = root.getBoundingClientRect();
        const k = rs.width / STAGE_W;
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const tn = walker.currentNode;
          const text = tn.textContent.trim();
          if (!text) continue;
          const el = tn.parentElement;
          let o = 1;
          let shown = true;
          for (let n = el; n && n !== root; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.visibility === 'hidden' || cs.display === 'none') { shown = false; break; }
            o *= Number(cs.opacity);
          }
          if (!shown || o < 0.05) continue;
          const range = document.createRange();
          range.selectNodeContents(tn);
          const r = range.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const cs = getComputedStyle(el);
          out.push({ cls: String(el.className || el.parentElement?.className || ''), text, opacity: Number(o.toFixed(3)),
            x: (r.x - rs.x) / k, y: (r.y - rs.y) / k, w: r.width / k, h: r.height / k,
            fontPx: parseFloat(cs.fontSize), color: cs.color });
        }
        return out;
      },
      // for the gates: what the frame shows and why
      state: () => Object.fromEntries(Object.entries(B.S).filter(([k]) => !k.startsWith('_'))),
      files: () => filesOf(B, B.S),
      camera: () => stage.current?.camera(),
      cursor: () => stage.current?.cursor(),
      checks: () => B.checks,
      captions: () => B.captions.map(({ k, text, at, shown, hidden, min }) => ({ k, text, at, shown, hidden, min })),
      callouts: () => B.callouts.map(({ k, text, sub, at, shown, hidden, min, point, box, off, side }) => ({ k, text, sub, at, shown, hidden, min, point, box, off, side })),
      layers: () => B.layers.map(({ i, id, kind, file, t0, t1, mode }) => ({ i, id, kind, file, t0, mode, t1: Number.isFinite(t1) ? t1 : null })),
      panels: () => B.panels.map(({ k, id, at, shown, hidden, data, words, min }) => ({ k, id, at, shown, hidden, data, words, min })),
      cards: () => B.cards.map(({ k, num, title, at, cover, uncover, end }) => ({ k, num, title, at, cover, uncover, end })),
      camMoves: () => B.camMoves.map(({ k, at, dur, from, to }) => ({ k, at, dur, from, to })),
      clicks: () => B.clicks.map(({ k, at, pos }) => ({ k, at, pos })),
    };
    window.__psmaAppGuide = hook;
    return () => { if (window.__psmaAppGuide === hook) delete window.__psmaAppGuide; };
  }, [B, which, dpr, store, ready]);

  const stageEl = <Stage ref={stage} B={B} store={store} manifest={manifest} />;

  if (stageOnly) {
    return createPortal(
      <div className="pag-stage-only" ref={fitRef}>
        <div className="pag-fit" style={{ transform: `scale(${fitS || 1})` }}>{stageEl}</div>
      </div>,
      document.body,
    );
  }

  const loaded = Boolean(B);
  return (
    <div className="pt-module pag">
      <p className="pt-module__intro">
        The &ldquo;How to use this app&rdquo; walkthrough for the Mamba PSMA app, built from real captures of the running
        app on autoPET-III held-out test scans, with the motion layer drawn over them. It is exported as the MP4 the
        app&rsquo;s help button plays. The model run is shown sped up, with its real duration on screen.
      </p>
      <div className="pag-frame" ref={frameRef}>
        <div ref={fitRef} style={{ position: 'absolute', inset: 0 }}>
          <div className="pag-fit" style={{ transform: `translate(${fitLeft}px, ${fitTop}px) scale(${fitS || 0.0001})` }}>
            {stageEl}
          </div>
        </div>
        {!loaded && !error && <div className="pag-loading">Loading the captures…</div>}
        {error && <div className="pag-loading">Could not load the captures: {error}</div>}
      </div>
      <div className="pag-bar">
        <div className="pag-bar__chapters">
          {chapters.map((c, i) => (
            <button key={c.id} type="button" className={`pag-chip${i === chapter ? ' pag-chip--on' : ''}`} onClick={() => goChapter(i, true)}>
              {CHAPTERS[c.id] ? `${CHAPTERS[c.id].num}. ${CHAPTERS[c.id].name}` : c.name}
            </button>
          ))}
        </div>
        <button type="button" className="hp-btn" onClick={() => (playing ? stop() : goChapter(Math.max(0, chapter), true))}>
          {playing ? 'Pause' : 'Play chapter'}
        </button>
        <button type="button" className="hp-btn" onClick={toggleFull}>Full screen</button>
        <span className="pag-keys">
          <kbd>space</kbd>/<kbd>→</kbd> next · <kbd>←</kbd> back · <kbd>R</kbd> replay · <kbd>F</kbd> full screen
        </span>
      </div>
    </div>
  );
}
