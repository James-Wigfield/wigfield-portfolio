import { texText } from './texText';

/* ============================================================================
   EXAM PRACTICE — THE INLINE MARKUP, AS PLAIN TEXT
   ----------------------------------------------------------------------------
   The tokeniser Rich.jsx renders with, and plainText(): the same markup
   flattened to the words a reader sees (maths through texText), used for
   aria labels, the PDF checks and the sample's verbatim check.
   ========================================================================== */

export const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*.+?\*\*)|(\*[^*\n]+?\*)/;
export const GREEN = '{g|';

// {g|…} bodies may hold TeX braces, so the closing brace is counted, not matched
export function closeBrace(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

export function plainText(text) {
  let s = String(text ?? '');
  let g = s.indexOf(GREEN);
  while (g !== -1) {
    const end = closeBrace(s, g);
    if (end === -1) break;
    s = s.slice(0, g) + s.slice(g + GREEN.length, end) + s.slice(end + 1);
    g = s.indexOf(GREEN);
  }
  return s
    .replace(/\$([^$]+)\$/g, (_, t) => texText(t))
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
