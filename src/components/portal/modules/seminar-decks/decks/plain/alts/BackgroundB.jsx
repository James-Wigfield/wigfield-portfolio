import Clip from '../../../engine/Clip';
import { Num } from '../../../shared/Num';
import { SCANS } from '../scans.gen';
import { S2 } from '../geometry';
import { Layer, Outlines } from '../scan';
import { EASE, all, draw, fadeIn, isLive, one, pop, rise, track, useTimeline } from '../motion';
import { TURN2 } from './s23.gen';
import { useAt } from './useAt';
import './s23.css';

/* ============================================================================
   SLIDE 2, SECOND OPTION — Metastatic Prostate Cancer and PSMA PET/CT
   ----------------------------------------------------------------------------
   The main slide (slides.jsx, BackgroundSlide) with one change: instead of a
   flat PET beside a flat CT that then slide together, the PET appears where
   the fused view will be and turns once in 3D (clips/plain-a-turn.mp4, made
   from the raw CC BY study by tools/seminar-decks/make_plain_3d_s23.py and
   the shared engine plain3d.py); the CT fuses in during the turn, as the
   transcript pairs the two; the turn lands on the front view, which is the
   slide's own fused layers, and the slide cross-fades to them. The tags name
   PET, then CT, then the fused PSMA PET/CT as each is said. Everything after
   (lesions, normal uptake, the ring) is the main slide's timeline unchanged,
   and the finished state is the main slide's.
   Beats (95 s read, 165 words; recomputed with James's approved wording):
   PET 33.8 s latest (the turn fades in at 31.5), CT 39.6 (fuses in from 37.6),
   standard scan 46.5 (the fused tag at 41.6); the rest as the main slide.
   ========================================================================== */

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
    const side = { x: x0 - 24 * Math.cos(th) + 24 * Math.sin(th), y: y0 - 24 * Math.sin(th) - 24 * Math.cos(th) };
    return { k, x: x0, y: y0, deg: (th * 180) / Math.PI, side };
  });
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

function timeline(root, add) {
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
  // The PSMA PET/CT in 3D: the PET appears and turns once (the clip waits
  // paused on its first frame and starts at TURN2.start, see useAt), the CT
  // fuses in during the turn, and the turn lands on the front view; the
  // slide's own layers fade in over it and the clip leaves.
  const land = TURN2.land;
  add(track(one(root, 'turn'), [
    { t: 31.5, opacity: 0 }, { t: 32.5, opacity: 1 }, { t: land + 0.4, opacity: 1 }, { t: land + 0.8, opacity: 0 },
  ], EASE.inOut));
  // the layers appear under the landed clip (unseen), then the clip fades off them
  add(track(one(root, 'pet'), [{ t: land + 0.1, opacity: 0 }, { t: land + 0.3, opacity: 1 }], EASE.inOut));
  add(track(one(root, 'ct'), [{ t: land + 0.1, opacity: 0 }, { t: land + 0.3, opacity: 0.75 }], EASE.inOut));
  // The CT tag comes once the CT has fused in (37.6 to 39.0), so it never names a bare PET view
  // (design critic, 14 Oct); "+ CT" because it sits over the two together (accuracy check).
  add(track(one(root, 'tag-pet'), [{ t: 31.9, opacity: 0 }, { t: 32.7, opacity: 1 }, { t: 38.6, opacity: 1 }, { t: 39.0, opacity: 0 }]));
  add(track(one(root, 'tag-ct'), [{ t: 39.0, opacity: 0 }, { t: 39.5, opacity: 1 }, { t: 41.0, opacity: 1 }, { t: 41.4, opacity: 0 }]));
  add(rise(one(root, 'tag-fused'), land, 0.8, 12));
  // From here, the main slide's timeline unchanged: lesions, then the organs
  // that take up the tracer normally, then the context.
  all(root, 'les').forEach((el, i) => add(pop(el, 46.5 + i * 0.15, 0.45, 0.5)));
  add(fadeIn(one(root, 'les-label'), 47.3));
  add(draw(one(root, 'les-leader'), 47.3, 0.5));
  add(fadeIn(one(root, 'uptake'), 52.5));
  ['organ-sal', 'organ-liver', 'organ-kidney'].forEach((n, i) => {
    add(fadeIn(one(root, n), 53.5 + i * 0.35));
    all(root, `${n}-leader`).forEach((el) => add(draw(el, 53.5 + i * 0.35, 0.6)));
    all(root, `${n}-dot`).forEach((el) => add(fadeIn(el, 53.9 + i * 0.35, 0.4)));
  });
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

export function BackgroundSlideB({ ctx }) {
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  // The clip exists only while it can play: live, or preloading as the next slide.
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  // The turn starts 31.5 s in: the clip waits preloaded, so a late start cannot shift it.
  const go = useAt(live, TURN2.start);
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
      {/* Above the layers: they appear under it, then it fades (a plain cross-fade). */}
      {(live || next) && (
        <div className="dpx2-turn" data-a="turn" style={{ left: f.x - TURN2.padCols * f.sx, top: f.y, width: TURN2.cols * f.sx, height: f.h }}>
          <Clip src="plain-a-turn" state={go ? 'play' : 'start'} mode={ctx.mode} reduced={ctx.reduced} label="Whole-body PSMA PET of the same study turning once in 3D, with its CT fused in during the turn" />
        </div>
      )}
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

      {/* The tags name each layer as it is said, all over the one panel. */}
      <div className="dp-tagbox dp2-gone" data-a="tag-pet" style={{ left: f.x, top: 184, width: f.w }}>
        <p className="dp-tagbox__k" data-role="chart">PET</p>
        <p className="dp-tagbox__v" data-role="chart">where the tracer collects</p>
      </div>
      <div className="dp-tagbox dp2-gone" data-a="tag-ct" style={{ left: f.x, top: 184, width: f.w }}>
        <p className="dp-tagbox__k" data-role="chart">+ CT</p>
        <p className="dp-tagbox__v" data-role="chart">the anatomy</p>
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
