import gsap from 'gsap';
import { WAVE_SPAN } from './overlay';

/* ============================================================================
   PSMA MOTION — MASTER TIMELINE
   ----------------------------------------------------------------------------
   One paused GSAP timeline per case. It tweens a plain state object; StageView
   turns that state into a frame (WebGL + canvas + DOM) in drawFrame(). So a
   frame is a pure function of timeline time, and seek(t) is exact.

   Seek safety: every property is animated by fromTo tweens whose `from` equals
   the previous tween's `to` for that property (checked by T() in dev), so the
   value at any time is the same whichever direction the playhead arrived from.
   Tweens use immediateRender: false because they share one state object:
   immediateRender would apply a later tween's start value at build time.
   Rotation runs 0 -> 360 (beat 1) -> 720 (beat 3) and is read modulo 360.

   Beats (each ends on a hold James can talk over):
     case A: scan · model · ensemble · threshold · prediction · truth · accuracy
     case B: scan · model · prediction · truth · accuracy
   Case A carries the full method in three stops: "model" (clip 2a) ends on the
   network, "ensemble" (2b) on the open fan of five models, "threshold" (2c) on
   the size filter. Case B tells the method in one condensed beat of about 5 s
   (no window rectangle, no network, a single averaged card), as the storyboard
   asks; its other beats match A's.

   Text never crossfades in place: the outgoing line finishes (0.25 s) before
   the incoming one starts.
   ========================================================================== */

const OUT = 0.25; // text exit
const IN_AT = 0.3; // incoming text starts this long after the outgoing one
const POP_S = 0.3; // each found ring's pop lasts this long

export function initialState(unfiltered) {
  return {
    angle: 0, layout: 0,
    body: 0, bone: 0, pet: 0, dim: 0,
    rule: 0,
    b1: 0, b1rule: 0, b1ct: 0, b1pet: 0, labels: 0,
    panel: 0, t2: 0, t2b: 0,
    win: 0, winA: 0, inset: 0, fov: 0, schem: 0, schemDim: 0, pulse: 0, winDim: 0,
    heat: 0, heatMean: 0, cover: 1,
    cards: 0, fan: 0, merge: 0, cardsT: 0, avgT: 0,
    thresh: 0, wipe: 0, threshT: 0, removed: 1, removedRing: 0, filterT: 0, regions: unfiltered,
    t3: 0, pred: 0, edge: 0, predMk: 0, predMkA: 0, count3: 0,
    t4: 0, gt: 0, gtT: 0, gtRingA: 0, gtTrace: 0, verdict: 0, foundDim: 0, foundWave: 0,
    nFound: 0, nMissed: 0, nFa: 0, legend: 0, rowM: 0, rowF: 0, ruleT: 0, mergedT: 0, nearT: 0,
    t5: 0, card: 0, metrics: 0, ctxT: 0, selT: 0,
  };
}

export function buildTimeline(data, S, { condensed, dims = { model: 0, masks: 0.3, card: 0.15 }, labels = false }) {
  const m = data.manifest;
  const num = (k) => m.numbers.find((e) => e.key === k).value;
  const nWin = data.windows.n;
  const nPred = num('case.n_pred');
  const nUnfiltered = num('case.n_pred_unfiltered');
  const nGt = num('case.n_gt');
  const nFound = num('case.tp');
  const nMissed = num('case.fn');
  const nFa = num('case.fp');
  const merged = nFound > num('case.pred_components_touching');
  const nearMiss = data.components.gt.some((c) => c.overlaps_found_region_angle0);
  const tl = gsap.timeline({ paused: true });
  const last = {};
  const cues = {};

  // fromTo on the state object, with the continuity check described above
  const T = (prop, from, to, at, dur, ease = 'power2.inOut') => {
    if (import.meta.env.DEV && prop in last && Math.abs(last[prop] - from) > 1e-9) {
      console.warn(`[psma-motion] ${prop}: tween at ${at.toFixed(2)}s starts at ${from}, previous ended at ${last[prop]}`);
    }
    last[prop] = to;
    tl.fromTo(S, { [prop]: from }, { [prop]: to, duration: dur, ease, immediateRender: false }, at);
  };
  const beats = [];
  const beat = (name, start, end) => {
    beats.push({ name, start, end });
    tl.addLabel(name, start);
  };
  // Beat boundaries sit on whole 0.1 s steps, i.e. whole frames at 30 and 60 fps, so
  // the last frame of one beat clip is exactly the first frame of the next.
  const snap = (v) => Math.ceil(v * 10 - 1e-6) / 10;
  // the gold chapter rule under the panel eyebrow re-draws at every chapter change
  const chapterRule = (at) => {
    T('rule', 1, 0, at, 0.15, 'power2.in');
    T('rule', 0, 1, at + IN_AT, 0.55, 'expo.out');
  };

  // ---- beat 1: the scan -------------------------------------------------------------
  let t = 0;
  T('b1rule', 0, 1, t + 0.2, 0.55, 'expo.out');
  T('b1', 0, 1, t + 0.3, 0.9, 'power2.out');
  T('body', 0, 1, t + 0.2, 1.0, 'power1.out');
  T('bone', 0, 1, t + 0.3, 1.2, 'power2.out');
  T('b1ct', 0, 1, t + 0.5, 0.6, 'power2.out');
  T('pet', 0, 1, t + 1.4, 1.4, 'power1.inOut');
  T('b1pet', 0, 1, t + 1.6, 0.6, 'power2.out');
  T('bone', 1, 0.7, t + 1.8, 1.2, 'power1.inOut');
  T('angle', 0, 360, t + 2.4, 6.0, 'sine.inOut');
  if (labels) {
    // optional (?labels=1): the organs that take the tracer up normally, labelled once the
    // body faces front
    T('labels', 0, 1, t + 8.3, 0.6, 'power2.out');
    t = snap(t + 9.4);
  } else {
    t = snap(t + 8.8);
  }
  beat('scan', 0, t);

  // ---- beat 2a: running the model ----------------------------------------------------
  const b2 = t;
  cues.glide = t + 0.1;
  if (labels) T('labels', 1, 0, t, 0.3, 'power2.in');
  T('b1', 1, 0, t, 0.4, 'power2.in');
  T('b1rule', 1, 0, t, 0.3, 'power2.in');
  T('b1ct', 1, 0, t, 0.3, 'power2.in');
  T('b1pet', 1, 0, t, 0.3, 'power2.in');
  T('layout', 0, 1, t + 0.1, 1.1, 'power2.inOut');
  T('panel', 0, 1, t + 0.4, 0.7, 'power2.out');
  T('rule', 0, 1, t + 0.6, 0.55, 'expo.out');
  T('t2', 0, 1, t + 0.6, 0.7, 'power2.out');
  // the scan steps back once the model's output starts to draw over it
  T('dim', 0, dims.model, t + 0.9, 0.6, 'power2.inOut');
  if (!condensed) {
    T('fov', 0, 1, t + 1.0, 0.5, 'power2.out');
    T('inset', 0, 1, t + 1.0, 0.6, 'power2.out');
    T('winA', 0, 1, t + 1.1, 0.4, 'power2.out');
    T('heat', 0, 1, t + 1.1, 0.4, 'power2.out');
    // the first four windows slowly, so the counter can be read; the fifth holds
    const ts = t + 1.4;
    T('win', 0, 4, ts, 1.6, 'none');
    // the network: one pulse down the encoder and back up the decoder, then a stop; the
    // window block steps back while the pulse runs, so the stop is about the network
    T('schem', 0, 1, ts + 1.2, 0.6, 'power2.out');
    T('pulse', 0, 1, ts + 1.8, 1.7, 'power1.inOut');
    T('winDim', 0, 1, ts + 1.8, 0.5, 'power2.inOut');
    t = snap(ts + 3.5 + 0.6);
    beat('model', b2, t);
  }

  // ---- beat 2b: five models, one answer ---------------------------------------------
  const b2b = t;
  let tc;
  if (!condensed) {
    // focus swaps back: the network steps back, the window block returns
    T('schemDim', 0, 1, t, 0.4, 'power2.inOut');
    T('winDim', 1, 0, t, 0.4, 'power2.inOut');
    // the rest of the sweep: ease in from the stop, a constant 50 windows/s (under one per
    // frame at 60 fps), ease out on the last window. The joins match speeds: power2.in over
    // d ends at 2 * dist / d, power2.out over d starts at it.
    const up = 25 * 0.6;
    const down = 25 * 0.7;
    const mid = Math.max(0, nWin - down - (4 + up));
    let ts = t;
    T('win', 4, 4 + up, ts, 0.6, 'power2.in');
    ts += 0.6;
    T('win', 4 + up, 4 + up + mid, ts, mid / 50, 'none');
    ts += mid / 50;
    T('win', 4 + up + mid, nWin, ts, 0.7, 'power2.out');
    ts += 0.7;
    T('winA', 1, 0, ts + 0.1, 0.4, 'power2.out');
    T('inset', 1, 0, ts + 0.1, 0.4, 'power2.out');
    T('fov', 1, 0, ts + 0.1, 0.4, 'power2.out');
    T('cover', 1, 0, ts + 0.1, 0.4, 'power2.out');
    T('schem', 1, 0, ts + 0.1, OUT, 'power2.in');
    tc = ts + 0.5;
    T('t2', 1, 0, tc, OUT, 'power2.in');
    chapterRule(tc);
    T('t2b', 0, 1, tc + IN_AT, 0.7, 'power2.out');
    T('cards', 0, 1, tc + 0.5, 0.3, 'power2.out');
    T('fan', 0, 1, tc + 0.5, 1.0, 'power2.out');
    T('cardsT', 0, 1, tc + 0.7, 0.5, 'power2.out');
    // a stop on the open fan with its caption
    t = snap(tc + 2.3);
    beat('ensemble', b2b, t);
    // ---- beat 2c: averaged, thresholded, filtered ------------------------------------
    tc = t;
    T('cardsT', 1, 0, tc, OUT, 'power2.in');
    T('merge', 0, 1, tc, 0.8, 'power3.inOut');
    T('heatMean', 0, 1, tc, 0.8, 'power2.inOut');
    T('avgT', 0, 1, tc + IN_AT, 0.4, 'power2.out');
    tc += 1.4;
  } else {
    // condensed (about 5 s in all): no rectangle, the real accumulator fills in window by
    // window, then only the averaged card (the fan was explained on case A)
    T('fov', 0, 1, t + 0.8, 0.3, 'power2.out');
    T('heat', 0, 1, t + 0.8, 0.3, 'power2.out');
    T('win', 0, nWin, t + 0.9, 0.9, 'power1.inOut');
    T('fov', 1, 0, t + 1.8, 0.3, 'power2.out');
    T('cover', 1, 0, t + 1.9, 0.3, 'power2.out');
    tc = t + 1.9;
    T('t2', 1, 0, tc, OUT, 'power2.in');
    chapterRule(tc);
    T('t2b', 0, 1, tc + IN_AT, 0.6, 'power2.out');
    T('cards', 0, 1, tc + 0.3, 0.3, 'power2.out');
    T('fan', 0, 1, tc + 0.3, 0.01, 'none');
    T('merge', 0, 1, tc + 0.3, 0.01, 'none');
    T('heatMean', 0, 1, tc + 0.3, 0.5, 'power2.inOut');
    T('avgT', 0, 1, tc + 0.5, 0.3, 'power2.out');
    tc += 0.9;
  }
  // threshold: the heat below 0.5 fades while what is kept shows in the heat's top colour,
  // then a band sweeps down turning it to the prediction blue (no crossfade through grey)
  const b2c = condensed ? b2 : beats[beats.length - 1].end;
  cues.threshold = tc;
  const dTh = condensed ? 0.25 : 0.4;
  const dWipe = condensed ? 0.35 : 0.6;
  T('thresh', 0, 1, tc, dTh, 'power2.out');
  T('threshT', 0, 1, tc, 0.4, 'power2.out');
  T('wipe', 0, 1, tc + dTh, dWipe, 'power1.inOut');
  tc += dTh + dWipe + (condensed ? 0 : 0.1);
  // the size filter: one gold ring pops on each removed speck as the count ticks down,
  // then the specks dissolve
  const nRem = Math.max(0, nUnfiltered - nPred);
  const dPop = condensed ? 0.6 : Math.min(1.5, Math.max(0.6, 0.25 * nRem));
  T('filterT', 0, 1, tc, 0.4, 'power2.out');
  // the specks turn gold (process) as their rings start, over whatever is behind them
  T('removedRing', 0, 1, tc + 0.3, 0.2, 'power2.out');
  T('regions', nUnfiltered, nPred, tc + 0.4, dPop, 'none');
  T('removed', 1, 0, tc + 0.5 + dPop, condensed ? 0.4 : 0.6, 'power2.in');
  T('removedRing', 1, 0, tc + (condensed ? 0.5 : 1.2) + dPop, 0.4, 'power2.in');
  t = snap(tc + 0.4 + dPop + (condensed ? 0.6 : 1.6));
  if (condensed) beat('model', b2, t);
  else beat('threshold', b2c, t);

  // ---- beat 3: the prediction ---------------------------------------------------------
  const b3 = t;
  T('t2b', 1, 0, t, OUT, 'power2.in');
  T('avgT', 1, 0, t, OUT, 'power2.in');
  T('threshT', 1, 0, t, OUT, 'power2.in');
  T('filterT', 1, 0, t, OUT, 'power2.in');
  T('cards', 1, 0, t, OUT, 'power2.in');
  chapterRule(t);
  T('t3', 0, 1, t + IN_AT, 0.7, 'power2.out');
  // the thresholded map is already the prediction's blue: the prediction layer comes in
  // underneath it, then the threshold layer is dropped, so nothing flickers
  T('pred', 0, 1, t + 0.2, 0.6, 'power2.inOut');
  T('edge', 0, 1, t + 0.2, 0.6, 'power2.inOut');
  T('heat', 1, 0, t + 0.8, 0.01, 'none');
  T('thresh', 1, 0, t + 0.8, 0.01, 'none');
  T('dim', dims.model, dims.masks, t + 0.2, 0.8, 'power2.inOut');
  // the count starts just before its label shows and is drawn rounded up (as in beat 4)
  T('count3', 0, 1, t + 0.6, 0.4, 'power2.out');
  T('predMkA', 0, 1, t + 0.45, 0.2, 'power2.out');
  const dPred = Math.min(2.2, 0.6 + nPred * 0.035);
  T('predMk', 0, nPred, t + 0.45, dPred, 'power1.inOut');
  T('angle', 360, 720, t + 3.1, 6.0, 'sine.inOut');
  t = snap(t + 9.6);
  beat('prediction', b3, t);

  // ---- beat 4: against the ground truth -------------------------------------------------
  const b4 = t;
  T('t3', 1, 0, t, OUT, 'power2.in');
  T('count3', 1, 0, t, OUT, 'power2.in');
  T('predMkA', 1, 0, t + 0.1, 0.3, 'power2.in');
  chapterRule(t);
  T('t4', 0, 1, t + IN_AT, 0.7, 'power2.out');
  T('gtT', 0, 1, t + 0.5, 0.4, 'power2.out');
  T('gt', 0, 1, t + 0.5, 0.4, 'power2.out');
  T('gtRingA', 0, 1, t + 0.5, 0.2, 'power2.out');
  // each ring traces over WAVE_SPAN steps of the wave, so even 52 rings in 1.8 s each
  // get about a quarter of a second
  const dTrace = Math.min(1.8, Math.max(0.9, 0.4 + nGt * 0.035));
  T('gtTrace', 0, nGt + WAVE_SPAN, t + 0.5, dTrace, 'none');
  let tv = t + 0.7 + Math.max(dTrace, 1.2);
  cues.verdict = tv;
  T('gtT', 1, 0, tv, OUT, 'power2.in');
  T('verdict', 0, 1, tv, 0.8, 'power2.inOut');
  T('gt', 1, 0, tv + 0.3, 0.5, 'power2.inOut');
  // the legend and the found count start together, so no row ever reads "0"
  T('legend', 0, 1, tv + IN_AT, 0.5, 'power2.out');
  const dFound = Math.min(1.4, 0.4 + nFound * 0.025);
  // counts start a beat before their row shows and are drawn rounded up, so a row never
  // reads "0" while it fades in (a real 0, such as B's missed count, still reads 0)
  T('nFound', 0, nFound, tv + IN_AT - 0.1, dFound, 'none');
  // the pop wave runs at the counter's rate and carries on until the last ring has popped
  const rate = nFound / dFound;
  const span = Math.max(1, POP_S * rate);
  cues.foundSpan = span;
  if (nFound > 0) T('foundWave', 0, nFound + span, tv + IN_AT - 0.1, (nFound + span) / rate, 'none');
  tv += IN_AT + dFound;
  // crowded found rings step back so the errors stand out; a few keep nearly full strength
  T('foundDim', 0, nFound > 8 ? 1 : 0.25, tv + 0.2, 0.6, 'power2.inOut');
  const dMissed = nMissed ? Math.min(1.2, 0.35 + nMissed * 0.22) : 0.3;
  T('rowM', 0, 1, tv, 0.25, 'power2.out');
  T('nMissed', 0, nMissed, tv - 0.05, dMissed, 'none');
  tv += 0.2 + dMissed;
  const dFa = nFa ? Math.min(1.4, 0.35 + nFa * 0.08) : 0.3;
  T('rowF', 0, 1, tv - 0.1, 0.25, 'power2.out');
  T('nFa', 0, nFa, tv - 0.15, dFa, 'none');
  tv += dFa + 0.2;
  T('ruleT', 0, 1, tv, 0.5, 'power2.out');
  let tEnd = tv + 1.4;
  if (merged) {
    T('mergedT', 0, 1, tv + 0.6, 0.5, 'power2.out');
    tEnd += 0.6;
  }
  if (nearMiss) {
    T('nearT', 0, 1, tv + (merged ? 1.2 : 0.6), 0.5, 'power2.out');
    tEnd += 0.6;
  }
  t = snap(tEnd);
  beat('truth', b4, t);

  // ---- beat 5: scoring this scan ----------------------------------------------------------
  // The scan stays as dim as in beat 4 and the error markers keep full strength: this is
  // the hold where the numbers that count those errors land (C2, C3 round 2).
  const b5 = t;
  cues.card = t + 0.4;
  T('t4', 1, 0, t, OUT, 'power2.in');
  T('ruleT', 1, 0, t, OUT, 'power2.in');
  if (merged) T('mergedT', 1, 0, t, OUT, 'power2.in');
  if (nearMiss) T('nearT', 1, 0, t, OUT, 'power2.in');
  T('legend', 1, 0, t, OUT, 'power2.in');
  T('dim', dims.masks, dims.card, t, 0.8, 'power2.inOut');
  chapterRule(t);
  T('t5', 0, 1, t + IN_AT, 0.7, 'power2.out');
  T('card', 0, 1, t + 0.5, 0.8, 'power3.out');
  T('metrics', 0, 1, t + 0.7, 1.3, 'power2.out');
  T('ctxT', 0, 1, t + 2.2, 0.5, 'power2.out');
  T('selT', 0, 1, t + 2.7, 0.5, 'power2.out');
  t = snap(t + 5.2);
  beat('accuracy', b5, t);

  // pad the timeline to the last hold so duration() includes it
  tl.set({}, {}, t);
  return { tl, beats, duration: t, cues, flags: { merged, nearMiss } };
}
