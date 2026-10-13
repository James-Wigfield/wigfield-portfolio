import { useLayoutEffect, useRef } from 'react';

/* ============================================================================
   PLAIN DECK — SLIDE TIMELINES
   ----------------------------------------------------------------------------
   Each built slide has one build step and runs its own timeline, in seconds
   from the moment it becomes the current slide in present mode, entered
   forwards (or by a jump). Everything is drawn in its FINISHED state by
   default: going back, preview, thumb and export modes, reduced motion and
   the hidden previous and next slots never animate. When the slide is live,
   the timeline adds Web Animations (fill: backwards) before the first paint,
   so each element starts at its first keyframe and, when its track ends,
   falls back to its own CSS, which is the finished state. Leaving the slide
   cancels them all.

   track(el, keys)   one element: keyframes at absolute seconds, e.g.
                     [{ t: 18.5, opacity: 0 }, { t: 19.3, opacity: 1 }]; the
                     last keyframe must equal the element's CSS. `e` on a
                     keyframe sets the easing of the segment that starts there.
                     Two tracks on one element must animate different
                     properties (a later track's backwards fill would win).
   ========================================================================== */

export const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  soft: 'cubic-bezier(0.33, 1, 0.68, 1)',
  in: 'cubic-bezier(0.55, 0, 1, 0.45)',
  lin: 'linear',
};

/** True when this slide's timeline should play (see the header). */
export const isLive = (ctx) => ctx.mode === 'present' && ctx.phase === 'current' && !ctx.still && ctx.dir !== 'backward';

export function track(el, keys, ease = EASE.out) {
  if (!el || !el.animate || keys.length < 2) return null;
  const t0 = keys[0].t;
  const t1 = keys[keys.length - 1].t;
  const dur = Math.max(0.001, t1 - t0);
  const frames = keys.map(({ t, e, ...k }) => ({ ...k, offset: Math.min(1, Math.max(0, (t - t0) / dur)), easing: e ?? ease }));
  return el.animate(frames, { delay: t0 * 1000, duration: dur * 1000, fill: 'backwards' });
}

/* Common tracks. `at` is the start in seconds, `d` the duration. */
export const fadeIn = (el, at, d = 0.7) => track(el, [{ t: at, opacity: 0 }, { t: at + d, opacity: 1 }]);
export const fadeOut = (el, at, d = 0.6) => track(el, [{ t: at, opacity: 1 }, { t: at + d, opacity: 0 }], EASE.inOut);
export const rise = (el, at, d = 0.9, dy = 24) => track(el, [
  { t: at, opacity: 0, transform: `translateY(${dy}px)` },
  { t: at + d, opacity: 1, transform: 'translateY(0px)' },
]);
export const pop = (el, at, d = 0.5, s = 0.6) => track(el, [
  { t: at, opacity: 0, transform: `scale(${s})` },
  { t: at + d, opacity: 1, transform: 'scale(1)' },
]);
/** A stroke drawn on (CSS: pathLength="1", stroke-dasharray 1 or none at rest). */
export const draw = (el, at, d = 0.9) => track(el, [
  { t: at, strokeDasharray: '1 1', strokeDashoffset: 1 },
  { t: at + d, strokeDasharray: '1 1', strokeDashoffset: 0 },
], EASE.inOut);

/**
 * The slide's timeline. `build(root, add)` is a module-level function that finds
 * elements under root (by data-a marks) and calls add(track(...)) for each.
 * Returns the ref for the slide's root element.
 */
export function useTimeline(ctx, build) {
  const root = useRef(null);
  const live = isLive(ctx);
  useLayoutEffect(() => {
    const el = root.current;
    if (!live || !el) return undefined;
    const list = [];
    build(el, (a) => {
      if (a) list.push(a);
      return a;
    });
    return () => list.forEach((a) => a.cancel());
  }, [live, build]);
  return root;
}

/** Elements under root marked data-a="name" (one or all). */
export const one = (root, name) => root.querySelector(`[data-a="${name}"]`);
export const all = (root, name) => [...root.querySelectorAll(`[data-a="${name}"]`)];
