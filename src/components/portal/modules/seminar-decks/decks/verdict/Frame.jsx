import { Attribution, CiteLine, Logo, Rail } from '../../shared/chrome';
import { T } from '../../shared/Num';
import { labelOf } from '../../engine/controller';
import { GlyphLegend, Scoreboard, Sidenotes } from './parts/Board';
import { boardAt, GLOSSARY } from './data';

/* ============================================================================
   VERDICT DECK — FRAME (a journal page)
   ----------------------------------------------------------------------------
   Grid on the 1920 x 1080 canvas:
     running head  y 34 to 90: the rail (left), running title and page number
                   (right), ruled beneath like a journal header
     title         x 112, y 128, 1240 wide (main column), Fraunces 66 px
     body          x 112 to 1352, y 316 to 968 (the main column)
     margin        x 1400 to 1808: one defined term (slides 2 to 5), the glyph
                   legend (slide 6), the hypothesis scoreboard (10 on). On slides
                   7 to 9, while every prediction is pending, the board is
                   compact (H-number and glyph, x 1688 to 1808) and the body
                   widens to 1520 px for the figure, the tiles and case A.
     footer        logo, citations, data attribution; ruled above
   Backups have no margin: their body spans x 112 to 1808 (1696 x 660).
   Slides with slide.bare (the title) draw themselves; the frame adds nothing.
   ========================================================================== */

function Margin({ slide, ctx }) {
  if (slide.margin === 'board' || slide.margin === 'compact') {
    const b = boardAt(slide.id, ctx.step);
    return <Scoreboard resolved={b.resolved} fresh={b.fresh} focus={b.focus} compact={slide.margin === 'compact'} />;
  }
  if (slide.margin === 'legend') return <GlyphLegend />;
  if (GLOSSARY[slide.id]) return <Sidenotes items={GLOSSARY[slide.id]} />;
  return null;
}

export default function Frame({ slide, ctx, children }) {
  const { info } = ctx;
  const idx = info.seq.findIndex((s) => s.id === slide.id);
  const no = labelOf(info.seq, idx);
  const backup = slide.kind === 'backup';
  if (slide.bare) return <div className="d2-frame d2-frame--bare">{children}</div>;
  return (
    <div className={`d2-frame${backup ? ' d2-frame--backup' : ''}${slide.part === 'mine' ? ' d2-frame--mine' : ''}${slide.margin === 'compact' ? ' d2-frame--compact' : ''}`}>
      <header className="d2-head">
        {slide.part ? <Rail current={slide.part} className="d2-rail" /> : <span className="d2-head__backup" data-role="foot">For questions</span>}
        <span className="d2-head__right">
          <span className="d2-head__run" data-role="foot">Does Mamba earn its place?</span>
          <span className="d2-head__no" data-role="foot" data-tick="">{no}</span>
        </span>
      </header>
      {slide.title && (
        <h1 className="d2-title" data-role="title" data-req={slide.titleReq}>
          <T>{slide.title}</T>
        </h1>
      )}
      <div className="d2-body">{children}</div>
      {!backup && <div className="d2-margin"><Margin slide={slide} ctx={ctx} /></div>}
      <footer className="d2-foot">
        {!(slide.bigLogoAt !== undefined && ctx.step >= slide.bigLogoAt) && <Logo />}
        <div className="d2-foot__text">
          <CiteLine keys={slide.cites ?? []} refNum={ctx.refNum} />
          {slide.scans && <Attribution />}
        </div>
      </footer>
    </div>
  );
}
