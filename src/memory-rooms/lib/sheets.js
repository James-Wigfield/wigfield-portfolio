/* Each spot's place in the archive: the date it was captured (where it was captured), and its
   sheet number (MR-004 / No. 004), which is its position in capture order, oldest first, so a
   new capture never renumbers the older ones (deleting a spot, or changing its capture date on
   the edit page, does shift the ones after it). (Until 2026-11-25 this was lib/trip.js and also
   knew the USA trip's calendar; the map is for any place now.) */

import { useEffect, useState } from 'react';
import { api } from './api.js';

/** The local calendar date (YYYY-MM-DD) a timestamp falls on, on this device. */
export function localDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The calendar date a spot was captured on, where it was captured: its UTC time shifted by a zone
 * estimated from its longitude (15 degrees an hour, no daylight saving), so every phone puts it on
 * the same day. Without a location: this device's date.
 */
export function spotDate(spot) {
  const ts = spot?.capturedAt || spot?.createdAt;
  const t = Date.parse(ts || '');
  if (!Number.isFinite(t)) return null;
  if (!Number.isFinite(spot.lng)) return localDate(ts);
  const offsetH = Math.round(spot.lng / 15);
  return new Date(t + offsetH * 3600000).toISOString().slice(0, 10);
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
