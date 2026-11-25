/* The password gate: one field, dark, quiet. The password is checked with /ping (a wrong
   one is a 404, like every other route) and kept as the bearer token (lib/api.js). */

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
      const s = err?.status;
      setError(s === 404 || s === 401 ? COPY.gate.wrong : s === 503 ? COPY.gate.closed : s === 0 ? COPY.gate.offline : COPY.gate.error);
    }
  }

  return (
    <main className="dr-gate" data-dr="gate">
      <form className="dr-gate-form" onSubmit={submit} noValidate>
        <p className="dr-label">{COPY.gate.label}</p>
        <label className="dr-gate-field">
          <span className="dr-sr">{COPY.gate.password}</span>
          <input
            className="dr-gate-input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={COPY.gate.password}
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error || expired ? 'dr-gate-note' : undefined}
            data-dr="gate-password"
          />
        </label>
        <button type="submit" className="dr-btn" disabled={busy || !password} data-dr="gate-submit">
          {busy ? COPY.gate.checking : COPY.gate.submit}
        </button>
        {(error || expired) && (
          <p className="dr-dot dr-gate-note" data-status={error ? 'failed' : 'captured'} id="dr-gate-note" role="status" data-dr="gate-note">
            <i aria-hidden="true" />
            {error || COPY.gate.expired}
          </p>
        )}
      </form>
    </main>
  );
}
