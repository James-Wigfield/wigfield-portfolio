import { createBuilder, thumbAt } from './timeline';
import { WIDE, clampCam } from './camera';
import { LOGO_SCALE, LOGO_TOP, SUBJECT } from './looks';
import { CALLOUTS, CAPTIONS, CHAPTERS } from './copy';

const ANCHOR_Y = SUBJECT.y + SUBJECT.h / 2;

/* ============================================================================
   PSMA APP GUIDE — THE SCRIPT
   ----------------------------------------------------------------------------
   The storyboard as timeline calls, in time order. Capture ids and rect names
   are the manifest's (tools/psma-app-guide/capture_app.py); every caption and
   label is copy.js's. One held-out autoPET-III scan (N) is followed from the
   empty welcome page to its result. Chapter 01 is a deliberate flash-forward
   (N's finished result, turning) before chapter 02 starts from the empty
   welcome page; from there every state on screen is a capture of the app,
   shown in the order the app went through it. An action the film skips
   happens behind a chapter curtain or out of frame, never on a control in
   view; a captured state changes on a still camera. The model runs play sped
   up from their own frames, each at its real time since the click divided by
   the speed, with the run's own "Finished in" time on screen. `style` is the
   checkpoint stub.
   ========================================================================== */

const MIP_FPS = 8; // the app's own rotation speed (its Speed (fps) default): the MIP plays at it
const SPEED = 8; // the first filmed run plays 8x faster than it ran
const SPEED_LATER = 24; // the later two, once the wait has been shown (C2, C3)

// ---- small verbs over the builder ----------------------------------------------------------------

/** The earliest a chapter card may start (words read, camera and captured states landed). */
const readyAt = (B) => B.readyAt();

/** When the next beat may start setting up: `lead` s before the current caption has gone. */
const cue = (B, lead = 0.9) => B.lastCaptionEnd - lead;

/**
 * A caption, no earlier than the previous one has gone. Returns when it has gone. A caption pushed
 * more than 0.5 s past the time asked for is logged: gate G4 lists the drift (C2, C3, round 3).
 */
const say = (B, id, t, hold) => {
  const at = Math.max(t, B.lastCaptionEnd + 0.06);
  if (at - t > 0.5) B.checks.drift.push({ id, asked: t, at });
  return B.caption(CAPTIONS[id], at, hold);
};
/** The next caption, as soon as the current one has gone. */
const sayNext = (B, id, hold) => say(B, id, B.lastCaptionEnd + 0.06, hold);
const lastCaption = (B) => B.captions[B.captions.length - 1];
const lastCallout = (B) => B.callouts[B.callouts.length - 1];
/** When the last callout has had its minimum hold (the next beat may start). */
const calloutDone = (B) => lastCallout(B).shown + lastCallout(B).min;

/** The cursor goes to a control (from the frame edge when it is off) and clicks it. */
function press(B, ref, t, { fx = 0.5, fy = 0.5, dur = null, note = '' } = {}) {
  const t1 = B.cursorEnter(B.pointIn(ref, fx, fy), t, dur);
  B.click(t1 + 0.05, ref, note);
  return t1 + 0.2; // the app's response shows from here
}

/**
 * Text typed a few characters at a time: each captured state shows in turn (a crossfade where
 * only the text changes, a cut where a list re-filters under it).
 */
function typed(B, ids, t, every = 0.3, mode = 'fade') {
  ids.forEach((id, i) => B.show(id, t + i * every, mode === 'fade' ? { fade: 0.12 } : { mode }));
  return t + (ids.length - 1) * every + 0.12;
}

/** The centre of a slider thumb found in a capture (thumbs.py). */
function thumb(B, id, name, i = 0) {
  const r = B.cap(id).thumbs[name][i];
  return [r[0] + r[2] / 2, r[1] + r[3] / 2];
}

/**
 * Step a sidebar slider through captured states with the mouse: press on the thumb, move it to
 * where the next capture has it, release; the app redraws thumb and value at once, so each new
 * state cuts in as the thumb lands (C2).
 */
function slide(B, ids, name, t, { i = 0, step = 0.4 } = {}) {
  t = B.cursorEnter(thumb(B, ids[0], name, i), t);
  for (let k = 1; k < ids.length; k++) {
    B.hold(t + 0.04, step - 0.06, `${ids[k - 1]}:${name}`, `drag ${name}`);
    B.moveTo(thumb(B, ids[k], name, i), t + 0.06, step - 0.12, { easeX: 'power1.inOut', easeY: 'power1.inOut' });
    B.show(ids[k], t + step - 0.06, { mode: 'cut' });
    t += step;
  }
  return t + 0.05;
}

/**
 * A filmed model run, sped up: its captured frames at the click + (real time since the click) /
 * speed, with the sped-up tag. The run's length on the tag is the app's own "Finished in N s".
 */
function spedRun(B, runKey, tClick, tagPos, speed, { where = null } = {}) {
  const run = B.manifest.runs[runKey];
  const frames = run.frames.map((id) => ({ id, t: B.cap(id).t_since_click }));
  // each frame crossfades over most of its time on screen: the app's own redraws (the page greying
  // while it loads the result) read as a quick time-lapse, not a flicker
  frames.forEach((f, i) => {
    const next = frames[i + 1] ? (frames[i + 1].t - f.t) / speed : 0.3;
    B.show(f.id, tClick + f.t / speed, { mode: i === 0 ? 'cut' : 'fade', fade: Math.min(0.25, 0.8 * next) });
  });
  const t0 = tClick + frames[0].t / speed;
  const end = tClick + frames[frames.length - 1].t / speed;
  const status = B.cap(frames[frames.length - 1].id).ui_text.status;
  const seconds = Number(/Finished in (\d+) s/.exec(status)[1]);
  // the tag comes in with the click and stays a second into the result: long enough to read (C2)
  B.panel('tag', Math.min(t0, tClick) - 0.3, end + 1.0 - (Math.min(t0, tClick) - 0.3),
    { pos: tagPos, data: { factor: speed, seconds, key: runKey, where } });
  return end;
}

/** The GPU the app's own note under Run model names ("About a minute on an RTX 5070 Ti, ..."). */
function gpuOf(B, id) {
  const m = /on an? ((?:RTX|GTX) [\w ]+?)[,.]/.exec(B.cap(id).ui_text.main);
  if (!m) throw new Error(`no GPU named in ${id}'s text`);
  return m[1];
}

/** Where a capture's lesion shows on its slice (app px), from its lesion-list row (truth_wsl.py). */
function lesionOn(B, id) {
  const c = B.cap(id);
  const [ix, iy, iw, ih] = c.img;
  const [u0, v0, u1, v1] = c.lesion.coronal.bbox_uv;
  const x0 = ix + u0 * iw;
  const x1 = ix + u1 * iw;
  const y0 = iy + v0 * ih;
  const y1 = iy + v1 * ih;
  return { centre: [(x0 + x1) / 2, (y0 + y1) / 2], radius: Math.hypot(x1 - x0, y1 - y0) / 2 + 2 };
}

/** The app's own result card, read from a capture's text: counts and scores as the card shows them. */
function cardOf(B, id) {
  const m = /\n(\d+)\nFOUND\n(\d+)\nMISSED\n(\d+)\nFALSE ALARMS\n([\d.]+%)\nLESION F1\n([\d.]+%)\nSENSITIVITY\n([\d.]+%)\nPPV\nVOXEL DICE \(DSC\)\n([\d.]+%)/
    .exec(B.cap(id).ui_text.main);
  if (!m) throw new Error(`no result card text in ${id}`);
  return { found: m[1], missed: m[2], falseAlarm: m[3], f1: m[4], sensitivity: m[5], ppv: m[6], dice: m[7] };
}

/** The result card's cells (app px), measured on the D-series captures (card at 1498, 663.6). */
function cardCells(B, id) {
  const [x, y] = B.rectOf(`${id}:metrics`);
  return {
    counts: [x, y, 388.8, 60.5],
    f1: [x, y + 60.5, 131, 60],
    sensitivity: [x + 131, y + 60.5, 128, 60],
    ppv: [x + 259, y + 60.5, 129.8, 60],
    dice: [x, y + 120.5, 388.8, 38.9],
  };
}

const camAt = (cx, cy, z) => clampCam({ cx, cy, z });
/** The window's top-left corner at stage (m, m), zoomed z: for controls on its top edge (C2 S4). */
const cornerCam = (z, m) => ({ cx: (SUBJECT.x + SUBJECT.w / 2 - m) / z, cy: (ANCHOR_Y - m) / z, z });

/** A chapter: its strip segment starts here and its card sweeps in. */
function chapter(B, id, at) {
  B.chapter(id, CHAPTERS[id].num, CHAPTERS[id].name, at);
  return B.card(CHAPTERS[id].num, CHAPTERS[id].name, at);
}

// ---- 00 title (frame 0 is the poster) -------------------------------------------------------------

/**
 * The type lifts away; the app window fades in around the logo, which is the app's own masthead
 * logo: the window starts zoomed so that its logo sits exactly under the title's (the same
 * pixels), and the camera pulls back to the wide shot (C2). Returns when the wide shot lands.
 */
function titleCard(B, first, out = 3.6) {
  const { T } = B;
  B.chapter('title', '00', 'Title', 0);
  T('ttlDrift', 0, 1, 0, out + 0.4, 'none');
  T('ttlR', 1, 1, 0, 0.001, 'none');
  T('ttlOut', 0, 1, out, 0.4, 'power2.in');
  const logo = B.rectOf('A01:logo');
  const z = LOGO_SCALE;
  const rest = [960 - (logo[2] * z) / 2, LOGO_TOP];
  B.startCam = { cx: logo[0] - (rest[0] - 960) / z, cy: logo[1] - (rest[1] - ANCHOR_Y) / z, z };
  B.camera = B.startCam;
  first(out + 0.1);
  T('ttlHide', 1, 0, out + 0.38, 0.45, 'power2.inOut');
  T('ttlLogoA', 0, 1, out + 0.85, 0.001, 'none');
  return B.cam(WIDE, out + 0.85, 1.3, 'power3.inOut');
}

// ---- the film -------------------------------------------------------------------------------------

function fullScript(B) {
  let t;
  let k;
  let r;

  // 00 + 01 · what it does: N's result, its MIP turning with the comparison colours ---------------
  let mip;
  const landed = titleCard(B, (at) => {
    B.show('D10', at, { mode: 'cut' });
    mip = B.seq('S-MIP-CMP', at, 0, { loop: true });
  });
  const mipStart = B.layers[mip].t0;
  B.chapter('what', CHAPTERS.what.num, CHAPTERS.what.name, landed - 0.75);
  B.cam({ rect: [393, 150, 1497, 930], pad: 10 }, landed + 0.2, 9.0, 'power1.inOut');
  say(B, '1.1', landed - 0.55);
  sayNext(B, '1.2');

  // 02 · choosing a scan -------------------------------------------------------------------------------
  t = readyAt(B);
  B.seqTo(mip, (t + 0.62 - mipStart) * MIP_FPS, mipStart, t + 0.62 - mipStart, 'none');
  k = chapter(B, 'open', t);
  B.show('A01', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [0, 150, 1290, 360], pad: 16 }, k.cover + 0.04, 0.001, 'none');
  t = press(B, 'A01:dataset_folder', k.end + 0.02, { fx: 0.3, note: 'the Dataset folder box' });
  say(B, '2.1', t - 0.2);
  B.drift(t + 0.1);
  t = typed(B, ['A02', 'A03', 'A04', 'A05', 'A06'], t + 0.15);
  // the layout the app expects, on the welcome page beside the typed path (not dimmed: the box stays lit)
  r = B.ring([408, 284, 640, 99], t + 0.15, { pad: 6, dim: false });
  B.ringOut(r, t + 2.1);
  // Enter: the held-out test list, its first case loaded
  B.show('A07', t + 2.3, { mode: 'cut' });
  t = B.cam({ rect: [0, 160, 1180, 520], pad: 16 }, t + 2.65, 0.9);
  r = B.ring('A07:test_toggle', t, { pad: [6, 12, 6, 6] });
  say(B, '2.2', t - 0.2);
  t = press(B, 'A07:case_picker', t + 1.6, { fx: 0.94, note: 'the case picker' });
  B.ringOut(r, t - 0.3);
  B.show('A08', t, { mode: 'reveal', rect: B.rectOf('A08:listbox') });
  t = typed(B, ['A09a', 'A09b', 'A09c', 'A09'], t + 0.6, 0.28, 'cut');
  t = press(B, 'A09:option:psma_35852148926fc57d_2018-03-23', t + 0.3, { fx: 0.55, note: "N's row" });
  B.show('A10', t, { mode: 'cut' });
  // the badge says whether the models saw the scan (one long move: pull back, travel, push in)
  t = B.cam({ rect: [1490, 156, 404, 110], pad: 20 }, Math.max(t + 0.35, cue(B, 0.8)), 1.25);
  r = B.ring([1498, 166, 389, 86], t, { pad: 8 });
  say(B, '2.3', t - 0.2, 6.0);
  B.callout({ attach: r, off: [-60, 150], side: 'right', ...CALLOUTS.badges }, lastCaption(B).shown + 2.05);
  // a training case: pull back to see the sidebar and the badge together, act, push in
  t = B.cam({ rect: [0, 150, 1920, 560], pad: 10 }, calloutDone(B) + 0.1, 1.0);
  B.ringsOut(t - 1.0, 0.3);
  t = press(B, [28.8, 302.5, 32, 22.5], t + 0.02, { note: 'the test-only switch' });
  B.show('A11', t, { fade: 0.2 });
  t = press(B, 'A11:case_picker', t + 0.45, { fx: 0.94, note: 'the case picker' });
  B.show('A12u', t, { mode: 'reveal', rect: B.rectOf('A12u:listbox') });
  t = typed(B, ['A12a', 'A12b', 'A12'], t + 0.65, 0.3, 'cut');
  t = press(B, 'A12:option:psma_0179419e313f7d8c_2019-06-10', t + 0.3, { fx: 0.5, note: 'a training case' });
  B.show('A13', t, { mode: 'cut' });
  say(B, '2.4', t + 0.1);
  t = B.cam({ rect: [1490, 156, 404, 130], pad: 20 }, t + 0.45, 1.0);
  B.ring([1498, 166, 389, 108], t, { pad: 8 });

  // 03 · viewer controls --------------------------------------------------------------------------------
  t = readyAt(B);
  k = chapter(B, 'look', t);
  B.show('B01', k.cover + 0.02, { mode: 'cut' });
  const scrub = B.seq('S-SCRUB', k.cover + 0.02, 39);
  B.cam({ rect: [393, 470, 1075, 600], pad: 10 }, k.cover + 0.04, 0.001, 'none');
  // the slice slider: the cursor rides the thumb through every captured slice (inside the body)
  const sf = B.cap('S-SCRUB').frames;
  t = B.cursorEnter(thumbAt(sf[39]), k.end + 0.02);
  say(B, '3.1', t - 0.3);
  B.hold(t + 0.04, 3.8, 'B01:slider', 'drag the slice slider');
  t = B.drag(scrub, 6, t + 0.1, 1.2);
  t = B.drag(scrub, 46, t + 0.1, 1.6);
  t = B.drag(scrub, 39, t + 0.1, 0.6);
  B.hideLayer(scrub, t + 0.15); // frame 39 is B01's own slice: nothing changes
  B.drift(t + 0.2);
  // planes
  t = B.cam({ rect: [0, 166, 1480, 914], pad: 10 }, Math.max(t + 0.75, cue(B, 0.8)), 0.9);
  say(B, '3.2', t - 0.2);
  t = press(B, 'B01:opt_axial', t + 0.02, { fx: 0.18, note: 'axial' });
  B.show('B02', t, { mode: 'cut' });
  t = press(B, 'B02:opt_sagittal', t + 0.75, { fx: 0.14, note: 'sagittal' });
  B.show('B03', t, { mode: 'cut' });
  t = press(B, 'B03:opt_coronal', t + 0.75, { fx: 0.14, note: 'coronal' });
  B.show('B01', t, { mode: 'cut' });
  // the image, PET over CT, and the overlay
  t = press(B, 'B01:opt_pet', Math.max(t + 0.4, cue(B, 0.5)), { fx: 0.2, note: 'PET' });
  B.show('B04', t, { fade: 0.3 });
  say(B, '3.3', t - 0.2);
  t = press(B, 'B04:opt_petct', t + 0.75, { fx: 0.12, note: 'PET + CT' });
  B.show('B05', t, { mode: 'cut' });
  t = slide(B, ['B05', 'B06a', 'B06b', 'B06c'], 'fusion', t + 0.2);
  t = press(B, 'B06c:opt_ct', t + 0.3, { fx: 0.25, note: 'CT' });
  B.show('B01', t, { mode: 'cut' });
  B.drift(t + 0.1);
  const ov = t + 0.3;
  r = B.ring('B01:overlay_radio', ov, { pad: 6 });
  const ovEnd = Math.max(cue(B, 0.6), ov + 1.6); // held long enough to read (C2 S3)
  B.ringOut(r, ovEnd + 0.2);
  // CT window presets (the list's own labels give each window's width and level)
  t = B.cam({ rect: [0, 760, 760, 300], pad: 10 }, ovEnd, 0.9);
  t = press(B, 'B01:ct_window', t + 0.02, { fx: 0.94, note: 'the CT window list' });
  B.show('B07', t, { mode: 'reveal', rect: B.rectOf('B07:listbox') });
  say(B, '3.4', t - 0.3, 5.0);
  r = B.ring('B07:listbox', t + 0.15, { pad: [6, 8, 2, 8], around: [29, 768, 302, 256] });
  t = press(B, 'B07:option:Lung', t + 1.5, { fx: 0.45, note: 'Lung' });
  B.ringOut(r, t - 0.25);
  B.show('B08', t, { mode: 'cut' });
  t = press(B, 'B08:ct_window', t + 0.9, { fx: 0.94, note: 'the CT window list' });
  B.show('B08b', t, { mode: 'reveal', rect: B.rectOf('B08b:listbox') });
  t = press(B, 'B08b:option:Soft tissue', t + 0.45, { fx: 0.45, note: 'Soft tissue' });
  B.show('B01', t, { mode: 'cut' });
  // the rotating MIP (the app switches the image to PET for it), and a closer look at its player
  t = B.cam({ rect: [0, 166, 1480, 914], pad: 10 }, Math.max(t + 0.35, cue(B, 0.6)), 0.9);
  say(B, '3.6', t - 0.3, 7.0);
  t = press(B, 'B01:opt_mip', t + 0.02, { fx: 0.1, note: '3D rotation (MIP)' });
  B.show('B13', t, { mode: 'cut' });
  t = slide(B, ['B13', 'B14'], 'frames_per_turn', t + 0.25, { step: 0.5 });
  const spin = B.seq('S-MIP-GT', t + 0.05, 0, { loop: true });
  const spinAt = t + 0.05;
  t = B.cam({ rect: [393, 960, 1075, 110], pad: 8, maxZ: 1.7 }, t + 0.5, 0.9);
  [['B14:mip_play', 4], ['B14:mip_seek', 4], ['B14:mip_speed', 4]].forEach(([ref, pad], i) => {
    const kk = B.ring(ref, t + i * 0.95, { pad, dim: false });
    B.ringOut(kk, t + 0.85 + i * 0.95);
  });
  // back on slices, then the PET colour map and its SUV range (the chapter ends on them: the next
  // one starts behind a curtain)
  t = B.cam({ rect: [0, 440, 760, 560], pad: 10 }, Math.max(t + 2.9, cue(B, 0.8)), 0.9);
  t = press(B, 'B14:opt_slices', t + 0.02, { fx: 0.1, note: 'Slice scrubber' });
  B.seqTo(spin, (t - spinAt) * MIP_FPS, spinAt, t - spinAt, 'none');
  B.show('B18', t, { mode: 'cut' });
  t = press(B, 'B18:opt_pet', t + 0.45, { fx: 0.2, note: 'PET' });
  B.show('B04', t, { fade: 0.3 });
  say(B, '3.5', t - 0.2);
  t = press(B, 'B04:pet_cmap', t + 0.45, { fx: 0.94, note: 'the PET colour map list' });
  B.show('B10', t, { mode: 'reveal', rect: B.rectOf('B10:listbox') });
  t = press(B, 'B10:option:Inverted grey', t + 0.5, { fx: 0.45, note: 'Inverted grey' });
  B.show('B11', t, { mode: 'cut' });
  slide(B, ['B11', 'B12a', 'B12b', 'B12c'], 'suv_range', t + 0.15, { i: 1, step: 0.34 });
  const lookEnd = readyAt(B);

  // 04 · running the model ---------------------------------------------------------------------------
  k = chapter(B, 'run', lookEnd);
  B.show('B18', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [1490, 300, 400, 420], pad: 12 }, k.cover + 0.04, 0.001, 'none');
  say(B, '4.1', k.end);
  t = B.cursorEnter(B.pointIn('B18:run_button', 0.82, 0.62), k.end + 0.4);
  B.ring('B18:run_button', t - 0.2, { pad: 8, dim: false });
  B.click(t + 0.35, 'B18:run_button', 'Run model');
  B.ringsOut(t + 0.4, 0.2);
  B.drift(t + 0.6);
  const runEnd = spedRun(B, 'protocol', t + 0.35, [96, 96], SPEED, { where: gpuOf(B, 'B18') });
  sayNext(B, '4.2'); // while the run plays (C2 M1, C3 N2)
  B.cursorOut(runEnd - 0.3);
  B.show('C90', runEnd + 0.3, { mode: 'cut' });
  // the result over the scan, undimmed, then where it was saved (C2, C3, C4)
  t = B.cam({ rect: [393, 330, 1497, 560], pad: 10 }, runEnd + 0.6, 0.9);
  say(B, '4.3', t - 0.3, 6.0);
  const s43 = lastCaption(B).shown;
  r = B.ring('C90:saved_note', Math.max(t + 1.6, s43 + 2.2), { pad: 6 });
  B.callout({ attach: r, off: [-60, 160], side: 'right', ...CALLOUTS.savedTo }, Math.max(t + 1.9, s43 + 2.6));

  // 05 · results and scores ---------------------------------------------------------------------------
  t = readyAt(B);
  k = chapter(B, 'result', t);
  const L1 = lesionOn(B, 'D01');
  B.show('D01', k.cover + 0.02, { mode: 'cut' });
  B.clip('D01h', k.cover + 0.02, { fade: 0.001 });
  B.cam(camAt(L1.centre[0] + 70, L1.centre[1] - 20, 2.5), k.cover + 0.04, 0.001, 'none');
  const legend = B.panel('legend', k.end, null, { pos: [96, 96], words: 0 });
  r = B.lesionRing(L1.centre, L1.radius, k.end + 0.15);
  // 5.1 names all three classes with every legend row lit; each class is then lit in turn (C4)
  say(B, '5.1', k.end, 9.1);
  B.legendFocus(legend, 'found', lastCaption(B).shown + 2.05);
  B.callout({ lesion: r, off: [150, -90], side: 'left', ...CALLOUTS.found }, lastCaption(B).shown + 2.05, 2.0);
  // missed
  t = lastCallout(B).hidden + 0.3;
  B.ringsOut(t - 0.3, 0.25);
  const L2 = lesionOn(B, 'D02');
  B.show('D02', t, { fade: 0.35 });
  B.clip('D02h', t, { fade: 0.35 });
  t = B.cam(camAt(L2.centre[0] + 50, L2.centre[1] - 10, 3.6), t + 0.45, 0.9);
  B.legendFocus(legend, 'missed', t - 0.4);
  r = B.lesionRing(L2.centre, L2.radius, t);
  B.callout({ lesion: r, off: [140, -80], side: 'left', ...CALLOUTS.missed }, t + 0.1, 2.5);
  // a false alarm, with the rule that sorts them all
  t = lastCallout(B).hidden + 0.3;
  B.ringsOut(t - 0.3, 0.25);
  const L3 = lesionOn(B, 'D03');
  B.show('D03', t, { fade: 0.35 });
  B.clip('D03h', t, { fade: 0.35 });
  t = B.cam(camAt(L3.centre[0] + 50, L3.centre[1] + 10, 3.6), t + 0.45, 0.9);
  B.legendFocus(legend, 'falseAlarm', t - 0.4);
  r = B.lesionRing(L3.centre, L3.radius, t);
  say(B, '5.2', t - 0.3, 5.7);
  B.callout({ lesion: r, off: [140, -80], side: 'left', ...CALLOUTS.falseAlarm }, lastCaption(B).shown + 2.05, 2.0);
  // the scores: the card's own values, each defined as the spotlight reaches its cell (C1, C2, C4)
  t = Math.max(lastCallout(B).hidden, cue(B, 0.8)) + 0.3;
  B.ringsOut(t - 0.3, 0.25);
  B.panelOut(legend, t - 0.3);
  t = B.cam({ rect: [1494, 655, 396, 175], pad: 14, maxZ: 2 }, t, 1.0);
  const card = cardOf(B, 'D03');
  const cells = cardCells(B, 'D03');
  const defs = B.panel('defs', t, null, { pos: [130, 130], words: 34, data: card });
  say(B, '5.3', t - 0.3, 12.9);
  [['counts', 0], ['f1', 2.6], ['sensitivity', 5.6], ['ppv', 7.6], ['dice', 9.6]].forEach(([row, dt]) => {
    B.panelRow(defs, row, t + dt);
    B.spot(B.padded(cells[row], 4), t + dt);
  });
  t = lastCaption(B).hidden;
  B.panelOut(defs, t - 0.1);
  B.spotOff(t - 0.1);
  // the grid it is scored on, then Settings used and the downloads, in one framing (C2)
  t = B.cam({ rect: [1494, 800, 396, 260], pad: 12, maxZ: 2 }, t + 0.05, 0.7);
  r = B.ring('D03:grid_note', t, { pad: 6 });
  say(B, '5.4', t - 0.3);
  // Settings used, and the downloads (the record is shown closed: its table is in the app)
  t = cue(B, 0.2);
  B.ringOut(r, t - 0.3);
  B.ring(B.union('D03:settings_used', 'D03:dl_mask', 'D03:dl_record'), t, { pad: 6 });
  say(B, '5.5', t - 0.15);

  // 06 · lesion list ---------------------------------------------------------------------------
  t = readyAt(B);
  k = chapter(B, 'list', t);
  B.show('D11', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [393, 560, 1497, 520], pad: 10 }, k.cover + 0.04, 0.001, 'none');
  B.show('E01', k.end, { mode: 'scroll', dur: 0.6 });
  say(B, '6.1', k.end, 6.6);
  t = press(B, 'E01:lesions', k.end + 0.65, { fx: 0.12, note: 'the lesion list' });
  B.show('E02a', t, { mode: 'cut' });
  B.show('E02', t + 0.35, { mode: 'scroll', dur: 0.6 });
  B.cursorOut(t + 0.3);
  // the four columns the caption names, in turn (C2)
  const tbl = B.rectOf('E02:lesion_table');
  const cols = [[619.5, 178], [797.5, 209], [1181.5, 185.5], [1367, 193]];
  // one dim whose hole glides from column to column (a ring's own dim would drop between rings, G5)
  cols.forEach(([x, w], i) => {
    const last = i === cols.length - 1;
    const rect = [x, tbl[1], w, 420];
    const kk = B.ring(rect, t + 1.15 + i * 1.0, { pad: 2, dim: false });
    B.spot(B.padded(rect, 2), t + 1.15 + i * 1.0);
    B.ringOut(kk, t + 2.05 + i * 1.0 + (last ? 0.4 : 0), last ? 0.3 : 0.2);
    if (last) B.spotOff(t + 2.05 + i * 1.0 + 0.4, 0.4);
  });
  // tick a row: the viewer jumps to that lesion
  const e3 = B.cap('E03');
  say(B, '6.2', cue(B, 0.1));
  t = press(B, e3.click.row_rect, lastCaption(B).at + 0.5, { fx: (e3.click.at[0] - e3.click.row_rect[0]) / e3.click.row_rect[2], note: 'a row of the list' });
  B.show('E03', t, { mode: 'cut' });
  B.show('E04', t + 0.5, { mode: 'scroll', dur: 0.8 });
  const L4 = lesionOn(B, 'E04');
  t = B.cam(camAt(L4.centre[0] + 60, L4.centre[1] + 40, 1.8), t + 1.4, 0.9);
  B.lesionRing(L4.centre, L4.radius, t);
  const jumpSeen = t + 0.45 + 1.6; // the lesion it jumped to, held before the curtain (C2 S3)

  // 07 · single scan input: no ground truth ---------------------------------------------------
  t = Math.max(readyAt(B), jumpSeen);
  k = chapter(B, 'nogt', t);
  B.show('A14', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [0, 150, 1290, 360], pad: 16 }, k.cover + 0.04, 0.001, 'none');
  r = B.ring('A14:seg_single', k.end + 0.05, { pad: 5, dim: false }); // the input it is on (C3 N6)
  say(B, '7.1', k.end);
  t = press(B, 'A14:single_ct', k.end + 0.9, { fx: 0.3, note: 'the CT box' });
  B.ringOut(r, t - 0.3);
  B.drift(t + 0.1);
  t = typed(B, ['G01', 'G02', 'G03'], t + 0.15, 0.26);
  t = press(B, 'G03:single_pet', t + 0.25, { fx: 0.3, note: 'the PET box' });
  B.drift(t + 0.1);
  t = typed(B, ['G04', 'G05', 'G06'], t + 0.12, 0.26);
  B.show('G07', t + 0.3, { mode: 'cut' });
  t = B.cam({ rect: [1490, 156, 404, 560], pad: 14 }, t + 0.65, 1.0);
  r = B.ring('G07:badges', t, { pad: 6 });
  say(B, '7.2', t - 0.3);
  t = press(B, 'G07:run_button', t + 1.6, { fx: 0.82, fy: 0.62, note: 'Run model' });
  B.ringOut(r, t - 0.3);
  B.drift(t + 0.15);
  const run3 = spedRun(B, 'single', t - 0.15, [96, 96], SPEED_LATER);
  B.cursorOut(run3 - 0.2);
  B.show('G90', run3 + 0.3, { mode: 'cut' });
  t = B.cam({ rect: [393, 330, 1497, 560], pad: 10 }, run3 + 0.6, 0.9);
  say(B, '7.3', t - 0.3, 6.0);
  r = B.ring('G90:alert_info', t + 0.2, { pad: 6 });
  B.ringOut(r, t + 1.9);
  B.show('G91', t + 2.1, { mode: 'scroll', dur: 0.8 });
  B.ring([616.5, B.rectOf('G91:lesion_table')[1], 190.5, 420], t + 3.0, { pad: 2 });

  // 08 · model settings ---------------------------------------------------------------------------
  t = readyAt(B);
  k = chapter(B, 'settings', t);
  B.show('F02', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [0, 30, 360, 260], pad: 10 }, k.cover + 0.04, 0.001, 'none');
  r = B.ring(B.union('F02:settings_caption', 'F02:reset_protocol'), k.end + 0.05, { pad: 6 });
  say(B, '8.1', k.end);
  // the threshold and the smallest lesion, typed
  t = B.cam({ rect: [0, 470, 360, 290], pad: 10 }, cue(B, 1.0), 0.8);
  B.ringOut(r, t - 0.8);
  t = press(B, 'F02:threshold', t + 0.02, { fx: 0.3, fy: 0.75, note: 'Probability threshold' });
  say(B, '8.2', t - 0.2, 7.7); // read with its callout (G4)
  t = typed(B, ['F02t1', 'F02t2', 'F02t3'], t + 0.15, 0.26);
  B.show('F03', t + 0.3, { fade: 0.25 }); // Enter
  t = press(B, 'F03:min_voxels', t + 0.85, { fx: 0.3, fy: 0.75, note: 'Smallest lesion' });
  t = typed(B, ['F03t1'], t + 0.15, 0.26);
  B.show('F04', t + 0.3, { fade: 0.25 }); // Enter
  r = B.ring('F04:min_voxels_note', t + 0.55, { pad: 6 });
  B.drift(t + 0.6);
  B.callout({ attach: r, off: [90, 0], side: 'left', ...CALLOUTS.minVoxels }, Math.max(t + 0.7, lastCaption(B).shown + 2.05));
  // the probability map, ticked before the run (the sidebar scrolls down to it)
  t = calloutDone(B) + 0.1;
  B.ringsOut(t - 0.1, 0.25);
  B.show('F05pre', t, { mode: 'scroll', dur: 0.6 });
  t = B.cam({ rect: [0, 800, 360, 160], pad: 12 }, t + 0.7, 0.9);
  t = press(B, 'F05pre:save_prob', t + 0.02, { fx: 0.06, note: 'Save the probability map' });
  B.show('F05', t, { fade: 0.15 });
  B.drift(t + 0.1);
  say(B, '8.4', t - 0.3);
  // flagged as custom; run it there (24x: the wait was shown in chapter 04), the card below
  t = B.cam({ rect: [1490, 320, 400, 720], pad: 12 }, cue(B, 0.9), 1.0);
  r = B.ring('F05:alert_custom', t, { pad: 6 });
  say(B, '8.3', t - 0.3, 9.7); // spans the run and the card with its callout (G4)
  t = press(B, 'F05:run_button', t + 1.4, { fx: 0.82, fy: 0.62, note: 'Run model' });
  B.ringOut(r, t - 0.3);
  B.drift(t + 0.15);
  const run2 = spedRun(B, 'custom', t - 0.15, [96, 96], SPEED_LATER);
  B.cursorOut(run2 - 0.2);
  B.show('F90', run2 + 0.3, { mode: 'cut' });
  // the custom result beside the protocol run's counts (both the cards' own numbers; C2 S3, C3 N4)
  r = B.ring('F90:metrics', run2 + 0.6, { pad: 6 });
  B.callout({ attach: r, off: [-90, 0], side: 'right', ...CALLOUTS.protocolWas(cardOf(B, 'D03')) }, run2 + 1.0);
  t = press(B, 'F90:saved_runs', calloutDone(B) + 0.2, { fx: 0.94, note: 'Saved runs for this scan' });
  B.ringOut(r, t - 0.3);
  B.show('F91', t, { mode: 'reveal', rect: B.rectOf('F91:listbox') });
  r = B.ring('F91:listbox', t + 0.2, { pad: 6 });
  say(B, '8.5', t - 0.2);
  t = cue(B, 0.3);
  B.ringOut(r, t - 0.2);
  B.show('F90', t, { mode: 'cut' }); // Escape: the list closes
  // the probability overlay: the sidebar back at the top, Probability picked under Overlay, then
  // the overlay itself on the viewer
  // the window's corner with a margin: the option sits on its top edge, which a fill cuts (C2 S4)
  t = B.cam(cornerCam(1.6, 96), t + 0.4, 1.0);
  B.show('F92', t + 0.15, { mode: 'scroll', dur: 0.7 });
  r = B.ring('F92:opt_prob', t + 0.95, { pad: 5 });
  say(B, '8.6', t + 0.6);
  // the overlay on the viewer, with the viewer's own legend row, held (C2 S3, C3 N5); [Reset to
  // protocol] is named under 8.1, where it is ringed (C2: the reset beat cut for length)
  t = B.cam({ rect: [408, 600, 812, 470], pad: 10, maxZ: 1.6 }, t + 2.6, 1.0);
  B.ringOut(r, t - 1.0);
  const probSeen = t + 2.2;

  // 09 · overlay colours -------------------------------------------------------------------------------
  t = Math.max(readyAt(B), probSeen);
  k = chapter(B, 'yours', t);
  B.show('H00', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [0, 560, 900, 520], pad: 10 }, k.cover + 0.04, 0.001, 'none');
  t = press(B, 'H00:overlay_colours', k.end + 0.02, { fx: 0.2, fy: 0.4, note: 'Overlay colours' });
  B.show('H01', t, { mode: 'scroll', dur: 0.6 });
  say(B, '9.1', t);
  t = press(B, 'H01:opt_outline', t + 0.7, { fx: 0.12, note: 'Outline' });
  B.show('H02', t, { fade: 0.25 });
  t = slide(B, ['H02', 'H03'], 'overlay_alpha', t + 0.2, { step: 0.5 });
  t = press(B, 'H03:scheme', t + 0.1, { fx: 0.94, note: 'Colour scheme' });
  B.show('H04', t, { mode: 'reveal', rect: B.rectOf('H04:listbox') });
  t = press(B, 'H04:option:Motion graphics, dark', t + 0.45, { fx: 0.45, note: 'Motion graphics, dark' });
  B.show('H05', t, { mode: 'cut' });
  B.drift(t + 0.1);
  B.ring('H05:scheme', Math.max(t + 0.3, cue(B, 0.2)), { pad: 6, dim: false });
  say(B, '9.2', t + 0.3); // the scheme named, under a caption (C2 N2, C3 N10)

  // 10 · errors and warnings ---------------------------------------------------------------------
  t = readyAt(B);
  k = chapter(B, 'wrong', t);
  B.show('I01', k.cover + 0.02, { mode: 'cut' });
  B.cam({ rect: [1490, 320, 400, 330], pad: 14 }, k.cover + 0.04, 0.001, 'none');
  r = B.ring('I01:alert_weights', k.end + 0.05, { pad: 6 });
  say(B, '10.1', k.end, 7.4);
  B.callout({ attach: r, off: [-90, 0], side: 'right', ...CALLOUTS.weightsFix }, lastCaption(B).shown + 2.05);
  // CT and PET swapped in Single scan: a cut on a still camera, once the error's words are read (C2)
  t = Math.max(calloutDone(B), lastCaption(B).hidden) + 0.35;
  B.ringOut(r, t - 0.35);
  B.show('I02', t, { mode: 'cut' });
  r = B.ring(B.union('I02:alert_pet_units', 'I02:alert_ct_units'), t + 0.3, { pad: 6 });
  say(B, '10.2', t + 0.25, 7.4);
  B.callout({ attach: r, off: [-90, 0], side: 'right', ...CALLOUTS.notSuv }, lastCaption(B).shown + 2.05);

  // 11 · close ---------------------------------------------------------------------------------------
  t = readyAt(B);
  B.chapter('close', '11', 'Close', t);
  B.ringOut(r, t);
  t = B.cam({ rect: [0, 40, 700, 150], pad: 14 }, t + 0.1, 1.25);
  t = B.cursorEnter(B.pointIn('I02:help_button', 0.88, 0.6), t + 0.02);
  r = B.ring('I02:help_button', t, { pad: 8 });
  say(B, '11.1', t - 0.4);
  t = readyAt(B) + 0.05;
  B.cursorOut(t);
  // the credits on the dark stage: the window fades out with its ring and dim, then the credits
  B.T('ttlHide', 0, 1, t + 0.05, 0.7, 'power2.inOut');
  B.panel('credits', t + 0.6, 3.8, { pos: [180, 330], words: 0 });
  B.end(t + 0.6 + 0.4 + 3.8 + 0.25 + 0.4);
  return B;
}

// ---- the checkpoint stub ----------------------------------------------------------------------------

function styleScript(B) {
  titleCard(B, (at) => B.show('A10', at, { mode: 'cut' }));
  B.chapter('what', CHAPTERS.what.num, CHAPTERS.what.name, 5);
  B.chapter('open', CHAPTERS.open.num, CHAPTERS.open.name, 16);
  B.chapter('look', CHAPTERS.look.num, CHAPTERS.look.name, 42);
  let t = 61.0;
  t = B.cam({ rect: [0, 768, 760, 256], pad: 24 }, t, 1.2, 'power2.inOut');
  t = B.cursorEnter(['A10:ct_window', 0.82, 0.62], t + 0.05, 0.8);
  t = B.click(t + 0.12, 'A10:ct_window', 'open the CT window list');
  B.show('B07', t, { mode: 'reveal', rect: [28, 792, 304, 233], dur: 0.16 });
  B.drift(t + 0.35, 70, -14);
  const ring = B.ring('B07:listbox', t + 0.3, { pad: [6, 8, 0, 8], around: [29, 768, 302, 256] });
  const cap = B.caption(CAPTIONS['3.4'], t + 0.45, 8.0);
  B.callout({ attach: ring, off: [84, 0], side: 'left', ...CALLOUTS.ctWindow }, t + 0.45 + 0.35 + 2.0);
  t = cap - 0.6;
  B.chapter('run', CHAPTERS.run.num, CHAPTERS.run.name, t);
  const card = B.card(CHAPTERS.run.num, CHAPTERS.run.name, t);
  B.show('A10', card.cover + 0.05, { mode: 'cut' });
  B.cam({ rect: [1480, 300, 420, 200], pad: 40, maxZ: 1.8 }, card.cover + 0.05, 0.001, 'none');
  t = B.cursorEnter(['A10:run_button', 0.82, 0.7], card.end + 0.05, 0.8);
  B.ring('A10:run_button', t - 0.15, { pad: 8 });
  B.caption(CAPTIONS['4.1'], card.end + 0.1);
  const plan = [['result', 96], ['list', 126], ['nogt', 142], ['settings', 160], ['yours', 186], ['wrong', 199]];
  plan.forEach(([id, at]) => B.chapter(id, CHAPTERS[id].num, CHAPTERS[id].name, at));
  B.chapter('close', '11', 'Close', 213);
  B.end(221);
  return B;
}

export function buildScript(manifest, which = 'full') {
  const B = createBuilder(manifest);
  B.manifest = manifest;
  return which === 'style' ? styleScript(B) : fullScript(B);
}
