import { panelRows } from './panelModel.js';
import { DARK } from './tokens.js';

/* ============================================================================
   CODE LAB — THE CODE PANEL AS A PRINT IMAGE
   ----------------------------------------------------------------------------
   For the PDF every code panel is drawn on a <canvas> at 3× and embedded as
   one PNG, so NotebookLM (and anyone cropping the page) gets each panel as a
   single crisp picture: the dark Dark+ editor, the title bar with its dots,
   the filename, the card label, line numbers and the marks (bands,
   underlines, circled numbers), exactly as on screen. A plain-text copy of
   the code sits under the image (CodePanel.jsx), so the PDF's text layer
   still holds every line.

   Long lines: the font is the largest from 10.5 px (7.9 pt) down to 10 px
   (7.5 pt) at which the panel's longest line fits; a line that still won't
   fit wraps with a hanging indent, a ↪ and no new line number, so the
   numbers match the screen. It wraps after a space, comma or bracket or
   before a dot or '=', never mid-word (wrapRow), so the text layer under the
   image reads as code too.
   ========================================================================== */

export const PRINT_PANEL_PX = 453; // the panel's width on A4: 190 mm − the 66 mm legend column − the gap
const SCALE = 3;
const MAX_FONT = 10.5;
const MIN_FONT = 10;
const BADGE_CH = 2.2; // a circled number takes 2.2 character cells

// gutter = [0.6ch pad][2.4ch mark][2.6ch number][1.1ch gap]
const G_PAD = 0.6;
const G_MARK = 2.4;
const G_NO = 2.6;
const G_GAP = 1.1;
const GUTTER = G_PAD + G_MARK + G_NO + G_GAP;

function rowCells(row) {
  return row.segs.reduce((s, seg) => s + seg.t.length + (seg.badge ? BADGE_CH : 0), 0);
}

// Where a long line may wrap: after a space, a comma or an opening bracket,
// or before a dot or '=' (not inside a number or an operator like '==').
const BREAK_AFTER = new Set([' ', ',', '(', '[', '{']);
function canBreak(chars, i) {
  const a = chars[i - 1].ch;
  const b = chars[i].ch;
  if (BREAK_AFTER.has(a)) return true;
  if (b === '.') return !/[0-9]/.test(a) && a !== '.';
  if (b === '=') return !/[=<>!+\-*/]/.test(a) && chars[i + 1]?.ch !== '=';
  return false;
}

// Split one row into visual lines of at most maxCells; continuation lines
// are indented by `indent` cells. A break goes at the last allowed point in
// the line's final 40%, outside a marked token when it can; only a line with
// no such point is cut mid-word.
function wrapRow(row, maxCells, indent) {
  const chars = [];
  row.segs.forEach((seg, si) => {
    for (let k = 0; k < seg.t.length; k += 1) {
      chars.push({ ch: seg.t[k], si, w: 1 + (seg.badge && k === seg.t.length - 1 ? BADGE_CH : 0) });
    }
  });
  const marked = (i) => !!(row.segs[chars[i - 1].si].u && row.segs[chars[i].si].u);
  const segsOf = (a, b) => {
    const out = [];
    for (let i = a; i < b; i += 1) {
      const c = chars[i];
      const seg = row.segs[c.si];
      const last = out[out.length - 1];
      if (last && last.si === c.si) last.t += c.ch;
      else out.push({ ...seg, si: c.si, t: c.ch, badge: null });
      if (c.w > 1) out[out.length - 1].badge = seg.badge;
    }
    return out;
  };
  const visual = [];
  let p = 0;
  while (p < chars.length) {
    const first = visual.length === 0;
    const room = maxCells - (first ? 0 : indent);
    let used = 0;
    let e = p;
    while (e < chars.length && used + chars[e].w <= room) {
      used += chars[e].w;
      e += 1;
    }
    if (e === p) e = p + 1;
    let b = e;
    if (e < chars.length) {
      const min = p + Math.ceil((e - p) * 0.6);
      let cand = -1;
      for (let i = e; i >= min && cand < 0; i -= 1) if (canBreak(chars, i) && !marked(i)) cand = i;
      for (let i = e; i >= min && cand < 0; i -= 1) if (canBreak(chars, i)) cand = i;
      if (cand > p) b = cand;
    }
    visual.push({ row, segs: segsOf(p, b), cont: !first, indent: first ? 0 : indent });
    p = b;
    // a continuation starts at its first character, not at a run of spaces
    while (p < chars.length && chars[p].ch === ' ' && chars[p].w === 1) p += 1;
  }
  return visual;
}

// pick the font size and split rows that still don't fit into visual lines
export function layoutPanel(code, marks, cw1, width = PRINT_PANEL_PX) {
  const rows = panelRows(code, marks);
  const longest = Math.max(1, ...rows.map(rowCells));
  const fit = (width - 14) / ((GUTTER + longest) * cw1);
  const font = Math.max(MIN_FONT, Math.min(MAX_FONT, Math.floor(fit * 4) / 4));
  const cw = cw1 * font;
  const maxCells = Math.floor((width - 14) / cw - GUTTER);
  const visual = [];
  rows.forEach((row) => {
    if (rowCells(row) <= maxCells) {
      visual.push({ row, segs: row.segs, cont: false });
      return;
    }
    // wrap: hanging indent = the line's own indentation + 4
    const indent = Math.min(12, (/^\s*/.exec(row.text)[0].length) + 4);
    visual.push(...wrapRow(row, maxCells, indent));
  });
  return { font, cw, visual, wrapped: visual.length > rows.length };
}

// an outlined circle with the mark's number in it (as .dlc-num-o on screen)
function circled(ctx, n, cx, cy, font, family, colour) {
  const r = font * 0.56;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${Math.round(font * 0.78)}px ${family}`;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.fillText(String(n), cx, cy + 0.5);
  ctx.textAlign = 'left';
}

// Draw one panel; returns { url, height, font, wrapped } (height in CSS px).
export function panelImage({ code, marks, file, meta, family }) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `100px ${family}`;
  const cw1 = probe.measureText('0').width / 100;
  const { font, cw, visual, wrapped } = layoutPanel(code, marks, cw1);
  const lh = Math.round(font * 1.26 * 10) / 10;
  const bar = 21;
  const padY = 5;
  const W = PRINT_PANEL_PX;
  const H = bar + padY * 2 + visual.length * lh;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';

  // title bar: dots, filename, card label on the right
  ctx.fillStyle = DARK.bar;
  ctx.fillRect(0, 0, W, bar);
  ctx.fillStyle = DARK.barLine;
  ctx.fillRect(0, bar - 1, W, 1);
  DARK.dots.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(12 + i * 12, bar / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `10.5px ${family}`;
  ctx.fillStyle = DARK.file;
  ctx.fillText(file, 52, bar / 2);
  const fileEnd = 52 + ctx.measureText(file).width + 14;
  if (meta) {
    ctx.font = `bold 10px ${family}`;
    let m = meta;
    while (m.length > 4 && ctx.measureText(m).width > W - fileEnd - 12) m = `${m.slice(0, -2)}…`;
    ctx.fillStyle = DARK.file;
    ctx.textAlign = 'right';
    ctx.fillText(m, W - 12, bar / 2);
    ctx.textAlign = 'left';
  }

  // editor
  ctx.fillStyle = DARK.bg;
  ctx.fillRect(0, bar, W, H - bar);
  const x0 = 7 + GUTTER * cw;
  visual.forEach((v, i) => {
    const y = bar + padY + i * lh;
    const mid = y + lh / 2;
    if (v.row.band) {
      ctx.fillStyle = DARK.band;
      ctx.fillRect(0, y, W, lh);
      ctx.fillStyle = DARK.bandBar;
      ctx.fillRect(0, y, 2.5, lh);
    }
    if (!v.cont) {
      if (v.row.gutter) circled(ctx, v.row.gutter, 7 + (G_PAD + G_MARK / 2) * cw, mid, font, family, DARK.markLine);
      ctx.font = `${font}px ${family}`;
      ctx.fillStyle = v.row.band ? DARK.gutterOn : DARK.gutter;
      ctx.textAlign = 'right';
      ctx.fillText(String(v.row.no), 7 + (G_PAD + G_MARK + G_NO) * cw, mid);
      ctx.textAlign = 'left';
    } else {
      ctx.font = `${font}px ${family}`;
      ctx.fillStyle = DARK.gutter;
      ctx.textAlign = 'right';
      ctx.fillText('↪', 7 + (G_PAD + G_MARK + G_NO) * cw, mid);
      ctx.textAlign = 'left';
    }
    let x = x0 + (v.indent || 0) * cw;
    v.segs.forEach((seg) => {
      ctx.font = `${seg.cls === 'cm' ? 'italic ' : ''}${font}px ${family}`;
      ctx.fillStyle = seg.cls ? DARK.tok[seg.cls] : DARK.text;
      ctx.fillText(seg.t, x, mid);
      const w = seg.t.length * cw;
      if (seg.u) {
        ctx.fillStyle = DARK.markTok;
        ctx.fillRect(x, mid + font * 0.62, w, 1.6);
      }
      x += w;
      if (seg.badge) {
        circled(ctx, seg.badge, x + (BADGE_CH / 2) * cw, mid, font, family, DARK.markTok);
        x += BADGE_CH * cw;
      }
    });
  });
  // where the code sits, so the text layer can lie exactly under it
  const text = visual.map((v) => `${' '.repeat(v.indent || 0)}${v.segs.map((g) => g.t).join('')}`);
  return { url: canvas.toDataURL('image/png'), width: W, height: H, font, wrapped, lh, top: bar + padY, left: x0, text };
}
