import { CELLS, SECTIONS } from './data/notebook';

/* Labels computed from the extracted notebook, so a plate's "explains In [n]"
   and its receipts follow the real execution counts after a re-extract. */
const codeEcs = (from, to) =>
  CELLS.slice(from, to + 1)
    .filter((c) => c.type === 'code' && c.ec !== null && c.ec !== undefined)
    .map((c) => c.ec);

export function cellsLabel(from, to) {
  const ecs = codeEcs(from, to);
  if (!ecs.length) return from === to ? `cell ${from}` : `cells ${from}–${to}`;
  const lo = Math.min(...ecs);
  const hi = Math.max(...ecs);
  return lo === hi ? `In [${lo}]` : `In [${lo}]–[${hi}]`;
}

export function inLabel(c) {
  const cell = CELLS[c];
  return cell?.type === 'code' && cell.ec != null ? `In [${cell.ec}]` : `cell ${c}`;
}

export function outLabel(c) {
  const cell = CELLS[c];
  return cell?.type === 'code' && cell.ec != null ? `Out [${cell.ec}]` : `cell ${c}`;
}

// Cell lookups by section, so plates survive small changes in cell indices:
// codeCell('s6', 0) = the first code cell of section 6.

const section = (key) => SECTIONS.find((s) => s.key === key);

export function sectionRange(key) {
  const s = section(key);
  return s ? [s.start, s.end] : [0, 0];
}

function nth(key, type, k) {
  const s = section(key);
  if (!s) return 0;
  const list = CELLS.slice(s.start, s.end + 1).filter((c) => c.type === type);
  const c = list[k < 0 ? list.length + k : k];
  return c ? c.i : s.start;
}
export const codeCell = (key, k = 0) => nth(key, 'code', k);
export const mdCell = (key, k = 0) => nth(key, 'markdown', k);
