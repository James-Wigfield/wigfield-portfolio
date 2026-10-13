import gsap from 'gsap';
import { WIDE, frameRect, rectToStage, toApp, toStage } from './camera';
import { STAGE_H, STAGE_W } from './looks';

/* ============================================================================
   PSMA APP GUIDE — TIMELINE BUILDER
   ----------------------------------------------------------------------------
   One paused GSAP timeline tweens one plain state object S; Stage.jsx draws a
   frame from S alone (canvas + DOM), in the timeline's onUpdate and after every
   seek. So a frame is a pure function of timeline time.

   Seek safety (as psma-motion): every property is animated only by fromTo
   tweens whose `from` equals the previous tween's `to` for that property
   (checked by T() in dev), with immediateRender: false because all tweens
   share S (immediateRender would apply a later tween's start value at build
   time). Whatever direction the playhead arrives from, S is the same.

   The script (script.js) calls the builder's verbs in time order. Each verb
   registers what it draws and the tweens that animate it, and records what the
   gates check: every click's target rect (G3), every caption's and callout's
   time on screen (G4), every image a frame can show (G1). The rules the
   critics asked for are enforced here, not left to the script:
     * a captured state changes by the kind of change: in place = crossfade;
       a list, expander or mode switch = cut or a reveal inside the changed
       rect; a scroll = the page slides between the two scroll positions;
     * a cursor move never overlaps a camera move (B.end throws in dev);
     * a highlight ring dims the rest of the window (one dim value);
     * a callout's leader starts on its ring, never on the thing it points at;
     * a chapter card starts only once every caption and callout has had its
       minimum hold; whatever is still up rides under the curtain and goes.
   ========================================================================== */

const OUT = 0.25; // text exit
const GAP = 0.05; // a caption starts only after the previous one has gone
const CARD_HOLD = 0.72; // a chapter title is readable for its hold + 0.12 s (two or three words)

export const wordsOf = (text) => text.replace(/\[|\]/g, '').split(/\s+/).filter(Boolean).length;
export const minHold = (text) => Math.ceil((wordsOf(text) / 3 + 1) * 10) / 10;
const overlaps = (a0, a1, b0, b1, tol = 0) => a0 < b1 - tol && b0 < a1 - tol;

export function createBuilder(manifest) {
  const caps = manifest.captures;
  const S = {};
  const tl = gsap.timeline({ paused: true });
  const last = {};
  const T = (prop, from, to, at, dur, ease = 'power2.inOut') => {
    if (!(prop in S)) S[prop] = from;
    if (import.meta.env.DEV && prop in last && Math.abs(last[prop] - from) > 1e-9) {
      console.warn(`[psma-app-guide] ${prop}: tween at ${at.toFixed(2)}s starts at ${from}, previous ended at ${last[prop]}`);
    }
    last[prop] = to;
    tl.fromTo(S, { [prop]: from }, { [prop]: to, duration: Math.max(dur, 0.001), ease, immediateRender: false }, at);
  };
  const val = (prop, dflt = 0) => (prop in last ? last[prop] : dflt);

  const cap = (id) => {
    const c = caps[id];
    if (!c) throw new Error(`no capture ${id} in the manifest`);
    return c;
  };
  /** A recorded rect: 'A10:ct_window', an option 'B07:option:Lung', or [x, y, w, h]. */
  const rectOf = (ref) => {
    if (Array.isArray(ref)) return ref;
    const [id, name, opt] = ref.split(':');
    const c = cap(id);
    if (name === 'option') {
      const o = (c.options || []).find(([text]) => text.startsWith(opt));
      if (!o) throw new Error(`no option ${opt} in ${id}`);
      return o[1];
    }
    const r = c.rects?.[name];
    if (!r) throw new Error(`no rect ${name} in ${id}`);
    return r;
  };
  const pointIn = (ref, fx = 0.5, fy = 0.5) => {
    const r = rectOf(ref);
    return [r[0] + r[2] * fx, r[1] + r[3] * fy];
  };
  const union = (...refs) => {
    const rs = refs.map(rectOf);
    const x0 = Math.min(...rs.map((r) => r[0]));
    const y0 = Math.min(...rs.map((r) => r[1]));
    const x1 = Math.max(...rs.map((r) => r[0] + r[2]));
    const y1 = Math.max(...rs.map((r) => r[1] + r[3]));
    return [x0, y0, x1 - x0, y1 - y0];
  };
  const padded = (r, pad) => {
    const [t, rt, b, l] = Array.isArray(pad) ? pad : [pad, pad, pad, pad];
    return [r[0] - l, r[1] - t, r[2] + l + rt, r[3] + t + b];
  };

  const B = {
    S, tl, T, val, cap, rectOf, pointIn, union, padded,
    layers: [], camMoves: [], curMoves: [], clicks: [], rings: [], lesionRings: [], captions: [], callouts: [],
    cards: [], panels: [], chapters: [], checks: { clicks: [], rings: [], drift: [] },
    camera: WIDE, cursor: null, top: [], lastCaptionEnd: 0, startCam: WIDE, cursorOn: false,
    lastShowAt: -Infinity, lastShowEnd: 0, spotOwner: null,
  };

  // ---- chapters ---------------------------------------------------------------------------
  B.chapter = (id, num, name, start) => {
    const prev = B.chapters[B.chapters.length - 1];
    if (prev && prev.end === undefined) prev.end = start;
    B.chapters.push({ id, num, name, start });
    tl.addLabel(id, start);
  };
  B.end = (t) => {
    B.flushDim();
    const prev = B.chapters[B.chapters.length - 1];
    if (prev && prev.end === undefined) prev.end = t;
    tl.set({}, {}, t); // pad the timeline to the last hold
    B.duration = t;
    // a cursor move never overlaps a camera move (C2: the pointer whips when the view moves under it)
    const clash = [];
    B.curMoves.filter((m) => m.dur > 0.01).forEach((m) => B.camMoves.filter((c) => c.dur > 0.01).forEach((c) => {
      if (overlaps(m.at, m.at + m.dur, c.at, c.at + c.dur, 0.1)) clash.push(`cursor ${m.at.toFixed(2)}+${m.dur} / camera ${c.at.toFixed(2)}+${c.dur}`);
    }));
    if (clash.length && import.meta.env.DEV) throw new Error(`cursor moves during camera moves: ${clash.join('; ')}`);
  };

  // ---- the app window: captured states and clipped frame sequences ---------------------------
  const hideCovered = (at) => {
    B.top.forEach((j) => {
      T(`L${j}`, 1, 0, at, 0.001, 'none');
      B.layers[j].t1 = at;
    });
  };
  /**
   * Show a full capture. mode:
   *   'fade'   in-place change (typed text, a status line, an image in a fixed box): crossfade
   *   'cut'    layout change (lists, expanders, mode switches): at once, as the app does it
   *   'reveal' a list opening: the new state unrolls down inside `rect` (the changed region)
   *   'scroll' the main column slides from the old scroll position to the new one
   */
  // captured states are shown in time order (C2: a state shown after the one that should cover
  // it is never hidden, and would show through a later fade)
  const inOrder = (id, at, end) => {
    if (at < B.lastShowAt - 1e-6) throw new Error(`${id} at ${at.toFixed(3)} s is earlier than the previous show (${B.lastShowAt.toFixed(3)} s)`);
    B.lastShowAt = at;
    B.lastShowEnd = Math.max(B.lastShowEnd, end);
  };
  B.show = (id, at, { mode = 'fade', fade = 0.3, rect = null, dur = null } = {}) => {
    if (mode === 'scroll' || mode === 'reveal') B.flushDim();
    const c = cap(id);
    if (c.kind !== 'full') throw new Error(`${id} is not a full capture`);
    inOrder(id, at, at + (mode === 'fade' ? fade : mode === 'cut' ? 0 : (dur ?? (mode === 'reveal' ? 0.14 : 0.7))));
    const i = B.layers.length;
    const L = { i, id, kind: 'full', file: c.file, t0: at, t1: Infinity, scroll: c.state?.scroll, mode };
    B.layers.push(L);
    if (mode === 'fade') {
      T(`L${i}`, 0, 1, at, fade, 'power1.inOut');
      hideCovered(at + fade);
    } else if (mode === 'cut') {
      T(`L${i}`, 0, 1, at, 0.001, 'none');
      hideCovered(at + 0.001);
    } else if (mode === 'reveal') {
      const r = rect ?? c.diff_prev?.bbox;
      if (!r) throw new Error(`reveal of ${id} needs a rect`);
      const d = dur ?? 0.14;
      L.reveal = r;
      T(`L${i}`, 0, 1, at, 0.001, 'none');
      T(`RV${i}`, 0, 1, at, d, 'power2.out');
      hideCovered(at + d);
    } else if (mode === 'scroll') {
      // each column (the sidebar and the main column scroll separately) slides from its old
      // scroll position to its new one; a column that did not scroll stays put
      const prev = B.layers[[...B.top].reverse().find((j) => B.layers[j].kind === 'full')];
      const d = dur ?? 0.7;
      const dm = (c.state.scroll.main ?? 0) - (prev.scroll?.main ?? 0);
      const ds = (c.state.scroll.sidebar ?? 0) - (prev.scroll?.sidebar ?? 0);
      L.scrollFrom = { layer: prev.i, dm, ds, dy: Math.max(Math.abs(dm), Math.abs(ds)) };
      T(`L${i}`, 0, 1, at, 0.001, 'none');
      T(`SC${i}`, 0, 1, at, d, 'power2.inOut');
      hideCovered(at + d);
    } else {
      throw new Error(`unknown show mode ${mode}`);
    }
    B.top = [i];
    return i;
  };
  /**
   * A clipped frame sequence over the current capture, starting on frame `frame`. A `loop`
   * sequence (the rotating MIP: one full turn) wraps, so it can play on past its last frame.
   */
  B.seq = (id, at, frame = 0, { loop = false } = {}) => {
    const c = cap(id);
    if (c.kind !== 'seq') throw new Error(`${id} is not a sequence`);
    inOrder(id, at, at);
    const i = B.layers.length;
    B.layers.push({ i, id, kind: 'seq', clip: c.clip, frames: c.frames, t0: at, t1: Infinity, loop, mode: 'cut' });
    T(`L${i}`, 0, 1, at, 0.001, 'none');
    S[`F${i}`] = frame;
    last[`F${i}`] = frame;
    B.top.push(i);
    return i;
  };
  B.seqTo = (i, frame, at, dur, ease = 'power1.inOut') => T(`F${i}`, val(`F${i}`), frame, at, dur, ease);
  /**
   * A denser capture of part of the current state (capture_app.py hi(): the same screen
   * re-rasterised at device scale 4), over the full capture at its own rect. It fades in before
   * the camera goes past 2x, where the full capture would soften; content and place are the same.
   */
  B.clip = (id, at, { fade = 0.3 } = {}) => {
    const c = cap(id);
    if (c.kind !== 'clip') throw new Error(`${id} is not a clip`);
    inOrder(id, at, at + fade);
    const i = B.layers.length;
    B.layers.push({ i, id, kind: 'clip', file: c.file, rect: c.rect, t0: at, t1: Infinity, mode: 'fade' });
    T(`L${i}`, 0, 1, at, fade, 'power1.inOut');
    B.top.push(i);
    return i;
  };
  B.hideLayer = (i, at) => {
    T(`L${i}`, 1, 0, at, 0.001, 'none');
    B.layers[i].t1 = at;
    B.top = B.top.filter((j) => j !== i);
  };
  /** Every file a time span can show (preloading before live playback). */
  B.filesBetween = (a, b) => {
    const out = new Set();
    B.layers.forEach((L) => {
      if (L.t0 > b || L.t1 < a) return;
      if (L.kind === 'full' || L.kind === 'clip') out.add(L.file);
      else L.frames.forEach((f) => out.add(f.file));
      if (L.scrollFrom) out.add(B.layers[L.scrollFrom.layer].file);
    });
    return [...out];
  };

  // ---- camera ----------------------------------------------------------------------------------
  B.cam = (to, at, dur = 1.0, ease = 'power2.inOut', { keepCursor = false } = {}) => {
    const target = to.z ? to : frameRect(rectOf(to.rect ?? to), to);
    const from = B.camera;
    // the cursor plays no part in a camera move: it fades as the move starts (C2)
    if (dur > 0.05 && B.cursorOn && !keepCursor) B.cursorOut(at, 0.25);
    if (dur > 1.0) B.flushDim();
    const k = B.camMoves.length;
    // A long pan at a close zoom would whip across the frame. Instead it is one move whose zoom
    // eases out and back in log space around a widest point mid-move (where the zoom's speed is
    // zero), while the pan eases over the whole move (C2; after van Wijk and Nuij's smooth
    // zoom-and-pan).
    const zMin = Math.min(from.z, target.z);
    let arc = 0;
    let d = dur;
    if (dur > 0.05 && Math.hypot(target.cx - from.cx, target.cy - from.cy) * zMin > 900) {
      // widest at z 0.9: a deliberate pull-back with the window's edges in view, never at z 1
      // where the framing clamp switches on and off (C2 round 3)
      const zMid = Math.min(zMin, 0.9);
      arc = Math.max(0, (Math.log(from.z) + Math.log(target.z)) / 2 - Math.log(zMid));
      d = Math.max(dur, 1.25);
    }
    B.camMoves.push({ k, from, to: target, at, dur: d, arc });
    T(`C${k}`, 0, 1, at, d, ease);
    B.camera = target;
    return at + d;
  };
  B.frame = (ref, opts) => frameRect(rectOf(ref), opts);

  // ---- cursor ----------------------------------------------------------------------------------
  const place = (pos, at) => {
    const k = B.curMoves.length;
    B.curMoves.push({ k, from: pos, to: pos, at, dur: 0.001, easeX: 'none', easeY: 'none' });
    T(`M${k}`, 0, 1, at, 0.001, 'none');
    B.cursor = pos;
    B.curStart = B.curStart ?? pos;
  };
  B.moveTo = (target, at, dur = 0.7, { easeX = 'power3.inOut', easeY = 'power2.inOut' } = {}) => {
    const to = Array.isArray(target) && typeof target[0] === 'number' ? target : pointIn(...[].concat(target));
    const k = B.curMoves.length;
    B.curMoves.push({ k, from: B.cursor ?? to, to, at, dur, easeX, easeY });
    T(`M${k}`, 0, 1, at, dur, 'none');
    B.cursor = to;
    return at + dur;
  };
  /**
   * The cursor comes in from the frame edge nearest its target (C2: never out of nothing in the
   * middle of the view), on the camera the script has settled on.
   */
  const travel = (a, b) => {
    const p = toStage(B.camera, a[0], a[1]);
    const q = toStage(B.camera, b[0], b[1]);
    return Math.min(0.9, 0.35 + Math.hypot(q[0] - p[0], q[1] - p[1]) / 1600);
  };
  B.cursorEnter = (target, at, dur = null) => {
    const to = Array.isArray(target) && typeof target[0] === 'number' ? target : pointIn(...[].concat(target));
    if (B.cursorOn) return B.moveTo(to, at, dur ?? travel(B.cursor, to));
    const cam = B.camera;
    const st = toStage(cam, to[0], to[1]);
    const d = [st[0], STAGE_W - st[0], st[1], STAGE_H - st[1]];
    const e = d.indexOf(Math.min(...d));
    const edge = [[-40, st[1] + 60], [STAGE_W + 40, st[1] + 60], [st[0] + 60, -40], [st[0] + 60, STAGE_H + 40]][e];
    const from = toApp(cam, edge[0], edge[1]);
    place(from, at);
    if (!B.cursorOn) T('curA', val('curA'), 1, at, 0.12, 'none');
    B.cursorOn = true;
    return B.moveTo(to, at, dur ?? travel(from, to), { easeX: 'power3.out', easeY: 'power2.out' });
  };
  B.cursorOut = (at, dur = 0.3) => {
    if (!B.cursorOn) return;
    T('curA', val('curA'), 0, at, dur, 'power2.in');
    B.cursorOn = false;
  };
  /**
   * After a click with a long hold ahead, the cursor drifts off the control it clicked (C2): by
   * default to the first nearby spot (stage px) that is inside the subject area, above the
   * caption band and clear of every ring that is up (C2, C4); dx, dy (app px) force a spot.
   */
  B.drift = (at, dx = null, dy = null, dur = 0.5) => {
    const ease = { easeX: 'power2.out', easeY: 'power2.out' };
    if (dx !== null) return B.moveTo([B.cursor[0] + dx, B.cursor[1] + dy], at, dur, ease);
    const cam = B.camera;
    const here = toStage(cam, B.cursor[0], B.cursor[1]);
    const rings = B.rings.filter((r) => val(`HA${r.k}`) > 0.5).map((r) => rectToStage(cam, r.rect));
    const clear = ([x, y]) => x > 120 && x < 1800 && y > 100 && y < 730
      && !rings.some((r) => x >= r[0] - 14 && x <= r[0] + r[2] + 14 && y >= r[1] - 14 && y <= r[1] + r[3] + 14);
    const options = [[50, -44], [-50, -44], [70, 0], [-70, 0], [50, 44], [-50, 44], [110, -90], [-110, -90]];
    const pick = options.find(([ox, oy]) => clear([here[0] + ox, here[1] + oy])) ?? options[0];
    return B.moveTo([B.cursor[0] + pick[0] / cam.z, B.cursor[1] + pick[1] / cam.z], at, dur, ease);
  };
  /**
   * Drag a player's slider: the sequence layer i runs to frame `to` and the cursor rides the
   * thumb, at the thumb's real position in each captured frame.
   */
  B.drag = (i, to, at, dur, ease = 'power1.inOut') => {
    const L = B.layers[i];
    const k = B.curMoves.length;
    B.curMoves.push({ k, follow: i, at, dur });
    T(`M${k}`, 0, 1, at, dur, 'none');
    B.seqTo(i, to, at, dur, ease);
    B.cursor = thumbAt(L.frames[Math.round(to)]);
    return at + dur;
  };
  /** A click where the cursor is: press dip and ripple. `target` is checked by gate G3. */
  B.click = (at, target, note = '') => {
    const k = B.clicks.length;
    B.clicks.push({ k, at, pos: B.cursor });
    T(`P${k}`, 0, 1, at, 0.08, 'power2.out');
    T(`P${k}`, 1, 0, at + 0.08, 0.16, 'power2.inOut');
    T(`R${k}`, 0, 1, at + 0.02, 0.55, 'none');
    if (target) B.checks.clicks.push({ at, pos: B.cursor, target, rect: rectOf(target), note });
    return at + 0.08;
  };
  /** Press and hold (a drag): the press dip stays down for `dur`, no ripple. */
  B.hold = (at, dur, target, note = '') => {
    const k = B.clicks.length;
    B.clicks.push({ k, at, pos: B.cursor, noRipple: true });
    T(`P${k}`, 0, 1, at, 0.08, 'power2.out');
    T(`P${k}`, 1, 0, at + dur, 0.12, 'power2.inOut');
    if (target) B.checks.clicks.push({ at, pos: B.cursor, target, rect: rectOf(target), note });
  };

  // ---- highlights ----------------------------------------------------------------------------
  /*
   * A dim's exit (a ring's, or spotOff's) is held back: if another dim starts within DIM_BRIDGE s,
   * the dim stays and its hole glides to the new place (C2 round 3: no pumping between consecutive
   * rings); otherwise it goes at its own time. A scroll, a reveal, a move longer than 1 s, a ring
   * without a dim, a card or the end settle a held exit.
   */
  const DIM_BRIDGE = 2.0;
  let heldOff = null;
  B.flushDim = () => {
    if (!heldOff) return;
    const { at, dur } = heldOff;
    heldOff = null;
    if (val('spA') > 0) T('spA', val('spA'), 0, at, dur, 'power2.inOut');
  };
  const holdOff = (at, dur) => {
    B.flushDim();
    if (val('spA') > 0) heldOff = { at, dur };
  };
  /** Dim the window outside an app rect; moves smoothly to a new rect when already on. */
  B.spot = (hole, at, dur = 0.45) => {
    if (heldOff && at - heldOff.at > DIM_BRIDGE) B.flushDim();
    heldOff = null;
    const on = val('spA') > 0.5;
    ['spX', 'spY', 'spW', 'spH'].forEach((p, i) => T(p, val(p, hole[i]), hole[i], at, on ? dur : 0.001, 'power2.inOut'));
    if (!on) T('spA', val('spA'), 1, at, dur, 'power2.inOut');
  };
  B.spotOff = (at, dur = 0.4) => holdOff(at, dur);
  /**
   * A highlight ring round `ref` (pad: px or [top, right, bottom, left]); by default the rest of
   * the window dims to the same rect (C2: ring and dim are one gesture). `ring` may cover more
   * than the target (a control and its label); G3 checks it encloses the target.
   */
  B.ring = (ref, at, { pad = 8, dur = 0.5, dim = true, around = null } = {}) => {
    const r = rectOf(ref);
    const k = B.rings.length;
    const rect = padded(around ? rectOf(around) : r, pad);
    B.rings.push({ k, ref, rect, at });
    if (!dim) B.flushDim();
    T(`H${k}`, 0, 1, at, dur, 'power2.inOut');
    T(`HA${k}`, 0, 1, at, 0.15, 'none');
    if (dim) {
      B.spot(rect, at);
      B.spotOwner = k;
    }
    B.checks.rings.push({ k, ref, rect, target: r });
    return k;
  };
  B.ringOut = (k, at, dur = 0.3) => {
    if (val(`HA${k}`) > 0) T(`HA${k}`, 1, 0, at, dur, 'power2.in');
    // C2: a ring's exit takes its dim with it (unless another follows: see holdOff)
    if (B.spotOwner === k) {
      holdOff(at, dur + 0.1);
      B.spotOwner = null;
    }
  };
  B.ringsOut = (at, dur = 0.3) => {
    B.rings.forEach((r) => B.ringOut(r.k, at, dur));
    B.lesionRings.forEach((r) => { if (val(`LA${r.k}`) > 0) T(`LA${r.k}`, 1, 0, at, dur, 'power2.in'); });
    B.spotOff(at, dur + 0.1);
    B.flushDim(); // everything out: the dim goes now
  };
  /** A ring round a lesion (app centre, radius in app px), with clearance; returns its index. */
  B.lesionRing = (centre, radius, at, dur = 0.45) => {
    const k = B.lesionRings.length;
    B.lesionRings.push({ k, centre, radius, at });
    T(`LR${k}`, 0, 1, at, dur, 'power2.inOut');
    T(`LA${k}`, 0, 1, at, 0.12, 'none');
    return k;
  };

  // ---- words ---------------------------------------------------------------------------------
  /** A caption held `hold` s fully visible (at least words / 3 + 1). Returns when it has gone. */
  B.caption = (text, at, hold = null) => {
    const min = minHold(text);
    const h = Math.max(hold ?? min, min);
    if (at < B.lastCaptionEnd + GAP - 1e-6) {
      throw new Error(`caption "${text.slice(0, 40)}..." at ${at.toFixed(2)} starts before the previous one has gone (${B.lastCaptionEnd.toFixed(2)})`);
    }
    const k = B.captions.length;
    const fadeIn = 0.35;
    B.captions.push({ k, text, at, shown: at + fadeIn, hidden: at + fadeIn + h, min });
    T(`cap${k}`, 0, 1, at, fadeIn, 'power2.out');
    T(`cap${k}`, 1, 0, at + fadeIn + h, OUT, 'power2.in');
    B.lastCaptionEnd = at + fadeIn + h + OUT;
    return B.lastCaptionEnd;
  };
  /**
   * A callout: a label panel tied by a gold leader to a ring round its target. The leader starts
   * on the ring's edge facing the panel. spec: { to: ref, ring: pad (or false when a lesion
   * ring is passed as lesion: k), off: [dx, dy] stage px from the leader's start to the panel's
   * near edge, side: 'left' | 'right' (which edge of the panel the leader meets), text, sub }.
   */
  B.callout = (spec, at, hold) => {
    const k = B.callouts.length;
    let ringRect = null;
    let ringK = null;
    if (spec.lesion !== undefined) {
      ringK = spec.lesion;
    } else if (spec.attach !== undefined) {
      // tie to a ring already up
      ringK = spec.attach;
      ringRect = B.rings[ringK].rect;
    } else if (spec.ring !== false) {
      ringK = B.ring(spec.to, at, { pad: spec.ring ?? 8, dim: spec.dim ?? true, around: spec.around ?? null });
      ringRect = B.rings[ringK].rect;
    }
    const words = wordsOf(`${spec.text} ${spec.sub ?? ''}`);
    const h = Math.max(hold ?? 0, words / 3 + 1);
    const entry = { k, ...spec, ringRect, ringK, at, shown: at + 0.55, hidden: at + 0.55 + h, min: words / 3 + 1 };
    if (spec.lesion !== undefined) {
      entry.lesionRing = B.lesionRings[spec.lesion];
    } else if (!ringRect) {
      entry.point = Array.isArray(spec.to) && typeof spec.to[0] === 'number' ? spec.to : pointIn(spec.to);
    }
    B.callouts.push(entry);
    T(`cl${k}`, 0, 1, at + 0.25, 0.35, 'power2.inOut');
    T(`co${k}`, 0, 1, at + 0.4, 0.4, 'power2.out');
    T(`co${k}`, 1, 0, at + 0.55 + h, OUT, 'power2.in');
    T(`cl${k}`, 1, 0, at + 0.55 + h, OUT, 'power2.in');
    return at + 0.55 + h + OUT;
  };

  /**
   * Chapter card: a dark curtain with soft edges sweeps across, the number and rule, then the
   * title, then the chapter list rise on it, and it carries on off to the right as the title
   * lifts. Between cover and uncover the script cuts the camera and the captures. It may start
   * once every caption and callout has had its minimum hold; whatever is still up rides under
   * the curtain and is cleared there (C2: no bare beat before the card).
   */
  B.card = (num, title, at, hold = CARD_HOLD) => {
    B.flushDim();
    const k = B.cards.length;
    const IN = 0.6;
    const cover = at + IN;
    const titleOut = cover + 0.12 + hold;
    const uncover = titleOut;
    const late = [
      ...B.captions.filter((c) => c.shown + c.min > at + 1e-6).map((c) => `caption "${c.text}"`),
      ...B.callouts.filter((c) => c.shown + c.min > at + 1e-6).map((c) => `callout "${c.text}"`),
      ...B.captions.filter((c) => c.hidden + OUT > uncover + 1e-6).map((c) => `caption "${c.text}" (would outlive the card)`),
      ...B.callouts.filter((c) => c.hidden + OUT > uncover + 1e-6).map((c) => `callout "${c.text}" (would outlive the card)`),
      ...B.panels.filter((p) => p.hidden + OUT > uncover + 1e-6 && p.at < at).map((p) => `panel ${p.id} (would outlive the card)`),
    ];
    B.camMoves.filter((m) => m.dur > 0.05 && m.at < cover - 1e-6 && m.at + m.dur > at + 1e-6)
      .forEach((m) => late.push(`camera move ${m.k} (${m.at.toFixed(2)}+${m.dur.toFixed(2)})`));
    B.layers.filter((L) => L.t0 >= at - 1e-6 && L.t0 < cover - 1e-6)
      .forEach((L) => late.push(`capture ${L.id} shown at ${L.t0.toFixed(2)}`));
    if (late.length) throw new Error(`chapter ${num} at ${at.toFixed(2)} s: ${late.join(', ')}`);
    // what is still up rides under the curtain and is cleared once it is covered
    B.cursorOut(at, 0.25);
    B.rings.forEach((r) => { if (val(`HA${r.k}`) > 0) T(`HA${r.k}`, 1, 0, cover, 0.001, 'none'); });
    B.lesionRings.forEach((r) => { if (val(`LA${r.k}`) > 0) T(`LA${r.k}`, 1, 0, cover, 0.001, 'none'); });
    if (val('spA') > 0) T('spA', val('spA'), 0, cover, 0.001, 'none');
    B.cards.push({ k, num, title, at, cover, uncover, end: uncover + IN });
    T(`cdC${k}`, 0, 1, at, IN, 'power2.inOut');
    T(`cdA${k}`, 0, 1, cover - 0.1, 0.35, 'power2.out');
    T(`cdR${k}`, 0, 1, cover - 0.05, 0.55, 'expo.out');
    T(`cdT${k}`, 0, 1, cover + 0.12, 0.7, 'power2.out');
    T(`cdG${k}`, 0, 1, cover + 0.35, 0.4, 'power2.out');
    T(`cdM${k}`, 0, 1, cover + 0.45, 0.4, 'power2.inOut');
    T(`cdA${k}`, 1, 0, titleOut, 0.3, 'power2.in');
    T(`cdG${k}`, 1, 0, titleOut, 0.3, 'power2.in');
    T(`cdT${k}`, 1, 2, titleOut, 0.35, 'power2.in');
    T(`cdC${k}`, 1, 2, uncover, IN, 'power2.inOut');
    return { cover, uncover, end: uncover + IN };
  };

  /**
   * A DOM panel (legend, definitions, tag, credits) fading and rising in at `pos` (stage px).
   * hold = null leaves it up until B.panelOut.
   */
  B.panel = (id, at, hold, { dur = 0.4, pos = [96, 96], data = {}, words = 0 } = {}) => {
    const k = B.panels.length;
    const hidden = hold === null ? Infinity : at + dur + hold;
    B.panels.push({ k, id, at, pos, data, words, shown: at + dur, hidden, min: words ? words / 3 + 1 : 0 });
    T(`pn${k}`, 0, 1, at, dur, 'power2.out');
    if (hold !== null) T(`pn${k}`, 1, 0, hidden, OUT, 'power2.in');
    return hold === null ? k : hidden + OUT;
  };
  B.panelOut = (k, at) => {
    const p = B.panels[k];
    if (Number.isFinite(p.hidden)) throw new Error(`panel ${k} already has its exit`);
    if (at < p.shown + p.min - 1e-6) throw new Error(`panel ${p.id} out at ${at.toFixed(2)} before its minimum hold`);
    p.hidden = at;
    T(`pn${k}`, 1, 0, at, OUT, 'power2.in');
    return at + OUT;
  };
  /**
   * The earliest a chapter card may start: every caption, callout and panel has had its minimum
   * hold, and none of them would still be up when the curtain uncovers the next chapter.
   */
  B.readyAt = () => {
    const items = [...B.captions, ...B.callouts, ...B.panels.filter((p) => Number.isFinite(p.hidden))];
    const lastMove = Math.max(0, ...B.camMoves.map((m) => m.at + m.dur));
    return Math.max(0, lastMove + 1.0, B.lastShowEnd + 1.0,
      ...items.map((c) => Math.max(c.shown + c.min, c.hidden + OUT - (0.6 + 0.12 + CARD_HOLD))));
  };
  /** A panel row stepping in (definitions, one at a time, as the spotlight reaches its cell). */
  B.panelRow = (k, row, at, dur = 0.35) => T(`pn${k}_${row}`, 0, 1, at, dur, 'power2.out');
  /** Light one row of a legend panel (the others step back to 65 %); null lights them all. */
  B.legendFocus = (k, focus, at, dur = 0.35) => {
    ['found', 'missed', 'falseAlarm'].forEach((row) => {
      const p = `pn${k}_${row}`;
      T(p, val(p, 1), focus && focus !== row ? 0.65 : 1, at, dur, 'power2.inOut');
    });
  };

  return B;
}

/** The camera at the current state (the latest move that has started wins). */
export function cameraOf(B, S, lerpCam) {
  for (let k = B.camMoves.length - 1; k >= 0; k--) {
    const p = S[`C${k}`];
    if (p > 0) {
      const mv = B.camMoves[k];
      return mv.arc && p < 1 ? arcCam(mv.from, mv.to, p, mv.arc) : lerpCam(mv.from, mv.to, p);
    }
  }
  return B.startCam;
}

/**
 * A long move: the pan follows the move's ease; the zoom is interpolated in log space less a
 * bump, sin(pi u), so it eases out to its widest at the middle (zero zoom speed there) and back
 * in, with no reversal. Close-ups stay clamped to the framing rule.
 */
function arcCam(a, b, u, H) {
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * u - H * Math.sin(Math.PI * u));
  // not clamped inside the move: the clamp's range moves with z and made the pan stall and jump
  // at the widest point (C2 round 3); the endpoints are clamped already
  return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, z };
}

/** The centre of a range input's thumb in a captured player frame (webkit thumb, 18 px wide). */
export function thumbAt(frame) {
  const [x, y, w, h] = frame.slider;
  const [min, max, value] = frame.range;
  const f = max > min ? (value - min) / (max - min) : 0;
  return [x + 9 + (w - 18) * f, y + h / 2];
}

/** The cursor (app px) at the current state. */
export function cursorOf(B, S) {
  for (let k = B.curMoves.length - 1; k >= 0; k--) {
    const p = S[`M${k}`];
    if (p > 0) {
      const mv = B.curMoves[k];
      if (mv.follow !== undefined) {
        const L = B.layers[mv.follow];
        return thumbAt(L.frames[seqIndex(L, S)]);
      }
      const ex = gsap.parseEase(mv.easeX);
      const ey = gsap.parseEase(mv.easeY);
      return [mv.from[0] + (mv.to[0] - mv.from[0]) * ex(p), mv.from[1] + (mv.to[1] - mv.from[1]) * ey(p)];
    }
  }
  return B.curStart ?? null;
}

/** Files a frame needs at the current state (gate G1 and the image store). */
export function filesOf(B, S) {
  const out = [];
  B.layers.forEach((L) => {
    if (!(S[`L${L.i}`] > 0.001)) return;
    if (L.kind === 'full') {
      out.push(L.file);
      const sc = S[`SC${L.i}`];
      if (L.scrollFrom && sc !== undefined && sc < 0.999) out.push(B.layers[L.scrollFrom.layer].file);
    } else if (L.kind === 'clip') {
      out.push(L.file);
    } else {
      out.push(L.frames[seqIndex(L, S)].file);
    }
  });
  return out;
}

export function seqIndex(L, S) {
  const f = Math.floor((S[`F${L.i}`] ?? 0) + 1e-6);
  const n = L.frames.length;
  return L.loop ? ((f % n) + n) % n : Math.max(0, Math.min(n - 1, f));
}
