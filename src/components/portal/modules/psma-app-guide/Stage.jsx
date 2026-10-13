import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { drawCursor, drawLeader, drawLesionRing, drawRing, drawRipple, drawSpotlight, drawWindow, lerpCam, rectToStage,
  toStage } from './camera';
import { cameraOf, cursorOf, seqIndex } from './timeline';
import { APP_H, APP_W, LOOK, SIDEBAR_W, STAGE_H, STAGE_W } from './looks';
import { CHAPTERS, N_CHAPTERS, TITLE } from './copy';
import Panel from './panels';

/* ============================================================================
   PSMA APP GUIDE — STAGE (1920 x 1080, fixed colours)
   ----------------------------------------------------------------------------
   Back to front (C2, C4: no chrome may dim a mark, and nothing sits under the
   player's controls): the ground; canvas 1, the app window with its captures
   and the spotlight; the caption scrim; canvas 2, the marks (highlight rings,
   lesion rings, leaders); callouts, panels and captions; the title; chapter
   cards; the chapter label and strip; canvas 3, the cursor and its ripples.
   draw() reads the timeline's state object and time and nothing else; GSAP's
   onUpdate and every seek call it, so playback and capture draw the same frames.
   ========================================================================== */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const FEATHER = 360; // the curtain's soft edges (C2: wider than one frame of its travel)
const SCRIM_BRIDGE = 3.0; // s: the caption scrim stays up through a gap this short between captions
const GOLD = [214, 177, 43];
const DONE = [201, 210, 227];

// [App names] in a caption are set in gold.
function Rich({ text }) {
  return text.split(/(\[[^\]]+\])/).map((part, i) => (part.startsWith('[')
    ? <span key={i} className="pag-ui">{part.slice(1, -1)}</span> : <span key={i}>{part}</span>));
}

function Words({ text, className }) {
  return (
    <div className={className}>
      {text.split(' ').map((w, i) => <span className="pag-w" key={i}>{w}</span>)}
    </div>
  );
}

// words rise in (v 0 -> 1) and lift away (v 1 -> 2), staggered
function animateWords(node, v) {
  if (!node) return;
  const words = node.querySelectorAll('.pag-w');
  const n = words.length;
  words.forEach((w, i) => {
    let o; let y; let blur;
    if (v <= 1) {
      const p = clamp01(v * (1 + 0.14 * n) - 0.14 * i);
      o = p; y = (1 - p) * 22; blur = (1 - p) * 5;
    } else {
      const p = clamp01((v - 1) * 1.6 - 0.05 * i);
      o = 1 - p; y = -p * 18; blur = p * 3;
    }
    w.style.opacity = o.toFixed(3);
    w.style.transform = `translateY(${y.toFixed(1)}px)`;
    w.style.filter = blur > 0.02 ? `blur(${blur.toFixed(2)}px)` : 'none';
  });
}

/** Where a leader leaves a ring (stage px): the middle of the ring's edge that faces the panel. */
function ringEdge(rect, off) {
  const [x, y, w, h] = rect;
  if (Math.abs(off[0]) >= Math.abs(off[1])) return [off[0] >= 0 ? x + w : x, y + h / 2];
  return [x + w / 2, off[1] >= 0 ? y + h : y];
}

const Stage = forwardRef(function Stage({ B, store, manifest }, apiRef) {
  const winCanvas = useRef(null);
  const marksCanvas = useRef(null);
  const topCanvas = useRef(null);
  const el = useRef({});
  const set = (name) => (node) => { if (node) el.current[name] = node; };

  function canvas2d(c, dpr) {
    const W = Math.round(STAGE_W * dpr);
    const H = Math.round(STAGE_H * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    return ctx;
  }

  function layersAt(S) {
    const out = [];
    B.layers.forEach((L) => {
      const a = S[`L${L.i}`] ?? 0;
      if (a <= 0.001) return;
      if (L.kind === 'seq') {
        out.push({ img: store.get(L.frames[seqIndex(L, S)].file), alpha: a, rect: L.clip });
        return;
      }
      if (L.kind === 'clip') {
        out.push({ img: store.get(L.file), alpha: a, rect: L.rect });
        return;
      }
      const img = store.get(L.file);
      if (L.reveal && (S[`RV${L.i}`] ?? 1) < 0.999) {
        const [x, y, w, h] = L.reveal;
        out.push({ img, alpha: a, clip: [x, y, w, h * clamp01(S[`RV${L.i}`] ?? 0)] });
      } else if (L.scrollFrom && (S[`SC${L.i}`] ?? 1) < 0.999) {
        // each column that scrolled slides from its old position to its new one; the other stays
        const p = clamp01(S[`SC${L.i}`] ?? 0);
        const old = store.get(B.layers[L.scrollFrom.layer].file);
        [[[0, 0, SIDEBAR_W, APP_H], L.scrollFrom.ds], [[SIDEBAR_W, 0, APP_W - SIDEBAR_W, APP_H], L.scrollFrom.dm]].forEach(([col, dy]) => {
          if (Math.abs(dy) < 0.5) {
            out.push({ img, alpha: a, clip: col });
          } else {
            out.push({ img: old, alpha: a, clip: col, shift: -dy * p });
            out.push({ img, alpha: a, clip: col, shift: dy * (1 - p) });
          }
        });
      } else {
        out.push({ img, alpha: a });
      }
    });
    return out;
  }

  function draw(dpr = 1) {
    if (!B || !winCanvas.current) return;
    const S = B.S;
    const t = B.tl.time();
    const E = el.current;
    const cam = cameraOf(B, S, lerpCam);

    // ---- canvas 1: the window and the spotlight ----------------------------------------------------
    const ctx = canvas2d(winCanvas.current, dpr);
    const winA = 1 - clamp01(S.ttlHide ?? 0);
    if (winA > 0.001) drawWindow(ctx, cam, layersAt(S), { alpha: winA });
    const spA = S.spA ?? 0;
    if (spA * winA > 0.001) drawSpotlight(ctx, cam, rectToStage(cam, [S.spX, S.spY, S.spW, S.spH]), spA * winA, dpr);

    // ---- the caption scrim follows the captions and the chapter label (C2: never the window's
    //      geometry), and stays up across short gaps between captions, so it never pumps ---------
    const capA = B.captions.reduce((m, c) => Math.max(m, Math.min(
      smooth((t - c.at + 0.05) / 0.35), smooth((c.hidden + 0.25 + SCRIM_BRIDGE - t) / 0.35))), 0);
    const chNow = B.chapters.find((c) => CHAPTERS[c.id] && t >= c.start && t < c.end);
    const labelA = chNow ? Math.min(smooth((t - chNow.start - 0.6) / 0.4), smooth((chNow.end - t - 0.05) / 0.3)) : 0;
    if (E.scrim) E.scrim.style.opacity = (winA * Math.max(capA, labelA)).toFixed(3);

    // ---- canvas 2: marks (above the scrim, so no chrome ever dims them) ------------------------
    const mk = canvas2d(marksCanvas.current, dpr);
    B.rings.forEach((r) => {
      const a = S[`HA${r.k}`] ?? 0;
      if (a * winA > 0.001) drawRing(mk, rectToStage(cam, r.rect), S[`H${r.k}`] ?? 0, a * winA);
    });
    B.lesionRings.forEach((r) => {
      const a = S[`LA${r.k}`] ?? 0;
      if (a * winA > 0.001) drawLesionRing(mk, toStage(cam, r.centre[0], r.centre[1]), r.radius * cam.z + 6, S[`LR${r.k}`] ?? 0, a * winA);
    });
    B.callouts.forEach((c) => {
      const a = S[`co${c.k}`] ?? 0;
      const d = S[`cl${c.k}`] ?? 0;
      const node = E[`co${c.k}`];
      // every node is set on every frame: a seek can land anywhere
      if (node) node.style.visibility = a > 0.001 ? 'visible' : 'hidden';
      if (a <= 0.001 && d <= 0.001) return;
      let from;
      if (c.lesionRing) {
        const ctr = toStage(cam, c.lesionRing.centre[0], c.lesionRing.centre[1]);
        const rad = c.lesionRing.radius * cam.z + 6;
        const len = Math.hypot(c.off[0], c.off[1]) || 1;
        from = [ctr[0] + (c.off[0] / len) * rad, ctr[1] + (c.off[1] / len) * rad];
      } else if (c.ringRect) {
        from = ringEdge(rectToStage(cam, c.ringRect), c.off);
      } else {
        from = toStage(cam, c.point[0], c.point[1]);
      }
      const to = [from[0] + c.off[0], from[1] + c.off[1]];
      // the leader draws out from the ring on the way in and retracts to it on the way out
      if (d > 0.001) drawLeader(mk, from, to, 1, d);
      if (node) {
        node.style.opacity = clamp01(a).toFixed(3);
        // the panel slides outward, along the leader (C2)
        const len = Math.hypot(c.off[0], c.off[1]) || 1;
        const s = (1 - a) * 16;
        const px = to[0] - (c.off[0] / len) * s;
        const py = to[1] - (c.off[1] / len) * s;
        node.style.transform = c.side === 'right'
          ? `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-100%, -50%)`
          : `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(0, -50%)`;
      }
    });

    // ---- DOM: panels and captions -----------------------------------------------------------------
    B.panels.forEach((p) => {
      const node = E[`pn${p.k}`];
      if (!node) return;
      const a = S[`pn${p.k}`] ?? 0;
      node.style.opacity = clamp01(a).toFixed(3);
      node.style.visibility = a > 0.001 ? 'visible' : 'hidden';
      node.style.transform = `translateY(${((1 - a) * 16).toFixed(1)}px)`;
      // a legend's rows step back while another is lit
      node.querySelectorAll('[data-row]').forEach((row) => {
        row.style.opacity = clamp01(S[`pn${p.k}_${row.dataset.row}`] ?? 1).toFixed(3);
      });
    });
    B.captions.forEach((c) => {
      const node = E[`cap${c.k}`];
      if (!node) return;
      const a = S[`cap${c.k}`] ?? 0;
      node.style.opacity = clamp01(a).toFixed(3);
      // a 5 px rise: an entering caption never dips past y 930, the player's controls (G5)
      node.style.transform = `translateY(${((1 - a) * 5).toFixed(1)}px)`;
      node.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    });

    // ---- the title: complete on frame 0; the type lifts away, then the window fades in around
    //      the logo, which sits exactly on the window's own masthead logo (C2) ------------------
    if (E.title) {
      const out = clamp01(S.ttlOut ?? 0);
      const drift = 1.012 - 0.012 * smooth(S.ttlDrift ?? 0);
      E.title.style.opacity = (1 - out).toFixed(3);
      E.title.style.transform = `translateY(${(-36 * out * out).toFixed(1)}px) scale(${drift.toFixed(4)})`;
      if (E.titleRule) E.titleRule.style.transform = `scaleX(${clamp01(S.ttlR ?? 1).toFixed(4)})`;
    }
    const logo = manifest?.captures?.A01?.rects?.logo;
    if (E.logo && logo) {
      const r = rectToStage(cam, logo);
      const shown = 1 - clamp01(S.ttlLogoA ?? 0);
      E.logo.style.transform = `translate(${r[0].toFixed(2)}px, ${r[1].toFixed(2)}px)`;
      E.logo.style.width = `${r[2].toFixed(2)}px`;
      E.logo.style.height = `${r[3].toFixed(2)}px`;
      E.logo.style.opacity = shown.toFixed(3);
      if (E.logoPlate) {
        // the white plate gives way to the masthead's own white as the window fades in
        E.logoPlate.style.transform = `translate(${(r[0] - 22).toFixed(2)}px, ${(r[1] - 16).toFixed(2)}px)`;
        E.logoPlate.style.width = `${(r[2] + 44).toFixed(2)}px`;
        E.logoPlate.style.height = `${(r[3] + 32).toFixed(2)}px`;
        E.logoPlate.style.opacity = (shown * clamp01(S.ttlHide ?? 1)).toFixed(3);
      }
    }

    // ---- chapter cards ---------------------------------------------------------------------------
    let covered = 0;
    B.cards.forEach((c) => {
      const node = E[`cd${c.k}`];
      if (!node) return;
      const cc = S[`cdC${c.k}`] ?? 0;
      const on = cc > 0.0005 && cc < 1.9995;
      node.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      covered = Math.max(covered, 1 - Math.abs(cc - 1));
      const tx = (cc - 1) * (STAGE_W + 2 * FEATHER);
      const curtain = E[`cdK${c.k}`];
      if (curtain) curtain.style.transform = `translateX(${tx.toFixed(1)}px)`;
      // card text never prints outside the curtain's solid span (C2)
      const left = Math.max(0, tx);
      const right = Math.min(STAGE_W, tx + STAGE_W);
      const clip = `inset(0px ${Math.max(0, STAGE_W - right).toFixed(1)}px 0px ${left.toFixed(1)}px)`;
      const a = S[`cdA${c.k}`] ?? 0;
      const body = E[`cdB${c.k}`];
      if (body) body.style.clipPath = clip;
      const num = E[`cdN${c.k}`];
      if (num) num.style.opacity = clamp01(a).toFixed(3);
      const rule = E[`cdR${c.k}`];
      if (rule) {
        rule.style.transform = `scaleX(${clamp01(S[`cdR${c.k}`] ?? 0).toFixed(4)})`;
        rule.style.opacity = clamp01(a).toFixed(3);
      }
      animateWords(E[`cdT${c.k}`], S[`cdT${c.k}`] ?? 0);
      const agenda = E[`cdG${c.k}`];
      if (agenda) {
        const g = clamp01(S[`cdG${c.k}`] ?? 0);
        agenda.style.clipPath = clip;
        agenda.style.opacity = g.toFixed(3);
        agenda.style.transform = `translateX(${((1 - g) * 20).toFixed(1)}px)`;
      }
      // the gold marker steps from the last chapter's row to this one
      const marker = E[`cdM${c.k}`];
      if (marker) {
        const idx = Number(c.num) - 1;
        const m = smooth(S[`cdM${c.k}`] ?? 0);
        const row = Math.max(0, idx - 1) + (idx > 0 ? m : 1);
        marker.style.transform = `translateY(${(row * AGENDA_ROW).toFixed(1)}px)`;
      }
    });

    // ---- chapter label and strip: a pure function of time --------------------------------------
    const chs = B.chapters.filter((c) => CHAPTERS[c.id]);
    const cur = chs.find((c) => t >= c.start && t < c.end) ?? null;
    if (E.label) {
      if (cur) {
        const a = Math.min(smooth((t - cur.start - 0.6) / 0.4), smooth((cur.end - t - 0.05) / 0.3)) * (1 - smooth(covered * 1.6));
        E.label.style.opacity = a.toFixed(3);
        if (E.labelNum) E.labelNum.textContent = `${CHAPTERS[cur.id].num} / ${String(N_CHAPTERS).padStart(2, '0')}`;
        if (E.labelName) E.labelName.textContent = CHAPTERS[cur.id].name;
      } else {
        E.label.style.opacity = '0';
      }
    }
    const stripA = chs.length ? smooth((t - chs[0].start) / 0.6) * smooth((chs[chs.length - 1].end - t) / 0.6) : 0;
    if (E.strip) E.strip.style.opacity = stripA.toFixed(3);
    chs.forEach((c) => {
      const node = E[`seg${c.id}`];
      if (!node) return;
      const p = t >= c.end ? 1 : t <= c.start ? 0 : (t - c.start) / (c.end - c.start);
      node.style.transform = `scaleX(${p.toFixed(4)})`;
      // a finished chapter eases from gold to the quieter done colour (C2: nothing pops)
      const k = smooth((t - c.end) / 0.4);
      const col = mix(GOLD, DONE, k);
      node.style.background = `rgba(${col.join(', ')}, ${(1 - 0.62 * k).toFixed(3)})`;
    });

    // ---- canvas 3: cursor and ripples --------------------------------------------------------------
    const top = canvas2d(topCanvas.current, dpr);
    B.clicks.forEach((c) => {
      const p = S[`R${c.k}`] ?? 0;
      if (p > 0.001 && p < 0.999) drawRipple(top, toStage(cam, c.pos[0], c.pos[1]), p);
    });
    const pos = cursorOf(B, S);
    const press = B.clicks.reduce((m, c) => Math.max(m, S[`P${c.k}`] ?? 0), 0);
    if (pos) drawCursor(top, toStage(cam, pos[0], pos[1]), S.curA ?? 0, press);
  }

  const drawRef = useRef(draw);
  useLayoutEffect(() => { drawRef.current = draw; });
  useImperativeHandle(apiRef, () => ({
    draw: (dpr) => drawRef.current(dpr),
    camera: () => (B ? cameraOf(B, B.S, lerpCam) : null),
    cursor: () => (B ? cursorOf(B, B.S) : null),
  }), [B]);

  const logoRect = manifest?.captures?.A01?.rects?.logo;
  return (
    <div className="pag-stage" style={{ width: STAGE_W, height: STAGE_H }}>
      <div className="pag-ground" />
      <canvas ref={winCanvas} className="pag-layer" style={{ width: STAGE_W, height: STAGE_H }} />
      <div className="pag-scrim" ref={set('scrim')} />
      <canvas ref={marksCanvas} className="pag-layer" style={{ width: STAGE_W, height: STAGE_H }} />
      <div className="pag-type">
        {B && (
          <>
            {B.callouts.map((c) => (
              <div className={`pag-callout pag-callout--${c.side ?? 'left'}`} key={`co${c.k}`} ref={set(`co${c.k}`)}>
                <div className="pag-callout-text"><Rich text={c.text} /></div>
                {c.sub && <div className="pag-callout-sub"><Rich text={c.sub} /></div>}
              </div>
            ))}
            {B.panels.map((p) => (
              <div className={`pag-panel pag-panel--${p.id}`} key={`pn${p.k}`} ref={set(`pn${p.k}`)}
                style={{ left: p.pos[0], top: p.pos[1] }}>
                <Panel id={p.id} data={p.data} />
              </div>
            ))}
            {B.captions.map((c) => (
              <div className="pag-caption" key={`cap${c.k}`} ref={set(`cap${c.k}`)}><Rich text={c.text} /></div>
            ))}
            <div className="pag-title" ref={set('title')}>
              <div className="pag-title-eyebrow">{TITLE.eyebrow}</div>
              <div className="pag-title-rule" ref={set('titleRule')} />
              <div className="pag-title-main">{TITLE.title}</div>
              <div className="pag-title-sub">{TITLE.sub}</div>
            </div>
            {logoRect && (
              <>
                <div className="pag-logo-plate" ref={set('logoPlate')} />
                <LogoCrop rect={logoRect} refFn={set('logo')} />
              </>
            )}
            {B.cards.map((c) => (
              <div className="pag-card" key={`cd${c.k}`} ref={set(`cd${c.k}`)}>
                <div className="pag-curtain" ref={set(`cdK${c.k}`)} />
                <div className="pag-card-body" ref={set(`cdB${c.k}`)}>
                  <div className="pag-card-num" ref={set(`cdN${c.k}`)}>{c.num}</div>
                  <div className="pag-card-rule" ref={set(`cdR${c.k}`)} />
                  <div ref={set(`cdT${c.k}`)}><Words text={c.title} className="pag-card-title" /></div>
                </div>
                <div className="pag-agenda-wrap" ref={set(`cdG${c.k}`)}>
                  <div className="pag-agenda-marker" ref={set(`cdM${c.k}`)} />
                  <ol className="pag-agenda">
                    {Object.values(CHAPTERS).map((ch) => (
                      <li key={ch.num} className={ch.num === c.num ? 'pag-agenda--on' : ch.num < c.num ? 'pag-agenda--done' : ''}>
                        <span className="pag-agenda-num">{ch.num}</span>{ch.name}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
            <div className="pag-label" ref={set('label')}>
              <span className="pag-label-num" ref={set('labelNum')} />
              <span className="pag-label-name" ref={set('labelName')} />
            </div>
            <div className="pag-strip" ref={set('strip')}>
              {B.chapters.filter((c) => CHAPTERS[c.id]).map((c) => (
                <div className="pag-seg" key={c.id} style={{ flexGrow: c.end - c.start }}>
                  <div className="pag-seg-fill" ref={set(`seg${c.id}`)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <canvas ref={topCanvas} className="pag-layer" style={{ width: STAGE_W, height: STAGE_H }} />
    </div>
  );
});

const AGENDA_ROW = 55.4; // 36 px x 1.15 line height + 14 px gap

/** The app's own UWA Medical Physics logo, cropped from the welcome-page capture's masthead. */
function LogoCrop({ rect, refFn }) {
  const [x, y, w, h] = rect;
  return (
    <div className="pag-logo" ref={refFn}>
      <svg viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
        <image href="/__psma-motion-data/app-guide/captures/A01.png" x="0" y="0" width="1920" height="1080" />
      </svg>
    </div>
  );
}

export default Stage;
