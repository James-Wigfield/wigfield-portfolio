import { labelOf } from '../../engine/controller';
import { Logo } from '../../shared/chrome';
import { TALK } from '../../shared/meta';
import { T } from '../../shared/Num';

/* ============================================================================
   PLAIN DECK — FRAME AND SLIDE PARTS
   Frame: section label, title, body, footer (logo and slide number).
   Cover: the title slide. Body: points and numbers left, visual box right.
   ========================================================================== */

export function Frame({ slide, ctx, children }) {
  const no = labelOf(ctx.info.seq, ctx.info.seq.findIndex((s) => s.id === slide.id));
  if (slide.bare) return <div className="dp-frame dp-frame--bare">{children}</div>;
  return (
    <div className="dp-frame">
      <p className="dp-frame__section" data-role="foot">{slide.section}</p>
      <h1 className="dp-frame__title" data-role="title"><T>{slide.title}</T></h1>
      <div className="dp-frame__body">{children}</div>
      <footer className="dp-frame__foot">
        <Logo />
        <span className="dp-frame__no" data-role="foot" data-tick="">{no}</span>
      </footer>
    </div>
  );
}

export function Cover() {
  return (
    <div className="dp-cover">
      <h1 className="dp-cover__title" data-req="title" data-role="title">{TALK.title}</h1>
      <p className="dp-cover__name" data-role="body">{TALK.presenter}</p>
      <p className="dp-cover__sup" data-req="supervisors" data-role="body">{TALK.supervisorsLine}</p>
      <div className="dp-cover__logo"><Logo size="large" /></div>
    </div>
  );
}

export function Body({ s }) {
  return (
    <div className="dp-body">
      <div className="dp-body__text">
        <ul className="dp-points">
          {s.points.map((p) => <li key={p} data-role="body"><T>{p}</T></li>)}
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
