/* Hairline SVG icons (1.5 px strokes, currentColor). */

export function Chevron({ dir = 'right', size = 18 }) {
  const d = { right: 'M9 5l7 7-7 7', left: 'M15 5l-7 7 7 7', up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7' }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Cross({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Arrow({ dir = 'left', size = 14 }) {
  const d = dir === 'left' ? 'M19 12H5m6-6l-6 6 6 6' : 'M5 12h14m-6-6l6 6-6 6';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
