/* The cabinet glyph: a patch board with three cables (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      {[10, 26, 42, 58].map((x) => <circle key={`t${x}`} cx={x} cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />)}
      {[10, 26, 42, 58].map((x) => <circle key={`b${x}`} cx={x} cy="36" r="4" fill="none" stroke="currentColor" strokeWidth="2" />)}
      <path d="M10 12 C10 26, 42 18, 42 32" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M26 12 C26 24, 58 22, 58 32" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.75" />
      <path d="M58 12 C58 22, 10 24, 10 32" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.45" />
    </svg>
  );
}
