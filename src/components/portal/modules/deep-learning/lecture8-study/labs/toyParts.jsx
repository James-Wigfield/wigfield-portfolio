import './labsMasking.css';

/* ============================================================================
   Small parts shared by the §9, §13 and §14 labs (styles: ./labsMasking.css)
     Seg        a quiet text switch (one of a few options; underline = on)
     ToyWait    the toy transformer's "loading…" / "couldn't load" floor
     HatchDef   the mask's grey hatch, as an SVG <pattern> (put it in <defs>)
   ========================================================================== */

export function Seg({ label, options, value, onChange, className = '' }) {
  return (
    <div className={`dl8s-toy-seg ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          className="dl8s-toy-seg__b"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
        >
          {o.label}
          {o.sub && <span className="dl8s-toy-seg__sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function ToyWait({ error, minHeight = 220 }) {
  return (
    <p className="dl8s-toy-wait" style={{ minHeight }} role="status">
      {error ? 'Couldn’t load this page’s toy transformer.' : 'loading this page’s toy transformer…'}
    </p>
  );
}

export function HatchDef({ id, size = 6 }) {
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={size} height={size} className="dl8s-toy-hatch__bg" />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} className="dl8s-toy-hatch__ln" />
    </pattern>
  );
}
