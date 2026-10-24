/* ============================================================================
   EXAM PRACTICE — INK BUILDERS (the handwritten answer blocks)
   ----------------------------------------------------------------------------
   The paper files build their model answers from these (see ./index.js for
   the full schema). `m` = the marks a marker would tick for that block; a
   leaf's ticks add up to its marks (check-papers.mjs).
   ========================================================================== */

export const w = (text, m = 0) => ({ t: 'w', text, m });
export const h = (text) => ({ t: 'h', text });
export const eq = (tex, m = 0) => ({ t: 'eq', tex, m });
export const ul = (items) => ({ t: 'ul', items: items.map((it) => (Array.isArray(it) ? { text: it[0], m: it[1] } : { text: it, m: 0 })) });
export const tbl = (head, rows, m = 0) => ({ t: 'tbl', head, rows, m });
export const fig = (key, desc, m = 0) => ({ t: 'fig', key, desc, m });
export const slip = (text) => ({ t: 'slip', text });
