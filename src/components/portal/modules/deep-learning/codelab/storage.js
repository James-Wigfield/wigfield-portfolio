/* ============================================================================
   CODE LAB — PERSISTENCE
   ----------------------------------------------------------------------------
   What the page remembers lives in localStorage under the `dlc:` prefix, and
   every read and write is wrapped in try/catch: private windows, blocked
   site data or a full quota must never break the page — it just forgets.

     dlc:tab       sectionId   the open tab (a /portal/dl-code-lab/<tab>
                               deep link wins over it)
     dlc:coreOnly  boolean     hide the `useful` cards for a fast pass
   ========================================================================== */

const PREFIX = 'dlc:';

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
