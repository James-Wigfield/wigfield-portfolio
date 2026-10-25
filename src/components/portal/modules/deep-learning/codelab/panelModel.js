import { pyTokens } from './tokens.js';

/* ============================================================================
   CODE LAB — THE CODE PANEL'S MODEL
   ----------------------------------------------------------------------------
   One function turns a card's code and marks into rows of coloured
   segments, and both renderers read it: CodePanel.jsx (the screen) and
   panelImage.js (the print image). So the two can never disagree about
   which line is banded, which text is underlined or where a number sits.

   A mark is either
     { n, lines: [from, to], say }            a line range → a highlight
                                              band, ① in the gutter of `from`
     { n, token: { line, text, nth? }, say }  exact text on one line → an
                                              underline, ② straight after it
   `nth` picks the nth occurrence (1-based) when the text repeats on the line.
   ========================================================================== */

export const codeLines = (code) => code.replace(/\n$/, '').split('\n');

// Where a token mark's text sits on its line: [start, end) or null.
export function tokenSpan(line, token) {
  let at = -1;
  for (let k = 0; k < (token.nth || 1); k += 1) {
    at = line.indexOf(token.text, at + 1);
    if (at < 0) return null;
  }
  return [at, at + token.text.length];
}

// rows: [{ no, text, band: n|null, bandStart: bool, gutter: n|null,
//          segs: [{ t, cls, u: n|null, badge: n|null }] }]
export function panelRows(code, marks = []) {
  const lines = codeLines(code);
  return lines.map((text, i) => {
    const no = i + 1;
    const lineMark = marks.find((m) => m.lines && no >= m.lines[0] && no <= m.lines[1]);
    const toks = marks
      .filter((m) => m.token && m.token.line === no)
      .map((m) => ({ n: m.n, span: tokenSpan(text, m.token) }))
      .filter((m) => m.span);
    // split the Dark+ tokens at every underline boundary
    const cuts = new Set(toks.flatMap((m) => m.span));
    const segs = [];
    let pos = 0;
    pyTokens(text).forEach((tok) => {
      let start = 0;
      const end = tok.t.length;
      for (let c = 1; c < end; c += 1) {
        if (cuts.has(pos + c)) {
          segs.push({ t: tok.t.slice(start, c), cls: tok.cls, from: pos + start });
          start = c;
        }
      }
      segs.push({ t: tok.t.slice(start), cls: tok.cls, from: pos + start });
      pos += end;
    });
    segs.forEach((s) => {
      const hit = toks.find((m) => s.from >= m.span[0] && s.from < m.span[1]);
      s.u = hit ? hit.n : null;
      const closes = toks.find((m) => s.from + s.t.length === m.span[1]);
      s.badge = closes ? closes.n : null;
    });
    return {
      no,
      text,
      band: lineMark ? lineMark.n : null,
      bandStart: !!lineMark && lineMark.lines[0] === no,
      gutter: lineMark && lineMark.lines[0] === no ? lineMark.n : null,
      segs,
    };
  });
}

// The text a legend entry quotes: the token, the mark's own `quote`, or the
// first marked line with its indentation trimmed.
export function markQuote(code, mark) {
  if (mark.token) return mark.token.text;
  if (mark.quote) return mark.quote;
  return codeLines(code)[mark.lines[0] - 1].trim();
}

// "line 4", "lines 3–5"
export function markWhere(mark) {
  if (mark.token) return `line ${mark.token.line}`;
  const [a, b] = mark.lines;
  return a === b ? `line ${a}` : `lines ${a}–${b}`;
}
