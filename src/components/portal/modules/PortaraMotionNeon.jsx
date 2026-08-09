import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './PortaraMotionNeon.css';

/* ============================================================================
   PORTARA — MOTION 02 "NEON IGNITION"  (rendered by PortaraMotion.jsx)
   ----------------------------------------------------------------------------
   The contrast piece to Motion 01's paper sting: a NIGHT stage, because a glow
   cannot read on a light ground. One GSAP master timeline (~3.1s):

     glow trace  — each contour is drawn twice in sync: a wide accent stroke
                   under a shared feGaussianBlur (the halo) + a crisp core
                   stroke on top; the halo flickers twice mid-draw (subtle,
                   slow — well under any photosensitivity threshold)
     bloom       — a radial ember swells behind the mark
     ignition    — bone fills flood CENTER-OUT from each contour's core
     ember settle— glow decays, mark overshoots and rests (~1.7s), 150ms hold
     scanline    — the wordmark sits RIGHT of the mark (horizontal lockup,
                   mono caps vs 01's serif); an accent bar sweeps the text and
                   each character ignites accent→bone as it passes
     terminal    — the bar collapses into an end dot; the tagline tracks in

   Same contracts as Motion 01: JSX/CSS defaults ARE the final frame (so
   prefers-reduced-motion just skips building the timeline), every tween is
   fromTo + immediateRender, Replay restarts the one timeline. This stage
   additionally WAITS for its first viewport intersection before playing, so
   the sting isn't half-over when the user scrolls down to it.

   All ids are pn-* — Motion 01's pm-clip-* ids share the same document.
   ========================================================================== */

const ACCENT = '#ff4e2b';

// Same three contours as Motion 01. `clip` = the fully-open rect (the final
// frame); `cx` = the contour's horizontal centre, where the ignition starts.
const SHAPES = [
  {
    id: 'gate',
    d: 'M1309.45 1364.12V3154.06H1737.95V1471.9H1615.09V1364.12H3070.16V1471.9H2948.31V3154.06H3376.81V1364.12H3458.04V1026H1228.22V1364.12H1309.45Z',
    clip: { x: 1178, y: 976, width: 2331, height: 2228 },
    cx: 2343,
  },
  {
    id: 'lintel',
    d: 'M1084.03 3430.9V3240.7H3602.23V3430.9H1084.03Z',
    clip: { x: 1034, y: 3190, width: 2619, height: 291 },
    cx: 2343,
  },
  {
    id: 'base',
    d: 'M905 3750V3517.54H2772.5L2854.89 3604.18H3703.77L3785 3688.72V3750H905Z',
    clip: { x: 855, y: 3467, width: 2980, height: 333 },
    cx: 2345,
  },
];

const VIEWBOX = '855 976 2980 2824';
const SVG_CENTER = '2345 2388';

const WORD = [...'PORTARA'];

export default function NeonStage() {
  const stageRef = useRef(null);
  const tlRef = useRef(null);
  const reducedRef = useRef(false);

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedRef.current) return undefined; // defaults render the final frame

    const ctx = gsap.context(() => {
      const q = (sel) => gsap.utils.toArray(sel, stageRef.current);
      const [mark] = q('.pn-mark');
      const [bloom] = q('.pn-bloom');
      const [glowGrp] = q('.pn-glowgrp');
      const glows = q('.pn-glowstroke');
      const cores = q('.pn-core');
      const rects = q('.pn-cliprect');
      const chars = q('.pn-ch');
      const [bar] = q('.pn-bar');
      const [dot] = q('.pn-dot');
      const [tag] = q('.pn-tag');

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });

      /* REPLAY CONTRACT: replay() is a plain restart() — never invalidate()
         (it wipes recorded starts, and its deferred re-render of
         immediateRender tweens races seeks: stale glow, vanished wordmark).
         Every stateful tween is a fromTo with explicit values — a .to() would
         record its start from whatever state the previous run left — and t=0
         opens with a hard reset so the run is deterministic from any state. */
      tl.set(glowGrp, { opacity: 1 }, 0);
      tl.set(bloom, { opacity: 0, scale: 0.85, svgOrigin: SVG_CENTER }, 0);
      tl.set(bar, { opacity: 0, scaleY: 1, left: '0%' }, 0);
      tl.set(dot, { scale: 0 }, 0);
      tl.set(tag, { opacity: 0 }, 0);
      tl.set(chars, { opacity: 0 }, 0);
      SHAPES.forEach((s, i) => tl.set(rects[i], { attr: { x: s.cx, width: 0 } }, 0));

      // Mark drifts in, decelerating into a slight overshoot.
      tl.fromTo(
        mark,
        { scale: 0.97, y: 60, svgOrigin: SVG_CENTER },
        { scale: 1, y: 0, duration: 1.5, ease: 'back.out(1.2)' },
        0
      );

      // Beat 1 — glow trace: halo + core dash-draw each contour in sync.
      // The t=0 reset rewinds the DASH (undrawn but "on"), never opacity —
      // opacity here is a from-only prop, so GSAP treats it as no-change and
      // won't re-write it during playback; zeroing it would stick on replay.
      SHAPES.forEach((_, i) => {
        const len = cores[i].getTotalLength();
        gsap.set([glows[i], cores[i]], { strokeDasharray: len });
        tl.set([glows[i], cores[i]], { strokeDashoffset: len, opacity: 1 }, 0);
        tl.fromTo(
          [glows[i], cores[i]],
          { strokeDashoffset: len, opacity: 1 },
          { strokeDashoffset: 0, duration: 1.05, immediateRender: true },
          0.05 + i * 0.08
        );
      });

      // Neon flicker — two gentle dips on the halo group only (~8Hz max, tiny
      // amplitude; the core stroke never flickers so the contour stays stable).
      tl.fromTo(glowGrp, { opacity: 1 }, { opacity: 0.55, duration: 0.07, ease: 'power1.inOut', yoyo: true, repeat: 1 }, 0.55);
      tl.fromTo(glowGrp, { opacity: 1 }, { opacity: 0.7, duration: 0.06, ease: 'power1.inOut', yoyo: true, repeat: 1 }, 0.82);

      // Beat 2 — bloom swells behind the mark, then settles to ambient.
      tl.fromTo(
        bloom,
        { opacity: 0, scale: 0.85, transformOrigin: '50% 50%', svgOrigin: SVG_CENTER },
        { opacity: 0.5, scale: 1.05, duration: 0.6, immediateRender: true },
        0.95
      );
      tl.fromTo(
        bloom,
        { opacity: 0.5, scale: 1.05, svgOrigin: SVG_CENTER },
        { opacity: 0.22, scale: 1, duration: 0.55, ease: 'power2.out' },
        1.55
      );

      // Beat 3 — ignition: fills flood centre-out from each contour's core.
      rects.forEach((rect, i) => {
        const { clip, cx } = SHAPES[i];
        tl.fromTo(
          rect,
          { attr: { x: cx, width: 0 } },
          { attr: { x: clip.x, width: clip.width }, duration: i === 0 ? 0.6 : 0.5, immediateRender: true },
          1.05 + i * 0.09
        );
      });

      // Beat 4 — ember settle: halo dies first, cores linger a touch longer.
      tl.fromTo(glowGrp, { opacity: 1 }, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 1.45);
      tl.fromTo(cores, { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.out', stagger: 0.05 }, 1.55);

      // Beat 5 — scanline (after the 150ms hold; mark landed ~1.7s). The bar
      // travels via percentage `left`, which the browser resolves against the
      // word row LIVE each frame — responsive with no measuring, no invalidate.
      tl.fromTo(bar, { opacity: 0, scaleY: 1 }, { opacity: 1, scaleY: 1, duration: 0.15, immediateRender: true }, 1.9);
      tl.fromTo(
        bar,
        { left: '0%' },
        { left: '100%', duration: 0.75, ease: 'power1.inOut', immediateRender: true },
        1.9
      );
      tl.fromTo(
        chars,
        { opacity: 0, x: 14 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.065, immediateRender: true },
        1.98
      );
      tl.fromTo(
        chars,
        { color: ACCENT, textShadow: '0 0 18px rgba(255, 78, 43, 0.85)' },
        { color: '#ece7dc', textShadow: '0 0 0px rgba(255, 78, 43, 0)', duration: 0.45, stagger: 0.065, immediateRender: true },
        2.02
      );

      // Beat 6 — terminal: bar collapses into the end dot, tagline tracks in.
      tl.fromTo(bar, { opacity: 1, scaleY: 1 }, { opacity: 0, scaleY: 0.2, duration: 0.2, ease: 'power2.out' }, 2.62);
      tl.fromTo(
        dot,
        { scale: 0, transformOrigin: '50% 50%' },
        { scale: 1, duration: 0.5, ease: 'back.out(2.5)', immediateRender: true },
        2.6
      );
      tl.fromTo(
        tag,
        { opacity: 0, y: 10, letterSpacing: '0.45em' },
        { opacity: 1, y: 0, letterSpacing: '0.26em', duration: 0.65, immediateRender: true },
        2.62
      );

      tlRef.current = tl;
      // Dev-only: frame-exact seeking from the console (Motion 01 = __pmTl).
      if (import.meta.env.DEV) window.__pmTl2 = tl;

      // Play on first viewport intersection, not on mount — this stage sits
      // below Motion 01, and shouldn't be half-over when scrolled to.
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tl.play();
            io.disconnect();
          }
        },
        { threshold: 0.45 }
      );
      io.observe(stageRef.current);
      return () => io.disconnect();
    }, stageRef);

    return () => {
      tlRef.current = null;
      ctx.revert();
    };
  }, []);

  const replay = () => {
    if (reducedRef.current) {
      gsap.fromTo(
        stageRef.current.querySelector('.pn-lockup'),
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power1.out' }
      );
      return;
    }
    tlRef.current?.restart();
  };

  return (
    <section className="pm-stage pm-stage--night pt-card" ref={stageRef}>
      <header className="pm-stage__head">
        <span className="pm-stage__dot" aria-hidden="true" />
        <span className="pm-stage__label">Motion 02 — Neon ignition</span>
        <span className="pm-stage__meta">3.1s · GSAP timeline</span>
      </header>

      <div className="pn-lockup">
        <svg className="pn-svg" viewBox={VIEWBOX} role="img" aria-label="Portara gate mark">
          <defs>
            <filter id="pn-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="26" />
            </filter>
            <radialGradient id="pn-bloomgrad">
              <stop offset="0%" stopColor="rgba(255, 78, 43, 0.5)" />
              <stop offset="45%" stopColor="rgba(255, 78, 43, 0.16)" />
              <stop offset="100%" stopColor="rgba(255, 78, 43, 0)" />
            </radialGradient>
            {SHAPES.map((s) => (
              <clipPath key={s.id} id={`pn-clip-${s.id}`} clipPathUnits="userSpaceOnUse">
                <rect className="pn-cliprect" {...s.clip} />
              </clipPath>
            ))}
          </defs>
          <g className="pn-mark">
            <circle className="pn-bloom" cx="2345" cy="2388" r="1500" fill="url(#pn-bloomgrad)" />
            {/* One shared blur filter over the whole halo group — cheaper than
                filtering three paths separately. */}
            <g className="pn-glowgrp" filter="url(#pn-glow)">
              {SHAPES.map((s) => (
                <path key={`glow-${s.id}`} className="pn-glowstroke" d={s.d} fill="none" stroke={ACCENT} strokeWidth="44" />
              ))}
            </g>
            {SHAPES.map((s) => (
              <path key={`fill-${s.id}`} className="pn-fill" d={s.d} clipPath={`url(#pn-clip-${s.id})`} />
            ))}
            {/* Crisp cores last — legible above the flooding fills. */}
            {SHAPES.map((s) => (
              <path key={`core-${s.id}`} className="pn-core" d={s.d} fill="none" stroke={ACCENT} strokeWidth="16" />
            ))}
          </g>
        </svg>

        <div className="pn-text">
          <span className="pn-wordwrap" aria-label="Portara">
            <span className="pn-word" aria-hidden="true">
              {WORD.map((ch, i) => (
                <span className="pn-ch" key={i}>{ch}</span>
              ))}
            </span>
            <span className="pn-dot" aria-hidden="true" />
            <span className="pn-bar" aria-hidden="true" />
          </span>
          <span className="pn-tag">Portals · MCP · Agents</span>
        </div>
      </div>

      <footer className="pm-stage__foot">
        <button type="button" className="hp-btn" onClick={replay}>Replay</button>
        <span className="pm-stage__note">Plays on first scroll into view. Respects reduced motion.</span>
      </footer>
    </section>
  );
}
