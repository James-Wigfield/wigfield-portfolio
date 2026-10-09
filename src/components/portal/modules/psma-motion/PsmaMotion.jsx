import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StageView, { STAGE_W, STAGE_H } from './StageView';
import { loadIndex, loadCase } from './loadCase';
import { LOOKS, DEFAULT_LOOK } from './looks';
import './PsmaMotion.css';

/* ============================================================================
   PSMA MOTION — seminar motion graphics  (University)
   ----------------------------------------------------------------------------
   Real run 5 outputs on two held-out test scans, staged in five beats: the
   scan, running the model, the prediction, the ground truth, the score. Case A
   stops three times in the model beat (2a network, 2b five models, 2c threshold
   and filter); case B tells the method in one condensed beat.
   Data: wigfield-portfolio/motion-data/ (gitignored), exported by
   tools/psma-motion/export_motion_data.py and served ONLY by the dev server
   (vite.config.js `psma-motion-data`, apply: 'serve'). A production build
   contains no scan data and shows a "local only" notice instead.

   Keys: space / right = next beat, left = previous beat, R = replay,
   1 / 2 = case A / case B, F = full screen.
   ?stage=1 renders the bare stage over the whole viewport (frame capture);
   ?look=clinical selects the light draft; ?labels=1 adds normal-uptake organ
   labels at the beat 1 hold (a critic's suggestion, not in the clips).
   window.__psmaMotion is the capture hook (tools/psma-motion/capture.mjs).
   ========================================================================== */

const SLOTS = ['A', 'B'];
const BEAT_NAMES = { scan: 'The scan', model: 'Running the model', ensemble: 'Five models', threshold: 'Threshold',
  prediction: 'Prediction', truth: 'Ground truth', accuracy: 'Scoring' };
const BEAT_NUMS = { scan: '1', model: '2', ensemble: '2b', threshold: '2c', prediction: '3', truth: '4', accuracy: '5' };
// the model beat is "2a" when the case also has an ensemble stop (case A), else "2"
const beatNum = (b, beats) => (b.name === 'model' && beats.some((x) => x.name === 'ensemble') ? '2a' : BEAT_NUMS[b.name]);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function useFit(boxRef) {
  const [s, setS] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setS(Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boxRef]);
  return s;
}

export default function PsmaMotion() {
  if (!import.meta.env.DEV) return <LocalOnly />;
  return <PsmaMotionDev />;
}

function LocalOnly() {
  return (
    <div className="pt-module psm">
      <section className="pt-card psm-notice">
        <h2>PSMA motion graphics · local only</h2>
        <p>
          These clips show patient PET/CT scans from the autoPET-III and DEEP-PSMA datasets. The scan data
          stays on the PC that exported it: it is served by the development server only and is never bundled
          or deployed. Run <code>npm run dev</code> on that PC and open <code>/portal/psma-motion</code>.
        </p>
      </section>
    </div>
  );
}

function PsmaMotionDev() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const stageOnly = params.get('stage') === '1';
  const labels = params.get('labels') === '1';
  const look = LOOKS[params.get('look')] ?? LOOKS[DEFAULT_LOOK];
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const [gl, setGl] = useState(null);
  const [cases, setCases] = useState({});
  const [ids, setIds] = useState({});
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [error, setError] = useState(null);
  const [slot, setSlot] = useState('A');
  const [beat, setBeat] = useState(-1);
  const api = useRef(null);
  const frameRef = useRef(null);
  const boxRef = useRef(null);
  const scale = useFit(boxRef);
  const slotRef = useRef(slot);
  const beatRef = useRef(beat);
  useLayoutEffect(() => {
    slotRef.current = slot;
    beatRef.current = beat;
  });
  const slotWaiters = useRef([]);
  const play = useRef(null);
  // A ref, not useMemo: StrictMode may run a memo twice and keep the other promise.
  const readyRef = useRef(null);
  if (!readyRef.current) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    readyRef.current = { promise, resolve };
  }

  // ---- load both cases once the WebGL stage exists -------------------------------------
  useEffect(() => {
    if (!gl) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const index = await loadIndex();
        const bySlot = {};
        Object.entries(index.cases).forEach(([id, v]) => { if (SLOTS.includes(v.slot)) bySlot[v.slot] = id; });
        if (!bySlot.A || !bySlot.B) throw new Error('motion-data/index.json needs one case in slot A and one in slot B');
        setIds(bySlot);
        const counts = {};
        const report = () => {
          const done = Object.values(counts).reduce((a, c) => a + c[0], 0);
          const total = Object.values(counts).reduce((a, c) => a + c[1], 0);
          if (!cancelled) setProgress({ done, total });
          window.__psmaMotionStatus = { done, total };
        };
        const loaded = {};
        for (const s of SLOTS) {
          loaded[s] = await loadCase(bySlot[s], s, gl, (d, t) => { counts[s] = [d, t]; report(); });
        }
        if (cancelled) return;
        setCases(loaded);
        await document.fonts.ready;
        await nextFrame();
        readyRef.current.resolve(true);
      } catch (e) {
        console.error(e);
        window.__psmaMotionStatus = { error: String(e.message || e) };
        if (!cancelled) setError(String(e.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [gl]);

  // resolve pending slot switches after React has committed the new slot
  useEffect(() => {
    const w = slotWaiters.current;
    slotWaiters.current = [];
    nextFrame().then(() => w.forEach((r) => r()));
  }, [slot]);

  const tlOf = (s) => api.current?.timeline(s);
  const beatsOf = (s) => api.current?.beats(s) ?? [];

  // ---- playback ----------------------------------------------------------------------------
  const goBeat = useCallback((target, animate) => {
    const s = slotRef.current;
    const tl = tlOf(s);
    const beats = beatsOf(s);
    if (!tl || !beats.length) return;
    const b = Math.max(-1, Math.min(beats.length - 1, target));
    play.current?.kill();
    play.current = null;
    if (b < 0) {
      tl.pause();
      tl.seek(0);
      api.current.render();
    } else if (animate && !reduced) {
      tl.pause();
      tl.seek(beats[b].start);
      api.current.render();
      play.current = tl.tweenTo(beats[b].end, { ease: 'none', onComplete: () => { play.current = null; } });
    } else {
      tl.pause();
      tl.seek(beats[b].end);
      api.current.render();
    }
    setBeat(b);
  }, [reduced]);

  const next = useCallback(() => {
    const beats = beatsOf(slotRef.current);
    if (play.current) {
      // mid-beat: finish it (jump to its hold)
      goBeat(beatRef.current, false);
      return;
    }
    if (beatRef.current < beats.length - 1) goBeat(beatRef.current + 1, true);
  }, [goBeat]);

  const prev = useCallback(() => goBeat(beatRef.current - 1, false), [goBeat]);

  const switchSlot = useCallback((s) => {
    if (!cases[s]) return;
    play.current?.kill();
    play.current = null;
    setSlot(s);
    setBeat(-1);
    const tl = tlOf(s);
    if (tl) { tl.pause(); tl.seek(0); }
  }, [cases]);

  useEffect(() => {
    if (slot && cases[slot]) api.current?.render();
  }, [slot, cases]);

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
      else if (e.key === 'r' || e.key === 'R') { goBeat(-1, false); goBeat(0, true); }
      else if (e.key === '1') switchSlot('A');
      else if (e.key === '2') switchSlot('B');
      else if (e.key === 'f' || e.key === 'F') toggleFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goBeat, switchSlot, toggleFull]);

  // ---- capture hook ---------------------------------------------------------------------------
  useEffect(() => {
    const hook = {
      ready: readyRef.current.promise,
      cases: SLOTS,
      caseIds: ids,
      look: look.id,
      duration: (s) => api.current?.duration(s) ?? 0,
      beats: (s) => beatsOf(s),
      cues: (s) => api.current?.cues(s) ?? {},
      seek: async (s, t) => {
        if (slotRef.current !== s) {
          const waited = new Promise((r) => slotWaiters.current.push(r));
          setSlot(s);
          await waited;
        }
        play.current?.kill();
        play.current = null;
        const tl = tlOf(s);
        tl.pause();
        tl.seek(t);
        api.current.render();
        api.current.finish();
        await nextFrame();
        return true;
      },
      layout: (s) => api.current?.layout(s),
      marks: () => api.current?.marks() ?? [],
      state: (s) => api.current?.state(s),
      colours: () => api.current?.colours(),
    };
    window.__psmaMotion = hook;
    return () => { if (window.__psmaMotion === hook) delete window.__psmaMotion; };
  }, [ids, look]);

  useEffect(() => () => play.current?.kill(), []);

  const ready = Boolean(cases.A && cases.B);
  const stage = (
    <StageView ref={api} cases={cases} look={look} slot={slot} onGl={setGl} capture={stageOnly} labels={labels} />
  );

  if (stageOnly) {
    return createPortal(
      <div className="psm-stage-only" style={{ background: look.bg }} ref={boxRef}>
        <div className="psm-fit" style={{ transform: `scale(${scale || 1})` }}>{stage}</div>
      </div>,
      document.body,
    );
  }

  const beats = ready ? beatsOf(slot) : [];
  return (
    <div className="pt-module psm">
      <p className="pt-module__intro">
        Seminar motion graphics: the run 5 ensemble on two held-out test scans, from the PET/CT to the
        prediction checked against the ground truth. The masks are recomputed from the home re-run's saved
        probability maps (lesion counts identical to the run of record); every number on screen is the run of
        record's. Present from here (full screen, arrow keys) or use the exported clips.
      </p>
      <div className="psm-frame" ref={frameRef}>
        <div ref={boxRef} style={{ position: 'absolute', inset: 0 }}>
          <div className="psm-fit" style={{
            transform: `translate(${((boxRef.current?.clientWidth ?? 0) - STAGE_W * scale) / 2}px, ${((boxRef.current?.clientHeight ?? 0) - STAGE_H * scale) / 2}px) scale(${scale || 0.0001})`,
          }}>{stage}</div>
        </div>
        {!ready && !error && (
          <div className="psm-loading">
            Loading scan data {progress.done} / {progress.total}
            <div className="psm-progress"><span style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} /></div>
          </div>
        )}
        {error && <div className="psm-loading">Could not load the scan data: {error}</div>}
      </div>
      <div className="psm-bar">
        <div className="psm-bar__beats">
          {SLOTS.map((s) => (
            <button key={s} type="button" className={`psm-beat${s === slot ? ' psm-beat--on' : ''}`} onClick={() => switchSlot(s)}>
              Case {s}
            </button>
          ))}
        </div>
        <div className="psm-bar__beats">
          {beats.map((b, i) => (
            <button key={b.name} type="button" className={`psm-beat${i === beat ? ' psm-beat--on' : ''}`} onClick={() => goBeat(i, true)}>
              {beatNum(b, beats) ?? i + 1}. {BEAT_NAMES[b.name]}
            </button>
          ))}
        </div>
        <button type="button" className="hp-btn" onClick={toggleFull}>Full screen</button>
        <span className="psm-keys">
          <kbd>space</kbd>/<kbd>→</kbd> next · <kbd>←</kbd> back · <kbd>R</kbd> replay · <kbd>1</kbd>/<kbd>2</kbd> case · <kbd>F</kbd> full screen
        </span>
      </div>
    </div>
  );
}
