import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin);

/* ============================================================================
   COURTNEY'S SLIDES — MOTION ENGINE
   ----------------------------------------------------------------------------
   Every slide owns ONE paused GSAP master timeline, built once on mount.
   A slide is a list of beats (the clicks a presenter makes). Beat k adds its
   motion to its own sub-timeline; the master gets a label `e{k}` where beat k
   ends. So "the slide at beat k" is simply the master seeked to `e{k}`:

     forward one beat, live  ->  tween the playhead from e{k-1} to e{k}
     anything else           ->  seek straight to e{k} (no motion)

   That makes going back, jumping, thumbnails, print and reduced motion all
   exact: they are the same frames the animation ends on.

   Parametric art (the lattice, the rig, the remodelling surface) keeps its
   numbers in a state object S; tweens move S and `render(S, el)` redraws.
   `ambient` is an optional loop that runs while a beat is live and stops
   (reverting what it touched) when the beat changes.
   ========================================================================== */

export { gsap };

export const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Delay before beat 0 starts, so the slide wipe is mostly across first. */
const ENTER_DELAY = 0.32;

/**
 * @param {{beat:number, live:boolean}} ctx  from the deck
 * @param {{beats:Function[], state?:Function, render?:Function, ambient?:Function}} cfg  module-level constant
 */
export function useSlide({ beat, live }, cfg) {
  const root = useRef(null);
  const api = useRef(null);
  const prev = useRef(-1);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const S = cfg.state ? cfg.state(el) : {};
    const draw = () => cfg.render?.(S, el);
    let master;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      master = gsap.timeline({ paused: true, onUpdate: draw });
      cfg.beats.forEach((fn, k) => {
        const t = gsap.timeline();
        fn(t, q, S, el);
        if (t.duration() === 0) t.to({}, { duration: 0.01 });
        master.add(t);
        master.addLabel(`e${k}`);
      });
    }, el);
    api.current = { master, S, draw, el, player: null };
    prev.current = -1;
    return () => {
      api.current?.player?.kill();
      ctx.revert();
      api.current = null;
    };
  }, [cfg]);

  useLayoutEffect(() => {
    const a = api.current;
    if (!a) return;
    a.player?.kill();
    a.player = null;
    const from = prev.current;
    prev.current = beat;
    const target = `e${Math.min(beat, cfg.beats.length - 1)}`;
    if (live && !reduced() && beat === from + 1) {
      a.master.seek(from < 0 ? 0 : `e${from}`, false);
      a.draw();
      a.player = a.master.tweenTo(target, { ease: 'none', delay: from < 0 ? ENTER_DELAY : 0 });
    } else {
      a.master.seek(target, false);
      a.draw();
    }
  }, [beat, live, cfg]);

  useLayoutEffect(() => {
    const a = api.current;
    if (!a || !cfg.ambient || !live || reduced()) return undefined;
    const delay = a.player ? a.player.duration() + (a.player.vars.delay ?? 0) : 0;
    const ctx = gsap.context(() => {
      cfg.ambient({ q: gsap.utils.selector(a.el), S: a.S, beat, draw: a.draw, delay, el: a.el });
    }, a.el);
    return () => {
      ctx.revert();
      // put parametric art back on the master's frame
      if (api.current) {
        api.current.master.seek(api.current.master.time(), false);
        api.current.draw();
      }
    };
  }, [beat, live, cfg]);

  return root;
}

/* ── Common tweens. Each returns a tween to drop into a beat's timeline. ── */

export const E = {
  out: 'expo.out',
  io: 'expo.inOut',
  soft: 'power3.out',
  pop: 'back.out(1.7)',
  sine: 'sine.inOut',
};

/** Words of a <Words> line rising out of their masks. */
export function wordsIn(t, targets, at = 0, { stagger = 0.045, d = 0.9 } = {}) {
  if (!targets || (targets.length === 0)) return t;
  return t.fromTo(targets, { yPercent: 118 }, { yPercent: 0, duration: d, ease: E.out, stagger }, at);
}

export function rise(t, targets, at = 0, { y = 28, d = 0.8, stagger = 0.06 } = {}) {
  if (!targets || targets.length === 0) return t;
  return t.fromTo(targets, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: d, ease: E.out, stagger }, at);
}

export function fade(t, targets, at = 0, { d = 0.6, stagger = 0 } = {}) {
  if (!targets || targets.length === 0) return t;
  return t.fromTo(targets, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power1.out', stagger }, at);
}

export function pop(t, targets, at = 0, { s = 0.4, d = 0.6, stagger = 0.06 } = {}) {
  if (!targets || targets.length === 0) return t;
  return t.fromTo(
    targets,
    { autoAlpha: 0, scale: s, transformOrigin: '50% 50%' },
    { autoAlpha: 1, scale: 1, duration: d, ease: E.pop, stagger },
    at,
  );
}

/** Strokes drawn on. */
export function draw(t, targets, at = 0, { d = 1, stagger = 0, ease = 'power2.inOut' } = {}) {
  if (!targets || targets.length === 0) return t;
  return t.fromTo(targets, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease, stagger }, at);
}

/** Horizontal rules growing from the left. */
export function grow(t, targets, at = 0, { d = 0.9, stagger = 0.05, origin = '0% 50%' } = {}) {
  if (!targets || targets.length === 0) return t;
  return t.fromTo(targets, { scaleX: 0, transformOrigin: origin }, { scaleX: 1, duration: d, ease: E.io, stagger }, at);
}

/** Count a number up inside an element, keeping the final text exact. */
export function count(t, el, to, at = 0, { d = 1.2, decimals = 0, prefix = '', suffix = '' } = {}) {
  if (!el) return t;
  const o = { v: 0 };
  const fmt = (v) => `${prefix}${v.toFixed(decimals)}${suffix}`;
  return t.fromTo(o, { v: 0 }, {
    v: to,
    duration: d,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = fmt(o.v); },
    onComplete: () => { el.textContent = fmt(to); },
    onReverseComplete: () => { el.textContent = fmt(0); },
  }, at);
}

/** The standard frame entrance: section label, title words, the top rule. */
export function frameIn(t, q, at = 0) {
  grow(t, q('[data-f="rule"]'), at, { d: 1.1 });
  rise(t, q('[data-f="kicker"]'), at + 0.05, { y: 14, d: 0.6 });
  wordsIn(t, q('[data-f="title"] .cs-wi'), at + 0.12);
  fade(t, q('[data-f="foot"]'), at + 0.5, { d: 0.6 });
  return t;
}
