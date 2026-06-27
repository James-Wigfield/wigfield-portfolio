import { useState, useRef } from 'react';
import { signIn } from './auth';

/* ============================================================================
   PORTAL GATE — mock password barrier
   ----------------------------------------------------------------------------
   Wraps the portal. Until `signIn` succeeds, children are NEVER rendered — so
   navigating directly to /portal shows only this gate. `onUnlock` lifts the
   authenticated flag to the parent (which persists via sessionStorage in auth.js).
   ========================================================================== */
export default function PortalGate({ onUnlock, theme }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | error
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'checking' || !password) return;

    setStatus('checking');
    const { error } = await signIn(password);

    if (error) {
      setStatus('error');
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    } else {
      setStatus('idle');
      onUnlock();
    }
  };

  return (
    <div className="hp portal-gate" data-portal-theme={theme}>
      <div className="portal-gate__overlay" />

      <form
        className={`portal-gate__box${shake ? ' portal-gate__box--shake' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="portal-gate__logo">
          <span className="pt-bracket">[</span>
          &nbsp;MANAGEMENT PORTAL&nbsp;
          <span className="pt-bracket">]</span>
        </div>
        <p className="portal-gate__label">RESTRICTED · ENTER ACCESS KEY</p>

        <input
          ref={inputRef}
          className={`portal-gate__input${status === 'error' ? ' portal-gate__input--error' : ''}`}
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Portal access key"
          aria-invalid={status === 'error'}
          placeholder="••••••••••"
          value={password}
          disabled={status === 'checking'}
          onChange={(e) => {
            setPassword(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
        />

        <button
          type="submit"
          className="hp-btn hp-btn--solid portal-gate__submit"
          disabled={status === 'checking' || !password}
        >
          {status === 'checking' ? 'VERIFYING…' : 'AUTHENTICATE'}
        </button>

        {status === 'error' && (
          <p className="portal-gate__error" role="alert">// ACCESS DENIED</p>
        )}
      </form>
    </div>
  );
}
