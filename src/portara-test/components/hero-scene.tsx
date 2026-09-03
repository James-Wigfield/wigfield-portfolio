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
 * THE JUMP. The Portara mark is a gate, so the page goes through it - and it
 * goes at once. The scene is pinned for one viewport of scroll, but nothing
 * is scrubbed: the moment the visitor scrolls past a small threshold the gate
 * PLAYS - three quarters of a second: the gate is gone in 0.4s and the portal
 * snaps to size behind it - and the page is driven to the end of the pin over
 * the same span with wheel, touch and key input held until it lands. There
 * is no speed at which you can stop half-way through a fifteen-times logo.
 * Scrolling back up out of the portal does the same in reverse: the gate
 * closes and the hero is back.
 *
 *   - the headline slides off and the wordmark, outline and dot grid fade;
 *   - the ONE mark - the same element the sting drew - grows towards the
 *     viewer, its opening (the space between the pillars) centring on the
 *     viewport, until the pillars have slid off both edges;
 *   - the demo portal sits in its final place from the start and is only ever
 *     seen THROUGH the opening: its clip-path is the opening's rectangle,
 *     recomputed from the mark's live transform every frame;
 *   - the tour itself mounts a third of the way in, so its camera begins on
 *     the dashboard as the gate clears, and a favicon of the mark fades into
 *     the browser chrome as the last beat.
 *
 * No second copy of the logo exists: what grows is what the sting drew. All
 * geometry comes from layout (offsetLeft/Top up the chain), never bounding
 * rects, so transforms in flight never skew the maths, and it re-measures on
 * refresh. Costs per frame: one transform, one stroke-width, one clip-path.
 *
 * Under 861px, or with prefers-reduced-motion, nothing pins and nothing
 * jumps: copy, mark, then the tour, in a column.
 */
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import DotGrid from "../bits/DotGrid";
import Magnet from "../bits/Magnet";
import { Link } from "../shim/router";
import { BrandSting, GateMark } from "./brand-sting";
import { WorkspaceTour } from "./workspace-tour";
import { AS_OF } from "./workspace-tour-pages";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

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
/** Scroll progress through the pin that commits the jump (down) and the
    return (up). Down is a nudge; up wants a clearer intent. */
const GO_DOWN_AT = 0.05;
const GO_UP_AT = 0.88;
/** Timeline seconds: when the gate has cleared the viewport (the window
    becomes the whole frame), and when the tour is mounted into it. */
const T_CLEAR = 0.44;
const T_MOUNT = 0.15;

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

/** Hold the page still while the jump plays: wheel, touch and scroll keys. */
function holdInput() {
  const block = (e: Event) => e.preventDefault();
  const keys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);
  const blockKeys = (e: KeyboardEvent) => {
    if (keys.has(e.key)) e.preventDefault();
  };
  window.addEventListener("wheel", block, { passive: false });
  window.addEventListener("touchmove", block, { passive: false });
  window.addEventListener("keydown", blockKeys);
  return () => {
    window.removeEventListener("wheel", block);
    window.removeEventListener("touchmove", block);
    window.removeEventListener("keydown", blockKeys);
  };
}

export function HeroScene() {
  const sceneRef = useRef<HTMLElement>(null);
  const [settled, setSettled] = useState(false);
  // Desktop with motion mounts the tour part-way through the gate; everything
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
      const clipToOpening = (time: number) => {
        // The gate has cleared: the window is the whole frame, and stays so
        // while the (hidden) mark is reset to scale 1 for the release.
        if (time >= T_CLEAR) {
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
        if (!mounted && time >= T_MOUNT) {
          mounted = true;
          setShowTour(true);
        }
      };

      // The rush, in seconds. Paused; played forward or in reverse by the
      // trigger below. EVERY tween states both of its ends: the timeline is
      // invalidated before each run so the function-based values re-read the
      // layout, and a plain .to() would then re-record its start from
      // whatever state it found - on the way back that was a hidden mark at
      // scale 1, and the return rendered nothing but the window.
      const still = { immediateRender: false };
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "none" },
        onUpdate: () => clipToOpening(tl.time()),
      });
      // Scroll, and you are through: the whole rush is three quarters of a
      // second. The gate takes 0.4s of it on a cubic ease-in, so it is nearly
      // still for the first tenth and then simply gone; the portal, a touch
      // large underneath, snaps to size on an exponential ease-out - the
      // short, hard stop on the far side.
      tl.fromTo(copy, { x: 0, autoAlpha: 1 }, { x: -60, autoAlpha: 0, duration: 0.18, ease: "power2.in" }, 0)
        .fromTo(cue, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.08 }, 0)
        .fromTo(ghost, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.04 }, 0)
        .fromTo(word, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -10, duration: 0.14, ease: "power2.in" }, 0.02)
        .fromTo(dots, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, 0.04)
        // The portal is in place from the first pixel of the opening. (The
        // pillars cover any spill outside the opening while it is oversize.)
        .fromTo(frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02, ...still }, 0.03)
        .fromTo(frame, { scale: 1.08 }, { scale: 1, duration: 0.7, ease: "expo.out", ...still }, 0.05)
        // The gate comes at you - the same mark, the same orbit, growing until
        // the pillars are off both edges. Its stroke thins as it grows so the
        // current stays a hairline on screen.
        .fromTo(
          mark,
          { scale: 1, x: 0, y: 0 },
          {
            scale: () => finalScale(),
            x: () => shift().x,
            y: () => shift().y,
            duration: 0.4,
            ease: "power3.in",
          },
          0.04,
        )
        .fromTo(
          orbits,
          { attr: { "stroke-width": 36 } },
          { attr: { "stroke-width": () => 36 / finalScale() }, duration: 0.4, ease: "power3.in" },
          0.04,
        )
        // Through. The mark is gone, then put back to scale 1 while hidden so
        // a fifteen-times logo cannot extend the page once the pin lets go.
        .fromTo(mark, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, ...still }, T_CLEAR + 0.01)
        .fromTo(
          mark,
          { scale: () => finalScale(), x: () => shift().x, y: () => shift().y },
          { scale: 1, x: 0, y: 0, duration: 0.001, ...still },
          T_CLEAR + 0.05,
        )
        .fromTo(
          orbits,
          { attr: { "stroke-width": () => 36 / finalScale() } },
          { attr: { "stroke-width": 36 }, duration: 0.001, ...still },
          T_CLEAR + 0.05,
        )
        .fromTo(fav, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ...still }, T_CLEAR);
      const RUSH = tl.duration();

      // Where the page is: at the hero, at the portal, or in flight.
      let state: "hero" | "portal" | "flight" = "hero";
      let release: (() => void) | null = null;
      let ride: gsap.core.Tween | null = null;

      const html = document.documentElement;
      const jump = (to: "portal" | "hero", st: ScrollTrigger) => {
        state = "flight";
        release?.();
        release = holdInput();
        ride?.kill();
        // home.css asks the page for smooth scrolling; a tween setting the
        // position every frame would only ever restart that smooth glide, so
        // the ride is instant-stepped for its duration and smooth again after.
        const smooth = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        // Leaving the hero re-reads the layout (function-based values) and
        // re-records every tween's resting state, which is exactly the hero at
        // rest. The return must NOT invalidate: the later tweens are created
        // without immediateRender, and GSAP takes their "before" state from
        // the moment they first render - on a reversed, invalidated timeline
        // that is the portal end, and the hero would come back with the mark
        // hidden and the window still open.
        if (to === "portal") {
          tl.invalidate();
          tl.play();
        } else {
          tl.reverse();
        }
        ride = gsap.to(window, {
          scrollTo: { y: to === "portal" ? st.end : st.start, autoKill: false },
          duration: RUSH,
          ease: "power2.inOut",
          onComplete: () => {
            state = to;
            html.style.scrollBehavior = smooth;
            release?.();
            release = null;
          },
        });
      };

      const st = ScrollTrigger.create({
        trigger: scene,
        start: () => `top ${headerHeight()}`,
        end: () => `+=${Math.round(window.innerHeight)}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (state === "hero" && self.direction > 0 && self.progress > GO_DOWN_AT) jump("portal", self);
          else if (state === "portal" && self.direction < 0 && self.progress < GO_UP_AT) jump("hero", self);
        },
        // A reload part-way down the page lands on the side it is nearest.
        onRefresh: (self) => {
          if (state !== "flight") {
            const atPortal = self.progress >= 0.5;
            tl.progress(atPortal ? 1 : 0);
            state = atPortal ? "portal" : "hero";
          }
        },
      });

      clipToOpening(0);

      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      return () => {
        cancelled = true;
        ride?.kill();
        release?.();
        st.kill();
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
          // The same window, with a quiet skeleton of a portal page, until the
          // gate is a third open: the tour then mounts and begins on its
          // dashboard as the pillars clear.
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
