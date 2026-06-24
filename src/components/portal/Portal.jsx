import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './portal.css';
import { getSession, signOut } from './auth';
import PortalGate from './PortalGate';
import { MODULES } from './registry';

/* ============================================================================
   PORTAL — modular admin shell
   ----------------------------------------------------------------------------
   • Auth: until `getSession()` returns a session, ONLY <PortalGate> renders, so
     a direct visit to /portal never exposes content.
   • Layout: a fixed sidebar of tabs generated from the module registry + a
     content area that mounts the active module's component. Adding a tool is a
     one-line registry edit (see registry.js) — this shell never changes.
   • Theme: matches the home page "Reading Room" system — the root is wrapped in
     `.hp` so portal.css inherits the same tokens/type, and buttons reuse `.hp-btn`.
   ========================================================================== */
export default function Portal() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => getSession() !== null);
  const [activeId, setActiveId] = useState(MODULES[0]?.id);

  useEffect(() => {
    document.title = 'Management Portal';
    // Reuse the home page's light scrollbar (home.css `html.hp-active`) so the
    // portal matches the Reading Room rather than the global cyberpunk scrollbar.
    document.documentElement.classList.add('hp-active');
    return () => {
      document.title = 'James Wigfield';
      document.documentElement.classList.remove('hp-active');
    };
  }, []);

  // Gate: block all content until authenticated.
  if (!authed) return <PortalGate onUnlock={() => setAuthed(true)} />;

  const active = MODULES.find((m) => m.id === activeId) ?? MODULES[0];
  const ActiveModule = active.component;

  const handleSignOut = () => {
    signOut();
    setAuthed(false);
  };

  return (
    <div className="hp portal">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="portal__sidebar">
        <div className="portal__brand">
          <span className="portal__brand-bracket">[</span>
          <span className="portal__brand-text">PORTAL</span>
          <span className="portal__brand-bracket">]</span>
        </div>
        <p className="portal__sys-label">// PRIVATE WORKSPACE v1.0</p>

        <nav className="portal__nav" aria-label="Portal tools">
          {MODULES.map((m) => (
            <button
              key={m.id}
              className={`portal__nav-item${m.id === active.id ? ' portal__nav-item--active' : ''}`}
              style={{ '--accent': `var(--${m.accent})` }}
              onClick={() => setActiveId(m.id)}
              aria-current={m.id === active.id ? 'page' : undefined}
            >
              <span className="portal__nav-icon">{m.icon}</span>
              <span className="portal__nav-label">{m.label}</span>
            </button>
          ))}
        </nav>

        <div className="portal__sidebar-foot">
          <button className="portal__exit" onClick={() => navigate('/')}>
            ← Back to site
          </button>
          <button className="portal__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="portal__main">
        <header className="portal__topbar">
          <div>
            <p className="portal__topbar-eyebrow">
              <span className="portal__status-dot" aria-hidden="true" />
              SESSION ACTIVE
            </p>
            <h1 className="portal__topbar-title">
              <span className="portal__topbar-icon" aria-hidden="true">{active.icon}</span>
              {active.label}
            </h1>
          </div>
        </header>

        <div className="portal__content" key={active.id}>
          <ActiveModule />
        </div>
      </main>
    </div>
  );
}
