/* ============================================================================
   RSVP PAPERS — the timeline engine (pure, no React, node-testable)
   ----------------------------------------------------------------------------
   Turns a paper's ordered sections into a flat TIMELINE the player steps
   through one item at a time:

     { t:'h', text, level, part, sec }                  section heading card
     { t:'w', text, orp, f, sym, num, key, li, sec,      one word
              blk, par, sent, sEnd, pEnd, n, cf }
     { t:'c', block, sec }                              pause card (figure /
                                                        table / equation / algo)
     { t:'m', sec }                                     end of the main body
                                                        (stop before appendix)
     { t:'e' }                                          end of paper

   Word items carry everything the display needs so play-time work is just a
   lookup: `orp` = index of the focal letter (optimal recognition point),
   `f` = duration factor relative to the base word time (60000 / wpm), which
   already folds in length, symbols/inline math, punctuation, paragraph and
   sentence breaks and key-sentence slowing. `n` = words before this one
   (progress), `cf` = cumulative factor (time-remaining estimate).

   Building is deterministic, so a saved `index` stays valid as long as the
   sections don't change — and MCP appends only ever add to the end.
   ========================================================================== */

// ── Tokens ───────────────────────────────────────────────────────────────────

const LEAD = /^[("'“‘[«]+/;
const TRAIL_CH = /[)"'”’\]».,;:!?…]$/;

const count = (s, ch) => { let n = 0; for (const c of s) if (c === ch) n++; return n; };

/**
 * The token without its wrapping punctuation. A closing bracket that balances
 * an opener INSIDE the token is part of it ("O(BLDN)", "f(x)"), not wrapping.
 */
export function coreOf(token) {
  let s = token.replace(LEAD, '');
  for (;;) {
    const m = s.match(TRAIL_CH);
    if (!m) break;
    const ch = m[0];
    if (ch === ')' && count(s, '(') >= count(s, ')')) break;
    if (ch === ']' && count(s, '[') >= count(s, ']')) break;
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * Optimal recognition point: the letter the eye should land on. Spritz-style
 * fixed offsets by core length, shifted past any leading punctuation.
 */
export function orpIndex(token) {
  const lead = (token.match(LEAD) || [''])[0].length;
  const core = coreOf(token);
  const L = core.length;
  if (L <= 1) return Math.min(lead, Math.max(0, token.length - 1));
  const k = L <= 5 ? 1 : L <= 9 ? 2 : L <= 13 ? 3 : 4;
  return lead + Math.min(k, L - 1);
}

// Greek, super/subscripts, math operators, math alphanumerics, and the ASCII
// operators inline maths is written with. A token with any of these is "sym".
const SYM_RE = /[=+−×÷·^_∑∏∫∂∇√∞≈≠≤≥≪≫∈∉⊂⊆⊗⊕∪∩→←↔⇒⇔∀∃∅ℝℕℤℚℂ⟨⟩‖~|]|[Ͱ-Ͽ]|[⁰-₟]|[∀-⋿]|[\u{1D400}-\u{1D7FF}]/u;
const NUM_RE = /^[~≈<>±+-]?\d[\d,]*(\.\d+)?(e[-+]?\d+)?%?$/;

/** Inline maths / symbol-heavy token? (rendered mono, read slower) */
export function isSymbolic(core) {
  if (!core) return false;
  if (SYM_RE.test(core)) return true;
  if (/\d/.test(core) && /[A-Za-z]/.test(core) && !/^\d+(st|nd|rd|th|s|D|d|x|k|K|M|G|GB|MB|ms|mm|cm|nm|px|Hz|GHz|W)$/.test(core)) return true; // "T1Gd", "A100", "2^20", "1e-4"
  if (/^[A-Za-z]{1,3}\(.+\)$/.test(core)) return true;                    // "O(BLDN)", "f(x)"
  if (/[A-Za-z]_[A-Za-z0-9]/.test(core) || /[A-Za-z]\^/.test(core)) return true;
  return false;
}

/** A plain number ("2021", "0.8361", "12.7%", "1e-4"). */
export function isNumber(core) {
  return NUM_RE.test(core);
}

/**
 * Duration factor for one word (× the base word time). Tuned so that at
 * 300 wpm an ordinary sentence still averages close to 300 wpm while the
 * hard tokens and the boundaries get the extra beats.
 */
export function wordFactor(token, { key = false, sEnd = false, pEnd = false, liFirst = false } = {}) {
  const core = coreOf(token);
  const L = core.length;
  let f = L <= 3 ? 0.9 : L <= 7 ? 1 : L <= 10 ? 1.15 : L <= 13 ? 1.3 : Math.min(2.0, 1.45 + (L - 14) * 0.05);
  const sym = isSymbolic(core);
  const num = !sym && isNumber(core);
  if (sym) f *= 1.6;
  else if (num) f *= 1.35;
  if (/^[A-Z]{3,}s?$/.test(core)) f *= 1.2;                    // acronyms
  if (/[,;:]["'”’)\]]*$/.test(token)) f += 0.5;                 // clause pause
  if (sEnd) f += 1.0;                                           // sentence pause
  else if (/[)"”’\]]$/.test(token)) f += 0.15;
  if (pEnd) f += 0.8;                                           // paragraph pause
  if (liFirst) f += 0.3;                                        // breath at a bullet
  if (key) f *= 1.3;                                            // key finding: slower
  return { f: Math.round(f * 1000) / 1000, sym, num };
}

// Split a token that would otherwise be too long to flash in one go
// ("state—the", "encoder/decoder" when long). Hyphenated words stay whole.
function splitLong(tok) {
  if (tok.length <= 12) return [tok];
  const dash = tok.search(/[—–]/);
  if (dash > 0 && dash < tok.length - 1) return [tok.slice(0, dash + 1), ...splitLong(tok.slice(dash + 1))];
  if (tok.length > 22) {
    const slash = tok.indexOf('/', 3);
    if (slash > 0 && slash < tok.length - 1) return [tok.slice(0, slash + 1), ...splitLong(tok.slice(slash + 1))];
  }
  return [tok];
}

/** Whitespace tokens → words (long dash-joined tokens split). */
export function tokenize(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).flatMap(splitLong);
}

// ── Sentences ────────────────────────────────────────────────────────────────

const ABBREV = /\b(e\.g|i\.e|et al|etc|vs|cf|fig|figs|eq|eqs|sec|no|approx|resp|dr|prof|mr|mrs|ms|st|vol|pp|ch|tab|alg|ref|refs|dept|univ|inc|ltd|co|corp)$/i;

/**
 * Split a paragraph into sentences. Conservative: a sentence ends at . ! ?
 * (plus closing quotes/brackets) when the next token starts like a sentence
 * and the token isn't an abbreviation, an initial, or a bare number.
 */
export function splitSentences(text) {
  const toks = tokenize(text);
  const out = [];
  let cur = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    cur.push(tok);
    const bare = tok.replace(/["'”’)\]]+$/, '');
    if (!/[.!?]$/.test(bare)) continue;
    const word = bare.slice(0, -1);
    const next = toks[i + 1];
    const isEnd =
      !next ||
      (/^[A-Z0-9("“‘[]/.test(next) &&
        !ABBREV.test(word) &&
        !/^[A-Z]$/.test(word) &&                 // initials: "J. Smith"
        !(/^\d+$/.test(word) && /^[a-z]/.test(next)));
    if (isEnd) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

// ── Build ────────────────────────────────────────────────────────────────────

const countWords = (s) => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0);

/**
 * @param {Array<{heading:string, level:number, part:'main'|'appendix', blocks:Array}>} sections
 * @returns {{ items, sections, mainEnd, totalWords, mainWords, appendixWords, totalF, hasAppendix }}
 */
export function buildTimeline(sections) {
  const items = [];
  const secs = [];
  let words = 0;
  let cf = 0;
  let sent = 0;
  let par = 0;
  let mainEnd = -1;
  let mainWords = 0;
  let appendixWords = 0;

  const pushText = (text, meta) => {
    const sentences = splitSentences(text);
    if (!sentences.length) return;
    par += 1;
    const lastS = sentences.length - 1;
    sentences.forEach((toks, si) => {
      sent += 1;
      const lastT = toks.length - 1;
      toks.forEach((tok, ti) => {
        const sEnd = ti === lastT;
        const pEnd = sEnd && si === lastS;
        const { f, sym, num } = wordFactor(tok, { key: meta.key, sEnd, pEnd, liFirst: Boolean(meta.li) && si === 0 && ti === 0 });
        cf += f;
        items.push({
          t: 'w', text: tok, orp: orpIndex(tok), f, sym, num,
          key: meta.key || false, li: meta.li || null,
          sec: meta.sec, blk: meta.blk, par, sent, sEnd, pEnd,
          n: words, cf,
        });
        words += 1;
      });
    });
  };

  sections.forEach((s, si) => {
    const part = s.part === 'appendix' ? 'appendix' : 'main';
    if (part === 'appendix' && mainEnd < 0) {
      items.push({ t: 'm', sec: si, n: words, cf });
      mainEnd = items.length - 1;
    }
    const startWords = words;
    secs.push({ index: si, heading: s.heading, level: s.level || 1, part, start: items.length, words: 0 });
    items.push({ t: 'h', text: s.heading, level: s.level || 1, part, sec: si, n: words, cf });
    (s.blocks || []).forEach((b, bi) => {
      if (b.type === 'text') pushText(b.text, { key: Boolean(b.key), sec: si, blk: bi });
      else if (b.type === 'list') (b.items || []).forEach((it, k) => pushText(it, { sec: si, blk: bi, li: { n: k + 1, of: b.items.length } }));
      else {
        // A float's caption counts as read words (it's what the card shows).
        const cw = countWords(b.caption) || countWords(b.label);
        items.push({ t: 'c', block: b, sec: si, n: words, cf });
        words += cw;
        cf += cw * 1.2;
      }
    });
    secs[si].words = words - startWords;
    if (part === 'appendix') appendixWords += secs[si].words; else mainWords += secs[si].words;
  });

  items.push({ t: 'e', n: words, cf });
  return { items, sections: secs, mainEnd, totalWords: words, mainWords, appendixWords, totalF: cf, hasAppendix: mainEnd >= 0 };
}

// ── Play-time timing ─────────────────────────────────────────────────────────

/**
 * Milliseconds to show `item`, or null for a stop point (the player pauses
 * ON the item). settings: { wpm, intensity, cardSeconds, headingMode }
 *   intensity  0 = flat (every word gets the base time) … 1.5 = strong
 *   cardSeconds 0 = pause cards stop; n = auto-continue after n seconds
 *   headingMode 'auto' | 'stop'
 */
export function itemDuration(item, settings) {
  const base = 60000 / Math.max(50, settings.wpm || 300);
  switch (item.t) {
    case 'w':
      return Math.max(35, base * (1 + (item.f - 1) * (settings.intensity ?? 1)));
    case 'h': {
      if (settings.headingMode === 'stop') return null;
      const n = countWords(item.text);
      return Math.min(3200, Math.max(1100, 400 + n * base * 1.5));
    }
    case 'c':
      return settings.cardSeconds ? settings.cardSeconds * 1000 : null;
    default:
      return null;
  }
}

/** Rough minutes left from `index` at the current settings. */
export function minutesLeft(tl, index, settings) {
  const base = 60000 / Math.max(50, settings.wpm || 300);
  const item = tl.items[Math.min(index, tl.items.length - 1)];
  const cfHere = item ? (item.t === 'w' ? item.cf - item.f : item.cf) : tl.totalF;
  const remainingF = Math.max(0, tl.totalF - cfHere);
  const scaled = remainingF * (settings.intensity ?? 1) + (tl.totalWords - (item?.n ?? tl.totalWords)) * (1 - (settings.intensity ?? 1));
  return Math.max(0, scaled * base) / 60000;
}

// ── Navigation (pure index maths) ────────────────────────────────────────────

export const isStop = (item) => !item || item.t === 'c' || item.t === 'm' || item.t === 'e';

/** Index of the nearest word at or before i (or -1). */
export function wordAtOrBefore(items, i) {
  for (let j = Math.min(i, items.length - 1); j >= 0; j--) if (items[j].t === 'w') return j;
  return -1;
}

/** First item of the sentence containing i (headings/cards count as their own unit). */
export function sentenceStart(items, i) {
  const it = items[i];
  if (!it || it.t !== 'w') return i;
  let j = i;
  while (j > 0 && items[j - 1].t === 'w' && items[j - 1].sent === it.sent) j--;
  return j;
}

/** ← : go to the start of this sentence, or the previous sentence when already there. */
export function prevSentence(items, i) {
  const s = sentenceStart(items, i);
  if (s < i) return s;
  if (s === 0) return 0;
  const prev = s - 1;
  return items[prev].t === 'w' ? sentenceStart(items, prev) : prev;
}

/** → : start of the next sentence / the next non-word item. */
export function nextSentence(items, i) {
  const it = items[i];
  if (!it) return items.length - 1;
  if (it.t !== 'w') return Math.min(items.length - 1, i + 1);
  let j = i;
  while (j < items.length - 1 && items[j].t === 'w' && items[j].sent === it.sent) j++;
  return Math.min(items.length - 1, j);
}

/**
 * Section index of item i. The end-of-main marker belongs to the LAST main
 * section (it sits before the first appendix heading); the end marker to the
 * last section.
 */
export function sectionOf(tl, i) {
  const it = tl.items[i];
  if (!it) return tl.sections.length - 1;
  if (it.t === 'm') return Math.max(0, it.sec - 1);
  if (it.sec !== undefined) return it.sec;
  return tl.sections.length - 1;
}

/** The [start, end) item range of the paragraph containing i (words only). */
export function paragraphRange(items, i) {
  const it = items[i];
  if (!it || it.t !== 'w') return null;
  let a = i; let b = i;
  while (a > 0 && items[a - 1].t === 'w' && items[a - 1].par === it.par) a--;
  while (b < items.length - 1 && items[b + 1].t === 'w' && items[b + 1].par === it.par) b++;
  return [a, b + 1];
}

/** Heading trail for the eyebrow: the current section and its ancestors. */
export function headingTrail(sections, si) {
  const trail = [];
  let level = Infinity;
  for (let j = si; j >= 0 && trail.length < 3; j--) {
    if (sections[j].level < level) { trail.unshift(sections[j]); level = sections[j].level; }
    if (level === 1) break;
  }
  return trail;
}
