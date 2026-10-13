/* ============================================================================
   SEMINAR DECKS — CONTROLLER
   ----------------------------------------------------------------------------
   The talk's position is { index, step, black, ver }:
     index  position in the flat sequence (main slides, then backups)
     step   build step on that slide, 0 .. steps-1
     black  blackout on or off
     ver    a version stamp; when two windows share one talk (presenter and
            audience), whichever window changes the position stamps a higher
            ver and broadcasts it, and the other adopts any higher ver.
   Pure functions here; the hook that holds the state is in useDeck.js.
   ========================================================================== */

export const stepsOf = (slide) => Math.max(1, slide?.steps ?? 1);

export function clampPos(seq, index, step) {
  const i = Math.min(seq.length - 1, Math.max(0, index | 0));
  const s = Math.min(stepsOf(seq[i]) - 1, Math.max(0, step | 0));
  return { index: i, step: s };
}

/** Next build step, or the first step of the next slide. */
export function nextPos(seq, { index, step }) {
  if (step < stepsOf(seq[index]) - 1) return { index, step: step + 1 };
  if (index < seq.length - 1) return { index: index + 1, step: 0 };
  return { index, step };
}

/** Previous build step, or the LAST step of the previous slide (its finished state). */
export function prevPos(seq, { index, step }) {
  if (step > 0) return { index, step: step - 1 };
  if (index > 0) return { index: index - 1, step: stepsOf(seq[index - 1]) - 1 };
  return { index, step };
}

/** Human label for a position: main slides are 1..n, backups B1..Bk. */
export function labelOf(seq, index) {
  const s = seq[index];
  if (!s) return '';
  return s.kind === 'backup' ? `B${s.backupNo}` : String(s.mainNo);
}

/** Resolve a typed jump ("7", "b3", "B3") or a deep-link segment to an index. */
export function indexFromLabel(seq, label) {
  const t = String(label ?? '').trim().toLowerCase();
  if (!t) return -1;
  if (t.startsWith('b')) {
    const n = parseInt(t.slice(1), 10);
    return seq.findIndex((s) => s.kind === 'backup' && s.backupNo === n);
  }
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return seq.findIndex((s) => s.id === t);
  // Numbers past the main slides continue into the backups (14 = B1 for a 13-slide deck).
  if (n >= 1 && n <= seq.length) return n - 1;
  return -1;
}
