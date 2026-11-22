/* What a spot page needs from a Spot row (CONTRACTS.md §2), in one place. */

import { mediaNamed, mediaOf } from '../../lib/api.js';
import { mapModelOf, roomModelOf } from '../../lib/spots.js';

/** Photos sorted by number: [{ photo, url, thumb, width, height }]. */
export function spotPhotos(spot) {
  return mediaOf(spot, 'photo')
    .map((m) => ({
      photo: Number(m.name),
      url: m.url,
      thumb: mediaNamed(spot, 'thumb', m.name)?.url || m.url,
      width: m.width,
      height: m.height,
    }))
    .filter((p) => Number.isFinite(p.photo))
    .sort((a, b) => a.photo - b.photo);
}

/**
 * How the stage shows this spot:
 *   'model'   a baked GLB (status rendered, or a GLB with no scene)
 *   'preview' a layout preview from scene.json (captured / modelling)
 *   'photos'  no scene yet: the photos are the hero
 */
export function stageKind(spot) {
  const model = roomModelOf(spot);
  if (model && (spot.status === 'rendered' || !spot.scene)) return 'model';
  if (spot.scene) return 'preview';
  return 'photos';
}

/** The load spec RoomViewer.load() takes, or null when there's nothing 3D. */
export function viewerSource(spot) {
  const kind = stageKind(spot);
  if (kind === 'photos') return null;
  const scan = mediaOf(spot, 'scan')[0];
  const hero = mediaNamed(spot, 'render', 'hero');
  const first = spotPhotos(spot)[0];
  const small = kind === 'model' ? mapModelOf(spot) : null;
  return {
    id: spot.id,
    scene: spot.scene || null,
    glbUrl: kind === 'model' ? roomModelOf(spot).url : null,
    // "Recall": the small map copy (model/map) loads first and condenses from points
    mapUrl: small?.lod ? small.media.url : null,
    // while the GLB loads: the hero render, over the first photo (small, instant)
    posterUrl: kind === 'model' ? hero?.url || null : null,
    posterLowUrl: kind === 'model' ? first?.thumb || null : null,
    photos: spotPhotos(spot).map(({ photo, url, thumb, width, height }) => ({ photo, url, thumb, width, height })),
    scanUrl: scan?.url || null,
    // a room of a whole place: its empty bake (furniture off), loaded on first use
    emptyUrl: kind === 'model' && spot.buildingId ? mediaNamed(spot, 'model', 'empty')?.url || null : null,
  };
}

/** Spots captured at night open on the dark stage, even in light mode (scene.style.mood). */
export const moodOf = (spot) => (spot?.scene?.style?.mood === 'night' ? 'night' : undefined);
