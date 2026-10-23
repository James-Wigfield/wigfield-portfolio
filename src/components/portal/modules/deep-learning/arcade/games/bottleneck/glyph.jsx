/* The cabinet glyph: Figure 17-3's sandwich on its side, wide → narrow → wide (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <path d="M10 22h52" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="5" y="4" width="8" height="36" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="20" y="11" width="8" height="22" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="32" y="17" width="8" height="10" rx="2.5" fill="currentColor" />
      <rect x="44" y="11" width="8" height="22" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="59" y="4" width="8" height="36" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
