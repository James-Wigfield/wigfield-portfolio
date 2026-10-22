import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../icons';
import { RefsProvider } from '../kit';
import { SECTIONS } from './sections';
import { REFS } from './slideData';
import { load, save, loadSheetTicks } from './storage';
import { StudyCtx } from './context';
import { Blocks, Rich } from './Rich';
import SheetPage from './SheetPage';
import { SHEETS, sheetKeys } from './sheets';
import { prefersReducedMotion } from './hooks';
import { PRINT_CSS, preparePrint } from './print';
import ExportPdf from './ExportPdf';
import { LABS } from './labs';
import '../common.css';
import './lecture8-study.css';
import './stage.css';
import './sheet.css';

/* ============================================================================
   CITS5017 · LECTURE 8 (ATTENTION, TRANSFORMERS, VISION TRANSFORMERS) — STUDY MODULE
   ----------------------------------------------------------------------------
   One continuous page, in slide order, built for working down it in focus
   mode: every section is Read → Play → Write, and the Write beat is a sheet of
   notebook paper to copy by hand (./sheets, drawn by SheetPage.jsx). A
   section with nothing worth copying (the intro and the summary) has no
   Write beat and doesn't count towards the notebook progress.

     shell        sticky header (title · current section · progress · focus
                  toggle), a section index (rail when wide, dropdown when
                  narrow), "Resume at §N", scroll-spy
     focus mode   the Fullscreen API on this root (Reader.jsx pattern); the
                  root becomes its own scroll container with the theme's
                  ground behind it. Falls back to a fixed overlay when the API
                  is missing. Esc exits.
     export       Export PDF prints the Read and Play beats (./print.js); the
                  NotebookLM video prompt sits in a dropdown under the button
     persistence  ./storage.js — sheet ticks, last section, outcomes, rail
     content      ./sections.js (Read prose) · ./sheets (notebook pages)
     labs         ./labs/*.jsx (registry ./labs/index.js), drawn in one visual
                  language: ./stage.jsx + ./svgParts.jsx + ./stage.css
     diagrams     ./diagrams.jsx (notebook line art)
     maths        ./attn.js  ·  toy numbers ./toys.js  ·  slide facts
                  ./slideData.js  ·  the page's own runs ./data (lazy):
                  bus/rail (busrail.js) and a toy transformer (toyMT.js)

   A copy of the Lecture 5 study shell (../lecture5-study/), adapted: a new
   stage-first lab frame (story mode, maths drawer) and a not-examined flag.
   ========================================================================== */

const domId = (id) => `dl8s-${id}`;
const SHEET_KEYS = Object.fromEntries(SECTIONS.map((s) => [s.id, sheetKeys(SHEETS[s.id])]));
const WITH_PAGE = SECTIONS.filter((s) => SHEET_KEYS[s.id].length > 0);
const TOTAL_LINES = WITH_PAGE.reduce((a, s) => a + SHEET_KEYS[s.id].length, 0);
const LAB_COUNT = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);
const WIDE_AT = 920;
const NONE = [];

function Beat({ n, icon, label, children }) {
  return (
    <div className={`dl8s-beat dl8s-beat--${label.toLowerCase()}`}>
      <p className="dl8s-beat__label">
        <span className="dl8s-beat__n">{n}</span>
        <Icon name={icon} size={14} />
        {label}
      </p>
      {children}
    </div>
  );
}

function footnotesIn(blocks) {
  const found = new Set();
  JSON.stringify(blocks ?? []).replace(/\[\^(\d+)\]/g, (_, n) => found.add(Number(n)));
  return [...found].sort((a, b) => a - b);
}

// The Read beat's footnotes, written out for print (on screen they are
// popovers on the [n] markers).
function PrintFootnotes({ blocks }) {
  const ns = footnotesIn(blocks);
  if (!ns.length) return null;
  return (
    <ol className="dl8s-printfn" aria-hidden="true">
      {ns.map((n) => <li key={n} value={n}><Rich text={REFS[n] ?? ''} /></li>)}
    </ol>
  );
}

const StudySection = memo(function StudySection({ s, sheetTicked, onSheetToggle, onSheetSetAll }) {
  const sheet = SHEETS[s.id];
  return (
    <section className="dl8s-sec" id={domId(s.id)} aria-labelledby={`${domId(s.id)}-h`}>
      <header className="dl8s-sec__head">
        <span className="dl8s-sec__no">§{s.no}</span>
        <h2 className="dl8s-sec__title" id={`${domId(s.id)}-h`} tabIndex={-1}>{s.title}</h2>
        {s.notExamined && <span className="dl8s-flag">not examined · slide 47</span>}
        <span className="dl8s-receipt">{/[–,]/.test(s.slides) ? 'slides' : 'slide'} {s.slides}</span>
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dl8s-read">
          <Blocks blocks={s.read} />
          <PrintFootnotes blocks={s.read} />
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
      {sheet && SHEET_KEYS[s.id].length > 0 && (
        <Beat n={3} icon="edit" label="Write">
          <SheetPage
            section={s}
            sheet={sheet}
            ticked={sheetTicked}
            onToggle={(key) => onSheetToggle(s.id, key)}
            onSetAll={(keys, on) => onSheetSetAll(s.id, keys, on)}
          />
        </Beat>
      )}
    </section>
  );
});

function SectionIndex({ current, stats, onJump, variant, onClose }) {
  const listRef = useRef(null);
  // Keep the current section visible inside the rail's own scroller (never
  // scrolls the page itself).
  useEffect(() => {
    const list = listRef.current;
    const box = list?.closest('.dl8s-rail, .dl8s-drop');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop; // the rail / dropdown is the item's offsetParent
    const pad = 48;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current]);
  return (
    <nav className={`dl8s-index dl8s-index--${variant}`} aria-label="Sections of this lecture">
      <div className="dl8s-index__head">
        <span className="dl8s-index__title">Sections</span>
        <span className="dl8s-index__count">{stats.pages}/{WITH_PAGE.length} pages done</span>
        {onClose && (
          <button type="button" className="dl8s-index__close" onClick={onClose} aria-label="Hide the section index">
            <Icon name="chevron" size={14} className="dl8s-rot180" />
          </button>
        )}
      </div>
      <ol className="dl8s-index__list" ref={listRef}>
        {SECTIONS.map((s, i) => {
          const st = stats.per[s.id];
          const noPage = !st?.total;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`dl8s-index__item${i === current ? ' dl8s-index__item--on' : ''}${st?.complete ? ' dl8s-index__item--done' : ''}`}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(s.id)}
              >
                <span className="dl8s-index__no">{s.no}</span>
                <span className="dl8s-index__name">
                  {s.short}
                  <span className="dl8s-index__slides">{/[–,]/.test(s.slides) ? 'slides' : 'slide'} {s.slides}</span>
                </span>
                <span className="dl8s-index__state" aria-label={noPage ? 'no notebook page' : st.complete ? 'notes finished' : `${st.done} of ${st.total} lines`}>
                  {noPage ? <span className="dl8s-index__none">{s.notExamined ? 'not exam' : 'read'}</span> : st.complete ? <Icon name="check" size={13} strokeWidth={2.2} /> : st.done ? `${st.done}/${st.total}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function Lecture8Study() {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const dropRef = useRef(null);

  const [sheetTicks, setSheetTicks] = useState(loadSheetTicks);
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
  const [printing, setPrinting] = useState(false);

  const focus = isFs || pseudoFs;
  const pseudoFsRef = useRef(false);
  const holdSection = useRef(null);
  const live = useRef({});
  useEffect(() => {
    live.current = { current, focus, resumeIdx };
  });
  const userScrolled = useRef(false);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => { save('sheetTicks', sheetTicks); }, [sheetTicks]);
  useEffect(() => { save('outcomes', outcomes); }, [outcomes]);
  useEffect(() => { save('rail', railOpen); }, [railOpen]);
  useEffect(() => {
    if (userScrolled.current) save('last', SECTIONS[current].id);
  }, [current]);

  const toggleSheetTick = useCallback((id, key) => {
    setSheetTicks((prev) => {
      const list = prev[id] || [];
      return { ...prev, [id]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
    });
  }, []);
  const setAllSheetTicks = useCallback((id, keys, on) => {
    setSheetTicks((prev) => ({ ...prev, [id]: on ? [...keys] : [] }));
  }, []);
  const toggleOutcome = useCallback((i) => {
    setOutcomes((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));
  }, []);

  // Per section: its notebook page's count. Sections without a page are
  // left out of the totals (nothing to copy there).
  const stats = useMemo(() => {
    const per = {};
    let lines = 0;
    let pages = 0;
    SECTIONS.forEach((s) => {
      const keys = SHEET_KEYS[s.id];
      const have = new Set(sheetTicks[s.id] || []);
      const done = keys.filter((k) => have.has(k)).length;
      const complete = keys.length > 0 && done === keys.length;
      per[s.id] = { done, total: keys.length, complete };
      lines += done;
      if (complete) pages += 1;
    });
    return { per, lines, pages, pct: TOTAL_LINES ? Math.round((lines / TOTAL_LINES) * 100) : 0 };
  }, [sheetTicks]);

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
    const page = nb ? document.getElementById(`${domId(id)}-nb`) : null;
    const el = page ?? document.getElementById(domId(id));
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
    const heading = page ? el.querySelector('.dl8s-sh__title') : el.querySelector('.dl8s-sec__title');
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
        document.documentElement.classList.remove('dl8s-pseudo-on');
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
    document.documentElement.classList.toggle('dl8s-pseudo-on', on);
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
  // it. While the overlay is up, html.dl8s-pseudo-on switches that off (and
  // stops the page behind scrolling); setPseudo toggles it, and this clears it
  // if the module unmounts mid-overlay. Real fullscreen uses the top layer.
  useEffect(() => () => document.documentElement.classList.remove('dl8s-pseudo-on', 'dl8s-printing'), []);

  // ── Export PDF ───────────────────────────────────────────────────────────
  // html.dl8s-printing scopes every print rule (./print.js) to this module;
  // the labs read `printing` and settle on a finished, meaningful state.
  // Focus mode is left first (print the page, not a fullscreen scroller) and
  // put back after; afterprint undoes the rest.
  const exportPdf = useCallback(async () => {
    const wasFs = !!document.fullscreenElement;
    const wasPseudo = pseudoFsRef.current;
    if (wasFs) await document.exitFullscreen?.().catch(() => {});
    if (wasPseudo) setPseudo(false);
    const prevTitle = document.title;
    document.documentElement.classList.add('dl8s-printing');
    setPrinting(true);
    await preparePrint();
    document.title = 'CITS5017 L8 Attention & Transformers — Read + Play';
    const after = () => {
      window.removeEventListener('afterprint', after);
      document.title = prevTitle;
      document.documentElement.classList.remove('dl8s-printing');
      setPrinting(false);
      if (wasFs || wasPseudo) {
        const el = rootRef.current;
        if (wasFs && el?.requestFullscreen) el.requestFullscreen().catch(() => setPseudo(true));
        else setPseudo(true);
      }
    };
    window.addEventListener('afterprint', after);
    window.print();
  }, [setPseudo]);

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

  const ctx = useMemo(() => ({ stats, jumpTo, outcomes, toggleOutcome, printing }), [stats, jumpTo, outcomes, toggleOutcome, printing]);
  const cur = SECTIONS[current];
  const showRail = wide && railOpen;
  const pct = stats.pct;

  return (
    <StudyCtx.Provider value={ctx}>
      <RefsProvider refs={REFS}>
        <style>{PRINT_CSS}</style>
        <div
          ref={rootRef}
          tabIndex={-1}
          className={`dl dl8s${focus ? ' dl8s--focus' : ''}${pseudoFs ? ' dl8s--pseudo' : ''}`}
          style={{ '--dl8s-stick': `${focus ? 0 : stick}px` }}
        >
          {/* ── sticky header ─────────────────────────────────────────── */}
          <header ref={barRef} className="dl8s-bar">
            <div className="dl8s-bar__title">
              <span className="dl8s-bar__kicker">CITS5017 · Lecture 8</span>
              <span className="dl8s-bar__name">Transformers — study module</span>
            </div>
            <div className="dl8s-bar__now" aria-live="polite">
              <span className="dl8s-bar__nowno">§{cur.no}</span>
              <span className="dl8s-bar__nowname">{cur.title}</span>
            </div>
            <div className="dl8s-bar__prog" title={`${pct}% of the notebook copied`}>
              <span className="dl8s-bar__progtext">
                <b>{pct}%</b> copied · <b>{stats.pages}</b>/{WITH_PAGE.length} pages
              </span>
              <span className="dl8s-bar__track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            </div>
            <div className="dl8s-bar__actions" ref={dropRef}>
              {wide ? (
                !railOpen && (
                  <button type="button" className="dl8s-btn" onClick={() => setRailOpen(true)} aria-label="Show the section index">
                    <Icon name="list" size={15} /> <span className="dl8s-btn__txt">Index</span>
                  </button>
                )
              ) : (
                <button type="button" className="dl8s-btn" aria-expanded={dropOpen} onClick={() => setDropOpen((o) => !o)}>
                  <Icon name="list" size={15} /> <span className="dl8s-btn__txt">Sections</span>
                </button>
              )}
              <button type="button" className="dl8s-btn dl8s-btn--primary" onClick={toggleFocus} aria-pressed={focus}>
                <Icon name={focus ? 'compress' : 'expand'} size={15} />
                <span className="dl8s-btn__txt">{focus ? 'Exit focus mode' : 'Enter focus mode'}</span>
              </button>
              {!wide && dropOpen && (
                <div className="dl8s-drop">
                  <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="drop" />
                </div>
              )}
            </div>
          </header>

          <div className={`dl8s-layout${showRail ? ' dl8s-layout--rail' : ''}`}>
            {showRail && (
              <aside className="dl8s-rail">
                <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="rail" onClose={() => setRailOpen(false)} />
              </aside>
            )}

            <main className="dl8s-flow">
              {/* ── module title block ──────────────────────────────── */}
              <div className="dl8s-hero">
                <p className="dl8s-hero__kicker">CITS5017 Deep Learning · Topic 8 · Chapter 16 · slides 1–51</p>
                <h1 className="dl8s-hero__title">Attention Mechanisms, Transformers, and Vision Transformers</h1>
                <p className="dl8s-hero__lead">
                  One page, in slide order. Each section: read a short explanation, play with a live lab until it clicks, then copy
                  its notebook page onto paper and tick the lines off.
                </p>
                <p className="dl8s-hero__printlead">
                  The Read and Play parts of the study module for CITS5017 Topic 8, in slide order: each section’s explanation, then what
                  its interactive lab shows. Numbers marked “this page’s own” (toy values, the page’s own bus/rail run, its toy transformer)
                  were made by the study page, not printed on the slides. §16 (slides 47–49) is not examined (slide 47).
                </p>
                <div className="dl8s-hero__actions">
                  <button type="button" className="dl8s-btn dl8s-btn--primary dl8s-btn--big" onClick={toggleFocus} aria-pressed={focus}>
                    <Icon name={focus ? 'compress' : 'expand'} size={17} /> {focus ? 'Exit focus mode' : 'Enter focus mode'}
                  </button>
                  <ExportPdf onExport={exportPdf} />
                  {resumeOpen && resumeIdx > 0 && (
                    <span className="dl8s-resume">
                      <button type="button" className="dl8s-btn dl8s-btn--big" onClick={() => { setResumeOpen(false); jumpTo(SECTIONS[resumeIdx].id); }}>
                        <Icon name="arrowDown" size={16} /> Resume at §{SECTIONS[resumeIdx].no} · {SECTIONS[resumeIdx].short}
                      </button>
                      <button type="button" className="dl8s-resume__x" onClick={() => setResumeOpen(false)} aria-label="Dismiss the resume suggestion">
                        dismiss
                      </button>
                    </span>
                  )}
                </div>
                <p className="dl8s-hero__stats">
                  <span><b>{WITH_PAGE.length}</b> notebook pages</span>
                  <span><b>{LAB_COUNT}</b> live labs</span>
                  <span><b>{TOTAL_LINES}</b> lines to copy</span>
                  <span>Esc leaves focus mode</span>
                </p>
              </div>

              {SECTIONS.map((s) => (
                <StudySection
                  key={s.id}
                  s={s}
                  sheetTicked={sheetTicks[s.id] || NONE}
                  onSheetToggle={toggleSheetTick}
                  onSheetSetAll={setAllSheetTicks}
                />
              ))}

              <footer className="dl8s-end">
                <p>
                  End of Lecture 8. Source: <em>CITS5017 Topic 8: Attention Mechanisms, Transformers, and Vision Transformers</em>,
                  A/Prof Du Huynh, UWA, Semester 2 2026 (51 slides). The toy vectors in the labs, the bus/rail models trained here (§3, §5)
                  and the toy transformer (§14) are this page’s own, not the slides’ figures.
                </p>
              </footer>
            </main>
          </div>
        </div>
      </RefsProvider>
    </StudyCtx.Provider>
  );
}
