import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { handleAuthError } from '../lib/auth.js';
import { newestFirst } from '../lib/spots.js';
import { useOutbox } from '../lib/useOutbox.js';

/** Loads the spot list; reloads quietly whenever the outbox finishes an upload. */
export function useSpots() {
  const [state, setState] = useState({ status: 'loading', spots: [], error: null });
  const { completed } = useOutbox();

  const load = useCallback(async () => {
    try {
      const spots = await api.listSpots();
      setState({ status: 'ok', spots: newestFirst(spots || []), error: null });
    } catch (err) {
      if (handleAuthError(err)) return;
      // Keep showing what we had if a background refresh fails.
      setState((s) => (s.status === 'ok' ? s : { status: 'error', spots: s.spots, error: err }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, completed]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    load();
  }, [load]);

  return { ...state, retry };
}
