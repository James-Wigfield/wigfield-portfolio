/**
 * The Portara brand sting, on the landing page.
 *
 * Ported from apps/control-plane/app/components/portara-motion.tsx (Motion 01,
 * "Logo sting", itself a 1:1 port of the portfolio's PortaraMotion.jsx): the
 * same three contours, the same six GSAP beats, the same resting lockup (the
 * Logo Lab preset "Jost - All Cap - Wide - No Rule"). What changed for the
 * hero:
 *
 * - No stage chrome, cue sheet or MP4 export: this is the page's opening
 *   shot, not the marketing tool.
 * - Ink follows the theme (var(--c-heading)) instead of the fixed paper
 *   stage, and the accent is the site's --accent.
 * - A faint blueprint outline of the mark is there from first paint, so the
 *   space is never empty before the ink arrives.
 * - THE ORBIT. Once the mark has landed, an accent segment keeps tracing each
 *   of the three contours at a steady pace, for as long as the mark is on
 *   screen, and runs faster while the page is being scrolled. A logo that
 *   finished animating and then just sat there read as a picture in a box;
 *   this keeps it alive without ever repeating the intro.
 * - The timeline only ever touches what is INSIDE .sting__mark and .sting__word
 *   (the SVG group, the characters, the rule). The two wrappers themselves are
 *   left alone so hero-scene.tsx can measure and fade them on scroll without
 *   the two animations fighting over one transform.
 * - `onSettled` fires as the wordmark resolves (~1.9s).
 *
 * prefers-reduced-motion: no timeline, no orbit; the JSX/CSS defaults ARE the
 * final frame, and onSettled fires at once.
 */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// The three unique contours from the brand SVG. Clip data drives each fill's
// directional wipe.
const SHAPES = [
  {
    id: "gate",
    d: "M1309.45 1364.12V3154.06H1737.95V1471.9H1615.09V1364.12H3070.16V1471.9H2948.31V3154.06H3376.81V1364.12H3458.04V1026H1228.22V1364.12H1309.45Z",
    clip: { x: 1178, y: 976, width: 2331, height: 2228 }, // sweeps top -> down
  },
  {
    id: "lintel",
    d: "M1084.03 3430.9V3240.7H3602.23V3430.9H1084.03Z",
    clip: { x: 1034, y: 3190, width: 2619, height: 291 }, // wipes left -> right
  },
  {
    id: "base",
    d: "M905 3750V3517.54H2772.5L2854.89 3604.18H3703.77L3785 3688.72V3750H905Z",
    clip: { x: 855, y: 3467, width: 2980, height: 333 }, // rises bottom -> top
  },
];

// Mark bounds cropped from the source's padded 4689x4776 canvas.
export const MARK_VIEWBOX = "855 976 2980 2824";
const SVG_CENTER = "2345 2388";

const WORD = [..."PORTARA"];
const TAG = [..."PORTALS · MCP · AGENTS"];

/* The orbit, in viewBox units. A segment this long on each contour, all three
   moving at the same linear speed so they read as one current. The base pace
   laps the gate in about seven seconds; scrolling can push it to ~3x. */
const ORBIT_DASH = 1100;
const ORBIT_BASE_SPEED = 1300; // units per second
const ORBIT_MAX_BOOST = 2600;

/** The gate mark, still, in currentColor. The favicon-sized twin the flying
    mark lands on, and anywhere else the page wants the mark as an icon. */
export function GateMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
      {SHAPES.map((s) => (
        <path key={s.id} d={s.d} fill="currentColor" />
      ))}
    </svg>
  );
}

export function BrandSting({ onSettled }: { onSettled?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settledRef.current?.();
      return;
    }

    const ctx = gsap.context(() => {
      const q = (sel: string) => gsap.utils.toArray<Element>(sel, root);
      const [mark] = q(".sting__g");
      const traces = q(".sting__trace") as SVGPathElement[];
      const orbits = q(".sting__orbit") as SVGPathElement[];
      const echoes = q(".sting__echo");
      const rects = q(".sting__cliprect");
      const chars = q(".sting__ch");
      const tchars = q(".sting__tch");
      const [rule] = q(".sting__rule");

      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      // Mark drifts up into frame, decelerating into a slight overshoot.
      tl.fromTo(
        mark,
        { scale: 0.94, y: 120, svgOrigin: SVG_CENTER },
        { scale: 1, y: 0, duration: 1.6, ease: "back.out(1.3)" },
        0,
      );

      // Beat 1 - edge trace: dash-draw each contour.
      traces.forEach((path, i) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len });
        tl.fromTo(
          path,
          { strokeDashoffset: len, opacity: 1 },
          { strokeDashoffset: 0, duration: 1.05, immediateRender: true },
          0.05 + i * 0.08,
        );
      });

      // Beat 2 - accent echoes appear, offset out of registration.
      echoes.forEach((path, i) => {
        tl.fromTo(
          path,
          { x: -46, y: 40, opacity: 0 },
          { opacity: 0.95, duration: 0.45, ease: "power2.out", immediateRender: true },
          0.34 + i * 0.08,
        );
      });

      // Beat 3 - fill flood: each clip rect opens along its own axis.
      const wipes: [gsap.TweenVars, gsap.TweenVars][] = [
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

      // Beat 4 - registration snap + trace fade; the mark is "landed" ~1.7s.
      tl.to(echoes, { x: 0, y: 0, duration: 0.4, ease: "back.out(2.2)", stagger: 0.06 }, 1.22);
      tl.to(traces, { opacity: 0, duration: 0.3, ease: "power2.out", stagger: 0.05 }, 1.3);

      // The orbit takes over from the traces: one accent segment per contour,
      // already moving as it fades in.
      const lengths = orbits.map((p) => p.getTotalLength());
      orbits.forEach((path, i) => {
        gsap.set(path, { strokeDasharray: `${ORBIT_DASH} ${lengths[i] - ORBIT_DASH}` });
      });
      tl.fromTo(orbits, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" }, 1.55);

      // Beat 5 - wordmark, after a 150ms hold.
      tl.fromTo(
        chars,
        { yPercent: 70 },
        { yPercent: 0, duration: 0.75, ease: "back.out(1.6)", stagger: 0.055, immediateRender: true },
        1.88,
      );
      tl.fromTo(
        chars,
        { opacity: 0, filter: "blur(8px)" },
        { opacity: 1, filter: "blur(0px)", duration: 0.55, stagger: 0.055, immediateRender: true },
        1.88,
      );
      tl.call(() => settledRef.current?.(), [], 1.95);

      // Beat 6 - rule sweeps in, tagline prints in its wake, rule exits right.
      tl.fromTo(
        rule,
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.45, immediateRender: true },
        2.42,
      );
      tl.fromTo(
        tchars,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.016, immediateRender: true },
        2.56,
      );
      tl.to(rule, { scaleX: 0, transformOrigin: "right center", duration: 0.38, ease: "power2.in" }, 2.98);

      // The orbit's motion: a steady advance, plus a share of the scroll
      // velocity, only while the mark is on screen.
      const offsets = orbits.map(() => 0);
      let velocity = 0;
      let lastY = window.scrollY;
      let lastT = performance.now();
      let visible = true;
      const onScroll = () => {
        const now = performance.now();
        const dt = Math.max(1, now - lastT) / 1000;
        velocity = gsap.utils.interpolate(velocity, Math.abs(window.scrollY - lastY) / dt, 0.4);
        lastY = window.scrollY;
        lastT = now;
      };
      const tick = (_t: number, deltaMs: number) => {
        if (!visible) return;
        const dt = deltaMs / 1000;
        velocity = gsap.utils.interpolate(velocity, 0, 0.05);
        const speed = ORBIT_BASE_SPEED + Math.min(velocity * 1.4, ORBIT_MAX_BOOST);
        orbits.forEach((path, i) => {
          offsets[i] = (offsets[i] - speed * dt) % lengths[i];
          path.style.strokeDashoffset = `${offsets[i]}`;
        });
      };
      const io = new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
      });
      io.observe(root);
      window.addEventListener("scroll", onScroll, { passive: true });
      gsap.ticker.add(tick);

      return () => {
        io.disconnect();
        window.removeEventListener("scroll", onScroll);
        gsap.ticker.remove(tick);
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div className="sting" ref={rootRef}>
      <div className="sting__mark">
        <svg className="sting__svg" viewBox={MARK_VIEWBOX} role="img" aria-label="Portara gate mark">
          <defs>
            {SHAPES.map((s) => (
              <clipPath key={s.id} id={`sting-clip-${s.id}`} clipPathUnits="userSpaceOnUse">
                {/* JSX defaults = fully open (the reduced-motion final frame);
                    the timeline zeroes them at t=0 before first paint. */}
                <rect className="sting__cliprect" {...s.clip} />
              </clipPath>
            ))}
          </defs>
          {/* The blueprint: the three contours as a faint hairline outline,
              there from first paint, so the space is never empty before the
              ink arrives. Static - the animated group settles into it. */}
          <g className="sting__ghost" aria-hidden="true">
            {SHAPES.map((s) => (
              <path key={`ghost-${s.id}`} d={s.d} />
            ))}
          </g>
          <g className="sting__g">
            {SHAPES.map((s) => (
              <path key={`echo-${s.id}`} className="sting__echo" d={s.d} />
            ))}
            {SHAPES.map((s) => (
              <path
                key={`fill-${s.id}`}
                className="sting__fill"
                d={s.d}
                clipPath={`url(#sting-clip-${s.id})`}
              />
            ))}
            {/* Traces above the fills; the orbit above the traces. */}
            {SHAPES.map((s) => (
              <path
                key={`trace-${s.id}`}
                className="sting__trace"
                d={s.d}
                fill="none"
                strokeWidth="26"
              />
            ))}
            {SHAPES.map((s) => (
              <path key={`orbit-${s.id}`} className="sting__orbit" d={s.d} fill="none" strokeWidth="36" />
            ))}
          </g>
        </svg>
      </div>

      <div className="sting__word" aria-label="Portara - Portals, MCP, Agents">
        <span className="sting__row" aria-hidden="true">
          {WORD.map((ch, i) => (
            <span className="sting__ch" key={i}>
              {ch}
            </span>
          ))}
        </span>
        <span className="sting__rule" aria-hidden="true" />
        <span className="sting__tag" aria-hidden="true">
          {TAG.map((ch, i) =>
            ch === " " ? (
              <span className="sting__sp" key={i} />
            ) : (
              <span className="sting__tch" key={i}>
                {ch}
              </span>
            ),
          )}
        </span>
      </div>
    </div>
  );
}
