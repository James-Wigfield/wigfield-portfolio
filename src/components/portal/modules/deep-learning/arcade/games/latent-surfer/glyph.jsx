/* The cabinet glyph: a surfer dot riding a wave across a latent grid, from
   one decoded tile to another (procedural SVG). */
export function Glyph() {
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <path d="M14 8v28M26 8v28M38 8v28M50 8v28M8 14h50M8 26h50" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <rect x="2" y="26" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 35h6M6 31h4" stroke="currentColor" strokeWidth="2" />
      <rect x="58" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M60 15c2-3 5-4 8-2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M14 30c8 0 9-14 18-14s10 10 18 6 6-10 8-10" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="20" r="3.4" fill="currentColor" />
    </svg>
  );
}
