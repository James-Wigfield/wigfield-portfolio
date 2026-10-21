import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Icon from '../../../icons';
import { RefsProvider } from '../kit';
import { SECTIONS } from './sections';
import { REFS } from './slideData';
import { load, save, loadTicks, loadSheetTicks } from './storage';
import { StudyCtx, useStudy } from './context';
import { Blocks } from './Rich';
import NotebookTabs from './NotebookTabs';
import NotebookLmPrompt from './NotebookLmPrompt';
import { SHEETS, sheetKeys } from './sheets';
import { prefersReducedMotion } from './hooks';
import { PRINT_CSS, PRINT_TITLE, addPrintTex, removePrintTex } from './print';
import { RoadmapLab, NeuronLab, LayerLab } from './labs/labsIntro';
import { DependencyLab, StateEqLab, ShapeLab } from './labs/labsMemory';
import { SeqModesLab, BpttLab } from './labs/labsSeq';
import { RidershipLab, WindowLab, RailWindowsLab } from './labs/labsSeries';
import { LinearLab, TanhCeilingLab, DeepStackLab, FeatureLab } from './labs/labsModels';
import { LoopLab, AheadSplitLab } from './labs/labsAhead';
import { GradientLab, NormAxisLab } from './labs/labsLong';
import { LstmCellLab, LstmMathLab, GruLab } from './labs/labsCells';
import { Conv1DLab, CnnGruLab } from './labs/labsConv1d';
import { Scoreboard, ScoreboardLab, OutcomesLab } from './labs/labsSummary';
import '../common.css';
import './lecture4-study.css';
import './sheet.css';

/* ============================================================================
   CITS5017 · LECTURE 4 (RNNs) — STUDY MODULE
   ----------------------------------------------------------------------------
   One continuous page, in slide order, built for working down it in focus
   mode: every section is Read → Play → Write, and the Write beat is a sheet of
   notebook paper to copy by hand — the student-notes page (./sheets, drawn by
   SheetPage.jsx) by default, the original fixed-order page behind a Legacy
   tab (NotebookTabs.jsx). A section counts as copied when either page is
   fully ticked; its progress is whichever page is further along.

     shell        sticky header (title · current section · progress · focus
                  toggle), a section index (rail when wide, dropdown when
                  narrow), "Resume at §N", scroll-spy
     focus mode   the Fullscreen API on this root (Reader.jsx pattern); the
                  root becomes its own scroll container with the theme's
                  ground behind it. Falls back to a fixed overlay when the API
                  is missing. Esc exits.
     export PDF   "Read + Play" only, through window.print(): print mode
                  (html.dl4s-printing + ./print.js mounted as a <style>,
                  labs in their finished state) on, focus mode off, print,
                  and everything put back on afterprint. The NotebookLM video
                  prompt sits under the button (./NotebookLmPrompt.jsx).
     persistence  ./storage.js — ticks, last section, outcomes, rail state
     content      ./sections.js (all prose, notes, formulas, questions)
     labs         ./labs/*.jsx  ·  diagrams ./diagrams.jsx
     maths        ./rnn.js  ·  slide facts ./slideData.js  ·  the CTA
                  ridership series ./data/ridership.js

   A copy of the Lecture 3 study shell (../lecture3-study/), adapted; the
   only addition is the validation-MAE scoreboard strip a section can show
   under its labs (`board: true` in sections.js).
   ========================================================================== */

const LABS = {
  roadmap: RoadmapLab,
  neuron: NeuronLab,
  layer: LayerLab,
  dependency: DependencyLab,
  stateEq: StateEqLab,
  shapes: ShapeLab,
  seqModes: SeqModesLab,
  bptt: BpttLab,
  ridership: RidershipLab,
  window: WindowLab,
  railWindows: RailWindowsLab,
  linear: LinearLab,
  tanhCeiling: TanhCeilingLab,
  deepStack: DeepStackLab,
  feature: FeatureLab,
  loop: LoopLab,
  aheadSplit: AheadSplitLab,
  gradient: GradientLab,
  normAxis: NormAxisLab,
  lstmCell: LstmCellLab,
  lstmMath: LstmMathLab,
  gru: GruLab,
  conv1d: Conv1DLab,
  cnnGru: CnnGruLab,
  scoreboard: ScoreboardLab,
  outcomes: OutcomesLab,
};

const domId = (id) => `dl4s-${id}`;
const lineCount = (s) => s.notes.reduce((a, g) => a + g.lines.length, 0);
const SHEET_KEYS = Object.fromEntries(SECTIONS.map((s) => [s.id, sheetKeys(SHEETS[s.id])]));
// what a section asks you to copy: its student-notes page (or, without one, its legacy lines)
const pageSize = (s) => SHEET_KEYS[s.id].length || lineCount(s);
const TOTAL_LINES = SECTIONS.reduce((a, s) => a + pageSize(s), 0);
const LAB_COUNT = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);
const WIDE_AT = 920;
const NONE = [];

// footnote numbers ([^n]) used in a section's Read blocks, in order
function footnotes(blocks) {
  const seen = [];
  const walk = (b) => {
    if (typeof b === 'string') {
      for (const m of b.matchAll(/\[\^(\d+)\]/g)) if (!seen.includes(Number(m[1]))) seen.push(Number(m[1]));
    } else if (Array.isArray(b)) b.forEach(walk);
    else if (b && typeof b === 'object') Object.values(b).forEach(walk);
  };
  walk(blocks);
  return seen;
}

// On screen a footnote is a hover popover; in the PDF its text prints under
// the Read beat.
function PrintRefs({ blocks }) {
  const { printing } = useStudy();
  if (!printing) return null;
  const ns = footnotes(blocks).filter((n) => REFS[n]);
  if (!ns.length) return null;
  return (
    <ol className="dl4s-printrefs">
      {ns.map((n) => <li key={n} value={n}>{REFS[n]}</li>)}
    </ol>
  );
}

function Beat({ n, icon, label, children }) {
  return (
    <div className={`dl4s-beat dl4s-beat--${label.toLowerCase()}`}>
      <p className="dl4s-beat__label">
        <span className="dl4s-beat__n">{n}</span>
        <Icon name={icon} size={14} />
        {label}
      </p>
      {children}
    </div>
  );
}

const StudySection = memo(function StudySection({ s, ticked, onToggle, onSetAll, sheetTicked, onSheetToggle, onSheetSetAll }) {
  return (
    <section className="dl4s-sec" id={domId(s.id)} aria-labelledby={`${domId(s.id)}-h`}>
      <header className="dl4s-sec__head">
        <span className="dl4s-sec__no">§{s.no}</span>
        <h2 className="dl4s-sec__title" id={`${domId(s.id)}-h`} tabIndex={-1}>{s.title}</h2>
        <span className="dl4s-receipt">{/[–,]/.test(s.slides) ? 'slides' : 'slide'} {s.slides}</span>
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dl4s-read">
          <Blocks blocks={s.read} />
          <PrintRefs blocks={s.read} />
        </div>
      </Beat>
      {s.play?.length > 0 && (
        <Beat n={2} icon="flask" label="Play">
          {s.play.map((key) => {
            const L = LABS[key];
            return L ? <L key={key} /> : null;
          })}
          {s.board && <Scoreboard upTo={s.id} />}
        </Beat>
      )}
      <Beat n={3} icon="edit" label="Write">
        <NotebookTabs
          section={s}
          sheet={SHEETS[s.id]}
          ticked={ticked}
          onToggle={(idx) => onToggle(s.id, idx)}
          onSetAll={(total, on) => onSetAll(s.id, total, on)}
          sheetTicked={sheetTicked}
          onSheetToggle={(key) => onSheetToggle(s.id, key)}
          onSheetSetAll={(keys, on) => onSheetSetAll(s.id, keys, on)}
        />
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
    const box = list?.closest('.dl4s-rail, .dl4s-drop');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop; // the rail / dropdown is the item's offsetParent
    const pad = 48;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current]);
  return (
    <nav className={`dl4s-index dl4s-index--${variant}`} aria-label="Sections of this lecture">
      <div className="dl4s-index__head">
        <span className="dl4s-index__title">Sections</span>
        <span className="dl4s-index__count">{stats.pages}/{SECTIONS.length} pages done</span>
        {onClose && (
          <button type="button" className="dl4s-index__close" onClick={onClose} aria-label="Hide the section index">
            <Icon name="chevron" size={14} className="dl4s-rot180" />
          </button>
        )}
      </div>
      <ol className="dl4s-index__list" ref={listRef}>
        {SECTIONS.map((s, i) => {
          const st = stats.per[s.id];
          const groupHead = s.group && SECTIONS[i - 1]?.group !== s.group ? s.group : null;
          return (
            <li key={s.id}>
              {groupHead && <span className="dl4s-index__group">§{s.no.split('.')[0]} {groupHead}</span>}
              <button
                type="button"
                className={`dl4s-index__item${i === current ? ' dl4s-index__item--on' : ''}${st?.complete ? ' dl4s-index__item--done' : ''}${s.group ? ' dl4s-index__item--sub' : ''}`}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(s.id)}
              >
                <span className="dl4s-index__no">{s.no}</span>
                <span className="dl4s-index__name">
                  {s.short}
                  <span className="dl4s-index__slides">{/[–,]/.test(s.slides) ? 'slides' : 'slide'} {s.slides}</span>
                </span>
                <span className="dl4s-index__state" aria-label={st?.complete ? 'notes finished' : `${st?.done ?? 0} of ${st?.total ?? 0} lines${st?.page === 'legacy' ? ' on the Legacy page' : ''}`}>
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

export default function Lecture4Study() {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const dropRef = useRef(null);

  const [ticks, setTicks] = useState(loadTicks);
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
  useEffect(() => { save('ticks', ticks); }, [ticks]);
  useEffect(() => { save('sheetTicks', sheetTicks); }, [sheetTicks]);
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

  // Per section, each page's own count; the section shows whichever page is
  // further along, and is done when either page is fully ticked.
  const stats = useMemo(() => {
    const per = {};
    let lines = 0;
    let pages = 0;
    let weighted = 0;
    SECTIONS.forEach((s) => {
      const lTotal = lineCount(s);
      const legacy = { done: (ticks[s.id] || []).filter((i) => i < lTotal).length, total: lTotal };
      const keys = SHEET_KEYS[s.id];
      const have = new Set(sheetTicks[s.id] || []);
      const sheet = { done: keys.filter((k) => have.has(k)).length, total: keys.length };
      const frac = (p) => (p.total ? p.done / p.total : 0);
      const complete = [legacy, sheet].some((p) => p.total > 0 && p.done === p.total);
      const best = frac(legacy) > frac(sheet) || !sheet.total ? 'legacy' : 'sheet';
      const shown = best === 'legacy' ? legacy : sheet;
      per[s.id] = { done: shown.done, total: shown.total, complete, page: best, frac: complete ? 1 : frac(shown), sheet, legacy };
      lines += shown.done;
      weighted += per[s.id].frac * pageSize(s);
      if (complete) pages += 1;
    });
    return { per, lines, pages, pct: Math.round((weighted / TOTAL_LINES) * 100) };
  }, [ticks, sheetTicks]);

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
    // land on the notebook's tab row, so the tabs stay in view
    const el = nb ? page?.closest('.dl4s-nbt') ?? page : document.getElementById(domId(id));
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
    const heading = nb ? el.querySelector('.dl4s-nb__title, .dl4s-sh__title') : el.querySelector('.dl4s-sec__title');
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
        document.documentElement.classList.remove('dl4s-pseudo-on');
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
    document.documentElement.classList.toggle('dl4s-pseudo-on', on);
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
  // it. While the overlay is up, html.dl4s-pseudo-on switches that off (and
  // stops the page behind scrolling); setPseudo toggles it, and this clears it
  // if the module unmounts mid-overlay. Real fullscreen uses the top layer.
  useEffect(() => () => document.documentElement.classList.remove('dl4s-pseudo-on'), []);

  // ── export PDF (Read + Play) ─────────────────────────────────────────────
  // Print mode = html.dl4s-printing + the PRINT_CSS <style> (rendered below
  // only while printing) + `printing` in the context, which labs read to
  // show their finished step without touching their own state. The button
  // leaves focus mode first; a plain Ctrl+P enters the same mode through
  // beforeprint. afterprint puts back the title, the class, the LaTeX lines,
  // focus mode (re-entered as the overlay if the browser refuses fullscreen
  // outside a click) and the scroll position.
  const printJob = useRef(null);
  const endPrint = useCallback(() => {
    const job = printJob.current;
    if (!job) return;
    printJob.current = null;
    removePrintTex(rootRef.current);
    document.documentElement.classList.remove('dl4s-printing');
    document.title = job.title;
    setPrinting(false);
    if (job.focus) {
      holdSection.current = job.section;
      toggleFocus();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: job.y, behavior: 'instant' })));
    }
  }, [toggleFocus]);

  const exportPdf = useCallback(async () => {
    if (printJob.current) return;
    const job = { title: document.title, focus: live.current.focus, section: live.current.current, y: window.scrollY, button: true };
    printJob.current = job;
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {});
    if (pseudoFsRef.current) setPseudo(false);
    document.documentElement.classList.add('dl4s-printing');
    setPrinting(true);
  }, [setPseudo]);

  // the button's print: once print mode has rendered, fonts and KaTeX settled
  useEffect(() => {
    if (!printing || !printJob.current?.button) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* no font loading API — print anyway */
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled || !printJob.current) return;
      addPrintTex(rootRef.current);
      document.title = PRINT_TITLE;
      window.print();
    })();
    return () => { cancelled = true; };
  }, [printing]);

  useEffect(() => {
    const before = () => {
      if (printJob.current) return; // the button's own print
      printJob.current = { title: document.title, focus: false, section: live.current.current, y: window.scrollY, button: false };
      document.documentElement.classList.add('dl4s-printing');
      flushSync(() => setPrinting(true));
      addPrintTex(rootRef.current);
      document.title = PRINT_TITLE;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', endPrint);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', endPrint);
    };
  }, [endPrint]);

  // leaving the module mid-print must not leave the page in print mode
  useEffect(() => () => {
    if (printJob.current) document.title = printJob.current.title;
    document.documentElement.classList.remove('dl4s-printing');
  }, []);

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
        <div
          ref={rootRef}
          tabIndex={-1}
          className={`dl dl4s${focus ? ' dl4s--focus' : ''}${pseudoFs ? ' dl4s--pseudo' : ''}`}
          style={{ '--dl4s-stick': `${focus ? 0 : stick}px` }}
        >
          {printing && <style>{PRINT_CSS}</style>}
          {/* ── sticky header ─────────────────────────────────────────── */}
          <header ref={barRef} className="dl4s-bar">
            <div className="dl4s-bar__title">
              <span className="dl4s-bar__kicker">CITS5017 · Lecture 4</span>
              <span className="dl4s-bar__name">RNNs — study module</span>
            </div>
            <div className="dl4s-bar__now" aria-live="polite">
              <span className="dl4s-bar__nowno">§{cur.no}</span>
              <span className="dl4s-bar__nowname">{cur.title}</span>
            </div>
            <div className="dl4s-bar__prog" title={`${pct}% of the notebook copied (each section counts its student-notes or Legacy page, whichever is further along)`}>
              <span className="dl4s-bar__progtext">
                <b>{pct}%</b> copied · <b>{stats.pages}</b>/{SECTIONS.length} pages
              </span>
              <span className="dl4s-bar__track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            </div>
            <div className="dl4s-bar__actions" ref={dropRef}>
              {wide ? (
                !railOpen && (
                  <button type="button" className="dl4s-btn" onClick={() => setRailOpen(true)} aria-label="Show the section index">
                    <Icon name="list" size={15} /> <span className="dl4s-btn__txt">Index</span>
                  </button>
                )
              ) : (
                <button type="button" className="dl4s-btn" aria-expanded={dropOpen} onClick={() => setDropOpen((o) => !o)}>
                  <Icon name="list" size={15} /> <span className="dl4s-btn__txt">Sections</span>
                </button>
              )}
              <button type="button" className="dl4s-btn dl4s-btn--primary" onClick={toggleFocus} aria-pressed={focus}>
                <Icon name={focus ? 'compress' : 'expand'} size={15} />
                <span className="dl4s-btn__txt">{focus ? 'Exit focus mode' : 'Enter focus mode'}</span>
              </button>
              {!wide && dropOpen && (
                <div className="dl4s-drop">
                  <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="drop" />
                </div>
              )}
            </div>
          </header>

          <div className={`dl4s-layout${showRail ? ' dl4s-layout--rail' : ''}`}>
            {showRail && (
              <aside className="dl4s-rail">
                <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="rail" onClose={() => setRailOpen(false)} />
              </aside>
            )}

            <main className="dl4s-flow">
              {/* ── module title block ──────────────────────────────── */}
              <div className="dl4s-hero">
                <p className="dl4s-hero__kicker">CITS5017 Deep Learning · Topic 4 · Chapter 15 · slides 1–52</p>
                <h1 className="dl4s-hero__title">Processing Sequences Using RNNs and CNNs</h1>
                <p className="dl4s-hero__lead">
                  One page, in slide order. Each section: read a short explanation, play with a live lab until it clicks, then copy
                  its notebook page onto paper and tick the lines off.
                </p>
                {printing && (
                  <p className="dl4s-print-note">
                    This PDF holds the Read and Play parts of all 18 sections, in slide order; the notebook pages are left out. Each lab is
                    printed in its finished state, with the values of its controls written out; each equation is followed by its LaTeX source.
                  </p>
                )}
                <div className="dl4s-hero__actions">
                  <button type="button" className="dl4s-btn dl4s-btn--primary dl4s-btn--big" onClick={toggleFocus} aria-pressed={focus}>
                    <Icon name={focus ? 'compress' : 'expand'} size={17} /> {focus ? 'Exit focus mode' : 'Enter focus mode'}
                  </button>
                  <button type="button" className="dl4s-btn dl4s-btn--big dl4s-export__btn" onClick={exportPdf} disabled={printing}>
                    <Icon name="download" size={16} /> Export PDF
                  </button>
                  {resumeOpen && resumeIdx > 0 && (
                    <span className="dl4s-resume">
                      <button type="button" className="dl4s-btn dl4s-btn--big" onClick={() => { setResumeOpen(false); jumpTo(SECTIONS[resumeIdx].id); }}>
                        <Icon name="arrowDown" size={16} /> Resume at §{SECTIONS[resumeIdx].no} · {SECTIONS[resumeIdx].short}
                      </button>
                      <button type="button" className="dl4s-resume__x" onClick={() => setResumeOpen(false)} aria-label="Dismiss the resume suggestion">
                        dismiss
                      </button>
                    </span>
                  )}
                </div>
                <NotebookLmPrompt />
                <p className="dl4s-hero__stats">
                  <span><b>{SECTIONS.length}</b> notebook pages</span>
                  <span><b>{LAB_COUNT}</b> live labs</span>
                  <span><b>{TOTAL_LINES}</b> lines to copy</span>
                  <span>Esc leaves focus mode</span>
                </p>
              </div>

              {SECTIONS.map((s) => (
                <StudySection
                  key={s.id}
                  s={s}
                  ticked={ticks[s.id] || NONE}
                  onToggle={toggleTick}
                  onSetAll={setAllTicks}
                  sheetTicked={sheetTicks[s.id] || NONE}
                  onSheetToggle={toggleSheetTick}
                  onSheetSetAll={setAllSheetTicks}
                />
              ))}

              <footer className="dl4s-end">
                <p>
                  End of Lecture 4. Source: <em>CITS5017 Topic 4: Processing Sequences Using RNNs and CNNs</em>, A/Prof Du Huynh, UWA,
                  Semester 2 2026 (52 slides). Ridership data: the CTA daily boardings from the slide-15 download, processed as slide 15
                  does.
                </p>
              </footer>
            </main>
          </div>
        </div>
      </RefsProvider>
    </StudyCtx.Provider>
  );
}
