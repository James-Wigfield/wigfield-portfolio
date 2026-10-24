import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../icons';
import { RefsProvider } from '../kit';
import { SECTIONS, PAGES, LECTURES, FLOW } from './sections';
import { REFS } from './slideData';
import { load, save, loadSheetTicks } from './storage';
import { StudyCtx } from './context';
import { Blocks, Rich } from './Rich';
import SheetPage from './SheetPage';
import { SHEETS, sheetKeys } from './sheets';
import { prefersReducedMotion } from './hooks';
import { PRINT_CSS, preparePrint } from './print';
import ExportPdf from './ExportPdf';
import LecMark from './LecMark';
import { receipt, RULE_BUDGET } from './lec';
import { LABS } from './labs';
import '../common.css';
import './lectures1-2-refresher.css';
import './stage.css';
import './sheet.css';

/* ============================================================================
   CITS5017 · LECTURES 1–2 REFRESHER (INTRO TO ANNs + TRAINING DNNs)
   ----------------------------------------------------------------------------
   One continuous page for a student who has already studied both lectures:
   Part 1 = Lecture 1 (§1.0–§1.8), Part 2 = Lecture 2 (§2.0–§2.9). Each
   section is a short Read (a bold gist + a few bullets) and usually one Play
   lab. The Write beat is not per section: there are exactly three notebook
   pages, each placed after the group of sections it covers (./sections.js
   PAGES), each sized to one real ruled page (≤ 30 rules at a 760 px sheet).

     shell        sticky header (title · current stop + its lecture · progress
                  · focus toggle), the index (rail when wide, dropdown when
                  narrow) grouped by lecture with the three pages as their own
                  items, "Resume at …", scroll-spy over FLOW (sections and
                  pages in page order)
     lectures     every section header, rail item, lab receipt, notebook
                  block and PDF heading names its lecture: an outlined L1/L2
                  mark (./LecMark.jsx) and "L1 · slides 9–17" receipts
     focus mode   the Fullscreen API on this root, with a fixed-overlay
                  fallback; Esc exits
     page fit     a hidden copy of each notebook page laid out at 760 px
                  counts its rules (SheetPage `measure`), shown as "fits one
                  page · n of 30 rules"
     export       Export PDF prints Read + Play only (./print.js); the
                  NotebookLM prompts sit under the button (./exportPrompt.js)
     persistence  ./storage.js (dl12r:) — sheet ticks per page, last stop, rail
     content      ./sections.js · ./sheets (p1–p3) · ./slideData.js · ./nn.js
     labs         ./labs (registry ./labs/index.js) in the Lecture 8 lab kit:
                  ./stage.jsx + ./story.js + ./svgParts.jsx + ./stage.css

   A copy of the Lecture 8 study shell (../lecture8-study/), adapted.
   ========================================================================== */

const domId = (id) => `dl12r-${id}`;
const PAGE_KEYS = Object.fromEntries(PAGES.map((p) => [p.id, sheetKeys(SHEETS[p.id])]));
const TOTAL_LINES = PAGES.reduce((a, p) => a + PAGE_KEYS[p.id].length, 0);
const LAB_COUNT = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);
const STOPS = FLOW; // [{ kind: 'sec' | 'page', id, item }]
const STOP_IDX = Object.fromEntries(STOPS.map((st, i) => [st.id, i]));
const WIDE_AT = 920;
const NONE = [];

function Beat({ n, icon, label, children }) {
  return (
    <div className={`dl12r-beat dl12r-beat--${label.toLowerCase()}`}>
      <p className="dl12r-beat__label">
        <span className="dl12r-beat__n">{n}</span>
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
    <ol className="dl12r-printfn" aria-hidden="true">
      {ns.map((n) => <li key={n} value={n}><Rich text={REFS[n] ?? ''} /></li>)}
    </ol>
  );
}

// A quiet link to the full interactive lecture module.
function GoDeeper({ s }) {
  const L = LECTURES[s.lec];
  return (
    <p className="dl12r-deeper">
      <span className="dl12r-deeper__k">Go deeper</span>
      <Rich text={`[${L.deepLabel}](${L.deepTo}) — the full interactive Lecture ${s.lec} module`} />
    </p>
  );
}

const StudySection = memo(function StudySection({ s }) {
  return (
    <section className={`dl12r-sec dl12r-sec--l${s.lec}`} id={domId(s.id)} aria-labelledby={`${domId(s.id)}-h`}>
      <header className="dl12r-sec__head">
        <span className="dl12r-sec__no">§{s.no}</span>
        <h2 className="dl12r-sec__title" id={`${domId(s.id)}-h`} tabIndex={-1}>{s.title}</h2>
        <span className="dl12r-receipt"><LecMark lec={s.lec} /> · {receipt(s.slides)}</span>
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dl12r-read">
          <Blocks blocks={s.read} />
          <PrintFootnotes blocks={s.read} />
          {s.deeper !== false && <GoDeeper s={s} />}
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
    </section>
  );
});

// One of the three notebook pages, after the sections it covers. A hidden
// copy laid out at the 760 px reference width counts its rules.
const NotebookSection = memo(function NotebookSection({ p, ticked, onToggle, onSetAll }) {
  const [rules, setRules] = useState(null);
  const sheet = SHEETS[p.id];
  const fits = rules !== null && rules <= RULE_BUDGET;
  return (
    <section className={`dl12r-nbsec dl12r-nbsec--l${p.lec}`} id={domId(p.id)} aria-labelledby={`${domId(p.id)}-h`}>
      <header className="dl12r-nbsec__head">
        <span className="dl12r-nbsec__k"><Icon name="edit" size={14} /> Write</span>
        <h2 className="dl12r-nbsec__title" id={`${domId(p.id)}-h`} tabIndex={-1}>{p.title}</h2>
        <span className="dl12r-receipt"><LecMark lec={p.lec} /> · covers {p.covers}</span>
      </header>
      <p className="dl12r-nbsec__lead">
        <Rich text={p.lead} />{' '}
        <span className={`dl12r-fit${fits ? ' dl12r-fit--ok' : rules !== null ? ' dl12r-fit--over' : ''}`} data-rules={rules ?? ''}>
          {rules === null ? 'measuring…' : fits ? `fits one page · ${rules} of ${RULE_BUDGET} rules` : `${rules} rules: over one page (${RULE_BUDGET})`}
        </span>
      </p>
      <SheetPage page={p} sheet={sheet} ticked={ticked} onToggle={(key) => onToggle(p.id, key)} onSetAll={(keys, on) => onSetAll(p.id, keys, on)} />
      <div className="dl12r-measure" aria-hidden="true" inert>
        <div className="dl12r-measure__box">
          <SheetPage page={p} sheet={sheet} ticked={NONE} measure onRules={setRules} />
        </div>
      </div>
    </section>
  );
});

function PartHead({ lec }) {
  const L = LECTURES[lec];
  return (
    <div className={`dl12r-part dl12r-part--l${lec}`} id={domId(`part${lec}`)}>
      <p className="dl12r-part__k"><LecMark lec={lec} /> Part {lec} · {L.slidesTotal} slides · {L.chapter}</p>
      <h2 className="dl12r-part__title">Lecture {lec} · {L.title}</h2>
    </div>
  );
}

function SectionIndex({ current, stats, onJump, variant, onClose }) {
  const listRef = useRef(null);
  // Keep the current item visible inside the rail's own scroller (never
  // scrolls the page itself).
  useEffect(() => {
    const list = listRef.current;
    const box = list?.closest('.dl12r-rail, .dl12r-drop');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop;
    const pad = 48;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current]);
  const groups = [1, 2].map((lec) => ({ lec, stops: STOPS.map((st, i) => ({ ...st, i })).filter((st) => st.item.lec === lec) }));
  return (
    <nav className={`dl12r-index dl12r-index--${variant}`} aria-label="Sections and notebook pages">
      <div className="dl12r-index__head">
        <span className="dl12r-index__title">Contents</span>
        <span className="dl12r-index__count">{stats.pages}/{PAGES.length} pages copied</span>
        {onClose && (
          <button type="button" className="dl12r-index__close" onClick={onClose} aria-label="Hide the index">
            <Icon name="chevron" size={14} className="dl12r-rot180" />
          </button>
        )}
      </div>
      <ol className="dl12r-index__list" ref={listRef}>
        {groups.map((g) => (
          <li key={g.lec} className={`dl12r-index__grp dl12r-index__grp--l${g.lec}`}>
            <span className="dl12r-index__group"><LecMark lec={g.lec} /> Lecture {g.lec} · {LECTURES[g.lec].short}</span>
            <ol className="dl12r-index__sub">
              {g.stops.map((st) => {
                const on = st.i === current;
                if (st.kind === 'page') {
                  const ps = stats.per[st.id];
                  return (
                    <li key={st.id}>
                      <button
                        type="button"
                        className={`dl12r-index__item dl12r-index__item--page${on ? ' dl12r-index__item--on' : ''}${ps?.complete ? ' dl12r-index__item--done' : ''}`}
                        aria-current={on ? 'location' : undefined}
                        onClick={() => onJump(st.id)}
                      >
                        <span className="dl12r-index__no"><Icon name="edit" size={12} /></span>
                        <span className="dl12r-index__name">
                          {st.item.railName}
                          <span className="dl12r-index__slides">covers {st.item.covers}</span>
                        </span>
                        <span className="dl12r-index__state" aria-label={ps?.complete ? 'page copied' : `${ps?.done ?? 0} of ${ps?.total ?? 0} lines copied`}>
                          {ps?.complete ? <Icon name="check" size={13} strokeWidth={2.2} /> : `${ps?.done ?? 0}/${ps?.total ?? 0}`}
                        </span>
                      </button>
                    </li>
                  );
                }
                const s = st.item;
                return (
                  <li key={st.id}>
                    <button
                      type="button"
                      className={`dl12r-index__item${on ? ' dl12r-index__item--on' : ''}`}
                      aria-current={on ? 'location' : undefined}
                      onClick={() => onJump(st.id)}
                    >
                      <span className="dl12r-index__no">{s.no}</span>
                      <span className="dl12r-index__name">
                        {s.short}
                        <span className="dl12r-index__slides">L{s.lec} · {receipt(s.slides)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function Lectures12Refresher() {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const dropRef = useRef(null);

  const [sheetTicks, setSheetTicks] = useState(loadSheetTicks);
  const [railOpen, setRailOpen] = useState(() => load('rail', true) !== false);
  const [dropOpen, setDropOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [resumeIdx] = useState(() => {
    const i = STOP_IDX[load('last', null)] ?? -1;
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
  const holdStop = useRef(null);
  const live = useRef({});
  useEffect(() => {
    live.current = { current, focus, resumeIdx };
  });
  const userScrolled = useRef(false);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => { save('sheetTicks', sheetTicks); }, [sheetTicks]);
  useEffect(() => { save('rail', railOpen); }, [railOpen]);
  useEffect(() => {
    if (userScrolled.current) save('last', STOPS[current].id);
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

  // Per notebook page: lines copied. Each page counts once towards "pages".
  const stats = useMemo(() => {
    const per = {};
    let lines = 0;
    let pages = 0;
    PAGES.forEach((p) => {
      const keys = PAGE_KEYS[p.id];
      const have = new Set(sheetTicks[p.id] || []);
      const done = keys.filter((k) => have.has(k)).length;
      const complete = keys.length > 0 && done === keys.length;
      per[p.id] = { done, total: keys.length, complete };
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

  const barBottom = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return 0;
    const top = parseFloat(getComputedStyle(bar).top) || 0;
    if (live.current.focus) return top + bar.offsetHeight;
    const topbar = rootRef.current?.closest('.portal')?.querySelector('.portal__topbar');
    return Math.max(top, (topbar?.offsetHeight ?? 0) + 5) + bar.offsetHeight;
  }, []);

  const jumpTo = useCallback((id, { smooth = true } = {}) => {
    const el = document.getElementById(domId(id));
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
    el.querySelector('.dl12r-sec__title, .dl12r-nbsec__title')?.focus?.({ preventScroll: true });
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
      for (let i = 0; i < STOPS.length; i++) {
        const el = document.getElementById(domId(STOPS[i].id));
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      const sc = box ?? document.scrollingElement;
      if (sc && sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) idx = STOPS.length - 1;
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
  // land back on the stop you were reading; the jump is retried for a few
  // frames until the layout settles.
  const restore = useCallback(() => {
    if (holdStop.current === null) holdStop.current = live.current.current;
    let tries = 0;
    const attempt = () => {
      const i = holdStop.current ?? 0;
      jumpTo(STOPS[i].id, { smooth: false });
      const el = document.getElementById(domId(STOPS[i].id));
      const want = barBottom() + 14;
      const got = el ? el.getBoundingClientRect().top : want;
      if (Math.abs(got - want) > 24 && tries < 10) {
        tries += 1;
        requestAnimationFrame(attempt);
      } else {
        holdStop.current = null;
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(attempt));
  }, [jumpTo, barBottom]);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === rootRef.current;
      if (on && pseudoFsRef.current) {
        pseudoFsRef.current = false;
        document.documentElement.classList.remove('dl12r-pseudo-on');
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
    document.documentElement.classList.toggle('dl12r-pseudo-on', on);
    setPseudoFs(on);
    restore();
  }, [restore]);

  const toggleFocus = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    holdStop.current = live.current.current;
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
    const fallback = setTimeout(() => {
      if (!settled && !document.fullscreenElement) setPseudo(true);
    }, 1000);
    el.requestFullscreen()
      .then(() => el.focus?.({ preventScroll: true }))
      .catch(() => { if (!pseudoFsRef.current) setPseudo(true); })
      .finally(() => { settled = true; clearTimeout(fallback); });
  }, [setPseudo]);

  // The overlay fallback is position: fixed, but the portal's content wrapper
  // keeps a filled fade-in transform; html.dl12r-pseudo-on switches it off.
  useEffect(() => () => document.documentElement.classList.remove('dl12r-pseudo-on', 'dl12r-printing'), []);

  // ── Export PDF ───────────────────────────────────────────────────────────
  const exportPdf = useCallback(async () => {
    const wasFs = !!document.fullscreenElement;
    const wasPseudo = pseudoFsRef.current;
    if (wasFs) await document.exitFullscreen?.().catch(() => {});
    if (wasPseudo) setPseudo(false);
    const prevTitle = document.title;
    document.documentElement.classList.add('dl12r-printing');
    setPrinting(true);
    await preparePrint();
    document.title = 'CITS5017 L1–L2 Refresher — Read + Play';
    const after = () => {
      window.removeEventListener('afterprint', after);
      document.title = prevTitle;
      document.documentElement.classList.remove('dl12r-printing');
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dropOpen) setDropOpen(false);
      else if (pseudoFsRef.current) setPseudo(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dropOpen, setPseudo]);

  useEffect(() => {
    if (!dropOpen) return undefined;
    const onDown = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [dropOpen]);

  const ctx = useMemo(() => ({ stats, jumpTo, printing }), [stats, jumpTo, printing]);
  const cur = STOPS[current];
  const curNo = cur.kind === 'sec' ? `§${cur.item.no}` : `P${cur.item.no}`;
  const showRail = wide && railOpen;
  const pct = stats.pct;
  const resume = resumeIdx > 0 ? STOPS[resumeIdx] : null;

  return (
    <StudyCtx.Provider value={ctx}>
      <RefsProvider refs={REFS}>
        <style>{PRINT_CSS}</style>
        <div
          ref={rootRef}
          tabIndex={-1}
          className={`dl dl12r${focus ? ' dl12r--focus' : ''}${pseudoFs ? ' dl12r--pseudo' : ''}`}
          style={{ '--dl12r-stick': `${focus ? 0 : stick}px` }}
        >
          {/* ── sticky header ─────────────────────────────────────────── */}
          <header ref={barRef} className="dl12r-bar">
            <div className="dl12r-bar__title">
              <span className="dl12r-bar__kicker">CITS5017 · Lectures 1–2</span>
              <span className="dl12r-bar__name">Refresher — study module</span>
            </div>
            <div className="dl12r-bar__now" aria-live="polite">
              <LecMark lec={cur.item.lec} />
              <span className="dl12r-bar__nowno">{curNo}</span>
              <span className="dl12r-bar__nowname">{cur.item.title}</span>
            </div>
            <div className="dl12r-bar__prog" title={`${pct}% of the notebook copied`}>
              <span className="dl12r-bar__progtext">
                <b>{pct}%</b> copied · <b>{stats.pages}</b>/{PAGES.length} pages
              </span>
              <span className="dl12r-bar__track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            </div>
            <div className="dl12r-bar__actions" ref={dropRef}>
              {wide ? (
                !railOpen && (
                  <button type="button" className="dl12r-btn" onClick={() => setRailOpen(true)} aria-label="Show the index">
                    <Icon name="list" size={15} /> <span className="dl12r-btn__txt">Index</span>
                  </button>
                )
              ) : (
                <button type="button" className="dl12r-btn" aria-expanded={dropOpen} onClick={() => setDropOpen((o) => !o)}>
                  <Icon name="list" size={15} /> <span className="dl12r-btn__txt">Contents</span>
                </button>
              )}
              <button type="button" className="dl12r-btn dl12r-btn--primary" onClick={toggleFocus} aria-pressed={focus}>
                <Icon name={focus ? 'compress' : 'expand'} size={15} />
                <span className="dl12r-btn__txt">{focus ? 'Exit focus mode' : 'Enter focus mode'}</span>
              </button>
              {!wide && dropOpen && (
                <div className="dl12r-drop">
                  <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="drop" />
                </div>
              )}
            </div>
          </header>

          <div className={`dl12r-layout${showRail ? ' dl12r-layout--rail' : ''}`}>
            {showRail && (
              <aside className="dl12r-rail">
                <SectionIndex current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="rail" onClose={() => setRailOpen(false)} />
              </aside>
            )}

            <main className="dl12r-flow">
              {/* ── module title block ──────────────────────────────── */}
              <div className="dl12r-hero">
                <p className="dl12r-hero__kicker">CITS5017 Deep Learning · Topics 1–2 · Géron Chapters 10–11 · L1 slides 1–64 · L2 slides 1–68</p>
                <h1 className="dl12r-hero__title">Lectures 1–2 Refresher: Intro to ANNs and Training Deep Neural Networks</h1>
                <p className="dl12r-hero__lead">
                  A fast recap for after you’ve studied both lectures. Every section opens with the one thing to remember, then a few
                  lines and a quick lab. All the note-taking is three notebook pages, each sized to one real page.
                </p>
                <p className="dl12r-hero__printlead">
                  The Read and Play parts of a refresher for CITS5017 Lecture 1 (Introduction to Artificial Neural Networks, 64 slides)
                  and Lecture 2 (Training Deep Neural Networks, 68 slides), in slide order. Every heading names its lecture (L1 or L2) and
                  slides. Numbers marked “this page’s own” were made by the study page (toy problems), not printed on the slides.
                </p>
                <div className="dl12r-hero__actions">
                  <button type="button" className="dl12r-btn dl12r-btn--primary dl12r-btn--big" onClick={toggleFocus} aria-pressed={focus}>
                    <Icon name={focus ? 'compress' : 'expand'} size={17} /> {focus ? 'Exit focus mode' : 'Enter focus mode'}
                  </button>
                  <ExportPdf onExport={exportPdf} />
                  {resumeOpen && resume && (
                    <span className="dl12r-resume">
                      <button type="button" className="dl12r-btn dl12r-btn--big" onClick={() => { setResumeOpen(false); jumpTo(resume.id); }}>
                        <Icon name="arrowDown" size={16} /> Resume at {resume.kind === 'sec' ? `§${resume.item.no} · ${resume.item.short}` : resume.item.railName}
                      </button>
                      <button type="button" className="dl12r-resume__x" onClick={() => setResumeOpen(false)} aria-label="Dismiss the resume suggestion">
                        dismiss
                      </button>
                    </span>
                  )}
                </div>
                <p className="dl12r-hero__stats">
                  <span><b>{SECTIONS.length}</b> sections</span>
                  <span><b>{LAB_COUNT}</b> quick labs</span>
                  <span><b>{PAGES.length}</b> notebook pages · {TOTAL_LINES} lines</span>
                  <span>Esc leaves focus mode</span>
                </p>
              </div>

              {STOPS.map((st, i) => {
                const first = i === 0 || STOPS[i - 1].item.lec !== st.item.lec;
                const node = st.kind === 'sec'
                  ? <StudySection key={st.id} s={st.item} />
                  : (
                    <NotebookSection
                      key={st.id}
                      p={st.item}
                      ticked={sheetTicks[st.id] || NONE}
                      onToggle={toggleSheetTick}
                      onSetAll={setAllSheetTicks}
                    />
                  );
                return first ? [<PartHead key={`part${st.item.lec}`} lec={st.item.lec} />, node] : node;
              })}

              <footer className="dl12r-end">
                <p>
                  End of the refresher. Sources: <em>CITS5017 Topic 1: Introduction to Artificial Neural Networks</em> (64 slides) and
                  <em> Topic 2: Training Deep Neural Networks</em> (68 slides), A/Prof Du Huynh, UWA, Semester 2 2026. The toy data and
                  computed numbers in the labs are this page’s own; numbers quoted from the slides carry a slide receipt.
                </p>
              </footer>
            </main>
          </div>
        </div>
      </RefsProvider>
    </StudyCtx.Provider>
  );
}
