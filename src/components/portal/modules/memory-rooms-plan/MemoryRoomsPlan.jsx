import { useRef } from 'react';
import { usePortalRoute } from '../../portalRoute';
import PromptBlock from './PromptBlock';
import { TABS } from './content';
import { Verdict, Capture, Framework, RenderLoop, House, Roadmap } from './tabs';
import BUILD_PROMPT_RAW from './build-prompt.md?raw';
import './memory-rooms-plan.css';

/* ============================================================================
   MEMORY ROOMS · PLAN  (Personal section)
   ----------------------------------------------------------------------------
   The plan for a "trip memories → 3D renders on a map" tool, built later on its
   own route (/memories) by a fresh Claude Code instance from the build prompt
   at the top of this page (build-prompt.md, the source of truth for the
   decisions). This page is the visual check of that plan: six short tabs, one
   diagram each. It doesn't build the tool.

   Map:  build-prompt.md (the prompt) · content.js (every other word)
         tabs.jsx (one component per tab) · art.jsx (lane pictures)
         DioramaPreview.jsx (live three.js render of sampleScene.js)
   Deep link: /portal/memory-rooms-plan/<tab>
   ========================================================================== */

// a Windows checkout (core.autocrlf) gives CRLF; copy clean LF text
const BUILD_PROMPT = BUILD_PROMPT_RAW.replace(/\r\n/g, '\n');

const VIEWS = {
  verdict: Verdict,
  capture: Capture,
  framework: Framework,
  render: RenderLoop,
  house: House,
  roadmap: Roadmap,
};

export default function MemoryRoomsPlan() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const tab = VIEWS[head] ? head : 'verdict';
  const View = VIEWS[tab];
  const tabsRef = useRef(null);

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
    requestAnimationFrame(() => document.getElementById(`mrp-tab-${next.id}`)?.focus());
  };

  return (
    <div className="pt-module mrp">
      <PromptBlock prompt={BUILD_PROMPT} />

      <header className="mrp-hero">
        <span className="mrp-micro">Personal · plan · not built yet</span>
        <h1 className="mrp-hero__title">Memory Rooms</h1>
        <p className="mrp-hero__lede">
          Photograph a place that matters on the trip, and after the trip Claude rebuilds it as a small 3D room
          you can open from a map of the USA and Canada.
        </p>
      </header>

      <nav className="mrp-tabs" ref={tabsRef} role="tablist" aria-label="Plan sections" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`mrp-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="mrp-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="mrp-tabs__tab"
            onClick={() => go(t.id)}
          >
            <span className="mrp-tabs__n">{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div id="mrp-panel" role="tabpanel" aria-labelledby={`mrp-tab-${tab}`} className="mrp-panel">
        <View />
      </div>
    </div>
  );
}
