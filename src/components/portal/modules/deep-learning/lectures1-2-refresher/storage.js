/* ============================================================================
   LECTURES 1–2 REFRESHER — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the module remembers lives in localStorage under the `dl12r:`
   prefix, and every read and write is wrapped in try/catch: private windows,
   blocked site data or a full quota must never break the page — it just
   forgets.

     dl12r:sheetTicks { [pageId]: string[] }  notebook units copied, per page
                                              (p1–p3; keys from sheets/keys.js)
     dl12r:last      stopId                   where you were reading (a
                                              section or a notebook page)
     dl12r:rail      boolean                  index open on wide screens
   ========================================================================== */

const PREFIX = 'dl12r:';

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
