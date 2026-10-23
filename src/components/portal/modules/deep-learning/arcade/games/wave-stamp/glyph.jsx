/* The cabinet glyph: a barcode stamp over a sine wave (procedural SVG). */
export function Glyph() {
  const bars = [6, 2, 5, 3, 6, 1, 4, 6, 2, 5];
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      {bars.map((w, k) => <rect key={k} x={8 + k * 6} y={6} width={Math.max(1.5, w * 0.7)} height={18} fill="currentColor" opacity={0.35 + w * 0.1} />)}
      <path d="M6 34 C 12 26, 18 26, 24 34 S 36 42, 42 34 S 54 26, 60 34 S 66 40, 68 36" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
