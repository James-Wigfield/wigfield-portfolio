import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { registerScene, useReducedMotion } from './motion';

/* ============================================================================
   DL PROJECT 2 — SCENE FRAME
   ----------------------------------------------------------------------------
   Every explainer animation is one of these. A scene supplies:

     beats     [{ t: 'short title', c: 'caption sentence' }, …]
     art       (step, uid) => SVG children: the picture as it stands at the END
               of beat `step`. Pure — no GSAP in here. It is the single source
               for the finished frame (JSX defaults), the reduced-motion frame,
               the print storyboard and the reduced-motion step-through.
     build     (tl, { q, uid, beat }) => void: fills ONE paused timeline. Call
               beat(i, position) to mark where beat i starts. Every stateful
               tween is a fromTo with explicit values and t=0 is reset with
               tl.set(), so replay is a restart and never invalidate(). The
               restart lands on T0 (0.1 ms), not 0: GSAP reverts zero-duration
               sets that sit at exactly 0 when the playhead is sought back onto
               0, and does not re-apply them going forward.
     keyframes beat indices printed as the storyboard strip (default: last)
     frameBoxes optional { [beat]: viewBox } cropping an earlier print frame
               to what has been drawn by then, so it prints larger

   The frame owns the rest: play on first in-view, pause off-screen or when
   the tab hides (and resume only if it paused itself), play/pause/replay,
   step back/forward to beat boundaries, captions synced to the playhead, the
   beat list as seek buttons, and the dev-only window.__dlp2 seek handle.
   Under prefers-reduced-motion no timeline is built: the stage is art(last)
   and the step buttons swap static frames instead.
   ========================================================================== */

const EPS = 1e-3;
const T0 = 1e-4; // the earliest time any seek or restart lands on (see header)
const clean = (s) => s.replace(/[^a-zA-Z0-9]/g, '');

const Art = memo(function Art({ art, step, uid }) {
  return art(step, uid);
});

function Icon({ d }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const IC = {
  play: 'M5 3.2v9.6L12.6 8 5 3.2Z',
  pause: 'M5.5 3.5v9M10.5 3.5v9',
  replay: 'M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.6h2.6',
  prev: 'M10 3.5 5.5 8l4.5 4.5',
  next: 'M6 3.5 10.5 8 6 12.5',
};

export default function Scene({ id, label, beats, art, build, viewBox, keyframes, frameBoxes, schematic, note, side = false }) {
  const reduced = useReducedMotion();
  const uid = clean(useId());
  const last = beats.length - 1;
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const scrollRef = useRef(null);
  const wrapRef = useRef(null);
  const userScrollAt = useRef(0);
  const autoScroll = useRef(0);
  const tlRef = useRef(null);
  const timesRef = useRef([]);
  const beatRef = useRef(0);
  const endedRef = useRef(false);
  const flags = useRef({ started: false, userPaused: false, autoPaused: false, inView: false });
  const buildRef = useRef(build);
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [staticStep, setStaticStep] = useState(last);

  useLayoutEffect(() => {
    buildRef.current = build;
  });

  // ── narrow screens: the stage keeps a legible size and scrolls sideways ──
  // It follows the playhead (or a beat's own focus point, `fx` 0…1), unless the
  // reader scrolled it in the last 2.5 s; data-more drives the edge fade.
  const markMore = useCallback(() => {
    const sc = scrollRef.current;
    const wrap = wrapRef.current;
    if (!sc || !wrap) return;
    const max = sc.scrollWidth - sc.clientWidth;
    const more = max <= 2 ? '' : sc.scrollLeft < 2 ? 'right' : sc.scrollLeft > max - 2 ? 'left' : 'both';
    if (more) wrap.dataset.more = more;
    else delete wrap.dataset.more;
    // only an overflowing stage is a keyboard stop (a labelled scroll region)
    if (max > 2) {
      sc.tabIndex = 0;
      sc.setAttribute('role', 'region');
      sc.setAttribute('aria-label', `${label} — scrolls sideways`);
    } else {
      sc.removeAttribute('tabindex');
      sc.removeAttribute('role');
      sc.removeAttribute('aria-label');
    }
  }, [label]);
  const lastTarget = useRef(-1);
  const follow = useCallback((frac) => {
    const sc = scrollRef.current;
    if (!sc || Date.now() - userScrollAt.current < 2500) return;
    const max = sc.scrollWidth - sc.clientWidth;
    if (max <= 2) return;
    const left = Math.round(Math.max(0, Math.min(1, frac)) * max);
    // glide, and only retarget when the goal has moved noticeably
    if (Math.abs(lastTarget.current - left) < 20 && lastTarget.current >= 0) return;
    lastTarget.current = left;
    autoScroll.current = Date.now() + 750;
    gsap.to(sc, { scrollLeft: left, duration: 0.6, ease: 'power2.inOut', overwrite: true });
  }, []);
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    const onScroll = () => {
      // scroll events during a follow glide are ours; anything else is the reader
      if (!(autoScroll.current && Date.now() < autoScroll.current)) userScrollAt.current = Date.now();
      markMore();
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(markMore);
      ro.observe(sc);
    }
    markMore();
    return () => {
      sc.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, [markMore]);
  const followRef = useRef(follow);
  useLayoutEffect(() => {
    followRef.current = follow;
  });

  // reduced motion: stepping through static frames scrolls to the beat too
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if (reduced) follow(beats[staticStep]?.fx ?? (beats.length > 1 ? staticStep / (beats.length - 1) : 1));
    // beats is a module-level constant per scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticStep, reduced, follow]);

  // ── the timeline ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (reduced || !stageRef.current) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut', duration: 0.6 } });
      const beat = (i, at) => {
        tl.addLabel(`b${i}`, at);
        return `b${i}`;
      };
      buildRef.current(tl, { q: gsap.utils.selector(stageRef.current), uid: `${uid}L`, beat });
      // Give every beat time to be read: if its caption needs longer than its
      // animation (under 4 words a second, as the reader also watches the
      // stage), hold before the next beat starts.
      // Walk backwards so each shift leaves the earlier labels where they are;
      // shiftChildren moves the later labels with their tweens.
      for (let i = beats.length - 1; i >= 0; i--) {
        const start = tl.labels[`b${i}`] ?? 0;
        const end = i + 1 < beats.length ? tl.labels[`b${i + 1}`] ?? tl.duration() : tl.duration();
        const words = `${beats[i].t} ${beats[i].c}`.split(/\s+/).filter(Boolean).length;
        const hold = Math.min(8, Math.max(0, words / 3.8 + 0.6 - (end - start)));
        if (hold > 0.05) {
          if (i + 1 < beats.length) tl.shiftChildren(hold, true, end - 1e-6);
          else tl.to({}, { duration: hold });
        }
      }
      timesRef.current = beats.map((_, i) => tl.labels[`b${i}`] ?? 0);
      tl.eventCallback('onUpdate', () => {
        const t = tl.time();
        let idx = 0;
        timesRef.current.forEach((lt, i) => {
          if (i > 0 && lt < t - EPS) idx = i;
        });
        if (idx !== beatRef.current) {
          beatRef.current = idx;
          setBeat(idx);
        }
        const fx = beats[idx]?.fx;
        followRef.current(fx ?? tl.progress());
        const done = tl.progress() >= 1 - EPS;
        if (done !== endedRef.current) {
          endedRef.current = done;
          setEnded(done);
          if (done) setPlaying(false);
        }
      });
      tlRef.current = tl;
    }, stageRef);
    return () => {
      tlRef.current = null;
      ctx.revert();
    };
    // beats/build are module-level constants per scene; the timeline is
    // rebuilt only when reduced motion flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, uid]);

  // ── in-view play / off-screen + hidden-tab pause ─────────────────────────
  useEffect(() => {
    if (reduced) return undefined;
    const el = rootRef.current;
    const f = flags.current;
    const resume = () => {
      const tl = tlRef.current;
      if (!tl) return;
      if (!f.started) {
        f.started = true;
        tl.play(0);
        setPlaying(true);
      } else if (f.autoPaused && !f.userPaused) {
        f.autoPaused = false;
        tl.play();
        setPlaying(true);
      }
    };
    const hold = () => {
      const tl = tlRef.current;
      if (tl && !tl.paused() && tl.progress() < 1) {
        f.autoPaused = true;
        tl.pause();
        setPlaying(false);
      }
    };
    const io = new IntersectionObserver(
      ([e]) => {
        f.inView = e.isIntersecting;
        if (e.isIntersecting && document.visibilityState === 'visible') resume();
        else if (!e.isIntersecting) hold();
      },
      { threshold: 0.35 },
    );
    if (el) io.observe(el);
    const onVis = () => {
      if (document.visibilityState === 'hidden') hold();
      else if (f.inView) resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  // ── controls ─────────────────────────────────────────────────────────────
  const boundaries = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return [];
    return [...timesRef.current.slice(1), tl.duration()];
  }, []);

  const play = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    flags.current.userPaused = false;
    flags.current.started = true;
    if (tl.progress() >= 1 - EPS) tl.play(T0);
    else tl.play();
    setPlaying(true);
  }, []);
  const pause = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    flags.current.userPaused = true;
    tl.pause();
    setPlaying(false);
  }, []);
  const replay = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    flags.current.userPaused = false;
    flags.current.started = true;
    tl.play(T0);
    setPlaying(true);
  }, []);
  const seekTo = useCallback((time) => {
    const tl = tlRef.current;
    if (!tl) return;
    flags.current.userPaused = true;
    flags.current.started = true;
    tl.pause();
    tl.seek(Math.max(T0, time), false);
    setPlaying(false);
  }, []);
  const stepNext = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const t = tl.time();
    const target = boundaries().find((b) => b > t + EPS);
    flags.current.userPaused = true;
    flags.current.started = true;
    if (target === undefined) return;
    tl.pause();
    tl.tweenTo(target, { duration: Math.min(1.2, Math.max(0.35, target - t)), ease: 'none' });
    setPlaying(false);
  }, [boundaries]);
  const stepPrev = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const t = tl.time();
    const prev = [0, ...boundaries()].filter((b) => b < t - EPS);
    seekTo(prev.length ? prev[prev.length - 1] : 0);
  }, [boundaries, seekTo]);
  const jumpBeat = useCallback((i) => {
    const b = boundaries();
    if (b[i] !== undefined) seekTo(b[i]);
  }, [boundaries, seekTo]);

  useEffect(() => {
    const unregister = registerScene(id, {
      seek: (p) => {
        const tl = tlRef.current;
        if (tl) seekTo(Math.max(0, Math.min(1, p)) * tl.duration());
      },
      play,
      pause,
      replay,
      // dev/headless only: real playback, just faster (the suite plays every scene twice)
      speed: (k) => tlRef.current?.timeScale(k),
      // progress (0..1) at which each beat has finished — the frame art(k) shows
      beatEnds: () => {
        const tl = tlRef.current;
        if (!tl || !tl.duration()) return [];
        return [...timesRef.current.slice(1), tl.duration()].map((t) => t / tl.duration());
      },
      state: () => {
        const tl = tlRef.current;
        return {
          progress: tl ? Number(tl.progress().toFixed(4)) : 1,
          time: tl ? Number(tl.time().toFixed(3)) : null,
          duration: tl ? Number(tl.duration().toFixed(3)) : 0,
          beat: tl ? beatRef.current : null,
          beats: beats.length,
          playing: tl ? !tl.paused() && tl.progress() < 1 : false,
          started: flags.current.started,
          reduced: !tl,
        };
      },
    });
    return unregister;
  }, [id, beats.length, play, pause, replay, seekTo]);

  const shown = reduced ? staticStep : beat;
  const frames = keyframes && keyframes.length ? keyframes : [last];
  const onToggle = () => (playing ? pause() : play());

  return (
    <figure ref={rootRef} className={`dlp2-scene${side ? ' dlp2-scene--side' : ''}`} id={`dlp2-scene-${id}`}>
      <div className="dlp2-scene__grid">
        <div className="dlp2-scene__stagewrap" ref={wrapRef}>
          <span className="dlp2-crop dlp2-crop--tl" aria-hidden="true" />
          <span className="dlp2-crop dlp2-crop--tr" aria-hidden="true" />
          <span className="dlp2-crop dlp2-crop--bl" aria-hidden="true" />
          <span className="dlp2-crop dlp2-crop--br" aria-hidden="true" />
          <div className="dlp2-scene__scroll" ref={scrollRef}>
            <svg ref={stageRef} className="dlp2-scene__stage" viewBox={viewBox} role="img" aria-label={label}>
              <title>{label}</title>
              <Art art={art} step={reduced ? staticStep : last} uid={`${uid}L`} />
            </svg>
          </div>
          {schematic && (
            <span className="dlp2-scene__schem">
              <span className="dlp2-dot" aria-hidden="true" />
              schematic{typeof schematic === 'string' ? ` · ${schematic}` : ''}
            </span>
          )}
        </div>

        <div className="dlp2-scene__side">
          <p className="dlp2-scene__caption" aria-live="polite">
            <span className="dlp2-scene__capno">{String(shown + 1).padStart(2, '0')}</span>
            <span className="dlp2-scene__capt">{beats[shown]?.t}</span>
            <span className="dlp2-scene__capc">{beats[shown]?.c}</span>
          </p>
          {beats.length > 1 && (
            <ol className="dlp2-scene__beats">
              {beats.map((b, i) => (
                <li key={b.t}>
                  <button
                    type="button"
                    className={`dlp2-scene__beat${i === shown ? ' dlp2-scene__beat--on' : ''}${i < shown ? ' dlp2-scene__beat--past' : ''}`}
                    aria-current={i === shown ? 'step' : undefined}
                    onClick={() => (reduced ? setStaticStep(i) : jumpBeat(i))}
                  >
                    <span className="dlp2-scene__beatno">{String(i + 1).padStart(2, '0')}</span>
                    {b.t}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="dlp2-scene__controls">
            {!reduced && (
              <>
                <button type="button" className="dlp2-ctl" onClick={onToggle} aria-label={playing ? 'Pause' : ended ? 'Play again' : 'Play'}>
                  <Icon d={playing ? IC.pause : IC.play} />
                  <span>{playing ? 'Pause' : 'Play'}</span>
                </button>
                <button type="button" className="dlp2-ctl" onClick={replay} aria-label="Replay from the start">
                  <Icon d={IC.replay} />
                  <span>Replay</span>
                </button>
              </>
            )}
            {beats.length > 1 && (
              <span className="dlp2-ctl-group">
                <button
                  type="button"
                  className="dlp2-ctl dlp2-ctl--sq"
                  onClick={() => (reduced ? setStaticStep((s) => Math.max(0, s - 1)) : stepPrev())}
                  aria-label="Previous step"
                >
                  <Icon d={IC.prev} />
                </button>
                <span className="dlp2-ctl-count">
                  {shown + 1}/{beats.length}
                </span>
                <button
                  type="button"
                  className="dlp2-ctl dlp2-ctl--sq"
                  onClick={() => (reduced ? setStaticStep((s) => Math.min(last, s + 1)) : stepNext())}
                  aria-label="Next step"
                >
                  <Icon d={IC.next} />
                </button>
              </span>
            )}
          </div>
          {note && <p className="dlp2-scene__note">{note}</p>}
        </div>
      </div>

      {/* dev only: every beat's static frame, off-screen, so the headless check can
          compare the live timeline at each beat's end with art(k) */}
      {import.meta.env.DEV && (
        <div className="dlp2-scene__devframes" aria-hidden="true">
          {beats.map((b, k) => (
            <svg key={b.t} data-step={k} viewBox={viewBox}>
              <Art art={art} step={k} uid={`${uid}D${k}`} />
            </svg>
          ))}
        </div>
      )}

      {/* print only: the storyboard strip + the full narration as text */}
      <div className="dlp2-scene__board">
        {schematic && (
          <p className="dlp2-board__schem">
            {/* the label says which parts are drawn for illustration; the numbers printed in a frame are the notebook's */}
            {typeof schematic === 'string'
              ? `Schematic: ${schematic}. The drawing is illustrative; a number printed in it is real unless this line calls it illustrative.`
              : 'Schematic. Illustrative, not a result.'}
          </p>
        )}
        <div className={`dlp2-board dlp2-board--n${frames.length}`}>
          {frames.map((k) => (
            <div className="dlp2-board__frame" key={k}>
              {/* frameBoxes[k] crops an earlier print frame to the part that has been drawn */}
              <svg viewBox={frameBoxes?.[k] || viewBox} role="img" aria-label={`${label} — step ${k + 1}`}>
                {frameBoxes?.[k] ? (
                  // a crop narrower than the print frame is letterboxed: clip to the box
                  // so the bands stay blank instead of showing the neighbouring art
                  <>
                    <defs>
                      <clipPath id={`${uid}C${k}`}>
                        <rect x={frameBoxes[k].split(' ')[0]} y={frameBoxes[k].split(' ')[1]} width={frameBoxes[k].split(' ')[2]} height={frameBoxes[k].split(' ')[3]} />
                      </clipPath>
                    </defs>
                    <g clipPath={`url(#${uid}C${k})`}>
                      <Art art={art} step={k} uid={`${uid}K${k}`} />
                    </g>
                  </>
                ) : (
                  <Art art={art} step={k} uid={`${uid}K${k}`} />
                )}
              </svg>
              <p className="dlp2-board__cap">
                <b>{String(k + 1).padStart(2, '0')} · {beats[k].t}.</b> {beats[k].c}
              </p>
            </div>
          ))}
        </div>
        {beats.length > 1 && (
          <ol className="dlp2-board__all">
            {beats.map((b, i) => (
              <li key={b.t}>
                <b>{b.t}.</b> {frames.includes(i) ? '(frame above)' : b.c}
              </li>
            ))}
          </ol>
        )}
      </div>
    </figure>
  );
}
