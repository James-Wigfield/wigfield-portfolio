/* ============================================================================
   LECTURE 5 STUDY — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the study module remembers lives in localStorage under the
   `dl5s:` prefix, and every read and write is wrapped in try/catch: private
   windows, blocked site data or a full quota must never break the page — it
   just forgets.

     dl5s:sheetTicks { [sectionId]: string[] }  notebook units copied
                                                (keys from sheets/keys.js)
     dl5s:last      sectionId                   where you were reading
     dl5s:outcomes  number[]                    slide-26 outcomes you can do
     dl5s:rail      boolean                     section index open on wide screens
   ========================================================================== */

const PREFIX = 'dl5s:';

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

// Ticks are stored as plain arrays of keys ('block:n'); anything malformed is
// dropped, not trusted.
export function loadSheetTicks() {
  const raw = load('sheetTicks', {});
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([id, list]) => {
      if (Array.isArray(list)) out[id] = list.filter((k) => typeof k === 'string' && k.length > 0 && k.length < 64);
    });
  }
  return out;
}
