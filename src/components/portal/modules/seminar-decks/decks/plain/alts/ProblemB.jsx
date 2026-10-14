import Clip from '../../../engine/Clip';
import { Num, T } from '../../../shared/Num';
import { SCANS } from '../scans.gen';
import { MARKERS, S3 } from '../geometry';
import { Layer, Outlines } from '../scan';
import { EASE, all, fadeIn, isLive, one, pop, rise, track, useTimeline } from '../motion';
import { TURN3 } from './s23.gen';
import './s23.css';

/* ============================================================================
   SLIDE 3, SECOND OPTION — Manual Outlining and Expert Agreement
   ----------------------------------------------------------------------------
   The main slide (slides.jsx, ProblemSlide) with one change on the left: the
   over-100-lesion scan turns once in 3D while its lesions are outlined in
   quick succession from the head down (clips/plain-b-turn.mp4, the label's
   own components in the slide's outline style, made by
   tools/seminar-decks/make_plain_3d_s23.py with the shared engine plain3d.py),
   so the work of outlining over a hundred of them is seen, not told. The turn
   lands on the front view with every lesion drawn, which is the slide's own
   scan and outlines, and the slide cross-fades to them before "over 100" is
   said. The 2022 study on the right is the main slide's timeline unchanged;
   the finished state is the main slide's.
   Beats (58 s read, 101 words): some scans 5.9 s latest, over 100 7.8 (the
   label at 5.6, the turn lands at 7.0); the rest as the main slide.
   ========================================================================== */

function timeline(root, add) {
  // The scan turning while its lesions are outlined (the clip plays from entry),
  // then the slide's own scan and outlines over its landed front view.
  const land = TURN3.land;
  add(track(one(root, 'turn'), [
    { t: 0.3, opacity: 0 }, { t: 1.2, opacity: 1 }, { t: land + 0.3, opacity: 1 }, { t: land + 0.7, opacity: 0 },
  ], EASE.inOut));
  add(track(one(root, 'scan'), [{ t: land, opacity: 0 }, { t: land + 0.2, opacity: 1 }], EASE.inOut));
  add(fadeIn(one(root, 'scan-note'), 0.8));
  add(rise(one(root, 'many'), 5.6, 0.8));
  // From here, the main slide's timeline unchanged.
  add(track(one(root, 'divider'), [{ t: 9.0, transform: 'scaleY(0)' }, { t: 9.8, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'study'), 9.3, 0.8, 16));
  add(rise(one(root, 'experts'), 9.7, 0.8, 16));
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
  add(track(one(root, 'p2a'), [{ t: 25.4, strokeDasharray: '1000 0' }, { t: 25.45, strokeDasharray: '10 10' }], EASE.lin));
  glide(one(root, 'p2b'), apart, 0, 24.0);
  add(fadeIn(one(root, 'p2-fill'), 25.4, 0.6));
  add(rise(one(root, 'p2-num'), 25.4, 0.8, 14));
  add(rise(one(root, 'found-label'), 28.4, 0.8, 14));
  all(root, 'dot').forEach((el, i) => add(pop(el, 28.6 + i * 0.06, 0.4, 0.3)));
  all(root, 'verdict').forEach((el, i) => add(pop(el, 29.6 + i * 0.16, 0.4, 0.5)));
  add(fadeIn(one(root, 'legend'), 30.4));
}

// As the main slide: two experts' outlines as equal circles.
function DicePair({ a, cx, cy, fill }) {
  const r = S3.r;
  const off = fill === 'lens' ? S3.d / 2 : 0;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {fill === 'lens' && <path d={S3.lens} className="dp3-overlap" data-a={`${a}-fill`} />}
      {fill === 'full' && <circle r={r} className="dp3-overlap" data-a={`${a}-fill`} />}
      {fill === 'full' && <circle r={r} className="dp3-c dp3-c--b" data-a={`${a}b`} style={{ transform: `translateX(${off}px)` }} />}
      <circle r={r} className={`dp3-c dp3-c--a${fill === 'full' ? ' is-dashed' : ''}`} data-a={`${a}a`} style={{ transform: `translateX(${-off}px)` }} />
      {fill !== 'full' && <circle r={r} className="dp3-c dp3-c--b" data-a={`${a}b`} style={{ transform: `translateX(${off}px)` }} />}
    </g>
  );
}

export function ProblemSlideB({ ctx }) {
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  // The clip exists only while it can play: live, or preloading as the next slide.
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  const sc = S3.scan;
  return (
    <div className="dp-stage dp3" ref={root}>
      <div className="dp3-scan" data-a="scan">
        <Layer src="figures/plain-b-pet.png" box={sc} alt="Whole-body PSMA PET projection of a scan with over one hundred outlined lesions" />
        <Outlines scan={SCANS.B} box={sc} a="les" className="dp3-outlines" />
      </div>
      {/* Above the scan: it appears under the landed clip, then the clip fades (a plain cross-fade). */}
      {(live || next) && (
        <div className="dpx3-turn" data-a="turn" style={{ left: sc.x - TURN3.padCols * sc.sx, top: sc.y, width: TURN3.cols * sc.sx, height: sc.h }}>
          <Clip src="plain-b-turn" state={live ? 'play' : 'start'} mode={ctx.mode} reduced={ctx.reduced} label="A whole-body PSMA PET turning once in 3D while its lesions are outlined from the head down" />
        </div>
      )}
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
