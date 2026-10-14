import Clip from '../../../engine/Clip';
import { Num, T } from '../../../shared/Num';
import { S4 } from '../geometry';
import { Layer } from '../scan';
import { EASE, all, draw, fadeIn, isLive, one, rise, track, useTimeline } from '../motion';
import { S4_12 } from './s4_12.gen';
import { useAt } from './useAt';
import './s4_12.css';

/* ============================================================================
   SLIDE 4, SECOND OPTION — PSMASegmentator and the Patch Size Limit
   ----------------------------------------------------------------------------
   The main slide (slides.jsx, BaselinesSlide) with one change: once the patch
   is drawn, the scan and PSMASegmentator's patch turn once together in 3D
   (clips/plain-a-patch.mp4, tools/seminar-decks/make_plain_3d_s4_12.py): the
   patch is a box to scale in all three directions (psm.patch_z_mm head to
   toe, psm.patch_x_mm across and front to back), so its depth shows. The turn
   ends on the still's own projection with the box on the main slide's patch
   rectangle, the slide's own layers take over, and the patch steps down as
   on the main slide. The finished state is the main slide's.
   40 s read; latest starts: nnU-Net 10.7 s, 1,035 18.0, 3D CNNs 20.5, can't
   see the entire scan 22.5, GPU memory 25.8; all over by 30 s.
   ========================================================================== */

const X = S4_12.s4;
const [TURN0, TURN1] = X.turn;
const BACK = TURN1 + 0.3; // the slide's own layers fade back in here (the clip holds the front view)
const STEP = BACK + 0.25;  // then the patch steps down, as on the main slide

function timeline(root, add) {
  add(fadeIn(one(root, 'scan'), 0.3, 1.0));
  add(rise(one(root, 'who'), 0.4, 0.8, 16));
  add(rise(one(root, 'nnunet'), 9.0, 0.8, 16));
  add(rise(one(root, 'trained'), 15.8, 0.8, 16));
  add(rise(one(root, 'cant'), 19.4, 0.8, 16));
  // The patch to scale, with everything outside it dimmed (as the main slide).
  add(draw(one(root, 'patch-line'), 19.6, 1.0));
  add(fadeIn(one(root, 'spot'), 19.8, 1.0));
  add(fadeIn(one(root, 'legend'), 20.6));
  // The scan and the box turn once in 3D: the clip (it starts at X.start,
  // front-on until TURN0) takes over from the slide's layers, and hands back
  // once it is front-on again.
  all(root, 'flat').forEach((el) => add(track(el, [
    { t: TURN0 - 0.25, opacity: 1 }, { t: TURN0, opacity: 0 }, { t: BACK, opacity: 0 }, { t: STEP, opacity: 1 },
  ], EASE.inOut)));
  add(track(one(root, 'turn'), [
    { t: TURN0 - 0.25, opacity: 0 }, { t: TURN0, opacity: 1 }, { t: BACK, opacity: 1 }, { t: STEP, opacity: 0 },
  ], EASE.inOut));
  add(rise(one(root, 'gpu'), 23.8, 0.8, 16));
  // It cannot hold the whole scan: it steps down to the next position.
  const down = `translateY(${S4.travel}px)`;
  all(root, 'move').forEach((el) => add(track(el, [
    { t: STEP, transform: 'translateY(0px)', e: EASE.inOut },
    { t: STEP + 1.6, transform: down },
  ])));
  add(fadeIn(one(root, 'ghost'), STEP + 0.2, 0.8));
  add(fadeIn(one(root, 'dims'), STEP + 1.6));
}

export function BaselinesSlideB({ ctx }) {
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  // The clip waits, paused and preloaded on its first frame, until the slide reaches it.
  const go = useAt(live, X.start);
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
          <p className="dp-tag" data-role="foot">The scan and the patch turn once in 3D, to scale</p>
        </div>
      </div>

      {(live || next) && (
        <div className="dpx4-turn" data-a="turn" style={{ left: sc.x - X.padCols * sc.sx, top: sc.y, width: X.cols * sc.sx, height: sc.h }}>
          <Clip src="plain-a-patch" state={go ? 'play' : 'start'} mode={ctx.mode} reduced={ctx.reduced} label="The scan and PSMASegmentator's patch, a box to scale, turning once in 3D" />
        </div>
      )}
      {/* The slide's own layers ("flat"), hidden while the clip turns. The scan's
          own fade-in is on an inner element, so the two never act on one element. */}
      <div className="dp-fill" data-a="flat">
        <div className="dp-fill" data-a="scan">
          <Layer src="figures/plain-a-pet.png" box={sc} alt="Whole-body PSMA PET projection" />
        </div>
      </div>
      <div className="dp4-clip" data-a="flat" style={{ left: sc.x, top: sc.y, width: sc.w, height: sc.h }} aria-hidden="true">
        <div data-a="move" className="dp4-move" style={moved}>
          <div className="dp4-spot" data-a="spot" style={{ left: p.x - sc.x, top: 0, width: p.w, height: p.h }} />
        </div>
      </div>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        {/* The first position, open at the bottom where the patch now sits. */}
        <path d={`M ${p.x} ${p.y + S4.travel} V ${p.y} H ${p.x + p.w} V ${p.y + S4.travel}`} className="dp4-ghost" data-a="ghost" />
        <g data-a="flat">
          <g data-a="move" style={moved}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} className="dp4-patch" data-a="patch-line" pathLength="1" />
          </g>
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
