/* Where the spot card sits beside its marker (both map engines). Screen pixels. */

export const CARD_W = 300;
const GAP = 18;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Where the card points: the selected dot, or the cluster it's hidden in (items from clusterPoints). */
export function anchorOf(items, want) {
  if (!want) return null;
  for (const it of items) {
    if (it.type === 'spot' && it.point.id === want) return { x: it.point.x, y: it.point.y };
    if (it.type === 'cluster' && it.members.some((m) => m.id === want)) return { x: it.x, y: it.y, cluster: it.id };
  }
  return null;
}

/** The card's { left, top, width } inside a map of `size`: beside the anchor, kept on screen. */
export function cardPosition(anchor, size, cardH) {
  if (!anchor) return { left: 16, top: 16, width: CARD_W };
  let left = anchor.x + GAP;
  if (left + CARD_W > size.w - 12) left = anchor.x - GAP - CARD_W;
  left = clamp(left, 12, Math.max(12, size.w - CARD_W - 12));
  const top = clamp(anchor.y - Math.min(110, cardH / 2), 12, Math.max(12, size.h - cardH - 12));
  return { left, top, width: CARD_W };
}
