import Clip from '../../../engine/Clip';
import { Num, T } from '../../../shared/Num';
import { SCANS } from '../scans.gen';
import { S10 } from '../geometry';
import { Layer } from '../scan';
import { EASE, all, fadeIn, isLive, one, rise, track, useTimeline } from '../motion';
import { SPIN } from './spin.gen';
import './alts.css';

/* ============================================================================
   SLIDE 10, SECOND OPTION — Results on the Sealed Test Set
   ----------------------------------------------------------------------------
   The main slide (slides2.jsx, ResultsSlide) with one change at the start: the
   sealed test scan turns once in 3D (clips/plain-c-spin.mp4, made from the raw
   CC BY scan by tools/seminar-decks/make_plain_spin.py) while the opening
   question is asked, then cross-fades into the slide's own projection, which
   is the turn's last frame. Everything after is the main slide's timeline:
   found, missed and false alarm are drawn as they are named. The finished
   state (thumbnails, export, going back, reduced motion) is the main slide's.
   (A second turn with the three classes drawn on it was built on 14 Oct and
   dropped on the design critic's advice: its raster outlines jumped against
   the still's and it ran under the "86%" and Dice beats.)
   ========================================================================== */

function OutlineSet({ list, kind, a }) {
  const sc = S10.scan;
  return (
    <svg className={`dp-outlines dp10-o dp10-o--${kind}`} data-a={a} style={{ left: sc.x, top: sc.y, width: sc.w, height: sc.h }} viewBox={`0 0 ${SCANS.C.w} ${SCANS.C.h}`} preserveAspectRatio="none" aria-hidden="true">
      {list.map((l) => (
        <g key={`${l.cx}-${l.cy}`} className="dp-les">
          <path d={l.d} className="dp-les__fill" />
          <path d={l.d} className="dp-les__casing" />
          <path d={l.d} className="dp-les__edge" />
        </g>
      ))}
    </svg>
  );
}

function timeline(root, add) {
  // The turn (the clip plays from entry: SPIN.turn s, then holds the front
  // view), fading in as the main slide's scan does (0.3 s over 1 s). The clip
  // sits above the slide's own scan, which appears under it once the turn has
  // landed on the same front view; then the clip fades out (a plain
  // cross-fade, no darker overlap).
  add(track(one(root, 'scan'), [{ t: SPIN.turn + 0.05, opacity: 0 }, { t: SPIN.turn + 0.1, opacity: 1 }], EASE.inOut));
  add(track(one(root, 'spin'), [{ t: 0.3, opacity: 0 }, { t: 1.3, opacity: 1 }, { t: SPIN.turn + 0.35, opacity: 1 }, { t: SPIN.turn + 0.75, opacity: 0 }], EASE.inOut));
  // From here, the main slide's timeline unchanged.
  add(rise(one(root, 'kick'), 3.4, 0.8, 10));
  add(rise(one(root, 'f1'), 6.4, 0.9, 20));
  add(rise(one(root, 'found'), 9.2, 0.8, 14));
  add(fadeIn(one(root, 'o-found'), 9.4, 0.8));
  add(fadeIn(one(root, 'o-missed'), 11.0, 0.8));
  add(rise(one(root, 'real'), 12.0, 0.8, 14));
  add(fadeIn(one(root, 'o-fa'), 13.0, 0.8));
  add(fadeIn(one(root, 'legend'), 13.0, 0.8));
  add(rise(one(root, 'dice'), 16.6, 0.8, 14));
  all(root, 'group').forEach((el, i) => add(rise(el, 18.4 + i * 0.2, 0.8, 10)));
  all(root, 'bname').forEach((el, i) => add(fadeIn(el, 18.5 + i * 0.12, 0.6)));
  all(root, 'bar').forEach((el, i) => add(track(el, [{ t: 18.6 + i * 0.12, transform: 'scaleX(0)' }, { t: 19.6 + i * 0.12, transform: 'scaleX(1)' }], EASE.inOut)));
  all(root, 'val').forEach((el, i) => add(fadeIn(el, 19.4 + i * 0.12, 0.5)));
  const dim = (name, from, to) => all(root, name).forEach((el) => add(track(el, [
    { t: from, opacity: 1 }, { t: from + 0.4, opacity: 0.3 }, { t: to, opacity: 0.3 }, { t: to + 0.5, opacity: 1 },
  ], EASE.inOut)));
  dim('not-f1', 20.4, 23.4);
  dim('dim-ap', 24.2, 29.4);
  dim('dim-dp', 30.2, 37.2);
  add(rise(one(root, 'note-ap'), 39.2, 0.8, 10));
  add(rise(one(root, 'note-dp'), 44.2, 0.8, 10));
  add(rise(one(root, 'fair'), 47.8, 0.8, 10));
}

export function ResultsSlideB({ ctx }) {
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  // The clip exists only while it can play: live, or preloading as the next slide.
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  const sc = S10.scan;
  const { bar } = S10;
  const names = ['F1', 'Found', 'Flagged and real'];
  return (
    <div className="dp-stage dp10" ref={root}>
      <div className="dp-fill" data-a="scan">
        <Layer src="figures/plain-c-pet.png" box={sc} alt="Whole-body PSMA PET projection of a sealed test scan, with found, missed and false-alarm outlines" />
      </div>
      {(live || next) && (
        <div className="dpx10-spin" data-a="spin" style={{ left: sc.x - SPIN.padCols * sc.sx, top: sc.y, width: SPIN.cols * sc.sx, height: sc.h }}>
          <Clip src="plain-c-spin" state={live ? 'play' : 'start'} mode={ctx.mode} reduced={ctx.reduced} label="The sealed test scan turning once in 3D: the PET projection front to back at each angle" />
        </div>
      )}
      <OutlineSet list={SCANS.C.found} kind="found" a="o-found" />
      <OutlineSet list={SCANS.C.missed} kind="missed" a="o-missed" />
      <OutlineSet list={SCANS.C.falseAlarm} kind="fa" a="o-fa" />

      <p className="dp-kicker dp10-mid" data-a="kick" data-role="chart" style={{ top: 268 }}><T>{'Sealed test set, {{data.test}} scans'}</T></p>
      <div className="dp10-mid dp10-f1" data-a="f1" style={{ top: 316 }}>
        <p className="dp10-f1__k" data-role="body"><span data-tick="">F1</span></p>
        <p className="dp10-f1__n" data-role="chart"><Num k="r5.f1" /></p>
      </div>
      <div className="dp10-mid dp10-row" data-a="found" style={{ top: 478 }}>
        <p className="dp10-row__n" data-role="chart"><Num k="r5.found_round" /></p>
        <p className="dp-label" data-role="chart">Found</p>
      </div>
      <div className="dp10-mid dp10-row" data-a="real" style={{ top: 548 }}>
        <p className="dp10-row__n" data-role="chart"><Num k="r5.prec_round" /></p>
        <p className="dp-label" data-role="chart">Flagged and real</p>
      </div>
      <div className="dp10-mid" data-a="dice" style={{ top: 618 }}>
        <div className="dp10-row">
          <p className="dp10-row__n" data-role="chart"><Num k="r5.dsc" /></p>
          <p className="dp-label" data-role="chart">Dice</p>
        </div>
        <p className="dp-tag dp10-dicenote" data-role="foot"><T>{'over the {{data.test_pos}} scans with lesions'}</T></p>
      </div>
      <div className="dp10-mid dp10-legend" data-a="legend" style={{ top: 730 }}>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-found" aria-hidden="true" />Found</p>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-missed" aria-hidden="true" />Missed</p>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-fa" aria-hidden="true" />False alarm</p>
        <p className="dp-tag dp10-scannote" data-role="foot">The scan: one sealed DEEP-PSMA test scan, its cohort&apos;s median case by <span data-tick="">F1</span></p>
      </div>

      {S10.groups.map((g, gi) => (
        <div key={g.name} className="dp10-group" data-a="group" style={{ top: g.y }}>
          <p className="dp-label" data-role="chart">
            <b>{g.name}</b>, <Num k={gi ? 'data.test_deeppsma' : 'data.test_autopet'} /> scans
          </p>
        </div>
      ))}
      {S10.groups.flatMap((g, gi) => g.rows.map((r, i) => {
        const own = gi === 0 ? 'dim-dp' : 'dim-ap';
        const [d1, d2] = i === 0 ? ['dim-ap', 'dim-dp'] : ['not-f1', own];
        return (
          <div key={r.k} className="dp-fill" data-a={d1}>
            <div className="dp-fill" data-a={d2}>
              <p className="dp-label dp10-bname" data-a="bname" data-role="chart" style={{ right: 1920 - (bar.x - 16), top: r.y - 4 }}>
                {i === 0 ? <span data-tick="">F1</span> : names[i]}
              </p>
              <span className={`dp10-bar is-${['f1', 'found', 'real'][i]}`} data-a="bar" style={{ left: bar.x, top: r.y, width: r.w }} aria-hidden="true" />
              <p className="dp-label dp10-bval" data-a="val" data-role="chart" style={{ left: bar.x + r.w + 12, top: r.y - 4 }}><Num k={r.k} /></p>
            </div>
          </div>
        );
      }))}
      <p className="dp-label dp-label--muted dp10-note" data-a="note-ap" data-role="chart" style={{ top: S10.groups[0].rows[2].y + 52 }}>
        PSMASegmentator trained on these scans
      </p>
      <p className="dp-label dp-label--muted dp10-note" data-a="note-dp" data-role="chart" style={{ top: S10.groups[1].rows[2].y + 52 }}>
        <T>{'My model trained on {{data.pool_deeppsma}} of the {{data.deeppsma}}'}</T>
      </p>
      <p className="dp-label dp10-note dp10-fair" data-a="fair" data-role="chart" style={{ top: S10.groups[1].rows[2].y + 112 }}>
        Neither dataset here gives a fair comparison
      </p>
    </div>
  );
}
