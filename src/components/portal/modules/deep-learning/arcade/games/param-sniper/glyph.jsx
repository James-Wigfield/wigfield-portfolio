/* The cabinet glyph: a crosshair over a stack of layers (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <rect x="4" y="30" width="30" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="20" width="22" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="10" width="14" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="54" cy="22" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="54" cy="22" r="3" fill="currentColor" />
      <path d="M54 4v8M54 32v8M36 22h8M64 22h8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
