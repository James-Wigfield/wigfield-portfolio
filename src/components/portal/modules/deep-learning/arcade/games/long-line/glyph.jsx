/* The cabinet glyph: a cargo car (half full) behind a locomotive, a lever up (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <rect x="4" y="14" width="34" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="23" width="28" height="6" fill="currentColor" opacity="0.55" />
      <path d="M42 32 V20 H52 V14 H62 V32 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="35" r="3" fill="currentColor" />
      <circle cx="30" cy="35" r="3" fill="currentColor" />
      <circle cx="48" cy="35" r="3" fill="currentColor" />
      <circle cx="58" cy="35" r="3" fill="currentColor" />
      <path d="M2 40 H70" stroke="currentColor" strokeWidth="1.5" />
      <path d="M66 12 V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="66" cy="4" r="2.5" fill="currentColor" />
    </svg>
  );
}
