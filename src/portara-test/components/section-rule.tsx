/**
 * The section boundary. A hairline that runs the full width of the viewport
 * (not just the container) and draws itself left to right as the section
 * scrolls in, with the section's title settling in beneath its left end.
 * Every section opens with one, and sections alternate page and surface
 * backgrounds (home-v2.css), so a boundary is a line AND a tone change.
 *
 * Reduced motion: the line is simply there.
 */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SectionRule({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const line = el.querySelector(".rule2__line");
    const label = el.querySelector(".rule2__title");
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
    if (line) {
      tl.fromTo(
        line,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.1, ease: "expo.out", transformOrigin: "left center" },
        0,
      );
    }
    if (label) {
      tl.fromTo(label, { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" }, 0.15);
    }
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <div className="rule2" ref={ref}>
      <span className="rule2__line" aria-hidden="true" />
      <span className="rule2__title">{title}</span>
    </div>
  );
}
