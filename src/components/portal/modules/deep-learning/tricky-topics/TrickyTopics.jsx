import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePortalRoute } from '../../../portalRoute';
import { TOPICS } from './topics';
import { loadPage, savePage, topicStore } from './storage';
import TopicShell from './TopicShell';
import '../common.css';
import './tricky-topics.css';
import './stage.css';
import './sheet.css';

/* ============================================================================
   CITS5017 · TRICKY TOPICS — THE PAGE
   ----------------------------------------------------------------------------
   One page for the concepts that cut across lectures, one tab per topic,
   built to grow:

     hero         "Tricky Topics", one line, the topic count
     tabs         a sticky topic bar under the portal topbar: each tab shows
                  the title, the lectures it draws on (quiet outlined labels)
                  and a small progress mark (from dltt:<id>:summary, so the
                  tabs never load a topic just to show its progress). When
                  the page is narrow it becomes a select.
     deep links   /portal/dl-tricky-topics/<topicId>[/<stepId>] through
                  usePortalRoute(); no sub-route → the last topic visited
                  (dltt:last), or the first
     loading      topics/index.js lists { id, title, lectures, blurb, load };
                  `load` is a lazy import() of the topic's folder, cached
     focus mode   the Fullscreen API on this page's root (so the tabs stay
                  reachable); falls back to a fixed overlay. The topic shell
                  registers how to land back on the step you were reading.

   Inside a topic: ./TopicShell.jsx. Nothing here names a topic: everything
   reads ./topics/index.js (see ./ADDING-A-TOPIC.md).
   ========================================================================== */

const cache = new Map();
const WIDE_AT = 920;
const TABS_AT = 680;

function summaryOf(id) {
  const s = topicStore(id).load('summary', null);
  return s && typeof s === 'object' && Number.isFinite(s.steps) ? s : null;
}

// A tab's small progress mark: a ring that fills with the steps marked
// "got it", a check when every step and every notebook page is done.
function ProgressMark({ s }) {
  if (!s) return <span className="dltt-tab__mark dltt-tab__mark--new" aria-label="not started">new</span>;
  const all = s.steps + s.pages;
  const got = s.done + s.copied;
  const frac = all ? got / all : 0;
  const r = 6.5;
  const c = 2 * Math.PI * r;
  return (
    <span className="dltt-tab__mark" aria-label={`${s.done} of ${s.steps} steps, ${s.copied} of ${s.pages} notebook pages`}>
      <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
        <circle cx="9" cy="9" r={r} className="dltt-ring__bg" />
        <circle cx="9" cy="9" r={r} className="dltt-ring__fg" style={{ strokeDasharray: `${frac * c} ${c}` }} transform="rotate(-90 9 9)" />
        {frac >= 1 && <path d="M5.6 9.3 L8 11.5 L12.4 6.8" className="dltt-ring__ok" />}
      </svg>
      <span className="dltt-tab__frac">{s.done}/{s.steps}</span>
    </span>
  );
}

function TopicTabs({ current, summaries, onPick, narrow }) {
  const refs = useRef({});
  const onKey = (e, i) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let j = null;
    if (d) j = (i + d + TOPICS.length) % TOPICS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TOPICS.length - 1;
    if (j === null) return;
    e.preventDefault();
    onPick(TOPICS[j].id);
    refs.current[TOPICS[j].id]?.focus();
  };
  if (narrow) {
    return (
      <label className="dltt-tabs__select">
        <span className="dltt-tabs__selk">Topic</span>
        <select value={current} onChange={(e) => onPick(e.target.value)} aria-label="Choose a topic">
          {TOPICS.map((t, i) => {
            const s = summaries[t.id];
            return (
              <option key={t.id} value={t.id}>
                {i + 1}. {t.title} · {t.lectures.join(' ')}{s ? ` · ${s.done}/${s.steps}` : ''}
              </option>
            );
          })}
        </select>
      </label>
    );
  }
  return (
    <div className="dltt-tabs__list" role="tablist" aria-label="Tricky topics">
      {TOPICS.map((t, i) => {
        const on = t.id === current;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`dltt-tab-${t.id}`}
            aria-selected={on}
            aria-controls="dltt-panel"
            tabIndex={on ? 0 : -1}
            className={`dltt-tab${on ? ' dltt-tab--on' : ''}`}
            onClick={() => onPick(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            title={t.blurb}
          >
            <span className="dltt-tab__no">{i + 1}</span>
            <span className="dltt-tab__body">
              <span className="dltt-tab__title">{t.title}</span>
              <span className="dltt-tab__lecs" aria-label={`draws on ${t.lectures.join(', ')}`}>
                {t.lectures.map((l) => <span key={l} className="dltt-lec">{l}</span>)}
              </span>
            </span>
            <ProgressMark s={summaries[t.id]} />
          </button>
        );
      })}
    </div>
  );
}

export default function TrickyTopics() {
  const { sub, setSub } = usePortalRoute();
  const [subTopic, subStep] = sub.split('/');
  const known = TOPICS.some((t) => t.id === subTopic);
  const [fallback] = useState(() => {
    const last = loadPage('last', null);
    return TOPICS.some((t) => t.id === last) ? last : TOPICS[0].id;
  });
  const topicId = known ? subTopic : fallback;
  const meta = TOPICS.find((t) => t.id === topicId);

  const rootRef = useRef(null);
  const tabsRef = useRef(null);
  const [mods, setMods] = useState(() => Object.fromEntries(cache));
  const [summaries, setSummaries] = useState(() => Object.fromEntries(TOPICS.map((t) => [t.id, summaryOf(t.id)])));
  const [width, setWidth] = useState(1200);
  const [stick, setStick] = useState(0);
  const [tabsH, setTabsH] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const pseudoFsRef = useRef(false);
  const focusRef = useRef(false);
  const restoreRef = useRef(null);
  const focus = isFs || pseudoFs;

  // ── deep links: a missing or unknown topic id becomes the remembered one ──
  useEffect(() => {
    if (!known) setSub(topicId, { replace: true });
  }, [known, topicId, setSub]);
  useEffect(() => { savePage('last', topicId); }, [topicId]);

  // ── lazy topic loading (cached for the session) ──────────────────────────
  const mod = mods[topicId];
  useEffect(() => {
    if (mod || !meta) return undefined;
    let live = true;
    meta.load()
      .then((m) => {
        cache.set(meta.id, m.default);
        if (live) setMods((prev) => ({ ...prev, [meta.id]: m.default }));
      })
      .catch(() => {
        if (live) setMods((prev) => ({ ...prev, [meta.id]: { failed: true } }));
      });
    return () => { live = false; };
  }, [mod, meta]);

  const pick = useCallback((id, step) => {
    setSub(step ? `${id}/${step}` : id);
  }, [setSub]);
  const onSummary = useCallback((id, s) => {
    setSummaries((prev) => (JSON.stringify(prev[id]) === JSON.stringify(s) ? prev : { ...prev, [id]: s }));
  }, []);

  // ── layout measurements ──────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const topbar = rootRef.current?.closest('.portal')?.querySelector('.portal__topbar');
    if (!topbar || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setStick(topbar.offsetHeight));
    ro.observe(topbar);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setTabsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── focus mode (on the whole page, so the tabs stay reachable) ───────────
  const afterSwap = useCallback(() => restoreRef.current?.(), []);
  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === rootRef.current;
      if (on && pseudoFsRef.current) {
        pseudoFsRef.current = false;
        document.documentElement.classList.remove('dltt-pseudo-on');
        setPseudoFs(false);
      }
      if (on) focusRef.current = true;
      else if (!pseudoFsRef.current) focusRef.current = false;
      setIsFs(on);
      afterSwap();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [afterSwap]);

  const setPseudo = useCallback((on) => {
    pseudoFsRef.current = on;
    focusRef.current = on;
    document.documentElement.classList.toggle('dltt-pseudo-on', on);
    setPseudoFs(on);
    afterSwap();
  }, [afterSwap]);

  const toggleFocus = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    restoreRef.current?.('capture');
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (pseudoFsRef.current) {
      setPseudo(false);
      return;
    }
    if (typeof el.requestFullscreen !== 'function') {
      setPseudo(true);
      return;
    }
    let settled = false;
    const fallbackT = setTimeout(() => {
      if (!settled && !document.fullscreenElement) setPseudo(true);
    }, 1000);
    el.requestFullscreen()
      .then(() => el.focus?.({ preventScroll: true }))
      .catch(() => { if (!pseudoFsRef.current) setPseudo(true); })
      .finally(() => { settled = true; clearTimeout(fallbackT); });
  }, [setPseudo]);

  // Leave focus mode (for printing); resolves to what to restore afterwards.
  const leaveFocus = useCallback(async () => {
    const wasFs = !!document.fullscreenElement;
    const wasPseudo = pseudoFsRef.current;
    if (wasFs) await document.exitFullscreen?.().catch(() => {});
    if (wasPseudo) setPseudo(false);
    return () => {
      if (!wasFs && !wasPseudo) return;
      const el = rootRef.current;
      if (wasFs && el?.requestFullscreen) el.requestFullscreen().catch(() => setPseudo(true));
      else setPseudo(true);
    };
  }, [setPseudo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && pseudoFsRef.current) setPseudo(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPseudo]);
  useEffect(() => () => document.documentElement.classList.remove('dltt-pseudo-on', 'dltt-printing'), []);

  const registerRestore = useCallback((fn) => { restoreRef.current = fn; }, []);
  const getRoot = useCallback(() => rootRef.current, []);
  const page = useMemo(() => ({
    focus,
    focusRef,
    toggleFocus,
    leaveFocus,
    registerRestore,
    root: getRoot,
    wide: width >= WIDE_AT,
  }), [focus, toggleFocus, leaveFocus, registerRestore, getRoot, width]);

  const narrowTabs = width < TABS_AT;
  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={`dl dltt${focus ? ' dltt--focus' : ''}${pseudoFs ? ' dltt--pseudo' : ''}`}
      style={{ '--dltt-stick-top': `${focus ? 0 : stick}px`, '--dltt-stick': `${(focus ? 0 : stick) + tabsH}px` }}
    >
      <header className="dltt-top">
        <p className="dltt-top__kicker">CITS5017 Deep Learning · across every lecture</p>
        <h1 className="dltt-top__title">Tricky Topics</h1>
        <p className="dltt-top__line">
          The concepts I find hard, one at a time, from every lecture.
          <span className="dltt-top__count"><b>{TOPICS.length}</b> topics</span>
        </p>
      </header>

      <nav ref={tabsRef} className={`dltt-tabs${narrowTabs ? ' dltt-tabs--narrow' : ''}`} aria-label="Topics">
        <TopicTabs current={topicId} summaries={summaries} onPick={pick} narrow={narrowTabs} />
      </nav>

      <div id="dltt-panel" role={narrowTabs ? 'region' : 'tabpanel'} aria-labelledby={narrowTabs ? undefined : `dltt-tab-${topicId}`} aria-label={narrowTabs ? meta?.title : undefined} className="dltt-panel">
        {!mod && <p className="dltt-loading" aria-live="polite">Loading {meta?.title}…</p>}
        {mod?.failed && <p className="dltt-loading">This topic couldn’t load. Reload the page to try again.</p>}
        {mod && !mod.failed && (
          <TopicShell
            key={topicId}
            meta={meta}
            mod={mod}
            page={page}
            initialStep={known ? subStep : undefined}
            onSummary={onSummary}
            goTopic={pick}
          />
        )}
      </div>
    </div>
  );
}
