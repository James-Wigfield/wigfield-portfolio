/* The cabinet glyph: an elongated bowl's contours, a ball's trail and the flag (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <ellipse cx="44" cy="24" rx="24" ry="14" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      <ellipse cx="44" cy="24" rx="15" ry="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.65" />
      <ellipse cx="44" cy="24" rx="6" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 38 L14 30 L19 31 L25 27 L30 27.5 L36 25.5 L41 25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 4.2" />
      <circle cx="6" cy="38" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M44 24 V6 l9 3 -9 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
