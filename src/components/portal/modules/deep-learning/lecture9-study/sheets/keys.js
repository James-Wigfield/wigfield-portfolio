/* ============================================================================
   LECTURE 9 STUDY — NOTEBOOK PAGES: TICK KEYS
   ----------------------------------------------------------------------------
   One place decides which parts of a sheet are tickable and what each tick is
   called, so the renderer (SheetPage.jsx) and the shell's progress counts can
   never disagree. A key is `${blockId}:${n}` (or `:${n}.${m}` inside a list,
   table or worked number, `:fig` for a block's diagram, `:m${k}` for a margin
   aside), so editing one block never shifts another block's ticks.
   ========================================================================== */

// The tickable keys of one item, in reading order ([] for a heading).
export function itemKeys(blockId, item, i) {
  const at = `${blockId}:${i}`;
  if (typeof item === 'string') return [at];
  if (item.sub) return [];
  if (item.steps) return item.steps.map((_, j) => `${at}.${j}`);
  if (item.table) return item.table.rows.map((_, r) => `${at}.${r}`);
  if (item.worked) return [...(item.title ? [item.title] : []), ...item.worked].map((_, j) => `${at}.${j}`);
  return [at];
}

// Margin asides: a "remember" note ticks; self-test questions and
// slide-check pointers don't.
export const asideTicks = (a) => !!a.nb;
export const asideKey = (blockId, k) => `${blockId}:m${k}`;
export const figKey = (blockId) => `${blockId}:fig`;
export const BIG_KEY = 'big';

// Every tickable key of a sheet, in the order they appear on the page.
export function sheetKeys(sheet) {
  if (!sheet) return [];
  const keys = sheet.big ? [BIG_KEY] : [];
  sheet.blocks.forEach((b) => {
    const fig = b.fig ? [figKey(b.id)] : [];
    const place = b.fig?.place ?? 'below';
    if (place === 'above') keys.push(...fig);
    b.items.forEach((it, i) => keys.push(...itemKeys(b.id, it, i)));
    if (place !== 'above') keys.push(...fig);
    (b.margin || []).forEach((a, k) => { if (asideTicks(a)) keys.push(asideKey(b.id, k)); });
  });
  return keys;
}
