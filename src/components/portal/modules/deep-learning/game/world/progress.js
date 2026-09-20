/* ============================================================================
   PROGRESS — which scrolls are found, which doors have opened
   ----------------------------------------------------------------------------
   Persisted to localStorage per lecture, every read and write wrapped so a
   blocked or full store degrades to "fresh start" and never throws into the
   render. The shape is deliberately tiny and forwards-compatible.
   ========================================================================== */
import { useCallback, useMemo, useState } from 'react';
import { LECTURE, SCROLLS, HOUSES } from '../content/scrolls';

const KEY = `dlg:${LECTURE.code}:${LECTURE.id}:v1`;

const fresh = () => ({ found: [], solved: [], v: 1 });

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.found)) return fresh();
    const known = new Set(SCROLLS.map((s) => s.id));
    const houses = new Set(HOUSES.map((h) => h.id));
    return {
      found: p.found.filter((id) => known.has(id)),
      solved: Array.isArray(p.solved) ? p.solved.filter((id) => houses.has(id)) : [],
      v: 1,
    };
  } catch {
    return fresh();
  }
}

function persist(p) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode, quota, disabled storage — the session still works */
  }
  return p;
}

/* Derived facts every HUD and lamp wants. */
export function summarise(p) {
  const perHouse = {};
  for (const h of HOUSES) {
    const ids = SCROLLS.filter((s) => s.house === h.id).map((s) => s.id);
    const found = ids.filter((id) => p.found.includes(id)).length;
    perHouse[h.id] = { found, total: ids.length, complete: found === ids.length, solved: p.solved.includes(h.id) };
  }
  return {
    found: p.found.length,
    total: SCROLLS.length,
    perHouse,
    housesSolved: p.solved.length,
    allDone: p.solved.length === HOUSES.length && p.found.length === SCROLLS.length,
  };
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress);

  const findScroll = useCallback((id) => {
    setProgress((prev) => (prev.found.includes(id) ? prev : persist({ ...prev, found: [...prev.found, id] })));
  }, []);
  const solveHouse = useCallback((id) => {
    setProgress((prev) => (prev.solved.includes(id) ? prev : persist({ ...prev, solved: [...prev.solved, id] })));
  }, []);
  const reset = useCallback(() => setProgress(persist(fresh())), []);

  const actions = useMemo(() => ({ findScroll, solveHouse, reset }), [findScroll, solveHouse, reset]);
  return [progress, actions];
}
