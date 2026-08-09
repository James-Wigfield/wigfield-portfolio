import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './PortaraMotion.css';

/* ============================================================================
   PORTARA — MOTION DESIGN  (Portara section)
   ----------------------------------------------------------------------------
   Brand sting: a ~3s orchestrated logo reveal of the Portara gate mark
   (assets/portal/portara-logos/portara_logo_blk_t.svg, inlined below so each
   path animates independently). One GSAP master timeline drives every beat —
   accent edge-traces draw the three contours, offset accent "echo" silhouettes
   appear, the black fills flood over them via clip-path wipes, the echoes snap
   into registration as the mark settles with a slight overshoot, then (after a
   150ms hold) the wordmark resolves per-character and an accent rule sweeps in.

   • The stage is a FIXED paper ground (not theme tokens) so the black mark and
     the #ff4e2b accent read identically in every portal theme, incl. Arcade.
   • Trace strokes render AFTER the fills in the DOM so they paint on top —
     the outline stays legible while the fill floods beneath it.
   • prefers-reduced-motion: no timeline is built; the JSX/CSS defaults ARE the
     final frame, and Replay does a plain opacity fade instead.
   • All tweens are fromTo with immediateRender, so restart() is deterministic.
   ========================================================================== */

const ACCENT = '#ff4e2b';

// The three unique contours from the source SVG (it ships each twice — a
// hidden #B33D3D copy under a black copy; we repurpose that under-layer as
// the accent echo). Clip data drives each fill's directional wipe.
const SHAPES = [
  {
    id: 'gate',
    d: 'M1309.45 1364.12V3154.06H1737.95V1471.9H1615.09V1364.12H3070.16V1471.9H2948.31V3154.06H3376.81V1364.12H3458.04V1026H1228.22V1364.12H1309.45Z',
    clip: { x: 1178, y: 976, width: 2331, height: 2228 }, // sweeps top → down
  },
  {
    id: 'lintel',
    d: 'M1084.03 3430.9V3240.7H3602.23V3430.9H1084.03Z',
    clip: { x: 1034, y: 3190, width: 2619, height: 291 }, // wipes left → right
  },
  {
    id: 'base',
    d: 'M905 3750V3517.54H2772.5L2854.89 3604.18H3703.77L3785 3688.72V3750H905Z',
    clip: { x: 855, y: 3467, width: 2980, height: 333 }, // rises bottom → top
  },
];

// Mark bounds cropped from the source's padded 4689×4776 canvas.
const VIEWBOX = '855 976 2980 2824';
const SVG_CENTER = '2345 2388';

const WORD = [...'Portara'];

const CUES = [
  ['0.00', 'Edge trace', 'accent strokes draw the three contours — gate, lintel, base — 80ms stagger'],
  ['0.34', 'Accent echo', 'offset #ff4e2b silhouettes fade in behind each shape'],
  ['0.55', 'Fill flood', 'black fills wipe over the echoes — down, across, rise'],
  ['1.22', 'Registration', 'echoes snap into place, traces fade, mark overshoots and settles'],
  ['1.88', 'Wordmark', 'after a 150ms hold — per-character rise + de-blur, 55ms stagger'],
  ['2.42', 'Accent rule', 'sweeps under the wordmark; lockup at rest ≈ 3.0s'],
];

export default function PortaraMotion() {
  const stageRef = useRef(null);
  const tlRef = useRef(null);
  const reducedRef = useRef(false);

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedRef.current) return undefined; // defaults render the final frame

    const ctx = gsap.context(() => {
      const q = (sel) => gsap.utils.toArray(sel, stageRef.current);
      const [mark] = q('.pm-mark');
      const traces = q('.pm-trace');
      const echoes = q('.pm-echo');
      const rects = q('.pm-cliprect');
      const chars = q('.pm-ch');
      const [rule] = q('.pm-rule');

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

      // Mark drifts up into frame, decelerating into a slight overshoot.
      tl.fromTo(
        mark,
        { scale: 0.94, y: 120, svgOrigin: SVG_CENTER },
        { scale: 1, y: 0, duration: 1.6, ease: 'back.out(1.3)' },
        0
      );

      // Beat 1 — edge trace: dash-draw each contour (fills can't line-draw,
      // so these are stroke twins sitting ABOVE the fills).
      traces.forEach((path, i) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len });
        tl.fromTo(
          path,
          { strokeDashoffset: len, opacity: 1 },
          { strokeDashoffset: 0, duration: 1.05, immediateRender: true },
          0.05 + i * 0.08
        );
      });

      // Beat 2 — accent echoes appear, offset out of registration.
      echoes.forEach((path, i) => {
        tl.fromTo(
          path,
          { x: -46, y: 40, opacity: 0 },
          { opacity: 0.95, duration: 0.45, ease: 'power2.out', immediateRender: true },
          0.34 + i * 0.08
        );
      });

      // Beat 3 — fill flood: each clip rect opens along its own axis.
      const wipes = [
        [{ attr: { height: 0 } }, { attr: { height: SHAPES[0].clip.height }, duration: 0.85 }],
        [{ attr: { width: 0 } }, { attr: { width: SHAPES[1].clip.width }, duration: 0.7 }],
        [
          { attr: { y: 3800, height: 0 } },
          { attr: { y: SHAPES[2].clip.y, height: SHAPES[2].clip.height }, duration: 0.7 },
        ],
      ];
      rects.forEach((rect, i) => {
        tl.fromTo(rect, wipes[i][0], { ...wipes[i][1], immediateRender: true }, 0.55 + i * 0.08);
      });

      // Beat 4 — registration snap + trace fade; the mark is "landed" ~1.7s.
      tl.to(echoes, { x: 0, y: 0, duration: 0.4, ease: 'back.out(2.2)', stagger: 0.06 }, 1.22);
      tl.to(traces, { opacity: 0, duration: 0.3, ease: 'power2.out', stagger: 0.05 }, 1.3);

      // Beat 5 — wordmark, after a 150ms hold. Transform and opacity/blur run
      // as parallel tweens so the rise can overshoot while the fade stays clean.
      tl.fromTo(
        chars,
        { yPercent: 70 },
        { yPercent: 0, duration: 0.75, ease: 'back.out(1.6)', stagger: 0.055, immediateRender: true },
        1.88
      );
      tl.fromTo(
        chars,
        { opacity: 0, filter: 'blur(8px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.55, stagger: 0.055, immediateRender: true },
        1.88
      );

      // Beat 6 — accent rule sweeps under the wordmark.
      tl.fromTo(
        rule,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.55, immediateRender: true },
        2.42
      );

      tlRef.current = tl;
      // Dev-only: lets the console scrub/pause the sting to tune cue timings.
      if (import.meta.env.DEV) window.__pmTl = tl;
    }, stageRef);

    return () => {
      tlRef.current = null;
      ctx.revert();
    };
  }, []);

  const replay = () => {
    if (reducedRef.current) {
      // Reduced motion: no movement — a plain crossfade of the finished lockup.
      gsap.fromTo(
        stageRef.current.querySelector('.pm-lockup'),
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power1.out' }
      );
      return;
    }
    tlRef.current?.restart();
  };

  return (
    <div className="pt-module pm">
      <p className="pt-module__intro">
        The Portara brand sting — a 3-second logo reveal built as one orchestrated GSAP
        timeline. The gate mark's contours trace in, fills flood over an accent echo, and
        the wordmark resolves per character once the mark has settled.
      </p>

      <section className="pm-stage pt-card" ref={stageRef}>
        <header className="pm-stage__head">
          <span className="pm-stage__dot" aria-hidden="true" />
          <span className="pm-stage__label">Motion 01 — Logo sting</span>
          <span className="pm-stage__meta">3.0s · GSAP timeline</span>
        </header>

        <div className="pm-lockup">
          <svg className="pm-svg" viewBox={VIEWBOX} role="img" aria-label="Portara gate mark">
            <defs>
              {SHAPES.map((s) => (
                <clipPath key={s.id} id={`pm-clip-${s.id}`} clipPathUnits="userSpaceOnUse">
                  {/* JSX defaults = fully open (the reduced-motion final frame);
                      the timeline zeroes them at t=0 before first paint. */}
                  <rect className="pm-cliprect" {...s.clip} />
                </clipPath>
              ))}
            </defs>
            <g className="pm-mark">
              {SHAPES.map((s) => (
                <path key={`echo-${s.id}`} className="pm-echo" d={s.d} fill={ACCENT} />
              ))}
              {SHAPES.map((s) => (
                <path
                  key={`fill-${s.id}`}
                  className="pm-fill"
                  d={s.d}
                  clipPath={`url(#pm-clip-${s.id})`}
                />
              ))}
              {/* Traces LAST so they paint above the fills — the accent outline
                  stays visible while the black flood happens underneath. */}
              {SHAPES.map((s) => (
                <path
                  key={`trace-${s.id}`}
                  className="pm-trace"
                  d={s.d}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="26"
                />
              ))}
            </g>
          </svg>

          <div className="pm-word" aria-label="Portara">
            <span className="pm-word__row" aria-hidden="true">
              {WORD.map((ch, i) => (
                <span className="pm-ch" key={i}>{ch}</span>
              ))}
            </span>
            <span className="pm-rule" aria-hidden="true" />
          </div>
        </div>

        <footer className="pm-stage__foot">
          <button type="button" className="hp-btn" onClick={replay}>Replay</button>
          <span className="pm-stage__note">Respects reduced motion — renders the final frame, replay fades.</span>
        </footer>
      </section>

      <section className="pm-cues">
        <h2 className="pm-cues__title">Cue sheet</h2>
        <ol className="pm-cues__list">
          {CUES.map(([t, name, detail]) => (
            <li className="pm-cue" key={t}>
              <span className="pm-cue__time">{t}s</span>
              <span className="pm-cue__name">{name}</span>
              <span className="pm-cue__detail">{detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
