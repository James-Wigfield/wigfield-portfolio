import { useCallback, useSyncExternalStore } from 'react';

const matches = (q) => {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
};

/** Live boolean for a CSS media query. */
export function useMedia(query) {
  const subscribe = useCallback(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matches(query), () => false);
}
