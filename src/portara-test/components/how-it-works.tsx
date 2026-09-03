/**
 * How it works, as a flow line.
 *
 * One accent line runs the length of the section, curving gently from step to
 * step and threading through each step's numeral. It DRAWS ITSELF as you
 * scroll (stroke-dashoffset, scrubbed), and as each step comes up its numeral
 * fills with ink from the bottom and its card rises into place - also
 * scrubbed, so everything is tied 1:1 to the scroll position. Nothing fires
 * on a threshold, nothing can be missed by a fast scroll, and there are no
 * filters or sticky elements to repaint: transforms, opacity, one clip-path
 * and one dash offset.
 *
 * Desktop: the line runs down the middle and the cards alternate left and
 * right of it. Narrow: the line runs down the left, cards to the right. The
 * path is built from the numerals' measured positions, so it always passes
 * through them whatever the wrap, and is rebuilt on resize.
 *
 * Reduced motion: the CSS defaults ARE the finished frame (line drawn, ink
 * full, cards in place); no tweens are made.
 */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RevealText } from "./reveal";

gsap.registerPlugin(ScrollTrigger);

export type Step = {
  kicker: string;
  title: string;
  body: string;
};

export const STEPS: Step[] = [
  {
    kicker: "Discovery",
    title: "We meet",
    body: "A free 30-minute chat about how your business runs and where the busywork is. No jargon, no obligation.",
  },
  {
    kicker: "Design and build",
    title: "We build your portal",
    body: "We design a portal around your data and agree exactly which tools go in it, then build it. Fixed pricing, no lock-in.",
  },
  {
    kicker: "Automation",
    title: "We hire your Portlets",
    body: "We set up the agents your business actually needs: the one that logs every lead, the one that chases the quote, the one that has Monday's report ready. Each is scoped to exactly the tools it should touch, and nothing else.",
  },
  {
    kicker: "Launch",
    title: "You go live with Claude",
    body: "Your team logs in, gets connected to Claude, and the whole portal can be run just by asking. You deal with us directly for as long as you're with us.",
  },
];

type Pt = { x: number; y: number };

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

/**
 * A smooth line from the top edge, through every point, to the bottom edge.
 * Each segment is a cubic whose controls sit `bulge` to one side, alternating
 * sides segment to segment - which makes the tangents agree at every point,
 * so the joins are seamless and the whole thing reads as one stroke.
 */
function flowPath(points: Pt[], height: number, bulge: number) {
  if (!points.length) return "";
  const stops: Pt[] = [{ x: points[0].x, y: 0 }, ...points, { x: points[points.length - 1].x, y: height }];
  let d = `M ${stops[0].x} ${stops[0].y}`;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const dir = i % 2 === 0 ? 1 : -1;
    const lean = (b.y - a.y) * 0.38;
    d += ` C ${a.x + dir * bulge} ${a.y + lean}, ${b.x + dir * bulge} ${b.y - lean}, ${b.x} ${b.y}`;
  }
  return d;
}

export function HowItWorks() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = gsap.utils.selector(root);
    const [flow] = q<HTMLElement>(".how__flow");
    const [svg] = q<SVGSVGElement>(".how__path");
    const [bg] = q<SVGPathElement>(".how__path-bg");
    const [ink] = q<SVGPathElement>(".how__path-ink");
    const nodes = q<HTMLElement>(".how__node");
    const steps = q<HTMLElement>(".how__step");
    if (!flow || !svg || !bg || !ink) return;

    // The path, from where the numerals actually are. Returns the ink length
    // so the draw tween can re-read it on refresh.
    let length = 0;
    const build = () => {
      const w = flow.clientWidth;
      const h = flow.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const pts = nodes.map((n) => {
        const b = layoutBox(n, flow);
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      });
      const bulge = w > 860 ? 56 : 16;
      const d = flowPath(pts, h, bulge);
      bg.setAttribute("d", d);
      ink.setAttribute("d", d);
      length = ink.getTotalLength();
      return length;
    };

    const mm = gsap.matchMedia();
    mm.add(
      { reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" },
      (ctx) => {
        build();
        if (ctx.conditions?.reduce) return; // finished frame, from the CSS

        gsap.set(ink, { strokeDasharray: () => length });
        const draw = gsap.fromTo(
          ink,
          { strokeDashoffset: () => length },
          {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: {
              trigger: flow,
              start: "top 72%",
              end: "bottom 58%",
              scrub: 0.5,
              invalidateOnRefresh: true,
            },
          },
        );

        const tweens = steps.map((step) => {
          const card = step.querySelector<HTMLElement>(".how__card");
          const fill = step.querySelector<HTMLElement>(".how__num-ink");
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: step, start: "top 84%", end: "top 46%", scrub: 0.5 },
          });
          if (card) tl.fromTo(card, { y: 44, opacity: 0 }, { y: 0, opacity: 1 }, 0);
          if (fill) tl.fromTo(fill, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)" }, 0.15);
          return tl;
        });

        // Re-thread the line if the layout changes (resize, fonts landing).
        let raf = 0;
        const refresh = () => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            build();
            gsap.set(ink, { strokeDasharray: length });
            ScrollTrigger.refresh();
          });
        };
        const ro = new ResizeObserver(refresh);
        ro.observe(flow);
        document.fonts?.ready.then(refresh);

        return () => {
          ro.disconnect();
          cancelAnimationFrame(raf);
          draw.scrollTrigger?.kill();
          draw.kill();
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <section id="how" className="section how" ref={rootRef}>
      <div className="container">
        <div className="how__head">
          <span className="eyebrow">How it works</span>
          <RevealText className="how__title">From first chat to live portal.</RevealText>
          <p className="lead how__lead">
            Four steps, one team, no handover. Here is what happens between the
            first conversation and your staff logging in.
          </p>
        </div>

        <div className="how__flow">
          <svg className="how__path" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className="how__path-bg" />
            <path className="how__path-ink" />
          </svg>

          <ol className="how__steps">
            {STEPS.map((s, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <li key={s.title} className="how__step">
                  <span className="how__node" aria-hidden="true">
                    <span className="how__num-outline">{n}</span>
                    <span className="how__num-ink">{n}</span>
                  </span>
                  <div className="how__card">
                    <span className="how__kicker minilabel">
                      <span className="visually-hidden">Step {i + 1}: </span>
                      {s.kicker}
                    </span>
                    <h3 className="how__step-title">{s.title}</h3>
                    <p className="how__body">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
