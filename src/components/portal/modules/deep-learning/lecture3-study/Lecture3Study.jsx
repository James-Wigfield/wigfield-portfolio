import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../icons';
import { RefsProvider } from '../kit';
import { SECTIONS } from './sections';
import { REFS } from './slideData';
import { load, save, loadTicks } from './storage';
import { StudyCtx } from './context';
import { Blocks } from './Rich';
import NotebookPage from './NotebookPage';
import { prefersReducedMotion } from './hooks';
import { RoadmapLab, OrientationLab, DepthFieldLab } from './labs/labsIntro';
import { ConvStepLab } from './labs/labsConv';
import { ReceptiveFieldLab, FilterMapLab, ChannelSumLab } from './labs/labsLayers';
import { Conv2DLab, PaddingLab, MemoryLab } from './labs/labsKeras';
import { PoolingLab, DepthPoolLab, HyperparamLab } from './labs/labsPool';
import { ShapeFlowLab, KernelStackLab, ClassicTablesLab, AugmentLab, InceptionLab, ResidualLab, TimelineLab } from './labs/labsArch';
import { PretrainedLab, TransferLab, OutcomesLab } from './labs/labsApps';
import '../common.css';
import './lecture3-study.css';

/* ============================================================================
   CITS5017 · LECTURE 3 (CNNs) — STUDY MODULE
   ----------------------------------------------------------------------------
   One continuous page, in slide order, built for working down it in focus
   mode: every section is Read → Play → Write, and the Write beat is a sheet of
   notebook paper to copy by hand.

     shell        sticky header (title · current section · progress · focus
                  toggle), a section index (rail when wide, dropdown when
                  narrow), "Resume at §N", scroll-spy
     focus mode   the Fullscreen API on this root (Reader.jsx pattern); the
                  root becomes its own scroll container with the theme's
                  ground behind it. Falls back to a fixed overlay when the API
                  is missing. Esc exits.
     persistence  ./storage.js — ticks, last section, outcomes, rail state
     content      ./sections.js (all prose, notes, formulas, questions)
     labs         ./labs/*.jsx  ·  diagrams ./diagrams.jsx

   The original tabbed Lecture 3 (../lecture3/) is untouched.
   ========================================================================== */

const LABS = {
  roadmap: RoadmapLab,
  orientation: OrientationLab,
  depthField: DepthFieldLab,
  convStep: ConvStepLab,
  receptiveField: ReceptiveFieldLab,
  filterMap: FilterMapLab,
  channelSum: ChannelSumLab,
  conv2d: Conv2DLab,
  padding: PaddingLab,
  memory: MemoryLab,
  pooling: PoolingLab,
  depthPool: DepthPoolLab,
  hyper: HyperparamLab,
  shapeFlow: ShapeFlowLab,
  kernelStack: KernelStackLab,
  classicTables: ClassicTablesLab,
  augment: AugmentLab,
  inception: InceptionLab,
  residual: ResidualLab,
  timeline: TimelineLab,
  pretrained: PretrainedLab,
  transfer: TransferLab,
  outcomes: OutcomesLab,
};

const domId = (id) => `dl3s-${id}`;
const lineCount = (s) => s.notes.reduce((a, g) => a + g.lines.length, 0);
const TOTAL_LINES = SECTIONS.reduce((a, s) => a + lineCount(s), 0);
const LAB_COUNT = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);
const WIDE_AT = 920;
const NONE = [];

function Beat({ n, icon, label, children }) {
  return (
    <div className={`dl3s-beat dl3s-beat--${label.toLowerCase()}`}>
      <p className="dl3s-beat__label">
        <span className="dl3s-beat__n">{n}</span>
        <Icon name={icon} size={14} />
        {label}
      </p>
      {children}
    </div>
  );
}

const StudySection = memo(function StudySection({ s, ticked, onToggle, onSetAll }) {
  return (
    <section className="dl3s-sec" id={domId(s.id)} aria-labelledby={`${domId(s.id)}-h`}>
      <header className="dl3s-sec__head">
        <span className="dl3s-sec__no">§{s.no}</span>
        <h2 className="dl3s-sec__title" id={`${domId(s.id)}-h`} tabIndex={-1}>{s.title}</h2>
        <span className="dl3s-receipt">slides {s.slides}</span>
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dl3s-read">
          <Blocks blocks={s.read} />
        </div>
      </Beat>
      {s.play?.length > 0 && (
        <Beat n={2} icon="flask" label="Play">
          {s.play.map((key) => {
            const L = LABS[key];
            return L ? <L key={key} /> : null;
          })}
        </Beat>
      )}
      <Beat n={3} icon="edit" label="Write">
        <NotebookPage section={s} ticked={ticked} onToggle={(idx) => onToggle(s.id, idx)} onSetAll={(total, on) => onSetAll(s.id, total, on)} />
      </Beat>
    </section>
  );
});

function SectionIndex({ current, stats, onJump, variant, onClose }) {
  const listRef = useRef(null);
  // Keep the current section visible inside the rail's own scroller (never
  // scrolls the page itself).
  useEffect(() => {
    const list = listRef.current;
    const box = list?.closest('.dl3s-rail, .dl3s-drop');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop; // the rail / dropdown is the item's offsetParent
    const pad = 48;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current]);
  return (
    <nav className={`dl3s-index dl3s-index--${variant}`} aria-label="Sections of this lecture">
      <div className="dl3s-index__head">
        <span className="dl3s-index__title">Sections</span>
        <span className="dl3s-index__count">{stats.pages}/{SECTIONS.length} pages done</span>
        {onClose && (
          <button type="button" className="dl3s-index__close" onClick={onClose} aria-label="Hide the section index">
            <Icon name="chevron" size={14} className="dl3s-rot180" />
          </button>
        )}
      </div>
      <ol className="dl3s-index__list" ref={listRef}>
        {SECTIONS.map((s, i) => {
          const st = stats.per[s.id];
          const groupHead = s.group && SECTIONS[i - 1]?.group !== s.group ? s.group : null;
          return (
            <li key={s.id}>
              {groupHead && <span className="dl3s-index__group">§12 {groupHead}</span>}
              <button
                type="button"
                className={`dl3s-index__item${i === current ? ' dl3s-index__item--on' : ''}${st?.complete ? ' dl3s-index__item--done' : ''}${s.group ? ' dl3s-index__item--sub' : ''}`}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(s.id)}
              >
                <span className="dl3s-index__no">{s.no}</span>
                <span className="dl3s-index__name">
                  {s.short}
                  <span className="dl3s-index__slides">slides {s.slides}</span>
                </span>
                <span className="dl3s-index__state" aria-label={st?.complete ? 'notes finished' : `${st?.done ?? 0} of ${st?.total ?? 0} lines`}>
                  {st?.complete ? <Icon name="check" size={13} strokeWidth={2.2} /> : st?.done ? `${st.done}/${st.total}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function Lecture3Study() {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const dropRef = useRef(null);

  const [ticks, setTicks] = useState(loadTicks);
  const [outcomes, setOutcomes] = useState(() => {
    const v = load('outcomes', []);
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  });
  const [railOpen, setRailOpen] = useState(() => load('rail', true) !== false);
  const [dropOpen, setDropOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [resumeIdx] = useState(() => {
    const i = SECTIONS.findIndex((s) => s.id === load('last', null));
    return i > 0 ? i : -1;
  });
  const [resumeOpen, setResumeOpen] = useState(resumeIdx > 0);
  const [isFs, setIsFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [wide, setWide] = useState(true);
  const [stick, setStick] = useState(0);

  const focus = isFs || pseudoFs;
  const pseudoFsRef = useRef(false);
  const holdSection = useRef(null);
  const live = useRef({});
  useEffect(() => {
    live.current = { current, focus, resumeIdx };
  });
  const userScrolled = useRef(false);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => { save('ticks', ticks); }, [ticks]);
  useEffect(() => { save('outcomes', outcomes); }, [outcomes]);
  useEffect(() => { save('rail', railOpen); }, [railOpen]);
  useEffect(() => {
    if (userScrolled.current) save('last', SECTIONS[current].id);
  }, [current]);

  const toggleTick = useCallback((id, idx) => {
    setTicks((prev) => {
      const set = new Set(prev[id] || []);
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      return { ...prev, [id]: [...set].sort((a, b) => a - b) };
    });
  }, []);
  const setAllTicks = useCallback((id, total, on) => {
    setTicks((prev) => ({ ...prev, [id]: on ? Array.from({ length: total }, (_, i) => i) : [] }));
  }, []);
  const toggleOutcome = useCallback((i) => {
    setOutcomes((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));
  }, []);

  const stats = useMemo(() => {
    const per = {};
    let lines = 0;
    let pages = 0;
    SECTIONS.forEach((s) => {
      const total = lineCount(s);
      const done = (ticks[s.id] || []).filter((i) => i < total).length;
      const complete = total > 0 && done === total;
      per[s.id] = { done, total, complete };
      lines += done;
      if (complete) pages += 1;
    });
    return { per, lines, pages };
  }, [ticks]);

  // ── layout measurements ──────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setWide(entries[0].contentRect.width >= WIDE_AT));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // In the normal portal page the sticky header sits just under the portal's
  // own sticky topbar; in focus mode it sits at the very top.
  useEffect(() => {
    const topbar = rootRef.current?.closest('.portal')?.querySelector('.portal__topbar');
    if (!topbar || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setStick(topbar.offsetHeight));
    ro.observe(topbar);
    return () => ro.disconnect();
  }, []);

  // ── scrolling ────────────────────────────────────────────────────────────
  const scroller = useCallback(() => (live.current.focus ? rootRef.current : null), []);

  // Where the sticky header ends, measured at the moment it's needed (the
  // portal's own topbar sits above it outside focus mode).
  const barBottom = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return 0;
    const top = parseFloat(getComputedStyle(bar).top) || 0;
    if (live.current.focus) return top + bar.offsetHeight;
    const topbar = rootRef.current?.closest('.portal')?.querySelector('.portal__topbar');
    return Math.max(top, (topbar?.offsetHeight ?? 0) + 5) + bar.offsetHeight;
  }, []);

  const jumpTo = useCallback((id, { nb = false, smooth = true } = {}) => {
    const el = document.getElementById(nb ? `${domId(id)}-nb` : domId(id));
    const root = rootRef.current;
    if (!el || !root) return;
    const gap = barBottom() + 14;
    const box = scroller();
    const view = box ? box.clientHeight : window.innerHeight;
    const dist = Math.abs(el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) - gap);
    // Smooth only for short hops; long jumps (and reduced motion) are instant.
    // 'instant', not 'auto': the site sets scroll-behavior: smooth on <html>.
    const behavior = smooth && !prefersReducedMotion() && dist < view * 2.5 ? 'smooth' : 'instant';
    if (box) {
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - gap;
      box.scrollTo({ top, behavior });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - gap, behavior });
    }
    const heading = nb ? el.querySelector('.dl3s-nb__title') : el.querySelector('.dl3s-sec__title');
    heading?.focus?.({ preventScroll: true });
    setDropOpen(false);
  }, [barBottom, scroller]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const box = scroller();
      const top = barBottom();
      const vh = box ? box.clientHeight : window.innerHeight;
      const line = top + (vh - top) * 0.28;
      let idx = 0;
      for (let i = 0; i < SECTIONS.length; i++) {
        const el = document.getElementById(domId(SECTIONS[i].id));
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      const sc = box ?? document.scrollingElement;
      if (sc && sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) idx = SECTIONS.length - 1;
      setCurrent(idx);
      const r = live.current.resumeIdx;
      if (r > 0 && idx >= r) setResumeOpen(false);
    };
    const onScroll = () => {
      userScrolled.current = true;
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [barBottom, scroller]);

  // ── focus mode ───────────────────────────────────────────────────────────
  // Entering or leaving swaps the scroll container (window ↔ this root), so
  // land back on the section you were reading. The section is captured the
  // moment the mode changes, before any scroll events from the swap.
  // Both kinds of focus mode take the root out of the page flow, so the page
  // shrinks and its scroll position clamps; the jump is retried for a few
  // frames until the layout has settled and the section lands where it should.
  const restore = useCallback(() => {
    if (holdSection.current === null) holdSection.current = live.current.current;
    let tries = 0;
    const attempt = () => {
      const i = holdSection.current ?? 0;
      jumpTo(SECTIONS[i].id, { smooth: false });
      const el = document.getElementById(domId(SECTIONS[i].id));
      const want = barBottom() + 14;
      const got = el ? el.getBoundingClientRect().top : want;
      if (Math.abs(got - want) > 24 && tries < 10) {
        tries += 1;
        requestAnimationFrame(attempt);
      } else {
        holdSection.current = null;
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(attempt));
  }, [jumpTo, barBottom]);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === rootRef.current;
      if (on && pseudoFsRef.current) {
        // real fullscreen arrived after the overlay fallback: drop the overlay
        pseudoFsRef.current = false;
        document.documentElement.classList.remove('dl3s-pseudo-on');
        setPseudoFs(false);
      }
      if (on) live.current.focus = true;
      else if (!pseudoFsRef.current) live.current.focus = false;
      setIsFs(on);
      restore();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [restore]);

  const setPseudo = useCallback((on) => {
    pseudoFsRef.current = on;
    live.current.focus = on;
    document.documentElement.classList.toggle('dl3s-pseudo-on', on);
    setPseudoFs(on);
    restore();
  }, [restore]);

  const toggleFocus = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    holdSection.current = live.current.current;
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
    // If the browser neither grants nor refuses fullscreen promptly, use the
    // overlay rather than leave the button looking dead.
    let settled = false;
    const fallback = setTimeout(() => {
      if (!settled && !document.fullscreenElement) setPseudo(true);
    }, 1000);
    el.requestFullscreen()
      .then(() => el.focus?.({ preventScroll: true }))
      .catch(() => { if (!pseudoFsRef.current) setPseudo(true); })
      .finally(() => { settled = true; clearTimeout(fallback); });
  }, [setPseudo]);

  // The overlay fallback is position: fixed, but the portal's content wrapper
  // keeps a filled fade-in transform, which would trap a fixed element inside
  // it. While the overlay is up, html.dl3s-pseudo-on switches that off (and
  // stops the page behind scrolling); setPseudo toggles it, and this clears it
  // if the module unmounts mid-overlay. Real fullscreen uses the top layer.
  useEffect(() => () => document.documentElement.classList.remove('dl3s-pseudo-on'), []);

  // Esc closes the dropdown, and the overlay fallback (real fullscreen exits
  // on Esc by itself).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dropOpen) setDropOpen(false);
      else if (pseudoFsRef.current) setPseudo(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dropOpen, setPseudo]);

  // Click outside the dropdown closes it.
  useEffect(() => {
    if (!dropOpen) return undefined;
    const onDown = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [dropOpen]);

  const ctx = useMemo(() => ({ stats, jumpTo, outcomes, toggleOutcome }), [stats, jumpTo, outcomes, toggleOutcome]);
  const cur = SECTIONS[current];
  const showRail = wide && railOpen;
  const pct = Math.round((stats.lines / TOTAL_LINES) * 100);

  return (
    <StudyCtx.Provider value={ctx}>
      <RefsProvider refs={REFS}>
        <div
          ref={rootRef}
          tabIndex={-1}
          className={`dl dl3s${focus ? ' dl3s--focus' : ''}${pseudoFs ? ' dl3s--pseudo' : ''}`}
          style={{ '--dl3s-stick': `${focus ? 0 : stick}px` }}
        >
          {/* ── sticky header ─────────────────────────────────────────── */}
          <header ref={barRef} className="dl3s-bar">
            <div className="dl3s-bar__title">
              <span className="dl3s-bar__kicker">CITS5017 · Lecture 3</span>
              <span className="dl3s-bar__name">CNNs — study module</span>
            </div>
            <div className="dl3s-bar__now" aria-live="polite">
              <span className="dl3s-bar__nowno">§{cur.no}</span>
              <span className="dl3s-bar__nowname">{cur.title}</span>
            </div>
            <div className="dl3s-bar__prog" title={`${stats.lines} of ${TOTAL_LINES} notebook lines copied`}>
              <span className="dl3s-bar__progtext">
                <b>{stats.lines}</b>/{TOTAL_LINES} lines · <b>{stats.pages}</b>/{SECTIONS.length} pages
              </span>
              <span className="dl3s-bar__track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            </div>
            <div className="dl3s-bar__actions" ref={dropRef}>
              {wide ? (
                !railOpen && (
                  <button type="button" className="dl3s-btn" onClick={() => setRailOpen(true)} aria-label="Show the section index">
                    <Icon name="list" size={15} /> <span className="dl3s-btn__txt">Index</span>
                  </button>
                )
              ) : (
                <button type="button" className="dl3s-btn" aria-expanded={dropOpen} onClick={() => setDropOpen((o) => !o)}>
                  <Icon name="list" size={15} /> <span className="dl3s-btn__txt">Sections</span>
                </button>
              )}
              <button type="button" className="dl3s-btn dl3s-btn--primary" onClick={toggleFocus} aria-pressed={focus}>
                <Icon name={focus ? 'compress' : 'expand'} size={15} />
                <span className="dl3s-btn__txt">{focus ? 'Exit focus mode' : 'Enter focus mode'}</span>
              </button>
              {!wide && dropOpen && (
                <div className="dl3s-drop">
                  <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="drop" />
                </div>
              )}
            </div>
          </header>

          <div className={`dl3s-layout${showRail ? ' dl3s-layout--rail' : ''}`}>
            {showRail && (
              <aside className="dl3s-rail">
                <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="rail" onClose={() => setRailOpen(false)} />
              </aside>
            )}

            <main className="dl3s-flow">
              {/* ── module title block ──────────────────────────────── */}
              <div className="dl3s-hero">
                <p className="dl3s-hero__kicker">CITS5017 Deep Learning · Topic 3 · Chapter 14 · slides 1–53</p>
                <h1 className="dl3s-hero__title">Deep Computer Vision Using Convolutional Neural Networks</h1>
                <p className="dl3s-hero__lead">
                  One page, in slide order. Each section: read a short explanation, play with a live lab until it clicks, then copy
                  its notebook page onto paper and tick the lines off.
                </p>
                <div className="dl3s-hero__actions">
                  <button type="button" className="dl3s-btn dl3s-btn--primary dl3s-btn--big" onClick={toggleFocus} aria-pressed={focus}>
                    <Icon name={focus ? 'compress' : 'expand'} size={17} /> {focus ? 'Exit focus mode' : 'Enter focus mode'}
                  </button>
                  {resumeOpen && resumeIdx > 0 && (
                    <span className="dl3s-resume">
                      <button type="button" className="dl3s-btn dl3s-btn--big" onClick={() => { setResumeOpen(false); jumpTo(SECTIONS[resumeIdx].id); }}>
                        <Icon name="arrowDown" size={16} /> Resume at §{SECTIONS[resumeIdx].no} · {SECTIONS[resumeIdx].short}
                      </button>
                      <button type="button" className="dl3s-resume__x" onClick={() => setResumeOpen(false)} aria-label="Dismiss the resume suggestion">
                        dismiss
                      </button>
                    </span>
                  )}
                </div>
                <p className="dl3s-hero__stats">
                  <span><b>{SECTIONS.length}</b> notebook pages</span>
                  <span><b>{LAB_COUNT}</b> live labs</span>
                  <span><b>{TOTAL_LINES}</b> lines to copy</span>
                  <span>Esc leaves focus mode</span>
                </p>
              </div>

              {SECTIONS.map((s) => (
                <StudySection key={s.id} s={s} ticked={ticks[s.id] || NONE} onToggle={toggleTick} onSetAll={setAllTicks} />
              ))}

              <footer className="dl3s-end">
                <p>
                  End of Lecture 3. Source: <em>CITS5017 Topic 3: Deep Computer Vision Using Convolutional Neural Networks</em>, A/Prof Du
                  Huynh, UWA, Semester 2 2026 (53 slides).
                </p>
              </footer>
            </main>
          </div>
        </div>
      </RefsProvider>
    </StudyCtx.Provider>
  );
}
