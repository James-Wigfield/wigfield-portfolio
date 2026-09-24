/* ============================================================================
   RSVP PAPERS — markdown table → rows (pure, no React, node-testable)
   ----------------------------------------------------------------------------
   Table pause-cards carry the full table as a GitHub-style markdown table in
   `content`. This turns it into { header, align, rows } for a real <table>.
   Anything that isn't a table (no header separator row) returns null and the
   card falls back to a mono <pre>. Cells are plain text: bold/italic markers
   are stripped, escaped pipes ("\|") are honoured.
   ========================================================================== */

const SEP_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  // Split on unescaped pipes only.
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i += 1; continue; }
    if (ch === '|') { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells.map(cleanCell);
}

function cleanCell(c) {
  return c.trim().replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?\S)\*(?=\s|$)/g, '$1$2').replace(/`([^`]+)`/g, '$1');
}

/**
 * @param {string} src markdown
 * @returns {{ header: string[], align: (null|'left'|'center'|'right')[], rows: string[][] } | null}
 */
export function parseMarkdownTable(src) {
  if (typeof src !== 'string') return null;
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length && l.includes('|'));
  if (lines.length < 2 || !SEP_ROW.test(lines[1])) return null;
  const header = splitRow(lines[0]);
  const align = splitRow(lines[1]).map((c) => {
    const l = c.startsWith(':'); const r = c.endsWith(':');
    return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
  });
  const width = header.length;
  const rows = lines.slice(2).filter((l) => !SEP_ROW.test(l)).map((l) => {
    const cells = splitRow(l);
    while (cells.length < width) cells.push('');
    return cells.slice(0, width);
  });
  return { header, align, rows };
}

/** True for cells that read as numbers ("0.8361", "196.03G", "12.7%", "~3", "1e-4"). */
export function isNumericCell(c) {
  return /^[~≈<>±+-]?\s*\d[\d,]*(\.\d+)?\s*(e[-+]?\d+)?\s*[%A-Za-zμ]{0,4}$/.test(String(c).trim());
}
