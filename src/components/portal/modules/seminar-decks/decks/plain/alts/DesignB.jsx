import Clip from '../../../engine/Clip';
import { DesignSlide } from '../slides2';
import { EASE, isLive, one, rise, track, useTimeline } from '../motion';
import { S8X } from './s8.gen';
import { useAt } from './useAt';
import './s8.css';

/* ============================================================================
   SLIDE 8, SECOND OPTION — Organ Head and Five-Model Ensemble
   ----------------------------------------------------------------------------
   The main slide (slides2.jsx, DesignSlide) unchanged, with one layer over its
   right side: once "21 to 7" has landed, at the ensemble sentence ("I
   trained an ensemble..."), the normal-uptake scan gives way to the final
   model running on a sealed test scan (study C, slide 10's scan):
   one version reads it patch by patch in the real order with its real running
   estimate, the five versions' maps are averaged, the threshold makes the
   binary output, and the size filter removes the specks
   (clips/plain-c-run.mp4, tools/seminar-decks/make_plain_3d_s8.py, from the
   PSMA Motion export of the run of record). The clip waits, preloaded and
   paused on its first frame, and starts as the panel comes up (S8X.tIn), so a
   slow start cannot put it out of step. Finished state: the prediction.
   ========================================================================== */

const PANEL = { right: 96, top: 330 };
const COVER = { left: 1196, top: 284, right: 80, bottom: 128 };

function timeline(root, add) {
  // The main slide's normal-uptake scan and its labels go under a white cover,
  // then the panel comes up over it; the four steps follow the clip.
  add(track(one(root, 'cover'), [{ t: S8X.tIn - 0.2, opacity: 0 }, { t: S8X.tIn + 0.5, opacity: 1 }], EASE.inOut));
  add(track(one(root, 'panel'), [{ t: S8X.tIn, opacity: 0 }, { t: S8X.tIn + 0.8, opacity: 1 }], EASE.inOut));
  add(rise(one(root, 'kick'), S8X.tIn + 0.3, 0.8, 10));
  // No captions of its own: the main slide's lines (bottom left) already name
  // the steps as they come (the design critic's note, 14 Oct).
}

export function DesignSlideB({ ctx }) {
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  const go = useAt(live, S8X.tIn);
  const panelLeft = 1920 - PANEL.right - S8X.w;
  return (
    <>
      <DesignSlide ctx={ctx} />
      <div className="dp-stage dpx8" ref={root}>
        <span className="dpx8-cover" data-a="cover" style={{ left: COVER.left, top: COVER.top, right: COVER.right, bottom: COVER.bottom }} aria-hidden="true" />
        <p className="dp-kicker" data-a="kick" data-role="chart" style={{ right: PANEL.right, top: PANEL.top - 40 }}>The final model on one test scan</p>
        <div className="dpx8-panel" data-a="panel" style={{ left: panelLeft, top: PANEL.top, width: S8X.w, height: S8X.h }}>
          <Clip
            src="plain-c-run"
            state={go ? 'play' : live || next ? 'start' : 'hold'}
            mode={ctx.mode}
            reduced={ctx.reduced}
            label="The final model on a sealed test scan: one version reads it patch by patch, the five versions are averaged, the threshold gives the prediction and the smallest pieces are removed"
          />
        </div>
      </div>
    </>
  );
}
