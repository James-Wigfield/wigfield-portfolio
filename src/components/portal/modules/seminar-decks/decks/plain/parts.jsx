import { labelOf } from '../../engine/controller';
import { Attribution, CiteLine, Logo } from '../../shared/chrome';
import { T } from '../../shared/Num';

/* ============================================================================
   PLAIN DECK — FRAME AND DRAFT PARTS
   Frame: section label, title, body, footer (logo, citations and the data
   attribution on slides that show scans, slide number). A built slide
   (slide.stage) draws on the whole canvas in canvas px; a draft slide gets
   the body box. The title slide is bare and draws everything itself.
   Body: the draft layout for slides 7 to 14 (points and numbers left, the
   planned visual in a dashed box right).
   ========================================================================== */

export function Frame({ slide, ctx, children }) {
  const no = labelOf(ctx.info.seq, ctx.info.seq.findIndex((s) => s.id === slide.id));
  if (slide.bare) return <div className="dp-frame dp-frame--bare">{children}</div>;
  return (
    <div className="dp-frame">
      <p className="dp-frame__section" data-role="foot">{slide.section}</p>
      <h1 className="dp-frame__title" data-role="title"><T>{slide.title}</T></h1>
      {slide.stage ? children : <div className="dp-frame__body">{children}</div>}
      <footer className="dp-frame__foot">
        <Logo />
        <div className="dp-frame__foot-text">
          <CiteLine keys={slide.cites ?? []} refNum={ctx.refNum} />
          {slide.scans && <Attribution />}
        </div>
        <span className="dp-frame__no" data-role="foot" data-tick="">{no}</span>
      </footer>
    </div>
  );
}

export function Body({ s }) {
  return (
    <div className="dp-body">
      <div className="dp-body__text">
        <ul className="dp-points">
          {s.points.map((p, i) => <li key={p} data-role="body" data-req={s.req?.[i]}><T>{p}</T></li>)}
        </ul>
        {s.numbers.length > 0 && (
          <ul className="dp-numbers">
            {s.numbers.map((n) => <li key={n} data-role="chart"><T>{n}</T></li>)}
          </ul>
        )}
      </div>
      <div className="dp-visual">
        <p className="dp-visual__label" data-role="foot">Visual (placeholder)</p>
        <p className="dp-visual__text" data-role="chart">{s.visual}</p>
      </div>
    </div>
  );
}
