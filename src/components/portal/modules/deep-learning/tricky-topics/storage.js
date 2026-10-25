/* ============================================================================
   TRICKY TOPICS — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the page remembers lives in localStorage under the `dltt:`
   prefix, namespaced per topic, and every read and write is wrapped in
   try/catch: private windows, blocked site data or a full quota must never
   break the page — it just forgets.

   Page-wide
     dltt:last                    topicId        the topic you had open
   Per topic (topicStore(id) prefixes `dltt:<id>:`)
     dltt:<id>:sheetTicks  { [pageId]: string[] }   notebook units copied
                                                    (keys from sheetKeys.js)
     dltt:<id>:done        string[]                 steps marked "got it"
     dltt:<id>:last        string                   the step you were reading
     dltt:<id>:drill       { tried, right }         the drill's running score
     dltt:<id>:rail        boolean                  the index rail open
     dltt:<id>:summary     { steps, done, pages, copied }
                                                    written by the topic's
                                                    shell, read by the tab bar
                                                    (so the tabs never load a
                                                    topic just to show its
                                                    progress)
   ========================================================================== */

const PREFIX = 'dltt:';

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working without it */
  }
}

export const loadPage = (key, fallback) => read(PREFIX + key, fallback);
export const savePage = (key, value) => write(PREFIX + key, value);

// One topic's corner of storage: load / save under `dltt:<topicId>:`.
export function topicStore(topicId) {
  const base = `${PREFIX}${topicId}:`;
  return {
    load: (key, fallback) => read(base + key, fallback),
    save: (key, value) => write(base + key, value),
  };
}

// Ticks are stored as plain arrays of keys ('block:n'); anything malformed is
// dropped, not trusted.
export function cleanTicks(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([id, list]) => {
      if (Array.isArray(list)) out[id] = list.filter((k) => typeof k === 'string' && k.length > 0 && k.length < 64);
    });
  }
  return out;
}

export const cleanIds = (raw) => (Array.isArray(raw) ? raw.filter((k) => typeof k === 'string' && k.length > 0 && k.length < 64) : []);
