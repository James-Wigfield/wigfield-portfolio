import { useEffect, useRef } from 'react';
import { usePortalRoute } from '../../portalRoute';
import PromptBlock from './PromptBlock';
import { TABS, PITCH } from './content';
import { Verdict, Capture, Scene, Pipeline, Experience, Privacy, Roadmap } from './tabs';
import BUILD_PROMPT_RAW from './build-prompt.md?raw';
import './dream-rooms-plan.css';

/* ============================================================================
   DREAM ROOMS · PLAN  (Personal section)
   ----------------------------------------------------------------------------
   The plan for "a dream, typed at 6 am → a walkable, liminal 3D dream on the
   site", built later on its own route (/dreams) by a fresh Claude Code session
   from the build prompt at the top of this page (build-prompt.md, the source
   of truth). This page is the visual check of that plan: seven short tabs,
   one picture each. It doesn't build the tool.

   Map:  build-prompt.md (the prompt) · content.js (every other word)
         tabs.jsx (one component per tab) · art.jsx (SVG pictures)
         LiminalSketch.jsx + dreamPass.js (live three.js sketch of the look,
         loading corridor.glb baked by headless Blender on this PC)
   Evidence scripts: tools/dream-rooms-plan/ (corridor.py, bench, page-check)
   Deep link: /portal/dream-rooms-plan/<tab>
   ========================================================================== */

// a Windows checkout (core.autocrlf) gives CRLF; copy clean LF text
const BUILD_PROMPT = BUILD_PROMPT_RAW.replace(/\r\n/g, '\n');

const VIEWS = {
  verdict: Verdict,
  capture: Capture,
  scene: Scene,
  pipeline: Pipeline,
  experience: Experience,
  privacy: Privacy,
  roadmap: Roadmap,
};

export default function DreamRoomsPlan() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const tab = VIEWS[head] ? head : 'verdict';
  const View = VIEWS[tab];
  const tabsRef = useRef(null);

  // on a phone the tab strip scrolls: keep the active tab in the middle of it
  useEffect(() => {
    const nav = tabsRef.current;
    const btn = document.getElementById(`drp-tab-${tab}`);
    if (!nav || !btn || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = btn.offsetLeft - nav.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
  }, [tab]);

  const go = (id) => {
    setSub(id === 'verdict' ? '' : id);
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
    requestAnimationFrame(() => document.getElementById(`drp-tab-${next.id}`)?.focus());
  };

  return (
    <div className="pt-module drp">
      <PromptBlock prompt={BUILD_PROMPT} />

      <header className="drp-hero">
        <div className="drp-hero__haze" aria-hidden="true" />
        <span className="drp-micro">Personal · plan · not built yet</span>
        <h1 className="drp-hero__title">Dream Rooms</h1>
        <p className="drp-hero__lede">{PITCH}</p>
      </header>

      <nav className="drp-tabs" ref={tabsRef} role="tablist" aria-label="Plan sections" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`drp-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="drp-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="drp-tabs__tab"
            onClick={() => go(t.id)}
          >
            <span className="drp-tabs__n">{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div id="drp-panel" role="tabpanel" aria-labelledby={`drp-tab-${tab}`} className="drp-panel">
        <View />
      </div>
    </div>
  );
}
