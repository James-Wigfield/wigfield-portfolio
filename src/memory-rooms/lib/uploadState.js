/* One reading of the outbox, so the line under the header and the Saved screen
   always say the same thing. key: done | error | blocked | sending | uploading |
   waiting (no signal / server unreachable) | queued. */

export function uploadState(box, id) {
  if (id) {
    const entry = box.entries.find((e) => e.id === id);
    if (!entry || entry.state === 'done') return { key: 'done' };
    if (entry.state === 'error') return { key: 'error', error: entry.error };
  }
  if (box.blocked) return { key: 'blocked' };
  if (box.current && (!id || box.current.id === id)) {
    return box.current.index === 0 ? { key: 'sending' } : { key: 'uploading', index: box.current.index, total: box.current.total };
  }
  if (!box.online || box.failing) return { key: 'waiting' };
  return { key: 'queued' };
}

/** Dot tone for a state (shape/ink only; accent while something is moving, red for errors). */
export const toneOf = (key) => ({ done: 'ok', error: 'danger', sending: 'busy', uploading: 'busy' })[key] || 'idle';
