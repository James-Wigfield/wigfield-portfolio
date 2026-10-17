import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortalRoute } from '../../portalRoute';
import { TABS } from './content';
import { buildSchedule } from './schedule';
import { installDevHandle } from './sceneKit';
import { TimerEngine, MiniBar } from './FollowAlong';
import Overview from './tabs/Overview';
import Why from './tabs/Why';
import Kit from './tabs/Kit';
import Routine from './tabs/Routine';
import DeepClean from './tabs/DeepClean';
import FixIt from './tabs/FixIt';
import Log from './tabs/Log';
import './barista.css';
import './scenes.css';
import './player.css';
import './tabs.css';

/* ============================================================================
   BARISTA · MACHINE CARE  (Personal section)
   ----------------------------------------------------------------------------
   A care guide for James's Breville Barista Express Impress (BES876, ANZ):
   the six-monthly deep clean as an optimised, animated, follow-along step
   player, and the weekly routine as a resettable checklist. Every procedure
   cites Breville's instruction book.

   The shell owns: the sticky numbered tab bar (visited marks), the URL
   sub-route (/portal/barista-guide/<tab>/<rest>), the timer engine and the
   bottom dock (background timers + the step player's thumb bar).

   Map:  content.js (copy) · schedule.js (task graph) · careLog.js (storage)
         Machine.jsx + scenes/ (motion) · FollowAlong.jsx (timers) · tabs/
   ========================================================================== */

const VIEWS = {
  overview: Overview,
  why: Why,
  kit: Kit,
  routine: Routine,
  'deep-clean': DeepClean,
  'fix-it': FixIt,
  log: Log,
};

export default function BaristaGuide() {
  const { sub, setSub } = usePortalRoute();
  const [head, ...restParts] = sub.split('/').filter(Boolean);
  const tab = VIEWS[head] ? head : 'overview';
  const rest = restParts.join('/');
  const [seen, setSeen] = useState(() => new Set([tab]));
  const [dock, setDock] = useState(null);
  const rootRef = useRef(null);
  const schedule = useMemo(() => buildSchedule(), []);

  useEffect(() => {
    installDevHandle();
    // On a phone the portal's sidebar stacks above the content — bring the
    // guide itself into view so a bookmarked deep link lands on the step.
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      rootRef.current?.scrollIntoView({ block: 'start' });
    }
  }, []);

  const nav = useMemo(() => {
    const go = (id, extra = '') => {
      setSeen((s) => new Set([...s, tab, id]));
      setSub(extra ? `${id}/${extra}` : id);
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) rootRef.current?.scrollIntoView({ block: 'start' });
    };
    const stepIndex = (stepId) => schedule.steps.findIndex((s) => s.id === stepId);
    return {
      go,
      rest,
      setRest: (r, opts) => setSub(r ? `${tab}/${r}` : tab, opts),
      toStep: (stepId) => {
        const i = stepIndex(stepId);
        go('deep-clean', i >= 0 ? String(i + 1) : '');
      },
      to: (target) => {
        if (!target) return;
        if (target.step) {
          const i = stepIndex(target.step);
          go('deep-clean', i >= 0 ? String(i + 1) : '');
        } else if (target.tab) go(target.tab, target.rest || '');
      },
      stepIndex,
    };
  }, [rest, setSub, tab, schedule]);

  const View = VIEWS[tab];
  const seenAll = seen.has(tab) ? seen : new Set([...seen, tab]);

  return (
    <div className="pt-module bxi" ref={rootRef}>
      <TimerEngine />
      <nav className="bxi-tabbar" aria-label="Machine care sections">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`bxi-tab${t.id === tab ? ' bxi-tab--on' : ''}${seenAll.has(t.id) ? ' bxi-tab--seen' : ''}`}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => nav.go(t.id)}
          >
            <span className="bxi-tab__no">{String(i + 1).padStart(2, '0')}</span>
            <span className="bxi-tab__label">{t.label}</span>
            <span className="bxi-tab__seen" aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="bxi-panel" key={tab}>
        <View nav={nav} schedule={schedule} dock={dock} />
      </div>

      <div className="bxi-dock">
        <MiniBar onJump={(stepId) => stepId && nav.toStep(stepId)} />
        <div ref={setDock} className="bxi-dock__slot" />
      </div>
    </div>
  );
}
