/* localStorage that never throws (private mode, blocked site data, quota). */

export function readLocal(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/** The device's person ("james" | "justin"), picked once per device. */
const WHO_KEY = 'mr:who';
export const PEOPLE = ['james', 'justin'];

export function readWho() {
  const v = readLocal(WHO_KEY);
  return PEOPLE.includes(v) ? v : null;
}

export function writeWho(who) {
  writeLocal(WHO_KEY, PEOPLE.includes(who) ? who : null);
}

/** Where the last spot was saved on this device (the location step opens there). */
const LAST_LOC_KEY = 'mr:lastLoc';

export function readLastLoc() {
  try {
    const v = JSON.parse(readLocal(LAST_LOC_KEY, 'null'));
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

export function writeLastLoc(lat, lng) {
  if (Number.isFinite(lat) && Number.isFinite(lng)) writeLocal(LAST_LOC_KEY, JSON.stringify({ lat, lng }));
}
