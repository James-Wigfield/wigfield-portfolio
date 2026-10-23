/* The cabinet glyph: a stack of layer blocks, one still dropping into its
   slot (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <rect x="16" y="34" width="40" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="20" y="24" width="32" height="7" rx="2" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="2" />
      <rect x="24" y="14" width="24" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      <rect x="27" y="2" width="18" height="7" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <path d="M36 10.5v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 38h4M60 38h4M10 28h6M56 28h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
