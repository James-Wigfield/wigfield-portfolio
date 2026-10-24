/* The cabinet glyph: a clinic chart (clipboard) with a falling training curve
   and a validation curve that turns back up (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <rect x="12" y="6" width="48" height="35" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="28" y="3" width="16" height="6" rx="2" fill="currentColor" opacity="0.55" />
      <path d="M18 14c5 12 11 18 36 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 12c5 13 10 16 16 16s11-4 18-11" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M62 10h6M65 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
