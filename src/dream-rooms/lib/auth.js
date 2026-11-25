/* The password stopped working: the shell listens for this and shows the gate again.
   Nothing else (the outbox, the draft) is touched. */

import { api, getToken } from './api.js';

const EVENT = 'dr:unauthorized';

export function signalUnauthorized() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onUnauthorized(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export const isAuthStatus = (status) => status === 401 || status === 404;

/**
 * Call from a catch. A 401/404 while a token is set might mean the password changed (the API
 * answers 404 to a wrong one), or just a dream that isn't there: re-ping to tell them apart.
 * Resolves true when it sent the user to the gate.
 */
export async function confirmAuth(err) {
  if (!isAuthStatus(err?.status)) return false;
  if (!getToken()) {
    signalUnauthorized();
    return true;
  }
  try {
    await api.ping();
    return false;
  } catch (e) {
    if (isAuthStatus(e?.status)) {
      signalUnauthorized();
      return true;
    }
    return false;
  }
}
