import { useRef } from 'react';
import { usePortalRoute } from '../../portalRoute';
import { TABS } from './content';
import { Found, Layout, Launch, Mouse, Terminal, Order } from './tabs';
import './dev-setup.css';

/* ============================================================================
   DEV SETUP · HOME PC  (Personal section)
   ----------------------------------------------------------------------------
   A short plan for the home dev workflow: screen layout, a one-key "start dev"
   launch, MX Master 4 mappings, Windows Terminal looks, and a setup checklist.
   Built from a read-only look at the PC on 2026-11-10. It changes nothing on
   the machine; the script it shows (start-dev.ps1) is for James to save.

   Map:  content.js (every word + number) · tabs.jsx (one component per tab)
         diagrams.jsx (monitors, mouse, terminal preview) · start-dev.ps1
   Deep link: /portal/dev-setup/<tab>
   ========================================================================== */

const VIEWS = { now: Found, layout: Layout, launch: Launch, mouse: Mouse, terminal: Terminal, order: Order };

export default function DevSetup() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const tab = VIEWS[head] ? head : 'now';
  const View = VIEWS[tab];
  const tabsRef = useRef(null);

  const go = (id) => {
    setSub(id === 'now' ? '' : id);
    if (tabsRef.current && tabsRef.current.getBoundingClientRect().top < 0) {
      tabsRef.current.scrollIntoView({ block: 'start' });
    }
  };

  const onKey = (ev) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (ev.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    if (ev.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    if (!next) return;
    ev.preventDefault();
    go(next.id);
    requestAnimationFrame(() => document.getElementById(`dws-tab-${next.id}`)?.focus());
  };

  return (
    <div className="pt-module dws">
      <header className="dws-hero">
        <span className="dws-micro">Personal · plan · home PC · checked 10 Nov 2026</span>
        <h1 className="dws-hero__title">Dev setup</h1>
        <p className="dws-hero__lede">
          Fit six or more Claude Code sessions on screen, shrink VS Code, give Chrome a permanent place, and open it
          all with one button.
        </p>
      </header>

      <nav className="dws-tabs" ref={tabsRef} role="tablist" aria-label="Plan sections" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`dws-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="dws-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="dws-tabs__tab"
            onClick={() => go(t.id)}
          >
            <span className="dws-tabs__n">{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div id="dws-panel" key={tab} role="tabpanel" aria-labelledby={`dws-tab-${tab}`} className="dws-panel">
        <View />
      </div>
    </div>
  );
}
