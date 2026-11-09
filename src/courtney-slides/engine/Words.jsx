/* Text split into masked words so a beat can raise them one by one.
   `*word*` renders in the accent (italic display face). */

export function Words({ text, className }) {
  const parts = text.split(' ');
  return (
    <span className={className}>
      {parts.map((w, i) => {
        const em = /^\*.*\*[.,:;!?]?$/.test(w);
        const clean = em ? w.replace(/\*/g, '') : w;
        return (
          <span key={i}>
            <span className="cs-w">
              <span className={`cs-wi${em ? ' cs-em' : ''}`}>{clean}</span>
            </span>
            {i < parts.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}

const pad = (n) => String(n).padStart(2, '0');

/** Shared slide chrome: top rule, chapter kicker, slide number, title, source line. */
export function Frame({ meta, title, foot, children }) {
  return (
    <>
      <div className="cs-frame">
        <span className="cs-frame__rule" data-f="rule" />
        <p className="cs-frame__kicker" data-f="kicker">
          <span className="cs-dot" />
          {meta.chapter}
        </p>
        <p className="cs-frame__no" data-f="kicker">
          {pad(meta.n)} <span>/ {pad(meta.total)}</span>
        </p>
        {title && (
          <h2 className="cs-frame__title" data-f="title">
            <Words text={title} />
          </h2>
        )}
        {foot && (
          <p className="cs-frame__foot" data-f="foot">
            {foot}
          </p>
        )}
      </div>
      {children}
    </>
  );
}
