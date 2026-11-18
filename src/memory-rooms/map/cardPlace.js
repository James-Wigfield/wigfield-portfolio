/* Where the spot card sits beside its marker (both map engines). Screen pixels. */

export const CARD_W = 300;
const GAP = 18;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Where the card points: the selected dot or marker, or the cluster it's hidden in (items from
 * clusterPoints, with markers from markers.js). { x, y } is the location; a marker adds `ex`
 * (half its width, so the card sits beside the image) and `cy` (the image's middle).
 */
export function anchorOf(items, want) {
  if (!want) return null;
  for (const it of items) {
    if (it.type === 'spot' && it.point.id === want) {
      if (it.model) {
        const b = it.model.box;
        return { x: (b.x0 + b.x1) / 2, y: it.point.y, ex: (b.x1 - b.x0) / 2, cy: (b.y0 + b.y1) / 2 };
      }
      const m = it.marker;
      return m ? { x: it.point.x, y: it.point.y, ex: m.w / 2, cy: it.point.y - m.h / 2 } : { x: it.point.x, y: it.point.y };
    }
    if (it.type === 'cluster' && it.members.some((m) => m.id === want)) return { x: it.x, y: it.y, cluster: it.id };
  }
  return null;
}

/** The card's { left, top, width } inside a map of `size`: beside the anchor, kept on screen. */
export function cardPosition(anchor, size, cardH) {
  if (!anchor) return { left: 16, top: 16, width: CARD_W };
  const ex = anchor.ex || 0;
  let left = anchor.x + ex + GAP;
  if (left + CARD_W > size.w - 12) left = anchor.x - ex - GAP - CARD_W;
  left = clamp(left, 12, Math.max(12, size.w - CARD_W - 12));
  const top = clamp((anchor.cy ?? anchor.y) - Math.min(110, cardH / 2), 12, Math.max(12, size.h - cardH - 12));
  return { left, top, width: CARD_W };
}
