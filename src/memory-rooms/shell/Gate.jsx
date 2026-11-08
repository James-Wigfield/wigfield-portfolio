/* Password gate, once per device: the password is checked with /ping and kept
   as the bearer token (lib/api.js). */

import { useState } from 'react';
import { COPY } from '../copy.js';
import { api, setToken } from '../lib/api.js';

export default function Gate({ onEnter, expired = false }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.ping(password);
      setToken(password);
      onEnter();
    } catch (err) {
      setBusy(false);
      setError(err?.status === 401 ? COPY.gate.wrong : err?.status === 0 ? COPY.gate.offline : COPY.gate.error);
    }
  }

  return (
    <main className="mr-gate">
      <form className="mr-gate-form" onSubmit={submit} noValidate>
        <p className="mr-label">{COPY.gate.eyebrow}</p>
        <h1 className="mr-gate-title">{COPY.gate.title}</h1>
        {expired && <p className="mr-gate-note">{COPY.gate.expired}</p>}
        <label className="mr-field">
          <span className="mr-label">{COPY.gate.passwordLabel}</span>
          <input
            className="mr-input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'mr-gate-error' : undefined}
            data-mr="gate-password"
          />
        </label>
        {error && (
          <p className="mr-msg" data-tone="danger" id="mr-gate-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="mr-btn mr-btn--primary mr-btn--block" disabled={busy || !password} data-mr="gate-submit">
          {busy ? COPY.gate.checking : COPY.gate.submit}
        </button>
        <p className="mr-gate-note">{COPY.gate.note}</p>
      </form>
    </main>
  );
}
