import { REFS } from '../shared/refs';
import { scriptSeconds, wordCount } from '../shared/text';

/* ============================================================================
   SEMINAR DECKS — SEQUENCE
   ----------------------------------------------------------------------------
   A deck module exports { slug, name, slides, backups, ... }. buildSequence
   flattens it into the order the talk runs (main slides, then backups),
   numbers the main slides 1..n and the backups B1..Bk, numbers the cited works
   in order of first citation (IEEE), and adds the timing of every main slide:
   target seconds, cumulative target, words and spoken seconds at 135 a minute.
   ========================================================================== */

const cache = new WeakMap();

export function buildSequence(deck) {
  if (cache.has(deck)) return cache.get(deck);
  const seq = [];
  let cum = 0;
  (deck.slides ?? []).forEach((s, i) => {
    const target = s.script?.seconds ?? 0;
    cum += target;
    seq.push({
      ...s,
      kind: 'main',
      mainNo: i + 1,
      words: s.script ? wordCount(s.script.text) : 0,
      spoken: scriptSeconds(s.script),
      target,
      cumTarget: cum,
    });
  });
  (deck.backups ?? []).forEach((s, i) => {
    seq.push({
      ...s,
      kind: 'backup',
      backupNo: i + 1,
      words: s.script ? wordCount(s.script.text) : 0,
      spoken: scriptSeconds(s.script),
      target: 0,
      cumTarget: cum,
    });
  });

  const order = [];
  seq.forEach((s) => (s.cites ?? []).forEach((k) => {
    if (!order.includes(k)) order.push(k);
  }));
  // The references backup lists every cited work, so it can cite them all too.
  Object.keys(REFS).forEach((k) => {
    if (seq.some((s) => (s.cites ?? []).includes(k)) && !order.includes(k)) order.push(k);
  });
  const refNum = (k) => {
    const i = order.indexOf(k);
    return i >= 0 ? i + 1 : '?';
  };

  const main = seq.filter((s) => s.kind === 'main');
  const totals = {
    mainCount: main.length,
    backupCount: seq.length - main.length,
    targetSeconds: cum,
    words: main.reduce((a, s) => a + s.words, 0),
    spokenSeconds: main.reduce((a, s) => a + s.spoken, 0),
    silentSeconds: main.reduce((a, s) => a + (s.script?.silent ?? 0), 0),
  };

  const out = { deck, seq, refOrder: order, refNum, totals };
  cache.set(deck, out);
  return out;
}

/** Every media path a deck uses (for the Ready check and the media gate). */
export function deckMedia(deck) {
  const set = new Set(deck.media ?? []);
  [...(deck.slides ?? []), ...(deck.backups ?? [])].forEach((s) => (s.media ?? []).forEach((m) => set.add(m)));
  (deck.fonts ?? []).forEach((f) => set.add(`fonts/${f}`));
  return [...set];
}
