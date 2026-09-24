import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../icons';
import { saveProgress } from '../../data/papersApi';
import PauseCard from './PauseCard';
import { usePlayer } from './usePlayer';
import {
  buildTimeline, itemDuration, minutesLeft, isStop,
  prevSentence, nextSentence, sectionOf, paragraphRange, headingTrail,
} from './timeline';
import {
  WPM_MIN, WPM_MAX, WPM_STEP, INTENSITY_OPTIONS, CARD_OPTIONS, FONT_OPTIONS,
  clampWpm, loadLocalProgress, saveLocalProgress, newerProgress,
} from './settings';

/* ============================================================================
   RSVP PAPERS — the reader
   ----------------------------------------------------------------------------
   Stage (one word at the focal point, or a card) · progress rule + mono
   counters · transport · paused context · Contents / Settings panels.

   All timing lives in usePlayer over the timeline built once per paper (see
   timeline.js). The Reader only decides WHAT the current item looks like and
   answers the keyboard:

     space          play / pause (continue from a card)
     ← / →          previous / next sentence      shift+← / →   section
     ↑ / ↓          speed ±25 wpm                 c / s         contents / settings
     enter          expand a card's detail         f             focus (full screen)
     esc            close panel · else pause

   Progress = the timeline index (+ pct, wpm, heading), saved to the server
   and mirrored locally: on pause, every 6 s while playing, and on unmount.
   ========================================================================== */

const fmt = (n) => Math.round(n ?? 0).toLocaleString();

// Where to resume: the fresher of server/local progress, if it still points
// inside this timeline (appends only add to the end, so old indices hold).
function resumeIndex(paper, tl) {
  const best = newerProgress(paper.progress, loadLocalProgress(paper.id));
  if (!best || best.finished) return 0;
  const i = Number(best.index) || 0;
  return i > 0 && i < tl.items.length - 1 ? i : 0;
}

export default function Reader({ paper, settings, onSettings, onBack, onReload }) {
  const tl = useMemo(() => buildTimeline(paper.sections || []), [paper.sections]);
  const items = tl.items;

  const durationFor = useCallback((item) => {
    if (item.t === 'm' && settings.autoAppendix) return 600;
    return itemDuration(item, settings);
  }, [settings]);

  const initial = useMemo(() => resumeIndex(paper, tl), [paper, tl]);
  const { index, playing, play, pause, toggle, seek } = usePlayer(items, durationFor, initial);

  const [panel, setPanel] = useState(null);       // null | 'contents' | 'settings'
  const [expanded, setExpanded] = useState(false); // card detail
  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef(null);

  const item = items[Math.min(index, items.length - 1)];
  const si = sectionOf(tl, index);
  const section = tl.sections[si];
  const trail = useMemo(() => headingTrail(tl.sections, si), [tl.sections, si]);
  const wordsRead = item?.n ?? 0;
  const pct = tl.totalWords ? (wordsRead / tl.totalWords) * 100 : 0;
  const mainPct = tl.totalWords && tl.hasAppendix ? (tl.mainWords / tl.totalWords) * 100 : null;
  const minsLeft = minutesLeft(tl, index, settings);
  const finished = item?.t === 'e';

  // ── actions ─────────────────────────────────────────────────────────────
  const bumpWpm = useCallback((d) => onSettings((s) => ({ ...s, wpm: clampWpm(s.wpm + d) })), [onSettings]);
  const gotoSection = useCallback((k) => {
    const s = tl.sections[Math.min(tl.sections.length - 1, Math.max(0, k))];
    if (!s) return;
    pause();
    seek(s.start);
    setExpanded(false);
  }, [tl.sections, pause, seek]);
  const jumpTo = useCallback((i) => { setExpanded(false); seek(i); }, [seek]);

  const toggleFs = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── progress persistence ────────────────────────────────────────────────
  const persist = useCallback((i, { keepalive = false, done = false } = {}) => {
    const it = items[Math.min(i, items.length - 1)];
    const n = it?.n ?? 0;
    const p = {
      index: i,
      total: items.length,
      pct: tl.totalWords ? Math.round((n / tl.totalWords) * 1000) / 10 : 0,
      wpm: settings.wpm,
      heading: tl.sections[sectionOf(tl, i)]?.heading || '',
      finished: done || it?.t === 'e',
      updatedAt: new Date().toISOString(),
    };
    saveLocalProgress(paper.id, p);
    saveProgress(paper.id, p, { keepalive });
  }, [items, tl, paper.id, settings.wpm]);

  // Latest values for listeners that must not re-bind every word.
  const latest = useRef({});
  useEffect(() => {
    latest.current = { index, si, panel, item, persist, toggle, seek, pause, play, gotoSection, bumpWpm, toggleFs, expanded };
  });

  useEffect(() => { if (!playing) latest.current.persist(latest.current.index); }, [playing]);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => latest.current.persist(latest.current.index), 6000);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => () => { latest.current.persist?.(latest.current.index, { keepalive: true }); }, []);

  // ── keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (e.metaKey || e.ctrlKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const L = latest.current;
      switch (e.key) {
        case ' ': e.preventDefault(); setExpanded(false); L.toggle(); break;
        case 'ArrowLeft': e.preventDefault(); if (e.shiftKey) L.gotoSection(L.si - 1); else { setExpanded(false); L.seek(prevSentence(items, L.index)); } break;
        case 'ArrowRight': e.preventDefault(); if (e.shiftKey) L.gotoSection(L.si + 1); else { setExpanded(false); L.seek(nextSentence(items, L.index)); } break;
        case 'ArrowUp': e.preventDefault(); L.bumpWpm(WPM_STEP); break;
        case 'ArrowDown': e.preventDefault(); L.bumpWpm(-WPM_STEP); break;
        case 'Enter': if (L.item?.t === 'c' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); setExpanded((x) => !x); } break;
        case 'c': case 'C': e.preventDefault(); setPanel((p) => (p === 'contents' ? null : 'contents')); break;
        case 's': case 'S': e.preventDefault(); setPanel((p) => (p === 'settings' ? null : 'settings')); break;
        case 'f': case 'F': e.preventDefault(); L.toggleFs(); break;
        case 'Escape': if (L.panel) setPanel(null); else L.pause(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items]);

  // Landing on a new card starts collapsed.
  const cardKey = item?.t === 'c' ? index : -1;
  const [lastCard, setLastCard] = useState(-1);
  if (cardKey !== lastCard) { setLastCard(cardKey); if (expanded) setExpanded(false); }

  // ── derived views ───────────────────────────────────────────────────────
  const context = useMemo(() => {
    if (playing || !settings.showContext || !item || item.t !== 'w') return null;
    return paragraphRange(items, index);
  }, [playing, settings.showContext, item, items, index]);

  const appendixSections = tl.sections.filter((s) => s.part === 'appendix').length;
  const firstAppendix = tl.sections.findIndex((s) => s.part === 'appendix');

  const stopLike = isStop(item);
  const keyNow = item?.t === 'w' && item.key;

  return (
    <div className={`pt-module rsv rsv-reader${isFs ? ' rsv-reader--fs' : ''}`} ref={rootRef} style={{ '--rsv-scale': settings.fontScale }}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="rsv-head">
        <button type="button" className="rsv-btn" onClick={onBack}><Icon name="arrowLeft" size={14} /> Library</button>
        <div className="rsv-head__title">
          <h2 className="rsv-title">{paper.title}</h2>
          <p className="rsv-meta">
            {(paper.authors || []).slice(0, 4).join(', ')}{(paper.authors || []).length > 4 ? ' et al.' : ''}
            {paper.year ? ` · ${paper.year}` : ''}
            {` · ${fmt(tl.totalWords)} words · ${tl.sections.length} sections`}
            {paper.status !== 'complete' && (
              <>
                {' · '}<span className="rsv-dot rsv-dot--uploading" aria-hidden="true" />upload in progress
                {' · '}<button type="button" className="rsv-link" onClick={onReload}>reload</button>
              </>
            )}
            {paper.source && <> {' · '}<a className="rsv-link" href={/^https?:/.test(paper.source) ? paper.source : `https://doi.org/${paper.source.replace(/^doi:/i, '')}`} target="_blank" rel="noreferrer">source</a></>}
          </p>
        </div>
        <div className="rsv-head__tools">
          <button type="button" className={`rsv-btn${panel === 'contents' ? ' rsv-btn--on' : ''}`} onClick={() => setPanel((p) => (p === 'contents' ? null : 'contents'))} aria-pressed={panel === 'contents'}>
            <Icon name="list" size={14} /> Contents <kbd>c</kbd>
          </button>
          <button type="button" className={`rsv-btn${panel === 'settings' ? ' rsv-btn--on' : ''}`} onClick={() => setPanel((p) => (p === 'settings' ? null : 'settings'))} aria-pressed={panel === 'settings'}>
            <Icon name="sliders" size={14} /> Settings <kbd>s</kbd>
          </button>
          <button type="button" className="rsv-btn" onClick={toggleFs} aria-label={isFs ? 'Exit focus mode' : 'Focus mode'}>
            <Icon name={isFs ? 'compress' : 'expand'} size={14} /> {isFs ? 'Exit' : 'Focus'} <kbd>f</kbd>
          </button>
        </div>
      </header>

      {/* ── Panels ───────────────────────────────────────────────────── */}
      {panel === 'contents' && (
        <section className="rsv-panel" aria-label="Contents">
          <p className="rsv-panel__title">Contents <span className="rsv-panel__count">{tl.sections.length} sections · {fmt(tl.mainWords)} main{tl.hasAppendix ? ` · ${fmt(tl.appendixWords)} appendix` : ''}</span></p>
          <ol className="rsv-toc">
            {tl.sections.map((s, k) => (
              <li key={k} className={`rsv-toc__item rsv-toc__item--l${s.level}${k === si ? ' rsv-toc__item--cur' : ''}${k === firstAppendix ? ' rsv-toc__item--appendix-start' : ''}`}>
                {k === firstAppendix && <p className="rsv-toc__part">Appendix</p>}
                <button type="button" className="rsv-toc__btn" onClick={() => { gotoSection(k); setPanel(null); }} aria-current={k === si ? 'true' : undefined}>
                  <span className="rsv-toc__num">{String(k + 1).padStart(2, '0')}</span>
                  <span className="rsv-toc__h">{s.heading}</span>
                  <span className="rsv-toc__w">{fmt(s.words)} w</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {panel === 'settings' && (
        <section className="rsv-panel" aria-label="Settings">
          <p className="rsv-panel__title">Settings <span className="rsv-panel__count">saved in this browser</span></p>
          <dl className="rsv-set">
            <div className="rsv-set__row">
              <dt>Speed</dt>
              <dd className="rsv-set__speed">
                <button type="button" className="rsv-btn" onClick={() => bumpWpm(-WPM_STEP)} aria-label="Slower">−</button>
                <input type="range" min={WPM_MIN} max={WPM_MAX} step={WPM_STEP} value={settings.wpm} onChange={(e) => onSettings({ wpm: clampWpm(e.target.value) })} aria-label="Words per minute" />
                <button type="button" className="rsv-btn" onClick={() => bumpWpm(WPM_STEP)} aria-label="Faster">+</button>
                <span className="rsv-set__val">{settings.wpm} wpm</span>
              </dd>
            </div>
            <Seg label="Slowdowns" hint="long words, maths, punctuation, breaks" options={INTENSITY_OPTIONS} value={settings.intensity} onChange={(v) => onSettings({ intensity: v })} />
            <Seg label="Pause cards" hint="figures, tables, equations, algorithms" options={CARD_OPTIONS} value={settings.cardSeconds} onChange={(v) => onSettings({ cardSeconds: v })} />
            <Seg label="Headings" options={[{ value: 'auto', label: 'Auto' }, { value: 'stop', label: 'Stop' }]} value={settings.headingMode} onChange={(v) => onSettings({ headingMode: v })} />
            <Seg label="Appendix" hint="at the end of the main body" options={[{ value: false, label: 'Ask' }, { value: true, label: 'Continue' }]} value={settings.autoAppendix} onChange={(v) => onSettings({ autoAppendix: v })} />
            <Seg label="Text size" options={FONT_OPTIONS} value={settings.fontScale} onChange={(v) => onSettings({ fontScale: v })} />
            <Seg label="Context" hint="paragraph shown while paused" options={[{ value: true, label: 'Show' }, { value: false, label: 'Hide' }]} value={settings.showContext} onChange={(v) => onSettings({ showContext: v })} />
          </dl>
        </section>
      )}

      {/* ── Stage ────────────────────────────────────────────────────── */}
      <section className={`rsv-stage${stopLike ? ' rsv-stage--card' : ''}`} aria-live="off">
        <p className="rsv-eyebrow">
          {trail.map((s, k) => (
            <span key={k} className="rsv-eyebrow__crumb">{k > 0 && <span className="rsv-eyebrow__sep">›</span>}{s.heading}</span>
          ))}
          {section && <span className="rsv-eyebrow__part">{section.part}</span>}
          {keyNow && <span className="rsv-eyebrow__flag"><span className="rsv-dot rsv-dot--key" aria-hidden="true" />key finding</span>}
          {item?.t === 'w' && item.li && <span className="rsv-eyebrow__flag">• {item.li.n}/{item.li.of}</span>}
          {item?.t === 'w' && item.sym && <span className="rsv-eyebrow__flag">math</span>}
        </p>

        <div className="rsv-focus">
          {item?.t === 'w' && (
            <>
              <span className="rsv-guide rsv-guide--top" aria-hidden="true" />
              <span className="rsv-guide rsv-guide--bot" aria-hidden="true" />
              <WordView item={item} />
            </>
          )}
          {item?.t === 'h' && (
            <div className="rsv-hcard">
              <p className="rsv-hcard__eyebrow">§ {String(si + 1).padStart(2, '0')} · level {item.level} · {item.part}</p>
              <p className={`rsv-hcard__h rsv-hcard__h--l${item.level}`}>{item.text}</p>
            </div>
          )}
          {item?.t === 'c' && (
            <PauseCard
              block={item.block}
              expanded={expanded}
              onToggle={() => setExpanded((x) => !x)}
              onContinue={() => { setExpanded(false); play(); }}
              autoSeconds={settings.cardSeconds || 0}
            />
          )}
          {item?.t === 'm' && (
            <div className="rsv-card rsv-card--stop" role="group" aria-label="End of main body">
              <p className="rsv-card__eyebrow"><span className="rsv-dot rsv-dot--pause" aria-hidden="true" />END OF MAIN BODY</p>
              <p className="rsv-card__caption">
                {fmt(tl.mainWords)} words read. {appendixSections} appendix {appendixSections === 1 ? 'section' : 'sections'} remain
                ({fmt(tl.appendixWords)} words, about {Math.max(1, Math.round(minsLeft))} min at {settings.wpm} wpm).
              </p>
              <div className="rsv-card__actions">
                <button type="button" className="rsv-btn rsv-btn--solid" onClick={play}><Icon name="play" size={13} /> Continue into appendix <kbd>space</kbd></button>
                <button type="button" className="rsv-btn" onClick={() => { persist(items.length - 1, { done: true }); onBack(); }}>Finish here</button>
                <label className="rsv-check">
                  <input type="checkbox" checked={Boolean(settings.autoAppendix)} onChange={(e) => onSettings({ autoAppendix: e.target.checked })} /> always continue
                </label>
              </div>
            </div>
          )}
          {item?.t === 'e' && (
            <div className="rsv-card rsv-card--stop" role="group" aria-label="Finished">
              <p className="rsv-card__eyebrow"><span className="rsv-dot rsv-dot--complete" aria-hidden="true" />FINISHED</p>
              <p className="rsv-card__caption">{fmt(tl.totalWords)} words · {tl.sections.length} sections. Progress saved.</p>
              <div className="rsv-card__actions">
                <button type="button" className="rsv-btn rsv-btn--solid" onClick={() => jumpTo(0)}><Icon name="skipBack" size={13} /> Read again</button>
                <button type="button" className="rsv-btn" onClick={onBack}><Icon name="arrowLeft" size={13} /> Library</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Progress rule ────────────────────────────────────────── */}
        <div className="rsv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="rsv-progress__track">
            <div className="rsv-progress__fill" style={{ width: `${pct}%` }} />
            {mainPct !== null && <span className="rsv-progress__mark" style={{ left: `${mainPct}%` }} title="End of main body" />}
          </div>
          <p className="rsv-counters">
            <span>{fmt(wordsRead)} / {fmt(tl.totalWords)} words</span>
            <span>{pct.toFixed(0)}%</span>
            <span>{finished ? 'done' : `~${minsLeft < 1 ? '<1' : fmt(minsLeft)} min left`}</span>
            <span className="rsv-counters__wpm">{settings.wpm} wpm</span>
          </p>
        </div>
      </section>

      {/* ── Transport ────────────────────────────────────────────────── */}
      <div className="rsv-transport">
        <div className="rsv-transport__group">
          <button type="button" className="rsv-btn" onClick={() => gotoSection(si - 1)} disabled={si <= 0} aria-label="Previous section" title="Previous section (shift+←)"><Icon name="skipBack" size={14} /></button>
          <button type="button" className="rsv-btn" onClick={() => jumpTo(prevSentence(items, index))} disabled={index <= 0} aria-label="Previous sentence" title="Previous sentence (←)"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className={`rsv-btn rsv-btn--play${playing ? ' rsv-btn--on' : ''}`} onClick={() => { setExpanded(false); toggle(); }} disabled={finished} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={15} /> {playing ? 'Pause' : stopLike && !finished ? 'Continue' : 'Play'} <kbd>space</kbd>
          </button>
          <button type="button" className="rsv-btn" onClick={() => jumpTo(nextSentence(items, index))} disabled={finished} aria-label="Next sentence" title="Next sentence (→)"><Icon name="arrowRight" size={14} /></button>
          <button type="button" className="rsv-btn" onClick={() => gotoSection(si + 1)} disabled={si >= tl.sections.length - 1} aria-label="Next section" title="Next section (shift+→)"><Icon name="skipForward" size={14} /></button>
        </div>
        <div className="rsv-transport__group rsv-transport__speed">
          <button type="button" className="rsv-btn" onClick={() => bumpWpm(-WPM_STEP)} aria-label="Slower (↓)">−</button>
          <span className="rsv-transport__wpm">{settings.wpm}<small>wpm</small></span>
          <button type="button" className="rsv-btn" onClick={() => bumpWpm(WPM_STEP)} aria-label="Faster (↑)">+</button>
        </div>
      </div>

      {/* ── Paused context ───────────────────────────────────────────── */}
      {context && (
        <section className="rsv-context" aria-label="Surrounding text">
          <p className="rsv-context__label">Paused · paragraph {items[index].par ?? ''} · click a word to jump</p>
          <p className="rsv-context__text">
            {items.slice(context[0], context[1]).map((w, k) => {
              const i = context[0] + k;
              const cls = `rsv-context__w${i === index ? ' rsv-context__w--cur' : ''}${w.sent === items[index].sent ? ' rsv-context__w--sent' : ''}${w.key ? ' rsv-context__w--key' : ''}`;
              return <button type="button" key={i} className={cls} onClick={() => jumpTo(i)}>{w.text}</button>;
            })}
          </p>
        </section>
      )}

      <p className="rsv-keys" aria-label="Keyboard shortcuts">
        <span><kbd>space</kbd> play / pause</span>
        <span><kbd>←</kbd><kbd>→</kbd> sentence</span>
        <span><kbd>shift</kbd>+<kbd>←</kbd><kbd>→</kbd> section</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> speed</span>
        <span><kbd>enter</kbd> card detail</span>
        <span><kbd>c</kbd> contents</span>
        <span><kbd>s</kbd> settings</span>
        <span><kbd>f</kbd> focus</span>
      </p>
    </div>
  );
}

// One word at the focal point: the letters before the ORP right-aligned into
// the left cell, the ORP letter in the centre cell, the rest left-aligned —
// so the focal letter's centre never moves. Long tokens shrink to fit.
function WordView({ item }) {
  const { text, orp } = item;
  const pre = text.slice(0, orp);
  const mid = text.slice(orp, orp + 1);
  const post = text.slice(orp + 1);
  const len = text.length;
  const shrink = len > 13 ? Math.max(0.55, 13 / len) : 1;
  return (
    <span
      className={`rsv-word${item.sym ? ' rsv-word--sym' : ''}${item.key ? ' rsv-word--key' : ''}`}
      style={shrink !== 1 ? { fontSize: `calc(var(--rsv-word-size) * ${shrink.toFixed(3)})` } : undefined}
    >
      <span className="rsv-word__pre">{pre}</span>
      <span className="rsv-word__orp">{mid}</span>
      <span className="rsv-word__post">{post}</span>
    </span>
  );
}

// A settings row: label + hint + segmented choice.
function Seg({ label, hint, options, value, onChange }) {
  return (
    <div className="rsv-set__row">
      <dt>{label}{hint && <small>{hint}</small>}</dt>
      <dd>
        <span className="rsv-seg" role="group" aria-label={label}>
          {options.map((o) => (
            <button
              type="button"
              key={String(o.value)}
              className={`rsv-seg__btn${o.value === value ? ' rsv-seg__btn--on' : ''}`}
              aria-pressed={o.value === value}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </span>
      </dd>
    </div>
  );
}
