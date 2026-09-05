/**
 * The header appears from under the title, once the title has scrolled past.
 *
 * At the top of the page there is no header: the hero has the whole viewport.
 * The bar sits pinned at the top the whole time but is only drawn BELOW the
 * bottom edge of the PORTARA letters, so nothing shows while the word is
 * lower on the screen, and as the word scrolls up through the header's band
 * the bar is uncovered beneath it, strip by strip, its contents rising into
 * place as the letters lift away. When the word has gone the header is whole
 * and stays for the rest of the scroll, the page passing beneath it, blurred
 * through the glass. Scroll back up and the word covers it again.
 *
 * The hero publishes the letters' bottom edge (viewport y) every frame
 * through setNavSource(); a page with no source (the 2D hero, a hero still
 * loading) gets the plain version: hidden above the viewport, sliding down on
 * a light spring once the page has scrolled half a screen. Desktop only: on
 * a phone the header is always there, so the menu is always reachable.
 */
import { useEffect, type RefObject } from "react";

let source: number | null = null;

/** The viewport y of the edge the header appears from under, or null. */
export function setNavSource(y: number | null) {
  source = y;
}

const MEDIA = "(min-width: 861px)";
const REDUCE = "(prefers-reduced-motion: reduce)";
/* Plain version: how far the page scrolls before the bar comes down. */
const PLAIN_AT = 0.5; // of the viewport height
/* The spring for the plain version: stiffness and damping ratio. */
const STIFF = 260;
const ZETA = 0.82;
/* How far the contents ride below their place while being uncovered, as a
   fraction of the uncovered distance: they rise as the letters lift. */
const LIFT = 0.35;

export function useNavReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia(MEDIA);
    const show = () => {
      el.style.setProperty("--nav-y", "0px");
      el.style.setProperty("--nav-clip", "0px");
      el.style.setProperty("--nav-lift", "0px");
      el.classList.remove("is-hidden", "is-lifting", "is-docked");
    };
    if (window.matchMedia(REDUCE).matches) {
      show();
      return;
    }

    let raf = 0;
    let y = NaN;
    let v = 0;
    let mode: "source" | "plain" | "off" = "off";
    let last = performance.now();
    const damping = 2 * Math.sqrt(STIFF) * ZETA;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!mq.matches) {
        if (mode !== "off") {
          mode = "off";
          show();
        }
        return;
      }

      const h = el.offsetHeight;
      const src = source;
      let clip = 0;
      let lift = 0;
      let hidden: boolean;
      let docked: boolean;

      if (src !== null) {
        // Pinned at the top; only the part below the word's bottom edge exists.
        mode = "source";
        y = 0;
        v = 0;
        clip = Math.min(h, Math.max(0, src));
        lift = clip * LIFT;
        hidden = clip >= h - 0.5;
        docked = clip <= 0.5;
      } else {
        const target = window.scrollY > window.innerHeight * PLAIN_AT ? 0 : -h - 8;
        if (mode !== "plain" || Number.isNaN(y)) {
          mode = "plain";
          y = target;
          v = 0;
        } else {
          const a = STIFF * (target - y) - damping * v;
          v += a * dt;
          y += v * dt;
        }
        hidden = y <= -h;
        docked = target === 0 && Math.abs(y) < 1.5 && Math.abs(v) < 40;
      }

      el.style.setProperty("--nav-y", `${y.toFixed(2)}px`);
      el.style.setProperty("--nav-clip", `${clip.toFixed(2)}px`);
      el.style.setProperty("--nav-lift", `${lift.toFixed(2)}px`);
      el.classList.toggle("is-hidden", hidden);
      el.classList.toggle("is-docked", docked);
      el.classList.toggle("is-lifting", !hidden && !docked);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}
