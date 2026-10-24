import { NAMED_CODE } from './slideData.js';

// The lines a code card shows: lines a…b (1-based, inclusive) of a slide
// listing, verbatim. Kept apart from CodeCard.jsx so the checks can import it.
export function cardLines({ src, lines }) {
  const all = (NAMED_CODE[src] ?? '').split('\n');
  return all.slice(lines[0] - 1, lines[1]).join('\n');
}
