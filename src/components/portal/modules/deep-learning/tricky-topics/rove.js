/* ============================================================================
   TRICKY TOPICS — ROVING FOCUS FOR HOVER TARGETS
   ----------------------------------------------------------------------------
   A lab's hover targets (weight cells, bar segments, output cells) are one
   tab stop, not one each: the active item has tabIndex 0, the rest −1, and
   the arrow keys (Home / End too) move focus between them, so a 6 × 8 grid
   costs one Tab. Focusing an item does what hovering it does (the lab's
   onFocus), so keyboard and pointer show the same thing.

     <rect {...rove('loom', idx, n, cols, active)} onFocus={…} aria-label="…" />

   group   a name unique within the SVG (data-rove="<group>-<i>")
   i       this item's index, row-major
   n       how many items
   cols    items per row (arrow up/down jump by this); n for a single row
   active  the index that holds the tab stop (the hot item, else 0)
   ========================================================================== */

function move(e, group, i, n, cols) {
  const k = e.key;
  let j = i;
  if (k === 'ArrowRight') j = Math.min(n - 1, i + 1);
  else if (k === 'ArrowLeft') j = Math.max(0, i - 1);
  else if (k === 'ArrowDown') j = i + cols < n ? i + cols : i;
  else if (k === 'ArrowUp') j = i - cols >= 0 ? i - cols : i;
  else if (k === 'Home') j = 0;
  else if (k === 'End') j = n - 1;
  else return;
  e.preventDefault();
  if (j === i) return;
  const root = e.currentTarget.ownerSVGElement ?? e.currentTarget.closest('svg') ?? document;
  root.querySelector(`[data-rove="${group}-${j}"]`)?.focus();
}

export function rove(group, i, n, cols = n, active = 0) {
  return {
    'data-rove': `${group}-${i}`,
    tabIndex: i === active ? 0 : -1,
    role: 'img',
    onKeyDown: (e) => move(e, group, i, n, cols),
  };
}
