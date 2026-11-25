/* "Collection": which group a spot or a whole place goes in (CONTRACTS.md 7). One native select
   (the phone's own picker: big targets, no custom popover) with the collections, "None" and
   "New collection…"; a new one is named inline and made with `onCreate(name)` → the collection
   (capture queues it in the outbox so it works offline; the edit page makes it on the server).

   Used by capture (a spot and a whole place), the edit page and the place page. Controlled:
   `value` is a collection id or null (none). */

import { useId, useState } from 'react';
import { COPY } from '../copy.js';
import { NONE } from '../lib/collections.js';

const NEW = '__new';

export default function CollectionPicker({ value, collections, onChange, onCreate, disabled = false, hint = null, label = COPY.collections.label, noneLabel = COPY.collections.none }) {
  const c = COPY.collections;
  const id = useId();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // a value that isn't in the list yet (made a moment ago, still loading) still shows as itself
  const known = value && !collections.some((x) => x.id === value) ? [{ id: value, name: c.unknown }] : [];

  const pick = (v) => {
    if (v === NEW) {
      setNaming(true);
      setError(null);
      return;
    }
    setNaming(false);
    onChange(v === NONE ? null : v);
  };

  const create = async () => {
    const n = name.trim();
    if (!n) {
      setError(c.nameNeeded);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const made = await onCreate(n);
      setNaming(false);
      setName('');
      if (made?.id) onChange(made.id, made);
    } catch (err) {
      setError(err?.status === 0 ? c.offline : c.createFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mr-field mr-collpick" data-mr="collection-picker">
      <label className="mr-label" htmlFor={`${id}-sel`}>
        {label}
      </label>
      <select
        id={`${id}-sel`}
        className="mr-input mr-select"
        value={naming ? NEW : value || NONE}
        disabled={disabled || busy}
        onChange={(e) => pick(e.target.value)}
        data-mr="collection-select"
      >
        {[...collections, ...known].map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
        <option value={NONE}>{noneLabel}</option>
        <option value={NEW}>{c.newOption}</option>
      </select>
      {naming && (
        <div className="mr-collpick-new">
          <input
            className="mr-input"
            type="text"
            value={name}
            maxLength={60}
            placeholder={c.newPlaceholder}
            autoComplete="off"
            enterKeyHint="done"
            aria-label={c.newLabel}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setNaming(false);
              }
            }}
            data-mr="collection-new-name"
            autoFocus
          />
          <button type="button" className="mr-btn" onClick={create} disabled={busy} data-mr="collection-new-add">
            {busy ? c.adding : c.add}
          </button>
          <button type="button" className="mr-linkbtn" onClick={() => setNaming(false)}>
            {c.cancel}
          </button>
        </div>
      )}
      {error && (
        <p className="mr-field-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="mr-field-hint">{hint}</p>}
    </div>
  );
}
