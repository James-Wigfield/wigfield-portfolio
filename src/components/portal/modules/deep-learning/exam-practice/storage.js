/* ============================================================================
   EXAM PRACTICE — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the page remembers lives in localStorage under the `dlxp:`
   prefix, and every read and write is wrapped in try/catch: private windows,
   blocked site data or a full quota must never break the page — it just
   forgets.

     dlxp:reveal   { [leafId]: true }        answers written onto the paper
     dlxp:marks    { [leafId]: number }      your self-marks
     dlxp:paper    'sample' | 'A' | 'B'      the open tab
     dlxp:at       { [paperId]: number }     the open page (0 = cover, n = Qn)
     dlxp:filter   'all' | 'L1' … 'L9'       the lecture filter
     dlxp:timer    { [paperId]: startMs }    a timed sitting in progress
   ========================================================================== */

const PREFIX = 'dlxp:';

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

// A map of ids to values, keeping only well-formed entries (never trusted).
export function loadMap(key, valid) {
  const raw = load(key, {});
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([id, v]) => {
      if (typeof id === 'string' && id.length < 64 && valid(v)) out[id] = v;
    });
  }
  return out;
}
