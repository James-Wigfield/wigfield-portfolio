import { buildSequence } from './sequence';
import { labelOf } from './controller';
import { fill, spokenText, wordCount } from '../shared/text';

/* ============================================================================
   SEMINAR DECKS — THE TALK AS TEXT (for the phone script and the palm cards)
   ----------------------------------------------------------------------------
   Built from the deck at render time, so both stay current when a transcript
   in the skeleton changes. Each main slide: its number, title, the
   transcript James reads (`said`, numbers filled), split into sentences, and
   the cumulative "ends at" target (the same as the Script tab). Then the demo
   slide, if the deck has one (deck.demoId), and the backups with the number
   to type on the Mac (main slides then backups: 15 is B1 for 14 slides).
   ========================================================================== */

/** Sentences of a transcript, split after . ? or ! when the next word starts a sentence. */
export function sentences(text) {
  return String(text ?? '').split(/(?<=[.?!])\s+(?=["A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

/** True when the deck has James's own transcripts (the plain deck). */
export const hasSaid = (deck) => (deck.slides ?? []).some((s) => s.said);

export function talkPlan(deck) {
  const { seq, totals } = buildSequence(deck);
  const main = seq.filter((s) => s.kind === 'main');
  let before = 0;
  const totalWords = main.reduce((a, s) => a + wordCount(s.said ?? s.script?.text ?? ''), 0);
  const slides = main.map((s, i) => {
    const text = spokenText(s.said ?? s.script?.text ?? '');
    const words = wordCount(s.said ?? s.script?.text ?? '');
    const out = {
      no: i + 1,
      id: s.id,
      title: fill(s.title ?? ''),
      text,
      sentences: sentences(text),
      words,
      wordsBefore: before,
      target: s.target,
      endsAt: s.cumTarget,
      timed: Boolean(s.saidSecs),
    };
    before += words;
    return out;
  });
  const entry = (i) => ({ label: labelOf(seq, i), typed: i + 1, id: seq[i].id, title: fill(seq[i].title ?? '') });
  const demoIndex = deck.demoId ? seq.findIndex((s) => s.backupId === deck.demoId) : -1;
  const backups = seq
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.kind === 'backup' && i !== demoIndex)
    .map(({ s, i }) => ({ ...entry(i), q: fill((deck.qa ?? []).find((q) => q.backup === s.backupId)?.q ?? '') }));
  return {
    name: deck.name,
    slides,
    total: main.length,
    totalWords,
    targetTotal: totals.targetSeconds,
    demo: demoIndex >= 0 ? entry(demoIndex) : null,
    backups,
  };
}
