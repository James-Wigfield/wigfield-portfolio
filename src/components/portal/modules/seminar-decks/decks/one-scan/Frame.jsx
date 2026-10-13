import { Attribution, CiteLine, Logo, Rail } from '../../shared/chrome';
import { T } from '../../shared/Num';
import { labelOf } from '../../engine/controller';

/* ============================================================================
   ONE SCAN, START TO FINISH — FRAME
   ----------------------------------------------------------------------------
   The chrome follows the PSMA Motion clips' own grammar, so a slide reads as
   a frame of the same film: a Plex Mono kicker at y 101, a short gold rule
   at y 138, a Fraunces title from y 158. Layouts (slide.layout):
     title  the title slide draws itself; the frame adds the footer only
     panel  a clip slide: the title sits in the clip's own title slot on the
            right (x 1040), on a ground-coloured cover that hides the clip's
            baked title and sub-line (the clip keeps its kicker and rule);
            the cover's depth per step comes from slide.panel(ctx)
     left   on the A1 hold: kicker, rule and title in the left column
     full   no clip: kicker, rule and title across the top
   Every slide: the rail top-left (main slides), the footer bottom
   (citations, data attribution, slide number, the logo on a white chip).
   Text sits on opaque ground so no word is ever drawn over scan pixels.
   ========================================================================== */

export default function Frame({ slide, ctx, children }) {
  const { info } = ctx;
  const idx = info.seq.findIndex((s) => s.id === slide.id);
  const no = labelOf(info.seq, idx);
  const backup = slide.kind === 'backup';
  const layout = slide.layout ?? 'full';
  const hideTitle = slide.hideTitle ? slide.hideTitle(ctx) : false;
  const bigLogo = slide.bigLogo ? slide.bigLogo(ctx) : false;
  const panel = layout === 'panel' && slide.panel ? slide.panel(ctx) : { cover: 330, delay: 0 };
  const kicker = backup ? `Backup ${no}` : slide.kicker;

  return (
    <div className={`d1-frame d1-frame--${layout}${backup ? ' d1-frame--backup' : ''}`}>
      <div className="d1-stage">{children}</div>

      {slide.part && (
        <div className="d1-railbox">
          <Rail current={slide.part} />
        </div>
      )}

      {layout !== 'title' && slide.title && (
        <header
          className={`d1-head d1-head--${layout}${hideTitle ? ' is-off' : ''}`}
          style={layout === 'panel' ? { height: panel.cover - 148, transitionDelay: `${panel.delay ?? 0}s` } : undefined}
          aria-hidden={hideTitle || undefined}
        >
          {layout !== 'panel' && kicker && <p className="d1-kicker" data-role={hideTitle ? undefined : 'foot'}>{kicker}</p>}
          {layout !== 'panel' && <span className="d1-goldrule" aria-hidden="true" />}
          <h1 className="d1-title" data-role={hideTitle ? undefined : 'title'}><T>{slide.title}</T></h1>
        </header>
      )}

      <footer className="d1-foot">
        <div className="d1-foot__text">
          <CiteLine keys={slide.cites ?? []} refNum={ctx.refNum} className="d1-foot__line" />
          {slide.scans && <Attribution className="d1-foot__line" />}
        </div>
        <span className="d1-foot__no" data-role="foot" data-tick="">{no}</span>
        {!bigLogo && <Logo chip className="d1-foot__logo" />}
      </footer>
    </div>
  );
}
