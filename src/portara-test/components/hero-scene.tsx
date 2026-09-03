/**
 * The opening scene: headline on the left, the brand mark on the right, and
 * THROUGH THE GATE into the portal on scroll.
 *
 * FIRST PAINT is never empty. The dot grid (React Bits DotGrid, alive to the
 * pointer) is on the canvas within a frame, the headline and eyebrow are
 * plain text with no entrance, and the mark's blueprint outline is already
 * drawn. The sting inks the mark in over that outline; once landed, an accent
 * segment keeps orbiting its contours (brand-sting.tsx).
 *
 * THE SCROLL. The Portara mark is a gate, so the page goes through it. The
 * scene pins for about 1.4 viewports and scroll drives one timeline:
 *
 *   - the headline slides off and the wordmark, outline and dot grid fade;
 *   - the ONE mark - the same element the sting drew - grows towards the
 *     viewer, its opening (the space between the pillars) centring on the
 *     viewport, until the pillars have slid off both edges;
 *   - the demo portal sits in its final place from the start and is only ever
 *     seen THROUGH the opening: its clip-path is the opening's rectangle,
 *     recomputed from the mark's live transform every frame, so the window
 *     onto the portal widens exactly as the gate does;
 *   - the tour itself mounts half-way through, so its camera begins on the
 *     dashboard as the gate clears rather than mid-flight, and a favicon of
 *     the mark fades into the browser chrome as the last beat.
 *
 * No second copy of the logo exists: what grows is what the sting drew. All
 * geometry comes from layout (offsetLeft/Top up the chain), never bounding
 * rects, so transforms in flight never skew the maths, and it re-measures on
 * refresh. Costs per frame: one transform, one stroke-width, one clip-path.
 *
 * Under 861px, or with prefers-reduced-motion, nothing pins: copy, mark,
 * then the tour, in a column.
 */
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import DotGrid from "../bits/DotGrid";
import Magnet from "../bits/Magnet";
import { Link } from "../shim/router";
import { BrandSting, GateMark } from "./brand-sting";
import { WorkspaceTour } from "./workspace-tour";
import { AS_OF } from "./workspace-tour-pages";

gsap.registerPlugin(ScrollTrigger);

/** Keep in step with the matching @media block in home-v2.css. */
const SCENE_MEDIA = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/* The gate's opening - the clear space between the pillars, under the top
   bar and above the lintel - as fractions of the mark's box. From the brand
   SVG: pillars' inner edges x=1737.95 and 2948.31, bar underside y=1471.9,
   lintel top y=3240.7, in a viewBox of 855 976 2980 2824. */
const OPEN = {
  l: (1737.95 - 855) / 2980,
  r: (2948.31 - 855) / 2980,
  t: (1471.9 - 976) / 2824,
  b: (3240.7 - 976) / 2824,
};
const ORIGIN = { x: (OPEN.l + OPEN.r) / 2, y: (OPEN.t + OPEN.b) / 2 };
/** How far past the viewport the opening must reach before the pillars are
    considered gone. */
const CLEARANCE = 1.15;

/** Layout box of `el` relative to `ancestor`, ignoring transforms. */
function layoutBox(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function headerHeight() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  return parseFloat(v) || 108;
}

export function HeroScene() {
  const sceneRef = useRef<HTMLElement>(null);
  const [settled, setSettled] = useState(false);
  // Desktop with motion mounts the tour half-way through the gate; everything
  // else has it from the start.
  const [showTour, setShowTour] = useState(
    () => typeof window === "undefined" || !window.matchMedia(SCENE_MEDIA).matches,
  );

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const mm = gsap.matchMedia();
    mm.add(SCENE_MEDIA, () => {
      const q = gsap.utils.selector(scene);
      const [hero] = q<HTMLElement>(".scene__hero");
      const [copy] = q<HTMLElement>(".scene__copy");
      const [word] = q<HTMLElement>(".sting__word");
      const [ghost] = q<HTMLElement>(".sting__ghost");
      const [mark] = q<HTMLElement>(".sting__mark");
      const orbits = q<SVGPathElement>(".sting__orbit");
      const [frame] = q<HTMLElement>(".scene__frame");
      const [fav] = q<HTMLElement>(".scene__favicon");
      const [cue] = q<HTMLElement>(".scene__cue-slot");
      const [dots] = q<HTMLElement>(".scene__dots");
      if (!hero || !copy || !mark || !frame || !fav) return;

      gsap.set(mark, { transformOrigin: `${ORIGIN.x * 100}% ${ORIGIN.y * 100}%` });

      // The scale at which the opening clears the viewport, and the translate
      // that puts the opening's centre at the centre of the visible area.
      const finalScale = () => {
        const m = layoutBox(mark, scene);
        const openW = m.w * (OPEN.r - OPEN.l);
        const openH = m.h * (OPEN.b - OPEN.t);
        const viewH = window.innerHeight - headerHeight();
        return Math.max((scene.clientWidth * CLEARANCE) / openW, (viewH * CLEARANCE) / openH);
      };
      const shift = () => {
        const m = layoutBox(mark, scene);
        const viewH = window.innerHeight - headerHeight();
        return {
          x: scene.clientWidth / 2 - (m.x + m.w * ORIGIN.x),
          y: viewH / 2 - (m.y + m.h * ORIGIN.y),
        };
      };

      // The window onto the portal: the opening, in the frame's own box.
      let mounted = showTour;
      const clipToOpening = (progress: number) => {
        // The gate has cleared: the window is the whole frame, and stays so
        // while the (hidden) mark is reset to scale 1 for the release.
        if (progress >= 0.97) {
          frame.style.clipPath = "inset(0px)";
          return;
        }
        const m = layoutBox(mark, scene);
        const f = layoutBox(frame, scene);
        const s = Number(gsap.getProperty(mark, "scale")) || 1;
        const tx = Number(gsap.getProperty(mark, "x")) || 0;
        const ty = Number(gsap.getProperty(mark, "y")) || 0;
        const cx = m.x + m.w * ORIGIN.x + tx;
        const cy = m.y + m.h * ORIGIN.y + ty;
        const hw = (m.w * (OPEN.r - OPEN.l) * s) / 2;
        const hh = (m.h * (OPEN.b - OPEN.t) * s) / 2;
        const top = Math.max(0, cy - hh - f.y);
        const right = Math.max(0, f.x + f.w - (cx + hw));
        const bottom = Math.max(0, f.y + f.h - (cy + hh));
        const left = Math.max(0, cx - hw - f.x);
        frame.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
        if (!mounted && progress >= 0.5) {
          mounted = true;
          setShowTour(true);
        }
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: scene,
          start: () => `top ${headerHeight()}`,
          end: () => `+=${Math.round(window.innerHeight * 1.4)}`,
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: () => clipToOpening(tl.progress()),
      });

      tl.to(copy, { x: -60, autoAlpha: 0, duration: 0.28, ease: "power2.in" }, 0)
        .to(cue, { autoAlpha: 0, duration: 0.1 }, 0)
        .to(ghost, { autoAlpha: 0, duration: 0.05 }, 0)
        .to(word, { autoAlpha: 0, y: -10, duration: 0.2, ease: "power2.in" }, 0.04)
        .to(dots, { autoAlpha: 0, duration: 0.3 }, 0.1)
        // The portal is in place from the first pixel of the opening.
        .to(frame, { autoAlpha: 1, duration: 0.02 }, 0.07)
        // The gate comes at you: the same mark, the same orbit, growing until
        // the pillars are off both edges. Its stroke thins as it grows so the
        // current stays a hairline on screen.
        .fromTo(
          mark,
          { scale: 1, x: 0, y: 0 },
          {
            scale: () => finalScale(),
            x: () => shift().x,
            y: () => shift().y,
            duration: 0.9,
            ease: "power1.in",
          },
          0.08,
        )
        .to(orbits, { attr: { "stroke-width": () => 36 / finalScale() }, duration: 0.9, ease: "power1.in" }, 0.08)
        .to(fav, { autoAlpha: 1, duration: 0.08 }, 0.9)
        // Gone, and back to scale 1 while hidden so a 15x mark cannot extend
        // the page once the pin lets go.
        .to(mark, { autoAlpha: 0, duration: 0.02 }, 0.98)
        .set(mark, { scale: 1, x: 0, y: 0 }, 1.0)
        .set(orbits, { attr: { "stroke-width": 36 } }, 1.0);

      clipToOpening(0);

      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      return () => {
        cancelled = true;
        tl.scrollTrigger?.kill();
        tl.kill();
        frame.style.clipPath = "";
      };
    });

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="scene" ref={sceneRef} aria-label="Portara">
      <div className={"scene__hero" + (settled ? " is-settled" : "")}>
        {/* Alive from the first frame: a dot grid that bends around the pointer. */}
        <DotGrid
          className="scene__dots"
          dotSize={2}
          gap={26}
          baseColor="#b9c2ca"
          activeColor="#ff4e2b"
          proximity={140}
          shockRadius={220}
          shockStrength={4}
          resistance={650}
          returnDuration={1.4}
        />

        <div className="container scene__grid">
          <div className="scene__copy">
            <span className="eyebrow">Custom staff portals · Perth</span>
            <h1 className="scene__title">
              Put your business on <span className="hl-sand">autopilot</span>.
            </h1>
            <p className="scene__lead">
              One portal, built for your business. Powered by Portlets, agents
              that do the work when you ask. Just talk. It runs.
            </p>
            <div className="scene__actions">
              <Magnet padding={48} magnetStrength={9} wrapperClassName="magnet">
                <a href="#request" className="btn btn--lg">
                  Request a meeting
                </a>
              </Magnet>
              <Magnet padding={48} magnetStrength={9} wrapperClassName="magnet">
                <Link to="/login" className="btn btn--ghost btn--lg">
                  Client log in
                </Link>
              </Magnet>
            </div>
            <ul className="scene__facts minilabel">
              <li>Fixed pricing</li>
              <li>No lock-in</li>
              <li>Built in Perth</li>
            </ul>
          </div>

          {/* The mark, freestanding on the grid. On scroll it is the gate. */}
          <div className="scene__stage">
            <BrandSting onSettled={() => setSettled(true)} />
          </div>
        </div>

        <div className="scene__cue-slot">
          <div className="scene__cue" aria-hidden="true">
            <span>Scroll</span>
            <i />
          </div>
        </div>
      </div>

      <div className="scene__frame">
        {/* The mark's last beat: a favicon beside the tour's URL bar. */}
        <span className="scene__favicon" aria-hidden="true">
          <GateMark />
        </span>
        {showTour ? (
          <WorkspaceTour />
        ) : (
          // The same window, empty, until the gate is half open: the tour
          // then mounts and begins on its dashboard as the pillars clear.
          <div className="tour scene__placeholder" aria-hidden="true">
            <div className="tour__frame">
              <div className="tour__chrome">
                <span className="tour__dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="tour__url">demo-industrial-contractor.portara.com.au</span>
              </div>
              <div className="tour__stage scene__skeleton">
                <div className="scene__skeleton-rail" />
                <div className="scene__skeleton-main">
                  <i className="is-title" />
                  <i />
                  <span className="scene__skeleton-tiles">
                    <b />
                    <b />
                    <b />
                    <b />
                  </span>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        )}
        <p className="scene__caption">
          <span className="scene__caption-tick" aria-hidden="true" />A client
          portal, live. Demo account, snapshot {AS_OF}.
        </p>
      </div>
    </section>
  );
}
