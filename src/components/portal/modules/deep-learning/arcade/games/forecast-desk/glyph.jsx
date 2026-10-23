/* The cabinet glyph: a weekly series (weekday highs, weekend dips), its
   one-week-later copy dotted, and the baseline rule (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <path d="M4 14 L9 13 L14 14 L19 30 L24 34 L29 14 L34 13 L39 14 L44 31 L49 33 L54 14 L59 13 L64 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M29 17 L34 16 L39 17 L44 34 L49 36 L54 17 L59 16 L64 18 L68 33" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2.5" opacity="0.7" />
      <path d="M2 40 H70" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 24 H70" stroke="currentColor" strokeWidth="1" strokeDasharray="5 3" opacity="0.55" />
    </svg>
  );
}
