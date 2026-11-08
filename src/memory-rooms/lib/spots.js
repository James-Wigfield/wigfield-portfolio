/* Read helpers over Spot rows (CONTRACTS.md §2). */

import { mediaNamed, mediaOf } from './api.js';
import { COPY } from '../copy.js';
import { formatCoord } from './format.js';

const bySort = (a, b) => (a.sort || 0) - (b.sort || 0);

/** Card image: the rendered hero if there is one, else the first thumbnail. */
export function heroOf(spot) {
  return mediaNamed(spot, 'render', 'hero') || mediaOf(spot, 'thumb').sort(bySort)[0] || null;
}

/** Small list image: the first thumbnail, else the hero. */
export function thumbOf(spot) {
  return mediaOf(spot, 'thumb').sort(bySort)[0] || mediaNamed(spot, 'render', 'hero') || null;
}

const when = (s) => String(s.capturedAt || s.createdAt || '');
export const newestFirst = (spots) => [...spots].sort((a, b) => when(b).localeCompare(when(a)));

export const personName = (who) => COPY.app.people[who] || who || '';

export function placeOf(spot) {
  if (spot.placeLabel) return spot.placeLabel;
  if (Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) return formatCoord(spot.lat, spot.lng);
  return COPY.list.noLocation;
}
