/* A collection's header turned into a small form (the list's "Edit", and "New collection"):
   rename it, or delete it (its spots and places stay, ungrouped: asked once, inline). Needs
   signal: it talks to the server straight away (capture's "New collection…" is the one that
   works offline, through the outbox). onDone(changed) — changed = { kind, collection } or null. */

import { useState } from 'react';
import { COPY } from '../copy.js';
import { api } from '../lib/api.js';
import { createCollectionNow } from '../lib/collections.js';

export default function CollectionEdit({ collection = null, count = 0, onDone }) {
  const c = COPY.collections;
  const [name, setName] = useState(collection?.name || '');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(null);

  const fail = (err) => {
    setError(err?.status === 0 ? c.offline : err?.code === 'needs-sql' ? c.needsSql : c.saveFailed);
    setBusy(false);
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return setError(c.nameNeeded);
    if (collection && n === collection.name) return onDone(null);
    setBusy(true);
    setError(null);
    try {
      const saved = collection ? await api.patchCollection(collection.id, { name: n, ifUpdatedAt: collection.updatedAt }) : await createCollectionNow(n);
      onDone({ kind: collection ? 'renamed' : 'created', collection: saved });
    } catch (err) {
      if (err?.status === 409) {
        setError(c.conflict);
        setBusy(false);
        return;
      }
      fail(err);
    }
  };

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    setError(null);
    try {
      await api.deleteCollection(collection.id);
      onDone({ kind: 'deleted', collection });
    } catch (err) {
      fail(err);
    }
  };

  return (
    <form
      className="mr-coll-form"
      data-mr="collection-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        className="mr-input"
        type="text"
        value={name}
        maxLength={60}
        placeholder={c.newPlaceholder}
        aria-label={collection ? c.renameLabel : c.newLabel}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone(null)}
        disabled={busy}
        autoFocus
        data-mr="collection-name-input"
      />
      <div className="mr-coll-form-row">
        <button type="submit" className="mr-btn" disabled={busy} data-mr="collection-save">
          {busy ? c.saving : collection ? c.save : c.add}
        </button>
        <button type="button" className="mr-linkbtn" onClick={() => onDone(null)} disabled={busy}>
          {c.cancel}
        </button>
        {collection && (
          <button type="button" className="mr-linkbtn mr-coll-delete" onClick={remove} disabled={busy} data-mr="collection-delete">
            {confirm ? c.deleteConfirm(count) : c.delete}
          </button>
        )}
      </div>
      {error && (
        <p className="mr-field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
