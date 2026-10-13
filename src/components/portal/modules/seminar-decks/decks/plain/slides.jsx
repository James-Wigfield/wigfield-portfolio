import { Logo } from '../../shared/chrome';
import { TALK } from '../../shared/meta';
import { Num, T } from '../../shared/Num';
import { SCANS } from './scans.gen';
import { MARKERS, S2, S3, S4, S5 } from './geometry';
import { Layer, Outlines } from './scan';
import { EASE, all, draw, fadeIn, one, pop, rise, track, useTimeline } from './motion';

/* ============================================================================
   PLAIN DECK — SLIDES 1 TO 6 (built)
   ----------------------------------------------------------------------------
   Each slide draws its FINISHED state in plain markup and CSS (plain.css);
   its timeline (module-level, see motion.js) only adds motion when the slide
   is live. Times are seconds from entering the slide. Beat times follow the
   rule: a beat starts no later than (words before its phrase / words in the
   transcript) x read time x 0.85, and all motion ends by 75% of the read time.
   Words on screen come from the transcript ("said") or the dissertation;
   every digit is a manifest key.
   ========================================================================== */

/* ── 1. Title ──────────────────────────────────────────────────────────────
   A brief entrance, done by about 3 s. */
const TITLE_WORDS = TALK.title.split(' ');

function titleTimeline(root, add) {
  add(track(one(root, 'rule'), [{ t: 0.15, transform: 'scaleX(0)' }, { t: 1.0, transform: 'scaleX(1)' }], EASE.inOut));
  all(root, 'word').forEach((el, i) => add(rise(el, 0.3 + i * 0.045, 0.9, 30)));
  add(rise(one(root, 'name'), 1.3, 0.9));
  add(rise(one(root, 'sup'), 1.55, 0.9));
  add(fadeIn(one(root, 'logo'), 2.0, 1.0));
}

export function TitleSlide({ ctx }) {
  const root = useTimeline(ctx, titleTimeline);
  return (
    <div className="dp-cover" ref={root}>
      <span className="dp-cover__rule" data-a="rule" aria-hidden="true" />
      <h1 className="dp-cover__title" data-req="title" data-role="title">
        {TITLE_WORDS.map((w, i) => (
          <span key={i}>
            <span className="dp-word" data-a="word">{w}</span>
            {i < TITLE_WORDS.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
      <div data-req="supervisors">
        <p className="dp-cover__name" data-a="name" data-role="body">{TALK.presenter}</p>
        <p className="dp-cover__sup" data-a="sup" data-role="body">{TALK.supervisorsLine}</p>
      </div>
      <div className="dp-cover__logo" data-a="logo"><Logo size="large" /></div>
    </div>
  );
}

/* ── 2. Background ─────────────────────────────────────────────────────────
   88 s read; latest starts: 35% 10.3 s, PSMA 19.6, tracer 28.1, PET 32.7,
   CT 38.3, standard scan 44.4, lesions 48.6, kidneys 55.6; all motion over
   by 65 s. The scan is dissertation Figure 2.1 (a), rebuilt in layers. */
const CELL = (() => {
  const C = { x: 392, y: 1000 };
  const R = 760; // membrane mid-line radius
  const half = 392;
  const edgeY = (r) => C.y - Math.sqrt(r * r - half * half);
  const arc = (r) => `M ${C.x - half} ${edgeY(r).toFixed(1)} A ${r} ${r} 0 0 1 ${C.x + half} ${edgeY(r).toFixed(1)}`;
  const proteins = [-3, -2, -1, 0, 1, 2, 3].map((k) => {
    const x = C.x + k * 104;
    const th = Math.asin((x - C.x) / (R + 8));
    const x0 = C.x + (R + 8) * Math.sin(th);
    const y0 = C.y - (R + 8) * Math.cos(th);
    // the left flank of the head, (-24, -24) in the protein's frame, for a leader
    const side = { x: x0 - 24 * Math.cos(th) + 24 * Math.sin(th), y: y0 - 24 * Math.sin(th) - 24 * Math.cos(th) };
    return { k, x: x0, y: y0, deg: (th * 180) / Math.PI, side };
  });
  // The bound tracer sits in the head's pocket, at (0, -50) in the protein's frame.
  const pocket = (p) => {
    const th = (p.deg * Math.PI) / 180;
    return { x: p.x + 50 * Math.sin(th), y: p.y - 50 * Math.cos(th) };
  };
  const from = [[-90, -150], [40, -175], [-30, -160], [70, -150], [-60, -180], [30, -150], [-80, -165]];
  return {
    arc,
    cell: `${arc(R + 8)} L ${C.x + half} 490 L ${C.x - half} 490 Z`,
    R,
    proteins,
    tracers: proteins.map((p, i) => ({ ...pocket(p), dx: from[i][0], dy: from[i][1] })),
  };
})();
const HEAD = 'M -24 0 L -24 -36 Q -24 -50 -10 -50 A 10 10 0 0 0 10 -50 Q 24 -50 24 -36 L 24 0 Z';

function backgroundTimeline(root, add) {
  // The survival figure: centred and large, then to its corner as the cell arrives.
  const stat = 'translate(564px, 231px) scale(1.7)';
  add(track(one(root, 'stat'), [
    { t: 0.3, opacity: 0, transform: stat },
    { t: 1.3, opacity: 1, transform: stat },
    { t: 18.4, opacity: 1, transform: stat, e: EASE.inOut },
    { t: 19.6, opacity: 1, transform: 'translate(0px, 0px) scale(1)' },
  ]));
  // The cell, PSMA on its membrane, then the tracer binding to it.
  add(fadeIn(one(root, 'cell'), 18.7, 1.0));
  all(root, 'membrane').forEach((el) => add(draw(el, 18.8, 1.3)));
  all(root, 'psma').forEach((el, i) => add(pop(el, 19.3 + i * 0.09, 0.5, 0.4)));
  add(fadeIn(one(root, 'cell-label'), 19.6));
  add(fadeIn(one(root, 'schem'), 19.6));
  add(fadeIn(one(root, 'psma-label'), 19.4));
  add(draw(one(root, 'psma-leader'), 19.4, 0.6));
  CELL.tracers.forEach((tr, i) => {
    const el = one(root, `tracer-${i}`);
    add(track(el, [
      { t: 25.0 + i * 0.18, opacity: 0, transform: `translate(${tr.dx}px, ${tr.dy}px)` },
      { t: 25.4 + i * 0.18, opacity: 1, transform: `translate(${tr.dx * 0.8}px, ${tr.dy * 0.8}px)` },
      { t: 26.6 + i * 0.18, opacity: 1, transform: 'translate(0px, 0px)' },
    ], EASE.soft));
    add(track(one(root, `halo-${i}`), [
      { t: 28.2 + i * 0.05, opacity: 0.4, transform: 'scale(1)' },
      { t: 29.2 + i * 0.05, opacity: 0, transform: 'scale(2.4)' },
      { t: 29.3 + i * 0.05, opacity: 0, transform: 'scale(1)' },
      { t: 29.8 + i * 0.05, opacity: 0.4, transform: 'scale(1)' },
    ], EASE.out));
  });
  add(fadeIn(one(root, 'tracer-label'), 25.4));
  add(draw(one(root, 'tracer-leader'), 26.6, 0.6));
  // PET, then CT beside it, then the two fused.
  add(track(one(root, 'pet'), [
    { t: 31.5, opacity: 0, transform: `translateX(${S2.petShift}px) scale(0.97)` },
    { t: 32.7, opacity: 1, transform: `translateX(${S2.petShift}px) scale(1)` },
    { t: 39.6, opacity: 1, transform: `translateX(${S2.petShift}px) scale(1)`, e: EASE.inOut },
    { t: 41.2, opacity: 1, transform: 'translateX(0px) scale(1)' },
  ]));
  add(track(one(root, 'ct'), [
    { t: 36.5, opacity: 0, transform: `translateX(${S2.ctShift + 40}px)` },
    { t: 37.4, opacity: 1, transform: `translateX(${S2.ctShift}px)` },
    { t: 39.6, opacity: 1, transform: `translateX(${S2.ctShift}px)`, e: EASE.inOut },
    { t: 41.2, opacity: 0.75, transform: 'translateX(0px)' },
  ]));
  add(track(one(root, 'tag-pet'), [{ t: 31.9, opacity: 0 }, { t: 32.7, opacity: 1 }, { t: 39.3, opacity: 1 }, { t: 39.8, opacity: 0 }]));
  add(track(one(root, 'tag-ct'), [{ t: 36.8, opacity: 0 }, { t: 37.6, opacity: 1 }, { t: 39.3, opacity: 1 }, { t: 39.8, opacity: 0 }]));
  add(rise(one(root, 'tag-fused'), 40.9, 0.8, 12));
  // Lesions, then the organs that take up the tracer normally, then the context.
  all(root, 'les').forEach((el, i) => add(pop(el, 46.5 + i * 0.15, 0.45, 0.5)));
  add(fadeIn(one(root, 'les-label'), 47.3));
  add(draw(one(root, 'les-leader'), 47.3, 0.5));
  add(fadeIn(one(root, 'uptake'), 52.5));
  ['organ-sal', 'organ-liver', 'organ-kidney'].forEach((n, i) => {
    add(fadeIn(one(root, n), 53.5 + i * 0.35));
    all(root, `${n}-leader`).forEach((el) => add(draw(el, 53.5 + i * 0.35, 0.6)));
    all(root, `${n}-dot`).forEach((el) => add(fadeIn(el, 53.9 + i * 0.35, 0.4)));
  });
  // The ring opens from one lesion, which pulses so the eye finds its centre.
  add(track(one(root, 'les-pulse'), [
    { t: 60.0, transform: 'scale(1)' },
    { t: 60.4, transform: 'scale(1.8)', e: EASE.inOut },
    { t: 60.9, transform: 'scale(1)' },
  ], EASE.out));
  add(track(one(root, 'ring'), [
    { t: 60.1, opacity: 0, transform: 'scale(0.1)' },
    { t: 60.4, opacity: 1, transform: 'scale(0.3)' },
    { t: 61.6, opacity: 1, transform: 'scale(1)' },
  ], EASE.out));
  add(fadeIn(one(root, 'ring-label'), 60.9, 0.7));
  add(draw(one(root, 'ring-leader'), 60.9, 0.5));
}

function CellSchematic() {
  const lead = CELL.proteins[1];
  const tr = CELL.tracers[5];
  return (
    <>
      <svg className="dp2-cell" data-a="cell" width="784" height="490" viewBox="0 0 784 490" aria-hidden="true">
        <path d={CELL.cell} className="dp2-cell__body" />
        <path d={CELL.arc(CELL.R)} className="dp2-cell__bilayer" />
        <path d={CELL.arc(CELL.R + 8)} className="dp2-cell__edge" data-a="membrane" pathLength="1" />
        <path d={CELL.arc(CELL.R - 8)} className="dp2-cell__edge" data-a="membrane" pathLength="1" />
        <path d={`M 64 42 L ${lead.side.x.toFixed(1)} ${lead.side.y.toFixed(1)}`} className="dp-leader" data-a="psma-leader" pathLength="1" />
        <path d={`M 712 126 L ${(tr.x + 10).toFixed(1)} ${(tr.y - 13).toFixed(1)}`} className="dp-leader" data-a="tracer-leader" pathLength="1" />
        {CELL.proteins.map((p) => (
          <g key={p.k} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.deg.toFixed(2)})`}>
            <g data-a="psma" className="dp2-psma">
              <rect x="-6" y="-4" width="12" height="34" rx="5" className="dp2-psma__stem" />
              <path d={HEAD} className="dp2-psma__head" />
            </g>
          </g>
        ))}
        {CELL.tracers.map((t, i) => (
          <g key={i} transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)})`}>
            <g data-a={`tracer-${i}`}>
              <circle r="15" className="dp2-tracer__halo" data-a={`halo-${i}`} />
              <circle r="9" className="dp2-tracer" />
            </g>
          </g>
        ))}
      </svg>
      <p className="dp-label dp2-psma-label" data-a="psma-label" data-role="chart"><b>PSMA</b> (prostate-specific membrane antigen)</p>
      <p className="dp-label dp2-tracer-label" data-a="tracer-label" data-role="chart">Radioactive tracer</p>
      <p className="dp-label dp2-cell-label" data-a="cell-label" data-role="chart">Prostate cancer cell</p>
      <p className="dp-tag dp2-schem" data-a="schem" data-role="foot">Schematic</p>
    </>
  );
}

export function BackgroundSlide({ ctx }) {
  const root = useTimeline(ctx, backgroundTimeline);
  const f = S2.fused;
  const o = S2.organs;
  return (
    <div className="dp-stage dp2" ref={root}>
      <div className="dp2-stat" data-a="stat">
        <p className="dp2-stat__n" data-role="chart"><Num k="lit.survival" /> or less</p>
        <p className="dp2-stat__l" data-role="body">five-year survival once it spreads</p>
      </div>
      <CellSchematic />

      <Layer src="figures/plain-a-ct.png" box={f} a="ct" className="dp2-ct" alt="CT of the same study: the body and its bones, projected front to back" />
      <Layer src="figures/plain-a-pet.png" box={f} a="pet" alt="Whole-body PSMA PET projection: dark is tracer uptake" />
      <Outlines scan={SCANS.A} box={f} a="les" pulse={SCANS.A.contextLesion} />

      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <path d={`M 1240 ${o.parotid.y + 18} L ${o.parotid.x} ${o.parotid.y}`} className="dp-leader" data-a="organ-sal-leader" pathLength="1" />
        <path d={`M 1240 ${o.parotid.y + 18} L ${o.submandibular.x} ${o.submandibular.y}`} className="dp-leader" data-a="organ-sal-leader" pathLength="1" />
        <path d={`M 1240 ${o.liver.y} L ${o.liver.x} ${o.liver.y}`} className="dp-leader" data-a="organ-liver-leader" pathLength="1" />
        <path d={`M 1240 ${o.kidney.y} L ${o.kidney.x} ${o.kidney.y}`} className="dp-leader" data-a="organ-kidney-leader" pathLength="1" />
        {[[o.parotid, 'organ-sal'], [o.submandibular, 'organ-sal'], [o.liver, 'organ-liver'], [o.kidney, 'organ-kidney']].map(([p, n], i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" className="dp-anchor" data-a={`${n}-dot`} />)}
        <path d={`M ${S2.lesionLabel.x + 14} ${S2.lesionLabel.y} L 1648 ${S2.lesionLabel.y}`} className="dp-leader" data-a="les-leader" pathLength="1" />
        <circle cx={S2.ring.x} cy={S2.ring.y} r={S2.ring.r} className="dp2-ring" data-a="ring" />
        <path d={`M ${S2.ring.x + S2.ring.r + 6} ${S2.ring.y} L 1622 ${S2.ring.y}`} className="dp-leader" data-a="ring-leader" pathLength="1" />
      </svg>

      <div className="dp-tagbox dp2-gone" data-a="tag-pet" style={{ left: f.x + S2.petShift, top: 184, width: f.w }}>
        <p className="dp-tagbox__k" data-role="chart">PET</p>
        <p className="dp-tagbox__v" data-role="chart">where the tracer collects</p>
      </div>
      <div className="dp-tagbox dp2-gone" data-a="tag-ct" style={{ left: f.x + S2.ctShift, top: 184, width: f.w }}>
        <p className="dp-tagbox__k" data-role="chart">CT</p>
        <p className="dp-tagbox__v" data-role="chart">anatomy</p>
      </div>
      <p className="dp-tagbox__k dp2-fused" data-a="tag-fused" data-role="chart" style={{ left: f.x, top: 212, width: f.w }}>PSMA PET/CT</p>

      <p className="dp-kicker dp2-uptake" data-a="uptake" data-role="foot" style={{ top: 216 }}>Normal uptake</p>
      <p className="dp-label dp2-organ" data-a="organ-sal" data-role="chart" style={{ top: o.parotid.y + 18 }}>Salivary glands</p>
      <p className="dp-label dp2-organ" data-a="organ-liver" data-role="chart" style={{ top: o.liver.y }}>Liver</p>
      <p className="dp-label dp2-organ" data-a="organ-kidney" data-role="chart" style={{ top: o.kidney.y }}>Kidney</p>
      <p className="dp-label dp2-side" data-a="les-label" data-role="chart" style={{ top: S2.lesionLabel.y }}>Lesions</p>
      <p className="dp-label dp2-side dp2-ring-label" data-a="ring-label" data-role="chart" style={{ top: S2.ring.y }}>Surrounding anatomy</p>
    </div>
  );
}

/* ── 3. The problem ────────────────────────────────────────────────────────
   57 s read; latest starts: over 100 7.7 s, experts disagree 10.1, 2022
   study 12.5, Dice 24.0, 100% 26.9, 7 out of 10 31.7; all over by 42 s.
   Left: one scan from this project's data. Right, apart: the 2022 study. */
function problemTimeline(root, add) {
  add(fadeIn(one(root, 'scan'), 0.3, 0.9));
  add(fadeIn(one(root, 'scan-note'), 0.8));
  const les = all(root, 'les');
  les.forEach((el, i) => add(pop(el, 1.2 + (i * 6.0) / les.length, 0.35, 0.4)));
  add(rise(one(root, 'many'), 5.6, 0.8));
  add(track(one(root, 'divider'), [{ t: 9.0, transform: 'scaleY(0)' }, { t: 9.8, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'study'), 9.3, 0.8, 16));
  add(rise(one(root, 'experts'), 9.7, 0.8, 16));
  // Dice: the first pair glides together and stops at the mean overlap; the
  // second merges completely.
  const glide = (el, from, to, at) => add(track(el, [
    { t: at - 0.4, opacity: 0, transform: `translateX(${from}px)` },
    { t: at, opacity: 1, transform: `translateX(${from}px)`, e: EASE.inOut },
    { t: at + 1.5, opacity: 1, transform: `translateX(${to}px)` },
  ]));
  const apart = S3.r + 46;
  glide(one(root, 'p1a'), -apart, -S3.d / 2, 20.2);
  glide(one(root, 'p1b'), apart, S3.d / 2, 20.2);
  add(fadeIn(one(root, 'expert-labels'), 19.8));
  add(fadeIn(one(root, 'p1-fill'), 21.6, 0.6));
  add(rise(one(root, 'p1-num'), 21.8, 0.8, 14));
  glide(one(root, 'p2a'), -apart, 0, 24.0);
  // the first expert's outline turns dashed only once the two coincide
  add(track(one(root, 'p2a'), [{ t: 25.4, strokeDasharray: '1000 0' }, { t: 25.45, strokeDasharray: '10 10' }], EASE.lin));
  glide(one(root, 'p2b'), apart, 0, 24.0);
  add(fadeIn(one(root, 'p2-fill'), 25.4, 0.6));
  add(rise(one(root, 'p2-num'), 25.4, 0.8, 14));
  // About 7 in 10 of the first expert's lesions found by the second.
  add(rise(one(root, 'found-label'), 28.4, 0.8, 14));
  all(root, 'dot').forEach((el, i) => add(pop(el, 28.6 + i * 0.06, 0.4, 0.3)));
  all(root, 'verdict').forEach((el, i) => add(pop(el, 29.6 + i * 0.16, 0.4, 0.5)));
  add(fadeIn(one(root, 'legend'), 30.4));
}

// Two experts' outlines as equal circles: at rest the first pair overlaps at the
// mean Dice (centres S3.d apart), the second coincides. The resting offset is the
// circle's CSS transform, which the timeline animates from further apart.
function DicePair({ a, cx, cy, fill }) {
  const r = S3.r;
  const off = fill === 'lens' ? S3.d / 2 : 0;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {fill === 'lens' && <path d={S3.lens} className="dp3-overlap" data-a={`${a}-fill`} />}
      {fill === 'full' && <circle r={r} className="dp3-overlap" data-a={`${a}-fill`} />}
      {/* Where the two coincide, the first expert's outline is drawn dashed on top, so both show. */}
      {fill === 'full' && <circle r={r} className="dp3-c dp3-c--b" data-a={`${a}b`} style={{ transform: `translateX(${off}px)` }} />}
      <circle r={r} className={`dp3-c dp3-c--a${fill === 'full' ? ' is-dashed' : ''}`} data-a={`${a}a`} style={{ transform: `translateX(${-off}px)` }} />
      {fill !== 'full' && <circle r={r} className="dp3-c dp3-c--b" data-a={`${a}b`} style={{ transform: `translateX(${off}px)` }} />}
    </g>
  );
}

export function ProblemSlide({ ctx }) {
  const root = useTimeline(ctx, problemTimeline);
  const sc = S3.scan;
  return (
    <div className="dp-stage dp3" ref={root}>
      <div className="dp3-scan" data-a="scan">
        <Layer src="figures/plain-b-pet.png" box={sc} alt="Whole-body PSMA PET projection of a scan with over one hundred outlined lesions" />
        <Outlines scan={SCANS.B} box={sc} a="les" className="dp3-outlines" />
      </div>
      <div className="dp3-many" data-a="many" style={{ left: sc.x + sc.w + 34 }}>
        <p className="dp3-many__n" data-role="body"><T>{'Over {{fair.ge100_cut}} lesions'}</T></p>
        <p className="dp3-many__l" data-role="chart">in some scans</p>
      </div>
      <p className="dp-tag dp3-scan-note" data-a="scan-note" data-role="foot" style={{ left: sc.x, top: sc.y + sc.h + 14 }}>One scan from this project&apos;s data</p>
      <span className="dp3-divider" data-a="divider" aria-hidden="true" />

      <p className="dp-kicker dp3-study" data-a="study" data-role="chart">2022 study, Kendrick et al.</p>
      <p className="dp3-experts" data-a="experts" data-role="body"><T>{'Two experts, the same {{lit.obs_scans}} scans'}</T></p>

      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <DicePair a="p1" cx={1130} cy={510} fill="lens" />
        <DicePair a="p2" cx={1560} cy={510} fill="full" />
        {MARKERS.map((m) => (
          <g key={m.i} transform={`translate(${944 + m.i * 64} 826)`}>
            <circle r="8" className="dp3-dot" data-a="dot" />
            {m.found
              ? <circle r="19" className="dp3-found" data-a="verdict" />
              : <circle r="19" className="dp3-missed" data-a="verdict" />}
          </g>
        ))}
      </svg>
      <div className="dp-fill" data-a="expert-labels">
        <p className="dp-label dp3-ex dp3-ex--a" data-role="chart" style={{ left: 1130 - S3.d / 2, top: 382 }}>First expert</p>
        <p className="dp-label dp3-ex dp3-ex--b" data-role="chart" style={{ left: 1130 + S3.d / 2, top: 382 }}>Second expert</p>
      </div>
      <div className="dp3-num" data-a="p1-num" style={{ left: 1130 - 170 }}>
        <p className="dp3-num__n" data-role="chart"><Num k="lit.obs_dsc_round" /></p>
        <p className="dp3-num__l" data-role="chart">Dice, on average</p>
      </div>
      <div className="dp3-num" data-a="p2-num" style={{ left: 1560 - 170 }}>
        <p className="dp3-num__n" data-role="chart"><Num k="dice.identical" /></p>
        <p className="dp3-num__l" data-role="chart">Identical outlines</p>
      </div>
      <p className="dp3-found-label" data-a="found-label" data-role="body"><T>{'Second expert found about {{lit.obs_found_speech}}'}</T></p>
      <div className="dp3-legend" data-a="legend">
        <p className="dp-label" data-role="chart">
          <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden="true"><circle r="6" className="dp3-dot" /><circle r="15" className="dp3-found" /></svg>
          Found
        </p>
        <p className="dp-label" data-role="chart">
          <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden="true"><circle r="6" className="dp3-dot" /><circle r="15" className="dp3-missed" /></svg>
          Missed
        </p>
      </div>
    </div>
  );
}

/* ── 4. PSMASegmentator ────────────────────────────────────────────────────
   40 s read; latest starts: nnU-Net 10.7 s, 1,035 18.0, 3D CNNs 20.5, GPU
   memory 25.8; all over by 30 s. Only PSMASegmentator's patch is drawn. */
function baselinesTimeline(root, add) {
  add(fadeIn(one(root, 'scan'), 0.3, 1.0));
  add(rise(one(root, 'who'), 0.4, 0.8, 16));
  add(rise(one(root, 'nnunet'), 9.0, 0.8, 16));
  add(rise(one(root, 'trained'), 15.8, 0.8, 16));
  add(rise(one(root, 'cant'), 19.4, 0.8, 16));
  // The patch to scale, with everything outside it dimmed.
  add(draw(one(root, 'patch-line'), 19.6, 1.0));
  add(fadeIn(one(root, 'spot'), 19.8, 1.0));
  add(fadeIn(one(root, 'dims'), 24.6));
  add(fadeIn(one(root, 'legend'), 20.6));
  add(rise(one(root, 'gpu'), 23.8, 0.8, 16));
  // It cannot hold the whole scan: it steps down to the next position.
  const down = `translateY(${S4.travel}px)`;
  all(root, 'move').forEach((el) => add(track(el, [
    { t: 22.8, transform: 'translateY(0px)', e: EASE.inOut },
    { t: 25.0, transform: down },
  ])));
  add(fadeIn(one(root, 'ghost'), 23.0, 0.8));
}

export function BaselinesSlide({ ctx }) {
  const root = useTimeline(ctx, baselinesTimeline);
  const sc = S4.scan;
  const p = S4.patch;
  // At rest the patch sits at its second position, the bottom of the scan.
  const moved = { transform: `translateY(${S4.travel}px)` };
  return (
    <div className="dp-stage dp4" ref={root}>
      <div className="dp4-text">
        <p className="dp4-who" data-a="who" data-role="body">Open-source tool by Joel Noble, PhD student, UWA Medical Physics Research Group</p>
        <p className="dp4-line" data-a="nnunet" data-role="body">Built on nnU-Net, a CNN framework that configures itself to any new dataset</p>
        <p className="dp4-line" data-a="trained" data-role="body"><T>{'Trained on {{psm.train}} cases'}</T></p>
        <p className="dp4-line" data-a="cant" data-role="body">3D CNNs can&apos;t see the entire scan at once</p>
        <p className="dp4-line dp4-line--accent" data-a="gpu" data-role="body">GPU memory limits patch size</p>
        <div className="dp4-legend" data-a="legend">
          <p className="dp-label" data-role="chart">
            <span className="dp4-swatch" aria-hidden="true" />
            <span>PSMASegmentator&apos;s patch, to scale: <Num k="psm.patch" /> voxels</span>
          </p>
          <p className="dp-tag" data-role="foot">Coronal view; front to back not shown</p>
        </div>
      </div>

      <div className="dp-fill" data-a="scan">
        <Layer src="figures/plain-a-pet.png" box={sc} alt="Whole-body PSMA PET projection" />
      </div>
      <div className="dp4-clip" style={{ left: sc.x, top: sc.y, width: sc.w, height: sc.h }} aria-hidden="true">
        <div data-a="move" className="dp4-move" style={moved}>
          <div className="dp4-spot" data-a="spot" style={{ left: p.x - sc.x, top: 0, width: p.w, height: p.h }} />
        </div>
      </div>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        {/* The first position, open at the bottom where the patch now sits. */}
        <path d={`M ${p.x} ${p.y + S4.travel} V ${p.y} H ${p.x + p.w} V ${p.y + S4.travel}`} className="dp4-ghost" data-a="ghost" />
        <g data-a="move" style={moved}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} className="dp4-patch" data-a="patch-line" pathLength="1" />
        </g>
      </svg>
      <div data-a="move" className="dp4-dims" style={{ left: p.x, top: p.y, width: p.w, height: p.h, ...moved }}>
        <div data-a="dims">
          <p className="dp-label dp4-dim dp4-dim--w" data-role="chart" style={{ left: 0, top: p.h + 10, width: p.w }}><Num k="psm.patch_x_mm" /></p>
          <svg className="dp4-vline" width="24" height={p.h} viewBox={`0 0 24 ${p.h}`} style={{ left: p.w + 8, top: 0 }} aria-hidden="true">
            <path d={`M 12 1 V ${p.h - 1} M 5 1 H 19 M 5 ${p.h - 1} H 19`} />
          </svg>
          <p className="dp-label dp4-dim dp4-dim--h" data-role="chart" style={{ left: p.w + 40, top: p.h / 2 - 20 }}><Num k="psm.patch_z_mm" /></p>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Mamba ──────────────────────────────────────────────────────────────
   50 s read; latest starts: one step 1.7 s, fixed-size 4.8, selective 7.8,
   built for long sequences 15.6, 3D scan 19.9, flattened 22.6, whole patch
   30.8, cost grows 32.5, free memory 36.0; all over by 37 s. Selection is
   shown in general, on abstract tokens only. */
const HOP = { first: 2.2, every: 0.7, move: 0.35 };
const rowArrive = (i) => (i === 0 ? 2.0 : HOP.first + (i - 1) * HOP.every + HOP.move);
const FLY = { first: 19.4, stagger: 0.03, dur: 1.1 };
const SWEEP = { from: 26.4, to: 30.0 };
const laneX = (i) => S5.lane.x0 + i * S5.lane.pitch;
const sweepAt = (i) => SWEEP.from + ((laneX(i) - laneX(0)) / (S5.chipEnd - laneX(0))) * (SWEEP.to - SWEEP.from);
const KEPT = '#0072b2';

function grey(v, dl = 0, max = 0.96) {
  const l = Math.round(255 * Math.min(max, Math.max(0.35, 0.8 - 0.34 * v + dl)));
  return `rgb(${l - 6}, ${l - 3}, ${l})`;
}

const PALE = '#c9ced6'; // an ignored input (the legend's swatch)

function mambaTimeline(root, add) {
  const { row } = S5;
  const { chipEnd } = S5;
  // Phase 1: a short sequence read one step at a time, keeping or ignoring each
  // input. Unread inputs are outlines; read ones fill, blue if kept, grey if not.
  all(root, 'rowtok').forEach((el, i) => {
    const at = rowArrive(i);
    const keep = S5.rowKeep[i];
    add(track(el, [
      { t: 0.3 + i * 0.04, opacity: 0, transform: 'scale(0.6)' },
      { t: 0.8 + i * 0.04, opacity: 1, transform: 'scale(1)' },
      { t: at, opacity: 1, transform: 'scale(1)' },
      { t: at + 0.3, opacity: 1, transform: keep ? 'scale(1.06)' : 'scale(1)' },
      { t: 14.6, opacity: 1, transform: keep ? 'scale(1.06)' : 'scale(1)' },
      { t: 15.3, opacity: 0, transform: 'scale(0.9)' },
    ]));
    add(track(one(el, 'rowfill'), [{ t: at, opacity: 0 }, { t: at + 0.3, opacity: 1 }, { t: 15.3, opacity: 1 }]));
  });
  add(rise(one(root, 'lab-step'), 1.0, 0.8, 12));
  add(fadeIn(one(root, 'schem'), 1.0));
  add(rise(one(root, 'lab-sel'), 6.8, 0.8, 12));
  // The memory: hops along the row, then (phase 3) glides along the whole lane,
  // drawing a line under everything it has read.
  const keys = [{ t: 1.6, transform: `translateX(${row.x0 - chipEnd}px)` }];
  for (let i = 1; i < row.n; i += 1) {
    const t = HOP.first + (i - 1) * HOP.every;
    keys.push({ t, transform: `translateX(${row.x0 + (i - 1) * row.pitch - chipEnd}px)`, e: EASE.inOut });
    keys.push({ t: t + HOP.move, transform: `translateX(${row.x0 + i * row.pitch - chipEnd}px)` });
  }
  keys.push({ t: 15.4, transform: `translateX(${row.x0 + (row.n - 1) * row.pitch - chipEnd}px)` });
  keys.push({ t: 15.5, transform: `translateX(${laneX(0) - chipEnd}px)` });
  keys.push({ t: SWEEP.from, transform: `translateX(${laneX(0) - chipEnd}px)`, e: EASE.lin });
  keys.push({ t: SWEEP.to, transform: 'translateX(0px)' });
  const chip = one(root, 'chip');
  add(track(chip, keys));
  add(track(one(chip, 'chipbody'), [
    { t: 1.6, opacity: 0 }, { t: 2.0, opacity: 1 }, { t: 14.6, opacity: 1 }, { t: 15.2, opacity: 0 },
    { t: 25.8, opacity: 0 }, { t: 26.2, opacity: 1 },
  ]));
  add(track(one(root, 'trail'), [{ t: SWEEP.from, transform: 'scaleX(0)' }, { t: SWEEP.to, transform: 'scaleX(1)' }], EASE.lin));
  // Phase 2: the 3D feature block builds, then flattens into the long lane.
  all(root, 'cell').forEach((el) => {
    const i = Number(el.dataset.i);
    const c = S5.cells[i];
    const dx = c.cx - laneX(i);
    const dy = c.cy - S5.laneY;
    const build = 15.0 + (c.z * 16 + (c.x + c.y) * 2.2) * 0.022;
    const fly = FLY.first + i * FLY.stagger;
    const at = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    add(track(el, [
      { t: build, opacity: 0, transform: `translate(${dx.toFixed(1)}px, ${(dy - 18).toFixed(1)}px)` },
      { t: build + 0.4, opacity: 1, transform: at },
      { t: fly, opacity: 1, transform: at, e: EASE.inOut },
      { t: fly + FLY.dur, opacity: 1, transform: 'translate(0px, 0px)' },
    ]));
    add(track(one(el, 'iso'), [{ t: fly + 0.25, opacity: 1 }, { t: fly + 0.75, opacity: 0 }], EASE.inOut));
    add(track(one(el, 'sq'), [{ t: fly + 0.25, opacity: 0 }, { t: fly + 0.75, opacity: 1 }], EASE.inOut));
    const s = sweepAt(i);
    // unread lane tokens stay darker than the ignored grey
    add(track(one(el, 'fill'), [{ t: s, backgroundColor: grey(c.v, 0, 0.66) }, { t: s + 0.25, backgroundColor: c.keep ? KEPT : PALE }]));
  });
  add(fadeIn(one(root, 'lab-cube'), 16.6));
  add(fadeIn(one(root, 'ghost'), 20.4, 1.0));
  add(rise(one(root, 'lab-flat'), 21.6, 0.8, 12));
  add(rise(one(root, 'lab-whole'), 26.6, 0.8, 12));
  // Cost against length: a straight line.
  all(root, 'chart').forEach((el) => add(fadeIn(el, 30.3, 0.6)));
  add(draw(one(root, 'cost'), 30.7, 1.2));
  // A hoped-for bigger patch: dashed, growing from the block's size.
  add(track(one(root, 'bigger'), [
    { t: 33.6, opacity: 0, transform: 'scale(0.8)' },
    { t: 33.9, opacity: 1, transform: 'scale(0.8)', e: EASE.inOut },
    { t: 35.6, opacity: 1, transform: 'scale(1)' },
  ]));
  add(rise(one(root, 'lab-bigger'), 34.2, 0.8, 12));
}

function IsoCell({ v }) {
  const s = S5.s;
  const c = S5.cos * s;
  const h = s / 2;
  const half = S5.lane.size / 2;
  return (
    <svg className="dp5-cell__iso" data-a="iso" width={2 * c} height={2 * s} viewBox={`${-c} ${-s} ${2 * c} ${2 * s}`} style={{ left: half - c, top: half - s }} aria-hidden="true">
      <path d={`M 0 ${-s} L ${c} ${-h} L 0 0 L ${-c} ${-h} Z`} fill={grey(v, 0.09)} />
      <path d={`M ${-c} ${-h} L 0 0 L 0 ${s} L ${-c} ${h} Z`} fill={grey(v)} />
      <path d={`M ${c} ${-h} L 0 0 L 0 ${s} L ${c} ${h} Z`} fill={grey(v, -0.09)} />
    </svg>
  );
}

export function MambaSlide({ ctx }) {
  const root = useTimeline(ctx, mambaTimeline);
  const { row, lane, laneY, chart } = S5;
  const half = lane.size / 2;
  const left = laneX(0) - half;
  const right = laneX(S5.N - 1) + half;
  return (
    <div className="dp-stage dp5" ref={root}>
      <p className="dp-label dp5-lab dp5-lab--step" data-a="lab-step" data-role="chart" style={{ left, top: 262 }}>One step at a time, with a fixed-size memory</p>
      <div className="dp-label dp5-lab dp5-lab--sel" data-a="lab-sel" data-role="chart" style={{ right: 1920 - right, top: 262 }}>
        <span>Selective:</span>
        <span className="dp5-key dp5-key--kept" aria-hidden="true" /><span>kept</span>
        <span className="dp5-key dp5-key--ignored" aria-hidden="true" /><span>ignored</span>
      </div>

      {Array.from({ length: row.n }, (_, i) => (
        <div key={i} className="dp5-rowtok" data-a="rowtok" style={{ left: row.x0 + i * row.pitch - row.size / 2, top: laneY - row.size / 2, width: row.size, height: row.size }}>
          <span className={`dp5-rowtok__fill${S5.rowKeep[i] ? ' is-kept' : ''}`} data-a="rowfill" />
        </div>
      ))}

      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <g data-a="ghost" className="dp5-ghost">
          <path d={S5.ghostFaces.top} className="dp5-ghost__top" />
          <path d={S5.ghostFaces.left} className="dp5-ghost__left" />
          <path d={S5.ghostFaces.right} className="dp5-ghost__right" />
          <path d={S5.ghost} className="dp5-ghost__edge" />
        </g>
        <path d={S5.bigger} className="dp5-bigger" data-a="bigger" style={{ transformOrigin: `${S5.front.x}px ${S5.front.y}px` }} />
        <g data-a="chart" className="dp5-chart">
          <path d={`M ${chart.x} ${chart.y} L ${chart.x} ${chart.y + chart.h} L ${chart.x + chart.w} ${chart.y + chart.h}`} className="dp5-axes" />
          <path d={`M ${chart.x} ${chart.y + chart.h} L ${chart.x + chart.w - 20} ${chart.y + 24}`} className="dp5-cost" data-a="cost" pathLength="1" />
        </g>
      </svg>

      <span className="dp5-trail" data-a="trail" aria-hidden="true" style={{ left: laneX(0), top: laneY + 52, width: S5.chipEnd - laneX(0) }} />
      {S5.paint.map((c) => (
        <div key={c.i} className="dp5-cell" data-a="cell" data-i={c.i} style={{ left: laneX(c.i) - half, top: laneY - half, width: lane.size, height: lane.size }}>
          <IsoCell v={c.v} />
          <span className="dp5-cell__sq" data-a="sq">
            <span className={`dp5-cell__fill${c.keep ? ' is-kept' : ' is-ignored'}`} data-a="fill" />
          </span>
        </div>
      ))}

      <div className="dp5-chip" data-a="chip" style={{ left: S5.chipEnd - 38, top: laneY + 40 }}>
        <div className="dp5-chip__body" data-a="chipbody" aria-hidden="true"><span /><span /><span /><span /></div>
      </div>

      <p className="dp-label dp5-lab" data-a="lab-flat" data-role="chart" style={{ left, top: 454 }}>Flattened into a long <span data-tick="">1D</span> sequence</p>
      <p className="dp-label dp5-lab" data-a="lab-whole" data-role="chart" style={{ right: 1920 - right, top: 454 }}>Views across the whole patch</p>
      <p className="dp-label dp5-lab dp5-lab--cube" data-a="lab-cube" data-role="chart" style={{ left: S5.front.x - 200, top: S5.front.y + 12 }}>3D image features</p>
      <p className="dp-label dp5-lab" data-a="lab-bigger" data-role="chart" style={{ left: 540, top: 760 }}>Could free memory for a bigger patch</p>
      <div className="dp-fill" data-a="chart">
        <p className="dp-label dp5-lab" data-role="chart" style={{ right: 1920 - (chart.x + chart.w), top: chart.y - 60 }}>Cost grows linearly with sequence length</p>
        <p className="dp-tag dp5-axis" data-role="foot" style={{ left: chart.x - 58, top: chart.y - 4 }}>Cost</p>
        <p className="dp-tag dp5-axis" data-role="foot" style={{ right: 1920 - (chart.x + chart.w), top: chart.y + chart.h + 10 }}>Sequence length</p>
      </div>
      <p className="dp-tag dp5-schem" data-a="schem" data-role="foot">Schematic</p>
    </div>
  );
}

/* ── 6. The research question ──────────────────────────────────────────────
   25 s read (45 words); latest starts: first question 3.3 s, second 12.8,
   CNN-only version 18.4; all over by 18.8 s. On screen: the two questions in
   James's words (the transcript with "So..." and "really" dropped), each
   with its pair of models. */
function questionTimeline(root, add) {
  add(track(one(root, 'bar1'), [{ t: 2.6, transform: 'scaleY(0)' }, { t: 3.3, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'chips1'), 2.7, 0.8, 12));
  add(rise(one(root, 'q1'), 2.9, 0.9, 18));
  add(track(one(root, 'bar2'), [{ t: 12.2, transform: 'scaleY(0)' }, { t: 12.9, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'hyb2'), 12.3, 0.7, 12));
  add(rise(one(root, 'q2'), 12.5, 0.9, 18));
  // The CNN-only version, as "compared with a CNN-only version" is said: a copy
  // slides out from behind the hybrid and loses the hybrid's blue as it goes; its
  // name shows once it is clear of the hybrid.
  add(fadeIn(one(root, 'vs2'), 17.1, 0.5));
  const cnn = one(root, 'cnn');
  const hyb = one(root, 'hyb2');
  const dx = hyb && cnn ? hyb.offsetLeft - cnn.offsetLeft : 0;
  add(track(cnn, [
    { t: 16.4, opacity: 0, transform: `translateX(${dx}px)` },
    { t: 16.6, opacity: 1, transform: `translateX(${dx}px)`, e: EASE.inOut },
    { t: 17.6, opacity: 1, transform: 'translateX(0px)' },
  ]));
  add(track(one(root, 'cnn-ring'), [{ t: 17.1, opacity: 1 }, { t: 17.9, opacity: 0 }], EASE.inOut));
  add(track(one(root, 'cnn-text'), [{ t: 17.2, opacity: 0 }, { t: 17.9, opacity: 1 }], EASE.inOut));
}

export function QuestionSlide({ ctx }) {
  const root = useTimeline(ctx, questionTimeline);
  return (
    <div className="dp-stage dp6" ref={root}>
      <div className="dp6-rq" data-req="rq">
        <section className="dp6-part">
          <span className="dp6-bar" data-a="bar1" aria-hidden="true" />
          <p className="dp6-chips" data-a="chips1" data-role="chart">
            <span className="dp6-chip is-hybrid">Hybrid CNN-Mamba</span>
            <span className="dp6-vs">vs</span>
            <span className="dp6-chip">PSMASegmentator</span>
          </p>
          <p className="dp6-q" data-a="q1" data-role="body">Does a hybrid CNN-Mamba network find lesions more effectively than PSMASegmentator on scans neither was trained on?</p>
        </section>
        <section className="dp6-part">
          <span className="dp6-bar" data-a="bar2" aria-hidden="true" />
          <p className="dp6-chips" data-role="chart">
            <span className="dp6-chip is-hybrid" data-a="hyb2">Hybrid CNN-Mamba</span>
            <span className="dp6-vs" data-a="vs2">vs</span>
            <span className="dp6-chip dp6-chip--cnn" data-a="cnn">
              <span className="dp6-chip__ring" data-a="cnn-ring" aria-hidden="true" />
              <span data-a="cnn-text">CNN-only version</span>
            </span>
          </p>
          <p className="dp6-q" data-a="q2" data-role="body">Do the Mamba blocks improve lesion detection, compared with a CNN-only version of the same network?</p>
        </section>
      </div>
    </div>
  );
}
