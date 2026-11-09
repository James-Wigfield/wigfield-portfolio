import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './cs.css';
import { gsap, reduced } from './engine/motion';
import { Fit, SlideStill } from './engine/Fit';
import { useDeck, useIdle, usePage } from './engine/useDeck';
import { CHAPTERS, SLIDES, TITLE } from './slides/registry';
import { NOTES } from './notes';


/* ============================================================================
   /courtney-slides — "Building Stronger Bones", Courtney Steyn's GER360 talk
   as a motion-graphics web deck. Public, unlisted (noindex).

   Views (?view=):
     (none)     audience: the full-screen deck
     presenter  current slide, next build, notes per click, timer (syncs with
                the audience window over BroadcastChannel)
     print      every slide at its finished state, one per page (Ctrl+P)

   Keys: → / Space / Enter / PgDn next · ← / PgUp / Backspace back ·
         Home / End · F full screen · N notes · G grid · P presenter · B black
   ========================================================================== */

const metaFor = (i) => ({ n: i + 1, total: SLIDES.length, chapter: CHAPTERS[SLIDES[i].chapter] });

function SlideLive({ slide, i, beat, live }) {
  const Comp = slide.Comp;
  return (
    <>
      <div className="cs-ground" />
      <div className="cs-slide">
        <Comp ctx={{ beat, live }} meta={metaFor(i)} />
      </div>
    </>
  );
}

/** The canvas contents: the current slide, the one leaving, the wipe, the progress hairline. */
function Show({ pos, live = true, progress = true }) {
  const [shown, setShown] = useState({ i: pos.i, b: pos.b });
  const [from, setFrom] = useState(null);
  if (pos.i !== shown.i) {
    setFrom({ i: shown.i, b: shown.b, dir: pos.i > shown.i ? 1 : -1, n: (from?.n ?? 0) + 1 });
    setShown({ i: pos.i, b: pos.b });
  } else if (pos.b !== shown.b) {
    setShown({ i: pos.i, b: pos.b });
  }

  const inRef = useRef(null);
  const outRef = useRef(null);
  const wipeRef = useRef(null);

  useLayoutEffect(() => {
    if (!from) return undefined;
    const inn = inRef.current;
    const out = outRef.current;
    const wipe = wipeRef.current;
    gsap.set(out, { clearProps: 'clipPath' });
    const tl = gsap.timeline({ onComplete: () => setFrom(null) });
    if (reduced()) {
      tl.fromTo(inn, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 });
    } else {
      const fwd = from.dir > 0;
      const D = 0.95;
      tl.fromTo(inn, { clipPath: fwd ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D, ease: 'expo.inOut' }, 0);
      tl.fromTo(out, { x: 0, autoAlpha: 1 }, { x: fwd ? -220 : 220, autoAlpha: 0.55, duration: D, ease: 'expo.inOut' }, 0);
      tl.fromTo(wipe, { x: fwd ? 1920 : -8, autoAlpha: 1 }, { x: fwd ? -8 : 1920, duration: D, ease: 'expo.inOut' }, 0);
      tl.set(wipe, { autoAlpha: 0 });
    }
    return () => {
      tl.kill();
      gsap.set(inn, { clearProps: 'clipPath,opacity,visibility' });
      gsap.set(wipe, { autoAlpha: 0 });
    };
  }, [from]);

  const frac = SLIDES.length > 1 ? pos.i / (SLIDES.length - 1) : 1;
  return (
    <>
      {from && (
        <div className="cs-slot" ref={outRef} key={`s${from.i}`}>
          <SlideLive slide={SLIDES[from.i]} i={from.i} beat={from.b} live={false} />
        </div>
      )}
      <div className="cs-slot" ref={inRef} key={`s${shown.i}`}>
        <SlideLive slide={SLIDES[shown.i]} i={shown.i} beat={pos.b} live={live} />
      </div>
      <div className="cs-wipe" ref={wipeRef}><i /><i /></div>
      {progress && (
        <div className="cs-progress" aria-hidden="true">
          <div className="cs-progress__fill" style={{ transform: `scaleX(${Math.max(0.004, frac)})` }} />
        </div>
      )}
    </>
  );
}

const Icon = {
  prev: <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>,
  next: <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>,
  full: <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>,
  grid: <svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>,
  notes: <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" /></svg>,
  presenter: <svg viewBox="0 0 24 24"><path d="M3 5h18v11H3zM8 20h8M12 16v4" /></svg>,
};

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function openPresenter() {
  const url = `${window.location.pathname}?view=presenter${window.location.hash}`;
  window.open(url, 'cs-presenter', 'width=1400,height=860');
}

/** Keyboard + digits-then-Enter jumps. Ignores keys while typing in a field. */
function useKeys({ next, prev, go, extra }) {
  const typed = useRef('');
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (/^\d$/.test(k)) {
        typed.current = (typed.current + k).slice(-2);
        return;
      }
      if (k === 'Enter' && typed.current) {
        go(Number(typed.current) - 1, 0);
        typed.current = '';
        e.preventDefault();
        return;
      }
      typed.current = '';
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
        e.preventDefault();
        next();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
        e.preventDefault();
        prev();
      } else if (k === 'Home') {
        go(0, 0);
      } else if (k === 'End') {
        go(SLIDES.length - 1, SLIDES[SLIDES.length - 1].beats - 1);
      } else if (extra[k.toLowerCase()]) {
        extra[k.toLowerCase()]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go, extra]);
}

function Notes({ pos }) {
  const slide = SLIDES[pos.i];
  const beats = NOTES[slide.id] ?? [];
  return (
    <div className="cs-notes" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <h4>Notes · slide {pos.i + 1}{slide.beats > 1 ? ` · click ${pos.b + 1} of ${slide.beats}` : ''}</h4>
      {beats.map((paras, b) => paras.map((p, j) => (
        <p key={`${b}-${j}`} className={b === pos.b ? 'is-now' : ''}>{p}</p>
      )))}
    </div>
  );
}

function Grid({ pos, go, close }) {
  return (
    <div className="cs-grid" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      {SLIDES.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`cs-grid__item${i === pos.i ? ' is-current' : ''}`}
          onClick={() => {
            go(i, 0);
            close();
          }}
        >
          <Fit className="cs-thumb">
            <SlideStill slide={s} meta={metaFor(i)} />
          </Fit>
          <span>{String(i + 1).padStart(2, '0')} · {s.title}</span>
        </button>
      ))}
    </div>
  );
}

function Audience() {
  const { pos, go, next, prev } = useDeck(SLIDES);
  const [notes, setNotes] = useState(false);
  const [grid, setGrid] = useState(false);
  const [black, setBlack] = useState(false);
  const [hinted, setHinted] = useState(false);
  const idle = useIdle();
  const down = useRef(null);

  const nextH = useCallback(() => { setHinted(true); setBlack(false); next(); }, [next]);
  const prevH = useCallback(() => { setBlack(false); prev(); }, [prev]);
  const extra = useMemo(() => {
    const grid = () => setGrid((v) => !v);
    const black = () => setBlack((v) => !v);
    return {
      f: toggleFullscreen,
      n: () => setNotes((v) => !v),
      g: grid,
      o: grid,
      escape: () => setGrid(false),
      p: openPresenter,
      b: black,
      '.': black,
    };
  }, []);
  useKeys({ next: nextH, prev: prevH, go, extra });

  const onDown = (e) => {
    down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onUp = (e) => {
    const d = down.current;
    down.current = null;
    if (!d || grid) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      if (dx < 0) nextH();
      else prevH();
      return;
    }
    if (e.clientX < window.innerWidth * 0.28) prevH();
    else nextH();
  };

  return (
    <div className={`cs cs-root${idle && !grid && !notes ? ' is-idle' : ''}`}>
      <Fit onPointerDown={onDown} onPointerUp={onUp}>
        <Show pos={pos} />
        {black && <div style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 60 }} />}
      </Fit>
      {notes && <Notes pos={pos} />}
      {grid && <Grid pos={pos} go={go} close={() => setGrid(false)} />}
      <p className="cs-rotate">Turn your phone sideways for a bigger view · tap right to advance</p>
      <div className={`cs-hint${hinted ? ' is-gone' : ''}`}>→ or click to advance · F full screen · P presenter view · G all slides</div>
      <div className="cs-ui" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button type="button" onClick={prevH} aria-label="Previous">{Icon.prev}</button>
        <span className="cs-ui__count">{String(pos.i + 1).padStart(2, '0')} / {SLIDES.length}</span>
        <button type="button" onClick={nextH} aria-label="Next">{Icon.next}</button>
        <span className="cs-ui__sep cs-ui__opt" />
        <button type="button" className="cs-ui__opt" onClick={() => setGrid((v) => !v)} aria-label="All slides (G)" title="All slides (G)">{Icon.grid}</button>
        <button type="button" className="cs-ui__opt" onClick={() => setNotes((v) => !v)} aria-label="Notes (N)" title="Notes (N)">{Icon.notes}</button>
        <button type="button" className="cs-ui__opt" onClick={openPresenter} aria-label="Presenter view (P)" title="Presenter view (P)">{Icon.presenter}</button>
        <button type="button" onClick={toggleFullscreen} aria-label="Full screen (F)" title="Full screen (F)">{Icon.full}</button>
      </div>
    </div>
  );
}

const two = (n) => String(n).padStart(2, '0');
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(s / 60))}:${two(s % 60)}`;
};

function Presenter() {
  const { pos, go, next, prev } = useDeck(SLIDES, { writeHash: false });
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const extra = useMemo(() => ({ f: toggleFullscreen }), []);
  useKeys({ next, prev, go, extra });

  const slide = SLIDES[pos.i];
  const nextPos = pos.b < slide.beats - 1 ? { i: pos.i, b: pos.b + 1 } : pos.i < SLIDES.length - 1 ? { i: pos.i + 1, b: 0 } : null;
  const beats = NOTES[slide.id] ?? [];
  const nowRef = useRef(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pos]);

  return (
    <div className="cs cs-pv">
      <div className="cs-pv__bar">
        <b>{two(pos.i + 1)} / {SLIDES.length}</b>
        <span>{slide.beats > 1 ? `click ${pos.b + 1} of ${slide.beats}` : 'single build'}</span>
        <span className="grow" />
        <b title="Elapsed">{t0 ? clock(now - t0) : '00:00'}</b>
        <button type="button" onClick={() => setT0(Date.now())}>{t0 ? 'Restart timer' : 'Start timer'}</button>
        <span>{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <button type="button" onClick={prev}>◀ Back</button>
        <button type="button" onClick={() => { if (!t0) setT0(Date.now()); next(); }}>Next ▶</button>
      </div>
      <div className="cs-pv__main">
        <span className="cs-pv__label">Now showing · {slide.title}</span>
        <div className="cs-pv__screen">
          <Fit>
            <Show pos={pos} />
          </Fit>
        </div>
      </div>
      <div className="cs-pv__side">
        <span className="cs-pv__label">{nextPos ? (nextPos.i === pos.i ? 'Next click' : `Next slide · ${SLIDES[nextPos.i].title}`) : 'End of deck'}</span>
        <div className="cs-pv__next">
          {nextPos && (
            <Fit>
              <SlideStill slide={SLIDES[nextPos.i]} beat={nextPos.b} meta={metaFor(nextPos.i)} />
            </Fit>
          )}
        </div>
        <div className="cs-pv__notes">
          {beats.map((paras, b) => (
            <div key={b}>
              {slide.beats > 1 && <span className="cue">Click {b + 1}</span>}
              {paras.map((p, j) => (
                <p key={j} ref={b === pos.b && j === 0 ? nowRef : null} className={b === pos.b ? 'is-now' : b < pos.b ? 'is-done' : ''}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Print() {
  useEffect(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);
  return (
    <div className="cs cs-print">
      {SLIDES.map((s, i) => (
        <div className="cs-print__page" key={s.id}>
          <div className="cs-canvas" style={{ boxShadow: 'none' }}>
            <SlideStill slide={s} meta={metaFor(i)} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CourtneySlides() {
  usePage(TITLE);
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'presenter') return <Presenter />;
  if (view === 'print') return <Print />;
  return <Audience />;
}
