/* Dream Rooms · row helpers shared by the Worker, the front end and the Node
   scripts (CONTRACTS.md §1). Pure, no imports. */

/** The text a read works from: the row's own slice of raw_text, plus extra_text. */
export function ownText(row) {
  const raw = row.raw_text || '';
  const own = Array.isArray(row.own) ? raw.slice(row.own[0], row.own[1]) : raw;
  const extra = (row.extra_text || '').trim();
  return extra ? `${own}\n\n${extra}` : own;
}

/** Just the own slice of raw_text (no extra_text). */
export function ownSlice(row) {
  const raw = row.raw_text || '';
  return Array.isArray(row.own) ? raw.slice(row.own[0], row.own[1]) : raw;
}

/** The first n words, with … when there are more. */
export function firstWords(text, n = 6) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.length > n ? `${words.slice(0, n).join(' ')}…` : words.join(' ');
}

const pad = (n) => String(n).padStart(2, '0');
/** A local Date → YYYY-MM-DD (local calendar). */
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The night a capture belongs to: before 2 pm local it's last night (yesterday's date). */
export function dreamtOnFor(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < 14) d.setDate(d.getDate() - 1);
  return isoDate(d);
}

/** YYYY-MM-DD → a local noon Date (safe from DST edges). */
export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** "Tue 24 Nov" (+ the year when it isn't this year). */
export function nightLabel(s, now = new Date()) {
  const d = parseDate(s);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "24·XI" */
export function signDate(s) {
  const d = parseDate(s);
  return `${d.getDate()}·${ROMAN[d.getMonth()]}`;
}

/** Whole days from date a to date b (YYYY-MM-DD). */
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/** Archive order: dreamt_on, then night_order, then created_at. */
export function compareRows(a, b) {
  if (a.dreamt_on !== b.dreamt_on) return a.dreamt_on < b.dreamt_on ? -1 : 1;
  if ((a.night_order || 0) !== (b.night_order || 0)) return (a.night_order || 0) - (b.night_order || 0);
  return String(a.created_at || '').localeCompare(String(b.created_at || ''));
}

/**
 * Renumber one night's rows 1..n. `rows` = that night's live rows; `moved` = { id, to }
 * (optional): put that row at position `to` first. Returns [{ id, night_order }] for
 * every row whose number changed.
 */
export function renumberNight(rows, moved = null) {
  const sorted = [...rows].sort((a, b) => ((a.night_order || 0) - (b.night_order || 0)) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  if (moved) {
    const i = sorted.findIndex((r) => r.id === moved.id);
    if (i >= 0) {
      const [row] = sorted.splice(i, 1);
      const to = Math.max(1, Math.min(sorted.length + 1, Math.round(moved.to)));
      sorted.splice(to - 1, 0, row);
    }
  }
  const changes = [];
  sorted.forEach((r, i) => {
    if (r.night_order !== i + 1) changes.push({ id: r.id, night_order: i + 1 });
  });
  return changes;
}

export const STATUSES = ['captured', 'reading', 'building', 'rendered', 'failed'];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const STALE_MS = 2 * 3600 * 1000;
