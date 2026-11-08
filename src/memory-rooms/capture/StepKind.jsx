import { COPY } from '../copy.js';

function KindGlyph({ kind }) {
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

export default function StepKind({ kind, title, onKind, onTitle, onSubmit }) {
  const c = COPY.capture;
  return (
    <div className="mr-stepbody">
      <h2 className="mr-step-title">{c.kindTitle}</h2>
      <div className="mr-kinds">
        {['interior', 'exterior'].map((k) => (
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
          placeholder={c.namePlaceholder[kind || 'none']}
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
    </div>
  );
}
