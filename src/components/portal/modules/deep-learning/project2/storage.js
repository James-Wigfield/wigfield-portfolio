/* ============================================================================
   DL PROJECT 2 — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the page remembers lives in localStorage under `dlp2:`, and every
   read and write is wrapped in try/catch: a private window, blocked site data
   or a full quota must never break the page — it just forgets.

     dlp2:rail       boolean      contents rail open on wide screens
     dlp2:collapsed  { in: number[], out: number[] }   cell indices collapsed
     dlp2:last       heading id   where you were reading
   ========================================================================== */

const PREFIX = 'dlp2:';

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working without it */
  }
}

// Collapsed cells are stored as two index lists; anything malformed is dropped.
export function loadCollapsed() {
  const raw = load('collapsed', null);
  const ints = (a) => (Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n >= 0) : []);
  return { in: new Set(ints(raw?.in)), out: new Set(ints(raw?.out)) };
}
