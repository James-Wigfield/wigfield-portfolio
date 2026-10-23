/* The cabinet glyph: a stack of layers, each with a little histogram, and a
   signal line running through them (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <rect x="4" y="5" width="36" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="17.5" width="36" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="30" width="36" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 13v-3M13 13v-5M17 13v-7M21 13v-5M25 13v-3M29 13v-2M33 13v-1" stroke="currentColor" strokeWidth="2" />
      <path d="M9 25.5v-2M13 25.5v-4M17 25.5v-6M21 25.5v-6M25 25.5v-4M29 25.5v-2M33 25.5v-1" stroke="currentColor" strokeWidth="2" />
      <path d="M9 38v-1M13 38v-3M17 38v-6M21 38v-7M25 38v-5M29 38v-3M33 38v-1" stroke="currentColor" strokeWidth="2" />
      <path d="M46 34 C52 34 52 22 58 22 S64 10 68 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="68" cy="10" r="2.6" fill="currentColor" />
      <path d="M46 10h22M46 34h22" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
    </svg>
  );
}
