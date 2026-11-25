import { COPY } from '../copy.js';

function KindGlyph({ kind }) {
  if (kind === 'place')
    return (
      <svg className="mr-kind-glyph" viewBox="0 0 56 44" aria-hidden="true">
        <path d="M6 38 V8 H50 V38 Z" />
        <path className="mr-kind-glyph-soft" d="M28 8 V24 H50 M6 24 H20 M28 30 V38" />
      </svg>
    );
  return (
    <svg className="mr-kind-glyph" viewBox="0 0 56 44" aria-hidden="true">
      {kind === 'interior' ? (
        <>
          <path d="M24 38 H6 V6 H50 V38 H32" />
          <path className="mr-kind-glyph-soft" d="M24 38 V30 A8 8 0 0 1 32 38" />
          <rect className="mr-kind-glyph-soft" x="34" y="12" width="10" height="7" />
        </>
      ) : (
        <>
          <path d="M14 38 V20 L28 9 L42 20 V38" />
          <path className="mr-kind-glyph-soft" d="M25 38 V29 H31 V38" />
          <path d="M3 38 H53" />
        </>
      )}
    </svg>
  );
}

export default function StepKind({ kind, title, places = true, onKind, onTitle, onSubmit, mode = 'guided', onMode }) {
  const c = COPY.capture;
  // a room of a whole place is always an interior; the third choice starts a whole place
  const kinds = places ? ['interior', 'exterior', 'place'] : ['interior', 'exterior'];
  return (
    <div className="mr-stepbody">
      <h2 className="mr-step-title">{c.kindTitle}</h2>
      <div className="mr-kinds" data-count={kinds.length}>
        {kinds.map((k) => (
          <button key={k} type="button" className="mr-kind" aria-pressed={kind === k} data-mr={`kind-${k}`} onClick={() => onKind(k)}>
            <KindGlyph kind={k} />
            <span className="mr-kind-label">{c.kinds[k].label}</span>
            <span className="mr-kind-hint">{c.kinds[k].hint}</span>
          </button>
        ))}
      </div>
      <label className="mr-field">
        <span className="mr-label">{c.nameLabel}</span>
        <input
          className="mr-input mr-input--lg"
          type="text"
          value={title}
          maxLength={120}
          placeholder={c.namePlaceholder[kind || 'none'] || c.namePlaceholder.none}
          autoComplete="off"
          enterKeyHint="next"
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          data-mr="title-input"
        />
      </label>
      {onMode && kind && kind !== 'place' && (
        <label className="mr-oldtoggle" data-mr="freeform-toggle">
          <input type="checkbox" checked={mode === 'freeform'} onChange={(e) => onMode(e.target.checked ? 'freeform' : 'guided')} />
          <span className="mr-oldtoggle__text">
            <span className="mr-oldtoggle__label">{COPY.freeform.toggle}</span>
            <span className="mr-field-hint">{COPY.freeform.toggleHint}</span>
          </span>
        </label>
      )}
    </div>
  );
}
