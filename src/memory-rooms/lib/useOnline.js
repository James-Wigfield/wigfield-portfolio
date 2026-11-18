/* navigator.onLine as React state (the edit page disables Save without signal). */

import { useSyncExternalStore } from 'react';

function subscribe(cb) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

const online = () => navigator.onLine !== false;

export function useOnline() {
  return useSyncExternalStore(subscribe, online, () => true);
}
