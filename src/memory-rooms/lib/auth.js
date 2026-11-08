/* A 401 anywhere means the password changed: the shell listens for this and
   shows the gate again. Nothing else (outbox, drafts) is touched. */

const EVENT = 'mr:unauthorized';

export function signalUnauthorized() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onUnauthorized(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Call from a catch: routes 401s to the gate, returns true if it did. */
export function handleAuthError(err) {
  if (err?.status === 401) {
    signalUnauthorized();
    return true;
  }
  return false;
}
