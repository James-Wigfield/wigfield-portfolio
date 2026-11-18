/* The edit form's model, as pure functions.

   base = what the spot held when the form opened (plus its updatedAt, sent back as
   ifUpdatedAt); form = what's typed. patchOf(base, form) is the one PATCH: only the
   fields that changed (lat and lng always together). The location goes through
   locFields() on BOTH sides, the same mapping capture's save uses, so an untouched
   location never shows up as a change. */

import { COPY } from '../../copy.js';
import { pad2 } from '../../lib/format.js';

const hasXY = (l) => Boolean(l && Number.isFinite(l.lat) && Number.isFinite(l.lng));

/** The picker's location for a saved spot. Its label is "saved" (the picker keeps it near, swaps it far). */
export function locOf(spot) {
  const xy = Number.isFinite(spot.lat) && Number.isFinite(spot.lng);
  if (!xy && !spot.placeLabel) return null;
  const loc = { lat: xy ? spot.lat : null, lng: xy ? spot.lng : null, accuracy: spot.locAccuracyM ?? null, source: spot.locSource ?? null, label: spot.placeLabel || null, labelAuto: false };
  return spot.placeLabel ? { ...loc, labelSaved: true } : loc;
}

/** The API fields for a picker location (as useDraft's save maps them). */
export function locFields(loc) {
  const l = loc || {};
  const xy = hasXY(l);
  const label = typeof l.label === 'string' ? l.label.trim() : '';
  return {
    lat: xy ? l.lat : null,
    lng: xy ? l.lng : null,
    locAccuracyM: xy && Number.isFinite(l.accuracy) ? Math.round(l.accuracy) : null,
    placeLabel: label || null,
    locSource: xy || label ? l.source || 'typed' : null,
  };
}

export function sameLoc(a, b) {
  const x = locFields(a);
  const y = locFields(b);
  return Object.keys(x).every((k) => x[k] === y[k]);
}

/** "2026-12-20" in this phone's time zone, as the spot page shows it. */
export function dayOf(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** iso moved to `day`, keeping its time of day (local). null if the day isn't a real date. */
export function withDay(iso, day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  if (!m) return null;
  const from = new Date(iso);
  const d = Number.isNaN(from.getTime()) ? new Date(2000, 0, 1, 12) : from;
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayOf(d.toISOString()) === day ? d.toISOString() : null;
}

export function baseOf(spot) {
  return {
    id: spot.id,
    updatedAt: spot.updatedAt,
    hasScene: Boolean(spot.scene),
    title: spot.title || '',
    note: spot.note || '',
    kind: spot.kind,
    scaleHint: spot.scaleHint || '',
    createdBy: spot.createdBy,
    capturedAt: spot.capturedAt,
    day: dayOf(spot.capturedAt),
    loc: locOf(spot),
  };
}

const FIELDS = ['title', 'note', 'kind', 'scaleHint', 'createdBy', 'day', 'loc'];
export const formOf = (base) => Object.fromEntries(FIELDS.map((k) => [k, base[k]]));

const PRESETS = COPY.capture.scalePresets.map((p) => p.value);
export const presetOf = (scaleHint) => (PRESETS.includes(scaleHint) ? scaleHint : null);

/** True when the form's field k differs from the base's. */
function changed(base, form, k) {
  if (k === 'loc') return !sameLoc(base.loc, form.loc);
  if (k === 'title' || k === 'note' || k === 'scaleHint') return form[k].trim() !== base[k];
  return form[k] !== base[k];
}

/** The PATCH body: only what changed. capturedAt is null when the day isn't valid (the page checks first). */
export function patchOf(base, form) {
  const p = {};
  if (changed(base, form, 'title')) p.title = form.title.trim();
  if (changed(base, form, 'note')) p.note = form.note.trim();
  if (changed(base, form, 'kind')) p.kind = form.kind;
  if (changed(base, form, 'scaleHint')) p.scaleHint = form.scaleHint.trim() || null;
  if (changed(base, form, 'createdBy')) p.createdBy = form.createdBy;
  if (changed(base, form, 'day')) p.capturedAt = withDay(base.capturedAt, form.day);
  const a = locFields(base.loc);
  const b = locFields(form.loc);
  if (a.lat !== b.lat || a.lng !== b.lng) Object.assign(p, { lat: b.lat, lng: b.lng });
  for (const k of ['locAccuracyM', 'locSource', 'placeLabel']) if (a[k] !== b[k]) p[k] = b[k];
  return p;
}

/** Did someone change the details (not just the render side: status, scene, photos) between a and b? */
export function sameDetails(a, b) {
  if (['title', 'note', 'kind', 'scaleHint', 'createdBy'].some((k) => a[k] !== b[k])) return false;
  return Date.parse(a.capturedAt) === Date.parse(b.capturedAt) && sameLoc(a.loc, b.loc);
}

/** The form on top of a newer base: my changes stay, theirs come in for everything I didn't touch.
    kind and size follow the spot once it has a 3D room. */
export function rebase(oldBase, newBase, form) {
  const next = Object.fromEntries(FIELDS.map((k) => [k, changed(oldBase, form, k) ? form[k] : newBase[k]]));
  if (newBase.hasScene) Object.assign(next, { kind: newBase.kind, scaleHint: newBase.scaleHint });
  return next;
}

/** Worker `details` → { field: text } (each detail starts with its API field; CONTRACTS §3). */
const FIELD_OF = {
  title: 'title',
  note: 'note',
  kind: 'kind',
  scaleHint: 'scale',
  createdBy: 'by',
  capturedAt: 'day',
  lat: 'place',
  lng: 'place',
  locAccuracyM: 'place',
  locSource: 'place',
  placeLabel: 'place',
};
export function fieldErrors(details) {
  const out = {};
  for (const d of [].concat(details || [])) {
    const text = typeof d === 'string' ? d : d?.message || JSON.stringify(d);
    const key = FIELD_OF[/^[A-Za-z]+/.exec(text)?.[0]] || 'form';
    out[key] = out[key] ? `${out[key]} ${text}` : text;
  }
  return out;
}
