/* Read helpers over Spot rows (CONTRACTS.md §2). */

import { mediaNamed, mediaOf } from './api.js';
import { COPY } from '../copy.js';
import { formatCoord } from './format.js';

const bySort = (a, b) => (a.sort || 0) - (b.sort || 0);

/** Card image: the rendered hero if there is one, else the first thumbnail. */
export function heroOf(spot) {
  return mediaNamed(spot, 'render', 'hero') || mediaOf(spot, 'thumb').sort(bySort)[0] || null;
}

/** The baked room GLB the viewer shows (model/room), never its small map copy (model/map). */
export function roomModelOf(spot) {
  return mediaNamed(spot, 'model', 'room') || mediaOf(spot, 'model').find((m) => m.name !== 'map') || null;
}

/** The GLB the map stands up close: model/map (512 px textures, compressed), else room.glb. */
export function mapModelOf(spot) {
  const map = mediaNamed(spot, 'model', 'map');
  if (map?.url) return { media: map, lod: true };
  const room = roomModelOf(spot);
  return room?.url ? { media: room, lod: false } : null;
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
