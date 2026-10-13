import { fact } from './facts';

/* ============================================================================
   SEMINAR DECKS — TEXT: templates and transcripts (pure functions)
   ----------------------------------------------------------------------------
   fill('... {{key}} ...')   a string with manifest numbers filled in

   Transcript mark-up (a plain string per slide):
     {{key}}                 a manifest number
     [CLICK], [PAUSE], [CLIP PLAYS, {{clip.a1}}, keep talking], [POINT AT ...]
                             cues: shown, never spoken, not counted as words
     [[cut]] ... [[/cut]]    the sentence to drop when behind (spoken and
                             counted by default)
   The React side (<Num>, <T>, <Script>) is in Num.jsx.
   ========================================================================== */

export const TOKEN = /\{\{([\w.]+)\}\}/g;

export function fill(str) {
  return String(str ?? '').replace(TOKEN, (_, k) => fact(k));
}

/** Split a transcript into parts: { kind: 'text' | 'cue' | 'cut', text }. */
export function parseScript(str) {
  const parts = [];
  const re = /\[\[cut\]\]([\s\S]*?)\[\[\/cut\]\]|\[([^\]]+)\]/g;
  let last = 0;
  let m;
  const s = String(str ?? '');
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ kind: 'text', text: s.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ kind: 'cut', text: m[1] });
    else parts.push({ kind: 'cue', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ kind: 'text', text: s.slice(last) });
  return parts;
}

/** The spoken words: cues removed, numbers filled, the cut sentence kept unless dropCut. */
export function spokenText(str, { dropCut = false } = {}) {
  return parseScript(str)
    .filter((p) => p.kind === 'text' || (p.kind === 'cut' && !dropCut))
    .map((p) => fill(p.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(str, opts) {
  const t = spokenText(str, opts);
  return t ? t.split(' ').filter((w) => /[A-Za-z0-9]/.test(w)).length : 0;
}

export const WPM = 135;

/** Seconds of talking for a script: words at 135 a minute plus unnarrated clip seconds. */
export function scriptSeconds(script) {
  if (!script) return 0;
  return (wordCount(script.text) / WPM) * 60 + (script.silent ?? 0);
}

export function fmtTime(sec) {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  return `${neg ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The cut sentence alone (for the presenter's "cut if behind" line). */
export function cutText(str) {
  const p = parseScript(str).find((x) => x.kind === 'cut');
  return p ? fill(p.text).trim() : '';
}
