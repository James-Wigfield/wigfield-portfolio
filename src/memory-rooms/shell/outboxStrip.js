/* Lets a screen that shows upload status itself (the Saved screen) hide the outbox
   line under the header, so the status is never said twice. */

import { useEffect, useSyncExternalStore } from 'react';

let hiders = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Call in a component that shows its own upload status. */
export function useHideOutboxStrip() {
  useEffect(() => {
    hiders += 1;
    emit();
    return () => {
      hiders -= 1;
      emit();
    };
  }, []);
}

export function useOutboxStripHidden() {
  return useSyncExternalStore(subscribe, () => hiders > 0, () => false);
}
