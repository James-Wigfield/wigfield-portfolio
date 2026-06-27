import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './portal.css';
import { getSession, signOut } from './auth';
import PortalGate from './PortalGate';
import Icon from './icons';
import { MODULES, SECTIONS } from './registry';
import { THEMES, THEME_KEY, DEFAULT_THEME, resolveTheme } from './themes';

// Split the flat registry against the fixed SECTIONS order. Ungrouped non-system
// tools sit at the top; `system: true` tools live in a utility cluster at the
// bottom; everything else is bucketed into its named section (which always
// renders, even when empty, so the structure stays visible + future-proof).
function buildNav(modules, sections) {
  const top = modules.filter((m) => !m.group && !m.system);
  const system = modules.filter((m) => m.system);
  const grouped = sections.map((s) => ({
    ...s,
    items: modules.filter((m) => m.group === s.name && !m.system),
  }));
  return { top, system, sections: grouped };
}

const NAV = buildNav(MODULES, SECTIONS);

const COLLAPSE_KEY = 'portal:collapsedSections';

// Read the persisted set of collapsed section names (sections default to open).
function loadCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

// Read the persisted theme id (validated against THEMES).
function loadTheme() {
  try {
    return resolveTheme(localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

/* ============================================================================
   PORTAL — modular admin shell
   ----------------------------------------------------------------------------
   • Auth: until `getSession()` returns a session, ONLY <PortalGate> renders.
   • Layout: a thin computer.gif banner spans the top; below it a fixed sidebar
     of COLLAPSIBLE life-area sections (generated from the registry) + a content
     area that mounts the active module. Adding a tool is a one-line registry
     edit (see registry.js) — this shell never changes.
   • Symbols: every icon is a single-colour SVG from ./icons (no emoji).
   • Theme: matches the home page "Reading Room" system — the root is wrapped in
     `.hp` so portal.css inherits the same tokens/type, and buttons reuse `.hp-btn`.
   ========================================================================== */
export default function Portal() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => getSession() !== null);
  const [activeId, setActiveId] = useState(MODULES[0]?.id);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [theme, setTheme] = useState(loadTheme);

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

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed])); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Gate: block all content until authenticated (themed to match).
  if (!authed) return <PortalGate theme={theme} onUnlock={() => setAuthed(true)} />;

  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const active = MODULES.find((m) => m.id === activeId) ?? MODULES[0];
  const ActiveModule = active.component;
  const { top, system, sections } = NAV;

  const handleSignOut = () => {
    signOut();
    setAuthed(false);
  };

  const toggleSection = (name) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // One nav button — shared by the top tabs, sections and the system cluster.
  const navItem = (m) => (
    <button
      key={m.id}
      className={`portal__nav-item${m.id === active.id ? ' portal__nav-item--active' : ''}`}
      onClick={() => setActiveId(m.id)}
      aria-current={m.id === active.id ? 'page' : undefined}
    >
      <span className="portal__nav-icon"><Icon name={m.icon} size={17} /></span>
      <span className="portal__nav-label">{m.label}</span>
    </button>
  );

  return (
    <div className="hp portal" data-portal-theme={theme}>
      {/* ── Banner: a thin slice of the active theme's gif ─────────────── */}
      <header className="portal__banner">
        <div
          className="portal__banner-media"
          style={{ backgroundImage: `url(${activeTheme.gif})` }}
          aria-hidden="true"
        />
        <div className="portal__banner-scrim" aria-hidden="true" />
        <div className="portal__banner-inner">
          <div className="portal__banner-brand">
            <div className="portal__brand">
              <span className="portal__brand-bracket">[</span>
              <span className="portal__brand-name">WIGZY</span>{' '}
              <span className="portal__brand-text">PORTAL</span>
              <span className="portal__brand-bracket">]</span>
            </div>
            <p className="portal__sys-label">// PRIVATE WORKSPACE v1.0</p>
          </div>

          <div className="portal__themes" role="group" aria-label="Theme">
            <span className="portal__themes-label">THEME</span>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`portal__theme${t.id === theme ? ' portal__theme--active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${t.swatch.bg} 0 50%, ${t.swatch.accent} 50% 100%)` }}
                onClick={() => setTheme(t.id)}
                aria-pressed={t.id === theme}
                aria-label={`${t.label} theme`}
                title={`${t.label} theme`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="portal__body">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="portal__sidebar">
          <nav className="portal__nav" aria-label="Portal tools">
            {top.map(navItem)}

            {sections.map((s) => {
              const isOpen = !collapsed.has(s.name);
              return (
                <div className="portal__nav-group" key={s.name}>
                  <button
                    className="portal__nav-group-head"
                    aria-expanded={isOpen}
                    onClick={() => toggleSection(s.name)}
                  >
                    <span className="portal__nav-group-icon"><Icon name={s.icon} size={15} /></span>
                    <span className="portal__nav-group-label">{s.name}</span>
                    {s.items.length > 0 && (
                      <span className="portal__nav-group-count">{s.items.length}</span>
                    )}
                    <span className={`portal__nav-group-caret${isOpen ? ' portal__nav-group-caret--open' : ''}`}>
                      <Icon name="chevron" size={13} />
                    </span>
                  </button>
                  <div className={`portal__nav-group-body${isOpen ? ' portal__nav-group-body--open' : ''}`}>
                    <div className="portal__nav-group-inner">
                      {s.items.length > 0
                        ? s.items.map(navItem)
                        : <p className="portal__nav-empty">No tools yet</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {system.length > 0 && (
            <div className="portal__nav-system">
              <p className="portal__nav-system-label">System</p>
              {system.map(navItem)}
            </div>
          )}

          <div className="portal__sidebar-foot">
            <button className="portal__exit" onClick={() => navigate('/')}>
              <Icon name="arrowLeft" size={13} /> Back to site
            </button>
            <button className="portal__signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Content ───────────────────────────────────────────────── */}
        <main className="portal__main">
          <header className="portal__topbar">
            <div>
              <p className="portal__topbar-eyebrow">
                <span className="portal__status-dot" aria-hidden="true" />
                SESSION ACTIVE
              </p>
              <h1 className="portal__topbar-title">
                <span className="portal__topbar-icon" aria-hidden="true"><Icon name={active.icon} size={24} /></span>
                {active.label}
              </h1>
            </div>
          </header>

          <div className="portal__content" key={active.id}>
            <ActiveModule onNavigate={setActiveId} />
          </div>
        </main>
      </div>
    </div>
  );
}
