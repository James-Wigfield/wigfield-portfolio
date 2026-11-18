import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { defaults } from './params.js';
import { DEFAULT_PRESET, PRESET_BY_ID } from './presets.js';
import Visualiser from './ui/Visualiser';
import './projector-life.css';

// The registry imports this shell eagerly; the reading tabs load on demand.
const PlanTab = lazy(() => import('./ui/PlanTab'));
const ApplicationsTab = lazy(() => import('./ui/ApplicationsTab'));

/* ============================================================================
   PROJECTOR LIFE — shell: top tabs (Visualiser · Plan · Applications)
   ----------------------------------------------------------------------------
   The Visualiser is the default and always the tab the page opens on (the
   brief: "the first thing I see is the render"), so the tab is NOT remembered
   across visits. The scene (values, camera view, active preset) is held here
   so it survives a trip to the Plan tab: the Stage is disposed when its tab
   unmounts and rebuilt from this state when you come back.
   The engine is a dynamic import inside ui/Visualiser.jsx.
   ========================================================================== */

const TABS = [
  { id: 'vis', label: 'Visualiser' },
  { id: 'plan', label: 'Plan' },
  { id: 'apps', label: 'Applications' },
];

const initialScene = () => ({
  values: { ...defaults(), ...DEFAULT_PRESET.values },
  view: DEFAULT_PRESET.camera || 'cutaway',
  presetId: DEFAULT_PRESET.id,
  edited: false,
});

export default function ProjectorLife() {
  const [tab, setTab] = useState('vis');
  const [scene, setScene] = useState(initialScene);
  const tabRefs = useRef({});
  const rootRef = useRef(null);

  // "The first thing I see is the render": the portal's banner and page header
  // sit above every module, so on opening, glide the page until the tab bar
  // meets the sticky page header — the stage then fills the rest of the
  // viewport (its height is 100vh minus header + tabs). Only from near the top
  // of the page (never fights a reader who has scrolled), once per visit.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const head = document.querySelector('.portal__topbar');
    const headH = head ? head.getBoundingClientRect().height : 0;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY - headH - 6);
    if (top <= 0 || window.scrollY > top) return undefined;
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* no matchMedia: animate */
    }
    const id = requestAnimationFrame(() => window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, []);

  const onKey = useCallback(
    (e) => {
      const i = TABS.findIndex((t) => t.id === tab);
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = TABS.length - 1;
      if (j == null) return;
      e.preventDefault();
      setTab(TABS[j].id);
      tabRefs.current[TABS[j].id]?.focus();
    },
    [tab],
  );

  const preset = PRESET_BY_ID[scene.presetId];

  return (
    <div className="pt-module pjl" ref={rootRef}>
      <div className="pjl-tabs">
        <div className="pjl-tabs__list" role="tablist" aria-label="Projector Life" onKeyDown={onKey}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`pjl-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`pjl-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`pjl-tabs__tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="pjl-tabs__n">{String(i + 1).padStart(2, '0')}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="pjl-tabs__status">
          <span className={`pjl-dot ${scene.edited ? 'pjl-dot--hollow' : 'pjl-dot--live'}`} />
          <span className="pjl-tabs__statusk">on stage</span>
          <span className="pjl-tabs__statusv">
            {preset?.name || 'Custom scene'}
            {scene.edited ? ' · edited' : ''}
          </span>
        </div>
      </div>

      <div role="tabpanel" id={`pjl-panel-${tab}`} aria-labelledby={`pjl-tab-${tab}`} className="pjl-tabpanel">
        {tab === 'vis' && <Visualiser scene={scene} setScene={setScene} />}
        <Suspense fallback={<div className="pjl-wait">loading…</div>}>
          {tab === 'plan' && <PlanTab />}
          {tab === 'apps' && <ApplicationsTab />}
        </Suspense>
      </div>
    </div>
  );
}
