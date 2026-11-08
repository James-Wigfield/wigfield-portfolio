import { useSyncExternalStore } from 'react';
import { getOutboxSnapshot, subscribeOutbox } from './outbox.js';

/** Live outbox state: { entries, pending, running, current, online, blocked, failing, completed, volatile }. */
export function useOutbox() {
  return useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getOutboxSnapshot);
}
