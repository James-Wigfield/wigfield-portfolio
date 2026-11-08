/* What a spot page needs from a Spot row (CONTRACTS.md §2), in one place. */

import { mediaNamed, mediaOf } from '../../lib/api.js';

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
  const model = mediaOf(spot, 'model')[0];
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
  return {
    id: spot.id,
    scene: spot.scene || null,
    glbUrl: kind === 'model' ? mediaOf(spot, 'model')[0].url : null,
    // while the GLB loads: the hero render, over the first photo (small, instant)
    posterUrl: kind === 'model' ? hero?.url || null : null,
    posterLowUrl: kind === 'model' ? first?.thumb || null : null,
    photos: spotPhotos(spot).map(({ photo, url, width, height }) => ({ photo, url, width, height })),
    scanUrl: scan?.url || null,
  };
}
