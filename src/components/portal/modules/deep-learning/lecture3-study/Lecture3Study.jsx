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
import NotebookLmPrompt from './NotebookLmPrompt';
import { PRINT_CSS } from './print';
import { PDF_TITLE } from './exportPrompt';
import { annotateMath } from './texPlain';
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
     progress     counts the core sections only: the optional §12.1–12.3
                  deep dives can be ticked but never hold the bar back
     export       Export PDF = print mode (html.dl3s-printing, ./print.js)
                  + window.print(): Read and Play beats only, real text for
                  NotebookLM; the prompt to paste there is ./exportPrompt.js

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
const CORE = SECTIONS.filter((s) => !s.optional);
const OPTIONAL_COUNT = SECTIONS.length - CORE.length;
const TOTAL_LINES = CORE.reduce((a, s) => a + lineCount(s), 0);
const LAB_COUNT = new Set(SECTIONS.flatMap((s) => s.play ?? [])).size;
const WIDE_AT = 920;
const NONE = [];

// The footnote numbers a section's Read beat cites, in order (printed under
// the section, since the hover popovers can't be read on paper).
const FN_RE = /\[\^(\d+)\]/g;
function footnotes(blocks, out = []) {
  const scan = (t) => {
    for (const m of String(t).matchAll(FN_RE)) if (!out.includes(Number(m[1]))) out.push(Number(m[1]));
  };
  blocks.forEach((b) => {
    if (typeof b === 'string') scan(b);
    else if (b.list) b.list.forEach(scan);
    else if (b.note) scan(b.note);
    else if (b.slideNote) scan(b.slideNote);
    else if (b.dd) scan(b.dd);
    else if (b.unfold) footnotes(b.unfold.blocks, out);
  });
  return out;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const slideWord = (range) => (/[–,-]/.test(range) ? 'slides' : 'slide');

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
  const fns = useMemo(() => footnotes(s.read), [s.read]);
  return (
    <section className={`dl3s-sec${s.optional ? ' dl3s-sec--opt' : ''}`} id={domId(s.id)} aria-labelledby={`${domId(s.id)}-h`}>
      <header className="dl3s-sec__head">
        <span className="dl3s-sec__no">§{s.no}</span>
        <h2 className="dl3s-sec__title" id={`${domId(s.id)}-h`} tabIndex={-1}>{s.title}</h2>
        {s.optional && <span className="dl3s-sec__opt">optional deep dive</span>}
        <span className="dl3s-receipt">{slideWord(s.slides)} {s.slides}</span>
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dl3s-read">
          <Blocks blocks={s.read} />
          {fns.length > 0 && (
            <ol className="dl3s-fns" aria-label="Footnotes">
              {fns.map((n) => <li key={n} value={n}>{REFS[n]}</li>)}
            </ol>
          )}
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
        <span className="dl3s-index__count">{stats.pages}/{CORE.length} pages done</span>
        {onClose && (
          <button type="button" className="dl3s-index__close" onClick={onClose} aria-label="Hide the section index">
            <Icon name="chevron" size={14} className="dl3s-rot180" />
          </button>
        )}
      </div>
      <ol className="dl3s-index__list" ref={listRef}>
        {SECTIONS.map((s, i) => {
          const st = stats.per[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`dl3s-index__item${i === current ? ' dl3s-index__item--on' : ''}${st?.complete ? ' dl3s-index__item--done' : ''}${s.parent ? ' dl3s-index__item--sub' : ''}`}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(s.id)}
              >
                <span className="dl3s-index__no">{s.no}</span>
                <span className="dl3s-index__name">
                  {s.short}
                  <span className="dl3s-index__slides">
                    {slideWord(s.slides)} {s.slides}
                    {s.optional && <span className="dl3s-index__opt"> · optional</span>}
                  </span>
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
  const [withDeep, setWithDeep] = useState(false);
  const [nlmOpen, setNlmOpen] = useState(false);

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

  // Every section reports its own ticks; the totals count core sections only.
  const stats = useMemo(() => {
    const per = {};
    let lines = 0;
    let pages = 0;
    SECTIONS.forEach((s) => {
      const total = lineCount(s);
      const done = (ticks[s.id] || []).filter((i) => i < total).length;
      const complete = total > 0 && done === total;
      per[s.id] = { done, total, complete };
      if (s.optional) return;
      lines += done;
      if (complete) pages += 1;
    });
    return { per, lines, pages, core: CORE.length };
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

  // ── Export PDF: print mode + the browser's own "Save as PDF" ─────────────
  // html.dl3s-printing switches on ./print.js (Read + Play only, a paper
  // palette); html.dl3s-print-dd adds the §12.1–12.3 deep dives. The button
  // leaves focus mode first and puts it back once printing is over (the
  // overlay if fullscreen is refused without a click). Ctrl+P on this page
  // reaches the same print mode through beforeprint.
  const printState = useRef({ on: false, title: '', refocus: null });
  const deepRef = useRef(withDeep);
  useEffect(() => { deepRef.current = withDeep; }, [withDeep]);

  const enterPrint = useCallback(() => {
    const p = printState.current;
    if (p.on) return;
    p.on = true;
    p.title = document.title;
    annotateMath(rootRef.current);
    document.documentElement.classList.add('dl3s-printing');
    document.documentElement.classList.toggle('dl3s-print-dd', deepRef.current);
    document.title = PDF_TITLE;
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const leave = (refocus) => {
      const p = printState.current;
      if (!p.on) return;
      p.on = false;
      document.title = p.title;
      html.classList.remove('dl3s-printing', 'dl3s-print-dd');
      const again = p.refocus;
      p.refocus = null;
      if (refocus && again) again();
    };
    const onAfter = () => leave(true);
    window.addEventListener('beforeprint', enterPrint);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', enterPrint);
      window.removeEventListener('afterprint', onAfter);
      leave(false);
    };
  }, [enterPrint]);

  const leaveFocus = useCallback(() => new Promise((resolve) => {
    if (document.fullscreenElement && document.fullscreenElement === rootRef.current) {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener('fullscreenchange', finish);
        resolve();
      };
      document.addEventListener('fullscreenchange', finish);
      setTimeout(finish, 1500);
      document.exitFullscreen().catch(finish);
      return;
    }
    if (pseudoFsRef.current) setPseudo(false);
    resolve();
  }), [setPseudo]);

  const exportPdf = useCallback(async () => {
    const wasFocus = live.current.focus;
    const wasPseudo = pseudoFsRef.current;
    if (wasFocus) await leaveFocus();
    enterPrint();
    printState.current.refocus = wasFocus ? () => (wasPseudo ? setPseudo(true) : toggleFocus()) : null;
    try {
      await document.fonts?.ready;
    } catch {
      /* no font loading API — print anyway */
    }
    // let React drop the focus-mode classes and KaTeX settle before the snapshot
    await nextFrame();
    await nextFrame();
    window.print();
  }, [leaveFocus, enterPrint, setPseudo, toggleFocus]);

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
          <style>{PRINT_CSS}</style>
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
            <div className="dl3s-bar__prog" title={`${stats.lines} of ${TOTAL_LINES} notebook lines copied (the optional §12.1–12.3 deep dives aren’t counted)`}>
              <span className="dl3s-bar__progtext">
                <b>{stats.lines}</b>/{TOTAL_LINES} lines · <b>{stats.pages}</b>/{CORE.length} pages
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
                <div className="dl3s-printonly dl3s-cover">
                  <p>
                    <b>Read + Play edition.</b> Every section of the CITS5017 Lecture 3 study page in slide order: its explanation (Read) and
                    its interactive lab, shown in the lab’s default state (Play). The notebook pages (Write) are left out. “Try this” lines say
                    what each lab is for on screen; the labs compute their numbers live from the slides’ formulas, mostly on the slides’ own
                    examples. “Slide check” notes mark places where the slides disagree with themselves.
                  </p>
                  <p className="dl3s-print-dd-off">
                    §12 summarises the classic architectures of slides 36–47; its three in-depth sections, §12.1–12.3, are left out of this PDF.
                  </p>
                  <p className="dl3s-print-dd-on">
                    §12 summarises the classic architectures of slides 36–47; §12.1–12.3 then cover them in depth.
                  </p>
                </div>
                <div className="dl3s-hero__actions">
                  <button type="button" className="dl3s-btn dl3s-btn--primary dl3s-btn--big" onClick={toggleFocus} aria-pressed={focus}>
                    <Icon name={focus ? 'compress' : 'expand'} size={17} /> {focus ? 'Exit focus mode' : 'Enter focus mode'}
                  </button>
                  <div className="dl3s-export">
                    <div className="dl3s-export__row">
                      <button
                        type="button"
                        className="dl3s-btn dl3s-btn--big"
                        onClick={exportPdf}
                        title="Print the Read and Play parts of every section to an A4 PDF (choose “Save as PDF”); the notebook pages are left out"
                      >
                        <Icon name="download" size={16} /> Export PDF
                      </button>
                      <label className="dl-check dl3s-export__opt">
                        <input type="checkbox" checked={withDeep} onChange={(e) => setWithDeep(e.target.checked)} />
                        include §12.1–12.3 deep dives
                      </label>
                    </div>
                    <button
                      type="button"
                      className="dl3s-export__nlm"
                      aria-expanded={nlmOpen}
                      aria-controls="dl3s-nlm"
                      onClick={() => setNlmOpen((o) => !o)}
                    >
                      NotebookLM video prompt
                      <Icon name="chevron" size={13} className={`dl3s-export__chev${nlmOpen ? ' dl3s-export__chev--open' : ''}`} />
                    </button>
                  </div>
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
                {nlmOpen && <NotebookLmPrompt id="dl3s-nlm" />}
                <p className="dl3s-hero__stats">
                  <span><b>{CORE.length}</b> notebook pages</span>
                  <span><b>{OPTIONAL_COUNT}</b> optional deep dives</span>
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
