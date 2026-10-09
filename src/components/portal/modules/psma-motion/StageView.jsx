import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createGlStage } from './glStage';
import { buildTimeline, initialState } from './buildTimeline';
import { drawCounted, drawVerdict, drawWindow, drawInset, drawFoldCards, drawFov, drawTurntable, drawOrganLeaders,
  errorCutout, heatCanvas } from './overlay';
import { copyFor } from './copy';
import Schematic from './Schematic';

/* ============================================================================
   PSMA MOTION — STAGE (1920 x 1080, fixed colours)
   ----------------------------------------------------------------------------
   Layers, back to front: WebGL scan, canvas 2D marks, DOM type. drawFrame()
   reads the active case's timeline state and draws all three; it is called by
   the timeline's onUpdate while playing and directly after every seek, and by
   nothing else. Live playback and frame capture therefore draw identical frames.
   ========================================================================== */

export const STAGE_W = 1920;
export const STAGE_H = 1080;
const PANEL_X = 1040;
const PANEL_W = 784;
const BODY_CX = [960, 540];       // beat 1 (centred) -> beats 2-5 (left)
const BODY_MAX_H = 940;
const INSET = { x: PANEL_X, y: 300, w: 300, h: 262 };
const CARDS = { x: PANEL_X, y: 340, w: PANEL_W, cw: 200, ch: 281 };
const COHORTS = /(autoPET-III|DEEP-PSMA)/;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

function numbersOf(manifest) {
  const out = {};
  manifest.numbers.forEach((e) => { out[e.key] = e; });
  return out;
}

// A manifest-backed number (gate G8 reads data-k).
function Num({ n, k }) {
  return <span data-k={k}>{n[k].display}</span>;
}

// Cohort names are set in Plex Mono wherever they appear ("III" must not read as "Ill").
function WithCohorts({ text }) {
  return text.split(COHORTS).map((part, i) =>
    (COHORTS.test(part) ? <span key={i} className="psm-mono">{part}</span> : <span key={i}>{part}</span>));
}

// A title whose words rise in with a light de-blur, staggered (see animateTitle).
function Title({ refFn, title, sub, className = 'psm-title' }) {
  return (
    <div className="psm-title-block" ref={refFn}>
      <div className={className}>
        {title.split(' ').map((w, i) => <span className="psm-w" key={i}>{w}</span>)}
      </div>
      {sub && <div className="psm-sub">{sub}</div>}
    </div>
  );
}

function animateTitle(node, v) {
  if (!node) return;
  node.style.opacity = v > 0.001 ? '1' : '0';
  const words = node.querySelectorAll('.psm-w');
  const n = words.length;
  words.forEach((w, i) => {
    const p = clamp01(v * (1 + 0.12 * n) - 0.12 * i);
    w.style.opacity = p.toFixed(3);
    w.style.transform = `translateY(${((1 - p) * 16).toFixed(1)}px)`;
    w.style.filter = p < 0.999 ? `blur(${((1 - p) * 4).toFixed(2)}px)` : 'none';
  });
  const sub = node.querySelector('.psm-sub');
  if (sub) {
    const p = clamp01(v * 1.6 - 0.6);
    sub.style.opacity = p.toFixed(3);
    sub.style.transform = `translateY(${((1 - p) * 10).toFixed(1)}px)`;
  }
}

// GSAP shapes the glide (one ease only; C3 round 2).
function layoutFor(manifest, layoutT) {
  const { width: W, height: H } = manifest.layer;
  const scale = Math.min(1, BODY_MAX_H / H);
  const cx = lerp(BODY_CX[0], BODY_CX[1], layoutT);
  return {
    W, H, scale,
    originX: Math.round(cx - (W * scale) / 2),
    originY: Math.round((STAGE_H - H * scale) / 2),
  };
}

// The heat ramp as drawn on the cards (overlay.heatCanvas), sampled for the key.
function heatGradient(look) {
  const [h0, h1, h2] = look.gl.prob;
  const base = look.gl.body;
  const stops = [];
  for (let k = 0; k <= 20; k++) {
    const q = k / 20;
    const a = Math.min(1, Math.max(0, (q - 0.03) / 0.32));
    const t = q < 0.5 ? q * 2 : (q - 0.5) * 2;
    const A = q < 0.5 ? h0 : h1;
    const B = q < 0.5 ? h1 : h2;
    const c = [0, 1, 2].map((i) => Math.round(255 * (base[i] + (A[i] + (B[i] - A[i]) * t - base[i]) * a)));
    stops.push(`rgb(${c.join(',')}) ${(q * 100).toFixed(0)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// Beat 1 organ labels in stage pixels; labels on one side keep 48 px apart.
function organItems(man, L) {
  const labs = man.labels_beat1?.labels ?? [];
  const items = labs.map((lb, i) => {
    const ax = L.originX + lb.anchor_px[0] * L.scale;
    const ay = L.originY + lb.anchor_px[1] * L.scale;
    const edge = L.originX + lb.body_edge_px * L.scale;
    const ex = lb.side === 'right' ? edge + 26 : edge - 26;
    return { i, side: lb.side, ax, ay, ex, ty: ay };
  });
  ['left', 'right'].forEach((side) => {
    const col = items.filter((it) => it.side === side).sort((a, b) => a.ay - b.ay);
    for (let k = 1; k < col.length; k++) col[k].ty = Math.max(col[k].ty, col[k - 1].ty + 48);
  });
  return items;
}

const StageView = forwardRef(function StageView({ cases, look, slot, onGl, capture, labels = false }, apiRef) {
  const glCanvas = useRef(null);
  const ovCanvas = useRef(null);
  const flowRef = useRef(null);
  const pulseRef = useRef(null);
  const glStage = useRef(null);
  const el = useRef({});
  const timelines = useRef({});
  const states = useRef({});
  const cards = useRef({});
  const lastMarks = useRef([]);
  const slotRef = useRef(slot);
  const lookRef = useRef(look);
  const casesRef = useRef(cases);
  // keep the latest props for drawFrame, which GSAP calls outside React's render
  useLayoutEffect(() => {
    slotRef.current = slot;
    lookRef.current = look;
    casesRef.current = cases;
  });

  const data = cases[slot];
  const m = data?.manifest;
  const condensed = slot === 'B';   // case B tells the method in a condensed beat
  const n = useMemo(() => (m ? numbersOf(m) : null), [m]);
  const words = useMemo(() => copyFor(m?.cohort), [m]);
  const set = (name) => (node) => { if (node) el.current[name] = node; };

  // ---- WebGL context: created once, handed up for the loader -------------------------
  useLayoutEffect(() => {
    const g = createGlStage(glCanvas.current);
    glStage.current = g;
    onGl?.(g);
    return () => g.dispose();
  }, [onGl]);

  // ---- per-case derived data: marker orders, window rects, heat cards ------------------
  const derived = useRef({});
  useEffect(() => {
    Object.entries(cases).forEach(([s, d]) => {
      if (!d || derived.current[s]?.d === d) return;
      const byRow = (a, b) => a.fp[0][1] - b.fp[0][1];
      const comps = d.components;
      const win = new Float32Array(4 * Math.min(200, d.windows.windows.length));
      d.windows.windows.slice(0, 200).forEach((w, i) => win.set([w.col0, w.row0, w.col1, w.row1], 4 * i));
      const gtOrder = comps.gt.slice().sort(byRow);
      const found = gtOrder.filter((c) => c.verdict === 'found');
      const missed = gtOrder.filter((c) => c.verdict === 'missed');
      derived.current[s] = {
        d,
        pred: comps.pred.slice().sort(byRow),
        gtOrder,
        foundIndex: new Map(found.map((c, i) => [c.id, i])),
        missedIndex: new Map(missed.map((c, i) => [c.id, i])),
        fa: comps.pred.filter((c) => c.verdict === 'false_alarm').sort(byRow),
        removed: comps.removed.slice().sort(byRow),
        win,
        errCut: d.mask0 ? errorCutout(d.mask0, d.manifest.masks.bits) : null,
        foundSpan: timelines.current[s]?.cues?.foundSpan,
      };
      const lk = lookRef.current;
      cards.current[s] = {
        folds: d.anterior.folds.map((b) => heatCanvas(b, lk)),
        mean: heatCanvas(d.anterior.mean, lk),
      };
    });
  }, [cases]);

  // ---- the frame -------------------------------------------------------------------------
  // The drawing function is refreshed after every render and called through a stable
  // function, so GSAP's onUpdate always draws with the current case, look and words.
  const frameFn = useRef(null);
  function drawFrame() {
    const s = slotRef.current;
    const d = casesRef.current[s];
    const S = states.current[s];
    const dv = derived.current[s];
    const g = glStage.current;
    const lk = lookRef.current;
    if (!d || !S || !dv || !g) return;
    if (dv.foundSpan === undefined) dv.foundSpan = timelines.current[s]?.cues?.foundSpan;
    const man = d.manifest;
    const N = man.rotation.n_angles;
    const dpr = capture ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const L = layoutFor(man, S.layout);
    const a = ((S.angle % 360) + 360) % 360;
    const pos = a / (360 / N);
    // While no mask layer shows (beat 1), neighbouring angle layers are cross-dissolved by
    // the fractional angle; whenever a mask shows, everything sits on the nearest layer.
    const masksShown = S.pred + S.thresh + S.verdict + S.gt + S.heat > 1e-4;
    let angleIndex2 = 0;
    let angleMix = 0;
    if (masksShown) {
      L.angleIndex = Math.round(pos) % N;
    } else {
      L.angleIndex = Math.floor(pos) % N;
      angleIndex2 = (L.angleIndex + 1) % N;
      angleMix = pos - Math.floor(pos);
    }

    // WebGL scan
    g.resize(STAGE_W, STAGE_H, dpr);
    const winIdx = Math.min(d.windows.n - 1, Math.floor(S.win));
    const sweeping = S.cover >= 0.999;
    const accLayer = !sweeping || !d.accum ? -1
      : d.accum.perWindow ? Math.max(0, winIdx) : Math.floor(Math.max(0, winIdx) / d.windows.sw_batch_size);
    g.draw(s, {
      angleIndex: L.angleIndex, angleIndex2, angleMix,
      originX: L.originX, originY: L.originY, scale: L.scale,
      body: S.body, bone: S.bone, pet: S.pet, petLo: 1.15, petKnee: 7.0, petHi: 12.0, petGamma: 0.85,
      dim: S.dim, feather: 12,
      heat: S.heat, heatMean: S.heatMean, thresh: S.thresh, removed: S.removed,
      cover: sweeping ? Math.max(0, winIdx + 1) : -1, windows: dv.win, accLayer,
      wipe: S.wipe, removedHi: S.removedRing,
      pred: S.pred, edge: S.edge, gt: S.gt, verdict: S.verdict,
      found: 1, missed: 1, fa: 1,
    }, lk, dpr);

    // canvas 2D marks
    const ov = ovCanvas.current;
    const W = Math.round(STAGE_W * dpr);
    const H = Math.round(STAGE_H * dpr);
    if (ov.width !== W || ov.height !== H) { ov.width = W; ov.height = H; }
    const ctx = ov.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    const marks = [];
    const frame = {
      winAlpha: S.winA, win: d.windows.windows[winIdx], insetAlpha: S.inset * (1 - 0.5 * S.winDim),
      cardsAlpha: S.cards, cardsFan: S.fan, cardsMerge: S.merge,
    };
    const orgs = S.labels > 0 ? organItems(man, L) : [];
    drawOrganLeaders(ctx, orgs, S.labels, lk);
    drawFov(ctx, L, d, S.fov, lk);
    drawWindow(ctx, L, frame.win, frame, lk);
    drawInset(ctx, frame, d, lk, INSET, d.thumb, words.beat2.depth);
    drawFoldCards(ctx, frame, cards.current[s], lk, CARDS);
    drawTurntable(ctx, L, a, S.body * (1 - S.gtRingA) * 0.9, lk);
    const nUnf = man.numbers.find((e) => e.key === 'case.n_pred_unfiltered').value;
    drawCounted(ctx, L, { kind: 'removed', items: dv.removed, count: nUnf - S.regions, alpha: S.removedRing,
      shape: 'circle', colour: lk.marker.removed, dashed: true, width: 3.5 }, lk, marks);
    drawCounted(ctx, L, { kind: 'pred', items: dv.pred, count: S.predMk, alpha: S.predMkA,
      shape: 'circle', colour: lk.marker.pred }, lk, marks);
    drawVerdict(ctx, L, dv, S, lk, marks);
    lastMarks.current = marks;

    // DOM type
    const E = el.current;
    const op = (name, v) => { if (E[name]) E[name].style.opacity = v.toFixed(3); };
    animateTitle(E.b1, S.b1);
    op('b1eye', S.b1);
    if (E.b1rule) E.b1rule.style.transform = `scaleX(${S.b1rule.toFixed(4)})`;
    op('b1ct', S.b1ct);
    op('b1pet', S.b1pet);
    op('b1org', S.labels);
    orgs.forEach((it) => {
      const node = E[`org${it.i}`];
      if (!node) return;
      node.style.left = `${(it.side === 'right' ? it.ex + 22 : it.ex - 22).toFixed(1)}px`;
      node.style.top = `${it.ty.toFixed(1)}px`;
      node.style.transform = it.side === 'right' ? 'translateY(-50%)' : 'translate(-100%, -50%)';
    });
    op('orgs', S.labels);
    if (E.panel) {
      E.panel.style.opacity = S.panel.toFixed(3);
      E.panel.style.transform = `translateX(${((1 - S.panel) * 48).toFixed(1)}px)`;
    }
    if (E.rule) E.rule.style.transform = `scaleX(${S.rule.toFixed(4)})`;
    animateTitle(E.t2, S.t2);
    animateTitle(E.t2b, S.t2b);
    animateTitle(E.t3, S.t3);
    animateTitle(E.t4, S.t4);
    animateTitle(E.t5, S.t5);
    op('winInfo', S.inset * (1 - 0.5 * S.winDim));
    op('schem', S.schem * (1 - 0.4 * S.schemDim));
    op('cardsT', S.cardsT);
    op('avgT', S.avgT);
    op('threshT', S.threshT);
    op('filterT', S.filterT);
    op('count3', S.count3);
    op('gtT', S.gtT);
    op('legend', S.legend);
    op('rowM', S.rowM);
    op('rowF', S.rowF);
    op('rule4', S.ruleT);
    op('merged4', S.mergedT);
    op('near4', S.nearT);
    op('legendMini', S.t5);
    op('card', S.card);
    if (E.card) E.card.style.transform = `translateY(${((1 - S.card) * 28).toFixed(1)}px)`;
    if (E.hero) {
      // the pop settles exactly as the count lands
      E.hero.style.transform = `scale(${(0.9 + 0.1 * backOut(clamp01(S.metrics))).toFixed(4)})`;
    }
    op('ctx', S.ctxT);
    op('sel', S.selT);
    if (E.winNow) E.winNow.textContent = String(Math.max(1, Math.min(d.windows.n, winIdx + 1)));
    if (E.regions) E.regions.textContent = String(Math.round(S.regions));
    if (E.predCount) E.predCount.textContent = String(Math.min(dv.pred.length, Math.ceil(S.predMk - 1e-6)));
    const up = (v) => Math.ceil(v - 1e-6);   // counts round up while they run (see buildTimeline)
    if (E.nFound) E.nFound.textContent = String(up(S.nFound));
    if (E.nMissed) E.nMissed.textContent = String(up(S.nMissed));
    if (E.nFa) E.nFa.textContent = String(up(S.nFa));
    if (E.faLabel) E.faLabel.textContent = up(S.nFa) === 1 ? words.beat4.falseAlarmOne : words.beat4.falseAlarm;
    words.beat5.metrics.forEach((mm, i) => {
      const node = E[`metric${i}`];
      if (!node) return;
      const entry = man.numbers.find((e) => e.key === mm.key);
      node.textContent = S.metrics >= 0.999 ? entry.display : (parseFloat(entry.display) * S.metrics).toFixed(1);
    });
    // the network pulse travels the data path once
    const fl = flowRef.current;
    const pd = pulseRef.current;
    if (fl && pd) {
      const len = fl.getTotalLength();
      const pt = fl.getPointAtLength(len * clamp01(S.pulse));
      pd.setAttribute('cx', pt.x.toFixed(2));
      pd.setAttribute('cy', pt.y.toFixed(2));
      pd.setAttribute('opacity', (S.pulse > 0 && S.pulse < 1 ? Math.min(1, Math.sin(Math.PI * S.pulse) * 4) : 0).toFixed(3));
    }
  }
  useLayoutEffect(() => { frameFn.current = drawFrame; });
  const [renderFrame] = useState(() => () => frameFn.current?.());

  // ---- timelines -------------------------------------------------------------------------
  useEffect(() => {
    Object.entries(cases).forEach(([s, d]) => {
      if (!d || timelines.current[s]?.d === d) return;
      timelines.current[s]?.tl.kill();
      const S = initialState(d.manifest.numbers.find((e) => e.key === 'case.n_pred_unfiltered').value);
      states.current[s] = S;
      const built = buildTimeline(d, S, { condensed: s === 'B', dims: lookRef.current.dims, labels });
      built.tl.eventCallback('onUpdate', () => { if (slotRef.current === s) renderFrame(); });
      timelines.current[s] = { ...built, d };
      if (derived.current[s]) derived.current[s].foundSpan = built.cues.foundSpan;
    });
    renderFrame();
  }, [cases, renderFrame, labels]);

  useEffect(() => { renderFrame(); }, [slot, look, renderFrame]);

  // ---- imperative API (keyboard control and the capture hook) -----------------------------
  useImperativeHandle(apiRef, () => ({
    beats: (s) => timelines.current[s]?.beats ?? [],
    duration: (s) => timelines.current[s]?.duration ?? 0,
    cues: (s) => ({ ...(timelines.current[s]?.cues ?? {}), ...(timelines.current[s]?.flags ?? {}) }),
    timeline: (s) => timelines.current[s]?.tl,
    render: renderFrame,
    finish: () => glStage.current?.finish(),
    marks: () => lastMarks.current,
    layout: (s) => {
      const d = casesRef.current[s];
      const S = states.current[s];
      if (!d || !S) return null;
      const L = layoutFor(d.manifest, S.layout);
      const N = d.manifest.rotation.n_angles;
      const a = ((S.angle % 360) + 360) % 360;
      return { ...L, angleIndex: Math.round(a / (360 / N)) % N, angle: a };
    },
    state: (s) => Object.fromEntries(Object.entries(states.current[s] ?? {}).filter(([k]) => !k.startsWith('_'))),
    // colours as drawn (0-255), for gate G7's pixel classifier
    colours: () => ({
      ...Object.fromEntries(Object.entries(lookRef.current.gl)
        .filter(([, v]) => Array.isArray(v) && v.length === 3 && typeof v[0] === 'number')
        .map(([k, v]) => [k, v.map((c) => Math.round(c * 255))])),
      heat2: lookRef.current.gl.prob[2].map((c) => Math.round(c * 255)),
    }),
  }), [renderFrame]);

  const cohort = m?.cohort ?? '';
  const ruleParts = m ? m.selection_rule_short.split(/(\{\w+\})/) : [];
  // beat 1 organ labels: off unless ?labels=1 (C5's suggestion; not in the storyboard)
  const orgLabels = labels ? (m?.labels_beat1?.labels ?? []) : [];
  const showMerged = n && n['case.tp'].value > n['case.pred_components_touching'].value;
  const showNear = data?.components.gt.some((c) => c.overlaps_found_region_angle0);
  const faOne = n && n['case.fp'].value === 1;
  const gtOne = n && n['case.n_gt'].value === 1;

  return (
    <div className="psm-stage" style={{ width: STAGE_W, height: STAGE_H, background: look.bg, color: look.ink,
      '--psm-ink': look.ink, '--psm-ink2': look.ink2, '--psm-muted': look.muted, '--psm-rule': look.rule,
      '--psm-panel': look.panel, '--psm-panel-border': look.panelBorder, '--psm-gold': look.gold }}>
      <canvas ref={glCanvas} className="psm-layer" style={{ width: STAGE_W, height: STAGE_H }} />
      <canvas ref={ovCanvas} className="psm-layer" style={{ width: STAGE_W, height: STAGE_H }} />

      {m && n && (
        <div className="psm-type">
          {/* beat 1: centred scan, caption bottom left, organ labels beside the body */}
          <div className="psm-b1">
            <div className="psm-eyebrow" ref={set('b1eye')}>{m.label} · {cohort}</div>
            <div className="psm-b1-rule" ref={set('b1rule')} />
            <Title refFn={set('b1')} title={words.beat1.title} sub={words.beat1.sub} className="psm-b1-title" />
          </div>
          <div className="psm-orgs" ref={set('orgs')}>
            {orgLabels.map((lb, i) => (
              <div className="psm-orglabel" key={lb.name} ref={set(`org${i}`)}>{lb.name}</div>
            ))}
          </div>
          <div className="psm-layerlabels">
          <div className="psm-layerlabel" ref={set('b1ct')}>
            <span className="psm-swatch" style={{ background: `rgb(${look.gl.bone.map((v) => Math.round(v * 255)).join(',')})` }} />
            {words.beat1.layers.ct}
          </div>
          <div className="psm-layerlabel" ref={set('b1pet')}>
            <span className="psm-swatch" style={{ background: look.id === 'dark' ? '#fff' : '#0b0f18' }} />
            {words.beat1.layers.pet}
          </div>
          {orgLabels.length > 0 && (
            <div className="psm-layerlabel" ref={set('b1org')}>
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                <line x1="5" y1="21" x2="24" y2="5" stroke={look.ink2} strokeWidth="2" />
                <circle cx="5" cy="21" r="4.5" fill={look.ink2} />
              </svg>
              {words.beat1.layers.organs}
            </div>
          )}
          </div>

          {/* right panel, beats 2-5 */}
          <div className="psm-panel" ref={set('panel')} style={{ left: PANEL_X, width: PANEL_W }}>
            <div className="psm-eyebrow">{m.label} · {cohort}</div>
            <div className="psm-chapter-rule" ref={set('rule')} />
            <div className="psm-titles">
              <Title refFn={set('t2')} title={words.beat2.title} sub={condensed ? undefined : words.beat2.sub} />
              <Title refFn={set('t2b')} title={words.beat2b.title} sub={words.beat2b.sub} />
              <Title refFn={set('t3')} title={words.beat3.title} sub={words.beat3.sub} />
              <Title refFn={set('t4')} title={words.beat4.title} sub={words.beat4.sub} />
              <Title refFn={set('t5')} title={words.beat5.title} />
            </div>

            {/* beat 2a: windows and network */}
            <div className="psm-wininfo" ref={set('winInfo')} style={{ top: INSET.y - 8, left: INSET.w + 44 }}>
              <div className="psm-label">{words.beat2.windowLabel}</div>
              {/* a position counter, not a quoted result: G8 checks it against the timeline state */}
              <div className="psm-bignum"><span data-k="counter.window" ref={set('winNow')}>{n['method.n_windows'].display}</span></div>
              <div className="psm-label">{words.beat2.windowOf} <Num n={n} k="method.n_windows" /></div>
              <div className="psm-facts">
                <Num n={n} k="method.patch_zyx" /> {words.beat2.windowFacts[0]}<br />
                <Num n={n} k="method.overlap" /> {words.beat2.windowFacts[1]} · {words.beat2.windowFacts[2]}
              </div>
            </div>
            <div className="psm-schem" ref={set('schem')} style={{ top: 616 }}>
              <Schematic ref={flowRef} pulseRef={pulseRef} features={n['method.features'].value}
                mambaBlocks={n['method.mamba_blocks'].value} nDirections={n['method.n_directions'].display}
                look={look} words={words.beat2.net} />
            </div>

            {/* beat 2b: the ensemble */}
            <div className="psm-caption" ref={set('cardsT')} style={{ top: 700 }}>
              <Num n={n} k="method.n_models" /> {words.beat2b.models}
            </div>
            <div className="psm-caption psm-caption--key" ref={set('avgT')} style={{ top: 700 }}>
              <span>{words.beat2b.average} <Num n={n} k="method.n_models" /> {words.beat2b.averageTail}</span>
              <span className="psm-heatkey">
                <span>{words.beat2b.keyLow}</span>
                <span className="psm-heatbar" style={{ background: heatGradient(look) }} />
                <span>{words.beat2b.keyHigh}</span>
              </span>
            </div>
            <div className="psm-caption" ref={set('threshT')} style={{ top: 766 }}>
              {words.beat2b.threshold} <Num n={n} k="method.threshold" />
            </div>
            <div className="psm-caption" ref={set('filterT')} style={{ top: 832 }}>
              {words.beat2b.filter} <Num n={n} k="method.min_voxels" /> {words.beat2b.filterUnit} (<Num n={n} k="method.min_voxels_ml" /> {words.beat2b.filterMl}) {words.beat2b.filterTail}
              <div className="psm-regions">
                <Num n={n} k="case.n_pred_unfiltered" /> {words.beat2b.regions} <span className="psm-arrow">→</span>{' '}
                <span className="psm-regions-now" data-k="case.n_pred" ref={set('regions')}>{n['case.n_pred'].display}</span>
              </div>
            </div>

            {/* beat 3 */}
            <div className="psm-count" ref={set('count3')} style={{ top: 330 }}>
              <span className="psm-hugenum" data-k="case.n_pred" ref={set('predCount')}>{n['case.n_pred'].display}</span>
              <span className="psm-count-label">{words.beat3.count}</span>
            </div>

            {/* beat 4: the ground-truth row hands over to the verdict rows */}
            <div className="psm-gtlegend" ref={set('gtT')} style={{ top: 344 }}>
              <span className="psm-ringswatch" style={{ borderColor: look.marker.gt }} />
              {words.beat4.gtLegend}
            </div>
            <div className="psm-legend" ref={set('legend')} style={{ top: 340 }}>
              <LegendRow shape="circle" colour={look.verdict.found}
                label={<>{words.beat4.foundOf} <Num n={n} k="case.n_gt" /> {gtOne ? words.beat4.foundOne : words.beat4.found}</>}>
                <span data-k="case.tp" ref={set('nFound')}>{n['case.tp'].display}</span>
              </LegendRow>
              <LegendRow shape="square" colour={look.verdict.missed} label={words.beat4.missed} rowRef={set('rowM')}>
                <span data-k="case.fn" ref={set('nMissed')}>{n['case.fn'].display}</span>
              </LegendRow>
              <LegendRow shape="diamond" colour={look.verdict.falseAlarm}
                label={<span ref={set('faLabel')}>{faOne ? words.beat4.falseAlarmOne : words.beat4.falseAlarm}</span>}
                rowRef={set('rowF')}>
                <span data-k="case.fp" ref={set('nFa')}>{n['case.fp'].display}</span>
              </LegendRow>
            </div>
            <div className="psm-rule" style={{ top: 680 }}>
              <div ref={set('rule4')}>{words.beat4.rule}</div>
              {showMerged && (
                <div className="psm-note" ref={set('merged4')}>
                  <Num n={n} k="case.pred_components_touching" /> {words.beat4.mergedA} <Num n={n} k="case.tp" /> {words.beat4.mergedB}
                </div>
              )}
              {showNear && <div className="psm-note" ref={set('near4')}>{words.beat4.nearMiss}</div>}
            </div>

            {/* beat 5 */}
            <div className="psm-legend-mini" ref={set('legendMini')} style={{ top: 244 }}>
              <MiniKey shape="circle" colour={look.verdict.found}><Num n={n} k="case.tp" /> {words.beat5.found}</MiniKey>
              <MiniKey shape="square" colour={look.verdict.missed}><Num n={n} k="case.fn" /> {words.beat4.missed}</MiniKey>
              <MiniKey shape="diamond" colour={look.verdict.falseAlarm}>
                <Num n={n} k="case.fp" /> {faOne ? words.beat4.falseAlarmOne : words.beat4.falseAlarm}
              </MiniKey>
            </div>
            <div className="psm-card" ref={set('card')} style={{ top: 300 }}>
              {words.beat5.metrics.map((mm, i) => (
                <div className={`psm-metric${i === 0 ? ' psm-metric--hero' : ' psm-metric--row'}`} key={mm.key}>
                  <div className="psm-metric-num" ref={i === 0 ? set('hero') : undefined}>
                    <span data-k={mm.key} ref={set(`metric${i}`)}>{n[mm.key].display}</span><span className="psm-pct">%</span>
                  </div>
                  <div className="psm-metric-text">
                    <div className="psm-metric-name">{mm.name}</div>
                    <div className="psm-metric-gloss">{mm.gloss}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="psm-context" ref={set('ctx')} style={{ top: 812 }}>
              {words.beat5.contextA} <Num n={n} k="test.pooled.n_cases" /> {words.beat5.contextB}{' '}
              {words.beat5.contextF1} <Num n={n} k="test.pooled.f1" />%
            </div>
            <div className="psm-select" ref={set('sel')} style={{ top: 872 }}>
              {ruleParts.map((part, i) => {
                const mm = part.match(/^\{(\w+)\}$/);
                return mm ? <Num key={i} n={n} k={`selection.${mm[1]}`} /> : <WithCohorts key={i} text={part} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function Shape({ shape, colour, size = 30 }) {
  const s = size;
  const st = { stroke: colour, strokeWidth: 4, fill: 'none' };
  return (
    <svg width={s} height={s} viewBox="0 0 30 30" className="psm-shape" aria-hidden="true">
      {shape === 'circle' && <circle cx="15" cy="15" r="11" {...st} />}
      {shape === 'square' && <rect x="4" y="4" width="22" height="22" {...st} strokeDasharray="6 4" />}
      {shape === 'diamond' && <path d="M15 2 L28 15 L15 28 L2 15 Z" {...st} />}
      <circle cx="15" cy="15" r="5.5" fill={colour} />
    </svg>
  );
}

function LegendRow({ shape, colour, label, children, rowRef }) {
  return (
    <div className="psm-legend-row" ref={rowRef}>
      <Shape shape={shape} colour={colour} size={44} />
      <span className="psm-legend-num">{children}</span>
      <span className="psm-legend-label">{label}</span>
    </div>
  );
}

function MiniKey({ shape, colour, children }) {
  return (
    <span className="psm-minikey">
      <Shape shape={shape} colour={colour} size={30} />
      <span>{children}</span>
    </span>
  );
}

export default StageView;
