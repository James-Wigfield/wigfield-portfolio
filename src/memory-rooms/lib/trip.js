/* The trip's calendar (16 Dec 2026 – 15 Jan 2027) and each spot's place in the
   archive: its day of the trip, and its sheet number (MR-004 / No. 004), which
   is its position in capture order, oldest first, so a new capture never
   renumbers the older ones (deleting a spot, or changing its capture date on the
   edit page, does shift the ones after it). */

import { useEffect, useState } from 'react';
import { api } from './api.js';

export const TRIP = { start: '2026-12-16', end: '2027-01-15' };
const DAY_MS = 86400000;
const utcDay = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** The local calendar date (YYYY-MM-DD) a timestamp falls on, on this device. */
export function localDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Every day of the trip: [{ index (0-based), date: 'YYYY-MM-DD', day: Date }]. */
export function tripDays() {
  const out = [];
  const a = utcDay(TRIP.start);
  const b = utcDay(TRIP.end);
  for (let t = a, i = 0; t <= b; t += DAY_MS, i++) {
    const d = new Date(t);
    out.push({ index: i, date: d.toISOString().slice(0, 10), day: d });
  }
  return out;
}

/**
 * The calendar date a spot was captured on, where it was captured: its UTC time shifted by a zone
 * estimated from its longitude (15 degrees an hour; the trip is all in winter, so no daylight
 * saving), so every phone puts it on the same day. Without a location: this device's date.
 */
export function spotDate(spot) {
  const ts = spot?.capturedAt || spot?.createdAt;
  const t = Date.parse(ts || '');
  if (!Number.isFinite(t)) return null;
  if (!Number.isFinite(spot.lng)) return localDate(ts);
  const offsetH = Math.round(spot.lng / 15);
  return new Date(t + offsetH * 3600000).toISOString().slice(0, 10);
}

/** 1-based day of the trip a spot was captured on (spotDate), or null outside it. */
export function tripDayOf(spotOrTs) {
  const date = typeof spotOrTs === 'string' ? localDate(spotOrTs) : spotDate(spotOrTs);
  if (!date) return null;
  const n = Math.round((utcDay(date) - utcDay(TRIP.start)) / DAY_MS) + 1;
  return n >= 1 && n <= tripDays().length ? n : null;
}

const when = (s) => String(s.capturedAt || s.createdAt || '');

/** id -> sheet number (1 = the first spot ever captured). */
export function sheetNumbers(spots) {
  const sorted = [...spots].filter((s) => !s.deletedAt).sort((a, b) => when(a).localeCompare(when(b)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  return new Map(sorted.map((s, i) => [s.id, i + 1]));
}

export const sheetLabel = (n, prefix = 'MR-') => (n ? `${prefix}${String(n).padStart(3, '0')}` : '');

// The map page hands its list over, so a spot page opened from it numbers itself without a fetch.
let known = null;
let pending = null;
export function rememberSpots(spots) {
  known = sheetNumbers(spots);
}

/** A spot's sheet number (null until known). Fetches the list once if nothing has handed it over. */
export function useSheetNumber(spotId) {
  const [n, setN] = useState(() => known?.get(spotId) ?? null);
  useEffect(() => {
    let alive = true;
    if (!spotId) return undefined;
    if (known?.has(spotId)) {
      setN(known.get(spotId));
      return undefined;
    }
    // not in what we know (a spot captured since the list was read): read it again
    if (known && pending) pending = null;
    pending ??= api.listSpots().then(
      (spots) => {
        rememberSpots(spots || []);
        return known;
      },
      () => {
        pending = null;
        return null;
      },
    );
    pending.then((m) => alive && setN(m?.get(spotId) ?? null));
    return () => {
      alive = false;
    };
  }, [spotId]);
  return n;
}
