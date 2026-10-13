import { Attribution, CiteLine, Logo, Rail } from '../../shared/chrome';
import { T } from '../../shared/Num';
import { labelOf } from '../../engine/controller';

/* ============================================================================
   DECK 3 (context) — FRAME: the imaging suite's chrome
   ----------------------------------------------------------------------------
   The slide body is a full-canvas world the slide lays out itself (cameras,
   monitors, plates); the frame draws only a fixed overlay on top of it:
     rail      top right, mono, "My work" marked as the student's part
     title     top left across the canvas ('top' layout) or in the right
               column beside a full-height monitor ('side' layout)
     footer    logo (small, white chip), citations and data line, slide number
   Backups get the 'top' layout with their shared content in a body box.
   slide.bare draws only what the slide asks for (the title slide).
   slide.closing hides the small footer logo on the last build step, where the
   slide shows the logo large.
   ========================================================================== */

export default function Frame({ slide, ctx, children }) {
  const { info } = ctx;
  const no = labelOf(info.seq, info.seq.findIndex((s) => s.id === slide.id));
  const isBackup = slide.kind === 'backup';
  const layout = isBackup ? 'top' : slide.layout ?? 'top';
  const closing = slide.closing && ctx.step === ctx.steps - 1;

  if (slide.bare) {
    return (
      <div className="d3-frame d3-frame--bare">
        {children}
        <footer className="d3-frame__foot d3-frame__foot--bare">
          <div className="d3-frame__foot-text">{slide.scans && <Attribution />}</div>
          <span className="d3-frame__no" data-role="foot" data-tick="">{no}</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`d3-frame d3-frame--${layout}${isBackup ? ' d3-frame--backup' : ''}`}>
      {isBackup ? <div className="d3-frame__body">{children}</div> : children}
      {slide.part && (
        <div className="d3-frame__rail">
          <Rail current={slide.part} />
        </div>
      )}
      {isBackup && <p className="d3-frame__kicker" data-role="foot">Backup</p>}
      {slide.title && (
        <h1 className="d3-frame__title" data-role="title">
          <T>{slide.title}</T>
        </h1>
      )}
      <footer className="d3-frame__foot">
        {!closing && <Logo chip />}
        <div className="d3-frame__foot-text">
          <CiteLine keys={slide.cites ?? []} refNum={ctx.refNum} />
          {slide.scans && <Attribution />}
        </div>
        <span className="d3-frame__no" data-role="foot" data-tick="">{no}</span>
      </footer>
    </div>
  );
}
