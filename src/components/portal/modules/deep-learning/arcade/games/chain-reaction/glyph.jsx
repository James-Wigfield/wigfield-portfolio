/* The cabinet glyph: a 2 → 2 → 1 graph with a spark running back along it. */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <path d="M10 12L34 12M10 32L34 32M10 12L34 32M10 32L34 12M34 12L60 22M34 32L60 22" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.55" />
      <circle cx="10" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="32" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="34" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="34" cy="32" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="22" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M47 17l-3 4h4l-3 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
