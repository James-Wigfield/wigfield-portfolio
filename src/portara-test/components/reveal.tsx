/**
 * Scroll reveals for the landing page. Two primitives, both gsap +
 * ScrollTrigger, both once-only (a section that has arrived stays arrived),
 * both no-ops under prefers-reduced-motion.
 *
 * <RevealText>  - a heading whose LINES rise out of a mask, one after the
 *                 other, the way React Bits' SplitText does it for characters.
 *                 Uses gsap's own SplitText plugin (free since 3.13) so rich
 *                 children (the <span class="hl"> highlights) survive the
 *                 split, and re-splits itself if the lines rewrap on resize.
 *
 * <Reveal>      - a container whose direct children rise and fade in with a
 *                 stagger as it scrolls into view. Wrap a .stack, a list, a
 *                 grid of cards; nothing inside needs to know.
 */
import { createElement, useLayoutEffect, useRef, type ElementType, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const REDUCE = "(prefers-reduced-motion: reduce)";

type RevealTextProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Seconds between lines. */
  stagger?: number;
  /** ScrollTrigger start, default: when the top of the element passes 85% down the viewport. */
  start?: string;
};

export function RevealText({
  as = "h2",
  className,
  children,
  stagger = 0.09,
  start = "top 85%",
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia(REDUCE).matches) return;
    let split: SplitText | null = null;
    let cancelled = false;

    // Split only once the web fonts are in - Jost arriving after first paint
    // would rewrap every line and leave the masks around the wrong text.
    const go = () => {
      if (cancelled) return;
      split = SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "rv-line",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.1,
            ease: "expo.out",
            stagger,
            scrollTrigger: { trigger: el, start, once: true },
          }),
      });
    };
    if (document.fonts?.status === "loaded") go();
    else document.fonts?.ready.then(go);

    return () => {
      cancelled = true;
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === el) t.kill();
      });
      split?.revert();
    };
  }, [stagger, start]);

  return createElement(as, { ref, className: ["rv-text", className].filter(Boolean).join(" ") }, children);
}

type RevealProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Seconds between children. */
  stagger?: number;
  /** Starting offset in px. */
  y?: number;
  start?: string;
  /** Animate the element itself rather than its children. */
  self?: boolean;
};

export function Reveal({
  as = "div",
  className,
  children,
  stagger = 0.1,
  y = 28,
  start = "top 85%",
  self = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia(REDUCE).matches) return;
    const targets = self || el.children.length === 0 ? [el] : Array.from(el.children);
    const tween = gsap.fromTo(
      targets,
      { y, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.95,
        ease: "power3.out",
        stagger,
        clearProps: "transform",
        scrollTrigger: { trigger: el, start, once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [stagger, y, start, self]);

  return createElement(as, { ref, className }, children);
}
