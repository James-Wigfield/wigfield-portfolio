import { Attribution, CiteLine, Logo, Rail } from './chrome';
import { T } from './Num';
import { labelOf } from '../engine/controller';

/* ============================================================================
   SEMINAR DECKS — DEFAULT FRAME (reference chrome; decks may replace it)
   ----------------------------------------------------------------------------
   Zones on the 1920 x 1080 canvas:
     top     rail (parts of the talk; "My work" marked)        y 36
     title   full-sentence claim, 64 px or larger              y 120
     body    the slide's content                               y 300 to 960
     footer  logo (small), citations or data attribution, slide number
   Slides with slide.bare draw everything themselves (title, closing, clips);
   the frame then adds only what they ask for through slide.chrome.
   Marks for the gates: data-role="title" on the title; chrome components carry
   data-req and data-role themselves.
   ========================================================================== */

export default function DefaultFrame({ slide, ctx, children }) {
  const { info } = ctx;
  const no = labelOf(info.seq, info.seq.indexOf(info.seq.find((s) => s.id === slide.id)));
  const chrome = slide.chrome ?? {};
  if (slide.bare) {
    return (
      <div className="sd-frame sd-frame--bare">
        {children}
        {chrome.logo && <div className="sd-frame__logo"><Logo chip={chrome.chip} /></div>}
        {slide.scans && <div className="sd-frame__foot"><Attribution /></div>}
      </div>
    );
  }
  return (
    <div className="sd-frame">
      {slide.part && <div className="sd-frame__rail"><Rail current={slide.part} /></div>}
      {slide.title && (
        <h1 className="sd-frame__title" data-role="title"><T>{slide.title}</T></h1>
      )}
      <div className="sd-frame__body">{children}</div>
      <footer className="sd-frame__foot">
        <Logo chip={chrome.chip} />
        <div className="sd-frame__foot-text">
          <CiteLine keys={slide.cites ?? []} refNum={ctx.refNum} />
          {slide.scans && <Attribution />}
        </div>
        <span className="sd-frame__no" data-role="foot" data-tick="">{no}</span>
      </footer>
    </div>
  );
}
