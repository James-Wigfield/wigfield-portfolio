/* ============================================================================
   LECTURE 4 STUDY — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the study module remembers lives in localStorage under the
   `dl4s:` prefix, and every read and write is wrapped in try/catch: private
   windows, blocked site data or a full quota must never break the page — it
   just forgets.

     dl4s:ticks     { [sectionId]: number[] }   notes lines copied (Legacy page)
     dl4s:sheetTicks { [sectionId]: string[] }  student-notes units copied
                                                (keys from sheets/keys.js)
     dl4s:last      sectionId                   where you were reading
     dl4s:outcomes  number[]                    slide-51 outcomes you can do
     dl4s:rail      boolean                     section index open on wide screens
   ========================================================================== */

const PREFIX = 'dl4s:';

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

// Ticks are stored as plain arrays; anything malformed is dropped, not trusted.
export function loadTicks() {
  const raw = load('ticks', {});
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([id, list]) => {
      if (Array.isArray(list)) out[id] = list.filter((n) => Number.isInteger(n) && n >= 0);
    });
  }
  return out;
}

// The student-notes page ticks by key ('block:n'); same rules, strings only.
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
