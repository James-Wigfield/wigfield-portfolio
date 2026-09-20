/* A ten-line external store: the frame loop writes, the HUD reads through
   useSyncExternalStore, and React only re-renders the DOM overlay when a
   value it shows actually changes. */
import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      let changed = false;
      for (const k in next) if (next[k] !== state[k]) { changed = true; break; }
      if (!changed) return;
      state = next;
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}
