import { useCallback, useEffect, useState } from 'react';

/* Every bit of progress lives in this browser only, under `sk:` keys.
   Every read and write is wrapped: private windows, blocked storage and
   thumbnail renders all just fall back to the default. */

const PREFIX = 'sk:';

export function readKey(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeKey(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
  try {
    window.dispatchEvent(new CustomEvent('sk:store', { detail: key }));
  } catch {
    /* no window events (tests) */
  }
}

// useStored('progress', {}) → [value, set]; stays in sync across components.
export function useStored(key, fallback) {
  const [v, setV] = useState(() => readKey(key, fallback));
  useEffect(() => {
    const on = (e) => {
      if (e.detail === key) setV(readKey(key, fallback));
    };
    window.addEventListener('sk:store', on);
    return () => window.removeEventListener('sk:store', on);
    // fallback is a literal at call sites; re-subscribing on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((next) => {
    const value = typeof next === 'function' ? next(readKey(key, fallback)) : next;
    writeKey(key, value);
    setV(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [v, set];
}

/* progress shape: { [levelId]: { steps: { [stepId]: true }, check: best (0–5) } } */
export function markStep(levelId, stepId) {
  const p = readKey('progress', {});
  const lv = p[levelId] ?? { steps: {} };
  if (lv.steps?.[stepId]) return;
  writeKey('progress', { ...p, [levelId]: { ...lv, steps: { ...(lv.steps ?? {}), [stepId]: true } } });
}

export function recordCheck(levelId, score) {
  const p = readKey('progress', {});
  const lv = p[levelId] ?? { steps: {} };
  const best = Math.max(lv.check ?? 0, score);
  writeKey('progress', { ...p, [levelId]: { ...lv, check: best, steps: { ...(lv.steps ?? {}), check: true } } });
}

/* Leitner deck: { [qid]: { box: 1–5, due: epoch ms, seen: n } }.
   A miss goes to box 1 (due now); a hit moves one box up and waits longer. */
const WAIT_MIN = [0, 0, 10, 60, 6 * 60, 24 * 60]; // minutes per box

export function deckAnswer(qid, correct) {
  const d = readKey('deck', {});
  const cur = d[qid];
  if (!cur && correct) return; // only misses join the deck
  const box = correct ? Math.min(5, (cur?.box ?? 1) + 1) : 1;
  const due = Date.now() + WAIT_MIN[box] * 60 * 1000;
  writeKey('deck', { ...d, [qid]: { box, due, seen: (cur?.seen ?? 0) + 1 } });
}

export function recordAnswers(list) {
  // list: [{ id, correct }]
  for (const { id, correct } of list) deckAnswer(id, correct);
}
